-- Private photo storage (photo privacy step 2; standard practice, decision 2026-11-26).
--
-- New trail photos go into a private bucket, `photos`, at "<trail id>/<random id>.jpg"
-- (no user id in the name). Nobody can open a file by a guessable link: the API hands
-- out short-lived signed links, and Storage only signs a file for someone allowed to
-- see its trail (private.can_view_sidequest: visibility, close friends, private
-- accounts, communities, drafts, admins). So photos on friends-only trails, close-
-- friends trails and private accounts stay private, even by direct link.
--
-- quest_photos.storage_path holds the file's path in `photos`. Older rows keep their
-- public `trail-photos` link in photo_url (all of production's are on public trails);
-- one of the two is always set. The `trail-photos` bucket and its policies stay for
-- those older photos and for the website while it talks to Supabase directly.
--
-- Who can do what in `photos` (storage.objects policies):
--   read (needed to sign or delete): anyone who can see the trail, and the uploader
--   add:    signed-in users with the trail saved, started or finished (as for
--           quest_photos), only into that trail's folder; Storage records them as owner
--   delete: the uploader, the trail's creator (deleting a trail removes its photos)
--           and moderators
--   replace: nobody
--
-- Runs after 20261127015257_let_admins_remove_photo_files. Used by the API's photos,
-- moderation and trail-deletion code.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

alter table public.quest_photos alter column photo_url drop not null;
alter table public.quest_photos add column storage_path text unique;
alter table public.quest_photos add constraint quest_photos_has_file check (photo_url is not null or storage_path is not null);
alter table public.quest_photos add constraint quest_photos_path_in_trail_folder
  check (storage_path is null or split_part(storage_path, '/', 1) = sidequest_id::text);
comment on column public.quest_photos.storage_path is
  'Path of the file in the private `photos` bucket ("<trail id>/<random>.jpg"); served by signed links. Null for older photos, which use photo_url.';
comment on column public.quest_photos.photo_url is
  'Public link of an older photo in the `trail-photos` bucket. Null for photos in the private `photos` bucket (see storage_path).';

-- The trail a file in `photos` belongs to (its first folder), or null for anything else.
create or replace function private.photo_trail_id(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;
revoke all on function private.photo_trail_id(text) from public;
grant execute on function private.photo_trail_id(text) to anon, authenticated;

create policy "Photos are readable by people who can see their trail"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'photos'
    and (
      owner_id = (select auth.uid())::text
      or (select private.can_view_sidequest(private.photo_trail_id(name)))
    )
  );

create policy "Users add photos to trails they saved, started or finished"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photos'
    and exists (
      select 1 from public.user_sidequests us
      where us.user_id = (select auth.uid())
        and us.sidequest_id = private.photo_trail_id(name)
        and us.status in ('in_progress', 'completed', 'saved')
    )
  );

create policy "Uploaders, the trail's creator and moderators delete photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photos'
    and (
      owner_id = (select auth.uid())::text
      or exists (select 1 from public.sidequests s where s.id = private.photo_trail_id(name) and s.creator_id = (select auth.uid()))
      or (select private.is_admin())
    )
  );
