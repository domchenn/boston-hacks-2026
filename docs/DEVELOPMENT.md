# Developing Breadcrumb

How to run, change and deploy the app. For what Breadcrumb is, see the [README](../README.md); for the rules every contributor and AI agent follows, see [AGENTS.md](../AGENTS.md).

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript, React Router |
| UI | Tailwind CSS v4, shadcn/ui, Lucide React |
| Backend | Supabase (PostgreSQL, Auth, Storage), `@supabase/supabase-js` |
| Maps/transit | Google Maps JS + Directions/Places, MBTA V3, Bluebikes GBFS |
| Deployment | Vercel configuration and OG Edge Function; hosted settings require verification |

## Getting started

Use Node 22.22+ within Node 22 to match CI and the locked React Router engine requirement. Local M00 validation used Node 24.8.0; CI selects Node 22. No runtime version file or package engines constraint is committed.

```bash
git clone https://github.com/domchenn/breadcrumb.git
cd breadcrumb
npm ci
cp .env.example .env   # then fill in the values, see below
npm run dev
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the web dev server at http://localhost:5173 |
| `npm run dev:api` | Build and start the API at http://localhost:3001 (`/health`, `/v1/meta`, `/v1/me`, docs at `/docs`). Needs `apps/api/.env` (copy `apps/api/.env.example`) |
| `npm run build` | Type-check and build every app (`apps/web/dist/`, `apps/api/dist/`) |
| `npm run typecheck` | Type-check every app |
| `npm run lint` | Run ESLint in every app |
| `npm test` | Run unit tests (Vitest in `packages/contracts` and `apps/api`) |
| `npm run test:integration -w @breadcrumb/api` | API RLS integration tests against a running local Supabase (env vars in `apps/api/test/integration/local-supabase.ts`; CI runs them) |
| `npm run db:new -- <name>` / `db:push` / `db:status` / `db:types` | Database migrations (see [`supabase/README.md`](../supabase/README.md)) |
| `npm run test:db` | Run pgTAP against local Supabase (Docker) |
| `npm run branches:prune` | List local branches already merged into main/develop (`-- --delete` removes them; never touches main, develop, the current branch or unmerged work) |
| `npm run preview` | Serve the production build locally |

### Environment variables

Set these in `.env`. That file is gitignored, so never commit it.

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same page → **publishable** key (or the legacy `anon` key) |
| `VITE_MBTA_API_KEY` *(optional)* | [api-v3.mbta.com](https://api-v3.mbta.com) → request a key. Raises the MBTA rate limit; the app works without it. |
| `VITE_GOOGLE_MAPS_API_KEY` *(optional)* | Google Cloud Console → a browser key with **Maps JavaScript API** and **Directions API** enabled, restricted to `http://localhost:5173/*` and the Vercel domain. Without it, maps show a stop list with Google Maps links. |

Anything prefixed with `VITE_` is shipped to the browser. **Never** put the `service_role` or secret key in this app. Security is enforced by Row Level Security in the database, not by the frontend.

If the variables are missing, `apps/web/src/lib/supabase.ts` throws a clear error the first time the client is imported.

## Supabase database setup

The schema lives in **[`supabase/migrations/`](../supabase/migrations/)**: one SQL file per change, each named for what it does and starting with a header comment. They're applied with the **Supabase CLI**, which tracks which migrations have run. Full workflow: [`supabase/README.md`](../supabase/README.md).

Use a disposable local Supabase database for development and tests. See [database workflow](../supabase/README.md). Shared environments already contain data: do not reset them. Remote changes require a reviewed migration, verified target and task-specific human authorization.

Enable sign-in providers and allow the correct `/login` redirects separately in each environment. `supabase/config.toml` currently specifies port 3000 for local auth, while Vite normally runs on 5173; reconcile and test this in M03. Local config does not prove hosted auth settings.

### What the schema enforces

Migrations run in timestamp order; [`supabase/README.md`](../supabase/README.md) lists what each one does.

- A profile row is created automatically on signup (`username` starts as `NULL` and is chosen during onboarding).
- Draft sidequests, and everything attached to them, are visible only to their creator. Community-only sidequests are visible only to that community's members.
- Each user has **one progress row per sidequest** in `user_sidequests` (`saved`, `signed_up`, `in_progress`, `completed`, `aborted`). It's private to that user. Signing up is only allowed for sidequests with a scheduled start.
- Checklist ticks are private and only allowed on a quest you've started.
- Ratings (price, time, enjoyment, memorability, 1–5 each) require a **completed** run, one per user, and creators can't rate their own. The views `sidequest_rating_stats` and `questgiver_ratings` give the averages.
- `experiences` (the curated place library) is read-only for users; the team adds rows through `seed.sql`.
- Users can only write their own rows. Deleting a sidequest cascades to everything attached to it. Use `status = 'archived'` to hide one instead.

