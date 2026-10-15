<script setup lang="ts">
// The stats as a page: the desktop rail's Stats item links here (a rail
// item needs a route to light up). Same body as StatsDialog (StatsContent).
// Phone and tablet keep the dialog from the header buttons; this route
// still works there as a plain page with a back pill.
import { trackEvent } from '../utils/analytics';

usePageSeoMeta({
    title: 'Your stats — Exact XI',
    description: 'Your Exact XI results table, Daily streaks and achievements.',
});

useHead({ meta: [{ name: 'robots', content: 'noindex' }] });

// The rail sets this just before navigating here; anything else is direct.
const navSource = useState<string>('exact-xi-nav-source', () => '');

onMounted(() => {
    trackEvent('view_stats_page', { source: navSource.value === 'rail' ? 'rail' : 'direct' });
    navSource.value = '';
});
</script>

<template>
    <main class="stats-page">
        <AppHeader>
            <NuxtLink class="app-header-back stats-page__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
        </AppHeader>

        <div class="stats-page__inner">
            <h1>Your stats</h1>

            <div class="stats-page__card">
                <StatsContent layout="page" />
            </div>
        </div>
    </main>
</template>

<style lang="scss" scoped>
// Same reading-page frame as how-to-play.vue: the stats sit on one surface
// card. AppHeader is a direct child so it keeps its own width.
.stats-page {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 1rem 5.5rem;
}

.stats-page__inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0 auto;
    max-width: var(--page-max);
    width: 100%;
}

// The back pill's look comes from AppHeader (.app-header-back).
.stats-page__back {
    margin-right: auto;
}

h1 {
    margin: 0;
}

.stats-page__card {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    padding: 1.25rem;
}

@media (width >= 30rem) {
    .stats-page__card {
        padding: 1.5rem;
    }
}

@media (width >= 1024px) {
    .stats-page {
        padding: 2rem 2rem 5.5rem;
    }
}
</style>
