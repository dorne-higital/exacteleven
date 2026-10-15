import { describe, expect, it } from 'vitest';
import {
    clueBandFor,
    createDailyEngine,
    DAILY_SCHEDULE,
    dailyFormationFor,
    dailyObjectiveLabel,
    dailyWeekday,
    mondayOf,
    parseDailyMoves,
    projectedDailyScore,
    replayDaily,
    scoreDaily,
    shareLevels,
    type DailyView,
} from '../shared/daily2-rules';
import type { DailyMove, DailySnapshot } from '../shared/daily2-types';
import type { ObjectiveKind, PositionGroup } from '../shared/types';
import { addDays } from '../shared/uk-date';

// A small synthetic Daily: 1 locked defender (10) + 4 open slots.
const VALUES: Record<string, number> = {
    g1: 0, g2: 1, g3: 2, gs: 1,
    d1: 5, d2: 10, d3: 15, d4: 3, d5: 6, d6: 9, ds: 7,
    m1: 8, m2: 12, m3: 20, ms: 11,
    f1: 4, f2: 10, f3: 30, fs: 9,
};
const SUBS: Record<string, string> = { 'gk': 'gs', 'def-2': 'ds', 'mid-1': 'ms', 'fwd-1': 'fs' };
const ORDER: Array<{ slotId: string; group: PositionGroup }> = [
    { slotId: 'gk', group: 'GK' },
    { slotId: 'def-1', group: 'DEF' },
    { slotId: 'def-2', group: 'DEF' },
    { slotId: 'mid-1', group: 'MID' },
    { slotId: 'fwd-1', group: 'FWD' },
];

function view(kind: ObjectiveKind, value: number): DailyView {
    return {
        objective: { kind, value },
        locked: [{ slotId: 'def-1', value: 10 }],
        slots: [
            { slotId: 'gk', main: ['g1', 'g2', 'g3'] },
            { slotId: 'def-2', main: ['d1', 'd2', 'd3'], reroll: ['d4', 'd5', 'd6'] },
            { slotId: 'mid-1', main: ['m1', 'm2', 'm3'] },
            { slotId: 'fwd-1', main: ['f1', 'f2', 'f3'] },
        ],
    };
}

const valueOf = (id: string): number | undefined => VALUES[id];
const subFor = (slotId: string): string | undefined => SUBS[slotId];
const pick = (slotId: string, playerId: string): DailyMove => ({ t: 'pick', slotId, playerId });

function play(kind: ObjectiveKind, value: number, moves: DailyMove[]) {
    return replayDaily(view(kind, value), moves, valueOf, subFor);
}

function snapshotOf(kind: ObjectiveKind, value: number, moves: DailyMove[]): DailySnapshot {
    const result = play(kind, value, moves);

    if (!result.ok) {
        throw new Error(`unexpected ${result.error} at ${result.at}`);
    }

    return result.snapshot;
}

// The winning line for exact 40: 10 locked + 0 + 10 + 12 + (4 × 2, blind captain).
const WIN_40: DailyMove[] = [
    pick('gk', 'g1'),
    pick('def-2', 'd2'),
    pick('mid-1', 'm2'),
    { t: 'captain', slotId: 'fwd-1' },
    pick('fwd-1', 'f1'),
];

