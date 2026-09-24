<script setup lang="ts">
import type { ChallengePayload } from '../composables/useGame';
import { trackEvent } from '../utils/analytics';
import { challengeKeyFromQuery } from '../utils/challenge-config';
import { getFormation } from '../utils/formations';

const route = useRoute();

// The URL's own query params (f/mode/value/preset) ARE the puzzle's identity
// — no id, no storage, matching the Daily Challenge's "the config is the
// seed" trick. Only the params /api/challenge actually reads are included,
// so an unrelated tracking param appended to the link can't fork the key.
const CHALLENGE_PARAMS = ['f', 'mode', 'value', 'preset'] as const;

const challengeQuery = computed<Record<string, string>>(() => {
    const query: Record<string, string> = {};

    for (const key of CHALLENGE_PARAMS) {
        const raw = route.query[key];

        if (typeof raw === 'string' && raw.length > 0) {
            query[key] = raw;
        }
    }

    return query;
});

const challengeKey = computed(() => challengeKeyFromQuery(challengeQuery.value));

const { state, isDrawing, pendingSlotId, drawError, startChallengeGame, resumeChallengeGame, openSlot } = useGame();

const loading = ref(true);
const loadError = ref(false);

async function loadChallenge(): Promise<void> {
    if (resumeChallengeGame(challengeKey.value)) {
        loading.value = false;

        return;
    }

    loading.value = true;
    loadError.value = false;

    try {
        const payload = await $fetch<ChallengePayload>('/api/challenge', { query: challengeQuery.value });

        startChallengeGame(payload, challengeKey.value);
    } catch {
        loadError.value = true;
    } finally {
        loading.value = false;
    }
}

// Client-only, same reasoning as daily.vue: a network fetch for real player
// data isn't meaningful during SSR. Tracked separately from useGame's
// challenge_start/challenge_resume (which only fire once the game state
// actually resolves) so a visit to a link with a malformed/expired config
// still counts as an "open" — this is the number the creator actually wants
// when asking "did anyone open my link".
onMounted(() => {
    if (challengeQuery.value.f) {
        trackEvent('challenge_link_opened', { formation: challengeQuery.value.f, mode: challengeQuery.value.mode ?? 'exact' });
    }

    loadChallenge();
});

const formation = computed(() => (state.value ? getFormation(state.value.formationCode) : undefined));
const remainingSlots = computed(() => state.value?.slots.filter((slot) => !slot.player).length ?? 0);
// 'finished' never happens on an objective-based game (see shared/types.ts's
// GameStatus) — a challenge's outcome is always won/bust/lost, same as Daily.
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
    trackEvent('view_how_to_play', { source: 'challenge' });
}

function openStats(): void {
    statsOpen.value = true;
    trackEvent('view_stats', { source: 'challenge' });
}

useSeoMeta({
    title: 'Custom Challenge — Exact XI',
    description: 'A friend-built board — a chosen formation, objective, and a couple of players already locked in. Real top-flight players since 2016/17.',
    ogTitle: 'Custom Challenge — Exact XI',
    ogImage: '/og-image.png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Exact XI logo on a dark background',
    twitterCard: 'summary_large_image',
    twitterImage: '/og-image.png',
});
</script>

<template>
    <main class="challenge">
        <AppHeader>
            <button aria-label="How to play" class="challenge__info-button" type="button" @click="openInfo">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="challenge__info-button" type="button" @click="openStats">
                <AppIcon name="stats" />
            </button>
            <ThemeToggle />
        </AppHeader>

        <div class="challenge__inner">
            <template v-if="formation && state">
                <h1 class="challenge__title">Challenge · {{ formation.code }}</h1>
                <p v-if="state.objective" class="challenge__objective">{{ state.objective.label }}</p>

                <ScoreBar
                    :objective="state.objective"
                    :remaining-slots="remainingSlots"
                    :status="state.status"
                    :target="state.target"
                    :total="state.total"
                />

                <ResultPanel v-if="gameOver" />

                <p v-if="drawError" aria-live="polite" class="challenge__draw-error">
                    Couldn't load players for that slot — tap it again to retry.
                </p>

                <div class="challenge__board">
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

            <p v-else-if="loadError" class="challenge__error">
                Couldn't load this challenge.
                <button class="challenge__retry" type="button" @click="loadChallenge">Try again</button>
            </p>

            <p v-else-if="!loading" class="challenge__error">
                This challenge link isn't valid.
                <NuxtLink to="/select-formation">Pick a formation</NuxtLink>
            </p>

            <p v-else class="challenge__error">Loading challenge…</p>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Mirrors daily.vue's layout — same mobile-first single column, same
// AppHeader-as-direct-child pattern.
.challenge {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 100vh;
    padding: 1.5rem 1.25rem;
}

.challenge__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 26rem;
    width: 100%;
}

.challenge__info-button {
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

.challenge__info-button:hover,
.challenge__info-button:focus-visible {
    border-color: var(--color-primary);
}

.challenge__title {
    margin: 0;
}

.challenge__objective {
    color: color-mix(in srgb, var(--color-foreground) 75%, transparent);
    font-weight: 600;
    margin: -0.75rem 0 0;
    text-align: center;
}

.challenge__board {
    aspect-ratio: 2 / 3;
    position: relative;
    width: 100%;
}

.challenge__error {
    padding-top: 3rem;
    text-align: center;
}

.challenge__retry {
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

.challenge__draw-error {
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
