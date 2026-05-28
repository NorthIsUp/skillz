---
name: Claude Code statusline quirks
description: Gotchas for ~/my/bin/cc-statusline — harness strips trailing whitespace, so right-align needs a leading sentinel char
type: project
originSessionId: 251d4c70-44fc-4dab-add0-c3f5c8732c21
---

Claude Code's statusline renderer strips trailing whitespace from the line it prints. Any right-alignment scheme that relies on padding with trailing spaces AFTER the content will collapse and stick the content to the left edge.

**Why:** Verified 2026-04-23 — padded output rendered flush-left until a leading `·` sentinel was added; then the pad survived and the right segment appeared on the right.

**How to apply:** When right-aligning in `~/my/bin/cc-statusline` (or any CC statusline), put a character at column 0 (we use a dim `·`) and pad BETWEEN that character and the right-aligned content. Never rely on trailing space padding alone.

Also: terminal width is not in the statusline JSON input. Detection priority that works: `stty size </dev/tty` (returns correct width even without a controlling TTY), then `tput cols </dev/tty` (often wrong — returned 80 when real was 180), then `$COLUMNS`, then fallback 120. JSON keys tried and not present: `.terminal.width`, `.terminal.columns`, `.window.columns`, `.cols`.
