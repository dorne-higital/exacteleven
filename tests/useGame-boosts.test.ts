import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../app/composables/useGame';
import { usePurchases } from '../app/composables/usePurchases';
import { useStats } from '../app/composables/useStats';
import type { DrawnPlayer, HintResult } from '../shared/types';

// Same fakeUseState/$fetch stubbing as useGame.test.ts. `useRuntimeConfig`
// is stubbed per test to switch between the website (no stub: isAppBuild()
// falls back to false) and the app build (public.isApp: true). The native
// shell is never present here, so purchases themselves stay unavailable —
// these tests only cover spending the bank / Pro, set directly on the state.
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
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal('useState', fakeUseState);
    vi.stubGlobal('$fetch', fetchMock);
    vi.stubGlobal('useStats', useStats);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function asApp(): void {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true } }));
}

function drawnPlayer(id: string): DrawnPlayer {
    return { id, name: `Player ${id}`, appearances: 100, clubs: ['Test FC'], firstSeason: 2016, lastSeason: 2023, token: `token-${id}` };
}

function candidates(prefix: string): DrawnPlayer[] {
    return [drawnPlayer(`${prefix}1`), drawnPlayer(`${prefix}2`), drawnPlayer(`${prefix}3`)];
}

// A Classic game with the GK slot open and its free reroll already used.
async function classicAfterFreeReroll() {
    const game = useGame();

    game.startGame('442');
    fetchMock.mockResolvedValueOnce(candidates('a'));
    await game.openSlot('gk');
    fetchMock.mockResolvedValueOnce(candidates('b'));
    expect(await game.useReroll()).toBe(true);
    expect(game.state.value!.rerollsLeft).toBe(0);

    return game;
}

describe('useGame boosts — website', () => {
    it('reports the free reroll, then nothing once it is used (no shop, no boosts)', async () => {
        const game = useGame();

        game.startGame('442');
        expect(game.canReroll.value).toEqual({ reason: 'free', freeLeft: 1 });

        const played = await classicAfterFreeReroll();

        expect(played.canReroll.value.reason).toBe('none');
        expect(await played.useReroll()).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(played.state.value!.assisted).toBe(false);
    });

    it('never spends a bank that somehow has boosts in it', async () => {
        const game = await classicAfterFreeReroll();

        usePurchases().boostBank.value = 3;

        expect(game.canReroll.value.reason).toBe('none');
        expect(await game.useReroll()).toBe(false);
        expect(usePurchases().boostBank.value).toBe(3);
    });
});

