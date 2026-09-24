<script setup lang="ts">
import type { GameStatus, Objective } from '../../shared/types';

const props = defineProps<{
    target: number;
    total: number;
    remainingSlots: number;
    status: GameStatus;
    /** Set only for a Daily Challenge — swaps the "Target" label/progress-bar semantics for the day's rotating objective. */
    objective?: Objective;
}>();

// Every objective kind except 'allUnder' still boils down to "compare the
// running total against one number" — allUnder's win condition is per-player
// instead, so there's no single total-vs-value bar to draw for it.
const objectiveValue = computed(() => props.objective?.value ?? props.target);
const showProgressBar = computed(() => props.objective?.kind !== 'allUnder');

// Decorative only — the numbers above already carry the accessible state via
// the aria-live region, so this bar is aria-hidden rather than adding a
// second, potentially-conflicting accessible representation.
const progress = computed(() => (
    showProgressBar.value && objectiveValue.value > 0 ? Math.min(100, (props.total / objectiveValue.value) * 100) : 0
));

const targetLabel = computed(() => (props.objective ? props.objective.label : 'Target'));
const targetValue = computed(() => (props.objective && props.objective.kind !== 'exact' ? null : objectiveValue.value));

// "Remaining" implies more picks are still possible — once the game has
// ended (win, bust, or finished), the same count is unfilled slots, not
// slots still up for grabs.
const remainingLabel = computed(() => (props.status === 'playing' ? 'Remaining' : 'Unfilled'));
</script>

<template>
    <div class="score-bar">
        <div class="score-bar__row">
            <div class="score-bar__item" :class="{ 'score-bar__item--wide': targetValue === null }">
                <span class="score-bar__label">{{ targetLabel }}</span>
                <span v-if="targetValue !== null" class="score-bar__value">{{ targetValue }}</span>
            </div>

            <!--
                No aria-live here: `total` only ever changes while
                PlayerChoiceDialog is open as a modal <dialog>, which makes
                everything outside it (this bar included) inert and excluded
                from the accessibility tree. The equivalent announcement is
                made from inside that dialog instead — see its
                `.player-choice__sr-announcement`.
            -->
            <div class="score-bar__item">
                <span class="score-bar__label">Total</span>
                <span class="score-bar__value">{{ total }}</span>
            </div>

            <div class="score-bar__item">
                <span class="score-bar__label">{{ remainingLabel }}</span>
                <span class="score-bar__value">{{ remainingSlots }}</span>
            </div>
        </div>

        <div v-if="showProgressBar" aria-hidden="true" class="score-bar__track">
            <div
                class="score-bar__fill"
                :class="{ 'score-bar__fill--bust': status === 'bust' }"
                :style="{ width: `${progress}%` }"
            />
        </div>
    </div>
</template>

<style lang="scss" scoped>
.score-bar {
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.75rem 1.25rem;
    width: 100%;
}

.score-bar__row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: space-between;
}

.score-bar__item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    text-align: center;
}

// The 'allUnder' daily objective has no single target number, so its label
// (the full objective sentence) needs more breathing room than a 3-column
// row gives — it takes over the row instead of sitting alongside Total/Unfilled.
.score-bar__item--wide {
    flex-basis: 100%;
    order: -1;
}

.score-bar__label {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.score-bar__value {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
}

.score-bar__track {
    background-color: color-mix(in srgb, var(--color-foreground) 12%, transparent);
    border-radius: 999px;
    height: 0.4rem;
    overflow: hidden;
    width: 100%;
}

.score-bar__fill {
    background-color: var(--color-primary);
    border-radius: inherit;
    height: 100%;
    transition: width 0.3s ease, background-color 0.2s ease;
}

.score-bar__fill--bust {
    background-color: var(--color-danger);
}

@media (prefers-reduced-motion: reduce) {
    .score-bar__fill {
        transition: none;
    }
}
</style>
