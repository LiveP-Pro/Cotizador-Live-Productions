const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { Writable } = require("node:stream");
const { finished } = require("node:stream/promises");
const { createEquipmentEventStore, calculateEquipmentAvailability, effectiveEquipmentProcurementChoice, resolveEquipmentPurchasedLine, localTime } = require("../equipment-event-store.cjs");

const current = Date.parse("2026-01-01T00:00:00Z");
function stock(amount = 3, itemType = "equipo", movements = []) {
  return { savedAt: "current-stock", state: { items: [{ id: "unit-a", name: "Unidad de prueba A", quantity: amount, itemType, category: "Categoría de prueba" }], movements } };
}
function event(id = "event-a", amount = 3, dates = {}) {
  return { id, name: `Prueba ${id}`, place: `Lugar ${id}`, type: "Prueba", warehouseDispatchId: `dispatch-${id}`,
    setupAt: "2026-03-10T10:00", startAt: "2026-03-10T12:00", endAt: "2026-03-10T15:00", equipmentInAt: "2026-03-10T16:00",
    sections: [{ id: "section-test", title: "Categoría de prueba", notes: ["Nota literal"], rows: [{ type: "header", description: "Encabezado literal" }],
      items: [{ id: "line-test", description: "Unidad de prueba A", quantity: amount, warehouseInventoryId: "unit-a" }] }], ...dates };
}
function setup(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "equipment-planning-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = createEquipmentEventStore({ directory, now: () => current });
  return { directory, store, nextClient: () => createEquipmentEventStore({ directory, now: () => current }) };
}
function plan(events, inventory = stock(), options = {}) { return calculateEquipmentAvailability(events, inventory, { now: current, ...options }); }
function mainRow(result) { return result.rows.find((row) => row.warehouseInventoryId === "unit-a"); }

test("two clients share private extras without creating inventory or duplicate retries", (t) => {
  const { directory, store, nextClient } = setup(t);
  const created = store.addExtra({ description: "  Extra sintético Á  ", category: "Prueba", defaultQuantity: 0, requestId: "attempt-a" }, "Persona A");
  assert.equal(created.item.defaultQuantity, 0);
  assert.equal(created.item.description, "  Extra sintético Á  ");
  assert.deepEqual(nextClient().readExtras(), { items: [created.item], revision: 1 });
  const retry = nextClient().addExtra({ description: "  Extra sintético Á  ", category: "Prueba", defaultQuantity: 0, requestId: "attempt-a", revision: 0 });
  assert.deepEqual(retry, created);
  const equivalent = store.addExtra({ description: "extra SINTETICO a", category: "PRUEBA" });
  assert.equal(equivalent.item.id, created.item.id);
  assert.deepEqual(fs.readdirSync(directory), [".equipment-private"]);
  assert.equal(fs.statSync(path.join(directory, ".equipment-private", "eventos-y-extras.json")).mode & 0o777, 0o600);
});

test("extras soft deletion preserves existing event snapshots and checks concurrent revision", (t) => {
  const { store, nextClient } = setup(t);
  const first = store.addExtra({ description: "Extra sintético A" });
  const evt = event(); evt.sections[0].items[0].extraId = first.item.id;
  const saved = store.putEvent(evt.id, { event: evt });
  assert.throws(() => nextClient().archiveExtra(first.item.id, { revision: first.revision }), { statusCode: 409 });
  const archived = store.archiveExtra(first.item.id, { revision: saved.revision });
  assert.equal(archived.items.length, 0);
  assert.equal(archived.item.archived, true);
  assert.deepEqual(nextClient().readEvents().events[0].sections, evt.sections);
  assert.deepEqual(store.archiveExtra(first.item.id), archived);
  assert.throws(() => store.addExtra({ description: "Extra", defaultQuantity: -1 }), { statusCode: 400 });
});

test("all source literals, zero quantities, headings, notes and legacy arrays persist exactly", (t) => {
  const { store, nextClient } = setup(t);
  const evt = event();
  evt.sections[0].items = [[0, "  Descripción literal á  "], { quantity: 0, description: "Segunda línea", notes: ["Otro detalle literal"] }];
  evt.source = { rows: [{ cells: ["0", "  Descripción literal á  ", "Observación"], kind: "item" }, { cells: ["NOTA ORIGINAL"], kind: "note" }] };
  const saved = store.putEvent(evt.id, { event: evt }, "Persona sintética");
  assert.equal(saved.events.length, 1);
  assert.deepEqual(nextClient().readEvents().events[0].sections, evt.sections);
  assert.deepEqual(nextClient().readEvents().events[0].source, evt.source);
  assert.equal(store.putEvent(evt.id, { event: evt }).revision, saved.revision);
  const changed = structuredClone(evt); changed.sections[0].items[0][0] = 1;
  assert.throws(() => store.putEvent(evt.id, { event: changed }), { statusCode: 428 });
  const updated = nextClient().putEvent(evt.id, { event: changed, expectedUpdatedAt: saved.event.updatedAt });
  assert.notEqual(updated.event.updatedAt, saved.event.updatedAt);
  assert.equal(store.putEvent(evt.id, { event: changed, expectedUpdatedAt: saved.event.updatedAt }).revision, updated.revision);
  changed.place = "Otro lugar";
  assert.throws(() => store.putEvent(evt.id, { event: changed, expectedUpdatedAt: saved.event.updatedAt }), { statusCode: 409 });
});

test("cancelling releases reservations, keeps private history and cannot silently reactivate", (t) => {
  const { directory, store, nextClient } = setup(t);
  const evt = event(); const first = store.putEvent(evt.id, { event: evt });
  assert.equal(plan(store.readEvents().events).rows[0].required, 3);
  assert.throws(() => store.cancelEvent(evt.id), { statusCode: 428 });
  const cancelled = nextClient().cancelEvent(evt.id, { expectedUpdatedAt: first.event.updatedAt });
  assert.equal(cancelled.events.length, 0);
  assert.equal(plan(store.readEvents().events).rows.length, 0);
  const archive = JSON.parse(fs.readFileSync(path.join(directory, ".equipment-private/eventos-y-extras.json")));
  assert.equal(archive.events[0].status, "cancelled");
  assert.equal(archive.audit.at(-1).action, "cancelar-evento");
  assert.throws(() => store.putEvent(evt.id, { event: evt, expectedUpdatedAt: cancelled.event.updatedAt }), { statusCode: 409 });
});

