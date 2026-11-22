-- =============================================================================
-- Breadcrumb — add_reports_and_admin_moderation
--
-- Safety for real users (task D8):
--
-- 1. profiles.is_admin: team accounts that can review reports and hide content.
--    Users must not be able to make themselves admins, so the "update your own
--    profile" rule is narrowed to the columns the app actually edits
--    (column privileges): username, display_name, avatar_url, bio, university,
--    community_id. is_admin is only set by the team (SQL editor / service role).
--
-- 2. reports: anyone logged in can report a trail, a review or a photo (one
--    report per person per item). Only admins can read and resolve reports;
--    reporters can see their own.
--
-- 3. Admin moderation powers (checked by private.is_admin()):
--    - archive (hide) any trail: update sidequests.status
--    - delete any review (sidequest_ratings) or trail photo (quest_photos)
--
-- Runs after: add_friends_activity_function.
-- Used by: Report buttons (Trail detail, reviews, photos), /admin/reports.
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Admin flag, and stop users from setting it on themselves
-- -----------------------------------------------------------------------------
alter table public.profiles add column is_admin boolean not null default false;
comment on column public.profiles.is_admin is
  'Team moderators. Set only by the team (SQL editor); users cannot change it.';

revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, bio, university, community_id)
  on public.profiles to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 2. Reports
-- -----------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('trail', 'review', 'photo')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'inappropriate', 'unsafe', 'wrong_info', 'other')),
  note        text check (char_length(note) <= 1000),
  status      text not null default 'open' check (status in ('open', 'hidden', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  unique (reporter_id, target_type, target_id)
);
comment on column public.reports.target_id is
  'The reported row: sidequests.id (trail), sidequest_ratings.id (review) or quest_photos.id (photo).';
create index reports_open_idx on public.reports (created_at desc) where status = 'open';

alter table public.reports enable row level security;

create policy "Users report as themselves"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');
create policy "Reporters see their reports; admins see all"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins resolve reports"
  on public.reports for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

grant select, insert, update on public.reports to authenticated;


-- -----------------------------------------------------------------------------
-- 3. Admin moderation powers
-- -----------------------------------------------------------------------------
create policy "Admins can see every trail"
  on public.sidequests for select to authenticated
  using ((select private.is_admin()));
create policy "Admins can hide any trail"
  on public.sidequests for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
create policy "Admins can delete any review"
  on public.sidequest_ratings for delete to authenticated
  using ((select private.is_admin()));
create policy "Admins can delete any trail photo"
  on public.quest_photos for delete to authenticated
  using ((select private.is_admin()));
