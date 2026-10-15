// Daily 2.0 puzzle generation: the same options for everyone, seeded from the
// UK date. Pure apart from the player pool and formation passed in, so the
// tests, the balance sim (scripts/simulate-daily.ts) and the 3-year sweep
// (scripts/daily2-sweep.ts) run exactly what the server runs.
//
// One attempt (seed "daily2:{date}:{attempt}"):
// 1. Formation and objective come from the weekly schedule (fixed across attempts).
// 2. 2-3 outfield slots are locked (seeded shuffle).
// 3. Each open slot (GK included, formation order) draws a MAIN triple, then a
//    REROLL triple, then a mystery SUB — every player distinct.
// 4. Locked players are drawn after the open slots (exact G+A days fit them
//    to the gap the open options leave).
// 5. The target V comes from the day's rule.
// 6. Accepted if at least one winning (XI, captain) pair exists and, on exact
//    days, the winning-pair fraction is inside the day's band.
// A cheap DP decides acceptance; one exhaustive pass over the accepted
// attempt then counts the perfect XIs and finds the best XI.
import {
    ALL_UNDER_LIMITS,
    DAILY_SCHEDULE,
    dailyFormationFor,
    dailyLockCount,
    dailyObjectiveLabel,
    dailyWeekday,
    dayStatValue,
} from '../../shared/daily2-rules';
import type { DailyObjective, DailyStat, DailyWeekday } from '../../shared/daily2-types';
import { hashSeed, mulberry32 } from '../../shared/daily';
import type { Formation, FormationCode, Player, PositionGroup } from '../../shared/types';
import { fixedSetTotals, fixedSetWinOdds } from './win-odds';

/** Bump ONLY together with a new launch date: past puzzles are frozen in Blobs and must never be regenerated differently. */
export const DAILY2_GENERATOR = 1;

const BANDED_ATTEMPTS = 200;
const MAX_ATTEMPTS = 400;
const CLOSE_RATIO = 1.6;
const OVER_PERCENTILE = 0.98;
// Thursday's target: ceil10 of this percentile of the (XI, captain) totals.
// The spec's prototype used the 0.4th percentile, but played through the real
// engine (captain named BEFORE the last pick, the would-bust guard, the
// bench) that made Thursday the easiest day — fan 73-75%, random ~20%, over
// two 20-week windows. The 0.2nd gives fan 53-57% (31% without the bench),
// in line with the intended ~58%. yarn sim:daily.
const UNDER_PERCENTILE = 0.002;

/**
 * Everything about one day's puzzle, stats included — what's frozen in Blobs
 * under `puzzle/{date}`. Only ever sent to the client through the public
 * projection (server/utils/daily2-puzzle.ts), which strips the hidden numbers,
 * the reroll sets and the subs. Shaped generically (slots of fixed option
 * sets) so the Weekly XI and Head-to-Head can reuse it.
 */
export interface DailyPuzzleFull {
    v: 2;
    generator: number;
    date: string;
    weekday: DailyWeekday;
    formationCode: FormationCode;
    objective: DailyObjective;
    locked: Array<{ slotId: string; group: PositionGroup; player: Player }>;
    /** Open slots, formation order (GK included). */
    slots: Array<{ slotId: string; group: PositionGroup; main: Player[]; reroll: Player[]; sub: Player }>;
    meta: {
        attempts: number;
        winPairs: number;
        pairs: number;
        perfectXIs: number;
        totalXIs: number;
        bestXI: { picks: Array<{ slotId: string; playerId: string }>; captainSlotId: string; total: number };
    };
}

type Rng = () => number;

function shuffleWith<T>(items: readonly T[], rng: Rng): T[] {
    const result = [...items];

    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));

        [result[i], result[j]] = [result[j]!, result[i]!];
    }

    return result;
}

// sqrt(appearances) favours recognisable names without shutting out the rest.
function weightOf(player: Player): number {
    return Math.sqrt(Math.max(1, player.appearances));
}

function weightedPick(rng: Rng, candidates: readonly Player[]): Player | undefined {
    if (candidates.length === 0) {
        return undefined;
    }

    const total = candidates.reduce((sum, player) => sum + weightOf(player), 0);
    let roll = rng() * total;

    for (const player of candidates) {
        roll -= weightOf(player);

        if (roll <= 0) {
            return player;
        }
    }

    return candidates[candidates.length - 1];
}

