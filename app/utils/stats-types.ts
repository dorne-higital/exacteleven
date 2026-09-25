import type { FormationCode } from '../../shared/types';
import type { Outcome } from './scoring';

// Split out of useStats.ts so these types can be imported by plain-TS
// contexts (tests/, utils/achievements.ts) without pulling in that
// composable's useState()/import.meta.client runtime code — those only
// type-check under Nuxt's own generated tsconfig, not tsconfig.scripts.json.
export interface BestResult {
    outcome: Outcome;
    formationCode: FormationCode;
}

// One row of DailyStreakStrip.vue's recent-form log (daily.vue and the
// homepage's Daily Challenge card).
export interface DailyResultEntry {
    /** YYYY-MM-DD, matching GameStats.lastDailyResultDate's format. */
    date: string;
    status: 'won' | 'bust' | 'lost';
}

export interface GameStats {
    gamesPlayed: number;
    wins: number;
    championsLeague: number;
    europaLeague: number;
    midTable: number;
    avoidedRelegation: number;
    relegated: number;
    busts: number;
    /** The best outcome ever reached (bust doesn't count — it isn't part of the ranked ladder), and which formation it happened on. */
    bestResult: BestResult | null;
    /** How many completed games were played on each formation — same "once per terminal game" recording as everything else here. */
    formationPlays: Record<FormationCode, number>;
    /** How many EXACT wins landed on each formation — a subset of formationPlays, feeds the per-formation achievements in utils/achievements.ts. */
    formationWins: Record<FormationCode, number>;
    /** Current consecutive-day Daily Challenge win streak — NOT used by achievements directly (it can go back to 0), see bestDailyStreak. */
    dailyStreak: number;
    /** The highest dailyStreak ever reached — monotonic, so achievements read this instead of the live streak (a badge must never re-lock). */
    bestDailyStreak: number;
    dailyWins: number;
    dailyPlays: number;
    /** The YYYY-MM-DD of the last completed Daily Challenge attempt — used both to detect a consecutive-day streak and to guard against a same-day replay (e.g. via "Play again") padding the stats twice. */
    lastDailyResultDate: string | null;
    /** The most recent Daily Challenge results (oldest first), capped to a rolling window — feeds StatsDialog's Season Table. */
    dailyResults: DailyResultEntry[];
}
