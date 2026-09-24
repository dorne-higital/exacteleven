import { _ as _plugin_vue_export_helper_default, u as useRoute$1, g as getFormation, a as useHead$1, A as AppIcon_default, N as NuxtLink } from '../virtual/entry.mjs';
import { I as InfoDialog_default, S as StatsDialog_default, t as trackEvent } from './StatsDialog-DyxQmieI.mjs';
import { A as AppHeader_default, T as ThemeToggle_default } from './HowToPlayContent-BkuU9Xg_.mjs';
import { u as useGame, S as ScoreBar_default, R as ResultPanel_default, P as Pitch_default, a as PositionSlot_default, b as PlayerChoiceDialog_default } from './PlayerChoiceDialog-DYcTtwFE.mjs';
import { defineComponent, computed, ref, mergeProps, withCtx, createVNode, unref, createTextVNode, isRef, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrInterpolate, ssrRenderList } from 'vue/server-renderer';
import 'nostics';
import 'nostics/formatters/ansi';
import '../routes/renderer.mjs';
import '../nitro/nitro.mjs';
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

//#region app/pages/play.vue?vue&type=script&setup=true&lang.ts
var play_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "play",
	__ssrInlineRender: true,
	setup(__props) {
		const route = useRoute$1();
		const formationCode = computed(() => String(route.query.f ?? ""));
		const formation = computed(() => getFormation(formationCode.value));
		const { state, isDrawing, pendingSlotId, drawError, startGame, openSlot } = useGame();
		if (formation.value && state.value?.formationCode !== formation.value.code) startGame(formation.value.code);
		const remainingSlots = computed(() => state.value?.slots.filter((slot) => !slot.player).length ?? 0);
		const gameOver = computed(() => state.value?.status === "won" || state.value?.status === "bust" || state.value?.status === "finished");
		function handleSlotSelect(slotId) {
			openSlot(slotId);
		}
		const infoOpen = ref(false);
		const statsOpen = ref(false);
		function openInfo() {
			infoOpen.value = true;
			trackEvent("view_how_to_play", {
				formation: formationCode.value
			});
		}
		function openStats() {
			statsOpen.value = true;
			trackEvent("view_stats", {
				formation: formationCode.value
			});
		}
		useHead$1({
			title: () => formation.value ? `${formation.value.code} formation — Exact XI` : "Exact XI",
			meta: [
				{
					name: "description",
					content: () => formation.value ? `Fill the ${formation.value.code} XI and try to land your total goals plus assists exactly on ${formation.value.target} — real top-flight players since 2016/17.` : "A line-up guessing game for England's top-flight football since 2016/17."
				},
				{
					property: "og:title",
					content: () => formation.value ? `${formation.value.code} formation — Exact XI` : "Exact XI"
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
					name: "twitter:image",
					content: "/og-image.png"
				}
			]
		});
		return (_ctx, _push, _parent, _attrs) => {
			const _component_AppHeader = AppHeader_default;
			const _component_AppIcon = AppIcon_default;
			const _component_ThemeToggle = ThemeToggle_default;
			const _component_ScoreBar = ScoreBar_default;
			const _component_ResultPanel = ResultPanel_default;
			const _component_Pitch = Pitch_default;
			const _component_PositionSlot = PositionSlot_default;
			const _component_PlayerChoiceDialog = PlayerChoiceDialog_default;
			const _component_NuxtLink = NuxtLink;
			const _component_InfoDialog = InfoDialog_default;
			const _component_StatsDialog = StatsDialog_default;
			_push(`<main${ssrRenderAttrs(mergeProps({ class: "play" }, _attrs))} data-v-34ea5d28>`);
			_push(ssrRenderComponent(_component_AppHeader, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<button aria-label="How to play" class="play__info-button" type="button" data-v-34ea5d28${_scopeId}>`);
						_push(ssrRenderComponent(_component_AppIcon, { name: "info" }, null, _parent, _scopeId));
						_push(`</button><button aria-label="Your stats" class="play__info-button" type="button" data-v-34ea5d28${_scopeId}>`);
						_push(ssrRenderComponent(_component_AppIcon, { name: "stats" }, null, _parent, _scopeId));
						_push(`</button>`);
						_push(ssrRenderComponent(_component_ThemeToggle, null, null, _parent, _scopeId));
					} else return [
						createVNode("button", {
							"aria-label": "How to play",
							class: "play__info-button",
							type: "button",
							onClick: openInfo
						}, [createVNode(_component_AppIcon, { name: "info" })]),
						createVNode("button", {
							"aria-label": "Your stats",
							class: "play__info-button",
							type: "button",
							onClick: openStats
						}, [createVNode(_component_AppIcon, { name: "stats" })]),
						createVNode(_component_ThemeToggle)
					];
				}),
				_: 1
			}, _parent));
			_push(`<div class="play__inner" data-v-34ea5d28>`);
			if (unref(formation) && unref(state)) {
				_push(`<!--[--><h1 class="play__title" data-v-34ea5d28>${ssrInterpolate(unref(formation).code)} formation</h1>`);
				_push(ssrRenderComponent(_component_ScoreBar, {
					"remaining-slots": unref(remainingSlots),
					status: unref(state).status,
					target: unref(state).target,
					total: unref(state).total
				}, null, _parent));
				if (unref(gameOver)) _push(ssrRenderComponent(_component_ResultPanel, null, null, _parent));
				else _push(`<!---->`);
				if (unref(drawError)) _push(`<p aria-live="polite" class="play__draw-error" data-v-34ea5d28> Couldn&#39;t load players for that slot — tap it again to retry. </p>`);
				else _push(`<!---->`);
				_push(`<div class="play__board" data-v-34ea5d28>`);
				_push(ssrRenderComponent(_component_Pitch, null, null, _parent));
				_push(`<!--[-->`);
				ssrRenderList(unref(state).slots, (slot) => {
					_push(ssrRenderComponent(_component_PositionSlot, {
						key: slot.id,
						busy: unref(isDrawing) || unref(gameOver),
						"game-over": unref(gameOver),
						loading: unref(pendingSlotId) === slot.id,
						"slot-data": slot,
						onSelect: handleSlotSelect
					}, null, _parent));
				});
				_push(`<!--]--></div>`);
				if (unref(state).activeSlotId) _push(ssrRenderComponent(_component_PlayerChoiceDialog, null, null, _parent));
				else _push(`<!---->`);
				_push(`<!--]-->`);
			} else {
				_push(`<p class="play__error" data-v-34ea5d28>`);
				if (unref(formationCode)) _push(`<!--[-->&quot;${ssrInterpolate(unref(formationCode))}&quot; isn&#39;t a valid formation.<!--]-->`);
				else _push(`<!--[-->No formation selected.<!--]-->`);
				_push(ssrRenderComponent(_component_NuxtLink, { to: "/" }, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`Pick a formation`);
						else return [createTextVNode("Pick a formation")];
					}),
					_: 1
				}, _parent));
				_push(`</p>`);
			}
			_push(`</div>`);
			_push(ssrRenderComponent(_component_InfoDialog, {
				open: unref(infoOpen),
				"onUpdate:open": ($event) => isRef(infoOpen) ? infoOpen.value = $event : null
			}, null, _parent));
			_push(ssrRenderComponent(_component_StatsDialog, {
				open: unref(statsOpen),
				"onUpdate:open": ($event) => isRef(statsOpen) ? statsOpen.value = $event : null
			}, null, _parent));
			_push(`</main>`);
		};
	}
});
//#endregion
//#region app/pages/play.vue
var _sfc_setup = play_vue_vue_type_script_setup_true_lang_default.setup;
play_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/play.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var play_default = /*#__PURE__*/ _plugin_vue_export_helper_default(play_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-34ea5d28"]]);

export { play_default as default };
//# sourceMappingURL=play-CpiaGmUL.mjs.map
