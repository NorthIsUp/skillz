---
name: respond-to-review
description: Respond to PR review feedback. Process every unresolved comment, suggestion, review summary, and CI annotation on a PR — react, reply, resolve threads, and dismiss CHANGES_REQUESTED reviews only when fully addressed.
---

# Respond to PR Review

Process every unresolved comment, suggestion, review summary, top-level
comment, and CI annotation on the current PR. Every item gets a reaction
(when reactable) and a written reply. Threads get resolved when the work is
done. `CHANGES_REQUESTED` reviews get dismissed only when fully addressed.

Repo is always `teamclara/clara_v1` for all MCP and `gh` calls.

## Step 1: Identify the PR

If the user passed a PR number as an argument, use it. Otherwise:

```bash
gh pr view --json number,headRefName,baseRefName,url 2>/dev/null
```

Stop with a clear message if no PR is open for this branch.

## Step 2: Fetch every annotation

There are four distinct sources. Fetch in parallel:

| Source             | Fetch with                                                                                                      | Resolvable?                       | How to reply                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| `review_thread`    | `mcp__github_extensions__get_review_comments` (carries `thread_node_id`)                                        | yes, via `resolve_review_thread`  | `gh api repos/teamclara/Clara_V1/pulls/{PR}/comments/{id}/replies --method POST -f body=...` |
| `review_body`      | `gh api repos/teamclara/Clara_V1/pulls/{PR}/reviews` (state: APPROVED, CHANGES_REQUESTED, COMMENTED, DISMISSED) | dismissable for CHANGES_REQUESTED | `gh pr comment {PR} --body ...`                                                              |
| `issue_comment`    | `gh pr view {PR} --json comments --repo teamclara/Clara_V1`                                                     | no                                | `gh pr comment {PR} --body ...`                                                              |
| `check_annotation` | `gh api repos/teamclara/Clara_V1/commits/{HEAD_SHA}/check-runs`                                                 | no (re-run check)                 | Fix the underlying code                                                                      |

Deduplicate by `(source, id)`. Skip anything already `RESOLVED`, already replied
to by the current user, or authored by the current user.

**Done means the thread is RESOLVED (collapsed) — not merely replied to.** A
resolvable item (`review_thread`, or a `CHANGES_REQUESTED` `review_body`) is only
handled once you've driven it to its closed terminal state: an accepted finding
gets the fix pushed, a ✅ reply, **and the thread resolved so it collapses**; a
`CHANGES_REQUESTED` review gets dismissed. The bar for re-run skipping is that
resolved/dismissed state, not the presence of a reply.

**A reaction is even less than a reply.** A 👀/👍/👎 reaction with no follow-up is
nowhere near done — and a ✅ reply on an accepted finding that you *didn't resolve*
isn't done either: the open thread still needs work or a resolve. A 👍 with no
pushed fix and no resolved thread is an **unfinished** item: process it now, don't
skip it. This guards a real failure seen in the wild — a run that reacted 👍 on
greptile findings and then stopped, leaving the threads open and unfixed: a
reaction must never read as "handled."

**Non-actionable automated comments — the ONLY things you skip wholesale.** These
two `issue_comment` shapes are pure status/overview noise with nothing to act on.
Skip them outright (no reaction, no reply) and count them under "Already resolved":

- a comment whose body starts with `<details><summary><h3>Greptile Summary</h3></summary>` — greptile's PR overview.
- a comment whose body starts with `<h1>Dependency Review</h1>` — the GitHub Actions dependency-review report.

