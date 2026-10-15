import type { ObjectiveKind, PositionGroup, WinOdds } from '../../shared/types';
import { getPlayersByPosition } from './players';

// The only shape this module actually needs from a Player — kept minimal
// (rather than requiring the full Player type) so the combinatorics below
// can be unit tested with plain fixtures, no id/clubs/season noise required.
export interface StatLine {
    goals: number;
    assists: number;
}

function statValue(player: StatLine): number {
    return player.goals + player.assists;
}

// allUnder's win condition is checked per player, not on the running total —
// each remaining slot independently either can or can't still contribute a
// qualifying player, so this is a plain product across slots. No combined
// distribution needed, unlike every other objective kind below.
function computeAllUnderOdds(pools: StatLine[][], threshold: number): WinOdds {
    let waysToWin = 1;
    let totalWays = 1;

    for (const pool of pools) {
        const qualifying = pool.filter((player) => statValue(player) < threshold).length;

        waysToWin *= qualifying;
        totalWays *= pool.length;
    }

    return { waysToWin, totalWays };
}

// Every other objective kind (and the classic game, which is 'exact' in all
// but name) only cares what the FINAL combined total looks like — reaching
// it early and topping up with zeros along the way is just as valid a route
// there as any other order (values are never negative, so no combination of
// remaining picks can overshoot mid-way and then come back down), so order
// never needs modelling, only the sum. Builds each remaining slot's value
// distribution, then convolves them together into one distribution over
// every possible combined total — the same technique as adding up dice with
// different, weighted face counts.
function convolveValueDistributions(pools: StatLine[][]): { distribution: number[]; totalWays: number } {
    let distribution = [1];
    let totalWays = 1;

    for (const pool of pools) {
        totalWays *= pool.length;

        const countsByValue = new Map<number, number>();

        for (const player of pool) {
            const value = statValue(player);

            countsByValue.set(value, (countsByValue.get(value) ?? 0) + 1);
        }

        const maxValue = Math.max(...countsByValue.keys());
        const next = new Array<number>(distribution.length + maxValue).fill(0);

        for (const [value, count] of countsByValue) {
            for (let sum = 0; sum < distribution.length; sum += 1) {
                const ways = distribution[sum]!;

                if (ways > 0) {
                    next[sum + value] = (next[sum + value] ?? 0) + ways * count;
                }
            }
        }

        distribution = next;
    }

    return { distribution, totalWays };
}

// Pure and side-effect-free — takes the eligible player pool for each
// remaining slot directly, rather than resolving them itself, so it's
// trivially testable with synthetic pools.
export function computeWinOddsFromPools(
    pools: StatLine[][],
    objectiveKind: ObjectiveKind,
    objectiveValue: number,
    runningTotal: number,
): WinOdds {
    if (pools.length === 0) {
        // No more slots to fill — the outcome is already fully decided by
        // runningTotal alone. /api/hint no longer reaches this (it's locked
        // for the last few slots — see shared/hint.ts), but it stays the
        // correct base case for any caller that does. allUnder has
        // no ceiling left to breach at this point — any breach would already
        // have ended the game earlier — so reaching here always counts as a win for it.
        if (objectiveKind === 'allUnder') {
            return { waysToWin: 1, totalWays: 1 };
        }

        const wins = objectiveKind === 'exact'
            ? runningTotal === objectiveValue
            : objectiveKind === 'under'
                ? runningTotal < objectiveValue
                : runningTotal > objectiveValue;

        return wins ? { waysToWin: 1, totalWays: 1 } : { waysToWin: 0, totalWays: 1 };
    }

    if (pools.some((pool) => pool.length === 0)) {
        // A position with nobody left to draw from (exclusion list ate the
        // entire pool) — vanishingly unlikely in practice, but zero ways to
        // fill that slot means zero ways to finish the game at all.
        return { waysToWin: 0, totalWays: 0 };
    }

    if (objectiveKind === 'allUnder') {
        return computeAllUnderOdds(pools, objectiveValue);
    }

    const { distribution, totalWays } = convolveValueDistributions(pools);
    const gap = objectiveValue - runningTotal;

    if (gap < 0) {
        return { waysToWin: 0, totalWays };
    }

    if (objectiveKind === 'exact') {
        return { waysToWin: distribution[gap] ?? 0, totalWays };
    }

    let waysToWin = 0;

    if (objectiveKind === 'under') {
        for (let sum = 0; sum < Math.min(gap, distribution.length); sum += 1) {
            waysToWin += distribution[sum] ?? 0;
        }
    } else {
        // 'over'
        for (let sum = gap + 1; sum < distribution.length; sum += 1) {
            waysToWin += distribution[sum] ?? 0;
        }
    }

    return { waysToWin, totalWays };
}

