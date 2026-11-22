-- =============================================================================
-- Database tests: trending_trails() for Explore's Trending tab.
--
-- Checks the scoring (finish 3, start 2, rating 2, save 1), the people count,
-- the order, that the creator's own activity and anything older than the
-- window don't count, that drafts and trails hidden from the caller are left
-- out, and that only signed-in users can call it. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'creator@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'walker1@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'walker2@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'viewer@test.dev');

insert into public.sidequests (id, creator_id, title, status, visibility) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Busy',    'published', 'public'),
  ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Quiet',   'published', 'public'),
  ('a1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Friends', 'published', 'friends'),
  ('a1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Draft',   'draft',     'public');

insert into public.user_sidequests (user_id, sidequest_id, status, started_at, completed_at) values
  -- Busy: walker1 finished (3 + 2 for starting), walker2 saved (1)
  ('22222222-2222-2222-2222-222222222222', 'a1000000-0000-0000-0000-000000000001', 'completed', null, null),
  ('33333333-3333-3333-3333-333333333333', 'a1000000-0000-0000-0000-000000000001', 'saved', null, null),
  -- Quiet: walker2 started (2); walker1 finished a month ago (doesn't count);
  -- the creator finished their own trail (doesn't count)
  ('33333333-3333-3333-3333-333333333333', 'a1000000-0000-0000-0000-000000000002', 'in_progress', null, null),
  ('22222222-2222-2222-2222-222222222222', 'a1000000-0000-0000-0000-000000000002', 'completed',
     now() - interval '30 days', now() - interval '30 days'),
  ('11111111-1111-1111-1111-111111111111', 'a1000000-0000-0000-0000-000000000002', 'completed', null, null),
  -- Friends-only trail and a draft: activity, but hidden from the viewer
  ('22222222-2222-2222-2222-222222222222', 'a1000000-0000-0000-0000-000000000003', 'completed', null, null),
  ('22222222-2222-2222-2222-222222222222', 'a1000000-0000-0000-0000-000000000004', 'in_progress', null, null);

-- Busy: walker1 rated it (2)
insert into public.sidequest_ratings (user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating)
values ('22222222-2222-2222-2222-222222222222', 'a1000000-0000-0000-0000-000000000001', 5, 5, 5, 5);

-- ---------------------------------------------------------------- as the viewer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select results_eq(
  $$select sidequest_id, score, people from public.trending_trails(14, 100)
    where sidequest_id::text like 'a1000000-%'$$,
  $$values ('a1000000-0000-0000-0000-000000000001'::uuid, 8, 2),
           ('a1000000-0000-0000-0000-000000000002'::uuid, 2, 1)$$,
  'scores recent activity by others, highest first; hidden trails and drafts are left out');

select is((select score from public.trending_trails(60) where sidequest_id = 'a1000000-0000-0000-0000-000000000002'),
  7, 'a longer window counts the older finish too (2 + 3 + 2)');

select is((select count(*)::int from public.trending_trails(14, 1)), 1, 'p_limit caps the list');
-- (The demo trails seeded by earlier migrations may also show up, so the checks
-- above only look at this test's trails.)

-- ---------------------------------------------------------------- as the creator
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select score from public.trending_trails() where sidequest_id = 'a1000000-0000-0000-0000-000000000003'),
  5, 'trails the caller can see (here: their own friends-only trail) are included');

-- ---------------------------------------------------------------- logged out
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$select * from public.trending_trails()$$, '42501', null, 'logged-out visitors can''t call it');

select * from finish();
rollback;
