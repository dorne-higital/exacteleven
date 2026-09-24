import { _ as _plugin_vue_export_helper_default, a as useHead$1, A as AppIcon_default, N as NuxtLink, l as formations, F as FORMATION_DIFFICULTY, h as useSiteConfig, i as getSlotShortLabel, $ as $fetch$2 } from '../virtual/entry.mjs';
import { I as InfoDialog_default, S as StatsDialog_default, C as CenteredDialog_default, t as trackEvent } from './StatsDialog-DyxQmieI.mjs';
import { A as AppHeader_default, T as ThemeToggle_default } from './HowToPlayContent-BkuU9Xg_.mjs';
import { b as buildChallengeQuery } from './challenge-config--UdGTplH.mjs';
import { defineComponent, ref, mergeProps, withCtx, createVNode, unref, toDisplayString, isRef, useModel, computed, watch, openBlock, createBlock, Fragment, renderList, createCommentVNode, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderList, ssrInterpolate, ssrRenderClass, ssrRenderAttr, ssrIncludeBooleanAttr } from 'vue/server-renderer';
import { P as objectiveValueOptions } from '../nitro/nitro.mjs';
import 'nostics';
import 'nostics/formatters/ansi';
import '../routes/renderer.mjs';
import 'unhead/server';
import 'unhead/legacy';
import 'unhead/plugins';
import 'vue-bundle-renderer/runtime';
import 'devalue';
import 'unhead/utils';
import 'vue-router';
import 'fnv1a-64';
import 'object-identity';
import '@vue/shared';
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

