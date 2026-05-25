#!/usr/bin/env bash
# tmux-resurrect @resurrect-hook-post-restore-all
#
# Reads claude.tsv (from claude-presave.sh) and sends `claude --resume <id>`
# to each pane. Resurrect has already restored cwd, so claude launches in the
# right project dir.
set -eu

state_root="${TMUX_SESSION_RESUME_STATE:-${XDG_CACHE_HOME:-$HOME/.cache}/tmux-session-resume}"
tsv="$state_root/claude.tsv"
[ -f "$tsv" ] || exit 0

claude_bin=$(command -v claude 2>/dev/null || true)
if [ -z "$claude_bin" ]; then
    for p in "$HOME/.local/bin/claude" "$HOME/.claude/local/claude" "/usr/local/bin/claude"; do
        [ -x "$p" ] && { claude_bin=$p; break; }
    done
fi
[ -n "$claude_bin" ] || claude_bin=claude   # fall back to pane's interactive PATH

while IFS=$'\t' read -r sname widx pidx _cwd sid; do
    [ -n "$sid" ] || continue
    target="${sname}:${widx}.${pidx}"
    tmux display-message -t "$target" -p '' >/dev/null 2>&1 || continue

    # If pane already has claude (e.g. continuum double-restore), skip.
    cur=$(tmux display-message -t "$target" -p '#{pane_current_command}' 2>/dev/null || true)
    case "$cur" in
        claude|*claude*) continue ;;
    esac

    tmux send-keys -t "$target" "$claude_bin --resume $sid" Enter
done < "$tsv"
