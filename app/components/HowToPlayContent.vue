<script setup lang="ts">
// Shared between the standalone /how-to-play route (direct-linkable) and the
// InfoDialog modal opened from AppHeader's info button — the modal is the
// primary way most people reach this, the route stays for direct links.
</script>

<template>
    <ol class="how-to-play-content">
        <li>
            <strong>Pick a formation.</strong> The formation's digits become your target number —
            4-4-2 sets a target of 442, 3-4-3 sets 343, and so on.
        </li>
        <li>
            <strong>Fill all 11 slots.</strong> Click any empty slot in any order. Each one offers
            3 real players who've played that position — but their stats stay hidden, so you're
            guessing.
        </li>
        <li>
            <strong>Goals + assists stay hidden until you pick.</strong> The moment you choose a
            player, their career goals + assists are revealed and added to your running total.
            There's no way to check first.
        </li>
        <li>
            <strong>Go over the target and it's an immediate bust.</strong> One pick that tips you
            past the number ends the game right there — no more picks.
        </li>
        <li>
            <strong>Only an exact hit wins.</strong> Land your total exactly on the target and you're
            crowned <strong>Champion</strong> — the only way to actually win. Anything else that finishes
            without busting lands on a league table instead, based on how far off you were: from
            <strong>Champions League</strong> (a genuine near-miss) down through
            <strong>Europa League</strong>, <strong>Mid-table</strong> and
            <strong>Avoided relegation</strong>, to <strong>Relegated</strong> for the finishes
            that missed by the widest margin.
        </li>
        <li>
            <strong>One reroll per game.</strong> If you don't like the 3 options on a slot, you can
            redraw them once, for any single slot, at any point in the game.
        </li>
        <li>
            <strong>No repeat players.</strong> Once a player has been offered — picked or not —
            they won't turn up again for the rest of that game.
        </li>
    </ol>
</template>

<style lang="scss" scoped>
.how-to-play-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    line-height: 1.5;
    margin: 0;
    padding-left: 1.25rem;
}
</style>
