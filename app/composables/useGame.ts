import { computed } from 'vue';
import { HINT_MIN_OPEN_SLOTS } from '#shared/hint';
import type { DrawnPlayer, FormationCode, GameSlot, GameState, HintResult, Objective, Player, RefreshedToken, RevealResult, WinOdds } from '../../shared/types';
import { trackEvent } from '../utils/analytics';
import { apiErrorMessage, apiErrorStatus, apiFetch, classifyApiError } from '../utils/api';
import { getObjectiveResult } from '../utils/daily-scoring';
import { getFormation } from '../utils/formations';
import { submitStatsToGameCenter } from '../utils/game-center';
import { createGameId } from '../utils/game-id';
import { haptics } from '../utils/haptics';
import { isAppBuild } from '../utils/platform';
import { calculateTotal, getGameResult } from '../utils/scoring';
import { usePurchases } from './usePurchases';

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

// What a reroll/hint tap would do right now, for the choice dialog's buttons:
// - 'free': the game's own free one (every mode, web and app, as before)
// - 'pro': a Pro extra (app only; never in the Daily)
// - 'boost': spends one banked boost (app only; never in the Daily)
// - 'shop': none left, but the shop could sell more (app only; not the Daily)
// - 'none': nothing available (the website, the Daily, a locked hint)
export type PowerUpReason = 'free' | 'pro' | 'boost' | 'shop' | 'none';

export interface PowerUpState {
    reason: PowerUpReason;
    /** The game's own free uses left (the counter the button shows). */
    freeLeft: number;
    /** Hint only: fewer than HINT_MIN_OPEN_SLOTS slots are open, so no hint of any kind can be used. */
    locked?: boolean;
}

export type GameMode = 'classic' | 'daily' | 'challenge';

export function gameMode(game: Pick<GameState, 'dailyDate' | 'objective'>): GameMode {
    if (game.dailyDate) {
        return 'daily';
    }

    return game.objective ? 'challenge' : 'classic';
}

// Once a game's free reroll/hint is gone: Pro, then the bank, then the shop.
// Boosts and Pro never apply to the Daily, and never on the website.
function extraReason(game: GameState, isPro: boolean, boostBank: number): PowerUpReason {
    if (!isAppBuild() || gameMode(game) === 'daily') {
        return 'none';
    }

    if (isPro) {
        return 'pro';
    }

    return boostBank > 0 ? 'boost' : 'shop';
}
// Early game, the count is an astronomically large, not-very-meaningful
// number (see shared/types.ts's WinOdds doc comment) — waiting until the
// picture has actually narrowed down makes it a more informative stat,
// closer to when it can meaningfully move a player's decision.
const MIN_FILLED_FOR_WIN_ODDS = 6;
const GAME_STORAGE_KEY = 'exact-xi-game';
// An in-progress game nobody has touched for this long is dropped rather
// than resumed — stands in for the old "new tab = fresh game" behavior that
// sessionStorage gave for free.
const PERSISTED_GAME_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DRAW_ERROR_FALLBACK = 'Couldn\'t load players for that slot — tap it again to retry.';

interface PersistedGame {
    savedAt: number;
    game: GameState;
}

// Persisted so a hard refresh (or, in the iOS app, iOS killing the webview
// in the background — which wipes sessionStorage) doesn't silently discard
// every filled slot. localStorage, with a savedAt + max age, rather than the
// sessionStorage it used to live in. Same guarded-try/catch shape as
// useStats.ts's read/write pair.
function readPersistedGame(): GameState | null {
    try {
        const raw = window.localStorage.getItem(GAME_STORAGE_KEY);

        if (raw === null) {
            return migrateSessionGame();
        }

        const parsed = JSON.parse(raw) as Partial<PersistedGame> | null;

        if (!parsed || typeof parsed !== 'object' || !parsed.game) {
            return null;
        }

        if (Date.now() - Number(parsed.savedAt ?? 0) > PERSISTED_GAME_MAX_AGE_MS) {
            window.localStorage.removeItem(GAME_STORAGE_KEY);

            return null;
        }

        return parsed.game;
    } catch {
        return null;
    }
}

// One-time move of a game saved by the previous (sessionStorage) version, so
// a web player mid-game when this ships doesn't lose it. Removed from
// sessionStorage once copied, so this only ever runs once per game.
function migrateSessionGame(): GameState | null {
    try {
        const legacy = window.sessionStorage.getItem(GAME_STORAGE_KEY);

        if (legacy === null) {
            return null;
        }

        window.sessionStorage.removeItem(GAME_STORAGE_KEY);

        const game = JSON.parse(legacy) as GameState | null;

        if (!game || typeof game !== 'object') {
            return null;
        }

        writePersistedGame(game);

        return game;
    } catch {
        return null;
    }
}

