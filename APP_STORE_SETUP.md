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
| `ios/App/App/App.entitlements` | Associated Domains (`applinks:exacteleven.co.uk`) so challenge links open the app |
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
- Capabilities: tick **Associated Domains**. (Game Center and iCloud come later with the
  purchases/leaderboards phase; In-App Purchase is on by default.)

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
     Create it **after** ticking Associated Domains in step 2, or the build fails on entitlements.
4. No secret environment variables are needed for v1. `NUXT_PUBLIC_API_BASE` is set in
   `codemagic.yaml` (the live site). RevenueCat's key arrives with the purchases phase.

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

### 9. Universal links (challenge links open the app)

The app is ready for them; the website needs one file. Create
`public/.well-known/apple-app-site-association` (no file extension) (Team ID 3XPH3J87EQ, already in the repo):

```json
{"applinks":{"details":[{"appIDs":["3XPH3J87EQ.uk.co.exacteleven.app"],"components":[{"/":"/challenge*"},{"/":"/daily"}]}]}}
```

It must be served as `application/json` over HTTPS with no redirect. Check with
`curl -I https://exacteleven.co.uk/.well-known/apple-app-site-association` after deploying.
Until it's live, links simply keep opening in Safari.

---

## Before submitting for review

- [ ] Real app icon and splash (step 7)
- [ ] Screenshots (step 8)
- [ ] Listing copy from `app-store/LISTING.md`; support URL `https://exacteleven.co.uk`
- [ ] Privacy policy URL `https://exacteleven.co.uk/privacy` (the page is in `app/pages/privacy.vue` and already covers the app; confirm the contact address and keep it current)
- [ ] App Privacy questionnaire, answers in `app-store/PRIVACY.md` (decide the analytics question first)
- [ ] Age rating questionnaire (should come out 4+)
- [ ] Export compliance is already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption = false`)
- [ ] Enough native features (haptics, share sheet, universal links, offline screen, then
      Game Center / purchases). Apple rejects apps that are "just a website" (guideline 4.2)
