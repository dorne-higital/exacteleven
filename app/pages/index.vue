<script setup lang="ts">
import { trackEvent } from '../utils/analytics';
import { FORMATION_DIFFICULTY, formations } from '../utils/formations';

const STEPS = [
    { number: '1', title: 'Pick a formation', detail: 'Its digits become your target.' },
    { number: '2', title: 'Fill the XI', detail: '3 hidden-stat players per slot.' },
    { number: '3', title: 'Land the number', detail: 'Exact wins. Going over busts the game.' },
];

const infoOpen = ref(false);
const statsOpen = ref(false);

function openInfo(): void {
    infoOpen.value = true;
    trackEvent('view_how_to_play', { source: 'home' });
}

function openStats(): void {
    statsOpen.value = true;
    trackEvent('view_stats', { source: 'home' });
}

function selectFormation(formationCode: string): void {
    trackEvent('select_formation', { formation: formationCode });
}

useSeoMeta({
    title: 'Exact XI — pick a formation, guess the exact score',
    description: 'A line-up guessing game for England\'s top-flight football since 2016/17 — pick a formation and land your goals + assists total exactly on target.',
    ogTitle: 'Exact XI',
    ogDescription: 'Pick a formation, fill the XI, and try to land on the exact score — real top-flight players since 2016/17.',
    ogImage: '/og-image.png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Exact XI logo on a dark background',
    twitterCard: 'summary_large_image',
    twitterTitle: 'Exact XI',
    twitterDescription: 'Pick a formation, fill the XI, and try to land on the exact score.',
    twitterImage: '/og-image.png',
});
</script>

<template>
    <main class="home">
        <div class="home__inner">
            <AppHeader>
                <button aria-label="How to play" class="home__icon-button" type="button" @click="openInfo">
                    <AppIcon name="info" />
                </button>
                <button aria-label="Your stats" class="home__icon-button" type="button" @click="openStats">
                    <AppIcon name="stats" />
                </button>
                <ThemeToggle />
            </AppHeader>

            <div class="home__hero">
                <img alt="" class="home__mark" height="40" src="/logo/exact-xi-mark-on-light.svg" width="40">
                <h1>Exact XI</h1>
                <p>
                    Pick a formation, then fill the XI to land on the target exactly — goals + assists for every real
                    player picked, from England's top-flight football since 2016/17.
                </p>
            </div>

            <ol class="steps">
                <li v-for="step in STEPS" :key="step.number" class="steps__item">
                    <span class="steps__number">{{ step.number }}</span>
                    <span class="steps__title">{{ step.title }}</span>
                    <span class="steps__detail">{{ step.detail }}</span>
                </li>
            </ol>

            <ul class="formations">
                <li v-for="formation in formations" :key="formation.code">
                    <NuxtLink
                        class="formations__link"
                        :class="`formations__link--${FORMATION_DIFFICULTY[formation.code].tier}`"
                        :to="{ path: '/play', query: { f: formation.code } }"
                        @click="selectFormation(formation.code)"
                    >
                        <FormationIcon :slots="formation.slots" />
                        <span class="formations__details">
                            <span class="formations__code">{{ formation.code }}</span>
                            <span class="formations__rows">{{ formation.rows[0] }} DEF · {{ formation.rows[1] }} MID · {{ formation.rows[2] }} FWD</span>
                        </span>
                        <span class="formations__tag" :class="`formations__tag--${FORMATION_DIFFICULTY[formation.code].tier}`">
                            {{ FORMATION_DIFFICULTY[formation.code].label }}
                        </span>
                    </NuxtLink>
                </li>
            </ul>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Mobile-first: a single centered column that's already comfortable at phone
// widths. The max-width caps line length and stops everything (including the
// paragraph) stretching edge-to-edge on a desktop-width viewport, without
// needing a breakpoint switch.
.home {
    display: flex;
    justify-content: center;
    min-height: 100vh;
    padding: 1.5rem 1.25rem 2rem;
}

.home__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin: 0 auto;
    max-width: 36rem;
    text-align: center;
    width: 100%;
}

.home__icon-button {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 50%;
    color: inherit;
    cursor: pointer;
    display: flex;
    height: 2.75rem;
    justify-content: center;
    padding: 0;
    width: 2.75rem;
}

.home__icon-button:hover,
.home__icon-button:focus-visible {
    border-color: var(--color-primary);
}

.home__hero {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.home__mark {
    display: block;
}

// A quick "how it works" strip — light visual substance beyond the headline
// paragraph, without competing with the formation list below it.
.steps {
    display: flex;
    gap: 0.75rem;
    list-style: none;
    margin: 0;
    max-width: 26rem;
    padding: 0;
    width: 100%;
}

.steps__item {
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 12%, transparent);
    border-radius: 0.75rem;
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 0.6rem;
}

.steps__number {
    color: var(--color-primary);
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
}

.steps__title {
    font-size: 0.75rem;
    font-weight: 700;
}

.steps__detail {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.68rem;
    line-height: 1.3;
}

// Single-column stacked list — the direction chosen off the design canvas —
// not a card grid: each formation is a full-width row so it reads the same
// way (one after another) at every viewport width, not fewer/more per row.
.formations {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    list-style: none;
    margin: 0;
    max-width: 26rem;
    padding: 0;
    width: 100%;
}

.formations__link {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-left: 4px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 0.75rem;
    color: inherit;
    display: flex;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    text-align: left;
    text-decoration: none;
    transition: border-color 0.15s ease;
}

.formations__link:hover,
.formations__link:focus-visible {
    border-color: var(--color-primary);
}

.formations__link--easier {
    border-left-color: var(--color-primary);
}

.formations__link--hardest {
    border-left-color: var(--color-danger);
}

.formations__details {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
}

.formations__code {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1;
}

.formations__rows {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.75rem;
    margin-top: 0.25rem;
}

.formations__tag {
    border: 1px solid currentcolor;
    border-radius: 999px;
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.6rem;
    text-transform: uppercase;
}

.formations__tag--easier {
    color: var(--color-primary);
}

.formations__tag--balanced {
    color: color-mix(in srgb, var(--color-foreground) 65%, transparent);
}

.formations__tag--hardest {
    color: var(--color-danger);
}

@media (prefers-reduced-motion: reduce) {
    .formations__link {
        transition: none;
    }
}
</style>
