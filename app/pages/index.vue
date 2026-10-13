<script setup lang="ts">
import { trackEvent } from '../utils/analytics';

const { stats } = useStats();

const STEPS = [
    { number: '1', title: 'Pick a formation', detail: 'Its digits become your target.' },
    { number: '2', title: 'Fill the XI', detail: '3 hidden-stat players per slot.' },
    { number: '3', title: 'Land the number', detail: 'Exact wins. Going over busts the game.' },
];

// One-tap starts on the hero board — the same /play?f= link the formation
// picker uses, so nothing about how a game starts changes. Four that fit
// on a phone in one row, easiest to hardest; the full list (with
// difficulty tags) stays one tap away on /select-formation.
const QUICK_FORMATIONS = ['352', '433', '442', '541'];

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

function selectQuickFormation(formationCode: string): void {
    trackEvent('select_formation', { formation: formationCode, source: 'home' });
}

function selectDaily(): void {
    trackEvent('view_daily_challenge', { source: 'home' });
}

function selectHowToPlayPage(): void {
    trackEvent('view_how_to_play', { source: 'home_footer' });
}

function selectPrivacy(): void {
    trackEvent('view_privacy', { source: 'home' });
}

const createChallengeOpen = ref(false);

function openCreateChallenge(): void {
    createChallengeOpen.value = true;
    trackEvent('view_create_challenge', { source: 'home' });
}

usePageSeoMeta({
    title: 'Exact XI — pick a formation, guess the exact score',
    description: 'A line-up guessing game for England\'s top-flight football since 2016/17 — pick a formation and land your goals + assists total exactly on target.',
    ogTitle: 'Exact XI',
    ogDescription: 'Pick a formation, fill the XI, and try to land on the exact score — real top-flight players since 2016/17.',
    twitterTitle: 'Exact XI',
    twitterDescription: 'Pick a formation, fill the XI, and try to land on the exact score.',
});
</script>

<template>
    <main class="home">
        <AppHeader>
            <button aria-label="How to play" class="app-header-button" type="button" @click="openInfo">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="app-header-button" type="button" @click="openStats">
                <AppIcon name="stats" />
            </button>
        </AppHeader>

        <div class="home__inner">
            <h1 class="home__visually-hidden-title">Exact XI</h1>

            <section aria-labelledby="home-play-title" class="board">
                <span class="board__label">Classic</span>
                <h2 id="home-play-title" class="board__title">Play</h2>
                <p class="board__lede">Pick a formation. Land the number.</p>
                <p class="board__detail">
                    Goals + assists for every real player you pick, from England's top-flight football since 2016/17.
                </p>

                <ul aria-label="Quick start formations" class="board__formations">
                    <li v-for="code in QUICK_FORMATIONS" :key="code">
                        <NuxtLink
                            :aria-label="`Play ${code.split('').join('-')}`"
                            class="board__formation"
                            :to="{ path: '/play', query: { f: code } }"
                            @click="selectQuickFormation(code)"
                        >
                            {{ code }}
                        </NuxtLink>
                    </li>
                </ul>

                <NuxtLink class="board__cta" to="/select-formation" @click="selectPlay">
                    Pick a formation
                    <AppIcon name="forward" />
                </NuxtLink>
            </section>

            <div class="home__row">
                <NuxtLink class="mode-card" to="/daily" @click="selectDaily">
                    <span class="mode-card__top">
                        <span class="mode-card__label">Daily</span>
                        <AppIcon class="mode-card__icon" name="calendar" />
                    </span>
                    <span class="mode-card__title">Today's board</span>
                    <span class="mode-card__detail">A new twist every day.</span>
                    <span class="mode-card__streak">
                        <DailyStreakStrip compact :results="stats.dailyResults" :streak="stats.dailyStreak" />
                    </span>
                </NuxtLink>

                <button class="mode-card" type="button" @click="openCreateChallenge">
                    <span class="mode-card__top">
                        <span class="mode-card__label">Head to head</span>
                        <AppIcon class="mode-card__icon" name="target" />
                    </span>
                    <span class="mode-card__title">Challenge a mate</span>
                    <span class="mode-card__detail">Build a board for a friend.</span>
                </button>
            </div>

            <section aria-labelledby="home-steps-title" class="home__section">
                <h2 id="home-steps-title" class="home__section-label">How it works</h2>
                <ol class="steps">
                    <li v-for="step in STEPS" :key="step.number" class="steps__item">
                        <span aria-hidden="true" class="steps__number">{{ step.number }}</span>
                        <span class="steps__text">
                            <span class="steps__title">{{ step.title }}</span>
                            <span class="steps__detail">{{ step.detail }}</span>
                        </span>
                    </li>
                </ol>
            </section>

            <nav aria-label="More" class="home__footer">
                <NuxtLink class="home__footer-link" to="/how-to-play" @click="selectHowToPlayPage">Full rules</NuxtLink>
                <NuxtLink class="home__footer-link" to="/privacy" @click="selectPrivacy">Privacy</NuxtLink>
            </nav>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
        <CreateChallengeDialog v-model:open="createChallengeOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Bib & Board home, after the handbook's home mockup: a green "Play" board
// with quick-start formations and the red main CTA, then the Daily and
// Challenge cards side by side, then how it works. Mobile-first single
// column, capped so it reads like an app screen on desktop too. AppHeader is
// a direct child here (not nested inside .home__inner) so it's sized by its
// own max-width, not this page's — see AppHeader.vue for why that matters.
.home {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1.25rem;

    // Extra bottom room on the website so Buy Me a Coffee's floating
    // button never sits on top of the footer links.
    padding: 1rem 1rem 5.5rem;
}

.home__inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0 auto;
    max-width: 36rem;
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

