-- =============================================================================
-- Breadcrumb — add_community_to_save_trail
--
-- Lets Make a trail / Edit trail choose who can see a trail: everyone, or only
-- the creator's community (BU / BC). save_trail() now reads an optional
-- "community_id" from p_trail:
--
-- - key absent       → unchanged: new trails are for everyone, edits keep the
--                      trail's current setting (so older callers behave as before)
-- - null             → everyone
-- - a community id   → only members of that community (and the creator) see it.
--                      Must be the caller's own community (profiles.community_id),
--                      or, when editing, the community the trail already has.
--                      Otherwise: 42501 "You can only share a trail with your own
--                      community".
--
-- Visibility itself is unchanged: RLS on sidequests already hides
-- community-only trails from non-members (private.in_community).
-- Everything else in save_trail() is exactly as in add_save_trail_function.
--
-- Runs after: add_save_trail_function.
-- Used by: Make a trail + Edit trail "Who can see this" (task G6).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

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
begin
  if v_user is null then
    raise exception 'You need to be logged in to save a trail' using errcode = '42501';
  end if;
  if v_status not in ('draft', 'published') then
    raise exception 'Status must be draft or published' using errcode = '22023';
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
      estimated_cost, estimated_duration_minutes, neighborhood, community_id)
    values (
      v_user, v_title, nullif(p_trail ->> 'description', ''), v_category,
      nullif(p_trail ->> 'scheduled_at', '')::timestamptz, v_status,
      nullif(p_trail ->> 'estimated_cost', '')::numeric,
      nullif(p_trail ->> 'estimated_duration_minutes', '')::int,
      nullif(p_trail ->> 'neighborhood', ''),
      case when v_has_community then v_community end)
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
      community_id = case when v_has_community then v_community else community_id end
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
  'Make a trail: create or update a trail with its stops and crumbs in one transaction, optionally limited to the creator''s community. See migrations add_save_trail_function and add_community_to_save_trail.';

revoke all on function public.save_trail(jsonb, uuid) from public, anon;
grant execute on function public.save_trail(jsonb, uuid) to authenticated;
