import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import { defineProdDiagnostics } from 'nostics';
import { ansiFormatter } from 'nostics/formatters/ansi';
import { getCurrentScope, ref, watchEffect, getCurrentInstance, onBeforeUnmount, onDeactivated, onActivated, shallowReactive, reactive, effectScope, hasInjectionContext, inject, toRef, defineComponent, shallowRef, h, resolveComponent, computed, unref, createApp, provide, onErrorCaptured, onServerPrefetch, createVNode, resolveDynamicComponent, defineAsyncComponent, mergeProps, createElementBlock, cloneVNode, isReadonly, useSSRContext, isRef, isShallow, isReactive, toRaw, toValue, isVNode, createCommentVNode, watch, Suspense, Fragment, nextTick, queuePostFlushCb } from 'vue';
import { i as injectHead$1, V as VueResolver, h as headSymbol } from '../routes/renderer.mjs';
import * as import_unhead_plugins from 'unhead/plugins';
import { FlatMetaPlugin, defineHeadPlugin, TemplateParamsPlugin } from 'unhead/plugins';
import { walkResolver, hasOwn, processTemplateParams } from 'unhead/utils';
import { c as createError, y as hasProtocol, q as joinURL, z as withQuery, A as sanitizeStatusCode, B as parseURL, k as encodePath, C as decodePath, D as parseQuery, E as isScriptProtocol, F as withTrailingSlash, G as withoutTrailingSlash, $ as $fetch, H as baseURL, I as defu, J as titleCase, K as stringifyQuery, L as withLeadingSlash, M as withBase, N as dayIndexForDate } from '../nitro/nitro.mjs';
import { START_LOCATION, createMemoryHistory, createRouter, RouterView } from 'vue-router';
import { fnv1a64Base36 } from 'fnv1a-64';
import { identify } from 'object-identity';
import { isPlainObject } from '@vue/shared';
import { ssrRenderSuspense, ssrRenderComponent, ssrRenderVNode, ssrRenderAttrs, ssrRenderAttr, ssrInterpolate } from 'vue/server-renderer';

function useHead(input, options = {}) {
  const head = options.head || injectHead$1();
  return head.ssr ? head.push(input || {}, options) : clientUseHead(head, input, options);
}
function clientUseHead(head, input, options = {}) {
  const scope = getCurrentScope();
  if (scope && !scope.active) {
    return { patch() {
    }, dispose() {
    }, _i: -1 };
  }
  const deactivated = ref(false);
  if (options.onRendered && scope) {
    const _onRendered = options.onRendered;
    options = { ...options, onRendered: (ctx) => scope.run(() => _onRendered(ctx)) };
  }
  let entry;
  watchEffect(() => {
    const i = deactivated.value ? {} : walkResolver(input, VueResolver);
    if (entry) {
      entry.patch(i);
    } else {
      entry = head.push(i, options);
    }
  });
  const vm = getCurrentInstance();
  if (vm) {
    onBeforeUnmount(() => {
      entry.dispose();
    });
    onDeactivated(() => {
      deactivated.value = true;
    });
    onActivated(() => {
      deactivated.value = false;
    });
  }
  return entry;
}
function normalizeSeoMetaInput(input) {
  if (input._flatMeta)
    return input;
  const meta = {};
  for (const key in input) {
    if (!hasOwn(input, key) || key === "title" || key === "titleTemplate")
      continue;
    meta[key] = input[key];
  }
  return {
    title: input.title,
    titleTemplate: input.titleTemplate,
    _flatMeta: meta
  };
}
function useSeoMeta(input = {}, options = {}) {
  const head = options.head || injectHead$1();
  head.use(FlatMetaPlugin);
  const entry = useHead(normalizeSeoMetaInput(input), options);
  const corePatch = entry.patch;
  if (!entry.__patched) {
    entry.patch = (input2) => corePatch(normalizeSeoMetaInput(input2));
    entry.__patched = true;
  }
  return entry;
}

function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
const createTask = /* @__PURE__ */ (() => {
	if (console.createTask) return console.createTask;
	const defaultTask = { run: (fn) => fn() };
	return () => defaultTask;
})();
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result && typeof result.then === "function") return Promise.resolve(result).then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
function serialTaskCaller(hooks, args, name) {
	if (hooks.length > 0) return callHooks(hooks, args, 0, createTask(name));
}
function parallelTaskCaller(hooks, args, name) {
	if (hooks.length > 0) {
		const task = createTask(name);
		return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
	}
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
var Hookable = class {
	_hooks;
	_before;
	_after;
	_deprecatedHooks;
	_deprecatedMessages;
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	clearHook(name) {
		this._hooks[name] = void 0;
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		this._hooks[name] = void 0;
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns) unreg();
			removeFns.length = 0;
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		this._hooks = {};
	}
	callHook(name, ...args) {
		return this.callHookWith(serialTaskCaller, name, args);
	}
	callHookParallel(name, ...args) {
		return this.callHookWith(parallelTaskCaller, name, args);
	}
	callHookWith(caller, name, args) {
		const event = this._before || this._after ? {
			name,
			args,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(this._hooks[name] ? [...this._hooks[name]] : [], args, name);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
function createHooks() {
	return new Hookable();
}

function _getAsyncLocalStorage() {
	return globalThis.AsyncLocalStorage || globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage;
}
const _WeakRef = globalThis.WeakRef || class StrongRef {
	#value;
	constructor(value) {
		this.#value = value;
	}
	deref() {
		return this.#value;
	}
};
function createContext(opts = {}) {
	let currentInstance;
	let isSingleton = false;
	const checkConflict = (instance) => {
		if (currentInstance && currentInstance !== instance) throw new Error("Context conflict");
	};
	let als;
	if (opts.asyncContext) {
		const _AsyncLocalStorage = opts.AsyncLocalStorage || _getAsyncLocalStorage();
		if (_AsyncLocalStorage) als = new _AsyncLocalStorage();
		else console.warn("[unctx] `AsyncLocalStorage` is not provided.");
	}
	const _wrapInstance = (instance) => als && instance !== null && typeof instance === "object" ? { __unctx_weak: new _WeakRef(instance) } : instance;
	const _unwrapInstance = (store) => store && store.__unctx_weak ? store.__unctx_weak.deref() : store;
	const _getCurrentInstance = () => {
		if (als) {
			const store = als.getStore();
			if (store !== void 0) return _unwrapInstance(store);
		}
		return currentInstance;
	};
	return {
		use: () => {
			const _instance = _getCurrentInstance();
			if (_instance === void 0) throw new Error("Context is not available");
			return _instance;
		},
		tryUse: () => {
			return _getCurrentInstance() ?? null;
		},
		set: (instance, replace) => {
			if (!replace) checkConflict(instance);
			currentInstance = instance;
			isSingleton = true;
		},
		unset: () => {
			currentInstance = void 0;
			isSingleton = false;
		},
		call: (instance, callback) => {
			checkConflict(instance);
			currentInstance = instance;
			try {
				return als ? als.run(_wrapInstance(instance), callback) : callback();
			} finally {
				if (!isSingleton) currentInstance = void 0;
			}
		},
		async callAsync(instance, callback) {
			currentInstance = instance;
			const onRestore = () => {
				currentInstance = instance;
			};
			const onLeave = () => currentInstance === instance ? onRestore : void 0;
			asyncHandlers.add(onLeave);
			try {
				const r = als ? als.run(_wrapInstance(instance), callback) : callback();
				if (!isSingleton) currentInstance = void 0;
				return await r;
			} finally {
				asyncHandlers.delete(onLeave);
			}
		}
	};
}
function createNamespace(defaultOpts = {}) {
	const contexts = {};
	return { get(key, opts = {}) {
		if (!contexts[key]) contexts[key] = createContext({
			...defaultOpts,
			...opts
		});
		return contexts[key];
	} };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());
function executeAsync(function_) {
	const restores = [];
	for (const leaveHandler of asyncHandlers) {
		const restore = leaveHandler();
		if (restore) restores.push(restore);
	}
	const restore = () => {
		for (const restore of restores) restore();
	};
	let awaitable = function_();
	if (awaitable && typeof awaitable === "object" && "catch" in awaitable) awaitable = awaitable.catch((error) => {
		restore();
		throw error;
	});
	return [awaitable, restore];
}

//#region node_modules/nuxt/dist/app/diagnostics/_shared.js
/**
* Shared configuration for the runtime (E<N>xxx) diagnostics catalogs.
*
* Catalogs are split by domain and imported directly where used (no barrel),
* so the browser bundle only pulls in the codes a module references. Pair the
* pure-call annotations on each `defineDiagnostics()` with dev-guarded,
* statement-level report calls so report-only diagnostics strip from production.
*
* Codes are stable, fully-qualified `NUXT_E<NNNN>` identifiers. Codes with a
* dedicated docs page resolve a `see:` URL via {@link docsBase}; the rest opt
* out with `docs: false`.
*/
function docsBase(code) {
	return `https://nuxt.com/docs/4.x/errors/${code.replace("NUXT_", "").toLowerCase()}`;
}
var ansi = (open, close) => (s) => `\x1B[${open}m${s}\x1B[${close}m`;
var colors = {
	red: ansi(31, 39),
	yellow: ansi(33, 39),
	cyan: ansi(36, 39),
	gray: ansi(90, 39),
	bold: ansi(1, 22),
	dim: ansi(2, 22)
};
ansiFormatter(colors);
var prodReporter = (diagnostic) => {
	console.error(`[${diagnostic.name}]`);
};
var prodReporters = [prodReporter];
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/core.js
/**
* E1xxx
* Core / Nuxt-instance / lifecycle runtime diagnostics.
*/
var appDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fnuxt.config.mjs
var nuxtLinkDefaults = {
	"componentName": "NuxtLink"};
var asyncDataDefaults = { "deep": false };
var fetchDefaults = {};
//#endregion
//#region node_modules/nuxt/dist/app/nuxt.js
function getNuxtAppCtx(id = "nuxt-app") {
	return getContext(id, { asyncContext: false });
}
var NuxtPluginIndicator = "__nuxt_plugin";
/** @since 3.0.0 */
function createNuxtApp(options) {
	let hydratingCount = 0;
	const nuxtApp = {
		_id: options.id || "nuxt-app",
		_scope: effectScope(),
		provide: void 0,
		versions: {
			get nuxt() {
				return "4.5.2";
			},
			get vue() {
				return nuxtApp.vueApp.version;
			}
		},
		payload: shallowReactive({
			...options.ssrContext?.payload || {},
			data: shallowReactive({}),
			state: reactive({}),
			once: /* @__PURE__ */ new Set(),
			_errors: shallowReactive({})
		}),
		static: { data: {} },
		runWithContext(fn) {
			if (nuxtApp._scope.active && !getCurrentScope()) return nuxtApp._scope.run(() => callWithNuxt(nuxtApp, fn));
			return callWithNuxt(nuxtApp, fn);
		},
		isHydrating: false,
		deferHydration() {
			if (!nuxtApp.isHydrating) return () => {};
			hydratingCount++;
			let called = false;
			return () => {
				if (called) return;
				called = true;
				hydratingCount--;
				if (hydratingCount === 0) {
					nuxtApp.isHydrating = false;
					return nuxtApp.callHook("app:suspense:resolve");
				}
			};
		},
		_asyncDataPromises: {},
		_asyncData: shallowReactive({}),
		_state: shallowReactive({}),
		_payloadRevivers: {},
		...options
	};
	nuxtApp.payload.serverRendered = true;
	if (nuxtApp.ssrContext) {
		nuxtApp.payload.path = nuxtApp.ssrContext.url;
		nuxtApp.ssrContext.nuxt = nuxtApp;
		nuxtApp.ssrContext.payload = nuxtApp.payload;
		nuxtApp.ssrContext.config = {
			public: nuxtApp.ssrContext.runtimeConfig.public,
			app: nuxtApp.ssrContext.runtimeConfig.app
		};
	}
	nuxtApp.hooks = createHooks();
	nuxtApp.hook = nuxtApp.hooks.hook;
	{
		const contextCaller = async function(hooks, args) {
			for (const hook of hooks) await nuxtApp.runWithContext(() => hook(...args));
		};
		nuxtApp.hooks.callHook = (name, ...args) => nuxtApp.hooks.callHookWith(contextCaller, name, args);
	}
	nuxtApp.callHook = nuxtApp.hooks.callHook;
	nuxtApp.provide = (name, value) => {
		const $name = "$" + name;
		defineGetter(nuxtApp, $name, value);
		defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value);
	};
	defineGetter(nuxtApp.vueApp, "$nuxt", nuxtApp);
	defineGetter(nuxtApp.vueApp.config.globalProperties, "$nuxt", nuxtApp);
	const runtimeConfig = options.ssrContext.runtimeConfig;
	nuxtApp.provide("config", runtimeConfig);
	return nuxtApp;
}
/** @since 3.0.0 */
async function applyPlugin(nuxtApp, plugin) {
	if (typeof plugin === "function") {
		const run = () => nuxtApp.runWithContext(() => plugin(nuxtApp));
		const { provide } = await run() || {};
		if (provide && typeof provide === "object") for (const key in provide) nuxtApp.provide(key, provide[key]);
	}
}
/** @since 3.0.0 */
async function applyPlugins(nuxtApp, plugins) {
	return applyPluginsWithDependencies(nuxtApp, plugins);
}
async function applyPluginsWithDependencies(nuxtApp, plugins) {
	const resolvedPlugins = /* @__PURE__ */ new Set();
	const unresolvedPlugins = [];
	const parallels = [];
	let error;
	let promiseDepth = 0;
	async function executePlugin(plugin) {
		const unresolvedPluginsForThisPlugin = plugin.dependsOn?.filter((name) => plugins.some((p) => p._name === name) && !resolvedPlugins.has(name)) ?? [];
		if (unresolvedPluginsForThisPlugin.length > 0) unresolvedPlugins.push([new Set(unresolvedPluginsForThisPlugin), plugin]);
		else {
			const promise = applyPlugin(nuxtApp, plugin).then(async () => {
				if (plugin._name) {
					resolvedPlugins.add(plugin._name);
					await Promise.all(unresolvedPlugins.map(async ([dependsOn, unexecutedPlugin]) => {
						if (dependsOn.has(plugin._name)) {
							dependsOn.delete(plugin._name);
							if (dependsOn.size === 0) {
								promiseDepth++;
								await executePlugin(unexecutedPlugin);
							}
						}
					}));
				}
			}).catch((e) => {
				if (!plugin.parallel && !nuxtApp.payload.error) throw e;
				error ||= e;
			});
			if (plugin.parallel) parallels.push(promise);
			else await promise;
		}
	}
	for (const plugin of plugins) await executePlugin(plugin);
	await Promise.all(parallels);
	if (promiseDepth) for (let i = 0; i < promiseDepth; i++) await Promise.all(parallels);
	if (error) throw nuxtApp.payload.error || error;
}
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtPlugin(plugin) {
	if (typeof plugin === "function") return plugin;
	const _name = plugin._name || plugin.name;
	delete plugin.name;
	return Object.assign(plugin.setup || (() => {}), plugin, {
		[NuxtPluginIndicator]: true,
		_name
	});
}
/**
* Ensures that the setup function passed in has access to the Nuxt instance via `useNuxtApp`.
* @param nuxt A Nuxt instance
* @param setup The function to call
* @since 3.0.0
*/
function callWithNuxt(nuxt, setup, args) {
	const fn = () => setup();
	const nuxtAppCtx = getNuxtAppCtx(nuxt._id);
	return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt, fn));
}
function tryUseNuxtApp(id) {
	let nuxtAppInstance;
	if (hasInjectionContext()) nuxtAppInstance = getCurrentInstance()?.appContext.app.$nuxt;
	nuxtAppInstance ||= getNuxtAppCtx(id).tryUse();
	return nuxtAppInstance || null;
}
function useNuxtApp(id) {
	const nuxtAppInstance = tryUseNuxtApp(id);
	if (!nuxtAppInstance) throw appDiagnostics.NUXT_E1001();
	return nuxtAppInstance;
}
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function useRuntimeConfig(_event) {
	return useNuxtApp().$config;
}
function defineGetter(obj, key, val) {
	Object.defineProperty(obj, key, { get: () => val });
}
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/head.js
/**
* E6xxx
* Head / unhead runtime diagnostics.
*/
var unheadDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/head/runtime/composables.js
/**
* Injects the head client from the Nuxt context or Vue inject.
*/
function injectHead(nuxtApp) {
	const nuxt = nuxtApp || useNuxtApp();
	return nuxt.ssrContext?.head || nuxt.runWithContext(() => {
		if (hasInjectionContext()) {
			const head = inject(headSymbol);
			if (!head) throw unheadDiagnostics.NUXT_E6001();
			return head;
		}
	});
}
function useHead$1(input, options = {}) {
	const head = options.head || injectHead(options.nuxt);
	return useHead(input, {
		head,
		...options
	});
}
function useSeoMeta$1(input, options = {}) {
	const head = options.head || injectHead(options.nuxt);
	return useSeoMeta(input, {
		head,
		...options
	});
}
//#endregion
//#region \0plugin-vue:export-helper
var _plugin_vue_export_helper_default = (sfc, props) => {
	const target = sfc.__vccOpts || sfc;
	for (const [key, val] of props) target[key] = val;
	return target;
};