function percentileTotal(counts: Float64Array, pairs: number, quantile: number): number {
    const index = Math.floor(quantile * pairs);
    let cumulative = 0;

    for (let total = 0; total < counts.length; total += 1) {
        cumulative += counts[total]!;

        if (cumulative > index) {
            return total;
        }
    }

    return counts.length - 1;
}

interface Attempt {
    locked: DailyPuzzleFull['locked'];
    slots: DailyPuzzleFull['slots'];
    value: number;
}

interface GenerateContext {
    date: string;
    formation: Formation;
    stat: DailyStat;
    pools: Record<PositionGroup, Player[]>;
}

function buildAttempt(ctx: GenerateContext, attempt: number, banded: boolean): Attempt | null {
    const { date, formation, stat, pools } = ctx;
    const weekday = dailyWeekday(date);
    const rule = DAILY_SCHEDULE[weekday];
    const rng = mulberry32(hashSeed(`daily2:${date}:${attempt}`));
    const used = new Set<string>();
    const value = (player: Player): number => dayStatValue(player, stat);
    const limit = ALL_UNDER_LIMITS[Math.floor(mulberry32(hashSeed(`daily2:${date}:limit`))() * ALL_UNDER_LIMITS.length)]!;

    const available = (group: PositionGroup, lo = -Infinity, hi = Infinity): Player[] => pools[group].filter((player) => (
        !used.has(player.id) && value(player) >= lo && value(player) <= hi
    ));

    // A weighted pick from the range, falling back to anyone left in the position.
    const take = (group: PositionGroup, lo = -Infinity, hi = Infinity): Player => {
        const player = weightedPick(rng, available(group, lo, hi)) ?? weightedPick(rng, available(group))!;

        used.add(player.id);

        return player;
    };

    const lockCount = dailyLockCount(date);
    const outfield = formation.slots.filter((slot) => slot.group !== 'GK').map((slot) => slot.id);
    const lockedIds = new Set(shuffleWith(outfield, rng).slice(0, lockCount));
    const openSlots = formation.slots.filter((slot) => !lockedIds.has(slot.id));

    // Tuesday's danger slots: without building them in, rejection sampling
    // almost never produced a winnable all-under deck. 2 "one-safe" slots
    // (1 safe option, 2 over), 2 "two-safe" (2 safe, 1 over), the rest safe.
    const allUnderRole = new Map<string, 1 | 2 | 3>();

    if (rule.kind === 'allUnder') {
        shuffleWith(openSlots.filter((slot) => slot.group !== 'GK').map((slot) => slot.id), rng).forEach((slotId, index) => {
            allUnderRole.set(slotId, index < 2 ? 1 : index < 4 ? 2 : 3);
        });
    }

    const triple = (slotId: string, group: PositionGroup): Player[] => {
        if (rule.kind === 'allUnder') {
            const role = allUnderRole.get(slotId) ?? 3;

            if (role === 3) {
                return [take(group, 0, limit - 1), take(group, 0, limit - 1), take(group, 0, limit - 1)];
            }

            const options: Player[] = [];

            for (let k = 0; k < 3; k += 1) {
                options.push(k < role ? take(group, Math.ceil(0.6 * limit), limit - 1) : take(group, limit, Math.floor(1.4 * limit)));
            }

            return shuffleWith(options, rng);
        }

        if (!rule.closeTriples) {
            return [take(group), take(group), take(group)];
        }

        // Close calls: two more players of similar size to the first.
        const anchor = take(group);
        const anchorValue = value(anchor);
        const lo = anchorValue / CLOSE_RATIO - 2;
        const hi = anchorValue * CLOSE_RATIO + 2;

        return shuffleWith([anchor, take(group, lo, hi), take(group, lo, hi)], rng);
    };

    const slots: DailyPuzzleFull['slots'] = openSlots.map((slot) => {
        const main = triple(slot.id, slot.group);
        const reroll = triple(slot.id, slot.group);
        // Like-for-like mystery sub: inside the main options' span, widened.
        const mainValues = main.map(value);
        const sub = take(slot.group, Math.min(...mainValues) / 1.25 - 2, Math.max(...mainValues) * 1.25 + 2);

        return { slotId: slot.id, group: slot.group, main, reroll, sub };
    });

    const exactGa = rule.kind === 'exact' && stat === 'ga';
    const formationTarget = Number(formation.code);
    const meanMain = slots.reduce((sum, slot) => sum + slot.main.reduce((acc, player) => acc + value(player), 0) / slot.main.length, 0);
    const meanMaxMain = slots.length > 0
        ? slots.reduce((sum, slot) => sum + Math.max(...slot.main.map(value)), 0) / slots.length
        : 0;
    // Exact G+A days fit the locked players to the gap the open options
    // leave (the captain's expected bonus included) — cut Wednesday's
    // attempts from ~62 to ~3 in the prototype.
    const need = (formationTarget - meanMain - meanMaxMain) / lockCount;

    const locked: DailyPuzzleFull['locked'] = formation.slots.filter((slot) => lockedIds.has(slot.id)).map((slot) => {
        let player: Player;

        if (exactGa) {
            const spread = Math.max(8, 0.2 * need);

            player = take(slot.group, need - spread, need + spread);
        } else if (rule.kind === 'allUnder') {
            player = take(slot.group, 0, limit - 1);
        } else {
            player = take(slot.group);
        }

        return { slotId: slot.id, group: slot.group, player };
    });

    const baseTotal = locked.reduce((sum, slot) => sum + value(slot.player), 0);
    const openSets = slots.map((slot) => slot.main.map(value));

    if (rule.kind === 'allUnder') {
        return { locked, slots, value: limit };
    }

    if (exactGa) {
        return { locked, slots, value: formationTarget };
    }

    const { counts, pairs } = fixedSetTotals({
        objectiveKind: 'over',
        objectiveValue: 0,
        baseTotal,
        openSets,
        captain: { mode: 'free', filledValues: [] },
    });

    if (rule.kind === 'over') {
        return { locked, slots, value: Math.floor(percentileTotal(counts, pairs, OVER_PERCENTILE) / 10) * 10 };
    }

    if (rule.kind === 'under') {
        return { locked, slots, value: Math.ceil(percentileTotal(counts, pairs, UNDER_PERCENTILE) / 10) * 10 };
    }

    // Exact goals / assists: a target whose winning-pair share is inside the
    // band, nearest a seeded 60th-80th percentile of all pair totals. Past
    // the banded attempts, any reachable total will do.
    const [bandLo, bandHi] = banded ? rule.band! : [Number.MIN_VALUE, 1];
    const aim = percentileTotal(counts, pairs, 0.6 + 0.2 * rng());
    let best: number | null = null;

    for (let total = 0; total < counts.length; total += 1) {
        const share = counts[total]! / pairs;

        if (share < bandLo || share > bandHi) {
            continue;
        }

        if (best === null || Math.abs(total - aim) < Math.abs(best - aim)) {
            best = total;
        }
    }

    return best === null ? null : { locked, slots, value: best };
}

