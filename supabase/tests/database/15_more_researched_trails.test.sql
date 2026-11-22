-- =============================================================================
-- Database tests: the seven trails and 14 places added by seed_more_researched_trails.
--
-- Checks that the trails exist, are published, curated and owned by the breadcrumb
-- team account, that logged-out visitors can see them, and that their data is
-- consistent: every stop is linked to a place and has at least one crumb, trail
-- costs add up from the stops, travel modes are only missing on the first stop, and
-- pins sit in Greater Boston. Doesn't assume an exact total of trails, so new trails
-- don't break it.
--
-- Run locally with Docker: npm run test:db. Runs in CI on every PR.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create temp table new_trails (title text primary key) on commit drop;
insert into new_trails values
  ('Freedom Trail on a Student Budget'),
  ('Red Line Brain Crawl: MIT to Harvard'),
  ('East Boston: Skyline, Slices and Planes'),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream'),
  ('Broke in Boston: Under $10'),
  ('Finals Week Midnight Run'),
  ('Matcha, the Fens and Free Thursday at the Gardner');
grant select on new_trails to anon;

select is(
  (select count(*)::int from public.sidequests s
   join new_trails n on n.title = s.title
   where s.status = 'published' and s.is_curated
     and s.creator_id = 'b2ead000-0000-4000-8000-000000000001'),
  7, 'all seven trails are published, curated and owned by the breadcrumb team account');

select is(
  (select count(*)::int from public.experiences
   where name in ('Boston Common', 'Granary Burying Ground', 'Old State House', 'Wishing Cup',
                  'Faneuil Hall Marketplace', 'Old North Church & Paul Revere Mall', 'Piers Park',
                  'Santarpio''s Pizza', 'Constitution Beach', 'Arnold Arboretum', 'Jamaica Pond',
                  'JP Licks', 'Matcha Cafe Maiko', 'Fenway Victory Gardens')),
  14, 'the 14 new places are in the library exactly once each');

select is(
  (select count(*)::int from public.sidequest_stops st
   join public.sidequests s on s.id = st.sidequest_id
   join new_trails n on n.title = s.title),
  28, 'the seven trails have 28 stops in total');

select ok(
  not exists (
    select 1 from public.sidequest_stops st
    join public.sidequests s on s.id = st.sidequest_id
    join new_trails n on n.title = s.title
    where st.experience_id is null),
  'every stop is linked to a place in the library');

select ok(
  not exists (
    select 1 from public.sidequest_stops st
    join public.sidequests s on s.id = st.sidequest_id
    join new_trails n on n.title = s.title
    where not exists (select 1 from public.checklist_items ci where ci.stop_id = st.id)),
  'every stop has at least one crumb');

select ok(
  not exists (
    select 1 from public.sidequests s
    join new_trails n on n.title = s.title
    where s.estimated_cost is distinct from
      (select sum(st.estimated_cost) from public.sidequest_stops st where st.sidequest_id = s.id)),
  'each trail''s cost is the sum of its stops');

select ok(
  not exists (
    select 1 from public.sidequest_stops st
    join public.sidequests s on s.id = st.sidequest_id
    join new_trails n on n.title = s.title
    where (st.stop_order = 0) <> (st.travel_mode_to_stop is null)),
  'only the first stop of each trail has no travel mode');

select ok(
  not exists (
    select 1 from public.sidequest_stops st
    join public.sidequests s on s.id = st.sidequest_id
    join new_trails n on n.title = s.title
    where st.latitude not between 42.2 and 42.45 or st.longitude not between -71.2 and -70.95),
  'every stop is in Greater Boston');

select ok(
  not exists (
    select 1 from public.sidequests s
    join new_trails n on n.title = s.title
    where s.scheduled_at is not null),
  'the seven trails are go-anytime (no scheduled date)');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select is(
  (select count(*)::int from public.sidequests s join new_trails n on n.title = s.title),
  7, 'logged-out visitors can see all seven trails');
select is(
  (select count(*)::int from public.sidequest_stops st
   join public.sidequests s on s.id = st.sidequest_id
   join new_trails n on n.title = s.title),
  28, 'logged-out visitors can see their stops');

select * from finish();
rollback;
