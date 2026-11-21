# Database migrations

The schema grows as features need new data. Every change is a **new numbered SQL file** in `migrations/`, reviewed in its own pull request. Person A owns the schema and applies migrations to the shared Supabase project.

## Adding to the schema

1. Need a table or column? Tell Person A, or open a `db/<description>` branch yourself.
2. Create the next file: `migrations/00N_short_description.sql` (e.g. `003_add_quest_photos.sql`).
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
| `001_initial_schema.sql` | First schema (old PRD): profiles, sidequests, stops, saves, participants, completions, reviews, follows, communities | ❓ confirm | |
| `002_prd_v3_core.sql` | PRD v3 core: experiences, checklist items, `user_sidequests` progress, checklist completions, quest photos, 4-part ratings, creator ratings, rating views, community visibility. Drops the 001 tables it replaces. | ❌ not yet | |
