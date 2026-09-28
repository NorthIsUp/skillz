---
name: ruthless-appstore
description: |
  Standing rules for shipping Apple apps: code signing, provisioning
  profiles, TestFlight, App Store Connect API automation, CI uploads, and
  macOS notarization. Use whenever touching an Xcode or XcodeGen project's
  signing settings, ExportOptions.plist, a TestFlight or App Store
  workflow, ASC API keys, certificates, 1Password signing items, or
  GitHub signing secrets. Also fires for "ship to TestFlight", "set up
  signing", "upload a build", "notarize", "why is the ASC icon grey",
  "make a profile", and "new iOS/Mac app" (start from template-apple).
paths:
  - "**/project.yml"
  - "**/*.pbxproj"
  - "**/*.entitlements"
  - "**/ExportOptions*.plist"
  - "**/.github/workflows/*testflight*"
  - "**/.github/workflows/*appstore*"
  - "**/scripts/testflight.sh"
---

# Ruthless App Store

The standing bar for Apple signing and distribution. Each rule states what
to do and why, so it covers cases it doesn't literally name. Every fact
here was verified on a shipped app (PixKidz, Flying Colors, Clip, Clip.md);
where sessions measured different things, the reference says which.

Swift code itself (concurrency, SwiftUI, tests, XcodeGen): the `ruthless-swift` skill.

## New apps start from `template-apple`

```sh
gh repo create <owner>/<name> --private --template NorthIsUp/template-apple --clone
```

Then work through the template's `SETUP.md` checklist, top to bottom: it goes from a fresh copy to the first TestFlight build. What the template gives you:

- **One config spot.** `APP_NAME`, `BUNDLE_ID` and `TEAM_ID` live in `mise.toml` `[env]`; `project.yml` reads them as `${VAR}`, and the scripts and CI read the same env. `mise run gen` runs XcodeGen; the `.xcodeproj` is never committed.
- **One multiplatform target** (`supportedDestinations: [iOS, macOS]`) with sandbox and hardened runtime on, and Release signing already manual (Rule 5).
- **`Core/`**, a local SwiftPM package for the logic, tested with `swift test` and no simulator.
- **One CI pipeline** (`.github/workflows/ci.yml`). A `HAS_SIGNING` env gate skips signing when the secrets are absent (a fresh copy, a fork). PRs lint, run sharded Core tests, build, and export with `testflight.sh --no-upload` (Rule 4). `main` hands the `.ipa` to a Linux job that uploads with Transporter (Rule 10); if `MARKETING_VERSION` changed (`mise run bump-{patch,minor,major}`), it tags `v<version>` and makes a GitHub release.

Gotchas the template hit:

- GitHub doesn't copy LFS objects into a repo made from a template. The AppIcon PNGs are excluded from LFS in `.gitattributes`; keep anything a fresh copy needs to build out of LFS.
- Parallel `xcodebuild` runs sharing DerivedData fail with "build database is locked" (`build.db`). Build sequentially, or give each run its own `-derivedDataPath`.
- Node-24 action majors: `actions/cache@v5`, `actions/upload-artifact@v6`, `actions/download-artifact@v7`.

## The bar

