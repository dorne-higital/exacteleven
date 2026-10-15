import type { DailyStat } from '../../shared/daily2-types';
import type { FormationCode, GameStatus, ObjectiveKind, ResultTier } from '../../shared/types';
import type { AchievementDef } from '../utils/achievements';
import type { BestResult, DailyResultEntry, DailyScoreEntry, GameStats } from '../utils/stats-types';
import type { Outcome } from '../utils/scoring';
import { dayIndexForDate } from '#shared/daily';
import { backfillSeenAchievements, diffNewlyUnlocked, readSeenAchievementIds, writeSeenAchievementIds } from '../utils/achievement-notifications';
import { formations } from '../utils/formations';
import { isBetterOutcome } from '../utils/scoring';

const STATS_STORAGE_KEY = 'exact-xi-stats';

const COUNT_KEYS = [
    'gamesPlayed', 'wins', 'titleWinners', 'championsLeague', 'europaLeague', 'midTable', 'avoidedRelegation', 'relegated', 'busts',
    'dailyStreak', 'bestDailyStreak', 'dailyWinStreak', 'bestDailyWinStreak', 'bestDailyScore', 'dailyWins', 'dailyPlays',
    'unassistedWins', 'currentExactRun', 'bestExactRun', 'statsVersion',
] as const;

// Bumped to 2 by the played-streak migration (DAILY2_SPEC §1.9).
export const STATS_VERSION = 2;

const DAILY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const VALID_OUTCOMES: Outcome[] = ['champion', 'titleWinners', 'championsLeague', 'europaLeague', 'midTable', 'avoidedRelegation', 'relegated'];

const VALID_DAILY_STATUSES = ['won', 'bust', 'lost'] as const;

// Matches DailyStreakStrip.vue's RESULT_CHIP_LIMIT — nothing currently reads
// further back than the last 10, so the log is capped at exactly that rather
// than storing history nothing displays.
const DAILY_RESULTS_LOG_LIMIT = 10;

// Two weeks of Daily 2.0 scores — enough for this week's and last week's
// recap offline, and the Stats dialog's recent scores.
const DAILY_SCORES_LOG_LIMIT = 14;

const VALID_OBJECTIVE_KINDS: readonly ObjectiveKind[] = ['exact', 'over', 'under', 'allUnder'];
const VALID_DAILY_STATS: readonly DailyStat[] = ['ga', 'goals', 'assists'];

function isDailyScore(value: unknown): value is number {
    return isNonNegativeInt(value) && value <= 1000;
}

function sanitizeDailyResult(entry: unknown): DailyResultEntry | null {
    if (typeof entry !== 'object' || entry === null) {
        return null;
    }

    const raw = entry as Record<string, unknown>;

    if (typeof raw.date !== 'string' || !DAILY_DATE_PATTERN.test(raw.date)
        || !VALID_DAILY_STATUSES.includes(raw.status as typeof VALID_DAILY_STATUSES[number])) {
        return null;
    }

    const clean: DailyResultEntry = { date: raw.date, status: raw.status as DailyResultEntry['status'] };

    if (isDailyScore(raw.score)) {
        clean.score = raw.score;
    }

    return clean;
}

function sanitizeDailyScore(entry: unknown): DailyScoreEntry | null {
    if (typeof entry !== 'object' || entry === null) {
        return null;
    }

    const raw = entry as Record<string, unknown>;
    const beatPct = raw.beatPct;

    if (typeof raw.date !== 'string' || !DAILY_DATE_PATTERN.test(raw.date)
        || !isDailyScore(raw.score)
        || !VALID_DAILY_STATUSES.includes(raw.status as typeof VALID_DAILY_STATUSES[number])
        || !VALID_OBJECTIVE_KINDS.includes(raw.kind as ObjectiveKind)
        || !VALID_DAILY_STATS.includes(raw.stat as DailyStat)
        || !(beatPct === null || (isNonNegativeInt(beatPct) && beatPct <= 100))
        || !isNonNegativeInt(raw.players)) {
        return null;
    }

    return {
        date: raw.date,
        score: raw.score,
        status: raw.status as DailyScoreEntry['status'],
        kind: raw.kind as ObjectiveKind,
        stat: raw.stat as DailyStat,
        beatPct: beatPct as number | null,
        players: raw.players,
    };
}

