"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Draft = require("../equipment-draft-logistics.js");

const source = () => fs.readFileSync(require.resolve("../equipment-draft-transfers.js"), "utf8");
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
  state.planFor = (call) => Draft.analyze(call.body.events, stock, { now: Date.parse("2026-11-23T12:00:00Z"), routeEstimates: call.body.routeEstimates, selectedTransferIds: call.body.selectedTransferIds });
  const context = vm.createContext({ console, Intl, Date, Set, Map, document, window: { LIVE_SESSION: { id: "synthetic" }, LiveAccess: { can: () => permission } } });
  vm.runInContext(source(), context);
  state.api = context.EquipmentDraftTransfers.create({ document, bridge, fetch: async (url, init) => {
    const call = { url, init, body: JSON.parse(init.body) }; calls.push(call);
    if (responses.length) { const next = responses.shift(); return typeof next === "function" ? next(call) : next; }
    return response(state.planFor(call));
  }, onChange: (result) => { notices.push(result); settings.onChange?.(state, result); }, onStatus: (message) => statuses.push(message) });
  state.modal = () => document.querySelector(".equipment-draft-overlay");
  state.get = (selector) => state.modal()?.querySelector(selector);
  state.click = async (selector) => { const element = state.get(selector); assert.ok(element, selector); await element.emit("click"); await flush(); };
  state.toggle = async (index, checked) => { const element = state.get(`[data-draft-route="${index}"]`); assert.ok(element); element.checked = checked; await element.emit("change"); await flush(); };
  return state;
}

test("el modal usa el endpoint único en mode plan y sólo marca propuestas listas la primera vez", async () => {
  const h = harness(); await h.api.show();
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every((call) => call.url === "/api/cuadros-equipo/reportes/provisional" && call.init.method === "POST" && call.body.mode === "plan" && call.body.format === "json"));
  assert.ok(h.calls.every((call) => call.init.credentials === "same-origin"));
  const checkboxes = h.modal().querySelectorAll("[data-draft-route]"); assert.equal(checkboxes.length, 2); assert.ok(checkboxes.every((input) => input.checked && !input.disabled));
  assert.equal(h.calls[1].body.selectedTransferIds.length, 2); assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.updates.length, 0);
});

test("desmarcar recalcula renta y aplicar conserva únicamente esa selección", async () => {
  const h = harness(); const beforeStock = JSON.stringify(h.stock()); await h.api.show(); await h.toggle(0, false);
  assert.equal(h.calls.at(-1).body.selectedTransferIds.length, 1); assert.match(h.get("[data-draft-routes]").textContent, /3 ×.*Unidad sintética/);
  await h.click("[data-draft-apply]");
  assert.equal(h.api.isOpen(), false); assert.equal(h.api.selection().selectedTransferIds.length, 1); assert.equal(h.updates.length, 1);
  assert.equal(h.api.requestOptions().selectedTransferIds.length, 1); assert.equal(h.api.result().rows[0].rental, 3);
  assert.equal(JSON.stringify(h.stock()), beforeStock); assert.ok(h.calls.every((call) => call.body.mode === "plan"));
});

test("quitar todos y aplicar mantiene selección vacía al volver a abrir", async () => {
  const h = harness(); await h.api.show(); await h.click("[data-draft-select-none]"); await h.click("[data-draft-apply]");
  assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.api.result().rows[0].rental, 6);
  const callCount = h.calls.length; await h.api.show();
  assert.equal(h.calls.length, callCount + 1); assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => !input.checked));
});

test("cancelar descarta horarios y selección temporales sin modificar los cuadros ni el inventario", async () => {
  const h = harness(); const beforeEvents = JSON.stringify(h.events()), beforeStock = JSON.stringify(h.stock()); await h.api.show();
  h.get('[data-draft-event="0"][data-draft-field="place"]').value = "Otro lugar temporal";
  h.get('[data-draft-event="0"][data-draft-field="endAt"]').value = "2026-11-25T10:30";
  await h.click("[data-draft-recalculate]"); await h.click("[data-draft-close]");
  assert.equal(h.api.isOpen(), false); assert.equal(h.updates.length, 0); assert.equal(h.api.selection().selectedTransferIds.length, 0);
  assert.equal(JSON.stringify(h.events()), beforeEvents); assert.equal(JSON.stringify(h.stock()), beforeStock);
});

