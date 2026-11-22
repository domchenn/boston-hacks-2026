-- =============================================================================
-- Database tests: "Who can see this" in save_trail() (community-only trails).
--
-- Checks that a trail can be limited to the creator's own community and nobody
-- else's, that leaving out community_id keeps the current setting (so older
-- callers are unaffected), that null makes it public again, that an edit may keep
-- a community the creator has since left, and that non-members can't see a
-- community-only trail while members can. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'maker@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'classmate@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test.dev');
insert into public.communities (id, name, slug) values
  ('c0000000-0000-0000-0000-00000000000a', 'Test U',  'test-u'),
  ('c0000000-0000-0000-0000-00000000000b', 'Other U', 'other-u');
update public.profiles set community_id = 'c0000000-0000-0000-0000-00000000000a'
  where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

create temporary table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- ---------------------------------------------------------------- as the maker (in Test U)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

insert into ids values ('mine', public.save_trail('{"title": "Campus crawl", "status": "draft",
  "community_id": "c0000000-0000-0000-0000-00000000000a", "stops": []}'::jsonb));
select is((select community_id from public.sidequests where id = (select id from ids where name = 'mine')),
  'c0000000-0000-0000-0000-00000000000a'::uuid, 'a trail can be limited to your own community');

select throws_ok(
  $$select public.save_trail('{"title": "Sneaky", "status": "draft",
      "community_id": "c0000000-0000-0000-0000-00000000000b", "stops": []}'::jsonb)$$,
  '42501', 'You can only share a trail with your own community', 'but not to a community you aren''t in');

insert into ids values ('public', public.save_trail('{"title": "For everyone", "status": "draft", "stops": []}'::jsonb));
select is((select community_id from public.sidequests where id = (select id from ids where name = 'public')),
  null, 'no community_id key -> a new trail is for everyone (unchanged behaviour)');

select lives_ok(
  format($$select public.save_trail('{"title": "Campus crawl v2", "status": "draft", "stops": []}'::jsonb, %L)$$,
         (select id from ids where name = 'mine')),
  'editing without the key works…');
select is((select community_id from public.sidequests where id = (select id from ids where name = 'mine')),
  'c0000000-0000-0000-0000-00000000000a'::uuid, '…and keeps the trail''s community');

-- Publish it (still community-only) so the visibility checks below are meaningful.
select lives_ok(
  format($$select public.save_trail('{"title": "Campus crawl", "status": "published", "category": "outdoors",
      "community_id": "c0000000-0000-0000-0000-00000000000a",
      "stops": [{"place_name": "A", "crumb": "x"}, {"place_name": "B", "crumb": "y"}]}'::jsonb, %L)$$,
         (select id from ids where name = 'mine')),
  'publishing a community-only trail works');

-- ---------------------------------------------------------------- who can see it
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.sidequests where id = (select id from ids where name = 'mine')),
  1, 'a classmate in the same community sees it');
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.sidequests where id = (select id from ids where name = 'mine')),
  0, 'an outsider doesn''t');

-- ---------------------------------------------------------------- the maker switches community
reset role;
update public.profiles set community_id = 'c0000000-0000-0000-0000-00000000000b'
  where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  format($$select public.save_trail('{"title": "Campus crawl", "status": "draft",
      "community_id": "c0000000-0000-0000-0000-00000000000a", "stops": []}'::jsonb, %L)$$,
         (select id from ids where name = 'mine')),
  'after switching, an edit may keep the trail''s old community');

select lives_ok(
  format($$select public.save_trail('{"title": "Campus crawl", "status": "draft", "community_id": null, "stops": []}'::jsonb, %L)$$,
         (select id from ids where name = 'mine')),
  'community_id null…');
select is((select community_id from public.sidequests where id = (select id from ids where name = 'mine')),
  null, '…makes it visible to everyone again');

reset role;
select * from finish();
rollback;
