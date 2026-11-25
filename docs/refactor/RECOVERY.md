# M01 — backup and recovery readiness

Status: preparation in review; recovery acceptance blocked on the evidence below. Inspected 2026-11-24 against main `132967738ab39c1ccf5c0fb0950a9904ddf77d61`. This is a recovery runbook and evidence register, not proof of a successful restore. No backup export, restore, project creation, credential change or remote database write was performed.

## Verified environment and evidence

The active developer confirmed during M01 that Supabase project `gekcvmzpahocsxnvsdyy` is production for breadcrumb.boston. Read-only CLI project inventory returns name `breadcrumb`, region us-east-2, PostgreSQL 17.12.0.000 and ACTIVE_HEALTHY. The installed CLI's target label says `detour` for this same reference; identify targets by the confirmed reference, not a cached name. A direct fetch of the public website failed with URLError, so the bundle's environment was not independently inspected.

| Item | Evidence / remaining action |
|---|---|
| M00 accepted | Developer merged [PR #90](https://github.com/domchenn/breadcrumb/pull/90); main contains merge commit 1329677. Its baseline findings remain historical evidence. |
| Hosted backup metadata | `supabase backups list --remote=gekcvmzpahocsxnvsdyy --output json` succeeded: backups=null, physical_backup_data={}, pitr_enabled=false, walg_enabled=true, region=us-east-2. |
| Interpretation | No backup records, usable recovery window or completed backup timestamp were returned. WAL-G being enabled does not demonstrate an accessible/restorable backup. PITR is disabled. Do not infer the billing tier, retention or absence of all backups from this response. |
| Plan, retention and last usable backup | Unverified. Human owner must inspect Database → Backups and organization billing; record plan, method, successful timestamp, available window and access permissions. No billing change is authorized. |
| Off-site archive and media copy | Unverified. No repository backup job or recovery archive manifest exists. External backups may exist; owner must confirm location, access, encryption, retention and last successful run without sharing secrets. |
| Restore destination | None approved. No disposable hosted project or full local recovery environment has been selected. Existing local Breadcrumb stack has migration drift and must not be reset or used as a restore target. |
| Recovery drill / objectives | Not run; recovery point objective (maximum acceptable lost data) and recovery time objective (maximum acceptable outage) are not yet agreed. Do not invent service guarantees. |
| Tooling | Installed Supabase CLI 3.2.0 supports backups list and db dump; read-only help and local db dump --dry-run passed. Local host pg_dump is major 15, while the server is 17; do not use the older binary to dump this server. The existing Supabase DB container provides pg_dump 17.12. |

The local dry-run confirms that a plain `supabase db dump` is schema-only and excludes auth, storage and supabase_migrations among other managed schemas. It is **not** a complete application backup. No dump contents, credentials or personal data were collected.

## Recovery coverage required for Breadcrumb

| Asset | Recovery requirement and verification |
|---|---|
| App database | Recover public/private schemas, data, sequences, constraints, indexes, functions (including transactional save_trail), RLS, policies, grants and default privileges. Compare schema/security inventories and record counts against the chosen backup point. |
| Auth | Include user/identity data and dependencies in the chosen database recovery method. Preserve user UUIDs so profiles, follows, progress and media ownership still match. Verify signup-trigger behavior and email/password plus Google sign-in using synthetic accounts; do not assume Auth configuration/API keys move with database rows. |
| Migration history | Preserve actual supabase_migrations history and the corresponding repository revision. Reconcile discrepancies before later pushes; never repair history merely to silence differences. Restoring a complete schema and replaying every historical migration over it are different paths. |
| Media | Copy trail-photos **object bytes**, bucket settings and metadata separately. Account for checklist_completions.photo_url, quest_photos.photo_url, cover/avatar URLs and ownership paths. Record object counts, sizes and checksums in a private manifest; sample checks alone cannot establish full coverage. |
| Stored media URLs | A new project changes storage origins. Decide whether production origin stays or URLs must be remapped before recovery acceptance. Verify restored links and visibility; do not expose private media to make broken links work. |
| Managed-schema customizations | Preserve signup triggers on auth.users, storage.objects/bucket policies and related grants from the actual source. Repository migrations are reference evidence; first check whether hosted schema has drifted. |
| Environment and services | Securely inventory Auth providers/redirects, signing/API keys, SMTP, Google/MBTA restrictions, Vercel variables/domains/rewrites, functions, extensions and Realtime configuration. Restore configuration separately where required; no secret values in Git or evidence logs. |
| Encrypted data | Owner must establish whether Vault/column encryption is used. If so, follow the provider's supported key-recovery procedure through approved secret custody. Never assume a SQL archive contains decryption keys or overwrite a project's key as a routine step. |

Database backups exclude uploaded Storage object bytes; see [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups). Provider availability and retention depend on the actual plan, not the target stack document.

The [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-dump) describes dump defaults, managed-schema exclusions and privilege concerns. The [provider restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) describes separate history, managed customizations and project configuration. Use these with the installed CLI's help; do not copy password-reset or remote restore steps from external docs without target-specific approval.

## Backup plan before any production schema change

1. The active developer acts as human database owner while working solo; choose a replacement owner when available. The agent can prepare and verify read-only evidence but does not execute remote writes under this task.
2. Confirm source reference, repository commit, applied migration versions, database version, backup method and available recovery timestamp. Record source identity in the private archive manifest. Do not query or export production user data merely to fill in documentation.
3. Owner chooses the method supported by the actual plan: a usable provider backup/PITR window, or a separately reviewed logical archive when appropriate. Do not treat a physical backup as an importable SQL file. Any paid plan/PITR enablement requires human approval; no provider choice was made in M01.
4. For logical recovery, review roles, schema, data, managed Auth/Storage data, migration history and customizations as separate coverage requirements. Capture at a consistent recovery point; coordinate writes and media copies so records and files agree. Existing migrations with demo content are not a substitute for production data backups.
5. Capture media bytes and configuration through an owner-approved process. Store archives outside the checkout, encrypted and access-controlled, with checksums and tested retrieval. Retention, schedule, encryption-key custody and access owners must be agreed and recorded privately. Never commit archives or credentials; do not put real users' data into staging or a synthetic drill.
6. Record the last successful recovery point and archive retrieval result. A successful export or visible backup entry alone does not meet M01 acceptance: the isolated recovery drill below is required.

## Isolated recovery drill

Before starting, the owner must approve the exact destination and data scope. A synthetic drill can validate mechanics; it does not prove that the selected production archive is recoverable. Production-data restoration requires explicit authorization and a restricted recovery environment, separate from development/staging and all real messaging/provider integrations. Do not create a paid project or change DNS automatically.

1. Record the source backup identifier/time and unique destination reference. Verify they differ; confirm the destination is disposable, access-restricted and has no user data. A local destination must be explicitly disposable and compatible with PostgreSQL 17/Supabase. Preserve the existing local stack identified in BASELINE.md.
2. Disable external email, OAuth callbacks to production, hooks, scheduled jobs and other side effects in the destination. Verify no client or API points at production. Do not reset the source, run launch/remove_demo_data.sql or apply migrations to production as part of a drill.
3. Follow the provider-supported path for the chosen backup format and destination. For logical restores, review roles, default privileges, managed-schema dependencies, extensions and restore order first; stop on SQL errors rather than continuing with a partial restore. Do not weaken RLS or omit failing statements without investigating them.
4. Compare restored schema, migration versions, table/sequence counts, constraints, grants and policies against the backup manifest. Restore media bytes and metadata and verify the full object manifest. Check missing/orphaned files and stored URL handling.
5. Run the existing pgTAP suite only in an isolated disposable destination and confirm every fixture/test rolls back. Tests may assume repository seed content; reconcile the intended restore baseline rather than seeding production data blindly. Current 18-file suite covers 181 assertions; passing it is one signal, not proof of complete recovery.
6. Exercise synthetic signup/login, profile ownership, public/draft/friends/close-friends/community visibility, create/edit through save_trail, saved/progress/crumbs/completion/reviews, photos, social RPCs and admin restrictions. Include anonymous and cross-user denial checks and test restored photo bytes. Record Auth/Storage integration checks separately from SQL results.
7. Record actual recovery-point age and elapsed restore time, manifest comparison, test results, discrepancies and owner acceptance. Clean up only the explicitly approved disposable destination; retain private evidence and archive custody. No automatic cutover, production restore or deployment follows a successful drill.

## Validation of this preparation PR

On 2026-11-24, npm run lint, npm run typecheck and npm run build passed. Build retains the existing 875.65 kB JS chunk warning. npm run test:db passed all 181 assertions across 18 files against the existing local stack, without a reset; its M00 ledger-drift limitation still applies. Local Markdown links and git diff --check passed; a repository search found no remaining remote-reset setup commands in the reviewed Markdown. These checks validate the unchanged application baseline and documentation, not backup completeness or recovery. Browser/device testing, production data export and all restore drills were not run.

## Acceptance record

M01 remains unchecked until the human owner supplies or verifies all of these:

- Confirmed source, plan, method, usable backup timestamp/window and agreed recovery objectives.
- Database/Auth/history/security coverage plus separate media/configuration recovery evidence.
- Private encrypted archive or provider recovery access, retention/schedule and retrieval evidence.
- Approved isolated destination and completed restore report, including SQL, auth, media, visibility and application checks.
- Explicit owner acceptance of gaps, measured recovery point/time and the production restore/cutover authorization boundary.

Current report: **not ready to certify recovery**. Existing remote-reset setup guidance was already removed in M00 and remains absent. Preparation can be reviewed independently; merging documentation must not mark backup/restore verification done. M02 is the next independent migration task (depends on accepted M00); inspect deployment effects before any branch/protection configuration. M03 remains dependent on full M01 and M02 acceptance.
