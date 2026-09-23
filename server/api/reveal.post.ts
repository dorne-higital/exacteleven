import type { RevealResult } from '../../shared/types';
import { verifyPlayerToken } from '../utils/draw-token';
import { getPlayerById } from '../utils/players';

export default defineEventHandler(async (event): Promise<RevealResult> => {
    const body = await readBody<{ token?: unknown }>(event);
    const token = typeof body?.token === 'string' ? body.token : '';

    if (!token) {
        throw createError({ statusCode: 400, statusMessage: 'token is required.' });
    }

    const secret = useRuntimeConfig().drawTokenSecret;
    const playerId = await verifyPlayerToken(token, secret);

    if (!playerId) {
        // Either tampered with, or a valid-looking token for a player id that
        // /api/draw never actually signed — reject either way (D2 anti-peek).
        throw createError({ statusCode: 403, statusMessage: 'This player was not offered in this game.' });
    }

    const player = getPlayerById(playerId);

    if (!player) {
        throw createError({ statusCode: 404, statusMessage: 'Player not found.' });
    }

    return { goals: player.goals, assists: player.assists };
});
