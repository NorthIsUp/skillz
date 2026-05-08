---
name: user_profile
description: Adam's development environment, OS, and tooling preferences for tailoring assistance
type: user
---

Adam is a developer who uses Claude Code from his home directory (~) as a general-purpose assistant for system administration, tooling, and project work.

**System:**
- macOS Tahoe (26.x) on Apple Silicon (aarch64)
- Primary terminal: iTerm2
- Browser: Safari
- Editor: VS Code Insiders
- Dotfiles repo: ~/src/dotfiles (symlinked from ~)

**Tool management:**
- **mise** is the central tool manager — handles CLI tools, desktop apps (iTerm, Signal), fonts, and language runtimes
- Installs at ~/.local/share/mise/installs/, cache at ~/.cache/mise/
- Also uses mise for custom "zerobrew" packages (e.g., zb-htop)

**Networking/Infra:**
- Tailscale for networking
- Pulumi ESC interest for managing developer environment variables (with per-developer overrides via inheritance)
- Unifi networking gear

**Other:**
- Dropbox (symlinked at ~/Dropbox)
- context7 MCP server for library documentation lookups
