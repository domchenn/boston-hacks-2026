-- =============================================================================
-- Breadcrumb — add_friends_activity_function
--
-- What the people you follow have been up to, for the Explore "Friends" tab and
-- the "Friends' activity" list on the You page (task J7).
--
-- Making a trail is already public (published sidequests), but finishing or
-- joining one lives in user_sidequests, which only its owner can read (RLS). So
-- this SECURITY DEFINER function returns, for the CALLER's follows only:
--   - 'made'      a published trail they created        (sidequests.created_at)
--   - 'finished'  a trail they completed                 (user_sidequests.completed_at)
--   - 'joined'    a scheduled trail they signed up for   (user_sidequests.updated_at)
-- and nothing else about their progress (saved, in progress, aborted stay private).
-- Each row carries only the public profile fields profiles already exposes to
-- everyone (id, username, display_name, avatar_url).
--
-- Only trails the caller may see are included (private.can_view_sidequest:
-- published + their community, or their own), so drafts and other communities'
-- trails never leak. Logged-out visitors can't call it (they follow no one).
--
-- Note: follows are one-way and need no approval, so anyone who follows you can
-- see the trails you finish. "Joined" was already public via trail_attendees.
--
-- - friends_activity(p_limit default 30, max 100): newest first.
--
-- Runs after: create_quest_progress_and_checklists, add_trail_attendees_functions.
-- Used by: Explore Friends tab, You page Friends' activity (task J7).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

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
  order by a.happened_at desc, a.sidequest_id, a.kind
  limit least(greatest(coalesce(p_limit, 30), 0), 100);
$$;

comment on function public.friends_activity(integer) is
  'Recent made / finished / joined trails of the people the caller follows, for trails the caller can see. Public profile fields only. Newest first, max 100 rows.';

-- Only signed-in users follow people, so only they can ask. (Supabase grants new
-- functions to anon directly, so revoking from public alone isn't enough.)
revoke all on function public.friends_activity(integer) from public;
revoke all on function public.friends_activity(integer) from anon;
grant execute on function public.friends_activity(integer) to authenticated;
