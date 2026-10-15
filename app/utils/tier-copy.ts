import type { ResultTier } from '../../shared/types';

// One place for every Classic result tier's label, share emoji and detail
// line, so ResultPanel, HowToPlayContent and the share text can't drift
// (they used to each keep their own Record<ResultTier, …>). Worst to best:
// relegated < avoidedRelegation < midTable < europaLeague < championsLeague
// < titleWinners < win (exact only, not a tier). 🏆 stays reserved for the
// exact win, so the tiers start at 🥈.
export interface TierCopy {
    label: string;
    emoji: string;
    detail: (distance: number, target: number) => string;
}

export const TIER_COPY: Record<ResultTier, TierCopy> = {
    titleWinners: {
        label: 'Title contenders',
        emoji: '🥈',
        detail: (distance, target) => `${distance} off ${target}, so close it hurts.`,
    },
    championsLeague: {
        label: 'Champions League',
        emoji: '⭐',
        detail: (distance, target) => `${distance} off ${target} — a genuine near-miss.`,
    },
    europaLeague: {
        label: 'Europa League',
        emoji: '🟢',
        detail: (distance, target) => `${distance} off ${target} — a solid finish.`,
    },
    midTable: {
        label: 'Mid-table',
        emoji: '🟡',
        detail: (distance, target) => `${distance} off ${target} — solid mid-table.`,
    },
    avoidedRelegation: {
        label: 'Avoided relegation',
        emoji: '🟠',
        detail: (distance, target) => `${distance} off ${target} — scraped clear of the bottom.`,
    },
    relegated: {
        label: 'Relegated',
        emoji: '🔴',
        detail: (distance, target) => `${distance} off ${target} — a rough one.`,
    },
};
