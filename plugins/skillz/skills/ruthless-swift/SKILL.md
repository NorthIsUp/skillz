---
name: ruthless-swift
description: |
  Standing rules for Swift 6 code: strict concurrency, SwiftUI, Swift
  Testing, SwiftPM packages and XcodeGen projects. Use whenever writing,
  editing or reviewing a `.swift` file, a `Package.swift` or a
  `project.yml`. Also fires for "fix this Swift 6 error", "main
  actor-isolated", "Sendable", "make the Swift tests parallel", "golden
  test", "SwiftUI paging scroll", "pixel art scaling", and "new iOS/Mac
  app" (start from template-apple).
paths:
  - "**/*.swift"
  - "**/Package.swift"
  - "**/project.yml"
---

# Ruthless Swift

The standing bar for Swift in this workspace. Declarative: each rule
states _what_ good code looks like and _why_, so the principle applies
to cases the rule doesn't literally cover. Every rule was verified on
PixKidz. Signing, TestFlight and CI uploads live in `ruthless-appstore`.

New apps start from `NorthIsUp/template-apple`:
`gh repo create <owner>/<name> --private --template NorthIsUp/template-apple --clone`,
then its `SETUP.md`. It already meets Rules 1, 3, 6 and 9; `ruthless-appstore`
lists what else it sets up.

## The bar

- **Rule 1 — Swift 6 language mode, strict concurrency, no opt-outs.** `SWIFT_VERSION: "6.0"` in `project.yml`, `swift-tools-version: 6.x` in `Package.swift`. A data race is a compile error; fix the isolation instead of silencing it. An `@unchecked Sendable` or `@preconcurrency` carries a comment naming why the checker can't see the safety. See `references/concurrency.md`.
- **Rule 2 — UI state is main-actor, and so is logic only the UI calls.** The app model is `@Observable @MainActor final class`. An engine package whose every caller is main-actor sets `.defaultIsolation(MainActor.self)` rather than threading annotations through every type; a `Mutex` in nonisolated code that only main-actor callers reach is locking for nothing. The cost is that Swift Testing runs that package's tests serially (Rule 6).
- **Rule 3 — Logic lives in a local SwiftPM package; the app target is thin SwiftUI chrome.** Everything that isn't pixels on glass is tested headless with `swift test`: no simulator, no scheme, seconds instead of minutes.
- **Rule 4 — Output is deterministic.** Never let `Dictionary` or `Set` iteration decide output order: it changes from run to run. Randomness comes only from a seeded RNG injected through context, never `.random()` or `SystemRandomNumberGenerator` in logic. Reproducible output is what makes Rule 7 possible.
- **Rule 5 — Tests are Swift Testing.** `@Test`, `#expect`, `#require`, `Issue.record`. XCTest only for UI tests (XCUITest). See `references/testing.md`.
- **Rule 6 — Shard Swift Testing across processes.** `swift test --parallel` parallelizes XCTest only; Swift Testing in a main-actor package runs every test on one actor. Build once with `swift build --build-tests`, run shards with `swift test --skip-build --ignore-lock --filter …` at 2 × cores, and check that every listed test ran. `scripts/swift-test-shards.sh` does it, sharding by suite, so tests live in `@Suite` types rather than free functions (PixKidz: 306 s → 136 s).
- **Rule 7 — Pixels are tested against references, pixel-exact.** Replay scripted input, render, compare PNGs pixel for pixel. Record a golden only after comparing it to the reference by eye. A missing reference fails the test (`Issue.record`), never skips it: a skipped golden is a test that silently stopped existing.
- **Rule 8 — Architecture rules are tests.** A convention that keeps parallel merges clean is enforced by a test, not a README. Example: each feature file exports only its one type (every other top-level declaration is `private` or `fileprivate`), so agents' merges are add-only.
- **Rule 9 — `project.yml` is the source; the `.xcodeproj` is generated and never committed.** Regenerate with `xcodegen` (`mise run gen` in the template), CI included. `configs:` is a sibling of `base:`, not nested in it. Resources go in as folder references.
- **Rule 10 — A timing-budget test that fails in CI runs optimized; the budget stays.** `swift test -c release -Xswiftc -enable-testing`. Debug builds measure the debugger's overhead, not the code.
- **Rule 11 — Switches over your own enums have no `default:`.** Swift switches are exhaustive, so leaving out `default` makes a new case a compile error at every switch that must handle it. `@unknown default` is for enums from other modules only.
- **Rule 12 — SwiftUI layout adapts instead of measuring.** `ViewThatFits` for fits-or-scroll, `containerRelativeFrame` and scroll targets for paging, and only the background ignores the safe area. Pixel art scales nearest-neighbour by whole device pixels. See `references/swiftui.md`.