test("a physical warehouse dispatch cannot belong to two active imported event windows", (t) => {
  const { store } = setup(t); const original = event("original", 3);
  store.putEvent(original.id, { event: original });
  const copy = { ...structuredClone(original), id: "copy" };
  assert.throws(() => store.putEvent(copy.id, { event: copy }), { statusCode: 409 });
  assert.equal(store.readEvents().events.length, 1);
});

test("three warehouse units and five simultaneous requested units produce exactly two rentals", () => {
  const result = plan([event("a", 3), event("b", 2)]);
  const row = mainRow(result);
  assert.equal(row.available, 3); assert.equal(row.capacity, 3);
  assert.equal(row.required, 5); assert.equal(row.quantity, 5);
  assert.equal(row.missing, 2); assert.equal(row.action, "RENTA");
  assert.deepEqual(row.eventQuantities, { a: 3, b: 2 });
});

test("nonoverlapping reusable events reuse stock and propose transfers only with logistics margin", () => {
  const dates = { setupAt: "2026-03-10T18:00", startAt: "2026-03-10T19:00", endAt: "2026-03-10T21:00", equipmentInAt: "2026-03-10T22:00" };
  const row = mainRow(plan([event("a", 3), event("b", 3, dates)]));
  assert.equal(row.quantity, 6); assert.equal(row.required, 3); assert.equal(row.missing, 0);
  assert.equal(row.action, "DISPONIBLE"); assert.equal(row.transfers[0].quantity, 3); assert.equal(row.transfers[0].availableMinutes, 180);
  assert.equal(row.transfers[0].requiresConfirmation, true);
  const close = { ...dates, setupAt: "2026-03-10T16:30" };
  assert.equal(mainRow(plan([event("a", 3), event("b", 3, close)])).transfers.length, 0);
  assert.equal(mainRow(plan([event("a", 3), event("b", 3, close)])).missing, 3);
});

test("reusable equipment needs two hours after warehouse return before a new normal assignment", () => {
  const next = event("next", 3, { setupAt: "2026-03-10T17:59", startAt: "2026-03-10T19:00", endAt: "2026-03-10T21:00", equipmentInAt: "2026-03-10T22:00" });
  assert.equal(mainRow(plan([event("first", 3), next])).missing, 3);
  next.setupAt = "2026-03-10T18:00";
  assert.equal(mainRow(plan([event("first", 3), next])).missing, 0);
});

test("consumables accumulate across nonoverlapping events and request purchases rather than rentals", () => {
  const later = { setupAt: "2026-03-12T10:00", startAt: "2026-03-12T12:00", endAt: "2026-03-12T15:00", equipmentInAt: "2026-03-12T16:00" };
  const row = mainRow(plan([event("a", 3), event("b", 2, later)], stock(3, "consumible")));
  assert.equal(row.required, 5); assert.equal(row.missing, 2); assert.equal(row.action, "COMPRA"); assert.equal(row.transfers.length, 0);
});

test("workshop, losses, consumption and pending purchases use real current net stock", () => {
  const movements = [{ itemId: "unit-a", type: "taller", quantity: 1 }, { itemId: "unit-a", type: "perdido", quantity: 1 },
    { itemId: "unit-a", type: "compra", quantity: 100 }, { itemId: "unit-a", type: "renta", quantity: 1 }];
  const row = mainRow(plan([event("a", 5)], stock(6, "equipo", movements)));
  assert.equal(row.available, 3); assert.equal(row.missing, 2);
  movements.push({ itemId: "unit-a", type: "devolucion_taller", quantity: 1 }, { itemId: "unit-a", type: "recuperado", quantity: 1 });
  assert.equal(mainRow(plan([event("a", 5)], stock(6, "equipo", movements))).available, 5);
});

test("own physical dispatch is counted once and remains reserved through return", () => {
  const evt = event("a", 3);
  const movement = { itemId: "unit-a", type: "salida", quantity: 3, sourceDocumentId: evt.warehouseDispatchId, sourceEventId: evt.id, dateTime: "2026-03-10T08:00" };
  const row = mainRow(plan([evt, event("b", 2)], stock(3, "equipo", [movement])));
  assert.equal(row.available, 0); assert.equal(row.capacity, 3); assert.equal(row.required, 5); assert.equal(row.missing, 2);
  assert.equal(row.events[0].alreadyDispatched, 3);
  const ownOnly = mainRow(plan([evt], stock(3, "equipo", [movement])));
  assert.equal(ownOnly.missing, 0);
});

test("already consumed event quantities do not trigger a duplicate purchase", () => {
  const evt = event("a", 3);
  const movement = { itemId: "unit-a", type: "consumo", quantity: 3, sourceDocumentId: evt.warehouseDispatchId };
  const row = mainRow(plan([evt, event("b", 2)], stock(5, "consumible", [movement])));
  assert.equal(row.available, 2); assert.equal(row.required, 2); assert.equal(row.missing, 0); assert.equal(row.action, "DISPONIBLE");
});

test("a weekly consumable plan preserves earlier pending consumable commitments in other weeks", () => {
  const earlier = event("earlier", 4);
  const later = event("later", 3, { setupAt: "2026-03-20T10:00", startAt: "2026-03-20T12:00", endAt: "2026-03-20T15:00", equipmentInAt: "2026-03-20T16:00" });
  const row = mainRow(plan([earlier, later], stock(5, "consumible"), { from: "2026-03-20", to: "2026-03-20" }));
  assert.equal(row.available, 5); assert.equal(row.reservedBeforePeriod, 4); assert.equal(row.capacity, 1);
  assert.equal(row.required, 3); assert.equal(row.missing, 2); assert.equal(row.action, "COMPRA");
});

