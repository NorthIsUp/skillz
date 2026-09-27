# Signing

## What an Admin (or App Manager) API key can and can't do

| Can (API)                                                                  | Can't (a human, once)                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Register bundle ids (`POST /v1/bundleIds`)                                 | Create the app record (web UI; `POST /v1/apps` is 403)             |
| `DISTRIBUTION`, `DEVELOPMENT`, `MAC_INSTALLER_DISTRIBUTION` certs from CSR | Developer ID certs (403, Account Holder only)                      |
| `IOS_APP_STORE`, `MAC_APP_STORE`, `TVOS_APP_STORE` profiles                | Register app groups (use `-allowProvisioningUpdates`, below)       |
| Metadata, screenshots, price, availability, age rating, attach builds      | App Privacy labels (web only); delete an app (not possible at all) |

## Certificates, headless

`scripts/make_cert.sh <app-dir> DISTRIBUTION`: openssl key + CSR, `POST /v1/certificates`, decode
`certificateContent` (base64 DER) to `.cer`, then `.p12` with a random password in `p12.pass`.

- **`-legacy` on the p12.** The Clip session hit `security import` rejecting an OpenSSL 3 default p12.
  On macOS 26.7 with OpenSSL 3.6.3, a default p12 imported fine (checked while writing this skill).
  `-legacy` imports on both, so the script always uses it with OpenSSL 3; `/usr/bin/openssl` is
  LibreSSL, which has no `-legacy` flag and doesn't need it.
- **Developer ID.** Run with `CSR_ONLY=1`, have the Account Holder upload the `.csr` at
  developer.apple.com, then confirm the downloaded `.cer` belongs to your key before using it:

  ```sh
  diff <(openssl x509 -inform DER -in devid.cer -noout -pubkey) <(openssl pkey -in dist.key -pubout)
  ```

- **Which identities the keychain needs.** Manual Release (Rule 5) archives and exports with Apple
  Distribution alone: one p12. An automatic-signing archive needs an Apple Development identity too,
  and export still needs Distribution, so that keychain carries both p12s (run `ci-keychain.sh` twice).

## Keychain (`scripts/ci-keychain.sh`)

| Step                                             | Failure without it                                               |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `security import -f pkcs12`                      | "Unknown format in import"                                       |
| Import `AppleWWDRCAG3.cer`                       | Identity imports, `find-identity -v` shows 0 valid               |
| `set-key-partition-list -S apple-tool:,apple:,…` | codesign waits on a GUI prompt; SSH and CI hang                  |
| `-T /usr/bin/codesign -T /usr/bin/productbuild`  | Same prompt, for the tool that wasn't listed                     |
| `list-keychains -d user -s <kc> login…`          | Xcode doesn't search the keychain; login stays so Debug works    |
| `unlock-keychain` before each build              | "User interaction is not allowed" once the 6 h lock timer passes |

The keychain password is random, generated once into `~/.appstoreconnect/<keychain>.pass`.

## Profiles

`scripts/make_profile.py <bundle-id> --name "<App> App Store" --cert-id <dist.id> --out <file>`.
The API returns the profile as base64 `profileContent`; decoded, that's the `.mobileprovision`.
Its `name` is what `PROVISIONING_PROFILE_SPECIFIER` and `ExportOptions.plist` refer to. In CI it
goes in `~/Library/Developer/Xcode/UserData/Provisioning Profiles/`.

A bundle id registered as `MAC_OS` comes back as `UNIVERSAL`; that's expected.

## XcodeGen

```yaml
settings:
  base:
    DEVELOPMENT_TEAM: "ABCDE12345"
    CODE_SIGN_STYLE: Automatic # Debug, on dev machines
targets:
  MyApp:
    settings:
      base:
        INFOPLIST_KEY_ITSAppUsesNonExemptEncryption: NO
      configs: # sibling of base; nested inside base it's "must be mapping format"
        Release:
          CODE_SIGN_STYLE: Manual
          CODE_SIGN_IDENTITY: Apple Distribution
          PROVISIONING_PROFILE_SPECIFIER: MyApp App Store
```

## Automatic provisioning where the API falls short

`xcodebuild -allowProvisioningUpdates -authenticationKeyPath … -authenticationKeyID … -authenticationKeyIssuerID …`
registers bundle ids, app groups and profiles on its own. It's the only headless way to register an
app group. `scripts/testflight.sh` passes these flags for that reason, even though Release is manual.

## Xcode 27 build errors

- A dependency with `IPHONEOS_DEPLOYMENT_TARGET` below 15 is a hard error: override it on the
  `xcodebuild` command line rather than editing the submodule.
- `UIRequiredDeviceCapabilities` of `armv7` is rejected: use `arm64`.

## Forking someone's app to ship under your team

Rewrite the bundle id, team and app group everywhere: entitlements, Info.plist, and runtime
lookups in code (`UserDefaults(suiteName:)`, container URLs). Drop deprecated capabilities such as
inter-app audio. App names are globally unique across the store ("Clip" was taken, so the record is
"Clip — NorthIsUp"); `CFBundleDisplayName` is what shows on the home screen. GitHub disables Actions
on forks: `gh api -X PUT repos/<owner>/<repo>/actions/permissions -F enabled=true`.
