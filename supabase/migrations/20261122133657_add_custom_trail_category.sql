-- =============================================================================
-- Breadcrumb — add_custom_trail_category
--
-- Lets a creator type their own category ("Rooftops", "Study spots") instead of
-- picking one of the six. Stored as category = 'other' plus custom_category (the
-- typed name, 1–30 characters), so filters keep working: Explore's category
-- filter gets "Other", and cards show the typed name.
--
-- - sidequests.category also allows 'other' (places in experiences don't).
-- - sidequests.custom_category: only kept when category = 'other'.
-- - save_trail(): reads "custom_category" from the JSON; publishing with 'other'
--   needs a name. Everything else is unchanged from add_trail_visibility_and_close_friends.
--
-- Runs after: seed_more_researched_trails.
-- Used by: Make / Edit a trail (Custom category), TrailCard, Trail detail, Explore filters.
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

alter table public.sidequests drop constraint sidequests_category_check;
alter table public.sidequests add constraint sidequests_category_check check (category in
  ('food_drink', 'outdoors', 'arts_culture', 'shopping', 'attractions', 'affordable', 'other'));

alter table public.sidequests
  add column custom_category text
    check (char_length(custom_category) between 1 and 30),
  add constraint sidequests_custom_category_only_other
    check (custom_category is null or category = 'other');

comment on column public.sidequests.custom_category is
  'The creator''s own category name, shown instead of "Other" when category = ''other''.';

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
  -- Your own category name when category = 'other' (ignored otherwise).
  v_custom   text := nullif(btrim(coalesce(p_trail ->> 'custom_category', '')), '');
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
  if v_category is distinct from 'other' then
    v_custom := null;
  elsif v_custom is not null and char_length(v_custom) > 30 then
    raise exception 'Keep your category to 30 characters' using errcode = '23514';
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

  -- Publish checklist (drafts can be incomplete). Crumbs are optional.
  if v_status = 'published' then
    if v_category is null then
      raise exception 'Pick a category before publishing' using errcode = '23514';
    end if;
    if v_category = 'other' and v_custom is null then
      raise exception 'Type your own category before publishing' using errcode = '23514';
    end if;
    if v_count < 2 then
      raise exception 'Add at least 2 stops before publishing' using errcode = '23514';
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
      creator_id, title, description, category, custom_category, scheduled_at, status,
      estimated_cost, estimated_duration_minutes, neighborhood, community_id, remixed_from, visibility)
    values (
      v_user, v_title, nullif(p_trail ->> 'description', ''), v_category, v_custom,
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
      custom_category = v_custom,
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
  'Make a trail: create or update a trail with its stops and crumbs in one transaction, optionally limited to the creator''s community or audience (visibility), credited as a remix, and with your own category name (category ''other'' + custom_category). See migrations add_save_trail_function, add_community_to_save_trail, add_trail_remixes, add_trail_visibility_and_close_friends and add_custom_trail_category.';

revoke all on function public.save_trail(jsonb, uuid) from public, anon;
grant execute on function public.save_trail(jsonb, uuid) to authenticated;
