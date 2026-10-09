const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { applyStockIngress, prepareWarehouseSave } = require("../warehouse-ledger.cjs");

const clone = (value) => JSON.parse(JSON.stringify(value));
const evaluate = (context, code) => vm.runInContext(code, context);
const endpoint = "/api/inventario-bodega/ingresos-desde-equipo";

function input(value) {
  const classes = new Set();
  return {
    value: String(value), dataset: {}, textContent: "", focus() {}, setAttribute() {}, addEventListener() {},
    classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); }, toggle(name, on) { on ? classes.add(name) : classes.delete(name); } }
  };
}

function createLedger() {
  return {
    state: { savedAt: "2026-10-08T08:00:00.000Z", state: { updatedAt: "2026-10-08T08:00:00.000Z", items: [], movements: [], auditEntries: [], equipmentStockReceipts: [] } },
    calls: [], failBeforeOnce: false, loseResponseOnce: false, incompleteReceiptOnce: false,
    async fetch(url, options = {}) {
      if (url === "/api/inventario-bodega" && (!options.method || options.method === "GET")) return { ok: true, status: 200, json: async () => clone(this.state) };
      if (url !== endpoint || options.method !== "POST") return { ok: false, status: 404, json: async () => ({ error: "Ruta sintética sin respuesta." }) };
      const request = JSON.parse(options.body);
      this.calls.push({ request: clone(request), credentials: options.credentials, headers: options.headers });
      if (this.failBeforeOnce) {
        this.failBeforeOnce = false;
        return { ok: false, status: 503, json: async () => ({ error: "Fallo sintético antes de registrar." }) };
      }
      const result = applyStockIngress(this.state, request, { actor: { user: "Usuario sintético" }, timestamp: "2026-10-08T08:01:00.000Z" });
      if (!result.duplicate) this.state = prepareWarehouseSave(this.state, result.state, {
        actor: { user: "Usuario sintético" }, source: "requerimiento-equipo", requestId: request.requestId,
        event: request.event, stockReceipt: result.storedReceipt, ingressChanges: result.changes
      }, Date.parse(this.state.savedAt) + 1000);
      if (this.loseResponseOnce) {
        this.loseResponseOnce = false;
        throw new Error("La respuesta sintética se perdió después del registro.");
      }
      if (this.incompleteReceiptOnce) {
        this.incompleteReceiptOnce = false;
        return { ok: true, status: 200, json: async () => ({ ...clone(this.state), receipt: { ...clone(result.receipt), items: [] } }) };
      }
      return { ok: true, status: 200, json: async () => ({ ...clone(this.state), receipt: clone(result.receipt) }) };
    }
  };
}

function createContext(ledger = createLedger()) {
  const fields = new Map([
    ["#equipmentEventName", input("Evento sintético")], ["#equipmentEventPlace", input("Lugar sintético")],
    ["#equipmentEventDate", input("2026-10-08")], ["#equipmentEventSetupAt", input("2026-10-08T08:00")],
    ["#equipmentEventInAt", input("2026-10-08T22:00")], ["#equipmentEventResponsible", input("Responsable sintético")],
    ["#equipmentSaveStatus", input("")], ["#equipmentNotes", input("")]
  ]);
  const context = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    window: {
      requerimientoEquipoCatalog: { services: {}, groups: [] }, requerimientoEquipoInventory: { categories: [] },
      location: { origin: "https://synthetic.invalid" }, addEventListener() {}, setTimeout, setInterval,
      requestAnimationFrame(callback) { callback(); }
    },
    document: { querySelector(selector) { return fields.get(selector) || null; }, querySelectorAll() { return []; },
      addEventListener() {}, dispatchEvent(event) { context.dispatchedEvents.push(event); } },
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    dispatchedEvents: [], setTimeout, setInterval, clearInterval, fetch: ledger.fetch.bind(ledger)
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context, { filename: "equipment.js" });
  context.syntheticInventory = clone(ledger.state);
  evaluate(context, `
    equipmentServices.synthetic = { name: "Servicio sintético", mainSections: [], extras: [] };
    setEquipmentServiceSelection(["synthetic"]);
    applyEquipmentWarehouseInventoryPayload(syntheticInventory);
    renderEquipmentModule = () => {};
    let syntheticDecisions = [];
    requestEquipmentUnknownChoice = async () => syntheticDecisions.shift();
  `);
  return { context, ledger, fields };
}

