// Daily 2.0 balance simulation: generates real Dailies with the server's own
// generator (server/utils/daily2-generate.ts) and plays them through the
// shared move engine (shared/daily2-rules.ts) — the same code that scores
// every real submit — so the figures here are what players will get.
//
// Player models:
//   - random: picks uniformly; names a captain at random before the last pick.
//   - fan:    sees each hidden number through ±45% log-normal noise. Aims for
//             a fair share of the gap on exact days, the biggest on over days,
//             the smallest on under/all-under days; rerolls once on an exact
//             day when every option looks far off; names a safe captain
//             (or a blind one on the last slot) to land the target; benches
//             its biggest player when a pick busts it.
// The fan is also run without the bench, to show what the bench is worth.
// No scouting clue is modelled (it costs 50 and only narrows one option).
//
// Prints the weekly-rhythm table (README "Daily 2.0"): per weekday, generator
// attempts and timing, perfect XIs, fan win rate (with/without bench), fan
// average and median score, random win rate.
//
// Run: yarn sim:daily [days=140] [runsPerDay=300] [startMonday=2026-11-02]
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFormation } from '../app/utils/formations.ts';
import { generateDailyPuzzle, groupPools, type DailyPuzzleFull } from '../server/utils/daily2-generate.ts';
import { createDailyEngine, dailyFormationFor, dayStatValue, type DailyEngine, type DailyView } from '../shared/daily2-rules.ts';
import type { DailyMove } from '../shared/daily2-types.ts';
import { mulberry32 } from '../shared/daily.ts';
import { addDays } from '../shared/uk-date.ts';
import type { Player } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = join(ROOT, 'server/assets/players.json');
const DAYS = Number(process.argv[2] ?? 140);
const RUNS = Number(process.argv[3] ?? 300);
const START = process.argv[4] ?? '2026-11-02'; // a Monday
const FAN_NOISE = 0.45;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Model = 'random' | 'fan' | 'fanNoBench';
type Rng = () => number;

const rng: Rng = mulberry32(2026);

function gaussian(): number {
    return Math.sqrt(-2 * Math.log(rng() || 1e-9)) * Math.cos(2 * Math.PI * rng());
}

interface Sim {
    puzzle: DailyPuzzleFull;
    view: DailyView;
    byId: Map<string, Player>;
    valueOf: (id: string) => number | undefined;
    subFor: (slotId: string) => string | undefined;
}

function prepare(puzzle: DailyPuzzleFull): Sim {
    const stat = puzzle.objective.stat;
    const byId = new Map<string, Player>();

    for (const slot of puzzle.slots) {
        for (const player of [...slot.main, ...slot.reroll, slot.sub]) {
            byId.set(player.id, player);
        }
    }

    const subs = new Map(puzzle.slots.map((slot) => [slot.slotId, slot.sub.id]));

    return {
        puzzle,
        view: {
            objective: puzzle.objective,
            locked: puzzle.locked.map(({ slotId, player }) => ({ slotId, value: dayStatValue(player, stat) })),
            slots: puzzle.slots.map((slot) => ({ slotId: slot.slotId, main: slot.main.map((p) => p.id), reroll: slot.reroll.map((p) => p.id) })),
        },
        byId,
        valueOf: (id) => {
            const player = byId.get(id);

            return player ? dayStatValue(player, stat) : undefined;
        },
        subFor: (slotId) => subs.get(slotId),
    };
}

