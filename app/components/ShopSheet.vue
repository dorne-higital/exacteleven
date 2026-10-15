<script setup lang="ts">
import { PRODUCT_IDS } from '../utils/appStore';
import type { ProductId } from '../utils/appStore';
import { trackEvent } from '../utils/analytics';
import { bestValuePackId, perBoostLabel } from '../utils/shop';
import { KITS } from '../utils/themes';

// The app's shop (iOS app only — app.vue mounts it in the app build, and
// useShop().openShop() is a no-op on the website). Pro first, then boost
// packs, the Kit Bag, and a small tip jar; Restore Purchases at the foot, as
// App Review requires. Prices are the App Store's own localized strings.
// Every purchase goes through usePurchases().buy(), which fires the iap_*
// events; this file adds the shop's own (pro_upsell_view, iap_retry).
const { open, source } = useShop();
const purchases = usePurchases();
const {
    available,
    isPro,
    hasThemes,
    boostBank,
    products,
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
} = purchases;

const PRO_PERKS = [
    'Unlimited boosts in Classic and Challenge games',
    'An extra free reroll in every Classic game',
    'Every Kit Bag theme',
    'A Pro badge in your stats',
];

// The four paid kits, for the Kit Bag card's swatch strip.
const paidKits = KITS.filter((kit) => !kit.free);

const TIP_LABELS: Partial<Record<ProductId, string>> = {
    [PRODUCT_IDS.tipSmall]: 'Half-time tea',
    [PRODUCT_IDS.tipMedium]: 'Matchday pie',
    [PRODUCT_IDS.tipLarge]: 'Season ticket',
};

// The store answered with at least one product we sell.
const storeReady = computed(() => products.value.length > 0);

// What to say when there's nothing to buy yet: still loading, or why not.
const storeNotice = computed(() => {
    if (storeReady.value) {
        return null;
    }

    if (loadingProducts.value) {
        return { tone: 'pending', text: 'Getting prices from the App Store…', retry: false };
    }

    return {
        tone: 'error',
        text: loadError.value || 'Couldn\'t reach the App Store.',
        // Without the native shell (or a RevenueCat key) a retry can't help.
        retry: available.value,
    };
});

const bestValueId = computed(() => bestValuePackId(boostProducts.value));

const kitBagState = computed(() => {
    if (isPro.value) {
        return 'pro';
    }

    return hasThemes.value ? 'owned' : 'locked';
});

function priceOf(id: ProductId): string {
    return products.value.find((product) => product.id === id)?.priceString ?? '';
}

function buy(id: ProductId): void {
    void purchases.buy(id);
}

function retry(): void {
    trackEvent('iap_retry', { source: 'shop' });
    void purchases.init();
}

function restore(): void {
    void purchases.restore('shop');
}

function openSettings(): void {
    trackEvent('view_settings', { source: 'shop' });
    open.value = false;
}

// A fresh look each time: drop the last purchase/restore message, and log
// the Pro pitch when it's actually on screen to someone without Pro.
watch(open, (isOpen) => {
    if (!isOpen) {
        return;
    }

    purchases.clearMessage();

    if (!isPro.value) {
        trackEvent('pro_upsell_view', { source: source.value || 'shop' });
    }

    // A failed load at launch (offline then) gets another go on opening.
    if (!storeReady.value && !loadingProducts.value && available.value) {
        void purchases.init();
    }
});

// The tip thank-you toast clears itself after a few seconds.
let thanksTimer: ReturnType<typeof setTimeout> | null = null;

watch(tipThanks, (tip) => {
    if (thanksTimer) {
        clearTimeout(thanksTimer);
        thanksTimer = null;
    }

    if (tip) {
        thanksTimer = setTimeout(() => purchases.dismissThankYou(), 6000);
    }
});

onUnmounted(() => {
    if (thanksTimer) {
        clearTimeout(thanksTimer);
    }
});
</script>

