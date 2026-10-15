import type { DailyActionResponse } from '#shared/daily2-types';
import { clueBandFor } from '#shared/daily2-rules';
import {
    dailyWinOdds,
    getPuzzle,
    replayOrThrow,
    requireDailyDate,
    requireId,
    requireMoves,
    serverDaily,
    toPuzzleOption,
} from '../../../utils/daily2-puzzle';

// POST /api/daily/v2/action — every non-pick move (reroll, clue, captain,
// bench, acceptBust). The server replays the whole log with the true stats
// and validates the LAST move, so its snapshot and the client's never
// disagree. Returns only what that move reveals: the reroll set's names, the
// clue's band, or the mystery sub (in full — they're on the pitch now).
// Errors: 400 with a DailyMoveError code, 403 not_yet, 404 before_launch.
export default defineEventHandler(async (event): Promise<DailyActionResponse> => {
    const body = await readBody<Record<string, unknown> | null>(event);
    const date = requireDailyDate(body?.date);

    requireId(body?.runId, 'bad_run_id');

    const moves = requireMoves(body?.moves);
    const last = moves[moves.length - 1];

    if (!last || last.t === 'pick') {
        throw createError({ statusCode: 400, statusMessage: 'bad_move' });
    }

    const daily = serverDaily(await getPuzzle(date));
    const { snapshot } = replayOrThrow(daily, moves);
    const response: DailyActionResponse = { snapshot, winOdds: dailyWinOdds(daily, snapshot, moves) };

    if (last.t === 'reroll') {
        const slot = daily.puzzle.slots.find((candidate) => candidate.slotId === last.slotId)!;

        response.reroll = { slotId: slot.slotId, options: slot.reroll.map(toPuzzleOption) };
    } else if (last.t === 'clue') {
        response.clue = { slotId: last.slotId, playerId: last.playerId, band: clueBandFor(daily.valueOf(last.playerId)!) };
    } else if (last.t === 'bench' && snapshot.bench) {
        response.bench = { slotId: snapshot.bench.slotId, outId: snapshot.bench.outId, sub: daily.playerById.get(snapshot.bench.subId)! };
    }

    return response;
});
