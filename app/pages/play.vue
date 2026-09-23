<script setup lang="ts">
import { getFormation } from '../utils/formations';

const route = useRoute();
const formationCode = computed(() => String(route.query.f ?? ''));
const formation = computed(() => getFormation(formationCode.value));

const { state, isDrawing, startGame, openSlot } = useGame();

// Only (re)start when there's no game yet, or it's for a different formation
// than this route asks for — revisiting the same formation keeps whatever
// progress is already in state rather than wiping it out.
if (formation.value && state.value?.formationCode !== formation.value.code) {
    startGame(formation.value.code);
}

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
                    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
                        <path
                            d="M19 12H5m0 0 7 7m-7-7 7-7"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                        />
                    </svg>
                    Formations
                </NuxtLink>
                <button aria-label="How to play" class="play__info-button" type="button" @click="infoOpen = true">
                    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                        <path d="M12 11v5.5" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
                        <circle cx="12" cy="7.75" fill="currentColor" r="1.15" />
                    </svg>
                </button>
                <button aria-label="Your stats" class="play__info-button" type="button" @click="statsOpen = true">
                    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                        <rect height="8" rx="1" stroke="currentColor" stroke-width="2" width="4" x="4" y="12" />
                        <rect height="12" rx="1" stroke="currentColor" stroke-width="2" width="4" x="10" y="8" />
                        <rect height="16" rx="1" stroke="currentColor" stroke-width="2" width="4" x="16" y="4" />
                    </svg>
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

                <div class="play__board">
                    <Pitch />
                    <PositionSlot
                        v-for="slot in state.slots"
                        :key="slot.id"
                        :busy="isDrawing || gameOver"
                        :slot-data="slot"
                        @select="handleSlotSelect"
                    />
                </div>

                <PlayerChoiceDialog v-if="state.activeSlotId" />
            </template>

            <p v-else class="play__error">
                "{{ formationCode }}" isn't a valid formation.
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
    height: 2.25rem;
    justify-content: center;
    padding: 0;
    width: 2.25rem;
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
</style>
