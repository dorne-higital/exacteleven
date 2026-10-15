<script setup lang="ts">
import { DAILY2_STORAGE_KEY, readDaily2Persisted } from '../composables/useDaily';
import { trackEvent } from '../utils/analytics';
import { fetchAppConfig } from '../utils/app-config';
import { formatPoints } from '../utils/daily-screens';
import { formationLabel } from '../utils/share-daily';
import { formatCountdown, nextUkMidnight, resolveDailyDate } from '../utils/trusted-date';

const { stats, currentDailyStreak, currentDailyWinStreak } = useStats();
const { lastFormation } = useGame();
const { recapAvailable } = useDaily();

// Today's Daily on the card: "Play today's Daily", "Carry on…" for one in
// progress, or the finished score ("812 · beat 74%"). Client-only (the date
// comes from the server's UK clock, the state from this device's storage).
const dailyToday = ref<string | null>(null);
const dailyInProgress = ref(false);
// lastFormation / the recap come from this device's storage and clock, so
// they only render after hydration (no SSR mismatch).
const mounted = ref(false);
const replayFormation = computed(() => (mounted.value ? lastFormation.value : null));
const showRecap = computed(() => (mounted.value ? recapAvailable.value : null));

// Desktop masthead: "Next Daily in 4h 12m", ticking once a minute (client only).
const nextDailyIn = ref('');
let countdownTimer: ReturnType<typeof setInterval> | null = null;

function tickCountdown(): void {
    nextDailyIn.value = formatCountdown(nextUkMidnight(new Date()).toISOString());
}

onBeforeUnmount(() => {
    if (countdownTimer) {
        clearInterval(countdownTimer);
    }
});

onMounted(async () => {
    mounted.value = true;
    tickCountdown();
    countdownTimer = setInterval(tickCountdown, 60_000);

    const date = resolveDailyDate(await fetchAppConfig());

    dailyToday.value = date;

    const saved = readDaily2Persisted(DAILY2_STORAGE_KEY, date);

    dailyInProgress.value = !!saved && saved.date === date && saved.game.status === 'playing';
});

const todayScore = computed(() => {
    const date = dailyToday.value;

    if (!date || stats.value.lastDailyResultDate !== date) {
        return null;
    }

    const entry = stats.value.dailyScores.find((candidate) => candidate.date === date);

    if (!entry) {
        return 'Played today';
    }

    return typeof entry.beatPct === 'number' ? `${formatPoints(entry.score)} · beat ${entry.beatPct}%` : formatPoints(entry.score);
});

const dailyTitle = computed(() => {
    if (todayScore.value) {
        return todayScore.value;
    }

    return dailyInProgress.value ? 'Carry on' : 'Play today\'s Daily';
});

const dailyDetail = computed(() => (todayScore.value ? 'Next Daily at midnight UK time.' : 'Same puzzle for everyone today.'));

const winStreak = computed(() => (dailyToday.value ? currentDailyWinStreak(dailyToday.value) : stats.value.dailyWinStreak));

// "Wed 14 Oct" from the resolved UK Daily date (desktop masthead eyebrow).
const mastheadDate = computed(() => {
    if (!dailyToday.value) {
        return '';
    }

    return new Date(`${dailyToday.value}T12:00:00Z`).toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });
});

const playedStreak = computed(() => (dailyToday.value ? currentDailyStreak(dailyToday.value) : stats.value.dailyStreak));

function selectLastFormation(): void {
    if (lastFormation.value) {
        trackEvent('play_last_formation', { formation: lastFormation.value });
    }
}

function selectRecap(): void {
    trackEvent('open_weekly_recap', { source: 'home' });
}

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
            <!-- One h1, switched by CSS: visually hidden "Exact XI" on phone and
                 tablet, the visible "Matchday" masthead from 1024px. -->
            <header class="home__masthead">
                <p class="home__date">{{ mastheadDate || '\u00a0' }}</p>
                <h1 class="home__title">
                    <span class="home__title-brand">Exact XI</span>
                    <span class="home__title-desk">Matchday</span>
                </h1>
                <p class="home__countdown">
                    <template v-if="nextDailyIn">Next Daily in <strong>{{ nextDailyIn }}</strong></template>
                </p>
            </header>

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

                <NuxtLink
                    v-if="replayFormation"
                    class="board__cta"
                    :to="{ path: '/play', query: { f: replayFormation } }"
                    @click="selectLastFormation"
                >
                    Play {{ formationLabel(replayFormation) }} again
                    <AppIcon name="forward" />
                </NuxtLink>
                <NuxtLink
                    class="board__cta"
                    :class="{ 'board__cta--quiet': replayFormation }"
                    to="/select-formation"
                    @click="selectPlay"
                >
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
                    <span class="mode-card__title">{{ dailyTitle }}</span>
                    <span class="mode-card__detail">{{ dailyDetail }}</span>
                    <span class="mode-card__streak">
                        <DailyStreakStrip compact :results="stats.dailyResults" :streak="playedStreak" />
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

            <NuxtLink
                v-if="showRecap"
                class="home__recap"
                :to="{ path: '/daily', query: { recap: '1' } }"
                @click="selectRecap"
            >
                <span class="home__recap-label">Daily recap</span>
                <span class="home__recap-title">{{ showRecap === 'thisWeek' ? 'Your week' : 'Last week' }}: scores vs everyone</span>
                <AppIcon name="forward" />
            </NuxtLink>

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

            <HomeGlance
                class="home__glance"
                :detail="dailyDetail"
                :played-streak="playedStreak"
                :ready="mounted"
                :title="dailyTitle"
                :win-streak="winStreak"
            />
            <HomeNumbers class="home__numbers" :ready="mounted" />
            <HomeAchievements class="home__ach" :ready="mounted" />

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
    max-width: var(--page-max);
    width: 100%;
}

