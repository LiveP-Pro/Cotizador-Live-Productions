"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Draft = require("../../equipment-draft-logistics.js");
const source = () => fs.readFileSync(require.resolve("../../equipment-draft-transfers.js"), "utf8");
const copy = (value) => JSON.parse(JSON.stringify(value));
const decode = (value) => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const camel = (value) => value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function deferred() { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; }

// A small tree-backed DOM for this component. Descendant queries, replaced
// innerHTML subtrees, checked/disabled controls and event callbacks behave as
// their browser equivalents; no product helper is mocked or reimplemented.
function documentHarness() {
  let document;
  class Element {
    constructor(tag = "div", attributes = {}) {
      this.tagName = tag.toLowerCase(); this.attributes = attributes; this.children = []; this.parentElement = null;
      this.listeners = {}; this.dataset = {}; this.disabled = Object.hasOwn(attributes, "disabled"); this.checked = Object.hasOwn(attributes, "checked");
      this.value = attributes.value || ""; this._text = ""; this._html = ""; this.className = attributes.class || "";
      for (const [name, value] of Object.entries(attributes)) if (name.startsWith("data-")) this.dataset[camel(name.slice(5))] = value;
      this.classList = { toggle: (name, force) => { const classes = new Set(this.className.split(/\s+/).filter(Boolean)); const include = force === undefined ? !classes.has(name) : force; include ? classes.add(name) : classes.delete(name); this.className = [...classes].join(" "); } };
    }
    append(child) { child.parentElement = this; this.children.push(child); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this._html = String(value); this._text = ""; this.children = [];
      const stack = [this]; const voids = new Set(["input", "img", "br", "hr", "meta", "link"]);
      for (const token of this._html.matchAll(/<\/?[A-Za-z][^>]*>|[^<]+/g)) {
        const raw = token[0];
        if (raw.startsWith("</")) { const tag = raw.match(/^<\/([A-Za-z0-9-]+)/)[1].toLowerCase(); while (stack.length > 1) { if (stack.pop().tagName === tag) break; } continue; }
        if (!raw.startsWith("<")) { stack.at(-1)._text += decode(raw); continue; }
        const tag = raw.match(/^<([A-Za-z0-9-]+)/)[1].toLowerCase(); const attributes = {};
        const attrText = raw.slice(tag.length + 1, -1);
        for (const match of attrText.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attributes[match[1]] = decode(match[2] ?? match[3] ?? match[4] ?? "");
        const child = new Element(tag, attributes); stack.at(-1).append(child);
        if (!voids.has(tag)) stack.push(child);
      }
      const textareas = this.querySelectorAll("textarea"); textareas.forEach(element => { element.value = element.textContent; });
    }
    set textContent(value) { this._text = String(value); this.children = []; this._html = ""; }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
    matches(selector) {
      let current = selector.trim();
      if (current.includes(":not([disabled])")) { if (this.disabled) return false; current = current.replace(":not([disabled])", ""); }
      const tag = current.match(/^[A-Za-z][A-Za-z0-9-]*/)?.[0]; if (tag && this.tagName !== tag.toLowerCase()) return false;
      const className = current.match(/\.([A-Za-z0-9_-]+)/)?.[1]; if (className && !this.className.split(/\s+/).includes(className)) return false;
      for (const match of current.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
        if (match[1] === "disabled") { if (!this.disabled) return false; continue; }
        const actual = this.attributes[match[1]];
        if (actual === undefined || match[2] !== undefined && actual !== match[2]) return false;
      }
      return true;
    }
    querySelectorAll(selector) {
      const selectors = selector.split(","); const found = [];
      function visit(element) { for (const child of element.children) { if (selectors.some((item) => child.matches(item))) found.push(child); visit(child); } }
      visit(this); return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    async emit(type, extras = {}) { if (this.disabled && ["click", "change"].includes(type)) return; const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...extras }; for (const listener of this.listeners[type] || []) await listener(event); }
    focus() { document.activeElement = this; }
    getClientRects() { return this.parentElement ? [{}] : []; }
  }
  document = { createElement: (tag) => new Element(tag), activeElement: null, body: new Element("body") };
  document.querySelector = (selector) => document.body.querySelector(selector); document.querySelectorAll = (selector) => document.body.querySelectorAll(selector);
  const focus = new Element("button"); document.body.append(focus); focus.focus();
  return document;
}

function fixtureEvents() {
  return [8, 12, 16].map((hour, index) => ({ id: `event-${index}`, name: `Evento ${index}`, place: "Sede sintética", date: "2026-11-25", setupApplies: true,
    setupAt: `2026-11-25T${String(hour).padStart(2, "0")}:00`, startAt: `2026-11-25T${String(hour).padStart(2, "0")}:00`, endAt: `2026-11-25T${String(hour + 1).padStart(2, "0")}:00`, equipmentInAt: "2026-11-26T12:00",
    sections: [{ id: `section-${index}`, title: "Pruebas", notes: ["  Nota literal  "], items: [{ id: `line-${index}`, warehouseInventoryId: "synthetic-unit", description: "Unidad sintética", quantity: 3 }] }] }));
}
function fixtureInventory(quantity = 3) { return { savedAt: "synthetic-current", state: { items: [{ id: "synthetic-unit", name: "Unidad sintética", category: "Pruebas", itemType: "equipo", quantity }], movements: [] } }; }
const routeEstimates = [{ fromPlace: "Sede sintética", toPlace: "Sede sintética", travelMinutes: 0, handlingMinutes: 120 }];
function response(plan, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => copy(plan) }; }
function harness(settings = {}) {
  const document = documentHarness(); const calls = [], responses = [], updates = [], notices = [], statuses = [];
  let events = copy(settings.events || fixtureEvents()), stock = fixtureInventory(settings.quantity ?? 3), permission = true;
  let baseEstimates = settings.estimates === undefined ? copy(routeEstimates) : copy(settings.estimates);
  const state = { document, calls, responses, updates, notices, statuses, setEvents: (value) => { events = copy(value); }, events: () => copy(events),
    setStock: (value) => { stock = copy(value); }, stock: () => copy(stock), setPermission: (value) => { permission = value; } };
  const bridge = { events: () => events, inventory: () => stock, range: () => ({ from: "2026-11-23", to: "2026-11-29" }), transferOptions: () => ({ routeEstimates: baseEstimates }),
    updateEventDetails(patches) { updates.push(copy(patches)); for (const patch of patches) { const event = events.find((entry) => entry.id === patch.id); if (event) Object.assign(event, patch); } } };
  state.planFor = (call) => Draft.analyze(call.body.events, stock, { now: Date.parse("2026-11-23T12:00:00Z"), routeEstimates: call.body.routeEstimates, selectedTransferIds: call.body.selectedTransferIds, transferEdits: call.body.transferEdits, splitAuthorizedOrigins: call.body.splitAuthorizedOrigins });
  const context = vm.createContext({ console, Intl, Date, Set, Map, document, EquipmentLocation: require("../../equipment-location.js"), EquipmentDraftSubstitutions: require("../../equipment-draft-substitutions.js"), window: { LIVE_SESSION: { id: "synthetic" }, LiveAccess: { can: () => permission } } });
  vm.runInContext(source(), context);
  state.api = context.EquipmentDraftTransfers.create({ document, bridge, fetch: async (url, init) => {
    const call = { url, init, body: JSON.parse(init.body) }; calls.push(call);
    if (responses.length) { const next = responses.shift(); return typeof next === "function" ? next(call) : next; }
    return response(state.planFor(call));
  }, onChange: (result) => { notices.push(result); settings.onChange?.(state, result); }, onStatus: (message) => statuses.push(message) });
  state.modal = () => document.querySelector(".equipment-draft-overlay");
  state.get = (selector) => state.modal()?.querySelector(selector);
  state.click = async (selector) => { const element = state.get(selector); assert.ok(element, selector); await element.emit("click"); await flush(); };
  state.apply = async () => { await state.click("[data-draft-apply]"); if (state.get("[data-draft-confirm-accept]")) await state.click("[data-draft-confirm-accept]"); };
  state.toggle = async (index, checked) => { const element = state.get(`[data-draft-route="${index}"]`); assert.ok(element); element.checked = checked; await element.emit("change"); await flush(); };
  return state;
}

module.exports = { harness, documentHarness, fixtureEvents, fixtureInventory, response, deferred, flush, copy };