//#region node_modules/nuxt/dist/app/utils.js
globalThis._importMeta_.url.replace(/\/app\/.*$/, "/");
//#endregion
//#region node_modules/nuxt/dist/app/components/injections.js
var LayoutMetaSymbol = Symbol("layout-meta");
var PageRouteSymbol = Symbol("route");
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/navigation.js
/**
* E2xxx
* Navigation / routing / middleware runtime diagnostics.
*/
var navigationDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/composables/router.js
/** @since 3.0.0 */
var useRouter = () => {
	return useNuxtApp()?.$router;
};
/**
* Whether the current effect scope is (a descendant of) the component instance's scope.
* A detached scope (e.g. `createSharedComposable`) outlives the component, so the
* per-page route injected there would freeze after navigation (#18903).
*/
function isScopeWithinInstance(instance) {
	const instanceScope = instance.scope;
	let scope = getCurrentScope();
	while (scope) {
		if (scope === instanceScope) return true;
		scope = scope.parent;
	}
	return false;
}
/** @since 3.0.0 */
var useRoute$1 = (() => {
	if (hasInjectionContext()) {
		const instance = getCurrentInstance();
		if (!instance || isScopeWithinInstance(instance)) return inject(PageRouteSymbol, useNuxtApp()._route);
	}
	return useNuxtApp()._route;
});
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtRouteMiddleware(middleware) {
	return middleware;
}
/** @since 3.0.0 */
var isProcessingMiddleware = () => {
	try {
		if (useNuxtApp()._processingMiddleware) return true;
	} catch {
		return false;
	}
	return false;
};
var HTML_ATTR_UNSAFE_RE = /[&"'<>]/g;
var HTML_ATTR_ENCODE_MAP = {
	"&": "&amp;",
	"\"": "&quot;",
	"'": "&#x27;",
	"<": "&lt;",
	">": "&gt;"
};
function encodeForHtmlAttr(value) {
	return value.replace(HTML_ATTR_UNSAFE_RE, (c) => HTML_ATTR_ENCODE_MAP[c]);
}
/**
* A helper that aids in programmatic navigation within your Nuxt application.
*
* Can be called on the server and on the client, within pages, route middleware, plugins, and more.
* @param {RouteLocationRaw | undefined | null} [to] - The route to navigate to. Accepts a route object, string path, `undefined`, or `null`. Defaults to '/'.
* @param {NavigateToOptions} [options] - Optional customization for controlling the behavior of the navigation.
* @returns {Promise<void | NavigationFailure | false> | false | void | RouteLocationRaw} The navigation result, which varies depending on context and options.
* @see https://nuxt.com/docs/4.x/api/utils/navigate-to
* @since 3.0.0
*/
var navigateTo = (to, options) => {
	to ||= "/";
	const toPath = typeof to === "string" ? to : "path" in to ? resolveRouteObject(to) : useRouter().resolve(to).href;
	const isExternalHost = hasProtocol(toPath, { acceptRelative: true });
	const isExternal = options?.external || isExternalHost;
	if (isExternal) {
		if (!options?.external) throw navigationDiagnostics.NUXT_E2001({ toPath });
		const { protocol } = new URL(toPath, "http://localhost");
		if (protocol && isScriptProtocol(protocol)) throw navigationDiagnostics.NUXT_E2002({
			toPath,
			protocol
		});
	}
	const inMiddleware = isProcessingMiddleware();
	const router = useRouter();
	const nuxtApp = useNuxtApp();
	if (nuxtApp.ssrContext) {
		const fullPath = typeof to === "string" || isExternal ? toPath : router.resolve(to).fullPath || "/";
		const location = isExternal ? toPath : joinURL((/* @__PURE__ */ useRuntimeConfig()).app.baseURL, fullPath);
		const redirect = async function(response) {
			await nuxtApp.callHook("app:redirected");
			const encodedHeader = encodeURL(location, isExternalHost);
			const encodedLoc = encodeForHtmlAttr(encodedHeader);
			nuxtApp.ssrContext["~renderResponse"] = {
				statusCode: sanitizeStatusCode(options?.redirectCode || 302, 302),
				body: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`,
				headers: { location: encodedHeader }
			};
			return response;
		};
		if (!isExternal && inMiddleware) {
			router.afterEach((final) => final.fullPath === fullPath ? redirect(false) : void 0);
			return to;
		}
		return redirect(!inMiddleware ? void 0 : false);
	}
	if (isExternal) {
		nuxtApp._scope.stop();
		if (options?.replace) (void 0).replace(toPath);
		else (void 0).href = toPath;
		if (inMiddleware) {
			if (!nuxtApp.isHydrating) return false;
			return new Promise(() => {});
		}
		return Promise.resolve();
	}
	const encodedTo = typeof to === "string" ? encodeRoutePath(to) : to;
	return options?.replace ? router.replace(encodedTo) : router.push(encodedTo);
};
/**
* @internal
*/
function resolveRouteObject(to) {
	return withQuery(to.path || "", to.query || {}) + (to.hash || "");
}
/**
* @internal
*/
function encodeURL(location, isExternalHost = false) {
	const url = new URL(location, "http://localhost");
	if (!isExternalHost) return url.pathname.replace(/^\/{2,}/, "/") + url.search + url.hash;
	if (location.startsWith("//")) return url.toString().replace(url.protocol, "");
	return url.toString();
}
/**
* Encode the pathname of a route location string. Ensures decoded paths like
* `/café` are percent-encoded to match vue-router's encoded route records.
* Already-encoded paths are not double-encoded.
* @internal
*/
function encodeRoutePath(url) {
	const parsed = parseURL(url);
	return encodePath(decodePath(parsed.pathname)) + parsed.search + parsed.hash;
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/error.js
var NUXT_ERROR_SIGNATURE = "__nuxt_error";
/** @since 3.0.0 */
var useError = /* @__NO_SIDE_EFFECTS__ */ () => toRef(useNuxtApp().payload, "error");
/** @since 3.0.0 */
var showError = (error) => {
	const nuxtError = createError$1(error);
	try {
		const error = /* @__PURE__ */ useError();
		error.value ||= nuxtError;
	} catch {
		throw nuxtError;
	}
	return nuxtError;
};
/**
* Show the error page unless the current client is a crawler, in which case the
* bot receives the already server-rendered HTML instead (#32137, #35338).
*
* @internal
*/
var _showErrorUnlessCrawler = async (nuxtApp, error) => {
	await nuxtApp.runWithContext(() => showError(error));
};
/** @since 3.0.0 */
var isNuxtError = (error) => !!error && typeof error === "object" && "__nuxt_error" in error;
/** @since 3.0.0 */
var createError$1 = (error) => {
	if (typeof error !== "string" && error.statusText) error.message ??= error.statusText;
	const nuxtError = createError(error);
	Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
		value: true,
		configurable: false,
		writable: false
	});
	Object.defineProperty(nuxtError, "status", {
		get: () => nuxtError.statusCode,
		configurable: true
	});
	Object.defineProperty(nuxtError, "statusText", {
		get: () => nuxtError.statusMessage,
		configurable: true
	});
	return nuxtError;
};
//#endregion
//#region node_modules/nuxt/dist/app/components/utils.js
var ROUTE_KEY_PARENTHESES_RE$1 = /(:\w+)\([^)]+\)/g;
var ROUTE_KEY_SYMBOLS_RE$1 = /(:\w+)[?+*]/g;
var ROUTE_KEY_NORMAL_RE$1 = /:\w+/g;
function generateRouteKey$1(route) {
	const source = route?.meta.key ?? route.path.replace(ROUTE_KEY_PARENTHESES_RE$1, "$1").replace(ROUTE_KEY_SYMBOLS_RE$1, "$1").replace(ROUTE_KEY_NORMAL_RE$1, (r) => route.params[r.slice(1)]?.toString() || "");
	return typeof source === "function" ? source(route) : source;
}
/**
* Utility used within router guards
* return true if the route has been changed with a page change during navigation
*/
function isChangingPage(to, from) {
	if (to === from || from === START_LOCATION) return false;
	if (generateRouteKey$1(to) !== generateRouteKey$1(from)) return true;
	if (to.matched.every((comp, index) => comp.components && comp.components.default === from.matched[index]?.components?.default)) return false;
	return true;
}
var VALID_TAG_RE = /^[a-z][a-z0-9-]*$/i;
/** Return `tag` if it is a safe HTML tag name, otherwise `fallback`. */
function sanitizeTag(tag, fallback) {
	return tag && VALID_TAG_RE.test(tag) ? tag : fallback;
}
//#endregion
//#region node_modules/nuxt/dist/pages/runtime/router.options.js
var router_options_default = { scrollBehavior(to, from, savedPosition) {
	const nuxtApp = useNuxtApp();
	const router = useRouter();
	const hashScrollBehaviour = router.options?.scrollBehaviorType ?? "auto";
	if (to.path.replace(/\/$/, "") === from.path.replace(/\/$/, "")) {
		if (from.hash && !to.hash) return savedPosition ?? {
			left: 0,
			top: 0
		};
		if (to.hash) return {
			el: to.hash,
			top: _getHashElementScrollMarginTop(to.hash),
			behavior: hashScrollBehaviour
		};
		return false;
	}
	if ((typeof to.meta.scrollToTop === "function" ? to.meta.scrollToTop(to, from) : to.meta.scrollToTop) === false) return false;
	if (from === START_LOCATION) return _calculatePosition(to, from, savedPosition, hashScrollBehaviour);
	return new Promise((resolve) => {
		const doScroll = () => {
			requestAnimationFrame(() => {
				if (router.currentRoute.value.fullPath !== to.fullPath) {
					resolve(false);
					return;
				}
				resolve(_calculatePosition(to, from, savedPosition, hashScrollBehaviour));
			});
		};
		nuxtApp.hooks.hookOnce("page:loading:end", () => {
			const transitionPromise = nuxtApp["~transitionPromise"];
			if (transitionPromise) transitionPromise.then(doScroll);
			else doScroll();
		});
	});
} };
function _getHashElementScrollMarginTop(selector) {
	try {
		const elem = (void 0).querySelector(selector);
		if (elem) return (Number.parseFloat(getComputedStyle(elem).scrollMarginTop) || 0) + (Number.parseFloat(getComputedStyle((void 0).documentElement).scrollPaddingTop) || 0);
	} catch {}
	return 0;
}
function _calculatePosition(to, from, savedPosition, defaultHashScrollBehaviour) {
	if (savedPosition) return savedPosition;
	if (to.hash) return {
		el: to.hash,
		top: _getHashElementScrollMarginTop(to.hash),
		behavior: isChangingPage(to, from) ? defaultHashScrollBehaviour : "instant"
	};
	return {
		left: 0,
		top: 0
	};
}
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default = {
	hashMode: false,
	scrollBehaviorType: "auto",
	...router_options_default
};
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-link.js
var firstNonUndefined = (...args) => args.find((arg) => arg !== void 0);
/**
* Reject URL strings that would resolve to a script-capable protocol when used as the
* `href` of an anchor element. Returns the value unchanged when safe, or `null`.
*
* The denylist is delegated to `ufo`'s `isScriptProtocol` so it stays in sync with the
* check used by `navigateTo` (currently `javascript:`, `data:`, `vbscript:`, `blob:`).
* ASCII whitespace and control characters are stripped first because browser URL
* parsers tolerate them before the scheme, and `view-source:` is peeled recursively
* because Chromium resolves it transparently to the inner URL.
*/
function sanitizeExternalHref(value) {
	let candidate = value.replace(/[\u0000-\u001F\s]+/g, "");
	while (candidate.toLowerCase().startsWith("view-source:")) candidate = candidate.slice(12);
	const colon = candidate.indexOf(":");
	if (colon > 0 && isScriptProtocol(candidate.slice(0, colon + 1))) return null;
	return value;
}
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtLink(options) {
	const componentName = options.componentName || "NuxtLink";
	function isHashLinkWithoutHashMode(link) {
		return typeof link === "string" && link.startsWith("#");
	}
	function resolveTrailingSlashBehavior(to, resolve, trailingSlash) {
		const effectiveTrailingSlash = trailingSlash ?? options.trailingSlash;
		if (!to || effectiveTrailingSlash !== "append" && effectiveTrailingSlash !== "remove") return to;
		if (typeof to === "string") return applyTrailingSlashBehavior(to, effectiveTrailingSlash);
		const path = "path" in to && to.path !== void 0 ? to.path : resolve(to).path;
		return {
			...to,
			name: void 0,
			path: applyTrailingSlashBehavior(path, effectiveTrailingSlash)
		};
	}
	function useNuxtLink(props) {
		const router = useRouter();
		const config = /* @__PURE__ */ useRuntimeConfig();
		const hasTarget = computed(() => !!unref(props.target) && unref(props.target) !== "_self");
		const isAbsoluteUrl = computed(() => {
			const path = unref(props.to) || unref(props.href) || "";
			return typeof path === "string" && hasProtocol(path, { acceptRelative: true });
		});
		const builtinRouterLink = resolveComponent("RouterLink");
		const useBuiltinLink = builtinRouterLink && typeof builtinRouterLink !== "string" ? builtinRouterLink.useLink : void 0;
		const isExternal = computed(() => {
			if (unref(props.external)) return true;
			const path = unref(props.to) || unref(props.href) || "";
			if (typeof path === "object") return false;
			return path === "" || isAbsoluteUrl.value;
		});
		const to = computed(() => {
			const path = unref(props.to) || unref(props.href) || "";
			if (isExternal.value) return path;
			return resolveTrailingSlashBehavior(path, router.resolve, unref(props.trailingSlash));
		});
		const link = isExternal.value ? void 0 : useBuiltinLink?.({
			...props,
			to,
			viewTransition: unref(props.viewTransition)
		});
		const href = computed(() => {
			const effectiveTrailingSlash = unref(props.trailingSlash) ?? options.trailingSlash;
			if (!to.value || isAbsoluteUrl.value || isHashLinkWithoutHashMode(to.value)) {
				const raw = to.value;
				return typeof raw === "string" ? sanitizeExternalHref(raw) : raw;
			}
			if (isExternal.value) {
				const path = typeof to.value === "object" && "path" in to.value ? resolveRouteObject(to.value) : to.value;
				const href = typeof path === "object" ? router.resolve(path).href : path;
				const safe = typeof href === "string" ? sanitizeExternalHref(href) : href;
				return safe === null ? null : applyTrailingSlashBehavior(safe, effectiveTrailingSlash);
			}
			if (typeof to.value === "object") return router.resolve(to.value)?.href ?? null;
			return applyTrailingSlashBehavior(joinURL(config.app.baseURL, to.value), effectiveTrailingSlash);
		});
		return {
			to,
			hasTarget,
			isAbsoluteUrl,
			isExternal,
			href,
			isActive: link?.isActive ?? computed(() => to.value === router.currentRoute.value.path),
			isExactActive: link?.isExactActive ?? computed(() => to.value === router.currentRoute.value.path),
			route: link?.route ?? computed(() => router.resolve(to.value)),
			async navigate(_e) {
				if (href.value === null) return;
				await navigateTo(href.value, {
					replace: unref(props.replace),
					external: isExternal.value || hasTarget.value
				});
			}
		};
	}
	return defineComponent({
		name: componentName,
		props: {
			to: {
				type: [String, Object],
				default: void 0,
				required: false
			},
			href: {
				type: [String, Object],
				default: void 0,
				required: false
			},
			target: {
				type: String,
				default: void 0,
				required: false
			},
			rel: {
				type: String,
				default: void 0,
				required: false
			},
			noRel: {
				type: Boolean,
				default: void 0,
				required: false
			},
			prefetch: {
				type: Boolean,
				default: void 0,
				required: false
			},
			prefetchOn: {
				type: [String, Object],
				default: void 0,
				required: false
			},
			noPrefetch: {
				type: Boolean,
				default: void 0,
				required: false
			},
			activeClass: {
				type: String,
				default: void 0,
				required: false
			},
			exactActiveClass: {
				type: String,
				default: void 0,
				required: false
			},
			prefetchedClass: {
				type: String,
				default: void 0,
				required: false
			},
			replace: {
				type: Boolean,
				default: void 0,
				required: false
			},
			ariaCurrentValue: {
				type: String,
				default: void 0,
				required: false
			},
			external: {
				type: Boolean,
				default: void 0,
				required: false
			},
			custom: {
				type: Boolean,
				default: void 0,
				required: false
			},
			trailingSlash: {
				type: String,
				default: void 0,
				required: false
			}
		},
		useLink: useNuxtLink,
		setup(props, { slots }) {
			const router = useRouter();
			const { to, href, navigate, isExternal, hasTarget, isAbsoluteUrl } = useNuxtLink(props);
			const prefetched = shallowRef(false);
			const el = void 0;
			const elRef = void 0;
			function shouldPrefetch(mode) {
				return false;
			}
			async function prefetch(nuxtApp = useNuxtApp()) {}
			return () => {
				const target = props.target || null;
				const rel = firstNonUndefined(props.noRel ? "" : props.rel, options.externalRelAttribute, isAbsoluteUrl.value || hasTarget.value ? "noopener noreferrer" : "") || null;
				const getCustomSlotProps = (routerLinkSlotProps) => ({
					href: href.value,
					navigate,
					get route() {
						if (!href.value) return;
						const url = new URL(href.value, "http://localhost");
						return {
							path: url.pathname,
							fullPath: url.pathname,
							get query() {
								return parseQuery(url.search);
							},
							hash: url.hash,
							params: {},
							name: void 0,
							matched: [],
							redirectedFrom: void 0,
							meta: {},
							href: href.value
						};
					},
					rel,
					target,
					isExternal: isExternal.value || hasTarget.value,
					isActive: false,
					isExactActive: false,
					...routerLinkSlotProps,
					prefetch,
					prefetched: prefetched.value,
					shouldPrefetch
				});
				if (!isExternal.value && !hasTarget.value && !isHashLinkWithoutHashMode(to.value)) {
					const routerLinkProps = {
						ref: elRef,
						to: to.value,
						activeClass: props.activeClass || options.activeClass,
						exactActiveClass: props.exactActiveClass || options.exactActiveClass,
						replace: props.replace,
						ariaCurrentValue: props.ariaCurrentValue,
						custom: props.custom
					};
					if (!props.custom) routerLinkProps.rel = props.rel || void 0;
					return h(resolveComponent("RouterLink"), routerLinkProps, props.custom && slots.default ? { default: (slotProps) => slots.default(getCustomSlotProps(slotProps)) } : slots.default);
				}
				if (props.custom) {
					if (!slots.default) return null;
					return slots.default(getCustomSlotProps());
				}
				return h("a", {
					ref: el,
					href: href.value || null,
					rel,
					target,
					onClick: async (event) => {
						if (isExternal.value || hasTarget.value) return;
						event.preventDefault();
						try {
							const encodedHref = encodeRoutePath(href.value ?? "");
							return await (props.replace ? router.replace(encodedHref) : router.push(encodedHref));
						} finally {}
					}
				}, slots.default?.());
			};
		}
	});
}
var NuxtLink = /* @__PURE__ */ defineNuxtLink(nuxtLinkDefaults);
function applyTrailingSlashBehavior(to, trailingSlash) {
	if (trailingSlash !== "append" && trailingSlash !== "remove") return to;
	const normalizeFn = trailingSlash === "append" ? withTrailingSlash : withoutTrailingSlash;
	if (hasProtocol(to) && !to.startsWith("http")) return to;
	return normalizeFn(to, true);
}

//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	__defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget);
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Ffetch.mjs
if (!globalThis.$fetch) globalThis.$fetch = $fetch.create({ baseURL: baseURL() });
var $fetch$2 = globalThis.$fetch;
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fglobal-polyfills.mjs
if (!("global" in globalThis)) globalThis.global = globalThis;
//#endregion
//#region node_modules/nuxt/dist/app/utils/hash.js
/**
* Hash an arbitrary value into a short, stable string key.
*
* Values are serialized to a canonical, locale-independent representation
* (equal structures hash equally regardless of key order or runtime locale),
* then digested with a fast non-cryptographic hash. This is what `useFetch` and
* `useAsyncData` use internally to derive their cache keys, so it is safe to use
* for the same purpose in your own code.
*
* The digest is non-cryptographic and must not be used for integrity checks.
*
* @since 4.5.0
*/
function hashKey(value) {
	return fnv1a64Base36(identify(value));
}
//#endregion
//#region node_modules/nuxt/dist/app/utils/debounce-tick.js
/**
* Debounce an async function so that repeated calls within the same tick are
* collapsed into a single call (plus a trailing call if arguments arrived
* while the debounced call was still pending).
*
* Adapted from https://github.com/unjs/perfect-debounce with the timeout
* replaced by Vue's post-flush callback queue.
*/
function debounceTick(fn, options = {}) {
	let leadingValue;
	let active = false;
	let resolveList = [];
	let currentPromise;
	let trailingArgs;
	const applyFn = (_this, args) => {
		const promise = _applyPromised(fn, _this, args);
		currentPromise = promise;
		promise.finally(() => {
			currentPromise = void 0;
			if (trailingArgs && !active) {
				const args = trailingArgs;
				trailingArgs = void 0;
				applyFn(_this, args);
			}
		});
		return promise;
	};
	return function(...args) {
		trailingArgs = args;
		if (currentPromise) return currentPromise;
		return new Promise((resolve) => {
			const shouldCallNow = options.leading && !active;
			if (!active) {
				active = true;
				queuePostFlushCb(() => {
					active = false;
					const flushArgs = trailingArgs ?? args;
					trailingArgs = void 0;
					const promise = options.leading ? leadingValue : applyFn(this, flushArgs);
					for (const _resolve of resolveList) _resolve(promise);
					resolveList = [];
				});
			}
			if (shouldCallNow) {
				leadingValue = applyFn(this, args);
				resolve(leadingValue);
			} else resolveList.push(resolve);
		});
	};
}
async function _applyPromised(fn, _this, args) {
	return await fn.apply(_this, args);
}
//#endregion
//#region node_modules/nuxt/dist/app/components/server-placeholder.js
var ServerPlaceholder = defineComponent({
	name: "ServerPlaceholder",
	render() {
		return createElementBlock("div");
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/components/client-only.js
var clientOnlySymbol = Symbol.for("nuxt:client-only");
defineComponent({
	name: "ClientOnly",
	inheritAttrs: false,
	props: [
		"fallback",
		"placeholder",
		"placeholderTag",
		"fallbackTag"
	],
	setup(props, { slots, attrs }) {
		const mounted = shallowRef(false);
		const vm = getCurrentInstance();
		if (vm) vm._nuxtClientOnly = true;
		provide(clientOnlySymbol, true);
		return () => {
			if (mounted.value) {
				const vnodes = slots.default?.();
				if (vnodes && vnodes.length === 1) return [cloneVNode(vnodes[0], attrs)];
				return vnodes;
			}
			const slot = slots.fallback || slots.placeholder;
			if (slot) return h(slot);
			const fallbackStr = props.fallback || props.placeholder || "";
			const fallbackTag = sanitizeTag(props.fallbackTag || props.placeholderTag, "span");
			return createElementBlock(fallbackTag, attrs, fallbackStr);
		};
	}
});
//#endregion
//#region node_modules/nuxt/dist/compiler/runtime/index.js
/**
* Define a factory for a function that should be registered for automatic key injection.
* @since 4.2.0
* @param factory
*/
function defineKeyedFunctionFactory(factory) {
	const placeholder = function() {
		throw appDiagnostics.NUXT_E1007({ name: factory.name });
	};
	return Object.defineProperty(placeholder, "__nuxt_factory", {
		enumerable: false,
		get: () => factory.factory
	});
}
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/data.js
/**
* E3xxx
* Data fetching (useFetch / useAsyncData) runtime diagnostics.
*/
var dataDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/composables/asyncData.js
var createUseAsyncData = defineKeyedFunctionFactory({
	name: "createUseAsyncData",
	factory(options = {}) {
		function useAsyncData(...args) {
			const autoKey = typeof args[args.length - 1] === "string" ? args.pop() : void 0;
			if (_isAutoKeyNeeded(args[0], args[1])) args.unshift(autoKey);
			let [_key, _handler, opts = {}] = args;
			const key = isRef(_key) || typeof _key === "function" ? computed(() => toValue(_key)) : { value: _key };
			if (!key.value || typeof key.value !== "string") throw dataDiagnostics.NUXT_E3008();
			if (typeof _handler !== "function") throw dataDiagnostics.NUXT_E3009();
			const shouldFactoryOptionsOverride = typeof options === "function";
			const nuxtApp = useNuxtApp();
			const factoryOptions = shouldFactoryOptionsOverride ? options(opts) : options;
			if (!shouldFactoryOptionsOverride) for (const key in factoryOptions) {
				if (factoryOptions[key] === void 0) continue;
				if (opts[key] !== void 0) continue;
				opts[key] = factoryOptions[key];
			}
			opts.server ??= true;
			opts.default ??= getDefault;
			opts.getCachedData ??= getDefaultCachedData;
			opts.lazy ??= false;
			opts.immediate ??= true;
			opts.deep ??= asyncDataDefaults.deep;
			opts.dedupe ??= "cancel";
			opts.enabled ??= true;
			if (shouldFactoryOptionsOverride) for (const key in factoryOptions) {
				if (factoryOptions[key] === void 0) continue;
				opts[key] = factoryOptions[key];
			}
			nuxtApp._asyncData[key.value];
			function createInitialFetch() {
				const initialFetchOptions = {
					cause: "initial",
					dedupe: opts.dedupe
				};
				const existing = nuxtApp._asyncData[key.value];
				if (!existing?._init) {
					initialFetchOptions.cachedData = opts.getCachedData(key.value, nuxtApp, { cause: "initial" });
					nuxtApp._asyncData[key.value] = buildAsyncData(nuxtApp, key.value, _handler, opts, initialFetchOptions.cachedData);
					nuxtApp._asyncData[key.value]._initialCachedData = initialFetchOptions.cachedData;
				} else if (nuxtApp._asyncDataPromises[key.value]) initialFetchOptions.cachedData = existing._initialCachedData;
				return () => nuxtApp._asyncData[key.value].execute(initialFetchOptions);
			}
			const initialFetch = createInitialFetch();
			const asyncData = nuxtApp._asyncData[key.value];
			asyncData._deps++;
			if (opts.server !== false && nuxtApp.payload.serverRendered && opts.immediate) {
				const promise = initialFetch();
				if (getCurrentInstance()) onServerPrefetch(() => promise);
				else nuxtApp.hook("app:created", async () => {
					await promise;
				});
			}
			const asyncReturn = {
				data: writableComputedRef(() => nuxtApp._asyncData[key.value]?.data),
				pending: writableComputedRef(() => nuxtApp._asyncData[key.value]?.pending),
				status: writableComputedRef(() => nuxtApp._asyncData[key.value]?.status),
				error: writableComputedRef(() => nuxtApp._asyncData[key.value]?.error),
				refresh: (...args) => {
					if (!nuxtApp._asyncData[key.value]?._init) return createInitialFetch()();
					return nuxtApp._asyncData[key.value].execute(...args);
				},
				execute: (...args) => asyncReturn.refresh(...args),
				clear: () => {
					const entry = nuxtApp._asyncData[key.value];
					if (entry?._abortController) try {
						entry._abortController.abort(new DOMException("AsyncData aborted by user.", "AbortError"));
					} finally {
						entry._abortController = void 0;
					}
					clearNuxtDataByKey(nuxtApp, key.value);
				}
			};
			const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key.value]).then(() => asyncReturn);
			Object.assign(asyncDataPromise, asyncReturn);
			Object.defineProperties(asyncDataPromise, {
				then: {
					enumerable: true,
					value: asyncDataPromise.then.bind(asyncDataPromise)
				},
				catch: {
					enumerable: true,
					value: asyncDataPromise.catch.bind(asyncDataPromise)
				},
				finally: {
					enumerable: true,
					value: asyncDataPromise.finally.bind(asyncDataPromise)
				}
			});
			return asyncDataPromise;
		}
		return useAsyncData;
	}
});
var useAsyncData = createUseAsyncData.__nuxt_factory();
createUseAsyncData.__nuxt_factory({
	lazy: true,
	_functionName: "useLazyAsyncData"
});
function writableComputedRef(getter) {
	return computed({
		get() {
			return getter()?.value;
		},
		set(value) {
			const ref = getter();
			if (ref) ref.value = value;
		}
	});
}
function _isAutoKeyNeeded(keyOrFetcher, fetcher) {
	if (typeof keyOrFetcher === "string") return false;
	if (typeof keyOrFetcher === "object" && keyOrFetcher !== null) return false;
	if (typeof keyOrFetcher === "function" && typeof fetcher === "function") return false;
	return true;
}
function clearNuxtDataByKey(nuxtApp, key) {
	delete nuxtApp.payload.data[key];
	delete nuxtApp.payload._errors[key];
	if (nuxtApp._asyncData[key]) {
		nuxtApp._asyncData[key].data.value = unref(nuxtApp._asyncData[key]._default());
		nuxtApp._asyncData[key].error.value = void 0;
		nuxtApp._asyncData[key].status.value = "idle";
		nuxtApp._asyncData[key]._initialCachedData = void 0;
	}
	delete nuxtApp._asyncDataPromises[key];
}
function pick(obj, keys) {
	const newObj = {};
	for (const key of keys) newObj[key] = obj[key];
	return newObj;
}
function buildAsyncData(nuxtApp, key, _handler, options, initialCachedData) {
	nuxtApp.payload._errors[key] ??= void 0;
	const hasCustomGetCachedData = options.getCachedData !== getDefaultCachedData;
	const handler = _handler ;
	const _ref = options.deep ? ref : shallowRef;
	const hasCachedData = initialCachedData !== void 0;
	const unsubRefreshAsyncData = nuxtApp.hook("app:data:refresh", async (keys) => {
		if (!keys || keys.includes(key)) await asyncData.execute({ cause: "refresh:hook" });
	});
	const asyncData = {
		data: _ref(hasCachedData ? initialCachedData : options.default()),
		pending: computed(() => asyncData.status.value === "pending"),
		error: toRef(nuxtApp.payload._errors, key),
		status: shallowRef("idle"),
		execute: (...args) => {
			const [_opts, newValue = void 0] = args;
			const opts = _opts && newValue === void 0 && typeof _opts === "object" ? _opts : {};
			if (nuxtApp._asyncDataPromises[key]) {
				if ((opts.dedupe ?? options.dedupe) === "defer") return nuxtApp._asyncDataPromises[key];
			}
			{
				const cachedData = "cachedData" in opts ? opts.cachedData : options.getCachedData(key, nuxtApp, { cause: opts.cause ?? "refresh:manual" });
				if (cachedData !== void 0) {
					nuxtApp.payload.data[key] = asyncData.data.value = cachedData;
					asyncData.error.value = void 0;
					asyncData.status.value = "success";
					return Promise.resolve(cachedData);
				}
			}
			if (toValue(options.enabled) === false) return Promise.resolve(asyncData.data.value);
			if (asyncData._abortController) asyncData._abortController.abort(new DOMException("AsyncData request cancelled by deduplication", "AbortError"));
			asyncData._abortController = new AbortController();
			asyncData.status.value = "pending";
			const cleanupController = new AbortController();
			const promise = new Promise((resolve, reject) => {
				try {
					const timeout = opts.timeout ?? options.timeout;
					const mergedSignal = mergeAbortSignals([asyncData._abortController?.signal, opts?.signal], cleanupController.signal, timeout);
					if (mergedSignal.aborted) {
						const reason = mergedSignal.reason;
						reject(reason instanceof Error ? reason : new DOMException(String(reason ?? "Aborted"), "AbortError"));
						return;
					}
					mergedSignal.addEventListener("abort", () => {
						const reason = mergedSignal.reason;
						reject(reason instanceof Error ? reason : new DOMException(String(reason ?? "Aborted"), "AbortError"));
					}, {
						once: true,
						signal: cleanupController.signal
					});
					return Promise.resolve(handler(nuxtApp, { signal: mergedSignal })).then(resolve, reject);
				} catch (err) {
					reject(err);
				}
			}).then(async (_result) => {
				if (nuxtApp._asyncDataPromises[key] !== promise) return;
				let result = _result;
				if (options.transform) result = await options.transform(_result);
				if (options.pick) result = pick(result, options.pick);
				nuxtApp.payload.data[key] = result;
				asyncData.data.value = result;
				asyncData.error.value = void 0;
				asyncData.status.value = "success";
			}).catch((error) => {
				if (nuxtApp._asyncDataPromises[key] !== promise) return nuxtApp._asyncDataPromises[key];
				if (asyncData._abortController?.signal.aborted) return nuxtApp._asyncDataPromises[key];
				if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
					asyncData.status.value = "idle";
					return nuxtApp._asyncDataPromises[key];
				}
				asyncData.error.value = createError$1(error);
				asyncData.data.value = unref(options.default());
				asyncData.status.value = "error";
			}).finally(() => {
				cleanupController.abort();
				if (nuxtApp._asyncDataPromises[key] === promise) delete nuxtApp._asyncDataPromises[key];
			});
			nuxtApp._asyncDataPromises[key] = promise;
			return nuxtApp._asyncDataPromises[key];
		},
		_execute: debounceTick((...args) => asyncData.execute(...args)),
		_default: options.default,
		_deps: 0,
		_init: true,
		_hash: void 0,
		_off: () => {
			unsubRefreshAsyncData();
			if (nuxtApp._asyncData[key]?._init) nuxtApp._asyncData[key]._init = false;
			if (nuxtApp._asyncDataPromises[key]) {
				asyncData._abortController?.abort(new DOMException("AsyncData request cancelled by unmount", "AbortError"));
				delete nuxtApp._asyncDataPromises[key];
				if (asyncData.status.value === "pending") asyncData.status.value = "idle";
			}
			if (!hasCustomGetCachedData) nextTick(() => {
				if (!nuxtApp._asyncData[key]?._init) {
					clearNuxtDataByKey(nuxtApp, key);
					asyncData.execute = () => Promise.resolve();
				}
			});
		}
	};
	return asyncData;
}
var getDefault = () => void 0;
var getDefaultCachedData = (key, nuxtApp, ctx) => {
	if (nuxtApp.isHydrating) return nuxtApp.payload.data[key];
	if (ctx.cause !== "refresh:manual" && ctx.cause !== "refresh:hook") return nuxtApp.static.data[key];
};
function mergeAbortSignals(signals, cleanupSignal, timeout) {
	const list = signals.filter((s) => !!s);
	if (typeof timeout === "number" && timeout >= 0) {
		const timeoutSignal = AbortSignal.timeout?.(timeout);
		if (timeoutSignal) list.push(timeoutSignal);
	}
	if (AbortSignal.any) return AbortSignal.any(list);
	const controller = new AbortController();
	for (const sig of list) if (sig.aborted) {
		const reason = sig.reason ?? new DOMException("Aborted", "AbortError");
		try {
			controller.abort(reason);
		} catch {
			controller.abort();
		}
		return controller.signal;
	}
	const onAbort = () => {
		const reason = list.find((s) => s.aborted)?.reason ?? new DOMException("Aborted", "AbortError");
		try {
			controller.abort(reason);
		} catch {
			controller.abort();
		}
	};
	for (const sig of list) sig.addEventListener?.("abort", onAbort, {
		once: true,
		signal: cleanupSignal
	});
	return controller.signal;
}
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/state.js
/**
* E7xxx
* Payload / state / cookie runtime diagnostics.
*/
var stateDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/composables/state.js
var useStateKeyPrefix = "$s";
function useState(...args) {
	const autoKey = typeof args[args.length - 1] === "string" ? args.pop() : void 0;
	if (typeof args[0] !== "string") args.unshift(autoKey);
	const [_key, init] = args;
	if (!_key || typeof _key !== "string") throw stateDiagnostics.NUXT_E7009({ key: _key });
	if (init !== void 0 && typeof init !== "function") throw stateDiagnostics.NUXT_E7007({ type: typeof init });
	const key = useStateKeyPrefix + _key;
	const nuxtApp = useNuxtApp();
	const state = toRef(nuxtApp.payload.state, key);
	if (init) nuxtApp._state[key] ??= { _default: init };
	if (state.value === void 0 && init) {
		const initialValue = init();
		if (isRef(initialValue)) {
			nuxtApp.payload.state[key] = initialValue;
			return initialValue;
		}
		state.value = initialValue;
	}
	return state;
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/ssr.js
var $fetch$1$1 = $fetch$2;
/** @since 3.0.0 */
function useRequestEvent(nuxtApp) {
	nuxtApp ||= useNuxtApp();
	return nuxtApp.ssrContext?.event;
}
/** @since 3.2.0 */
function useRequestFetch() {
	return useRequestEvent()?.$fetch || $fetch$1$1;
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/fetch.js
var $fetch$1 = $fetch$2;
var MAYBE_REF_OR_GETTER_OPTION_KEYS = [
	"method",
	"baseURL",
	"query",
	"params",
	"body",
	"headers"
];
function generateOptionSegments(opts) {
	const segments = [toValue(opts.method)?.toUpperCase() || "GET", toValue(opts.baseURL)];
	for (const _obj of [opts.query || opts.params]) {
		const obj = toValue(_obj);
		if (!obj) continue;
		const unwrapped = {};
		for (const [key, value] of Object.entries(obj)) unwrapped[toValue(key)] = toValue(value);
		segments.push(unwrapped);
	}
	if (opts.body) {
		const value = toValue(opts.body);
		if (!value) segments.push(hashKey(value));
		else if (value instanceof ArrayBuffer) segments.push(hashKey(Object.fromEntries([...new Uint8Array(value).entries()].map(([k, v]) => [k, v.toString()]))));
		else if (value instanceof FormData) {
			const entries = [];
			for (const entry of value.entries()) {
				const [key, val] = entry;
				entries.push([key, val instanceof File ? `${val.name}:${val.size}:${val.lastModified}` : val]);
			}
			segments.push(hashKey(entries));
		} else if (isPlainObject(value)) segments.push(hashKey(reactive(value)));
		else try {
			segments.push(hashKey(value));
		} catch {
			dataDiagnostics.NUXT_E3002({ cause: value });
		}
	}
	return segments;
}
/**
* A factory function to create a custom `useFetch` composable with pre-defined default options.
* @since 4.2.0
*/
var createUseFetch = defineKeyedFunctionFactory({
	name: "createUseFetch",
	factory(options = {}) {
		function useFetch(request, arg1, arg2) {
			const [opts = {}, autoKey] = typeof arg1 === "string" ? [{}, arg1] : [arg1, arg2];
			const factoryOptions = typeof options === "function" ? options(opts) : options;
			const { server, lazy, default: defaultFn, transform, pick, watch: watchSources, immediate, getCachedData, deep, dedupe, timeout, enabled, ...fetchOptions } = {
				...typeof options === "function" ? {} : factoryOptions,
				...opts,
				...typeof options === "function" ? factoryOptions : {}
			};
			const _request = computed(() => toValue(request));
			const key = computed(() => toValue(fetchOptions.key) || "$f" + hashKey([
				autoKey,
				typeof _request.value === "string" ? _request.value : "",
				...generateOptionSegments(fetchOptions)
			]));
			if (!fetchOptions.baseURL && typeof _request.value === "string" && _request.value[0] === "/" && _request.value[1] === "/") throw dataDiagnostics.NUXT_E3001({ url: _request.value });
			const _fetchOptions = reactive({
				...fetchDefaults,
				...fetchOptions,
				cache: typeof fetchOptions.cache === "boolean" ? void 0 : fetchOptions.cache
			});
			const _asyncDataOptions = {
				server,
				lazy,
				default: defaultFn,
				transform,
				pick,
				immediate,
				getCachedData,
				deep,
				dedupe,
				timeout,
				enabled,
				watch: watchSources === false ? [] : [...watchSources || [], _fetchOptions]
			};
			if (watchSources === false) _asyncDataOptions._keyTriggersExecute = false;
			return useAsyncData(key, (_, { signal }) => {
				let _$fetch = fetchOptions.$fetch || $fetch$1;
				if (!fetchOptions.$fetch) {
					if (typeof _request.value === "string" && _request.value[0] === "/" && (!toValue(fetchOptions.baseURL) || toValue(fetchOptions.baseURL)[0] === "/")) _$fetch = useRequestFetch();
				}
				const resolvedOptions = {
					signal,
					..._fetchOptions
				};
				for (const key of MAYBE_REF_OR_GETTER_OPTION_KEYS) if (typeof resolvedOptions[key] === "function") resolvedOptions[key] = toValue(resolvedOptions[key]);
				return _$fetch(_request.value, resolvedOptions);
			}, _asyncDataOptions);
		}
		return useFetch;
	}
});
createUseFetch.__nuxt_factory();
createUseFetch.__nuxt_factory({
	lazy: true,
	_functionName: "useLazyFetch"
});
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/manifest.js
/**
* E5xxx
* App manifest / route-rules runtime diagnostics.
*/
var manifestDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Froute-rules.mjs
var sensitiveMatcher = /* @__PURE__ */ (() => {
	const $0 = {};
	return (m, p) => {
		let r = [];
		if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1);
		if (p === "/_nuxt") r.push({ data: $0 });
		else if (p.charCodeAt(p.length - 1) === 47) {
			if (p === "/_nuxt/") r.push({ data: $0 });
		}
		let s = p.split("/");
		if (s.length > 1 && s[s.length - 1] === "") {
			s.pop();
			p = p.slice(0, -1);
		}
		s.length;
		r.push({
			data: $0,
			params: { "_": p.slice(1) }
		});
		return r.reverse();
	};
})();
var foldedMatcher = sensitiveMatcher;
var decodeRoutePath = function decodeRoutePath(path) {
	if (!path.includes("%")) return path;
	const queryIndex = path.indexOf("?");
	const pathname = queryIndex === -1 ? path : path.slice(0, queryIndex);
	try {
		return queryIndex === -1 ? decodeURI(pathname) : decodeURI(pathname) + path.slice(queryIndex);
	} catch {
		return path;
	}
};
var normalizePath = (path, fold) => {
	if (typeof path !== "string") return path;
	const decoded = decodeRoutePath(path);
	return fold ? decoded.toLowerCase() : decoded;
};
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froute_rules_default = (path) => virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.sensitive ? defu({}, ...sensitiveMatcher("", normalizePath(path, false)).map((r) => r.data).reverse()) : defu({}, ...foldedMatcher("", normalizePath(path, true)).map((r) => r.data).reverse());
//#endregion
//#region node_modules/nuxt/dist/app/composables/manifest.js
var routeRulesMatcher = virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froute_rules_default;
function getRouteRules(arg) {
	const path = typeof arg === "string" ? arg : arg.path;
	try {
		return routeRulesMatcher(path);
	} catch (e) {
		manifestDiagnostics.NUXT_E5003({
			path,
			cause: e
		});
		return {};
	}
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/payload.js
/**
* This is an experimental function for configuring passing rich data from server -> client.
* @since 3.4.0
*/
function definePayloadReducer(name, reduce) {
	useNuxtApp().ssrContext["~payloadReducers"][name] = reduce;
}
//#endregion
//#region node_modules/nuxt-site-config/dist/runtime/app/plugins/0.siteConfig.js
var _0_siteConfig_default = defineNuxtPlugin({
	name: "nuxt-site-config:init",
	enforce: "pre",
	async setup(nuxtApp) {
		const stack = useRequestEvent()?.context?.siteConfig;
		const state = useState("site-config");
		nuxtApp.hooks.hook("app:rendered", () => {
			state.value = stack?.get({
				debug: useRuntimeConfig()["nuxt-site-config"].debug,
				resolveRefs: true
			});
		});
		return { provide: { nuxtSiteConfig: stack } };
	}
});
//#endregion
//#region node_modules/nuxt/dist/head/runtime/island-head.js
/**
* No-op `head.push` until the returned `unfreeze` runs. Plugin/transformer
* augmentations on the same head are unaffected.
*/
function freezeHead(head) {
	const realPush = head.push;
	head.push = () => ({
		dispose: () => {},
		patch: () => {},
		_i: 0
	});
	return () => {
		head.push = realPush;
	};
}
//#endregion
//#region node_modules/nuxt/dist/head/runtime/plugins/unhead.server.js
var plugin$2 = defineNuxtPlugin({
	name: "nuxt:head",
	enforce: "pre",
	setup(nuxtApp) {
		const head = nuxtApp.ssrContext.head;
		if (nuxtApp.ssrContext.islandContext) {
			const unfreeze = freezeHead(head);
			nuxtApp.hooks.hookOnce("app:created", unfreeze);
		}
		nuxtApp.vueApp.use(head);
	}
});
//#endregion
//#region node_modules/nuxt/dist/pages/runtime/utils.js
var ROUTE_KEY_PARENTHESES_RE = /(:\w+)\([^)]+\)/g;
var ROUTE_KEY_SYMBOLS_RE = /(:\w+)[?+*]/g;
var ROUTE_KEY_NORMAL_RE = /:\w+/g;
var interpolatePath = (route, match) => {
	return match.path.replace(ROUTE_KEY_PARENTHESES_RE, "$1").replace(ROUTE_KEY_SYMBOLS_RE, "$1").replace(ROUTE_KEY_NORMAL_RE, (r) => route.params[r.slice(1)]?.toString() || "");
};
var generateRouteKey = (routeProps, override) => {
	const matchedRoute = routeProps.route.matched.find((m) => m.components?.default === routeProps.Component.type);
	const source = matchedRoute?.meta.key ?? (matchedRoute && interpolatePath(routeProps.route, matchedRoute));
	return typeof source === "function" ? source(routeProps.route) : source;
};
/** @since 3.9.0 */
function toArray(value) {
	return Array.isArray(value) ? value : [value];
}
Object.assign(Object.create(null), {});
var pageIslandRoutes = Object.assign(Object.create(null), {});
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fmiddleware.mjs
var globalMiddleware = [defineNuxtRouteMiddleware(async (to) => {
	let __temp, __restore;
	if (!to.meta?.validate) return;
	const result = ([__temp, __restore] = executeAsync(() => Promise.resolve(to.meta.validate(to))), __temp = await __temp, __restore(), __temp);
	if (result === true) return;
	return createError$1({
		fatal: false,
		status: result && (result.status || result.statusCode) || 404,
		statusText: result && (result.statusText || result.statusMessage) || `Page Not Found: ${to.fullPath}`,
		data: { path: to.fullPath }
	});
}), /* @__PURE__ */ defineNuxtRouteMiddleware((to) => {})];
var namedMiddleware = {};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Froutes.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froutes_default = [
	{
		name: "challenge",
		path: "/challenge",
		component: () => import('../build/challenge-BStf7egi.mjs')
	},
	{
		name: "daily",
		path: "/daily",
		component: () => import('../build/daily-BZTDAkGm.mjs')
	},
	{
		name: "how-to-play",
		path: "/how-to-play",
		component: () => import('../build/how-to-play-xShEJZeY.mjs')
	},
	{
		name: "play",
		path: "/play",
		component: () => import('../build/play-CpiaGmUL.mjs')
	},
	{
		name: "index",
		path: "/",
		component: () => import('../build/pages-CrSTlol6.mjs')
	}
];
//#endregion
//#region node_modules/nuxt/dist/pages/runtime/plugins/router.js
var plugin$1 = defineNuxtPlugin({
	name: "nuxt:router",
	enforce: "pre",
	async setup(nuxtApp) {
		let __temp, __restore;
		let routerBase = useRuntimeConfig().app.baseURL;
		const history = virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.history?.(routerBase) ?? createMemoryHistory(routerBase);
		const routes = virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.routes ? ([__temp, __restore] = executeAsync(() => virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.routes(virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froutes_default)), __temp = await __temp, __restore(), __temp) ?? virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froutes_default : virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froutes_default;
		let startPosition;
		const router = createRouter({
			...virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default,
			scrollBehavior: (to, from, savedPosition) => {
				if (from === START_LOCATION) {
					startPosition = savedPosition;
					return;
				}
				if (virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.scrollBehavior) {
					router.options.scrollBehavior = virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.scrollBehavior;
					if ("scrollRestoration" in (void 0).history) {
						const unsub = router.beforeEach(() => {
							unsub();
							(void 0).history.scrollRestoration = "manual";
						});
					}
					return virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.scrollBehavior(to, START_LOCATION, startPosition || savedPosition);
				}
			},
			history,
			routes
		});
		nuxtApp.vueApp.use(router);
		const previousRoute = shallowRef(router.currentRoute.value);
		router.afterEach((_to, from) => {
			previousRoute.value = from;
		});
		Object.defineProperty(nuxtApp.vueApp.config.globalProperties, "previousRoute", { get: () => previousRoute.value });
		const initialURL = nuxtApp.ssrContext.url;
		const _route = shallowRef(router.currentRoute.value);
		const syncCurrentRoute = () => {
			_route.value = router.currentRoute.value;
		};
		router.afterEach((to, from) => {
			const lastTo = to.matched.at(-1)?.components?.default;
			const lastFrom = from.matched.at(-1)?.components?.default;
			if (lastTo === lastFrom) {
				if (generateRouteKey({
					route: to,
					Component: { type: lastTo }
				}) === generateRouteKey({
					route: from,
					Component: { type: lastFrom }
				})) syncCurrentRoute();
				return;
			}
			if (to.matched.length < from.matched.length && to.matched.every((m, i) => m.components?.default === from.matched[i]?.components?.default)) syncCurrentRoute();
		});
		const route = { sync: syncCurrentRoute };
		for (const key in _route.value) Object.defineProperty(route, key, {
			get: () => _route.value[key],
			enumerable: true
		});
		nuxtApp._route = shallowReactive(route);
		nuxtApp._middleware ||= {
			global: [],
			named: {}
		};
		const error = useError();
		const isServerPage = nuxtApp.ssrContext?.islandContext?.name?.startsWith("page_");
		if (!nuxtApp.ssrContext?.islandContext || isServerPage) router.afterEach(async (to, _from, failure) => {
			delete nuxtApp._processingMiddleware;
			delete nuxtApp._middlewareTo;
			if (failure) await nuxtApp.callHook("page:loading:end");
			if (failure?.type === 4) return;
			if (to.redirectedFrom && to.fullPath !== initialURL) await nuxtApp.runWithContext(() => navigateTo(to.fullPath || "/"));
		});
		try {
			[__temp, __restore] = executeAsync(() => router.push(initialURL)), __temp = await __temp, __restore();
			[__temp, __restore] = executeAsync(() => router.isReady()), await __temp, __restore();
		} catch (error) {
			[__temp, __restore] = executeAsync(() => _showErrorUnlessCrawler(nuxtApp, error)), await __temp, __restore();
		}
		const resolvedInitialRoute = router.currentRoute.value;
		syncCurrentRoute();
		if (nuxtApp.ssrContext?.islandContext && !isServerPage) return { provide: { router } };
		const initialLayout = nuxtApp.payload.state._layout;
		router.beforeEach(async (to, from) => {
			await nuxtApp.callHook("page:loading:start");
			to.meta = reactive(to.meta);
			if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) to.meta.layout = initialLayout;
			nuxtApp._processingMiddleware = true;
			nuxtApp._middlewareTo = to;
			if (!nuxtApp.ssrContext?.islandContext || isServerPage) {
				const middlewareEntries = /* @__PURE__ */ new Set([...globalMiddleware, ...nuxtApp._middleware.global]);
				for (const component of to.matched) {
					const componentMiddleware = component.meta.middleware;
					if (!componentMiddleware) continue;
					for (const entry of toArray(componentMiddleware)) middlewareEntries.add(entry);
				}
				const routeRules = getRouteRules({ path: to.path });
				if (routeRules.appMiddleware) for (const key in routeRules.appMiddleware) if (routeRules.appMiddleware[key]) middlewareEntries.add(key);
				else middlewareEntries.delete(key);
				for (const entry of middlewareEntries) {
					const middleware = typeof entry === "string" ? nuxtApp._middleware.named[entry] || await namedMiddleware[entry]?.().then((r) => r.default || r) : entry;
					if (!middleware) throw navigationDiagnostics.NUXT_E2004({
						entry: String(entry),
						validMiddleware: void 0
					});
					try {
						const result = await nuxtApp.runWithContext(() => middleware(to, from));
						if (result === false || result instanceof Error) {
							const error = result || createError$1({
								status: 404,
								statusText: `Page Not Found: ${initialURL}`
							});
							await nuxtApp.runWithContext(() => showError(error));
							return false;
						}
						if (result === true) continue;
						if (result === false) return result;
						if (result) {
							if (isNuxtError(result) && result.fatal) await nuxtApp.runWithContext(() => showError(result));
							return result;
						}
					} catch (err) {
						const error = createError$1(err);
						if (error.fatal) await nuxtApp.runWithContext(() => showError(error));
						return error;
					}
				}
			}
		});
		if (isServerPage) router.beforeResolve((to) => {
			const expected = pageIslandRoutes[nuxtApp.ssrContext.islandContext.name];
			const actual = to.matched.find((m) => (m.components?.default)?.__nuxt_island)?.components?.default;
			if (!expected || expected !== actual?.__nuxt_island) {
				nuxtApp.ssrContext["~renderResponse"] = {
					statusCode: 400,
					statusMessage: "Invalid island request path"
				};
				return false;
			}
		});
		router.onError(async () => {
			delete nuxtApp._processingMiddleware;
			delete nuxtApp._middlewareTo;
			await nuxtApp.callHook("page:loading:end");
		});
		router.afterEach((to) => {
			if (to.matched.length === 0 && !error.value) return nuxtApp.runWithContext(() => showError(createError$1({
				status: 404,
				fatal: false,
				statusText: `Page not found: ${to.fullPath}`,
				data: { path: to.fullPath }
			})));
		});
		nuxtApp.hooks.hookOnce("app:created", async () => {
			try {
				if ("name" in resolvedInitialRoute) resolvedInitialRoute.name = void 0;
				await router.replace({
					...resolvedInitialRoute,
					force: true
				});
				router.options.scrollBehavior = virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Frouter_options_default.scrollBehavior;
			} catch (error) {
				await _showErrorUnlessCrawler(nuxtApp, error);
			}
		});
		return { provide: { router } };
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/plugins/revive-payload.server.js
var reducers = [
	["NuxtError", (data) => isNuxtError(data) && data.toJSON()],
	["EmptyShallowRef", (data) => isRef(data) && isShallow(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
	["EmptyRef", (data) => isRef(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
	["ShallowRef", (data) => isRef(data) && isShallow(data) && data.value],
	["ShallowReactive", (data) => isReactive(data) && isShallow(data) && toRaw(data)],
	["Ref", (data) => isRef(data) && data.value],
	["Reactive", (data) => isReactive(data) && toRaw(data)]
];
var plugin = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:revive-payload:server",
	setup() {
		for (const [reducer, fn] of reducers) definePayloadReducer(reducer, fn);
	}
});
//#endregion
//#region node_modules/nuxt-site-config/dist/runtime/app/composables/useSiteConfig.js
function useSiteConfig(options) {
	const stack = useRequestEvent()?.context.siteConfig.get(defu({ resolveRefs: true }, options));
	delete stack._priority;
	return stack;
}
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/plugins/siteConfig.js
var siteConfig_default = defineNuxtPlugin(() => {
	const head = injectHead();
	if (!head) return;
	const { tagPriority, separator, titleSeparator } = useRuntimeConfig().public["seo-utils"];
	const siteConfig = useSiteConfig();
	const resolvedSeparator = siteConfig.separator || separator || siteConfig.titleSeparator || titleSeparator;
	const resolvedTitleSeparator = siteConfig.titleSeparator || titleSeparator || siteConfig.separator || separator;
	const input = {
		meta: [],
		templateParams: {
			site: siteConfig,
			siteUrl: siteConfig.url,
			siteName: siteConfig.name
		}
	};
	if (resolvedSeparator) input.templateParams.separator = resolvedSeparator;
	if (resolvedTitleSeparator) input.templateParams.titleSeparator = resolvedTitleSeparator;
	if (siteConfig.description) {
		input.templateParams.siteDescription = siteConfig.description;
		input.meta.push({
			name: "description",
			content: "%site.description",
			tagPriority
		});
	}
	head.push(input);
});
//#endregion
//#region node_modules/@unhead/vue/dist/plugins.mjs
var plugins_exports = /* @__PURE__ */ __exportAll({});
__reExport(plugins_exports, import_unhead_plugins);
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/plugins/inferSeoMetaPlugin.js
var disabledTwitterCard = "x-nuxt-seo-utils-disabled-twitter-card";
var inferSeoMetaPlugin_default = defineNuxtPlugin(() => {
	const head = injectHead();
	if (!head) return;
	const { automaticTwitterTags } = useRuntimeConfig().public["seo-utils"];
	head.use(plugins_exports.TemplateParamsPlugin);
	if (automaticTwitterTags === false) {
		head.use((0, plugins_exports.InferSeoMetaPlugin)({ twitterCard: disabledTwitterCard }));
		head.use({
			key: "nuxt-seo-utils:twitter-card-suppression",
			hooks: { "tags:beforeResolve": ({ tags }) => {
				for (let i = tags.length - 1; i >= 0; i--) {
					const tag = tags[i];
					if (tag.tag === "meta" && tag.props.name === "twitter:card" && tag.props.content === disabledTwitterCard) tags.splice(i, 1);
				}
			} }
		});
	} else head.use((0, plugins_exports.InferSeoMetaPlugin)());
});
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/composables/polyfills.js
function useI18n() {
	const siteConfig = useSiteConfig({ resolveRefs: false });
	return {
		t: (_, fallback, _options) => fallback,
		te: (_) => false,
		strategy: "no_prefix",
		defaultLocale: computed(() => {
			return toValue(siteConfig.defaultLocale) || "en";
		}),
		locale: computed(() => {
			return toValue(siteConfig.currentLocale) || toValue(siteConfig.defaultLocale) || "en";
		})
	};
}
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/composables/useFallbackTitle.js
function useFallbackTitle() {
	const route = useRoute$1();
	const err = useError();
	let i18n;
	try {
		i18n = useI18n();
	} catch {}
	return computed(() => {
		if (err.value?.statusCode && [404, 500].includes(err.value.statusCode)) return `${err.value.statusCode} - ${err.value.message}`;
		if (typeof route.meta?.title === "string") return route.meta?.title;
		const lastSegment = withoutTrailingSlash(route.path || "/").split("/").pop();
		let fallback = lastSegment ? titleCase(lastSegment) : null;
		const matched = route.matched?.at(-1);
		if (matched) {
			const routeName = String(matched.name).split("___")?.[0];
			if (routeName && i18n) fallback = i18n.t(`pages.${routeName}.title`, fallback || "", { missingWarn: false }) || fallback;
		}
		return fallback;
	});
}
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/plugins/titles.js
var titles_default = defineNuxtPlugin({
	name: "nuxt-seo:fallback-titles",
	env: { islands: false },
	setup() {
		const title = useFallbackTitle();
		useHead$1({ title: () => title.value }, { tagPriority: 101 });
	}
});
//#endregion
//#region node_modules/nuxt-schema-org/dist/vendor/schema-org-v3/shared/schema-org.BKJGr5UQ.mjs
// @__NO_SIDE_EFFECTS__
function defineSchemaOrgResolver(schema) {
	return schema;
}
var PROTOCOL_RE = /^[\s\w\0+.-]{2,}:(?:[/\\]{2})?/;
var JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasProtocol$1(input) {
	return PROTOCOL_RE.test(input);
}
function withoutTrailingSlash$1(input = "") {
	return (input.endsWith("/") ? input.slice(0, -1) : input) || "/";
}
function withTrailingSlash$1(input = "") {
	return input.endsWith("/") ? input : `${input}/`;
}
function joinURL$1(base, input) {
	if (!input || input === "/") return base || "";
	return base ? withTrailingSlash$1(base) + input.replace(JOIN_LEADING_SLASH_RE, "") : input;
}
function withBase$1(input, base) {
	if (!base || base === "/" || hasProtocol$1(input)) return input;
	const normalizedBase = withoutTrailingSlash$1(base);
	if (input.startsWith(normalizedBase)) {
		const nextChar = input[normalizedBase.length];
		if (!nextChar || nextChar === "/" || nextChar === "?") return input;
	}
	return joinURL$1(normalizedBase, input);
}
function idReference(node) {
	return { "@id": typeof node !== "string" ? node["@id"] : node };
}
var IS_VALID_W3C_DATE = [
	/(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|(\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))/,
	/^\d{4}-[01]\d-[0-3]\d$/,
	/^\d{4}-[01]\d$/,
	/^\d{4}$/
];
function isValidW3CDate(d) {
	return IS_VALID_W3C_DATE.some((r) => r.test(d));
}
function resolvableDateToIso(val) {
	if (!val) return val;
	try {
		if (val instanceof Date) return val.toISOString();
		else if (isValidW3CDate(val)) return val;
		else return new Date(Date.parse(val)).toISOString();
	} catch {}
	return typeof val === "string" ? val : val.toString();
}
var IdentityId = "#identity";
function isHomePage(meta) {
	return meta.url === meta.host;
}
function setIfEmpty(node, field, value) {
	if (node?.[field] === void 0 && value != null) node[field] = value;
}
function asArray(input) {
	return Array.isArray(input) ? input : [input];
}
function prefixId(url, id) {
	if (hasProtocol$1(id)) return id;
	if (!id.includes("#")) id = `#${id}`;
	return `${url || ""}${id}`;
}
function resolveDefaultType(node, defaultType) {
	const val = node["@type"];
	if (val === defaultType) return;
	if (typeof val === "string" && typeof defaultType === "string") {
		if (val !== defaultType) node["@type"] = [defaultType, val];
		return;
	}
	const types = new Set(asArray(defaultType));
	for (const t of asArray(val)) if (t != null) types.add(t);
	const resolved = [...types];
	node["@type"] = resolved.length === 1 ? resolved[0] : resolved;
}
function resolveWithBase(base, urlOrPath) {
	if (!base || !urlOrPath || hasProtocol$1(urlOrPath) || urlOrPath[0] !== "/" && urlOrPath[0] !== "#") return urlOrPath;
	return withBase$1(urlOrPath, base);
}
function resolveAsGraphKey(key) {
	if (!key) return key;
	return key.substring(key.lastIndexOf("#"));
}
function stripEmptyProperties(obj) {
	for (const k in obj) {
		if (!hasOwn(obj, k)) continue;
		const v = obj[k];
		if (v === "" || v === void 0) delete obj[k];
		else if (typeof v === "object" && v !== null) {
			if (v.__v_isReadonly || v.__v_isRef) continue;
			stripEmptyProperties(v);
		}
	}
	return obj;
}
function stripNullProperties(obj) {
	if (Array.isArray(obj)) {
		let next = 0;
		for (let i = 0; i < obj.length; i++) {
			const v = obj[i];
			if (v === null) continue;
			if (typeof v === "object" && v !== null) stripNullProperties(v);
			obj[next++] = v;
		}
		obj.length = next;
		return obj;
	}
	for (const k in obj) {
		if (!hasOwn(obj, k)) continue;
		const v = obj[k];
		if (v === null) delete obj[k];
		else if (typeof v === "object") {
			if (v.__v_isReadonly || v.__v_isRef) continue;
			stripNullProperties(v);
		}
	}
	return obj;
}
var interactionCounterResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "InteractionCounter" } });
var propertyValueResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "PropertyValue" } });
var definedRegionResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "DefinedRegion" } });
var quantitativeValueResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	cast(node) {
		if (typeof node === "number") return { value: node };
		return node;
	},
	defaults: { "@type": "QuantitativeValue" },
	resolve(node, ctx) {
		node.valueReference = resolveRelation(node.valueReference, ctx, quantitativeValueResolver);
		return node;
	}
});
var monetaryAmountResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "MonetaryAmount" },
	resolve(node, ctx) {
		if (typeof node.value === "object") node.value = resolveRelation(node.value, ctx, quantitativeValueResolver);
		return node;
	}
});
var merchantReturnPolicyResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "MerchantReturnPolicy" },
	resolve(node, ctx) {
		if (node.returnPolicyCategory) node.returnPolicyCategory = withBase$1(node.returnPolicyCategory, "https://schema.org/");
		if (node.returnFees) node.returnFees = withBase$1(node.returnFees, "https://schema.org/");
		if (node.returnMethod) node.returnMethod = withBase$1(node.returnMethod, "https://schema.org/");
		node.returnShippingFeesAmount = resolveRelation(node.returnShippingFeesAmount, ctx, monetaryAmountResolver);
		return node;
	}
});
var unitPriceSpecificationResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "UnitPriceSpecification" },
	resolve(node, ctx) {
		if (node.price !== void 0) setIfEmpty(node, "priceCurrency", ctx.meta.currency);
		if (node.priceType) node.priceType = withBase$1(node.priceType, "https://schema.org/");
		node.referenceQuantity = resolveRelation(node.referenceQuantity, ctx, quantitativeValueResolver);
		node.validForMemberTier = resolveRelation(node.validForMemberTier, ctx, memberProgramTierResolver);
		node.validFrom = resolvableDateToIso(node.validFrom);
		node.validThrough = resolvableDateToIso(node.validThrough);
		return node;
	}
});
var addressResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "PostalAddress" } });
var listItemResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	cast(node) {
		if (typeof node === "string") node = { name: node };
		return node;
	},
	defaults: { "@type": "ListItem" },
	resolve(node, ctx) {
		if (typeof node.item === "string") node.item = resolveWithBase(ctx.meta.host, node.item);
		else if (typeof node.item === "object") node.item = resolveRelation(node.item, ctx);
		if (node.url) node.url = resolveWithBase(ctx.meta.host, node.url);
		return node;
	}
});
var PrimaryBreadcrumbId = "#breadcrumb";
var breadcrumbResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "BreadcrumbList" },
	idPrefix: ["url", PrimaryBreadcrumbId],
	resolve(breadcrumb, ctx) {
		if (breadcrumb.itemListElement) {
			let index = 1;
			breadcrumb.itemListElement = resolveRelation(breadcrumb.itemListElement, ctx, listItemResolver, {
				array: true,
				afterResolve(node) {
					setIfEmpty(node, "position", index++);
				}
			});
		}
		return breadcrumb;
	},
	resolveRootNode(node, { find }) {
		const webPage = find(PrimaryWebPageId);
		if (webPage) setIfEmpty(webPage, "breadcrumb", idReference(node));
	}
});
var clipResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "Clip" },
	resolve(node, ctx) {
		node.url = resolveWithBase(ctx.meta.host, node.url);
		return node;
	}
});
var broadcastEventResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "BroadcastEvent" },
	resolve(node) {
		node.startDate = resolvableDateToIso(node.startDate);
		node.endDate = resolvableDateToIso(node.endDate);
		return node;
	}
});
var seekToActionResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "SeekToAction" },
	resolve(node, ctx) {
		node.target = resolveWithBase(ctx.meta.host, node.target);
		return node;
	}
});
var videoResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	cast(input) {
		if (typeof input === "string") input = { url: input };
		return input;
	},
	alias: "video",
	defaults: { "@type": "VideoObject" },
	inheritMeta: [
		{
			meta: "title",
			key: "name"
		},
		"description",
		"image",
		"inLanguage",
		{
			meta: "datePublished",
			key: "uploadDate"
		}
	],
	idPrefix: "host",
	resolve(video, ctx) {
		if (video.uploadDate) video.uploadDate = resolvableDateToIso(video.uploadDate);
		video.expires = resolvableDateToIso(video.expires);
		if (video.url) video.url = resolveWithBase(ctx.meta.host, video.url);
		if (video.contentUrl) video.contentUrl = resolveWithBase(ctx.meta.host, video.contentUrl);
		if (video.embedUrl) video.embedUrl = resolveWithBase(ctx.meta.host, video.embedUrl);
		if (video.caption && !video.description) video.description = video.caption;
		if (!video.description) video.description = "No description";
		if (video.thumbnailUrl && (typeof video.thumbnailUrl === "string" || Array.isArray(video.thumbnailUrl))) {
			const images = asArray(video.thumbnailUrl).map((image) => resolveWithBase(ctx.meta.host, image));
			video.thumbnailUrl = images.length > 1 ? images : images[0];
		}
		if (video.thumbnail) video.thumbnail = resolveRelation(video.thumbnail, ctx, imageResolver);
		video.hasPart = resolveRelation(video.hasPart, ctx, clipResolver);
		video.interactionStatistic = resolveRelation(video.interactionStatistic, ctx, interactionCounterResolver);
		video.potentialAction = resolveRelation(video.potentialAction, ctx, seekToActionResolver);
		video.publication = resolveRelation(video.publication, ctx, broadcastEventResolver);
		return video;
	},
	resolveRootNode(video, { find, meta }) {
		if (video.image && !video.thumbnailUrl) {
			const firstImage = asArray(video.image)[0];
			if (typeof firstImage === "string") setIfEmpty(video, "thumbnailUrl", resolveWithBase(meta.host, firstImage));
			else if (firstImage?.["@id"]) setIfEmpty(video, "thumbnailUrl", find(firstImage["@id"], isImageObject)?.url);
		}
	}
});
var PrimaryArticleId = "#article";
var searchActionResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: {
		"@type": "SearchAction",
		"target": { "@type": "EntryPoint" },
		"query-input": {
			"@type": "PropertyValueSpecification",
			"valueRequired": true,
			"valueName": "search_term_string"
		}
	},
	resolve(node, ctx) {
		if (typeof node.target === "string") node.target = {
			"@type": "EntryPoint",
			"urlTemplate": resolveWithBase(ctx.meta.host, node.target)
		};
		return node;
	}
});
var PrimaryWebSiteId = "#website";
var webSiteResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "WebSite" },
	inheritMeta: ["inLanguage", {
		meta: "host",
		key: "url"
	}],
	idPrefix: ["host", PrimaryWebSiteId],
	resolve(node, ctx) {
		node.potentialAction = resolveRelation(node.potentialAction, ctx, searchActionResolver, { array: true });
		node.publisher = resolveRelation(node.publisher, ctx);
		node.dateModified = resolvableDateToIso(node.dateModified);
		node.datePublished = resolvableDateToIso(node.datePublished);
		return node;
	},
	resolveRootNode(node, { find }) {
		if (resolveAsGraphKey(node["@id"]) === "#website") {
			const identity = find(IdentityId);
			if (identity) setIfEmpty(node, "publisher", idReference(identity));
			const webPage = find(PrimaryWebPageId);
			if (webPage) setIfEmpty(webPage, "isPartOf", idReference(node));
		}
		return node;
	}
});
var personResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	cast(node) {
		if (typeof node === "string") return { name: node };
		return node;
	},
	defaults: { "@type": "Person" },
	idPrefix: ["host", IdentityId],
	resolve(node, ctx) {
		if (node.identifier) {
			const resolveIdentifier = (identifier) => typeof identifier === "string" ? identifier : resolveRelation(identifier, ctx, propertyValueResolver);
			node.identifier = Array.isArray(node.identifier) ? node.identifier.map(resolveIdentifier) : resolveIdentifier(node.identifier);
		}
		node.agentInteractionStatistic = resolveRelation(node.agentInteractionStatistic, ctx, interactionCounterResolver);
		node.interactionStatistic = resolveRelation(node.interactionStatistic, ctx, interactionCounterResolver);
		if (node.url) node.url = resolveWithBase(ctx.meta.host, node.url);
		return node;
	},
	resolveRootNode(node, { find, meta }) {
		if (resolveAsGraphKey(node["@id"]) === IdentityId) {
			setIfEmpty(node, "url", meta.host);
			const webPage = find(PrimaryWebPageId);
			if (webPage && isHomePage(meta)) setIfEmpty(webPage, "about", idReference(node));
			const webSite = find(PrimaryWebSiteId);
			if (webSite) setIfEmpty(webSite, "publisher", idReference(node));
		}
		const article = find(PrimaryArticleId);
		if (article) setIfEmpty(article, "author", idReference(node));
	}
});
var readActionResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "ReadAction" },
	resolve(node, ctx) {
		node.target ||= [];
		if (!node.target.includes(ctx.meta.url)) node.target.unshift(ctx.meta.url);
		return node;
	}
});
var speakableSpecificationResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "SpeakableSpecification" } });
var webPageElementResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "WebPageElement" } });
var PrimaryWebPageId = "#webpage";
var webPageResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults({ meta }) {
		const endPath = withoutTrailingSlash$1(meta.url.substring(meta.url.lastIndexOf("/") + 1));
		let type = "WebPage";
		switch (endPath) {
			case "about":
			case "about-us":
				type = "AboutPage";
				break;
			case "search":
				type = "SearchResultsPage";
				break;
			case "checkout":
				type = "CheckoutPage";
				break;
			case "contact":
			case "get-in-touch":
			case "contact-us":
				type = "ContactPage";
				break;
			case "faq": type = "FAQPage";
		}
		return { "@type": type };
	},
	idPrefix: ["url", PrimaryWebPageId],
	inheritMeta: [
		{
			meta: "title",
			key: "name"
		},
		"description",
		"datePublished",
		"dateModified",
		"url"
	],
	resolve(node, ctx) {
		node.dateCreated = resolvableDateToIso(node.dateCreated);
		node.dateModified = resolvableDateToIso(node.dateModified);
		node.datePublished = resolvableDateToIso(node.datePublished);
		resolveDefaultType(node, "WebPage");
		node.about = resolveRelation(node.about, ctx, organizationResolver);
		node.breadcrumb = resolveRelation(node.breadcrumb, ctx, breadcrumbResolver);
		node.author = resolveRelation(node.author, ctx, personResolver);
		if (node.hasPart) {
			const resolvePart = (part) => {
				return typeof part === "object" && part !== null && (part["@type"] === "WebPageElement" || "cssSelector" in part) ? resolveRelation(part, ctx, webPageElementResolver) : resolveRelation(part, ctx);
			};
			node.hasPart = Array.isArray(node.hasPart) ? node.hasPart.map(resolvePart) : resolvePart(node.hasPart);
		}
		node.primaryImageOfPage = resolveRelation(node.primaryImageOfPage, ctx, imageResolver);
		node.speakable = resolveRelation(node.speakable, ctx, speakableSpecificationResolver);
		node.video = resolveRelation(node.video, ctx, videoResolver);
		if (Array.isArray(node["@type"]) && node["@type"].includes("ProfilePage")) node.mainEntity = resolveIdentityRelation(node.mainEntity, ctx, {
			organization: organizationResolver,
			person: personResolver
		}, { root: true });
		if (node.potentialAction) {
			const resolveAction = (action) => {
				if (!action || typeof action !== "object") return action;
				const type = action["@type"];
				return type === "ReadAction" || Array.isArray(type) && type.includes("ReadAction") || "target" in action ? resolveRelation(action, ctx, readActionResolver) : resolveRelation(action, ctx);
			};
			node.potentialAction = Array.isArray(node.potentialAction) ? node.potentialAction.map(resolveAction) : resolveAction(node.potentialAction);
		}
		if (node["@type"] === "WebPage" && ctx.meta.url) setIfEmpty(node, "potentialAction", [{
			"@type": "ReadAction",
			"target": [ctx.meta.url]
		}]);
		return node;
	},
	resolveRootNode(webPage, { find, meta }) {
		const identity = find(IdentityId);
		const webSite = find(PrimaryWebSiteId);
		const logo = find("#logo");
		if (identity && isHomePage(meta)) setIfEmpty(webPage, "about", idReference(identity));
		if (logo) setIfEmpty(webPage, "primaryImageOfPage", idReference(logo));
		if (webSite) setIfEmpty(webPage, "isPartOf", idReference(webSite));
		const breadcrumb = find(PrimaryBreadcrumbId);
		if (breadcrumb) setIfEmpty(webPage, "breadcrumb", idReference(breadcrumb));
		return webPage;
	}
});
var contactPointResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "ContactPoint" } });
var creditCardResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "CreditCard" } });
var memberProgramTierResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "MemberProgramTier" },
	resolve(node, ctx) {
		node.hasTierBenefit = Array.isArray(node.hasTierBenefit) ? node.hasTierBenefit.map((benefit) => withBase$1(benefit, "https://schema.org/")) : withBase$1(node.hasTierBenefit, "https://schema.org/");
		if (node.hasTierRequirement) {
			const requirement = node.hasTierRequirement;
			if (typeof requirement === "object") {
				const types = asArray(requirement["@type"]);
				if (types.includes("CreditCard")) node.hasTierRequirement = resolveRelation(requirement, ctx, creditCardResolver);
				else if (types.includes("MonetaryAmount") || "currency" in requirement) node.hasTierRequirement = resolveRelation(requirement, ctx, monetaryAmountResolver);
				else node.hasTierRequirement = resolveRelation(requirement, ctx, unitPriceSpecificationResolver);
			}
		}
		node.isTierOf = resolveRelation(node.isTierOf, ctx, memberProgramResolver);
		node.membershipPointsEarned = resolveRelation(node.membershipPointsEarned, ctx, quantitativeValueResolver);
		if (node.url) node.url = resolveWithBase(ctx.meta.host, node.url);
		return node;
	}
});
var memberProgramResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "MemberProgram" },
	resolve(node, ctx) {
		node.hasTiers = resolveRelation(node.hasTiers, ctx, memberProgramTierResolver);
		if (node.url) node.url = resolveWithBase(ctx.meta.host, node.url);
		return node;
	}
});
var servicePeriodResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "ServicePeriod" },
	resolve(node, ctx) {
		node.duration = resolveRelation(node.duration, ctx, quantitativeValueResolver);
		return node;
	}
});
var shippingRateSettingsResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "ShippingRateSettings" } });
var shippingSeasonalOverrideResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "OpeningHoursSpecification" },
	resolve(node) {
		node.validFrom = resolvableDateToIso(node.validFrom);
		node.validThrough = resolvableDateToIso(node.validThrough);
		return node;
	}
});
var shippingConditionsResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "ShippingConditions" },
	resolve(node, ctx) {
		node.numItems = resolveRelation(node.numItems, ctx, quantitativeValueResolver);
		node.orderValue = resolveRelation(node.orderValue, ctx, monetaryAmountResolver);
		node.seasonalOverride = resolveRelation(node.seasonalOverride, ctx, shippingSeasonalOverrideResolver);
		node.shippingDestination = resolveRelation(node.shippingDestination, ctx, definedRegionResolver);
		node.shippingOrigin = resolveRelation(node.shippingOrigin, ctx, definedRegionResolver);
		if (node.shippingRate) node.shippingRate = typeof node.shippingRate === "object" && ("orderPercentage" in node.shippingRate || "weightPercentage" in node.shippingRate) ? resolveRelation(node.shippingRate, ctx, shippingRateSettingsResolver) : resolveRelation(node.shippingRate, ctx, monetaryAmountResolver);
		node.transitTime = resolveRelation(node.transitTime, ctx, servicePeriodResolver);
		node.weight = resolveRelation(node.weight, ctx, quantitativeValueResolver);
		return node;
	}
});
var shippingServiceResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "ShippingService" },
	resolve(node, ctx) {
		if (node.fulfillmentType) node.fulfillmentType = withBase$1(node.fulfillmentType, "https://schema.org/");
		node.handlingTime = resolveRelation(node.handlingTime, ctx, servicePeriodResolver);
		node.shippingConditions = resolveRelation(node.shippingConditions, ctx, shippingConditionsResolver);
		node.validForMemberTier = resolveRelation(node.validForMemberTier, ctx, memberProgramTierResolver);
		return node;
	}
});
var organizationResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	cast(node) {
		if (typeof node === "string") return { name: node };
		return node;
	},
	defaults: { "@type": "Organization" },
	idPrefix: ["host", IdentityId],
	inheritMeta: [{
		meta: "host",
		key: "url"
	}],
	resolve(node, ctx) {
		resolveDefaultType(node, "Organization");
		node.address = resolveRelation(node.address, ctx, addressResolver);
		node.agentInteractionStatistic = resolveRelation(node.agentInteractionStatistic, ctx, interactionCounterResolver);
		node.contactPoint = resolveRelation(node.contactPoint, ctx, contactPointResolver);
		node.hasMemberProgram = resolveRelation(node.hasMemberProgram, ctx, memberProgramResolver);
		node.hasMerchantReturnPolicy = resolveRelation(node.hasMerchantReturnPolicy, ctx, merchantReturnPolicyResolver);
		node.hasShippingService = resolveRelation(node.hasShippingService, ctx, shippingServiceResolver);
		if (node.identifier) {
			const resolveIdentifier = (identifier) => typeof identifier === "string" ? identifier : resolveRelation(identifier, ctx, propertyValueResolver);
			node.identifier = Array.isArray(node.identifier) ? node.identifier.map(resolveIdentifier) : resolveIdentifier(node.identifier);
		}
		node.interactionStatistic = resolveRelation(node.interactionStatistic, ctx, interactionCounterResolver);
		node.numberOfEmployees = resolveRelation(node.numberOfEmployees, ctx, quantitativeValueResolver);
		if (node.url) node.url = resolveWithBase(ctx.meta.host, node.url);
		return node;
	},
	resolveRootNode(node, ctx) {
		const isIdentity = resolveAsGraphKey(node["@id"]) === IdentityId;
		const webPage = ctx.find(PrimaryWebPageId);
		if (node.logo && isIdentity) {
			const logoNode = resolveRelation(Array.isArray(node.logo) ? node.logo[0] : node.logo, ctx, imageResolver, {
				root: true,
				afterResolve(logo) {
					logo["@id"] = prefixId(ctx.meta.host, "#logo");
					setIfEmpty(logo, "caption", node.name);
				}
			});
			if (webPage && logoNode) setIfEmpty(webPage, "primaryImageOfPage", idReference(logoNode));
			if (node["@type"] === "Organization") node.logo = logoNode;
			else if (!ctx.find("#organization")) {
				const resolvedLogo = logoNode && typeof logoNode === "object" && logoNode["@id"] ? ctx.find(logoNode["@id"], isImageObject) : null;
				ctx.nodes.push({
					"@type": "Organization",
					"name": node.name,
					"url": node.url,
					"sameAs": node.sameAs,
					"address": node.address,
					"logo": resolvedLogo?.url,
					"_priority": -1,
					"@id": prefixId(ctx.meta.host, "#organization")
				});
			}
			if (node["@type"] !== "Organization") delete node.logo;
		}
		if (isIdentity && webPage && isHomePage(ctx.meta)) setIfEmpty(webPage, "about", idReference(node));
		const webSite = ctx.find(PrimaryWebSiteId);
		if (webSite) setIfEmpty(webSite, "publisher", idReference(node));
	}
});
function isImageObject(node) {
	return typeof node.url === "string" || typeof node.contentUrl === "string";
}
var imageResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	alias: "image",
	cast(input) {
		if (typeof input === "string") input = { url: input };
		return input;
	},
	defaults: { "@type": "ImageObject" },
	inheritMeta: ["inLanguage"],
	idPrefix: "host",
	resolve(image, ctx) {
		const { meta } = ctx;
		if (image.url) image.url = resolveWithBase(meta.host, image.url);
		if (image.contentUrl) image.contentUrl = resolveWithBase(meta.host, image.contentUrl);
		setIfEmpty(image, "contentUrl", image.url);
		setIfEmpty(image, "url", image.contentUrl);
		image.creator = resolveIdentityRelation(image.creator, ctx, {
			organization: organizationResolver,
			person: personResolver
		}, { root: true });
		if (image.license) image.license = resolveWithBase(meta.host, image.license);
		if (image.acquireLicensePage) image.acquireLicensePage = resolveWithBase(meta.host, image.acquireLicensePage);
		if (image.height && !image.width) delete image.height;
		if (image.width && !image.height) delete image.width;
		return image;
	}
});
var ALIAS_RE = /([a-z])([A-Z])/g;
function nextNodeId(ctx, alias) {
	ctx.nodeIdCounters[alias] = (ctx.nodeIdCounters[alias] || 0) + 1;
	return ctx.nodeIdCounters[alias].toString();
}
function resolveMeta(meta) {
	if (!meta.path) meta.path = "/";
	if (!meta.host && false);
	if (meta.path !== "/") {
		if (meta.trailingSlash && !meta.path.endsWith("/")) meta.path = withTrailingSlash$1(meta.path);
		else if (!meta.trailingSlash && meta.path.endsWith("/")) meta.path = withoutTrailingSlash$1(meta.path);
	}
	meta.url = joinURL$1(meta.host || "", meta.path);
	return meta;
}
function resolveNode(node, ctx, resolver) {
	if (resolver?.cast) node = resolver.cast(node, ctx);
	if (resolver?.defaults) {
		let defaults = resolver.defaults;
		if (typeof defaults === "function") defaults = defaults(ctx);
		node = {
			...defaults,
			...node
		};
	}
	const inheritMeta = resolver?.inheritMeta;
	if (inheritMeta) for (let i = 0; i < inheritMeta.length; i++) {
		const entry = inheritMeta[i];
		if (typeof entry === "string") setIfEmpty(node, entry, ctx.meta[entry]);
		else setIfEmpty(node, entry.key, ctx.meta[entry.meta]);
	}
	if (resolver?.resolve) node = resolver.resolve(node, ctx);
	for (const k in node) {
		const v = node[k];
		if (Array.isArray(v)) for (let i = 0; i < v.length; i++) {
			const item = v[i];
			if (typeof item === "object" && item?._resolver) node[k][i] = resolveRelation(item, ctx, item._resolver);
		}
		else if (typeof v === "object" && v?._resolver) node[k] = resolveRelation(v, ctx, v._resolver);
	}
	stripEmptyProperties(node);
	return node;
}
function resolveNodeId(node, ctx, resolver, resolveAsRoot = false) {
	if (node["@id"] && node["@id"].startsWith("http")) return node;
	const prefix = resolver ? (Array.isArray(resolver.idPrefix) ? resolver.idPrefix[0] : resolver.idPrefix) || "url" : "url";
	const rootId = node["@id"] || (resolver ? Array.isArray(resolver.idPrefix) ? resolver.idPrefix?.[1] : void 0 : "");
	if (!node["@id"] && resolveAsRoot && rootId) {
		node["@id"] = prefixId(ctx.meta[prefix], rootId);
		return node;
	}
	if (node["@id"]?.startsWith("#/schema/") || node["@id"]?.startsWith("/")) {
		node["@id"] = prefixId(ctx.meta[prefix], node["@id"]);
		return node;
	}
	let alias = resolver?.alias;
	if (!alias) alias = (asArray(node["@type"])?.[0] || "").replace(ALIAS_RE, "$1-$2").toLowerCase();
	node["@id"] = prefixId(ctx.meta[prefix], `#/schema/${alias}/${node["@id"] || nextNodeId(ctx, alias)}`);
	return node;
}
function resolveRelation(input, ctx, fallbackResolver, options = {}) {
	if (!input) return input;
	const items = asArray(input);
	const ids = [];
	for (let i = 0; i < items.length; i++) {
		const a = items[i];
		if (!a) {
			ids.push(a);
			continue;
		}
		let keyCount = 0;
		for (const _ in a) keyCount++;
		if (keyCount === 1 && a["@id"] || keyCount === 2 && a["@id"] && a["@type"]) {
			ids.push(resolveNodeId({ "@id": ctx.find(a["@id"])?.["@id"] || a["@id"] }, ctx));
			continue;
		}
		let resolver = fallbackResolver;
		if (a._resolver && typeof a._resolver !== "string") {
			resolver = a._resolver;
			delete a._resolver;
		}
		if (!resolver) {
			ids.push(a);
			continue;
		}
		let node = resolveNode(a, ctx, resolver);
		if (options.afterResolve) options.afterResolve(node);
		if (options.generateId || options.root) node = resolveNodeId(node, ctx, resolver, false);
		if (options.root) {
			if (resolver.resolveRootNode) resolver.resolveRootNode(node, ctx);
			ctx.push(node);
			ids.push(idReference(node["@id"]));
			continue;
		}
		ids.push(node);
	}
	return !options.array && ids.length === 1 ? ids[0] : ids;
}
function merge(target, source) {
	if (!source) return target;
	for (const key in source) {
		if (!hasOwn(source, key) || key === "__proto__" || key === "constructor" || key === "prototype") continue;
		const value = source[key];
		if (value === void 0) continue;
		if (Array.isArray(target[key])) {
			if (Array.isArray(value)) {
				const merged = [...target[key], ...value];
				if (key === "@type") target[key] = [...new Set(merged)];
				else if (key === "itemListElement") {
					merged.sort((a, b) => (a.position || 0) - (b.position || 0));
					for (let i = 0; i < merged.length; i++) merged[i].position = i + 1;
					target[key] = merged;
				} else if (key === "potentialAction") {
					const byType = /* @__PURE__ */ Object.create(null);
					for (const action of merged) {
						const type = action["@type"];
						if (byType[type]) {
							if (action.target && byType[type].target) {
								const a = Array.isArray(byType[type].target) ? byType[type].target : [byType[type].target];
								const b = Array.isArray(action.target) ? action.target : [action.target];
								byType[type].target = [.../* @__PURE__ */ new Set([...a, ...b])];
							}
						} else byType[type] = { ...action };
					}
					target[key] = Object.values(byType);
				} else if (merged.length > 0 && merged.every((item) => item && typeof item === "object" && item["@type"])) {
					const byType = /* @__PURE__ */ Object.create(null);
					for (const item of merged) byType[item["@type"]] = item;
					target[key] = Object.values(byType);
				} else target[key] = merged;
			} else target[key] = merge(target[key], [value]);
		} else if (target[key] && typeof target[key] === "object" && typeof value === "object" && !Array.isArray(value)) target[key] = merge({ ...target[key] }, value);
		else target[key] = value;
	}
	return target;
}
var DOMAIN_RE = /(?:https?:)?\/\//;
function indexNode(index, node) {
	if (!node["@id"]) return;
	const nodeId = node["@id"];
	const fragmentKey = resolveAsGraphKey(nodeId);
	index.set(fragmentKey, node);
	index.set(nodeId, node);
	const domainKey = nodeId.replace(DOMAIN_RE, "").split("/")[0];
	index.set(domainKey, node);
}
function createSchemaOrgGraph() {
	let ctx;
	function find(id, guard) {
		const matchFragment = id[0] === "#";
		const matchDomain = id[0] === "/" && id[1] === "/";
		const key = matchFragment ? resolveAsGraphKey(id) : matchDomain ? id.replace(DOMAIN_RE, "").split("/")[0] : id;
		let node = ctx.nodeIndex.size > 0 ? ctx.nodeIndex.get(key) : void 0;
		if (!node) for (let i = 0; i < ctx.nodes.length; i++) {
			const candidate = ctx.nodes[i];
			const nodeId = candidate["@id"];
			if (!nodeId) continue;
			if ((matchFragment ? resolveAsGraphKey(nodeId) : matchDomain ? nodeId.replace(DOMAIN_RE, "").split("/")[0] : nodeId) === key) {
				node = candidate;
				break;
			}
		}
		if (!node || guard && !guard(node)) return null;
		return node;
	}
	ctx = {
		find,
		push(input) {
			if (Array.isArray(input)) for (let i = 0; i < input.length; i++) {
				const registeredNode = input[i];
				ctx.nodes.push(registeredNode);
				if (ctx.nodeIndex.size > 0) indexNode(ctx.nodeIndex, registeredNode);
			}
			else {
				const registeredNode = input;
				ctx.nodes.push(registeredNode);
				if (ctx.nodeIndex.size > 0) indexNode(ctx.nodeIndex, registeredNode);
			}
		},
		resolveGraph(meta) {
			for (const k in ctx.nodeIdCounters) delete ctx.nodeIdCounters[k];
			ctx.meta = resolveMeta({ ...meta });
			const len = ctx.nodes.length;
			for (let i = 0; i < len; i++) {
				let node = ctx.nodes[i];
				const resolver = node._resolver;
				node = resolveNode(node, ctx, resolver);
				node = resolveNodeId(node, ctx, resolver, true);
				ctx.nodes[i] = node;
			}
			const dedupedNodes = /* @__PURE__ */ Object.create(null);
			let hasDuplicates = false;
			ctx.nodeIndex.clear();
			for (let i = 0; i < ctx.nodes.length; i++) {
				const n = ctx.nodes[i];
				const nodeKey = resolveAsGraphKey(n["@id"]);
				if (dedupedNodes[nodeKey]) {
					hasDuplicates = true;
					if (n._dedupeStrategy !== "replace") dedupedNodes[nodeKey] = merge(dedupedNodes[nodeKey], n);
					else dedupedNodes[nodeKey] = n;
				} else dedupedNodes[nodeKey] = n;
			}
			if (hasDuplicates) ctx.nodes = Object.values(dedupedNodes);
			for (let i = 0; i < ctx.nodes.length; i++) indexNode(ctx.nodeIndex, ctx.nodes[i]);
			const countBeforeRelations = ctx.nodes.length;
			for (let i = 0; i < ctx.nodes.length; i++) {
				const node = ctx.nodes[i];
				if (node.image && typeof node.image === "string") node.image = resolveRelation(node.image, ctx, imageResolver, { root: true });
				node.translationOfWork = resolveRelation(node.translationOfWork, ctx);
				node.workTranslation = resolveRelation(node.workTranslation, ctx);
				const resolver = node._resolver;
				if (resolver?.resolveRootNode) resolver.resolveRootNode(node, ctx);
			}
			for (let i = 0; i < ctx.nodes.length; i++) delete ctx.nodes[i]._resolver;
			for (let i = 0; i < ctx.nodes.length; i++) stripNullProperties(ctx.nodes[i]);
			const needsDedupe = ctx.nodes.length > countBeforeRelations;
			const normalizedNodes = needsDedupe ? /* @__PURE__ */ Object.create(null) : null;
			const result = needsDedupe ? null : [];
			for (let i = 0; i < ctx.nodes.length; i++) {
				const n = ctx.nodes[i];
				const nodeKey = resolveAsGraphKey(n["@id"]);
				const keys = Object.keys(n);
				keys.sort();
				const newNode = {};
				let relationCount = 0;
				for (let j = 0; j < keys.length; j++) {
					const k = keys[j];
					if (k[0] === "_") continue;
					const v = n[k];
					if (v !== null && (Array.isArray(v) || typeof v === "object")) keys[relationCount++] = k;
					else newNode[k] = v;
				}
				for (let j = 0; j < relationCount; j++) {
					const k = keys[j];
					newNode[k] = n[k];
				}
				if (needsDedupe) normalizedNodes[nodeKey] = normalizedNodes[nodeKey] ? merge(normalizedNodes[nodeKey], newNode) : newNode;
				else result.push(newNode);
			}
			return needsDedupe ? Object.values(normalizedNodes) : result;
		},
		nodes: [],
		nodeIndex: /* @__PURE__ */ new Map(),
		nodeIdCounters: /* @__PURE__ */ Object.create(null),
		meta: resolveMeta({})
	};
	return ctx;
}
function resolveIdentityRelation(input, ctx, resolvers, options = {}) {
	if (!input) return input;
	const resolveIdentity = (identity) => {
		const types = typeof identity === "object" && identity ? asArray(identity["@type"]).filter((type) => typeof type === "string") : [];
		return resolveRelation(identity, ctx, types.length > 0 && !types.includes("Person") ? resolvers.organization : resolvers.person, options);
	};
	if (!Array.isArray(input)) return resolveIdentity(input);
	const resolved = input.map(resolveIdentity);
	return resolved.length === 1 ? resolved[0] : resolved;
}
var aggregateRatingResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "AggregateRating" },
	resolve(node, ctx) {
		node.itemReviewed = resolveRelation(node.itemReviewed, ctx);
		return node;
	}
});
var openingHoursResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: {
		"@type": "OpeningHoursSpecification",
		"opens": "00:00",
		"closes": "23:59"
	},
	resolve(node) {
		node.validFrom = resolvableDateToIso(node.validFrom);
		node.validThrough = resolvableDateToIso(node.validThrough);
		return node;
	}
});
var itemListResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "ItemList" },
	resolve(node, ctx) {
		if (node.itemListElement) {
			let index = 1;
			node.itemListElement = resolveRelation(node.itemListElement, ctx, listItemResolver, {
				array: true,
				afterResolve(node2) {
					setIfEmpty(node2, "position", index++);
				}
			});
		}
		return node;
	}
});
var ratingResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	cast(node) {
		if (typeof node === "number") return { ratingValue: node };
		return node;
	},
	defaults: {
		"@type": "Rating",
		"bestRating": 5,
		"worstRating": 1
	}
});
var reviewResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": "Review" },
	inheritMeta: ["inLanguage"],
	resolve(review, ctx) {
		review.reviewRating = resolveRelation(review.reviewRating, ctx, ratingResolver);
		review.author = resolveIdentityRelation(review.author, ctx, {
			organization: organizationResolver,
			person: personResolver
		});
		review.itemReviewed = resolveRelation(review.itemReviewed, ctx);
		review.negativeNotes = resolveRelation(review.negativeNotes, ctx, itemListResolver);
		review.positiveNotes = resolveRelation(review.positiveNotes, ctx, itemListResolver);
		review.contentReferenceTime = resolvableDateToIso(review.contentReferenceTime);
		review.datePublished = resolvableDateToIso(review.datePublished);
		return review;
	}
});
var geoCoordinatesResolver = /* @__PURE__ */ defineSchemaOrgResolver({ defaults: { "@type": "GeoCoordinates" } });
var localBusinessResolver = /* @__PURE__ */ defineSchemaOrgResolver({
	defaults: { "@type": ["Organization", "LocalBusiness"] },
	inheritMeta: [{
		key: "url",
		meta: "host"
	}, {
		key: "currenciesAccepted",
		meta: "currency"
	}],
	idPrefix: ["host", IdentityId],
	resolve(node, ctx) {
		resolveDefaultType(node, ["Organization", "LocalBusiness"]);
		node.address = resolveRelation(node.address, ctx, addressResolver);
		node.aggregateRating = resolveRelation(node.aggregateRating, ctx, aggregateRatingResolver);
		node.department = resolveRelation(node.department, ctx, localBusinessResolver);
		node.geo = resolveRelation(node.geo, ctx, geoCoordinatesResolver);
		node.openingHoursSpecification = resolveRelation(node.openingHoursSpecification, ctx, openingHoursResolver);
		node.review = resolveRelation(node.review, ctx, reviewResolver);
		if (node.menu) node.menu = resolveWithBase(ctx.meta.host, node.menu);
		node = resolveNode({ ...node }, ctx, organizationResolver);
		return node;
	},
	resolveRootNode(node, ctx) {
		organizationResolver.resolveRootNode(node, ctx);
		return node;
	}
});
function mergeObjects(target, source) {
	const result = { ...target };
	for (const key in source) {
		if (!hasOwn(source, key) || source[key] === void 0 || key === "__proto__" || key === "constructor" || key === "prototype") continue;
		if (result[key] && typeof result[key] === "object" && typeof source[key] === "object" && !Array.isArray(result[key]) && !Array.isArray(source[key])) result[key] = mergeObjects(result[key], source[key]);
		else if (!result[key]) result[key] = source[key];
	}
	return result;
}
function isSchemaOrgTag(tag) {
	return tag.tag === "script" && tag.props.type === "application/ld+json" && tag.props.nodes || tag.key === "schema-org-graph";
}
function UnheadSchemaOrg(config = {}, meta = () => ({}), options) {
	config = resolveMeta({ ...config });
	let graph;
	let resolvedMeta = {};
	return defineHeadPlugin((head) => {
		head.use(TemplateParamsPlugin);
		function collectTag(tag) {
			if (tag.tag === "script" && tag.props.type === "application/ld+json" && tag.props.nodes) {
				const nodes = tag.props.nodes;
				for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
					if (typeof node !== "object" || node === null) continue;
					const newNode = {
						...node,
						_dedupeStrategy: tag.tagDuplicateStrategy
					};
					graph.push(newNode);
				}
				tag.tagPosition = tag.tagPosition || (config.tagPosition === "head" ? "head" : "bodyClose");
			}
			if (tag.tag === "htmlAttrs" && typeof tag.props.lang === "string") resolvedMeta.inLanguage = tag.props.lang;
			else if (tag.tag === "title" && tag.textContent != null && typeof tag.textContent !== "function") resolvedMeta.title = String(tag.textContent);
			else if (tag.tag === "meta" && tag.props.name === "description" && typeof tag.props.content === "string") resolvedMeta.description = tag.props.content;
			else if (tag.tag === "link" && tag.props.rel === "canonical" && typeof tag.props.href === "string") {
				resolvedMeta.url = tag.props.href;
				if (resolvedMeta.url && !resolvedMeta.host) try {
					resolvedMeta.host = new URL(resolvedMeta.url).origin;
				} catch {}
			} else if (tag.tag === "meta" && tag.props.property === "og:image" && typeof tag.props.content === "string") resolvedMeta.image = tag.props.content;
			else if (tag.tag === "templateParams" && tag.props.schemaOrg) resolvedMeta = {
				...resolvedMeta,
				...tag.props.schemaOrg
			};
		}
		return {
			key: "schema-org",
			hooks: {
				"entries:resolve": (ctx) => {
					graph = graph || createSchemaOrgGraph();
					graph.nodes = [];
					graph.nodeIndex.clear();
					resolvedMeta = {};
					for (const entry of ctx.entries) if (entry._tags) {
						if (entry._tags.some(isSchemaOrgTag)) {
							delete entry._tags;
							continue;
						}
						for (const tag of entry._tags) collectTag(tag);
					}
				},
				"entries:normalize": ({ tags }) => {
					for (const tag of tags) collectTag(tag);
				},
				"tags:resolve": (ctx) => {
					for (const k in ctx.tags) {
						const tag = ctx.tags[k];
						if (tag.tag === "script" && tag.props.type === "application/ld+json" && tag.props.nodes) {
							delete tag.props.nodes;
							const resolvedGraph = graph.resolveGraph({
								...meta?.() || {},
								...config,
								...resolvedMeta
							});
							if (!resolvedGraph.length) {
								tag.props = {};
								return;
							}
							options?.minify || true;
							tag.innerHTML = JSON.stringify({
								"@context": "https://schema.org",
								"@graph": resolvedGraph
							}, (_, value) => {
								if (typeof value === "string") return processTemplateParams(value, head._templateParams, head._separator);
								return value;
							}, 0 );
							return;
						}
					}
				},
				"tags:afterResolve": (ctx) => {
					let firstNodeIdx;
					let toRemove;
					for (let i = 0; i < ctx.tags.length; i++) {
						const tag = ctx.tags[i];
						if (!tag?.props) continue;
						if (isSchemaOrgTag(tag)) {
							delete tag.props.nodes;
							if (typeof firstNodeIdx === "undefined") {
								firstNodeIdx = i;
								continue;
							}
							ctx.tags[firstNodeIdx].props = mergeObjects(ctx.tags[firstNodeIdx].props, tag.props);
							delete ctx.tags[firstNodeIdx].props.nodes;
							(toRemove ||= /* @__PURE__ */ new Set()).add(i);
						}
					}
					if (toRemove) ctx.tags = ctx.tags.filter((_, i) => !toRemove.has(i));
				}
			}
		};
	}, "schema-org");
}
//#endregion
//#region node_modules/nuxt-schema-org/dist/vendor/schema-org-v3/vue.mjs
function withResolver(input, resolver) {
	return {
		...input,
		_resolver: resolver
	};
}
function provideResolver(input, resolver) {
	const resolvedInput = input || {};
	if (isRef(resolvedInput)) return computed(() => {
		const value = resolvedInput.value;
		return value && typeof value === "object" ? withResolver(value, resolver) : value;
	});
	return withResolver(resolvedInput, resolver);
}
function defineLocalBusiness(input) {
	return provideResolver(input, localBusinessResolver);
}
function defineOrganization(input) {
	return provideResolver(input, organizationResolver);
}
function definePerson(input) {
	return provideResolver(input, personResolver);
}
function defineWebPage(input) {
	return provideResolver(input, webPageResolver);
}
function defineWebSite(input) {
	return provideResolver(input, webSiteResolver);
}
//#endregion
//#region node_modules/site-config-stack/dist/urls.mjs
var FILE_EXT_RE = /\.[0-9a-z]+$/i;
function resolveSitePath(pathOrUrl, options) {
	let path = pathOrUrl;
	if (hasProtocol(pathOrUrl, {
		strict: false,
		acceptRelative: true
	})) path = parseURL(pathOrUrl).pathname;
	const base = withLeadingSlash(options.base || "/");
	if (base !== "/" && path.startsWith(base)) path = path.slice(base.length);
	let origin = withoutTrailingSlash(options.absolute ? options.siteUrl : "");
	if (base !== "/" && origin.endsWith(base)) origin = origin.slice(0, origin.indexOf(base));
	const baseWithOrigin = options.withBase ? withBase(base, origin || "/") : origin;
	const resolvedUrl = withBase(path, baseWithOrigin);
	return path === "/" && !options.withBase ? withTrailingSlash(resolvedUrl) : fixSlashes(options.trailingSlash, resolvedUrl);
}
var fileExtensions = [
	"jpg",
	"jpeg",
	"png",
	"gif",
	"bmp",
	"webp",
	"svg",
	"ico",
	"pdf",
	"doc",
	"docx",
	"xls",
	"xlsx",
	"ppt",
	"pptx",
	"txt",
	"md",
	"markdown",
	"zip",
	"rar",
	"7z",
	"tar",
	"gz",
	"mp3",
	"wav",
	"flac",
	"ogg",
	"opus",
	"m4a",
	"aac",
	"midi",
	"mid",
	"mp4",
	"avi",
	"mkv",
	"mov",
	"wmv",
	"flv",
	"webm",
	"html",
	"css",
	"js",
	"json",
	"xml",
	"tsx",
	"jsx",
	"ts",
	"vue",
	"svelte",
	"xsl",
	"rss",
	"atom",
	"php",
	"py",
	"rb",
	"java",
	"c",
	"cpp",
	"h",
	"go",
	"csv",
	"tsv",
	"sql",
	"yaml",
	"yml",
	"woff",
	"woff2",
	"ttf",
	"otf",
	"eot",
	"exe",
	"msi",
	"apk",
	"ipa",
	"dmg",
	"iso",
	"bin",
	"bat",
	"cmd",
	"sh",
	"env",
	"htaccess",
	"conf",
	"toml",
	"ini",
	"deb",
	"rpm",
	"jar",
	"war",
	"epub",
	"mobi",
	"log",
	"tmp",
	"bak",
	"old",
	"sav"
];
function isPathFile(path) {
	const ext = (path.split("/").pop() || path).match(FILE_EXT_RE)?.[0];
	return !!(ext && fileExtensions.includes(ext.replace(".", "")));
}
function fixSlashes(trailingSlash, pathOrUrl) {
	const $url = parseURL(pathOrUrl);
	if (isPathFile($url.pathname)) return pathOrUrl;
	const fixedPath = trailingSlash ? withTrailingSlash($url.pathname) : withoutTrailingSlash($url.pathname);
	return `${$url.protocol ? `${$url.protocol}//` : ""}${$url.host || ""}${fixedPath}${$url.search || ""}${$url.hash || ""}`;
}
//#endregion
//#region node_modules/nuxt-site-config/dist/runtime/app/composables/getNitroOrigin.js
function getNitroOrigin(e) {
	e = e || useRequestEvent();
	return e?.context?.siteConfigNitroOrigin || "";
}
//#endregion
//#region node_modules/nuxt-site-config/dist/runtime/app/composables/utils.js
function createSitePathResolver(options = {}) {
	const siteConfig = useSiteConfig();
	const nitroOrigin = getNitroOrigin();
	const nuxtBase = useRuntimeConfig().app.baseURL || "/";
	return (path) => {
		return computed(() => resolveSitePath(unref(path), {
			absolute: unref(options.absolute),
			withBase: unref(options.withBase),
			siteUrl: unref(options.canonical) !== false || false ? siteConfig.url : nitroOrigin,
			trailingSlash: siteConfig.trailingSlash,
			base: nuxtBase
		}));
	};
}
//#endregion
//#region node_modules/nuxt-schema-org/dist/runtime/app/utils/config.js
function useSchemaOrgConfig() {
	const runtimeConfig = useRuntimeConfig();
	return defu(runtimeConfig["nuxt-schema-org"], { scriptAttributes: {} });
}
//#endregion
//#region node_modules/nuxt-schema-org/dist/runtime/app/composables/useSchemaOrg.js
function useSchemaOrg(input) {
	const config = useSchemaOrgConfig();
	useNuxtApp();
	let nodes = input;
	if (isRef(input)) nodes = toValue(input);
	const script = {
		type: "application/ld+json",
		key: "schema-org-graph",
		nodes,
		tagPriority: "high",
		...config.scriptAttributes
	};
	return useHead$1({ script: [script] });
}
//#endregion
//#region node_modules/nuxt-schema-org/dist/runtime/app/utils/shared.js
function resolvePathDirect(siteConfig, path, options) {
	const nuxtBase = useRuntimeConfig().app.baseURL || "/";
	return resolveSitePath(path, {
		absolute: options.absolute,
		withBase: options.withBase,
		siteUrl: toValue(siteConfig.url),
		trailingSlash: toValue(siteConfig.trailingSlash),
		base: nuxtBase
	});
}
function initPlugin(nuxtApp) {
	initSchemaOrgMeta();
	initSchemaOrgHead(nuxtApp);
}
function initSchemaOrgMeta() {
	const route = useRoute$1();
	const siteConfig = useSiteConfig();
	const resolveUrl = (path) => resolvePathDirect(siteConfig, path, {
		absolute: true,
		withBase: true
	});
	function resolveSchemaOrg() {
		const siteConfigResolved = {};
		for (const key in siteConfig) {
			if (key.startsWith("_")) continue;
			siteConfigResolved[key] = toValue(siteConfig[key]);
			if (typeof siteConfigResolved[key] === "object") for (const k in siteConfigResolved[key]) siteConfigResolved[key][k] = toValue(siteConfigResolved[key][k]);
		}
		return {
			...route.meta?.schemaOrg || {},
			...siteConfigResolved,
			url: toValue(resolveUrl(route.path)),
			host: withTrailingSlash(toValue(resolveUrl("/"))),
			inLanguage: toValue(siteConfigResolved.currentLocale) || toValue(siteConfigResolved.defaultLocale),
			path: route.path
		};
	}
	useHead$1({ templateParams: { schemaOrg: resolveSchemaOrg() } });
}
function initSchemaOrgHead(nuxtApp) {
	const head = injectHead(nuxtApp);
	const config = useSchemaOrgConfig();
	const siteConfig = useSiteConfig();
	const schemaOrgPlugin = UnheadSchemaOrg;
	head.use(schemaOrgPlugin({}, async () => {
		const meta = {};
		await nuxtApp.hooks.callHook("schema-org:meta", meta);
		return meta;
	}, {
		minify: config.minify,
		trailingSlash: siteConfig.trailingSlash
	}));
}
function maybeAddIdentitySchemaOrg() {
	const config = useSchemaOrgConfig();
	const siteConfig = useSiteConfig({ resolveRefs: true });
	if (config.identity || siteConfig.identity) {
		const identity = config.identity || siteConfig.identity;
		let identityPayload = {
			name: () => toValue(siteConfig.name),
			url: () => toValue(siteConfig.url)
		};
		let identityType;
		if (typeof identity !== "string") {
			identityPayload = {
				...identityPayload,
				...identity
			};
			identityType = identity.type;
			delete identityPayload.type;
		} else identityType = identity;
		if (siteConfig.twitter) {
			const id = siteConfig.twitter.startsWith("@") ? siteConfig.twitter.slice(1) : siteConfig.twitter;
			identityPayload.sameAs = [`https://twitter.com/${id}`];
		}
		useSchemaOrg([({
			organization: defineOrganization,
			person: definePerson,
			localbusiness: defineLocalBusiness
		}[identityType?.toLowerCase()] || defineOrganization)(identityPayload)]);
	}
}
//#endregion
//#region node_modules/nuxt-schema-org/dist/runtime/app/plugins/init.js
var init_default = defineNuxtPlugin({
	name: "nuxt-schema-org:init",
	setup(nuxtApp) {
		initPlugin(nuxtApp);
	}
});
//#endregion
//#region node_modules/nuxt-schema-org/dist/runtime/app/plugins/defaults.js
var defaults_default$1 = defineNuxtPlugin({
	name: "nuxt-schema-org:defaults",
	dependsOn: ["nuxt-schema-org:init"],
	setup() {
		if (useError().value?.error) return;
		const siteConfig = useSiteConfig();
		useSchemaOrg([defineWebSite({
			name: () => toValue(siteConfig.name) || "",
			inLanguage: () => toValue(siteConfig.currentLocale) || "",
			description: () => toValue(siteConfig.description) || ""
		}), defineWebPage()]);
		maybeAddIdentitySchemaOrg();
	}
});
//#endregion
//#region node_modules/@nuxtjs/robots/dist/runtime/app/plugins/robot-meta.server.js
var robot_meta_server_default = defineNuxtPlugin({ setup() {
	const event = useRequestEvent();
	const ctx = event?.context?.robots;
	event?.context?.robotsProduction;
	if (!ctx) return;
	useHead$1({ meta: [{
		"name": "robots",
		"content": () => ctx.rule || "",
		"data-hint": () => void 0,
		"data-production-content": () => void 0
	}] });
} });
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fcomponents.plugin.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fcomponents_plugin_default = defineNuxtPlugin({ name: "nuxt:global-components" });
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/plugins/1.absoluteImageUrls.server.js
var _1_absoluteImageUrls_server_default = defineNuxtPlugin({
	enforce: "post",
	setup() {
		const head = injectHead();
		if (!head) return;
		const resolver = createSitePathResolver({
			withBase: true,
			absolute: true,
			canonical: true
		});
		head.use({
			key: "absoluteImageUrls",
			hooks: { "tags:resolve": ({ tags }) => {
				for (const tag of tags) {
					if (tag.tag !== "meta") continue;
					if (tag.props.property !== "og:image:url" && tag.props.property !== "og:image" && tag.props.name !== "twitter:image" && tag.props.name !== "twitter:image:src") continue;
					if (typeof tag.props.content !== "string" || !tag.props.content.trim() || tag.props.content.startsWith("http") || tag.props.content.startsWith("//")) continue;
					tag.props.content = unref(resolver(tag.props.content));
				}
			} }
		});
	}
});
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/plugins/0.routeRules.js
function parseRouteRuleState(context) {
	const rules = context._nitro?.routeRules;
	return {
		head: rules?.head,
		seoMeta: rules?.seoMeta
	};
}
var _0_routeRules_default = defineNuxtPlugin({
	enforce: "post",
	env: { islands: false },
	setup() {
		const { tagPriority } = useRuntimeConfig().public["seo-utils"];
		const routeRuleState = useState("nuxt-seo-utils:routeRules", () => null);
		routeRuleState.value = parseRouteRuleState(useRequestEvent()?.context);
		if (routeRuleState.value) {
			const { head: headInput, seoMeta } = routeRuleState.value;
			if (headInput) useHead$1(headInput);
			if (seoMeta) useSeoMeta$1(seoMeta, { tagPriority });
		}
	}
});
//#endregion
//#region node_modules/nuxt-seo-utils/dist/runtime/app/logic/applyDefaults.js
var LOCALE_UNDERSCORE_RE = /_/g;
function applyDefaults() {
	const siteConfig = useSiteConfig({ resolveRefs: false });
	const resolveCurrentLocale = () => {
		return (toValue(siteConfig.currentLocale) || toValue(siteConfig.defaultLocale) || "en").replace(LOCALE_UNDERSCORE_RE, "-");
	};
	injectHead().use(plugins_exports.TemplateParamsPlugin);
	const { canonicalQueryWhitelist, canonicalLowercase, tagPriority, separator, titleSeparator } = useRuntimeConfig().public["seo-utils"];
	const route = useRoute$1();
	const resolveUrl = createSitePathResolver({
		withBase: true,
		absolute: true
	});
	const err = useError();
	const resolveSeparator = () => toValue(siteConfig.separator) || separator || toValue(siteConfig.titleSeparator) || titleSeparator;
	const resolveTitleSeparator = () => toValue(siteConfig.titleSeparator) || titleSeparator || toValue(siteConfig.separator) || separator;
	const canonicalUrl = computed(() => {
		if (err.value) return false;
		const { query } = route;
		let url = resolveUrl(route.path || "/").value || route.path;
		if (canonicalLowercase) try {
			url = url.toLocaleLowerCase(resolveCurrentLocale());
		} catch {
			url = url.toLowerCase();
		}
		const filteredQuery = Object.fromEntries(Object.entries(query).filter(([key]) => canonicalQueryWhitelist.includes(key)).sort(([a], [b]) => a.localeCompare(b)));
		return {
			rel: "canonical",
			href: Object.keys(filteredQuery).length ? `${url}?${stringifyQuery(filteredQuery)}` : url
		};
	});
	const minimalPriority = { tagPriority: "low" };
	const seoMetaPriority = { tagPriority };
	useHead$1({
		htmlAttrs: { lang: resolveCurrentLocale },
		templateParams: {
			site: () => siteConfig,
			siteName: () => siteConfig.name,
			separator: resolveSeparator,
			titleSeparator: resolveTitleSeparator
		},
		titleTemplate: () => err.value ? "%s" : "%s %separator %siteName",
		link: [() => canonicalUrl.value]
	}, minimalPriority);
	useSeoMeta$1({ ogLocale: () => {
		const locale = resolveCurrentLocale();
		if (locale) {
			const l = locale.replace("-", "_");
			if (l.includes("_")) return l;
		}
		return false;
	} }, minimalPriority);
	const seoMeta = {
		ogType: "website",
		ogUrl: () => {
			const url = canonicalUrl.value;
			return url ? url.href : false;
		},
		ogSiteName: siteConfig.name
	};
	if (siteConfig.description) useSeoMeta$1({ description: siteConfig.description }, minimalPriority);
	if (siteConfig.twitter) {
		const id = siteConfig.twitter.startsWith("@") ? siteConfig.twitter : `@${siteConfig.twitter}`;
		seoMeta.twitterCreator = id;
		seoMeta.twitterSite = id;
	}
	useSeoMeta$1(seoMeta, seoMetaPriority);
}
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fplugins.server.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fplugins_server_default = [
	_0_siteConfig_default,
	plugin$2,
	plugin$1,
	plugin,
	siteConfig_default,
	inferSeoMetaPlugin_default,
	titles_default,
	init_default,
	defaults_default$1,
	robot_meta_server_default,
	virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fcomponents_plugin_default,
	_1_absoluteImageUrls_server_default,
	_0_routeRules_default,
	defineNuxtPlugin({
		name: "nuxt-seo:defaults",
		order: 999,
		env: { islands: false },
		setup() {
			applyDefaults();
		}
	})
];
//#endregion
//#region node_modules/nuxt/dist/app/components/route-provider.js
var defineRouteProvider = (name = "RouteProvider") => defineComponent({
	name,
	props: {
		route: {
			type: Object,
			required: true
		},
		vnode: Object,
		vnodeRef: Object,
		renderKey: String,
		trackRootNodes: Boolean,
		routeRecord: Object
	},
	setup(props) {
		const previousKey = props.renderKey;
		const previousRoute = props.route;
		const route = {};
		for (const key in props.route) Object.defineProperty(route, key, {
			get: () => previousKey === props.renderKey ? props.route[key] : previousRoute[key],
			enumerable: true
		});
		provide(PageRouteSymbol, shallowReactive(route));
		return () => {
			if (!props.vnode) return props.vnode;
			return h(props.vnode, { ref: props.vnodeRef });
		};
	}
});
var RouteProvider = defineRouteProvider();
//#endregion
//#region node_modules/nuxt/dist/pages/runtime/page.js
var page_default = defineComponent({
	name: "NuxtPage",
	inheritAttrs: false,
	props: {
		name: { type: String },
		transition: {
			type: [Boolean, Object],
			default: void 0
		},
		keepalive: {
			type: [Boolean, Object],
			default: void 0
		},
		route: { type: Object },
		pageKey: {
			type: [Function, String],
			default: null
		}
	},
	setup(props, { attrs, slots, expose }) {
		const nuxtApp = useNuxtApp();
		const pageRef = ref();
		inject(PageRouteSymbol, null);
		expose({ pageRef });
		inject(LayoutMetaSymbol, null);
		nuxtApp.deferHydration();
		return () => {
			return h(RouterView, {
				name: props.name,
				route: props.route,
				...attrs
			}, { default: markStableSlot((routeProps) => {
				return h(Suspense, { suspensible: true }, { default() {
					return h(RouteProvider, {
						vnode: slots.default ? normalizeSlot(slots.default, routeProps) : routeProps.Component,
						route: routeProps.route,
						vnodeRef: pageRef
					});
				} });
			}) });
		};
	}
});
function markStableSlot(fn) {
	const wrapped = ((routeProps) => {
		const result = fn(routeProps);
		if (Array.isArray(result)) return result;
		if (result == null || !isVNode(result)) return [createCommentVNode()];
		return [result];
	});
	wrapped._n = true;
	return wrapped;
}
function normalizeSlot(slot, data) {
	const slotContent = slot(data);
	return slotContent.length === 1 ? h(slotContent[0]) : h(Fragment, void 0, slotContent);
}
//#endregion
//#region app/components/AchievementBadge.vue?vue&type=script&setup=true&lang.ts
var AchievementBadge_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "AchievementBadge",
	__ssrInlineRender: true,
	props: {
		category: {},
		rank: {},
		threshold: {},
		unlocked: { type: Boolean }
	},
	setup(__props) {
		const props = __props;
		const RANK_COLORS = {
			bronze: {
				fill: "#8a5a34",
				accent: "#e3ab73"
			},
			silver: {
				fill: "#8b949c",
				accent: "#eef1f3"
			},
			gold: {
				fill: "#a9812a",
				accent: "#ffd968"
			},
			emerald: {
				fill: "#146c43",
				accent: "#5be8a8"
			},
			diamond: {
				fill: "#2f6690",
				accent: "#9fe8ff"
			}
		};
		const LOCKED_COLOR = {
			fill: "#3a3d3b",
			accent: "#6f746f"
		};
		const colors = computed(() => props.unlocked ? RANK_COLORS[props.rank] : LOCKED_COLOR);
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				class: "achievement-badge",
				viewBox: "0 0 64 76",
				xmlns: "http://www.w3.org/2000/svg"
			}, _attrs))} data-v-d633fc31><path${ssrRenderAttr("fill", unref(colors).fill)} d="M32 4 L56 14 L56 38 C56 56 46 66 32 72 C18 66 8 56 8 38 L8 14 Z" stroke="rgb(0 0 0 / 20%)" data-v-d633fc31></path>`);
			if (!__props.unlocked) _push(`<!--[--><rect${ssrRenderAttr("fill", unref(colors).accent)} height="10" rx="1.5" width="14" x="25" y="26" data-v-d633fc31></rect><path${ssrRenderAttr("stroke", unref(colors).accent)} d="M27 26 v-4 a5 5 0 0 1 10 0 v4" fill="none" stroke-width="2.4" data-v-d633fc31></path><!--]-->`);
			else if (__props.category === "gamesPlayed") _push(`<!--[--><circle${ssrRenderAttr("stroke", unref(colors).accent)} cx="32" cy="28" fill="none" r="12" stroke-width="2" data-v-d633fc31></circle><path${ssrRenderAttr("fill", unref(colors).accent)} d="M32 20 L37.5 23.8 L35.4 30 L28.6 30 L26.5 23.8 Z" data-v-d633fc31></path><!--]-->`);
			else if (__props.category === "gamesWon") _push(`<!--[--><path${ssrRenderAttr("fill", unref(colors).accent)} d="M23 19 h18 v6 c0 5.5 -4 9 -9 9 s-9 -3.5 -9 -9 z" data-v-d633fc31></path><path${ssrRenderAttr("stroke", unref(colors).accent)} d="M23 20 c-4.5 0 -5.5 3.5 -5.5 5.5 s2 5.5 6.5 5.5" fill="none" stroke-width="1.6" data-v-d633fc31></path><path${ssrRenderAttr("stroke", unref(colors).accent)} d="M41 20 c4.5 0 5.5 3.5 5.5 5.5 s-2 5.5 -6.5 5.5" fill="none" stroke-width="1.6" data-v-d633fc31></path><rect${ssrRenderAttr("fill", unref(colors).accent)} height="4" width="5" x="29.5" y="34" data-v-d633fc31></rect><rect${ssrRenderAttr("fill", unref(colors).accent)} height="3" rx="1" width="16" x="24" y="38" data-v-d633fc31></rect><!--]-->`);
			else if (__props.category === "tier") _push(`<path${ssrRenderAttr("fill", unref(colors).accent)} d="M32 16 L35.3 22.9 42.9 24 37.5 29.3 38.8 36.9 32 33.3 25.2 36.9 26.5 29.3 21.1 24 28.7 22.9 Z" data-v-d633fc31></path>`);
			else if (__props.category === "formationWin") _push(`<!--[--><rect${ssrRenderAttr("stroke", unref(colors).accent)} fill="none" height="20" rx="2" stroke-width="1.6" width="24" x="20" y="18" data-v-d633fc31></rect><line${ssrRenderAttr("stroke", unref(colors).accent)} stroke-width="1.2" x1="20" x2="44" y1="28" y2="28" data-v-d633fc31></line><circle${ssrRenderAttr("stroke", unref(colors).accent)} cx="32" cy="28" fill="none" r="4" stroke-width="1.2" data-v-d633fc31></circle><circle${ssrRenderAttr("fill", unref(colors).accent)} cx="26" cy="34" r="1.6" data-v-d633fc31></circle><circle${ssrRenderAttr("fill", unref(colors).accent)} cx="38" cy="34" r="1.6" data-v-d633fc31></circle><circle${ssrRenderAttr("fill", unref(colors).accent)} cx="32" cy="21" r="1.6" data-v-d633fc31></circle><!--]-->`);
			else _push(`<path${ssrRenderAttr("fill", unref(colors).accent)} d="M32 16 c2 5 8 7 8 13.5 c0 5.2 -3.6 9.5 -8 9.5 s-8 -4.3 -8 -9.5 c0 -1.8 0.8 -3.2 1.8 -4.5 c0.2 3 2 4.8 3.4 4.8 c-0.8 -4.3 1.3 -8 2.8 -13.3 Z" data-v-d633fc31></path>`);
			_push(`<text class="achievement-badge__count"${ssrRenderAttr("fill", unref(colors).accent)} text-anchor="middle" x="32" y="63" data-v-d633fc31>${ssrInterpolate(__props.threshold)}</text></svg>`);
		};
	}
});
//#endregion
//#region app/components/AchievementBadge.vue
var _sfc_setup$5 = AchievementBadge_vue_vue_type_script_setup_true_lang_default.setup;
AchievementBadge_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/AchievementBadge.vue");
	return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
var AchievementBadge_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(AchievementBadge_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-d633fc31"]]), { __name: "AchievementBadge" });
//#endregion
//#region app/components/AppIcon.vue?vue&type=script&setup=true&lang.ts
var AppIcon_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "AppIcon",
	__ssrInlineRender: true,
	props: { name: {} },
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			if (__props.name === "back") _push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				fill: "none",
				height: "16",
				viewBox: "0 0 24 24",
				width: "16"
			}, _attrs))}><path d="M19 12H5m0 0 7 7m-7-7 7-7" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>`);
			else if (__props.name === "close") _push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				fill: "none",
				height: "16",
				viewBox: "0 0 24 24",
				width: "16"
			}, _attrs))}><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path></svg>`);
			else if (__props.name === "info") _push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				fill: "none",
				height: "18",
				viewBox: "0 0 24 24",
				width: "18"
			}, _attrs))}><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"></circle><path d="M12 11v5.5" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path><circle cx="12" cy="7.75" fill="currentColor" r="1.15"></circle></svg>`);
			else if (__props.name === "stats") _push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				fill: "none",
				height: "18",
				viewBox: "0 0 24 24",
				width: "18"
			}, _attrs))}><rect height="8" rx="1" stroke="currentColor" stroke-width="2" width="4" x="4" y="12"></rect><rect height="12" rx="1" stroke="currentColor" stroke-width="2" width="4" x="10" y="8"></rect><rect height="16" rx="1" stroke="currentColor" stroke-width="2" width="4" x="16" y="4"></rect></svg>`);
			else if (__props.name === "calendar") _push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				fill: "none",
				height: "20",
				viewBox: "0 0 24 24",
				width: "20"
			}, _attrs))}><rect height="16" rx="2" stroke="currentColor" stroke-width="2" width="18" x="3" y="5"></rect><path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path><circle cx="8" cy="15" fill="currentColor" r="1.1"></circle><circle cx="12" cy="15" fill="currentColor" r="1.1"></circle><circle cx="16" cy="15" fill="currentColor" r="1.1"></circle></svg>`);
			else if (__props.name === "target") _push(`<svg${ssrRenderAttrs(mergeProps({
				"aria-hidden": "true",
				fill: "none",
				height: "20",
				viewBox: "0 0 24 24",
				width: "20"
			}, _attrs))}><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"></circle><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"></circle><circle cx="12" cy="12" fill="currentColor" r="0.9"></circle><path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke="currentColor" stroke-linecap="round" stroke-width="2"></path></svg>`);
			else _push(`<!---->`);
		};
	}
});
//#endregion
//#region app/components/AppIcon.vue
var _sfc_setup$4 = AppIcon_vue_vue_type_script_setup_true_lang_default.setup;
AppIcon_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/AppIcon.vue");
	return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
