import { afterEach, describe, expect, it, vi } from 'vitest';
import { signPlayerToken, TOKEN_TTL_LONG_MS, verifyPlayerToken, verifyTokenForRefresh } from '../server/utils/draw-token';

const SECRET = 'test-secret';
const GAME_ID = 'game-abc12345';

describe('draw-token', () => {
    it('round-trips: a token verifies back to the player id it was signed for, in the game it was signed for', async () => {
        const token = await signPlayerToken('player-1', GAME_ID, SECRET);

        await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: true, playerId: 'player-1' });
    });

    it('rejects a token presented against a different game id than it was signed for', async () => {
        const token = await signPlayerToken('player-1', GAME_ID, SECRET);

        await expect(verifyPlayerToken(token, 'some-other-game', SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
    });

    it('rejects a token signed with a different secret', async () => {
        const token = await signPlayerToken('player-1', GAME_ID, SECRET);

        await expect(verifyPlayerToken(token, GAME_ID, 'wrong-secret')).resolves.toEqual({ valid: false, reason: 'invalid' });
    });

    it('rejects a tampered token whose payload was swapped for a different player id', async () => {
        const tokenA = await signPlayerToken('player-1', GAME_ID, SECRET);
        const tokenB = await signPlayerToken('player-2', GAME_ID, SECRET);
        const [, signatureB] = tokenB.split('.');
        const [payloadA] = tokenA.split('.');
        const tampered = `${payloadA}.${signatureB}`;

        await expect(verifyPlayerToken(tampered, GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
    });

    it('rejects a token with no separator', async () => {
        await expect(verifyPlayerToken('not-a-real-token', GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
    });

    it('never throws on garbage input, including an empty string', async () => {
        await expect(verifyPlayerToken('', GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
        await expect(verifyPlayerToken('....', GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
        await expect(verifyPlayerToken('garbage.garbage', GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
    });

    it('rejects a token older than the 5-minute expiry window with reason "expired", not "invalid"', async () => {
        const realNow = Date.now;

        try {
            Date.now = () => realNow() - (6 * 60 * 1000);

            const token = await signPlayerToken('player-1', GAME_ID, SECRET);

            Date.now = realNow;

            await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'expired' });
        } finally {
            Date.now = realNow;
        }
    });

    it('accepts a token issued just under the expiry window', async () => {
        const realNow = Date.now;

        try {
            Date.now = () => realNow() - (4 * 60 * 1000);

            const token = await signPlayerToken('player-1', GAME_ID, SECRET);

            Date.now = realNow;

            await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: true, playerId: 'player-1' });
        } finally {
            Date.now = realNow;
        }
    });
});

// Long (app) tokens: the TTL rides inside the signed payload, capped at 30 minutes.
function payloadOf(token: string): Record<string, unknown> {
    const [encoded] = token.split('.');
    const padded = encoded!.replace(/-/g, '+').replace(/_/g, '/');

    return JSON.parse(atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='))) as Record<string, unknown>;
}

describe('draw-token — long (30-minute) tokens', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('leaves a default token\'s payload exactly as before (no ttl field)', async () => {
        const token = await signPlayerToken('player-1', GAME_ID, SECRET);

        expect(Object.keys(payloadOf(token)).sort()).toEqual(['gameId', 'issuedAt', 'playerId']);
    });

    it('signs the ttl into the payload, so editing it breaks the signature', async () => {
        const token = await signPlayerToken('player-1', GAME_ID, SECRET, { ttlMs: TOKEN_TTL_LONG_MS });
        const payload = payloadOf(token);

        expect(payload.ttl).toBe(TOKEN_TTL_LONG_MS);

        const stretched = btoa(JSON.stringify({ ...payload, ttl: 10 * TOKEN_TTL_LONG_MS })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const [, signature] = token.split('.');

        await expect(verifyPlayerToken(`${stretched}.${signature}`, GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'invalid' });
    });

    it('a long token outlives the 5-minute window but expires after 30 minutes', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const token = await signPlayerToken('player-1', GAME_ID, SECRET, { ttlMs: TOKEN_TTL_LONG_MS });

        vi.setSystemTime(Date.now() + 20 * 60 * 1000);
        await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: true, playerId: 'player-1' });

        vi.setSystemTime(Date.now() + 11 * 60 * 1000);
        await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'expired' });
        // Still re-signable inside the 24 h refresh window, like any other token.
        await expect(verifyTokenForRefresh(token, GAME_ID, SECRET)).resolves.toEqual({ valid: true, playerId: 'player-1' });
    });

    it('caps a signed ttl above 30 minutes at 30 minutes', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const token = await signPlayerToken('player-1', GAME_ID, SECRET, { ttlMs: 5 * TOKEN_TTL_LONG_MS });

        vi.setSystemTime(Date.now() + 31 * 60 * 1000);
        await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'expired' });
    });

    it('treats a zero or negative ttl as the default 5 minutes', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const token = await signPlayerToken('player-1', GAME_ID, SECRET, { ttlMs: 0 });

        vi.setSystemTime(Date.now() + 4 * 60 * 1000);
        await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: true, playerId: 'player-1' });
        vi.setSystemTime(Date.now() + 2 * 60 * 1000);
        await expect(verifyPlayerToken(token, GAME_ID, SECRET)).resolves.toEqual({ valid: false, reason: 'expired' });
    });
});
