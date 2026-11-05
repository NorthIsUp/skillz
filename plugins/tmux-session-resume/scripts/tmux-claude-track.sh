#!/bin/bash
# Claude SessionStart hook: record this claude session id against the tmux pane
# it is running in, so tmux-resurrect can resume it via `claude --resume <id>`
# after a tmux server restart.
#
# Stdin: Claude hook JSON (uses .session_id).
set -eu

[ -n "${TMUX:-}" ] || exit 0
[ -n "${TMUX_PANE:-}" ] || exit 0

IFS= read -rd '' input || true
[[ $input =~ \"session_id\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]] || exit 0
session_id=${BASH_REMATCH[1]}

dir="${TMUX_SESSION_RESUME_STATE:-${XDG_CACHE_HOME:-$HOME/.cache}/tmux-session-resume}/panes"
[ -d "$dir" ] || mkdir -p "$dir"

# Key by tmux session-name + window/pane indices (stable across resurrect save
# /restore, unlike %id which is reassigned on tmux server restart). One tmux
# call for both the key and the cwd.
IFS=$'\t' read -r key cwd < <(tmux display-message -t "$TMUX_PANE" -p '#{session_name}__#{window_index}__#{pane_index}	#{pane_current_path}' 2>/dev/null) || exit 0
[ -n "$key" ] || exit 0

printf '%s\t%s\t%s\n' "$session_id" "${cwd:-$PWD}" "$(date +%s)" >"$dir/${key//[^A-Za-z0-9_.-]/_}"
