<script setup lang="ts">
import { trackEvent } from '../../utils/analytics';

// Desktop-only "Today" card on the Matchday grid. The numbers come from this
// device's storage, so they show a dash until the page has mounted.
defineProps<{
    ready: boolean;
    title: string;
    detail: string;
    playedStreak: number;
    winStreak: number;
}>();

function selectDaily(): void {
    trackEvent('view_daily_challenge', { source: 'home_glance' });
}
</script>

<template>
    <section aria-labelledby="home-glance-title" class="home-glance">
        <h2 id="home-glance-title" class="home-glance__label">Today</h2>
        <NuxtLink class="home-glance__link" to="/daily" @click="selectDaily">
            <span class="home-glance__eyebrow">Daily</span>
            <span class="home-glance__title">{{ title }}</span>
            <span class="home-glance__detail">{{ detail }}</span>
            <AppIcon class="home-glance__arrow" name="forward" />
        </NuxtLink>
        <dl class="home-glance__streaks">
            <div>
                <dt>Played streak</dt>
                <dd><AppIcon name="flame" />{{ ready ? playedStreak : '—' }}</dd>
            </div>
            <div>
                <dt>Wins in a row</dt>
                <dd>{{ ready ? winStreak : '—' }}</dd>
            </div>
        </dl>
    </section>
</template>

<style lang="scss" scoped>
.home-glance {
    display: none;
}

@media (width >= 1024px) {
    .home-glance {
        background-color: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 1rem;
    }
}

.home-glance__label,
.home-glance__eyebrow {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
}

.home-glance__link {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    display: grid;
    gap: 0.15rem 0.75rem;
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: var(--tap-min);
    padding: 0.75rem 0.85rem;
    text-decoration: none;
    transition: border-color 0.15s ease;
}

.home-glance__eyebrow,
.home-glance__title,
.home-glance__detail {
    grid-column: 1;
}

.home-glance__title {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 900;
    line-height: 1.05;
    text-transform: var(--display-text-transform);
}

.home-glance__detail {
    color: var(--color-muted);
    font-size: 0.8rem;
}

.home-glance__arrow {
    align-self: center;
    color: var(--color-primary);
    grid-column: 2;
    grid-row: 1 / span 3;
}

@media (hover: hover) and (pointer: fine) {
    .home-glance__link:hover {
        border-color: var(--color-primary);
    }
}

.home-glance__streaks {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr;
    margin: 0;

    dt {
        color: var(--color-muted);
        font-size: 0.72rem;
    }

    dd {
        align-items: center;
        display: flex;
        font-family: var(--font-mono);
        font-size: 1.25rem;
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        gap: 0.25rem;
        margin: 0;
    }

    svg {
        color: var(--color-muted);
        height: 1rem;
        width: 1rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .home-glance__link {
        transition: none;
    }
}
</style>
