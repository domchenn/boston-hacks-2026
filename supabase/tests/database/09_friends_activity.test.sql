-- =============================================================================
-- Database tests: what the people you follow have been up to (friends_activity).
--
-- Checks that only the caller's follows show up, only as 'made' (published),
-- 'finished' or 'joined' (saved / in progress stay private), newest first; that
-- drafts and other communities' trails stay hidden; that only public profile
-- fields come back; that p_limit works; and that logged-out visitors can't call
-- it. Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'cara@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'ann@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'ben@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'cy@test.dev'),
  ('55555555-5555-5555-5555-555555555555', 'dee@test.dev');
update public.profiles set username = 'ben', bio = 'not for the feed' where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set username = 'cy'  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set username = 'dee' where id = '55555555-5555-5555-5555-555555555555';

insert into public.communities (id, name, slug) values
  ('c0000000-0000-0000-0000-000000000001', 'Test Community', 'test-community');
update public.profiles set community_id = 'c0000000-0000-0000-0000-000000000001'
  where id in ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');

-- Ben made a public trail and has a draft. Cara made a public scheduled trail and a community-only one.
insert into public.sidequests (id, creator_id, title, status, scheduled_at, community_id, created_at) values
  ('a0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Ben public',  'published', null,                     null, now() - interval '3 hours'),
  ('a0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'Ben draft',   'draft',     null,                     null, now() - interval '10 minutes'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Cara public', 'published', now() + interval '3 days', null, now() - interval '5 days'),
  ('a0000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Community',   'published', now() + interval '3 days', 'c0000000-0000-0000-0000-000000000001', now() - interval '5 days');

-- Ann follows Ben and Cy. Dee (a community member) follows Cy.
insert into public.follows (follower_id, following_id) values
  ('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'),
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444'),
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444');

-- Ben finished Cara's trail. Cy joined Cara's public and community trails and saved Ben's.
-- Dee (followed by no one) finished Cara's trail. The trigger is off so the times stick.
alter table public.user_sidequests disable trigger user_sidequests_before_write;
insert into public.user_sidequests (user_id, sidequest_id, status, updated_at, completed_at) values
  ('33333333-3333-3333-3333-333333333333', 'a0000000-0000-0000-0000-000000000003', 'completed', now() - interval '1 hour',     now() - interval '1 hour'),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000003', 'signed_up', now() - interval '30 minutes', null),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000004', 'signed_up', now() - interval '20 minutes', null),
  ('44444444-4444-4444-4444-444444444444', 'a0000000-0000-0000-0000-000000000001', 'saved',     now() - interval '5 minutes',  null),
  ('55555555-5555-5555-5555-555555555555', 'a0000000-0000-0000-0000-000000000003', 'completed', now() - interval '2 minutes',  now() - interval '2 minutes');
alter table public.user_sidequests enable trigger user_sidequests_before_write;

-- ---------------------------------------------------------------- the function itself
select is((select prosecdef from pg_proc where proname = 'friends_activity'), true,
  'friends_activity is SECURITY DEFINER');
select ok((select proconfig::text from pg_proc where proname = 'friends_activity') like '%search_path=%',
  'friends_activity pins its search_path');
select is(
  (select array_agg(c.parameter_name::text order by c.ordinal_position)
     from information_schema.routines r
     join information_schema.parameters c on c.specific_name = r.specific_name and c.parameter_mode = 'OUT'
    where r.routine_schema = 'public' and r.routine_name = 'friends_activity'),
  array['user_id', 'username', 'display_name', 'avatar_url', 'kind', 'sidequest_id', 'happened_at'],
  'friends_activity returns only public profile fields and the activity');

-- ---------------------------------------------------------------- as Ann (follows Ben and Cy, no community)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq(
  $$select username, kind, sidequest_id from public.friends_activity()$$,
  $$values ('cy',  'joined',   'a0000000-0000-0000-0000-000000000003'::uuid),
           ('ben', 'finished', 'a0000000-0000-0000-0000-000000000003'::uuid),
           ('ben', 'made',     'a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'Ann sees her follows'' made / finished / joined trails, newest first; not saved, drafts, community trails or people she doesn''t follow');
select results_eq(
  $$select username, kind from public.friends_activity(1)$$,
  $$values ('cy', 'joined')$$,
  'p_limit keeps the newest rows');
select is((select count(*)::int from public.user_sidequests where user_id <> '22222222-2222-2222-2222-222222222222'),
  0, 'progress rows stay private: Ann still can''t read other people''s rows directly');

-- ---------------------------------------------------------------- as Dee (community member, follows Cy)
select set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);
select results_eq(
  $$select username, kind, sidequest_id from public.friends_activity()$$,
  $$values ('cy', 'joined', 'a0000000-0000-0000-0000-000000000004'::uuid),
           ('cy', 'joined', 'a0000000-0000-0000-0000-000000000003'::uuid)$$,
  'community members also see activity on their community''s trails');

-- ---------------------------------------------------------------- as Cara (follows no one)
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is((select count(*)::int from public.friends_activity()), 0,
  'someone who follows no one gets nothing');

-- ---------------------------------------------------------------- as a logged-out visitor
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select * from public.friends_activity()', '42501', null,
  'logged-out visitors can''t call friends_activity');

reset role;
select * from finish();
rollback;
