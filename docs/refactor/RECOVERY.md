# M01 — backup and recovery readiness

Status: documentation accepted through merged [PR #91](https://github.com/domchenn/breadcrumb/pull/91) (b6dddc3); recovery acceptance remains blocked on the evidence below. Inspected 2026-11-24 against main `132967738ab39c1ccf5c0fb0950a9904ddf77d61`. This is a recovery runbook and evidence register, not proof of a successful restore. At initial preparation, no backup export, restore, project creation, credential change or remote database write was performed. The subsequent manual-backup attempt is recorded below.

## Verified environment and evidence

The active developer confirmed during M01 that Supabase project `gekcvmzpahocsxnvsdyy` is production for breadcrumb.boston. Read-only CLI project inventory returns name `breadcrumb`, region us-east-2, PostgreSQL 17.12.0.000 and ACTIVE_HEALTHY. The installed CLI's target label says `detour` for this same reference; identify targets by the confirmed reference, not a cached name. A direct fetch of the public website failed with URLError, so the bundle's environment was not independently inspected.

| Item | Evidence / remaining action |
|---|---|
| M00 accepted | Developer merged [PR #90](https://github.com/domchenn/breadcrumb/pull/90); main contains merge commit 1329677. Its baseline findings remain historical evidence. |
| Hosted backup metadata | `supabase backups list --remote=gekcvmzpahocsxnvsdyy --output json` succeeded: backups=null, physical_backup_data={}, pitr_enabled=false, walg_enabled=true, region=us-east-2. |
| Interpretation | No backup records, usable recovery window or completed backup timestamp were returned. WAL-G being enabled does not demonstrate an accessible/restorable backup. PITR is disabled. Do not infer the billing tier, retention or absence of all backups from this response. |
| Plan and scheduled backup availability | Developer supplied the production Database → Backups screenshot on 2026-11-24: “Free Plan does not include project backups.” Scheduled provider backups are unavailable on the current plan; no usable backup timestamp/window is shown. This confirms the plan independently of the CLI response. No billing change is authorized. |
| Local archive and media copy | Manual database/Auth/history and media export completed after explicit approval. AES-256 image, file manifest, read-back verification and encrypted-image checksum are stored outside Git under ~/Breadcrumb Backups/. All 6 Storage objects match source sizes and single-part ETag checksums; before/after inventories match. Only one local copy exists; off-site custody and retention remain unverified. |
| Restore destination | None approved. No disposable hosted project or full local recovery environment has been selected. Existing local Breadcrumb stack has migration drift and must not be reset or used as a restore target. |
| Recovery drill / objectives | Not run; recovery point objective (maximum acceptable lost data) and recovery time objective (maximum acceptable outage) are not yet agreed. Do not invent service guarantees. |
| Tooling | Installed Supabase CLI 3.2.0 supports backups list and db dump; read-only help and local db dump --dry-run passed. Local host pg_dump is major 15, while the server is 17; do not use the older binary to dump this server. The existing Supabase DB container provides pg_dump 17.12. |

Next recovery action: place the completed encrypted image and checksum on a separate private device/storage, preserve its password separately, and approve a specific isolated restore-test destination. The current one-time export does not establish a recurring schedule or recoverability. No upgrade has been performed.

The local dry-run confirms that a plain `supabase db dump` is schema-only and excludes auth, storage and supabase_migrations among other managed schemas. It is **not** a complete application backup. No dump contents, credentials or personal data were collected.

## Manual backup execution — 2026-11-24

The developer authorized a manual backup, noting the current user base is very small. After automatic approval review rejected the original unencrypted temporary export destination, the agent prepared an AES-256 encrypted macOS disk image and the developer explicitly approved the sensitive export scope and exact destination. The rejected command did not run; the approved export wrote directly into the mounted encrypted filesystem.

Completed archive: `~/Breadcrumb Backups/breadcrumb-20261125T040509Z.sparseimage` (the filename uses UTC). Its generated password is in the local login Keychain, generic password item `Breadcrumb backup 20261125T040509Z`, account dominicchen. No password, source records, SQL dump or photo content is committed to Git or printed in the report. The final image is about 14.8 MB; its adjacent README and SHA-256 checksum describe custody and limitations.

Exported coverage:

- Application/private schemas, roles/grants/RLS and RPC definitions.
- Application and Auth data, including account/identity records and password hashes.
- Managed Auth/Storage schema definitions and customizations.
- Separate supabase_migrations data: 21 applied migration-history entries.
- Storage metadata and all 6 uploaded objects; private before/after inventory logs and file manifest.

Verification: all 11 SQL/media files passed SHA-256 read-back after closing and reopening the encrypted image. All 6 downloaded photos match source Storage metadata by size and single-part ETag checksum, and before/after Storage inventories are identical. The CLI required --experimental for Storage commands; the initial missing-flag failure was corrected before downloading. The image is detached. The earlier plaintext schema-only staging file was removed.

This is an export with verified bytes, not a completed restore drill. Database dump stages and media copies do not form one atomic application snapshot. Configuration/secrets coverage, full recovery including login/media/authorization behavior, recurring schedule/retention and off-site retrieval remain unverified. Source production tables were not reset, migrated, restored or edited; no billing or persistent production credential change was requested or performed. Existing local database data was left intact.

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

On 2026-11-24, npm run lint, npm run typecheck and npm run build passed. Build retains the existing 875.65 kB JS chunk warning. npm run test:db passed all 181 assertions across 18 files against the existing local stack, without a reset; its M00 ledger-drift limitation still applies. Local Markdown links and git diff --check passed (including the subsequent screenshot-evidence update); a repository search found no remaining remote-reset setup commands in the reviewed Markdown. These checks validate the unchanged application baseline and documentation, not backup completeness or recovery. These app checks preceded the manual export; its separate checksum/media checks are recorded above. Browser/device testing and all restore drills were not run.

## Acceptance record

M01 remains unchecked until the human owner supplies or verifies all of these:

- Confirmed source, plan, method, usable backup timestamp/window and agreed recovery objectives.
- Database/Auth/history/security coverage plus separate media/configuration recovery evidence.
- Private encrypted archive or provider recovery access, retention/schedule and retrieval evidence.
- Approved isolated destination and completed restore report, including SQL, auth, media, visibility and application checks.
- Explicit owner acceptance of gaps, measured recovery point/time and the production restore/cutover authorization boundary.

Current report: **not ready to certify recovery**. Existing remote-reset setup guidance was already removed in M00 and remains absent. Preparation can be reviewed independently; merging documentation must not mark backup/restore verification done. M02 is the next independent migration task (depends on accepted M00); inspect deployment effects before any branch/protection configuration. M03 remains dependent on full M01 and M02 acceptance.
