-- =============================================================================
-- Database tests: photos attached to a stop (quest_photos.stop_id).
--
-- Checks that a photo can be pinned to a stop of its own trail, not to another
-- trail's stop, that a general (stop-less) photo still works, and that removing
-- the stop keeps the photo but clears its stop. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'walker@test.dev');
insert into public.sidequests (id, creator_id, title, status) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Mine',  'published'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Other', 'published');
insert into public.sidequest_stops (id, sidequest_id, place_name, stop_order) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Here',  0),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 'There', 0);
insert into public.user_sidequests (user_id, sidequest_id, status) values
  ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001', 'in_progress');

-- ---------------------------------------------------------------- as the walker
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$insert into public.quest_photos (id, user_id, sidequest_id, stop_id, photo_url) values
      ('f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
       'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'https://x/1.jpg')$$,
  'a photo can be attached to a stop on its trail');
select throws_ok(
  $$insert into public.quest_photos (user_id, sidequest_id, stop_id, photo_url) values
      ('11111111-1111-1111-1111-111111111111',
       'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'https://x/2.jpg')$$,
  '23514', 'That stop isn''t on this trail', 'a photo can''t be attached to another trail''s stop');
select lives_ok(
  $$insert into public.quest_photos (user_id, sidequest_id, photo_url) values
      ('11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001', 'https://x/3.jpg')$$,
  'a photo without a stop still works');

-- ---------------------------------------------------------------- the stop is removed (trail edited)
reset role;
delete from public.sidequest_stops where id = 'e0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from public.quest_photos where id = 'f0000000-0000-0000-0000-000000000001'),
  1, 'removing a stop keeps its photos…');
select is((select stop_id from public.quest_photos where id = 'f0000000-0000-0000-0000-000000000001'),
  null, '…and clears their stop');

select * from finish();
rollback;
