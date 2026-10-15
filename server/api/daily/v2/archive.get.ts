import { DAILY2_LAUNCH_DATE, dailyFormationFor, dailyWeekday } from '#shared/daily2-rules';
import type { DailyArchiveItem, DailyArchiveResponse } from '#shared/daily2-types';
import { addDays, isValidDateString } from '#shared/uk-date';
import { readHistogram } from '../../../utils/daily2-ledger';
import { getPuzzle, ukYesterday } from '../../../utils/daily2-puzzle';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;

// GET /api/daily/v2/archive?before=YYYY-MM-DD&limit=30 — past Dailies,
// newest first, from UK yesterday back to DAILY2_LAUNCH_DATE. `before` pages
// further back (exclusive). Each item's objective value comes from the frozen
// puzzle (generated and frozen now if nobody played that day); `players` is
// how many ranked scores that day has (null if none).
export default defineEventHandler(async (event): Promise<DailyArchiveResponse> => {
    const query = getQuery(event);
    const yesterday = ukYesterday();
    let newest = yesterday;

    if (query.before !== undefined && query.before !== '') {
        if (!isValidDateString(query.before)) {
            throw createError({ statusCode: 400, statusMessage: 'bad_date' });
        }

        newest = query.before <= yesterday ? addDays(query.before, -1) : yesterday;
    }

    const rawLimit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
    const limit = Number.isInteger(rawLimit) ? Math.min(MAX_LIMIT, Math.max(1, rawLimit)) : DEFAULT_LIMIT;
    const items: DailyArchiveItem[] = [];
    let date = newest;

    while (items.length < limit && date >= DAILY2_LAUNCH_DATE) {
        const [puzzle, histogram] = await Promise.all([getPuzzle(date), readHistogram(date)]);

        items.push({
            date,
            weekday: dailyWeekday(date),
            formationCode: dailyFormationFor(date),
            objective: puzzle.objective,
            players: histogram ? histogram.n : null,
        });
        date = addDays(date, -1);
    }

    setResponseHeader(event, 'cache-control', 'public, max-age=300, s-maxage=600');

    return { items, nextBefore: items.length === limit && date >= DAILY2_LAUNCH_DATE ? items[items.length - 1]!.date : null };
});
