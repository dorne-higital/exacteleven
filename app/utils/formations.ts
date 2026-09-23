import type { Formation, FormationCode, PositionGroup, Slot } from '../../shared/types';

// Adding a formation means adding one entry here — code + outfield [DEF, MID, FWD]
// counts, each summing to 10. Everything else (target, slot layout) is derived.
const FORMATION_DEFINITIONS: Array<{ code: FormationCode; rows: [number, number, number] }> = [
    { code: '442', rows: [4, 4, 2] },
    { code: '433', rows: [4, 3, 3] },
    { code: '451', rows: [4, 5, 1] },
    { code: '352', rows: [3, 5, 2] },
    { code: '343', rows: [3, 4, 3] },
    { code: '541', rows: [5, 4, 1] },
    { code: '532', rows: [5, 3, 2] },
];

// Percentage depth on a vertical pitch — 0 is the attacking end, 100 is own goal.
const ROW_Y: Record<PositionGroup, number> = {
    GK: 92,
    DEF: 70,
    MID: 46,
    FWD: 18,
};

function spreadX(count: number): number[] {
    return Array.from({ length: count }, (_, index) => ((index + 1) / (count + 1)) * 100);
}

// A slot's left/centre/right placement by its POSITION WITHIN THE ROW (first,
// last, or anything between), not a fixed pitch-percentage threshold — a
// threshold like "x < 40" works for a row of 3 or 4 but breaks for a row of
// 5, where two slots land on each side of any fixed cutoff (e.g. a back
// five's two innermost centre-backs both read as "wide"). Only the true
// first and last slot of a row are ever wide; a row of 1 has none.
function sideForIndex(index: number, count: number): Slot['side'] {
    if (count <= 1) {
        return 'Center';
    }

    if (index === 0) {
        return 'Left';
    }

    if (index === count - 1) {
        return 'Right';
    }

    return 'Center';
}

function buildSlots(rows: [number, number, number]): Slot[] {
    const [defCount, midCount, fwdCount] = rows;
    const slots: Slot[] = [{ id: 'gk', group: 'GK', x: 50, y: ROW_Y.GK, side: 'Center', rowSize: 1 }];

    const addRow = (group: PositionGroup, count: number): void => {
        spreadX(count).forEach((x, index) => {
            slots.push({
                id: `${group.toLowerCase()}-${index + 1}`,
                group,
                rowSize: count,
                side: sideForIndex(index, count),
                x,
                y: ROW_Y[group],
            });
        });
    };

    addRow('DEF', defCount);
    addRow('MID', midCount);
    addRow('FWD', fwdCount);

    return slots;
}

export const formations: Formation[] = FORMATION_DEFINITIONS.map(({ code, rows }) => ({
    code,
    target: Number(code),
    rows,
    slots: buildSlots(rows),
}));

export function getFormation(code: string): Formation | undefined {
    return formations.find((formation) => formation.code === code);
}

// Difficulty tiers straight from the Phase 2 balance simulation (tolerance
// ±20, "sensible" stat-aware strategy win rate): 343/352 ~20-23%, 442/433/451
// ~6-10%, 541/532 ~1-2%. Not a guess — see scripts/simulate.ts's output.
// Shared by the formation picker (index.vue) and the stats modal's
// "which formations get played" chart, so the two never drift apart.
export const FORMATION_DIFFICULTY: Record<FormationCode, { label: string; tier: 'easier' | 'balanced' | 'hardest' }> = {
    343: { label: 'Easier', tier: 'easier' },
    352: { label: 'Easier', tier: 'easier' },
    433: { label: 'Balanced', tier: 'balanced' },
    442: { label: 'Balanced', tier: 'balanced' },
    451: { label: 'Balanced', tier: 'balanced' },
    532: { label: 'Hardest', tier: 'hardest' },
    541: { label: 'Hardest', tier: 'hardest' },
};

// A short human role name derived from a slot's position group, its
// left/centre/right placement within its row, and how big that row is (a
// back five's wide slots are wing-backs, not fullbacks; a front two's
// slots are strikers, not wingers, even though both are technically "wide"
// by index). Used for both the slot button's accessible label and the
// result recap, so it lives here rather than being duplicated.
export function describeSlotRole(group: PositionGroup, side: Slot['side'], rowSize: number): string {
    switch (group) {
        case 'GK':
            return 'Goalkeeper';
        case 'DEF':
            if (side === 'Center') {
                return 'Centre-back';
            }

            return rowSize >= 5 ? `${side} wing-back` : `${side}-back`;
        case 'MID':
            return side === 'Center' ? 'Central midfield' : `${side} midfield`;
        case 'FWD':
            if (rowSize < 3 || side === 'Center') {
                return 'Striker';
            }

            return `${side} forward`;
        default:
            return group;
    }
}

// The short 2/3-letter tag shown directly on a pitch slot (GK / LB / LWB /
// CM / ST…). Mirrors describeSlotRole's group/side/rowSize rules exactly so
// the two never drift apart — only the wording differs.
export function getSlotShortLabel(group: PositionGroup, side: Slot['side'], rowSize: number): string {
    switch (group) {
        case 'GK':
            return 'GK';
        case 'DEF':
            if (side === 'Center') {
                return 'CB';
            }

            return rowSize >= 5 ? `${side[0]}WB` : `${side[0]}B`;
        case 'MID':
            return side === 'Center' ? 'CM' : `${side[0]}M`;
        case 'FWD':
            if (rowSize < 3 || side === 'Center') {
                return 'ST';
            }

            return `${side[0]}W`;
        default:
            return group;
    }
}
