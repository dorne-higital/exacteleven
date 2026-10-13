import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { trackEvent } from '../utils/analytics';

// Hosts whose links (universal links, see the Associated Domains entitlement
// and public/.well-known/apple-app-site-association) open inside the app
const APP_LINK_HOSTS = new Set(['exacteleven.co.uk', 'www.exacteleven.co.uk']);

// Relative luminance of a computed `rgb()`/`rgba()` colour, or null when it's
// transparent or unparseable (so the caller can fall back to another element)
function luminance(color: string): number | null {
    const parts = color.match(/[\d.]+/g)?.map(Number);
    if (!parts || parts.length < 3 || parts[3] === 0) {
        return null;
    }
    const [r, g, b] = parts.slice(0, 3).map((channel) => {
        const c = channel / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Native-only setup for the iOS app; does nothing on the website. Every
// plugin call is fire-and-forget with its own .catch, so a missing or
// unsupported plugin (Android, an older build) is a silent no-op, and no
// Capacitor plugin proxy is ever awaited or returned as a value (they look
// like thenables and hang the promise machinery).
export default defineNuxtPlugin((nuxtApp) => {
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    const root = document.documentElement;

    // Status bar text follows whatever theme is on screen: rather than
    // knowing about each theme, read the page's actual background and pick
    // light text on dark backgrounds (Style.Dark) and dark text on light ones.
    let lastStyle: Style | null = null;
    const syncStatusBar = () => {
        const bg = luminance(getComputedStyle(document.body).backgroundColor)
            ?? luminance(getComputedStyle(root).backgroundColor)
            ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 0 : 1);
        const style = bg < 0.4 ? Style.Dark : Style.Light;
        if (style !== lastStyle) {
            lastStyle = style;
            StatusBar.setStyle({ style }).catch(() => {});
        }
    };

    // A theme switch shows up as a class / data-* / style change on <html>
    // or <body>, or as the system appearance flipping under a "follow
    // system" theme; a frame's delay lets the new CSS apply first.
    const scheduleSync = () => requestAnimationFrame(syncStatusBar);
    const observer = new MutationObserver(scheduleSync);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', scheduleSync);

    nuxtApp.hook('app:mounted', () => {
        syncStatusBar();
        // The first screen is painted, so swap the native splash for it.
        // (capacitor.config.ts auto-hides after 3s as a fallback.)
        requestAnimationFrame(() => {
            SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
        });
    });

    // Universal links (a shared /challenge link, the /daily link) open the
    // matching screen in-app. The query string must survive: /challenge
    // reads its whole setup from route.query. iOS holds a cold-launch URL
    // until this listener exists, so waiting for the router covers that too.
    const router = useRouter();
    App.addListener('appUrlOpen', ({ url }) => {
        let target: URL;
        try {
            target = new URL(url);
        }
        catch {
            return;
        }
        if (!APP_LINK_HOSTS.has(target.hostname)) {
            return;
        }
        const path = `${target.pathname}${target.search}${target.hash}` || '/';
        router.isReady()
            .then(() => router.push(path))
            .then(() => trackEvent('deep_link_opened', { page_path: path }))
            .catch(() => {});
    }).catch(() => {});
});
