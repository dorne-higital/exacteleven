import type {
    ClassicPickResponse,
    DailyPickResponse,
} from '#shared/daily2-types';
import type { ObjectiveKind, PositionGroup } from '../../shared/types';
import { drawClassicCandidates, toDrawnPlayers } from '../utils/classic-draw';
import {
    dailyWinOdds,
    getPuzzle,
    ID_PATTERN,
    replayOrThrow,
    requireDailyDate,
    requireId,
    requireMoves,
    serverDaily,
} from '../utils/daily2-puzzle';
import { verifyTokenForRefresh } from '../utils/draw-token';
import { getPlayerById } from '../utils/players';
import { computeWinOdds } from '../utils/win-odds';

// POST /api/pick — "half the round trips": one request reveals the pick AND
// returns what the client would otherwise ask for next (the next slot's
// options and the updated win odds). Discriminated by `mode`:
// - 'classic': token-verified reveal + next draw + odds. Replaces
//   /api/reveal + /api/draw + /api/win-odds, which all stay as they are (the
//   client falls back to them on a 404 from a mid-deploy server).
// - 'daily': Daily 2.0 — no tokens; the server replays the whole move log
//   against the frozen puzzle's true stats and checks the pick was offered.
// New route, so nothing shipped depends on its shape yet.

const VALID_POSITIONS = new Set<string>(['GK', 'DEF', 'MID', 'FWD']);
const VALID_OBJECTIVE_KINDS = new Set<string>(['exact', 'over', 'under', 'allUnder']);
const PLAYER_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLOT_ID_PATTERN = /^[a-z]{2,3}(-\d{1,2})?$/;
// Same caps as /api/draw and /api/hint.
const MAX_EXCLUDED_IDS = 60;
const MAX_OPEN_AFTER = 10;
const TOTAL_SLOTS = 11;
// Win odds only once this many slots are filled (as the client already does).
const MIN_FILLED_FOR_ODDS = 6;

function bad(statusMessage: string): Error {
    return createError({ statusCode: 400, statusMessage });
}

function parseGroup(raw: unknown): PositionGroup {
    if (typeof raw !== 'string' || !VALID_POSITIONS.has(raw)) {
        throw bad('group must be one of GK, DEF, MID, FWD.');
    }

    return raw as PositionGroup;
}

function parseGroups(raw: unknown): PositionGroup[] {
    if (!Array.isArray(raw) || raw.length > MAX_OPEN_AFTER) {
        throw bad(`openAfter must be an array of at most ${MAX_OPEN_AFTER} groups.`);
    }

    return raw.map(parseGroup);
}

function parseExcludeArray(raw: unknown): Set<string> {
    if (raw === undefined) {
        return new Set();
    }

    if (!Array.isArray(raw) || raw.length > MAX_EXCLUDED_IDS) {
        throw bad(`exclude must be an array of at most ${MAX_EXCLUDED_IDS} ids.`);
    }

    return new Set(raw.filter((id): id is string => typeof id === 'string' && PLAYER_ID_PATTERN.test(id)));
}

function parseNonNegative(raw: unknown, field: string): number {
    const value = Number(raw);

    if (raw === undefined || raw === null || raw === '' || !Number.isFinite(value) || value < 0) {
        throw bad(`${field} must be a non-negative number.`);
    }

    return value;
}

