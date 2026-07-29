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
