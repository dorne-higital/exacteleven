// Builds server/assets/players.json from public Premier League data sources.
//
// Two sources, stitched together:
//   - 2016/17-onward: the public vaastav/Fantasy-Premier-League GitHub repo
//     (MIT code license, data attributed to fantasy.premierleague.com /
//     understat.com) — exact per-gameweek totals for every player who
//     featured.
//   - 2012/13-2015/16: dcaribou/transfermarkt-datasets (CC0-1.0, a snapshot
//     of transfermarkt.co.uk), filtered to Premier League (competition_id
//     'GB1') games. Exact per-appearance goals/assists, same as the FPL
//     source — NOT the earlier "top-100-per-season leaderboard" Kaggle
//     dataset once considered for this (see git history), which would have
//     silently undercounted fringe players. This is capped at 2012/13
//     because that's as far back as this dataset's Premier League coverage
//     goes — reaching all the way to 1992/93 with trustworthy per-player
//     numbers isn't achievable from any free or paid source found so far
//     (Kaggle's older per-season data is leaderboard-only; FBref/
//     Sports-Reference has it but its Terms of Use explicitly forbid using
//     their data to build a "database... that constitutes a material
//     substitute" for their own — exactly what this is).
//
// A player whose career spans both sources (e.g. Agüero, active well before
// 2016 and still tracked by the FPL source after) is matched by name and
// merged into one entry — see mergeTransfermarktHistory() below. Run with
// --fresh to wipe both sources' download caches and pull everything again
// (e.g. once a new season's data is available upstream); without it, an
// existing cache under data/raw/ is reused as-is.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import type { Player, PositionGroup } from '../shared/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE_DIR = join(ROOT, 'data/raw/fpl-github');
const TRANSFERMARKT_CACHE_DIR = join(ROOT, 'data/raw/transfermarkt');
const OUTPUT_PATH = join(ROOT, 'server/assets/players.json');
const RAW_BASE = 'https://raw.githubusercontent.com/vaastav/Fantasy-Premier-League/master/data';
const API_BASE = 'https://api.github.com/repos/vaastav/Fantasy-Premier-League/contents/data';
const TRANSFERMARKT_BASE = 'https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data';
const PREMIER_LEAGUE_COMPETITION_ID = 'GB1';
// Exclusive upper bound — the FPL source owns 2016/17 onward, so only
// seasons strictly before this are taken from transfermarkt to avoid
// double-counting a season both sources happen to cover.
const TRANSFERMARKT_SEASON_CUTOFF = 2016;
// How many seasons of gap between a transfermarkt spell ending and an FPL
// spell starting still counts as "the same career, just missed a season's
// minutes threshold" rather than "coincidentally similar name". 1 tolerates
// e.g. an injury-hit season with under 25 appearances in between.
const MAX_MERGE_GAP_SEASONS = 1;
const MIN_APPEARANCES = 25;
const ELEMENT_TYPE_TO_POSITION: Record<string, PositionGroup> = {
    1: 'GK',
    2: 'DEF',
    3: 'MID',
    4: 'FWD',
};
const TRANSFERMARKT_POSITION: Record<string, PositionGroup> = {
    Goalkeeper: 'GK',
    Defender: 'DEF',
    Midfield: 'MID',
    Attack: 'FWD',
};
const VALID_POSITIONS = new Set<PositionGroup>(['GK', 'DEF', 'MID', 'FWD']);
const SPOT_CHECK_SURNAMES = ['Kane', 'Salah', 'De Bruyne', 'Saka', 'Haaland', 'Son', 'Agüero', 'Suárez'];

interface PlayerRawRow {
    id: string;
    code: string;
    firstName: string;
    secondName: string;
    webName: string;
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
    transfermarkt: {
        gamesInScope: number;
        playersInScope: number;
        mergedIntoExisting: number;
        addedAsNew: number;
        ambiguousMatches: string[];
    };
}

async function readCache(relativePath: string, baseDir: string = CACHE_DIR): Promise<string | null> {
    try {
        return await readFile(join(baseDir, relativePath), 'utf8');
    } catch {
        return null;
    }
}

