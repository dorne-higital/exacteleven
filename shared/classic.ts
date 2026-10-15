// Classic-mode balance constants shared by the server's draw (the final-slot
// rule in server/utils/classic-draw.ts) and the client's result ladder
// (app/utils/scoring.ts), so the two can't drift. Tuned with
// scripts/simulate.ts — see README "Balance".

/**
 * The "Title winners" window as a share of the target: finishing 1..W under
 * the target (W = titleWindowFor(target)) is the new near-miss tier just
 * below the exact jackpot. 1.5% gives W = 5 (343/352), 6 (433), 7 (442/451)
 * and 8 (532/541).
 */
export const TITLE_WINDOW_PCT = 0.015;

export function titleWindowFor(target: number): number {
    return Math.max(1, Math.round(target * TITLE_WINDOW_PCT));
}

/**
 * The final slot of an exact-objective game guarantees one option that keeps
 * the game alive, as every earlier slot does. Until this build that option
 * always landed EXACTLY on the target, which made reaching the last slot a
 * 1-in-3 read of three names. Now it lands exactly only this often; the rest
 * of the time it lands inside the Title window instead (no guarantee at all
 * if that window is empty), so the player can no longer know whether a
 * jackpot option is there.
 */
export const FINAL_SLOT_EXACT_CHANCE = 1 / 3;

/**
 * The retuned ladder's upper distance bound per tier (distance = target −
 * total for a non-bust, non-exact finish), worst tier last. titleWinners'
 * bound is per-target (titleWindowFor), so it isn't listed here.
 */
export const CLASSIC_TIER_MAX_DISTANCE = {
    championsLeague: 30,
    europaLeague: 75,
    midTable: 150,
    avoidedRelegation: 250,
} as const;
