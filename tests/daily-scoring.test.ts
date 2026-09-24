import { describe, expect, it } from 'vitest';
import type { Objective, Player } from '../shared/types';
import { getObjectiveResult } from '../app/utils/daily-scoring';

function player(goals: number, assists: number): Player {
    return {
        id: `p-${goals}-${assists}`,
        name: 'Test Player',
        position: 'MID',
        goals,
        assists,
        appearances: 100,
        clubs: ['Test FC'],
        firstSeason: 2020,
        lastSeason: 2024,
    };
}

const TOTAL_SLOTS = 3;

describe('getObjectiveResult', () => {
    describe('exact', () => {
        const objective: Objective = { kind: 'exact', value: 10, label: '' };

        it('busts immediately once the running total goes over', () => {
            expect(getObjectiveResult(objective, [player(6, 0), player(6, 0)], TOTAL_SLOTS).status).toBe('bust');
        });

        it('stays playing until every slot is filled', () => {
            expect(getObjectiveResult(objective, [player(5, 0)], TOTAL_SLOTS).status).toBe('playing');
        });

        it('wins on an exact match once full', () => {
            expect(getObjectiveResult(objective, [player(4, 0), player(3, 0), player(3, 0)], TOTAL_SLOTS).status).toBe('won');
        });

        it('loses on a non-exact, non-bust finish', () => {
            expect(getObjectiveResult(objective, [player(2, 0), player(2, 0), player(2, 0)], TOTAL_SLOTS).status).toBe('lost');
        });
    });

    describe('over', () => {
        const objective: Objective = { kind: 'over', value: 10, label: '' };

        it('never busts, however high the running total goes', () => {
            expect(getObjectiveResult(objective, [player(20, 0)], TOTAL_SLOTS).status).toBe('playing');
        });

        it('wins once full and over the value', () => {
            expect(getObjectiveResult(objective, [player(5, 0), player(4, 0), player(2, 0)], TOTAL_SLOTS).status).toBe('won');
        });

        it('loses once full and at or under the value', () => {
            expect(getObjectiveResult(objective, [player(3, 0), player(3, 0), player(3, 0)], TOTAL_SLOTS).status).toBe('lost');
        });
    });

    describe('under', () => {
        const objective: Objective = { kind: 'under', value: 10, label: '' };

        it('busts as soon as the running total reaches the ceiling', () => {
            expect(getObjectiveResult(objective, [player(6, 0), player(4, 0)], TOTAL_SLOTS).status).toBe('bust');
        });

        it('busts on going over the ceiling too', () => {
            expect(getObjectiveResult(objective, [player(11, 0)], TOTAL_SLOTS).status).toBe('bust');
        });

        it('wins automatically on filling every slot without busting', () => {
            expect(getObjectiveResult(objective, [player(3, 0), player(3, 0), player(3, 0)], TOTAL_SLOTS).status).toBe('won');
        });
    });

    describe('allUnder', () => {
        const objective: Objective = { kind: 'allUnder', value: 10, label: '' };

        it('busts the instant any single player reaches the cap, regardless of remaining slots', () => {
            expect(getObjectiveResult(objective, [player(10, 0)], TOTAL_SLOTS).status).toBe('bust');
        });

        it('does not bust from a high running total if no single player breached the cap', () => {
            expect(getObjectiveResult(objective, [player(9, 0), player(9, 0)], TOTAL_SLOTS).status).toBe('playing');
        });

        it('wins on filling every slot with every player under the cap', () => {
            expect(getObjectiveResult(objective, [player(9, 0), player(9, 0), player(9, 0)], TOTAL_SLOTS).status).toBe('won');
        });
    });
});
