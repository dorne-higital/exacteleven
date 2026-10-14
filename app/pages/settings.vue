<script setup lang="ts">
import { App } from '@capacitor/app';
import { PRODUCT_IDS } from '../utils/appStore';
import { trackEvent } from '../utils/analytics';
import { isAvailable as gameCenterAvailable, showLeaderboards } from '../utils/game-center';
import { hapticsEnabled, setHapticsEnabled } from '../utils/haptics';
import { isAppBuild, isNativeApp } from '../utils/platform';
import { APPEARANCES } from '../utils/themes';
import type { Appearance, KitId, KitModes } from '../utils/themes';

// Settings, reached from the gear in AppHeader on every page. The website
// shows only what works there (Appearance, About); the app adds the Kit Bag
// themes, purchases (Pro, boosts, shop, Restore Purchases — App Review wants
// Restore reachable from here), Game Center and Haptics.
const isApp = isAppBuild();

const { appearance, kit, availableKits, setAppearance, setKit } = useTheme();
const purchases = usePurchases();
const { isPro, hasThemes, boostBank, kitBagProduct, purchasing, message, messageTone } = purchases;
const { openShop } = useShop();

const APPEARANCE_LABELS: Record<Appearance, string> = { system: 'System', light: 'Light', dark: 'Dark' };

const MODE_NOTES: Record<KitModes, string | null> = { both: null, dark: 'Always dark', light: 'Always light' };

function chooseAppearance(value: Appearance): void {
    setAppearance(value, 'settings');
}

