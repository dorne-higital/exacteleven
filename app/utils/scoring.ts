import type { GameStatus, ResultTier } from '../../shared/types';

export function calculateTotal(pickedPlayers: Array<{ goals: number; assists: number }>): number {
    return pickedPlayers.reduce((total, player) => total + player.goals + player.assists, 0);
}

// D1: going over the target is an immediate bust (blackjack-style), not "closest wins".
export function isBust(total: number, target: number): boolean {
    return total > target;
}

export function isExactWin(total: number, target: number): boolean {
    return total === target;
}

export function getDistance(total: number, target: number): number {
    return Math.abs(target - total);
}

// League-table ladder for a non-bust, non-exact finish — worst to best is
// Relegated < Avoided relegation < Mid-table < Europa League < Champions
// League < Win (exact only, handled separately in getGameResult).
//
// Boundaries chosen empirically from scripts/simulate.ts's distance
// distribution across all 7 formations x both strategies (65,046 finished
// games): min=1 p10=34 p25=85 p40=138 median=173 p60=210 p75=271 p90=351
// p95=396 max=508. Distances run much larger than the old WIN_TOLERANCE
// (±20) because the win condition is exact-only now — "finished" covers the
// entire rest of the outcome space, not just a narrow near-miss band.
//
// Mapped onto that real distribution (rounded to clean numbers):
//   championsLeague  <= 35   (~p10)  — the closest ~10%, a genuine near-miss
//   europaLeague     <= 85   (~p25)  — next ~15%
//   midTable         <= 200  (~p58)  — next ~33%, the largest single band —
//                                      "unremarkable middling finish" is
//                                      supposed to be the common case
//   avoidedRelegation <= 350 (~p90)  — next ~32%
//   relegated       otherwise        — the worst ~10%, reserved for finishes
//                                      further out than 90% of all finishes
const TIER_BOUNDARIES: ReadonlyArray<{ tier: ResultTier; maxDistance: number }> = [
    { tier: 'championsLeague', maxDistance: 25 },
    { tier: 'europaLeague', maxDistance: 75 },
    { tier: 'midTable', maxDistance: 150 },
    { tier: 'avoidedRelegation', maxDistance: 300 },
    { tier: 'relegated', maxDistance: Infinity },
];

export function tierForDistance(distance: number): ResultTier {
    const match = TIER_BOUNDARIES.find((boundary) => distance <= boundary.maxDistance);

    // Unreachable — the last boundary is Infinity — but keeps the return
    // type non-optional without a non-null assertion.
    return match?.tier ?? 'relegated';
}

// The full ranked ladder including the win case, worst to best — used by the
// stats feature's "best result ever" tracking (bust isn't part of this
// ladder, same as it isn't one of the 5 finished tiers).
export type Outcome = ResultTier | 'champion';

const OUTCOME_ORDER: readonly Outcome[] = [
    'relegated', 'avoidedRelegation', 'midTable', 'europaLeague', 'championsLeague', 'champion',
];

function outcomeRank(outcome: Outcome): number {
    return OUTCOME_ORDER.indexOf(outcome);
}

export function isBetterOutcome(candidate: Outcome, current: Outcome | null): boolean {
    return current === null || outcomeRank(candidate) > outcomeRank(current);
}

export interface GameResult {
    status: GameStatus;
    /** Set only when status === 'finished'. */
    tier: ResultTier | null;
}

// The result only resolves once every slot is filled (or the moment a bust
// happens, which can end the game early). Bust (D1, unchanged) always wins
// over everything else. Otherwise: an exact match is the only win (the
// "Champion"); anything else that finishes without busting lands on the
// league-table ladder by distance from target.
export function getGameResult(total: number, target: number, filledSlots: number, totalSlots: number): GameResult {
    if (isBust(total, target)) {
        return { status: 'bust', tier: null };
    }

    if (filledSlots < totalSlots) {
        return { status: 'playing', tier: null };
    }

    if (isExactWin(total, target)) {
        return { status: 'won', tier: null };
    }

    return { status: 'finished', tier: tierForDistance(getDistance(total, target)) };
}
