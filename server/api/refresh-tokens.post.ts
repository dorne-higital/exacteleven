import type { RefreshedToken } from '../../shared/types';
import { signPlayerToken, TOKEN_TTL_LONG_MS, verifyTokenForRefresh } from '../utils/draw-token';
import { CANDIDATES_PER_DRAW } from '../utils/game-constants';

// Re-signs the anti-peek tokens for players a game was ALREADY offered, so
// reopening a slot can show the same 3 options it drew earlier (closing the
// choice sheet no longer throws the draw away — that was a free, unlimited
// reroll) even once their 5-minute tokens have expired. Same players, same
// game id, fresh issuedAt — nothing new is drawn and no goals/assists are
// returned (D2 boundary unchanged). Added alongside the v1 routes; nothing
// existing calls or depends on it. Optional `long: true` (the app) re-signs
// them as 30-minute tokens (see draw-token.ts) instead of the default 5.

export default defineEventHandler(async (event): Promise<RefreshedToken[]> => {
    const body = await readBody<{ gameId?: unknown; tokens?: unknown; long?: unknown }>(event);
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

    const secret = useRuntimeConfig().drawTokenSecret;
    const signOptions = body.long === true ? { ttlMs: TOKEN_TTL_LONG_MS } : {};
    const refreshed: RefreshedToken[] = [];

    for (const token of body.tokens) {
        const verification = await verifyTokenForRefresh(token, gameId, secret);

        if (!verification.valid) {
            if (verification.reason === 'expired') {
                // Too old even to re-sign — the client falls back to a fresh draw.
                throw createError({ statusCode: 410, statusMessage: 'These options have expired.' });
            }

            throw createError({ statusCode: 403, statusMessage: 'One of these players was not offered in this game.' });
        }

        refreshed.push({ id: verification.playerId, token: await signPlayerToken(verification.playerId, gameId, secret, signOptions) });
    }

    return refreshed;
});
