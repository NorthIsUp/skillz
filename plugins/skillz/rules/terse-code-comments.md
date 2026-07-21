---
description: Code comments — only the non-obvious why
alwaysApply: true
---

# Terse code comments

One comment = only the non-obvious **why**. Cut anything the code already
says, cut the teaching tone, prefer one line, and if necessary reference docs
or code for the full story.

- **Cut what the code says.** The reader can see `conclusion: [success]` or the
  arg names — don't restate them. Comment the reason they can't see.
- **Cut the teaching tone.** No numbered CAPS headers, no "Side effect that
  matters:", no re-explaining a mechanism a linked file already covers.
- **Shortest form that says the whole why.** Don't pad to a block, but don't
  truncate the why to fit one line either — length follows the reason, not a
  quota. A one-liner is the win when it's genuinely complete.
- **Point, don't paste.** For the long story, link the doc or the code
  (`see pr-babysit.md`) instead of inlining it.

This governs `#`/`//` comments in code. It's the code-comment counterpart to
`short-comments` (which governs chat / PR / commit prose).
