<script setup lang="ts">
import type { GameSlot } from '../../shared/types';
import { describeSlotRole, getSlotShortLabel } from '../utils/formations';
import { shortenPlayerName } from '../utils/playerName';

const props = defineProps<{
    slotData: GameSlot;
    /** Disables the slot while a draw is in flight elsewhere, or the game has ended. */
    busy?: boolean;
    /** True while THIS specific slot's draw request is in flight — shows a pulse distinct from every other slot's shared `busy`-disabled look. */
    loading?: boolean;
    /** True once the game has ended — dims a slot that never got filled instead of leaving it looking identically tappable to a normal empty one. */
    gameOver?: boolean;
}>();

const emit = defineEmits<{
    select: [slotId: string];
}>();

const description = computed(() => describeSlotRole(props.slotData.group, props.slotData.side, props.slotData.rowSize));
const shortLabel = computed(() => getSlotShortLabel(props.slotData.group, props.slotData.side, props.slotData.rowSize));
const label = computed(() => (
    props.slotData.player ? `${description.value}, ${props.slotData.player.name}` : `${description.value}, empty`
));
const isEndedEmpty = computed(() => Boolean(props.gameOver) && !props.slotData.player);

function handleClick(): void {
    if (props.slotData.player || props.busy) {
        return;
    }

    emit('select', props.slotData.id);
}
</script>

<template>
    <button
        :aria-label="label"
        :class="[
            'position-slot',
            {
                'position-slot--ended': isEndedEmpty,
                'position-slot--filled': slotData.player,
                'position-slot--loading': loading,
                'position-slot--tight': slotData.rowSize >= 5,
            },
        ]"
        :disabled="Boolean(slotData.player) || busy"
        :style="{ left: `${slotData.x}%`, top: `${slotData.y}%` }"
        type="button"
        @click="handleClick"
    >
        <template v-if="slotData.player">
            <span class="position-slot__total">{{ slotData.player.goals + slotData.player.assists }}</span>
            <span class="position-slot__name">{{ shortenPlayerName(slotData.player.name) }}</span>
        </template>
        <span v-else class="position-slot__group">{{ isEndedEmpty ? '—' : shortLabel }}</span>
    </button>
</template>

<style lang="scss" scoped>
// Slots always sit on top of the pitch's own turf (see Pitch.vue), never
// directly on the page's background — so their colors come from dedicated
// per-theme --slot-* tokens (app.vue) rather than the page-level
// --color-foreground/--color-surface pair, since what reads well on a green
// (Match Programme) or near-black (Dugout Dark) pitch isn't the same as what
// reads well on that theme's page background.
.position-slot {
    align-items: center;
    background-color: var(--slot-empty-bg);
    border: 1.5px dashed var(--slot-empty-border);
    border-radius: 0.625rem;
    color: var(--slot-empty-text);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    font-weight: 700;
    gap: 0.05rem;
    justify-content: center;
    max-width: 5rem;
    min-height: 2.75rem;
    min-width: 3.5rem;
    padding: 0.35rem 0.45rem;
    position: absolute;
    text-align: center;
    transform: translate(-50%, -50%);
}

.position-slot:disabled {
    cursor: default;
}

.position-slot--filled {
    background-color: var(--color-surface);
    border: 1.5px solid var(--color-primary);
    color: var(--slot-filled-text);
}

// 5-wide rows (back-five DEF, or the 5-wide MID row) sit closer together
// than the base max-width allows — capping growth here (rather than the
// usual 5rem a filled slot can reach) keeps neighbouring slots from
// visually overlapping once they show a player name.
.position-slot--tight {
    max-width: 3.5rem;
}

.position-slot--ended {
    opacity: 0.45;
}

@keyframes position-slot-loading-pulse {
    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}

.position-slot--loading {
    animation: position-slot-loading-pulse 0.9s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
    .position-slot--loading {
        animation: none;
        opacity: 0.6;
    }
}

.position-slot__group {
    font-size: 0.7rem;
    letter-spacing: 0.03em;
}

// The total (goals + assists) is the number that matters while playing, so
// it's the prominent display-font value; the name is a small caption below
// it — the reverse of the old name-first layout.
.position-slot__total {
    font-family: var(--font-display);
    font-size: 1.05rem;
    line-height: 1;
}

.position-slot__name {
    font-size: 0.55rem;
    font-weight: 600;
    line-height: 1.1;
    overflow: hidden;
    padding: 0 0.15rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
