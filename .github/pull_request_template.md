## What changes?
<!-- Keep one task per PR. Link the migration task or relevant issue. -->

## Migration task and branch base
<!-- Mxx; feature → develop once M02 is verified, release develop → main.
     Before that, baseline/bootstrap PRs target main. Identify shared-file changes.
     Task ownership is flexible when working solo. -->

## Validation
<!-- Record commands, results, environment and any unrun checks honestly.
     UI changes: include desktop and 375px screenshots. -->

- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass
- [ ] Relevant local database checks pass, or an explicit limitation is recorded
- [ ] Migration checklist/evidence and affected docs updated
- [ ] No secrets, `.env`, backup archives or production data committed
- [ ] Schema change? Additive migration, RLS/grants tests and intended-environment generated types
- [ ] Required CI checks pass on the final PR commit

## Acceptance and next task
<!-- Repository changes are in review until accepted. State remaining hosted
     configuration/approval and the next unblocked task. Never merge/deploy automatically. -->
