import { describe, expect, it } from 'vitest';
import { getFormation } from '../app/utils/formations';
import { DAILY_SCHEDULE, dailyFormationFor, dailyLockCount, dayStatValue } from '../shared/daily2-rules';
import type { Player } from '../shared/types';
import { addDays } from '../shared/uk-date';
import { type DailyPuzzleFull, generateDailyPuzzle, groupPools } from '../server/utils/daily2-generate';
import { getPlayersByPosition } from '../server/utils/players';
import { fixedSetWinOdds } from '../server/utils/win-odds';

const pools = groupPools((['GK', 'DEF', 'MID', 'FWD'] as const).flatMap((group) => getPlayersByPosition(group)));
const MONDAY = '2026-10-12';

function generate(date: string): DailyPuzzleFull {
    return generateDailyPuzzle(date, pools, getFormation(dailyFormationFor(date))!);
}

// Brute force: every (main XI, captain) pair, for cross-checking the DP.
function bruteForceWinPairs(puzzle: DailyPuzzleFull): number {
    const { kind, value: target, stat } = puzzle.objective;
    const lockedValues = puzzle.locked.map((slot) => dayStatValue(slot.player, stat));
    const base = lockedValues.reduce((sum, v) => sum + v, 0);
    const sets = puzzle.slots.map((slot) => slot.main.map((player) => dayStatValue(player, stat)));
    let wins = 0;

    const visit = (index: number, chosen: number[]): void => {
        if (index === sets.length) {
            for (let captain = 0; captain < chosen.length; captain += 1) {
                const counted = chosen.map((v, k) => (k === captain ? 2 * v : v));
                const total = base + counted.reduce((sum, v) => sum + v, 0);
                const win = kind === 'exact' ? total === target
                    : kind === 'over' ? total > target
                        : kind === 'under' ? total < target
                            : [...counted, ...lockedValues].every((v) => v < target);

                wins += win ? 1 : 0;
            }

            return;
        }

        for (const v of sets[index]!) {
            visit(index + 1, [...chosen, v]);
        }
    };

    visit(0, []);

    return wins;
}

const WEEK = Array.from({ length: 7 }, (_, day) => generate(addDays(MONDAY, day)));

describe('generateDailyPuzzle', () => {
    it('is deterministic: the same date gives the identical puzzle', () => {
        expect(generate('2026-10-14')).toEqual(WEEK[2]);
    });

    it('follows the weekday schedule, formation rotation and lock count', () => {
        WEEK.forEach((puzzle, day) => {
            const rule = DAILY_SCHEDULE[day as 0];

            expect(puzzle.weekday).toBe(day);
            expect(puzzle.objective.kind).toBe(rule.kind);
            expect(puzzle.objective.stat).toBe(rule.stat);
            expect(puzzle.formationCode).toBe(dailyFormationFor(puzzle.date));
            expect(puzzle.locked).toHaveLength(dailyLockCount(puzzle.date));
            expect(puzzle.locked.every((slot) => slot.group !== 'GK')).toBe(true);
            expect(puzzle.locked.length + puzzle.slots.length).toBe(11);
        });

        expect(new Set(WEEK.map((puzzle) => puzzle.formationCode)).size).toBe(7);
        expect(WEEK[2]!.objective.value).toBe(Number(WEEK[2]!.formationCode));
        expect(WEEK[6]!.objective.value).toBe(Number(WEEK[6]!.formationCode));
    });

    it('never repeats a player anywhere in a puzzle, and keeps every slot in its position', () => {
        for (const puzzle of WEEK) {
            const ids = [
                ...puzzle.locked.map((slot) => slot.player.id),
                ...puzzle.slots.flatMap((slot) => [...slot.main, ...slot.reroll, slot.sub].map((player) => player.id)),
            ];

            expect(new Set(ids).size).toBe(ids.length);

            for (const slot of puzzle.slots) {
                expect(slot.main).toHaveLength(3);
                expect(slot.reroll).toHaveLength(3);
                expect([...slot.main, ...slot.reroll, slot.sub].every((player: Player) => player.position === slot.group)).toBe(true);
            }
        }
    });

    it('is always winnable, and the DP agrees with brute force', () => {
        for (const puzzle of WEEK) {
            const brute = bruteForceWinPairs(puzzle);

            expect(brute).toBeGreaterThan(0);
            expect(puzzle.meta.winPairs).toBe(brute);
            expect(puzzle.meta.pairs).toBe(3 ** puzzle.slots.length * puzzle.slots.length);
            expect(puzzle.meta.totalXIs).toBe(3 ** puzzle.slots.length);
            expect(puzzle.meta.perfectXIs).toBeGreaterThan(0);
            expect(puzzle.meta.perfectXIs).toBeLessThanOrEqual(puzzle.meta.totalXIs);
        }
    });

    it('keeps exact days inside their winning-pair band', () => {
        for (const puzzle of WEEK) {
            const band = DAILY_SCHEDULE[puzzle.weekday].band;

            if (band && puzzle.meta.attempts <= 200) {
                const share = puzzle.meta.winPairs / puzzle.meta.pairs;

                expect(share).toBeGreaterThanOrEqual(band[0]);
                expect(share).toBeLessThanOrEqual(band[1]);
            }
        }
    });

    it('records a best XI that actually wins (exact) or is the extreme total (over/under)', () => {
        for (const puzzle of WEEK) {
            const { bestXI } = puzzle.meta;
            const stat = puzzle.objective.stat;
            const byId = new Map(puzzle.slots.flatMap((slot) => slot.main).map((player) => [player.id, player]));
            const base = puzzle.locked.reduce((sum, slot) => sum + dayStatValue(slot.player, stat), 0);
            const total = base + bestXI.picks.reduce((sum, pick) => (
                sum + dayStatValue(byId.get(pick.playerId)!, stat) * (pick.slotId === bestXI.captainSlotId ? 2 : 1)
            ), 0);

            expect(bestXI.picks).toHaveLength(puzzle.slots.length);
            expect(total).toBe(bestXI.total);

            if (puzzle.objective.kind === 'exact') {
                expect(total).toBe(puzzle.objective.value);
            } else if (puzzle.objective.kind === 'over') {
                expect(total).toBeGreaterThan(puzzle.objective.value);
            } else if (puzzle.objective.kind === 'under') {
                expect(total).toBeLessThan(puzzle.objective.value);
            }
        }
    });

    it('builds Tuesday\'s danger slots: 2 one-safe, 2 two-safe, the rest all safe; locked players under the limit', () => {
        const tuesdays = [WEEK[1]!, generate(addDays(MONDAY, 8)), generate(addDays(MONDAY, 15))];

        for (const puzzle of tuesdays) {
            const limit = puzzle.objective.value;
            const safeCounts = puzzle.slots
                .filter((slot) => slot.group !== 'GK')
                .map((slot) => slot.main.filter((player) => dayStatValue(player, 'ga') < limit).length)
                .sort();

            expect([20, 25, 30, 35, 40]).toContain(limit);
            expect(safeCounts.slice(0, 4)).toEqual([1, 1, 2, 2]);
            expect(safeCounts.slice(4).every((count) => count === 3)).toBe(true);
            expect(puzzle.locked.every((slot) => dayStatValue(slot.player, 'ga') < limit)).toBe(true);
        }
    });

    it('draws each mystery sub like-for-like from its slot\'s main range', () => {
        for (const puzzle of WEEK) {
            const stat = puzzle.objective.stat;

            for (const slot of puzzle.slots) {
                const values = slot.main.map((player) => dayStatValue(player, stat));
                const sub = dayStatValue(slot.sub, stat);

                expect(sub).toBeGreaterThanOrEqual(Math.min(...values) / 1.25 - 2);
                expect(sub).toBeLessThanOrEqual(Math.max(...values) * 1.25 + 2);
            }
        }
    });

    it('generates 8 weeks of dates, each in under 2 s', () => {
        for (let day = 0; day < 56; day += 1) {
            const date = addDays(MONDAY, day);
            const started = performance.now();
            const puzzle = generate(date);

            expect(performance.now() - started).toBeLessThan(2000);
            expect(puzzle.meta.winPairs).toBeGreaterThan(0);
        }
    }, 60_000);
});

