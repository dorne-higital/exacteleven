import { d as defineEventHandler, g as getQuery, c as createError, e as getDailyFormationCode, f as getDailyObjective, h as getDailyPrefilledSlotIds, a as assignPrefilledPlayers } from '../../nitro/nitro.mjs';
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

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const daily_get = defineEventHandler((event) => {
  var _a;
  const query = getQuery(event);
  const date = String((_a = query.date) != null ? _a : "");
  if (!DATE_PATTERN.test(date)) {
    throw createError({ statusCode: 400, statusMessage: "date must be YYYY-MM-DD." });
  }
  const formationCode = getDailyFormationCode(date);
  const formation = getFormation(formationCode);
  if (!formation) {
    throw createError({ statusCode: 500, statusMessage: "Unknown daily formation." });
  }
  const objective = getDailyObjective(date);
  const prefilledSlotIds = getDailyPrefilledSlotIds(date, formation);
  const prefilled = assignPrefilledPlayers(date, formation, prefilledSlotIds);
  return { date, formationCode, objective, prefilled };
});

export { daily_get as default };
//# sourceMappingURL=daily.get.mjs.map
