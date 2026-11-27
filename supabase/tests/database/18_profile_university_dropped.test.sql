-- =============================================================================
-- Database tests: profiles.university is gone (migration drop_profile_university)
-- and profile editing still works without it. Signed-in users can still update
-- their own username, display name and bio, and only those editable columns.
-- Rolled back, so it leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select hasnt_column('public', 'profiles', 'university', 'profiles.university is dropped');
select has_column('public', 'communities', 'university', 'communities.university (a different column) stays');

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111118', 'uni18@test.dev');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111118", "role": "authenticated"}', true);

select lives_ok(
  $$update public.profiles set username = 'uni_eighteen', display_name = 'Eighteen', bio = 'Hi' where id = '11111111-1111-1111-1111-111111111118'$$,
  'you can still edit your username, display name and bio');
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111118'),
  'Eighteen', 'the edit was saved');
select throws_ok(
  $$update public.profiles set is_admin = true where id = '11111111-1111-1111-1111-111111111118'$$,
  '42501', null, 'columns outside the editable list are still refused');

select * from finish();
rollback;
