-- =============================================================================
-- Breadcrumb — add_trail_photos_storage
--
-- File storage for trail photos (PRD §5.4): a Supabase Storage bucket and the
-- rules for it. The photo *records* already exist:
--   - checklist_completions.photo_url : proof photo on a ticked crumb
--   - quest_photos                    : public photos from an outing
--
-- - Bucket `trail-photos`: public read (photos are shown on trails), 5 MB max,
--   JPEG / PNG / WebP / HEIC only.
-- - Each user uploads only into a folder named after their own user id
--   (`<user id>/...`), and can only replace or delete files in that folder.
-- - Visitors can view photos (public bucket) but never upload.
--
-- Runs after: seed_researched_places_and_chinatown_tour.
-- Used by: src/lib/api/photos.ts (Active trail camera buttons, trail photos).
-- Immutable once applied: make changes in a new migration (npm run db:new).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trail-photos', 'trail-photos', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Folder rule shared by the write policies: the first path segment is the
-- uploader's own user id, e.g. "3f2c…/trails/<trail id>/1700000000.jpg".
create policy "Trail photos are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'trail-photos');

create policy "Users upload trail photos into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'trail-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users replace their own trail photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'trail-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'trail-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users delete their own trail photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'trail-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
