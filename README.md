# Exact XI

Exact XI is a lineup-guessing game for England's top-flight football since 2016/17. Pick a formation, fill all 11 slots from three hidden-stat player options at a time, and try to land your total goals + assists exactly on the formation's own number — anything else lands you somewhere on a league-table outcome ladder, from Champions League down to Relegated.

Built with Nuxt 4, Vue 3 and TypeScript, styled with SCSS, and deployed to Cloudflare Pages via Nitro's `cloudflare-pages` preset.

Requires Node 22+ (see `.nvmrc`).

## Getting started

```bash
yarn install
yarn dev
```

## Environment variables

Copy `.env.example` to `.env` and set `NUXT_DRAW_TOKEN_SECRET` before deploying anywhere real — it signs the anti-peek tokens used by the draw/reveal API (`server/utils/draw-token.ts`) and must not be left at its dev-only default in production.

`NUXT_PUBLIC_SITE_URL` is optional — set it once the real Cloudflare Pages domain is confirmed to correct the canonical/og/sitemap URLs, which otherwise fall back to a placeholder domain in `nuxt.config.ts`.

`NUXT_RATE_LIMITER_KV_BINDING` is optional — set it to a Cloudflare KV namespace's binding name (create the namespace and bind it in the Pages project settings first) to give the `/api/draw` and `/api/reveal` rate limiter a store that's actually shared across Workers isolates. Left unset, it falls back to an in-memory store that only limits requests within a single isolate.

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

Targets Cloudflare Pages via Nitro's `cloudflare-pages` preset (`nitro.preset` in `nuxt.config.ts`). Before going live, set `NUXT_DRAW_TOKEN_SECRET` as a real environment variable in the Cloudflare Pages project settings — see [Environment variables](#environment-variables) above.
