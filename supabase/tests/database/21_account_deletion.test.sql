-- =============================================================================
-- Database tests: delete_my_account() (migration add_self_serve_account_deletion).
-- Visitors can't call it; a signed-in user deletes only their own account, and
-- with it their profile, trails (and everything on them), progress, ratings,
-- photo records and follows; other people are untouched; reports they filed are
-- kept with the reporter cleared. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111121', 'leaver21@test.dev'),
  ('22222222-2222-2222-2222-222222222221', 'stayer21@test.dev');
insert into public.sidequests (id, creator_id, title, status) values
  ('a0000000-0000-0000-0000-000000000211', '11111111-1111-1111-1111-111111111121', 'Leaver trail', 'published'),
  ('a0000000-0000-0000-0000-000000000212', '22222222-2222-2222-2222-222222222221', 'Stayer trail', 'published');
insert into public.user_sidequests (user_id, sidequest_id, status) values
  ('11111111-1111-1111-1111-111111111121', 'a0000000-0000-0000-0000-000000000212', 'completed'),
  ('22222222-2222-2222-2222-222222222221', 'a0000000-0000-0000-0000-000000000211', 'saved');
insert into public.sidequest_ratings (user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating) values
  ('11111111-1111-1111-1111-111111111121', 'a0000000-0000-0000-0000-000000000212', 3, 3, 3, 3);
insert into public.quest_photos (user_id, sidequest_id, photo_url) values
  ('11111111-1111-1111-1111-111111111121', 'a0000000-0000-0000-0000-000000000212', 'https://example.test/p.jpg');
insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111121', '22222222-2222-2222-2222-222222222221'),
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111121');
insert into public.reports (reporter_id, target_type, target_id, reason) values
  ('11111111-1111-1111-1111-111111111121', 'trail', 'a0000000-0000-0000-0000-000000000212', 'spam');

set local role anon;
select throws_ok($$select public.delete_my_account()$$, '42501', null, 'visitors can’t call it');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111121", "role": "authenticated"}', true);
select lives_ok($$select public.delete_my_account()$$, 'a signed-in user deletes their own account');

reset role;
select is((select count(*)::int from auth.users where id = '11111111-1111-1111-1111-111111111121'), 0, 'the sign-in account is gone');
select is((select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111121'), 0, 'the profile is gone');
select is((select count(*)::int from public.sidequests where creator_id = '11111111-1111-1111-1111-111111111121' or id = 'a0000000-0000-0000-0000-000000000211'), 0, 'their trails are gone');
select is((select count(*)::int from public.user_sidequests where sidequest_id = 'a0000000-0000-0000-0000-000000000211' or user_id = '11111111-1111-1111-1111-111111111121'), 0, 'their progress, and everyone’s progress on their trails, is gone');
select is((select count(*)::int from public.sidequest_ratings where user_id = '11111111-1111-1111-1111-111111111121'), 0, 'their ratings are gone');
select is((select count(*)::int from public.quest_photos where user_id = '11111111-1111-1111-1111-111111111121'), 0, 'their photo records are gone');
select is((select count(*)::int from public.follows where '11111111-1111-1111-1111-111111111121' in (follower_id, following_id)), 0, 'their follows are gone');
select is((select count(*)::int from public.sidequests where id = 'a0000000-0000-0000-0000-000000000212'), 1, 'other people’s trails are untouched');
select is((select reporter_id from public.reports where target_id = 'a0000000-0000-0000-0000-000000000212'), null::uuid, 'a report they filed is kept, without the reporter');

select * from finish();
rollback;
