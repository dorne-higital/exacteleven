import { d as defineEventHandler, g as getQuery, c as createError, b as buildObjective, a as assignPrefilledPlayers, O as OBJECTIVE_KINDS } from '../../nitro/nitro.mjs';
import { g as getFormation } from '../../_/formations.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'lru-cache';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'consola';
import 'xss';
import 'sitemapd/parse';

const VALID_KINDS = new Set(OBJECTIVE_KINDS);
const MAX_PRESET_SLOTS = 3;
const challenge_get = defineEventHandler((event) => {
  var _a, _b, _c;
  const query = getQuery(event);
  const formationCode = String((_a = query.f) != null ? _a : "");
  const formation = getFormation(formationCode);
  if (!formation) {
    throw createError({ statusCode: 400, statusMessage: "f must be a valid formation code." });
  }
  const mode = String((_b = query.mode) != null ? _b : "exact");
  if (!VALID_KINDS.has(mode)) {
    throw createError({ statusCode: 400, statusMessage: "mode must be exact, over, under, or allUnder." });
  }
  const rawValue = query.value === void 0 ? void 0 : Number(query.value);
  const objective = buildObjective(mode, formation.code, rawValue);
  if (!objective) {
    throw createError({ statusCode: 400, statusMessage: "value is not a valid option for this mode." });
  }
  const eligibleSlotIds = new Set(formation.slots.filter((slot) => slot.group !== "GK").map((slot) => slot.id));
  const requestedSlotIds = String((_c = query.preset) != null ? _c : "").split(",").map((id) => id.trim()).filter(Boolean);
  const slotIds = [...new Set(requestedSlotIds)].filter((id) => eligibleSlotIds.has(id)).sort().slice(0, MAX_PRESET_SLOTS);
  const seed = `challenge:${formation.code}:${objective.kind}:${objective.value}:${slotIds.join(",")}`;
  const prefilled = assignPrefilledPlayers(seed, formation, slotIds);
  return { formationCode: formation.code, objective, prefilled };
});

export { challenge_get as default };
//# sourceMappingURL=challenge.get.mjs.map