test("los minutos estimados se muestran deshabilitados y confirmar un par habilita una propuesta revisada", async () => {
  const h = harness({ estimates: [] }); await h.api.show();
  assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => !input.checked && input.disabled));
  await h.click('[data-draft-confirm-time="0"]');
  assert.equal(h.calls.at(-1).body.routeEstimates.length, 1); assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => !input.disabled));
  await h.toggle(0, true); assert.equal(h.calls.at(-1).body.selectedTransferIds.length, 1);
});

test("un campo de minutos vacío no se interpreta como cero ni envía una validación", async () => {
  const h = harness({ estimates: [] }); await h.api.show(); const count = h.calls.length;
  h.get('[data-draft-handling="0"]').value = ""; await h.click('[data-draft-confirm-time="0"]');
  assert.equal(h.calls.length, count); assert.match(h.get("[data-draft-status]").textContent, /minutos enteros/);
  assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => input.disabled));
});

test("un error de red en refresh no produce un bucle de reintentos durante render", async () => {
  const h = harness({ onChange: (state) => { void state.api.refresh(); } });
  h.responses.push(response({ error: "Fallo temporal" }, 503)); await h.api.refresh(); await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.api.result(), null); assert.match(h.statuses.at(-1), /Fallo temporal/);
  await h.api.refresh(); await flush(); assert.equal(h.calls.length, 1);
  await h.api.refresh({ force: true }); assert.equal(h.calls.length, 2); assert.ok(h.api.result());
});

test("un error del modal conserva el borrador y no aplica ni reintenta al dibujar", async () => {
  const h = harness(); h.responses.push(response({ error: "No disponible" }, 503)); await h.api.show(); await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.get("[data-draft-apply]").disabled, true); assert.match(h.get("[data-draft-status]").textContent, /No disponible/);
  assert.equal(h.updates.length, 0); assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.api.isOpen(), true);
});

test("un cambio del inventario invalida el resultado cacheado y recalcula contra el estado actual", async () => {
  const h = harness(); await h.api.show(); await h.click("[data-draft-apply]"); assert.equal(h.api.result().rows[0].rental, 0);
  h.setStock(fixtureInventory(2)); assert.equal(h.api.result(), null); await h.api.refresh();
  assert.ok(h.api.result().invalidSelections.length > 0); assert.equal(h.api.result().rows[0].rental, null); assert.equal(h.updates.length, 1);
});

test("un permiso denegado no envía cálculo ni muestra una renta reducida", async () => {
  const h = harness(); h.setPermission(false); await h.api.refresh(); await h.api.show();
  assert.equal(h.calls.length, 0); assert.equal(h.api.result(), null); assert.equal(h.api.isOpen(), false);
  assert.equal(h.get("[data-draft-apply]"), undefined); assert.equal(h.updates.length, 0);
  assert.match(h.statuses.at(-1), /permiso/);
});

test("revocar permiso oculta inmediatamente el plan que antes tenía renta reducida", async () => {
  const h = harness(); await h.api.show(); await h.click("[data-draft-apply]"); assert.equal(h.api.result().rows[0].rental, 0);
  h.setPermission(false); assert.equal(h.api.result(), null);
  await h.api.refresh(); assert.equal(h.api.result(), null); assert.equal(h.notices.at(-1), null);
});

test("un 403 del servidor deja el pedido sin aplicar y conserva sus eventos", async () => {
  const h = harness(); const before = JSON.stringify(h.events()); h.responses.push(response({ error: "Sesión sin permiso" }, 403)); await h.api.show();
  assert.equal(h.calls.length, 1); assert.equal(h.api.result(), null); assert.equal(h.get("[data-draft-apply]").disabled, true);
  assert.equal(JSON.stringify(h.events()), before); assert.match(h.get("[data-draft-status]").textContent, /sin permiso/);
});

test("una respuesta incompleta no se acepta como pedido sin faltantes", async () => {
  const h = harness(); h.responses.push(response({ rows: [] })); await h.api.show();
  assert.equal(h.api.result(), null); assert.equal(h.updates.length, 0); assert.equal(h.get("[data-draft-apply]").disabled, true);
  assert.match(h.get("[data-draft-status]").textContent, /plan válido/);
});

