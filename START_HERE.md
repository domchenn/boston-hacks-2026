# Start here — documentation bundle

Copy AGENTS.md and the five migration files in docs/refactor/ into the existing Breadcrumb repository on a documentation branch. Review the diff against current AGENTS.md first; preserve any newer rules. Do not overwrite existing docs of the same name without reviewing them. Keep CLAUDE.md pointing to AGENTS.md. Existing DEVELOPMENT.md, TASKS.md and supabase/README.md need updates during M00–M03, especially obsolete remote reset instructions and branch guidance. This bundle does not contain code changes or create branches.

## First Codex prompt

Read AGENTS.md and docs/refactor/REFACTOR.md, docs/refactor/MIGRATION_CHECKLIST.md, docs/refactor/ARCHITECTURE.md, docs/refactor/TECH_STACK.md and docs/refactor/DECISIONS.md. Inspect current git status, current branch, recent commits, existing CI and relevant source files. Work only on the next unblocked checklist task; begin with M00 baseline. Do not perform production changes, remote Supabase mutations, force-pushes or merges. Preserve existing behavior, RLS, SQL migrations and tests. Report what you found, the minimal proposed changes, checks run and any blockers. Update the checklist with evidence and a next task. Keep changes in a small reviewable PR. If a human action is needed, tell me exactly what to configure; do not assume success. Stop after the task and give a handoff summary.

## Later sessions

Read AGENTS.md and the migration checklist, inspect git state and open PRs, pick the next unblocked task, implement only that scope, run relevant checks, update the checklist and handoff, and report the PR. If I am the only active developer and a review is pending, do not bypass review; identify independent work or local validation instead.
