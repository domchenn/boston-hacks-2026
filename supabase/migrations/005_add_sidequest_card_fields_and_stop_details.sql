-- =============================================================================
-- Breadcrumb — 005_add_sidequest_card_fields_and_stop_details.sql
--
-- Adds the fields the cards, detail page and route need.
--
-- sidequests:
-- - primary_line: main T line (rl/gl/bl/ol/sl/cr), sets the card colour
-- - is_curated: team-made demo content, shows a "Curated" badge
-- - category: limited to the PRD §10 categories
-- sidequest_stops:
-- - experience_id: the library place it came from (null = custom location)
-- - planned_activity, notes: what you do at the stop
-- - travel_mode_to_stop: walk / bike / bus / train from the previous stop
-- - unique (id, sidequest_id): lets checklist items point at a stop safely
--
-- Runs after: 004
-- Used by:    Feed cards, detail page, Create flow, maps
--
-- Immutable once applied to the shared project: change things in a new file.
-- =============================================================================

-- =============================================================================
-- sidequests and stops — new columns
-- =============================================================================
alter table public.sidequests
  add column primary_line text check (primary_line in ('rl', 'gl', 'bl', 'ol', 'sl', 'cr')),
  add column is_curated   boolean not null default false;
comment on column public.sidequests.primary_line is
  'Main T line the quest rides. Sets the card colour (style guide). Null = no T line (walk/bike only).';
comment on column public.sidequests.is_curated is
  'True for team-made seed/demo content, shown with a "Curated" badge.';

-- Category values from PRD §10.
update public.sidequests set category = null
  where category is not null and category not in
    ('food_drink', 'outdoors', 'arts_culture', 'shopping', 'attractions', 'affordable');
alter table public.sidequests add constraint sidequests_category_allowed
  check (category in ('food_drink', 'outdoors', 'arts_culture', 'shopping', 'attractions', 'affordable'));

alter table public.sidequest_stops
  add column experience_id      uuid references public.experiences (id) on delete set null,
  add column planned_activity   text check (char_length(planned_activity) <= 1000),
  add column travel_mode_to_stop text check (travel_mode_to_stop in ('walk', 'bike', 'bus', 'train')),
  add column notes              text check (char_length(notes) <= 2000),
  -- Lets checklist_items reference (stop_id, sidequest_id) so an item's stop
  -- must belong to the same sidequest.
  add constraint sidequest_stops_id_sidequest_unique unique (id, sidequest_id);
comment on column public.sidequest_stops.experience_id is
  'Curated place this stop was created from. Null = custom location.';
comment on column public.sidequest_stops.travel_mode_to_stop is
  'How to get here from the previous stop. Null for the first stop.';
create index sidequest_stops_experience_idx on public.sidequest_stops (experience_id);
