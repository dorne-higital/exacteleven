import type { DrawnPlayer, ObjectiveKind, Player, PositionGroup } from '../../shared/types';
import { signPlayerToken } from '../utils/draw-token';
import { parseExclude } from '../utils/parse-exclude';
import { getPlayersByPosition } from '../utils/players';
import { buildViabilityCheck } from '../utils/win-odds';

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD']);
const VALID_OBJECTIVE_KINDS = new Set(['exact', 'over', 'under', 'allUnder']);
const CANDIDATES_PER_DRAW = 3;
const GAME_ID_PATTERN = /^[\w-]{8,64}$/;
// This slot plus every OTHER remaining one is at most 11 (a real formation's
// ceiling) — a generous cap against a malformed/hostile query, not a tight fit.
const MAX_OTHER_REMAINING = 10;

// Random sample without replacement — fine for a pool of a few hundred
// players; no need for anything fancier here.
function sampleWithoutReplacement<T>(items: T[], count: number): T[] {
    const pool = [...items];
    const picked: T[] = [];

    while (pool.length > 0 && picked.length < count) {
        const index = Math.floor(Math.random() * pool.length);
        const [item] = pool.splice(index, 1);

        if (item !== undefined) {
            picked.push(item);
        }
    }

    return picked;
}

// At least one of the 3 candidates offered should keep the game genuinely
// winnable when the pool allows it — otherwise a run of bad luck alone could
// make a slot's draw a dead end regardless of skill, and the Hint feature
// would sometimes be recommending "the best of 3 losing options" rather than
// an actual path to winning. `viable` is a subset of the whole eligible pool
// (already computed by the caller); the other 2 slots stay plain random, and
// the 3 are shuffled together so the guaranteed pick doesn't always land in
// the same offered position.
function drawWithViabilityBias(eligible: Player[], viable: Player[], count: number): Player[] {
    if (viable.length === 0) {
        return sampleWithoutReplacement(eligible, count);
    }

    const guaranteed = viable[Math.floor(Math.random() * viable.length)]!;
    const rest = eligible.filter((player) => player.id !== guaranteed.id);
    const combined = [guaranteed, ...sampleWithoutReplacement(rest, count - 1)];

    for (let i = combined.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));

        [combined[i], combined[j]] = [combined[j]!, combined[i]!];
    }

    return combined;
}

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
    const eligible = getPlayersByPosition(position as PositionGroup).filter((player) => !exclude.has(player.id));

    const otherRemaining = tryParseOtherRemaining(query.remaining);
    const objectiveKind = tryParseObjectiveKind(query.objectiveKind);
    const objectiveValue = tryParseNonNegativeNumber(query.objectiveValue);
    const runningTotal = tryParseNonNegativeNumber(query.total);

    let chosen: Player[];

    if (otherRemaining !== null && objectiveKind !== null && objectiveValue !== null && runningTotal !== null) {
        const otherPools = otherRemaining.map((group) => (
            getPlayersByPosition(group).filter((player) => !exclude.has(player.id))
        ));
        const isViable = buildViabilityCheck(otherPools, objectiveKind, objectiveValue, runningTotal);
        const viable = eligible.filter((player) => isViable(player.goals + player.assists));

        chosen = drawWithViabilityBias(eligible, viable, CANDIDATES_PER_DRAW);
    } else {
        chosen = sampleWithoutReplacement(eligible, CANDIDATES_PER_DRAW);
    }

    const secret = useRuntimeConfig().drawTokenSecret;

    // Never include goals/assists here (D2) — only what's needed to render a choice.
    return Promise.all(chosen.map(async (player) => ({
        id: player.id,
        name: player.name,
        clubs: player.clubs,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        appearances: player.appearances,
        token: await signPlayerToken(player.id, gameId, secret),
    })));
});
