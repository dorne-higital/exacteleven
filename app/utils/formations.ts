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

// Difficulty tiers and figures from scripts/simulate.ts with the live draw
// bias and the fairer final slot modelled (DAILY2_SPEC §1.8): the "fan"
// model (knows each hidden number to within about ±45%), 4,000 games per
// formation. The old "343/352 ~20-23% ... 541/532 ~1-2%" comment predated
// both the server's guaranteed-winnable option and the exact-only win, so
// it no longer described the game. `exactPct` is the jackpot (landing
// exactly on target); `titleOrBetterPct` adds the Title contenders window.
// Shared by the formation picker (select-formation.vue) and the stats
// modal's "which formations get played" chart, so the two never drift apart.
export interface FormationDifficulty {
    label: string;
    tier: 'easier' | 'balanced' | 'hardest';
    /** % of games landing exactly on target (fan model). */
    exactPct: number;
    /** % of games finishing exact or in the Title contenders window (fan model). */
    titleOrBetterPct: number;
}

export const FORMATION_DIFFICULTY: Record<FormationCode, FormationDifficulty> = {
    343: { label: 'Easier', tier: 'easier', exactPct: 9.4, titleOrBetterPct: 34.5 },
    352: { label: 'Easier', tier: 'easier', exactPct: 8.8, titleOrBetterPct: 32.6 },
    433: { label: 'Balanced', tier: 'balanced', exactPct: 8.3, titleOrBetterPct: 23.9 },
    442: { label: 'Balanced', tier: 'balanced', exactPct: 8.1, titleOrBetterPct: 22.8 },
    451: { label: 'Balanced', tier: 'balanced', exactPct: 7.9, titleOrBetterPct: 21.6 },
    532: { label: 'Hardest', tier: 'hardest', exactPct: 6.5, titleOrBetterPct: 14.8 },
    541: { label: 'Hardest', tier: 'hardest', exactPct: 6.5, titleOrBetterPct: 14.8 },
};

type SlotRoleKind =
    | 'goalkeeper'
    | 'centre-back'
    | 'fullback'
    | 'wing-back'
    | 'central-midfield'
    | 'wide-midfield'
    | 'striker'
    | 'winger';

// The one place a slot's position group, left/centre/right placement, and
// row size get turned into "what tactical role is this" (a back five's wide
// slots are wing-backs, not fullbacks; a front two's slots are strikers, not
// wingers, even though both are technically "wide" by index). describeSlotRole
// and getSlotShortLabel both build their wording from this single
// classification instead of each re-implementing the same branching, so the
// two can no longer drift apart on what counts as which role.
function slotRoleKind(group: PositionGroup, side: Slot['side'], rowSize: number): SlotRoleKind {
    switch (group) {
        case 'GK':
            return 'goalkeeper';
        case 'DEF':
            if (side === 'Center') {
                return 'centre-back';
            }

            return rowSize >= 5 ? 'wing-back' : 'fullback';
        case 'MID':
            return side === 'Center' ? 'central-midfield' : 'wide-midfield';
        case 'FWD':
            return rowSize < 3 || side === 'Center' ? 'striker' : 'winger';
    }
}

// A short human role name — used for both the slot button's accessible
// label and the result recap, so it lives here rather than being duplicated.
export function describeSlotRole(group: PositionGroup, side: Slot['side'], rowSize: number): string {
    switch (slotRoleKind(group, side, rowSize)) {
        case 'goalkeeper':
            return 'Goalkeeper';
        case 'centre-back':
            return 'Centre-back';
        case 'fullback':
            return `${side}-back`;
        case 'wing-back':
            return `${side} wing-back`;
        case 'central-midfield':
            return 'Central midfield';
        case 'wide-midfield':
            return `${side} midfield`;
        case 'striker':
            return 'Striker';
        case 'winger':
            return `${side} forward`;
    }
}

// The short 2/3-letter tag shown directly on a pitch slot (GK / LB / LWB /
// CM / ST…).
export function getSlotShortLabel(group: PositionGroup, side: Slot['side'], rowSize: number): string {
    switch (slotRoleKind(group, side, rowSize)) {
        case 'goalkeeper':
            return 'GK';
        case 'centre-back':
            return 'CB';
        case 'fullback':
            return `${side[0]}B`;
        case 'wing-back':
            return `${side[0]}WB`;
        case 'central-midfield':
            return 'CM';
        case 'wide-midfield':
            return `${side[0]}M`;
        case 'striker':
            return 'ST';
        case 'winger':
            return `${side[0]}W`;
    }
}
