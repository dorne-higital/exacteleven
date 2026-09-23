<script setup lang="ts">
import type { DrawnPlayer, PositionGroup } from '../../shared/types';

const { state, isDrawing, pickPlayer, useReroll, closeDialog } = useGame();

const candidates = computed(() => state.value?.offeredPlayers ?? []);
const rerollsLeft = computed(() => state.value?.rerollsLeft ?? 0);

// Player data only tracks the broad GK/DEF/MID/FWD group, not real-world
// sub-positions — so a "right-back" slot can just as easily offer a
// left-back or a natural centre-back. The tactical short labels look good
// and stay, but this makes that scope honest instead of silently implied.
const POSITION_NOUNS: Record<PositionGroup, string> = {
    GK: 'goalkeeper',
    DEF: 'defender',
    MID: 'midfielder',
    FWD: 'forward',
};

const positionScopeNote = computed(() => {
    const group = state.value?.slots.find((slot) => slot.id === state.value?.activeSlotId)?.group;
    const noun = group ? POSITION_NOUNS[group] : 'player';

    return `Any real ${noun} can turn up here — not narrowed to this exact tactical slot.`;
});

const dialogRef = ref<HTMLDialogElement | null>(null);
const revealing = ref(false);
const showResult = ref(false);
const revealedName = ref('');
const displayValue = ref(0);

// Purely decorative "reel" text shown in place of each candidate's real name
// and club/era line for a moment before they settle — the real data is
// already in hand from the draw, this is just how it gets revealed. Club
// names are obviously fictional, same spirit as the filler surnames, so
// nobody mistakes either for real information mid-scramble.
const FILLER_SURNAMES = [
    'Whitfield', 'Bergqvist', 'Okafor', 'Marchetti', 'Ivanov',
    'Delacroix', 'Haraldsson', 'Kowalczyk', 'Nakashima', 'Ferreira',
];

const FILLER_CLUBS = [
    'Ashford Rovers', 'Kestrel Town', 'Marlowe Athletic', 'Redgate United',
    'Fenbridge City', 'Harrow Vale', 'Thornfield Wanderers', 'Quarrymoor FC',
];

function randomFiller(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)] ?? '';
}

const displayNames = ref<string[]>([]);
const displayMeta = ref<string[]>([]);
const settled = ref<boolean[]>([]);
const isScrambling = computed(() => settled.value.some((flag) => !flag));

let scrambleIntervals: number[] = [];
let scrambleTimeouts: number[] = [];

function clearScrambleTimers(): void {
    scrambleIntervals.forEach((id) => window.clearInterval(id));
    scrambleTimeouts.forEach((id) => window.clearTimeout(id));
    scrambleIntervals = [];
    scrambleTimeouts = [];
}

// Kicks off the reel effect for a freshly-drawn set of candidates — called on
// both the initial draw and after a reroll. Each option settles on its real
// name one after another, like slot-machine reels landing. Skipped entirely
// under reduced motion, matching animateCountUp's approach below.
function startScramble(items: DrawnPlayer[]): void {
    clearScrambleTimers();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
        displayNames.value = items.map((item) => item.name);
        displayMeta.value = items.map((item) => eraLabel(item));
        settled.value = items.map(() => true);

        return;
    }

    displayNames.value = items.map(() => randomFiller(FILLER_SURNAMES));
    displayMeta.value = items.map(() => randomFiller(FILLER_CLUBS));
    settled.value = items.map(() => false);

    items.forEach((item, index) => {
        const intervalId = window.setInterval(() => {
            displayNames.value[index] = randomFiller(FILLER_SURNAMES);
            displayMeta.value[index] = randomFiller(FILLER_CLUBS);
        }, 60);

        scrambleIntervals.push(intervalId);

        const timeoutId = window.setTimeout(() => {
            window.clearInterval(intervalId);
            displayNames.value[index] = item.name;
            displayMeta.value[index] = eraLabel(item);
            settled.value[index] = true;
        }, 500 + index * 150);

        scrambleTimeouts.push(timeoutId);
    });
}

