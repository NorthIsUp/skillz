# skillz

Adam's personal Claude Code skills, agents, commands, and memory — packaged as
an installable plugin marketplace and auto-synced to git.

## Layout

```text
.claude-plugin/marketplace.json   # marketplace catalog
plugins/skillz/                   # the plugin (installable via /plugin install)
  .claude-plugin/plugin.json
  skills/                         # SKILL.md per skill
  agents/
  commands/
memory/                           # synced personal memory (not part of plugin)
scripts/                          # validate + auto-push helpers
mise.toml                         # tool versions + tasks
hk.pkl                            # lint pipeline
```

## Install as a Claude Code plugin

From any Claude Code session:

```text
/plugin marketplace add askclara/skillz       # once GitHub remote is set
/plugin install skillz@askclara-skillz
```

For local dev:

```text
/plugin marketplace add /Users/adam/src/skillz
/plugin install skillz@askclara-skillz
```

## Day-to-day

```sh
mise install              # install hk, lychee, prettier, typos, etc.
mise run lint             # run all linters
mise run fix              # auto-fix what can be fixed
mise run validate-skills  # check SKILL.md frontmatter + manifest JSON
hk install                # set up the pre-commit hook (one-time)
```

## Auto-push watcher

`mise run watch-and-push` watches `plugins/`, `memory/`, and `.claude-plugin/`
and commits + pushes on any change (5 s debounce).

To run it as a launchd background service on macOS, drop this into
`~/Library/LaunchAgents/com.askclara.skillz-autopush.plist` and `launchctl load` it:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.askclara.skillz-autopush</string>
  <key>WorkingDirectory</key><string>/Users/adam/src/skillz</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/adam/.local/bin/mise</string>
    <string>run</string>
    <string>watch-and-push</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/skillz-autopush.log</string>
  <key>StandardErrorPath</key><string>/tmp/skillz-autopush.log</string>
</dict></plist>
```

## Lint pipeline (hk)

| Linter                    | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `markdown_lint`           | Markdown structure (headings, lists, code blocks)           |
| `prettier`                | Format markdown tables + JSON/YAML                          |
| `lychee`                  | Validate every URL + relative link + anchor in markdown     |
| `typos`                   | Catch typos in skill names + descriptions                   |
| `detect_private_key`      | Block accidentally-committed private keys                   |
| `check_added_large_files` | Block oversized files (defaults to 500 KB)                  |
| `actionlint`              | Lint our own GitHub Actions workflow                        |
| `validate-skills`         | SKILL.md frontmatter + plugin.json / marketplace.json shape |

The same `hk check` runs locally (pre-commit) and in CI (`.github/workflows/lint.yml`).

## Memory

`memory/` is intended as the canonical store for the auto-memory system. To use
it as the project memory dir for _this_ repo, symlink it:

```sh
ln -sfn /Users/adam/src/skillz/memory \
  /Users/adam/.claude/projects/-Users-adam-src-skillz/memory
```
