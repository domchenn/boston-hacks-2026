-- Self-serve account deletion (photo privacy step 3; standard practice, decision
-- 2026-11-26).
--
-- public.delete_my_account() deletes the caller's sign-in account (auth.users). Every
-- table that points at the profile already cascades, so the profile, trails (with
-- their stops, crumbs, everyone's progress, ratings and photo records), progress,
-- ticks, ratings, photo records, follows and close-friend lists go with it. Photo
-- FILES aren't rows of these tables: the API (or the website) removes them through
-- the Storage API first, while the account still exists.
--
-- One change keeps safety records: reports the person filed used to be deleted with
-- them, which would quietly drop open reports about other people's content. Now the
-- reporter is cleared instead (reporter_id set null), so moderators still see the
-- report without knowing who filed it.
--
-- Runs after 20261122034829_add_reports_and_admin_moderation (reports) and
-- 20261127021841_add_private_photo_storage. Used by: DELETE /v1/me and the website's
-- Delete account.

alter table public.reports alter column reporter_id drop not null;
alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles (id) on delete set null;
comment on column public.reports.reporter_id is
  'Who filed the report; null once their account is deleted (the report is kept for moderators).';

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to delete your account' using errcode = '42501';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
comment on function public.delete_my_account() is
  'Deletes the caller''s account and, by cascade, everything linked to it. Remove their photo files first (Storage API).';
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
