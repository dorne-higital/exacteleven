// Daily 2.0 rules: the weekly schedule, the move engine and the points —
// pure and dependency-free (apart from other shared/ files), so the server
// (which replays every move log against the real stats) and the client (which
// replays it against the values it has seen, for previews) run the SAME code
// and can't disagree about what a move does.
//
// Rules in brief (README "Daily 2.0" has the full write-up):
// - Same options for everyone, seeded from the UK date.
// - Captain required, named before the final pick; their day stat counts x2.
// - One reroll (−50), one scouting clue (−50), one bench (−100) per game.
// - Score out of 1,000: win = 1000 − helps; miss = max(275, 700 × total ÷
//   target − helps); bust = 25 per slot filled before the bust − helps.
import type {
    ClueBand,
    ClueBandId,
    DailyMove,
    DailyMoveError,
    DailyRules,
    DailyScore,
    DailySnapshot,
    DailyStat,
    DailyWeekday,
    ShareCell,
    ShareLevel,
} from './daily2-types';
import { dayIndexForDate } from './daily';
import { HINT_MIN_OPEN_SLOTS } from './hint';
import type { FormationCode, ObjectiveKind, PositionGroup } from './types';

/**
 * The first Daily 2.0 date: the archive starts here, and GET /api/daily/v2
 * 404s (before_launch) for anything earlier. Set to the planned release
 * week's Monday — move it to the real release date before shipping if that
 * slips (it only bounds the archive; past puzzles are frozen in Blobs).
 */
export const DAILY2_LAUNCH_DATE = '2026-10-12';

// Same literal as shared/daily.ts's (kept private there) — the order matters
// only as a rotation, so it's repeated rather than exported from v1.
const FORMATION_CYCLE: FormationCode[] = ['442', '433', '451', '352', '343', '541', '532'];

export interface DailyDayRule {
    kind: ObjectiveKind;
    stat: DailyStat;
    /** Close-call triples (3 options of similar size) vs free triples (3 independent picks). */
    closeTriples: boolean;
    /** Exact days only: the accepted fraction of winning (XI, captain) pairs. */
    band: [number, number] | null;
}

// Mon=0 … Sun=6. Tuned with scripts/simulate-daily.ts (README "Daily 2.0").
export const DAILY_SCHEDULE: Record<DailyWeekday, DailyDayRule> = {
    0: { kind: 'over', stat: 'ga', closeTriples: true, band: null },
    1: { kind: 'allUnder', stat: 'ga', closeTriples: true, band: null },
    2: { kind: 'exact', stat: 'ga', closeTriples: false, band: [0.004, 0.03] },
    3: { kind: 'under', stat: 'ga', closeTriples: true, band: null },
    4: { kind: 'exact', stat: 'goals', closeTriples: true, band: [0.006, 0.03] },
    5: { kind: 'exact', stat: 'assists', closeTriples: true, band: [0.006, 0.03] },
    6: { kind: 'exact', stat: 'ga', closeTriples: false, band: [0.0005, 0.004] },
};

/** Tuesday's per-player limit is drawn from this list (seeded per date). */
export const ALL_UNDER_LIMITS = [20, 25, 30, 35, 40] as const;

export function dailyWeekday(date: string): DailyWeekday {
    return ((dayIndexForDate(date) + 3) % 7) as DailyWeekday;
}

/** Weeks since the epoch, Monday-based — consecutive weeks shift the formation rotation by 3. */
export function dailyWeekIndex(date: string): number {
    return Math.floor((dayIndexForDate(date) + 3) / 7);
}

/** Every week uses all 7 formations once; a given weekday sees every formation over 7 weeks. */
export function dailyFormationFor(date: string): FormationCode {
    return FORMATION_CYCLE[(dailyWeekday(date) + 3 * dailyWeekIndex(date)) % 7]!;
}

/** 2 or 3 outfield slots start locked (alternating days), as in v1. */
export function dailyLockCount(date: string): number {
    return 2 + (dayIndexForDate(date) % 2);
}

/** The Monday of `date`'s week (YYYY-MM-DD). */
export function mondayOf(date: string): string {
    const index = dayIndexForDate(date) - dailyWeekday(date);

    return new Date(index * 86_400_000).toISOString().slice(0, 10);
}

