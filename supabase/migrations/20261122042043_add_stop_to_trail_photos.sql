-- =============================================================================
-- Breadcrumb — add_stop_to_trail_photos
--
-- Photos attached to a place: on Active trail each stop gets a photo button that
-- opens the phone's photo library, and the photo is shown under that stop.
--
-- - quest_photos.stop_id: the stop the photo was taken at (optional; null = a
--   photo of the trail in general, like every photo before this migration).
--   Set null if the stop is removed (editing a trail replaces its stops).
-- - A trigger checks the stop belongs to the same trail as the photo, so a
--   photo can't be pinned to some other trail's stop. RLS on quest_photos is
--   unchanged (owner inserts while they've started / saved / finished the trail).
--
-- Runs after: add_reports_and_admin_moderation.
-- Used by: Active trail stop photos (src/lib/api/photos.ts addTrailPhoto).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

alter table public.quest_photos
  add column stop_id uuid references public.sidequest_stops (id) on delete set null;
comment on column public.quest_photos.stop_id is
  'The stop this photo was taken at, if any. Must be a stop of the same trail.';
create index quest_photos_stop_idx on public.quest_photos (stop_id) where stop_id is not null;

create or replace function private.check_photo_stop()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stop_id is not null and not exists (
    select 1 from public.sidequest_stops st
    where st.id = new.stop_id and st.sidequest_id = new.sidequest_id
  ) then
    raise exception 'That stop isn''t on this trail' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_photo_stop() from public, anon, authenticated;

create trigger quest_photos_check_stop
  before insert or update of stop_id, sidequest_id on public.quest_photos
  for each row execute function private.check_photo_stop();
