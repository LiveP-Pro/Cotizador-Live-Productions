const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createHarness(fetchImplementation) {
  let nextId = 0;
  const requests = [];
  const timers = new Map();
  const field = (value = "") => ({ value, textContent: "", innerHTML: "", disabled: false, dataset: {}, focus() {} });
  const fields = {
    status: field(), movementItem: field("synthetic-item"), movementType: field("ingreso"), movementQuantity: field("2"),
    movementDateTime: field("2026-10-08T10:30"), movementResponsible: field("Responsable sintético"),
    movementReason: field("Compra de prueba"), movementRelated: field(), movementRelatedLabel: field(), movementHelp: field(),
    movementMessage: field(), movementSaveButton: field(), historyList: field(), historySearch: field(), historyType: field("all"),
    historyCount: field(), historyPage: field(), historyPrevious: field(), historyNext: field()
  };
  fields.movementForm = { querySelectorAll() { return [fields.movementItem, fields.movementType, fields.movementQuantity,
    fields.movementDateTime, fields.movementResponsible, fields.movementReason, fields.movementRelated]; } };
  const context = {
    window: {
      location: { protocol: "https:", hash: "#contabilidad-equipo" },
      crypto: { randomUUID() { return String(++nextId); } },
      localStorage: { setItem() {} },
      setTimeout(callback) { const id = ++nextId; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); }, requestAnimationFrame(callback) { callback(); }
    },
    document: { readyState: "loading", addEventListener() {}, dispatchEvent() {}, querySelector() { return null; } },
    CustomEvent: class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    async fetch(url, options) {
      requests.push({ url, options, body: JSON.parse(options.body) });
      if (fetchImplementation) return fetchImplementation(requests.at(-1), requests.length);
      return { ok: true, status: 200, async json() { return { savedAt: `server-${requests.length}`, state: {
        ...requests.at(-1).body.state, auditEntries: [{ id: "server-audit", timestamp: "2026-10-08T16:30:00Z", action: "ingreso",
          description: "Equipo sintético", previousQuantity: 10, newQuantity: 12, actor: { name: "Usuario autenticado" } }],
        equipmentStockReceipts: []
      } }; } };
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  const instrumentation = `
    window.__movementHarness = {
      initialize(fields) {
        Object.assign(elements, fields);
        state = normalizeState({ items: [{ id: "synthetic-item", name: "Equipo sintético", category: "PRUEBA", quantity: 10 }], movements: [], auditEntries: [], equipmentStockReceipts: [] });
        warehouseReady = true;
        serverSavedAt = "server-0";
        renderAll = publishWarehouseAvailability;
      },
      apply(payload) { const result = applyManualWarehouseMovement(payload); scheduleSave(); return result; },
      snapshot() { return JSON.parse(JSON.stringify({ state, warehouseDirty, manualMovementPendingSave })); },
      physical() { return statsForItem(state.items[0]); },
      setAudit(entries) { state.auditEntries = entries; },
      nextPage() { historyPage += 1; renderWarehouseHistory(); },
      normalizeState, renderWarehouseHistory, registerManualMovement
    };
  `;
  vm.runInContext(source.replace('  if (document.readyState === "loading") {', instrumentation + '  if (document.readyState === "loading") {'), context);
  context.window.__movementHarness.initialize(fields);
  return {
    fields, context, requests, timers,
    apply(payload) { return context.window.__movementHarness.apply({ itemId: "synthetic-item", quantity: 1,
      responsible: "Responsable sintético", reason: "Motivo de prueba", dateTime: "2026-10-08T10:30", ...payload }); },
    snapshot() { return context.window.__movementHarness.snapshot(); },
    physical() { return context.window.__movementHarness.physical(); },
    flush() { return context.window.flushWarehouseInventoryChanges(); },
    register() { return context.window.__movementHarness.registerManualMovement({ preventDefault() {} }); }
  };
}

test("receipts, losses and final write-offs update stock once, including equipment already outside", () => {
  const harness = createHarness();
  harness.apply({ type: "ingreso", quantity: 6 });
  assert.equal(harness.snapshot().state.items[0].quantity, 16);
  assert.equal(harness.physical().physical, 16);
  assert.equal(harness.snapshot().state.movements[0].previousQuantity, 10);
  assert.equal(harness.snapshot().state.movements[0].newQuantity, 16);
  harness.apply({ type: "salida", quantity: 4 });
  const outgoingId = harness.snapshot().state.movements.at(-1).id;
  harness.apply({ type: "taller", quantity: 3 });
  const workshopId = harness.snapshot().state.movements.at(-1).id;
  assert.equal(harness.physical().physical, 9);
  harness.apply({ type: "perdido", quantity: 2, relatedMovementId: outgoingId });
  const lostId = harness.snapshot().state.movements.at(-1).id;
  assert.equal(harness.physical().physical, 9);
  assert.equal(harness.physical().out, 2);
  assert.equal(harness.physical().lost, 2);
  harness.apply({ type: "baja", quantity: 1, relatedMovementId: lostId });
  assert.equal(harness.snapshot().state.items[0].quantity, 15);
  assert.equal(harness.physical().lost, 1);
  assert.equal(harness.physical().physical, 9);
  harness.apply({ type: "baja", quantity: 2 });
  assert.equal(harness.snapshot().state.items[0].quantity, 13);
  assert.equal(harness.physical().physical, 7);
  harness.apply({ type: "devolucion_taller", quantity: 1, relatedMovementId: workshopId });
  assert.equal(harness.physical().physical, 8);
  const beforeRejected = harness.snapshot().state.movements.length;
  assert.throws(() => harness.apply({ type: "devolucion_taller", quantity: 3, relatedMovementId: workshopId }), /Solo quedan 2/);
  assert.equal(harness.snapshot().state.movements.length, beforeRejected);
  harness.apply({ type: "recuperado", quantity: 1, relatedMovementId: lostId });
  assert.equal(harness.physical().physical, 9);
  assert.equal(harness.snapshot().state.items[0].quantity, 13);
});

test("unavailable or incomplete movements are rejected before stock changes", () => {
  const harness = createHarness();
  assert.throws(() => harness.apply({ type: "salida", quantity: 11 }), /Solo hay 10/);
  assert.throws(() => harness.apply({ type: "baja", quantity: 11 }), /Solo hay 10/);
  assert.throws(() => harness.apply({ type: "ingreso_evento", quantity: 1 }), /movimiento pendiente/);
  assert.throws(() => harness.apply({ type: "ingreso", quantity: 1.2 }), /entero/);
  assert.throws(() => harness.apply({ type: "ingreso", responsible: "" }), /responsable y motivo/);
  assert.equal(harness.snapshot().state.items[0].quantity, 10);
  assert.equal(harness.snapshot().state.movements.length, 0);
});

test("authoritative audit and receipt records survive normalization with zero values", () => {
  const harness = createHarness();
  const input = { items: [], movements: [], auditEntries: [{ id: "a", action: "ingreso", previousQuantity: 0,
    newQuantity: 0, before: { quantity: 0 }, after: { quantity: 0 }, actor: { id: 3, name: "Persona" } }],
    equipmentStockReceipts: [{ requestId: "r", items: [{ quantity: 0, previousQuantity: 0, newQuantity: 0 }] }] };
  const normalized = harness.context.window.__movementHarness.normalizeState(input);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.auditEntries)), input.auditEntries);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized.equipmentStockReceipts)), input.equipmentStockReceipts);
});

