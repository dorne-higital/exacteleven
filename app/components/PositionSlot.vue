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
    /** Daily 2.0: this slot holds the captain's armband (its number counts double). */
    captain?: boolean;
    /** Daily 2.0: the number to show on a filled chip (the day's stat — goals, assists or both). Defaults to goals + assists. */
    value?: number | null;
    /** Daily 2.0: the mystery sub came on in this slot. */
    benched?: boolean;
    /** Daily 2.0: this slot's pick has put you over and the bench decision is pending. */
    pendingBust?: boolean;
    /** Selection mode (naming a captain, choosing who to bench): the slot is tappable even when filled. */
    selectable?: boolean;
    /** In selection mode: this slot can't be chosen (greyed out). */
    selectDisabled?: boolean;
}>();

const emit = defineEmits<{
    select: [slotId: string];
}>();

const description = computed(() => describeSlotRole(props.slotData.group, props.slotData.side, props.slotData.rowSize));
const shortLabel = computed(() => getSlotShortLabel(props.slotData.group, props.slotData.side, props.slotData.rowSize));
const shownValue = computed(() => {
    const player = props.slotData.player;

    if (!player) {
        return null;
    }

    return props.value ?? player.goals + player.assists;
});
const label = computed(() => {
    const extras = [
        props.captain ? 'captain' : null,
        props.benched ? 'came on from the bench' : null,
        props.selectable && props.selectDisabled ? 'unavailable' : null,
    ].filter(Boolean).join(', ');
    const suffix = extras ? `, ${extras}` : '';

    if (!props.slotData.player) {
        return `${description.value}, empty${suffix}`;
    }

    return props.slotData.preset
        ? `${description.value}, ${props.slotData.player.name}, pre-filled for today${suffix}`
        : `${description.value}, ${props.slotData.player.name}${suffix}`;
});
const isEndedEmpty = computed(() => Boolean(props.gameOver) && !props.slotData.player);
// Normally only an empty slot can be tapped; in selection mode (captain /
// bench) any slot can, unless that choice isn't allowed.
const isDisabled = computed(() => (props.selectable ? Boolean(props.selectDisabled) : Boolean(props.slotData.player) || Boolean(props.busy)));

function handleClick(): void {
    if (isDisabled.value) {
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
                'position-slot--selectable': selectable && !selectDisabled,
                'position-slot--select-disabled': selectable && selectDisabled,
                'position-slot--pending-bust': pendingBust,
            },
        ]"
        :disabled="isDisabled"
        :style="{ left: `${slotData.x}%`, top: `${slotData.y}%` }"
        type="button"
        @click="handleClick"
    >
        <template v-if="slotData.player">
            <span class="position-slot__chip">
                <span class="position-slot__total">{{ shownValue }}</span>
                <span v-if="slotData.preset" aria-hidden="true" class="position-slot__preset" title="Pre-filled for today's Daily Challenge">★</span>
                <span v-if="benched" aria-hidden="true" class="position-slot__sub" title="Came on from the bench">⇄</span>
                <span v-if="captain" aria-hidden="true" class="position-slot__armband" title="Captain: counts double">C</span>
            </span>
            <span class="position-slot__name">{{ shortenPlayerName(slotData.player.name) }}</span>
        </template>
        <template v-else>
            <span aria-hidden="true" class="position-slot__chip">
                {{ isEndedEmpty ? '—' : '+' }}
                <span v-if="captain" aria-hidden="true" class="position-slot__armband" title="Blind captain: whoever you pick here counts double">C</span>
            </span>
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

    // One-handed picking: comfortably over the 44px minimum, since the pitch
    // is where most taps land.
    min-height: 3.25rem;
    min-width: 3.25rem;
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
    height: 2.75rem;
    justify-content: center;
    line-height: 1;
    position: relative;
    transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
    width: 2.75rem;
}

.position-slot:not(:disabled, .position-slot--filled):hover .position-slot__chip {
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
        min-width: 2.9rem;
        padding: 0.15rem 0;
    }

    .position-slot--tight .position-slot__chip {
        font-size: 0.85rem;
        height: 2.4rem;
        width: 2.4rem;
    }

    .position-slot--tight .position-slot__name,
    .position-slot--tight .position-slot__group {
        font-size: 0.58rem;
        max-width: 2.85rem;
    }
}

// The captain's armband: a small bib-red "C" (captain-style highlights are
// one of red's allowed uses). Bottom-left so it never collides with the
// locked star (top-right) or the sub marker (bottom-right).
.position-slot__armband {
    align-items: center;
    background-color: var(--color-bib);
    border: 1.5px solid var(--slot-filled-bg);
    border-radius: var(--radius-sm);
    bottom: -0.35rem;
    color: var(--color-on-bib);
    display: flex;
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 900;
    height: 1.05rem;
    justify-content: center;
    left: -0.35rem;
    position: absolute;
    width: 1.05rem;
}

.position-slot__sub {
    align-items: center;
    background-color: var(--color-teal);
    border: 1.5px solid var(--slot-filled-bg);
    border-radius: 50%;
    bottom: -0.3rem;
    color: var(--color-on-primary);
    display: flex;
    font-family: var(--font-body);
    font-size: 0.6rem;
    height: 1rem;
    justify-content: center;
    position: absolute;
    right: -0.3rem;
    width: 1rem;
}

// Selection mode (captain / bench): choosable slots get a solid pitch-ink
// ring so they read as buttons; the rest fade back.
.position-slot--selectable .position-slot__chip {
    box-shadow: 0 0 0 2px var(--color-pitch-ink);
}

.position-slot--selectable:hover .position-slot__chip,
.position-slot--selectable:focus-visible .position-slot__chip {
    box-shadow: 0 0 0 3px var(--color-bib);
}

.position-slot--select-disabled {
    opacity: 0.4;
}

// The pick that put you over, while you decide on the bench: slate, never red.
.position-slot--pending-bust .position-slot__chip {
    background-color: var(--color-bust);
    color: var(--color-background);
}
</style>
