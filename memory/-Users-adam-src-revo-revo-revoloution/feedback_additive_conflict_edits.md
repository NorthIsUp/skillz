---
name: Additive conflict edits for downstream forks
description: When resolving rebase conflicts on a long-lived feature branch (e.g. apple-tv on top of upstream release), prefer adding new preprocessor blocks over modifying upstream-touched lines.
type: feedback
originSessionId: 667982ce-f013-482d-b8e8-b5dc37eec16f
---

When resolving rebase/merge conflicts on a long-lived feature branch (apple-tv tvOS port over upstream itgmania release), prefer **additive changes** over **modifications to upstream-touched lines**.

**Why:** Each modification to a line that upstream also touched creates a conflict on every future rebase. Additive blocks (`#if defined(TVOS) ... #endif` next to the original `#if`) keep the upstream line byte-identical, so future rebases auto-merge.

**How to apply:**

- Prefer `#if defined(TVOS) return X; #endif` followed by the unchanged original `#if defined(UNIX) ...` block over `#if defined(TVOS) ... #elif defined(UNIX) ...` (which rewrites the original `#if` line).
- Same for CMake: add a separate `if(TVOS) ... endif()` block instead of inserting an `elseif(TVOS)` into an existing chain (when guards are mutually exclusive enough that side-by-side blocks are equivalent).
- Wrap with outer guards rather than altering inner conditions: `#if !defined(TVOS) #ifndef MACOSX ... #endif #endif` is more rebase-friendly than `#if !defined(MACOSX) && !defined(TVOS)`.
- Same outcome, but the upstream line stays untouched.
