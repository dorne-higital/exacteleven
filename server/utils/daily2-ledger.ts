// The ranked-Daily ledger in the Daily store (server/utils/daily2-store.ts):
//
//   run/{date}/{installId}       { runId, startedAt, submitted? }  first STARTED run per install = the ranked one
//   hist/{date}                  { n, counts[1001] }               index = score
//   week/{monday}/{installId}    { scores: { [date]: score } }
//   weekhist/{monday}            { n, counts[701] }                bin = floor(week total / 10)
//
// Writes are conditional (onlyIfNew / onlyIfMatch) and retried up to 5 times
// with 20-80 ms jitter, so concurrent submits don't lose each other's scores.
// If a histogram write still gives up, the submit succeeds anyway and the
// percentile comes from the last read plus this player's own score.
import { DAILY_POINTS, mondayOf } from '#shared/daily2-rules';
import type { DailyPercentile, DailySubmitResponse } from '#shared/daily2-types';
import { type DailyKv, dailyKv } from './daily2-store';

export const SCORE_BINS = DAILY_POINTS.win + 1; // 0..1000
export const WEEK_BINS = 701; // week totals 0..7000 in tens
const MAX_RETRIES = 5;

export interface RunRecord {
    runId: string;
    startedAt: string;
    submitted?: DailySubmitResponse;
}

export interface Histogram {
    n: number;
    counts: number[];
}

export interface WeekRecord {
    scores: Record<string, number>;
}

/** Retry pause; swapped out in tests. */
let pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export function setLedgerPauseForTests(fn: ((ms: number) => Promise<void>) | null): void {
    pause = fn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
}

function jitter(): Promise<void> {
    return pause(20 + Math.floor(Math.random() * 61));
}

const runKey = (date: string, installId: string): string => `run/${date}/${installId}`;
const histKey = (date: string): string => `hist/${date}`;
const weekKey = (monday: string, installId: string): string => `week/${monday}/${installId}`;
const weekHistKey = (monday: string): string => `weekhist/${monday}`;

/**
 * Read-modify-write with optimistic concurrency. `update` returns the new
 * value (or null to leave it alone). Returns the value written, or — after
 * MAX_RETRIES lost races — null plus the last value read.
 */
async function casUpdate<T>(
    kv: DailyKv,
    key: string,
    update: (current: T | null) => T | null,
): Promise<{ written: T | null; lastRead: T | null }> {
    let lastRead: T | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        const current = await kv.getJSON<T>(key);

        lastRead = current?.value ?? null;

        const next = update(lastRead);

        if (next === null) {
            return { written: null, lastRead };
        }

        const result = await kv.setJSON(key, next, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });

        if (result.modified) {
            return { written: next, lastRead };
        }

        await jitter();
    }

    return { written: null, lastRead };
}

export async function readRun(date: string, installId: string, kv: DailyKv = dailyKv()): Promise<{ record: RunRecord; etag: string } | null> {
    const found = await kv.getJSON<RunRecord>(runKey(date, installId));

    return found ? { record: found.value, etag: found.etag } : null;
}

/**
 * Registers `runId` as this install's run for `date` unless one is already
 * there. Returns the record that holds the slot — this run's if it's the
 * first (or a retry of the first), otherwise the earlier run's.
 */
export async function claimRun(date: string, installId: string, runId: string, kv: DailyKv = dailyKv()): Promise<{ record: RunRecord; etag: string }> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
        const existing = await readRun(date, installId, kv);

        if (existing) {
            return existing;
        }

        const record: RunRecord = { runId, startedAt: new Date().toISOString() };
        const write = await kv.setJSON(runKey(date, installId), record, { onlyIfNew: true });

        if (write.modified) {
            return { record, etag: write.etag ?? '' };
        }
    }

    // Only reachable if the store keeps refusing writes while reporting no record.
    throw createError({ statusCode: 503, statusMessage: 'ledger_busy' });
}

/**
 * Stores the submit response on the run record. Returns the response that
 * ended up stored — someone else's if a concurrent submit of the same run
 * got there first.
 */
export async function storeSubmitted(
    date: string,
    installId: string,
    response: DailySubmitResponse,
    kv: DailyKv = dailyKv(),
): Promise<{ stored: DailySubmitResponse; mine: boolean }> {
    const outcome = { stored: response, mine: true };

    await casUpdate<RunRecord>(kv, runKey(date, installId), (current) => {
        if (current?.submitted) {
            outcome.stored = current.submitted;
            outcome.mine = false;

            return null;
        }

        return { runId: current?.runId ?? '', startedAt: current?.startedAt ?? new Date().toISOString(), submitted: response };
    });

    return outcome;
}

