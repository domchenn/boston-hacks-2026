# Sidequests — Implementation Plan (4 people)

Source of truth: [PRD.md](PRD.md). Schema of record: [`supabase/migrations/`](../supabase/migrations/).

Each person owns **one feature area** and the folders for it. Work happens on separate branches and merges through PRs. See §3 for who does what.

Build order follows the PRD priority: get **browse → detail → start → checklist → complete → rate** working end to end before any P1 work.

---

## 1. PRD vs. current schema: mismatches

Compared [PRD §9](PRD.md) with `001_initial_schema.sql`.

### Must fix before feature work (blocking)

| # | Mismatch | Impact | Proposed fix (migration `002`) |
|---|---|---|---|
| M1 | **`quest_runs` is missing.** The PRD models progress as per-user runs (`status`, `started_at`, `completed_at`). The schema only has `completed_sidequests`, which has no "in progress" state. | We can't show the **In Progress** list or Start Quest. Completion is stored in the wrong place. | Add `quest_runs` (`id`, `user_id`, `sidequest_id`, `status in ('in_progress','completed','abandoned')`, `started_at`, `completed_at`). Add a CHECK that `completed_at` is set exactly when `status = 'completed'`. Add a partial unique index allowing **at most one `in_progress` run per user per sidequest**. Owner-only writes. |
| M2 | **`quest_checkpoints` is missing.** These are creator-defined checklist items and are P0. | No checklist for the active quest. | Add `quest_checkpoints` (`id`, `sidequest_id`, nullable `stop_id`, `label`, `sort_order`). The stop must belong to the same sidequest (composite FK or trigger). Visibility and ownership follow the parent sidequest, like stops. |
| M3 | **`checkpoint_completions` is missing.** | Checked/unchecked state doesn't persist. | Add `checkpoint_completions` (`quest_run_id`, `checkpoint_id`, `completed_at`), PK on the pair. Users write only to their own runs. A trigger checks that the checkpoint belongs to the run's sidequest. |
| M4 | **The review rule points at the wrong table.** Reviews currently FK to `completed_sidequests`. The PRD says "require completed runs". | Once runs exist, reviews must check runs instead. | Drop the FK. Add a `SECURITY DEFINER` trigger that requires an `exists` completed `quest_run` for (user, sidequest). Keep one review per user per sidequest. |
| M5 | **`completed_sidequests` duplicates run state.** | Two sources of truth for "completed" break the PRD rule "don't infer one state from another". | Drop `completed_sidequests` in `002`. **Completed** means "has a run with `status = 'completed'`". |
| M6 | **Seeding needs an owner.** `sidequests.creator_id → profiles → auth.users`, so 8–12 seeded quests need a real auth user. The PRD also says to "label demo content". | `seed.sql` can't run as written today. | Create one "Sidequests Team" account in Supabase Auth. Seed against its UUID. Add `sidequests.is_curated boolean not null default false` so the UI can badge curated content. |

### Should fix (non-blocking, but cheap now)

| # | Mismatch | Proposed fix |
|---|---|---|
| M7 | **Ratings summary.** The PRD wants averages and a review count. PostgREST aggregates are off by default. | Add a view `sidequest_rating_stats` (`security_invoker = true`) with `avg_fun`, `avg_value`, `avg_travel`, `review_count`. |
| M8 | **Joining past outings.** The PRD doesn't say. Today you can join a scheduled quest whose date has passed. | Extend `validate_participation` to reject `scheduled_at < now()`. Needs team decision D3. |
| M9 | **Run visibility.** The PRD shows Completed history on profiles, but in-progress runs are private by nature. | RLS: users see all of their own runs. Everyone else sees only `completed` runs on visible sidequests, for profile history and "N people completed". |
| M10 | **Naming differences.** PRD `estimated_duration` = schema `estimated_duration_minutes`. PRD `participants` has no `id`; the schema has one. The schema also has extra `neighborhood`, `updated_at` and `stops.estimated_cost`. | No change. The schema is the implementation source of truth (PRD §9). Just be aware of it. |
| M11 | **Cover images.** No Storage bucket exists. | Use image URLs only for the MVP. Add a `covers` bucket and policies in a later migration if uploads become a goal. |
| M12 | **Location privacy.** The PRD says not to store location history. The schema stores none. ✅ | Keep it that way. Geolocation stays in client memory only. |

### Already aligned ✅

RLS on owned records, published-only visibility for stops, 1–5 ratings, coordinate and cost checks, unique stop order, scheduled-only joins (trigger), one review per user, auto profile on signup, P1 `follows`/`communities` tables.

### Docs/config mismatches

- The README folder ownership doesn't match §3 below. Update it in Task S3.
- `src/types/database.types.ts` is hand-written and provisional. Regenerate it after `002` (Task S2).

---

## 2. Team decisions needed (resolve before S1)

