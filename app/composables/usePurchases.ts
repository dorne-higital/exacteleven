import { computed, toRaw } from 'vue';
import type { CustomerInfo, MakePurchaseResult, PurchasesStoreProduct } from '@revenuecat/purchases-capacitor';
import { trackEvent } from '../utils/analytics';
import { ALL_PRODUCT_IDS, BOOST_PACKS, ENTITLEMENTS, PRODUCT_IDS, TIP_PRODUCT_IDS, boostPackCount, isTipProduct } from '../utils/appStore';
import type { ProductId } from '../utils/appStore';
import { isAppBuild, isNativeApp } from '../utils/platform';

// In-app purchases (RevenueCat, iPhone only) and the boost bank — a
// useState port of Footballdle's stores/purchases.ts. Everything here is an
// app-build feature: on the website isPro/hasThemes stay false, the bank
// stays 0, buy()/restore() do nothing, and the RevenueCat plugin is never
// imported (it's only ever loaded through getSdk(), behind isNativeApp()).

// Cached so Pro perks / themes still work offline and before RevenueCat answers.
const PRO_CACHE_KEY = 'exact-xi-pro';
const THEMES_CACHE_KEY = 'exact-xi-themes';
// Bought-but-unused boosts. Consumables can't be restored by Apple, so the
// bank lives on the device (and in the iCloud backup).
const BOOST_BANK_KEY = 'exact-xi-boost-bank';
// App Store transactions already turned into banked boosts, so each pack is
// credited exactly once however it arrives (straight away, after Ask to Buy,
// or on a relaunch after the app died mid-purchase).
const BOOST_TRANSACTIONS_KEY = 'exact-xi-boost-transactions';
// Packs credited straight from a purchase because RevenueCat's customer info
// hadn't caught up yet (by product id). That customer info names transactions
// by RevenueCat's own id, not Apple's, so when the transaction turns up later
// it settles one of these instead of being credited a second time.
const BOOST_PREPAID_KEY = 'exact-xi-boost-prepaid';
// RevenueCat's server time when this install started its transaction record.
// Boost transactions bought before it (on an earlier install or another
// device, which RevenueCat can hand to this install on Restore Purchases or
// when it transfers a receipt) are only recorded, never credited again:
// those boosts were credited where they were bought and come back through
// the iCloud bank backup, not a second time here. Per install, not backed up.
const BOOST_SINCE_KEY = 'exact-xi-boost-since';

const STORE_UNREACHABLE = 'Couldn\'t reach the App Store.';
const LOAD_TIMEOUT_MS = 15000;
// RevenueCat PURCHASES_ERROR_CODE values (strings over the Capacitor bridge)
const CANCELLED_CODE = '1';
const PAYMENT_PENDING_CODE = '20';

export type ProductKind = 'pro' | 'boosts' | 'theme' | 'tip';

// What the shop UI renders — prices are the App Store's own localized strings.
export interface ShopProduct {
    id: ProductId;
    kind: ProductKind;
    title: string;
    description: string;
    priceString: string;
    price: number;
    currencyCode: string;
    /** Boost packs only: how many boosts it adds. */
    boosts?: number;
}

export type RestoreResult = 'pro_restored' | 'themes_restored' | 'none' | 'failed';

// How the shop / Settings should style `message`: a failure reads as an amber
// warning, a pending Ask to Buy as a quiet note, anything else as good news.
export type MessageTone = 'success' | 'pending' | 'error';

export function productKind(productId: string): ProductKind {
    if (productId === PRODUCT_IDS.pro) {
        return 'pro';
    }

    if (productId === PRODUCT_IDS.kitBag) {
        return 'theme';
    }

    return isTipProduct(productId) ? 'tip' : 'boosts';
}

