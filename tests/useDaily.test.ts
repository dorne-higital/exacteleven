import { computed, ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAILY2_STORAGE_KEY, DAILY_ARCHIVE_STORAGE_KEY, useDaily } from '../app/composables/useDaily';
import { resetPickRouteForTests, useGame } from '../app/composables/useGame';
import { usePurchases } from '../app/composables/usePurchases';
import { useStats } from '../app/composables/useStats';
import { dayStatValue, replayDaily, scoreDaily, shareLevels } from '../shared/daily2-rules';
import type { DailyView } from '../shared/daily2-rules';
import type { DailyMove, DailyPuzzle, DailySubmitResponse, PuzzleOption } from '../shared/daily2-types';
import type { Player, PositionGroup } from '../shared/types';
import { getFormation } from '../app/utils/formations';

// Same fakeUseState / $fetch stubbing as useGame.test.ts, with $fetch backed
// by a small fake Daily 2.0 server that runs the REAL shared engine
// (replayDaily / scoreDaily / shareLevels) against the true stats — so these
// tests exercise the composable against the same rules the server uses.
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

const TODAY = '2026-10-14'; // a Wednesday

// 4-3-3 with def-1 and mid-1 locked (10 each), target: exactly 120 G+A.
// Every open slot offers a = 0, b = 10, c = 60; its reroll set is 1/2/3 and
// its mystery sub is worth 4.
const OPEN_SLOTS = ['gk', 'def-2', 'def-3', 'def-4', 'mid-2', 'mid-3', 'fwd-1', 'fwd-2', 'fwd-3'];
const MAIN_VALUES = { a: 0, b: 10, c: 60 } as const;
const REROLL_VALUES = { x: 1, y: 2, z: 3 } as const;
const SUB_VALUE = 4;

function groupOf(slotId: string): PositionGroup {
    return slotId === 'gk' ? 'GK' : (slotId.slice(0, 3).toUpperCase() as PositionGroup);
}

function tag(slotId: string): string {
    return slotId.replace('-', '');
}

function option(id: string): PuzzleOption {
    return { id, name: `Player ${id}`, clubs: ['Test FC'], firstSeason: 2010, lastSeason: 2020, appearances: 100 };
}

function fullPlayer(id: string, slotId: string, goals: number): Player {
    return { ...option(id), position: groupOf(slotId), goals, assists: 0 };
}

const truth = new Map<string, number>();
const subs = new Map<string, Player>();
const rerolls = new Map<string, PuzzleOption[]>();

for (const slotId of OPEN_SLOTS) {
    for (const [letter, value] of Object.entries(MAIN_VALUES)) {
        truth.set(`${tag(slotId)}${letter}`, value);
    }

    for (const [letter, value] of Object.entries(REROLL_VALUES)) {
        truth.set(`${tag(slotId)}${letter}`, value);
    }

    rerolls.set(slotId, Object.keys(REROLL_VALUES).map((letter) => option(`${tag(slotId)}${letter}`)));
    subs.set(slotId, fullPlayer(`${tag(slotId)}sub`, slotId, SUB_VALUE));
    truth.set(`${tag(slotId)}sub`, SUB_VALUE);
}

function makePuzzle(date = TODAY): DailyPuzzle {
    return {
        v: 2,
        date,
        weekday: 2,
        formationCode: '433',
        objective: { kind: 'exact', stat: 'ga', value: 120, label: 'Land exactly on 120' },
        locked: [
            { slotId: 'def-1', player: fullPlayer('lockdef', 'def-1', 10) },
            { slotId: 'mid-1', player: fullPlayer('lockmid', 'mid-1', 10) },
        ],
        slots: OPEN_SLOTS.map((slotId) => ({
            slotId,
            group: groupOf(slotId),
            options: Object.keys(MAIN_VALUES).map((letter) => option(`${tag(slotId)}${letter}`)),
        })),
        rules: {
            rerolls: 1, clues: 1, benches: 1, clueMinOpenSlots: 3, captainRequired: true,
            points: { win: 1000, reroll: 50, clue: 50, bench: 100, missMax: 700, missFloor: 275, bustPerSlot: 25 },
            clueBands: [],
        },
        isToday: date === TODAY,
        nextDailyAt: '2026-10-14T23:00:00.000Z',
    };
}