### Database types

`apps/web/src/types/database.types.ts` gives TypeScript types for every table, generated from the live project. After any migration is pushed, regenerate it with `npm run db:types` and commit the result. Don't edit it by hand. Allowed values for restricted text columns (statuses, categories, T lines…) live in `apps/web/src/types/db-values.ts`.

## Folder structure

```text
package.json            npm workspaces root: app scripts forward to apps/web; db:* scripts
package-lock.json       the one lockfile
.env                    local env for the web app (Vite reads it from the repo root)
packages/contracts/     @breadcrumb/contracts: API schemas (Zod), types and typed client, see below
apps/api/               NestJS + Fastify API (not deployed yet), see below
apps/web/               the Vite web app (Vercel Root Directory)
├── src/
│   ├── components/     shared components; ui/ = shadcn primitives, layout/ = app shell
│   ├── pages/          fallback page (NotFoundPage); screens live in features/
│   ├── features/       feature screens, hooks and adapters
│   ├── lib/            api/ adapters, supabase.ts (the ONE client), maps/transit clients
│   ├── types/          database.types.ts (generated) and db-values.ts
│   ├── App.tsx         route table
│   ├── main.tsx        entry point
│   └── index.css       Tailwind + theme tokens (imports docs/styles/)
├── api/og.ts           Vercel Edge Function for link previews (Open Graph tags)
├── api/og-image.ts     draws the 1200×630 preview image for a trail (or the default card)
├── public/             favicon and other static files
├── index.html, vite.config.ts, vercel.json, tsconfig*.json, eslint.config.js, components.json
└── package.json        app dependencies and scripts
docs/                   specs, style guide; docs/styles and docs/assets are imported by the app
supabase/               CLI config, migrations, seed.sql and pgTAP tests (run from the repo root)
```

Run npm commands from the repo root; app commands forward to `apps/web` (for example `npm run dev -- --host`). Add app dependencies with `npm install <pkg> -w @breadcrumb/web`. `apps/web/api/og.ts` is the Vercel Edge Function, outside the app TypeScript project. See [M00 baseline](refactor/BASELINE.md) for the current inventory.

## API (`apps/api`)

A NestJS 12 app on Fastify. It verifies Supabase logins (M08) and serves the trail reads `GET /v1/trails` and `GET /v1/trails/:id` (M10). Not deployed yet (M07). Requires Node 22.12+.

