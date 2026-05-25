#!/usr/bin/env bash
# Claude SessionStart hook: ensure the tmux managed block is installed and
# points at this plugin root. Cheap no-op when already up to date.
set -eu

plugin_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

# Find the user's tmux.conf the same way install.sh does.
for cand in "$HOME/.config/tmux/tmux.conf" "$HOME/.tmux.conf"; do
    [ -f "$cand" ] && { conf="$cand"; break; }
done
conf="${conf:-}"

# Fast path: block already references this plugin_root → nothing to do.
if [ -n "$conf" ] && grep -qF "# Plugin root: $plugin_root" "$conf" 2>/dev/null; then
    exit 0
fi

# Otherwise (missing, stale, or relocated plugin) install/refresh. Run in
# background so SessionStart isn't blocked by a possible resurrect/continuum
# git clone on first install.
nohup bash "$plugin_root/install.sh" >/dev/null 2>&1 &
exit 0
