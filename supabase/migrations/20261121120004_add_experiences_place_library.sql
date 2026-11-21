-- =============================================================================
-- Breadcrumb — 20261121120004_add_experiences_place_library.sql
--
-- Creates the curated library of real, verified Boston places ("experiences").
--
-- Creators pick stops from this library so locations, cost estimates and
-- nearest T stations are accurate. Read-only for users: the team fills it
-- through seed.sql or the SQL editor (there is no insert policy).
--
-- Runs after: 20261121120003_add_community_membership_and_visibility.sql
-- Used by:    Create flow (place picker), seed data
--
-- Immutable once applied: make further changes in a new migration
-- (npx supabase migration new <name>).
-- =============================================================================

-- =============================================================================
-- experiences — curated library of verified Boston places
-- Read-only for users. Rows are added by the team through seed.sql or the
-- SQL editor (there is no insert policy, so clients can't write).
-- =============================================================================
create table public.experiences (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 1 and 200),
  description     text check (char_length(description) <= 2000),
  category        text not null check (category in
                    ('food_drink', 'outdoors', 'arts_culture', 'shopping', 'attractions', 'affordable')),
  neighborhood    text check (char_length(neighborhood) <= 80),
  address         text check (char_length(address) <= 300),
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  estimated_cost  numeric(10, 2) check (estimated_cost >= 0),
  nearest_station text check (char_length(nearest_station) <= 120),
  open_late       boolean not null default false,
  image_url       text,
  created_at      timestamptz not null default now()
);
create index experiences_category_idx     on public.experiences (category);
create index experiences_neighborhood_idx on public.experiences (neighborhood);

alter table public.experiences enable row level security;
create policy "Experiences are publicly readable"
  on public.experiences for select to anon, authenticated using (true);
