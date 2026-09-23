import { describe, expect, it } from 'vitest';
import { describeSlotRole, formations, getFormation, getSlotShortLabel } from '../app/utils/formations';

const EXPECTED_CODES = ['442', '433', '451', '352', '343', '541', '532'];

describe('formations', () => {
    it('defines exactly the seven three-digit formations that sum to 10 outfield players', () => {
        expect(formations).toHaveLength(7);
        expect(formations.map((formation) => formation.code).sort()).toEqual([...EXPECTED_CODES].sort());

        for (const formation of formations) {
            const [def, mid, fwd] = formation.rows;

            expect(def + mid + fwd).toBe(10);
        }
    });

    it('sets the target equal to the formation code read as a number', () => {
        for (const formation of formations) {
            expect(formation.target).toBe(Number(formation.code));
        }
    });

    it('builds exactly 11 slots per formation: 1 GK plus the DEF/MID/FWD rows', () => {
        for (const formation of formations) {
            const [def, mid, fwd] = formation.rows;

            expect(formation.slots).toHaveLength(11);
            expect(formation.slots.filter((slot) => slot.group === 'GK')).toHaveLength(1);
            expect(formation.slots.filter((slot) => slot.group === 'DEF')).toHaveLength(def);
            expect(formation.slots.filter((slot) => slot.group === 'MID')).toHaveLength(mid);
            expect(formation.slots.filter((slot) => slot.group === 'FWD')).toHaveLength(fwd);
        }
    });

    it('gives every slot a unique id within its formation', () => {
        for (const formation of formations) {
            const ids = formation.slots.map((slot) => slot.id);

            expect(new Set(ids).size).toBe(ids.length);
        }
    });

    it('keeps every slot coordinate within the 0-100 pitch percentage range', () => {
        for (const formation of formations) {
            for (const slot of formation.slots) {
                expect(slot.x).toBeGreaterThanOrEqual(0);
                expect(slot.x).toBeLessThanOrEqual(100);
                expect(slot.y).toBeGreaterThanOrEqual(0);
                expect(slot.y).toBeLessThanOrEqual(100);
            }
        }
    });
});

describe('getSlotShortLabel', () => {
    // Side is derived from a slot's POSITION WITHIN ITS ROW (first/last vs.
    // everything between), not a fixed pitch-percentage threshold — the
    // latter breaks for a row of 5, where two slots would land on each side
    // of any fixed cutoff (e.g. a back five's two innermost centre-backs
    // both reading as "wide"). Every formation is covered explicitly so this
    // exact class of row-size bug can't slip through again.
    const EXPECTED_SHORT_LABELS: Record<string, string[]> = {
        442: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
        433: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'RM', 'LW', 'ST', 'RW'],
        451: ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST'],
        352: ['GK', 'LB', 'CB', 'RB', 'LM', 'CM', 'CM', 'CM', 'RM', 'ST', 'ST'],
        343: ['GK', 'LB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
        // A back five's wide slots are wing-backs (LWB/RWB), not fullbacks —
        // and only its two outermost defenders are wide; the middle three
        // (including two who'd have been misread as "wide" under the old
        // x-threshold approach) are all CB.
        541: ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'LM', 'CM', 'CM', 'RM', 'ST'],
        532: ['GK', 'LWB', 'CB', 'CB', 'CB', 'RWB', 'LM', 'CM', 'RM', 'ST', 'ST'],
    };

    it.each(Object.entries(EXPECTED_SHORT_LABELS))('labels every slot of a %s correctly', (code, expected) => {
        const formation = getFormation(code);
        const labels = formation!.slots.map((slot) => getSlotShortLabel(slot.group, slot.side, slot.rowSize));

        expect(labels).toEqual(expected);
    });
});

describe('describeSlotRole', () => {
    // The long-form accessible label uses real tactical terminology too: a
    // back five's wide defenders are wing-backs, everyone else's are
    // fullbacks, regardless of the fixed-threshold bug this replaced.
    it('describes a back five\'s wide defenders as wing-backs, not fullbacks', () => {
        for (const code of ['541', '532']) {
            const formation = getFormation(code);
            const defRoles = formation!.slots.filter((slot) => slot.group === 'DEF').map(
                (slot) => describeSlotRole(slot.group, slot.side, slot.rowSize),
            );

            expect(defRoles).toEqual(['Left wing-back', 'Centre-back', 'Centre-back', 'Centre-back', 'Right wing-back']);
        }
    });

    // A back three or back four's wide defenders stay "-back" (fullback),
    // not wing-back — that wording is specific to a genuine back five.
    it('describes a back three/four\'s wide defenders as fullbacks', () => {
        for (const code of ['442', '433', '451']) {
            const formation = getFormation(code);
            const wideDefRoles = formation!.slots
                .filter((slot) => slot.group === 'DEF' && slot.side !== 'Center')
                .map((slot) => describeSlotRole(slot.group, slot.side, slot.rowSize));

            expect(wideDefRoles).toEqual(['Left-back', 'Right-back']);
        }
    });

    // A front two stays "Striker" for both slots even though each is the
    // first/last of its row — only a front three's outer slots are wingers.
    it('keeps a front two as two strikers, not left/right forward', () => {
        const formation = getFormation('442');
        const fwdRoles = formation!.slots.filter((slot) => slot.group === 'FWD').map(
            (slot) => describeSlotRole(slot.group, slot.side, slot.rowSize),
        );

        expect(fwdRoles).toEqual(['Striker', 'Striker']);
    });
});

describe('getFormation', () => {
    it('returns the matching formation for a known code', () => {
        expect(getFormation('442')?.code).toBe('442');
    });

    // "Sensibly" here means: return undefined for anything not in the fixed
    // seven-formation set, rather than throwing — callers (e.g. parsing a
    // `?f=` query param) can treat an unknown code as "no formation selected".
    it('returns undefined for an unsupported code, rather than throwing', () => {
        expect(getFormation('4231')).toBeUndefined();
        expect(getFormation('')).toBeUndefined();
        expect(getFormation('not-a-formation')).toBeUndefined();
    });
});
