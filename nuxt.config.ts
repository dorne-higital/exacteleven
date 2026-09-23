// https://nuxt.com/docs/api/configuration/nuxt-config
const rateLimiterKvBinding = process.env.NUXT_RATE_LIMITER_KV_BINDING;

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
    // hop and its CLS risk. Both themes' display fonts stay listed upfront
    // (Fredoka for Match Programme, Anton for Dugout Dark) since switching
    // themes is instant, client-side, and shouldn't wait on a font fetch.
    fonts: {
        families: [
            { name: 'Manrope', weights: [400, 600, 700], provider: 'google' },
            { name: 'Fredoka', weights: [600, 700], provider: 'google' },
            { name: 'Anton', weights: [400], provider: 'google' },
        ],
        // Every font here is only ever referenced through the --font-body/
        // --font-display custom properties (app.vue), never a literal
        // font-family declaration — the module's default CSS scan looks for
        // literal font-family values and would find none, silently skipping
        // @font-face injection entirely.
        experimental: {
            processCSSVariables: true,
        },
    },
    nitro: {
        preset: 'cloudflare-pages',
    },
    runtimeConfig: {
        // Signs the draw -> reveal anti-peek token (see server/utils/draw-token.ts).
        // Override with NUXT_DRAW_TOKEN_SECRET in any real deployment; this
        // fallback is fine for local dev only.
        drawTokenSecret: 'dev-only-insecure-secret-change-in-production',
    },
    security: {
        // Default driver is in-memory (fine for a single local dev process),
        // but that won't share state across Cloudflare Workers isolates
        // once deployed, so /api/draw and /api/reveal would get no real
        // cross-request throttling in production. Once a KV namespace is
        // created and bound in the Cloudflare Pages project settings, set
        // NUXT_RATE_LIMITER_KV_BINDING to that binding's name to switch to a
        // shared, durable driver — left unset, this keeps today's default.
        rateLimiter: {
            driver: rateLimiterKvBinding
                ? { name: 'cloudflareKVBinding', options: { binding: rateLimiterKvBinding } }
                : { name: 'lruCache' },
        },
    },
    // OG image generation pulls in a native renderer dependency; leave it
    // disabled until a later phase actually needs social preview images.
    ogImage: {
        enabled: false,
    },
    site: {
        // Falls back to the placeholder pages.dev domain until the real
        // Cloudflare Pages project/custom domain is confirmed — set
        // NUXT_PUBLIC_SITE_URL in that project's env vars once it is, rather
        // than editing this file again.
        url: process.env.NUXT_PUBLIC_SITE_URL || 'https://exacteleven.pages.dev',
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