const SERVER_VIEW: DailyView = {
    objective: { kind: 'exact', value: 120 },
    locked: [{ slotId: 'def-1', value: 10 }, { slotId: 'mid-1', value: 10 }],
    slots: OPEN_SLOTS.map((slotId) => ({
        slotId,
        main: Object.keys(MAIN_VALUES).map((letter) => `${tag(slotId)}${letter}`),
        reroll: Object.keys(REROLL_VALUES).map((letter) => `${tag(slotId)}${letter}`),
    })),
};

const valueOf = (id: string) => truth.get(id);
const subFor = (slotId: string) => subs.get(slotId)?.id;

function replayOrThrow(moves: DailyMove[]) {
    const replay = replayDaily(SERVER_VIEW, moves, valueOf, subFor);

    if (!replay.ok) {
        throw { statusCode: 400, statusMessage: replay.error };
    }

    return replay.snapshot;
}

interface ServerControls {
    puzzleStatus: number | null;
    submitFailures: number;
    /** Answer /start and /submit as a practice (not ranked) run. */
    forceUnranked: boolean;
    calls: Array<{ url: string; body?: Record<string, unknown>; query?: Record<string, unknown> }>;
}

const server: ServerControls = { puzzleStatus: null, submitFailures: 0, forceUnranked: false, calls: [] };

function fakeServer(url: string, options: { body?: Record<string, unknown>; query?: Record<string, unknown> } = {}): unknown {
    server.calls.push({ url, body: options.body, query: options.query });

    const moves = (options.body?.moves ?? []) as DailyMove[];

    switch (url) {
        case '/api/app-config':
            return { minBuild: 0, latestBuild: 0, serverTime: `${TODAY}T12:00:00Z`, dailyDate: TODAY, ukDate: TODAY, nextDailyAt: '2026-10-14T23:00:00.000Z' };
        case '/api/daily/v2':
            if (server.puzzleStatus) {
                throw { statusCode: server.puzzleStatus, statusMessage: 'before_launch' };
            }

            return makePuzzle(String(options.query?.date ?? TODAY));
        case '/api/daily/v2/start':
            if (server.forceUnranked) {
                return { ranked: false, reason: 'not_first' };
            }

            return options.body?.archive ? { ranked: false, reason: 'archive' } : { ranked: true };
        case '/api/pick': {
            const snapshot = replayOrThrow(moves);
            const last = moves.at(-1)!;

            if (last.t !== 'pick') {
                throw { statusCode: 400, statusMessage: 'bad_move' };
            }

            return { status: 'ok', reveal: { goals: truth.get(last.playerId)!, assists: 0, playerId: last.playerId }, snapshot, winOdds: null };
        }
        case '/api/daily/v2/action': {
            const snapshot = replayOrThrow(moves);
            const last = moves.at(-1)!;

            if (last.t === 'reroll') {
                return { snapshot, winOdds: null, reroll: { slotId: last.slotId, options: rerolls.get(last.slotId) } };
            }

            if (last.t === 'clue') {
                const band = snapshot.clue!.band;

                return { snapshot, winOdds: null, clue: { slotId: last.slotId, playerId: last.playerId, band: { id: band, label: band, min: 0, max: null } } };
            }

            if (last.t === 'bench') {
                return { snapshot, winOdds: null, bench: { slotId: last.slotId, outId: snapshot.bench!.outId, sub: subs.get(last.slotId) } };
            }

            return { snapshot, winOdds: null };
        }
        case '/api/daily/v2/submit': {
            if (server.submitFailures > 0) {
                server.submitFailures -= 1;
                throw new TypeError('Load failed');
            }

            const snapshot = replayOrThrow(moves);
            const formation = getFormation('433')!;
            const response: DailySubmitResponse = {
                ranked: !options.body?.archive && !server.forceUnranked,
                ...(options.body?.archive ? { reason: 'archive' as const } : {}),
                score: scoreDaily(snapshot, SERVER_VIEW.objective),
                percentile: { beatPct: 60, players: 10 },
                fullTime: {
                    perfectXIs: 3,
                    totalXIs: 19683,
                    bestXI: { picks: [], captainSlotId: 'gk', total: 120 },
                    yourXI: [],
                    passedOn: [],
                    grid: shareLevels(SERVER_VIEW, moves, valueOf, subFor, formation.slots.map((slot) => ({ slotId: slot.id, group: slot.group }))),
                },
            };

            return response;
        }
        case '/api/daily/v2/percentile':
            return { beatPct: 80, players: 20 };
        case '/api/daily/v2/archive':
            return { items: [{ date: '2026-10-13', weekday: 1, formationCode: '352', objective: makePuzzle().objective, players: 4 }], nextBefore: null };
        case '/api/daily/v2/week':
            return { start: String(options.query?.start), end: '', days: [], week: { players: 0, median: null, you: null } };
        default:
            throw { statusCode: 404 };
    }
}

