-- =============================================================================
-- Breadcrumb — 002_prd_v3_core.sql
--
-- Brings the schema in line with PRD v3 §9. Run AFTER 001_initial_schema.sql.
--
-- Adds:     experiences (curated place library), checklist_items,
--           user_sidequests (one progress/status row per user per sidequest),
--           checklist_completions, quest_photos, sidequest_ratings (4 scores),
--           creator_ratings, rating views, community visibility.
-- Extends:  profiles (community_id), communities (slug), sidequests
--           (community_id, primary_line, is_curated), sidequest_stops
--           (experience_id, planned_activity, travel_mode_to_stop, notes).
-- Replaces: saved_sidequests, sidequest_participants, completed_sidequests
--           → user_sidequests;  sidequest_reviews → sidequest_ratings;
--           community_members → profiles.community_id (PRD: one community).
--           The old tables are dropped. No app code uses them yet.
--
-- Immutable once applied. Make further changes in 003+.
-- =============================================================================


-- =============================================================================
-- 1. Drop tables that PRD v3 replaces
-- =============================================================================
drop table if exists public.sidequest_reviews;       -- FK to completed_sidequests, drop first
drop table if exists public.completed_sidequests;
drop table if exists public.saved_sidequests;
drop table if exists public.sidequest_participants;
drop table if exists public.community_members;

drop trigger if exists sidequests_prevent_unscheduling on public.sidequests;
drop function if exists private.prevent_unscheduling_with_participants();
drop function if exists private.validate_participation();


-- =============================================================================
-- 2. Communities and profiles
-- =============================================================================
alter table public.communities
  add column slug text unique check (slug ~ '^[a-z0-9-]{2,40}$');
comment on column public.communities.slug is 'URL-safe id, e.g. "bu", "bc".';

alter table public.profiles
  add column community_id uuid references public.communities (id) on delete set null;
comment on column public.profiles.community_id is
  'The one community the user belongs to (PRD §6.1). Null = none. Set in settings.';
create index profiles_community_idx on public.profiles (community_id);


-- =============================================================================
-- 3. experiences — curated library of verified Boston places
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


-- =============================================================================
-- 4. sidequests and stops — new columns
-- =============================================================================
alter table public.sidequests
  add column community_id uuid references public.communities (id) on delete set null,
  add column primary_line text check (primary_line in ('rl', 'gl', 'bl', 'ol', 'sl', 'cr')),
  add column is_curated   boolean not null default false;
comment on column public.sidequests.community_id is
  'Null = visible to everyone. Set = only members of that community can see it (PRD §6.1).';
comment on column public.sidequests.primary_line is
  'Main T line the quest rides. Sets the card colour (style guide). Null = no T line (walk/bike only).';
comment on column public.sidequests.is_curated is
  'True for team-made seed/demo content, shown with a "Curated" badge.';
create index sidequests_community_idx on public.sidequests (community_id);

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


-- =============================================================================
-- 5. Visibility helpers (replace 001 versions to add community scoping)
-- =============================================================================

-- Is the current user a member of this community?
create function private.in_community(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.community_id = p_community_id
  );
$$;

-- Visible = (published AND (everyone OR my community)) OR I created it.
create or replace function private.can_view_sidequest(p_sidequest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sidequests s
    where s.id = p_sidequest_id
      and (
        s.creator_id = (select auth.uid())
        or (s.status = 'published'
            and (s.community_id is null or private.in_community(s.community_id)))
      )
  );
$$;

revoke all on function private.in_community(uuid) from public;
grant execute on function private.in_community(uuid) to anon, authenticated;

drop policy "Published sidequests are readable; creators see their own" on public.sidequests;
create policy "Visible sidequests are readable"
  on public.sidequests for select
  to anon, authenticated
  using (
    creator_id = (select auth.uid())
    or (status = 'published'
        and (community_id is null or (select private.in_community(community_id))))
  );


-- =============================================================================
-- 6. checklist_items — things to see/do, per stop or between stops
-- =============================================================================
create table public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  sidequest_id  uuid not null references public.sidequests (id) on delete cascade,
  stop_id       uuid,
  label         text not null check (char_length(label) between 1 and 200),
  item_type     text not null default 'do' check (item_type in ('see', 'do')),
  item_order    integer not null default 0 check (item_order >= 0),
  is_checkpoint boolean not null default false,
  created_at    timestamptz not null default now(),
  -- The stop must belong to the same sidequest. Deleting a stop deletes its items.
  constraint checklist_items_stop_fk foreign key (stop_id, sidequest_id)
    references public.sidequest_stops (id, sidequest_id) on delete cascade
);
comment on column public.checklist_items.stop_id is
  'Null = not tied to a stop (e.g. a checkpoint on the way between stops).';
comment on column public.checklist_items.is_checkpoint is
  'True for P2 "checkpoints" between stops (PRD §6.2).';
