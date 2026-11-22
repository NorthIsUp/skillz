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
- A question is a `### ❓` heading, one option per list line with its ID
  first (`- **W1** ⭐ …`), then the `say **W1** or **W2**` line.
- The completion banner is `## 🎉 We done here` plus one line.
- Code fences hold code and command output only, never a dashboard; keep
  their lines under 60 characters.

Emoji anchors, globally unique option IDs and the ruthless-comments rules
still apply unchanged.
