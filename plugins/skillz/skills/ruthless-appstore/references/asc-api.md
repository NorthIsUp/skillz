# App Store Connect API

Auth is an ES256 JWT (`iss` = issuer id, `kid` = key id, `aud` = `appstoreconnect-v1`, lifetime
at most 20 minutes). `scripts/asc.py` builds it; `uv run asc.py` prints one for curl. Pass
`curl -g` so the `filter[...]` brackets aren't read as a glob.

## Before the first upload

1. `asc_check.py --team <TEAMID>`: the key is on the team you think.
2. `register_bundle.py <bundle-id> --name <Name>`: instant, and idempotent here.
3. A human creates the app record: ASC, Apps, +, New App. The dialog lists API-registered bundle
   ids as "XC com example app" or "Xcode iOS App ID …"; that's only the label. The name must be
   unique across the whole store.
4. `asc_check.py --bundle-id <bundle-id>` exits 0.

## After upload (TestFlight)

1. Poll `GET /v1/builds?filter[app]=<appId>&filter[version]=<CFBundleVersion>` until
   `processingState` is `VALID`: 5–15 minutes.
2. Internal group, once per app: `POST /v1/betaGroups` with `isInternalGroup: true`,
   `hasAccessToAllBuilds: true`. No Beta App Review. Testers must already be ASC users.
3. Add testers only now: before any valid build exists, it's 409 `STATE_ERROR`.
   Tester records don't carry across apps: linking another app's tester ids into this app's group
   (`POST /v1/betaGroups/{id}/relationships/betaTesters`) stays 409 "Tester(s) cannot be assigned" even
   with a valid build. Invite by email instead: `POST /v1/betaTesters` with `email` (plus names) and
   `relationships.betaGroups`. Testers who joined through a public link have no email; send them the
   new app's link. Re-inviting someone already in the group is 409 too, so skip existing emails.
4. Attach the build to the App Store version so the ASC grid shows the icon:
   `PATCH /v1/appStoreVersions/{id}/relationships/build` with `{"data": {"type": "builds", "id": …}}`.
   Returns 204 with an empty body; don't parse it. It doesn't submit anything.

The grid also shows macOS and visionOS rows for an iPhone/iPad app by default. Those rows stay grey
forever because no build for those platforms will ever exist; ignore them.

## External testing (only when asked)

- Needs `betaAppLocalizations` (description, `feedbackEmail`) and `betaAppReviewDetail` (contact).
  Copy both from a sibling app over the API instead of retyping them.
- `POST /v1/betaGroups` with `publicLinkEnabled: true` creates the public link immediately; no
  build is needed for that.
- Submit with `POST /v1/betaAppReviewSubmissions` once a build is `VALID`.
- A build exported with `testFlightInternalTestingOnly` can never be offered externally. Upload a
  new build without it.

## App Store metadata quirks

| Resource     | Quirk                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Age rating   | `PATCH` needs every field, and the types are mixed: some booleans, some `"NONE"`-style strings       |
| Price        | `POST /v1/appPriceSchedules` with the prices in `included`, referenced by `"${local-id}"` ids        |
| Availability | `POST /v2/appAvailabilities` listing all 175 territories explicitly                                  |
| Screenshots  | Reserve (`POST` with file size), `PUT` each upload chunk, then `PATCH` `uploaded: true` with the MD5 |
| Mac display  | `APP_DESKTOP` screenshots are 2880×1800                                                              |
| Privacy      | App Privacy labels are web-only                                                                      |

Beta review allows one build per version train: submitting a newer build while one is in review is
422 "Another build in the same train is already in beta review". It's harmless; the approved build
opens the external group, and later builds reach it through the group.