const fetchMock = vi.fn();

beforeEach(() => {
    stateStore.clear();
    window.localStorage.clear();
    window.sessionStorage.clear();
    server.puzzleStatus = null;
    server.submitFailures = 0;
    server.forceUnranked = false;
    server.calls = [];
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string, options?: { body?: Record<string, unknown>; query?: Record<string, unknown> }) => (
        Promise.resolve().then(() => fakeServer(url, options))
    ));
    vi.stubGlobal('useState', fakeUseState);
    vi.stubGlobal('$fetch', fetchMock);
    vi.stubGlobal('useStats', useStats);
    resetPickRouteForTests();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function callsTo(url: string) {
    return server.calls.filter((call) => call.url === url);
}

async function flush(): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
        await Promise.resolve();
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
}

async function loadToday() {
    const daily = useDaily();
    const game = useGame();

    await daily.loadToday();
    await flush();

    return { daily, game };
}

// Picks option `letter` in `slotId` through useGame's own functions, the way
// the choice sheet does.
async function pick(slotId: string, letter: string) {
    const game = useGame();

    await game.openSlot(slotId);

    const chosen = game.state.value!.offeredPlayers.find((candidate) => candidate.id === `${tag(slotId)}${letter}`)!;
    const result = await game.pickPlayer(chosen);

    game.closeDialog();

    return result;
}

