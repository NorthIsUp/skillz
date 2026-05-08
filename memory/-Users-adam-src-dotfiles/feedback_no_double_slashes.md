---
name: No double slashes in paths
description: Never generate file paths with double slashes (//), always use single slashes (/)
type: feedback
---

File paths must use single slashes only — never `//`, always `/`.

**Why:** The user noticed Claude generating paths like `//Users/...` instead of `/Users/...`, which looks wrong and may cause issues.

**How to apply:** When constructing any file path for tool calls, ensure there are no consecutive slashes. This applies to all tools that take file paths (Read, Write, Edit, Glob, etc.).