test("own dispatch credit cannot create more units than current physical inventory", () => {
  const evt = event("a", 6);
  const movement = { itemId: "unit-a", type: "salida", quantity: 6, sourceDocumentId: evt.warehouseDispatchId, dateTime: "2026-03-10T08:00" };
  const row = mainRow(plan([evt], stock(3, "equipo", [movement])));
  assert.equal(row.available, 0); assert.equal(row.capacity, 3); assert.equal(row.missing, 3);
});

test("cancelled reservations do not restore units that remain physically outside the warehouse", () => {
  const cancelled = event("cancelled", 3); cancelled.status = "cancelled";
  const movement = { itemId: "unit-a", type: "salida", quantity: 3, sourceDocumentId: cancelled.warehouseDispatchId, dateTime: "2026-03-10T08:00" };
  const row = mainRow(plan([cancelled, event("a", 2)], stock(3, "equipo", [movement])));
  assert.equal(row.available, 0); assert.equal(row.capacity, 0); assert.equal(row.missing, 2);
});

test("overdue unreturned dispatches continue blocking availability after their scheduled return", () => {
  const evt = event("a", 3);
  const later = event("b", 2, { setupAt: "2026-03-12T10:00", startAt: "2026-03-12T12:00", endAt: "2026-03-12T15:00", equipmentInAt: "2026-03-12T16:00" });
  const movement = { itemId: "unit-a", type: "salida", quantity: 3, sourceDocumentId: evt.warehouseDispatchId, dateTime: "2026-03-10T08:00" };
  const row = mainRow(plan([evt, later], stock(3, "equipo", [movement]), { now: Date.parse("2026-03-11T12:00:00Z"), from: "2026-03-12", to: "2026-03-12" }));
  assert.equal(row.capacity, 3); assert.equal(row.required, 5); assert.equal(row.missing, 2);
});

test("unknown and explicit rental/purchase lines never increase or reserve physical warehouse stock", () => {
  const evt = event("a", 3);
  evt.sections[0].items.push({ quantity: 4, description: "Unidad de prueba A", warehouseInventoryId: "unit-a", procurementChoice: "rent" });
  evt.sections[0].items.push({ quantity: 6, description: "Material desconocido", itemType: "consumible", procurementChoice: "purchase" });
  const before = stock(); const original = structuredClone(before); const result = plan([evt], before);
  assert.equal(mainRow(result).required, 3); assert.equal(mainRow(result).missing, 0);
  const rental = result.rows.find((row) => row.procurementChoice === "rent");
  assert.equal(rental.available, 0); assert.equal(rental.required, 4); assert.equal(rental.action, "RENTA");
  const purchase = result.rows.find((row) => row.procurementChoice === "purchase");
  assert.equal(purchase.missing, 6); assert.equal(purchase.action, "COMPRA");
  assert.deepEqual(before, original);
});

test("a saved extra reserves actual stock only after its ingress receipt is verified against the current server ledger", () => {
  const evt = event("saved-extra", 2); const line = evt.sections[0].items[0]; line.procurementChoice = "save";
  line.inventoryIngressReceipts = [{ requestId: "real-synthetic-ingress", itemId: "unit-a", quantity: 2, index: 0 }];
  const inventory = stock(3);
  inventory.state.equipmentStockReceipts = [{ requestId: "real-synthetic-ingress", items: [{ itemId: "unit-a", description: "Unidad de prueba A", quantity: 2 }] }];
  assert.equal(effectiveEquipmentProcurementChoice(line, inventory), "");
  const row = mainRow(plan([evt], inventory));
  assert.equal(row.required, 2); assert.equal(row.available, 3); assert.equal(row.missing, 0); assert.equal(row.external, false);
  assert.equal(row.action, "DISPONIBLE");
  assert.equal(inventory.state.items[0].quantity, 3, "planning does not create another acquisition");
});

test("forged ingress receipts, identical names and stale archived ids never turn saved extras into stock", () => {
  const base = event("saved-extra", 2); const line = base.sections[0].items[0]; line.procurementChoice = "save";
  const inventory = stock(3); inventory.state.equipmentStockReceipts = [{ requestId: "real-synthetic-ingress", items: [{ itemId: "unit-a", quantity: 2 }] }];
  for (const claimed of [
    { requestId: "fake-ingress", itemId: "unit-a", quantity: 2, index: 0 },
    { requestId: "real-synthetic-ingress", itemId: "unit-a", quantity: 99, index: 0 },
    { requestId: "real-synthetic-ingress", itemId: "other-physical-unit", quantity: 2, index: 0 },
    { requestId: "real-synthetic-ingress", itemId: "unit-a", quantity: 2, index: 1 }
  ]) {
    line.inventoryIngressReceipts = [claimed];
    assert.equal(effectiveEquipmentProcurementChoice(line, inventory), "save");
    const result = plan([base], inventory);
    assert.equal(result.rows[0].warehouseInventoryId, ""); assert.equal(result.rows[0].available, 0); assert.equal(result.rows[0].action, "PENDIENTE");
  }
  line.inventoryIngressReceipts = [{ requestId: "real-synthetic-ingress", itemId: "unit-a", quantity: 2, index: 0 }];
  const withoutId = { ...line }; delete withoutId.warehouseInventoryId;
  assert.equal(effectiveEquipmentProcurementChoice(withoutId, inventory), "save");
  inventory.state.items[0].archived = true;
  assert.equal(effectiveEquipmentProcurementChoice(line, inventory), "save");
});

test("purchase and rental decisions stay external even when names and ids already exist in stock", () => {
  const inventory = stock(3);
  inventory.state.equipmentStockReceipts = [{ requestId: "real-synthetic-ingress", items: [{ itemId: "unit-a", quantity: 2 }] }];
  const line = { ...event().sections[0].items[0], inventoryIngressReceipts: [{ requestId: "real-synthetic-ingress", itemId: "unit-a", quantity: 2, index: 0 }] };
  for (const choice of ["rent", "purchase"]) assert.equal(effectiveEquipmentProcurementChoice({ ...line, procurementChoice: choice }, inventory), choice);
});

