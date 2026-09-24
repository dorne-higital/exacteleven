import process from 'node:process';globalThis._importMeta_=globalThis._importMeta_||{url:"file:///_entry.js",env:process.env};import http from 'node:http';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { Buffer as Buffer$1 } from 'node:buffer';
import { LRUCache } from 'lru-cache';
import { promises, existsSync } from 'node:fs';
import { resolve as resolve$1, dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createConsola } from 'consola';
import { FilterXSS } from 'xss';
import { collectSitemap } from 'sitemapd/parse';

const suspectProtoRx = /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/;
const suspectConstructorRx = /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/;
const JsonSigRx = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function jsonParseTransform(key, value) {
  if (key === "__proto__" || key === "constructor" && value && typeof value === "object" && "prototype" in value) {
    warnKeyDropped(key);
    return;
  }
  return value;
}
function warnKeyDropped(key) {
  console.warn(`[destr] Dropping "${key}" key to prevent prototype pollution.`);
}
function destr(value, options = {}) {
  if (typeof value !== "string") {
    return value;
  }
  if (value[0] === '"' && value[value.length - 1] === '"' && value.indexOf("\\") === -1) {
    return value.slice(1, -1);
  }
  const _value = value.trim();
  if (_value.length <= 9) {
    switch (_value.toLowerCase()) {
      case "true": {
        return true;
      }
      case "false": {
        return false;
      }
      case "undefined": {
        return void 0;
      }
      case "null": {
        return null;
      }
      case "nan": {
        return Number.NaN;
      }
      case "infinity": {
        return Number.POSITIVE_INFINITY;
      }
      case "-infinity": {
        return Number.NEGATIVE_INFINITY;
      }
    }
  }
  if (!JsonSigRx.test(value)) {
    if (options.strict) {
      throw new SyntaxError("[destr] Invalid JSON");
    }
    return value;
  }
  try {
    if (suspectProtoRx.test(value) || suspectConstructorRx.test(value)) {
      if (options.strict) {
        throw new Error("[destr] Possible prototype pollution");
      }
      return JSON.parse(value, jsonParseTransform);
    }
    return JSON.parse(value);
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return value;
  }
}

const HASH_RE = /#/g;
const AMPERSAND_RE = /&/g;
const SLASH_RE = /\//g;
const EQUAL_RE = /=/g;
const IM_RE = /\?/g;
const PLUS_RE = /\+/g;
const ENC_CARET_RE = /%5e/gi;
const ENC_BACKTICK_RE = /%60/gi;
const ENC_PIPE_RE = /%7c/gi;
const ENC_SPACE_RE = /%20/gi;
const ENC_SLASH_RE = /%2f/gi;
const ENC_ENC_SLASH_RE = /%252f/gi;
function encode(text) {
  return encodeURI("" + text).replace(ENC_PIPE_RE, "|");
}
function encodeQueryValue(input) {
  return encode(typeof input === "string" ? input : JSON.stringify(input)).replace(PLUS_RE, "%2B").replace(ENC_SPACE_RE, "+").replace(HASH_RE, "%23").replace(AMPERSAND_RE, "%26").replace(ENC_BACKTICK_RE, "`").replace(ENC_CARET_RE, "^").replace(SLASH_RE, "%2F");
}
function encodeQueryKey(text) {
  return encodeQueryValue(text).replace(EQUAL_RE, "%3D");
}
function encodePath(text) {
  return encode(text).replace(HASH_RE, "%23").replace(IM_RE, "%3F").replace(ENC_ENC_SLASH_RE, "%2F").replace(AMPERSAND_RE, "%26").replace(PLUS_RE, "%2B");
}
function decode(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch {
    return "" + text;
  }
}
function decodePath(text) {
  return decode(text.replace(ENC_SLASH_RE, "%252F"));
}
function decodeQueryKey(text) {
  return decode(text.replace(PLUS_RE, " "));
}
function decodeQueryValue(text) {
  return decode(text.replace(PLUS_RE, " "));
}

function parseQuery(parametersString = "") {
  const object = /* @__PURE__ */ Object.create(null);
  if (parametersString[0] === "?") {
    parametersString = parametersString.slice(1);
  }
  for (const parameter of parametersString.split("&")) {
    const s = parameter.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) {
      continue;
    }
    const key = decodeQueryKey(s[1]);
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = decodeQueryValue(s[2] || "");
    if (object[key] === void 0) {
      object[key] = value;
    } else if (Array.isArray(object[key])) {
      object[key].push(value);
    } else {
      object[key] = [object[key], value];
    }
  }
  return object;
}
function encodeQueryItem(key, value) {
  if (typeof value === "number" || typeof value === "boolean") {
    value = String(value);
  }
  if (!value) {
    return encodeQueryKey(key);
  }
  if (Array.isArray(value)) {
    return value.map(
      (_value) => `${encodeQueryKey(key)}=${encodeQueryValue(_value)}`
    ).join("&");
  }
  return `${encodeQueryKey(key)}=${encodeQueryValue(value)}`;
}
function stringifyQuery(query) {
  return Object.keys(query).filter((k) => query[k] !== void 0).map((k) => encodeQueryItem(k, query[k])).filter(Boolean).join("&");
}

const PROTOCOL_STRICT_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/;
const PROTOCOL_REGEX = /^[\s\w\0+.-]{2,}:([/\\]{2})?/;
const PROTOCOL_RELATIVE_REGEX = /^([/\\]\s*){2,}[^/\\]/;
const PROTOCOL_SCRIPT_RE = /^[\s\0]*(blob|data|javascript|vbscript):$/i;
const TRAILING_SLASH_RE$1 = /\/$|\/\?|\/#/;
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasProtocol(inputString, opts = {}) {
  if (typeof opts === "boolean") {
    opts = { acceptRelative: opts };
  }
  if (opts.strict) {
    return PROTOCOL_STRICT_REGEX.test(inputString);
  }
  return PROTOCOL_REGEX.test(inputString) || (opts.acceptRelative ? PROTOCOL_RELATIVE_REGEX.test(inputString) : false);
}
function isScriptProtocol(protocol) {
  return !!protocol && PROTOCOL_SCRIPT_RE.test(protocol);
}
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/");
  }
  return TRAILING_SLASH_RE$1.test(input);
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
  if (!hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex !== -1) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
  }
  const [s0, ...s] = path.split("?");
  const cleanPath = s0.endsWith("/") ? s0.slice(0, -1) : s0;
  return (cleanPath || "/") + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  if (!respectQueryAndFragment) {
    return input.endsWith("/") ? input : input + "/";
  }
  if (hasTrailingSlash(input, true)) {
    return input || "/";
  }
  let path = input;
  let fragment = "";
  const fragmentIndex = input.indexOf("#");
  if (fragmentIndex !== -1) {
    path = input.slice(0, fragmentIndex);
    fragment = input.slice(fragmentIndex);
    if (!path) {
      return fragment;
    }
  }
  const [s0, ...s] = path.split("?");
  return s0 + "/" + (s.length > 0 ? `?${s.join("?")}` : "") + fragment;
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
function withBase(input, base) {
  if (isEmptyURL(base) || hasProtocol(input)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (input.startsWith(_base)) {
    const nextChar = input[_base.length];
    if (!nextChar || nextChar === "/" || nextChar === "?") {
      return input;
    }
  }
  return joinURL(_base, input);
}
function withoutBase(input, base) {
  if (isEmptyURL(base)) {
    return input;
  }
  const _base = withoutTrailingSlash(base);
  if (!input.startsWith(_base)) {
    return input;
  }
  const nextChar = input[_base.length];
  if (nextChar && nextChar !== "/" && nextChar !== "?") {
    return input;
  }
  const trimmed = input.slice(_base.length).replace(/^\/+/, "");
  return "/" + trimmed;
}
function withQuery(input, query) {
  const parsed = parseURL(input);
  const mergedQuery = { ...parseQuery(parsed.search), ...query };
  parsed.search = stringifyQuery(mergedQuery);
  return stringifyParsedURL(parsed);
}
function getQuery$1(input) {
  return parseQuery(parseURL(input).search);
}
function isEmptyURL(url) {
  return !url || url === "/";
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}
function joinRelativeURL(..._input) {
  const JOIN_SEGMENT_SPLIT_RE = /\/(?!\/)/;
  const input = _input.filter(Boolean);
  const segments = [];
  let segmentsDepth = 0;
  for (const i of input) {
    if (!i || i === "/") {
      continue;
    }
    for (const [sindex, s] of i.split(JOIN_SEGMENT_SPLIT_RE).entries()) {
      if (!s || s === ".") {
        continue;
      }
      if (s === "..") {
        if (segments.length === 1 && hasProtocol(segments[0])) {
          continue;
        }
        segments.pop();
        segmentsDepth--;
        continue;
      }
      if (sindex === 1 && segments[segments.length - 1]?.endsWith(":/")) {
        segments[segments.length - 1] += "/" + s;
        continue;
      }
      segments.push(s);
      segmentsDepth++;
    }
  }
  let url = segments.join("/");
  if (segmentsDepth >= 0) {
    if (input[0]?.startsWith("/") && !url.startsWith("/")) {
      url = "/" + url;
    } else if (input[0]?.startsWith("./") && !url.startsWith("./")) {
      url = "./" + url;
    }
  } else {
    url = "../".repeat(-1 * segmentsDepth) + url;
  }
  if (input[input.length - 1]?.endsWith("/") && !url.endsWith("/")) {
    url += "/";
  }
  return url;
}
function withHttps(input) {
  return withProtocol(input, "https://");
}
function withProtocol(input, protocol) {
  let match = input.match(PROTOCOL_REGEX);
  if (!match) {
    match = input.match(/^\/{2,}/);
  }
  if (!match) {
    return protocol + input;
  }
  return protocol + input.slice(match[0].length);
}

const protocolRelative = Symbol.for("ufo:protocolRelative");
function parseURL(input = "", defaultProto) {
  const _specialProtoMatch = input.match(
    /^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i
  );
  if (_specialProtoMatch) {
    const [, _proto, _pathname = ""] = _specialProtoMatch;
    return {
      protocol: _proto.toLowerCase(),
      pathname: _pathname,
      href: _proto + _pathname,
      auth: "",
      host: "",
      search: "",
      hash: ""
    };
  }
  if (!hasProtocol(input, { acceptRelative: true })) {
    return defaultProto ? parseURL(defaultProto + input) : parsePath(input);
  }
  const [, protocol = "", auth, hostAndPath = ""] = input.replace(/\\/g, "/").match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, host = "", path = ""] = hostAndPath.match(/([^#/?]*)(.*)?/) || [];
  if (protocol === "file:") {
    path = path.replace(/\/(?=[A-Za-z]:)/, "");
  }
  const { pathname, search, hash } = parsePath(path);
  return {
    protocol: protocol.toLowerCase(),
    auth: auth ? auth.slice(0, Math.max(0, auth.length - 1)) : "",
    host,
    pathname,
    search,
    hash,
    [protocolRelative]: !protocol
  };
}
function parsePath(input = "") {
  const [pathname = "", search = "", hash = ""] = (input.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return {
    pathname,
    search,
    hash
  };
}
function stringifyParsedURL(parsed) {
  const pathname = parsed.pathname || "";
  const search = parsed.search ? (parsed.search.startsWith("?") ? "" : "?") + parsed.search : "";
  const hash = parsed.hash || "";
  const auth = parsed.auth ? parsed.auth + "@" : "";
  const host = parsed.host || "";
  const proto = parsed.protocol || parsed[protocolRelative] ? (parsed.protocol || "") + "//" : "";
  return proto + auth + host + pathname + search + hash;
}

const NODE_TYPES = {
  NORMAL: 0,
  WILDCARD: 1,
  PLACEHOLDER: 2
};

function createRouter$1(options = {}) {
  const ctx = {
    options,
    rootNode: createRadixNode(),
    staticRoutesMap: {}
  };
  const normalizeTrailingSlash = (p) => options.strictTrailingSlash ? p : p.replace(/\/$/, "") || "/";
  if (options.routes) {
    for (const path in options.routes) {
      insert(ctx, normalizeTrailingSlash(path), options.routes[path]);
    }
  }
  return {
    ctx,
    lookup: (path) => lookup(ctx, normalizeTrailingSlash(path)),
    insert: (path, data) => insert(ctx, normalizeTrailingSlash(path), data),
    remove: (path) => remove(ctx, normalizeTrailingSlash(path))
  };
}
function lookup(ctx, path) {
  const staticPathNode = ctx.staticRoutesMap[path];
  if (staticPathNode) {
    return staticPathNode.data;
  }
  const sections = path.split("/");
  const params = {};
  let paramsFound = false;
  let wildcardNode = null;
  let node = ctx.rootNode;
  let wildCardParam = null;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (node.wildcardChildNode !== null) {
      wildcardNode = node.wildcardChildNode;
      wildCardParam = sections.slice(i).join("/");
    }
    const nextNode = node.children.get(section);
    if (nextNode === void 0) {
      if (node && node.placeholderChildren.length > 1) {
        const remaining = sections.length - i;
        node = node.placeholderChildren.find((c) => c.maxDepth === remaining) || null;
      } else {
        node = node.placeholderChildren[0] || null;
      }
      if (!node) {
        break;
      }
      if (node.paramName) {
        params[node.paramName] = section;
      }
      paramsFound = true;
    } else {
      node = nextNode;
    }
  }
  if ((node === null || node.data === null) && wildcardNode !== null) {
    node = wildcardNode;
    params[node.paramName || "_"] = wildCardParam;
    paramsFound = true;
  }
  if (!node) {
    return null;
  }
  if (paramsFound) {
    return {
      ...node.data,
      params: paramsFound ? params : void 0
    };
  }
  return node.data;
}
function insert(ctx, path, data) {
  let isStaticRoute = true;
  const sections = path.split("/");
  let node = ctx.rootNode;
  let _unnamedPlaceholderCtr = 0;
  const matchedNodes = [node];
  for (const section of sections) {
    let childNode;
    if (childNode = node.children.get(section)) {
      node = childNode;
    } else {
      const type = getNodeType(section);
      childNode = createRadixNode({ type, parent: node });
      node.children.set(section, childNode);
      if (type === NODE_TYPES.PLACEHOLDER) {
        childNode.paramName = section === "*" ? `_${_unnamedPlaceholderCtr++}` : section.slice(1);
        node.placeholderChildren.push(childNode);
        isStaticRoute = false;
      } else if (type === NODE_TYPES.WILDCARD) {
        node.wildcardChildNode = childNode;
        childNode.paramName = section.slice(
          3
          /* "**:" */
        ) || "_";
        isStaticRoute = false;
      }
      matchedNodes.push(childNode);
      node = childNode;
    }
  }
  for (const [depth, node2] of matchedNodes.entries()) {
    node2.maxDepth = Math.max(matchedNodes.length - depth, node2.maxDepth || 0);
  }
  node.data = data;
  if (isStaticRoute === true) {
    ctx.staticRoutesMap[path] = node;
  }
  return node;
}
function remove(ctx, path) {
  let success = false;
  const sections = path.split("/");
  let node = ctx.rootNode;
  for (const section of sections) {
    node = node.children.get(section);
    if (!node) {
      return success;
    }
  }
  if (node.data) {
    const lastSection = sections.at(-1) || "";
    node.data = null;
    if (Object.keys(node.children).length === 0 && node.parent) {
      node.parent.children.delete(lastSection);
      node.parent.wildcardChildNode = null;
      node.parent.placeholderChildren = [];
    }
    success = true;
  }
  return success;
}
function createRadixNode(options = {}) {
  return {
    type: options.type || NODE_TYPES.NORMAL,
    maxDepth: 0,
    parent: options.parent || null,
    children: /* @__PURE__ */ new Map(),
    data: options.data || null,
    paramName: options.paramName || null,
    wildcardChildNode: null,
    placeholderChildren: []
  };
}
function getNodeType(str) {
  if (str.startsWith("**")) {
    return NODE_TYPES.WILDCARD;
  }
  if (str[0] === ":" || str === "*") {
    return NODE_TYPES.PLACEHOLDER;
  }
  return NODE_TYPES.NORMAL;
}

function toRouteMatcher(router) {
  const table = _routerNodeToTable("", router.ctx.rootNode);
  return _createMatcher(table, router.ctx.options.strictTrailingSlash);
}
function _createMatcher(table, strictTrailingSlash) {
  return {
    ctx: { table },
    matchAll: (path) => _matchRoutes(path, table, strictTrailingSlash)
  };
}
function _createRouteTable() {
  return {
    static: /* @__PURE__ */ new Map(),
    wildcard: /* @__PURE__ */ new Map(),
    dynamic: /* @__PURE__ */ new Map()
  };
}
function _matchRoutes(path, table, strictTrailingSlash) {
  if (strictTrailingSlash !== true && path.endsWith("/")) {
    path = path.slice(0, -1) || "/";
  }
  const matches = [];
  for (const [key, value] of _sortRoutesMap(table.wildcard)) {
    if (path === key || path.startsWith(key + "/")) {
      matches.push(value);
    }
  }
  for (const [key, value] of _sortRoutesMap(table.dynamic)) {
    if (path.startsWith(key + "/")) {
      const subPath = "/" + path.slice(key.length).split("/").splice(2).join("/");
      matches.push(..._matchRoutes(subPath, value));
    }
  }
  const staticMatch = table.static.get(path);
  if (staticMatch) {
    matches.push(staticMatch);
  }
  return matches.filter(Boolean);
}
function _sortRoutesMap(m) {
  return [...m.entries()].sort((a, b) => a[0].length - b[0].length);
}
function _routerNodeToTable(initialPath, initialNode) {
  const table = _createRouteTable();
  function _addNode(path, node) {
    if (path) {
      if (node.type === NODE_TYPES.NORMAL && !(path.includes("*") || path.includes(":"))) {
        if (node.data) {
          table.static.set(path, node.data);
        }
      } else if (node.type === NODE_TYPES.WILDCARD) {
        table.wildcard.set(path.replace("/**", ""), node.data);
      } else if (node.type === NODE_TYPES.PLACEHOLDER) {
        const subTable = _routerNodeToTable("", node);
        if (node.data) {
          subTable.static.set("/", node.data);
        }
        table.dynamic.set(path.replace(/\/\*|\/:\w+/, ""), subTable);
        return;
      }
    }
    for (const [childPath, child] of node.children.entries()) {
      _addNode(`${path}/${childPath}`.replace("//", "/"), child);
    }
  }
  _addNode(initialPath, initialNode);
  return table;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) {
    return false;
  }
  if (Symbol.iterator in value) {
    return false;
  }
  if (Symbol.toStringTag in value) {
    return Object.prototype.toString.call(value) === "[object Module]";
  }
  return true;
}

function _defu(baseObject, defaults, namespace = ".", merger) {
  if (!isPlainObject(defaults)) {
    return _defu(baseObject, {}, namespace, merger);
  }
  const object = { ...defaults };
  for (const key of Object.keys(baseObject)) {
    if (key === "__proto__" || key === "constructor") {
      continue;
    }
    const value = baseObject[key];
    if (value === null || value === void 0) {
      continue;
    }
    if (merger && merger(object, key, value, namespace)) {
      continue;
    }
    if (Array.isArray(value) && Array.isArray(object[key])) {
      object[key] = [...value, ...object[key]];
    } else if (isPlainObject(value) && isPlainObject(object[key])) {
      object[key] = _defu(
        value,
        object[key],
        (namespace ? `${namespace}.` : "") + key.toString(),
        merger
      );
    } else {
      object[key] = value;
    }
  }
  return object;
}
function createDefu(merger) {
  return (...arguments_) => (
    // eslint-disable-next-line unicorn/no-array-reduce
    arguments_.reduce((p, c) => _defu(p, c, "", merger), {})
  );
}
const defu = createDefu();
const defuFn = createDefu((object, key, currentValue) => {
  if (object[key] !== void 0 && typeof currentValue === "function") {
    object[key] = currentValue(object[key]);
    return true;
  }
});

function o$1(n){throw new Error(`${n} is not implemented yet!`)}let i$2 = class i extends EventEmitter{__unenv__={};readableEncoding=null;readableEnded=true;readableFlowing=false;readableHighWaterMark=0;readableLength=0;readableObjectMode=false;readableAborted=false;readableDidRead=false;closed=false;errored=null;readable=false;destroyed=false;static from(e,t){return new i(t)}constructor(e){super();}_read(e){}read(e){}setEncoding(e){return this}pause(){return this}resume(){return this}isPaused(){return  true}unpipe(e){return this}unshift(e,t){}wrap(e){return this}push(e,t){return  false}_destroy(e,t){this.removeAllListeners();}destroy(e){return this.destroyed=true,this._destroy(e),this}pipe(e,t){return {}}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return this.destroy(),Promise.resolve()}async*[Symbol.asyncIterator](){throw o$1("Readable.asyncIterator")}iterator(e){throw o$1("Readable.iterator")}map(e,t){throw o$1("Readable.map")}filter(e,t){throw o$1("Readable.filter")}forEach(e,t){throw o$1("Readable.forEach")}reduce(e,t,r){throw o$1("Readable.reduce")}find(e,t){throw o$1("Readable.find")}findIndex(e,t){throw o$1("Readable.findIndex")}some(e,t){throw o$1("Readable.some")}toArray(e){throw o$1("Readable.toArray")}every(e,t){throw o$1("Readable.every")}flatMap(e,t){throw o$1("Readable.flatMap")}drop(e,t){throw o$1("Readable.drop")}take(e,t){throw o$1("Readable.take")}asIndexedPairs(e){throw o$1("Readable.asIndexedPairs")}};let l$2 = class l extends EventEmitter{__unenv__={};writable=true;writableEnded=false;writableFinished=false;writableHighWaterMark=0;writableLength=0;writableObjectMode=false;writableCorked=0;closed=false;errored=null;writableNeedDrain=false;writableAborted=false;destroyed=false;_data;_encoding="utf8";constructor(e){super();}pipe(e,t){return {}}_write(e,t,r){if(this.writableEnded){r&&r();return}if(this._data===void 0)this._data=e;else {const s=typeof this._data=="string"?Buffer$1.from(this._data,this._encoding||t||"utf8"):this._data,a=typeof e=="string"?Buffer$1.from(e,t||this._encoding||"utf8"):e;this._data=Buffer$1.concat([s,a]);}this._encoding=t,r&&r();}_writev(e,t){}_destroy(e,t){}_final(e){}write(e,t,r){const s=typeof t=="string"?this._encoding:"utf8",a=typeof t=="function"?t:typeof r=="function"?r:void 0;return this._write(e,s,a),true}setDefaultEncoding(e){return this}end(e,t,r){const s=typeof e=="function"?e:typeof t=="function"?t:typeof r=="function"?r:void 0;if(this.writableEnded)return s&&s(),this;const a=e===s?void 0:e;if(a){const u=t===s?void 0:t;this.write(a,u);}return this.writableEnded=true,this.writableFinished=true,this.emit("close"),this.emit("finish"),s&&s(),this}cork(){}uncork(){}destroy(e){return this.destroyed=true,delete this._data,this.removeAllListeners(),this}compose(e,t){throw new Error("Method not implemented.")}[Symbol.asyncDispose](){return Promise.resolve()}};const c=class{allowHalfOpen=true;_destroy;constructor(e=new i$2,t=new l$2){Object.assign(this,e),Object.assign(this,t),this._destroy=m$1(e._destroy,t._destroy);}};function _(){return Object.assign(c.prototype,i$2.prototype),Object.assign(c.prototype,l$2.prototype),c}function m$1(...n){return function(...e){for(const t of n)t(...e);}}const g=_();let A$1 = class A extends g{__unenv__={};bufferSize=0;bytesRead=0;bytesWritten=0;connecting=false;destroyed=false;pending=false;localAddress="";localPort=0;remoteAddress="";remoteFamily="";remotePort=0;autoSelectFamilyAttemptedAddresses=[];readyState="readOnly";constructor(e){super();}write(e,t,r){return  false}connect(e,t,r){return this}end(e,t,r){return this}setEncoding(e){return this}pause(){return this}resume(){return this}setTimeout(e,t){return this}setNoDelay(e){return this}setKeepAlive(e,t){return this}address(){return {}}unref(){return this}ref(){return this}destroySoon(){this.destroy();}resetAndDestroy(){const e=new Error("ERR_SOCKET_CLOSED");return e.code="ERR_SOCKET_CLOSED",this.destroy(e),this}};class y extends i$2{aborted=false;httpVersion="1.1";httpVersionMajor=1;httpVersionMinor=1;complete=true;connection;socket;headers={};trailers={};method="GET";url="/";statusCode=200;statusMessage="";closed=false;errored=null;readable=false;constructor(e){super(),this.socket=this.connection=e||new A$1;}get rawHeaders(){const e=this.headers,t=[];for(const r in e)if(Array.isArray(e[r]))for(const s of e[r])t.push(r,s);else t.push(r,e[r]);return t}get rawTrailers(){return []}setTimeout(e,t){return this}get headersDistinct(){return p$1(this.headers)}get trailersDistinct(){return p$1(this.trailers)}}function p$1(n){const e={};for(const[t,r]of Object.entries(n))t&&(e[t]=(Array.isArray(r)?r:[r]).filter(Boolean));return e}class w extends l$2{statusCode=200;statusMessage="";upgrading=false;chunkedEncoding=false;shouldKeepAlive=false;useChunkedEncodingByDefault=false;sendDate=false;finished=false;headersSent=false;strictContentLength=false;connection=null;socket=null;req;_headers={};constructor(e){super(),this.req=e;}assignSocket(e){e._httpMessage=this,this.socket=e,this.connection=e,this.emit("socket",e),this._flush();}_flush(){this.flushHeaders();}detachSocket(e){}writeContinue(e){}writeHead(e,t,r){e&&(this.statusCode=e),typeof t=="string"&&(this.statusMessage=t,t=void 0);const s=r||t;if(s&&!Array.isArray(s))for(const a in s)this.setHeader(a,s[a]);return this.headersSent=true,this}writeProcessing(){}setTimeout(e,t){return this}appendHeader(e,t){e=e.toLowerCase();const r=this._headers[e],s=[...Array.isArray(r)?r:[r],...Array.isArray(t)?t:[t]].filter(Boolean);return this._headers[e]=s.length>1?s:s[0],this}setHeader(e,t){return this._headers[e.toLowerCase()]=t,this}setHeaders(e){for(const[t,r]of Object.entries(e))this.setHeader(t,r);return this}getHeader(e){return this._headers[e.toLowerCase()]}getHeaders(){return this._headers}getHeaderNames(){return Object.keys(this._headers)}hasHeader(e){return e.toLowerCase()in this._headers}removeHeader(e){delete this._headers[e.toLowerCase()];}addTrailers(e){}flushHeaders(){}writeEarlyHints(e,t){typeof t=="function"&&t();}}const E$1=(()=>{const n=function(){};return n.prototype=Object.create(null),n})();function R(n={}){const e=new E$1,t=Array.isArray(n)||H(n)?n:Object.entries(n);for(const[r,s]of t)if(s){if(e[r]===void 0){e[r]=s;continue}e[r]=[...Array.isArray(e[r])?e[r]:[e[r]],...Array.isArray(s)?s:[s]];}return e}function H(n){return typeof n?.entries=="function"}function v$1(n={}){if(n instanceof Headers)return n;const e=new Headers;for(const[t,r]of Object.entries(n))if(r!==void 0){if(Array.isArray(r)){for(const s of r)e.append(t,String(s));continue}e.set(t,String(r));}return e}const S$1=new Set([101,204,205,304]);async function b$1(n,e){const t=new y,r=new w(t);t.url=e.url?.toString()||"/";let s;if(!t.url.startsWith("/")){const d=new URL(t.url);s=d.host,t.url=d.pathname+d.search+d.hash;}t.method=e.method||"GET",t.headers=R(e.headers||{}),t.headers.host||(t.headers.host=e.host||s||"localhost"),t.connection.encrypted=t.connection.encrypted||e.protocol==="https",t.body=e.body||null,t.__unenv__=e.context,await n(t,r);let a=r._data;(S$1.has(r.statusCode)||t.method.toUpperCase()==="HEAD")&&(a=null,delete r._headers["content-length"]);const u={status:r.statusCode,statusText:r.statusMessage,headers:r._headers,body:a};return t.destroy(),r.destroy(),u}async function C(n,e,t={}){try{const r=await b$1(n,{url:e,...t});return new Response(r.body,{status:r.status,statusText:r.statusText,headers:v$1(r.headers)})}catch(r){return new Response(r.toString(),{status:Number.parseInt(r.statusCode||r.code)||500,statusText:r.statusText})}}

function hasProp(obj, prop) {
  try {
    return prop in obj;
  } catch {
    return false;
  }
}

class H3Error extends Error {
  static __h3_error__ = true;
  statusCode = 500;
  fatal = false;
  unhandled = false;
  statusMessage;
  data;
  cause;
  constructor(message, opts = {}) {
    super(message, opts);
    if (opts.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
  toJSON() {
    const obj = {
      message: this.message,
      statusCode: sanitizeStatusCode(this.statusCode, 500)
    };
    if (this.statusMessage) {
      obj.statusMessage = sanitizeStatusMessage(this.statusMessage);
    }
    if (this.data !== void 0) {
      obj.data = this.data;
    }
    return obj;
  }
}
function createError$1(input) {
  if (typeof input === "string") {
    return new H3Error(input);
  }
  if (isError(input)) {
    return input;
  }
  const err = new H3Error(input.message ?? input.statusMessage ?? "", {
    cause: input.cause || input
  });
  if (hasProp(input, "stack")) {
    try {
      Object.defineProperty(err, "stack", {
        get() {
          return input.stack;
        }
      });
    } catch {
      try {
        err.stack = input.stack;
      } catch {
      }
    }
  }
  if (input.data) {
    err.data = input.data;
  }
  if (input.statusCode) {
    err.statusCode = sanitizeStatusCode(input.statusCode, err.statusCode);
  } else if (input.status) {
    err.statusCode = sanitizeStatusCode(input.status, err.statusCode);
  }
  if (input.statusMessage) {
    err.statusMessage = input.statusMessage;
  } else if (input.statusText) {
    err.statusMessage = input.statusText;
  }
  if (err.statusMessage) {
    const originalMessage = err.statusMessage;
    const sanitizedMessage = sanitizeStatusMessage(err.statusMessage);
    if (sanitizedMessage !== originalMessage) {
      console.warn(
        "[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default."
      );
    }
  }
  if (input.fatal !== void 0) {
    err.fatal = input.fatal;
  }
  if (input.unhandled !== void 0) {
    err.unhandled = input.unhandled;
  }
  return err;
}
function sendError(event, error, debug) {
  if (event.handled) {
    return;
  }
  const h3Error = isError(error) ? error : createError$1(error);
  const responseBody = {
    statusCode: h3Error.statusCode,
    statusMessage: h3Error.statusMessage,
    stack: [],
    data: h3Error.data
  };
  if (debug) {
    responseBody.stack = (h3Error.stack || "").split("\n").map((l) => l.trim());
  }
  if (event.handled) {
    return;
  }
  const _code = Number.parseInt(h3Error.statusCode);
  setResponseStatus(event, _code, h3Error.statusMessage);
  event.node.res.setHeader("content-type", MIMES.json);
  event.node.res.end(JSON.stringify(responseBody, void 0, 2));
}
function isError(input) {
  return input?.constructor?.__h3_error__ === true;
}

function parse(multipartBodyBuffer, boundary) {
  let lastline = "";
  let state = 0 /* INIT */;
  let buffer = [];
  const allParts = [];
  let currentPartHeaders = [];
  for (let i = 0; i < multipartBodyBuffer.length; i++) {
    const prevByte = i > 0 ? multipartBodyBuffer[i - 1] : null;
    const currByte = multipartBodyBuffer[i];
    const newLineChar = currByte === 10 || currByte === 13;
    if (!newLineChar) {
      lastline += String.fromCodePoint(currByte);
    }
    const newLineDetected = currByte === 10 && prevByte === 13;
    if (0 /* INIT */ === state && newLineDetected) {
      if ("--" + boundary === lastline) {
        state = 1 /* READING_HEADERS */;
      }
      lastline = "";
    } else if (1 /* READING_HEADERS */ === state && newLineDetected) {
      if (lastline.length > 0) {
        const i2 = lastline.indexOf(":");
        if (i2 > 0) {
          const name = lastline.slice(0, i2).toLowerCase();
          const value = lastline.slice(i2 + 1).trim();
          currentPartHeaders.push([name, value]);
        }
      } else {
        state = 2 /* READING_DATA */;
        buffer = [];
      }
      lastline = "";
    } else if (2 /* READING_DATA */ === state) {
      if (lastline.length > boundary.length + 4) {
        lastline = "";
      }
      if ("--" + boundary === lastline) {
        const j = buffer.length - lastline.length;
        const part = buffer.slice(0, j - 1);
        allParts.push(process$1(part, currentPartHeaders));
        buffer = [];
        currentPartHeaders = [];
        lastline = "";
        state = 3 /* READING_PART_SEPARATOR */;
      } else {
        buffer.push(currByte);
      }
      if (newLineDetected) {
        lastline = "";
      }
    } else if (3 /* READING_PART_SEPARATOR */ === state && newLineDetected) {
      state = 1 /* READING_HEADERS */;
    }
  }
  return allParts;
}
function process$1(data, headers) {
  const dataObj = {};
  const contentDispositionHeader = headers.find((h) => h[0] === "content-disposition")?.[1] || "";
  for (const i of contentDispositionHeader.split(";")) {
    const s = i.split("=");
    if (s.length !== 2) {
      continue;
    }
    const key = (s[0] || "").trim();
    if (key === "name" || key === "filename") {
      const _value = (s[1] || "").trim().replace(/"/g, "");
      dataObj[key] = Buffer.from(_value, "latin1").toString("utf8");
    }
  }
  const contentType = headers.find((h) => h[0] === "content-type")?.[1] || "";
  if (contentType) {
    dataObj.type = contentType;
  }
  dataObj.data = Buffer.from(data);
  return dataObj;
}

function getQuery(event) {
  return getQuery$1(event.path || "");
}
function isMethod(event, expected, allowHead) {
  if (typeof expected === "string") {
    if (event.method === expected) {
      return true;
    }
  } else if (expected.includes(event.method)) {
    return true;
  }
  return false;
}
function assertMethod(event, expected, allowHead) {
  if (!isMethod(event, expected)) {
    throw createError$1({
      statusCode: 405,
      statusMessage: "HTTP method is not allowed."
    });
  }
}
function getRequestHeaders(event) {
  const _headers = {};
  for (const key in event.node.req.headers) {
    const val = event.node.req.headers[key];
    _headers[key] = Array.isArray(val) ? val.filter(Boolean).join(", ") : val;
  }
  return _headers;
}
function getRequestHeader(event, name) {
  const headers = getRequestHeaders(event);
  const value = headers[name.toLowerCase()];
  return value;
}
const getHeader = getRequestHeader;
function getRequestHost(event, opts = {}) {
  if (opts.xForwardedHost) {
    const _header = event.node.req.headers["x-forwarded-host"];
    const xForwardedHost = (_header || "").split(",").shift()?.trim();
    if (xForwardedHost) {
      return xForwardedHost;
    }
  }
  return event.node.req.headers.host || "localhost";
}
function getRequestProtocol(event, opts = {}) {
  if (opts.xForwardedProto !== false && event.node.req.headers["x-forwarded-proto"] === "https") {
    return "https";
  }
  return event.node.req.connection?.encrypted ? "https" : "http";
}
function getRequestURL(event, opts = {}) {
  const host = getRequestHost(event, opts);
  const protocol = getRequestProtocol(event, opts);
  const path = (event.node.req.originalUrl || event.path).replace(
    /^[/\\]+/g,
    "/"
  );
  return new URL(path, `${protocol}://${host}`);
}
function getRequestIP(event, opts = {}) {
  if (event.context.clientAddress) {
    return event.context.clientAddress;
  }
  if (opts.xForwardedFor) {
    const xForwardedFor = getRequestHeader(event, "x-forwarded-for")?.split(",").shift()?.trim();
    if (xForwardedFor) {
      return xForwardedFor;
    }
  }
  if (event.node.req.socket.remoteAddress) {
    return event.node.req.socket.remoteAddress;
  }
}

const RawBodySymbol = Symbol.for("h3RawBody");
const ParsedBodySymbol = Symbol.for("h3ParsedBody");
const PayloadMethods$1 = ["PATCH", "POST", "PUT", "DELETE"];
function readRawBody(event, encoding = "utf8") {
  assertMethod(event, PayloadMethods$1);
  const _rawBody = event._requestBody || event.web?.request?.body || event.node.req[RawBodySymbol] || event.node.req.rawBody || event.node.req.body;
  if (_rawBody) {
    const promise2 = Promise.resolve(_rawBody).then((_resolved) => {
      if (Buffer.isBuffer(_resolved)) {
        return _resolved;
      }
      if (typeof _resolved.pipeTo === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.pipeTo(
            new WritableStream({
              write(chunk) {
                chunks.push(chunk);
              },
              close() {
                resolve(Buffer.concat(chunks));
              },
              abort(reason) {
                reject(reason);
              }
            })
          ).catch(reject);
        });
      } else if (typeof _resolved.pipe === "function") {
        return new Promise((resolve, reject) => {
          const chunks = [];
          _resolved.on("data", (chunk) => {
            chunks.push(chunk);
          }).on("end", () => {
            resolve(Buffer.concat(chunks));
          }).on("error", reject);
        });
      }
      if (_resolved.constructor === Object) {
        return Buffer.from(JSON.stringify(_resolved));
      }
      if (_resolved instanceof URLSearchParams) {
        return Buffer.from(_resolved.toString());
      }
      if (_resolved instanceof FormData) {
        return new Response(_resolved).bytes().then((uint8arr) => Buffer.from(uint8arr));
      }
      return Buffer.from(_resolved);
    });
    return encoding ? promise2.then((buff) => buff.toString(encoding)) : promise2;
  }
  if (!Number.parseInt(event.node.req.headers["content-length"] || "") && !/\bchunked\b/i.test(
    String(event.node.req.headers["transfer-encoding"] ?? "")
  )) {
    return Promise.resolve(void 0);
  }
  const promise = event.node.req[RawBodySymbol] = new Promise(
    (resolve, reject) => {
      const bodyData = [];
      event.node.req.on("error", (err) => {
        reject(err);
      }).on("data", (chunk) => {
        bodyData.push(chunk);
      }).on("end", () => {
        resolve(Buffer.concat(bodyData));
      });
    }
  );
  const result = encoding ? promise.then((buff) => buff.toString(encoding)) : promise;
  return result;
}
async function readBody(event, options = {}) {
  const request = event.node.req;
  if (hasProp(request, ParsedBodySymbol)) {
    return request[ParsedBodySymbol];
  }
  const contentType = request.headers["content-type"] || "";
  const body = await readRawBody(event);
  let parsed;
  if (contentType === "application/json") {
    parsed = _parseJSON(body, options.strict ?? true);
  } else if (contentType.startsWith("application/x-www-form-urlencoded")) {
    parsed = _parseURLEncodedBody(body);
  } else if (contentType.startsWith("text/")) {
    parsed = body;
  } else {
    parsed = _parseJSON(body, options.strict ?? false);
  }
  request[ParsedBodySymbol] = parsed;
  return parsed;
}
async function readMultipartFormData(event) {
  const contentType = getRequestHeader(event, "content-type");
  if (!contentType || !contentType.startsWith("multipart/form-data")) {
    return;
  }
  const boundary = contentType.match(/boundary=([^;]*)(;|$)/i)?.[1];
  if (!boundary) {
    return;
  }
  const body = await readRawBody(event, false);
  if (!body) {
    return;
  }
  return parse(body, boundary);
}
function getRequestWebStream(event) {
  if (!PayloadMethods$1.includes(event.method)) {
    return;
  }
  const bodyStream = event.web?.request?.body || event._requestBody;
  if (bodyStream) {
    return bodyStream;
  }
  const _hasRawBody = RawBodySymbol in event.node.req || "rawBody" in event.node.req || "body" in event.node.req || "__unenv__" in event.node.req;
  if (_hasRawBody) {
    return new ReadableStream({
      async start(controller) {
        const _rawBody = await readRawBody(event, false);
        if (_rawBody) {
          controller.enqueue(_rawBody);
        }
        controller.close();
      }
    });
  }
  return new ReadableStream({
    start: (controller) => {
      event.node.req.on("data", (chunk) => {
        controller.enqueue(chunk);
      });
      event.node.req.on("end", () => {
        controller.close();
      });
      event.node.req.on("error", (err) => {
        controller.error(err);
      });
    }
  });
}
function _parseJSON(body = "", strict) {
  if (!body) {
    return void 0;
  }
  try {
    return destr(body, { strict });
  } catch {
    throw createError$1({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid JSON body"
    });
  }
}
function _parseURLEncodedBody(body) {
  const form = new URLSearchParams(body);
  const parsedForm = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of form.entries()) {
    if (hasProp(parsedForm, key)) {
      if (!Array.isArray(parsedForm[key])) {
        parsedForm[key] = [parsedForm[key]];
      }
      parsedForm[key].push(value);
    } else {
      parsedForm[key] = value;
    }
  }
  return parsedForm;
}

function handleCacheHeaders(event, opts) {
  const cacheControls = ["public", ...opts.cacheControls || []];
  let cacheMatched = false;
  if (opts.maxAge !== void 0) {
    cacheControls.push(`max-age=${+opts.maxAge}`, `s-maxage=${+opts.maxAge}`);
  }
  if (opts.modifiedTime) {
    const modifiedTime = new Date(opts.modifiedTime);
    const ifModifiedSince = event.node.req.headers["if-modified-since"];
    event.node.res.setHeader("last-modified", modifiedTime.toUTCString());
    if (ifModifiedSince && new Date(ifModifiedSince) >= modifiedTime) {
      cacheMatched = true;
    }
  }
  if (opts.etag) {
    event.node.res.setHeader("etag", opts.etag);
    const ifNonMatch = event.node.req.headers["if-none-match"];
    if (ifNonMatch === opts.etag) {
      cacheMatched = true;
    }
  }
  event.node.res.setHeader("cache-control", cacheControls.join(", "));
  if (cacheMatched) {
    event.node.res.statusCode = 304;
    if (!event.handled) {
      event.node.res.end();
    }
    return true;
  }
  return false;
}

const MIMES = {
  html: "text/html",
  json: "application/json"
};

const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
  if (!statusCode) {
    return defaultStatusCode;
  }
  if (typeof statusCode === "string") {
    statusCode = Number.parseInt(statusCode, 10);
  }
  if (statusCode < 100 || statusCode > 999) {
    return defaultStatusCode;
  }
  return statusCode;
}
function splitCookiesString(cookiesString) {
  if (Array.isArray(cookiesString)) {
    return cookiesString.flatMap((c) => splitCookiesString(c));
  }
  if (typeof cookiesString !== "string") {
    return [];
  }
  const cookiesStrings = [];
  let pos = 0;
  let start;
  let ch;
  let lastComma;
  let nextStart;
  let cookiesSeparatorFound;
  const skipWhitespace = () => {
    while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) {
      pos += 1;
    }
    return pos < cookiesString.length;
  };
  const notSpecialChar = () => {
    ch = cookiesString.charAt(pos);
    return ch !== "=" && ch !== ";" && ch !== ",";
  };
  while (pos < cookiesString.length) {
    start = pos;
    cookiesSeparatorFound = false;
    while (skipWhitespace()) {
      ch = cookiesString.charAt(pos);
      if (ch === ",") {
        lastComma = pos;
        pos += 1;
        skipWhitespace();
        nextStart = pos;
        while (pos < cookiesString.length && notSpecialChar()) {
          pos += 1;
        }
        if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
          cookiesSeparatorFound = true;
          pos = nextStart;
          cookiesStrings.push(cookiesString.slice(start, lastComma));
          start = pos;
        } else {
          pos = lastComma + 1;
        }
      } else {
        pos += 1;
      }
    }
    if (!cookiesSeparatorFound || pos >= cookiesString.length) {
      cookiesStrings.push(cookiesString.slice(start));
    }
  }
  return cookiesStrings;
}

const defer = typeof setImmediate === "undefined" ? (fn) => fn() : setImmediate;
function send(event, data, type) {
  if (type) {
    defaultContentType(event, type);
  }
  return new Promise((resolve) => {
    defer(() => {
      if (!event.handled) {
        event.node.res.end(data);
      }
      resolve();
    });
  });
}
function sendNoContent(event, code) {
  if (event.handled) {
    return;
  }
  if (!code && event.node.res.statusCode !== 200) {
    code = event.node.res.statusCode;
  }
  const _code = sanitizeStatusCode(code, 204);
  if (_code === 204) {
    event.node.res.removeHeader("content-length");
  }
  event.node.res.writeHead(_code);
  event.node.res.end();
}
function setResponseStatus(event, code, text) {
  if (code) {
    event.node.res.statusCode = sanitizeStatusCode(
      code,
      event.node.res.statusCode
    );
  }
  if (text) {
    event.node.res.statusMessage = sanitizeStatusMessage(text);
  }
}
function getResponseStatus(event) {
  return event.node.res.statusCode;
}
function getResponseStatusText(event) {
  return event.node.res.statusMessage;
}
function defaultContentType(event, type) {
  if (type && event.node.res.statusCode !== 304 && !event.node.res.getHeader("content-type")) {
    event.node.res.setHeader("content-type", type);
  }
}
function sendRedirect(event, location, code = 302) {
  event.node.res.statusCode = sanitizeStatusCode(
    code,
    event.node.res.statusCode
  );
  event.node.res.setHeader("location", location);
  const encodedLoc = location.replace(/"/g, "%22");
  const html = `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`;
  return send(event, html, MIMES.html);
}
function getResponseHeader(event, name) {
  return event.node.res.getHeader(name);
}
function setResponseHeaders(event, headers) {
  for (const [name, value] of Object.entries(headers)) {
    event.node.res.setHeader(
      name,
      value
    );
  }
}
const setHeaders = setResponseHeaders;
function setResponseHeader(event, name, value) {
  event.node.res.setHeader(name, value);
}
const setHeader = setResponseHeader;
function appendResponseHeaders(event, headers) {
  for (const [name, value] of Object.entries(headers)) {
    appendResponseHeader(event, name, value);
  }
}
const appendHeaders = appendResponseHeaders;
function appendResponseHeader(event, name, value) {
  let current = event.node.res.getHeader(name);
  if (!current) {
    event.node.res.setHeader(name, value);
    return;
  }
  if (!Array.isArray(current)) {
    current = [current.toString()];
  }
  event.node.res.setHeader(name, [...current, value]);
}
function removeResponseHeader(event, name) {
  return event.node.res.removeHeader(name);
}
function isStream(data) {
  if (!data || typeof data !== "object") {
    return false;
  }
  if (typeof data.pipe === "function") {
    if (typeof data._read === "function") {
      return true;
    }
    if (typeof data.abort === "function") {
      return true;
    }
  }
  if (typeof data.pipeTo === "function") {
    return true;
  }
  return false;
}
function isWebResponse(data) {
  return typeof Response !== "undefined" && data instanceof Response;
}
function sendStream(event, stream) {
  if (!stream || typeof stream !== "object") {
    throw new Error("[h3] Invalid stream provided.");
  }
  event.node.res._data = stream;
  if (!event.node.res.socket) {
    event._handled = true;
    return Promise.resolve();
  }
  if (hasProp(stream, "pipeTo") && typeof stream.pipeTo === "function") {
    return stream.pipeTo(
      new WritableStream({
        write(chunk) {
          event.node.res.write(chunk);
        }
      })
    ).then(() => {
      event.node.res.end();
    });
  }
  if (hasProp(stream, "pipe") && typeof stream.pipe === "function") {
    return new Promise((resolve, reject) => {
      stream.pipe(event.node.res);
      if (stream.on) {
        stream.on("end", () => {
          event.node.res.end();
          resolve();
        });
        stream.on("error", (error) => {
          reject(error);
        });
      }
      event.node.res.on("close", () => {
        if (stream.abort) {
          stream.abort();
        }
      });
    });
  }
  throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse(event, response) {
  for (const [key, value] of response.headers) {
    if (key === "set-cookie") {
      event.node.res.appendHeader(key, splitCookiesString(value));
    } else {
      event.node.res.setHeader(key, value);
    }
  }
  if (response.status) {
    event.node.res.statusCode = sanitizeStatusCode(
      response.status,
      event.node.res.statusCode
    );
  }
  if (response.statusText) {
    event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
  }
  if (response.redirected) {
    event.node.res.setHeader("location", response.url);
  }
  if (!response.body) {
    event.node.res.end();
    return;
  }
  return sendStream(event, response.body);
}

function resolveCorsOptions(options = {}) {
  const defaultOptions = {
    origin: "*",
    methods: "*",
    allowHeaders: "*",
    exposeHeaders: "*",
    credentials: false,
    maxAge: false,
    preflight: {
      statusCode: 204
    }
  };
  return defu(options, defaultOptions);
}
function isPreflightRequest(event) {
  const origin = getRequestHeader(event, "origin");
  const accessControlRequestMethod = getRequestHeader(
    event,
    "access-control-request-method"
  );
  return event.method === "OPTIONS" && !!origin && !!accessControlRequestMethod;
}
function isCorsOriginAllowed(origin, options) {
  const { origin: originOption } = options;
  if (!origin || !originOption || originOption === "*" || originOption === "null") {
    return true;
  }
  if (Array.isArray(originOption)) {
    return originOption.some((_origin) => {
      if (_origin instanceof RegExp) {
        return _origin.test(origin);
      }
      return origin === _origin;
    });
  }
  return originOption(origin);
}
function createOriginHeaders(event, options) {
  const { origin: originOption } = options;
  const origin = getRequestHeader(event, "origin");
  if (!origin || !originOption || originOption === "*") {
    return { "access-control-allow-origin": "*" };
  }
  if (typeof originOption === "string") {
    return { "access-control-allow-origin": originOption, vary: "origin" };
  }
  return isCorsOriginAllowed(origin, options) ? { "access-control-allow-origin": origin, vary: "origin" } : {};
}
function createMethodsHeaders(options) {
  const { methods } = options;
  if (!methods) {
    return {};
  }
  if (methods === "*") {
    return { "access-control-allow-methods": "*" };
  }
  return methods.length > 0 ? { "access-control-allow-methods": methods.join(",") } : {};
}
function createCredentialsHeaders(options) {
  const { credentials } = options;
  if (credentials) {
    return { "access-control-allow-credentials": "true" };
  }
  return {};
}
function createAllowHeaderHeaders(event, options) {
  const { allowHeaders } = options;
  if (!allowHeaders || allowHeaders === "*" || allowHeaders.length === 0) {
    const header = getRequestHeader(event, "access-control-request-headers");
    return header ? {
      "access-control-allow-headers": header,
      vary: "access-control-request-headers"
    } : {};
  }
  return {
    "access-control-allow-headers": allowHeaders.join(","),
    vary: "access-control-request-headers"
  };
}
function createExposeHeaders(options) {
  const { exposeHeaders } = options;
  if (!exposeHeaders) {
    return {};
  }
  if (exposeHeaders === "*") {
    return { "access-control-expose-headers": exposeHeaders };
  }
  return { "access-control-expose-headers": exposeHeaders.join(",") };
}
function appendCorsPreflightHeaders(event, options) {
  appendHeaders(event, createOriginHeaders(event, options));
  appendHeaders(event, createCredentialsHeaders(options));
  appendHeaders(event, createExposeHeaders(options));
  appendHeaders(event, createMethodsHeaders(options));
  appendHeaders(event, createAllowHeaderHeaders(event, options));
}
function appendCorsHeaders(event, options) {
  appendHeaders(event, createOriginHeaders(event, options));
  appendHeaders(event, createCredentialsHeaders(options));
  appendHeaders(event, createExposeHeaders(options));
}

function handleCors(event, options) {
  const _options = resolveCorsOptions(options);
  if (isPreflightRequest(event)) {
    appendCorsPreflightHeaders(event, options);
    sendNoContent(event, _options.preflight.statusCode);
    return true;
  }
  appendCorsHeaders(event, options);
  return false;
}

const PayloadMethods = /* @__PURE__ */ new Set(["PATCH", "POST", "PUT", "DELETE"]);
const ignoredHeaders = /* @__PURE__ */ new Set([
  "transfer-encoding",
  "accept-encoding",
  "connection",
  "keep-alive",
  "upgrade",
  "expect",
  "host",
  "accept"
]);
async function proxyRequest(event, target, opts = {}) {
  let body;
  let duplex;
  if (PayloadMethods.has(event.method)) {
    if (opts.streamRequest) {
      body = getRequestWebStream(event);
      duplex = "half";
    } else {
      body = await readRawBody(event, false).catch(() => void 0);
    }
  }
  const method = opts.fetchOptions?.method || event.method;
  const fetchHeaders = mergeHeaders$1(
    getProxyRequestHeaders(event, { host: target.startsWith("/") }),
    opts.fetchOptions?.headers,
    opts.headers
  );
  return sendProxy(event, target, {
    ...opts,
    fetchOptions: {
      method,
      body,
      duplex,
      ...opts.fetchOptions,
      headers: fetchHeaders
    }
  });
}
async function sendProxy(event, target, opts = {}) {
  let response;
  try {
    response = await _getFetch(opts.fetch)(target, {
      headers: opts.headers,
      ignoreResponseError: true,
      // make $ofetch.raw transparent
      ...opts.fetchOptions
    });
  } catch (error) {
    throw createError$1({
      status: 502,
      statusMessage: "Bad Gateway",
      cause: error
    });
  }
  event.node.res.statusCode = sanitizeStatusCode(
    response.status,
    event.node.res.statusCode
  );
  event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
  const cookies = [];
  for (const [key, value] of response.headers.entries()) {
    if (key === "content-encoding") {
      continue;
    }
    if (key === "content-length") {
      continue;
    }
    if (key === "set-cookie") {
      cookies.push(...splitCookiesString(value));
      continue;
    }
    event.node.res.setHeader(key, value);
  }
  if (cookies.length > 0) {
    event.node.res.setHeader(
      "set-cookie",
      cookies.map((cookie) => {
        if (opts.cookieDomainRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookieDomainRewrite,
            "domain"
          );
        }
        if (opts.cookiePathRewrite) {
          cookie = rewriteCookieProperty(
            cookie,
            opts.cookiePathRewrite,
            "path"
          );
        }
        return cookie;
      })
    );
  }
  if (opts.onResponse) {
    await opts.onResponse(event, response);
  }
  if (response._data !== void 0) {
    return response._data;
  }
  if (event.handled) {
    return;
  }
  if (opts.sendStream === false) {
    const data = new Uint8Array(await response.arrayBuffer());
    return event.node.res.end(data);
  }
  if (response.body) {
    for await (const chunk of response.body) {
      event.node.res.write(chunk);
    }
  }
  return event.node.res.end();
}
function getProxyRequestHeaders(event, opts) {
  const headers = /* @__PURE__ */ Object.create(null);
  const reqHeaders = getRequestHeaders(event);
  for (const name in reqHeaders) {
    if (!ignoredHeaders.has(name) || name === "host" && opts?.host) {
      headers[name] = reqHeaders[name];
    }
  }
  return headers;
}
function fetchWithEvent$1(event, req, init, options) {
  return _getFetch(options?.fetch)(req, {
    ...init,
    context: init?.context || event.context,
    headers: {
      ...getProxyRequestHeaders(event, {
        host: typeof req === "string" && req.startsWith("/")
      }),
      ...init?.headers
    }
  });
}
function _getFetch(_fetch) {
  if (_fetch) {
    return _fetch;
  }
  if (globalThis.fetch) {
    return globalThis.fetch;
  }
  throw new Error(
    "fetch is not available. Try importing `node-fetch-native/polyfill` for Node.js."
  );
}
function rewriteCookieProperty(header, map, property) {
  const _map = typeof map === "string" ? { "*": map } : map;
  return header.replace(
    new RegExp(`(;\\s*${property}=)([^;]+)`, "gi"),
    (match, prefix, previousValue) => {
      let newValue;
      if (previousValue in _map) {
        newValue = _map[previousValue];
      } else if ("*" in _map) {
        newValue = _map["*"];
      } else {
        return match;
      }
      return newValue ? prefix + newValue : "";
    }
  );
}
function mergeHeaders$1(defaults, ...inputs) {
  const _inputs = inputs.filter(Boolean);
  if (_inputs.length === 0) {
    return defaults;
  }
  const merged = new Headers(defaults);
  for (const input of _inputs) {
    const entries = Array.isArray(input) ? input : typeof input.entries === "function" ? input.entries() : Object.entries(input);
    for (const [key, value] of entries) {
      if (value !== void 0) {
        merged.set(key, value);
      }
    }
  }
  return merged;
}

class H3Event {
  "__is_event__" = true;
  // Context
  node;
  // Node
  web;
  // Web
  context = {};
  // Shared
  // Request
  _method;
  _path;
  _headers;
  _requestBody;
  // Response
  _handled = false;
  // Hooks
  _onBeforeResponseCalled;
  _onAfterResponseCalled;
  constructor(req, res) {
    this.node = { req, res };
  }
  // --- Request ---
  get method() {
    if (!this._method) {
      this._method = (this.node.req.method || "GET").toUpperCase();
    }
    return this._method;
  }
  get path() {
    return this._path || this.node.req.url || "/";
  }
  get headers() {
    if (!this._headers) {
      this._headers = _normalizeNodeHeaders(this.node.req.headers);
    }
    return this._headers;
  }
  // --- Respoonse ---
  get handled() {
    return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
  }
  respondWith(response) {
    return Promise.resolve(response).then(
      (_response) => sendWebResponse(this, _response)
    );
  }
  // --- Utils ---
  toString() {
    return `[${this.method}] ${this.path}`;
  }
  toJSON() {
    return this.toString();
  }
  // --- Deprecated ---
  /** @deprecated Please use `event.node.req` instead. */
  get req() {
    return this.node.req;
  }
  /** @deprecated Please use `event.node.res` instead. */
  get res() {
    return this.node.res;
  }
}
function isEvent(input) {
  return hasProp(input, "__is_event__");
}
function createEvent(req, res) {
  return new H3Event(req, res);
}
function _normalizeNodeHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(nodeHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function defineEventHandler(handler) {
  if (typeof handler === "function") {
    handler.__is_handler__ = true;
    return handler;
  }
  const _hooks = {
    onRequest: _normalizeArray(handler.onRequest),
    onBeforeResponse: _normalizeArray(handler.onBeforeResponse)
  };
  const _handler = (event) => {
    return _callHandler(event, handler.handler, _hooks);
  };
  _handler.__is_handler__ = true;
  _handler.__resolve__ = handler.handler.__resolve__;
  _handler.__websocket__ = handler.websocket;
  return _handler;
}
function _normalizeArray(input) {
  return input ? Array.isArray(input) ? input : [input] : void 0;
}
async function _callHandler(event, handler, hooks) {
  if (hooks.onRequest) {
    for (const hook of hooks.onRequest) {
      await hook(event);
      if (event.handled) {
        return;
      }
    }
  }
  const body = await handler(event);
  const response = { body };
  if (hooks.onBeforeResponse) {
    for (const hook of hooks.onBeforeResponse) {
      await hook(event, response);
    }
  }
  return response.body;
}
const eventHandler = defineEventHandler;
function isEventHandler(input) {
  return hasProp(input, "__is_handler__");
}
function toEventHandler(input, _, _route) {
  return input;
}
function defineLazyEventHandler(factory) {
  let _promise;
  let _resolved;
  const resolveHandler = () => {
    if (_resolved) {
      return Promise.resolve(_resolved);
    }
    if (!_promise) {
      _promise = Promise.resolve(factory()).then((r) => {
        const handler2 = r.default || r;
        if (typeof handler2 !== "function") {
          throw new TypeError(
            "Invalid lazy handler result. It should be a function:",
            handler2
          );
        }
        _resolved = { handler: toEventHandler(r.default || r) };
        return _resolved;
      });
    }
    return _promise;
  };
  const handler = eventHandler((event) => {
    if (_resolved) {
      return _resolved.handler(event);
    }
    return resolveHandler().then((r) => r.handler(event));
  });
  handler.__resolve__ = resolveHandler;
  return handler;
}
const lazyEventHandler = defineLazyEventHandler;

function createApp(options = {}) {
  const stack = [];
  const handler = createAppEventHandler(stack, options);
  const resolve = createResolver(stack);
  handler.__resolve__ = resolve;
  const getWebsocket = cachedFn(() => websocketOptions(resolve, options));
  const app = {
    // @ts-expect-error
    use: (arg1, arg2, arg3) => use(app, arg1, arg2, arg3),
    resolve,
    handler,
    stack,
    options,
    get websocket() {
      return getWebsocket();
    }
  };
  return app;
}
function use(app, arg1, arg2, arg3) {
  if (Array.isArray(arg1)) {
    for (const i of arg1) {
      use(app, i, arg2, arg3);
    }
  } else if (Array.isArray(arg2)) {
    for (const i of arg2) {
      use(app, arg1, i, arg3);
    }
  } else if (typeof arg1 === "string") {
    app.stack.push(
      normalizeLayer({ ...arg3, route: arg1, handler: arg2 })
    );
  } else if (typeof arg1 === "function") {
    app.stack.push(normalizeLayer({ ...arg2, handler: arg1 }));
  } else {
    app.stack.push(normalizeLayer({ ...arg1 }));
  }
  return app;
}
function createAppEventHandler(stack, options) {
  const spacing = options.debug ? 2 : void 0;
  return eventHandler(async (event) => {
    event.node.req.originalUrl = event.node.req.originalUrl || event.node.req.url || "/";
    const _rawReqUrl = event.node.req.url || "/";
    const _reqPath = _decodePath(event._path || _rawReqUrl);
    event._path = _reqPath;
    const _needsRawUrl = _reqPath !== _rawReqUrl;
    let _layerPath;
    if (options.onRequest) {
      await options.onRequest(event);
    }
    for (const layer of stack) {
      if (layer.route.length > 1) {
        if (!_reqPath.startsWith(layer.route)) {
          continue;
        }
        _layerPath = _reqPath.slice(layer.route.length) || "/";
      } else {
        _layerPath = _reqPath;
      }
      if (layer.match && !layer.match(_layerPath, event)) {
        continue;
      }
      event._path = _layerPath;
      event.node.req.url = _needsRawUrl ? layer.route.length > 1 ? _rawReqUrl.slice(layer.route.length) || "/" : _rawReqUrl : _layerPath;
      const val = await layer.handler(event);
      const _body = val === void 0 ? void 0 : await val;
      if (_body !== void 0) {
        const _response = { body: _body };
        if (options.onBeforeResponse) {
          event._onBeforeResponseCalled = true;
          await options.onBeforeResponse(event, _response);
        }
        await handleHandlerResponse(event, _response.body, spacing);
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, _response);
        }
        return;
      }
      if (event.handled) {
        if (options.onAfterResponse) {
          event._onAfterResponseCalled = true;
          await options.onAfterResponse(event, void 0);
        }
        return;
      }
    }
    if (!event.handled) {
      throw createError$1({
        statusCode: 404,
        statusMessage: `Cannot find any path matching ${event.path || "/"}.`
      });
    }
    if (options.onAfterResponse) {
      event._onAfterResponseCalled = true;
      await options.onAfterResponse(event, void 0);
    }
  });
}
function createResolver(stack) {
  return async (path) => {
    let _layerPath;
    for (const layer of stack) {
      if (layer.route === "/" && !layer.handler.__resolve__) {
        continue;
      }
      if (!path.startsWith(layer.route)) {
        continue;
      }
      _layerPath = path.slice(layer.route.length) || "/";
      if (layer.match && !layer.match(_layerPath, void 0)) {
        continue;
      }
      let res = { route: layer.route, handler: layer.handler };
      if (res.handler.__resolve__) {
        const _res = await res.handler.__resolve__(_layerPath);
        if (!_res) {
          continue;
        }
        res = {
          ...res,
          ..._res,
          route: joinURL(res.route || "/", _res.route || "/")
        };
      }
      return res;
    }
  };
}
function normalizeLayer(input) {
  let handler = input.handler;
  if (handler.handler) {
    handler = handler.handler;
  }
  if (input.lazy) {
    handler = lazyEventHandler(handler);
  } else if (!isEventHandler(handler)) {
    handler = toEventHandler(handler, void 0, input.route);
  }
  return {
    route: withoutTrailingSlash(input.route),
    match: input.match,
    handler
  };
}
function handleHandlerResponse(event, val, jsonSpace) {
  if (val === null) {
    return sendNoContent(event);
  }
  if (val) {
    if (isWebResponse(val)) {
      return sendWebResponse(event, val);
    }
    if (isStream(val)) {
      return sendStream(event, val);
    }
    if (val.buffer) {
      return send(event, val);
    }
    if (val.arrayBuffer && typeof val.arrayBuffer === "function") {
      return val.arrayBuffer().then((arrayBuffer) => {
        return send(event, Buffer.from(arrayBuffer), val.type);
      });
    }
    if (val instanceof Error) {
      throw createError$1(val);
    }
    if (typeof val.end === "function") {
      return true;
    }
  }
  const valType = typeof val;
  if (valType === "string") {
    return send(event, val, MIMES.html);
  }
  if (valType === "object" || valType === "boolean" || valType === "number") {
    return send(event, JSON.stringify(val, void 0, jsonSpace), MIMES.json);
  }
  if (valType === "bigint") {
    return send(event, val.toString(), MIMES.json);
  }
  throw createError$1({
    statusCode: 500,
    statusMessage: `[h3] Cannot send ${valType} as response.`
  });
}
function cachedFn(fn) {
  let cache;
  return () => {
    if (!cache) {
      cache = fn();
    }
    return cache;
  };
}
function _decodePath(url) {
  const qIndex = url.indexOf("?");
  const path = qIndex === -1 ? url : url.slice(0, qIndex);
  const query = qIndex === -1 ? "" : url.slice(qIndex);
  const decodedPath = path.includes("%25") ? decodePath(path.replace(/%25/g, "%2525")) : decodePath(path);
  return decodedPath + query;
}
function websocketOptions(evResolver, appOptions) {
  return {
    ...appOptions.websocket,
    async resolve(info) {
      const url = info.request?.url || info.url || "/";
      const { pathname } = typeof url === "string" ? parseURL(url) : url;
      const resolved = await evResolver(pathname);
      return resolved?.handler?.__websocket__ || {};
    }
  };
}

const RouterMethods = [
  "connect",
  "delete",
  "get",
  "head",
  "options",
  "post",
  "put",
  "trace",
  "patch"
];
function createRouter(opts = {}) {
  const _router = createRouter$1({});
  const routes = {};
  let _matcher;
  const router = {};
  const addRoute = (path, handler, method) => {
    let route = routes[path];
    if (!route) {
      routes[path] = route = { path, handlers: {} };
      _router.insert(path, route);
    }
    if (Array.isArray(method)) {
      for (const m of method) {
        addRoute(path, handler, m);
      }
    } else {
      route.handlers[method] = toEventHandler(handler);
    }
    return router;
  };
  router.use = router.add = (path, handler, method) => addRoute(path, handler, method || "all");
  for (const method of RouterMethods) {
    router[method] = (path, handle) => router.add(path, handle, method);
  }
  const matchHandler = (path = "/", method = "get") => {
    const qIndex = path.indexOf("?");
    if (qIndex !== -1) {
      path = path.slice(0, Math.max(0, qIndex));
    }
    const matched = _router.lookup(path);
    if (!matched || !matched.handlers) {
      return {
        error: createError$1({
          statusCode: 404,
          name: "Not Found",
          statusMessage: `Cannot find any route matching ${path || "/"}.`
        })
      };
    }
    let handler = matched.handlers[method] || matched.handlers.all;
    if (!handler) {
      if (!_matcher) {
        _matcher = toRouteMatcher(_router);
      }
      const _matches = _matcher.matchAll(path).reverse();
      for (const _match of _matches) {
        if (_match.handlers[method]) {
          handler = _match.handlers[method];
          matched.handlers[method] = matched.handlers[method] || handler;
          break;
        }
        if (_match.handlers.all) {
          handler = _match.handlers.all;
          matched.handlers.all = matched.handlers.all || handler;
          break;
        }
      }
    }
    if (!handler) {
      return {
        error: createError$1({
          statusCode: 405,
          name: "Method Not Allowed",
          statusMessage: `Method ${method} is not allowed on this route.`
        })
      };
    }
    return { matched, handler };
  };
  const isPreemptive = opts.preemptive || opts.preemtive;
  router.handler = eventHandler((event) => {
    const match = matchHandler(
      event.path,
      event.method.toLowerCase()
    );
    if ("error" in match) {
      if (isPreemptive) {
        throw match.error;
      } else {
        return;
      }
    }
    event.context.matchedRoute = match.matched;
    const params = match.matched.params || {};
    event.context.params = params;
    return Promise.resolve(match.handler(event)).then((res) => {
      if (res === void 0 && isPreemptive) {
        return null;
      }
      return res;
    });
  });
  router.handler.__resolve__ = async (path) => {
    path = withLeadingSlash(path);
    const match = matchHandler(path);
    if ("error" in match) {
      return;
    }
    let res = {
      route: match.matched.path,
      handler: match.handler
    };
    if (match.handler.__resolve__) {
      const _res = await match.handler.__resolve__(path);
      if (!_res) {
        return;
      }
      res = { ...res, ..._res };
    }
    return res;
  };
  return router;
}
function toNodeListener(app) {
  const toNodeHandle = async function(req, res) {
    const event = createEvent(req, res);
    try {
      await app.handler(event);
    } catch (_error) {
      const error = createError$1(_error);
      if (!isError(_error)) {
        error.unhandled = true;
      }
      setResponseStatus(event, error.statusCode, error.statusMessage);
      if (app.options.onError) {
        await app.options.onError(error, event);
      }
      if (event.handled) {
        return;
      }
      if (error.unhandled || error.fatal) {
        console.error("[h3]", error.fatal ? "[fatal]" : "[unhandled]", error);
      }
      if (app.options.onBeforeResponse && !event._onBeforeResponseCalled) {
        await app.options.onBeforeResponse(event, { body: error });
      }
      await sendError(event, error, !!app.options.debug);
      if (app.options.onAfterResponse && !event._onAfterResponseCalled) {
        await app.options.onAfterResponse(event, { body: error });
      }
    }
  };
  return toNodeHandle;
}

function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === "object" && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === "function") {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
const defaultTask = { run: (function_) => function_() };
const _createTask = () => defaultTask;
const createTask = typeof console.createTask !== "undefined" ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return hooks.reduce(
    (promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))),
    Promise.resolve()
  );
}
function parallelTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
  for (const callback of [...callbacks]) {
    callback(arg0);
  }
}

class Hookable {
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
    if (!name || typeof function_ !== "function") {
      return () => {
      };
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    if (!function_.name) {
      try {
        Object.defineProperty(function_, "name", {
          get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
          configurable: true
        });
      } catch {
      }
    }
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
      if (typeof _unreg === "function") {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    delete this._hooks[name];
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map(
      (key) => this.hook(key, hooks[key])
    );
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  removeAllHooks() {
    for (const key in this._hooks) {
      delete this._hooks[key];
    }
  }
  callHook(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(serialTaskCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(parallelTaskCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(
      name in this._hooks ? [...this._hooks[name]] : [],
      arguments_
    );
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      if (this._before !== void 0) {
        const index = this._before.indexOf(function_);
        if (index !== -1) {
          this._before.splice(index, 1);
        }
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      if (this._after !== void 0) {
        const index = this._after.indexOf(function_);
        if (index !== -1) {
          this._after.splice(index, 1);
        }
      }
    };
  }
}
function createHooks() {
  return new Hookable();
}

const s=globalThis.Headers,i$1=globalThis.AbortController,l$1=globalThis.fetch||(()=>{throw new Error("[node-fetch-native] Failed to fetch: `globalThis.fetch` is not available!")});

class FetchError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "FetchError";
    if (opts?.cause && !this.cause) {
      this.cause = opts.cause;
    }
  }
}
function createFetchError(ctx) {
  const errorMessage = ctx.error?.message || ctx.error?.toString() || "";
  const method = ctx.request?.method || ctx.options?.method || "GET";
  const url = ctx.request?.url || String(ctx.request) || "/";
  const requestStr = `[${method}] ${JSON.stringify(url)}`;
  const statusStr = ctx.response ? `${ctx.response.status} ${ctx.response.statusText}` : "<no response>";
  const message = `${requestStr}: ${statusStr}${errorMessage ? ` ${errorMessage}` : ""}`;
  const fetchError = new FetchError(
    message,
    ctx.error ? { cause: ctx.error } : void 0
  );
  for (const key of ["request", "options", "response"]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx[key];
      }
    });
  }
  for (const [key, refKey] of [
    ["data", "_data"],
    ["status", "status"],
    ["statusCode", "status"],
    ["statusText", "statusText"],
    ["statusMessage", "statusText"]
  ]) {
    Object.defineProperty(fetchError, key, {
      get() {
        return ctx.response && ctx.response[refKey];
      }
    });
  }
  return fetchError;
}

const payloadMethods = new Set(
  Object.freeze(["PATCH", "POST", "PUT", "DELETE"])
);
function isPayloadMethod(method = "GET") {
  return payloadMethods.has(method.toUpperCase());
}
function isJSONSerializable(value) {
  if (value === void 0) {
    return false;
  }
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === null) {
    return true;
  }
  if (t !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return true;
  }
  if (value.buffer) {
    return false;
  }
  if (value instanceof FormData || value instanceof URLSearchParams) {
    return false;
  }
  return value.constructor && value.constructor.name === "Object" || typeof value.toJSON === "function";
}
const textTypes = /* @__PURE__ */ new Set([
  "image/svg",
  "application/xml",
  "application/xhtml",
  "application/html"
]);
const JSON_RE = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function detectResponseType(_contentType = "") {
  if (!_contentType) {
    return "json";
  }
  const contentType = _contentType.split(";").shift() || "";
  if (JSON_RE.test(contentType)) {
    return "json";
  }
  if (contentType === "text/event-stream") {
    return "stream";
  }
  if (textTypes.has(contentType) || contentType.startsWith("text/")) {
    return "text";
  }
  return "blob";
}
function resolveFetchOptions(request, input, defaults, Headers) {
  const headers = mergeHeaders(
    input?.headers ?? request?.headers,
    defaults?.headers,
    Headers
  );
  let query;
  if (defaults?.query || defaults?.params || input?.params || input?.query) {
    query = {
      ...defaults?.params,
      ...defaults?.query,
      ...input?.params,
      ...input?.query
    };
  }
  return {
    ...defaults,
    ...input,
    query,
    params: query,
    headers
  };
}
function mergeHeaders(input, defaults, Headers) {
  if (!defaults) {
    return new Headers(input);
  }
  const headers = new Headers(defaults);
  if (input) {
    for (const [key, value] of Symbol.iterator in input || Array.isArray(input) ? input : new Headers(input)) {
      headers.set(key, value);
    }
  }
  return headers;
}
async function callHooks(context, hooks) {
  if (hooks) {
    if (Array.isArray(hooks)) {
      for (const hook of hooks) {
        await hook(context);
      }
    } else {
      await hooks(context);
    }
  }
}

const retryStatusCodes = /* @__PURE__ */ new Set([
  408,
  // Request Timeout
  409,
  // Conflict
  425,
  // Too Early (Experimental)
  429,
  // Too Many Requests
  500,
  // Internal Server Error
  502,
  // Bad Gateway
  503,
  // Service Unavailable
  504
  // Gateway Timeout
]);
const nullBodyResponses = /* @__PURE__ */ new Set([101, 204, 205, 304]);
function createFetch(globalOptions = {}) {
  const {
    fetch = globalThis.fetch,
    Headers = globalThis.Headers,
    AbortController = globalThis.AbortController
  } = globalOptions;
  async function onError(context) {
    const isAbort = context.error && context.error.name === "AbortError" && !context.options.timeout || false;
    if (context.options.retry !== false && !isAbort) {
      let retries;
      if (typeof context.options.retry === "number") {
        retries = context.options.retry;
      } else {
        retries = isPayloadMethod(context.options.method) ? 0 : 1;
      }
      const responseCode = context.response && context.response.status || 500;
      if (retries > 0 && (Array.isArray(context.options.retryStatusCodes) ? context.options.retryStatusCodes.includes(responseCode) : retryStatusCodes.has(responseCode))) {
        const retryDelay = typeof context.options.retryDelay === "function" ? context.options.retryDelay(context) : context.options.retryDelay || 0;
        if (retryDelay > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
        return $fetchRaw(context.request, {
          ...context.options,
          retry: retries - 1
        });
      }
    }
    const error = createFetchError(context);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, $fetchRaw);
    }
    throw error;
  }
  const $fetchRaw = async function $fetchRaw2(_request, _options = {}) {
    const context = {
      request: _request,
      options: resolveFetchOptions(
        _request,
        _options,
        globalOptions.defaults,
        Headers
      ),
      response: void 0,
      error: void 0
    };
    if (context.options.method) {
      context.options.method = context.options.method.toUpperCase();
    }
    if (context.options.onRequest) {
      await callHooks(context, context.options.onRequest);
      if (!(context.options.headers instanceof Headers)) {
        context.options.headers = new Headers(
          context.options.headers || {}
          /* compat */
        );
      }
    }
    if (typeof context.request === "string") {
      if (context.options.baseURL) {
        context.request = withBase(context.request, context.options.baseURL);
      }
      if (context.options.query) {
        context.request = withQuery(context.request, context.options.query);
        delete context.options.query;
      }
      if ("query" in context.options) {
        delete context.options.query;
      }
      if ("params" in context.options) {
        delete context.options.params;
      }
    }
    if (context.options.body && isPayloadMethod(context.options.method)) {
      if (isJSONSerializable(context.options.body)) {
        const contentType = context.options.headers.get("content-type");
        if (typeof context.options.body !== "string") {
          context.options.body = contentType === "application/x-www-form-urlencoded" ? new URLSearchParams(
            context.options.body
          ).toString() : JSON.stringify(context.options.body);
        }
        if (!contentType) {
          context.options.headers.set("content-type", "application/json");
        }
        if (!context.options.headers.has("accept")) {
          context.options.headers.set("accept", "application/json");
        }
      } else if (
        // ReadableStream Body
        "pipeTo" in context.options.body && typeof context.options.body.pipeTo === "function" || // Node.js Stream Body
        typeof context.options.body.pipe === "function"
      ) {
        if (!("duplex" in context.options)) {
          context.options.duplex = "half";
        }
      }
    }
    let abortTimeout;
    if (!context.options.signal && context.options.timeout) {
      const controller = new AbortController();
      abortTimeout = setTimeout(() => {
        const error = new Error(
          "[TimeoutError]: The operation was aborted due to timeout"
        );
        error.name = "TimeoutError";
        error.code = 23;
        controller.abort(error);
      }, context.options.timeout);
      context.options.signal = controller.signal;
    }
    try {
      context.response = await fetch(
        context.request,
        context.options
      );
    } catch (error) {
      context.error = error;
      if (context.options.onRequestError) {
        await callHooks(
          context,
          context.options.onRequestError
        );
      }
      return await onError(context);
    } finally {
      if (abortTimeout) {
        clearTimeout(abortTimeout);
      }
    }
    const hasBody = (context.response.body || // https://github.com/unjs/ofetch/issues/324
    // https://github.com/unjs/ofetch/issues/294
    // https://github.com/JakeChampion/fetch/issues/1454
    context.response._bodyInit) && !nullBodyResponses.has(context.response.status) && context.options.method !== "HEAD";
    if (hasBody) {
      const responseType = (context.options.parseResponse ? "json" : context.options.responseType) || detectResponseType(context.response.headers.get("content-type") || "");
      switch (responseType) {
        case "json": {
          const data = await context.response.text();
          const parseFunction = context.options.parseResponse || destr;
          context.response._data = parseFunction(data);
          break;
        }
        case "stream": {
          context.response._data = context.response.body || context.response._bodyInit;
          break;
        }
        default: {
          context.response._data = await context.response[responseType]();
        }
      }
    }
    if (context.options.onResponse) {
      await callHooks(
        context,
        context.options.onResponse
      );
    }
    if (!context.options.ignoreResponseError && context.response.status >= 400 && context.response.status < 600) {
      if (context.options.onResponseError) {
        await callHooks(
          context,
          context.options.onResponseError
        );
      }
      return await onError(context);
    }
    return context.response;
  };
  const $fetch = async function $fetch2(request, options) {
    const r = await $fetchRaw(request, options);
    return r._data;
  };
  $fetch.raw = $fetchRaw;
  $fetch.native = (...args) => fetch(...args);
  $fetch.create = (defaultOptions = {}, customGlobalOptions = {}) => createFetch({
    ...globalOptions,
    ...customGlobalOptions,
    defaults: {
      ...globalOptions.defaults,
      ...customGlobalOptions.defaults,
      ...defaultOptions
    }
  });
  return $fetch;
}

function createNodeFetch() {
  const useKeepAlive = JSON.parse(process.env.FETCH_KEEP_ALIVE || "false");
  if (!useKeepAlive) {
    return l$1;
  }
  const agentOptions = { keepAlive: true };
  const httpAgent = new http.Agent(agentOptions);
  const httpsAgent = new https.Agent(agentOptions);
  const nodeFetchOptions = {
    agent(parsedURL) {
      return parsedURL.protocol === "http:" ? httpAgent : httpsAgent;
    }
  };
  return function nodeFetchWithKeepAlive(input, init) {
    return l$1(input, { ...nodeFetchOptions, ...init });
  };
}
const fetch = globalThis.fetch ? (...args) => globalThis.fetch(...args) : createNodeFetch();
const Headers$1 = globalThis.Headers || s;
const AbortController$1 = globalThis.AbortController || i$1;
const ofetch = createFetch({ fetch, Headers: Headers$1, AbortController: AbortController$1 });
const $fetch = ofetch;

function wrapToPromise(value) {
  if (!value || typeof value.then !== "function") {
    return Promise.resolve(value);
  }
  return value;
}
function asyncCall(function_, ...arguments_) {
  try {
    return wrapToPromise(function_(...arguments_));
  } catch (error) {
    return Promise.reject(error);
  }
}
function isPrimitive$1(value) {
  const type = typeof value;
  return value === null || type !== "object" && type !== "function";
}
function isPureObject(value) {
  const proto = Object.getPrototypeOf(value);
  return !proto || proto.isPrototypeOf(Object);
}
function stringify(value) {
  if (isPrimitive$1(value)) {
    return String(value);
  }
  if (isPureObject(value) || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value.toJSON === "function") {
    return stringify(value.toJSON());
  }
  throw new Error("[unstorage] Cannot stringify value!");
}
const BASE64_PREFIX = "base64:";
function serializeRaw(value) {
  if (typeof value === "string") {
    return value;
  }
  return BASE64_PREFIX + base64Encode(value);
}
function deserializeRaw(value) {
  if (typeof value !== "string") {
    return value;
  }
  if (!value.startsWith(BASE64_PREFIX)) {
    return value;
  }
  return base64Decode(value.slice(BASE64_PREFIX.length));
}
function base64Decode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input, "base64");
  }
  return Uint8Array.from(
    globalThis.atob(input),
    (c) => c.codePointAt(0)
  );
}
function base64Encode(input) {
  if (globalThis.Buffer) {
    return Buffer.from(input).toString("base64");
  }
  return globalThis.btoa(String.fromCodePoint(...input));
}

const storageKeyProperties = [
  "has",
  "hasItem",
  "get",
  "getItem",
  "getItemRaw",
  "set",
  "setItem",
  "setItemRaw",
  "del",
  "remove",
  "removeItem",
  "getMeta",
  "setMeta",
  "removeMeta",
  "getKeys",
  "clear",
  "mount",
  "unmount"
];
function prefixStorage(storage, base) {
  base = normalizeBaseKey(base);
  if (!base) {
    return storage;
  }
  const nsStorage = { ...storage };
  for (const property of storageKeyProperties) {
    nsStorage[property] = (key = "", ...args) => (
      // @ts-ignore
      storage[property](base + key, ...args)
    );
  }
  nsStorage.getKeys = (key = "", ...arguments_) => storage.getKeys(base + key, ...arguments_).then((keys) => keys.map((key2) => key2.slice(base.length)));
  nsStorage.keys = nsStorage.getKeys;
  nsStorage.getItems = async (items, commonOptions) => {
    const prefixedItems = items.map(
      (item) => typeof item === "string" ? base + item : { ...item, key: base + item.key }
    );
    const results = await storage.getItems(prefixedItems, commonOptions);
    return results.map((entry) => ({
      key: entry.key.slice(base.length),
      value: entry.value
    }));
  };
  nsStorage.setItems = async (items, commonOptions) => {
    const prefixedItems = items.map((item) => ({
      key: base + item.key,
      value: item.value,
      options: item.options
    }));
    return storage.setItems(prefixedItems, commonOptions);
  };
  return nsStorage;
}
function normalizeKey$1(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
}
function joinKeys(...keys) {
  return normalizeKey$1(keys.join(":"));
}
function normalizeBaseKey(base) {
  base = normalizeKey$1(base);
  return base ? base + ":" : "";
}
function filterKeyByDepth(key, depth) {
  if (depth === void 0) {
    return true;
  }
  let substrCount = 0;
  let index = key.indexOf(":");
  while (index > -1) {
    substrCount++;
    index = key.indexOf(":", index + 1);
  }
  return substrCount <= depth;
}
function filterKeyByBase(key, base) {
  if (base) {
    return key.startsWith(base) && key[key.length - 1] !== "$";
  }
  return key[key.length - 1] !== "$";
}

function defineDriver$1(factory) {
  return factory;
}

const DRIVER_NAME$2 = "memory";
const memory = defineDriver$1(() => {
  const data = /* @__PURE__ */ new Map();
  return {
    name: DRIVER_NAME$2,
    getInstance: () => data,
    hasItem(key) {
      return data.has(key);
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    getItemRaw(key) {
      return data.get(key) ?? null;
    },
    setItem(key, value) {
      data.set(key, value);
    },
    setItemRaw(key, value) {
      data.set(key, value);
    },
    removeItem(key) {
      data.delete(key);
    },
    getKeys() {
      return [...data.keys()];
    },
    clear() {
      data.clear();
    },
    dispose() {
      data.clear();
    }
  };
});

function createStorage(options = {}) {
  const context = {
    mounts: { "": options.driver || memory() },
    mountpoints: [""],
    watching: false,
    watchListeners: [],
    unwatch: {}
  };
  const getMount = (key) => {
    for (const base of context.mountpoints) {
      if (key.startsWith(base)) {
        return {
          base,
          relativeKey: key.slice(base.length),
          driver: context.mounts[base]
        };
      }
    }
    return {
      base: "",
      relativeKey: key,
      driver: context.mounts[""]
    };
  };
  const getMounts = (base, includeParent) => {
    return context.mountpoints.filter(
      (mountpoint) => mountpoint.startsWith(base) || includeParent && base.startsWith(mountpoint)
    ).map((mountpoint) => ({
      relativeBase: base.length > mountpoint.length ? base.slice(mountpoint.length) : void 0,
      mountpoint,
      driver: context.mounts[mountpoint]
    }));
  };
  const onChange = (event, key) => {
    if (!context.watching) {
      return;
    }
    key = normalizeKey$1(key);
    for (const listener of context.watchListeners) {
      listener(event, key);
    }
  };
  const startWatch = async () => {
    if (context.watching) {
      return;
    }
    context.watching = true;
    for (const mountpoint in context.mounts) {
      context.unwatch[mountpoint] = await watch(
        context.mounts[mountpoint],
        onChange,
        mountpoint
      );
    }
  };
  const stopWatch = async () => {
    if (!context.watching) {
      return;
    }
    for (const mountpoint in context.unwatch) {
      await context.unwatch[mountpoint]();
    }
    context.unwatch = {};
    context.watching = false;
  };
  const runBatch = (items, commonOptions, cb) => {
    const batches = /* @__PURE__ */ new Map();
    const getBatch = (mount) => {
      let batch = batches.get(mount.base);
      if (!batch) {
        batch = {
          driver: mount.driver,
          base: mount.base,
          items: []
        };
        batches.set(mount.base, batch);
      }
      return batch;
    };
    for (const item of items) {
      const isStringItem = typeof item === "string";
      const key = normalizeKey$1(isStringItem ? item : item.key);
      const value = isStringItem ? void 0 : item.value;
      const options2 = isStringItem || !item.options ? commonOptions : { ...commonOptions, ...item.options };
      const mount = getMount(key);
      getBatch(mount).items.push({
        key,
        value,
        relativeKey: mount.relativeKey,
        options: options2
      });
    }
    return Promise.all([...batches.values()].map((batch) => cb(batch))).then(
      (r) => r.flat()
    );
  };
  const storage = {
    // Item
    hasItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.hasItem, relativeKey, opts);
    },
    getItem(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => destr(value)
      );
    },
    getItems(items, commonOptions = {}) {
      return runBatch(items, commonOptions, (batch) => {
        if (batch.driver.getItems) {
          return asyncCall(
            batch.driver.getItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              options: item.options
            })),
            commonOptions
          ).then(
            (r) => r.map((item) => ({
              key: joinKeys(batch.base, item.key),
              value: destr(item.value)
            }))
          );
        }
        return Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.getItem,
              item.relativeKey,
              item.options
            ).then((value) => ({
              key: item.key,
              value: destr(value)
            }));
          })
        );
      });
    },
    getItemRaw(key, opts = {}) {
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.getItemRaw) {
        return asyncCall(driver.getItemRaw, relativeKey, opts);
      }
      return asyncCall(driver.getItem, relativeKey, opts).then(
        (value) => deserializeRaw(value)
      );
    },
    async setItem(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.setItem) {
        return;
      }
      await asyncCall(driver.setItem, relativeKey, stringify(value), opts);
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async setItems(items, commonOptions) {
      await runBatch(items, commonOptions, async (batch) => {
        if (batch.driver.setItems) {
          return asyncCall(
            batch.driver.setItems,
            batch.items.map((item) => ({
              key: item.relativeKey,
              value: stringify(item.value),
              options: item.options
            })),
            commonOptions
          );
        }
        if (!batch.driver.setItem) {
          return;
        }
        await Promise.all(
          batch.items.map((item) => {
            return asyncCall(
              batch.driver.setItem,
              item.relativeKey,
              stringify(item.value),
              item.options
            );
          })
        );
      });
    },
    async setItemRaw(key, value, opts = {}) {
      if (value === void 0) {
        return storage.removeItem(key, opts);
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (driver.setItemRaw) {
        await asyncCall(driver.setItemRaw, relativeKey, value, opts);
      } else if (driver.setItem) {
        await asyncCall(driver.setItem, relativeKey, serializeRaw(value), opts);
      } else {
        return;
      }
      if (!driver.watch) {
        onChange("update", key);
      }
    },
    async removeItem(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { removeMeta: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      if (!driver.removeItem) {
        return;
      }
      await asyncCall(driver.removeItem, relativeKey, opts);
      if (opts.removeMeta || opts.removeMata) {
        await asyncCall(driver.removeItem, relativeKey + "$", opts);
      }
      if (!driver.watch) {
        onChange("remove", key);
      }
    },
    // Meta
    async getMeta(key, opts = {}) {
      if (typeof opts === "boolean") {
        opts = { nativeOnly: opts };
      }
      key = normalizeKey$1(key);
      const { relativeKey, driver } = getMount(key);
      const meta = /* @__PURE__ */ Object.create(null);
      if (driver.getMeta) {
        Object.assign(meta, await asyncCall(driver.getMeta, relativeKey, opts));
      }
      if (!opts.nativeOnly) {
        const value = await asyncCall(
          driver.getItem,
          relativeKey + "$",
          opts
        ).then((value_) => destr(value_));
        if (value && typeof value === "object") {
          if (typeof value.atime === "string") {
            value.atime = new Date(value.atime);
          }
          if (typeof value.mtime === "string") {
            value.mtime = new Date(value.mtime);
          }
          Object.assign(meta, value);
        }
      }
      return meta;
    },
    setMeta(key, value, opts = {}) {
      return this.setItem(key + "$", value, opts);
    },
    removeMeta(key, opts = {}) {
      return this.removeItem(key + "$", opts);
    },
    // Keys
    async getKeys(base, opts = {}) {
      base = normalizeBaseKey(base);
      const mounts = getMounts(base, true);
      let maskedMounts = [];
      const allKeys = [];
      let allMountsSupportMaxDepth = true;
      for (const mount of mounts) {
        if (!mount.driver.flags?.maxDepth) {
          allMountsSupportMaxDepth = false;
        }
        const rawKeys = await asyncCall(
          mount.driver.getKeys,
          mount.relativeBase,
          opts
        );
        for (const key of rawKeys) {
          const fullKey = mount.mountpoint + normalizeKey$1(key);
          if (!maskedMounts.some((p) => fullKey.startsWith(p))) {
            allKeys.push(fullKey);
          }
        }
        maskedMounts = [
          mount.mountpoint,
          ...maskedMounts.filter((p) => !p.startsWith(mount.mountpoint))
        ];
      }
      const shouldFilterByDepth = opts.maxDepth !== void 0 && !allMountsSupportMaxDepth;
      return allKeys.filter(
        (key) => (!shouldFilterByDepth || filterKeyByDepth(key, opts.maxDepth)) && filterKeyByBase(key, base)
      );
    },
    // Utils
    async clear(base, opts = {}) {
      base = normalizeBaseKey(base);
      await Promise.all(
        getMounts(base, false).map(async (m) => {
          if (m.driver.clear) {
            return asyncCall(m.driver.clear, m.relativeBase, opts);
          }
          if (m.driver.removeItem) {
            const keys = await m.driver.getKeys(m.relativeBase || "", opts);
            return Promise.all(
              keys.map((key) => m.driver.removeItem(key, opts))
            );
          }
        })
      );
    },
    async dispose() {
      await Promise.all(
        Object.values(context.mounts).map((driver) => dispose(driver))
      );
    },
    async watch(callback) {
      await startWatch();
      context.watchListeners.push(callback);
      return async () => {
        context.watchListeners = context.watchListeners.filter(
          (listener) => listener !== callback
        );
        if (context.watchListeners.length === 0) {
          await stopWatch();
        }
      };
    },
    async unwatch() {
      context.watchListeners = [];
      await stopWatch();
    },
    // Mount
    mount(base, driver) {
      base = normalizeBaseKey(base);
      if (base && context.mounts[base]) {
        throw new Error(`already mounted at ${base}`);
      }
      if (base) {
        context.mountpoints.push(base);
        context.mountpoints.sort((a, b) => b.length - a.length);
      }
      context.mounts[base] = driver;
      if (context.watching) {
        Promise.resolve(watch(driver, onChange, base)).then((unwatcher) => {
          context.unwatch[base] = unwatcher;
        }).catch(console.error);
      }
      return storage;
    },
    async unmount(base, _dispose = true) {
      base = normalizeBaseKey(base);
      if (!base || !context.mounts[base]) {
        return;
      }
      if (context.watching && base in context.unwatch) {
        context.unwatch[base]?.();
        delete context.unwatch[base];
      }
      if (_dispose) {
        await dispose(context.mounts[base]);
      }
      context.mountpoints = context.mountpoints.filter((key) => key !== base);
      delete context.mounts[base];
    },
    getMount(key = "") {
      key = normalizeKey$1(key) + ":";
      const m = getMount(key);
      return {
        driver: m.driver,
        base: m.base
      };
    },
    getMounts(base = "", opts = {}) {
      base = normalizeKey$1(base);
      const mounts = getMounts(base, opts.parents);
      return mounts.map((m) => ({
        driver: m.driver,
        base: m.mountpoint
      }));
    },
    // Aliases
    keys: (base, opts = {}) => storage.getKeys(base, opts),
    get: (key, opts = {}) => storage.getItem(key, opts),
    set: (key, value, opts = {}) => storage.setItem(key, value, opts),
    has: (key, opts = {}) => storage.hasItem(key, opts),
    del: (key, opts = {}) => storage.removeItem(key, opts),
    remove: (key, opts = {}) => storage.removeItem(key, opts)
  };
  return storage;
}
function watch(driver, onChange, base) {
  return driver.watch ? driver.watch((event, key) => onChange(event, base + key)) : () => {
  };
}
async function dispose(driver) {
  if (typeof driver.dispose === "function") {
    await asyncCall(driver.dispose);
  }
}

const _assets = {
  ["server:players.json"]: {
    import: () => import('../raw/players.mjs').then(r => r.default || r),
    meta: {"type":"application/json","etag":"\"259fc-hdii773m3MOMcpUlt/SHEyEs+gc\"","mtime":"2026-09-23T10:03:55.481Z"}
  }
};

const normalizeKey = function normalizeKey(key) {
  if (!key) {
    return "";
  }
  return key.split("?")[0]?.replace(/[/\\]/g, ":").replace(/:+/g, ":").replace(/^:|:$/g, "") || "";
};

const assets = {
  getKeys() {
    return Promise.resolve(Object.keys(_assets))
  },
  hasItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(id in _assets)
  },
  getItem (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].import() : null)
  },
  getMeta (id) {
    id = normalizeKey(id);
    return Promise.resolve(_assets[id] ? _assets[id].meta : {})
  }
};

function defineDriver(factory) {
  return factory;
}
function createError(driver, message, opts) {
  const err = new Error(`[unstorage] [${driver}] ${message}`, opts);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(err, createError);
  }
  return err;
}
function createRequiredError(driver, name) {
  if (Array.isArray(name)) {
    return createError(
      driver,
      `Missing some of the required options ${name.map((n) => "`" + n + "`").join(", ")}`
    );
  }
  return createError(driver, `Missing required option \`${name}\`.`);
}

const DRIVER_NAME$1 = "lru-cache";
const unstorage_47drivers_47lru_45cache = defineDriver((opts = {}) => {
  const cache = new LRUCache({
    max: 1e3,
    sizeCalculation: opts.maxSize || opts.maxEntrySize ? (value, key) => {
      return key.length + byteLength(value);
    } : void 0,
    ...opts
  });
  return {
    name: DRIVER_NAME$1,
    options: opts,
    getInstance: () => cache,
    hasItem(key) {
      return cache.has(key);
    },
    getItem(key) {
      return cache.get(key) ?? null;
    },
    getItemRaw(key) {
      return cache.get(key) ?? null;
    },
    setItem(key, value) {
      cache.set(key, value);
    },
    setItemRaw(key, value) {
      cache.set(key, value);
    },
    removeItem(key) {
      cache.delete(key);
    },
    getKeys() {
      return [...cache.keys()];
    },
    clear() {
      cache.clear();
    },
    dispose() {
      cache.clear();
    }
  };
});
function byteLength(value) {
  if (typeof Buffer !== "undefined") {
    try {
      return Buffer.byteLength(value);
    } catch {
    }
  }
  try {
    return typeof value === "string" ? value.length : JSON.stringify(value).length;
  } catch {
  }
  return 0;
}

function ignoreNotfound(err) {
  return err.code === "ENOENT" || err.code === "EISDIR" ? null : err;
}
function ignoreExists(err) {
  return err.code === "EEXIST" ? null : err;
}
async function writeFile(path, data, encoding) {
  await ensuredir(dirname(path));
  return promises.writeFile(path, data, encoding);
}
function readFile(path, encoding) {
  return promises.readFile(path, encoding).catch(ignoreNotfound);
}
function unlink(path) {
  return promises.unlink(path).catch(ignoreNotfound);
}
function readdir(dir) {
  return promises.readdir(dir, { withFileTypes: true }).catch(ignoreNotfound).then((r) => r || []);
}
async function ensuredir(dir) {
  if (existsSync(dir)) {
    return;
  }
  await ensuredir(dirname(dir)).catch(ignoreExists);
  await promises.mkdir(dir).catch(ignoreExists);
}
async function readdirRecursive(dir, ignore, maxDepth) {
  if (ignore && ignore(dir)) {
    return [];
  }
  const entries = await readdir(dir);
  const files = [];
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        if (maxDepth === void 0 || maxDepth > 0) {
          const dirFiles = await readdirRecursive(
            entryPath,
            ignore,
            maxDepth === void 0 ? void 0 : maxDepth - 1
          );
          files.push(...dirFiles.map((f) => entry.name + "/" + f));
        }
      } else {
        if (!(ignore && ignore(entry.name))) {
          files.push(entry.name);
        }
      }
    })
  );
  return files;
}
async function rmRecursive(dir) {
  const entries = await readdir(dir);
  await Promise.all(
    entries.map((entry) => {
      const entryPath = resolve$1(dir, entry.name);
      if (entry.isDirectory()) {
        return rmRecursive(entryPath).then(() => promises.rmdir(entryPath));
      } else {
        return promises.unlink(entryPath);
      }
    })
  );
}

const PATH_TRAVERSE_RE = /\.\.:|\.\.$/;
const DRIVER_NAME = "fs-lite";
const unstorage_47drivers_47fs_45lite = defineDriver((opts = {}) => {
  if (!opts.base) {
    throw createRequiredError(DRIVER_NAME, "base");
  }
  opts.base = resolve$1(opts.base);
  const r = (key) => {
    if (PATH_TRAVERSE_RE.test(key)) {
      throw createError(
        DRIVER_NAME,
        `Invalid key: ${JSON.stringify(key)}. It should not contain .. segments`
      );
    }
    const resolved = join(opts.base, key.replace(/:/g, "/"));
    return resolved;
  };
  return {
    name: DRIVER_NAME,
    options: opts,
    flags: {
      maxDepth: true
    },
    hasItem(key) {
      return existsSync(r(key));
    },
    getItem(key) {
      return readFile(r(key), "utf8");
    },
    getItemRaw(key) {
      return readFile(r(key));
    },
    async getMeta(key) {
      const { atime, mtime, size, birthtime, ctime } = await promises.stat(r(key)).catch(() => ({}));
      return { atime, mtime, size, birthtime, ctime };
    },
    setItem(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value, "utf8");
    },
    setItemRaw(key, value) {
      if (opts.readOnly) {
        return;
      }
      return writeFile(r(key), value);
    },
    removeItem(key) {
      if (opts.readOnly) {
        return;
      }
      return unlink(r(key));
    },
    getKeys(_base, topts) {
      return readdirRecursive(r("."), opts.ignore, topts?.maxDepth);
    },
    async clear() {
      if (opts.readOnly || opts.noClear) {
        return;
      }
      await rmRecursive(r("."));
    }
  };
});

const storage$1 = createStorage({});

storage$1.mount('/assets', assets);

storage$1.mount('#rate-limiter-storage', unstorage_47drivers_47lru_45cache({"driver":"lruCache"}));
storage$1.mount('data', unstorage_47drivers_47fs_45lite({"driver":"fsLite","base":"./.data/kv"}));

function useStorage(base = "") {
  return base ? prefixStorage(storage$1, base) : storage$1;
}

const fastHash = /*@__PURE__*/ (() => globalThis.process?.getBuiltinModule?.("crypto")?.hash)();
const algorithm = "sha256";
const encoding = "base64url";
function digest(data) {
	if (fastHash) return fastHash(algorithm, data, encoding);
	const h = createHash(algorithm).update(data);
	return globalThis.process?.versions?.webcontainer ? h.digest().toString(encoding) : h.digest(encoding);
}

const Hasher = /* @__PURE__ */ (() => {
  class Hasher2 {
    buff = "";
    #context = /* @__PURE__ */ new Map();
    write(str) {
      this.buff += str;
    }
    dispatch(value) {
      const type = value === null ? "null" : typeof value;
      return this[type](value);
    }
    object(object) {
      if (object && typeof object.toJSON === "function") {
        return this.object(object.toJSON());
      }
      const objString = Object.prototype.toString.call(object);
      let objType = "";
      const objectLength = objString.length;
      objType = objectLength < 10 ? "unknown:[" + objString + "]" : objString.slice(8, objectLength - 1);
      objType = objType.toLowerCase();
      let objectNumber = null;
      if ((objectNumber = this.#context.get(object)) === void 0) {
        this.#context.set(object, this.#context.size);
      } else {
        return this.dispatch("[CIRCULAR:" + objectNumber + "]");
      }
      if (typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(object)) {
        this.write("buffer:");
        return this.write(object.toString("utf8"));
      }
      if (objType !== "object" && objType !== "function" && objType !== "asyncfunction") {
        if (this[objType]) {
          this[objType](object);
        } else {
          this.unknown(object, objType);
        }
      } else {
        const keys = Object.keys(object).sort();
        const extraKeys = [];
        this.write("object:" + (keys.length + extraKeys.length) + ":");
        const dispatchForKey = (key) => {
          this.dispatch(key);
          this.write(":");
          this.dispatch(object[key]);
          this.write(",");
        };
        for (const key of keys) {
          dispatchForKey(key);
        }
        for (const key of extraKeys) {
          dispatchForKey(key);
        }
      }
    }
    array(arr, unordered) {
      unordered = unordered === void 0 ? false : unordered;
      this.write("array:" + arr.length + ":");
      if (!unordered || arr.length <= 1) {
        for (const entry of arr) {
          this.dispatch(entry);
        }
        return;
      }
      const contextAdditions = /* @__PURE__ */ new Map();
      const entries = arr.map((entry) => {
        const hasher = new Hasher2();
        hasher.dispatch(entry);
        for (const [key, value] of hasher.#context) {
          contextAdditions.set(key, value);
        }
        return hasher.toString();
      });
      this.#context = contextAdditions;
      entries.sort();
      return this.array(entries, false);
    }
    date(date) {
      return this.write("date:" + date.toJSON());
    }
    symbol(sym) {
      return this.write("symbol:" + sym.toString());
    }
    unknown(value, type) {
      this.write(type);
      if (!value) {
        return;
      }
      this.write(":");
      if (value && typeof value.entries === "function") {
        return this.array(
          [...value.entries()],
          true
          /* ordered */
        );
      }
    }
    error(err) {
      return this.write("error:" + err.toString());
    }
    boolean(bool) {
      return this.write("bool:" + bool);
    }
    string(string) {
      this.write("string:" + string.length + ":");
      this.write(string);
    }
    function(fn) {
      this.write("fn:");
      if (isNativeFunction(fn)) {
        this.dispatch("[native]");
      } else {
        this.dispatch(fn.toString());
      }
    }
    number(number) {
      return this.write("number:" + number);
    }
    null() {
      return this.write("Null");
    }
    undefined() {
      return this.write("Undefined");
    }
    regexp(regex) {
      return this.write("regex:" + regex.toString());
    }
    arraybuffer(arr) {
      this.write("arraybuffer:");
      return this.dispatch(new Uint8Array(arr));
    }
    url(url) {
      return this.write("url:" + url.toString());
    }
    map(map) {
      this.write("map:");
      const arr = [...map];
      return this.array(arr, false);
    }
    set(set) {
      this.write("set:");
      const arr = [...set];
      return this.array(arr, false);
    }
    bigint(number) {
      return this.write("bigint:" + number.toString());
    }
  }
  for (const type of [
    "uint8array",
    "uint8clampedarray",
    "unt8array",
    "uint16array",
    "unt16array",
    "uint32array",
    "unt32array",
    "float32array",
    "float64array"
  ]) {
    Hasher2.prototype[type] = function(arr) {
      this.write(type + ":");
      return this.array([...arr], false);
    };
  }
  function isNativeFunction(f) {
    if (typeof f !== "function") {
      return false;
    }
    return Function.prototype.toString.call(f).slice(
      -15
      /* "[native code] }".length */
    ) === "[native code] }";
  }
  return Hasher2;
})();
function serialize(object) {
  const hasher = new Hasher();
  hasher.dispatch(object);
  return hasher.buff;
}
function hash(value) {
  return digest(typeof value === "string" ? value : serialize(value)).replace(/[-_]/g, "").slice(0, 10);
}

function defaultCacheOptions() {
  return {
    name: "_",
    base: "/cache",
    swr: true,
    maxAge: 1
  };
}
function defineCachedFunction(fn, opts = {}) {
  opts = { ...defaultCacheOptions(), ...opts };
  const pending = {};
  const group = opts.group || "nitro/functions";
  const name = opts.name || fn.name || "_";
  const integrity = opts.integrity || hash([fn, opts]);
  const validate = opts.validate || ((entry) => entry.value !== void 0);
  async function get(key, resolver, shouldInvalidateCache, event) {
    const cacheKey = [opts.base, group, name, key + ".json"].filter(Boolean).join(":").replace(/:\/$/, ":index");
    let entry = await useStorage().getItem(cacheKey).catch((error) => {
      console.error(`[cache] Cache read error.`, error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }) || {};
    if (typeof entry !== "object") {
      entry = {};
      const error = new Error("Malformed data read from cache.");
      console.error("[cache]", error);
      useNitroApp().captureError(error, { event, tags: ["cache"] });
    }
    const ttl = (opts.maxAge ?? 0) * 1e3;
    if (ttl) {
      entry.expires = Date.now() + ttl;
    }
    const expired = shouldInvalidateCache || entry.integrity !== integrity || ttl && Date.now() - (entry.mtime || 0) > ttl || validate(entry) === false;
    const _resolve = async () => {
      const isPending = pending[key];
      if (!isPending) {
        if (entry.value !== void 0 && (opts.staleMaxAge || 0) >= 0 && opts.swr === false) {
          entry.value = void 0;
          entry.integrity = void 0;
          entry.mtime = void 0;
          entry.expires = void 0;
        }
        pending[key] = Promise.resolve(resolver());
      }
      try {
        entry.value = await pending[key];
      } catch (error) {
        if (!isPending) {
          delete pending[key];
        }
        throw error;
      }
      if (!isPending) {
        entry.mtime = Date.now();
        entry.integrity = integrity;
        delete pending[key];
        if (validate(entry) !== false) {
          let setOpts;
          if (opts.maxAge && !opts.swr) {
            setOpts = { ttl: opts.maxAge };
          }
          const promise = useStorage().setItem(cacheKey, entry, setOpts).catch((error) => {
            console.error(`[cache] Cache write error.`, error);
            useNitroApp().captureError(error, { event, tags: ["cache"] });
          });
          if (event?.waitUntil) {
            event.waitUntil(promise);
          }
        }
      }
    };
    const _resolvePromise = expired ? _resolve() : Promise.resolve();
    if (entry.value === void 0) {
      await _resolvePromise;
    } else if (expired && event && event.waitUntil) {
      event.waitUntil(_resolvePromise);
    }
    if (opts.swr && validate(entry) !== false) {
      _resolvePromise.catch((error) => {
        console.error(`[cache] SWR handler error.`, error);
        useNitroApp().captureError(error, { event, tags: ["cache"] });
      });
      return entry;
    }
    return _resolvePromise.then(() => entry);
  }
  return async (...args) => {
    const shouldBypassCache = await opts.shouldBypassCache?.(...args);
    if (shouldBypassCache) {
      return fn(...args);
    }
    const key = await (opts.getKey || getKey)(...args);
    const shouldInvalidateCache = await opts.shouldInvalidateCache?.(...args);
    const entry = await get(
      key,
      () => fn(...args),
      shouldInvalidateCache,
      args[0] && isEvent(args[0]) ? args[0] : void 0
    );
    let value = entry.value;
    if (opts.transform) {
      value = await opts.transform(entry, ...args) || value;
    }
    return value;
  };
}
function cachedFunction(fn, opts = {}) {
  return defineCachedFunction(fn, opts);
}
function getKey(...args) {
  return args.length > 0 ? hash(args) : "";
}
function escapeKey(key) {
  return String(key).replace(/\W/g, "");
}
function defineCachedEventHandler(handler, opts = defaultCacheOptions()) {
  const variableHeaderNames = (opts.varies || []).filter(Boolean).map((h) => h.toLowerCase()).sort();
  const _opts = {
    ...opts,
    getKey: async (event) => {
      const customKey = await opts.getKey?.(event);
      if (customKey) {
        return escapeKey(customKey);
      }
      const _path = event.node.req.originalUrl || event.node.req.url || event.path;
      let _pathname;
      try {
        _pathname = escapeKey(decodeURI(parseURL(_path).pathname)).slice(0, 16) || "index";
      } catch {
        _pathname = "-";
      }
      const _hashedPath = `${_pathname}.${hash(_path)}`;
      const _headers = variableHeaderNames.map((header) => [header, event.node.req.headers[header]]).map(([name, value]) => `${escapeKey(name)}.${hash(value)}`);
      return [_hashedPath, ..._headers].join(":");
    },
    validate: (entry) => {
      if (!entry.value) {
        return false;
      }
      if (entry.value.code >= 400) {
        return false;
      }
      if (entry.value.body === void 0) {
        return false;
      }
      if (entry.value.headers.etag === "undefined" || entry.value.headers["last-modified"] === "undefined") {
        return false;
      }
      return true;
    },
    group: opts.group || "nitro/handlers",
    integrity: opts.integrity || hash([handler, opts])
  };
  const _cachedHandler = cachedFunction(
    async (incomingEvent) => {
      const variableHeaders = {};
      for (const header of variableHeaderNames) {
        const value = incomingEvent.node.req.headers[header];
        if (value !== void 0) {
          variableHeaders[header] = value;
        }
      }
      const reqProxy = cloneWithProxy(incomingEvent.node.req, {
        headers: variableHeaders
      });
      const resHeaders = {};
      let _resSendBody;
      const resProxy = cloneWithProxy(incomingEvent.node.res, {
        statusCode: 200,
        writableEnded: false,
        writableFinished: false,
        headersSent: false,
        closed: false,
        getHeader(name) {
          return resHeaders[name];
        },
        setHeader(name, value) {
          resHeaders[name] = value;
          return this;
        },
        getHeaderNames() {
          return Object.keys(resHeaders);
        },
        hasHeader(name) {
          return name in resHeaders;
        },
        removeHeader(name) {
          delete resHeaders[name];
        },
        getHeaders() {
          return resHeaders;
        },
        end(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2();
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return this;
        },
        write(chunk, arg2, arg3) {
          if (typeof chunk === "string") {
            _resSendBody = chunk;
          }
          if (typeof arg2 === "function") {
            arg2(void 0);
          }
          if (typeof arg3 === "function") {
            arg3();
          }
          return true;
        },
        writeHead(statusCode, headers2) {
          this.statusCode = statusCode;
          if (headers2) {
            if (Array.isArray(headers2) || typeof headers2 === "string") {
              throw new TypeError("Raw headers  is not supported.");
            }
            for (const header in headers2) {
              const value = headers2[header];
              if (value !== void 0) {
                this.setHeader(
                  header,
                  value
                );
              }
            }
          }
          return this;
        }
      });
      const event = createEvent(reqProxy, resProxy);
      event.fetch = (url, fetchOptions) => fetchWithEvent$1(event, url, fetchOptions, {
        fetch: useNitroApp().localFetch
      });
      event.$fetch = (url, fetchOptions) => fetchWithEvent$1(event, url, fetchOptions, {
        fetch: globalThis.$fetch
      });
      event.waitUntil = incomingEvent.waitUntil;
      event.context = incomingEvent.context;
      event.context.cache = {
        options: _opts
      };
      const body = await handler(event) || _resSendBody;
      const headers = event.node.res.getHeaders();
      headers.etag = String(
        headers.Etag || headers.etag || `W/"${hash(body)}"`
      );
      headers["last-modified"] = String(
        headers["Last-Modified"] || headers["last-modified"] || (/* @__PURE__ */ new Date()).toUTCString()
      );
      const cacheControl = [];
      if (opts.swr) {
        if (opts.maxAge) {
          cacheControl.push(`s-maxage=${opts.maxAge}`);
        }
        if (opts.staleMaxAge) {
          cacheControl.push(`stale-while-revalidate=${opts.staleMaxAge}`);
        } else {
          cacheControl.push("stale-while-revalidate");
        }
      } else if (opts.maxAge) {
        cacheControl.push(`max-age=${opts.maxAge}`);
      }
      if (cacheControl.length > 0) {
        headers["cache-control"] = cacheControl.join(", ");
      }
      const cacheEntry = {
        code: event.node.res.statusCode,
        headers,
        body
      };
      return cacheEntry;
    },
    _opts
  );
  return defineEventHandler(async (event) => {
    if (opts.headersOnly) {
      if (handleCacheHeaders(event, { maxAge: opts.maxAge })) {
        return;
      }
      return handler(event);
    }
    const response = await _cachedHandler(
      event
    );
    if (event.node.res.headersSent || event.node.res.writableEnded) {
      return response.body;
    }
    if (handleCacheHeaders(event, {
      modifiedTime: new Date(response.headers["last-modified"]),
      etag: response.headers.etag,
      maxAge: opts.maxAge
    })) {
      return;
    }
    event.node.res.statusCode = response.code;
    for (const name in response.headers) {
      const value = response.headers[name];
      if (name === "set-cookie") {
        event.node.res.appendHeader(
          name,
          splitCookiesString(value)
        );
      } else {
        if (value !== void 0) {
          event.node.res.setHeader(name, value);
        }
      }
    }
    return response.body;
  });
}
function cloneWithProxy(obj, overrides) {
  return new Proxy(obj, {
    get(target, property, receiver) {
      if (property in overrides) {
        return overrides[property];
      }
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property in overrides) {
        overrides[property] = value;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    }
  });
}
const cachedEventHandler = defineCachedEventHandler;

function klona(x) {
	if (typeof x !== 'object') return x;

	var k, tmp, str=Object.prototype.toString.call(x);

	if (str === '[object Object]') {
		if (x.constructor !== Object && typeof x.constructor === 'function') {
			tmp = new x.constructor();
			for (k in x) {
				if (x.hasOwnProperty(k) && tmp[k] !== x[k]) {
					tmp[k] = klona(x[k]);
				}
			}
		} else {
			tmp = {}; // null
			for (k in x) {
				if (k === '__proto__') {
					Object.defineProperty(tmp, k, {
						value: klona(x[k]),
						configurable: true,
						enumerable: true,
						writable: true,
					});
				} else {
					tmp[k] = klona(x[k]);
				}
			}
		}
		return tmp;
	}

	if (str === '[object Array]') {
		k = x.length;
		for (tmp=Array(k); k--;) {
			tmp[k] = klona(x[k]);
		}
		return tmp;
	}

	if (str === '[object Set]') {
		tmp = new Set;
		x.forEach(function (val) {
			tmp.add(klona(val));
		});
		return tmp;
	}

	if (str === '[object Map]') {
		tmp = new Map;
		x.forEach(function (val, key) {
			tmp.set(klona(key), klona(val));
		});
		return tmp;
	}

	if (str === '[object Date]') {
		return new Date(+x);
	}

	if (str === '[object RegExp]') {
		tmp = new RegExp(x.source, x.flags);
		tmp.lastIndex = x.lastIndex;
		return tmp;
	}

	if (str === '[object DataView]') {
		return new x.constructor( klona(x.buffer) );
	}

	if (str === '[object ArrayBuffer]') {
		return x.slice(0);
	}

	// ArrayBuffer.isView(x)
	// ~> `new` bcuz `Buffer.slice` => ref
	if (str.slice(-6) === 'Array]') {
		return new x.constructor(x);
	}

	return x;
}

const inlineAppConfig = {};



const appConfig = defuFn(inlineAppConfig);

const NUMBER_CHAR_RE = /\d/;
const STR_SPLITTERS = ["-", "_", "/", "."];
function isUppercase(char = "") {
  if (NUMBER_CHAR_RE.test(char)) {
    return void 0;
  }
  return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
  const splitters = STR_SPLITTERS;
  const parts = [];
  if (!str || typeof str !== "string") {
    return parts;
  }
  let buff = "";
  let previousUpper;
  let previousSplitter;
  for (const char of str) {
    const isSplitter = splitters.includes(char);
    if (isSplitter === true) {
      parts.push(buff);
      buff = "";
      previousUpper = void 0;
      continue;
    }
    const isUpper = isUppercase(char);
    if (previousSplitter === false) {
      if (previousUpper === false && isUpper === true) {
        parts.push(buff);
        buff = char;
        previousUpper = isUpper;
        continue;
      }
      if (previousUpper === true && isUpper === false && buff.length > 1) {
        const lastChar = buff.at(-1);
        parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
        buff = lastChar + char;
        previousUpper = isUpper;
        continue;
      }
    }
    buff += char;
    previousUpper = isUpper;
    previousSplitter = isSplitter;
  }
  parts.push(buff);
  return parts;
}
function upperFirst(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : "";
}
function kebabCase(str, joiner) {
  return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner) : "";
}
function snakeCase(str) {
  return kebabCase(str || "", "_");
}
const titleCaseExceptions = /^(a|an|and|as|at|but|by|for|if|in|is|nor|of|on|or|the|to|with)$/i;
function titleCase(str, opts) {
  return (Array.isArray(str) ? str : splitByCase(str)).filter(Boolean).map(
    (p) => titleCaseExceptions.test(p) ? p.toLowerCase() : upperFirst(p)
  ).join(" ");
}

function getEnv(key, opts) {
  const envKey = snakeCase(key).toUpperCase();
  return destr(
    process.env[opts.prefix + envKey] ?? process.env[opts.altPrefix + envKey]
  );
}
function _isObject(input) {
  return typeof input === "object" && !Array.isArray(input);
}
function applyEnv(obj, opts, parentKey = "") {
  for (const key in obj) {
    const subKey = parentKey ? `${parentKey}_${key}` : key;
    const envValue = getEnv(subKey, opts);
    if (_isObject(obj[key])) {
      if (_isObject(envValue)) {
        obj[key] = { ...obj[key], ...envValue };
        applyEnv(obj[key], opts, subKey);
      } else if (envValue === void 0) {
        applyEnv(obj[key], opts, subKey);
      } else {
        obj[key] = envValue ?? obj[key];
      }
    } else {
      obj[key] = envValue ?? obj[key];
    }
    if (opts.envExpansion && typeof obj[key] === "string") {
      obj[key] = _expandFromEnv(obj[key]);
    }
  }
  return obj;
}
const envExpandRx = /\{\{([^{}]*)\}\}/g;
function _expandFromEnv(value) {
  return value.replace(envExpandRx, (match, key) => {
    return process.env[key] || match;
  });
}

const _inlineRuntimeConfig = {
  "app": {
    "baseURL": "/",
    "buildId": "64835765-3226-4c41-822b-695b3e2b57f5",
    "buildAssetsDir": "/_nuxt/",
    "cdnURL": ""
  },
  "nitro": {
    "envPrefix": "NUXT_",
    "routeRules": {
      "/__nuxt_error": {
        "cache": false
      },
      "/**": {
        "headers": {
          "Referrer-Policy": "no-referrer",
          "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
          "X-Content-Type-Options": "nosniff",
          "X-Download-Options": "noopen",
          "X-Frame-Options": "SAMEORIGIN",
          "X-Permitted-Cross-Domain-Policies": "none",
          "X-XSS-Protection": "0"
        }
      },
      "/_nuxt": {
        "robots": "noindex",
        "headers": {
          "X-Robots-Tag": "noindex"
        }
      },
      "/_nuxt/**": {
        "headers": {
          "cache-control": "public, max-age=31536000, immutable",
          "X-Robots-Tag": "noindex"
        },
        "robots": "noindex"
      },
      "/_nuxt/builds/meta/**": {
        "headers": {
          "cache-control": "public, max-age=31536000, immutable"
        }
      },
      "/_nuxt/builds/**": {
        "headers": {
          "cache-control": "public, max-age=1, immutable"
        }
      },
      "/_fonts/**": {
        "headers": {
          "cache-control": "public, max-age=31536000, immutable"
        }
      }
    }
  },
  "public": {
    "gtmId": "GTM-KZD42V9R",
    "nuxt-seo-utils-version": "8.5.1",
    "seo-utils": {
      "canonicalQueryWhitelist": [
        "page",
        "sort",
        "filter",
        "search",
        "q",
        "category",
        "tag",
        "f"
      ],
      "canonicalLowercase": true,
      "automaticTwitterTags": true,
      "tagPriority": "low",
      "separator": "",
      "titleSeparator": ""
    },
    "nuxt-robots": {
      "version": "6.2.3",
      "isNuxtContentV2": false,
      "debug": false,
      "credits": true,
      "groups": [
        {
          "comment": [],
          "disallow": [
            ""
          ],
          "allow": [],
          "userAgent": [
            "*"
          ],
          "contentUsage": [],
          "contentSignal": [],
          "_indexable": true,
          "_rules": [],
          "_normalized": true
        }
      ],
      "sitemap": [
        "/sitemap.xml"
      ],
      "header": true,
      "robotsEnabledValue": "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      "robotsDisabledValue": "noindex, nofollow",
      "cacheControl": "max-age=14400, must-revalidate",
      "botDetection": true,
      "pageMetaRobots": {}
    }
  },
  "drawTokenSecret": "dev-only-insecure-secret-change-in-production",
  "private": {
    "basicAuth": false
  },
  "security": {
    "strict": false,
    "headers": {
      "crossOriginResourcePolicy": "same-origin",
      "crossOriginOpenerPolicy": "same-origin",
      "crossOriginEmbedderPolicy": "credentialless",
      "contentSecurityPolicy": {
        "base-uri": [
          "'none'"
        ],
        "font-src": [
          "'self'",
          "https:",
          "data:"
        ],
        "form-action": [
          "'self'"
        ],
        "frame-ancestors": [
          "'self'"
        ],
        "img-src": [
          "'self'",
          "data:",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com"
        ],
        "object-src": [
          "'none'"
        ],
        "script-src-attr": [
          "'none'"
        ],
        "style-src": [
          "'self'",
          "https:",
          "'unsafe-inline'"
        ],
        "script-src": [
          "'self'",
          "https:",
          "'unsafe-inline'",
          "'strict-dynamic'",
          "'nonce-{{nonce}}'"
        ],
        "upgrade-insecure-requests": true
      },
      "originAgentCluster": "?1",
      "referrerPolicy": "no-referrer",
      "strictTransportSecurity": {
        "maxAge": 15552000,
        "includeSubdomains": true
      },
      "xContentTypeOptions": "nosniff",
      "xDNSPrefetchControl": "off",
      "xDownloadOptions": "noopen",
      "xFrameOptions": "SAMEORIGIN",
      "xPermittedCrossDomainPolicies": "none",
      "xXSSProtection": "0",
      "permissionsPolicy": {
        "camera": [],
        "display-capture": [],
        "fullscreen": [],
        "geolocation": [],
        "microphone": []
      }
    },
    "requestSizeLimiter": {
      "maxRequestSizeInBytes": 2000000,
      "maxUploadFileRequestInBytes": 8000000,
      "throwError": true
    },
    "rateLimiter": {
      "tokensPerInterval": 150,
      "interval": 300000,
      "headers": false,
      "driver": {
        "name": "lruCache"
      },
      "whiteList": "",
      "ipHeader": "",
      "throwError": true
    },
    "xssValidator": {
      "methods": [
        "GET",
        "POST"
      ],
      "throwError": true
    },
    "corsHandler": {
      "origin": "http://localhost:3000",
      "methods": [
        "GET",
        "HEAD",
        "PUT",
        "PATCH",
        "POST",
        "DELETE"
      ],
      "preflight": {
        "statusCode": 204
      }
    },
    "allowedMethodsRestricter": {
      "methods": "*",
      "throwError": true
    },
    "hidePoweredBy": true,
    "enabled": true,
    "csrf": false,
    "nonce": true,
    "removeLoggers": true,
    "ssg": {
      "meta": true,
      "hashScripts": true,
      "hashStyles": false,
      "nitroHeaders": true,
      "exportToPresets": true
    },
    "sri": true,
    "contentSecurityPolicyReportOnly": false
  },
  "sitemap": {
    "cacheMaxAgeSeconds": 600,
    "debug": false
  },
  "nuxt-schema-org": {
    "reactive": false,
    "minify": true,
    "scriptAttributes": {
      "data-nuxt-schema-org": true
    },
    "identity": "",
    "version": "6.3.2"
  },
  "nuxt-site-config": {
    "stack": [
      {
        "_context": "system",
        "_priority": -15,
        "env": "production"
      },
      {
        "_priority": -3,
        "_context": "nuxt-site-config:config",
        "url": "https://exacteleven.co.uk",
        "name": "Exact XI"
      }
    ],
    "version": "4.2.3",
    "debug": false,
    "multiTenancy": []
  },
  "nuxt-robots": {
    "version": "6.2.3",
    "isNuxtContentV2": false,
    "debug": false,
    "credits": true,
    "groups": [
      {
        "comment": [],
        "disallow": [
          ""
        ],
        "allow": [],
        "userAgent": [
          "*"
        ],
        "contentUsage": [],
        "contentSignal": [],
        "_indexable": true,
        "_rules": [],
        "_normalized": true
      }
    ],
    "sitemap": [
      "/sitemap.xml"
    ],
    "header": true,
    "robotsEnabledValue": "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    "robotsDisabledValue": "noindex, nofollow",
    "cacheControl": "max-age=14400, must-revalidate",
    "botDetection": true,
    "pageMetaRobots": {}
  }
};
const envOptions = {
  prefix: "NITRO_",
  altPrefix: _inlineRuntimeConfig.nitro.envPrefix ?? process.env.NITRO_ENV_PREFIX ?? "_",
  envExpansion: _inlineRuntimeConfig.nitro.envExpansion ?? process.env.NITRO_ENV_EXPANSION ?? false
};
const _sharedRuntimeConfig = _deepFreeze(
  applyEnv(klona(_inlineRuntimeConfig), envOptions)
);
function useRuntimeConfig(event) {
  if (!event) {
    return _sharedRuntimeConfig;
  }
  if (event.context.nitro.runtimeConfig) {
    return event.context.nitro.runtimeConfig;
  }
  const runtimeConfig = klona(_inlineRuntimeConfig);
  applyEnv(runtimeConfig, envOptions);
  event.context.nitro.runtimeConfig = runtimeConfig;
  return runtimeConfig;
}
_deepFreeze(klona(appConfig));
function _deepFreeze(object) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === "object") {
      _deepFreeze(value);
    }
  }
  return Object.freeze(object);
}
new Proxy(/* @__PURE__ */ Object.create(null), {
  get: (_, prop) => {
    console.warn(
      "Please use `useRuntimeConfig()` instead of accessing config directly."
    );
    const runtimeConfig = useRuntimeConfig();
    if (prop in runtimeConfig) {
      return runtimeConfig[prop];
    }
    return void 0;
  }
});

function createContext(opts = {}) {
  let currentInstance;
  let isSingleton = false;
  const checkConflict = (instance) => {
    if (currentInstance && currentInstance !== instance) {
      throw new Error("Context conflict");
    }
  };
  let als;
  if (opts.asyncContext) {
    const _AsyncLocalStorage = opts.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    if (_AsyncLocalStorage) {
      als = new _AsyncLocalStorage();
    } else {
      console.warn("[unctx] `AsyncLocalStorage` is not provided.");
    }
  }
  const _getCurrentInstance = () => {
    if (als) {
      const instance = als.getStore();
      if (instance !== void 0) {
        return instance;
      }
    }
    return currentInstance;
  };
  return {
    use: () => {
      const _instance = _getCurrentInstance();
      if (_instance === void 0) {
        throw new Error("Context is not available");
      }
      return _instance;
    },
    tryUse: () => {
      return _getCurrentInstance();
    },
    set: (instance, replace) => {
      if (!replace) {
        checkConflict(instance);
      }
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
        return als ? als.run(instance, callback) : callback();
      } finally {
        if (!isSingleton) {
          currentInstance = void 0;
        }
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
        const r = als ? als.run(instance, callback) : callback();
        if (!isSingleton) {
          currentInstance = void 0;
        }
        return await r;
      } finally {
        asyncHandlers.delete(onLeave);
      }
    }
  };
}
function createNamespace(defaultOpts = {}) {
  const contexts = {};
  return {
    get(key, opts = {}) {
      if (!contexts[key]) {
        contexts[key] = createContext({ ...defaultOpts, ...opts });
      }
      return contexts[key];
    }
  };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());

getContext("nitro-app", {
  asyncContext: false,
  AsyncLocalStorage: void 0
});

function isPathInScope(pathname, base) {
  let canonical;
  try {
    const pre = pathname.replace(/%2f/gi, "/").replace(/%5c/gi, "\\");
    canonical = new URL(pre, "http://_").pathname;
  } catch {
    return false;
  }
  return !base || canonical === base || canonical.startsWith(base + "/");
}

const config = useRuntimeConfig();
const _routeRulesMatcher = toRouteMatcher(
  createRouter$1({ routes: config.nitro.routeRules })
);
function createRouteRulesHandler(ctx) {
  return eventHandler((event) => {
    const routeRules = getRouteRules(event);
    if (routeRules.headers) {
      setHeaders(event, routeRules.headers);
    }
    if (routeRules.redirect) {
      let target = routeRules.redirect.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.redirect._redirectStripBase;
        if (strpBase) {
          if (!isPathInScope(event.path.split("?")[0], strpBase)) {
            throw createError$1({ statusCode: 400 });
          }
          targetPath = withoutBase(targetPath, strpBase);
        } else if (targetPath.startsWith("//")) {
          targetPath = targetPath.replace(/^\/+/, "/");
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery$1(event.path);
        target = withQuery(target, query);
      }
      return sendRedirect(event, target, routeRules.redirect.statusCode);
    }
    if (routeRules.proxy) {
      let target = routeRules.proxy.to;
      if (target.endsWith("/**")) {
        let targetPath = event.path;
        const strpBase = routeRules.proxy._proxyStripBase;
        if (strpBase) {
          if (!isPathInScope(event.path.split("?")[0], strpBase)) {
            throw createError$1({ statusCode: 400 });
          }
          targetPath = withoutBase(targetPath, strpBase);
        } else if (targetPath.startsWith("//")) {
          targetPath = targetPath.replace(/^\/+/, "/");
        }
        target = joinURL(target.slice(0, -3), targetPath);
      } else if (event.path.includes("?")) {
        const query = getQuery$1(event.path);
        target = withQuery(target, query);
      }
      return proxyRequest(event, target, {
        fetch: ctx.localFetch,
        ...routeRules.proxy
      });
    }
  });
}
function getRouteRules(event) {
  event.context._nitro = event.context._nitro || {};
  if (!event.context._nitro.routeRules) {
    event.context._nitro.routeRules = getRouteRulesForPath(
      withoutBase(event.path.split("?")[0], useRuntimeConfig().app.baseURL)
    );
  }
  return event.context._nitro.routeRules;
}
function getRouteRulesForPath(path) {
  return defu({}, ..._routeRulesMatcher.matchAll(path).reverse());
}

function joinHeaders(value) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}
function normalizeFetchResponse(response) {
  if (!response.headers.has("set-cookie")) {
    return response;
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: normalizeCookieHeaders(response.headers)
  });
}
function normalizeCookieHeader(header = "") {
  return splitCookiesString(joinHeaders(header));
}
function normalizeCookieHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of headers) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}

//#region src/runtime/utils/error.ts
/**
* Nitro internal functions extracted from https://github.com/nitrojs/nitro/blob/v2/src/runtime/internal/utils.ts
*/
function isJsonRequest(event) {
	if (hasReqHeader(event, "accept", "text/html")) return false;
	return hasReqHeader(event, "accept", "application/json") || hasReqHeader(event, "user-agent", "curl/") || hasReqHeader(event, "user-agent", "httpie/") || hasReqHeader(event, "sec-fetch-mode", "cors") || event.path.startsWith("/api/") || event.path.endsWith(".json");
}
function hasReqHeader(event, name, includes) {
	const value = getRequestHeader(event, name);
	return !!(value && typeof value === "string" && value.toLowerCase().includes(includes));
}

//#region src/runtime/handlers/error.ts
var error_default = async function errorhandler(error, event, { defaultHandler }) {
	if (event.handled || isJsonRequest(event)) return;
	const defaultRes = await defaultHandler(error, event, { json: true });
	const status = error.status || error.statusCode || 500;
	if (status === 404 && defaultRes.status === 302) {
		setResponseHeaders(event, defaultRes.headers);
		setResponseStatus(event, defaultRes.status, defaultRes.statusText);
		return send(event, JSON.stringify(defaultRes.body, null, 2));
	}
	const errorObject = defaultRes.body;
	const url = new URL(errorObject.url);
	errorObject.url = withoutBase(url.pathname, useRuntimeConfig(event).app.baseURL) + url.search + url.hash;
	errorObject.message = error.unhandled ? errorObject.message || "Server Error" : error.message || errorObject.message || "Server Error";
	errorObject.data ||= error.data;
	errorObject.statusText ||= error.statusText || error.statusMessage;
	delete defaultRes.headers["content-type"];
	delete defaultRes.headers["content-security-policy"];
	setResponseHeaders(event, defaultRes.headers);
	const reqHeaders = getRequestHeaders(event);
	const res = event.path.startsWith("/__nuxt_error") || !!reqHeaders["x-nuxt-error"] ? null : await useNitroApp().localFetch(withQuery(joinURL(useRuntimeConfig(event).app.baseURL, "/__nuxt_error"), errorObject), {
		headers: {
			...reqHeaders,
			"x-nuxt-error": "true"
		},
		redirect: "manual"
	}).catch(() => null);
	if (event.handled) return;
	if (!res) {
		const { template } = await import('../_/error-500.mjs');
		setResponseHeader(event, "Content-Type", "text/html;charset=UTF-8");
		return send(event, template(errorObject));
	}
	const html = await res.text();
	for (const [header, value] of res.headers.entries()) {
		if (header === "set-cookie") {
			appendResponseHeader(event, header, value);
			continue;
		}
		setResponseHeader(event, header, value);
	}
	setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultRes.status, res.statusText || defaultRes.statusText);
	return send(event, html);
};

function defineNitroErrorHandler(handler) {
  return handler;
}

const errorHandler$1 = defineNitroErrorHandler(
  function defaultNitroErrorHandler(error, event) {
    const res = defaultHandler(error, event);
    setResponseHeaders(event, res.headers);
    setResponseStatus(event, res.status, res.statusText);
    return send(event, JSON.stringify(res.body, null, 2));
  }
);
function defaultHandler(error, event, opts) {
  const isSensitive = error.unhandled || error.fatal;
  const statusCode = error.statusCode || 500;
  const statusMessage = error.statusMessage || "Server Error";
  const url = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true });
  if (statusCode === 404) {
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`
      };
    }
  }
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]", error.fatal && "[fatal]"].filter(Boolean).join(" ");
    console.error(`[request error] ${tags} [${event.method}] ${url}
`, error);
  }
  const headers = {
    "content-type": "application/json",
    // Prevent browser from guessing the MIME types of resources.
    "x-content-type-options": "nosniff",
    // Prevent error page from being embedded in an iframe
    "x-frame-options": "DENY",
    // Prevent browsers from sending the Referer header
    "referrer-policy": "no-referrer",
    // Disable the execution of any js
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';"
  };
  setResponseStatus(event, statusCode, statusMessage);
  if (statusCode === 404 || !getResponseHeader(event, "cache-control")) {
    headers["cache-control"] = "no-cache";
  }
  const body = {
    error: true,
    url: url.href,
    statusCode,
    statusMessage,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? void 0 : error.data
  };
  return {
    status: statusCode,
    statusText: statusMessage,
    headers,
    body
  };
}

const errorHandlers = [error_default, errorHandler$1];

async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      await handler(error, event, { defaultHandler });
      if (event.handled) {
        return; // Response handled
      }
    } catch(error) {
      // Handler itself thrown, log and continue
      console.error(error);
    }
  }
  // H3 will handle fallback
}

function fetchWithEvent(event, request, options) {
  return event.$fetch(request, options)
}

const _fNJFbxHZYHyLmZA5iKsCBBJIUCo_kbgkT8E5yvymQg = defineNitroPlugin((nitroApp) => {
  return;
});

const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$";
const unsafeChars = /[<>\b\f\n\r\t\0\u2028\u2029]/g;
const reserved = /^(?:do|if|in|for|int|let|new|try|var|byte|case|char|else|enum|goto|long|this|void|with|await|break|catch|class|const|final|float|short|super|throw|while|yield|delete|double|export|import|native|return|switch|throws|typeof|boolean|default|extends|finally|package|private|abstract|continue|debugger|function|volatile|interface|protected|transient|implements|instanceof|synchronized)$/;
const escaped = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "	": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029"
};
const objectProtoOwnPropertyNames = Object.getOwnPropertyNames(Object.prototype).sort().join("\0");
function devalue(value) {
  const counts = /* @__PURE__ */ new Map();
  let logNum = 0;
  function log(message) {
    if (logNum < 100) {
      console.warn(message);
      logNum += 1;
    }
  }
  function walk(thing) {
    if (typeof thing === "function") {
      log(`Cannot stringify a function ${thing.name}`);
      return;
    }
    if (counts.has(thing)) {
      counts.set(thing, counts.get(thing) + 1);
      return;
    }
    counts.set(thing, 1);
    if (!isPrimitive(thing)) {
      const type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
        case "Date":
        case "RegExp":
          return;
        case "Array":
          thing.forEach(walk);
          break;
        case "Set":
        case "Map":
          Array.from(thing).forEach(walk);
          break;
        default:
          const proto = Object.getPrototypeOf(thing);
          if (proto !== Object.prototype && proto !== null && Object.getOwnPropertyNames(proto).sort().join("\0") !== objectProtoOwnPropertyNames) {
            if (typeof thing.toJSON !== "function") {
              log(`Cannot stringify arbitrary non-POJOs ${thing.constructor.name}`);
            }
          } else if (Object.getOwnPropertySymbols(thing).length > 0) {
            log(`Cannot stringify POJOs with symbolic keys ${Object.getOwnPropertySymbols(thing).map((symbol) => symbol.toString())}`);
          } else {
            Object.keys(thing).forEach((key) => walk(thing[key]));
          }
      }
    }
  }
  walk(value);
  const names = /* @__PURE__ */ new Map();
  Array.from(counts).filter((entry) => entry[1] > 1).sort((a, b) => b[1] - a[1]).forEach((entry, i) => {
    names.set(entry[0], getName(i));
  });
  function stringify(thing) {
    if (names.has(thing)) {
      return names.get(thing);
    }
    if (isPrimitive(thing)) {
      return stringifyPrimitive(thing);
    }
    const type = getType(thing);
    switch (type) {
      case "Number":
      case "String":
      case "Boolean":
        return `Object(${stringify(thing.valueOf())})`;
      case "RegExp":
        return thing.toString();
      case "Date":
        return `new Date(${thing.getTime()})`;
      case "Array":
        const members = thing.map((v, i) => i in thing ? stringify(v) : "");
        const tail = thing.length === 0 || thing.length - 1 in thing ? "" : ",";
        return `[${members.join(",")}${tail}]`;
      case "Set":
      case "Map":
        return `new ${type}([${Array.from(thing).map(stringify).join(",")}])`;
      default:
        if (thing.toJSON) {
          let json = thing.toJSON();
          if (getType(json) === "String") {
            try {
              json = JSON.parse(json);
            } catch (e) {
            }
          }
          return stringify(json);
        }
        if (Object.getPrototypeOf(thing) === null) {
          if (Object.keys(thing).length === 0) {
            return "Object.create(null)";
          }
          return `Object.create(null,{${Object.keys(thing).map((key) => `${safeKey(key)}:{writable:true,enumerable:true,value:${stringify(thing[key])}}`).join(",")}})`;
        }
        return `{${Object.keys(thing).map((key) => `${safeKey(key)}:${stringify(thing[key])}`).join(",")}}`;
    }
  }
  const str = stringify(value);
  if (names.size) {
    const params = [];
    const statements = [];
    const values = [];
    names.forEach((name, thing) => {
      params.push(name);
      if (isPrimitive(thing)) {
        values.push(stringifyPrimitive(thing));
        return;
      }
      const type = getType(thing);
      switch (type) {
        case "Number":
        case "String":
        case "Boolean":
          values.push(`Object(${stringify(thing.valueOf())})`);
          break;
        case "RegExp":
          values.push(thing.toString());
          break;
        case "Date":
          values.push(`new Date(${thing.getTime()})`);
          break;
        case "Array":
          values.push(`Array(${thing.length})`);
          thing.forEach((v, i) => {
            statements.push(`${name}[${i}]=${stringify(v)}`);
          });
          break;
        case "Set":
          values.push("new Set");
          statements.push(`${name}.${Array.from(thing).map((v) => `add(${stringify(v)})`).join(".")}`);
          break;
        case "Map":
          values.push("new Map");
          statements.push(`${name}.${Array.from(thing).map(([k, v]) => `set(${stringify(k)}, ${stringify(v)})`).join(".")}`);
          break;
        default:
          values.push(Object.getPrototypeOf(thing) === null ? "Object.create(null)" : "{}");
          Object.keys(thing).forEach((key) => {
            statements.push(`${name}${safeProp(key)}=${stringify(thing[key])}`);
          });
      }
    });
    statements.push(`return ${str}`);
    return `(function(${params.join(",")}){${statements.join(";")}}(${values.join(",")}))`;
  } else {
    return str;
  }
}
function getName(num) {
  let name = "";
  do {
    name = chars[num % chars.length] + name;
    num = ~~(num / chars.length) - 1;
  } while (num >= 0);
  return reserved.test(name) ? `${name}0` : name;
}
function isPrimitive(thing) {
  return Object(thing) !== thing;
}
function stringifyPrimitive(thing) {
  if (typeof thing === "string") {
    return stringifyString(thing);
  }
  if (thing === void 0) {
    return "void 0";
  }
  if (thing === 0 && 1 / thing < 0) {
    return "-0";
  }
  const str = String(thing);
  if (typeof thing === "number") {
    return str.replace(/^(-)?0\./, "$1.");
  }
  return str;
}
function getType(thing) {
  return Object.prototype.toString.call(thing).slice(8, -1);
}
function escapeUnsafeChar(c) {
  return escaped[c] || c;
}
function escapeUnsafeChars(str) {
  return str.replace(unsafeChars, escapeUnsafeChar);
}
function safeKey(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? key : escapeUnsafeChars(JSON.stringify(key));
}
function safeProp(key) {
  return /^[_$a-zA-Z][_$a-zA-Z0-9]*$/.test(key) ? `.${key}` : `[${escapeUnsafeChars(JSON.stringify(key))}]`;
}
function stringifyString(str) {
  let result = '"';
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charAt(i);
    const code = char.charCodeAt(0);
    if (char === '"') {
      result += '\\"';
    } else if (char in escaped) {
      result += escaped[char];
    } else if (code >= 55296 && code <= 57343) {
      const next = str.charCodeAt(i + 1);
      if (code <= 56319 && (next >= 56320 && next <= 57343)) {
        result += char + str[++i];
      } else {
        result += `\\u${code.toString(16).toUpperCase()}`;
      }
    } else {
      result += char;
    }
  }
  result += '"';
  return result;
}

const SiteConfigPriority = {
  nitro: -4,
  runtime: 0
};

function toValue(source) {
  if (typeof source === "function")
    return source();
  if (source && source.__v_isRef === true)
    return source.value;
  return source;
}
const NUXT_SITE_PREFIX = "NUXT_SITE_";
const NUXT_PUBLIC_SITE_PREFIX = "NUXT_PUBLIC_SITE_";
function envSiteConfig(env = {}) {
  const config = {};
  for (const key of Object.keys(env)) {
    const prefixLength = key.startsWith(NUXT_SITE_PREFIX) ? NUXT_SITE_PREFIX.length : key.startsWith(NUXT_PUBLIC_SITE_PREFIX) ? NUXT_PUBLIC_SITE_PREFIX.length : 0;
    if (!prefixLength)
      continue;
    const segments = key.slice(prefixLength).split("_");
    let configKey = segments[0].toLowerCase();
    for (let i = 1; i < segments.length; i++) {
      const segment = segments[i];
      configKey += segment[0]?.toUpperCase() + segment.slice(1).toLowerCase();
    }
    config[configKey] = env[key];
  }
  return config;
}

function normalizeSiteConfig(config) {
  if (typeof config.indexable !== "undefined")
    config.indexable = String(config.indexable) !== "false";
  if (typeof config.trailingSlash !== "undefined" && !config.trailingSlash)
    config.trailingSlash = String(config.trailingSlash) !== "false";
  if (config.url && !hasProtocol(String(config.url), { acceptRelative: true, strict: false }))
    config.url = withHttps(String(config.url));
  const keys = Object.keys(config).sort((a, b) => a.localeCompare(b));
  const newConfig = {};
  for (const k of keys)
    newConfig[k] = config[k];
  return newConfig;
}
function createSiteConfigStack(options) {
  const debug = options?.debug || false;
  const stack = [];
  function push(input) {
    if (!input || typeof input !== "object" || Object.keys(input).length === 0) {
      return () => {
      };
    }
    if (!input._context && debug) {
      let lastFunctionName = new Error("tmp").stack?.split("\n")[2]?.split(" ")[5];
      if (lastFunctionName?.includes("/"))
        lastFunctionName = "anonymous";
      input._context = lastFunctionName;
    }
    const entry = {};
    for (const k in input) {
      const val = input[k];
      if (typeof val !== "undefined" && val !== "")
        entry[k] = val;
    }
    if (!Object.keys(entry).some((k) => !k.startsWith("_"))) {
      return () => {
      };
    }
    stack.push(entry);
    return () => {
      const idx = stack.indexOf(entry);
      if (idx !== -1)
        stack.splice(idx, 1);
    };
  }
  function get(options2) {
    const siteConfig = {};
    if (options2?.debug)
      siteConfig._context = {};
    siteConfig._priority = {};
    for (const o in stack.sort((a, b) => (a._priority || 0) - (b._priority || 0))) {
      for (const k in stack[o]) {
        const key = k;
        const val = options2?.resolveRefs ? toValue(stack[o][k]) : stack[o][k];
        if (!k.startsWith("_") && typeof val !== "undefined" && val !== "") {
          siteConfig[k] = val;
          if (typeof stack[o]._priority !== "undefined" && stack[o]._priority !== -1) {
            siteConfig._priority[key] = stack[o]._priority;
          }
          if (options2?.debug)
            siteConfig._context[key] = stack[o]._context?.[key] || stack[o]._context || "anonymous";
        }
      }
    }
    return options2?.skipNormalize ? siteConfig : normalizeSiteConfig(siteConfig);
  }
  return {
    stack,
    push,
    get
  };
}

function withoutQuery(path) {
  const queryIndex = path.indexOf("?");
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}
function createNitroRouteRuleMatcher(runtimeConfig) {
  const { nitro, app } = runtimeConfig;
  const baseURL = app?.baseURL || "/";
  const _routeRulesMatcher = toRouteMatcher(
    createRouter$1({
      routes: Object.fromEntries(
        Object.entries(nitro?.routeRules || {}).map(([path, rules]) => [withoutTrailingSlash(path), rules])
      )
    })
  );
  return (pathOrUrl) => {
    const path = pathOrUrl[0] === "/" ? pathOrUrl : parseURL(pathOrUrl, baseURL).pathname;
    return defu({}, ..._routeRulesMatcher.matchAll(
      withoutBase(withoutTrailingSlash(withoutQuery(path)), baseURL)
    ).reverse());
  };
}

function getSiteRouteRules(event) {
  const nitroRouteRules = getRouteRules(event);
  const routeRules = nitroRouteRules;
  return {
    site: routeRules.site,
    // Nitro 3 removes matched false rules, while Nuxt treats a missing ssr rule as no-SSR.
    ssr: routeRules.ssr ?? false
  };
}

function getSiteConfig(e, _options) {
  e.context.siteConfig = e.context.siteConfig || createSiteConfigStack();
  const options = defu(_options, useRuntimeConfig(e)["nuxt-site-config"], { debug: false });
  return e.context.siteConfig.get(options);
}

const _ntAOIgCUmACv79YLk_JfIsvP90tmnXAvPszxojXoUw0 = defineNitroPlugin(async (nitroApp) => {
  nitroApp.hooks.hook("render:html", async (ctx, { event }) => {
    const routeOptions = getSiteRouteRules(event);
    const isIsland = process.env.NUXT_COMPONENT_ISLANDS && event.path.startsWith("/__nuxt_island");
    event.path;
    const noSSR = !!process.env.NUXT_NO_SSR || event.context.nuxt?.noSSR || routeOptions.ssr === false && !isIsland || (false);
    if (noSSR) {
      const siteConfig = Object.fromEntries(
        Object.entries(getSiteConfig(event)).map(([k, v]) => [k, toValue(v)])
      );
      ctx.body.push(`<script>window.__NUXT_SITE_CONFIG__=${devalue(siteConfig)}<\/script>`);
    }
  });
});

const KNOWN_SEARCH_BOTS = [
  {
    pattern: "googlebot",
    name: "googlebot",
    secondaryPatterns: ["google.com/bot.html"]
  },
  {
    pattern: "bingbot",
    name: "bingbot",
    secondaryPatterns: ["msnbot"]
  },
  {
    pattern: "yandexbot",
    name: "yandexbot"
  },
  {
    pattern: "baiduspider",
    name: "baiduspider",
    secondaryPatterns: ["baidu.com"]
  },
  {
    pattern: "duckduckbot",
    name: "duckduckbot",
    secondaryPatterns: ["duckduckgo.com"]
  },
  {
    pattern: "slurp",
    name: "yahoo"
  },
  {
    pattern: "applebot",
    name: "applebot",
    secondaryPatterns: ["apple.com/go/applebot"]
  }
];
const SOCIAL_BOTS = [
  {
    pattern: "twitterbot",
    name: "twitter",
    secondaryPatterns: ["twitter"]
  },
  {
    pattern: "facebookexternalhit",
    name: "facebook",
    secondaryPatterns: ["facebook.com"]
  },
  {
    pattern: "linkedinbot",
    name: "linkedin",
    secondaryPatterns: ["linkedin"]
  },
  {
    pattern: "pinterestbot",
    name: "pinterest",
    secondaryPatterns: ["pinterest"]
  },
  {
    pattern: "discordbot",
    name: "discord",
    secondaryPatterns: ["discordapp"]
  }
];
const SEO_BOTS = [
  {
    pattern: "mj12bot",
    name: "majestic12",
    secondaryPatterns: ["majestic12.co.uk/bot"]
  },
  {
    pattern: "ahrefsbot",
    name: "ahrefs",
    secondaryPatterns: ["ahrefs.com"]
  },
  {
    pattern: "semrushbot",
    name: "semrush",
    secondaryPatterns: ["semrush.com/bot"]
  },
  {
    pattern: "screaming frog",
    name: "screaming-frog",
    secondaryPatterns: ["screamingfrog.co.uk"]
  },
  {
    pattern: "rogerbot",
    name: "moz"
  }
];
const AI_BOTS = [
  {
    pattern: "anthropic",
    name: "anthropic"
  },
  {
    pattern: "claude",
    name: "claude"
  },
  {
    pattern: "gptbot",
    name: "gpt",
    secondaryPatterns: ["openai.com"]
  },
  {
    pattern: "google-extended",
    name: "google-extended"
  },
  {
    pattern: "applebot-extended",
    name: "applebot-extended"
  },
  {
    pattern: "bytespider",
    name: "bytespider"
  },
  {
    pattern: "diffbot",
    name: "diffbot"
  },
  {
    pattern: "googlebot-news",
    name: "google-news"
  },
  {
    pattern: "cohere",
    name: "cohere",
    secondaryPatterns: ["cohere.com"]
  },
  {
    pattern: "ccbot",
    name: "commoncrawl",
    secondaryPatterns: ["commoncrawl.org"]
  },
  {
    pattern: "perplexitybot",
    name: "perplexity",
    secondaryPatterns: ["perplexity.ai"]
  }
];
const HTTP_TOOL_BOTS = [
  {
    pattern: "python-requests",
    name: "requests",
    secondaryPatterns: ["python"]
  },
  {
    pattern: "wget",
    name: "wget"
  },
  {
    pattern: "curl",
    name: "curl",
    secondaryPatterns: ["curl"]
  }
];
const SECURITY_SCANNING_BOTS = [
  {
    pattern: "zgrab",
    name: "zgrab"
  },
  {
    pattern: "masscan",
    name: "masscan"
  },
  {
    pattern: "nmap",
    name: "nmap",
    secondaryPatterns: ["insecure.org"]
  },
  {
    pattern: "nikto",
    name: "nikto"
  },
  {
    pattern: "wpscan",
    name: "wpscan"
  }
];
const SCRAPING_BOTS = [
  {
    pattern: "scrapy",
    name: "scrapy",
    secondaryPatterns: ["scrapy.org"]
  }
];
const AUTOMATION_BOTS = [
  {
    pattern: "phantomjs",
    name: "phantomjs"
  },
  {
    pattern: "headless",
    name: "headless-browser"
  },
  {
    pattern: "playwright",
    name: "playwright"
  },
  {
    pattern: "selenium",
    name: "selenium",
    secondaryPatterns: ["webdriver"]
  },
  {
    pattern: "puppeteer",
    name: "puppeteer",
    secondaryPatterns: ["headless"]
  }
];
const GENERIC_BOTS = [
  {
    pattern: "bot",
    name: "generic-bot"
  },
  {
    pattern: "spider",
    name: "generic-spider"
  },
  {
    pattern: "crawler",
    name: "generic-crawler"
  },
  {
    pattern: "scraper",
    name: "generic-scraper"
  }
];
const BOT_MAP = [
  {
    type: "search-engine",
    bots: KNOWN_SEARCH_BOTS,
    trusted: true
  },
  {
    type: "social",
    bots: SOCIAL_BOTS,
    trusted: true
  },
  {
    type: "seo",
    bots: SEO_BOTS,
    trusted: true
  },
  {
    type: "ai",
    bots: AI_BOTS,
    trusted: true
  },
  {
    type: "generic",
    bots: GENERIC_BOTS,
    trusted: false
  },
  {
    type: "automation",
    bots: AUTOMATION_BOTS,
    trusted: false
  },
  {
    type: "http-tool",
    bots: HTTP_TOOL_BOTS,
    trusted: false
  },
  {
    type: "security-scanner",
    bots: SECURITY_SCANNING_BOTS,
    trusted: false
  },
  {
    type: "scraping",
    bots: SCRAPING_BOTS,
    trusted: false
  }
];

const ROBOT_DIRECTIVE_VALUES = {
  // Standard directives
  enabled: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
  disabled: "noindex, nofollow",
  index: "index",
  noindex: "noindex",
  follow: "follow",
  nofollow: "nofollow",
  none: "none",
  all: "all",
  // Non-standard directives (not part of official robots spec)
  noai: "noai",
  noimageai: "noimageai"
};
function formatMaxImagePreview(value) {
  return `max-image-preview:${value}`;
}
function formatMaxSnippet(value) {
  return `max-snippet:${value}`;
}
function formatMaxVideoPreview(value) {
  return `max-video-preview:${value}`;
}
function matches(pattern, path) {
  const pathLength = path.length;
  const patternLength = pattern.length;
  const matchingLengths = Array.from({ length: pathLength + 1 }).fill(0);
  let numMatchingLengths = 1;
  let p = 0;
  while (p < patternLength) {
    if (pattern[p] === "$" && p + 1 === patternLength) {
      return matchingLengths[numMatchingLengths - 1] === pathLength;
    }
    if (pattern[p] === "*") {
      numMatchingLengths = pathLength - matchingLengths[0] + 1;
      for (let i = 1; i < numMatchingLengths; i++) {
        matchingLengths[i] = matchingLengths[i - 1] + 1;
      }
    } else {
      let numMatches = 0;
      for (let i = 0; i < numMatchingLengths; i++) {
        const matchLength = matchingLengths[i];
        if (matchLength < pathLength && path[matchLength] === pattern[p]) {
          matchingLengths[numMatches++] = matchLength + 1;
        }
      }
      if (numMatches === 0) {
        return false;
      }
      numMatchingLengths = numMatches;
    }
    p++;
  }
  return true;
}
function matchPathToRule(path, _rules) {
  let matchedRule = null;
  const rules = _rules.filter(Boolean);
  const rulesLength = rules.length;
  let i = 0;
  while (i < rulesLength) {
    const rule = rules[i];
    if (!rule || !matches(rule.pattern, path)) {
      i++;
      continue;
    }
    if (!matchedRule || rule.pattern.length > matchedRule.pattern.length) {
      matchedRule = rule;
    } else if (rule.pattern.length === matchedRule.pattern.length && rule.allow && !matchedRule.allow) {
      matchedRule = rule;
    }
    i++;
  }
  return matchedRule;
}
function asArray(v) {
  return typeof v === "undefined" ? [] : Array.isArray(v) ? v : [v];
}
function contentUsageToString(prefs) {
  return Object.entries(prefs).filter(([_, value]) => value !== void 0).map(([key, value]) => `${key}=${value}`).join(", ");
}
function normalizeContentPreferences(value) {
  if (!value)
    return [];
  if (Array.isArray(value))
    return value.filter((rule) => Boolean(rule));
  if (typeof value === "object" && !Array.isArray(value)) {
    const str = contentUsageToString(value);
    return str ? [str] : [];
  }
  if (typeof value === "string")
    return value ? [value] : [];
  return [];
}
function normalizeGroup(group) {
  if (group._normalized) {
    const resolvedGroup = group;
    const disallow2 = asArray(resolvedGroup.disallow);
    resolvedGroup._indexable = !disallow2.includes("/");
    resolvedGroup._rules = [
      ...resolvedGroup.disallow.filter(Boolean).map((r) => ({ pattern: r, allow: false })),
      ...resolvedGroup.allow.map((r) => ({ pattern: r, allow: true }))
    ];
    return resolvedGroup;
  }
  const disallow = asArray(group.disallow);
  const allow = asArray(group.allow).filter((rule) => Boolean(rule));
  const contentUsage = normalizeContentPreferences(group.contentUsage);
  const contentSignal = normalizeContentPreferences(group.contentSignal);
  return {
    ...group,
    userAgent: group.userAgent ? asArray(group.userAgent) : ["*"],
    disallow,
    allow,
    contentUsage,
    contentSignal,
    _indexable: !disallow.includes("/"),
    _rules: [
      ...disallow.filter(Boolean).map((r) => ({ pattern: r, allow: false })),
      ...allow.map((r) => ({ pattern: r, allow: true }))
    ],
    _normalized: true
  };
}
function generateRobotsTxt({ groups, sitemaps }) {
  const lines = [];
  for (const group of groups) {
    for (const comment of group.comment || [])
      lines.push(`# ${comment}`);
    for (const userAgent of group.userAgent || ["*"])
      lines.push(`User-agent: ${userAgent}`);
    for (const allow of group.allow || [])
      lines.push(`Allow: ${allow}`);
    for (const disallow of group.disallow || [])
      lines.push(`Disallow: ${disallow}`);
    for (const cleanParam of group.cleanParam || [])
      lines.push(`Clean-param: ${cleanParam}`);
    for (const contentUsage of group.contentUsage || [])
      lines.push(`Content-Usage: ${contentUsage}`);
    for (const contentSignal of group.contentSignal || [])
      lines.push(`Content-Signal: ${contentSignal}`);
    lines.push("");
  }
  for (const sitemap of sitemaps)
    lines.push(`Sitemap: ${sitemap}`);
  return lines.join("\n");
}
function createPatternMap() {
  const patternMap = /* @__PURE__ */ new Map();
  for (const def of BOT_MAP) {
    for (const bot of def.bots) {
      const patterns = [bot.pattern, ...bot.secondaryPatterns || []];
      for (const pattern of patterns) {
        patternMap.set(pattern.toLowerCase(), {
          botName: bot.name,
          botCategory: def.type,
          trusted: def.trusted
        });
      }
    }
  }
  return patternMap;
}
function robotsDirectivesFromObject(obj) {
  const directives = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === false || value === null || value === void 0)
      continue;
    if (key in ROBOT_DIRECTIVE_VALUES && typeof value === "boolean" && value) {
      directives.push(ROBOT_DIRECTIVE_VALUES[key]);
    } else if (key === "max-image-preview" && typeof value === "string") {
      directives.push(formatMaxImagePreview(value));
    } else if (key === "max-snippet" && typeof value === "number") {
      directives.push(formatMaxSnippet(value));
    } else if (key === "max-video-preview" && typeof value === "number") {
      directives.push(formatMaxVideoPreview(value));
    }
  }
  return directives;
}
function normaliseRobotsRouteRule(config) {
  if (!config)
    return void 0;
  let allow;
  if (typeof config.robots === "boolean")
    allow = config.robots;
  else if (typeof config.robots === "object" && "indexable" in config.robots && typeof config.robots.indexable !== "undefined")
    allow = config.robots.indexable;
  let rule;
  if (typeof config.robots === "object" && config.robots !== null) {
    if ("rule" in config.robots && typeof config.robots.rule !== "undefined") {
      rule = config.robots.rule;
    } else if (!("indexable" in config.robots)) {
      const directives = robotsDirectivesFromObject(config.robots);
      if (directives.length > 0) {
        rule = directives.join(", ");
      }
    }
  } else if (typeof config.robots === "string") {
    rule = config.robots;
  }
  if (rule && typeof allow === "undefined") {
    const disallowIndicators = ["none", "noindex", "noai", "noimageai"];
    allow = !disallowIndicators.some(
      (indicator) => rule === indicator || rule.split(",").some((part) => part.trim() === indicator)
    );
  }
  if (typeof allow === "undefined" && typeof rule === "undefined")
    return;
  return {
    allow,
    rule
  };
}

function useRuntimeConfigNuxtRobots(event) {
  return useRuntimeConfig(event)["nuxt-robots"];
}

function parseSerializedRegExp(value) {
  const lastSlash = value.lastIndexOf("/");
  return new RegExp(value.slice(1, lastSlash), value.slice(lastSlash + 1));
}
function deserializeFilters(filters) {
  return filters.map((filter) => {
    if (filter instanceof RegExp || typeof filter === "string")
      return filter;
    if (typeof filter.regex === "string")
      return parseSerializedRegExp(filter.regex);
    if (typeof filter.source === "string")
      return new RegExp(filter.source, filter.flags || "");
    return filter;
  });
}
function createFilter(options = {}) {
  const include = deserializeFilters(options.include || []);
  const exclude = deserializeFilters(options.exclude || []);
  if (include.length === 0 && exclude.length === 0)
    return () => true;
  const excludeRegex = exclude.filter((r) => r instanceof RegExp);
  const includeRegex = include.filter((r) => r instanceof RegExp);
  const excludeStrings = exclude.filter((r) => typeof r === "string");
  const includeStrings = include.filter((r) => typeof r === "string");
  const excludeMatcher = excludeStrings.length > 0 ? toRouteMatcher(createRouter$1({
    routes: Object.fromEntries(excludeStrings.map((r) => [r, true])),
    strictTrailingSlash: false
  })) : null;
  const includeMatcher = includeStrings.length > 0 ? toRouteMatcher(createRouter$1({
    routes: Object.fromEntries(includeStrings.map((r) => [r, true])),
    strictTrailingSlash: false
  })) : null;
  const excludeExact = new Set(excludeStrings);
  const includeExact = new Set(includeStrings);
  return function(path) {
    if (excludeRegex.some((r) => r.test(path)))
      return false;
    if (excludeExact.has(path))
      return false;
    if (excludeMatcher && excludeMatcher.matchAll(path).length > 0)
      return false;
    if (includeRegex.some((r) => r.test(path)))
      return true;
    if (includeExact.has(path))
      return true;
    if (includeMatcher && includeMatcher.matchAll(path).length > 0)
      return true;
    return include.length === 0;
  };
}
function createModuleLogger(tag, debug) {
  return createConsola({ level: 3, defaults: { tag } });
}

const logger$1 = createModuleLogger("@nuxtjs/robots");

async function resolveRobotsTxtContext(e, nitro = useNitroApp()) {
  const { groups, sitemap: sitemaps } = useRuntimeConfigNuxtRobots(e);
  const generateRobotsTxtCtx = {
    event: e,
    context: e ? "robots.txt" : "init",
    errors: [],
    warnings: [],
    ...JSON.parse(JSON.stringify({ groups, sitemaps }))
  };
  await nitro.hooks.callHook("robots:config", generateRobotsTxtCtx);
  generateRobotsTxtCtx.groups = generateRobotsTxtCtx.groups.map(normalizeGroup);
  nitro._robots.ctx = generateRobotsTxtCtx;
  return generateRobotsTxtCtx;
}

const _7gFdX7CIn8rQCaw6HibjOaAjPHeQeIGd67DLeBaQk = defineNitroPlugin(async (nitroApp) => {
  const { isNuxtContentV2, robotsDisabledValue, botDetection } = useRuntimeConfigNuxtRobots();
  if (botDetection !== false) {
    nitroApp._robotsPatternMap = createPatternMap();
  }
  nitroApp._robots = {};
  await resolveRobotsTxtContext(void 0, nitroApp);
  const nuxtContentUrls = /* @__PURE__ */ new Set();
  if (isNuxtContentV2) {
    let urls;
    try {
      urls = await (await nitroApp.localFetch("/__robots__/nuxt-content.json", {})).json();
    } catch (e) {
      logger$1.error("Failed to read robot rules from content files.", e);
    }
    if (urls && Array.isArray(urls) && urls.length) {
      urls.forEach((url) => nuxtContentUrls.add(withoutTrailingSlash(url)));
    }
  }
  if (nuxtContentUrls.size) {
    nitroApp._robots.nuxtContentUrls = nuxtContentUrls;
  }
});

function defineNitroPlugin(def) {
  return def;
}

const _mbWMKQZ9PqfJMP_S1OQVWVwUH0xxC5nDtAnKNFbbEow = defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("error", (error, { event } = {}) => {
    var _a;
    const statusCode = error.statusCode;
    if (statusCode && statusCode < 500) {
      return;
    }
    console.error(`[unhandled] ${(_a = event == null ? void 0 : event.path) != null ? _a : "unknown path"}:`, error);
  });
});

const defuReplaceArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) || Array.isArray(value)) {
    obj[key] = value;
    return true;
  }
});

const nitroAppSecurityOptions = {};
function getAppSecurityOptions() {
  return nitroAppSecurityOptions;
}
function resolveSecurityRules(event) {
  if (!event.context.security) {
    event.context.security = {};
  }
  if (!event.context.security.rules) {
    const router = createRouter$1({ routes: structuredClone(nitroAppSecurityOptions) });
    const matcher = toRouteMatcher(router);
    const eventPathNoQuery = event.path.split("?")[0];
    const matches = eventPathNoQuery ? matcher.matchAll(eventPathNoQuery) : [];
    const rules = defuReplaceArray({}, ...matches.reverse());
    event.context.security.rules = rules;
  }
  return event.context.security.rules;
}
function resolveSecurityRoute(event) {
  if (!event.context.security) {
    event.context.security = {};
  }
  if (!event.context.security.route) {
    const routeNames = Object.fromEntries(Object.entries(nitroAppSecurityOptions).map(([name]) => [name, { name }]));
    const router = createRouter$1({ routes: routeNames });
    const eventPathNoQuery = event.path.split("?")[0];
    const match = eventPathNoQuery ? router.lookup(eventPathNoQuery) : void 0;
    const route = match?.name ?? "";
    event.context.security.route = route;
  }
  return event.context.security.route;
}

const KEYS_TO_NAMES = {
  contentSecurityPolicy: "Content-Security-Policy",
  crossOriginEmbedderPolicy: "Cross-Origin-Embedder-Policy",
  crossOriginOpenerPolicy: "Cross-Origin-Opener-Policy",
  crossOriginResourcePolicy: "Cross-Origin-Resource-Policy",
  originAgentCluster: "Origin-Agent-Cluster",
  referrerPolicy: "Referrer-Policy",
  strictTransportSecurity: "Strict-Transport-Security",
  xContentTypeOptions: "X-Content-Type-Options",
  xDNSPrefetchControl: "X-DNS-Prefetch-Control",
  xDownloadOptions: "X-Download-Options",
  xFrameOptions: "X-Frame-Options",
  xPermittedCrossDomainPolicies: "X-Permitted-Cross-Domain-Policies",
  xXSSProtection: "X-XSS-Protection",
  permissionsPolicy: "Permissions-Policy"
};
const NAMES_TO_KEYS = Object.fromEntries(Object.entries(KEYS_TO_NAMES).map(([key, name]) => [name, key]));
function getNameFromKey(key) {
  return KEYS_TO_NAMES[key];
}
function getKeyFromName(headerName) {
  const [, key] = Object.entries(NAMES_TO_KEYS).find(([name]) => name.toLowerCase() === headerName.toLowerCase()) || [];
  return key;
}
function headerStringFromObject(optionKey, optionValue) {
  if (optionValue === false) {
    return "";
  }
  if (optionKey === "contentSecurityPolicy") {
    const policies = optionValue;
    return Object.entries(policies).filter(([, value]) => value !== false).map(([directive, sources]) => {
      if (directive === "upgrade-insecure-requests") {
        return "upgrade-insecure-requests;";
      } else {
        const stringifiedSources = typeof sources === "string" ? sources : sources.map((source) => source.trim()).join(" ");
        return `${directive} ${stringifiedSources};`;
      }
    }).join(" ");
  } else if (optionKey === "strictTransportSecurity") {
    const policies = optionValue;
    return [
      `max-age=${policies.maxAge}`,
      policies.includeSubdomains && "includeSubDomains",
      policies.preload && "preload"
    ].filter(Boolean).join("; ");
  } else if (optionKey === "permissionsPolicy") {
    const policies = optionValue;
    return Object.entries(policies).filter(([, value]) => value !== false).map(([directive, sources]) => {
      if (typeof sources === "string") {
        return `${directive}=${sources}`;
      } else {
        return `${directive}=(${sources.join(" ")})`;
      }
    }).join(", ");
  } else {
    return optionValue;
  }
}
function headerObjectFromString(optionKey, headerValue) {
  if (!headerValue) {
    return false;
  }
  if (optionKey === "contentSecurityPolicy") {
    const directives = headerValue.split(";").map((directive) => directive.trim()).filter((directive) => directive);
    const objectForm = {};
    for (const directive of directives) {
      const [type, ...sources] = directive.split(" ").map((token) => token.trim());
      if (type === "upgrade-insecure-requests") {
        objectForm[type] = true;
      } else {
        objectForm[type] = sources.join(" ");
      }
    }
    return objectForm;
  } else if (optionKey === "strictTransportSecurity") {
    const directives = headerValue.split(";").map((directive) => directive.trim()).filter((directive) => directive);
    const objectForm = {};
    for (const directive of directives) {
      const [type, value] = directive.split("=").map((token) => token.trim());
      if (type === "max-age") {
        objectForm.maxAge = Number(value);
      } else if (type === "includeSubdomains" || type === "preload") {
        objectForm[type] = true;
      }
    }
    return objectForm;
  } else if (optionKey === "permissionsPolicy") {
    const directives = headerValue.split(",").map((directive) => directive.trim()).filter((directive) => directive);
    const objectForm = {};
    for (const directive of directives) {
      const [type, value] = directive.split("=").map((token) => token.trim());
      objectForm[type] = value;
    }
    return objectForm;
  } else {
    return headerValue;
  }
}
function standardToSecurity(standardHeaders) {
  if (!standardHeaders) {
    return void 0;
  }
  const standardHeadersAsObject = {};
  Object.entries(standardHeaders).forEach(([headerName, headerValue]) => {
    const optionKey = getKeyFromName(headerName);
    if (optionKey) {
      if (typeof headerValue === "string") {
        const objectValue = headerObjectFromString(optionKey, headerValue);
        standardHeadersAsObject[optionKey] = objectValue;
      } else {
        standardHeadersAsObject[optionKey] = headerValue;
      }
    }
  });
  if (Object.keys(standardHeadersAsObject).length === 0) {
    return void 0;
  }
  return standardHeadersAsObject;
}
function backwardsCompatibleSecurity(securityHeaders) {
  if (!securityHeaders) {
    return void 0;
  }
  const securityHeadersAsObject = {};
  Object.entries(securityHeaders).forEach(([key, value]) => {
    const optionKey = key;
    if ((optionKey === "contentSecurityPolicy" || optionKey === "permissionsPolicy" || optionKey === "strictTransportSecurity") && typeof value === "string") {
      const objectValue = headerObjectFromString(optionKey, value);
      securityHeadersAsObject[optionKey] = objectValue;
    } else if (value === "") {
      securityHeadersAsObject[optionKey] = false;
    } else {
      securityHeadersAsObject[optionKey] = value;
    }
  });
  return securityHeadersAsObject;
}

const _cIpli6a2cBX_wXmaKOYcrKTPlsf4S_G3YRsIXLd37K8 = defineNitroPlugin(async (nitroApp) => {
  const appSecurityOptions = getAppSecurityOptions();
  const runtimeConfig = useRuntimeConfig();
  for (const route in runtimeConfig.nitro.routeRules) {
    const rule = runtimeConfig.nitro.routeRules[route];
    if (!rule) continue;
    const { headers: headers2 } = rule;
    const securityHeaders2 = standardToSecurity(headers2);
    if (securityHeaders2) {
      appSecurityOptions[route] = { headers: securityHeaders2 };
    }
  }
  const securityOptions = runtimeConfig.security;
  const { headers } = securityOptions;
  const securityHeaders = backwardsCompatibleSecurity(headers);
  appSecurityOptions["/**"] = defuReplaceArray(
    { headers: securityHeaders },
    securityOptions,
    appSecurityOptions["/**"]
  );
  for (const route in runtimeConfig.nitro.routeRules) {
    const rule = runtimeConfig.nitro.routeRules[route];
    if (!rule) continue;
    const { security } = rule;
    if (security) {
      const { headers: headers2 } = security;
      const securityHeaders2 = backwardsCompatibleSecurity(headers2);
      appSecurityOptions[route] = defuReplaceArray(
        { headers: securityHeaders2 },
        security,
        appSecurityOptions[route]
      );
    }
  }
  nitroApp.hooks.hook("nuxt-security:headers", ({ route, headers: headers2 }) => {
    appSecurityOptions[route] = defuReplaceArray(
      { headers: headers2 },
      appSecurityOptions[route]
    );
  });
  nitroApp.hooks.hook("nuxt-security:ready", async () => {
    await nitroApp.hooks.callHook("nuxt-security:routeRules", appSecurityOptions);
  });
  await nitroApp.hooks.callHook("nuxt-security:ready");
});

const sriHashes = {"/_nuxt/builds/meta/64835765-3226-4c41-822b-695b3e2b57f5.json":"sha384-0qI7x4Pjqjj0AeE8dIhQUTfElUp/2IMx8Vl8X/cREdyAfHNwpbKCxtpUHFbt5p8w","/_fonts/5KeSRwle0XgGletDCj_2jHdyGYEasdJQ47Jjtd2TPX8-pKZhK_elnDeEwdyOzMJ2uuUtruaYDtTJetlQ9hhDN4k.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/6CXtQpr9VY5Z0zV1xogwmkWDzNR_19zN1NTGulEzmjg-kCRFKXhkCh0_kGLAckhVN3TP-F_bkwm7Ivy9TdKzUJg.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/CVYsH1vGFVxEl_hHX0t5BQ1csOV7JoAXImEixQyJGBU-Pl46Rxa736KWH2CP4_5kLfnHJV8f5AZI7Xexf2gRZ_Y.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/FPImowmXkU1aWgmKsxPu7Akj0JNowdsV90BaJJQN8Dw-_91jnewDEbv6Ft52Ae56infTiwcwq3HFAAhB_Y7h8Nw.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/Im8HkqQ00A1IGqihOqFViX4pj8D3DlxkfI6t6LTbZQg-jR4Prvz_J7I8oA8oUj3_1pTizDgpRYIEI5b7BlHPneU.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/K8QcDcyOyhfeWSIYRWqIVvD31Sq1pYQlylqOSGRZd20-XSSEx0MioaOu4Y9OiMkmyo_qcOtVNbGgQcCxQMsf5FI.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/UnngOpW3QUFmW9ustR7f4iJ6HMtsBQrF8MRey6Urw8M-bdAyUOEhdSN8LU65JRDWYqdkUIYhM59ZKeszsiAgtAI.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/bJM9t_QZ4-OukAilpAvXFzrpFWWgeGJ0mI4OoxeTBXA-T1gZRQnm_CyPlHs2G7o5lSEBc3-0yjeDI6MJ5h7RFr8.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/d9tsDyRASAVro0LnXZAOKLG3PswQ2j9K0IG4Tz36K5I-YztMGgsb9pf2ri9KScnBT5l2FkN3cmfHsdFKv1i2OE8.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/j2DQVh5iMWeAm2MqpLd4MwbmjfUsIAMYOc7Un8-q1oQ-5gkdZw7cVFs_x-rFm49rMnDT-AGGoIvy6_RxE2XbStA.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_fonts/r5GGGlqLRk_nfFPSvqtEa1SqHRTxDc38iTXOBSFKP2A-_X6jP8BfZ7N_fPATlu6lLIjA_FCgT-gkOnb816p0M8I.woff2":"sha384-OLBgp1GsljhM2TJ+sbHjaiH9txEUvgdDTAzHv2P24donTt6/529l+9Ua0vFImLlb","/_nuxt/B7JrSnhk.js":"sha384-p+3g997C1EUK2ZwBV8fTM/Xbqz1uaHZNGNp6pclEDenELb+gzPi5vqmzQIWOxmNC","/_nuxt/BBwFyNl6.js":"sha384-5lO9/u+b45k1qIIsk5Qpbs272jcUOGOpLMrNeieGi0td0f0e8NTEB6kaDJVLD64e","/_nuxt/BNXrNho6.js":"sha384-Hy+w2cs/3IjQI5zGInWym7r78pOH+uW5zrEpsB2wuxGKpL9d1hQFPr6lvMgjFJ8c","/_nuxt/BXk29AIz.js":"sha384-DBDFbfI4YYoG/O6Vz2+QmxcsiKqweAW9i0yuNfYjcGqoNJoJyf3aFMnJz8ozZjAn","/_nuxt/BvYvB4wi.js":"sha384-O5GNvvBeS70HzSQFMZm+UJjB1QywnWKGp+Proq2cFjta7LtcTd1sFvSOfgdBQV06","/_nuxt/BwoguZIX.js":"sha384-zKb4TYQLI++uY/x+/iyvIhOuLHhW86+AOpJsraz9xb+NhB/h1hLgDnnT5Z4FpFPt","/_nuxt/CB0x5YVr.js":"sha384-u3cCd4Qc45Uu8zZWgalcBVBtVUAjS0GCdmiMmCHUIkLibANPE68PDoTVZer5QTL9","/_nuxt/CzguGI0i.js":"sha384-mCiXxtJYfxvoKtKNy57h4HsY4G7DMpjXG8oMioAEh99j91UvAIDPM74BfA+8mZ1k","/_nuxt/D1qhP2Un.js":"sha384-NKAmYuKM83vLJdTG2/qR5xIXfMW28mdEjg7YXEylr+4AYGHwgaYybLPT+XHjAwkA","/_nuxt/DH2gYLCV.js":"sha384-86nf4vY5S7/J8K+NAOkyc7qcSuqazFesOM8ts8LBUv83OVpkD576Go3/CVr5V3xg","/_nuxt/DXwo8tPU.js":"sha384-bV6MHb6tkgp6nmgENG86ed0IBvEq75xFgPTDXUTICMofMiLJciAXjn7g89ZSnsvH","/_nuxt/DmkmgXc-.js":"sha384-xjj/tmVH36V9XtHRpk33Pc1+YHqAGA4SDwfo/Qy8e2sDxAdsxv/wQ8c26XoB2IQA","/_nuxt/HowToPlayContent.i_wq172O.css":"sha384-lsn/DsMHrXx8jSKMsha2ZL7TuZYFe61IOEtTLKxe8my23FVxM0VSZQzSnuLeHeqL","/_nuxt/OX6b0eK5.js":"sha384-1t5/iS1qTWnoOYOxako0npgaFVhUJ14jZl2F0Ol7rNHf41Gk9JznUVosBJWcgJvr","/_nuxt/PlayerChoiceDialog.my0W5l2f.css":"sha384-d1gyCePjoN+iGZfLOIzbDlsGttbkr9hq0XqkC5IFrfTgWbk6cTuf4YUybOzZdyS8","/_nuxt/StatsDialog.BTYTAjfy.css":"sha384-e76uPagYWAxzMU57mYNzdKfKEzf3n/+59sgJMxgjt9OeN3tPCTFv09NlkzrTD1xP","/_nuxt/bfsk4loF.js":"sha384-j+lEzk/fZD0KE0+bF7i4+NZZ6O13n6MbjvaSzzRvAS3VJAmZqPUuXXJC6V8ja2wQ","/_nuxt/challenge.Cj8MapWS.css":"sha384-/lfZsKvNzdzt8mFamtMqI3SySfIGBd0v0UsNEq+ZNm44HkAYKShd8Fb0U+k2hzLV","/_nuxt/daily.NoOiPVfj.css":"sha384-yYXCTqYsXlSOm9zC5mIC1qIv4CWbOGmKzpoYj02ZkPb1NoXMUq8o4Nt8dlEUHwS+","/_nuxt/entry.Do4EZhqs.css":"sha384-fSiWEN381YUsDqo3NGfNhADBX6sbxYNtuWOi5eFB4IeAwRZsXy0gxkl3Pc6BX1Ex","/_nuxt/error-404.Bb87HomL.css":"sha384-8tKXFXdJ0xO0bRW0oqenDFNY9DDJxjCvR+bd+mXcwkCwMSeKZ114963xQkhM0YIg","/_nuxt/error-500.Bwd7zAaE.css":"sha384-83OFcEsB6aGaHnkXl7uVr1k77WaVq3p5mcDQL74O334nyGfOUsEB3Dycj2Jq833V","/_nuxt/how-to-play.CPbLgpFA.css":"sha384-BSnhagTb+zdpYFjGRgn7XkgJQzI2AA1BfZn0EjzNfCLmf5QD/2uErzB0w5y0qS5X","/_nuxt/pages.DCJoAJIP.css":"sha384-H+78n4rlS49f4SV6xfw/a14nFJ0rn7Cyu7BtVL9zYgOzUmPJ7dCORzmhceus6YVX","/_nuxt/play.CBs6S25A.css":"sha384-jbg+Bi9eEUsZZmFxumPA+BnWaATBONb+Oqt8SRDjpNt8YOGN68fmyNY6njiqKO0I","/_robots.txt":"sha384-1+z+xOPZC0Y/sCZO3+nqXNQyRWi3tQkSmQE0iHdWv71QQCTPZPk9HyBTl6AWpC2R","/apple-touch-icon.png":"sha384-PiLR93ELx+yVOrFvYJd54Y9hqUF6jTPwd1Sr2gLO4vWDw4f5CbBjW0BqRgJpuQ4I","/favicon-32x32.png":"sha384-i+AulLUjCmyjhMdMrLIQhUjG6o8NMRlxbwyBfvVtuksoIpjOsheI9LDFope56Dqb","/favicon.ico":"sha384-nXUxWN4bBnVBrI+Mk8bzM4q9O8Ts2wf5ihnq3jcAPR/0z4+myYvk0Ga5BRsAhy/m","/og-image.png":"sha384-mKkMULN4Z58RKI2Ml+LQh6cVt4tmuzdsHTxvDN+uWNMqXT5gZJbQXOPhQs55Tb2S"};

const SCRIPT_RE$1 = /<script((?=[^>]+\bsrc="([^"]+)")(?![^>]+\bintegrity="[^"]+")[^>]+)(?:\/>|><\/script>)/g;
const LINK_RE$1 = /<link((?=[^>]+\brel="(?:stylesheet|preload|modulepreload)")(?=[^>]+\bhref="([^"]+)")(?![^>]+\bintegrity="[\w\-+/=]+")[^>]+)>/g;
const _e2_uCtOAObjRCd8qY6fk6byIEHDGqQC4CCJ78eSNsI = defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    const rules = resolveSecurityRules(event);
    if (!rules.enabled || !rules.sri) {
      return;
    }
    const sections = ["body", "bodyAppend", "bodyPrepend", "head"];
    for (const section of sections) {
      html[section] = html[section].map((element) => {
        if (typeof element !== "string") {
          return element;
        }
        element = element.replace(SCRIPT_RE$1, (match, rest, src) => {
          const hash = sriHashes[src];
          if (hash) {
            const integrityScript = `<script integrity="${hash}"${rest}><\/script>`;
            return integrityScript;
          } else {
            return match;
          }
        });
        element = element.replace(LINK_RE$1, (match, rest, href) => {
          const hash = sriHashes[href];
          if (hash) {
            const integrityLink = `<link integrity="${hash}"${rest}>`;
            return integrityLink;
          } else {
            return match;
          }
        });
        return element;
      });
    }
  });
});

function generateRandomNonce() {
  const array = new Uint8Array(18);
  crypto.getRandomValues(array);
  const nonce = btoa(String.fromCharCode(...array));
  return nonce;
}

const _GI7S2MygRdxJxtObcrP7iAqQwivDazLV20lUpL8xdfk = defineNitroPlugin((nitroApp) => {
  {
    return;
  }
});

const LINK_RE = /<link\b([^>]*?>)/gi;
const NONCE_RE = /nonce="[^"]+"/i;
const SCRIPT_RE = /<script\b([^>]*?>)/gi;
const STYLE_RE = /<style\b([^>]*?>)/gi;
const QUOTE_MASK_RE = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
const QUOTE_RESTORE_RE = /__QUOTE_PLACEHOLDER_(\d+)__/g;
function injectNonceToTags(element, nonce) {
  if (typeof element !== "string") {
    return element;
  }
  const quotes = [];
  let maskedElement = element.replace(QUOTE_MASK_RE, (match) => {
    quotes.push(match);
    return `__QUOTE_PLACEHOLDER_${quotes.length - 1}__`;
  });
  maskedElement = maskedElement.replace(LINK_RE, (match, rest) => {
    if (NONCE_RE.test(rest)) {
      return match.replace(NONCE_RE, `nonce="${nonce}"`);
    }
    return `<link nonce="${nonce}"` + rest;
  });
  maskedElement = maskedElement.replace(SCRIPT_RE, (match, rest) => {
    return `<script nonce="${nonce}"` + rest;
  });
  maskedElement = maskedElement.replace(STYLE_RE, (match, rest) => {
    return `<style nonce="${nonce}"` + rest;
  });
  const restoredHtml = maskedElement.replace(QUOTE_RESTORE_RE, (match, index) => {
    return quotes[parseInt(index, 10)];
  });
  return restoredHtml;
}
const _TWgnecXTJUzQns5cCx8hWIcpLLAGGAjI3HNpWnGl7Y = defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", (event) => {
    if (event.context.security?.nonce) {
      return;
    }
    const rules = resolveSecurityRules(event);
    if (rules.enabled && rules.nonce && true) {
      const nonce = generateRandomNonce();
      event.context.security.nonce = nonce;
    }
  });
  nitroApp.hooks.hook("render:html", (html, { event }) => {
    const rules = resolveSecurityRules(event);
    if (!rules.enabled || !rules.headers || !rules.headers.contentSecurityPolicy || !rules.nonce) {
      return;
    }
    const nonce = event.context.security.nonce;
    const sections = ["body", "bodyAppend", "bodyPrepend", "head"];
    for (const section of sections) {
      html[section] = html[section].map((element) => injectNonceToTags(element, nonce));
    }
  });
});

const _gsHWBkT74rxnHUfxoRXFarCEgllbIuKucJS7UGyv1T8 = defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:response", (response, { event }) => {
    const rules = resolveSecurityRules(event);
    if (rules.enabled && rules.headers) {
      const headers = rules.headers;
      if (headers.contentSecurityPolicy) {
        const csp = headers.contentSecurityPolicy;
        const nonce = event.context.security?.nonce;
        const scriptHashes = event.context.security?.hashes?.script;
        const styleHashes = event.context.security?.hashes?.style;
        headers.contentSecurityPolicy = updateCspVariables(csp, nonce, scriptHashes, styleHashes);
      }
    }
  });
});
function updateCspVariables(csp, nonce, scriptHashes, styleHashes) {
  const generatedCsp = Object.fromEntries(Object.entries(csp).map(([directive, value]) => {
    if (typeof value === "boolean") {
      return [directive, value];
    }
    const sources = typeof value === "string" ? value.split(" ").map((token) => token.trim()).filter((token) => token) : value;
    const modifiedSources = sources.filter((source) => {
      if (source.startsWith("'nonce-") && source !== "'nonce-{{nonce}}'") {
        console.warn("[nuxt-security] removing static nonce from CSP header");
        return false;
      }
      return true;
    }).map((source) => {
      if (source === "'nonce-{{nonce}}'") {
        return nonce ? `'nonce-${nonce}'` : "";
      } else {
        return source;
      }
    }).filter((source) => source);
    if (["script-src", "script-src-elem"].includes(directive) && scriptHashes) {
      modifiedSources.push(...scriptHashes);
    }
    if (["style-src", "style-src-elem"].includes(directive) && styleHashes) {
      modifiedSources.push(...styleHashes);
    }
    return [directive, modifiedSources];
  }));
  return generatedCsp;
}

const _LsGREcY9s8486sDSy_EgdTjv8lGWOvmi0trv3REhQE = defineNitroPlugin((nitroApp) => {
  {
    return;
  }
});

const _iEkpmRa6LS3RZgmnkLoL4H_i9o0fyCf5bSAZUEj2BPI = defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("render:response", (response, { event }) => {
    const rules = resolveSecurityRules(event);
    if (rules.enabled && rules.headers) {
      const headers = rules.headers;
      Object.entries(headers).forEach(([header, value]) => {
        const headerName = header === "contentSecurityPolicy" && rules.contentSecurityPolicyReportOnly ? "Content-Security-Policy-Report-Only" : getNameFromKey(header);
        if (value === false) {
          const { headers: standardHeaders } = getRouteRules(event);
          const standardHeaderValue = standardHeaders?.[headerName];
          const currentHeaderValue = getResponseHeader(event, headerName);
          if (standardHeaderValue === currentHeaderValue) {
            removeResponseHeader(event, headerName);
          }
        } else {
          const headerValue = headerStringFromObject(header, value);
          setResponseHeader(event, headerName, headerValue);
        }
      });
    }
  });
});

const _oxIXinWKw2e0bs0Omi22t98VAKfve0BZta0GFrSevmc = defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("beforeResponse", (event) => {
    const rules = resolveSecurityRules(event);
    if (rules.enabled && rules.hidePoweredBy && !event.node.res.headersSent) {
      removeResponseHeader(event, "x-powered-by");
    }
  });
});

const _iHH32830Bbkqtqv78_DnRE4AwWemw6CXiiAIb6ddI8 = defineNitroPlugin(async (nitroApp) => {
  {
    const prerenderedHeaders = await useStorage("assets:nuxt-security").getItem("headers.json") || {};
    nitroApp.hooks.hook("beforeResponse", (event) => {
      const rules = resolveSecurityRules(event);
      if (rules.enabled && rules.ssg && rules.ssg.nitroHeaders) {
        const path = event.path.split("?")[0];
        if (path && prerenderedHeaders[path]) {
          setResponseHeaders(event, prerenderedHeaders[path]);
        }
      }
    });
  }
});

const plugins = [
  _fNJFbxHZYHyLmZA5iKsCBBJIUCo_kbgkT8E5yvymQg,
_ntAOIgCUmACv79YLk_JfIsvP90tmnXAvPszxojXoUw0,
_7gFdX7CIn8rQCaw6HibjOaAjPHeQeIGd67DLeBaQk,
_mbWMKQZ9PqfJMP_S1OQVWVwUH0xxC5nDtAnKNFbbEow,
_cIpli6a2cBX_wXmaKOYcrKTPlsf4S_G3YRsIXLd37K8,
_e2_uCtOAObjRCd8qY6fk6byIEHDGqQC4CCJ78eSNsI,
_GI7S2MygRdxJxtObcrP7iAqQwivDazLV20lUpL8xdfk,
_TWgnecXTJUzQns5cCx8hWIcpLLAGGAjI3HNpWnGl7Y,
_gsHWBkT74rxnHUfxoRXFarCEgllbIuKucJS7UGyv1T8,
_LsGREcY9s8486sDSy_EgdTjv8lGWOvmi0trv3REhQE,
_iEkpmRa6LS3RZgmnkLoL4H_i9o0fyCf5bSAZUEj2BPI,
_oxIXinWKw2e0bs0Omi22t98VAKfve0BZta0GFrSevmc,
_iHH32830Bbkqtqv78_DnRE4AwWemw6CXiiAIb6ddI8
];

const defaultThrowErrorValue = { throwError: true };
const defaultSecurityConfig = (serverlUrl, strict) => {
  const defaultConfig = {
    strict,
    headers: {
      crossOriginResourcePolicy: "same-origin",
      crossOriginOpenerPolicy: "same-origin",
      crossOriginEmbedderPolicy: "credentialless",
      contentSecurityPolicy: {
        "base-uri": ["'none'"],
        "font-src": ["'self'", "https:", "data:"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'self'"],
        "img-src": ["'self'", "data:"],
        "object-src": ["'none'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'", "https:", "'unsafe-inline'"],
        "script-src": ["'self'", "https:", "'unsafe-inline'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
        "upgrade-insecure-requests": true
      },
      originAgentCluster: "?1",
      referrerPolicy: "no-referrer",
      strictTransportSecurity: {
        maxAge: 15552e3,
        includeSubdomains: true
      },
      xContentTypeOptions: "nosniff",
      xDNSPrefetchControl: "off",
      xDownloadOptions: "noopen",
      xFrameOptions: "SAMEORIGIN",
      xPermittedCrossDomainPolicies: "none",
      xXSSProtection: "0",
      permissionsPolicy: {
        camera: [],
        "display-capture": [],
        fullscreen: [],
        geolocation: [],
        microphone: []
      }
    },
    requestSizeLimiter: {
      maxRequestSizeInBytes: 2e6,
      maxUploadFileRequestInBytes: 8e6,
      ...defaultThrowErrorValue
    },
    rateLimiter: {
      // Twitter search rate limiting
      tokensPerInterval: 150,
      interval: 3e5,
      headers: false,
      driver: {
        name: "lruCache"
      },
      whiteList: void 0,
      ipHeader: void 0,
      ...defaultThrowErrorValue
    },
    xssValidator: {
      methods: ["GET", "POST"],
      ...defaultThrowErrorValue
    },
    corsHandler: {
      // Options by CORS middleware for Express https://github.com/expressjs/cors#configuration-options
      origin: serverlUrl,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      preflight: {
        statusCode: 204
      }
    },
    allowedMethodsRestricter: {
      methods: "*",
      ...defaultThrowErrorValue
    },
    hidePoweredBy: true,
    basicAuth: false,
    enabled: true,
    csrf: false,
    nonce: true,
    removeLoggers: true,
    ssg: {
      meta: true,
      hashScripts: true,
      hashStyles: false,
      nitroHeaders: true,
      exportToPresets: true
    },
    sri: true,
    contentSecurityPolicyReportOnly: false
  };
  if (strict) {
    defaultConfig.headers.crossOriginEmbedderPolicy = "require-corp";
    defaultConfig.headers.contentSecurityPolicy = {
      "base-uri": ["'none'"],
      "default-src": ["'none'"],
      "connect-src": ["'self'"],
      "font-src": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'self'"],
      "frame-src": ["'self'"],
      "img-src": ["'self'"],
      "manifest-src": ["'self'"],
      "media-src": ["'self'"],
      "object-src": ["'none'"],
      "script-src-attr": ["'none'"],
      "style-src": ["'self'", "'nonce-{{nonce}}'"],
      "script-src": ["'self'", "'strict-dynamic'", "'nonce-{{nonce}}'"],
      "upgrade-insecure-requests": true,
      "worker-src": ["'self'"]
    };
    defaultConfig.ssg.hashStyles = true;
    defaultConfig.headers.strictTransportSecurity = {
      maxAge: 31536e3,
      includeSubdomains: true,
      preload: true
    }, defaultConfig.headers.xFrameOptions = "DENY";
    defaultConfig.headers.permissionsPolicy = {
      accelerometer: [],
      /* Disable OWASP Experimental values
      'ambient-light-sensor':[],
      */
      autoplay: [],
      /* Disable OWASP Experimental values
      battery:[],
      */
      camera: [],
      "display-capture": [],
      /* Disable OWASP Experimental values
      'document-domain':[],
      */
      "encrypted-media": [],
      fullscreen: [],
      /* Disable OWASP Experimental values
      gamepad:[],
      */
      geolocation: [],
      gyroscope: [],
      /* Disable OWASP Experimental values
      'layout-animations':['self'],
      */
      /* Disable OWASP Experimental values
      'legacy-image-formats':['self'],
      */
      magnetometer: [],
      microphone: [],
      midi: [],
      /* Disable OWASP Experimental values
      'oversized-images':['self'],
      */
      payment: [],
      "picture-in-picture": [],
      "publickey-credentials-get": [],
      "screen-wake-lock": [],
      /* Disable OWASP Experimental values
      'speaker-selection':[],
      */
      "sync-xhr": ["self"],
      /* Disable OWASP Experimental values
      'unoptimized-images':['self'],
      */
      /* Disable OWASP Experimental values
      'unsized-media':['self'],
      */
      usb: [],
      "web-share": [],
      "xr-spatial-tracking": []
    };
  }
  return defaultConfig;
};

function defineRenderHandler(render) {
  const runtimeConfig = useRuntimeConfig();
  return eventHandler(async (event) => {
    const nitroApp = useNitroApp();
    const ctx = { event, render, response: void 0 };
    await nitroApp.hooks.callHook("render:before", ctx);
    if (!ctx.response) {
      if (event.path === `${runtimeConfig.app.baseURL}favicon.ico`) {
        setResponseHeader(event, "Content-Type", "image/x-icon");
        return send(
          event,
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        );
      }
      ctx.response = await ctx.render(event);
      if (!ctx.response) {
        const _currentStatus = getResponseStatus(event);
        setResponseStatus(event, _currentStatus === 200 ? 500 : _currentStatus);
        return send(
          event,
          "No response returned from render handler: " + event.path
        );
      }
    }
    await nitroApp.hooks.callHook("render:response", ctx.response, ctx);
    if (ctx.response.headers) {
      setResponseHeaders(event, ctx.response.headers);
    }
    if (ctx.response.statusCode || ctx.response.statusMessage) {
      setResponseStatus(
        event,
        ctx.response.statusCode,
        ctx.response.statusMessage
      );
    }
    return ctx.response.body;
  });
}

const e=globalThis.process?.env||Object.create(null),t=globalThis.process||{env:e},n=t!==void 0&&t.env&&t.env.NODE_ENV||void 0,r=[[`claude`,[`CLAUDECODE`,`CLAUDE_CODE`]],[`replit`,[`REPL_ID`]],[`gemini`,[`GEMINI_CLI`]],[`codex`,[`CODEX_SANDBOX`,`CODEX_THREAD_ID`]],[`opencode`,[`OPENCODE`]],[`pi`,[i(`PATH`,/\.pi[\\/]agent/)]],[`auggie`,[`AUGMENT_AGENT`]],[`goose`,[`GOOSE_PROVIDER`]],[`junie`,[`JUNIE_DATA`,`JUNIE_SHIM_PATH`]],[`devin`,[i(`EDITOR`,/devin/)]],[`cursor`,[`CURSOR_AGENT`]],[`kiro`,[i(`TERM_PROGRAM`,/kiro/,{noTTY:true})]]];function i(n,r,i){return ()=>{if(i?.noTTY&&t.stdout?.isTTY)return  false;let a=e[n];return a?r.test(a):false}}function a(){let t=e.AI_AGENT;if(t)return {name:t.toLowerCase()};for(let[t,n]of r)for(let r of n)if(typeof r==`string`?e[r]:r())return {name:t};return {}}const o=a();o.name;!!o.name;const l=[[`APPVEYOR`],[`AWS_AMPLIFY`,`AWS_APP_ID`,{ci:true}],[`AZURE_PIPELINES`,`SYSTEM_TEAMFOUNDATIONCOLLECTIONURI`],[`AZURE_STATIC`,`INPUT_AZURE_STATIC_WEB_APPS_API_TOKEN`],[`APPCIRCLE`,`AC_APPCIRCLE`],[`BAMBOO`,`bamboo_planKey`],[`BITBUCKET`,`BITBUCKET_COMMIT`],[`BITRISE`,`BITRISE_IO`],[`BUDDY`,`BUDDY_WORKSPACE_ID`],[`BUILDKITE`],[`CIRCLE`,`CIRCLECI`],[`CIRRUS`,`CIRRUS_CI`],[`CLOUDFLARE_PAGES`,`CF_PAGES`,{ci:true}],[`CLOUDFLARE_WORKERS`,`WORKERS_CI`,{ci:true}],[`GOOGLE_CLOUDRUN`,`K_SERVICE`],[`GOOGLE_CLOUDRUN_JOB`,`CLOUD_RUN_JOB`],[`CODEBUILD`,`CODEBUILD_BUILD_ARN`],[`CODEFRESH`,`CF_BUILD_ID`],[`DRONE`],[`DRONE`,`DRONE_BUILD_EVENT`],[`DSARI`],[`GITHUB_ACTIONS`],[`GITLAB`,`GITLAB_CI`],[`GITLAB`,`CI_MERGE_REQUEST_ID`],[`GOCD`,`GO_PIPELINE_LABEL`],[`LAYERCI`],[`JENKINS`,`JENKINS_URL`],[`HUDSON`,`HUDSON_URL`],[`MAGNUM`],[`NETLIFY`],[`NETLIFY`,`NETLIFY_LOCAL`,{ci:false}],[`NEVERCODE`],[`RENDER`],[`SAIL`,`SAILCI`],[`SEMAPHORE`],[`SCREWDRIVER`],[`SHIPPABLE`],[`SOLANO`,`TDDIUM`],[`STRIDER`],[`TEAMCITY`,`TEAMCITY_VERSION`],[`TRAVIS`],[`VERCEL`,`NOW_BUILDER`],[`VERCEL`,`VERCEL`,{ci:false}],[`VERCEL`,`VERCEL_ENV`,{ci:false}],[`APPCENTER`,`APPCENTER_BUILD_ID`],[`CODESANDBOX`,`CODESANDBOX_SSE`,{ci:false}],[`CODESANDBOX`,`CODESANDBOX_HOST`,{ci:false}],[`STACKBLITZ`],[`STORMKIT`],[`CLEAVR`],[`ZEABUR`],[`CODESPHERE`,`CODESPHERE_APP_ID`,{ci:true}],[`RAILWAY`,`RAILWAY_PROJECT_ID`],[`RAILWAY`,`RAILWAY_SERVICE_ID`],[`DENO-DEPLOY`,`DENO_DEPLOY`],[`DENO-DEPLOY`,`DENO_DEPLOYMENT_ID`],[`FIREBASE_APP_HOSTING`,`FIREBASE_APP_HOSTING`,{ci:true}],[`EDGEONE_PAGES`,`EO_PAGES_CI`,{ci:true}]];function u(){for(let t of l)if(e[t[1]||t[0]])return {name:t[0].toLowerCase(),...t[2]};return e.SHELL===`/bin/jsh`&&t.versions?.webcontainer?{name:`stackblitz`,ci:false}:{name:``,ci:false}}const d=u();d.name;const p=t.platform||``,m=!!e.CI||d.ci!==false,h=!!t.stdout?.isTTY;!!e.DEBUG;const v=n===`test`||!!e.TEST;n===`production`||e.MODE===`production`;const b=n===`dev`||n===`development`||e.MODE===`development`;!!e.MINIMAL||m||v||!h;const S=/^win/i.test(p);!e.NO_COLOR&&(!!e.FORCE_COLOR||(h||S)&&e.TERM!==`dumb`||m);const E=(t.versions?.node||``).replace(/^v/,``)||null;Number(E?.split(`.`)[0])||null;const O=!!t?.versions?.node,k=`Bun`in globalThis,A=`Deno`in globalThis,j=`fastly`in globalThis,M=`Netlify`in globalThis,N=`EdgeRuntime`in globalThis,P=globalThis.navigator?.userAgent===`Cloudflare-Workers`,F=[[M,`netlify`],[N,`edge-light`],[P,`workerd`],[j,`fastly`],[A,`deno`],[k,`bun`],[O,`node`]];function I(){let e=F.find(e=>e[0]);if(e)return {name:e[1]}}const L=I();L?.name||``;

//#region src/runtime/utils/paths.ts
function baseURL() {
	return useRuntimeConfig().app.baseURL;
}
function buildAssetsDir() {
	return useRuntimeConfig().app.buildAssetsDir;
}
function buildAssetsURL(...path) {
	return joinRelativeURL(publicAssetsURL(), buildAssetsDir(), ...path);
}
function publicAssetsURL(...path) {
	const app = useRuntimeConfig().app;
	const publicBase = app.cdnURL || app.baseURL;
	return path.length ? joinRelativeURL(publicBase, ...path) : publicBase;
}

const PROTOCOL_RE = /^https?:\/\//;
const TRAILING_SLASH_RE = /\/$/;
function isLocalhostHost(host) {
  if (!host || host.startsWith("localhost") || host.startsWith("127.") || host.startsWith("0.0.0.0"))
    return true;
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host;
  return hostname === "[::1]" || hostname === "::1" || hostname === "[::]" || hostname === "::";
}
function extractHostname(host) {
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    return close !== -1 ? host.slice(0, close + 1) : host;
  }
  const colonCount = host.split(":").length - 1;
  return colonCount === 1 ? host.slice(0, host.indexOf(":")) : host;
}
function splitHostPort(host) {
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    const hostname = close !== -1 ? host.slice(0, close + 1) : host;
    const port = close !== -1 && host[close + 1] === ":" ? host.slice(close + 2) : "";
    const normalized = hostname === "[::1]" || hostname === "[::]" ? "localhost" : hostname;
    return { host: normalized, port };
  }
  if (host === "0.0.0.0" || host.startsWith("0.0.0.0:")) {
    const i = host.indexOf(":");
    return { host: "localhost", port: i !== -1 ? host.slice(i + 1) : "" };
  }
  const colonCount = host.split(":").length - 1;
  if (colonCount === 1) {
    const i = host.indexOf(":");
    return { host: host.slice(0, i), port: host.slice(i + 1) };
  }
  if (colonCount > 1) {
    const normalized = host === "::1" || host === "::" ? "localhost" : `[${host}]`;
    return { host: normalized, port: "" };
  }
  return { host, port: "" };
}
function getNitroOrigin$1(ctx = {}) {
  const isDev = ctx.isDev ?? b;
  const isPrerender = ctx.isPrerender ?? false;
  let host = "";
  let port = "";
  let protocol = process.env.NITRO_SSL_CERT && process.env.NITRO_SSL_KEY ? "https" : "http";
  if (isDev || isPrerender) {
    const devEnv = process.env.__NUXT_DEV__ || process.env.NUXT_VITE_NODE_OPTIONS;
    if (devEnv) {
      const parsed = JSON.parse(devEnv);
      const origin = parsed.proxy?.url || parsed.baseURL?.replace("/__nuxt_vite_node__", "");
      host = origin.replace(PROTOCOL_RE, "").replace(TRAILING_SLASH_RE, "");
      protocol = origin.startsWith("https") ? "https" : "http";
    }
  }
  if (isDev && isLocalhostHost(host) && ctx.requestHost) {
    const reqHost = extractHostname(ctx.requestHost);
    if (reqHost && !isLocalhostHost(reqHost)) {
      host = ctx.requestHost;
      protocol = ctx.requestProtocol || protocol;
    }
  }
  if (!host && ctx.requestHost) {
    host = ctx.requestHost;
    protocol = ctx.requestProtocol || protocol;
  }
  if (!host) {
    host = process.env.NITRO_HOST || process.env.HOST || "";
    if (isDev)
      port = process.env.NITRO_PORT || process.env.PORT || "3000";
  }
  const split = splitHostPort(host);
  host = split.host;
  if (split.port)
    port = split.port;
  host = process.env.NUXT_SITE_HOST_OVERRIDE || host;
  port = process.env.NUXT_SITE_PORT_OVERRIDE || port;
  if (host.startsWith("http://") || host.startsWith("https://")) {
    protocol = host.startsWith("https://") ? "https" : "http";
    host = host.replace(PROTOCOL_RE, "");
  } else if (!isDev && (!host || !isLocalhostHost(host))) {
    protocol = "https";
  }
  return `${protocol}://${host}${port ? `:${port}` : ""}/`;
}

function getNitroOrigin(e) {
  return getNitroOrigin$1({
    isDev: false,
    isPrerender: false,
    requestHost: e ? getRequestHost(e, { xForwardedHost: true }) : void 0,
    requestProtocol: e ? getRequestProtocol(e, { xForwardedProto: true }) : void 0
  });
}

function getSiteIndexable(e) {
  const { env, indexable } = getSiteConfig(e);
  if (typeof indexable !== "undefined")
    return String(indexable) === "true";
  return env === "production";
}

const FILE_EXT_RE = /\.[0-9a-z]+$/i;
function resolveSitePath(pathOrUrl, options) {
  let path = pathOrUrl;
  if (hasProtocol(pathOrUrl, { strict: false, acceptRelative: true })) {
    const parsed = parseURL(pathOrUrl);
    path = parsed.pathname;
  }
  const base = withLeadingSlash(options.base || "/");
  if (base !== "/" && path.startsWith(base)) {
    path = path.slice(base.length);
  }
  let origin = withoutTrailingSlash(options.absolute ? options.siteUrl : "");
  if (base !== "/" && origin.endsWith(base)) {
    origin = origin.slice(0, origin.indexOf(base));
  }
  const baseWithOrigin = options.withBase ? withBase(base, origin || "/") : origin;
  const resolvedUrl = withBase(path, baseWithOrigin);
  return path === "/" && !options.withBase ? withTrailingSlash(resolvedUrl) : fixSlashes(options.trailingSlash, resolvedUrl);
}
const fileExtensions = [
  // Images
  "jpg",
  "jpeg",
  "png",
  "gif",
  "bmp",
  "webp",
  "svg",
  "ico",
  // Documents
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
  // Archives
  "zip",
  "rar",
  "7z",
  "tar",
  "gz",
  // Audio
  "mp3",
  "wav",
  "flac",
  "ogg",
  "opus",
  "m4a",
  "aac",
  "midi",
  "mid",
  // Video
  "mp4",
  "avi",
  "mkv",
  "mov",
  "wmv",
  "flv",
  "webm",
  // Web
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
  // Programming
  "php",
  "py",
  "rb",
  "java",
  "c",
  "cpp",
  "h",
  "go",
  // Data formats
  "csv",
  "tsv",
  "sql",
  "yaml",
  "yml",
  // Fonts
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  // Executables/Binaries
  "exe",
  "msi",
  "apk",
  "ipa",
  "dmg",
  "iso",
  "bin",
  // Scripts/Config
  "bat",
  "cmd",
  "sh",
  "env",
  "htaccess",
  "conf",
  "toml",
  "ini",
  // Package formats
  "deb",
  "rpm",
  "jar",
  "war",
  // E-books
  "epub",
  "mobi",
  // Common temporary/backup files
  "log",
  "tmp",
  "bak",
  "old",
  "sav"
];
function isPathFile(path) {
  const lastSegment = path.split("/").pop();
  const ext = (lastSegment || path).match(FILE_EXT_RE)?.[0];
  return !!(ext && fileExtensions.includes(ext.replace(".", "")));
}
function fixSlashes(trailingSlash, pathOrUrl) {
  const $url = parseURL(pathOrUrl);
  if (isPathFile($url.pathname))
    return pathOrUrl;
  const fixedPath = trailingSlash ? withTrailingSlash($url.pathname) : withoutTrailingSlash($url.pathname);
  return `${$url.protocol ? `${$url.protocol}//` : ""}${$url.host || ""}${fixedPath}${$url.search || ""}${$url.hash || ""}`;
}

function createSitePathResolver(e, options = {}) {
  const siteConfig = getSiteConfig(e);
  const nitroOrigin = getNitroOrigin(e);
  const nuxtBase = useRuntimeConfig(e).app.baseURL || "/";
  return (path) => {
    return resolveSitePath(path, {
      ...options,
      siteUrl: options.canonical !== false || false ? siteConfig.url : nitroOrigin,
      trailingSlash: siteConfig.trailingSlash,
      base: nuxtBase
    });
  };
}
function withSiteUrl(e, path, options = {}) {
  const siteConfig = e.context.siteConfig?.get();
  let siteUrl = e.context.siteConfigNitroOrigin;
  if ((options.canonical !== false || false) && siteConfig.url)
    siteUrl = siteConfig.url;
  return resolveSitePath(path, {
    absolute: true,
    siteUrl,
    trailingSlash: siteConfig.trailingSlash,
    base: e.context.nitro.baseURL,
    withBase: options.withBase
  });
}

function isUnlocalizedLocalePage(page) {
  return page._tag === "unlocalized" && typeof page.path === "string";
}
function matchesUnlocalizedLocalePage(page, path) {
  if (matchPagePattern(page.path, path))
    return true;
  if (!page.subtree)
    return false;
  const subtreePattern = `${page.path === "/" ? "" : page.path.replace(/\/$/, "")}/[...__nuxtSeoSubtree]`;
  return !!matchPagePattern(subtreePattern, path);
}
function normalizeHost(value) {
  const input = value.trim();
  return parseURL(input.startsWith("//") ? `https:${input}` : input.includes("://") ? input : `https://${input}`).host?.toLowerCase() || "";
}
function localeDomains(locale) {
  return [...locale.domains || [], ...locale.domain ? [locale.domain] : []];
}
function resolveI18nDomain(host, i18n) {
  const normalizedHost = host ? normalizeHost(host) : "";
  const domains = i18n.locales.map((locale) => ({
    locale,
    hosts: localeDomains(locale).map(normalizeHost),
    defaults: locale.defaultForDomains?.map(normalizeHost) || []
  }));
  const matches = normalizedHost ? domains.filter((entry) => entry.hosts.includes(normalizedHost) || entry.defaults.includes(normalizedHost)) : [];
  if (!matches.length)
    return { _tag: "unknown", defaultLocale: i18n.defaultLocale, locales: i18n.locales };
  const defaultLocale = matches.find((entry) => entry.defaults.includes(normalizedHost))?.locale || (matches.length === 1 ? matches[0].locale : void 0);
  return {
    _tag: "known",
    defaultLocale: defaultLocale?.code || i18n.defaultLocale,
    locales: domains.filter((entry) => !entry.hosts.length || entry.hosts.includes(normalizedHost)).map((entry) => entry.locale)
  };
}
function firstLocaleDomain(locale) {
  return locale?.defaultForDomains?.[0] || locale?.domain || locale?.domains?.[0];
}
function resolveCanonicalLocaleDomain(locale, defaultLocale) {
  return firstLocaleDomain(locale) || firstLocaleDomain(defaultLocale);
}
function splitRouteSuffix(route) {
  const suffixIndex = route.search(/[?#]/);
  const rawPathname = suffixIndex === -1 ? route : route.slice(0, suffixIndex);
  return {
    pathname: rawPathname ? rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}` : "/",
    suffix: suffixIndex === -1 ? "" : route.slice(suffixIndex)
  };
}
function resolveLocaleFromRoute(route, i18n, context = {}) {
  const { pathname, suffix } = splitRouteSuffix(route);
  if (i18n.strategy !== "no_prefix") {
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0];
    const matched = first ? i18n.locales.find((l) => l.code === first) : void 0;
    if (matched) {
      const rest = segments.slice(1).join("/");
      const trailingSlash = rest && pathname.endsWith("/") ? "/" : "";
      return { locale: matched.code, basePath: `${rest ? `/${rest}${trailingSlash}` : "/"}${suffix}` };
    }
  }
  const contextLocale = context.locale ? i18n.locales.find((locale) => locale.code === context.locale) : void 0;
  const domain = resolveI18nDomain(context.host, i18n);
  const hostLocales = domain._tag === "known" ? domain.locales.filter((locale) => [...localeDomains(locale), ...locale.defaultForDomains || []].some((host) => normalizeHost(host) === normalizeHost(context.host))) : [];
  const hostLocale = hostLocales.find((locale) => locale.code === domain.defaultLocale) || hostLocales[0];
  return { locale: contextLocale?.code || hostLocale?.code || domain.defaultLocale, basePath: `${pathname}${suffix}` };
}
function localePath(basePath, locale, i18n, context = {}) {
  const { pathname, suffix } = splitRouteSuffix(basePath);
  if (i18n.strategy === "no_prefix")
    return `${pathname}${suffix}`;
  const domain = resolveI18nDomain(context.host, i18n);
  const isDefault = locale === domain.defaultLocale;
  const isDomainDefault = i18n.differentDomains || domain._tag === "known" && isDefault;
  if (i18n.strategy === "prefix_except_default" && (isDefault || i18n.differentDomains))
    return `${pathname}${suffix}`;
  if (i18n.strategy === "prefix_and_default" && isDomainDefault)
    return `${pathname}${suffix}`;
  if (pathname === "/")
    return `/${locale}${suffix}`;
  return `/${locale}${pathname}${suffix}`;
}
function toSegments(path) {
  return path.split("/").filter(Boolean);
}
const PAGE_PARAM_PATTERN = /\[\[(\.\.\.)?([^[\]]+)\]\]|\[(\.\.\.)?([^[\]]+)\]|:(\w+)(?:\((\.\*)?\))?([?*+]?)/g;
function parsePageSegment(segment) {
  const tokens = [];
  let offset = 0;
  for (const match of segment.matchAll(PAGE_PARAM_PATTERN)) {
    const index = match.index;
    if (index > offset)
      tokens.push({ _tag: "static", value: segment.slice(offset, index) });
    if (match[2]) {
      tokens.push({ _tag: "param", param: { name: match[2], catchAll: !!match[1], optional: true } });
    } else if (match[4]) {
      tokens.push({ _tag: "param", param: { name: match[4], catchAll: !!match[3], optional: false } });
    } else {
      const modifier = match[7];
      const routePattern = match[6];
      tokens.push({
        _tag: "param",
        param: {
          name: match[5],
          catchAll: !!routePattern?.includes(".*") || modifier === "*" || modifier === "+",
          optional: modifier === "?" || modifier === "*"
        }
      });
    }
    offset = index + match[0].length;
  }
  if (offset < segment.length)
    tokens.push({ _tag: "static", value: segment.slice(offset) });
  return tokens.length ? tokens : [{ _tag: "static", value: segment }];
}
function wholeSegmentParam(tokens) {
  return tokens.length === 1 && tokens[0]?._tag === "param" ? tokens[0].param : null;
}
function segmentRanks(pattern) {
  return toSegments(pattern).map((segment) => {
    const tokens = parsePageSegment(segment);
    const params = tokens.filter((token) => token._tag === "param");
    if (!params.length)
      return 6;
    const hasStatic = tokens.some((token) => token._tag === "static");
    if (hasStatic)
      return params.some((token) => token.param.optional) ? 3 : 4;
    const param = params[0].param;
    if (param.catchAll)
      return param.optional ? -1 : 0;
    return param.optional ? 1 : 2;
  });
}
function compareSpecificity(a, b) {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = b[i] - a[i];
    if (diff !== 0)
      return diff;
  }
  return a.length - b.length;
}
function matchSegmentTokens(tokens, path) {
  const failedStates = /* @__PURE__ */ new Set();
  function visit(index, offset, params) {
    const state = index * (path.length + 1) + offset;
    if (failedStates.has(state))
      return null;
    if (index === tokens.length) {
      if (offset === path.length)
        return params;
      failedStates.add(state);
      return null;
    }
    const token = tokens[index];
    if (token._tag === "static") {
      const matched = path.startsWith(token.value, offset) ? visit(index + 1, offset + token.value.length, params) : null;
      if (!matched)
        failedStates.add(state);
      return matched;
    }
    const minimumEnd = token.param.optional ? offset : offset + 1;
    for (let end = minimumEnd; end <= path.length; end++) {
      const value = path.slice(offset, end);
      const nextParams = value ? { ...params, [token.param.name]: value } : params;
      const matched = visit(index + 1, end, nextParams);
      if (matched)
        return matched;
    }
    failedStates.add(state);
    return null;
  }
  return visit(0, 0, {});
}
function matchPagePattern(pattern, path) {
  const patternSegments = toSegments(pattern);
  const pathSegments = toSegments(path);
  const failedStates = /* @__PURE__ */ new Set();
  function visit(patternIndex, pathIndex, params) {
    const state = patternIndex * (pathSegments.length + 1) + pathIndex;
    if (failedStates.has(state))
      return null;
    if (patternIndex === patternSegments.length) {
      if (pathIndex === pathSegments.length)
        return params;
      failedStates.add(state);
      return null;
    }
    const tokens = parsePageSegment(patternSegments[patternIndex]);
    const param = wholeSegmentParam(tokens);
    if (param?.catchAll) {
      const minimumEnd = param.optional ? pathIndex : pathIndex + 1;
      for (let end = pathSegments.length; end >= minimumEnd; end--) {
        const value = pathSegments.slice(pathIndex, end).join("/");
        const nextParams = value ? { ...params, [param.name]: value } : params;
        const matched2 = visit(patternIndex + 1, end, nextParams);
        if (matched2)
          return matched2;
      }
      failedStates.add(state);
      return null;
    }
    const segment = pathSegments[pathIndex];
    if (segment !== void 0) {
      const segmentParams = matchSegmentTokens(tokens, segment);
      if (segmentParams) {
        const matched2 = visit(patternIndex + 1, pathIndex + 1, { ...params, ...segmentParams });
        if (matched2)
          return matched2;
      }
    }
    const matched = param?.optional ? visit(patternIndex + 1, pathIndex, params) : null;
    if (!matched)
      failedStates.add(state);
    return matched;
  }
  return visit(0, 0, {});
}
function fillPagePattern(pattern, params) {
  const filled = [];
  for (const segment of toSegments(pattern)) {
    const tokens = parsePageSegment(segment);
    let value = "";
    for (const token of tokens) {
      if (token._tag === "static") {
        value += token.value;
        continue;
      }
      const paramValue = params[token.param.name];
      if (paramValue === void 0) {
        if (token.param.optional)
          continue;
        return null;
      }
      value += paramValue;
    }
    if (value)
      filled.push(value);
  }
  if (!filled.length)
    return "/";
  return `/${filled.join("/")}${pattern.endsWith("/") ? "/" : ""}`;
}
function alternatesForEntry(localePaths, params, i18n, context) {
  const untranslated = localePaths[i18n.defaultLocale];
  const alternates = [];
  const defaultLocale = i18n.locales.find((locale) => locale.code === i18n.defaultLocale);
  const locales = context.domainMode === "request" ? resolveI18nDomain(context.host, i18n).locales : i18n.locales;
  for (const l of locales) {
    const pattern = localePaths[l.code] ?? untranslated;
    if (localePaths[l.code] === false)
      continue;
    if (typeof pattern !== "string")
      continue;
    const path = fillPagePattern(pattern, params);
    if (path === null)
      continue;
    const domain = context.domainMode === "request" ? void 0 : resolveCanonicalLocaleDomain(l, defaultLocale);
    alternates.push({
      code: l.code,
      hreflang: l.hreflang || l.code,
      path: localePath(path, l.code, i18n, { host: domain || context.host }),
      ...domain ? { domain } : {}
    });
  }
  return alternates;
}
function alternatesFromPages(basePath, routePath, locale, i18n, context) {
  const pages = i18n.pages;
  const hasDomainLocales = i18n.differentDomains || i18n.multiDomainLocales;
  const hasContextLocale = !!context.locale && i18n.locales.some((locale2) => locale2.code === context.locale);
  if (!pages)
    return null;
  const allowLocalized = i18n.strategy !== "no_prefix" || hasDomainLocales || hasContextLocale;
  const matches = [];
  for (const page of Object.values(pages)) {
    if (!page)
      continue;
    if (isUnlocalizedLocalePage(page)) {
      if (matchesUnlocalizedLocalePage(page, routePath))
        matches.push({ _tag: "unlocalized", ranks: segmentRanks(page.path) });
      continue;
    }
    if (!allowLocalized)
      continue;
    const pattern = page[locale];
    if (!pattern)
      continue;
    const params = matchPagePattern(pattern, basePath);
    if (params)
      matches.push({ _tag: "localized", ranks: segmentRanks(pattern), localePaths: page, params });
  }
  matches.sort((a, b) => compareSpecificity(a.ranks, b.ranks));
  for (const match of matches) {
    if (match._tag === "unlocalized") {
      const defaultCode = context.domainMode === "request" ? resolveI18nDomain(context.host, i18n).defaultLocale : i18n.defaultLocale;
      const defaultLocale = i18n.locales.find((locale2) => locale2.code === defaultCode);
      if (defaultLocale) {
        const domain = context.domainMode === "request" ? void 0 : resolveCanonicalLocaleDomain(defaultLocale);
        return [{
          code: defaultLocale.code,
          hreflang: defaultLocale.hreflang || defaultLocale.code,
          path: routePath,
          ...domain ? { domain } : {}
        }];
      }
      continue;
    }
    return alternatesForEntry(match.localePaths, match.params, i18n, context);
  }
  return null;
}
function resolveLocaleAlternates(route, i18n, context = {}) {
  const { locale, basePath } = resolveLocaleFromRoute(route, i18n, context);
  const { pathname, suffix } = splitRouteSuffix(basePath);
  const { pathname: routePathname } = splitRouteSuffix(route);
  const translated = alternatesFromPages(pathname, routePathname, locale, i18n, context);
  if (translated) {
    return {
      _tag: "pages",
      alternates: translated.map((alternate) => ({ ...alternate, path: `${alternate.path}${suffix}` }))
    };
  }
  const defaultLocale = i18n.locales.find((locale2) => locale2.code === i18n.defaultLocale);
  return {
    _tag: "strategy",
    alternates: (context.domainMode === "request" ? resolveI18nDomain(context.host, i18n).locales : i18n.locales).map((l) => {
      const domain = context.domainMode === "request" ? void 0 : resolveCanonicalLocaleDomain(l, defaultLocale);
      return {
        code: l.code,
        hreflang: l.hreflang || l.code,
        path: localePath(basePath, l.code, i18n, { host: domain || context.host }),
        ...domain ? { domain } : {}
      };
    })
  };
}
function computeLocaleAlternates(route, i18n, context = {}) {
  return resolveLocaleAlternates(route, i18n, context).alternates;
}

function getSiteRobotConfig(e) {
  const query = getQuery(e);
  const hints = [];
  const { groups, debug } = useRuntimeConfigNuxtRobots(e);
  let indexable = getSiteIndexable(e);
  const queryIndexableEnabled = String(query.mockProductionEnv) === "true" || query.mockProductionEnv === "";
  if (debug || false) {
    const { _context } = getSiteConfig(e, { debug: debug || false });
    if (queryIndexableEnabled) {
      indexable = true;
      hints.push("You are mocking a production enviroment with ?mockProductionEnv query.");
    } else if (!indexable && _context.indexable === "nuxt-robots:config") {
      hints.push("You are blocking indexing with your Nuxt Robots config.");
    } else if (!queryIndexableEnabled && !_context.indexable) {
      hints.push(`Indexing is blocked in development. You can mock a production environment with ?mockProductionEnv query.`);
    } else if (!indexable && !queryIndexableEnabled) {
      hints.push(`Indexing is blocked by site config set by ${_context.indexable}.`);
    } else if (indexable && !queryIndexableEnabled) {
      hints.push(`Indexing is enabled from ${_context.indexable}.`);
    }
  }
  if (groups.some((g) => g.userAgent.includes("*") && g.disallow.includes("/"))) {
    indexable = false;
    hints.push("You are blocking all user agents with a wildcard `Disallow /`.");
  } else if (groups.some((g) => g.disallow.includes("/"))) {
    hints.push("You are blocking specific user agents with `Disallow /`.");
  }
  return { indexable, hints };
}

const i18nStrategies = /* @__PURE__ */ new Set(["no_prefix", "prefix_except_default", "prefix", "prefix_and_default"]);
function parseRuntimeI18nConfig(input) {
  if (!input || typeof input !== "object")
    return null;
  const config = input;
  if (!Array.isArray(config.locales))
    return null;
  const locales = config.locales.flatMap((locale) => {
    const code = typeof locale === "string" ? locale : locale && typeof locale === "object" && typeof locale.code === "string" ? locale.code : null;
    return code ? [{ code, hreflang: code }] : [];
  });
  if (!locales.length)
    return null;
  const defaultLocale = typeof config.defaultLocale === "string" ? config.defaultLocale : locales[0].code;
  const strategy = typeof config.strategy === "string" && i18nStrategies.has(config.strategy) ? config.strategy : "prefix";
  return { defaultLocale, locales, strategy };
}
function getPathRobotConfig(e, options) {
  const runtimeConfig = useRuntimeConfig(e);
  const { robotsDisabledValue, robotsEnabledValue, isNuxtContentV2 } = useRuntimeConfigNuxtRobots(e);
  if (!options?.skipSiteIndexable) {
    if (!getSiteRobotConfig(e).indexable) {
      return {
        rule: robotsDisabledValue,
        indexable: false,
        debug: {
          source: "Site Config"
        }
      };
    }
  }
  const path = options?.path || e.path;
  let userAgent = options?.userAgent;
  if (!userAgent) {
    try {
      userAgent = getRequestHeader(e, "User-Agent");
    } catch {
    }
  }
  const nitroApp = useNitroApp();
  const groups = [
    // run explicit user agent matching first
    ...nitroApp._robots.ctx.groups.filter((g) => {
      if (userAgent) {
        return g.userAgent.some((ua) => !!ua && userAgent.toLowerCase().includes(ua.toLowerCase()));
      }
      return false;
    }),
    // run wildcard matches second
    ...nitroApp._robots.ctx.groups.filter((g) => g.userAgent.includes("*"))
  ];
  for (const group of groups) {
    if (!options?.skipSiteIndexable && group._indexable === false) {
      return {
        indexable: false,
        rule: robotsDisabledValue,
        debug: {
          source: "/robots.txt",
          line: JSON.stringify(group)
        }
      };
    }
    const rules = options?.skipSiteIndexable ? (group._rules || []).filter((r) => r.pattern !== "/") : group._rules || [];
    const robotsTxtRule = matchPathToRule(path, rules);
    if (robotsTxtRule) {
      if (!robotsTxtRule.allow) {
        return {
          indexable: false,
          rule: robotsDisabledValue,
          debug: {
            source: "/robots.txt",
            line: `Disallow: ${robotsTxtRule.pattern}`
          }
        };
      }
      break;
    }
  }
  if (isNuxtContentV2 && nitroApp._robots?.nuxtContentUrls?.has(withoutTrailingSlash(path))) {
    return {
      indexable: false,
      rule: robotsDisabledValue,
      debug: {
        source: "Nuxt Content"
      }
    };
  }
  const { pageMetaRobots } = useRuntimeConfigNuxtRobots(e);
  const pageMetaRule = pageMetaRobots?.[withoutTrailingSlash(path)];
  if (typeof pageMetaRule !== "undefined") {
    const normalised = normaliseRobotsRouteRule({ robots: pageMetaRule });
    if (normalised && (typeof normalised.allow !== "undefined" || typeof normalised.rule !== "undefined")) {
      return {
        indexable: normalised.allow ?? false,
        rule: normalised.rule || (normalised.allow ? robotsEnabledValue : robotsDisabledValue),
        debug: {
          source: "Page Meta"
        }
      };
    }
  }
  nitroApp._robotsRuleMatcher = nitroApp._robotsRuleMatcher || createNitroRouteRuleMatcher(runtimeConfig);
  let robotRouteRules = nitroApp._robotsRuleMatcher(path);
  let routeRulesPath = path;
  const i18nConfig = parseRuntimeI18nConfig(runtimeConfig.public?.i18n);
  if (i18nConfig && typeof robotRouteRules.robots === "undefined") {
    const resolvedRoute = resolveLocaleFromRoute(routeRulesPath, i18nConfig);
    if (resolvedRoute.basePath !== routeRulesPath) {
      routeRulesPath = resolvedRoute.basePath;
      robotRouteRules = nitroApp._robotsRuleMatcher(routeRulesPath);
    }
  }
  const routeRules = normaliseRobotsRouteRule(robotRouteRules);
  if (routeRules && (typeof routeRules.allow !== "undefined" || typeof routeRules.rule !== "undefined")) {
    return {
      indexable: routeRules.allow ?? false,
      rule: routeRules.rule || (routeRules.allow ? robotsEnabledValue : robotsDisabledValue),
      debug: {
        source: "Route Rules"
      }
    };
  }
  return {
    indexable: true,
    rule: robotsEnabledValue
  };
}

const FORMATION_CYCLE = ["442", "433", "451", "352", "343", "541", "532"];
const OBJECTIVE_KINDS = ["exact", "over", "under", "allUnder"];
const OVER_VALUES = [350, 400, 450];
const UNDER_VALUES = [180, 220, 260];
const ALL_UNDER_VALUES = [40, 50, 60];
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
function dayIndexForDate(date) {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    throw new Error(`Invalid date: ${date}`);
  }
  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 864e5);
}
function hashSeed(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function mulberry32(seed) {
  let state = seed;
  return () => {
    state = state + 1831565813 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seededInt(seedText, max) {
  return Math.floor(mulberry32(hashSeed(seedText))() * max);
}
function seededShuffle(items, seedText) {
  const rng = mulberry32(hashSeed(seedText));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function pickDeterministicItem(seedText, pool, excludeIds) {
  const available = pool.filter((item) => !excludeIds.has(item.id));
  if (available.length === 0) {
    return void 0;
  }
  return available[seededInt(seedText, available.length)];
}
function getDailyFormationCode(date) {
  return FORMATION_CYCLE[dayIndexForDate(date) % FORMATION_CYCLE.length];
}
function objectiveLabel(kind, value) {
  switch (kind) {
    case "exact":
      return `Land the total exactly on ${value}`;
    case "over":
      return `Score over ${value}`;
    case "under":
      return `Stay under ${value}`;
    case "allUnder":
      return `Keep every player under ${value}`;
  }
}
function objectiveValueOptions(kind) {
  switch (kind) {
    case "over":
      return OVER_VALUES;
    case "under":
      return UNDER_VALUES;
    case "allUnder":
      return ALL_UNDER_VALUES;
    case "exact":
      return [];
  }
}
function buildObjective(kind, formationCode, value) {
  if (kind === "exact") {
    const target = Number(formationCode);
    return { kind, value: target, label: objectiveLabel(kind, target) };
  }
  if (value === void 0 || !objectiveValueOptions(kind).includes(value)) {
    return null;
  }
  return { kind, value, label: objectiveLabel(kind, value) };
}
function getDailyObjective(date) {
  const dayIndex = dayIndexForDate(date);
  const kind = OBJECTIVE_KINDS[dayIndex % OBJECTIVE_KINDS.length];
  const values = objectiveValueOptions(kind);
  const value = values.length > 0 ? values[dayIndex % values.length] : void 0;
  return buildObjective(kind, getDailyFormationCode(date), value);
}
function getDailyPrefilledSlotIds(date, formation) {
  const dayIndex = dayIndexForDate(date);
  const count = 2 + dayIndex % 2;
  const eligible = formation.slots.filter((slot) => slot.group !== "GK").map((slot) => slot.id);
  return seededShuffle(eligible, `${date}:prefill`).slice(0, count);
}

const playersData = [
	{
		id: "barry",
		name: "Barry",
		position: "MID",
		goals: 3,
		assists: 3,
		appearances: 58,
		clubs: [
			"Everton",
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "carrick",
		name: "Carrick",
		position: "MID",
		goals: 0,
		assists: 0,
		appearances: 25,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "o-shea",
		name: "O'Shea",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 28,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "crouch",
		name: "Crouch",
		position: "FWD",
		goals: 12,
		assists: 6,
		appearances: 64,
		clubs: [
			"Stoke",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "grant",
		name: "Grant",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 31,
		clubs: [
			"Stoke",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "jagielka",
		name: "Jagielka",
		position: "DEF",
		goals: 4,
		assists: 3,
		appearances: 75,
		clubs: [
			"Everton",
			"Sheffield Utd"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "delaney",
		name: "Delaney",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 32,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "defoe",
		name: "Defoe",
		position: "FWD",
		goals: 19,
		assists: 5,
		appearances: 65,
		clubs: [
			"Sunderland",
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "collins",
		name: "Collins",
		position: "DEF",
		goals: 3,
		assists: 0,
		appearances: 35,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "johnson",
		name: "Johnson",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 32,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "foster",
		name: "Foster",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 177,
		clubs: [
			"West Brom",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "ibrahimovic",
		name: "Ibrahimovic",
		position: "FWD",
		goals: 17,
		assists: 7,
		appearances: 33,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "cech",
		name: "Cech",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 76,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "bruno",
		name: "Bruno",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 39,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "jones",
		name: "Jones",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 27,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "routledge",
		name: "Routledge",
		position: "MID",
		goals: 3,
		assists: 2,
		appearances: 42,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "downing",
		name: "Downing",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 30,
		clubs: [
			"Middlesbrough"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "whelan",
		name: "Whelan",
		position: "MID",
		goals: 0,
		assists: 1,
		appearances: 30,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "huth",
		name: "Huth",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 33,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "valdes",
		name: "Valdés",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Middlesbrough"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "baines",
		name: "Baines",
		position: "DEF",
		goals: 4,
		assists: 9,
		appearances: 68,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "walters",
		name: "Walters",
		position: "MID",
		goals: 4,
		assists: 3,
		appearances: 26,
		clubs: [
			"Stoke",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "rooney",
		name: "Rooney",
		position: "FWD",
		goals: 15,
		assists: 8,
		appearances: 56,
		clubs: [
			"Man Utd",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "king",
		name: "King",
		position: "MID",
		goals: 4,
		assists: 1,
		appearances: 45,
		clubs: [
			"Leicester",
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "fletcher",
		name: "Fletcher",
		position: "MID",
		goals: 3,
		assists: 4,
		appearances: 65,
		clubs: [
			"West Brom",
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "yaya-toure",
		name: "Yaya Touré",
		position: "MID",
		goals: 5,
		assists: 2,
		appearances: 35,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "ronaldo",
		name: "Ronaldo",
		position: "FWD",
		goals: 19,
		assists: 3,
		appearances: 30,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2021,
		lastSeason: 2022
	},
	{
		id: "morgan",
		name: "Morgan",
		position: "DEF",
		goals: 4,
		assists: 1,
		appearances: 95,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "huddlestone",
		name: "Huddlestone",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 31,
		clubs: [
			"Hull City"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "francis",
		name: "Francis",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 98,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "milner",
		name: "Milner",
		position: "MID",
		goals: 15,
		assists: 21,
		appearances: 195,
		clubs: [
			"Liverpool",
			"Brighton"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "surman",
		name: "Surman",
		position: "MID",
		goals: 2,
		assists: 6,
		appearances: 70,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "hart",
		name: "Hart",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 38,
		clubs: [
			"Man City",
			"West Ham",
			"Burnley",
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "clichy",
		name: "Clichy",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 25,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "davis",
		name: "Davis",
		position: "MID",
		goals: 3,
		assists: 6,
		appearances: 58,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "lennon",
		name: "Lennon",
		position: "MID",
		goals: 3,
		assists: 7,
		appearances: 100,
		clubs: [
			"Everton",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "kompany",
		name: "Kompany",
		position: "DEF",
		goals: 5,
		assists: 1,
		appearances: 45,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "schmeichel",
		name: "Schmeichel",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 214,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "tarkowski",
		name: "Tarkowski",
		position: "DEF",
		goals: 12,
		assists: 14,
		appearances: 327,
		clubs: [
			"Burnley",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "fabregas",
		name: "Fàbregas",
		position: "MID",
		goals: 7,
		assists: 19,
		appearances: 67,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "bardsley",
		name: "Bardsley",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 72,
		clubs: [
			"Stoke",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "morrison",
		name: "Morrison",
		position: "MID",
		goals: 6,
		assists: 2,
		appearances: 35,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "noble",
		name: "Noble",
		position: "MID",
		goals: 17,
		assists: 9,
		appearances: 155,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "costa",
		name: "Costa",
		position: "FWD",
		goals: 21,
		assists: 11,
		appearances: 46,
		clubs: [
			"Chelsea",
			"Wolves"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "gomes",
		name: "Gomes",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 62,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "tettey",
		name: "Tettey",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 30,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2019
	},
	{
		id: "boruc",
		name: "Boruc",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 47,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "sharp",
		name: "Sharp",
		position: "FWD",
		goals: 6,
		assists: 2,
		appearances: 41,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "young",
		name: "Young",
		position: "DEF",
		goals: 6,
		assists: 17,
		appearances: 170,
		clubs: [
			"Man Utd",
			"Aston Villa",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "snodgrass",
		name: "Snodgrass",
		position: "MID",
		goals: 14,
		assists: 16,
		appearances: 103,
		clubs: [
			"West Ham",
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "davies",
		name: "Davies",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 26,
		clubs: [
			"Hull City"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "brunt",
		name: "Brunt",
		position: "DEF",
		goals: 3,
		assists: 12,
		appearances: 57,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "williams",
		name: "Williams",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 60,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "dann",
		name: "Dann",
		position: "DEF",
		goals: 5,
		assists: 4,
		appearances: 81,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "puncheon",
		name: "Puncheon",
		position: "MID",
		goals: 0,
		assists: 6,
		appearances: 57,
		clubs: [
			"Crystal Palace",
			"Huddersfield"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "mcauley",
		name: "McAuley",
		position: "DEF",
		goals: 6,
		assists: 1,
		appearances: 45,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "cahill",
		name: "Cahill",
		position: "DEF",
		goals: 7,
		assists: 2,
		appearances: 111,
		clubs: [
			"Chelsea",
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "bamba",
		name: "Bamba",
		position: "DEF",
		goals: 4,
		assists: 1,
		appearances: 28,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "moutinho",
		name: "Moutinho",
		position: "MID",
		goals: 5,
		assists: 19,
		appearances: 154,
		clubs: [
			"Wolves"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "llorente",
		name: "Llorente",
		position: "FWD",
		goals: 17,
		assists: 7,
		appearances: 69,
		clubs: [
			"Swansea",
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "pugh",
		name: "Pugh",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 41,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "okaka",
		name: "Okaka",
		position: "FWD",
		goals: 5,
		assists: 1,
		appearances: 36,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "hennessey",
		name: "Hennessey",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 82,
		clubs: [
			"Crystal Palace",
			"Burnley",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "mariappa",
		name: "Mariappa",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 81,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "adam",
		name: "Adam",
		position: "MID",
		goals: 1,
		assists: 4,
		appearances: 35,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "caballero",
		name: "Caballero",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 30,
		clubs: [
			"Man City",
			"Chelsea",
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "barragan",
		name: "Barragán",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 26,
		clubs: [
			"Middlesbrough"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "long",
		name: "Long",
		position: "FWD",
		goals: 13,
		assists: 9,
		appearances: 138,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "walcott",
		name: "Walcott",
		position: "MID",
		goals: 25,
		assists: 19,
		appearances: 153,
		clubs: [
			"Arsenal",
			"Everton",
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "krul",
		name: "Krul",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 65,
		clubs: [
			"Brighton",
			"Norwich",
			"Luton"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "murray",
		name: "Murray",
		position: "FWD",
		goals: 26,
		assists: 2,
		appearances: 96,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "zabaleta",
		name: "Zabaleta",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 93,
		clubs: [
			"Man City",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "silva",
		name: "Silva",
		position: "MID",
		goals: 25,
		assists: 40,
		appearances: 123,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "valencia",
		name: "Valencia",
		position: "DEF",
		goals: 4,
		assists: 4,
		appearances: 65,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "dyer",
		name: "Dyer",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 32,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "behrami",
		name: "Behrami",
		position: "MID",
		goals: 0,
		assists: 0,
		appearances: 27,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "heaton",
		name: "Heaton",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 78,
		clubs: [
			"Burnley",
			"Aston Villa",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "mirallas",
		name: "Mirallas",
		position: "MID",
		goals: 4,
		assists: 8,
		appearances: 40,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "cabaye",
		name: "Cabaye",
		position: "MID",
		goals: 4,
		assists: 8,
		appearances: 63,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "mcgoldrick",
		name: "McGoldrick",
		position: "FWD",
		goals: 10,
		assists: 3,
		appearances: 63,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "fernandinho",
		name: "Fernandinho",
		position: "MID",
		goals: 10,
		assists: 12,
		appearances: 165,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "diame",
		name: "Diamé",
		position: "MID",
		goals: 2,
		assists: 0,
		appearances: 60,
		clubs: [
			"Hull City",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "boyd",
		name: "Boyd",
		position: "MID",
		goals: 2,
		assists: 2,
		appearances: 36,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "olsson",
		name: "Olsson",
		position: "DEF",
		goals: 2,
		assists: 1,
		appearances: 51,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "randolph",
		name: "Randolph",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 27,
		clubs: [
			"West Ham",
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "bravo",
		name: "Bravo",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 29,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "klavan",
		name: "Klavan",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 39,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "fabianski",
		name: "Fabianski",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 252,
		clubs: [
			"Swansea",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "sanchez",
		name: "Sánchez",
		position: "MID",
		goals: 34,
		assists: 26,
		appearances: 89,
		clubs: [
			"Arsenal",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "elmohamady",
		name: "Elmohamady",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 65,
		clubs: [
			"Hull City",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "fuchs",
		name: "Fuchs",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 84,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "aguero",
		name: "Agüero",
		position: "FWD",
		goals: 82,
		assists: 29,
		appearances: 125,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "ozil",
		name: "Özil",
		position: "MID",
		goals: 18,
		assists: 26,
		appearances: 101,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "evans",
		name: "Evans",
		position: "DEF",
		goals: 9,
		assists: 9,
		appearances: 188,
		clubs: [
			"West Brom",
			"Leicester",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "kaboul",
		name: "Kaboul",
		position: "DEF",
		goals: 2,
		assists: 0,
		appearances: 25,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "shawcross",
		name: "Shawcross",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 62,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "lloris",
		name: "Lloris",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 211,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "rose",
		name: "Rose",
		position: "DEF",
		goals: 2,
		assists: 9,
		appearances: 85,
		clubs: [
			"Spurs",
			"Newcastle",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "monreal",
		name: "Monreal",
		position: "DEF",
		goals: 6,
		assists: 9,
		appearances: 89,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "capoue",
		name: "Capoue",
		position: "MID",
		goals: 9,
		assists: 10,
		appearances: 123,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "lovren",
		name: "Lovren",
		position: "DEF",
		goals: 5,
		assists: 4,
		appearances: 81,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "kayal",
		name: "Kayal",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 37,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "patricio",
		name: "Patrício",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 112,
		clubs: [
			"Wolves"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "fonte",
		name: "Fonte",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 41,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "dembele",
		name: "Dembélé",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 68,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "lallana",
		name: "Lallana",
		position: "MID",
		goals: 12,
		assists: 15,
		appearances: 148,
		clubs: [
			"Liverpool",
			"Brighton",
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "arfield",
		name: "Arfield",
		position: "MID",
		goals: 3,
		assists: 4,
		appearances: 49,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "vertonghen",
		name: "Vertonghen",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 114,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "sokratis",
		name: "Sokratis",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 44,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "pieters",
		name: "Pieters",
		position: "DEF",
		goals: 0,
		assists: 12,
		appearances: 123,
		clubs: [
			"Stoke",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "defour",
		name: "Defour",
		position: "MID",
		goals: 2,
		assists: 4,
		appearances: 51,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "darmian",
		name: "Darmian",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 32,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "carroll",
		name: "Carroll",
		position: "FWD",
		goals: 11,
		assists: 8,
		appearances: 83,
		clubs: [
			"West Ham",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "cork",
		name: "Cork",
		position: "MID",
		goals: 4,
		assists: 4,
		appearances: 171,
		clubs: [
			"Swansea",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "bertrand",
		name: "Bertrand",
		position: "DEF",
		goals: 4,
		assists: 13,
		appearances: 152,
		clubs: [
			"Southampton",
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "begovic",
		name: "Begovic",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 67,
		clubs: [
			"Chelsea",
			"Bournemouth",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "forster",
		name: "Forster",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 106,
		clubs: [
			"Southampton",
			"Spurs",
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "basham",
		name: "Basham",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 72,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "gosling",
		name: "Gosling",
		position: "MID",
		goals: 10,
		assists: 4,
		appearances: 108,
		clubs: [
			"Bournemouth",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "vokes",
		name: "Vokes",
		position: "FWD",
		goals: 17,
		assists: 6,
		appearances: 87,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "allen",
		name: "Allen",
		position: "MID",
		goals: 8,
		assists: 9,
		appearances: 72,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "ward",
		name: "Ward",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 68,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "ogbonna",
		name: "Ogbonna",
		position: "DEF",
		goals: 8,
		assists: 1,
		appearances: 166,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "cavani",
		name: "Cavani",
		position: "FWD",
		goals: 12,
		assists: 5,
		appearances: 41,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2020,
		lastSeason: 2021
	},
	{
		id: "simpson",
		name: "Simpson",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 69,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "sturridge",
		name: "Sturridge",
		position: "FWD",
		goals: 7,
		assists: 7,
		appearances: 53,
		clubs: [
			"Liverpool",
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "sakho",
		name: "Sakho",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 72,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "guaita",
		name: "Guaita",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 136,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "stephens",
		name: "Stephens",
		position: "MID",
		goals: 1,
		assists: 5,
		appearances: 109,
		clubs: [
			"Brighton",
			"Burnley"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "holebas",
		name: "Holebas",
		position: "DEF",
		goals: 5,
		assists: 16,
		appearances: 103,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "ivanovic",
		name: "Ivanovic",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 26,
		clubs: [
			"Chelsea",
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "fellaini",
		name: "Fellaini",
		position: "MID",
		goals: 5,
		assists: 2,
		appearances: 58,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "david-luiz",
		name: "David Luiz",
		position: "DEF",
		goals: 8,
		assists: 6,
		appearances: 132,
		clubs: [
			"Chelsea",
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "daniels",
		name: "Daniels",
		position: "DEF",
		goals: 6,
		assists: 6,
		appearances: 92,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "azpilicueta",
		name: "Azpilicueta",
		position: "DEF",
		goals: 8,
		assists: 28,
		appearances: 212,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "cathcart",
		name: "Cathcart",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 118,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "arnautovic",
		name: "Arnautovic",
		position: "MID",
		goals: 27,
		assists: 19,
		appearances: 91,
		clubs: [
			"Stoke",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "long-2",
		name: "Long",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 47,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "deeney",
		name: "Deeney",
		position: "FWD",
		goals: 34,
		assists: 13,
		appearances: 127,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "bennett",
		name: "Bennett",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 50,
		clubs: [
			"Wolves",
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "wijnaldum",
		name: "Wijnaldum",
		position: "MID",
		goals: 16,
		assists: 13,
		appearances: 179,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "ramsey",
		name: "Ramsey",
		position: "MID",
		goals: 12,
		assists: 20,
		appearances: 75,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "delph",
		name: "Delph",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 75,
		clubs: [
			"Man City",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "prodl",
		name: "Prödl",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 56,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "gibbs",
		name: "Gibbs",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 54,
		clubs: [
			"Arsenal",
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "choupo-moting",
		name: "Choupo-Moting",
		position: "MID",
		goals: 5,
		assists: 5,
		appearances: 30,
		clubs: [
			"Stoke"
		],
		firstSeason: 2017,
		lastSeason: 2017
	},
	{
		id: "kolarov",
		name: "Kolarov",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 29,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "bong",
		name: "Bong",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 51,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "schneiderlin",
		name: "Schneiderlin",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 76,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "hazard",
		name: "Hazard",
		position: "MID",
		goals: 44,
		assists: 30,
		appearances: 107,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "negredo",
		name: "Negredo",
		position: "FWD",
		goals: 9,
		assists: 5,
		appearances: 36,
		clubs: [
			"Middlesbrough"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "chicharito",
		name: "Chicharito",
		position: "FWD",
		goals: 16,
		assists: 6,
		appearances: 55,
		clubs: [
			"West Ham"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "cleverley",
		name: "Cleverley",
		position: "MID",
		goals: 3,
		assists: 7,
		appearances: 109,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "mata",
		name: "Mata",
		position: "MID",
		goals: 13,
		assists: 17,
		appearances: 110,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "sako",
		name: "Sako",
		position: "MID",
		goals: 3,
		assists: 0,
		appearances: 27,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "giroud",
		name: "Giroud",
		position: "FWD",
		goals: 33,
		assists: 11,
		appearances: 120,
		clubs: [
			"Arsenal",
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "amrabat",
		name: "Amrabat",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 32,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "rodriguez",
		name: "Rodriguez",
		position: "FWD",
		goals: 25,
		assists: 12,
		appearances: 164,
		clubs: [
			"Southampton",
			"West Brom",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "barnes",
		name: "Barnes",
		position: "FWD",
		goals: 37,
		assists: 6,
		appearances: 165,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "kone",
		name: "Koné",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 30,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "ayew",
		name: "Ayew",
		position: "MID",
		goals: 9,
		assists: 8,
		appearances: 56,
		clubs: [
			"West Ham",
			"Swansea",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "sissoko",
		name: "Sissoko",
		position: "MID",
		goals: 5,
		assists: 9,
		appearances: 177,
		clubs: [
			"Spurs",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "fleck",
		name: "Fleck",
		position: "MID",
		goals: 5,
		assists: 5,
		appearances: 62,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "taylor",
		name: "Taylor",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 26,
		clubs: [
			"Swansea",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "willian",
		name: "Willian",
		position: "MID",
		goals: 36,
		assists: 44,
		appearances: 209,
		clubs: [
			"Chelsea",
			"Arsenal",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "arter",
		name: "Arter",
		position: "MID",
		goals: 2,
		assists: 5,
		appearances: 73,
		clubs: [
			"Bournemouth",
			"Cardiff",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "reid",
		name: "Reid",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 47,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "zanka",
		name: "Zanka",
		position: "DEF",
		goals: 5,
		assists: 5,
		appearances: 89,
		clubs: [
			"Huddersfield",
			"Brentford"
		],
		firstSeason: 2017,
		lastSeason: 2024
	},
	{
		id: "moses",
		name: "Moses",
		position: "DEF",
		goals: 6,
		assists: 9,
		appearances: 64,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "steele",
		name: "Steele",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 35,
		clubs: [
			"Brighton"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "fer",
		name: "Fer",
		position: "MID",
		goals: 7,
		assists: 3,
		appearances: 54,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "ecuele-manga",
		name: "Ecuele Manga",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 38,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "tomkins",
		name: "Tomkins",
		position: "DEF",
		goals: 10,
		assists: 2,
		appearances: 118,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "robson-kanu",
		name: "Robson-Kanu",
		position: "FWD",
		goals: 7,
		assists: 2,
		appearances: 69,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "naughton",
		name: "Naughton",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 65,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "pedro",
		name: "Pedro",
		position: "MID",
		goals: 22,
		assists: 16,
		appearances: 108,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "hoilett",
		name: "Hoilett",
		position: "MID",
		goals: 3,
		assists: 2,
		appearances: 32,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "gunnarsson",
		name: "Gunnarsson",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 28,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "livermore",
		name: "Livermore",
		position: "MID",
		goals: 3,
		assists: 3,
		appearances: 89,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "morrison-2",
		name: "Morrison",
		position: "DEF",
		goals: 1,
		assists: 4,
		appearances: 34,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "cameron",
		name: "Cameron",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 39,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "welbeck",
		name: "Welbeck",
		position: "FWD",
		goals: 56,
		assists: 29,
		appearances: 201,
		clubs: [
			"Arsenal",
			"Watford",
			"Brighton",
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "phillips",
		name: "Phillips",
		position: "MID",
		goals: 8,
		assists: 13,
		appearances: 90,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "shelvey",
		name: "Shelvey",
		position: "MID",
		goals: 11,
		assists: 11,
		appearances: 132,
		clubs: [
			"Newcastle",
			"Nott'm Forest"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "mcarthur",
		name: "McArthur",
		position: "MID",
		goals: 13,
		assists: 22,
		appearances: 176,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "mccarthy",
		name: "McCarthy",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 66,
		clubs: [
			"Everton",
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "thiago-silva",
		name: "Thiago Silva",
		position: "DEF",
		goals: 8,
		assists: 4,
		appearances: 98,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "van-la-parra",
		name: "van La Parra",
		position: "MID",
		goals: 3,
		assists: 0,
		appearances: 38,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "koscielny",
		name: "Koscielny",
		position: "DEF",
		goals: 7,
		assists: 1,
		appearances: 75,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "mee",
		name: "Mee",
		position: "DEF",
		goals: 12,
		assists: 9,
		appearances: 225,
		clubs: [
			"Burnley",
			"Brentford"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "albrighton",
		name: "Albrighton",
		position: "MID",
		goals: 9,
		assists: 28,
		appearances: 163,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "de-gea",
		name: "de Gea",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 237,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "britos",
		name: "Britos",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 42,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "janmaat",
		name: "Janmaat",
		position: "DEF",
		goals: 5,
		assists: 5,
		appearances: 76,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "wilshere",
		name: "Wilshere",
		position: "MID",
		goals: 1,
		assists: 8,
		appearances: 65,
		clubs: [
			"Bournemouth",
			"Arsenal",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "lowe",
		name: "Löwe",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 52,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "ulloa",
		name: "Ulloa",
		position: "FWD",
		goals: 2,
		assists: 0,
		appearances: 30,
		clubs: [
			"Leicester",
			"Brighton"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "smith",
		name: "Smith",
		position: "DEF",
		goals: 3,
		assists: 16,
		appearances: 191,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "kiko-femenia",
		name: "Kiko Femenía",
		position: "DEF",
		goals: 2,
		assists: 8,
		appearances: 107,
		clubs: [
			"Watford"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "iborra",
		name: "Iborra",
		position: "MID",
		goals: 3,
		assists: 0,
		appearances: 27,
		clubs: [
			"Leicester"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "aubameyang",
		name: "Aubameyang",
		position: "FWD",
		goals: 69,
		assists: 20,
		appearances: 129,
		clubs: [
			"Arsenal",
			"Chelsea"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "kaminski",
		name: "Kaminski",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 38,
		clubs: [
			"Luton"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "wanyama",
		name: "Wanyama",
		position: "MID",
		goals: 6,
		assists: 2,
		appearances: 69,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "christian-benteke",
		name: "Christian Benteke",
		position: "FWD",
		goals: 35,
		assists: 14,
		appearances: 162,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "chadli",
		name: "Chadli",
		position: "MID",
		goals: 6,
		assists: 6,
		appearances: 36,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "kouyate",
		name: "Kouyaté",
		position: "MID",
		goals: 6,
		assists: 10,
		appearances: 197,
		clubs: [
			"West Ham",
			"Crystal Palace",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "sigurdsson",
		name: "Sigurdsson",
		position: "MID",
		goals: 34,
		assists: 32,
		appearances: 174,
		clubs: [
			"Swansea",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "bolasie",
		name: "Bolasie",
		position: "MID",
		goals: 2,
		assists: 5,
		appearances: 30,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "cresswell",
		name: "Cresswell",
		position: "DEF",
		goals: 6,
		assists: 26,
		appearances: 205,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "ward-2",
		name: "Ward",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 184,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "alderweireld",
		name: "Alderweireld",
		position: "DEF",
		goals: 4,
		assists: 2,
		appearances: 136,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "yacob",
		name: "Yacob",
		position: "MID",
		goals: 0,
		assists: 0,
		appearances: 49,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "smalling",
		name: "Smalling",
		position: "DEF",
		goals: 6,
		assists: 1,
		appearances: 71,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "cooper",
		name: "Cooper",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 56,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "martina",
		name: "Martina",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 30,
		clubs: [
			"Southampton",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "yarmolenko",
		name: "Yarmolenko",
		position: "MID",
		goals: 8,
		assists: 3,
		appearances: 66,
		clubs: [
			"West Ham"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "coquelin",
		name: "Coquelin",
		position: "MID",
		goals: 0,
		assists: 1,
		appearances: 36,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "stanislas",
		name: "Stanislas",
		position: "MID",
		goals: 17,
		assists: 13,
		appearances: 78,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "steve-cook",
		name: "Steve Cook",
		position: "DEF",
		goals: 6,
		assists: 2,
		appearances: 132,
		clubs: [
			"Bournemouth",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "henderson",
		name: "Henderson",
		position: "MID",
		goals: 11,
		assists: 26,
		appearances: 207,
		clubs: [
			"Liverpool",
			"Brentford",
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "bennett-2",
		name: "Bennett",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 30,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "ritchie",
		name: "Ritchie",
		position: "MID",
		goals: 8,
		assists: 23,
		appearances: 125,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "bony",
		name: "Bony",
		position: "FWD",
		goals: 4,
		assists: 1,
		appearances: 25,
		clubs: [
			"Stoke",
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "pukki",
		name: "Pukki",
		position: "FWD",
		goals: 22,
		assists: 6,
		appearances: 73,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "rondon",
		name: "Rondón",
		position: "FWD",
		goals: 27,
		assists: 15,
		appearances: 126,
		clubs: [
			"West Brom",
			"Newcastle",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "fernandez",
		name: "Fernández",
		position: "DEF",
		goals: 3,
		assists: 8,
		appearances: 139,
		clubs: [
			"Swansea",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "mkhitaryan",
		name: "Mkhitaryan",
		position: "MID",
		goals: 13,
		assists: 14,
		appearances: 78,
		clubs: [
			"Man Utd",
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "clyne",
		name: "Clyne",
		position: "DEF",
		goals: 0,
		assists: 7,
		appearances: 126,
		clubs: [
			"Liverpool",
			"Bournemouth",
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "otamendi",
		name: "Otamendi",
		position: "DEF",
		goals: 7,
		assists: 3,
		appearances: 106,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "lossl",
		name: "Lössl",
		position: "GK",
		goals: 0,
		assists: 2,
		appearances: 71,
		clubs: [
			"Huddersfield",
			"Everton",
			"Brentford"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "antonio",
		name: "Antonio",
		position: "FWD",
		goals: 60,
		assists: 46,
		appearances: 216,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "narsingh",
		name: "Narsingh",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 31,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "mccarthy-2",
		name: "McCarthy",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 129,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "ighalo",
		name: "Ighalo",
		position: "FWD",
		goals: 1,
		assists: 1,
		appearances: 30,
		clubs: [
			"Watford",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "walker",
		name: "Walker",
		position: "DEF",
		goals: 3,
		assists: 27,
		appearances: 260,
		clubs: [
			"Spurs",
			"Man City",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "kelly",
		name: "Kelly",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 77,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "cedric",
		name: "Cédric",
		position: "DEF",
		goals: 3,
		assists: 11,
		appearances: 134,
		clubs: [
			"Southampton",
			"Arsenal",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "clark",
		name: "Clark",
		position: "DEF",
		goals: 8,
		assists: 2,
		appearances: 80,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2022
	},
	{
		id: "blind",
		name: "Blind",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 30,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "rojo",
		name: "Rojo",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 38,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "clayton",
		name: "Clayton",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 34,
		clubs: [
			"Middlesbrough"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "darlow",
		name: "Darlow",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 65,
		clubs: [
			"Newcastle",
			"Leeds",
			"Man Utd"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "obiang",
		name: "Obiang",
		position: "MID",
		goals: 3,
		assists: 4,
		appearances: 67,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "herrera",
		name: "Herrera",
		position: "MID",
		goals: 3,
		assists: 11,
		appearances: 79,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "gundogan",
		name: "Gündogan",
		position: "MID",
		goals: 45,
		assists: 29,
		appearances: 200,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "bartley",
		name: "Bartley",
		position: "DEF",
		goals: 3,
		assists: 1,
		appearances: 35,
		clubs: [
			"Swansea",
			"West Brom"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "coleman",
		name: "Coleman",
		position: "DEF",
		goals: 8,
		assists: 12,
		appearances: 173,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "lacazette",
		name: "Lacazette",
		position: "FWD",
		goals: 54,
		assists: 35,
		appearances: 158,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "dawson",
		name: "Dawson",
		position: "DEF",
		goals: 15,
		assists: 7,
		appearances: 206,
		clubs: [
			"West Brom",
			"Watford",
			"West Ham",
			"Wolves"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "townsend",
		name: "Townsend",
		position: "MID",
		goals: 17,
		assists: 33,
		appearances: 203,
		clubs: [
			"Crystal Palace",
			"Everton",
			"Luton"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "gro",
		name: "Groß",
		position: "MID",
		goals: 31,
		assists: 54,
		appearances: 232,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "westwood",
		name: "Westwood",
		position: "MID",
		goals: 7,
		assists: 24,
		appearances: 162,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "gudmundsson",
		name: "Gudmundsson",
		position: "MID",
		goals: 10,
		assists: 24,
		appearances: 148,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "wood",
		name: "Wood",
		position: "FWD",
		goals: 91,
		assists: 12,
		appearances: 235,
		clubs: [
			"Burnley",
			"Newcastle",
			"Nott'm Forest"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "adrian",
		name: "Adrián",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 49,
		clubs: [
			"West Ham",
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "courtois",
		name: "Courtois",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 71,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "matip",
		name: "Matip",
		position: "DEF",
		goals: 9,
		assists: 5,
		appearances: 144,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "casemiro",
		name: "Casemiro",
		position: "MID",
		goals: 15,
		assists: 10,
		appearances: 93,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "joselu",
		name: "Joselu",
		position: "FWD",
		goals: 6,
		assists: 1,
		appearances: 46,
		clubs: [
			"Stoke",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "de-bruyne",
		name: "De Bruyne",
		position: "MID",
		goals: 65,
		assists: 122,
		appearances: 232,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "gabbiadini",
		name: "Gabbiadini",
		position: "FWD",
		goals: 10,
		assists: 1,
		appearances: 51,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "thiago",
		name: "Thiago",
		position: "MID",
		goals: 2,
		assists: 4,
		appearances: 56,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "pereyra",
		name: "Pereyra",
		position: "MID",
		goals: 16,
		assists: 10,
		appearances: 106,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "drinkwater",
		name: "Drinkwater",
		position: "MID",
		goals: 2,
		assists: 1,
		appearances: 46,
		clubs: [
			"Leicester",
			"Chelsea",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "le-marchand",
		name: "Le Marchand",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 28,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "jansson",
		name: "Jansson",
		position: "DEF",
		goals: 4,
		assists: 4,
		appearances: 40,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2022
	},
	{
		id: "diouf",
		name: "Diouf",
		position: "FWD",
		goals: 7,
		assists: 5,
		appearances: 62,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "duffy",
		name: "Duffy",
		position: "DEF",
		goals: 7,
		assists: 5,
		appearances: 109,
		clubs: [
			"Brighton",
			"Fulham"
		],
		firstSeason: 2017,
		lastSeason: 2022
	},
	{
		id: "matic",
		name: "Matic",
		position: "MID",
		goals: 3,
		assists: 16,
		appearances: 163,
		clubs: [
			"Chelsea",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "tadic",
		name: "Tadic",
		position: "MID",
		goals: 9,
		assists: 10,
		appearances: 69,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "lamela",
		name: "Lamela",
		position: "MID",
		goals: 10,
		assists: 15,
		appearances: 101,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "mcclean",
		name: "McClean",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 64,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "stevens",
		name: "Stevens",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 68,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "propper",
		name: "Pröpper",
		position: "MID",
		goals: 2,
		assists: 7,
		appearances: 107,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "ayling",
		name: "Ayling",
		position: "DEF",
		goals: 4,
		assists: 4,
		appearances: 85,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "lukaku",
		name: "Lukaku",
		position: "FWD",
		goals: 61,
		assists: 15,
		appearances: 129,
		clubs: [
			"Everton",
			"Man Utd",
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "mignolet",
		name: "Mignolet",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 47,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "tosun",
		name: "Tosun",
		position: "FWD",
		goals: 10,
		assists: 3,
		appearances: 55,
		clubs: [
			"Everton"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "milivojevic",
		name: "Milivojevic",
		position: "MID",
		goals: 28,
		assists: 6,
		appearances: 168,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "dubravka",
		name: "Dubravka",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 195,
		clubs: [
			"Newcastle",
			"Man Utd",
			"Burnley",
			"Spurs"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "nyom",
		name: "Nyom",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 61,
		clubs: [
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "shaqiri",
		name: "Shaqiri",
		position: "MID",
		goals: 19,
		assists: 18,
		appearances: 102,
		clubs: [
			"Stoke",
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "lowton",
		name: "Lowton",
		position: "DEF",
		goals: 2,
		assists: 10,
		appearances: 159,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "mustafi",
		name: "Mustafi",
		position: "DEF",
		goals: 7,
		assists: 5,
		appearances: 102,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "kucka",
		name: "Kucka",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 26,
		clubs: [
			"Watford"
		],
		firstSeason: 2021,
		lastSeason: 2021
	},
	{
		id: "neto",
		name: "Neto",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 53,
		clubs: [
			"Bournemouth",
			"Arsenal"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "klich",
		name: "Klich",
		position: "MID",
		goals: 5,
		assists: 7,
		appearances: 68,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "odoi",
		name: "Odoi",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 34,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "gray",
		name: "Gray",
		position: "FWD",
		goals: 23,
		assists: 9,
		appearances: 115,
		clubs: [
			"Burnley",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "krychowiak",
		name: "Krychowiak",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 27,
		clubs: [
			"West Brom"
		],
		firstSeason: 2017,
		lastSeason: 2017
	},
	{
		id: "clucas",
		name: "Clucas",
		position: "MID",
		goals: 6,
		assists: 2,
		appearances: 66,
		clubs: [
			"Hull City",
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "pogba",
		name: "Pogba",
		position: "MID",
		goals: 29,
		assists: 46,
		appearances: 154,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "van-aanholt",
		name: "van Aanholt",
		position: "DEF",
		goals: 16,
		assists: 8,
		appearances: 147,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "schelotto",
		name: "Schelotto",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "mooy",
		name: "Mooy",
		position: "MID",
		goals: 9,
		assists: 6,
		appearances: 96,
		clubs: [
			"Huddersfield",
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "morsy",
		name: "Morsy",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 31,
		clubs: [
			"Ipswich Town"
		],
		firstSeason: 2024,
		lastSeason: 2024
	},
	{
		id: "callum-wilson",
		name: "Callum Wilson",
		position: "FWD",
		goals: 90,
		assists: 36,
		appearances: 190,
		clubs: [
			"Bournemouth",
			"Newcastle",
			"West Ham",
			"Brentford"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "rupp",
		name: "Rupp",
		position: "MID",
		goals: 0,
		assists: 0,
		appearances: 31,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "cairney",
		name: "Cairney",
		position: "MID",
		goals: 9,
		assists: 9,
		appearances: 70,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "jones-2",
		name: "Jones",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 65,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "ki-sung-yueng",
		name: "Ki Sung-yueng",
		position: "MID",
		goals: 2,
		assists: 4,
		appearances: 69,
		clubs: [
			"Swansea",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "lejeune",
		name: "Lejeune",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 42,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "hegazi",
		name: "Hegazi",
		position: "DEF",
		goals: 2,
		assists: 0,
		appearances: 39,
		clubs: [
			"West Brom"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "trippier",
		name: "Trippier",
		position: "DEF",
		goals: 5,
		assists: 40,
		appearances: 151,
		clubs: [
			"Spurs",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "king-2",
		name: "King",
		position: "FWD",
		goals: 47,
		assists: 19,
		appearances: 173,
		clubs: [
			"Bournemouth",
			"Everton",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "oriol-romeu",
		name: "Oriol Romeu",
		position: "MID",
		goals: 6,
		assists: 3,
		appearances: 187,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "austin",
		name: "Austin",
		position: "FWD",
		goals: 15,
		assists: 4,
		appearances: 69,
		clubs: [
			"Southampton",
			"West Brom"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "okazaki",
		name: "Okazaki",
		position: "FWD",
		goals: 9,
		assists: 5,
		appearances: 78,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "mclean",
		name: "McLean",
		position: "MID",
		goals: 2,
		assists: 1,
		appearances: 68,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "kane",
		name: "Kane",
		position: "FWD",
		goals: 163,
		assists: 51,
		appearances: 220,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "burn",
		name: "Burn",
		position: "DEF",
		goals: 7,
		assists: 7,
		appearances: 206,
		clubs: [
			"Brighton",
			"Newcastle"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "hogg",
		name: "Hogg",
		position: "MID",
		goals: 0,
		assists: 1,
		appearances: 59,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "norwood",
		name: "Norwood",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 86,
		clubs: [
			"Brighton",
			"Sheffield Utd"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "ayew-2",
		name: "Ayew",
		position: "FWD",
		goals: 35,
		assists: 30,
		appearances: 241,
		clubs: [
			"Swansea",
			"Crystal Palace",
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "forshaw",
		name: "Forshaw",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 61,
		clubs: [
			"Middlesbrough",
			"Leeds"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "leno",
		name: "Leno",
		position: "GK",
		goals: 0,
		assists: 2,
		appearances: 240,
		clubs: [
			"Arsenal",
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "aurier",
		name: "Aurier",
		position: "DEF",
		goals: 6,
		assists: 16,
		appearances: 104,
		clubs: [
			"Spurs",
			"Nott'm Forest"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "yoshida",
		name: "Yoshida",
		position: "DEF",
		goals: 3,
		assists: 3,
		appearances: 72,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "eriksen",
		name: "Eriksen",
		position: "MID",
		goals: 33,
		assists: 61,
		appearances: 176,
		clubs: [
			"Spurs",
			"Brentford",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "williams-2",
		name: "Williams",
		position: "MID",
		goals: 0,
		assists: 0,
		appearances: 25,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "gueye",
		name: "Gueye",
		position: "MID",
		goals: 9,
		assists: 13,
		appearances: 207,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "rodrigo",
		name: "Rodrigo",
		position: "FWD",
		goals: 26,
		assists: 8,
		appearances: 69,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "fredericks",
		name: "Fredericks",
		position: "DEF",
		goals: 2,
		assists: 4,
		appearances: 63,
		clubs: [
			"West Ham",
			"Bournemouth"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "vydra",
		name: "Vydra",
		position: "FWD",
		goals: 8,
		assists: 7,
		appearances: 83,
		clubs: [
			"Watford",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "chamberlain",
		name: "Chamberlain",
		position: "MID",
		goals: 13,
		assists: 17,
		appearances: 130,
		clubs: [
			"Arsenal",
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "foderingham",
		name: "Foderingham",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 29,
		clubs: [
			"Sheffield Utd",
			"West Ham"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "alonso",
		name: "Alonso",
		position: "DEF",
		goals: 25,
		assists: 25,
		appearances: 154,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "zaha",
		name: "Zaha",
		position: "MID",
		goals: 62,
		assists: 43,
		appearances: 214,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "de-roon",
		name: "de Roon",
		position: "MID",
		goals: 4,
		assists: 1,
		appearances: 33,
		clubs: [
			"Middlesbrough"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "ream",
		name: "Ream",
		position: "DEF",
		goals: 2,
		assists: 0,
		appearances: 69,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "baldock",
		name: "Baldock",
		position: "DEF",
		goals: 2,
		assists: 8,
		appearances: 81,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "redmond",
		name: "Redmond",
		position: "MID",
		goals: 21,
		assists: 22,
		appearances: 194,
		clubs: [
			"Southampton",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "dunk",
		name: "Dunk",
		position: "DEF",
		goals: 17,
		assists: 9,
		appearances: 283,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "gibson",
		name: "Gibson",
		position: "DEF",
		goals: 2,
		assists: 1,
		appearances: 67,
		clubs: [
			"Middlesbrough",
			"Burnley",
			"Norwich"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "hendrick",
		name: "Hendrick",
		position: "MID",
		goals: 11,
		assists: 8,
		appearances: 147,
		clubs: [
			"Burnley",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "jack-robinson",
		name: "Jack Robinson",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 48,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "hanley",
		name: "Hanley",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 48,
		clubs: [
			"Newcastle",
			"Norwich"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "knockaert",
		name: "Knockaert",
		position: "MID",
		goals: 5,
		assists: 7,
		appearances: 63,
		clubs: [
			"Brighton",
			"Fulham"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "quaner",
		name: "Quaner",
		position: "FWD",
		goals: 0,
		assists: 4,
		appearances: 28,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "areola",
		name: "Areola",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 115,
		clubs: [
			"Fulham",
			"West Ham"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "xhaka",
		name: "Xhaka",
		position: "MID",
		goals: 18,
		assists: 35,
		appearances: 244,
		clubs: [
			"Arsenal",
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "coutinho",
		name: "Coutinho",
		position: "MID",
		goals: 26,
		assists: 18,
		appearances: 65,
		clubs: [
			"Liverpool",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "ings",
		name: "Ings",
		position: "FWD",
		goals: 59,
		assists: 23,
		appearances: 141,
		clubs: [
			"Liverpool",
			"Southampton",
			"Aston Villa",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "hourihane",
		name: "Hourihane",
		position: "MID",
		goals: 4,
		assists: 6,
		appearances: 31,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "martins-indi",
		name: "Martins Indi",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 52,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "schindler",
		name: "Schindler",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 74,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "kabasele",
		name: "Kabasele",
		position: "DEF",
		goals: 4,
		assists: 2,
		appearances: 108,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "sels",
		name: "Sels",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 85,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "jorginho",
		name: "Jorginho",
		position: "MID",
		goals: 21,
		assists: 11,
		appearances: 158,
		clubs: [
			"Chelsea",
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "son",
		name: "Son",
		position: "MID",
		goals: 123,
		assists: 85,
		appearances: 283,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "montoya",
		name: "Montoya",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 52,
		clubs: [
			"Brighton"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "ince",
		name: "Ince",
		position: "MID",
		goals: 2,
		assists: 1,
		appearances: 33,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "schlupp",
		name: "Schlupp",
		position: "MID",
		goals: 18,
		assists: 17,
		appearances: 185,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "mendy",
		name: "Mendy",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 86,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "lanzini",
		name: "Lanzini",
		position: "MID",
		goals: 21,
		assists: 19,
		appearances: 144,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "christie",
		name: "Christie",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 28,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "kachunga",
		name: "Kachunga",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 39,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "doherty",
		name: "Doherty",
		position: "DEF",
		goals: 14,
		assists: 23,
		appearances: 155,
		clubs: [
			"Wolves",
			"Spurs"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "dallas",
		name: "Dallas",
		position: "DEF",
		goals: 9,
		assists: 4,
		appearances: 72,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "morata",
		name: "Morata",
		position: "FWD",
		goals: 16,
		assists: 6,
		appearances: 47,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "sarabia",
		name: "Sarabia",
		position: "MID",
		goals: 8,
		assists: 9,
		appearances: 36,
		clubs: [
			"Wolves"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "afobe",
		name: "Afobe",
		position: "FWD",
		goals: 6,
		assists: 6,
		appearances: 48,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "etheridge",
		name: "Etheridge",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 38,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "barkley",
		name: "Barkley",
		position: "MID",
		goals: 24,
		assists: 31,
		appearances: 159,
		clubs: [
			"Everton",
			"Chelsea",
			"Aston Villa",
			"Luton"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "stephens-2",
		name: "Stephens",
		position: "DEF",
		goals: 5,
		assists: 4,
		appearances: 150,
		clubs: [
			"Southampton",
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "chalobah",
		name: "Chalobah",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 47,
		clubs: [
			"Chelsea",
			"Watford",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "hernandez",
		name: "Hernández",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 26,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "fraser",
		name: "Fraser",
		position: "MID",
		goals: 18,
		assists: 40,
		appearances: 169,
		clubs: [
			"Bournemouth",
			"Newcastle",
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "varane",
		name: "Varane",
		position: "DEF",
		goals: 2,
		assists: 1,
		appearances: 52,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2021,
		lastSeason: 2023
	},
	{
		id: "brady",
		name: "Brady",
		position: "MID",
		goals: 4,
		assists: 11,
		appearances: 81,
		clubs: [
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "boly",
		name: "Boly",
		position: "DEF",
		goals: 7,
		assists: 4,
		appearances: 116,
		clubs: [
			"Wolves",
			"Nott'm Forest"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "armstrong",
		name: "Armstrong",
		position: "MID",
		goals: 16,
		assists: 18,
		appearances: 125,
		clubs: [
			"Southampton"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "kovacic",
		name: "Kovacic",
		position: "MID",
		goals: 11,
		assists: 17,
		appearances: 170,
		clubs: [
			"Chelsea",
			"Man City"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "berahino",
		name: "Berahino",
		position: "FWD",
		goals: 0,
		assists: 1,
		appearances: 32,
		clubs: [
			"Stoke"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "firmino",
		name: "Firmino",
		position: "FWD",
		goals: 72,
		assists: 52,
		appearances: 203,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "vestergaard",
		name: "Vestergaard",
		position: "DEF",
		goals: 4,
		assists: 1,
		appearances: 98,
		clubs: [
			"Southampton",
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "dier",
		name: "Dier",
		position: "MID",
		goals: 7,
		assists: 6,
		appearances: 191,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "andone",
		name: "Andone",
		position: "FWD",
		goals: 4,
		assists: 0,
		appearances: 26,
		clubs: [
			"Brighton"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "carroll-2",
		name: "Carroll",
		position: "MID",
		goals: 1,
		assists: 6,
		appearances: 55,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "coady",
		name: "Coady",
		position: "DEF",
		goals: 7,
		assists: 1,
		appearances: 180,
		clubs: [
			"Wolves",
			"Everton",
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "batshuayi",
		name: "Batshuayi",
		position: "FWD",
		goals: 15,
		assists: 7,
		appearances: 77,
		clubs: [
			"Chelsea",
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "rico",
		name: "Rico",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 29,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "deulofeu",
		name: "Deulofeu",
		position: "MID",
		goals: 15,
		assists: 11,
		appearances: 76,
		clubs: [
			"Everton",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "maguire",
		name: "Maguire",
		position: "DEF",
		goals: 15,
		assists: 16,
		appearances: 262,
		clubs: [
			"Hull City",
			"Leicester",
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "lucas-moura",
		name: "Lucas Moura",
		position: "MID",
		goals: 20,
		assists: 19,
		appearances: 137,
		clubs: [
			"Spurs"
		],
		firstSeason: 2017,
		lastSeason: 2022
	},
	{
		id: "elyounoussi",
		name: "Elyounoussi",
		position: "MID",
		goals: 5,
		assists: 4,
		appearances: 62,
		clubs: [
			"Southampton"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "reid-2",
		name: "Reid",
		position: "MID",
		goals: 21,
		assists: 14,
		appearances: 102,
		clubs: [
			"Cardiff",
			"Fulham",
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "van-dijk",
		name: "van Dijk",
		position: "DEF",
		goals: 28,
		assists: 14,
		appearances: 293,
		clubs: [
			"Southampton",
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "stones",
		name: "Stones",
		position: "DEF",
		goals: 10,
		assists: 2,
		appearances: 158,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "van-der-hoorn",
		name: "van der Hoorn",
		position: "DEF",
		goals: 2,
		assists: 0,
		appearances: 32,
		clubs: [
			"Swansea"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "bellerin",
		name: "Bellerín",
		position: "DEF",
		goals: 5,
		assists: 17,
		appearances: 127,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "pope",
		name: "Pope",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 234,
		clubs: [
			"Burnley",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "martinez",
		name: "Martinez",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 210,
		clubs: [
			"Arsenal",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "moreno",
		name: "Moreno",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 30,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "danilo",
		name: "Danilo",
		position: "DEF",
		goals: 4,
		assists: 2,
		appearances: 34,
		clubs: [
			"Man City"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "carrillo",
		name: "Carrillo",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 28,
		clubs: [
			"Watford"
		],
		firstSeason: 2017,
		lastSeason: 2017
	},
	{
		id: "bernard",
		name: "Bernard",
		position: "MID",
		goals: 5,
		assists: 6,
		appearances: 73,
		clubs: [
			"Everton"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "bryan",
		name: "Bryan",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 44,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "lascelles",
		name: "Lascelles",
		position: "DEF",
		goals: 8,
		assists: 2,
		appearances: 148,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "ward-prowse",
		name: "Ward-Prowse",
		position: "MID",
		goals: 54,
		assists: 39,
		appearances: 285,
		clubs: [
			"Southampton",
			"West Ham",
			"Nott'm Forest",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "chambers",
		name: "Chambers",
		position: "DEF",
		goals: 6,
		assists: 6,
		appearances: 107,
		clubs: [
			"Middlesbrough",
			"Arsenal",
			"Fulham",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "digne",
		name: "Digne",
		position: "DEF",
		goals: 6,
		assists: 42,
		appearances: 215,
		clubs: [
			"Everton",
			"Aston Villa"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "felipe-anderson",
		name: "Felipe Anderson",
		position: "MID",
		goals: 10,
		assists: 10,
		appearances: 63,
		clubs: [
			"West Ham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "fred",
		name: "Fred",
		position: "MID",
		goals: 8,
		assists: 10,
		appearances: 112,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "vardy",
		name: "Vardy",
		position: "FWD",
		goals: 116,
		assists: 49,
		appearances: 246,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "johnstone",
		name: "Johnstone",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 85,
		clubs: [
			"West Brom",
			"Crystal Palace",
			"Wolves"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "jimenez",
		name: "Jiménez",
		position: "FWD",
		goals: 68,
		assists: 33,
		appearances: 201,
		clubs: [
			"Wolves",
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "rudiger",
		name: "Rüdiger",
		position: "DEF",
		goals: 9,
		assists: 6,
		appearances: 133,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "sidibe",
		name: "Sidibé",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 25,
		clubs: [
			"Everton"
		],
		firstSeason: 2019,
		lastSeason: 2019
	},
	{
		id: "mendy-2",
		name: "Mendy",
		position: "DEF",
		goals: 2,
		assists: 10,
		appearances: 50,
		clubs: [
			"Man City"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "mahrez",
		name: "Mahrez",
		position: "MID",
		goals: 61,
		assists: 62,
		appearances: 205,
		clubs: [
			"Leicester",
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "haller",
		name: "Haller",
		position: "FWD",
		goals: 10,
		assists: 3,
		appearances: 48,
		clubs: [
			"West Ham"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "zouma",
		name: "Zouma",
		position: "DEF",
		goals: 14,
		assists: 4,
		appearances: 194,
		clubs: [
			"Chelsea",
			"Stoke",
			"Everton",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "ibe",
		name: "Ibe",
		position: "MID",
		goals: 3,
		assists: 7,
		appearances: 78,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "taylor-2",
		name: "Taylor",
		position: "DEF",
		goals: 1,
		assists: 8,
		appearances: 161,
		clubs: [
			"Burnley",
			"Southampton"
		],
		firstSeason: 2017,
		lastSeason: 2024
	},
	{
		id: "sterling",
		name: "Sterling",
		position: "MID",
		goals: 99,
		assists: 82,
		appearances: 235,
		clubs: [
			"Man City",
			"Chelsea",
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "ralls",
		name: "Ralls",
		position: "MID",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "karius",
		name: "Karius",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 30,
		clubs: [
			"Liverpool",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "smith-2",
		name: "Smith",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 39,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "gayle",
		name: "Gayle",
		position: "FWD",
		goals: 11,
		assists: 6,
		appearances: 81,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2022
	},
	{
		id: "atsu",
		name: "Atsu",
		position: "MID",
		goals: 3,
		assists: 8,
		appearances: 75,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "alioski",
		name: "Alioski",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 36,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2020
	},
	{
		id: "butland",
		name: "Butland",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 50,
		clubs: [
			"Stoke",
			"Crystal Palace",
			"Man Utd",
			"Hull City"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "zappacosta",
		name: "Zappacosta",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 26,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "masuaku",
		name: "Masuaku",
		position: "DEF",
		goals: 1,
		assists: 10,
		appearances: 107,
		clubs: [
			"West Ham",
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "pritchard",
		name: "Pritchard",
		position: "MID",
		goals: 3,
		assists: 2,
		appearances: 44,
		clubs: [
			"Spurs",
			"Huddersfield"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "alex-moreno",
		name: "Álex Moreno",
		position: "DEF",
		goals: 2,
		assists: 4,
		appearances: 36,
		clubs: [
			"Aston Villa",
			"Nott'm Forest"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "keane",
		name: "Keane",
		position: "DEF",
		goals: 19,
		assists: 10,
		appearances: 250,
		clubs: [
			"Burnley",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "bamford",
		name: "Bamford",
		position: "FWD",
		goals: 24,
		assists: 18,
		appearances: 75,
		clubs: [
			"Middlesbrough",
			"Leeds"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "dummett",
		name: "Dummett",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 80,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "locadia",
		name: "Locadia",
		position: "FWD",
		goals: 3,
		assists: 1,
		appearances: 35,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "shaw",
		name: "Shaw",
		position: "DEF",
		goals: 4,
		assists: 22,
		appearances: 204,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "praet",
		name: "Praet",
		position: "MID",
		goals: 3,
		assists: 6,
		appearances: 46,
		clubs: [
			"Leicester"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "gunn",
		name: "Gunn",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 31,
		clubs: [
			"Man City",
			"Southampton",
			"Norwich",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "saiss",
		name: "Saïss",
		position: "DEF",
		goals: 9,
		assists: 2,
		appearances: 110,
		clubs: [
			"Wolves"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "townsend-2",
		name: "Townsend",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 28,
		clubs: [
			"West Brom",
			"Ipswich Town"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "hughes",
		name: "Hughes",
		position: "MID",
		goals: 6,
		assists: 18,
		appearances: 166,
		clubs: [
			"Watford",
			"Crystal Palace"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "egan",
		name: "Egan",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 74,
		clubs: [
			"Sheffield Utd",
			"Hull City"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "alli",
		name: "Alli",
		position: "MID",
		goals: 41,
		assists: 36,
		appearances: 159,
		clubs: [
			"Spurs",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "lingard",
		name: "Lingard",
		position: "MID",
		goals: 25,
		assists: 18,
		appearances: 142,
		clubs: [
			"Man Utd",
			"West Ham",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "march",
		name: "March",
		position: "MID",
		goals: 13,
		assists: 25,
		appearances: 168,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "kongolo",
		name: "Kongolo",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 46,
		clubs: [
			"Huddersfield",
			"Fulham"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "manquillo",
		name: "Manquillo",
		position: "DEF",
		goals: 2,
		assists: 8,
		appearances: 112,
		clubs: [
			"Sunderland",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "emerson",
		name: "Emerson",
		position: "DEF",
		goals: 4,
		assists: 6,
		appearances: 107,
		clubs: [
			"Chelsea",
			"West Ham"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "tosin-adarabioyo",
		name: "Tosin Adarabioyo",
		position: "DEF",
		goals: 4,
		assists: 2,
		appearances: 87,
		clubs: [
			"Man City",
			"Fulham",
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "kepa",
		name: "Kepa",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 135,
		clubs: [
			"Chelsea",
			"Bournemouth",
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "traore",
		name: "Traore",
		position: "MID",
		goals: 10,
		assists: 9,
		appearances: 55,
		clubs: [
			"Chelsea",
			"Aston Villa",
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "webster",
		name: "Webster",
		position: "DEF",
		goals: 6,
		assists: 2,
		appearances: 116,
		clubs: [
			"Brighton"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "mane",
		name: "Mané",
		position: "MID",
		goals: 90,
		assists: 44,
		appearances: 196,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "pickford",
		name: "Pickford",
		position: "GK",
		goals: 0,
		assists: 2,
		appearances: 348,
		clubs: [
			"Sunderland",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "marcal",
		name: "Marçal",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 31,
		clubs: [
			"Wolves"
		],
		firstSeason: 2020,
		lastSeason: 2021
	},
	{
		id: "brooks",
		name: "Brooks",
		position: "MID",
		goals: 12,
		assists: 11,
		appearances: 65,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "kolasinac",
		name: "Kolasinac",
		position: "DEF",
		goals: 2,
		assists: 13,
		appearances: 80,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "veltman",
		name: "Veltman",
		position: "DEF",
		goals: 5,
		assists: 4,
		appearances: 121,
		clubs: [
			"Brighton"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "krafth",
		name: "Krafth",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 64,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "pereira",
		name: "Pereira",
		position: "DEF",
		goals: 7,
		assists: 15,
		appearances: 101,
		clubs: [
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "can",
		name: "Can",
		position: "MID",
		goals: 8,
		assists: 8,
		appearances: 58,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "byram",
		name: "Byram",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 55,
		clubs: [
			"West Ham",
			"Norwich",
			"Leeds"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "niasse",
		name: "Niasse",
		position: "FWD",
		goals: 12,
		assists: 4,
		appearances: 60,
		clubs: [
			"Hull City",
			"Everton",
			"Cardiff"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "jonny",
		name: "Jonny",
		position: "DEF",
		goals: 6,
		assists: 6,
		appearances: 91,
		clubs: [
			"Wolves"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "murphy",
		name: "Murphy",
		position: "MID",
		goals: 22,
		assists: 35,
		appearances: 166,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "murphy-2",
		name: "Murphy",
		position: "MID",
		goals: 3,
		assists: 2,
		appearances: 29,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "grealish",
		name: "Grealish",
		position: "MID",
		goals: 28,
		assists: 40,
		appearances: 140,
		clubs: [
			"Aston Villa",
			"Man City",
			"Everton"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "maupay",
		name: "Maupay",
		position: "FWD",
		goals: 33,
		assists: 11,
		appearances: 122,
		clubs: [
			"Brighton",
			"Everton",
			"Brentford"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "davies-2",
		name: "Davies",
		position: "DEF",
		goals: 8,
		assists: 19,
		appearances: 190,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "trossard",
		name: "Trossard",
		position: "MID",
		goals: 52,
		assists: 44,
		appearances: 180,
		clubs: [
			"Brighton",
			"Arsenal"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "alisson",
		name: "Alisson",
		position: "GK",
		goals: 1,
		assists: 3,
		appearances: 243,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "kante",
		name: "Kanté",
		position: "MID",
		goals: 11,
		assists: 15,
		appearances: 187,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "fabinho",
		name: "Fabinho",
		position: "MID",
		goals: 8,
		assists: 10,
		appearances: 136,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "flekken",
		name: "Flekken",
		position: "GK",
		goals: 0,
		assists: 3,
		appearances: 74,
		clubs: [
			"Brentford"
		],
		firstSeason: 2023,
		lastSeason: 2024
	},
	{
		id: "salah",
		name: "Salah",
		position: "MID",
		goals: 191,
		assists: 104,
		appearances: 293,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "durm",
		name: "Durm",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 28,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "schar",
		name: "Schär",
		position: "DEF",
		goals: 18,
		assists: 12,
		appearances: 191,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "allan",
		name: "Allan",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 52,
		clubs: [
			"Everton"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "weghorst",
		name: "Weghorst",
		position: "FWD",
		goals: 2,
		assists: 4,
		appearances: 30,
		clubs: [
			"Burnley",
			"Man Utd"
		],
		firstSeason: 2021,
		lastSeason: 2023
	},
	{
		id: "andre-gomes",
		name: "André Gomes",
		position: "MID",
		goals: 2,
		assists: 5,
		appearances: 91,
		clubs: [
			"Everton"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "cancelo",
		name: "Cancelo",
		position: "DEF",
		goals: 5,
		assists: 17,
		appearances: 84,
		clubs: [
			"Man City"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "ederson",
		name: "Ederson",
		position: "GK",
		goals: 0,
		assists: 7,
		appearances: 263,
		clubs: [
			"Man City"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "funes-mori",
		name: "Funes Mori",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 27,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "doucoure",
		name: "Doucouré",
		position: "MID",
		goals: 36,
		assists: 30,
		appearances: 266,
		clubs: [
			"Watford",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "paterson",
		name: "Paterson",
		position: "MID",
		goals: 4,
		assists: 2,
		appearances: 27,
		clubs: [
			"Cardiff"
		],
		firstSeason: 2018,
		lastSeason: 2018
	},
	{
		id: "robertson",
		name: "Robertson",
		position: "DEF",
		goals: 12,
		assists: 61,
		appearances: 273,
		clubs: [
			"Hull City",
			"Liverpool",
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "mcginn",
		name: "McGinn",
		position: "MID",
		goals: 22,
		assists: 32,
		appearances: 210,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "hause",
		name: "Hause",
		position: "DEF",
		goals: 3,
		assists: 0,
		appearances: 32,
		clubs: [
			"Wolves",
			"Aston Villa"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "ziyech",
		name: "Ziyech",
		position: "MID",
		goals: 6,
		assists: 9,
		appearances: 51,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "ake",
		name: "Aké",
		position: "DEF",
		goals: 17,
		assists: 10,
		appearances: 194,
		clubs: [
			"Chelsea",
			"Bournemouth",
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "loftus-cheek",
		name: "Loftus-Cheek",
		position: "MID",
		goals: 9,
		assists: 12,
		appearances: 124,
		clubs: [
			"Chelsea",
			"Crystal Palace",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "boufal",
		name: "Boufal",
		position: "MID",
		goals: 3,
		assists: 6,
		appearances: 70,
		clubs: [
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "n-rgaard",
		name: "Nørgaard",
		position: "MID",
		goals: 11,
		assists: 16,
		appearances: 117,
		clubs: [
			"Brentford",
			"Arsenal",
			"Everton"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "mitrovic",
		name: "Mitrovic",
		position: "FWD",
		goals: 29,
		assists: 9,
		appearances: 81,
		clubs: [
			"Newcastle",
			"Fulham"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "ryan",
		name: "Ryan",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 124,
		clubs: [
			"Brighton",
			"Arsenal"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "h-jbjerg",
		name: "Højbjerg",
		position: "MID",
		goals: 12,
		assists: 18,
		appearances: 213,
		clubs: [
			"Southampton",
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "christensen",
		name: "Christensen",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 92,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2017,
		lastSeason: 2021
	},
	{
		id: "danso",
		name: "Danso",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 32,
		clubs: [
			"Southampton",
			"Spurs"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "meyer",
		name: "Meyer",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 46,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "fernandes",
		name: "Fernandes",
		position: "MID",
		goals: 71,
		assists: 83,
		appearances: 218,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "toney",
		name: "Toney",
		position: "FWD",
		goals: 36,
		assists: 12,
		appearances: 69,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2024
	},
	{
		id: "ndong",
		name: "Ndong",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 31,
		clubs: [
			"Sunderland",
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2017
	},
	{
		id: "ajayi",
		name: "Ajayi",
		position: "DEF",
		goals: 3,
		assists: 1,
		appearances: 34,
		clubs: [
			"West Brom",
			"Hull City"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "o-connell",
		name: "O'Connell",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 35,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "laporte",
		name: "Laporte",
		position: "DEF",
		goals: 8,
		assists: 5,
		appearances: 117,
		clubs: [
			"Man City"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "depoitre",
		name: "Depoitre",
		position: "FWD",
		goals: 6,
		assists: 3,
		appearances: 56,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "martial",
		name: "Martial",
		position: "MID",
		goals: 52,
		assists: 36,
		appearances: 159,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "trezeguet",
		name: "Trézéguet",
		position: "MID",
		goals: 8,
		assists: 3,
		appearances: 56,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "sa",
		name: "Sá",
		position: "GK",
		goals: 0,
		assists: 2,
		appearances: 146,
		clubs: [
			"Wolves"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "mawson",
		name: "Mawson",
		position: "DEF",
		goals: 6,
		assists: 1,
		appearances: 80,
		clubs: [
			"Swansea",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "mings",
		name: "Mings",
		position: "DEF",
		goals: 6,
		assists: 13,
		appearances: 172,
		clubs: [
			"Bournemouth",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "cornet",
		name: "Cornet",
		position: "MID",
		goals: 10,
		assists: 2,
		appearances: 29,
		clubs: [
			"Burnley",
			"West Ham",
			"Southampton"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "slimani",
		name: "Slimani",
		position: "FWD",
		goals: 8,
		assists: 5,
		appearances: 40,
		clubs: [
			"Leicester",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "llorente-2",
		name: "Llorente",
		position: "DEF",
		goals: 4,
		assists: 0,
		appearances: 43,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "lemina",
		name: "Lemina",
		position: "MID",
		goals: 8,
		assists: 9,
		appearances: 140,
		clubs: [
			"Southampton",
			"Fulham",
			"Wolves"
		],
		firstSeason: 2017,
		lastSeason: 2024
	},
	{
		id: "yedlin",
		name: "Yedlin",
		position: "DEF",
		goals: 2,
		assists: 4,
		appearances: 85,
		clubs: [
			"Spurs",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "dendoncker",
		name: "Dendoncker",
		position: "MID",
		goals: 10,
		assists: 6,
		appearances: 125,
		clubs: [
			"Wolves",
			"Aston Villa"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "lerma",
		name: "Lerma",
		position: "MID",
		goals: 9,
		assists: 11,
		appearances: 157,
		clubs: [
			"Bournemouth",
			"Crystal Palace"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "telles",
		name: "Telles",
		position: "DEF",
		goals: 0,
		assists: 6,
		appearances: 30,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "origi",
		name: "Origi",
		position: "FWD",
		goals: 17,
		assists: 9,
		appearances: 97,
		clubs: [
			"Liverpool",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "hayden",
		name: "Hayden",
		position: "MID",
		goals: 4,
		assists: 8,
		appearances: 118,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "iwobi",
		name: "Iwobi",
		position: "MID",
		goals: 33,
		assists: 42,
		appearances: 286,
		clubs: [
			"Arsenal",
			"Everton",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "elneny",
		name: "Elneny",
		position: "MID",
		goals: 1,
		assists: 5,
		appearances: 72,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "reed",
		name: "Reed",
		position: "MID",
		goals: 4,
		assists: 9,
		appearances: 71,
		clubs: [
			"Southampton",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "kenny",
		name: "Kenny",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 49,
		clubs: [
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "wilson",
		name: "Wilson",
		position: "MID",
		goals: 29,
		assists: 24,
		appearances: 103,
		clubs: [
			"Liverpool",
			"Bournemouth",
			"Fulham",
			"Leeds"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "lundstram",
		name: "Lundstram",
		position: "DEF",
		goals: 5,
		assists: 6,
		appearances: 62,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "maitland-niles",
		name: "Maitland-Niles",
		position: "MID",
		goals: 1,
		assists: 6,
		appearances: 95,
		clubs: [
			"Arsenal",
			"West Brom",
			"Southampton"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "palhinha",
		name: "Palhinha",
		position: "MID",
		goals: 12,
		assists: 4,
		appearances: 76,
		clubs: [
			"Fulham",
			"Spurs"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "raya",
		name: "Raya",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 156,
		clubs: [
			"Brentford",
			"Arsenal"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "solanke",
		name: "Solanke",
		position: "FWD",
		goals: 41,
		assists: 23,
		appearances: 157,
		clubs: [
			"Chelsea",
			"Liverpool",
			"Bournemouth",
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "januzaj",
		name: "Januzaj",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 25,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2016,
		lastSeason: 2016
	},
	{
		id: "phillips-2",
		name: "Phillips",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 68,
		clubs: [
			"Leeds",
			"Man City",
			"West Ham",
			"Ipswich Town"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "lewis-cook",
		name: "Lewis Cook",
		position: "MID",
		goals: 1,
		assists: 15,
		appearances: 154,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "a-armstrong",
		name: "A.Armstrong",
		position: "FWD",
		goals: 8,
		assists: 9,
		appearances: 56,
		clubs: [
			"Southampton",
			"Wolves"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "amartey",
		name: "Amartey",
		position: "MID",
		goals: 2,
		assists: 1,
		appearances: 90,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "masina",
		name: "Masina",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 55,
		clubs: [
			"Watford"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "perez",
		name: "Pérez",
		position: "FWD",
		goals: 4,
		assists: 1,
		appearances: 26,
		clubs: [
			"Arsenal",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "holding",
		name: "Holding",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 90,
		clubs: [
			"Arsenal",
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "pereira-2",
		name: "Pereira",
		position: "MID",
		goals: 11,
		assists: 29,
		appearances: 118,
		clubs: [
			"Man Utd",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "morris",
		name: "Morris",
		position: "FWD",
		goals: 11,
		assists: 6,
		appearances: 32,
		clubs: [
			"Luton"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "winks",
		name: "Winks",
		position: "MID",
		goals: 2,
		assists: 6,
		appearances: 145,
		clubs: [
			"Spurs",
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "sema",
		name: "Sema",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 35,
		clubs: [
			"Watford"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "minamino",
		name: "Minamino",
		position: "MID",
		goals: 6,
		assists: 0,
		appearances: 40,
		clubs: [
			"Liverpool",
			"Southampton"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "christie-2",
		name: "Christie",
		position: "MID",
		goals: 5,
		assists: 11,
		appearances: 84,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "walker-peters",
		name: "Walker-Peters",
		position: "DEF",
		goals: 3,
		assists: 15,
		appearances: 151,
		clubs: [
			"Spurs",
			"Southampton",
			"West Ham"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "aina",
		name: "Aina",
		position: "DEF",
		goals: 5,
		assists: 5,
		appearances: 108,
		clubs: [
			"Chelsea",
			"Fulham",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "traore-2",
		name: "Traoré",
		position: "MID",
		goals: 14,
		assists: 31,
		appearances: 177,
		clubs: [
			"Middlesbrough",
			"Wolves",
			"Fulham",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "fernandes-2",
		name: "Fernandes",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 42,
		clubs: [
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "mina",
		name: "Mina",
		position: "DEF",
		goals: 7,
		assists: 1,
		appearances: 85,
		clubs: [
			"Everton"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "coufal",
		name: "Coufal",
		position: "DEF",
		goals: 0,
		assists: 22,
		appearances: 126,
		clubs: [
			"West Ham"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "werner",
		name: "Werner",
		position: "FWD",
		goals: 12,
		assists: 21,
		appearances: 70,
		clubs: [
			"Chelsea",
			"Spurs"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "jahanbakhsh",
		name: "Jahanbakhsh",
		position: "MID",
		goals: 2,
		assists: 2,
		appearances: 50,
		clubs: [
			"Brighton"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "diego-carlos",
		name: "Diego Carlos",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "costa-2",
		name: "Costa",
		position: "MID",
		goals: 4,
		assists: 6,
		appearances: 48,
		clubs: [
			"Wolves",
			"Leeds"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "bernardo-silva",
		name: "Bernardo Silva",
		position: "MID",
		goals: 45,
		assists: 58,
		appearances: 271,
		clubs: [
			"Man City"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "janssen",
		name: "Janssen",
		position: "FWD",
		goals: 2,
		assists: 3,
		appearances: 31,
		clubs: [
			"Spurs"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "cavaleiro",
		name: "Cavaleiro",
		position: "MID",
		goals: 6,
		assists: 1,
		appearances: 59,
		clubs: [
			"Wolves",
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "castagne",
		name: "Castagne",
		position: "DEF",
		goals: 6,
		assists: 16,
		appearances: 145,
		clubs: [
			"Leicester",
			"Fulham"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "balbuena",
		name: "Balbuena",
		position: "DEF",
		goals: 3,
		assists: 0,
		appearances: 54,
		clubs: [
			"West Ham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "tielemans",
		name: "Tielemans",
		position: "MID",
		goals: 26,
		assists: 39,
		appearances: 208,
		clubs: [
			"Leicester",
			"Aston Villa",
			"Man Utd"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "tete",
		name: "Tete",
		position: "DEF",
		goals: 3,
		assists: 8,
		appearances: 95,
		clubs: [
			"Fulham"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "hoedt",
		name: "Hoedt",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 41,
		clubs: [
			"Southampton"
		],
		firstSeason: 2017,
		lastSeason: 2019
	},
	{
		id: "partey",
		name: "Partey",
		position: "MID",
		goals: 9,
		assists: 7,
		appearances: 106,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "izquierdo",
		name: "Izquierdo",
		position: "MID",
		goals: 5,
		assists: 7,
		appearances: 48,
		clubs: [
			"Brighton"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "kenedy",
		name: "Kenedy",
		position: "MID",
		goals: 3,
		assists: 4,
		appearances: 41,
		clubs: [
			"Chelsea",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "osborn",
		name: "Osborn",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 51,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "perez-2",
		name: "Pérez",
		position: "MID",
		goals: 32,
		assists: 19,
		appearances: 147,
		clubs: [
			"Newcastle",
			"Leicester"
		],
		firstSeason: 2017,
		lastSeason: 2022
	},
	{
		id: "billing",
		name: "Billing",
		position: "MID",
		goals: 12,
		assists: 6,
		appearances: 113,
		clubs: [
			"Huddersfield",
			"Bournemouth"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "bakayoko",
		name: "Bakayoko",
		position: "MID",
		goals: 2,
		assists: 2,
		appearances: 29,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "mounie",
		name: "Mounie",
		position: "FWD",
		goals: 9,
		assists: 6,
		appearances: 59,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "alexander-arnold",
		name: "Alexander-Arnold",
		position: "DEF",
		goals: 18,
		assists: 73,
		appearances: 237,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "targett",
		name: "Targett",
		position: "DEF",
		goals: 3,
		assists: 12,
		appearances: 125,
		clubs: [
			"Southampton",
			"Aston Villa",
			"Newcastle",
			"Hull City"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "mcburnie",
		name: "McBurnie",
		position: "FWD",
		goals: 13,
		assists: 8,
		appearances: 91,
		clubs: [
			"Swansea",
			"Sheffield Utd",
			"Hull City"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "robinson",
		name: "Robinson",
		position: "DEF",
		goals: 1,
		assists: 18,
		appearances: 141,
		clubs: [
			"Fulham"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "saint-maximin",
		name: "Saint-Maximin",
		position: "MID",
		goals: 12,
		assists: 23,
		appearances: 94,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "seri",
		name: "Seri",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 32,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "lenglet",
		name: "Lenglet",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 32,
		clubs: [
			"Spurs",
			"Aston Villa"
		],
		firstSeason: 2022,
		lastSeason: 2023
	},
	{
		id: "rico-2",
		name: "Rico",
		position: "DEF",
		goals: 0,
		assists: 5,
		appearances: 39,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2018,
		lastSeason: 2019
	},
	{
		id: "gomez",
		name: "Gomez",
		position: "DEF",
		goals: 0,
		assists: 7,
		appearances: 119,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "dias",
		name: "Dias",
		position: "DEF",
		goals: 5,
		assists: 6,
		appearances: 152,
		clubs: [
			"Man City"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "neves",
		name: "Neves",
		position: "MID",
		goals: 21,
		assists: 10,
		appearances: 162,
		clubs: [
			"Wolves"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "bednarek",
		name: "Bednarek",
		position: "DEF",
		goals: 9,
		assists: 3,
		appearances: 179,
		clubs: [
			"Southampton",
			"Aston Villa"
		],
		firstSeason: 2017,
		lastSeason: 2024
	},
	{
		id: "callum-robinson",
		name: "Callum Robinson",
		position: "MID",
		goals: 6,
		assists: 5,
		appearances: 44,
		clubs: [
			"Sheffield Utd",
			"West Brom"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "hadergjonaj",
		name: "Hadergjonaj",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 47,
		clubs: [
			"Huddersfield"
		],
		firstSeason: 2017,
		lastSeason: 2018
	},
	{
		id: "cullen",
		name: "Cullen",
		position: "MID",
		goals: 4,
		assists: 6,
		appearances: 43,
		clubs: [
			"West Ham",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "gray-2",
		name: "Gray",
		position: "MID",
		goals: 19,
		assists: 18,
		appearances: 168,
		clubs: [
			"Leicester",
			"Everton"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "henderson-2",
		name: "Henderson",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 147,
		clubs: [
			"Sheffield Utd",
			"Man Utd",
			"Nott'm Forest",
			"Crystal Palace"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "maddison",
		name: "Maddison",
		position: "MID",
		goals: 56,
		assists: 58,
		appearances: 196,
		clubs: [
			"Leicester",
			"Spurs"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "brownhill",
		name: "Brownhill",
		position: "MID",
		goals: 6,
		assists: 6,
		appearances: 101,
		clubs: [
			"Burnley"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "benrahma",
		name: "Benrahma",
		position: "MID",
		goals: 15,
		assists: 16,
		appearances: 83,
		clubs: [
			"West Ham"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "chilwell",
		name: "Chilwell",
		position: "DEF",
		goals: 13,
		assists: 22,
		appearances: 154,
		clubs: [
			"Leicester",
			"Chelsea",
			"Crystal Palace"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "success",
		name: "Success",
		position: "FWD",
		goals: 2,
		assists: 2,
		appearances: 54,
		clubs: [
			"Watford"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "iheanacho",
		name: "Iheanacho",
		position: "FWD",
		goals: 34,
		assists: 29,
		appearances: 152,
		clubs: [
			"Man City",
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2022
	},
	{
		id: "davies-2-2",
		name: "Davies",
		position: "MID",
		goals: 6,
		assists: 7,
		appearances: 137,
		clubs: [
			"Everton",
			"Sheffield Utd"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "roberts",
		name: "Roberts",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 50,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "abraham",
		name: "Abraham",
		position: "FWD",
		goals: 28,
		assists: 11,
		appearances: 89,
		clubs: [
			"Swansea",
			"Chelsea",
			"Aston Villa"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "sanchez-2",
		name: "Sánchez",
		position: "DEF",
		goals: 3,
		assists: 5,
		appearances: 126,
		clubs: [
			"Spurs"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "riedewald",
		name: "Riedewald",
		position: "MID",
		goals: 2,
		assists: 0,
		appearances: 67,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "andersen",
		name: "Andersen",
		position: "DEF",
		goals: 4,
		assists: 9,
		appearances: 186,
		clubs: [
			"Fulham",
			"Crystal Palace"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "canos",
		name: "Canós",
		position: "MID",
		goals: 3,
		assists: 3,
		appearances: 31,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2023
	},
	{
		id: "keita",
		name: "Keita",
		position: "MID",
		goals: 7,
		assists: 6,
		appearances: 79,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "camarasa",
		name: "Camarasa",
		position: "MID",
		goals: 5,
		assists: 4,
		appearances: 33,
		clubs: [
			"Cardiff",
			"Crystal Palace"
		],
		firstSeason: 2018,
		lastSeason: 2019
	},
	{
		id: "rashford",
		name: "Rashford",
		position: "MID",
		goals: 84,
		assists: 50,
		appearances: 255,
		clubs: [
			"Man Utd",
			"Aston Villa"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "pulisic",
		name: "Pulisic",
		position: "MID",
		goals: 20,
		assists: 14,
		appearances: 79,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "furlong",
		name: "Furlong",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 35,
		clubs: [
			"West Brom",
			"Ipswich Town"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "calvert-lewin",
		name: "Calvert-Lewin",
		position: "FWD",
		goals: 71,
		assists: 30,
		appearances: 251,
		clubs: [
			"Everton",
			"Leeds"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "bowen",
		name: "Bowen",
		position: "MID",
		goals: 65,
		assists: 66,
		appearances: 222,
		clubs: [
			"Hull City",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "watkins",
		name: "Watkins",
		position: "FWD",
		goals: 91,
		assists: 50,
		appearances: 196,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "mousset",
		name: "Mousset",
		position: "FWD",
		goals: 9,
		assists: 5,
		appearances: 99,
		clubs: [
			"Bournemouth",
			"Sheffield Utd"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "almiron",
		name: "Almirón",
		position: "MID",
		goals: 23,
		assists: 11,
		appearances: 149,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "cucurella",
		name: "Cucurella",
		position: "DEF",
		goals: 7,
		assists: 12,
		appearances: 129,
		clubs: [
			"Brighton",
			"Chelsea"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "bruun-larsen",
		name: "Bruun Larsen",
		position: "MID",
		goals: 6,
		assists: 1,
		appearances: 26,
		clubs: [
			"Burnley"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "mangala",
		name: "Mangala",
		position: "MID",
		goals: 3,
		assists: 1,
		appearances: 50,
		clubs: [
			"Nott'm Forest",
			"Everton"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "diangana",
		name: "Diangana",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 37,
		clubs: [
			"West Ham",
			"West Brom"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "longstaff",
		name: "Longstaff",
		position: "MID",
		goals: 12,
		assists: 16,
		appearances: 144,
		clubs: [
			"Newcastle",
			"Leeds"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "vlasic",
		name: "Vlasic",
		position: "MID",
		goals: 1,
		assists: 0,
		appearances: 31,
		clubs: [
			"Everton",
			"West Ham"
		],
		firstSeason: 2017,
		lastSeason: 2023
	},
	{
		id: "van-de-beek",
		name: "van de Beek",
		position: "MID",
		goals: 3,
		assists: 2,
		appearances: 35,
		clubs: [
			"Man Utd",
			"Everton"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "grant-2",
		name: "Grant",
		position: "FWD",
		goals: 4,
		assists: 2,
		appearances: 34,
		clubs: [
			"Huddersfield",
			"West Brom"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "chalobah-2",
		name: "Chalobah",
		position: "DEF",
		goals: 10,
		assists: 3,
		appearances: 95,
		clubs: [
			"Chelsea",
			"Crystal Palace"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "tuanzebe",
		name: "Tuanzebe",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 62,
		clubs: [
			"Man Utd",
			"Aston Villa",
			"Ipswich Town",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "joelinton",
		name: "Joelinton",
		position: "MID",
		goals: 24,
		assists: 17,
		appearances: 190,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "sane",
		name: "Sané",
		position: "MID",
		goals: 25,
		assists: 34,
		appearances: 90,
		clubs: [
			"Man City"
		],
		firstSeason: 2016,
		lastSeason: 2019
	},
	{
		id: "ceballos",
		name: "Ceballos",
		position: "MID",
		goals: 0,
		assists: 6,
		appearances: 49,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2019,
		lastSeason: 2020
	},
	{
		id: "degaard",
		name: "Ødegaard",
		position: "MID",
		goals: 36,
		assists: 41,
		appearances: 153,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "vicario",
		name: "Vicario",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 93,
		clubs: [
			"Spurs"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "mount",
		name: "Mount",
		position: "MID",
		goals: 32,
		assists: 28,
		appearances: 138,
		clubs: [
			"Chelsea",
			"Man Utd"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "sessegnon",
		name: "Sessegnon",
		position: "DEF",
		goals: 11,
		assists: 16,
		appearances: 84,
		clubs: [
			"Fulham",
			"Spurs"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "lindelof",
		name: "Lindelöf",
		position: "DEF",
		goals: 4,
		assists: 6,
		appearances: 183,
		clubs: [
			"Man Utd",
			"Aston Villa"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "nakamba",
		name: "Nakamba",
		position: "MID",
		goals: 0,
		assists: 1,
		appearances: 71,
		clubs: [
			"Aston Villa",
			"Luton"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "hwang",
		name: "Hwang",
		position: "MID",
		goals: 24,
		assists: 9,
		appearances: 87,
		clubs: [
			"Wolves"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "ajer",
		name: "Ajer",
		position: "DEF",
		goals: 3,
		assists: 6,
		appearances: 86,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "roberts-2",
		name: "Roberts",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 33,
		clubs: [
			"Swansea",
			"Burnley"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "tierney",
		name: "Tierney",
		position: "DEF",
		goals: 4,
		assists: 10,
		appearances: 69,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "cantwell",
		name: "Cantwell",
		position: "MID",
		goals: 6,
		assists: 2,
		appearances: 45,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "el-ghazi",
		name: "El Ghazi",
		position: "MID",
		goals: 15,
		assists: 6,
		appearances: 73,
		clubs: [
			"Aston Villa",
			"Everton"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "koch",
		name: "Koch",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 60,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "henry",
		name: "Henry",
		position: "DEF",
		goals: 3,
		assists: 6,
		appearances: 76,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "holgate",
		name: "Holgate",
		position: "DEF",
		goals: 3,
		assists: 7,
		appearances: 129,
		clubs: [
			"Everton",
			"Sheffield Utd"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "bergwijn",
		name: "Bergwijn",
		position: "MID",
		goals: 7,
		assists: 7,
		appearances: 60,
		clubs: [
			"Spurs"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "jota",
		name: "Jota",
		position: "MID",
		goals: 63,
		assists: 33,
		appearances: 159,
		clubs: [
			"Wolves",
			"Liverpool"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "lewis",
		name: "Lewis",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 57,
		clubs: [
			"Norwich",
			"Newcastle"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "merino",
		name: "Merino",
		position: "MID",
		goals: 12,
		assists: 6,
		appearances: 51,
		clubs: [
			"Newcastle",
			"Arsenal"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "brewster",
		name: "Brewster",
		position: "FWD",
		goals: 0,
		assists: 0,
		appearances: 30,
		clubs: [
			"Liverpool",
			"Sheffield Utd"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "buendia",
		name: "Buendía",
		position: "MID",
		goals: 16,
		assists: 18,
		appearances: 114,
		clubs: [
			"Norwich",
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "pepe",
		name: "Pépé",
		position: "MID",
		goals: 16,
		assists: 13,
		appearances: 80,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "mctominay",
		name: "McTominay",
		position: "MID",
		goals: 18,
		assists: 7,
		appearances: 142,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "hamer",
		name: "Hamer",
		position: "MID",
		goals: 4,
		assists: 7,
		appearances: 34,
		clubs: [
			"Sheffield Utd",
			"Coventry City"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "muto",
		name: "Muto",
		position: "FWD",
		goals: 1,
		assists: 0,
		appearances: 25,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "bailly",
		name: "Bailly",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 70,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2016,
		lastSeason: 2023
	},
	{
		id: "choudhury",
		name: "Choudhury",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 54,
		clubs: [
			"Leicester"
		],
		firstSeason: 2017,
		lastSeason: 2024
	},
	{
		id: "burke",
		name: "Burke",
		position: "MID",
		goals: 1,
		assists: 4,
		appearances: 40,
		clubs: [
			"West Brom",
			"Sheffield Utd"
		],
		firstSeason: 2017,
		lastSeason: 2020
	},
	{
		id: "godfrey",
		name: "Godfrey",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 108,
		clubs: [
			"Norwich",
			"Everton",
			"Ipswich Town"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "torreira",
		name: "Torreira",
		position: "MID",
		goals: 3,
		assists: 5,
		appearances: 63,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "white",
		name: "White",
		position: "DEF",
		goals: 6,
		assists: 14,
		appearances: 149,
		clubs: [
			"Brighton",
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "niakhate",
		name: "Niakhaté",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 27,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2022,
		lastSeason: 2023
	},
	{
		id: "reguilon",
		name: "Reguilón",
		position: "DEF",
		goals: 2,
		assists: 16,
		appearances: 71,
		clubs: [
			"Spurs",
			"Man Utd",
			"Brentford"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "tanganga",
		name: "Tanganga",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 25,
		clubs: [
			"Spurs"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "ampadu",
		name: "Ampadu",
		position: "DEF",
		goals: 1,
		assists: 4,
		appearances: 62,
		clubs: [
			"Chelsea",
			"Sheffield Utd",
			"Leeds"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "edouard",
		name: "Edouard",
		position: "FWD",
		goals: 18,
		assists: 6,
		appearances: 57,
		clubs: [
			"Crystal Palace",
			"Leicester"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "cash",
		name: "Cash",
		position: "DEF",
		goals: 10,
		assists: 13,
		appearances: 157,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "konsa",
		name: "Konsa",
		position: "DEF",
		goals: 8,
		assists: 4,
		appearances: 216,
		clubs: [
			"Aston Villa",
			"Arsenal"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "willock",
		name: "Willock",
		position: "MID",
		goals: 16,
		assists: 15,
		appearances: 128,
		clubs: [
			"Arsenal",
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "semedo",
		name: "Semedo",
		position: "DEF",
		goals: 1,
		assists: 11,
		appearances: 151,
		clubs: [
			"Wolves"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "adams",
		name: "Adams",
		position: "FWD",
		goals: 25,
		assists: 20,
		appearances: 108,
		clubs: [
			"Southampton"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "podence",
		name: "Podence",
		position: "MID",
		goals: 12,
		assists: 7,
		appearances: 67,
		clubs: [
			"Wolves"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "james",
		name: "James",
		position: "MID",
		goals: 12,
		assists: 13,
		appearances: 90,
		clubs: [
			"Swansea",
			"Man Utd",
			"Leeds",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "nelson",
		name: "Nelson",
		position: "MID",
		goals: 5,
		assists: 6,
		appearances: 29,
		clubs: [
			"Arsenal",
			"Fulham",
			"Brentford"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "kelleher",
		name: "Kelleher",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 63,
		clubs: [
			"Liverpool",
			"Brentford"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "adams-2",
		name: "Adams",
		position: "MID",
		goals: 2,
		assists: 5,
		appearances: 55,
		clubs: [
			"Leeds",
			"Bournemouth"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "lo-celso",
		name: "Lo Celso",
		position: "MID",
		goals: 3,
		assists: 6,
		appearances: 59,
		clubs: [
			"Spurs"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "mukiele",
		name: "Mukiele",
		position: "DEF",
		goals: 3,
		assists: 5,
		appearances: 32,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "fosu-mensah",
		name: "Fosu-Mensah",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 41,
		clubs: [
			"Man Utd",
			"Crystal Palace",
			"Fulham"
		],
		firstSeason: 2016,
		lastSeason: 2020
	},
	{
		id: "trusty",
		name: "Trusty",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "tavernier",
		name: "Tavernier",
		position: "MID",
		goals: 19,
		assists: 19,
		appearances: 82,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "barnes-2",
		name: "Barnes",
		position: "MID",
		goals: 56,
		assists: 41,
		appearances: 176,
		clubs: [
			"Leicester",
			"Newcastle"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "alderete",
		name: "Alderete",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 32,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "onana",
		name: "Onana",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 72,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "bentancur",
		name: "Bentancur",
		position: "MID",
		goals: 9,
		assists: 8,
		appearances: 79,
		clubs: [
			"Spurs"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "zambo-anguissa",
		name: "Zambo Anguissa",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 58,
		clubs: [
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2020
	},
	{
		id: "ndidi",
		name: "Ndidi",
		position: "MID",
		goals: 7,
		assists: 18,
		appearances: 205,
		clubs: [
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2024
	},
	{
		id: "guilbert",
		name: "Guilbert",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 25,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "tella",
		name: "Tella",
		position: "MID",
		goals: 1,
		assists: 4,
		appearances: 33,
		clubs: [
			"Southampton"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "estupinan",
		name: "Estupiñán",
		position: "DEF",
		goals: 4,
		assists: 11,
		appearances: 65,
		clubs: [
			"Brighton"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "rice",
		name: "Rice",
		position: "MID",
		goals: 25,
		assists: 38,
		appearances: 295,
		clubs: [
			"West Ham",
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "janelt",
		name: "Janelt",
		position: "MID",
		goals: 11,
		assists: 12,
		appearances: 125,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "konate",
		name: "Konaté",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 110,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "donnarumma",
		name: "Donnarumma",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 35,
		clubs: [
			"Man City"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "yates",
		name: "Yates",
		position: "MID",
		goals: 3,
		assists: 8,
		appearances: 52,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "sobhi",
		name: "Sobhi",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 45,
		clubs: [
			"Stoke",
			"Huddersfield"
		],
		firstSeason: 2016,
		lastSeason: 2018
	},
	{
		id: "nketiah",
		name: "Nketiah",
		position: "FWD",
		goals: 24,
		assists: 10,
		appearances: 90,
		clubs: [
			"Arsenal",
			"Crystal Palace"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "jesus",
		name: "Jesus",
		position: "FWD",
		goals: 79,
		assists: 51,
		appearances: 196,
		clubs: [
			"Man City",
			"Arsenal"
		],
		firstSeason: 2016,
		lastSeason: 2026
	},
	{
		id: "zinchenko",
		name: "Zinchenko",
		position: "DEF",
		goals: 2,
		assists: 12,
		appearances: 125,
		clubs: [
			"Man City",
			"Arsenal",
			"Nott'm Forest"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "jones-2-2",
		name: "Jones",
		position: "MID",
		goals: 11,
		assists: 13,
		appearances: 107,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "berge",
		name: "Berge",
		position: "MID",
		goals: 3,
		assists: 7,
		appearances: 124,
		clubs: [
			"Sheffield Utd",
			"Burnley",
			"Fulham"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "jensen",
		name: "Jensen",
		position: "MID",
		goals: 11,
		assists: 17,
		appearances: 116,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "bruno-guimaraes",
		name: "Bruno Guimarães",
		position: "MID",
		goals: 30,
		assists: 28,
		appearances: 140,
		clubs: [
			"Newcastle",
			"Arsenal"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "worrall",
		name: "Worrall",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 25,
		clubs: [
			"Nott'm Forest",
			"Burnley"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "guehi",
		name: "Guehi",
		position: "DEF",
		goals: 10,
		assists: 9,
		appearances: 153,
		clubs: [
			"Chelsea",
			"Crystal Palace",
			"Man City"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "skipp",
		name: "Skipp",
		position: "MID",
		goals: 1,
		assists: 0,
		appearances: 64,
		clubs: [
			"Spurs",
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "hudson-odoi",
		name: "Hudson-Odoi",
		position: "MID",
		goals: 20,
		assists: 22,
		appearances: 138,
		clubs: [
			"Chelsea",
			"Nott'm Forest"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "sancho",
		name: "Sancho",
		position: "MID",
		goals: 12,
		assists: 14,
		appearances: 68,
		clubs: [
			"Man Utd",
			"Chelsea",
			"Aston Villa"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "foden",
		name: "Foden",
		position: "MID",
		goals: 68,
		assists: 40,
		appearances: 186,
		clubs: [
			"Man City"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "smith-rowe",
		name: "Smith-Rowe",
		position: "MID",
		goals: 21,
		assists: 15,
		appearances: 105,
		clubs: [
			"Arsenal",
			"Fulham"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "bernardo",
		name: "Bernardo",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 39,
		clubs: [
			"Brighton"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "de-ligt",
		name: "De Ligt",
		position: "DEF",
		goals: 3,
		assists: 0,
		appearances: 38,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "kamada",
		name: "Kamada",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 38,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "awoniyi",
		name: "Awoniyi",
		position: "FWD",
		goals: 21,
		assists: 6,
		appearances: 29,
		clubs: [
			"Nott'm Forest",
			"Coventry City"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "pereira-2-2",
		name: "Pereira",
		position: "MID",
		goals: 11,
		assists: 7,
		appearances: 33,
		clubs: [
			"West Brom"
		],
		firstSeason: 2020,
		lastSeason: 2020
	},
	{
		id: "sangare",
		name: "Sangaré",
		position: "MID",
		goals: 2,
		assists: 3,
		appearances: 46,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "aguerd",
		name: "Aguerd",
		position: "DEF",
		goals: 3,
		assists: 0,
		appearances: 40,
		clubs: [
			"West Ham"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "akanji",
		name: "Akanji",
		position: "DEF",
		goals: 2,
		assists: 1,
		appearances: 68,
		clubs: [
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "lukic",
		name: "Lukic",
		position: "MID",
		goals: 2,
		assists: 7,
		appearances: 66,
		clubs: [
			"Fulham",
			"Ipswich Town"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "richarlison",
		name: "Richarlison",
		position: "FWD",
		goals: 75,
		assists: 42,
		appearances: 224,
		clubs: [
			"Watford",
			"Everton",
			"Spurs"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "lees-melou",
		name: "Lees-Melou",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 33,
		clubs: [
			"Norwich"
		],
		firstSeason: 2021,
		lastSeason: 2021
	},
	{
		id: "rashica",
		name: "Rashica",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 31,
		clubs: [
			"Norwich"
		],
		firstSeason: 2021,
		lastSeason: 2021
	},
	{
		id: "wesley",
		name: "Wesley",
		position: "FWD",
		goals: 5,
		assists: 1,
		appearances: 25,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "valery",
		name: "Valery",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 42,
		clubs: [
			"Southampton"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "alvarez",
		name: "Álvarez",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 48,
		clubs: [
			"West Ham"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "kilman",
		name: "Kilman",
		position: "DEF",
		goals: 3,
		assists: 4,
		appearances: 168,
		clubs: [
			"Wolves",
			"West Ham"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "rodon",
		name: "Rodon",
		position: "DEF",
		goals: 2,
		assists: 0,
		appearances: 49,
		clubs: [
			"Swansea",
			"Spurs",
			"Leeds"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "tsimikas",
		name: "Tsimikas",
		position: "DEF",
		goals: 0,
		assists: 10,
		appearances: 37,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "wan-bissaka",
		name: "Wan-Bissaka",
		position: "DEF",
		goals: 4,
		assists: 23,
		appearances: 225,
		clubs: [
			"Crystal Palace",
			"Man Utd",
			"West Ham"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "sanchez-2-2",
		name: "Sánchez",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 158,
		clubs: [
			"Brighton",
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "williams-2-2",
		name: "Williams",
		position: "DEF",
		goals: 4,
		assists: 9,
		appearances: 104,
		clubs: [
			"Liverpool",
			"Nott'm Forest"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "anderson",
		name: "Anderson",
		position: "MID",
		goals: 6,
		assists: 14,
		appearances: 85,
		clubs: [
			"Newcastle",
			"Nott'm Forest",
			"Man City"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "dewsbury-hall",
		name: "Dewsbury-Hall",
		position: "MID",
		goals: 12,
		assists: 13,
		appearances: 76,
		clubs: [
			"Leicester",
			"Chelsea",
			"Everton"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "soucek",
		name: "Soucek",
		position: "MID",
		goals: 41,
		assists: 13,
		appearances: 192,
		clubs: [
			"West Ham"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "sargent",
		name: "Sargent",
		position: "FWD",
		goals: 2,
		assists: 2,
		appearances: 26,
		clubs: [
			"Norwich"
		],
		firstSeason: 2021,
		lastSeason: 2021
	},
	{
		id: "bailey",
		name: "Bailey",
		position: "MID",
		goals: 16,
		assists: 23,
		appearances: 72,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "dalot",
		name: "Dalot",
		position: "DEF",
		goals: 4,
		assists: 17,
		appearances: 150,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "vinagre",
		name: "Vinagre",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 35,
		clubs: [
			"Wolves",
			"Everton"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "florentino",
		name: "Florentino",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 25,
		clubs: [
			"Burnley",
			"Ipswich Town"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "o-shea-2",
		name: "O'Shea",
		position: "DEF",
		goals: 3,
		assists: 6,
		appearances: 96,
		clubs: [
			"West Brom",
			"Burnley",
			"Ipswich Town"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "wissa",
		name: "Wissa",
		position: "FWD",
		goals: 45,
		assists: 18,
		appearances: 108,
		clubs: [
			"Brentford",
			"Newcastle"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "fornals",
		name: "Fornals",
		position: "MID",
		goals: 16,
		assists: 18,
		appearances: 117,
		clubs: [
			"West Ham"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "soyuncu",
		name: "Söyüncü",
		position: "DEF",
		goals: 4,
		assists: 1,
		appearances: 96,
		clubs: [
			"Leicester"
		],
		firstSeason: 2018,
		lastSeason: 2022
	},
	{
		id: "faes",
		name: "Faes",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 53,
		clubs: [
			"Leicester"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "isak",
		name: "Isak",
		position: "FWD",
		goals: 57,
		assists: 13,
		appearances: 84,
		clubs: [
			"Newcastle",
			"Liverpool"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "lookman",
		name: "Lookman",
		position: "MID",
		goals: 11,
		assists: 8,
		appearances: 96,
		clubs: [
			"Everton",
			"Fulham",
			"Leicester"
		],
		firstSeason: 2016,
		lastSeason: 2021
	},
	{
		id: "havertz",
		name: "Havertz",
		position: "FWD",
		goals: 44,
		assists: 27,
		appearances: 134,
		clubs: [
			"Chelsea",
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "diop",
		name: "Diop",
		position: "DEF",
		goals: 8,
		assists: 2,
		appearances: 152,
		clubs: [
			"West Ham",
			"Fulham",
			"Ipswich Town"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "raphinha",
		name: "Raphinha",
		position: "MID",
		goals: 17,
		assists: 14,
		appearances: 65,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "botman",
		name: "Botman",
		position: "DEF",
		goals: 3,
		assists: 5,
		appearances: 67,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "disasi",
		name: "Disasi",
		position: "DEF",
		goals: 3,
		assists: 0,
		appearances: 52,
		clubs: [
			"Chelsea",
			"Aston Villa",
			"West Ham"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "rodrigo-2",
		name: "Rodrigo",
		position: "MID",
		goals: 23,
		assists: 23,
		appearances: 176,
		clubs: [
			"Man City"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "downes",
		name: "Downes",
		position: "MID",
		goals: 1,
		assists: 0,
		appearances: 29,
		clubs: [
			"West Ham",
			"Southampton"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "obafemi",
		name: "Obafemi",
		position: "FWD",
		goals: 4,
		assists: 3,
		appearances: 32,
		clubs: [
			"Southampton",
			"Burnley"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "justin",
		name: "Justin",
		position: "DEF",
		goals: 6,
		assists: 8,
		appearances: 105,
		clubs: [
			"Leicester",
			"Leeds"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "greenwood",
		name: "Greenwood",
		position: "MID",
		goals: 22,
		assists: 5,
		appearances: 83,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "davis-2",
		name: "Davis",
		position: "FWD",
		goals: 1,
		assists: 2,
		appearances: 34,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "harrison",
		name: "Harrison",
		position: "MID",
		goals: 25,
		assists: 25,
		appearances: 143,
		clubs: [
			"Leeds",
			"Everton"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "senesi",
		name: "Senesi",
		position: "DEF",
		goals: 6,
		assists: 11,
		appearances: 96,
		clubs: [
			"Bournemouth",
			"Spurs"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "shackleton",
		name: "Shackleton",
		position: "MID",
		goals: 0,
		assists: 1,
		appearances: 27,
		clubs: [
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "romero",
		name: "Romero",
		position: "DEF",
		goals: 11,
		assists: 4,
		appearances: 114,
		clubs: [
			"Spurs"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "martinez-2",
		name: "Martínez",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 52,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "johnson-2",
		name: "Johnson",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 59,
		clubs: [
			"West Ham",
			"Ipswich Town"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "gibbs-white",
		name: "Gibbs-White",
		position: "MID",
		goals: 33,
		assists: 41,
		appearances: 174,
		clubs: [
			"Wolves",
			"Nott'm Forest"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "trincao",
		name: "Trincão",
		position: "MID",
		goals: 2,
		assists: 1,
		appearances: 28,
		clubs: [
			"Wolves"
		],
		firstSeason: 2021,
		lastSeason: 2021
	},
	{
		id: "chong",
		name: "Chong",
		position: "MID",
		goals: 4,
		assists: 2,
		appearances: 25,
		clubs: [
			"Man Utd",
			"Luton"
		],
		firstSeason: 2018,
		lastSeason: 2023
	},
	{
		id: "kluivert",
		name: "Kluivert",
		position: "MID",
		goals: 21,
		assists: 7,
		appearances: 66,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "struijk",
		name: "Struijk",
		position: "DEF",
		goals: 4,
		assists: 4,
		appearances: 103,
		clubs: [
			"Leeds",
			"Brighton"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "haaland",
		name: "Haaland",
		position: "FWD",
		goals: 112,
		assists: 28,
		appearances: 117,
		clubs: [
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "saka",
		name: "Saka",
		position: "MID",
		goals: 61,
		assists: 65,
		appearances: 202,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "igor",
		name: "Igor",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Brighton",
			"West Ham"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "tomiyasu",
		name: "Tomiyasu",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 33,
		clubs: [
			"Arsenal",
			"Crystal Palace"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "ballard",
		name: "Ballard",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 25,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "mepham",
		name: "Mepham",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 41,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "paqueta",
		name: "Paquetá",
		position: "MID",
		goals: 16,
		assists: 14,
		appearances: 97,
		clubs: [
			"West Ham"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "gyokeres",
		name: "Gyokeres",
		position: "FWD",
		goals: 14,
		assists: 1,
		appearances: 26,
		clubs: [
			"Brighton",
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "torres",
		name: "Torres",
		position: "MID",
		goals: 9,
		assists: 5,
		appearances: 28,
		clubs: [
			"Man City"
		],
		firstSeason: 2020,
		lastSeason: 2021
	},
	{
		id: "mykolenko",
		name: "Mykolenko",
		position: "DEF",
		goals: 4,
		assists: 7,
		appearances: 126,
		clubs: [
			"Everton"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "ramsdale",
		name: "Ramsdale",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 181,
		clubs: [
			"Bournemouth",
			"Sheffield Utd",
			"Arsenal",
			"Southampton",
			"Newcastle"
		],
		firstSeason: 2016,
		lastSeason: 2025
	},
	{
		id: "james-2",
		name: "James",
		position: "DEF",
		goals: 10,
		assists: 26,
		appearances: 128,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "soumare",
		name: "Soumaré",
		position: "MID",
		goals: 0,
		assists: 1,
		appearances: 56,
		clubs: [
			"Leicester"
		],
		firstSeason: 2021,
		lastSeason: 2024
	},
	{
		id: "bogle",
		name: "Bogle",
		position: "DEF",
		goals: 6,
		assists: 8,
		appearances: 81,
		clubs: [
			"Sheffield Utd",
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "gabriel",
		name: "Gabriel",
		position: "DEF",
		goals: 19,
		assists: 8,
		appearances: 176,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "kamara",
		name: "Kamara",
		position: "MID",
		goals: 2,
		assists: 5,
		appearances: 72,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "roerslev",
		name: "Roerslev",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 62,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "bissouma",
		name: "Bissouma",
		position: "MID",
		goals: 5,
		assists: 2,
		appearances: 165,
		clubs: [
			"Brighton",
			"Spurs"
		],
		firstSeason: 2018,
		lastSeason: 2025
	},
	{
		id: "milenkovic",
		name: "Milenković",
		position: "DEF",
		goals: 5,
		assists: 3,
		appearances: 75,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "mendy-2-2",
		name: "Mendy",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 67,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "mazraoui",
		name: "Mazraoui",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 46,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "douglas-luiz",
		name: "Douglas Luiz",
		position: "MID",
		goals: 21,
		assists: 20,
		appearances: 174,
		clubs: [
			"Aston Villa",
			"Nott'm Forest"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "dennis",
		name: "Dennis",
		position: "FWD",
		goals: 12,
		assists: 9,
		appearances: 36,
		clubs: [
			"Watford",
			"Nott'm Forest"
		],
		firstSeason: 2021,
		lastSeason: 2024
	},
	{
		id: "bellegarde",
		name: "Bellegarde",
		position: "MID",
		goals: 5,
		assists: 10,
		appearances: 45,
		clubs: [
			"Wolves"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "pinnock",
		name: "Pinnock",
		position: "DEF",
		goals: 8,
		assists: 1,
		appearances: 109,
		clubs: [
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "ndombele",
		name: "Ndombele",
		position: "MID",
		goals: 6,
		assists: 6,
		appearances: 63,
		clubs: [
			"Spurs"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "f-kad-oglu",
		name: "F.Kadıoğlu",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 39,
		clubs: [
			"Brighton"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "s-bueno",
		name: "S.Bueno",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 55,
		clubs: [
			"Wolves"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "mateta",
		name: "Mateta",
		position: "FWD",
		goals: 50,
		assists: 10,
		appearances: 117,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "ugarte",
		name: "Ugarte",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 30,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "sarr",
		name: "Sarr",
		position: "MID",
		goals: 27,
		assists: 18,
		appearances: 104,
		clubs: [
			"Watford",
			"Crystal Palace"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "eze",
		name: "Eze",
		position: "MID",
		goals: 41,
		assists: 30,
		appearances: 141,
		clubs: [
			"Crystal Palace",
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "ramsey-2",
		name: "Ramsey",
		position: "MID",
		goals: 16,
		assists: 17,
		appearances: 118,
		clubs: [
			"Aston Villa",
			"Newcastle"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "gallagher",
		name: "Gallagher",
		position: "MID",
		goals: 19,
		assists: 18,
		appearances: 128,
		clubs: [
			"West Brom",
			"Crystal Palace",
			"Chelsea",
			"Spurs"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "lamptey",
		name: "Lamptey",
		position: "DEF",
		goals: 3,
		assists: 11,
		appearances: 73,
		clubs: [
			"Brighton"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "gordon",
		name: "Gordon",
		position: "MID",
		goals: 31,
		assists: 30,
		appearances: 140,
		clubs: [
			"Everton",
			"Newcastle"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "spence",
		name: "Spence",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 42,
		clubs: [
			"Spurs"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "bassey",
		name: "Bassey",
		position: "DEF",
		goals: 3,
		assists: 1,
		appearances: 88,
		clubs: [
			"Fulham"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "muric",
		name: "Muric",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 28,
		clubs: [
			"Man City",
			"Burnley",
			"Ipswich Town"
		],
		firstSeason: 2018,
		lastSeason: 2024
	},
	{
		id: "garner",
		name: "Garner",
		position: "MID",
		goals: 3,
		assists: 11,
		appearances: 98,
		clubs: [
			"Man Utd",
			"Everton"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "williams-2-2-2",
		name: "Williams",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 47,
		clubs: [
			"Man Utd",
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "aarons",
		name: "Aarons",
		position: "DEF",
		goals: 0,
		assists: 5,
		appearances: 84,
		clubs: [
			"Norwich",
			"Bournemouth"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "connolly",
		name: "Connolly",
		position: "FWD",
		goals: 5,
		assists: 4,
		appearances: 45,
		clubs: [
			"Brighton"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "ahmedhodzic",
		name: "Ahmedhodžić",
		position: "DEF",
		goals: 2,
		assists: 0,
		appearances: 29,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "mavropanos",
		name: "Mavropanos",
		position: "DEF",
		goals: 4,
		assists: 0,
		appearances: 71,
		clubs: [
			"Arsenal",
			"West Ham"
		],
		firstSeason: 2017,
		lastSeason: 2025
	},
	{
		id: "alzate",
		name: "Alzate",
		position: "MID",
		goals: 1,
		assists: 0,
		appearances: 43,
		clubs: [
			"Brighton"
		],
		firstSeason: 2019,
		lastSeason: 2023
	},
	{
		id: "kelly-2",
		name: "Kelly",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 47,
		clubs: [
			"Bournemouth",
			"Newcastle"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "diallo",
		name: "Diallo",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 50,
		clubs: [
			"Southampton"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "emerson-royal",
		name: "Emerson Royal",
		position: "DEF",
		goals: 4,
		assists: 3,
		appearances: 52,
		clubs: [
			"Spurs"
		],
		firstSeason: 2021,
		lastSeason: 2024
	},
	{
		id: "kean",
		name: "Kean",
		position: "FWD",
		goals: 2,
		assists: 2,
		appearances: 32,
		clubs: [
			"Everton"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "guendouzi",
		name: "Guendouzi",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 57,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2018,
		lastSeason: 2021
	},
	{
		id: "badiashile",
		name: "Badiashile",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 34,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "johnson-2-2",
		name: "Johnson",
		position: "MID",
		goals: 26,
		assists: 24,
		appearances: 90,
		clubs: [
			"Nott'm Forest",
			"Spurs",
			"Crystal Palace",
			"Everton"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "mac-allister",
		name: "Mac Allister",
		position: "MID",
		goals: 28,
		assists: 21,
		appearances: 173,
		clubs: [
			"Brighton",
			"Liverpool"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "gakpo",
		name: "Gakpo",
		position: "FWD",
		goals: 33,
		assists: 18,
		appearances: 90,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "moder",
		name: "Moder",
		position: "MID",
		goals: 0,
		assists: 3,
		appearances: 46,
		clubs: [
			"Brighton"
		],
		firstSeason: 2020,
		lastSeason: 2024
	},
	{
		id: "gudmundsson-2",
		name: "Gudmundsson",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 31,
		clubs: [
			"Leeds"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "diaby",
		name: "Diaby",
		position: "MID",
		goals: 6,
		assists: 11,
		appearances: 25,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2023,
		lastSeason: 2024
	},
	{
		id: "gilmour",
		name: "Gilmour",
		position: "MID",
		goals: 0,
		assists: 5,
		appearances: 67,
		clubs: [
			"Chelsea",
			"Norwich",
			"Brighton"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "muniz",
		name: "Muniz",
		position: "FWD",
		goals: 18,
		assists: 4,
		appearances: 36,
		clubs: [
			"Fulham"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "doughty",
		name: "Doughty",
		position: "DEF",
		goals: 2,
		assists: 10,
		appearances: 34,
		clubs: [
			"Luton"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "perraud",
		name: "Perraud",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 33,
		clubs: [
			"Southampton"
		],
		firstSeason: 2021,
		lastSeason: 2022
	},
	{
		id: "thomas",
		name: "Thomas",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 72,
		clubs: [
			"Leicester",
			"Sheffield Utd"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "cucho",
		name: "Cucho",
		position: "FWD",
		goals: 5,
		assists: 2,
		appearances: 25,
		clubs: [
			"Watford"
		],
		firstSeason: 2021,
		lastSeason: 2021
	},
	{
		id: "mitchell",
		name: "Mitchell",
		position: "DEF",
		goals: 4,
		assists: 18,
		appearances: 193,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "luis-diaz",
		name: "Luis Díaz",
		position: "MID",
		goals: 29,
		assists: 19,
		appearances: 77,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "rogers",
		name: "Rogers",
		position: "MID",
		goals: 22,
		assists: 20,
		appearances: 83,
		clubs: [
			"Aston Villa",
			"Chelsea"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "palmer",
		name: "Palmer",
		position: "MID",
		goals: 48,
		assists: 28,
		appearances: 96,
		clubs: [
			"Man City",
			"Chelsea"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "mengi",
		name: "Mengi",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 28,
		clubs: [
			"Man Utd",
			"Luton"
		],
		firstSeason: 2020,
		lastSeason: 2023
	},
	{
		id: "pau",
		name: "Pau",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 69,
		clubs: [
			"Aston Villa"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "daka",
		name: "Daka",
		position: "FWD",
		goals: 10,
		assists: 7,
		appearances: 36,
		clubs: [
			"Leicester"
		],
		firstSeason: 2021,
		lastSeason: 2024
	},
	{
		id: "harwood-bellis",
		name: "Harwood-Bellis",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 32,
		clubs: [
			"Man City",
			"Southampton"
		],
		firstSeason: 2019,
		lastSeason: 2024
	},
	{
		id: "munoz",
		name: "Muñoz",
		position: "DEF",
		goals: 8,
		assists: 14,
		appearances: 83,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "strand-larsen",
		name: "Strand Larsen",
		position: "FWD",
		goals: 18,
		assists: 5,
		appearances: 56,
		clubs: [
			"Wolves",
			"Crystal Palace"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "neto-2",
		name: "Neto",
		position: "MID",
		goals: 20,
		assists: 38,
		appearances: 150,
		clubs: [
			"Wolves",
			"Chelsea"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "madueke",
		name: "Madueke",
		position: "MID",
		goals: 16,
		assists: 9,
		appearances: 63,
		clubs: [
			"Chelsea",
			"Arsenal"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "doku",
		name: "Doku",
		position: "MID",
		goals: 11,
		assists: 24,
		appearances: 53,
		clubs: [
			"Man City"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "lewis-potter",
		name: "Lewis-Potter",
		position: "MID",
		goals: 8,
		assists: 12,
		appearances: 74,
		clubs: [
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "dominguez",
		name: "Dominguez",
		position: "MID",
		goals: 3,
		assists: 4,
		appearances: 59,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "vini-souza",
		name: "Vini Souza",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 29,
		clubs: [
			"Sheffield Utd"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "szoboszlai",
		name: "Szoboszlai",
		position: "MID",
		goals: 16,
		assists: 21,
		appearances: 91,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "richards",
		name: "Richards",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 81,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "aaronson",
		name: "Aaronson",
		position: "MID",
		goals: 5,
		assists: 12,
		appearances: 46,
		clubs: [
			"Leeds"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "onyeka",
		name: "Onyeka",
		position: "MID",
		goals: 1,
		assists: 9,
		appearances: 37,
		clubs: [
			"Brentford",
			"Coventry City"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "cunha",
		name: "Cunha",
		position: "FWD",
		goals: 39,
		assists: 18,
		appearances: 100,
		clubs: [
			"Wolves",
			"Man Utd"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "djenepo",
		name: "Djenepo",
		position: "MID",
		goals: 3,
		assists: 6,
		appearances: 59,
		clubs: [
			"Southampton"
		],
		firstSeason: 2019,
		lastSeason: 2022
	},
	{
		id: "krejci",
		name: "Krejčí",
		position: "DEF",
		goals: 2,
		assists: 2,
		appearances: 27,
		clubs: [
			"Wolves"
		],
		firstSeason: 2025,
		lastSeason: 2025
	},
	{
		id: "tonali",
		name: "Tonali",
		position: "MID",
		goals: 5,
		assists: 4,
		appearances: 65,
		clubs: [
			"Newcastle",
			"Spurs"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "mcatee",
		name: "McAtee",
		position: "MID",
		goals: 6,
		assists: 5,
		appearances: 28,
		clubs: [
			"Man City",
			"Sheffield Utd",
			"Nott'm Forest"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "trafford",
		name: "Trafford",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 33,
		clubs: [
			"Man City",
			"Burnley",
			"Leeds"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "idah",
		name: "Idah",
		position: "FWD",
		goals: 1,
		assists: 2,
		appearances: 29,
		clubs: [
			"Norwich"
		],
		firstSeason: 2019,
		lastSeason: 2021
	},
	{
		id: "collins-2",
		name: "Collins",
		position: "DEF",
		goals: 6,
		assists: 10,
		appearances: 127,
		clubs: [
			"Burnley",
			"Wolves",
			"Brentford"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "mcneil",
		name: "McNeil",
		position: "MID",
		goals: 21,
		assists: 41,
		appearances: 218,
		clubs: [
			"Burnley",
			"Everton",
			"Crystal Palace"
		],
		firstSeason: 2017,
		lastSeason: 2026
	},
	{
		id: "archer",
		name: "Archer",
		position: "FWD",
		goals: 6,
		assists: 3,
		appearances: 37,
		clubs: [
			"Aston Villa",
			"Sheffield Utd",
			"Southampton"
		],
		firstSeason: 2021,
		lastSeason: 2024
	},
	{
		id: "foster-2",
		name: "Foster",
		position: "FWD",
		goals: 8,
		assists: 5,
		appearances: 37,
		clubs: [
			"Burnley"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "meslier",
		name: "Meslier",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 94,
		clubs: [
			"Leeds",
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "lacroix",
		name: "Lacroix",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 71,
		clubs: [
			"Crystal Palace",
			"Chelsea"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "tavares",
		name: "Tavares",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 27,
		clubs: [
			"Arsenal",
			"Nott'm Forest"
		],
		firstSeason: 2021,
		lastSeason: 2023
	},
	{
		id: "semenyo",
		name: "Semenyo",
		position: "MID",
		goals: 37,
		assists: 17,
		appearances: 101,
		clubs: [
			"Bournemouth",
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "sambi-lokonga",
		name: "Sambi Lokonga",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 41,
		clubs: [
			"Arsenal",
			"Crystal Palace",
			"Luton"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "c-doucoure",
		name: "C.Doucouré",
		position: "MID",
		goals: 0,
		assists: 4,
		appearances: 38,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "damsgaard",
		name: "Damsgaard",
		position: "MID",
		goals: 6,
		assists: 18,
		appearances: 73,
		clubs: [
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "broja",
		name: "Broja",
		position: "FWD",
		goals: 9,
		assists: 6,
		appearances: 52,
		clubs: [
			"Chelsea",
			"Southampton",
			"Fulham",
			"Everton",
			"Burnley"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "kiwior",
		name: "Kiwior",
		position: "DEF",
		goals: 3,
		assists: 3,
		appearances: 26,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "ndiaye",
		name: "Ndiaye",
		position: "FWD",
		goals: 15,
		assists: 4,
		appearances: 63,
		clubs: [
			"Sheffield Utd",
			"Everton"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "pedro-porro",
		name: "Pedro Porro",
		position: "DEF",
		goals: 9,
		assists: 20,
		appearances: 108,
		clubs: [
			"Spurs"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "livramento",
		name: "Livramento",
		position: "DEF",
		goals: 2,
		assists: 4,
		appearances: 86,
		clubs: [
			"Chelsea",
			"Southampton",
			"Newcastle"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "gravenberch",
		name: "Gravenberch",
		position: "MID",
		goals: 6,
		assists: 10,
		appearances: 84,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "hoever",
		name: "Hoever",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 26,
		clubs: [
			"Liverpool",
			"Wolves"
		],
		firstSeason: 2019,
		lastSeason: 2025
	},
	{
		id: "maatsen",
		name: "Maatsen",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 29,
		clubs: [
			"Chelsea",
			"Aston Villa"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "vitinho",
		name: "Vitinho",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 26,
		clubs: [
			"Burnley"
		],
		firstSeason: 2023,
		lastSeason: 2023
	},
	{
		id: "olise",
		name: "Olise",
		position: "MID",
		goals: 14,
		assists: 23,
		appearances: 64,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2021,
		lastSeason: 2023
	},
	{
		id: "firpo",
		name: "Firpo",
		position: "DEF",
		goals: 1,
		assists: 4,
		appearances: 37,
		clubs: [
			"Leeds"
		],
		firstSeason: 2021,
		lastSeason: 2022
	},
	{
		id: "evanilson",
		name: "Evanilson",
		position: "FWD",
		goals: 16,
		assists: 13,
		appearances: 61,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "martinelli",
		name: "Martinelli",
		position: "MID",
		goals: 41,
		assists: 32,
		appearances: 138,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "anthony",
		name: "Anthony",
		position: "MID",
		goals: 11,
		assists: 5,
		appearances: 44,
		clubs: [
			"Bournemouth",
			"Burnley",
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "fofana",
		name: "Fofana",
		position: "DEF",
		goals: 1,
		assists: 3,
		appearances: 79,
		clubs: [
			"Leicester",
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "van-den-berg",
		name: "Van den Berg",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 59,
		clubs: [
			"Liverpool",
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "elliott",
		name: "Elliott",
		position: "MID",
		goals: 5,
		assists: 13,
		appearances: 33,
		clubs: [
			"Fulham",
			"Liverpool",
			"Aston Villa"
		],
		firstSeason: 2018,
		lastSeason: 2026
	},
	{
		id: "kulusevski",
		name: "Kulusevski",
		position: "MID",
		goals: 22,
		assists: 23,
		appearances: 93,
		clubs: [
			"Spurs"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "j-timber",
		name: "J.Timber",
		position: "DEF",
		goals: 4,
		assists: 9,
		appearances: 56,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "mbeumo",
		name: "Mbeumo",
		position: "MID",
		goals: 53,
		assists: 35,
		appearances: 149,
		clubs: [
			"Brentford",
			"Man Utd"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "darwin",
		name: "Darwin",
		position: "FWD",
		goals: 25,
		assists: 19,
		appearances: 43,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "enzo",
		name: "Enzo",
		position: "MID",
		goals: 19,
		assists: 18,
		appearances: 111,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "joao-gomes",
		name: "João Gomes",
		position: "MID",
		goals: 7,
		assists: 5,
		appearances: 107,
		clubs: [
			"Wolves",
			"Aston Villa"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "ait-nouri",
		name: "Ait Nouri",
		position: "DEF",
		goals: 9,
		assists: 17,
		appearances: 124,
		clubs: [
			"Wolves",
			"Man City"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "greaves",
		name: "Greaves",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 26,
		clubs: [
			"Ipswich Town"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "elanga",
		name: "Elanga",
		position: "MID",
		goals: 15,
		assists: 25,
		appearances: 95,
		clubs: [
			"Man Utd",
			"Nott'm Forest",
			"Newcastle"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "onana-2",
		name: "Onana",
		position: "MID",
		goals: 8,
		assists: 3,
		appearances: 82,
		clubs: [
			"Everton",
			"Aston Villa"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "fabio-silva",
		name: "Fabio Silva",
		position: "FWD",
		goals: 4,
		assists: 4,
		appearances: 57,
		clubs: [
			"Wolves"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "summerville",
		name: "Summerville",
		position: "MID",
		goals: 10,
		assists: 9,
		appearances: 51,
		clubs: [
			"Leeds",
			"West Ham"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "salisu",
		name: "Salisu",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 54,
		clubs: [
			"Southampton"
		],
		firstSeason: 2020,
		lastSeason: 2022
	},
	{
		id: "mitoma",
		name: "Mitoma",
		position: "MID",
		goals: 23,
		assists: 22,
		appearances: 84,
		clubs: [
			"Brighton"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "cajuste",
		name: "Cajuste",
		position: "MID",
		goals: 1,
		assists: 1,
		appearances: 25,
		clubs: [
			"Ipswich Town"
		],
		firstSeason: 2024,
		lastSeason: 2024
	},
	{
		id: "davis-2-2",
		name: "Davis",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 35,
		clubs: [
			"Leeds",
			"Ipswich Town"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "petrovic",
		name: "Petrović",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 61,
		clubs: [
			"Chelsea",
			"Bournemouth"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "colwill",
		name: "Colwill",
		position: "DEF",
		goals: 3,
		assists: 4,
		appearances: 71,
		clubs: [
			"Brighton",
			"Chelsea"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "kudus",
		name: "Kudus",
		position: "MID",
		goals: 15,
		assists: 19,
		appearances: 77,
		clubs: [
			"West Ham",
			"Spurs"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "alvarez-2",
		name: "Álvarez",
		position: "FWD",
		goals: 20,
		assists: 14,
		appearances: 41,
		clubs: [
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "todibo",
		name: "Todibo",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 42,
		clubs: [
			"West Ham"
		],
		firstSeason: 2024,
		lastSeason: 2025
	},
	{
		id: "saliba",
		name: "Saliba",
		position: "DEF",
		goals: 7,
		assists: 2,
		appearances: 117,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "delap",
		name: "Delap",
		position: "FWD",
		goals: 13,
		assists: 4,
		appearances: 46,
		clubs: [
			"Man City",
			"Ipswich Town",
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "rutter",
		name: "Rutter",
		position: "MID",
		goals: 8,
		assists: 13,
		appearances: 41,
		clubs: [
			"Leeds",
			"Brighton"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "hill",
		name: "Hill",
		position: "DEF",
		goals: 0,
		assists: 4,
		appearances: 30,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "lammens",
		name: "Lammens",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 33,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "matheus",
		name: "Matheus",
		position: "MID",
		goals: 3,
		assists: 18,
		appearances: 79,
		clubs: [
			"Wolves",
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "thiaw",
		name: "Thiaw",
		position: "DEF",
		goals: 4,
		assists: 0,
		appearances: 34,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "n-gonzalez",
		name: "N.Gonzalez",
		position: "MID",
		goals: 2,
		assists: 1,
		appearances: 26,
		clubs: [
			"Man City"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "mudryk",
		name: "Mudryk",
		position: "MID",
		goals: 5,
		assists: 7,
		appearances: 26,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "calafiori",
		name: "Calafiori",
		position: "DEF",
		goals: 3,
		assists: 4,
		appearances: 34,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "stach",
		name: "Stach",
		position: "MID",
		goals: 6,
		assists: 6,
		appearances: 29,
		clubs: [
			"Leeds"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "antony",
		name: "Antony",
		position: "MID",
		goals: 5,
		assists: 3,
		appearances: 32,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "hermansen",
		name: "Hermansen",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 45,
		clubs: [
			"Leicester",
			"West Ham"
		],
		firstSeason: 2024,
		lastSeason: 2025
	},
	{
		id: "wieffer",
		name: "Wieffer",
		position: "MID",
		goals: 3,
		assists: 9,
		appearances: 34,
		clubs: [
			"Brighton"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "van-hecke",
		name: "Van Hecke",
		position: "DEF",
		goals: 4,
		assists: 4,
		appearances: 99,
		clubs: [
			"Brighton",
			"Spurs"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "hickey",
		name: "Hickey",
		position: "DEF",
		goals: 0,
		assists: 3,
		appearances: 32,
		clubs: [
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "o-reilly",
		name: "O'Reilly",
		position: "MID",
		goals: 7,
		assists: 4,
		appearances: 36,
		clubs: [
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "enciso",
		name: "Enciso",
		position: "MID",
		goals: 6,
		assists: 9,
		appearances: 27,
		clubs: [
			"Brighton",
			"Ipswich Town"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "joao-pedro",
		name: "João Pedro",
		position: "FWD",
		goals: 38,
		assists: 20,
		appearances: 105,
		clubs: [
			"Watford",
			"Brighton",
			"Chelsea"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "lewis-2",
		name: "Lewis",
		position: "DEF",
		goals: 3,
		assists: 3,
		appearances: 44,
		clubs: [
			"Man City"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "gvardiol",
		name: "Gvardiol",
		position: "DEF",
		goals: 12,
		assists: 4,
		appearances: 79,
		clubs: [
			"Man City"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "zabarnyi",
		name: "Zabarnyi",
		position: "DEF",
		goals: 1,
		assists: 1,
		appearances: 75,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2022,
		lastSeason: 2025
	},
	{
		id: "esteve",
		name: "Estève",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 49,
		clubs: [
			"Burnley"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "branthwaite",
		name: "Branthwaite",
		position: "DEF",
		goals: 5,
		assists: 3,
		appearances: 81,
		clubs: [
			"Everton"
		],
		firstSeason: 2019,
		lastSeason: 2026
	},
	{
		id: "kristiansen",
		name: "Kristiansen",
		position: "DEF",
		goals: 0,
		assists: 2,
		appearances: 40,
		clubs: [
			"Leicester"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "zubimendi",
		name: "Zubimendi",
		position: "MID",
		goals: 5,
		assists: 1,
		appearances: 34,
		clubs: [
			"Arsenal"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "sarr-2",
		name: "Sarr",
		position: "MID",
		goals: 8,
		assists: 10,
		appearances: 64,
		clubs: [
			"Spurs"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "gusto",
		name: "Gusto",
		position: "DEF",
		goals: 2,
		assists: 10,
		appearances: 65,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "igor-jesus",
		name: "Igor Jesus",
		position: "FWD",
		goals: 6,
		assists: 6,
		appearances: 29,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "e-le-fee",
		name: "E.Le Fée",
		position: "MID",
		goals: 5,
		assists: 6,
		appearances: 34,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "beto",
		name: "Beto",
		position: "FWD",
		goals: 20,
		assists: 1,
		appearances: 41,
		clubs: [
			"Everton"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "caicedo",
		name: "Caicedo",
		position: "MID",
		goals: 7,
		assists: 10,
		appearances: 132,
		clubs: [
			"Brighton",
			"Chelsea"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "udogie",
		name: "Udogie",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 66,
		clubs: [
			"Spurs"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "ferguson",
		name: "Ferguson",
		position: "FWD",
		goals: 13,
		assists: 3,
		appearances: 29,
		clubs: [
			"Brighton",
			"West Ham"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "hume",
		name: "Hume",
		position: "DEF",
		goals: 2,
		assists: 1,
		appearances: 35,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "hall",
		name: "Hall",
		position: "DEF",
		goals: 2,
		assists: 9,
		appearances: 65,
		clubs: [
			"Chelsea",
			"Newcastle"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "yeremy",
		name: "Yeremy",
		position: "MID",
		goals: 2,
		assists: 2,
		appearances: 26,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "verbruggen",
		name: "Verbruggen",
		position: "GK",
		goals: 0,
		assists: 1,
		appearances: 96,
		clubs: [
			"Brighton"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "iroegbunam",
		name: "Iroegbunam",
		position: "MID",
		goals: 0,
		assists: 4,
		appearances: 26,
		clubs: [
			"West Brom",
			"Aston Villa",
			"Everton"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "bueno",
		name: "Bueno",
		position: "DEF",
		goals: 1,
		assists: 4,
		appearances: 45,
		clubs: [
			"Wolves"
		],
		firstSeason: 2020,
		lastSeason: 2025
	},
	{
		id: "van-de-ven",
		name: "Van de Ven",
		position: "DEF",
		goals: 7,
		assists: 3,
		appearances: 74,
		clubs: [
			"Spurs"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "bradley",
		name: "Bradley",
		position: "DEF",
		goals: 1,
		assists: 7,
		appearances: 29,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "amdouni",
		name: "Amdouni",
		position: "FWD",
		goals: 5,
		assists: 1,
		appearances: 27,
		clubs: [
			"Burnley"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "garnacho",
		name: "Garnacho",
		position: "MID",
		goals: 17,
		assists: 17,
		appearances: 73,
		clubs: [
			"Man Utd",
			"Chelsea",
			"Aston Villa"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "diallo-2",
		name: "Diallo",
		position: "MID",
		goals: 11,
		assists: 15,
		appearances: 53,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2020,
		lastSeason: 2026
	},
	{
		id: "truffert",
		name: "Truffert",
		position: "DEF",
		goals: 1,
		assists: 6,
		appearances: 39,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "wirtz",
		name: "Wirtz",
		position: "MID",
		goals: 5,
		assists: 4,
		appearances: 28,
		clubs: [
			"Liverpool"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "wharton",
		name: "Wharton",
		position: "MID",
		goals: 1,
		assists: 11,
		appearances: 61,
		clubs: [
			"Crystal Palace"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "h-jlund",
		name: "Højlund",
		position: "FWD",
		goals: 14,
		assists: 3,
		appearances: 48,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "roefs",
		name: "Roefs",
		position: "GK",
		goals: 0,
		assists: 0,
		appearances: 36,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "mosquera",
		name: "Mosquera",
		position: "DEF",
		goals: 0,
		assists: 0,
		appearances: 29,
		clubs: [
			"Wolves"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "thiago-2",
		name: "Thiago",
		position: "FWD",
		goals: 22,
		assists: 1,
		appearances: 39,
		clubs: [
			"Brentford"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "alcaraz",
		name: "Alcaraz",
		position: "MID",
		goals: 6,
		assists: 6,
		appearances: 26,
		clubs: [
			"Southampton",
			"Everton"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "scott",
		name: "Scott",
		position: "MID",
		goals: 4,
		assists: 3,
		appearances: 54,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "hutchinson",
		name: "Hutchinson",
		position: "MID",
		goals: 4,
		assists: 10,
		appearances: 47,
		clubs: [
			"Arsenal",
			"Chelsea",
			"Ipswich Town",
			"Nott'm Forest"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "ugochukwu",
		name: "Ugochukwu",
		position: "MID",
		goals: 4,
		assists: 4,
		appearances: 48,
		clubs: [
			"Chelsea",
			"Southampton",
			"Burnley"
		],
		firstSeason: 2023,
		lastSeason: 2025
	},
	{
		id: "kamaldeen",
		name: "Kamaldeen",
		position: "MID",
		goals: 3,
		assists: 3,
		appearances: 27,
		clubs: [
			"Southampton"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "yarmoliuk",
		name: "Yarmoliuk",
		position: "MID",
		goals: 1,
		assists: 3,
		appearances: 51,
		clubs: [
			"Brentford"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "andre",
		name: "André",
		position: "MID",
		goals: 1,
		assists: 0,
		appearances: 61,
		clubs: [
			"Wolves"
		],
		firstSeason: 2024,
		lastSeason: 2025
	},
	{
		id: "ayari",
		name: "Ayari",
		position: "MID",
		goals: 5,
		assists: 5,
		appearances: 44,
		clubs: [
			"Brighton"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "savinho",
		name: "Savinho",
		position: "MID",
		goals: 2,
		assists: 13,
		appearances: 28,
		clubs: [
			"Man City"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "toti",
		name: "Toti",
		position: "DEF",
		goals: 2,
		assists: 5,
		appearances: 90,
		clubs: [
			"Wolves"
		],
		firstSeason: 2021,
		lastSeason: 2025
	},
	{
		id: "tel",
		name: "Tel",
		position: "MID",
		goals: 6,
		assists: 4,
		appearances: 25,
		clubs: [
			"Spurs"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "o-brien",
		name: "O'Brien",
		position: "DEF",
		goals: 3,
		assists: 3,
		appearances: 52,
		clubs: [
			"Crystal Palace",
			"Everton"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "danilo-2",
		name: "Danilo",
		position: "MID",
		goals: 5,
		assists: 4,
		appearances: 37,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2022,
		lastSeason: 2024
	},
	{
		id: "schade",
		name: "Schade",
		position: "MID",
		goals: 21,
		assists: 12,
		appearances: 69,
		clubs: [
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "el-khannouss",
		name: "El Khannouss",
		position: "MID",
		goals: 2,
		assists: 4,
		appearances: 27,
		clubs: [
			"Leicester"
		],
		firstSeason: 2024,
		lastSeason: 2024
	},
	{
		id: "gomez-2",
		name: "Gómez",
		position: "MID",
		goals: 6,
		assists: 3,
		appearances: 31,
		clubs: [
			"Brighton"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "lavia",
		name: "Lavia",
		position: "MID",
		goals: 1,
		assists: 2,
		appearances: 37,
		clubs: [
			"Man City",
			"Southampton",
			"Chelsea"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "mainoo",
		name: "Mainoo",
		position: "MID",
		goals: 4,
		assists: 3,
		appearances: 59,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "agbadou",
		name: "Agbadou",
		position: "DEF",
		goals: 1,
		assists: 0,
		appearances: 28,
		clubs: [
			"Wolves"
		],
		firstSeason: 2024,
		lastSeason: 2025
	},
	{
		id: "n-jackson",
		name: "N.Jackson",
		position: "FWD",
		goals: 24,
		assists: 12,
		appearances: 59,
		clubs: [
			"Chelsea"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "hinshelwood",
		name: "Hinshelwood",
		position: "MID",
		goals: 14,
		assists: 8,
		appearances: 51,
		clubs: [
			"Brighton"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "ouattara",
		name: "Ouattara",
		position: "MID",
		goals: 16,
		assists: 17,
		appearances: 74,
		clubs: [
			"Bournemouth",
			"Brentford"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "baleba",
		name: "Baleba",
		position: "MID",
		goals: 3,
		assists: 1,
		appearances: 69,
		clubs: [
			"Brighton"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "adingra",
		name: "Adingra",
		position: "MID",
		goals: 9,
		assists: 5,
		appearances: 46,
		clubs: [
			"Brighton",
			"Sunderland"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "buonanotte",
		name: "Buonanotte",
		position: "MID",
		goals: 9,
		assists: 4,
		appearances: 38,
		clubs: [
			"Brighton",
			"Leicester",
			"Chelsea",
			"Leeds"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "kerkez",
		name: "Kerkez",
		position: "DEF",
		goals: 4,
		assists: 9,
		appearances: 88,
		clubs: [
			"Bournemouth",
			"Liverpool"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "gray-2-2",
		name: "Gray",
		position: "MID",
		goals: 2,
		assists: 2,
		appearances: 38,
		clubs: [
			"Leeds",
			"Spurs"
		],
		firstSeason: 2021,
		lastSeason: 2026
	},
	{
		id: "miley",
		name: "Miley",
		position: "MID",
		goals: 3,
		assists: 7,
		appearances: 31,
		clubs: [
			"Newcastle"
		],
		firstSeason: 2022,
		lastSeason: 2026
	},
	{
		id: "odobert",
		name: "Odobert",
		position: "MID",
		goals: 4,
		assists: 6,
		appearances: 44,
		clubs: [
			"Burnley",
			"Spurs"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "yoro",
		name: "Yoro",
		position: "DEF",
		goals: 0,
		assists: 1,
		appearances: 30,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "m-fernandes",
		name: "M.Fernandes",
		position: "MID",
		goals: 5,
		assists: 8,
		appearances: 69,
		clubs: [
			"Southampton",
			"West Ham",
			"Spurs"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "a-jimenez",
		name: "A.Jimenez",
		position: "DEF",
		goals: 1,
		assists: 2,
		appearances: 26,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2025,
		lastSeason: 2025
	},
	{
		id: "huijsen",
		name: "Huijsen",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 26,
		clubs: [
			"Bournemouth"
		],
		firstSeason: 2024,
		lastSeason: 2024
	},
	{
		id: "murillo",
		name: "Murillo",
		position: "DEF",
		goals: 3,
		assists: 2,
		appearances: 94,
		clubs: [
			"Nott'm Forest"
		],
		firstSeason: 2023,
		lastSeason: 2026
	},
	{
		id: "sadiki",
		name: "Sadiki",
		position: "MID",
		goals: 0,
		assists: 2,
		appearances: 34,
		clubs: [
			"Sunderland"
		],
		firstSeason: 2025,
		lastSeason: 2026
	},
	{
		id: "minteh",
		name: "Minteh",
		position: "MID",
		goals: 9,
		assists: 13,
		appearances: 46,
		clubs: [
			"Brighton"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "dorgu",
		name: "Dorgu",
		position: "DEF",
		goals: 4,
		assists: 4,
		appearances: 26,
		clubs: [
			"Man Utd"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "kayode",
		name: "Kayode",
		position: "DEF",
		goals: 2,
		assists: 3,
		appearances: 44,
		clubs: [
			"Brentford"
		],
		firstSeason: 2024,
		lastSeason: 2026
	},
	{
		id: "diouf-2",
		name: "Diouf",
		position: "DEF",
		goals: 0,
		assists: 6,
		appearances: 30,
		clubs: [
			"West Ham"
		],
		firstSeason: 2025,
		lastSeason: 2025
	}
];

const players = playersData;
const playersById = new Map(players.map((player) => [player.id, player]));
const playersByPosition = { GK: [], DEF: [], MID: [], FWD: [] };
for (const player of players) {
  playersByPosition[player.position].push(player);
}
function getPlayerById(id) {
  return playersById.get(id);
}
function getPlayersByPosition(position) {
  return playersByPosition[position];
}

function assignPrefilledPlayers(seed, formation, slotIds) {
  const usedPlayerIds = /* @__PURE__ */ new Set();
  const prefilled = [];
  for (const slotId of slotIds) {
    const slot = formation.slots.find((candidate) => candidate.id === slotId);
    if (!slot) {
      continue;
    }
    const pool = getPlayersByPosition(slot.group);
    const player = pickDeterministicItem(`${seed}:${slotId}`, pool, usedPlayerIds);
    if (!player) {
      continue;
    }
    usedPlayerIds.add(player.id);
    prefilled.push({ slotId, player });
  }
  return prefilled;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOKEN_TTL_MS = 5 * 60 * 1e3;
async function importKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
function toHex(bytes) {
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function encodePayload(payload) {
  const binary = Array.from(encoder.encode(JSON.stringify(payload)), (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodePayload(encoded) {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(encoded.length + (4 - encoded.length % 4) % 4, "=");
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
    const parsed = JSON.parse(decoder.decode(bytes));
    if (typeof parsed === "object" && parsed !== null && typeof parsed.playerId === "string" && typeof parsed.gameId === "string" && typeof parsed.issuedAt === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
async function signPlayerToken(playerId, gameId, secret) {
  const key = await importKey(secret);
  const encodedPayload = encodePayload({ playerId, gameId, issuedAt: Date.now() });
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload));
  return `${encodedPayload}.${toHex(signature)}`;
}
async function verifyPlayerToken(token, gameId, secret) {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) {
    return null;
  }
  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const key = await importKey(secret);
  const expectedSignature = toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(encodedPayload)));
  if (!timingSafeEqual(expectedSignature, signature)) {
    return null;
  }
  const payload = decodePayload(encodedPayload);
  if (!payload || payload.gameId !== gameId || Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
    return null;
  }
  return payload.playerId;
}

const FILE_UPLOAD_HEADER = "multipart/form-data";
const runtimeConfig$1 = useRuntimeConfig();
const strict$1 = runtimeConfig$1.security?.strict ?? false;
const defaultSizeLimiter = defaultSecurityConfig("", strict$1).requestSizeLimiter;
const _k37g58 = defineEventHandler((event) => {
  const rules = resolveSecurityRules(event);
  if (rules.enabled && rules.requestSizeLimiter) {
    const requestSizeLimiter = defu(
      rules.requestSizeLimiter,
      defaultSizeLimiter
    );
    if (["POST", "PUT", "DELETE"].includes(event.node.req.method)) {
      const contentLengthValue = getRequestHeader(event, "content-length");
      const contentTypeValue = getRequestHeader(event, "content-type");
      const isFileUpload = contentTypeValue?.includes(FILE_UPLOAD_HEADER);
      const requestLimit = isFileUpload ? requestSizeLimiter.maxUploadFileRequestInBytes : requestSizeLimiter.maxRequestSizeInBytes;
      if (parseInt(contentLengthValue) >= requestLimit) {
        const payloadTooLargeError = {
          statusCode: 413,
          statusMessage: "Payload Too Large"
        };
        if (requestSizeLimiter.throwError === false) {
          return payloadTooLargeError;
        }
        throw createError$1(payloadTooLargeError);
      }
    }
  }
});

const _oHEB31 = defineEventHandler((event) => {
  const rules = resolveSecurityRules(event);
  if (rules.enabled && rules.corsHandler) {
    const { corsHandler } = rules;
    let origin;
    if (typeof corsHandler.origin === "string" && corsHandler.origin !== "*") {
      origin = [corsHandler.origin];
    } else {
      origin = corsHandler.origin;
    }
    if (origin && origin !== "*" && corsHandler.useRegExp) {
      origin = origin.map((o) => new RegExp(o, "i"));
    }
    handleCors(event, {
      origin,
      methods: corsHandler.methods,
      allowHeaders: corsHandler.allowHeaders,
      exposeHeaders: corsHandler.exposeHeaders,
      credentials: corsHandler.credentials,
      maxAge: corsHandler.maxAge,
      preflight: corsHandler.preflight
    });
  }
});

const _YGx6p3 = defineEventHandler((event) => {
  const rules = resolveSecurityRules(event);
  if (rules.enabled && rules.allowedMethodsRestricter) {
    const { allowedMethodsRestricter } = rules;
    const allowedMethods = allowedMethodsRestricter.methods;
    if (allowedMethods !== "*" && !allowedMethods.includes(event.node.req.method)) {
      const methodNotAllowedError = {
        statusCode: 405,
        statusMessage: "Method not allowed"
      };
      if (allowedMethodsRestricter.throwError === false) {
        return methodNotAllowedError;
      }
      throw createError$1(methodNotAllowedError);
    }
  }
});

const runtimeConfig = useRuntimeConfig();
const strict = runtimeConfig.security?.strict ?? false;
const defaultRateLimiter = defaultSecurityConfig("", strict).rateLimiter;
const storage = useStorage("#rate-limiter-storage");
const _0P2yxi = defineEventHandler(async (event) => {
  const rules = resolveSecurityRules(event);
  const route = resolveSecurityRoute(event);
  if (rules.enabled && rules.rateLimiter) {
    const rateLimiter = defu(
      rules.rateLimiter,
      defaultRateLimiter
    );
    const ip = getIP(event, rateLimiter.ipHeader);
    if (rateLimiter.whiteList && rateLimiter.whiteList.includes(ip)) {
      return;
    }
    const url = ip + route;
    let storageItem = await storage.getItem(url);
    if (!storageItem) {
      await setStorageItem(rateLimiter, url);
    } else {
      if (typeof storageItem !== "object") {
        return;
      }
      const timeSinceFirstRateLimit = storageItem.date;
      const timeForInterval = storageItem.date + Number(rateLimiter.interval);
      if (Date.now() >= timeForInterval) {
        await setStorageItem(rateLimiter, url);
        storageItem = await storage.getItem(url);
      }
      const isLimited = timeSinceFirstRateLimit <= timeForInterval && storageItem.value === 0;
      if (isLimited) {
        const tooManyRequestsError = {
          statusCode: 429,
          statusMessage: "Too Many Requests"
        };
        if (rules.rateLimiter.headers) {
          setResponseHeader(event, "x-ratelimit-remaining", 0);
          setResponseHeader(event, "x-ratelimit-limit", rateLimiter.tokensPerInterval);
          setResponseHeader(event, "x-ratelimit-reset", timeForInterval);
        }
        if (rateLimiter.throwError === false) {
          return tooManyRequestsError;
        }
        throw createError$1(tooManyRequestsError);
      }
      const newItemDate = timeSinceFirstRateLimit > timeForInterval ? Date.now() : storageItem.date;
      const newStorageItem = { value: storageItem.value - 1, date: newItemDate };
      await storage.setItem(url, newStorageItem);
      const currentItem = await storage.getItem(url);
      if (currentItem && rateLimiter.headers) {
        setResponseHeader(event, "x-ratelimit-remaining", currentItem.value);
        setResponseHeader(event, "x-ratelimit-limit", rateLimiter.tokensPerInterval);
        setResponseHeader(event, "x-ratelimit-reset", timeForInterval);
      }
    }
  }
});
async function setStorageItem(rateLimiter, url) {
  const rateLimitedObject = { value: rateLimiter.tokensPerInterval, date: Date.now() };
  await storage.setItem(url, rateLimitedObject);
}
function getIP(event, customIpHeader) {
  const ip = customIpHeader ? getRequestHeader(event, customIpHeader) || "" : getRequestIP(event, { xForwardedFor: true }) || "";
  return ip;
}

const _jH9RiR = defineEventHandler(async (event) => {
  const rules = resolveSecurityRules(event);
  if (rules.enabled && rules.xssValidator) {
    const filterOpt = {
      ...rules.xssValidator,
      escapeHtml: void 0
    };
    if (rules.xssValidator.escapeHtml === false) {
      filterOpt.escapeHtml = (value) => value;
    }
    const xssValidator = new FilterXSS(filterOpt);
    if (event.node.req.socket.readyState !== "readOnly") {
      if (rules.xssValidator.methods && rules.xssValidator.methods.includes(
        event.node.req.method
      )) {
        const valueToFilter = event.node.req.method === "GET" ? getQuery(event) : event.node.req.headers["content-type"]?.includes(
          "multipart/form-data"
        ) ? await readMultipartFormData(event) : await readBody(event);
        if (valueToFilter && Object.keys(valueToFilter).length) {
          if (valueToFilter.statusMessage === "Bad Request") {
            return;
          }
          const stringifiedValue = JSON.stringify(valueToFilter);
          const processedValue = xssValidator.process(
            JSON.stringify(valueToFilter)
          );
          if (processedValue !== stringifiedValue) {
            const badRequestError = {
              statusCode: 400,
              statusMessage: "Bad Request"
            };
            if (rules.xssValidator.throwError === false) {
              return badRequestError;
            }
            throw createError$1(badRequestError);
          }
        }
      }
    }
  }
});

const PORT_SUFFIX_RE = /:\d+$/;
const serverEnvSiteConfig = envSiteConfig(globalThis._importMeta_.env || {});
const _1aUAZi = eventHandler(async (e) => {
  if (e.context._initedSiteConfig)
    return;
  const runtimeConfig = useRuntimeConfig(e);
  const config = runtimeConfig["nuxt-site-config"];
  const nitroApp = useNitroApp();
  const siteConfig = e.context.siteConfig || createSiteConfigStack({
    debug: config.debug
  });
  const nitroOrigin = getNitroOrigin(e);
  e.context.siteConfigNitroOrigin = nitroOrigin;
  {
    siteConfig.push({
      _context: "nitro:init",
      _priority: SiteConfigPriority.nitro,
      url: nitroOrigin
    });
  }
  siteConfig.push({
    _context: "runtimeEnv",
    _priority: SiteConfigPriority.runtime,
    ...runtimeConfig.site || {},
    ...runtimeConfig.public.site || {},
    ...serverEnvSiteConfig
  });
  const buildStack = config.stack || [];
  buildStack.forEach((c) => siteConfig.push(c));
  const routeRules = getSiteRouteRules(e);
  if (routeRules.site) {
    siteConfig.push({
      _context: "route-rules",
      ...routeRules.site
    });
  }
  if (config.multiTenancy) {
    const host = parseURL(nitroOrigin).host?.replace(PORT_SUFFIX_RE, "") || "";
    const tenant = config.multiTenancy?.find((t) => t.hosts.includes(host));
    if (tenant) {
      siteConfig.push({
        _context: `multi-tenancy:${host}`,
        _priority: SiteConfigPriority.runtime,
        ...tenant.config
      });
    }
  }
  const ctx = { siteConfig, event: e };
  await nitroApp.hooks.callHook("site-config:init", ctx);
  e.context.siteConfig = ctx.siteConfig;
  e.context._initedSiteConfig = true;
});

const _Lyjc8Y = defineEventHandler(async (e) => {
  const nitroApp = useNitroApp();
  const { indexable} = getSiteRobotConfig(e);
  const { credits, isNuxtContentV2, cacheControl } = useRuntimeConfigNuxtRobots(e);
  let robotsTxtCtx = {
    sitemaps: [],
    groups: [
      {
        allow: [],
        comment: [],
        userAgent: ["*"],
        disallow: ["/"]
      }
    ]
  };
  if (indexable) {
    robotsTxtCtx = await resolveRobotsTxtContext(e);
    robotsTxtCtx.sitemaps = [...new Set(
      asArray(robotsTxtCtx.sitemaps).map((s) => !s.startsWith("http") ? withSiteUrl(e, s, { withBase: true}) : s)
    )];
    if (isNuxtContentV2) {
      const contentWithRobotRules = await fetchWithEvent(e, "/__robots__/nuxt-content.json", {
        headers: {
          Accept: "application/json"
        }
      });
      if (String(contentWithRobotRules).trim().startsWith("<!DOCTYPE")) {
        logger$1.error("Invalid HTML returned from /__robots__/nuxt-content.json, skipping.");
      } else {
        for (const group of robotsTxtCtx.groups) {
          if (group.userAgent.includes("*")) {
            group.disallow.push(...contentWithRobotRules);
            group.disallow = group.disallow.filter(Boolean);
          }
        }
      }
    }
  }
  let robotsTxt = generateRobotsTxt(robotsTxtCtx);
  if (credits) {
    robotsTxt = [
      `# START nuxt-robots (${indexable ? "indexable" : "indexing disabled"})`,
      robotsTxt,
      "# END nuxt-robots"
    ].filter(Boolean).join("\n");
  }
  setHeader(e, "Content-Type", "text/plain; charset=utf-8");
  setHeader(e, "Cache-Control", !cacheControl ? "no-store" : cacheControl);
  const hookCtx = { robotsTxt, e };
  await nitroApp.hooks.callHook("robots:robots-txt", hookCtx);
  return hookCtx.robotsTxt;
});

const _ppW2RI = defineEventHandler(async (e) => {
  if (e.path === "/robots.txt" || e.path.startsWith("/__") || e.path.startsWith("/api") || e.path.startsWith("/_nuxt"))
    return;
  const nuxtRobotsConfig = useRuntimeConfigNuxtRobots(e);
  if (nuxtRobotsConfig) {
    const { header } = nuxtRobotsConfig;
    const robotConfig = getPathRobotConfig(e, { skipSiteIndexable: Boolean(getQuery(e)?.mockProductionEnv) });
    if (header) {
      setHeader(e, "X-Robots-Tag", robotConfig.rule);
    }
    e.context.robots = robotConfig;
  }
});

const staticConfig = {"isI18nMapped":false,"sitemapName":"sitemap.xml","isMultiSitemap":false,"excludeAppSources":[],"cacheMaxAgeSeconds":600,"experimentalStreaming":false,"autoLastmod":false,"defaultSitemapsChunkSize":1000,"minify":false,"sortEntries":true,"discoverImages":true,"discoverVideos":true,"sitemapsPathPrefix":"/__sitemap__/","isNuxtContentDocumentDriven":false,"xsl":"/__sitemap__/style.xsl","xslTips":true,"xslColumns":[{"label":"URL","width":"50%"},{"label":"Images","width":"25%","select":"count(image:image)"},{"label":"Last Updated","width":"25%","select":"concat(substring(sitemap:lastmod,0,11),concat(' ', substring(sitemap:lastmod,12,5)),concat(' ', substring(sitemap:lastmod,20,6)))"}],"credits":true,"version":"8.5.1","sitemaps":{"sitemap.xml":{"sitemapName":"sitemap.xml","route":"sitemap.xml","defaults":{},"include":[],"exclude":["/play","/_**","/_nuxt/**"],"includeAppSources":true}}};

const logger = createModuleLogger("@nuxt/sitemap");
const XML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;"
};
const XML_SPECIAL_CHARS_RE = /[&<>"']/g;
const HAS_XML_SPECIAL_CHARS_RE = /[&<>"']/;
function xmlEscape(value) {
  const input = String(value);
  return HAS_XML_SPECIAL_CHARS_RE.test(input) ? input.replace(XML_SPECIAL_CHARS_RE, (char) => XML_ENTITIES[char]) : input;
}
const merger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value))
    obj[key] = Array.from(/* @__PURE__ */ new Set([...obj[key], ...value]));
  return obj[key];
});
function mergeOnKey(arr, key, onMerge) {
  if (arr.length < 2)
    return arr;
  const seen = /* @__PURE__ */ new Map();
  let resultLength = 0;
  for (const item of arr) {
    const k = item[key];
    if (seen.has(k)) {
      const existingIndex = seen.get(k);
      onMerge?.(item[key]);
      arr[existingIndex] = merger(item, arr[existingIndex]);
    } else {
      seen.set(k, resultLength);
      arr[resultLength++] = item;
    }
  }
  arr.length = resultLength;
  return arr;
}
function splitForLocales(path, locales) {
  const start = path.charCodeAt(0) === 47 ? 1 : 0;
  const end = path.indexOf("/", start);
  const prefix = path.slice(start, end === -1 ? path.length : end);
  const hasLocale = locales instanceof Set ? locales.has(prefix) : locales.includes(prefix);
  if (prefix && hasLocale) {
    const prefixEnd = start + prefix.length;
    return [prefix, start === 1 ? path.slice(prefixEnd) : path];
  }
  return [null, path];
}
function toRuntimeI18nConfig(i18n) {
  return {
    ...i18n,
    // Sitemap transforms keep the unprefixed default URL alongside Nuxt's prefixed route.
    strategy: i18n.strategy === "prefix_and_default" ? "prefix_except_default" : i18n.strategy,
    pages: i18n.pages && Object.fromEntries(
      Object.entries(i18n.pages).map(([pageName, pageLocales]) => [
        pageName,
        Object.fromEntries(i18n.locales.map((locale) => {
          const configuredPath = pageLocales[locale.code];
          return [locale.code, configuredPath === void 0 ? withLeadingSlash(pageName) : configuredPath];
        }))
      ])
    ),
    locales: i18n.locales.map((locale) => ({
      ...locale,
      hreflang: locale._hreflang
    }))
  };
}
function localeAlternateHref(alternate) {
  return alternate.domain ? joinURL(withHttps(alternate.domain), alternate.path) : alternate.path;
}
function resolveI18nRouteEntries(route, i18n, includeHref = () => true, context = {}) {
  const runtimeConfig = toRuntimeI18nConfig(i18n);
  const currentLocale = resolveLocaleFromRoute(route, runtimeConfig, context).locale;
  const alternates = computeLocaleAlternates(route, runtimeConfig, { ...context, locale: currentLocale });
  const localizedAlternates = alternates.map((alternate) => ({
    alternate,
    href: localeAlternateHref(alternate)
  }));
  const defaultHref = localizedAlternates.find(({ alternate }) => alternate.code === i18n.defaultLocale)?.href;
  const sitemapAlternatives = [
    ...defaultHref && includeHref(defaultHref) ? [{ hreflang: "x-default", href: defaultHref }] : [],
    ...localizedAlternates.filter(({ href }) => includeHref(href)).map(({ alternate, href }) => ({ hreflang: alternate.hreflang, href }))
  ];
  return localizedAlternates.flatMap(({ alternate, href }) => {
    const locale = i18n.locales.find((locale2) => locale2.code === alternate.code);
    return locale ? [{ locale, loc: href, alternatives: sitemapAlternatives }] : [];
  });
}
function resolveI18nSitemapLocaleKey(sitemapName, localeSitemapKeys) {
  let best = null;
  for (const key of localeSitemapKeys) {
    if (sitemapName === key || sitemapName.startsWith(`${key}-`)) {
      if (best === null || key.length > best.length)
        best = key;
    }
  }
  return best;
}
const StringifiedRegExpPattern = /\/(.*?)\/([gimsuy]*)$/;
function normalizeRuntimeFilters(input) {
  return (input || []).map((rule) => {
    if (rule instanceof RegExp || typeof rule === "string")
      return rule;
    const match = rule.regex.match(StringifiedRegExpPattern);
    if (match)
      return new RegExp(match[1], match[2]);
    return false;
  }).filter(Boolean);
}
function createPathFilter(options = {}, baseURL) {
  const urlFilter = createFilter({
    include: normalizeRuntimeFilters(options.include),
    exclude: normalizeRuntimeFilters(options.exclude)
  });
  const hasBase = baseURL !== "/";
  return (loc, pathname) => {
    let path = pathname;
    if (typeof path !== "string") {
      try {
        path = parseURL(loc).pathname;
      } catch {
        return false;
      }
    }
    if (hasBase)
      path = withoutBase(path, baseURL);
    return urlFilter(withLeadingSlash(path));
  };
}

const SERVER_CACHE_MAX_AGE$3 = staticConfig.cacheMaxAgeSeconds;
function dynamicRuntimeConfig(e) {
  return useRuntimeConfig(e).sitemap;
}
function copyStaticSitemaps() {
  return Object.fromEntries(
    Object.entries(staticConfig.sitemaps).map(([name, sitemap]) => [name, {
      ...sitemap,
      include: normalizeRuntimeFilters("include" in sitemap ? sitemap.include : void 0),
      exclude: normalizeRuntimeFilters("exclude" in sitemap ? sitemap.exclude : void 0)
    }])
  );
}
function useSitemapRuntimeConfig(e) {
  return Object.freeze({
    ...staticConfig,
    sitemaps: copyStaticSitemaps(),
    ...dynamicRuntimeConfig(e)
  });
}
function serializeFilters(filters) {
  if (!filters?.length)
    return void 0;
  return filters.map((f) => {
    if (f instanceof RegExp)
      return { regex: `/${f.source}/${f.flags}` };
    return f;
  });
}
async function resolveSitemapSitemaps(e, nitro) {
  const ctx = { sitemaps: copyStaticSitemaps(), event: e };
  await nitro.hooks.callHook("sitemap:sitemaps-resolved", ctx);
  const sitemaps = { ...ctx.sitemaps };
  for (const name of Object.keys(sitemaps)) {
    const sitemap = { ...sitemaps[name] };
    if (typeof sitemap.urls === "function")
      sitemap.urls = await sitemap.urls();
    sitemap.include = serializeFilters(sitemap.include);
    sitemap.exclude = serializeFilters(sitemap.exclude);
    sitemaps[name] = sitemap;
  }
  return sitemaps;
}
const resolveSitemapSitemapsCached = defineCachedFunction(
  resolveSitemapSitemaps,
  {
    name: "sitemap:runtime-sitemaps",
    group: "sitemap",
    maxAge: SERVER_CACHE_MAX_AGE$3,
    base: "sitemap",
    // nitro calls getKey with the full fn args (event, nitro)
    getKey: (e) => {
      const host = e && (getHeader(e, "x-forwarded-host") || getHeader(e, "host")) || "";
      const proto = e && getHeader(e, "x-forwarded-proto") || "https";
      return `runtime-sitemaps-${proto}-${host}`;
    },
    swr: true
  }
);
async function useResolvedSitemapRuntimeConfig(e) {
  const maxAge = dynamicRuntimeConfig(e)?.cacheMaxAgeSeconds ?? staticConfig.cacheMaxAgeSeconds;
  const shouldCache = typeof maxAge === "number" && maxAge > 0;
  const sitemaps = shouldCache ? await resolveSitemapSitemapsCached(e, useNitroApp()) : await resolveSitemapSitemaps(e, useNitroApp());
  return Object.freeze({
    ...staticConfig,
    sitemaps,
    ...dynamicRuntimeConfig(e)
  });
}

const _BZ8x1m = defineEventHandler(async (e) => {
  const fixPath = createSitePathResolver(e, { absolute: false, withBase: true });
  const { sitemapName: fallbackSitemapName, cacheMaxAgeSeconds, version, xslColumns, xslTips } = useSitemapRuntimeConfig();
  setHeader(e, "Content-Type", "application/xslt+xml");
  if (cacheMaxAgeSeconds)
    setHeader(e, "Cache-Control", `public, max-age=${cacheMaxAgeSeconds}, must-revalidate`);
  else
    setHeader(e, "Cache-Control", `no-cache, no-store`);
  const { name: siteName, url: siteUrl } = getSiteConfig(e);
  const referrer = getHeader(e, "Referer") || "/";
  const referrerPath = parseURL(referrer).pathname;
  const isNotIndexButHasIndex = referrerPath !== "/sitemap.xml" && referrerPath !== "/sitemap_index.xml" && referrerPath.endsWith(".xml");
  const sitemapName = parseURL(referrer).pathname.split("/").pop()?.split("-sitemap")[0] || fallbackSitemapName;
  const title = `${siteName}${sitemapName !== "sitemap.xml" ? ` - ${sitemapName === "sitemap_index.xml" ? "index" : sitemapName}` : ""}`.replace(/&/g, "&amp;");
  getQuery$1(referrer).canonical;
  const debugUrl = xmlEscape(withQuery("/__sitemap__/debug.json", { sitemap: sitemapName }));
  xmlEscape(referrerPath);
  xmlEscape(withQuery(referrerPath, { canonical: "" }));
  const fetchErrors = [];
  const xslQuery = getQuery(e);
  if (xslQuery.error_messages) {
    const errorMessages = xslQuery.error_messages;
    const errorUrls = xslQuery.error_urls;
    if (errorMessages) {
      const messages = Array.isArray(errorMessages) ? errorMessages : [errorMessages];
      const urls = Array.isArray(errorUrls) ? errorUrls : errorUrls ? [errorUrls] : [];
      messages.forEach((msg, i) => {
        const errorParts = [xmlEscape(msg)];
        if (urls[i])
          errorParts.push(xmlEscape(urls[i]));
        fetchErrors.push(`<span class="error-item">${errorParts.join(" \u2014 ")}</span>`);
      });
    }
  }
  const hasRuntimeErrors = fetchErrors.length > 0;
  let columns = [...xslColumns];
  if (!columns.length) {
    columns = [
      { label: "URL", width: "50%" },
      { label: "Images", width: "25%", select: "count(image:image)" },
      { label: "Last Updated", width: "25%", select: "concat(substring(sitemap:lastmod,0,11),concat(' ', substring(sitemap:lastmod,12,5)),concat(' ', substring(sitemap:lastmod,20,6)))" }
    ];
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xhtml="http://www.w3.org/1999/xhtml"
                xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <style type="text/css">
          :root {
            --accent: #00dc82;
            --accent-hover: #00b86b;
            --bg: #0a0a0a;
            --bg-elevated: #141414;
            --bg-subtle: #1a1a1a;
            --border: #262626;
            --border-subtle: #1f1f1f;
            --text: #e5e5e5;
            --text-muted: #737373;
            --text-faint: #525252;
            --error: #ef4444;
            --error-bg: rgba(239,68,68,0.1);
            --warning: #f59e0b;
          }
          * { box-sizing: border-box; }
          body {
            font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
            font-size: 13px;
            color: var(--text);
            background: var(--bg);
            margin: 0;
            padding: 0;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
          }
          a { color: inherit; transition: color 0.15s; }
          a:hover { color: var(--accent); }

          /* Debug bar (dev only) */
          .debug-bar {
            position: fixed;
            bottom: 0.75rem;
            left: 50%;
            transform: translateX(-50%);
            width: 80%;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 0 1rem;
            height: 2.5rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            z-index: 100;
            font-size: 11px;
          }
          .debug-bar-brand {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-muted);
            text-decoration: none;
          }
          .debug-bar-brand:hover { color: var(--text); }
          .debug-bar-brand svg { flex-shrink: 0; }
          .debug-bar-hint {
            color: var(--text-faint);
            margin-right: auto;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .debug-bar-hint code {
            background: var(--bg-subtle);
            padding: 0.1rem 0.3rem;
            border-radius: 3px;
            font-size: 10px;
          }
          .mode-badge {
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
          }
          .mode-dev { background: rgba(245,158,11,0.15); color: var(--warning); }
          .mode-prod { background: rgba(0,220,130,0.12); color: var(--accent); }
          .mode-toggle {
            display: inline-flex;
            border-radius: 4px;
            overflow: hidden;
            background: var(--bg-subtle);
            padding: 2px;
            gap: 1px;
          }
          .mode-toggle a {
            padding: 0.2rem 0.4rem;
            font-size: 9px;
            font-weight: 500;
            text-decoration: none;
            color: var(--text-muted);
            border-radius: 2px;
            transition: all 0.15s;
          }
          .mode-toggle a:hover { color: var(--text); }
          .mode-toggle a.active {
            background: var(--accent);
            color: #0a0a0a;
          }
          .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            text-decoration: none;
            font-size: 10px;
            font-weight: 500;
            transition: all 0.15s;
          }
          .btn-primary {
            background: var(--accent);
            color: #0a0a0a;
          }
          .btn-primary:hover { background: var(--accent-hover); color: #0a0a0a; }
          .btn svg { width: 12px; height: 12px; }

          /* Error banner */
          .error-banner {
            background: var(--error-bg);
            border-bottom: 1px solid rgba(239,68,68,0.2);
            padding: 0.75rem 1.5rem;
            color: #fca5a5;
            font-size: 12px;
          }
          .error-banner strong { color: var(--error); }
          .error-item { display: block; margin-top: 0.375rem; color: #fca5a5; }
          .error-debug-link {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            margin-top: 0.625rem;
            padding: 0.25rem 0.5rem;
            background: var(--error);
            color: #fff;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            text-decoration: none;
            transition: background 0.15s;
          }
          .error-debug-link:hover { background: #dc2626; color: #fff; }

          /* Main content */
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1.5rem;
          }
          .header {
            margin-bottom: 1.25rem;
          }
          .header h1 {
            font-size: 1rem;
            font-weight: 600;
            margin: 0 0 0.25rem 0;
            color: var(--text);
          }
          .header-meta {
            color: var(--text-muted);
            font-size: 12px;
          }
          .header-meta a {
            color: var(--text-muted);
            text-decoration: underline;
            text-decoration-color: var(--border);
            text-underline-offset: 2px;
          }
          .header-meta a:hover { color: var(--accent); text-decoration-color: var(--accent); }

          /* Table */
          .table-wrap {
            border: 1px solid var(--border);
            border-radius: 8px;
            overflow: hidden;
            background: var(--bg-elevated);
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th {
            text-align: left;
            padding: 0.625rem 1rem;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
            background: var(--bg-subtle);
            border-bottom: 1px solid var(--border);
          }
          td {
            padding: 0.5rem 1rem;
            border-bottom: 1px solid var(--border-subtle);
            font-size: 12px;
            color: var(--text);
          }
          tr:last-child td { border-bottom: none; }
          tr:hover td { background: rgba(255,255,255,0.02); }
          td a {
            text-decoration: none;
            word-break: break-all;
            color: var(--text);
          }
          td a:hover { color: var(--accent); }
          .inline-warning {
            font-size: 11px;
            color: var(--warning);
            margin-top: 0.25rem;
            line-height: 1.4;
          }
          .inline-warning::before {
            content: "\u26A0 ";
          }
          .count {
            display: inline-block;
            min-width: 1.25rem;
            padding: 0.125rem 0.375rem;
            background: var(--bg-subtle);
            border-radius: 4px;
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
            font-variant-numeric: tabular-nums;
          }
          .count:empty::before { content: "0"; }

          /* Light mode */
          @media (prefers-color-scheme: light) {
            :root {
              --accent: #00a963;
              --accent-hover: #008f54;
              --bg: #ffffff;
              --bg-elevated: #f5f5f5;
              --bg-subtle: #ebebeb;
              --border: #d4d4d4;
              --border-subtle: #e5e5e5;
              --text: #171717;
              --text-muted: #525252;
              --text-faint: #737373;
              --error: #dc2626;
              --error-bg: rgba(220,38,38,0.08);
              --warning: #b45309;
            }
            tr:hover td { background: rgba(0,0,0,0.02); }
            .btn-primary { color: #fff; }
            .btn-primary:hover { color: #fff; }
            .mode-toggle a.active { color: #fff; }
            .error-banner { color: #991b1b; }
            .error-item { color: #b91c1c; }
            .error-debug-link { color: #fff; }
            .error-debug-link:hover { color: #fff; }
          }

          .debug-bar-version {
            color: var(--text-faint);
            font-size: 10px;
          }

          /* Responsive */
          @media (max-width: 640px) {
            .debug-bar { padding: 0 0.75rem; gap: 0.5rem; width: 95%; }
            .debug-bar-brand span { display: none; }
            .debug-bar-hint { display: none; }
            .debug-bar-version { display: none; }
            .mode-badge { display: none; }
            .container { padding: 1rem; }
            th, td { padding: 0.5rem 0.75rem; }
          }
          ${""}
        </style>
      </head>
      <body>
        ${hasRuntimeErrors ? `<div class="error-banner">
            <strong>Sitemap Generation Errors</strong>
            ${fetchErrors.join("")}
            <a href="${debugUrl}" target="_blank" class="error-debug-link">View Debug Info \u2192</a>
          </div>` : ""}
        <div class="container">
          <div class="header">
            <h1>${xmlEscape(title)}</h1>
            <div class="header-meta">
              ${isNotIndexButHasIndex ? `Part of <a href="${xmlEscape(fixPath("/sitemap_index.xml"))}">${xmlEscape(fixPath("/sitemap_index.xml"))}</a> \xB7 ` : ""}
              <xsl:if test="count(sitemap:sitemapindex/sitemap:sitemap) &gt; 0">
                <xsl:value-of select="count(sitemap:sitemapindex/sitemap:sitemap)"/> sitemaps
              </xsl:if>
              <xsl:if test="count(sitemap:sitemapindex/sitemap:sitemap) &lt; 1">
                <xsl:value-of select="count(sitemap:urlset/sitemap:url)"/> URLs
              </xsl:if>
            </div>
          </div>
          <xsl:if test="count(sitemap:sitemapindex/sitemap:sitemap) &gt; 0">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style="width:70%">Sitemap</th>
                    <th style="width:30%">Last Modified</th>
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
                    <xsl:variable name="sitemapURL">
                      <xsl:value-of select="sitemap:loc"/>
                    </xsl:variable>
                    <tr>
                      <td>
                        <a href="{$sitemapURL}">
                          <xsl:value-of select="sitemap:loc"/>
                        </a>
                      </td>
                      <td>
                        <xsl:value-of
                          select="concat(substring(sitemap:lastmod,0,11),concat(' ', substring(sitemap:lastmod,12,5)),concat(' ', substring(sitemap:lastmod,20,6)))"/>
                      </td>
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </xsl:if>
          <xsl:if test="count(sitemap:sitemapindex/sitemap:sitemap) &lt; 1">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    ${columns.map((c) => `<th style="width:${c.width}">${c.label}</th>`).join("\n")}
                  </tr>
                </thead>
                <tbody>
                  <xsl:for-each select="sitemap:urlset/sitemap:url">
                    <tr>
                      <td>
                        <xsl:variable name="itemURL">
                          <xsl:value-of select="sitemap:loc"/>
                        </xsl:variable>
                        <a href="{$itemURL}">
                          <xsl:value-of select="sitemap:loc"/>
                        </a>
                        ${""}
                      </td>
                      ${columns.filter((c) => c.label !== "URL").map((c) => `<td><span class="count"><xsl:value-of select="${c.select}"/></span></td>`).join("\n")}
                    </tr>
                  </xsl:for-each>
                </tbody>
              </table>
            </div>
          </xsl:if>
        </div>
        ${""}
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
});

const DEFAULT_XML_STREAM_CHUNK_SIZE = 64 * 1024;
function createChunkedXmlStream(chunks, targetChunkSize = DEFAULT_XML_STREAM_CHUNK_SIZE) {
  const iterator = chunks[Symbol.iterator]();
  const encoder = new TextEncoder();
  const chunkSize = Math.max(1, Math.floor(targetChunkSize));
  let complete = false;
  let pending;
  let pendingOffset = 0;
  return new ReadableStream({
    pull(controller) {
      if (complete)
        return;
      let output = "";
      while (output.length < chunkSize) {
        if (!pending) {
          const next = iterator.next();
          if (next.done) {
            complete = true;
            break;
          }
          pending = next.value;
          pendingOffset = 0;
          if (!pending)
            continue;
        }
        const remaining = chunkSize - output.length;
        let end = Math.min(pending.length, pendingOffset + remaining);
        if (end < pending.length && end > pendingOffset && pending.charCodeAt(end - 1) >= 55296 && pending.charCodeAt(end - 1) <= 56319) {
          end--;
          if (end === pendingOffset) {
            if (output)
              break;
            end = Math.min(pending.length, pendingOffset + 2);
          }
        }
        output += pending.slice(pendingOffset, end);
        pendingOffset = end;
        if (pendingOffset === pending.length)
          pending = void 0;
      }
      if (output)
        controller.enqueue(encoder.encode(output));
      if (complete)
        controller.close();
    },
    cancel() {
      complete = true;
      iterator.return?.();
    }
  });
}

function escapeValueForXml(value) {
  if (value === true || value === false)
    return value ? "yes" : "no";
  return xmlEscape(String(value));
}
function yesNo(v) {
  return v === "yes" || v === true ? "yes" : "no";
}
const URLSET_OPENING_TAG = '<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
function buildUrlXml(url, NL, I1, I2, I3, I4) {
  let xml = `${I1}<url>${NL}`;
  if (url.loc)
    xml += `${I2}<loc>${xmlEscape(url.loc)}</loc>${NL}`;
  if (url.lastmod)
    xml += `${I2}<lastmod>${xmlEscape(url.lastmod)}</lastmod>${NL}`;
  if (url.changefreq)
    xml += `${I2}<changefreq>${xmlEscape(url.changefreq)}</changefreq>${NL}`;
  if (url.priority !== void 0) {
    const p = typeof url.priority === "number" ? url.priority : Number.parseFloat(url.priority);
    xml += `${I2}<priority>${p.toFixed(1)}</priority>${NL}`;
  }
  if (url.alternatives) {
    for (const alt of url.alternatives) {
      let attrs = "";
      for (const k in alt) {
        if ((k === "href" || k === "hreflang") && Object.hasOwn(alt, k))
          attrs += ` ${k}="${xmlEscape(String(alt[k]))}"`;
      }
      xml += `${I2}<xhtml:link rel="alternate"${attrs} />${NL}`;
    }
  }
  if (url.images) {
    for (const img of url.images) {
      xml += `${I2}<image:image>${NL}${I3}<image:loc>${xmlEscape(img.loc)}</image:loc>${NL}`;
      if (img.title)
        xml += `${I3}<image:title>${xmlEscape(img.title)}</image:title>${NL}`;
      if (img.caption)
        xml += `${I3}<image:caption>${xmlEscape(img.caption)}</image:caption>${NL}`;
      if (img.geo_location)
        xml += `${I3}<image:geo_location>${xmlEscape(img.geo_location)}</image:geo_location>${NL}`;
      if (img.license)
        xml += `${I3}<image:license>${xmlEscape(img.license)}</image:license>${NL}`;
      xml += `${I2}</image:image>${NL}`;
    }
  }
  if (url.videos) {
    for (const video of url.videos) {
      xml += `${I2}<video:video>${NL}${I3}<video:title>${xmlEscape(video.title)}</video:title>${NL}`;
      if (video.thumbnail_loc)
        xml += `${I3}<video:thumbnail_loc>${xmlEscape(video.thumbnail_loc)}</video:thumbnail_loc>${NL}`;
      xml += `${I3}<video:description>${xmlEscape(video.description)}</video:description>${NL}`;
      if (video.content_loc)
        xml += `${I3}<video:content_loc>${xmlEscape(video.content_loc)}</video:content_loc>${NL}`;
      if (video.player_loc)
        xml += `${I3}<video:player_loc>${xmlEscape(video.player_loc)}</video:player_loc>${NL}`;
      if (video.duration !== void 0)
        xml += `${I3}<video:duration>${escapeValueForXml(video.duration)}</video:duration>${NL}`;
      if (video.expiration_date)
        xml += `${I3}<video:expiration_date>${xmlEscape(video.expiration_date)}</video:expiration_date>${NL}`;
      if (video.rating !== void 0)
        xml += `${I3}<video:rating>${escapeValueForXml(video.rating)}</video:rating>${NL}`;
      if (video.view_count !== void 0)
        xml += `${I3}<video:view_count>${escapeValueForXml(video.view_count)}</video:view_count>${NL}`;
      if (video.publication_date)
        xml += `${I3}<video:publication_date>${xmlEscape(video.publication_date)}</video:publication_date>${NL}`;
      if (video.family_friendly !== void 0)
        xml += `${I3}<video:family_friendly>${yesNo(video.family_friendly)}</video:family_friendly>${NL}`;
      if (video.restriction)
        xml += `${I3}<video:restriction relationship="${xmlEscape(video.restriction.relationship || "allow")}">${xmlEscape(video.restriction.restriction)}</video:restriction>${NL}`;
      if (video.platform)
        xml += `${I3}<video:platform relationship="${xmlEscape(video.platform.relationship || "allow")}">${xmlEscape(video.platform.platform)}</video:platform>${NL}`;
      if (video.requires_subscription !== void 0)
        xml += `${I3}<video:requires_subscription>${yesNo(video.requires_subscription)}</video:requires_subscription>${NL}`;
      if (video.price) {
        for (const price of video.price) {
          const c = price.currency ? ` currency="${xmlEscape(price.currency)}"` : "";
          const t = price.type ? ` type="${xmlEscape(price.type)}"` : "";
          xml += `${I3}<video:price${c}${t}>${xmlEscape(String(price.price ?? ""))}</video:price>${NL}`;
        }
      }
      if (video.uploader) {
        const info = video.uploader.info ? ` info="${xmlEscape(video.uploader.info)}"` : "";
        xml += `${I3}<video:uploader${info}>${xmlEscape(video.uploader.uploader)}</video:uploader>${NL}`;
      }
      if (video.live !== void 0)
        xml += `${I3}<video:live>${yesNo(video.live)}</video:live>${NL}`;
      if (video.tag) {
        const tags = Array.isArray(video.tag) ? video.tag : [video.tag];
        for (const t of tags) xml += `${I3}<video:tag>${xmlEscape(t)}</video:tag>${NL}`;
      }
      if (video.category)
        xml += `${I3}<video:category>${xmlEscape(video.category)}</video:category>${NL}`;
      if (video.gallery_loc)
        xml += `${I3}<video:gallery_loc>${xmlEscape(video.gallery_loc)}</video:gallery_loc>${NL}`;
      xml += `${I2}</video:video>${NL}`;
    }
  }
  if (url.news) {
    xml += `${I2}<news:news>${NL}${I3}<news:publication>${NL}`;
    xml += `${I4}<news:name>${xmlEscape(url.news.publication.name)}</news:name>${NL}`;
    xml += `${I4}<news:language>${xmlEscape(url.news.publication.language)}</news:language>${NL}`;
    xml += `${I3}</news:publication>${NL}`;
    if (url.news.title)
      xml += `${I3}<news:title>${xmlEscape(url.news.title)}</news:title>${NL}`;
    if (url.news.publication_date)
      xml += `${I3}<news:publication_date>${xmlEscape(url.news.publication_date)}</news:publication_date>${NL}`;
    xml += `${I2}</news:news>${NL}`;
  }
  xml += `${I1}</url>`;
  return xml;
}
function resolveXmlRenderContext(resolvers, { xsl, minify }, errorInfo) {
  let xslHref = xsl ? resolvers.relativeBaseUrlResolver(xsl) : false;
  if (xslHref && errorInfo?.messages.length) {
    xslHref = withQuery(xslHref, {
      errors: "true",
      error_messages: errorInfo.messages,
      error_urls: errorInfo.urls
    });
  }
  const NL = minify ? "" : "\n";
  return {
    xslHref,
    NL,
    I1: minify ? "" : "    ",
    I2: minify ? "" : "        ",
    I3: minify ? "" : "            ",
    I4: minify ? "" : "                "
  };
}
function* renderSitemapXmlChunks(urls, resolvers, config, errorInfo) {
  const { version, credits } = config;
  const { xslHref, NL, I1, I2, I3, I4 } = resolveXmlRenderContext(resolvers, config, errorInfo);
  yield xslHref ? `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="${escapeValueForXml(xslHref)}"?>${NL}` : `<?xml version="1.0" encoding="UTF-8"?>${NL}`;
  yield URLSET_OPENING_TAG + NL;
  for (const url of urls) {
    yield buildUrlXml(url, NL, I1, I2, I3, I4) + NL;
  }
  yield "</urlset>";
  if (credits) {
    yield `${NL}<!-- XML Sitemap generated by @nuxtjs/sitemap v${version} at ${(/* @__PURE__ */ new Date()).toISOString()} -->`;
  }
}
function urlsToXml(urls, resolvers, config, errorInfo) {
  const { version, credits } = config;
  const { xslHref, NL, I1, I2, I3, I4 } = resolveXmlRenderContext(resolvers, config, errorInfo);
  let xml = xslHref ? `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="${escapeValueForXml(xslHref)}"?>${NL}` : `<?xml version="1.0" encoding="UTF-8"?>${NL}`;
  xml += URLSET_OPENING_TAG + NL;
  for (const url of urls)
    xml += buildUrlXml(url, NL, I1, I2, I3, I4) + NL;
  xml += "</urlset>";
  if (credits)
    xml += `${NL}<!-- XML Sitemap generated by @nuxtjs/sitemap v${version} at ${(/* @__PURE__ */ new Date()).toISOString()} -->`;
  return xml;
}
function urlsToXmlStream(urls, resolvers, config, errorInfo) {
  return createChunkedXmlStream(renderSitemapXmlChunks(urls, resolvers, config, errorInfo));
}

function resolve(s, resolvers) {
  if (typeof s === "undefined")
    return void 0;
  const str = typeof s === "string" ? s : s.toString();
  if (!resolvers)
    return str;
  if (hasProtocol(str, { acceptRelative: true, strict: false }))
    return resolvers.fixSlashes(str);
  return resolvers.canonicalUrlResolver(str);
}
function removeTrailingSlash(s) {
  let pathEnd = s.length;
  const queryIndex = s.indexOf("?");
  if (queryIndex !== -1)
    pathEnd = queryIndex;
  const hashIndex = s.indexOf("#");
  if (hashIndex !== -1 && hashIndex < pathEnd)
    pathEnd = hashIndex;
  return pathEnd > 0 && s.charCodeAt(pathEnd - 1) === 47 ? s.slice(0, pathEnd - 1) + s.slice(pathEnd) : s;
}
function preNormalizeEntry(_e, resolvers) {
  const input = typeof _e === "string" ? { loc: _e } : { ..._e };
  if (input.url && !input.loc) {
    input.loc = input.url;
  }
  delete input.url;
  if (typeof input.loc !== "string") {
    input.loc = "";
  }
  const skipEncoding = input._encoded === true;
  const e = input;
  e.loc = removeTrailingSlash(e.loc);
  e._abs = hasProtocol(e.loc, { acceptRelative: false, strict: false });
  try {
    e._path = e._abs ? parseURL(e.loc) : parsePath(e.loc);
  } catch {
    e._path = null;
  }
  if (e._path) {
    const search = e._path.search;
    const qs = search && search.length > 1 ? stringifyQuery(parseQuery(search)) : "";
    const pathname = skipEncoding ? e._path.pathname : encodePath(e._path.pathname);
    e._relativeLoc = `${pathname}${qs.length ? `?${qs}` : ""}`;
    if (e._path.host) {
      e.loc = stringifyParsedURL(e._path);
    } else {
      e.loc = e._relativeLoc;
    }
  } else if (!skipEncoding && !isEncoded(e.loc)) {
    e.loc = encodeURI(e.loc);
  }
  if (e.loc === "")
    e.loc = `/`;
  e.loc = resolve(e.loc, resolvers);
  e._key = `${e._sitemap || ""}${withoutTrailingSlash(e.loc)}`;
  return e;
}
function isEncoded(url) {
  try {
    return url !== decodeURIComponent(url);
  } catch {
    return false;
  }
}
function normaliseEntry(_e, defaults, resolvers, cache) {
  const e = defaults ? defu(_e, defaults) : { ..._e };
  if (e.lastmod) {
    const date = cache?.lastmodInput === e.lastmod ? cache.lastmodOutput : normaliseDate(e.lastmod);
    if (cache && cache.lastmodInput !== e.lastmod) {
      cache.lastmodInput = e.lastmod;
      cache.lastmodOutput = date;
    }
    if (date)
      e.lastmod = date;
    else
      delete e.lastmod;
  }
  if (!e.lastmod)
    delete e.lastmod;
  e.loc = resolve(e.loc, resolvers);
  if (e.alternatives) {
    const alternatives = e.alternatives.map(({ _i18nGenerated: _, ...alternative }) => alternative);
    for (const alt of alternatives) {
      if (typeof alt.href === "string") {
        alt.href = resolve(alt.href, resolvers);
      } else if (typeof alt.href === "object" && alt.href) {
        alt.href = resolve(alt.href.href, resolvers);
      }
    }
    e.alternatives = mergeOnKey(alternatives, "hreflang");
  }
  if (e.images) {
    const images = e.images.map((i) => ({ ...i }));
    for (const img of images) {
      img.loc = resolve(img.loc, resolvers);
    }
    e.images = mergeOnKey(images, "loc");
  }
  if (e.videos) {
    const videos = e.videos.map((v) => ({ ...v }));
    for (const video of videos) {
      if (video.content_loc) {
        video.content_loc = resolve(video.content_loc, resolvers);
      }
    }
    e.videos = mergeOnKey(videos, "content_loc");
  }
  return e;
}
const IS_VALID_W3C_DATE = [
  /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/,
  /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)$/,
  /^\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z)$/,
  /^\d{4}-[01]\d-[0-3]\d$/,
  /^\d{4}-[01]\d$/,
  /^\d{4}$/
];
function isValidW3CDate(d) {
  if (!IS_VALID_W3C_DATE.some((r) => r.test(d)))
    return false;
  const [year, month, day] = d.slice(0, 10).split("-").map(Number);
  if (month !== void 0 && (month < 1 || month > 12))
    return false;
  if (day !== void 0 && (day < 1 || day > new Date(year, month, 0).getDate()))
    return false;
  return true;
}
function normaliseDate(d) {
  if (typeof d === "string") {
    const tIdx = d.indexOf("T");
    if (tIdx !== -1) {
      const t = d.slice(tIdx + 1);
      if (!t.includes("+") && !t.includes("-") && !t.includes("Z")) {
        d += "Z";
      }
    }
    if (!isValidW3CDate(d))
      return false;
    d = new Date(d);
    d.setMilliseconds(0);
    if (Number.isNaN(d.getTime()))
      return false;
  }
  const z = (n) => `0${n}`.slice(-2);
  const date = `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`;
  if (d.getUTCHours() > 0 || d.getUTCMinutes() > 0 || d.getUTCSeconds() > 0) {
    return `${date}T${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:${z(d.getUTCSeconds())}Z`;
  }
  return date;
}

function parseChunkInfo(sitemapName, sitemaps, defaultChunkSize) {
  defaultChunkSize = defaultChunkSize || 1e3;
  if (typeof sitemaps.chunks !== "undefined" && !Number.isNaN(Number(sitemapName))) {
    return {
      isChunked: true,
      baseSitemapName: "sitemap",
      chunkIndex: Number(sitemapName),
      chunkSize: defaultChunkSize
    };
  }
  if (sitemapName.includes("-")) {
    const parts = sitemapName.split("-");
    const lastPart = parts.pop();
    if (!Number.isNaN(Number(lastPart))) {
      const baseSitemapName = parts.join("-");
      const baseSitemap = sitemaps[baseSitemapName];
      if (baseSitemap && (baseSitemap.chunks || baseSitemap._isChunking)) {
        const chunkSize = typeof baseSitemap.chunks === "number" ? baseSitemap.chunks : baseSitemap.chunkSize || defaultChunkSize;
        return {
          isChunked: true,
          baseSitemapName,
          chunkIndex: Number(lastPart),
          chunkSize
        };
      }
    }
  }
  return {
    isChunked: false,
    baseSitemapName: sitemapName,
    chunkIndex: void 0,
    chunkSize: defaultChunkSize
  };
}
function sliceUrlsForChunk(urls, sitemapName, sitemaps, defaultChunkSize = 1e3) {
  const chunkInfo = parseChunkInfo(sitemapName, sitemaps, defaultChunkSize);
  if (chunkInfo.isChunked && chunkInfo.chunkIndex !== void 0) {
    const startIndex = chunkInfo.chunkIndex * chunkInfo.chunkSize;
    const endIndex = (chunkInfo.chunkIndex + 1) * chunkInfo.chunkSize;
    return urls.slice(startIndex, endIndex);
  }
  return urls;
}

const naturalCompare = new Intl.Collator(void 0, { numeric: true }).compare;
function countPathSegments(loc) {
  let segments = 1;
  for (let i = 0; i < loc.length; i++) {
    if (loc.charCodeAt(i) === 47)
      segments++;
  }
  return segments;
}
function sortInPlace(urls) {
  urls.sort((a, b) => {
    const aLoc = typeof a === "string" ? a : a.loc;
    const bLoc = typeof b === "string" ? b : b.loc;
    const aSegments = countPathSegments(aLoc);
    const bSegments = countPathSegments(bLoc);
    if (aSegments !== bSegments) {
      return aSegments - bSegments;
    }
    return naturalCompare(aLoc, bLoc);
  });
  return urls;
}

const changeFrequencies = /* @__PURE__ */ new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never"
]);
function readerEntryToSitemapInput(entry) {
  const priority = entry.priority === void 0 ? void 0 : Number.parseFloat(entry.priority);
  const changefreq = entry.changefreq && changeFrequencies.has(entry.changefreq) ? entry.changefreq : void 0;
  return {
    loc: entry.loc,
    ...entry.lastmod ? { lastmod: entry.lastmod } : {},
    ...changefreq ? { changefreq } : {},
    ...priority !== void 0 && Number.isFinite(priority) ? { priority } : {},
    ...entry.extensions?.alternatives ? { alternatives: entry.extensions.alternatives.map(({ hreflang, href }) => ({ hreflang, href })) } : {},
    ...entry.extensions?.images ? {
      images: entry.extensions.images.map((image) => ({
        loc: image.loc,
        ...image.caption ? { caption: image.caption } : {},
        ...image.geoLocation ? { geo_location: image.geoLocation } : {},
        ...image.title ? { title: image.title } : {},
        ...image.license ? { license: image.license } : {}
      }))
    } : {},
    ...entry.extensions?.videos ? { videos: entry.extensions.videos } : {},
    ...entry.extensions?.news ? { news: entry.extensions.news } : {}
  };
}
function normalizeSourceInput(source) {
  if (typeof source === "string") {
    return { context: { name: "hook" }, fetch: source };
  }
  if (Array.isArray(source)) {
    return { context: { name: "hook" }, fetch: source };
  }
  return source;
}
async function tryFetchWithFallback(url, options, event) {
  const isExternalUrl = !url.startsWith("/");
  if (isExternalUrl) {
    const strategies = [
      // Strategy 1: Use globalThis.$fetch (original approach)
      () => globalThis.$fetch(url, options),
      // Strategy 2: If event is available, try using event context even for external URLs
      event ? () => fetchWithEvent(event, url, options) : null,
      // Strategy 3: Use native fetch as last resort
      () => $fetch(url, options)
    ].filter(Boolean);
    let lastError = null;
    for (const strategy of strategies) {
      try {
        return await strategy();
      } catch (error) {
        lastError = error;
        continue;
      }
    }
    throw lastError;
  }
  return event ? await fetchWithEvent(event, url, options) : await globalThis.$fetch(url, options);
}
const SOURCE_FETCH_MEMO_KEY = "_sitemapSourceFetches";
const SERVER_CACHE_MAX_AGE$2 = staticConfig.cacheMaxAgeSeconds;
function useSourceFetchMemo(event) {
  const context = event?.context;
  if (!context)
    return void 0;
  const existing = context[SOURCE_FETCH_MEMO_KEY];
  if (existing)
    return existing;
  const memo = /* @__PURE__ */ new Map();
  context[SOURCE_FETCH_MEMO_KEY] = memo;
  return memo;
}
function hashCacheKey(key) {
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let i = 0; i < key.length; i++) {
    const ch = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const fetchSourceUrlsCached = defineCachedFunction(
  (event, _key, url, options) => fetchSourceUrls(url, options, event),
  {
    name: "sitemap:source-urls",
    group: "sitemap",
    base: "sitemap",
    maxAge: SERVER_CACHE_MAX_AGE$2,
    getKey: (event, key) => {
      const host = getHeader(event, "x-forwarded-host") || getHeader(event, "host") || "";
      const proto = getHeader(event, "x-forwarded-proto") || "https";
      return `source-${proto}-${host}-${hashCacheKey(key)}`;
    },
    swr: true,
    // A failed fetch must never be served again, otherwise one outage empties the sitemap for a
    // whole cache window.
    validate: (entry) => {
      const value = entry.value;
      return value !== void 0 && !value._isFailure;
    }
  }
);
function isSourceCacheEnabled() {
  const cacheMaxAgeSeconds = staticConfig.cacheMaxAgeSeconds;
  return cacheMaxAgeSeconds > 0;
}
async function fetchDataSource(input, event) {
  const context = typeof input.context === "string" ? { name: input.context } : input.context || { name: "fetch" };
  const url = typeof input.fetch === "string" ? input.fetch : input.fetch[0];
  const options = typeof input.fetch === "string" ? {} : input.fetch[1];
  const memo = useSourceFetchMemo(event);
  const key = `${url}::${JSON.stringify(options || {})}`;
  let request = memo?.get(key);
  if (!request) {
    request = event && isSourceCacheEnabled() ? fetchSourceUrlsCached(event, key, url, options) : fetchSourceUrls(url, options, event);
    memo?.set(key, request);
  }
  const result = await request;
  if (result._isFailure)
    memo?.delete(key);
  return { ...input, context, ...result };
}
async function fetchSourceUrls(url, options, event) {
  const start = Date.now();
  const isExternalUrl = !url.startsWith("/");
  const timeout = isExternalUrl ? 1e4 : options.timeout || 5e3;
  const timeoutController = new AbortController();
  const abortRequestTimeout = setTimeout(() => timeoutController.abort(), timeout);
  try {
    let isMaybeErrorResponse = false;
    const pathname = parseURL(url).pathname.toLowerCase();
    const isGzUrl = pathname.endsWith(".gz");
    const isXmlRequest = pathname.endsWith(".xml") || isGzUrl;
    const mergedHeaders = defu(
      options?.headers,
      {
        Accept: isXmlRequest ? "text/xml" : "application/json"
      },
      event && !isExternalUrl ? { host: getRequestHost(event, { xForwardedHost: true }) } : {}
    );
    const fetchOptions = {
      ...options,
      // Fetch XML sources as raw bytes so we can detect and decompress a gzip body
      // (either a `.gz` URL, or a server that serves gzip without Content-Encoding)
      // before it's mangled by a UTF-8 text decode.
      responseType: isXmlRequest ? "arrayBuffer" : "json",
      signal: timeoutController.signal,
      headers: mergedHeaders,
      // Use ofetch's built-in retry for external sources
      ...isExternalUrl && {
        retry: 2,
        retryDelay: 200
      },
      // @ts-expect-error untyped
      onResponse({ response }) {
        if (typeof response._data === "string" && response._data.startsWith("<!DOCTYPE html>"))
          isMaybeErrorResponse = true;
      }
    };
    const res = await tryFetchWithFallback(url, fetchOptions, event);
    const timeTakenMs = Date.now() - start;
    if (isMaybeErrorResponse) {
      return {
        urls: [],
        timeTakenMs,
        error: "Received HTML response instead of JSON",
        // An HTML page is usually an outage or an auth wall, both transient. Treat it like a
        // failed fetch so the empty result is never cached.
        _isFailure: true
      };
    }
    let urls = [];
    if (isXmlRequest) {
      const bytes = res instanceof Uint8Array ? res : new Uint8Array(res);
      const result = await collectSitemap(bytes);
      if (result._tag !== "document")
        throw new Error(result.issues.map((issue) => issue.message).join("; ") || "Invalid sitemap document");
      if (result.document._tag !== "urlset")
        throw new Error("Sitemap URL source must be a URL set, not a sitemap index");
      urls = result.document.entries.map(readerEntryToSitemapInput);
    } else if (typeof res === "object") {
      urls = res.urls || res;
    }
    return {
      timeTakenMs,
      urls
    };
  } catch (_err) {
    const error = _err;
    if (isExternalUrl) {
      const errorInfo = {
        url,
        timeout,
        error: error.message,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        method: options?.method || "GET"
      };
      logger.error("Failed to fetch external source.", errorInfo);
    } else {
      logger.error("Failed to fetch source.", { url, error: error.message });
    }
    return {
      urls: [],
      error: error.message,
      _isFailure: true
      // Mark as failure to prevent caching
    };
  } finally {
    if (abortRequestTimeout) {
      clearTimeout(abortRequestTimeout);
    }
  }
}
async function globalSitemapSources() {
  const m = await import('../virtual/global-sources.mjs');
  return [...m.sources];
}
async function childSitemapSources(definition) {
  if (definition?.sources?.length)
    return [...definition.sources];
  if (definition?.urls) {
    const urls = typeof definition.urls === "function" ? await definition.urls() : definition.urls;
    return [{
      context: { name: `sitemaps:${definition.sitemapName}:urls`, description: "Set with the sitemap definition `urls`." },
      urls
    }];
  }
  if (!definition?._hasSourceChunk)
    return [];
  const m = await import('../virtual/child-sources.mjs');
  return [...m.sources[definition.sitemapName] || []];
}
async function resolveSitemapSources(sources, event) {
  return await Promise.all(
    sources.map((source) => {
      const normalized = normalizeSourceInput(source);
      if ("urls" in normalized) {
        return {
          timeTakenMs: 0,
          ...normalized,
          urls: normalized.urls
        };
      }
      if (normalized.fetch)
        return fetchDataSource(normalized, event);
      return {
        ...normalized,
        error: "Invalid source"
      };
    })
  );
}

function isGeneratedAlternative(alternative) {
  return alternative._i18nGenerated !== void 0 && alternative._i18nGenerated === JSON.stringify([alternative.hreflang, alternative.href.toString()]);
}
function resolveSitemapEntries(sitemap, urls, runtimeConfig, resolvers, baseURL) {
  const {
    autoI18n: configuredI18n,
    isI18nMapped
  } = runtimeConfig;
  const requestHost = configuredI18n?.multiDomainLocales && resolvers ? parseURL(resolvers.canonicalUrlResolver("/")).host : void 0;
  const domain = configuredI18n?.multiDomainLocales ? resolveI18nDomain(requestHost, configuredI18n) : void 0;
  const autoI18n = configuredI18n && domain ? { ...configuredI18n, defaultLocale: domain.defaultLocale } : configuredI18n;
  const availableLocales = domain?.locales || autoI18n?.locales;
  const hasFilters = !!sitemap.include?.length || !!sitemap.exclude?.length;
  const filterPath = hasFilters ? createPathFilter({
    include: sitemap.include,
    exclude: sitemap.exclude
  }, baseURL || "/") : void 0;
  const domainLocaleCodes = autoI18n?.multiDomainLocales && autoI18n.strategy !== "no_prefix" ? new Set(autoI18n.locales.map((l) => l.code)) : void 0;
  const domainLocaleKeys = autoI18n?.multiDomainLocales ? autoI18n.locales.map((l) => l._sitemap) : [];
  const _urls = [];
  const unavailableEntries = /* @__PURE__ */ new Set();
  for (const _e of urls) {
    const e = preNormalizeEntry(_e, resolvers);
    if (autoI18n && domainLocaleCodes && !e._abs && !e._i18nTransform && !e._i18nUnlocalized) {
      const prefix = splitForLocales(e._path?.pathname || "/", domainLocaleCodes)[0];
      const localeCode = prefix || autoI18n.defaultLocale;
      const sitemapLocale = isI18nMapped && typeof e._sitemap === "string" ? resolveI18nSitemapLocaleKey(e._sitemap, domainLocaleKeys) : null;
      const locale = autoI18n.locales.find((l) => l.code === localeCode);
      if (locale && availableLocales && !availableLocales.includes(locale))
        continue;
      if (autoI18n.strategy === "prefix_except_default" && prefix === autoI18n.defaultLocale)
        continue;
      if (sitemapLocale && sitemapLocale !== locale?._sitemap)
        continue;
      if (e.alternatives?.some(isGeneratedAlternative)) {
        const alternatives = e.alternatives.filter((alternative) => {
          if (!isGeneratedAlternative(alternative))
            return true;
          if (alternative.hreflang === "x-default")
            return false;
          const alternateLocale = autoI18n.locales.find((l) => l._hreflang === alternative.hreflang);
          if (!alternateLocale)
            return true;
          if (availableLocales && !availableLocales.includes(alternateLocale))
            return false;
          const alternatePrefix = splitForLocales(parseURL(alternative.href.toString()).pathname || "/", domainLocaleCodes)[0];
          if (["prefix_except_default", "prefix_and_default"].includes(autoI18n.strategy) && alternatePrefix === autoI18n.defaultLocale)
            return false;
          return (alternatePrefix || autoI18n.defaultLocale) === alternateLocale.code;
        });
        const defaultHreflang = autoI18n.locales.find((l) => l.code === autoI18n.defaultLocale)?._hreflang;
        const defaultAlternative = alternatives.find((a) => a.hreflang === defaultHreflang);
        e.alternatives = defaultAlternative && !alternatives.some((alternative) => alternative.hreflang === "x-default") ? [...alternatives, { ...defaultAlternative, hreflang: "x-default" }] : alternatives;
      }
    }
    const needsExpansion = e._i18nTransform && autoI18n && autoI18n.strategy !== "no_prefix";
    if (e.loc && (needsExpansion || !filterPath || filterPath(e.loc, e._path?.pathname)))
      _urls.push(e);
  }
  const withoutPrefixPaths = {};
  if (autoI18n && autoI18n.strategy !== "no_prefix") {
    const localeCodes = new Set(autoI18n.locales.map((l) => l.code));
    const localeByCode = new Map(autoI18n.locales.map((l) => [l.code, l]));
    const defaultLocale = autoI18n.defaultLocale;
    const hasDifferentDomains = !!autoI18n.differentDomains;
    const validI18nUrlsForTransform = [];
    for (let i = 0; i < _urls.length; i++) {
      const _e = _urls[i];
      if (_e._abs && !_e._i18nTransform)
        continue;
      const split = _e._i18nUnlocalized ? [null, _e._relativeLoc] : splitForLocales(_e._relativeLoc, localeCodes);
      let localeCode = split[0];
      const pathWithoutPrefix = split[1];
      if (!localeCode)
        localeCode = defaultLocale;
      const e = _e;
      e._pathWithoutPrefix = pathWithoutPrefix;
      const locale = localeByCode.get(localeCode);
      if (!locale)
        continue;
      e._locale = locale;
      e._index = i;
      e._key = `${e._sitemap || ""}${e._path?.pathname || "/"}${e._path?.search || ""}`;
      withoutPrefixPaths[pathWithoutPrefix] = withoutPrefixPaths[pathWithoutPrefix] || [];
      if (!e._i18nTransform && !e._i18nUnlocalized && !withoutPrefixPaths[pathWithoutPrefix].some((e2) => e2._locale.code === locale.code))
        withoutPrefixPaths[pathWithoutPrefix].push(e);
      validI18nUrlsForTransform.push(e);
    }
    for (const e of validI18nUrlsForTransform) {
      if (!e._i18nTransform && !e.alternatives?.length) {
        const alternatives = [];
        for (const u of e._i18nUnlocalized ? [e] : withoutPrefixPaths[e._pathWithoutPrefix] || []) {
          if (autoI18n.multiDomainLocales && availableLocales && !availableLocales.includes(u._locale))
            continue;
          if (u._locale.code === defaultLocale) {
            alternatives.push({
              href: u.loc,
              hreflang: "x-default"
            });
          }
          alternatives.push({
            href: u.loc,
            hreflang: u._locale._hreflang || defaultLocale
          });
        }
        if (alternatives.length)
          e.alternatives = alternatives;
      } else if (e._i18nTransform) {
        delete e._i18nTransform;
        const routeEntries = resolveI18nRouteEntries(e._relativeLoc, autoI18n, (href) => !filterPath || filterPath(href), autoI18n.multiDomainLocales ? { host: requestHost || "", domainMode: "request" } : {});
        if (autoI18n.multiDomainLocales) {
          if (!routeEntries.length) {
            unavailableEntries.add(e);
            continue;
          }
          if (autoI18n.strategy === "prefix_and_default") {
            const defaultEntry = routeEntries.find((entry) => entry.locale.code === defaultLocale);
            if (defaultEntry) {
              routeEntries.push({ ...defaultEntry, loc: `/${defaultLocale}${defaultEntry.loc === "/" ? "" : defaultEntry.loc}` });
            }
          }
        }
        if (hasDifferentDomains) {
          e.alternatives = routeEntries[0]?.alternatives;
        } else {
          const sourceLocaleAvailable = routeEntries.some((entry) => entry.locale.code === e._locale.code);
          for (const { alternatives, locale: l, loc } of routeEntries) {
            const _sitemap = isI18nMapped ? l._sitemap : void 0;
            const { _index: _, ...rest } = e;
            const newEntry = preNormalizeEntry({
              _sitemap,
              ...rest,
              _key: `${_sitemap || ""}${loc || "/"}`,
              _locale: l,
              loc,
              alternatives
            }, resolvers);
            if (e._index !== void 0 && (e._locale.code === newEntry._locale.code || !sourceLocaleAvailable)) {
              _urls[e._index] = newEntry;
              e._index = void 0;
            } else {
              _urls.push(newEntry);
            }
          }
        }
      }
      if (isI18nMapped) {
        e._sitemap = e._sitemap || e._locale._sitemap;
        e._key = `${e._sitemap || ""}${e.loc || "/"}${e._path?.search || ""}`;
      }
      if (e._index)
        _urls[e._index] = e;
    }
  }
  return _urls.filter((entry) => !unavailableEntries.has(entry) && (!filterPath || filterPath(entry.loc, entry._path?.pathname)));
}

const SERVER_CACHE_MAX_AGE$1 = staticConfig.cacheMaxAgeSeconds;
async function buildResolvedSitemapUrls(effectiveSitemap, matchName, isChunked, resolvers, runtimeConfig, nitro) {
  const { sitemaps, autoI18n, isI18nMapped, isMultiSitemap, sortEntries } = runtimeConfig;
  let sourcesInput = effectiveSitemap.includeAppSources ? [...await globalSitemapSources(), ...await childSitemapSources(effectiveSitemap)] : await childSitemapSources(effectiveSitemap);
  if (nitro && resolvers.event) {
    const ctx = {
      event: resolvers.event,
      sitemapName: matchName,
      sources: sourcesInput
    };
    await nitro.hooks.callHook("sitemap:sources", ctx);
    sourcesInput = ctx.sources;
  }
  const sources = await resolveSitemapSources(sourcesInput, resolvers.event);
  const failedSources = sources.filter((source) => source.error && source._isFailure).map((source) => ({
    url: typeof source.fetch === "string" ? source.fetch : source.fetch?.[0] || "unknown",
    error: source.error || "Unknown error"
  }));
  const resolvedCtx = {
    urls: sources.flatMap((s) => s.urls),
    sitemapName: matchName,
    event: resolvers.event
  };
  await nitro?.hooks.callHook("sitemap:input", resolvedCtx);
  const enhancedUrls = resolveSitemapEntries(effectiveSitemap, resolvedCtx.urls, { autoI18n, isI18nMapped }, resolvers, useRuntimeConfig().app.baseURL);
  const localeSitemapKeys = isI18nMapped && autoI18n ? autoI18n.locales.map((l) => l._sitemap) : [];
  if (isMultiSitemap) {
    const sitemapNames = Object.keys(sitemaps).filter((k) => k !== "index");
    const validSitemapNames = new Set(sitemapNames);
    if (isI18nMapped) {
      for (const name of sitemapNames) {
        const localeKey = resolveI18nSitemapLocaleKey(name, localeSitemapKeys);
        if (localeKey)
          validSitemapNames.add(localeKey);
      }
    }
    const warnedSitemaps = nitro?._sitemapWarnedSitemaps || /* @__PURE__ */ new Set();
    for (const e of enhancedUrls) {
      const hasMatchingSitemap = typeof e._sitemap === "string" && validSitemapNames.has(e._sitemap);
      if (typeof e._sitemap === "string" && !hasMatchingSitemap) {
        if (!warnedSitemaps.has(e._sitemap)) {
          warnedSitemaps.add(e._sitemap);
          logger.error(`Sitemap \`${e._sitemap}\` not found in sitemap config. Available sitemaps: ${sitemapNames.join(", ")}. Either add it to the sitemap config or register it with the sitemap:sitemaps-resolved hook. Entry \`${e.loc}\` will be omitted.`);
        }
      }
    }
    if (nitro) {
      nitro._sitemapWarnedSitemaps = warnedSitemaps;
    }
  }
  const matchedLocaleSitemap = isI18nMapped ? resolveI18nSitemapLocaleKey(matchName, localeSitemapKeys) : null;
  const filteredUrls = enhancedUrls.filter((e) => {
    if (e._sitemap === false)
      return false;
    if (isMultiSitemap && e._sitemap && matchName) {
      if (isChunked)
        return e._sitemap === matchName;
      if (e._sitemap === matchName)
        return true;
      if (isI18nMapped)
        return e._sitemap === matchedLocaleSitemap;
      return false;
    }
    return true;
  });
  const urls = sortEntries ? sortInPlace(filteredUrls) : filteredUrls;
  return { urls, failedSources };
}
const buildResolvedSitemapUrlsCached = defineCachedFunction(
  async (_event, effectiveSitemap, matchName, isChunked, resolvers, runtimeConfig, nitro) => buildResolvedSitemapUrls(effectiveSitemap, matchName, isChunked, resolvers, runtimeConfig, nitro),
  {
    name: "sitemap:resolved-urls",
    group: "sitemap",
    base: "sitemap",
    maxAge: SERVER_CACHE_MAX_AGE$1,
    getKey: (event, _effectiveSitemap, matchName, isChunked) => {
      const host = getHeader(event, "x-forwarded-host") || getHeader(event, "host") || "";
      const proto = getHeader(event, "x-forwarded-proto") || "https";
      return `resolved-${isChunked ? "chunked-" : ""}${matchName}-${proto}-${host}`;
    },
    swr: true,
    // A build with failed sources is never cached: one outage must not pin an empty sitemap
    // for a whole cache window. The next request retries the sources instead.
    validate: (entry) => {
      const value = entry.value;
      return value !== void 0 && !value.failedSources?.length;
    }
  }
);
async function getResolvedSitemapUrls(effectiveSitemap, matchName, isChunked, resolvers, runtimeConfig, nitro) {
  const event = resolvers.event;
  const shouldCache = typeof runtimeConfig.cacheMaxAgeSeconds === "number" && runtimeConfig.cacheMaxAgeSeconds > 0;
  if (shouldCache && event) {
    return buildResolvedSitemapUrlsCached(event, effectiveSitemap, matchName, isChunked, resolvers, runtimeConfig, nitro);
  }
  return buildResolvedSitemapUrls(effectiveSitemap, matchName, isChunked, resolvers, runtimeConfig, nitro);
}
async function buildSitemapUrls(sitemap, resolvers, runtimeConfig, nitro) {
  const { sitemaps, autoI18n, defaultSitemapsChunkSize } = runtimeConfig;
  const chunkSize = defaultSitemapsChunkSize || void 0;
  const chunkInfo = parseChunkInfo(sitemap.sitemapName, sitemaps, chunkSize);
  if (autoI18n?.differentDomains) {
    const domain = autoI18n.locales.find((e) => e.language === sitemap.sitemapName || e.code === sitemap.sitemapName)?.domain;
    if (domain) {
      const _tester = resolvers.canonicalUrlResolver;
      resolvers.canonicalUrlResolver = (path) => resolveSitePath(path, {
        absolute: true,
        withBase: false,
        siteUrl: withHttps(domain),
        trailingSlash: _tester("/test/").endsWith("/"),
        base: "/"
      });
    }
  }
  let effectiveSitemap = sitemap;
  const baseSitemapName = chunkInfo.baseSitemapName;
  if (chunkInfo.isChunked && baseSitemapName !== sitemap.sitemapName && sitemaps[baseSitemapName]) {
    effectiveSitemap = sitemaps[baseSitemapName];
  }
  const matchName = chunkInfo.isChunked ? baseSitemapName : sitemap.sitemapName;
  const resolved = await getResolvedSitemapUrls(effectiveSitemap, matchName, chunkInfo.isChunked, resolvers, runtimeConfig, nitro);
  const urls = sliceUrlsForChunk(resolved.urls, sitemap.sitemapName, sitemaps, chunkSize);
  return { urls, failedSources: resolved.failedSources };
}

const SERVER_CACHE_MAX_AGE = staticConfig.cacheMaxAgeSeconds;
function useNitroUrlResolvers(e) {
  const canonicalQuery = getQuery(e).canonical;
  const isShowingCanonical = typeof canonicalQuery !== "undefined" && canonicalQuery !== "false";
  const siteConfig = getSiteConfig(e);
  return {
    event: e,
    fixSlashes: (path) => fixSlashes(siteConfig.trailingSlash, path),
    // we need these as they depend on the nitro event
    canonicalUrlResolver: createSitePathResolver(e, {
      canonical: isShowingCanonical || true,
      absolute: true,
      withBase: true
    }),
    relativeBaseUrlResolver: createSitePathResolver(e, { absolute: false, withBase: true })
  };
}
async function buildSitemapRenderPlan(event, definition, resolvers, runtimeConfig) {
  const { sitemapName } = definition;
  const nitro = useNitroApp();
  const { urls: resolvedSitemapUrls, failedSources } = await buildSitemapUrls(definition, resolvers, runtimeConfig, nitro);
  const sitemapUrls = resolvedSitemapUrls.slice();
  const routeRuleMatcher = createNitroRouteRuleMatcher(useRuntimeConfig(event));
  const { autoI18n } = runtimeConfig;
  const localeCodes = autoI18n?.locales && autoI18n.strategy !== "no_prefix" ? new Set(autoI18n.locales.map((l) => l.code)) : void 0;
  sitemapUrls.length;
  let validCount = 0;
  for (let i = 0; i < sitemapUrls.length; i++) {
    const u = sitemapUrls[i];
    const path = u._path?.pathname || u.loc;
    if (!getPathRobotConfig(event, { path, skipSiteIndexable: true }).indexable)
      continue;
    let routeRules = routeRuleMatcher(path);
    if (localeCodes) {
      const match = splitForLocales(path, localeCodes);
      const pathWithoutPrefix = match[1];
      if (pathWithoutPrefix && pathWithoutPrefix !== path)
        routeRules = defu(routeRules, routeRuleMatcher(pathWithoutPrefix));
    }
    if (routeRules.sitemap === false)
      continue;
    if (typeof routeRules.robots !== "undefined" && !routeRules.robots)
      continue;
    let hasRobotsDisabled = false;
    const headers = routeRules.headers;
    if (headers) {
      for (const name in headers) {
        if (name.toLowerCase() === "x-robots-tag" && headers[name].toLowerCase().includes("noindex")) {
          hasRobotsDisabled = true;
          break;
        }
      }
    }
    if (routeRules.redirect || hasRobotsDisabled)
      continue;
    sitemapUrls[validCount++] = routeRules.sitemap ? defu(u, routeRules.sitemap) : u;
  }
  sitemapUrls.length = validCount;
  const locSize = sitemapUrls.length;
  const resolvedCtx = {
    urls: sitemapUrls,
    sitemapName,
    event
  };
  await nitro.hooks.callHook("sitemap:resolved", resolvedCtx);
  if (resolvedCtx.urls.length !== locSize) {
    for (let i = 0; i < resolvedCtx.urls.length; i++)
      resolvedCtx.urls[i] = preNormalizeEntry(resolvedCtx.urls[i], resolvers);
  }
  const maybeSort = (urls2) => runtimeConfig.sortEntries ? sortInPlace(urls2) : urls2;
  const defaults = definition.defaults;
  const normalizedPreDedupe = resolvedCtx.urls;
  const firstLastmod = normalizedPreDedupe[0]?.lastmod ?? defaults?.lastmod;
  let cacheLastmod = normalizedPreDedupe.length > 1 && !!firstLastmod;
  for (let i = 1; cacheLastmod && i < Math.min(normalizedPreDedupe.length, 8); i++)
    cacheLastmod = (normalizedPreDedupe[i].lastmod ?? defaults?.lastmod) === firstLastmod;
  const normaliseCache = cacheLastmod ? {} : void 0;
  for (let i = 0; i < normalizedPreDedupe.length; i++)
    normalizedPreDedupe[i] = normaliseEntry(normalizedPreDedupe[i], defaults, resolvers, normaliseCache);
  const duplicateKeys = /* @__PURE__ */ new Set();
  const urls = mergeOnKey(normalizedPreDedupe, "_key", (key) => duplicateKeys.add(key));
  if (duplicateKeys.size) {
    for (let i = 0; i < urls.length; i++) {
      if (duplicateKeys.has(urls[i]._key))
        urls[i] = normaliseEntry(urls[i], defaults, resolvers, normaliseCache);
    }
  }
  maybeSort(urls);
  if (definition._isChunking && definition.sitemapName.includes("-")) {
    const parts = definition.sitemapName.split("-");
    const lastPart = parts.pop();
    if (!Number.isNaN(Number(lastPart))) {
      const chunkIndex = Number(lastPart);
      const baseSitemapName = parts.join("-");
      if (urls.length === 0 && chunkIndex > 0) {
        throw createError$1({
          statusCode: 404,
          message: `Sitemap chunk ${chunkIndex} for "${baseSitemapName}" does not exist.`
        });
      }
    }
  }
  const errorInfo = failedSources.length > 0 ? {
    messages: failedSources.map((f) => f.error),
    urls: failedSources.map((f) => f.url)
  } : void 0;
  return { errorInfo, sitemapName, urls };
}
async function renderSitemapOutput(nitro, event, sitemapName, renderString, renderStream, shouldStream, debug) {
  let buffered = false;
  let sitemap;
  const ctx = { sitemapName, event };
  Object.defineProperty(ctx, "sitemap", {
    configurable: true,
    enumerable: true,
    get() {
      buffered = true;
      sitemap ??= renderString();
      return sitemap;
    },
    set(value) {
      buffered = true;
      sitemap = value;
    }
  });
  await nitro.hooks.callHook("sitemap:output", ctx);
  if (debug)
    setHeader(event, "X-Sitemap-Render-Mode", buffered ? "buffered-hook" : "stream");
  return buffered ? createChunkedXmlStream([sitemap]) : renderStream();
}
async function buildSitemapXml(event, definition, resolvers, runtimeConfig) {
  const { errorInfo, sitemapName, urls } = await buildSitemapRenderPlan(event, definition, resolvers, runtimeConfig);
  const sitemap = urlsToXml(urls, resolvers, runtimeConfig, errorInfo);
  const ctx = { sitemap, sitemapName, event };
  await useNitroApp().hooks.callHook("sitemap:output", ctx);
  return ctx.sitemap;
}
function getSitemapCacheKey(event, definition) {
  const host = getHeader(event, "x-forwarded-host") || getHeader(event, "host") || "";
  const proto = getHeader(event, "x-forwarded-proto") || "https";
  const sitemapName = definition.sitemapName || "default";
  return `${sitemapName}-${proto}-${host}`;
}
const buildSitemapRenderPlanCached = defineCachedFunction(
  buildSitemapRenderPlan,
  {
    name: "sitemap:render-plan",
    group: "sitemap",
    maxAge: SERVER_CACHE_MAX_AGE,
    base: "sitemap",
    getKey: getSitemapCacheKey,
    swr: true
  }
);
const buildSitemapXmlCached = defineCachedFunction(
  buildSitemapXml,
  {
    name: "sitemap:xml",
    group: "sitemap",
    maxAge: SERVER_CACHE_MAX_AGE,
    base: "sitemap",
    // Use the sitemap storage
    getKey: getSitemapCacheKey,
    swr: true
    // Enable stale-while-revalidate
  }
);
function setSitemapResponseHeaders(event, runtimeConfig) {
  setHeader(event, "Content-Type", "text/xml; charset=UTF-8");
  if (runtimeConfig.cacheMaxAgeSeconds) {
    setHeader(event, "Cache-Control", `public, max-age=${runtimeConfig.cacheMaxAgeSeconds}, s-maxage=${runtimeConfig.cacheMaxAgeSeconds}, stale-while-revalidate=3600`);
    const now = /* @__PURE__ */ new Date();
    setHeader(event, "X-Sitemap-Generated", now.toISOString());
    setHeader(event, "X-Sitemap-Cache-Duration", `${runtimeConfig.cacheMaxAgeSeconds}s`);
    const expiryTime = new Date(now.getTime() + runtimeConfig.cacheMaxAgeSeconds * 1e3);
    setHeader(event, "X-Sitemap-Cache-Expires", expiryTime.toISOString());
    const remainingSeconds = Math.floor((expiryTime.getTime() - now.getTime()) / 1e3);
    setHeader(event, "X-Sitemap-Cache-Remaining", `${remainingSeconds}s`);
  } else {
    setHeader(event, "Cache-Control", `no-cache, no-store`);
  }
  event.context._isSitemap = true;
}
async function createSitemap(event, definition, runtimeConfig) {
  const resolvers = useNitroUrlResolvers(event);
  const shouldStream = !!runtimeConfig.experimentalStreaming && true;
  const shouldCache = typeof runtimeConfig.cacheMaxAgeSeconds === "number" && runtimeConfig.cacheMaxAgeSeconds > 0;
  let xml;
  if (shouldStream) {
    const { errorInfo, sitemapName, urls } = shouldCache ? await buildSitemapRenderPlanCached(event, definition, resolvers, runtimeConfig) : await buildSitemapRenderPlan(event, definition, resolvers, runtimeConfig);
    xml = await renderSitemapOutput(
      useNitroApp(),
      event,
      sitemapName,
      () => urlsToXml(urls, resolvers, runtimeConfig, errorInfo),
      () => urlsToXmlStream(urls, resolvers, runtimeConfig, errorInfo),
      true,
      runtimeConfig.debug
    );
  } else {
    xml = shouldCache ? await buildSitemapXmlCached(event, definition, resolvers, runtimeConfig) : await buildSitemapXml(event, definition, resolvers, runtimeConfig);
  }
  setSitemapResponseHeaders(event, runtimeConfig);
  return xml;
}

async function sitemapXmlEventHandler(e) {
  const runtimeConfig = await useResolvedSitemapRuntimeConfig(e);
  const { sitemaps } = runtimeConfig;
  if ("index" in sitemaps)
    return sendRedirect(e, withBase("/sitemap_index.xml", useRuntimeConfig().app.baseURL), 301);
  return createSitemap(e, Object.values(sitemaps)[0], runtimeConfig);
}

const _sWgcOi = defineEventHandler(sitemapXmlEventHandler);

const _SxA8c9 = defineEventHandler(() => {});

const _lazy_ztAdJY = () => import('../routes/api/challenge.get.mjs');
const _lazy_voUxNX = () => import('../routes/api/daily.get.mjs');
const _lazy_MmTadL = () => import('../routes/api/draw.get.mjs');
const _lazy_Yf8olQ = () => import('../routes/api/reveal.post.mjs');
const _lazy_tv0CIq = () => import('../routes/renderer.mjs').then(function (n) { return n.r; });

const handlers = [
  { route: '/api/challenge', handler: _lazy_ztAdJY, lazy: true, middleware: false, method: "get" },
  { route: '/api/daily', handler: _lazy_voUxNX, lazy: true, middleware: false, method: "get" },
  { route: '/api/draw', handler: _lazy_MmTadL, lazy: true, middleware: false, method: "get" },
  { route: '/api/reveal', handler: _lazy_Yf8olQ, lazy: true, middleware: false, method: "post" },
  { route: '/__nuxt_error', handler: _lazy_tv0CIq, lazy: true, middleware: false, method: undefined },
  { route: '', handler: _k37g58, lazy: false, middleware: false, method: undefined },
  { route: '', handler: _oHEB31, lazy: false, middleware: false, method: undefined },
  { route: '', handler: _YGx6p3, lazy: false, middleware: false, method: undefined },
  { route: '', handler: _0P2yxi, lazy: false, middleware: false, method: undefined },
  { route: '', handler: _jH9RiR, lazy: false, middleware: false, method: undefined },
  { route: '', handler: _1aUAZi, lazy: false, middleware: true, method: undefined },
  { route: '/robots.txt', handler: _Lyjc8Y, lazy: false, middleware: false, method: undefined },
  { route: '', handler: _ppW2RI, lazy: false, middleware: true, method: undefined },
  { route: '/__sitemap__/style.xsl', handler: _BZ8x1m, lazy: false, middleware: false, method: undefined },
  { route: '/sitemap.xml', handler: _sWgcOi, lazy: false, middleware: false, method: undefined },
  { route: '/__nuxt_island/**', handler: _SxA8c9, lazy: false, middleware: false, method: undefined },
  { route: '/**', handler: _lazy_tv0CIq, lazy: true, middleware: false, method: undefined }
];

function createNitroApp() {
  const config = useRuntimeConfig();
  const hooks = createHooks();
  const captureError = (error, context = {}) => {
    const promise = hooks.callHookParallel("error", error, context).catch((error_) => {
      console.error("Error while capturing another error", error_);
    });
    if (context.event && isEvent(context.event)) {
      const errors = context.event.context.nitro?.errors;
      if (errors) {
        errors.push({ error, context });
      }
      if (context.event.waitUntil) {
        context.event.waitUntil(promise);
      }
    }
  };
  const h3App = createApp({
    debug: destr(false),
    onError: (error, event) => {
      captureError(error, { event, tags: ["request"] });
      return errorHandler(error, event);
    },
    onRequest: async (event) => {
      event.context.nitro = event.context.nitro || { errors: [] };
      const fetchContext = event.node.req?.__unenv__;
      if (fetchContext?._platform) {
        event.context = {
          _platform: fetchContext?._platform,
          // #3335
          ...fetchContext._platform,
          ...event.context
        };
      }
      if (!event.context.waitUntil && fetchContext?.waitUntil) {
        event.context.waitUntil = fetchContext.waitUntil;
      }
      event.fetch = (req, init) => fetchWithEvent$1(event, req, init, { fetch: localFetch });
      event.$fetch = (req, init) => fetchWithEvent$1(event, req, init, {
        fetch: $fetch
      });
      event.waitUntil = (promise) => {
        if (!event.context.nitro._waitUntilPromises) {
          event.context.nitro._waitUntilPromises = [];
        }
        event.context.nitro._waitUntilPromises.push(promise);
        if (event.context.waitUntil) {
          event.context.waitUntil(promise);
        }
      };
      event.captureError = (error, context) => {
        captureError(error, { event, ...context });
      };
      await nitroApp$1.hooks.callHook("request", event).catch((error) => {
        captureError(error, { event, tags: ["request"] });
      });
    },
    onBeforeResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("beforeResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    },
    onAfterResponse: async (event, response) => {
      await nitroApp$1.hooks.callHook("afterResponse", event, response).catch((error) => {
        captureError(error, { event, tags: ["request", "response"] });
      });
    }
  });
  const router = createRouter({
    preemptive: true
  });
  const nodeHandler = toNodeListener(h3App);
  const localCall = (aRequest) => b$1(
    nodeHandler,
    aRequest
  );
  const localFetch = (input, init) => {
    if (!input.toString().startsWith("/")) {
      return globalThis.fetch(input, init);
    }
    return C(
      nodeHandler,
      input,
      init
    ).then((response) => normalizeFetchResponse(response));
  };
  const $fetch = createFetch({
    fetch: localFetch,
    Headers: Headers$1,
    defaults: { baseURL: config.app.baseURL }
  });
  globalThis.$fetch = $fetch;
  h3App.use(createRouteRulesHandler({ localFetch }));
  for (const h of handlers) {
    let handler = h.lazy ? lazyEventHandler(h.handler) : h.handler;
    if (h.middleware || !h.route) {
      const middlewareBase = (config.app.baseURL + (h.route || "/")).replace(
        /\/+/g,
        "/"
      );
      h3App.use(middlewareBase, handler);
    } else {
      const routeRules = getRouteRulesForPath(
        h.route.replace(/:\w+|\*\*/g, "_")
      );
      if (routeRules.cache) {
        handler = cachedEventHandler(handler, {
          group: "nitro/routes",
          ...routeRules.cache
        });
      }
      router.use(h.route, handler, h.method);
    }
  }
  h3App.use(config.app.baseURL, router.handler);
  const app = {
    hooks,
    h3App,
    router,
    localCall,
    localFetch,
    captureError
  };
  return app;
}
function runNitroPlugins(nitroApp2) {
  for (const plugin of plugins) {
    try {
      plugin(nitroApp2);
    } catch (error) {
      nitroApp2.captureError(error, { tags: ["plugin"] });
      throw error;
    }
  }
}
const nitroApp$1 = createNitroApp();
function useNitroApp() {
  return nitroApp$1;
}
runNitroPlugins(nitroApp$1);

const nitroApp = useNitroApp();
const handler = async (req) => {
  const url = new URL(req.url);
  const relativeUrl = `${url.pathname}${url.search}`;
  const r = await nitroApp.localCall({
    url: relativeUrl,
    headers: req.headers,
    method: req.method,
    body: req.body
  });
  const headers = normalizeResponseHeaders({
    ...getCacheHeaders(url.pathname),
    ...r.headers
  });
  return new Response(r.body, {
    status: r.status,
    headers
  });
};
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
function normalizeResponseHeaders(headers) {
  const outgoingHeaders = new Headers();
  for (const [name, header] of Object.entries(headers)) {
    if (name === "set-cookie") {
      for (const cookie of normalizeCookieHeader(header)) {
        outgoingHeaders.append("set-cookie", cookie);
      }
    } else if (header !== void 0) {
      outgoingHeaders.set(name, joinHeaders(header));
    }
  }
  return outgoingHeaders;
}
function getCacheHeaders(url) {
  const { isr } = getRouteRulesForPath(url);
  if (isr) {
    const maxAge = typeof isr === "number" ? isr : ONE_YEAR_IN_SECONDS;
    const revalidateDirective = typeof isr === "number" ? `stale-while-revalidate=${ONE_YEAR_IN_SECONDS}` : "must-revalidate";
    return {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": `public, max-age=${maxAge}, ${revalidateDirective}, durable`
    };
  }
  return {};
}

export { $fetch as $, sanitizeStatusCode as A, parseURL as B, decodePath as C, parseQuery as D, isScriptProtocol as E, withTrailingSlash as F, withoutTrailingSlash as G, baseURL as H, defu as I, titleCase as J, stringifyQuery as K, withLeadingSlash as L, withBase as M, dayIndexForDate as N, OBJECTIVE_KINDS as O, objectiveValueOptions as P, handler as Q, assignPrefilledPlayers as a, buildObjective as b, createError$1 as c, defineEventHandler as d, getDailyFormationCode as e, getDailyObjective as f, getQuery as g, getDailyPrefilledSlotIds as h, getPlayersByPosition as i, getPlayerById as j, encodePath as k, buildAssetsURL as l, defineRenderHandler as m, destr as n, getRouteRules as o, publicAssetsURL as p, joinURL as q, readBody as r, signPlayerToken as s, getResponseStatusText as t, useRuntimeConfig as u, verifyPlayerToken as v, getResponseStatus as w, useNitroApp as x, hasProtocol as y, withQuery as z };
//# sourceMappingURL=nitro.mjs.map
