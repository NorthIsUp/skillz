---
description: Install or refresh tmux-session-resume in the user's tmux config
---

Run the bundled installer and report what it did.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/install.sh" $ARGUMENTS
```

After it finishes, if a tmux server is running, suggest reloading the config:

```sh
tmux source-file ~/.config/tmux/tmux.conf
```

Flags accepted by the installer:

- `--uninstall` — remove the managed block
- `--print` — dump the block to stdout without modifying anything
- `--conf PATH` — target a specific tmux config file