test("a real received purchase resolves its exact event line at read time and a partial acquisition leaves only the real shortage", (t) => {
  const { directory, store } = setup(t); const evt = event("purchase-event", 5); const line = evt.sections[0].items[0];
  line.procurementChoice = "purchase"; delete line.warehouseInventoryId;
  store.putEvent(evt.id, { event: evt });
  const file = path.join(directory, ".equipment-private/eventos-y-extras.json"); const beforeFile = fs.readFileSync(file);
  const inventory = stock(2, "consumible");
  inventory.state.items[0].equipmentPurchaseLinks = [{ requestId: "confirmed-synthetic-purchase", eventId: evt.id, itemId: line.id,
    description: line.description, receivedQuantity: 2, receivedAt: "2026-01-01T00:00:00Z" }];
  const originalEvent = structuredClone(evt); const originalInventory = structuredClone(inventory);
  const resolved = resolveEquipmentPurchasedLine(evt, line, inventory);
  assert.equal(resolved.warehouseInventoryId, "unit-a"); assert.equal(resolved.procurementChoice, "");
  const result = plan(store.readEvents().events, inventory); const row = mainRow(result);
  assert.equal(result.rows.length, 1); assert.equal(row.required, 5); assert.equal(row.available, 2); assert.equal(row.missing, 3); assert.equal(row.action, "COMPRA");
  assert.deepEqual(evt, originalEvent); assert.deepEqual(inventory, originalInventory); assert.deepEqual(fs.readFileSync(file), beforeFile);
  assert.equal(store.readEvents().events[0].sections[0].items[0].procurementChoice, "purchase", "read-time resolution never rewrites source snapshots");
});

test("purchase proof requires exact event id, line id, literal normalized description and a positive received quantity", () => {
  const evt = event("purchase-event", 3); const line = evt.sections[0].items[0]; line.procurementChoice = "purchase"; delete line.warehouseInventoryId;
  const inventory = stock(2); const good = { requestId: "received-synthetic", eventId: evt.id, itemId: line.id, description: line.description, receivedQuantity: 2 };
  for (const changes of [{ eventId: "another-event" }, { itemId: "another-line" }, { description: line.description + "." },
    { receivedQuantity: 0 }, { receivedQuantity: -1 }, { receivedQuantity: "Infinity" }, { requestId: "" }]) {
    inventory.state.items[0].equipmentPurchaseLinks = [{ ...good, ...changes }];
    assert.equal(resolveEquipmentPurchasedLine(evt, line, inventory), line);
    assert.equal(plan([evt], inventory).rows[0].warehouseInventoryId, "");
  }
  inventory.state.items[0].equipmentPurchaseLinks = [{ ...good, description: "  UNIDAD DE PRUEBA A  " }];
  assert.equal(resolveEquipmentPurchasedLine(evt, line, inventory).warehouseInventoryId, "unit-a");
});

test("ambiguous or archived received purchase links never merge distinct physical inventory records", () => {
  const evt = event("purchase-event", 3); const line = evt.sections[0].items[0]; line.procurementChoice = "purchase"; delete line.warehouseInventoryId;
  const proof = { requestId: "received-synthetic", eventId: evt.id, itemId: line.id, description: line.description, receivedQuantity: 2 };
  const inventory = stock(2); inventory.state.items[0].equipmentPurchaseLinks = [proof];
  inventory.state.items.push({ ...structuredClone(inventory.state.items[0]), id: "different-physical-unit", quantity: 99 });
  assert.equal(resolveEquipmentPurchasedLine(evt, line, inventory), line);
  inventory.state.items[1].archived = true;
  assert.equal(resolveEquipmentPurchasedLine(evt, line, inventory).warehouseInventoryId, "unit-a");
  inventory.state.items[0].archived = true;
  assert.equal(resolveEquipmentPurchasedLine(evt, line, inventory), line);
  inventory.state.items[0].archived = false;
  assert.equal(resolveEquipmentPurchasedLine(evt, { ...line, procurementChoice: "rent" }, inventory).procurementChoice, "rent");
});

test("partially received reusable purchases keep the purchase decision for their remaining shortage", () => {
  const evt = event("purchase-event", 2); const line = evt.sections[0].items[0]; line.procurementChoice = "purchase"; delete line.warehouseInventoryId;
  const inventory = stock(1, "equipo");
  inventory.state.items[0].equipmentPurchaseLinks = [{ requestId: "partial-purchase", eventId: evt.id, itemId: line.id,
    description: line.description, receivedQuantity: 1 }];
  let row = mainRow(plan([evt], inventory));
  assert.equal(row.required, 2); assert.equal(row.available, 1); assert.equal(row.missing, 1); assert.equal(row.preferredPurchase, true); assert.equal(row.action, "COMPRA");
  inventory.state.items[0].quantity = 2;
  row = mainRow(plan([evt], inventory)); assert.equal(row.missing, 0); assert.equal(row.action, "DISPONIBLE");
  const persisted = structuredClone(evt); persisted.sections[0].items[0] = { ...line, warehouseInventoryId: "unit-a", procurementChoice: "", procurementPreference: "purchase" };
  inventory.state.items[0].quantity = 1;
  row = mainRow(plan([persisted], inventory)); assert.equal(row.missing, 1); assert.equal(row.action, "COMPRA");
});

test("exact unique description matching accepts case and accents, never similar distinct physical items", () => {
  const evt = event(); delete evt.sections[0].items[0].warehouseInventoryId; evt.sections[0].items[0].description = "  UNIDAD de prueba A  ";
  assert.equal(mainRow(plan([evt])).required, 3);
  const inventory = stock(); inventory.state.items.push({ id: "unit-b", name: "Unidad de prueba A", quantity: 99 });
  assert.equal(plan([evt], inventory).rows[0].warehouseInventoryId, "");
  assert.equal(plan([evt], inventory).rows[0].pendingIdentification, true);
  evt.sections[0].items[0].description = "Unidad de prueba B";
  assert.equal(plan([evt]).rows[0].warehouseInventoryId, "");
});

