import { computed } from 'vue';
import type {
    ClueBand,
    DailyActionResponse,
    DailyArchiveItem,
    DailyArchiveResponse,
    DailyMove,
    DailyMoveError,
    DailyPercentile,
    DailyPickResponse,
    DailyPuzzle,
    DailySnapshot,
    DailyStartResponse,
    DailySubmitResponse,
    PuzzleOption,
    ShareCell,
    WeeklyRecap,
} from '../../shared/daily2-types';
import type { DailyView } from '../../shared/daily2-rules';
import { dailyWeekday, dayStatValue, mondayOf, projectedDailyScore, replayDaily } from '#shared/daily2-rules';
import type { DailyRunState, DrawnPlayer, GameSlot, GameState, Player, RevealResult, WinOdds } from '../../shared/types';
import { trackEvent } from '../utils/analytics';
import { apiErrorMessage, apiErrorStatus, apiFetch, classifyApiError } from '../utils/api';
import { fetchAppConfig } from '../utils/app-config';
import { getFormation } from '../utils/formations';
import { submitStatsToGameCenter } from '../utils/game-center';
import { createGameId } from '../utils/game-id';
import { haptics } from '../utils/haptics';
import { getInstallId, restoreInstallId } from '../utils/install-id';
import { isAppBuild, isNativeApp, platformName } from '../utils/platform';
import { buildDailyShareText } from '../utils/share-daily';
import { addDays, formatCountdown, nextUkMidnight, resolveDailyDate } from '../utils/trusted-date';
import { usePurchases } from './usePurchases';
import { useStats } from './useStats';

// Daily 2.0 (DAILY2_SPEC): the same fixed options for everyone, a required
// captain, one reroll / scouting clue / bench, and a score out of 1,000.
//
// The whole puzzle arrives up front (names, clubs, seasons, appearances —
// never goals/assists), so opening a slot never waits on the network. The
// MOVE LOG is the source of truth: every pick and action sends the full log
// and the server replays it against the real stats (shared/daily2-rules.ts),
// returning the new snapshot. The client replays the same engine with the
// values it has seen, for previews only (which captain choices would bust
// you, the projected score).
//
// It shares useState('exact-xi-game') with useGame, so the pitch, slots and
// choice sheet keep working: useGame's openSlot/pickPlayer/closeDialog/
// useReroll/canReroll hand a v2 game to the functions here. A v2 game is
// saved under its own key (exact-xi-daily2, or exact-xi-daily-archive for an
// archive replay), never exact-xi-game, so a Classic game and the Daily
// can't overwrite each other.

export const DAILY2_STORAGE_KEY = 'exact-xi-daily2';
export const DAILY_ARCHIVE_STORAGE_KEY = 'exact-xi-daily-archive';
const V1_GAME_STORAGE_KEY = 'exact-xi-game';
const ARCHIVE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const V1_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOAD_ERROR_FALLBACK = 'Couldn\'t load today\'s Daily.';
const ARCHIVE_PAGE_SIZE = 30;

interface PersistedDaily {
    savedAt: number;
    date: string;
    game: GameState;
}

export type DailyHelpReason = 'used' | 'locked' | 'pending_bust' | 'game_over';

export interface DailyHelpState {
    available: boolean;
    reason?: DailyHelpReason;
}

export interface CaptainOption {
    slotId: string;
    disabled: boolean;
    reason?: 'locked' | 'would_bust';
}

/** A move the server (or the local preview) refused, or 'network' when it never answered. */
export type DailyActionError = DailyMoveError | 'network' | 'not_today';

export type DailyRankReason = 'archive' | 'not_first' | 'not_today' | 'late';

export function isDailyV2Game(game: Pick<GameState, 'daily2'> | null | undefined): boolean {
    return game?.daily2?.v === 2;
}

// Enough of a saved Daily 2.0 game for the board and replayDaily to run on
// it; anything less is corrupt storage and is discarded, not resumed.
function isResumableDaily2(game: GameState): boolean {
    const run = game.daily2;

    return isDailyV2Game(game)
        && Array.isArray(game.slots)
        && typeof game.target === 'number'
        && !!run && Array.isArray(run.moves)
        && !!run.puzzle && Array.isArray(run.puzzle.slots) && Array.isArray(run.puzzle.locked)
        && !!run.snapshot && typeof run.snapshot === 'object'
        && !!run.submit && typeof run.submit === 'object'
        && !!run.values && typeof run.values === 'object';
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export function writeDaily2Persisted(game: GameState): void {
    const run = game.daily2;

    if (!run) {
        return;
    }

    try {
        const record: PersistedDaily = { savedAt: Date.now(), date: run.puzzle.date, game };

        window.localStorage.setItem(run.archive ? DAILY_ARCHIVE_STORAGE_KEY : DAILY2_STORAGE_KEY, JSON.stringify(record));
    } catch {
        // Blocked storage: the Daily just won't survive a reload this time.
    }
}

function removeStored(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Nothing to clean up.
    }
}

