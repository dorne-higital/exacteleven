import { describe, expect, it } from 'vitest';
import { calculateTotal, getDistance, getGameResult, getTierBoundaries, isBetterOutcome, isBust, isExactWin, TIER_BOUNDARIES, tierForDistance } from '../app/utils/scoring';

describe('calculateTotal', () => {
    it('sums goals and assists across every picked player', () => {
        expect(calculateTotal([
            { goals: 3, assists: 2 },
            { goals: 0, assists: 1 },
            { goals: 10, assists: 0 },
        ])).toBe(16);
    });

    it('returns 0 for an empty list', () => {
        expect(calculateTotal([])).toBe(0);
    });
});

describe('isBust', () => {
    it('is true once the total exceeds the target', () => {
        expect(isBust(443, 442)).toBe(true);
    });

    it('is false at or below the target', () => {
        expect(isBust(442, 442)).toBe(false);
        expect(isBust(400, 442)).toBe(false);
    });
});

describe('isExactWin', () => {
    it('is true only on an exact match', () => {
        expect(isExactWin(442, 442)).toBe(true);
        expect(isExactWin(441, 442)).toBe(false);
        expect(isExactWin(443, 442)).toBe(false);
    });
});

describe('getDistance', () => {
    it('returns the absolute gap between total and target', () => {
        expect(getDistance(400, 442)).toBe(42);
        expect(getDistance(442, 442)).toBe(0);
        expect(getDistance(450, 442)).toBe(8);
    });
});

// DAILY2_SPEC §1.8's retuned ladder: titleWinners 1..W (with a target),
// championsLeague ..30, europaLeague ..75, midTable ..150,
// avoidedRelegation ..250, relegated otherwise.
describe('tierForDistance', () => {
    it('is championsLeague at and just under its boundary without a target (no Title window)', () => {
        expect(tierForDistance(0)).toBe('championsLeague');
        expect(tierForDistance(1)).toBe('championsLeague');
        expect(tierForDistance(30)).toBe('championsLeague');
    });

    it('crosses from championsLeague to europaLeague at the boundary', () => {
        expect(tierForDistance(31)).toBe('europaLeague');
        expect(tierForDistance(75)).toBe('europaLeague');
    });

    it('crosses from europaLeague to midTable at the boundary', () => {
        expect(tierForDistance(76)).toBe('midTable');
        expect(tierForDistance(150)).toBe('midTable');
    });

    it('crosses from midTable to avoidedRelegation at the boundary', () => {
        expect(tierForDistance(151)).toBe('avoidedRelegation');
        expect(tierForDistance(250)).toBe('avoidedRelegation');
    });

    it('crosses from avoidedRelegation to relegated at the boundary', () => {
        expect(tierForDistance(251)).toBe('relegated');
    });

    it('stays relegated arbitrarily far out', () => {
        expect(tierForDistance(1000)).toBe('relegated');
    });

    it('adds the Title contenders window with a target, sized by formation', () => {
        const windows: Record<string, number> = { 343: 5, 352: 5, 433: 6, 442: 7, 451: 7, 532: 8, 541: 8 };

        for (const [code, w] of Object.entries(windows)) {
            const target = Number(code);

            expect(getTierBoundaries(target)[0]).toEqual({ tier: 'titleWinners', maxDistance: w });
            expect(tierForDistance(1, target)).toBe('titleWinners');
            expect(tierForDistance(w, target)).toBe('titleWinners');
            expect(tierForDistance(w + 1, target)).toBe('championsLeague');
        }
    });

    it('keeps TIER_BOUNDARIES (no Title row) with the new numbers', () => {
        expect(TIER_BOUNDARIES.map((b) => [b.tier, b.maxDistance])).toEqual([
            ['championsLeague', 30], ['europaLeague', 75], ['midTable', 150], ['avoidedRelegation', 250], ['relegated', Infinity],
        ]);
    });
});

describe('isBetterOutcome', () => {
    it('ranks Title contenders between Champions League and an exact win', () => {
        expect(isBetterOutcome('titleWinners', 'championsLeague')).toBe(true);
        expect(isBetterOutcome('champion', 'titleWinners')).toBe(true);
        expect(isBetterOutcome('championsLeague', 'titleWinners')).toBe(false);
        expect(isBetterOutcome('titleWinners', null)).toBe(true);
    });
});

describe('getGameResult', () => {
    it('is playing while slots remain open and no bust has happened', () => {
        expect(getGameResult(100, 442, 5, 11)).toEqual({ status: 'playing', tier: null });
    });

    it('is bust the moment the total exceeds target, even mid-game', () => {
        expect(getGameResult(450, 442, 5, 11)).toEqual({ status: 'bust', tier: null });
        expect(getGameResult(450, 442, 11, 11)).toEqual({ status: 'bust', tier: null });
    });

    it('wins only on an exact match', () => {
        expect(getGameResult(442, 442, 11, 11)).toEqual({ status: 'won', tier: null });
    });

    it('is finished with the titleWinners tier within the window of 442 (7)', () => {
        expect(getGameResult(441, 442, 11, 11)).toEqual({ status: 'finished', tier: 'titleWinners' });
        expect(getGameResult(435, 442, 11, 11)).toEqual({ status: 'finished', tier: 'titleWinners' });
    });

    it('is finished with the championsLeague tier just outside the Title window', () => {
        expect(getGameResult(434, 442, 11, 11)).toEqual({ status: 'finished', tier: 'championsLeague' });
        expect(getGameResult(412, 442, 11, 11)).toEqual({ status: 'finished', tier: 'championsLeague' });
    });

    it('is finished with the europaLeague tier a bit further out', () => {
        expect(getGameResult(390, 442, 11, 11)).toEqual({ status: 'finished', tier: 'europaLeague' });
    });

    it('is finished with the midTable tier further still', () => {
        expect(getGameResult(310, 442, 11, 11)).toEqual({ status: 'finished', tier: 'midTable' });
    });

    it('is finished with the avoidedRelegation tier further still', () => {
        expect(getGameResult(200, 442, 11, 11)).toEqual({ status: 'finished', tier: 'avoidedRelegation' });
    });

    it('is finished with the relegated tier for the worst finishes', () => {
        expect(getGameResult(0, 442, 11, 11)).toEqual({ status: 'finished', tier: 'relegated' });
    });
});
