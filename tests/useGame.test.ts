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

    it('pickPlayer returns "timeout" (and leaves the slot open) on a 410 without touching game state', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockRejectedValueOnce({ statusCode: 410 });
        const result = await game.pickPlayer(drawnPlayer('a'));

        expect(result).toBe('timeout');
        expect(game.state.value!.slots.find((slot) => slot.id === 'gk')!.player).toBeNull();
        expect(game.state.value!.status).toBe('playing');
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

    it('useHint returns a recommendation and spends the single hint, only on success', async () => {
        const game = useGame();

        game.startGame('442');
        fetchMock.mockResolvedValueOnce([drawnPlayer('a'), drawnPlayer('b'), drawnPlayer('c')]);
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce({ recommendedId: 'b' } satisfies HintResult);
        const recommended = await game.useHint();

        expect(recommended).toBe('b');
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
        const recommended = await game.useHint();

        expect(recommended).toBeNull();
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
    });

    it('resumeGame restores a persisted game for a matching formation, and rejects a mismatched one', () => {
        const game = useGame();

        game.startGame('442');
        const persistedGameId = game.state.value!.gameId;

        // Simulate a fresh mount: nothing in memory, but sessionStorage still
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
});
