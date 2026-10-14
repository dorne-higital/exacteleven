import { afterEach, describe, expect, it, vi } from 'vitest';
import { LEADERBOARD_IDS } from '../app/utils/appStore';
import {
    GAME_CENTER_SUBMITTED_KEY,
    authenticate,
    isAvailable,
    leaderboardScores,
    readSubmittedScores,
    scoresToSubmit,
    showLeaderboards,
    submitScore,
    submitStatsToGameCenter,
} from '../app/utils/game-center';

afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('leaderboardScores / scoresToSubmit', () => {
    it('maps the three stats onto the three leaderboard ids', () => {
        expect(leaderboardScores({ bestDailyStreak: 4, unassistedWins: 9, bestExactRun: 2 })).toEqual({
            [LEADERBOARD_IDS.dailyBestStreak]: 4,
            [LEADERBOARD_IDS.classicExactWins]: 9,
            [LEADERBOARD_IDS.classicBestRun]: 2,
        });
    });

    it('treats a missing (not yet added) stat as nothing to submit', () => {
        expect(scoresToSubmit({ bestDailyStreak: 3 }, {})).toEqual({ [LEADERBOARD_IDS.dailyBestStreak]: 3 });
    });

    it('only submits values that went up since the last submission', () => {
        const submitted = {
            [LEADERBOARD_IDS.dailyBestStreak]: 5,
            [LEADERBOARD_IDS.classicExactWins]: 2,
        };

        expect(scoresToSubmit({ bestDailyStreak: 5, unassistedWins: 3, bestExactRun: 1 }, submitted)).toEqual({
            [LEADERBOARD_IDS.classicExactWins]: 3,
            [LEADERBOARD_IDS.classicBestRun]: 1,
        });
    });

    it('skips zero, lowered and non-integer values', () => {
        const submitted = { [LEADERBOARD_IDS.dailyBestStreak]: 5 };

        expect(scoresToSubmit({ bestDailyStreak: 2, unassistedWins: 0, bestExactRun: 1.5 }, submitted)).toEqual({});
    });
});

describe('readSubmittedScores', () => {
    it('ignores corrupt storage', () => {
        window.localStorage.setItem(GAME_CENTER_SUBMITTED_KEY, 'not json');
        expect(readSubmittedScores()).toEqual({});

        window.localStorage.setItem(GAME_CENTER_SUBMITTED_KEY, JSON.stringify({ a: 3, b: -1, c: 'x', d: 2.5 }));
        expect(readSubmittedScores()).toEqual({ a: 3 });
    });
});

describe('on the web', () => {
    it('is unavailable and every call is a no-op', async () => {
        const dataLayer: unknown[] = [];
        vi.stubGlobal('dataLayer', dataLayer);
        const alert = vi.fn();
        vi.stubGlobal('alert', alert);

        expect(isAvailable()).toBe(false);
        expect(await authenticate()).toBe(false);
        expect(await submitScore(LEADERBOARD_IDS.dailyBestStreak, 3)).toBe(false);
        expect(await showLeaderboards()).toBe(false);
        await submitStatsToGameCenter({ bestDailyStreak: 3, unassistedWins: 2, bestExactRun: 1 });

        expect(window.localStorage.getItem(GAME_CENTER_SUBMITTED_KEY)).toBeNull();
        expect(alert).not.toHaveBeenCalled();
        expect(dataLayer).toEqual([]);
    });

    it('stays off even when Capacitor is present but not native', () => {
        vi.stubGlobal('Capacitor', { isNativePlatform: () => false });

        expect(isAvailable()).toBe(false);
    });
});