describe('replayDaily — picks, captain and results', () => {
    it('wins an exact game with a blind captain and scores 1000', () => {
        const snapshot = snapshotOf('exact', 40, WIN_40);

        expect(snapshot).toMatchObject({ status: 'won', total: 40, filled: 5, captainSlotId: 'fwd-1', captainBlind: true, score: 1000 });
        expect(snapshot.openSlotIds).toEqual([]);
    });

    it('a completed exact XI under the target is a miss ("lost") scored by closeness', () => {
        const snapshot = snapshotOf('exact', 50, WIN_40);

        expect(snapshot.status).toBe('lost');
        expect(snapshot.score).toBe(Math.round((700 * 40) / 50));
    });

    it('requires a captain before the final pick, but allows naming the last open slot', () => {
        const moves = [pick('gk', 'g1'), pick('def-2', 'd2'), pick('mid-1', 'm2'), pick('fwd-1', 'f1')];

        expect(play('exact', 40, moves)).toEqual({ ok: false, error: 'captain_required', at: 3 });
        expect(snapshotOf('exact', 40, WIN_40).status).toBe('won');
    });

    it('rejects picks that were not offered, locked or already-filled slots, and unknown slots', () => {
        expect(play('exact', 40, [pick('gk', 'f1')])).toMatchObject({ ok: false, error: 'not_offered' });
        expect(play('exact', 40, [pick('def-1', 'd1')])).toMatchObject({ ok: false, error: 'slot_locked' });
        expect(play('exact', 40, [pick('gk', 'g1'), pick('gk', 'g2')])).toMatchObject({ ok: false, error: 'slot_filled', at: 1 });
        expect(play('exact', 40, [pick('mid-9', 'm1')])).toMatchObject({ ok: false, error: 'bad_move' });
    });

    it('a safe captain doubles a revealed player; it can only be named once', () => {
        const snapshot = snapshotOf('exact', 100, [pick('mid-1', 'm2'), { t: 'captain', slotId: 'mid-1' }]);

        expect(snapshot).toMatchObject({ total: 10 + 24, captainSlotId: 'mid-1', captainBlind: false });
        expect(play('exact', 100, [pick('mid-1', 'm2'), { t: 'captain', slotId: 'mid-1' }, { t: 'captain', slotId: 'gk' }]))
            .toMatchObject({ ok: false, error: 'captain_set' });
        expect(play('exact', 100, [{ t: 'captain', slotId: 'def-1' }])).toMatchObject({ ok: false, error: 'slot_locked' });
    });

    it('refuses a captain that would bust you on the spot (exact, under, allUnder)', () => {
        // exact 40: 10 + 30 = 40; doubling the 30 → 70.
        expect(play('exact', 40, [pick('fwd-1', 'f3'), { t: 'captain', slotId: 'fwd-1' }]))
            .toMatchObject({ ok: false, error: 'captain_would_bust' });
        // under 30: 10 + 12 = 22; doubling → 34 ≥ 30.
        expect(play('under', 30, [pick('mid-1', 'm2'), { t: 'captain', slotId: 'mid-1' }]))
            .toMatchObject({ ok: false, error: 'captain_would_bust' });
        // allUnder 20: 12 doubled = 24 ≥ 20.
        expect(play('allUnder', 20, [pick('mid-1', 'm2'), { t: 'captain', slotId: 'mid-1' }]))
            .toMatchObject({ ok: false, error: 'captain_would_bust' });
        // Over has no bust, so any captain goes.
        expect(play('over', 1000, [pick('fwd-1', 'f3'), { t: 'captain', slotId: 'fwd-1' }]).ok).toBe(true);
    });

    it('an over objective wins the moment it is cleared, even with slots left', () => {
        const snapshot = snapshotOf('over', 45, [pick('fwd-1', 'f3'), pick('mid-1', 'm2')]);

        expect(snapshot).toMatchObject({ status: 'won', total: 52, score: 1000 });
        expect(snapshot.openSlotIds).toHaveLength(2);
        expect(play('over', 45, [pick('fwd-1', 'f3'), pick('mid-1', 'm2'), pick('gk', 'g1')]))
            .toMatchObject({ ok: false, error: 'game_over' });
    });

    it('an under objective wins by finishing below the target; reaching it is a bust', () => {
        expect(snapshotOf('under', 41, WIN_40)).toMatchObject({ status: 'won', score: 1000 });
        // Landing ON the target is already a bust for "stay under" (pending, with the bench unused).
        expect(snapshotOf('under', 40, WIN_40)).toMatchObject({ status: 'playing', pendingBust: { slotId: 'fwd-1' } });
    });

    it('allUnder busts on any counted player at or over the limit, captain doubled', () => {
        const blind = [pick('gk', 'g1'), pick('def-2', 'd1'), { t: 'captain', slotId: 'mid-1' } as DailyMove, pick('mid-1', 'm2')];
        const snapshot = snapshotOf('allUnder', 20, blind);

        expect(snapshot.pendingBust).toEqual({ slotId: 'mid-1' });
    });
});

