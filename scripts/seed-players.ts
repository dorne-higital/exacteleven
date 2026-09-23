// Builds server/assets/players.json from public Premier League data sources.
//
// Current state: only the 2016/17-onward era is wired up, sourced from the
// public vaastav/Fantasy-Premier-League GitHub repo (MIT code license, data
// attributed to fantasy.premierleague.com / understat.com). The 1992/93-
// 2015/16 historical spine and the pre-2016/17 position enrichment pass are
// NOT implemented yet — see loadKaggleHistoricalSpine() and
// loadKagglePositionEnrichment() below. Until those land, the JSON this
// script writes is a PARTIAL interim dataset (2016/17+ only), not the
// finished v1 pool.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Player, PositionGroup } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'data/raw/fpl-github');
const OUTPUT_PATH = join(ROOT, 'server/assets/players.json');
const RAW_BASE = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';
const API_BASE = 'https://api.github.com/repos/vaastav/Fantasy-Premier-League/contents/data';
const MIN_APPEARANCES = 25;
const ELEMENT_TYPE_TO_POSITION: Record<string, PositionGroup> = {
    1: 'GK',
    2: 'DEF',
    3: 'MID',
    4: 'FWD',
};
const VALID_POSITIONS = new Set<PositionGroup>(['GK', 'DEF', 'MID', 'FWD']);
const SPOT_CHECK_SURNAMES = ['Kane', 'Salah', 'De Bruyne', 'Saka', 'Haaland', 'Son'];

interface PlayerRawRow {
    id: string;
    code: string;
    firstName: string;
    secondName: string;
    elementType: string;
    team: string;
}

interface Aggregate {
    code: string;
    name: string;
    goals: number;
    assists: number;
    appearances: number;
    clubs: string[];
    clubSet: Set<string>;
    positionCounts: Map<PositionGroup, number>;
    firstSeason: number;
    lastSeason: number;
    unresolvedTeamRows: number;
}

interface QualityReport {
    seasons: Array<{ season: string; gwRows: number; playersRawRows: number }>;
    unresolvedElementRows: number;
    totalPlayersBeforeFilter: number;
    totalPlayersAfterFilter: number;
    positionCounts: Record<PositionGroup, number>;
    clubNames: Set<string>;
    sanityFailures: string[];
}

async function readCache(relativePath: string): Promise<string | null> {
    try {
        return await readFile(join(CACHE_DIR, relativePath), 'utf8');
    } catch {
        return null;
    }
}

async function writeCache(relativePath: string, contents: string): Promise<void> {
    const fullPath = join(CACHE_DIR, relativePath);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, contents, 'utf8');
}

async function fetchCsv(relativePath: string, url: string): Promise<string> {
    const cached = await readCache(relativePath);

    if (cached !== null) {
        return cached;
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    await writeCache(relativePath, text);

    return text;
}

// Minimal RFC4180-style CSV parser: handles quoted fields, embedded commas,
// doubled-quote escapes and embedded newlines inside quoted values.
function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i += 1;
                continue;
            }
            field += char;
            i += 1;
            continue;
        }

        if (char === '"') {
            inQuotes = true;
            i += 1;
            continue;
        }

        if (char === ',') {
            row.push(field);
            field = '';
            i += 1;
            continue;
        }

        if (char === '\r') {
            i += 1;
            continue;
        }

        if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i += 1;
            continue;
        }

        field += char;
        i += 1;
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((cells) => cells.length > 1 || cells[0] !== '');
}

function toRecords(rows: string[][]): Record<string, string>[] {
    const [header, ...body] = rows;

    return body.map((cells) => {
        const record: Record<string, string> = {};

        header.forEach((key, index) => {
            record[key] = cells[index] ?? '';
        });

        return record;
    });
}

