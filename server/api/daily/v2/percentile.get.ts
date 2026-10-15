import type { DailyPercentile } from '#shared/daily2-types';
import { percentileFrom, readHistogram, readRun, scoreBin } from '../../../utils/daily2-ledger';
import { ID_PATTERN, requireDailyDate } from '../../../utils/daily2-puzzle';

// GET /api/daily/v2/percentile?date&score[&installId] — read-only "you beat
// N%" for a score: refreshes the full-time screen later, and gives archive
// games their "on the day you'd have beaten N%". Optional installId (additive
// to the spec'd contract): when that install's ranked score for the date is
// this score, it's already in the histogram and isn't counted twice.
export default defineEventHandler(async (event): Promise<DailyPercentile> => {
    const query = getQuery(event);
    const date = requireDailyDate(query.date);
    const score = Number(query.score);

    if (!Number.isInteger(score) || score < 0 || score > 1000) {
        throw createError({ statusCode: 400, statusMessage: 'bad_score' });
    }

    const histogram = await readHistogram(date);
    let included = false;

    if (typeof query.installId === 'string' && ID_PATTERN.test(query.installId)) {
        const run = await readRun(date, query.installId);

        included = run?.record.submitted?.ranked === true && run.record.submitted.score.score === score;
    }

    setResponseHeader(event, 'cache-control', 'no-store');

    return percentileFrom(histogram, scoreBin(score), included);
});
