---
name: Verify commands before suggesting
description: Always run 1-3 verification checks (pgrep, which, ls, launchctl list, man, etc.) to confirm process names, binary paths, flags, and service identifiers exist on this machine before suggesting or running any command
type: feedback
originSessionId: 757e06f7-ef05-4249-ab02-db530465b5c6
---
Before suggesting or running any command, run 1-3 quick checks to confirm the referenced process names, binary paths, CLI flags, file paths, or service identifiers actually exist on this machine. Examples: `pgrep -fl <name>`, `which <bin>`, `launchctl list | grep <id>`, `ls <path>`, `man <cmd>` for flag syntax.

**Why:** Adam was burned by a suggestion to `sudo killall hidd` for a stuck mouse click on macOS Tahoe — `hidd` no longer exists as a user-space process on recent macOS, so the command would have returned "No matching processes found." He wants 100% accurate commands, not stale advice from training data.

**How to apply:** Applies to every command suggestion, especially anything OS-version-sensitive (macOS daemons, launchd services, system binaries), tool flags that change between versions, and file paths that vary by install method. **Run the verification checks yourself** (in parallel, silently) whenever possible — don't ask the user to run them. Only present the final command after the checks confirm it's valid. If a check fails, adjust or admit uncertainty rather than guessing.