/** Plays one game through the real engine; returns the final score and whether it was a win. */
function playOnce(sim: Sim, model: Model): { score: number; won: boolean } {
    const { kind, value: target } = sim.puzzle.objective;
    const engine: DailyEngine = createDailyEngine(sim.view, sim.valueOf, sim.subFor);
    const fan = model !== 'random';
    const apply = (move: DailyMove): boolean => engine.apply(move) === null;
    const perceive = (id: string): number => (fan ? sim.valueOf(id)! * Math.exp(FAN_NOISE * gaussian()) + 0.5 * gaussian() : rng() * 100);
    const revealed = new Map<string, number>(); // open slotId -> raw value of its occupant
    const order = [...sim.view.slots].sort(() => rng() - 0.5);

    for (let step = 0; step < order.length; step += 1) {
        const snap = engine.snapshot();

        if (snap.status !== 'playing') {
            break;
        }

        const slot = order[step]!;
        const left = snap.openSlotIds.length;
        const gap = target - snap.total;
        let options = snap.rerolledSlotId === slot.slotId ? slot.reroll! : slot.main;
        let seen = options.map(perceive);

        // Reroll (fan, exact days): every option looks far from a fair share.
        if (fan && kind === 'exact' && !snap.helps.reroll && left > 2) {
            const share = gap / (left + (snap.captainSlotId === null ? 1 : 0));

            if (seen.every((x) => Math.abs(x - share) > 0.6 * share + 3) && apply({ t: 'reroll', slotId: slot.slotId })) {
                options = slot.reroll!;
                seen = options.map(perceive);
            }
        }

        let choice = 0;

        if (!fan) {
            choice = Math.floor(rng() * options.length);
        } else if (kind === 'over') {
            choice = seen.indexOf(Math.max(...seen));
        } else if (kind === 'under' || kind === 'allUnder') {
            choice = seen.indexOf(Math.min(...seen));
        } else if (left === 1 && snap.captainSlotId === null) {
            // Last pick, no captain yet: choose the captain and the option together.
            let best = Infinity;
            let captain = slot.slotId;

            for (const [slotId, v] of revealed) {
                for (let o = 0; o < seen.length; o += 1) {
                    const need = gap - v;

                    if (need >= 0 && Math.abs(seen[o]! - need) < best) {
                        best = Math.abs(seen[o]! - need);
                        captain = slotId;
                        choice = o;
                    }
                }
            }

            for (let o = 0; o < seen.length; o += 1) {
                if (Math.abs(2 * seen[o]! - gap) < best) {
                    best = Math.abs(2 * seen[o]! - gap);
                    captain = slot.slotId;
                    choice = o;
                }
            }

            if (!apply({ t: 'captain', slotId: captain })) {
                apply({ t: 'captain', slotId: slot.slotId });
            }
        } else {
            const share = gap / (left + (snap.captainSlotId === null ? 1 : 0));
            let best = Infinity;

            seen.forEach((x, k) => {
                const score = Math.abs(x - share) + (x > gap ? 1000 : 0);

                if (score < best) {
                    best = score;
                    choice = k;
                }
            });
        }

        // Captain for non-exact days (fan): on the best filled player with 2 left.
        if (fan && kind !== 'exact' && engine.snapshot().captainSlotId === null && left === 2 && revealed.size > 0) {
            const entries = [...revealed.entries()].sort((a, b) => (kind === 'over' ? b[1] - a[1] : a[1] - b[1]));

            for (const [slotId] of entries) {
                if (apply({ t: 'captain', slotId })) {
                    break;
                }
            }
        }

        // Anyone still without a captain names one before the last pick.
        if (engine.snapshot().captainSlotId === null && left === 1) {
            const candidates = [slot.slotId, ...revealed.keys()].sort(() => rng() - 0.5);

            for (const slotId of candidates) {
                if (apply({ t: 'captain', slotId })) {
                    break;
                }
            }
        }

        if (engine.snapshot().status !== 'playing') {
            break;
        }

        const playerId = options[choice]!;

        apply({ t: 'pick', slotId: slot.slotId, playerId });
        revealed.set(slot.slotId, sim.valueOf(playerId)!);

        if (engine.snapshot().pendingBust) {
            if (model === 'fanNoBench') {
                apply({ t: 'acceptBust' });
            } else {
                // Take off the biggest counted contributor.
                const [worst] = [...revealed.entries()].sort((a, b) => b[1] - a[1]);

                apply({ t: 'bench', slotId: worst![0] });
                revealed.set(worst![0], sim.valueOf(sim.subFor(worst![0])!)!);
            }
        }
    }

    const final = engine.snapshot();

    return { score: final.score ?? 0, won: final.status === 'won' };
}

