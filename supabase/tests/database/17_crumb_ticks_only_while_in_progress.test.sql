-- =============================================================================
-- Database tests: crumbs can be ticked only while the trail is in progress
-- (migration restrict_crumb_ticks_to_trails_in_progress).
--
-- Saved-but-not-started and finished trails refuse new ticks; stopping a trail
-- (aborted) refuses new ticks but keeps the existing ones, and starting it again
-- resumes with them. Unticking your own crumbs works in any status. Rolled back,
-- so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111117', 'creator17@test.dev'),
  ('22222222-2222-2222-2222-222222222217', 'player17@test.dev');

insert into public.sidequests (id, creator_id, title, status) values
  ('a0000000-0000-0000-0000-000000000017', '11111111-1111-1111-1111-111111111117', 'Crumb walk', 'published');

insert into public.sidequest_stops (id, sidequest_id, place_name, stop_order) values
  ('50000000-0000-0000-0000-000000000017', 'a0000000-0000-0000-0000-000000000017', 'Stop 1', 0);

insert into public.checklist_items (id, sidequest_id, stop_id, label, item_order) values
  ('ca000000-0000-0000-0000-000000000171', 'a0000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000017', 'First', 0),
  ('ca000000-0000-0000-0000-000000000172', 'a0000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000017', 'Second', 1),
  ('ca000000-0000-0000-0000-000000000173', 'a0000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000017', 'Third', 2);

-- ---------------------------------------------------------------- as the player
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222217", "role": "authenticated"}', true);

select throws_ok(
  $$insert into public.checklist_completions (user_id, checklist_item_id) values ('22222222-2222-2222-2222-222222222217', 'ca000000-0000-0000-0000-000000000171')$$,
  '42501', null, 'no progress row: cannot tick');

insert into public.user_sidequests (user_id, sidequest_id, status) values ('22222222-2222-2222-2222-222222222217', 'a0000000-0000-0000-0000-000000000017', 'saved');
select throws_ok(
  $$insert into public.checklist_completions (user_id, checklist_item_id) values ('22222222-2222-2222-2222-222222222217', 'ca000000-0000-0000-0000-000000000171')$$,
  '42501', null, 'saved but not started: cannot tick');

update public.user_sidequests set status = 'in_progress' where sidequest_id = 'a0000000-0000-0000-0000-000000000017';
select lives_ok(
  $$insert into public.checklist_completions (user_id, checklist_item_id) values ('22222222-2222-2222-2222-222222222217', 'ca000000-0000-0000-0000-000000000171')$$,
  'in progress: can tick');

update public.user_sidequests set status = 'aborted' where sidequest_id = 'a0000000-0000-0000-0000-000000000017';
select throws_ok(
  $$insert into public.checklist_completions (user_id, checklist_item_id) values ('22222222-2222-2222-2222-222222222217', 'ca000000-0000-0000-0000-000000000172')$$,
  '42501', null, 'stopped (aborted): cannot tick new crumbs');
select is(
  (select count(*)::int from public.checklist_completions where user_id = '22222222-2222-2222-2222-222222222217'),
  1, 'stopped (aborted): existing ticks are kept');

update public.user_sidequests set status = 'in_progress' where sidequest_id = 'a0000000-0000-0000-0000-000000000017';
select is(
  (select count(*)::int from public.checklist_completions where user_id = '22222222-2222-2222-2222-222222222217'),
  1, 'resumed: the earlier tick is still there');
select lives_ok(
  $$insert into public.checklist_completions (user_id, checklist_item_id) values ('22222222-2222-2222-2222-222222222217', 'ca000000-0000-0000-0000-000000000172')$$,
  'resumed: can tick again');

update public.user_sidequests set status = 'completed' where sidequest_id = 'a0000000-0000-0000-0000-000000000017';
select throws_ok(
  $$insert into public.checklist_completions (user_id, checklist_item_id) values ('22222222-2222-2222-2222-222222222217', 'ca000000-0000-0000-0000-000000000173')$$,
  '42501', null, 'finished: cannot tick new crumbs');
select is(
  (select count(*)::int from public.checklist_completions where user_id = '22222222-2222-2222-2222-222222222217'),
  2, 'finished: ticks from the run are kept');

delete from public.checklist_completions where checklist_item_id = 'ca000000-0000-0000-0000-000000000172';
select is(
  (select count(*)::int from public.checklist_completions where user_id = '22222222-2222-2222-2222-222222222217'),
  1, 'finished: unticking your own crumb still works');

select * from finish();
rollback;
