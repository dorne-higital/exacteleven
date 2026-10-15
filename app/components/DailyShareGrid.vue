<script setup lang="ts">
import type { PositionGroup } from '../../shared/types';
import type { ShareCell } from '../../shared/daily2-types';
import { SHARE_LEVEL_LABEL } from '../utils/daily-screens';

// The share grid as squares on a mini pitch: one per player in formation
// shape (attack at the top), coloured by how much each pick helped, no names
// — the same picture as the emoji text share and the share image.
const props = defineProps<{
    grid: ShareCell[];
}>();

const ORDER: PositionGroup[] = ['FWD', 'MID', 'DEF', 'GK'];

const rows = computed(() => ORDER
    .map((group) => props.grid.filter((cell) => cell.group === group))
    .filter((row) => row.length > 0));

function cellLabel(cell: ShareCell): string {
    return [SHARE_LEVEL_LABEL[cell.level], cell.captain ? 'captain' : null, cell.benched ? 'benched' : null].filter(Boolean).join(', ');
}
</script>

<template>
    <div class="share-grid" role="img" :aria-label="`Share grid: ${grid.map(cellLabel).join('; ')}`">
        <div v-for="(row, index) in rows" :key="index" class="share-grid__row">
            <span
                v-for="cell in row"
                :key="cell.slotId"
                class="share-grid__cell"
                :class="[`share-grid__cell--${cell.level}`, { 'share-grid__cell--benched': cell.benched }]"
            >
                <span v-if="cell.captain" class="share-grid__captain">C</span>
            </span>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.share-grid {
    align-items: center;
    background-color: var(--color-pitch);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.85rem 1rem;
}

.share-grid__row {
    display: flex;
    gap: 0.4rem;
}

.share-grid__cell {
    align-items: center;
    border-radius: 6px;
    box-sizing: border-box;
    display: flex;
    height: 1.6rem;
    justify-content: center;
    position: relative;
    width: 1.6rem;
}

// The text share's colours: 🟥 best, 🟧 good, ⬜ poor, ⬛ bust (slate, never
// red), 🟦 locked, ▫️ empty.
.share-grid__cell--best {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
}

.share-grid__cell--good {
    background-color: var(--color-amber);
    color: var(--color-background);
}

.share-grid__cell--poor {
    background-color: var(--slot-filled-bg);
    color: var(--slot-filled-ink);
}

.share-grid__cell--bust {
    background-color: var(--color-bust);
    color: var(--color-background);
}

.share-grid__cell--locked {
    background-color: var(--color-teal);

    // Teal can sit close to the pitch green in some kits, so a pitch-ink
    // ring keeps the locked squares legible.
    box-shadow: inset 0 0 0 1.5px var(--color-pitch-ink);
    color: var(--color-background);
}

.share-grid__cell--empty {
    border: 1.5px dashed var(--color-pitch-line);
}

.share-grid__cell--benched::after {
    background-color: var(--color-pitch-ink);
    border-radius: 50%;
    bottom: -0.2rem;
    content: '';
    height: 0.4rem;
    position: absolute;
    right: -0.2rem;
    width: 0.4rem;
}

.share-grid__captain {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 900;
    line-height: 1;
}
</style>
