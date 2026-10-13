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
    /** True while this is the slot being picked for (its choice sheet is open) — the "next" bib-red highlight. */
    active?: boolean;
}>();

const emit = defineEmits<{
    select: [slotId: string];
}>();

const description = computed(() => describeSlotRole(props.slotData.group, props.slotData.side, props.slotData.rowSize));
const shortLabel = computed(() => getSlotShortLabel(props.slotData.group, props.slotData.side, props.slotData.rowSize));
const label = computed(() => {
    if (!props.slotData.player) {
        return `${description.value}, empty`;
    }

    return props.slotData.preset
        ? `${description.value}, ${props.slotData.player.name}, pre-filled for today`
        : `${description.value}, ${props.slotData.player.name}`;
});
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
                'position-slot--active': active || loading,
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
            <span class="position-slot__chip">
                <span class="position-slot__total">{{ slotData.player.goals + slotData.player.assists }}</span>
                <span v-if="slotData.preset" aria-hidden="true" class="position-slot__preset" title="Pre-filled for today's Daily Challenge">★</span>
            </span>
            <span class="position-slot__name">{{ shortenPlayerName(slotData.player.name) }}</span>
        </template>
        <template v-else>
            <span aria-hidden="true" class="position-slot__chip">{{ isEndedEmpty ? '—' : '+' }}</span>
            <span class="position-slot__group">{{ shortLabel }}</span>
        </template>
    </button>
</template>

<style lang="scss" scoped>
// "Bib & Board" slot: a round shirt-number chip sitting on the tactics
// board, with its caption (player name, or the position while empty)
// underneath — the handbook's pitch mockup. The button itself is an
// invisible >=44px hit area around both, centred on the slot's x/y.
// Slots always sit on the pitch (Pitch.vue), never the page background, so
// their colours come from the dedicated --slot-* / --color-pitch-* tokens.
.position-slot {
    align-items: center;
    background: none;
    border: 0;
    color: var(--color-pitch-ink);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    font: inherit;
    gap: 0.2rem;
    justify-content: center;
    min-height: var(--tap-min);
    min-width: var(--tap-min);
    padding: 0.15rem;
    position: absolute;
    text-align: center;
    transform: translate(-50%, -50%);
}

.position-slot:disabled {
    cursor: default;
}

// The global focus ring is pitch green, which vanishes on the pitch — draw
// it in the pitch's own ink around the chip instead.
.position-slot:focus-visible {
    outline: none;
}

.position-slot:focus-visible .position-slot__chip {
    outline: 2px solid var(--color-pitch-ink);
    outline-offset: 2px;
}

.position-slot__chip {
    align-items: center;
    background-color: var(--slot-empty-bg);
    border: 1.5px dashed var(--slot-empty-border);
    border-radius: 50%;
    box-sizing: border-box;
    color: var(--slot-empty-text);
    display: flex;
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 600;
    height: 2.5rem;
    justify-content: center;
    line-height: 1;
    position: relative;
    transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
    width: 2.5rem;
}

.position-slot:not(:disabled):hover .position-slot__chip {
    background-color: rgb(255 255 255 / 16%);
    border-style: solid;
}

.position-slot:not(:disabled):active .position-slot__chip {
    transform: scale(0.94);
}

// A filled slot is a clean white bib with the player's goals + assists as
// its shirt number — the number that matters while playing.
.position-slot--filled .position-slot__chip {
    animation: position-slot-land 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
    background-color: var(--slot-filled-bg);
    border: 0;
    color: var(--slot-filled-ink);
}

// The slot currently being picked for: a filled bib-red chip ringed in the
// pitch ink. Red alone barely separates from green (similar luminance), so
// the white ring is what actually makes it pop.
.position-slot--active .position-slot__chip {
    background-color: var(--slot-next);
    border: 2px solid var(--color-pitch-ink);
    color: var(--color-on-bib);
}

.position-slot--ended {
    opacity: 0.45;
}

@keyframes position-slot-land {
    0% {
        transform: scale(0.6);
    }

    100% {
        transform: scale(1);
    }
}

@keyframes position-slot-loading-pulse {
    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(0.88);
    }
}

.position-slot--loading .position-slot__chip {
    animation: position-slot-loading-pulse 0.9s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
    .position-slot__chip {
        transition: none;
    }

    .position-slot--filled .position-slot__chip,
    .position-slot--loading .position-slot__chip {
        animation: none;
    }

    .position-slot--loading .position-slot__chip {
        opacity: 0.7;
    }
}

.position-slot__total {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.position-slot__name,
.position-slot__group {
    font-size: 0.68rem;
    font-weight: 700;
    line-height: 1.1;
    max-width: 4.75rem;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgb(0 0 0 / 30%);
    white-space: nowrap;
}

.position-slot__group {
    font-family: var(--font-mono);
    letter-spacing: 0.04em;
    opacity: 0.85;
}

// Marks a Daily Challenge slot that started already filled — a small badge
// on the bib's shoulder rather than another line of content.
.position-slot__preset {
    align-items: center;
    background-color: var(--color-primary);
    border: 1.5px solid var(--slot-filled-bg);
    border-radius: 50%;
    color: var(--color-on-primary);
    display: flex;
    font-family: var(--font-body);
    font-size: 0.55rem;
    height: 1rem;
    justify-content: center;
    position: absolute;
    right: -0.3rem;
    top: -0.3rem;
    width: 1rem;
}

// 5-wide rows (back five, or a five-man midfield) sit closer together, so
// their captions are capped tighter to keep neighbours from overlapping.
.position-slot--tight .position-slot__name,
.position-slot--tight .position-slot__group {
    max-width: 3.6rem;
}

// On the narrowest phones (320-400px) five slot centres in a row sit as
// little as ~47px apart: the chips shrink and the captions tighten so the
// centre-to-centre gap stays positive. 4-wide rows already have the slack.
@media (width <= 400px) {
    .position-slot--tight {
        min-width: 2.6rem;
        padding: 0.15rem 0;
    }

    .position-slot--tight .position-slot__chip {
        font-size: 0.85rem;
        height: 2.15rem;
        width: 2.15rem;
    }

    .position-slot--tight .position-slot__name,
    .position-slot--tight .position-slot__group {
        font-size: 0.58rem;
        max-width: 2.85rem;
    }
}
</style>