- `src/create-app.ts` builds the app for both `main.ts` and the tests: Pino JSON logs, `x-request-id` on every response (a safe caller value is reused), the CORS allow-list, one error shape `{ error, message, requestId }`, and the OpenAPI document at `/v1/openapi.json` (interactive docs at `/docs` outside production).
- `src/config/env.ts` validates settings at startup and exits with a readable list of problems. Settings: `NODE_ENV`, `APP_ENV` (`local`/`staging`/`production`), `HOST`, `PORT` (default 3001), `LOG_LEVEL`, `CORS_ORIGINS` (comma-separated origins, default `http://localhost:5173`). Read config through the `APP_CONFIG` token, never `process.env` directly.
- `GET /health` is outside `/v1` for host health checks; product endpoints live under `/v1`.
- **Auth is deny-by-default.** A global guard requires `Authorization: Bearer <Supabase access token>` on every route unless it is marked `@Public()` (no token read) or `@OptionalAuth()` (no token is fine, a bad one is still rejected). Tokens are verified against the project's public keys at `SUPABASE_URL/auth/v1/.well-known/jwks.json`: ES256/RS256 only, issuer, audience `authenticated`, expiry (30 s tolerance) and role `authenticated`, so anon/publishable keys and service-role tokens are refused. Bad tokens get 401 with no details (the reason is logged at debug level); if the keys can't be fetched the API answers 503 instead of letting the request through. The API needs no Supabase secret. Use `@CurrentUser()` to read the user; it carries the access token so later data access can run as that user under RLS.
- Validate inputs with `new ZodValidationPipe(schema)` on `@Body`, `@Query` or `@Param`; failures are 400s listing each field. Annotate those parameters with a plain type alias (`type ListQuery = z.infer<typeof Schema>`), not the schema's own name, or Swagger mistakes the schema for a class.
- **Data access runs as the caller.** `SupabaseClients.forUser(user)` gives a Supabase client with the publishable key plus the caller's own token (or none when signed out), so Postgres RLS decides what every query returns, exactly as for the web app. The API holds no secret or service-role key. Settings: `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- **Trails:** `GET /v1/trails` (filters from `TrailListQuery`) and `GET /v1/trails/:id` (404 when missing or hidden) return the `@breadcrumb/contracts` shapes, with the same queries as the web's `getFeed`/`getTrail`. Sign-in is optional on both.
- **Profiles and personal lists:** `GET /v1/profiles/:handle` (id or username), `/v1/profiles/:id/stats` and `/v1/profiles/:id/made-trails` (sign-in optional), plus the caller's own `GET /v1/me/trails?status=completed|saved|signed_up` and `GET /v1/me/saved-trails` (sign-in required). Same queries as the web's profile and Saved adapters, which use them when `VITE_API_URL` is set.
- **Save / unsave:** `PUT` and `DELETE /v1/me/saved-trails/:trailId` (sign-in required) apply the same transition table as the web's `lib/api/progress.ts` and answer `{ status }`, the caller's resulting status. A trail hidden from the caller is a 404. The web's `saveTrail`/`unsaveTrail` use them when `VITE_API_URL` is set and throw the same `ProgressError` codes.
- **Create / edit trails:** `POST /v1/trails` and `PUT /v1/trails/:id` (sign-in required) take the `save_trail()` payload (`SaveTrailBody`, exactly what the web's `toSavePayload` builds) and call `save_trail()` as the caller, so the publish checklist, community, visibility and remix rules all stay in the database. Its rule messages come back as 422 (rules) or 403 (not yours, not your community, a remix you can't see). The web's Make/Edit pages use them when `VITE_API_URL` is set. The editor's other calls: `GET /v1/trails/:id/stop-library` (sign-in optional; each stop's place-library link, for Edit and Remix), `POST /v1/trails/:id/unpublish` and `DELETE /v1/trails/:id` (404 unless it's your trail).
- **Profile fields:** `GET` and `PUT /v1/me/profile` (sign-in required) read and save your username and display name for onboarding. A taken username is 409, a value the database refuses is 422, and a blank display name is stored as none. University is no longer a profile field (it was for the hackathon); migration `drop_profile_university` removes the column and its values. The web's `features/auth/onboarding-api.ts` uses them when `VITE_API_URL` is set.
- **Trail progress:** `GET /v1/me/trails/:trailId/progress`, `POST /v1/me/trails/:trailId/{start,finish,abort}`, `GET /v1/me/trails/:trailId/crumbs` and `PUT`/`DELETE /v1/me/crumbs/:crumbId` (sign-in required) follow the same status table as save/unsave (a finished trail never moves). Crumbs can be ticked only while the trail is in progress (RLS, `private.can_complete_item`), otherwise 403; stopping keeps earlier ticks, starting again continues with them, and unticking always works. The web's `lib/api/progress.ts` uses them when `VITE_API_URL` is set.
- **Ratings:** `GET`, `PUT` (create or edit) and `DELETE /v1/me/trails/:trailId/rating` (sign-in required) read and write the caller's own row in `sidequest_ratings` and answer `{ rating }` (null = none). The body is four whole scores from 1 to 5 plus an optional review of up to 2,000 characters (`RatingBody`); a blank review is stored as none. The database trigger `validate_rating` keeps the rules: a trail you haven't finished is 422, your own trail is 403. The web's `lib/api/ratings.ts` uses them when `VITE_API_URL` is set.
- **Explore, badges and communities:** `GET /v1/trending?days=&limit=` (sign-in required; `trending_trails()`, totals only), `GET /v1/neighborhoods` and `GET /v1/communities` (sign-in optional), `GET /v1/me/finished-trails` (your finished trails with line and neighborhood, for badges) and `PUT /v1/me/community` with `{ communityId }` (null = none; an unknown id is 422). Same queries as `features/explore/api.ts`, `features/badges/api.ts` and `features/communities/api.ts`, which use them when `VITE_API_URL` is set.
- **Follows and friends:** `GET /v1/profiles/:id/follow-counts`, `/followers` and `/following` (sign-in optional; follows are public), and for the caller: `GET /v1/me/following-ids`, `PUT`/`DELETE /v1/me/following/:userId`, `GET /v1/me/relationships/:userId`, `GET /v1/me/friends` (mutual follows), `GET /v1/me/close-friends`, `PUT`/`DELETE /v1/me/close-friends/:userId` (friends only, else 403) and `PUT /v1/me/privacy` with `{ isPrivate }`. Following yourself is 422; repeating a follow or close-friend add is fine. The web's `features/friends/api.ts` uses them when `VITE_API_URL` is set.
- **Friends' activity and finding people:** `GET /v1/trail-cards?ids=a,b` (sign-in optional, at most 100 ids; hidden trails are left out), and signed in: `GET /v1/me/friends-activity?limit=` (`friends_activity()` with a card per trail, made and finished only), `GET /v1/me/friends-also-saved` (`friends_also_saved()`), `GET /v1/people?q=&limit=` (search by @username or name, never yourself) and `GET /v1/me/suggested-people?limit=`. The web's `features/friends/api.ts`, `alsoSaved.ts` and `findPeopleApi.ts` use them when `VITE_API_URL` is set.
- **Photos:** `GET /v1/trails/:trailId/photos` (sign-in optional), `POST /v1/trails/:trailId/photos` with the image itself as the body (`Content-Type: image/jpeg|png|webp`, at most 5 MB; optional `?caption=` and `?stopId=`) and `DELETE /v1/photos/:photoId` (your own). The API re-encodes uploads with `sharp` as a JPEG of at most 1600 px with no GPS or other metadata (HEIC is refused with 415), stores it as you in the private `photos` bucket at `<trail id>/<random>.jpg` (no user id), and returns a signed link that works for an hour. Storage only signs photos for people who can see the trail, so photos on friends-only, close-friends and private-account trails stay private even by direct link. Older photos in the public `trail-photos` bucket keep their public link. Deleting a trail (`DELETE /v1/trails/:id`) removes every photo file on it. Not a trail you saved, started or finished: 403. The web's `lib/api/photos.ts` uses them when `VITE_API_URL` is set. The integration tests need local Storage running (CI starts it).
- **Reports and moderation:** `POST /v1/reports` (anyone signed in; one report per person per item, repeating is fine) and `GET /v1/me/admin` (`{ isAdmin }`). For team moderators only (`profiles.is_admin`, set by the team; others get 403): `GET /v1/admin/reports` (open reports with a preview) and `POST /v1/admin/reports/:reportId/resolve` with `{ action: "hide" | "dismiss" }`. Hide archives a trail, or deletes a review or a photo (its file too). Either way every open report on that item closes; a handled report is 409. `POST /v1/admin/photos/move-older` (moderators) moves every older public photo into private storage as a cleaned JPEG, keeps the uploader as the file's owner and deletes the old file; anything it can't move is listed with a reason, and it's safe to run again. The web's `features/reports/api.ts` uses them when `VITE_API_URL` is set.
- **Deleting your account:** `DELETE /v1/me` with `{ "confirm": true }` (sign-in required). It removes your photo files first: everything on your own trails, your photos elsewhere, and your folder in the older public bucket. If Storage refuses any of it, nothing else is deleted (503) and you can retry. Then `delete_my_account()` deletes the sign-in account, and the database cascade removes the rest. Reports you filed are kept without your name. The website's Settings shows Delete account only when `VITE_API_URL` is set.
- **RLS equivalence tests** (`test/integration/trails.rls.test.ts`) create throwaway users, follows, close friends, a community and trails of every visibility in a local Supabase, then check for each kind of viewer that the API returns exactly what Supabase returns for the same token. They refuse non-localhost targets and delete their fixtures.
- **Container image:** `docker build -f apps/api/Dockerfile -t breadcrumb-api .` from the repo root. Two stages: compile, then a distroless Node 22 image (no shell, non-root) with only the compiled API, `@breadcrumb/contracts` and production packages (~330 MB). Run it with the same settings as `.env.example`, e.g. `docker run -p 8080:8080 --env-file apps/api/.env breadcrumb-api`; it listens on `PORT` (8080 by default, as Cloud Run expects) and shuts down cleanly on SIGTERM. CI builds it and smoke-tests `/health` on every PR. Hosting: Google Cloud Run (staging project `breadcrumb-staging-515905`; production in the existing `breadcrumb` project). See [DECISIONS.md](refactor/DECISIONS.md).
- Tests in `apps/api/test/` use Fastify's in-memory `inject` and a local fake Supabase key server (`test/support/fake-supabase.ts`), so they need no network.

