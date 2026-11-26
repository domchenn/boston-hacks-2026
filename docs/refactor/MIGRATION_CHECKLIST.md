# Migration checklist

Target implementation progress is tracked below; baseline evidence is in [BASELINE.md](BASELINE.md). Check a box only after its acceptance criteria are verified; PR-open work is in review, not done. For every task record PR/commit, checks, environment and blocker/next action in the handoff log. IDs are stable. Tasks may be split into smaller PRs. Dependencies are minimums; inspect actual state first.

## Foundation
- [x] M00 — Reconcile current repo, branches, deployments, migration history; run baseline CI-equivalent checks (no remote mutations). Evidence: [M00 baseline](BASELINE.md), 2026-11-24; accepted through merged PR #90 (1329677). Hosted deployment/database history remains explicitly unverified.
- [x] M01 — Verify backup/restore plan; remove outdated remote-reset guidance. Depends M00. [Recovery evidence and runbook](RECOVERY.md): replacement backup restored in isolation and reopened; owner accepted the documented limits 2026-11-25.
- [x] M02 — Establish develop, branch protection and CI for integration/release. Depends M00; [activation verified](INTEGRATION.md) and accepted through merged PR #93 (04ef6b6).
- [x] M03 — Isolated staging Supabase, migrations, auth redirects, test credentials and Vercel deployment. Depends M01–M02. [Staging evidence and limits](STAGING.md), 2026-11-25.
- [x] M04 — Move Vite app into npm workspace, keep root SQL/scripts and one lockfile. Depends M03. Done in [PR #98](https://github.com/domchenn/breadcrumb/pull/98) (7bd8f56); staging serves it from `apps/web`. Production Root Directory changes at the next release.
- [ ] M05 — Decide/add Turborepo tasks and shared config without breaking existing commands. Depends M04. **Deferred** 2026-11-25: one app only; revisit when `apps/api` or `apps/mobile` exists (see DECISIONS.md).

## Backend
- [x] M06 — NestJS/Fastify scaffold, health/config/logging/OpenAPI and tests. Depends M04. Done in [PR #100](https://github.com/domchenn/breadcrumb/pull/100) (`apps/api`); not deployed.
- [ ] M07 — Dockerfile, local services, Railway staging API, health checks and isolated env. Depends M06. Host changed to **Google Cloud Run** (see DECISIONS.md). Image + CI smoke test in review; staging deployment pending.
- [x] M08 — JWT verification, resource authorization, CORS, request validation and negative tests. Depends M06. Done in [PR #102](https://github.com/domchenn/breadcrumb/pull/102): deny-by-default Supabase token guard; per-resource authorization arrives with data access (M10) through RLS.
- [x] M09 — Shared DTOs/typed API client and trail read contract. Depends M06. Done in [PR #103](https://github.com/domchenn/breadcrumb/pull/103) (`packages/contracts`).
- [x] M10 — Read endpoints with RLS-equivalent access tests. Depends M08–M09. Done in [PR #104](https://github.com/domchenn/breadcrumb/pull/104); RLS equivalence tests run in CI.
- [ ] M11 — Swap existing web feed/detail adapters and verify on staging. Depends M07, M10.
- [ ] M12 — Profiles and saved trails API/adapters. Depends M11.
- [ ] M13 — Create/edit trail API/adapters preserving save_trail transaction. Depends M11.
- [ ] M14 — Progress, crumbs, ratings API/adapters and state transition tests. Depends M11.
- [ ] M15 — Friends, communities, trending/badges API/adapters. Depends M11.
- [ ] M16 — Photos, visibility, moderation API/adapters and security tests. Depends M11.
- [ ] M17 — Evaluate Drizzle and PostGIS adoption with least-privilege/RLS tests and additive SQL migrations. Depends M08. Introduce only as needed; do not rewrite working RPCs.

## Clients (prioritize mobile or web based on product needs)
- [ ] M18 — Expo scaffold, native auth/session persistence, API client. Depends M04, M08–M09.
- [ ] M19 — Expo discovery and details; device tests. Depends M18, M10.
- [ ] M20 — Expo active trail, location/camera/photos/completion; device tests. Depends M19, M14, M16.
- [ ] M21 — Expo saved/profile/social/create and push as needed. Depends relevant APIs.
- [ ] M22 — Next.js scaffold, existing design tokens, client-only maps, auth and routes. Depends M04; optional parallel work.
- [ ] M23 — Next.js public trail metadata/SEO, share links, remaining required web parity. Depends M22, M11; keep Vite until accepted.

## Launch and later
- [ ] M24 — Monitoring, analytics (privacy-safe), rate limits, reporting, backup and rollback checks. Depends M11; before launch.
- [ ] M25 — Staging end-to-end regression and security checks for actual release scope. Depends migrated slices and M24.
- [ ] M26 — Human-approved production release, backwards compatibility, smoke checks and rollback readiness. Depends M25.
- [ ] M27 — EAS internal beta, device QA and human-approved app store release. Depends M19–M20, M24 and relevant backend readiness.
- [ ] M28 — Benchmark AI candidates only when a product feature needs AI; assess cost per successful task, quality, latency, privacy.
- [ ] M29 — Reassess R2, Redis/BullMQ/workers, search and payments based on measured need; no mandatory adoption.

## Handoff log
| Task | Status | PR/commit | Verified checks/environment | Blocker / next action | Claimed by |
|---|---|---|---|---|---|
| M00 | Done | [PR #90](https://github.com/domchenn/breadcrumb/pull/90) | 2026-11-24: npm ci, lint, typecheck, build PASS; local pgTAP 18 files/181 assertions PASS; main CI 45471291211 both jobs PASS; documentation links/diff checked | Accepted: developer merged PR #90 as 1329677. Local ledger drift and hosted-state limits remain in BASELINE.md. Unsafe reset guidance removed; M01 preparation follows. | Solo developer / Codex |
| M01 | Done | [merged PR #91](https://github.com/domchenn/breadcrumb/pull/91); [drill evidence PR #95](https://github.com/domchenn/breadcrumb/pull/95) | 2026-11-25: first archive unrecoverable (password lost); replacement export verified; isolated restore with no SQL errors, 51 tables/57 foreign keys/21 migrations match, 6 photos match, pgTAP 178/181 (3 explained seed-data assumptions); details in RECOVERY.md | Accepted: owner reopened the image and accepted the limits 2026-11-25. Login and photo serving move to M03 checks. Next: M03. | Solo developer / Codex; drill: Claude |
| M02 | Done | [bootstrap #92](https://github.com/domchenn/breadcrumb/pull/92); [evidence #93](https://github.com/domchenn/breadcrumb/pull/93) | develop created at 640051a; active ruleset 28048159 verified; [push CI 45550117217](https://github.com/domchenn/breadcrumb/actions/runs/45550117217) both jobs PASS; Supabase deploy-to-production off after reload; Vercel manual; main/default unchanged | Accepted: developer merged PR #93 as 04ef6b6. Next: M01 acceptance, then M03. | Solo developer / Codex |
| M03 | Done | [evidence PR #97](https://github.com/domchenn/breadcrumb/pull/97) | 2026-11-25: 21 migrations applied by owner; app and storage schema identical to production; deployed site isolated; owner tested with two accounts; details in STAGING.md | Google sign-in, signup email and Realtime untested. Next: M04. | Solo developer / Claude |
| M04 | Done | [PR #98](https://github.com/domchenn/breadcrumb/pull/98) (7bd8f56) | 2026-11-25: lint, typecheck, build PASS; local pgTAP PASS; lockfile versions unchanged; JS identical apart from the CSS file name; CSS drops 20 classes found only in docs/; root `.env` still read; root vercel.json keeps Git deploys off. Staging (Root Directory `apps/web`) serves the develop build (CSS hash matches a local build); pages, deep links, link previews, login and maps checked by the owner on the stable staging domain; develop push CI PASS | At the next develop → main release, set the live breadcrumb project's Root Directory to `apps/web` before deploying. Next: M06. | Solo developer / Claude |
| M05 | Deferred | — | 2026-11-25: single workspace app; npm workspace scripts are enough for now | Revisit when a second app (API or mobile) exists. | — |
| M06 | Done | [PR #100](https://github.com/domchenn/breadcrumb/pull/100) | 2026-11-25: clean `npm ci`; lint, typecheck, 16 Vitest tests and build PASS for both apps; built server checked by hand (health, meta, request IDs, CORS, error shape, OpenAPI, docs page, JSON logs, bad-config exit); web build unchanged; `npm audit` 0 | Merged as e043f8e. Next: M07 (Docker + Railway staging) or M08 (JWT/authorization). | Solo developer / Claude |
| M08 | Done | [PR #102](https://github.com/domchenn/breadcrumb/pull/102) (63bffba) | 2026-11-25: 54 Vitest tests PASS (valid token, 20+ rejection cases incl. wrong key/kid/issuer/audience, expired, anon/service roles, HS256, alg none, missing claims; @Public/@OptionalAuth modes; 503 when keys error or are unreachable; validation pipe); lint/typecheck/build PASS; against real staging Supabase: no token 401, legacy anon key 401, forged ES256 token with staging's kid 401 (signature check, so real keys were fetched); no tokens in logs | A positive check with a real staging login is pending (needs a signed-in session). Next: M09/M10. | Solo developer / Claude |
| M09 | Done | [PR #103](https://github.com/domchenn/breadcrumb/pull/103) (97b277f) | 2026-11-25: `@breadcrumb/contracts` (Zod schemas + types + typed client); 26 contract tests (web-shaped fixtures accepted, malformed data and bad query params rejected, client URL/token/validation/errors); API builds against it and loads it at runtime from CommonJS (require(esm)); root build order contracts → api → web; no new third-party packages | Next: M10 (GET /v1/trails, /v1/trails/:id with RLS-equivalence tests). | Solo developer / Claude |
| M10 | Done | [PR #104](https://github.com/domchenn/breadcrumb/pull/104) (05cde43) | 2026-11-25: 68 API unit/HTTP tests (validation 400s, 404, optional sign-in, bad token 401, hidden DB errors, OpenAPI from the contract); 20 RLS integration tests against local Supabase for 7 viewer types (anon, owner, friend, close friend, stranger, community member, private profile) × 8 trail kinds: API == Supabase for the same token and == the expected matrix; mapping, remix credit and filters; a deliberate bug (ignoring the caller's token) fails 13 of them; fixtures cleaned up. CI database job now also starts PostgREST/gateway and runs them | Next: M11 (swap the web feed/detail to the API on staging; needs a deployed API, M07). | Solo developer / Claude |
| M07 | In progress | image: PR from refactor/m07-api-docker-image | 2026-11-26: two-stage Dockerfile → distroless Node 22, non-root, 331 MB, no dev tools; container against real staging Supabase (read-only, signed out): /health, /v1/meta, /v1/trails returned the same 12 trails as Supabase directly, contract-valid; detail, 404/400/401, docs hidden in production mode, CORS, all-JSON logs without keys, clean SIGTERM shutdown (0.2 s); CI job builds and smoke-tests it. Google Cloud projects and budgets created by the owner (staging breadcrumb-staging-515905; production: existing breadcrumb project) | Next: deploy staging to Cloud Run (needs gcloud and the owner's approval of the exact commands). | Solo developer / Claude |

Append new rows or update relevant rows; statuses: Pending, In progress, In review, Blocked, Done, Deferred. Never record secrets or pretend a check ran. If a task becomes unnecessary, explain in DECISIONS.md and mark Deferred rather than silently deleting it.
