import type { Objective, Player } from '../../shared/types';
import type { GameResult } from './scoring';
import { calculateTotal, isBust as isOverTarget } from './scoring';

// The Daily Challenge's win condition is always binary — won, bust, or lost
// (once every slot is filled without winning) — unlike the classic game's
// 5-tier ladder, which is empirically tuned to one specific mechanic (see
// scoring.ts) and doesn't generalize to "score over X" / "stay under X" /
// "every player under X". `tier` is always null here.
export function getObjectiveResult(objective: Objective, pickedPlayers: Player[], totalSlots: number): GameResult {
    const filled = pickedPlayers.length;
    const total = calculateTotal(pickedPlayers);

    switch (objective.kind) {
        case 'exact': {
            if (isOverTarget(total, objective.value)) {
                return { status: 'bust', tier: null };
            }

            if (filled < totalSlots) {
                return { status: 'playing', tier: null };
            }

            return { status: total === objective.value ? 'won' : 'lost', tier: null };
        }

        case 'over': {
            // No ceiling to bust against, so unlike 'exact' there's nothing
            // that can end this early as a loss — but clearing the bar can
            // still end it early as a win, the same way 'under'/'allUnder'
            // below end early on a bust. No point making the last slot(s) a
            // formality once the total's already cleared the target.
            if (total > objective.value) {
                return { status: 'won', tier: null };
            }

            return { status: filled < totalSlots ? 'playing' : 'lost', tier: null };
        }

        case 'under': {
            // Symmetric to the classic bust rule, just flipped: reaching (not
            // just exceeding) the ceiling ends it immediately, so filling
            // every slot without busting is itself the win.
            if (total >= objective.value) {
                return { status: 'bust', tier: null };
            }

            return { status: filled < totalSlots ? 'playing' : 'won', tier: null };
        }

        case 'allUnder': {
            // Checked per-player, not on the running total — one bad pick
            // ends it immediately regardless of how many slots are left.
            const breached = pickedPlayers.some((player) => player.goals + player.assists >= objective.value);

            if (breached) {
                return { status: 'bust', tier: null };
            }

            return { status: filled < totalSlots ? 'playing' : 'won', tier: null };
        }
    }
}
