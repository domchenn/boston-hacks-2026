-- =============================================================================
-- Sidequests — 001_initial_schema.sql
--
-- Initial schema, constraints, indexes, triggers and Row Level Security.
-- Paste into the Supabase SQL Editor of a FRESH project and run once.
--
-- Treat this file as immutable once applied. Make any later change in a new
-- migration (002_..., 003_...). Never edit this file and re-run it.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Private schema for helper functions.
-- The Data API only exposes `public` (by default), so functions here can't be
-- called as RPCs by clients. RLS policies can still call them.
-- -----------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to anon, authenticated;


-- =============================================================================
-- TABLES
-- =============================================================================

-- profiles: one row per auth user, created automatically by a trigger on signup.
-- username is nullable so the profile can exist before the user picks one.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text unique
               check (username ~ '^[a-z0-9_]{3,30}$'),   -- lowercase, 3–30 chars
  display_name text check (char_length(display_name) <= 80),
  avatar_url   text,
  bio          text check (char_length(bio) <= 500),
  university   text check (char_length(university) <= 120),
  created_at   timestamptz not null default now()
);
comment on column public.profiles.username is
  'Null until the user chooses one during onboarding. Lowercase [a-z0-9_], 3–30 chars.';

-- sidequests: an itinerary. scheduled_at NULL = "anytime" (save & follow);
-- scheduled_at set = a scheduled outing that others can join.
create table public.sidequests (
  id                         uuid primary key default gen_random_uuid(),
  creator_id                 uuid not null references public.profiles (id) on delete cascade,
  title                      text not null check (char_length(title) between 1 and 120),
  description                text check (char_length(description) <= 5000),
  cover_image_url            text,
  category                   text check (char_length(category) <= 50),
  estimated_cost             numeric(10, 2) check (estimated_cost >= 0),
  estimated_duration_minutes integer check (estimated_duration_minutes > 0
                                            and estimated_duration_minutes <= 10080), -- ≤ 1 week
  neighborhood               text check (char_length(neighborhood) <= 80),
  scheduled_at               timestamptz,
  status                     text not null default 'draft'
                             check (status in ('draft', 'published', 'archived')),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
comment on column public.sidequests.status is
  'draft = visible to creator only; published = public; archived = visible to creator only (soft removal, keeps reviews/history).';
comment on column public.sidequests.scheduled_at is
  'NULL for anytime sidequests (cannot be joined). Set for scheduled outings.';

-- sidequest_stops: ordered stops in a sidequest.
create table public.sidequest_stops (
  id             uuid primary key default gen_random_uuid(),
  sidequest_id   uuid not null references public.sidequests (id) on delete cascade,
  place_name     text not null check (char_length(place_name) between 1 and 200),
  address        text check (char_length(address) <= 300),
  latitude       double precision check (latitude between -90 and 90),
  longitude      double precision check (longitude between -180 and 180),
  stop_order     integer not null check (stop_order >= 0),
  description    text check (char_length(description) <= 2000),
  estimated_cost numeric(10, 2) check (estimated_cost >= 0),
  created_at     timestamptz not null default now(),
  -- Both coordinates or neither.
  constraint sidequest_stops_coords_pair check ((latitude is null) = (longitude is null)),
  -- Deferrable so a client can reorder stops (swap orders) in a single transaction.
  constraint sidequest_stops_order_unique unique (sidequest_id, stop_order)
    deferrable initially deferred
);

-- saved_sidequests: private bookmarks.
create table public.saved_sidequests (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, sidequest_id)
);

-- sidequest_participants: people joining a SCHEDULED sidequest.
-- To leave, delete the row. The trigger below rejects anytime sidequests.
create table public.sidequest_participants (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  status       text not null default 'going'
               check (status in ('going', 'interested')),
  joined_at    timestamptz not null default now(),
  unique (user_id, sidequest_id)
);

-- completed_sidequests: a user marks a sidequest done.
create table public.completed_sidequests (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, sidequest_id)
);

-- sidequest_reviews: one review per user per sidequest.
-- The composite FK to completed_sidequests makes the database itself enforce
-- "you can only review what you've completed". Un-completing removes the review.
create table public.sidequest_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  sidequest_id  uuid not null,
  fun_rating    smallint not null check (fun_rating between 1 and 5),
  value_rating  smallint not null check (value_rating between 1 and 5),
  travel_rating smallint not null check (travel_rating between 1 and 5),
  review_text   text check (char_length(review_text) <= 2000),
  created_at    timestamptz not null default now(),
  unique (user_id, sidequest_id),
  constraint sidequest_reviews_requires_completion
    foreign key (user_id, sidequest_id)
    references public.completed_sidequests (user_id, sidequest_id)
    on delete cascade
);