export function dailyObjectiveLabel(kind: ObjectiveKind, stat: DailyStat, value: number): string {
    switch (kind) {
        case 'exact':
            return stat === 'ga' ? `Land exactly on ${value}` : `Land exactly on ${value} ${stat}`;
        case 'over':
            return `Score over ${value}`;
        case 'under':
            return `Stay under ${value}`;
        case 'allUnder':
            return `Keep every player under ${value}`;
    }
}

/** A player's number for the day: goals + assists, goals or assists. */
export function dayStatValue(player: { goals: number; assists: number }, stat: DailyStat): number {
    if (stat === 'goals') {
        return player.goals;
    }

    return stat === 'assists' ? player.assists : player.goals + player.assists;
}

export const CLUE_BANDS: ClueBand[] = [
    { id: 'b0', label: '0–10', min: 0, max: 10 },
    { id: 'b1', label: '11–30', min: 11, max: 30 },
    { id: 'b2', label: '31–60', min: 31, max: 60 },
    { id: 'b3', label: '61–100', min: 61, max: 100 },
    { id: 'b4', label: '100+', min: 101, max: null },
];

/** The scouting-clue band for a RAW day stat (never captain-doubled). */
export function clueBandFor(value: number): ClueBand {
    return CLUE_BANDS.find((band) => band.max === null || value <= band.max) ?? CLUE_BANDS[CLUE_BANDS.length - 1]!;
}

export const DAILY_POINTS = {
    win: 1000,
    reroll: 50,
    clue: 50,
    bench: 100,
    missMax: 700,
    missFloor: 275,
    bustPerSlot: 25,
} as const;

export const DAILY_RULES: DailyRules = {
    rerolls: 1,
    clues: 1,
    benches: 1,
    clueMinOpenSlots: HINT_MIN_OPEN_SLOTS,
    captainRequired: true,
    points: DAILY_POINTS,
    clueBands: CLUE_BANDS,
};

// ---------------------------------------------------------------------------
// The move engine
// ---------------------------------------------------------------------------

/**
 * What the engine needs to know about a puzzle. Ids only for the options —
 * values come through `valueOf`, so the client can run it with just the
 * players it has seen revealed.
 */
export interface DailyView {
    objective: { kind: ObjectiveKind; value: number };
    /** Locked players' RAW day stat (they're never captain). */
    locked: Array<{ slotId: string; value: number }>;
    /** Open slots in formation order. `reroll` may be absent on the client until the reroll is used; membership is then not checked. */
    slots: Array<{ slotId: string; main: string[]; reroll?: string[] }>;
}

/** A player's RAW day stat, or undefined if not (yet) known. The engine applies captain doubling. */
export type DailyValueOf = (playerId: string) => number | undefined;
/** The mystery sub's player id for a slot (server: always; client: once benched). */
export type DailySubFor = (slotId: string) => string | undefined;

/** Values the client knows only from a server response (not from `valueOf`). */
export interface DailyReplayExtras {
    /** The clue's band, for a clued option whose value isn't revealed. Without it a preview snapshot shows 'b0'. */
    clueBand?: ClueBandId;
}

export type DailyReplayResult =
    | { ok: true; snapshot: DailySnapshot }
    | { ok: false; error: DailyMoveError; at: number };

export interface DailyEngine {
    /** Applies one move; null on success, the error code (and no state change) otherwise. */
    apply(move: DailyMove): DailyMoveError | null;
    snapshot(): DailySnapshot;
    /** The slot whose pick (or sub) caused a bust, pending or final. */
    bustSlotId(): string | null;
    /** The player first picked in each open slot (before any bench), keyed by slot. */
    originalPicks(): ReadonlyMap<string, string>;
    /** Which set each slot's pick came from. */
    pickedFrom(): ReadonlyMap<string, 'main' | 'reroll'>;
}

