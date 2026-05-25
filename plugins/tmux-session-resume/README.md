# tmux-session-resume

A Claude Code plugin that saves your tmux session and **resumes Claude Code
per-pane** on restart.

After a reboot (or `tmux kill-server`), every window/pane is restored to its
prior **cwd**, and any pane that was running `claude` is automatically
relaunched with `claude --resume <session_id>` — the _same_ session it had
before, even when multiple panes in the same directory had different
sessions.

## How it works

1. **Tmux side** — [tmux-resurrect][resurrect] + [tmux-continuum][continuum]
   handle layout, cwd, and pane-content save/restore.
2. **Claude side** — this plugin adds `SessionStart` and `SessionEnd` hooks
   that write a marker file per tmux pane:
   `~/.cache/tmux-session-resume/panes/<session>__<window>__<pane>`
   containing the Claude `session_id`, the cwd, and a timestamp.
3. On resurrect's `post-save-all`, `claude-presave.sh` walks every pane and
   records `(session, window, pane, cwd, session_id)` rows for any pane with
   a live marker whose recorded cwd still matches.
4. On resurrect's `post-restore-all`, `claude-postrestore.sh` reads those rows
   and sends `claude --resume <id>` into each pane (cwd is already correct
   from resurrect).

Keying by tmux pane location (not cwd) means multiple panes can have
different Claude sessions in the same directory and each one resumes its own.

[resurrect]: https://github.com/tmux-plugins/tmux-resurrect
[continuum]: https://github.com/tmux-plugins/tmux-continuum

## Install

After enabling the plugin in Claude Code, run:

```text
/tmux-session-resume-install
```

That will:

- detect `~/.config/tmux/plugins/tmux-resurrect` and `tmux-continuum`
  (also checks `~/.tmux/plugins/` and `~/.local/share/tmux/plugins/`), and
  clone them under `~/.config/tmux/plugins/` if missing — no TPM needed;
- splice a managed block into `~/.config/tmux/tmux.conf` (or `~/.tmux.conf`)
  between markers:

  ```text
  # >>> tmux-session-resume >>>
  ...
  # <<< tmux-session-resume <<<
  ```

  Re-running the command refreshes the block in place. Anything outside the
  markers is untouched.

Reload tmux:

```sh
tmux source-file ~/.config/tmux/tmux.conf
```

## Uninstall

```text
/tmux-session-resume-install --uninstall
```

(or run `bash ${CLAUDE_PLUGIN_ROOT}/install.sh --uninstall` directly).
The cloned resurrect/continuum plugins are left in place — remove them
manually if you want to.

## Files

| Path                             | Role                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| `hooks/hooks.json`               | Registers `SessionStart` / `SessionEnd` hooks.                             |
| `scripts/tmux-claude-track.sh`   | `SessionStart`: write marker for this pane.                                |
| `scripts/tmux-claude-untrack.sh` | `SessionEnd`: delete the marker.                                           |
| `scripts/claude-presave.sh`      | resurrect `post-save-all`: snapshot live markers → `claude.tsv`.           |
| `scripts/claude-postrestore.sh`  | resurrect `post-restore-all`: `send-keys "claude --resume <id>"` per pane. |
| `tmux/tmux-session-resume.conf`  | Template for the managed block (placeholders substituted by `install.sh`). |
| `install.sh`                     | Idempotent installer/uninstaller.                                          |

## State

- Per-pane markers: `~/.cache/tmux-session-resume/panes/`
- Snapshot for restore: `~/.cache/tmux-session-resume/claude.tsv`
- Override location with `$TMUX_SESSION_RESUME_STATE`.
- resurrect state: `~/.local/state/tmux-resurrect/`

## Caveats

- The `Stop`/`SessionStart` flow assumes the Claude binary is `claude` on
  PATH; `claude-postrestore.sh` falls back to a few common install locations.
- If you `cd` away from the project before tmux saves, the resume is skipped
  intentionally — old session in wrong dir is rarely what you want.
- Plugin processes are deliberately excluded from `@resurrect-processes` so
  resurrect doesn't blindly relaunch `claude`/`node` without the resume id.
