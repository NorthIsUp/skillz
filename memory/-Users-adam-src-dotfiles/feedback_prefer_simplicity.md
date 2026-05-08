---
name: Prefer simplicity over machinery
description: Choose the simplest direct solution over complex setup/cleanup patterns or abstractions
type: feedback
---

Choose the simplest direct solution. Remove unnecessary machinery.

**Why:** When given the choice between a file:// clone + setup/cleanup tasks vs. permanent symlinks for mise plugins, Adam explicitly said "Much simpler. Just symlink them permanently and remove all the setup/cleanup machinery." (2026-03-22)

**How to apply:** When proposing solutions, prefer the most direct approach. Don't add lifecycle management (setup/teardown, init/cleanup) when a one-time permanent operation works. If a simpler alternative exists, lead with it.
