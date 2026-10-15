import { describe, expect, it } from 'vitest';
import type { ShareCell, WeeklyRecap } from '../shared/daily2-types';
import { DAILY_SCHEDULE } from '../shared/daily2-rules';
import {
    archiveRowText,
    clueChipText,
    dailyHeading,
    formatPoints,
    fullTimeStatusLine,
    objectiveRuleLine,
    perfectXIsLine,
    percentileLine,
    rankPill,
    recapBars,
    recapTotalLine,
    scoreBreakdown,
    shareGridRows,
    statNoun,
    streakLine,
    weekScheduleRows,
} from '../app/utils/daily-screens';

const noHelps = { reroll: false, clue: false, bench: false };

describe('daily header copy', () => {
    it('builds the heading from the UK date and formation', () => {
        expect(dailyHeading('2026-10-14', '433')).toBe('Daily · Wed 14 Oct · 4-3-3');
    });

    it('names the stat each day counts', () => {
        expect(statNoun('ga')).toBe('goals + assists');
        expect(statNoun('goals')).toBe('goals');
        expect(statNoun('assists')).toBe('assists');
    });

    it('has a rule line for every objective kind', () => {
        expect(objectiveRuleLine({ kind: 'exact', stat: 'goals', value: 137 })).toContain('exactly 137');
        expect(objectiveRuleLine({ kind: 'exact', stat: 'goals', value: 137 })).toContain('goals');
        expect(objectiveRuleLine({ kind: 'over', stat: 'ga', value: 380 })).toContain('past 380');
        expect(objectiveRuleLine({ kind: 'under', stat: 'ga', value: 160 })).toContain('Reaching 160 is a bust');
        expect(objectiveRuleLine({ kind: 'allUnder', stat: 'ga', value: 30 })).toContain('captain doubled');
    });

    it('labels the status pill by ranking', () => {
        expect(rankPill(true, null, false)).toEqual({ label: 'Counts for today\'s table', tone: 'ranked' });
        expect(rankPill(null, null, false).tone).toBe('pending');
        expect(rankPill(false, 'not_first', false).label).toBe('Practice: your first go today already counted');
        expect(rankPill(false, 'late', false).tone).toBe('practice');
        expect(rankPill(false, 'archive', true)).toEqual({ label: 'Archive · doesn\'t count', tone: 'archive' });
    });

    it('words the scouting report by stat', () => {
        expect(clueChipText({ label: '31–60' }, 'ga')).toBe('Scouting report: 31–60 goals + assists');
        expect(clueChipText({ label: '100+' }, 'assists')).toBe('Scouting report: 100+ assists');
    });
});

describe('full-time copy', () => {
    it('gives the status line for each outcome and kind', () => {
        expect(fullTimeStatusLine({ status: 'won', total: 433, value: 433, filledBeforeBust: null }, 'exact')).toBe('Perfect XI!');
        expect(fullTimeStatusLine({ status: 'won', total: 391, value: 380, filledBeforeBust: null }, 'over')).toBe('Cleared 380!');
        expect(fullTimeStatusLine({ status: 'won', total: 151, value: 160, filledBeforeBust: null }, 'under')).toBe('Stayed under 160!');
        expect(fullTimeStatusLine({ status: 'won', total: 80, value: 30, filledBeforeBust: null }, 'allUnder')).toBe('Every player under 30!');
        expect(fullTimeStatusLine({ status: 'lost', total: 401, value: 433, filledBeforeBust: null }, 'exact')).toBe('32 short of 433');
        // Over needs total > V, so 380 on 380 is still one short.
        expect(fullTimeStatusLine({ status: 'lost', total: 380, value: 380, filledBeforeBust: null }, 'over')).toBe('1 short of clearing 380');
        expect(fullTimeStatusLine({ status: 'bust', total: 450, value: 433, filledBeforeBust: 8 }, 'exact')).toBe('Bust after 8 slots');
        expect(fullTimeStatusLine({ status: 'bust', total: 450, value: 433, filledBeforeBust: 1 }, 'exact')).toBe('Bust after 1 slot');
    });

    it('breaks the score down by help used', () => {
        expect(scoreBreakdown({ base: 1000 }, noHelps)).toBe('Base 1,000');
        expect(scoreBreakdown({ base: 648 }, { reroll: false, clue: true, bench: false })).toBe('Base 648 · Clue −50');
        expect(scoreBreakdown({ base: 1000 }, { reroll: true, clue: true, bench: true })).toBe('Base 1,000 · Reroll −50 · Clue −50 · Bench −100');
    });

    it('words the percentile ranked, first-in and unranked', () => {
        expect(percentileLine({ beatPct: 74, players: 1203 }, true, true)).toBe('You beat 74% of players · 1,203 played today');
        expect(percentileLine({ beatPct: null, players: 1 }, true, true)).toBe('You\'re first in today. Check back later.');
        expect(percentileLine(null, true, true)).toBe('You\'re first in today. Check back later.');
        expect(percentileLine({ beatPct: 61, players: 900 }, false, false)).toBe('On the day you\'d have beaten 61% · 900 played that day');
        expect(percentileLine({ beatPct: 100, players: 2 }, false, true)).toBe('Practice run: you\'d have beaten 100% · 2 played today');
        expect(percentileLine(null, false, false)).toBeNull();
    });

    it('counts perfect XIs, or winning XIs for the other kinds', () => {
        expect(perfectXIsLine({ perfectXIs: 12, totalXIs: 19683 }, 'exact')).toBe('There were 12 perfect XIs out of 19,683');
        expect(perfectXIsLine({ perfectXIs: 1, totalXIs: 729 }, 'exact')).toBe('There was 1 perfect XI out of 729');
        expect(perfectXIsLine({ perfectXIs: 40, totalXIs: 729 }, 'under')).toBe('40 of 729 XIs would have won');
    });

    it('shows the played streak and the win streak', () => {
        expect(streakLine(4, 2)).toBe('🔥 4-day streak · 2 wins in a row');
        expect(streakLine(1, 1)).toBe('🔥 1-day streak · 1 win in a row');
    });

    it('groups points with commas', () => {
        expect(formatPoints(1000)).toBe('1,000');
        expect(formatPoints(598)).toBe('598');
    });
});

