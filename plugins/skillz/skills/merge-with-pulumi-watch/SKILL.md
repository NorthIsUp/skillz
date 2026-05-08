---
name: merge-with-pulumi-watch
description: |
  Merge a Pulumi-touching PR and watch its pulumi-up rollout end-to-end.
  Spawns a background subagent that polls the GitHub Actions
  `pulumi-up.yml` workflow, surfaces failures with logs, confirms exports
  showed up in ESC, and reports back. Frees the main agent to continue
  other work in parallel.
  Use when: merging an infra PR that triggers `pulumi up` (changes under
  `infra/platform/`, `infra/core/`, `cloud_sql.py`, `__main__.py`), or
  any PR where you want CI to be observed end-to-end without blocking
  on it. Triggers: "merge and watch pulumi", "land this PR (pulumi)",
  "merge with pulumi watch".
triggers:
  - merge and watch pulumi
  - land pulumi PR
  - merge with pulumi watch
  - watch pulumi-up after merge
allowed-tools:
  - Bash
  - Agent
---

# merge-with-pulumi-watch

Land a PR that runs `pulumi-up` on merge and have a subagent watch the
deployment so the main session doesn't block.

## When to use

- A PR merging to `main` that touches `infra/**` (Pulumi code) — its
  merge triggers the `pulumi-up.yml` GitHub Actions workflow.
- You want the main agent to continue other work while pulumi runs
  (typically 3–10 minutes).

Skip when:
- The PR doesn't touch Pulumi code (no `pulumi-up` will fire).
- You're already in a tight verify loop and need synchronous feedback.

## Flow

1. **Confirm PR is mergeable.** Check `gh pr view <num> --json
   mergeStateStatus`. State must be `CLEAN` or `UNSTABLE` (UNSTABLE is
   fine if only non-required checks are red — typically Bugbot
   NEUTRAL/SonarCloud).

2. **Merge.** `gh pr merge <num> --squash --delete-branch`. Capture
   merge timestamp.

3. **Spawn subagent (background).** Use the Agent tool with
   `run_in_background: true` and a self-contained prompt covering:
   - Identify the `pulumi-up.yml` run that started after the merge
     (`gh run list --workflow=pulumi-up.yml --limit 5 --json
     status,conclusion,databaseId,createdAt`).
   - Poll until `status == completed` (sleep 30s between polls,
     max ~30min).
   - On `success`: report which Pulumi exports/resources changed
     (extract from logs if possible). If the PR mentioned new ESC
     env vars in its description, verify they're populated.
   - On `failure`: pull failed step logs (`gh run view <id>
     --log-failed`), summarize the error in <300 words, and surface
     to the user.
   - Return a one-paragraph summary either way.

4. **Continue main work.** The main agent moves on; the subagent's
   completion arrives as an automatic notification.

## Subagent prompt template

```
You are watching the pulumi-up GitHub Actions run that fires after
PR #<NUM> merges to main of teamclara/infrastructure.

Steps:
1. Find the most recent pulumi-up.yml run created after <MERGE_TS> via
   `gh run list --workflow=pulumi-up.yml --limit 5 --json
   status,conclusion,databaseId,createdAt,headSha`. Match by SHA if
   the merge SHA is known.
2. Poll until `status == completed`. Sleep 30s between checks. Cap at
   30 minutes; bail with a timeout report if exceeded.
3. On success:
   - Run `gh run view <id> --log` and extract the Pulumi summary
     (lines mentioning `+ <resource>`, `~ <resource>`, exports, total
     duration). Quote the summary block.
   - If the PR description mentions new ESC env vars or stack
     exports, verify those resolve via `pulumi env get
     teamclara/platform/clara <path>`. Report which are live.
4. On failure:
   - `gh run view <id> --log-failed | head -200` to capture the
     actual error.
   - Summarize root cause in 2–3 sentences.
   - Suggest a one-line remediation if obvious (e.g. revert PR,
     re-run, fix import).
5. Report back in under 250 words: the run conclusion, key changes,
   any post-merge ESC verification results, and remediation if
   failed.

Constraints:
- Read-only: do not run `pulumi up` yourself, do not edit ESC.
- If `gh run` API rate-limits, fall back to `gh run watch <id>`.
- Do not retry the workflow; just observe.
```

## Spawning the subagent

```
Agent({
  description: "Watch pulumi-up for PR #<NUM>",
  subagent_type: "general-purpose",
  run_in_background: true,
  prompt: <the template above with <NUM> and <MERGE_TS> filled in>,
})
```

The user gets a `<task-notification>` when the subagent completes;
their next turn surfaces it automatically.

## Tradeoffs

- **Pro:** main agent isn't stuck polling for 5–10 min; you can ship
  the next change while CI runs.
- **Con:** if the deploy fails, you might already have queued work
  on top of the broken state. The notification is loud, but mid-flight
  changes need rollback consideration.

For high-blast-radius PRs (cloud_sql schema migrations, GKE node
config, IAM grants), prefer foreground polling — those are the cases
where you want to *stop and stare* at the rollout.
