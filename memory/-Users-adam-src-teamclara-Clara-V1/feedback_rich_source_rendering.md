---
name: Rendering source code with Rich - alignment and escaping rules
description: Pitfalls when using Rich to render source code diagnostics (phi-scan / bandit style)
type: feedback
---

When rendering source code lines with Rich (rust-style diagnostics):

**Why:** Multiple corrections needed during bandit diagnostic work to get alignment and coloring right.

**How to apply:**

1. **Always use `highlight=False`** on lines containing source code - Rich auto-highlights Python syntax (strings green, function names magenta) which conflicts with intentional severity coloring.

2. **Always `escape()` source text** before embedding in Rich markup strings - source code may contain `[`, `]`, or `\` which Rich interprets as markup.

3. **Read the source file directly** for line content (`_read_line()`). Never trust bandit's `code` field for column alignment - it prefixes lines with line numbers and the split loses indentation.

4. **Adjust col_offset for stripped indent:** `col = col_offset - indent` where `indent = len(raw_line) - len(raw_line.lstrip())`. This matches phi-scan's approach.

5. **Pointer at col start, not midpoint.** `▲` should be at `col` (start of highlight). Centering (`col + span // 2`) drifts badly when spans are wide (bandit spans whole expressions).

6. **Multi-line spans:** `end_col_offset < col_offset` signals multi-line. Highlight first line to EOL. Continuation lines strip only first-line's indent to preserve relative indentation.