function setBatch(context, rows, choices) {
  context.syntheticBatch = rows.map(([quantity, description]) => ({ quantityInput: input(quantity), descriptionInput: input(description) }));
  context.choicesForNextBatch = choices;
  evaluate(context, "syntheticDecisions = [...choicesForNextBatch]");
}

async function tryAdd(context) {
  try { return await evaluate(context, "addEquipmentExtraBatch(syntheticBatch)"); }
  catch (error) { return { error: error.message }; }
}

function currentItems(context) {
  return clone(evaluate(context, "equipmentState.manualMainSections.flatMap((section) => section.items)"));
}

test("new Save popup registers the current quantity in warehouse and persists its receipt before append", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[3, "Equipo sintético guardado"]], ["save"]);
  assert.equal(await tryAdd(context), true);
  assert.equal(ledger.calls.length, 1);
  assert.equal(ledger.calls[0].request.items[0].quantity, 3);
  assert.equal(ledger.calls[0].request.items[0].description, "Equipo sintético guardado");
  assert.equal(ledger.calls[0].request.event.name, "Evento sintético");
  assert.equal(ledger.calls[0].request.event.date, "2026-10-08");
  assert.equal(ledger.calls[0].credentials, "same-origin");
  assert.equal(ledger.state.state.items[0].quantity, 3);
  assert.equal(ledger.state.state.auditEntries.length, 1);
  assert.equal(ledger.state.state.equipmentStockReceipts.length, 1);
  const [item] = currentItems(context);
  assert.equal(item.warehouseInventoryId, ledger.state.state.items[0].id);
  assert.equal(item.inventoryIngressReceipts.length, 1);
  assert.deepEqual(item.inventoryIngressReceipts[0], {
    requestId: ledger.calls[0].request.requestId, itemId: item.warehouseInventoryId, quantity: 3, index: 0
  });
  assert.equal(evaluate(context, "equipmentPendingProcurementChoice(equipmentState.manualMainSections[0].items[0])"), "");
  assert.equal(evaluate(context, "equipmentProcurementReportRows('rent').length"), 0);
});

test("rent and purchase selections never register warehouse stock", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[2, "Equipo sintético rentado"], [4, "Equipo sintético a comprar"]], ["rent", "purchase"]);
  assert.equal(await tryAdd(context), true);
  assert.equal(ledger.calls.length, 0);
  assert.deepEqual(ledger.state.state.items, []);
  assert.deepEqual(currentItems(context).map((item) => item.procurementChoice), ["rent", "purchase"]);
  assert.equal(context.dispatchedEvents.filter((event) => event.type === "live:warehouse-purchase-request").length, 1);
});

test("canceling the batch after selecting Save creates neither stock nor audit nor extra", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[2, "Equipo sintético A"], [3, "Equipo sintético B"]], ["save", null]);
  assert.equal(await tryAdd(context), false);
  assert.equal(ledger.calls.length, 0);
  assert.deepEqual(ledger.state.state.items, []);
  assert.deepEqual(ledger.state.state.auditEntries, []);
  assert.deepEqual(currentItems(context), []);
});

test("warehouse failure keeps the pending request and entered values for an exact retry", async () => {
  const { context, ledger } = createContext();
  ledger.failBeforeOnce = true;
  setBatch(context, [[3, "Equipo sintético reintentable"]], ["save"]);
  assert.notEqual(await tryAdd(context), true);
  assert.deepEqual(currentItems(context), []);
  assert.deepEqual(ledger.state.state.items, []);
  const pending = clone(evaluate(context, "equipmentState.pendingStockIngressRequest"));
  assert.equal(pending.requestId, ledger.calls[0].request.requestId);
  assert.equal(context.syntheticBatch[0].quantityInput.value, "3");
  assert.equal(context.syntheticBatch[0].descriptionInput.value, "Equipo sintético reintentable");
  assert.equal(await tryAdd(context), true);
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.calls[1].request, ledger.calls[0].request);
  assert.equal(ledger.state.state.items[0].quantity, 3);
  assert.equal(currentItems(context)[0].quantity, 3);
});

