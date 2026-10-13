import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../app/composables/useGame';
import { useStats } from '../app/composables/useStats';
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
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function drawnPlayer(id: string, token = `token-${id}`): DrawnPlayer {
    return { id, name: `Player ${id}`, appearances: 100, clubs: ['Test FC'], firstSeason: 2016, lastSeason: 2023, token };
}

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

        fetchMock.mockResolvedValueOnce({ goals: 5, assists: 3 } satisfies RevealResult);
        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toEqual({ goals: 5, assists: 3 });
        expect(game.state.value!.total).toBe(8);
        expect(game.state.value!.status).toBe('playing');
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player?.id).toBe('a');
    });

    it('pickPlayer busts the game immediately once the total passes the target', async () => {
        const game = useGame();

        game.startGame('442'); // target 442
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce({ goals: 500, assists: 0 } satisfies RevealResult);
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
            fetchMock.mockResolvedValueOnce({ goals: 0, assists: 0 } satisfies RevealResult);
            await game.pickPlayer(drawnPlayer(`p${i}`));
        }

        expect(game.state.value!.status).toBe('playing');

        const lastId = slotIds[slotIds.length - 1]!;

        fetchMock.mockResolvedValueOnce([drawnPlayer('last')]);
        await game.openSlot(lastId);
        fetchMock.mockResolvedValueOnce({ goals: 442, assists: 0 } satisfies RevealResult);
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
        fetchMock.mockResolvedValueOnce({ goals: 0, assists: 0 } satisfies RevealResult);
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

    it('pickPlayer re-signs an expired token for the same candidates and retries the reveal', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockResolvedValueOnce([{ id: 'a', token: 'fresh-a' }, { id: 'b', token: 'fresh-b' }, { id: 'c', token: 'fresh-c' }])
            .mockResolvedValueOnce({ goals: 2, assists: 1 } satisfies RevealResult);

        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toEqual({ goals: 2, assists: 1 });
        expect(fetchMock).toHaveBeenCalledWith('/api/refresh-tokens', expect.objectContaining({ method: 'POST' }));
        expect(fetchMock).toHaveBeenLastCalledWith('/api/reveal', expect.objectContaining({ body: expect.objectContaining({ token: 'fresh-a' }) }));
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player?.id).toBe('a');
    });

    it('pickPlayer falls back to a free fresh draw when the candidates are too old to re-sign', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock
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

    it('does not resume a game left untouched for more than a day', () => {
        const game = useGame();

        game.startGame('442');
        const record = JSON.parse(window.localStorage.getItem('exact-xi-game')!);

        record.savedAt = Date.now() - 25 * 60 * 60 * 1000;
        window.localStorage.setItem('exact-xi-game', JSON.stringify(record));
        game.state.value = null;

        expect(game.resumeGame('442')).toBe(false);
    });
});
