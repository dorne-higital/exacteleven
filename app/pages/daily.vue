<script setup lang="ts">
import type { DailyChallengePayload } from '../composables/useGame';
import { dayStatValue } from '#shared/daily2-rules';
import { trackEvent } from '../utils/analytics';
import { apiErrorMessage, apiFetch, classifyApiError } from '../utils/api';
import { fetchAppConfig } from '../utils/app-config';
import { dailyHeading, objectiveRuleLine, rankPill } from '../utils/daily-screens';
import { getFormation } from '../utils/formations';
import { resolveDailyDate } from '../utils/trusted-date';

// The Daily. Daily 2.0 (useDaily): the same fixed options for everyone, a
// captain, one reroll / scouting clue / bench, and a score out of 1,000 —
// loaded whole up front on the server's UK date. `?date=YYYY-MM-DD` replays
// a past Daily from the archive (Pro, app; unranked). If the server has no
// Daily 2.0 (404 — a mid-deploy tab or a date before launch), or a v1 Daily
// from before this build is still in progress, the v1 flow below runs.
const route = useRoute();
const archiveDate = computed(() => (typeof route.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.date) ? route.query.date : null));

const { state, isDrawing, pendingSlotId, drawError, drawErrorMessage, startDailyGame, resumeDailyGame, openSlot, isDailyV2 } = useGame();
const daily = useDaily();
const {
    puzzle,
    snapshot,
    loading: v2Loading,
    loadError: v2LoadError,
    fallbackToV1,
    isArchive,
    isRanked,
    rankReason,
    captainSlotId,
    canBench,
    pendingBust,
    projectedScore,
    actionError,
    busy,
    countdown,
    newDailyOut,
    archiveAvailable,
    recapAvailable,
    today,
} = daily;
const { stats, currentDailyStreak, currentDailyWinStreak } = useStats();

// ---- v1 fallback ----------------------------------------------------------

const V1_LOAD_ERROR_FALLBACK = 'Couldn\'t load today\'s challenge.';
const v1Loading = ref(false);
const v1LoadError = ref<string | null>(null);

async function loadV1(): Promise<void> {
    // The server's UK date on web and app alike (device clock only offline).
    const date = resolveDailyDate(await fetchAppConfig());

    if (resumeDailyGame(date)) {
        return;
    }

    v1Loading.value = true;
    v1LoadError.value = null;

    try {
        const payload = await apiFetch<DailyChallengePayload>('/api/daily', { query: { date } });

        startDailyGame(payload);
    } catch (error) {
        v1LoadError.value = apiErrorMessage(classifyApiError(error), V1_LOAD_ERROR_FALLBACK, 'try again');
    } finally {
        v1Loading.value = false;
    }
}

// ---- loading ------------------------------------------------------------------

const ready = ref(false);
const recapOpen = ref(false);

async function load(): Promise<void> {
    ready.value = false;

    if (archiveDate.value) {
        await daily.loadArchive(archiveDate.value);
    } else {
        await daily.loadToday();

        if (fallbackToV1.value) {
            await loadV1();
        }
    }

    ready.value = true;

    // From the home page's recap entry (Sunday / Monday).
    if (route.query.recap === '1' && recapAvailable.value && !archiveDate.value) {
        recapOpen.value = true;
    }
}

// Client-only: the date comes from the server (or the device offline), and
// the puzzle from a network fetch — neither meaningful during SSR.
onMounted(() => {
    void load();
});

watch(archiveDate, () => {
    void load();
});

