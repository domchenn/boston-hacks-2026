#!/usr/bin/env bash
# Lists, and with --delete removes, local Git branches that are already merged into
# origin/main or origin/develop. Never touches main, develop, the current branch or
# anything with unmerged commits, so nothing is lost: merged work lives on the remote.
# Run with `npm run branches:prune` (list) or `npm run branches:prune -- --delete`.
# Branches merged with "Squash and merge" don't look merged to Git and are kept;
# delete those by hand with `git branch -D <name>` once you've checked the PR merged.
set -euo pipefail

delete=false
[[ "${1:-}" == "--delete" ]] && delete=true

if ! git fetch --prune --quiet origin 2>/dev/null; then
  echo "warning: could not fetch origin; using the remote branches you last fetched" >&2
fi

current=$(git branch --show-current)
bases=()
for base in origin/main origin/develop; do
  git rev-parse --verify --quiet "$base" >/dev/null && bases+=("$base")
done
if [[ ${#bases[@]} -eq 0 ]]; then
  echo "error: no origin/main or origin/develop found; fetch first" >&2
  exit 1
fi

merged=()
kept=()
while IFS= read -r branch; do
  [[ "$branch" == "main" || "$branch" == "develop" || "$branch" == "$current" ]] && continue
  is_merged=false
  for base in "${bases[@]}"; do
    if git merge-base --is-ancestor "$branch" "$base"; then is_merged=true; break; fi
  done
  if $is_merged; then merged+=("$branch"); else kept+=("$branch"); fi
done < <(git for-each-ref --format='%(refname:short)' refs/heads)

if [[ ${#merged[@]} -eq 0 ]]; then
  echo "No merged local branches to remove."
else
  echo "Merged into ${bases[*]}:"
  printf '  %s\n' "${merged[@]}"
  if $delete; then
    # -D is safe here: each branch was just checked to be contained in a remote base.
    git branch -D "${merged[@]}" >/dev/null
    echo "Deleted ${#merged[@]} branch(es)."
  else
    echo "Dry run. Re-run with --delete to remove them."
  fi
fi

if [[ ${#kept[@]} -gt 0 ]]; then
  echo "Kept (not merged, or squash-merged):"
  printf '  %s\n' "${kept[@]}"
fi
