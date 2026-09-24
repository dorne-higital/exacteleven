<script setup lang="ts">
import { trackEvent } from '../utils/analytics';
import { FORMATION_DIFFICULTY, formations } from '../utils/formations';

function selectFormation(formationCode: string): void {
    trackEvent('select_formation', { formation: formationCode });
}

useSeoMeta({
    title: 'Pick a formation — Exact XI',
    description: 'Choose a formation to set your target — its digits become the goals plus assists total you need to land exactly.',
    ogTitle: 'Pick a formation — Exact XI',
    ogImage: '/og-image.png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: 'Exact XI logo on a dark background',
    twitterCard: 'summary_large_image',
    twitterImage: '/og-image.png',
});
</script>

<template>
    <main class="select-formation">
        <AppHeader>
            <NuxtLink class="select-formation__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
            <ThemeToggle />
        </AppHeader>

        <div class="select-formation__inner">
            <h1>Pick a formation</h1>

            <ul class="formations">
                <li v-for="formation in formations" :key="formation.code">
                    <NuxtLink
                        class="formations__link"
                        :class="`formations__link--${FORMATION_DIFFICULTY[formation.code].tier}`"
                        :to="{ path: '/play', query: { f: formation.code } }"
                        @click="selectFormation(formation.code)"
                    >
                        <FormationIcon :slots="formation.slots" />
                        <span class="formations__details">
                            <span class="formations__code">{{ formation.code }}</span>
                            <span class="formations__rows">{{ formation.rows[0] }} DEF · {{ formation.rows[1] }} MID · {{ formation.rows[2] }} FWD</span>
                        </span>
                        <span class="formations__tag" :class="`formations__tag--${FORMATION_DIFFICULTY[formation.code].tier}`">
                            {{ FORMATION_DIFFICULTY[formation.code].label }}
                        </span>
                    </NuxtLink>
                </li>
            </ul>
        </div>
    </main>
</template>

<style lang="scss" scoped>
// AppHeader is a direct child here (not nested inside .select-formation__inner)
// so it's sized by its own max-width, not this page's — see AppHeader.vue for
// why that matters.
.select-formation {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 100vh;
    padding: 1.5rem 1.25rem 2rem;
}

.select-formation__inner {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin: 0 auto;
    max-width: 26rem;
    width: 100%;
}

.select-formation__back {
    align-items: center;
    color: inherit;
    display: flex;
    font-size: 0.85rem;
    font-weight: 600;
    gap: 0.4rem;
    text-decoration: none;
}

.select-formation__back:hover,
.select-formation__back:focus-visible {
    color: var(--color-primary);
}

h1 {
    margin: 0;
}

// Single-column stacked list — the direction chosen off the design canvas —
// not a card grid: each formation is a full-width row so it reads the same
// way (one after another) at every viewport width, not fewer/more per row.
.formations {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
}

.formations__link {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-left: 4px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 0.75rem;
    color: inherit;
    display: flex;
    gap: 0.875rem;
    padding: 0.75rem 1rem;
    text-align: left;
    text-decoration: none;
    transition: border-color 0.15s ease;
}

.formations__link:hover,
.formations__link:focus-visible {
    border-color: var(--color-primary);
}

.formations__link--easier {
    border-left-color: var(--color-primary);
}

.formations__link--hardest {
    border-left-color: var(--color-danger);
}

.formations__details {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
}

.formations__code {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    line-height: 1;
}

.formations__rows {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.75rem;
    margin-top: 0.25rem;
}

.formations__tag {
    border: 1px solid currentcolor;
    border-radius: 999px;
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.6rem;
    text-transform: uppercase;
}

.formations__tag--easier {
    color: var(--color-primary);
}

.formations__tag--balanced {
    color: color-mix(in srgb, var(--color-foreground) 65%, transparent);
}

.formations__tag--hardest {
    color: var(--color-danger);
}

@media (prefers-reduced-motion: reduce) {
    .formations__link {
        transition: none;
    }
}
</style>
