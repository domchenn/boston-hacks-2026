# Architecture decision log

These are proposed decisions from the planning conversation, not evidence of cofounder approval. npm preference is explicitly stated by the active developer. Record date, status, rationale, alternatives, consequences and PR when accepting or changing each decision.

| ID | Decision | Status | Rationale / alternative |
|---|---|---|---|
| D01 | Keep npm | Developer preference | Existing lockfile; pnpm optional, npm workspaces sufficient |
| D02 | Incremental refactor in same repo | Proposed | Preserve history and working behavior; avoid clean-slate rewrite |
| D03 | Staging before structural changes | Proposed | Separate data, credentials and approval gate |
| D04 | TypeScript modular monolith, NestJS/Fastify | Proposed | Shared types and conventions; standalone Fastify or Python viable |
| D05 | Keep Supabase PostgreSQL/Auth/Storage and SQL migrations | Proposed | Existing RLS, RPCs, tests and data; no forced provider migration |
| D06 | Use user-scoped Supabase access first; Drizzle selectively | Proposed | Prevent privilege escalation and preserve authorization |
| D07 | Expo mobile; Next.js web incrementally | Proposed | Native exploration features and public SEO; Vite remains until cutover |
| D08 | Docker backend/local services, Vercel/Railway | Proposed | Reproducibility and low operational overhead |
| D09 | AI provider-independent; no Gemini requirement | Proposed | Compare models on real tasks; no verified cost/quality winner yet |
| D10 | Defer Redis/BullMQ/R2 and advanced infrastructure | Proposed | Small team and demand-driven scaling |
| D11 | Task dependencies rather than permanent ownership | Proposed | One active developer now, second can resume later |

For future changes, append a decision with context, alternatives, tradeoffs and acceptance evidence. Never silently overwrite historical rationale.

## 2026-11-24 — M00 baseline evidence boundary

Status: recorded audit scope; no target architecture decisions accepted. See [BASELINE.md](BASELINE.md) and the M00 PR for evidence. The existing root Vite/Supabase implementation remains the baseline. Alternative considered: install target tooling or reconcile the existing local database immediately. Deferred because M00 is an audit and the local ledger diverges from repository files; resetting it would risk existing data. Consequence: preserve the stack, record passing transactional tests separately from main CI's clean replay, and require environment/recovery verification in M01 before schema work. Baseline documentation PRs may target verified main before develop exists; this does not authorize merges or deployments. Solo task execution follows dependencies without permanent ownership lanes.

## 2026-11-24 — M02 integration bootstrap proposal

Status: repository implementation in review; hosted policy/activation not accepted. See [INTEGRATION.md](INTEGRATION.md). Proposed develop uses mandatory PRs/checks with zero approving reviews while solo and no bypass actors. Keep main as default because its existing protection targets ~DEFAULT_BRANCH. Preserve main's current rule pending separate review. Alternative of creating develop immediately is deferred: Vercel authentication and Supabase deployment effects remain unverified. Consequence: CI/develop-rule preparation can be reviewed independently of M01 PR #91, but develop creation, remote protection changes and staging activation require verified targets and explicit human approval. No live integration is claimed.
