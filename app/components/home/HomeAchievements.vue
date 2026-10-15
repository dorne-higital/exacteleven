<script setup lang="ts">
import { trackEvent } from '../../utils/analytics';
import { getAchievementProgress } from '../../utils/achievements';

// Desktop-only badge summary: progress bar plus the three locked badges
// closest to unlocking. Local-storage numbers, so a dash until mounted.
const props = defineProps<{ ready: boolean }>();

const { stats } = useStats();

const progress = computed(() => getAchievementProgress(stats.value));
const unlocked = computed(() => progress.value.filter((item) => item.unlocked).length);
const total = computed(() => progress.value.length);
const pct = computed(() => (props.ready && total.value > 0 ? Math.round((unlocked.value / total.value) * 100) : 0));

const next = computed(() => {
    if (!props.ready) {
        return [];
    }

    return progress.value
        .filter((item) => !item.unlocked)
        .map((item) => ({ item, ratio: Math.min(1, item.current / item.def.threshold) }))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 3);
});

function selectAll(): void {
    trackEvent('view_stats', { source: 'home_achievements' });
}
</script>

<template>
    <section aria-labelledby="home-ach-title" class="home-ach">
        <h2 id="home-ach-title" class="home-ach__label">Achievements</h2>
        <p class="home-ach__count">
            <strong>{{ ready ? unlocked : '—' }}</strong> of {{ total }} badges
        </p>
        <div
            aria-label="Badges unlocked"
            :aria-valuenow="pct"
            aria-valuemax="100"
            aria-valuemin="0"
            class="home-ach__bar"
            role="progressbar"
        >
            <span class="home-ach__fill" :style="{ width: `${pct}%` }" />
        </div>
        <p v-if="next.length" class="home-ach__next-label">Closest next</p>
        <ul v-if="next.length" class="home-ach__list">
            <li v-for="{ item, ratio } in next" :key="item.def.id" class="home-ach__item">
                <AchievementBadge
                    :category="item.def.category"
                    :rank="item.def.rank"
                    :threshold="item.def.threshold"
                    :unlocked="false"
                />
                <span class="home-ach__text">
                    <span class="home-ach__name">{{ item.def.label }}</span>
                    <span class="home-ach__desc">{{ item.def.description }}</span>
                    <span class="home-ach__mini" aria-hidden="true">
                        <span :style="{ width: `${Math.round(ratio * 100)}%` }" />
                    </span>
                    <span class="home-ach__progress">{{ Math.min(item.current, item.def.threshold) }} / {{ item.def.threshold }}</span>
                </span>
            </li>
        </ul>
        <NuxtLink class="home-ach__link" :to="{ path: '/stats', hash: '#achievements' }" @click="selectAll">
            All badges
            <AppIcon name="forward" />
        </NuxtLink>
    </section>
</template>

<style lang="scss" scoped>
.home-ach {
    display: none;
}

@media (width >= 1024px) {
    .home-ach {
        background-color: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-card);
        box-shadow: var(--shadow-sm);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 1rem 1rem 0.5rem;
    }
}

.home-ach__label,
.home-ach__next-label {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
}

.home-ach__next-label {
    margin-top: 0.4rem;
}

.home-ach__count {
    font-size: 0.9rem;
    margin: 0;

    strong {
        font-family: var(--font-mono);
        font-size: 1.35rem;
    }
}

.home-ach__bar,
.home-ach__mini {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-pill);
    display: block;
    height: 0.5rem;
    overflow: hidden;
}

.home-ach__mini {
    height: 0.3rem;
    margin-top: 0.2rem;
}

.home-ach__fill,
.home-ach__mini > span {
    background-color: var(--color-primary);
    display: block;
    height: 100%;
}

.home-ach__list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.home-ach__item {
    align-items: center;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: 2.5rem minmax(0, 1fr);

    svg {
        height: auto;
        width: 2.5rem;
    }
}

.home-ach__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.home-ach__name {
    font-size: 0.88rem;
    font-weight: 700;
}

.home-ach__desc,
.home-ach__progress {
    color: var(--color-muted);
    font-size: 0.75rem;
    line-height: 1.3;
}

.home-ach__progress {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
}

.home-ach__link {
    align-items: center;
    align-self: flex-start;
    color: var(--color-primary);
    display: inline-flex;
    font-size: 0.85rem;
    font-weight: 700;
    gap: 0.3rem;
    margin-top: auto;
    min-height: var(--tap-min);
    text-decoration: none;

    svg {
        height: 1rem;
        width: 1rem;
    }
}

@media (hover: hover) and (pointer: fine) {
    .home-ach__link:hover {
        text-decoration: underline;
    }
}
</style>
