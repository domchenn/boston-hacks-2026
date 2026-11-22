-- =============================================================================
-- Breadcrumb — seed_more_researched_trails
--
-- Adds seven more researched, curated trails and the 14 new places they need,
-- so the live feed has more than the four seeded so far. Sources:
-- docs/research/experiences.json and docs/research/sidequests.json (this
-- migration is generated from them).
--
-- - 14 new places in the curated library (experiences): Freedom Trail stops,
--   East Boston, Jamaica Plain and Fenway spots. A place is skipped if one with
--   the same name already exists.
-- - Seven curated trails owned by the breadcrumb team account, with stops and
--   crumbs: Freedom Trail on a Student Budget, Red Line Brain Crawl, East
--   Boston (Blue Line), Jamaica Plain (Orange Line), Broke in Boston, Finals
--   Week Midnight Run and Matcha / the Fens / Free Thursday at the Gardner.
--   All are go-anytime (no scheduled_at), as trails are since the Join flow
--   was removed. A trail is skipped if the team already has one with that title.
--
-- Costs and times are estimates from the research notes; stops reuse places
-- from earlier seeds where they already exist (linked by name).
-- Safe to re-run. Runs after: add_friends_also_saved_function.
-- Used by: Explore feed, Trail detail, Make a trail place picker.
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Places (source: docs/research/experiences.json)
-- Re-runnable: a place is skipped if one with the same name already exists.
-- -----------------------------------------------------------------------------
insert into public.experiences
  (name, description, category, neighborhood, address, latitude, longitude,
   estimated_cost, nearest_station, open_late)