create index checklist_items_sidequest_idx on public.checklist_items (sidequest_id, item_order);
create index checklist_items_stop_idx      on public.checklist_items (stop_id);

alter table public.checklist_items enable row level security;

-- Same visibility and ownership as the parent sidequest (like stops).
create policy "Checklist items visible when sidequest is visible"
  on public.checklist_items for select to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));
create policy "Creators can add checklist items"
  on public.checklist_items for insert to authenticated
  with check ((select private.owns_sidequest(sidequest_id)));
create policy "Creators can update checklist items"
  on public.checklist_items for update to authenticated
  using ((select private.owns_sidequest(sidequest_id)))
  with check ((select private.owns_sidequest(sidequest_id)));
create policy "Creators can delete checklist items"
  on public.checklist_items for delete to authenticated
  using ((select private.owns_sidequest(sidequest_id)));


-- =============================================================================
-- 7. user_sidequests — one row per user per sidequest holding its status
--    saved → signed_up → in_progress → completed / aborted (any order allowed)
-- Private: each user sees only their own rows (PRD §9).
-- =============================================================================
create table public.user_sidequests (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  status       text not null check (status in ('saved', 'signed_up', 'in_progress', 'completed', 'aborted')),
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_id, sidequest_id),
  constraint user_sidequests_completed_at check ((status = 'completed') = (completed_at is not null))
);
create index user_sidequests_status_idx    on public.user_sidequests (user_id, status);
create index user_sidequests_sidequest_idx on public.user_sidequests (sidequest_id);

-- Fill in timestamps and validate status changes:
--  * in_progress sets started_at (first time only)
--  * completed sets completed_at; leaving completed clears it
--  * signed_up only for scheduled sidequests (PRD §5.3)
create function private.user_sidequests_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();

  if new.status = 'in_progress' and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    new.started_at := coalesce(new.started_at, new.completed_at);
  else
    new.completed_at := null;
  end if;

  if new.status = 'signed_up' and not exists (
    select 1 from public.sidequests s
    where s.id = new.sidequest_id and s.scheduled_at is not null
  ) then
    raise exception 'Can only sign up for a sidequest with a scheduled start'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger user_sidequests_before_write
  before insert or update on public.user_sidequests
  for each row execute function private.user_sidequests_before_write();

alter table public.user_sidequests enable row level security;
create policy "Users read their own progress"
  on public.user_sidequests for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users add progress for visible sidequests"
  on public.user_sidequests for insert to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_view_sidequest(sidequest_id)));
create policy "Users update their own progress"
  on public.user_sidequests for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete their own progress"
  on public.user_sidequests for delete to authenticated
  using (user_id = (select auth.uid()));


-- =============================================================================
-- 8. checklist_completions — a user's ticked items (+ optional proof photo)
-- Private to the user. Kept when a quest is "saved for later" so progress
-- survives (PRD Flow C).
-- =============================================================================
create table public.checklist_completions (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items (id) on delete cascade,
  completed_at      timestamptz not null default now(),
  photo_url         text,
  primary key (user_id, checklist_item_id)
);
create index checklist_completions_item_idx on public.checklist_completions (checklist_item_id);

-- Can the current user tick this item? They must have a progress row for its
-- sidequest (any status except aborted: in progress, saved mid-quest, or done).
create function private.can_complete_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.checklist_items ci
    join public.user_sidequests us
      on us.sidequest_id = ci.sidequest_id and us.user_id = (select auth.uid())
    where ci.id = p_item_id and us.status <> 'aborted'
  );
$$;
revoke all on function private.can_complete_item(uuid) from public;
grant execute on function private.can_complete_item(uuid) to authenticated;

alter table public.checklist_completions enable row level security;
create policy "Users read their own completions"
  on public.checklist_completions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users tick items on quests they started"
  on public.checklist_completions for insert to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_complete_item(checklist_item_id)));
create policy "Users update their own completions"
  on public.checklist_completions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users untick their own completions"
  on public.checklist_completions for delete to authenticated
  using (user_id = (select auth.uid()));


-- =============================================================================
-- 9. quest_photos — extra photos from a quest ("add other photos" tab)
-- PRD §5.4: photos are social proof "visible on the sidequest", so they're
-- readable wherever the sidequest is. Only the owner can add or remove them.
-- (Checklist proof photos live on checklist_completions and stay private.)
-- The Storage bucket for the files themselves comes in a later migration.
-- =============================================================================
create table public.quest_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  photo_url    text not null,
  caption      text check (char_length(caption) <= 300),
  created_at   timestamptz not null default now()
);
create index quest_photos_sidequest_idx on public.quest_photos (sidequest_id, created_at desc);
create index quest_photos_user_idx      on public.quest_photos (user_id);

alter table public.quest_photos enable row level security;
create policy "Quest photos visible when sidequest is visible"
  on public.quest_photos for select to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));