## Web → API switch (`VITE_API_URL`)

`getFeed`/`getTrail` (`apps/web/src/lib/api/trails.ts`) and the profile and Saved page reads (`features/profile/api.ts`, `features/saved/api.ts`) go through the API when `VITE_API_URL` is set and query Supabase directly when it isn't. Signatures and return shapes are the same either way, so pages don't change. The client (`src/lib/apiClient.ts`) sends the signed-in user's Supabase token and is loaded on first use as a separate chunk, so builds without the variable don't grow. Only the staging Vercel project sets it for now; production and local dev stay on direct Supabase until the API is released. Point it only at an API that uses the same Supabase project as `VITE_SUPABASE_URL`: tokens from another project are refused (401).

## Shared contracts (`packages/contracts`)

`@breadcrumb/contracts` defines what the API sends and accepts, in one place for the API, the web app and later mobile:

- Zod schemas with matching TypeScript types: allowed values (`Category`, `TransitLine`, …), the trail read contract (`FeedTrail`, `TrailList`, `TrailDetail`, `TrailListQuery`, `TrailIdParams`) and `ApiErrorBody`. Trail shapes match the web's `FeedTrail`/`TrailDetail` in `apps/web/src/lib/api/trails.ts` field for field.
- `createApiClient({ baseUrl, getAccessToken })`: `getTrails(filters)` and `getTrail(id)` send the Supabase token, validate every response and throw `ApiError` (status, code, requestId) on failures; `getTrail` returns null on 404.
- It is an ESM package built with `tsc -b` into `dist/`. The API references it as a TypeScript project, so its `build`, `typecheck` and `test` build the contracts first; the root `build` runs packages before apps. Change a schema here first, then the API and clients.