// Only render a Daily game (state is shared with Classic, so a Classic game
// left in state must never show here while the Daily loads).
const dailyGame = computed(() => (ready.value && state.value?.dailyDate ? state.value : null));
const isV2 = computed(() => !!dailyGame.value && isDailyV2.value);
const formation = computed(() => (dailyGame.value ? getFormation(dailyGame.value.formationCode) : undefined));
const remainingSlots = computed(() => dailyGame.value?.slots.filter((slot) => !slot.player).length ?? 0);
// 'finished' never happens on a daily game — its outcome is won/bust/lost.
const gameOver = computed(() => (
    dailyGame.value?.status === 'won' || dailyGame.value?.status === 'bust' || dailyGame.value?.status === 'lost'
));
const loadErrorText = computed(() => v2LoadError.value ?? v1LoadError.value);
const isLoading = computed(() => !ready.value || v2Loading.value || v1Loading.value);

// ---- header ----------------------------------------------------------------

const heading = computed(() => {
    const game = dailyGame.value;

    if (!game) {
        return '';
    }

    return isV2.value && puzzle.value ? dailyHeading(puzzle.value.date, puzzle.value.formationCode) : `Daily Challenge · ${game.formationCode}`;
});
const ruleLine = computed(() => (isV2.value && puzzle.value ? objectiveRuleLine(puzzle.value.objective) : null));
const pill = computed(() => (isV2.value ? rankPill(isRanked.value, rankReason.value, isArchive.value) : null));
const statValue = (player: { goals: number; assists: number }) => dayStatValue(player, puzzle.value?.objective.stat ?? 'ga');

// ---- board -----------------------------------------------------------------

const boardLocked = computed(() => isDrawing.value || gameOver.value || (isV2.value && (busy.value || !!pendingBust.value)));

function handleSlotSelect(slotId: string): void {
    openSlot(slotId);
}

// ---- captain / bench / pending bust ------------------------------------------

const captainSheetOpen = ref(false);
const benchSheetOpen = ref(false);
const captainName = computed(() => {
    const slot = dailyGame.value?.slots.find((candidate) => candidate.id === captainSlotId.value);

    if (!slot) {
        return null;
    }

    return slot.player ? slot.player.name : 'Blind captain';
});

function openCaptainSheet(): void {
    if (captainSlotId.value) {
        return;
    }

    captainSheetOpen.value = true;
    trackEvent('view_captain_sheet', { source: 'board' });
}

function openBenchSheet(source: 'board' | 'pending_bust'): void {
    if (!canBench.value.available) {
        return;
    }

    benchSheetOpen.value = true;
    trackEvent('view_bench_sheet', { source });
}

const acceptingBust = ref(false);

async function handleAcceptBust(): Promise<void> {
    if (acceptingBust.value) {
        return;
    }

    acceptingBust.value = true;

    try {
        await daily.acceptBust();
    } finally {
        acceptingBust.value = false;
    }
}

const ACTION_ERROR_COPY: Partial<Record<string, string>> = {
    network: 'Couldn\'t reach the server. Check your connection and try again.',
    not_today: 'This Daily has closed. Today\'s is ready.',
};
const boardError = computed(() => {
    // The picker shows its own errors while it's open.
    if (!isV2.value || dailyGame.value?.activeSlotId || !actionError.value) {
        return null;
    }

    return ACTION_ERROR_COPY[actionError.value] ?? 'That move isn\'t allowed right now.';
});

// ---- new Daily, recap, archive ---------------------------------------------------

function openNewDaily(): void {
    trackEvent('new_daily_open', { source: 'banner' });
    void load();
}

function toggleRecap(source: string): void {
    recapOpen.value = !recapOpen.value;

    if (recapOpen.value) {
        trackEvent('open_weekly_recap', { source });
    }
}

const streak = computed(() => (today.value ? currentDailyStreak(today.value) : stats.value.dailyStreak));
const winStreak = computed(() => (today.value ? currentDailyWinStreak(today.value) : stats.value.dailyWinStreak));

function handleArchiveBack(): void {
    trackEvent('view_archive', { source: 'archive_game' });
}

// ---- header buttons -------------------------------------------------------------

const infoOpen = ref(false);
const statsOpen = ref(false);

