<script setup lang="ts">
// The desktop/iPad side menu (Footballdle's "Option A · Side menu"). Always
// in the DOM, hidden below 1024px by CSS. 1024-1279px: a compact icon rail
// (icon over a small label). From 1280px: the full 248px rail with labels,
// the wordmark and (web only) the "Exact XI on iPhone" card.
import type { NavItem } from '../../utils/nav';
import { trackEvent } from '../../utils/analytics';
import { APP_STORE_URL } from '../../utils/appStore';
import { activeNavId, NAV_VIEW_EVENT, navItemsFor } from '../../utils/nav';
import { isAppBuild } from '../../utils/platform';
import { resolveDailyDate } from '../../utils/trusted-date';

const route = useRoute();
const isApp = isAppBuild();
const items = navItemsFor(isApp ? 'app' : 'web');
const activeId = computed(() => activeNavId(route.path));

// Streak + boosts come from local storage, so they only show after mount
// (the server render shows a dash, never a mismatched number).
const mounted = ref(false);

onMounted(() => {
    mounted.value = true;
});

const { stats, currentDailyStreak } = useStats();
const { today } = useDaily();
const dailyDate = computed(() => today.value ?? resolveDailyDate(null));
const streak = computed(() => currentDailyStreak(dailyDate.value));
// Today's Daily not played yet: the streak is at risk, so the pill dims.
const streakCold = computed(() => mounted.value && stats.value.lastDailyResultDate !== dailyDate.value);

const { boostBank, isPro } = usePurchases();
const { openShop } = useShop();
// Lets the destination page (e.g. /stats's view_stats_page) know the visit
// came from the rail.
const navSource = useState<string>('exact-xi-nav-source', () => '');

function handleNavClick(item: NavItem): void {
    navSource.value = 'rail';
    trackEvent('rail_nav_click', { item: item.id, from_page: String(route.name ?? route.path) });

    const viewEvent = NAV_VIEW_EVENT[item.id];

    if (viewEvent) {
        trackEvent(viewEvent, { source: 'rail' });
    }
}

function handleStreakClick(): void {
    trackEvent('streak_pill_click', { streak: streak.value });
}

function handleBoostClick(): void {
    openShop('rail');
}

function handleAppCardClick(): void {
    trackEvent('rail_app_card_click', { live: APP_STORE_URL !== null });
}
</script>

<template>
    <aside class="rail">
        <NuxtLink aria-label="Exact XI home" class="rail__brand" to="/">
            <BrandMark :size="32" />
            <span class="rail__name">Exact XI</span>
        </NuxtLink>

        <div class="rail__pills">
            <NuxtLink
                :aria-label="`${mounted ? streak : 0} day Daily streak`"
                class="rail__pill rail__pill--streak"
                :class="{ 'rail__pill--cold': streakCold }"
                to="/daily"
                @click="handleStreakClick"
            >
                <AppIcon name="flame" />
                <span class="rail__pill-value">{{ mounted ? streak : '—' }}</span>
            </NuxtLink>
            <button
                v-if="isApp"
                :aria-label="isPro ? 'Pro: open the shop' : `${boostBank} boosts: open the shop`"
                class="rail__pill rail__pill--boost"
                type="button"
                @click="handleBoostClick"
            >
                <AppIcon name="bolt" />
                <span class="rail__pill-value">{{ !mounted ? '—' : isPro ? 'Pro' : boostBank }}</span>
            </button>
        </div>

        <nav aria-label="Main" class="rail__nav">
            <NuxtLink
                v-for="item in items"
                :key="item.id"
                :aria-current="activeId === item.id ? 'page' : undefined"
                class="rail__link"
                :class="{ 'rail__link--active': activeId === item.id }"
                :to="item.to"
                @click="handleNavClick(item)"
            >
                <AppIcon class="rail__link-icon" :name="item.icon" />
                <span class="rail__link-label">{{ item.label }}</span>
            </NuxtLink>
        </nav>

        <div class="rail__foot">
            <template v-if="!isApp">
                <div class="rail__app">
                    <p class="rail__app-title">
                        <AppIcon name="phone" />
                        Exact XI on iPhone
                    </p>
                    <p class="rail__app-text">Kit Bag themes, boosts, Game Center and iCloud backup.</p>
                    <a
                        v-if="APP_STORE_URL"
                        class="rail__app-link"
                        :href="APP_STORE_URL"
                        rel="noopener noreferrer"
                        target="_blank"
                        @click="handleAppCardClick"
                    >Get the app</a>
                    <p v-else class="rail__app-soon">Coming soon to the App Store</p>
                </div>
                <!-- Compact rail: the card collapses to one phone icon. -->
                <a
                    v-if="APP_STORE_URL"
                    aria-label="Get Exact XI on iPhone"
                    class="rail__app-icon"
                    :href="APP_STORE_URL"
                    rel="noopener noreferrer"
                    target="_blank"
                    title="Exact XI on iPhone"
                    @click="handleAppCardClick"
                >
                    <AppIcon name="phone" />
                </a>
                <span v-else class="rail__app-icon rail__app-icon--soon" title="Exact XI on iPhone: coming soon to the App Store">
                    <AppIcon name="phone" />
                </span>
            </template>

            <NuxtLink class="rail__small" to="/privacy">Privacy</NuxtLink>
        </div>
    </aside>
</template>

<style lang="scss" scoped>
// Bib & Board rail: the page background, a 1px hairline on the right, and
// red only for the active item (the "active state" rule). Tokens only, so
// every Kit Bag theme follows.
.rail {
    display: none;
}

