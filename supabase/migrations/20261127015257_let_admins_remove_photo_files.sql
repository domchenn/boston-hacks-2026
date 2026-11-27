-- Let moderators remove the file of a photo they take down.
--
-- Before: an admin hiding a reported photo could delete its quest_photos row
-- (add_reports_and_admin_moderation) but not its file, because the storage
-- policies only let uploaders read and delete their own files. The file stayed
-- reachable at its link. Standard practice (privacy decision 2026-11-26): removing
-- a photo removes the file.
--
-- After: admins (private.is_admin()) can also read the storage rows of the
-- trail-photos bucket and delete files in it. Storage needs both to delete a file.
-- Nobody else gains anything: visitors still list nothing, and users still see
-- and delete only their own files.
--
-- Runs after 20261127011845_stop_public_photo_listing (which made reads
-- owner-only). Used by: the API's moderation (POST /v1/admin/reports/:id/resolve
-- with "hide" on a photo).

drop policy "Users read their own trail photo files" on storage.objects;
create policy "Users read their own trail photo files; admins read all"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'trail-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );

drop policy "Users delete their own trail photos" on storage.objects;
create policy "Users delete their own trail photos; admins delete any"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'trail-photos'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_admin()))
  );
