import { _ as _plugin_vue_export_helper_default, N as NuxtLink, o as useTheme } from '../virtual/entry.mjs';
import { defineComponent, mergeProps, withCtx, createVNode, computed, unref, useSSRContext } from 'vue';
import { p as publicAssetsURL } from '../nitro/nitro.mjs';
import { ssrRenderAttrs, ssrRenderComponent, ssrRenderAttr, ssrRenderSlot } from 'vue/server-renderer';

//#region \0virtual:public?%2Flogo%2Fexact-xi-mark-on-light.svg
var _virtual_public__2Flogo_2Fexact_xi_mark_on_light_default = publicAssetsURL("/logo/exact-xi-mark-on-light.svg");
//#endregion
//#region app/components/AppHeader.vue?vue&type=script&setup=true&lang.ts
var AppHeader_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "AppHeader",
	__ssrInlineRender: true,
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			const _component_NuxtLink = NuxtLink;
			_push(`<header${ssrRenderAttrs(mergeProps({ class: "app-header" }, _attrs))} data-v-e187efa9>`);
			_push(ssrRenderComponent(_component_NuxtLink, {
				"aria-label": "Exact XI home",
				class: "app-header__brand",
				to: "/"
			}, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) _push(`<img alt="" class="app-header__mark" height="26"${ssrRenderAttr("src", _virtual_public__2Flogo_2Fexact_xi_mark_on_light_default)} width="26" data-v-e187efa9${_scopeId}><span class="app-header__name" data-v-e187efa9${_scopeId}>Exact XI</span>`);
					else return [createVNode("img", {
						alt: "",
						class: "app-header__mark",
						height: "26",
						src: _virtual_public__2Flogo_2Fexact_xi_mark_on_light_default,
						width: "26"
					}), createVNode("span", { class: "app-header__name" }, "Exact XI")];
				}),
				_: 1
			}, _parent));
			_push(`<div class="app-header__actions" data-v-e187efa9>`);
			ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
			_push(`</div></header>`);
		};
	}
});
//#endregion
//#region app/components/AppHeader.vue
var _sfc_setup$2 = AppHeader_vue_vue_type_script_setup_true_lang_default.setup;
AppHeader_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/AppHeader.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var AppHeader_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(AppHeader_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-e187efa9"]]), { __name: "AppHeader" });
//#endregion
//#region app/components/ThemeToggle.vue?vue&type=script&setup=true&lang.ts
var ThemeToggle_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "ThemeToggle",
	__ssrInlineRender: true,
	setup(__props) {
		const { theme} = useTheme();
		const isDugoutDark = computed(() => theme.value === "dugout-dark");
		const label = computed(() => isDugoutDark.value ? "Switch to Match Programme theme" : "Switch to Dugout Dark theme");
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<button${ssrRenderAttrs(mergeProps({
				"aria-label": unref(label),
				class: "theme-toggle",
				type: "button"
			}, _attrs))} data-v-5d32f4fd><svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" data-v-5d32f4fd><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" data-v-5d32f4fd></path></svg></button>`);
		};
	}
});
//#endregion
//#region app/components/ThemeToggle.vue
var _sfc_setup$1 = ThemeToggle_vue_vue_type_script_setup_true_lang_default.setup;
ThemeToggle_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/ThemeToggle.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
var ThemeToggle_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(ThemeToggle_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-5d32f4fd"]]), { __name: "ThemeToggle" });
//#endregion
//#region app/components/HowToPlayContent.vue?vue&type=script&setup=true&lang.ts
var HowToPlayContent_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "HowToPlayContent",
	__ssrInlineRender: true,
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<ol${ssrRenderAttrs(mergeProps({ class: "how-to-play-content" }, _attrs))} data-v-a63b82b6><li data-v-a63b82b6><strong data-v-a63b82b6>Pick a formation.</strong> The formation&#39;s digits become your target number — 4-4-2 sets a target of 442, 3-4-3 sets 343, and so on. </li><li data-v-a63b82b6><strong data-v-a63b82b6>Fill all 11 slots.</strong> Click any empty slot in any order. Each one offers 3 real players who&#39;ve played that position — but their stats stay hidden, so you&#39;re guessing. </li><li data-v-a63b82b6><strong data-v-a63b82b6>Goals + assists stay hidden until you pick.</strong> The moment you choose a player, their career goals + assists are revealed and added to your running total. There&#39;s no way to check first. </li><li data-v-a63b82b6><strong data-v-a63b82b6>Go over the target and it&#39;s an immediate bust.</strong> One pick that tips you past the number ends the game right there — no more picks. </li><li data-v-a63b82b6><strong data-v-a63b82b6>Only an exact hit wins.</strong> Land your total exactly on the target and you&#39;re crowned <strong data-v-a63b82b6>Champion</strong> — the only way to actually win. Anything else that finishes without busting lands on a league table instead, based on how far off you were: from <strong data-v-a63b82b6>Champions League</strong> (a genuine near-miss) down through <strong data-v-a63b82b6>Europa League</strong>, <strong data-v-a63b82b6>Mid-table</strong> and <strong data-v-a63b82b6>Avoided relegation</strong>, to <strong data-v-a63b82b6>Relegated</strong> for the finishes that missed by the widest margin. </li><li data-v-a63b82b6><strong data-v-a63b82b6>One reroll per game.</strong> If you don&#39;t like the 3 options on a slot, you can redraw them once, for any single slot, at any point in the game. </li><li data-v-a63b82b6><strong data-v-a63b82b6>No repeat players.</strong> Once a player has been offered — picked or not — they won&#39;t turn up again for the rest of that game. </li></ol>`);
		};
	}
});
//#endregion
//#region app/components/HowToPlayContent.vue
var _sfc_setup = HowToPlayContent_vue_vue_type_script_setup_true_lang_default.setup;
HowToPlayContent_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/HowToPlayContent.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var HowToPlayContent_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(HowToPlayContent_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-a63b82b6"]]), { __name: "HowToPlayContent" });

export { AppHeader_default as A, HowToPlayContent_default as H, ThemeToggle_default as T };
//# sourceMappingURL=HowToPlayContent-BkuU9Xg_.mjs.map