interface Enumeration {
    perfectXIs: number;
    totalXIs: number;
    bestXI: DailyPuzzleFull['meta']['bestXI'];
}

// One exhaustive pass over every main XI × captain (≤ 3^9 × 9 ≈ 177k) on the
// accepted attempt only. Ties go to slot order, then option order, then the
// lowest captain slot.
function enumerate(
    kind: DailyObjective['kind'],
    target: number,
    baseTotal: number,
    lockedValues: number[],
    slots: DailyPuzzleFull['slots'],
    value: (player: Player) => number,
): Enumeration {
    const n = slots.length;
    const sets = slots.map((slot) => slot.main.map(value));
    const chosen = new Array<number>(n).fill(0);
    const lockedMax = Math.max(0, ...lockedValues);
    let perfectXIs = 0;
    let totalXIs = 0;
    let best: { choice: number[]; captain: number; total: number; key: [number, number] } | null = null;

    const consider = (captain: number, total: number, key: [number, number]): void => {
        if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) {
            best = { choice: [...chosen], captain, total, key };
        }
    };

    const visit = (index: number, sum: number): void => {
        if (index === n) {
            totalXIs += 1;

            let anyWin = false;

            for (let captain = 0; captain < n; captain += 1) {
                const captainValue = sets[captain]![chosen[captain]!]!;
                const total = baseTotal + sum + captainValue;
                let win: boolean;

                if (kind === 'exact') {
                    win = total === target;
                } else if (kind === 'over') {
                    win = total > target;
                } else if (kind === 'under') {
                    win = total < target;
                } else {
                    let maxCounted = lockedMax;

                    for (let k = 0; k < n; k += 1) {
                        const counted = sets[k]![chosen[k]!]! * (k === captain ? 2 : 1);

                        maxCounted = Math.max(maxCounted, counted);
                    }

                    win = maxCounted < target;
                    consider(captain, total, [maxCounted, total]);
                }

                if (win) {
                    anyWin = true;
                }

                if (kind === 'exact' && win) {
                    consider(captain, total, [0, 0]);
                } else if (kind === 'over') {
                    consider(captain, total, [-total, 0]);
                } else if (kind === 'under') {
                    consider(captain, total, [total, 0]);
                }
            }

            if (anyWin) {
                perfectXIs += 1;
            }

            return;
        }

        for (let option = 0; option < sets[index]!.length; option += 1) {
            chosen[index] = option;
            visit(index + 1, sum + sets[index]![option]!);
        }
    };

    visit(0, 0);

    const found = best as { choice: number[]; captain: number; total: number } | null;

    return {
        perfectXIs,
        totalXIs,
        bestXI: found
            ? {
                picks: slots.map((slot, index) => ({ slotId: slot.slotId, playerId: slot.main[found.choice[index]!]!.id })),
                captainSlotId: slots[found.captain]!.slotId,
                total: found.total,
            }
            : { picks: [], captainSlotId: slots[0]?.slotId ?? '', total: baseTotal },
    };
}