describe('archive, schedule and recap', () => {
    it('formats an archive row', () => {
        expect(archiveRowText({
            date: '2026-10-13',
            formationCode: '352',
            objective: { kind: 'allUnder', stat: 'ga', value: 30, label: 'Keep every player under 30' },
            players: 1045,
        })).toBe('Tue 13 Oct · 3-5-2 · Keep every player under 30 · 1,045 played');
        expect(archiveRowText({
            date: '2026-10-13',
            formationCode: '352',
            objective: { kind: 'allUnder', stat: 'ga', value: 30, label: 'Keep every player under 30' },
            players: null,
        })).not.toContain('played');
    });

    it('lists the weekly rhythm Monday to Sunday', () => {
        const rows = weekScheduleRows(DAILY_SCHEDULE);

        expect(rows.map((row) => row.day)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
        expect(rows[0]!.label).toBe('Score over a target');
        expect(rows[1]!.label).toBe('Keep every player under a limit');
        expect(rows[4]!.label).toBe('Land exactly on a goals target');
        expect(rows[5]!.label).toBe('Land exactly on an assists target');
        expect(rows[6]!.label).toContain('(hardest)');
    });

    it('builds seven recap bars, with missed days empty', () => {
        const recap: WeeklyRecap = {
            start: '2026-10-12',
            end: '2026-10-18',
            days: [
                { date: '2026-10-12', weekday: 0, formationCode: '442', objective: { kind: 'over', stat: 'ga', value: 380, label: '' }, players: 10, median: 500, p90: 900, you: { score: 812, beatPct: 70 } },
                { date: '2026-10-13', weekday: 1, formationCode: '433', objective: { kind: 'allUnder', stat: 'ga', value: 30, label: '' }, players: 8, median: null, p90: null, you: null },
            ],
            week: { players: 10, median: 900, you: { total: 812, played: 1, beatPct: 68 } },
        };
        const bars = recapBars(recap);

        expect(bars).toHaveLength(7);
        expect(bars[0]).toEqual({ date: '2026-10-12', day: 'Mon', youPct: 81.2, youLabel: '812', medianPct: 50 });
        expect(bars[1]).toMatchObject({ youPct: null, youLabel: '—', medianPct: null });
        expect(bars[6]).toMatchObject({ date: '2026-10-18', day: 'Sun', youLabel: '—' });
        expect(recapTotalLine(recap)).toBe('Week total 812 · beat 68% of players');
        expect(recapTotalLine({ week: { players: 0, median: null, you: null } })).toBe('No Dailies played this week yet.');
    });

    it('orders share grid rows attack to keeper', () => {
        const grid: ShareCell[] = [
            { slotId: 'gk', group: 'GK', level: 'locked', captain: false, benched: false },
            { slotId: 'd1', group: 'DEF', level: 'best', captain: false, benched: false },
            { slotId: 'd2', group: 'DEF', level: 'poor', captain: true, benched: false },
            { slotId: 'f1', group: 'FWD', level: 'bust', captain: false, benched: false },
        ];

        expect(shareGridRows(grid)).toEqual([['bust'], ['best', 'poor'], ['locked']]);
    });
});
