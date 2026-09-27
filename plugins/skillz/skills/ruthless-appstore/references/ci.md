# CI

Template: `scripts/testflight.yml`. The macOS job tests, archives and exports; the Linux job uploads.

## Runner

`runs-on: xcode-27` is GitHub's (preview) label for Xcode 27; actionlint doesn't know it, which is
fine. Xcode 27 has no Simulator.app (devices live in DeviceHub, `com.apple.dt.Devices`), and a
runner may have no simulator for the runtime: create one with `xcrun simctl create` if UI tests
need it.

## What each saving measured

| Change                                                                         | Before → after          | App     |
| ------------------------------------------------------------------------------ | ----------------------- | ------- |
| Cache `.git/lfs`, keyed on the sorted LFS object ids                           | 137 s → 4 s LFS pull    | PixKidz |
| Shard Swift Testing across processes (`swift-test-shards.sh`, 2 × cores)       | 306 s → 136 s tests     | PixKidz |
| `COMPILATION_CACHE_ENABLE_CACHING=YES` + cache `CompilationCache.noindex`      | 1m55 → 1m22 archive     | Clip    |
| Upload from Linux instead of macOS (saves the upload plus ~40 s of processing) | macOS minutes, at 10×   | PixKidz |
| Skip package tests when the package's paths didn't change since `before`       | whole step              | PixKidz |
| Pinned XcodeGen release zip, cached, instead of `brew install`                 | Homebrew update per run | PixKidz |

SwiftPM's `.build` cache only hits because a step first sets every source file's mtime to its last
commit time: checkout stamps everything "now", which invalidates the whole cached build.

## DerivedData: where the sessions disagreed

- PixKidz: caching DerivedData didn't speed up the Release archive at all.
- Flying Colors and Clip: `COMPILATION_CACHE_ENABLE_CACHING=YES` is what hits across runs, because
  the compilation cache is keyed on content and checkout resets mtimes. Clip measured 1m55 → 1m22
  caching `DerivedData/CompilationCache.noindex`, keyed on the Xcode version.

Both are consistent: DerivedData by itself is mtime-invalidated, and the content-keyed compilation
cache inside it is the part that survives. To use it, set the build setting, pass a fixed
`-derivedDataPath` shared by test and archive, and cache only `CompilationCache.noindex`. The template
leaves it out because PixKidz never measured it; add it when an archive is slow.

## Cache scope

- A PR's caches aren't visible to `main`, but `main`'s caches are restored in PRs. Warm caches on `main`.
- Never cache keychains, profiles or keys (Rule 7).

## Gating

- `secrets.*` isn't allowed in a step `if:`. Set `HAS_SIGNING: ${{ secrets.P12_BASE64 != '' }}` in
  the job's env and test `env.HAS_SIGNING == 'true'`, so fork PRs without secrets still run tests.
- The upload job runs only on `push` to `main` and `workflow_dispatch`; PRs stop after export.

## Transporter on Linux

Pinned at 4.0.0.4 from Apple's bootstrapper; the version and installer MD5 are in
`https://transporter.amp.apple.com/transporter/asu/<version>/installers/manifest.json`.

- Linux Transporter can't analyze an `.ipa`. Export with `generateAppStoreInformation` true and ship
  the resulting `AppStoreInfo.plist` beside the `.ipa` as `-assetDescription`.
- Use absolute paths and `-v eXtreme`. With relative paths at the default level, PixKidz run
  36357454203 sent the plist, then failed the `.ipa` with no reason; run 36358255611 with absolute
  paths at eXtreme uploaded. eXtreme is mostly noise, so print its tail on success and a filtered
  300 lines plus the full log artifact on failure.
- Auth is the same `.p8` in `~/.appstoreconnect/private_keys/` with `-apiKey` / `-apiIssuer`.

## Tests that measure time

A timing-budget test that fails in CI runs optimized, not looser:
`swift test -c release -Xswiftc -enable-testing`.