export function createDailyEngine(
    view: DailyView,
    valueOf: DailyValueOf,
    subFor?: DailySubFor,
    extras?: DailyReplayExtras,
): DailyEngine {
    const { kind, value: target } = view.objective;
    const slotById = new Map(view.slots.map((slot) => [slot.slotId, slot]));
    const lockedIds = new Set(view.locked.map((slot) => slot.slotId));
    const lockedTotal = view.locked.reduce((sum, slot) => sum + slot.value, 0);

    // Open slot -> current occupant and its raw value (a sub replaces both).
    const occupant = new Map<string, string>();
    const values = new Map<string, number>();
    const original = new Map<string, string>();
    const fromSet = new Map<string, 'main' | 'reroll'>();

    let status: DailySnapshot['status'] = 'playing';
    let captainSlotId: string | null = null;
    let captainBlind = false;
    let rerolledSlotId: string | null = null;
    let clue: DailySnapshot['clue'] = null;
    let bench: DailySnapshot['bench'] = null;
    let pendingBust: DailySnapshot['pendingBust'] = null;
    let bustSlot: string | null = null;
    const helps = { reroll: false, clue: false, bench: false };

    const counted = (slotId: string): number => (values.get(slotId) ?? 0) * (slotId === captainSlotId ? 2 : 1);

    const total = (): number => {
        let sum = lockedTotal;

        for (const slotId of values.keys()) {
            sum += counted(slotId);
        }

        return sum;
    };

    const openEmpty = (): string[] => view.slots.filter((slot) => !occupant.has(slot.slotId)).map((slot) => slot.slotId);

    const isBust = (): boolean => {
        switch (kind) {
            case 'exact':
                return total() > target;
            case 'under':
                return total() >= target;
            case 'allUnder':
                return view.locked.some((slot) => slot.value >= target)
                    || [...values.keys()].some((slotId) => counted(slotId) >= target);
            case 'over':
                return false;
        }
    };

    const currentSet = (slotId: string): string[] | null => {
        const slot = slotById.get(slotId)!;

        if (rerolledSlotId === slotId) {
            return slot.reroll ?? null;
        }

        return slot.main;
    };

    // After any change: an over objective wins the moment it's cleared; a
    // bust ends the game (or, straight after a pick with the bench unused,
    // waits for "use the bench or take the bust"); a complete XI resolves.
    const resolve = (causeSlotId: string, canPend: boolean): void => {
        if (kind === 'over' && total() > target) {
            status = 'won';

            return;
        }

        if (isBust()) {
            bustSlot = causeSlotId;

            if (canPend && !helps.bench) {
                pendingBust = { slotId: causeSlotId };
            } else {
                status = 'bust';
            }

            return;
        }

        if (openEmpty().length > 0) {
            return;
        }

        if (kind === 'exact') {
            status = total() === target ? 'won' : 'lost';
        } else if (kind === 'over') {
            status = 'lost';
        } else {
            status = 'won';
        }
    };

    const checkOpenSlot = (slotId: string): DailyMoveError | null => {
        if (lockedIds.has(slotId)) {
            return 'slot_locked';
        }

        return slotById.has(slotId) ? null : 'bad_move';
    };

    const apply = (move: DailyMove): DailyMoveError | null => {
        if (status !== 'playing') {
            return 'game_over';
        }

        if (pendingBust && move.t !== 'bench' && move.t !== 'acceptBust') {
            return 'pending_bust';
        }

        switch (move.t) {
            case 'pick': {
                const slotError = checkOpenSlot(move.slotId);

                if (slotError) {
                    return slotError;
                }

                if (occupant.has(move.slotId)) {
                    return 'slot_filled';
                }

                const set = currentSet(move.slotId);

                if (set && !set.includes(move.playerId)) {
                    return 'not_offered';
                }

                if (openEmpty().length === 1 && captainSlotId === null) {
                    return 'captain_required';
                }

                const value = valueOf(move.playerId);

                if (value === undefined) {
                    return 'bad_move';
                }

                occupant.set(move.slotId, move.playerId);
                values.set(move.slotId, value);
                original.set(move.slotId, move.playerId);
                fromSet.set(move.slotId, rerolledSlotId === move.slotId ? 'reroll' : 'main');
                resolve(move.slotId, true);

                return null;
            }
            case 'reroll': {
                if (helps.reroll) {
                    return 'reroll_used';
                }

                const slotError = checkOpenSlot(move.slotId);

                if (slotError) {
                    return slotError;
                }

                if (occupant.has(move.slotId)) {
                    return 'slot_filled';
                }

                helps.reroll = true;
                rerolledSlotId = move.slotId;

                return null;
            }
            case 'clue': {
                if (helps.clue) {
                    return 'clue_used';
                }

                const slotError = checkOpenSlot(move.slotId);

                if (slotError) {
                    return slotError;
                }

                if (occupant.has(move.slotId)) {
                    return 'slot_filled';
                }

                const set = currentSet(move.slotId);

                if (set && !set.includes(move.playerId)) {
                    return 'not_offered';
                }

                if (openEmpty().length < HINT_MIN_OPEN_SLOTS) {
                    return 'clue_locked';
                }

                const value = valueOf(move.playerId);
                const band = value === undefined ? (extras?.clueBand ?? 'b0') : clueBandFor(value).id;

                helps.clue = true;
                clue = { slotId: move.slotId, playerId: move.playerId, band };

                return null;
            }
            case 'captain': {
                if (captainSlotId !== null) {
                    return 'captain_set';
                }

                const slotError = checkOpenSlot(move.slotId);

                if (slotError) {
                    return slotError;
                }

                const filledValue = values.get(move.slotId);

                if (filledValue !== undefined) {
                    // Doubling a revealed player can't be allowed to bust you on the spot.
                    const doubled = total() + filledValue;
                    const wouldBust = (kind === 'exact' && doubled > target)
                        || (kind === 'under' && doubled >= target)
                        || (kind === 'allUnder' && 2 * filledValue >= target);

                    if (wouldBust) {
                        return 'captain_would_bust';
                    }
                }

                captainSlotId = move.slotId;
                captainBlind = filledValue === undefined;

                if (filledValue !== undefined) {
                    resolve(move.slotId, false);
                }

                return null;
            }
            case 'bench': {
                if (helps.bench) {
                    return 'bench_used';
                }

                const slotError = checkOpenSlot(move.slotId);

                if (slotError) {
                    return slotError;
                }

                const outId = occupant.get(move.slotId);

                if (outId === undefined) {
                    return 'slot_empty';
                }

                const subId = subFor?.(move.slotId);
                const subValue = subId === undefined ? undefined : valueOf(subId);

                if (subId === undefined || subValue === undefined) {
                    return 'bad_move';
                }

                const pendingSlot = pendingBust?.slotId ?? null;

                helps.bench = true;
                bench = { slotId: move.slotId, outId, subId };
                occupant.set(move.slotId, subId);
                values.set(move.slotId, subValue);
                pendingBust = null;
                bustSlot = null;
                // Still over after the swap: the pick that caused the pending
                // bust is what bust you; otherwise the sub just did.
                resolve(pendingSlot ?? move.slotId, false);

                return null;
            }
            case 'acceptBust': {
                if (!pendingBust) {
                    return 'no_pending_bust';
                }

                pendingBust = null;
                status = 'bust';

                return null;
            }
            default:
                return 'bad_move';
        }
    };

    const snapshot = (): DailySnapshot => {
        const base: DailySnapshot = {
            status,
            total: total(),
            filled: view.locked.length + occupant.size,
            openSlotIds: openEmpty(),
            captainSlotId,
            captainBlind,
            rerolledSlotId,
            clue: clue ? { ...clue } : null,
            bench: bench ? { ...bench } : null,
            pendingBust: pendingBust ? { ...pendingBust } : null,
            helps: { ...helps },
            score: null,
        };

        if (status !== 'playing') {
            base.score = scoreDaily(base, view.objective).score;
        }

        return base;
    };

    return {
        apply,
        snapshot,
        bustSlotId: () => bustSlot,
        originalPicks: () => original,
        pickedFrom: () => fromSet,
    };
}

