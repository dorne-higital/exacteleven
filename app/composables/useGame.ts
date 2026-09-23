import type { DrawnPlayer, FormationCode, GameSlot, GameState, Player, RevealResult } from '../../shared/types';
import { trackEvent } from '../utils/analytics';
import { getFormation } from '../utils/formations';
import { calculateTotal, getGameResult } from '../utils/scoring';

const REROLLS_PER_GAME = 1;
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
        total: 0,
        status: 'playing',
        tier: null,
        activeSlotId: null,
        offeredPlayers: [],
        statsRecorded: false,
    };
}

export function useGame() {
    const state = useState<GameState | null>('exact-xi-game', () => null);
    const { recordOutcome } = useStats();
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

    function startGame(formationCode: FormationCode): void {
        state.value = createInitialState(formationCode);
        writePersistedGame(state.value);
        trackEvent('game_start', { formation: formationCode, target: state.value.target });
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

        try {
            const candidates = await $fetch<DrawnPlayer[]>('/api/draw', {
                query: { position: slot.group, exclude: game.offeredPlayerIds.join(','), gameId: game.gameId },
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

    async function pickPlayer(chosen: DrawnPlayer): Promise<RevealResult | null> {
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
        } catch {
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

        const outcome = getGameResult(game.total, game.target, pickedPlayers.length, game.slots.length);

        game.status = outcome.status;
        game.tier = outcome.tier;

        // Record exactly once per game, the moment it reaches a terminal
        // state — guarded so a re-render (e.g. re-opening this same
        // finished game) can't double-count it.
        if (!game.statsRecorded && outcome.status !== 'playing') {
            game.statsRecorded = true;
            recordOutcome(outcome.status, outcome.tier, game.formationCode);
            trackEvent('game_over', {
                formation: game.formationCode,
                status: outcome.status,
                tier: outcome.tier,
                total: game.total,
                target: game.target,
            });
        }

        writePersistedGame(game);

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
        startGame,
        resumeGame,
        openSlot,
        pickPlayer,
        useReroll,
        closeDialog,
        reset,
    };
}
