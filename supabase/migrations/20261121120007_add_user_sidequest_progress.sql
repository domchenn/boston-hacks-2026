-- =============================================================================
-- Breadcrumb — 20261121120007_add_user_sidequest_progress.sql
--
-- Creates user_sidequests: each user's status on each sidequest.
--
-- One private row per user per sidequest, status one of:
--   saved · signed_up · in_progress · completed · aborted
-- This single table drives the profile tabs and Quest mode buttons.
-- A trigger fills started_at / completed_at and only allows signed_up for
-- sidequests with a scheduled start.
--
-- Runs after: 20261121120006_add_checklist_items.sql
-- Used by:    Save / Sign up / Start / Completed / Abort buttons, profile tabs
--
-- Immutable once applied: make further changes in a new migration
-- (npx supabase migration new <name>).
-- =============================================================================

-- =============================================================================
-- user_sidequests — one row per user per sidequest holding its status
--    saved → signed_up → in_progress → completed / aborted (any order allowed)
-- Private: each user sees only their own rows (PRD §9).
-- =============================================================================
create table public.user_sidequests (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  status       text not null check (status in ('saved', 'signed_up', 'in_progress', 'completed', 'aborted')),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, sidequest_id),
  constraint user_sidequests_completed_at check ((status = 'completed') = (completed_at is not null))
);
create index user_sidequests_status_idx    on public.user_sidequests (user_id, status);
create index user_sidequests_sidequest_idx on public.user_sidequests (sidequest_id);

-- Fill in timestamps and validate status changes:
--  * in_progress sets started_at (first time only)
--  * completed sets completed_at; leaving completed clears it
--  * signed_up only for scheduled sidequests (PRD §5.3)
create function private.user_sidequests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.started_at := coalesce(new.started_at, new.completed_at);
  else
    new.completed_at := null;
  end if;

  if new.status = 'signed_up' and not exists (
    select 1 from public.sidequests s
    where s.id = new.sidequest_id and s.scheduled_at is not null
  ) then
    raise exception 'Can only sign up for a sidequest with a scheduled start'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger user_sidequests_before_write
  before insert or update on public.user_sidequests
  for each row execute function private.user_sidequests_before_write();

alter table public.user_sidequests enable row level security;
create policy "Users read their own progress"
  on public.user_sidequests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users add progress for visible sidequests"
  on public.user_sidequests for insert to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_view_sidequest(sidequest_id)));
create policy "Users update their own progress"
  on public.user_sidequests for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete their own progress"
  on public.user_sidequests for delete to authenticated
  using (user_id = (select auth.uid()));


revoke all on function private.user_sidequests_before_write() from public, anon, authenticated;
