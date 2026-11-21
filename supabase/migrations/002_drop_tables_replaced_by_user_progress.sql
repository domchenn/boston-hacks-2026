-- =============================================================================
-- Breadcrumb — 002_drop_tables_replaced_by_user_progress.sql
--
-- Removes the 001 tables that PRD v3 replaces with single, simpler tables.
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
-- Runs after: 001
-- Used by:    nothing (cleanup only)
--
-- Immutable once applied to the shared project: change things in a new file.
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
