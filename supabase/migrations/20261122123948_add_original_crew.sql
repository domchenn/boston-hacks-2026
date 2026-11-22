-- =============================================================================
-- Breadcrumb — add_original_crew
--
-- The Original Crew: friends who were there when the creator first did the
-- trail. The creator tags them while making or editing it; each tagged friend
-- accepts or declines. Accepted crew show on the trail page ("Original crew")
-- and on their own profile, so a trail can belong to a group, not just its
-- creator. This keeps three roles apart: the creator, the original crew, and
-- everyone who does the trail later (outings).
--
-- - trail_crew: one row per (trail, tagged person): pending → accepted / declined.
-- - Only friends (mutual follows) of the creator can be tagged.
-- - Accepted crew are public wherever the trail is visible. Pending and declined
--   tags are seen only by the creator and the tagged person.
-- - set_trail_crew(trail, people): the creator's whole list in one call (adds
--   new tags as pending, removes untagged people, keeps existing answers, so a
--   declined friend isn't asked again by re-saving).
-- - respond_to_crew(trail, accept): the tagged person answers. They can also
--   remove themselves later (delete their own row).
--
-- Runs after: add_outings.
-- Used by: Make / Edit a trail (tag friends), Trail detail (Original crew, the
-- tag request), Explore → Friends (crew requests), Profile (Original crew on).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

create table public.trail_crew (
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  added_by     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (sidequest_id, user_id)
);
create index trail_crew_user_idx on public.trail_crew (user_id, status);

comment on table public.trail_crew is
  'Original Crew: friends the creator tagged as part of the first time the trail was done. Pending until the tagged person accepts or declines.';

alter table public.trail_crew enable row level security;

create policy "Accepted crew are public; tags are seen by those involved"
  on public.trail_crew for select to anon, authenticated
  using (
    (status = 'accepted' and (select private.can_view_sidequest(sidequest_id)))
    or user_id = (select auth.uid())
    or (select private.owns_sidequest(sidequest_id))
  );

-- Tagged people can take themselves off; creators manage the list through set_trail_crew.
create policy "Tagged people can remove themselves"
  on public.trail_crew for delete to authenticated
  using (user_id = (select auth.uid()));

grant select on public.trail_crew to anon, authenticated;
grant delete on public.trail_crew to authenticated;

-- The creator's crew list for a trail, all at once. Returns how many people are tagged.
create or replace function public.set_trail_crew(p_sidequest_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count integer;
begin
  if v_user is null or not private.owns_sidequest(p_sidequest_id) then
    raise exception 'Only the trail''s creator can tag its crew' using errcode = '42501';
  end if;

  delete from public.trail_crew c
  where c.sidequest_id = p_sidequest_id and not (c.user_id = any (coalesce(p_user_ids, '{}')));

  insert into public.trail_crew (sidequest_id, user_id, added_by)
  select distinct p_sidequest_id, u, v_user
  from unnest(coalesce(p_user_ids, '{}')) u
  where private.are_friends(v_user, u)
  on conflict (sidequest_id, user_id) do nothing;

  select count(*)::int into v_count from public.trail_crew where sidequest_id = p_sidequest_id;
  return v_count;
end;
$$;

-- A tagged person accepts or declines being on the crew.
create or replace function public.respond_to_crew(p_sidequest_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.trail_crew
  set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where sidequest_id = p_sidequest_id and user_id = (select auth.uid());
  if not found then
    raise exception 'You weren''t tagged on that trail' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.set_trail_crew(uuid, uuid[]) is 'Creator sets the Original Crew of their trail (friends only); new tags start pending.';
comment on function public.respond_to_crew(uuid, boolean) is 'A tagged friend accepts or declines being on a trail''s Original Crew.';

revoke all on function public.set_trail_crew(uuid, uuid[])    from public, anon;
revoke all on function public.respond_to_crew(uuid, boolean)  from public, anon;
grant execute on function public.set_trail_crew(uuid, uuid[])   to authenticated;
grant execute on function public.respond_to_crew(uuid, boolean) to authenticated;
