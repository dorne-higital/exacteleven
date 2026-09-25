import { describe, expect, it, vi } from 'vitest';
import { signPlayerToken } from '../server/utils/draw-token';
import { getPlayerById } from '../server/utils/players';
import type { DrawnPlayer, HintResult, RevealResult } from '../shared/types';

// server/api/*.ts route handlers rely on Nitro/H3 auto-imports
// (defineEventHandler, getQuery/readBody, createError, useRuntimeConfig) —
// same situation as useGame.ts's Nuxt auto-imports (see
// tests/nuxt-globals.d.ts and tests/useGame.test.ts's own comment). The
// handlers call defineEventHandler(fn) at MODULE load time (not inside a
// function body), so these stubs have to be in place before the route
// modules are imported — hence the vi.stubGlobal calls up front, then a
// dynamic import once they're armed, rather than beforeEach.
const SECRET = 'test-secret';
const GAME_ID = 'test-game-001';

vi.stubGlobal('defineEventHandler', (handler: (event: unknown) => unknown) => handler);
vi.stubGlobal('createError', (options: { statusCode: number; statusMessage?: string }) => (
    Object.assign(new Error(options.statusMessage ?? 'error'), options)
));
vi.stubGlobal('useRuntimeConfig', () => ({ drawTokenSecret: SECRET }));
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query);
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body);

const draw = (await import('../server/api/draw.get')).default;
const reveal = (await import('../server/api/reveal.post')).default;
const hint = (await import('../server/api/hint.post')).default;

function fakeQueryEvent(query: Record<string, unknown>) {
    return { query };
}

function fakeBodyEvent(body: unknown) {
    return { body };
}

describe('GET /api/draw', () => {
    it('draws 3 real candidates for a valid position without exposing goals or assists (D2)', async () => {
        const result = await draw(fakeQueryEvent({ position: 'GK', gameId: GAME_ID })) as DrawnPlayer[];

        expect(result).toHaveLength(3);

        for (const candidate of result) {
            expect(candidate).toHaveProperty('token');
            expect(candidate).toHaveProperty('id');
            expect(candidate).not.toHaveProperty('goals');
            expect(candidate).not.toHaveProperty('assists');
        }

        // Real ids, not placeholders — each one resolves to an actual player.
        expect(result.every((candidate) => getPlayerById(candidate.id) !== undefined)).toBe(true);
    });

    it('rejects a position outside GK/DEF/MID/FWD with 400', async () => {
        await expect(draw(fakeQueryEvent({ position: 'XXX', gameId: GAME_ID })))
            .rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects a malformed gameId with 400', async () => {
        await expect(draw(fakeQueryEvent({ position: 'GK', gameId: 'short' })))
            .rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('POST /api/reveal — full draw -> reveal round trip', () => {
    it('reveals the real hidden stats for a player genuinely offered in this game', async () => {
        const [candidate] = await draw(fakeQueryEvent({ position: 'FWD', gameId: GAME_ID })) as DrawnPlayer[];
        const realPlayer = getPlayerById(candidate!.id)!;

        const result = await reveal(fakeBodyEvent({ token: candidate!.token, gameId: GAME_ID })) as RevealResult;

        expect(result).toEqual({ goals: realPlayer.goals, assists: realPlayer.assists });
    });

    it('rejects a token presented against a different game id with 403 (D2 anti-peek)', async () => {
        const [candidate] = await draw(fakeQueryEvent({ position: 'FWD', gameId: GAME_ID })) as DrawnPlayer[];

        await expect(reveal(fakeBodyEvent({ token: candidate!.token, gameId: 'a-different-game' })))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects a token that was never actually signed by /api/draw with 403', async () => {
        await expect(reveal(fakeBodyEvent({ token: 'not-a-real-token', gameId: GAME_ID })))
            .rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects an expired token with 410, distinctly from a tampered one', async () => {
        const realNow = Date.now;

        Date.now = () => realNow() - (6 * 60 * 1000);
        const staleToken = await signPlayerToken('some-player-id', GAME_ID, SECRET);

        Date.now = realNow;

        await expect(reveal(fakeBodyEvent({ token: staleToken, gameId: GAME_ID })))
            .rejects.toMatchObject({ statusCode: 410 });
    });

    it('rejects a request missing token or gameId with 400', async () => {
        await expect(reveal(fakeBodyEvent({ gameId: GAME_ID }))).rejects.toMatchObject({ statusCode: 400 });
        await expect(reveal(fakeBodyEvent({ token: 'x' }))).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('POST /api/hint', () => {
    it('recommends one of the currently-offered candidates', async () => {
        const candidates = await draw(fakeQueryEvent({ position: 'MID', gameId: GAME_ID })) as DrawnPlayer[];

        const result = await hint(fakeBodyEvent({
            gameId: GAME_ID,
            tokens: candidates.map((candidate) => candidate.token),
            remaining: '',
            exclude: '',
            objectiveKind: 'exact',
            objectiveValue: 400,
            total: 0,
        })) as HintResult;

        expect(candidates.map((candidate) => candidate.id)).toContain(result.recommendedId);
    });

    it('rejects a token that was not offered in this game with 403', async () => {
        await expect(hint(fakeBodyEvent({
            gameId: GAME_ID,
            tokens: ['not-a-real-token'],
            remaining: '',
            exclude: '',
            objectiveKind: 'exact',
            objectiveValue: 400,
            total: 0,
        }))).rejects.toMatchObject({ statusCode: 403 });
    });

    it('rejects more tokens than a single draw could have offered with 400', async () => {
        const candidates = await draw(fakeQueryEvent({ position: 'DEF', gameId: GAME_ID })) as DrawnPlayer[];

        await expect(hint(fakeBodyEvent({
            gameId: GAME_ID,
            tokens: [...candidates.map((candidate) => candidate.token), 'one-too-many'],
            remaining: '',
            exclude: '',
            objectiveKind: 'exact',
            objectiveValue: 400,
            total: 0,
        }))).rejects.toMatchObject({ statusCode: 400 });
    });
});
