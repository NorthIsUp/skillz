---
name: Verify Before Asking for Input
description: Before asking the user to perform a manual step (auth, login, file edit, password entry), verify the prerequisite isn't already satisfied — check existing credential files, session state, running processes, config files, or run a non-destructive sanity command first
type: feedback
originSessionId: ce439413-66b1-45e1-9602-b82eb347dd49
---

Before asking the user to do a manual step, **verify the prerequisite isn't already satisfied**.

**Why:** Concrete incident — I was about to make the user run an interactive `claude` OAuth flow on a Pi, told them "I can't do this for you, run it yourself in iTerm2", and laid out instructions. They asked "did you test the anthropic login already?" → I checked and Claude Code was already authenticated on the box (`~/.claude/.credentials.json` existed, `claude -p "hi"` returned a valid response). The whole human-in-the-loop ask was unnecessary. The user explicitly said: "always verify before asking for input, e.g. asking for auth? check that the correct user isn't already logged in".

**How to apply:**

- Auth/login asks → check for credential files (`~/.claude/.credentials.json`, `~/.config/*/credentials*`, keychain entries, `gh auth status`, `aws sts get-caller-identity`, `gcloud auth list`, etc.) AND run a minimal non-destructive call (`claude -p "hi"`, `gh api user`, `aws sts ...`) before asking for hands-on auth.
- Password/sudo asks → run `sudo -n true` first to see if NOPASSWD is already configured.
- "Install X" asks → check `which X`, `dpkg -l | grep X`, package manager state first.
- "Edit this file" asks → read it; the value may already be set.
- "Run this on your machine" → check whether it's actually still required given current state.

The pattern: every "I need you to do X" should be preceded by "I verified X is not already done." Connects to the existing "verify commands first" memory but extends it: don't just verify command syntax, verify the _premise_ of the ask.