describe('replayDaily — the bench and pending busts', () => {
    // exact 40 with 10 locked: f3 (30) then m2 (12) = 52 → bust.
    const BUSTING: DailyMove[] = [pick('fwd-1', 'f3'), pick('mid-1', 'm2')];

    it('a bust with the bench unused waits for "use the bench or take the bust"', () => {
        const snapshot = snapshotOf('exact', 40, BUSTING);

        expect(snapshot).toMatchObject({ status: 'playing', pendingBust: { slotId: 'mid-1' }, score: null });
        expect(play('exact', 40, [...BUSTING, pick('gk', 'g1')])).toMatchObject({ ok: false, error: 'pending_bust' });
        expect(play('exact', 40, [...BUSTING, { t: 'reroll', slotId: 'def-2' }])).toMatchObject({ ok: false, error: 'pending_bust' });
    });

    it('taking the bust scores 25 per slot filled before it', () => {
        const snapshot = snapshotOf('exact', 40, [...BUSTING, { t: 'acceptBust' }]);

        // 3 filled (locked + 2 picks) minus the busting slot = 2.
        expect(snapshot).toMatchObject({ status: 'bust', score: 50 });
        expect(play('exact', 40, [{ t: 'acceptBust' }])).toMatchObject({ ok: false, error: 'no_pending_bust' });
    });

    it('the bench can rescue a pending bust and play continues', () => {
        // Take the 30 off: sub fs (9) → 10 + 9 + 12 = 31.
        const snapshot = snapshotOf('exact', 40, [...BUSTING, { t: 'bench', slotId: 'fwd-1' }]);

        expect(snapshot).toMatchObject({
            status: 'playing',
            pendingBust: null,
            total: 31,
            bench: { slotId: 'fwd-1', outId: 'f3', subId: 'fs' },
            helps: { reroll: false, clue: false, bench: true },
        });
    });

    it('a bench that does not get you back under is a bust', () => {
        // Benching the 12 for 11: 10 + 30 + 11 = 51 > 40.
        const snapshot = snapshotOf('exact', 40, [...BUSTING, { t: 'bench', slotId: 'mid-1' }]);

        expect(snapshot).toMatchObject({ status: 'bust', score: Math.max(0, 25 * 2 - 100) });
    });

    it('with the bench spent, a bust ends the game at once', () => {
        const moves: DailyMove[] = [pick('fwd-1', 'f1'), { t: 'bench', slotId: 'fwd-1' }, pick('mid-1', 'm3'), pick('def-2', 'd3')];
        const snapshot = snapshotOf('exact', 40, moves);

        // 10 + 9 + 20 + 15 = 54 → bust, 4 filled − 1 = 3 → 75 − 100 → 0.
        expect(snapshot).toMatchObject({ status: 'bust', pendingBust: null, score: 0 });
    });

    it('rejects a second bench, an empty slot and a locked slot', () => {
        expect(play('exact', 40, [{ t: 'bench', slotId: 'gk' }])).toMatchObject({ ok: false, error: 'slot_empty' });
        expect(play('exact', 40, [{ t: 'bench', slotId: 'def-1' }])).toMatchObject({ ok: false, error: 'slot_locked' });
        expect(play('exact', 40, [pick('gk', 'g1'), { t: 'bench', slotId: 'gk' }, { t: 'bench', slotId: 'gk' }]))
            .toMatchObject({ ok: false, error: 'bench_used' });
    });

    it('a benched captain slot keeps the armband for the sub', () => {
        const snapshot = snapshotOf('exact', 100, [pick('mid-1', 'm2'), { t: 'captain', slotId: 'mid-1' }, { t: 'bench', slotId: 'mid-1' }]);

        expect(snapshot.total).toBe(10 + 2 * 11);
    });

    it('needs the sub to be known (client: only once benched)', () => {
        const result = replayDaily(view('exact', 40), [pick('gk', 'g1'), { t: 'bench', slotId: 'gk' }], valueOf);

        expect(result).toMatchObject({ ok: false, error: 'bad_move' });
    });
});

