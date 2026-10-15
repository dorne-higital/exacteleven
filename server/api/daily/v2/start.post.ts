import type { DailyStartResponse } from '#shared/daily2-types';
import { claimRun } from '../../../utils/daily2-ledger';
import { requireDailyDate, requireId, ukToday } from '../../../utils/daily2-puzzle';

// POST /api/daily/v2/start — registers a run. Only the FIRST run STARTED per
// anonymous install id per UK day is ranked, so start → peek → restart can't
// produce a ranked score. Retrying with the same runId is idempotent. The
// client may play before this answers (offline); submit re-applies the rule.
// Errors: 400 bad_date / bad_install_id / bad_run_id, 403 not_yet, 404 before_launch.
export default defineEventHandler(async (event): Promise<DailyStartResponse> => {
    const body = await readBody<Record<string, unknown> | null>(event);
    const now = new Date();
    const date = requireDailyDate(body?.date, now);
    const installId = requireId(body?.installId, 'bad_install_id');
    const runId = requireId(body?.runId, 'bad_run_id');

    if (body?.archive === true) {
        return { ranked: false, reason: 'archive' };
    }

    if (date !== ukToday(now)) {
        return { ranked: false, reason: 'not_today' };
    }

    const { record } = await claimRun(date, installId, runId);

    return record.runId === runId ? { ranked: true } : { ranked: false, reason: 'not_first', firstRunId: record.runId };
});
