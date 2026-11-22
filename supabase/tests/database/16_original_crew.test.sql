-- =============================================================================
-- Database tests: Original Crew (trail_crew, set_trail_crew, respond_to_crew).
--
-- Checks that only the creator can tag, only friends get tagged, pending tags are
-- private to the two people involved, accepted crew are public with the trail,
-- re-saving keeps answers (a declined friend isn't asked again), untagging
-- removes people, tagged people can remove themselves, and logged-out visitors
-- see accepted crew but can't tag. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'maker@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'pal@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'pal2@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'stranger@test.dev');

-- maker <-> pal, maker <-> pal2 are friends; stranger follows maker only.
insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');

insert into public.sidequests (id, creator_id, title, status) values
  ('c5000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Our walk', 'published');

-- ---------------------------------------------------------------- as the creator
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select is(public.set_trail_crew('c5000000-0000-0000-0000-000000000001',
  array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444']::uuid[]),
  2, 'the creator can tag friends; non-friends are skipped');
select is((select array_agg(status) from public.trail_crew), array['pending', 'pending'], 'new tags start pending');

-- ---------------------------------------------------------------- as the stranger
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is((select count(*)::int from public.trail_crew), 0, 'pending tags are private');
select throws_ok($$select public.set_trail_crew('c5000000-0000-0000-0000-000000000001', array['44444444-4444-4444-4444-444444444444']::uuid[])$$,
  '42501', null, 'only the creator can tag the crew');

-- ---------------------------------------------------------------- the tagged friends answer
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.trail_crew), 1, 'a tagged friend sees their own tag');
select lives_ok($$select public.respond_to_crew('c5000000-0000-0000-0000-000000000001', true)$$, 'and can accept');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select lives_ok($$select public.respond_to_crew('c5000000-0000-0000-0000-000000000001', false)$$, 'or decline');

-- ---------------------------------------------------------------- visibility
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select results_eq($$select user_id from public.trail_crew$$,
  $$values ('22222222-2222-2222-2222-222222222222'::uuid)$$, 'accepted crew are public, declined ones aren''t');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is((select count(*)::int from public.trail_crew), 1, 'logged-out visitors see the accepted crew too');
select throws_ok($$select public.set_trail_crew('c5000000-0000-0000-0000-000000000001', '{}')$$, '42501', null,
  'but can''t tag anyone');

-- ---------------------------------------------------------------- creator re-saves
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select public.set_trail_crew('c5000000-0000-0000-0000-000000000001',
  array['22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]);
select is((select status from public.trail_crew where user_id = '33333333-3333-3333-3333-333333333333'),
  'declined', 're-saving keeps answers, so a declined friend isn''t asked again');
select public.set_trail_crew('c5000000-0000-0000-0000-000000000001', array['22222222-2222-2222-2222-222222222222']::uuid[]);
select is((select count(*)::int from public.trail_crew), 1, 'untagging someone removes them');

-- ---------------------------------------------------------------- a crew member leaves
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
delete from public.trail_crew where user_id = '22222222-2222-2222-2222-222222222222';
reset role;
select is((select count(*)::int from public.trail_crew), 0, 'a crew member can take themselves off');

select * from finish();
rollback;
