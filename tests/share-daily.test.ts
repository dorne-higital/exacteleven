import { describe, expect, it } from 'vitest';
import type { DailySubmitResponse, ShareCell, ShareLevel, WeeklyRecap } from '../shared/daily2-types';
import type { PositionGroup } from '../shared/types';
import { buildDailyShareText, buildWeeklyRecapShareText, formationLabel, shareGridLines, shortDateLabel } from '../app/utils/share-daily';

function cell(slotId: string, group: PositionGroup, level: ShareLevel): ShareCell {
    return { slotId, group, level, captain: false, benched: false };
}

// 4-3-3 in formation slot order (GK, DEF, MID, FWD).
const GRID_433: ShareCell[] = [
    cell('gk', 'GK', 'locked'),
    cell('def-1', 'DEF', 'good'), cell('def-2', 'DEF', 'best'), cell('def-3', 'DEF', 'best'), cell('def-4', 'DEF', 'poor'),
    cell('mid-1', 'MID', 'best'), cell('mid-2', 'MID', 'poor'), cell('mid-3', 'MID', 'good'),
    cell('fwd-1', 'FWD', 'best'), cell('fwd-2', 'FWD', 'good'), cell('fwd-3', 'FWD', 'best'),
];

function result(score: number, beatPct: number | null, grid = GRID_433): Pick<DailySubmitResponse, 'score' | 'percentile' | 'fullTime'> {
    return {
        score: { score, status: 'lost', base: score, helpsCost: 0, total: 0, value: 433, filledBeforeBust: null },
        percentile: beatPct === null ? null : { beatPct, players: 10 },
        fullTime: { perfectXIs: 1, totalXIs: 1, bestXI: { picks: [], captainSlotId: 'gk', total: 0 }, yourXI: [], passedOn: [], grid },
    };
}

const PUZZLE = { date: '2026-10-14', formationCode: '433' as const, objective: { kind: 'exact' as const, stat: 'ga' as const, value: 433, label: 'Land exactly on 433' } };

describe('share-daily', () => {
    it('formats the date and formation with fixed English names', () => {
        expect(shortDateLabel('2026-10-14')).toBe('Wed 14 Oct');
        expect(shortDateLabel('2026-01-04')).toBe('Sun 4 Jan');
        expect(formationLabel('433')).toBe('4-3-3');
    });

    it('draws rows attack first, keeper last, in slot order, centred on the widest row', () => {
        expect(shareGridLines(GRID_433)).toEqual([
            ' 🟥🟧🟥',
            ' 🟥⬜🟧',
            '🟧🟥🟥⬜',
            '   🟦',
        ]);
    });

    it('maps every level to its emoji', () => {
        const grid = (['best', 'good', 'poor', 'bust', 'locked', 'empty'] as const).map((level, index) => cell(`def-${index + 1}`, 'DEF', level));

        expect(shareGridLines(grid)).toEqual(['🟥🟧⬜⬛🟦▫️']);
    });

    it('builds the full share text', () => {
        expect(buildDailyShareText(PUZZLE, result(812, 74))).toBe([
            'Exact XI Daily · Wed 14 Oct · 4-3-3',
            'Land exactly on 433 · 812/1000 · beat 74%',
            ' 🟥🟧🟥',
            ' 🟥⬜🟧',
            '🟧🟥🟥⬜',
            '   🟦',
            'exacteleven.co.uk/daily',
        ].join('\n'));
    });

    it('adds "(C) blind" after the score, and leaves out a missing percentile', () => {
        const text = buildDailyShareText(PUZZLE, result(598, null), { captainBlind: true });

        expect(text.split('\n')[1]).toBe('Land exactly on 433 · 598/1000 (C) blind');
    });

    it('never includes a player name', () => {
        expect(buildDailyShareText(PUZZLE, result(950, 10))).not.toMatch(/Player|name/i);
    });

    it('builds the weekly recap share', () => {
        const day = (date: string, score: number | null) => ({
            date, weekday: 0 as const, formationCode: '442' as const,
            objective: PUZZLE.objective, players: 5, median: 500, p90: 900,
            you: score === null ? null : { score, beatPct: 50 },
        });
        const recap: WeeklyRecap = {
            start: '2026-10-12',
            end: '2026-10-18',
            days: [day('2026-10-12', 900), day('2026-10-13', null), day('2026-10-14', 410)],
            week: { players: 20, median: 2000, you: { total: 1310, played: 2, beatPct: 68 } },
        };

        expect(buildWeeklyRecapShareText(recap)).toBe([
            'Exact XI Daily · week of Mon 12 Oct',
            'Mon 900 · Tue — · Wed 410',
            'Week total 1,310 · beat 68%',
            'exacteleven.co.uk/daily',
        ].join('\n'));
    });
});
