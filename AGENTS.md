# Breadcrumb — contributor and coding agent instructions

Breadcrumb is a transit-first social exploration app. It is transitioning from a hackathon web prototype to a mobile-first startup. Read these instructions before changing code.

## Required context
- [Migration plan](docs/refactor/REFACTOR.md), [migration checklist](docs/refactor/MIGRATION_CHECKLIST.md), [architecture](docs/refactor/ARCHITECTURE.md), [stack](docs/refactor/TECH_STACK.md), [decisions](docs/refactor/DECISIONS.md).
- [Product spec](docs/PRD.md), [style guide](docs/STYLE_GUIDE.md), [development guide](docs/DEVELOPMENT.md), [database workflow](supabase/README.md), [existing tasks](docs/TASKS.md).
- During migration, this file and REFACTOR.md supersede outdated stack, ownership, branch and deployment instructions in older docs. Inspect actual code and git state; target architecture is not proof of implementation. Do not treat old remote reset instructions as safe.

## Workflow
1. Inspect git status, current branch, recent commits and checklist; do not overwrite another developer's work. Identify the next unblocked task and confirm scope. One developer can execute tasks sequentially; ownership is per task, not permanent lanes. Coordinate shared files and schema changes.
2. Before integration is established, branch from updated main for baseline documentation and staging/bootstrap PRs only. Once develop exists and its workflow is verified, start feature branches from updated develop; use feat/, fix/, db/ or refactor/ prefixes. Release PRs go develop → main. Never push directly to protected branches, force-push them, approve your own PR, merge or release automatically. If no reviewer is online, prepare the PR and continue independent work; do not circumvent required checks. Do not assume branch protection is configured.
3. Keep PRs small; avoid unrelated dependency or config changes. Run relevant lint, typecheck, build, unit, integration and database tests using actual repo scripts. Existing pre-migration baseline: npm run build, npm run lint, npm run typecheck, npm run test:db (local Docker). Preserve existing CI coverage. Report failed or unrun checks honestly.
4. Update MIGRATION_CHECKLIST.md in the same PR with evidence, status and next task. Mark implemented work as in review until acceptance is verified on staging (or local evidence for local-only tasks). Record architecture changes in DECISIONS.md; update docs when commands change. Open a PR if requested or as part of the established agent workflow; report link and testing. Never merge it yourself.

## Existing conventions and terminology
- UI Trail = database `sidequests`; Stop = `sidequest_stops`; Crumb = `checklist_items`; progress = `user_sidequests.status`. Preserve existing table names and public URLs unless an approved migration requires a change. Do not rename tables for aesthetics.
- TypeScript strict; keep feature folders and existing `@/` aliases where configured. Use other features' public contracts, not internals. Place common code in shared locations. Supabase calls belong in existing API adapters or backend services, not inline UI components. Use existing generated database types; never hand-edit them.
- Start new source files with a concise 2–5 line header describing purpose, consumers and non-obvious behavior (generated files exempt). Name files descriptively; preserve migration naming conventions.
- Follow style guide, theme tokens and existing components; don't invent colors or hard-code hex values. Web screens must work at 375px. Never fabricate locations, hours, travel times or routes; don't depict straight lines as real routes. Existing privacy rule: live user location is not stored. Any change needs an explicit product/privacy decision.

## Database and security
- Supabase CLI SQL migrations remain authoritative. Never edit an applied migration; add a timestamped migration with a header. Enable RLS and appropriate policies for new exposed tables; add pgTAP coverage and verify grants. Preserve transactional RPCs and behavior (including save_trail). Regenerate database types using the intended environment; avoid unrelated schema rewrites.
- NEVER run remote database resets, remote pushes, production migrations, destructive SQL, or production credential changes as an agent without explicit task-specific human authorization and verified target. Existing policy: designated human database owner performs remote changes after review. Local resets only against confirmed disposable local DB. Back up and test recovery before production schema changes.
- During migration keep user-scoped Supabase calls/RPCs where they enforce existing RLS. Verify JWTs, derive identity from verified claims, enforce object-level access; never substitute a privileged Drizzle/service-role connection without explicit authorization design and tests. Do not weaken RLS to fix errors. Restrict private media, validate uploads, and strip unnecessary GPS metadata.
- Never commit secrets, .env or service-role keys. Browser/mobile public env variables contain only publishable or appropriately restricted keys. Separate local/staging/production credentials and data. No precise location or sensitive personal data in analytics or AI prompts without an explicit approved purpose.

## Migration guardrails
- Preserve production while introducing staging, npm workspaces, then incremental API and client changes. Keep existing Vite app working until replacement is verified; avoid big-bang rewrites. New features can ship during migration if compatible.
- Use npm, one root lockfile after workspace conversion, Node LTS compatible with dependencies, Docker for reproducible API/local services. Supabase CLI already manages local database containers; avoid duplicate PostgreSQL containers.
- New service deployments, billing changes, secrets, DNS, branch protection and production releases require human configuration/approval as appropriate. Do not claim live verification without access.
- Redis, BullMQ, R2, workers, semantic search and advanced AI are deferred unless a concrete need is agreed. AI model selection is provisional; benchmark cost, latency and output quality. No Gemini obligation.