function emptyHistogram(size: number): Histogram {
    return { n: 0, counts: new Array<number>(size).fill(0) };
}

function clampBin(value: number, size: number): number {
    return Math.max(0, Math.min(size - 1, Math.floor(value)));
}

/**
 * "You beat N% of players": `below` = scores strictly lower than yours, `n`
 * counts you. `included` says whether your score is already in the histogram
 * (ranked, after the write); otherwise you're added on top (unranked, or a
 * histogram write that gave up).
 */
export function percentileFrom(histogram: Histogram | null, bin: number, included: boolean): DailyPercentile {
    const base = histogram ?? emptyHistogram(bin + 1);
    let below = 0;

    for (let index = 0; index < Math.min(bin, base.counts.length); index += 1) {
        below += base.counts[index] ?? 0;
    }

    const n = base.n + (included ? 0 : 1);

    return { beatPct: n <= 1 ? null : Math.round((100 * below) / (n - 1)), players: n };
}

/** The value at a quantile of a histogram (bin index), or null when empty. */
export function histogramQuantile(histogram: Histogram | null, quantile: number): number | null {
    if (!histogram || histogram.n === 0) {
        return null;
    }

    const target = Math.floor(quantile * (histogram.n - 1));
    let cumulative = 0;

    for (let index = 0; index < histogram.counts.length; index += 1) {
        cumulative += histogram.counts[index] ?? 0;

        if (cumulative > target) {
            return index;
        }
    }

    return histogram.counts.length - 1;
}

export async function readHistogram(date: string, kv: DailyKv = dailyKv()): Promise<Histogram | null> {
    return (await kv.getJSON<Histogram>(histKey(date)))?.value ?? null;
}

export async function readWeekHistogram(monday: string, kv: DailyKv = dailyKv()): Promise<Histogram | null> {
    return (await kv.getJSON<Histogram>(weekHistKey(monday)))?.value ?? null;
}

export async function readWeek(monday: string, installId: string, kv: DailyKv = dailyKv()): Promise<WeekRecord | null> {
    return (await kv.getJSON<WeekRecord>(weekKey(monday, installId)))?.value ?? null;
}

/** Adds a ranked score to `hist/{date}` and returns this player's percentile. */
export async function addScore(date: string, score: number, kv: DailyKv = dailyKv()): Promise<DailyPercentile> {
    const bin = clampBin(score, SCORE_BINS);
    const { written, lastRead } = await casUpdate<Histogram>(kv, histKey(date), (current) => {
        const next = current ? { n: current.n, counts: [...current.counts] } : emptyHistogram(SCORE_BINS);

        next.n += 1;
        next.counts[bin] = (next.counts[bin] ?? 0) + 1;

        return next;
    });

    return written ? percentileFrom(written, bin, true) : percentileFrom(lastRead, bin, false);
}

/**
 * Adds a ranked day score to this install's week, and moves the install from
 * its old week-total bin to its new one in `weekhist/{monday}`.
 */
export async function addWeekScore(date: string, installId: string, score: number, kv: DailyKv = dailyKv()): Promise<void> {
    const monday = mondayOf(date);
    // Filled in by the update callback (an object, so the closure's writes are visible below).
    const totals: { previous: number | null; next: number } = { previous: null, next: score };

    const { written } = await casUpdate<WeekRecord>(kv, weekKey(monday, installId), (current) => {
        if (current && current.scores[date] !== undefined) {
            return null; // already counted
        }

        const scores = { ...(current?.scores ?? {}), [date]: score };

        totals.previous = current ? Object.values(current.scores).reduce((sum, value) => sum + value, 0) : null;
        totals.next = Object.values(scores).reduce((sum, value) => sum + value, 0);

        return { scores };
    });

    if (!written) {
        return;
    }

    const oldBin = totals.previous === null ? null : clampBin(totals.previous / 10, WEEK_BINS);
    const newBin = clampBin(totals.next / 10, WEEK_BINS);

    await casUpdate<Histogram>(kv, weekHistKey(monday), (current) => {
        const next = current ? { n: current.n, counts: [...current.counts] } : emptyHistogram(WEEK_BINS);

        if (oldBin === null) {
            next.n += 1;
        } else {
            next.counts[oldBin] = Math.max(0, (next.counts[oldBin] ?? 0) - 1);
        }

        next.counts[newBin] = (next.counts[newBin] ?? 0) + 1;

        return next;
    });
}

export function weekBin(total: number): number {
    return clampBin(total / 10, WEEK_BINS);
}

export function scoreBin(score: number): number {
    return clampBin(score, SCORE_BINS);
}
