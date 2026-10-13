// The Daily Challenge rotates on the player's LOCAL calendar date (see
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
