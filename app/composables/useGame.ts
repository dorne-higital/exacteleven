import type { DrawnPlayer, FormationCode, GameSlot, GameState, HintResult, Objective, Player, RevealResult, WinOdds } from '../../shared/types';
import { trackEvent } from '../utils/analytics';
import { getObjectiveResult } from '../utils/daily-scoring';
import { getFormation } from '../utils/formations';
import { calculateTotal, getGameResult } from '../utils/scoring';

// The /api/daily response shape — mirrors server/api/daily.get.ts's return value.
export interface DailyChallengePayload {
    date: string;
    formationCode: FormationCode;
    objective: Objective;
    prefilled: Array<{ slotId: string; player: Player }>;
}

// The /api/challenge response shape — mirrors server/api/challenge.get.ts's
// return value. Same shape as DailyChallengePayload minus `date`, since a
// custom challenge isn't tied to a calendar day.
export interface ChallengePayload {
    formationCode: FormationCode;
    objective: Objective;
    prefilled: Array<{ slotId: string; player: Player }>;
}

const REROLLS_PER_GAME = 1;
const HINTS_PER_GAME = 1;
// Early game, the count is an astronomically large, not-very-meaningful
// number (see shared/types.ts's WinOdds doc comment) — waiting until the
// picture has actually narrowed down makes it a more informative stat,
// closer to when it can meaningfully move a player's decision.
const MIN_FILLED_FOR_WIN_ODDS = 6;
const GAME_STORAGE_KEY = 'exact-xi-game';

// Persisted to sessionStorage (not localStorage — a stale in-progress game
// shouldn't survive into a brand new tab/session) so a hard refresh mid-game
// doesn't silently discard every filled slot. Same guarded-try/catch shape
// as useStats.ts's read/write pair.
function readPersistedGame(): GameState | null {
    try {
        const raw = window.sessionStorage.getItem(GAME_STORAGE_KEY);

        return raw ? (JSON.parse(raw) as GameState) : null;
    } catch {
        return null;
    }
}

function writePersistedGame(game: GameState | null): void {
    try {
        if (game) {
            window.sessionStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));
        } else {
            window.sessionStorage.removeItem(GAME_STORAGE_KEY);
        }
    } catch {
        // Private-mode/blocked storage — the game just won't survive a reload this time.
    }
}

function findSlot(game: GameState, slotId: string | null): GameSlot | undefined {
    return game.slots.find((candidate) => candidate.id === slotId);
}

function createInitialState(formationCode: FormationCode): GameState {
    const formation = getFormation(formationCode);

    if (!formation) {
        throw new Error(`Unknown formation code: ${formationCode}`);
    }

    return {
        gameId: crypto.randomUUID(),
        formationCode,
        target: formation.target,
        slots: formation.slots.map((slot) => ({ ...slot, player: null })),
        offeredPlayerIds: [],
        rerollsLeft: REROLLS_PER_GAME,
        hintsLeft: HINTS_PER_GAME,
        total: 0,
        status: 'playing',
        tier: null,
        activeSlotId: null,
        offeredPlayers: [],
        statsRecorded: false,
    };
}

// Shared by the Daily Challenge and a custom challenge link — both are just
// "a formation with an objective and some slots pre-filled," differing only
// in which identity field (dailyDate vs challengeKey) resume-matching uses.
function createObjectivePrefilledState(
    formationCode: FormationCode,
    objective: Objective,
    prefilled: Array<{ slotId: string; player: Player }>,
): GameState {
    const formation = getFormation(formationCode);

    if (!formation) {
        throw new Error(`Unknown formation code: ${formationCode}`);
    }

    const prefilledBySlotId = new Map(prefilled.map((entry) => [entry.slotId, entry.player]));
    const prefilledPlayers = prefilled.map((entry) => entry.player);

    return {
        gameId: crypto.randomUUID(),
        formationCode,
        target: formation.target,
        slots: formation.slots.map((slot) => {
            const player = prefilledBySlotId.get(slot.id) ?? null;

            return { ...slot, player, preset: player !== null };
        }),
        // Pre-filled players are already "offered" — they can't also turn up
        // in a later live draw for one of the remaining slots.
        offeredPlayerIds: prefilledPlayers.map((player) => player.id),
        rerollsLeft: REROLLS_PER_GAME,
        hintsLeft: HINTS_PER_GAME,
        total: calculateTotal(prefilledPlayers),
        status: 'playing',
        tier: null,
        activeSlotId: null,
        offeredPlayers: [],
        statsRecorded: false,
        objective,
    };
}

function createDailyState(payload: DailyChallengePayload): GameState {
    return { ...createObjectivePrefilledState(payload.formationCode, payload.objective, payload.prefilled), dailyDate: payload.date };
}

