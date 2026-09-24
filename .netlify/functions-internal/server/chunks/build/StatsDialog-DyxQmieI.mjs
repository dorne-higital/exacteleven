import { _ as _plugin_vue_export_helper_default, c as useStats, l as formations, F as FORMATION_DIFFICULTY, m as getAchievementProgress, T as TIERS, n as AchievementBadge_default } from '../virtual/entry.mjs';
import { H as HowToPlayContent_default } from './HowToPlayContent-BkuU9Xg_.mjs';
import { defineComponent, useModel, mergeProps, withCtx, createVNode, ref, computed, unref, toDisplayString, openBlock, createBlock, Fragment, createTextVNode, createCommentVNode, renderList, useId, watch, mergeModels, useSSRContext } from 'vue';
import { ssrRenderComponent, ssrRenderClass, ssrInterpolate, ssrRenderList, ssrRenderStyle, ssrRenderAttr, ssrRenderAttrs, ssrRenderSlot } from 'vue/server-renderer';

//#region app/utils/analytics.ts
function trackEvent(name, params = {}) {}
//#endregion
//#region app/components/CenteredDialog.vue?vue&type=script&setup=true&lang.ts
var CenteredDialog_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "CenteredDialog",
	__ssrInlineRender: true,
	props: /*@__PURE__*/ mergeModels({ title: {} }, {
		"open": {
			type: Boolean,
			default: false
		},
		"openModifiers": {}
	}),
	emits: ["update:open"],
	setup(__props) {
		const open = useModel(__props, "open");
		const dialogRef = ref(null);
		const titleId = useId();
		watch(open, (isOpen) => {
			if (isOpen) dialogRef.value?.showModal();
			else dialogRef.value?.close();
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<dialog${ssrRenderAttrs(mergeProps({
				ref_key: "dialogRef",
				ref: dialogRef,
				"aria-labelledby": unref(titleId),
				class: "centered-dialog"
			}, _attrs))} data-v-6b8e572c><div class="centered-dialog__header" data-v-6b8e572c><h2${ssrRenderAttr("id", unref(titleId))} class="centered-dialog__title" data-v-6b8e572c>${ssrInterpolate(__props.title)}</h2><button aria-label="Close" class="centered-dialog__close" type="button" data-v-6b8e572c><svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16" data-v-6b8e572c><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-linecap="round" stroke-width="2" data-v-6b8e572c></path></svg></button></div>`);
			ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
			_push(`</dialog>`);
		};
	}
});
//#endregion
//#region app/components/CenteredDialog.vue
var _sfc_setup$2 = CenteredDialog_vue_vue_type_script_setup_true_lang_default.setup;
CenteredDialog_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/CenteredDialog.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var CenteredDialog_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(CenteredDialog_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-6b8e572c"]]), { __name: "CenteredDialog" });
//#endregion
//#region app/components/InfoDialog.vue?vue&type=script&setup=true&lang.ts
var InfoDialog_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "InfoDialog",
	__ssrInlineRender: true,
	props: {
		"open": {
			type: Boolean,
			default: false
		},
		"openModifiers": {}
	},
	emits: ["update:open"],
	setup(__props) {
		const open = useModel(__props, "open");
		return (_ctx, _push, _parent, _attrs) => {
			const _component_CenteredDialog = CenteredDialog_default;
			const _component_HowToPlayContent = HowToPlayContent_default;
			_push(ssrRenderComponent(_component_CenteredDialog, mergeProps({
				open: open.value,
				"onUpdate:open": ($event) => open.value = $event,
				title: "How to play"
			}, _attrs), {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(ssrRenderComponent(_component_HowToPlayContent, null, null, _parent, _scopeId));
					else return [createVNode(_component_HowToPlayContent)];
				}),
				_: 1
			}, _parent));
		};
	}
});
//#endregion
//#region app/components/InfoDialog.vue
var _sfc_setup$1 = InfoDialog_vue_vue_type_script_setup_true_lang_default.setup;
InfoDialog_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/InfoDialog.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var InfoDialog_default = Object.assign(InfoDialog_vue_vue_type_script_setup_true_lang_default, { __name: "InfoDialog" });
//#endregion
//#region app/components/StatsDialog.vue?vue&type=script&setup=true&lang.ts
var StatsDialog_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "StatsDialog",
	__ssrInlineRender: true,
	props: {
		"open": {
			type: Boolean,
			default: false
		},
		"openModifiers": {}
	},
	emits: ["update:open"],
	setup(__props) {
		const open = useModel(__props, "open");
		const { stats, resetStats } = useStats();
		const activeTab = ref("stats");
		const BAR_ROWS = [
			{
				outcome: "champion",
				label: "Champion",
				colorClass: "win",
				countKey: "wins"
			},
			{
				outcome: "championsLeague",
				label: "Champions League",
				colorClass: "champions-league",
				countKey: "championsLeague"
			},
			{
				outcome: "europaLeague",
				label: "Europa League",
				colorClass: "europa-league",
				countKey: "europaLeague"
			},
			{
				outcome: "midTable",
				label: "Mid-table",
				colorClass: "mid-table",
				countKey: "midTable"
			},
			{
				outcome: "avoidedRelegation",
				label: "Avoided relegation",
				colorClass: "avoided-relegation",
				countKey: "avoidedRelegation"
			},
			{
				outcome: "relegated",
				label: "Relegated",
				colorClass: "relegated",
				countKey: "relegated"
			}
		];
		const winRate = computed(() => stats.value.gamesPlayed > 0 ? Math.round(stats.value.wins / stats.value.gamesPlayed * 100) : 0);
		function barPercent(count) {
			return stats.value.gamesPlayed > 0 ? count / stats.value.gamesPlayed * 100 : 0;
		}
		const bestResultLabel = computed(() => {
			const best = stats.value.bestResult;
			if (!best) return null;
			const row = BAR_ROWS.find((candidate) => candidate.outcome === best.outcome);
			return `${row ? row.label : "Bust"} — ${best.formationCode}`;
		});
		const formationRows = computed(() => formations.map((formation) => ({
			code: formation.code,
			count: stats.value.formationPlays[formation.code],
			tier: FORMATION_DIFFICULTY[formation.code].tier
		})).sort((a, b) => b.count - a.count));
		const mostPlayed = computed(() => {
			const top = formationRows.value[0];
			return top && top.count > 0 ? top.code : null;
		});
		function toSection(key, title, achievements) {
			return {
				key,
				title,
				achievements,
				next: achievements.find((progress) => !progress.unlocked) ?? null
			};
		}
		const achievementSections = computed(() => {
			const progress = getAchievementProgress(stats.value);
			const byCategory = (category, subKind) => progress.filter((p) => p.def.category === category && (subKind === void 0 || p.def.subKind === subKind));
			return [
				toSection("games-played", "Games Played", byCategory("gamesPlayed")),
				toSection("games-won", "Exact Wins", byCategory("gamesWon")),
				...TIERS.map((tier) => toSection(`tier-${tier.key}`, tier.label, byCategory("tier", tier.key))),
				...formations.map((formation) => toSection(`formation-${formation.code}`, `${formation.code} Wins`, byCategory("formationWin", formation.code))),
				toSection("daily-streak", "Daily Streak", byCategory("dailyStreak"))
			];
		});
		const achievementSummary = computed(() => {
			const all = achievementSections.value.flatMap((section) => section.achievements);
			return {
				unlocked: all.filter((progress) => progress.unlocked).length,
				total: all.length
			};
		});
		function badgeLabel(progress) {
			const status = progress.unlocked ? "Unlocked" : `Locked — ${progress.current} of ${progress.def.threshold}`;
			return `${progress.def.label}. ${status}. ${progress.def.description}`;
		}
		function handleReset() {
			resetStats();
		}
		return (_ctx, _push, _parent, _attrs) => {
			const _component_CenteredDialog = CenteredDialog_default;
			const _component_AchievementBadge = AchievementBadge_default;
			_push(ssrRenderComponent(_component_CenteredDialog, mergeProps({
				open: open.value,
				"onUpdate:open": ($event) => open.value = $event,
				title: "Your stats"
			}, _attrs), {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<div class="stats-dialog__tabs" role="tablist" data-v-b46e0f0b${_scopeId}><button aria-selected="true" class="${ssrRenderClass([{ "stats-dialog__tab--active": unref(activeTab) === "stats" }, "stats-dialog__tab"])}" role="tab" type="button" data-v-b46e0f0b${_scopeId}> Stats </button><button aria-selected="false" class="${ssrRenderClass([{ "stats-dialog__tab--active": unref(activeTab) === "achievements" }, "stats-dialog__tab"])}" role="tab" type="button" data-v-b46e0f0b${_scopeId}> Achievements (${ssrInterpolate(unref(achievementSummary).unlocked)}/${ssrInterpolate(unref(achievementSummary).total)}) </button></div>`);
						if (unref(activeTab) === "stats") {
							_push(`<!--[--><div class="stats-dialog__hero" data-v-b46e0f0b${_scopeId}><div class="stats-dialog__hero-stat" data-v-b46e0f0b${_scopeId}><span class="stats-dialog__hero-value" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(unref(stats).gamesPlayed)}</span><span class="stats-dialog__hero-label" data-v-b46e0f0b${_scopeId}>Games played</span></div><div class="stats-dialog__hero-stat" data-v-b46e0f0b${_scopeId}><span class="stats-dialog__hero-value" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(unref(winRate))}%</span><span class="stats-dialog__hero-label" data-v-b46e0f0b${_scopeId}>Win rate</span></div><div class="stats-dialog__hero-stat" data-v-b46e0f0b${_scopeId}><span class="stats-dialog__hero-value" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(unref(stats).dailyStreak)}</span><span class="stats-dialog__hero-label" data-v-b46e0f0b${_scopeId}>Daily streak</span></div></div>`);
							if (unref(bestResultLabel)) _push(`<p class="stats-dialog__best" data-v-b46e0f0b${_scopeId}><strong data-v-b46e0f0b${_scopeId}>Best:</strong> ${ssrInterpolate(unref(bestResultLabel))}</p>`);
							else _push(`<!---->`);
							_push(`<div class="stats-dialog__bars" data-v-b46e0f0b${_scopeId}><!--[-->`);
							ssrRenderList(BAR_ROWS, (row) => {
								_push(`<div class="stats-dialog__bar-row" data-v-b46e0f0b${_scopeId}><span class="stats-dialog__bar-label" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(row.label)}</span><div class="stats-dialog__bar-track" data-v-b46e0f0b${_scopeId}><div class="${ssrRenderClass([`stats-dialog__bar-fill--${row.colorClass}`, "stats-dialog__bar-fill"])}" style="${ssrRenderStyle({ width: `${barPercent(unref(stats)[row.countKey])}%` })}" data-v-b46e0f0b${_scopeId}></div></div><span class="stats-dialog__bar-count" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(unref(stats)[row.countKey])}</span></div>`);
							});
							_push(`<!--]--><div class="stats-dialog__bar-row" data-v-b46e0f0b${_scopeId}><span class="stats-dialog__bar-label" data-v-b46e0f0b${_scopeId}>Bust</span><div class="stats-dialog__bar-track" data-v-b46e0f0b${_scopeId}><div class="stats-dialog__bar-fill stats-dialog__bar-fill--bust" style="${ssrRenderStyle({ width: `${barPercent(unref(stats).busts)}%` })}" data-v-b46e0f0b${_scopeId}></div></div><span class="stats-dialog__bar-count" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(unref(stats).busts)}</span></div></div>`);
							if (unref(mostPlayed)) {
								_push(`<div class="stats-dialog__formations" data-v-b46e0f0b${_scopeId}><p class="stats-dialog__formations-heading" data-v-b46e0f0b${_scopeId}>Most played: ${ssrInterpolate(unref(mostPlayed))}</p><div class="stats-dialog__bars" data-v-b46e0f0b${_scopeId}><!--[-->`);
								ssrRenderList(unref(formationRows), (row) => {
									_push(`<div class="stats-dialog__bar-row" data-v-b46e0f0b${_scopeId}><span class="stats-dialog__bar-label" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(row.code)}</span><div class="stats-dialog__bar-track" data-v-b46e0f0b${_scopeId}><div class="${ssrRenderClass([`stats-dialog__formation-fill--${row.tier}`, "stats-dialog__bar-fill"])}" style="${ssrRenderStyle({ width: `${barPercent(row.count)}%` })}" data-v-b46e0f0b${_scopeId}></div></div><span class="stats-dialog__bar-count" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(row.count)}</span></div>`);
								});
								_push(`<!--]--></div></div>`);
							} else _push(`<!---->`);
							_push(`<button class="stats-dialog__reset" type="button" data-v-b46e0f0b${_scopeId}>Reset stats</button><!--]-->`);
						} else {
							_push(`<div class="achievements-tab" data-v-b46e0f0b${_scopeId}><p class="achievements-tab__intro" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(unref(achievementSummary).unlocked)} of ${ssrInterpolate(unref(achievementSummary).total)} unlocked — badges gray out until you reach them, so you can always see what&#39;s next. </p><!--[-->`);
							ssrRenderList(unref(achievementSections), (section) => {
								_push(`<div class="achievements-tab__section" data-v-b46e0f0b${_scopeId}><p class="achievements-tab__section-title" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(section.title)} `);
								if (section.next) _push(`<span class="achievements-tab__section-next" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(section.next.current)}/${ssrInterpolate(section.next.def.threshold)}</span>`);
								else _push(`<!---->`);
								_push(`</p><div class="achievements-tab__grid" data-v-b46e0f0b${_scopeId}><!--[-->`);
								ssrRenderList(section.achievements, (progress) => {
									_push(`<div class="achievements-tab__badge"${ssrRenderAttr("title", badgeLabel(progress))} data-v-b46e0f0b${_scopeId}>`);
									_push(ssrRenderComponent(_component_AchievementBadge, {
										category: progress.def.category,
										rank: progress.def.rank,
										threshold: progress.def.threshold,
										unlocked: progress.unlocked
									}, null, _parent, _scopeId));
									_push(`<span class="achievements-tab__badge-sr" data-v-b46e0f0b${_scopeId}>${ssrInterpolate(badgeLabel(progress))}</span></div>`);
								});
								_push(`<!--]--></div></div>`);
							});
							_push(`<!--]--></div>`);
						}
					} else return [createVNode("div", {
						class: "stats-dialog__tabs",
						role: "tablist"
					}, [createVNode("button", {
						"aria-selected": "true",
						class: ["stats-dialog__tab", { "stats-dialog__tab--active": unref(activeTab) === "stats" }],
						role: "tab",
						type: "button",
						onClick: ($event) => activeTab.value = "stats"
					}, " Stats ", 10, ["onClick"]), createVNode("button", {
						"aria-selected": "false",
						class: ["stats-dialog__tab", { "stats-dialog__tab--active": unref(activeTab) === "achievements" }],
						role: "tab",
						type: "button",
						onClick: ($event) => activeTab.value = "achievements"
					}, " Achievements (" + toDisplayString(unref(achievementSummary).unlocked) + "/" + toDisplayString(unref(achievementSummary).total) + ") ", 11, ["onClick"])]), unref(activeTab) === "stats" ? (openBlock(), createBlock(Fragment, { key: 0 }, [
						createVNode("div", { class: "stats-dialog__hero" }, [
							createVNode("div", { class: "stats-dialog__hero-stat" }, [createVNode("span", { class: "stats-dialog__hero-value" }, toDisplayString(unref(stats).gamesPlayed), 1), createVNode("span", { class: "stats-dialog__hero-label" }, "Games played")]),
							createVNode("div", { class: "stats-dialog__hero-stat" }, [createVNode("span", { class: "stats-dialog__hero-value" }, toDisplayString(unref(winRate)) + "%", 1), createVNode("span", { class: "stats-dialog__hero-label" }, "Win rate")]),
							createVNode("div", { class: "stats-dialog__hero-stat" }, [createVNode("span", { class: "stats-dialog__hero-value" }, toDisplayString(unref(stats).dailyStreak), 1), createVNode("span", { class: "stats-dialog__hero-label" }, "Daily streak")])
						]),
						unref(bestResultLabel) ? (openBlock(), createBlock("p", {
							key: 0,
							class: "stats-dialog__best"
						}, [createVNode("strong", null, "Best:"), createTextVNode(" " + toDisplayString(unref(bestResultLabel)), 1)])) : createCommentVNode("", true),
						createVNode("div", { class: "stats-dialog__bars" }, [(openBlock(), createBlock(Fragment, null, renderList(BAR_ROWS, (row) => {
							return createVNode("div", {
								key: row.outcome,
								class: "stats-dialog__bar-row"
							}, [
								createVNode("span", { class: "stats-dialog__bar-label" }, toDisplayString(row.label), 1),
								createVNode("div", { class: "stats-dialog__bar-track" }, [createVNode("div", {
									class: ["stats-dialog__bar-fill", `stats-dialog__bar-fill--${row.colorClass}`],
									style: { width: `${barPercent(unref(stats)[row.countKey])}%` }
								}, null, 6)]),
								createVNode("span", { class: "stats-dialog__bar-count" }, toDisplayString(unref(stats)[row.countKey]), 1)
							]);
						}), 64)), createVNode("div", { class: "stats-dialog__bar-row" }, [
							createVNode("span", { class: "stats-dialog__bar-label" }, "Bust"),
							createVNode("div", { class: "stats-dialog__bar-track" }, [createVNode("div", {
								class: "stats-dialog__bar-fill stats-dialog__bar-fill--bust",
								style: { width: `${barPercent(unref(stats).busts)}%` }
							}, null, 4)]),
							createVNode("span", { class: "stats-dialog__bar-count" }, toDisplayString(unref(stats).busts), 1)
						])]),
						unref(mostPlayed) ? (openBlock(), createBlock("div", {
							key: 1,
							class: "stats-dialog__formations"
						}, [createVNode("p", { class: "stats-dialog__formations-heading" }, "Most played: " + toDisplayString(unref(mostPlayed)), 1), createVNode("div", { class: "stats-dialog__bars" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(formationRows), (row) => {
							return openBlock(), createBlock("div", {
								key: row.code,
								class: "stats-dialog__bar-row"
							}, [
								createVNode("span", { class: "stats-dialog__bar-label" }, toDisplayString(row.code), 1),
								createVNode("div", { class: "stats-dialog__bar-track" }, [createVNode("div", {
									class: ["stats-dialog__bar-fill", `stats-dialog__formation-fill--${row.tier}`],
									style: { width: `${barPercent(row.count)}%` }
								}, null, 6)]),
								createVNode("span", { class: "stats-dialog__bar-count" }, toDisplayString(row.count), 1)
							]);
						}), 128))])])) : createCommentVNode("", true),
						createVNode("button", {
							class: "stats-dialog__reset",
							type: "button",
							onClick: handleReset
						}, "Reset stats")
					], 64)) : (openBlock(), createBlock("div", {
						key: 1,
						class: "achievements-tab"
					}, [createVNode("p", { class: "achievements-tab__intro" }, toDisplayString(unref(achievementSummary).unlocked) + " of " + toDisplayString(unref(achievementSummary).total) + " unlocked — badges gray out until you reach them, so you can always see what's next. ", 1), (openBlock(true), createBlock(Fragment, null, renderList(unref(achievementSections), (section) => {
						return openBlock(), createBlock("div", {
							key: section.key,
							class: "achievements-tab__section"
						}, [createVNode("p", { class: "achievements-tab__section-title" }, [createTextVNode(toDisplayString(section.title) + " ", 1), section.next ? (openBlock(), createBlock("span", {
							key: 0,
							class: "achievements-tab__section-next"
						}, toDisplayString(section.next.current) + "/" + toDisplayString(section.next.def.threshold), 1)) : createCommentVNode("", true)]), createVNode("div", { class: "achievements-tab__grid" }, [(openBlock(true), createBlock(Fragment, null, renderList(section.achievements, (progress) => {
							return openBlock(), createBlock("div", {
								key: progress.def.id,
								class: "achievements-tab__badge",
								title: badgeLabel(progress)
							}, [createVNode(_component_AchievementBadge, {
								category: progress.def.category,
								rank: progress.def.rank,
								threshold: progress.def.threshold,
								unlocked: progress.unlocked
							}, null, 8, [
								"category",
								"rank",
								"threshold",
								"unlocked"
							]), createVNode("span", { class: "achievements-tab__badge-sr" }, toDisplayString(badgeLabel(progress)), 1)], 8, ["title"]);
						}), 128))])]);
					}), 128))]))];
				}),
				_: 1
			}, _parent));
		};
	}
});
//#endregion
//#region app/components/StatsDialog.vue
var _sfc_setup = StatsDialog_vue_vue_type_script_setup_true_lang_default.setup;
StatsDialog_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/StatsDialog.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var StatsDialog_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(StatsDialog_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-b46e0f0b"]]), { __name: "StatsDialog" });

export { CenteredDialog_default as C, InfoDialog_default as I, StatsDialog_default as S, trackEvent as t };
//# sourceMappingURL=StatsDialog-DyxQmieI.mjs.map
