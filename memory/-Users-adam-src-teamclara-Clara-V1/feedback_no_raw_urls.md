---
name: Don't output raw URLs
description: URLs get wrapped in terminal output and break - use `open` command or other methods instead
type: feedback
---

Never output raw URLs in conversation text — they get wrapped by the terminal and become unclickable/broken.

**Why:** Terminal line wrapping breaks long URLs, making them unusable.

**How to apply:** When you need the user to open a URL, use `open "URL"` via Bash tool (on macOS) instead of printing it. Ask before running if it's unexpected.
