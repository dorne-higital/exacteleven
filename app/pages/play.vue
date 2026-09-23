<script setup lang="ts">
import { getFormation } from '../utils/formations';

const route = useRoute();
const formationCode = computed(() => String(route.query.f ?? ''));
const formation = computed(() => getFormation(formationCode.value));

const { state, isDrawing, pendingSlotId, drawError, startGame, resumeGame, openSlot } = useGame();

// Only (re)start when there's no game yet, or it's for a different formation
// than this route asks for — revisiting the same formation keeps whatever
// progress is already in state rather than wiping it out. This runs
// server-side too (sessionStorage isn't available there), so it always
// produces a fresh game on first render — resumeGame() below corrects that
// client-side once mounted, same flash-then-correct pattern useTheme uses.
if (formation.value && state.value?.formationCode !== formation.value.code) {
    startGame(formation.value.code);
}

// A hard refresh mid-game re-runs the block above and would otherwise wipe
// every filled slot — this restores whatever was persisted for the current
// formation, if anything was.
onMounted(() => {
    if (formation.value) {
        resumeGame(formation.value.code);
    }
});

const remainingSlots = computed(() => state.value?.slots.filter((slot) => !slot.player).length ?? 0);
const gameOver = computed(() => (
    state.value?.status === 'won' || state.value?.status === 'bust' || state.value?.status === 'finished'
));

function handleSlotSelect(slotId: string): void {
    openSlot(slotId);
}

const infoOpen = ref(false);
const statsOpen = ref(false);

useSeoMeta({
    title: () => (formation.value ? `${formation.value.code} formation — Exact XI` : 'Exact XI'),
    description: () => (formation.value
        ? `Fill the ${formation.value.code} XI and try to land your total goals plus assists exactly on ${formation.value.target} — real top-flight players since 2016/17.`
        : 'A line-up guessing game for England\'s top-flight football since 2016/17.'),
    ogTitle: () => (formation.value ? `${formation.value.code} formation — Exact XI` : 'Exact XI'),
    ogImage: '/og-image.png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Exact XI logo on a dark background',
    twitterCard: 'summary_large_image',
    twitterImage: '/og-image.png',
});
</script>

<template>
    <main class="play">
        <div class="play__inner">
            <AppHeader>
                <NuxtLink aria-label="Back to formation picker" class="play__back" to="/">
                    <AppIcon name="back" />
                    Formations
                </NuxtLink>
                <button aria-label="How to play" class="play__info-button" type="button" @click="infoOpen = true">
                    <AppIcon name="info" />
                </button>
                <button aria-label="Your stats" class="play__info-button" type="button" @click="statsOpen = true">
                    <AppIcon name="stats" />
                </button>
                <ThemeToggle />
            </AppHeader>

            <template v-if="formation && state">
                <h1 class="play__title">{{ formation.code }} formation</h1>

                <ScoreBar
                    :remaining-slots="remainingSlots"
                    :status="state.status"
                    :target="state.target"
                    :total="state.total"
                />

                <ResultPanel v-if="gameOver" />

                <p v-if="drawError" aria-live="polite" class="play__draw-error">
                    Couldn't load players for that slot — tap it again to retry.
                </p>

                <div class="play__board">
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
            </template>

            <p v-else class="play__error">
                <template v-if="formationCode">"{{ formationCode }}" isn't a valid formation.</template>
                <template v-else>No formation selected.</template>
                <NuxtLink to="/">Pick a formation</NuxtLink>
            </p>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Mobile-first single column. On a desktop-width viewport, .play__inner caps
// out at a comfortable portrait-card width and centers itself, rather than
// letting the title/scorebar/board spread apart across the full viewport.
.play {
    display: flex;
    justify-content: center;
    min-height: 100vh;
    padding: 1.5rem 1.25rem;
}

.play__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 26rem;
    width: 100%;
}

.play__back {
    align-items: center;
    color: inherit;
    display: flex;
    font-size: 0.85rem;
    font-weight: 600;
    gap: 0.4rem;
    margin-right: auto;
    text-decoration: none;
}

.play__back:hover,
.play__back:focus-visible {
    color: var(--color-primary);
}

.play__info-button {
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

.play__info-button:hover,
.play__info-button:focus-visible {
    border-color: var(--color-primary);
}

.play__title {
    margin: 0;
}

.play__board {
    aspect-ratio: 2 / 3;
    position: relative;
    width: 100%;
}

.play__error {
    padding-top: 3rem;
    text-align: center;
}

.play__draw-error {
    background-color: color-mix(in srgb, var(--color-danger) 12%, transparent);
    border-radius: 0.5rem;
    color: var(--color-danger);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0;
    padding: 0.6rem 0.75rem;
    text-align: center;
    width: 100%;
}
</style>