async function classicPick(body: Record<string, unknown>): Promise<ClassicPickResponse> {
    const gameId = typeof body.gameId === 'string' ? body.gameId : '';

    if (!ID_PATTERN.test(gameId)) {
        throw bad('gameId is required.');
    }

    const token = typeof body.token === 'string' ? body.token : '';

    if (!token) {
        throw bad('token is required.');
    }

    const group = parseGroup(body.group);
    const total = parseNonNegative(body.total, 'total');
    const objectiveKind = (body.objectiveKind ?? 'exact') as ObjectiveKind;

    if (!VALID_OBJECTIVE_KINDS.has(objectiveKind)) {
        throw bad('objectiveKind must be one of exact, over, under, allUnder.');
    }

    const objectiveValue = parseNonNegative(body.objectiveValue, 'objectiveValue');
    const exclude = parseExcludeArray(body.exclude);
    const openAfter = parseGroups(body.openAfter);
    const long = body.long === true;
    const secret = useRuntimeConfig().drawTokenSecret;

    let next: { slotId: string; group: PositionGroup } | null = null;

    if (body.next !== undefined && body.next !== null) {
        const raw = body.next as Record<string, unknown>;

        if (typeof raw !== 'object' || typeof raw.slotId !== 'string' || !SLOT_ID_PATTERN.test(raw.slotId)) {
            throw bad('next must be { slotId, group } or null.');
        }

        next = { slotId: raw.slotId, group: parseGroup(raw.group) };
    }

    // The 24 h refresh window, not the 5-minute reveal window: tokens are
    // already re-signable for 24 h (/api/refresh-tokens), so accepting them
    // here widens nothing and saves the refresh round trip.
    const verification = await verifyTokenForRefresh(token, gameId, secret);

    if (!verification.valid) {
        if (verification.reason === 'invalid') {
            throw createError({ statusCode: 403, statusMessage: 'This player was not offered in this game.' });
        }

        // Older than 24 h: a free fresh draw for the SAME slot instead of an
        // error ("those options went stale").
        const redraw = drawClassicCandidates({
            group,
            excludeIds: exclude,
            bias: { otherRemaining: openAfter, objectiveKind, objectiveValue, runningTotal: total },
        });

        return { status: 'expired', redraw: { candidates: await toDrawnPlayers(redraw, gameId, secret, long) } };
    }

    const player = getPlayerById(verification.playerId);

    if (!player) {
        throw createError({ statusCode: 404, statusMessage: 'Player not found.' });
    }

    const newTotal = total + player.goals + player.assists;
    const excludeIds = new Set([...exclude, player.id]);
    let nextResult: ClassicPickResponse['next'] = null;

    if (next && openAfter.includes(next.group)) {
        const otherRemaining = [...openAfter];

        otherRemaining.splice(otherRemaining.indexOf(next.group), 1);

        const candidates = drawClassicCandidates({
            group: next.group,
            excludeIds,
            bias: { otherRemaining, objectiveKind, objectiveValue, runningTotal: newTotal },
        });

        nextResult = { slotId: next.slotId, candidates: await toDrawnPlayers(candidates, gameId, secret, long) };

        for (const candidate of candidates) {
            excludeIds.add(candidate.id);
        }
    }

    const winOdds = TOTAL_SLOTS - openAfter.length >= MIN_FILLED_FOR_ODDS
        ? computeWinOdds({ remainingGroups: openAfter, excludeIds, objectiveKind, objectiveValue, runningTotal: newTotal })
        : null;

    return { status: 'ok', reveal: { goals: player.goals, assists: player.assists }, next: nextResult, winOdds };
}

async function dailyPick(body: Record<string, unknown>): Promise<DailyPickResponse> {
    const date = requireDailyDate(body.date);

    requireId(body.runId, 'bad_run_id');

    const moves = requireMoves(body.moves);
    const last = moves[moves.length - 1];

    if (!last || last.t !== 'pick') {
        throw bad('bad_move');
    }

    const daily = serverDaily(await getPuzzle(date));
    const { snapshot } = replayOrThrow(daily, moves);
    const player = daily.playerById.get(last.playerId)!;

    return {
        status: 'ok',
        reveal: { playerId: player.id, goals: player.goals, assists: player.assists },
        snapshot,
        winOdds: dailyWinOdds(daily, snapshot, moves),
    };
}

export default defineEventHandler(async (event): Promise<ClassicPickResponse | DailyPickResponse> => {
    const body = await readBody<Record<string, unknown> | null>(event);

    if (!body || typeof body !== 'object') {
        throw bad('bad_mode');
    }

    if (body.mode === 'daily') {
        return dailyPick(body);
    }

    if (body.mode === 'classic') {
        return classicPick(body);
    }

    throw bad('bad_mode');
});
