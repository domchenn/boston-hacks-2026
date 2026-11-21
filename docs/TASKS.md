# Breadcrumb — Feature Split (4 people)

Sources: [PRD.md](PRD.md) (v3.0) · [mockup.html](mockup.html) (screens) · [STYLE_GUIDE.md](STYLE_GUIDE.md) · schema in [`supabase/migrations/`](../supabase/migrations/)

**The rule that prevents overlap:** each person owns whole screens *and* the folder they live in. You only edit your own folder. Anything you need from someone else, you get through a **contract**: a component or function with agreed props that the owner publishes as a stub on day one, then fills in.

---

## 0. Decisions

| # | Topic | Decision |
|---|---|---|
| D1 | Framework | ✅ **Stay on Vite + React + React Router.** Supabase is called from the browser and RLS protects data. PRD §8 updated. |
| D2 | Schema | ✅ **Iterate with numbered migrations.** PRD §9 is the first pass. Tables and columns get added as features need them, each in its own migration PR. Process: [`supabase/README.md`](../supabase/README.md). Person A owns migrations. |
| D3 | Name | ✅ **Breadcrumb** is the product/app name. "Sidequest" stays the name of the content type (a Breadcrumb user does sidequests). |
| D4 | Maps key | ⏳ Someone sets up a Google Cloud project with the Maps JS + Directions APIs and shares a referrer-restricted key as `VITE_GOOGLE_MAPS_API_KEY` in `.env`. |
| D5 | Workflow | ✅ **Every change goes through a pull request.** No direct pushes to `main`. Rules for people and AI agents: [`AGENTS.md`](../AGENTS.md). |

## 1. Who owns what

Split by **screen** (see `mockup.html`). Each row is one person's lane, end to end: UI, data calls, and states.

| Person | Lane | Mockup screens | Owns folders |
|---|---|---|---|
| **A** · Claude Code | **Platform + Quest mode** | 3 · Active quest | `supabase/`, `src/lib/`, `src/types/`, `src/features/quest/` |
| **B** · Claude Code | **Maps & Transit + Create** | 5 · Create, 8 · Map tab (P1), the map inside 2 and 3 | `src/features/maps/`, `src/features/create/` |
| **C** · Intermediate | **Discovery + Ratings + UI kit** | 1 · For You, 2 · Detail, 4 · Rate | `src/features/discovery/`, `src/features/ratings/`, `src/components/` |
| **D** · Beginner | **Accounts + Profile + Content** | 6 · Activity tabs, 7 · Profile, login/signup | `src/features/auth/`, `src/features/profile/`, `supabase/seed-content/` |

Why this shape: the two riskiest pieces (database/security and Google Maps/Directions) go to the Claude Code users. C gets standard React + Supabase work that is the heart of the demo. D gets small, self-contained screens plus the seed content, which the demo depends on heavily (PRD §10) and needs no code to start.

### Folder layout

```text
src/
├── App.tsx                 ← route table (A, edited once in Phase 0)
├── components/             ← C: shared UI kit from the style guide
│   ├── ui/                 ← shadcn primitives
│   ├── AppShell.tsx        ← top bar (desktop) + bottom tab bar (mobile)
│   ├── SidequestCard.tsx
│   └── Button.tsx, Pill.tsx, Chip.tsx, EmptyState.tsx
├── lib/                    ← A: supabase client, shared queries, useSession
│   └── api/                ← sidequests.ts, progress.ts, ratings.ts, profiles.ts
├── types/                  ← A: generated database types
└── features/
    ├── auth/      (D)   ├── profile/  (D)
    ├── discovery/ (C)   ├── ratings/  (C)
    ├── maps/      (B)   ├── create/   (B)
    └── quest/     (A)
```

## 2. Contracts (the only places lanes touch)

Each owner pushes a **stub** of their contract in their first PR: real props and types, placeholder output. Everyone else builds against the stub and never waits.