// Arrow keys move between the segmented control's options, like native radios.
function handleAppearanceKey(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;

    if (!step) {
        return;
    }

    event.preventDefault();

    const index = APPEARANCES.indexOf(appearance.value);
    const next = APPEARANCES[(index + step + APPEARANCES.length) % APPEARANCES.length]!;

    chooseAppearance(next);
    (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-appearance='${next}']`)?.focus();
}

function chooseKit(id: KitId): void {
    // setKit logs kit_changed / kit_locked itself; a locked kit opens the shop.
    if (!setKit(id, 'settings')) {
        openShop('settings_kit');
    }
}

function getKitBag(): void {
    if (kitBagProduct.value) {
        void purchases.buy(PRODUCT_IDS.kitBag);
    } else {
        openShop('settings_kit');
    }
}

function openShopFromSettings(): void {
    openShop('settings');
}

function restore(): void {
    void purchases.restore('settings');
}

function openLeaderboards(): void {
    void showLeaderboards();
}

// Read after mount: the setting lives in localStorage, and Haptics is an
// app-only row, so there's no server render to disagree with.
const haptics = ref(true);

function toggleHaptics(): void {
    haptics.value = !haptics.value;
    setHapticsEnabled(haptics.value);
    trackEvent('settings_haptics_changed', { enabled: haptics.value });
}

function selectPrivacy(): void {
    trackEvent('view_privacy', { source: 'settings' });
}

function selectHowToPlay(): void {
    trackEvent('view_how_to_play', { source: 'settings' });
}

// "1.0 (12)" from the installed app; nothing on the website.
const version = ref('');
// Only the native iOS shell has Game Center; a browser preview of the app
// build says so rather than showing a button that can't work.
const canUseGameCenter = ref(false);

onMounted(() => {
    haptics.value = hapticsEnabled();
    canUseGameCenter.value = gameCenterAvailable();
    // A message left over from the shop belongs to the shop.
    purchases.clearMessage();

    if (isNativeApp()) {
        // getInfo() resolves plain data; it's the plugin proxy itself that
        // must never be awaited.
        App.getInfo()
            .then((info) => {
                version.value = `${info.version} (${info.build})`;
            })
            .catch(() => {});
    }
});

usePageSeoMeta({
    title: 'Settings — Exact XI',
    description: 'Choose light or dark mode for Exact XI.',
});

useSeoMeta({ robots: 'noindex, follow' });
</script>

<template>
    <main class="settings">
        <AppHeader>
            <NuxtLink class="app-header-back settings__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
        </AppHeader>

        <div class="settings__inner">
            <h1>Settings</h1>

            <section aria-labelledby="settings-appearance" class="settings__card">
                <h2 id="settings-appearance">Appearance</h2>
                <div
                    aria-labelledby="settings-appearance"
                    class="settings__segmented"
                    role="radiogroup"
                    @keydown="handleAppearanceKey"
                >
                    <button
                        v-for="option in APPEARANCES"
                        :key="option"
                        :aria-checked="appearance === option"
                        class="settings__segment"
                        :class="{ 'settings__segment--active': appearance === option }"
                        :data-appearance="option"
                        role="radio"
                        :tabindex="appearance === option ? 0 : -1"
                        type="button"
                        @click="chooseAppearance(option)"
                    >
                        {{ APPEARANCE_LABELS[option] }}
                    </button>
                </div>
                <p class="settings__hint">System follows your device's light or dark setting.</p>
            </section>

            <section v-if="isApp" aria-labelledby="settings-kit" class="settings__card">
                <div class="settings__card-head">
                    <h2 id="settings-kit">Kit Bag</h2>
                    <span v-if="isPro" class="settings__status"><AppIcon name="check" /> Included with Pro</span>
                    <span v-else-if="hasThemes" class="settings__status"><AppIcon name="check" /> Unlocked</span>
                </div>
                <p class="settings__hint">Themes for the whole app. Some are always dark or always light, whatever Appearance says.</p>

                <ul class="settings__kits">
                    <li v-for="option in availableKits" :key="option.id">
                        <button
                            :aria-label="`${option.name}${option.locked ? ' (locked)' : ''}${kit === option.id ? ' (in use)' : ''}`"
                            :aria-pressed="kit === option.id"
                            class="settings__kit"
                            :class="{ 'settings__kit--active': kit === option.id, 'settings__kit--locked': option.locked }"
                            type="button"
                            @click="chooseKit(option.id)"
                        >
                            <span aria-hidden="true" class="settings__kit-swatch" :style="{ backgroundColor: option.swatch.background }">
                                <span class="settings__kit-pitch" :style="{ backgroundColor: option.swatch.pitch }" />
                                <span class="settings__kit-accent" :style="{ backgroundColor: option.swatch.accent }" />
                                <span class="settings__kit-ink" :style="{ backgroundColor: option.swatch.ink }" />
                            </span>
                            <span class="settings__kit-name">
                                {{ option.name }}
                                <AppIcon v-if="option.locked" class="settings__kit-lock" name="lock" />
                                <AppIcon v-else-if="kit === option.id" class="settings__kit-check" name="check" />
                            </span>
                            <span class="settings__kit-blurb">{{ option.blurb }}</span>
                            <span v-if="MODE_NOTES[option.modes]" class="settings__kit-mode">{{ MODE_NOTES[option.modes] }}</span>
                        </button>
                    </li>
                </ul>

                <button v-if="!hasThemes" class="settings__button settings__button--primary" :disabled="purchasing" type="button" @click="getKitBag">
                    {{ kitBagProduct ? `Get Kit Bag · ${kitBagProduct.priceString}` : 'Get Kit Bag' }}
                </button>
                <p v-if="!hasThemes" class="settings__hint">All five themes are also included with Pro.</p>
            </section>

            <section v-if="isApp" aria-labelledby="settings-purchases" class="settings__card">
                <h2 id="settings-purchases">Purchases</h2>
                <dl class="settings__rows">
                    <div class="settings__row">
                        <dt>Exact XI Pro</dt>
                        <dd>
                            <span v-if="isPro" class="settings__pro-badge">Pro</span>
                            <span v-else class="settings__muted">Not yet</span>
                        </dd>
                    </div>
                    <div class="settings__row">
                        <dt>Boosts</dt>
                        <dd class="settings__mono">{{ isPro ? 'Unlimited' : `${boostBank} banked` }}</dd>
                    </div>
                </dl>
                <p
                    v-if="message"
                    aria-live="polite"
                    class="settings__message"
                    :class="`settings__message--${messageTone}`"
                >
                    {{ message }}
                </p>
                <div class="settings__actions">
                    <button class="settings__button" type="button" @click="openShopFromSettings">
                        <AppIcon name="bolt" />
                        Open shop
                    </button>
                    <button class="settings__button settings__button--text" :disabled="purchasing" type="button" @click="restore">
                        Restore purchases
                    </button>
                </div>
            </section>

            <section v-if="isApp" aria-labelledby="settings-game-center" class="settings__card">
                <h2 id="settings-game-center">Game Center</h2>
                <p class="settings__hint">
                    Leaderboards for your best Daily streak, exact Classic wins and best run of exact wins. Games with a boost or
                    Pro extra don't count.
                </p>
                <button class="settings__button" :disabled="!canUseGameCenter" type="button" @click="openLeaderboards">
                    <AppIcon name="trophy" />
                    Leaderboards
                </button>
                <p v-if="!canUseGameCenter" class="settings__hint">Game Center is only available in the iPhone app.</p>
            </section>

            <section v-if="isApp" aria-labelledby="settings-feel" class="settings__card">
                <h2 id="settings-feel">Feel</h2>
                <div class="settings__row settings__row--switch">
                    <span id="settings-haptics-label">Haptics</span>
                    <button
                        :aria-checked="haptics"
                        aria-labelledby="settings-haptics-label"
                        class="settings__switch"
                        :class="{ 'settings__switch--on': haptics }"
                        role="switch"
                        type="button"
                        @click="toggleHaptics"
                    >
                        <span aria-hidden="true" class="settings__switch-thumb" />
                    </button>
                </div>
            </section>

            <section aria-labelledby="settings-about" class="settings__card">
                <h2 id="settings-about">About</h2>
                <nav aria-label="About Exact XI" class="settings__links">
                    <NuxtLink class="settings__link" to="/how-to-play" @click="selectHowToPlay">
                        How to play
                        <AppIcon name="chevron" />
                    </NuxtLink>
                    <NuxtLink class="settings__link" to="/privacy" @click="selectPrivacy">
                        Privacy
                        <AppIcon name="chevron" />
                    </NuxtLink>
                </nav>
                <p v-if="version" class="settings__version">Version {{ version }}</p>
            </section>
        </div>
    </main>
</template>

<style lang="scss" scoped>
// Bib & Board settings: one surface card per section, like the privacy
// page. Red only marks the active state (the chosen appearance and kit, the
// Pro badge, a switch that's on); the one paid action here (Kit Bag) is a
// pitch-green button, since the screen's job is settings, not selling.
.settings {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 1rem 5.5rem;
}

.settings__inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0 auto;
    max-width: 36rem;
    width: 100%;
}

// The back pill's look comes from AppHeader (.app-header-back).
.settings__back {
    margin-right: auto;
}

h1,
h2 {
    margin: 0;
}

h2 {
    font-size: 1.4rem;
}

.settings__card {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.1rem;
}

.settings__card-head {
    align-items: baseline;
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
}

.settings__status {
    align-items: center;
    color: var(--color-primary);
    display: inline-flex;
    font-size: 0.78rem;
    font-weight: 700;
    gap: 0.25rem;
    white-space: nowrap;
}

.settings__hint {
    color: var(--color-muted);
    font-size: 0.8rem;
    line-height: 1.45;
    margin: 0;
}

// Same segmented look as StatsDialog's tabs: a raised surface plus a red
// underline marks the active option.
.settings__segmented {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
}

.settings__segment {
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    cursor: pointer;
    flex: 1 1 0;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    min-height: calc(var(--tap-min) - 0.5rem);
    padding: 0.35rem 0.6rem;
}

.settings__segment:hover {
    color: var(--color-foreground);
}

.settings__segment--active {
    background-color: var(--color-surface);
    border-color: var(--color-line);

    // Not combined with var(--shadow-sm): that token is none in dark mode
    // and several kits, which would void the whole list and lose the red.
    box-shadow: inset 0 -2px 0 var(--color-bib);
    color: var(--color-foreground);
}

.settings__kits {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
}

.settings__kits li {
    display: flex;
}

.settings__kit {
    align-items: flex-start;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: 0.25rem;
    min-height: var(--tap-min);
    padding: 0.5rem 0.5rem 0.65rem;
    text-align: left;
    width: 100%;
}

.settings__kit:hover,
.settings__kit:focus-visible {
    border-color: var(--color-primary);
}

.settings__kit--active,
.settings__kit--active:hover {
    border-color: var(--color-bib);
    box-shadow: inset 0 0 0 1px var(--color-bib);
}

.settings__kit--locked .settings__kit-swatch {
    opacity: 0.7;
}

// A tiny board: page colour, a pitch band, the accent as a bib chip and
// an ink line.
.settings__kit-swatch {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    box-sizing: border-box;
    display: block;
    height: 3rem;
    margin-bottom: 0.25rem;
    overflow: hidden;
    position: relative;
    width: 100%;
}

.settings__kit-pitch {
    bottom: 0;
    height: 55%;
    left: 0;
    position: absolute;
    right: 0;
}

.settings__kit-accent {
    border-radius: 3px;
    height: 0.9rem;
    left: 50%;
    position: absolute;
    top: 55%;
    transform: translate(-50%, -50%);
    width: 1.4rem;
}

.settings__kit-ink {
    border-radius: 2px;
    height: 0.2rem;
    left: 0.5rem;
    position: absolute;
    top: 0.55rem;
    width: 40%;
}

.settings__kit-name {
    align-items: center;
    display: flex;
    font-size: 0.875rem;
    font-weight: 700;
    gap: 0.3rem;
}

.settings__kit-lock {
    color: var(--color-muted);
}

.settings__kit-check {
    color: var(--color-bib);
}

.settings__kit-blurb {
    color: var(--color-muted);
    font-size: 0.72rem;
    line-height: 1.35;
}

.settings__kit-mode {
    color: var(--color-muted);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.settings__rows {
    display: flex;
    flex-direction: column;
    margin: 0;
}

.settings__row {
    align-items: center;
    display: flex;
    font-size: 0.9rem;
    gap: 0.75rem;
    justify-content: space-between;
    min-height: var(--tap-min);
}

.settings__rows .settings__row + .settings__row {
    border-top: 1px solid var(--color-line);
}

.settings__row dt {
    font-weight: 600;
}

.settings__row dd {
    margin: 0;
}

.settings__muted {
    color: var(--color-muted);
}

.settings__mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.settings__pro-badge {
    background-color: var(--color-bib);
    border-radius: var(--radius-pill);
    color: var(--color-on-bib);
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    padding: 0.15rem 0.65rem;
    text-transform: uppercase;
}

.settings__actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.settings__button {
    align-items: center;
    align-self: flex-start;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 700;
    gap: 0.4rem;
    justify-content: center;
    min-height: var(--tap-min);
    padding: 0 1rem;
}

.settings__button:not(:disabled):hover,
.settings__button:focus-visible {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.settings__button--primary {
    align-self: stretch;
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-on-primary);
}

.settings__button--primary:not(:disabled):hover,
.settings__button--primary:focus-visible {
    color: var(--color-on-primary);
}

.settings__button--text {
    background: none;
    border-color: transparent;
    color: var(--color-primary);
    text-decoration: underline;
    text-underline-offset: 0.2em;
}

.settings__button:disabled {
    cursor: default;
    opacity: 0.5;
}

.settings__message {
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0;
    padding: 0.6rem 0.75rem;
}

.settings__message--success,
.settings__message--pending {
    background-color: var(--color-surface-2);
}

.settings__message--error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
}

.settings__row--switch {
    font-weight: 600;
}

// iOS-style switch; on = the bib red active state.
.settings__switch {
    background-color: var(--color-surface-2);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    cursor: pointer;
    flex-shrink: 0;
    height: 1.9rem;
    padding: 0;
    position: relative;
    transition: background-color 0.15s ease;
    width: 3.2rem;
}

// The 44px target: the visible track is smaller, so its hit area grows.
.settings__switch::before {
    content: '';
    inset: -0.4rem -0.2rem;
    position: absolute;
}

.settings__switch--on {
    background-color: var(--color-bib);
    border-color: var(--color-bib);
}

.settings__switch-thumb {
    background-color: var(--color-surface);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
    height: 1.5rem;
    left: 0.15rem;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    transition: transform 0.15s ease;
    width: 1.5rem;
}

.settings__switch--on .settings__switch-thumb {
    transform: translate(1.3rem, -50%);
}

@media (prefers-reduced-motion: reduce) {
    .settings__switch,
    .settings__switch-thumb {
        transition: none;
    }
}

.settings__links {
    display: flex;
    flex-direction: column;
}

.settings__link {
    align-items: center;
    color: var(--color-foreground);
    display: flex;
    font-size: 0.9rem;
    font-weight: 600;
    justify-content: space-between;
    min-height: var(--tap-min);
    text-decoration: none;
}

.settings__link + .settings__link {
    border-top: 1px solid var(--color-line);
}

.settings__link:hover {
    color: var(--color-primary);
}

.settings__link svg {
    color: var(--color-muted);
}

.settings__version {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    margin: 0;
}
</style>
