import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiErrorMessage, apiFetch, apiUrl, classifyApiError } from '../app/utils/api';
import { updateReason } from '../app/utils/app-config';
import { createGameId } from '../app/utils/game-id';
import { isAppBuild, isNativeApp } from '../app/utils/platform';
import { daysBetween, localDateString, pickDailyDate } from '../app/utils/trusted-date';

// The web/app split (app/utils/platform.ts + api.ts) reads Nuxt's
// useRuntimeConfig() — stubbed per test here, and deliberately left
// UNdefined in some tests to prove the "no Nuxt context = web" fallback.
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('platform + apiFetch', () => {
    it('treats a missing Nuxt context as the web: same-origin /api paths, not the app', () => {
        expect(isAppBuild()).toBe(false);
        expect(isNativeApp()).toBe(false);
        expect(apiUrl('/api/draw')).toBe('/api/draw');
    });

    it('prefixes the live site in the app build', async () => {
        const fetchMock = vi.fn().mockResolvedValue([]);

        vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true, apiBase: 'https://exacteleven.co.uk/' } }));
        vi.stubGlobal('$fetch', fetchMock);

        expect(isAppBuild()).toBe(true);
        expect(apiUrl('/api/draw')).toBe('https://exacteleven.co.uk/api/draw');

        await apiFetch('/api/daily', { query: { date: '2026-10-13' } });

        expect(fetchMock).toHaveBeenCalledWith('https://exacteleven.co.uk/api/daily', { query: { date: '2026-10-13' } });
    });

    it('stays relative on the web build', () => {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: false, apiBase: '' } }));

        expect(apiUrl('/api/win-odds')).toBe('/api/win-odds');
    });
});

describe('classifyApiError / apiErrorMessage', () => {
    it('sorts failures into what the player needs to hear', () => {
        expect(classifyApiError({ statusCode: 429 })).toBe('rate_limited');
        expect(classifyApiError({ statusCode: 410 })).toBe('expired');
        expect(classifyApiError({ status: 500 })).toBe('server');
        expect(classifyApiError(new TypeError('Load failed'))).toBe('network');

        vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

        expect(classifyApiError(new TypeError('Load failed'))).toBe('offline');
    });

    it('keeps the call site\'s own copy for plain server errors', () => {
        expect(apiErrorMessage('server', 'Original copy.', 'try again')).toBe('Original copy.');
        expect(apiErrorMessage('offline', 'Original copy.', 'try again')).toMatch(/offline.*try again\.$/);
    });
});

describe('createGameId', () => {
    const ID_PATTERN = /^[\w-]{8,64}$/;

    it('uses crypto.randomUUID when available', () => {
        expect(createGameId()).toMatch(ID_PATTERN);
    });

    it('falls back to getRandomValues where randomUUID is missing (iOS < 15.4)', () => {
        vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(171) });

        expect(createGameId()).toBe('ab'.repeat(16));
    });

    it('still produces a server-acceptable id with no Web Crypto at all', () => {
        vi.stubGlobal('crypto', undefined);

        expect(createGameId()).toMatch(ID_PATTERN);
    });
});

describe('trusted Daily date', () => {
    it('formats the local calendar date', () => {
        expect(localDateString(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    });

    it('counts whole days across month/year boundaries', () => {
        expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
        expect(daysBetween('2026-03-01', '2026-02-27')).toBe(-2);
    });

    it('keeps the local date within a day of the server (any real timezone)', () => {
        expect(pickDailyDate('2026-10-14', '2026-10-13')).toBe('2026-10-14');
        expect(pickDailyDate('2026-10-12', '2026-10-13')).toBe('2026-10-12');
    });

    it('uses the server date when the device clock is further out', () => {
        expect(pickDailyDate('2026-10-20', '2026-10-13')).toBe('2026-10-13');
        expect(pickDailyDate('2025-01-01', '2026-10-13')).toBe('2026-10-13');
    });

    it('falls back to the local date without a usable server date (offline)', () => {
        expect(pickDailyDate('2026-10-20', null)).toBe('2026-10-20');
        expect(pickDailyDate('2026-10-20', 'garbage')).toBe('2026-10-20');
    });
});

describe('GET /api/app-config', () => {
    it('returns build gates and a trusted clock, uncached', async () => {
        const headers: Record<string, string> = {};

        vi.stubGlobal('defineEventHandler', (handler: (event: unknown) => unknown) => handler);
        vi.stubGlobal('useRuntimeConfig', () => ({ drawTokenSecret: 'x', appMinBuild: '3', appLatestBuild: 5, appStoreUrl: 'https://apps.apple.com/app/id1' }));
        vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: string) => {
            headers[name] = value;
        });
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-13T23:30:00Z'));

        const handler = (await import('../server/api/app-config.get')).default;
        const config = handler({});

        vi.useRealTimers();

        expect(config).toEqual({
            minBuild: 3,
            latestBuild: 5,
            serverTime: '2026-10-13T23:30:00.000Z',
            dailyDate: '2026-10-13',
            storeUrl: 'https://apps.apple.com/app/id1',
            // Daily 2.0 (additive): 23:30 UTC is 00:30 BST, so the UK is already on the 14th.
            ukDate: '2026-10-14',
            nextDailyAt: '2026-10-14T23:00:00.000Z',
        });
        expect(headers['cache-control']).toBe('no-store');
    });
});

describe('updateReason', () => {
    it('requires an update below minBuild, offers one below latestBuild', () => {
        expect(updateReason(3, { minBuild: 4, latestBuild: 6 })).toBe('required');
        expect(updateReason(5, { minBuild: 4, latestBuild: 6 })).toBe('available');
        expect(updateReason(6, { minBuild: 4, latestBuild: 6 })).toBeNull();
    });

    it('never prompts when the gates are unset or the build is unreadable', () => {
        expect(updateReason(1, { minBuild: 0, latestBuild: 0 })).toBeNull();
        expect(updateReason(Number.NaN, { minBuild: 4, latestBuild: 6 })).toBeNull();
        expect(updateReason(0, { minBuild: 4, latestBuild: 6 })).toBeNull();
    });
});
