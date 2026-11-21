-- =============================================================================
-- Breadcrumb — 006_add_checklist_items.sql
--
-- Creates checklist_items: the things to see or do on a sidequest.
--
-- Each item belongs to a sidequest and optionally to one of its stops
-- (null = something on the way between stops; is_checkpoint marks the P2
-- checkpoints feature). Same visibility and edit rights as the sidequest.
--
-- Runs after: 005
-- Used by:    Detail page, Quest mode checklist, Create flow
--
-- Immutable once applied to the shared project: change things in a new file.
-- =============================================================================

-- =============================================================================
-- checklist_items — things to see/do, per stop or between stops
-- =============================================================================
create table public.checklist_items (
  id            uuid primary key default gen_random_uuid(),
  sidequest_id  uuid not null references public.sidequests (id) on delete cascade,
  stop_id       uuid,
  label         text not null check (char_length(label) between 1 and 200),
  item_type     text not null default 'do' check (item_type in ('see', 'do')),
  item_order    integer not null default 0 check (item_order >= 0),
  is_checkpoint boolean not null default false,
  created_at    timestamptz not null default now(),
  -- The stop must belong to the same sidequest. Deleting a stop deletes its items.
  constraint checklist_items_stop_fk foreign key (stop_id, sidequest_id)
    references public.sidequest_stops (id, sidequest_id) on delete cascade
);
comment on column public.checklist_items.stop_id is
  'Null = not tied to a stop (e.g. a checkpoint on the way between stops).';
comment on column public.checklist_items.is_checkpoint is
  'True for P2 "checkpoints" between stops (PRD §6.2).';
create index checklist_items_sidequest_idx on public.checklist_items (sidequest_id, item_order);
create index checklist_items_stop_idx      on public.checklist_items (stop_id);

alter table public.checklist_items enable row level security;

-- Same visibility and ownership as the parent sidequest (like stops).
create policy "Checklist items visible when sidequest is visible"
  on public.checklist_items for select to anon, authenticated
  using ((select private.can_view_sidequest(sidequest_id)));
create policy "Creators can add checklist items"
  on public.checklist_items for insert to authenticated
  with check ((select private.owns_sidequest(sidequest_id)));
create policy "Creators can update checklist items"
  on public.checklist_items for update to authenticated
  using ((select private.owns_sidequest(sidequest_id)))
  with check ((select private.owns_sidequest(sidequest_id)));
create policy "Creators can delete checklist items"
  on public.checklist_items for delete to authenticated
  using ((select private.owns_sidequest(sidequest_id)));
