-- Stop anyone from listing the trail-photos bucket.
--
-- Before: the select policy on storage.objects let anon and every signed-in user
-- read all rows of the bucket, so anyone could list every file, including the
-- user-id folder names and photos from friends-only trails, without seeing a trail.
-- Standard practice: nobody can browse the list; you only get a photo through its
-- link (privacy decision 2026-11-26).
--
-- After: you can read the storage rows of your own files only. Storage needs that
-- to delete or replace a file, so the app's "delete my photo" keeps working. The
-- bucket stays public, so photo links (/storage/v1/object/public/…) keep working
-- for everyone; public URLs don't go through these policies. Making non-public
-- photos private comes later.
--
-- Runs after 20261122014142_add_trail_photos_storage (which created the bucket and
-- the policy replaced here). Used by: the web's lib/api/photos.ts and the API's
-- photos module (both remove only the caller's own files).

drop policy "Trail photos are publicly readable" on storage.objects;

create policy "Users read their own trail photo files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'trail-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
