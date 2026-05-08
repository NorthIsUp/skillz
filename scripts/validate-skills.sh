#!/usr/bin/env bash
# Validate that every SKILL.md has required frontmatter (name + description),
# that plugin.json / marketplace.json parse as JSON, and that every plugin
# referenced from marketplace.json actually exists on disk.
set -euo pipefail

cd "$(dirname "$0")/.."

fail=0
err() { echo "ERROR: $*" >&2; fail=1; }

# 1. SKILL.md frontmatter
while IFS= read -r -d '' skill; do
  if ! head -1 "$skill" | grep -qx -- "---"; then
    err "$skill: missing YAML frontmatter (must start with ---)"
    continue
  fi
  fm=$(awk '/^---$/{c++; next} c==1{print} c==2{exit}' "$skill")
  for field in name description; do
    if ! grep -qE "^${field}:" <<<"$fm"; then
      err "$skill: missing frontmatter field '${field}'"
    fi
  done
  desc=$(grep -E "^description:" <<<"$fm" | sed 's/^description: *//' || true)
  if [[ ${#desc} -gt 1024 ]]; then
    err "$skill: description is ${#desc} chars (max 1024 for Claude skills)"
  fi
done < <(find plugins -name SKILL.md -print0)

# 2. JSON manifests parse
for f in .claude-plugin/marketplace.json plugins/*/.claude-plugin/plugin.json; do
  [[ -e $f ]] || continue
  if ! python3 -c "import json,sys; json.load(open('$f'))" 2>/dev/null; then
    err "$f: invalid JSON"
  fi
done

# 3. Marketplace plugin sources resolve
if [[ -f .claude-plugin/marketplace.json ]]; then
  python3 - <<'PY' || fail=1
import json, os, sys
m = json.load(open(".claude-plugin/marketplace.json"))
root = m.get("metadata", {}).get("pluginRoot", "")
ok = True
for p in m.get("plugins", []):
    src = p.get("source")
    if isinstance(src, str) and src.startswith("./"):
        path = src
    elif isinstance(src, str):
        path = os.path.join(root, src) if root else src
    else:
        continue  # remote source, skip
    if not os.path.isdir(path):
        print(f"ERROR: marketplace plugin '{p.get('name')}' source not found: {path}", file=sys.stderr)
        ok = False
    elif not os.path.isfile(os.path.join(path, ".claude-plugin", "plugin.json")):
        print(f"ERROR: plugin '{p.get('name')}' missing .claude-plugin/plugin.json at {path}", file=sys.stderr)
        ok = False
sys.exit(0 if ok else 1)
PY
fi

exit $fail
