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
        <span><strong>{{ label }}</strong> ways to win from here</span>
    </p>
</template>

<style lang="scss" scoped>
.win-odds {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
    border-radius: var(--radius-sharp);
    color: inherit;
    display: flex;
    font-size: 0.8rem;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 0.9rem;
    width: 100%;
}

.win-odds__icon {
    color: var(--color-primary);
    flex-shrink: 0;
    height: 1.1rem;
    width: 1.1rem;
}
</style>
