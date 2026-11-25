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

## 2026-11-24 — M01 recovery acceptance boundary

Status: preparation proposed for review; no backup provider, paid tier or recovery objective accepted. See [RECOVERY.md](RECOVERY.md). Source project identity is human-confirmed; hosted metadata reports PITR disabled with no returned backup records/window. The alternative of treating WAL-G enabled, default schema dumps or passing pgTAP tests as proof of recovery is rejected as insufficient evidence. Recovery acceptance requires database/Auth/history/security, separate media/configuration coverage and an approved isolated restore report. Consequence: retain M01 as incomplete and keep M03 gated; M02 remains independent after M00. Production-data exports, remote restores, new paid services and changes to credentials or production configuration need their own verified scope and authorization. No schema or application architecture changes were made.

M01 evidence update (2026-11-24): the developer supplied the production backup dashboard screenshot confirming Free plan without scheduled project backups. Manual database/media backups remain unverified. No upgrade or export workflow has been selected or executed; the acceptance boundary above is unchanged.

M01 execution update (2026-11-24): the developer explicitly approved the named production data/media export into the prepared AES-256 local disk image. Export and byte/media checks completed, with unlock custody in the local login Keychain; no paid backup option was adopted. One local copy is not off-site protection, and verified export bytes do not establish full restore acceptance. M01 remains incomplete pending those recovery requirements.

## 2026-11-24 — M02 integration bootstrap proposal

Status: repository implementation in review; hosted policy/activation not accepted. See [INTEGRATION.md](INTEGRATION.md). Proposed develop uses mandatory PRs/checks with zero approving reviews while solo and no bypass actors. Keep main as default because its existing protection targets ~DEFAULT_BRANCH. Preserve main's current rule pending separate review. Alternative of creating develop immediately is deferred: Supabase deployment effects remain unverified; Vercel read-only inspection is now complete. Consequence: CI/develop-rule preparation can be reviewed independently of M01 PR #91, but develop creation, remote protection changes and staging activation require verified targets and explicit human approval. No live integration is claimed.

M02 clarification: the developer explicitly requires Vercel manual deployment. Preserve git.deploymentEnabled=false; no automatic staging or production deployments are authorized. Signed-in inspection confirms production tracks main and no deploy hooks are configured. Documentation PR acceptance is separate from completion of the full migration task: #91 may be reviewed/merged while M01 remains unchecked.

## M02 — approved integration activation

Status: implemented with live evidence; follow-up evidence PR in review. After merging #92, the developer authorized creating develop at 640051a, installing the reviewed protection policy and turning off Supabase automatic production deployment. Applied ruleset 28048159 without bypass actors; kept main/default and its rules unchanged. The alternative of leaving Supabase deploy-to-production enabled was rejected because merges to main could apply database changes independently of Vercel's manual web deployment. Both deployment paths now require manual action. Supabase automatic preview branching stays disabled; no paid resource was created. See [INTEGRATION.md](INTEGRATION.md) for push CI, effective rules and persisted UI verification. No production SQL or release occurred.

## 2026-11-25 — M01 local-only backups and restore drill

Status: local-only storage chosen by the owner; remaining limits proposed. The first archive can no longer be opened, so a replacement was exported and restored in an isolated container. Paid Supabase backups were declined because of cost. Storing the image in the checkout under gitignore was considered and rejected: the repository is public, a forced add would publish it and `git clean -fdx` would delete it. Consequence: losing this computer loses the backup. M01 stays open until the owner accepts the limits in [RECOVERY.md](RECOVERY.md). M02 was accepted through merged PR #93.