function openInfo(): void {
    infoOpen.value = true;
    trackEvent('view_how_to_play', { source: 'daily' });
}

function openStats(): void {
    statsOpen.value = true;
    trackEvent('view_stats', { source: 'daily' });
}

usePageSeoMeta({
    title: 'Daily Challenge — Exact XI',
    description: 'The same XI puzzle for everyone, every day: name a captain, use your bench wisely and score out of 1,000. Real top-flight players since 2016/17.',
});
</script>

<template>
    <main class="daily">
        <AppHeader>
            <button aria-label="How to play" class="app-header-button" type="button" @click="openInfo">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="app-header-button" type="button" @click="openStats">
                <AppIcon name="stats" />
            </button>
        </AppHeader>

        <div class="daily__inner">
            <button v-if="newDailyOut" class="daily__new-out" type="button" @click="openNewDaily">
                New Daily is out
                <AppIcon name="forward" />
            </button>

            <template v-if="formation && dailyGame">
                <p v-if="isV2 && isArchive" class="daily__archive-banner">
                    Archive · doesn't touch your streak or the table
                    <NuxtLink class="daily__archive-link" to="/daily-archive" @click="handleArchiveBack">All Dailies</NuxtLink>
                </p>

                <header class="daily__header">
                    <h1 class="daily__title">{{ heading }}</h1>
                    <p v-if="dailyGame.objective" class="daily__objective">{{ dailyGame.objective.label }}</p>
                    <p v-if="ruleLine" class="daily__rule">{{ ruleLine }}</p>
                    <p v-if="isV2 && !isArchive" class="daily__subline">
                        Same options for everyone · New Daily at midnight UK time<template v-if="countdown"> (in {{ countdown }})</template>
                    </p>
                    <span v-if="pill" class="daily__pill" :class="`daily__pill--${pill.tone}`">{{ pill.label }}</span>
                </header>

                <ScoreBar
                    :compact="isV2"
                    :objective="dailyGame.objective"
                    :projected="isV2 && !gameOver ? projectedScore : null"
                    :remaining-slots="remainingSlots"
                    :status="dailyGame.status"
                    :target="dailyGame.target"
                    :total="dailyGame.total"
                />

                <div v-if="isV2 && pendingBust" aria-live="assertive" class="daily__bust" role="alert">
                    <p class="daily__bust-text">Over the limit! Bring on the bench (−100) or take the bust.</p>
                    <div class="daily__bust-actions">
                        <button
                            class="daily__bust-bench"
                            :aria-disabled="!canBench.available || busy"
                            type="button"
                            @click="openBenchSheet('pending_bust')"
                        >
                            Use the bench
                        </button>
                        <button class="daily__bust-take" :aria-disabled="acceptingBust || busy" type="button" @click="handleAcceptBust">
                            Take the bust
                        </button>
                    </div>
                </div>

                <div v-else-if="isV2 && !gameOver" class="daily__helps">
                    <button
                        class="daily__help"
                        :class="{ 'daily__help--set': captainSlotId }"
                        :aria-disabled="!!captainSlotId || busy"
                        type="button"
                        @click="openCaptainSheet"
                    >
                        <span aria-hidden="true" class="daily__help-armband">C</span>
                        <span class="daily__help-text">{{ captainName ? `Captain: ${captainName}` : 'Name your captain' }}</span>
                    </button>
                    <button
                        class="daily__help"
                        :aria-disabled="!canBench.available || busy"
                        type="button"
                        @click="openBenchSheet('board')"
                    >
                        <span aria-hidden="true" class="daily__help-icon">⇄</span>
                        <span class="daily__help-text">{{ canBench.reason === 'used' ? 'Bench used' : 'Bench −100' }}</span>
                    </button>
                </div>

                <p v-if="boardError" aria-live="polite" class="daily__draw-error">{{ boardError }}</p>

                <WinOddsBanner v-if="!gameOver && !pendingBust" />

                <DailyFullTime v-if="isV2 && gameOver" @recap="toggleRecap('full_time')" />
                <ResultPanel v-else-if="gameOver" />

                <DailyRecapCard v-if="recapOpen" />

                <p v-if="drawError" aria-live="polite" class="daily__draw-error">
                    {{ drawErrorMessage }}
                </p>

                <div class="daily__board">
                    <Pitch />
                    <PositionSlot
                        v-for="slot in dailyGame.slots"
                        :key="slot.id"
                        :active="dailyGame.activeSlotId === slot.id"
                        :benched="isV2 && snapshot?.bench?.slotId === slot.id"
                        :busy="boardLocked"
                        :captain="isV2 && captainSlotId === slot.id"
                        :game-over="gameOver"
                        :loading="pendingSlotId === slot.id"
                        :pending-bust="isV2 && pendingBust?.slotId === slot.id"
                        :slot-data="slot"
                        :value="isV2 && slot.player ? statValue(slot.player) : null"
                        @select="handleSlotSelect"
                    />
                </div>

                <PlayerChoiceDialog v-if="dailyGame.activeSlotId" />
                <DailyCaptainSheet v-if="isV2" v-model:open="captainSheetOpen" />
                <DailyBenchSheet v-if="isV2" v-model:open="benchSheetOpen" />

                <DailyStreakStrip
                    v-if="!isArchive"
                    :results="stats.dailyResults"
                    :streak="streak"
                    :win-streak="winStreak"
                />

                <div v-if="isV2 && !isArchive" class="daily__links">
                    <button v-if="recapAvailable && !gameOver" class="daily__link" type="button" @click="toggleRecap('daily_page')">
                        {{ recapAvailable === 'thisWeek' ? 'Your week' : 'Last week' }}
                    </button>
                    <NuxtLink class="daily__link" to="/daily-archive" @click="trackEvent('view_archive', { source: 'daily_page' })">
                        <AppIcon v-if="!archiveAvailable" name="lock" />
                        Daily archive
                    </NuxtLink>
                </div>
            </template>

            <p v-else-if="loadErrorText && !isLoading" class="daily__error">
                {{ loadErrorText }}
                <button class="daily__retry" type="button" @click="load">Try again</button>
            </p>

            <p v-else class="daily__error">{{ isLoading ? "Loading today's Daily…" : 'No Daily available.' }}</p>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Mirrors play.vue's layout — same mobile-first single column, same
