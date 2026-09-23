import type { DrawnPlayer, PositionGroup } from '../../shared/types';
import { signPlayerToken } from '../utils/draw-token';
import { getPlayersByPosition } from '../utils/players';

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD']);
const CANDIDATES_PER_DRAW = 3;
const GAME_ID_PATTERN = /^[\w-]{8,64}$/;
const PLAYER_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A real game excludes at most 33 ids (11 slots x 3 candidates, before
// dedup) — these are generous multiples of that, not a tight fit.
const MAX_EXCLUDE_LENGTH = 2000;
const MAX_EXCLUDED_IDS = 60;

function parseExclude(raw: unknown): Set<string> {
    if (typeof raw !== 'string' || raw.length === 0) {
        return new Set();
    }

    if (raw.length > MAX_EXCLUDE_LENGTH) {
        throw createError({ statusCode: 400, statusMessage: 'exclude is too long.' });
    }

    const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length > MAX_EXCLUDED_IDS) {
        throw createError({ statusCode: 400, statusMessage: `exclude accepts at most ${MAX_EXCLUDED_IDS} ids.` });
    }

    return new Set(ids.filter((id) => PLAYER_ID_PATTERN.test(id)));
}

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
    const chosen = sampleWithoutReplacement(eligible, CANDIDATES_PER_DRAW);
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
