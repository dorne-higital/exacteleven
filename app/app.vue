<script setup lang="ts">
import AppShell from './components/shell/AppShell.vue';
import { isAppBuild } from './utils/platform';
import { themeBootScript } from './utils/themes';

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
// page background in each scheme. A <meta> can't read a CSS custom property,
// so the colours come from the theme catalogue (app/utils/themes.ts, which
// a test keeps equal to the tokens below) for the current Appearance + kit.
// Server-rendered, that's always Bib & Board following the system.
const { browserTheme } = useTheme();
const themeColorLight = computed(() => browserTheme.value.light);
const themeColorDark = computed(() => browserTheme.value.dark);
const colorSchemeMeta = computed(() => browserTheme.value.colorScheme);

useHead({
    meta: [
        { key: 'theme-color-light', name: 'theme-color', content: themeColorLight, media: '(prefers-color-scheme: light)' },
        { key: 'theme-color-dark', name: 'theme-color', content: themeColorDark, media: '(prefers-color-scheme: dark)' },
        { key: 'color-scheme', name: 'color-scheme', content: colorSchemeMeta },
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
            // Sets the saved Appearance (data-theme) before the first paint,
            // so a forced light/dark choice never flashes the system one.
            // Inline like the GTM bootstrap, so it gets the same CSP nonce.
            // The app build has no server-rendered HTML; its theme plugin
            // (app/plugins/theme.client.ts) applies the theme before mount.
            {
                key: 'theme-boot',
                innerHTML: themeBootScript(),
                tagPriority: 'critical',
            },
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
        <AppShell>
            <NuxtPage />
        </AppShell>
        <AchievementToast />
        <UpdatePrompt v-if="isApp" />
        <!-- App only: the website has no shop (useShop().openShop() is a no-op there). -->
        <LazyShopSheet v-if="isApp" />
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
// - Result tiers use the --tier-* ladder (deep bib -> green -> teal ->
//   slate -> amber -> muted), never ad-hoc mixes.
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
//   Tiers      --tier-title, --tier-cl, --tier-el, --tier-mid,
//              --tier-avoided, --tier-relegated
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

    // Result-tier ladder, best to worst. Title winners (a few off the
    // exact target) sits next to the red exact moment: a deep bib tone,
    // derived from the kit's own bib + ink so every Kit Bag theme follows.
    --tier-title: color-mix(in srgb, var(--color-bib) 62%, var(--color-foreground));
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

    // Layout sizes (not colours, so the same in every theme and kit).
    // --rail-w 0 means no rail; see the breakpoints just below.
    --page-max: 36rem;
    --game-max: 26rem;
    --rail-w: 0px;
    --panel-w: 0px;
    --board-max: 100%;

    // Legacy aliases (see the header comment)
    --body-texture: none;
    --body-texture-size: auto;

    color-scheme: light;
}

// Layout breakpoints: tablet 768, desktop 1024 (compact rail), full rail
// 1280, large 1440. Phones (< 768) keep the defaults above.
@media (width >= 768px) {
    :root {
        --page-max: 42rem;
        --game-max: 30rem;
    }
}

@media (width >= 1024px) {
    :root {
        --rail-w: 5.75rem;
        --page-max: 64rem;
        --panel-w: 21.25rem;
        --board-max: 34rem;
    }

    // The rail carries the brand + nav on desktop, so the header hides.
    // Doubled class so it outranks AppHeader's own scoped display rule.
    .shell.shell--rail .app-header {
        display: none;
    }
}

@media (width >= 1280px) {
    :root {
        --rail-w: 15.5rem;
        --panel-w: 22.5rem;
        --board-max: 36rem;
    }
}

@media (width >= 1440px) {
    :root {
        --page-max: 76rem;
        --panel-w: 23.75rem;
        --board-max: 40rem;
    }
}

// Follows the system setting by default; the Appearance setting
// (app/composables/useTheme.ts) sets data-theme="light" | "dark" on <html>
// to force either one (the native status-bar plugin watches that attribute).
@media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) {
        @include dark-tokens;
    }
}

:root[data-theme='dark'] {
    @include dark-tokens;
}

// ===================================================================
// KIT BAG — alternative palettes (app only; unlocked by Kit Bag or Pro).
// app/utils/themes.ts is the catalogue (names, blurbs, swatches, which
// modes each kit has) and holds these exact values too —
// tests/themes.test.ts checks the two match and that every text pair
// passes WCAG AA, so change a colour in both places.
// - data-kit="<id>" on <html> selects a kit; no attribute = Bib & Board.
// - Every kit sets every colour token below, so nothing leaks through
//   from Bib & Board's light/dark blocks.
// - 'both' kits have a light and a dark palette and follow data-theme /
//   the system like Bib & Board does. Floodlights and Chalkboard are
//   fixed dark, Winter Fixture is fixed light, whatever the appearance.
// - The rules above still hold inside a kit: --color-bib is that kit's
//   scarce accent (CTA / exact / active), busts stay --color-bust.
// ===================================================================

