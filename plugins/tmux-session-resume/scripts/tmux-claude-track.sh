#!/usr/bin/env bash
# Claude SessionStart hook: record this claude session id against the tmux pane
# it is running in, so tmux-resurrect can resume it via `claude --resume <id>`
# after a tmux server restart.
#
# Stdin: Claude hook JSON (uses .session_id).
set -eu

[ -n "${TMUX:-}" ] || exit 0
[ -n "${TMUX_PANE:-}" ] || exit 0

dir="${TMUX_SESSION_RESUME_STATE:-${XDG_CACHE_HOME:-$HOME/.cache}/tmux-session-resume}/panes"
mkdir -p "$dir"

# Key by tmux session-name + window/pane indices (stable across resurrect save
# /restore, unlike %id which is reassigned on tmux server restart).
key=$(tmux display-message -t "$TMUX_PANE" -p '#{session_name}__#{window_index}__#{pane_index}' 2>/dev/null) || exit 0
[ -n "$key" ] || exit 0
safe_key=$(printf '%s' "$key" | tr -c 'A-Za-z0-9_.-' '_')

session_id=$(jq -r '.session_id // empty' 2>/dev/null) || exit 0
[ -n "$session_id" ] || exit 0

cwd=$(tmux display-message -t "$TMUX_PANE" -p '#{pane_current_path}' 2>/dev/null || pwd)

printf '%s\t%s\t%s\n' "$session_id" "$cwd" "$(date +%s)" > "$dir/$safe_key"