test("lost response after commit retries with the same request ID and adds warehouse stock only once", async () => {
  const { context, ledger } = createContext();
  ledger.loseResponseOnce = true;
  setBatch(context, [[4, "Equipo sintético respuesta perdida"]], ["save"]);
  assert.notEqual(await tryAdd(context), true);
  assert.equal(ledger.state.state.items[0].quantity, 4);
  assert.deepEqual(currentItems(context), []);
  assert.equal(await tryAdd(context), true);
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.calls[1].request, ledger.calls[0].request);
  assert.equal(ledger.state.state.items[0].quantity, 4);
  assert.equal(ledger.state.state.equipmentStockReceipts.length, 1);
  assert.equal(ledger.state.state.auditEntries.length, 1);
  assert.equal(currentItems(context).length, 1);
  assert.equal(currentItems(context)[0].inventoryIngressReceipts.length, 1);
});

test("same-name Save rows merge required quantities while retaining distinct ordered receipt entries", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[2, "Equipo sintético compartido"], [3, "Equipo sintético compartido"]], ["save", "save"]);
  assert.equal(await tryAdd(context), true);
  assert.equal(ledger.calls.length, 1);
  assert.equal(ledger.calls[0].request.items.length, 2);
  assert.equal(ledger.state.state.items.length, 1);
  assert.equal(ledger.state.state.items[0].quantity, 5);
  const [item] = currentItems(context);
  assert.equal(item.quantity, 5);
  assert.equal(item.inventoryIngressReceipts.length, 2);
  assert.deepEqual(item.inventoryIngressReceipts.map((entry) => ({ quantity: entry.quantity, index: entry.index })), [{ quantity: 2, index: 0 }, { quantity: 3, index: 1 }]);
  assert.equal(item.inventoryIngressReceipts[0].requestId, item.inventoryIngressReceipts[1].requestId);
});

test("an incomplete acknowledgement keeps the original request until every row is confirmed", async () => {
  const { context, ledger } = createContext();
  ledger.incompleteReceiptOnce = true;
  setBatch(context, [[2, "Equipo sintético A"], [3, "Equipo sintético B"]], ["save", "save"]);
  assert.notEqual(await tryAdd(context), true);
  assert.equal(ledger.state.state.items.length, 2);
  assert.deepEqual(currentItems(context), []);
  assert.equal(clone(evaluate(context, "equipmentState.pendingStockIngressRequest")).requestId, ledger.calls[0].request.requestId);
  assert.equal(await tryAdd(context), true);
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.calls[1].request, ledger.calls[0].request);
  assert.deepEqual(ledger.state.state.items.map((item) => item.quantity), [2, 3]);
  assert.equal(ledger.state.state.auditEntries.length, 2);
  assert.equal(ledger.state.state.equipmentStockReceipts.length, 1);
  assert.equal(currentItems(context).length, 2);
});

test("a second click while the first stock ingress awaits acknowledgement never adds a duplicate", { timeout: 2000 }, async () => {
  const { context, ledger } = createContext();
  let announcePosted;
  const posted = new Promise((resolve) => { announcePosted = resolve; });
  let releaseResponse;
  const release = new Promise((resolve) => { releaseResponse = resolve; });
  context.fetch = async (url, options) => {
    const response = await ledger.fetch(url, options);
    if (url === endpoint) { announcePosted(); await release; }
    return response;
  };
  setBatch(context, [[2, "Equipo sintético doble clic"]], ["save"]);
  const first = tryAdd(context);
  await posted;
  assert.equal(await tryAdd(context), false);
  assert.equal(ledger.calls.length, 1);
  assert.deepEqual(currentItems(context), []);
  releaseResponse();
  assert.equal(await first, true);
  assert.equal(currentItems(context).length, 1);
  assert.equal(ledger.state.state.items[0].quantity, 2);
  assert.equal(ledger.state.state.auditEntries.length, 1);
});

