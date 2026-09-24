import { describe, expect, it } from 'vitest';
import { calculateTotal, getDistance, getGameResult, isBust, isExactWin, tierForDistance } from '../app/utils/scoring';

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

// Boundaries chosen empirically from scripts/simulate.ts's distance
// distribution, then tightened (see the comment in scoring.ts for the full
// rationale): championsLeague <= 25, europaLeague <= 75, midTable <= 150,
// avoidedRelegation <= 300, relegated otherwise.
describe('tierForDistance', () => {
    it('is championsLeague at and just under its boundary', () => {
        expect(tierForDistance(0)).toBe('championsLeague');
        expect(tierForDistance(1)).toBe('championsLeague');
        expect(tierForDistance(25)).toBe('championsLeague');
    });

    it('crosses from championsLeague to europaLeague at the boundary', () => {
        expect(tierForDistance(26)).toBe('europaLeague');
        expect(tierForDistance(75)).toBe('europaLeague');
    });

    it('crosses from europaLeague to midTable at the boundary', () => {
        expect(tierForDistance(76)).toBe('midTable');
        expect(tierForDistance(150)).toBe('midTable');
    });

    it('crosses from midTable to avoidedRelegation at the boundary', () => {
        expect(tierForDistance(151)).toBe('avoidedRelegation');
        expect(tierForDistance(300)).toBe('avoidedRelegation');
    });

    it('crosses from avoidedRelegation to relegated at the boundary', () => {
        expect(tierForDistance(301)).toBe('relegated');
    });

    it('stays relegated arbitrarily far out', () => {
        expect(tierForDistance(1000)).toBe('relegated');
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

    it('is finished with the championsLeague tier just short of exact', () => {
        expect(getGameResult(441, 442, 11, 11)).toEqual({ status: 'finished', tier: 'championsLeague' });
        expect(getGameResult(417, 442, 11, 11)).toEqual({ status: 'finished', tier: 'championsLeague' });
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
