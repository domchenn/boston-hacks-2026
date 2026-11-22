-- =============================================================================
-- Database tests: the demo activity seeded for judging (task D6).
--
-- Checks that a visitor sees real ratings on the curated anytime trails, a
-- questgiver rating for the breadcrumb account, people going on the scheduled
-- trails, and that the curated stops use the verified coordinates.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select ok(
  (select rating_count from public.sidequest_rating_stats
   where sidequest_id = '5eed0000-0000-4000-8000-000000000001') >= 3,
  'Sunday Café Hop shows at least 3 ratings');
select ok(
  (select rating_count from public.sidequest_rating_stats
   where sidequest_id = '5eed0000-0000-4000-8000-000000000002') >= 2,
  'North End Cannoli Duel shows at least 2 ratings');
select ok(
  (select rating_count from public.questgiver_ratings
   where creator_id = 'b2ead000-0000-4000-8000-000000000001') >= 5,
  'the breadcrumb account has a questgiver rating');
select ok(
  (select going_count from public.trail_going_counts(array['5eed0000-0000-4000-8000-000000000003'::uuid])) >= 2,
  'people are going on the scheduled Harvard trail');
select is(
  (select latitude from public.sidequest_stops where id = '5e000000-0000-4000-8001-000000000001'),
  42.35792::double precision, 'Tatte''s stop uses the verified coordinates');

select * from finish();
rollback;
