import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDailyEngine } from '../shared/daily2-rules';
import type {
    DailyActionResponse,
    DailyArchiveResponse,
    DailyMove,
    DailyPercentile,
    DailyPuzzle,
    DailySubmitResponse,
    WeeklyRecap,
} from '../shared/daily2-types';
import { addScore, percentileFrom, readHistogram, setLedgerPauseForTests } from '../server/utils/daily2-ledger';
import { clearPuzzleMemoForTests, getPuzzle, type ServerDaily, serverDaily } from '../server/utils/daily2-puzzle';
import { createMemoryKv, type DailyKv, setDailyKvForTests } from '../server/utils/daily2-store';

// The Daily 2.0 routes end to end against an in-memory KV (the same
// implementation the server uses off-Netlify). Nitro globals are stubbed
// before the route modules load, as in tests/api-routes.test.ts.
const headers = new Map<string, string>();

vi.stubGlobal('defineEventHandler', (handler: (event: unknown) => unknown) => handler);
vi.stubGlobal('createError', (options: { statusCode: number; statusMessage?: string }) => (
    Object.assign(new Error(options.statusMessage ?? 'error'), options)
));
vi.stubGlobal('useRuntimeConfig', () => ({ drawTokenSecret: 'test-secret' }));
vi.stubGlobal('getQuery', (event: { query: Record<string, unknown> }) => event.query);
vi.stubGlobal('readBody', async (event: { body: unknown }) => event.body);
vi.stubGlobal('setResponseHeader', (_event: unknown, name: string, value: string) => {
    headers.set(name, value);
});

const getDaily = (await import('../server/api/daily/v2/index.get')).default;
const start = (await import('../server/api/daily/v2/start.post')).default;
const action = (await import('../server/api/daily/v2/action.post')).default;
const submit = (await import('../server/api/daily/v2/submit.post')).default;
const percentile = (await import('../server/api/daily/v2/percentile.get')).default;
const archive = (await import('../server/api/daily/v2/archive.get')).default;
const week = (await import('../server/api/daily/v2/week.get')).default;

// Wednesday 14 Oct 2026, two days after launch (Mon 12 Oct).
const TODAY = '2026-10-14';
const YESTERDAY = '2026-10-13';
const INSTALL = 'install-0001';

let kv: DailyKv;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    kv = createMemoryKv();
    setDailyKvForTests(kv);
    setLedgerPauseForTests(async () => undefined);
    headers.clear();
});

afterEach(() => {
    vi.useRealTimers();
    setDailyKvForTests(null);
    setLedgerPauseForTests(null);
    clearPuzzleMemoForTests();
});

const q = (query: Record<string, unknown>) => ({ query });
const b = (body: unknown) => ({ body });

/**
 * A finished move log: blind captain on the first open slot, then option
 * `choice` in every slot (taking any bust). Different choices usually give
 * different scores.
 */
function playThrough(daily: ServerDaily, choice = 0): DailyMove[] {
    const engine = createDailyEngine(daily.view, daily.valueOf, daily.subFor);
    const moves: DailyMove[] = [];
    const apply = (move: DailyMove): void => {
        expect(engine.apply(move)).toBeNull();
        moves.push(move);
    };

    apply({ t: 'captain', slotId: daily.view.slots[0]!.slotId });

    for (const slot of daily.view.slots) {
        if (engine.snapshot().status !== 'playing') {
            break;
        }

        apply({ t: 'pick', slotId: slot.slotId, playerId: slot.main[choice % slot.main.length]! });

        if (engine.snapshot().pendingBust) {
            apply({ t: 'acceptBust' });
        }
    }

    expect(engine.snapshot().status).not.toBe('playing');

    return moves;
}

async function today(date = TODAY): Promise<ServerDaily> {
    return serverDaily(await getPuzzle(date));
}

function submitBody(moves: DailyMove[], overrides: Record<string, unknown> = {}) {
    return { date: TODAY, runId: 'run-000001', installId: INSTALL, moves, platform: 'web', ...overrides };
}

