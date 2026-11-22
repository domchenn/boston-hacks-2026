-- =============================================================================
-- Breadcrumb — add_friends_also_saved_function
--
-- "You both saved this": trails you've saved that a friend has saved too, so you
-- can go together. Saves are private progress (user_sidequests: only you can
-- read your rows), so this is a SECURITY DEFINER function with tight limits:
--
-- - Only for the CALLER's saved trails (status 'saved').
-- - Only friends: people the caller follows who follow them back
--   (private.are_friends). Followers who aren't friends never show up.
-- - A friend appears only on trails BOTH of you saved, so nobody sees a friend's
--   saves beyond what they've saved themselves.
-- - Only trails the caller can see (private.can_view_sidequest).
-- - Public profile fields only (username, display name, avatar).
--
-- friends_also_saved() → one row per (trail, friend), newest save first.
--
-- Runs after: add_trending_trails_function.
-- Used by: Saved page ("Also saved by …") and Explore → Friends ("You both saved").
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

create or replace function public.friends_also_saved()
returns table (
  sidequest_id uuid,
  friend_id    uuid,
  username     text,
  display_name text,
  avatar_url   text,
  saved_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select mine.sidequest_id, theirs.user_id, p.username, p.display_name, p.avatar_url, theirs.updated_at
  from public.user_sidequests mine
  join public.user_sidequests theirs
    on theirs.sidequest_id = mine.sidequest_id
   and theirs.user_id <> mine.user_id
   and theirs.status = 'saved'
  join public.profiles p on p.id = theirs.user_id
  where mine.user_id = (select auth.uid())
    and mine.status = 'saved'
    and private.are_friends(mine.user_id, theirs.user_id)
    and (select private.can_view_sidequest(mine.sidequest_id))
  order by theirs.updated_at desc
  limit 200;
$$;

comment on function public.friends_also_saved() is
  'Trails the caller saved that a friend (mutual follow) also saved, with the friend''s public profile fields. Only shared saves, never a friend''s other saves.';

revoke all on function public.friends_also_saved() from public;
revoke all on function public.friends_also_saved() from anon;
grant execute on function public.friends_also_saved() to authenticated;