var AppIcon_default = Object.assign(AppIcon_vue_vue_type_script_setup_true_lang_default, { __name: "AppIcon" });
//#endregion
//#region app/utils/formations.ts
var FORMATION_DEFINITIONS = [
	{
		code: "442",
		rows: [
			4,
			4,
			2
		]
	},
	{
		code: "433",
		rows: [
			4,
			3,
			3
		]
	},
	{
		code: "451",
		rows: [
			4,
			5,
			1
		]
	},
	{
		code: "352",
		rows: [
			3,
			5,
			2
		]
	},
	{
		code: "343",
		rows: [
			3,
			4,
			3
		]
	},
	{
		code: "541",
		rows: [
			5,
			4,
			1
		]
	},
	{
		code: "532",
		rows: [
			5,
			3,
			2
		]
	}
];
var ROW_Y = {
	GK: 92,
	DEF: 70,
	MID: 46,
	FWD: 18
};
function spreadX(count) {
	return Array.from({ length: count }, (_, index) => (index + 1) / (count + 1) * 100);
}
function sideForIndex(index, count) {
	if (count <= 1) return "Center";
	if (index === 0) return "Left";
	if (index === count - 1) return "Right";
	return "Center";
}
function buildSlots(rows) {
	const [defCount, midCount, fwdCount] = rows;
	const slots = [{
		id: "gk",
		group: "GK",
		x: 50,
		y: ROW_Y.GK,
		side: "Center",
		rowSize: 1
	}];
	const addRow = (group, count) => {
		spreadX(count).forEach((x, index) => {
			slots.push({
				id: `${group.toLowerCase()}-${index + 1}`,
				group,
				rowSize: count,
				side: sideForIndex(index, count),
				x,
				y: ROW_Y[group]
			});
		});
	};
	addRow("DEF", defCount);
	addRow("MID", midCount);
	addRow("FWD", fwdCount);
	return slots;
}
var formations = FORMATION_DEFINITIONS.map(({ code, rows }) => ({
	code,
	target: Number(code),
	rows,
	slots: buildSlots(rows)
}));
function getFormation(code) {
	return formations.find((formation) => formation.code === code);
}
var FORMATION_DIFFICULTY = {
	343: {
		label: "Easier",
		tier: "easier"
	},
	352: {
		label: "Easier",
		tier: "easier"
	},
	433: {
		label: "Balanced",
		tier: "balanced"
	},
	442: {
		label: "Balanced",
		tier: "balanced"
	},
	451: {
		label: "Balanced",
		tier: "balanced"
	},
	532: {
		label: "Hardest",
		tier: "hardest"
	},
	541: {
		label: "Hardest",
		tier: "hardest"
	}
};
function slotRoleKind(group, side, rowSize) {
	switch (group) {
		case "GK": return "goalkeeper";
		case "DEF":
			if (side === "Center") return "centre-back";
			return rowSize >= 5 ? "wing-back" : "fullback";
		case "MID": return side === "Center" ? "central-midfield" : "wide-midfield";
		case "FWD": return rowSize < 3 || side === "Center" ? "striker" : "winger";
	}
}
function describeSlotRole(group, side, rowSize) {
	switch (slotRoleKind(group, side, rowSize)) {
		case "goalkeeper": return "Goalkeeper";
		case "centre-back": return "Centre-back";
		case "fullback": return `${side}-back`;
		case "wing-back": return `${side} wing-back`;
		case "central-midfield": return "Central midfield";
		case "wide-midfield": return `${side} midfield`;
		case "striker": return "Striker";
		case "winger": return `${side} forward`;
	}
}
function getSlotShortLabel(group, side, rowSize) {
	switch (slotRoleKind(group, side, rowSize)) {
		case "goalkeeper": return "GK";
		case "centre-back": return "CB";
		case "fullback": return `${side[0]}B`;
		case "wing-back": return `${side[0]}WB`;
		case "central-midfield": return "CM";
		case "wide-midfield": return `${side[0]}M`;
		case "striker": return "ST";
		case "winger": return `${side[0]}W`;
	}
}
//#endregion
//#region app/utils/achievements.ts
var GAMES_PLAYED_THRESHOLDS = [
	5,
	10,
	25,
	50,
	100,
	250,
	500,
	1e3,
	5e3,
	1e4
];
var WIN_THRESHOLDS = [
	1,
	3,
	5,
	10,
	25,
	50,
	100,
	250,
	500
];
var DAILY_STREAK_THRESHOLDS = [
	3,
	7,
	14,
	30,
	60,
	100,
	365
];
var TIERS = [
	{
		key: "championsLeague",
		label: "Champions League"
	},
	{
		key: "europaLeague",
		label: "Europa League"
	},
	{
		key: "midTable",
		label: "Mid-table"
	},
	{
		key: "avoidedRelegation",
		label: "Avoided Relegation"
	},
	{
		key: "relegated",
		label: "Relegated"
	}
];
var RANKS = [
	"bronze",
	"silver",
	"gold",
	"emerald",
	"diamond"
];
function rankForIndex(index, total) {
	return RANKS[Math.min(Math.floor(index / total * RANKS.length), RANKS.length - 1)];
}
function plural(count, word) {
	return count === 1 ? word : `${word}s`;
}
function buildAchievements() {
	const defs = [];
	GAMES_PLAYED_THRESHOLDS.forEach((threshold, index) => {
		defs.push({
			id: `games-played-${threshold}`,
			category: "gamesPlayed",
			threshold,
			rank: rankForIndex(index, GAMES_PLAYED_THRESHOLDS.length),
			label: `${threshold} Games`,
			description: `Play ${threshold} ${plural(threshold, "game")} in total.`
		});
	});
	WIN_THRESHOLDS.forEach((threshold, index) => {
		defs.push({
			id: `games-won-${threshold}`,
			category: "gamesWon",
			threshold,
			rank: rankForIndex(index, WIN_THRESHOLDS.length),
			label: `${threshold} Exact ${plural(threshold, "Win")}`,
			description: `Land the total exactly on target ${threshold} ${plural(threshold, "time")}.`
		});
	});
	for (const tier of TIERS) WIN_THRESHOLDS.forEach((threshold, index) => {
		defs.push({
			id: `tier-${tier.key}-${threshold}`,
			category: "tier",
			subKind: tier.key,
			threshold,
			rank: rankForIndex(index, WIN_THRESHOLDS.length),
			label: `${threshold}× ${tier.label}`,
			description: `Finish in the ${tier.label} tier ${threshold} ${plural(threshold, "time")}.`
		});
	});
	for (const formation of formations) WIN_THRESHOLDS.forEach((threshold, index) => {
		defs.push({
			id: `formation-win-${formation.code}-${threshold}`,
			category: "formationWin",
			subKind: formation.code,
			threshold,
			rank: rankForIndex(index, WIN_THRESHOLDS.length),
			label: `${threshold}× ${formation.code} ${plural(threshold, "Win")}`,
			description: `Win an exact match with the ${formation.code} formation ${threshold} ${plural(threshold, "time")}.`
		});
	});
	DAILY_STREAK_THRESHOLDS.forEach((threshold, index) => {
		defs.push({
			id: `daily-streak-${threshold}`,
			category: "dailyStreak",
			threshold,
			rank: rankForIndex(index, DAILY_STREAK_THRESHOLDS.length),
			label: `${threshold}-Day Streak`,
			description: `Win the Daily Challenge ${threshold} ${plural(threshold, "day")} in a row.`
		});
	});
	return defs;
}
var ACHIEVEMENTS = buildAchievements();
function metricFor(stats, def) {
	switch (def.category) {
		case "gamesPlayed": return stats.gamesPlayed;
		case "gamesWon": return stats.wins;
		case "tier": return stats[def.subKind];
		case "formationWin": return stats.formationWins[def.subKind];
		case "dailyStreak": return stats.bestDailyStreak;
		default: return 0;
	}
}
function getAchievementProgress(stats) {
	return ACHIEVEMENTS.map((def) => {
		const current = metricFor(stats, def);
		return {
			def,
			current,
			unlocked: current >= def.threshold
		};
	});
}
//#endregion
//#region app/utils/scoring.ts
function calculateTotal(pickedPlayers) {
	return pickedPlayers.reduce((total, player) => total + player.goals + player.assists, 0);
}
function isBust(total, target) {
	return total > target;
}
function isExactWin(total, target) {
	return total === target;
}
function getDistance(total, target) {
	return Math.abs(target - total);
}
var TIER_BOUNDARIES = [
	{
		tier: "championsLeague",
		maxDistance: 25
	},
	{
		tier: "europaLeague",
		maxDistance: 75
	},
	{
		tier: "midTable",
		maxDistance: 150
	},
	{
		tier: "avoidedRelegation",
		maxDistance: 300
	},
	{
		tier: "relegated",
		maxDistance: Infinity
	}
];
function tierForDistance(distance) {
	return TIER_BOUNDARIES.find((boundary) => distance <= boundary.maxDistance)?.tier ?? "relegated";
}
var OUTCOME_ORDER = [
	"relegated",
	"avoidedRelegation",
	"midTable",
	"europaLeague",
	"championsLeague",
	"champion"
];
function outcomeRank(outcome) {
	return OUTCOME_ORDER.indexOf(outcome);
}
function isBetterOutcome(candidate, current) {
	return current === null || outcomeRank(candidate) > outcomeRank(current);
}
function getGameResult(total, target, filledSlots, totalSlots) {
	if (isBust(total, target)) return {
		status: "bust",
		tier: null
	};
	if (filledSlots < totalSlots) return {
		status: "playing",
		tier: null
	};
	if (isExactWin(total, target)) return {
		status: "won",
		tier: null
	};
	return {
		status: "finished",
		tier: tierForDistance(getDistance(total, target))
	};
}
//#endregion
//#region app/composables/useStats.ts
function emptyFormationRecord() {
	return Object.fromEntries(formations.map((formation) => [formation.code, 0]));
}
function emptyStats() {
	return {
		gamesPlayed: 0,
		wins: 0,
		championsLeague: 0,
		europaLeague: 0,
		midTable: 0,
		avoidedRelegation: 0,
		relegated: 0,
		busts: 0,
		bestResult: null,
		formationPlays: emptyFormationRecord(),
		formationWins: emptyFormationRecord(),
		dailyStreak: 0,
		bestDailyStreak: 0,
		dailyWins: 0,
		dailyPlays: 0,
		lastDailyResultDate: null
	};
}
function useStats() {
	const stats = useState("exact-xi-stats", emptyStats);
	const newlyUnlocked = useState("exact-xi-newly-unlocked", () => []);
	function loadStats() {}
	function dismissUnlocked() {
		newlyUnlocked.value = newlyUnlocked.value.slice(1);
	}
	function recordOutcome(status, tier, formationCode) {
		const next = {
			...stats.value,
			gamesPlayed: stats.value.gamesPlayed + 1,
			formationPlays: {
				...stats.value.formationPlays,
				[formationCode]: stats.value.formationPlays[formationCode] + 1
			}
		};
		let outcome = null;
		if (status === "won") {
			next.wins += 1;
			next.formationWins = {
				...stats.value.formationWins,
				[formationCode]: stats.value.formationWins[formationCode] + 1
			};
			outcome = "champion";
		} else if (status === "bust") next.busts += 1;
		else if (status === "finished" && tier) {
			next[tier] += 1;
			outcome = tier;
		}
		if (outcome && isBetterOutcome(outcome, next.bestResult?.outcome ?? null)) next.bestResult = {
			outcome,
			formationCode
		};
		stats.value;
		stats.value = next;
	}
	function recordDailyOutcome(status, date) {
		const current = stats.value;
		if (current.lastDailyResultDate === date) return;
		const isWin = status === "won";
		const isConsecutiveDay = current.lastDailyResultDate !== null && dayIndexForDate(date) - dayIndexForDate(current.lastDailyResultDate) === 1;
		const nextStreak = isWin ? isConsecutiveDay ? current.dailyStreak + 1 : 1 : 0;
		const next = {
			...current,
			dailyPlays: current.dailyPlays + 1,
			dailyWins: current.dailyWins + (isWin ? 1 : 0),
			dailyStreak: nextStreak,
			bestDailyStreak: Math.max(current.bestDailyStreak, nextStreak),
			lastDailyResultDate: date
		};
		stats.value = next;
	}
	function resetStats() {
		stats.value = emptyStats();
	}
	return {
		stats,
		newlyUnlocked,
		loadStats,
		recordOutcome,
		recordDailyOutcome,
		dismissUnlocked,
		resetStats
	};
}
//#endregion
//#region app/components/AchievementToast.vue?vue&type=script&setup=true&lang.ts
var AUTO_DISMISS_MS = 6e3;
var AchievementToast_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "AchievementToast",
	__ssrInlineRender: true,
	setup(__props) {
		const { newlyUnlocked, dismissUnlocked } = useStats();
		useSiteConfig();
		const current = computed(() => newlyUnlocked.value[0] ?? null);
		let dismissTimeout;
		function clearDismissTimer() {
			if (dismissTimeout !== void 0) {
				(void 0).clearTimeout(dismissTimeout);
				dismissTimeout = void 0;
			}
		}
		watch(current, (def) => {
			clearDismissTimer();
			if (def) dismissTimeout = (void 0).setTimeout(dismissUnlocked, AUTO_DISMISS_MS);
		});
		const shareLabel = ref("Share");
		ref(false);
		return (_ctx, _push, _parent, _attrs) => {
			const _component_AchievementBadge = AchievementBadge_default;
			const _component_AppIcon = AppIcon_default;
			if (unref(current)) {
				_push(`<div${ssrRenderAttrs(mergeProps({
					"aria-live": "polite",
					class: "achievement-toast",
					role: "status"
				}, _attrs))} data-v-af87e6e5>`);
				_push(ssrRenderComponent(_component_AchievementBadge, {
					category: unref(current).category,
					rank: unref(current).rank,
					threshold: unref(current).threshold,
					unlocked: ""
				}, null, _parent));
				_push(`<div class="achievement-toast__info" data-v-af87e6e5><p class="achievement-toast__eyebrow" data-v-af87e6e5>Achievement unlocked</p><p class="achievement-toast__label" data-v-af87e6e5>${ssrInterpolate(unref(current).label)}</p></div><div class="achievement-toast__actions" data-v-af87e6e5><button class="achievement-toast__share" type="button" data-v-af87e6e5>${ssrInterpolate(unref(shareLabel))}</button><button aria-label="Dismiss" class="achievement-toast__dismiss" type="button" data-v-af87e6e5>`);
				_push(ssrRenderComponent(_component_AppIcon, { name: "close" }, null, _parent));
				_push(`</button></div></div>`);
			} else _push(`<!---->`);
		};
	}
});
//#endregion
//#region app/components/AchievementToast.vue
var _sfc_setup$3 = AchievementToast_vue_vue_type_script_setup_true_lang_default.setup;
AchievementToast_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/AchievementToast.vue");
	return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