// Answers "if a candidate worth `value` were picked for the slot being
// drawn right now, is there still at least one way to complete every OTHER
// remaining slot and win?" — used by /api/draw to guarantee at least one of
// the 3 offered candidates keeps the game genuinely winnable, rather than
// leaving that entirely to chance. `otherPools` excludes the slot currently
// being drawn — its own outcome is exactly the `value` being tested.
//
// Computes the shared convolution (or allUnder's simpler per-slot check)
// ONCE, then returns a closure that answers each candidate's query in O(1) —
// checking a whole pool of candidates one at a time via computeWinOddsFromPools
// would otherwise re-run that convolution per candidate, which is the
// difference between one ~30ms computation and dozens of them per draw.
export function buildViabilityCheck(
    otherPools: StatLine[][],
    objectiveKind: ObjectiveKind,
    objectiveValue: number,
    runningTotal: number,
): (value: number) => boolean {
    if (otherPools.length === 0) {
        // This is the last slot — picking `value` here IS the final
        // outcome, so viability is a direct win/lose check on it alone.
        if (objectiveKind === 'allUnder') {
            return (value) => value < objectiveValue;
        }

        return (value) => {
            const finalTotal = runningTotal + value;

            if (objectiveKind === 'exact') {
                return finalTotal === objectiveValue;
            }

            return objectiveKind === 'under' ? finalTotal < objectiveValue : finalTotal > objectiveValue;
        };
    }

    if (otherPools.some((pool) => pool.length === 0)) {
        // Some other remaining slot already has nobody left to draw from —
        // nothing is viable regardless of what's picked here.
        return () => false;
    }

    if (objectiveKind === 'allUnder') {
        const othersAllHaveQualifying = otherPools.every(
            (pool) => pool.some((player) => statValue(player) < objectiveValue),
        );

        return (value) => value < objectiveValue && othersAllHaveQualifying;
    }

    const { distribution } = convolveValueDistributions(otherPools);
    // existsUpTo[k] = is there any achievable sum in [0, k) — existsFrom[k] =
    // is there any achievable sum in [k, end]. One pass each turns every
    // subsequent under/over query into an O(1) lookup instead of a re-scan.
    const existsUpTo = new Array<boolean>(distribution.length + 1).fill(false);
    const existsFrom = new Array<boolean>(distribution.length + 1).fill(false);

    for (let sum = 0; sum < distribution.length; sum += 1) {
        existsUpTo[sum + 1] = existsUpTo[sum]! || distribution[sum]! > 0;
    }

    for (let sum = distribution.length - 1; sum >= 0; sum -= 1) {
        existsFrom[sum] = existsFrom[sum + 1]! || distribution[sum]! > 0;
    }

    return (value) => {
        const gap = objectiveValue - runningTotal - value;

        if (objectiveKind === 'exact') {
            return gap >= 0 && gap < distribution.length && distribution[gap]! > 0;
        }

        if (objectiveKind === 'under') {
            // Any achievable sum strictly below gap.
            return gap > 0 && existsUpTo[Math.min(gap, distribution.length)]!;
        }

        // 'over': any achievable sum strictly above gap.
        return existsFrom[Math.max(0, Math.min(gap + 1, distribution.length))]!;
    };
}

export interface WinOddsInput {
    remainingGroups: readonly PositionGroup[];
    excludeIds: ReadonlySet<string>;
    objectiveKind: ObjectiveKind;
    objectiveValue: number;
    runningTotal: number;
}

// The real-data wrapper /api/win-odds calls — resolves each remaining slot's
// eligible pool from the actual player data (same exclusion rule as
// /api/draw: once offered, out of the deck for the rest of the game) before
// handing off to the pure combinatorics above.
export function computeWinOdds(input: WinOddsInput): WinOdds {
    const pools = input.remainingGroups.map((group) => (
        getPlayersByPosition(group).filter((player) => !input.excludeIds.has(player.id))
    ));

    return computeWinOddsFromPools(pools, input.objectiveKind, input.objectiveValue, input.runningTotal);
}

// ---------------------------------------------------------------------------
// Fixed-option puzzles (Daily 2.0; later the Weekly XI and Head-to-Head)
// ---------------------------------------------------------------------------
//
// With every slot's options fixed and known, the "ways to win" are counted
// over (completion, captain) pairs: one option per still-empty slot, times
// where the armband ends up. A dynamic programme over (sum, armband placed?)
// counts them exactly in O(slots × 3 × 2 × maxSum) — under a millisecond for
// a whole Daily — instead of enumerating up to 3^9 × 9 pairs.

/** Where the armband is, for counting purposes. */
export type FixedSetCaptain =
    /** Already on a filled slot: its doubling is in `baseTotal`. */
    | { mode: 'fixed' }
    /** Named on the still-empty slot `openSets[index]` (a blind captain): that slot's options count double. */
    | { mode: 'open'; index: number }
    /** Not named yet: it can go on any still-empty slot, or on one of these filled slots (their RAW values). */
    | { mode: 'free'; filledValues: readonly number[] };

