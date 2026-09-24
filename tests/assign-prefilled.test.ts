import { describe, expect, it } from 'vitest';
import { assignPrefilledPlayers } from '../server/utils/assign-prefilled';
import { getFormation } from '../app/utils/formations';

const formation = getFormation('442')!;
const nonGkSlotIds = formation.slots.filter((slot) => slot.group !== 'GK').map((slot) => slot.id);

describe('assignPrefilledPlayers', () => {
    it('is deterministic for a given seed', () => {
        const first = assignPrefilledPlayers('seed-1', formation, nonGkSlotIds.slice(0, 3));
        const second = assignPrefilledPlayers('seed-1', formation, nonGkSlotIds.slice(0, 3));

        expect(first).toEqual(second);
    });

    it('gives a different seed a different (or differently-ordered) assignment in general', () => {
        // Not a strict guarantee for every possible pair, but true for a wide
        // sample — a meaningful smoke check that the seed actually matters.
        const results = Array.from({ length: 10 }, (_, i) => (
            assignPrefilledPlayers(`seed-${i}`, formation, nonGkSlotIds.slice(0, 2)).map((entry) => entry.player.id).join(',')
        ));

        expect(new Set(results).size).toBeGreaterThan(1);
    });

    it('never assigns the same player to two different slots', () => {
        const assigned = assignPrefilledPlayers('seed-dedupe', formation, nonGkSlotIds);
        const playerIds = assigned.map((entry) => entry.player.id);

        expect(new Set(playerIds).size).toBe(playerIds.length);
    });

    it('returns nothing for an empty slot list', () => {
        expect(assignPrefilledPlayers('seed-empty', formation, [])).toHaveLength(0);
    });

    it('ignores a slot id that does not belong to the formation', () => {
        const assigned = assignPrefilledPlayers('seed-invalid', formation, ['not-a-real-slot']);

        expect(assigned).toHaveLength(0);
    });
});
