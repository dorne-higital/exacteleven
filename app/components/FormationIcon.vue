<script setup lang="ts">
import type { Slot } from '../../shared/types';

// Tactics-board mini diagram for the formation picker: one line per pitch
// row depth (GK/DEF/MID/FWD — every formation shares the same four y-values,
// only how many dots sit on each line differs) with a dot per real slot.
// Takes the formation's own already-computed slots (see utils/formations.ts's
// buildSlots) rather than recalculating anything, so it can never drift out
// of sync with the real pitch layout.
defineProps<{
    slots: Slot[];
}>();

const ROW_LINE_Y = [14.28, 27.16, 38.2, 48.32];

// Maps a slot's real 0-100 pitch percentage into this icon's small viewBox,
// with a margin so dots don't sit flush against the edge.
function mapX(x: number): number {
    return 6 + (x / 100) * 44;
}

function mapY(y: number): number {
    return 6 + (y / 100) * 46;
}
</script>

<template>
    <svg aria-hidden="true" class="formation-icon" viewBox="0 0 56 60">
        <line
            v-for="y in ROW_LINE_Y"
            :key="y"
            class="formation-icon__line"
            x1="4"
            x2="52"
            :y1="y"
            :y2="y"
        />
        <circle
            v-for="slot in slots"
            :key="slot.id"
            class="formation-icon__dot"
            :cx="mapX(slot.x)"
            :cy="mapY(slot.y)"
            r="3"
        />
    </svg>
</template>

<style lang="scss" scoped>
.formation-icon {
    flex-shrink: 0;
    height: 3.75rem;
    width: 3.5rem;
}

.formation-icon__line {
    stroke: color-mix(in srgb, var(--color-foreground) 20%, transparent);
    stroke-width: 1;
}

.formation-icon__dot {
    fill: var(--color-primary);
    stroke: var(--color-background);
    stroke-width: 1;
}
</style>
