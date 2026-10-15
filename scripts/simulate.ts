// Classic balance simulation for the seven formations, using the real player
// pool (server/assets/players.json) and the REAL draw code the server runs
// (server/utils/classic-draw.ts) — including the live viability bias, which
// the original version of this script never modelled (that's why the old
// "<1% exact" figure in the README was stale: /api/draw always guaranteed
// one option that keeps a win possible, and on the final slot that option
// always landed EXACTLY on the target).
//
// It compares two final-slot rules on otherwise identical games:
//   - before: the guaranteed final-slot option always lands exactly (pre-2.0);
//   - after:  the live rule (shared/classic.ts) — exact only
//             FINAL_SLOT_EXACT_CHANCE of the time, otherwise inside the Title
//             winners window (gap − W … gap − 1).
// and three player models:
//   - random: picks uniformly from the 3 options;
//   - fan:    sees each hidden G+A through ±45% log-normal noise (a
//             knowledgeable player) and aims for a fair share of what's left;
//   - oracle: knows the true numbers (a ceiling, not a real player).
// Slots are filled in a random order, like real taps.
//
// Output: per-formation exact/Title rates, P(win | reached the last slot with
// an exact landing possible), the result-ladder shares (app/utils/scoring.ts's
// getGameResult — the same function the game uses), and the figures for
// app/utils/formations.ts's FORMATION_DIFFICULTY.
//
// Earlier slots' viability uses a memoised "which sums can the remaining
// positions still make" table that ignores exclusions — the server's own
// check (buildViabilityCheck) honours them, but the difference is tiny and
// this keeps 250k+ games fast.
//
// Run: yarn sim:balance [gamesPerFormation=4000] [seed=2026]
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formations } from '../app/utils/formations.ts';
import { getGameResult } from '../app/utils/scoring.ts';
import { drawWithViabilityBias, finalSlotViable, sampleWithoutReplacement, type Rng } from '../server/utils/classic-draw.ts';
import { titleWindowFor } from '../shared/classic.ts';
import { mulberry32 } from '../shared/daily.ts';
import type { Formation, Player, PositionGroup, ResultTier } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = join(ROOT, 'server/assets/players.json');
const GAMES = Number(process.argv[2] ?? 4000);
const SEED = Number(process.argv[3] ?? 2026);
const RULES = ['before', 'after'] as const;
const MODELS = ['random', 'fan', 'oracle'] as const;
const FAN_NOISE = 0.45;
const MAX_SUM = 2000;

type Rule = (typeof RULES)[number];
type Model = (typeof MODELS)[number];
type Outcome = 'exact' | ResultTier | 'bust';

const OUTCOMES: Outcome[] = ['exact', 'titleWinners', 'championsLeague', 'europaLeague', 'midTable', 'avoidedRelegation', 'relegated', 'bust'];
const OUTCOME_LABEL: Record<Outcome, string> = {
    exact: 'exact',
    titleWinners: 'Title',
    championsLeague: 'CL',
    europaLeague: 'EL',
    midTable: 'Mid',
    avoidedRelegation: 'AR',
    relegated: 'Rel',
    bust: 'bust',
};

const value = (player: Player): number => player.goals + player.assists;

function gaussian(rng: Rng): number {
    return Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
}

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));

        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }

    return copy;
}

interface Pools {
    byGroup: Record<PositionGroup, Player[]>;
    distinctValues: Record<PositionGroup, number[]>;
    reachMemo: Map<string, Uint8Array>;
}

// Which totals the remaining positions can still add up to (exclusions ignored).
function reachable(pools: Pools, groups: readonly PositionGroup[]): Uint8Array {
    const key = (['GK', 'DEF', 'MID', 'FWD'] as const).map((group) => groups.filter((g) => g === group).length).join(',');
    const hit = pools.reachMemo.get(key);

    if (hit) {
        return hit;
    }

    let sums = new Uint8Array(MAX_SUM + 1);

    sums[0] = 1;

    for (const group of groups) {
        const next = new Uint8Array(MAX_SUM + 1);

        for (let sum = 0; sum <= MAX_SUM; sum += 1) {
            if (sums[sum]) {
                for (const v of pools.distinctValues[group]) {
                    if (sum + v <= MAX_SUM) {
                        next[sum + v] = 1;
                    }
                }
            }
        }

        sums = next;
    }

    pools.reachMemo.set(key, sums);

    return sums;
}

