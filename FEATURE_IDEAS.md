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

(GTM already tracks a `share` event, so there's a hook to build on)

- **Image share card** — render the result (score, star man, formation) to a canvas/PNG instead of just text; image cards get far more engagement on socials than plain text.
- **Challenge-a-friend link** — encode the formation + target in a share URL so a friend plays the exact same puzzle and you compare results. No backend required, just URL params.
- **Achievement unlock share** — a shareable card for the moment a badge unlocks (SVG artwork already exists).

## Feel / character

- **Sound effects** — light audio cues on reveal/win/bust, respecting a mute toggle (same pattern as the existing `prefers-reduced-motion` handling).
- **Reveal micro-copy** — a small bank of flavor lines for the reveal moment (cheeky text for a bust vs. a near-miss vs. an exact win), cycled randomly.

## Bigger lifts (need a backend/DB)

- **Global leaderboard** for the daily challenge — needs a real backend (D1/Supabase/etc.), a step up from the current architecture.
- **Accounts / cloud sync** — so stats/achievements survive a device change instead of living only in `localStorage`.