-- ---- Stretch: social graph & communities -----------------------------------

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  university  text check (char_length(university) <= 120),
  description text check (char_length(description) <= 2000),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on column public.communities.created_by is
  'Creator, who may edit/delete the community. Becomes NULL if their account is deleted.';

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);


-- =============================================================================
-- INDEXES (PK/UNIQUE constraints already create indexes on their leading cols)
-- =============================================================================
create index sidequests_feed_idx        on public.sidequests (created_at desc) where status = 'published';
create index sidequests_creator_idx     on public.sidequests (creator_id);
create index sidequests_scheduled_idx   on public.sidequests (scheduled_at) where scheduled_at is not null and status = 'published';
create index sidequests_category_idx    on public.sidequests (category);
create index sidequests_neighborhood_idx on public.sidequests (neighborhood);
create index saved_sidequests_sq_idx    on public.saved_sidequests (sidequest_id);
create index participants_sq_idx        on public.sidequest_participants (sidequest_id);
create index completed_sq_idx           on public.completed_sidequests (sidequest_id);
create index reviews_sq_idx             on public.sidequest_reviews (sidequest_id);
create index follows_following_idx      on public.follows (following_id);
create index community_members_user_idx on public.community_members (user_id);
create index communities_university_idx on public.communities (university);


-- =============================================================================
-- HELPER FUNCTIONS (used by RLS)
--
-- SECURITY DEFINER lets these read `sidequests` without going through RLS
-- again. That keeps the policies on child tables simple and non-recursive.
-- They return only a boolean about the CURRENT user, so nothing leaks.
-- search_path is pinned to '' and every name is schema-qualified.
-- =============================================================================

-- Can the current user see this sidequest? (published, or they created it)
create function private.can_view_sidequest(p_sidequest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sidequests s
    where s.id = p_sidequest_id
      and (s.status = 'published' or s.creator_id = (select auth.uid()))
  );
$$;

-- Does the current user own this sidequest?
create function private.owns_sidequest(p_sidequest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sidequests s
    where s.id = p_sidequest_id
      and s.creator_id = (select auth.uid())
  );
$$;

revoke all on function private.can_view_sidequest(uuid) from public;
revoke all on function private.owns_sidequest(uuid)     from public;
grant execute on function private.can_view_sidequest(uuid) to anon, authenticated;
grant execute on function private.owns_sidequest(uuid)     to anon, authenticated;


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Keep sidequests.updated_at current on every update.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger sidequests_set_updated_at
  before update on public.sidequests
  for each row execute function private.set_updated_at();

-- Create a profile automatically when someone signs up through Supabase Auth.
-- username stays NULL (chosen later in onboarding), so a username can never
-- collide here and make signup fail. display_name falls back through common
-- OAuth metadata keys.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ), 80),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Joining requires a published, scheduled sidequest. This runs on every write
-- to participants, so it holds no matter which role does the insert.
create function private.validate_participation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scheduled_at timestamptz;
  v_status text;
begin
  select s.scheduled_at, s.status into v_scheduled_at, v_status
  from public.sidequests s
  where s.id = new.sidequest_id;

  if v_scheduled_at is null then
    raise exception 'Cannot join an anytime sidequest (scheduled_at is NULL)'
      using errcode = 'check_violation';
  end if;
  if v_status <> 'published' then
    raise exception 'Cannot join a sidequest that is not published'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sidequest_participants_validate
  before insert or update of sidequest_id on public.sidequest_participants
  for each row execute function private.validate_participation();

-- A sidequest with participants can't be switched to "anytime". Archive it
-- instead, or delete the participant rows first.
create function private.prevent_unscheduling_with_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.scheduled_at is not null and new.scheduled_at is null
     and exists (select 1 from public.sidequest_participants p where p.sidequest_id = new.id) then
    raise exception 'Cannot clear scheduled_at while the sidequest has participants'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger sidequests_prevent_unscheduling
  before update of scheduled_at on public.sidequests
  for each row execute function private.prevent_unscheduling_with_participants();

-- Trigger functions should never be called directly.
revoke all on function private.set_updated_at()                          from public, anon, authenticated;
revoke all on function private.handle_new_user()                         from public, anon, authenticated;
revoke all on function private.validate_participation()                  from public, anon, authenticated;
revoke all on function private.prevent_unscheduling_with_participants()  from public, anon, authenticated;


-- =============================================================================
-- ROW LEVEL SECURITY
-- RLS is on for every table. With no matching policy, access is denied.
-- `(select auth.uid())` is evaluated once per statement (Supabase perf advice).
--
-- Deletion behavior: when a creator hard-deletes a sidequest, its stops,
-- saves, participants, completions and reviews cascade away. Use
-- status = 'archived' to hide a sidequest but keep that history.
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.sidequests             enable row level security;
alter table public.sidequest_stops        enable row level security;
alter table public.saved_sidequests       enable row level security;
alter table public.sidequest_participants enable row level security;
alter table public.completed_sidequests   enable row level security;
alter table public.sidequest_reviews      enable row level security;
alter table public.follows                enable row level security;
alter table public.communities            enable row level security;
alter table public.community_members      enable row level security;

