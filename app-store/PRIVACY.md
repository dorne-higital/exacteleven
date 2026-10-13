# App Privacy answers (App Store Connect → App Privacy)

What the iOS app collects, for Apple's "nutrition label". Keep this in step with
`ios/App/App/PrivacyInfo.xcprivacy` and the privacy policy page.

## Current state (v1 as built)

- **No tracking.** No IDFA, no AdSupport, no ad SDKs, no App Tracking Transparency prompt.
  `NSPrivacyTracking` is `false` in the privacy manifest.
- **No ads, no Buy Me a Coffee** in the app build (guideline 3.1.1).
- **No accounts.** Stats, streaks, achievements and any in-progress game stay on the
  device (web view `localStorage`, plus Capacitor Preferences / `UserDefaults` if the
  stats mirror ships).
- **Server calls:** the app calls `https://exacteleven.co.uk/api/*` for draws, reveals,
  the daily and challenges. Those requests carry game parameters only (formation,
  slot, a random per-game id); no personal data or device identifiers.
- **No crash or error reporting** is sent anywhere today. If client error logging is
  added later, that is "Diagnostics → Other Diagnostic Data, not linked, not tracking".

### Answer if the app ships with NO analytics (as Footballdle does)

> **Do you or your third-party partners collect data from this app?** → **No**

The label then reads **"Data Not Collected"**.

## Pending decision: analytics in the app

`trackEvent()` stays the one API for every event. On the web it goes to GTM/GA4 as
today. For the app there are two options (see the architecture plan, section 6.5):

1. **No-op in the app** (Footballdle's choice). Answers above stand.
2. **Firebase Analytics linked to the same GA4 property as an iOS app stream**, with
   IDFA / AdSupport *not* linked and Google Signals off. Then answer:

   > Do you collect data? → **Yes**

   | Data type | Collected | Linked to the user's identity | Used for tracking | Purpose |
   |---|---|---|---|---|
   | Usage Data → **Product Interaction** | Yes | **No** | **No** | Analytics |
   | Identifiers → **Device ID** (Firebase app-instance id) | Yes | **No** | **No** | Analytics |
   | Diagnostics → Other Diagnostic Data | Optional | No | No | Analytics / App Functionality |

   and add to `PrivacyInfo.xcprivacy` → `NSPrivacyCollectedDataTypes` the matching
   `NSPrivacyCollectedDataTypeProductInteraction` and `NSPrivacyCollectedDataTypeDeviceID`
   entries (linked: false, tracking: false, purpose: Analytics). Firebase ships its own
   privacy manifest for its required-reason APIs.

   **Do not** run GTM inside the app web view: the `capacitor://localhost` page URL and
   custom-scheme cookies make sessions unreliable, and if Google Signals or ads features
   are on in the container that counts as tracking and needs the ATT prompt.

## Later (not in v1)

When these land, add them here and to the label:

- **In-app purchases (RevenueCat):** Purchases → **Purchase History**, not linked, not
  tracking, App Functionality. RevenueCat uses an anonymous app user id.
- **Game Center:** Apple's own service; no extra label entry needed for leaderboards.
- **iCloud key-value backup:** stays in the user's own iCloud; no label entry needed.

## Privacy manifest (`ios/App/App/PrivacyInfo.xcprivacy`)

- `NSPrivacyTracking`: false
- `NSPrivacyCollectedDataTypes`: empty (update per the decision above)
- `NSPrivacyAccessedAPITypes`: `UserDefaults` with reason `CA92.1` (app-only data,
  used by Capacitor Preferences and the native plugins)
