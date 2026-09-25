import { describe, expect, it } from 'vitest';
import { buildViabilityCheck, computeWinOddsFromPools } from '../server/utils/win-odds';

// Two 2-player pools, values [1, 2] and [1, 2] — every combination:
// 1+1=2, 1+2=3, 2+1=3, 2+2=4. Used across most cases below.
const POOLS = [
    [{ goals: 1, assists: 0 }, { goals: 2, assists: 0 }],
    [{ goals: 0, assists: 1 }, { goals: 0, assists: 2 }],
];

describe('computeWinOddsFromPools — exact', () => {
    it('counts combinations whose sum lands exactly on the remaining gap', () => {
        expect(computeWinOddsFromPools(POOLS, 'exact', 3, 0)).toEqual({ waysToWin: 2, totalWays: 4 });
    });

    it('returns 0 when no combination reaches the gap', () => {
        expect(computeWinOddsFromPools(POOLS, 'exact', 10, 0)).toEqual({ waysToWin: 0, totalWays: 4 });
    });

    it('accounts for a non-zero running total', () => {
        // gap = 3 - 1 = 2, only 1+1 reaches it.
        expect(computeWinOddsFromPools(POOLS, 'exact', 3, 1)).toEqual({ waysToWin: 1, totalWays: 4 });
    });

    it('returns 0 when the running total already exceeds the target', () => {
        expect(computeWinOddsFromPools(POOLS, 'exact', 3, 5)).toEqual({ waysToWin: 0, totalWays: 4 });
    });
});

describe('computeWinOddsFromPools — under', () => {
    it('counts combinations strictly below the remaining gap', () => {
        // gap = 3, sums < 3: only 1+1=2.
        expect(computeWinOddsFromPools(POOLS, 'under', 3, 0)).toEqual({ waysToWin: 1, totalWays: 4 });
    });
});

describe('computeWinOddsFromPools — over', () => {
    it('counts combinations strictly above the remaining gap', () => {
        // gap = 3, sums > 3: only 2+2=4.
        expect(computeWinOddsFromPools(POOLS, 'over', 3, 0)).toEqual({ waysToWin: 1, totalWays: 4 });
    });
});

describe('computeWinOddsFromPools — allUnder', () => {
    it('multiplies per-slot qualifying counts rather than summing', () => {
        // threshold 2: pool A has 1 qualifying player (value 1), pool B has 1 (value 1).
        expect(computeWinOddsFromPools(POOLS, 'allUnder', 2, 0)).toEqual({ waysToWin: 1, totalWays: 4 });
    });

    it('is unaffected by runningTotal, unlike every sum-based kind', () => {
        expect(computeWinOddsFromPools(POOLS, 'allUnder', 2, 999)).toEqual({ waysToWin: 1, totalWays: 4 });
    });
});

describe('computeWinOddsFromPools — edge cases', () => {
    it('returns zero ways when a remaining slot has an empty pool', () => {
        expect(computeWinOddsFromPools([[], [{ goals: 0, assists: 0 }]], 'exact', 0, 0)).toEqual({ waysToWin: 0, totalWays: 0 });
    });

    it('with no remaining slots, the outcome is decided by runningTotal alone', () => {
        // Used by /api/hint to score a candidate for the very last open slot
        // — there's nothing left to draw, so it's a straight win/lose check.
        expect(computeWinOddsFromPools([], 'exact', 442, 442)).toEqual({ waysToWin: 1, totalWays: 1 });
        expect(computeWinOddsFromPools([], 'exact', 442, 441)).toEqual({ waysToWin: 0, totalWays: 1 });
        expect(computeWinOddsFromPools([], 'under', 442, 100)).toEqual({ waysToWin: 1, totalWays: 1 });
        expect(computeWinOddsFromPools([], 'over', 442, 100)).toEqual({ waysToWin: 0, totalWays: 1 });
        expect(computeWinOddsFromPools([], 'allUnder', 100, 999)).toEqual({ waysToWin: 1, totalWays: 1 });
    });

    it('every combination counts as a win when every player is worth zero and the gap is zero', () => {
        const zeroPools = [
            [{ goals: 0, assists: 0 }, { goals: 0, assists: 0 }],
            [{ goals: 0, assists: 0 }, { goals: 0, assists: 0 }],
        ];

        expect(computeWinOddsFromPools(zeroPools, 'exact', 0, 0)).toEqual({ waysToWin: 4, totalWays: 4 });
    });
});

// One other remaining pool, values [1, 2] (achievable sums: 1 or 2) — used
// across the viability checks below.
const OTHER_POOL = [[{ goals: 1, assists: 0 }, { goals: 2, assists: 0 }]];

describe('buildViabilityCheck — exact', () => {
    it('is viable only when some achievable sum of the other slots exactly closes the gap', () => {
        const isViable = buildViabilityCheck(OTHER_POOL, 'exact', 5, 0);

        expect(isViable(3)).toBe(true); // 3 + 2 = 5
        expect(isViable(4)).toBe(true); // 4 + 1 = 5
        expect(isViable(2)).toBe(false); // max reachable is 2 + 2 = 4
        expect(isViable(0)).toBe(false); // gap 5 is out of the other pool's reachable range
    });
});

describe('buildViabilityCheck — under', () => {
    it('is viable when some achievable sum stays strictly under the gap', () => {
        const isViable = buildViabilityCheck(OTHER_POOL, 'under', 4, 0);

        expect(isViable(1)).toBe(true); // 1 + 1 = 2 < 4
        expect(isViable(3)).toBe(false); // needs sum < 1, but the other pool's minimum is 1
    });
});

describe('buildViabilityCheck — over', () => {
    it('is viable when some achievable sum climbs strictly above the gap', () => {
        const isViable = buildViabilityCheck(OTHER_POOL, 'over', 3, 0);

        expect(isViable(2)).toBe(true); // 2 + 2 = 4 > 3
        expect(isViable(1)).toBe(false); // max reachable is 1 + 2 = 3, never strictly over
    });
});

describe('buildViabilityCheck — allUnder', () => {
    it('is viable only when this pick itself qualifies and every other pool still has a qualifying player', () => {
        const isViable = buildViabilityCheck(OTHER_POOL, 'allUnder', 2, 0);

        expect(isViable(1)).toBe(true); // under threshold, and the other pool has a value-1 player
        expect(isViable(2)).toBe(false); // this pick itself would already breach
    });

    it('is never viable once some other pool has nobody under the threshold', () => {
        const isViable = buildViabilityCheck(OTHER_POOL, 'allUnder', 1, 0);

        // threshold 1: the other pool's players are worth 1 and 2 — neither qualifies.
        expect(isViable(0)).toBe(false);
    });
});

describe('buildViabilityCheck — edge cases', () => {
    it('with no other remaining slots, viability is a direct win/lose check on this pick alone', () => {
        expect(buildViabilityCheck([], 'exact', 442, 440)(2)).toBe(true);
        expect(buildViabilityCheck([], 'exact', 442, 440)(1)).toBe(false);
        expect(buildViabilityCheck([], 'allUnder', 5, 0)(4)).toBe(true);
        expect(buildViabilityCheck([], 'allUnder', 5, 0)(5)).toBe(false);
    });

    it('is never viable once some other remaining slot has an empty pool', () => {
        const isViable = buildViabilityCheck([[]], 'exact', 5, 0);

        expect(isViable(5)).toBe(false);
    });
});
