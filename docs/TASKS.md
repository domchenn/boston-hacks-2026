# Breadcrumb — Tasks

Who builds what, in what order. **Agents: read this file, `AGENTS.md` and `docs/STYLE_GUIDE.md` before starting a task.**

Sources: [PRD.md](PRD.md) · design: [`mockups/`](mockups/) (Main = web, Mobile-* = phone) and [STYLE_GUIDE.md](STYLE_GUIDE.md) · database: [`supabase/README.md`](../supabase/README.md)

## Words

| Say in the UI | Database / code name |
|---|---|
| **Trail** (an outing) | `sidequests` |
| **Stop** | `sidequest_stops` |
| **Crumb** (a small task at a stop) | `checklist_items` |
| Make a trail | create a `sidequests` row + stops + crumbs |
| Start trail / Finished / Saved | `user_sidequests.status` = `in_progress` / `completed` / `saved` |

Screens say trail and crumb. Code keeps the table names; don't rename tables. (The style guide mentions `quest_checkpoints`; that table doesn't exist. Crumbs are `checklist_items`.)

## How to do a task

1. `git checkout main && git pull`
2. Open your agent in the repo and tell it: **"Do task <ID> from docs/TASKS.md."**
3. Check the result with `npm run dev`, on desktop and at phone width.
4. The agent creates the branch named in the task, runs `npm run build && npm run lint`, and opens a PR. **It doesn't merge.**
5. Wait for CI to go green, then ask a teammate to review and merge. (`main` is protected: no direct pushes.)

## Routes

Every route already exists in `src/App.tsx` and points at a placeholder page. **Replace your page's contents; don't edit `App.tsx`.**

| Path | Screen | Owner | File |
|---|---|---|---|
| `/` | Explore ("Trails for you") | Jason | `src/features/explore/ExplorePage.tsx` |
| `/trails/:id` | Trail detail | Jason | `src/features/trail/TrailDetailPage.tsx` |
| `/trails/:id/go` | Active trail (Start trail) | Jason (later) | `src/features/trail/ActiveTrailPage.tsx` |
| `/make` | Make a trail | Dom | `src/features/make/MakeTrailPage.tsx` |
| `/saved` | Saved | Gio | `src/features/saved/SavedPage.tsx` |
| `/me`, `/u/:username` | You / profile | Gio | `src/features/profile/ProfilePage.tsx` |
| `/onboarding` | Pick a username | Gio | `src/features/auth/OnboardingPage.tsx` |
| `/login`, `/signup` | Auth (done) | Gio | `src/features/auth/AuthPage.tsx` |
| `/map` | Map tab (P1) | later | `src/features/map/MapPage.tsx` |

## Shared code you can use

| What | Where | Status |
|---|---|---|
| `useSession()` → `{ session, profile, loading, signOut, refreshProfile }` | `@/lib/useSession` | ✅ done |
| Supabase client | `@/lib/supabase` | ✅ done |
| Table types `Tables<'sidequests'>` etc. | `@/types/database.types` | ✅ done (regenerate with `npm run db:types`) |
| Allowed values (statuses, categories, T lines…) | `@/types/db-values` | ✅ done |
| `getFeed()`, `getTrail()` + types `FeedTrail`, `TrailDetail` | `@/lib/api/trails` | ✅ done (D1) |
| `saveTrail`, `unsaveTrail`, `joinTrail`, `startTrail`, `finishTrail`, `abortTrail`, `toggleCrumb`, `getMyStatus` | `@/lib/api/progress` | ⏳ stubs exist; filled in by task G2 |

Call shared functions by these names even before they're finished, so nobody waits.

---

## Round 1 (start now, in parallel)

Merge **D1 first** if possible; J1 uses its types.

### D1 · Dom · Trail data functions + sample trails
Branch: `feat/trail-data`
- Create `src/lib/api/trails.ts` using `@/lib/supabase` and the generated types:
  - `getFeed({ category?, maxCost?, maxMinutes? })`: published trails for Explore, newest first. Each item has: id, title, category, cost, duration, `scheduled_at`, `primary_line`, `is_curated`, creator (username, display_name, avatar_url), stop count, crumb count, first and last stop names, rating average + count (view `sidequest_rating_stats`).
  - `getTrail(id)`: one trail with creator, stops in order, crumbs per stop, rating stats, and reviews (`sidequest_ratings` with reviewer profiles).
  - Export the return types: `FeedTrail`, `TrailDetail`.
- Seed 2–3 real, verified Boston trails (including **"Sunday Café Hop"**) owned by a "breadcrumb" team account, with stops, crumbs and `is_curated = true`. Use a new migration or `seed.sql`; follow `supabase/README.md`.
- Add a short "Words" section (trail / stop / crumb → table names) to `AGENTS.md`.