export interface FixedSetInput {
    objectiveKind: ObjectiveKind;
    objectiveValue: number;
    /** The counted total so far (locked + filled, captain doubling included if the captain slot is filled). */
    baseTotal: number;
    /** RAW day-stat values of each still-empty slot's current options. */
    openSets: readonly (readonly number[])[];
    captain: FixedSetCaptain;
}

function captainChoices(input: FixedSetInput): number {
    if (input.captain.mode !== 'free') {
        return 1;
    }

    return input.openSets.length + input.captain.filledValues.length;
}

/**
 * How many (completion, captain) pairs land on each final total:
 * `counts[t]` = pairs finishing on total t. `pairs` is the sum of counts.
 * Not used for allUnder (whose win is per player, not on the total).
 */
export function fixedSetTotals(input: FixedSetInput): { counts: Float64Array; pairs: number } {
    const { openSets, captain, baseTotal } = input;
    const free = captain.mode === 'free';
    const extraMax = free ? Math.max(0, ...captain.filledValues) : 0;
    const maxSum = baseTotal + openSets.reduce((sum, set) => sum + 2 * Math.max(0, ...set), 0) + extraMax;
    // plain[s]: ways with the armband NOT placed on an empty slot (yet);
    // armed[s]: ways with it placed on one of the empty slots so far.
    let plain = new Float64Array(maxSum + 1);
    let armed = new Float64Array(maxSum + 1);

    plain[baseTotal] = 1;

    openSets.forEach((set, index) => {
        const nextPlain = new Float64Array(maxSum + 1);
        const nextArmed = new Float64Array(maxSum + 1);
        const doubledHere = captain.mode === 'open' && captain.index === index;

        for (let sum = 0; sum <= maxSum; sum += 1) {
            const p = plain[sum]!;
            const a = armed[sum]!;

            if (p === 0 && a === 0) {
                continue;
            }

            for (const value of set) {
                if (doubledHere) {
                    nextPlain[sum + 2 * value]! += p;
                    continue;
                }

                nextPlain[sum + value]! += p;
                nextArmed[sum + value]! += a;

                if (free) {
                    nextArmed[sum + 2 * value]! += p;
                }
            }
        }

        plain = nextPlain;
        armed = nextArmed;
    });

    if (!free) {
        return { counts: plain, pairs: plain.reduce((sum, ways) => sum + ways, 0) };
    }

    // Free armband: on an empty slot (armed), or on a filled slot (plain
    // shifted by that slot's value, since its first copy is already counted).
    const counts = armed;

    for (const value of captain.filledValues) {
        for (let sum = 0; sum + value <= maxSum; sum += 1) {
            counts[sum + value]! += plain[sum]!;
        }
    }

    return { counts, pairs: counts.reduce((sum, ways) => sum + ways, 0) };
}

function fixedSetAllUnderOdds(input: FixedSetInput): WinOdds {
    const limit = input.objectiveValue;
    const safe = input.openSets.map((set) => set.filter((value) => value < limit).length);
    const safeDoubled = input.openSets.map((set) => set.filter((value) => 2 * value < limit).length);
    const sizes = input.openSets.map((set) => set.length);
    const product = (counts: number[], skip = -1): number => counts.reduce((acc, count, index) => (index === skip ? acc : acc * count), 1);
    const totalCompletions = product(sizes);
    const { captain } = input;

    if (captain.mode === 'fixed') {
        return { waysToWin: product(safe), totalWays: totalCompletions };
    }

    if (captain.mode === 'open') {
        return { waysToWin: product(safe, captain.index) * safeDoubled[captain.index]!, totalWays: totalCompletions };
    }

    let waysToWin = 0;

    input.openSets.forEach((_, index) => {
        waysToWin += product(safe, index) * safeDoubled[index]!;
    });

    for (const value of captain.filledValues) {
        if (2 * value < limit) {
            waysToWin += product(safe);
        }
    }

    return { waysToWin, totalWays: totalCompletions * captainChoices(input) };
}

/** Winning (completion, captain) pairs over the fixed option sets, and all pairs. */
export function fixedSetWinOdds(input: FixedSetInput): WinOdds {
    if (input.objectiveKind === 'allUnder') {
        return fixedSetAllUnderOdds(input);
    }

    const { counts, pairs } = fixedSetTotals(input);
    const target = input.objectiveValue;
    let waysToWin = 0;

    if (input.objectiveKind === 'exact') {
        waysToWin = target >= 0 && target < counts.length ? counts[target]! : 0;
    } else if (input.objectiveKind === 'under') {
        for (let sum = 0; sum < Math.min(target, counts.length); sum += 1) {
            waysToWin += counts[sum]!;
        }
    } else {
        for (let sum = Math.max(0, target + 1); sum < counts.length; sum += 1) {
            waysToWin += counts[sum]!;
        }
    }

    return { waysToWin, totalWays: pairs };
}