| ID | Question | Recommendation |
|---|---|---|
| D1 | Has `001` already been run on our Supabase project? | **If not:** we may still fold the `002` changes into `001`. **If yes:** `001` is frozen, so use `002`. Either way, one person applies migrations. |
| D2 | Places input for creation: curated list, a places API (e.g. Photon/Nominatim geocoding), or both? | Use a **geocoding search (Photon, free, no key)** plus pinning on the map as fallback. Never ask for raw coordinates. |
| D3 | Block joining outings in the past? | Yes. |
| D4 | Routing provider for walk/transit directions. | Start with **external Google/Apple Maps links** (always works). Add MBTA V3 stops/predictions near each stop as the real transit data. Spike OpenTripPlanner/MBTA trip planning only if time allows (PRD §12, highest risk). |
| D5 | Map tiles. | MapLibre GL JS + a free tile style (OpenFreeMap or MapTiler free key). |
| D6 | Can a run be completed with unchecked checkpoints? | Yes, allow it. Checkpoints are fun, not gates. |

---

## 3. Team & ownership

Split by **feature**, not by layer. Each person owns a folder, so people rarely touch the same files. The riskiest work (database, maps/transit) goes to the two people using Claude Code. The beginner gets work that is self-contained, visible, and hard to break anything with.

| Person | Feature area | Owns (folders) | Why this fit |
|---|---|---|---|
| **A — Claude Code** | **Platform + Active Quest** | `supabase/`, `src/lib/`, `src/types/`, `src/features/quest/` | Database and security changes need care and review. A also unblocks everyone first. |
| **B — Claude Code** | **Maps, Transit + Create** | `src/features/maps/`, `src/features/create/` | Highest technical risk (MapLibre, geocoding, MBTA) |
| **C — Intermediate** | **Discovery: feed, detail, save/join, reviews** | `src/features/discovery/`, `src/features/reviews/` | Classic React + Supabase CRUD, the core of the demo |
| **D — Beginner** | **Accounts, Profiles + Seed Content** | `src/features/auth/`, `src/features/profile/`, `supabase/seed-content/` | Small, well-documented pieces, and the seed content matters a lot for the demo |

**Shared files** (`src/App.tsx`, `src/components/`, `src/index.css`, `package.json`): keep changes small, one PR per change, and tell the group in chat. **Only A merges migrations.**

## 4. Phase 0 — Unblock everyone (Person A, ~1–2 hrs, everyone else starts in parallel)

| ID | Task | Done when |
|---|---|---|
| S1 | Migration `002` covering M1–M9 (decide D1 first). Test on a scratch DB, then apply. | RLS spot-checks pass |
| S2 | Regenerate `database.types.ts` | `npm run typecheck` passes |
| S3 | Add stub routes for every screen (table below) to `App.tsx`, each a placeholder page in its owner's folder. Add a mobile bottom nav. Update the README. | Every route renders "Coming soon" |
| S4 | Write shared query functions in `src/lib/queries/`: `getFeed()`, `getSidequest(id)` (with stops, checkpoints, creator, stats), `getMyRuns()`. Export row types. | C and B import these instead of writing their own |
| S5 | `useSession()` hook: `{ session, profile, loading }` | D and C use it |
| S6 | Add `CLAUDE.md` with the rules in §8 so both Claude Code sessions respect the folder ownership | File exists in `main` |

**While waiting on Phase 0:** B starts the maps spike (needs no DB). C builds `SidequestCard` against the types file with a hard-coded sample object (delete it before merging). D starts the seed content research (no code).

