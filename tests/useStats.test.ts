import { ref } from 'vue';
import type { Ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentDailyStreak as currentDailyStreakPure, migrateStats, useStats } from '../app/composables/useStats';
import type { GameStats } from '../app/utils/stats-types';

// Same fakeUseState pattern as useGame.test.ts — see its comment for why
// this is enough (import.meta.client is falsy under plain vitest, so every
// localStorage/dataLayer-writing branch here is already a safe no-op).
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

beforeEach(() => {
    stateStore.clear();
    vi.stubGlobal('useState', fakeUseState);
});

// 2026-01-01 is a Thursday; dates below just need to be consecutive
// calendar days, not any particular weekday.
function dateFor(dayOffset: number): string {
    const d = new Date(Date.UTC(2026, 0, 1 + dayOffset));

    return d.toISOString().slice(0, 10);
}

describe('useStats — DailyStreakStrip recent-form log (recordDailyOutcome)', () => {
    it('logs each day\'s date and won/bust/lost status', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('bust', dateFor(1));
        recordDailyOutcome('lost', dateFor(2));

        expect(stats.value.dailyResults).toEqual([
            { date: dateFor(0), status: 'won' },
            { date: dateFor(1), status: 'bust' },
            { date: dateFor(2), status: 'lost' },
        ]);
    });

    it('does not double-log a same-day replay', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('bust', dateFor(0));

        expect(stats.value.dailyResults).toEqual([{ date: dateFor(0), status: 'won' }]);
    });

    it('caps the log at the rolling window, dropping the oldest entries first', () => {
        const { stats, recordDailyOutcome } = useStats();

        for (let day = 0; day < 15; day += 1) {
            recordDailyOutcome('won', dateFor(day));
        }

        expect(stats.value.dailyResults).toHaveLength(10);
        expect(stats.value.dailyResults[0]!.date).toBe(dateFor(5));
        expect(stats.value.dailyResults.at(-1)!.date).toBe(dateFor(14));
    });
});

describe('useStats — exact-win run and unassisted wins (recordOutcome)', () => {
    it('counts unassisted exact wins and the run of them', () => {
        const { stats, recordOutcome } = useStats();

        recordOutcome('won', null, '442');
        recordOutcome('won', null, '433');
        recordOutcome('bust', null, '442');
        recordOutcome('won', null, '442');

        expect(stats.value.wins).toBe(3);
        expect(stats.value.unassistedWins).toBe(3);
        expect(stats.value.currentExactRun).toBe(1);
        expect(stats.value.bestExactRun).toBe(2);
    });

    it('counts an assisted win as a win but not as unassisted, and leaves the run as it was', () => {
        const { stats, recordOutcome } = useStats();

        recordOutcome('won', null, '442');
        recordOutcome('won', null, '442', true);

        expect(stats.value.wins).toBe(2);
        expect(stats.value.unassistedWins).toBe(1);
        expect(stats.value.currentExactRun).toBe(1);
        expect(stats.value.bestExactRun).toBe(1);

        recordOutcome('won', null, '442');

        expect(stats.value.currentExactRun).toBe(2);
        expect(stats.value.bestExactRun).toBe(2);
    });

    it('still ends the run on an assisted game that misses', () => {
        const { stats, recordOutcome } = useStats();

        recordOutcome('won', null, '442');
        recordOutcome('bust', null, '442', true);

        expect(stats.value.currentExactRun).toBe(0);
    });

    it('ends the run on a non-exact finish', () => {
        const { stats, recordOutcome } = useStats();

        recordOutcome('won', null, '442');
        recordOutcome('finished', 'midTable', '442');

        expect(stats.value.currentExactRun).toBe(0);
        expect(stats.value.bestExactRun).toBe(1);
    });
});

