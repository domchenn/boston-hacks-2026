-- =============================================================================
-- Breadcrumb — add_outings
--
-- Trails vs outings. A trail (sidequests) is the reusable plan; an OUTING is one
-- time someone actually does it, alone or with friends. Until now progress was
-- one user_sidequests row per person per trail, so "Do it again" had nowhere to
-- go: a finished trail stayed finished and its ticks were reused. Now:
--
-- - outings: one row per run of a trail (active → completed, or ended if
--   everyone left). Finished outings are never reopened, so history is kept.
-- - outing_members: who's on it. The host starts it; joined members can invite
--   friends (mutual follows), who accept or decline.
-- - outing_checks: the SHARED checklist for that run. Any joined member can tick
--   or untick a crumb while the outing is active; everyone sees the same ticks.
-- - quest_photos.outing_id: which outing a photo was taken on (optional).
--
-- user_sidequests stays as each person's summary of a trail (saved / in progress
-- / finished), which drives Saved, Finished, ratings, badges and friends'
-- activity. The functions below keep it in step: starting or joining an outing
-- marks it in progress (a finished trail stays finished), finishing an outing
-- marks every joined member finished. No scheduling: outings start now.
--
-- Writes go through SECURITY DEFINER functions (start_outing, invite_to_outing,
-- respond_to_outing, leave_outing, finish_outing) so the rules hold together;
-- members can only read their own outings, and tick crumbs directly under RLS.
--
-- Existing progress is backfilled: every started user_sidequests row becomes a
-- solo outing with its ticked crumbs and photos, so nobody loses history.
-- checklist_completions is kept but no longer written by the app.
--
-- Runs after: add_friends_also_saved_function.
-- Used by: Active trail (/trails/:id/go), Trail detail ("Do it again", your
-- outings), Explore → Friends (outing invites).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.outings (
  id           uuid primary key default gen_random_uuid(),
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  host_id      uuid references public.profiles (id) on delete set null,
  status       text not null default 'active' check (status in ('active', 'completed', 'ended')),
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint outings_completed_at check ((status = 'completed') = (completed_at is not null))
);
create index outings_sidequest_idx on public.outings (sidequest_id, started_at desc);

comment on table public.outings is
  'One run of a trail, alone or with friends. Finished outings are kept as history; doing a trail again starts a new outing.';

