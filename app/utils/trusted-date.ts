import type { AppConfig } from '../../shared/app-config';
import { ukDateString } from '#shared/uk-date';

// Daily 2.0 (DAILY2_SPEC §1.1, §4.7): the Daily date is the Europe/London
// calendar date, and the server is the authority on web and app alike —
// resolveDailyDate() below. Everything from here to pickDailyDate is the v1
// rule, kept for a v1 Daily still in progress.
//
// v1: the Daily Challenge rotates on the player's LOCAL calendar date (see
// server/api/daily.get.ts), which is whatever the device clock says. That's
// fine on the web, but in the app a leaderboard/streak would make "set the
// phone's clock forward to preview tomorrow's Daily" worth doing — so the app
// checks the local date against the server's (/api/app-config's dailyDate,
// UTC). Within a day either side (any real timezone) the local date wins, so
// nobody's Daily changes at a different moment than on the website; further
// out than that, the device clock is wrong and the server's date is used.
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// YYYY-MM-DD for the device's local calendar date — the web's Daily date.
export function localDateString(now: Date = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function toUtcDay(date: string): number {
    const [year, month, day] = date.split('-').map(Number);

    return Date.UTC(year!, month! - 1, day!) / MS_PER_DAY;
}

// Whole days from `from` to `to` (both YYYY-MM-DD); positive when `to` is later.
export function daysBetween(from: string, to: string): number {
    return Math.round(toUtcDay(to) - toUtcDay(from));
}

export function pickDailyDate(localDate: string, serverDate: string | null | undefined): string {
    if (!serverDate || !DATE_PATTERN.test(serverDate) || !DATE_PATTERN.test(localDate)) {
        return localDate;
    }

    return Math.abs(daysBetween(serverDate, localDate)) <= 1 ? localDate : serverDate;
}

// Daily 2.0: the server's UK date (/api/app-config's ukDate) when it gave a
// valid one; otherwise (offline, or an older server without the field) the
// London date from the device clock.
export function resolveDailyDate(config: Pick<AppConfig, 'ukDate'> | null | undefined, now: Date = new Date()): string {
    const fromServer = config?.ukDate;

    return typeof fromServer === 'string' && DATE_PATTERN.test(fromServer) ? fromServer : ukDateString(now);
}

// Calendar helpers shared with the server (shared/uk-date.ts).
export { addDays, isValidDateString, nextUkMidnight } from '#shared/uk-date';

// "4h 12m" / "12m" / "0m" until `target` (ISO); '' when unreadable.
export function formatCountdown(target: string | null | undefined, now: number = Date.now()): string {
    const at = target ? Date.parse(target) : Number.NaN;

    if (!Number.isFinite(at)) {
        return '';
    }

    const minutes = Math.max(0, Math.ceil((at - now) / 60_000));
    const hours = Math.floor(minutes / 60);

    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
