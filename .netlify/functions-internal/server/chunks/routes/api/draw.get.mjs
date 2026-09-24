import { d as defineEventHandler, g as getQuery, c as createError, i as getPlayersByPosition, u as useRuntimeConfig, s as signPlayerToken } from '../../nitro/nitro.mjs';
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

const VALID_POSITIONS = /* @__PURE__ */ new Set(["GK", "DEF", "MID", "FWD"]);
const CANDIDATES_PER_DRAW = 3;
const GAME_ID_PATTERN = /^[\w-]{8,64}$/;
const PLAYER_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_EXCLUDE_LENGTH = 2e3;
const MAX_EXCLUDED_IDS = 60;
function parseExclude(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    return /* @__PURE__ */ new Set();
  }
  if (raw.length > MAX_EXCLUDE_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: "exclude is too long." });
  }
  const ids = raw.split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length > MAX_EXCLUDED_IDS) {
    throw createError({ statusCode: 400, statusMessage: `exclude accepts at most ${MAX_EXCLUDED_IDS} ids.` });
  }
  return new Set(ids.filter((id) => PLAYER_ID_PATTERN.test(id)));
}
function sampleWithoutReplacement(items, count) {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== void 0) {
      picked.push(item);
    }
  }
  return picked;
}
const draw_get = defineEventHandler(async (event) => {
  var _a, _b;
  const query = getQuery(event);
  const position = String((_a = query.position) != null ? _a : "");
  if (!VALID_POSITIONS.has(position)) {
    throw createError({ statusCode: 400, statusMessage: "position must be one of GK, DEF, MID, FWD." });
  }
  const gameId = String((_b = query.gameId) != null ? _b : "");
  if (!GAME_ID_PATTERN.test(gameId)) {
    throw createError({ statusCode: 400, statusMessage: "gameId is required." });
  }
  const exclude = parseExclude(query.exclude);
  const eligible = getPlayersByPosition(position).filter((player) => !exclude.has(player.id));
  const chosen = sampleWithoutReplacement(eligible, CANDIDATES_PER_DRAW);
  const secret = useRuntimeConfig().drawTokenSecret;
  return Promise.all(chosen.map(async (player) => ({
    id: player.id,
    name: player.name,
    clubs: player.clubs,
    firstSeason: player.firstSeason,
    lastSeason: player.lastSeason,
    appearances: player.appearances,
    token: await signPlayerToken(player.id, gameId, secret)
  })));
});

export { draw_get as default };
//# sourceMappingURL=draw.get.mjs.map