function createChallengeState(payload: ChallengePayload, challengeKey: string): GameState {
    return { ...createObjectivePrefilledState(payload.formationCode, payload.objective, payload.prefilled), challengeKey };
}

export function useGame() {
    const state = useState<GameState | null>('exact-xi-game', () => null);
    const { recordOutcome, recordDailyOutcome } = useStats();
    // True while a /api/draw request is in flight (initial draw or a reroll).
    // Shared globally (like `state`) so every slot button and the choice
    // dialog agree on it, preventing two draws racing on the same exclusion
    // list — which could otherwise let D6's "no repeats" rule slip.
    const isDrawing = useState<boolean>('exact-xi-drawing', () => false);
    // Which slot a draw is currently in flight for — set before the fetch
    // starts (unlike GameState.activeSlotId, which only updates once the
    // draw succeeds) so PositionSlot can show a loading state on the exact
    // slot the player tapped, not just a generic "everything's disabled".
    const pendingSlotId = useState<string | null>('exact-xi-pending-slot', () => null);
    // Set when a draw request fails outright (network drop, server error) so
    // play.vue can tell the player the tap didn't silently do nothing.
    const drawError = useState<boolean>('exact-xi-draw-error', () => false);
    // A flavor stat (see shared/types.ts's WinOdds doc comment), refreshed on
    // every game start/resume and after every completed pick — never on a
    // reroll alone, since that only reshuffles the current slot's 3
    // candidates rather than changing what's actually left to fill.
    const winOdds = useState<WinOdds | null>('exact-xi-win-odds', () => null);

    // Non-critical and purely illustrative — a failed fetch just leaves
    // whatever was last shown (or nothing) rather than surfacing an error
    // state for it. Client-only: this fires from startGame() et al., which
    // also run during SSR (see play.vue's comment on why), and re-running it
    // there would just be discarded work once the client corrects the state.
    async function refreshWinOdds(): Promise<void> {
        if (!import.meta.client) {
            return;
        }

        const game = state.value;

        if (!game || game.status !== 'playing') {
            winOdds.value = null;

            return;
        }

        const remainingSlots = game.slots.filter((slot) => !slot.player);
        const filledCount = game.slots.length - remainingSlots.length;

        if (remainingSlots.length === 0 || filledCount < MIN_FILLED_FOR_WIN_ODDS) {
            winOdds.value = null;

            return;
        }

        const remaining = remainingSlots.map((slot) => slot.group);
        const objective = game.objective ?? { kind: 'exact' as const, value: game.target, label: 'Target' };

        try {
            winOdds.value = await $fetch<WinOdds>('/api/win-odds', {
                query: {
                    remaining: remaining.join(','),
                    exclude: game.offeredPlayerIds.join(','),
                    objectiveKind: objective.kind,
                    objectiveValue: objective.value,
                    total: game.total,
                },
            });
        } catch {
            // See doc comment above — deliberately silent.
        }
    }

    function startGame(formationCode: FormationCode): void {
        state.value = createInitialState(formationCode);
        writePersistedGame(state.value);
        trackEvent('game_start', { formation: formationCode, target: state.value.target });
        void refreshWinOdds();
    }

    function startDailyGame(payload: DailyChallengePayload): void {
        state.value = createDailyState(payload);
        writePersistedGame(state.value);
        trackEvent('daily_start', {
            date: payload.date,
            formation: payload.formationCode,
            objective: payload.objective.kind,
        });
        void refreshWinOdds();
    }

    // Same restore-on-refresh pattern as resumeGame, but matched on the
    // puzzle's date rather than formation code — a new calendar day should
    // discard yesterday's persisted daily game rather than resume it.
    function resumeDailyGame(date: string): boolean {
        const persisted = readPersistedGame();

        if (!persisted || persisted.dailyDate !== date) {
            return false;
        }

        state.value = persisted;
        trackEvent('daily_resume', { date });
        void refreshWinOdds();

        return true;
    }

    // challengeKey is the canonical encoded config string (see
    // app/pages/challenge.vue) — a custom challenge never expires the way a
    // daily one does, so resuming just needs an exact match on that config.
    function startChallengeGame(payload: ChallengePayload, challengeKey: string): void {
        state.value = createChallengeState(payload, challengeKey);
        writePersistedGame(state.value);
        trackEvent('challenge_start', { formation: payload.formationCode, objective: payload.objective.kind });
        void refreshWinOdds();
    }

    function resumeChallengeGame(challengeKey: string): boolean {
        const persisted = readPersistedGame();

        if (!persisted || persisted.challengeKey !== challengeKey) {
            return false;
        }

        state.value = persisted;
        trackEvent('challenge_resume');
        void refreshWinOdds();

        return true;
    }

    // Restores a game persisted for this exact formation, if one exists —
    // called from play.vue's onMounted, before it would otherwise fall back
    // to startGame(). Returns whether a matching game was found, so the
    // caller only needs to start a fresh one when this returns false.
    function resumeGame(formationCode: FormationCode): boolean {
        const persisted = readPersistedGame();

        if (!persisted || persisted.formationCode !== formationCode) {
            return false;
        }

        state.value = persisted;
        trackEvent('game_resume', { formation: formationCode });
        void refreshWinOdds();

        return true;
    }

    // D6: once offered in any slot's dialog, a player is excluded from every
    // later draw in the game — whether or not they were the one picked. Used
    // for both the initial draw on a slot and a reroll of that same slot.
    async function drawForSlot(slotId: string): Promise<void> {
        const game = state.value;

        if (!game) {
            return;
        }

        const slot = findSlot(game, slotId);

        if (!slot) {
            return;
        }

        isDrawing.value = true;
        pendingSlotId.value = slotId;
        drawError.value = false;

        // Every other still-open slot (this one's own outcome is exactly
        // what's being drawn) — lets /api/draw guarantee at least one of the
        // 3 offered candidates keeps the game genuinely winnable, rather
        // than leaving that purely to chance.
        const otherRemaining = game.slots
            .filter((candidate) => !candidate.player && candidate.id !== slotId)
            .map((candidate) => candidate.group);
        const objective = game.objective ?? { kind: 'exact' as const, value: game.target, label: 'Target' };

        try {
            const candidates = await $fetch<DrawnPlayer[]>('/api/draw', {
                query: {
                    position: slot.group,
                    exclude: game.offeredPlayerIds.join(','),
                    gameId: game.gameId,
                    remaining: otherRemaining.join(','),
                    objectiveKind: objective.kind,
                    objectiveValue: objective.value,
                    total: game.total,
                },
            });

            game.activeSlotId = slotId;
            game.offeredPlayers = candidates;

            const seen = new Set(game.offeredPlayerIds);

            for (const candidate of candidates) {
                seen.add(candidate.id);
            }

            game.offeredPlayerIds = [...seen];
            writePersistedGame(game);
            trackEvent('slot_draw', { position: slot.group, formation: game.formationCode });
        } catch {
            // Previously an unhandled rejection: the tapped slot did nothing
            // visible at all, which reads as an unresponsive app rather than
            // a failed network request.
            drawError.value = true;
            trackEvent('slot_draw_error', { position: slot.group, formation: game.formationCode });
        } finally {
            isDrawing.value = false;
            pendingSlotId.value = null;
        }
    }

    async function openSlot(slotId: string): Promise<void> {
        const game = state.value;

        if (!game || game.status !== 'playing' || isDrawing.value) {
            return;
        }

        const slot = findSlot(game, slotId);

        if (!slot || slot.player) {
            return;
        }

        await drawForSlot(slotId);
    }

    // D3: one reroll per game — re-draws the 3 candidates for whichever slot
    // is currently open. The old candidates stay excluded (they were already
    // offered), so the reroll can never repeat them.
    async function useReroll(): Promise<boolean> {
        const game = state.value;

        if (!game || game.status !== 'playing' || game.rerollsLeft <= 0 || !game.activeSlotId || isDrawing.value) {
            return false;
        }

        game.rerollsLeft -= 1;
        trackEvent('reroll_used', { formation: game.formationCode });
        await drawForSlot(game.activeSlotId);

        return true;
    }

    // One hint per game — recommends whichever of the currently-offered
    // candidates leaves the most ways to still win, via the same server-side
    // odds math winOdds itself uses (the client never sees goals/assists, so
    // this can't be computed locally). Unlike useReroll, only consumed on a
    // successful response — a network drop shouldn't burn the only use for
    // nothing learned.
    async function useHint(): Promise<string | null> {
        const game = state.value;

        if (!game || game.status !== 'playing' || game.hintsLeft <= 0 || !game.activeSlotId || isDrawing.value) {
            return null;
        }

        const slot = findSlot(game, game.activeSlotId);

        if (!slot || slot.player || game.offeredPlayers.length === 0) {
            return null;
        }

        const remaining = game.slots
            .filter((candidate) => !candidate.player && candidate.id !== game.activeSlotId)
            .map((candidate) => candidate.group);

        const objective = game.objective ?? { kind: 'exact' as const, value: game.target, label: 'Target' };

        let result: HintResult;

        try {
            result = await $fetch<HintResult>('/api/hint', {
                method: 'POST',
                body: {
                    gameId: game.gameId,
                    tokens: game.offeredPlayers.map((candidate) => candidate.token),
                    remaining: remaining.join(','),
                    exclude: game.offeredPlayerIds.join(','),
                    objectiveKind: objective.kind,
                    objectiveValue: objective.value,
                    total: game.total,
                },
            });
        } catch {
            return null;
        }

        game.hintsLeft -= 1;
        trackEvent('hint_used', { formation: game.formationCode });
        writePersistedGame(game);

        return result.recommendedId;
    }

    async function pickPlayer(chosen: DrawnPlayer): Promise<RevealResult | 'timeout' | null> {
        const game = state.value;

        if (!game || game.status !== 'playing' || !game.activeSlotId || isDrawing.value) {
            return null;
        }

        const slot = findSlot(game, game.activeSlotId);

        if (!slot || slot.player) {
            return null;
        }

        // D2: goals/assists only ever arrive here, after a pick — never in the
        // draw response. reveal itself re-checks (server-side) that `chosen`
        // was genuinely offered in this game before returning anything.
        // Caught rather than left to reject: a network drop or edge error
        // here used to leave PlayerChoiceDialog's `revealing` flag stuck
        // true forever, permanently disabling every option with no
        // indication anything had gone wrong.
        let result: RevealResult;

        try {
            result = await $fetch<RevealResult>('/api/reveal', {
                method: 'POST',
                body: { token: chosen.token, gameId: game.gameId },
            });
        } catch (error) {
            // 410 means the anti-peek token itself expired — a player who sat
            // on this pick past its 5-minute TTL, not tampering. Distinct
            // from every other failure (network drop, a genuinely rejected
            // token, a server error) so the dialog can show a neutral
            // "that timed out" message instead of the generic retry one.
            if ((error as { statusCode?: number } | null)?.statusCode === 410) {
                return 'timeout';
            }

            return null;
        }

        const player: Player = {
            id: chosen.id,
            name: chosen.name,
            position: slot.group,
            clubs: chosen.clubs,
            firstSeason: chosen.firstSeason,
            lastSeason: chosen.lastSeason,
            appearances: chosen.appearances,
            goals: result.goals,
            assists: result.assists,
        };

        slot.player = player;
        trackEvent('player_picked', { position: slot.group, playerId: player.id, formation: game.formationCode });

        // Deliberately NOT clearing activeSlotId/offeredPlayers here: the
        // dialog stays mounted (and modal) through its own reveal count-up
        // animation, then calls closeDialog() itself once that's done.
        const pickedPlayers = game.slots
            .map((candidate) => candidate.player)
            .filter((candidate): candidate is Player => candidate !== null);

        game.total = calculateTotal(pickedPlayers);

        const outcome = game.objective
            ? getObjectiveResult(game.objective, pickedPlayers, game.slots.length)
            : getGameResult(game.total, game.target, pickedPlayers.length, game.slots.length);

        game.status = outcome.status;
        game.tier = outcome.tier;

        // Record exactly once per game, the moment it reaches a terminal
        // state — guarded so a re-render (e.g. re-opening this same
        // finished game) can't double-count it.
        if (!game.statsRecorded && outcome.status !== 'playing') {
            game.statsRecorded = true;

            if (game.objective && game.dailyDate) {
                recordDailyOutcome(outcome.status, game.dailyDate);
                trackEvent('daily_over', {
                    date: game.dailyDate,
                    objective: game.objective.kind,
                    status: outcome.status,
                    total: game.total,
                });
            } else if (game.objective) {
                // A custom challenge is a one-off the creator configured
                // themselves — it doesn't feed classic stats (gamesPlayed,
                // formationPlays) or the Daily streak, since either would let
                // a hand-picked easy/impossible board skew a player's record.
                trackEvent('challenge_over', {
                    formation: game.formationCode,
                    objective: game.objective.kind,
                    status: outcome.status,
                    total: game.total,
                });
            } else {
                recordOutcome(outcome.status, outcome.tier, game.formationCode);
                trackEvent('game_over', {
                    formation: game.formationCode,
                    status: outcome.status,
                    tier: outcome.tier,
                    total: game.total,
                    target: game.target,
                });
            }
        }

        writePersistedGame(game);
        void refreshWinOdds();

        return result;
    }

    function closeDialog(): void {
        const game = state.value;

        if (!game) {
            return;
        }

        game.activeSlotId = null;
        game.offeredPlayers = [];
        writePersistedGame(game);
    }

    function reset(): void {
        state.value = null;
        writePersistedGame(null);
    }

    return {
        state,
        isDrawing,
        pendingSlotId,
        drawError,
        winOdds,
        refreshWinOdds,
        startGame,
        resumeGame,
        startDailyGame,
        resumeDailyGame,
        startChallengeGame,
        resumeChallengeGame,
        openSlot,
        pickPlayer,
        useReroll,
        useHint,
        closeDialog,
        reset,
    };
}
