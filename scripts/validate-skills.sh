#!/bin/sh
# Validate that every SKILL.md has required frontmatter (name + description),
# that plugin.json / marketplace.json parse as JSON, and that every plugin
# referenced from marketplace.json actually exists on disk.
#
# Runs on every commit (hk), so it is one python process rather than a handful
# of greps per skill.
cd "$(dirname "$0")/.." || exit 1
exec python3 - <<'PY'
import glob, json, os, re, sys

ok = True


def err(msg):
    global ok
    print(f"ERROR: {msg}", file=sys.stderr)
    ok = False


# 1. SKILL.md frontmatter. Symlinked SKILL.md files count; symlinked dirs are
# not descended, matching `find`.
for root, _dirs, files in os.walk("plugins"):
    if "SKILL.md" not in files:
        continue
    skill = os.path.join(root, "SKILL.md")
    try:
        lines = open(skill, encoding="utf-8").read().splitlines()
    except OSError:
        lines = []
    if not lines or lines[0] != "---":
        err(f"{skill}: missing YAML frontmatter (must start with ---)")
        continue
    fm = []
    for line in lines[1:]:
        if line == "---":
            break
        fm.append(line)
    for field in ("name", "description"):
        if not any(line.startswith(f"{field}:") for line in fm):
            err(f"{skill}: missing frontmatter field '{field}'")
    desc = next((re.sub(r"^description: *", "", l) for l in fm if l.startswith("description:")), "")
    if len(desc) > 1024:
        err(f"{skill}: description is {len(desc)} chars (max 1024 for Claude skills)")

# 2. JSON manifests parse
for f in [".claude-plugin/marketplace.json", *sorted(glob.glob("plugins/*/.claude-plugin/plugin.json"))]:
    if not os.path.exists(f):
        continue
    try:
        json.load(open(f))
    except (OSError, ValueError):
        err(f"{f}: invalid JSON")

# 3. Marketplace plugin sources resolve
try:
    m = json.load(open(".claude-plugin/marketplace.json"))
except (OSError, ValueError):
    m = {}
root = m.get("metadata", {}).get("pluginRoot", "")
for p in m.get("plugins", []):
    src = p.get("source")
    if isinstance(src, str) and src.startswith("./"):
        path = src
    elif isinstance(src, str):
        path = os.path.join(root, src) if root else src
    else:
        continue  # remote source, skip
    if not os.path.isdir(path):
        err(f"marketplace plugin '{p.get('name')}' source not found: {path}")
    elif not os.path.isfile(os.path.join(path, ".claude-plugin", "plugin.json")):
        err(f"plugin '{p.get('name')}' missing .claude-plugin/plugin.json at {path}")

sys.exit(0 if ok else 1)
PY