create table public.outing_members (
  outing_id    uuid not null references public.outings (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null check (status in ('invited', 'joined', 'declined', 'left')),
  invited_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (outing_id, user_id)
);
create index outing_members_user_idx on public.outing_members (user_id, status);

comment on table public.outing_members is
  'Who is on an outing: the host and friends they invited (invited → joined / declined; joined → left).';

create table public.outing_checks (
  outing_id         uuid not null references public.outings (id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items (id) on delete cascade,
  checked_by        uuid references public.profiles (id) on delete set null,
  checked_at        timestamptz not null default now(),
  primary key (outing_id, checklist_item_id)
);
create index outing_checks_item_idx on public.outing_checks (checklist_item_id);

comment on table public.outing_checks is
  'The shared checklist of an outing: crumbs ticked by anyone on it.';

alter table public.quest_photos
  add column outing_id uuid references public.outings (id) on delete set null;
create index quest_photos_outing_idx on public.quest_photos (outing_id) where outing_id is not null;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- Is the current user on this outing with one of these statuses? Definer so
-- policies on outing_members can use it without recursing into themselves.
create or replace function private.on_outing(p_outing_id uuid, p_statuses text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.outing_members m
    where m.outing_id = p_outing_id
      and m.user_id = (select auth.uid())
      and m.status = any (p_statuses)
  );
$$;
revoke all on function private.on_outing(uuid, text[]) from public;
grant execute on function private.on_outing(uuid, text[]) to authenticated;

-- Can the current user tick crumbs on this outing? Joined, and it's still going.
create or replace function private.can_tick_outing(p_outing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.on_outing(p_outing_id, array['joined'])
    and exists (select 1 from public.outings o where o.id = p_outing_id and o.status = 'active');
$$;
revoke all on function private.can_tick_outing(uuid) from public;
grant execute on function private.can_tick_outing(uuid) to authenticated;

-- A crumb must belong to the outing's trail.
create or replace function private.outing_checks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.outings o
    join public.checklist_items ci on ci.sidequest_id = o.sidequest_id
    where o.id = new.outing_id and ci.id = new.checklist_item_id
  ) then
    raise exception 'That crumb isn''t on this trail' using errcode = 'check_violation';
  end if;
  -- Stamp who ticked it (kept as given when there's no login, e.g. the backfill).
  new.checked_by := coalesce((select auth.uid()), new.checked_by);
  return new;
end;
$$;
revoke all on function private.outing_checks_before_insert() from public, anon, authenticated;
create trigger outing_checks_before_insert
  before insert on public.outing_checks
  for each row execute function private.outing_checks_before_insert();

-- A photo's outing must be the same trail, and the uploader must have been on it.
create or replace function private.quest_photos_check_outing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.outing_id is not null and not exists (
    select 1 from public.outings o
    join public.outing_members m on m.outing_id = o.id
    where o.id = new.outing_id
      and o.sidequest_id = new.sidequest_id
      and m.user_id = new.user_id
      and m.status in ('joined', 'left')
  ) then
    raise exception 'That photo isn''t from one of your outings of this trail' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.quest_photos_check_outing() from public, anon, authenticated;
create trigger quest_photos_check_outing
  before insert or update of outing_id on public.quest_photos
  for each row execute function private.quest_photos_check_outing();

-- Mark the current user's summary row in progress, unless they've already
-- finished this trail (a finished trail stays on their Finished tab).
create or replace function private.mark_in_progress(p_user_id uuid, p_sidequest_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.user_sidequests (user_id, sidequest_id, status)
  values (p_user_id, p_sidequest_id, 'in_progress')
  on conflict (user_id, sidequest_id) do update
    set status = case when public.user_sidequests.status = 'completed' then 'completed' else 'in_progress' end;
$$;
revoke all on function private.mark_in_progress(uuid, uuid) from public, anon, authenticated;

-- End outings nobody is on any more.
create or replace function private.end_empty_outing(p_outing_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.outings o set status = 'ended'
  where o.id = p_outing_id and o.status = 'active'
    and not exists (select 1 from public.outing_members m where m.outing_id = o.id and m.status = 'joined');
$$;
revoke all on function private.end_empty_outing(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security: members read their outings; writes go through functions
-- (except ticking crumbs, which joined members do directly).
-- -----------------------------------------------------------------------------
alter table public.outings        enable row level security;
alter table public.outing_members enable row level security;
alter table public.outing_checks  enable row level security;

create policy "Members read their outings"
  on public.outings for select to authenticated
  using ((select private.on_outing(id, array['invited', 'joined', 'left'])));

create policy "Members see who else is on their outings"
  on public.outing_members for select to authenticated
  using (user_id = (select auth.uid())
         or (select private.on_outing(outing_id, array['invited', 'joined', 'left'])));

create policy "Members read their outing's checklist"
  on public.outing_checks for select to authenticated
  using ((select private.on_outing(outing_id, array['joined', 'left'])));
create policy "Joined members tick crumbs on an active outing"
  on public.outing_checks for insert to authenticated
  with check ((select private.can_tick_outing(outing_id)));
create policy "Joined members untick crumbs on an active outing"
  on public.outing_checks for delete to authenticated
  using ((select private.can_tick_outing(outing_id)));

grant select on public.outings, public.outing_members to authenticated;
grant select, insert, delete on public.outing_checks to authenticated;

-- -----------------------------------------------------------------------------
-- Functions
-- -----------------------------------------------------------------------------

-- Start doing a trail, or pick up the outing you're already on. Returns its id.
-- After a finished outing this starts a fresh one ("Do it again").
create or replace function public.start_outing(p_sidequest_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_outing uuid;
begin
  if v_user is null then
    raise exception 'Log in to start a trail' using errcode = '42501';
  end if;
  if not private.can_view_sidequest(p_sidequest_id) then
    raise exception 'Trail not found' using errcode = '42501';
  end if;

  select o.id into v_outing
  from public.outings o
  join public.outing_members m on m.outing_id = o.id and m.user_id = v_user and m.status = 'joined'
  where o.sidequest_id = p_sidequest_id and o.status = 'active'
  order by o.started_at desc
  limit 1;

  if v_outing is null then
    insert into public.outings (sidequest_id, host_id) values (p_sidequest_id, v_user) returning id into v_outing;
    insert into public.outing_members (outing_id, user_id, status, responded_at) values (v_outing, v_user, 'joined', now());
  end if;

  perform private.mark_in_progress(v_user, p_sidequest_id);
  return v_outing;
end;
$$;

-- Invite friends to an outing you're on. Only friends (mutual follows); people
-- already on it are skipped; someone who declined or left can be asked again.
-- Returns how many invites were sent.
create or replace function public.invite_to_outing(p_outing_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if not private.can_tick_outing(p_outing_id) then
    raise exception 'You can only invite friends to an outing you''re on' using errcode = '42501';
  end if;

  with invitees as (
    select distinct u as user_id from unnest(p_user_ids) u
    where private.are_friends(v_user, u)
  ), written as (
    insert into public.outing_members (outing_id, user_id, status, invited_by)
    select p_outing_id, i.user_id, 'invited', v_user from invitees i
    on conflict (outing_id, user_id) do update
      set status = 'invited', invited_by = excluded.invited_by, created_at = now(), responded_at = null
      where public.outing_members.status in ('declined', 'left')
    returning 1
  )
  select count(*)::int into v_count from written;
  return v_count;
end;
$$;

-- Accept or decline an invite. Accepting moves you off any other outing of the
-- same trail you were on (ending it if you were the last one there).
create or replace function public.respond_to_outing(p_outing_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_trail uuid;
  v_other uuid;
begin
  select o.sidequest_id into v_trail
  from public.outings o
  join public.outing_members m on m.outing_id = o.id and m.user_id = v_user and m.status = 'invited'
  where o.id = p_outing_id and o.status = 'active';
  if v_trail is null then
    raise exception 'That invite isn''t open any more' using errcode = 'P0002';
  end if;

  if not p_accept then
    update public.outing_members set status = 'declined', responded_at = now()
    where outing_id = p_outing_id and user_id = v_user;
    return;
  end if;

  if not private.can_view_sidequest(v_trail) then
    raise exception 'Trail not found' using errcode = '42501';
  end if;

  for v_other in
    select o.id from public.outings o
    join public.outing_members m on m.outing_id = o.id and m.user_id = v_user and m.status = 'joined'
    where o.sidequest_id = v_trail and o.status = 'active' and o.id <> p_outing_id
  loop
    update public.outing_members set status = 'left', responded_at = now()
    where outing_id = v_other and user_id = v_user;
    perform private.end_empty_outing(v_other);
  end loop;

  update public.outing_members set status = 'joined', responded_at = now()
  where outing_id = p_outing_id and user_id = v_user;
  perform private.mark_in_progress(v_user, v_trail);
end;
$$;

-- Leave an outing ("Stop trail"). The last one out ends it. Your trail goes
-- back to not started unless you've finished it before (status aborted, as
-- before outings).
create or replace function public.leave_outing(p_outing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_trail uuid;
begin
  select o.sidequest_id into v_trail from public.outings o where o.id = p_outing_id and o.status = 'active';
  if v_trail is null or not private.on_outing(p_outing_id, array['joined']) then
    raise exception 'You''re not on that outing' using errcode = '42501';
  end if;

  update public.outing_members set status = 'left', responded_at = now()
  where outing_id = p_outing_id and user_id = v_user;
  perform private.end_empty_outing(p_outing_id);

  update public.user_sidequests set status = 'aborted'
  where user_id = v_user and sidequest_id = v_trail and status in ('in_progress', 'saved');
end;
$$;

-- Finish an outing, for everyone on it: it's kept as a finished outing, and
-- every joined member's trail is marked finished (which unlocks rating).
create or replace function public.finish_outing(p_outing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trail uuid;
begin
  if not private.can_tick_outing(p_outing_id) then
    raise exception 'You''re not on that outing' using errcode = '42501';
  end if;

  update public.outings set status = 'completed', completed_at = now()
  where id = p_outing_id
  returning sidequest_id into v_trail;

  insert into public.user_sidequests (user_id, sidequest_id, status, completed_at)
  select m.user_id, v_trail, 'completed', now()
  from public.outing_members m
  where m.outing_id = p_outing_id and m.status = 'joined'
  on conflict (user_id, sidequest_id) do update set status = 'completed', completed_at = now();
end;
$$;

comment on function public.start_outing(uuid) is 'Start doing a trail now, or resume the outing you are on. Returns the outing id.';
comment on function public.invite_to_outing(uuid, uuid[]) is 'Invite friends (mutual follows) to an active outing you are on.';
comment on function public.respond_to_outing(uuid, boolean) is 'Accept or decline an outing invite.';
comment on function public.leave_outing(uuid) is 'Leave an active outing; the last member out ends it.';
comment on function public.finish_outing(uuid) is 'Finish an outing for everyone on it.';

revoke all on function public.start_outing(uuid)                from public, anon;
revoke all on function public.invite_to_outing(uuid, uuid[])    from public, anon;
revoke all on function public.respond_to_outing(uuid, boolean)  from public, anon;
revoke all on function public.leave_outing(uuid)                from public, anon;
revoke all on function public.finish_outing(uuid)               from public, anon;
grant execute on function public.start_outing(uuid)               to authenticated;
grant execute on function public.invite_to_outing(uuid, uuid[])   to authenticated;
grant execute on function public.respond_to_outing(uuid, boolean) to authenticated;
grant execute on function public.leave_outing(uuid)               to authenticated;
grant execute on function public.finish_outing(uuid)              to authenticated;

-- -----------------------------------------------------------------------------
-- Backfill: each started trail becomes a solo outing with its ticks and photos.
-- -----------------------------------------------------------------------------
create temporary table outing_backfill on commit drop as
select us.user_id, us.sidequest_id, us.status, us.started_at, us.completed_at, gen_random_uuid() as outing_id
from public.user_sidequests us
where us.started_at is not null or us.status = 'completed';

insert into public.outings (id, sidequest_id, host_id, status, started_at, completed_at, created_at)
select b.outing_id, b.sidequest_id, b.user_id,
       case b.status when 'completed' then 'completed' when 'aborted' then 'ended' else 'active' end,
       coalesce(b.started_at, b.completed_at),
       case when b.status = 'completed' then b.completed_at end,
       coalesce(b.started_at, b.completed_at)
from outing_backfill b;

insert into public.outing_members (outing_id, user_id, status, responded_at)
select b.outing_id, b.user_id, case when b.status = 'aborted' then 'left' else 'joined' end, b.started_at
from outing_backfill b;

insert into public.outing_checks (outing_id, checklist_item_id, checked_by, checked_at)
select b.outing_id, cc.checklist_item_id, cc.user_id, cc.completed_at
from outing_backfill b
join public.checklist_items ci on ci.sidequest_id = b.sidequest_id
join public.checklist_completions cc on cc.checklist_item_id = ci.id and cc.user_id = b.user_id;

update public.quest_photos p set outing_id = b.outing_id
from outing_backfill b
where p.user_id = b.user_id and p.sidequest_id = b.sidequest_id;

drop table outing_backfill;