describe('GET /api/daily/v2', () => {
    it('serves UK today: every open slot\'s options with no hidden numbers, locked players in full', async () => {
        const puzzle = await getDaily(q({})) as DailyPuzzle;

        expect(puzzle).toMatchObject({ v: 2, date: TODAY, weekday: 2, isToday: true, nextDailyAt: '2026-10-14T23:00:00.000Z' });
        expect(puzzle.objective).toMatchObject({ kind: 'exact', stat: 'ga', value: Number(puzzle.formationCode) });
        expect(puzzle.locked.length + puzzle.slots.length).toBe(11);

        for (const slot of puzzle.slots) {
            expect(slot.options).toHaveLength(3);

            for (const option of slot.options) {
                expect(option).not.toHaveProperty('goals');
                expect(option).not.toHaveProperty('assists');
                expect(option).not.toHaveProperty('position');
            }
        }

        for (const locked of puzzle.locked) {
            expect(locked.player).toHaveProperty('goals');
        }

        // Nothing in the payload leaks the reroll sets or the subs.
        const full = await getPuzzle(TODAY);
        const json = JSON.stringify(puzzle);

        for (const slot of full.slots) {
            expect(json).not.toContain(slot.sub.id);

            for (const player of slot.reroll) {
                expect(json).not.toContain(player.id);
            }
        }

        expect(headers.get('cache-control')).toBe('public, max-age=60, s-maxage=600');
    });

    it('serves a past date as the archive puzzle with a long cache', async () => {
        const puzzle = await getDaily(q({ date: YESTERDAY })) as DailyPuzzle;

        expect(puzzle.isToday).toBe(false);
        expect(puzzle.weekday).toBe(1);
        expect(puzzle.objective.kind).toBe('allUnder');
        expect(headers.get('cache-control')).toBe('public, max-age=3600, s-maxage=86400');
    });

    it('is the same for everyone, and frozen: a second instance reads the stored puzzle', async () => {
        const first = await getDaily(q({})) as DailyPuzzle;

        clearPuzzleMemoForTests();

        const second = await getDaily(q({})) as DailyPuzzle;

        expect(second).toEqual(first);
        expect(await kv.getJSON(`puzzle/${TODAY}`)).not.toBeNull();
    });

    it('serves the frozen copy even if the player data would now generate something else', async () => {
        const real = await getPuzzle(TODAY);
        const doctored = { ...real, objective: { ...real.objective, value: 999, label: 'Land exactly on 999' } };

        // A different blob for the date (as if generated from older data).
        setDailyKvForTests(createMemoryKv());
        await (await import('../server/utils/daily2-store')).dailyKv().setJSON(`puzzle/${TODAY}`, doctored);
        clearPuzzleMemoForTests();

        expect((await getDaily(q({})) as DailyPuzzle).objective.value).toBe(999);
    });

    it('rejects a bad date (400), tomorrow (403 not_yet) and dates before launch (404), never caching them', async () => {
        await expect(getDaily(q({ date: '2026-13-01' }))).rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_date' });
        await expect(getDaily(q({ date: '2026-10-15' }))).rejects.toMatchObject({ statusCode: 403, statusMessage: 'not_yet' });
        await expect(getDaily(q({ date: '2026-10-11' }))).rejects.toMatchObject({ statusCode: 404, statusMessage: 'before_launch' });
        expect(headers.get('cache-control')).toBeUndefined();
    });

    it('follows UK midnight, not UTC: 23:30Z in BST is already tomorrow', async () => {
        vi.setSystemTime(new Date('2026-10-14T23:30:00Z'));

        expect((await getDaily(q({})) as DailyPuzzle).date).toBe('2026-10-15');
    });
});

