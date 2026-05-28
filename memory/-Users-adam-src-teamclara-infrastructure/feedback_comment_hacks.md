---
name: Comment all hacks with the why
description: Any workaround / hack / non-obvious choice gets an inline comment explaining why it's needed and what would happen if removed
type: feedback
originSessionId: d1a35c46-7463-457f-b818-902ae7688a85
---

When writing a workaround, hack, or non-obvious decision, **always leave an inline comment** explaining:

1. **What's broken upstream** that forces this code to exist (specific tool/version/behavior)
2. **What the symptom is** if the hack is missing (the exact error, ideally)
3. **Why this fix works** (the property of the fix that sidesteps the upstream issue)

**Why:** Future-me (or someone else) will look at the line, not understand it, and either delete it or duplicate it elsewhere. The comment lets them judge whether the hack is still needed when the upstream changes.

**How to apply:**

- Symlink, sudo step, awkward env var, weird path, retry loop, sleep, version pin, hardcoded magic value → comment.
- Bug-workaround link or upstream issue # if there is one.
- Match the comment density to the surprise level: a one-line obvious config gets no comment; a 6-line shell hack gets a 6-line comment.
- Don't fall back to terse "// hack" — that defeats the point.

**Counter-examples (don't comment):**

- Standard idioms (a `for` loop, an `if not None` check)
- Things any reader of the surrounding code already understands
- "WHAT" comments that just paraphrase the line.
