#!/bin/bash
# Unstage any staged SKILL.md that is a symlink.
#
# Symlinked-in skills have a SKILL.md that points into ~/src/dotfiles on the
# author's machine — machine-specific, broken on any other clone. git has no
# type-based ignore (.gitignore matches by path, and real SKILL.md files share
# the same paths), and hk omits symlinks from its file lists — so we inspect
# the git index directly: mode 120000 is a symlink.
#
# Usage:
#   unstage-symlink-skills.sh            unstage symlinked SKILL.md files (autofix)
#   unstage-symlink-skills.sh --check    exit 1 if any are staged; touch nothing
set -euo pipefail

# Runs on every commit: one git call, filtered with builtins.
symlinks=()
while IFS=$'\t' read -r meta path; do
	[[ $meta == 120000\ * ]] && symlinks+=("$path")
done < <(git ls-files --stage -- '*/SKILL.md')

((${#symlinks[@]})) || exit 0

if [ "${1:-}" = "--check" ]; then
	echo "symlink SKILL.md staged — run 'hk fix' to unstage, then commit:" >&2
	printf '  %s\n' "${symlinks[@]}" >&2
	exit 1
fi

echo "unstaging symlinked SKILL.md (machine-specific, not committed):"
printf '  %s\n' "${symlinks[@]}"
git restore --staged -- "${symlinks[@]}"
