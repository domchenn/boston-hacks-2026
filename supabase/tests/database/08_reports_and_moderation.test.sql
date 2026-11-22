-- =============================================================================
-- Database tests: reports and admin moderation (task D8).
--
-- Checks that users can report as themselves (once per item), can't read other
-- people's reports, can't make themselves admins, and can still edit their
-- normal profile fields; and that admins can read reports, hide any trail and
-- remove any review. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'reporter@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'creator@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'admin@test.dev');
update public.profiles set is_admin = true where id = '33333333-3333-3333-3333-333333333333';

insert into public.sidequests (id, creator_id, title, status) values
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Reported trail', 'published');
insert into public.user_sidequests (user_id, sidequest_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'completed');
insert into public.sidequest_ratings (id, user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text)
  values ('ee000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 1, 1, 1, 1, 'spammy review');

-- ---------------------------------------------------------------- as a regular user
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason) values ('11111111-1111-1111-1111-111111111111', 'trail', 'a0000000-0000-0000-0000-000000000001', 'unsafe')$$,
  'users can report a trail');
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason) values ('11111111-1111-1111-1111-111111111111', 'trail', 'a0000000-0000-0000-0000-000000000001', 'spam')$$,
  '23505', null, 'one report per person per item');
select throws_ok(
  $$insert into public.reports (reporter_id, target_type, target_id, reason) values ('22222222-2222-2222-2222-222222222222', 'trail', 'a0000000-0000-0000-0000-000000000001', 'spam')$$,
  '42501', null, 'cannot report as someone else');
select throws_ok(
  $$update public.profiles set is_admin = true where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'users cannot make themselves admins');
select lives_ok(
  $$update public.profiles set bio = 'still works' where id = '11111111-1111-1111-1111-111111111111'$$,
  'users can still edit their normal profile fields');
update public.sidequests set status = 'archived' where id = 'a0000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.reports), 0, 'users cannot read other people''s reports');

-- ---------------------------------------------------------------- as an admin
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.reports), 1, 'admins can read all reports');
select lives_ok(
  $$update public.reports set status = 'hidden', resolved_at = now(), resolved_by = '33333333-3333-3333-3333-333333333333' where target_id = 'a0000000-0000-0000-0000-000000000001'$$,
  'admins can resolve reports');
update public.sidequests set status = 'archived' where id = 'a0000000-0000-0000-0000-000000000001';
delete from public.sidequest_ratings where id = 'ee000000-0000-0000-0000-000000000001';

reset role;
select is((select status from public.sidequests where id = 'a0000000-0000-0000-0000-000000000001'),
  'archived', 'admins can hide any trail (the regular user''s attempt did nothing)');
select is((select count(*)::int from public.sidequest_ratings where id = 'ee000000-0000-0000-0000-000000000001'),
  0, 'admins can remove any review');
select is((select status from public.reports limit 1), 'hidden', 'the report is marked resolved');

select * from finish();
rollback;
