# Sidequests

> You've lived here. Have you explored it?

Sidequests is a social itinerary discovery app for Boston college students, built for BostonHacks 2026. Students create, discover, share, join, complete, and review "sidequests": outings around Boston made up of one or more stops (cafes, restaurants, attractions, activities).

- **Anytime sidequest** (`scheduled_at` is null): an itinerary others can save and follow whenever they like.
- **Scheduled sidequest** (`scheduled_at` is set): an outing others can join.

This repo is currently the **shared foundation**: tooling, styling, routing, database schema, and Supabase client. Product features are built on top of it by individual developers.

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, TypeScript, React Router |
| UI | Tailwind CSS v4, shadcn/ui, Lucide React |
| Backend | Supabase (PostgreSQL, Auth, Storage later), `@supabase/supabase-js` |
| Maps (planned) | MapLibre GL JS, MBTA V3 API (not installed yet) |
| Deploy (planned) | Vercel (not set up yet) |

## Getting started

Requires Node 20+.

```bash
git clone https://github.com/domchenn/boston-hacks-2026.git
cd boston-hacks-2026
npm install
cp .env.example .env.local   # then fill in the values, see below
npm run dev
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server at http://localhost:5173 |
| `npm run build` | Type-check, then build for production into `dist/` |
| `npm run typecheck` | Type-check only (`tsc -b --noEmit`) |
| `npm run lint` | Run ESLint |
| `npm run preview` | Serve the production build locally |

### Environment variables

Set these in `.env.local`. That file is gitignored, so never commit it.

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same page → **publishable** key (or the legacy `anon` key) |

Anything prefixed with `VITE_` is shipped to the browser. **Never** put the `service_role` or secret key in this app. Security is enforced by Row Level Security in the database, not by the frontend.

If the variables are missing, `src/lib/supabase.ts` throws a clear error the first time the client is imported.

## Supabase database setup

The full schema lives in **[`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)**. It contains tables, constraints, indexes, triggers, and RLS policies.

1. Create a Supabase project.
2. Open **SQL Editor → New query**, paste the whole file, and click **Run**. Run it **once**, on a fresh project.
3. Under **Authentication → Providers**, enable the sign-in methods you want (e.g. email).
4. Optional: regenerate TypeScript types from the live schema (see below).

### ⚠️ Migration history

If you apply `001` by hand in the SQL Editor, the Supabase CLI has **no record** that it ran. Do **not** later run `supabase db push` (or similar) blindly, because it will try to apply `001` again and fail or diverge. Before switching to CLI-based migrations, reconcile the history first, e.g. `supabase migration repair --status applied 001` after linking the project.

Rules:
- **Never edit `001_initial_schema.sql` after it has been applied.** Put every schema change in a new file: `002_short_description.sql`, `003_...`.
- Agree as a team who applies migrations, and post in chat when you do.

### What the schema enforces

- A profile row is created automatically on signup (`username` starts as `NULL` and is chosen during onboarding).
- Draft and archived sidequests, and their stops, are visible only to their creator.
- Users can only write their own rows (profile, sidequests, stops, saves, participation, completions, reviews, follows, memberships).
- Only **published, scheduled** sidequests can be joined (enforced by a trigger).
- A review requires a completion. This is a foreign key, so un-completing removes the review.
- Ratings are 1–5, costs are ≥ 0, coordinates are valid, and duplicate saves, joins, and reviews are rejected.
- Deleting a sidequest cascades to its stops, saves, participants, completions, and reviews. Use `status = 'archived'` to hide one while keeping its history.

### Database types

`src/types/database.types.ts` is **hand-written and provisional**. It mirrors the migration but was not generated from a live DB. Once your project exists, replace it:

```bash
npx supabase gen types typescript --project-id <project-ref> > src/types/database.types.ts
```

Regenerate after every new migration.

## Folder structure

```text
src/
├── assets/             static images/fonts imported by code
├── components/
│   ├── ui/             shadcn/ui primitives (generated: `npx shadcn@latest add <name>`)
│   └── layout/         app shell (AppLayout: header + <Outlet/>)
├── pages/              route-level components (HomePage, NotFoundPage)
├── lib/
│   ├── supabase.ts     the ONE shared Supabase client
│   └── utils.ts        cn() class helper
├── types/
│   └── database.types.ts
├── App.tsx             route table
├── main.tsx            entry point
└── index.css           Tailwind + theme tokens
supabase/
├── migrations/001_initial_schema.sql
└── seed.sql
```

Add these folders when you first need them: `src/features/<feature>/` (see conventions), `src/hooks/`, `src/contexts/`.

## Team conventions

**Feature folders.** Each workstream owns a folder so people rarely edit the same files:

```text
src/features/
├── auth/         auth + profiles   (pages, components, hooks, api.ts)
├── discovery/    feed + social
├── sidequests/   create / edit / detail / save / join / complete / review
└── maps/         MapLibre + MBTA
```

- Put Supabase queries in `src/features/<feature>/api.ts`, not inside components.
- Don't import another feature's internals. If two features need something, move it to `src/components/`, `src/lib/`, or `src/hooks/`.
- Use the row types: `import type { Tables } from '@/types/database.types'` → `Tables<'sidequests'>`.
- Add your routes to `src/App.tsx` as children of `AppLayout`. Keep that diff small to avoid conflicts.
- Use the `@/` alias for imports from `src`.
- Add UI primitives with `npx shadcn@latest add button card ...` (they land in `src/components/ui/`). Use theme tokens (`bg-primary`, `text-muted-foreground`), not hard-coded colors. Design mobile-first: base styles target phones, and `sm:`/`md:` add larger layouts.
- Branch per feature (`feat/discovery-feed`) and open a PR into `main`. Run `npm run build && npm run lint` before pushing.
- Never commit `.env.local` or any secret key.
