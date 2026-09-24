# Observe the reference implementation

When the job is rebuilding or porting something that still runs, the original
is the spec. Resource data, docs and memory leave gaps that a few minutes of
watching it settle. In one port that meant an ordered 2×4 dither matrix, spray
density profiles per mode, border corner and tiling rules, and three category
names nobody had written down.

## Run it

Pick whatever runs the original with the least setup: an in-browser emulator
(infinitemac.org for classic Mac OS), the old app in a VM, or the live site.
Drive it with Playwright from scratch space (no browser tool is installed by
default), headless if it works.

## The observer agent

A research item with `observe` set (plan-critic template), or a background
agent you launch yourself:

- **Time-boxed** (`minutes`, default 90). It writes up what it has, plus a
  list of what stayed unobserved, when the time runs out.
- **Screenshots every state it measures** and measures from pixels, not
  impressions. Screenshots go in the gitignored `vendor/`, since they show
  copyrighted art; the doc refers to them by number.
- **Records the working recipe first**: machine and URL, input quirks (move,
  wait, then press), how files get in, patches the original needed. The next
  observer starts from it instead of rediscovering it.
- **Labels confidence** per finding: high means measured or seen directly,
  medium means seen once or partly inferred, low means a hypothesis.

## The doc

Committed at `docs/research/<key>-observations.md`: the recipe, then one
section per question with the measured values, then "Still unobserved".
Later rounds append a new section, so earlier findings keep their numbers.

Findings that change planned behaviour after planning go to the fold agent
(`fold` in wave-build), which rewrites the affected tasks before they run.