function isNonNegativeInt(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// localStorage is user-editable (devtools, other extensions, a stale shape
// from a previous version of this app) — this is a system boundary, so each
// field is checked rather than trusting the parsed JSON's shape. Invalid
// individual fields fall back to their empty-state default rather than
// discarding the whole record, so one corrupt field doesn't wipe stats that
// are otherwise fine.
function sanitizeStats(parsed: unknown): Partial<GameStats> {
    if (typeof parsed !== 'object' || parsed === null) {
        return {};
    }

    const raw = parsed as Record<string, unknown>;
    const clean: Partial<GameStats> = {};

    for (const key of COUNT_KEYS) {
        if (isNonNegativeInt(raw[key])) {
            clean[key] = raw[key] as number;
        }
    }

    const formationCodes = new Set(formations.map((formation) => formation.code));

    if (typeof raw.formationPlays === 'object' && raw.formationPlays !== null) {
        const rawPlays = raw.formationPlays as Record<string, unknown>;

        clean.formationPlays = Object.fromEntries(
            Object.entries(rawPlays).filter(([code, count]) => formationCodes.has(code as FormationCode) && isNonNegativeInt(count)),
        ) as Record<FormationCode, number>;
    }

    if (typeof raw.formationWins === 'object' && raw.formationWins !== null) {
        const rawWins = raw.formationWins as Record<string, unknown>;

        clean.formationWins = Object.fromEntries(
            Object.entries(rawWins).filter(([code, count]) => formationCodes.has(code as FormationCode) && isNonNegativeInt(count)),
        ) as Record<FormationCode, number>;
    }

    if (
        typeof raw.bestResult === 'object'
        && raw.bestResult !== null
        && VALID_OUTCOMES.includes((raw.bestResult as Record<string, unknown>).outcome as Outcome)
        && formationCodes.has((raw.bestResult as Record<string, unknown>).formationCode as FormationCode)
    ) {
        clean.bestResult = raw.bestResult as BestResult;
    } else if (raw.bestResult === null) {
        clean.bestResult = null;
    }

    if (typeof raw.lastDailyResultDate === 'string' && DAILY_DATE_PATTERN.test(raw.lastDailyResultDate)) {
        clean.lastDailyResultDate = raw.lastDailyResultDate;
    } else if (raw.lastDailyResultDate === null) {
        clean.lastDailyResultDate = null;
    }

    if (Array.isArray(raw.dailyResults)) {
        clean.dailyResults = raw.dailyResults
            .map(sanitizeDailyResult)
            .filter((entry): entry is DailyResultEntry => entry !== null)
            .slice(-DAILY_RESULTS_LOG_LIMIT);
    }

    if (Array.isArray(raw.dailyScores)) {
        clean.dailyScores = raw.dailyScores
            .map(sanitizeDailyScore)
            .filter((entry): entry is DailyScoreEntry => entry !== null)
            .slice(-DAILY_SCORES_LOG_LIMIT);
    }

    return clean;
}

function emptyFormationRecord(): Record<FormationCode, number> {
    return Object.fromEntries(formations.map((formation) => [formation.code, 0])) as Record<FormationCode, number>;
}

function emptyStats(): GameStats {
    return {
        gamesPlayed: 0,
        wins: 0,
        titleWinners: 0,
        championsLeague: 0,
        europaLeague: 0,
        midTable: 0,
        avoidedRelegation: 0,
        relegated: 0,
        busts: 0,
        bestResult: null,
        formationPlays: emptyFormationRecord(),
        formationWins: emptyFormationRecord(),
        dailyStreak: 0,
        bestDailyStreak: 0,
        dailyWinStreak: 0,
        bestDailyWinStreak: 0,
        bestDailyScore: 0,
        dailyScores: [],
        statsVersion: STATS_VERSION,
        dailyWins: 0,
        dailyPlays: 0,
        lastDailyResultDate: null,
        dailyResults: [],
        unassistedWins: 0,
        currentExactRun: 0,
        bestExactRun: 0,
    };
}

// How many consecutive calendar days the Daily log shows ending at `last`
// (stepping back one day while that day is present). The log holds at most
// 10 entries, so this tops out at 10 — the old win streak covers longer runs.
function playedRunEndingAt(results: readonly DailyResultEntry[], last: string | null): number {
    if (!last) {
        return 0;
    }

    const days = new Set(results.map((entry) => dayIndexForDate(entry.date)));
    let day = dayIndexForDate(last);
    let run = 0;

    while (days.has(day)) {
        run += 1;
        day -= 1;
    }

    return run;
}

// DAILY2_SPEC §1.9: dailyStreak used to count consecutive WINS; it now
// counts consecutive days PLAYED, with wins moved to dailyWinStreak. A run
// of wins is also a run of days played, so taking the max of the two means
// nobody's streak goes down. Idempotent: it only runs while dailyWinStreak
// has never been saved.
function migratePlayedStreak(parsed: Partial<GameStats>, next: GameStats): void {
    if (parsed.dailyWinStreak !== undefined) {
        return;
    }

    const oldStreak = next.dailyStreak;
    const oldBest = next.bestDailyStreak;
    const played = playedRunEndingAt(next.dailyResults, next.lastDailyResultDate);

    next.dailyWinStreak = oldStreak;
    next.bestDailyWinStreak = Math.max(oldBest, oldStreak);
    next.dailyStreak = Math.max(oldStreak, played);
    next.bestDailyStreak = Math.max(oldBest, next.dailyStreak);
    next.statsVersion = STATS_VERSION;
}

// Fills in the fields added since a player's stats were saved (boost era,
// played-streak era), and keeps them consistent with each other (they're
// user-editable storage). Exported for tests.
export function migrateStats(parsed: Partial<GameStats>, merged: GameStats): GameStats {
    const next = { ...merged };

    migratePlayedStreak(parsed, next);
    next.bestDailyWinStreak = Math.max(next.bestDailyWinStreak, next.dailyWinStreak);
    next.bestDailyStreak = Math.max(next.bestDailyStreak, next.dailyStreak);

    // Every win before boosts existed was unassisted.
    if (parsed.unassistedWins === undefined) {
        next.unassistedWins = next.wins;
    }

    next.unassistedWins = Math.min(next.unassistedWins, next.wins);
    next.currentExactRun = Math.min(next.currentExactRun, next.unassistedWins);
    next.bestExactRun = Math.min(Math.max(next.bestExactRun, next.currentExactRun), next.unassistedWins);

    return next;
}

export interface DailyOutcomeExtra {
    score: number;
    kind: ObjectiveKind;
    stat: DailyStat;
    beatPct: number | null;
    players: number;
}

// The stored streaks only reset on the next record, so once a day has been
// missed they'd still show yesterday's number — these are what to display.
// 0 once the last Daily played is before yesterday (UK date).
function isStreakAlive(stats: Pick<GameStats, 'lastDailyResultDate'>, today: string): boolean {
    if (!stats.lastDailyResultDate || !DAILY_DATE_PATTERN.test(today)) {
        return false;
    }

    return dayIndexForDate(today) - dayIndexForDate(stats.lastDailyResultDate) <= 1;
}

export function currentDailyStreak(stats: Pick<GameStats, 'lastDailyResultDate' | 'dailyStreak'>, today: string): number {
    return isStreakAlive(stats, today) ? stats.dailyStreak : 0;
}

export function currentDailyWinStreak(stats: Pick<GameStats, 'lastDailyResultDate' | 'dailyWinStreak'>, today: string): number {
    return isStreakAlive(stats, today) ? stats.dailyWinStreak : 0;
}

function readStoredStats(): GameStats {
    try {
        const raw = window.localStorage.getItem(STATS_STORAGE_KEY);

        if (!raw) {
            return emptyStats();
        }

        const parsed = sanitizeStats(JSON.parse(raw));

        return migrateStats(parsed, {
            ...emptyStats(),
            ...parsed,
            formationPlays: { ...emptyFormationRecord(), ...parsed.formationPlays },
            formationWins: { ...emptyFormationRecord(), ...parsed.formationWins },
        });
    } catch {
        // Private-mode/blocked storage, or corrupt JSON — start fresh for
        // this session rather than breaking the game.
        return emptyStats();
    }
}

function writeStoredStats(stats: GameStats): void {
    try {
        window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
    } catch {
        // Same as above — stats just won't persist this time.
    }
}

export function useStats() {
    const stats = useState<GameStats>('exact-xi-stats', emptyStats);
    // A small queue, not a single value — in principle one outcome could
    // cross more than one badge's threshold at once (e.g. a formation-win
    // count and a games-won count in the same pick). AchievementToast.vue
    // shows one at a time and shifts this as each is dismissed.
    const newlyUnlocked = useState<AchievementDef[]>('exact-xi-newly-unlocked', () => []);

    // Called once from app.vue's onMounted — localStorage isn't available
    // during SSR, so the default above renders first and this hydrates the
    // real value client-side.
    function loadStats(): void {
        if (import.meta.client) {
            stats.value = readStoredStats();
            // One-time migration for a player who already had stats before
            // achievement notifications existed — silently backfills what
            // they already own so recordOutcome's next call doesn't treat
            // their whole trophy cabinet as brand new.
            backfillSeenAchievements(stats.value);
        }
    }

    // Compares stats before/after a mutation and queues a toast for any
    // achievement that crossed its threshold just now — shared by both
    // recordOutcome and recordDailyOutcome below.
    function queueNewlyUnlocked(before: GameStats, after: GameStats): void {
        if (!import.meta.client) {
            return;
        }

        const seen = readSeenAchievementIds();
        const fresh = diffNewlyUnlocked(before, after, seen);

        if (fresh.length === 0) {
            return;
        }

        fresh.forEach((def) => seen.add(def.id));
        writeSeenAchievementIds(seen);
        newlyUnlocked.value = [...newlyUnlocked.value, ...fresh];
    }

    function dismissUnlocked(): void {
        newlyUnlocked.value = newlyUnlocked.value.slice(1);
    }

    // Every completed game lands in exactly one bucket: won, bust, or one of
    // the 5 tiers — see useGame.ts's statsRecorded guard for the
    // exactly-once call site. `assisted` (app only: a banked boost or Pro
    // extra was used) still counts everywhere except unassistedWins and the
    // exact-win run: an assisted exact win neither extends nor ends the run
    // (owner's call), so boosts can't pad the leaderboard or break a streak.
    function recordOutcome(status: GameStatus, tier: ResultTier | null, formationCode: FormationCode, assisted = false): void {
        const next = {
            ...stats.value,
            gamesPlayed: stats.value.gamesPlayed + 1,
            formationPlays: {
                ...stats.value.formationPlays,
                [formationCode]: stats.value.formationPlays[formationCode] + 1,
            },
        };
        let outcome: Outcome | null = null;

        const unassistedWin = status === 'won' && !assisted;

        const assistedWin = status === 'won' && assisted;

        if (!assistedWin) {
            next.currentExactRun = unassistedWin ? stats.value.currentExactRun + 1 : 0;
        }
        next.bestExactRun = Math.max(stats.value.bestExactRun, next.currentExactRun);

        if (unassistedWin) {
            next.unassistedWins += 1;
        }

        if (status === 'won') {
            next.wins += 1;
            next.formationWins = {
                ...stats.value.formationWins,
                [formationCode]: stats.value.formationWins[formationCode] + 1,
            };
            outcome = 'champion';
        } else if (status === 'bust') {
            next.busts += 1;
        } else if (status === 'finished' && tier) {
            next[tier] += 1;
            outcome = tier;
        }

        if (outcome && isBetterOutcome(outcome, next.bestResult?.outcome ?? null)) {
            next.bestResult = { outcome, formationCode };
        }

        queueNewlyUnlocked(stats.value, next);
        stats.value = next;

        if (import.meta.client) {
            writeStoredStats(next);
        }
    }

    // Daily Challenge outcomes are recorded separately from the classic
    // ladder (recordOutcome above) — a daily "win" isn't a championsLeague
    // finish or a formation win, it's its own streak-based stat.
    // dailyStreak counts days PLAYED (any finished first attempt); the win
    // run is dailyWinStreak. `extra` is the Daily 2.0 score line (absent for
    // a v1 Daily). Never called for an archive game (useDaily guards that).
    function recordDailyOutcome(status: GameStatus, date: string, extra?: DailyOutcomeExtra): void {
        const current = stats.value;

        // Only the first completed attempt each calendar day counts —
        // replaying today's challenge (e.g. via "Play again") shouldn't pad
        // the streak or the play/win counts.
        if (current.lastDailyResultDate === date || current.dailyResults.some((logged) => logged.date === date)) {
            return;
        }

        const isWin = status === 'won';
        // A Daily finished for a date BEFORE the last one recorded (e.g.
        // yesterday's v2 Daily submitted late after today's v1 one, or a v1
        // local date running ahead of the UK date) still counts as a play,
        // but mustn't rewind lastDailyResultDate or reset the streaks.
        const isOlderDate = current.lastDailyResultDate !== null && date < current.lastDailyResultDate;
        const isConsecutiveDay = current.lastDailyResultDate !== null
            && dayIndexForDate(date) - dayIndexForDate(current.lastDailyResultDate) === 1;
        const nextStreak = isConsecutiveDay ? current.dailyStreak + 1 : 1;
        const nextWinStreak = isWin ? (isConsecutiveDay ? current.dailyWinStreak + 1 : 1) : 0;
        // 'lost' is Daily's binary non-win outcome (see shared/types.ts) —
        // status is only ever won/bust/lost here, never a classic-mode tier.
        const dailyStatus: DailyResultEntry['status'] = status === 'won' ? 'won' : status === 'bust' ? 'bust' : 'lost';
        const entry: DailyResultEntry = extra ? { date, status: dailyStatus, score: extra.score } : { date, status: dailyStatus };

        const byDate = (a: { date: string }, b: { date: string }) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
        const next: GameStats = isOlderDate
            ? {
                ...current,
                dailyPlays: current.dailyPlays + 1,
                dailyWins: current.dailyWins + (isWin ? 1 : 0),
                dailyResults: [...current.dailyResults, entry].sort(byDate).slice(-DAILY_RESULTS_LOG_LIMIT),
            }
            : {
                ...current,
                dailyPlays: current.dailyPlays + 1,
                dailyWins: current.dailyWins + (isWin ? 1 : 0),
                dailyStreak: nextStreak,
                // Monotonic on purpose — achievements read this, never the live
                // streak, so a badge can't re-lock once a streak breaks.
                bestDailyStreak: Math.max(current.bestDailyStreak, nextStreak),
                dailyWinStreak: nextWinStreak,
                bestDailyWinStreak: Math.max(current.bestDailyWinStreak, nextWinStreak),
                lastDailyResultDate: date,
                dailyResults: [...current.dailyResults, entry].slice(-DAILY_RESULTS_LOG_LIMIT),
            };

        if (extra) {
            next.bestDailyScore = Math.max(current.bestDailyScore, extra.score);
            next.dailyScores = [
                ...current.dailyScores,
                { date, score: extra.score, status: dailyStatus, kind: extra.kind, stat: extra.stat, beatPct: extra.beatPct, players: extra.players },
            ].sort(byDate).slice(-DAILY_SCORES_LOG_LIMIT);
        }

        queueNewlyUnlocked(current, next);
        stats.value = next;

        if (import.meta.client) {
            writeStoredStats(next);
        }
    }

    // A late percentile (the full-time screen refreshing it) updates the
    // stored score line for that date, without touching anything else.
    function updateDailyScorePercentile(date: string, beatPct: number | null, players: number): void {
        const current = stats.value;
        const index = current.dailyScores.findIndex((entry) => entry.date === date);

        if (index === -1) {
            return;
        }

        const dailyScores = [...current.dailyScores];

        dailyScores[index] = { ...dailyScores[index]!, beatPct, players };
        stats.value = { ...current, dailyScores };

        if (import.meta.client) {
            writeStoredStats(stats.value);
        }
    }

    function resetStats(): void {
        stats.value = emptyStats();

        if (import.meta.client) {
            writeStoredStats(stats.value);
        }
    }

    return {
        stats,
        newlyUnlocked,
        loadStats,
        recordOutcome,
        recordDailyOutcome,
        updateDailyScorePercentile,
        dismissUnlocked,
        resetStats,
        currentDailyStreak: (today: string) => currentDailyStreak(stats.value, today),
        currentDailyWinStreak: (today: string) => currentDailyWinStreak(stats.value, today),
    };
}
