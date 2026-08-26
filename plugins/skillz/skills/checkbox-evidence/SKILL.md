---
name: checkbox-evidence
description: Ticking a checkbox — PR checklists, task lists, acceptance criteria — every [x] must be empirically verified
alwaysApply: true
---

# Every `[x]` must be empirically verified

A ticked box claims you did the thing and saw the result. Tick it only when you
can point at the artifact: the image you captured, the test run and what it
printed, the command and its output. "The code looks right" is not
verification, and neither is evidence of the wrong kind — grepping a deployed
bundle for a string proves the code shipped, not that the UI renders.

Never invent an exemption the checklist does not offer. Where a list supplies an
N/A, N/A means the condition it names and nothing else. "Screenshots — N/A (no
rendered UI)" does not stretch to cover a dev-only panel, a component you judged
too small, or a change nobody will look at. If your reason is not the printed
reason, you are not N/A.

Leave it unticked instead, with one line of why. An empty box is information a
reviewer can act on; a wrong tick is a false statement that outlives review,
because nothing downstream can tell a verified box from a decorated one. Ticking
every box is not the goal — the checklist exists to surface what is missing, and
a full set of ticks that no one earned makes it worse than absent.

The usual rationalizations, none of which are exemptions: it's dev-only, it's
trivial, no one will look, I showed it in the chat instead, the tool can't do
it. Check that last one before believing it — the capability is usually
documented, and a false "impossible" is what most bad ticks rest on. If the
tooling genuinely cannot produce the artifact, that is a finding, not a
licence:
say which box, what you tried, and why, then ask. Same bargain as
`never-no-verify`.

Verify against the checklist's own source, not a filled-in example. Copying the
shape of a neighbouring PR's body carries its answers across with it, and you
inherit a tick that was never about your change.

When you own the checklist, prefer a machine check to self-certification. A box
CI verifies cannot be ticked by an agent in a hurry; a box only a human reads
will be.
