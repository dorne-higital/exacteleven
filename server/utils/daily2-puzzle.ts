// Daily 2.0 puzzles on the server: freezing (Blobs), the in-process memo, the
// public projection the client sees, and the server-side engine view that
// replays move logs against the TRUE stats.
//
// Freezing: the first request for a date generates the puzzle and writes the
// whole thing — stats, reroll sets and subs included — to `puzzle/{date}`
// (onlyIfNew; a losing racer re-reads the winner's). Every later read comes
// from there, so reseeding players.json never rewrites a past Daily, the
// archive, a recap or a percentile.
import { HINT_MIN_OPEN_SLOTS } from '#shared/hint';
import {
    DAILY2_LAUNCH_DATE,
    DAILY_RULES,
    createDailyEngine,
    dailyFormationFor,
    dayStatValue,
    parseDailyMoves,
    shareLevels,
    type DailyEngine,
    type DailyView,
} from '#shared/daily2-rules';
import type {
    DailyFullTime,
    DailyMove,
    DailyMoveError,
    DailyPuzzle,
    DailySnapshot,
    PuzzleOption,
} from '#shared/daily2-types';
import { addDays, isValidDateString, nextUkMidnight, ukDateString } from '#shared/uk-date';
import type { Player, PositionGroup, WinOdds } from '../../shared/types';
import { getFormation } from '../../app/utils/formations';
import { type DailyPuzzleFull, generateDailyPuzzle, groupPools } from './daily2-generate';
import { dailyKv } from './daily2-store';
import { getPlayersByPosition } from './players';
import { fixedSetWinOdds, type FixedSetCaptain } from './win-odds';

const MEMO_SIZE = 16;
const memo = new Map<string, DailyPuzzleFull>();

/** Today on the UK calendar — the Daily's date. */
export function ukToday(now: Date = new Date()): string {
    return ukDateString(now);
}

function remember(puzzle: DailyPuzzleFull): DailyPuzzleFull {
    memo.delete(puzzle.date);
    memo.set(puzzle.date, puzzle);

    while (memo.size > MEMO_SIZE) {
        memo.delete(memo.keys().next().value!);
    }

    return puzzle;
}

/** Tests only: forget memoised puzzles (e.g. after swapping the KV). */
export function clearPuzzleMemoForTests(): void {
    memo.clear();
}

function livePools(): Record<PositionGroup, Player[]> {
    return groupPools((['GK', 'DEF', 'MID', 'FWD'] as const).flatMap((group) => getPlayersByPosition(group)));
}

/** The frozen puzzle for `date` (memo → Blobs → generate-and-freeze). */
export async function getPuzzle(date: string): Promise<DailyPuzzleFull> {
    const cached = memo.get(date);

    if (cached) {
        return remember(cached);
    }

    const kv = dailyKv();
    const key = `puzzle/${date}`;
    const stored = await kv.getJSON<DailyPuzzleFull>(key);

    if (stored) {
        return remember(stored.value);
    }

    const formation = getFormation(dailyFormationFor(date))!;
    const puzzle = generateDailyPuzzle(date, livePools(), formation);
    const write = await kv.setJSON(key, puzzle, { onlyIfNew: true });

    if (!write.modified) {
        // Another instance froze it first — theirs is the one everyone gets.
        const winner = await kv.getJSON<DailyPuzzleFull>(key);

        if (winner) {
            return remember(winner.value);
        }
    }

    return remember(puzzle);
}

export function toPuzzleOption(player: Player): PuzzleOption {
    return {
        id: player.id,
        name: player.name,
        clubs: player.clubs,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        appearances: player.appearances,
    };
}

/** What GET /api/daily/v2 sends: names/clubs/seasons/apps for the main options only; locked players in full. */
export function toPublicPuzzle(puzzle: DailyPuzzleFull, now: Date = new Date()): DailyPuzzle {
    return {
        v: 2,
        date: puzzle.date,
        weekday: puzzle.weekday,
        formationCode: puzzle.formationCode,
        objective: puzzle.objective,
        locked: puzzle.locked.map(({ slotId, player }) => ({ slotId, player })),
        slots: puzzle.slots.map(({ slotId, group, main }) => ({ slotId, group, options: main.map(toPuzzleOption) })),
        rules: DAILY_RULES,
        isToday: puzzle.date === ukToday(now),
        nextDailyAt: nextUkMidnight(now).toISOString(),
    };
}

// ---------------------------------------------------------------------------
// The engine, with true stats
// ---------------------------------------------------------------------------