describe('useDaily — loading', () => {
    it('loads today\'s puzzle up front, starts a ranked run and saves it under its own key', async () => {
        const { daily, game } = await loadToday();
        const state = game.state.value!;

        expect(game.isDailyV2.value).toBe(true);
        expect(state.dailyDate).toBe(TODAY);
        expect(state.objective).toMatchObject({ kind: 'exact', value: 120, stat: 'ga' });
        expect(state.slots.filter((slot) => slot.preset).map((slot) => slot.id)).toEqual(['def-1', 'mid-1']);
        expect(state.total).toBe(20);
        expect(state.offeredBySlot?.gk?.map((candidate) => candidate.id)).toEqual(['gka', 'gkb', 'gkc']);

        const start = callsTo('/api/daily/v2/start')[0]!;

        expect(start.body).toMatchObject({ date: TODAY, runId: state.gameId });
        expect(start.body!.installId).toMatch(/^[\w-]{8,64}$/);
        expect(daily.isRanked.value).toBe(true);
        expect(daily.rankReason.value).toBeNull();
        expect(JSON.parse(window.localStorage.getItem(DAILY2_STORAGE_KEY)!).date).toBe(TODAY);
        expect(window.localStorage.getItem('exact-xi-game')).toBeNull();
        expect(daily.countdown.value).toMatch(/^\d+h \d+m$|^\d+m$/);
    });

    it('resumes today\'s saved Daily instead of fetching it again, even after a Classic game', async () => {
        const first = await loadToday();

        await pick('gk', 'b');
        const runId = first.game.state.value!.gameId;

        first.game.startGame('442');
        expect(JSON.parse(window.localStorage.getItem('exact-xi-game')!).game.formationCode).toBe('442');

        server.calls = [];
        await useDaily().loadToday();

        expect(callsTo('/api/daily/v2')).toHaveLength(0);
        expect(useGame().state.value!.gameId).toBe(runId);
        expect(useGame().state.value!.slots.find((slot) => slot.id === 'gk')!.player?.id).toBe('gkb');
        expect(JSON.parse(window.localStorage.getItem('exact-xi-game')!).game.formationCode).toBe('442');
    });

    it('resumes a v1 Daily still in progress for today on the v1 flow', async () => {
        const game = useGame();

        game.startDailyGame({
            date: TODAY,
            formationCode: '442',
            objective: { kind: 'over', value: 350, label: 'Score over 350' },
            prefilled: [],
        });
        game.state.value = null;

        await useDaily().loadToday();

        expect(game.state.value!.daily2).toBeUndefined();
        expect(game.state.value!.dailyDate).toBe(TODAY);
        expect(callsTo('/api/daily/v2')).toHaveLength(0);
    });

    it('drops an unreadable or foreign Daily save and loads today\'s puzzle cleanly', async () => {
        window.localStorage.setItem('exact-xi-daily2', '{not json');
        await useDaily().loadToday();
        expect(useGame().state.value!.daily2?.puzzle.date).toBe(TODAY);

        stateStore.clear();
        window.localStorage.setItem('exact-xi-daily2', JSON.stringify({ date: TODAY, savedAt: Date.now(), game: { formationCode: '442', slots: [] } }));
        await useDaily().loadToday();
        expect(useGame().state.value!.daily2?.puzzle.date).toBe(TODAY);

        // Tagged as a v2 run but missing its move log / puzzle: discarded too.
        stateStore.clear();
        window.localStorage.setItem('exact-xi-daily2', JSON.stringify({
            date: TODAY,
            savedAt: Date.now(),
            game: { formationCode: '442', target: 0, slots: [], daily2: { v: 2 } },
        }));
        await useDaily().loadToday();
        expect(useGame().state.value!.daily2?.puzzle.date).toBe(TODAY);
        expect(useGame().state.value!.daily2?.moves).toEqual([]);
    });

    it('asks the page to fall back to the v1 Daily when v2 isn\'t there (404)', async () => {
        server.puzzleStatus = 404;

        const daily = useDaily();

        await daily.loadToday();

        expect(daily.fallbackToV1.value).toBe(true);
        expect(daily.loadError.value).toBeNull();
        expect(useGame().state.value).toBeNull();
    });
});

