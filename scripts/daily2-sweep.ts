// Generates every Daily 2.0 puzzle for three years from launch with the real
// generator and asserts none of them fails (generateDailyPuzzle throws only
// after 400 attempts; attempts 200-399 drop the exact-day band). Prints
// attempts and timings per weekday so a change to the generator or to
// players.json can be checked before it ships. Exits non-zero on any failure.
//
// Past puzzles are frozen in Netlify Blobs the first time they're served, so
// this only matters for days nobody has opened yet — but a throw there is a
// 500 on that morning's Daily, so it must never happen.
//
// Run: yarn sim:daily2-sweep [years=3] [startDate=DAILY2_LAUNCH_DATE]
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getFormation } from '../app/utils/formations.ts';
import { generateDailyPuzzle, groupPools } from '../server/utils/daily2-generate.ts';
import { DAILY2_LAUNCH_DATE, dailyFormationFor } from '../shared/daily2-rules.ts';
import { addDays } from '../shared/uk-date.ts';
import type { Player } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAYERS_PATH = join(ROOT, 'server/assets/players.json');
const YEARS = Number(process.argv[2] ?? 3);
const START = process.argv[3] ?? DAILY2_LAUNCH_DATE;
const BANDED_ATTEMPTS = 200;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Row {
    days: number;
    attempts: number;
    maxAttempts: number;
    unbanded: number;
    totalMs: number;
    maxMs: number;
    minPerfect: number;
}

async function main(): Promise<void> {
    const players = JSON.parse(await readFile(PLAYERS_PATH, 'utf8')) as Player[];
    const pools = groupPools(players);
    const days = Math.round(YEARS * 365.25);
    const rows = new Map<number, Row>();
    const failures: string[] = [];
    const started = performance.now();

    for (let day = 0; day < days; day += 1) {
        const date = addDays(START, day);
        const t0 = performance.now();

        try {
            const puzzle = generateDailyPuzzle(date, pools, getFormation(dailyFormationFor(date))!);
            const ms = performance.now() - t0;
            const row = rows.get(puzzle.weekday) ?? { days: 0, attempts: 0, maxAttempts: 0, unbanded: 0, totalMs: 0, maxMs: 0, minPerfect: Infinity };

            row.days += 1;
            row.attempts += puzzle.meta.attempts;
            row.maxAttempts = Math.max(row.maxAttempts, puzzle.meta.attempts);
            row.unbanded += puzzle.meta.attempts > BANDED_ATTEMPTS ? 1 : 0;
            row.totalMs += ms;
            row.maxMs = Math.max(row.maxMs, ms);
            row.minPerfect = Math.min(row.minPerfect, puzzle.meta.perfectXIs);
            rows.set(puzzle.weekday, row);
        } catch (error) {
            failures.push(`${date}: ${(error as Error).message}`);
        }
    }

    console.log(`\n=== Daily 2.0 generator sweep: ${days} days from ${START} (${((performance.now() - started) / 1000).toFixed(1)} s) ===\n`);
    console.log('Day | Days | Attempts avg / max | Past the band | Gen ms avg / max | Min perfect XIs');
    console.log('----|------|--------------------|---------------|------------------|----------------');

    for (const [weekday, row] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
        console.log(
            `${WEEKDAYS[weekday]} | ${String(row.days).padStart(4)} | ${`${(row.attempts / row.days).toFixed(1)} / ${row.maxAttempts}`.padStart(18)} | `
            + `${String(row.unbanded).padStart(13)} | ${`${(row.totalMs / row.days).toFixed(0)} / ${row.maxMs.toFixed(0)}`.padStart(16)} | ${row.minPerfect}`,
        );
    }

    if (failures.length > 0) {
        console.error(`\n${failures.length} date(s) failed to generate:\n${failures.join('\n')}`);
        process.exit(1);
    }

    console.log('\nEvery date generated.');
}

await main();
