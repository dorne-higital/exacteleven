import type { ObjectiveKind, PositionGroup, WinOdds } from '../../shared/types';
import { parseExclude } from '../utils/parse-exclude';
import { computeWinOdds } from '../utils/win-odds';

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD']);
const VALID_OBJECTIVE_KINDS = new Set(['exact', 'over', 'under', 'allUnder']);
// A real formation fields at most 11 slots total, so 11 remaining is already
// the ceiling — a generous cap against a malformed/hostile query, not a tight fit.
const MAX_REMAINING = 11;

function parseRemaining(raw: unknown): PositionGroup[] {
    if (typeof raw !== 'string' || raw.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'remaining is required.' });
    }

    const groups = raw.split(',');

    if (groups.length > MAX_REMAINING) {
        throw createError({ statusCode: 400, statusMessage: `remaining accepts at most ${MAX_REMAINING} slots.` });
    }

    for (const group of groups) {
        if (!VALID_POSITIONS.has(group)) {
            throw createError({ statusCode: 400, statusMessage: 'remaining must only contain GK, DEF, MID, FWD.' });
        }
    }

    return groups as PositionGroup[];
}

function parseObjectiveKind(raw: unknown): ObjectiveKind {
    const kind = String(raw ?? 'exact');

    if (!VALID_OBJECTIVE_KINDS.has(kind)) {
        throw createError({ statusCode: 400, statusMessage: 'objectiveKind must be one of exact, over, under, allUnder.' });
    }

    return kind as ObjectiveKind;
}

function parseNonNegativeNumber(raw: unknown, field: string): number {
    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0) {
        throw createError({ statusCode: 400, statusMessage: `${field} must be a non-negative number.` });
    }

    return value;
}

// A read-only flavor stat, not a secret — it only ever reasons about
// aggregate counts across a whole position's pool, never about which
// specific players are in it, so it doesn't leak anything /api/draw and
// /api/reveal are protecting (see D2 in the build brief).
export default defineEventHandler((event): WinOdds => {
    const query = getQuery(event);

    return computeWinOdds({
        remainingGroups: parseRemaining(query.remaining),
        excludeIds: parseExclude(query.exclude),
        objectiveKind: parseObjectiveKind(query.objectiveKind),
        objectiveValue: parseNonNegativeNumber(query.objectiveValue, 'objectiveValue'),
        runningTotal: parseNonNegativeNumber(query.total, 'total'),
    });
});