// AppHeader-as-direct-child pattern so it sizes by its own max-width rather
// than this page's narrower one.
// flex: 1 0 auto fills app.vue's safe-area-padded shell instead of a
// min-height: 100vh, which (added to that padding) would scroll by the
// notch/home-bar height in the iOS app.
.daily {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1rem 2rem;
}

.daily__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 26rem;
    width: 100%;
}

.daily__header {
    align-self: stretch;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;

    p {
        margin: 0;
    }
}

.daily__title {
    font-size: 1.6rem;
    line-height: 1.05;
    margin: 0.25rem 0 0;
}

// The objective chip: the day's rule in a pitch "board" tile.
.daily__objective {
    align-self: flex-start;
    background-color: var(--color-pitch);
    border-radius: var(--radius-sm);
    color: var(--color-pitch-ink);
    font-family: var(--font-display);
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    padding: 0.3rem 0.65rem;
    text-transform: var(--display-text-transform);
}

.daily__rule {
    font-size: 0.85rem;
    line-height: 1.4;
}

.daily__subline {
    color: var(--color-muted);
    font-size: 0.75rem;
    line-height: 1.4;
}

.daily__pill {
    align-self: flex-start;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.25rem 0.65rem;
}

.daily__pill--ranked {
    background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
}

.daily__pill--pending {
    color: var(--color-muted);
}

.daily__pill--practice,
.daily__pill--archive {
    background-color: var(--color-surface-2);
    color: var(--color-muted);
}