// Pure core of the transaction dedupe (exported for tests). `credited` is the
// saved set of already-credited transaction ids, or null on the very first
// run — then everything already there is only recorded, since packs bought
// before this check existed were credited on purchase.
//
// `since` (ISO date, see BOOST_SINCE_KEY) is when this install's record
// began: a transaction with an older purchaseDate is recorded without being
// credited. Null = no cutoff (credit anything new, as before).
export function creditBoostTransactions(
    transactions: Array<{ transactionIdentifier: string; productIdentifier: string; purchaseDate?: string }>,
    credited: Set<string> | null,
    prepaid: string[],
    since: string | null = null,
): { added: number; credited: Set<string>; prepaid: string[]; changed: boolean } {
    const boostTransactions = transactions.filter((t) => boostPackCount(t.productIdentifier) > 0);

    if (!credited) {
        return { added: 0, credited: new Set(boostTransactions.map((t) => t.transactionIdentifier)), prepaid, changed: true };
    }

    const cutoff = since ? Date.parse(since) : Number.NaN;

    const nextCredited = new Set(credited);
    const nextPrepaid = [...prepaid];
    let added = 0;
    let changed = false;

    for (const t of boostTransactions) {
        if (nextCredited.has(t.transactionIdentifier)) {
            continue;
        }

        nextCredited.add(t.transactionIdentifier);
        changed = true;

        const bought = t.purchaseDate ? Date.parse(t.purchaseDate) : Number.NaN;

        if (Number.isFinite(cutoff) && Number.isFinite(bought) && bought < cutoff) {
            continue;
        }

        const early = nextPrepaid.indexOf(t.productIdentifier);

        if (early !== -1) {
            nextPrepaid.splice(early, 1);
        } else {
            added += boostPackCount(t.productIdentifier);
        }
    }

    return { added, credited: nextCredited, prepaid: nextPrepaid, changed };
}

function readFlag(key: string): boolean {
    if (!import.meta.client || !isAppBuild()) {
        return false;
    }

    try {
        return window.localStorage.getItem(key) === '1';
    } catch {
        return false;
    }
}

function writeItem(key: string, value: string): void {
    if (!import.meta.client) {
        return;
    }

    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Private-mode/blocked storage — nothing to do.
    }
}

function readBoostBank(): number {
    if (!import.meta.client || !isAppBuild()) {
        return 0;
    }

    try {
        return Math.max(0, Number.parseInt(window.localStorage.getItem(BOOST_BANK_KEY) || '0', 10) || 0);
    } catch {
        return 0;
    }
}

function readCreditedTransactions(): Set<string> | null {
    try {
        const saved = JSON.parse(window.localStorage.getItem(BOOST_TRANSACTIONS_KEY) || 'null');

        return Array.isArray(saved) ? new Set(saved.map(String)) : null;
    } catch {
        return null;
    }
}

function readSince(): string | null {
    try {
        return window.localStorage.getItem(BOOST_SINCE_KEY);
    } catch {
        return null;
    }
}

function readPrepaid(): string[] {
    try {
        const saved = JSON.parse(window.localStorage.getItem(BOOST_PREPAID_KEY) || '[]');

        return Array.isArray(saved) ? saved.map(String) : [];
    } catch {
        return [];
    }
}

// Read once from the Nuxt context (usePurchases' first call) and kept here:
// a retry from a click handler or after an await runs outside that context,
// where useRuntimeConfig() throws.
let revenuecatAppleKey: string | undefined;

function readApiKey(): string {
    if (revenuecatAppleKey === undefined) {
        try {
            const key = (useRuntimeConfig().public as { revenuecatAppleKey?: string }).revenuecatAppleKey;

            revenuecatAppleKey = typeof key === 'string' ? key : '';
        } catch {
            return '';
        }
    }

    return revenuecatAppleKey;
}

// Wrapped in an object on purpose: a Capacitor plugin is a Proxy that answers
// to any method name, including `then`, so returning it straight from an
// async function makes the promise call Purchases.then() on the native side
// and never settle.
async function getSdk() {
    const { Purchases } = await import('@revenuecat/purchases-capacitor');

    return { Purchases };
}

// Gives up on a call that never answers, so a retry is always possible.
function withTimeout<T>(promise: Promise<T>, what: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`No response while ${what}`)), LOAD_TIMEOUT_MS);

        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

