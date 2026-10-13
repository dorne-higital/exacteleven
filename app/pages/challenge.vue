<script setup lang="ts">
import type { ChallengePayload } from '../composables/useGame';
import { trackEvent } from '../utils/analytics';
import { apiErrorMessage, apiFetch, classifyApiError } from '../utils/api';
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

const { state, isDrawing, pendingSlotId, drawError, drawErrorMessage, startChallengeGame, resumeChallengeGame, openSlot } = useGame();

const LOAD_ERROR_FALLBACK = 'Couldn\'t load this challenge.';

const loading = ref(true);
const loadError = ref(false);
const loadErrorMessage = ref(LOAD_ERROR_FALLBACK);

async function loadChallenge(): Promise<void> {
    if (resumeChallengeGame(challengeKey.value)) {
        loading.value = false;

        return;
    }

    loading.value = true;
    loadError.value = false;

    try {
        const payload = await apiFetch<ChallengePayload>('/api/challenge', { query: challengeQuery.value });

        startChallengeGame(payload, challengeKey.value);
    } catch (error) {
        loadError.value = true;
        loadErrorMessage.value = apiErrorMessage(classifyApiError(error), LOAD_ERROR_FALLBACK, 'try again');
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

usePageSeoMeta({
    title: 'Custom Challenge — Exact XI',
    description: 'A friend-built board — a chosen formation, objective, and a couple of players already locked in. Real top-flight players since 2016/17.',
});
</script>

<template>
    <main class="challenge">
        <AppHeader>
            <button aria-label="How to play" class="app-header-button" type="button" @click="openInfo">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="app-header-button" type="button" @click="openStats">
                <AppIcon name="stats" />
            </button>
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

                <WinOddsBanner v-if="!gameOver" />

                <ResultPanel v-if="gameOver" />

                <p v-if="drawError" aria-live="polite" class="challenge__draw-error">
                    {{ drawErrorMessage }}
                </p>

                <div class="challenge__board">
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
            </template>

            <p v-else-if="loadError" class="challenge__error">
                {{ loadErrorMessage }}
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
// flex: 1 0 auto fills app.vue's safe-area-padded shell instead of a
// min-height: 100vh, which (added to that padding) would scroll by the
// notch/home-bar height in the iOS app.
.challenge {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1rem 2rem;
}

.challenge__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 26rem;
    width: 100%;
}

// The formation as the screen's big display heading, like the handbook's
// pitch mockup ("4-3-3"), left-aligned over the scoreboard.
.challenge__title {
    align-self: stretch;
    font-size: 2rem;
    margin: 0.25rem 0 0;
}

.challenge__objective {
    align-self: stretch;
    color: var(--color-muted);
    font-weight: 600;
    margin: -0.4rem 0 0;
}

.challenge__board {
    aspect-ratio: 2 / 3;
    margin-top: 0.25rem;
    position: relative;
    width: 100%;
}

.challenge__error {
    color: var(--color-muted);
    padding-top: 3rem;
    text-align: center;
}

.challenge__retry {
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
.challenge__draw-error {
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
