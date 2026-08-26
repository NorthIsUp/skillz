---
name: checkbox-evidence
description: Ticking a checkbox — PR checklists, task lists, acceptance criteria — every [x] must be empirically verified
alwaysApply: true
---

# Every `[x]` must be empirically verified

A ticked box claims you did the thing and saw the result. Tick it only when you
can point at the artifact — the image you captured, the test run and what it
printed. Evidence of the wrong kind does not count: grepping a deployed bundle
for a string proves the code shipped, not that the UI renders.

Where a checklist offers an N/A, N/A means the condition it names and nothing
else. "Screenshots — N/A (no rendered UI)" does not stretch to a dev-only
panel. If your reason is not the printed reason, you are not N/A — leave the
box unticked with one line of why. An empty box is information a reviewer can
act on; a wrong tick is a false statement that outlives review, because nothing
downstream can tell a verified box from a decorated one.

None of these are exemptions: it's dev-only, it's trivial, no one will look, I
showed it in chat, the tool can't do it. Check that last one — the capability
is usually documented and unread, and a false "impossible" is what most bad
ticks rest on. If it truly can't, that is a finding, not a licence: say which
box and what you tried, then ask. Same bargain as `never-no-verify`.

Fill a checklist from its own source, never from a neighbouring PR's
filled-in body — that carries its answers across to a change they were never
about.

When you own the checklist, prefer a machine check to self-certification.
