import { b as useState, c as useStats, _ as _plugin_vue_export_helper_default, $ as $fetch$2, d as calculateTotal, e as getGameResult, f as getDistance, h as useSiteConfig, N as NuxtLink, i as getSlotShortLabel, j as describeSlotRole, k as isBust, g as getFormation } from '../virtual/entry.mjs';
import { t as trackEvent } from './StatsDialog-DyxQmieI.mjs';
import { defineComponent, computed, mergeProps, unref, ref, watch, withCtx, createTextVNode, useId, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderClass, ssrInterpolate, ssrRenderStyle, ssrRenderList, ssrRenderComponent, ssrRenderAttr } from 'vue/server-renderer';

//#region app/components/ScoreBar.vue?vue&type=script&setup=true&lang.ts
var ScoreBar_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "ScoreBar",
	__ssrInlineRender: true,
	props: {
		target: {},
		total: {},
		remainingSlots: {},
		status: {},
		objective: {}
	},
	setup(__props) {
		const props = __props;
		const objectiveValue = computed(() => props.objective?.value ?? props.target);
		const showProgressBar = computed(() => props.objective?.kind !== "allUnder");
		const progress = computed(() => showProgressBar.value && objectiveValue.value > 0 ? Math.min(100, props.total / objectiveValue.value * 100) : 0);
		const targetLabel = computed(() => props.objective ? props.objective.label : "Target");
		const targetValue = computed(() => props.objective && props.objective.kind !== "exact" ? null : objectiveValue.value);
		const remainingLabel = computed(() => props.status === "playing" ? "Remaining" : "Unfilled");
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "score-bar" }, _attrs))} data-v-261eefde><div class="score-bar__row" data-v-261eefde><div class="${ssrRenderClass([{ "score-bar__item--wide": unref(targetValue) === null }, "score-bar__item"])}" data-v-261eefde><span class="score-bar__label" data-v-261eefde>${ssrInterpolate(unref(targetLabel))}</span>`);
			if (unref(targetValue) !== null) _push(`<span class="score-bar__value" data-v-261eefde>${ssrInterpolate(unref(targetValue))}</span>`);
			else _push(`<!---->`);
			_push(`</div><div class="score-bar__item" data-v-261eefde><span class="score-bar__label" data-v-261eefde>Total</span><span class="score-bar__value" data-v-261eefde>${ssrInterpolate(__props.total)}</span></div><div class="score-bar__item" data-v-261eefde><span class="score-bar__label" data-v-261eefde>${ssrInterpolate(unref(remainingLabel))}</span><span class="score-bar__value" data-v-261eefde>${ssrInterpolate(__props.remainingSlots)}</span></div></div>`);
			if (unref(showProgressBar)) _push(`<div aria-hidden="true" class="score-bar__track" data-v-261eefde><div class="${ssrRenderClass([{ "score-bar__fill--bust": __props.status === "bust" }, "score-bar__fill"])}" style="${ssrRenderStyle({ width: `${unref(progress)}%` })}" data-v-261eefde></div></div>`);
			else _push(`<!---->`);
			_push(`</div>`);
		};
	}
});
//#endregion
//#region app/components/ScoreBar.vue
var _sfc_setup$4 = ScoreBar_vue_vue_type_script_setup_true_lang_default.setup;
ScoreBar_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/ScoreBar.vue");
	return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
var ScoreBar_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(ScoreBar_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-261eefde"]]), { __name: "ScoreBar" });
//#endregion
//#region app/utils/daily-scoring.ts
function getObjectiveResult(objective, pickedPlayers, totalSlots) {
	const filled = pickedPlayers.length;
	const total = calculateTotal(pickedPlayers);
	switch (objective.kind) {
		case "exact":
			if (isBust(total, objective.value)) return {
				status: "bust",
				tier: null
			};
			if (filled < totalSlots) return {
				status: "playing",
				tier: null
			};
			return {
				status: total === objective.value ? "won" : "lost",
				tier: null
			};
		case "over":
			if (filled < totalSlots) return {
				status: "playing",
				tier: null
			};
			return {
				status: total > objective.value ? "won" : "lost",
				tier: null
			};
		case "under":
			if (total >= objective.value) return {
				status: "bust",
				tier: null
			};
			return {
				status: filled < totalSlots ? "playing" : "won",
				tier: null
			};
		case "allUnder":
			if (pickedPlayers.some((player) => player.goals + player.assists >= objective.value)) return {
				status: "bust",
				tier: null
			};
			return {
				status: filled < totalSlots ? "playing" : "won",
				tier: null
			};
	}
}
//#endregion
//#region app/composables/useGame.ts
var REROLLS_PER_GAME = 1;
var GAME_STORAGE_KEY = "exact-xi-game";
function readPersistedGame() {
	try {
		const raw = (void 0).sessionStorage.getItem(GAME_STORAGE_KEY);
		return raw ? JSON.parse(raw) : null;
	} catch {
		return null;
	}
}
function writePersistedGame(game) {
	try {
		if (game) (void 0).sessionStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(game));
		else (void 0).sessionStorage.removeItem(GAME_STORAGE_KEY);
	} catch {}
}
function findSlot(game, slotId) {
	return game.slots.find((candidate) => candidate.id === slotId);
}
function createInitialState(formationCode) {
	const formation = getFormation(formationCode);
	if (!formation) throw new Error(`Unknown formation code: ${formationCode}`);
	return {
		gameId: crypto.randomUUID(),
		formationCode,
		target: formation.target,
		slots: formation.slots.map((slot) => ({
			...slot,
			player: null
		})),
		offeredPlayerIds: [],
		rerollsLeft: REROLLS_PER_GAME,
		total: 0,
		status: "playing",
		tier: null,
		activeSlotId: null,
		offeredPlayers: [],
		statsRecorded: false
	};
}
function createObjectivePrefilledState(formationCode, objective, prefilled) {
	const formation = getFormation(formationCode);
	if (!formation) throw new Error(`Unknown formation code: ${formationCode}`);
	const prefilledBySlotId = new Map(prefilled.map((entry) => [entry.slotId, entry.player]));
	const prefilledPlayers = prefilled.map((entry) => entry.player);
	return {
		gameId: crypto.randomUUID(),
		formationCode,
		target: formation.target,
		slots: formation.slots.map((slot) => {
			const player = prefilledBySlotId.get(slot.id) ?? null;
			return {
				...slot,
				player,
				preset: player !== null
			};
		}),
		offeredPlayerIds: prefilledPlayers.map((player) => player.id),
		rerollsLeft: REROLLS_PER_GAME,
		total: calculateTotal(prefilledPlayers),
		status: "playing",
		tier: null,
		activeSlotId: null,
		offeredPlayers: [],
		statsRecorded: false,
		objective
	};
}
function createDailyState(payload) {
	return {
		...createObjectivePrefilledState(payload.formationCode, payload.objective, payload.prefilled),
		dailyDate: payload.date
	};
}
function createChallengeState(payload, challengeKey) {
	return {
		...createObjectivePrefilledState(payload.formationCode, payload.objective, payload.prefilled),
		challengeKey
	};
}
function useGame() {
	const state = useState("exact-xi-game", () => null);
	const { recordOutcome, recordDailyOutcome } = useStats();
	const isDrawing = useState("exact-xi-drawing", () => false);
	const pendingSlotId = useState("exact-xi-pending-slot", () => null);
	const drawError = useState("exact-xi-draw-error", () => false);
	function startGame(formationCode) {
		state.value = createInitialState(formationCode);
		writePersistedGame(state.value);
		trackEvent("game_start", {
			target: state.value.target
		});
	}
	function startDailyGame(payload) {
		state.value = createDailyState(payload);
		writePersistedGame(state.value);
		trackEvent("daily_start", {
			date: payload.date,
			formation: payload.formationCode,
			objective: payload.objective.kind
		});
	}
	function resumeDailyGame(date) {
		const persisted = readPersistedGame();
		if (!persisted || persisted.dailyDate !== date) return false;
		state.value = persisted;
		return true;
	}
	function startChallengeGame(payload, challengeKey) {
		state.value = createChallengeState(payload, challengeKey);
		writePersistedGame(state.value);
		trackEvent("challenge_start", {
			formation: payload.formationCode,
			objective: payload.objective.kind
		});
	}
	function resumeChallengeGame(challengeKey) {
		const persisted = readPersistedGame();
		if (!persisted || persisted.challengeKey !== challengeKey) return false;
		state.value = persisted;
		return true;
	}
	function resumeGame(formationCode) {
		const persisted = readPersistedGame();
		if (!persisted || persisted.formationCode !== formationCode) return false;
		state.value = persisted;
		return true;
	}
	async function drawForSlot(slotId) {
		const game = state.value;
		if (!game) return;
		const slot = findSlot(game, slotId);
		if (!slot) return;
		isDrawing.value = true;
		pendingSlotId.value = slotId;
		drawError.value = false;
		try {
			const candidates = await $fetch$2("/api/draw", { query: {
				position: slot.group,
				exclude: game.offeredPlayerIds.join(","),
				gameId: game.gameId
			} });
			game.activeSlotId = slotId;
			game.offeredPlayers = candidates;
			const seen = new Set(game.offeredPlayerIds);
			for (const candidate of candidates) seen.add(candidate.id);
			game.offeredPlayerIds = [...seen];
			writePersistedGame(game);
			trackEvent("slot_draw", {
				position: slot.group,
				formation: game.formationCode
			});
		} catch {
			drawError.value = true;
			trackEvent("slot_draw_error", {
				position: slot.group,
				formation: game.formationCode
			});
		} finally {
			isDrawing.value = false;
			pendingSlotId.value = null;
		}
	}
	async function openSlot(slotId) {
		const game = state.value;
		if (!game || game.status !== "playing" || isDrawing.value) return;
		const slot = findSlot(game, slotId);
		if (!slot || slot.player) return;
		await drawForSlot(slotId);
	}
	async function useReroll() {
		const game = state.value;
		if (!game || game.status !== "playing" || game.rerollsLeft <= 0 || !game.activeSlotId || isDrawing.value) return false;
		game.rerollsLeft -= 1;
		trackEvent("reroll_used", { formation: game.formationCode });
		await drawForSlot(game.activeSlotId);
		return true;
	}
	async function pickPlayer(chosen) {
		const game = state.value;
		if (!game || game.status !== "playing" || !game.activeSlotId || isDrawing.value) return null;
		const slot = findSlot(game, game.activeSlotId);
		if (!slot || slot.player) return null;
		let result;
		try {
			result = await $fetch$2("/api/reveal", {
				method: "POST",
				body: {
					token: chosen.token,
					gameId: game.gameId
				}
			});
		} catch {
			return null;
		}
		const player = {
			id: chosen.id,
			name: chosen.name,
			position: slot.group,
			clubs: chosen.clubs,
			firstSeason: chosen.firstSeason,
			lastSeason: chosen.lastSeason,
			appearances: chosen.appearances,
			goals: result.goals,
			assists: result.assists
		};
		slot.player = player;
		trackEvent("player_picked", {
			position: slot.group,
			playerId: player.id,
			formation: game.formationCode
		});
		const pickedPlayers = game.slots.map((candidate) => candidate.player).filter((candidate) => candidate !== null);
		game.total = calculateTotal(pickedPlayers);
		const outcome = game.objective ? getObjectiveResult(game.objective, pickedPlayers, game.slots.length) : getGameResult(game.total, game.target, pickedPlayers.length, game.slots.length);
		game.status = outcome.status;
		game.tier = outcome.tier;
		if (!game.statsRecorded && outcome.status !== "playing") {
			game.statsRecorded = true;
			if (game.objective && game.dailyDate) {
				recordDailyOutcome(outcome.status, game.dailyDate);
				trackEvent("daily_over", {
					date: game.dailyDate,
					objective: game.objective.kind,
					status: outcome.status,
					total: game.total
				});
			} else if (game.objective) trackEvent("challenge_over", {
				formation: game.formationCode,
				objective: game.objective.kind,
				status: outcome.status,
				total: game.total
			});
			else {
				recordOutcome(outcome.status, outcome.tier, game.formationCode);
				trackEvent("game_over", {
					formation: game.formationCode,
					status: outcome.status,
					tier: outcome.tier,
					total: game.total,
					target: game.target
				});
			}
		}
		writePersistedGame(game);
		return result;
	}
	function closeDialog() {
		const game = state.value;
		if (!game) return;
		game.activeSlotId = null;
		game.offeredPlayers = [];
		writePersistedGame(game);
	}
	function reset() {
		state.value = null;
		writePersistedGame(null);
	}
	return {
		state,
		isDrawing,
		pendingSlotId,
		drawError,
		startGame,
		resumeGame,
		startDailyGame,
		resumeDailyGame,
		startChallengeGame,
		resumeChallengeGame,
		openSlot,
		pickPlayer,
		useReroll,
		closeDialog,
		reset
	};
}
//#endregion
//#region app/components/ResultPanel.vue?vue&type=script&setup=true&lang.ts
var CONFETTI_COUNT = 18;
var ResultPanel_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "ResultPanel",
	__ssrInlineRender: true,
	setup(__props) {
		const TIER_COPY = {
			championsLeague: {
				label: "Champions League",
				detail: (distance, target) => `${distance} off ${target} — a genuine near-miss.`
			},
			europaLeague: {
				label: "Europa League",
				detail: (distance, target) => `${distance} off ${target} — a solid finish.`
			},
			midTable: {
				label: "Mid-table",
				detail: (distance, target) => `${distance} off ${target} — solid mid-table.`
			},
			avoidedRelegation: {
				label: "Avoided relegation",
				detail: (distance, target) => `${distance} off ${target} — scraped clear of the bottom.`
			},
			relegated: {
				label: "Relegated",
				detail: (distance, target) => `${distance} off ${target} — a rough one.`
			}
		};
		const TIER_EMOJI = {
			championsLeague: "⭐",
			europaLeague: "🟢",
			midTable: "🟡",
			avoidedRelegation: "🟠",
			relegated: "🔴"
		};
		const { state} = useGame();
		const recap = computed(() => (state.value?.slots ?? []).filter((slot) => slot.player));
		const starSlot = computed(() => {
			if (recap.value.length === 0) return null;
			return recap.value.reduce((best, slot) => statTotal(slot.player) > statTotal(best.player) ? slot : best);
		});
		const otherSlots = computed(() => recap.value.filter((slot) => slot.id !== starSlot.value?.id));
		const srAnnouncement = ref("");
		function getDailyOutcome(game) {
			const objective = game.objective;
			if (!objective) return null;
			const { value } = objective;
			if (game.status === "won") return {
				label: "Challenge won",
				tone: "win",
				detail: {
					exact: `Exact match — ${game.total} on the nose.`,
					over: `${game.total} cleared the ${value} target.`,
					under: `${game.total} — stayed under the ${value} ceiling.`,
					allUnder: `Every player stayed under ${value}.`
				}[objective.kind]
			};
			if (game.status === "bust") {
				const breachedSlot = recap.value.find((slot) => slot.player && statTotal(slot.player) >= value);
				return {
					label: "Bust",
					tone: "bust",
					detail: {
						exact: `${game.total} went over the ${value} target.`,
						over: `${game.total} went over — this objective shouldn't be able to bust.`,
						under: `${game.total} hit the ${value} ceiling.`,
						allUnder: breachedSlot ? `${breachedSlot.player.name} hit ${statTotal(breachedSlot.player)}, over the ${value} cap.` : `A player's stat reached the ${value} cap.`
					}[objective.kind]
				};
			}
			if (game.status === "lost") return {
				label: "Not quite",
				tone: "lost",
				detail: {
					exact: `${game.total} — needed exactly ${value}.`,
					over: `${game.total} — needed to clear ${value}.`,
					under: `${game.total} — this objective shouldn't be able to end in a loss.`,
					allUnder: `${game.total} — this objective shouldn't be able to end in a loss.`
				}[objective.kind]
			};
			return null;
		}
		const outcome = computed(() => {
			const game = state.value;
			if (!game) return null;
			if (game.objective) return getDailyOutcome(game);
			if (game.status === "won") return {
				label: "Champion",
				tone: "win",
				detail: `Exact match — ${game.total} on the nose.`
			};
			if (game.status === "bust") return {
				label: "Bust",
				tone: "bust",
				detail: `${game.total} went over the ${game.target} target.`
			};
			if (game.status === "finished" && game.tier) {
				const tier = TIER_COPY[game.tier];
				return {
					label: tier.label,
					tone: game.tier,
					detail: tier.detail(getDistance(game.total, game.target), game.target)
				};
			}
			return null;
		});
		const TONE_CLASS = {
			win: "win",
			championsLeague: "champions-league",
			europaLeague: "europa-league",
			midTable: "mid-table",
			avoidedRelegation: "avoided-relegation",
			relegated: "relegated",
			bust: "bust",
			lost: "lost"
		};
		const toneClass = computed(() => outcome.value ? TONE_CLASS[outcome.value.tone] : "");
		watch(outcome, (value) => {
			if (value) srAnnouncement.value = `${value.label}. ${value.detail}`;
		});
		const CONFETTI_COLORS = [
			"var(--color-primary)",
			"#ffc400",
			"#ff8a3d",
			"#4da6ff"
		];
		const confettiPieces = computed(() => {
			if (outcome.value?.tone !== "win") return [];
			return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
				id: i,
				left: `${i * 53 % 100}%`,
				color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
				delay: `${i % 6 * .08}s`,
				rotate: `${i * 47 % 360}deg`
			}));
		});
		const displayTotal = ref(0);
		let totalAnimationFrame;
		watch(outcome, (value) => {
			const game = state.value;
			if (!value || !game) return;
			if (totalAnimationFrame !== void 0) {
				cancelAnimationFrame(totalAnimationFrame);
				totalAnimationFrame = void 0;
			}
			if (value.tone !== "win" || (void 0).matchMedia("(prefers-reduced-motion: reduce)").matches) {
				displayTotal.value = game.total;
				return;
			}
			const target = game.total;
			const duration = 700;
			const start = performance.now();
			const tick = (now) => {
				const progress = Math.min((now - start) / duration, 1);
				displayTotal.value = Math.round(target * progress);
				if (progress < 1) totalAnimationFrame = requestAnimationFrame(tick);
			};
			totalAnimationFrame = requestAnimationFrame(tick);
		}, { immediate: true });
		const resultStats = computed(() => {
			const game = state.value;
			if (!game || !outcome.value) return [];
			const { objective } = game;
			if (!objective) {
				const stats = [{
					label: "Target",
					value: game.target
				}, {
					label: "Total",
					value: displayTotal.value
				}];
				if (outcome.value.tone !== "win") stats.push({
					label: "Distance",
					value: getDistance(game.total, game.target)
				});
				return stats;
			}
			const stats = [];
			if (objective.kind !== "allUnder") {
				const label = objective.kind === "exact" ? "Target" : objective.kind === "over" ? "Goal" : "Limit";
				stats.push({
					label,
					value: objective.value
				});
			}
			stats.push({
				label: "Total",
				value: displayTotal.value
			});
			return stats;
		});
		const resultEmoji = computed(() => {
			const game = state.value;
			if (!game) return "";
			if (game.status === "bust") return "💥";
			if (game.status === "won") return "🏆";
			if (game.status === "lost") return "❌";
			return game.tier ? TIER_EMOJI[game.tier] : "";
		});
		const siteConfig = useSiteConfig();
		const shareText = computed(() => {
			const game = state.value;
			if (!game) return "";
			if (game.objective) {
				const resultWord = game.status === "won" ? "WON" : game.status === "bust" ? "BUST" : "LOST";
				return `${game.dailyDate ? `Exact XI Daily · ${game.dailyDate}` : "Exact XI Challenge"} · ${resultEmoji.value} ${game.objective.label} — ${resultWord} (${game.total})\n${siteConfig.url}`;
			}
			return `Exact XI · ${game.formationCode} ${resultEmoji.value} ${game.total}/${game.target}\n${siteConfig.url}`;
		});
		const copied = ref(false);
		computed(() => {
			if (!state.value || !outcome.value) return null;
			const lines = [];
			if (starSlot.value?.player) lines.push(`Star man: ${starSlot.value.player.name} (${statTotal(starSlot.value.player)})`);
			lines.push(siteConfig.url);
			return {
				heading: outcome.value.label,
				subheading: outcome.value.detail,
				highlight: {
					label: "Total",
					value: String(displayTotal.value)
				},
				lines
			};
		});
		const shareImageLabel = ref("Share image");
		ref(false);
		function statTotal(player) {
			return player.goals + player.assists;
		}
		function statCaption(player) {
			const goalWord = player.goals === 1 ? "goal" : "goals";
			const assistWord = player.assists === 1 ? "assist" : "assists";
			return `${player.goals} ${goalWord} · ${player.assists} ${assistWord}`;
		}
		function compactStatCaption(player) {
			return `${player.goals}g · ${player.assists}a`;
		}
		return (_ctx, _push, _parent, _attrs) => {
			const _component_NuxtLink = NuxtLink;
			_push(`<!--[--><p aria-live="polite" class="result-panel__sr-announcement" data-v-5a1ebd5e>${ssrInterpolate(unref(srAnnouncement))}</p>`);
			if (unref(outcome) && unref(state)) {
				_push(`<section class="${ssrRenderClass([`result-panel--${unref(toneClass)}`, "result-panel"])}" data-v-5a1ebd5e>`);
				if (unref(confettiPieces).length > 0) {
					_push(`<div aria-hidden="true" class="result-panel__confetti" data-v-5a1ebd5e><!--[-->`);
					ssrRenderList(unref(confettiPieces), (piece) => {
						_push(`<span class="result-panel__confetti-piece" style="${ssrRenderStyle({
							"--piece-color": piece.color,
							"--piece-left": piece.left,
							"--piece-rotate": piece.rotate,
							animationDelay: piece.delay
						})}" data-v-5a1ebd5e></span>`);
					});
					_push(`<!--]--></div>`);
				} else _push(`<!---->`);
				if (unref(outcome).tone === "bust") _push(`<div aria-hidden="true" class="result-panel__stamp" data-v-5a1ebd5e>Bust</div>`);
				else _push(`<!---->`);
				_push(`<h2 class="result-panel__headline" data-v-5a1ebd5e>${ssrInterpolate(unref(outcome).label)}</h2><p class="result-panel__detail" data-v-5a1ebd5e>${ssrInterpolate(unref(outcome).detail)}</p><dl class="result-panel__stats" data-v-5a1ebd5e><!--[-->`);
				ssrRenderList(unref(resultStats), (stat) => {
					_push(`<div class="result-panel__stat" data-v-5a1ebd5e><dt data-v-5a1ebd5e>${ssrInterpolate(stat.label)}</dt><dd data-v-5a1ebd5e>${ssrInterpolate(stat.value)}</dd></div>`);
				});
				_push(`<!--]--></dl><div class="result-panel__actions" data-v-5a1ebd5e><button class="result-panel__action result-panel__action--primary" type="button" data-v-5a1ebd5e> Play again </button>`);
				if (!unref(state).objective) _push(ssrRenderComponent(_component_NuxtLink, {
					class: "result-panel__action",
					to: "/"
				}, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`Change formation`);
						else return [createTextVNode("Change formation")];
					}),
					_: 1
				}, _parent));
				else _push(`<!---->`);
				_push(`</div><div class="result-panel__share" data-v-5a1ebd5e><code class="result-panel__share-text" data-v-5a1ebd5e>${ssrInterpolate(unref(shareText))}</code><button class="result-panel__share-copy" type="button" data-v-5a1ebd5e>${ssrInterpolate(unref(copied) ? "Copied!" : "Copy")}</button></div><div class="result-panel__share-extra" data-v-5a1ebd5e><button class="result-panel__action" type="button" data-v-5a1ebd5e>${ssrInterpolate(unref(shareImageLabel))}</button></div>`);
				if (unref(starSlot)) _push(`<div class="result-panel__starman" data-v-5a1ebd5e><svg aria-hidden="true" class="result-panel__starman-icon" fill="currentColor" height="28" viewBox="0 0 24 24" width="28" data-v-5a1ebd5e><path d="M12 2l2.9 6.6L22 9.3l-5 4.8 1.3 7L12 17.8 5.7 21l1.3-7-5-4.8 7.1-0.7z" data-v-5a1ebd5e></path></svg><div class="result-panel__starman-info" data-v-5a1ebd5e><p class="result-panel__starman-label" data-v-5a1ebd5e> Star man · ${ssrInterpolate(unref(getSlotShortLabel)(unref(starSlot).group, unref(starSlot).side, unref(starSlot).rowSize))}</p><p class="result-panel__starman-name" data-v-5a1ebd5e>${ssrInterpolate(unref(starSlot).player?.name)}</p><p class="result-panel__starman-caption" data-v-5a1ebd5e>${ssrInterpolate(statCaption(unref(starSlot).player))}</p></div><span class="result-panel__starman-total" data-v-5a1ebd5e>${ssrInterpolate(statTotal(unref(starSlot).player))}</span></div>`);
				else _push(`<!---->`);
				_push(`<ol class="result-panel__recap" data-v-5a1ebd5e><!--[-->`);
				ssrRenderList(unref(otherSlots), (slot) => {
					_push(`<li class="result-panel__recap-item" data-v-5a1ebd5e><span class="result-panel__recap-role" data-v-5a1ebd5e>${ssrInterpolate(unref(getSlotShortLabel)(slot.group, slot.side, slot.rowSize))}</span><span class="result-panel__recap-name" data-v-5a1ebd5e>${ssrInterpolate(slot.player?.name)}</span><span class="result-panel__recap-caption" data-v-5a1ebd5e>${ssrInterpolate(compactStatCaption(slot.player))}</span><span class="result-panel__recap-total" data-v-5a1ebd5e>${ssrInterpolate(statTotal(slot.player))}</span></li>`);
				});
				_push(`<!--]--></ol></section>`);
			} else _push(`<!---->`);
			_push(`<!--]-->`);
		};
	}
});
//#endregion
//#region app/components/ResultPanel.vue
var _sfc_setup$3 = ResultPanel_vue_vue_type_script_setup_true_lang_default.setup;
ResultPanel_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/ResultPanel.vue");
	return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
