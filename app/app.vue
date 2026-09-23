<script setup lang="ts">
const { initTheme } = useTheme();
const { loadStats } = useStats();

onMounted(() => {
    initTheme();
    loadStats();
});

// Standard GTM bootstrap: an inline script (nuxt-security's per-request
// nonce gets attached to it automatically — see 40-cspSsrNonce.js) that
// dynamically inserts gtm.js, which 'strict-dynamic' then trusts without
// needing googletagmanager.com on any allowlist. The noscript fallback goes
// as high in <body> as possible per Google's own installation instructions.
// GA4 (G-8QL6BS79M9) is wired up as a tag *inside* this container via GTM's
// own dashboard, not from here — this file only loads the container itself.
const { public: { gtmId } } = useRuntimeConfig();

useHead({
    script: [
        {
            key: 'gtm-init',
            innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
        },
    ],
    noscript: [
        {
            key: 'gtm-noscript',
            innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            tagPosition: 'bodyOpen',
        },
    ],
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
    // A 16% white tint here (measured, not just eyeballed) put white slot
    // label text at 3.81:1 against the composited backdrop, short of WCAG
    // AA's 4.5:1 for normal-size text — 6% keeps the same frosted-glass
    // look while landing at 4.63:1.
    --slot-empty-bg: rgb(255 255 255 / 6%);
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