watch(candidates, (items) => {
    if (items.length > 0) {
        startScramble(items);
    }
}, { immediate: true });

onUnmounted(() => {
    clearScrambleTimers();
});

onMounted(() => {
    dialogRef.value?.showModal();
});

function eraLabel(candidate: DrawnPlayer): string {
    return `${candidate.clubs.join(', ')} · ${candidate.firstSeason}-${candidate.lastSeason}`;
}

function animateCountUp(target: number): Promise<void> {
    return new Promise((resolve) => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduceMotion || target <= 0) {
            displayValue.value = target;
            resolve();

            return;
        }

        const durationMs = 700;
        const start = performance.now();

        function tick(now: number): void {
            const progress = Math.min(1, (now - start) / durationMs);

            displayValue.value = Math.round(target * progress);

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(tick);
    });
}

async function handlePick(candidate: DrawnPlayer): Promise<void> {
    if (revealing.value || isDrawing.value || isScrambling.value) {
        return;
    }

    revealing.value = true;
    revealedName.value = candidate.name;
    displayValue.value = 0;

    const result = await pickPlayer(candidate);

    if (!result) {
        revealing.value = false;

        return;
    }

    showResult.value = true;
    await animateCountUp(result.goals + result.assists);

    window.setTimeout(() => {
        dialogRef.value?.close();
    }, 500);
}

async function handleReroll(): Promise<void> {
    // useReroll() itself also no-ops once rerollsLeft is 0, but aria-disabled
    // (unlike the native disabled attribute) doesn't block the click at the
    // DOM level, so check here too for a clean fast path.
    if (revealing.value || isDrawing.value || isScrambling.value || rerollsLeft.value <= 0) {
        return;
    }

    await useReroll();
}

// Fires on Escape as well as our own programmatic close() above — either way,
// clear the shared game state so play.vue stops rendering this dialog and
// (per the native <dialog> contract) focus returns to the slot that opened it.
function handleNativeClose(): void {
    closeDialog();
}
</script>

<template>
    <dialog ref="dialogRef" class="player-choice" @close="handleNativeClose">
        <div aria-hidden="true" class="player-choice__handle" />

        <h2 class="player-choice__title">Pick a player</h2>

        <p v-if="!showResult" class="player-choice__scope-note">{{ positionScopeNote }}</p>

        <ul v-if="!showResult" class="player-choice__list">
            <li v-for="(candidate, index) in candidates" :key="candidate.id">
                <button
                    class="player-choice__option"
                    :aria-disabled="revealing || isDrawing || isScrambling"
                    :aria-label="settled[index] ? `${candidate.name} — ${eraLabel(candidate)}` : 'Loading option'"
                    :class="{ 'player-choice__option--scrambling': !settled[index] }"
                    type="button"
                    @click="handlePick(candidate)"
                >
                    <span aria-hidden="true" class="player-choice__name">{{ displayNames[index] }}</span>
                    <span aria-hidden="true" class="player-choice__meta">{{ displayMeta[index] }}</span>
                </button>
            </li>
        </ul>

        <div v-else class="player-choice__result">
            <p class="player-choice__result-name">{{ revealedName }}</p>
            <p aria-live="polite" class="player-choice__result-value">{{ displayValue }}</p>
        </div>

        <button
            v-if="!showResult"
            class="player-choice__reroll"
            :aria-disabled="rerollsLeft <= 0 || revealing || isDrawing || isScrambling"
            type="button"
            @click="handleReroll"
        >
            Reroll ({{ rerollsLeft }} left)
        </button>
    </dialog>
</template>

