-- =============================================================================
-- Database tests: friends_also_saved() ("You both saved this").
--
-- Checks that you see a friend only on trails you both saved, never a friend's
-- other saves, never followers who aren't friends, nothing once you unsave, no
-- trails hidden from you, and that logged-out visitors can't call it.
-- Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'me@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'friend@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'fan@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'maker@test.dev');

-- me <-> friend are friends; fan follows me but I don't follow back.
insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

insert into public.sidequests (id, creator_id, title, status, visibility) values
  ('b2000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Both saved',   'published', 'public'),
  ('b2000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'Only friend',  'published', 'public'),
  ('b2000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'Hidden',       'published', 'friends');

insert into public.user_sidequests (user_id, sidequest_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'b2000000-0000-0000-0000-000000000001', 'saved'),
  ('22222222-2222-2222-2222-222222222222', 'b2000000-0000-0000-0000-000000000001', 'saved'),
  ('33333333-3333-3333-3333-333333333333', 'b2000000-0000-0000-0000-000000000001', 'saved'),
  ('22222222-2222-2222-2222-222222222222', 'b2000000-0000-0000-0000-000000000002', 'saved'),
  -- A friends-only trail by someone I'm not friends with: hidden from me.
  ('11111111-1111-1111-1111-111111111111', 'b2000000-0000-0000-0000-000000000003', 'saved'),
  ('22222222-2222-2222-2222-222222222222', 'b2000000-0000-0000-0000-000000000003', 'saved');

-- ---------------------------------------------------------------- as me
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$select sidequest_id, friend_id from public.friends_also_saved()$$,
  $$values ('b2000000-0000-0000-0000-000000000001'::uuid, '22222222-2222-2222-2222-222222222222'::uuid)$$,
  'only the trail we both saved, only with my friend (not the fan, not hidden trails)');

select is((select count(*)::int from public.friends_also_saved() where sidequest_id = 'b2000000-0000-0000-0000-000000000002'),
  0, 'a friend''s other saves stay private');

-- ---------------------------------------------------------------- as the fan (follows me, not friends)
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.friends_also_saved()), 0, 'followers who aren''t friends see nothing');

-- ---------------------------------------------------------------- my friend sees me back
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select friend_id from public.friends_also_saved() where sidequest_id = 'b2000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'it works both ways');

-- ---------------------------------------------------------------- after I unsave
reset role;
update public.user_sidequests set status = 'in_progress'
where user_id = '11111111-1111-1111-1111-111111111111' and sidequest_id = 'b2000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.friends_also_saved()), 0, 'once one of us moves on, it''s no longer a shared save');

-- ---------------------------------------------------------------- logged out
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok($$select * from public.friends_also_saved()$$, '42501', null, 'logged-out visitors can''t call it');

select * from finish();
rollback;