| Contract | Owner → used by | Signature |
|---|---|---|
| Data types | A → all | `Tables<'sidequests'>` etc. from `@/types/database.types` |
| `useSession()` | A → all | `{ session, profile, loading }` |
| Sidequest queries | A → C, D, B | `getFeed(filters)`, `getSidequest(id)` (with stops, checklist, creator, rating stats), `getQuestgiverRating(userId)` |
| Progress API | A → C, D | `getMyProgress(status?)`, `setStatus(sidequestId, 'saved' \| 'signed_up' \| 'in_progress' \| 'completed' \| 'aborted')`, `toggleChecklistItem(itemId)` |
| `<RouteMap>` | B → C (detail), A (quest), B (create) | `stops`, `legs`, `mode: 'preview' \| 'live'`, `userLocation?`, `selectedStopId?`, `onSelectStop?` |
| `<LegDirections>` | B → C, A | `from`, `to`, `mode` → renders T line/bus/walk + time + "Open in Google Maps" |
| `<NearbyStations>` | B → C | `lat`, `lng` → MBTA stations list |
| `<SidequestCard>` | C → D (profile tabs), B (map tab) | `sidequest`, `viewerStatus?` |
| `<RatingForm>` | C → A (after Completed) | `sidequestId`, `onDone` |
| `AppShell`, `Button`, `Pill`, `Chip`, `EmptyState` | C → all | Style-guide classes (`.btn`, `.pill`, `.chip`…) wrapped as React components |

If you need a contract changed, ask its owner. Don't edit their folder.

## 3. Phase 0 — unblock (first ~2 hours, all in parallel)

