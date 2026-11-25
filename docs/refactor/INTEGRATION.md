# M02 — integration bootstrap

Status: repository changes prepared for review; hosted activation pending. Inspected 2026-11-24 against main 132967738ab39c1ccf5c0fb0950a9904ddf77d61. M01 documentation was accepted in [PR #91](https://github.com/domchenn/breadcrumb/pull/91) and its merge commit b6dddc3 is now incorporated into this branch. M02 has no recovery artifacts or production data. M03 still depends on accepted M01 and M02.

## Current evidence

| Area | Verified state |
|---|---|
| Branches | main, logo-edit and docs/m01-recovery-plan; no develop at inspection. M02 branch starts from verified main, not PR #91. |
| Main protection | Active ruleset Protect main (27814053) targets ~DEFAULT_BRANCH. Requires PRs and both existing CI checks; prevents deletion/force pushes. Required approvals: 0. Admin RepositoryRole 5 can bypass through PRs; not audited as fully enforced for that actor. No setting was changed. |
| Actions | Enabled, repository default token permission read, Actions cannot approve reviews. Workflow runs app checks and disposable runner-local database replay/pgTAP. No deployment step or production secret reference. |
| Vercel | Signed-in browser inspection confirms Dom's Team / breadcrumb serves breadcrumb.boston; Production tracks main; current production source is badd951 (PR #89). Git settings show no deploy hooks. Developer explicitly requires manual deployment; preserve git.deploymentEnabled=false for all branches. No setting was changed. Environment names/scopes were inspected with values masked; the Maps key is scoped to Production and Preview, so preview isolation is not established. |
| Supabase | GitHub app posts Supabase Preview (skipped on the inspected docs-only PR). Read-only branch inventory lists only default main mapped to production project gekcvmzpahocsxnvsdyy, status FUNCTIONS_DEPLOYED. No separate develop/staging project is verified. Deploy-to-production and preview creation settings remain unknown. |
| Other deployment evidence | Repository hooks, environments and deployments endpoints returned no entries. This does not rule out GitHub Apps, Vercel hooks, manual deployments or external automation. Repository installation endpoint requires app authentication and was not an installed-app inventory. |

The [Vercel Git configuration reference](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled) documents deploymentEnabled=false. This does not verify other deploy paths. The [Supabase GitHub integration guide](https://supabase.com/docs/guides/deployment/branching/github-integration) documents branch-driven migration/deployment behavior; the app can operate independently of GitHub Actions. A skipped docs-only check does not establish what creating develop or changing SQL/config would do.

## Repository changes in this PR

- Run CI on pushes to main **and develop**, while keeping all pull-request triggers and the existing app/database jobs and check names.
- Make contents: read explicit for GITHUB_TOKEN, matching current repository defaults. No deployment credentials or write permissions added.
- Prepare [.github/rulesets/develop.json](../../.github/rulesets/develop.json) as a reviewable GitHub REST create-ruleset payload. Committing the JSON does not install it or create a branch.
- Replace historical lane-based PR instructions with task, branch-base, testing and migration handoff guidance.

## Proposed develop protection — not applied

| Setting | Proposed value |
|---|---|
| Target | refs/heads/develop, literal branch name |
| Enforcement | Active |
| Bypass actors | None |
| Require PR | Yes; approving reviews 0 while solo; resolve conversations |
| Required checks | App (lint, typecheck, build); Database (migrations + security tests), both from GitHub Actions integration 15368 |
| Require current base | Yes; update the PR branch and rerun checks if develop advances |
| Initial creation | Checks do not enforce on creation, so develop can be initialized at an approved main commit; subsequent updates require checks/PRs |
| Delete / force push | Blocked |

Keep main as the repository default: its existing rule targets ~DEFAULT_BRANCH, so changing the default could move protection away from main. Leave main's rule untouched in this PR. No reviewer split is imposed; the human developer reviews/merges accepted PRs after checks. Agents never merge or use bypass actors.

The payload follows the [GitHub rulesets API](https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset) and observed repository check identities. Local validation cannot prove server acceptance or effective protection; those require approved activation/read-back. If changing bypass/approval policy later, review it as a separate concrete change, not a workaround for a failed check.

## Activation sequence and authorization boundary

1. Vercel read-only review completed: correct project/domain, production branch main, no deploy hooks and unchanged production source badd951. The developer explicitly requires manual deployment; retain git.deploymentEnabled=false, do not enable automatic staging/production deployments, and do not promote a deployment during bootstrap. The dashboard has generic branch-trigger text; this does not authorize overriding the checked-in Git deployment disablement. Remaining environment isolation/provider configuration belongs to M03.
2. Inspect Supabase project GitHub Integration settings: connected repository, production branch, automatic preview behavior, migration/config paths and Deploy to production. Confirm develop will not target production or create unapproved billable resources. Do not change settings or enable branching as a side effect of this task.
3. Human reviews/merges this bootstrap PR into main after both checks pass. PR #91 is not a prerequisite. This is the explicit pre-integration bootstrap exception; no release is implied.
4. With deployment effects verified and explicit approval for the concrete remote actions, install the proposed develop ruleset and create develop from the exact accepted main SHA. Protect it before ordinary work begins. Do not push a protected branch as an agent or reset any remote history.
5. Read back effective develop and main rules. Confirm no bypass on develop, required check identities, no force-push/deletion, main still default/protected, and correct source SHA. Confirm the initial develop push runs both CI jobs and causes no production deployment. Save run/commit/configuration evidence without secrets.
6. Verify a small approved feature PR targets develop, runs both checks and is subject to the effective PR rules. Only the human merges after checks; if no safe independent change is available, keep this acceptance step pending rather than manufacturing a production or schema change. Subsequent features start from updated develop; releases use develop → main and require separate production authorization.

Do not activate integrations or change branch protection before approval. No remote branch creation, ruleset application, production deployment or database change was performed by this preparation PR. M02 stays unchecked until the hosted configuration and workflow evidence above are verified.

## Relationship to PR #91 and next task

PR #91 documentation has merged into main as b6dddc3. Its recovery records and this PR’s integration records are both preserved after conflict resolution. The M01 checkbox remains incomplete until full recovery acceptance; merging its documentation did not certify a restore. M02 still has no dependency on finishing M01, while M03 depends on both.

Next work: complete the read-only Supabase integration review and obtain approval for the named remote activation steps. Vercel remains on manual deployment. M03 remains blocked on full M01/M02 acceptance; no workspace move or staging project provisioning starts in this PR.

## Validation

2026-11-24: npm run lint, npm run typecheck and npm run build passed. Build retains the existing 875.65 kB JS chunk warning. npm run test:db passed 181 assertions across 18 files on the unchanged local stack; M00 ledger-drift limits still apply. Official actionlint 1.7.12 (temporary download with release checksum verified), proposed ruleset structure/check identities, local Markdown links and git diff --check passed. No repository dependency was added. The API payload has not been submitted for server validation.

A green PR verifies its workflow/jobs, not effective develop protection, develop push triggers or absence of production deployment. Those remain activation acceptance checks. No browser UI smoke test of Breadcrumb or staging acceptance was performed.
