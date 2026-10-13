<script setup lang="ts">
import { isAppBuild } from './utils/platform';

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

// Web-only extras. The iOS app ships neither: no GTM/GA4 (App Privacy is
// "Data Not Collected"), and no Buy Me a Coffee (App Store guideline 3.1.1 —
// tips there go through in-app purchase instead). An empty gtmId (the app
// build) also skips GTM, so it never requests gtm.js?id=.
const isApp = isAppBuild();
const loadGtm = !isApp && Boolean(gtmId);

// The browser UI tint (Safari's toolbar, Android's status bar) follows the
// page background in each scheme — kept in step with --color-background
// below by hand, since a <meta> can't read a CSS custom property.
useHead({
    meta: [
        { key: 'theme-color-light', name: 'theme-color', content: '#f3f5f1', media: '(prefers-color-scheme: light)' },
        { key: 'theme-color-dark', name: 'theme-color', content: '#0b1410', media: '(prefers-color-scheme: dark)' },
        { key: 'color-scheme', name: 'color-scheme', content: 'light dark' },
    ],
});

// Buy Me a Coffee's official floating widget — same account/id already
// live on the footballdle sister site (app/nuxt.config.ts there), ported
// here rather than reinvented. Unlike the GTM bootstrap above, this is a
// direct src= script tag (not one that self-inserts via JS), so it needs
// its own nonce from nuxt-security's SSR pass — same mechanism, just
// applied to a plain <script> instead of an inline one. data-color is the
// light-scheme --color-primary (pitch green).
if (!isApp) {
    useHead({
        script: [
            ...(loadGtm
                ? [{
                    key: 'gtm-init',
                    innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
                }]
                : []),
            {
                key: 'bmc-widget',
                src: 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js',
                'data-name': 'BMC-Widget',
                'data-cfasync': 'false',
                'data-id': 'dhorne92E',
                'data-description': 'Support Exact XI!',
                'data-message': '',
                'data-color': '#0e7a52',
                'data-position': 'Right',
                'data-x_margin': '18',
                'data-y_margin': '18',
            },
        ],
        noscript: loadGtm
            ? [
                {
                    key: 'gtm-noscript',
                    innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
                    tagPosition: 'bodyOpen',
                },
            ]
            : [],
    });
}
</script>

<template>
    <div class="app-shell">
        <NuxtRouteAnnouncer />
        <NuxtPage />
        <AchievementToast />
        <UpdatePrompt v-if="isApp" />
    </div>
</template>

<style lang="scss">
// ===================================================================
// "Bib & Board" — Exact XI's design system (replaces "Terrace Press").
// Training bib + tactics board: flat surfaces, crisp condensed type,
// 1px hairlines instead of heavy shadows, generous touch targets. One
// codebase for the website and the iOS app.
// ---
// RULES (read before adding UI):
// - Every component reads these tokens, never a raw hex value.
// - RED (--color-bib) is celebratory and scarce. Use it ONLY for: the
//   main call to action on a screen, the "exact" win moment, captain-
//   style highlights, and the active/selected state.
// - Busts / going over target use --color-bust (slate), NEVER red.
// - Errors and warnings use --color-amber, not red.
// - PITCH GREEN (--color-primary) is the board itself and secondary
//   actions (links, focus rings, quiet buttons).
// - Red is an homage only: no club crests, names or branding anywhere.
// - Result tiers use the --tier-* ladder (green -> teal -> slate ->
//   amber -> muted), never ad-hoc mixes.
// - Type: --font-display (Big Shoulders, Display cut, 700-900, UPPERCASE for
//   headers/labels), --font-body (Onest, 400-700), --font-mono (Spline
//   Sans Mono, tabular-nums) for stat numbers.
// - Touch targets are at least --tap-min (44px). Cards use
//   --radius-card (16px); dialogs --radius-lg (18px).
// - iOS: fixed headers/bars pad with env(safe-area-inset-*), and full-
//   height layouts use 100dvh (with a 100vh fallback), never bare 100vh.
// ---
// TOKENS
//   Surfaces   --color-background, --color-surface, --color-surface-2,
//              --color-line (1px borders), --shadow-sm, --shadow-lg
//   Ink        --color-foreground (ink), --color-muted
//   Pitch      --color-primary, --color-on-primary, --color-primary-strong
//              (scrims), --color-pitch, --color-pitch-stripe,
//              --color-pitch-line, --color-pitch-ink
//   Bib (red)  --color-bib, --color-on-bib
//   Support    --color-amber, --color-teal, --color-slate, --color-bust
//   Tiers      --tier-cl, --tier-el, --tier-mid, --tier-avoided,
//              --tier-relegated
//   Slots      --slot-empty-bg/-border/-text, --slot-filled-text (ink on
//              --color-surface), --slot-filled-bg/-ink (bib-chip pair),
//              --slot-next (the slot being picked)
//   Shape      --radius-sm, --radius-md, --radius-card, --radius-lg,
//              --radius-pill, --tap-min
//   Legacy     --radius-sharp (= --radius-md),
//              --radius-stub (primary-action buttons), --body-texture
//              (none). Kept so older component styles keep working.
// ===================================================================