@mixin kit-floodlights {
    --color-background: #070d1c;
    --color-surface: #0f1830;
    --color-surface-2: #17223f;
    --color-foreground: #eef2ff;
    --color-muted: #97a3c4;
    --color-line: rgb(238 242 255 / 12%);
    --color-primary: #5ad6a0;
    --color-on-primary: #03140c;
    --color-primary-strong: #02060f;
    --color-bib: #ffa62b;
    --color-on-bib: #1f1100;
    --color-amber: #ffd27a;
    --color-teal: #5fd0e0;
    --color-slate: #a9b3cc;
    --color-pitch: #0f4033;
    --color-pitch-stripe: #0d382d;
    --color-pitch-line: rgb(255 255 255 / 34%);
    --color-pitch-ink: #eef2ff;
    --slot-empty-bg: rgb(255 255 255 / 6%);
    --slot-filled-bg: #eef2ff;
    --slot-filled-ink: #070d1c;
    --shadow-sm: none;
    --shadow-lg: 0 18px 48px rgb(0 0 0 / 60%);
    --body-texture: radial-gradient(ellipse 60% 40% at 12% -8%, rgb(255 196 110 / 11%), transparent 70%), radial-gradient(ellipse 60% 40% at 88% -8%, rgb(255 196 110 / 11%), transparent 70%);
    --body-texture-size: auto;

    color-scheme: dark;
}

@mixin kit-chalkboard {
    --color-background: #1a2321;
    --color-surface: #232e2c;
    --color-surface-2: #2c3836;
    --color-foreground: #f1efe6;
    --color-muted: #a8b2ac;
    --color-line: rgb(241 239 230 / 16%);
    --color-primary: #9fd8b4;
    --color-on-primary: #0f1f17;
    --color-primary-strong: #0b100f;
    --color-bib: #f5d76e;
    --color-on-bib: #231c02;
    --color-amber: #f4a96a;
    --color-teal: #93d2d6;
    --color-slate: #b8c0c4;
    --color-pitch: #2a3a35;
    --color-pitch-stripe: #273631;
    --color-pitch-line: rgb(241 239 230 / 45%);
    --color-pitch-ink: #f1efe6;
    --slot-empty-bg: rgb(241 239 230 / 6%);
    --slot-filled-bg: #f1efe6;
    --slot-filled-ink: #1a2321;
    --shadow-sm: none;
    --shadow-lg: 0 18px 48px rgb(0 0 0 / 55%);
    --body-texture: radial-gradient(ellipse 50% 30% at 18% 28%, rgb(241 239 230 / 5%), transparent 70%), radial-gradient(ellipse 45% 25% at 82% 72%, rgb(241 239 230 / 4%), transparent 70%);
    --body-texture-size: auto;

    color-scheme: dark;
}

@mixin kit-programme-light {
    --color-background: #f1e8d4;
    --color-surface: #fbf6ea;
    --color-surface-2: #e7dcc4;
    --color-foreground: #1b2338;
    --color-muted: #5b5546;
    --color-line: rgb(27 35 56 / 16%);
    --color-primary: #1f3d6e;
    --color-on-primary: #fbf6ea;
    --color-primary-strong: #0f1c33;
    --color-bib: #a8322a;
    --color-on-bib: #fff8ec;
    --color-amber: #8a5a00;
    --color-teal: #1c6670;
    --color-slate: #4b5466;
    --color-pitch: #3d6a3f;
    --color-pitch-stripe: #386239;
    --color-pitch-line: rgb(251 246 234 / 55%);
    --color-pitch-ink: #fbf6ea;
    --slot-empty-bg: rgb(251 246 234 / 8%);
    --slot-filled-bg: #fbf6ea;
    --slot-filled-ink: #1b2338;
    --shadow-sm: 0 1px 0 rgb(27 35 56 / 10%);
    --shadow-lg: 0 18px 40px rgb(27 35 56 / 22%);
    --body-texture: radial-gradient(rgb(27 35 56 / 6%) 1px, transparent 1.2px);
    --body-texture-size: 6px 6px;

    color-scheme: light;
}

@mixin kit-programme-dark {
    --color-background: #131a2b;
    --color-surface: #1b2338;
    --color-surface-2: #242d45;
    --color-foreground: #f3ead6;
    --color-muted: #aea690;
    --color-line: rgb(243 234 214 / 13%);
    --color-primary: #93b4e6;
    --color-on-primary: #0d1424;
    --color-primary-strong: #070b15;
    --color-bib: #f07a6c;
    --color-on-bib: #220805;
    --color-amber: #e8b65c;
    --color-teal: #72c4ca;
    --color-slate: #adb4c4;
    --color-pitch: #28452c;
    --color-pitch-stripe: #243e27;
    --color-pitch-line: rgb(243 234 214 / 32%);
    --color-pitch-ink: #f3ead6;
    --slot-empty-bg: rgb(243 234 214 / 5%);
    --slot-filled-bg: #f3ead6;
    --slot-filled-ink: #131a2b;
    --shadow-sm: none;
    --shadow-lg: 0 18px 48px rgb(0 0 0 / 55%);
    --body-texture: radial-gradient(rgb(243 234 214 / 4%) 1px, transparent 1.2px);
    --body-texture-size: 6px 6px;

    color-scheme: dark;
}

