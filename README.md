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
