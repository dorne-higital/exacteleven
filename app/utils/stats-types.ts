import type { DailyStat } from '../../shared/daily2-types';
import type { FormationCode, ObjectiveKind } from '../../shared/types';
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
    /** Daily 2.0 only: the score out of 1,000 (absent on v1 results). */
    score?: number;
}

// One ranked Daily 2.0 result — the Stats dialog's "recent scores" and the
// Sunday recap's fallback when offline. Capped at the last 14.
export interface DailyScoreEntry {
    date: string;
    score: number;
    status: 'won' | 'bust' | 'lost';
    kind: ObjectiveKind;
    stat: DailyStat;
    beatPct: number | null;
    players: number;
}

export interface GameStats {
    gamesPlayed: number;
    wins: number;
    championsLeague: number;
    europaLeague: number;
    midTable: number;
    avoidedRelegation: number;
    relegated: number;
    /** Classic finishes within the Title winners window (1..titleWindowFor(target) off). */
    titleWinners: number;
    busts: number;
    /** The best outcome ever reached (bust doesn't count — it isn't part of the ranked ladder), and which formation it happened on. */
    bestResult: BestResult | null;
    /** How many completed games were played on each formation — same "once per terminal game" recording as everything else here. */
    formationPlays: Record<FormationCode, number>;
    /** How many EXACT wins landed on each formation — a subset of formationPlays, feeds the per-formation achievements in utils/achievements.ts. */
    formationWins: Record<FormationCode, number>;
    /**
     * Consecutive UK days with a finished first Daily attempt (won, lost or
     * bust) — the PLAYED streak since statsVersion 2 (it used to count wins,
     * see dailyWinStreak). Stored value only resets on the next record; read
     * it through currentDailyStreak() to show 0 once a day was missed.
     * Not used by achievements directly, see bestDailyStreak.
     */
    dailyStreak: number;
    /** The highest dailyStreak ever reached — monotonic, so achievements and Game Center read this instead of the live streak (a badge must never re-lock). */
    bestDailyStreak: number;
    /** Consecutive Daily days WON (what dailyStreak meant before statsVersion 2). */
    dailyWinStreak: number;
    /** The highest dailyWinStreak ever reached — monotonic. */
    bestDailyWinStreak: number;
    /** Best Daily 2.0 score out of 1,000 (0 = none yet). */
    bestDailyScore: number;
    /** The most recent Daily 2.0 scores, oldest first, capped at 14. */
    dailyScores: DailyScoreEntry[];
    /** 2 once the played-streak migration has run (DAILY2_SPEC §1.9). */
    statsVersion: number;
    dailyWins: number;
    dailyPlays: number;
    /** The YYYY-MM-DD of the last completed Daily Challenge attempt — used both to detect a consecutive-day streak and to guard against a same-day replay (e.g. via "Play again") padding the stats twice. */
    lastDailyResultDate: string | null;
    /** The most recent Daily Challenge results (oldest first), capped to a rolling window — feeds StatsDialog's Season Table. */
    dailyResults: DailyResultEntry[];
    /** Exact Classic wins with no banked boost or Pro extra used — a subset of `wins`, and what Game Center's exact-wins board reads. Stats saved before boosts existed start this at `wins` (every earlier win was unassisted). */
    unassistedWins: number;
    /** The current run of consecutive unassisted exact Classic wins. Any other Classic finish — including an assisted one, so boosts can't rescue a run — ends it. */
    currentExactRun: number;
    /** The longest currentExactRun ever reached — monotonic; Game Center's best-run board reads it. */
    bestExactRun: number;
}
