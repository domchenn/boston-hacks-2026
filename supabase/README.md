# Database migrations

The schema grows as features need new data. Every change is a **new numbered SQL file** in `migrations/`, reviewed in its own pull request. Person A owns the schema and applies migrations to the shared Supabase project.

## Adding to the schema

1. Need a table or column? Tell Person A, or open a `db/<description>` branch yourself.
2. Create the next file, named for **what it does**: `migrations/<number>_<verb>_<what>.sql`, e.g. `010_add_quest_photo_storage_bucket.sql`. Start with a verb (`add`, `create`, `drop`, `rename`, `allow`…). Avoid vague names like `update_schema` or `v3_changes`.
   Start the file with a header comment saying what it adds or changes, why, what it runs after, and which features use it. Copy the header from any existing migration.
3. In that file:
   - Use `create table` / `alter table … add column`. Don't drop or rename things other people's code uses without warning the team.
   - Enable RLS on every new table and add its policies in the same file.
   - Add comments explaining anything non-obvious.
4. Test it on a scratch database or a local Supabase if you can.
5. Open a PR. Once it's approved, Person A runs it in the Supabase SQL Editor, records it in the table below, and regenerates the types:
   ```bash
   npx supabase gen types typescript --project-id <project-ref> > src/types/database.types.ts
   ```
6. Commit the regenerated types to the same PR, then merge.

## Rules

- **Never edit a migration after it has been applied.** Fix mistakes with a new migration.
- Run migrations in order, once each.
- If you later switch to the Supabase CLI (`supabase db push`), first mark already-applied files with `supabase migration repair --status applied <version>` so they aren't run twice.
- Seed data lives in `seed.sql` and is for dev/demo only.

## Applied migrations

| File | What it does | Applied to shared project? | By / date |
|---|---|---|---|
| `001_create_profiles_sidequests_and_stops.sql` | Base schema: profiles (auto-created on signup), sidequests, stops, follows, communities, visibility helpers. Also creates tables that 002 drops. | ❓ confirm | |
| `002_drop_tables_replaced_by_user_progress.sql` | Drops saves/participants/completions/reviews/community_members (replaced below) | ❌ not yet | |
| `003_add_community_membership_and_visibility.sql` | One community per user; community-only sidequests stay hidden from outsiders | ❌ not yet | |
| `004_add_experiences_place_library.sql` | Curated library of real Boston places (read-only for users) | ❌ not yet | |
| `005_add_sidequest_card_fields_and_stop_details.sql` | `primary_line`, `is_curated`, categories; stop activity, travel mode, library link | ❌ not yet | |
| `006_add_checklist_items.sql` | Things to see/do per stop | ❌ not yet | |
| `007_add_user_sidequest_progress.sql` | Each user's status per sidequest: saved / signed_up / in_progress / completed / aborted | ❌ not yet | |
| `008_add_checklist_completions_and_quest_photos.sql` | Private checklist ticks; public quest photos | ❌ not yet | |
| `009_add_sidequest_and_creator_ratings.sql` | 4-part ratings, creator ratings, rating average views | ❌ not yet | |
