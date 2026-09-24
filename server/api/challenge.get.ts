import type { ObjectiveKind } from '../../shared/types';
import { buildObjective, OBJECTIVE_KINDS } from '../../shared/daily';
import { getFormation } from '../../app/utils/formations';
import { assignPrefilledPlayers } from '../utils/assign-prefilled';

const VALID_KINDS = new Set<string>(OBJECTIVE_KINDS);
const MAX_PRESET_SLOTS = 3;

export default defineEventHandler((event) => {
    const query = getQuery(event);
    const formationCode = String(query.f ?? '');
    const formation = getFormation(formationCode);

    if (!formation) {
        throw createError({ statusCode: 400, statusMessage: 'f must be a valid formation code.' });
    }

    const mode = String(query.mode ?? 'exact');

    if (!VALID_KINDS.has(mode)) {
        throw createError({ statusCode: 400, statusMessage: 'mode must be exact, over, under, or allUnder.' });
    }

    const rawValue = query.value === undefined ? undefined : Number(query.value);
    const objective = buildObjective(mode as ObjectiveKind, formation.code, rawValue);

    if (!objective) {
        throw createError({ statusCode: 400, statusMessage: 'value is not a valid option for this mode.' });
    }

    // Non-GK only (a preset GK is a free no-op, see shared/daily.ts), deduped,
    // capped, and sorted — sorted so the seed below (and therefore which
    // player lands in which slot) never depends on the order slot ids
    // happened to appear in the URL.
    const eligibleSlotIds = new Set(formation.slots.filter((slot) => slot.group !== 'GK').map((slot) => slot.id));
    const requestedSlotIds = String(query.preset ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const slotIds = [...new Set(requestedSlotIds)].filter((id) => eligibleSlotIds.has(id)).sort().slice(0, MAX_PRESET_SLOTS);

    // The config itself is the seed — no id, no storage: the same formation +
    // mode + value + preset slots always produces the same puzzle, whether
    // decoded by the creator's own preview or a friend's browser.
    const seed = `challenge:${formation.code}:${objective.kind}:${objective.value}:${slotIds.join(',')}`;
    const prefilled = assignPrefilledPlayers(seed, formation, slotIds);

    return { formationCode: formation.code, objective, prefilled };
});
