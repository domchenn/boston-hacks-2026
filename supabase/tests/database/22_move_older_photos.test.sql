-- =============================================================================
-- Database tests: admin_move_photo() and the moderators' insert policy (migration
-- let_moderators_move_older_photos). Only moderators can add files to someone
-- else's trail folder in the private bucket or move a photo; a move needs an older
-- photo and an existing file in that photo's own trail folder; afterwards the row
-- points at the file and the original uploader owns it. Uploaders always see their
-- own photo rows. Rolled back.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111122', 'uploader22@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'mod22@test.dev');
update public.profiles set is_admin = true where id = '22222222-2222-2222-2222-222222222222';
insert into public.sidequests (id, creator_id, title, status) values
  ('a0000000-0000-0000-0000-000000000221', '11111111-1111-1111-1111-111111111122', 'Old', 'published'),
  ('a0000000-0000-0000-0000-000000000222', '11111111-1111-1111-1111-111111111122', 'Other', 'published');
insert into public.quest_photos (id, user_id, sidequest_id, photo_url) values
  ('b0000000-0000-0000-0000-000000000221', '11111111-1111-1111-1111-111111111122', 'a0000000-0000-0000-0000-000000000221', 'https://x/old.jpg');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111122", "role": "authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'a0000000-0000-0000-0000-000000000221/a.jpg', '11111111-1111-1111-1111-111111111122')$$,
  '42501', null, 'a non-moderator without progress can’t add a file');
select throws_ok($$select public.admin_move_photo('b0000000-0000-0000-0000-000000000221', 'a0000000-0000-0000-0000-000000000221/a.jpg')$$,
  '42501', null, 'a non-moderator can’t move a photo');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'a0000000-0000-0000-0000-000000000221/a.jpg', '22222222-2222-2222-2222-222222222222')$$,
  'a moderator can add a file to a trail’s folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id) values ('photos', 'loose/b.jpg', '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'even a moderator only adds files inside a trail’s folder');
select throws_ok($$select public.admin_move_photo('b0000000-0000-0000-0000-000000000221', 'a0000000-0000-0000-0000-000000000222/a.jpg')$$,
  '23514', null, 'the file must be in the photo’s own trail folder');
select throws_ok($$select public.admin_move_photo('b0000000-0000-0000-0000-000000000221', 'a0000000-0000-0000-0000-000000000221/missing.jpg')$$,
  '23514', null, 'the file must already exist');
select lives_ok($$select public.admin_move_photo('b0000000-0000-0000-0000-000000000221', 'a0000000-0000-0000-0000-000000000221/a.jpg')$$,
  'a moderator moves an older photo');

reset role;
select is(
  (select row(storage_path, photo_url)::text from public.quest_photos where id = 'b0000000-0000-0000-0000-000000000221'),
  row('a0000000-0000-0000-0000-000000000221/a.jpg', null::text)::text, 'the row now points at the private file');
select is((select owner_id from storage.objects where bucket_id = 'photos' and name = 'a0000000-0000-0000-0000-000000000221/a.jpg'),
  '11111111-1111-1111-1111-111111111122', 'the original uploader owns the file');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111122", "role": "authenticated"}', true);
update public.sidequests set status = 'draft' where id = 'a0000000-0000-0000-0000-000000000221';
reset role;
update public.sidequests set creator_id = '22222222-2222-2222-2222-222222222222', status = 'draft' where id = 'a0000000-0000-0000-0000-000000000221';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111122", "role": "authenticated"}', true);
select is((select count(*)::int from public.quest_photos where id = 'b0000000-0000-0000-0000-000000000221'), 1,
  'you can see your own photo even on a trail you can no longer see');
reset role;

select * from finish();
rollback;
