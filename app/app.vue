<script setup lang="ts">
const { loadStats } = useStats();

onMounted(() => {
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
        <AchievementToast />
    </div>
</template>

<style lang="scss">
// "Terrace Press" — a single, deliberate identity (no light/dark toggle):
// aged programme paper, ink-black type, terrace green, one matchday-red
// accent. Values pulled from the approved Terrace Press design board, not
// re-derived. Every component reads these tokens, never a raw hex value —
// see the design exploration this was built from for the full token/
// component rationale.
:root {
    --color-background: #efe6d3;
    --color-surface: #fffdf6;
    --color-foreground: #201a12;
    --color-primary: #1f4d3a;
    --color-primary-strong: #14332a;
    --color-danger: #c1272d;
    --color-pitch: #1f4d3a;
    --color-pitch-line: rgb(255 253 246 / 55%);
    --font-body: 'Source Serif 4', georgia, serif;
    --font-display: 'Fraunces', georgia, serif;
    --display-text-transform: none;

    // A faint diagonal hatch rather than a flat fill — enough grain to read
    // as paper stock, not so much it fights body text at small sizes.
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
    // well here" depends on the pitch's own dark-green color, not the paper
    // page background. A 6% paper-raised tint here puts white slot label
    // text at roughly 8:1 against the composited backdrop — comfortably
    // past WCAG AA's 4.5:1 for normal-size text, with headroom to spare.
    --slot-empty-bg: rgb(255 253 246 / 6%);
    --slot-empty-border: rgb(255 253 246 / 55%);
    --slot-empty-text: #fffdf6;
    --slot-filled-text: var(--color-primary);

    // Terrace Press's one deliberate softness: a "ticket stub" pill reserved
    // for genuine primary actions (see CreateChallengeDialog, ResultPanel,
    // AchievementToast). Everything else — cards, dialogs, chips, buttons —
    // stays sharp: --radius-sharp is 0 on purpose, kept as a named token so
    // that intent reads in the component styles that use it, not just in
    // this comment.
    --radius-sharp: 0;
    --radius-stub: 999px;
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
