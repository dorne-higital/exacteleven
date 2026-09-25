import { beforeEach, describe, expect, it } from 'vitest';
import type { GameStats } from '../app/utils/stats-types';
import {
    backfillSeenAchievements,
    diffNewlyUnlocked,
    hasSeenAchievementsRecord,
    readSeenAchievementIds,
} from '../app/utils/achievement-notifications';
import { formations } from '../app/utils/formations';

function statsFixture(overrides: Partial<GameStats> = {}): GameStats {
    return {
        gamesPlayed: 0,
        wins: 0,
        championsLeague: 0,
        europaLeague: 0,
        midTable: 0,
        avoidedRelegation: 0,
        relegated: 0,
        busts: 0,
        bestResult: null,
        formationPlays: Object.fromEntries(formations.map((formation) => [formation.code, 0])) as GameStats['formationPlays'],
        formationWins: Object.fromEntries(formations.map((formation) => [formation.code, 0])) as GameStats['formationWins'],
        dailyStreak: 0,
        bestDailyStreak: 0,
        dailyWins: 0,
        dailyPlays: 0,
        lastDailyResultDate: null,
        dailyResults: [],
        ...overrides,
    };
}

beforeEach(() => {
    window.localStorage.clear();
});

describe('diffNewlyUnlocked', () => {
    it('returns the achievements that crossed their threshold between before and after', () => {
        const before = statsFixture({ gamesPlayed: 4 });
        const after = statsFixture({ gamesPlayed: 5 });

        const fresh = diffNewlyUnlocked(before, after, new Set());

        expect(fresh.map((def) => def.id)).toEqual(['games-played-5']);
    });

    it('returns nothing when no achievement crossed its threshold', () => {
        const before = statsFixture({ gamesPlayed: 1 });
        const after = statsFixture({ gamesPlayed: 2 });

        expect(diffNewlyUnlocked(before, after, new Set())).toHaveLength(0);
    });

    it('never re-surfaces an id already marked as seen', () => {
        const before = statsFixture({ gamesPlayed: 4 });
        const after = statsFixture({ gamesPlayed: 5 });

        expect(diffNewlyUnlocked(before, after, new Set(['games-played-5']))).toHaveLength(0);
    });

    it('excludes anything already unlocked before the mutation, even if re-passed in "after"', () => {
        const before = statsFixture({ gamesPlayed: 10 });
        const after = statsFixture({ gamesPlayed: 11 });

        // gamesPlayed=10 already unlocked games-played-5 and games-played-10;
        // only nothing new crosses a threshold between 10 and 11.
        expect(diffNewlyUnlocked(before, after, new Set())).toHaveLength(0);
    });

    it('can return more than one achievement at once', () => {
        const before = statsFixture({ wins: 0, championsLeague: 0 });
        const after = statsFixture({ wins: 1, championsLeague: 1 });

        const ids = diffNewlyUnlocked(before, after, new Set()).map((def) => def.id);

        expect(ids).toContain('games-won-1');
        expect(ids).toContain('tier-championsLeague-1');
    });
});

describe('backfillSeenAchievements + hasSeenAchievementsRecord', () => {
    it('has no record before the first backfill', () => {
        expect(hasSeenAchievementsRecord()).toBe(false);
    });

    it('seeds every already-unlocked id silently, without needing a diff call first', () => {
        const stats = statsFixture({ gamesPlayed: 30, wins: 1 });

        backfillSeenAchievements(stats);

        expect(hasSeenAchievementsRecord()).toBe(true);

        const seen = readSeenAchievementIds();

        expect(seen.has('games-played-5')).toBe(true);
        expect(seen.has('games-played-25')).toBe(true);
        expect(seen.has('games-won-1')).toBe(true);
        expect(seen.has('games-played-50')).toBe(false);
    });

    it('does not overwrite an existing record on a second call', () => {
        backfillSeenAchievements(statsFixture({ gamesPlayed: 5 }));
        backfillSeenAchievements(statsFixture({ gamesPlayed: 500 }));

        // If the second call re-ran, games-played-100 would be seeded too —
        // it must not, since the record already existed after the first call.
        expect(readSeenAchievementIds().has('games-played-100')).toBe(false);
    });
});
