import type { DrawnPlayer, FormationCode, GameState, Player, RevealResult } from '../../shared/types';
import { getFormation } from '../utils/formations';
import { calculateTotal, getGameResult } from '../utils/scoring';

const REROLLS_PER_GAME = 1;

function createInitialState(formationCode: FormationCode): GameState {
    const formation = getFormation(formationCode);

    if (!formation) {
        throw new Error(`Unknown formation code: ${formationCode}`);
    }

    return {
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

    function startGame(formationCode: FormationCode): void {
        state.value = createInitialState(formationCode);
    }

    // D6: once offered in any slot's dialog, a player is excluded from every
    // later draw in the game — whether or not they were the one picked. Used
    // for both the initial draw on a slot and a reroll of that same slot.
    async function drawForSlot(slotId: string): Promise<void> {
        const game = state.value;

        if (!game) {
            return;
        }

        const slot = game.slots.find((candidate) => candidate.id === slotId);

        if (!slot) {
            return;
        }

        isDrawing.value = true;

        try {
            const candidates = await $fetch<DrawnPlayer[]>('/api/draw', {
                query: { position: slot.group, exclude: game.offeredPlayerIds.join(',') },
            });

            game.activeSlotId = slotId;
            game.offeredPlayers = candidates;

            const seen = new Set(game.offeredPlayerIds);

            for (const candidate of candidates) {
                seen.add(candidate.id);
            }

            game.offeredPlayerIds = [...seen];
        } finally {
            isDrawing.value = false;
        }
    }

    async function openSlot(slotId: string): Promise<void> {
        const game = state.value;

        if (!game || game.status !== 'playing' || isDrawing.value) {
            return;
        }

        const slot = game.slots.find((candidate) => candidate.id === slotId);

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
        await drawForSlot(game.activeSlotId);

        return true;
    }

    async function pickPlayer(chosen: DrawnPlayer): Promise<RevealResult | null> {
        const game = state.value;

        if (!game || game.status !== 'playing' || !game.activeSlotId || isDrawing.value) {
            return null;
        }

        const slot = game.slots.find((candidate) => candidate.id === game.activeSlotId);

        if (!slot || slot.player) {
            return null;
        }

        // D2: goals/assists only ever arrive here, after a pick — never in the
        // draw response. reveal itself re-checks (server-side) that `chosen`
        // was genuinely offered in this game before returning anything.
        const result = await $fetch<RevealResult>('/api/reveal', {
            method: 'POST',
            body: { token: chosen.token },
        });

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
        }

        return result;
    }

    function closeDialog(): void {
        const game = state.value;

        if (!game) {
            return;
        }

        game.activeSlotId = null;
        game.offeredPlayers = [];
    }

    function reset(): void {
        state.value = null;
    }

    return {
        state,
        isDrawing,
        startGame,
        openSlot,
        pickPlayer,
        useReroll,
        closeDialog,
        reset,
    };
}
