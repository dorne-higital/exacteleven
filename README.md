# Exact XI

Exact XI is a lineup-guessing game for England's top-flight football since 2016/17. Pick a formation, fill all 11 slots from three hidden-stat player options at a time, and try to land your total goals + assists exactly on the formation's own number — anything else lands you somewhere on a league-table outcome ladder, from Title winners (within a few of the target) down to Relegated. There's also a Daily: the same puzzle for everyone each UK day, scored out of 1,000 (see [Daily 2.0](#daily-20)).

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
yarn sim:balance        # Classic: live draw bias + final-slot rule, 3 player models; prints the ladder shares and FORMATION_DIFFICULTY figures
yarn sim:daily          # Daily 2.0: real generator + move engine, the weekly-rhythm table below
yarn sim:daily2-sweep   # Daily 2.0: generates 3 years of puzzles, fails on any date that can't be built
yarn sim:daily:v1       # the v1 Daily / challenge-link objective values (shared/daily.ts)
```

The sims play three models: **random**, a **fan** who sees each hidden number through ±45% noise (a knowledgeable player), and an **oracle** who knows the true numbers (a ceiling).

**Classic** (`yarn sim:balance`, 4,000 games per formation and model). `/api/draw` guarantees one option per slot that keeps a win possible. On the final slot of an exact game that option used to land *exactly* on the target, which made reaching the last slot a 1-in-3 read of three names. The older "<1% exact" figure never modelled that guarantee and was stale. Now the guaranteed final option lands exactly a third of the time (`FINAL_SLOT_EXACT_CHANCE`), and otherwise lands in the **Title winners** window, 1..W under the target with W = `titleWindowFor(target)` = round(1.5% × target), 5–8 by formation (`shared/classic.ts`, `server/utils/classic-draw.ts`). If the window is empty there's no guarantee: falling back to exact there put the fan's exact rate back at 14.5%.

| Model | Exact before | Exact now | Title now | Win from the last slot (exact reachable) before → now |
|---|---|---|---|---|
| random | 8.4% | 3.1% | 6.8% | 33% → 12% |
| fan | 23.0% | 7.9% | 15.6% | 47% → 16% |
| oracle | 50.0% | 17.0% | 28.7% | 100% → 34% |

Ladder (`app/utils/scoring.ts`), by distance under the target: Title winners 1..W · Champions League ..30 · Europa League ..75 · Mid-table ..150 · Avoided relegation ..250 · Relegated beyond. Fan shares of all games: exact 7.9%, Title 15.6%, CL 4.6%, EL 12.5%, Mid 23.5%, AR 23.7%, Relegated 10.8%, bust 1.3%. Per formation (fan, exact / Title-or-better): 343 9.4 / 34.5, 352 8.8 / 32.6, 433 8.3 / 23.9, 442 8.1 / 22.8, 451 7.9 / 21.6, 532 6.5 / 14.8, 541 6.5 / 14.8 (`FORMATION_DIFFICULTY` in `app/utils/formations.ts`).

## Daily 2.0

The Daily is the same puzzle for everyone: every open slot's three options are seeded from the **UK date** (a new Daily at midnight Europe/London). The server is the date authority on web and app (`/api/app-config`'s `ukDate`); the device clock is only an offline fallback. Boosts and Pro never touch it; the archive (replaying past Dailies) is the one Pro perk, and archive games never count for streaks or the table.

**Week.** Formations rotate so every week uses all seven and no two weeks match. 2–3 outfield slots start locked (their numbers shown).

| Day | Objective | Target | Fan win (no bench) | Fan avg / median | Random win |
|---|---|---|---|---|---|
| Mon | Score over V (G+A) | floor10 of the 98th percentile of all (XI, captain) totals | 45% (46%) | 791 / 690 | 3.1% |
| Tue | Keep every player under L | L ∈ {20, 25, 30, 35, 40}; 2 "one-safe" + 2 "two-safe" danger slots | 51% (30%) | 522 / 900 | 14% |
| Wed | Land exactly on V (G+A) | the formation's number; 0.4–3% of pairs win | 4.3% (3.6%) | 581 / 618 | 1.4% |
| Thu | Stay under V (G+A) | ceil10 of the 0.2nd percentile | 53% (32%) | 571 / 900 | 13% |
| Fri | Land exactly on V goals | seeded; 0.6–3% of pairs win | 8.6% (8.5%) | 583 / 603 | 3.4% |
| Sat | Land exactly on V assists | seeded; 0.6–3% of pairs win | 8.7% (7.4%) | 563 / 603 | 3.1% |
| Sun | Land exactly on V (G+A), hardest | the formation's number; 0.05–0.4% of pairs win | 1.8% (1.7%) | 554 / 576 | 0.6% |

(`yarn sim:daily`, 20 weeks × 300 runs per day per model.) Exact days are a jackpot; the score carries them.

**Rules** (`shared/daily2-rules.ts`, run by both server and client):
- **Captain** (required, named before the final pick, can't change): their number counts double. Name an empty slot for a *blind* captain (bragging rights) or a revealed player for safety; a revealed player who'd bust you on the spot can't be named.
- **Reroll** (once, −50): the slot's fixed second set of three, the same for everyone.
- **Scouting clue** (once, −50; replaces the hint): one shown option's band, 0–10 / 11–30 / 31–60 / 61–100 / 100+. Locked while fewer than 3 slots are open.
- **The bench** (once, −100): swap one of your revealed players for that slot's mystery sub (same position, similar numbers, the same for everyone). Use it any time before the XI is complete, or straight after a bust ("use the bench or take the bust").

**Points** (out of 1,000; `scoreDaily`):

```
helps = 50·reroll + 50·clue + 100·bench
win   = 1000 − helps                                      (800..1000)
miss  = max(275, round(700 × total ÷ target) − helps)     exact and over only (275..700)
bust  = max(0, 25 × slots filled before the bust − helps) (0..250; locked slots count)
```

**Share grid** (`shareLevels`): one square per slot in formation shape, no names. Each pick is replayed with the other two options from its set (same captain, same later moves). Your pick is *best* if it scores the most, *poor* if it scores the least, otherwise *good*. Equal scores, such as every option leading to the same bust, are split by where the swapped total lands: lower on under days, higher on over days, closer to the target on exact days. Locked slots, the busting slot and empty slots get their own colours.

**Streaks** (`useStats`): the Daily streak counts days *played*, meaning any finished first attempt, win or not. Wins in a row are tracked separately. The one-off migration takes the larger of the old win streak and the played run, so no streak went down.

Any win beats any completed miss, which beats any bust. Under and all-under have no miss: finishing is the win. Example: Wednesday 4-3-3, exact 433, finishing on 401 with the clue used scores round(700 × 401 ÷ 433) − 50 = 598.

**Generation** (`server/utils/daily2-generate.ts`). Seed `daily2:{date}:{attempt}`. Each open slot gets a main three, a reroll three and a sub, with no player repeated. A DP over (total, captain placed?) checks winnability and, on exact days, the winning-pair band in under a millisecond. One exhaustive pass over the accepted puzzle (≤ 3⁹ × 9 pairs) counts the perfect XIs and finds the best XI for the full-time screen. Bump `DAILY2_GENERATOR` only with a new launch date.

**API** (all new routes; old ones unchanged). Types in `shared/daily2-types.ts`:
- `GET /api/daily/v2[?date]`: the whole puzzle up front (names, clubs, seasons, appearances; no goals or assists).
- `POST /api/daily/v2/start`: registers a run. Only the first run **started** per anonymous install id per day is ranked.
- `POST /api/pick` (`mode: 'daily'`): replays the move log against the true stats and reveals the pick with the new snapshot and win odds. `mode: 'classic'` reveals, draws the next slot and returns the odds in one round trip.
- `POST /api/daily/v2/action`: reroll, clue, captain, bench, take the bust.
- `POST /api/daily/v2/submit`: scores on the server from the move log, ranks the first run (today or yesterday), and returns the full time: best XI, perfect-XI count, your XI, everything you passed on, the share grid.
- `GET /api/daily/v2/percentile`, `/archive`, `/week` (the Sunday recap).

The ranking is honest to a point: the score is server-side, the moves must be consistent, and there's one ranked run per anonymous install per day. A fresh install id or shared answers still get round it, and the table is for fun.

**Storage** (`server/utils/daily2-store.ts`): Netlify Blobs store `exact-xi-daily` (strong consistency) on Netlify, an in-memory map in dev and tests.

| Key | Holds |
|---|---|
| `puzzle/{date}` | The whole puzzle, stats included, frozen the first time it's served, so reseeding `players.json` never rewrites a past Daily |
| `run/{date}/{installId}` | `{ runId, startedAt, submitted? }`: the ranked run and its stored result |
| `hist/{date}` | `{ n, counts[1001] }`: the day's scores |
| `week/{monday}/{installId}` | `{ scores: { [date]: score } }` |
| `weekhist/{monday}` | `{ n, counts[701] }`: week totals in tens |

Histogram writes are conditional (etag) and retried up to 5 times. "You beat N%" = scores strictly below yours ÷ (players − 1).

**Classic tokens.** The app asks for 30-minute anti-peek tokens (`long`) instead of 5 minutes; the TTL is inside the signature. An expired Classic pick through `/api/pick` gets a free fresh three for the same slot instead of an error.

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