export interface ServerDaily {
    puzzle: DailyPuzzleFull;
    view: DailyView;
    playerById: Map<string, Player>;
    valueOf: (playerId: string) => number | undefined;
    subFor: (slotId: string) => string | undefined;
}

export function serverDaily(puzzle: DailyPuzzleFull): ServerDaily {
    const playerById = new Map<string, Player>();

    for (const { player } of puzzle.locked) {
        playerById.set(player.id, player);
    }

    for (const slot of puzzle.slots) {
        for (const player of [...slot.main, ...slot.reroll, slot.sub]) {
            playerById.set(player.id, player);
        }
    }

    const stat = puzzle.objective.stat;
    const view: DailyView = {
        objective: puzzle.objective,
        locked: puzzle.locked.map(({ slotId, player }) => ({ slotId, value: dayStatValue(player, stat) })),
        slots: puzzle.slots.map((slot) => ({
            slotId: slot.slotId,
            main: slot.main.map((player) => player.id),
            reroll: slot.reroll.map((player) => player.id),
        })),
    };
    const subs = new Map(puzzle.slots.map((slot) => [slot.slotId, slot.sub.id]));

    return {
        puzzle,
        view,
        playerById,
        valueOf: (playerId) => {
            const player = playerById.get(playerId);

            return player ? dayStatValue(player, stat) : undefined;
        },
        subFor: (slotId) => subs.get(slotId),
    };
}

export type ReplayOutcome =
    | { ok: true; engine: DailyEngine; snapshot: DailySnapshot }
    | { ok: false; error: DailyMoveError; at: number };

export function replayOnServer(daily: ServerDaily, moves: readonly DailyMove[]): ReplayOutcome {
    const engine = createDailyEngine(daily.view, daily.valueOf, daily.subFor);

    for (let at = 0; at < moves.length; at += 1) {
        const error = engine.apply(moves[at]!);

        if (error) {
            return { ok: false, error, at };
        }
    }

    return { ok: true, engine, snapshot: engine.snapshot() };
}

/**
 * The "ways to win" banner for a fixed-option game: winning (completion,
 * captain) pairs over the CURRENT sets of the still-empty slots. Only once
 * 6+ slots are filled and 3+ are still open — any later, so few
 * combinations are left that the count would act as an oracle.
 */
export function dailyWinOdds(daily: ServerDaily, snapshot: DailySnapshot, moves: readonly DailyMove[]): WinOdds | null {
    if (snapshot.status !== 'playing' || snapshot.pendingBust) {
        return null;
    }

    if (snapshot.filled < 6 || snapshot.openSlotIds.length < HINT_MIN_OPEN_SLOTS) {
        return null;
    }

    const { puzzle } = daily;
    const value = (player: Player): number => dayStatValue(player, puzzle.objective.stat);
    const openSlots = puzzle.slots.filter((slot) => snapshot.openSlotIds.includes(slot.slotId));
    const openSets = openSlots.map((slot) => (snapshot.rerolledSlotId === slot.slotId ? slot.reroll : slot.main).map(value));
    let captain: FixedSetCaptain;

    if (snapshot.captainSlotId === null) {
        const filledValues = puzzle.slots
            .filter((slot) => !snapshot.openSlotIds.includes(slot.slotId))
            .map((slot) => daily.valueOf(currentOccupant(slot.slotId, moves, snapshot) ?? '') ?? 0);

        captain = { mode: 'free', filledValues };
    } else {
        const openIndex = openSlots.findIndex((slot) => slot.slotId === snapshot.captainSlotId);

        captain = openIndex >= 0 ? { mode: 'open', index: openIndex } : { mode: 'fixed' };
    }

    return fixedSetWinOdds({
        objectiveKind: puzzle.objective.kind,
        objectiveValue: puzzle.objective.value,
        baseTotal: snapshot.total,
        openSets,
        captain,
    });
}

// Who's in a filled open slot now: the sub if benched, else the pick.
function currentOccupant(slotId: string, moves: readonly DailyMove[], snapshot: DailySnapshot): string | undefined {
    if (snapshot.bench?.slotId === slotId) {
        return snapshot.bench.subId;
    }

    const pick = moves.find((move) => move.t === 'pick' && move.slotId === slotId);

    return pick && pick.t === 'pick' ? pick.playerId : undefined;
}

