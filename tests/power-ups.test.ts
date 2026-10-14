import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShop } from '../app/composables/useShop';
import { powerUpButton, powerUpNote } from '../app/utils/power-ups';
import { bestValuePackId, formatPrice, perBoostLabel } from '../app/utils/shop';

// import.meta.client is unset under vitest, so trackEvent is captured here.
const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));

vi.mock('../app/utils/analytics', () => ({ trackEvent }));

// The pick sheet's Reroll / Hint button copy (utils/power-ups.ts), the
// shop's per-boost prices (utils/shop.ts) and the shop's open/close guard
// (composables/useShop.ts — never opens on the website).
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

beforeEach(() => {
    stateStore.clear();
    trackEvent.mockClear();
    vi.stubGlobal('useState', fakeUseState);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('powerUpButton', () => {
    it('shows the free counter while the free one is left', () => {
        expect(powerUpButton('reroll', { reason: 'free', freeLeft: 1 }, 7)).toEqual({ label: 'Reroll · 1 left', action: 'use' });
        expect(powerUpButton('hint', { reason: 'free', freeLeft: 1 }, 0)).toEqual({ label: 'Hint · 1 left', action: 'use' });
    });

    it('offers a banked boost with the bank count', () => {
        expect(powerUpButton('reroll', { reason: 'boost', freeLeft: 0 }, 12)).toEqual({ label: 'Reroll · use a boost (12)', action: 'use' });
        expect(powerUpButton('hint', { reason: 'boost', freeLeft: 0 }, 1).label).toBe('Hint · use a boost (1)');
    });

    it('labels a Pro extra', () => {
        expect(powerUpButton('reroll', { reason: 'pro', freeLeft: 0 }, 0)).toEqual({ label: 'Reroll · Pro', action: 'use' });
    });

    it('turns into a shop button when the bank is empty', () => {
        expect(powerUpButton('hint', { reason: 'shop', freeLeft: 0 }, 0)).toEqual({ label: 'Get boosts', action: 'shop' });
    });

    it('is disabled with nothing left, and says when a hint is locked', () => {
        expect(powerUpButton('reroll', { reason: 'none', freeLeft: 0 }, 5)).toEqual({ label: 'Reroll · 0 left', action: 'none' });
        expect(powerUpButton('hint', { reason: 'none', freeLeft: 1, locked: true }, 5)).toEqual({ label: 'Hint (locked)', action: 'none' });
    });
});

describe('powerUpNote', () => {
    const spent = { reason: 'none' as const, freeLeft: 0 };
    const free = { reason: 'free' as const, freeLeft: 1 };

    it('explains a spent reroll/hint in the app Daily', () => {
        expect(powerUpNote('daily', true, spent, free)).toMatch(/Boosts can't be used/);
        expect(powerUpNote('daily', true, free, spent)).not.toBeNull();
    });

    it('stays quiet elsewhere, on the website, and for a locked hint', () => {
        expect(powerUpNote('daily', true, free, free)).toBeNull();
        expect(powerUpNote('daily', true, free, { reason: 'none', freeLeft: 1, locked: true })).toBeNull();
        expect(powerUpNote('daily', false, spent, spent)).toBeNull();
        expect(powerUpNote('classic', true, spent, spent)).toBeNull();
    });
});

describe('shop prices', () => {
    const packs = [
        { id: 'xb5', price: 0.99, currencyCode: 'GBP', boosts: 5 },
        { id: 'xb15', price: 2.49, currencyCode: 'GBP', boosts: 15 },
        { id: 'xb40', price: 4.99, currencyCode: 'GBP', boosts: 40 },
    ];

    it('shows the price per boost in the store currency', () => {
        expect(perBoostLabel(packs[0]!, 'en-GB')).toBe('£0.20 each');
        expect(perBoostLabel(packs[2]!, 'en-GB')).toBe('£0.12 each');
        expect(perBoostLabel({ id: 'xb5', price: 0, currencyCode: 'GBP', boosts: 5 }, 'en-GB')).toBe('');
        expect(perBoostLabel({ id: 'xts', price: 0.99, currencyCode: 'GBP' }, 'en-GB')).toBe('');
    });

    it('falls back to a plain number for an unknown currency', () => {
        expect(formatPrice(1.5, 'NOT-A-CODE')).toBe('1.50');
    });

    it('picks the cheapest per boost as best value', () => {
        expect(bestValuePackId(packs)).toBe('xb40');
        expect(bestValuePackId(packs.slice(0, 1))).toBeNull();
    });
});

describe('useShop', () => {
    it('never opens on the website', () => {
        const shop = useShop();

        expect(shop.openShop('settings')).toBe(false);
        expect(shop.open.value).toBe(false);
        expect(trackEvent).not.toHaveBeenCalled();
    });

    it('opens in the app build and logs view_shop once', () => {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true } }));

        const shop = useShop();

        expect(shop.openShop('reroll_button')).toBe(true);
        expect(shop.openShop('reroll_button')).toBe(true);
        expect(shop.open.value).toBe(true);
        expect(trackEvent).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledWith('view_shop', { source: 'reroll_button' });

        shop.closeShop();
        expect(shop.open.value).toBe(false);
    });
});
