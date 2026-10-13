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
        <!--
            The board is 2:3 and the viewBox is stretched to fit it
            (preserveAspectRatio="none"), so one y-unit is 1.5x one x-unit on
            screen — rx 12 / ry 8 is what actually draws as a circle.
        -->
        <ellipse class="pitch__line" cx="50" cy="50" rx="12" ry="8" />
        <rect class="pitch__line" height="16" width="50" x="25" y="2" />
        <rect class="pitch__line" height="6" width="24" x="38" y="2" />
        <rect class="pitch__line" height="16" width="50" x="25" y="82" />
        <rect class="pitch__line" height="6" width="24" x="38" y="92" />
        <ellipse class="pitch__spot" cx="50" cy="50" rx="0.9" ry="0.6" />
    </svg>
</template>

<style lang="scss" scoped>
// "Bib & Board": a flat tactics board — mown stripes in two close greens
// and thin white lines, no turf texture or vignette. The pitch has its own
// tokens (--color-pitch/-stripe/-line) because it is always green whatever
// the page theme; --color-foreground means "ink" and would draw dark lines.
.pitch {
    background-color: var(--color-pitch);
    background-image: repeating-linear-gradient(
        180deg,
        var(--color-pitch) 0 10%,
        var(--color-pitch-stripe) 10% 20%
    );
    border-radius: var(--radius-card);
    display: block;
    height: 100%;
    left: 0;
    position: absolute;
    top: 0;
    width: 100%;
}

// non-scaling-stroke keeps every line a crisp 1.5px however the stretched
// viewBox is scaled, instead of thick verticals and thin horizontals.
.pitch__line {
    fill: none;
    stroke: var(--color-pitch-line);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
}

.pitch__spot {
    fill: var(--color-pitch-line);
}
</style>
