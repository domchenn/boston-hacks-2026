-- =============================================================================
-- Breadcrumb — add_trail_attendees_functions
--
-- Who's going on a scheduled trail, without exposing anyone's private progress.
-- user_sidequests rows are only readable by their owner (RLS), so the "6 going"
-- count and the avatar row on Trail detail need SECURITY DEFINER functions that
-- return ONLY:
--   - how many people have status 'signed_up' on a trail, and
--   - those people's public profile fields (the same ones profiles already
--     exposes to everyone: id, username, display_name, avatar_url).
-- Nothing else about anyone's progress (saved, started, finished…) comes back.
--
-- Both functions answer only for trails the caller is allowed to see
-- (private.can_view_sidequest: published + their community, or their own), so a
-- draft or community-only trail's attendees stay hidden from everyone else.
--
-- - trail_attendees(p_trail_id, p_limit): the first p_limit people going (oldest
--   sign-up first), each row carrying the total going_count. No rows = nobody.
-- - trail_going_counts(p_trail_ids): going_count per trail, for feed cards.
--   Trails with nobody going are left out (treat as 0).
--
-- Runs after: create_quest_progress_and_checklists (user_sidequests).
-- Used by: Trail detail ("6 going" + avatars), Explore / Saved cards (task G5).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

create or replace function public.trail_attendees(p_trail_id uuid, p_limit integer default 12)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  going_count  integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    (count(*) over ())::integer      -- total going, computed before the limit
  from public.user_sidequests us
  join public.profiles p on p.id = us.user_id
  where us.sidequest_id = p_trail_id
    and us.status = 'signed_up'
    and (select private.can_view_sidequest(p_trail_id))
  order by us.updated_at, p.id
  limit least(greatest(coalesce(p_limit, 12), 0), 50);
$$;

comment on function public.trail_attendees(uuid, integer) is
  'People signed up for a trail the caller can see: public profile fields + total going_count on each row. Max 50 rows.';

create or replace function public.trail_going_counts(p_trail_ids uuid[])
returns table (sidequest_id uuid, going_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select us.sidequest_id, count(*)::integer
  from public.user_sidequests us
  where us.sidequest_id = any (p_trail_ids)
    and us.status = 'signed_up'
    and (select private.can_view_sidequest(us.sidequest_id))
  group by us.sidequest_id;
$$;

comment on function public.trail_going_counts(uuid[]) is
  'How many people are signed up for each given trail the caller can see. Trails with nobody going are omitted.';

-- Anyone who can see a trail (including logged-out visitors on public trails)
-- can see how many are going and who.
revoke all on function public.trail_attendees(uuid, integer) from public;
revoke all on function public.trail_going_counts(uuid[])      from public;
grant execute on function public.trail_attendees(uuid, integer) to anon, authenticated;
grant execute on function public.trail_going_counts(uuid[])      to anon, authenticated;
