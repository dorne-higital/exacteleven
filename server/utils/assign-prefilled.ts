import type { Formation, Player } from '../../shared/types';
import { pickDeterministicItem } from '#shared/daily';
import { getPlayersByPosition } from './players';

export interface PrefilledSlot {
    slotId: string;
    player: Player;
}

// Shared by /api/daily (seeded by the date) and /api/challenge (seeded by
// the creator's chosen config) — the assignment itself doesn't care where
// the seed came from, only that the same seed + slot always yields the same
// player, and that two prefilled slots never land on the same one.
export function assignPrefilledPlayers(seed: string, formation: Formation, slotIds: readonly string[]): PrefilledSlot[] {
    const usedPlayerIds = new Set<string>();
    const prefilled: PrefilledSlot[] = [];

    for (const slotId of slotIds) {
        const slot = formation.slots.find((candidate) => candidate.id === slotId);

        if (!slot) {
            continue;
        }

        const pool = getPlayersByPosition(slot.group);
        const player = pickDeterministicItem(`${seed}:${slotId}`, pool, usedPlayerIds);

        if (!player) {
            continue;
        }

        usedPlayerIds.add(player.id);
        prefilled.push({ slotId, player });
    }

    return prefilled;
}
