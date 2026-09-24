//#region app/utils/challenge-config.ts
function buildChallengeQuery(config) {
	const query = {
		f: config.formationCode,
		mode: config.mode
	};
	if (config.value !== void 0) query.value = String(config.value);
	if (config.presetSlotIds.length > 0) query.preset = config.presetSlotIds.join(",");
	return query;
}
function challengeKeyFromQuery(query) {
	return Object.entries(query).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("&");
}

export { buildChallengeQuery as b, challengeKeyFromQuery as c };
//# sourceMappingURL=challenge-config--UdGTplH.mjs.map