test("read-only history paginates all entries, escapes text and searches user names", () => {
  const harness = createHarness();
  harness.context.window.__movementHarness.setAudit(Array.from({ length: 125 }, (_, index) => ({
    id: String(index), action: index === 124 ? "baja" : "ingreso", timestamp: "2026-10-08T16:30:00Z",
    description: index === 124 ? "<img src=x>" : `Equipo ${index}`, actor: { name: `Persona ${index}` },
    previousQuantity: 0, newQuantity: 2, quantity: 2, before: { quantity: 0 }, after: { quantity: 2 }
  })));
  harness.context.window.__movementHarness.renderWarehouseHistory();
  assert.match(harness.fields.historyCount.textContent, /125 registros/);
  assert.equal((harness.fields.historyList.innerHTML.match(/<article /g) || []).length, 50);
  assert.doesNotMatch(harness.fields.historyList.innerHTML, /data-delete|Eliminar|<button/);
  harness.context.window.__movementHarness.nextPage();
  harness.context.window.__movementHarness.nextPage();
  assert.equal((harness.fields.historyList.innerHTML.match(/<article /g) || []).length, 25);
  assert.match(harness.fields.historyList.innerHTML, /&lt;img src=x&gt;/);
  harness.fields.historySearch.value = "Persona 124";
  harness.context.window.__movementHarness.renderWarehouseHistory();
  assert.match(harness.fields.historyCount.textContent, /1 registros/);
  assert.match(harness.fields.historyList.innerHTML, /Inventario: 0 → 2/);
});