@mixin dark-tokens {
    --color-background: #0b1410;
    --color-surface: #15221b;
    --color-surface-2: #1d2c24;
    --color-foreground: #eaf2ed;
    --color-muted: #8fa398;
    --color-line: rgb(234 242 237 / 12%);
    --color-primary: #31c58a;
    --color-on-primary: #04130b;
    --color-primary-strong: #020a06;
    --color-bib: #ff5a4a;
    --color-on-bib: #1a0402;
    --color-amber: #f0b43c;
    --color-teal: #3fc1c9;
    --color-slate: #a3b0b8;
    --color-pitch: #0f4a33;
    --color-pitch-stripe: #0d422e;
    --color-pitch-line: rgb(255 255 255 / 30%);
    --color-pitch-ink: #eaf2ed;
    --slot-empty-bg: rgb(255 255 255 / 5%);
    --slot-filled-bg: #eaf2ed;
    --slot-filled-ink: #0b1410;
    --shadow-sm: none;
    --shadow-lg: 0 18px 48px rgb(0 0 0 / 50%);

    color-scheme: dark;
}

:root {
    // Surfaces + ink
    --color-background: #f3f5f1;
    --color-surface: #fff;
    --color-surface-2: #e8ede7;
    --color-foreground: #0f1d16;
    --color-muted: #5b6b62;
    --color-line: rgb(15 29 22 / 12%);

    // Pitch green — the board, secondary actions, focus
    --color-primary: #0e7a52;
    --color-on-primary: #fff;
    --color-primary-strong: #08402b;

    // Bib red — CTA, exact win, captain, active state (see rules above)
    --color-bib: #da291c;
    --color-on-bib: #fff;

    // Support colours
    --color-amber: #b87900;
    --color-teal: #0f7480;
    --color-slate: #4f5d66;
    --color-bust: var(--color-slate);

    // Result-tier ladder, best to worst
    --tier-cl: var(--color-primary);
    --tier-el: var(--color-teal);
    --tier-mid: var(--color-slate);
    --tier-avoided: var(--color-amber);
    --tier-relegated: var(--color-muted);

    // The pitch: a flat green board with thin white tactics lines
    --color-pitch: #13865c;
    --color-pitch-stripe: #0f7a53;
    --color-pitch-line: rgb(255 255 255 / 55%);
    --color-pitch-ink: #fff;

    // Pitch slots always sit on the pitch, so they have their own pair
    // rather than the page's surface/foreground. Filled slots are bib-like
    // chips: --slot-filled-bg/-ink. --slot-filled-text is the older pair
    // for text drawn on --color-surface.
    --slot-empty-bg: rgb(255 255 255 / 8%);
    --slot-empty-border: var(--color-pitch-line);
    --slot-empty-text: var(--color-pitch-ink);
    --slot-filled-text: var(--color-foreground);
    --slot-filled-bg: #fff;
    --slot-filled-ink: #0f1d16;
    --slot-next: var(--color-bib);

    // Type
    --font-display: 'Big Shoulders', 'Big Shoulders Display', impact, 'Arial Narrow', sans-serif;
    --font-body: 'Onest', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-mono: 'Spline Sans Mono', ui-monospace, 'SF Mono', menlo, monospace;
    --display-text-transform: uppercase;

    // Shape + elevation
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-card: 16px;
    --radius-lg: 18px;
    --radius-pill: 999px;
    --radius-sharp: var(--radius-md);
    --radius-stub: 14px;
    --shadow-sm: 0 1px 2px rgb(15 29 22 / 6%);
    --shadow-lg: 0 18px 48px rgb(15 29 22 / 22%);
    --tap-min: 44px;

    // Legacy aliases (see the header comment)
    --body-texture: none;
    --body-texture-size: auto;

    color-scheme: light;
}

// Follows the system setting by default; a future in-app toggle only has
// to set data-theme="light" | "dark" on <html> to force either one (the
// native status-bar plugin already watches that attribute).
@media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
        @include dark-tokens;
    }
}

:root[data-theme='dark'] {
    @include dark-tokens;
}

// Stops iOS Safari / WKWebView inflating text on rotation; Safari only
// knows the prefixed property.
html {
    // stylelint-disable-next-line property-no-vendor-prefix
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
}

body {
    background-color: var(--color-background);
    background-image: var(--body-texture);
    background-size: var(--body-texture-size);
    color: var(--color-foreground);
    font-family: var(--font-body);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.45;
    margin: 0;
    -webkit-tap-highlight-color: transparent;
}

h1,
h2,
h3 {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1.05;
    text-transform: var(--display-text-transform);
}

h1 {
    font-size: 2.25rem;
    font-weight: 900;
}

a {
    color: var(--color-primary);
}

:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}
</style>

<style lang="scss" scoped>
// Safe-area padding is 0 on the website (no viewport-fit=cover there), so
// this only does anything inside the iOS app, under the notch / home bar.
// A flex column so a page can fill the rest of the screen with
// `flex: 1 0 auto` instead of its own min-height: 100vh (which, added to
// this padding, would scroll by the inset height in the app).
.app-shell {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
</style>
