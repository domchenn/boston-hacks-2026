# Database (Supabase)

The database schema is managed with the **Supabase CLI**, the standard Supabase workflow. Every schema change is a SQL file in `migrations/`. The CLI applies them in order and records which ones have run, so nobody pastes SQL by hand and nothing runs twice.

| Path | What it is |
|---|---|
| `config.toml` | CLI settings (created by `supabase init`) |
| `migrations/` | One SQL file per schema change, applied in timestamp order |
| `seed.sql` | Demo/dev data. Runs automatically on a local `supabase db reset` |

The CLI is a dev dependency, so `npm install` gets it. Run it with `npx supabase …` or the npm scripts below.

## One-time setup (per computer)

```bash
npx supabase login                               # opens the browser to authorize
npx supabase link --project-ref <project-ref>    # asks for the database password
```

- `<project-ref>` is the `xxxx` in your `https://xxxx.supabase.co` URL.
- The database password is in Supabase → **Project Settings → Database** (ask whoever created the project).
- Linking stores local state in `supabase/.temp/`, which is gitignored.

## Everyday commands

| Command | What it does |
|---|---|
| `npm run db:new -- <name>` | Create a new empty migration, e.g. `npm run db:new -- add_quest_photo_storage_bucket` |
| `npm run db:status` | Show which migrations exist locally and which have been applied to the project |
| `npm run db:push` | Apply all not-yet-applied migrations to the linked Supabase project |
| `npm run db:types` | Regenerate `src/types/database.types.ts` from the live project |

## Changing the schema

1. Branch: `git checkout -b db/<description>`.
2. `npm run db:new -- <verb>_<what>`. Name it for what it does, starting with a verb: `add_quest_photo_storage_bucket`, `allow_editing_published_stops`. Never `update_schema` or `v3_changes`. The CLI adds the timestamp prefix.
3. Write the SQL. **Start the file with a header comment** (copy one from an existing migration) saying what it changes, why, what it runs after, and which features use it.
4. Enable RLS and add policies for every new table in the same file.
5. Open a PR. **Person A** reviews every `db/…` PR.
6. After it's approved, Person A runs `npm run db:push`, then `npm run db:types`, and commits the regenerated types to the same PR before merging.

Rules:
- **Never edit a migration that has been pushed.** Fix it with a new migration.
- Only Person A pushes to the shared project, so two people never apply migrations at once.
- Don't run schema SQL in the Supabase SQL Editor. The CLI can't see those changes, and the next `db push` may break.

## Optional: local database

With Docker running, `npx supabase start` runs a full local Supabase (database, auth, storage, Studio UI) on your machine. `npx supabase db reset` rebuilds it from `migrations/` and then loads `seed.sql`. It's handy for testing a migration before pushing, but not required.

## If someone already ran SQL by hand

If the shared project already has tables from pasting the first migration into the SQL Editor, tell the CLI that it has run, so `db push` doesn't try to create those tables again:

```bash
npx supabase migration repair --status applied 20261121120001
```

Run `npm run db:status` first to see what the CLI thinks is applied.

## Current migrations

| Migration | What it does |
|---|---|
| `20261121120001_create_profiles_sidequests_and_stops` | Base schema: profiles (auto-created on signup), sidequests, stops, follows, communities, visibility helpers |
| `20261121120002_drop_tables_replaced_by_user_progress` | Drops the base tables replaced below (saves, participants, completions, reviews, community_members) |
| `20261121120003_add_community_membership_and_visibility` | One community per user; community-only sidequests stay hidden from outsiders |
| `20261121120004_add_experiences_place_library` | Curated library of real Boston places (read-only for users) |
| `20261121120005_add_sidequest_card_fields_and_stop_details` | `primary_line`, `is_curated`, categories; stop activity, travel mode, library link |
| `20261121120006_add_checklist_items` | Things to see/do per stop |
| `20261121120007_add_user_sidequest_progress` | Each user's status per sidequest: saved / signed_up / in_progress / completed / aborted |
| `20261121120008_add_checklist_completions_and_quest_photos` | Private checklist ticks; public quest photos |
| `20261121120009_add_sidequest_and_creator_ratings` | 4-part ratings, creator ratings, rating average views |

Add a row when you add a migration. Which ones are applied is tracked by the CLI (`npm run db:status`), not here.
