// Balance simulation for the Daily Challenge / custom-challenge objective
// kinds ('over'/'under'/'allUnder') and their curated value lists in
// shared/daily.ts — those were flagged in-code as "initial guesses, not
// simulation-tuned like scoring.ts's tier boundaries." This is that pass.
//
// Unlike scripts/simulate.ts's "sensible" strategy (which targets a known
// exact number), there's no equivalent informed heuristic for "stay under X"
// or "every player under X" — a real player never sees hidden stats before
// picking, so "random" is both the realistic baseline AND the only one worth
// reporting here.
//
// Every value is paired with every formation over time (objective kind,
// value-within-kind, and formation all cycle off the same day index on
// independent periods — see shared/daily.ts), so this simulates each
// value across all 7 formations rather than picking just one.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formations } from '../app/utils/formations.ts';
import { getObjectiveResult } from '../app/utils/daily-scoring.ts';
import { ALL_UNDER_VALUES, OVER_VALUES, UNDER_VALUES } from '../shared/daily.ts';
import type { Formation, GameStatus, ObjectiveKind, Player, PositionGroup } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = join(ROOT, 'server/assets/players.json');
const GAMES_PER_VALUE = 4000;

interface Totals {
    won: number;
    bust: number;
    lost: number;
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

function simulateGame(
    formation: Formation,
    poolsByPosition: Record<PositionGroup, Player[]>,
    kind: ObjectiveKind,
    value: number,
): GameStatus {
    const excluded = new Set<string>();
    const picked: Player[] = [];
    let status: GameStatus = 'playing';

    for (const slot of formation.slots) {
        const offered = drawThree(poolsByPosition[slot.group], excluded);

        for (const candidate of offered) {
            excluded.add(candidate.id);
        }

        const choice = offered[Math.floor(Math.random() * offered.length)]!;

        picked.push(choice);

        const result = getObjectiveResult({ kind, value, label: '' }, picked, formation.slots.length);

        status = result.status;

        if (status === 'bust') {
            break;
        }
    }

    return status;
}

function runValue(
    poolsByPosition: Record<PositionGroup, Player[]>,
    kind: ObjectiveKind,
    value: number,
): Totals {
    const totals: Totals = { won: 0, bust: 0, lost: 0 };

    for (let i = 0; i < GAMES_PER_VALUE; i += 1) {
        const formation = formations[i % formations.length]!;
        const status = simulateGame(formation, poolsByPosition, kind, value);

        if (status === 'won') {
            totals.won += 1;
        } else if (status === 'bust') {
            totals.bust += 1;
        } else if (status === 'lost') {
            totals.lost += 1;
        }
    }

    return totals;
}

async function main(): Promise<void> {
    const players = JSON.parse(await readFile(PLAYERS_PATH, 'utf8')) as Player[];
    const poolsByPosition: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };

    for (const player of players) {
        poolsByPosition[player.position].push(player);
    }

    console.log('\n=== Exact XI — daily/challenge objective balance simulation ===');
    console.log(
        `${GAMES_PER_VALUE} random-pick games per value, cycled evenly across all 7 formations, using the real `
        + `${players.length}-player v1 pool.\n`,
    );
    console.log('Kind     | Value | Win%  | Bust% | Lost%');
    console.log('---------|-------|-------|-------|------');

    const rows: Array<{ kind: ObjectiveKind; value: number }> = [
        ...OVER_VALUES.map((value) => ({ kind: 'over' as const, value })),
        ...UNDER_VALUES.map((value) => ({ kind: 'under' as const, value })),
        ...ALL_UNDER_VALUES.map((value) => ({ kind: 'allUnder' as const, value })),
    ];

    for (const { kind, value } of rows) {
        const totals = runValue(poolsByPosition, kind, value);
        const winPct = (totals.won / GAMES_PER_VALUE) * 100;
        const bustPct = (totals.bust / GAMES_PER_VALUE) * 100;
        const lostPct = (totals.lost / GAMES_PER_VALUE) * 100;

        console.log(
            `${kind.padEnd(8)} | ${String(value).padStart(5)} | ${winPct.toFixed(1).padStart(5)} | `
            + `${bustPct.toFixed(1).padStart(5)} | ${lostPct.toFixed(1).padStart(5)}`,
        );
    }
}

await main();
