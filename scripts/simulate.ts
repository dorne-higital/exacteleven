// Balance simulation for the seven v1 formations, using the real player pool
// from server/assets/players.json. Plays many games per formation under two
// strategies to gauge whether the D1 (bust on overshoot) / D4 (25+ appearance
// pool floor) decisions produce a fair, winnable-but-not-trivial game:
//
//   - "random":   picks uniformly at random from the 3 offered players.
//   - "sensible": a semi-informed player who (unrealistically, since real
//     players can't see hidden stats) knows each candidate's true G+A and
//     picks whichever is closest to a fair share of the remaining target
//     over the remaining slots. This is a ceiling estimate of how good an
//     experienced player's *guesses* could get, not a realistic strategy.
//
// Also reports the full distribution of finishing distances (every non-bust
// game that isn't an exact win) — used to empirically pick the 5
// league-table tier boundaries in app/utils/scoring.ts, the same way
// WIN_TOLERANCE was originally picked.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formations } from '../app/utils/formations.ts';
import { calculateTotal, getGameResult } from '../app/utils/scoring.ts';
import type { Formation, GameStatus, Player, PositionGroup } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = join(ROOT, 'server/assets/players.json');
const GAMES_PER_STRATEGY = 5000;
const STRATEGIES = ['random', 'sensible'] as const;

type Strategy = (typeof STRATEGIES)[number];

interface StrategyTotals {
    wins: number;
    busts: number;
    finished: number;
    distanceSum: number;
}

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}

function drawThree(pool: Player[], excluded: Set<string>): Player[] {
    const eligible = pool.filter((player) => !excluded.has(player.id));

    return shuffle(eligible).slice(0, 3);
}

function pickRandom(offered: Player[]): Player {
    return offered[Math.floor(Math.random() * offered.length)];
}

function pickSensible(offered: Player[], remainingTarget: number, remainingSlots: number): Player {
    const fairShare = remainingTarget / remainingSlots;

    return offered.reduce((best, candidate) => {
        const candidateValue = candidate.goals + candidate.assists;
        const bestValue = best.goals + best.assists;

        return Math.abs(candidateValue - fairShare) < Math.abs(bestValue - fairShare) ? candidate : best;
    });
}

function simulateGame(
    formation: Formation,
    poolsByPosition: Record<PositionGroup, Player[]>,
    strategy: Strategy,
): { status: GameStatus; distance: number } {
    const excluded = new Set<string>();
    const picked: Player[] = [];
    let total = 0;
    let status: GameStatus = 'playing';

    for (let index = 0; index < formation.slots.length; index += 1) {
        const slot = formation.slots[index];
        const offered = drawThree(poolsByPosition[slot.group], excluded);

        for (const candidate of offered) {
            excluded.add(candidate.id);
        }

        const remainingSlots = formation.slots.length - index;
        const remainingTarget = formation.target - total;
        const choice = strategy === 'random'
            ? pickRandom(offered)
            : pickSensible(offered, remainingTarget, remainingSlots);

        picked.push(choice);
        total = calculateTotal(picked);

        const result = getGameResult(total, formation.target, picked.length, formation.slots.length);

        status = result.status;

        if (status === 'bust') {
            break;
        }
    }

    return { status, distance: status === 'finished' ? Math.abs(formation.target - total) : 0 };
}

function runStrategy(
    formation: Formation,
    poolsByPosition: Record<PositionGroup, Player[]>,
    strategy: Strategy,
    allDistances: number[],
): StrategyTotals {
    const totals: StrategyTotals = { wins: 0, busts: 0, finished: 0, distanceSum: 0 };

    for (let i = 0; i < GAMES_PER_STRATEGY; i += 1) {
        const { status, distance } = simulateGame(formation, poolsByPosition, strategy);

        if (status === 'won') {
            totals.wins += 1;
        } else if (status === 'bust') {
            totals.busts += 1;
        } else if (status === 'finished') {
            totals.finished += 1;
            totals.distanceSum += distance;
            allDistances.push(distance);
        }
    }

    return totals;
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) {
        return 0;
    }

    const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));

    return sorted[index]!;
}

async function main(): Promise<void> {
    const players = JSON.parse(await readFile(PLAYERS_PATH, 'utf8')) as Player[];
    const poolsByPosition: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };

    for (const player of players) {
        poolsByPosition[player.position].push(player);
    }

    console.log('\n=== Exact XI — balance simulation ===');
    console.log(
        `${GAMES_PER_STRATEGY} games per formation per strategy, using the real ${players.length}-player v1 pool `
        + `(2016/17+). Win = exact match only.\n`,
    );
    console.log('Formation | Strategy | Win%  | Bust% | Finished% | AvgDistance (finished only)');
    console.log('----------|----------|-------|-------|-----------|----------------------------');

    const allDistances: number[] = [];

    for (const formation of formations) {
        for (const strategy of STRATEGIES) {
            const totals = runStrategy(formation, poolsByPosition, strategy, allDistances);
            const winPct = (totals.wins / GAMES_PER_STRATEGY) * 100;
            const bustPct = (totals.busts / GAMES_PER_STRATEGY) * 100;
            const finishedPct = (totals.finished / GAMES_PER_STRATEGY) * 100;
            const avgDistance = totals.finished > 0 ? totals.distanceSum / totals.finished : 0;

            console.log(
                `${formation.code.padEnd(9)} | ${strategy.padEnd(8)} | ${winPct.toFixed(2).padStart(5)} | `
                + `${bustPct.toFixed(1).padStart(5)} | ${finishedPct.toFixed(1).padStart(9)} | ${avgDistance.toFixed(1)}`,
            );
        }
    }

    const sorted = [...allDistances].sort((a, b) => a - b);

    console.log(`\n=== Distance distribution across all finished (non-exact, non-bust) games: n=${sorted.length} ===`);
    console.log(`min=${sorted[0]} p10=${percentile(sorted, 10)} p25=${percentile(sorted, 25)} `
        + `p40=${percentile(sorted, 40)} median=${percentile(sorted, 50)} p60=${percentile(sorted, 60)} `
        + `p75=${percentile(sorted, 75)} p90=${percentile(sorted, 90)} p95=${percentile(sorted, 95)} `
        + `max=${sorted[sorted.length - 1]}`);

    const bins = [10, 25, 50, 75, 100, 150, 200, 300, Infinity];
    let lower = 0;

    console.log('\nHistogram (distance range -> count, % of finished):');

    for (const upper of bins) {
        const count = sorted.filter((d) => d > lower && d <= upper).length;
        const label = upper === Infinity ? `>${lower}` : `${lower + 1}-${upper}`;

        console.log(`  ${label.padEnd(10)} ${String(count).padStart(6)}  (${((count / sorted.length) * 100).toFixed(1)}%)`);
        lower = upper;
    }
}

await main();