| Who | Task | Done when |
|---|---|---|
| A | First schema pass (migrations `002`–`009`, PR #2; see `supabase/README.md`): PRD §9 core tables with RLS (progress, photos and saves private; one rating per user; only completers can rate). Regenerate types. | Migration applied, `npm run typecheck` passes |
| A | Add every route to `App.tsx`, each pointing to a placeholder page *inside the owner's folder*. Add `useSession` and stub `lib/api/*`. | Every route renders "Coming soon"; nobody needs to touch `App.tsx` again |
| B | Google Maps spike: map renders with `map-style.json`, one Directions request (transit + walking) works. Push the `<RouteMap>`, `<LegDirections>` stubs. | Real transit route drawn between two Boston points |
| C | Port the style guide: import `tokens.css`/`components.css`, build `AppShell`, `Button`, `Pill`, `Chip`, `SidequestCard`, `EmptyState`. | Placeholder pages render inside the shell on desktop and mobile |
| D | Seed content sheet (no code): **25–40 real experiences** and **8–10 sidequests** built from them, each with stops, a planned activity, travel mode per leg, 2–4 checklist items, a nearby T station. | Sheet shared; A turns it into `seed.sql` |

Route table (A adds these in Phase 0):

| Path | Screen | Owner |
|---|---|---|
| `/` | For You | C |
| `/q/:id` | Detail | C |
| `/q/:id/rate` | Rate | C |
| `/q/:id/play` | Quest mode | A |
| `/create` | Create | B |
| `/map` | Map tab (P1) | B |
| `/login`, `/signup` | Auth | D |
| `/me` | Profile tabs (own) | D |
| `/u/:username` | Public profile | D |

## 4. Lanes (P0 first, P1 after)

### A — Platform + Quest mode (`/q/:id/play`)
1. Phase 0 tasks above.
2. Real implementations of `lib/api/*` and the progress API.
3. Quest mode: `<RouteMap mode="live">` + `watchPosition` (location in memory only, never stored), checklist grouped by stop, **Completed / Saved for later / Abort**, then `<RatingForm>`.
4. Mobile pattern from the mockup: full-screen map, bottom sheet, big checkboxes, swipe to complete.
5. Seed loader: D's sheet → `seed.sql`; demo account with completed quests and ratings.
6. Review every PR that touches `supabase/` or `src/lib/`.
7. *P1:* photo on checklist items + "add photos" tab (Supabase Storage bucket + policies).

### B — Maps & Transit + Create (`/create`)
1. `<RouteMap>`: styled Google map, numbered stop markers, route polylines per the style guide's legend. **Never draw straight lines as routes.**
2. `<LegDirections>`: Directions API per leg (transit/walking/bicycling, never driving), Google Maps deep link.
3. `<NearbyStations>`: MBTA V3 nearest stations to a stop.
4. Create flow: title/description → stops (custom location via Places search; curated library is P1) → planned activity + checklist per stop → travel mode per leg → route preview with total cost and time → visibility and optional scheduled start → publish.
5. Mobile: 4-step flow from the mockup; desktop: form with live preview.
6. Deploy to Vercel early (HTTPS is needed for geolocation and the Maps key's referrer restriction).
7. *P1:* curated experience picker, Map tab, Bluebikes/bus lines (PRD notes).

### C — Discovery + Ratings + UI kit (`/`, `/q/:id`, `/q/:id/rate`)
1. Phase 0 UI kit (everyone depends on it, so do it first).
2. For You: card list via `getFeed()`, newest and highest rated; loading, empty and error states.
3. Detail: header, `<RouteMap mode="preview">`, stops with planned activity, `<LegDirections>` per leg, checklist, ratings and reviews, buttons **Start quest / Save for later / Sign up** (sign up only if `scheduled_start`).
4. `<RatingForm>`: **price, time, enjoyment, memorability** (1–5 each) + optional text; only shown to users who completed it.
5. Overall rating on cards = average of the four scores.
6. *P1:* filters (category, neighborhood, budget, Late night, Under $20, Near a T station), share link.

### D — Accounts + Profile + Content (`/login`, `/signup`, `/me`, `/u/:username`)
1. Phase 0 seed content sheet (start immediately).
2. Login / signup pages with Supabase Auth; log out in the shell's menu. Pair with A on the first PR.
3. Profile: avatar, username, bio, **questgiver rating** (average + count, from A's query).
4. Profile tabs: **Completed, Saved for later, Signed up, Created**. Each is one call to A's progress API, using C's `<SidequestCard>`.
5. Edit profile (username, display name, bio, avatar URL).
6. Empty states for each tab with the style-guide illustrations.

## 5. Hand-offs

| What | From → To | Needed by |
|---|---|---|
| Schema, types, routes, stubs | A → everyone | End of Phase 0 |
| UI kit (`SidequestCard`, shell, buttons) | C → everyone | End of Phase 0 |
| `<RouteMap>` / `<LegDirections>` stubs | B → C, A | End of Phase 0 (real versions by milestone M2) |
| Seed content sheet | D → A | Before M1 |
| `<RatingForm>` | C → A | Before A finishes Completed flow |
| Progress API (real) | A → D, C | Before D's profile tabs |

## 6. Milestones (PRD §12 order)

| Milestone | Check |
|---|---|
| M0 Phase 0 merged | All routes render in the shell; seed data loads |
| M1 Feed + detail (no map yet) | Visitor browses real seeded quests |
| M2 Maps in detail | Route + T/walking directions + nearby stations on a real quest |
| M3 Create → publish | A second account sees it in the feed |
| M4 Quest mode → Completed → Rate | Live location, checklist persists, rating saved |
| M5 Profile tabs + questgiver rating, deployed | Full PRD §13 demo runs on a phone |

P1 starts only after M5 for that lane.

## 7. Working without stepping on each other

- **One branch + one pull request per task:** `feat/<lane>-<thing>` (e.g. `feat/discovery-feed`). Never push to `main`. Small PRs, reviewed and merged the same day.
- **Never edit another lane's folder.** Need a change? Ask the owner or open an issue.
- **Shared files** (`App.tsx`, `package.json`, `src/components/`, `src/lib/`): only their owner edits them. Need a new dependency? Tell the group, add it in its own tiny PR.
- **Database:** only A changes migrations. Need a column? Ask A.
- **Pull `main` at least every 2 hours** and before starting a task.
- **Before pushing:** `npm run build && npm run lint`.
- **Reviews:** A reviews `supabase/` + `src/lib/`; C reviews `src/components/`; A or B reviews D's PRs.
- **AI agents** (Claude Code, Codex, Cursor…) read [`AGENTS.md`](../AGENTS.md) / `CLAUDE.md`, which spell out these rules and the PR workflow.
- **Never commit `.env`.**
