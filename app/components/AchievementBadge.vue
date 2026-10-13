<script setup lang="ts">
import type { AchievementCategory, AchievementRank } from '../utils/achievements';

const props = defineProps<{
    category: AchievementCategory;
    rank: AchievementRank;
    threshold: number;
    unlocked: boolean;
}>();

// Rank colours live in the stylesheet below as per-rank token pairs (fill +
// ink), built from the app's own Bib & Board tokens, so a badge re-tints
// with light/dark like everything else. A locked badge borrows the empty
// pitch-slot look (dashed hairline, muted ink) rather than a rank colour.
const variant = computed(() => (props.unlocked ? props.rank : 'locked'));
</script>

<template>
    <svg
        aria-hidden="true"
        class="achievement-badge"
        :class="`achievement-badge--${variant}`"
        viewBox="0 0 64 76"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path class="achievement-badge__shield" d="M32 4 L56 14 L56 38 C56 56 46 66 32 72 C18 66 8 56 8 38 L8 14 Z" />
        <path
            class="achievement-badge__trim"
            d="M13 40 L13 17 L32 9 L51 17 L51 40"
            fill="none"
        />

        <template v-if="!unlocked">
            <rect fill="currentColor" height="10" rx="1.5" width="14" x="25" y="26" />
            <path stroke="currentColor" d="M27 26 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke-width="2.4" />
        </template>

        <template v-else-if="category === 'gamesPlayed'">
            <circle stroke="currentColor" cx="32" cy="28" fill="none" r="12" stroke-width="2" />
            <path fill="currentColor" d="M32 20 L37.5 23.8 L35.4 30 L28.6 30 L26.5 23.8 Z" />
        </template>

        <template v-else-if="category === 'gamesWon'">
            <path fill="currentColor" d="M23 19 h18 v6 c0 5.5 -4 9 -9 9 s-9 -3.5 -9 -9 z" />
            <path stroke="currentColor" d="M23 20 c-4.5 0 -5.5 3.5 -5.5 5.5 s2 5.5 6.5 5.5" fill="none" stroke-width="1.6" />
            <path stroke="currentColor" d="M41 20 c4.5 0 5.5 3.5 5.5 5.5 s-2 5.5 -6.5 5.5" fill="none" stroke-width="1.6" />
            <rect fill="currentColor" height="4" width="5" x="29.5" y="34" />
            <rect fill="currentColor" height="3" rx="1" width="16" x="24" y="38" />
        </template>

        <template v-else-if="category === 'tier'">
            <path
                fill="currentColor"
                d="M32 16 L35.3 22.9 42.9 24 37.5 29.3 38.8 36.9 32 33.3 25.2 36.9 26.5 29.3 21.1 24 28.7 22.9 Z"
            />
        </template>

        <template v-else-if="category === 'formationWin'">
            <rect stroke="currentColor" fill="none" height="20" rx="2" stroke-width="1.6" width="24" x="20" y="18" />
            <line stroke="currentColor" stroke-width="1.2" x1="20" x2="44" y1="28" y2="28" />
            <circle stroke="currentColor" cx="32" cy="28" fill="none" r="4" stroke-width="1.2" />
            <circle fill="currentColor" cx="26" cy="34" r="1.6" />
            <circle fill="currentColor" cx="38" cy="34" r="1.6" />
            <circle fill="currentColor" cx="32" cy="21" r="1.6" />
        </template>

        <template v-else>
            <path
                fill="currentColor"
                d="M32 16 c2 5 8 7 8 13.5 c0 5.2 -3.6 9.5 -8 9.5 s-8 -4.3 -8 -9.5 c0 -1.8 0.8 -3.2 1.8 -4.5 c0.2 3 2 4.8 3.4 4.8 c-0.8 -4.3 1.3 -8 2.8 -13.3 Z"
            />
        </template>

        <text class="achievement-badge__count" fill="currentColor" text-anchor="middle" x="32" y="63">{{ threshold }}</text>
    </svg>
</template>

<style lang="scss" scoped>
// Bib & Board medals: a flat shield with a thin inner trim line (the
// tactics-board hairline, stopping above the threshold number), no gradients or drop shadows. Each rank is a
// token pair — --badge-fill for the shield, --badge-ink for the icon and
// number — mapped onto the app's palette so the ladder reads
// bronze -> silver -> gold (amber) -> emerald (pitch green) -> diamond
// (teal), and adapts to dark mode through those tokens. Red is never a
// rank colour: it stays reserved for the exact win and the main CTA.
.achievement-badge {
    --badge-fill: var(--color-surface-2);
    --badge-ink: var(--color-muted);
    --badge-edge: var(--color-line);
    --badge-trim: color-mix(in srgb, var(--badge-ink) 30%, transparent);

    color: var(--badge-ink);
    display: block;
    height: 3.25rem;
    width: 2.75rem;
}

.achievement-badge__shield {
    fill: var(--badge-fill);
    stroke: var(--badge-edge);
    stroke-width: 1;
}

.achievement-badge__trim {
    stroke: var(--badge-trim);
    stroke-width: 1;
}

// Bronze has no app token of its own, so it carries a light/dark pair here.
.achievement-badge--bronze {
    --badge-fill: #9c5a2c;
    --badge-ink: #fff;
}

.achievement-badge--silver {
    --badge-fill: color-mix(in srgb, var(--color-slate) 38%, var(--color-surface-2));
    --badge-ink: var(--color-foreground);
}

.achievement-badge--gold {
    --badge-fill: var(--color-amber);
    --badge-ink: var(--color-surface);
}

.achievement-badge--emerald {
    --badge-fill: var(--color-primary);
    --badge-ink: var(--color-on-primary);
}

.achievement-badge--diamond {
    --badge-fill: var(--color-teal);
    --badge-ink: var(--color-surface);
}

// Locked: the empty-slot language from the pitch — a dashed hairline
// around a quiet surface, so "not yet" never reads as "failed".
.achievement-badge--locked {
    --badge-trim: transparent;
}

.achievement-badge--locked .achievement-badge__shield {
    stroke: color-mix(in srgb, var(--color-muted) 55%, transparent);
    stroke-dasharray: 3 2.5;
    stroke-width: 1.4;
}

@media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) .achievement-badge--bronze {
        --badge-fill: #c98250;
        --badge-ink: #1a0d04;
    }
}

:root[data-theme='dark'] .achievement-badge--bronze {
    --badge-fill: #c98250;
    --badge-ink: #1a0d04;
}

.achievement-badge__count {
    font-family: var(--font-mono);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: -0.02em;
}
</style>
