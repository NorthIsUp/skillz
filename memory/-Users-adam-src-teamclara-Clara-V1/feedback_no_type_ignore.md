---
name: No `# type: ignore` comments
description: Never use `# type: ignore[...]` or `# pyright: ignore[...]` to suppress type errors. Fix the underlying type issue instead.
type: feedback
originSessionId: 9c0e70c9-d17b-4b0a-8d32-f9ed79fcc8ea
---
`# type: ignore[anything...]` and `# pyright: ignore[anything...]` are banned. If pyright/mypy complains, **explain the error and fix it at the source** — don't suppress.

**Why:** Suppressions accumulate, hide real bugs, and signal that the type system is broken without anyone owning the fix. They also normalize "make pyright shut up" as a habit. The codebase's pyright-diff lint scopes errors to modified lines for a reason — new code should be clean.

**How to apply:**

When you hit a type error, choose one of these instead of suppressing:

1. **Use the right value type.** If a Django model field is `CharField` and you're writing a string literal, the stubs friction is real but stylistically you should use the enum (`HPPReviewStatus.APPROVED`) or `.value`. Even when this doesn't fully silence pyright, it's the value-level fix.
2. **Route through queryset methods.** Many model-attribute writes (`profile.foo = "bar"`) trip django-stubs. The same write via `Model.objects.filter(...).aupdate(foo="bar")` typically passes — different stubs, str-friendly.
3. **Add a proper type annotation.** Lambdas, generic functions, untyped 3rd-party callbacks: declare the type at the boundary so pyright can infer the rest.
4. **Cast at the boundary.** `typing.cast(T, value)` is honest about a single conversion point. Better than blanket `# type: ignore`.
5. **Fix the stub.** If the issue is a wrong upstream stub (django-stubs gap, viewflow has none), file/PR a stub fix or vendor a `.pyi` override locally.

If none of those work, **say so explicitly** and ask before suppressing — sometimes the right answer is "this lib has no stubs, we're going to live with it" but that's a conscious tradeoff, not a default.

**Do not:** silently scatter `# type: ignore` or `# pyright: ignore` across the diff to make CI pass. The user will catch it and the suppression becomes feedback debt.
