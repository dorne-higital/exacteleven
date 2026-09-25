import type { Player, PositionGroup } from '../../shared/types';
import playersData from '../assets/players.json';

// A static ES import, not a runtime file read: it gets bundled directly into
// the server output, which works identically on Node and on the Netlify
// Functions runtime (the deployed nitro preset — see nuxt.config.ts) where
// there is no filesystem at request time. Module evaluation happens once per
// server instance, so this and the derived lookups below are naturally
// cached, not re-read.
const players = playersData as Player[];
const playersById = new Map(players.map((player) => [player.id, player]));
// GK's pool is almost entirely 0 goals+assists (the only stat every slot is
// scored on) — a known, accepted characteristic of using the same stat
// across every position, not a data bug. See PlayerChoiceDialog.vue's
// positionScopeNote, which calls this out to the player for the GK slot.
const playersByPosition: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };

for (const player of players) {
    playersByPosition[player.position].push(player);
}

export function getPlayerById(id: string): Player | undefined {
    return playersById.get(id);
}

export function getPlayersByPosition(position: PositionGroup): Player[] {
    return playersByPosition[position];
}