/**
 * Replays a whole move log from the start. The server calls this with the
 * true stats on every pick/action/submit; the client with what it has seen.
 * Stops at the first invalid move and reports its index.
 */
export function replayDaily(
    view: DailyView,
    moves: readonly DailyMove[],
    valueOf: DailyValueOf,
    subFor?: DailySubFor,
    extras?: DailyReplayExtras,
): DailyReplayResult {
    const engine = createDailyEngine(view, valueOf, subFor, extras);

    for (let at = 0; at < moves.length; at += 1) {
        const error = engine.apply(moves[at]!);

        if (error) {
            return { ok: false, error, at };
        }
    }

    return { ok: true, snapshot: engine.snapshot() };
}

function helpsCost(helps: DailySnapshot['helps']): number {
    return (helps.reroll ? DAILY_POINTS.reroll : 0) + (helps.clue ? DAILY_POINTS.clue : 0) + (helps.bench ? DAILY_POINTS.bench : 0);
}

function missBase(total: number, target: number): number {
    return target > 0 ? Math.round((DAILY_POINTS.missMax * total) / target) : 0;
}

/**
 * The final score for a finished snapshot (§1.7 of the spec):
 *   win  = max(0, 1000 − helps)
 *   miss = max(275, round(700 × total ÷ target) − helps)   (exact & over only)
 *   bust = max(0, 25 × filledBeforeBust − helps)
 * filledBeforeBust is every filled slot (locked included) except the one
 * whose pick or sub caused the bust — i.e. `filled − 1`, since the game
 * stops there. So any win (≥ 800) beats any miss (275–700) beats any bust (≤ 250).
 * A snapshot still playing is scored as a miss (exact/over) or a bust
 * (under/allUnder) "if it ended now", which only the share-grid
 * counterfactual ever needs.
 */