var ResultPanel_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(ResultPanel_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-5a1ebd5e"]]), { __name: "ResultPanel" });
//#endregion
//#region app/components/Pitch.vue?vue&type=script&setup=true&lang.ts
var Pitch_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "Pitch",
	__ssrInlineRender: true,
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				class: "pitch",
				preserveAspectRatio: "none",
				viewBox: "0 0 100 100"
			}, _attrs))} data-v-1c9c0bbd><rect class="pitch__line" height="96" width="96" x="2" y="2" data-v-1c9c0bbd></rect><line class="pitch__line" x1="2" x2="98" y1="50" y2="50" data-v-1c9c0bbd></line><circle class="pitch__line" cx="50" cy="50" r="10" data-v-1c9c0bbd></circle><rect class="pitch__line" height="18" width="50" x="25" y="2" data-v-1c9c0bbd></rect><rect class="pitch__line" height="7" width="24" x="38" y="2" data-v-1c9c0bbd></rect><rect class="pitch__line" height="18" width="50" x="25" y="80" data-v-1c9c0bbd></rect><rect class="pitch__line" height="7" width="24" x="38" y="91" data-v-1c9c0bbd></rect><circle class="pitch__spot" cx="50" cy="50" r="0.8" data-v-1c9c0bbd></circle><circle class="pitch__spot" cx="50" cy="14" r="0.8" data-v-1c9c0bbd></circle><circle class="pitch__spot" cx="50" cy="86" r="0.8" data-v-1c9c0bbd></circle></svg>`);
		};
	}
});
//#endregion
//#region app/components/Pitch.vue
var _sfc_setup$2 = Pitch_vue_vue_type_script_setup_true_lang_default.setup;
Pitch_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/Pitch.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var Pitch_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(Pitch_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-1c9c0bbd"]]), { __name: "Pitch" });
//#endregion
//#region app/utils/playerName.ts
var SURNAME_CONNECTORS = /* @__PURE__ */ new Set([
	"de",
	"da",
	"do",
	"dos",
	"das",
	"van",
	"von",
	"al",
	"bin",
	"el",
	"der",
	"den",
	"la",
	"le",
	"du",
	"ter"
]);
var SURNAME_SUFFIXES = /* @__PURE__ */ new Set([
	"junior",
	"jr",
	"jnr",
	"neto",
	"filho"
]);
function shortenPlayerName(fullName) {
	const parts = fullName.trim().split(/\s+/);
	if (parts.length <= 1) return fullName;
	const firstInitial = parts[0].charAt(0).toUpperCase();
	let surnameEnd = parts.length;
	while (surnameEnd > 2 && SURNAME_SUFFIXES.has(parts[surnameEnd - 1].toLowerCase())) surnameEnd -= 1;
	let surnameStart = surnameEnd - 1;
	while (surnameStart > 1 && SURNAME_CONNECTORS.has(parts[surnameStart - 1].toLowerCase())) surnameStart -= 1;
	return `${firstInitial}. ${parts.slice(surnameStart).join(" ")}`;
}
//#endregion
//#region app/components/PositionSlot.vue?vue&type=script&setup=true&lang.ts
var PositionSlot_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "PositionSlot",
	__ssrInlineRender: true,
	props: {
		slotData: {},
		busy: { type: Boolean },
		loading: { type: Boolean },
		gameOver: { type: Boolean }
	},
	emits: ["select"],
	setup(__props, { emit: __emit }) {
		const props = __props;
		const description = computed(() => describeSlotRole(props.slotData.group, props.slotData.side, props.slotData.rowSize));
		const shortLabel = computed(() => getSlotShortLabel(props.slotData.group, props.slotData.side, props.slotData.rowSize));
		const label = computed(() => {
			if (!props.slotData.player) return `${description.value}, empty`;
			return props.slotData.preset ? `${description.value}, ${props.slotData.player.name}, pre-filled for today` : `${description.value}, ${props.slotData.player.name}`;
		});
		const isEndedEmpty = computed(() => Boolean(props.gameOver) && !props.slotData.player);
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<button${ssrRenderAttrs(mergeProps({
				"aria-label": unref(label),
				class: ["position-slot", {
					"position-slot--ended": unref(isEndedEmpty),
					"position-slot--filled": __props.slotData.player,
					"position-slot--loading": __props.loading,
					"position-slot--tight": __props.slotData.rowSize >= 5
				}],
				disabled: Boolean(__props.slotData.player) || __props.busy,
				style: {
					left: `${__props.slotData.x}%`,
					top: `${__props.slotData.y}%`
				},
				type: "button"
			}, _attrs))} data-v-f5bf9689>`);
			if (__props.slotData.player) {
				_push(`<!--[-->`);
				if (__props.slotData.preset) _push(`<span aria-hidden="true" class="position-slot__preset" title="Pre-filled for today&#39;s Daily Challenge" data-v-f5bf9689>★</span>`);
				else _push(`<!---->`);
				_push(`<span class="position-slot__total" data-v-f5bf9689>${ssrInterpolate(__props.slotData.player.goals + __props.slotData.player.assists)}</span><span class="position-slot__name" data-v-f5bf9689>${ssrInterpolate(unref(shortenPlayerName)(__props.slotData.player.name))}</span><!--]-->`);
			} else _push(`<span class="position-slot__group" data-v-f5bf9689>${ssrInterpolate(unref(isEndedEmpty) ? "—" : unref(shortLabel))}</span>`);
			_push(`</button>`);
		};
	}
});
//#endregion
//#region app/components/PositionSlot.vue
var _sfc_setup$1 = PositionSlot_vue_vue_type_script_setup_true_lang_default.setup;
PositionSlot_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/PositionSlot.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var PositionSlot_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(PositionSlot_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-f5bf9689"]]), { __name: "PositionSlot" });
//#endregion
//#region app/components/PlayerChoiceDialog.vue?vue&type=script&setup=true&lang.ts
var SCRAMBLE_TICK_MS = 60;
var PlayerChoiceDialog_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "PlayerChoiceDialog",
	__ssrInlineRender: true,
	setup(__props) {
		const { state, isDrawing} = useGame();
		const candidates = computed(() => state.value?.offeredPlayers ?? []);
		const rerollsLeft = computed(() => state.value?.rerollsLeft ?? 0);
		const POSITION_NOUNS = {
			GK: "goalkeeper",
			DEF: "defender",
			MID: "midfielder",
			FWD: "forward"
		};
		const positionScopeNote = computed(() => {
			const group = state.value?.slots.find((slot) => slot.id === state.value?.activeSlotId)?.group;
			const base = `Any real ${group ? POSITION_NOUNS[group] : "player"} can turn up here — not narrowed to this exact tactical slot.`;
			return group === "GK" ? `${base} Goalkeepers rarely score or assist, so this pick is usually low-stakes.` : base;
		});
		const dialogRef = ref(null);
		const titleId = useId();
		const revealing = ref(false);
		const showResult = ref(false);
		const revealedName = ref("");
		const displayValue = ref(0);
		const srAnnouncement = ref("");
		const pickError = ref(false);
		const revealFlavor = ref(null);
		const pickedId = ref(null);
		const FILLER_SURNAMES = [
			"Whitfield",
			"Bergqvist",
			"Okafor",
			"Marchetti",
			"Ivanov",
			"Delacroix",
			"Haraldsson",
			"Kowalczyk",
			"Nakashima",
			"Ferreira"
		];
		const FILLER_CLUBS = [
			"Ashford Rovers",
			"Kestrel Town",
			"Marlowe Athletic",
			"Redgate United",
			"Fenbridge City",
			"Harrow Vale",
			"Thornfield Wanderers",
			"Quarrymoor FC"
		];
		function randomFiller(pool) {
			return pool[Math.floor(Math.random() * pool.length)] ?? "";
		}
		const displayNames = ref([]);
		const displayMeta = ref([]);
		const settled = ref([]);
		const isScrambling = computed(() => settled.value.some((flag) => !flag));
		watch(isScrambling, (scrambling, wasScrambling) => {
			if (wasScrambling && !scrambling) srAnnouncement.value = "Players ready";
		});
		let scrambleFrame = null;
		function stopScramble() {
			if (scrambleFrame !== null) {
				(void 0).cancelAnimationFrame(scrambleFrame);
				scrambleFrame = null;
			}
		}
		function startScramble(items) {
			stopScramble();
			if ((void 0).matchMedia("(prefers-reduced-motion: reduce)").matches) {
				displayNames.value = items.map((item) => item.name);
				displayMeta.value = items.map((item) => eraLabel(item));
				settled.value = items.map(() => true);
				return;
			}
			displayNames.value = items.map(() => randomFiller(FILLER_SURNAMES));
			displayMeta.value = items.map(() => randomFiller(FILLER_CLUBS));
			settled.value = items.map(() => false);
			const start = performance.now();
			const settleAt = items.map((_, index) => 500 + index * 150);
			const lastTickAt = items.map(() => 0);
			function tick(now) {
				const elapsed = now - start;
				let stillScrambling = false;
				items.forEach((item, index) => {
					if (settled.value[index]) return;
					if (elapsed >= settleAt[index]) {
						displayNames.value[index] = item.name;
						displayMeta.value[index] = eraLabel(item);
						settled.value[index] = true;
						return;
					}
					stillScrambling = true;
					if (elapsed - lastTickAt[index] >= SCRAMBLE_TICK_MS) {
						displayNames.value[index] = randomFiller(FILLER_SURNAMES);
						displayMeta.value[index] = randomFiller(FILLER_CLUBS);
						lastTickAt[index] = elapsed;
					}
				});
				scrambleFrame = stillScrambling ? (void 0).requestAnimationFrame(tick) : null;
			}
			scrambleFrame = (void 0).requestAnimationFrame(tick);
		}
		watch(candidates, (items) => {
			if (items.length > 0) {
				startScramble(items);
				pickedId.value = null;
			}
		}, { immediate: true });
		function eraLabel(candidate) {
			return `${candidate.clubs.join(", ")} · ${candidate.firstSeason}-${candidate.lastSeason}`;
		}
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<dialog${ssrRenderAttrs(mergeProps({
				ref_key: "dialogRef",
				ref: dialogRef,
				"aria-labelledby": unref(titleId),
				class: "player-choice"
			}, _attrs))} data-v-302d4860><div aria-hidden="true" class="player-choice__handle" data-v-302d4860></div><h2${ssrRenderAttr("id", unref(titleId))} class="player-choice__title" data-v-302d4860>Pick a player</h2><p aria-live="polite" class="player-choice__sr-announcement" data-v-302d4860>${ssrInterpolate(unref(srAnnouncement))}</p>`);
			if (!unref(showResult)) _push(`<p class="player-choice__scope-note" data-v-302d4860>${ssrInterpolate(unref(positionScopeNote))}</p>`);
			else _push(`<!---->`);
			if (!unref(showResult)) {
				_push(`<ul class="player-choice__list" data-v-302d4860><!--[-->`);
				ssrRenderList(unref(candidates), (candidate, index) => {
					_push(`<li data-v-302d4860><button${ssrRenderAttr("aria-disabled", unref(revealing) || unref(isDrawing) || unref(isScrambling))}${ssrRenderAttr("aria-label", unref(settled)[index] ? `${candidate.name} — ${eraLabel(candidate)}` : "Loading option")} class="${ssrRenderClass([{
						"player-choice__option--picked": unref(pickedId) === candidate.id,
						"player-choice__option--scrambling": !unref(settled)[index]
					}, "player-choice__option"])}" type="button" data-v-302d4860><span aria-hidden="true" class="player-choice__name" data-v-302d4860>${ssrInterpolate(unref(displayNames)[index])}</span><span aria-hidden="true" class="player-choice__meta" data-v-302d4860>${ssrInterpolate(unref(displayMeta)[index])}</span></button></li>`);
				});
				_push(`<!--]--></ul>`);
			} else _push(`<!---->`);
			if (unref(pickError) && !unref(showResult)) _push(`<p aria-live="polite" class="player-choice__error" data-v-302d4860> Couldn&#39;t reveal that pick — tap the player again to retry. </p>`);
			else _push(`<!---->`);
			if (unref(showResult)) {
				_push(`<div class="player-choice__result" data-v-302d4860><p class="player-choice__result-name" data-v-302d4860>${ssrInterpolate(unref(revealedName))}</p><p aria-hidden="true" class="player-choice__result-value" data-v-302d4860>${ssrInterpolate(unref(displayValue))}</p>`);
				if (unref(revealFlavor)) _push(`<p aria-hidden="true" class="player-choice__result-flavor" data-v-302d4860>${ssrInterpolate(unref(revealFlavor))}</p>`);
				else _push(`<!---->`);
				_push(`</div>`);
			} else _push(`<!---->`);
			if (!unref(showResult)) _push(`<button class="player-choice__reroll"${ssrRenderAttr("aria-disabled", unref(rerollsLeft) <= 0 || unref(revealing) || unref(isDrawing) || unref(isScrambling))} type="button" data-v-302d4860> Reroll (${ssrInterpolate(unref(rerollsLeft))} left) </button>`);
			else _push(`<!---->`);
			_push(`</dialog>`);
		};
	}
});
//#endregion
//#region app/components/PlayerChoiceDialog.vue
var _sfc_setup = PlayerChoiceDialog_vue_vue_type_script_setup_true_lang_default.setup;
PlayerChoiceDialog_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/PlayerChoiceDialog.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var PlayerChoiceDialog_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(PlayerChoiceDialog_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-302d4860"]]), { __name: "PlayerChoiceDialog" });

export { Pitch_default as P, ResultPanel_default as R, ScoreBar_default as S, PositionSlot_default as a, PlayerChoiceDialog_default as b, useGame as u };
//# sourceMappingURL=PlayerChoiceDialog-DYcTtwFE.mjs.map