function drawSlot(pools: Pools, group: PositionGroup, excluded: Set<string>, others: readonly PositionGroup[], target: number, total: number, rule: Rule, rng: Rng): Player[] {
    const eligible = pools.byGroup[group].filter((player) => !excluded.has(player.id));
    const gap = target - total;
    let viable: Player[];

    if (others.length === 0) {
        viable = rule === 'before'
            ? eligible.filter((player) => value(player) === gap)
            : finalSlotViable(eligible, gap, target, value, rng);
    } else {
        const reach = reachable(pools, others);

        viable = eligible.filter((player) => {
            const left = gap - value(player);

            return left >= 0 && left <= MAX_SUM && reach[left] === 1;
        });
    }

    return viable.length === 0 ? sampleWithoutReplacement(eligible, 3, rng) : drawWithViabilityBias(eligible, viable, 3, rng);
}

function choose(options: Player[], model: Model, gap: number, slotsLeft: number, rng: Rng): Player {
    if (model === 'random') {
        return options[Math.floor(rng() * options.length)]!;
    }

    const share = gap / slotsLeft;
    let best = options[0]!;
    let bestScore = Infinity;

    for (const option of options) {
        const seen = model === 'oracle' ? value(option) : value(option) * Math.exp(FAN_NOISE * gaussian(rng));
        // Over the gap is a bust: avoid it above everything else.
        const score = (slotsLeft === 1 ? gap - seen : Math.abs(seen - share)) + (seen > gap ? 1000 + seen - gap : 0);

        if (score < bestScore) {
            bestScore = score;
            best = option;
        }
    }

    return best;
}

interface GameRecord {
    outcome: Outcome;
    /** Reached the last slot alive with some player in the pool landing it exactly. */
    lastSlotExactReachable: boolean;
}

function playGame(pools: Pools, formation: Formation, rule: Rule, model: Model, rng: Rng): GameRecord {
    const order = shuffled(formation.slots.map((slot) => slot.group), rng);
    const excluded = new Set<string>();
    let total = 0;
    let lastSlotExactReachable = false;

    for (let index = 0; index < order.length; index += 1) {
        const group = order[index]!;
        const others = order.slice(index + 1);

        if (others.length === 0) {
            const gap = formation.target - total;

            lastSlotExactReachable = pools.byGroup[group].some((player) => !excluded.has(player.id) && value(player) === gap);
        }

        const options = drawSlot(pools, group, excluded, others, formation.target, total, rule, rng);

        for (const option of options) {
            excluded.add(option.id);
        }

        total += value(choose(options, model, formation.target - total, order.length - index, rng));

        const result = getGameResult(total, formation.target, index + 1, order.length);

        if (result.status === 'bust') {
            return { outcome: 'bust', lastSlotExactReachable };
        }

        if (result.status === 'won') {
            return { outcome: 'exact', lastSlotExactReachable };
        }

        if (result.status === 'finished') {
            return { outcome: result.tier!, lastSlotExactReachable };
        }
    }

    return { outcome: 'bust', lastSlotExactReachable };
}

const pct = (part: number, whole: number): string => `${((100 * part) / Math.max(1, whole)).toFixed(1)}%`;

