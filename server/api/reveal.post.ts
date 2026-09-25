import type { RevealResult } from '../../shared/types';
import { verifyPlayerToken } from '../utils/draw-token';
import { getPlayerById } from '../utils/players';

export default defineEventHandler(async (event): Promise<RevealResult> => {
    const body = await readBody<{ token?: unknown; gameId?: unknown }>(event);
    const token = typeof body?.token === 'string' ? body.token : '';
    const gameId = typeof body?.gameId === 'string' ? body.gameId : '';

    if (!token || !gameId) {
        throw createError({ statusCode: 400, statusMessage: 'token and gameId are required.' });
    }

    const secret = useRuntimeConfig().drawTokenSecret;
    const verification = await verifyPlayerToken(token, gameId, secret);

    if (!verification.valid) {
        if (verification.reason === 'expired') {
            // 410 Gone — a real player who sat on this pick past the token's
            // TTL, not an anti-peek rejection. Distinct status so the client
            // can show a neutral "that timed out" message instead of the
            // accusatory one below.
            throw createError({ statusCode: 410, statusMessage: 'This pick timed out — try again.' });
        }

        // Either tampered with, or a valid-looking token for a player id that
        // /api/draw never actually signed — reject either way (D2 anti-peek).
        throw createError({ statusCode: 403, statusMessage: 'This player was not offered in this game.' });
    }

    const player = getPlayerById(verification.playerId);

    if (!player) {
        throw createError({ statusCode: 404, statusMessage: 'Player not found.' });
    }

    return { goals: player.goals, assists: player.assists };
});
