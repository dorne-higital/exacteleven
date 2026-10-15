import { describe, expect, it } from 'vitest';
import {
    BACKUP_KEYS,
    mergeBackupValue,
    mergeBoostBank,
    mergeListJson,
    mergeMaxMapJson,
    mergeStatsJson,
} from '../app/utils/icloud-backup';
import { APPEARANCE_STORAGE_KEY, KIT_STORAGE_KEY } from '../app/utils/themes';

const stats = (fields: Record<string, unknown>) => JSON.stringify(fields);

describe('mergeStatsJson', () => {
    it('keeps the local value when there is no usable backup', () => {
        const local = stats({ gamesPlayed: 3 });

        expect(mergeStatsJson(local, undefined)).toBe(local);
        expect(mergeStatsJson(local, 'garbage')).toBe(local);
    });

    it('restores the backup onto an empty device', () => {
        const cloud = stats({ gamesPlayed: 40, wins: 2 });

        expect(mergeStatsJson(null, cloud)).toBe(cloud);
    });

    it('never lowers a lifetime counter, whichever record is busier', () => {
        const local = stats({ gamesPlayed: 5, wins: 3, busts: 1, bestDailyStreak: 9, unassistedWins: 3, bestExactRun: 2 });
        const cloud = stats({ gamesPlayed: 50, wins: 2, busts: 20, bestDailyStreak: 4, unassistedWins: 1, bestExactRun: 1 });
        const merged = JSON.parse(mergeStatsJson(local, cloud)!);

        expect(merged).toMatchObject({ gamesPlayed: 50, wins: 3, busts: 20, bestDailyStreak: 9, unassistedWins: 3, bestExactRun: 2 });
    });

    it('takes per-formation counts as a per-code max', () => {
        const local = stats({ gamesPlayed: 2, formationPlays: { '442': 2, '433': 0 }, formationWins: { '442': 1 } });
        const cloud = stats({ gamesPlayed: 1, formationPlays: { '442': 1, '433': 1 }, formationWins: { '442': 0, '352': 1 } });
        const merged = JSON.parse(mergeStatsJson(local, cloud)!);

        expect(merged.formationPlays).toEqual({ '442': 2, '433': 1 });
        expect(merged.formationWins).toEqual({ '442': 1, '352': 1 });
    });

    it('does not bring back a broken live streak or run from the quieter record', () => {
        const local = stats({ gamesPlayed: 30, currentExactRun: 0, bestExactRun: 3 });
        const cloud = stats({ gamesPlayed: 10, currentExactRun: 3, bestExactRun: 3 });

        expect(JSON.parse(mergeStatsJson(local, cloud)!)).toMatchObject({ currentExactRun: 0, bestExactRun: 3 });
    });

    it('takes the Daily streak fields from whichever record played a Daily last', () => {
        const local = stats({ gamesPlayed: 30, dailyPlays: 3, dailyStreak: 3, bestDailyStreak: 3, lastDailyResultDate: '2026-10-10', dailyResults: [{ date: '2026-10-10', status: 'won' }] });
        const cloud = stats({ gamesPlayed: 1, dailyPlays: 4, dailyStreak: 4, bestDailyStreak: 4, lastDailyResultDate: '2026-10-11', dailyResults: [{ date: '2026-10-11', status: 'won' }] });
        const merged = JSON.parse(mergeStatsJson(local, cloud)!);

        expect(merged).toMatchObject({ gamesPlayed: 30, dailyPlays: 4, dailyStreak: 4, bestDailyStreak: 4, lastDailyResultDate: '2026-10-11' });
        expect(merged.dailyResults).toEqual([{ date: '2026-10-11', status: 'won' }]);
    });

    it('moves the Daily 2.0 win streak and score log with the other Daily fields, and maxes the new bests', () => {
        const local = stats({
            gamesPlayed: 30, dailyPlays: 3, dailyStreak: 3, dailyWinStreak: 2, bestDailyWinStreak: 5, bestDailyScore: 900, titleWinners: 4,
            lastDailyResultDate: '2026-10-10', dailyScores: [{ date: '2026-10-10', score: 900 }],
        });
        const cloud = stats({
            gamesPlayed: 1, dailyPlays: 4, dailyStreak: 4, dailyWinStreak: 0, bestDailyWinStreak: 3, bestDailyScore: 950, titleWinners: 1,
            lastDailyResultDate: '2026-10-11', dailyScores: [{ date: '2026-10-11', score: 400 }],
        });
        const merged = JSON.parse(mergeStatsJson(local, cloud)!);

        expect(merged).toMatchObject({ dailyStreak: 4, dailyWinStreak: 0, bestDailyWinStreak: 5, bestDailyScore: 950, titleWinners: 4 });
        expect(merged.dailyScores).toEqual([{ date: '2026-10-11', score: 400 }]);
    });

    it('keeps the better best result and fields this build does not know', () => {
        const local = stats({ gamesPlayed: 9, bestResult: { outcome: 'midTable', formationCode: '442' } });
        const cloud = stats({ gamesPlayed: 2, bestResult: { outcome: 'champion', formationCode: '433' }, schemaVersion: 2, modes: { era: { wins: 1 } } });
        const merged = JSON.parse(mergeStatsJson(local, cloud)!);

        expect(merged.bestResult).toEqual({ outcome: 'champion', formationCode: '433' });
        expect(merged.modes).toEqual({ era: { wins: 1 } });
        expect(merged.schemaVersion).toBe(2);
    });

    it('returns the exact local string when nothing changes', () => {
        const local = stats({ gamesPlayed: 9, wins: 1 });

        expect(mergeStatsJson(local, stats({ gamesPlayed: 3, wins: 0 }))).toBe(local);
    });
});