select v.* from (values
  ('Boston Common', 'America''s oldest public park and the starting point of the Freedom Trail. The Visitor Center at 139 Tremont St hands out trail maps.', 'outdoors', 'Downtown', '139 Tremont St, Boston, MA 02111', 42.35582, -71.06258, 0, 'Park Street (Red and Green Lines)', false),
  ('Granary Burying Ground', 'Historic 1660 burying ground on the Freedom Trail, where Samuel Adams, John Hancock, Paul Revere and the victims of the Boston Massacre are buried. Free.', 'attractions', 'Downtown', '95 Tremont St, Boston, MA 02108', 42.35713, -71.06179, 0, 'Park Street (Red and Green Lines)', false),
  ('Old State House', '1713 landmark where the Declaration of Independence was read to Bostonians, with the Boston Massacre site marked on the cobblestones outside. The exterior and marker are free to see; the museum inside is ticketed.', 'attractions', 'Downtown', '206 Washington St, Boston, MA 02109', 42.35873, -71.05747, 0, 'State (Orange and Blue Lines)', false),
  ('Wishing Cup', 'Independent community cafe near Government Center with a matcha menu alongside coffee.', 'food_drink', 'Downtown', '45 Court St, Boston, MA 02108', 42.35926, -71.05908, 7, 'Government Center (Green and Blue Lines)', false),
  ('Faneuil Hall Marketplace', 'Historic 1742 meeting hall and marketplace, with the Quincy Market food hall and street performers outside. Free to walk through.', 'attractions', 'Downtown', '1 Faneuil Hall Square, Boston, MA 02109', 42.36003, -71.05623, 0, 'Haymarket (Orange and Green Lines)', false),
  ('Old North Church & Paul Revere Mall', 'Boston''s oldest standing church building (1723), where two lanterns were hung in the steeple on the night of Paul Revere''s ride. The Paul Revere Mall, a brick plaza with his statue on horseback, is right behind it.', 'attractions', 'North End', '193 Salem St, Boston, MA 02113', 42.36632, -71.05445, 0, 'Haymarket (Orange and Green Lines)', false),
  ('Piers Park', 'Waterfront park in East Boston with a pier to walk out on and sweeping views of the downtown skyline across the harbor. Free.', 'outdoors', 'East Boston', 'Marginal St, East Boston, MA 02128', 42.36454, -71.03598, 0, 'Maverick (Blue Line)', false),
  ('Santarpio''s Pizza', 'Old-school East Boston pizza joint known for brick-oven pies and grilled sausage. Cash only, with an ATM inside.', 'food_drink', 'East Boston', '111 Chelsea St, East Boston, MA 02128', 42.37267, -71.03534, 12, 'Airport (Blue Line)', false),
  ('Constitution Beach', 'Harbor-side beach in East Boston where you can watch planes take off and land at Logan Airport. Free, with Harborwalk access.', 'outdoors', 'East Boston', 'Ocean Ave, East Boston, MA 02128', 42.38359, -71.01136, 0, 'Orient Heights (Blue Line)', false),
  ('Arnold Arboretum', 'Harvard''s living tree museum in Jamaica Plain, with miles of paths. Free every day from sunrise to sunset; the Hunnewell Visitor Center is open 10am to 4pm.', 'outdoors', 'Jamaica Plain', '125 Arborway, Boston, MA 02130', 42.30737, -71.12083, 0, 'Forest Hills (Orange Line)', false),
  ('Jamaica Pond', 'Spring-fed pond ringed by a walking path, with a boat house on its shore. Free.', 'outdoors', 'Jamaica Plain', '507 Jamaicaway, Boston, MA 02130', 42.31568, -71.11761, 0, 'Stony Brook (Orange Line)', false),
  ('JP Licks', 'Local ice cream and coffee shop that started in Jamaica Plain, on Centre Street''s strip of restaurants and shops.', 'food_drink', 'Jamaica Plain', '659 Centre St, Jamaica Plain, MA 02130', 42.31285, -71.11446, 6, 'Green Street (Orange Line)', false),
  ('Matcha Cafe Maiko', 'Japanese matcha cafe near Fenway Park serving matcha drinks and desserts. Hours vary by listing, so check before you go.', 'food_drink', 'Fenway', '115 Jersey St, Boston, MA 02215', 42.34272, -71.09706, 8, 'Kenmore (Green Line)', false),
  ('Fenway Victory Gardens', 'Community garden plots in the Back Bay Fens, dating back to World War II. Free to walk through along the Fens path.', 'outdoors', 'Fenway', 'Park Dr, Boston, MA 02215', 42.34532, -71.09324, 0, 'Museum of Fine Arts (Green Line E)', false)
) as v(name, description, category, neighborhood, address, latitude, longitude,
          estimated_cost, nearest_station, open_late)
where not exists (
  select 1 from public.experiences e
  where lower(e.name) = lower(v.name)  -- name only: skips places already added under another address
);


