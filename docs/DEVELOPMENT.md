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
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm run build` | Type-check, then build for production into `dist/` |
| `npm run typecheck` | Type-check only (`tsc -b --noEmit`) |
| `npm run lint` | Run ESLint |
| `npm run db:new -- <name>` / `db:push` / `db:status` / `db:types` | Database migrations (see [`supabase/README.md`](../supabase/README.md)) |
| `npm run test:db` | Run pgTAP against local Supabase (Docker) |
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

If the variables are missing, `src/lib/supabase.ts` throws a clear error the first time the client is imported.

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

`src/types/database.types.ts` gives TypeScript types for every table, generated from the live project. After any migration is pushed, regenerate it with `npm run db:types` and commit the result. Don't edit it by hand. Allowed values for restricted text columns (statuses, categories, T lines…) live in `src/types/db-values.ts`.

## Folder structure

```text
src/
├── assets/             static images/fonts imported by code
├── components/
│   ├── ui/             shadcn/ui primitives (generated: `npx shadcn@latest add <name>`)
│   └── layout/         app shell (AppLayout: header + <Outlet/>)
├── pages/              fallback page (NotFoundPage); screens live in features/
├── features/           implemented feature screens, hooks and adapters
├── lib/
│   ├── api/             shared trail, progress, rating and photo adapters
│   ├── supabase.ts     the ONE shared Supabase client
│   └── utils.ts        cn() class helper
├── types/
│   └── database.types.ts
├── App.tsx             route table
├── main.tsx            entry point
└── index.css           Tailwind + theme tokens
supabase/
├── config.toml        Supabase CLI config
├── migrations/        one SQL file per schema change (CLI-managed)
└── seed.sql
```

Implemented features already live under `src/features/`; shared data adapters are in `src/lib/api/`, with maps/transit clients in `src/lib/`. `api/og.ts` is the Vercel Edge Function at repository root, outside the app TypeScript project. See [M00 baseline](refactor/BASELINE.md) for the current inventory.

## Deploying (Vercel)

The app is a static Vite site. `vercel.json` builds it and sends regular SPA URLs (e.g. `/trails/123`) to `index.html` so React Router handles refreshes; crawler/API requests have separate handling.

`vercel.json` explicitly disables Git deployments (`git.deploymentEnabled: false`). Do not assume merges or PRs deploy anything. The crawler rewrite for `/trails/:id` goes to `api/og.ts`; regular SPA routes fall back to `index.html`. Preserve both during file moves.

Before configuring staging (M03), verify the existing Vercel project, production branch, manual deployment method, domain, environment scopes, Supabase auth redirects and restricted browser keys. Never reuse production credentials/data in previews by assumption. New services, secrets and deployments require human configuration/authorization. The target integration/release workflow is in [REFACTOR.md](refactor/REFACTOR.md).

## Team conventions

**Feature folders.** Claim one task at a time; folders organize code rather than permanent developer ownership. Current examples:

```text
src/features/
├── auth/         sign-in and onboarding
├── explore/      feed, filters and discovery tabs
├── trail/        detail, active trail, photos and reviews
├── make/         create, edit and remix
├── profile/      public/private profile screens
└── map/          map screen (shared clients in src/lib/)
```

- Put Supabase queries in `src/features/<feature>/api.ts`, not inside components.
- Don't import another feature's internals. If two features need something, move it to `src/components/`, `src/lib/`, or `src/hooks/`.
- Use the row types: `import type { Tables } from '@/types/database.types'` → `Tables<'sidequests'>`.
- Add your routes to `src/App.tsx` as children of `AppLayout`. Keep that diff small to avoid conflicts.
- Use the `@/` alias for imports from `src`.
- Add UI primitives with `npx shadcn@latest add button card ...` (they land in `src/components/ui/`). Use theme tokens (`bg-primary`, `text-muted-foreground`), not hard-coded colors. Design mobile-first: base styles target phones, and `sm:`/`md:` add larger layouts.
- Follow [AGENTS.md](../AGENTS.md) for branch bases: baseline/bootstrap against verified main until M02; features against develop after integration is verified. Run lint, typecheck, build and relevant local database tests. Never merge automatically.
- Never commit `.env` or any secret key.