describe('fairness and integrity', () => {
    // Every object path in a response that carries goals/assists.
    function statPaths(value: unknown, path = '$'): string[] {
        if (Array.isArray(value)) {
            return value.flatMap((item, index) => statPaths(item, `${path}[${index}]`));
        }

        if (value && typeof value === 'object') {
            return Object.entries(value).flatMap(([key, child]) => (
                key === 'goals' || key === 'assists' ? [`${path}.${key}`] : statPaths(child, `${path}.${key}`)
            ));
        }

        return [];
    }

    it('two server instances with separate stores generate the identical puzzle for the same UK date', async () => {
        const first = await getDaily(q({})) as DailyPuzzle;

        clearPuzzleMemoForTests();
        setDailyKvForTests(createMemoryKv());

        const second = await getDaily(q({})) as DailyPuzzle;

        expect(second).toEqual(first);
    });

    it('no pre-reveal response carries goals or assists anywhere except locked players', async () => {
        const daily = await today();
        const [first, second] = daily.puzzle.slots;
        const puzzle = await getDaily(q({})) as DailyPuzzle;
        const started = await start(b({ date: TODAY, installId: INSTALL, runId: 'run-000001' }));
        const rerolled = await action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'reroll', slotId: first!.slotId }] }));
        const clued = await action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'clue', slotId: second!.slotId, playerId: second!.main[0]!.id }] }));
        const captained = await action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'captain', slotId: first!.slotId }] }));

        expect(statPaths(puzzle).every((path) => /^\$\.locked\[\d+\]\.player\.(goals|assists)$/.test(path))).toBe(true);

        for (const response of [started, rerolled, clued, captained]) {
            expect(statPaths(response)).toEqual([]);
        }

        // The clue is a band, never the number.
        expect(JSON.stringify(clued)).not.toMatch(/"value"\s*:/);
    });

    it('the score the client shows (shared engine) is the score the server ranks', async () => {
        const daily = await today();

        for (const choice of [0, 1, 2]) {
            const moves = playThrough(daily, choice);
            const engine = createDailyEngine(daily.view, daily.valueOf, daily.subFor);

            moves.forEach((move) => engine.apply(move));

            const result = await submit(b(submitBody(moves, { runId: `run-00000${choice}`, installId: `install-000${choice}` }))) as DailySubmitResponse;

            expect(result.score.score).toBe(engine.snapshot().score);
        }
    });
});

describe('POST /api/daily/v2/start', () => {
    it('ranks only the first run started per install per day; retries are idempotent', async () => {
        await expect(start(b({ date: TODAY, installId: INSTALL, runId: 'run-first01' }))).resolves.toEqual({ ranked: true });
        await expect(start(b({ date: TODAY, installId: INSTALL, runId: 'run-first01' }))).resolves.toEqual({ ranked: true });
        await expect(start(b({ date: TODAY, installId: INSTALL, runId: 'run-second1' })))
            .resolves.toEqual({ ranked: false, reason: 'not_first', firstRunId: 'run-first01' });
        // Another install is unaffected.
        await expect(start(b({ date: TODAY, installId: 'install-0002', runId: 'run-second1' }))).resolves.toEqual({ ranked: true });
    });

    it('never ranks archive or past-date runs', async () => {
        await expect(start(b({ date: YESTERDAY, installId: INSTALL, runId: 'run-first01', archive: true }))).resolves.toEqual({ ranked: false, reason: 'archive' });
        await expect(start(b({ date: YESTERDAY, installId: INSTALL, runId: 'run-first01' }))).resolves.toEqual({ ranked: false, reason: 'not_today' });
        expect(await kv.getJSON(`run/${YESTERDAY}/${INSTALL}`)).toBeNull();
    });

    it('validates ids and dates', async () => {
        await expect(start(b({ date: TODAY, installId: 'short', runId: 'run-first01' }))).rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_install_id' });
        await expect(start(b({ date: TODAY, installId: INSTALL, runId: 'bad id!!' }))).rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_run_id' });
        await expect(start(b({ date: '2026-10-15', installId: INSTALL, runId: 'run-first01' }))).rejects.toMatchObject({ statusCode: 403, statusMessage: 'not_yet' });
    });
});

