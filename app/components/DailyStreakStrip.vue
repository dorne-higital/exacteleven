<script setup lang="ts">
import type { DailyResultEntry } from '../utils/stats-types';

const props = withDefaults(defineProps<{
    streak: number;
    results: DailyResultEntry[];
    /** Homepage teaser: streak count only, no result chips — and renders nothing at all until there's a streak to show. */
    compact?: boolean;
}>(), {
    compact: false,
});

const RESULT_CHIP_LIMIT = 10;

// Oldest-to-newest, left-to-right — a form guide reads that way (most recent
// result on the right), unlike a log/table which reads newest-first.
const recentResults = computed(() => props.results.slice(-RESULT_CHIP_LIMIT));

const CHIP_LETTER: Record<DailyResultEntry['status'], string> = { won: 'W', bust: 'B', lost: 'L' };

function chipLabel(entry: DailyResultEntry): string {
    const status = entry.status === 'won' ? 'Won' : entry.status === 'bust' ? 'Bust' : 'Lost';

    return `${entry.date}: ${status}`;
}
</script>

<template>
    <div v-if="!compact" class="daily-streak">
        <div class="daily-streak__header">
            <AppIcon class="daily-streak__flame" name="flame" />
            <span class="daily-streak__count">{{ streak }}</span>
            <span class="daily-streak__label">day streak</span>
        </div>

        <div v-if="recentResults.length > 0" class="daily-streak__results" role="list">
            <span
                v-for="entry in recentResults"
                :key="entry.date"
                class="daily-streak__chip"
                :class="`daily-streak__chip--${entry.status}`"
                role="listitem"
                :title="chipLabel(entry)"
            >
                <span aria-hidden="true">{{ CHIP_LETTER[entry.status] }}</span>
                <span class="daily-streak__sr">{{ chipLabel(entry) }}</span>
            </span>
        </div>
        <p v-else class="daily-streak__empty">Play today's challenge to start your streak.</p>
    </div>

    <span v-else-if="streak > 0" class="daily-streak-badge">
        <AppIcon class="daily-streak-badge__flame" name="flame" />
        <b class="daily-streak-badge__count">{{ streak }}</b>
        day streak
    </span>
</template>

<style lang="scss" scoped>
// Bib & Board form guide: the streak number in the display face, then the
// last ten Dailies as small square chips in the mono face.
.daily-streak {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.daily-streak__header {
    align-items: center;
    display: flex;
    gap: 0.35rem;
}

.daily-streak__flame {
    color: var(--color-bib);
}

.daily-streak__count {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 1;
}

.daily-streak__label {
    color: var(--color-muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.daily-streak__results {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    justify-content: center;
}

.daily-streak__chip {
    align-items: center;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    box-sizing: border-box;
    display: flex;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    height: 1.75rem;
    justify-content: center;
    width: 1.75rem;
}

// A won Daily is an exact hit — the celebratory red. A bust is slate (never
// red: red means winning here), and a non-exact "lost" day is a quiet
// outline, since it isn't a failure the way a bust is.
.daily-streak__chip--won {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
}

.daily-streak__chip--lost {
    background-color: var(--color-surface-2);
    border-color: var(--color-line);
    color: var(--color-muted);
}

.daily-streak__chip--bust {
    background-color: var(--color-bust);
    color: var(--color-surface);
}

.daily-streak__sr {
    border: 0;
    clip-path: inset(50%);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    white-space: nowrap;
    width: 1px;
}

.daily-streak__empty {
    color: var(--color-muted);
    font-size: 0.8rem;
    margin: 0;
}

// Homepage card teaser: an inline pill (the handbook's "12 day streak"
// chip) that sits in the flow of index.vue's .mode-card__streak slot.
// Transparent over the card's surface: the red count only clears AA
// contrast on --color-surface, not on --color-surface-2.
.daily-streak-badge {
    align-items: center;
    background-color: transparent;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    color: var(--color-foreground);
    display: inline-flex;
    font-size: 0.72rem;
    font-weight: 700;
    gap: 0.25rem;
    line-height: 1;
    padding: 0.3rem 0.55rem 0.3rem 0.45rem;
    white-space: nowrap;
}

.daily-streak-badge__flame,
.daily-streak-badge__count {
    color: var(--color-bib);
}

.daily-streak-badge__count {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
}
</style>
