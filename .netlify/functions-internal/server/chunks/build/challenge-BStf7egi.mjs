import { _ as _plugin_vue_export_helper_default, u as useRoute$1, g as getFormation, a as useHead$1, A as AppIcon_default, N as NuxtLink } from '../virtual/entry.mjs';
import { I as InfoDialog_default, S as StatsDialog_default } from './StatsDialog-DyxQmieI.mjs';
import { A as AppHeader_default, T as ThemeToggle_default } from './HowToPlayContent-BkuU9Xg_.mjs';
import { u as useGame, S as ScoreBar_default, R as ResultPanel_default, P as Pitch_default, a as PositionSlot_default, b as PlayerChoiceDialog_default } from './PlayerChoiceDialog-DYcTtwFE.mjs';
import { c as challengeKeyFromQuery } from './challenge-config--UdGTplH.mjs';
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

//#region app/pages/challenge.vue?vue&type=script&setup=true&lang.ts
var challenge_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "challenge",
	__ssrInlineRender: true,
	setup(__props) {
		const route = useRoute$1();
		const CHALLENGE_PARAMS = [
			"f",
			"mode",
			"value",
			"preset"
		];
		const challengeQuery = computed(() => {
			const query = {};
			for (const key of CHALLENGE_PARAMS) {
				const raw = route.query[key];
				if (typeof raw === "string" && raw.length > 0) query[key] = raw;
			}
			return query;
		});
		computed(() => challengeKeyFromQuery(challengeQuery.value));
		const { state, isDrawing, pendingSlotId, drawError, openSlot } = useGame();
		const loading = ref(true);
		const loadError = ref(false);
		const formation = computed(() => state.value ? getFormation(state.value.formationCode) : void 0);
		const remainingSlots = computed(() => state.value?.slots.filter((slot) => !slot.player).length ?? 0);
		const gameOver = computed(() => state.value?.status === "won" || state.value?.status === "bust" || state.value?.status === "lost");
		function handleSlotSelect(slotId) {
			openSlot(slotId);
		}
		const infoOpen = ref(false);
		const statsOpen = ref(false);
		function openInfo() {
			infoOpen.value = true;
		}
		function openStats() {
			statsOpen.value = true;
		}
		useHead$1({
			title: "Custom Challenge — Exact XI",
			meta: [
				{
					name: "description",
					content: "A friend-built board — a chosen formation, objective, and a couple of players already locked in. Real top-flight players since 2016/17."
				},
				{
					property: "og:title",
					content: "Custom Challenge — Exact XI"
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
			_push(`<main${ssrRenderAttrs(mergeProps({ class: "challenge" }, _attrs))} data-v-d346e464>`);
			_push(ssrRenderComponent(_component_AppHeader, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(`<button aria-label="How to play" class="challenge__info-button" type="button" data-v-d346e464${_scopeId}>`);
						_push(ssrRenderComponent(_component_AppIcon, { name: "info" }, null, _parent, _scopeId));
						_push(`</button><button aria-label="Your stats" class="challenge__info-button" type="button" data-v-d346e464${_scopeId}>`);
						_push(ssrRenderComponent(_component_AppIcon, { name: "stats" }, null, _parent, _scopeId));
						_push(`</button>`);
						_push(ssrRenderComponent(_component_ThemeToggle, null, null, _parent, _scopeId));
					} else return [
						createVNode("button", {
							"aria-label": "How to play",
							class: "challenge__info-button",
							type: "button",
							onClick: openInfo
						}, [createVNode(_component_AppIcon, { name: "info" })]),
						createVNode("button", {
							"aria-label": "Your stats",
							class: "challenge__info-button",
							type: "button",
							onClick: openStats
						}, [createVNode(_component_AppIcon, { name: "stats" })]),
						createVNode(_component_ThemeToggle)
					];
				}),
				_: 1
			}, _parent));
			_push(`<div class="challenge__inner" data-v-d346e464>`);
			if (unref(formation) && unref(state)) {
				_push(`<!--[--><h1 class="challenge__title" data-v-d346e464>Challenge · ${ssrInterpolate(unref(formation).code)}</h1>`);
				if (unref(state).objective) _push(`<p class="challenge__objective" data-v-d346e464>${ssrInterpolate(unref(state).objective.label)}</p>`);
				else _push(`<!---->`);
				_push(ssrRenderComponent(_component_ScoreBar, {
					objective: unref(state).objective,
					"remaining-slots": unref(remainingSlots),
					status: unref(state).status,
					target: unref(state).target,
					total: unref(state).total
				}, null, _parent));
				if (unref(gameOver)) _push(ssrRenderComponent(_component_ResultPanel, null, null, _parent));
				else _push(`<!---->`);
				if (unref(drawError)) _push(`<p aria-live="polite" class="challenge__draw-error" data-v-d346e464> Couldn&#39;t load players for that slot — tap it again to retry. </p>`);
				else _push(`<!---->`);
				_push(`<div class="challenge__board" data-v-d346e464>`);
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
			} else if (unref(loadError)) _push(`<p class="challenge__error" data-v-d346e464> Couldn&#39;t load this challenge. <button class="challenge__retry" type="button" data-v-d346e464>Try again</button></p>`);
			else if (!unref(loading)) {
				_push(`<p class="challenge__error" data-v-d346e464> This challenge link isn&#39;t valid. `);
				_push(ssrRenderComponent(_component_NuxtLink, { to: "/" }, {
					default: withCtx((_, _push, _parent, _scopeId) => {
						if (_push) _push(`Pick a formation`);
						else return [createTextVNode("Pick a formation")];
					}),
					_: 1
				}, _parent));
				_push(`</p>`);
			} else _push(`<p class="challenge__error" data-v-d346e464>Loading challenge…</p>`);
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
//#region app/pages/challenge.vue
var _sfc_setup = challenge_vue_vue_type_script_setup_true_lang_default.setup;
challenge_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/challenge.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var challenge_default = /*#__PURE__*/ _plugin_vue_export_helper_default(challenge_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-d346e464"]]);

export { challenge_default as default };
//# sourceMappingURL=challenge-BStf7egi.mjs.map