describe('useStats — migrateStats', () => {
    it('treats every win saved before boosts existed as unassisted', () => {
        const { stats } = useStats();
        const old = { ...stats.value, wins: 7 };
        const migrated = migrateStats({ wins: 7 }, { ...old, unassistedWins: 0, currentExactRun: 0, bestExactRun: 0 });

        expect(migrated.unassistedWins).toBe(7);
        expect(migrated.bestExactRun).toBe(0);
    });

    it('keeps saved values but clamps inconsistent ones', () => {
        const { stats } = useStats();
        const saved = { ...stats.value, wins: 4, unassistedWins: 9, currentExactRun: 6, bestExactRun: 2 };
        const migrated = migrateStats(saved, saved);

        expect(migrated.unassistedWins).toBe(4);
        expect(migrated.currentExactRun).toBe(4);
        expect(migrated.bestExactRun).toBe(4);
    });
});

describe('useStats — Daily streak counts days played, wins tracked separately (DAILY2_SPEC §1.9)', () => {
    it('keeps the played streak going through losses and busts, while the win streak resets', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('won', dateFor(1));
        recordDailyOutcome('lost', dateFor(2));
        recordDailyOutcome('bust', dateFor(3));
        recordDailyOutcome('won', dateFor(4));

        expect(stats.value.dailyStreak).toBe(5);
        expect(stats.value.bestDailyStreak).toBe(5);
        expect(stats.value.dailyWinStreak).toBe(1);
        expect(stats.value.bestDailyWinStreak).toBe(2);
        expect(stats.value.dailyWins).toBe(3);
        expect(stats.value.dailyPlays).toBe(5);
    });

    it('restarts both streaks after a missed day, and keeps the bests', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('won', dateFor(1));
        recordDailyOutcome('won', dateFor(3));

        expect(stats.value.dailyStreak).toBe(1);
        expect(stats.value.dailyWinStreak).toBe(1);
        expect(stats.value.bestDailyStreak).toBe(2);
        expect(stats.value.bestDailyWinStreak).toBe(2);
    });

    it('counts a Daily finished for an older date as a play without rewinding the streak', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('won', dateFor(2));
        // Yesterday's Daily posted late, after today's.
        recordDailyOutcome('lost', dateFor(1), { score: 400, kind: 'exact', stat: 'ga', beatPct: null, players: 0 });

        expect(stats.value.lastDailyResultDate).toBe(dateFor(2));
        expect(stats.value.dailyStreak).toBe(1);
        expect(stats.value.dailyWinStreak).toBe(1);
        expect(stats.value.dailyPlays).toBe(3);
        expect(stats.value.dailyResults.map((entry) => entry.date)).toEqual([dateFor(0), dateFor(1), dateFor(2)]);
        expect(stats.value.dailyScores.map((entry) => entry.date)).toEqual([dateFor(1)]);

        // …and only once.
        recordDailyOutcome('lost', dateFor(1));
        expect(stats.value.dailyPlays).toBe(3);
    });

    it('records the Daily 2.0 score line, the best score, and caps the score log at 14', () => {
        const { stats, recordDailyOutcome, updateDailyScorePercentile } = useStats();

        for (let day = 0; day < 16; day += 1) {
            recordDailyOutcome('lost', dateFor(day), { score: 300 + day, kind: 'exact', stat: 'goals', beatPct: null, players: 0 });
        }

        expect(stats.value.dailyScores).toHaveLength(14);
        expect(stats.value.dailyScores[0]!.date).toBe(dateFor(2));
        expect(stats.value.bestDailyScore).toBe(315);
        expect(stats.value.dailyResults.at(-1)).toEqual({ date: dateFor(15), status: 'lost', score: 315 });

        updateDailyScorePercentile(dateFor(15), 74, 1203);
        expect(stats.value.dailyScores.at(-1)).toMatchObject({ date: dateFor(15), beatPct: 74, players: 1203 });
    });

    it('shows a streak as 0 once a day has been missed, without changing what is stored', () => {
        const { stats, recordDailyOutcome, currentDailyStreak, currentDailyWinStreak } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('won', dateFor(1));

        expect(currentDailyStreak(dateFor(1))).toBe(2);
        expect(currentDailyStreak(dateFor(2))).toBe(2);
        expect(currentDailyWinStreak(dateFor(2))).toBe(2);
        expect(currentDailyStreak(dateFor(3))).toBe(0);
        expect(currentDailyWinStreak(dateFor(3))).toBe(0);
        expect(stats.value.dailyStreak).toBe(2);
        expect(currentDailyStreakPure({ lastDailyResultDate: null, dailyStreak: 4 }, dateFor(0))).toBe(0);
    });
});

