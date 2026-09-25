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
                {{ CHIP_LETTER[entry.status] }}
            </span>
        </div>
        <p v-else class="daily-streak__empty">Play today's challenge to start your streak.</p>
    </div>

    <div v-else-if="streak > 0" class="daily-streak-badge" :title="`${streak} day streak`">
        <AppIcon name="flame" />
        <span class="daily-streak-badge__count">{{ streak }}</span>
    </div>
</template>

<style lang="scss" scoped>
.daily-streak {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.daily-streak__header {
    align-items: baseline;
    display: flex;
    gap: 0.4rem;
}

.daily-streak__count {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    line-height: 1;
}

.daily-streak__label {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.daily-streak__results {
    display: flex;
    gap: 0.3rem;
}

.daily-streak__chip {
    align-items: center;
    border-radius: var(--radius-sharp);
    display: flex;
    font-size: 0.7rem;
    font-weight: 700;
    height: 1.5rem;
    justify-content: center;
    width: 1.5rem;
}

// Same 3-token palette as StatsDialog's outcome bars — a won day is the
// primary color, a bust is danger, a non-exact "lost" day is a neutral
// in-between (it isn't a failure the way a bust is).
.daily-streak__chip--won {
    background-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
    color: var(--color-primary);
}

.daily-streak__chip--lost {
    background-color: color-mix(in srgb, var(--color-foreground) 12%, transparent);
    color: color-mix(in srgb, var(--color-foreground) 75%, transparent);
}

.daily-streak__chip--bust {
    background-color: color-mix(in srgb, var(--color-danger) 16%, transparent);
    color: var(--color-danger);
}

.daily-streak__empty {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.75rem;
    margin: 0;
}

// Homepage card teaser — pinned to the card's top-right corner (the card is
// DailyStreakStrip's nearest `position: relative` ancestor — see
// index.vue's .daily-card — regardless of how deep this sits in its markup).
.daily-streak-badge {
    align-items: center;
    background-color: var(--color-primary);
    border-radius: var(--radius-sharp);
    color: var(--color-background);
    display: flex;
    gap: 0.2rem;
    padding: 0.2rem 0.4rem;
    position: absolute;
    right: 0.6rem;
    top: 0.6rem;
}

.daily-streak-badge__count {
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    line-height: 1;
}
</style>