var AchievementToast_default = /*#__PURE__*/ Object.assign(_plugin_vue_export_helper_default(AchievementToast_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-af87e6e5"]]), { __name: "AchievementToast" });
//#endregion
//#region app/composables/useTheme.ts
function useTheme() {
	const theme = useState("exact-xi-theme", () => "match-programme");
	function setTheme(id) {
		theme.value = id;
	}
	function initTheme() {}
	return {
		theme,
		setTheme,
		initTheme
	};
}
//#endregion
//#region app/app.vue?vue&type=script&setup=true&lang.ts
var app_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "app",
	__ssrInlineRender: true,
	setup(__props) {
		useTheme();
		useStats();
		const { public: { gtmId } } = useRuntimeConfig();
		useHead$1({
			script: [{
				key: "gtm-init",
				innerHTML: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`
			}],
			noscript: [{
				key: "gtm-noscript",
				innerHTML: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
				tagPosition: "bodyOpen"
			}]
		});
		return (_ctx, _push, _parent, _attrs) => {
			const _component_NuxtRouteAnnouncer = ServerPlaceholder;
			const _component_NuxtPage = page_default;
			const _component_AchievementToast = AchievementToast_default;
			_push(`<div${ssrRenderAttrs(mergeProps({ class: "app-shell" }, _attrs))} data-v-6ec31c77>`);
			_push(ssrRenderComponent(_component_NuxtRouteAnnouncer, null, null, _parent));
			_push(ssrRenderComponent(_component_NuxtPage, null, null, _parent));
			_push(ssrRenderComponent(_component_AchievementToast, null, null, _parent));
			_push(`</div>`);
		};
	}
});
//#endregion
//#region app/app.vue
var _sfc_setup$2 = app_vue_vue_type_script_setup_true_lang_default.setup;
app_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("app.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var app_default = /*#__PURE__*/ _plugin_vue_export_helper_default(app_vue_vue_type_script_setup_true_lang_default, [["__scopeId", "data-v-6ec31c77"]]);
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-error-page.vue
var _sfc_main$1 = {
	__name: "nuxt-error-page",
	__ssrInlineRender: true,
	props: { error: Object },
	setup(__props) {
		const _error = __props.error;
		const status = Number(_error.statusCode || 500);
		const is404 = status === 404;
		const statusText = _error.statusMessage ?? (is404 ? "Page Not Found" : "Internal Server Error");
		const description = _error.message || _error.toString();
		const stack = void 0;
		const _Error404 = defineAsyncComponent(() => import('../build/error-404-Wsn8CKN1.mjs'));
		const _Error = defineAsyncComponent(() => import('../build/error-500-BLbOvlKC.mjs'));
		const ErrorTemplate = is404 ? _Error404 : _Error;
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(unref(ErrorTemplate), mergeProps({
				status: unref(status),
				statusText: unref(statusText),
				statusCode: unref(status),
				statusMessage: unref(statusText),
				description: unref(description),
				stack: unref(stack)
			}, _attrs), null, _parent));
		};
	}
};
var _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../node_modules/nuxt/dist/app/components/nuxt-error-page.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fisland-renderer.mjs
var IslandRenderer = () => null;
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-root.vue
var _sfc_main = {
	__name: "nuxt-root",
	__ssrInlineRender: true,
	setup(__props) {
		const nuxtApp = useNuxtApp();
		nuxtApp.deferHydration();
		nuxtApp.ssrContext.url;
		const SingleRenderer = false;
		provide(PageRouteSymbol, useRoute$1());
		nuxtApp.hooks.callHookWith((hooks) => hooks.map((hook) => hook()), "vue:setup", []);
		const error = useError();
		const abortRender = error.value && !nuxtApp.ssrContext.error;
		function invokeAppErrorHandler(err, target, info) {
			const errorHandler = nuxtApp.vueApp.config.errorHandler;
			if (errorHandler && !errorHandler.__nuxt_default) try {
				errorHandler(err, target, info);
			} catch (handlerError) {
				console.error("[nuxt] Error in `app.config.errorHandler`", handlerError);
			}
		}
		onErrorCaptured((err, target, info) => {
			nuxtApp.hooks.callHook("vue:error", err, target, info)?.catch((hookError) => console.error("[nuxt] Error in `vue:error` hook", hookError));
			{
				const p = nuxtApp.runWithContext(() => showError(err));
				onServerPrefetch(() => p);
				invokeAppErrorHandler(err, target, info);
				return false;
			}
		});
		const islandContext = nuxtApp.ssrContext.islandContext;
		return (_ctx, _push, _parent, _attrs) => {
			ssrRenderSuspense(_push, {
				default: () => {
					if (unref(abortRender)) _push(`<div></div>`);
					else if (unref(error)) _push(ssrRenderComponent(unref(_sfc_main$1), { error: unref(error) }, null, _parent));
					else if (unref(islandContext)) _push(ssrRenderComponent(unref(IslandRenderer), { context: unref(islandContext) }, null, _parent));
					else if (unref(SingleRenderer)) ssrRenderVNode(_push, createVNode(resolveDynamicComponent(unref(SingleRenderer)), null, null), _parent);
					else _push(ssrRenderComponent(unref(app_default), null, null, _parent));
				},
				_: 1
			});
		};
	}
};
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../node_modules/nuxt/dist/app/components/nuxt-root.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
//#endregion
//#region node_modules/nuxt/dist/app/entry.js
var entry$1 = async function createNuxtAppServer(ssrContext) {
	const vueApp = createApp(_sfc_main);
	const nuxt = createNuxtApp({
		vueApp,
		ssrContext
	});
	try {
		await applyPlugins(nuxt, virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fplugins_server_default);
		await nuxt.hooks.callHook("app:created", vueApp);
	} catch (error) {
		await nuxt.hooks.callHook("app:error", error);
		nuxt.payload.error ||= createError$1(error);
	}
	if (ssrContext && (ssrContext["~renderResponse"] || ssrContext._renderResponse)) throw new Error("skipping render");
	return vueApp;
};
var entry_default = ((ssrContext) => entry$1(ssrContext));

const entry = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: entry_default
}, Symbol.toStringTag, { value: 'Module' }));

export { $fetch$2 as $, AppIcon_default as A, FORMATION_DIFFICULTY as F, NuxtLink as N, TIERS as T, _plugin_vue_export_helper_default as _, useHead$1 as a, useState as b, useStats as c, calculateTotal as d, getGameResult as e, getDistance as f, getFormation as g, useSiteConfig as h, getSlotShortLabel as i, describeSlotRole as j, isBust as k, formations as l, getAchievementProgress as m, AchievementBadge_default as n, useTheme as o, entry as p, useRoute$1 as u };
//# sourceMappingURL=entry.mjs.map
