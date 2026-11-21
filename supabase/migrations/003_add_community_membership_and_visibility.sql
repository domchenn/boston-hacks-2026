-- =============================================================================
-- Breadcrumb — 003_add_community_membership_and_visibility.sql
--
-- Lets users belong to one community (BU, BC…) and lets a sidequest be limited to one.
--
-- - communities.slug: URL-safe id like 'bu'
-- - profiles.community_id: the user's community (set in settings)
-- - sidequests.community_id: null = everyone; set = only that community's members
-- - Rewrites the sidequest visibility check (private.can_view_sidequest) and the
--   sidequests read policy so community-only quests stay hidden from outsiders.
--   Stops, checklist items, ratings and photos all reuse that check.
--
-- Runs after: 002
-- Used by:    For You community switch, settings page, every sidequest read
--
-- Immutable once applied to the shared project: change things in a new file.
-- =============================================================================

-- =============================================================================
-- Communities and profiles
-- =============================================================================
alter table public.communities
  add column slug text unique check (slug ~ '^[a-z0-9-]{2,40}$');
comment on column public.communities.slug is 'URL-safe id, e.g. "bu", "bc".';

alter table public.profiles
  add column community_id uuid references public.communities (id) on delete set null;
comment on column public.profiles.community_id is
  'The one community the user belongs to (PRD §6.1). Null = none. Set in settings.';
create index profiles_community_idx on public.profiles (community_id);


alter table public.sidequests
  add column community_id uuid references public.communities (id) on delete set null;
comment on column public.sidequests.community_id is
  'Null = visible to everyone. Set = only members of that community can see it (PRD §6.1).';
create index sidequests_community_idx on public.sidequests (community_id);


-- =============================================================================
-- Visibility helpers (replace the 001 versions to add community scoping)
-- =============================================================================

-- Is the current user a member of this community?
create function private.in_community(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.community_id = p_community_id
  );
$$;

-- Visible = (published AND (everyone OR my community)) OR I created it.
create or replace function private.can_view_sidequest(p_sidequest_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.sidequests s
    where s.id = p_sidequest_id
      and (
        s.creator_id = (select auth.uid())
        or (s.status = 'published'
            and (s.community_id is null or private.in_community(s.community_id)))
      )
  );
$$;

revoke all on function private.in_community(uuid) from public;
grant execute on function private.in_community(uuid) to anon, authenticated;

drop policy "Published sidequests are readable; creators see their own" on public.sidequests;
create policy "Visible sidequests are readable"
  on public.sidequests for select
  to anon, authenticated
  using (
    creator_id = (select auth.uid())
    or (status = 'published'
        and (community_id is null or (select private.in_community(community_id))))
  );
