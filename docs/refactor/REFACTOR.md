# Breadcrumb startup migration

Status: proposed plan, not completed work. Baseline: GitHub main inspected in the architecture discussion (November 2026). Recheck current HEAD before implementation. One active developer initially; a second can join any independent task later.

## Goal and non-goals
Ship an incremental transition to a mobile-first, TypeScript modular monolith while retaining working web functionality, user data and database security. No new repository, no wholesale SQL rewrite, no mandatory Next.js cutover before native beta, no premature distributed infrastructure. See TECH_STACK.md and ARCHITECTURE.md.

## Baseline
React/Vite/React Router, Tailwind/Radix, Supabase JS/Auth/PostgreSQL/Storage and RLS, Vercel config, Google Maps/MBTA; `src/features/*` and `src/lib/api/*` isolate many data calls. `api/og.ts` provides link previews. Existing SQL migrations and pgTAP tests are valuable. CI runs npm ci/checks/build and disposable local DB tests. Existing Vercel config disables Git deployments; hosted settings remain unverified. M00 corrected automatic-deployment claims, removed unsafe remote-reset setup guidance and updated repository links. Preserve SQL names (`sidequests`, `sidequest_stops`, `checklist_items`, `user_sidequests`).

M00 source and validation evidence: [BASELINE.md](BASELINE.md) (2026-11-24). Current main remains a root Vite application; all workspace/API/mobile descriptions below are future work.

M00 was accepted by the developer merging PR #90. M01 [recovery preparation](RECOVERY.md) records the 2026-11-25 replacement backup and isolated restore drill, accepted by the owner with documented limits. M02 integration activation is now verified in [INTEGRATION.md](INTEGRATION.md): protected develop and passing push CI, with manual deployment controls retained. Both are accepted as of 2026-11-25. M03 [staging](STAGING.md) is set up; M04 is next.

## Execution order
1. **Baseline and safety:** inspect current branch/status, run existing checks, inventory user flows, verify production configuration, migration history, backups and restore procedure. Remove unsafe remote-reset instructions. Do not mutate production.
2. **Staging:** create develop from main once agreed, configure isolated Supabase project, Vercel staging and auth redirects/restricted map keys; use synthetic data. Protect branches and adapt CI. Verify merging to develop does not deploy production. Until configured, do not assume preview uses test data.
3. **Workspace move:** one mechanical PR moves the current Vite app and its configs, public assets, OG function to apps/web (or apps/web-legacy if coexistence is needed); preserve URLs, build, lint, aliases, env behavior and Vercel rewrites. Keep supabase/, docs/, .github/ at root. Use npm workspaces, one root lockfile, root DB scripts; Turborepo can be added when useful. Verify staging and CI before further file moves.
4. **API foundation:** add apps/api NestJS + Fastify, configuration validation, versioned REST/OpenAPI, health endpoint, request IDs, Pino logging, JWT guard, CORS allowlist, error handling and integration tests. Add Dockerfile and deploy staging on Railway. Keep user-scoped Supabase access initially; introduce restricted Drizzle only when authorization equivalence is tested. Use existing migrations and RPCs.
5. **First vertical slice:** agree on FeedTrail/TrailDetail DTOs from src/lib/api/trails.ts; add GET /v1/trails and GET /v1/trails/:id, test anonymous/public and authenticated/private access. Swap existing web API adapters to HTTP, preserving signatures/errors; verify staging. Repeat by domain: profiles, save/create/edit (save_trail RPC), progress, reviews, friends, communities, photos, reports, trending/badges. Test each slice against previous behavior. Avoid dual writes. Existing auth remains Supabase.
6. **Mobile-first product:** scaffold apps/mobile with Expo, session persistence and shared API client/types. Start with login, discovery/detail, active trail, photo upload and completion; then saved/profile/create/social/push. Use internal EAS builds and device tests. Keep old web working. Next.js can be tackled independently for public SEO and shareable pages, porting existing components and route URLs; maintain redirects, metadata and OG behavior, client-only maps/location, and auth callbacks. Cut over only after required parity. Decide which client to prioritize before large UI work.
7. **Release:** staging smoke tests, auth/RLS regressions, privacy and media validation, production backup and migration approval; deploy backward-compatible DB/API first, then clients, with rollback plan. App stores have separate review/release processes; support older versions.
8. **Later:** benchmark AI via provider-neutral interface (OpenRouter + AI SDK candidates); add Redis/BullMQ/R2/worker/search only if needed.

## API contract
Use OpenAPI as the API contract; generate or maintain typed clients and runtime validation. Start with existing DTO shapes, not DB row exposure. Proposed endpoints: GET /v1/trails, GET /v1/trails/:id, GET /v1/users/me, POST /v1/trails, PATCH /v1/trails/:id, GET /v1/me/saved-trails, PUT/DELETE /v1/me/saved-trails/:id, POST /v1/trails/:id/start, POST /v1/trails/:id/complete, POST /v1/trails/:id/reviews, POST /v1/media/upload-url. Contracts are proposals; choose precise status/error semantics before each slice.

## How to resume and collaborate
Read AGENTS.md and MIGRATION_CHECKLIST.md; inspect actual git state and open PRs; pick one unblocked task. If working solo, do tasks in dependency order and open reviewable PRs; reviewer absence is not authorization to bypass checks. While awaiting review, work independently only when base changes and dependencies allow. Update checklist in task PR, record tested commands and evidence, unresolved risks, next task and owner/claim if relevant. New developer claims a task before editing shared files. Avoid long-lived overlapping file-move branches.

## Acceptance criteria
Existing routes, authentication, published/private visibility, save/create/edit, progress, photo/review and social behavior remain intact for each migrated slice. CI and relevant security tests pass; staging uses isolated credentials. No production mutations without human release authorization. Document deployment/rollback steps and unresolved limitations before cutover.