## Deploying (Vercel)

The app is a static Vite site in `apps/web`, so each Vercel project's **Root Directory** is `apps/web`. Vercel uses its default install, which reuses cached `node_modules`; a custom `npm ci` install was tried and was slower because it discards that cache. `apps/web/vercel.json` builds it and sends regular SPA URLs (e.g. `/trails/123`) to `index.html` so React Router handles refreshes; crawler/API requests have separate handling.

Vercel deployment is intentionally manual, as confirmed by the active developer. Keep Git deployments disabled (`git.deploymentEnabled: false`) in **both** `apps/web/vercel.json` and the small root `vercel.json`. Vercel reads the file in each project's Root Directory, so the root copy keeps Git deploys off for any project still pointed at the repo root. Do not assume merges or PRs deploy anything. The crawler rewrite for `/trails/:id` goes to `apps/web/api/og.ts`; regular SPA routes fall back to `index.html`. Preserve both during file moves.

Before configuring staging (M03), verify the existing Vercel project, production branch, manual deployment method, domain, environment scopes, Supabase auth redirects and restricted browser keys. Never reuse production credentials/data in previews by assumption. New services, secrets and deployments require human configuration/authorization. The target integration/release workflow is in [REFACTOR.md](refactor/REFACTOR.md).

Integration is active: start feature branches from updated `develop` and target PRs there; release PRs go `develop` → `main`. Both required app/database CI checks protect develop. Vercel Git deployments and Supabase automatic production deployments are disabled; releases and remote migrations require separate human action. See [M02 integration evidence and workflow](refactor/INTEGRATION.md).

## Team conventions

**Feature folders.** Claim one task at a time; folders organize code rather than permanent developer ownership. Current examples:

```text
apps/web/src/features/
├── auth/         sign-in and onboarding
├── explore/      feed, filters and discovery tabs
├── trail/        detail, active trail, photos and reviews
├── make/         create, edit and remix
├── profile/      public/private profile screens
└── map/          map screen (shared clients in lib/)
```

- Put Supabase queries in `apps/web/src/features/<feature>/api.ts`, not inside components.
- Don't import another feature's internals. If two features need something, move it to `components/`, `lib/` or `hooks/` under `apps/web/src/`.
- Use the row types: `import type { Tables } from '@/types/database.types'` → `Tables<'sidequests'>`.
- Add your routes to `apps/web/src/App.tsx` as children of `AppLayout`. Keep that diff small to avoid conflicts.
- Use the `@/` alias for imports from `apps/web/src`.
- Add UI primitives from `apps/web` with `npx shadcn@latest add button card ...` (they land in `apps/web/src/components/ui/`). Use theme tokens (`bg-primary`, `text-muted-foreground`), not hard-coded colors. Design mobile-first: base styles target phones, and `sm:`/`md:` add larger layouts.
- Follow [AGENTS.md](../AGENTS.md) for branch bases: baseline/bootstrap against verified main until M02; features against develop after integration is verified. Run lint, typecheck, build and relevant local database tests. Never merge automatically.
- Never commit `.env` or any secret key.
