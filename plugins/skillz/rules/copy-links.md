---
description: Append pbcopy:// copy links to copyable snippets in terminal output
alwaysApply: true
---

# Copy-to-clipboard links in terminal output

When showing a snippet worth copying (command, path, token, URL,
multi-line blob), append a markdown copy link — after the inline code, or
on the line after a code block:

```text
[[󰆑copy](pbcopy://?t=<urlencoded-text>)]
```

(outer `[]` are literal text; label is the glyph + "copy", tight, no
space)

- URL-encode the payload (space → `%20`, `/` → `%2F`, `&` → `%26`,
  newline → `%0A`).
- Link text must be non-empty — never `[](url)`.
- Label glyphs: plane-15 nerdfont (md-\*, e.g. 󰆑 U+F0191) or emoji only.
  Never BMP PUA glyphs (U+E000–F8FF, e.g. U+F0EA) and never raw
  `\e]8;;` escapes — both come out broken.
- Variants: icon-only `[[󰆑](…)]`; snippet-as-label `[<snippet>](…)`
  (no outer brackets) for short commands.
- Skip for prose; stop for the session if the user says links render as
  noise.

Requires a `pbcopy://` URI handler (macOS). If links do nothing when
clicked, install one: `${CLAUDE_PLUGIN_ROOT}/bin/install-pbcopy-uri-handler`.
