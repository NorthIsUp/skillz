# Credentials

## Layout on disk

```text
~/.appstoreconnect/                    # on Adam's Mac: a symlink to "~/src/Apple Developer Eratta" (quote it)
  private_keys/AuthKey_<KEYID>.p8      # xcodebuild, altool and Transporter all look here
  <keychain>.pass                      # random password for the CI keychain (ci-keychain.sh)
  <app>/                               # per app, mode 600, from make_cert.sh and make_profile.py
    dist.key dist.csr dist.cer dist.p12 dist.id p12.pass
    <App>.mobileprovision
```

Nothing under here is ever committed, printed or pasted into chat. Key ids, issuer ids, team ids,
certificate ids and 1Password item ids aren't secret: keep them in memory and in the workflow's
repo variables.

## The 1Password item

One "API Credential" item per team, made by `scripts/bundle-1password.sh`:

| Label          | Type      | Holds                        |
| -------------- | --------- | ---------------------------- |
| `team id`      | text      | team id                      |
| `issuer id`    | text      | ASC issuer id                |
| `key id`       | text      | ASC key id                   |
| `cert id`      | text      | distribution certificate id  |
| `p12 password` | concealed | the `.p12` password          |
| `p8`           | file      | `AuthKey_<KEYID>.p8`         |
| `p12`          | file      | distribution `.p12`          |
| `profile`      | file      | App Store `.mobileprovision` |

- Labels and attachment names contain no dots: `op://` treats a dot as a section separator.
- Address the item by vault id and item id, and files by file id. An em dash in a title breaks
  `op://` name lookups.
- The item is per team but a profile is per app. A second app's profile is one more attachment
  with a dot-free name (say `profile-clip`); pass `PROFILE_LABEL=profile-clip` to both scripts.
- Sensitive values go in through a JSON template, not assignment statements, which are visible in `ps`.

## Why a human runs the secret scripts

Auto mode blocks `gh secret set`, 1Password reads, and streaming certificates to another host. Each
`op` call from an agent is also its own approval prompt. So the agent commits the script and hands
Adam one command:

```sh
! <skill-dir>/scripts/set-ci-secrets.sh <vault-id> <item-id> <owner/repo>
```

Inside that one invocation the script reads the item once, pulls the three files through a private
`mktemp -d` that is deleted on exit, and sets `ASC_KEY_P8`, `P12_BASE64`, `P12_PASSWORD`,
`PROFILE_BASE64` plus the `ASC_KEY_ID`, `ASC_ISSUER_ID`, `TEAM_ID` variables.

## New app

Env for all of these: `ASC_KEY_ID`, `ASC_ISSUER_ID` (from memory, not 1Password).

1. `uv run asc_check.py --team <TEAMID>`: right key.
2. `uv run register_bundle.py <bundle-id> --name <Name>`.
3. Human: create the app record in ASC (asc-api.md, "Before the first upload"). Then
   `uv run asc_check.py --bundle-id <bundle-id>` exits 0.
4. `make_cert.sh ~/.appstoreconnect/<app> DISTRIBUTION`, unless the team's distribution cert already
   exists (there's a per-team limit; reuse its p12 from the 1Password item).
5. `uv run make_profile.py <bundle-id> --name "<App> App Store" --cert-id $(cat ~/.appstoreconnect/<app>/dist.id) --out ~/.appstoreconnect/<app>/<App>.mobileprovision`.
6. Human: `! bundle-1password.sh …` (new team) and `! set-ci-secrets.sh …` (every repo).
7. Copy `testflight.yml` into `.github/workflows/`, and `testflight.sh`, `ci-keychain.sh`,
   `swift-test-shards.sh` into `scripts/`; open a PR and watch it
   export without uploading (Rule 4). Merge; `main` uploads.
