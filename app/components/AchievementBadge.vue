<script setup lang="ts">
import type { AchievementCategory, AchievementRank } from '../utils/achievements';

const props = defineProps<{
    category: AchievementCategory;
    rank: AchievementRank;
    threshold: number;
    unlocked: boolean;
}>();

// A real medal's color says "how rare" independent of the page's own accent,
// so these stay fixed hexes rather than the app's --color-primary token —
// bronze should look like bronze regardless of what the theme's own green
// happens to be.
const RANK_COLORS: Record<AchievementRank, { fill: string; accent: string }> = {
    bronze: { fill: '#8a5a34', accent: '#e3ab73' },
    silver: { fill: '#8b949c', accent: '#eef1f3' },
    gold: { fill: '#a9812a', accent: '#ffd968' },
    emerald: { fill: '#146c43', accent: '#5be8a8' },
    diamond: { fill: '#2f6690', accent: '#9fe8ff' },
};

const LOCKED_COLOR = { fill: '#3a3d3b', accent: '#6f746f' };

const colors = computed(() => (props.unlocked ? RANK_COLORS[props.rank] : LOCKED_COLOR));
</script>

<template>
    <svg aria-hidden="true" class="achievement-badge" viewBox="0 0 64 76" xmlns="http://www.w3.org/2000/svg">
        <path
            :fill="colors.fill"
            d="M32 4 L56 14 L56 38 C56 56 46 66 32 72 C18 66 8 56 8 38 L8 14 Z"
            stroke="rgb(0 0 0 / 20%)"
        />

        <template v-if="!unlocked">
            <rect :fill="colors.accent" height="10" rx="1.5" width="14" x="25" y="26" />
            <path :stroke="colors.accent" d="M27 26 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke-width="2.4" />
        </template>

        <template v-else-if="category === 'gamesPlayed'">
            <circle :stroke="colors.accent" cx="32" cy="28" fill="none" r="12" stroke-width="2" />
            <path :fill="colors.accent" d="M32 20 L37.5 23.8 L35.4 30 L28.6 30 L26.5 23.8 Z" />
        </template>

        <template v-else-if="category === 'gamesWon'">
            <path :fill="colors.accent" d="M23 19 h18 v6 c0 5.5 -4 9 -9 9 s-9 -3.5 -9 -9 z" />
            <path :stroke="colors.accent" d="M23 20 c-4.5 0 -5.5 3.5 -5.5 5.5 s2 5.5 6.5 5.5" fill="none" stroke-width="1.6" />
            <path :stroke="colors.accent" d="M41 20 c4.5 0 5.5 3.5 5.5 5.5 s-2 5.5 -6.5 5.5" fill="none" stroke-width="1.6" />
            <rect :fill="colors.accent" height="4" width="5" x="29.5" y="34" />
            <rect :fill="colors.accent" height="3" rx="1" width="16" x="24" y="38" />
        </template>

        <template v-else-if="category === 'tier'">
            <path
                :fill="colors.accent"
                d="M32 16 L35.3 22.9 42.9 24 37.5 29.3 38.8 36.9 32 33.3 25.2 36.9 26.5 29.3 21.1 24 28.7 22.9 Z"
            />
        </template>

        <template v-else-if="category === 'formationWin'">
            <rect :stroke="colors.accent" fill="none" height="20" rx="2" stroke-width="1.6" width="24" x="20" y="18" />
            <line :stroke="colors.accent" stroke-width="1.2" x1="20" x2="44" y1="28" y2="28" />
            <circle :stroke="colors.accent" cx="32" cy="28" fill="none" r="4" stroke-width="1.2" />
            <circle :fill="colors.accent" cx="26" cy="34" r="1.6" />
            <circle :fill="colors.accent" cx="38" cy="34" r="1.6" />
            <circle :fill="colors.accent" cx="32" cy="21" r="1.6" />
        </template>

        <template v-else>
            <path
                :fill="colors.accent"
                d="M32 16 c2 5 8 7 8 13.5 c0 5.2 -3.6 9.5 -8 9.5 s-8 -4.3 -8 -9.5 c0 -1.8 0.8 -3.2 1.8 -4.5 c0.2 3 2 4.8 3.4 4.8 c-0.8 -4.3 1.3 -8 2.8 -13.3 Z"
            />
        </template>

        <text class="achievement-badge__count" :fill="colors.accent" text-anchor="middle" x="32" y="63">{{ threshold }}</text>
    </svg>
</template>

<style lang="scss" scoped>
.achievement-badge {
    display: block;
    height: 3.25rem;
    width: 2.75rem;
}

.achievement-badge__count {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
}
</style>