describe('useGame boosts — app', () => {
    it('spends one banked boost on a reroll only after the new draw arrives', async () => {
        asApp();
        const game = await classicAfterFreeReroll();
        const purchases = usePurchases();

        purchases.boostBank.value = 2;
        expect(game.canReroll.value.reason).toBe('boost');

        fetchMock.mockResolvedValueOnce(candidates('c'));
        expect(await game.useReroll()).toBe(true);

        expect(purchases.boostBank.value).toBe(1);
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['c1', 'c2', 'c3']);
        expect(game.state.value!.assisted).toBe(true);
        expect(game.state.value!.boostsSpent).toBe(1);
    });

    it('costs nothing when the paid reroll draw fails', async () => {
        asApp();
        const game = await classicAfterFreeReroll();
        const purchases = usePurchases();

        purchases.boostBank.value = 1;
        fetchMock.mockRejectedValueOnce(new Error('network drop'));

        expect(await game.useReroll()).toBe(false);
        expect(purchases.boostBank.value).toBe(1);
        expect(game.state.value!.assisted).toBe(false);
        expect(game.state.value!.boostsSpent).toBe(0);
    });

    it('points at the shop when the bank is empty', async () => {
        asApp();
        const game = await classicAfterFreeReroll();

        expect(game.canReroll.value.reason).toBe('shop');
        expect(await game.useReroll()).toBe(false);
    });

    it('gives Pro extra rerolls without touching the bank, and flags the game assisted', async () => {
        asApp();
        const game = await classicAfterFreeReroll();
        const purchases = usePurchases();

        purchases.isPro.value = true;
        purchases.boostBank.value = 4;
        expect(game.canReroll.value.reason).toBe('pro');

        fetchMock.mockResolvedValueOnce(candidates('c'));
        expect(await game.useReroll()).toBe(true);
        expect(game.state.value!.proRerollUsed).toBe(true);

        fetchMock.mockResolvedValueOnce(candidates('d'));
        expect(await game.useReroll()).toBe(true);

        expect(purchases.boostBank.value).toBe(4);
        expect(game.state.value!.assisted).toBe(true);
        expect(game.state.value!.boostsSpent).toBe(0);
    });

    it('never applies boosts or Pro to the Daily', async () => {
        asApp();
        const game = useGame();
        const purchases = usePurchases();

        purchases.boostBank.value = 5;
        purchases.isPro.value = true;
        game.startDailyGame({
            date: '2026-10-13',
            formationCode: '442',
            objective: { kind: 'over', value: 300, label: 'Over 300' },
            prefilled: [],
        });
        fetchMock.mockResolvedValueOnce(candidates('a'));
        await game.openSlot('gk');
        fetchMock.mockResolvedValueOnce(candidates('b'));
        expect(await game.useReroll()).toBe(true);

        expect(game.canReroll.value.reason).toBe('none');
        expect(await game.useReroll()).toBe(false);

        fetchMock.mockResolvedValueOnce({ ruledOutId: 'b1' } satisfies HintResult);
        expect(await game.useHint()).toBe('b1');
        expect(game.canHint.value.reason).toBe('none');
        expect(await game.useHint()).toBeNull();

        expect(purchases.boostBank.value).toBe(5);
        expect(game.state.value!.assisted).toBe(false);
    });

    it('allows boosts in a custom challenge', async () => {
        asApp();
        const game = useGame();

        usePurchases().boostBank.value = 1;
        game.startChallengeGame({ formationCode: '442', objective: { kind: 'exact', value: 442, label: 'Exact' }, prefilled: [] }, 'key');
        fetchMock.mockResolvedValueOnce(candidates('a'));
        await game.openSlot('gk');
        fetchMock.mockResolvedValueOnce(candidates('b'));
        await game.useReroll();

        expect(game.canReroll.value.reason).toBe('boost');
    });

    it('spends a boost on an extra hint only after the hint succeeds', async () => {
        asApp();
        const game = useGame();
        const purchases = usePurchases();

        purchases.boostBank.value = 1;
        game.startGame('442');
        fetchMock.mockResolvedValueOnce(candidates('a'));
        await game.openSlot('gk');

        fetchMock.mockResolvedValueOnce({ ruledOutId: 'a1' } satisfies HintResult);
        expect(await game.useHint()).toBe('a1');
        expect(game.canHint.value.reason).toBe('boost');
        expect(purchases.boostBank.value).toBe(1);

        fetchMock.mockRejectedValueOnce(new Error('network drop'));
        expect(await game.useHint()).toBeNull();
        expect(purchases.boostBank.value).toBe(1);

        fetchMock.mockResolvedValueOnce({ ruledOutId: 'a2' } satisfies HintResult);
        expect(await game.useHint()).toBe('a2');
        expect(purchases.boostBank.value).toBe(0);
        expect(game.state.value!.assisted).toBe(true);
        expect(game.state.value!.boostsSpent).toBe(1);
        expect(game.canHint.value.reason).toBe('shop');
    });

    it('refuses a reroll while a hint is in flight, so a paid hint is never wasted', async () => {
        asApp();
        const game = useGame();
        const purchases = usePurchases();

        purchases.boostBank.value = 2;
        game.startGame('442');
        fetchMock.mockResolvedValueOnce(candidates('a'));
        await game.openSlot('gk');

        let answerHint: (value: HintResult) => void = () => {};

        fetchMock.mockReturnValueOnce(new Promise<HintResult>((resolve) => {
            answerHint = resolve;
        }));

        const hint = game.useHint();

        expect(game.isHinting.value).toBe(true);
        expect(await game.useReroll()).toBe(false);

        answerHint({ ruledOutId: 'a1' });
        expect(await hint).toBe('a1');
        expect(game.state.value!.offeredPlayers.map((p) => p.id)).toEqual(['a1', 'a2', 'a3']);
        expect(game.state.value!.rerollsLeft).toBe(1);
        expect(purchases.boostBank.value).toBe(2);
    });

    it('keeps the hint lock for bought hints too', async () => {
        asApp();
        const game = useGame();

        usePurchases().isPro.value = true;
        game.startGame('442');

        for (const slot of game.state.value!.slots.slice(0, 9)) {
            slot.player = { id: slot.id, name: slot.id, position: slot.group, goals: 0, assists: 0, appearances: 1, clubs: [], firstSeason: 2000, lastSeason: 2001 };
        }

        expect(game.canHint.value).toMatchObject({ reason: 'none', locked: true });
    });
});
