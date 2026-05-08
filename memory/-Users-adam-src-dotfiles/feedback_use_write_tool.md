---
name: Use Write tool for file creation
description: User prefers Write tool over cat heredocs in Bash for creating files
type: feedback
---

Use the Write tool directly to create files, not `cat > file << 'EOF'` via Bash.

**Why:** User explicitly corrected this — "write the files directly, you don't need to use cat"

**How to apply:** When creating new files, always use the Write tool. Only use Bash for actual shell commands (git, chmod, running scripts, etc.).
