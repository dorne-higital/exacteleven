import type { Formation, FormationCode, Objective, ObjectiveKind } from './types';

// Order is independent of app/utils/formations.ts's FORMATION_DEFINITIONS —
// kept as a plain literal here (not imported) so this file has zero
// dependencies and stays safely importable from both server routes and
// client code.
const FORMATION_CYCLE: FormationCode[] = ['442', '433', '451', '352', '343', '541', '532'];

export const OBJECTIVE_KINDS: ObjectiveKind[] = ['exact', 'over', 'under', 'allUnder'];

// Initial guesses, not simulation-tuned like scoring.ts's tier boundaries —
// revisit once real daily-challenge play data exists. Exported since a
// custom challenge link (shared/daily.ts's buildObjective) offers the same
// curated values rather than accepting an arbitrary creator-supplied number.
export const OVER_VALUES = [350, 400, 450];
export const UNDER_VALUES = [180, 220, 260];
export const ALL_UNDER_VALUES = [40, 50, 60];

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// A stable day-number derived purely from the YYYY-MM-DD string — never
// Date.now()/local timezone, so the same date string always yields the same
// puzzle everywhere (server, every visitor's browser, any timezone).
export function dayIndexForDate(date: string): number {
    const match = DATE_PATTERN.exec(date);

    if (!match) {
        throw new Error(`Invalid date: ${date}`);
    }

    const [, year, month, day] = match;

    // Days since an arbitrary epoch — only relative spacing matters, not the
    // absolute value, since every objective/formation pick is a modulo of
    // this number.
    return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000);
}

// FNV-1a hash, deterministic and dependency-free.
function hashSeed(text: string): number {
    let hash = 0x811c9dc5;

    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return hash >>> 0;
}

// mulberry32 — small, fast, deterministic PRNG seeded from a 32-bit int.
function mulberry32(seed: number): () => number {
    let state = seed;

    return () => {
        state = (state + 0x6d2b79f5) | 0;

        let t = Math.imul(state ^ (state >>> 15), 1 | state);

        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function seededInt(seedText: string, max: number): number {
    return Math.floor(mulberry32(hashSeed(seedText))() * max);
}

// A deterministic shuffle (Fisher-Yates driven by the seeded PRNG) — used to
// pick which slots are pre-filled without biasing toward any one position.
function seededShuffle<T>(items: T[], seedText: string): T[] {
    const rng = mulberry32(hashSeed(seedText));
    const result = [...items];

    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));

        [result[i], result[j]] = [result[j]!, result[i]!];
    }

    return result;
}

// Picks an item deterministically from a pool, skipping ids already used
// elsewhere that same day — mirrors the app's existing "no repeats" spirit
// (see D6 in useGame.ts) without any server-side state to track it.
export function pickDeterministicItem<T extends { id: string }>(
    seedText: string,
    pool: readonly T[],
    excludeIds: ReadonlySet<string>,
): T | undefined {
    const available = pool.filter((item) => !excludeIds.has(item.id));

    if (available.length === 0) {
        return undefined;
    }

    return available[seededInt(seedText, available.length)];
}

export function getDailyFormationCode(date: string): FormationCode {
    return FORMATION_CYCLE[dayIndexForDate(date) % FORMATION_CYCLE.length]!;
}

function objectiveLabel(kind: ObjectiveKind, value: number): string {
    switch (kind) {
        case 'exact':
            return `Land the total exactly on ${value}`;
        case 'over':
            return `Score over ${value}`;
        case 'under':
            return `Stay under ${value}`;
        case 'allUnder':
            return `Keep every player under ${value}`;
    }
}

// The curated value list for a given non-'exact' kind — 'exact' has none,
// its value is always derived from the formation number.
export function objectiveValueOptions(kind: ObjectiveKind): readonly number[] {
    switch (kind) {
        case 'over':
            return OVER_VALUES;
        case 'under':
            return UNDER_VALUES;
        case 'allUnder':
            return ALL_UNDER_VALUES;
        case 'exact':
            return [];
    }
}

// Builds a validated Objective from an explicit kind (+ value, for every
// kind but 'exact') — shared by the Daily Challenge (which derives kind/value
// from the date) and a custom challenge link (server/api/challenge.get.ts),
// so both only ever produce an Objective from this one place. Returns null
// for a value outside the curated list — a custom challenge can't set an
// arbitrary difficulty, only pick from the same options the Daily Challenge
// itself rotates through.
export function buildObjective(kind: ObjectiveKind, formationCode: FormationCode, value?: number): Objective | null {
    if (kind === 'exact') {
        const target = Number(formationCode);

        return { kind, value: target, label: objectiveLabel(kind, target) };
    }

    if (value === undefined || !objectiveValueOptions(kind).includes(value)) {
        return null;
    }

    return { kind, value, label: objectiveLabel(kind, value) };
}

export function getDailyObjective(date: string): Objective {
    const dayIndex = dayIndexForDate(date);
    const kind = OBJECTIVE_KINDS[dayIndex % OBJECTIVE_KINDS.length]!;
    const values = objectiveValueOptions(kind);
    const value = values.length > 0 ? values[dayIndex % values.length] : undefined;

    // Always valid by construction (kind/value both come from this file's
    // own catalogs), so the null case is unreachable here.
    return buildObjective(kind, getDailyFormationCode(date), value)!;
}

// Picks which of the formation's non-GK slots start pre-filled — GK stats
// are ~always 0 (see server/utils/players.ts), so pre-filling one would just
// be a free no-op slot.
export function getDailyPrefilledSlotIds(date: string, formation: Formation): string[] {
    const dayIndex = dayIndexForDate(date);
    const count = 2 + (dayIndex % 2);
    const eligible = formation.slots.filter((slot) => slot.group !== 'GK').map((slot) => slot.id);

    return seededShuffle(eligible, `${date}:prefill`).slice(0, count);
}