test("week filter includes outside events crossing the selected dates and excludes unrelated weeks", () => {
  const crossing = event("crossing", 3, { setupAt: "2026-03-08T10:00", startAt: "2026-03-09T12:00", endAt: "2026-03-11T12:00", equipmentInAt: "2026-03-11T16:00" });
  const outside = event("outside", 100, { setupAt: "2026-03-20T10:00", startAt: "2026-03-20T12:00", endAt: "2026-03-20T15:00", equipmentInAt: "2026-03-20T16:00" });
  const result = plan([crossing, event("inside", 2), outside], stock(), { from: "2026-03-10", to: "2026-03-10" });
  assert.equal(mainRow(result).required, 5); assert.equal(mainRow(result).missing, 2);
  assert.deepEqual(result.events.map((entry) => entry.id), ["crossing", "inside"]);
  assert.throws(() => plan([], stock(), { from: "2026-02-30" }), { statusCode: 400 });
});

test("Guatemala local times are independent of the host timezone and invalid dates are rejected", (t) => {
  const { store } = setup(t);
  assert.equal(localTime("2026-03-10T10:00"), Date.parse("2026-03-10T16:00:00Z"));
  const invalidDate = event(); invalidDate.startAt = "2026-02-30T12:00";
  assert.throws(() => store.putEvent(invalidDate.id, { event: invalidDate }), { statusCode: 400 });
  const reversed = event(); reversed.endAt = "2026-03-10T11:00";
  assert.throws(() => store.putEvent(reversed.id, { event: reversed }), { statusCode: 400 });
  const missing = event(); delete missing.equipmentInAt;
  store.putEvent(missing.id, { event: missing });
  const row = mainRow(plan([missing])); assert.equal(row.pendingLogistics, true); assert.equal(row.action, "PENDIENTE");
});

function transfer(id = "route-a", fromEventId = "from", toEventId = "to", amount = 3) {
  return { id, fromEventId, toEventId, items: [{ warehouseInventoryId: "unit-a", quantity: amount }], travelMinutes: 60, handlingMinutes: 120 };
}
function overlappingPair() {
  return [event("from", 3, { equipmentInAt: "2026-03-10T20:00" }), event("to", 3, {
    setupAt: "2026-03-10T18:00", startAt: "2026-03-10T19:00", endAt: "2026-03-10T21:00", equipmentInAt: "2026-03-10T22:00"
  })];
}

test("legacy windows keep reservations with only setup and return and never infer midnight event times", (t) => {
  const { store } = setup(t);
  const evt = event(); delete evt.startAt; delete evt.endAt; evt.date = "2026-03-10";
  const saved = store.putEvent(evt.id, { event: evt });
  assert.equal(mainRow(plan(saved.events)).required, 3);
  assert.equal(mainRow(plan(saved.events)).pendingLogistics, undefined);
});

test("confirmed transfers persist across clients and reduce a real overlapping shortage exactly once", (t) => {
  const { store, nextClient } = setup(t); const pair = overlappingPair();
  pair.forEach((evt) => store.putEvent(evt.id, { event: evt }));
  assert.equal(mainRow(plan(pair)).missing, 3);
  assert.equal(mainRow(plan(pair)).transfers[0].quantity, 3);
  const request = transfer();
  const created = store.putTransfer(request.id, request, "Persona A", stock());
  assert.equal(nextClient().readTransfers().transfers.length, 1);
  assert.equal(store.putTransfer(request.id, request, "Persona A", stock()).revision, created.revision);
  const result = plan(nextClient().readEvents().events, stock(), { transfers: nextClient().readTransfers().transfers });
  assert.equal(mainRow(result).required, 3); assert.equal(mainRow(result).missing, 0);
  assert.equal(mainRow(result).action, "TRASIEGO"); assert.equal(mainRow(result).transfers.length, 0);
  assert.equal(result.transfers.length, 1);
  const cancelled = store.cancelTransfer(request.id, { expectedUpdatedAt: created.transfer.updatedAt });
  assert.equal(cancelled.transfers.length, 0);
  assert.equal(mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers })).missing, 3);
});

test("transfer quantities cannot be assigned twice to two destinations or exceed destination demand", (t) => {
  const { store } = setup(t); const [from, to] = overlappingPair(); const other = { ...structuredClone(to), id: "other", warehouseDispatchId: "dispatch-other" };
  [from, to, other].forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer("route-a", "from", "to", 2), "Persona", stock());
  assert.throws(() => store.putTransfer("route-b", transfer("route-b", "from", "other", 2), "Persona", stock()), { statusCode: 409 });
  assert.throws(() => store.putTransfer("route-c", transfer("route-c", "from", "to", 4), "Persona", stock()), { statusCode: 409 });
  assert.equal(store.readTransfers().transfers.length, 1);
});

test("transfer rejects impossible chronology, insufficient transport, unknown ids and consumables", (t) => {
  const { store } = setup(t); overlappingPair().forEach((evt) => store.putEvent(evt.id, { event: evt }));
  assert.throws(() => store.putTransfer("route-late", { ...transfer(), travelMinutes: 61 }, "Persona", stock()), { statusCode: 400 });
  assert.throws(() => store.putTransfer("route-cycle", transfer("route-cycle", "to", "from"), "Persona", stock()), { statusCode: 400 });
  assert.throws(() => store.putTransfer("route-same", transfer("route-same", "from", "from"), "Persona", stock()), { statusCode: 400 });
  assert.throws(() => store.putTransfer("route-consumable", transfer(), "Persona", stock(3, "consumible")), { statusCode: 400 });
  assert.throws(() => store.putTransfer("route-unknown", { ...transfer(), items: [{ warehouseInventoryId: "unknown", quantity: 1 }] }, "Persona", stock()), { statusCode: 400 });
  assert.equal(store.readTransfers().transfers.length, 0);
});

