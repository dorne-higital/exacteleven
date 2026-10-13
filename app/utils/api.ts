import { apiBase } from './platform';

// The ONE way client code talks to /api. On the web the base is '' so every
// call stays a same-origin '/api/...' request, exactly as before; in the iOS
// app it's the live site (https://exacteleven.co.uk), since the app bundle has
// no server of its own. The API contract is additive-only from here on —
// shipped app builds keep calling these same routes, so a breaking change
// needs a new route (e.g. /api/v2/...) rather than an edit to an existing one.
//
// Don't add custom request headers here: in the app every request is
// cross-origin, and a custom header turns each GET into a preflighted one.
// Pass extra info as query params instead (handlers ignore unknown keys).
type FetchOptions = Record<string, unknown>;

export function apiUrl(path: string): string {
    return `${apiBase()}${path}`;
}

export function apiFetch<T>(path: string, options?: FetchOptions): Promise<T> {
    return $fetch<T>(apiUrl(path), options);
}

// Why an /api call failed, in the terms the UI cares about:
// - 'offline'      no connection at all (the device says so)
// - 'network'      the request never got a response (dropped, DNS, timeout, CORS)
// - 'rate_limited' 429 from nuxt-security's rate limiter
// - 'expired'      410 — an anti-peek token outlived its TTL
// - 'server'       any other HTTP error response
export type ApiErrorKind = 'offline' | 'network' | 'rate_limited' | 'expired' | 'server';

export function apiErrorStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) {
        return undefined;
    }

    const { statusCode, status } = error as { statusCode?: unknown; status?: unknown };
    const code = typeof statusCode === 'number' ? statusCode : status;

    return typeof code === 'number' ? code : undefined;
}

export function classifyApiError(error: unknown): ApiErrorKind {
    const status = apiErrorStatus(error);

    if (status === 429) {
        return 'rate_limited';
    }

    if (status === 410) {
        return 'expired';
    }

    if (status !== undefined) {
        return 'server';
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return 'offline';
    }

    return 'network';
}

// Plain-language copy for each failure kind, finished off with what the
// player should do next (`retryHint`, e.g. "tap it again to retry").
// `fallback` is the call site's own existing message, kept for plain server
// errors so the web's copy only changes where there's something more useful
// to say (offline, a dropped connection, rate limiting).
export function apiErrorMessage(kind: ApiErrorKind, fallback: string, retryHint: string): string {
    switch (kind) {
        case 'offline':
            return `You're offline — check your connection, then ${retryHint}.`;
        case 'network':
            return `Couldn't reach Exact XI — check your connection, then ${retryHint}.`;
        case 'rate_limited':
            return `That's a lot of games in a short time — wait a minute, then ${retryHint}.`;
        default:
            return fallback;
    }
}
