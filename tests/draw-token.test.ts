import { describe, expect, it } from 'vitest';
import { signPlayerToken, verifyPlayerToken } from '../server/utils/draw-token';

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