describe('replayDaily — reroll and clue', () => {
    it('a reroll swaps the slot to its fixed reroll set, once', () => {
        const moves: DailyMove[] = [{ t: 'reroll', slotId: 'def-2' }, pick('def-2', 'd5')];

        expect(snapshotOf('exact', 100, moves)).toMatchObject({ rerolledSlotId: 'def-2', total: 16, helps: { reroll: true } });
        expect(play('exact', 100, [{ t: 'reroll', slotId: 'def-2' }, pick('def-2', 'd1')])).toMatchObject({ ok: false, error: 'not_offered' });
        expect(play('exact', 100, [{ t: 'reroll', slotId: 'def-2' }, { t: 'reroll', slotId: 'gk' }])).toMatchObject({ ok: false, error: 'reroll_used' });
        expect(play('exact', 100, [pick('gk', 'g1'), { t: 'reroll', slotId: 'gk' }])).toMatchObject({ ok: false, error: 'slot_filled' });
        expect(play('exact', 100, [{ t: 'reroll', slotId: 'def-1' }])).toMatchObject({ ok: false, error: 'slot_locked' });
    });

    it('client-side, an unknown reroll set skips the membership check', () => {
        const clientView = view('exact', 100);

        delete clientView.slots[1]!.reroll;

        expect(replayDaily(clientView, [{ t: 'reroll', slotId: 'def-2' }, pick('def-2', 'd5')], valueOf).ok).toBe(true);
    });

    it('a clue returns the raw band of one shown option, while 3+ slots are open', () => {
        expect(snapshotOf('exact', 100, [{ t: 'clue', slotId: 'fwd-1', playerId: 'f3' }]).clue)
            .toEqual({ slotId: 'fwd-1', playerId: 'f3', band: 'b1' });
        expect(play('exact', 100, [{ t: 'clue', slotId: 'fwd-1', playerId: 'm1' }])).toMatchObject({ ok: false, error: 'not_offered' });
        expect(play('exact', 100, [{ t: 'clue', slotId: 'gk', playerId: 'g1' }, { t: 'clue', slotId: 'gk', playerId: 'g2' }]))
            .toMatchObject({ ok: false, error: 'clue_used' });
        // 2 open slots left → locked.
        expect(play('exact', 100, [pick('gk', 'g1'), pick('def-2', 'd1'), { t: 'clue', slotId: 'fwd-1', playerId: 'f1' }]))
            .toMatchObject({ ok: false, error: 'clue_locked' });
    });

    it('a captain-doubled player still clues on the raw value; the client can pass the band it was told', () => {
        const result = replayDaily(view('exact', 100), [{ t: 'clue', slotId: 'fwd-1', playerId: 'f3' }], () => undefined, undefined, { clueBand: 'b2' });

        expect(result.ok && result.snapshot.clue?.band).toBe('b2');
    });
});

