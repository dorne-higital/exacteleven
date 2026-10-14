# iOS App Store setup

The iOS app is the same Nuxt code as the website, wrapped in [Capacitor](https://capacitorjs.com) 8.
It's built in the cloud by [Codemagic](https://codemagic.io), so no local Xcode is needed.
It follows the same setup as Footballdle.

## How it fits together

| Piece | What it is |
|---|---|
| `APP_TARGET=ios` | Build flag in `nuxt.config.ts` (`isApp`). Produces a client-only SPA (`ssr: false`, `nuxt generate`) with no GTM, Buy Me a Coffee, sitemap or nuxt-security |
| `runtimeConfig.public.apiBase` | The app has no server of its own; every API call goes through `apiFetch` to `https://exacteleven.co.uk/api`. API changes must stay **additive** so older app builds keep working |
| `capacitor.config.ts` | App ID (`uk.co.exacteleven.app`), name (`Exact XI`), splash, and where the web build lives (`.output/public`) |
| `ios/` | The native Xcode project (Swift Package Manager, no CocoaPods). Committed to git. `ios/App/App/public` and `capacitor.config.json` are generated, so they're ignored |
| `ios/App/App/App.entitlements` | Associated Domains (`applinks:exacteleven.co.uk`) so challenge links open the app, Game Center, and iCloud key-value storage (`$(TeamIdentifierPrefix)$(CFBundleIdentifier)`) |
| `ios/App/App/GameCenterPlugin.swift`, `ICloudBackupPlugin.swift` | Our own native plugins (copied from Footballdle), registered in `MainViewController.swift`, which `SceneDelegate.swift` uses as the root view controller |
| `app/utils/game-center.ts`, `app/plugins/game-center.client.ts` | Game Center sign-in on launch, `submitStatsToGameCenter(stats)` after each game, `showLeaderboards()`; all no-ops on the website |
| `app/plugins/icloud-backup.client.ts`, `app/utils/icloud-backup.ts` | Backs up stats, achievement caches, the boost bank and theme choice to iCloud; a restore never lowers stats or the bank |
| `app/composables/usePurchases.ts`, `app/plugins/purchases.client.ts`, `app/utils/appStore.ts` | In-app purchases through RevenueCat (`@revenuecat/purchases-capacitor`): Pro, boost packs, Kit Bag, tips. Product IDs and entitlements live in `appStore.ts`. Switched off on the website and when `REVENUECAT_APPLE_KEY` is unset |
| `app/components/ShopSheet.vue`, `app/pages/settings.vue` | The shop (app only) and Settings (Appearance on both; Kit Bag, Purchases, Restore, Leaderboards and Haptics in the app) |
| `ios/App/App/PrivacyInfo.xcprivacy` | Apple's required privacy manifest |
| `app/plugins/native.client.ts` | App-only setup: status bar colour follows the theme, hides the splash, opens universal links in-app |
| `app/utils/haptics.ts` | `haptics.tap()/select()/success()/error()`; does nothing on the website |
| `codemagic.yaml` | Cloud build: install → build web → sync → sign → upload to TestFlight |
| `app-store/` | Listing copy (`LISTING.md`) and App Privacy answers (`PRIVACY.md`) |

The website build (`yarn build` on Netlify) is unchanged.

### Commands

```bash
yarn dev          # normal web dev, which is where 90% of the work happens
yarn dev:app      # web dev server with the app flag on (SPA, no GTM/BMC)
yarn build:app    # app bundle into .output/public
yarn cap:sync     # build:app + copy into the iOS project
yarn ios:open     # open the project in Xcode (needs full Xcode, not just the CLI tools)
```

---

## Your setup checklist

Do these in order. Steps 1–6 get a build onto your phone. If you already did steps 1, 4
and 8 for Footballdle, they carry over (same developer account, same API key can be reused).

### 1. Apple Developer Program (£79 / $99 a year)

Already done for Footballdle. Same account, nothing to do.

### 2. Register the Bundle ID

[developer.apple.com/account](https://developer.apple.com/account) → **Certificates, IDs & Profiles** → **Identifiers** → **+**

- Type: **App IDs** → **App**
- Description: `Exact XI`
- Bundle ID: **Explicit**, `uk.co.exacteleven.app` (must match `capacitor.config.ts` exactly;
  it can never be changed after the first upload)
- Capabilities: tick **Associated Domains**, **Game Center** and **iCloud** (In-App Purchase
  is on by default). For iCloud, Xcode-managed signing would ask about containers; here
  nothing else is needed, because the app only uses iCloud **key-value storage**
  (`com.apple.developer.ubiquity-kvstore-identifier`), not CloudKit or iCloud Documents.
  If the portal asks, pick **Compatible with Xcode 5** / key-value storage and leave
  CloudKit containers empty.

Note your **Team ID** (top right of the developer portal, 10 characters). The website
needs it for universal links (step 9).

### 3. Create the app in App Store Connect

[appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**

- Platform: iOS
- Name: `Exact XI` (backup: `Exact XI: Football Line-up`)
- Primary language: English (UK)
- Bundle ID: pick `uk.co.exacteleven.app`
- SKU: anything, e.g. `exacteleven-ios`

Then go to **App Information** and copy the numeric **Apple ID** (e.g. `6741234567`).
Put it in `codemagic.yaml` in place of `APP_STORE_APPLE_ID: 0000000000`.

### 4. App Store Connect API key (lets Codemagic sign and upload)

You can reuse Footballdle's key. To make a new one:
App Store Connect → **Users and Access** → **Integrations** → **App Store Connect API** → **Team Keys** → **+**

- Name: `Codemagic`, Access: **App Manager**
- Download the `.p8`. **You can only download it once.** Never commit it.
- Note the **Issuer ID** and the **Key ID**.

### 5. Codemagic

1. In Codemagic, **Add application** → the `exacteleven` GitHub repo → it picks up `codemagic.yaml`.
2. **Team settings → Integrations → Developer Portal → Manage keys**
   - Add (or reuse) a key, named exactly **`Exact XI ASC`**. That's what `codemagic.yaml` refers to;
     if you reuse Footballdle's key, change `app_store_connect:` in `codemagic.yaml` to its name instead.
3. **Team settings → codemagic.yaml settings → Code signing identities**
   - **iOS certificates**: the Apple Distribution certificate from Footballdle works for every app on the account
   - **iOS provisioning profiles** → fetch the **App Store** profile for `uk.co.exacteleven.app`
     (create it under Certificates, IDs & Profiles → Profiles if it isn't listed).
     Create it **after** ticking Associated Domains, Game Center and iCloud in step 2, or the
     build fails on entitlements. If the profile already existed before those were ticked,
     edit it in the portal (or delete it) and fetch it again so it picks them up.
4. No secret environment variables are needed. `NUXT_PUBLIC_API_BASE` (the live site) and
   `REVENUECAT_APPLE_KEY` (RevenueCat's public Apple key, `appl_…`) are set in `codemagic.yaml`.
   Without the key the app builds fine but the shop says purchases aren't set up.

Builds only run when you start them manually, so pushes don't eat free build minutes.

### 6. First build → your phone

1. Codemagic → Exact XI → **Start new build** → branch `app-build` (or `main` once merged) → workflow **iOS → TestFlight**.
2. About 10–20 minutes, then App Store Connect processes it for another 5–30.
3. App Store Connect → **TestFlight** → **Internal Testing** → create a group and add yourself.
4. Install from the **TestFlight** app on your iPhone.

The build also fails on purpose if the app bundle has no self-hosted fonts or contains
raw player stats; both are checked in the "Check the app bundle" step.

### 7. App icon and splash

The project has a **placeholder** icon and splash (the XI mark on the Bib & Board dark
green, `#0b1410`). Replace them once the new look is final; the icon can't change without
a new build.

- Icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`, **1024×1024 PNG,
  no transparency, no rounded corners** (Apple rounds them). Optional dark and tinted
  variants, as Footballdle has.
- Splash: the three `splash-2732x2732*.png` files in `Splash.imageset`, 2732×2732, with the
  logo small in the centre (it's cropped to fill the screen).

### 8. Screenshots

- **6.9" iPhone (1320×2868)** is the only required size. Take them from TestFlight on a big
  iPhone, or from a simulator.
- The project allows iPad (like Footballdle), so App Store Connect will also ask for
  **13" iPad** screenshots. If you'd rather ship iPhone-only, say so and the project's
  device family gets switched to iPhone.
- No league names, club crests or league logos in the screenshots (guideline 5.2).
- **In-app purchase review screenshots:** every product (`xpro`, `xb5`, `xb15`, `xb40`, `xkit`,
  `xts`, `xtm`, `xtl`) needs one review screenshot in App Store Connect → the product →
  **Review Information** before it can be submitted. A screenshot of the shop sheet showing that
  item (any size from the list above) is enough; one shop screenshot can be reused for several.
  Add a review note such as "Open the shop from Settings → Open shop, or from Get boosts on the
  Reroll/Hint buttons in Classic". New products go in with the first app version that uses them
  (tick them under **In-App Purchases** on the version page).

### 9. Universal links (challenge links open the app)

The app is ready for them; the website needs one file. Create
`public/.well-known/apple-app-site-association` (no file extension) (Team ID 3XPH3J87EQ, already in the repo):

```json
{"applinks":{"details":[{"appIDs":["3XPH3J87EQ.uk.co.exacteleven.app"],"components":[{"/":"/challenge*"},{"/":"/daily"}]}]}}
```

It must be served as `application/json` over HTTPS with no redirect. Check with
`curl -I https://exacteleven.co.uk/.well-known/apple-app-site-association` after deploying.
Until it's live, links simply keep opening in Safari.

### 10. Game Center and iCloud backup

**Capabilities** (one-off): the Bundle ID needs **Game Center** and **iCloud** ticked (step 2),
and the App Store profile must be regenerated after ticking them (step 5). The entitlements
file already asks for both:

```xml
<key>com.apple.developer.game-center</key>
<true/>
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)$(CFBundleIdentifier)</string>
```

If a build fails with "Provisioning profile doesn't include the com.apple.developer.game-center
(or ubiquity-kvstore-identifier) entitlement", the profile is older than the capability: refetch it.

**Leaderboards** (already created in App Store Connect → the app → **Services → Game Center**,
all **Classic**, **Integer**, **high to low**; also make sure Game Center is switched on for each
app version you submit):

| Leaderboard ID | What it ranks |
|---|---|
| `exactxi.daily.best_streak` | Best Daily win streak (`stats.bestDailyStreak`) |
| `exactxi.classic.exact_wins` | Exact Classic wins with no banked boost or Pro extra (`stats.unassistedWins`) |
| `exactxi.classic.best_run` | Best run of consecutive exact Classic wins (`stats.bestExactRun`) |

The IDs live in `app/utils/appStore.ts` (`LEADERBOARD_IDS`) and can never change. The app signs
players in quietly on launch (GameKit shows its own banner), catches the boards up with their
existing stats after each sign-in, and submits again after each game, only for values that went
up (remembered in `exact-xi-gc-submitted`). Assisted games never count towards the Classic boards.
No Game Center achievements yet.

**iCloud backup** uses `NSUbiquitousKeyValueStore` (1 MB, Exact XI uses a few KB). Keys backed
up: `exact-xi-stats`, `exact-xi-seen-achievements`, `exact-xi-achievement-best`,
`exact-xi-boost-bank`, `exact-xi-boost-transactions`, `exact-xi-boost-prepaid`, and the theme
choice `exact-xi-appearance` / `exact-xi-kit`.
Without the capability the store just never syncs, so nothing breaks. To test: play on one
device signed in to iCloud, delete and reinstall the app (or use a second device on the same
Apple ID); stats and boosts come back within a minute or so of launch.

### 11. In-app purchases (RevenueCat)

Already set up: products `xpro` (Pro, non-consumable), `xb5` / `xb15` / `xb40` (boost packs,
consumable), `xkit` (Kit Bag, non-consumable) and `xts` / `xtm` / `xtl` (tips, consumable, thank-you
only) in App Store Connect; entitlements `pro` (xpro) and `themes` (xpro + xkit) in RevenueCat.
The app loads products by ID (no offerings), so nothing else needs configuring in RevenueCat.

- **Boosts** are banked on the device (`exact-xi-boost-bank`) and in the iCloud backup. Apple can't
  restore consumables, so each App Store transaction is credited once (`exact-xi-boost-transactions`),
  and transactions older than the current install's record are never credited again (so Restore
  Purchases or a reinstall can't hand out boosts twice).
- **Restore Purchases** is in Settings → Purchases and at the bottom of the shop (App Review
  requires one). It brings back Pro and the Kit Bag; boosts come back via iCloud.
- **Pro and the Kit Bag are cached** (`exact-xi-pro`, `exact-xi-themes`) so they work offline
  and before RevenueCat answers.

**Testing in TestFlight (sandbox):**

1. App Store Connect → **Users and Access → Sandbox → Test Accounts** → **+** to create a sandbox
   Apple ID (any unused email address). TestFlight builds also accept your real Apple ID; either
   way **you are not charged**: TestFlight purchases are always sandbox.
2. Install the TestFlight build, open **Settings → Open shop**. Prices should show in your local
   currency. "Couldn't reach the App Store" usually means the products aren't **Ready to Submit**
   (missing review screenshot or tax/banking agreements not signed under **Business**).
3. Buy a boost pack: the bank count in Settings goes up straight away. Buy Pro: the Pro badge
   appears in Stats and extra rerolls/hints say "Pro". Buy the Kit Bag: the kits unlock.
4. Delete and reinstall, then tap **Restore purchases**: Pro / Kit Bag come back, the boost bank
   comes back from iCloud (not from the restore).
5. Ask to Buy: with a sandbox account set up for it (Settings → App Store → Sandbox Account on the
   phone), a purchase shows "Waiting for approval" and is credited once approved.
6. RevenueCat → the project → **Customers** shows each sandbox purchase (toggle "Sandbox data").

---

## Before submitting for review

- [ ] Real app icon and splash (step 7)
- [ ] Screenshots (step 8)
- [ ] Listing copy from `app-store/LISTING.md`; support URL `https://exacteleven.co.uk`
- [ ] Privacy policy URL `https://exacteleven.co.uk/privacy` (the page is in `app/pages/privacy.vue` and already covers the app; confirm the contact address and keep it current)
- [ ] App Privacy questionnaire, answers in `app-store/PRIVACY.md` (decide the analytics question first)
- [ ] Age rating questionnaire (should come out 4+)
- [ ] Export compliance is already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption = false`)
- [ ] Game Center enabled on the app version in App Store Connect, and the privacy policy /
      App Privacy answers mention Game Center and iCloud backup (step 10)
- [ ] Every in-app purchase has a review screenshot and is attached to the version (steps 8, 11);
      the Paid Apps agreement, tax and banking are active under **Business**
- [ ] Restore Purchases tried on a TestFlight build (step 11)
- [ ] Enough native features (haptics, share sheet, universal links, offline screen, then
      Game Center / purchases). Apple rejects apps that are "just a website" (guideline 4.2)
