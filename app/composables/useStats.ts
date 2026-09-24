import type { FormationCode, GameStatus, ResultTier } from '../../shared/types';
import type { AchievementDef } from '../utils/achievements';
import type { BestResult, GameStats } from '../utils/stats-types';
import type { Outcome } from '../utils/scoring';
import { dayIndexForDate } from '../../shared/daily';
import { backfillSeenAchievements, diffNewlyUnlocked, readSeenAchievementIds, writeSeenAchievementIds } from '../utils/achievement-notifications';
import { formations } from '../utils/formations';
import { isBetterOutcome } from '../utils/scoring';

const STATS_STORAGE_KEY = 'exact-xi-stats';

const COUNT_KEYS = ['gamesPlayed', 'wins', 'championsLeague', 'europaLeague', 'midTable', 'avoidedRelegation', 'relegated', 'busts', 'dailyStreak', 'bestDailyStreak', 'dailyWins', 'dailyPlays'] as const;

const DAILY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const VALID_OUTCOMES: Outcome[] = ['champion', 'championsLeague', 'europaLeague', 'midTable', 'avoidedRelegation', 'relegated'];

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

    return clean;
}

function emptyFormationRecord(): Record<FormationCode, number> {
    return Object.fromEntries(formations.map((formation) => [formation.code, 0])) as Record<FormationCode, number>;
}

function emptyStats(): GameStats {
    return {
        gamesPlayed: 0,
        wins: 0,
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
        dailyWins: 0,
        dailyPlays: 0,
        lastDailyResultDate: null,
    };
}

function readStoredStats(): GameStats {
    try {
        const raw = window.localStorage.getItem(STATS_STORAGE_KEY);

        if (!raw) {
            return emptyStats();
        }

        const parsed = sanitizeStats(JSON.parse(raw));

        return {
            ...emptyStats(),
            ...parsed,
            formationPlays: { ...emptyFormationRecord(), ...parsed.formationPlays },
            formationWins: { ...emptyFormationRecord(), ...parsed.formationWins },
        };
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

    // Called once from app.vue's onMounted, same as useTheme's initTheme —
    // localStorage isn't available during SSR, so the default above renders
    // first and this hydrates the real value client-side.
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
    // exactly-once call site.
    function recordOutcome(status: GameStatus, tier: ResultTier | null, formationCode: FormationCode): void {
        const next = {
            ...stats.value,
            gamesPlayed: stats.value.gamesPlayed + 1,
            formationPlays: {
                ...stats.value.formationPlays,
                [formationCode]: stats.value.formationPlays[formationCode] + 1,
            },
        };
        let outcome: Outcome | null = null;

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
    function recordDailyOutcome(status: GameStatus, date: string): void {
        const current = stats.value;

        // Only the first completed attempt each calendar day counts —
        // replaying today's challenge (e.g. via "Play again") shouldn't pad
        // the streak or the play/win counts.
        if (current.lastDailyResultDate === date) {
            return;
        }

        const isWin = status === 'won';
        const isConsecutiveDay = current.lastDailyResultDate !== null
            && dayIndexForDate(date) - dayIndexForDate(current.lastDailyResultDate) === 1;
        const nextStreak = isWin ? (isConsecutiveDay ? current.dailyStreak + 1 : 1) : 0;

        const next: GameStats = {
            ...current,
            dailyPlays: current.dailyPlays + 1,
            dailyWins: current.dailyWins + (isWin ? 1 : 0),
            dailyStreak: nextStreak,
            // Monotonic on purpose — achievements read this, never the live
            // streak, so a badge can't re-lock once a streak breaks.
            bestDailyStreak: Math.max(current.bestDailyStreak, nextStreak),
            lastDailyResultDate: date,
        };

        queueNewlyUnlocked(current, next);
        stats.value = next;

        if (import.meta.client) {
            writeStoredStats(next);
        }
    }

    function resetStats(): void {
        stats.value = emptyStats();

        if (import.meta.client) {
            writeStoredStats(stats.value);
        }
    }

    return { stats, newlyUnlocked, loadStats, recordOutcome, recordDailyOutcome, dismissUnlocked, resetStats };
}
