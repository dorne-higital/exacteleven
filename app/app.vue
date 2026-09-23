<script setup lang="ts">
const { initTheme } = useTheme();
const { loadStats } = useStats();

onMounted(() => {
    initTheme();
    loadStats();
});
</script>

<template>
    <div class="app-shell">
        <NuxtRouteAnnouncer />
        <NuxtPage />
    </div>
</template>

<style lang="scss">
// "Match Programme" (default) and "Dugout Dark" themes — values pulled
// verbatim from the approved design canvas (MP-*/Redesign-MatchProgramme and
// DD-*/Redesign-DugoutDark .dc.html boards), not re-derived. Switching
// themes sets `data-theme` on <html> (see useTheme.ts); adding a third theme
// later means adding one more `:root[data-theme='...']` block here, nothing
// else — every component reads these tokens, never a raw hex value.
:root {
    --color-background: #f6f3ec;
    --color-surface: #fff;
    --color-foreground: #1a1d1b;
    --color-primary: #1c6b4a;
    --color-primary-strong: #123f2c;
    --color-danger: #b3401f;
    --color-pitch: #2f7a52;
    --color-pitch-line: rgb(255 255 255 / 55%);
    --font-body: 'Manrope', system-ui, sans-serif;
    --font-display: 'Fredoka', 'Manrope', system-ui, sans-serif;
    --display-text-transform: none;
    --body-texture: repeating-linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-foreground) 3.5%, transparent) 0,
        color-mix(in srgb, var(--color-foreground) 3.5%, transparent) 1px,
        transparent 1px,
        transparent 14px
    );
    --body-texture-size: auto;

    // Pitch-slot colors are separate from the page-level surface/foreground
    // pair: a slot always sits on the pitch (see Pitch.vue), so "what reads
    // well here" depends on the pitch's own color, not the page background.
    --slot-empty-bg: rgb(255 255 255 / 16%);
    --slot-empty-border: rgb(255 255 255 / 55%);
    --slot-empty-text: #fff;
    --slot-filled-text: var(--color-foreground);
}

:root[data-theme='dugout-dark'] {
    --color-background: #0a0b0c;
    --color-surface: #17181a;
    --color-foreground: #f5f6f4;
    --color-primary: #7cfb5b;
    --color-primary-strong: #0a0b0c;
    --color-danger: #ff4d4d;
    --color-pitch: #10201a;
    --color-pitch-line: rgb(124 251 91 / 35%);
    --font-display: 'Anton', 'Manrope', system-ui, sans-serif;
    --display-text-transform: uppercase;
    --body-texture: radial-gradient(color-mix(in srgb, var(--color-foreground) 5%, transparent) 1px, transparent 1px);
    --body-texture-size: 6px 6px;
    --slot-empty-bg: rgb(245 246 244 / 4%);
    --slot-empty-border: rgb(245 246 244 / 55%);
    --slot-empty-text: rgb(245 246 244 / 55%);
    --slot-filled-text: var(--color-primary);
}

body {
    background-color: var(--color-background);
    background-image: var(--body-texture);
    background-size: var(--body-texture-size);
    color: var(--color-foreground);
    font-family: var(--font-body);
    margin: 0;
}

h1,
h2,
h3 {
    font-family: var(--font-display);
    letter-spacing: 0.01em;
    text-transform: var(--display-text-transform);
}
</style>

<style lang="scss" scoped>
.app-shell {
    min-height: 100vh;
}
</style>