//#region app/components/FormationIcon.vue?vue&type=script&setup=true&lang.ts
var FormationIcon_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "FormationIcon",
	__ssrInlineRender: true,
	props: { slots: {} },
	setup(__props) {
		const ROW_LINE_Y = [
			14.28,
			27.16,
			38.2,
			48.32
		];
		function mapX(x) {
			return 6 + x / 100 * 44;
		}
		function mapY(y) {
			return 6 + y / 100 * 46;
		}
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				class: "formation-icon",
				viewBox: "0 0 56 60"
			}, _attrs))} data-v-4ccdd035><!--[-->`);
			ssrRenderList(ROW_LINE_Y, (y) => {
				_push(`<line class="formation-icon__line" x1="4" x2="52"${ssrRenderAttr("y1", y)}${ssrRenderAttr("y2", y)} data-v-4ccdd035></line>`);
			});
			_push(`<!--]--><!--[-->`);
			ssrRenderList(__props.slots, (slot) => {
				_push(`<circle class="formation-icon__dot"${ssrRenderAttr("cx", mapX(slot.x))}${ssrRenderAttr("cy", mapY(slot.y))} r="3" data-v-4ccdd035></circle>`);
			});
			_push(`<!--]--></svg>`);
		};
	}
});
//#endregion
//#region app/components/FormationIcon.vue
var _sfc_setup$2 = FormationIcon_vue_vue_type_script_setup_true_lang_default.setup;
FormationIcon_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/FormationIcon.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var FormationIcon_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(FormationIcon_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-4ccdd035"]]), { __name: "FormationIcon" });
//#endregion
//#region app/components/CreateChallengeDialog.vue?vue&type=script&setup=true&lang.ts
var MAX_PRESET_SLOTS = 3;
var CreateChallengeDialog_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "CreateChallengeDialog",
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
		const siteConfig = useSiteConfig();
		const MODE_OPTIONS = [
			{
				kind: "exact",
				label: "Exact"
			},
			{
				kind: "over",
				label: "Over"
			},
			{
				kind: "under",
				label: "Under"
			},
			{
				kind: "allUnder",
				label: "All under"
			}
		];
		const formationCode = ref("442");
		const mode = ref("exact");
		const value = ref(null);
		const presetSlotIds = ref([]);
		const formation = computed(() => formations.find((candidate) => candidate.code === formationCode.value));
		const nonGkSlots = computed(() => formation.value.slots.filter((slot) => slot.group !== "GK"));
		const valueOptions = computed(() => objectiveValueOptions(mode.value));
		watch(formationCode, () => {
			presetSlotIds.value = [];
		});
		watch(mode, (kind) => {
			value.value = kind === "exact" ? null : objectiveValueOptions(kind)[0] ?? null;
		});
		function toggleSlot(slotId) {
			if (presetSlotIds.value.includes(slotId)) {
				presetSlotIds.value = presetSlotIds.value.filter((id) => id !== slotId);
				return;
			}
			if (presetSlotIds.value.length >= MAX_PRESET_SLOTS) return;
			presetSlotIds.value = [...presetSlotIds.value, slotId];
		}
		const step = ref("configuring");
		const preview = ref(null);
		const challengeUrl = ref("");
		async function handleGenerate() {
			step.value = "loading";
			const query = buildChallengeQuery({
				formationCode: formationCode.value,
				mode: mode.value,
				value: value.value ?? void 0,
				presetSlotIds: presetSlotIds.value
			});
			try {
				preview.value = await $fetch$2("/api/challenge", { query });
				challengeUrl.value = `${siteConfig.url}/challenge?${new URLSearchParams(query).toString()}`;
				step.value = "preview";
				trackEvent("challenge_created", {
					formation: formationCode.value,
					mode: mode.value,
					presetCount: presetSlotIds.value.length
				});
			} catch {
				step.value = "error";
			}
		}
		function handleStartOver() {
			step.value = "configuring";
			preview.value = null;
		}
		const copyLabel = ref("Copy link");
		let copyLabelTimeout;
		function trackLinkShared(method) {
			trackEvent("challenge_link_shared", {
				formation: formationCode.value,
				mode: mode.value,
				presetCount: presetSlotIds.value.length
			});
		}
		async function handleShareOrCopy() {
			if ((void 0).share) try {
				await (void 0).share({
					title: "Exact XI",
					text: "A board I set up for you on Exact XI.",
					url: challengeUrl.value
				});
				trackLinkShared("share");
				return;
			} catch {}
			if (!(void 0).clipboard?.writeText) return;
			try {
				await (void 0).clipboard.writeText(challengeUrl.value);
				copyLabel.value = "Copied!";
				(void 0).clearTimeout(copyLabelTimeout);
				copyLabelTimeout = (void 0).setTimeout(() => {
					copyLabel.value = "Copy link";
				}, 2e3);
				trackLinkShared("copy");
			} catch {}
		}
		watch(open, (isOpen) => {
			if (isOpen) {
				step.value = "configuring";
				preview.value = null;
				formationCode.value = "442";
				mode.value = "exact";
				value.value = null;
				presetSlotIds.value = [];
			}
		});
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(CenteredDialog_default, mergeProps({
				open: open.value,
				"onUpdate:open": ($event) => open.value = $event,
				title: "Create a challenge"
			}, _attrs), {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						if (unref(step) === "configuring" || unref(step) === "loading") {
							_push(`<!--[--><p class="create-challenge__intro" data-v-70f67129${_scopeId}> Pick a formation and an objective, then optionally lock in a couple of players to make it harder — anyone who opens the link plays this exact board. </p><div class="create-challenge__field" data-v-70f67129${_scopeId}><span class="create-challenge__label" data-v-70f67129${_scopeId}>Formation</span><div class="create-challenge__chips" data-v-70f67129${_scopeId}><!--[-->`);
							ssrRenderList(unref(formations), (candidate) => {
								_push(`<button class="${ssrRenderClass([{ "create-challenge__chip--active": candidate.code === unref(formationCode) }, "create-challenge__chip"])}" type="button" data-v-70f67129${_scopeId}>${ssrInterpolate(candidate.code)}</button>`);
							});
							_push(`<!--]--></div></div><div class="create-challenge__field" data-v-70f67129${_scopeId}><span class="create-challenge__label" data-v-70f67129${_scopeId}>Objective</span><div class="create-challenge__chips" data-v-70f67129${_scopeId}><!--[-->`);
							ssrRenderList(MODE_OPTIONS, (option) => {
								_push(`<button class="${ssrRenderClass([{ "create-challenge__chip--active": option.kind === unref(mode) }, "create-challenge__chip"])}" type="button" data-v-70f67129${_scopeId}>${ssrInterpolate(option.label)}</button>`);
							});
							_push(`<!--]--></div></div>`);
							if (unref(valueOptions).length > 0) {
								_push(`<div class="create-challenge__field" data-v-70f67129${_scopeId}><span class="create-challenge__label" data-v-70f67129${_scopeId}>Value</span><div class="create-challenge__chips" data-v-70f67129${_scopeId}><!--[-->`);
								ssrRenderList(unref(valueOptions), (option) => {
									_push(`<button class="${ssrRenderClass([{ "create-challenge__chip--active": option === unref(value) }, "create-challenge__chip"])}" type="button" data-v-70f67129${_scopeId}>${ssrInterpolate(option)}</button>`);
								});
								_push(`<!--]--></div></div>`);
							} else _push(`<!---->`);
							_push(`<div class="create-challenge__field" data-v-70f67129${_scopeId}><span class="create-challenge__label" data-v-70f67129${_scopeId}>Pre-fill slots (up to ${ssrInterpolate(MAX_PRESET_SLOTS)}, optional)</span><div class="create-challenge__chips" data-v-70f67129${_scopeId}><!--[-->`);
							ssrRenderList(unref(nonGkSlots), (slot) => {
								_push(`<button class="${ssrRenderClass([{ "create-challenge__chip--active": unref(presetSlotIds).includes(slot.id) }, "create-challenge__chip"])}"${ssrIncludeBooleanAttr(!unref(presetSlotIds).includes(slot.id) && unref(presetSlotIds).length >= MAX_PRESET_SLOTS) ? " disabled" : ""} type="button" data-v-70f67129${_scopeId}>${ssrInterpolate(unref(getSlotShortLabel)(slot.group, slot.side, slot.rowSize))}</button>`);
							});
							_push(`<!--]--></div></div><button class="create-challenge__generate"${ssrIncludeBooleanAttr(unref(step) === "loading") ? " disabled" : ""} type="button" data-v-70f67129${_scopeId}>${ssrInterpolate(unref(step) === "loading" ? "Building…" : "Get link")}</button><!--]-->`);
						} else if (unref(step) === "preview" && unref(preview)) {
							_push(`<!--[--><p class="create-challenge__intro" data-v-70f67129${_scopeId}>${ssrInterpolate(unref(preview).formationCode)} · ${ssrInterpolate(unref(preview).objective.label)}</p>`);
							if (unref(preview).prefilled.length > 0) {
								_push(`<ul class="create-challenge__preview-list" data-v-70f67129${_scopeId}><!--[-->`);
								ssrRenderList(unref(preview).prefilled, (entry) => {
									_push(`<li class="create-challenge__preview-item" data-v-70f67129${_scopeId}>${ssrInterpolate(entry.player.name)} — ${ssrInterpolate(entry.player.goals + entry.player.assists)}</li>`);
								});
								_push(`<!--]--></ul>`);
							} else _push(`<p class="create-challenge__preview-empty" data-v-70f67129${_scopeId}>No pre-filled slots — a clean board with a twist.</p>`);
							_push(`<code class="create-challenge__link" data-v-70f67129${_scopeId}>${ssrInterpolate(unref(challengeUrl))}</code><div class="create-challenge__preview-actions" data-v-70f67129${_scopeId}><button class="create-challenge__generate" type="button" data-v-70f67129${_scopeId}>${ssrInterpolate(unref(copyLabel))}</button><button class="create-challenge__start-over" type="button" data-v-70f67129${_scopeId}>Start over</button></div><!--]-->`);
						} else if (unref(step) === "error") _push(`<!--[--><p class="create-challenge__intro" data-v-70f67129${_scopeId}>Couldn&#39;t build that challenge — try a different combination.</p><button class="create-challenge__generate" type="button" data-v-70f67129${_scopeId}>Start over</button><!--]-->`);
						else _push(`<!---->`);
					} else return [unref(step) === "configuring" || unref(step) === "loading" ? (openBlock(), createBlock(Fragment, { key: 0 }, [
						createVNode("p", { class: "create-challenge__intro" }, " Pick a formation and an objective, then optionally lock in a couple of players to make it harder — anyone who opens the link plays this exact board. "),
						createVNode("div", { class: "create-challenge__field" }, [createVNode("span", { class: "create-challenge__label" }, "Formation"), createVNode("div", { class: "create-challenge__chips" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(formations), (candidate) => {
							return openBlock(), createBlock("button", {
								key: candidate.code,
								class: ["create-challenge__chip", { "create-challenge__chip--active": candidate.code === unref(formationCode) }],
								type: "button",
								onClick: ($event) => formationCode.value = candidate.code
							}, toDisplayString(candidate.code), 11, ["onClick"]);
						}), 128))])]),
						createVNode("div", { class: "create-challenge__field" }, [createVNode("span", { class: "create-challenge__label" }, "Objective"), createVNode("div", { class: "create-challenge__chips" }, [(openBlock(), createBlock(Fragment, null, renderList(MODE_OPTIONS, (option) => {
							return createVNode("button", {
								key: option.kind,
								class: ["create-challenge__chip", { "create-challenge__chip--active": option.kind === unref(mode) }],
								type: "button",
								onClick: ($event) => mode.value = option.kind
							}, toDisplayString(option.label), 11, ["onClick"]);
						}), 64))])]),
						unref(valueOptions).length > 0 ? (openBlock(), createBlock("div", {
							key: 0,
							class: "create-challenge__field"
						}, [createVNode("span", { class: "create-challenge__label" }, "Value"), createVNode("div", { class: "create-challenge__chips" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(valueOptions), (option) => {
							return openBlock(), createBlock("button", {
								key: option,
								class: ["create-challenge__chip", { "create-challenge__chip--active": option === unref(value) }],
								type: "button",
								onClick: ($event) => value.value = option
							}, toDisplayString(option), 11, ["onClick"]);
						}), 128))])])) : createCommentVNode("", true),
						createVNode("div", { class: "create-challenge__field" }, [createVNode("span", { class: "create-challenge__label" }, "Pre-fill slots (up to " + toDisplayString(MAX_PRESET_SLOTS) + ", optional)"), createVNode("div", { class: "create-challenge__chips" }, [(openBlock(true), createBlock(Fragment, null, renderList(unref(nonGkSlots), (slot) => {
							return openBlock(), createBlock("button", {
								key: slot.id,
								class: ["create-challenge__chip", { "create-challenge__chip--active": unref(presetSlotIds).includes(slot.id) }],
								disabled: !unref(presetSlotIds).includes(slot.id) && unref(presetSlotIds).length >= MAX_PRESET_SLOTS,
								type: "button",
								onClick: ($event) => toggleSlot(slot.id)
							}, toDisplayString(unref(getSlotShortLabel)(slot.group, slot.side, slot.rowSize)), 11, ["disabled", "onClick"]);
						}), 128))])]),
						createVNode("button", {
							class: "create-challenge__generate",
							disabled: unref(step) === "loading",
							type: "button",
							onClick: handleGenerate
						}, toDisplayString(unref(step) === "loading" ? "Building…" : "Get link"), 9, ["disabled"])
					], 64)) : unref(step) === "preview" && unref(preview) ? (openBlock(), createBlock(Fragment, { key: 1 }, [
						createVNode("p", { class: "create-challenge__intro" }, toDisplayString(unref(preview).formationCode) + " · " + toDisplayString(unref(preview).objective.label), 1),
						unref(preview).prefilled.length > 0 ? (openBlock(), createBlock("ul", {
							key: 0,
							class: "create-challenge__preview-list"
						}, [(openBlock(true), createBlock(Fragment, null, renderList(unref(preview).prefilled, (entry) => {
							return openBlock(), createBlock("li", {
								key: entry.slotId,
								class: "create-challenge__preview-item"
							}, toDisplayString(entry.player.name) + " — " + toDisplayString(entry.player.goals + entry.player.assists), 1);
						}), 128))])) : (openBlock(), createBlock("p", {
							key: 1,
							class: "create-challenge__preview-empty"
						}, "No pre-filled slots — a clean board with a twist.")),
						createVNode("code", { class: "create-challenge__link" }, toDisplayString(unref(challengeUrl)), 1),
						createVNode("div", { class: "create-challenge__preview-actions" }, [createVNode("button", {
							class: "create-challenge__generate",
							type: "button",
							onClick: handleShareOrCopy
						}, toDisplayString(unref(copyLabel)), 1), createVNode("button", {
							class: "create-challenge__start-over",
							type: "button",
							onClick: handleStartOver
						}, "Start over")])
					], 64)) : unref(step) === "error" ? (openBlock(), createBlock(Fragment, { key: 2 }, [createVNode("p", { class: "create-challenge__intro" }, "Couldn't build that challenge — try a different combination."), createVNode("button", {
						class: "create-challenge__generate",
						type: "button",
						onClick: handleStartOver
					}, "Start over")], 64)) : createCommentVNode("", true)];
				}),
				_: 1
			}, _parent));
		};
	}
});
//#endregion
//#region app/components/CreateChallengeDialog.vue
var _sfc_setup$1 = CreateChallengeDialog_vue_vue_type_script_setup_true_lang_default.setup;
CreateChallengeDialog_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/CreateChallengeDialog.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var CreateChallengeDialog_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(CreateChallengeDialog_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-70f67129"]]), { __name: "CreateChallengeDialog" });
//#endregion
//#region app/pages/index.vue?vue&type=script&setup=true&lang.ts
var index_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "index",
	__ssrInlineRender: true,
	setup(__props) {
		const STEPS = [
			{
				number: "1",
				title: "Pick a formation",
				detail: "Its digits become your target."
			},
			{
				number: "2",
				title: "Fill the XI",
				detail: "3 hidden-stat players per slot."
			},
			{
				number: "3",
				title: "Land the number",
				detail: "Exact wins. Going over busts the game."
			}
		];
		const infoOpen = ref(false);
		const statsOpen = ref(false);
		function openInfo() {
			infoOpen.value = true;
		}
		function openStats() {
			statsOpen.value = true;
		}
		function selectFormation(formationCode) {
		}
		function selectDaily() {
		}
		const createChallengeOpen = ref(false);
		useHead$1({
			title: "Exact XI — pick a formation, guess the exact score",
			meta: [
				{
					name: "description",
					content: "A line-up guessing game for England's top-flight football since 2016/17 — pick a formation and land your goals + assists total exactly on target."
				},
				{
					property: "og:title",
					content: "Exact XI"
				},
				{
					property: "og:description",
					content: "Pick a formation, fill the XI, and try to land on the exact score — real top-flight players since 2016/17."
				},
				{
					property: "og:image",
					content: "/og-image.png"
				},
				{
					property: "og:image:width",
					content: 1200
				},
				{
					property: "og:image:height",
					content: 630
				},
				{
					property: "og:image:alt",
					content: "Exact XI logo on a dark background"
				},
				{
					name: "twitter:card",
					content: "summary_large_image"
				},
				{
					name: "twitter:title",
					content: "Exact XI"
				},
				{
					name: "twitter:description",
					content: "Pick a formation, fill the XI, and try to land on the exact score."
				},
				{
					name: "twitter:image",
					content: "/og-image.png"
				}
			]
		});
		return (_ctx, _push, _parent, _attrs) => {
			const _component_AppHeader = AppHeader_default;
			const _component_AppIcon = AppIcon_default;
			const _component_ThemeToggle = ThemeToggle_default;
			const _component_NuxtLink = NuxtLink;
			const _component_FormationIcon = FormationIcon_default;
			const _component_InfoDialog = InfoDialog_default;
			const _component_StatsDialog = StatsDialog_default;
			const _component_CreateChallengeDialog = CreateChallengeDialog_default;
			_push(`<main${ssrRenderAttrs(mergeProps({ class: "home" }, _attrs))} data-v-512f54ba>`);
			_push(ssrRenderComponent(_component_AppHeader, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<button aria-label="How to play" class="home__icon-button" type="button" data-v-512f54ba${_scopeId}>`);
						_push(ssrRenderComponent(_component_AppIcon, { name: "info" }, null, _parent, _scopeId));
						_push(`</button><button aria-label="Your stats" class="home__icon-button" type="button" data-v-512f54ba${_scopeId}>`);
						_push(ssrRenderComponent(_component_AppIcon, { name: "stats" }, null, _parent, _scopeId));
						_push(`</button>`);
						_push(ssrRenderComponent(_component_ThemeToggle, null, null, _parent, _scopeId));
					} else return [
						createVNode("button", {
							"aria-label": "How to play",
							class: "home__icon-button",
							type: "button",
							onClick: openInfo
						}, [createVNode(_component_AppIcon, { name: "info" })]),
						createVNode("button", {
							"aria-label": "Your stats",
							class: "home__icon-button",
							type: "button",
							onClick: openStats
						}, [createVNode(_component_AppIcon, { name: "stats" })]),
						createVNode(_component_ThemeToggle)
					];
				}),
				_: 1
			}, _parent));
			_push(`<div class="home__inner" data-v-512f54ba><h1 class="home__visually-hidden-title" data-v-512f54ba>Exact XI</h1><p class="home__lede" data-v-512f54ba> Pick a formation, then fill the XI to land on the target exactly — goals + assists for every real player picked, from England&#39;s top-flight football since 2016/17. </p><ol class="steps" data-v-512f54ba><!--[-->`);
			ssrRenderList(STEPS, (step) => {
				_push(`<li class="steps__item" data-v-512f54ba><span class="steps__number" data-v-512f54ba>${ssrInterpolate(step.number)}</span><span class="steps__title" data-v-512f54ba>${ssrInterpolate(step.title)}</span><span class="steps__detail" data-v-512f54ba>${ssrInterpolate(step.detail)}</span></li>`);
			});
			_push(`<!--]--></ol><div class="entry-cards" data-v-512f54ba>`);
			_push(ssrRenderComponent(_component_NuxtLink, {
				class: "daily-card",
				to: "/daily",
				onClick: selectDaily
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(ssrRenderComponent(_component_AppIcon, {
							class: "daily-card__bleed-icon",
							name: "calendar"
						}, null, _parent, _scopeId));
						_push(ssrRenderComponent(_component_AppIcon, {
							class: "daily-card__icon",
							name: "calendar"
						}, null, _parent, _scopeId));
						_push(`<span class="daily-card__details" data-v-512f54ba${_scopeId}><span class="daily-card__title" data-v-512f54ba${_scopeId}>Daily Challenge</span><span class="daily-card__detail" data-v-512f54ba${_scopeId}>A new twist every day.</span></span>`);
					} else return [
						createVNode(_component_AppIcon, {
							class: "daily-card__bleed-icon",
							name: "calendar"
						}),
						createVNode(_component_AppIcon, {
							class: "daily-card__icon",
							name: "calendar"
						}),
						createVNode("span", { class: "daily-card__details" }, [createVNode("span", { class: "daily-card__title" }, "Daily Challenge"), createVNode("span", { class: "daily-card__detail" }, "A new twist every day.")])
					];
				}),
				_: 1
			}, _parent));
			_push(`<button class="daily-card daily-card--challenge" type="button" data-v-512f54ba>`);
			_push(ssrRenderComponent(_component_AppIcon, {
				class: "daily-card__bleed-icon",
				name: "target"
			}, null, _parent));
			_push(ssrRenderComponent(_component_AppIcon, {
				class: "daily-card__icon",
				name: "target"
			}, null, _parent));
			_push(`<span class="daily-card__details" data-v-512f54ba><span class="daily-card__title" data-v-512f54ba>Create a challenge</span><span class="daily-card__detail" data-v-512f54ba>Build a board for a friend.</span></span></button></div><ul class="formations" data-v-512f54ba><!--[-->`);
			ssrRenderList(unref(formations), (formation) => {
				_push(`<li data-v-512f54ba>`);
				_push(ssrRenderComponent(_component_NuxtLink, {
					class: ["formations__link", `formations__link--${unref(FORMATION_DIFFICULTY)[formation.code].tier}`],
					to: {
						path: "/play",
						query: { f: formation.code }
					},
					onClick: ($event) => selectFormation(formation.code)
				}, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) {
							_push(ssrRenderComponent(_component_FormationIcon, { slots: formation.slots }, null, _parent, _scopeId));
							_push(`<span class="formations__details" data-v-512f54ba${_scopeId}><span class="formations__code" data-v-512f54ba${_scopeId}>${ssrInterpolate(formation.code)}</span><span class="formations__rows" data-v-512f54ba${_scopeId}>${ssrInterpolate(formation.rows[0])} DEF · ${ssrInterpolate(formation.rows[1])} MID · ${ssrInterpolate(formation.rows[2])} FWD</span></span><span class="${ssrRenderClass([`formations__tag--${unref(FORMATION_DIFFICULTY)[formation.code].tier}`, "formations__tag"])}" data-v-512f54ba${_scopeId}>${ssrInterpolate(unref(FORMATION_DIFFICULTY)[formation.code].label)}</span>`);
						} else return [
							createVNode(_component_FormationIcon, { slots: formation.slots }, null, 8, ["slots"]),
							createVNode("span", { class: "formations__details" }, [createVNode("span", { class: "formations__code" }, toDisplayString(formation.code), 1), createVNode("span", { class: "formations__rows" }, toDisplayString(formation.rows[0]) + " DEF · " + toDisplayString(formation.rows[1]) + " MID · " + toDisplayString(formation.rows[2]) + " FWD", 1)]),
							createVNode("span", { class: ["formations__tag", `formations__tag--${unref(FORMATION_DIFFICULTY)[formation.code].tier}`] }, toDisplayString(unref(FORMATION_DIFFICULTY)[formation.code].label), 3)
						];
					}),
					_: 2
				}, _parent));
				_push(`</li>`);
			});
			_push(`<!--]--></ul></div>`);
			_push(ssrRenderComponent(_component_InfoDialog, {
				open: unref(infoOpen),
				"onUpdate:open": ($event) => isRef(infoOpen) ? infoOpen.value = $event : null
			}, null, _parent));
			_push(ssrRenderComponent(_component_StatsDialog, {
				open: unref(statsOpen),
				"onUpdate:open": ($event) => isRef(statsOpen) ? statsOpen.value = $event : null
			}, null, _parent));
			_push(ssrRenderComponent(_component_CreateChallengeDialog, {
				open: unref(createChallengeOpen),
				"onUpdate:open": ($event) => isRef(createChallengeOpen) ? createChallengeOpen.value = $event : null
			}, null, _parent));
			_push(`</main>`);
		};
	}
});
//#endregion
//#region app/pages/index.vue
var _sfc_setup = index_vue_vue_type_script_setup_true_lang_default.setup;
index_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/index.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var pages_default = /*#__PURE__*/ _plugin_vue_export_helper_default(index_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-512f54ba"]]);

export { pages_default as default };
//# sourceMappingURL=pages-CrSTlol6.mjs.map
