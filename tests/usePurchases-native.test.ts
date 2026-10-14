import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRODUCT_IDS } from '../app/utils/appStore';

// usePurchases inside a (pretend) native shell, with RevenueCat mocked: the
// shop's Ask to Buy "pending" state, the amber failure tone, and the restore
// event's source. The real plugin is never loaded. import.meta.client is
// unset under vitest, so the native check and trackEvent are mocked too.
const { getProducts, purchaseStoreProduct, restorePurchases, trackEvent } = vi.hoisted(() => ({
    getProducts: vi.fn(),
    purchaseStoreProduct: vi.fn(),
    restorePurchases: vi.fn(),
    trackEvent: vi.fn(),
}));

vi.mock('../app/utils/analytics', () => ({ trackEvent }));
vi.mock('../app/utils/platform', () => ({ isAppBuild: () => true, isNativeApp: () => true }));

vi.mock('@revenuecat/purchases-capacitor', () => ({
    Purchases: {
        configure: vi.fn(() => Promise.resolve()),
        addCustomerInfoUpdateListener: vi.fn(() => Promise.resolve('listener')),
        getCustomerInfo: vi.fn(() => new Promise(() => {})),
        getProducts,
        purchaseStoreProduct,
        restorePurchases,
    },
}));

const { usePurchases } = await import('../app/composables/usePurchases');

const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

function storeProduct(identifier: string, price = 0.99) {
    return { identifier, title: identifier, description: '', priceString: `£${price}`, price, currencyCode: 'GBP' };
}

function customerInfo(active: Record<string, unknown> = {}) {
    return { entitlements: { active }, nonSubscriptionTransactions: [] };
}

beforeEach(() => {
    stateStore.clear();
    trackEvent.mockClear();
    vi.stubGlobal('useState', fakeUseState);
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true, revenuecatAppleKey: 'appl_test' } }));
    getProducts.mockResolvedValue({ products: [storeProduct('xpro', 9.99), storeProduct('xb5'), storeProduct('xkit', 1.99)] });
    purchaseStoreProduct.mockReset();
    restorePurchases.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

async function ready() {
    const purchases = usePurchases();

    await purchases.init();
    expect(purchases.products.value.length).toBe(3);

    return purchases;
}

describe('usePurchases in the app', () => {
    it('marks an Ask to Buy purchase as pending until it is approved', async () => {
        const purchases = await ready();

        purchaseStoreProduct.mockRejectedValueOnce({ code: '20', message: 'Pending' });

        expect(await purchases.buy(PRODUCT_IDS.kitBag)).toBe(false);
        expect(purchases.pendingProductId.value).toBe(PRODUCT_IDS.kitBag);
        expect(purchases.messageTone.value).toBe('pending');
        expect(trackEvent).toHaveBeenCalledWith('iap_purchase_pending', { product_id: 'xkit', product_type: 'theme' });

        // Approved later: the restored entitlement clears the pending mark.
        restorePurchases.mockResolvedValueOnce({ customerInfo: customerInfo({ themes: {} }) });
        expect(await purchases.restore('shop')).toBe('themes_restored');
        expect(purchases.pendingProductId.value).toBeNull();
    });

    it('shows a failure in the warning tone and logs the code', async () => {
        const purchases = await ready();

        purchaseStoreProduct.mockRejectedValueOnce({ code: '2', message: 'Store problem' });

        expect(await purchases.buy(PRODUCT_IDS.pro)).toBe(false);
        expect(purchases.messageTone.value).toBe('error');
        expect(purchases.message.value).toMatch(/Purchase failed/);
        expect(trackEvent).toHaveBeenCalledWith('iap_purchase_failed', { product_id: 'xpro', product_type: 'pro', error_code: '2' });

        purchases.clearMessage();
        expect(purchases.message.value).toBe('');
        expect(purchases.messageTone.value).toBe('success');
    });

    it('a cancel says nothing', async () => {
        const purchases = await ready();

        purchaseStoreProduct.mockRejectedValueOnce({ code: '1', userCancelled: true });

        expect(await purchases.buy(PRODUCT_IDS.pro)).toBe(false);
        expect(purchases.message.value).toBe('');
        expect(purchases.pendingProductId.value).toBeNull();
    });

    it('puts where Restore was tapped on iap_restore', async () => {
        const purchases = await ready();

        restorePurchases.mockResolvedValueOnce({ customerInfo: customerInfo() });

        expect(await purchases.restore('settings')).toBe('none');
        expect(trackEvent).toHaveBeenCalledWith('iap_restore', { result: 'none', source: 'settings' });
    });
});
