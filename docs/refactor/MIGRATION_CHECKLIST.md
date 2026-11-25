# Migration checklist

Target implementation progress is tracked below; baseline evidence is in [BASELINE.md](BASELINE.md). Check a box only after its acceptance criteria are verified; PR-open work is in review, not done. For every task record PR/commit, checks, environment and blocker/next action in the handoff log. IDs are stable. Tasks may be split into smaller PRs. Dependencies are minimums; inspect actual state first.

## Foundation
- [x] M00 — Reconcile current repo, branches, deployments, migration history; run baseline CI-equivalent checks (no remote mutations). Evidence: [M00 baseline](BASELINE.md), 2026-11-24; accepted through merged PR #90 (1329677). Hosted deployment/database history remains explicitly unverified.
- [ ] M01 — Verify backup/restore plan; remove outdated remote-reset guidance. Depends M00. [Recovery evidence and runbook](RECOVERY.md): documentation accepted through merged PR #91; encrypted backup verified, full restore/off-site/configuration acceptance outstanding.
- [ ] M02 — Establish develop, branch protection and CI for integration/release. Depends M00; [bootstrap preparation](INTEGRATION.md) in review. Hosted effects, remote ruleset/branch activation and workflow verification pending.
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
| M01 | Blocked (recovery acceptance pending) | [merged PR #91](https://github.com/domchenn/breadcrumb/pull/91) | 2026-11-24: confirmed production project; read-only project/backup inventory and local dump dry-run; lint/typecheck/build PASS; local pgTAP 18 files/181 assertions PASS; links/diff PASS; details in RECOVERY.md; documentation merged as b6dddc3 | Dashboard confirms Free plan; PITR disabled. Explicitly approved database/Auth/history/media export completed into AES-256 image outside Git; 11 file checksums and all 6 media source checksums verified. Await off-site custody/retention, recovery objectives, configuration coverage and approved isolated restore evidence. Next independent task: M02 after deployment-effects review; M03 remains gated. | Solo developer / Codex |
| M02 | In review (activation pending) | [PR #92](https://github.com/domchenn/breadcrumb/pull/92) | 2026-11-24: lint/typecheck/build PASS; local pgTAP 18 files/181 assertions PASS; actionlint, ruleset structure/check identities, links and diff PASS; reconciled main b6dddc3 after #91 merge with both task records retained; live review in INTEGRATION.md | Vercel verified: production main, no hooks; manual deployment explicitly retained. Supabase deploy/preview settings unknown. Proposed ruleset prepared, not applied; develop not created. Next: verify hosted effects and approve remote activation. M03 still depends on M01/M02. | Solo developer / Codex |

Append new rows or update relevant rows; statuses: Pending, In progress, In review, Blocked, Done, Deferred. Never record secrets or pretend a check ran. If a task becomes unnecessary, explain in DECISIONS.md and mark Deferred rather than silently deleting it.
