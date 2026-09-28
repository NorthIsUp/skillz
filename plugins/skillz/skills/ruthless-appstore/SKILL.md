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
  and "make a profile".
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
- **Rule 10 — macOS CI minutes cost 10×: keep that job minimal and upload from Linux.** The macOS job tests, archives and exports; a Linux job uploads with Transporter, since the upload is mostly waiting on Apple (when Transporter refuses the `.ipa`, upload from macOS with `xcodebuild` and keep the processing wait on Linux). Tests that cost minutes (XCUITest) belong in pre-push or a manual workflow, not the ship path. Skip steps whose inputs didn't change, and cache everything that isn't a secret. Template: `scripts/testflight.yml`. Measurements in `references/ci.md`.
- **Rule 11 — Credentials have one layout and never enter a repo, a log or a chat.** Keys are `~/.appstoreconnect/private_keys/AuthKey_<KEYID>.p8`; per-app signing material is `~/.appstoreconnect/<app>/`, mode 600. Each team has one bundled 1Password item. Key ids, issuer ids and team ids aren't secret; save them to memory so later sessions skip 1Password. See `references/credentials.md`.
- **Rule 12 — Batch all 1Password reads into one shell invocation, by id.** Every `op` call from an agent is a separate prompt for Adam. Reference items and files by id: `op://` reads a dot in a label as a section separator, and an em dash in a name breaks the lookup.
- **Rule 13 — Secret-store writes are a committed script the human runs.** Auto mode blocks `gh secret set`, 1Password reads and streaming certs to other hosts. Don't route around it: commit the script (`scripts/set-ci-secrets.sh`, `scripts/bundle-1password.sh`) and hand Adam the one `!` command to run.
- **Rule 14 — Test on a remote host or CI, never with simulators on the dev Mac.** Simulators eat the dev Mac's RAM and load. When an app must be quiet, mute the app (a launch flag), never the host's system volume.
- **Rule 15 — To show an icon in the ASC grid, attach a build to the App Store version.** The grid shows a grey placeholder until then. `PATCH /v1/appStoreVersions/{id}/relationships/build` attaches without submitting. The icon itself is 1024×1024 and opaque: the upload rejects a missing AppIcon, and an iOS icon with transparent corners fails too.
- **Rule 16 — After upload, wait for the build before touching groups.** Poll `builds?filter[app]=…&filter[version]=<CFBundleVersion>` until `VALID` (5–15 min). Adding testers to a group before any valid build returns 409 `STATE_ERROR`; testers from another app's group are invited by email, never linked by id.

## Scripts

All take app-specific values as flags or env, never hardcoded. Python runs with `uv run`, which reads the inline deps.

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
| `testflight.yml`       | Workflow template: macOS export, Linux Transporter upload, caches            | TestFlight build |
| `swift-test-shards.sh` | Swift Testing split across processes (MainActor-default suites run serially) | none             |

First-time setup for a new app, in order: `references/credentials.md#new-app`.

## Reference files (load on demand)

- `references/signing.md` — certificates, what an Admin key can't do, p12 and keychain details, XcodeGen signing config, forks.
- `references/asc-api.md` — endpoints and their quirks, TestFlight groups, attaching builds, App Store metadata.
- `references/ci.md` — runner, cache measurements (and the DerivedData disagreement), sharded tests, Linux Transporter.
- `references/credentials.md` — file layout, the 1Password item, the auto-mode hand-off, new-app setup order.
- `references/macos.md` — Mac App Store without Xcode, Developer ID and notarization.