| Path | Screen | Owner |
|---|---|---|
| `/` | For You feed | C |
| `/q/:id` | Sidequest detail | C (embeds B's `<RoutePreview>`) |
| `/q/:id/play` | Active quest | A (embeds B's `<StopsMap>`) |
| `/create`, `/q/:id/edit` | Create / edit | B |
| `/me` | My Activity | D (uses A's `getMyRuns`) |
| `/u/:username` | Public profile | D |
| `/login`, `/signup`, `/onboarding` | Auth | D |

## 5. Task lists

### Person A — Platform + Active Quest (Claude Code)
1. Phase 0 (S1–S6). **Do this first, everyone depends on it.**
2. `src/features/quest/api.ts`: `startRun` (resume the existing in-progress run if any), `toggleCheckpoint`, `completeRun`, `abandonRun`.
3. `/q/:id/play`: B's map, geolocation asked **only here**, denied/unavailable states, location held in memory only.
4. Checklist under the map (persisted), **Complete quest**, then "Rate it?", which links to C's review form.
5. Turn D's seed content into `supabase/seed.sql` and apply it.
6. Review D's PRs (pair on the first one).
7. Stretch: follows, communities (P1).

### Person B — Maps, Transit + Create (Claude Code)
1. Maps spike: MapLibre + free tiles. `<StopsMap stops selectedId onSelect>` with numbered markers. **No straight lines pretending to be routes.**
2. `<RoutePreview stops>` for C's detail page. Ship a rough version early so C isn't blocked.
3. Per-stop "Directions" links (Google/Apple Maps, transit/walk), labelled as external.
4. MBTA V3: nearest T and bus stops for each stop, plus live predictions if feasible.
5. Place search (Photon geocoding, Boston bounding box) that fills name, address and coordinates.
6. Create form: details, anytime vs. scheduled, stops (add/remove/reorder), checkpoints, draft/publish.
7. Deploy to Vercel (HTTPS is required for geolocation). Do this early, not at the end.
8. Stretch: edit/archive, in-app routing (D4), scenic checkpoints.

### Person C — Discovery (Intermediate)
1. `SidequestCard`: title, summary, creator, cost, duration or date, cover, curated badge.
2. For You feed at `/`, using `getFeed()`: loading, empty and error states.
3. Detail page `/q/:id`: stops list, totals, scheduled/anytime label, ratings summary, reviews list, `<RoutePreview>`.
4. Action bar: **Save/Unsave**, **Join/Leave** (scheduled only), **Start Quest** (links to `/q/:id/play`). Log-out state redirects to login.
5. Review form: three 1–5 ratings and text, shown only if the user has a completed run. Edit and delete own review.
6. Stretch: category and budget filters.

### Person D — Accounts, Profiles + Seed Content (Beginner)
Pair with A for the first PR. Use Claude.ai or docs freely, and ask early when stuck.
1. **Seed content (start right away, no code):** research **10 real Boston/Cambridge sidequests** in a shared sheet. Each needs a title, description, category, cost estimate, 2–4 real stops (name, address, coordinates from Google Maps), and 2–4 checkpoints ("Try the cannoli"). Use real places only, with no invented hours or events. A converts it to SQL.
2. Login and signup pages using shadcn form components and `supabase.auth.signInWithPassword` / `signUp`. Add log out to the nav.
3. Onboarding `/onboarding`: choose username (3–30 chars, lowercase a–z, 0–9, `_`), display name, university.
4. Profile page `/u/:username`: avatar, name, university, completed quests.
5. My Activity `/me`: tabs for Created, Saved, Joined, In Progress, Completed. Each tab is one simple query; A provides `getMyRuns`.
6. Polish: empty states ("No saved quests yet"), friendly error messages.

## 6. Hand-offs (who waits on whom)

| Needs | From | By |
|---|---|---|
| Types, queries, `useSession`, stub routes | A | Phase 0, first thing |
| `<RoutePreview>` (rough is fine) | B → C | Early. C can use a grey box until then |
| `<StopsMap>` | B → A | Before A starts `/q/:id/play` |
| `getMyRuns` | A → D | Before D's My Activity tabs |
| Review form route | C → A | Before A wires "Rate it?" |
| Seed content sheet | D → A | Before the first demo run-through |

Wherever possible, build against the **interface** (component props, function signatures) so nobody has to wait on finished code.

## 7. Milestones

| Milestone | Check |
|---|---|
| M0 Phase 0 merged | Every route renders, types are generated |
| M1 Feed + detail with seed data | A visitor can browse real quests |
| M2 Save/join + auth | State persists across refresh |
| M3 Create → publish → appears in feed | Using a second account |
| M4 Start → map → checklist → complete → rate | The full PRD §11 flow |
| M5 Deployed + demo rehearsed | 3-minute *Sunday Cafe Hopping* demo |

P1 work starts only after M4.

## 8. Working safely

**Git**
- Always branch: `git checkout -b feat/<you>-<thing>`. Never commit straight to `main`.
- Pull often: `git pull origin main` at least every couple of hours. Merge small PRs often rather than one huge one.
- Every PR needs **one reviewer**. A or B reviews D's PRs, and A reviews anything touching `supabase/` or `src/lib/`.
- Before pushing, run `npm run build && npm run lint`. If either fails, don't push.

**Database**
- Only A writes or applies migrations. Need a column? Ask A.
- Never edit an applied migration. Add `00N_*.sql` instead, and regenerate types afterwards.
- Never put the service-role key anywhere in the app.

**Claude Code users (A, B)**: put these rules in `CLAUDE.md`:
- Only edit files in your own feature folders. For shared files, keep changes minimal and say so in the PR.
- Don't add dependencies or migrations without asking the team.
- Don't build features outside your area, even if it would be "quick".
- Don't commit `.env`. Don't push to `main`.

**For D (beginner)**
- Commit small and often (`git add . && git commit -m "..."`). It's your undo button.
- If git gets confusing, **stop and ask** before trying `--force` or `reset`.
- Getting it working is more important than getting it pretty. A will help polish.
