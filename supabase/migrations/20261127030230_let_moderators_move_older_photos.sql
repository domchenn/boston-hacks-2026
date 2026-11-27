-- Let moderators move older public photos into private storage (owner decision
-- 2026-11-26: every photo private, done during the production API release).
--
-- Older photos live in the public `trail-photos` bucket and quest_photos.photo_url
-- holds their public link. The API's move tool (POST /v1/admin/photos/move-older),
-- run by a moderator, copies each one into the private `photos` bucket as a cleaned
-- JPEG at "<trail id>/<random>.jpg", calls public.admin_move_photo() to point the
-- row at it, then deletes the old file. No service-role key: it runs as the
-- moderator, so it needs two things moderators couldn't do before:
--   1. add files to the private bucket (a new insert policy, moderators only, still
--      only into a trail's folder);
--   2. point a photo row at its new file and make the original uploader the file's
--      owner, so they can still delete their own photo later. That's
--      admin_move_photo(), which checks every step (moderator, an older photo, a
--      file that exists in the private bucket in that trail's folder).
--
-- Also: uploaders can always see their own photo rows. Before, a photo on a trail
-- you can no longer see (e.g. after being unfriended) was invisible to you, so you
-- couldn't delete it and account deletion missed its file. Standard practice: you
-- can always see and delete your own content.
--
-- Runs after 20261127021841_add_private_photo_storage and
-- 20261127015257_let_admins_remove_photo_files.

create policy "Moderators move older photos into private storage"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos' and private.photo_trail_id(name) is not null and (select private.is_admin()));

create or replace function public.admin_move_photo(p_photo_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.quest_photos%rowtype;
begin
  if not (select private.is_admin()) then
    raise exception 'Only moderators can move photos' using errcode = '42501';
  end if;
  select * into v_photo from public.quest_photos where id = p_photo_id for update;
  if not found then
    raise exception 'No such photo' using errcode = 'P0002';
  end if;
  if v_photo.storage_path is not null or v_photo.photo_url is null then
    raise exception 'That photo is already in private storage' using errcode = '23514';
  end if;
  if private.photo_trail_id(p_path) is distinct from v_photo.sidequest_id then
    raise exception 'The file must be in the photo''s own trail folder' using errcode = '23514';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'photos' and name = p_path) then
    raise exception 'Upload the file to the photos bucket first' using errcode = '23514';
  end if;

  update public.quest_photos set storage_path = p_path, photo_url = null where id = p_photo_id;
  update storage.objects set owner_id = v_photo.user_id::text, owner = v_photo.user_id
    where bucket_id = 'photos' and name = p_path;
end;
$$;
comment on function public.admin_move_photo(uuid, text) is
  'Moderators only: point an older public photo at its copy in the private photos bucket and give the uploader ownership of that file.';
revoke all on function public.admin_move_photo(uuid, text) from public, anon;
grant execute on function public.admin_move_photo(uuid, text) to authenticated;

create policy "Uploaders see their own photos"
  on public.quest_photos for select
  to authenticated
  using (user_id = (select auth.uid()));