test("una respuesta antigua de refresh no reemplaza la petición más reciente", async () => {
  const h = harness(); const a = deferred(), b = deferred(); h.responses.push(a.promise, b.promise);
  const first = h.api.refresh({ force: true });
  const modified = h.events(); modified[0].sections[0].items[0].quantity = 1; h.setEvents(modified);
  const second = h.api.refresh({ force: true });
  b.resolve(response(h.planFor(h.calls[1]))); await second; const expected = h.api.result().rows[0].demand;
  a.resolve(response(h.planFor(h.calls[0]))); await first;
  assert.equal(expected, 7); assert.equal(h.api.result().rows[0].demand, 7);
});

test("revocar permiso durante refresh invalida la respuesta pendiente y su cobertura anterior", async () => {
  const h = harness(); const gate = deferred(); h.responses.push(gate.promise); const request = h.api.refresh({ force: true });
  h.setPermission(false); await h.api.refresh(); gate.resolve(response(h.planFor(h.calls[0]))); await request;
  assert.equal(h.api.result(), null); assert.ok(h.notices.every((result) => result === null));
});

test("cerrar durante Aplicar impide que una respuesta anterior modifique o cierre el modal nuevo", async () => {
  const h = harness(); await h.api.show(); const gate = deferred(); h.responses.push(gate.promise);
  const applying = h.get("[data-draft-apply]").emit("click"); await flush(); const applyCall = h.calls.at(-1);
  h.api.close(); await h.api.show(); const newerModal = h.modal();
  gate.resolve(response(h.planFor(applyCall))); await applying; await flush();
  assert.equal(h.updates.length, 0); assert.equal(h.api.isOpen(), true); assert.equal(h.modal(), newerModal); assert.equal(h.api.selection().selectedTransferIds.length, 0);
});

test("cerrar durante el primer cálculo no dispara una segunda consulta para un modal descartado", async () => {
  const h = harness(); const gate = deferred(); h.responses.push(gate.promise); const showing = h.api.show(); await flush();
  h.api.close(); gate.resolve(response(h.planFor(h.calls[0]))); await showing; await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.api.isOpen(), false); assert.equal(h.updates.length, 0);
});

test("un cálculo del modal descartado no altera los checks de un modal nuevo con otros datos", async () => {
  const h = harness(); const gate = deferred(); h.responses.push(gate.promise); const oldOpening = h.api.show(); await flush();
  const oldCall = h.calls[0]; h.api.close(); const modified = h.events(); modified[0].sections[0].items[0].quantity = 2; h.setEvents(modified);
  await h.api.show(); const currentModal = h.modal(); await h.toggle(0, false);
  const before = h.modal().querySelectorAll("[data-draft-route]").map((input) => input.checked); const calls = h.calls.length;
  gate.resolve(response(h.planFor(oldCall))); await oldOpening; await flush();
  assert.equal(h.calls.length, calls); assert.equal(h.modal(), currentModal);
  assert.deepEqual(h.modal().querySelectorAll("[data-draft-route]").map((input) => input.checked), before);
  await h.click("[data-draft-apply]"); assert.equal(h.updates.length, 1); assert.equal(h.api.isOpen(), false); assert.equal(h.api.result().invalidSelections.length, 0);
});

test("descripciones, lugares y errores maliciosos se muestran como texto escapado", async () => {
  const bad = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const events = fixtureEvents(); for (const event of events) { event.place = bad; event.sections[0].items[0].description = bad; }
  const h = harness({ events, estimates: [{ fromPlace: bad, toPlace: bad, travelMinutes: 0, handlingMinutes: 120 }] });
  const stock = h.stock(); stock.state.items[0].name = bad; h.setStock(stock); await h.api.show();
  assert.equal(h.modal().querySelectorAll("img,script").length, 0); assert.match(h.get("[data-draft-routes]").innerHTML, /&lt;img/);
  assert.match(h.modal().textContent, /<img src=x onerror="alert\(1\)">/);
  h.responses.push(response({ error: bad }, 503)); await h.click("[data-draft-recalculate]");
  assert.equal(h.get("[data-draft-status]").textContent, bad); assert.equal(h.modal().querySelectorAll("img,script").length, 0);
});

test("Escape cierra y devuelve el foco sin guardar ningún cambio", async () => {
  const h = harness(); const priorFocus = h.document.activeElement; await h.api.show();
  await h.modal().emit("keydown", { key: "Escape" }); assert.equal(h.api.isOpen(), false); assert.equal(h.document.activeElement, priorFocus); assert.equal(h.updates.length, 0);
});