test("event edits that invalidate a confirmed route are rejected until the route is cancelled", (t) => {
  const { store } = setup(t); const pair = overlappingPair(); const saved = pair.map((evt) => store.putEvent(evt.id, { event: evt }));
  const route = store.putTransfer("route-a", transfer(), "Persona", stock());
  const edited = structuredClone(pair[0]); edited.endAt = "2026-03-10T16:00";
  assert.throws(() => store.putEvent(edited.id, { event: edited, expectedUpdatedAt: saved[0].event.updatedAt }, "Persona", stock()), { statusCode: 409 });
  assert.equal(store.readEvents().events[0].endAt, pair[0].endAt);
  store.cancelTransfer("route-a", { expectedUpdatedAt: route.transfer.updatedAt });
  assert.equal(store.putEvent(edited.id, { event: edited, expectedUpdatedAt: saved[0].event.updatedAt }, "Persona", stock()).event.endAt, edited.endAt);
});

test("cancelling an event cancels linked routes without deleting their history", (t) => {
  const { directory, store } = setup(t); const saved = overlappingPair().map((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer(), "Persona", stock());
  const result = store.cancelEvent("from", { expectedUpdatedAt: saved[0].event.updatedAt });
  assert.equal(result.transfers.length, 0); assert.equal(result.events.length, 1);
  const file = JSON.parse(fs.readFileSync(path.join(directory, ".equipment-private/eventos-y-extras.json")));
  assert.equal(file.transfers[0].status, "cancelled"); assert.equal(file.transfers.length, 1);
});

test("inventory changes invalidate unsafe transfer plans rather than silently reducing a shortage", (t) => {
  const { store } = setup(t); const pair = overlappingPair(); pair.forEach((evt) => store.putEvent(evt.id, { event: evt }));
  const route = store.putTransfer("route-a", transfer(), "Persona", stock());
  const result = plan(pair, stock(3, "consumible"), { transfers: route.transfers });
  assert.equal(result.invalidTransfers.length, 1); assert.equal(result.transfers.length, 0);
  assert.equal(mainRow(result).required, 6); assert.equal(mainRow(result).missing, 3); assert.equal(mainRow(result).action, "COMPRA");
});

test("three-event transfer chains share physical units without undercounting the peak", (t) => {
  const { store } = setup(t);
  const pair = overlappingPair(); pair[0].equipmentInAt = "2026-03-12T20:00"; pair[1].equipmentInAt = "2026-03-12T22:00";
  const third = event("third", 3, { setupAt: "2026-03-11T10:00", startAt: "2026-03-11T12:00", endAt: "2026-03-11T15:00", equipmentInAt: "2026-03-13T16:00" });
  [...pair, third].forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer(), "Persona", stock());
  store.putTransfer("route-b", transfer("route-b", "to", "third"), "Persona", stock());
  const row = mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers }));
  assert.equal(row.quantity, 9); assert.equal(row.required, 3); assert.equal(row.missing, 0);
});

test("a confirmed handoff does not retain a false source reservation after the destination returns earlier", (t) => {
  const { store } = setup(t); const pair = overlappingPair(); pair[0].equipmentInAt = "2026-03-15T20:00";
  pair.forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer(), "Persona", stock());
  const third = event("third", 3, { setupAt: "2026-03-12T10:00", startAt: "2026-03-12T12:00", endAt: "2026-03-12T15:00", equipmentInAt: "2026-03-12T16:00" });
  store.putEvent(third.id, { event: third });
  let row = mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers }));
  assert.equal(row.required, 3); assert.equal(row.missing, 0);
  row = mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers, from: "2026-03-12", to: "2026-03-12" }));
  assert.equal(row.required, 3); assert.equal(row.missing, 0, "a handoff outside the selected week still releases the stale source interval");
});

test("confirmed chains remain exact when the first event's scheduled return is later than all following returns", (t) => {
  const { store } = setup(t); const pair = overlappingPair(); pair[0].equipmentInAt = "2026-03-15T20:00"; pair[1].equipmentInAt = "2026-03-12T22:00";
  const third = event("third", 3, { setupAt: "2026-03-11T10:00", startAt: "2026-03-11T12:00", endAt: "2026-03-11T15:00", equipmentInAt: "2026-03-12T16:00" });
  [...pair, third].forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer(), "Persona", stock());
  store.putTransfer("route-b", transfer("route-b", "to", "third"), "Persona", stock());
  const row = mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers }));
  assert.equal(row.required, 3); assert.equal(row.missing, 0);
});

test("a confirmed direct handoff keeps units occupied continuously during the gap before destination setup", (t) => {
  const { store } = setup(t);
  const source = event("from", 3, { setupAt: "2026-03-10T06:00", startAt: "2026-03-10T07:00", endAt: "2026-03-10T08:00", equipmentInAt: "2026-03-10T10:00" });
  const destination = event("to", 3, { setupAt: "2026-03-10T16:00", startAt: "2026-03-10T18:00", endAt: "2026-03-10T20:00", equipmentInAt: "2026-03-10T22:00" });
  const middle = event("middle", 3, { setupAt: "2026-03-10T13:00", startAt: "2026-03-10T13:15", endAt: "2026-03-10T13:45", equipmentInAt: "2026-03-10T14:00" });
  [source, destination, middle].forEach((evt) => store.putEvent(evt.id, { event: evt }));
  assert.equal(mainRow(plan(store.readEvents().events)).missing, 0, "ordinary returns would allow warehouse reuse before confirming the handoff");
  store.putTransfer("route-a", transfer(), "Persona", stock());
  const row = mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers }));
  assert.equal(row.required, 6); assert.equal(row.missing, 3, "handoff units never visit warehouse during the gap");
});

