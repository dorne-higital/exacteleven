import type { DailyPuzzle } from '#shared/daily2-types';
import { getPuzzle, requireDailyDate, toPublicPuzzle, ukToday } from '../../../utils/daily2-puzzle';

// GET /api/daily/v2[?date=YYYY-MM-DD] — the whole Daily 2.0 puzzle up front:
// every open slot's 3 main options (names, clubs, seasons, appearances only —
// never goals/assists, D2) plus the locked players in full. No date = UK
// today. A past date is the archive puzzle (Pro-gated in the client; archive
// play is unranked, so the server doesn't need to gate it).
// Errors: 400 bad_date, 403 not_yet (after UK today), 404 before_launch.
export default defineEventHandler(async (event): Promise<DailyPuzzle> => {
    const query = getQuery(event);
    const now = new Date();
    const date = requireDailyDate(query.date === undefined || query.date === '' ? ukToday(now) : query.date, now);
    const puzzle = toPublicPuzzle(await getPuzzle(date), now);

    // Set only on success, so a 403/404 is never cached. Today's can change
    // at midnight, so its browser copy is short; a past date never changes.
    setResponseHeader(event, 'cache-control', puzzle.isToday
        ? 'public, max-age=60, s-maxage=600'
        : 'public, max-age=3600, s-maxage=86400');

    return puzzle;
});
