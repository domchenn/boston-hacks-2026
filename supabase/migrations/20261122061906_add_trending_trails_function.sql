-- =============================================================================
-- Breadcrumb — add_trending_trails_function
--
-- Explore's "Trending" tab: trails with the most activity lately. Most of that
-- activity is private progress (user_sidequests: only you can read your rows),
-- so this SECURITY DEFINER function returns per-trail totals only: never who.
--
-- trending_trails(p_days default 14, p_limit default 30) → sidequest_id, score,
-- people. Counted over the last p_days, for published trails the caller can see
-- (private.can_view_sidequest, so visibility / private accounts are respected),
-- ignoring the creator's own activity so nobody can trend their own trail:
--   finished (completed_at)            3 points
--   started (started_at)               2 points
--   signed up for a dated trail        2 points
--   rated / reviewed (created_at)      2 points
--   saved                              1 point
--   added a photo                      1 point
-- `people` is how many different people did any of that. Highest score first,
-- ties broken by more people, then the newer trail. Trails with no activity are
-- left out (the app shows an empty state instead of padding the list).
--
-- Runs after: add_trail_visibility_and_close_friends.
-- Used by: Explore Trending tab (src/features/explore/TrendingPanel.tsx).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

create or replace function public.trending_trails(p_days integer default 14, p_limit integer default 30)
returns table (
  sidequest_id uuid,
  score        integer,
  people       integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90)) as at
  ),
  activity as (
    select us.sidequest_id, us.user_id, 3 as points
    from public.user_sidequests us, since
    where us.completed_at >= since.at
    union all
    select us.sidequest_id, us.user_id, 2
    from public.user_sidequests us, since
    where us.started_at >= since.at
    union all
    select us.sidequest_id, us.user_id, 2
    from public.user_sidequests us, since
    where us.status = 'signed_up' and us.updated_at >= since.at
    union all
    select us.sidequest_id, us.user_id, 1
    from public.user_sidequests us, since
    where us.status = 'saved' and us.updated_at >= since.at
    union all
    select r.sidequest_id, r.user_id, 2
    from public.sidequest_ratings r, since
    where r.created_at >= since.at
    union all
    select p.sidequest_id, p.user_id, 1
    from public.quest_photos p, since
    where p.created_at >= since.at
  )
  select a.sidequest_id, sum(a.points)::integer as score, count(distinct a.user_id)::integer as people
  from activity a
  join public.sidequests s on s.id = a.sidequest_id
  where s.status = 'published'
    and a.user_id is distinct from s.creator_id
    and (select private.can_view_sidequest(s.id))
  group by a.sidequest_id, s.created_at
  order by score desc, people desc, s.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 0), 100);
$$;

comment on function public.trending_trails(integer, integer) is
  'Explore Trending: visible published trails ranked by recent activity (finishes, starts, sign-ups, ratings, saves, photos) over the last p_days, excluding the creator''s own. Totals only, never who.';

-- Explore is for signed-in users. (Supabase grants new functions to anon
-- directly, so revoking from public alone isn't enough.)
revoke all on function public.trending_trails(integer, integer) from public;
revoke all on function public.trending_trails(integer, integer) from anon;
grant execute on function public.trending_trails(integer, integer) to authenticated;