describe('useDaily — playing', () => {
    it('opens slots from the puzzle with no network, and picks through POST /api/pick with the move log', async () => {
        const { daily, game } = await loadToday();

        server.calls = [];
        await game.openSlot('gk');

        expect(server.calls).toHaveLength(0);
        expect(game.state.value!.offeredPlayers.map((candidate) => candidate.id)).toEqual(['gka', 'gkb', 'gkc']);

        const reveal = await game.pickPlayer(game.state.value!.offeredPlayers[1]!);

        expect(reveal).toEqual({ goals: 10, assists: 0 });
        expect(callsTo('/api/pick')[0]!.body).toMatchObject({ mode: 'daily', date: TODAY, moves: [{ t: 'pick', slotId: 'gk', playerId: 'gkb' }] });
        expect(game.state.value!.total).toBe(30);
        expect(daily.run.value!.moves).toHaveLength(1);
        expect(daily.run.value!.values.gkb).toEqual({ goals: 10, assists: 0 });
        expect(game.state.value!.offeredBySlot?.gk).toBeUndefined();

        await game.openNextSlot();
        expect(game.state.value!.activeSlotId).toBe('def-2');
        expect(server.calls.filter((call) => call.url !== '/api/pick')).toHaveLength(0);
    });

    it('gates the last pick behind the captain, then allows a blind captain on it', async () => {
        const { daily, game } = await loadToday();

        for (const slotId of OPEN_SLOTS.slice(0, -1)) {
            await pick(slotId, 'a');
        }

        expect(daily.needsCaptain.value).toBe(true);

        server.calls = [];
        expect(await pick('fwd-3', 'a')).toBeNull();
        expect(daily.actionError.value).toBe('captain_required');
        expect(server.calls).toHaveLength(0);

        expect(await daily.setCaptain('fwd-3')).toBe(true);
        expect(daily.captainSlotId.value).toBe('fwd-3');
        expect(daily.captainBlind.value).toBe(true);
        expect(daily.needsCaptain.value).toBe(false);

        await pick('fwd-3', 'b');

        // 20 locked + 8 × 0 + 10 doubled = 40: a completed miss.
        expect(game.state.value!.status).toBe('lost');
        expect(game.state.value!.total).toBe(40);
    });

    it('greys out a captain that would bust you, and locked slots', async () => {
        const { daily } = await loadToday();

        await pick('gk', 'c'); // total 80; doubling gk makes 140 > 120

        const options = new Map(daily.captainOptions.value.map((entry) => [entry.slotId, entry]));

        expect(options.get('gk')).toEqual({ slotId: 'gk', disabled: true, reason: 'would_bust' });
        expect(options.get('def-1')).toEqual({ slotId: 'def-1', disabled: true, reason: 'locked' });
        expect(options.get('def-2')).toEqual({ slotId: 'def-2', disabled: false });

        server.calls = [];
        expect(await daily.setCaptain('gk')).toBe(false);
        expect(daily.actionError.value).toBe('captain_would_bust');
        expect(server.calls).toHaveLength(0);
    });

    it('rerolls the open slot once, to its fixed reroll set', async () => {
        const { daily, game } = await loadToday();

        await game.openSlot('def-2');
        expect(game.canReroll.value).toEqual({ reason: 'free', freeLeft: 1 });
        expect(await game.useReroll()).toBe(true);

        expect(game.state.value!.offeredPlayers.map((candidate) => candidate.id)).toEqual(['def2x', 'def2y', 'def2z']);
        expect(daily.canReroll.value).toEqual({ available: false, reason: 'used' });
        expect(game.canReroll.value.reason).toBe('none');
        expect(game.state.value!.rerollsLeft).toBe(0);

        await game.pickPlayer(game.state.value!.offeredPlayers[2]!);
        expect(game.state.value!.total).toBe(23);
    });

    it('gives a scouting band for one option, once, and locks it with fewer than 3 slots open', async () => {
        const { daily, game } = await loadToday();

        await game.openSlot('gk');

        const band = await daily.useClue('gkc');

        expect(band?.id).toBe('b2');
        expect(daily.run.value!.clue).toMatchObject({ slotId: 'gk', playerId: 'gkc' });
        expect(daily.canClue.value).toEqual({ available: false, reason: 'used' });
        expect(game.canHint.value.reason).toBe('none');
        expect(await game.useHint()).toBeNull();
        expect(daily.projectedScore.value).toBe(275); // 700 × 20 / 120 = 117 − 50 → floor 275
    });

    it('locks the clue once fewer than 3 slots are open', async () => {
        const { daily } = await loadToday();

        for (const slotId of OPEN_SLOTS.slice(0, 7)) {
            await pick(slotId, 'a');
        }

        expect(daily.canClue.value).toEqual({ available: false, reason: 'locked' });
    });

    it('a busting pick waits for the bench, and the bench can rescue it', async () => {
        const { daily, game } = await loadToday();

        await pick('gk', 'c');
        await pick('def-2', 'c'); // 20 + 60 + 60 = 140 > 120

        expect(daily.pendingBust.value).toEqual({ slotId: 'def-2' });
        expect(game.state.value!.status).toBe('playing');
        expect(daily.canReroll.value).toEqual({ available: false, reason: 'pending_bust' });
        expect(daily.canBench.value).toEqual({ available: true });

        await game.openSlot('def-3');
        expect(game.state.value!.activeSlotId).toBeNull();

        const sub = await daily.useBench('def-2');

        expect(sub).toMatchObject({ id: 'def2sub', goals: SUB_VALUE, position: 'DEF' });
        expect(daily.benchedOut.value?.id).toBe('def2c');
        expect(daily.pendingBust.value).toBeNull();
        expect(game.state.value!.total).toBe(84);
        expect(game.state.value!.status).toBe('playing');
        expect(daily.canBench.value).toEqual({ available: false, reason: 'used' });
        expect(game.state.value!.slots.find((slot) => slot.id === 'def-2')!.player?.id).toBe('def2sub');
    });

    it('the ranked flag from /start reaches the screen (reactive, not a stale copy)', async () => {
        const daily = useDaily();
        const game = useGame();
        const ranked = computed(() => game.state.value?.daily2?.ranked ?? null);

        await daily.loadToday();
        expect(ranked.value).toBeNull();
        await flush();
        expect(ranked.value).toBe(true);
    });

    it('a practice (unranked) run never writes its percentile into stats', async () => {
        server.forceUnranked = true;

        const { daily } = await loadToday();
        const { stats } = useStats();

        await pick('gk', 'c');
        await pick('def-2', 'c');
        await daily.acceptBust();
        await flush();

        expect(callsTo('/api/daily/v2/submit')).toHaveLength(1);
        expect(stats.value.dailyScores.find((entry) => entry.date === TODAY)?.beatPct ?? null).toBeNull();
    });

    it('taking the bust ends the game, records stats once, and posts the score', async () => {
        const { daily, game } = await loadToday();
        const { stats } = useStats();

        await pick('gk', 'c');
        await pick('def-2', 'c');
        await daily.acceptBust();
        await flush();

        expect(game.state.value!.status).toBe('bust');
        expect(daily.snapshot.value!.score).toBe(75); // 3 filled before the bust (2 locked + gk) × 25
        expect(stats.value.dailyPlays).toBe(1);
        expect(stats.value.dailyStreak).toBe(1);
        expect(stats.value.dailyWinStreak).toBe(0);
        expect(stats.value.dailyScores).toEqual([{ date: TODAY, score: 75, status: 'bust', kind: 'exact', stat: 'ga', beatPct: 60, players: 10 }]);
        expect(daily.submitState.value).toBe('done');
        expect(daily.result.value!.score.score).toBe(75);
        expect(callsTo('/api/daily/v2/submit')[0]!.body).toMatchObject({ date: TODAY, platform: 'web' });
        expect(callsTo('/api/daily/v2/submit')[0]!.body).not.toHaveProperty('archive');
        expect(daily.shareGrid.value!.find((cell) => cell.slotId === 'def-2')!.level).toBe('bust');
    });

    it('a full winning game with a blind captain scores 1,000 and shares a grid', async () => {
        const { daily, game } = await loadToday();

        expect(await daily.setCaptain('gk')).toBe(true);
        await pick('gk', 'b'); // 10 × 2 → 40
        await pick('def-2', 'c'); // 100
        await pick('def-3', 'b'); // 110
        await pick('def-4', 'b'); // 120

        for (const slotId of OPEN_SLOTS.slice(4)) {
            await pick(slotId, 'a');
        }

        await flush();

        expect(game.state.value!.status).toBe('won');
        expect(daily.result.value!.score.score).toBe(1000);
        expect(useStats().stats.value.dailyWinStreak).toBe(1);

        const text = daily.shareText();

        expect(text.split('\n')[1]).toBe('Land exactly on 120 · 1000/1000 (C) blind · beat 60%');
        expect(text).not.toContain('Player');
    });

    it('keeps a finished Daily whose submit failed, and posts it on retry', async () => {
        const { daily } = await loadToday();

        server.submitFailures = 1;
        await pick('gk', 'c');
        await pick('def-2', 'c');
        await daily.acceptBust();
        await flush();

        expect(daily.submitState.value).toBe('failed');
        expect(useStats().stats.value.dailyPlays).toBe(1);
        expect(JSON.parse(window.localStorage.getItem(DAILY2_STORAGE_KEY)!).game.daily2.submit.state).toBe('failed');

        const response = await daily.submit();

        expect(response?.score.score).toBe(75);
        expect(daily.submitState.value).toBe('done');

        await daily.refreshPercentile();
        expect(daily.result.value!.percentile).toEqual({ beatPct: 80, players: 20 });
        expect(useStats().stats.value.dailyScores[0]).toMatchObject({ beatPct: 80, players: 20 });
    });

    it('maps a server rejection to its machine code without changing the game', async () => {
        const { daily, game } = await loadToday();

        fetchMock.mockImplementationOnce(() => Promise.reject({ statusCode: 400, statusMessage: 'not_offered' }));
        await game.openSlot('gk');
        expect(await game.pickPlayer(game.state.value!.offeredPlayers[0]!)).toBeNull();
        expect(daily.actionError.value).toBe('not_offered');
        expect(daily.run.value!.moves).toHaveLength(0);

        fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('offline')));
        expect(await game.pickPlayer(game.state.value!.offeredPlayers[0]!)).toBeNull();
        expect(daily.actionError.value).toBe('network');
    });
});

