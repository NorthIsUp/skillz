---
description: Writing a TypeScript switch over a discriminated union or enum
alwaysApply: true
---

# Exhaustive TypeScript switches

In TypeScript, a switch over a discriminated union or enum gets a `never`
assertion in the default case, so a newly added variant is a compile error
until every branch handles it.
