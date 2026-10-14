import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { creditBoostTransactions, productKind, usePurchases } from '../app/composables/usePurchases';
import { ALL_PRODUCT_IDS, BOOST_PACKS, LEADERBOARD_IDS, PRODUCT_IDS, boostPackCount } from '../app/utils/appStore';

// Same fakeUseState stubbing as useGame.test.ts. The native shell is never
// present under vitest, so these cover the website behaviour (everything
// off) and the pure crediting logic; RevenueCat itself is never imported.
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

beforeEach(() => {
    stateStore.clear();
    vi.stubGlobal('useState', fakeUseState);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function tx(id: string, product: string) {
    return { transactionIdentifier: id, productIdentifier: product };
}

describe('appStore ids', () => {
    it('uses the fixed App Store Connect ids', () => {
        expect(ALL_PRODUCT_IDS.sort()).toEqual(['xb15', 'xb40', 'xb5', 'xkit', 'xpro', 'xtl', 'xtm', 'xts']);
        expect(BOOST_PACKS.map((pack) => [pack.id, pack.count])).toEqual([['xb5', 5], ['xb15', 15], ['xb40', 40]]);
        expect(Object.values(LEADERBOARD_IDS)).toEqual(['exactxi.daily.best_streak', 'exactxi.classic.exact_wins', 'exactxi.classic.best_run']);
    });

    it('classifies products', () => {
        expect(productKind(PRODUCT_IDS.pro)).toBe('pro');
        expect(productKind(PRODUCT_IDS.kitBag)).toBe('theme');
        expect(productKind(PRODUCT_IDS.boosts15)).toBe('boosts');
        expect(productKind(PRODUCT_IDS.tipMedium)).toBe('tip');
        expect(boostPackCount(PRODUCT_IDS.tipSmall)).toBe(0);
    });
});

describe('creditBoostTransactions', () => {
    it('only records what is already there on the very first run', () => {
        const result = creditBoostTransactions([tx('t1', 'xb5'), tx('t2', 'xpro')], null, []);

        expect(result.added).toBe(0);
        expect([...result.credited]).toEqual(['t1']);
    });

    it('credits each new boost transaction exactly once', () => {
        const first = creditBoostTransactions([tx('t1', 'xb5'), tx('t2', 'xb40'), tx('t3', 'xts')], new Set(), []);

        expect(first.added).toBe(45);

        const again = creditBoostTransactions([tx('t1', 'xb5'), tx('t2', 'xb40')], first.credited, first.prepaid);

        expect(again.added).toBe(0);
        expect(again.changed).toBe(false);
    });

    it('settles a prepaid pack instead of crediting it twice', () => {
        const result = creditBoostTransactions([tx('t9', 'xb15'), tx('t10', 'xb15')], new Set(), ['xb15']);

        expect(result.added).toBe(15);
        expect(result.prepaid).toEqual([]);
    });
});

describe('creditBoostTransactions — purchase-date cutoff', () => {
    const since = '2026-10-01T12:00:00Z';

    function dated(id: string, product: string, purchaseDate: string) {
        return { ...tx(id, product), purchaseDate };
    }

    it('records, but never credits, packs bought before this install began its record', () => {
        // e.g. RevenueCat handing this install an older install's history on
        // Restore Purchases, or when it transfers the receipt on a new purchase.
        const result = creditBoostTransactions([
            dated('old1', 'xb40', '2026-09-01T09:00:00Z'),
            dated('old2', 'xb5', '2026-09-30T23:59:59Z'),
            dated('new1', 'xb15', '2026-10-02T08:00:00Z'),
        ], new Set(), [], since);

        expect(result.added).toBe(15);
        expect([...result.credited].sort()).toEqual(['new1', 'old1', 'old2']);
    });

    it('does not let an old pack settle a prepaid entry meant for a new one', () => {
        const result = creditBoostTransactions([
            dated('old', 'xb5', '2026-09-01T09:00:00Z'),
            dated('new', 'xb5', '2026-10-03T09:00:00Z'),
        ], new Set(), ['xb5'], since);

        expect(result.added).toBe(0);
        expect(result.prepaid).toEqual([]);
    });

    it('credits as before when there is no cutoff or no purchase date', () => {
        expect(creditBoostTransactions([dated('t1', 'xb5', '2020-01-01T00:00:00Z')], new Set(), [], null).added).toBe(5);
        expect(creditBoostTransactions([tx('t2', 'xb5')], new Set(), [], since).added).toBe(5);
    });
});

describe('usePurchases — website', () => {
    it('reports everything as unavailable and never spends or grants', async () => {
        const purchases = usePurchases();

        expect(purchases.available.value).toBe(false);
        expect(purchases.isPro.value).toBe(false);
        expect(purchases.hasThemes.value).toBe(false);
        expect(purchases.boostBank.value).toBe(0);
        expect(purchases.spendBoost()).toBe(false);

        purchases.grantBoosts(3, 'welcome');
        purchases.restoreBoostBank(10);
        expect(purchases.boostBank.value).toBe(0);

        expect(await purchases.buy(PRODUCT_IDS.pro)).toBe(false);
        expect(await purchases.restore()).toBe('failed');
        expect(purchases.message.value).toMatch(/iPhone app/);
    });
});

describe('usePurchases — app bank', () => {
    it('spends, grants and restores (never lowering) the bank', () => {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true } }));
        const purchases = usePurchases();

        purchases.grantBoosts(3, 'welcome');
        expect(purchases.boostBank.value).toBe(3);
        expect(purchases.spendBoost()).toBe(true);
        expect(purchases.boostBank.value).toBe(2);

        purchases.restoreBoostBank(1);
        expect(purchases.boostBank.value).toBe(2);
        purchases.restoreBoostBank(8);
        expect(purchases.boostBank.value).toBe(8);
    });

    it('treats Pro as including the Kit Bag themes', () => {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true } }));
        const purchases = usePurchases();

        purchases.isPro.value = true;
        expect(purchases.hasThemes.value).toBe(true);
    });
});