describe('fixedSetWinOdds', () => {
    it('counts (completion, captain) pairs exactly for each captain mode', () => {
        const openSets = [[1, 2, 3], [0, 5, 10]];

        // Free captain over two empty slots: 9 completions × 2 captain choices.
        expect(fixedSetWinOdds({ objectiveKind: 'exact', objectiveValue: 7, baseTotal: 0, openSets, captain: { mode: 'free', filledValues: [] } }))
            // a=1,b=5 cap b → 11; …  enumerate: totals with captain on slot 0: 2a+b; on slot 1: a+2b.
            // 2a+b=7: (1,5) → 1. a+2b=7: none (b even). → 1
            .toEqual({ waysToWin: 1, totalWays: 18 });
        // Fixed captain (already counted in the base).
        expect(fixedSetWinOdds({ objectiveKind: 'under', objectiveValue: 6, baseTotal: 0, openSets, captain: { mode: 'fixed' } }))
            .toEqual({ waysToWin: 3, totalWays: 9 }); // sums < 6: only b=0 → (1,0)(2,0)(3,0); every b=5 sum is ≥ 6.
        // Blind captain named on empty slot 1: totals a + 2b. Exact 7 → none (2b is even, a must be odd: a=1→b=3 ✗, a=3→b=2 ✗).
        expect(fixedSetWinOdds({ objectiveKind: 'exact', objectiveValue: 11, baseTotal: 0, openSets, captain: { mode: 'open', index: 1 } }))
            .toEqual({ waysToWin: 1, totalWays: 9 }); // 1 + 2×5 = 11.
        // Free captain, one filled slot (raw 4, already in the base of 4) as a candidate: total = 4 + a + b + 4.
        expect(fixedSetWinOdds({ objectiveKind: 'exact', objectiveValue: 14, baseTotal: 4, openSets, captain: { mode: 'free', filledValues: [4] } }))
            // captain on filled: 8 + a + b = 14 → (1,5) → 1. On slot 0: 4 + 2a + b = 14 → (… 2a+b=10: a=… b=10→a=0 ✗; b=0→a=5 ✗) 0. On slot 1: 4 + a + 2b = 14 → a+2b=10 → (… b=5 → a=0 ✗) 0.
            .toEqual({ waysToWin: 1, totalWays: 27 });
    });

    it('handles allUnder with a free captain, including filled captain candidates', () => {
        const odds = fixedSetWinOdds({ objectiveKind: 'allUnder', objectiveValue: 10, baseTotal: 0, openSets: [[1, 6], [2, 12]], captain: { mode: 'free', filledValues: [4, 6] } });

        // Captain on open 0: doubled <10 in slot 0 → {1} (6×2=12 ✗) × safe in slot 1 {2} = 1.
        // Captain on open 1: safe slot 0 {1,6} × doubled <10 in slot 1 {2} = 2.
        // Captain on filled 4 (8 < 10): all-safe completions 2 × 1 = 2. On filled 6 (12): 0.
        expect(odds).toEqual({ waysToWin: 5, totalWays: 4 * 4 });
    });
});
