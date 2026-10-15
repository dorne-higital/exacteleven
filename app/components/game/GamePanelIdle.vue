<script setup lang="ts">
// Desktop panel placeholder while no slot is open (DESKTOP_SPEC §3.2). The
// phone never renders it: its picker is a sheet that is simply closed.
import { trackEvent } from '../../utils/analytics';

const props = defineProps<{ mode: 'classic' | 'daily' | 'challenge' }>();

const { nextEmptySlotId, openSlot } = useGame();
const { finePointer } = useViewport();

function openNext(): void {
    const slotId = nextEmptySlotId();

    if (!slotId) {
        return;
    }

    trackEvent('next_slot_click', { mode: props.mode });
    void openSlot(slotId);
}
</script>

<template>
    <section class="panel-idle" aria-labelledby="panel-idle-title">
        <h2 id="panel-idle-title" class="panel-idle__title">Pick a slot</h2>
        <p class="panel-idle__body">Click any open position on the pitch to see three players.</p>
        <button class="panel-idle__next" type="button" @click="openNext">Next empty slot</button>
        <p v-if="finePointer" aria-hidden="true" class="panel-idle__keys">
            <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> pick · <kbd>R</kbd> reroll · <kbd>Esc</kbd> close
        </p>
    </section>
</template>

<style lang="scss" scoped>
.panel-idle {
    background-color: var(--color-surface);
    border: 1px dashed var(--color-line);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
}

.panel-idle__title {
    font-size: 1.25rem;
    margin: 0;
}

.panel-idle__body {
    color: var(--color-muted);
    font-size: 0.85rem;
    margin: 0;
}

.panel-idle__next {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.88rem;
    font-weight: 700;
    min-height: var(--tap-min);
    padding: 0 1rem;
}

.panel-idle__keys {
    color: var(--color-muted);
    font-size: 0.72rem;
    margin: 0.25rem 0 0;

    kbd {
        background-color: var(--color-surface-2);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: 0.68rem;
        padding: 0 0.3rem;
    }
}

@media (hover: hover) and (pointer: fine) {
    .panel-idle__next:hover {
        border-color: var(--color-primary);
    }
}
</style>