export function scoreDaily(snapshot: DailySnapshot, objective: { kind: ObjectiveKind; value: number }): DailyScore {
    const cost = helpsCost(snapshot.helps);
    const common = { helpsCost: cost, total: snapshot.total, value: objective.value };
    let status = snapshot.status;

    if (status === 'playing' || status === 'finished') {
        status = snapshot.pendingBust || objective.kind === 'under' || objective.kind === 'allUnder' ? 'bust' : 'lost';
    }

    if (status === 'won') {
        return { ...common, status, base: DAILY_POINTS.win, score: Math.max(0, DAILY_POINTS.win - cost), filledBeforeBust: null };
    }

    if (status === 'lost') {
        const base = missBase(snapshot.total, objective.value);

        return { ...common, status, base, score: Math.max(DAILY_POINTS.missFloor, base - cost), filledBeforeBust: null };
    }

    const filledBeforeBust = Math.max(0, snapshot.filled - 1);
    const base = DAILY_POINTS.bustPerSlot * filledBeforeBust;

    return { ...common, status: 'bust', base, score: Math.max(0, base - cost), filledBeforeBust };
}

/**
 * The live "Projected" figure under the score bar: what the game would score
 * if it ended right now — a miss on the current total for exact/over, the
 * bust score while a bust is pending. null where there's nothing meaningful to
 * show (under/allUnder still safe: finishing IS the win).
 */
export function projectedDailyScore(snapshot: DailySnapshot, objective: { kind: ObjectiveKind; value: number }): number | null {
    if (snapshot.status !== 'playing') {
        return snapshot.score;
    }

    if (snapshot.pendingBust) {
        return scoreDaily({ ...snapshot, status: 'bust' }, objective).score;
    }

    if (objective.kind === 'exact' || objective.kind === 'over') {
        return scoreDaily({ ...snapshot, status: 'lost' }, objective).score;
    }

    return null;
}

// The score a (possibly cut-short) counterfactual replay ends on.
function counterfactualScore(engine: DailyEngine, objective: { kind: ObjectiveKind; value: number }): number {
    let snapshot = engine.snapshot();

    if (snapshot.status === 'playing' && snapshot.pendingBust) {
        engine.apply({ t: 'acceptBust' });
        snapshot = engine.snapshot();
    }

    if (snapshot.status !== 'playing') {
        return snapshot.score ?? 0;
    }

    if (objective.kind === 'under' || objective.kind === 'allUnder') {
        return Math.max(0, DAILY_POINTS.win - helpsCost(snapshot.helps));
    }

    return scoreDaily({ ...snapshot, status: 'lost' }, objective).score;
}

// How a counterfactual total sits against the objective, higher = better:
// the share grid's tie-break between swaps that score the same (typically
// every option leading to the same bust, or the same under-day win). Without
// it a tie counts as 'best', so a bust grid came out all 'best'.
function counterfactualLean(total: number, objective: { kind: ObjectiveKind; value: number }): number {
    switch (objective.kind) {
        case 'over':
            return total;
        case 'under':
        case 'allUnder':
            return -total;
        default:
            return -Math.abs(objective.value - total);
    }
}

function runCounterfactual(
    view: DailyView,
    moves: readonly DailyMove[],
    valueOf: DailyValueOf,
    subFor: DailySubFor | undefined,
): { score: number; lean: number } {
    const engine = createDailyEngine(view, valueOf, subFor);

    for (const move of moves) {
        // Stop at the first move the swapped game no longer allows (it busted,
        // or the game ended sooner) and score what's there.
        if (engine.apply(move)) {
            break;
        }
    }

    const total = engine.snapshot().total;

    return { score: counterfactualScore(engine, view.objective), lean: counterfactualLean(total, view.objective) };
}

