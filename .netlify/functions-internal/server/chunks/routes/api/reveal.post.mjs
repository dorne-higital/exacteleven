import { d as defineEventHandler, r as readBody, c as createError, u as useRuntimeConfig, v as verifyPlayerToken, j as getPlayerById } from '../../nitro/nitro.mjs';
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

const reveal_post = defineEventHandler(async (event) => {
  const body = await readBody(event);
  const token = typeof (body == null ? void 0 : body.token) === "string" ? body.token : "";
  const gameId = typeof (body == null ? void 0 : body.gameId) === "string" ? body.gameId : "";
  if (!token || !gameId) {
    throw createError({ statusCode: 400, statusMessage: "token and gameId are required." });
  }
  const secret = useRuntimeConfig().drawTokenSecret;
  const playerId = await verifyPlayerToken(token, gameId, secret);
  if (!playerId) {
    throw createError({ statusCode: 403, statusMessage: "This player was not offered in this game." });
  }
  const player = getPlayerById(playerId);
  if (!player) {
    throw createError({ statusCode: 404, statusMessage: "Player not found." });
  }
  return { goals: player.goals, assists: player.assists };
});

export { reveal_post as default };
//# sourceMappingURL=reveal.post.mjs.map
