-- =============================================================================
-- Database tests: who's going on a scheduled trail (trail_attendees,
-- trail_going_counts).
--
-- Checks that only people with status 'signed_up' are counted and listed, that
-- only public profile fields come back, that the limit doesn't change the total,
-- and that attendees of trails you can't see (drafts, other communities) stay
-- hidden, including from logged-out visitors. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'creator@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'ann@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'ben@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'cy@test.dev'),
  ('55555555-5555-5555-5555-555555555555', 'dee@test.dev');
update public.profiles set username = 'ann', display_name = 'Ann', bio = 'secret-ish bio'
  where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set username = 'ben' where id = '33333333-3333-3333-3333-333333333333';

insert into public.communities (id, name, slug) values
  ('c0000000-0000-0000-0000-000000000001', 'Test Community', 'test-community');
update public.profiles set community_id = 'c0000000-0000-0000-0000-000000000001'
  where id in ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444');

insert into public.sidequests (id, creator_id, title, status, scheduled_at, community_id) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Public',    'published', now() + interval '3 days', null),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Draft',     'draft',     now() + interval '3 days', null),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Community', 'published', now() + interval '3 days', 'c0000000-0000-0000-0000-000000000001');

-- Public trail: Ben then Ann signed up, Cy saved it, Dee finished it (only sign-ups count).
-- Community trail: Cy is going (Cy is a community member). Draft: Ann is going.
-- The trigger is off for setup so the sign-up times below stick (it would set
-- updated_at to now()), and so a draft can be "joined" to prove it stays hidden.
alter table public.user_sidequests disable trigger user_sidequests_before_write;
insert into public.user_sidequests (user_id, sidequest_id, status, updated_at, completed_at) values
  ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000001', 'signed_up', now() - interval '2 hours', null),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000001', 'signed_up', now() - interval '1 hour', null),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000001', 'saved',     now(), null),
  ('55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-000000000001', 'completed', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000003', 'signed_up', now(), null),
  ('22222222-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000002', 'signed_up', now(), null);
alter table public.user_sidequests enable trigger user_sidequests_before_write;

-- ---------------------------------------------------------------- as Ben (no community)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);

select is((select count(*)::int from public.user_sidequests where user_id <> '33333333-3333-3333-3333-333333333333'),
  0, 'progress rows stay private: Ben can''t read other people''s rows directly');
select is((select array_agg(username order by going_count, username) from public.trail_attendees('a0000000-0000-0000-0000-000000000001')),
  array['ann', 'ben'], 'only signed_up people are listed (not saved or finished)');
select is((select distinct going_count from public.trail_attendees('a0000000-0000-0000-0000-000000000001')),
  2, 'each row carries the total going_count');
select is((select username from public.trail_attendees('a0000000-0000-0000-0000-000000000001') limit 1),
  'ben', 'earliest sign-up first (Ben joined before Ann)');
select is((select count(*)::int from public.trail_attendees('a0000000-0000-0000-0000-000000000001', 1)),
  1, 'p_limit caps the rows…');
select is((select going_count from public.trail_attendees('a0000000-0000-0000-0000-000000000001', 1)),
  2, '…but not the total');
select is(
  (select array_agg(c.parameter_name::text order by c.ordinal_position)
     from information_schema.routines r
     join information_schema.parameters c on c.specific_name = r.specific_name and c.parameter_mode = 'OUT'
    where r.routine_schema = 'public' and r.routine_name = 'trail_attendees'),
  array['user_id', 'username', 'display_name', 'avatar_url', 'going_count'],
  'trail_attendees returns only public profile fields and the count');
select is((select count(*)::int from public.trail_attendees('a0000000-0000-0000-0000-000000000002')),
  0, 'a draft''s attendees are hidden from others');
select is((select count(*)::int from public.trail_attendees('a0000000-0000-0000-0000-000000000003')),
  0, 'a community-only trail''s attendees are hidden from non-members');
select results_eq(
  $$select sidequest_id, going_count from public.trail_going_counts(array[
      'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
      'a0000000-0000-0000-0000-000000000003']::uuid[]) order by sidequest_id$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid, 2)$$,
  'trail_going_counts: only visible trails, only sign-ups');

-- ---------------------------------------------------------------- as Cy (community member)
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is((select going_count from public.trail_going_counts(array['a0000000-0000-0000-0000-000000000003']::uuid[])),
  1, 'community members see their community trail''s count');

-- ---------------------------------------------------------------- as the creator
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select going_count from public.trail_attendees('a0000000-0000-0000-0000-000000000002') limit 1),
  1, 'the creator can see who''s going on their own draft');

-- ---------------------------------------------------------------- as a logged-out visitor
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is((select going_count from public.trail_attendees('a0000000-0000-0000-0000-000000000001') limit 1),
  2, 'visitors see who''s going on a public trail');
select is((select count(*)::int from public.trail_going_counts(array[
    'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003']::uuid[])),
  0, 'visitors see nothing for drafts or community trails');

reset role;
select * from finish();
rollback;
