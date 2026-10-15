<script setup lang="ts">
import { dayStatValue } from '#shared/daily2-rules';
import { describeSlotRole } from '../utils/formations';

// "Name your captain" (DAILY2_SPEC §6.4). Every non-locked slot is listed:
// a filled one captains that revealed player (safe), an empty one makes
// whoever gets picked there captain (blind). Slots whose doubled number
// would bust you right now are greyed out ("Would bust you").
const props = defineProps<{
    /** Opened by the last-pick gate rather than the "Make captain" button. */
    gate?: boolean;
}>();

const emit = defineEmits<{
    set: [slotId: string];
}>();

const open = defineModel<boolean>('open', { default: false });

const { state } = useGame();
const { captainOptions, setCaptain, busy, actionError, puzzle } = useDaily();

const pendingId = ref<string | null>(null);
const failed = ref(false);

interface CaptainRow {
    slotId: string;
    role: string;
    name: string;
    value: number | null;
    disabled: boolean;
    wouldBust: boolean;
}

const rows = computed<CaptainRow[]>(() => {
    const game = state.value;
    const stat = puzzle.value?.objective.stat ?? 'ga';

    if (!game) {
        return [];
    }

    return captainOptions.value
        .filter((option) => option.reason !== 'locked')
        .map((option) => {
            const slot = game.slots.find((candidate) => candidate.id === option.slotId)!;

            return {
                slotId: option.slotId,
                role: describeSlotRole(slot.group, slot.side, slot.rowSize),
                name: slot.player ? slot.player.name : 'Empty slot',
                value: slot.player ? dayStatValue(slot.player, stat) : null,
                disabled: option.disabled,
                wouldBust: option.reason === 'would_bust',
            };
        });
});

watch(open, (isOpen) => {
    if (isOpen) {
        failed.value = false;
        pendingId.value = null;
    }
});

async function choose(row: CaptainRow): Promise<void> {
    if (row.disabled || busy.value) {
        return;
    }

    pendingId.value = row.slotId;
    failed.value = false;

    const ok = await setCaptain(row.slotId);

    pendingId.value = null;

    if (ok) {
        open.value = false;
        emit('set', row.slotId);
    } else {
        failed.value = true;
    }
}
</script>

<template>
    <BottomSheet v-model:open="open" eyebrow="Captain" title="Name your captain">
        <p v-if="props.gate" class="captain-sheet__gate">Name your captain before your last pick.</p>
        <p class="captain-sheet__body">
            Their numbers count double. Pick before the reveal for bragging rights, or after for safety. Once named, it's locked.
        </p>

        <ul class="captain-sheet__list">
            <li v-for="row in rows" :key="row.slotId">
                <button
                    :aria-disabled="row.disabled || busy"
                    class="captain-sheet__row"
                    :class="{ 'captain-sheet__row--pending': pendingId === row.slotId }"
                    type="button"
                    @click="choose(row)"
                >
                    <span class="captain-sheet__role">{{ row.role }}</span>
                    <span class="captain-sheet__name">{{ row.name }}</span>
                    <span v-if="row.wouldBust" class="captain-sheet__note">Would bust you</span>
                    <span v-else-if="row.value === null" class="captain-sheet__note">Blind captain</span>
                    <span class="captain-sheet__value">{{ row.value === null ? '??' : `${row.value} ×2` }}</span>
                </button>
            </li>
        </ul>

        <p v-if="failed" aria-live="polite" class="captain-sheet__error">
            {{ actionError === 'network' ? 'Couldn\'t reach the server. Try again.' : 'That captain isn\'t allowed. Pick another.' }}
        </p>
    </BottomSheet>
</template>

<style lang="scss" scoped>
.captain-sheet__gate {
    background-color: color-mix(in srgb, var(--color-bib) 8%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-bib) 40%, transparent);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 700;
    margin: 0 0 0.6rem;
    padding: 0.55rem 0.75rem;
}

.captain-sheet__body {
    color: var(--color-muted);
    font-size: 0.82rem;
    line-height: 1.45;
    margin: 0 0 0.85rem;
}

.captain-sheet__list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.captain-sheet__row {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-sizing: border-box;
    color: inherit;
    cursor: pointer;
    display: grid;
    font: inherit;
    gap: 0.05rem 0.75rem;
    grid-template-columns: 1fr auto;
    min-height: 3.5rem;
    padding: 0.5rem 0.7rem 0.5rem 0.9rem;
    text-align: left;
    width: 100%;
}

.captain-sheet__row:not([aria-disabled='true']):hover,
.captain-sheet__row:focus-visible {
    border-color: var(--color-bib);
}

.captain-sheet__row[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
}

.captain-sheet__row--pending {
    border-color: var(--color-bib);
    opacity: 1;
}

.captain-sheet__role {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    grid-column: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.captain-sheet__name {
    font-size: 0.95rem;
    font-weight: 700;
    grid-column: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.captain-sheet__note {
    color: var(--color-muted);
    font-size: 0.72rem;
    font-weight: 600;
    grid-column: 1;
}

.captain-sheet__value {
    align-items: center;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    grid-column: 2;
    grid-row: 1 / span 3;
    height: 2.4rem;
    justify-content: center;
    min-width: 3.4rem;
    padding: 0 0.4rem;
}

.captain-sheet__error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0.75rem 0 0;
    padding: 0.6rem 0.75rem;
}
</style>
