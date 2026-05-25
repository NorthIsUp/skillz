#!/usr/bin/env bash
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

symlinks=$(git ls-files --stage | grep '^120000 ' | cut -f2 | grep '/SKILL\.md$' || true)

[ -z "$symlinks" ] && exit 0

if [ "${1:-}" = "--check" ]; then
	echo "symlink SKILL.md staged — run 'hk fix' to unstage, then commit:" >&2
	echo "$symlinks" | sed 's/^/  /' >&2
	exit 1
fi

echo "unstaging symlinked SKILL.md (machine-specific, not committed):"
echo "$symlinks" | sed 's/^/  /'
echo "$symlinks" | tr '\n' '\0' | xargs -0 git restore --staged --
