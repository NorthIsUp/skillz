#!/usr/bin/env bash
# tmux-session-resume installer.
#
# - Locates the user's tmux config (~/.tmux.conf or ~/.config/tmux/tmux.conf).
# - Clones tmux-resurrect and tmux-continuum under ~/.config/tmux/plugins/
#   if not already present (other locations are also auto-detected).
# - Inserts (or refreshes) a managed block between
#       # >>> tmux-session-resume >>>
#       # <<< tmux-session-resume <<<
#   in the tmux config. Content outside the markers is preserved.
#
# Usage:
#   ./install.sh                  install / refresh
#   ./install.sh --uninstall      remove the managed block
#   ./install.sh --print          print the block to stdout (don't touch files)
#   ./install.sh --conf PATH      target a specific tmux config file
#
set -eu

BEGIN_MARKER='# >>> tmux-session-resume >>>'
END_MARKER='# <<< tmux-session-resume <<<'

plugin_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
template="$plugin_root/tmux/tmux-session-resume.conf"

action=install
conf=""
while [ $# -gt 0 ]; do
    case "$1" in
        --uninstall) action=uninstall ;;
        --print)     action=print ;;
        --conf)      conf="${2:-}"; shift ;;
        -h|--help)   sed -n '2,/^$/p' "$0"; exit 0 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
    shift
done

# ---- locate user tmux.conf --------------------------------------------------
if [ -z "$conf" ]; then
    if [ -f "$HOME/.config/tmux/tmux.conf" ]; then
        conf="$HOME/.config/tmux/tmux.conf"
    elif [ -f "$HOME/.tmux.conf" ]; then
        conf="$HOME/.tmux.conf"
    else
        conf="$HOME/.config/tmux/tmux.conf"
        mkdir -p "$(dirname "$conf")"
        touch "$conf"
        echo "[tmux-session-resume] created $conf"
    fi
fi

# ---- locate / install resurrect + continuum ---------------------------------
find_plugin() {
    local name="$1"
    for cand in \
        "$HOME/.config/tmux/plugins/$name" \
        "$HOME/.tmux/plugins/$name" \
        "$HOME/.local/share/tmux/plugins/$name"
    do
        [ -d "$cand" ] && { echo "$cand"; return 0; }
    done
    return 1
}

ensure_plugin() {
    local name="$1" repo="$2" dir
    if dir=$(find_plugin "$name"); then
        echo "$dir"
        return 0
    fi
    dir="$HOME/.config/tmux/plugins/$name"
    mkdir -p "$(dirname "$dir")"
    echo "[tmux-session-resume] cloning $name → $dir" >&2
    git clone --depth 1 "$repo" "$dir" >/dev/null 2>&1
    echo "$dir"
}

# ---- build the managed block -----------------------------------------------
render_block() {
    local resurrect_dir continuum_dir
    resurrect_dir=$(ensure_plugin tmux-resurrect https://github.com/tmux-plugins/tmux-resurrect)
    continuum_dir=$(ensure_plugin tmux-continuum https://github.com/tmux-plugins/tmux-continuum)

    printf '%s\n' "$BEGIN_MARKER"
    printf '# Managed by tmux-session-resume — do not edit between markers.\n'
    printf '# Plugin root: %s\n' "$plugin_root"
    sed \
        -e "s|__PLUGIN_ROOT__|$plugin_root|g" \
        -e "s|__RESURRECT_DIR__|$resurrect_dir|g" \
        -e "s|__CONTINUUM_DIR__|$continuum_dir|g" \
        "$template"
    printf '%s\n' "$END_MARKER"
}

# ---- splice block into conf -------------------------------------------------
splice() {
    local mode="$1"
    local stripped block_file out
    stripped=$(mktemp)
    block_file=$(mktemp)
    out=$(mktemp)
    trap 'rm -f -- "${stripped:-}" "${block_file:-}" "${out:-}"' EXIT

    local had_block=0
    if grep -qF "$BEGIN_MARKER" "$conf" 2>/dev/null; then
        had_block=1
        awk -v B="$BEGIN_MARKER" -v E="$END_MARKER" '
            $0 == B { skip=1; next }
            $0 == E { skip=0; next }
            !skip   { print }
        ' "$conf" > "$stripped"
        # Trim one trailing blank line left by the previous block, if any.
        awk 'BEGIN{n=0} {a[n++]=$0} END{ while (n>0 && a[n-1]=="") n--; for (i=0;i<n;i++) print a[i] }' "$stripped" > "$out"
        mv "$out" "$stripped"; out=$(mktemp)
    else
        cat "$conf" > "$stripped"
    fi

    if [ "$mode" = "install" ]; then
        render_block > "$block_file"
        { cat "$stripped"; printf '\n'; cat "$block_file"; } > "$out"
        mv "$out" "$conf"; out=$(mktemp)
        echo "[tmux-session-resume] $( [ "$had_block" = 1 ] && echo refreshed || echo installed ) block in $conf"
        echo "[tmux-session-resume] reload with: tmux source-file \"$conf\""
    else  # uninstall
        mv "$stripped" "$conf"; stripped=$(mktemp)
        if [ "$had_block" = "1" ]; then
            echo "[tmux-session-resume] removed block from $conf"
        else
            echo "[tmux-session-resume] no block found in $conf"
        fi
    fi
}

case "$action" in
    install)   splice install ;;
    uninstall) splice uninstall ;;
    print)     render_block ;;
esac
