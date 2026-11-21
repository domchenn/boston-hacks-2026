# Breadcrumb

> You've lived here. Have you explored it?

Breadcrumb is a social itinerary discovery app for Boston college students, built for BostonHacks 2026. Students create, discover, share, join, complete, and review "sidequests": outings around Boston made up of one or more stops (cafes, restaurants, attractions, activities).

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
| `npm run preview` | Serve the production build locally |

### Environment variables

Set these in `.env`. That file is gitignored, so never commit it.

| Variable | Where to find it |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same page → **publishable** key (or the legacy `anon` key) |

Anything prefixed with `VITE_` is shipped to the browser. **Never** put the `service_role` or secret key in this app. Security is enforced by Row Level Security in the database, not by the frontend.

If the variables are missing, `src/lib/supabase.ts` throws a clear error the first time the client is imported.

## Supabase database setup

The schema lives in **[`supabase/migrations/`](supabase/migrations/)** as numbered files, one per feature; each file's name and header comment say what it does. Together they contain tables, constraints, indexes, triggers, and RLS policies.

1. Create a Supabase project.
2. Open **SQL Editor → New query**, paste the first file (`001_…`), and click **Run**. Repeat for each file **in number order**, once each. [`supabase/README.md`](supabase/README.md) lists them and tracks which have been applied.
3. Under **Authentication → Providers**, enable the sign-in methods you want (e.g. email).
4. Optional: regenerate TypeScript types from the live schema (see below).

### ⚠️ Migration history

If you apply `001` by hand in the SQL Editor, the Supabase CLI has **no record** that it ran. Do **not** later run `supabase db push` (or similar) blindly, because it will try to apply `001` again and fail or diverge. Before switching to CLI-based migrations, reconcile the history first, e.g. `supabase migration repair --status applied 001` after linking the project.

Rules:
- **Never edit a migration after it has been applied.** Put every schema change in a new, descriptively named file, e.g. `010_add_quest_photo_storage_bucket.sql`.
- Agree as a team who applies migrations, and post in chat when you do.

### What the schema enforces

Migrations run in number order (`001_…` through `009_…`); see [`supabase/README.md`](supabase/README.md) for what each one does.

- A profile row is created automatically on signup (`username` starts as `NULL` and is chosen during onboarding).
- Draft sidequests, and everything attached to them, are visible only to their creator. Community-only sidequests are visible only to that community's members.
- Each user has **one progress row per sidequest** in `user_sidequests` (`saved`, `signed_up`, `in_progress`, `completed`, `aborted`). It's private to that user. Signing up is only allowed for sidequests with a scheduled start.
- Checklist ticks are private and only allowed on a quest you've started.
- Ratings (price, time, enjoyment, memorability, 1–5 each) require a **completed** run, one per user, and creators can't rate their own. The views `sidequest_rating_stats` and `questgiver_ratings` give the averages.
- `experiences` (the curated place library) is read-only for users; the team adds rows through `seed.sql`.
- Users can only write their own rows. Deleting a sidequest cascades to everything attached to it. Use `status = 'archived'` to hide one instead.

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
├── migrations/        one numbered SQL file per schema change
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
- Never commit `.env` or any secret key.
