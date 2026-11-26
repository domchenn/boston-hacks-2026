-- Crumbs can be ticked only while the trail is in progress.
--
-- Before: private.can_complete_item allowed ticks whenever you had a progress row
-- that wasn't aborted, so a trail you had only saved (never started) or had already
-- finished could still get new ticks. Product decision (2026-11-26): you tick crumbs
-- while running a trail, so new ticks need status 'in_progress'.
--
-- Unchanged: existing ticks are never deleted by this. Stopping a trail (aborted)
-- keeps them, and starting it again resumes with them. Unticking your own ticks is
-- still allowed at any time (the delete policy doesn't use this function). Same
-- signature and grants as before (create or replace keeps them).
--
-- Runs after 20261121120003_create_quest_progress_and_checklists (which created the
-- function and the insert policy that calls it). Used by: the active trail page
-- (toggleCrumb in apps/web/src/lib/api/progress.ts) and the API's
-- PUT /v1/me/crumbs/:crumbId, which answers 403 when this returns false.

create or replace function private.can_complete_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.checklist_items ci
    join public.user_sidequests us
      on us.sidequest_id = ci.sidequest_id and us.user_id = (select auth.uid())
    where ci.id = p_item_id and us.status = 'in_progress'
  );
$$;

comment on function private.can_complete_item(uuid) is
  'True when the current user has this crumb''s trail in progress. Used by the checklist_completions insert policy.';
