// The Daily's calendar is the UK's: a new Daily starts at midnight
// Europe/London (GMT in winter, BST in summer), the same moment for everyone.
// The server is the authority (GET /api/app-config's ukDate); the client only
// computes this itself as an offline fallback. Pure and dependency-free so
// both sides can import it.
const UK_TIME_ZONE = 'Europe/London';
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

// en-CA formats as YYYY-MM-DD, which is exactly the shape every Daily date uses.
const ukDateFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: UK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

/** YYYY-MM-DD of `date` on the UK calendar. */
export function ukDateString(date: Date): string {
    return ukDateFormat.format(date);
}

/** True for a well-formed YYYY-MM-DD that is also a real calendar date (no 2026-02-31). */
export function isValidDateString(date: unknown): date is string {
    if (typeof date !== 'string') {
        return false;
    }

    const match = DATE_PATTERN.exec(date);

    if (!match) {
        return false;
    }

    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

    return parsed.toISOString().slice(0, 10) === date;
}

/** `date` (YYYY-MM-DD) moved by `days` whole calendar days. */
export function addDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);

    return new Date(Date.UTC(year!, month! - 1, day!) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * The instant the NEXT UK day starts, as an ISO string: 00:00 Europe/London,
 * which is 00:00Z in GMT and 23:00Z the evening before in BST. Clocks change
 * at 01:00 UTC, never at midnight, so one of those two candidates is always
 * right.
 */
export function nextUkMidnight(now: Date): Date {
    const tomorrow = addDays(ukDateString(now), 1);
    const [year, month, day] = tomorrow.split('-').map(Number);
    const utcMidnight = Date.UTC(year!, month! - 1, day!);
    const bstCandidate = new Date(utcMidnight - 60 * 60 * 1000);

    return ukDateString(bstCandidate) === tomorrow ? bstCandidate : new Date(utcMidnight);
}
