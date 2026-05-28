---
name: Use plain ASCII dashes
description: Always use plain `-` instead of en-dash `–` / em-dash `—` in prose, code, changelogs, and commit messages
type: feedback
originSessionId: 5d5a77c2-4ab2-455d-8eec-55de56d2eec6
---

Use a plain ASCII hyphen `-` in all written output (prose, comments, changelogs, commit messages, PR descriptions, etc). Never use en-dash or em-dash.

**Why:** The user finds unicode dashes visually jarring in monospace terminal output, and they complicate grepping/copying. Plain hyphens render consistently everywhere.

**How to apply:** The only exception is when the unicode char is the literal subject (e.g. a regex/test/example that targets the unicode dash, or documenting a character). For everything else (ranges like `0.5.11-0.5.15`, pause/separator substitutes, section separators), use `-`.