// Shared so a retry while configure is still in flight waits for it rather
// than configuring RevenueCat twice; cleared on failure so the next try
// starts again. Module-level: there's only ever one RevenueCat instance.
let configuring: Promise<void> | null = null;

// Running total of boosts credited from RevenueCat's customer info, so a
// purchase can tell whether its own pack was credited that way (comparing the
// bank instead would be fooled by an iCloud restore landing mid-purchase).
let boostsCreditedFromInfo = 0;

// 'thank you' after a tip — the UI can either watch tipThanks or register here.
const thankYouListeners = new Set<(productId: ProductId) => void>();

export function usePurchases() {
    const products = useState<PurchasesStoreProduct[]>('exact-xi-iap-products', () => []);
    const isPro = useState<boolean>('exact-xi-iap-pro', () => readFlag(PRO_CACHE_KEY));
    const hasThemesEntitlement = useState<boolean>('exact-xi-iap-themes', () => readFlag(THEMES_CACHE_KEY));
    const boostBank = useState<number>('exact-xi-boost-bank', readBoostBank);
    // True while a purchase or restore sheet is up — disable every buy button.
    const purchasing = useState<boolean>('exact-xi-iap-purchasing', () => false);
    const loadingProducts = useState<boolean>('exact-xi-iap-loading', () => false);
    // Why products didn't load, in words a player understands (details go to the console).
    const loadError = useState<string>('exact-xi-iap-load-error', () => '');
    // The last purchase/restore outcome to show in the shop or Settings.
    const message = useState<string>('exact-xi-iap-message', () => '');
    const messageTone = useState<MessageTone>('exact-xi-iap-message-tone', () => 'success');
    // The product waiting on Ask to Buy approval, if any — the shop marks it
    // "Waiting for approval" until a purchase goes through or a new one starts.
    const pendingProductId = useState<ProductId | null>('exact-xi-iap-pending', () => null);
    // Set to the tip's product id after a successful tip (thank-you message only).
    const tipThanks = useState<ProductId | null>('exact-xi-iap-tip-thanks', () => null);

    readApiKey();

    // Purchases exist only inside the native app, with a RevenueCat key set.
    const available = computed(() => isNativeApp() && readApiKey() !== '');
    const hasThemes = computed(() => isPro.value || hasThemesEntitlement.value);

    function toShopProduct(product: PurchasesStoreProduct): ShopProduct {
        const id = product.identifier as ProductId;
        const boosts = boostPackCount(id);

        return {
            id,
            kind: productKind(id),
            title: product.title,
            description: product.description,
            priceString: product.priceString,
            price: product.price,
            currencyCode: product.currencyCode,
            ...(boosts ? { boosts } : {}),
        };
    }

    function findProduct(productId: string): PurchasesStoreProduct | undefined {
        return products.value.find((product) => product.identifier === productId);
    }

    const shopProducts = computed(() => products.value
        .filter((product) => (ALL_PRODUCT_IDS as string[]).includes(product.identifier))
        .map(toShopProduct));
    const proProduct = computed(() => shopProducts.value.find((product) => product.id === PRODUCT_IDS.pro) ?? null);
    const kitBagProduct = computed(() => shopProducts.value.find((product) => product.id === PRODUCT_IDS.kitBag) ?? null);
    const boostProducts = computed(() => BOOST_PACKS
        .map((pack) => shopProducts.value.find((product) => product.id === pack.id))
        .filter((product): product is ShopProduct => !!product));
    const tipProducts = computed(() => TIP_PRODUCT_IDS
        .map((id) => shopProducts.value.find((product) => product.id === id))
        .filter((product): product is ShopProduct => !!product));

    function saveBoostBank(): void {
        writeItem(BOOST_BANK_KEY, String(boostBank.value));
    }

    // Re-reads the bank, Pro and themes from storage (cold start / a backup
    // restore that wrote storage directly).
    function loadLocal(): void {
        boostBank.value = readBoostBank();
        isPro.value = readFlag(PRO_CACHE_KEY);
        hasThemesEntitlement.value = readFlag(THEMES_CACHE_KEY);
    }

    /** Spends one banked boost. False (nothing spent) if the bank is empty or this isn't the app. */
    function spendBoost(): boolean {
        if (!isAppBuild() || boostBank.value <= 0) {
            return false;
        }

        boostBank.value -= 1;
        saveBoostBank();

        return true;
    }

    /** Free boosts (rewards) go into the same bank as bought ones. */
    function grantBoosts(count: number, reason: string): void {
        if (!isAppBuild() || !Number.isFinite(count) || count <= 0) {
            return;
        }

        boostBank.value += Math.floor(count);
        saveBoostBank();
        trackEvent('boost_granted', { grant_reason: reason, count: Math.floor(count) });
    }

    /** A backed-up bank (iCloud) on a fresh install or new phone: never lowers what's here. */
    function restoreBoostBank(count: number): void {
        if (!isAppBuild() || !Number.isFinite(count) || count <= boostBank.value) {
            return;
        }

        boostBank.value = Math.floor(count);
        saveBoostBank();
    }

    /** Banks any boost pack Apple has charged for that hasn't been credited yet. Returns how many boosts were added. */
    function creditBoostPurchases(info: CustomerInfo): number {
        if (!import.meta.client) {
            return 0;
        }

        const before = readCreditedTransactions();
        const since = readSince();
        // The cutoff starts with this install's record. A record without one
        // (restored from iCloud, or saved by an earlier build) gets one now
        // but isn't held to it on this pass, so nothing paid for here is lost.
        const result = creditBoostTransactions(info.nonSubscriptionTransactions ?? [], before, readPrepaid(), before ? since : null);

        if (!since && info.requestDate) {
            writeItem(BOOST_SINCE_KEY, info.requestDate);
        }

        if (result.changed) {
            writeItem(BOOST_TRANSACTIONS_KEY, JSON.stringify([...result.credited]));
            writeItem(BOOST_PREPAID_KEY, JSON.stringify(result.prepaid));
        }

        if (result.added) {
            boostsCreditedFromInfo += result.added;
            boostBank.value += result.added;
            saveBoostBank();
            message.value = result.added === 1 ? 'Boost added.' : `${result.added} boosts added.`;
            messageTone.value = 'success';
        }

        return result.added;
    }

    function applyCustomerInfo(info: CustomerInfo): void {
        isPro.value = !!info.entitlements.active[ENTITLEMENTS.pro];
        hasThemesEntitlement.value = !!info.entitlements.active[ENTITLEMENTS.themes];
        writeItem(PRO_CACHE_KEY, isPro.value ? '1' : '0');
        writeItem(THEMES_CACHE_KEY, hasThemesEntitlement.value ? '1' : '0');

        const added = creditBoostPurchases(info);
        const pending = pendingProductId.value;

        // An Ask to Buy approval arrives here: once what was waiting has
        // landed, the shop stops showing it as pending.
        if (pending && (
            (pending === PRODUCT_IDS.pro && isPro.value)
            || (pending === PRODUCT_IDS.kitBag && hasThemesEntitlement.value)
            || (boostPackCount(pending) > 0 && added > 0)
        )) {
            pendingProductId.value = null;
        }
    }

    function configure(apiKey: string): Promise<void> {
        configuring ??= (async () => {
            const { Purchases } = await getSdk();

            await Purchases.configure({ apiKey });
            await Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
            // Pro status arrives on its own; products don't wait for it.
            Purchases.getCustomerInfo()
                .then(({ customerInfo }) => applyCustomerInfo(customerInfo))
                .catch(() => {});
        })().catch((error) => {
            configuring = null;
            throw error;
        });

        return configuring;
    }

    /** Sets up RevenueCat once, then (re)loads products; safe to call again to retry. */
    async function init(): Promise<void> {
        loadLocal();

        if (!isNativeApp()) {
            return;
        }

        const apiKey = readApiKey();

        if (!apiKey) {
            loadError.value = 'Purchases aren\'t set up in this build.';

            return;
        }

        if (loadingProducts.value) {
            return;
        }

        loadingProducts.value = true;
        loadError.value = '';

        try {
            await withTimeout(configure(apiKey), 'configuring RevenueCat');

            const { Purchases } = await getSdk();
            const result = await withTimeout(Purchases.getProducts({ productIdentifiers: [...ALL_PRODUCT_IDS] }), 'loading products');

            products.value = result.products;

            if (!result.products.some((product) => (ALL_PRODUCT_IDS as string[]).includes(product.identifier))) {
                loadError.value = STORE_UNREACHABLE;
                console.warn('In-app purchases: no known products', result.products.map((product) => product.identifier));
            }
        } catch (error) {
            loadError.value = STORE_UNREACHABLE;
            console.warn('In-app purchases unavailable:', error);
        } finally {
            loadingProducts.value = false;
        }
    }

    async function purchase(product: PurchasesStoreProduct): Promise<MakePurchaseResult | null> {
        if (purchasing.value) {
            return null;
        }

        const productId = product.identifier;
        const analytics = { product_id: productId, product_type: productKind(productId) };

        purchasing.value = true;
        message.value = '';
        messageTone.value = 'success';
        pendingProductId.value = null;
        trackEvent('iap_purchase_start', analytics);

        try {
            const { Purchases } = await getSdk();
            // A plain copy: Vue's reactive Proxy doesn't survive the trip to
            // native code, which then can't recognise the product.
            const plainProduct = JSON.parse(JSON.stringify(toRaw(product))) as PurchasesStoreProduct;
            const result = await Purchases.purchaseStoreProduct({ product: plainProduct });

            applyCustomerInfo(result.customerInfo);
            trackEvent('purchase', {
                ecommerce: {
                    transaction_id: result.transaction?.transactionIdentifier ?? '',
                    value: product.price,
                    currency: product.currencyCode,
                    items: [{ item_id: productId, item_name: product.title, item_category: analytics.product_type, price: product.price, quantity: 1 }],
                },
            });

            return result;
        } catch (error) {
            const err = error as { code?: unknown; userCancelled?: boolean; message?: string; errorMessage?: string } | null;
            const code = err?.code === undefined ? '' : String(err.code);

            if (code === CANCELLED_CODE || err?.userCancelled) {
                trackEvent('iap_purchase_cancelled', analytics);
            } else if (code === PAYMENT_PENDING_CODE) {
                // Ask to Buy (or a bank check): Apple charges later, once
                // it's approved, and the customer info listener credits it then.
                message.value = 'Waiting for approval. It\'ll be added as soon as it\'s approved.';
                messageTone.value = 'pending';
                pendingProductId.value = productId as ProductId;
                trackEvent('iap_purchase_pending', analytics);
            } else {
                const reason = err?.message || err?.errorMessage || '';

                message.value = `Purchase failed${reason ? ` (${reason})` : ''}. Please try again.`;
                messageTone.value = 'error';
                trackEvent('iap_purchase_failed', { ...analytics, error_code: code || 'unknown' });
                console.warn('Purchase failed:', error);
            }

            return null;
        } finally {
            purchasing.value = false;
        }
    }

    async function buyBoosts(product: PurchasesStoreProduct): Promise<boolean> {
        const count = boostPackCount(product.identifier);
        const before = boostsCreditedFromInfo;
        // Without a record yet, the customer info from this purchase only
        // sets one up (with this transaction in it), so there's nothing still
        // to settle later.
        const hadRecord = readCreditedTransactions() !== null;
        const result = await purchase(product);

        if (!result) {
            return false;
        }

        // Normally credited from the customer info that came back with the
        // purchase (inside purchase()). If that hadn't caught up yet, credit
        // it now and remember it was paid ahead, so the transaction showing
        // up later doesn't credit it again.
        if (boostsCreditedFromInfo === before) {
            if (hadRecord) {
                writeItem(BOOST_PREPAID_KEY, JSON.stringify([...readPrepaid(), product.identifier]));
            }

            boostBank.value += count;
            saveBoostBank();
            message.value = `${count} boosts added.`;
        }

        return true;
    }

    /**
     * Buys any product by id. Resolves true once Apple has charged for it
     * (false if cancelled, pending approval, failed, or unavailable — see
     * `message`). Boost packs land in the bank, Pro/Kit Bag flip isPro /
     * hasThemes, and a tip sets tipThanks + calls onThankYou listeners.
     */
    async function buy(productId: ProductId): Promise<boolean> {
        if (!available.value) {
            message.value = 'Purchases are only available in the Exact XI iPhone app.';
            messageTone.value = 'error';

            return false;
        }

        const product = findProduct(productId);

        if (!product) {
            message.value = loadError.value || 'That item is unavailable right now. Please try again later.';
            messageTone.value = 'error';

            return false;
        }

        const kind = productKind(productId);

        if (kind === 'boosts') {
            return buyBoosts(product);
        }

        const ok = !!(await purchase(product));

        if (!ok) {
            return false;
        }

        if (kind === 'pro') {
            // Shown straight away, before RevenueCat's customer info catches up.
            isPro.value = true;
            writeItem(PRO_CACHE_KEY, '1');
            message.value = 'Pro unlocked. Cheers!';
        } else if (kind === 'theme') {
            hasThemesEntitlement.value = true;
            writeItem(THEMES_CACHE_KEY, '1');
            message.value = 'Kit Bag unlocked. Cheers!';
        } else {
            message.value = 'Thanks for the support!';
            tipThanks.value = productId;
            thankYouListeners.forEach((listener) => listener(productId));
        }

        return true;
    }

    /**
     * Restore Purchases (App Review requires it reachable from Settings and
     * the shop). `source` ('settings' | 'shop') goes on the iap_restore event.
     */
    async function restore(source = 'settings'): Promise<RestoreResult> {
        if (!available.value) {
            message.value = 'Purchases are only available in the Exact XI iPhone app.';
            messageTone.value = 'error';

            return 'failed';
        }

        if (purchasing.value) {
            return 'failed';
        }

        purchasing.value = true;
        message.value = '';
        messageTone.value = 'success';

        let result: RestoreResult;

        try {
            const { Purchases } = await getSdk();
            const { customerInfo } = await Purchases.restorePurchases();

            applyCustomerInfo(customerInfo);
            result = isPro.value ? 'pro_restored' : hasThemesEntitlement.value ? 'themes_restored' : 'none';
            message.value = result === 'pro_restored' ? 'Pro restored.' : result === 'themes_restored' ? 'Kit Bag restored.' : 'No previous purchases found.';
        } catch (error) {
            const reason = (error as { message?: string } | null)?.message || '';

            result = 'failed';
            message.value = `Restore failed${reason ? ` (${reason})` : ''}. Please try again.`;
            messageTone.value = 'error';
        } finally {
            purchasing.value = false;
        }

        trackEvent('iap_restore', { result, source });

        return result;
    }

    /** Registers a 'thank you' callback for a successful tip; returns an unsubscribe function. */
    function onThankYou(listener: (productId: ProductId) => void): () => void {
        thankYouListeners.add(listener);

        return () => thankYouListeners.delete(listener);
    }

    function dismissThankYou(): void {
        tipThanks.value = null;
    }

    function clearMessage(): void {
        message.value = '';
        messageTone.value = 'success';
    }

    return {
        // State
        available,
        isPro,
        hasThemes,
        boostBank,
        products: shopProducts,
        proProduct,
        kitBagProduct,
        boostProducts,
        tipProducts,
        purchasing,
        loadingProducts,
        loadError,
        message,
        messageTone,
        pendingProductId,
        tipThanks,

        // Functions
        init,
        loadLocal,
        buy,
        restore,
        spendBoost,
        grantBoosts,
        restoreBoostBank,
        creditBoostPurchases,
        onThankYou,
        dismissThankYou,
        clearMessage,
    };
}