async function discoverSeasons(): Promise<string[]> {
    const cachePath = 'season-list.json';
    const cached = await readCache(cachePath);

    if (cached !== null) {
        return JSON.parse(cached) as string[];
    }

    const response = await fetch(API_BASE);

    if (!response.ok) {
        throw new Error(`Failed to list seasons: ${response.status} ${response.statusText}`);
    }

    const entries = (await response.json()) as Array<{ name: string; type: string }>;
    const seasons = entries
        .filter((entry) => entry.type === 'dir' && /^\d{4}-\d{2}$/.test(entry.name))
        .map((entry) => entry.name)
        .sort();

    await writeCache(cachePath, JSON.stringify(seasons));

    return seasons;
}

async function loadMasterTeamList(): Promise<Map<string, Map<string, string>>> {
    const text = await fetchCsv('master_team_list.csv', `${RAW_BASE}/master_team_list.csv`);
    const records = toRecords(parseCsv(text));
    const bySeasonAndTeam = new Map<string, Map<string, string>>();

    for (const record of records) {
        if (!bySeasonAndTeam.has(record.season)) {
            bySeasonAndTeam.set(record.season, new Map());
        }
        bySeasonAndTeam.get(record.season)!.set(record.team, record.team_name);
    }

    return bySeasonAndTeam;
}

async function loadSeasonPlayersRaw(season: string): Promise<{ byLocalId: Map<string, PlayerRawRow>; rowCount: number }> {
    const text = await fetchCsv(`${season}/players_raw.csv`, `${RAW_BASE}/${season}/players_raw.csv`);
    const records = toRecords(parseCsv(text));
    const byLocalId = new Map<string, PlayerRawRow>();

    for (const record of records) {
        byLocalId.set(record.id, {
            id: record.id,
            code: record.code,
            firstName: record.first_name,
            secondName: record.second_name,
            elementType: record.element_type,
            team: record.team,
        });
    }

    return { byLocalId, rowCount: records.length };
}

function resolvePosition(row: Record<string, string>, ref: PlayerRawRow | undefined): PositionGroup | null {
    const direct = row.position as PositionGroup | undefined;

    if (direct && VALID_POSITIONS.has(direct)) {
        return direct;
    }

    if (ref) {
        return ELEMENT_TYPE_TO_POSITION[ref.elementType] ?? null;
    }

    return null;
}

// Some seasons' source files abbreviate a club name inconsistently with
// others (confirmed via the quality report's duplicate-name detector).
// Canonicalize known cases so a player's clubs[] doesn't show the same
// club twice under different spellings.
const CLUB_ALIASES: Record<string, string> = {
    Hull: 'Hull City',
    Ipswich: 'Ipswich Town',
};

function resolveClub(
    row: Record<string, string>,
    ref: PlayerRawRow | undefined,
    season: string,
    masterTeamList: Map<string, Map<string, string>>,
): string | null {
    const direct = row.team;
    const resolved = direct && Number.isNaN(Number(direct))
        ? direct
        : ref
            ? masterTeamList.get(season)?.get(ref.team) ?? null
            : null;

    return resolved ? CLUB_ALIASES[resolved] ?? resolved : null;
}

