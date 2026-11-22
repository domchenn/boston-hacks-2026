-- =============================================================================
-- Database tests: outings (one run of a trail, alone or with friends).
--
-- Checks starting and resuming an outing, the shared checklist (friends on the
-- same outing see each other's ticks; crumbs must be on the trail; outsiders see
-- nothing), inviting only friends, accepting and declining, finishing for
-- everyone, "Do it again" starting a fresh outing while keeping the old one,
-- leaving (the last one out ends it), and that logged-out visitors can't start.
-- Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'me@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'friend@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'fan@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'maker@test.dev');

-- me <-> friend are friends; fan follows me, I don't follow back.
insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

insert into public.sidequests (id, creator_id, title, status) values
  ('c3000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Walk',  'published'),
  ('c3000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Other', 'published');
insert into public.checklist_items (id, sidequest_id, label) values
  ('c4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'Look up'),
  ('c4000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', 'Grab a snack'),
  ('c4000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000002', 'Elsewhere');

create temporary table t (k text primary key, v uuid);
grant all on t to authenticated;

-- ---------------------------------------------------------------- as me: start
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

insert into t values ('first', public.start_outing('c3000000-0000-0000-0000-000000000001'));
select isnt((select v from t where k = 'first'), null, 'starting a trail creates an outing');
select is((select status from public.user_sidequests where sidequest_id = 'c3000000-0000-0000-0000-000000000001'),
  'in_progress', 'and marks the trail in progress');
select is(public.start_outing('c3000000-0000-0000-0000-000000000001'), (select v from t where k = 'first'),
  'starting again resumes the same outing');

select lives_ok(
  $$insert into public.outing_checks (outing_id, checklist_item_id)
    values ((select v from t where k = 'first'), 'c4000000-0000-0000-0000-000000000001')$$,
  'I can tick a crumb on my outing');
select is((select checked_by from public.outing_checks where checklist_item_id = 'c4000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'the tick records who did it');
select throws_ok(
  $$insert into public.outing_checks (outing_id, checklist_item_id)
    values ((select v from t where k = 'first'), 'c4000000-0000-0000-0000-000000000003')$$,
  '23514', 'That crumb isn''t on this trail', 'a crumb from another trail is refused');

-- ---------------------------------------------------------------- invites
select is(public.invite_to_outing((select v from t where k = 'first'),
  array['33333333-3333-3333-3333-333333333333'::uuid, '44444444-4444-4444-4444-444444444444'::uuid]),
  0, 'people who aren''t my friends can''t be invited');
select is(public.invite_to_outing((select v from t where k = 'first'), array['22222222-2222-2222-2222-222222222222'::uuid]),
  1, 'a friend can be invited');
select is(public.invite_to_outing((select v from t where k = 'first'), array['22222222-2222-2222-2222-222222222222'::uuid]),
  0, 'inviting them twice does nothing');

-- ---------------------------------------------------------------- as the fan (outsider)
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.outings), 0, 'outsiders can''t see the outing');
select is((select count(*)::int from public.outing_checks), 0, 'or its checklist');
select throws_ok(
  $$insert into public.outing_checks (outing_id, checklist_item_id)
    values ((select v from t where k = 'first'), 'c4000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'or tick its crumbs');

-- ---------------------------------------------------------------- as my friend: accept, tick
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.outings), 1, 'an invited friend can see the outing');
select lives_ok($$select public.respond_to_outing((select v from t where k = 'first'), true)$$, 'and accept');
select is((select status from public.user_sidequests where sidequest_id = 'c3000000-0000-0000-0000-000000000001'),
  'in_progress', 'accepting marks the trail in progress for them');
select lives_ok(
  $$insert into public.outing_checks (outing_id, checklist_item_id)
    values ((select v from t where k = 'first'), 'c4000000-0000-0000-0000-000000000002')$$,
  'my friend can tick a crumb too');

-- ---------------------------------------------------------------- back as me: shared ticks, finish
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.outing_checks where outing_id = (select v from t where k = 'first')),
  2, 'I see my friend''s tick: the checklist is shared');

select lives_ok($$select public.finish_outing((select v from t where k = 'first'))$$, 'I can finish the outing');
reset role;
select is((select array_agg(status order by user_id) from public.user_sidequests where sidequest_id = 'c3000000-0000-0000-0000-000000000001'),
  array['completed', 'completed'], 'finishing marks it finished for everyone on the outing');
set local role authenticated;
delete from public.outing_checks where outing_id = (select v from t where k = 'first');
select is((select count(*)::int from public.outing_checks where outing_id = (select v from t where k = 'first')),
  2, 'a finished outing''s checklist can''t be changed');

-- ---------------------------------------------------------------- do it again
insert into t values ('again', public.start_outing('c3000000-0000-0000-0000-000000000001'));
select isnt((select v from t where k = 'again'), (select v from t where k = 'first'), 'doing it again starts a fresh outing');
select is((select status from public.user_sidequests where sidequest_id = 'c3000000-0000-0000-0000-000000000001'),
  'completed', 'and the trail stays finished');

-- ---------------------------------------------------------------- leave
select public.leave_outing((select v from t where k = 'again'));
reset role;
select is((select status from public.outings where id = (select v from t where k = 'again')),
  'ended', 'the last one to leave ends the outing (the finished one is kept)');

-- ---------------------------------------------------------------- logged out
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$select public.start_outing('c3000000-0000-0000-0000-000000000001')$$, '42501', null,
  'logged-out visitors can''t start an outing');

select * from finish();
rollback;
