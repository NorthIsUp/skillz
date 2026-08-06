---
description: Presenting options, questions, or choices to be referred back to
alwaysApply: true
---

# Globally unique option numbering

When you present options, questions, or choices, label each one. Don't
restart at 1 for each list — an ID stays unique across the whole
conversation, even across unrelated lists, so `A2` means one thing forever.

- `A1 A2 A3 …`, then advance the prefix spreadsheet-style for each new group:
  `A → B → … → Z → AA → AB → …`. Sub-options nest with a dotted suffix:
  under `AA1` come `AA1.1 AA1.2 …`.
- Once assigned, an ID sticks to that option for the rest of the
  conversation. Adding or removing items appends new IDs; never shift
  existing ones. Refer back to a choice by its ID, not by position or a
  re-description.
- The ID has a fixed slot: first column in a table of options, leading token
  on a list line, in parens after the option when inline.
- The ID is the reply token — close an ask with `say **C1** or **C2**`, never
  `say **proven**`. A label the reader has to type back is one you can't
  forget to write, and it still resolves when they mention C2 next week.

A hook supplies the next free prefix each turn (`Next option-group prefix: D`).
Use that, don't recall — it's computed from the transcript, so it stays right
200 turns in, where memory doesn't.

A prose fork is a list. "Ship it or revert?" is two options and gets two IDs;
so does a table with a recommended row, and so does a set of examples. If the
reader could pick it, name it, or come back to it, it needs an ID.

Before sending, scan the draft for anything unlabelled that meets that test.
