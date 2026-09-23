# Vendored superpowers skills

- Source: [obra/superpowers](https://github.com/obra/superpowers), plugin
  version 6.4.1, copied from the `claude-plugins-official` marketplace cache.
- Vendored: 2026-09-23.
- License: MIT, Copyright (c) 2025 Jesse Vincent. See [LICENSE](LICENSE).

Copied because `plan-critic-build` depends on them and skillz must work
without the superpowers plugin installed:

| skillz skill                                 | Upstream                                     |
| -------------------------------------------- | -------------------------------------------- |
| `superpowers-brainstorming`                  | `superpowers:brainstorming`                  |
| `superpowers-writing-plans`                  | `superpowers:writing-plans`                  |
| `superpowers-subagent-driven-development`    | `superpowers:subagent-driven-development`    |
| `superpowers-using-git-worktrees`            | `superpowers:using-git-worktrees`            |
| `superpowers-requesting-code-review`         | `superpowers:requesting-code-review`         |
| `superpowers-finishing-a-development-branch` | `superpowers:finishing-a-development-branch` |

Local changes, nothing else:

- Each skill directory and its `name:` gain a `superpowers-` prefix so they
  never shadow the upstream plugin.
- Each `description:` is prefixed with a note naming the upstream skill, so a
  session with both installed prefers upstream.
- Cross-references to the skills above (`superpowers:<x>`, `../<x>/`) point at
  the vendored copies. `superpowers:executing-plans` (the inline alternative
  offered by writing-plans) is not vendored and still names upstream;
  `plan-critic-build` always executes subagent-driven.
- Markdown lint and formatting are not applied to these files, so the copy
  stays diffable against upstream.

To update: copy the six skill directories from a newer release, reapply the
changes above, and bump the version and date here.
