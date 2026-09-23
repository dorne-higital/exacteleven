import type { FormationCode, GameStatus, ResultTier } from '../../shared/types';
import type { Outcome } from '../utils/scoring';
import { formations } from '../utils/formations';
import { isBetterOutcome } from '../utils/scoring';

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
}

const STATS_STORAGE_KEY = 'exact-xi-stats';

function emptyFormationPlays(): Record<FormationCode, number> {
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
        formationPlays: emptyFormationPlays(),
    };
}

function readStoredStats(): GameStats {
    try {
        const raw = window.localStorage.getItem(STATS_STORAGE_KEY);

        if (!raw) {
            return emptyStats();
        }

        const parsed = JSON.parse(raw) as Partial<GameStats>;

        return {
            ...emptyStats(),
            ...parsed,
            formationPlays: { ...emptyFormationPlays(), ...parsed.formationPlays },
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

    // Called once from app.vue's onMounted, same as useTheme's initTheme —
    // localStorage isn't available during SSR, so the default above renders
    // first and this hydrates the real value client-side.
    function loadStats(): void {
        if (import.meta.client) {
            stats.value = readStoredStats();
        }
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

    return { stats, loadStats, recordOutcome, resetStats };
}