.daily__archive-banner {
    align-items: center;
    align-self: stretch;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    font-size: 0.8rem;
    font-weight: 600;
    gap: 0.5rem;
    justify-content: space-between;
    margin: 0;
    padding: 0 0 0 0.75rem;
}

.daily__archive-link {
    align-items: center;
    color: var(--color-primary);
    display: inline-flex;
    flex-shrink: 0;
    font-weight: 700;
    min-height: var(--tap-min);
    padding: 0 0.75rem;
}

.daily__new-out {
    align-items: center;
    align-self: stretch;
    background-color: var(--color-bib);
    border: 0;
    border-radius: var(--radius-stub);
    color: var(--color-on-bib);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-weight: 700;
    gap: 0.4rem;
    justify-content: center;
    min-height: 3rem;
}

// Pending bust: slate (a bust is never red), with the bench as the way back.
.daily__bust {
    align-self: stretch;
    background-color: color-mix(in srgb, var(--color-bust) 14%, var(--color-surface));
    border: 1px solid var(--color-bust);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.75rem;
}

.daily__bust-text {
    font-size: 0.92rem;
    font-weight: 700;
    margin: 0;
}

.daily__bust-actions {
    display: flex;
    gap: 0.5rem;
}

.daily__bust-bench,
.daily__bust-take {
    border-radius: var(--radius-md);
    cursor: pointer;
    flex: 1 1 0;
    font: inherit;
    font-weight: 700;
    min-height: var(--tap-min);
}

.daily__bust-bench {
    background-color: var(--color-bib);
    border: 0;
    color: var(--color-on-bib);
}

.daily__bust-take {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    color: var(--color-foreground);
}

.daily__bust-bench[aria-disabled='true'],
.daily__bust-take[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
}

.daily__helps {
    align-self: stretch;
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1.4fr 1fr;
}

.daily__help {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    gap: 0.45rem;
    min-height: var(--tap-min);
    min-width: 0;
    padding: 0.4rem 0.7rem;
    text-align: left;
}

.daily__help:not([aria-disabled='true']):hover,
.daily__help:focus-visible {
    border-color: var(--color-bib);
}

.daily__help[aria-disabled='true'] {
    cursor: default;
}

.daily__help[aria-disabled='true']:not(.daily__help--set) {
    opacity: 0.5;
}

.daily__help-text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.daily__help-armband,
.daily__help-icon {
    align-items: center;
    border-radius: var(--radius-sm);
    display: inline-flex;
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 900;
    height: 1.3rem;
    justify-content: center;
    width: 1.3rem;
}

.daily__help-armband {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
    font-family: var(--font-display);
}

.daily__help-icon {
    background-color: var(--color-surface-2);
    color: var(--color-primary);
}

.daily__board {
    aspect-ratio: 2 / 3;
    margin-top: 0.25rem;
    position: relative;
    width: 100%;
}

.daily__links {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
}

.daily__link {
    align-items: center;
    background: none;
    border: 0;
    border-radius: var(--radius-sm);
    color: var(--color-primary);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    font-size: 0.88rem;
    font-weight: 700;
    gap: 0.35rem;
    min-height: var(--tap-min);
    padding: 0 0.75rem;
    text-decoration: none;
}

.daily__error {
    color: var(--color-muted);
    padding-top: 3rem;
    text-align: center;
}

.daily__retry {
    background-color: var(--color-bib);
    border: 0;
    border-radius: var(--radius-md);
    color: var(--color-on-bib);
    cursor: pointer;
    display: block;
    font: inherit;
    font-weight: 700;
    margin: 1rem auto 0;
    min-height: var(--tap-min);
    padding: 0 1.25rem;
}

// Errors are amber, never red (red is celebratory in Bib & Board).
.daily__draw-error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    color: var(--color-foreground);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0;
    padding: 0.6rem 0.75rem;
    text-align: center;
    width: 100%;
}
</style>
