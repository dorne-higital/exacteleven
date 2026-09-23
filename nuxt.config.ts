// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@nuxt/eslint', 'nuxt-security', '@nuxtjs/seo'],
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
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
                {
                    rel: 'stylesheet',
                    // Both themes' display fonts are loaded upfront (Fredoka
                    // for Match Programme, Anton for Dugout Dark) since
                    // switching themes is instant, client-side, and shouldn't
                    // wait on a font fetch.
                    href: 'https://fonts.googleapis.com/css2?family=Anton&family=Fredoka:wght@600;700&family=Manrope:wght@400;500;600;700;800&display=swap',
                },
            ],
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
    // nuxt-security's default CSP blocks third-party style-src/font-src by
    // default; these two hosts are needed for the Google Fonts link above.
    security: {
        headers: {
            contentSecurityPolicy: {
                'font-src': ["'self'", 'https://fonts.gstatic.com'],
                'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            },
        },
    },
    // OG image generation pulls in a native renderer dependency; leave it
    // disabled until a later phase actually needs social preview images.
    ogImage: {
        enabled: false,
    },
    site: {
        url: 'https://exacteleven.pages.dev',
    },
});