describe('POST /api/daily/v2/action', () => {
    it('a reroll returns the slot\'s fixed reroll set, names only', async () => {
        const daily = await today();
        const slot = daily.puzzle.slots[0]!;
        const result = await action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'reroll', slotId: slot.slotId }] })) as DailyActionResponse;

        expect(result.reroll!.slotId).toBe(slot.slotId);
        expect(result.reroll!.options.map((option) => option.id)).toEqual(slot.reroll.map((player) => player.id));
        expect(result.reroll!.options[0]).not.toHaveProperty('goals');
        expect(result.snapshot).toMatchObject({ rerolledSlotId: slot.slotId, helps: { reroll: true, clue: false, bench: false } });
    });

    it('a clue returns the raw band of one shown option', async () => {
        const daily = await today();
        const slot = daily.puzzle.slots[1]!;
        const target = slot.main[2]!;
        const result = await action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'clue', slotId: slot.slotId, playerId: target.id }] })) as DailyActionResponse;
        const value = target.goals + target.assists;

        expect(result.clue!.playerId).toBe(target.id);
        expect(result.clue!.band.min).toBeLessThanOrEqual(value);
        expect(result.clue!.band.max === null || result.clue!.band.max >= value).toBe(true);
        expect(result).not.toHaveProperty('reroll');
    });

    it('the bench reveals the mystery sub in full; captain and acceptBust return a snapshot only', async () => {
        const daily = await today();
        const [first, second] = daily.puzzle.slots;
        const moves: DailyMove[] = [
            { t: 'pick', slotId: first!.slotId, playerId: first!.main[0]!.id },
            { t: 'captain', slotId: second!.slotId },
        ];
        const captained = await action(b({ date: TODAY, runId: 'run-000001', moves })) as DailyActionResponse;

        expect(captained.snapshot).toMatchObject({ captainSlotId: second!.slotId, captainBlind: true });
        expect(Object.keys(captained).sort()).toEqual(['snapshot', 'winOdds']);

        const benched = await action(b({ date: TODAY, runId: 'run-000001', moves: [...moves, { t: 'bench', slotId: first!.slotId }] })) as DailyActionResponse;

        expect(benched.bench).toEqual({ slotId: first!.slotId, outId: first!.main[0]!.id, sub: first!.sub });
    });

    it('returns the engine\'s error code for an illegal move, and refuses a pick here', async () => {
        const daily = await today();
        const slot = daily.puzzle.slots[0]!;

        await expect(action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'reroll', slotId: slot.slotId }, { t: 'reroll', slotId: slot.slotId }] })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'reroll_used' });
        await expect(action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'acceptBust' }] })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'no_pending_bust' });
        await expect(action(b({ date: TODAY, runId: 'run-000001', moves: [{ t: 'pick', slotId: slot.slotId, playerId: slot.main[0]!.id }] })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_move' });
        await expect(action(b({ date: TODAY, runId: 'run-000001', moves: 'nope' })))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_move' });
    });
});

describe('POST /api/daily/v2/submit', () => {
    it('scores on the server, ranks the first run and builds the full time', async () => {
        const daily = await today();
        const moves = playThrough(daily);
        const result = await submit(b(submitBody(moves))) as DailySubmitResponse;

        expect(result.ranked).toBe(true);
        expect(result.score.score).toBeGreaterThanOrEqual(0);
        expect(result.score.score).toBeLessThanOrEqual(1000);
        // First player in: nobody to beat yet.
        expect(result.percentile).toEqual({ beatPct: null, players: 1 });
        expect(result.fullTime.totalXIs).toBe(3 ** daily.puzzle.slots.length);
        expect(result.fullTime.perfectXIs).toBeGreaterThan(0);
        expect(result.fullTime.grid).toHaveLength(11);
        expect(result.fullTime.bestXI.picks).toHaveLength(11);
        expect(result.fullTime.passedOn.every((entry) => entry.set === 'main')).toBe(true);
        expect((await readHistogram(TODAY, kv))!.n).toBe(1);
    });

    it('a resubmit of the same run returns the stored response, without counting twice', async () => {
        const moves = playThrough(await today());
        const first = await submit(b(submitBody(moves))) as DailySubmitResponse;
        const again = await submit(b(submitBody(moves))) as DailySubmitResponse;

        expect(again).toEqual({ ...first, alreadySubmitted: true });
        expect((await readHistogram(TODAY, kv))!.n).toBe(1);
    });

    it('a second run on the same install is unranked (not_first) and only reads the table', async () => {
        const daily = await today();

        await start(b({ date: TODAY, installId: INSTALL, runId: 'run-000001' }));
        await submit(b(submitBody(playThrough(daily, 0))));

        const second = await submit(b(submitBody(playThrough(daily, 1), { runId: 'run-000002' }))) as DailySubmitResponse;

        expect(second).toMatchObject({ ranked: false, reason: 'not_first' });
        expect(second.percentile!.players).toBe(2); // the table's 1 plus this score, read-only
        expect((await readHistogram(TODAY, kv))!.n).toBe(1);
    });

    it('a started-then-abandoned run still holds the ranked slot (no start, peek, restart)', async () => {
        const daily = await today();

        await start(b({ date: TODAY, installId: INSTALL, runId: 'run-peeked1' }));

        const result = await submit(b(submitBody(playThrough(daily), { runId: 'run-replay1' }))) as DailySubmitResponse;

        expect(result).toMatchObject({ ranked: false, reason: 'not_first' });
    });

    it('works with no /start at all (offline play), creating the run record', async () => {
        const result = await submit(b(submitBody(playThrough(await today())))) as DailySubmitResponse;

        expect(result.ranked).toBe(true);
        expect(await kv.getJSON(`run/${TODAY}/${INSTALL}`)).toMatchObject({ value: { runId: 'run-000001' } });
    });

    it('ranks yesterday\'s game finished after midnight; anything older is late', async () => {
        const yesterday = await today(YESTERDAY);
        const ranked = await submit(b(submitBody(playThrough(yesterday), { date: YESTERDAY }))) as DailySubmitResponse;

        expect(ranked.ranked).toBe(true);

        vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));

        const late = await submit(b(submitBody(playThrough(yesterday), { date: YESTERDAY, installId: 'install-0002' }))) as DailySubmitResponse;

        expect(late).toMatchObject({ ranked: false, reason: 'late' });
        expect(late.percentile).toEqual({ beatPct: expect.any(Number), players: 2 });
    });

    it('archive games are scored but never ranked or written', async () => {
        const result = await submit(b(submitBody(playThrough(await today(YESTERDAY)), { date: YESTERDAY, archive: true }))) as DailySubmitResponse;

        expect(result).toMatchObject({ ranked: false, reason: 'archive' });
        expect(result.percentile).toBeNull(); // nobody played that day
        expect(await readHistogram(YESTERDAY, kv)).toBeNull();
        expect(await kv.getJSON(`run/${YESTERDAY}/${INSTALL}`)).toBeNull();
    });

    it('refuses an unfinished game, an illegal log and future dates', async () => {
        const daily = await today();
        const slot = daily.puzzle.slots[0]!;

        await expect(submit(b(submitBody([{ t: 'pick', slotId: slot.slotId, playerId: slot.main[0]!.id }]))))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_move' });
        await expect(submit(b(submitBody([{ t: 'pick', slotId: slot.slotId, playerId: 'not-a-player' }]))))
            .rejects.toMatchObject({ statusCode: 400, statusMessage: 'not_offered' });
        await expect(submit(b(submitBody([], { date: '2026-10-15' })))).rejects.toMatchObject({ statusCode: 403, statusMessage: 'not_yet' });
    });
});

