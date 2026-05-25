#!/usr/bin/env bash
# tmux-resurrect @resurrect-hook-post-save-all
#
# For every pane, if a claude session marker exists (written by
# tmux-claude-track.sh on Claude SessionStart) and the recorded cwd still
# matches, append a row to claude.tsv:
#
#   session\twindow\tpane\tcwd\tclaude_session_id
#
# claude-postrestore.sh consumes this after resurrect rebuilds the layout.
set -eu

state_root="${TMUX_SESSION_RESUME_STATE:-${XDG_CACHE_HOME:-$HOME/.cache}/tmux-session-resume}"
marker_dir="$state_root/panes"
tsv="$state_root/claude.tsv"
mkdir -p "$state_root"
: > "$tsv"

[ -d "$marker_dir" ] || exit 0

tmux list-panes -a -F '#{session_name}	#{window_index}	#{pane_index}	#{pane_current_path}	#{pane_current_command}' \
| while IFS=$'\t' read -r sname widx pidx cwd _cmd; do
    safe_key=$(printf '%s__%s__%s' "$sname" "$widx" "$pidx" | tr -c 'A-Za-z0-9_.-' '_')
    marker="$marker_dir/$safe_key"
    [ -f "$marker" ] || continue

    IFS=$'\t' read -r sid marker_cwd _ts < "$marker" || continue
    [ -n "$sid" ] || continue

    # Only resume if the pane is still in the dir where claude was last
    # tracked — if you cd'd away, the old session is probably not what you want.
    [ "$cwd" = "$marker_cwd" ] || continue

    printf '%s\t%s\t%s\t%s\t%s\n' "$sname" "$widx" "$pidx" "$cwd" "$sid" >> "$tsv"
done

exit 0