create policy "Users add photos to quests they started"
  on public.quest_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.user_sidequests us
                where us.user_id = (select auth.uid())
                  and us.sidequest_id = quest_photos.sidequest_id
                  and us.status in ('in_progress', 'completed', 'saved'))
  );
create policy "Users delete their own photos"
  on public.quest_photos for delete to authenticated
  using (user_id = (select auth.uid()));


-- =============================================================================
-- 10. sidequest_ratings — price, time, enjoyment, memorability (1–5 each)
-- Only users who completed the sidequest can rate it; one rating each.
-- =============================================================================
create table public.sidequest_ratings (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  sidequest_id        uuid not null references public.sidequests (id) on delete cascade,
  price_rating        smallint not null check (price_rating between 1 and 5),
  time_rating         smallint not null check (time_rating between 1 and 5),
  enjoyment_rating    smallint not null check (enjoyment_rating between 1 and 5),
  memorability_rating smallint not null check (memorability_rating between 1 and 5),
  review_text         text check (char_length(review_text) <= 2000),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (user_id, sidequest_id)
);
create index sidequest_ratings_sidequest_idx on public.sidequest_ratings (sidequest_id);

-- Enforce "completed it" in the database, not just the UI. Runs as definer so
-- the check works no matter which role writes. Creators can't rate their own.
create function private.validate_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  if not exists (
    select 1 from public.user_sidequests us
    where us.user_id = new.user_id
      and us.sidequest_id = new.sidequest_id
      and us.status = 'completed'
  ) then
    raise exception 'You can only rate a sidequest you have completed'
      using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.sidequests s
             where s.id = new.sidequest_id and s.creator_id = new.user_id) then
    raise exception 'Creators cannot rate their own sidequest'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sidequest_ratings_validate
  before insert or update on public.sidequest_ratings
  for each row execute function private.validate_rating();

alter table public.sidequest_ratings enable row level security;
create policy "Ratings visible when sidequest is visible"
  on public.sidequest_ratings for select to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));
create policy "Users rate as themselves"
  on public.sidequest_ratings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users edit their own ratings"
  on public.sidequest_ratings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete their own ratings"
  on public.sidequest_ratings for delete to authenticated
  using (user_id = (select auth.uid()));


-- =============================================================================
-- 11. creator_ratings — rate a user's quest-making directly (P2, PRD §6.3)
-- =============================================================================
create table public.creator_ratings (
  rater_id   uuid not null references public.profiles (id) on delete cascade,
  creator_id uuid not null references public.profiles (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (rater_id, creator_id),
  constraint creator_ratings_no_self check (rater_id <> creator_id)
);
create index creator_ratings_creator_idx on public.creator_ratings (creator_id);

alter table public.creator_ratings enable row level security;
create policy "Creator ratings are publicly readable"
  on public.creator_ratings for select to anon, authenticated using (true);
create policy "Users rate creators as themselves"
  on public.creator_ratings for insert to authenticated
  with check (rater_id = (select auth.uid()));
create policy "Users update their creator ratings"
  on public.creator_ratings for update to authenticated
  using (rater_id = (select auth.uid()))
  with check (rater_id = (select auth.uid()));
create policy "Users remove their creator ratings"
  on public.creator_ratings for delete to authenticated
  using (rater_id = (select auth.uid()));


-- =============================================================================
-- 12. Rating views
-- security_invoker = true: the views run with the caller's permissions, so
-- they only aggregate ratings the caller can already see.
-- =============================================================================

-- Per-sidequest averages. overall = mean of the four scores.
create view public.sidequest_rating_stats
with (security_invoker = true) as
select
  r.sidequest_id,
  count(*)::int                                   as rating_count,
  round(avg(r.price_rating), 2)                   as avg_price,
  round(avg(r.time_rating), 2)                    as avg_time,
  round(avg(r.enjoyment_rating), 2)               as avg_enjoyment,
  round(avg(r.memorability_rating), 2)            as avg_memorability,
  round(avg((r.price_rating + r.time_rating + r.enjoyment_rating + r.memorability_rating) / 4.0), 2)
                                                  as avg_overall
from public.sidequest_ratings r
group by r.sidequest_id;

-- Questgiver rating (PRD §5.1): average overall rating across everything a
-- user created, with the number of ratings.
create view public.questgiver_ratings
with (security_invoker = true) as
select
  s.creator_id,
  count(r.id)::int as rating_count,
  round(avg((r.price_rating + r.time_rating + r.enjoyment_rating + r.memorability_rating) / 4.0), 2)
                   as avg_overall
from public.sidequests s
join public.sidequest_ratings r on r.sidequest_id = s.id
group by s.creator_id;

grant select on public.sidequest_rating_stats to anon, authenticated;
grant select on public.questgiver_ratings     to anon, authenticated;


-- =============================================================================
-- Lock down new trigger functions
-- =============================================================================
revoke all on function private.user_sidequests_before_write() from public, anon, authenticated;
revoke all on function private.validate_rating()              from public, anon, authenticated;