<template>
    <CenteredDialog v-model:open="open" size="lg" title="Shop">
        <div class="shop">
            <p v-if="tipThanks" class="shop__thanks" role="status">
                <span class="shop__thanks-title">Cheers!</span>
                Thanks for the tip — it genuinely keeps Exact XI going.
                <button aria-label="Dismiss" class="shop__thanks-close" type="button" @click="purchases.dismissThankYou()">
                    <AppIcon name="close" />
                </button>
            </p>

            <p
                v-if="message"
                aria-live="polite"
                class="shop__message"
                :class="`shop__message--${messageTone}`"
            >
                {{ message }}
            </p>

            <div
                v-if="storeNotice"
                aria-live="polite"
                class="shop__notice"
                :class="`shop__notice--${storeNotice.tone}`"
            >
                <span>{{ storeNotice.text }}</span>
                <button v-if="storeNotice.retry" class="shop__text-button" type="button" @click="retry">Try again</button>
            </div>

            <!-- Pro: the one red call to action on this screen -->
            <section aria-labelledby="shop-pro" class="shop__card shop__card--pro">
                <div class="shop__card-head">
                    <h3 id="shop-pro" class="shop__card-title">Exact XI Pro</h3>
                    <span v-if="isPro" class="shop__owned"><AppIcon name="check" /> Active</span>
                    <span v-else-if="proProduct" class="shop__price">{{ proProduct.priceString }}</span>
                </div>
                <ul class="shop__perks">
                    <li v-for="perk in PRO_PERKS" :key="perk">{{ perk }}</li>
                </ul>
                <p class="shop__fine">The Daily stays the same for everyone: Pro and boosts don't apply there.</p>
                <p v-if="isPro" class="shop__fine shop__fine--strong">You've got Pro — thanks for backing Exact XI.</p>
                <template v-else>
                    <p v-if="pendingProductId === PRODUCT_IDS.pro" class="shop__pending">Waiting for approval</p>
                    <button
                        class="shop__cta"
                        :disabled="!proProduct || purchasing"
                        type="button"
                        @click="buy(PRODUCT_IDS.pro)"
                    >
                        {{ proProduct ? `Get Pro · ${proProduct.priceString}` : 'Get Pro' }}
                    </button>
                </template>
            </section>

            <!-- Boosts -->
            <section aria-labelledby="shop-boosts" class="shop__card">
                <div class="shop__card-head">
                    <h3 id="shop-boosts" class="shop__card-title">Boosts</h3>
                    <span class="shop__bank">
                        <AppIcon name="bolt" />
                        <template v-if="isPro">Unlimited with Pro</template>
                        <template v-else>{{ boostBank }} banked</template>
                    </span>
                </div>
                <p v-if="isPro" class="shop__intro">
                    Pro gives you unlimited rerolls and hints in Classic and Challenge, so there's no need to buy boosts.
                </p>
                <p v-else class="shop__intro">
                    One boost is one more reroll or hint once a game's free one is used. Classic and Challenge only — never the Daily.
                </p>
                <!-- Hidden for Pro: boosts only work where Pro is already unlimited, so a pack would buy nothing. -->
                <div v-if="storeReady && !isPro" class="shop__packs">
                    <button
                        v-for="pack in boostProducts"
                        :key="pack.id"
                        class="shop__pack"
                        :disabled="purchasing"
                        type="button"
                        @click="buy(pack.id)"
                    >
                        <span v-if="pack.id === bestValueId" class="shop__tag">Best value</span>
                        <span class="shop__pack-count">+{{ pack.boosts }}</span>
                        <span class="shop__pack-label">boosts</span>
                        <span class="shop__pack-price">{{ pack.priceString }}</span>
                        <span class="shop__pack-each">{{ pendingProductId === pack.id ? 'Waiting for approval' : perBoostLabel(pack) }}</span>
                    </button>
                </div>
            </section>

            <!-- Kit Bag -->
            <section aria-labelledby="shop-kit" class="shop__card">
                <div class="shop__card-head">
                    <h3 id="shop-kit" class="shop__card-title">Kit Bag</h3>
                    <span v-if="kitBagState === 'pro'" class="shop__owned"><AppIcon name="check" /> Included with Pro</span>
                    <span v-else-if="kitBagState === 'owned'" class="shop__owned"><AppIcon name="check" /> Unlocked</span>
                    <span v-else-if="kitBagProduct" class="shop__price">{{ kitBagProduct.priceString }}</span>
                </div>
                <p class="shop__intro">{{ paidKits.length }} extra themes for the whole app, from Floodlights to Winter Fixture.</p>
                <ul aria-hidden="true" class="shop__swatches">
                    <li v-for="kit in paidKits" :key="kit.id" class="shop__swatch" :title="kit.name">
                        <span :style="{ backgroundColor: kit.swatch.background }" />
                        <span :style="{ backgroundColor: kit.swatch.pitch }" />
                        <span :style="{ backgroundColor: kit.swatch.accent }" />
                    </li>
                </ul>
                <NuxtLink v-if="kitBagState !== 'locked'" class="shop__secondary" to="/settings" @click="openSettings">
                    Choose a theme
                </NuxtLink>
                <template v-else>
                    <p v-if="pendingProductId === PRODUCT_IDS.kitBag" class="shop__pending">Waiting for approval</p>
                    <button
                        class="shop__secondary"
                        :disabled="!kitBagProduct || purchasing"
                        type="button"
                        @click="buy(PRODUCT_IDS.kitBag)"
                    >
                        {{ kitBagProduct ? `Get Kit Bag · ${kitBagProduct.priceString}` : 'Get Kit Bag' }}
                    </button>
                </template>
            </section>

            <!-- Tip jar: a thank-you only, no gameplay -->
            <section aria-labelledby="shop-tips" class="shop__card shop__card--quiet">
                <h3 id="shop-tips" class="shop__card-title">Tip jar</h3>
                <p class="shop__intro">Enjoying Exact XI? A tip says thanks. It doesn't unlock anything.</p>
                <div v-if="storeReady" class="shop__tips">
                    <button
                        v-for="tip in tipProducts"
                        :key="tip.id"
                        class="shop__tip"
                        :disabled="purchasing"
                        type="button"
                        @click="buy(tip.id)"
                    >
                        <span>{{ TIP_LABELS[tip.id] ?? tip.title }}</span>
                        <span class="shop__tip-price">{{ priceOf(tip.id) }}</span>
                    </button>
                </div>
            </section>

            <div class="shop__foot">
                <button class="shop__text-button" :disabled="purchasing" type="button" @click="restore">Restore purchases</button>
                <p class="shop__fine">Payment is charged to your Apple ID. Boosts and tips are one-off purchases.</p>
            </div>
        </div>
    </CenteredDialog>
