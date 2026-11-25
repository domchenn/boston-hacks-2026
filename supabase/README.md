# Database (Supabase)

The database schema is managed with the **Supabase CLI**, the standard Supabase workflow. Every schema change is a SQL file in `migrations/`. The CLI applies them in order and records which ones have run, so nobody pastes SQL by hand and nothing runs twice.

| Path | What it is |
|---|---|
| `config.toml` | CLI settings (created by `supabase init`) |
| `migrations/` | One SQL file per schema change, applied in timestamp order |
| `seed.sql` | Local/CI-only test data (demo content lives in migrations so it reaches the live project) |
| `launch/` | SQL to run **at launch only**, kept out of `migrations/` so `db:push` can't apply it early. `remove_demo_data.sql` deletes the demo accounts and their reviews. |

The CLI is a dev dependency, so `npm install` gets it. Run it with `npx supabase …` or the npm scripts below.

## Optional remote linking (per computer)

```bash
npx supabase login                               # opens the browser to authorize
npx supabase link --project-ref <project-ref>    # asks for the database password
```

- `<project-ref>` is the `xxxx` in your `https://xxxx.supabase.co` URL.
- The database password is in Supabase → **Project Settings → Database** (ask whoever created the project).
- Linking stores local state in `supabase/.temp/`, which is gitignored.

## Everyday commands

The CLI targets a *local* database by default. The db:push, db:status and db:types npm scripts add `--remote` so they act on the linked Supabase project. Do not add `--remote` by default. Verify the target and obtain task-specific human authorization before remote writes; the designated human database owner performs reviewed remote changes. Local-only commands do not need a project link.

| Command | What it does |
|---|---|
| `npm run db:new -- <name>` | Create a new empty migration, e.g. `npm run db:new -- add_quest_photo_storage_bucket` |
| `npm run db:status` | Show which migrations exist locally and which have been applied to the project |
| `npm run db:push` | Apply all not-yet-applied migrations to the linked Supabase project |
| `npm run db:types` | Regenerate `apps/web/src/types/database.types.ts` from the live project |
| `npm run test:db` | Run the database security tests against a **local** database (needs Docker; see below) |

## Changing the schema

1. Branch: `git checkout -b db/<description>`.
2. `npm run db:new -- <verb>_<what>`. Name it for what it does, starting with a verb: `add_quest_photo_storage_bucket`, `allow_editing_published_stops`. Never `update_schema` or `v3_changes`. The CLI adds the timestamp prefix.
3. Write the SQL. **Start the file with a header comment** (copy one from an existing migration) saying what it changes, why, what it runs after, and which features use it.
4. Enable RLS, add policies and pgTAP tests, and verify grants in the same PR. Default grants from `grant_api_access_to_app_tables` depend on the creating role; do not assume they apply to every future table.
5. Open a small PR following AGENTS.md; task ownership is flexible while working solo. Never bypass required checks or merge as an agent.
6. The designated human database owner applies reviewed remote migrations only after target verification and authorization. Regenerate types from the intended environment and review the diff; `db:types` currently targets the linked remote, not local.

Rules:
- **Never edit a migration that has been pushed.** Fix it with a new migration.
- Only the designated human database owner applies reviewed shared-project migrations; coordinate one change at a time.
- Don't run schema SQL in the Supabase SQL Editor. The CLI can't see those changes, and the next `db push` may break.

## Database tests

