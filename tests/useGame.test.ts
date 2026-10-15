import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextEmptySlotIn, resetPickRouteForTests, useGame } from '../app/composables/useGame';
import { useStats } from '../app/composables/useStats';
import type { ClassicPickResponse } from '../shared/daily2-types';
import type { DrawnPlayer, HintResult, RevealResult } from '../shared/types';

// useGame.ts (and useStats.ts, which it calls internally) rely on Nuxt's
// auto-imported `useState`/`$fetch` globals, which plain vitest doesn't
// provide. `import.meta.client` is also undefined under plain vitest (no
// Nuxt build-time define) — confirmed by probing it directly — which makes
// every `if (!import.meta.client) return` guard in both composables
// (trackEvent, localStorage/dataLayer writes, refreshWinOdds) a no-op during
// these tests. That's what keeps this stub this small: no window.dataLayer,
// no localStorage, no win-odds fetch to mock:
// - `useState` becomes a plain per-key ref cache, reset before each test so
//   state never leaks between them.
// - `$fetch` becomes a vi.fn() each test configures for the routes it calls.
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

const fetchMock = vi.fn();

beforeEach(() => {
    stateStore.clear();
    fetchMock.mockReset();
    // The in-progress game persists to localStorage now (with a one-time
    // migration from the old sessionStorage key) — wipe both so no test
    // resumes another's game.
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('useState', fakeUseState);
    vi.stubGlobal('$fetch', fetchMock);
    // useGame.ts calls useStats() by its Nuxt auto-import name — the real
    // implementation is safe to run as-is here since it only touches
    // localStorage/dataLayer behind the same import.meta.client guard.
    vi.stubGlobal('useStats', useStats);
    resetPickRouteForTests();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function drawnPlayer(id: string, token = `token-${id}`): DrawnPlayer {
    return { id, name: `Player ${id}`, appearances: 100, clubs: ['Test FC'], firstSeason: 2016, lastSeason: 2023, token };
}

// A POST /api/pick reply (DAILY2_SPEC §3.4).
function picked(goals: number, assists = 0, extra: Partial<ClassicPickResponse> = {}): ClassicPickResponse {
    return { status: 'ok', reveal: { goals, assists }, next: null, winOdds: null, ...extra };
}

const notFound = { statusCode: 404 };

describe('useGame', () => {
    it('startGame initializes a fresh, playing game for the given formation', () => {
        const game = useGame();

        game.startGame('442');

        expect(game.state.value).toMatchObject({
            formationCode: '442',
            target: 442,
            status: 'playing',
            total: 0,
            rerollsLeft: 1,
            hintsLeft: 1,
            activeSlotId: null,
        });
        expect(game.state.value!.slots).toHaveLength(11);
        expect(game.state.value!.slots.every((slot) => slot.player === null)).toBe(true);
    });

    it('openSlot draws candidates and opens the dialog for that slot', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);

        await game.openSlot('gk');

        expect(fetchMock).toHaveBeenCalledWith('/api/draw', expect.objectContaining({ query: expect.objectContaining({ position: 'GK' }) }));
        expect(game.state.value!.activeSlotId).toBe('gk');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['a', 'b', 'c']);
        expect(game.state.value!.offeredPlayerIds).toEqual(['a', 'b', 'c']);
    });

    it('openSlot sets drawError and leaves the game untouched when the draw request fails', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockRejectedValueOnce(new Error('network drop'));

        await game.openSlot('gk');

        expect(game.drawError.value).toBe(true);
        expect(game.state.value!.activeSlotId).toBeNull();
    });

    it('pickPlayer fills the slot and recalculates the running total, staying "playing" mid-game', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce(picked(5, 3));
        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toEqual({ goals: 5, assists: 3 });
        expect(fetchMock).toHaveBeenLastCalledWith('/api/pick', expect.objectContaining({
            method: 'POST',
            body: expect.objectContaining({
                mode: 'classic',
                token: 'token-a',
                group: 'GK',
                total: 0,
                objectiveKind: 'exact',
                objectiveValue: 442,
                exclude: ['a', 'b', 'c'],
                next: { slotId: 'def-1', group: 'DEF' },
            }),
        }));
        expect(fetchMock.mock.calls.at(-1)![1].body.openAfter).toHaveLength(10);
        expect(game.state.value!.total).toBe(8);
        expect(game.state.value!.status).toBe('playing');
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player?.id).toBe('a');
    });

    it('pickPlayer busts the game immediately once the total passes the target', async () => {
        const game = useGame();

        game.startGame('442'); // target 442
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce(picked(500));
        await game.pickPlayer(drawnPlayer('a'));

        expect(game.state.value!.status).toBe('bust');
    });

    it('pickPlayer returns null (and leaves the slot open) when a 410\'s token refresh itself fails, without touching game state', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockRejectedValueOnce(new TypeError('network drop'));
        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toBeNull();
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player).toBeNull();
        expect(game.state.value!.status).toBe('playing');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    });

    it('pickPlayer returns null (and leaves the slot open) on any other failure', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockRejectedValueOnce({ statusCode: 403 });
        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toBeNull();
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player).toBeNull();
    });

    it('filling every slot exactly on target wins the game', async () => {
        const game = useGame();

        game.startGame('442'); // target 442, 11 slots

        const slotIds = game.state.value!.slots.map((slot) => slot.id);

        // 10 zero-value picks, then one final pick worth exactly 442 —
        // exercises the real per-pick total/status recompute across a whole
        // game, not just a single pick in isolation.
        for (let i = 0; i < slotIds.length - 1; i += 1) {
            fetchMock.mockResolvedValueOnce([drawnPlayer(`p${i}`)]);
            await game.openSlot(slotIds[i]!);
            fetchMock.mockResolvedValueOnce(picked(0));
            await game.pickPlayer(drawnPlayer(`p${i}`));
        }

        expect(game.state.value!.status).toBe('playing');

        const lastId = slotIds[slotIds.length - 1]!;

        fetchMock.mockResolvedValueOnce([drawnPlayer('last')]);
        await game.openSlot(lastId);
        fetchMock.mockResolvedValueOnce(picked(442));
        await game.pickPlayer(drawnPlayer('last'));

        expect(game.state.value!.total).toBe(442);
        expect(game.state.value!.status).toBe('won');
    });

    it('useReroll redraws the active slot and spends the single reroll', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce([drawnPlayer('d'), drawnPlayer('e'), drawnPlayer('f')]);
        const rerolled = await game.useReroll();

        expect(rerolled).toBe(true);
        expect(game.state.value!.rerollsLeft).toBe(0);
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['d', 'e', 'f']);

        const secondAttempt = await game.useReroll();

        expect(secondAttempt).toBe(false);
        expect(game.state.value!.rerollsLeft).toBe(0);
    });

    it('useHint returns the ruled-out candidate and spends the single hint, only on success', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce({ ruledOutId: 'b' } satisfies HintResult);
        const ruledOut = await game.useHint();

        expect(ruledOut).toBe('b');
        expect(game.state.value!.hintsLeft).toBe(0);

        const secondAttempt = await game.useHint();

        expect(secondAttempt).toBeNull();
        expect(game.state.value!.hintsLeft).toBe(0);
    });

    it('useHint does not spend the hint when the request fails', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockRejectedValueOnce(new Error('network drop'));
        const ruledOut = await game.useHint();

        expect(ruledOut).toBeNull();
        expect(game.state.value!.hintsLeft).toBe(1);
    });

    it('useHint is locked (and unspent) once fewer than 3 slots are open', async () => {
        const game = useGame();

        game.startGame('442');
        const slots = game.state.value!.slots;

        for (const slot of slots.slice(0, slots.length - 2)) {
            slot.player = { id: `filled-${slot.id}`, name: 'Filler', goals: 0, assists: 0 } as never;
        }

        expect(game.isHintLocked()).toBe(true);

        const openSlotId = slots[slots.length - 1]!.id;

        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot(openSlotId);
        fetchMock.mockClear();

        expect(await game.useHint()).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(game.state.value!.hintsLeft).toBe(1);
    });

    it('closeDialog clears the active slot and offered players without touching filled slots', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        game.closeDialog();

        expect(game.state.value!.activeSlotId).toBeNull();
        expect(game.state.value!.offeredPlayers).toEqual([]);
        expect(game.state.value!.slots.every((slot) => slot.player === null)).toBe(true);
    });

    it('reopening a closed slot shows the same 3 candidates without a new draw (no free reroll)', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');
        game.closeDialog();
        fetchMock.mockClear();

        await game.openSlot('gk');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(game.state.value!.activeSlotId).toBe('gk');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['a', 'b', 'c']);
        expect(game.state.value!.rerollsLeft).toBe(1);
    });

    it('keeps each slot\'s candidates separately, and the reroll is still the only way to change them', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');
        fetchMock.mockResolvedValueOnce([drawnPlayer('d'), drawnPlayer('e'), drawnPlayer('f')]);
        await game.useReroll();
        game.closeDialog();

        const defenderId = game.state.value!.slots.find((slot) => slot.group === 'DEF')!.id;

        fetchMock.mockResolvedValueOnce([drawnPlayer('g'), drawnPlayer('h'), drawnPlayer('i')]);
        await game.openSlot(defenderId);
        game.closeDialog();
        fetchMock.mockClear();

        await game.openSlot('gk');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['d', 'e', 'f']);
        game.closeDialog();

        await game.openSlot(defenderId);
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['g', 'h', 'i']);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reopening after a reload still shows the same candidates (persisted with the game)', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');
        game.closeDialog();

        game.state.value = null;
        expect(game.resumeGame('442')).toBe(true);
        fetchMock.mockClear();

        await game.openSlot('gk');

        expect(fetchMock).not.toHaveBeenCalled();
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    });

    it('a filled slot forgets its candidates', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');
        fetchMock.mockResolvedValueOnce(picked(0));
        await game.pickPlayer(drawnPlayer('a'));
        game.closeDialog();

        expect(game.state.value!.offeredBySlot?.gk).toBeUndefined();
    });

    it('the hint\'s ruled-out candidate survives closing and reopening the slot, and clears on a reroll', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');
        fetchMock.mockResolvedValueOnce({ ruledOutId: 'b' } satisfies HintResult);
        await game.useHint();
        game.closeDialog();
        await game.openSlot('gk');

        expect(game.state.value!.ruledOutBySlot?.gk).toBe('b');

        fetchMock.mockResolvedValueOnce([drawnPlayer('d'), drawnPlayer('e'), drawnPlayer('f')]);
        await game.useReroll();

        expect(game.state.value!.ruledOutBySlot?.gk).toBeUndefined();
    });

    it('pickPlayer (old server, no /api/pick) re-signs an expired token for the same candidates and retries the reveal', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
            .mockRejectedValueOnce(notFound)
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockResolvedValueOnce([{ id: 'a', token: 'fresh-a' }, { id: 'b', token: 'fresh-b' }, { id: 'c', token: 'fresh-c' }])
            .mockResolvedValueOnce({ goals: 2, assists: 1 } satisfies RevealResult);

        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toEqual({ goals: 2, assists: 1 });
        expect(fetchMock).toHaveBeenCalledWith('/api/refresh-tokens', expect.objectContaining({ method: 'POST' }));
        expect(fetchMock).toHaveBeenLastCalledWith('/api/reveal', expect.objectContaining({ body: expect.objectContaining({ token: 'fresh-a' }) }));
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player?.id).toBe('a');
    });

    it('pickPlayer (old server) falls back to a free fresh draw when the candidates are too old to re-sign', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
            .mockRejectedValueOnce(notFound)
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockResolvedValueOnce([drawnPlayer('x'), drawnPlayer('y'), drawnPlayer('z')]);

        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toBe('timeout');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['x', 'y', 'z']);
        expect(game.state.value!.rerollsLeft).toBe(1);
        expect(game.state.value!.activeSlotId).toBe('gk');
    });

    it('a draw failure while offline says so', async () => {
        const game = useGame();
        const onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

        game.startGame('442');
        fetchMock.mockRejectedValueOnce(new TypeError('Load failed'));
        await game.openSlot('gk');

        expect(game.drawError.value).toBe(true);
        expect(game.drawErrorMessage.value).toMatch(/offline/i);
        onLine.mockRestore();
    });

    it('resumeGame restores a persisted game for a matching formation, and rejects a mismatched one', () => {
        const game = useGame();

        game.startGame('442');
        const persistedGameId = game.state.value!.gameId;

        // Simulate a fresh mount: nothing in memory, but localStorage still
        // holds the last session's game (writePersistedGame isn't gated
        // behind import.meta.client, so it really did write during startGame
        // above).
        game.state.value = null;

        expect(game.resumeGame('433')).toBe(false);
        expect(game.state.value).toBeNull();

        expect(game.resumeGame('442')).toBe(true);
        expect(game.state.value!.gameId).toBe(persistedGameId);
    });

    it('reset clears both the live state and anything persisted', () => {
        const game = useGame();

        game.startGame('442');
        game.reset();

        expect(game.state.value).toBeNull();
        expect(game.resumeGame('442')).toBe(false);
    });

    it('migrates a game saved by the old sessionStorage version, once', () => {
        const game = useGame();

        game.startGame('433');
        const saved = JSON.parse(window.localStorage.getItem('exact-xi-game')!).game;

        window.localStorage.clear();
        window.sessionStorage.setItem('exact-xi-game', JSON.stringify(saved));
        game.state.value = null;

        expect(game.resumeGame('433')).toBe(true);
        expect(game.state.value!.gameId).toBe(saved.gameId);
        expect(window.sessionStorage.getItem('exact-xi-game')).toBeNull();
        expect(JSON.parse(window.localStorage.getItem('exact-xi-game')!).game.gameId).toBe(saved.gameId);
    });

    it('resumes a Classic game saved by the pre-2.0 build (no new fields) and plays on through /api/pick', async () => {
        const game = useGame();

        game.startGame('442');
        // Strip the record back to exactly the a2613c7 GameState shape, mid-game
        // with an open slot's stale candidates cached (old 5-minute tokens).
        const fresh = JSON.parse(window.localStorage.getItem('exact-xi-game')!).game;
        const old = {
            gameId: fresh.gameId,
            formationCode: '442',
            target: 442,
            slots: fresh.slots.map((slot: { id: string }) => ({ ...slot, player: null })),
            offeredPlayerIds: ['a', 'b', 'c'],
            rerollsLeft: 1,
            hintsLeft: 1,
            total: 0,
            status: 'playing',
            tier: null,
            activeSlotId: null,
            offeredPlayers: [],
            offeredBySlot: { gk: [drawnPlayer('a', 'old-a'), drawnPlayer('b', 'old-b'), drawnPlayer('c', 'old-c')] },
            ruledOutBySlot: {},
            statsRecorded: false,
        };

        window.localStorage.setItem('exact-xi-game', JSON.stringify({ savedAt: Date.now(), game: old }));
        game.state.value = null;

        expect(game.resumeGame('442')).toBe(true);
        await game.openSlot('gk');
        expect(fetchMock).not.toHaveBeenCalledWith('/api/draw', expect.anything());
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['a', 'b', 'c']);

        fetchMock.mockResolvedValueOnce(picked(4, 2));
        expect(await game.pickPlayer(drawnPlayer('a', 'old-a'))).toEqual({ goals: 4, assists: 2 });
        expect(fetchMock).toHaveBeenLastCalledWith('/api/pick', expect.objectContaining({ body: expect.objectContaining({ token: 'old-a', mode: 'classic' }) }));
        expect(game.state.value!.total).toBe(6);
    });

    it('discards an unreadable saved game without throwing', () => {
        const game = useGame();

        window.localStorage.setItem('exact-xi-game', '{not json');
        expect(game.resumeGame('442')).toBe(false);
        window.localStorage.setItem('exact-xi-game', JSON.stringify({ savedAt: Date.now() }));
        expect(game.resumeGame('442')).toBe(false);
        window.localStorage.setItem('exact-xi-daily2', '{"date":"bad","game":{}}');
        expect(game.resumeGame('442')).toBe(false);
    });

    it('discards a saved game too broken to render (right formation, no slots) and clears it', () => {
        const game = useGame();

        window.localStorage.setItem('exact-xi-game', JSON.stringify({ savedAt: Date.now(), game: { gameId: 'g-12345678', formationCode: '442', target: 442 } }));
        expect(game.resumeGame('442')).toBe(false);
        expect(window.localStorage.getItem('exact-xi-game')).toBeNull();

        window.localStorage.setItem('exact-xi-game', JSON.stringify({
            savedAt: Date.now(),
            game: { gameId: 'g-12345678', formationCode: '442', target: 442, slots: [null], objective: null },
        }));
        expect(game.resumeGame('442')).toBe(false);
    });

    it('does not resume a game left untouched for more than a day', () => {
        const game = useGame();

        game.startGame('442');
        const record = JSON.parse(window.localStorage.getItem('exact-xi-game')!);

        record.savedAt = Date.now() - 25 * 60 * 60 * 1000;
        window.localStorage.setItem('exact-xi-game', JSON.stringify(record));
        game.state.value = null;

        expect(game.resumeGame('442')).toBe(false);
    });
    it('draws ahead: the next slot\'s options come back with the reveal and open instantly', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce(picked(0, 0, {
            next: { slotId: 'def-1', candidates: [drawnPlayer('d'), drawnPlayer('e'), drawnPlayer('f')] },
            winOdds: { waysToWin: 3, totalWays: 9 },
        }));
        await game.pickPlayer(drawnPlayer('a'));

        expect(game.state.value!.offeredBySlot?.['def-1']?.map((p) => p.id)).toEqual(['d', 'e', 'f']);
        expect(game.state.value!.offeredPlayerIds).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
        expect(game.winOdds.value).toEqual({ waysToWin: 3, totalWays: 9 });

        fetchMock.mockClear();
        await game.openNextSlot();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(game.state.value!.activeSlotId).toBe('def-1');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['d', 'e', 'f']);
    });

    it('does not ask for a prefetch when the next slot already has options', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('d'), drawnPlayer('e'), drawnPlayer('f')]);
        await game.openSlot('def-1');
        game.closeDialog();
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce(picked(1));
        await game.pickPlayer(drawnPlayer('a'));

        expect(fetchMock.mock.calls.at(-1)![1].body.next).toBeNull();
        expect(game.state.value!.offeredBySlot?.['def-1']?.map((p) => p.id)).toEqual(['d', 'e', 'f']);
    });

    it('drops a prefetched draw once the game is over', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a')]);
        await game.openSlot('gk');
        fetchMock.mockResolvedValueOnce(picked(500, 0, { next: { slotId: 'def-1', candidates: [drawnPlayer('d')] } }));
        await game.pickPlayer(drawnPlayer('a'));

        expect(game.state.value!.status).toBe('bust');
        expect(game.state.value!.offeredBySlot?.['def-1']).toBeUndefined();

        fetchMock.mockClear();
        await game.openNextSlot();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(game.state.value!.activeSlotId).toBeNull();
    });

    it('an expired pick gets a free fresh three for the same slot, without spending the reroll', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce({ status: 'expired', redraw: { candidates: [drawnPlayer('x'), drawnPlayer('y'), drawnPlayer('z')] } } satisfies ClassicPickResponse);
        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toBe('timeout');
        expect(game.state.value!.activeSlotId).toBe('gk');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['x', 'y', 'z']);
        expect(game.state.value!.offeredBySlot?.gk?.map((p) => p.id)).toEqual(['x', 'y', 'z']);
        expect(game.state.value!.offeredPlayerIds).toEqual(['a', 'b', 'c', 'x', 'y', 'z']);
        expect(game.state.value!.rerollsLeft).toBe(1);
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player).toBeNull();
    });

    it('falls back to the old reveal route on a 404, and stays on it for the session', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
            .mockRejectedValueOnce(notFound)
            .mockResolvedValueOnce({ goals: 4, assists: 1 } satisfies RevealResult);
        expect(await game.pickPlayer(drawnPlayer('a'))).toEqual({ goals: 4, assists: 1 });
        expect(fetchMock).toHaveBeenLastCalledWith('/api/reveal', expect.objectContaining({ body: { token: 'token-a', gameId: game.state.value!.gameId } }));
        expect(game.state.value!.total).toBe(5);

        game.closeDialog();
        fetchMock.mockResolvedValueOnce([drawnPlayer('d')]);
        await game.openSlot('def-1');
        fetchMock.mockClear();
        fetchMock.mockResolvedValueOnce({ goals: 1, assists: 0 } satisfies RevealResult);
        await game.pickPlayer(drawnPlayer('d'));

        expect(fetchMock.mock.calls[0]![0]).toBe('/api/reveal');
        expect(fetchMock.mock.calls.some(([url]) => url === '/api/pick')).toBe(false);
    });

    it('falls back to the old reveal route for one pick when /api/pick rejects the combined request (400)', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
            .mockRejectedValueOnce({ statusCode: 400 })
            .mockResolvedValueOnce({ goals: 2, assists: 0 } satisfies RevealResult);
        expect(await game.pickPlayer(drawnPlayer('a'))).toEqual({ goals: 2, assists: 0 });
        expect(fetchMock.mock.calls.map(([url]) => url)).toContain('/api/reveal');

        // A 400 isn't "old server": the next pick tries /api/pick again.
        game.closeDialog();
        fetchMock.mockResolvedValueOnce([drawnPlayer('d')]);
        await game.openSlot('def-1');
        fetchMock.mockClear();
        fetchMock.mockResolvedValueOnce(picked(1));
        await game.pickPlayer(drawnPlayer('d'));

        expect(fetchMock.mock.calls[0]![0]).toBe('/api/pick');
    });

    it('nextEmptySlotId walks formation order after a slot, wrapping, skipping filled and locked slots', () => {
        const game = useGame();

        game.startGame('442');
        const slots = game.state.value!.slots;

        expect(game.nextEmptySlotId()).toBe('gk');
        expect(game.nextEmptySlotId('gk')).toBe('def-1');
        slots.find((slot) => slot.id === 'def-1')!.player = { id: 'x' } as never;
        slots.find((slot) => slot.id === 'def-2')!.preset = true;
        expect(game.nextEmptySlotId('gk')).toBe('def-3');
        expect(game.nextEmptySlotId('fwd-2')).toBe('gk');

        for (const slot of slots) {
            if (slot.id !== 'mid-1') {
                slot.player = { id: slot.id } as never;
            }
        }

        expect(game.nextEmptySlotId('mid-1')).toBeNull();
        expect(nextEmptySlotIn({ slots }, 'fwd-1')).toBe('mid-1');
    });

    it('replaySameFormation starts a fresh Classic game on the same formation', () => {
        const game = useGame();

        game.startGame('352');
        const firstId = game.state.value!.gameId;

        game.state.value!.status = 'bust';
        game.replaySameFormation();

        expect(game.state.value!.formationCode).toBe('352');
        expect(game.state.value!.status).toBe('playing');
        expect(game.state.value!.gameId).not.toBe(firstId);
    });

    it('remembers the last formation started, in state and storage', () => {
        const game = useGame();

        expect(game.lastFormation.value).toBeNull();
        game.startGame('541');

        expect(game.lastFormation.value).toBe('541');
        expect(window.localStorage.getItem('exact-xi-last-formation')).toBe('541');

        game.lastFormation.value = null;
        game.loadLastFormation();
        expect(game.lastFormation.value).toBe('541');

        window.localStorage.setItem('exact-xi-last-formation', 'nonsense');
        game.loadLastFormation();
        expect(game.lastFormation.value).toBeNull();
    });
});
