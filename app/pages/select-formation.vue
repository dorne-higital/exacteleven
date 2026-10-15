<script setup lang="ts">
import { trackEvent } from '../utils/analytics';
import { FORMATION_DIFFICULTY, formations } from '../utils/formations';

function selectFormation(formationCode: string): void {
    trackEvent('select_formation', { formation: formationCode });
}

usePageSeoMeta({
    title: 'Pick a formation — Exact XI',
    description: 'Choose a formation to set your target — its digits become the goals plus assists total you need to land exactly.',
});
</script>

<template>
    <main class="select-formation">
        <AppHeader>
            <NuxtLink class="app-header-back select-formation__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
        </AppHeader>

        <div class="select-formation__inner">
            <div class="select-formation__intro">
                <h1>Pick a formation</h1>
                <p class="select-formation__lede">Its digits are your target: 4-3-3 means land on exactly 433. Odds are for a well-read fan.</p>
            </div>

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
                            <span class="formations__code">{{ formation.code.split('').join('-') }}</span>
                            <span class="formations__rows">{{ formation.rows[0] }} DEF · {{ formation.rows[1] }} MID · {{ formation.rows[2] }} FWD</span>
                            <span class="formations__odds">
                                ≈{{ Math.round(FORMATION_DIFFICULTY[formation.code].exactPct) }}% exact ·
                                {{ Math.round(FORMATION_DIFFICULTY[formation.code].titleOrBetterPct) }}% Title or better
                            </span>
                        </span>
                        <span class="formations__end">
                            <span class="formations__target">{{ formation.target }}</span>
                            <span class="formations__tag" :class="`formations__tag--${FORMATION_DIFFICULTY[formation.code].tier}`">
                                {{ FORMATION_DIFFICULTY[formation.code].label }}
                            </span>
                        </span>
                        <AppIcon class="formations__chevron" name="chevron" />
                    </NuxtLink>
                </li>
            </ul>
        </div>
    </main>
</template>

<style lang="scss" scoped>
// Bib & Board: one full-width card per formation — a mini tactics board,
// the shape and its rows, then the target number (the thing you'll be
// chasing) in mono with the difficulty tag. Difficulty uses green / slate /
// amber, never red (red is celebratory — see app.vue). AppHeader is a
// direct child here (not nested inside .select-formation__inner) so it's
// sized by its own max-width, not this page's — see AppHeader.vue.
.select-formation {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 1rem 5.5rem;
}

.select-formation__inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0 auto;
    max-width: var(--page-max);
    width: 100%;
}

// The back pill's look comes from AppHeader (.app-header-back); this just
// splits it off to the left of the bar.
.select-formation__back {
    margin-right: auto;
}

.select-formation__intro {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

h1 {
    margin: 0;
}

.select-formation__lede {
    color: var(--color-muted);
    font-size: 0.9rem;
    margin: 0;
}

// Single-column stacked list — the direction chosen off the design canvas —
// not a card grid: each formation is a full-width row so it reads the same
// way (one after another) at every viewport width, not fewer/more per row.
.formations {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
    width: 100%;
}

.formations__link {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    color: var(--color-foreground);
    display: flex;
    gap: 0.875rem;
    min-height: var(--tap-min);
    padding: 0.6rem 0.75rem 0.6rem 0.6rem;
    text-align: left;
    text-decoration: none;
    transition: border-color 0.15s ease;
}

.formations__link:hover {
    border-color: var(--color-primary);
}

// Pressed = the active state, so it takes the bib red.
.formations__link:active {
    border-color: var(--color-bib);
}

.formations__details {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
}

.formations__code {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 900;
    letter-spacing: 0.02em;
    line-height: 1;
}

.formations__rows {
    color: var(--color-muted);
    font-size: 0.75rem;
    margin-top: 0.3rem;
}

.formations__odds {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-variant-numeric: tabular-nums;
    margin-top: 0.15rem;
}

.formations__end {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    gap: 0.35rem;
}

.formations__target {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    line-height: 1;
}

.formations__tag {
    border-radius: var(--radius-pill);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 0.2rem 0.55rem;
    text-transform: uppercase;
}

.formations__tag--easier {
    background-color: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--color-primary);
}

.formations__tag--balanced {
    background-color: color-mix(in srgb, var(--color-slate) 14%, transparent);
    color: var(--color-slate);
}

// The amber token is tuned for fills/borders; mixing it with ink keeps the
// small tag text above 4.5:1 in the light scheme.
.formations__tag--hardest {
    background-color: color-mix(in srgb, var(--color-amber) 16%, transparent);
    color: color-mix(in srgb, var(--color-amber) 70%, var(--color-foreground));
}

.formations__chevron {
    color: var(--color-muted);
    flex-shrink: 0;
}

// Tablet: two rows per line. Desktop: cards in an auto-fill grid, easiest
// to hardest, target + difficulty in the top-right corner.
@media (width >= 768px) {
    .formations {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .formations li {
        display: flex;
    }

    .formations__link {
        flex: 1;
        min-width: 0;
    }
}

@media (width >= 1024px) {
    .select-formation {
        padding: 2rem 2rem 5.5rem;
    }

    .select-formation__intro h1 {
        font-size: 2.5rem;
    }

    .formations {
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    }

    .formations__link {
        align-items: flex-start;
        flex-direction: column;
        min-height: 11rem;
        padding: 1rem;
        position: relative;
        transition: border-color 0.15s ease, transform 0.15s ease;
    }

    .formations__link .formation-icon {
        height: 4.8rem;
        width: 4.5rem;
    }

    .formations__end {
        position: absolute;
        right: 1rem;
        top: 1rem;
    }

    .formations__target {
        font-size: 1.35rem;
    }

    .formations__chevron {
        display: none;
    }
}

@media (width >= 1024px) and (hover: hover) and (pointer: fine) {
    .formations__link:hover {
        transform: translateY(-2px);
    }
}

@media (prefers-reduced-motion: reduce) {
    .formations__link {
        transition: none;
    }

    .formations__link:hover {
        transform: none;
    }
}
</style>