export function groupPools(players: readonly Player[]): Record<PositionGroup, Player[]> {
    const pools: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };

    for (const player of players) {
        pools[player.position].push(player);
    }

    return pools;
}

/**
 * Builds `date`'s puzzle. Deterministic: the same date, pool and formation
 * always give the identical puzzle. Throws only if 400 attempts fail, which
 * the 3-year sweep (yarn sim:daily2-sweep) shows never happens.
 */
export function generateDailyPuzzle(date: string, pools: Record<PositionGroup, Player[]>, formation: Formation): DailyPuzzleFull {
    const weekday = dailyWeekday(date);
    const rule = DAILY_SCHEDULE[weekday];
    const formationCode = dailyFormationFor(date);

    if (formation.code !== formationCode) {
        throw new Error(`Daily ${date} uses ${formationCode}, not ${formation.code}.`);
    }

    const ctx: GenerateContext = { date, formation, stat: rule.stat, pools };
    const value = (player: Player): number => dayStatValue(player, rule.stat);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const built = buildAttempt(ctx, attempt, attempt < BANDED_ATTEMPTS);

        if (!built) {
            continue;
        }

        const lockedValues = built.locked.map((slot) => value(slot.player));
        const baseTotal = lockedValues.reduce((sum, v) => sum + v, 0);
        const odds = fixedSetWinOdds({
            objectiveKind: rule.kind,
            objectiveValue: built.value,
            baseTotal,
            openSets: built.slots.map((slot) => slot.main.map(value)),
            captain: { mode: 'free', filledValues: [] },
        });
        // allUnder's product rule doesn't see the locked players: they must all be under too.
        const lockedOk = rule.kind !== 'allUnder' || lockedValues.every((v) => v < built.value);

        if (odds.waysToWin === 0 || !lockedOk) {
            continue;
        }

        if (rule.band && attempt < BANDED_ATTEMPTS) {
            const share = odds.waysToWin / odds.totalWays;

            if (share < rule.band[0] || share > rule.band[1]) {
                continue;
            }
        }

        const enumeration = enumerate(rule.kind, built.value, baseTotal, lockedValues, built.slots, value);

        return {
            v: 2,
            generator: DAILY2_GENERATOR,
            date,
            weekday,
            formationCode,
            objective: { kind: rule.kind, stat: rule.stat, value: built.value, label: dailyObjectiveLabel(rule.kind, rule.stat, built.value) },
            locked: built.locked,
            slots: built.slots,
            meta: {
                attempts: attempt + 1,
                winPairs: odds.waysToWin,
                pairs: odds.totalWays,
                ...enumeration,
            },
        };
    }

    throw new Error(`No Daily puzzle could be generated for ${date}.`);
}
