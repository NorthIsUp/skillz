# cc-statusline

A mod that draws [cc-statusline](https://github.com/NorthIsUp/cc-statusline)
as a band above the prompt. A `statusLine` command gets its input from
Claude Code on stdin. This mod builds that same JSON from the session
instead (`$.session`, plus the transcript path and effort that classic
hook events carry), runs the binary every 2s, and turns its ANSI colors
and OSC 8 links into `Text` and `Link` elements, because a mod's `Text`
does not accept escape codes.

## Install

Needs `cc-statusline` on `PATH`.

```text
/plugin install cc-statusline@northisup-skillz
```

Then remove `statusLine` from `~/.claude/settings.json`, or both will draw.

## Gaps

- `fast_mode` and `output_style` are not sent, so those parts of the line stay empty.
- PR chips need the transcript path. They appear after the first classic hook
  event, a moment after the session starts.

## Develop

```text
claude plugin validate plugins/cc-statusline
claude plugin test plugins/cc-statusline
```