/** The full-time reveal: best XI, perfect-XI count, your XI, everything you passed on, and the share grid. */
export function buildFullTime(daily: ServerDaily, moves: readonly DailyMove[], snapshot: DailySnapshot): DailyFullTime {
    const { puzzle, playerById } = daily;
    const formation = getFormation(puzzle.formationCode)!;
    const lockedBySlot = new Map(puzzle.locked.map((slot) => [slot.slotId, slot.player]));
    const pickBySlot = new Map<string, string>();

    for (const move of moves) {
        if (move.t === 'pick') {
            pickBySlot.set(move.slotId, move.playerId);
        }
    }

    const yourXI: DailyFullTime['yourXI'] = [];

    for (const slot of formation.slots) {
        const lockedPlayer = lockedBySlot.get(slot.id);

        if (lockedPlayer) {
            yourXI.push({ slotId: slot.id, player: lockedPlayer, locked: true, captain: false });
            continue;
        }

        const pickedId = pickBySlot.get(slot.id);

        if (!pickedId) {
            continue;
        }

        const benched = snapshot.bench?.slotId === slot.id;
        const entry: DailyFullTime['yourXI'][number] = {
            slotId: slot.id,
            player: playerById.get(benched ? snapshot.bench!.subId : pickedId)!,
            locked: false,
            captain: snapshot.captainSlotId === slot.id,
        };

        if (benched) {
            entry.benchedOut = playerById.get(pickedId)!;
        }

        yourXI.push(entry);
    }

    const passedOn: DailyFullTime['passedOn'] = [];

    for (const slot of puzzle.slots) {
        const kept = pickBySlot.get(slot.slotId);

        for (const player of slot.main) {
            if (player.id !== kept) {
                passedOn.push({ slotId: slot.slotId, set: 'main', player });
            }
        }

        if (snapshot.rerolledSlotId === slot.slotId) {
            for (const player of slot.reroll) {
                if (player.id !== kept) {
                    passedOn.push({ slotId: slot.slotId, set: 'reroll', player });
                }
            }
        }
    }

    const bestPicks = new Map(puzzle.meta.bestXI.picks.map((pick) => [pick.slotId, pick.playerId]));
    const bestXI: DailyFullTime['bestXI'] = {
        picks: formation.slots.flatMap((slot) => {
            const lockedPlayer = lockedBySlot.get(slot.id);
            const playerId = bestPicks.get(slot.id);
            const player = lockedPlayer ?? (playerId ? playerById.get(playerId) : undefined);

            return player ? [{ slotId: slot.id, player }] : [];
        }),
        captainSlotId: puzzle.meta.bestXI.captainSlotId,
        total: puzzle.meta.bestXI.total,
    };

    return {
        perfectXIs: puzzle.meta.perfectXIs,
        totalXIs: puzzle.meta.totalXIs,
        bestXI,
        yourXI,
        passedOn,
        grid: shareLevels(daily.view, moves, daily.valueOf, daily.subFor, formation.slots.map((slot) => ({ slotId: slot.id, group: slot.group }))),
    };
}

// ---------------------------------------------------------------------------
// Request validation shared by the /api/daily/v2 routes and /api/pick
// ---------------------------------------------------------------------------

export const ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * A Daily date the caller may play: well-formed (400 bad_date), not after UK
 * today (403 not_yet), not before launch (404 before_launch).
 */
export function requireDailyDate(raw: unknown, now: Date = new Date()): string {
    if (!isValidDateString(raw)) {
        throw createError({ statusCode: 400, statusMessage: 'bad_date' });
    }

    if (raw > ukToday(now)) {
        throw createError({ statusCode: 403, statusMessage: 'not_yet' });
    }

    if (raw < DAILY2_LAUNCH_DATE) {
        throw createError({ statusCode: 404, statusMessage: 'before_launch' });
    }

    return raw;
}

export function requireMoves(raw: unknown): DailyMove[] {
    const moves = parseDailyMoves(raw);

    if (!moves) {
        throw createError({ statusCode: 400, statusMessage: 'bad_move' });
    }

    return moves;
}

export function requireId(raw: unknown, code: 'bad_install_id' | 'bad_run_id'): string {
    if (typeof raw !== 'string' || !ID_PATTERN.test(raw)) {
        throw createError({ statusCode: 400, statusMessage: code });
    }

    return raw;
}

/** Replays with true stats, or throws 400 with the DailyMoveError code. */
export function replayOrThrow(daily: ServerDaily, moves: readonly DailyMove[]): { engine: DailyEngine; snapshot: DailySnapshot } {
    const outcome = replayOnServer(daily, moves);

    if (!outcome.ok) {
        throw createError({ statusCode: 400, statusMessage: outcome.error, data: { at: outcome.at } });
    }

    return outcome;
}

export function ukYesterday(now: Date = new Date()): string {
    return addDays(ukToday(now), -1);
}
