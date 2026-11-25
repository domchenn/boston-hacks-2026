# M02 — integration workflow

Status: approved activation implemented and verified; evidence PR in review. Bootstrap [PR #92](https://github.com/domchenn/breadcrumb/pull/92) merged as 640051a. The developer then authorized creating/protecting develop and disabling automatic Supabase production deployment. M01 recovery acceptance remains independent; M03 still needs accepted M01 and M02.

## Active branches and rules

- Created develop from accepted main commit `640051a56cf77e10a7629aeddc388b545635ff89` after installing the reviewed ruleset. No protected-branch update or force push was used.
- GitHub accepted **Protect develop**, ruleset **28048159**. Its literal target is refs/heads/develop, enforcement active, bypass actors empty.
- Effective rules read-back confirms PRs, resolved conversations, up-to-date app/database checks from GitHub Actions integration 15368, zero approving reviews while solo, and blocked deletion/non-fast-forward updates. The creation-only status-check exemption permits initialization, not subsequent direct pushes.
- main remains default and protected by its original ruleset 27814053 targeting ~DEFAULT_BRANCH. Its existing admin PR-bypass entry was left unchanged; agents must not use it.
- [.github/rulesets/develop.json](../../.github/rulesets/develop.json) matches the submitted payload. GitHub adds optional default fields in its read-back; compare policy values rather than raw JSON bytes.

| develop setting | Verified value |
|---|---|
| PR / resolved conversations | Required |
| Approving reviews | 0 while solo |
| Required checks | App (lint, typecheck, build); Database (migrations + security tests) |
| Current base required | Yes |
| Bypass actors | None |
| Delete / force push | Blocked |

## CI evidence

Creation of develop emitted a push event and ran both jobs successfully in [run 45550117217](https://github.com/domchenn/breadcrumb/actions/runs/45550117217), head 640051a. The database job starts a disposable runner-local Supabase DB, replays migrations/seed and runs pgTAP; it does not target the linked production project.

The activation-evidence branch starts from develop and [PR #93](https://github.com/domchenn/breadcrumb/pull/93) targets develop, providing a real PR-workflow check without an application/schema change. Required check names remain unchanged. No token write permissions, deployment jobs, credentials or dependencies were added. The evidence PR records its own CI results; human review/merge remains required, and agents never approve or merge it.

## Deployment controls — manual

**Vercel:** Dom's Team / breadcrumb serves breadcrumb.boston. Production tracks main, no deploy hooks are configured, and git.deploymentEnabled=false remains unchanged. Browser inspection after develop creation confirms the production deployment is still `DWbj1qNsYUmWf7RyTZ9tMD37rqgo`, source **badd951** (PR #89). No production web deployment was triggered or promoted. Environment isolation is not established: the Maps key is scoped to Production and Preview. M03 must verify isolated credentials/data before deploying staging.

**Supabase:** production project gekcvmzpahocsxnvsdyy connects to domchenn/breadcrumb with working directory `.`. The GitHub integration previously had Deploy to production on for main. Following explicit approval, it was switched **off**, saved, and verified **off after a full page reload**. Automatic branching remains off/disabled on the Free plan (limit 0), so no paid preview branch was enabled or created. The Vercel project connection was retained. No SQL, migration, credential, billing or project-data change was performed.

Do not assume Vercel's Git setting controls Supabase deployments: these are separate integrations. Existing manual provider actions remain available and require target-specific approval. A skipped Supabase Preview check is not a substitute for verified settings. Provider references: [Vercel Git controls](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled), [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration).

## Working from here

1. Start feature/fix/db/refactor branches from updated develop. Open task PRs into develop; run the relevant checks and preserve evidence in the migration checklist.
2. Update a PR's base when develop advances and rerun checks; do not bypass required status checks or push directly to protected branches. Zero approving reviews accommodates solo work, not agent self-merging.
3. Release PRs use develop → main and require human review/merge. Merging code does not authorize a production deployment or database migration: both provider deployment paths remain manual.
4. Apply remote SQL only through the designated human database owner with a verified target and task-specific authorization. Keep source migrations immutable and staging data/credentials isolated.
5. Keep main as default; changing it would change the target of the existing main ruleset. Protection changes, paid services, secrets and production releases need separate approval.

## Acceptance and next task

Verified: develop source SHA, effective protections/no bypass, unchanged main/default, successful develop push CI, persisted Supabase automatic-deploy disablement and unchanged Vercel production deployment. The real evidence PR checks the develop PR path; its final CI/merge state is recorded in the handoff. M02 stays in review until that evidence is accepted; this is not an authorization to merge as an agent.

Next unblocked work is M01 recovery acceptance (isolated restore test, off-site custody/retention, objectives and configuration coverage). M03 remains gated; no staging provisioning, workspace move or production release was started by M02.

## Validation scope

Bootstrap lint/typecheck/build, local pgTAP (18 files / 181 assertions), actionlint, ruleset structure and documentation checks passed in #92. Live activation adds the API/UI read-backs and clean push CI above. Current evidence-only edits require link/conflict-marker/diff checks and PR CI. No application UI/device tests or backup restore drill were performed by M02. Existing large-bundle and action-runtime deprecation warnings remain separate follow-up work.
