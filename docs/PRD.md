# Sidequests — Product Requirements Document

**Event:** BostonHacks 2026  
**Track:** Bos(tons) of Eats and Streets  
**Version:** 1.0 — hackathon MVP  
**Tagline:** *You've lived here. Have you explored it?*

> **Source of truth:** This PRD reflects the team direction for the hackathon. Reference [team info document](https://docs.google.com/document/d/1CBDr5Bf8ZIl1EpXyc-8X73ORRvTf4xKU4OP8l3hbIV8/edit?usp=sharing). If details conflict, confirm with the team before changing requirements.

## 1. Problem and opportunity

Students can spend years in Boston and still struggle to answer: **“What should we do this weekend?”** Recommendations are scattered across social media, friends, event sites, and maps. Planning with friends and navigating without a car is inconvenient.

**Sidequests** is a social platform for discovering, creating, joining, navigating, completing, and reviewing local outings. It combines inspiration from Beli (reviews), Strava (activity history), and Partiful (social plans), while prioritizing Boston-area student exploration.

## 2. Hackathon alignment and constraints

The Bos(tons) of Eats and Streets track asks for a **web app** using Boston public transit to help college students discover and navigate food spots, local activities, and Boston experiences based on cravings/interests, budget, and location.

- **Audience:** University students in Boston and Cambridge.
- **Geography:** Greater Boston, emphasizing Boston/Cambridge and car-free reachability.
- **Transport:** MBTA bus and train, walking, biking; no driving-first flows.
- **Core principle:** Transit supports the experience but is not the entire app. Demonstrate real MBTA information or legitimate transit routing rather than a decorative map.

## 3. Product model

| Concept | Definition |
|---|---|
| **Sidequest** | Primary shareable post: one or more ordered destinations, either an anytime itinerary or a scheduled outing. |
| **Stop** | A named place or activity with location, description, and order. |
| **Scheduled outing** | Sidequest with date/time; other students can join. |
| **Anytime itinerary** | Reusable sidequest without scheduled time; users can save and complete independently. |
| **Quest run** | A user's instance of starting a sidequest, with individual progress and completion. |
| **Checkpoint** | A creator-defined sight or activity checkbox associated with a quest or stop. |
| **Review** | A completed user's fun, value/cost, and travel convenience ratings plus optional text. |

Example: **Sunday Cafe Hopping** — three stops across Back Bay and Beacon Hill, estimated $20, two hours, accessible by walking and the T; users can save it or join if scheduled.

## 4. Core user journey

**Discover → Inspect → Save / Join → Start Quest → Navigate + Check Off → Complete + Rate**

1. The For You feed shows curated and user-created sidequests with title, estimated cost, time, creator, and summary.
2. The user opens a sidequest for details, ordered stops, descriptions, approximate duration and budget, ratings, and route preview.
3. The user can save it; scheduled quests also support joining. These are separate states.
4. **Start Quest** opens the active quest view. It asks for device location permission and shows current position on a map if permitted.
5. The active view provides transport guidance and a persistent scavenger-hunt checklist of sights and activities.
6. The user marks the quest completed, sees it in their history, and optionally rates it.

## 5. MVP features — P0

### 5.1 Accounts and profiles

- Supabase Auth signup, login, logout.
- Public username/display name and optional avatar/university.
- Distinct lists for **Created, Saved, Joined, In Progress, Completed**.
- Do not infer one state from another.

### 5.2 For You feed

- Mobile-first, scrollable sidequest cards.
- Each card: title, short description, creator, approximate cost, duration or scheduled time, cover image if available.
- Seed **8–12 realistic Boston sidequests** so the app feels useful before community activity exists.
- Simple category/budget filters if feasible. “For You” initially means curated or recent/popular ordering, **not** ML personalization.

### 5.3 Sidequest detail

- Title, detailed description, creator, scheduled/anytime label.
- Ordered stops, addresses, location descriptions, estimate of total cost/duration.
- Ratings/reviews and stylized route/map preview.
- Clear, persistent **Save**, **Join** (scheduled only), and **Start Quest** actions.

### 5.4 Sidequest creation

- Title, description, category, anytime versus scheduled date/time, estimated cost and duration.
- One or more ordered stops; add, remove, reorder stops.
- Use curated place selection or a supported places API instead of requiring manual coordinates.
- Publishing makes a sidequest discoverable. Author edit/delete if time allows.

### 5.5 Maps and active quest

- Interactive map with numbered stop markers, stop ordering, and selected-place details.
- Show real walking/transit/biking routes when a provider supports them; otherwise clearly link to external directions.
- On **Start Quest**, ask permission for browser geolocation. Show live user position during the active session only when granted; gracefully handle denial/unavailable GPS.
- Show creator-defined checklist items underneath the map; persist each user's checked/unchecked progress.
- Users can mark a quest complete.
- **Never** represent straight-line connectors as actual navigable routes; do not invent travel time, vehicle location, or path geometry.

### 5.6 Saves, joins, completions, reviews

- Save/unsave both kinds of sidequest.
- Join/leave **scheduled** sidequests only.
- Start and complete personal quest runs, preserving individual checkpoint state.
- Only completed users can review; one review per user per sidequest.
- Ratings are **Fun Factor (1–5)**, **Value/Cost (1–5)**, **Travel Convenience (1–5)**, plus optional text.
- Show simple average scores and review the count.

## 6. Stretch features — P1/P2

| Priority | Feature | Intended behavior |
|---|---|---|
| P1 | University communities | BU, BC, Northeastern, etc. community discovery feeds or filters. |
| P1 | Suggested route checkpoints | Optional scenic detours beyond the creator's required stops. |
| P1 | Friends/following | Follow creators and see friends' quests; later inform recommendations. |
| P2 | Remix | Clone a public itinerary, change stops, republish with attribution. |
| P2 | Recommendation ranking | Budget, preferences, social signals, location, reachability. AI not required. |

**Note:** Creator-defined quest checklist items are **P0**; *additional suggested checkpoints along a route* are **P1**. These are different features.

## 7. Screens and navigation

| Screen | Purpose |
|---|---|
| Home / For You | Discover sidequests; basic filtering/search; open details. |
| Sidequest Detail | Details, stops, ratings, map preview, actions. |
| Active Quest | Location (permission-based), route guidance, checklist, complete. |
| Create | Build/publish itinerary and optional schedule. |
| My Activity | Saved, joined, in progress, completed, created. |
| Profile / Auth | Account and quest history. |

Design for mobile first. Consumer-social style, not a generic dashboard; prioritize feed, detail, and active map flow.

## 8. Technical architecture

- **Frontend:** React 19, Vite, **TypeScript/TSX**, React Router, Tailwind CSS, shadcn/ui if useful, Lucide.
- **Backend:** Supabase Auth, PostgreSQL, Row Level Security, Storage if needed.
- **Hosting:** Vercel or Netlify.
- **Maps:** Choose a provider after confirming quotas/credentials/routing capabilities. MapLibre plus map tiles works for visualization.
- **Transit:** MBTA V3 API for stops/routes; a separate routing provider or external links may be required for multimodal directions.
- **Security:** Client uses only public/publishable Supabase credentials. No service-role secrets in Vite. Geolocation requires user consent and usually HTTPS; **do not store continuous user location history for the MVP**.

## 9. Proposed Supabase data model

The SQL migration is the implementation source of truth for exact constraints. Initial conceptual entities:

| Table | Primary fields / purpose |
|---|---|
| `profiles` | `id` (FK to auth.users), `username`, `display_name`, `university`, `avatar_url`, `created_at` |
| `sidequests` | `id`, `creator_id`, `title`, `description`, `category`, `cover_image_url`, nullable `scheduled_at`, `estimated_cost`, `estimated_duration`, `status`, `created_at` |
| `sidequest_stops` | `id`, `sidequest_id`, `stop_order`, `place_name`, `address`, `latitude`, `longitude`, `description` |
| `quest_checkpoints` | `id`, `sidequest_id`, nullable `stop_id`, `label`, `sort_order` — defined objectives |
| `saved_sidequests` | `user_id`, `sidequest_id`, `created_at` — unique user/quest pair |
| `sidequest_participants` | `user_id`, `sidequest_id`, `status`, `joined_at` — scheduled events only |
| `quest_runs` | `id`, `user_id`, `sidequest_id`, `status`, `started_at`, `completed_at` — personal quest progress |
| `checkpoint_completions` | `quest_run_id`, `checkpoint_id`, `completed_at` — unique pair |
| `sidequest_reviews` | `id`, `user_id`, `sidequest_id`, `fun_rating`, `value_rating`, `travel_rating`, `review_text`, `created_at` |

**Schema rules:** Enforce RLS on owned records, published-quest read visibility for associated stops/checkpoints, 1–5 rating checks, valid coordinate constraints, nonnegative costs, and unique stop order per quest. Reviews must require completed runs using secure database validation, not just frontend checks.

## 10. Two-developer split

| Owner | Responsibilities | Integration boundary |
|---|---|---|
| **Developer 1 — Discovery & Social** | Auth, profiles, feed, sidequest cards/detail, saves/joins, reviews, activity lists. | Uses shared sidequest queries/types; renders map/Start Quest entry points but doesn't implement routing. |
| **Developer 2 — Creation & Quest Experience** | Create/edit sidequests, stops/checkpoints, interactive maps, Start Quest geolocation, quest runs/checklist persistence, MBTA/navigation. | Provides creation forms, map view, and run/checkpoint APIs for detail/activity screens. |

**Before branching:** Agree on schema/migrations, generated database types, Supabase client, route paths, design tokens, and basic shared component contracts. Coordinate migrations and shared-file changes.

## 11. Acceptance criteria and demo

- **Discovery:** Visitor sees realistic Boston sidequests and can inspect a complete itinerary.
- **Social state:** Authenticated user can save and appropriately join quests; state persists across refreshes.
- **Creation:** A user publishes a multi-stop quest; another user can find it in the feed.
- **Navigation:** Stops appear on a map with usable transit/walking directions or a labeled external fallback.
- **Active quest:** Start Quest requests location permission, displays location when allowed, and presents a persisted checklist.
- **Completion:** Completed quests appear in a user's activity; completed users can leave categorized reviews.

**Three-minute demo:** “You've lived in Boston for years but don't know what to do Saturday.” Open *Sunday Cafe Hopping* → inspect stops/budget → save or join → view transit map → Start Quest (location + checklist) → complete → rate → show profile history.

## 12. Scope and risks

- **Highest technical risk:** Reliable multimodal transit routing. Validate providers early; preserve external directions fallback.
- **Privacy:** Request GPS only when navigating; never expose a user's location to others.
- **Data quality:** Seed verified Boston locations; label demo content and avoid made-up opening hours, events, or travel estimates.
- **Priority:** Build a complete **browse → detail → start → checklist → complete** flow before communities, social graph, or sophisticated recommendations.
- **Definition of done:** Deployed mobile-friendly app, Supabase-backed quest states, credible seed content, working map/navigation fallback, and stable end-to-end demo.