function slugify(name: string): string {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function main(): Promise<void> {
    const seasons = await discoverSeasons();
    const masterTeamList = await loadMasterTeamList();
    const aggregates = new Map<string, Aggregate>();
    const report: QualityReport = {
        seasons: [],
        unresolvedElementRows: 0,
        totalPlayersBeforeFilter: 0,
        totalPlayersAfterFilter: 0,
        positionCounts: { GK: 0, DEF: 0, MID: 0, FWD: 0 },
        clubNames: new Set(),
        sanityFailures: [],
    };

    for (const season of seasons) {
        const seasonStartYear = Number(season.split('-')[0]);
        const { byLocalId, rowCount: playersRawRows } = await loadSeasonPlayersRaw(season);
        const gwText = await fetchCsv(`${season}/gws/merged_gw.csv`, `${RAW_BASE}/${season}/gws/merged_gw.csv`);
        const gwRows = toRecords(parseCsv(gwText));
        const hasStarts = gwRows.length > 0 && 'starts' in gwRows[0];

        report.seasons.push({ season, gwRows: gwRows.length, playersRawRows });

        // Rows are appended gameweek-by-gameweek in the source file, but
        // sort defensively so club-transfer ordering is always correct.
        gwRows.sort((a, b) => Number(a.GW) - Number(b.GW));

        for (const row of gwRows) {
            const ref = byLocalId.get(row.element);

            if (!ref) {
                report.unresolvedElementRows += 1;
                continue;
            }

            const name = `${ref.firstName} ${ref.secondName}`.trim();
            const position = resolvePosition(row, ref);
            const club = resolveClub(row, ref, season, masterTeamList);
            const minutes = Number(row.minutes) || 0;
            const goals = Number(row.goals_scored) || 0;
            const assists = Number(row.assists) || 0;
            const played = hasStarts ? Number(row.starts) === 1 : minutes > 0;

            if (goals < 0 || assists < 0 || minutes < 0) {
                report.sanityFailures.push(`${name} (${season}, GW${row.GW}): negative stat in source row`);
                continue;
            }

            let aggregate = aggregates.get(ref.code);

            if (!aggregate) {
                aggregate = {
                    code: ref.code,
                    name,
                    goals: 0,
                    assists: 0,
                    appearances: 0,
                    clubs: [],
                    clubSet: new Set(),
                    positionCounts: new Map(),
                    firstSeason: seasonStartYear,
                    lastSeason: seasonStartYear,
                    unresolvedTeamRows: 0,
                };
                aggregates.set(ref.code, aggregate);
            }

            aggregate.goals += goals;
            aggregate.assists += assists;
            aggregate.appearances += played ? 1 : 0;
            aggregate.firstSeason = Math.min(aggregate.firstSeason, seasonStartYear);
            aggregate.lastSeason = Math.max(aggregate.lastSeason, seasonStartYear);

            if (position) {
                aggregate.positionCounts.set(position, (aggregate.positionCounts.get(position) ?? 0) + 1);
            }

            if (club) {
                report.clubNames.add(club);
                if (!aggregate.clubSet.has(club)) {
                    aggregate.clubSet.add(club);
                    aggregate.clubs.push(club);
                }
            } else {
                aggregate.unresolvedTeamRows += 1;
            }
        }
    }

    report.totalPlayersBeforeFilter = aggregates.size;

    const usedIds = new Set<string>();
    const players: Player[] = [];
    const spotCheck: Player[] = [];

    for (const aggregate of Array.from(aggregates.values()).sort((a, b) => Number(a.code) - Number(b.code))) {
        if (aggregate.appearances < MIN_APPEARANCES) {
            continue;
        }

        let position: PositionGroup = 'MID';
        let bestCount = -1;

        for (const [candidate, count] of aggregate.positionCounts) {
            if (count > bestCount) {
                position = candidate;
                bestCount = count;
            }
        }

        if (bestCount === -1) {
            report.sanityFailures.push(`${aggregate.name}: no position could be resolved in any season`);
        }

        if (aggregate.clubs.length === 0) {
            report.sanityFailures.push(`${aggregate.name}: no club could be resolved in any season`);
        }

        let id = slugify(aggregate.name) || `player-${aggregate.code}`;

        while (usedIds.has(id)) {
            id = `${id}-2`;
        }
        usedIds.add(id);

        const player: Player = {
            id,
            name: aggregate.name,
            position,
            goals: aggregate.goals,
            assists: aggregate.assists,
            appearances: aggregate.appearances,
            clubs: aggregate.clubs,
            firstSeason: aggregate.firstSeason,
            lastSeason: aggregate.lastSeason,
        };

        players.push(player);
        report.positionCounts[position] += 1;

        if (SPOT_CHECK_SURNAMES.some((surname) => aggregate.name.includes(surname))) {
            spotCheck.push(player);
        }
    }

    report.totalPlayersAfterFilter = players.length;

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, JSON.stringify(players), 'utf8');

    printQualityReport(report, spotCheck);
}

