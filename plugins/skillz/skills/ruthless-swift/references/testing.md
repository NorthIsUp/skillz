# Testing

Depth on Rules 3 and 5–10 of `ruthless-swift`. Read when writing
tests, speeding up a slow suite, adding golden images, or driving UI
tests on a simulator.

## What runs where

| Test                                        | Runs with                             | Needs a simulator |
| ------------------------------------------- | ------------------------------------- | ----------------- |
| Logic, state machines, rendering to buffers | `swift test` on the SwiftPM package   | no                |
| Golden images (render, compare PNGs)        | `swift test`, rendering offscreen     | no                |
| Architecture rules                          | `swift test`, reading the source tree | no                |
| Taps, navigation, launch                    | XCUITest via `xcodebuild test`        | yes               |

Push everything you can up the table. A simulator costs RAM, boot time
and flakiness; `swift test` costs seconds.

## Sharding Swift Testing

`swift test --parallel` only parallelizes XCTest. Swift Testing in a
package with `.defaultIsolation(MainActor.self)` puts every test on the
one main actor, so they run serially however many cores you have.
Parallelism comes from processes:

1. `swift build --build-tests` once.
2. `swift test list --skip-build` to get every test.
3. Split the list by suite into 2 × cores shards; run each as
   `swift test --skip-build --ignore-lock --filter '<suite regex>'`.
4. Check the union of shards ran every listed test, so a filter typo
   can't drop tests silently.

`scripts/swift-test-shards.sh <package-path> <TestModule>` (in
`ruthless-appstore` and `template-apple`) does all four. It shards by
suite, so keep tests in `@Suite` types.

## Golden images

- Replay a scripted input sequence, render, and compare the PNG pixel
  for pixel against the committed reference. No tolerance: with Rule 4's
  determinism, any difference is a real change.
- Record a new golden only after comparing it to the reference by eye.
  A recorded bug is a test that now guarantees the bug.
- A missing reference is `Issue.record("missing reference: …")`, a
  failure. A skip turns a deleted file into a passing suite.

## Architecture tests

Encode merge-friendly structure as tests that read the source tree.
PixKidz: every feature file's top-level declarations are `private` or
`fileprivate` except its one exported type, so parallel agents adding
features only ever add files, and merges don't conflict.

## Timing budgets

A budget test that fails in CI runs in release, not with a looser
budget: `swift test -c release -Xswiftc -enable-testing`.
`-enable-testing` keeps `@testable import` working in an optimized
build.

## UI tests and simulators (Xcode 27)

- Xcode 27 has no Simulator.app; devices live in DeviceHub.app
  (`com.apple.dt.Devices`). `xcrun simctl` still works for create, boot
  and shutdown.
- Boot at most one simulator and shut it down when idle; run heavy
  builds on a remote host or CI.
- Pass launch arguments for test state: `-fresh` (clean state), `-mute`
  (silence the app, never the host's volume).
- Drive taps through XCUITest. The `axe` CLI needs `--tap-style physical`
  for taps to register.
