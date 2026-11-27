-- Drop profiles.university: it was a hackathon-only field.
--
-- Product decision (2026-11-26): the app no longer asks for or shows a university,
-- and the values already saved are deleted with the column. Nothing else depends on
-- it: no function, view or policy reads it, and Postgres removes its column-level
-- update grant (from add_reports_and_admin_moderation) along with the column.
-- communities.university is a different column and stays.
--
-- Order matters: the website and API must stop reading profiles.university before
-- this runs (PR #134), or profile pages would fail. Back up production first; this
-- deletes data.
--
-- Runs after 20261121120001_create_profiles_and_communities (which created the
-- column) and 20261122022417_seed_demo_activity_and_fix_coordinates (which filled it
-- for the demo profiles).

alter table public.profiles drop column university;
