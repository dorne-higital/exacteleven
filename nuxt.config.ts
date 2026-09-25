// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@nuxt/eslint', 'nuxt-security', '@nuxtjs/seo', '@nuxt/fonts'],
    app: {
        head: {
            link: [
                // SVG favicon first (modern browsers prefer it — scales
                // cleanly, no separate dark/light asset needed), PNG/ICO as
                // fallbacks for browsers that don't support SVG favicons,
                // plus the iOS home-screen icon.
                { rel: 'icon', type: 'image/svg+xml', href: '/logo/exact-xi-mark-on-light.svg' },
                { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
                { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico' },
                { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
            ],
        },
    },
    // Self-hosted (via @nuxt/fonts) rather than the previous Google Fonts
    // <link> tags — those blocked first paint on a fonts.googleapis.com
    // round-trip; self-hosting serves woff2 files from this origin with
    // fallback metrics generated automatically, removing that render-blocking
    // hop and its CLS risk. Fraunces (display) and Source Serif 4 (body) are
    // the "Terrace Press" identity's whole type system — one family per role,
    // no per-theme swap needed now that there's a single theme.
    fonts: {
        families: [
            { name: 'Source Serif 4', weights: [400, 600], provider: 'google' },
            { name: 'Fraunces', weights: [600, 700, 900], provider: 'google' },
        ],
        // Every font here is only ever referenced through the --font-body/
        // --font-display custom properties (app.vue), never a literal
        // font-family declaration — the module's default CSS scan looks for
        // literal font-family values and would find none, silently skipping
        // @font-face injection entirely. Because that failure mode is silent,
        // @nuxt/fonts is pinned to an exact version in package.json rather
        // than left on a caret range — a minor bump changing this
        // experimental flag's behavior wouldn't otherwise be caught until
        // someone noticed system-font fallback in production.
        experimental: {
            processCSSVariables: true,
        },
    },
    nitro: {
        // The site actually deploys to Netlify — this must match wherever it's
        // really hosted, since each preset builds a runtime-specific function
        // format (Netlify Functions here) that only that host knows how to run.
        preset: 'netlify',
    },
    runtimeConfig: {
        // Signs the draw -> reveal anti-peek token (see server/utils/draw-token.ts).
        // Override with NUXT_DRAW_TOKEN_SECRET in any real deployment; this
        // fallback is fine for local dev only.
        drawTokenSecret: 'dev-only-insecure-secret-change-in-production',
        public: {
            // GTM container id — GA4 (G-8QL6BS79M9) is wired up as a tag
            // *inside* this container via GTM's own dashboard, not from
            // here. Override with NUXT_PUBLIC_GTM_ID for a different
            // container per environment (e.g. a staging workspace).
            gtmId: 'GTM-KZD42V9R',
        },
    },
    security: {
        // script-src doesn't need googletagmanager.com added: the GTM
        // bootstrap script in app.vue is inline and picks up nuxt-security's
        // own per-request nonce automatically, and 'strict-dynamic' then
        // trusts whatever that nonce-trusted script injects (gtm.js itself,
        // then GA4's own script) without a host allowlist. img-src does need
        // it — GTM/GA4 fall back to image-pixel beacons in some cases.
        headers: {
            contentSecurityPolicy: {
                'img-src': ["'self'", 'data:', 'https://www.googletagmanager.com', 'https://www.google-analytics.com'],
            },
        },
        // In-memory driver — each Netlify Function invocation can land on a
        // different, short-lived instance, so this doesn't guarantee shared
        // state across requests any more than Cloudflare Workers isolates
        // would. A durable option (e.g. a Netlify Blobs-backed unstorage
        // driver) can replace this later if real cross-request throttling
        // on /api/draw and /api/reveal becomes a priority.
        rateLimiter: {
            driver: { name: 'lruCache' },
        },
    },
    // OG image generation pulls in a native renderer dependency; leave it
    // disabled until a later phase actually needs social preview images.
    ogImage: {
        enabled: false,
    },
    site: {
        // The real, live domain — NUXT_PUBLIC_SITE_URL remains available to
        // override this (e.g. a Netlify deploy-preview URL) without editing
        // this file.
        url: process.env.NUXT_PUBLIC_SITE_URL || 'https://exacteleven.co.uk',
        name: 'Exact XI',
    },
    // The `f` formation-code query param picks the actual page content on
    // /play (442 vs 433 vs ...), so each formation needs its own canonical/
    // og:url — without this, nuxt-seo-utils' default whitelist strips `f`
    // and every formation collapses onto one canonical bare /play URL.
    seo: {
        canonicalQueryWhitelist: ['page', 'sort', 'filter', 'search', 'q', 'category', 'tag', 'f'],
    },
    // /play with no `?f=` isn't a real content page (it just renders the
    // "pick a formation" error state) — only the per-formation URLs are
    // worth indexing, and those aren't auto-discoverable from the bare
    // route, so it's excluded rather than listed as a broken canonical.
    sitemap: {
        exclude: ['/play'],
    },
});
