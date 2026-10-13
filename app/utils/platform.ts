// The two layers that tell the website and the iOS app apart (same split as
// Footballdle):
// - isAppBuild(): BUILD-time. True only in the APP_TARGET=ios bundle (see
//   nuxt.config.ts). Use it for what gets rendered/bundled — no GTM, no Buy Me
//   a Coffee, which API host to call.
// - isNativeApp(): RUN-time. True only inside the Capacitor native shell.
//   Guard every native plugin call with this, so the website never calls
//   into native code even if a plugin is bundled.
// Neither throws outside a Nuxt context (a click handler, after an await, a
// plain vitest run) — both just fall back to "web".

declare global {
    interface Window {
        Capacitor?: { isNativePlatform?: () => boolean };
    }
}

interface PublicPlatformConfig {
    isApp?: boolean;
    apiBase?: string;
}

function readPublicConfig(): PublicPlatformConfig {
    try {
        return (useRuntimeConfig().public ?? {}) as PublicPlatformConfig;
    } catch {
        return {};
    }
}

export function isAppBuild(): boolean {
    return readPublicConfig().isApp === true;
}

export function isNativeApp(): boolean {
    if (!import.meta.client) {
        return false;
    }

    try {
        // Capacitor's native bridge injects this global before any app code
        // runs — reading it here keeps this file free of a @capacitor/core
        // import, so the web bundle and unit tests don't depend on it.
        return window.Capacitor?.isNativePlatform?.() === true;
    } catch {
        return false;
    }
}

// The origin /api requests go to: '' on the web (same-origin, unchanged),
// 'https://exacteleven.co.uk' in the app. No trailing slash.
export function apiBase(): string {
    return (readPublicConfig().apiBase ?? '').replace(/\/+$/, '');
}

// 'ios' or 'web' — handy as an analytics param or a query flag. Note any new
// GA4 param needs its own event-scoped custom dimension before it shows up
// in reports.
export function platformName(): 'ios' | 'web' {
    return isAppBuild() ? 'ios' : 'web';
}
