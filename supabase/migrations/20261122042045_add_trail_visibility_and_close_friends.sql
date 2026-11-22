-- =============================================================================
-- Breadcrumb — add_trail_visibility_and_close_friends
--
-- Friends and privacy:
--
-- 1. Friends = two people who follow each other (follows both ways). No follow
--    requests: following stays one tap, and privacy is decided by who follows back.
--
-- 2. profiles.is_private: a private account's trails (even "public" ones) are
--    only visible to its friends. The profile itself (name, avatar) stays
--    visible so people can still find and follow it. Users can change it on
--    their own profile (added to the profile column grants).
--
-- 3. sidequests.visibility: who can see a published trail.
--      'public'        everyone (unless the creator's account is private)
--      'friends'       the creator's friends
--      'close_friends' friends the creator put on their close friends list
--    Existing trails become 'public', so nothing disappears. Curated trails
--    (no creator) are always public.
--
-- 4. close_friends: each user's own list. Only the owner can read or change it
--    (people aren't told whether they're on someone's list), and only friends
--    can be added. Unfollowing someone also takes away close-friends access,
--    since access needs both the list entry and the mutual follow.
--
-- 5. Every read rule that decides "can I see this trail" now includes
--    visibility: the sidequests select policy and private.can_view_sidequest
--    (used by stops, crumbs, reviews, photos, progress, attendees, remixes,
--    friends_activity). friends_activity also hides private accounts' activity
--    from people who aren't their friends.
--
-- 6. save_trail() reads an optional "visibility" ('public' | 'friends' |
--    'close_friends'). Key absent = keep the current value (new trails: public).
--    Everything else is exactly as in add_trail_remixes.
--
-- Runs after: add_stop_to_trail_photos.
-- Used by: Make / Edit trail visibility picker, profile Private account switch
--          and Close friends list, Friends labels on profiles.
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1–3. Columns
-- -----------------------------------------------------------------------------
alter table public.profiles add column is_private boolean not null default false;
comment on column public.profiles.is_private is
  'Private account: its trails are only visible to friends (mutual follows).';
grant update (is_private) on public.profiles to authenticated;

alter table public.sidequests
  add column visibility text not null default 'public'
  check (visibility in ('public', 'friends', 'close_friends'));
comment on column public.sidequests.visibility is
  'Who can see the published trail: public, friends (mutual follows) or close_friends (the creator''s list).';


-- -----------------------------------------------------------------------------
-- 4. Close friends
-- -----------------------------------------------------------------------------
create table public.close_friends (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  constraint close_friends_no_self check (owner_id <> friend_id)
);
comment on table public.close_friends is
  'Each user''s close friends list, for close_friends trails. Private to its owner.';
create index close_friends_friend_idx on public.close_friends (friend_id);


-- -----------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can read follows / close_friends /
-- profiles without recursive RLS; they only answer yes/no).
-- -----------------------------------------------------------------------------

-- Friends: a follows b and b follows a.
create or replace function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_a is not null and p_b is not null and p_a <> p_b
    and exists (select 1 from public.follows f where f.follower_id = p_a and f.following_id = p_b)
    and exists (select 1 from public.follows f where f.follower_id = p_b and f.following_id = p_a);
$$;

-- Can the current user see a published trail by this creator with this visibility?
-- (Status and community are checked by the callers, as before.)
create or replace function private.can_see_trail_audience(p_creator uuid, p_visibility text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_creator is null then true  -- curated trails
    when p_creator = (select auth.uid()) then true
    when p_visibility = 'public' then
      not coalesce((select p.is_private from public.profiles p where p.id = p_creator), false)
      or private.are_friends(p_creator, (select auth.uid()))
    when p_visibility = 'friends' then private.are_friends(p_creator, (select auth.uid()))
    when p_visibility = 'close_friends' then
      private.are_friends(p_creator, (select auth.uid()))
      and exists (select 1 from public.close_friends c
                  where c.owner_id = p_creator and c.friend_id = (select auth.uid()))
    else false
  end;
$$;

revoke all on function private.are_friends(uuid, uuid) from public;
revoke all on function private.can_see_trail_audience(uuid, text) from public;
grant execute on function private.are_friends(uuid, uuid) to anon, authenticated;
grant execute on function private.can_see_trail_audience(uuid, text) to anon, authenticated;


-- -----------------------------------------------------------------------------
-- close_friends RLS: only the owner; only friends can be added.
-- -----------------------------------------------------------------------------
alter table public.close_friends enable row level security;
create policy "Users see their own close friends list"
  on public.close_friends for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "Users add friends to their own close friends list"
  on public.close_friends for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.are_friends(owner_id, friend_id)));