function writePersistedGame(game: GameState | null): void {
    try {
        if (game) {
            const record: PersistedGame = { savedAt: Date.now(), game };

            window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(record));
        } else {
            window.localStorage.removeItem(GAME_STORAGE_KEY);
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
        gameId: createGameId(),
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
        assisted: false,
        boostsSpent: 0,
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
        gameId: createGameId(),
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
        assisted: false,
        boostsSpent: 0,
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
    const { stats, recordOutcome, recordDailyOutcome } = useStats();
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
    // What to tell the player about that failure — offline, a dropped
    // connection and rate limiting each get their own wording (see
    // app/utils/api.ts); anything else keeps the original retry message.
    const drawErrorMessage = useState<string>('exact-xi-draw-error-message', () => DRAW_ERROR_FALLBACK);
    // A flavor stat (see shared/types.ts's WinOdds doc comment), refreshed on
    // every game start/resume and after every completed pick — never on a
    // reroll alone, since that only reshuffles the current slot's 3
    // candidates rather than changing what's actually left to fill.
    const winOdds = useState<WinOdds | null>('exact-xi-win-odds', () => null);
    // True while a /api/hint request is in flight, so a double tap can't
    // spend two hints (or two boosts) on the same candidates.
    const isHinting = useState<boolean>('exact-xi-hinting', () => false);
    const purchases = usePurchases();

    function rerollStateFor(game: GameState | null): PowerUpState {
        if (!game || game.status !== 'playing') {
            return { reason: 'none', freeLeft: 0 };
        }

        if (game.rerollsLeft > 0) {
            return { reason: 'free', freeLeft: game.rerollsLeft };
        }

        return { reason: extraReason(game, purchases.isPro.value, purchases.boostBank.value), freeLeft: 0 };
    }

    function hintStateFor(game: GameState | null): PowerUpState {
        if (!game || game.status !== 'playing') {
            return { reason: 'none', freeLeft: 0 };
        }

        const freeLeft = Math.max(0, game.hintsLeft);

        if (isHintLocked()) {
            return { reason: 'none', freeLeft, locked: true };
        }

        if (freeLeft > 0) {
            return { reason: 'free', freeLeft };
        }

        return { reason: extraReason(game, purchases.isPro.value, purchases.boostBank.value), freeLeft: 0 };
    }

    const canReroll = computed(() => rerollStateFor(state.value));
    const canHint = computed(() => hintStateFor(state.value));

    // Pays for a reroll/hint beyond the free one, after its request has
    // succeeded (a network drop costs nothing): a banked boost, or Pro
    // (Classic's extra free reroll first, then unlimited). Either way the game
    // is flagged assisted.
    function settleExtra(game: GameState, reason: 'pro' | 'boost', kind: 'reroll' | 'hint', analytics: Record<string, unknown>): void {
        const mode = gameMode(game);
        const source = reason === 'boost' ? 'bank' : 'pro';

        if (reason === 'boost') {
            purchases.spendBoost();
            game.boostsSpent = (game.boostsSpent ?? 0) + 1;
        } else if (kind === 'reroll' && mode === 'classic' && !game.proRerollUsed) {
            game.proRerollUsed = true;
        }

        game.assisted = true;
        writePersistedGame(game);
        trackEvent(kind === 'reroll' ? 'reroll_used' : 'hint_used', { ...analytics, boost_source: source, mode });
        trackEvent('boost_spent', { boost_kind: kind, boost_source: source, mode, formation: game.formationCode });
    }

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
            winOdds.value = await apiFetch<WinOdds>('/api/win-odds', {
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
    async function drawForSlot(slotId: string): Promise<boolean> {
        const game = state.value;

        if (!game) {
            return false;
        }

        const slot = findSlot(game, slotId);

        if (!slot) {
            return false;
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
            const candidates = await apiFetch<DrawnPlayer[]>('/api/draw', {
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
            // Remembered per slot (see closeDialog/openSlot), and any hint
            // shown for the previous candidates no longer applies.
            game.offeredBySlot = { ...game.offeredBySlot, [slotId]: candidates };
            clearRuledOut(game, slotId);

            const seen = new Set(game.offeredPlayerIds);

            for (const candidate of candidates) {
                seen.add(candidate.id);
            }

            game.offeredPlayerIds = [...seen];
            writePersistedGame(game);
            haptics.select();
            trackEvent('slot_draw', { position: slot.group, formation: game.formationCode });

            return true;
        } catch (error) {
            // Previously an unhandled rejection: the tapped slot did nothing
            // visible at all, which reads as an unresponsive app rather than
            // a failed network request.
            drawError.value = true;
            drawErrorMessage.value = apiErrorMessage(classifyApiError(error), DRAW_ERROR_FALLBACK, 'tap the slot again to retry');
            trackEvent('slot_draw_error', { position: slot.group, formation: game.formationCode });

            return false;
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

        // Closing the sheet keeps this slot's draw (see closeDialog) — so
        // reopening shows the same candidates rather than drawing new ones,
        // which used to make close-and-retap an unlimited free reroll.
        const previous = game.offeredBySlot?.[slotId];

        if (previous && previous.length > 0) {
            game.activeSlotId = slotId;
            game.offeredPlayers = previous;
            drawError.value = false;
            writePersistedGame(game);
            trackEvent('slot_reopen', { position: slot.group, formation: game.formationCode });

            return;
        }

        await drawForSlot(slotId);
    }

    function clearRuledOut(game: GameState, slotId: string): void {
        if (game.ruledOutBySlot && slotId in game.ruledOutBySlot) {
            const { [slotId]: _removed, ...rest } = game.ruledOutBySlot;

            game.ruledOutBySlot = rest;
        }
    }

    function forgetSlotOffers(game: GameState, slotId: string): void {
        if (game.offeredBySlot && slotId in game.offeredBySlot) {
            const { [slotId]: _removed, ...rest } = game.offeredBySlot;

            game.offeredBySlot = rest;
        }

        clearRuledOut(game, slotId);
    }

    // Re-signs the open slot's (expired) draw tokens for the SAME players via
    // /api/refresh-tokens — needed now that a slot's candidates can be
    // reopened long after the 5-minute token TTL. Updates tokens in place so
    // the choice sheet doesn't treat it as a new draw. 'stale' means the
    // server can't (or, mid-deploy, doesn't yet know how to) refresh them;
    // 'failed' is a plain network/server failure worth retrying as-is.
    async function refreshOfferTokens(game: GameState): Promise<'ok' | 'stale' | 'failed'> {
        try {
            const fresh = await apiFetch<RefreshedToken[]>('/api/refresh-tokens', {
                method: 'POST',
                body: { gameId: game.gameId, tokens: game.offeredPlayers.map((candidate) => candidate.token) },
            });
            const byId = new Map(fresh.map((entry) => [entry.id, entry.token]));

            for (const candidate of game.offeredPlayers) {
                candidate.token = byId.get(candidate.id) ?? candidate.token;
            }

            if (game.activeSlotId) {
                game.offeredBySlot = { ...game.offeredBySlot, [game.activeSlotId]: game.offeredPlayers };
            }

            writePersistedGame(game);

            return 'ok';
        } catch (error) {
            const status = apiErrorStatus(error);

            // Not 403: a rejected token means tampering, which shouldn't be
            // rewarded with the free fresh draw 'stale' leads to.
            return status === 410 || status === 404 ? 'stale' : 'failed';
        }
    }

    // D3: one free reroll per game — re-draws the 3 candidates for whichever
    // slot is currently open. The old candidates stay excluded (they were
    // already offered), so the reroll can never repeat them. In the app,
    // further rerolls (not in the Daily) come from Pro or a banked boost,
    // paid only once the new draw has arrived. False when nothing was
    // rerolled — with canReroll.reason 'shop', the caller opens the shop.
    async function useReroll(): Promise<boolean> {
        const game = state.value;

        // Not while a hint is in flight: it would land on candidates this
        // reroll is replacing (and a paid hint would be wasted).
        if (!game || game.status !== 'playing' || !game.activeSlotId || isDrawing.value || isHinting.value) {
            return false;
        }

        const { reason } = rerollStateFor(game);

        if (reason === 'free') {
            game.rerollsLeft -= 1;
            trackEvent('reroll_used', { formation: game.formationCode, boost_source: 'free', mode: gameMode(game) });
            await drawForSlot(game.activeSlotId);

            return true;
        }

        if (reason !== 'pro' && reason !== 'boost') {
            return false;
        }

        if (!await drawForSlot(game.activeSlotId)) {
            return false;
        }

        settleExtra(game, reason, 'reroll', { formation: game.formationCode });

        return true;
    }

    // Whether the hint can still be used at all — false once fewer than
    // HINT_MIN_OPEN_SLOTS slots are empty (see shared/hint.ts for why), even
    // if it hasn't been spent yet.
    function isHintLocked(): boolean {
        const game = state.value;

        return !!game && game.slots.filter((slot) => !slot.player).length < HINT_MIN_OPEN_SLOTS;
    }

    // One free hint per game (more from Pro or a banked boost in the app,
    // outside the Daily — HINT_MIN_OPEN_SLOTS still applies to every one) —
    // rules out whichever of the currently-offered
    // candidates leaves the fewest ways to still win, via the same
    // server-side odds math winOdds itself uses (the client never sees
    // goals/assists, so this can't be computed locally). Unlike useReroll,
    // only consumed on a successful response — a network drop shouldn't burn
    // the only use for nothing learned.
    async function useHint(): Promise<string | null> {
        const game = state.value;

        if (!game || game.status !== 'playing' || isHintLocked() || !game.activeSlotId || isDrawing.value || isHinting.value) {
            return null;
        }

        const { reason } = hintStateFor(game);

        if (reason !== 'free' && reason !== 'pro' && reason !== 'boost') {
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

        const requestHint = () => apiFetch<HintResult>('/api/hint', {
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

        const slotId = game.activeSlotId;

        isHinting.value = true;

        try {
            try {
                result = await requestHint();
            } catch (error) {
                // A reopened slot's tokens may have expired — refresh them once
                // and retry, rather than burning nothing but still failing.
                if (apiErrorStatus(error) !== 410 || await refreshOfferTokens(game) !== 'ok') {
                    return null;
                }

                try {
                    result = await requestHint();
                } catch {
                    return null;
                }
            }
        } finally {
            isHinting.value = false;
        }

        game.ruledOutBySlot = { ...game.ruledOutBySlot, [slotId]: result.ruledOutId };

        if (reason === 'free') {
            game.hintsLeft -= 1;
            trackEvent('hint_used', { formation: game.formationCode, slots_left: remaining.length + 1, boost_source: 'free', mode: gameMode(game) });
            writePersistedGame(game);
        } else {
            settleExtra(game, reason, 'hint', { formation: game.formationCode, slots_left: remaining.length + 1 });
        }

        return result.ruledOutId;
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

        const requestReveal = () => {
            // Looked up fresh each time: refreshOfferTokens() may have just
            // replaced this candidate's token.
            const token = game.offeredPlayers.find((candidate) => candidate.id === chosen.id)?.token ?? chosen.token;

            return apiFetch<RevealResult>('/api/reveal', {
                method: 'POST',
                body: { token, gameId: game.gameId },
            });
        };

        try {
            result = await requestReveal();
        } catch (error) {
            // 410 means the anti-peek token itself expired — a player who sat
            // on this pick past its 5-minute TTL (or reopened a slot drawn
            // earlier), not tampering. The same candidates get re-signed and
            // the reveal retried once, invisibly.
            if (apiErrorStatus(error) !== 410) {
                return null;
            }

            const refreshed = await refreshOfferTokens(game);

            if (refreshed === 'failed') {
                return null;
            }

            if (refreshed === 'stale') {
                // Too old to re-sign (or a server that predates refreshing):
                // a fresh draw for this slot, without spending the reroll —
                // the dialog then shows its neutral "timed out, tap a player
                // again" message over the new candidates.
                forgetSlotOffers(game, slot.id);
                await drawForSlot(slot.id);

                return 'timeout';
            }

            try {
                result = await requestReveal();
            } catch (retryError) {
                return apiErrorStatus(retryError) === 410 ? 'timeout' : null;
            }
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
        forgetSlotOffers(game, slot.id);
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

        // No-ops on the website (see app/utils/haptics.ts).
        if (outcome.status === 'won') {
            haptics.success();
        } else if (outcome.status === 'bust' || outcome.status === 'lost') {
            haptics.error();
        } else {
            haptics.tap();
        }

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
                    assisted: !!game.assisted,
                });
            } else {
                recordOutcome(outcome.status, outcome.tier, game.formationCode, !!game.assisted);
                trackEvent('game_over', {
                    formation: game.formationCode,
                    status: outcome.status,
                    tier: outcome.tier,
                    total: game.total,
                    target: game.target,
                    assisted: !!game.assisted,
                });
            }

            // iOS app: catch the leaderboards up with the new stats (best
            // Daily streak, unassisted exact wins, best exact run). A no-op
            // on the website, when signed out, or when nothing went up.
            if (!game.objective || game.dailyDate) {
                submitStatsToGameCenter(stats.value).catch(() => {});
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

        // Keep the slot's candidates for next time (see openSlot) — unless
        // it was just filled, in which case pickPlayer already forgot them.
        const slot = findSlot(game, game.activeSlotId);

        if (slot && !slot.player && game.offeredPlayers.length > 0) {
            game.offeredBySlot = { ...game.offeredBySlot, [slot.id]: game.offeredPlayers };
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
        drawErrorMessage,
        winOdds,
        isHinting,
        canReroll,
        canHint,
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
        isHintLocked,
        closeDialog,
        reset,
    };
}
