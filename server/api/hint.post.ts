import type { HintResult, ObjectiveKind, PositionGroup } from '../../shared/types';
import { verifyPlayerToken } from '../utils/draw-token';
import { parseExclude } from '../utils/parse-exclude';
import { getPlayerById } from '../utils/players';
import { computeWinOdds } from '../utils/win-odds';

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD']);
const VALID_OBJECTIVE_KINDS = new Set(['exact', 'over', 'under', 'allUnder']);
const CANDIDATES_PER_DRAW = 3;
// A real formation fields at most 11 slots total, so 10 remaining (every
// slot but the one being hinted on) is already the ceiling — a generous cap
// against a malformed/hostile body, not a tight fit.
const MAX_REMAINING = 10;

function parseRemaining(raw: unknown): PositionGroup[] {
    if (typeof raw !== 'string' || raw.length === 0) {
        return [];
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

interface HintBody {
    gameId?: unknown;
    tokens?: unknown;
    remaining?: unknown;
    exclude?: unknown;
    objectiveKind?: unknown;
    objectiveValue?: unknown;
    total?: unknown;
}

// Scores each of the 3 currently-offered candidates by what picking them
// would leave for the rest of the game — same odds math /api/win-odds uses,
// just run once per candidate — and recommends whichever leaves the most
// ways to still win. Tokens (not raw ids) prove each candidate was
// genuinely offered in this exact game, mirroring /api/reveal's anti-peek
// shape — but only the winning id is ever returned, never any goals/assists.
export default defineEventHandler(async (event): Promise<HintResult> => {
    const body = await readBody<HintBody>(event);
    const gameId = typeof body?.gameId === 'string' ? body.gameId : '';

    if (!gameId) {
        throw createError({ statusCode: 400, statusMessage: 'gameId is required.' });
    }

    if (
        !Array.isArray(body?.tokens) || body.tokens.length === 0 || body.tokens.length > CANDIDATES_PER_DRAW
        || !body.tokens.every((token): token is string => typeof token === 'string')
    ) {
        throw createError({ statusCode: 400, statusMessage: `tokens must be an array of 1-${CANDIDATES_PER_DRAW} strings.` });
    }

    const remainingGroups = parseRemaining(body.remaining);
    const excludeIds = parseExclude(body.exclude);
    const objectiveKind = parseObjectiveKind(body.objectiveKind);
    const objectiveValue = parseNonNegativeNumber(body.objectiveValue, 'objectiveValue');
    const runningTotal = parseNonNegativeNumber(body.total, 'total');
    const secret = useRuntimeConfig().drawTokenSecret;

    let best: { id: string; waysToWin: number } | null = null;

    for (const token of body.tokens) {
        const playerId = await verifyPlayerToken(token, gameId, secret);

        if (!playerId) {
            throw createError({ statusCode: 403, statusMessage: 'One of these players was not offered in this game.' });
        }

        const player = getPlayerById(playerId);

        if (!player) {
            throw createError({ statusCode: 404, statusMessage: 'Player not found.' });
        }

        const { waysToWin } = computeWinOdds({
            remainingGroups,
            excludeIds,
            objectiveKind,
            objectiveValue,
            runningTotal: runningTotal + player.goals + player.assists,
        });

        if (!best || waysToWin > best.waysToWin) {
            best = { id: playerId, waysToWin };
        }
    }

    if (!best) {
        throw createError({ statusCode: 400, statusMessage: 'No valid candidates provided.' });
    }

    return { recommendedId: best.id };
});
