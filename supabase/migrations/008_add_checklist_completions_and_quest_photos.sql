-- =============================================================================
-- Breadcrumb — 008_add_checklist_completions_and_quest_photos.sql
--
-- Stores what a user ticks off during a quest, and photos they add.
--
-- - checklist_completions: private ticks (+ optional proof photo URL). Only
--   allowed once the user has started the quest. Kept on "saved for later".
-- - quest_photos: extra photos from the outing. Public on the sidequest as
--   social proof (PRD §5.4). File storage bucket comes in a later migration.
--
-- Runs after: 007
-- Used by:    Quest mode checklist and photos tab, detail page photos
--
-- Immutable once applied to the shared project: change things in a new file.
-- =============================================================================

-- =============================================================================
-- checklist_completions — a user's ticked items (+ optional proof photo)
-- Private to the user. Kept when a quest is "saved for later" so progress
-- survives (PRD Flow C).
-- =============================================================================
create table public.checklist_completions (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  checklist_item_id uuid not null references public.checklist_items (id) on delete cascade,
  completed_at      timestamptz not null default now(),
  photo_url         text,
  primary key (user_id, checklist_item_id)
);
create index checklist_completions_item_idx on public.checklist_completions (checklist_item_id);

-- Can the current user tick this item? They must have a progress row for its
-- sidequest (any status except aborted: in progress, saved mid-quest, or done).
create function private.can_complete_item(p_item_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.checklist_items ci
    join public.user_sidequests us
      on us.sidequest_id = ci.sidequest_id and us.user_id = (select auth.uid())
    where ci.id = p_item_id and us.status <> 'aborted'
  );
$$;
revoke all on function private.can_complete_item(uuid) from public;
grant execute on function private.can_complete_item(uuid) to authenticated;

alter table public.checklist_completions enable row level security;
create policy "Users read their own completions"
  on public.checklist_completions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users tick items on quests they started"
  on public.checklist_completions for insert to authenticated
  with check (user_id = (select auth.uid())
              and (select private.can_complete_item(checklist_item_id)));
create policy "Users update their own completions"
  on public.checklist_completions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users untick their own completions"
  on public.checklist_completions for delete to authenticated
  using (user_id = (select auth.uid()));


-- =============================================================================
-- quest_photos — extra photos from a quest ("add other photos" tab)
-- PRD §5.4: photos are social proof "visible on the sidequest", so they're
-- readable wherever the sidequest is. Only the owner can add or remove them.
-- (Checklist proof photos live on checklist_completions and stay private.)
-- The Storage bucket for the files themselves comes in a later migration.
-- =============================================================================
create table public.quest_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  sidequest_id uuid not null references public.sidequests (id) on delete cascade,
  photo_url    text not null,
  caption      text check (char_length(caption) <= 300),
  created_at   timestamptz not null default now()
);
create index quest_photos_sidequest_idx on public.quest_photos (sidequest_id, created_at desc);
create index quest_photos_user_idx      on public.quest_photos (user_id);

alter table public.quest_photos enable row level security;
create policy "Quest photos visible when sidequest is visible"
  on public.quest_photos for select to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));
create policy "Users add photos to quests they started"
  on public.quest_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.user_sidequests us
                where us.user_id = (select auth.uid())
                  and us.sidequest_id = quest_photos.sidequest_id
                  and us.status in ('in_progress', 'completed', 'saved'))
  );
create policy "Users delete their own photos"
  on public.quest_photos for delete to authenticated
  using (user_id = (select auth.uid()));