/**
 * The share grid's colour per slot (formation order). For each slot you
 * picked, the game is replayed with each of the 3 options you chose from
 * (same captain slot, same later moves, cut short if the swap busts):
 * your pick scoring the max → 'best'; the min (and below the max) → 'poor';
 * otherwise 'good'. Equal scores are split by where the swapped total lands
 * against the objective (lower on under days, higher on over days, closer
 * on exact days), so a bust doesn't paint every pick 'best'. The slot that bust you → 'bust'; locked → 'locked';
 * never filled → 'empty'. A benched slot keeps its original pick's level.
 * Options whose value `valueOf` doesn't know are left out of the comparison.
 */
export function shareLevels(
    view: DailyView,
    moves: readonly DailyMove[],
    valueOf: DailyValueOf,
    subFor: DailySubFor | undefined,
    order: ReadonlyArray<{ slotId: string; group: PositionGroup }>,
): ShareCell[] {
    const engine = createDailyEngine(view, valueOf, subFor);

    for (const move of moves) {
        if (engine.apply(move)) {
            break;
        }
    }

    const final = engine.snapshot();
    const lockedIds = new Set(view.locked.map((slot) => slot.slotId));
    const slotById = new Map(view.slots.map((slot) => [slot.slotId, slot]));
    const originals = engine.originalPicks();
    const fromSet = engine.pickedFrom();
    const bustSlot = final.status === 'bust' ? engine.bustSlotId() : null;

    return order.map(({ slotId, group }) => {
        const cell = (level: ShareLevel): ShareCell => ({
            slotId,
            group,
            level,
            captain: final.captainSlotId === slotId,
            benched: final.bench?.slotId === slotId,
        });

        if (lockedIds.has(slotId)) {
            return cell('locked');
        }

        if (bustSlot === slotId) {
            return cell('bust');
        }

        const pickedId = originals.get(slotId);
        const slot = slotById.get(slotId);

        if (!pickedId || !slot) {
            return cell('empty');
        }

        const set = fromSet.get(slotId) === 'reroll' ? (slot.reroll ?? [pickedId]) : slot.main;
        const pickIndex = moves.findIndex((move) => move.t === 'pick' && move.slotId === slotId);
        const scores = new Map<string, { score: number; lean: number }>();

        for (const optionId of set) {
            if (valueOf(optionId) === undefined) {
                continue;
            }

            const swapped = moves.map((move, index) => (
                index === pickIndex ? { t: 'pick' as const, slotId, playerId: optionId } : move
            ));

            scores.set(optionId, runCounterfactual(view, swapped, valueOf, subFor));
        }

        const mine = scores.get(pickedId);

        if (mine === undefined || scores.size < 2) {
            return cell('good');
        }

        // Score first; equal scores are split by the lean (see counterfactualLean).
        const compare = (a: { score: number; lean: number }, b: { score: number; lean: number }): number => (
            a.score - b.score || a.lean - b.lean
        );
        const all = [...scores.values()].sort(compare);
        const max = all[all.length - 1]!;
        const min = all[0]!;

        if (compare(mine, max) === 0) {
            return cell('best');
        }

        return cell(compare(mine, min) === 0 ? 'poor' : 'good');
    });
}

// ---------------------------------------------------------------------------
// Request validation (shared so the client can sanity-check before sending)
// ---------------------------------------------------------------------------

const SLOT_ID_PATTERN = /^[a-z]{2,3}(-\d{1,2})?$/;
const PLAYER_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** 9 picks + reroll + clue + captain + bench + acceptBust is 14; generous headroom. */
export const MAX_DAILY_MOVES = 32;

/** A well-formed move log, or null. Says nothing about whether the moves are legal (that's replayDaily). */
export function parseDailyMoves(raw: unknown): DailyMove[] | null {
    if (!Array.isArray(raw) || raw.length > MAX_DAILY_MOVES) {
        return null;
    }

    const moves: DailyMove[] = [];

    for (const item of raw) {
        if (typeof item !== 'object' || item === null) {
            return null;
        }

        const { t, slotId, playerId } = item as Record<string, unknown>;

        if (t === 'acceptBust') {
            moves.push({ t });
            continue;
        }

        if (typeof slotId !== 'string' || !SLOT_ID_PATTERN.test(slotId)) {
            return null;
        }

        if (t === 'pick' || t === 'clue') {
            if (typeof playerId !== 'string' || playerId.length > 80 || !PLAYER_ID_PATTERN.test(playerId)) {
                return null;
            }

            moves.push({ t, slotId, playerId });
        } else if (t === 'reroll' || t === 'captain' || t === 'bench') {
            moves.push({ t, slotId });
        } else {
            return null;
        }
    }

    return moves;
}
