---
description: Imports go at the top of the module, including in type positions and for heavy or optional deps
alwaysApply: true
---

# No inline imports

When editing code, imports go at the top of the module — including type
annotations and interface fields, where an inline `import('./types').Foo` or a
stringized `def f(x: "mod.Type")` does not read as an import at all, and heavy
or optional deps where a lazy import inside the function would cut startup
time; the startup win is not worth the hidden dependency. Only exception:
breaking a real import cycle, and it needs a comment saying so.
