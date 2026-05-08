---
name: Minimal diff when adding types
description: When a lint requires only a signature change, don't rewrite the body too
type: feedback
originSessionId: f5a94eb5-9ea9-447f-b06f-e025b9baa64a
---
When a lint or type-checker requires a change (e.g. adding parameter/return type annotations), make ONLY that change. Don't rewrite working bodies into "more explicit" forms while you're there.

**Why:** I added `obj: JunctionPatient -> str` to satisfy pyright-diff and also expanded `return obj.user.email if obj.user else "-"` into a 3-line `if obj.user is None: return "-"; return obj.user.email or "-"`. Adam called it out: the body change wasn't required, made the code worse, and the `or "-"` even silently changed behavior (empty string -> "-"). Minimal diff is the right diff.

**How to apply:** When fixing a lint error, identify the exact thing the linter wants and change only that. Inline ternaries, comprehensions, and one-liners are usually the right form - don't expand them into verbose blocks just because you're touching the file. Also added to CLAUDE.md as a Python best practice.