create policy "Users remove people from their own close friends list"
  on public.close_friends for delete to authenticated
  using (owner_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 5. Trail read rules, now with visibility
-- -----------------------------------------------------------------------------
drop policy "Visible sidequests are readable" on public.sidequests;
create policy "Visible sidequests are readable"
  on public.sidequests for select to anon, authenticated
  using (
    creator_id = (select auth.uid())
    or (status = 'published'
        and (community_id is null or (select private.in_community(community_id)))
        and (select private.can_see_trail_audience(creator_id, visibility)))
  );

-- Same as add_reports_and_admin_moderation, plus the audience check.
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
            and (s.community_id is null or private.in_community(s.community_id))
            and private.can_see_trail_audience(s.creator_id, s.visibility))
        or private.is_admin()
      )
  );
$$;

-- Same as add_friends_activity_function, plus: a private account's activity is
-- only shown to its friends.
create or replace function public.friends_activity(p_limit integer default 30)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  kind         text,
  sidequest_id uuid,
  happened_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with followed as (
    select f.following_id as user_id
    from public.follows f
    where f.follower_id = (select auth.uid())
  ),
  activity as (
    select s.creator_id as user_id, 'made'::text as kind, s.id as sidequest_id, s.created_at as happened_at
    from public.sidequests s
    join followed fo on fo.user_id = s.creator_id
    where s.status = 'published'
    union all
    select us.user_id, 'finished', us.sidequest_id, us.completed_at
    from public.user_sidequests us
    join followed fo on fo.user_id = us.user_id
    where us.status = 'completed'
    union all
    select us.user_id, 'joined', us.sidequest_id, us.updated_at
    from public.user_sidequests us
    join followed fo on fo.user_id = us.user_id
    where us.status = 'signed_up'
  )
  select a.user_id, p.username, p.display_name, p.avatar_url, a.kind, a.sidequest_id, a.happened_at
  from activity a
  join public.profiles p on p.id = a.user_id
  where (select private.can_view_sidequest(a.sidequest_id))
    and (not p.is_private or private.are_friends(a.user_id, (select auth.uid())))
  order by a.happened_at desc, a.sidequest_id, a.kind
  limit least(greatest(coalesce(p_limit, 30), 0), 100);
$$;


-- -----------------------------------------------------------------------------
-- 6. save_trail() with visibility
-- -----------------------------------------------------------------------------
create or replace function public.save_trail(p_trail jsonb, p_trail_id uuid default null)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := (select auth.uid());
  v_status   text := coalesce(p_trail ->> 'status', 'draft');
  v_title    text := nullif(btrim(coalesce(p_trail ->> 'title', '')), '');
  v_category text := nullif(p_trail ->> 'category', '');
  v_stops    jsonb := coalesce(p_trail -> 'stops', '[]'::jsonb);
  v_count    int;
  v_id       uuid;
  v_stop     jsonb;
  v_stop_id  uuid;
  v_crumb    text;
  v_index    int := 0;
  -- Who can see it: "community_id" in p_trail. Key absent = leave as is
  -- (new trails: everyone); null = everyone; an id = only that community.
  v_has_community boolean := p_trail ? 'community_id';
  v_community     uuid := nullif(p_trail ->> 'community_id', '')::uuid;
  v_my_community  uuid;
  v_old_community uuid;
  -- Remix (new trails only): "remixed_from" = the trail this one was copied from.
  -- Checked by the sidequests_check_remix trigger.
  v_remixed_from  uuid := nullif(p_trail ->> 'remixed_from', '')::uuid;
  -- Audience: "visibility" in p_trail. Key absent = leave as is (new trails: public).
  v_has_visibility boolean := p_trail ? 'visibility';
  v_visibility     text := coalesce(nullif(p_trail ->> 'visibility', ''), 'public');