interface DayTally {
    days: number;
    attempts: number;
    maxAttempts: number;
    maxMs: number;
    perfect: number[];
    values: number[];
    fanScores: number[];
    fanWins: number;
    fanNoBenchWins: number;
    randomWins: number;
    runs: number;
}

async function main(): Promise<void> {
    const players = JSON.parse(await readFile(PLAYERS_PATH, 'utf8')) as Player[];
    const pools = groupPools(players);
    const tallies = new Map<number, DayTally>();

    for (let day = 0; day < DAYS; day += 1) {
        const date = addDays(START, day);
        const started = performance.now();
        const puzzle = generateDailyPuzzle(date, pools, getFormation(dailyFormationFor(date))!);
        const ms = performance.now() - started;
        const sim = prepare(puzzle);
        const tally = tallies.get(puzzle.weekday) ?? {
            days: 0, attempts: 0, maxAttempts: 0, maxMs: 0, perfect: [], values: [], fanScores: [], fanWins: 0, fanNoBenchWins: 0, randomWins: 0, runs: 0,
        };

        tally.days += 1;
        tally.attempts += puzzle.meta.attempts;
        tally.maxAttempts = Math.max(tally.maxAttempts, puzzle.meta.attempts);
        tally.maxMs = Math.max(tally.maxMs, ms);
        tally.perfect.push(puzzle.meta.perfectXIs);
        tally.values.push(puzzle.objective.value);

        for (let run = 0; run < RUNS; run += 1) {
            const fanRun = playOnce(sim, 'fan');

            tally.fanScores.push(fanRun.score);
            tally.fanWins += fanRun.won ? 1 : 0;
            tally.fanNoBenchWins += playOnce(sim, 'fanNoBench').won ? 1 : 0;
            tally.randomWins += playOnce(sim, 'random').won ? 1 : 0;
            tally.runs += 1;
        }

        tallies.set(puzzle.weekday, tally);
    }

    const pct = (part: number, whole: number): string => `${((100 * part) / Math.max(1, whole)).toFixed(1)}%`;

    console.log('\n=== Exact XI — Daily 2.0 balance simulation ===');
    console.log(`${DAYS} days from ${START}, ${RUNS} runs per day per model, real generator + engine.\n`);
    console.log('Day | Objective          | Attempts avg/max | Max gen ms | Perfect XIs med (min–max) | Fan win (no bench) | Fan avg / median | Random win');
    console.log('----|--------------------|------------------|------------|---------------------------|--------------------|------------------|-----------');

    for (const [weekday, tally] of [...tallies.entries()].sort((a, b) => a[0] - b[0])) {
        const perfect = [...tally.perfect].sort((a, b) => a - b);
        const scores = [...tally.fanScores].sort((a, b) => a - b);
        const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const objective = generateLabel(weekday);

        console.log(
            `${WEEKDAYS[weekday]} | ${objective.padEnd(18)} | ${`${(tally.attempts / tally.days).toFixed(1)}/${tally.maxAttempts}`.padStart(16)} | `
            + `${tally.maxMs.toFixed(0).padStart(10)} | ${`${perfect[Math.floor(perfect.length / 2)]} (${perfect[0]}–${perfect[perfect.length - 1]})`.padStart(25)} | `
            + `${`${pct(tally.fanWins, tally.runs)} (${pct(tally.fanNoBenchWins, tally.runs)})`.padStart(18)} | `
            + `${`${average.toFixed(0)} / ${scores[Math.floor(scores.length / 2)]}`.padStart(16)} | ${pct(tally.randomWins, tally.runs)}`,
        );
    }
}

function generateLabel(weekday: number): string {
    return ['Over G+A', 'All under G+A', 'Exact G+A', 'Under G+A', 'Exact goals', 'Exact assists', 'Exact G+A (hard)'][weekday]!;
}

await main();
