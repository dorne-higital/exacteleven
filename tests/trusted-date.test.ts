import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAppConfig } from '../app/utils/app-config';
import { formatCountdown, nextUkMidnight, resolveDailyDate } from '../app/utils/trusted-date';

// The Daily's date is the UK calendar date (Europe/London), from the server
// when it says so and from the device clock only as an offline fallback
// (DAILY2_SPEC §1.1, §4.7). The interesting instants are either side of UK
// midnight in both GMT (winter, UTC+0) and BST (summer, UTC+1).
describe('resolveDailyDate', () => {
    it('uses the server\'s ukDate when it sent a valid one, whatever the device clock says', () => {
        expect(resolveDailyDate({ ukDate: '2026-10-14' }, new Date('2030-01-01T12:00:00Z'))).toBe('2026-10-14');
    });

    it('falls back to the device\'s UK date when offline, on an old server, or for a malformed date', () => {
        const now = new Date('2026-10-14T12:00:00Z');

        expect(resolveDailyDate(null, now)).toBe('2026-10-14');
        expect(resolveDailyDate({}, now)).toBe('2026-10-14');
        expect(resolveDailyDate({ ukDate: '14/10/2026' }, now)).toBe('2026-10-14');
    });

    it('in BST (summer), the UK day starts at 23:00 UTC the evening before', () => {
        expect(resolveDailyDate(null, new Date('2026-07-14T22:59:59Z'))).toBe('2026-07-14');
        expect(resolveDailyDate(null, new Date('2026-07-14T23:00:00Z'))).toBe('2026-07-15');
    });

    it('in GMT (winter), the UK day starts at 00:00 UTC', () => {
        expect(resolveDailyDate(null, new Date('2026-12-14T23:59:59Z'))).toBe('2026-12-14');
        expect(resolveDailyDate(null, new Date('2026-12-15T00:00:00Z'))).toBe('2026-12-15');
    });

    it('is right on both clock-change days', () => {
        // Clocks go back 01:00 UTC on Sun 25 Oct 2026, forward 01:00 UTC on Sun 29 Mar 2026.
        expect(resolveDailyDate(null, new Date('2026-10-24T23:00:00Z'))).toBe('2026-10-25');
        expect(resolveDailyDate(null, new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-25');
        expect(resolveDailyDate(null, new Date('2026-03-29T00:00:00Z'))).toBe('2026-03-29');
        expect(resolveDailyDate(null, new Date('2026-03-29T23:00:00Z'))).toBe('2026-03-30');
    });
});

describe('nextUkMidnight / formatCountdown', () => {
    it('finds the next UK midnight in BST and GMT', () => {
        expect(nextUkMidnight(new Date('2026-07-14T12:00:00Z')).toISOString()).toBe('2026-07-14T23:00:00.000Z');
        expect(nextUkMidnight(new Date('2026-12-14T12:00:00Z')).toISOString()).toBe('2026-12-15T00:00:00.000Z');
        // The night the clocks go back: midnight is still BST (23:00 UTC on the 24th).
        expect(nextUkMidnight(new Date('2026-10-24T12:00:00Z')).toISOString()).toBe('2026-10-24T23:00:00.000Z');
    });

    it('formats hours and minutes, rounding up, never negative', () => {
        const now = Date.parse('2026-10-14T19:48:00Z');

        expect(formatCountdown('2026-10-15T00:00:00Z', now)).toBe('4h 12m');
        expect(formatCountdown('2026-10-14T20:00:00Z', now)).toBe('12m');
        expect(formatCountdown('2026-10-14T19:47:00Z', now)).toBe('0m');
        expect(formatCountdown(null, now)).toBe('');
        expect(formatCountdown('soon', now)).toBe('');
    });
});

describe('fetchAppConfig (Daily 2.0 fields)', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps valid ukDate / nextDailyAt and drops malformed ones', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ minBuild: 0, latestBuild: 0, serverTime: 'x', dailyDate: '2026-10-14', ukDate: '2026-10-14', nextDailyAt: '2026-10-14T23:00:00.000Z' })
            .mockResolvedValueOnce({ minBuild: 0, latestBuild: 0, serverTime: 'x', dailyDate: '2026-10-14', ukDate: 'tomorrow', nextDailyAt: 'never' });

        vi.stubGlobal('$fetch', fetchMock);

        const good = await fetchAppConfig({ fresh: true });

        expect(good).toMatchObject({ ukDate: '2026-10-14', nextDailyAt: '2026-10-14T23:00:00.000Z' });

        const bad = await fetchAppConfig({ fresh: true });

        expect(bad).not.toBeNull();
        expect(bad!.ukDate).toBeUndefined();
        expect(bad!.nextDailyAt).toBeUndefined();
        expect(resolveDailyDate(bad, new Date('2026-12-15T00:00:00Z'))).toBe('2026-12-15');
    });
});
