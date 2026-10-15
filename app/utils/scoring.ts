import { titleWindowFor } from '#shared/classic';
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
// League < Title contenders < Win (exact only, handled separately in
// getGameResult).
//
// Retuned in DAILY2_SPEC §1.8 with scripts/simulate.ts modelling the live
// draw bias and the fairer final slot (the old boundaries came from a sim
// that modelled neither). Shares of all games, "fan" model: exact 8.2%,
// Title 15.1%, CL 4.5%, EL 12.7%, Mid 24.2%, AR 23.9%, Relegated 10.1%,
// bust 1.3%.
//   titleWinners      1..W     W = titleWindowFor(target), 5-8 by formation —
//                              "so close it hurts", a reachable top tier
//   championsLeague   W+1..30
//   europaLeague      ..75
//   midTable          ..150
//   avoidedRelegation ..250   (was ..300)
//   relegated         otherwise
//
// TIER_BOUNDARIES has no Title row because its window depends on the target
// — getTierBoundaries(target) is the full ladder.
export const TIER_BOUNDARIES: ReadonlyArray<{ tier: ResultTier; maxDistance: number }> = [
    { tier: 'championsLeague', maxDistance: 30 },
    { tier: 'europaLeague', maxDistance: 75 },
    { tier: 'midTable', maxDistance: 150 },
    { tier: 'avoidedRelegation', maxDistance: 250 },
    { tier: 'relegated', maxDistance: Infinity },
];

// The full ladder for one target, Title contenders first.
export function getTierBoundaries(target: number): ReadonlyArray<{ tier: ResultTier; maxDistance: number }> {
    return [{ tier: 'titleWinners', maxDistance: titleWindowFor(target) }, ...TIER_BOUNDARIES];
}

// Without `target` there's no Title window (old callers keep the 5-tier ladder).
export function tierForDistance(distance: number, target?: number): ResultTier {
    const ladder = target === undefined ? TIER_BOUNDARIES : getTierBoundaries(target);
    const match = ladder.find((boundary) => distance <= boundary.maxDistance);

    // Unreachable — the last boundary is Infinity — but keeps the return
    // type non-optional without a non-null assertion.
    return match?.tier ?? 'relegated';
}

// The full ranked ladder including the win case, worst to best — used by the
// stats feature's "best result ever" tracking (bust isn't part of this
// ladder, same as it isn't one of the finished tiers).
export type Outcome = ResultTier | 'champion';

export const OUTCOME_ORDER: readonly Outcome[] = [
    'relegated', 'avoidedRelegation', 'midTable', 'europaLeague', 'championsLeague', 'titleWinners', 'champion',
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

    return { status: 'finished', tier: tierForDistance(getDistance(total, target), target) };
}
