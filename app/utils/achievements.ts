import type { FormationCode, ResultTier } from '../../shared/types';
import type { GameStats } from './stats-types';
import { formations } from './formations';

export type AchievementCategory = 'gamesPlayed' | 'gamesWon' | 'tier' | 'formationWin';
export type AchievementRank = 'bronze' | 'silver' | 'gold' | 'emerald' | 'diamond';

export interface AchievementDef {
    id: string;
    category: AchievementCategory;
    /** Which tier or formation this badge is for — only set for the 'tier'/'formationWin' categories. */
    subKind?: ResultTier | FormationCode;
    threshold: number;
    rank: AchievementRank;
    label: string;
    description: string;
}

export interface AchievementProgress {
    def: AchievementDef;
    current: number;
    unlocked: boolean;
}

// Same threshold list drives games-won, every tier and every formation —
// one shared scale keeps 60+ badges legible instead of each category
// needing its own bespoke numbers.
const GAMES_PLAYED_THRESHOLDS = [5, 10, 25, 50, 100, 250, 500, 1000, 5000, 10000];
const WIN_THRESHOLDS = [1, 3, 5, 10, 25, 50, 100, 250, 500];

export const TIERS: ReadonlyArray<{ key: ResultTier; label: string }> = [
    { key: 'championsLeague', label: 'Champions League' },
    { key: 'europaLeague', label: 'Europa League' },
    { key: 'midTable', label: 'Mid-table' },
    { key: 'avoidedRelegation', label: 'Avoided Relegation' },
    { key: 'relegated', label: 'Relegated' },
];

const RANKS: AchievementRank[] = ['bronze', 'silver', 'gold', 'emerald', 'diamond'];

// Splits any threshold list into 5 even bands regardless of its length —
// the same bronze->diamond progression the badge artwork uses, driven by a
// threshold's POSITION in its own category's list, not its raw number (so
// a 9-item and a 10-item list both read the same way).
function rankForIndex(index: number, total: number): AchievementRank {
    const band = Math.min(Math.floor((index / total) * RANKS.length), RANKS.length - 1);

    return RANKS[band]!;
}

function plural(count: number, word: string): string {
    return count === 1 ? word : `${word}s`;
}

function buildAchievements(): AchievementDef[] {
    const defs: AchievementDef[] = [];

    GAMES_PLAYED_THRESHOLDS.forEach((threshold, index) => {
        defs.push({
            id: `games-played-${threshold}`,
            category: 'gamesPlayed',
            threshold,
            rank: rankForIndex(index, GAMES_PLAYED_THRESHOLDS.length),
            label: `${threshold} Games`,
            description: `Play ${threshold} ${plural(threshold, 'game')} in total.`,
        });
    });

    WIN_THRESHOLDS.forEach((threshold, index) => {
        defs.push({
            id: `games-won-${threshold}`,
            category: 'gamesWon',
            threshold,
            rank: rankForIndex(index, WIN_THRESHOLDS.length),
            label: `${threshold} Exact ${plural(threshold, 'Win')}`,
            description: `Land the total exactly on target ${threshold} ${plural(threshold, 'time')}.`,
        });
    });

    for (const tier of TIERS) {
        WIN_THRESHOLDS.forEach((threshold, index) => {
            defs.push({
                id: `tier-${tier.key}-${threshold}`,
                category: 'tier',
                subKind: tier.key,
                threshold,
                rank: rankForIndex(index, WIN_THRESHOLDS.length),
                label: `${threshold}× ${tier.label}`,
                description: `Finish in the ${tier.label} tier ${threshold} ${plural(threshold, 'time')}.`,
            });
        });
    }

    for (const formation of formations) {
        WIN_THRESHOLDS.forEach((threshold, index) => {
            defs.push({
                id: `formation-win-${formation.code}-${threshold}`,
                category: 'formationWin',
                subKind: formation.code,
                threshold,
                rank: rankForIndex(index, WIN_THRESHOLDS.length),
                label: `${threshold}× ${formation.code} ${plural(threshold, 'Win')}`,
                description: `Win an exact match with the ${formation.code} formation ${threshold} ${plural(threshold, 'time')}.`,
            });
        });
    }

    return defs;
}

export const ACHIEVEMENTS: AchievementDef[] = buildAchievements();

function metricFor(stats: GameStats, def: AchievementDef): number {
    switch (def.category) {
        case 'gamesPlayed':
            return stats.gamesPlayed;
        case 'gamesWon':
            return stats.wins;
        case 'tier':
            return stats[def.subKind as ResultTier];
        case 'formationWin':
            return stats.formationWins[def.subKind as FormationCode];
        default:
            return 0;
    }
}

export function getAchievementProgress(stats: GameStats): AchievementProgress[] {
    return ACHIEVEMENTS.map((def) => {
        const current = metricFor(stats, def);

        return { def, current, unlocked: current >= def.threshold };
    });
}