// ---- The Play board -------------------------------------------------
// Flat pitch green with a thin halfway line and centre circle drawn in
// CSS — the tactics-board half of the identity.
.board {
    background-color: var(--color-pitch);
    border-radius: var(--radius-lg);
    color: var(--color-pitch-ink);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    isolation: isolate;
    overflow: hidden;
    padding: 1.1rem 1.1rem 1.15rem;
    position: relative;
}

.board::before,
.board::after {
    border: 1.5px solid var(--color-pitch-line);
    content: '';
    opacity: 0.6;
    pointer-events: none;
    position: absolute;
    z-index: -1;
}

.board::before {
    border-width: 0 0 0 1.5px;
    bottom: 0;
    right: 4.25rem;
    top: 0;
}

.board::after {
    border-radius: 50%;
    height: 6.5rem;
    right: calc(4.25rem - 3.25rem);
    top: calc(50% - 3.25rem);
    width: 6.5rem;
}

.board__label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    opacity: 0.9;
    text-transform: uppercase;
}

.board__title {
    font-size: 4rem;
    font-weight: 900;
    line-height: 0.9;
    margin: 0;
}

.board__lede {
    font-size: 1rem;
    font-weight: 600;
    margin: 0.15rem 0 0;
}

.board__detail {
    font-size: 0.8rem;
    line-height: 1.4;
    margin: 0;
    max-width: 19rem;
}

.board__formations {
    display: flex;
    gap: 0.4rem;
    list-style: none;
    margin: 0.6rem 0 0;
    padding: 0;
}

.board__formation {
    align-items: center;
    background-color: rgb(255 255 255 / 16%);
    border: 1px solid rgb(255 255 255 / 18%);
    border-radius: var(--radius-sm);
    box-sizing: border-box;
    color: inherit;
    display: inline-flex;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    justify-content: center;
    min-height: var(--tap-min);
    min-width: 3.4rem;
    padding: 0 0.6rem;
    text-decoration: none;
    transition: background-color 0.15s ease, color 0.15s ease;
}

// Active state is the bib red (see app.vue's rules).
.board__formation:hover,
.board__formation:active {
    background-color: var(--color-bib);
    border-color: var(--color-bib);
    color: var(--color-on-bib);
}

.board__formation:focus-visible,
.board__cta:focus-visible {
    outline-color: var(--color-pitch-ink);
}

// The screen's one red call to action.
.board__cta {
    align-items: center;
    align-self: stretch;
    background-color: var(--color-bib);
    border-radius: var(--radius-stub);
    box-sizing: border-box;
    color: var(--color-on-bib);
    display: flex;
    font-size: 1rem;
    font-weight: 700;
    gap: 0.5rem;
    justify-content: center;
    margin-top: 0.6rem;
    min-height: 3.25rem;
    padding: 0 1rem;
    text-decoration: none;
    transition: filter 0.15s ease;
}

.board__cta:hover {
    filter: brightness(1.06);
}

.board__cta:active {
    filter: brightness(0.94);
}

// ---- Daily + Challenge cards ---------------------------------------
// Two peers side by side (both secondary to the Play board above), so a
// 50/50 row reads that relationship better than two full-width rows.
.home__row {
    display: grid;
    gap: 0.625rem;
    grid-template-columns: 1fr 1fr;
}

// Shared by the Daily link and the Challenge button, so the button gets
// the usual reset a NuxtLink doesn't need.
.mode-card {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: 0.2rem;
    min-height: 8.5rem;
    min-width: 0;
    padding: 0.85rem 0.9rem;
    text-align: left;
    text-decoration: none;
    transition: border-color 0.15s ease;
}

.mode-card:hover {
    border-color: var(--color-primary);
}

.mode-card__top {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.25rem;
}

.mode-card__label {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.mode-card__icon {
    color: var(--color-primary);
    flex-shrink: 0;
    height: 1.25rem;
    width: 1.25rem;
}

.mode-card__title {
    font-family: var(--font-display);
    font-size: 1.45rem;
    font-weight: 900;
    line-height: 1;
    text-transform: var(--display-text-transform);
}

.mode-card__detail {
    color: var(--color-muted);
    font-size: 0.78rem;
    line-height: 1.35;
}

// The compact streak badge, pushed to the card's foot.
.mode-card__streak {
    display: flex;
    margin-top: auto;
    padding-top: 0.35rem;
}

.mode-card__streak:empty {
    display: none;
}

// ---- How it works -------------------------------------------------
.home__section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.35rem;
}

.home__section-label {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
}

.steps {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.steps__item {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    display: flex;
    gap: 0.75rem;
    padding: 0.6rem 0.8rem;
}

.steps__number {
    align-items: center;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-pill);
    color: var(--color-primary);
    display: flex;
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 900;
    height: 2rem;
    justify-content: center;
    width: 2rem;
}

.steps__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.steps__title {
    font-size: 0.9rem;
    font-weight: 700;
}

.steps__detail {
    color: var(--color-muted);
    font-size: 0.8rem;
    line-height: 1.35;
}

// ---- Footer links -------------------------------------------------
.home__footer {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
    margin-top: 0.25rem;
}

.home__footer-link {
    align-items: center;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    display: inline-flex;
    font-size: 0.85rem;
    font-weight: 600;
    min-height: var(--tap-min);
    padding: 0 0.75rem;
    text-decoration: none;
}

.home__footer-link:hover {
    color: var(--color-primary);
    text-decoration: underline;
}

@media (width >= 48rem) {
    .home {
        padding-top: 1.5rem;
    }

    .board {
        padding: 1.5rem;
    }

    .board__title {
        font-size: 5rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .board__formation,
    .board__cta,
    .mode-card {
        transition: none;
    }
}
</style>
