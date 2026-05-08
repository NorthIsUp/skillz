#!/usr/bin/env bash
# Stage everything, commit with a timestamp, and push.
# Designed to be called by `mise watch -t auto-push` on file changes.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Bail if nothing changed.
if git diff --quiet && git diff --cached --quiet && [[ -z $(git ls-files --others --exclude-standard) ]]; then
  exit 0
fi

git add -A

# Skip if nothing actually staged after .gitignore filtering.
if git diff --cached --quiet; then
  exit 0
fi

ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
host=$(hostname -s)
git commit -q -m "auto: sync from ${host} at ${ts}" || exit 0

# Only push if a remote exists.
if git remote get-url origin >/dev/null 2>&1; then
  git push -q origin HEAD || echo "auto-push: push failed (will retry on next change)" >&2
fi
