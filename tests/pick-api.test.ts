import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signPlayerToken } from '../server/utils/draw-token';
import { createMemoryKv, setDailyKvForTests } from '../server/utils/daily2-store';
import { getPuzzle, serverDaily } from '../server/utils/daily2-puzzle';
import { getPlayerById } from '../server/utils/players';
import type { ClassicPickResponse, DailyMove, DailyPickResponse } from '../shared/daily2-types';
import type { DrawnPlayer } from '../shared/types';

// POST /api/pick — "half the round trips". Same Nitro-global stubbing as
// tests/api-routes.test.ts: the stubs must exist before the route modules load.
const SECRET = 'test-secret';
const GAME_ID = 'pick-game-0001';

vi.stubGlobal('defineEventHandler', (handler: (event: unknown) => unknown) => handler);
vi.stubGlobal('createError', (options: { statusCode: number; statusMessage?: string }) => (
    Object.assign(new Error(options.statusMessage ?? 'error'), options)
));
vi.stubGlobal('useRuntimeConfig', () => ({ drawTokenSecret: SECRET }));
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query);
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body);
vi.stubGlobal('setResponseHeader', () => undefined);

const pick = (await import('../server/api/pick.post')).default;
const draw = (await import('../server/api/draw.get')).default;

const body = (value: unknown) => ({ body: value });

function classicBody(token: string, overrides: Record<string, unknown> = {}) {
    return {
        mode: 'classic',
        gameId: GAME_ID,
        token,
        group: 'FWD',
        total: 100,
        objectiveKind: 'exact',
        objectiveValue: 433,
        exclude: [],
        openAfter: ['MID', 'DEF'],
        next: { slotId: 'cm-1', group: 'MID' },
        ...overrides,
    };
}

