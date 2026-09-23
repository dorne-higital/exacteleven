<script setup lang="ts">
import type { GameStatus } from '../../shared/types';

const props = defineProps<{
    target: number;
    total: number;
    remainingSlots: number;
    status: GameStatus;
}>();

// Decorative only — the numbers above already carry the accessible state via
// the aria-live region, so this bar is aria-hidden rather than adding a
// second, potentially-conflicting accessible representation.
const progress = computed(() => (props.target > 0 ? Math.min(100, (props.total / props.target) * 100) : 0));

// "Remaining" implies more picks are still possible — once the game has
// ended (win, bust, or finished), the same count is unfilled slots, not
// slots still up for grabs.
const remainingLabel = computed(() => (props.status === 'playing' ? 'Remaining' : 'Unfilled'));
</script>

<template>
    <div class="score-bar">
        <div class="score-bar__row">
            <div class="score-bar__item">
                <span class="score-bar__label">Target</span>
                <span class="score-bar__value">{{ target }}</span>
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

        <div aria-hidden="true" class="score-bar__track">
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
    gap: 1rem;
    justify-content: space-between;
}

.score-bar__item {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    text-align: center;
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