Nothing else is skippable as "bot noise." In particular, **greptile inline review
comments are real findings** — the P0/P1/P2/P3 badge comments (often carrying a
` ```suggestion ` block) are exactly the items you must process: apply the
suggestion (or reject with a grounded reason), reply in the thread, and resolve.
"It came from a bot" is never a reason to skip an inline thread.

Print the categorized summary table:

```text
PR #N — Annotations
──────────────────────────────
  Review bodies:       N (APPROVED: N, CHANGES_REQUESTED: N, COMMENTED: N, DISMISSED: N)
  Inline threads:      N (SUGGESTION: N, CHANGE_REQUEST: N, QUESTION: N, NITPICK: N, PRAISE: N)
  Top-level comments:  N
  CI check failures:   N
  Already resolved:    N (skipped)
──────────────────────────────
  To process:          N
```

Inline-thread categories:

- **SUGGESTION** — body contains a ` ```suggestion ` block
- **CHANGE_REQUEST** — requests a change without a suggestion block
- **QUESTION** — ends with `?` or asks for clarification
- **NITPICK** — prefixed with `nit:` or `nit -` (optional)
- **PRAISE** — LGTM / positive / no action needed

## Step 3: Process each unresolved item

Process items one at a time. Never batch these steps across items - finish one
completely before starting the next. The six steps apply uniformly to all four
sources; only step 3.6 (resolve) varies by source.

### 3.1 Analyze against the current code

- Inline threads / check annotations: read the file at the exact line. The code
  may have moved since the comment was posted.
- Review bodies and top-level comments: extract each distinct concern from the
  body and map it to a file/line where possible. A single CHANGES_REQUESTED
  review can spawn multiple action items.
- If the line/function no longer exists, note that explicitly - the item may
  already be addressed.
- Check whether project skills or rules apply (`hipaa`, `backend`, `frontend`,
  `html-security`, `database`, `logging`, `testing`, `toolchain`, CLAUDE.md).
  Invoke the relevant skill before deciding.

### 3.2 Decide accept or reject, and react

Decide ACCEPT or REJECT based on current code + project conventions. Stale
suggestions against already-fixed code count as ACCEPT with "already
addressed".

Post a reaction on the originating comment via `mcp__github_extensions__add_reaction`:

- ACCEPT - `+1`
- REJECT - `-1`
- Needs discussion / question back - `eyes`

Reactions attach to individual comments. For a `review_body`, react on the
review summary comment. For `issue_comment` and `review_thread`, react on the
comment itself. `check_annotation` items have nothing to react to - skip the
reaction and proceed.

The reaction is the first signal so the reviewer sees your stance immediately,
before any code changes land.

### 3.3 Incorporate the suggestion

- ACCEPT + suggestion block: use `mcp__github_extensions__apply_suggestion`
  (or `apply_suggestions_batch` for adjacent suggestions from the same
  reviewer).
- ACCEPT + change request/question with a concrete fix: edit the code
  directly, keeping changes minimal and scoped to the comment.
- REJECT: make no code changes.

Honor project rules while editing:

- Follow any skill that routes for the touched area (CLAUDE.md "Skill routing").
- No comments/docstrings on code that wasn't changed.
- HIPAA: PHI access goes through `HIPAALogger`.
- Onboarding pages: `advance()`, never `navigate()`.
- Fully typed Python; Pydantic/dataclass for new classes.
- ASCII-only output.

### 3.4 Verify the outcome

- Re-read the edited file and confirm the change actually addresses the
  comment (not just compiles).
- For non-trivial changes, run the scoped check the reviewer implied:
  typecheck, the one test, `hk check` on changed files. Do not run the full
  test suite unless the comment explicitly asks.
- If verification fails, iterate on the fix. Do not proceed to step 3.5 with a
  broken change.

### 3.5 Post a resolution comment

- `review_thread`: reply on the thread via
  `gh api repos/teamclara/Clara_V1/pulls/{PR}/comments/{comment_id}/replies --method POST -f body="..."`
  so the reply is threaded.
- `review_body`: post a new PR-level comment via `gh pr comment {PR} --body
"..."` referencing the review author (e.g. `Re: @reviewer's review ({state})
  - ...`). Review summaries can't be replied to inline.
- `issue_comment`: same as review_body - new PR-level comment. A single PR
  comment addressing each concern is enough for bot summaries.
- `check_annotation`: no reply needed - the fix itself + a reference in the
  follow-up commit message is sufficient. If the failure was a flake, note
  that in the final report.

Keep the body to one or two sentences:

- ACCEPT + applied: what you changed and where (include commit SHA if pushed).
- ACCEPT + edited manually: same - what/where.
- REJECT: the reason, grounded in code or project rule (cite the skill /
  CLAUDE.md section when relevant).
- Already-addressed: point to the commit/line that addressed it.

### 3.6 Mark resolved

- `review_thread` + ACCEPT (applied, edited, or already-addressed): call
  `mcp__github_extensions__resolve_review_thread` with the `thread_node_id`
  (PRRT\_...).
- `review_thread` + REJECT: leave unresolved so the reviewer can close it
  after reading your reasoning.
- `review_body` with state = `CHANGES_REQUESTED`: if every concern raised is
  addressed, dismiss via
  `gh api repos/teamclara/Clara_V1/pulls/{PR}/reviews/{review_id}/dismissals --method PUT -f message="Addressed in {sha}; see reply above." -f event=DISMISS`.
  If any concern is rejected or pending, leave the review as-is.
- `review_body` with state = `APPROVED` / `COMMENTED`: nothing to resolve -
  the reply + reaction is the full response.
- `issue_comment` and `check_annotation`: no thread state - the reply (or the
  fix itself) is the full response.

Log one line per item as you go:

```text
[thread]  [ACCEPT + APPLIED + RESOLVED] path/to/file.py:42 - short summary
[thread]  [ACCEPT + EDITED + RESOLVED]  path/to/file.py:42 - short summary
[thread]  [REJECT + REPLIED]            path/to/file.py:42 - reason
[thread]  [STALE + REPLIED + RESOLVED]  path/to/file.py:42 - addressed in <sha>
[review]  [ACCEPT + EDITED + DISMISSED] CHANGES_REQUESTED by @alice - short summary
[review]  [REJECT + REPLIED]            COMMENTED by @bob - reason
[issue]   [REJECT + REPLIED]            @bot's CI summary - out of scope
[check]   [ACCEPT + EDITED]             Test Frontend run #123 - fixed selector
```

## Step 4: Commit and push code changes

After all items are processed, if any files changed:

- Invoke `commit-commands:commit-push-pr` (or `commit-commands:commit` if a PR
  already exists for the branch) to create a single focused commit like
  `chore(review): address PR #N feedback`.
- Push to the same branch.
- Add the new commit SHA into any reply that referenced "will fix in a
  follow-up commit" - edit via `mcp__github_extensions__edit_review_comment`.

## Step 5: Re-verify nothing is missed

Re-fetch all four sources. Any unresolved thread, un-dismissed
`CHANGES_REQUESTED` review, unanswered comment, or still-failing check that
isn't intentionally left open gets processed now.

## Step 6: Final report

```text
Address PR Comments - PR #N
────────────────────────────
  Items processed:        N
    - review threads:     N
    - review bodies:      N
    - issue comments:     N
    - check annotations:  N
  Accepted + applied:     N
  Accepted + edited:      N
  Rejected:               N
  Already addressed:      N
  Resolved on GitHub:     N (threads)
  Reviews dismissed:      N
  Left open:              N
────────────────────────────
Left open intentionally:
  - [thread] path/to/file.py:42 - reason
  - [review] CHANGES_REQUESTED by @alice - waiting on clarification
```

## Rules

- Every item gets a reaction (when reactable) and a written reply. Reactions
  alone are not a response.
- Resolve threads only after the fix is verified (or the comment was already
  addressed). Never resolve speculatively.
- Dismiss `CHANGES_REQUESTED` reviews only when every concern in the review
  body is addressed - partial fixes get a reply but not a dismissal.
- Never resolve a thread you rejected - that is the reviewer's call.
- Read the code before replying. The suggestion may already be stale.
- Don't apply suggestions blindly. Check they're correct before applying.
- Be concise in replies. One or two sentences max. Link to the commit if you
  made a change.
- Nitpicks are optional but must still be acknowledged.
- Invoke project skills (`hipaa`, `backend`, `frontend`, etc.) when the item
  touches their area.
- Stay scoped: address the item, nothing else. No opportunistic refactors.
