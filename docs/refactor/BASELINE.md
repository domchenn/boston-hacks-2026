# M00 — repository migration baseline

Inspected 2026-11-24. Scope: repository audit, existing checks and documentation reconciliation only. No application, dependency, migration, RLS or deployment configuration changes. Hosted state is distinguished from repository evidence below.

## Repository and workflow

- Starting branch: `docs/migration-plan`; HEAD and local main: `badd951c2df77a301b90e89bdee565c81171a997` (PR #89, logo update). GitHub main matched this SHA during inspection.
- Starting worktree already contained a modified AGENTS.md and untracked START_HERE.md plus five docs/refactor documents. These supplied migration rules are included and corrected in the baseline PR, not discarded.
- Canonical GitHub repository is `domchenn/breadcrumb`, confirmed by GitHub API. Local origin still points to `git@github.com:domchenn/breadcrum.git`; older docs referenced `boston-hacks-2026`. Origin was left unchanged. SSH authentication failed; authenticated HTTPS can be used for the documentation PR.
- Live branches returned by GitHub: main and logo-edit; no develop. Local origin/* feature refs include outings/original-crew branches but are stale evidence, not implementation. No open PRs at inspection.
- Active repository ruleset “Protect main” (27814053) requires a PR, both CI jobs, and blocks deletion/non-fast-forward updates. Required approving review count is **0**. Classic branch-protection endpoint returns 404 because protection is a ruleset. Bypass actors and organization-level settings were not audited. Agents still must never merge; no review requirement was changed for solo work.
- CI workflow `.github/workflows/ci.yml` runs on all PRs and pushes to main, using Node 22 and npm ci. App job: lint, typecheck, build. Database job: db start, local db reset --yes, test db on a disposable GitHub runner. No develop push trigger, deployment workflow, Dependabot config or browser/unit test suite exists.
- Existing main CI [run 45471291211](https://github.com/domchenn/breadcrumb/actions/runs/45471291211) passed both jobs for the baseline SHA. This verifies a fresh database in that run; local tests below used an existing drifted stack.

## Implemented architecture and flow inventory

| Area | Current source / behavior to preserve |
|---|---|
| Frontend | Root Vite/React 19/React Router 8/strict TypeScript; Tailwind 4, Radix slot, theme in src/index.css; @/ alias in Vite and TS |
| Auth | src/lib/supabase.ts shared typed publishable-key client, SessionProvider, features/auth; email/password, Google OAuth, /login callback, /onboarding |
| Discovery | / Explore with filters, trending, friends and nearby; /map; Google Maps Directions/Places, MBTA and Bluebikes clients under src/lib |
| Trails | /trails/:id detail, /go active/location/checklist/photos, /rate reviews; adapters in src/lib/api/{trails,progress,ratings,photos}.ts |
| Creation | /make, /trails/:id/edit, remix; features/make/api.ts calls transactional save_trail RPC |
| Social/profile | /saved, /me, /u/:username, follows, close-friends/privacy, mutual saves and badges; community UI disabled by SHOW_COMMUNITIES=false |
| Safety | /privacy, /terms, /admin/reports and reports adapter; database admin/access policies |
| Hosting | vercel.json SPA and crawler rewrites; api/og.ts Edge Function reads public Supabase REST with publishable key |
| Telemetry | @vercel/analytics rendered in src/main.tsx; PostHog/Sentry absent |

These are source inventories, not successful interactive smoke tests. Authentication, maps, private visibility, camera uploads, browser width 375px and production user flows were not exercised in M00. Preserve existing routes and theme; do not use historical placeholder/ownership claims in TASKS.md as current implementation facts.

No apps/, packages/, npm workspaces, Next.js, Expo, NestJS/Fastify server, Drizzle, PostGIS migration, Dockerfile, Railway config or Turborepo exists. OpenAPI, typed HTTP client, Zod, TanStack Query, image service, API auth/CORS/rate limits and new observability are target work, not missing imports to install during M00. Supabase Auth/RLS currently provides the user-scoped backend boundary; do not replace it with privileged SQL access implicitly.

## Dependencies and validation

- One root package-lock.json; npm ci succeeded without modifying it. Initial node_modules lacked the already-declared/locked react-icons dependency, causing TS2307 in TrailCard.tsx. Clean installation resolved it; no dependency addition was required. npm reported zero vulnerabilities in that install audit (not a full security review).
- Local runtime: Node 24.8.0, npm 11.6.0, Supabase CLI 3.2.0. Locked Vite requires ^20.19.0 or >=22.12.0; ESLint requires ^20.19.0, ^22.13.0 or >=24; React Router requires >=22.22.0. Thus the old “Node 20+” guidance was incorrect. CI selects Node 22; use 22.22+ within that major. No engines or runtime pin is committed; @types/node is major 26. Resolve runtime/type alignment in bootstrap work rather than changing dependencies in a docs PR.
- npm run lint: PASS.
- npm run typecheck: PASS after npm ci.
- npm run build: PASS; JS bundle 875.65 kB (254.48 kB gzip), with >500 kB chunk warning. Build success is not a browser regression test.
- npm run test:db: PASS, 18 files / 181 assertions, local 127.0.0.1:54322. Tests use transactions and rollback; no reset, migration push or remote database command was run.
- api/og.ts is outside both TS project includes (src and vite.config.ts); ordinary typecheck/build does not establish Edge Function runtime correctness. There is no unit/integration/browser script to run. Preserve existing CI and add relevant coverage when migrating this path.

## Database configuration and migration history

Repository has 21 immutable SQL migrations and 18 pgTAP test files. SQL includes RLS, grants, private security-definer visibility helpers, social RPCs, moderation and successive save_trail definitions; the latest custom-category migration must be preserved. Supabase CLI SQL remains authoritative; generated src/types/database.types.ts was not edited or regenerated.

Local config: project_id breadcrumb; PostgreSQL 17; API port 54321, DB 54322, Studio 54323; migrations and seed enabled. seed.sql currently contains comments only, while several migrations create synthetic accounts and researched demo content. launch/remove_demo_data.sql is a separate destructive launch action, not a baseline step.

Existing local Docker stack was already running. Its API is published on **54331**, differing from config's 54321. Its migration ledger has 20 entries: the first 19 repository versions through 20261122070225 plus **20261122073419**, which has no corresponding file in this checkout. It lacks repository versions **20261122130147** and **20261122133657**. Tests passing on this stack does not reconcile its provenance or prove a clean replay. Preserve its data and investigate separately before any reset or repair; never create a migration file or mark versions applied just to match it. Hosted applied history was not queried and cannot be inferred from this local stack or generated types.

Auth config currently uses http://127.0.0.1:3000 with an additional https://127.0.0.1:3000 redirect, while Vite defaults to localhost:5173. Hosted OAuth providers/redirects require separate verification. Gitignored linked-project state exists; linking is not proof it is a safe staging target. db:push, db:status and db:types explicitly target the linked remote; test:db defaults local.

## Risks and unresolved external evidence

| Finding | Consequence / follow-up |
|---|---|
| Public trail-photos bucket with user-folder write policies | Trail row privacy does not make a known public media URL private. M16 must design/test private media; do not claim current media isolation. |
| shrinkImage returns original small JPEGs and undecodable images | GPS/EXIF stripping is not guaranteed. AGENTS privacy rule is a requirement, not verified current behavior; cover in M16 and launch checks. |
| Local migration/API-port drift | Existing local tests are useful but insufficient as sole migration replay evidence; preserve stack and establish a disposable replay environment before schema work. Main CI provides separate clean replay evidence. |
| vercel.json git.deploymentEnabled=false | Old automatic merge/preview claims removed. Actual project, domain, deploy method, runtime env scopes and preview data access remain unverified; inspect before M02/M03. No deployment was triggered. |
| Backup/restore and remote ledger unknown | M01 needs human/environment evidence of backup retention, database/Auth/Storage recovery and isolated restore drill; no production readiness claim. |
| Ruleset approval count zero | Reported as current fact; no two-person split or fabricated required reviewer. M02 reviews intended solo workflow and bypasses without weakening checks. |
| Root DB scripts use remote target | Docs now distinguish local tests from human-owned remote changes; no remote writes/type generation performed. |
| Target dependency/service list | Target packages/services are absent by design at M00. No billing, DNS, secrets, protections or hosting configuration changed. |

Corrections in this task: docs/refactor paths in AGENTS/START_HERE, bootstrap branch allowance for baseline docs, current stack/runtime/repository/setup/deployment guidance, historical task ownership/placeholder claims, crumb table name, missing migration inventory, and removal of obsolete remote-reset setup instructions. No backup plan was invented; M01 still owns recovery verification. No target architecture choice was accepted by this audit.

## Handoff

M00 audit and local validation complete; PR remains in review until accepted. Next unblocked task: **M01**, backup/restore verification, with unsafe setup guidance already removed here. Gather verified environment identity, backup/retention coverage, isolated restore destination and human authorization for any external operation. M02 is also dependency-unblocked after M00 acceptance but must inspect deployment effects before configuration. Stop here; no M01/M02 implementation performed.