describe('useStats — played-streak migration (migrateStats, DAILY2_SPEC §1.9)', () => {
    function oldStats(fields: Partial<GameStats>): Partial<GameStats> {
        const { stats } = useStats();
        const { dailyWinStreak: _a, bestDailyWinStreak: _b, statsVersion: _c, ...rest } = stats.value;

        return { ...rest, ...fields };
    }

    function migrate(saved: Partial<GameStats>): GameStats {
        const { stats } = useStats();

        return migrateStats(saved, { ...stats.value, ...saved } as GameStats);
    }

    it('W L W W on 4 consecutive days ending yesterday, old streak 2 → played 4, win streak stays 2', () => {
        const saved = oldStats({
            dailyStreak: 2,
            bestDailyStreak: 3,
            lastDailyResultDate: dateFor(3),
            dailyResults: [
                { date: dateFor(0), status: 'won' },
                { date: dateFor(1), status: 'lost' },
                { date: dateFor(2), status: 'won' },
                { date: dateFor(3), status: 'won' },
            ],
        });
        const migrated = migrate(saved);

        expect(migrated.dailyStreak).toBe(4);
        expect(migrated.bestDailyStreak).toBe(4);
        expect(migrated.dailyWinStreak).toBe(2);
        expect(migrated.bestDailyWinStreak).toBe(3);
        expect(migrated.statsVersion).toBe(2);
    });

    it('never lowers a streak longer than the 10-entry log can show', () => {
        const saved = oldStats({
            dailyStreak: 25,
            bestDailyStreak: 40,
            lastDailyResultDate: dateFor(9),
            dailyResults: Array.from({ length: 10 }, (_, day) => ({ date: dateFor(day), status: 'won' as const })),
        });
        const migrated = migrate(saved);

        expect(migrated.dailyStreak).toBe(25);
        expect(migrated.bestDailyStreak).toBe(40);
        expect(migrated.dailyWinStreak).toBe(25);
        expect(migrated.bestDailyWinStreak).toBe(40);
    });

    it('handles an empty log', () => {
        const migrated = migrate(oldStats({ dailyStreak: 0, bestDailyStreak: 0, lastDailyResultDate: null, dailyResults: [] }));

        expect(migrated.dailyStreak).toBe(0);
        expect(migrated.dailyWinStreak).toBe(0);
        expect(migrated.bestDailyStreak).toBe(0);
    });

    it('keeps a stale streak as stored (display goes through currentDailyStreak)', () => {
        const saved = oldStats({
            dailyStreak: 0,
            bestDailyStreak: 2,
            lastDailyResultDate: dateFor(1),
            dailyResults: [{ date: dateFor(0), status: 'lost' }, { date: dateFor(1), status: 'bust' }],
        });
        const migrated = migrate(saved);

        expect(migrated.dailyStreak).toBe(2);
        expect(migrated.dailyWinStreak).toBe(0);
        expect(currentDailyStreakPure(migrated, dateFor(30))).toBe(0);
    });

    it('is idempotent: stats already migrated are left alone', () => {
        const saved = { ...migrate(oldStats({ dailyStreak: 1, lastDailyResultDate: dateFor(1), dailyResults: [{ date: dateFor(0), status: 'lost' }, { date: dateFor(1), status: 'won' }] })) };
        const again = migrateStats(saved, saved);

        expect(again).toEqual(saved);
        expect(again.dailyStreak).toBe(2);
        expect(again.dailyWinStreak).toBe(1);
    });
});

describe('useStats — Title winners tier', () => {
    it('counts a titleWinners finish and ranks it above Champions League as a best result', () => {
        const { stats, recordOutcome } = useStats();

        recordOutcome('finished', 'championsLeague', '442');
        recordOutcome('finished', 'titleWinners', '433');

        expect(stats.value.titleWinners).toBe(1);
        expect(stats.value.bestResult).toEqual({ outcome: 'titleWinners', formationCode: '433' });

        recordOutcome('finished', 'championsLeague', '343');
        expect(stats.value.bestResult).toEqual({ outcome: 'titleWinners', formationCode: '433' });
    });
});
