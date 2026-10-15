<script setup lang="ts">
import type { GameStatus, Objective } from '../../shared/types';

const props = defineProps<{
    target: number;
    total: number;
    remainingSlots: number;
    status: GameStatus;
    /** Set only for a Daily Challenge — swaps the "Target" label/progress-bar semantics for the day's rotating objective. */
    objective?: Objective;
    /** Daily 2.0: what the game would score if it ended now (out of 1,000). null/absent hides it. */
    projected?: number | null;
    /** Daily 2.0: the objective is already shown above the bar, so label the number by kind ("Target", "Beat", "Under", "Each under") instead of repeating it. */
    compact?: boolean;
}>();

const COMPACT_LABEL = { exact: 'Target', over: 'Beat', under: 'Under', allUnder: 'Each under' } as const;

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

const targetLabel = computed(() => {
    if (props.objective && props.compact) {
        return COMPACT_LABEL[props.objective.kind];
    }

    return props.objective ? props.objective.label : 'Target';
});
const targetValue = computed(() => (props.objective && props.objective.kind !== 'exact' && !props.compact ? null : objectiveValue.value));

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
                <span v-if="targetValue !== null" class="score-bar__value score-bar__value--target">{{ targetValue }}</span>
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
                <span v-if="projected !== null && projected !== undefined" class="score-bar__projected">
                    Projected <b>{{ projected }}</b>
                </span>
            </div>

            <div class="score-bar__item">
                <span class="score-bar__label">{{ remainingLabel }}</span>
                <span class="score-bar__value">{{ remainingSlots }}</span>
            </div>
        </div>

        <div v-if="showProgressBar" aria-hidden="true" class="score-bar__track">
            <div
                class="score-bar__fill"
                :class="{ 'score-bar__fill--bust': status === 'bust', 'score-bar__fill--won': status === 'won' }"
                :style="{ width: `${progress}%` }"
            />
        </div>
    </div>
</template>

<style lang="scss" scoped>
// "Bib & Board" scoreboard: one flat card split into three hairline-divided
// cells (Target / Total / Remaining), with a thin progress track under it —
// the handbook's pitch-screen mockup. The target is the one number in red:
// it's what the whole game is aiming at.
.score-bar {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
}

.score-bar__row {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-wrap: wrap;
    overflow: hidden;
}

.score-bar__item {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.6rem 0.85rem;
}

.score-bar__item + .score-bar__item {
    border-left: 1px solid var(--color-line);
}

// The 'allUnder' daily objective has no single target number, so its label
// (the full objective sentence) needs more breathing room than a 3-column
// row gives — it takes over the top row instead of sitting alongside
// Total/Unfilled.
.score-bar__item--wide {
    border-bottom: 1px solid var(--color-line);
    flex-basis: 100%;
    order: -1;
}

.score-bar__item--wide + .score-bar__item {
    border-left: 0;
}

.score-bar__label {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.score-bar__item--wide .score-bar__label {
    color: var(--color-foreground);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
}

.score-bar__value {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 1;
}

.score-bar__projected {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 600;
    white-space: nowrap;

    b {
        color: var(--color-foreground);
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
    }
}

.score-bar__value--target {
    color: var(--color-bib);
}

.score-bar__track {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-pill);
    height: 0.35rem;
    overflow: hidden;
    width: 100%;
}

.score-bar__fill {
    background-color: var(--color-primary);
    border-radius: inherit;
    height: 100%;
    transition: width 0.3s ease, background-color 0.2s ease;
}

// Exact hit: the bar fills in bib red. Going over is slate, never red —
// red is celebratory in this design.
.score-bar__fill--won {
    background-color: var(--color-bib);
}

.score-bar__fill--bust {
    background-color: var(--color-bust);
}

@media (prefers-reduced-motion: reduce) {
    .score-bar__fill {
        transition: none;
    }
}
</style>