async function writeCache(relativePath: string, contents: string, baseDir: string = CACHE_DIR): Promise<void> {
    const fullPath = join(baseDir, relativePath);

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

// Same idea as fetchCsv, but for transfermarkt-datasets' gzip-compressed
// exports — decompresses once and caches the plain CSV text, so a repeat
// run never re-downloads or re-inflates it.
async function fetchGzipCsv(relativePath: string, url: string): Promise<string> {
    const cached = await readCache(relativePath, TRANSFERMARKT_CACHE_DIR);

    if (cached !== null) {
        return cached;
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    const compressed = Buffer.from(await response.arrayBuffer());
    const text = gunzipSync(compressed).toString('utf8');

    await writeCache(relativePath, text, TRANSFERMARKT_CACHE_DIR);

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
            webName: record.web_name,
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

function normalizeNameWords(name: string): string[] {
    return name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean);
}

// True when `shortName`'s words are exactly the trailing words of
// `fullName`'s words — e.g. FPL's short "van Dijk" against transfermarkt's
// full "Virgil van Dijk", or "Agüero" against "Sergio Agüero". This is the
// shape every FPL web_name takes relative to a full legal name, whether
// it's a bare surname, an "article + surname" pair, or (for a common
// surname needing disambiguation) "first + surname".
function isTrailingNameMatch(shortName: string, fullName: string): boolean {
    const shortWords = normalizeNameWords(shortName);
    const fullWords = normalizeNameWords(fullName);

    if (shortWords.length === 0 || shortWords.length > fullWords.length) {
        return false;
    }

    const tail = fullWords.slice(fullWords.length - shortWords.length);

    return tail.join(' ') === shortWords.join(' ');
}

function dominantPosition(aggregate: Aggregate): PositionGroup | null {
    let position: PositionGroup | null = null;
    let bestCount = -1;

    for (const [candidate, count] of aggregate.positionCounts) {
        if (count > bestCount) {
            position = candidate;
            bestCount = count;
        }
    }

    return position;
}

// Same "city/town/united/utd" stripping the duplicate-club-name detector in
// printQualityReport() already does, reused here to tell whether a
// transfermarkt-era club and an FPL-era club are the same club under a
// different spelling (e.g. "Arsenal" vs "Arsenal FC").
function normalizeClubName(name: string): string {
    return name.toLowerCase().replace(/\s+(city|town|united|utd|fc)$/, '').trim();
}

function shareAnyClub(a: readonly string[], b: readonly string[]): boolean {
    const normalizedA = new Set(a.map(normalizeClubName));

    return b.some((club) => normalizedA.has(normalizeClubName(club)));
}

// Extends the FPL-built `aggregates` map back to 2012/13 using
// transfermarkt-datasets (CC0-1.0), filtered to Premier League games before
// the FPL source's own 2016/17 start. A player active in both eras (e.g.
// Agüero) is matched by name — see isTrailingNameMatch() — and merged into
// their existing entry rather than appearing twice; a player whose PL
// career ended before 2016/17 is added as a new entry in its own right.
//
// Matching is deliberately conservative: surname match AND at most
// MAX_MERGE_GAP_SEASONS seasons between the transfermarkt spell ending and
// the FPL spell starting AND (when both are known) the same resolved
// position. A false *negative* here just splits one player's history into
// two entries — annoying but harmless. A false *positive* would silently
// attribute one real player's stats to another, which is the failure mode
// actually worth avoiding.
async function mergeTransfermarktHistory(aggregates: Map<string, Aggregate>, report: QualityReport): Promise<void> {
    const gamesText = await fetchGzipCsv('games.csv', `${TRANSFERMARKT_BASE}/games.csv.gz`);
    const gameSeasonById = new Map<string, number>();

    for (const record of toRecords(parseCsv(gamesText))) {
        if (record.competition_id !== PREMIER_LEAGUE_COMPETITION_ID) {
            continue;
        }

        const season = Number(record.season);

        if (!Number.isFinite(season) || season >= TRANSFERMARKT_SEASON_CUTOFF) {
            continue;
        }

        gameSeasonById.set(record.game_id, season);
    }

    report.transfermarkt.gamesInScope = gameSeasonById.size;

    const clubsText = await fetchGzipCsv('clubs.csv', `${TRANSFERMARKT_BASE}/clubs.csv.gz`);
    const clubNameById = new Map<string, string>();

    for (const record of toRecords(parseCsv(clubsText))) {
        clubNameById.set(record.club_id, record.name);
    }

    const playersText = await fetchGzipCsv('players.csv', `${TRANSFERMARKT_BASE}/players.csv.gz`);
    const playerInfoById = new Map<string, { name: string; position: PositionGroup | null }>();

    for (const record of toRecords(parseCsv(playersText))) {
        playerInfoById.set(record.player_id, {
            name: record.name,
            position: TRANSFERMARKT_POSITION[record.position] ?? null,
        });
    }

    const appearancesText = await fetchGzipCsv('appearances.csv', `${TRANSFERMARKT_BASE}/appearances.csv.gz`);
    const tmAggregates = new Map<string, Aggregate>();

    for (const record of toRecords(parseCsv(appearancesText))) {
        const season = gameSeasonById.get(record.game_id);

        if (season === undefined) {
            continue;
        }

        const info = playerInfoById.get(record.player_id);

        if (!info) {
            report.sanityFailures.push(`transfermarkt player_id ${record.player_id}: no matching row in players.csv`);
            continue;
        }

        const goals = Number(record.goals) || 0;
        const assists = Number(record.assists) || 0;

        if (goals < 0 || assists < 0) {
            report.sanityFailures.push(`${info.name} (transfermarkt game ${record.game_id}): negative stat in source row`);
            continue;
        }

        let aggregate = tmAggregates.get(record.player_id);

        if (!aggregate) {
            aggregate = {
                code: record.player_id,
                name: info.name,
                goals: 0,
                assists: 0,
                appearances: 0,
                clubs: [],
                clubSet: new Set(),
                positionCounts: new Map(),
                firstSeason: season,
                lastSeason: season,
                unresolvedTeamRows: 0,
            };
            tmAggregates.set(record.player_id, aggregate);
        }

        aggregate.goals += goals;
        aggregate.assists += assists;
        aggregate.appearances += 1;
        aggregate.firstSeason = Math.min(aggregate.firstSeason, season);
        aggregate.lastSeason = Math.max(aggregate.lastSeason, season);

        if (info.position) {
            aggregate.positionCounts.set(info.position, (aggregate.positionCounts.get(info.position) ?? 0) + 1);
        }

        const club = clubNameById.get(record.player_club_id);

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

    report.transfermarkt.playersInScope = tmAggregates.size;

    // Snapshotted once, before this function starts adding transfermarkt-only
    // entries into `aggregates` — candidates are only ever looked up in the
    // FPL-built set, so two transfermarkt players can never accidentally
    // match each other (they'd trivially satisfy the season-gap check
    // against each other otherwise, since both sit before the 2016 cutoff).
    const fplAggregates = Array.from(aggregates.values());

    for (const tm of tmAggregates.values()) {
        if (tm.appearances < MIN_APPEARANCES) {
            continue;
        }

        // Name + career-adjacency alone, no position filter yet — a wide
        // attacker (Son, classified MID by the FPL source's own element_type
        // but Attack by transfermarkt) would otherwise wrongly fail to merge
        // against its own unambiguous match. Position is only used below to
        // break a genuine multi-candidate tie, never to exclude the sole
        // candidate a name+time match already found.
        const candidates = fplAggregates.filter((existing) => {
            if (!isTrailingNameMatch(existing.name, tm.name)) {
                return false;
            }

            const seasonGap = existing.firstSeason - tm.lastSeason;

            return seasonGap >= 1 && seasonGap <= MAX_MERGE_GAP_SEASONS + 1;
        });

        // Two different real players sharing one surname (there is more
        // than one "Sánchez" or "Taylor" in Premier League history) both
        // satisfying name+time is genuinely ambiguous on those signals
        // alone. Try narrowing by an actual shared club first — far more
        // reliable than position, since a wide attacker especially can be
        // classified MID by one source's scheme and FWD by the other's (as
        // Son and Sánchez both were here) — then fall back to position only
        // if club overlap doesn't get to exactly one.
        if (candidates.length > 1) {
            const byClub = candidates.filter((existing) => shareAnyClub(existing.clubs, tm.clubs));

            if (byClub.length === 1) {
                candidates.length = 0;
                candidates.push(byClub[0]!);
            } else {
                const tmPosition = dominantPosition(tm);
                const byPosition = tmPosition
                    ? candidates.filter((existing) => dominantPosition(existing) === tmPosition)
                    : [];

                if (byPosition.length === 1) {
                    candidates.length = 0;
                    candidates.push(byPosition[0]!);
                }
            }
        }

        if (candidates.length > 1) {
            report.transfermarkt.ambiguousMatches.push(
                `${tm.name} (transfermarkt, ${tm.firstSeason}-${tm.lastSeason}) matched ${candidates.length} `
                + 'existing entries — skipped merging, added as its own entry instead',
            );
        } else if (candidates.length === 1) {
            const existing = candidates[0]!;

            existing.goals += tm.goals;
            existing.assists += tm.assists;
            existing.appearances += tm.appearances;
            existing.firstSeason = Math.min(existing.firstSeason, tm.firstSeason);

            for (const club of tm.clubs) {
                if (!existing.clubSet.has(club)) {
                    existing.clubSet.add(club);
                    existing.clubs.unshift(club);
                }
            }

            for (const [position, count] of tm.positionCounts) {
                existing.positionCounts.set(position, (existing.positionCounts.get(position) ?? 0) + count);
            }

            report.transfermarkt.mergedIntoExisting += 1;
        } else {
            aggregates.set(`tm-${tm.code}`, tm);
            report.transfermarkt.addedAsNew += 1;
        }
    }
}

async function main(): Promise<void> {
    if (process.argv.includes('--fresh')) {
        await rm(CACHE_DIR, { recursive: true, force: true });
        await rm(TRANSFERMARKT_CACHE_DIR, { recursive: true, force: true });
    }

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
        transfermarkt: {
            gamesInScope: 0,
            playersInScope: 0,
            mergedIntoExisting: 0,
            addedAsNew: 0,
            ambiguousMatches: [],
        },
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

            // FPL's own web_name is the popularly-known football identity
            // (e.g. "Raya", "Fernandinho") — the concatenated legal name
            // (e.g. "David Raya Martin", "Fernando Luiz Rosa") is what
            // players are registered under, not what anyone recognizes them
            // by. Falls back to the legal name only on the rare row missing
            // web_name entirely.
            const name = ref.webName.trim() || `${ref.firstName} ${ref.secondName}`.trim();
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

    await mergeTransfermarktHistory(aggregates, report);

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
    console.log('(2016/17+ from FPL/vaastav, 2012/13-2015/16 merged in from transfermarkt-datasets)\n');

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

    const tm = report.transfermarkt;

    console.log(`\ntransfermarkt-datasets (2012/13-${TRANSFERMARKT_SEASON_CUTOFF - 1}/${String(TRANSFERMARKT_SEASON_CUTOFF).slice(2)} historical spine):`);
    console.log(`  Premier League games in scope: ${tm.gamesInScope}`);
    console.log(`  Distinct players in scope (before ${MIN_APPEARANCES}+ appearance filter): ${tm.playersInScope}`);
    console.log(`  Merged into an existing (2016/17+) entry: ${tm.mergedIntoExisting}`);
    console.log(`  Added as a new, transfermarkt-only entry: ${tm.addedAsNew}`);
    console.log(`  Ambiguous matches (skipped merging, added as new instead): ${tm.ambiguousMatches.length}`);
    for (const line of tm.ambiguousMatches) {
        console.log(`    - ${line}`);
    }
}

await main();