@media (width >= 1024px) {
    .rail {
        align-self: start;
        background-color: var(--color-background);
        border-right: 1px solid var(--color-line);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        height: calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
        height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1.25rem 0.5rem;
        position: sticky;
        top: 0;
    }

    .rail__brand {
        align-items: center;
        align-self: center;
        border-radius: var(--radius-md);
        color: var(--color-foreground);
        display: flex;
        gap: 0.6rem;
        justify-content: center;
        min-height: var(--tap-min);
        min-width: var(--tap-min);
        outline-offset: -2px;
        text-decoration: none;
    }

    .rail__name {
        display: none;
        font-family: var(--font-display);
        font-size: 1.6rem;
        font-weight: 900;
        letter-spacing: 0.02em;
        line-height: 1;
        text-transform: var(--display-text-transform);
    }

    .rail__pills {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .rail__pill {
        align-items: center;
        background-color: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-pill);
        box-sizing: border-box;
        color: var(--color-foreground);
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        gap: 0.35rem;
        justify-content: center;
        min-height: var(--tap-min);
        min-width: var(--tap-min);
        outline-offset: -2px;
        padding: 0 0.6rem;
        text-decoration: none;
        transition: border-color 0.15s ease, opacity 0.15s ease;
    }

    .rail__pill-value {
        font-family: var(--font-mono);
        font-size: 0.85rem;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
    }

    .rail__pill--streak svg {
        color: var(--color-amber);
    }

    .rail__pill--boost svg {
        color: var(--color-primary);
    }

    .rail__pill--cold {
        color: var(--color-muted);
        opacity: 0.7;
    }

    .rail__nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .rail__link {
        align-items: center;
        border-radius: var(--radius-md);
        box-sizing: border-box;
        color: var(--color-muted);
        display: flex;
        flex-direction: column;
        font-size: 0.6875rem;
        font-weight: 600;
        gap: 0.3rem;
        justify-content: center;
        line-height: 1.1;
        min-height: 3.75rem;
        outline-offset: -2px;
        padding: 0.4rem 0.25rem;
        position: relative;
        text-align: center;
        text-decoration: none;
        transition: background-color 0.15s ease, color 0.15s ease;
    }

    .rail__link--active {
        background-color: var(--color-surface-2);
        color: var(--color-foreground);
    }

    .rail__link--active::before {
        background-color: var(--color-bib);
        border-radius: var(--radius-pill);
        content: '';
        inset-block: 0.6rem;
        inset-inline-start: 0;
        position: absolute;
        width: 3px;
    }

    .rail__link--active .rail__link-icon {
        color: var(--color-bib);
    }

    .rail__foot {
        align-items: center;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: auto;
    }

    .rail__app {
        display: none;
    }

    .rail__app-icon {
        align-items: center;
        border-radius: var(--radius-md);
        color: var(--color-muted);
        display: inline-flex;
        justify-content: center;
        min-height: var(--tap-min);
        min-width: var(--tap-min);
        outline-offset: -2px;
    }

    .rail__app-icon--soon {
        opacity: 0.7;
    }

    .rail__small {
        align-items: center;
        border-radius: var(--radius-sm);
        color: var(--color-muted);
        display: inline-flex;
        font-size: 0.8rem;
        min-height: var(--tap-min);
        outline-offset: -2px;
        padding: 0 0.5rem;
        text-decoration: none;
    }
}

@media (width >= 1280px) {
    .rail {
        gap: 1.5rem;
        padding: 1.5rem 0.75rem;
    }

    .rail__brand {
        align-self: stretch;
        justify-content: flex-start;
        padding: 0 0.5rem;
    }

    .rail__name {
        display: inline;
    }

    .rail__pills {
        flex-direction: row;
        padding: 0 0.4rem;
    }

    .rail__pill {
        padding: 0 0.85rem;
    }

    .rail__link {
        flex-direction: row;
        font-size: 0.95rem;
        gap: 0.75rem;
        justify-content: flex-start;
        min-height: var(--tap-min);
        padding: 0 0.9rem;
        text-align: start;
    }

    .rail__foot {
        align-items: stretch;
    }

    .rail__app {
        background-color: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-card);
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 1rem;
    }

    .rail__app p {
        margin: 0;
    }

    .rail__app-title {
        align-items: center;
        color: var(--color-foreground);
        display: flex;
        font-size: 0.9rem;
        font-weight: 700;
        gap: 0.5rem;
    }

    .rail__app-title svg {
        color: var(--color-primary);
    }

    .rail__app-text {
        color: var(--color-muted);
        font-size: 0.82rem;
        line-height: 1.45;
    }

    .rail__app-link,
    .rail__app-soon {
        color: var(--color-primary);
        font-size: 0.82rem;
        font-weight: 700;
    }

    .rail__app-link {
        align-items: center;
        display: inline-flex;
        min-height: var(--tap-min);
    }

    .rail__app-icon {
        display: none;
    }

    .rail__small {
        align-self: flex-start;
    }
}

@media (width >= 1024px) and (hover: hover) and (pointer: fine) {
    .rail__link:hover:not(.rail__link--active) {
        background-color: var(--color-surface);
        color: var(--color-foreground);
    }

    .rail__pill:hover,
    .rail__app-icon:hover,
    .rail__small:hover {
        border-color: var(--color-primary);
        color: var(--color-foreground);
    }
}

@media (prefers-reduced-motion: reduce) {
    .rail__link,
    .rail__pill {
        transition: none;
    }
}
</style>
