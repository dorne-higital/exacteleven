# Exact XI

Exact XI is a lineup-guessing game for England's top-flight football since 2016/17. Pick a formation, fill all 11 slots from three hidden-stat player options at a time, and try to land your total goals + assists exactly on the formation's own number — anything else lands you somewhere on a league-table outcome ladder, from Champions League down to Relegated.

Built with Nuxt 4, Vue 3 and TypeScript, styled with SCSS, and deployed to Netlify via Nitro's `netlify` preset.

Requires Node 22+ (see `.nvmrc`).

## Getting started

```bash
yarn install
yarn dev
```

## Environment variables

Copy `.env.example` to `.env` and set `NUXT_DRAW_TOKEN_SECRET` before deploying anywhere real — it signs the anti-peek tokens used by the draw/reveal API (`server/utils/draw-token.ts`) and must not be left at its dev-only default in production.

`NUXT_PUBLIC_SITE_URL` is optional — `nuxt.config.ts`'s `site.url` already defaults to the real production domain, so this is only needed to override it (e.g. for a Netlify deploy-preview URL).

`NUXT_APP_MIN_BUILD` / `NUXT_APP_LATEST_BUILD` (web deploy, optional) feed `/api/app-config` for the iOS app's update prompt — raise `NUXT_APP_MIN_BUILD` to force older app builds to update. Both default to `0` (no minimum).

`NUXT_PUBLIC_API_BASE` (app build only, optional) points the iOS bundle's API calls somewhere other than `https://exacteleven.co.uk` — e.g. a Netlify deploy-preview URL, or empty to use the local server under `yarn dev:app`.

## Web and iOS app from one codebase

The website and the iOS app (Capacitor, same pattern as Footballdle) run the same code. `APP_TARGET=ios` at build time switches on the app build (`runtimeConfig.public.isApp`): `ssr: false`, `nuxt generate` into `.output/public`, no nuxt-security, no GTM/sitemap/robots/schema.org. Read the flag through `app/utils/platform.ts` (`isAppBuild()` for build-time differences, `isNativeApp()` before any native plugin call).

The app has no server of its own, so it calls the live site's API at `https://exacteleven.co.uk/api` cross-origin (CORS for `capacitor://localhost` is set on `/api/**` in `nuxt.config.ts`). **Every client call to `/api` must go through `apiFetch` in `app/utils/api.ts`** — never a bare `$fetch('/api/...')`, which would silently break the app.

**The API is additive-only.** Shipped app builds keep calling the same routes for months, so never remove or rename a route, a request param, or a response field, and never change what a status code means (410 = token expired, 403 = rejected token). New params must be optional with the old behavior as the default. A genuinely breaking change ships as a new route (e.g. `/api/v2/draw`) alongside the old one, which is only removed once `NUXT_APP_MIN_BUILD` excludes every build that uses it.

### App-only features

Purchases (RevenueCat: Pro, boost packs, Kit Bag, tips), Game Center leaderboards and the iCloud backup exist only in the iOS app. They live in `app/composables/usePurchases.ts`, `app/utils/game-center.ts` and `app/plugins/icloud-backup.client.ts`, and each is a no-op on the website: the RevenueCat SDK is only loaded through a dynamic import behind `isNativeApp()`, and the native Game Center / iCloud plugins are only registered inside the native shell. Boosts and Pro never touch the Daily; a game that used one is flagged `assisted` and doesn't count for the Game Center boards or `unassistedWins`. `REVENUECAT_APPLE_KEY` (set in `codemagic.yaml`) becomes `runtimeConfig.public.revenuecatAppleKey` in the app build only; unset, purchases are switched off. Settings (`/settings`) shows Appearance on both builds and adds the Kit Bag, Purchases, Leaderboards and Haptics in the app. Store setup and how to test purchases in TestFlight: `APP_STORE_SETUP.md` (sections 10 and 11).

## Data

`server/assets/players.json` is the player pool the game draws from, built from public Premier League data:

```bash
yarn seed:players   # rebuilds server/assets/players.json from FPL's public GitHub data (2016/17+)
```

This is currently an interim dataset — only the 2016/17-onward era is sourced. See the comment at the top of `scripts/seed-players.ts` for the plan to merge in an earlier historical spine.

## Balance

```bash
yarn sim:balance   # runs a large batch of simulated games and reports the outcome-tier distribution used to tune scoring.ts's thresholds
```

## Other scripts

```bash
yarn build       # production build
yarn test        # run the vitest test suite
yarn lint        # run eslint
yarn lint:style  # run stylelint
yarn typecheck   # run nuxt/vue-tsc type checking
```

## Deployment

Targets Netlify via Nitro's `netlify` preset (`nitro.preset` in `nuxt.config.ts`) — this must match wherever the site is actually hosted, since each Nitro preset builds a runtime-specific server function format that only that host can run. Before going live, set `NUXT_DRAW_TOKEN_SECRET` as a real environment variable in the Netlify site's settings — see [Environment variables](#environment-variables) above.