// The nav already carries the logo + "Exact XI" wordmark — repeating both
// again here as visible content was pure duplication. This keeps the page's
// only <h1> for accessibility/SEO structure without showing it twice.
.home__masthead {
    display: contents;
}

.home__date,
.home__countdown,
.home__title-desk {
    display: none;
}

.home__title {
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

// With a remembered formation, "Play 4-3-3 again" takes the red CTA and the
// picker drops to a quiet outline beside it.
.board__cta--quiet {
    background-color: transparent;
    border: 1px solid var(--color-pitch-line);
    color: var(--color-pitch-ink);
    margin-top: 0.4rem;
    min-height: var(--tap-min);
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

// ---- Sunday / Monday recap entry ------------------------------------
.home__recap {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    color: var(--color-foreground);
    display: grid;
    gap: 0.1rem 0.75rem;
    grid-template-columns: 1fr auto;
    min-height: var(--tap-min);
    padding: 0.7rem 0.9rem;
    text-decoration: none;

    // AppIcon's root <svg> carries this page's scope attribute.
    svg {
        color: var(--color-primary);
        grid-column: 2;
        grid-row: 1 / span 2;
    }
}

.home__recap:hover {
    border-color: var(--color-primary);
}

.home__recap-label {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.home__recap-title {
    font-size: 0.92rem;
    font-weight: 700;
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

@media (width >= 768px) {
    .steps {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .steps__item {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.5rem;
    }
}

// ---- Desktop Matchday grid (after Footballdle's Option A board) ----
@media (width >= 1024px) {
    .home {
        padding: 2rem 2rem 5.5rem;
    }

    .home__inner {
        align-items: start;
        display: grid;
        gap: 1.25rem;
        grid-template:
            'mast   mast' auto
            'board  glance' auto
            'board  numbers' auto
            'row    ach' auto
            'recap  ach' auto
            'steps  ach' 1fr
            'footer footer' auto
            / minmax(0, 1.7fr) minmax(18rem, 1fr);
    }

    .home__masthead {
        align-items: flex-end;
        border-bottom: 1px solid var(--color-line);
        display: grid;
        gap: 0 1rem;
        grid-area: mast;
        grid-template-columns: minmax(0, 1fr) auto;
        padding-bottom: 0.75rem;
    }

    .home__date {
        color: var(--color-muted);
        display: block;
        font-size: 0.75rem;
        font-weight: 700;
        grid-column: 1;
        letter-spacing: 0.12em;
        margin: 0;
        text-transform: uppercase;
    }

    .home__title {
        clip-path: none;
        font-family: var(--font-display);
        font-size: 3rem;
        font-weight: 900;
        grid-column: 1;
        height: auto;
        line-height: 1;
        margin: 0;
        overflow: visible;
        position: static;
        text-transform: var(--display-text-transform);
        white-space: normal;
        width: auto;
    }

    .home__title-brand {
        clip-path: inset(50%);
        height: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
        width: 1px;
    }

    .home__title-desk {
        display: inline;
    }

    .home__countdown {
        color: var(--color-muted);
        display: block;
        font-size: 0.9rem;
        grid-column: 2;
        grid-row: 1 / span 2;
        margin: 0;

        strong {
            color: var(--color-foreground);
            font-family: var(--font-mono);
            font-variant-numeric: tabular-nums;
        }
    }

    .board {
        align-self: stretch;
        grid-area: board;
        justify-content: center;
        min-height: 20rem;
        padding: 2rem;
    }

    .board__title {
        font-size: 6rem;
    }

    .board__cta {
        align-self: flex-start;
        min-width: 16rem;
    }

    .home__row {
        grid-area: row;
    }

    .home__recap {
        grid-area: recap;
    }

    .home__section {
        grid-area: steps;
        margin-top: 0;
    }

    .home__footer {
        grid-area: footer;
    }

    .home__glance {
        grid-area: glance;
    }

    .home__numbers {
        grid-area: numbers;
    }

    .home__ach {
        align-self: stretch;
        grid-area: ach;
    }
}

@media (width >= 1440px) {
    .board__title {
        font-size: 7rem;
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