describe('scoreDaily — the §1.7 worked examples', () => {
    const base: DailySnapshot = {
        status: 'won', total: 0, filled: 11, openSlotIds: [], captainSlotId: 'gk', captainBlind: false, rerolledSlotId: null,
        clue: null, bench: null, pendingBust: null, helps: { reroll: false, clue: false, bench: false }, score: null,
    };
    const exact433 = { kind: 'exact' as const, value: 433 };

    it.each([
        ['Wed exact 433, lands 433, reroll used', { status: 'won', total: 433, helps: { reroll: true, clue: false, bench: false } }, exact433, 950],
        ['finishes 401, clue used', { status: 'lost', total: 401, helps: { reroll: false, clue: true, bench: false } }, exact433, 598],
        ['finishes 120, no help → floor', { status: 'lost', total: 120 }, exact433, 275],
        ['busts filling slot 9 (8 before), bench spent', { status: 'bust', total: 500, filled: 9, helps: { reroll: false, clue: false, bench: true } }, exact433, 100],
        ['Mon over 380 cleared after 8 picks', { status: 'won', total: 390, filled: 11 }, { kind: 'over' as const, value: 380 }, 1000],
        ['Mon over 380, complete on 342', { status: 'lost', total: 342 }, { kind: 'over' as const, value: 380 }, 630],
        ['Thu under 160, complete on 151, bench used', { status: 'won', total: 151, helps: { reroll: false, clue: false, bench: true } }, { kind: 'under' as const, value: 160 }, 900],
        ['Tue all under 30, first pick breaches with 2 locked', { status: 'bust', total: 40, filled: 3 }, { kind: 'allUnder' as const, value: 30 }, 50],
        ['Fri goals 137, complete on 129', { status: 'lost', total: 129 }, { kind: 'exact' as const, value: 137 }, 659],
    ])('%s → %i', (_label, patch, objective, expected) => {
        expect(scoreDaily({ ...base, ...patch } as DailySnapshot, objective).score).toBe(expected);
    });

    it('keeps win > miss > bust whatever the helps', () => {
        const allHelps = { reroll: true, clue: true, bench: true };
        const worstWin = scoreDaily({ ...base, status: 'won', helps: allHelps }, exact433).score;
        const bestMiss = scoreDaily({ ...base, status: 'lost', total: 432 }, exact433).score;
        const worstMiss = scoreDaily({ ...base, status: 'lost', total: 0, helps: allHelps }, exact433).score;
        const bestBust = scoreDaily({ ...base, status: 'bust', filled: 11 }, exact433).score;

        expect(worstWin).toBe(800);
        expect(worstWin).toBeGreaterThan(bestMiss);
        expect(worstMiss).toBe(275);
        expect(worstMiss).toBeGreaterThan(bestBust);
        expect(bestBust).toBe(250);
    });

    it('breaks a score down into base, help costs and the bust count', () => {
        expect(scoreDaily({ ...base, status: 'bust', filled: 9, total: 500, helps: { reroll: true, clue: false, bench: true } }, exact433))
            .toEqual({ score: 50, status: 'bust', base: 200, helpsCost: 150, total: 500, value: 433, filledBeforeBust: 8 });
    });

    it('projects the live score: miss on the current total, or the pending bust', () => {
        const live = snapshotOf('exact', 40, [pick('gk', 'g1')]);

        expect(projectedDailyScore(live, { kind: 'exact', value: 40 })).toBe(275);
        expect(projectedDailyScore(snapshotOf('exact', 40, [pick('fwd-1', 'f3'), pick('mid-1', 'm2')]), { kind: 'exact', value: 40 })).toBe(50);
        expect(projectedDailyScore(snapshotOf('under', 100, [pick('gk', 'g1')]), { kind: 'under', value: 100 })).toBeNull();
    });
});

describe('clue bands', () => {
    it.each([[0, 'b0'], [10, 'b0'], [11, 'b1'], [30, 'b1'], [31, 'b2'], [60, 'b2'], [61, 'b3'], [100, 'b3'], [101, 'b4'], [250, 'b4']])(
        '%i → %s',
        (value, band) => {
            expect(clueBandFor(value).id).toBe(band);
        },
    );
});

describe('shareLevels', () => {
    it('colours each pick against the options it was chosen from, plus locked/bust/empty', () => {
        const cells = shareLevels(view('exact', 40), WIN_40, valueOf, subFor, ORDER);
        const level = (slotId: string) => cells.find((cell) => cell.slotId === slotId)!.level;

        expect(cells.map((cell) => cell.slotId)).toEqual(ORDER.map((slot) => slot.slotId));
        expect(level('def-1')).toBe('locked');
        // Every winning pick was the best of its three (the others miss or bust).
        expect(level('gk')).toBe('best');
        expect(level('fwd-1')).toBe('best');
        expect(cells.find((cell) => cell.slotId === 'fwd-1')!.captain).toBe(true);
    });

    it('marks the busting slot and leaves unfilled slots empty', () => {
        const moves: DailyMove[] = [pick('fwd-1', 'f3'), pick('mid-1', 'm2'), { t: 'acceptBust' }];
        const cells = shareLevels(view('exact', 40), moves, valueOf, subFor, ORDER);
        const level = (slotId: string) => cells.find((cell) => cell.slotId === slotId)!.level;

        expect(level('mid-1')).toBe('bust');
        expect(level('gk')).toBe('empty');
        // f3 (30) left only 0 to play with — f1 or f2 would have scored more.
        expect(level('fwd-1')).toBe('poor');
    });

    it('splits equal scores by the total, so a bust grid is not all "best"', () => {
        // Under 50: 10 locked + 2 + 10 + 8, then a blind captain on 30 → 90, bust.
        // Any GK/DEF/MID swap still busts on the same pick (same score), so
        // the lower total is the better pick on an under day.
        const moves: DailyMove[] = [
            pick('gk', 'g3'),
            pick('def-2', 'd2'),
            pick('mid-1', 'm1'),
            { t: 'captain', slotId: 'fwd-1' },
            pick('fwd-1', 'f3'),
            { t: 'acceptBust' },
        ];
        const cells = shareLevels(view('under', 50), moves, valueOf, subFor, ORDER);
        const level = (slotId: string) => cells.find((cell) => cell.slotId === slotId)!.level;

        expect(level('fwd-1')).toBe('bust');
        expect(level('gk')).toBe('poor');
        expect(level('def-2')).toBe('good');
        expect(level('mid-1')).toBe('best');
    });

    it('keeps a benched slot on its original pick, flagged benched', () => {
        const moves: DailyMove[] = [pick('fwd-1', 'f3'), pick('mid-1', 'm2'), { t: 'bench', slotId: 'fwd-1' }];
        const cell = shareLevels(view('exact', 40), moves, valueOf, subFor, ORDER).find((entry) => entry.slotId === 'fwd-1')!;

        expect(cell.benched).toBe(true);
        expect(['best', 'good', 'poor']).toContain(cell.level);
    });
});

