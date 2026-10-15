<script setup lang="ts">
import type { Player } from '../../shared/types';
import { dayStatValue } from '#shared/daily2-rules';
import { describeSlotRole } from '../utils/formations';

// "Bring on the mystery sub" (DAILY2_SPEC §6.6). Pick one of your own
// revealed players (never a locked one) to take off; the slot's mystery sub
// comes on and is revealed in the same moment. From a pending bust the
// result line says whether that got you back inside the objective.
const open = defineModel<boolean>('open', { default: false });

const { state } = useGame();
const { useBench, pendingBust, busy, actionError, puzzle, snapshot } = useDaily();

interface BenchRow {
    slotId: string;
    role: string;
    name: string;
    value: number;
    busting: boolean;
}

interface SubReveal {
    subName: string;
    outName: string;
    value: number;
    fromBust: boolean;
    rescued: boolean;
}

const reveal = ref<SubReveal | null>(null);
const failed = ref(false);
const pendingId = ref<string | null>(null);

const stat = computed(() => puzzle.value?.objective.stat ?? 'ga');

const rows = computed<BenchRow[]>(() => {
    const game = state.value;

    if (!game) {
        return [];
    }

    return game.slots
        .filter((slot) => slot.player && !slot.preset)
        .map((slot) => ({
            slotId: slot.id,
            role: describeSlotRole(slot.group, slot.side, slot.rowSize),
            name: slot.player!.name,
            value: dayStatValue(slot.player!, stat.value),
            busting: pendingBust.value?.slotId === slot.id,
        }))
        // The pick that put you over first: it's usually the one to take off.
        .sort((a, b) => Number(b.busting) - Number(a.busting));
});

watch(open, (isOpen) => {
    if (isOpen) {
        reveal.value = null;
        failed.value = false;
        pendingId.value = null;
    }
});

async function choose(row: BenchRow): Promise<void> {
    if (busy.value || reveal.value) {
        return;
    }

    const fromBust = !!pendingBust.value;

    pendingId.value = row.slotId;
    failed.value = false;

    const sub: Player | null = await useBench(row.slotId);

    pendingId.value = null;

    if (!sub) {
        failed.value = true;

        return;
    }

    reveal.value = {
        subName: sub.name,
        outName: row.name,
        value: dayStatValue(sub, stat.value),
        fromBust,
        rescued: fromBust && snapshot.value?.status !== 'bust',
    };
}

const resultLine = computed(() => {
    const shown = reveal.value;

    if (!shown) {
        return null;
    }

    if (snapshot.value?.status === 'bust') {
        return 'Still over. That\'s a bust.';
    }

    return shown.fromBust ? 'Back in it!' : null;
});
</script>

<template>
    <BottomSheet v-model:open="open" eyebrow="The bench · −100" title="Bring on the mystery sub">
        <template v-if="!reveal">
            <p class="bench-sheet__body">
                Take one of your players off. A mystery sub comes on: same position, similar numbers. Once a game, −100.
            </p>

            <ul class="bench-sheet__list">
                <li v-for="row in rows" :key="row.slotId">
                    <button
                        :aria-disabled="busy"
                        class="bench-sheet__row"
                        :class="{ 'bench-sheet__row--busting': row.busting, 'bench-sheet__row--pending': pendingId === row.slotId }"
                        type="button"
                        @click="choose(row)"
                    >
                        <span class="bench-sheet__role">{{ row.role }}{{ row.busting ? ' · put you over' : '' }}</span>
                        <span class="bench-sheet__name">{{ row.name }}</span>
                        <span class="bench-sheet__value">{{ row.value }}</span>
                    </button>
                </li>
            </ul>

            <p v-if="failed" aria-live="polite" class="bench-sheet__error">
                {{ actionError === 'network' ? 'Couldn\'t reach the server. Try again.' : 'That swap isn\'t allowed.' }}
            </p>
        </template>

        <div v-else aria-live="polite" class="bench-sheet__reveal" :class="{ 'bench-sheet__reveal--bust': snapshot?.status === 'bust' }">
            <p class="bench-sheet__swap">{{ reveal.subName }} comes on for {{ reveal.outName }}</p>
            <p class="bench-sheet__sub-value">{{ reveal.value }}</p>
            <p v-if="resultLine" class="bench-sheet__result">{{ resultLine }}</p>
            <button class="bench-sheet__continue" type="button" @click="open = false">Continue</button>
        </div>
    </BottomSheet>
</template>

<style lang="scss" scoped>
.bench-sheet__body {
    color: var(--color-muted);
    font-size: 0.82rem;
    line-height: 1.45;
    margin: 0 0 0.85rem;
}

.bench-sheet__list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.bench-sheet__row {
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

.bench-sheet__row:not([aria-disabled='true']):hover,
.bench-sheet__row:focus-visible,
.bench-sheet__row--pending {
    border-color: var(--color-bib);
}

.bench-sheet__row[aria-disabled='true'] {
    cursor: default;
}

// The pick that put you over: slate, like every bust.
.bench-sheet__row--busting {
    border-color: var(--color-bust);
    border-width: 2px;
}

.bench-sheet__role {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    grid-column: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.bench-sheet__name {
    font-size: 0.95rem;
    font-weight: 700;
    grid-column: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bench-sheet__value {
    align-items: center;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    grid-column: 2;
    grid-row: 1 / span 2;
    height: 2.4rem;
    justify-content: center;
    min-width: 3rem;
}

.bench-sheet__row--busting .bench-sheet__value {
    background-color: var(--color-bust);
    color: var(--color-background);
}

.bench-sheet__error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0.75rem 0 0;
    padding: 0.6rem 0.75rem;
}

.bench-sheet__reveal {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.5rem 0 0;
    text-align: center;

    p {
        margin: 0;
    }
}

.bench-sheet__swap {
    font-size: 1rem;
    font-weight: 700;
}

.bench-sheet__sub-value {
    color: var(--color-primary);
    font-family: var(--font-display);
    font-size: 4rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 1;
}

.bench-sheet__reveal--bust .bench-sheet__sub-value {
    color: var(--color-bust);
}

.bench-sheet__result {
    font-size: 0.95rem;
    font-weight: 700;
}

.bench-sheet__continue {
    background-color: var(--color-bib);
    border: 0;
    border-radius: var(--radius-stub);
    color: var(--color-on-bib);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    margin-top: 0.75rem;
    min-height: 3rem;
    width: 100%;
}
</style>
