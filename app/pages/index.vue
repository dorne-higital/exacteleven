<script setup lang="ts">
import { trackEvent } from '../utils/analytics';

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

function selectPlay(): void {
    trackEvent('view_formation_picker', { source: 'home' });
}

function selectDaily(): void {
    trackEvent('view_daily_challenge', { source: 'home' });
}

const createChallengeOpen = ref(false);

function openCreateChallenge(): void {
    createChallengeOpen.value = true;
    trackEvent('view_create_challenge', { source: 'home' });
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
        <AppHeader>
            <button aria-label="How to play" class="home__icon-button" type="button" @click="openInfo">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="home__icon-button" type="button" @click="openStats">
                <AppIcon name="stats" />
            </button>
            <ThemeToggle />
        </AppHeader>

        <div class="home__inner">
            <h1 class="home__visually-hidden-title">Exact XI</h1>

            <p class="home__lede">
                Pick a formation, then fill the XI to land on the target exactly — goals + assists for every real
                player picked, from England's top-flight football since 2016/17.
            </p>

            <ol class="steps">
                <li v-for="step in STEPS" :key="step.number" class="steps__item">
                    <span class="steps__number">{{ step.number }}</span>
                    <span class="steps__title">{{ step.title }}</span>
                    <span class="steps__detail">{{ step.detail }}</span>
                </li>
            </ol>

            <NuxtLink class="daily-card daily-card--play" to="/select-formation" @click="selectPlay">
                <AppIcon class="daily-card__bleed-icon" name="pitch" />
                <AppIcon class="daily-card__icon" name="pitch" />
                <span class="daily-card__details">
                    <span class="daily-card__title">Play game</span>
                    <span class="daily-card__detail">Pick a formation and fill the XI.</span>
                </span>
            </NuxtLink>

            <div class="entry-cards">
                <NuxtLink class="daily-card" to="/daily" @click="selectDaily">
                    <AppIcon class="daily-card__bleed-icon" name="calendar" />
                    <AppIcon class="daily-card__icon" name="calendar" />
                    <span class="daily-card__details">
                        <span class="daily-card__title">Daily Challenge</span>
                        <span class="daily-card__detail">A new twist every day.</span>
                    </span>
                </NuxtLink>

                <button class="daily-card daily-card--challenge" type="button" @click="openCreateChallenge">
                    <AppIcon class="daily-card__bleed-icon" name="target" />
                    <AppIcon class="daily-card__icon" name="target" />
                    <span class="daily-card__details">
                        <span class="daily-card__title">Create a challenge</span>
                        <span class="daily-card__detail">Build a board for a friend.</span>
                    </span>
                </button>
            </div>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
        <CreateChallengeDialog v-model:open="createChallengeOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Mobile-first: a single centered column that's already comfortable at phone
// widths. The max-width caps line length and stops everything (including the
// paragraph) stretching edge-to-edge on a desktop-width viewport, without
// needing a breakpoint switch. AppHeader is a direct child here (not nested
// inside .home__inner) so it's sized by its own max-width, not this page's —
// see AppHeader.vue for why that matters.
.home {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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

// The nav already carries the logo + "Exact XI" wordmark — repeating both
// again here as visible content was pure duplication. This keeps the page's
// only <h1> for accessibility/SEO structure without showing it twice.
.home__visually-hidden-title {
    border: 0;
    clip-path: inset(50%);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    white-space: nowrap;
    width: 1px;
}

.home__lede {
    margin: 0;
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

// A quick "how it works" strip — light visual substance beyond the headline
// paragraph, without competing with the entry cards below it.
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

// Two equal-width entry points side by side, rather than stacked — they're
// peers (both secondary to the main "Play game" entry above), so a 50/50 row
// reads that relationship better than two full-width rows.
.entry-cards {
    display: flex;
    gap: 0.625rem;
    max-width: 26rem;
    width: 100%;
}

// Shared shell for every home-page entry card, including the full-width
// "Play game" one above .entry-cards. Column layout (icon/title/detail
// stacked, centered) reads well at both full and half width. position:
// relative + overflow: hidden gives .daily-card__bleed-icon a corner to
// bleed off of without spilling into the row's gap or the neighbouring card.
.daily-card {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border: 1px solid var(--color-primary);
    border-radius: 0.75rem;
    color: inherit;
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.35rem;
    overflow: hidden;
    padding: 1rem 0.75rem;
    position: relative;
    text-align: center;
    text-decoration: none;
}

// Same visual shell as .daily-card above, but this one's a <button> (it
// opens a modal, not a route), so it needs the usual button-reset properties
// a NuxtLink doesn't.
.daily-card--challenge {
    cursor: pointer;
    font: inherit;
}

// The featured entry point — full width and on its own row above the 50/50
// Daily/Challenge pair, so the main game reads as a peer of "how to play"
// rather than buried below the formation list the way it used to be. Sits
// directly in .home__inner (a column flex container) rather than inside
// .entry-cards (a row), so .daily-card's flex: 1 1 0 would otherwise zero
// out this card's height instead of its width — reset back to content-sized
// here and size explicitly via width/max-width instead. box-sizing: border-box
// so that explicit width includes the card's own padding/border rather than
// adding them on top — .entry-cards' children get this for free from flex's
// own sizing math, but this one needs it stated to line up with them.
.daily-card--play {
    box-sizing: border-box;
    flex: none;
    max-width: 26rem;
    width: 100%;
}

// The rust/danger accent (vs. Daily's primary green) is what makes the two
// cards read as distinct modes even though they share the same shell.
.daily-card--challenge .daily-card__icon,
.daily-card--challenge .daily-card__bleed-icon {
    color: var(--color-danger);
}

.daily-card--challenge .daily-card__bleed-icon {
    transform: rotate(-8deg);
}

.daily-card__icon {
    color: var(--color-primary);
    flex-shrink: 0;
    height: 1.625rem;
    width: 1.625rem;
}

// A large, low-opacity outline of the same icon bleeding off the card's
// bottom-right corner — the "line-art icon bleed" treatment picked over the
// plain flat cards. z-index: -1 (scoped to .daily-card's own stacking
// context, since it's position: relative) keeps it behind the icon/text
// regardless of DOM order, and it never intercepts clicks.
.daily-card__bleed-icon {
    bottom: -1.375rem;
    color: var(--color-primary);
    height: 7.5rem;
    opacity: 0.16;
    pointer-events: none;
    position: absolute;
    right: -1.375rem;
    width: 7.5rem;
    z-index: -1;
}

.daily-card__details {
    display: flex;
    flex-direction: column;
}

.daily-card__title {
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 700;
    text-transform: var(--display-text-transform);
}

.daily-card__detail {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.7rem;
    line-height: 1.3;
    margin-top: 0.2rem;
}
</style>
