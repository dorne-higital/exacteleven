import { scoreDaily } from '#shared/daily2-rules';
import type { DailySubmitResponse } from '#shared/daily2-types';
import {
    addScore,
    addWeekScore,
    claimRun,
    percentileFrom,
    readHistogram,
    scoreBin,
    storeSubmitted,
} from '../../../utils/daily2-ledger';
import {
    buildFullTime,
    getPuzzle,
    replayOrThrow,
    requireDailyDate,
    requireId,
    requireMoves,
    serverDaily,
    ukToday,
    ukYesterday,
} from '../../../utils/daily2-puzzle';

// POST /api/daily/v2/submit — the end of a Daily 2.0 game. The SERVER
// computes the score, from the move log and the real stats (never trusting a
// client score), builds the full-time reveal, and decides whether it's ranked:
// - not an archive game;
// - for UK today or yesterday (a game finished just after midnight still counts) — else 'late';
// - this run is the install's first started run for the date (created now if /start never got through) — else 'not_first';
// - not already submitted (a resubmit returns the stored response, alreadySubmitted: true).
// Ranked scores go into the day and week histograms. Unranked ones only read
// them ("on the day you'd have beaten N%").
// Honesty level, stated plainly: one ranked run per anonymous install id per
// day, moves must be internally consistent, the score is server-side. A fresh
// install id or shared answers still get round it — the table is for fun.
export default defineEventHandler(async (event): Promise<DailySubmitResponse> => {
    const body = await readBody<Record<string, unknown> | null>(event);
    const now = new Date();
    const date = requireDailyDate(body?.date, now);
    const runId = requireId(body?.runId, 'bad_run_id');
    const installId = requireId(body?.installId, 'bad_install_id');
    const moves = requireMoves(body?.moves);
    const archive = body?.archive === true;

    const daily = serverDaily(await getPuzzle(date));
    const { snapshot } = replayOrThrow(daily, moves);

    if (snapshot.status === 'playing') {
        throw createError({ statusCode: 400, statusMessage: 'bad_move' });
    }

    const score = scoreDaily(snapshot, daily.puzzle.objective);
    const fullTime = buildFullTime(daily, moves, snapshot);

    const unranked = async (reason: DailySubmitResponse['reason']): Promise<DailySubmitResponse> => {
        const histogram = await readHistogram(date);

        return {
            ranked: false,
            reason,
            score,
            percentile: histogram && histogram.n > 0 ? percentileFrom(histogram, scoreBin(score.score), false) : null,
            fullTime,
        };
    };

    if (archive) {
        return unranked('archive');
    }

    if (date !== ukToday(now) && date !== ukYesterday(now)) {
        return unranked('late');
    }

    const { record } = await claimRun(date, installId, runId);

    if (record.runId !== runId) {
        return unranked('not_first');
    }

    if (record.submitted) {
        return { ...record.submitted, alreadySubmitted: true };
    }

    const percentile = await addScore(date, score.score);

    await addWeekScore(date, installId, score.score);

    const response: DailySubmitResponse = { ranked: true, score, percentile, fullTime };
    const { stored, mine } = await storeSubmitted(date, installId, response);

    return mine ? response : { ...stored, alreadySubmitted: true };
});