describe('parseDailyMoves', () => {
    it('accepts well-formed moves and rejects anything else', () => {
        expect(parseDailyMoves([...WIN_40, { t: 'acceptBust' }, { t: 'bench', slotId: 'gk' }, { t: 'reroll', slotId: 'def-2' }, { t: 'clue', slotId: 'gk', playerId: 'a-b' }]))
            .toHaveLength(9);
        expect(parseDailyMoves('nope')).toBeNull();
        expect(parseDailyMoves([{ t: 'pick', slotId: 'gk' }])).toBeNull();
        expect(parseDailyMoves([{ t: 'teleport', slotId: 'gk' }])).toBeNull();
        expect(parseDailyMoves([{ t: 'pick', slotId: '../x', playerId: 'a' }])).toBeNull();
        expect(parseDailyMoves(new Array(40).fill({ t: 'acceptBust' }))).toBeNull();
    });
});

describe('weekly schedule', () => {
    it('starts weeks on Monday and follows the weekly rhythm', () => {
        expect(dailyWeekday('2026-10-12')).toBe(0); // a Monday
        expect(dailyWeekday('2026-10-18')).toBe(6);
        expect(mondayOf('2026-10-18')).toBe('2026-10-12');
        expect(mondayOf('2026-10-12')).toBe('2026-10-12');
        expect(Object.values(DAILY_SCHEDULE).map((rule) => `${rule.kind}:${rule.stat}`)).toEqual([
            'over:ga', 'allUnder:ga', 'exact:ga', 'under:ga', 'exact:goals', 'exact:assists', 'exact:ga',
        ]);
    });

    it('uses all 7 formations every week, and consecutive weeks differ', () => {
        let previous: string[] | null = null;

        for (let week = 0; week < 8; week += 1) {
            const formations = Array.from({ length: 7 }, (_, day) => dailyFormationFor(addDays('2026-10-12', week * 7 + day)));

            expect(new Set(formations).size).toBe(7);

            if (previous) {
                expect(formations).not.toEqual(previous);
            }

            previous = formations;
        }
    });

    it('labels every objective kind and stat', () => {
        expect(dailyObjectiveLabel('exact', 'ga', 433)).toBe('Land exactly on 433');
        expect(dailyObjectiveLabel('exact', 'goals', 137)).toBe('Land exactly on 137 goals');
        expect(dailyObjectiveLabel('exact', 'assists', 99)).toBe('Land exactly on 99 assists');
        expect(dailyObjectiveLabel('over', 'ga', 380)).toBe('Score over 380');
        expect(dailyObjectiveLabel('under', 'ga', 160)).toBe('Stay under 160');
        expect(dailyObjectiveLabel('allUnder', 'ga', 30)).toBe('Keep every player under 30');
    });
});

describe('createDailyEngine', () => {
    it('reports the original picks and the set each came from', () => {
        const engine = createDailyEngine(view('exact', 100), valueOf, subFor);

        engine.apply({ t: 'reroll', slotId: 'def-2' });
        engine.apply(pick('def-2', 'd4'));
        engine.apply(pick('gk', 'g2'));

        expect(engine.pickedFrom().get('def-2')).toBe('reroll');
        expect(engine.pickedFrom().get('gk')).toBe('main');
        expect(engine.originalPicks().get('def-2')).toBe('d4');
    });
});