### J1 · Jason · App look, trail card, Explore page
Branch: `feat/explore`
- Bring the style guide into the app: import `docs/styles/tokens.css` and `components.css` (or port them to Tailwind) so colors, type and spacing match the mockups.
- Header in `src/components/layout/AppLayout.tsx`, matching `docs/mockups/Main.dc.html`: breadcrumb logo, Explore / Map / Saved / You nav, search box, orange **Make a trail** button (links to `/make`). Keep the existing `useSession()` log-in / log-out menu. On phones, use the bottom tab bar from the mobile mockups.
- `src/components/TrailCard.tsx`: reusable card with the dotted trail drawing (`docs/tools/trail.js`), title, cost, time, stops, rating; links to `/trails/:id`.
- Explore page (`ExplorePage.tsx`), "Trails for you": tabs For you / Nearby / Friends (only For you needs to work), cost and length filters, grid of `TrailCard`s, map placeholder on the right. Until D1 is merged, use one hard-coded sample shaped like `FeedTrail`, then switch to `getFeed()`.
- Add desktop and phone screenshots to the PR.

### G1 · Gio · Username onboarding + You page
Branch: `feat/onboarding-and-profile`
- Onboarding (`OnboardingPage.tsx`): after login, if `profile.username` is empty, send the user to `/onboarding` to pick a username (3–30 chars: lowercase letters, numbers, `_`; must be unique, so show a friendly message if taken), display name and university. Save with an **UPDATE** on their `profiles` row (never insert), then call `refreshProfile()` and go to `/`.
- Switch `AuthPage`'s own session check to `useSession()`.
- You page (`ProfilePage.tsx`, `/me` = me, `/u/:username` = anyone): avatar, name, university, questgiver rating (view `questgiver_ratings`: average + count), and tabs **Finished / Saved / Signed up / Made**:
  - Finished / Saved / Signed up = the user's `user_sidequests` with status `completed` / `saved` / `signed_up` (only visible on your own page; other people's progress is private).
  - Made = `sidequests` where `creator_id` = that user.
  - Empty states from `docs/mockups/Mobile-Profile.dc.html`.

---

## Round 2 (after your Round 1 PR is merged)

### J2 · Jason · Trail detail page
Branch: `feat/trail-detail`
- `TrailDetailPage.tsx` per the mockup ("Web · Trail detail"), using `getTrail(id)`: title, cost / time / stops / crumbs / rating, description, the trail (stops with crumbs and how to get between them), "Good to know" box, reviews with the three rating bars.
- Buttons: **Start trail** → `startTrail(id)` then go to `/trails/:id/go`; **Save** → `saveTrail` / `unsaveTrail`; **Join** only when `scheduled_at` is set → `joinTrail`. Use `getMyStatus(id)` to show the current state. If logged out, send to `/login?next=/trails/:id`.
- Map on the right: placeholder for now.

### G2 · Gio · Trail actions + Saved page
Branch: `feat/trail-actions-and-saved`
- Fill in every function in `src/lib/api/progress.ts` (keep the names): each writes the user's `user_sidequests` row (`upsert` on `user_id, sidequest_id`); `toggleCrumb` inserts or deletes in `checklist_completions`. The database already enforces the rules (e.g. join only works on scheduled trails); turn its errors into friendly messages.
- Saved page (`SavedPage.tsx`): trails the user saved, signed up for, or has in progress, using `TrailCard`.

### D2 · Dom · Make a trail
Branch: `feat/make-trail`
- `MakeTrailPage.tsx` per the mockup ("Web · Make a trail"): basics (name, short description, category, anytime vs. pick a date), stops (search or add a place, reorder, remove), a crumb at each stop, live preview card, "Ready to publish" checklist, **Save draft** / **Publish trail**.
- Writes `sidequests` (status `draft` / `published`), `sidequest_stops` and `checklist_items`. Save everything together so a half-saved trail can't happen (an RPC function in a new migration is fine).
- Logged-out users are sent to `/login?next=/make`.

---

## Later (P1)

- Active trail page `/trails/:id/go`: live location on a map, crumbs to tick off with `toggleCrumb`, Finished / Save for later / Abort, then the rating screen.
- Rating screen: price, time, enjoyment, memorability (1–5) + review → `sidequest_ratings`.
- Maps: real route map on Explore and Trail detail (Google Maps + MBTA).
- Place research: verified Boston places → `experiences` (see the research brief).

## Rules

- **Stay in your own files.** Shared files (`AppLayout`, `src/lib/`, `App.tsx`, the database): keep changes minimal and say so in the PR.
- **Database changes go through Dom**, as a new migration in its own PR (`supabase/README.md`).
- Name files for what they do and start each with a short header comment (`AGENTS.md`).
- One task per PR. Pull `main` before starting. Never commit `.env`.
