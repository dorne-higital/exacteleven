import type { DrawnPlayer, PositionGroup } from '../../shared/types';
import { signPlayerToken } from '../utils/draw-token';
import { getPlayersByPosition } from '../utils/players';

const VALID_POSITIONS = new Set(['GK', 'DEF', 'MID', 'FWD']);
const CANDIDATES_PER_DRAW = 3;

function parseExclude(raw: unknown): Set<string> {
    if (typeof raw !== 'string' || raw.length === 0) {
        return new Set();
    }

    return new Set(raw.split(',').map((id) => id.trim()).filter(Boolean));
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
        token: await signPlayerToken(player.id, secret),
    })));
});