## Tooling

- **XcodeGen** generates the project (Rule 9). Pin its version in `mise.toml`; `brew install` updates Homebrew on every CI run.
- **`swift format`** ships with the toolchain: the formatter and the linter, run through hk. No SwiftLint, no style opinions in review.
- **Parallel `xcodebuild` runs that share DerivedData fail** with "build database is locked". Build sequentially, or give each run its own `-derivedDataPath`.
- **CI caching** (SwiftPM `.build` needs mtimes restored from commits; `COMPILATION_CACHE_ENABLE_CACHING=YES` for Xcode builds): `ruthless-appstore`'s `references/ci.md`.
- **Simulators**: never more than one booted, shut down when idle, heavy builds on a remote host or CI (`ruthless-appstore` Rule 14). Xcode 27 details in `references/testing.md`.

## Anti-patterns (reject on sight)

| Smell                                                  | Replace with                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `@unchecked Sendable` with no comment                  | Real isolation, or a comment naming why it's safe               |
| `Mutex` / lock in code only main-actor callers reach   | `@MainActor` (or the package's default isolation)               |
| `for (k, v) in dict` producing output                  | Iterate sorted keys, or keep an ordered array                   |
| `Int.random(in:)` / `.shuffled()` in logic             | `.random(in:using:)` with the injected seeded RNG               |
| `swift test --parallel` to speed up Swift Testing      | `swift-test-shards.sh`                                          |
| Golden test that skips when the reference is missing   | `Issue.record` so it fails                                      |
| Recording goldens without looking at them              | Compare to the reference by eye, then record                    |
| Committed `*.xcodeproj`                                | `project.yml` + `xcodegen`, project in `.gitignore`             |
| Loosening a timing budget after a CI failure           | `swift test -c release -Xswiftc -enable-testing`                |
| `default:` in a switch over your own enum              | List every case                                                 |
| `.ignoresSafeArea()` on content                        | Only on the background layer                                    |
| `.resizable()` pixel art at a fractional scale         | `.interpolation(.none)`, whole device pixels via `displayScale` |
| Committing app state on every scroll-position change   | Commit in `onScrollPhaseChange` when a user swipe settles       |
| `CADisplayLink(target: self, …)`                       | A weak proxy target; invalidate in `isolated deinit`            |
| Business logic in the app target                       | The SwiftPM package, tested with `swift test`                   |
| Muting the host's volume for a noisy app or test       | The app's `-mute` launch flag                                   |
| Parallel `xcodebuild` runs sharing default DerivedData | Sequential, or one `-derivedDataPath` each                      |

## Reviewing Swift (PRs, diffs)

Walk the diff against the bar. For each violation, quote the line and propose the replacement. Lead with the rule number ("Rule 4: `Set` iteration orders the export — sort the keys") so the author can map feedback back to the standard.

## Reference files (load on demand)

- `references/concurrency.md` — isolation choices, the Swift 6 errors PixKidz hit and their fixes, the `CADisplayLink` weak proxy.
- `references/testing.md` — Swift Testing, sharding, golden images, architecture tests, timing budgets, UI tests and simulators on Xcode 27.
- `references/swiftui.md` — pixel-art scaling, fits-or-scroll, paging scroll views and committing on settle, safe areas.