describe('mergeListJson', () => {
    it('unions, local order first', () => {
        expect(mergeListJson('["a","b"]', '["b","c"]')).toBe('["a","b","c"]');
    });

    it('leaves local alone when the backup adds nothing or is unusable', () => {
        const local = '["a","b"]';

        expect(mergeListJson(local, '["a"]')).toBe(local);
        expect(mergeListJson(local, '{"x":1}')).toBe(local);
        expect(mergeListJson(local, undefined)).toBe(local);
    });

    it('restores onto an empty or corrupt device', () => {
        expect(mergeListJson(null, '["a","a","b"]')).toBe('["a","b"]');
        expect(mergeListJson('oops', '["a"]')).toBe('["a"]');
    });
});

describe('mergeMaxMapJson', () => {
    it('takes the higher value per id', () => {
        expect(JSON.parse(mergeMaxMapJson('{"a":50,"b":10}', '{"a":20,"b":40,"c":100}')!)).toEqual({ a: 50, b: 40, c: 100 });
        expect(mergeMaxMapJson('{"a":50}', '{"a":20}')).toBe('{"a":50}');
    });
});

describe('mergeBoostBank', () => {
    it('only ever raises the bank', () => {
        expect(mergeBoostBank('3', '10')).toBe('10');
        expect(mergeBoostBank('10', '3')).toBe('10');
        expect(mergeBoostBank(null, '7')).toBe('7');
        expect(mergeBoostBank('4', undefined)).toBe('4');
        expect(mergeBoostBank('4', 'x')).toBe('4');
        expect(mergeBoostBank('4', '-9')).toBe('4');
    });
});

describe('mergeBackupValue', () => {
    it('restores the theme only onto a device without one', () => {
        expect(mergeBackupValue(BACKUP_KEYS.appearance, null, 'dark')).toBe('dark');
        expect(mergeBackupValue(BACKUP_KEYS.appearance, 'light', 'dark')).toBe('light');
        expect(mergeBackupValue(BACKUP_KEYS.kit, null, 'floodlights')).toBe('floodlights');
        expect(mergeBackupValue(BACKUP_KEYS.kit, 'bib', 'floodlights')).toBe('bib');
    });

    it('backs up the keys useTheme actually writes', () => {
        expect(BACKUP_KEYS.appearance).toBe(APPEARANCE_STORAGE_KEY);
        expect(BACKUP_KEYS.kit).toBe(KIT_STORAGE_KEY);
    });

    it('restores the prepaid list only alongside a fresh purchase record', () => {
        expect(mergeBackupValue(BACKUP_KEYS.boostPrepaid, null, '["xb5"]')).toBeNull();
        expect(mergeBackupValue(BACKUP_KEYS.boostPrepaid, null, '["xb5"]', { freshPurchaseRecord: true })).toBe('["xb5"]');
    });

    it('unions credited transactions', () => {
        expect(mergeBackupValue(BACKUP_KEYS.boostTransactions, '["t1"]', '["t2"]')).toBe('["t1","t2"]');
    });
});
