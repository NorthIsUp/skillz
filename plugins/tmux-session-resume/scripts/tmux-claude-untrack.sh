#!/usr/bin/env bash
# Claude SessionEnd hook: remove the tmux-pane → claude-session marker so a
# crashed/closed session isn't resurrected.
set -eu

[ -n "${TMUX:-}" ] || exit 0
[ -n "${TMUX_PANE:-}" ] || exit 0

dir="${TMUX_SESSION_RESUME_STATE:-${XDG_CACHE_HOME:-$HOME/.cache}/tmux-session-resume}/panes"

key=$(tmux display-message -t "$TMUX_PANE" -p '#{session_name}__#{window_index}__#{pane_index}' 2>/dev/null) || exit 0
[ -n "$key" ] || exit 0
safe_key=$(printf '%s' "$key" | tr -c 'A-Za-z0-9_.-' '_')

rm -f "$dir/$safe_key"
