-- =============================================================================
-- Database tests: trail photo storage and photo records (task D5).
--
-- Checks that the trail-photos bucket exists and is public, that a user can
-- upload only into their own folder and delete only their own files, that
-- visitors can't upload, and that a quest photo needs a started/saved/finished
-- trail. Rolled back, so it leaves no data or files.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'photographer@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'other@test.dev');

insert into public.sidequests (id, creator_id, title, status) values
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Photo trail', 'published');

-- ---------------------------------------------------------------- bucket
select is((select public from storage.buckets where id = 'trail-photos'), true, 'the trail-photos bucket exists and is public');
select is((select file_size_limit from storage.buckets where id = 'trail-photos'), 5242880::bigint, 'photos are limited to 5 MB');

-- ---------------------------------------------------------------- uploads
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('trail-photos', '11111111-1111-1111-1111-111111111111/trails/x/1.jpg')$$,
  'users can upload into their own folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('trail-photos', '22222222-2222-2222-2222-222222222222/trails/x/1.jpg')$$,
  '42501', null, 'users cannot upload into someone else''s folder');

-- Supabase blocks deleting storage rows with SQL (deletes go through the Storage
-- API), so check the delete rule itself: only files in your own folder.
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
      and policyname = 'Users delete their own trail photos; admins delete any'
      and qual like '%foldername%' and qual like '%auth.uid()%' and qual like '%is_admin()%'),
  'users can only delete photos in their own folder, plus admins (policy check; renamed by let_admins_remove_photo_files)');

-- ---------------------------------------------------------------- photo records
select throws_ok(
  $$insert into public.quest_photos (user_id, sidequest_id, photo_url) values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'https://x/1.jpg')$$,
  '42501', null, 'cannot add a photo to a trail you haven''t started, saved or finished');
insert into public.user_sidequests (user_id, sidequest_id, status)
  values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'in_progress');
select lives_ok(
  $$insert into public.quest_photos (user_id, sidequest_id, photo_url) values ('11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000001', 'https://x/1.jpg')$$,
  'can add a photo once the trail is started');

-- ---------------------------------------------------------------- visitors
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('trail-photos', 'anon/1.jpg')$$,
  '42501', null, 'visitors cannot upload photos');

select * from finish();
rollback;
