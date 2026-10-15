<script setup lang="ts">
import { trackEvent } from '../utils/analytics';
import { recapBars, recapTotalLine } from '../utils/daily-screens';
import { buildWeeklyRecapShareText } from '../utils/share-daily';

// The Sunday recap (DAILY2_SPEC §6.10): your score each day of the week as a
// bar, everyone's median as a dot, the week total and percentile, and a
// "Share my week" text share. "Your week" on Sunday, "Last week" on Monday.
const { weeklyRecap, loadWeeklyRecap, recapAvailable } = useDaily();

const loading = ref(true);

onMounted(async () => {
    loading.value = true;
    await loadWeeklyRecap();
    loading.value = false;

    if (weeklyRecap.value) {
        trackEvent('view_weekly_recap', { week: weeklyRecap.value.start });
    }
});

const title = computed(() => (recapAvailable.value === 'lastWeek' ? 'Last week' : 'Your week'));
const bars = computed(() => (weeklyRecap.value ? recapBars(weeklyRecap.value) : []));
const totalLine = computed(() => (weeklyRecap.value ? recapTotalLine(weeklyRecap.value) : ''));

const copied = ref(false);

async function handleShare(): Promise<void> {
    const recap = weeklyRecap.value;

    if (!recap || !navigator.clipboard?.writeText) {
        return;
    }

    try {
        await navigator.clipboard.writeText(buildWeeklyRecapShareText(recap));
        copied.value = true;
        trackEvent('share_copied', { source: 'weekly_recap', week: recap.start });
        window.setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch {
        // Clipboard blocked: optional, fail quietly.
    }
}
</script>

<template>
    <section class="recap" aria-labelledby="recap-title">
        <h2 id="recap-title" class="recap__title">{{ title }}</h2>

        <p v-if="loading" class="recap__muted">Loading your week…</p>
        <p v-else-if="!weeklyRecap" class="recap__muted">Couldn't load your week. Check back in a bit.</p>

        <template v-else>
            <div class="recap__chart" role="list" aria-label="Your score each day against the median">
                <div v-for="bar in bars" :key="bar.date" class="recap__day" role="listitem" :aria-label="`${bar.day}: ${bar.youLabel}`">
                    <div class="recap__track">
                        <span v-if="bar.youPct !== null" class="recap__bar" :style="{ height: `${Math.max(bar.youPct, 3)}%` }" />
                        <span v-if="bar.medianPct !== null" class="recap__median" :style="{ bottom: `${bar.medianPct}%` }" title="Everyone's median" />
                    </div>
                    <span class="recap__score">{{ bar.youLabel }}</span>
                    <span class="recap__weekday">{{ bar.day }}</span>
                </div>
            </div>

            <p class="recap__legend">
                <span class="recap__legend-bar" /> You
                <span class="recap__legend-dot" /> Everyone's median
            </p>

            <p class="recap__total">{{ totalLine }}</p>

            <button v-if="weeklyRecap.week.you" class="recap__share" type="button" @click="handleShare">
                {{ copied ? 'Copied!' : 'Share my week' }}
            </button>
        </template>
    </section>
</template>

<style lang="scss" scoped>
.recap {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.1rem;
    width: 100%;

    p {
        margin: 0;
    }
}

.recap__title {
    font-size: 1.6rem;
    margin: 0;
}

.recap__muted {
    color: var(--color-muted);
    font-size: 0.88rem;
}

.recap__chart {
    display: grid;
    gap: 0.35rem;
    grid-template-columns: repeat(7, 1fr);
}

.recap__day {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
}

.recap__track {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-sm);
    height: 6rem;
    position: relative;
    width: 100%;
}

.recap__bar {
    background-color: var(--color-primary);
    border-radius: var(--radius-sm);
    bottom: 0;
    left: 18%;
    position: absolute;
    right: 18%;
}

.recap__median {
    background-color: var(--color-foreground);
    border: 2px solid var(--color-surface);
    border-radius: 50%;
    height: 0.55rem;
    left: 50%;
    position: absolute;
    transform: translate(-50%, 50%);
    width: 0.55rem;
}

.recap__score {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.recap__weekday {
    color: var(--color-muted);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.recap__legend {
    align-items: center;
    color: var(--color-muted);
    display: flex;
    font-size: 0.72rem;
    gap: 0.35rem;
}

.recap__legend-bar {
    background-color: var(--color-primary);
    border-radius: 2px;
    height: 0.7rem;
    width: 0.45rem;
}

.recap__legend-dot {
    background-color: var(--color-foreground);
    border-radius: 50%;
    height: 0.5rem;
    margin-left: 0.5rem;
    width: 0.5rem;
}

.recap__total {
    font-size: 1rem;
    font-weight: 700;
}

.recap__share {
    background-color: var(--color-bib);
    border: 0;
    border-radius: var(--radius-stub);
    color: var(--color-on-bib);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    min-height: 3rem;
}
</style>