test("flush waits for authoritative save and merges audit acknowledgments", async () => {
  const harness = createHarness();
  harness.apply({ type: "ingreso", quantity: 2 });
  assert.match(harness.fields.status.textContent, /Guardando/);
  const ack = await harness.flush();
  assert.equal(ack.savedAt, "server-1");
  assert.equal(harness.requests[0].body.expectedSavedAt, "server-0");
  assert.equal(harness.requests[0].body.state.items[0].quantity, 12);
  assert.equal(harness.snapshot().warehouseDirty, false);
  assert.equal(harness.snapshot().state.auditEntries[0].id, "server-audit");
  assert.match(harness.fields.status.textContent, /guardados en servidor/);
});

test("a conflict leaves local edits pending without claiming success or retrying a second application", async () => {
  let conflict = true;
  const harness = createHarness(async (request) => ({ ok: !conflict, status: conflict ? 409 : 200,
    async json() { return conflict ? { error: "Conflicto de prueba" } : { state: { ...request.body.state, auditEntries: [] }, savedAt: "server-1" }; } }));
  await harness.register();
  assert.equal(harness.snapshot().state.items[0].quantity, 12);
  assert.equal(harness.snapshot().warehouseDirty, true);
  assert.equal(harness.snapshot().manualMovementPendingSave, true);
  assert.match(harness.fields.status.textContent, /Conflicto de prueba/);
  assert.equal(harness.fields.status.dataset.tone, "warning");
  assert.match(harness.fields.movementSaveButton.textContent, /Reintentar/);
  conflict = false;
  await harness.register();
  assert.equal(harness.snapshot().state.items[0].quantity, 12);
  assert.equal(harness.snapshot().state.movements.length, 1);
  assert.equal(harness.snapshot().manualMovementPendingSave, false);
  assert.equal(harness.snapshot().warehouseDirty, false);
});

test("flush drains edits made during an in-flight save without replacing newer stock", async () => {
  let releaseFirst;
  let signalFirst;
  const firstStarted = new Promise((resolve) => { signalFirst = resolve; });
  const harness = createHarness(async (request, count) => {
    if (count === 1) {
      signalFirst();
      await new Promise((resolve) => { releaseFirst = resolve; });
    }
    return { ok: true, status: 200, async json() { return { state: request.body.state, savedAt: `server-${count}` }; } };
  });
  harness.apply({ type: "ingreso", quantity: 2 });
  const saving = harness.flush();
  await firstStarted;
  harness.apply({ type: "ingreso", quantity: 3 });
  releaseFirst();
  const ack = await saving;
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[0].body.state.items[0].quantity, 12);
  assert.equal(harness.requests[1].body.state.items[0].quantity, 15);
  assert.equal(harness.requests[1].body.expectedSavedAt, "server-1");
  assert.equal(harness.snapshot().state.items[0].quantity, 15);
  assert.equal(harness.snapshot().warehouseDirty, false);
  assert.equal(ack.savedAt, "server-2");
});

test("Movimientos markup has distinct form and read-only history controls", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "warehouse-module.html"), "utf8");
  assert.match(html, /data-warehouse-window="movements">Movimientos/);
  assert.match(html, /data-warehouse-view="movements"/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of ["warehouseMovementForm", "warehouseMovementRelated", "warehouseHistoryList", "warehouseHistoryPrevious", "warehouseHistoryNext"])
    assert.ok(ids.includes(id));
});
