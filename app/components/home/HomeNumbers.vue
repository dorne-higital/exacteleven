<script setup lang="ts">
import { trackEvent } from '../../utils/analytics';

// Desktop-only "Your numbers" card. Local-storage numbers, so a dash until mounted.
const props = defineProps<{ ready: boolean }>();

const { stats } = useStats();

const numbers = computed(() => {
    const s = stats.value;
    const show = (value: number | string) => (props.ready ? String(value) : '—');
    const pct = s.gamesPlayed > 0 ? `${Math.round((s.wins / s.gamesPlayed) * 100)}%` : '0%';

    return [
        { label: 'Played', value: show(s.gamesPlayed) },
        { label: 'Exact wins', value: show(s.wins) },
        { label: 'Win %', value: show(pct) },
        { label: 'Best run', value: show(s.bestExactRun) },
    ];
});

function selectStats(): void {
    trackEvent('view_stats', { source: 'home_numbers' });
}
</script>

<template>
    <section aria-labelledby="home-numbers-title" class="home-numbers">
        <h2 id="home-numbers-title" class="home-numbers__label">Your numbers</h2>
        <dl class="home-numbers__grid">
            <div v-for="item in numbers" :key="item.label" class="home-numbers__item">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
            </div>
        </dl>
        <NuxtLink class="home-numbers__link" to="/stats" @click="selectStats">
            All stats
            <AppIcon name="forward" />
        </NuxtLink>
    </section>
</template>

<style lang="scss" scoped>
.home-numbers {
    display: none;
}

@media (width >= 1024px) {
    .home-numbers {
        background-color: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem 1rem 0.5rem;
    }
}

.home-numbers__label {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
}

.home-numbers__grid {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin: 0;
}

.home-numbers__item {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    padding: 0.5rem 0.65rem;

    dt {
        color: var(--color-muted);
        font-size: 0.72rem;
    }

    dd {
        font-family: var(--font-mono);
        font-size: 1.35rem;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        margin: 0;
    }
}

.home-numbers__link {
    align-items: center;
    align-self: flex-start;
    color: var(--color-primary);
    display: inline-flex;
    font-size: 0.85rem;
    font-weight: 700;
    gap: 0.3rem;
    min-height: var(--tap-min);
    text-decoration: none;

    svg {
        height: 1rem;
        width: 1rem;
    }
}

@media (hover: hover) and (pointer: fine) {
    .home-numbers__link:hover {
        text-decoration: underline;
    }
}
</style>