test("receipts survive all snapshots and JSON reopening; save and PDF never reenter merged quantities", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[2, "Equipo sintético persistido"], [3, "Equipo sintético persistido"]], ["save", "save"]);
  assert.equal(await tryAdd(context), true);
  const before = currentItems(context)[0];
  const originalCount = ledger.calls.length;
  const payload = clone(evaluate(context, "equipmentEditablePayload('full', { fileName: 'sintetico.pdf' })"));
  const copies = [payload.event.manualMainSections[0].items[0], payload.event.sections[0].items[0], payload.events[0].manualMainSections[0].items[0]];
  for (const copy of copies) {
    assert.deepEqual(copy.inventoryIngressReceipts, before.inventoryIngressReceipts);
    assert.equal(Object.hasOwn(copy, "stockIngressSourceId"), false);
  }
  context.syntheticReopenedPayload = payload;
  evaluate(context, "importEquipmentEditablePayload(syntheticReopenedPayload)");
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  await evaluate(context, "saveEquipmentPdf('full')");
  assert.equal(ledger.calls.length, originalCount);
  assert.equal(ledger.state.state.items[0].quantity, 5);
  assert.deepEqual(currentItems(context)[0].inventoryIngressReceipts, before.inventoryIngressReceipts);
});

test("legacy stored Save without a receipt never performs an automatic stock ingress", async () => {
  const { context, ledger } = createContext();
  evaluate(context, `
    equipmentState.manualExtras = [{ id: "synthetic-legacy", description: "Equipo sintético heredado", quantity: 6, procurementChoice: "save" }];
  `);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(ledger.calls.length, 0);
  assert.deepEqual(ledger.state.state.items, []);
  assert.equal(evaluate(context, "equipmentState.events[0].manualExtras[0].procurementChoice"), "save");
});

test("later requirement edits preserve the original receipt and never silently replenish warehouse stock", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[3, "Equipo sintético editable"]], ["save"]);
  assert.equal(await tryAdd(context), true);
  context.syntheticItemId = currentItems(context)[0].id;
  evaluate(context, 'updateEquipmentItem(syntheticItemId, "quantity", 7)');
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(ledger.calls.length, 1);
  assert.equal(ledger.state.state.items[0].quantity, 3);
  const item = clone(evaluate(context, "equipmentState.events[0].manualMainSections[0].items[0]"));
  assert.equal(item.quantity, 7);
  assert.equal(item.inventoryIngressReceipts[0].quantity, 3);
  assert.equal(evaluate(context, "equipmentProcurementReportRows('rent')[0].missing"), 4);
});

test("a saved extra with a receipt stays a stock shortage when its warehouse item is subsequently removed", async () => {
  const { context, ledger } = createContext();
  setBatch(context, [[3, "Equipo sintético retirado"]], ["save"]);
  assert.equal(await tryAdd(context), true);
  context.syntheticRemovedInventory = {
    savedAt: "2026-10-08T10:00:00.000Z",
    state: { updatedAt: "2026-10-08T10:00:00.000Z", items: [], movements: [] }
  };
  evaluate(context, "applyEquipmentWarehouseInventoryPayload(syntheticRemovedInventory)");
  assert.equal(evaluate(context, "equipmentPendingProcurementChoice(equipmentState.manualMainSections[0].items[0])"), "");
  assert.equal(evaluate(context, "equipmentProcurementReportRows('rent')[0].missing"), 3);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(ledger.calls.length, 1, "a removed warehouse item must never trigger a replay of the old ingress");
});

test("retrying after editing the name to another known item never attaches the old item's receipt", async () => {
  const ledger = createLedger();
  ledger.state.state.items = [{ id: "synthetic-other", name: "Otro equipo sintético existente", category: "Prueba", quantity: 6, itemType: "equipo" }];
  const { context } = createContext(ledger);
  ledger.loseResponseOnce = true;
  setBatch(context, [[4, "Equipo sintético original"]], ["save"]);
  assert.notEqual(await tryAdd(context), true);
  context.syntheticBatch[0].descriptionInput.value = "Otro equipo sintético existente";
  assert.equal(await tryAdd(context), true);
  const [item] = currentItems(context);
  assert.equal(item.warehouseInventoryId, "synthetic-other");
  assert.equal(item.inventoryIngressReceipts?.length || 0, 0, "a receipt for the original item cannot acknowledge a different inventory identity");
  assert.equal(ledger.state.state.items.find((entry) => entry.id === "synthetic-other").quantity, 6);
  assert.equal(ledger.state.state.items.find((entry) => entry.name === "Equipo sintético original").quantity, 4);
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.calls[1].request, ledger.calls[0].request);
});

