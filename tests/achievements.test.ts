import { describe, expect, it } from 'vitest';
import type { GameStats } from '../app/utils/stats-types';
import { ACHIEVEMENTS, getAchievementProgress, TIERS } from '../app/utils/achievements';
import { formations } from '../app/utils/formations';

function emptyStatsFixture(overrides: Partial<GameStats> = {}): GameStats {
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
        ...overrides,
    };
}

describe('achievements', () => {
    it('defines 10 games-played + 9 games-won + (5 tiers × 9) + (7 formations × 9) + 7 daily-streak = 134 badges', () => {
        expect(ACHIEVEMENTS).toHaveLength(134);
        expect(ACHIEVEMENTS.filter((def) => def.category === 'gamesPlayed')).toHaveLength(10);
        expect(ACHIEVEMENTS.filter((def) => def.category === 'gamesWon')).toHaveLength(9);
        expect(ACHIEVEMENTS.filter((def) => def.category === 'tier')).toHaveLength(TIERS.length * 9);
        expect(ACHIEVEMENTS.filter((def) => def.category === 'formationWin')).toHaveLength(formations.length * 9);
        expect(ACHIEVEMENTS.filter((def) => def.category === 'dailyStreak')).toHaveLength(7);
    });

    it('gives every achievement a unique id', () => {
        const ids = new Set(ACHIEVEMENTS.map((def) => def.id));

        expect(ids.size).toBe(ACHIEVEMENTS.length);
    });

    it('spreads each category\'s thresholds across all 5 ranks, lowest to highest', () => {
        const gamesWonRanks = ACHIEVEMENTS.filter((def) => def.category === 'gamesWon').map((def) => def.rank);

        expect(gamesWonRanks[0]).toBe('bronze');
        expect(gamesWonRanks.at(-1)).toBe('diamond');
        expect(new Set(gamesWonRanks).size).toBe(5);
    });

    it('unlocks nothing on a fresh, all-zero stats record', () => {
        const progress = getAchievementProgress(emptyStatsFixture());

        expect(progress.every((entry) => !entry.unlocked)).toBe(true);
    });

    it('unlocks exactly the games-played badges at or under the current count', () => {
        const progress = getAchievementProgress(emptyStatsFixture({ gamesPlayed: 30 }));
        const gamesPlayedProgress = progress.filter((entry) => entry.def.category === 'gamesPlayed');

        expect(gamesPlayedProgress.filter((entry) => entry.unlocked).map((entry) => entry.def.threshold)).toEqual([5, 10, 25]);
    });

    it('tracks tier and formation-win achievements independently of games played and games won', () => {
        const progress = getAchievementProgress(emptyStatsFixture({
            gamesPlayed: 1,
            wins: 1,
            championsLeague: 5,
            formationWins: {
                ...emptyStatsFixture().formationWins,
                442: 10,
            },
        }));

        const championsLeagueUnlocked = progress
            .filter((entry) => entry.def.category === 'tier' && entry.def.subKind === 'championsLeague' && entry.unlocked)
            .map((entry) => entry.def.threshold);
        const formation442Unlocked = progress
            .filter((entry) => entry.def.category === 'formationWin' && entry.def.subKind === '442' && entry.unlocked)
            .map((entry) => entry.def.threshold);
        const europaLeagueUnlocked = progress.filter((entry) => entry.def.category === 'tier' && entry.def.subKind === 'europaLeague' && entry.unlocked);

        expect(championsLeagueUnlocked).toEqual([1, 3, 5]);
        expect(formation442Unlocked).toEqual([1, 3, 5, 10]);
        expect(europaLeagueUnlocked).toHaveLength(0);
    });

    it('unlocks daily-streak badges from the best-ever streak, not the live one that can reset to 0', () => {
        const progress = getAchievementProgress(emptyStatsFixture({ dailyStreak: 0, bestDailyStreak: 10 }));
        const dailyStreakUnlocked = progress
            .filter((entry) => entry.def.category === 'dailyStreak' && entry.unlocked)
            .map((entry) => entry.def.threshold);

        expect(dailyStreakUnlocked).toEqual([3, 7]);
    });
});