describe('useDaily — archive (Pro, unranked)', () => {
    function asProApp(): void {
        vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp: true } }));
        usePurchases().isPro.value = true;
    }

    it('is locked without Pro in the app', async () => {
        const daily = useDaily();

        expect(daily.archiveAvailable.value).toBe(false);
        await daily.loadArchive('2026-10-13');

        expect(daily.loadError.value).toMatch(/Pro/);
        expect(callsTo('/api/daily/v2')).toHaveLength(0);
    });

    it('never touches stats, streaks or today\'s saved Daily', async () => {
        asProApp();

        const daily = useDaily();

        expect(daily.archiveAvailable.value).toBe(true);
        await daily.loadArchive('2026-10-13');
        await flush();

        expect(daily.isArchive.value).toBe(true);
        expect(daily.isRanked.value).toBe(false);
        expect(daily.rankReason.value).toBe('archive');
        expect(callsTo('/api/daily/v2/start')[0]!.body).toMatchObject({ archive: true });

        await pick('gk', 'c');
        await pick('def-2', 'c');
        await daily.acceptBust();
        await flush();

        const { stats } = useStats();

        expect(stats.value.dailyPlays).toBe(0);
        expect(stats.value.lastDailyResultDate).toBeNull();
        expect(callsTo('/api/daily/v2/submit')[0]!.body).toMatchObject({ archive: true, platform: 'ios' });
        expect(daily.result.value!.ranked).toBe(false);
        expect(window.localStorage.getItem(DAILY2_STORAGE_KEY)).toBeNull();
        expect(JSON.parse(window.localStorage.getItem(DAILY_ARCHIVE_STORAGE_KEY)!).date).toBe('2026-10-13');
    });

    it('lists the archive', async () => {
        const daily = useDaily();

        await daily.loadArchiveList();

        expect(daily.archiveList.value.map((item) => item.date)).toEqual(['2026-10-13']);
        expect(callsTo('/api/daily/v2/archive')[0]!.query).toMatchObject({ limit: 30 });
    });
});

describe('useDaily — recap and countdown', () => {
    it('offers this week\'s recap on Sunday once played, and last week\'s all Monday', async () => {
        const daily = useDaily();
        const today = fakeUseState<string | null>('exact-xi-daily-today');

        today.value = '2026-10-14';
        expect(daily.recapAvailable.value).toBeNull();

        today.value = '2026-10-19'; // Monday
        expect(daily.recapAvailable.value).toBe('lastWeek');
        await daily.loadWeeklyRecap();
        expect(callsTo('/api/daily/v2/week')[0]!.query).toMatchObject({ start: '2026-10-12' });

        today.value = '2026-10-18'; // Sunday, not played yet
        expect(daily.recapAvailable.value).toBeNull();
        useStats().recordDailyOutcome('lost', '2026-10-18');
        expect(daily.recapAvailable.value).toBe('thisWeek');
    });

    it('scores helps by the shared engine: projected score while a bust is pending', async () => {
        const { daily } = await loadToday();

        await pick('gk', 'c');
        await pick('def-2', 'c');

        // 3 filled before the busting pick × 25.
        expect(daily.projectedScore.value).toBe(75);
        expect(dayStatValue({ goals: 3, assists: 4 }, 'assists')).toBe(4);
    });
});