<style lang="scss" scoped>
// Mobile-first bottom sheet: full-width, anchored to the bottom edge, slides
// up on open. `@starting-style` + `allow-discrete` animate the native
// <dialog>'s entry into the top layer — the standard way to transition a
// dialog's open state without giving up showModal()'s built-in focus trap.
.player-choice {
    background-color: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 1rem 1rem 0 0;
    box-shadow: 0 -12px 32px rgb(0 0 0 / 45%);
    color: inherit;
    inset: auto 0 0;
    margin: 0;
    max-height: 85vh;
    overflow-y: auto;
    padding: 0.75rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    position: fixed;
    transform: translateY(0);
    transition: transform 0.28s ease, overlay 0.28s ease allow-discrete, display 0.28s ease allow-discrete;
    width: 100%;
}

@starting-style {
    .player-choice[open] {
        transform: translateY(100%);
    }
}

// Above phone width: a centered, width-capped panel rather than an
// edge-to-edge sheet stretched across a wide viewport — still bottom-anchored
// and still slides up, just reads as a deliberate panel, not a blown-up
// mobile component.
@media (width >= 640px) {
    .player-choice {
        border-radius: 1rem;
        bottom: 2rem;
        left: 50%;
        max-width: 26rem;
        padding-bottom: 1.25rem;
        right: auto;
        transform: translateX(-50%) translateY(0);
        width: calc(100% - 4rem);
    }

    @starting-style {
        .player-choice[open] {
            transform: translateX(-50%) translateY(120%);
        }
    }
}

@media (prefers-reduced-motion: reduce) {
    .player-choice {
        transition: none;
    }
}

// The MP-Picker board's scrim is a translucent --color-primary-strong
// (green-deep), not plain black — color-mix keeps it token-driven.
.player-choice::backdrop {
    background-color: color-mix(in srgb, var(--color-primary-strong) 55%, transparent);
    transition: overlay 0.28s ease allow-discrete, display 0.28s ease allow-discrete, opacity 0.28s ease;
}

.player-choice[open]::backdrop {
    opacity: 1;
}

@starting-style {
    .player-choice[open]::backdrop {
        opacity: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .player-choice::backdrop {
        transition: none;
    }
}

.player-choice__handle {
    background-color: color-mix(in srgb, var(--color-foreground) 25%, transparent);
    border-radius: 999px;
    height: 0.25rem;
    margin: 0 auto 0.75rem;
    width: 2.5rem;
}

@media (width >= 640px) {
    .player-choice__handle {
        display: none;
    }
}

.player-choice__title {
    font-family: var(--font-display);
    font-size: 1rem;
    margin: 0 0 0.4rem;
}

.player-choice__scope-note {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.75rem;
    margin: 0 0 0.9rem;
}

.player-choice__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.player-choice__option {
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 0.5rem;
    color: inherit;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.75rem 1rem;
    text-align: left;
    width: 100%;
}

// aria-disabled, not the native disabled attribute: disabled would blur the
// button the instant a pick starts revealing, which happens well before the
// dialog actually closes — breaking <dialog>'s native restore-focus-on-close
// behavior (it only restores focus if focus is still inside the dialog at
// close time). Staying focusable keeps that native behavior intact.
.player-choice__option[aria-disabled='true'] {
    cursor: default;
    opacity: 0.6;
    pointer-events: none;
}

.player-choice__option:not([aria-disabled='true']):hover,
.player-choice__option:not([aria-disabled='true']):focus-visible {
    border-color: var(--color-primary);
}

.player-choice__name {
    font-weight: 600;
}

.player-choice__option--scrambling .player-choice__name {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
}

.player-choice__meta {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.75rem;
}

.player-choice__result {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1.5rem 0;
}

.player-choice__result-name {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
}

.player-choice__result-value {
    font-family: var(--font-display);
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0;
}

.player-choice__reroll {
    background: none;
    border: none;
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    cursor: pointer;
    font-size: 0.8rem;
    margin-top: 1rem;
    padding: 0;
    text-decoration: underline;
}

.player-choice__reroll[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
    text-decoration: none;
}
</style>
