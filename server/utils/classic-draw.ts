import { FINAL_SLOT_EXACT_CHANCE, titleWindowFor } from '../../shared/classic';
import type { DrawnPlayer, ObjectiveKind, Player, PositionGroup } from '../../shared/types';
import { signPlayerToken, TOKEN_TTL_LONG_MS } from './draw-token';
import { CANDIDATES_PER_DRAW } from './game-constants';
import { getPlayersByPosition } from './players';
import { buildViabilityCheck } from './win-odds';

// The Classic (random-draw) candidate draw, shared by GET /api/draw and
// POST /api/pick so the two can't drift. `rng` is injectable for tests and
// the balance sim; everything else uses Math.random.
export type Rng = () => number;

// Random sample without replacement — fine for a pool of a few hundred
// players; no need for anything fancier here.
export function sampleWithoutReplacement<T>(items: T[], count: number, rng: Rng = Math.random): T[] {
    const pool = [...items];
    const picked: T[] = [];

    while (pool.length > 0 && picked.length < count) {
        const index = Math.floor(rng() * pool.length);
        const [item] = pool.splice(index, 1);

        if (item !== undefined) {
            picked.push(item);
        }
    }

    return picked;
}

// At least one of the 3 candidates offered should keep the game genuinely
// winnable when the pool allows it — otherwise a run of bad luck alone could
// make a slot's draw a dead end regardless of skill, and the Hint feature
// would sometimes be ruling out one of 3 losing options, leaving no actual
// path to winning either way. `viable` is a subset of the whole eligible pool
// (already computed by the caller); the other 2 slots stay plain random, and
// the 3 are shuffled together so the guaranteed pick doesn't always land in
// the same offered position.
export function drawWithViabilityBias<T extends { id: string }>(eligible: T[], viable: T[], count: number, rng: Rng = Math.random): T[] {
    if (viable.length === 0) {
        return sampleWithoutReplacement(eligible, count, rng);
    }

    const guaranteed = viable[Math.floor(rng() * viable.length)]!;
    const rest = eligible.filter((player) => player.id !== guaranteed.id);
    const combined = [guaranteed, ...sampleWithoutReplacement(rest, count - 1, rng)];

    for (let i = combined.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));

        [combined[i], combined[j]] = [combined[j]!, combined[i]!];
    }

    return combined;
}

/**
 * Last-pick fairness (exact objectives, final slot only). The guaranteed
 * option used to ALWAYS land exactly on the target, so reaching the last slot
 * alive made the jackpot a 1-in-3 read of three names. Now:
 * - with probability FINAL_SLOT_EXACT_CHANCE (1/3) it lands exactly (falling
 *   back to the Title window if nothing in the pool does);
 * - otherwise it lands in the Title window, gap − W ≤ value ≤ gap − 1. If the
 *   window is empty there is NO guarantee (plain random) — deliberately not
 *   a fallback to exact: the window is empty on ~18% of final draws (every
 *   gap of 0, and small gaps on sparse positions), and falling back to exact
 *   there put the fan model's exact rate back up at 14.5% with a 30% chance
 *   of winning from the last slot. Without it: 7.9% and 16% (yarn sim:balance).
 * The other two options stay random, so the player can no longer tell
 * whether a jackpot option is there. `valueOf` is the slot's counted value
 * (G+A in Classic).
 */
export function finalSlotViable<T>(eligible: T[], gap: number, target: number, valueOf: (item: T) => number, rng: Rng = Math.random): T[] {
    if (gap < 0) {
        return [];
    }

    const window = titleWindowFor(target);
    const title = eligible.filter((item) => {
        const value = valueOf(item);

        return value <= gap - 1 && value >= gap - window;
    });

    if (rng() < FINAL_SLOT_EXACT_CHANCE) {
        const exact = eligible.filter((item) => valueOf(item) === gap);

        return exact.length > 0 ? exact : title;
    }

    return title;
}

export interface ClassicDrawInput {
    group: PositionGroup;
    excludeIds: ReadonlySet<string>;
    /**
     * The viability-bias inputs — every OTHER still-empty slot's group, the
     * objective and the running total. Absent → plain random (an older
     * client tab mid-game during a deploy keeps working as before).
     */
    bias?: {
        otherRemaining: readonly PositionGroup[];
        objectiveKind: ObjectiveKind;
        objectiveValue: number;
        runningTotal: number;
    } | null;
    rng?: Rng;
}

export function drawClassicCandidates(input: ClassicDrawInput): Player[] {
    const rng = input.rng ?? Math.random;
    const eligible = getPlayersByPosition(input.group).filter((player) => !input.excludeIds.has(player.id));
    const bias = input.bias;

    if (!bias) {
        return sampleWithoutReplacement(eligible, CANDIDATES_PER_DRAW, rng);
    }

    const value = (player: Player): number => player.goals + player.assists;
    let viable: Player[];

    if (bias.otherRemaining.length === 0 && bias.objectiveKind === 'exact') {
        viable = finalSlotViable(eligible, bias.objectiveValue - bias.runningTotal, bias.objectiveValue, value, rng);
    } else {
        const otherPools = bias.otherRemaining.map((group) => (
            getPlayersByPosition(group).filter((player) => !input.excludeIds.has(player.id))
        ));
        const isViable = buildViabilityCheck(otherPools, bias.objectiveKind, bias.objectiveValue, bias.runningTotal);

        viable = eligible.filter((player) => isViable(value(player)));
    }

    return drawWithViabilityBias(eligible, viable, CANDIDATES_PER_DRAW, rng);
}

/** Never includes goals/assists (D2) — only what's needed to render a choice, plus the signed token. */
export async function toDrawnPlayers(players: Player[], gameId: string, secret: string, long = false): Promise<DrawnPlayer[]> {
    const options = long ? { ttlMs: TOKEN_TTL_LONG_MS } : {};

    return Promise.all(players.map(async (player) => ({
        id: player.id,
        name: player.name,
        clubs: player.clubs,
        firstSeason: player.firstSeason,
        lastSeason: player.lastSeason,
        appearances: player.appearances,
        token: await signPlayerToken(player.id, gameId, secret, options),
    })));
}
