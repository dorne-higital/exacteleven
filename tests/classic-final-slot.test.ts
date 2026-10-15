import { describe, expect, it } from 'vitest';
import { drawClassicCandidates, drawWithViabilityBias, finalSlotViable } from '../server/utils/classic-draw';
import { getPlayersByPosition } from '../server/utils/players';
import { FINAL_SLOT_EXACT_CHANCE, titleWindowFor } from '../shared/classic';
import { mulberry32 } from '../shared/daily';
import type { Player } from '../shared/types';

// Last-pick fairness (spec §1.8): the guaranteed option on the FINAL slot of
// an exact game lands exactly only FINAL_SLOT_EXACT_CHANCE of the time, and
// in the Title window (gap − W … gap − 1) otherwise.

const constant = (value: number) => () => value;
const ident = (value: number): number => value;
// Values 0..40 as stand-in "players".
const pool = Array.from({ length: 41 }, (_, index) => index);

describe('titleWindowFor', () => {
    it('is 1.5% of the target, rounded, at least 1 — 5 to 8 across the formations', () => {
        expect(['343', '352', '433', '442', '451', '532', '541'].map((code) => titleWindowFor(Number(code))))
            .toEqual([5, 5, 6, 7, 7, 8, 8]);
        expect(titleWindowFor(10)).toBe(1);
        expect(titleWindowFor(0)).toBe(1);
    });
});

describe('finalSlotViable', () => {
    // Target 433 → W = 6. Gap 20 → window 14..19.
    it('lands exactly when the roll is under the exact chance', () => {
        expect(finalSlotViable(pool, 20, 433, ident, constant(FINAL_SLOT_EXACT_CHANCE - 0.01))).toEqual([20]);
    });

    it('lands in the Title window otherwise', () => {
        expect(finalSlotViable(pool, 20, 433, ident, constant(FINAL_SLOT_EXACT_CHANCE + 0.01))).toEqual([14, 15, 16, 17, 18, 19]);
    });

    it('falls back to the window when nothing lands exactly — but never from the window to exact', () => {
        const noExact = pool.filter((value) => value !== 20);
        const noWindow = pool.filter((value) => value < 14 || value > 19);

        expect(finalSlotViable(noExact, 20, 433, ident, constant(0))).toEqual([14, 15, 16, 17, 18, 19]);
        // An empty window means no guarantee (plain random), not a free exact option.
        expect(finalSlotViable(noWindow, 20, 433, ident, constant(0.99))).toEqual([]);
        expect(finalSlotViable(noWindow, 20, 433, ident, constant(0))).toEqual([20]);
    });

    it('gives no guarantee at a gap of 0 two times in three (the window is empty there)', () => {
        expect(finalSlotViable(pool, 0, 433, ident, constant(0.99))).toEqual([]);
        expect(finalSlotViable(pool, 0, 433, ident, constant(0))).toEqual([0]);
    });

    it('gives nothing to guarantee when both are empty, or when already past the target', () => {
        expect(finalSlotViable([0, 1, 2], 20, 433, ident, constant(0))).toEqual([]);
        expect(finalSlotViable([0, 1, 2], 20, 433, ident, constant(0.99))).toEqual([]);
        expect(finalSlotViable(pool, -1, 433, ident, constant(0))).toEqual([]);
    });

    it('never lets the window reach below zero or include the exact value', () => {
        // Gap 3, W 6 → window is 0..2 (values below 0 don't exist).
        expect(finalSlotViable(pool, 3, 433, ident, constant(0.99))).toEqual([0, 1, 2]);
    });

    it('picks exact about a third of the time over many seeded rolls', () => {
        const rng = mulberry32(42);
        let exact = 0;
        const runs = 3000;

        for (let i = 0; i < runs; i += 1) {
            if (finalSlotViable(pool, 20, 433, ident, rng).includes(20)) {
                exact += 1;
            }
        }

        expect(exact / runs).toBeGreaterThan(0.29);
        expect(exact / runs).toBeLessThan(0.38);
    });
});

describe('drawWithViabilityBias', () => {
    it('always includes one viable option among 3 distinct candidates', () => {
        const rng = mulberry32(7);
        const items = pool.map((value) => ({ id: `p${value}`, value }));
        const viable = items.filter((item) => item.value === 33);

        for (let i = 0; i < 200; i += 1) {
            const drawn = drawWithViabilityBias(items, viable, 3, rng);

            expect(new Set(drawn.map((item) => item.id)).size).toBe(3);
            expect(drawn.some((item) => item.value === 33)).toBe(true);
        }
    });
});

describe('drawClassicCandidates — final slot of an exact game', () => {
    const value = (player: Player): number => player.goals + player.assists;

    it('guarantees an exact or Title-window option, and is exact only some of the time', () => {
        const fwds = getPlayersByPosition('FWD');
        // A gap with plenty of exact and window players in the real pool.
        const gap = 20;
        const target = 433;
        const W = titleWindowFor(target);
        const rng = mulberry32(2026);
        let exactCount = 0;
        const runs = 600;

        for (let i = 0; i < runs; i += 1) {
            const drawn = drawClassicCandidates({
                group: 'FWD',
                excludeIds: new Set(),
                bias: { otherRemaining: [], objectiveKind: 'exact', objectiveValue: target, runningTotal: target - gap },
                rng,
            });
            const values = drawn.map(value);

            expect(drawn).toHaveLength(3);
            expect(values.some((v) => v === gap || (v >= gap - W && v <= gap - 1))).toBe(true);

            if (values.includes(gap)) {
                exactCount += 1;
            }
        }

        // ~1/3 guaranteed, plus the chance a random option lands exactly anyway.
        const randomExact = fwds.filter((player) => value(player) === gap).length / fwds.length;

        expect(exactCount / runs).toBeGreaterThan(0.25);
        expect(exactCount / runs).toBeLessThan(FINAL_SLOT_EXACT_CHANCE + 2 * randomExact + 0.08);
    });

    it('keeps earlier slots on the plain "a win stays possible" guarantee', () => {
        const rng = mulberry32(5);
        const drawn = drawClassicCandidates({
            group: 'MID',
            excludeIds: new Set(),
            bias: { otherRemaining: ['FWD'], objectiveKind: 'exact', objectiveValue: 433, runningTotal: 400 },
            rng,
        });

        expect(drawn).toHaveLength(3);
        // Some MID + some FWD can still land on 33.
        const fwdValues = new Set(getPlayersByPosition('FWD').map(value));

        expect(drawn.some((player) => fwdValues.has(33 - value(player)))).toBe(true);
    });

    it('draws plain random without bias inputs, and never repeats an excluded id', () => {
        const exclude = new Set(getPlayersByPosition('GK').slice(0, 20).map((player) => player.id));
        const drawn = drawClassicCandidates({ group: 'GK', excludeIds: exclude, bias: null, rng: mulberry32(1) });

        expect(drawn).toHaveLength(3);
        expect(drawn.every((player) => !exclude.has(player.id))).toBe(true);
    });
});
