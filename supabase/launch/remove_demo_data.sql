-- =============================================================================
-- Breadcrumb — remove_demo_data   (NOT a migration yet: run only at launch)
--
-- Removes the made-up demo activity added for the hackathon demo
-- (seed_demo_activity_and_fix_coordinates): the three demo accounts
-- @maya_k, @jrod and @priya_s, and with them (via cascades) their profiles,
-- progress, ratings + reviews, sign-ups, photos and reports.
--
-- Keeps: the "breadcrumb" team account, the curated trails and places, and the
-- coordinate fixes. Those are real, verified content.
--
-- Why it isn't in supabase/migrations/: `npm run db:push` applies everything in
-- that folder, which would wipe the demo before the demo. At launch:
--   1. npm run db:new -- remove_demo_data
--   2. paste this file's SQL into the new migration (update the header)
--   3. open a db/… PR, merge, then npm run db:push
-- =============================================================================

delete from auth.users
where id in (
  'd0000000-0000-4000-8000-000000000001',  -- @maya_k
  'd0000000-0000-4000-8000-000000000002',  -- @jrod
  'd0000000-0000-4000-8000-000000000003'   -- @priya_s
);
