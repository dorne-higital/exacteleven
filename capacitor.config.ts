import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app wraps the same Nuxt code as the website (see APP_STORE_SETUP.md).
// `yarn build:app` (APP_TARGET=ios nuxt generate) writes a client-only SPA to
// .output/public, and `cap sync ios` copies it into ios/App/App/public.
const config: CapacitorConfig = {
    // Must match the Bundle ID registered in the Apple Developer portal
    appId: 'uk.co.exacteleven.app',
    appName: 'Exact XI',
    webDir: '.output/public',
    ios: {
        // The page pads itself with env(safe-area-inset-*) instead
        contentInset: 'never',
        // "Bib & Board" dark background, so a slow first paint or an
        // overscroll bounce never flashes white
        backgroundColor: '#0b1410',
    },
    plugins: {
        // app/plugins/native.client.ts hides this once the app has mounted;
        // 3s is only a fallback if that never happens
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 3000,
            backgroundColor: '#0b1410',
            showSpinner: false,
        },
    },
};

export default config;