-- ---- profiles ---------------------------------------------------------------
-- Public read. Only the signup trigger inserts. Users update only themselves.
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---- sidequests -------------------------------------------------------------
-- Anyone can see published ones. Creators also see their own drafts/archived.
create policy "Published sidequests are readable; creators see their own"
  on public.sidequests for select
  to anon, authenticated
  using (status = 'published' or creator_id = (select auth.uid()));

create policy "Users can create sidequests as themselves"
  on public.sidequests for insert
  to authenticated
  with check (creator_id = (select auth.uid()));

-- with check also stops a creator from handing ownership to someone else.
create policy "Creators can update their own sidequests"
  on public.sidequests for update
  to authenticated
  using (creator_id = (select auth.uid()))
  with check (creator_id = (select auth.uid()));

create policy "Creators can delete their own sidequests"
  on public.sidequests for delete
  to authenticated
  using (creator_id = (select auth.uid()));

-- ---- sidequest_stops --------------------------------------------------------
-- Stops have the same visibility and ownership as their parent sidequest.
create policy "Stops visible when parent sidequest is visible"
  on public.sidequest_stops for select
  to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));

create policy "Creators can add stops to their sidequests"
  on public.sidequest_stops for insert
  to authenticated
  with check ((select private.owns_sidequest(sidequest_id)));

-- with check stops a stop from being moved into someone else's sidequest.
create policy "Creators can update stops on their sidequests"
  on public.sidequest_stops for update
  to authenticated
  using ((select private.owns_sidequest(sidequest_id)))
  with check ((select private.owns_sidequest(sidequest_id)));

create policy "Creators can delete stops on their sidequests"
  on public.sidequest_stops for delete
  to authenticated
  using ((select private.owns_sidequest(sidequest_id)));

-- ---- saved_sidequests (private to the user) ---------------------------------
create policy "Users can read their own saves"
  on public.saved_sidequests for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can save visible sidequests"
  on public.saved_sidequests for insert
  to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_view_sidequest(sidequest_id)));

create policy "Users can unsave their own saves"
  on public.saved_sidequests for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- sidequest_participants -------------------------------------------------
-- Attendee lists are public for visible sidequests. Users join, change their
-- status, or leave only for themselves. The trigger enforces "scheduled only".
create policy "Participants visible when sidequest is visible"
  on public.sidequest_participants for select
  to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));

create policy "Users can join as themselves"
  on public.sidequest_participants for insert
  to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_view_sidequest(sidequest_id)));

create policy "Users can update their own participation"
  on public.sidequest_participants for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can leave (delete their own participation)"
  on public.sidequest_participants for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- completed_sidequests ---------------------------------------------------
-- Public for visible sidequests (for "N people completed this" and profile
-- stats). Users manage only their own rows.
create policy "Completions visible when sidequest is visible"
  on public.completed_sidequests for select
  to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));

create policy "Users can mark visible sidequests completed"
  on public.completed_sidequests for insert
  to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_view_sidequest(sidequest_id)));

create policy "Users can remove their own completions"
  on public.completed_sidequests for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- sidequest_reviews ------------------------------------------------------
-- The composite FK already requires a completion row, and users can only
-- insert completions for themselves, so "review only what you've completed"
-- holds without an extra subquery.
create policy "Reviews visible when sidequest is visible"
  on public.sidequest_reviews for select
  to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));

create policy "Users can review as themselves"
  on public.sidequest_reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can edit their own reviews"
  on public.sidequest_reviews for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own reviews"
  on public.sidequest_reviews for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---- follows ----------------------------------------------------------------
create policy "Follows are publicly readable"
  on public.follows for select
  to anon, authenticated
  using (true);

create policy "Users can follow on their own behalf"
  on public.follows for insert
  to authenticated
  with check (follower_id = (select auth.uid()));

create policy "Users can unfollow on their own behalf"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

-- ---- communities ------------------------------------------------------------
create policy "Communities are publicly readable"
  on public.communities for select
  to anon, authenticated
  using (true);

create policy "Users can create communities as themselves"
  on public.communities for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "Creators can update their communities"
  on public.communities for update
  to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Creators can delete their communities"
  on public.communities for delete
  to authenticated
  using (created_by = (select auth.uid()));

-- ---- community_members ------------------------------------------------------
create policy "Community memberships are publicly readable"
  on public.community_members for select
  to anon, authenticated
  using (true);

create policy "Users can join communities on their own behalf"
  on public.community_members for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can leave communities on their own behalf"
  on public.community_members for delete
  to authenticated
  using (user_id = (select auth.uid()));
