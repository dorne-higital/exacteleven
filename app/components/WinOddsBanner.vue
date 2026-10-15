<script setup lang="ts">
// Self-contained (reads useGame() directly) rather than taking props — same
// pattern as ResultPanel/PlayerChoiceDialog, since every page that renders
// this is already inside useGame()'s shared state and there's nothing
// page-specific to configure.
import { formatWinCount } from '../utils/format-count';

const { winOdds } = useGame();

// totalWays === 0 covers both "no data yet" (initial null) and the
// vanishingly-rare real zero (a position pool got fully excluded) — neither
// is worth rendering, so both just hide the banner rather than showing "0".
const label = computed(() => (
    winOdds.value && winOdds.value.totalWays > 0 ? formatWinCount(winOdds.value.waysToWin) : null
));
</script>

<template>
    <p v-if="label" class="win-odds">
        <AppIcon class="win-odds__icon" name="target" />
        <span><strong>{{ label }}</strong> {{ label === '1' ? 'way' : 'ways' }} to win from here</span>
    </p>
</template>

<style lang="scss" scoped>
// A quiet hairline card, not a coloured callout — it's encouragement, not
// an alert. Pitch green marks the icon and the number (secondary emphasis).
.win-odds {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    color: var(--color-muted);
    display: flex;
    font-size: 0.82rem;
    gap: 0.55rem;
    margin: 0;
    padding: 0.6rem 0.85rem;
    width: 100%;
}

.win-odds strong {
    color: var(--color-primary);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.win-odds__icon {
    color: var(--color-primary);
    flex-shrink: 0;
    height: 1.1rem;
    width: 1.1rem;
}
</style>