test("draft availability preview is read only and replaces the same event id instead of reserving twice", (t) => {
  const { directory, store } = setup(t); const original = event("same", 3); store.putEvent(original.id, { event: original });
  store.putEvent("other", { event: event("other", 1) });
  const file = path.join(directory, ".equipment-private/eventos-y-extras.json"); const before = fs.readFileSync(file);
  const candidate = event("same", 2); candidate.sections[0].items.push({ quantity: 0, description: "Cero literal", notes: ["Nota cero"] });
  const preview = store.previewEvent(candidate);
  assert.equal(preview.events.length, 2);
  assert.equal(mainRow(plan(preview.events)).required, 3);
  assert.deepEqual(preview.event.sections, candidate.sections);
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(store.readEvents().events.find((entry) => entry.id === "same").sections[0].items[0].quantity, 3);
  assert.throws(() => store.previewEvent({ ...candidate, endAt: "2026-03-10T11:00" }), { statusCode: 400 });
  assert.deepEqual(fs.readFileSync(file), before);
});

test("a partial handoff holds only its confirmed quantity during the gap", (t) => {
  const { store } = setup(t);
  const source = event("from", 5, { setupAt: "2026-03-10T06:00", startAt: "2026-03-10T07:00", endAt: "2026-03-10T08:00", equipmentInAt: "2026-03-10T10:00" });
  const destination = event("to", 3, { setupAt: "2026-03-10T18:00", startAt: "2026-03-10T19:00", endAt: "2026-03-10T20:00", equipmentInAt: "2026-03-10T22:00" });
  const middle = event("middle", 3, { setupAt: "2026-03-10T13:00", startAt: "2026-03-10T13:30", endAt: "2026-03-10T14:00", equipmentInAt: "2026-03-10T15:00" });
  [source, destination, middle].forEach((evt) => store.putEvent(evt.id, { event: evt }));
  assert.equal(mainRow(plan(store.readEvents().events, stock(5))).missing, 0);
  store.putTransfer("route-a", transfer(), "Persona", stock(5));
  const row = mainRow(plan(store.readEvents().events, stock(5), { transfers: store.readTransfers().transfers }));
  assert.equal(row.required, 6); assert.equal(row.missing, 1);
});

test("a past transfer from another week does not label an unrelated later event as a transfer", (t) => {
  const { store } = setup(t); overlappingPair().forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer(), "Persona", stock());
  const later = event("later", 3, { setupAt: "2026-03-20T10:00", startAt: "2026-03-20T12:00", endAt: "2026-03-20T15:00", equipmentInAt: "2026-03-20T16:00" });
  store.putEvent(later.id, { event: later });
  const row = mainRow(plan(store.readEvents().events, stock(), { transfers: store.readTransfers().transfers, from: "2026-03-20", to: "2026-03-20" }));
  assert.equal(row.required, 3); assert.equal(row.missing, 0); assert.equal(row.action, "DISPONIBLE"); assert.equal(row.confirmedTransfers.length, 0);
});

test("physically dispatched transfer units remain occupied after the last destination return is overdue", (t) => {
  const { store } = setup(t); const pair = overlappingPair(); pair.forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", transfer(), "Persona", stock());
  const later = event("later", 3, { setupAt: "2026-03-20T10:00", startAt: "2026-03-20T12:00", endAt: "2026-03-20T15:00", equipmentInAt: "2026-03-20T16:00" });
  store.putEvent(later.id, { event: later });
  const inventory = stock(3, "equipo", [{ itemId: "unit-a", type: "salida", quantity: 3, sourceDocumentId: pair[0].warehouseDispatchId, dateTime: pair[0].setupAt }]);
  const options = { transfers: store.readTransfers().transfers, from: "2026-03-20", to: "2026-03-20", now: Date.parse("2026-03-19T12:00:00Z") };
  let row = mainRow(plan(store.readEvents().events, inventory, options));
  assert.equal(row.available, 0); assert.equal(row.capacity, 3); assert.equal(row.required, 6); assert.equal(row.missing, 3);
  assert.equal(row.events.find((entry) => entry.eventId === "to").awaitingPhysicalReturn, true);
  inventory.state.movements.push({ itemId: "unit-a", type: "ingreso_evento", quantity: 3, sourceDocumentId: pair[0].warehouseDispatchId, dateTime: "2026-03-19T15:00" });
  row = mainRow(plan(store.readEvents().events, inventory, options));
  assert.equal(row.available, 3); assert.equal(row.required, 3); assert.equal(row.missing, 0); assert.equal(row.action, "DISPONIBLE");
});

test("even zero-time transfer inputs cannot create a reservation cycle", (t) => {
  const { store } = setup(t);
  const times = { setupAt: "2026-03-10T10:00", startAt: "2026-03-10T10:00", endAt: "2026-03-10T10:00", equipmentInAt: "2026-03-10T10:00" };
  [event("from", 1, times), event("to", 1, times)].forEach((evt) => store.putEvent(evt.id, { event: evt }));
  store.putTransfer("route-a", { ...transfer("route-a", "from", "to", 1), handlingMinutes: 0, travelMinutes: 0 }, "Persona", stock());
  assert.throws(() => store.putTransfer("route-b", { ...transfer("route-b", "to", "from", 1), handlingMinutes: 0, travelMinutes: 0 }, "Persona", stock()), { statusCode: 409 });
});

test("same-name physically distinct extras retain separate warehouse identities", (t) => {
  const { store } = setup(t);
  const first = store.addExtra({ description: "Mismo nombre de prueba", category: "Prueba", warehouseInventoryId: "unit-a" });
  const second = store.addExtra({ description: "Mismo nombre de prueba", category: "Prueba", warehouseInventoryId: "unit-b" });
  assert.notEqual(first.item.id, second.item.id);
  assert.equal(second.items.length, 2);
});

test("corrupt private data stops without using a fallback or overwriting evidence", (t) => {
  const { directory, store } = setup(t); store.addExtra({ description: "Prueba" });
  const file = path.join(directory, ".equipment-private/eventos-y-extras.json");
  fs.writeFileSync(file, "{corrupted");
  assert.throws(() => store.readEvents());
  assert.throws(() => store.addExtra({ description: "Otro" }));
  assert.equal(fs.readFileSync(file, "utf8"), "{corrupted");
});