</template>

<style lang="scss" scoped>
// Bib & Board shop: flat surface cards with hairlines. Red appears once —
// the Pro call to action (the screen's main CTA). Other buys are quiet
// pitch-green buttons; errors are amber, never red.
.shop {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
}

// Desktop / iPad (the dialog is 46rem wide here): Pro on the left at full
// height; boosts, Kit Bag and the tip jar on the right; notices and Restore
// Purchases span both columns.
@media (width >= 1024px) {
    .shop {
        align-items: start;
        display: grid;
        gap: 1rem;
        grid-auto-flow: row dense;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .shop > * {
        grid-column: 1 / -1;
    }

    .shop > .shop__card {
        grid-column: 2;
    }

    .shop > .shop__card--pro {
        align-self: stretch;
        grid-column: 1;
        grid-row: span 3;
    }
}

.shop__card {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
}

.shop__card--pro {
    border-color: color-mix(in srgb, var(--color-bib) 45%, var(--color-line));
    box-shadow: inset 0 3px 0 var(--color-bib);
}

.shop__card--quiet {
    background-color: var(--color-surface-2);
    border-color: transparent;
}

.shop__card-head {
    align-items: baseline;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
}

.shop__card-title {
    font-size: 1.35rem;
    margin: 0;
}

.shop__price {
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.shop__owned,
.shop__bank {
    align-items: center;
    color: var(--color-primary);
    display: inline-flex;
    font-size: 0.78rem;
    font-weight: 700;
    gap: 0.25rem;
    white-space: nowrap;
}

.shop__bank {
    color: var(--color-foreground);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
}

.shop__perks {
    display: flex;
    flex-direction: column;
    font-size: 0.875rem;
    gap: 0.3rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.shop__perks li {
    padding-left: 1.2rem;
    position: relative;
}

.shop__perks li::before {
    background-color: var(--color-bib);
    border-radius: 2px;
    content: '';
    height: 0.45rem;
    left: 0.2rem;
    position: absolute;
    top: 0.45em;
    width: 0.45rem;
}

.shop__intro,
.shop__fine {
    color: var(--color-muted);
    font-size: 0.8rem;
    line-height: 1.45;
    margin: 0;
}

.shop__fine--strong {
    color: var(--color-foreground);
    font-weight: 600;
}

.shop__cta,
.shop__secondary {
    align-items: center;
    border-radius: var(--radius-stub);
    box-sizing: border-box;
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    justify-content: center;
    min-height: var(--tap-min);
    padding: 0.6rem 1rem;
    text-decoration: none;
    width: 100%;
}

.shop__cta {
    background-color: var(--color-bib);
    border: 1px solid var(--color-bib);
    color: var(--color-on-bib);
}

.shop__secondary {
    background-color: var(--color-surface);
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
}

.shop__cta:disabled,
.shop__secondary:disabled,
.shop__pack:disabled,
.shop__tip:disabled,
.shop__text-button:disabled {
    cursor: default;
    opacity: 0.5;
}

.shop__pending {
    color: var(--color-muted);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
}

.shop__packs {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(3, 1fr);
}

.shop__pack {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: 0.1rem;
    min-height: 6.5rem;
    padding: 1.1rem 0.4rem 0.6rem;
    position: relative;
}

.shop__pack:not(:disabled):hover,
.shop__pack:focus-visible,
.shop__tip:not(:disabled):hover,
.shop__tip:focus-visible {
    border-color: var(--color-primary);
}

.shop__tag {
    background-color: var(--color-primary);
    border-radius: var(--radius-pill);
    color: var(--color-on-primary);
    font-size: 0.6rem;
    font-weight: 700;
    left: 50%;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.45rem;
    position: absolute;
    text-transform: uppercase;
    top: -0.55rem;
    transform: translateX(-50%);
    white-space: nowrap;
}

.shop__pack-count {
    font-family: var(--font-display);
    font-size: 1.9rem;
    font-weight: 900;
    line-height: 1;
}

.shop__pack-label {
    color: var(--color-muted);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.shop__pack-price {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    margin-top: 0.3rem;
}

.shop__pack-each {
    color: var(--color-muted);
    font-size: 0.68rem;
    text-align: center;
}

.shop__swatches {
    display: flex;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.shop__swatch {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    display: flex;
    flex: 1 1 0;
    height: 1.6rem;
    overflow: hidden;
}

.shop__swatch span {
    flex: 1 1 0;
}

.shop__tips {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.shop__tip {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    justify-content: space-between;
    min-height: var(--tap-min);
    padding: 0 0.9rem;
}

.shop__tip-price {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
}

.shop__foot {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
}

.shop__text-button {
    background: none;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--color-primary);
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    min-height: var(--tap-min);
    padding: 0 0.75rem;
    text-decoration: underline;
    text-underline-offset: 0.2em;
}

.shop__notice,
.shop__message {
    align-items: center;
    border-radius: var(--radius-md);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.85rem;
    font-weight: 600;
    gap: 0 0.5rem;
    justify-content: space-between;
    margin: 0;
    padding: 0.6rem 0.75rem;
}

.shop__notice--pending,
.shop__message--pending,
.shop__message--success {
    background-color: var(--color-surface-2);
}

.shop__message--success {
    border-left: 3px solid var(--color-primary);
}

.shop__notice--error,
.shop__message--error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
}

.shop__notice .shop__text-button {
    min-height: 2.25rem;
    padding: 0;
}

// The tip thank-you: an exact-win style red moment, small and brief.
.shop__thanks {
    background-color: color-mix(in srgb, var(--color-bib) 10%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-bib) 45%, transparent);
    border-radius: var(--radius-md);
    font-size: 0.875rem;
    margin: 0;
    padding: 0.7rem 3rem 0.7rem 0.85rem;
    position: relative;
}

.shop__thanks-title {
    color: var(--color-bib);
    display: block;
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 900;
    text-transform: var(--display-text-transform);
}

.shop__thanks-close {
    align-items: center;
    background: none;
    border: 0;
    color: var(--color-muted);
    cursor: pointer;
    display: flex;
    height: var(--tap-min);
    justify-content: center;
    position: absolute;
    right: 0;
    top: 0;
    width: var(--tap-min);
}
</style>
