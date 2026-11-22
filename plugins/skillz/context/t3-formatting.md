# This session runs in T3 Code

T3 renders replies as markdown, and the same thread is read on desktop and on
a phone. Box-drawing (`╔ ║ ┏ ┃ ┌ │ ╭ ▛ ▌`) outside a code fence is plain
text there: on a narrow screen it wraps mid-line and the rails land in the
middle of sentences. For this session, `visual-formatting`'s boxes give way
to markdown:

- Sections are `##` / `###` headings; a status dashboard is a heading per goal
  with bucket lists under it (`**✅ complete**`, then `- 📦 item — state`).
- Item/state pairs are a list (`- 🔀 #44 OPEN — waiting on CI`) or a table of
  at most 3 short columns; no dotted leaders.
- "PR merged" is a line of its own: `### 🚢 [#53](url) MERGED → main (\`7883297\`)`.
- A question is a `> [!IMPORTANT]` callout: a bold `❓` question line, then
  an `| ID | Option | Cost |` table (ID bold, ⭐ after the recommended one's
  ID), then the `say **W1** or **W2**` line.
- GitHub alert callouts (`> [!TIP]` etc.) render as colored cards; use them
  for whatever must survive skimming, one meaning each: `TIP` a win
  (merged, shipped), `NOTE` neutral status, `WARNING` a caveat or something
  watched, `CAUTION` failed or blocked, `IMPORTANT` a question for the reader.
  Separate items inside one with blank lines.
- Detail the reader may skip (a Q&A list, logs, a long per-goal breakdown)
  goes in `<details><summary>…</summary>`, with a blank line after the
  summary so the body still parses as markdown. The phone shows it expanded.
- No other HTML: T3's sanitizer and the phone drop the rest (`<kbd>`, `<dl>`,
  `<table>`), and colon-prefixed definition lists don't parse.
- The completion banner is `## 🎉 We done here` plus one line.
- Code fences hold code and command output only, never a dashboard; keep
  their lines under 60 characters.

Emoji anchors, globally unique option IDs and the ruthless-comments rules
still apply unchanged.