// Today's (or yesterday's) v2 Daily, or an archive replay. A record for a day
// before UK yesterday is dropped (it can't be submitted ranked any more and
// would only shadow today's), an archive one after 24 hours.
export function readDaily2Persisted(key: string, today: string): PersistedDaily | null {
    try {
        const raw = window.localStorage.getItem(key);

        if (raw === null) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<PersistedDaily> | null;

        if (!parsed || typeof parsed !== 'object' || !parsed.game || !isResumableDaily2(parsed.game)
            || typeof parsed.date !== 'string' || !DATE_PATTERN.test(parsed.date)) {
            removeStored(key);

            return null;
        }

        const stale = key === DAILY_ARCHIVE_STORAGE_KEY
            ? Date.now() - Number(parsed.savedAt ?? 0) > ARCHIVE_MAX_AGE_MS
            : parsed.date < addDays(today, -1);

        if (stale) {
            removeStored(key);

            return null;
        }

        return parsed as PersistedDaily;
    } catch {
        return null;
    }
}

// A v1 Daily still saved under exact-xi-game (from before this build) —
// resumed on the v1 flow rather than replaced.
function readV1DailyGame(date: string): GameState | null {
    try {
        const raw = window.localStorage.getItem(V1_GAME_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) as { savedAt?: number; game?: GameState } | null : null;
        const game = parsed?.game;

        if (!game || game.daily2 || game.dailyDate !== date || Date.now() - Number(parsed?.savedAt ?? 0) > V1_MAX_AGE_MS) {
            return null;
        }

        return game;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

function toDrawn(option: PuzzleOption): DrawnPlayer {
    return { ...option, token: '' };
}

export function dailyViewFor(run: Pick<DailyRunState, 'puzzle' | 'rerollOptions'>): DailyView {
    const { puzzle } = run;
    const { stat } = puzzle.objective;

    return {
        objective: { kind: puzzle.objective.kind, value: puzzle.objective.value },
        locked: puzzle.locked.map(({ slotId, player }) => ({ slotId, value: dayStatValue(player, stat) })),
        slots: puzzle.slots.map((slot) => ({
            slotId: slot.slotId,
            main: slot.options.map((option) => option.id),
            reroll: run.rerollOptions?.slotId === slot.slotId ? run.rerollOptions.options.map((option) => option.id) : undefined,
        })),
    };
}

// Replays the log plus `extra` with what this device has seen revealed.
export function previewDaily(run: DailyRunState, extra: DailyMove[] = []) {
    const { stat } = run.puzzle.objective;
    const valueOf = (playerId: string) => {
        const revealed = run.values[playerId];

        return revealed ? dayStatValue(revealed, stat) : undefined;
    };
    const subFor = (slotId: string) => (run.sub && run.snapshot.bench?.slotId === slotId ? run.sub.id : undefined);

    return replayDaily(dailyViewFor(run), [...run.moves, ...extra], valueOf, subFor, { clueBand: run.clue?.band.id });
}

export function createDaily2State(puzzle: DailyPuzzle, installId: string, archive: boolean): GameState {
    const formation = getFormation(puzzle.formationCode);

    if (!formation) {
        throw new Error(`Unknown formation code: ${puzzle.formationCode}`);
    }

    const lockedBySlot = new Map(puzzle.locked.map((entry) => [entry.slotId, entry.player]));
    const runId = createGameId();
    const offeredBySlot = Object.fromEntries(puzzle.slots.map((slot) => [slot.slotId, slot.options.map(toDrawn)]));
    const run: DailyRunState = {
        v: 2,
        puzzle,
        runId,
        installId,
        // An archive replay is unranked from the start; today's waits for /start.
        ranked: archive ? false : null,
        archive,
        moves: [],
        values: {},
        snapshot: {
            status: 'playing',
            total: 0,
            filled: puzzle.locked.length,
            openSlotIds: puzzle.slots.map((slot) => slot.slotId),
            captainSlotId: null,
            captainBlind: false,
            rerolledSlotId: null,
            clue: null,
            bench: null,
            pendingBust: null,
            helps: { reroll: false, clue: false, bench: false },
            score: null,
        },
        submit: { state: 'idle' },
    };
    const initial = previewDaily(run);

    if (initial.ok) {
        run.snapshot = initial.snapshot;
    }

    const game: GameState = {
        gameId: runId,
        formationCode: puzzle.formationCode,
        target: formation.target,
        slots: formation.slots.map((slot) => {
            const player = lockedBySlot.get(slot.id) ?? null;

            return { ...slot, player, preset: player !== null };
        }),
        offeredPlayerIds: [
            ...puzzle.locked.map((entry) => entry.player.id),
            ...puzzle.slots.flatMap((slot) => slot.options.map((option) => option.id)),
        ],
        rerollsLeft: 1,
        hintsLeft: 1,
        total: run.snapshot.total,
        status: run.snapshot.status,
        tier: null,
        activeSlotId: null,
        offeredPlayers: [],
        offeredBySlot,
        statsRecorded: false,
        objective: { kind: puzzle.objective.kind, value: puzzle.objective.value, label: puzzle.objective.label, stat: puzzle.objective.stat },
        dailyDate: puzzle.date,
        daily2: run,
    };

    syncFromSnapshot(game, run.snapshot);

    return game;
}

// GameState's own fields mirror the server snapshot, so components that
// only know GameState (score bar, pitch, result panel) stay correct.
function syncFromSnapshot(game: GameState, snapshot: DailySnapshot): void {
    game.total = snapshot.total;
    game.status = snapshot.status;
    game.tier = null;
    game.rerollsLeft = snapshot.helps.reroll ? 0 : 1;
    game.hintsLeft = snapshot.helps.clue ? 0 : 1;
}

function helpsUsed(snapshot: DailySnapshot): number {
    return Number(snapshot.helps.reroll) + Number(snapshot.helps.clue) + Number(snapshot.helps.bench);
}

// The machine code a Daily route puts in statusMessage (DAILY2_SPEC §3), if any.
export function dailyErrorCode(error: unknown): string | null {
    if (typeof error !== 'object' || error === null) {
        return null;
    }

    const { statusMessage, data } = error as { statusMessage?: unknown; data?: { statusMessage?: unknown } };
    const code = typeof statusMessage === 'string' ? statusMessage : data?.statusMessage;

    return typeof code === 'string' && /^[a-z_]+$/.test(code) ? code : null;
}

function optionsOf(run: DailyRunState): PuzzleOption[] {
    return [...run.puzzle.slots.flatMap((slot) => slot.options), ...(run.rerollOptions?.options ?? [])];
}

function playerFromOption(option: Pick<PuzzleOption, 'id' | 'name' | 'clubs' | 'firstSeason' | 'lastSeason' | 'appearances'>, slot: GameSlot, reveal: RevealResult): Player {
    return {
        id: option.id,
        name: option.name,
        position: slot.group,
        clubs: option.clubs,
        firstSeason: option.firstSeason,
        lastSeason: option.lastSeason,
        appearances: option.appearances,
        goals: reveal.goals,
        assists: reveal.assists,
    };
}

// ---------------------------------------------------------------------------
// Background retry (online / app resume / tab visible)
// ---------------------------------------------------------------------------

let listenersBound = false;
let minuteTimer: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// The composable
// ---------------------------------------------------------------------------

export function useDaily() {
    const state = useState<GameState | null>('exact-xi-game', () => null);
    const winOdds = useState<WinOdds | null>('exact-xi-win-odds', () => null);
    const loading = useState<boolean>('exact-xi-daily-loading', () => false);
    const loadError = useState<string | null>('exact-xi-daily-load-error', () => null);
    // Set when GET /api/daily/v2 404s (a server without Daily 2.0, or a date
    // before DAILY2_LAUNCH_DATE): the page should load the v1 Daily instead.
    const fallbackToV1 = useState<boolean>('exact-xi-daily-fallback-v1', () => false);
    // True while a pick or action is in flight — moves must go one at a time,
    // since each one sends the whole log.
    const busy = useState<boolean>('exact-xi-daily-busy', () => false);
    const actionError = useState<DailyActionError | null>('exact-xi-daily-action-error', () => null);
    const rankReasonState = useState<DailyRankReason | null>('exact-xi-daily-rank-reason', () => null);
    // The UK date as the server last told us (falls back to the device's UK date).
    const today = useState<string | null>('exact-xi-daily-today', () => null);
    const configNextDailyAt = useState<string | null>('exact-xi-daily-next-at', () => null);
    const now = useState<number>('exact-xi-daily-now', () => Date.now());
    const newDailyOut = useState<boolean>('exact-xi-daily-new-out', () => false);
    const archiveList = useState<DailyArchiveItem[]>('exact-xi-daily-archive-list', () => []);
    const archiveNextBefore = useState<string | null>('exact-xi-daily-archive-next', () => null);
    const weeklyRecap = useState<WeeklyRecap | null>('exact-xi-daily-weekly-recap', () => null);
    const { stats, recordDailyOutcome, updateDailyScorePercentile } = useStats();
    const purchases = usePurchases();

    const game = computed(() => (isDailyV2Game(state.value) ? state.value : null));
    const run = computed<DailyRunState | null>(() => game.value?.daily2 ?? null);
    const puzzle = computed(() => run.value?.puzzle ?? null);
    const snapshot = computed(() => run.value?.snapshot ?? null);
    const isArchive = computed(() => run.value?.archive ?? false);
    const isRanked = computed(() => run.value?.ranked ?? null);
    const rankReason = computed<DailyRankReason | null>(() => {
        if (!run.value) {
            return null;
        }

        if (run.value.archive) {
            return 'archive';
        }

        return run.value.ranked === false ? (rankReasonState.value ?? run.value.submit.result?.reason ?? 'not_first') : null;
    });
    const captainSlotId = computed(() => snapshot.value?.captainSlotId ?? null);
    const captainBlind = computed(() => snapshot.value?.captainBlind ?? false);
    const pendingBust = computed(() => snapshot.value?.pendingBust ?? null);
    const isPlaying = computed(() => snapshot.value?.status === 'playing');

    const needsCaptain = computed(() => (
        !!snapshot.value && isPlaying.value && !snapshot.value.pendingBust
        && snapshot.value.openSlotIds.length === 1 && snapshot.value.captainSlotId === null
    ));

    const captainOptions = computed<CaptainOption[]>(() => {
        const current = game.value;
        const currentRun = run.value;

        if (!current || !currentRun) {
            return [];
        }

        const closed = !isPlaying.value || !!currentRun.snapshot.pendingBust || currentRun.snapshot.captainSlotId !== null;

        return current.slots.map((slot): CaptainOption => {
            if (slot.preset) {
                return { slotId: slot.id, disabled: true, reason: 'locked' };
            }

            if (closed) {
                return { slotId: slot.id, disabled: true };
            }

            if (!slot.player) {
                return { slotId: slot.id, disabled: false };
            }

            const preview = previewDaily(currentRun, [{ t: 'captain', slotId: slot.id }]);

            if (preview.ok) {
                return { slotId: slot.id, disabled: false };
            }

            return preview.error === 'captain_would_bust'
                ? { slotId: slot.id, disabled: true, reason: 'would_bust' }
                : { slotId: slot.id, disabled: true };
        });
    });

    function helpState(used: boolean, extraLock = false): DailyHelpState {
        if (!snapshot.value || !isPlaying.value) {
            return { available: false, reason: 'game_over' };
        }

        if (used) {
            return { available: false, reason: 'used' };
        }

        if (snapshot.value.pendingBust) {
            return { available: false, reason: 'pending_bust' };
        }

        if (extraLock) {
            return { available: false, reason: 'locked' };
        }

        return { available: true };
    }

    const canReroll = computed(() => helpState(snapshot.value?.helps.reroll ?? true));
    // The clue keeps the hint's lock: only while 3+ non-locked slots are open.
    const canClue = computed(() => helpState(
        snapshot.value?.helps.clue ?? true,
        (snapshot.value?.openSlotIds.length ?? 0) < (puzzle.value?.rules.clueMinOpenSlots ?? 3),
    ));
    const canBench = computed<DailyHelpState>(() => {
        const current = snapshot.value;

        if (!current || !isPlaying.value) {
            return { available: false, reason: 'game_over' };
        }

        if (current.helps.bench) {
            return { available: false, reason: 'used' };
        }

        // Allowed during a pending bust — that's its whole point. Otherwise
        // there must be one of your own revealed players to take off.
        const hasOwnPick = game.value?.slots.some((slot) => slot.player && !slot.preset) ?? false;

        return hasOwnPick ? { available: true } : { available: false };
    });

    const projectedScore = computed(() => (
        snapshot.value && puzzle.value ? projectedDailyScore(snapshot.value, puzzle.value.objective) : null
    ));

    // The player taken off by the bench (for "{sub} comes on for {out}").
    const benchedOut = computed<Player | null>(() => {
        const currentRun = run.value;
        const bench = currentRun?.snapshot.bench;
        const slot = bench ? game.value?.slots.find((candidate) => candidate.id === bench.slotId) : undefined;
        const option = bench && currentRun ? optionsOf(currentRun).find((candidate) => candidate.id === bench.outId) : undefined;
        const revealed = bench ? currentRun?.values[bench.outId] : undefined;

        return option && slot && revealed ? playerFromOption(option, slot, revealed) : null;
    });

    const result = computed<DailySubmitResponse | null>(() => run.value?.submit.result ?? null);
    const submitState = computed(() => run.value?.submit.state ?? 'idle');
    const shareGrid = computed<ShareCell[] | null>(() => result.value?.fullTime.grid ?? null);

    const archiveAvailable = computed(() => isAppBuild() && purchases.isPro.value);

    const todayDate = computed(() => today.value ?? resolveDailyDate(null, new Date(now.value)));

    const recapAvailable = computed<'thisWeek' | 'lastWeek' | null>(() => {
        const date = todayDate.value;
        const weekday = dailyWeekday(date);

        if (weekday === 0) {
            return 'lastWeek';
        }

        if (weekday !== 6) {
            return null;
        }

        const finishedToday = stats.value.lastDailyResultDate === date
            || (puzzle.value?.date === date && !run.value?.archive && !isPlaying.value);

        return finishedToday ? 'thisWeek' : null;
    });

    const nextDailyAt = computed<string | null>(() => {
        if (configNextDailyAt.value) {
            return configNextDailyAt.value;
        }

        if (puzzle.value?.isToday && puzzle.value.nextDailyAt) {
            return puzzle.value.nextDailyAt;
        }

        return import.meta.client ? nextUkMidnight(new Date(now.value)).toISOString() : null;
    });
    const countdown = computed(() => formatCountdown(nextDailyAt.value, now.value));

    function persist(target: GameState): void {
        writeDaily2Persisted(target);
    }

    function bindClientListeners(): void {
        if (!import.meta.client || listenersBound) {
            return;
        }

        listenersBound = true;
        minuteTimer = setInterval(() => {
            now.value = Date.now();
        }, 60_000);

        window.addEventListener('online', () => {
            void retryPendingSubmit();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                now.value = Date.now();
                void retryPendingSubmit();
                void checkForNewDaily();
            }
        });

        if (isNativeApp()) {
            import('@capacitor/app')
                .then(({ App }) => App.addListener('resume', () => {
                    now.value = Date.now();
                    void retryPendingSubmit();
                    void checkForNewDaily();
                }))
                .catch(() => {});
        }
    }

    // On resume / tab focus: has the UK date moved on? If the Daily on
    // screen is finished, the page can offer "New Daily is out".
    async function checkForNewDaily(): Promise<void> {
        const config = await fetchAppConfig({ fresh: true });
        const date = resolveDailyDate(config);

        configNextDailyAt.value = config?.nextDailyAt ?? null;

        if (today.value && date !== today.value) {
            today.value = date;

            const shown = puzzle.value;

            newDailyOut.value = !!shown && !run.value?.archive && shown.date < date && !isPlaying.value;
        }
    }

    // ---- loading --------------------------------------------------------

    async function startRun(target: GameState, announce: boolean): Promise<void> {
        const currentRun = target.daily2;

        if (!currentRun) {
            return;
        }

        try {
            const response = await apiFetch<DailyStartResponse>('/api/daily/v2/start', {
                method: 'POST',
                body: {
                    date: currentRun.puzzle.date,
                    installId: currentRun.installId,
                    runId: currentRun.runId,
                    ...(currentRun.archive ? { archive: true } : {}),
                },
            });

            currentRun.ranked = response.ranked;
            rankReasonState.value = response.reason ?? null;
            persist(target);
        } catch {
            // Offline or an old server: submit re-applies the same "first run
            // started" rule, so nothing is lost by playing on.
        }

        if (announce) {
            trackEvent('daily_start', {
                date: currentRun.puzzle.date,
                formation: currentRun.puzzle.formationCode,
                objective: currentRun.puzzle.objective.kind,
                daily_version: 2,
                kind: currentRun.puzzle.objective.kind,
                stat: currentRun.puzzle.objective.stat,
                ranked: currentRun.ranked,
                archive: currentRun.archive,
            });
        }
    }

    function startDaily2(nextPuzzle: DailyPuzzle, archive: boolean, installId: string): GameState {
        const created = createDaily2State(nextPuzzle, installId, archive);

        state.value = created;
        winOdds.value = null;
        actionError.value = null;
        rankReasonState.value = null;
        newDailyOut.value = false;
        persist(created);

        // Return the reactive proxy (not the raw object) so later updates made
        // by startRun / submitGame (ranked, submit state) reach the screen.
        return state.value ?? created;
    }

    function resumePersisted(record: PersistedDaily): void {
        state.value = record.game;
        winOdds.value = null;
        actionError.value = null;
        rankReasonState.value = record.game.daily2?.submit.result?.reason ?? null;
        trackEvent('daily_resume', { date: record.date, daily_version: 2, archive: !!record.game.daily2?.archive });

        // Work on the reactive proxy so ranked/submit updates re-render.
        const live = state.value ?? record.game;
        const resumed = live.daily2!;

        if (resumed.snapshot.status !== 'playing' && resumed.submit.state !== 'done') {
            void submitGame(live);
        } else if (resumed.ranked === null) {
            void startRun(live, false);
        }
    }

    async function fetchPuzzle(date: string): Promise<DailyPuzzle | null> {
        try {
            return await apiFetch<DailyPuzzle>('/api/daily/v2', { query: { date } });
        } catch (error) {
            if (apiErrorStatus(error) === 404) {
                fallbackToV1.value = true;
            } else {
                loadError.value = apiErrorMessage(classifyApiError(error), LOAD_ERROR_FALLBACK, 'try again');
            }

            return null;
        }
    }

    async function loadToday(): Promise<void> {
        bindClientListeners();
        loading.value = true;
        loadError.value = null;
        fallbackToV1.value = false;

        try {
            const config = await fetchAppConfig();
            const date = resolveDailyDate(config);

            today.value = date;
            configNextDailyAt.value = config?.nextDailyAt ?? null;
            newDailyOut.value = false;

            const installId = await restoreInstallId();
            const saved = readDaily2Persisted(DAILY2_STORAGE_KEY, date);

            // Today's, or yesterday's still in progress (it can still be
            // finished and submitted ranked until the end of today).
            if (saved && (saved.date === date || saved.game.status === 'playing')) {
                resumePersisted(saved);

                return;
            }

            const v1 = readV1DailyGame(date);

            if (v1) {
                state.value = v1;
                trackEvent('daily_resume', { date, daily_version: 1 });

                return;
            }

            const fetched = await fetchPuzzle(date);

            if (fetched) {
                void startRun(startDaily2(fetched, false, installId), true);
            }
        } finally {
            loading.value = false;
        }
    }

    // Archive replay (Pro, app only): unranked, never touches stats, streaks
    // or the table.
    async function loadArchive(date: string): Promise<void> {
        bindClientListeners();
        loadError.value = null;
        fallbackToV1.value = false;

        if (!archiveAvailable.value) {
            loadError.value = 'Replay every past Daily with Pro.';

            return;
        }

        loading.value = true;

        try {
            const saved = readDaily2Persisted(DAILY_ARCHIVE_STORAGE_KEY, todayDate.value);

            if (saved && saved.date === date) {
                resumePersisted(saved);

                return;
            }

            const fetched = await fetchPuzzle(date);

            if (fetched) {
                trackEvent('archive_start', { date });
                void startRun(startDaily2(fetched, true, getInstallId()), true);
            }
        } finally {
            loading.value = false;
        }
    }

    // ---- slots ------------------------------------------------------------

    function openSlot(slotId: string): void {
        const current = game.value;
        const currentRun = run.value;

        if (!current || !currentRun || !isPlaying.value || currentRun.snapshot.pendingBust || busy.value) {
            return;
        }

        const slot = current.slots.find((candidate) => candidate.id === slotId);

        if (!slot || slot.player || slot.preset) {
            return;
        }

        const options = current.offeredBySlot?.[slotId]
            ?? currentRun.puzzle.slots.find((candidate) => candidate.slotId === slotId)?.options.map(toDrawn)
            ?? [];

        current.activeSlotId = slotId;
        current.offeredPlayers = options;
        actionError.value = null;
        persist(current);
        trackEvent('slot_draw', { position: slot.group, formation: current.formationCode, mode: 'daily', daily_version: 2 });
    }

    function closeDialog(): void {
        const current = game.value;

        if (!current) {
            return;
        }

        current.activeSlotId = null;
        current.offeredPlayers = [];
        persist(current);
    }

    // ---- moves --------------------------------------------------------------

    function applySnapshot(current: GameState, next: DailySnapshot, odds: WinOdds | null | undefined): void {
        const currentRun = current.daily2!;
        const wasPlaying = currentRun.snapshot.status === 'playing';

        currentRun.snapshot = next;
        syncFromSnapshot(current, next);
        winOdds.value = next.status === 'playing' ? (odds ?? null) : null;

        if (wasPlaying && next.status !== 'playing') {
            finish(current);
        }
    }

    // Sends the log plus one move to a Daily route. The move is only added to
    // the log once the server has accepted it.
    async function send<T>(path: string, move: DailyMove, body: Record<string, unknown> = {}): Promise<T | null> {
        const currentRun = run.value;

        if (!currentRun || busy.value) {
            return null;
        }

        busy.value = true;
        actionError.value = null;

        try {
            return await apiFetch<T>(path, {
                method: 'POST',
                body: { ...body, date: currentRun.puzzle.date, runId: currentRun.runId, moves: [...currentRun.moves, move] },
            });
        } catch (error) {
            const code = dailyErrorCode(error);

            actionError.value = apiErrorStatus(error) === 400 && code ? code as DailyMoveError : (code === 'not_yet' ? 'not_today' : 'network');

            return null;
        } finally {
            busy.value = false;
        }
    }

    // Catches a move the engine would refuse before it costs a round trip.
    function precheck(move: DailyMove): boolean {
        const currentRun = run.value;

        if (!currentRun) {
            return false;
        }

        const preview = previewDaily(currentRun, [move]);

        // 'bad_move' locally just means a value isn't known yet (a pick's own
        // reveal, the sub) — the server decides those.
        if (!preview.ok && preview.error !== 'bad_move') {
            actionError.value = preview.error;

            return false;
        }

        return true;
    }

    async function pickPlayer(chosen: DrawnPlayer): Promise<RevealResult | 'timeout' | null> {
        const current = game.value;
        const slotId = current?.activeSlotId;
        const slot = slotId ? current?.slots.find((candidate) => candidate.id === slotId) : undefined;

        if (!current || !slot || slot.player || !isPlaying.value) {
            return null;
        }

        const move: DailyMove = { t: 'pick', slotId: slot.id, playerId: chosen.id };

        if (!precheck(move)) {
            return null;
        }

        const response = await send<DailyPickResponse>('/api/pick', move, { mode: 'daily' });

        if (!response || game.value !== current) {
            return null;
        }

        const currentRun = current.daily2!;
        const reveal: RevealResult = { goals: response.reveal.goals, assists: response.reveal.assists };

        currentRun.moves = [...currentRun.moves, move];
        currentRun.values = { ...currentRun.values, [chosen.id]: reveal };
        slot.player = playerFromOption(chosen, slot, reveal);

        if (current.offeredBySlot && slot.id in current.offeredBySlot) {
            const { [slot.id]: _filled, ...rest } = current.offeredBySlot;

            current.offeredBySlot = rest;
        }

        trackEvent('player_picked', { position: slot.group, playerId: chosen.id, formation: current.formationCode, mode: 'daily' });
        applySnapshot(current, response.snapshot, response.winOdds);

        if (response.snapshot.pendingBust || response.snapshot.status === 'bust' || response.snapshot.status === 'lost') {
            haptics.error();
        } else if (response.snapshot.status === 'won') {
            haptics.success();
        } else {
            haptics.tap();
        }

        persist(current);

        return reveal;
    }

    async function action(move: DailyMove): Promise<DailyActionResponse | null> {
        if (!precheck(move)) {
            return null;
        }

        const current = game.value;
        const response = await send<DailyActionResponse>('/api/daily/v2/action', move);

        if (!response || !current || game.value !== current) {
            return null;
        }

        current.daily2!.moves = [...current.daily2!.moves, move];

        return response;
    }

    function slotsLeft(): number {
        return snapshot.value?.openSlotIds.length ?? 0;
    }

    async function useReroll(): Promise<boolean> {
        const current = game.value;
        const slotId = current?.activeSlotId;

        if (!current || !slotId || !canReroll.value.available) {
            return false;
        }

        const response = await action({ t: 'reroll', slotId });

        if (!response?.reroll) {
            return false;
        }

        const currentRun = current.daily2!;
        const options = response.reroll.options.map(toDrawn);

        currentRun.rerollOptions = { slotId, options: response.reroll.options };
        current.offeredBySlot = { ...current.offeredBySlot, [slotId]: options };

        if (current.activeSlotId === slotId) {
            current.offeredPlayers = options;
        }

        current.offeredPlayerIds = [...new Set([...current.offeredPlayerIds, ...options.map((option) => option.id)])];
        applySnapshot(current, response.snapshot, response.winOdds);
        persist(current);
        haptics.select();
        trackEvent('reroll_used', { formation: current.formationCode, mode: 'daily', boost_source: 'free', daily_version: 2 });

        return true;
    }

    async function setCaptain(slotId: string): Promise<boolean> {
        const current = game.value;
        const slot = current?.slots.find((candidate) => candidate.id === slotId);

        if (!current || !slot) {
            return false;
        }

        const response = await action({ t: 'captain', slotId });

        if (!response) {
            return false;
        }

        applySnapshot(current, response.snapshot, response.winOdds);
        persist(current);
        haptics.select();
        trackEvent('captain_set', { blind: response.snapshot.captainBlind, position: slot.group, slots_left: slotsLeft() });

        return true;
    }

    async function useClue(playerId: string): Promise<ClueBand | null> {
        const current = game.value;
        const currentRun = run.value;

        if (!current || !currentRun || !canClue.value.available) {
            return null;
        }

        // Whichever open slot is showing this option right now.
        const slotId = currentRun.snapshot.openSlotIds.find((id) => (
            (current.offeredBySlot?.[id] ?? []).some((option) => option.id === playerId)
        ));

        if (!slotId) {
            actionError.value = 'not_offered';

            return null;
        }

        const left = slotsLeft();
        const response = await action({ t: 'clue', slotId, playerId });

        if (!response?.clue) {
            return null;
        }

        currentRun.clue = response.clue;
        applySnapshot(current, response.snapshot, response.winOdds);
        persist(current);
        trackEvent('clue_used', { band: response.clue.band.id, slots_left: left, mode: 'daily' });

        return response.clue.band;
    }

    async function useBench(slotId: string): Promise<Player | null> {
        const current = game.value;
        const slot = current?.slots.find((candidate) => candidate.id === slotId);

        if (!current || !slot || !canBench.value.available) {
            return null;
        }

        const fromBust = !!current.daily2!.snapshot.pendingBust;
        const response = await action({ t: 'bench', slotId });

        if (!response?.bench) {
            return null;
        }

        const currentRun = current.daily2!;
        const { sub } = response.bench;

        currentRun.sub = sub;
        currentRun.values = { ...currentRun.values, [sub.id]: { goals: sub.goals, assists: sub.assists } };
        slot.player = { ...sub, position: slot.group };
        applySnapshot(current, response.snapshot, response.winOdds);
        persist(current);

        const rescued = fromBust && response.snapshot.status !== 'bust';

        if (response.snapshot.status === 'bust') {
            haptics.error();
        } else {
            haptics.success();
        }

        trackEvent('bench_used', { from_bust: fromBust, rescued, slots_left: slotsLeft() });

        return slot.player;
    }

    async function acceptBust(): Promise<void> {
        const current = game.value;

        if (!current || !pendingBust.value) {
            return;
        }

        const left = slotsLeft();
        const response = await action({ t: 'acceptBust' });

        if (!response) {
            return;
        }

        applySnapshot(current, response.snapshot, response.winOdds);
        persist(current);
        trackEvent('bust_accepted', { slots_left: left });
    }

    // ---- full time ----------------------------------------------------------

    // The moment the snapshot leaves 'playing'. Stats are recorded here from
    // the engine's own score (the same shared code the server scores with,
    // on values the server revealed), not after /submit answers: a submit
    // that only lands days later (offline) must not record yesterday's Daily
    // after today's and break the streak. The percentile is filled in when
    // the submit comes back. Archive games never touch stats.
    function finish(current: GameState): void {
        const currentRun = current.daily2!;

        if (current.statsRecorded) {
            return;
        }

        current.statsRecorded = true;

        const { objective, date } = currentRun.puzzle;
        const final = currentRun.snapshot;
        const score = final.score ?? 0;

        trackEvent('daily_over', {
            date,
            objective: objective.kind,
            status: final.status,
            total: final.total,
            daily_version: 2,
            score,
            kind: objective.kind,
            stat: objective.stat,
            helps_used: helpsUsed(final),
            archive: currentRun.archive,
        });

        if (!currentRun.archive) {
            recordDailyOutcome(final.status, date, { score, kind: objective.kind, stat: objective.stat, beatPct: null, players: 0 });
            submitStatsToGameCenter(stats.value).catch(() => {});
        }

        void submitGame(current);
    }

    async function submitGame(target: GameState): Promise<DailySubmitResponse | null> {
        const currentRun = target.daily2;

        if (!currentRun || currentRun.snapshot.status === 'playing') {
            return null;
        }

        if (currentRun.submit.state === 'done' && currentRun.submit.result) {
            return currentRun.submit.result;
        }

        currentRun.submit = { state: 'pending' };
        persist(target);

        let response: DailySubmitResponse;

        try {
            response = await apiFetch<DailySubmitResponse>('/api/daily/v2/submit', {
                method: 'POST',
                body: {
                    date: currentRun.puzzle.date,
                    runId: currentRun.runId,
                    installId: currentRun.installId,
                    moves: currentRun.moves,
                    ...(currentRun.archive ? { archive: true } : {}),
                    platform: platformName(),
                },
            });
        } catch {
            currentRun.submit = { state: 'failed' };
            persist(target);

            return null;
        }

        currentRun.submit = { state: 'done', result: response };
        currentRun.ranked = response.ranked;

        if (response.reason) {
            rankReasonState.value = response.reason;
        }

        persist(target);

        // Only the ranked (first) run owns today's percentile in stats; a
        // practice replay must not overwrite it.
        if (!currentRun.archive && response.ranked && response.percentile) {
            updateDailyScorePercentile(currentRun.puzzle.date, response.percentile.beatPct, response.percentile.players);
        }

        trackEvent('daily_score_submitted', {
            score: response.score.score,
            beat_pct: response.percentile?.beatPct ?? null,
            players: response.percentile?.players ?? 0,
            ranked: response.ranked,
            archive: currentRun.archive,
        });

        return response;
    }

    // Posts the Daily on screen (called automatically at full time; also the
    // "Try again" button after a failed submit).
    function submit(): Promise<DailySubmitResponse | null> {
        return game.value ? submitGame(game.value) : Promise.resolve(null);
    }

    // Retries a finished-but-unposted Daily: the one on screen, or (from any
    // other page) today's saved one.
    async function retryPendingSubmit(): Promise<void> {
        const onScreen = game.value;

        if (onScreen?.daily2 && onScreen.daily2.snapshot.status !== 'playing' && onScreen.daily2.submit.state !== 'done') {
            await submitGame(onScreen);

            return;
        }

        const saved = readDaily2Persisted(DAILY2_STORAGE_KEY, todayDate.value);
        const savedRun = saved?.game.daily2;

        if (saved && savedRun && savedRun.snapshot.status !== 'playing' && savedRun.submit.state !== 'done') {
            await submitGame(saved.game);
        }
    }

    async function refreshPercentile(): Promise<void> {
        const current = game.value;
        const currentRun = run.value;
        const submitted = currentRun?.submit.result;

        if (!current || !currentRun || !submitted) {
            return;
        }

        try {
            const percentile = await apiFetch<DailyPercentile>('/api/daily/v2/percentile', {
                query: { date: currentRun.puzzle.date, score: submitted.score.score },
            });

            currentRun.submit = { state: 'done', result: { ...submitted, percentile } };
            persist(current);

            if (!currentRun.archive && submitted.ranked) {
                updateDailyScorePercentile(currentRun.puzzle.date, percentile.beatPct, percentile.players);
            }
        } catch {
            // Keeps the figure already shown.
        }
    }

    function shareText(): string {
        const currentRun = run.value;
        const submitted = currentRun?.submit.result;

        return currentRun && submitted ? buildDailyShareText(currentRun.puzzle, submitted, { captainBlind: currentRun.snapshot.captainBlind }) : '';
    }

    // ---- archive list and recap -----------------------------------------------

    async function loadArchiveList(before?: string): Promise<void> {
        try {
            const response = await apiFetch<DailyArchiveResponse>('/api/daily/v2/archive', {
                query: { ...(before ? { before } : {}), limit: ARCHIVE_PAGE_SIZE },
            });

            archiveList.value = before ? [...archiveList.value, ...response.items] : response.items;
            archiveNextBefore.value = response.nextBefore;
        } catch (error) {
            loadError.value = apiErrorMessage(classifyApiError(error), 'Couldn\'t load the archive.', 'try again');
        }
    }

    async function loadWeeklyRecap(start?: string): Promise<void> {
        const date = todayDate.value;
        const monday = start ?? (recapAvailable.value === 'lastWeek' ? mondayOf(addDays(date, -7)) : mondayOf(date));

        try {
            weeklyRecap.value = await apiFetch<WeeklyRecap>('/api/daily/v2/week', {
                query: { start: monday, installId: getInstallId() },
            });
        } catch {
            weeklyRecap.value = null;
        }
    }

    return {
        // loading
        loadToday,
        loadArchive,
        loading,
        loadError,
        fallbackToV1,
        // state
        run,
        puzzle,
        snapshot,
        isArchive,
        isRanked,
        rankReason,
        captainSlotId,
        captainBlind,
        captainOptions,
        needsCaptain,
        canReroll,
        canClue,
        canBench,
        pendingBust,
        projectedScore,
        benchedOut,
        busy,
        actionError,
        // slots (useGame delegates here for a v2 game)
        openSlot,
        closeDialog,
        pickPlayer,
        useReroll,
        // actions
        setCaptain,
        useClue,
        useBench,
        acceptBust,
        // result
        submit,
        result,
        submitState,
        refreshPercentile,
        shareText,
        shareGrid,
        // archive and recap
        archiveAvailable,
        archiveList,
        archiveNextBefore,
        loadArchiveList,
        weeklyRecap,
        loadWeeklyRecap,
        recapAvailable,
        // countdown
        today: todayDate,
        nextDailyAt,
        countdown,
        newDailyOut,
    };
}

// Tests only.
export function resetDailyListenersForTests(): void {
    listenersBound = false;

    if (minuteTimer) {
        clearInterval(minuteTimer);
        minuteTimer = null;
    }
}
