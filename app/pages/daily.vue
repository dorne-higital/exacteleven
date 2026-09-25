<script setup lang="ts">
import type { DailyChallengePayload } from '../composables/useGame';
import { trackEvent } from '../utils/analytics';
import { getFormation } from '../utils/formations';

const { state, isDrawing, pendingSlotId, drawError, startDailyGame, resumeDailyGame, openSlot } = useGame();
const { stats } = useStats();

// The puzzle rotates on the BROWSER's local calendar date (see
// server/api/daily.get.ts's comment on that trust boundary) — never
// Date.now() baked in anywhere upstream, just this one read.
function todayDateString(): string {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const loading = ref(true);
const loadError = ref(false);

async function loadDaily(): Promise<void> {
    const date = todayDateString();

    if (resumeDailyGame(date)) {
        loading.value = false;

        return;
    }

    loading.value = true;
    loadError.value = false;

    try {
        const payload = await $fetch<DailyChallengePayload>('/api/daily', { query: { date } });

        startDailyGame(payload);
    } catch {
        loadError.value = true;
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
            <button aria-label="How to play" class="daily__info-button" type="button" @click="openInfo">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="daily__info-button" type="button" @click="openStats">
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
                    Couldn't load players for that slot — tap it again to retry.
                </p>

                <div class="daily__board">
                    <Pitch />
                    <PositionSlot
                        v-for="slot in state.slots"
                        :key="slot.id"
                        :busy="isDrawing || gameOver"
                        :game-over="gameOver"
                        :loading="pendingSlotId === slot.id"
                        :slot-data="slot"
                        @select="handleSlotSelect"
                    />
                </div>

                <PlayerChoiceDialog v-if="state.activeSlotId" />

                <DailyStreakStrip :results="stats.dailyResults" :streak="stats.dailyStreak" />
            </template>

            <p v-else-if="loadError" class="daily__error">
                Couldn't load today's challenge.
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
.daily {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 100vh;
    padding: 1.5rem 1.25rem;
}

.daily__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 26rem;
    width: 100%;
}

.daily__info-button {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: var(--radius-sharp);
    color: inherit;
    cursor: pointer;
    display: flex;
    height: 2.75rem;
    justify-content: center;
    padding: 0;
    width: 2.75rem;
}

.daily__info-button:hover,
.daily__info-button:focus-visible {
    border-color: var(--color-primary);
}

.daily__title {
    margin: 0;
}

.daily__objective {
    color: color-mix(in srgb, var(--color-foreground) 75%, transparent);
    font-weight: 600;
    margin: -0.75rem 0 0;
    text-align: center;
}

.daily__board {
    aspect-ratio: 2 / 3;
    position: relative;
    width: 100%;
}

.daily__error {
    padding-top: 3rem;
    text-align: center;
}

.daily__retry {
    background: none;
    border: none;
    color: var(--color-primary);
    cursor: pointer;
    display: block;
    font: inherit;
    font-weight: 700;
    margin: 0.5rem auto 0;
    padding: 0;
    text-decoration: underline;
}

.daily__draw-error {
    background-color: color-mix(in srgb, var(--color-danger) 12%, transparent);
    border-radius: var(--radius-sharp);
    color: var(--color-danger);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0;
    padding: 0.6rem 0.75rem;
    text-align: center;
    width: 100%;
}
</style>