describe('POST /api/pick — classic', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('reveals the pick and returns the next slot\'s candidates in one reply', async () => {
        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];
        const player = getPlayerById(candidate!.id)!;
        const result = await pick(body(classicBody(candidate!.token, { exclude: [candidate!.id] }))) as ClassicPickResponse;

        expect(result.status).toBe('ok');
        expect(result.reveal).toEqual({ goals: player.goals, assists: player.assists });
        expect(result.next!.slotId).toBe('cm-1');
        expect(result.next!.candidates).toHaveLength(3);

        for (const next of result.next!.candidates) {
            expect(next).not.toHaveProperty('goals');
            expect(next).not.toHaveProperty('assists');
            expect(getPlayerById(next.id)!.position).toBe('MID');
            expect(next.id).not.toBe(candidate!.id);
        }

        // 11 − 2 open = 9 filled → odds included.
        expect(result.winOdds).toMatchObject({ waysToWin: expect.any(Number), totalWays: expect.any(Number) });
    });

    it('the next candidates\' tokens reveal through /api/pick too', async () => {
        const [first] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];
        const step = await pick(body(classicBody(first!.token))) as ClassicPickResponse;
        const nextChoice = step.next!.candidates[0]!;
        const player = getPlayerById(nextChoice.id)!;
        const second = await pick(body(classicBody(nextChoice.token, { group: 'MID', openAfter: ['DEF'], next: null }))) as ClassicPickResponse;

        expect(second.reveal).toEqual({ goals: player.goals, assists: player.assists });
        expect(second.next).toBeNull();
    });

    it('withholds win odds while fewer than 6 slots are filled', async () => {
        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];
        const result = await pick(body(classicBody(candidate!.token, {
            openAfter: ['GK', 'DEF', 'DEF', 'DEF', 'DEF', 'MID'],
            next: { slotId: 'gk', group: 'GK' },
        }))) as ClassicPickResponse;

        expect(result.winOdds).toBeNull();
        expect(result.next!.candidates).toHaveLength(3);
    });

    it('signs long tokens on request', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];
        const result = await pick(body(classicBody(candidate!.token, { long: true }))) as ClassicPickResponse;
        const nextToken = result.next!.candidates[0]!.token;

        vi.setSystemTime(Date.now() + 20 * 60 * 1000);

        const reveal = (await import('../server/api/reveal.post')).default;

        await expect(reveal(body({ token: nextToken, gameId: GAME_ID }))).resolves.toHaveProperty('goals');
    });

    it('accepts a token past its 5-minute reveal window (inside 24 h) without a refresh', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];

        vi.setSystemTime(Date.now() + 60 * 60 * 1000);

        await expect(pick(body(classicBody(candidate!.token)))).resolves.toMatchObject({ status: 'ok' });
    });

    it('an expired (24 h+) token gets a free fresh draw for the same slot instead of an error', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });

        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];

        vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);

        const result = await pick(body(classicBody(candidate!.token, { exclude: [candidate!.id] }))) as ClassicPickResponse;

        expect(result.status).toBe('expired');
        expect(result.reveal).toBeUndefined();
        expect(result.redraw!.candidates).toHaveLength(3);

        for (const fresh of result.redraw!.candidates) {
            expect(fresh).not.toHaveProperty('goals');
            expect(getPlayerById(fresh.id)!.position).toBe('FWD');
            expect(fresh.id).not.toBe(candidate!.id);
        }
    });

    it('rejects a forged token, or one from another game, with 403', async () => {
        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];
        const forged = await signPlayerToken(candidate!.id, GAME_ID, 'not-the-real-secret');

        await expect(pick(body(classicBody(forged)))).rejects.toMatchObject({ statusCode: 403 });
        await expect(pick(body(classicBody(candidate!.token, { gameId: 'another-game-01' })))).rejects.toMatchObject({ statusCode: 403 });
    });

    it('validates its inputs with 400', async () => {
        const [candidate] = await draw({ query: { position: 'FWD', gameId: GAME_ID } }) as DrawnPlayer[];
        const token = candidate!.token;

        await expect(pick(body({ mode: 'nope' }))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(null))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { gameId: 'short' })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { group: 'XX' })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { objectiveKind: 'nope' })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { objectiveValue: undefined })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { exclude: new Array(61).fill('a') })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { openAfter: new Array(11).fill('DEF') })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody(token, { next: { slotId: 'BAD SLOT', group: 'MID' } })))).rejects.toMatchObject({ statusCode: 400 });
        await expect(pick(body(classicBody('', {})))).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('POST /api/pick — daily', () => {
    const DATE = '2026-10-14';

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
        setDailyKvForTests(createMemoryKv());
    });

    afterEach(() => {
        vi.useRealTimers();
        setDailyKvForTests(null);
    });

    it('replays the move log, reveals the pick and returns the snapshot', async () => {
        const daily = serverDaily(await getPuzzle(DATE));
        const slot = daily.puzzle.slots[0]!;
        const chosen = slot.main[1]!;
        const moves: DailyMove[] = [{ t: 'pick', slotId: slot.slotId, playerId: chosen.id }];
        const result = await pick(body({ mode: 'daily', date: DATE, runId: 'run-abcdefgh', moves })) as DailyPickResponse;

        expect(result.status).toBe('ok');
        expect(result.reveal).toEqual({ playerId: chosen.id, goals: chosen.goals, assists: chosen.assists });
        expect(result.snapshot.filled).toBe(daily.puzzle.locked.length + 1);
        expect(result.snapshot.openSlotIds).not.toContain(slot.slotId);
        expect(result.winOdds).toBeNull(); // too few filled yet
    });

    it('rejects a player that was not offered, and a non-pick last move', async () => {
        const daily = serverDaily(await getPuzzle(DATE));
        const [first, second] = daily.puzzle.slots;

        await expect(pick(body({ mode: 'daily', date: DATE, runId: 'run-abcdefgh', moves: [{ t: 'pick', slotId: first!.slotId, playerId: second!.main[0]!.id }] })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'not_offered' });
        // The reroll set isn't on offer until the reroll is used.
        await expect(pick(body({ mode: 'daily', date: DATE, runId: 'run-abcdefgh', moves: [{ t: 'pick', slotId: first!.slotId, playerId: first!.reroll[0]!.id }] })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'not_offered' });
        await expect(pick(body({ mode: 'daily', date: DATE, runId: 'run-abcdefgh', moves: [{ t: 'captain', slotId: first!.slotId }] })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_move' });
    });

    it('refuses tomorrow (403 not_yet) and dates before launch (404)', async () => {
        await expect(pick(body({ mode: 'daily', date: '2026-10-15', runId: 'run-abcdefgh', moves: [] })))
            .rejects.toMatchObject({ statusCode: 403, statusMessage: 'not_yet' });
        await expect(pick(body({ mode: 'daily', date: '2026-01-01', runId: 'run-abcdefgh', moves: [] })))
            .rejects.toMatchObject({ statusCode: 404, statusMessage: 'before_launch' });
    });
});
