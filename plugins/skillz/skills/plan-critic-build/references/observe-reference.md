# Observe the reference implementation

When the job is rebuilding, porting or replacing software that still runs,
the running original is the spec. Source data, docs and memory leave gaps
that a few minutes of watching it settle: the legacy service's real error
bodies and retry headers, the old CLI's exit codes and output on odd input,
an old app's rendering rules. In the Flying Colors port that meant an ordered
2×4 dither matrix, spray density profiles per mode, and border tiling rules
nobody had written down.

## Run it

Pick whatever runs the original with the least setup, and drive it with a
tool that captures evidence:

| Original                  | Run it in                                                          | Drive and capture with                                                  |
| ------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Legacy web app or service | staging, or a container of the old build                           | a browser driver (Playwright), recorded HTTP requests and responses     |
| Old CLI or library        | the old binary or package version                                  | scripted runs with captured stdout, stderr, exit codes and output files |
| Old desktop or mobile app | an emulator or VM (in-browser emulators exist for classic systems) | Playwright or the emulator's input API, screenshots                     |

Install the driver in scratch space if nothing is installed.

## The observer agent

A research item with `observe` set (plan-critic template), or a background
agent you launch yourself:

- **Time-boxed** (`minutes`, default 90). It writes up what it has, plus a
  list of what stayed unobserved, when the time runs out.
- **Captures every state it measures** and measures from the capture, not
  from impressions. Captures that contain copyrighted or private material go
  in the gitignored `vendor/`; the doc refers to them by number.
- **Records the working recipe first**: where it runs, input quirks (move,
  wait, then press; auth headers; env vars), how files or fixtures get in,
  patches the original needed. The next observer starts from it instead of
  rediscovering it.
- **Labels confidence** per finding: high means measured or seen directly,
  medium means seen once or partly inferred, low means a hypothesis.

## The doc

Committed at `docs/research/<key>-observations.md`: the recipe, then one
section per question with the measured values, then "Still unobserved".
Later rounds append a new section, so earlier findings keep their numbers.

Findings that change planned behaviour after planning go to the fold agent
(`fold` in wave-build), which rewrites the affected tasks before they run.