test("event and extras APIs require authentication and expose consistent persistence between clients", async (t) => {
  const { directory, store } = setup(t);
  const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const start = source.indexOf("async function handleRequest("); const end = source.indexOf("\n}\n", start) + 2;
  const inventory = stock();
  const context = vm.createContext({ URL, Number, console, equipmentEventStore: store, calculateEquipmentAvailability,
    readWarehouseInventory: () => structuredClone(inventory), readJsonBody: async (request) => request.payload,
    authenticatedUser: (request) => request.user, enqueueSave: (operation) => Promise.resolve().then(operation),
    requireAuth(request, response) { if (request.user) return true; this.errorResponse(response, 401, "Inicie sesión"); return false; },
    jsonResponse(response, status, payload) { response.writeHead(status); response.end(JSON.stringify(payload)); },
    errorResponse(response, status, message) { response.writeHead(status); response.end(JSON.stringify({ error: message })); }
  });
  // Use an explicit closure rather than VM global `this` for the auth helper.
  context.requireAuth = (request, response) => { if (request.user) return true; context.errorResponse(response, 401, "Inicie sesión"); return false; };
  vm.runInContext(source.slice(start, end), context);
  class Response extends Writable {
    constructor() { super(); this.chunks = []; }
    _write(chunk, encoding, done) { this.chunks.push(Buffer.from(chunk)); done(); }
    writeHead(status) { this.statusCode = status; }
    json() { return JSON.parse(Buffer.concat(this.chunks).toString()); }
  }
  async function dispatch(method, url, payload, user = "Persona sintética") {
    const response = new Response(); await context.handleRequest({ method, url, headers: { host: "synthetic.local" }, payload, user }, response); await finished(response); return response;
  }
  for (const [method, url] of [["GET", "/api/cuadros-equipo/extras"], ["POST", "/api/cuadros-equipo/extras"], ["DELETE", "/api/cuadros-equipo/extras/extra-a"], ["GET", "/api/cuadros-equipo/eventos"], ["PUT", "/api/cuadros-equipo/eventos/a"], ["DELETE", "/api/cuadros-equipo/eventos/a"], ["GET", "/api/cuadros-equipo/disponibilidad"], ["POST", "/api/cuadros-equipo/disponibilidad"], ["GET", "/api/cuadros-equipo/trasiegos"], ["PUT", "/api/cuadros-equipo/trasiegos/a"], ["DELETE", "/api/cuadros-equipo/trasiegos/a"]]) {
    assert.equal((await dispatch(method, url, {}, null)).statusCode, 401, url);
  }
  assert.equal((await dispatch("POST", "/api/cuadros-equipo/extras", { description: "Prueba API" })).statusCode, 200);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/extras")).json().items.length, 1);
  const evt = event("api-a", 5);
  const saved = await dispatch("PUT", "/api/cuadros-equipo/eventos/api-a", { event: evt });
  assert.equal(saved.statusCode, 200);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/eventos")).json().events.length, 1);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/disponibilidad?from=2026-03-10&to=2026-03-10")).json().rows[0].missing, 2);
  const beforePreview = fs.readFileSync(path.join(directory, ".equipment-private/eventos-y-extras.json"));
  const preview = await dispatch("POST", "/api/cuadros-equipo/disponibilidad", { event: event("api-a", 2), from: "2026-03-10", to: "2026-03-10" });
  assert.equal(preview.statusCode, 200); assert.equal(preview.json().preview, true); assert.equal(preview.json().rows[0].required, 2);
  assert.equal(preview.json().revision, saved.json().revision);
  assert.deepEqual(fs.readFileSync(path.join(directory, ".equipment-private/eventos-y-extras.json")), beforePreview);
  const edited = { ...evt, place: "Nuevo lugar" };
  assert.equal((await dispatch("PUT", "/api/cuadros-equipo/eventos/api-a", { event: edited, expectedUpdatedAt: "stale" })).statusCode, 409);
  assert.equal((await dispatch("DELETE", "/api/cuadros-equipo/eventos/api-a", { expectedUpdatedAt: saved.json().event.updatedAt })).statusCode, 200);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/eventos")).json().events.length, 0);
  for (const entry of overlappingPair()) assert.equal((await dispatch("PUT", `/api/cuadros-equipo/eventos/${entry.id}`, { event: entry })).statusCode, 200);
  const route = await dispatch("PUT", "/api/cuadros-equipo/trasiegos/route-a", transfer());
  assert.equal(route.statusCode, 200);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/trasiegos")).json().transfers.length, 1);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/disponibilidad?from=2026-03-10&to=2026-03-10")).json().rows[0].missing, 0);
  assert.equal((await dispatch("DELETE", "/api/cuadros-equipo/trasiegos/route-a", { expectedUpdatedAt: route.json().transfer.updatedAt })).statusCode, 200);
  assert.equal((await dispatch("GET", "/api/cuadros-equipo/trasiegos")).json().transfers.length, 0);
  assert.ok(fs.existsSync(path.join(directory, ".equipment-private/eventos-y-extras.json")));
});

test("private events and extras files cannot be downloaded from static hosting", () => {
  const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const start = source.indexOf("function serveStatic("); const end = source.indexOf("\n}\n", start) + 2;
  const context = vm.createContext({ decodeURIComponent, fs: { readFile() { throw new Error("Private file must not be opened"); } },
    errorResponse(response, status, message) { response.status = status; response.message = message; } });
  vm.runInContext(source.slice(start, end), context);
  for (const name of ["/.equipment-private/eventos-y-extras.json", "/%2eequipment-private/eventos-y-extras.json", "/sub/.equipment-private/eventos-y-extras.json"]) {
    const response = {}; context.serveStatic({}, response, name); assert.equal(response.status, 404);
  }
});
