---
name: Semgrep Python rule-authoring gotchas
description: Hard-won pitfalls and workarounds learned while porting 75+ SonarQube Python checks to Semgrep rules in sonar-python.git
type: reference
originSessionId: 75817e54-a284-4c82-9880-61f5c0f49fb4
---
These observations come from porting Sonar Python rules into `.semgrep/rules/*.yml` against the sonar-python fixtures. Future authoring sessions in this repo (or similar Semgrep-porting work) should check these before wrestling with the pattern language.

## Semgrep's Python parser normalises several constructs

When a pattern appears to over- or under-match unexpectedly, suspect normalisation first. Known collapses:

- `<>` and `!=` → same AST. Cannot distinguish them with a Python-mode `pattern:`; use `languages: [generic]` + `pattern-regex`.
- `+x` / `-x` on a numeric literal → folded. `pattern: ++$X` over-matches bare `0`, `1`, etc. Workaround: `languages: [generic]` regex like `(?m)^\s*(\+\+|--)[A-Za-z_]`.
- `except*` → `except`. The `*` is lost in the AST; a Python-mode rule for exception groups will FP on plain `except`. Use `languages: [generic]`.
- `[x async for x in xs]` parses identically to `[x for x in xs]`. Add an extra `pattern-regex: 'async\s+for'` to separate them.
- `(expr)` parens are transparent; `(x)` and `x` are indistinguishable.

## `pattern-not-inside` walks the full ancestor chain, not the nearest scope

If a rule cares about "nearest enclosing def/class", a single `pattern-not-inside: def $F(...): ...` over-excludes (it matches when a def is *anywhere* up the tree, even with a class between). Express "nearest is X, not Y" as:

1. `pattern-inside:` the desired ancestor (e.g. `class $C: ...`)
2. `pattern-not-inside:` the full deeper nesting that would invalidate the scope (e.g. `class $C: ... def $F(...): ... TARGET ...`)

See `.semgrep/rules/ReturnYieldOutsideFunction.yml` and `BareRaiseInFinally.yml` for worked examples.

## Each `patterns` / `pattern-either` branch needs one positive term

A branch containing only `pattern-not*` (`pattern-not`, `pattern-not-inside`, `pattern-not-regex`) is rejected with:

> you need at least one positive term (not just negations or conditions)

Either add a positive `pattern:` to the branch or refactor into two rules.

## `metavariable-pattern` + `pattern-not` is flaky

Nested negations inside `metavariable-pattern` often fail to exclude what they should. Prefer `metavariable-regex` with anchored expressions (`^[A-Za-z_][A-Za-z0-9_.]*$`) for textual constraints on a metavariable. Reserve `metavariable-pattern` for positive shape checks.

## `.$METAVAR` crashes the Python parser

Writing `$F(...).$A == $F(...).$A` fails at rule-parse time with `Parsing_error.Lexical_error (unrecognized symbol: $ ...)`. Rewrite attribute-of-metavariable cases by requiring the metavariable *not* to be a call via `metavariable-pattern` / regex.

## Constant propagation is on by default

Semgrep's Python engine propagates single-assigned literals across statements. That's usually a feature (handles `x = "secret"; use(x)`) but can cause FPs for rules that want "literal at call site only". Disable per rule with:

```yaml
options:
  constant_propagation: false
  symbolic_propagation: false
```

## Taint mode is available

For source-to-sink rules (e.g. "pytz timezone passed to datetime constructor", "tainted input reaching a sink"), `mode: taint` works and propagates through variable bindings without needing multi-statement patterns. See `.semgrep/rules/DatetimeConstructorPytzTimezone.yml`.

## `focus-metavariable` pins the finding location

Multi-statement / multi-line patterns report from the outer span's start line by default. If Sonar's `# Noncompliant` marker is on an inner subexpression (e.g. the actual call, not the whole `class: ... call()` block), add `focus-metavariable: $SOMETHING` so the finding lands on the right line.

## Counting per-line Noncompliant expectations

`# Noncompliant 2` on one line means Semgrep must report two findings there. A single wide-span match produces one finding, not two. Structure the rule so each match covers a narrow subexpression (often by adding `focus-metavariable` or by splitting into sub-rules).

## Rule categories that are unsupported in Semgrep

Don't spend time fighting these — declare UNSUPPORTED and move on. Patterns that need:

- **Control-flow graph analysis**: dead code after jump (S1763), redundant jump, infinite recursion, "else-after-loops without break".
- **Type inference / class-hierarchy walks**: exception-base-class checks, isinstance-on-user-class, dict-subclass detection, enum-inheritance.
- **Symbol resolution across statements**: rules that look up whether a name was imported, whether a class has a method, whether a base class has an attribute, fully-qualified-name comparisons across imports.
- **Single-assignment / def-use dataflow**: "first use of a cipher's IV", weak-SSL-context that's later hardened, cross-statement mutation tracking.
- **Per-element counting over a collection literal**: duplicate dict keys with numeric equivalence (`1 == True`, `0 == 0j`), per-parameter emission from a def-with-many-params rule.
- **Running an arbitrary Python parser over comment text**: S125 (commented-out code).
- **Line 0 / file-level findings**: Semgrep matches are 1-indexed, so S113 (missing-newline-at-EOF) fixtures using `# Noncompliant@-1` on line 1 can't be tested by the harness.

## Test fixture conventions (Sonar)

- `# Noncompliant` — one issue on this line.
- `# Noncompliant N` — N issues on this line.
- `# Noncompliant@+1` / `@-1` — shift the target line.
- `# Noncompliant {{message}}` — message text (ignored by the harness).
- `# FN`, `# FP`, `# OK`, `# Compliant` — Sonar's own annotations, NOT expectations. Do not treat as Noncompliant markers.

## Multi-file rule files

A single `.yml` may cover multiple fixtures. The harness at `.semgrep/tools/run_tests.py` reads `# fixture: <name>.py` comments from the rule — add one line per fixture the rule targets.
