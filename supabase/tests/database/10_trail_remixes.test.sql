-- =============================================================================
-- Database tests: remixing a trail (sidequests.remixed_from + save_trail()).
--
-- Checks that a remix is saved as the remixer's own trail with the credit set,
-- that you can only remix a trail you can see, that the credit can't be added,
-- changed or forged later (through save_trail() or a direct update), that it can
-- be cleared, and that deleting the original clears it. Rolled back, so it
-- leaves no data.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------------------------------------------------------------- setup (as admin)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'maker@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'remixer@test.dev');
insert into public.sidequests (id, creator_id, title, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Original',    'published'),
  ('a0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Draft idea',  'draft'),
  ('a0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Another one', 'published');

create temporary table ids (name text primary key, id uuid) on commit drop;
grant all on ids to authenticated;

-- ---------------------------------------------------------------- as the remixer
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

insert into ids values ('remix', public.save_trail('{"title": "My take", "status": "draft",
  "remixed_from": "a0000000-0000-0000-0000-000000000001", "stops": []}'::jsonb));
select results_eq(
  $$select creator_id, remixed_from from public.sidequests where id = (select id from ids where name = 'remix')$$,
  $$values ('22222222-2222-2222-2222-222222222222'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'a remix is your own trail, credited to the original');

select throws_ok(
  $$select public.save_trail('{"title": "Peek", "status": "draft",
      "remixed_from": "a0000000-0000-0000-0000-000000000002", "stops": []}'::jsonb)$$,
  '42501', 'You can only remix a trail you can see', 'you can''t remix someone else''s draft');

insert into ids values ('plain', public.save_trail('{"title": "Original idea", "status": "draft", "stops": []}'::jsonb));
select is((select remixed_from from public.sidequests where id = (select id from ids where name = 'plain')),
  null, 'without remixed_from a trail is an original');

-- Edits through save_trail() never touch the credit.
select lives_ok(
  format($$select public.save_trail('{"title": "My take v2", "status": "draft",
      "remixed_from": "a0000000-0000-0000-0000-000000000003", "stops": []}'::jsonb, %L)$$,
         (select id from ids where name = 'remix')),
  'editing a remix works…');
select is((select remixed_from from public.sidequests where id = (select id from ids where name = 'remix')),
  'a0000000-0000-0000-0000-000000000001'::uuid, '…and the credit stays on the original');
select lives_ok(
  format($$select public.save_trail('{"title": "Original idea", "status": "draft",
      "remixed_from": "a0000000-0000-0000-0000-000000000001", "stops": []}'::jsonb, %L)$$,
         (select id from ids where name = 'plain')),
  'save_trail() ignores remixed_from on an edit…');
select is((select remixed_from from public.sidequests where id = (select id from ids where name = 'plain')),
  null, '…so a credit can''t be added later');

-- Direct writes (RLS lets creators update their own rows) are guarded by the trigger.
select throws_ok(
  format($$update public.sidequests set remixed_from = 'a0000000-0000-0000-0000-000000000003' where id = %L$$,
         (select id from ids where name = 'remix')),
  '42501', 'A trail''s remix credit can''t be changed', 'a direct update can''t change the credit');
select throws_ok(
  $$insert into public.sidequests (creator_id, title, remixed_from) values
      ('22222222-2222-2222-2222-222222222222', 'Sneaky', 'a0000000-0000-0000-0000-000000000002')$$,
  '42501', 'You can only remix a trail you can see', 'a direct insert can''t credit a hidden draft');
select lives_ok(
  format($$update public.sidequests set remixed_from = null where id = %L$$, (select id from ids where name = 'remix')),
  'the remixer may drop the credit');

-- ---------------------------------------------------------------- the original is deleted
reset role;
insert into public.sidequests (id, creator_id, title, remixed_from) values
  ('a0000000-0000-0000-0000-000000000009', '22222222-2222-2222-2222-222222222222', 'Remix of the original',
   'a0000000-0000-0000-0000-000000000001');
delete from public.sidequests where id = 'a0000000-0000-0000-0000-000000000001';
select is((select remixed_from from public.sidequests where id = 'a0000000-0000-0000-0000-000000000009'),
  null, 'deleting the original clears the credit (the remix stays)');

select * from finish();
rollback;
