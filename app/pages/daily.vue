<script setup lang="ts">
import type { DailyChallengePayload } from '../composables/useGame';
import { trackEvent } from '../utils/analytics';
import { apiErrorMessage, apiFetch, classifyApiError } from '../utils/api';
import { fetchAppConfig } from '../utils/app-config';
import { getFormation } from '../utils/formations';
import { isAppBuild } from '../utils/platform';
import { localDateString, pickDailyDate } from '../utils/trusted-date';

const { state, isDrawing, pendingSlotId, drawError, drawErrorMessage, startDailyGame, resumeDailyGame, openSlot } = useGame();
const { stats } = useStats();

const LOAD_ERROR_FALLBACK = 'Couldn\'t load today\'s challenge.';

// The puzzle rotates on the BROWSER's local calendar date (see
// server/api/daily.get.ts's comment on that trust boundary) — never
// Date.now() baked in anywhere upstream, just this one read. The iOS app
// additionally checks that date against the server's clock (see
// app/utils/trusted-date.ts) so a wound-forward phone clock can't preview a
// future Daily; offline, it falls back to the local date like the web.
async function todayDateString(): Promise<string> {
    const local = localDateString();

    if (!isAppBuild()) {
        return local;
    }

    const config = await fetchAppConfig();

    return pickDailyDate(local, config?.dailyDate);
}

const loading = ref(true);
const loadError = ref(false);
const loadErrorMessage = ref(LOAD_ERROR_FALLBACK);

async function loadDaily(): Promise<void> {
    const date = await todayDateString();

    if (resumeDailyGame(date)) {
        loading.value = false;

        return;
    }

    loading.value = true;
    loadError.value = false;

    try {
        const payload = await apiFetch<DailyChallengePayload>('/api/daily', { query: { date } });

        startDailyGame(payload);
    } catch (error) {
        loadError.value = true;
        loadErrorMessage.value = apiErrorMessage(classifyApiError(error), LOAD_ERROR_FALLBACK, 'try again');
    } finally {
        loading.value = false;
    }
}

// Client-only: the puzzle depends on the browser's local date and a network
// fetch for real player data, neither meaningful during SSR — the same
// "render null, correct once mounted" pattern play.vue uses for
// resumeGame(), just with an extra async step here.
onMounted(() => {
    loadDaily();
});

const formation = computed(() => (state.value ? getFormation(state.value.formationCode) : undefined));
const remainingSlots = computed(() => state.value?.slots.filter((slot) => !slot.player).length ?? 0);
// 'finished' never happens on a daily game (see shared/types.ts's GameStatus)
// — its objective outcome is always won/bust/lost.
const gameOver = computed(() => (
    state.value?.status === 'won' || state.value?.status === 'bust' || state.value?.status === 'lost'
));

function handleSlotSelect(slotId: string): void {
    openSlot(slotId);
}

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
    description: 'A new twist every day — preset formation, a couple of players already locked in, and a rotating objective. Real top-flight players since 2016/17.',
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
            <template v-if="formation && state">
                <h1 class="daily__title">Daily Challenge · {{ formation.code }}</h1>
                <p v-if="state.objective" class="daily__objective">{{ state.objective.label }}</p>

                <ScoreBar
                    :objective="state.objective"
                    :remaining-slots="remainingSlots"
                    :status="state.status"
                    :target="state.target"
                    :total="state.total"
                />

                <WinOddsBanner v-if="!gameOver" />

                <ResultPanel v-if="gameOver" />

                <p v-if="drawError" aria-live="polite" class="daily__draw-error">
                    {{ drawErrorMessage }}
                </p>

                <div class="daily__board">
                    <Pitch />
                    <PositionSlot
                        v-for="slot in state.slots"
                        :key="slot.id"
                        :busy="isDrawing || gameOver"
                        :game-over="gameOver"
                        :active="state.activeSlotId === slot.id"
                        :loading="pendingSlotId === slot.id"
                        :slot-data="slot"
                        @select="handleSlotSelect"
                    />
                </div>

                <PlayerChoiceDialog v-if="state.activeSlotId" />

                <DailyStreakStrip :results="stats.dailyResults" :streak="stats.dailyStreak" />
            </template>

            <p v-else-if="loadError" class="daily__error">
                {{ loadErrorMessage }}
                <button class="daily__retry" type="button" @click="loadDaily">Try again</button>
            </p>

            <p v-else class="daily__error">{{ loading ? "Loading today's challenge…" : 'No challenge available.' }}</p>
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

// The formation as the screen's big display heading, like the handbook's
// pitch mockup ("4-3-3"), left-aligned over the scoreboard.
.daily__title {
    align-self: stretch;
    font-size: 2rem;
    margin: 0.25rem 0 0;
}

.daily__objective {
    align-self: stretch;
    color: var(--color-muted);
    font-weight: 600;
    margin: -0.4rem 0 0;
}

.daily__board {
    aspect-ratio: 2 / 3;
    margin-top: 0.25rem;
    position: relative;
    width: 100%;
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
