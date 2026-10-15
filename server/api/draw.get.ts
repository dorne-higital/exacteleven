import type { DrawnPlayer, ObjectiveKind, PositionGroup } from '../../shared/types';
import { drawClassicCandidates, toDrawnPlayers } from '../utils/classic-draw';
import { parseExclude } from '../utils/parse-exclude';

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD']);
const VALID_OBJECTIVE_KINDS = new Set(['exact', 'over', 'under', 'allUnder']);
const GAME_ID_PATTERN = /^[\w-]{8,64}$/;
// This slot plus every OTHER remaining one is at most 11 (a real formation's
// ceiling) — a generous cap against a malformed/hostile query, not a tight fit.
const MAX_OTHER_REMAINING = 10;

// The draw itself (random sample, the "at least one option keeps a win
// possible" bias, and the exact-objective final-slot rule) lives in
// server/utils/classic-draw.ts, shared with POST /api/pick.

// Optional viability-bias inputs — absent or malformed just means "skip the
// bias, draw plain random" rather than a hard failure, so an older client
// tab still mid-game during a deploy (sending the pre-existing query shape)
// keeps working exactly as before instead of erroring out.
function tryParseOtherRemaining(raw: unknown): PositionGroup[] | null {
    if (typeof raw !== 'string') {
        return null;
    }

    if (raw.length === 0) {
        return [];
    }

    const groups = raw.split(',');

    if (groups.length > MAX_OTHER_REMAINING || groups.some((group) => !VALID_POSITIONS.has(group))) {
        return null;
    }

    return groups as PositionGroup[];
}

function tryParseObjectiveKind(raw: unknown): ObjectiveKind | null {
    return typeof raw === 'string' && VALID_OBJECTIVE_KINDS.has(raw) ? raw as ObjectiveKind : null;
}

function tryParseNonNegativeNumber(raw: unknown): number | null {
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }

    const value = Number(raw);

    return Number.isFinite(value) && value >= 0 ? value : null;
}

export default defineEventHandler(async (event): Promise<DrawnPlayer[]> => {
    const query = getQuery(event);
    const position = String(query.position ?? '');

    if (!VALID_POSITIONS.has(position)) {
        throw createError({ statusCode: 400, statusMessage: 'position must be one of GK, DEF, MID, FWD.' });
    }

    const gameId = String(query.gameId ?? '');

    if (!GAME_ID_PATTERN.test(gameId)) {
        throw createError({ statusCode: 400, statusMessage: 'gameId is required.' });
    }

    const exclude = parseExclude(query.exclude);
    const otherRemaining = tryParseOtherRemaining(query.remaining);
    const objectiveKind = tryParseObjectiveKind(query.objectiveKind);
    const objectiveValue = tryParseNonNegativeNumber(query.objectiveValue);
    const runningTotal = tryParseNonNegativeNumber(query.total);

    const hasBias = otherRemaining !== null && objectiveKind !== null && objectiveValue !== null && runningTotal !== null;
    const chosen = drawClassicCandidates({
        group: position as PositionGroup,
        excludeIds: exclude,
        bias: hasBias ? { otherRemaining, objectiveKind, objectiveValue, runningTotal } : null,
    });

    // Optional, additive: long=1 (the app) signs 30-minute tokens instead of 5.
    const long = query.long === '1' || query.long === 'true' || query.long === true;

    // Never include goals/assists here (D2) — only what's needed to render a choice.
    return toDrawnPlayers(chosen, gameId, useRuntimeConfig().drawTokenSecret, long);
});