test("a document extra saved after a lost acknowledgement keeps its receipt in the saved window and JSON", async () => {
  const { context, ledger } = createContext();
  ledger.loseResponseOnce = true;
  evaluate(context, `
    equipmentState.documentSections = [{ id: "synthetic-document", title: "Documento sintético", documentSection: true,
      items: [{ id: "synthetic-document-item", description: "Equipo sintético documental", quantity: 3 }],
      rows: [{ type: "item", sourceItemIndex: 0 }], notes: ["Nota documental sintética"] }];
    equipmentState.documentServiceName = "Documento sintético";
    syntheticDecisions = ["save"];
  `);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), false);
  assert.equal(ledger.state.state.items[0].quantity, 3);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.calls[1].request, ledger.calls[0].request);
  const saved = clone(evaluate(context, "equipmentState.events[0].documentSections[0].items[0]"));
  assert.equal(saved.procurementChoice, "save");
  assert.equal(saved.warehouseInventoryId, ledger.state.state.items[0].id);
  assert.deepEqual(saved.inventoryIngressReceipts, [{ requestId: ledger.calls[0].request.requestId, itemId: saved.warehouseInventoryId, quantity: 3, index: 0 }]);
  evaluate(context, "loadEquipmentEvent(equipmentState.events[0].id)");
  const payload = clone(evaluate(context, "equipmentEditablePayload('full', { fileName: 'sintetico.pdf' })"));
  assert.deepEqual(payload.event.documentSections[0].items[0].inventoryIngressReceipts, saved.inventoryIngressReceipts);
  assert.deepEqual(payload.event.sections[0].items[0].inventoryIngressReceipts, saved.inventoryIngressReceipts);
  assert.equal(ledger.state.state.equipmentStockReceipts.length, 1);
});

test("same-name existing Save and rent choices survive a lost acknowledgement without converting rent into warehouse stock", async () => {
  const { context, ledger } = createContext();
  ledger.loseResponseOnce = true;
  evaluate(context, `
    equipmentState.manualExtras = [
      { id: "synthetic-existing-save", description: "Equipo sintético compartido", quantity: 2, inventoryCategory: "Extras manuales" },
      { id: "synthetic-existing-rent", description: "Equipo sintético compartido", quantity: 4, inventoryCategory: "Extras manuales" }
    ];
    syntheticDecisions = ["save", "rent"];
    let ingressDialogCalls = 0;
    requestEquipmentUnknownChoice = async () => { ingressDialogCalls++; return syntheticDecisions.shift(); };
  `);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), false);
  assert.equal(ledger.state.state.items[0].quantity, 2);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(evaluate(context, "ingressDialogCalls"), 2, "confirmed pending choices must survive the retry");
  const items = clone(evaluate(context, "equipmentState.events[0].manualExtras"));
  assert.deepEqual(items.map((item) => item.procurementChoice), ["save", "rent"]);
  assert.equal(items[0].inventoryIngressReceipts.length, 1);
  assert.equal(items[1].inventoryIngressReceipts?.length || 0, 0);
  assert.equal(items[1].warehouseInventoryId || "", "");
  evaluate(context, "loadEquipmentEvent(equipmentState.events[0].id)");
  assert.equal(evaluate(context, "equipmentProcurementReportRows('rent')[0].quantity"), 4);
  assert.equal(evaluate(context, "equipmentProcurementReportRows('rent')[0].missing"), 4);
  assert.equal(ledger.calls.length, 2);
  assert.deepEqual(ledger.calls[1].request, ledger.calls[0].request);
  assert.equal(ledger.state.state.items[0].quantity, 2);
  assert.equal(ledger.state.state.auditEntries.length, 1);
});
