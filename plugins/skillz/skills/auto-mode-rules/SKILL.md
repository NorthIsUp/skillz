---
name: auto-mode-rules
description: |
  Operating rules for auto-mode sessions. Loads the user's standing
  instructions for autonomous work: how to follow up on PRs (watch CI →
  address comments → rebase → merge), pre-push hygiene (test locally,
  run hk / pre-commit), continuing on plans / logical follow-ups,
  cleanup after main work, taking a step back after a ship, unblocking
  forward motion, recording compromises in TODO.md, and consulting
  TODO.md for adjacent cleanup.

  Use whenever auto mode is active — including when an `Auto mode still
  active` system reminder appears, when the user invokes /auto, or when
  the user gives instructions like "decide and act", "keep going",
  "max work before checking in", or similar autonomy signals.

  Re-invoke at the start of any new turn where auto mode is still active
  if more than ~10 turns have passed since the last invocation, so the
  rules stay loaded in working context.
---

# Auto Mode Rules

These are the user's standing instructions for autonomous work. They override Claude's default conservative defaults in auto mode. They do **not** override explicit user instructions in the current conversation.

## The rules

1. **Always follow up on every PR.** Don't open a PR and walk away. Schedule the follow-up chain: watch CI to terminal state → address review comments → rebase if the base moved → merge (or hand off cleanly to the user). A PR isn't shipped until it lands.

2. **Always test locally first when possible.** Before pushing, run the actual test command for what changed (`mise run test:<area>`, `pytest <path>`, `npm test`, etc.). Don't rely on CI to find what a 30-second local run would catch.

3. **Always run lints + formatters before pushing.** Prefer the project's own tooling (`hk check --pr`, `hk fix`, `pre-commit run --all-files`, `mise run lint --fix`). If neither is wired up, fall back to whatever the repo uses (`ruff`, `eslint`, `prettier`, `gofmt`). Never push known-failing lints.

4. **Always continue with the plan if there's more plan, or a logical follow-up.** Finishing one task doesn't mean stopping. If the plan has more steps, or the work just done has an obvious next step (verify the deploy, update docs that just went stale, open the cleanup PR for the flag that was just toggled), keep going. Stop only when the work is genuinely done or the next step needs human input.

5. **Always clean up if there's time after the main implementation.** Stale comments, dead code from the refactor, debug prints, TODO comments that the work just resolved, half-finished branches that succeeded but weren't merged — sweep them. Don't leave the workspace messier than you found it.

6. **Always take a step back after a feature or PR ships.** Re-read the broader context: what does the codebase look like now? What got more brittle? What got easier? Did this change suggest an adjacent improvement? Surface the observation; don't just move on like nothing changed.

7. **Always try to unblock and move forward.** When something blocks (a permission denial, a flaky test, a missing piece of context, a confused subagent), try to find a path around. Ask, retry with different inputs, dispatch a different agent, work on a parallel task while the blocker is investigated. Stuck silence is the failure mode to avoid.

8. **Always note short-term compromises in `TODO.md`.** When a workaround, hack, hardcoded value, skipped test, or "fix this properly later" lands, append a dated entry to `TODO.md` at the repo root (create it if missing). Format:

   ```markdown
   ## YYYY-MM-DD — <short title>

   - **Where:** path/to/file.ext:line
   - **What:** one sentence describing the compromise
   - **Why:** the constraint that forced it (deadline, blocked dependency, scope cut)
   - **Fix:** what "doing it properly" would look like
   ```

   This is the bookkeeping that prevents shortcuts from compounding silently.

9. **Always look at `TODO.md` before starting closely-related work.** When the current task is in the same area as something in `TODO.md`, fold the cleanup in if it's cheap (and remove the TODO entry on the way out). Don't pile new compromises on top of unaddressed old ones in the same file.

## How these rules interact

- **Rule 1 ≫ Rule 4.** Don't start the next plan task while a PR you opened is still drifting unattended. Land it (or queue auto-merge with verification) first.
- **Rules 2 + 3 are pre-push gates.** Both must pass before `git push`. They're not optional steps to retry after CI fails.
- **Rule 8 has teeth only if Rule 9 fires.** Writing TODO.md entries no one reads is theater. Always check it when entering a related area.
- **Rule 6 is reflective, not bureaucratic.** One or two sentences of "what changed about the system" — not a doc, not a meeting. Surface it in the chat reply after the PR lands.

## What auto mode does NOT change

- **Destructive actions still need explicit consent.** `rm -rf`, force-push to main, `pulumi destroy`, `kubectl delete` of shared resources, anything visible to other people (Slack messages, public PR comments on others' work). Auto mode is autonomy on routine forks, not a license to break things.
- **Spec compliance still matters.** Don't expand scope to "fix everything you see" — record it in TODO.md (Rule 8) and stay focused on the requested change.
- **User course corrections always win.** If the user redirects, drop the rule-driven inertia and follow the new direction.