describe('percentile maths and the histogram', () => {
    it('beatPct = scores strictly below ÷ (n − 1), n including you', async () => {
        await addScore(TODAY, 100, kv);
        await addScore(TODAY, 300, kv);
        await addScore(TODAY, 300, kv);

        expect(await addScore(TODAY, 500, kv)).toEqual({ beatPct: 100, players: 4 });
        expect(await addScore(TODAY, 300, kv)).toEqual({ beatPct: 25, players: 5 }); // beats only the 100 of 4 others
        expect(await addScore(TODAY, 0, kv)).toEqual({ beatPct: 0, players: 6 });
    });

    it('percentileFrom adds an unranked score on top of the table', () => {
        const histogram = { n: 2, counts: [0, 1, 0, 1] };

        expect(percentileFrom(histogram, 2, false)).toEqual({ beatPct: 50, players: 3 });
        expect(percentileFrom(null, 2, false)).toEqual({ beatPct: null, players: 1 });
    });

    it('retries a histogram write that lost an etag race, so neither score is lost', async () => {
        const inner = createMemoryKv();
        let raced = false;
        const racing: DailyKv = {
            getJSON: (key) => inner.getJSON(key),
            async setJSON(key, value, opts) {
                if (key.startsWith('hist/') && !raced) {
                    raced = true;
                    // Someone else's submit lands between our read and write.
                    await inner.setJSON(key, { n: 1, counts: Object.assign(new Array(1001).fill(0), { 900: 1 }) });
                }

                return inner.setJSON(key, value, opts);
            },
        };

        const mine = await addScore(TODAY, 950, racing);

        expect(mine).toEqual({ beatPct: 100, players: 2 });
        expect((await readHistogram(TODAY, inner))!.n).toBe(2);
    });

    it('gives up after 5 lost races but still answers from the last read plus your score', async () => {
        const inner = createMemoryKv();

        await inner.setJSON(`hist/${TODAY}`, { n: 1, counts: Object.assign(new Array(1001).fill(0), { 400: 1 }) });

        const refusing: DailyKv = {
            getJSON: (key) => inner.getJSON(key),
            setJSON: async () => ({ modified: false }),
        };

        expect(await addScore(TODAY, 600, refusing)).toEqual({ beatPct: 100, players: 2 });
    });

    it('GET /percentile reads without writing, and does not double-count your own ranked score', async () => {
        const daily = await today();
        const mine = await submit(b(submitBody(playThrough(daily)))) as DailySubmitResponse;

        await submit(b(submitBody(playThrough(daily, 1), { installId: 'install-0002', runId: 'run-000002' })));

        const asOther = await percentile(q({ date: TODAY, score: String(mine.score.score) })) as DailyPercentile;
        const asMe = await percentile(q({ date: TODAY, score: String(mine.score.score), installId: INSTALL })) as DailyPercentile;

        expect(asOther.players).toBe(3);
        expect(asMe.players).toBe(2);
        expect((await readHistogram(TODAY, kv))!.n).toBe(2);
        await expect(percentile(q({ date: TODAY, score: '1001' }))).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('GET /api/daily/v2/archive', () => {
    it('lists UK yesterday back to launch, newest first, with player counts', async () => {
        await submit(b(submitBody(playThrough(await today(YESTERDAY)), { date: YESTERDAY })));

        const result = await archive(q({})) as DailyArchiveResponse;

        expect(result.items.map((item) => item.date)).toEqual([YESTERDAY, '2026-10-12']);
        expect(result.items[0]).toMatchObject({ weekday: 1, players: 1 });
        expect(result.items[1]).toMatchObject({ weekday: 0, players: null, objective: { kind: 'over' } });
        expect(result.nextBefore).toBeNull();
    });

    it('pages with before and limit', async () => {
        const page = await archive(q({ limit: '1' })) as DailyArchiveResponse;

        expect(page.items.map((item) => item.date)).toEqual([YESTERDAY]);
        expect(page.nextBefore).toBe(YESTERDAY);

        const next = await archive(q({ before: page.nextBefore, limit: '1' })) as DailyArchiveResponse;

        expect(next.items.map((item) => item.date)).toEqual(['2026-10-12']);
        expect(next.nextBefore).toBeNull();
        await expect(archive(q({ before: 'nope' }))).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('GET /api/daily/v2/week', () => {
    it('recaps your week against everyone\'s, leaving out days still to come', async () => {
        const monday = await today('2026-10-12');
        const mondayRun = await submit(b(submitBody(playThrough(monday), { date: '2026-10-12' }))) as DailySubmitResponse;

        // Monday is "late" by Wednesday, so seed it the way a Monday submit would have.
        expect(mondayRun.reason).toBe('late');
        vi.setSystemTime(new Date('2026-10-12T20:00:00Z'));
        await submit(b(submitBody(playThrough(monday), { date: '2026-10-12' })));
        vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));

        const wednesday = await submit(b(submitBody(playThrough(await today())))) as DailySubmitResponse;
        const recap = await week(q({ start: '2026-10-12', installId: INSTALL })) as WeeklyRecap;

        expect(recap.start).toBe('2026-10-12');
        expect(recap.end).toBe('2026-10-18');
        expect(recap.days.map((day) => day.date)).toEqual(['2026-10-12', YESTERDAY, TODAY]);
        expect(recap.days[1]).toMatchObject({ players: 0, median: null, you: null });
        expect(recap.days[2]).toMatchObject({ players: 1, median: wednesday.score.score, you: { score: wednesday.score.score, beatPct: null } });
        expect(recap.week.players).toBe(1);
        expect(recap.week.you).toMatchObject({ played: 2, total: mondayRun.score.score + wednesday.score.score });
    });

    it('needs a Monday that isn\'t in the future; no installId means no "you"', async () => {
        await expect(week(q({ start: TODAY }))).rejects.toMatchObject({ statusCode: 400, statusMessage: 'bad_date' });
        await expect(week(q({ start: '2026-10-19' }))).rejects.toMatchObject({ statusCode: 403, statusMessage: 'not_yet' });

        const recap = await week(q({})) as WeeklyRecap;

        expect(recap.start).toBe('2026-10-12');
        expect(recap.week.you).toBeNull();
    });
});
