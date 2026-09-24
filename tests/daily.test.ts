import { describe, expect, it } from 'vitest';
import {
    buildObjective,
    dayIndexForDate,
    getDailyFormationCode,
    getDailyObjective,
    getDailyPrefilledSlotIds,
    objectiveValueOptions,
    pickDeterministicItem,
} from '../shared/daily';
import { getFormation } from '../app/utils/formations';

const SAMPLE_DATES = Array.from({ length: 30 }, (_, i) => {
    const day = String((i % 28) + 1).padStart(2, '0');

    return `2026-0${Math.floor(i / 28) + 1}-${day}`;
});

describe('shared/daily', () => {
    it('is fully deterministic — same date always yields the same puzzle', () => {
        for (const date of SAMPLE_DATES) {
            const formationCode = getDailyFormationCode(date);
            const objective = getDailyObjective(date);
            const formation = getFormation(formationCode)!;
            const prefilled = getDailyPrefilledSlotIds(date, formation);

            expect(getDailyFormationCode(date)).toBe(formationCode);
            expect(getDailyObjective(date)).toEqual(objective);
            expect(getDailyPrefilledSlotIds(date, formation)).toEqual(prefilled);
        }
    });

    it('rejects a malformed date', () => {
        expect(() => dayIndexForDate('24-09-2026')).toThrow();
    });

    it('rotates through more than one formation and objective kind across a month', () => {
        const formationCodes = new Set(SAMPLE_DATES.map((date) => getDailyFormationCode(date)));
        const objectiveKinds = new Set(SAMPLE_DATES.map((date) => getDailyObjective(date).kind));

        expect(formationCodes.size).toBeGreaterThan(1);
        expect(objectiveKinds.size).toBeGreaterThan(1);
    });

    it('never pre-fills the GK slot, and always picks 2 or 3 slots', () => {
        for (const date of SAMPLE_DATES) {
            const formation = getFormation(getDailyFormationCode(date))!;
            const prefilled = getDailyPrefilledSlotIds(date, formation);

            expect(prefilled).not.toContain('gk');
            expect(prefilled.length).toBeGreaterThanOrEqual(2);
            expect(prefilled.length).toBeLessThanOrEqual(3);
            expect(new Set(prefilled).size).toBe(prefilled.length);
        }
    });

    it("gives an 'exact' objective the day's own formation number as its value", () => {
        for (const date of SAMPLE_DATES) {
            const objective = getDailyObjective(date);

            if (objective.kind === 'exact') {
                expect(objective.value).toBe(Number(getDailyFormationCode(date)));
            }
        }
    });

    describe('buildObjective', () => {
        it("derives the 'exact' value from the formation number, ignoring any passed value", () => {
            const objective = buildObjective('exact', '442', 999);

            expect(objective).toEqual({ kind: 'exact', value: 442, label: expect.stringContaining('442') });
        });

        it('accepts a value that is in the curated catalog for the kind', () => {
            const options = objectiveValueOptions('over');
            const objective = buildObjective('over', '442', options[0]);

            expect(objective?.value).toBe(options[0]);
        });

        it('rejects a value outside the curated catalog', () => {
            expect(buildObjective('over', '442', 999999)).toBeNull();
        });

        it('rejects a missing value for a non-exact kind', () => {
            expect(buildObjective('under', '442', undefined)).toBeNull();
        });

        it("returns an empty catalog for 'exact' — it has no selectable value", () => {
            expect(objectiveValueOptions('exact')).toHaveLength(0);
        });
    });

    describe('pickDeterministicItem', () => {
        const pool = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

        it('is deterministic for a given seed', () => {
            const first = pickDeterministicItem('seed-1', pool, new Set());
            const second = pickDeterministicItem('seed-1', pool, new Set());

            expect(first).toEqual(second);
        });

        it('never returns an excluded id', () => {
            const picked = pickDeterministicItem('seed-2', pool, new Set(['a', 'b']));

            expect(picked?.id).toBe('c');
        });

        it('returns undefined once the whole pool is excluded', () => {
            const picked = pickDeterministicItem('seed-3', pool, new Set(['a', 'b', 'c']));

            expect(picked).toBeUndefined();
        });
    });
});