begin
  if v_user is null then
    raise exception 'You need to be logged in to save a trail' using errcode = '42501';
  end if;
  if v_status not in ('draft', 'published') then
    raise exception 'Status must be draft or published' using errcode = '22023';
  end if;
  if v_visibility not in ('public', 'friends', 'close_friends') then
    raise exception 'Visibility must be public, friends or close_friends' using errcode = '22023';
  end if;
  if jsonb_typeof(v_stops) <> 'array' then
    raise exception 'stops must be a list' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(v_stops);

  if v_title is null then
    raise exception 'Give your trail a name' using errcode = '23514';
  end if;
  if v_count > 8 then
    raise exception 'A trail can have at most 8 stops' using errcode = '23514';
  end if;

  -- Publish checklist (drafts can be incomplete).
  if v_status = 'published' then
    if v_category is null then
      raise exception 'Pick a category before publishing' using errcode = '23514';
    end if;
    if v_count < 2 then
      raise exception 'Add at least 2 stops before publishing' using errcode = '23514';
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_stops) s
      where nullif(btrim(coalesce(s ->> 'crumb', '')), '') is null
    ) then
      raise exception 'Add a crumb at every stop before publishing' using errcode = '23514';
    end if;
  end if;

  -- A trail can only be limited to your own community. When editing, it may also
  -- keep the community it already has (e.g. after you switched communities).
  if v_has_community and v_community is not null then
    select p.community_id into v_my_community from public.profiles p where p.id = v_user;
    if p_trail_id is not null then
      select s.community_id into v_old_community
      from public.sidequests s where s.id = p_trail_id and s.creator_id = v_user;
    end if;
    if v_community is distinct from v_my_community and v_community is distinct from v_old_community then
      raise exception 'You can only share a trail with your own community' using errcode = '42501';
    end if;
  end if;

  if p_trail_id is null then
    insert into public.sidequests (
      creator_id, title, description, category, scheduled_at, status,
      estimated_cost, estimated_duration_minutes, neighborhood, community_id, remixed_from, visibility)
    values (
      v_user, v_title, nullif(p_trail ->> 'description', ''), v_category,
      nullif(p_trail ->> 'scheduled_at', '')::timestamptz, v_status,
      nullif(p_trail ->> 'estimated_cost', '')::numeric,
      nullif(p_trail ->> 'estimated_duration_minutes', '')::int,
      nullif(p_trail ->> 'neighborhood', ''),
      case when v_has_community then v_community end,
      v_remixed_from,
      v_visibility)
    returning id into v_id;
  else
    update public.sidequests set
      title = v_title,
      description = nullif(p_trail ->> 'description', ''),
      category = v_category,
      scheduled_at = nullif(p_trail ->> 'scheduled_at', '')::timestamptz,
      status = v_status,
      estimated_cost = nullif(p_trail ->> 'estimated_cost', '')::numeric,
      estimated_duration_minutes = nullif(p_trail ->> 'estimated_duration_minutes', '')::int,
      neighborhood = nullif(p_trail ->> 'neighborhood', ''),
      community_id = case when v_has_community then v_community else community_id end,
      visibility = case when v_has_visibility then v_visibility else visibility end
    where id = p_trail_id and creator_id = v_user
    returning id into v_id;

    if v_id is null then
      raise exception 'Trail not found, or it isn''t yours' using errcode = '42501';
    end if;

    -- Replace stops; their crumbs go with them (on delete cascade).
    delete from public.sidequest_stops where sidequest_id = v_id;
  end if;

  for v_stop in select value from jsonb_array_elements(v_stops)
  loop
    insert into public.sidequest_stops (
      sidequest_id, experience_id, place_name, address, latitude, longitude,
      stop_order, travel_mode_to_stop, estimated_cost)
    values (
      v_id,
      nullif(v_stop ->> 'experience_id', '')::uuid,
      v_stop ->> 'place_name',
      nullif(v_stop ->> 'address', ''),
      nullif(v_stop ->> 'latitude', '')::double precision,
      nullif(v_stop ->> 'longitude', '')::double precision,
      v_index,
      case when v_index = 0 then null else nullif(v_stop ->> 'travel_mode_to_stop', '') end,
      nullif(v_stop ->> 'estimated_cost', '')::numeric)
    returning id into v_stop_id;

    v_crumb := nullif(btrim(coalesce(v_stop ->> 'crumb', '')), '');
    if v_crumb is not null then
      insert into public.checklist_items (sidequest_id, stop_id, label, item_type, item_order)
      values (v_id, v_stop_id, v_crumb, 'do', v_index);
    end if;

    v_index := v_index + 1;
  end loop;

  return v_id;
end;
$$;

comment on function public.save_trail(jsonb, uuid) is
  'Make a trail: create or update a trail with its stops and crumbs in one transaction, optionally limited to the creator''s community or audience (visibility) and credited as a remix. See migrations add_save_trail_function, add_community_to_save_trail, add_trail_remixes and add_trail_visibility_and_close_friends.';

revoke all on function public.save_trail(jsonb, uuid) from public, anon;
grant execute on function public.save_trail(jsonb, uuid) to authenticated;