`supabase/tests/database/*.test.sql` are [pgTAP](https://pgtap.org) tests for the rules the database enforces: who can see drafts and community-only sidequests, that you can only write your own progress, that only people who completed a sidequest can rate it, that the rating averages are right, and so on. They act as different users (`set local role authenticated` plus a fake login) and roll everything back.

- **CI runs them on every PR** against a fresh local database built from `migrations/` (`.github/workflows/ci.yml`). A PR that breaks a security rule goes red.
- **Changing a rule?** Update or add a test in the same PR. New table? Add a test file for its policies, e.g. `04_quest_photos.test.sql`.
- Run `npm run test:db` against an existing local stack. For a fresh baseline, first confirm the local database is disposable, then use `npx supabase db start` and `npx supabase db reset`. Never reset an existing stack whose data or provenance is unknown.

## Optional: local database

With Docker running, `npx supabase start` runs a full local Supabase (database, auth, storage, Studio UI) on your machine. After confirming that local database is disposable, `npx supabase db reset` rebuilds it from `migrations/` and then loads `seed.sql`. It's handy for testing a migration before pushing, but not required.

## Shared-project safety and recovery

The old one-time remote-reset instructions were removed during M00: their assumption that the shared database has no valuable data is unsafe. Never reset a shared or remote database as setup. Migration files describe repository history; only a verified environment's migration ledger proves what is applied.

Follow the [M01 recovery runbook and evidence register](../docs/refactor/RECOVERY.md) before production schema changes. The production project is confirmed; the developer-supplied dashboard screenshot confirms Free plan without scheduled project backups, and the read-only metadata reports PITR disabled. A one-time encrypted database/Auth/history/media export has now completed with read-back/file/media checksums verified; off-site protection, complete configuration coverage and an isolated recovery drill remain unverified. A default `supabase db dump` is schema-only and excludes managed schemas; it is not a complete backup. `launch/remove_demo_data.sql` is destructive and requires separate human review/authorization; it is never a baseline command.

## Current migrations

| Migration | What it creates |
|---|---|
| `20261121120001_create_profiles_and_communities` | `profiles` (auto-created on signup, backfilled for existing users), `communities`, `follows`, the `private` helper schema |
| `20261121120002_create_sidequests_stops_and_places` | `experiences` (curated place library), `sidequests`, `sidequest_stops`, visibility/ownership helpers |
| `20261121120003_create_quest_progress_and_checklists` | `checklist_items`, `user_sidequests` (saved / signed_up / in_progress / completed / aborted), `checklist_completions`, `quest_photos` |
| `20261121120004_create_ratings` | `sidequest_ratings` (price/time/enjoyment/memorability), `creator_ratings`, rating average views |
| `20261121220540_grant_api_access_to_app_tables` | Lets the app's API roles reach the tables (newer Supabase projects don't do this automatically); RLS still controls rows |
| `20261121225902_seed_curated_demo_trails` | Demo content: the "breadcrumb" team account, 9 real places, 3 curated trails (Sunday Café Hop, North End Cannoli Duel, Harvard Square Bookstores) with stops and crumbs |
| `20261121233400_add_save_trail_function` | `save_trail(p_trail, p_trail_id)`: Make a trail saves a trail + stops + crumbs in one transaction, enforcing the publish checklist |
| `20261122011131_seed_researched_places_and_chinatown_tour` | BU/BC communities, Jason's ~30 researched places, the Chinatown Food Tour (moved from `seed.sql` so it reaches the live project) |
| `20261122014142_add_trail_photos_storage` | Public `trail-photos` Storage bucket (5 MB, images) with rules: users upload/delete only in their own folder |
| `20261122022417_seed_demo_activity_and_fix_coordinates` | Verified coordinates for 6 curated places/stops; demo accounts @maya_k, @jrod, @priya_s with finished trails, ratings, reviews and sign-ups |
| `20261122034829_add_reports_and_admin_moderation` | `reports` table, `profiles.is_admin` (users can't set it: profile updates limited to the columns the app edits), admin powers to hide trails and remove reviews/photos |
| `20261122015804_add_trail_attendees_functions` | `trail_attendees(p_trail_id, p_limit)` and `trail_going_counts(p_trail_ids)`: who's going on a scheduled trail (count + public profile fields only, for trails you can see), since progress rows are private |
| `20261122022403_add_community_to_save_trail` | `save_trail()` accepts an optional `community_id` ("Who can see this": everyone or only your own community); leaving it out keeps the current setting |
| `20261122034826_add_trail_remixes` | `sidequests.remixed_from` (credit for remixed trails, guarded by a trigger so it can't be forged or changed) and `save_trail()` support for it |

Additional migrations already present at M00:

| Migration | Purpose |
|---|---|
| `20261122025445_add_friends_activity_function` | Visibility-aware friends activity RPC |
| `20261122042043_add_stop_to_trail_photos` | Optional stop association and integrity check for photos |
| `20261122042045_add_trail_visibility_and_close_friends` | Friends/close-friends audiences, helpers and save_trail update |
| `20261122061906_add_trending_trails_function` | Trending RPC |
| `20261122070225_add_friends_also_saved_function` | Mutual saved-trail RPC |
| `20261122130147_seed_more_researched_trails` | Additional researched demo content |
| `20261122133657_add_custom_trail_category` | Custom category and save_trail support |

There are 21 migration files and 18 pgTAP test files. See [M00 baseline](../docs/refactor/BASELINE.md) for local ledger drift. Add a row when adding a migration. Applied history must be verified per environment; `npm run db:status` queries the linked remote, so inspect the intended target first.
