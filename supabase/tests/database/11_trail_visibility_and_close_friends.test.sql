-- =============================================================================
-- Database tests: trail visibility, private accounts and close friends.
--
-- Cast: maker (creates the trails), friend (mutual follow), close (mutual follow
-- and on maker's close friends list), fan (follows maker, not followed back),
-- stranger, and anon. Checks who sees public / friends / close_friends trails
-- and their stops, what a private account changes, that the close friends list
-- is private and friends-only, that unfollowing removes access, save_trail()'s
-- visibility key, and friends_activity() for private accounts.
-- Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'maker@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'friend@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'close@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'fan@test.dev'),
  ('55555555-5555-5555-5555-555555555555', 'stranger@test.dev');

insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');
insert into public.close_friends (owner_id, friend_id) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333');

insert into public.sidequests (id, creator_id, title, status, visibility) values
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Public',  'published', 'public'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Friends', 'published', 'friends'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Close',   'published', 'close_friends');
insert into public.sidequest_stops (id, sidequest_id, place_name, stop_order) values
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'Friends stop', 0);
insert into public.user_sidequests (user_id, sidequest_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'b0000000-0000-0000-0000-000000000001', 'in_progress');
update public.user_sidequests set status = 'completed'
where user_id = '11111111-1111-1111-1111-111111111111' and sidequest_id = 'b0000000-0000-0000-0000-000000000001';

create temporary table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

create function pg_temp.visible_titles() returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.sidequests
  where id in ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
               'b0000000-0000-0000-0000-000000000003')
$$;
grant execute on function pg_temp.visible_titles() to anon, authenticated;

-- ---------------------------------------------------------------- who sees what
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), array['Close', 'Friends', 'Public'], 'the maker sees all their trails');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), array['Friends', 'Public'], 'a friend sees public and friends trails');
select is((select count(*)::int from public.sidequest_stops where id = 'c0000000-0000-0000-0000-000000000002'),
  1, 'a friend sees the stops of a friends trail');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), array['Close', 'Friends', 'Public'], 'a close friend sees close friends trails too');

select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), array['Public'], 'following without a follow back isn''t friends');
select is((select count(*)::int from public.sidequest_stops where id = 'c0000000-0000-0000-0000-000000000002'),
  0, 'a non-friend can''t see the stops of a friends trail');

select set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), array['Public'], 'a stranger sees only the public trail');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is(pg_temp.visible_titles(), array['Public'], 'logged-out visitors see only the public trail');

-- ---------------------------------------------------------------- private account
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok($$update public.profiles set is_private = true where id = '11111111-1111-1111-1111-111111111111'$$,
  'users can make their own account private');
select throws_ok($$update public.profiles set is_admin = true where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'is_admin is still off limits');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), array['Friends', 'Public'], 'friends still see a private account''s trails');

select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is(pg_temp.visible_titles(), '{}'::text[], 'non-friends see none of a private account''s trails');
select is((select count(*)::int from public.friends_activity() where user_id = '11111111-1111-1111-1111-111111111111'),
  0, 'friends_activity() hides a private account from a follower who isn''t a friend');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1, 'the private profile itself can still be found');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is(pg_temp.visible_titles(), '{}'::text[], 'logged-out visitors see none of a private account''s trails');

-- ---------------------------------------------------------------- close friends list
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.close_friends), 0, 'you can''t see someone else''s close friends list');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.close_friends), 1, 'you can see your own list');
select throws_ok(
  $$insert into public.close_friends (owner_id, friend_id) values
      ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444')$$,
  '42501', null, 'only friends can be added to close friends');
select lives_ok(
  $$insert into public.close_friends (owner_id, friend_id) values
      ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$,
  'a friend can be added');

-- Unfollowing ends the friendship, and with it close-friends access.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
delete from public.follows where follower_id = '33333333-3333-3333-3333-333333333333';
select is(pg_temp.visible_titles(), '{}'::text[], 'after unfollowing, a close friend loses access');

-- ---------------------------------------------------------------- save_trail() visibility
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into ids values ('mine', public.save_trail('{"title": "Just friends", "status": "draft",
  "visibility": "friends", "stops": []}'::jsonb));
select is((select visibility from public.sidequests where id = (select id from ids where name = 'mine')),
  'friends', 'save_trail() saves the visibility');
select lives_ok(
  format($$select public.save_trail('{"title": "Just friends v2", "status": "draft", "stops": []}'::jsonb, %L)$$,
         (select id from ids where name = 'mine')),
  'editing without a visibility key works…');
select is((select visibility from public.sidequests where id = (select id from ids where name = 'mine')),
  'friends', '…and keeps the visibility');
select throws_ok(
  $$select public.save_trail('{"title": "Bad", "status": "draft", "visibility": "everyone", "stops": []}'::jsonb)$$,
  '22023', 'Visibility must be public, friends or close_friends', 'an unknown visibility is rejected');

select * from finish();
rollback;
