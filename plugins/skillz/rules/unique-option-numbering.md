---
description: Give every option a globally unique, stable ID
alwaysApply: true
---

# Globally unique option numbering

When you present options, questions, or choices, label each with a globally
unique ID so it can be referenced later without ambiguity. IDs are never
reused within a conversation, even across unrelated lists.

- **Sequence.** `A1 A2 A3 …` for the first options. When a new group is
  needed, advance the letter prefix spreadsheet-style:
  `A → B → … → Z → AA → AB → …`. The prefix groups; the number counts
  within the group.
- **Sub-options.** Nest with a dotted suffix: sub-options of `AA1` are
  `AA1.1 AA1.2 …`.
- **Stable.** Once assigned, an ID sticks to that option for the rest of the
  conversation. Don't renumber a list when items are added or removed —
  append new IDs, never shift existing ones.
- **Reference by ID.** Refer back to a choice by its ID (`going with A2`),
  not by position or a re-description.
