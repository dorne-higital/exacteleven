// https://nuxt.com/docs/api/configuration/nuxt-config

// APP_TARGET=ios builds the bundle that ships inside the Capacitor iOS app
// (same switch as the Footballdle app build): a client-only SPA from
// `nuxt generate` into .output/public, which then talks to the live site's
// /api over CORS (see app/utils/api.ts). Unset — every web build, dev
// server, CI run and Netlify deploy — this file behaves exactly as before.
const isApp = process.env.APP_TARGET === 'ios';

// Where the app's API calls go. Empty on the web, so every /api request stays
// same-origin and unchanged. NUXT_PUBLIC_API_BASE can point an app build at a
// Netlify deploy preview (or '' for `yarn dev:app` against the local server).
const apiBase = isApp ? (process.env.NUXT_PUBLIC_API_BASE ?? 'https://exacteleven.co.uk') : '';

// Origins allowed to call /api cross-origin: the Capacitor iOS webview
// (capacitor://localhost, plus ionic://localhost which older Capacitor iOS
// configs used) and a local dev server. The website itself is same-origin
// and never needs CORS. Additive only — no existing request changes.
const API_CORS_ORIGINS = [
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:3000',
];

export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    ssr: !isApp,
    // Nuxt's dev server crashes with ssr: false ("No entry found in
    // rollupOptions.input"); its newer Vite mode doesn't, so `yarn dev:app`
    // uses that. Builds are untouched. Copied from Footballdle.
    $development: isApp ? { experimental: { viteEnvironmentApi: true } } : {},
    // nuxt-security is web-only: in a static app bundle there's no server for
    // its headers/rate limiter/CORS to run on, and its SSG defaults (a CSP
    // <meta> with script hashes, SRI, 'strict-dynamic' — under which 'self'
    // i.e. capacitor://localhost is ignored) risk a blank white screen in
    // WKWebView. @nuxtjs/seo stays in both builds — useSiteConfig() is read
    // at runtime for share URLs — with its crawler-only parts off in the app.
    modules: ['@nuxt/eslint', ...(isApp ? [] : ['nuxt-security']), '@nuxtjs/seo', '@nuxt/fonts'],
    app: {
        head: {
            // Lets the app draw under the notch/home indicator; pages pad
            // themselves with env(safe-area-inset-*). Web keeps Nuxt's default.
            ...(isApp ? { viewport: 'width=device-width, initial-scale=1, viewport-fit=cover' } : {}),
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
    // hop and its CLS risk. The "Bib & Board" type system (app.vue tokens):
    // Big Shoulders (Display cut) for headings/big numbers, Onest for body/UI,
    // Spline Sans Mono for stat numbers — one family per role, shared by the
    // light and dark schemes. In the app build these are bundled into
    // /_fonts, so they work offline (codemagic.yaml checks they're there).
    // Google merged "Big Shoulders Display" and "Big Shoulders Text" into one
    // "Big Shoulders" family with an optical-size axis (10-72, default 14 =
    // the Text cut). The old name no longer resolves, so we ask for the
    // family by its new name and pin opsz to 72, which is the Display cut.
    fonts: {
        families: [
            {
                name: 'Big Shoulders',
                weights: [700, 800, 900],
                provider: 'google',
                providerOptions: { google: { experimental: { variableAxis: { opsz: ['72'] } } } },
            },
            { name: 'Onest', weights: [400, 500, 600, 700], provider: 'google' },
            { name: 'Spline Sans Mono', weights: [400, 500, 600, 700], provider: 'google' },
        ],
        // Every font here is only ever referenced through the --font-body/--font-display/
        // --font-mono custom properties (app.vue), never a literal
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
        // The app build is a plain static bundle with no server at all.
        preset: isApp ? 'static' : 'netlify',
    },
    routeRules: isApp ? {} : {
        '/api/**': {
            security: {
                corsHandler: {
                    origin: API_CORS_ORIGINS,
                    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
                    preflight: { statusCode: 204 },
                },
                // nuxt-security keys its buckets by IP + matched route rule,
                // so this gives /api its own bucket instead of sharing the
                // site-wide default (150 per 5 minutes, which also counted
                // page loads). One game is ~30-40 API calls (draws, reveals,
                // win-odds, hint), so the default capped a player at ~4 games
                // per 5 minutes — and far fewer for players behind a shared
                // carrier/CGNAT IP. 600 leaves room for a binge without
                // removing the limit. Preflight OPTIONS requests are answered
                // by corsHandler before the limiter runs, so they don't count.
                rateLimiter: {
                    tokensPerInterval: 600,
                    interval: 300000,
                },
            },
        },
        // Universal links: iOS fetches this extensionless file and requires
        // application/json (Netlify would otherwise serve octet-stream)
        '/.well-known/apple-app-site-association': {
            headers: { 'content-type': 'application/json' },
        },
    },
    runtimeConfig: {
        // Signs the draw -> reveal anti-peek token (see server/utils/draw-token.ts).
        // Override with NUXT_DRAW_TOKEN_SECRET in any real deployment; this
        // fallback is fine for local dev only.
        drawTokenSecret: 'dev-only-insecure-secret-change-in-production',
        // Served by /api/app-config for the iOS app's update check: any
        // installed build below appMinBuild is told it must update;
        // appLatestBuild is the newest one on the App Store. Override with
        // NUXT_APP_MIN_BUILD / NUXT_APP_LATEST_BUILD (no code change needed).
        // appStoreUrl (NUXT_APP_STORE_URL) is the prompt's "Update" target,
        // e.g. https://apps.apple.com/app/id<APP_STORE_APPLE_ID>.
        appMinBuild: 0,
        appLatestBuild: 0,
        appStoreUrl: '',
        public: {
            // True only in the APP_TARGET=ios bundle. Read it through
            // app/utils/platform.ts rather than directly.
            isApp,
            // '' on the web (same-origin). See apiBase above.
            apiBase,
            // GTM container id — GA4 (G-8QL6BS79M9) is wired up as a tag
            // *inside* this container via GTM's own dashboard, not from
            // here. Override with NUXT_PUBLIC_GTM_ID for a different
            // container per environment (e.g. a staging workspace). Empty in
            // the app build: no GTM inside the iOS webview (see r1 plan 6.5).
            gtmId: isApp ? '' : 'GTM-KZD42V9R',
        },
    },
    security: {
        // script-src doesn't need googletagmanager.com added: the GTM
        // bootstrap script in app.vue is inline and picks up nuxt-security's
        // own per-request nonce automatically, and 'strict-dynamic' then
        // trusts whatever that nonce-trusted script injects (gtm.js itself,
        // then GA4's own script) without a host allowlist. img-src does need
        // it — GTM/GA4 fall back to image-pixel beacons in some cases.
        // buymeacoffee.com is here for a different reason: script-src already
        // allows any https: host (plus strict-dynamic), so the BMC widget
        // script itself loads fine without an entry — but img-src has no
        // such broad allowance, and the widget loads its own icon/loader
        // SVGs as plain <img> tags from cdn.buymeacoffee.com, which were
        // silently CSP-blocked without this (confirmed via a live network
        // trace: script 200, icon/loader requests failing, host missing from
        // this exact list — footballdle.co.uk, which has no CSP at all,
        // never hit this).
        headers: {
            contentSecurityPolicy: {
                'img-src': ["'self'", 'data:', 'https://www.googletagmanager.com', 'https://www.google-analytics.com', 'https://cdn.buymeacoffee.com'],
            },
        },
        // Netlify Blobs on an actual Netlify deploy (NETLIFY is a standard
        // env var Netlify's own build environment sets — see
        // https://docs.netlify.com/configure-builds/environment-variables/
        // — read here at BUILD time, since nuxt.config.ts only runs then,
        // not per-request); the previous per-instance in-memory driver
        // everywhere else (local dev, CI, any non-Netlify build), since
        // Blobs has no local emulation without the Netlify CLI and would
        // throw on every rate-limited request outside a real Netlify
        // runtime — this keeps `yarn dev`/`yarn build` completely
        // unaffected. Unverified beyond a build-time sanity check (forcing
        // NETLIFY=1 locally proves the config path is well-formed): Blobs
        // itself needs a real deploy to confirm end-to-end, since it can't
        // be exercised locally.
        rateLimiter: {
            driver: process.env.NETLIFY
                ? { name: 'netlify-blobs', options: { name: 'rate-limiter' } }
                : { name: 'lruCache' },
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
        enabled: !isApp,
        exclude: ['/play'],
    },
    // Crawler-only output — meaningless inside the app bundle.
    robots: {
        enabled: !isApp,
    },
    schemaOrg: {
        enabled: !isApp,
    },
});
