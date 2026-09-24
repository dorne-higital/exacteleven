import { _ as _plugin_vue_export_helper_default, a as useHead$1, N as NuxtLink, A as AppIcon_default } from '../virtual/entry.mjs';
import { A as AppHeader_default, T as ThemeToggle_default, H as HowToPlayContent_default } from './HowToPlayContent-BkuU9Xg_.mjs';
import { defineComponent, mergeProps, withCtx, createVNode, createTextVNode, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent } from 'vue/server-renderer';
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

//#region app/pages/how-to-play.vue?vue&type=script&setup=true&lang.ts
var how_to_play_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "how-to-play",
	__ssrInlineRender: true,
	setup(__props) {
		useHead$1({
			title: "How to play — Exact XI",
			meta: [
				{
					name: "description",
					content: "The rules of Exact XI in plain language: formations, hidden stats, busts, the win window, rerolls and repeats."
				},
				{
					property: "og:title",
					content: "How to play — Exact XI"
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
			const _component_NuxtLink = NuxtLink;
			const _component_AppIcon = AppIcon_default;
			const _component_ThemeToggle = ThemeToggle_default;
			const _component_HowToPlayContent = HowToPlayContent_default;
			_push(`<main${ssrRenderAttrs(mergeProps({ class: "how-to-play" }, _attrs))} data-v-2d621f88>`);
			_push(ssrRenderComponent(_component_AppHeader, null, {
				default: withCtx((_, _push, _parent, _scopeId) => {
					if (_push) {
						_push(ssrRenderComponent(_component_NuxtLink, {
							class: "how-to-play__back",
							to: "/"
						}, {
							default: withCtx((_, _push, _parent, _scopeId) => {
								if (_push) {
									_push(ssrRenderComponent(_component_AppIcon, { name: "back" }, null, _parent, _scopeId));
									_push(` Home `);
								} else return [createVNode(_component_AppIcon, { name: "back" }), createTextVNode(" Home ")];
							}),
							_: 1
						}, _parent, _scopeId));
						_push(ssrRenderComponent(_component_ThemeToggle, null, null, _parent, _scopeId));
					} else return [createVNode(_component_NuxtLink, {
						class: "how-to-play__back",
						to: "/"
					}, {
						default: withCtx(() => [createVNode(_component_AppIcon, { name: "back" }), createTextVNode(" Home ")]),
						_: 1
					}), createVNode(_component_ThemeToggle)];
				}),
				_: 1
			}, _parent));
			_push(`<div class="how-to-play__inner" data-v-2d621f88><h1 data-v-2d621f88>How to play</h1>`);
			_push(ssrRenderComponent(_component_HowToPlayContent, null, null, _parent));
			_push(`</div></main>`);
		};
	}
});
//#endregion
//#region app/pages/how-to-play.vue
var _sfc_setup = how_to_play_vue_vue_type_script_setup_true_lang_default.setup;
how_to_play_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/how-to-play.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
var how_to_play_default = /*#__PURE__*/ _plugin_vue_export_helper_default(how_to_play_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-2d621f88"]]);

export { how_to_play_default as default };
//# sourceMappingURL=how-to-play-xShEJZeY.mjs.map