@mixin kit-away-light {
    --color-background: #eef5fb;
    --color-surface: #fff;
    --color-surface-2: #dceaf6;
    --color-foreground: #0d1f3c;
    --color-muted: #4c5f7c;
    --color-line: rgb(13 31 60 / 12%);
    --color-primary: #1a65a8;
    --color-on-primary: #fff;
    --color-primary-strong: #0a2445;
    --color-bib: #14306a;
    --color-on-bib: #fff;
    --color-amber: #9b6100;
    --color-teal: #0d6d78;
    --color-slate: #4d5b6e;
    --color-pitch: #2a6aa8;
    --color-pitch-stripe: #26619a;
    --color-pitch-line: rgb(255 255 255 / 55%);
    --color-pitch-ink: #fff;
    --slot-empty-bg: rgb(255 255 255 / 8%);
    --slot-filled-bg: #fff;
    --slot-filled-ink: #0d1f3c;
    --shadow-sm: 0 1px 2px rgb(13 31 60 / 7%);
    --shadow-lg: 0 18px 48px rgb(13 31 60 / 22%);
    --body-texture: none;
    --body-texture-size: auto;

    color-scheme: light;
}

@mixin kit-away-dark {
    --color-background: #091326;
    --color-surface: #101e3b;
    --color-surface-2: #17284b;
    --color-foreground: #e8f1fb;
    --color-muted: #93a8c6;
    --color-line: rgb(232 241 251 / 12%);
    --color-primary: #6cb5f0;
    --color-on-primary: #04122a;
    --color-primary-strong: #020814;
    --color-bib: #8fd0ff;
    --color-on-bib: #04122a;
    --color-amber: #f0b43c;
    --color-teal: #4fc6d0;
    --color-slate: #a5b2c6;
    --color-pitch: #143b69;
    --color-pitch-stripe: #12355f;
    --color-pitch-line: rgb(255 255 255 / 30%);
    --color-pitch-ink: #e8f1fb;
    --slot-empty-bg: rgb(255 255 255 / 5%);
    --slot-filled-bg: #e8f1fb;
    --slot-filled-ink: #091326;
    --shadow-sm: none;
    --shadow-lg: 0 18px 48px rgb(0 0 0 / 55%);
    --body-texture: none;
    --body-texture-size: auto;

    color-scheme: dark;
}

@mixin kit-snow {
    --color-background: #f4f8fb;
    --color-surface: #fff;
    --color-surface-2: #e2ecf3;
    --color-foreground: #0f2233;
    --color-muted: #4f6476;
    --color-line: rgb(15 34 51 / 12%);
    --color-primary: #1b6a92;
    --color-on-primary: #fff;
    --color-primary-strong: #0b2e44;
    --color-bib: #e0620a;
    --color-on-bib: #1f0d00;
    --color-amber: #9a6200;
    --color-teal: #0e6c79;
    --color-slate: #4d5d6b;
    --color-pitch: #2f6e7a;
    --color-pitch-stripe: #2b6570;
    --color-pitch-line: rgb(255 255 255 / 60%);
    --color-pitch-ink: #fff;
    --slot-empty-bg: rgb(255 255 255 / 10%);
    --slot-filled-bg: #fff;
    --slot-filled-ink: #0f2233;
    --shadow-sm: 0 1px 2px rgb(15 34 51 / 6%);
    --shadow-lg: 0 18px 48px rgb(15 34 51 / 20%);
    --body-texture: radial-gradient(rgb(27 106 146 / 7%) 1.2px, transparent 1.6px);
    --body-texture-size: 14px 14px;

    color-scheme: light;
}

// Fixed-mode kits: same specificity as the Bib & Board blocks above, and
// later in the file, so they win whatever data-theme or the system says.
:root[data-kit='floodlights'] {
    @include kit-floodlights;
}

:root[data-kit='chalkboard'] {
    @include kit-chalkboard;
}

:root[data-kit='snow'] {
    @include kit-snow;
}

// Light + dark kits: the light palette by default, the dark one under a
// dark system setting (unless forced light) or a forced dark appearance.
:root[data-kit='programme'] {
    @include kit-programme-light;
}

@media (prefers-color-scheme: dark) {
    :root[data-kit='programme']:not([data-theme='light']) {
        @include kit-programme-dark;
    }
}

:root[data-kit='programme'][data-theme='dark'] {
    @include kit-programme-dark;
}

:root[data-kit='away'] {
    @include kit-away-light;
}

@media (prefers-color-scheme: dark) {
    :root[data-kit='away']:not([data-theme='light']) {
        @include kit-away-dark;
    }
}

:root[data-kit='away'][data-theme='dark'] {
    @include kit-away-dark;
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