- **Rule 1 — Personal apps ship to internal TestFlight only.** Export with `testFlightInternalTestingOnly` true and use an internal group (`isInternalGroup`, `hasAccessToAllBuilds`). Internal builds skip Beta App Review; internal testers must be ASC users. External testing (review, localizations, public link) happens only when Adam asks for it. See `references/asc-api.md`.
- **Rule 2 — Prove a key's team before using it.** An ASC API key is team-wide, and keys for other teams (Clara work keys) sit next to personal ones. Run `scripts/asc_check.py --team <TEAMID>` first: it lists the key's apps and reads the team from its bundle ids' `seedId`.
- **Rule 3 — The app record must exist before the first upload.** There is no create-app API (`POST /v1/apps` is 403 for every key role), so a human makes the record once in the ASC web UI. Check with `asc_check.py --bundle-id`; if it's missing, stop and ask. A missing record surfaces as export failing with "Error Downloading App Information", which looks like signing and isn't.
- **Rule 4 — Every build path has a `--no-upload` mode, and PRs use it.** A PR archives, signs and exports the `.ipa` to prove signing works, then stops. Only `main` (or a manual dispatch) uploads. A build script with no dry path gets one before it gets anything else.
- **Rule 5 — Release signs manually, Debug stays automatic.** Automatic Release signing over SSH or in CI fails with "no profiles… User interaction is not allowed". Pin `DEVELOPMENT_TEAM` in base; put `CODE_SIGN_STYLE: Manual`, `CODE_SIGN_IDENTITY: Apple Distribution` and `PROVISIONING_PROFILE_SPECIFIER` under `configs.Release`, a sibling of `base` in XcodeGen (nested inside `base` it errors "must be mapping format"). See `references/signing.md`.
- **Rule 6 — Signing lives in a dedicated keychain, rebuilt every run.** `scripts/ci-keychain.sh`: temp keychain, `security import -f pkcs12`, Apple WWDR G3 intermediate, `set-key-partition-list`. Each step exists because its absence failed: "Unknown format", 0 valid identities, codesign hanging on a prompt nobody can click.
- **Rule 7 — Never cache keychains, profiles or keys.** A cache is readable by any later workflow run on any branch, including PRs. Secrets are decoded from repo secrets into place each run and die with the runner.
- **Rule 8 — Build numbers are UTC timestamps.** `CURRENT_PROJECT_VERSION=$(date -u +%Y%m%d%H%M)` never collides with an earlier upload from any machine or branch, and needs no counter. App extensions set `CFBundleVersion` to `$(CURRENT_PROJECT_VERSION)` or the upload draws an ITMS-90473 email.
- **Rule 9 — `ITSAppUsesNonExemptEncryption` is `NO`.** Otherwise every build waits in ASC on the export-compliance question before testers can install it.
- **Rule 10 — macOS CI minutes cost 10×: keep that job minimal and upload from Linux.** The macOS job tests, archives and exports; a Linux job uploads with Transporter, since the upload is mostly waiting on Apple. Skip steps whose inputs didn't change, and cache everything that isn't a secret. Workflow: `template-apple`'s `.github/workflows/ci.yml`. Measurements in `references/ci.md`.
- **Rule 11 — Credentials have one layout and never enter a repo, a log or a chat.** Keys are `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`; per-app signing material is `~/.appstoreconnect/<app>/`, mode 600. Each team has one bundled 1Password item. Key ids, issuer ids and team ids aren't secret; save them to memory so later sessions skip 1Password. See `references/credentials.md`.
- **Rule 12 — Batch all 1Password reads into one shell invocation, by id.** Every `op` call from an agent is a separate prompt for Adam. Reference items and files by id: `op://` reads a dot in a label as a section separator, and an em dash in a name breaks the lookup.
- **Rule 13 — Secret-store writes are a committed script the human runs.** Auto mode blocks `gh secret set`, 1Password reads and streaming certs to other hosts. Don't route around it: commit the script (`scripts/set-ci-secrets.sh`, `scripts/bundle-1password.sh`) and hand Adam the one `!` command to run.
- **Rule 14 — Test on a remote host or CI, never with simulators on the dev Mac.** Simulators eat the dev Mac's RAM and load. When an app must be quiet, mute the app (a launch flag), never the host's system volume.
- **Rule 15 — To show an icon in the ASC grid, attach a build to the App Store version.** The grid shows a grey placeholder until then. `PATCH /v1/appStoreVersions/{id}/relationships/build` attaches without submitting. The icon itself is 1024×1024 and opaque: the upload rejects a missing AppIcon, and an iOS icon with transparent corners fails too.
- **Rule 16 — After upload, wait for the build before touching groups.** Poll `builds?filter[app]=…&filter[version]=<CFBundleVersion>` until `VALID` (5–15 min). Adding testers to a group before any valid build returns 409 `STATE_ERROR`.

## Scripts

`template-apple`'s `scripts/` is the canonical copy and these are byte-identical to it: change the template, then copy the files here. All take app-specific values as flags or env, never hardcoded. Python runs with `uv run`, which reads the inline deps.

| Script                 | Does                                                                         | Account writes   |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------- |
| `asc_check.py`         | Lists the key's apps and team; checks bundle id and app record exist         | none             |
| `asc.py`               | Shared client; run directly to print a bearer token for curl                 | none             |
| `register_bundle.py`   | `POST /v1/bundleIds`, skipped if the id already exists                       | bundle id        |
| `make_cert.sh`         | openssl CSR, `POST /v1/certificates`, `.p12`; `CSR_ONLY=1` for Developer ID  | certificate      |
| `make_profile.py`      | `POST /v1/profiles` (IOS/MAC/TVOS_APP_STORE), writes the `.mobileprovision`  | profile          |
| `ci-keychain.sh`       | Dedicated keychain from a p12 on stdin                                       | local keychain   |
| `bundle-1password.sh`  | Creates the team's one 1Password item (human-run)                            | 1Password item   |
| `set-ci-secrets.sh`    | One 1Password session into `gh secret set` / `gh variable set` (human-run)   | GitHub secrets   |
| `testflight.sh`        | Archive, manual-sign export, upload; `--no-upload` exports only              | TestFlight build |
| `make-icon.py`         | Opaque placeholder AppIcon (`mise run icon` in the template)                 | none             |
| `swift-test-shards.sh` | Swift Testing split across processes (MainActor-default suites run serially) | none             |

New app: the template's `SETUP.md`. Adding TestFlight to an app that predates the template: `references/credentials.md#existing-app`.

## Reference files (load on demand)

- `references/signing.md` — certificates, what an Admin key can't do, p12 and keychain details, XcodeGen signing config, forks.
- `references/asc-api.md` — endpoints and their quirks, TestFlight groups, attaching builds, App Store metadata.
- `references/ci.md` — runner, cache measurements (and the DerivedData disagreement), sharded tests, Linux Transporter.
- `references/credentials.md` — file layout, the 1Password item, the auto-mode hand-off, setup order for an app that predates the template.
- `references/macos.md` — Mac App Store without Xcode, Developer ID and notarization, Sparkle auto-update.
