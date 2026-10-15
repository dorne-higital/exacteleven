import { DAILY2_LAUNCH_DATE, dailyFormationFor, dailyWeekday, mondayOf } from '#shared/daily2-rules';
import type { WeeklyRecap } from '#shared/daily2-types';
import { addDays, isValidDateString } from '#shared/uk-date';
import {
    histogramQuantile,
    percentileFrom,
    readHistogram,
    readWeek,
    readWeekHistogram,
    scoreBin,
    weekBin,
} from '../../../utils/daily2-ledger';
import { getPuzzle, ID_PATTERN, ukToday } from '../../../utils/daily2-puzzle';

// GET /api/daily/v2/week?start=YYYY-MM-DD[&installId=] — the Sunday recap:
// each day's player count, median and 90th percentile against your score,
// plus the week total against everyone's. `start` must be a Monday on or
// before today (default: this week's Monday). Days after today and before
// launch are left out. Without an installId, every `you` is null.
export default defineEventHandler(async (event): Promise<WeeklyRecap> => {
    const query = getQuery(event);
    const today = ukToday();
    const start = query.start === undefined || query.start === '' ? mondayOf(today) : query.start;

    if (!isValidDateString(start) || dailyWeekday(start) !== 0) {
        throw createError({ statusCode: 400, statusMessage: 'bad_date' });
    }

    if (start > today) {
        throw createError({ statusCode: 403, statusMessage: 'not_yet' });
    }

    const installId = typeof query.installId === 'string' && ID_PATTERN.test(query.installId) ? query.installId : null;
    const [week, weekHistogram] = await Promise.all([
        installId ? readWeek(start, installId) : Promise.resolve(null),
        readWeekHistogram(start),
    ]);
    const days: WeeklyRecap['days'] = [];

    for (let offset = 0; offset < 7; offset += 1) {
        const date = addDays(start, offset);

        if (date > today || date < DAILY2_LAUNCH_DATE) {
            continue;
        }

        const [puzzle, histogram] = await Promise.all([getPuzzle(date), readHistogram(date)]);
        const yourScore = week?.scores[date];

        days.push({
            date,
            weekday: dailyWeekday(date),
            formationCode: dailyFormationFor(date),
            objective: puzzle.objective,
            players: histogram?.n ?? 0,
            median: histogramQuantile(histogram, 0.5),
            p90: histogramQuantile(histogram, 0.9),
            you: yourScore === undefined ? null : { score: yourScore, beatPct: percentileFrom(histogram, scoreBin(yourScore), true).beatPct },
        });
    }

    const scores = week ? Object.values(week.scores) : [];
    const total = scores.reduce((sum, score) => sum + score, 0);
    const weekMedianBin = histogramQuantile(weekHistogram, 0.5);

    setResponseHeader(event, 'cache-control', 'no-store');

    return {
        start,
        end: addDays(start, 6),
        days,
        week: {
            players: weekHistogram?.n ?? 0,
            median: weekMedianBin === null ? null : weekMedianBin * 10,
            you: scores.length === 0 ? null : { total, played: scores.length, beatPct: percentileFrom(weekHistogram, weekBin(total), true).beatPct },
        },
    };
});
