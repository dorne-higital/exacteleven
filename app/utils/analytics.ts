// A thin wrapper around GTM's dataLayer — every custom event in the app goes
// through this so there's one place that knows how a dataLayer push is
// shaped, rather than each call site reaching into `window.dataLayer`
// directly. GTM (not this file) owns turning these into actual GA4 hits —
// see the GA4 Configuration/Event tags in the GTM-KZD42V9R container.
declare global {
    interface Window {
        dataLayer: Record<string, unknown>[];
    }
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
    if (!import.meta.client) {
        return;
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: name, ...params });
}
