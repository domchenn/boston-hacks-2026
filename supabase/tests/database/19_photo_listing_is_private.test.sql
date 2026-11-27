-- =============================================================================
-- Database tests: nobody can list the trail-photos bucket (migration
-- stop_public_photo_listing). Visitors see no storage rows at all; a signed-in user
-- sees only their own files (Storage needs that to delete them), and an admin sees
-- all of them (let_admins_remove_photo_files). Deleting goes
-- through the Storage API, so it's covered by the API's photos integration tests.
-- Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111119', 'owner19@test.dev'),
  ('22222222-2222-2222-2222-222222222219', 'other19@test.dev');
insert into storage.objects (bucket_id, name, owner_id) values
  ('trail-photos', '11111111-1111-1111-1111-111111111119/trails/x/a.jpg', '11111111-1111-1111-1111-111111111119'),
  ('trail-photos', '22222222-2222-2222-2222-222222222219/trails/x/b.jpg', '22222222-2222-2222-2222-222222222219');

set local role anon;
select is((select count(*)::int from storage.objects where bucket_id = 'trail-photos'), 0, 'visitors can’t list any photo files');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111119", "role": "authenticated"}', true);
select is(
  (select array_agg(name) from storage.objects where bucket_id = 'trail-photos'),
  array['11111111-1111-1111-1111-111111111119/trails/x/a.jpg'],
  'a signed-in user sees only their own files');

reset role;
update public.profiles set is_admin = true where id = '22222222-2222-2222-2222-222222222219';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222219", "role": "authenticated"}', true);
select is((select count(*)::int from storage.objects where name like '%/trails/x/%'), 2, 'an admin can see every photo file (to remove a reported one)');

reset role;
select is((select public from storage.buckets where id = 'trail-photos'), true, 'the bucket stays public, so photo links keep working');
select policies_are('storage', 'objects', array[
  'Users read their own trail photo files; admins read all',
  'Users upload trail photos into their own folder',
  'Users replace their own trail photos',
  'Users delete their own trail photos; admins delete any'
], 'no other storage.objects policies (the public read is gone; admins added by let_admins_remove_photo_files)');

select * from finish();
rollback;
