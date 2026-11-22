-- =============================================================================
-- Breadcrumb — seed_demo_activity_and_fix_coordinates
--
-- Demo prep (task D6):
--
-- 1. Coordinate fixes. The first curated trails used rough coordinates. Six of
--    those places were later verified in Jason's research (docs/research/
--    experiences.json), up to ~90 m more accurate. Update the library places
--    and the trail stops linked to them so map pins sit on the right spot.
--
-- 2. Demo activity so the app looks lived-in for judges:
--    - 3 demo accounts (no passwords, nobody can log in as them): @maya_k (BU),
--      @jrod (BC), @priya_s.
--    - They've finished the two anytime curated trails and rated them (price,
--      time, enjoyment, memorability + a short review), so cards show real
--      ★ ratings and the breadcrumb account has a questgiver rating.
--    - They've signed up for the two scheduled trails, so "N going" and the
--      avatar row show up.
--    Reviews are demo content written by the team, labelled by these clearly
--    fictional demo accounts.
--
-- Fixed ids + "on conflict do nothing" / "where not exists" make it safe to re-run.
-- Runs after: add_trail_attendees_functions.
-- Used by: Explore cards (ratings, going), Trail detail (reviews, going), You page.
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Coordinate fixes (verified values from docs/research/experiences.json)
-- -----------------------------------------------------------------------------
update public.experiences e
set latitude = v.lat, longitude = v.lng
from (values
  ('e0000000-0000-4000-8000-000000000001'::uuid, 42.35792, -71.07065),  -- Tatte Bakery & Café
  ('e0000000-0000-4000-8000-000000000002'::uuid, 42.35409, -71.07004),  -- Boston Public Garden
  ('e0000000-0000-4000-8000-000000000003'::uuid, 42.34824, -71.08661),  -- Trident Booksellers & Café
  ('e0000000-0000-4000-8000-000000000005'::uuid, 42.36427, -71.05438),  -- Mike's Pastry
  ('e0000000-0000-4000-8000-000000000007'::uuid, 42.37409, -71.11672),  -- Harvard Yard
  ('e0000000-0000-4000-8000-000000000008'::uuid, 42.37254, -71.11636)   -- Harvard Book Store
) as v(id, lat, lng)
where e.id = v.id;

-- Stops created from those places follow the library's coordinates.
update public.sidequest_stops s
set latitude = e.latitude, longitude = e.longitude
from public.experiences e
where s.experience_id = e.id
  and e.id in (
    'e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
    'e0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000005',
    'e0000000-0000-4000-8000-000000000007', 'e0000000-0000-4000-8000-000000000008')
  and (s.latitude is distinct from e.latitude or s.longitude is distinct from e.longitude);


-- -----------------------------------------------------------------------------
-- 2a. Demo accounts (profiles are created by the signup trigger, then filled in)
-- -----------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'maya.demo@breadcrumb.invalid', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Maya K."}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'jrod.demo@breadcrumb.invalid', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Jordan R."}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'priya.demo@breadcrumb.invalid', '{"provider": "email", "providers": ["email"]}', '{"display_name": "Priya S."}', now(), now())
on conflict (id) do nothing;

update public.profiles p
set username = v.username, display_name = v.display_name, university = v.university, bio = v.bio,
    community_id = (select c.id from public.communities c where c.slug = v.community)
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'maya_k',  'Maya K.',   'Boston University', 'Cheap eats and long walks. Demo account.', 'bu'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, 'jrod',    'Jordan R.', 'Boston College',    'Always hunting for the best cannoli. Demo account.', 'bc'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, 'priya_s', 'Priya S.',  'Northeastern University', 'Bookstores, museums, coffee. Demo account.', null)
) as v(id, username, display_name, university, bio, community)
where p.id = v.id and p.username is null;


-- -----------------------------------------------------------------------------
-- 2b. Progress: finished the anytime trails, signed up for the scheduled ones
-- -----------------------------------------------------------------------------
insert into public.user_sidequests (user_id, sidequest_id, status, started_at, completed_at)
select v.user_id, v.trail_id, v.status, v.started_at, v.completed_at
from (values
  -- Sunday Café Hop
  ('d0000000-0000-4000-8000-000000000001'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid, 'completed', now() - interval '12 days', now() - interval '12 days' + interval '3 hours'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid, 'completed', now() - interval '6 days',  now() - interval '6 days' + interval '2 hours'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid, 'completed', now() - interval '3 days',  now() - interval '3 days' + interval '3 hours'),
  -- North End Cannoli Duel
  ('d0000000-0000-4000-8000-000000000001'::uuid, '5eed0000-0000-4000-8000-000000000002'::uuid, 'completed', now() - interval '9 days',  now() - interval '9 days' + interval '2 hours'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, '5eed0000-0000-4000-8000-000000000002'::uuid, 'completed', now() - interval '4 days',  now() - interval '4 days' + interval '1 hour'),
  -- Harvard Square Bookstores (scheduled): signed up
  ('d0000000-0000-4000-8000-000000000001'::uuid, '5eed0000-0000-4000-8000-000000000003'::uuid, 'signed_up', null, null),
  ('d0000000-0000-4000-8000-000000000003'::uuid, '5eed0000-0000-4000-8000-000000000003'::uuid, 'signed_up', null, null)
) as v(user_id, trail_id, status, started_at, completed_at)
on conflict (user_id, sidequest_id) do nothing;

-- Chinatown Food Tour (scheduled, created by the researched-places migration): signed up
insert into public.user_sidequests (user_id, sidequest_id, status)
select u.user_id, s.id, 'signed_up'
from public.sidequests s
cross join (values
  ('d0000000-0000-4000-8000-000000000002'::uuid),
  ('d0000000-0000-4000-8000-000000000003'::uuid)
) as u(user_id)
where s.title = 'Chinatown Food Tour' and s.is_curated
on conflict (user_id, sidequest_id) do nothing;


-- -----------------------------------------------------------------------------
-- 2c. Ratings + reviews on the finished trails (scores 1–5)
-- -----------------------------------------------------------------------------
insert into public.sidequest_ratings
  (user_id, sidequest_id, price_rating, time_rating, enjoyment_rating, memorability_rating, review_text, created_at)
select v.user_id, v.trail_id, v.price, v.time, v.enjoyment, v.memorability, v.review, now() - v.ago
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid, 4, 5, 5, 5,
   'The ducklings crumb was the highlight. Go before noon on Sunday, the Tatte line gets long.', interval '12 days'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid, 4, 4, 4, 3,
   'Easy, chill walk. Took the Green Line for the last leg and it was quick.', interval '6 days'),
  ('d0000000-0000-4000-8000-000000000003'::uuid, '5eed0000-0000-4000-8000-000000000001'::uuid, 5, 4, 5, 4,
   'Perfect slow Sunday. Ended up buying two books at Trident.', interval '3 days'),
  ('d0000000-0000-4000-8000-000000000001'::uuid, '5eed0000-0000-4000-8000-000000000002'::uuid, 5, 5, 5, 4,
   'Team Modern, no contest. The harbor walk after is a great way to finish.', interval '9 days'),
  ('d0000000-0000-4000-8000-000000000002'::uuid, '5eed0000-0000-4000-8000-000000000002'::uuid, 5, 4, 5, 5,
   'Mike''s won for me. Cheap, quick and fun to argue about with friends.', interval '4 days')
) as v(user_id, trail_id, price, time, enjoyment, memorability, review, ago)
on conflict (user_id, sidequest_id) do nothing;
