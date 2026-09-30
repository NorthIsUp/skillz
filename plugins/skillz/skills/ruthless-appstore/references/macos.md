# macOS: Mac App Store and Developer ID

From Clip.md, which ships both ways without an Xcode project.

## Mac App Store without Xcode

- App Sandbox is mandatory.
- Entitlements need `com.apple.application-identifier` (`<TEAMID>.<bundle-id>`) and
  `com.apple.developer.team-identifier`, plus the sandbox keys.
- Embed the `MAC_APP_STORE` profile as `Contents/embedded.provisionprofile`.
- Info.plist needs `LSApplicationCategoryType`; the icon is an `.icns`.
- Sign: `codesign --options runtime --timestamp --entitlements … --sign "Apple Distribution: …"`.
- Package: `productbuild --component <App>.app /Applications --sign "3rd Party Mac Developer Installer: …" <App>.pkg`
  (the `MAC_INSTALLER_DISTRIBUTION` cert: `make_cert.sh <dir> MAC_INSTALLER_DISTRIBUTION`).
- Upload: `xcrun altool --upload-app -t macos -f <App>.pkg --apiKey <KEYID> --apiIssuer <ISSUER>`;
  altool finds the key in `~/.appstoreconnect/private_keys/`.
- An App-Store-signed app is SIGKILLed when launched locally. Sign a separate copy to run it.
- No Sparkle: the store updates the app.

## Developer ID, notarized

The Developer ID Application cert is Account Holder only (signing.md, "Certificates, headless").

1. `codesign --options runtime --timestamp --sign "Developer ID Application: …"` the app.
2. `ditto -c -k --keepParent <App>.app <App>.zip`, then
   `xcrun notarytool submit <App>.zip --key <p8> --key-id <KEYID> --issuer <ISSUER> --wait`.
3. `xcrun stapler staple <App>.app`.
4. Build the DMG from the stapled app, sign the DMG, notarize it, staple it.
5. Verify the way a user's Mac will, with quarantine set:

   ```sh
   xattr -w com.apple.quarantine "0081;$(printf %x "$(date +%s)");Safari;" <App>.app
   spctl --assess --type execute -vv <App>.app            # source=Notarized Developer ID
   spctl --assess --type open --context context:primary-signature -vv <App>.dmg
   ```

6. Publish under a fixed asset name so `releases/latest/download/<App>.dmg` is a stable link.

## Sparkle auto-update

From tsmux (Developer ID, not sandboxed, no Xcode project). A sandboxed host
needs more than this: Sparkle's XPC services exist for that case and nothing
below uses them.

- **The feed is a release asset with a fixed name.** `SUFeedURL` is
  `https://github.com/<owner>/<repo>/releases/latest/download/appcast.xml`, so the
  URL compiled into every build stays valid while the file behind it changes each
  release. Rename that asset and every installed copy silently stops seeing
  updates. Same trick as the stable `<App>.dmg` download link above.
- **SwiftPM links the xcframework but populates no bundle.** Assembling an app by
  hand means copying `Sparkle.framework` into `Contents/Frameworks` yourself, plus
  an rpath: `.unsafeFlags(["-Xlinker", "-rpath", "-Xlinker",
"@executable_path/../Frameworks"])`. Each flag needs its own `-Xlinker` — passed
  bare they reach swiftc, which fails `unknown argument: '-rpath'`.
- **Copy it with `cp -R`**, so the framework's version symlinks survive; codesign
  needs them.
- **Sign inside out:** `XPCServices/*.xpc`, `Updater.app`, `Autoupdate`, then
  `Sparkle.framework`, then the app. A signature over a bundle does not cover a
  nested executable signed after it, and notarization rejects the result.
  Verified Accepted with the framework embedded.
- **The tools ship inside the SPM artifact**, no separate download:
  `.build/artifacts/sparkle/Sparkle/bin/{generate_keys,generate_appcast,sign_update}`.
- **`generate_keys` puts the private key in the login keychain** and prints only
  the public half, which goes in Info.plist as `SUPublicEDKey` and is not secret.
  `generate_keys -x <file>` exports the private half (44 bytes) for CI. It is the
  one credential that cannot be quietly re-minted: a new key means shipping a new
  public half in a build users install by hand.
- **`generate_appcast --ed-key-file -`** reads that key from stdin, so CI needs no
  keychain. Give it `--download-url-prefix .../releases/download/v<version>/` and a
  directory holding the zip. A single-item appcast is enough — Sparkle only has to
  learn that something newer than the running build exists.
- **Set `SUEnableAutomaticChecks`** in Info.plist. Without it Sparkle asks on
  first launch whether to check automatically and does nothing until answered;
  with it users are opted in silently. The scheduled interval already defaults
  to a day, so do not also set `SUScheduledCheckInterval` to 86400.
- **Whether an update is EdDSA-signed varies, so do not assert on it.**
  `generate_appcast` can omit `sparkle:edSignature` when the archive is
  Developer ID signed and notarized, because Sparkle will verify by Apple code
  signing instead — but a CI build of the same shape still carried one.
  Validate the property that matters, "something can verify this update":
  a signature is present, _or_ `spctl --assess --type execute` accepts the app
  inside the zip. Asserting the signature exists fails on a valid feed;
  asserting it does not, ships an unverifiable one.
- **The first version containing Sparkle is the update floor.** A release cut
  before Sparkle was added has no framework and no `SU*` keys, so it can never
  offer an update — there is no "Check for Updates" item in it to click. The
  earliest end-to-end test is therefore first-Sparkle-version → the one after
  it, not the release before. Worth knowing before planning a test around
  installing the previous version.
- **An accessory (`LSUIElement`) app must `NSApp.activate()` before
  `checkForUpdates`**, or the update panel opens behind whatever is frontmost.
- Start the updater at launch — `SPUStandardUpdaterController(startingUpdater:
true, …)` — not lazily: it has to be running to do its own scheduled background
  checks, not only to answer the menu item. Where the menu sets
  `autoenablesItems = false`, mirror `updater.canCheckForUpdates` onto the item.
