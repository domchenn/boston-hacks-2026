-- =============================================================================
-- Breadcrumb — 20261121120002_drop_tables_replaced_by_user_progress.sql
--
-- Removes the base-migration tables that PRD v3 replaces with single, simpler tables.
--
-- Dropped                      Replaced by
-- saved_sidequests       →     user_sidequests (status = 'saved')
-- sidequest_participants →     user_sidequests (status = 'signed_up')
-- completed_sidequests   →     user_sidequests (status = 'completed')
-- sidequest_reviews      →     sidequest_ratings (price/time/enjoyment/memorability)
-- community_members      →     profiles.community_id (one community per user)
--
-- Also removes the triggers that only existed for the participants table.
-- Safe: no app code reads these tables yet.
--
-- Runs after: 20261121120001_create_profiles_sidequests_and_stops.sql
-- Used by:    nothing (cleanup only)
--
-- Immutable once applied: make further changes in a new migration
-- (npx supabase migration new <name>).
-- =============================================================================

-- =============================================================================
-- Drop tables that PRD v3 replaces
-- =============================================================================
drop table if exists public.sidequest_reviews;       -- FK to completed_sidequests, drop first
drop table if exists public.completed_sidequests;
drop table if exists public.saved_sidequests;
drop table if exists public.sidequest_participants;
drop table if exists public.community_members;

drop trigger if exists sidequests_prevent_unscheduling on public.sidequests;
drop function if exists private.prevent_unscheduling_with_participants();
drop function if exists private.validate_participation();
