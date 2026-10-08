const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createPurchaseHarness() {
  const listeners = new Map();
  const published = [];
  const notices = [];
  const prints = [];
  let nextId = 0;
  const formGrid = {};
  const panel = {
    querySelector() { return formGrid; },
    insertBefore(notice) { notices.push(notice); }
  };
  function field() {
    return { value: "", focus() {}, scrollIntoView() {}, closest() { return panel; } };
  }
  const form = {
    newName: field(), newCategory: field(), newQuantity: field(), newNotes: field(),
    addItemButton: {}, windowButtons: [], views: [], status: { dataset: {} }, eventsBoard: {}
  };
  const context = {
    window: {
      location: { hash: "#requerimiento-equipo", protocol: "https:" },
      crypto: { randomUUID() { return String(++nextId); } },
      localStorage: { setItem() {} },
      clearTimeout() {}, setTimeout() { return 1; },
      requestAnimationFrame(callback) { callback(); }
    },
    document: {
      readyState: "loading",
      querySelector() { return null; },
      addEventListener(name, callback) { listeners.set(name, callback); },
      dispatchEvent(event) { published.push(event); },
      createElement() { return { setAttribute() {}, addEventListener() {}, innerHTML: "" }; }
    },
    CustomEvent: class CustomEvent {
      constructor(type, options) { this.type = type; this.detail = options.detail; }
    }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  const instrumentation = `
    window.__purchaseHarness = {
      initialize(form) {
        Object.assign(elements, form);
        state = { items: [], movements: [], updatedAt: "" };
        warehouseReady = true;
        renderAll = publishWarehouseAvailability;
        openPrintDocument = (title, html) => window.__prints.push({ title, html });
        if (purchaseRequests.length) preparePurchaseDraft(purchaseRequests[0].id);
      },
      addNewItem,
      normalizeState,
      setMovements(movements) { state.movements = movements.map(normalizeMovement); },
      renderEventsBoard,
      printEventPdf,
      eventRecords() { return movementLifecycleRecords("salida", "ingreso_evento"); },
      snapshot() { return JSON.parse(JSON.stringify({ state, purchaseRequests, purchaseDraftId })); }
    };
  `;
  context.window.__prints = prints;
  vm.runInContext(source.replace('  if (document.readyState === "loading") {', instrumentation + '  if (document.readyState === "loading") {'), context);
  return {
    context, form, notices, published, prints,
    initialize() { context.window.__purchaseHarness.initialize(form); },
    request(items) { listeners.get("live:warehouse-purchase-request")({ detail: { items, returnPage: "requerimiento-equipo" } }); },
    snapshot() { return context.window.__purchaseHarness.snapshot(); },
    add() { context.window.__purchaseHarness.addNewItem(); },
    setMovements(movements) { context.window.__purchaseHarness.setMovements(movements); },
    renderEvents() { context.window.__purchaseHarness.renderEventsBoard(); },
    printEvent(key) { context.window.__purchaseHarness.printEventPdf(key); }
  };
}

test("a purchase received before inventory readiness waits without inserting stock", () => {
  const harness = createPurchaseHarness();
  harness.request([{ description: "Equipo sintético A", quantity: 5 }]);
  assert.equal(harness.context.window.location.hash, "contabilidad-equipo");
  assert.equal(harness.form.newName.value, "");
  assert.equal(harness.snapshot().state, null);
  harness.initialize();
  assert.equal(harness.form.newName.value, "Equipo sintético A");
  assert.equal(harness.form.newQuantity.value, "0");
  assert.match(harness.form.newNotes.value, /Cantidad requerida: 5/);
  assert.match(harness.notices[0].innerHTML, /Guarda este equipo en inventario para que el cambio se refleje en Requerimiento de Equipo/);
  assert.equal(harness.snapshot().state.items.length, 0);
  assert.equal(harness.published.length, 0);
  harness.add();
  assert.equal(harness.snapshot().state.items.length, 0);
  assert.equal(harness.snapshot().purchaseRequests.length, 1);
  assert.match(harness.form.status.textContent, /cantidad real comprada, mayor a 0/);
});

test("manual inventory saves publish real quantities and retain all remaining purchases", () => {
  const harness = createPurchaseHarness();
  harness.initialize();
  harness.request([
    { description: "Equipo sintético A", quantity: 5 },
    { description: "Equipo sintético B", quantity: 3 }
  ]);
  harness.form.newQuantity.value = "2";
  harness.request([{ description: "Equipo sintético C", quantity: 0 }]);
  assert.equal(harness.form.newName.value, "Equipo sintético A");
  assert.equal(harness.form.newQuantity.value, "2");
  assert.equal(harness.snapshot().state.items.length, 0);
  harness.add();
  assert.equal(harness.snapshot().state.items[0].quantity, 2);
  assert.equal(harness.form.newName.value, "Equipo sintético B");
  assert.equal(harness.form.newQuantity.value, "0");
  assert.equal(harness.snapshot().purchaseRequests.length, 2);
  assert.equal(harness.published.at(-1).type, "live:warehouse-inventory-updated");
  assert.equal(harness.published.at(-1).detail.items[0].available, 2);
  harness.form.newQuantity.value = "3";
  harness.add();
  assert.equal(harness.form.newName.value, "Equipo sintético C");
  assert.equal(harness.form.newQuantity.value, "0");
  assert.match(harness.form.newNotes.value, /Cantidad requerida: 0/);
  harness.form.newQuantity.value = "1";
  harness.add();
  assert.equal(harness.snapshot().purchaseRequests.length, 0);
  assert.equal(harness.snapshot().state.items[2].quantity, 1);
  assert.match(harness.notices[0].innerHTML, /Volver a Requerimiento de Equipo/);
});

test("saving an unrelated description does not discard a pending purchase", () => {
  const harness = createPurchaseHarness();
  harness.initialize();
  harness.context.window.prepareWarehousePurchase({ items: [{ description: "Equipo sintético A", quantity: 1 }] });
  harness.form.newName.value = "Otro equipo sintético";
  harness.add();
  assert.equal(harness.snapshot().purchaseRequests.length, 1);
  assert.equal(harness.snapshot().purchaseRequests[0].description, "Equipo sintético A");
  assert.equal(harness.form.newName.value, "Equipo sintético A");
});

test("normal inventory still accepts a manual quantity of zero", () => {
  const harness = createPurchaseHarness();
  harness.initialize();
  harness.form.newName.value = "Equipo sintético de cantidad cero";
  harness.form.newQuantity.value = "0";
  harness.add();
  assert.equal(harness.snapshot().state.items[0].quantity, 0);
});

test("pending procurement decisions survive normalization and show the selected action", () => {
  const harness = createPurchaseHarness();
  harness.initialize();
  const decisions = [
    ["save", "GUARDAR", "salida"],
    ["rent", "RENTA", "salida"],
    ["purchase", "COMPRA", "compra"]
  ];
  const movements = decisions.map(([choice, action, type], index) => ({
    id: `decision-${index}`, type, itemId: "", itemName: `Equipo sintético ${index}`,
    quantity: index + 1, sourceType: "requerimiento-equipo", sourceDocumentId: "synthetic-document",
    sourceUnmatched: true, procurementChoice: choice, procurementAction: action,
    date: "2026-10-07", dateTime: "2026-10-07T09:00"
  }));
  const normalized = harness.context.window.__purchaseHarness.normalizeState({
    items: [], movements, rentalDraft: [], workshopDraft: [], subtitles: []
  });
  decisions.forEach(([choice, action], index) => {
    assert.equal(normalized.movements[index].procurementChoice, choice);
    assert.equal(normalized.movements[index].procurementAction, action);
  });
  harness.setMovements(normalized.movements);
  harness.renderEvents();
  for (const [, action] of decisions) assert.match(harness.form.eventsBoard.innerHTML, new RegExp(`<strong>${action}</strong>`));
  assert.match(harness.form.eventsBoard.innerHTML, /Guardado tal cual, sin coincidencia en inventario/);
  assert.match(harness.form.eventsBoard.innerHTML, /Renta solicitada/);
  assert.match(harness.form.eventsBoard.innerHTML, /Compra pendiente/);
  assert.match(harness.form.eventsBoard.innerHTML, /Salió: 0/);
  assert.equal(harness.context.window.__purchaseHarness.eventRecords().length, 0);
  assert.doesNotMatch(harness.form.eventsBoard.innerHTML, /Registrar devolución/);
  harness.printEvent("cuadro:synthetic-document");
  for (const [, action] of decisions) assert.match(harness.prints[0].html, new RegExp(`<td>${action}`));
  assert.equal(harness.snapshot().state.items.length, 0);
});
