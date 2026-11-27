-- =============================================================================
-- Database tests: the private `photos` bucket (migration add_private_photo_storage).
-- The bucket isn't public; a file can be read (and so signed) only by people who
-- can see its trail, plus its uploader; files can only be added by people with
-- the trail saved, started or finished, into that trail's folder; quest_photos
-- rows must point at a file in their own trail's folder. Deleting goes through the
-- Storage API, so it's covered by the API's integration tests. Rolled back.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111120', 'creator20@test.dev'),
  ('22222222-2222-2222-2222-222222222220', 'friend20@test.dev'),
  ('33333333-3333-3333-3333-333333333320', 'stranger20@test.dev');
insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111120', '22222222-2222-2222-2222-222222222220'),
  ('22222222-2222-2222-2222-222222222220', '11111111-1111-1111-1111-111111111120');
insert into public.sidequests (id, creator_id, title, status, visibility) values
  ('a0000000-0000-0000-0000-000000000201', '11111111-1111-1111-1111-111111111120', 'Open', 'published', 'public'),
  ('a0000000-0000-0000-0000-000000000202', '11111111-1111-1111-1111-111111111120', 'Friends', 'published', 'friends');
insert into public.user_sidequests (user_id, sidequest_id, status) values
  ('22222222-2222-2222-2222-222222222220', 'a0000000-0000-0000-0000-000000000202', 'completed');
insert into storage.objects (bucket_id, name, owner_id) values
  ('photos', 'a0000000-0000-0000-0000-000000000201/open.jpg', '11111111-1111-1111-1111-111111111120'),
  ('photos', 'a0000000-0000-0000-0000-000000000202/friends.jpg', '22222222-2222-2222-2222-222222222220');

select is((select public from storage.buckets where id = 'photos'), false, 'the photos bucket is private');

set local role anon;
select is((select array_agg(name) from storage.objects where bucket_id = 'photos'),
  array['a0000000-0000-0000-0000-000000000201/open.jpg'], 'visitors can read only photos of public trails');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333320", "role": "authenticated"}', true);
select is((select count(*)::int from storage.objects where name like 'a0000000-0000-0000-0000-000000000202/%'), 0,
  'a stranger can’t read photos of a friends-only trail');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'a0000000-0000-0000-0000-000000000201/x.jpg', '33333333-3333-3333-3333-333333333320')$$,
  '42501', null, 'you can’t add a photo to a trail you haven’t saved, started or finished');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222220", "role": "authenticated"}', true);
select is((select count(*)::int from storage.objects where name like 'a0000000-0000-0000-0000-000000000202/%'), 1,
  'a friend can read photos of a friends-only trail');
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'a0000000-0000-0000-0000-000000000202/y.jpg', '22222222-2222-2222-2222-222222222220')$$,
  'you can add a photo to a trail you finished');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'not-a-trail/z.jpg', '22222222-2222-2222-2222-222222222220')$$,
  '42501', null, 'a file must go in a trail’s folder');

reset role;
select throws_ok(
  $$insert into public.quest_photos (user_id, sidequest_id, storage_path) values ('22222222-2222-2222-2222-222222222220', 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000201/open.jpg')$$,
  '23514', null, 'a photo row must point at a file in its own trail’s folder');
select throws_ok(
  $$insert into public.quest_photos (user_id, sidequest_id) values ('22222222-2222-2222-2222-222222222220', 'a0000000-0000-0000-0000-000000000202')$$,
  '23514', null, 'a photo row needs a file');
select lives_ok(
  $$insert into public.quest_photos (user_id, sidequest_id, storage_path) values ('22222222-2222-2222-2222-222222222220', 'a0000000-0000-0000-0000-000000000202', 'a0000000-0000-0000-0000-000000000202/friends.jpg')$$,
  'a photo row with a file in its own trail’s folder is fine');

select * from finish();
rollback;
