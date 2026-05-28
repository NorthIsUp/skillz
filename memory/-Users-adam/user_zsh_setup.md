---
name: user_zsh_setup
description: Adam's zsh shell configuration structure and key details for debugging shell issues
type: user
---

Adam has an elaborate custom zsh setup in his dotfiles repo (`~/src/dotfiles`).

**Shell config flow:**

- `~/.zshrc` sources `~/.local/bin/env` (just PATH setup)
- Real config lives at `$ZDOTDIR = ~/.config/zsh/` (set via `~/src/dotfiles/home/.zshenv`)
- `~/.config/zsh/zshenv` → sources `~/my/lib/zsh/zshenv.d/**/*.zsh`
- `~/.config/zsh/zprofile` → sources `~/my/lib/zsh/zprofile.d/**/*.zsh`
- `~/.config/zsh/zshrc` → sources `~/my/lib/zsh/zshrc.d/**/*.zsh`
- Custom functions autoloaded from `~/my/functions/` and `~/my/lib/zsh/functions/`

**Key components:**

- Plugin manager: **zinit** (cache at `~/.cache/zinit`)
- Prompt: **Starship** (config at `~/.config/starship.toml`), with elaborate multi-segment prompt including battery, git, kubernetes, custom flower emoji
- Hooks auto-discovered: functions named `zsh-hook-{hooktype}-*` are registered via `99-zsh-hooks.zsh`
- **mise** activated via precmd hook (only in CLAUDECODE sessions via `00-claude.zsh`)
- **direnv** available but disabled by default (must call `direnv-enable`)
- Agentic terminal detection (`IS_AGENTIC_TERM`) disables various interactive features for AI agent sessions
- Path management via `path-reset()` in `~/my/lib/zsh/zshenv.d/20-path.zsh`
- Dark/light detection via custom `dark-or-light` script using OSC 11 terminal queries
- iTerm2 shell integration loaded via zinit
