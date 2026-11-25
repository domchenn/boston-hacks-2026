# Migration checklist

Target implementation progress is tracked below; baseline evidence is in [BASELINE.md](BASELINE.md). Check a box only after its acceptance criteria are verified; PR-open work is in review, not done. For every task record PR/commit, checks, environment and blocker/next action in the handoff log. IDs are stable. Tasks may be split into smaller PRs. Dependencies are minimums; inspect actual state first.

## Foundation
- [x] M00 — Reconcile current repo, branches, deployments, migration history; run baseline CI-equivalent checks (no remote mutations). Evidence: [M00 baseline](BASELINE.md), 2026-11-24; accepted through merged PR #90 (1329677). Hosted deployment/database history remains explicitly unverified.
- [ ] M01 — Verify backup/restore plan; remove outdated remote-reset guidance. Depends M00. [Recovery evidence and runbook](RECOVERY.md): replacement backup passed an isolated restore 2026-11-25; image reopen and owner acceptance of limits outstanding.
- [x] M02 — Establish develop, branch protection and CI for integration/release. Depends M00; [activation verified](INTEGRATION.md) and accepted through merged PR #93 (04ef6b6).
- [ ] M03 — Isolated staging Supabase, migrations, auth redirects, test credentials and Vercel deployment. Depends M01–M02. Verify no production data access.
- [ ] M04 — Move Vite app into npm workspace, keep root SQL/scripts and one lockfile. Depends M03. Verify existing routes, OG previews and CI.
- [ ] M05 — Decide/add Turborepo tasks and shared config without breaking existing commands. Depends M04.

## Backend
- [ ] M06 — NestJS/Fastify scaffold, health/config/logging/OpenAPI and tests. Depends M04.
- [ ] M07 — Dockerfile, local services, Railway staging API, health checks and isolated env. Depends M06.
- [ ] M08 — JWT verification, resource authorization, CORS, request validation and negative tests. Depends M06.
- [ ] M09 — Shared DTOs/typed API client and trail read contract. Depends M06.
- [ ] M10 — Read endpoints with RLS-equivalent access tests. Depends M08–M09.
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
| M01 | In review (owner acceptance pending) | [merged PR #91](https://github.com/domchenn/breadcrumb/pull/91); drill evidence PR from refactor/m01-recovery-drill | 2026-11-25: first archive unrecoverable (password lost); replacement export verified; isolated restore with no SQL errors, 51 tables/57 foreign keys/21 migrations match, 6 photos match, pgTAP 178/181 (3 explained seed-data assumptions); details in RECOVERY.md | Owner reopens the replacement image and accepts the limits. M03 remains gated. | Solo developer / Codex; drill: Claude |
| M02 | Done | [bootstrap #92](https://github.com/domchenn/breadcrumb/pull/92); [evidence #93](https://github.com/domchenn/breadcrumb/pull/93) | develop created at 640051a; active ruleset 28048159 verified; [push CI 45550117217](https://github.com/domchenn/breadcrumb/actions/runs/45550117217) both jobs PASS; Supabase deploy-to-production off after reload; Vercel manual; main/default unchanged | Accepted: developer merged PR #93 as 04ef6b6. Next: M01 acceptance, then M03. | Solo developer / Codex |

Append new rows or update relevant rows; statuses: Pending, In progress, In review, Blocked, Done, Deferred. Never record secrets or pretend a check ran. If a task becomes unnecessary, explain in DECISIONS.md and mark Deferred rather than silently deleting it.