function printQualityReport(report: QualityReport, spotCheck: Player[]): void {
    console.log('\n=== Exact XI — seed-players.ts data quality report ===');
    console.log('(INTERIM dataset: 2016/17+ only — Kaggle historical spine not yet merged)\n');

    console.log('Per-season rows fetched:');
    for (const season of report.seasons) {
        console.log(`  ${season.season}: ${season.gwRows} gameweek rows, ${season.playersRawRows} players_raw rows`);
    }

    console.log(`\nUnresolved element rows (no players_raw match, skipped): ${report.unresolvedElementRows}`);
    console.log(`Unique players before ${MIN_APPEARANCES}+ appearance filter: ${report.totalPlayersBeforeFilter}`);
    console.log(`Unique players after ${MIN_APPEARANCES}+ appearance filter: ${report.totalPlayersAfterFilter}`);

    console.log('\nPosition breakdown (post-filter):');
    for (const [position, count] of Object.entries(report.positionCounts)) {
        console.log(`  ${position}: ${count}`);
    }

    console.log(`\nDistinct club names resolved: ${report.clubNames.size}`);
    console.log([...report.clubNames].sort().join(', '));

    const clubGroups = new Map<string, string[]>();

    for (const club of report.clubNames) {
        const stripped = club.toLowerCase().replace(/\s+(city|town|united|utd)$/, '').trim();
        // Guard against short, generic bases (e.g. "Man City"/"Man Utd" both
        // reducing to "man") producing false-positive duplicate groupings.
        const key = stripped.length >= 4 ? stripped : club.toLowerCase();

        if (!clubGroups.has(key)) {
            clubGroups.set(key, []);
        }
        clubGroups.get(key)!.push(club);
    }

    const suspectedDuplicates = [...clubGroups.values()].filter((names) => names.length > 1);

    console.log(`\nPossible duplicate club names (same club, inconsistent naming across seasons): ${suspectedDuplicates.length}`);
    for (const names of suspectedDuplicates) {
        console.log(`  - ${names.join(' / ')}`);
    }

    console.log(`\nSanity-check failures: ${report.sanityFailures.length}`);
    for (const failure of report.sanityFailures.slice(0, 25)) {
        console.log(`  - ${failure}`);
    }
    if (report.sanityFailures.length > 25) {
        console.log(`  ...and ${report.sanityFailures.length - 25} more`);
    }

    console.log('\nSpot-check (well-known players, eyeball against real career totals):');
    for (const player of spotCheck) {
        console.log(
            `  ${player.name} — ${player.position}, ${player.goals}G ${player.assists}A, `
            + `${player.appearances} apps, ${player.firstSeason}-${player.lastSeason}, clubs: ${player.clubs.join(' → ')}`,
        );
    }
}

// --- Not yet implemented: historical spine + legacy position enrichment ---
//
// These will source the pre-2016/17 era once Dan has downloaded and the
// actual CSV column layout inside each Kaggle export has been verified by
// hand — do not guess their structure. When implemented, both should return
// Player[]-shaped partial records that get merged into `aggregates` above
// (matched by normalized-name, since neither Kaggle source carries the FPL
// `code` identity used for the 2016/17+ era) before the appearance filter
// and id-assignment pass run.

async function loadKaggleHistoricalSpine(): Promise<Player[]> {
    console.log(
        '\n[seed-players] loadKaggleHistoricalSpine(): not implemented yet — inspect the downloaded CSVs in '
        + 'data/raw/kaggle-pl-stats/ first (expected: David Antonio Teixeira\'s CC0 "Premier League Player '
        + 'Statistics (1992/93-22/23)" dataset), confirm the real column layout, then implement this. Skipping.',
    );

    return [];
}

async function loadKagglePositionEnrichment(): Promise<Map<string, PositionGroup>> {
    console.log(
        '\n[seed-players] loadKagglePositionEnrichment(): not implemented yet — inspect the downloaded CSVs in '
        + 'data/raw/kaggle-teams-players/ first (expected: Samoilov Mikhail\'s Apache-2.0 "All Premier League team '
        + 'and players (1992-2024)" dataset), confirm the real column layout, then implement this. Skipping.',
    );

    return new Map();
}

// Referenced only to document the intended extension point until Phase 1's
// historical merge is implemented — keeps eslint's no-unused-vars quiet
// without pretending these are wired into the pipeline yet.
void loadKaggleHistoricalSpine;
void loadKagglePositionEnrichment;

await main();
