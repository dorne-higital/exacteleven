# Feature ideas (backlog)

Notes from a brainstorm session, kept for reference. Nothing here is committed to — pick one and say "start with X" when ready.

All ideas below assume the current architecture (client-only, stats/achievements in `localStorage`, no backend) unless flagged otherwise.

## Retention & replayability

- **Daily Challenge** — one deterministic formation + target per calendar day (seed off the date, no backend needed), same puzzle for everyone. Pairs naturally with a Wordle-style share grid and a streak stat/achievement tier.
  - **Status: Phase 1 shipped.** `/daily` — preset formation, 2–3 slots pre-filled, and a rotating daily objective instead of always "hit the formation number exactly" (`exact` / `over` / `under` / `allUnder`, see `shared/daily.ts`). Fully deterministic per calendar date, no backend. Win/loss streak + best-streak achievements (`dailyStreak` category, 7 badges) are live in the Stats dialog.
  - **Known limitation, by design:** only the formation/objective/pre-filled slots are identical for every player each day — the remaining slots' live draws are still random per player (reuses the classic `/api/draw` flow unchanged). This is fine for the current single-player framing, but a future **global leaderboard** (see below) would need fully puzzle-identical draws first — that needs a canonical fill-order precompute, deliberately not built yet.
  - **Phase 2 (not started, deferred on purpose):** for a given slot, offer a choice of 3 named-but-hidden-stat players — 2 whose real stat would keep the day's objective achievable, 1 "trap" that wouldn't — instead of a blind random draw. Needs a small constraint-solver step to guarantee a generated day is actually winnable before it ships; bigger lift than phase 1, revisit now that phase 1 is live.
- **Season/era filters** — restrict the player pool to a single season (e.g. "2022/23 only") for variety once the full 2016/17-onward pool gets stale for regulars.

## Social / shareability

(GTM now forwards every custom event — including everything below — to GA4 via one alias-matched trigger/tag; new events just need adding to that trigger's name list, no new GTM tag required.)

- **Image share card** — **Status: Shipped.** `app/utils/share-card.ts` renders the result (score, star man, formation) to a canvas/PNG, reading live theme CSS variables so the exported image matches whichever theme (Match Programme/Dugout Dark) the visitor is on. "Share image" button in `ResultPanel.vue` — native share sheet on mobile, `<a download>` fallback on desktop. Reused as-is for the achievement-unlock share below.
- **Challenge-a-friend link** — **Status: Shipped, grew beyond the original idea.** Originally scoped as "encode formation + target in a URL so a friend beats your score" — after feedback, became a full challenge builder instead: `CreateChallengeDialog.vue` lets you pick any formation, any objective mode, and lock in up to 3 players' slots before generating a link; `/challenge` decodes and plays it back identically for whoever opens it. Same "config-is-the-seed" trick as Daily Challenge (no backend, no stored IDs — the URL's own query params are the puzzle's identity). A custom challenge's result deliberately doesn't feed classic stats or the Daily streak. Tracked end-to-end: `challenge_created` (link generated) → `challenge_link_shared` (actually sent, share vs. copy) → `challenge_link_opened` (friend lands on it) → `challenge_start`/`challenge_resume` → `challenge_over`.
- **Achievement unlock share** — **Status: Shipped.** New non-modal toast (`AchievementToast.vue`) fires the instant a badge unlocks — deliberately not another `CenteredDialog`, so it never stacks on top of the pick-reveal dialog at the exact moment a game-winning pick also unlocks a badge. Has its own Share button using the same canvas renderer as the image share card above. One-time silent backfill on load so an existing player doesn't get flooded with toasts for badges they already had before this shipped.

## Feel / character

- **Reveal micro-copy** — **Status: Shipped.** `app/utils/reveal-flavor.ts` — a small bank of flavor lines for bust / win / close-call moments, shown under the revealed number in `PlayerChoiceDialog.vue`. Unified across every objective type (`exact`/`over`/`under`/`allUnder`) via one "distance from whichever ceiling currently matters" concept, so a "close" line only fires on a genuine near-miss, not every routine pick.

## Bigger lifts (need a backend/DB)

- **Global leaderboard** for the daily challenge — needs a real backend (D1/Supabase/etc.), a step up from the current architecture.
- **Accounts / cloud sync** — so stats/achievements survive a device change instead of living only in `localStorage`.
