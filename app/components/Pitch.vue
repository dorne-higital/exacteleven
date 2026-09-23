<script setup lang="ts">
// Pitch markings only — a purely visual backdrop. Position slots are placed
// by the parent page as absolutely-positioned siblings, sharing this same
// 0-100 percentage coordinate space (see app/utils/formations.ts).
</script>

<template>
    <svg
        aria-hidden="true"
        class="pitch"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
    >
        <rect class="pitch__line" height="96" width="96" x="2" y="2" />
        <line class="pitch__line" x1="2" x2="98" y1="50" y2="50" />
        <circle class="pitch__line" cx="50" cy="50" r="10" />
        <rect class="pitch__line" height="18" width="50" x="25" y="2" />
        <rect class="pitch__line" height="7" width="24" x="38" y="2" />
        <rect class="pitch__line" height="18" width="50" x="25" y="80" />
        <rect class="pitch__line" height="7" width="24" x="38" y="91" />
        <circle class="pitch__spot" cx="50" cy="50" r="0.8" />
        <circle class="pitch__spot" cx="50" cy="14" r="0.8" />
        <circle class="pitch__spot" cx="50" cy="86" r="0.8" />
    </svg>
</template>

<style lang="scss" scoped>
// The pitch is always dark green turf regardless of the page's light/dark
// theme, so its own colors are dedicated tokens (--color-pitch/-line), not
// derived from --color-foreground — which now means "ink" and would produce
// near-invisible dark lines on green instead of the white pitch markings.
.pitch {
    background-color: var(--color-pitch);
    border-radius: 0.75rem;
    display: block;
    height: 100%;
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
}

.pitch__line {
    fill: none;
    stroke: var(--color-pitch-line);
    stroke-width: 0.4;
}

.pitch__spot {
    fill: var(--color-pitch-line);
}
</style>