async function main(): Promise<void> {
    const players = JSON.parse(await readFile(PLAYERS_PATH, 'utf8')) as Player[];
    const pools: Pools = {
        byGroup: { GK: [], DEF: [], MID: [], FWD: [] },
        distinctValues: { GK: [], DEF: [], MID: [], FWD: [] },
        reachMemo: new Map(),
    };

    for (const player of players) {
        pools.byGroup[player.position].push(player);
    }

    for (const group of ['GK', 'DEF', 'MID', 'FWD'] as const) {
        pools.distinctValues[group] = [...new Set(pools.byGroup[group].map(value))];
    }

    const rng = mulberry32(SEED);

    console.log('\n=== Exact XI — Classic balance simulation ===');
    console.log(`${GAMES} games per formation, rule and model; ${players.length} players; seed ${SEED}.`);
    console.log(`Title window W = titleWindowFor(target): ${formations.map((f) => `${f.code}=${titleWindowFor(f.target)}`).join(' ')}\n`);

    const tallies = new Map<string, Record<Outcome, number>>();
    const lastSlot = new Map<string, { reached: number; won: number }>();

    for (const rule of RULES) {
        for (const model of MODELS) {
            for (const formation of formations) {
                const tally = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<Outcome, number>;
                const last = { reached: 0, won: 0 };

                for (let game = 0; game < GAMES; game += 1) {
                    const record = playGame(pools, formation, rule, model, rng);

                    tally[record.outcome] += 1;

                    if (record.lastSlotExactReachable) {
                        last.reached += 1;
                        last.won += record.outcome === 'exact' ? 1 : 0;
                    }
                }

                tallies.set(`${rule}|${model}|${formation.code}`, tally);
                lastSlot.set(`${rule}|${model}|${formation.code}`, last);
            }
        }
    }

    const sum = (rule: Rule, model: Model): { tally: Record<Outcome, number>; last: { reached: number; won: number } } => {
        const tally = Object.fromEntries(OUTCOMES.map((outcome) => [outcome, 0])) as Record<Outcome, number>;
        const last = { reached: 0, won: 0 };

        for (const formation of formations) {
            const one = tallies.get(`${rule}|${model}|${formation.code}`)!;
            const oneLast = lastSlot.get(`${rule}|${model}|${formation.code}`)!;

            for (const outcome of OUTCOMES) {
                tally[outcome] += one[outcome];
            }

            last.reached += oneLast.reached;
            last.won += oneLast.won;
        }

        return { tally, last };
    };

    const all = GAMES * formations.length;

    console.log('Model  | Exact before | Exact after | Title after | P(win | last slot, exact reachable) before → after');
    console.log('-------|--------------|-------------|-------------|---------------------------------------------------');

    for (const model of MODELS) {
        const before = sum('before', model);
        const after = sum('after', model);

        console.log(
            `${model.padEnd(6)} | ${pct(before.tally.exact, all).padStart(12)} | ${pct(after.tally.exact, all).padStart(11)} | `
            + `${pct(after.tally.titleWinners, all).padStart(11)} | ${pct(before.last.won, before.last.reached)} → ${pct(after.last.won, after.last.reached)}`,
        );
    }

    console.log('\nResult-ladder shares of ALL games (new ladder, app/utils/scoring.ts):');

    for (const rule of RULES) {
        for (const model of MODELS) {
            const { tally } = sum(rule, model);

            console.log(`  ${rule.padEnd(6)} ${model.padEnd(6)} ${OUTCOMES.map((outcome) => `${OUTCOME_LABEL[outcome]} ${pct(tally[outcome], all)}`).join(' | ')}`);
        }
    }

    console.log('\nPer formation, fan model, live rule → FORMATION_DIFFICULTY (app/utils/formations.ts):');
    console.log('Code | Exact % | Title-or-better % | (before: exact %)');

    for (const formation of formations) {
        const after = tallies.get(`after|fan|${formation.code}`)!;
        const before = tallies.get(`before|fan|${formation.code}`)!;

        console.log(
            `${formation.code}  | ${pct(after.exact, GAMES).padStart(7)} | ${pct(after.exact + after.titleWinners, GAMES).padStart(17)} | ${pct(before.exact, GAMES)}`,
        );
    }
}

await main();
