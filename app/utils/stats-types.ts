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
}