-- -----------------------------------------------------------------------------
-- Curated trails (source: docs/research/sidequests.json)
-- Owned by the "breadcrumb" team account (created by seed_curated_demo_trails).
-- A trail is skipped if the team already has one with the same title. Stops
-- link to a place by name; crumbs link to their stop and are ordered per stop.
-- -----------------------------------------------------------------------------
with creator as (
  select id from public.profiles where username = 'breadcrumb'
),
quests as (
  insert into public.sidequests
    (creator_id, title, description, category, estimated_cost, estimated_duration_minutes,
     neighborhood, scheduled_at, status, primary_line, is_curated)
  select creator.id, v.title, v.description, v.category, v.estimated_cost, v.estimated_duration_minutes,
         v.neighborhood, null, 'published', v.primary_line, true
  from creator
  cross join (values
  ('Freedom Trail on a Student Budget', 'Walk the heart of Boston''s Freedom Trail from Boston Common to the North End for about $12: a graveyard full of Revolution-era names, the Old State House, a matcha break, Faneuil Hall and Paul Revere''s own house. Every stop is a short walk from the last, and the red line on the sidewalk does the navigating.', 'attractions', 12, 210, 'Downtown', 'gl'),
  ('Red Line Brain Crawl: MIT to Harvard', 'Ride the Red Line from Kendall to Harvard and hit a science museum, a sticky bun, a wall of legal graffiti and a free art museum, then end with a late-night slice. Museum stops are daytime, so start before lunch.', 'arts_culture', 30, 300, 'Central/Kendall Square', 'rl'),
  ('East Boston: Skyline, Slices and Planes', 'Ride the Blue Line across the harbor for the best view of the Boston skyline, a classic East Boston pizza, and a beach where planes land right overhead. Santarpio''s is cash only, so stop at an ATM first.', 'outdoors', 12, 210, 'East Boston', 'bl'),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream', 'Take the Orange Line to the end and walk through Harvard''s free Arnold Arboretum, around Jamaica Pond, and finish with ice cream on Centre Street. A few miles of easy walking and one cheap treat.', 'outdoors', 6, 210, 'Jamaica Plain', 'ol'),
  ('Broke in Boston: Under $10', 'A full afternoon for the price of one coffee and a bagel: a grand free library, the Public Garden, and the Charles River Esplanade, all by Green Line and on foot. Everything but the coffee is free.', 'affordable', 8, 230, 'Back Bay', 'gl'),
  ('Finals Week Midnight Run', 'Two North End stops that stay open when everything else has closed: espresso at a classic Italian cafe, then cannoli at a bakery that never closes. The T doesn''t run all night, so check the last train home before you go.', 'food_drink', 16, 90, 'North End', 'ol'),
  ('Matcha, the Fens and Free Thursday at the Gardner', 'Go on a Thursday: start with a matcha near Fenway, walk the Back Bay Fens, and get to the Isabella Stewart Gardner Museum by 5pm, when general admission is free until 9. The first Thursday of the month adds live music in the courtyard.', 'arts_culture', 8, 210, 'Fenway', 'gl')
  ) as v(title, description, category, estimated_cost, estimated_duration_minutes, neighborhood, primary_line)
  where not exists (
    select 1 from public.sidequests sq
    where sq.creator_id = creator.id and sq.title = v.title
  )
  returning id, title
),
stops as (
  insert into public.sidequest_stops
    (sidequest_id, experience_id, place_name, address, latitude, longitude, stop_order,
     description, planned_activity, travel_mode_to_stop, estimated_cost, notes)
  select quests.id, e.id, v.place_name, v.address, v.latitude, v.longitude, v.stop_order,
         v.description, v.planned_activity, v.travel_mode_to_stop, v.estimated_cost, v.notes
  from quests
  join (values
    ('Freedom Trail on a Student Budget', 0, 'Boston Common', '139 Tremont St, Boston, MA 02111', 42.35582, -71.06258, 'The Freedom Trail starts at the Visitor Center on Tremont Street, across from Boston Common.', 'Start at the Visitor Center and find the red line.', null, 0, 'Park Street station (Red and Green Lines) is right at the corner of Tremont St.'),
    ('Freedom Trail on a Student Budget', 1, 'Granary Burying Ground', '95 Tremont St, Boston, MA 02108', 42.35713, -71.06179, 'A 1660 burying ground where Samuel Adams, John Hancock and Paul Revere are buried.', 'Wander the graves.', 'walk', 0, 'About 3 min walk.'),
    ('Freedom Trail on a Student Budget', 2, 'Old State House', '206 Washington St, Boston, MA 02109', 42.35873, -71.05747, 'The 1713 State House, with the Boston Massacre site marked on the cobblestones outside. Seeing it from the street is free.', 'See the building and the marker outside.', 'walk', 0, 'About 6 min walk.'),
    ('Freedom Trail on a Student Budget', 3, 'Wishing Cup', '45 Court St, Boston, MA 02108', 42.35926, -71.05908, 'Community cafe with a matcha menu, a short walk from the State House.', 'Matcha break.', 'walk', 7, 'About 2 min walk. Matcha price is an estimate.'),
    ('Freedom Trail on a Student Budget', 4, 'Faneuil Hall Marketplace', '1 Faneuil Hall Square, Boston, MA 02109', 42.36003, -71.05623, 'The 1742 hall and Quincy Market food hall, free to walk through.', 'Walk through the market.', 'walk', 0, 'About 4 min walk.'),
    ('Freedom Trail on a Student Budget', 5, 'Paul Revere House', '19 North Square, Boston, MA 02113', 42.36374, -71.05368, 'Paul Revere''s 17th-century home, one of the oldest buildings in downtown Boston.', 'Tour Paul Revere''s house.', 'walk', 5, 'About 8 min walk. About $5, and college students pay a little less. Check the current price.'),
    ('Freedom Trail on a Student Budget', 6, 'Old North Church & Paul Revere Mall', '193 Salem St, Boston, MA 02113', 42.36632, -71.05445, 'The church where two lanterns signaled Paul Revere''s ride, with his statue on horseback just behind it.', 'Finish at the steeple.', 'walk', 0, 'About 5 min walk. The church interior is ticketed; the steeple and the Mall are free to see.'),
    ('Red Line Brain Crawl: MIT to Harvard', 0, 'MIT Museum', '314 Main St, Cambridge, MA 02142', 42.36198, -71.08642, 'MIT''s museum of science, technology and art, with robots, holograms and rotating exhibits.', 'Explore the museum with your college ID.', null, 10, 'Kendall/MIT station (Red Line). The student rate is $10 with a college ID; the museum is open daily 10am to 5pm.'),
    ('Red Line Brain Crawl: MIT to Harvard', 1, 'Flour Bakery + Café', '190 Massachusetts Ave, Cambridge, MA 02139', 42.360996, -71.096827, 'Bakery cafe known for sticky buns and sandwiches.', 'Lunch and a sticky bun.', 'walk', 12, 'About 14 min walk. Or ride the Red Line one stop to Central.'),
    ('Red Line Brain Crawl: MIT to Harvard', 2, 'Graffiti Alley (Modica Way)', '567 Massachusetts Ave, Cambridge, MA 02139', 42.36491, -71.10229, 'A walkway where graffiti is legal and the murals keep changing.', 'Hunt for the best mural.', 'walk', 0, 'About 10 min walk.'),
    ('Red Line Brain Crawl: MIT to Harvard', 3, 'Harvard Art Museums', '32 Quincy St, Cambridge, MA 02138', 42.3741, -71.11411, 'Three museums under one glass roof. Admission is free for everyone; open Tuesday to Sunday, 10am to 5pm.', 'Pick one gallery and stay a while.', 'train', 0, 'Ride the Red Line from Central to Harvard (1 stop). Closed Mondays.'),
    ('Red Line Brain Crawl: MIT to Harvard', 4, 'Pinocchio''s Pizza & Subs', '74 Winthrop St, Cambridge, MA 02138', 42.372003, -71.120268, 'Harvard Square pizza shop since 1966 that stays open late.', 'Finish with a Sicilian slice.', 'walk', 8, 'About 9 min walk.'),
    ('East Boston: Skyline, Slices and Planes', 0, 'Piers Park', 'Marginal St, East Boston, MA 02128', 42.36454, -71.03598, 'Waterfront park with views of downtown across the harbor.', 'Walk out on the pier for the skyline.', null, 0, 'About 8 min walk from Maverick station (Blue Line).'),
    ('East Boston: Skyline, Slices and Planes', 1, 'Santarpio''s Pizza', '111 Chelsea St, East Boston, MA 02128', 42.37267, -71.03534, 'Old-school East Boston pizza joint known for brick-oven pies and grilled sausage.', 'Split a pie.', 'train', 12, 'Ride the Blue Line from Maverick to Airport (1 stop), then about 6 min on foot. Cash only, with an ATM inside. Price is an estimate; check hours.'),
    ('East Boston: Skyline, Slices and Planes', 2, 'Constitution Beach', 'Ocean Ave, East Boston, MA 02128', 42.38359, -71.01136, 'Harbor-side beach where planes take off and land at Logan.', 'Watch the planes come in.', 'train', 0, 'Ride the Blue Line from Airport to Orient Heights (2 stops), then about 10 min on foot.'),
    ('Jamaica Plain: Arboretum, Pond and Ice Cream', 0, 'Arnold Arboretum', '125 Arborway, Boston, MA 02130', 42.30737, -71.12083, 'Harvard''s living tree museum, free every day from sunrise to sunset.', 'Walk through the collection to the visitor center.', null, 0, 'From Forest Hills station (Orange Line), enter at the Forest Hills Gate and walk about 15 min through the grounds to the visitor center. The visitor center is open 10am to 4pm.'),
    ('Jamaica Plain: Arboretum, Pond and Ice Cream', 1, 'Jamaica Pond', '507 Jamaicaway, Boston, MA 02130', 42.31568, -71.11761, 'Spring-fed pond ringed by a walking path, with a boat house on its shore.', 'Walk a loop around the pond.', 'walk', 0, 'About 16 min walk.'),
    ('Jamaica Plain: Arboretum, Pond and Ice Cream', 2, 'JP Licks', '659 Centre St, Jamaica Plain, MA 02130', 42.31285, -71.11446, 'Local ice cream shop on Centre Street.', 'Treat yourself.', 'walk', 6, 'About 7 min walk. Green Street station (Orange Line) is the closest T stop. Price is an estimate.'),
    ('Broke in Boston: Under $10', 0, 'Pavement Coffeehouse', '286 Newbury St, Boston, MA 02115', 42.34889, -71.08441, 'Local coffee shop on Newbury Street with bagels and a cozy room.', 'Coffee and a bagel to start.', null, 8, 'Hynes Convention Center station (Green Line) is a short walk away. Price is an estimate.'),
    ('Broke in Boston: Under $10', 1, 'Boston Public Library, Central Library', '700 Boylston St, Boston, MA 02116', 42.34933, -71.07865, 'Landmark library in Copley Square with murals, a courtyard and the grand Bates Hall reading room.', 'Walk in for free.', 'walk', 0, 'About 8 min walk.'),
    ('Broke in Boston: Under $10', 2, 'Boston Public Garden', '4 Charles St, Boston, MA 02116', 42.35409, -71.07004, 'Historic garden with a lagoon, a footbridge and the Make Way for Ducklings statues.', 'Loop the lagoon.', 'walk', 0, 'About 14 min walk.'),
    ('Broke in Boston: Under $10', 3, 'Charles River Esplanade & Hatch Shell', '47 David G Mugar Way, Boston, MA 02108', 42.3573, -71.0737, 'Riverside path along the Charles, centered on the Hatch Shell.', 'End by the river.', 'walk', 0, 'About 8 min walk. Cross Storrow Drive by the footbridge.'),
    ('Finals Week Midnight Run', 0, 'Caffè Vittoria', '290 Hanover St, Boston, MA 02113', 42.36407, -71.05437, 'Old-school Italian cafe on Hanover Street that stays open late.', 'Espresso and a cannoli.', null, 10, 'Haymarket station (Orange and Green Lines). Listed hours run to about midnight, so check before you go.'),
    ('Finals Week Midnight Run', 1, 'Bova''s Bakery', '134 Salem St, Boston, MA 02113', 42.3652, -71.05559, 'Family-run Italian bakery open 24 hours.', 'Late-night pastry run.', 'walk', 6, 'About 3 min walk.'),
    ('Matcha, the Fens and Free Thursday at the Gardner', 0, 'Matcha Cafe Maiko', '115 Jersey St, Boston, MA 02215', 42.34272, -71.09706, 'Matcha cafe near Fenway Park.', 'Matcha first.', null, 8, 'About 11 min walk from Kenmore station (Green Line). Hours vary by listing (one has Thursdays 2pm to 9pm), so check before you go. Price is an estimate.'),
    ('Matcha, the Fens and Free Thursday at the Gardner', 1, 'Fenway Victory Gardens', 'Park Dr, Boston, MA 02215', 42.34532, -71.09324, 'Community garden plots in the Back Bay Fens.', 'Walk the Fens.', 'walk', 0, 'About 7 min walk.'),
    ('Matcha, the Fens and Free Thursday at the Gardner', 2, 'James P. Kelleher Rose Garden', '73 Park Dr, Boston, MA 02215', 42.34164, -71.09476, 'Free formal rose garden inside the Fens, prettiest in early summer.', 'Stop at the rose garden.', 'walk', 0, 'About 7 min walk. If it''s getting dark, take the busier streets and go with friends.'),
    ('Matcha, the Fens and Free Thursday at the Gardner', 3, 'Isabella Stewart Gardner Museum', '25 Evans Way, Boston, MA 02115', 42.33825, -71.09915, 'A Venetian-style palace of art around a flowering courtyard. Free general admission every Thursday, 5 to 9pm; reserve ahead.', 'Free admission from 5 to 9pm.', 'walk', 0, 'About 8 min walk. Reservations are recommended. The first Thursday of each month adds live music, performances and art making.')
  ) as v(trail_title, stop_order, place_name, address, latitude, longitude, description,
         planned_activity, travel_mode_to_stop, estimated_cost, notes)
    on v.trail_title = quests.title
  left join lateral (
    select id from public.experiences x
    where lower(x.name) = lower(v.place_name)
    order by x.created_at, x.id
    limit 1
  ) e on true
  returning id, sidequest_id, stop_order
)
insert into public.checklist_items (sidequest_id, stop_id, label, item_type, item_order, is_checkpoint)
select stops.sidequest_id, stops.id, c.label, c.item_type, c.item_order, c.is_checkpoint
from stops
join quests on quests.id = stops.sidequest_id
join (values
  ('Freedom Trail on a Student Budget', 0, 'Find the red line that marks the Freedom Trail', 'see', 0, true),
  ('Freedom Trail on a Student Budget', 0, 'Grab a free trail map at the Visitor Center', 'do', 1, false),
  ('Freedom Trail on a Student Budget', 1, 'Find the grave of Paul Revere, Samuel Adams or John Hancock', 'see', 0, false),
  ('Freedom Trail on a Student Budget', 1, 'Find the oldest date you can on a headstone', 'see', 1, false),
  ('Freedom Trail on a Student Budget', 2, 'Stand on the Boston Massacre site marker', 'do', 0, true),
  ('Freedom Trail on a Student Budget', 2, 'Look up at the balcony where the Declaration of Independence was read', 'see', 1, false),
  ('Freedom Trail on a Student Budget', 3, 'Order a matcha', 'do', 0, false),
  ('Freedom Trail on a Student Budget', 3, 'Sip it on the walk to Faneuil Hall', 'do', 1, true),
  ('Freedom Trail on a Student Budget', 4, 'Find the grasshopper weathervane on top of Faneuil Hall', 'see', 0, false),
  ('Freedom Trail on a Student Budget', 4, 'Walk through the Quincy Market food hall', 'do', 1, false),
  ('Freedom Trail on a Student Budget', 5, 'Step inside a house from the 1600s', 'do', 0, false),
  ('Freedom Trail on a Student Budget', 6, 'Find the Paul Revere statue on horseback', 'see', 0, false),
  ('Freedom Trail on a Student Budget', 6, 'Look up at the steeple where the two lanterns hung', 'see', 1, true),
  ('Red Line Brain Crawl: MIT to Harvard', 0, 'Show your college ID for the student rate', 'do', 0, false),
  ('Red Line Brain Crawl: MIT to Harvard', 0, 'See a robot or a hologram exhibit', 'see', 1, false),
  ('Red Line Brain Crawl: MIT to Harvard', 1, 'Try the sticky bun to share', 'do', 0, false),
  ('Red Line Brain Crawl: MIT to Harvard', 2, 'Photograph your favorite mural', 'do', 0, false),
  ('Red Line Brain Crawl: MIT to Harvard', 2, 'Find a mural you can''t believe someone painted', 'see', 1, true),
  ('Red Line Brain Crawl: MIT to Harvard', 3, 'Find the glass roof over the courtyard', 'see', 0, false),
  ('Red Line Brain Crawl: MIT to Harvard', 3, 'Pick one painting to spend a full minute with', 'do', 1, false),
  ('Red Line Brain Crawl: MIT to Harvard', 4, 'Order a Sicilian slice', 'do', 0, false),
  ('East Boston: Skyline, Slices and Planes', 0, 'Walk to the end of the pier for the skyline view', 'do', 0, true),
  ('East Boston: Skyline, Slices and Planes', 0, 'Spot a ship moving through the harbor', 'see', 1, false),
  ('East Boston: Skyline, Slices and Planes', 1, 'Split a pie with the group', 'do', 0, false),
  ('East Boston: Skyline, Slices and Planes', 1, 'Bring cash. It''s cash only', 'do', 1, false),
  ('East Boston: Skyline, Slices and Planes', 2, 'Watch a plane land from the beach', 'see', 0, true),
  ('East Boston: Skyline, Slices and Planes', 2, 'Take a photo with a plane overhead', 'do', 1, false),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream', 0, 'Find a tree with an ID tag and look up what it is', 'see', 0, false),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream', 0, 'Find the Hunnewell Visitor Center', 'see', 1, false),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream', 1, 'Walk the path around the pond', 'do', 0, true),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream', 1, 'Spot the boat house', 'see', 1, false),
  ('Jamaica Plain: Arboretum, Pond and Ice Cream', 2, 'Try a flavor you have never had', 'do', 0, false),
  ('Broke in Boston: Under $10', 0, 'Order a coffee and a bagel for under $8', 'do', 0, false),
  ('Broke in Boston: Under $10', 1, 'Step into the Bates Hall reading room', 'see', 0, false),
  ('Broke in Boston: Under $10', 1, 'Find the courtyard', 'see', 1, true),
  ('Broke in Boston: Under $10', 2, 'Find the Make Way for Ducklings statues', 'see', 0, false),
  ('Broke in Boston: Under $10', 2, 'Cross the lagoon footbridge', 'do', 1, false),
  ('Broke in Boston: Under $10', 3, 'Find the Hatch Shell', 'see', 0, false),
  ('Broke in Boston: Under $10', 3, 'Walk the river path with the Charles on your side', 'do', 1, true),
  ('Finals Week Midnight Run', 0, 'Order an espresso and a cannoli', 'do', 0, false),
  ('Finals Week Midnight Run', 0, 'Check the last train home', 'do', 1, true),
  ('Finals Week Midnight Run', 1, 'Order a cannoli or a calzone', 'do', 0, false),
  ('Finals Week Midnight Run', 1, 'Take a photo of your late-night haul', 'do', 1, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 0, 'Order a matcha', 'do', 0, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 0, 'Try a matcha dessert', 'do', 1, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 1, 'Find the garden plots', 'see', 0, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 1, 'Walk the Fens path', 'do', 1, true),
  ('Matcha, the Fens and Free Thursday at the Gardner', 2, 'Find the rose garden', 'see', 0, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 3, 'Reserve a free Thursday night ticket ahead of time', 'do', 0, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 3, 'Find the courtyard', 'see', 1, false),
  ('Matcha, the Fens and Free Thursday at the Gardner', 3, 'Pick your favorite room', 'do', 2, true)
) as c(trail_title, stop_order, label, item_type, item_order, is_checkpoint)
  on c.trail_title = quests.title and c.stop_order = stops.stop_order;
