"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { calculateEquipmentAvailability, createEquipmentEventStore, normalizeEquipmentLogisticsOptions } = require("../equipment-event-store.cjs");
const NOW = Date.parse("2026-01-01T00:00:00Z");
function inventory(quantity = 3, movements = [], itemType = "equipo") {
  return { state: { items: [{ id: "global-unit", name: "Unidad global sintética", category: "Pruebas", quantity, itemType }], movements }, savedAt: "synthetic-current" };
}
function event(id, quantity = 1, extra = {}) {
  return { id, status: "confirmed", place: "Sede sintética", name: id, warehouseDispatchId: `dispatch-${id}`,
    setupAt: "2026-10-20T08:00", startAt: "2026-10-20T09:00", endAt: "2026-10-20T10:00", equipmentInAt: "2026-10-20T20:00",
    sections: [{ id: `section-${id}`, title: "Pruebas", notes: ["Nota literal"], items: [{ id: `line-${id}`, warehouseInventoryId: "global-unit", quantity, description: "Unidad global sintética" }] }], ...extra };
}
function later(id, quantity = 1, extra = {}) {
  return event(id, quantity, { setupAt: "2026-10-20T14:00", startAt: "2026-10-20T15:00", endAt: "2026-10-20T16:00", equipmentInAt: "2026-10-20T22:00", ...extra });
}
function plan(events, stock = inventory(), options = {}) {
  return calculateEquipmentAvailability(events, stock, { now: NOW, ...options });
}
function row(events, stock, options) { return plan(events, stock, options).rows.find((entry) => entry.warehouseInventoryId === "global-unit"); }
function route(id, fromEventId, toEventId, quantity = 1, extra = {}) {
  return { id, fromEventId, toEventId, items: [{ warehouseInventoryId: "global-unit", quantity }], travelMinutes: 0, handlingMinutes: 120, ...extra };
}
function storeFor(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "global-logistics-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return createEquipmentEventStore({ directory, now: () => NOW });
}

test("rutas dirigidas validan datos explícitos y no convierten vacíos en cero", () => {
  for (const raw of [{ routeEstimates: {} }, { routeEstimates: [null] }, { routeEstimates: [{ fromPlace: "A", toPlace: "B", travelMinutes: "", handlingMinutes: 120 }] },
    { routeEstimates: [{ fromPlace: "A", toPlace: "B", travelMinutes: 1, handlingMinutes: -1 }] },
    { routeEstimates: [{ fromPlace: "A", toPlace: "B", travelMinutes: Infinity, handlingMinutes: 0 }] },
    { routeEstimates: [{ fromPlace: "A", toPlace: "B", travelMinutes: 0, handlingMinutes: 0 }, { fromPlace: "á", toPlace: " b ", travelMinutes: 0, handlingMinutes: 0 }] }]) {
    assert.throws(() => normalizeEquipmentLogisticsOptions(raw), { statusCode: 400 });
  }
  const normalized = normalizeEquipmentLogisticsOptions({ routeEstimates: [{ fromPlace: "A", toPlace: "B", travelMinutes: 0, handlingMinutes: 0 }] });
  assert.equal(normalized.routeEstimates[0].travelMinutes, 0);
});

test("un evento viejo devuelto y uno futuro independiente no inflan la renta de esta semana", () => {
  const historical = event("historical", 100, { setupAt: "2025-10-20T08:00", startAt: "2025-10-20T09:00", endAt: "2025-10-20T10:00", equipmentInAt: "2025-10-20T12:00" });
  const future = event("future", 100, { setupAt: "2027-10-20T08:00", startAt: "2027-10-20T09:00", endAt: "2027-10-20T10:00", equipmentInAt: "2027-10-20T12:00" });
  const result = row([historical, event("current"), future], inventory(), { from: "2026-10-19", to: "2026-10-25" });
  assert.equal(result.planning.requiredFleet, 1); assert.equal(result.planning.rentalPotential, 0);
  assert.equal(result.planning.allActiveEventCount, 3); assert.equal(result.planning.plannedEventCount, 1);
  assert.deepEqual(result.planning.allocations[0].eventIds, ["current"]);
});

test("un evento anterior que aún ocupa equipo sí conserva su reserva al cambiar de semana", () => {
  const previous = event("previous", 3, { setupAt: "2026-10-18T08:00", startAt: "2026-10-18T09:00", endAt: "2026-10-20T18:00", equipmentInAt: "2026-10-21T12:00" });
  const result = row([previous, event("current", 2)], inventory(), { from: "2026-10-20", to: "2026-10-20" });
  assert.equal(result.planning.requiredFleet, 5); assert.equal(result.planning.rentalPotential, 2);
  assert.equal(result.planning.plannedEventCount, 2);
});

test("un trasiego confirmado conserva destinos fuera del período y no presta sus unidades durante la espera", () => {
  const destination = later("future-destination", 1, { setupAt: "2026-10-28T14:00", startAt: "2026-10-28T15:00", endAt: "2026-10-28T16:00", equipmentInAt: "2026-10-28T22:00" });
  const result = row([event("origin"), destination, later("middle")], inventory(1), { from: "2026-10-20", to: "2026-10-20", transfers: [route("fixed", "origin", destination.id)] });
  assert.equal(result.planning.requiredFleet, 2); assert.equal(result.planning.rentalPotential, 1);
  assert.equal(result.planning.plannedEventCount, 3);
  assert.deepEqual(result.transfers, []);
});

test("el mínimo de renta incluye el itinerario de sus propias unidades sin ofrecer un trasiego de bodega ficticio", () => {
  const result = row([event("origin"), later("destination")], inventory(0));
  assert.equal(result.planning.rentalPotential, 1); assert.deepEqual(result.transfers, []);
  assert.equal(result.planning.rentalRoutes.length, 1);
  const suggested = result.planning.rentalRoutes[0];
  assert.equal(suggested.fromEventId, "origin"); assert.equal(suggested.toEventId, "destination");
  assert.equal(suggested.quantity, 1); assert.equal(suggested.source, "rental");
  assert.equal(suggested.requiresRentalSupplierConfirmation, true);
});

test("los tiempos estimados son visibles y cada par de lugares dirigido se muestra una sola vez", () => {
  const first = event("origin", 1, { place: "Sede Á" }); const second = later("destination", 1, { place: "Sede B" });
  const third = later("third", 1, { place: "SEDE b" });
  const result = plan([first, second, third]);
  const suggested = result.rows[0].transfers[0];
  assert.equal(suggested.travelMinutes, 60); assert.equal(suggested.handlingMinutes, 120);
  assert.equal(suggested.travelSource, "estimate"); assert.equal(suggested.requiresTimeConfirmation, true);
  assert.equal(result.logistics.routePairs.length, 1);
  const checked = row([first, second], inventory(), { routeEstimates: [{ fromPlace: "sede a", toPlace: "sede b", travelMinutes: 90, handlingMinutes: 30 }] }).transfers[0];
  assert.equal(checked.travelSource, "user"); assert.equal(checked.handlingSource, "user");
  assert.equal(checked.requiresTimeConfirmation, false); assert.equal(checked.requiredMinutes, 120);
});

test("el mismo lugar sólo elimina transporte, mantiene desmontaje y preparación", () => {
  const result = row([event("origin", 1, { place: " SALÓN Á " }), later("destination", 1, { place: "salon a" })]);
  assert.equal(result.transfers[0].travelMinutes, 0); assert.equal(result.transfers[0].handlingMinutes, 120);
  assert.equal(result.transfers[0].travelSource, "same-place"); assert.equal(result.transfers[0].requiresTimeConfirmation, true);
});

test("sin finalización nunca se inventa una salida para el trasiego y un evento legado sólo puede regresar a bodega", () => {
  const first = event("origin"); delete first.endAt;
  const result = row([first, later("destination")], inventory(1));
  assert.equal(result.planning.requiredFleet, 2); assert.equal(result.planning.rentalPotential, 1); assert.deepEqual(result.transfers, []);
  assert.ok(result.planning.warnings.some((warning) => warning.includes("finalización")));
});

test("un regreso físico pendiente vence cualquier regreso previsto al proponer más trasiegos", () => {
  const previous = event("previous", 3, { setupAt: "2026-10-18T08:00", startAt: "2026-10-18T09:00", endAt: "2026-10-18T10:00", equipmentInAt: "2026-10-18T12:00" });
  const stock = inventory(3, [{ itemId: "global-unit", type: "salida", quantity: 3, sourceDocumentId: previous.warehouseDispatchId, dateTime: previous.setupAt }]);
  const result = row([previous, event("current", 3)], stock, { now: Date.parse("2026-10-20T12:00:00Z"), from: "2026-10-20", to: "2026-10-20" });
  assert.equal(result.planning.requiredFleet, 6); assert.equal(result.planning.rentalPotential, 3);
  assert.deepEqual(result.transfers, []); assert.ok(result.planning.warnings.some((warning) => warning.includes("regreso físico")));
});

test("una ruta fijada de B a A a la misma hora no crea un ciclo inverso ni desaparece la demanda", () => {
  const instant = { setupAt: "2026-10-20T10:00", startAt: "2026-10-20T10:00", endAt: "2026-10-20T10:00", equipmentInAt: "2026-10-20T10:00" };
  const result = row([event("a", 1, instant), event("b", 1, instant)], inventory(1), {
    transfers: [route("fixed-reverse", "b", "a", 1, { handlingMinutes: 0 })],
    routeEstimates: [{ fromPlace: "Sede sintética", toPlace: "Sede sintética", travelMinutes: 0, handlingMinutes: 0 }] });
  assert.equal(result.planning.requiredFleet, 1); assert.equal(result.planning.rentalPotential, 0);
  assert.deepEqual(result.planning.allocations[0].eventIds, ["b", "a"]); assert.deepEqual(result.transfers, []);
});

test("confirmar dos cadenas físicas superpuestas exige existencias reales para ambas", (t) => {
  const store = storeFor(t);
  const events = [event("a"), later("b"), event("c"), later("d")];
  events.forEach((entry) => store.putEvent(entry.id, { event: entry }));
  store.putTransfer("first", route("first", "a", "b"), "Prueba", inventory(1));
  assert.throws(() => store.putTransfer("second", route("second", "c", "d"), "Prueba", inventory(1)), { statusCode: 409 });
  assert.equal(store.readTransfers().transfers.length, 1);
  const saved = store.putTransfer("second", route("second", "c", "d"), "Prueba", inventory(2));
  assert.equal(saved.transfers.length, 2);
  const changed = row(events, inventory(1), { transfers: saved.transfers });
  assert.equal(changed.planning.physicalConflict, true); assert.equal(changed.planning.confirmedOwnedPeak, 2);
  assert.equal(changed.planning.optimal, false); assert.deepEqual(changed.transfers, []);
});

test("ni una ruta de duración cero puede confirmar una unidad que no existe", (t) => {
  const store = storeFor(t); const instant = { setupAt: "2026-10-20T10:00", startAt: "2026-10-20T10:00", endAt: "2026-10-20T10:00", equipmentInAt: "2026-10-20T10:00" };
  [event("a", 1, instant), event("b", 1, instant)].forEach((entry) => store.putEvent(entry.id, { event: entry }));
  assert.throws(() => store.putTransfer("instant", route("instant", "a", "b", 1, { handlingMinutes: 0 }), "Prueba", inventory(0)), { statusCode: 409 });
});

test("editar un evento no puede superponer dos rutas ya confirmadas sin stock para ambas", (t) => {
  const store = storeFor(t);
  const a = event("a"); const b = later("b", 1, { equipmentInAt: "2026-10-20T17:00" });
  const c = event("c", 1, { setupAt: "2026-10-21T08:00", startAt: "2026-10-21T09:00", endAt: "2026-10-21T10:00", equipmentInAt: "2026-10-21T20:00" });
  const d = later("d", 1, { setupAt: "2026-10-21T14:00", startAt: "2026-10-21T15:00", endAt: "2026-10-21T16:00", equipmentInAt: "2026-10-21T22:00" });
  const saved = [a, b, c, d].map((entry) => store.putEvent(entry.id, { event: entry }));
  store.putTransfer("first", route("first", "a", "b"), "Prueba", inventory(1));
  store.putTransfer("second", route("second", "c", "d"), "Prueba", inventory(1));
  const edited = { ...b, equipmentInAt: "2026-10-21T20:00" };
  assert.throws(() => store.putEvent("b", { event: edited, expectedUpdatedAt: saved[1].event.updatedAt }, "Prueba", inventory(1)), { statusCode: 409 });
  assert.equal(store.readEvents().events.find((entry) => entry.id === "b").equipmentInAt, "2026-10-20T17:00");
});

test("una entrada rentada no roba la continuación de una cadena propia confirmada al compartir evento", () => {
  const rentedStart = event("a-rental"); const ownedStart = event("z-owned");
  const shared = later("shared", 2); const final = later("final", 1, { setupAt: "2026-10-20T20:00", startAt: "2026-10-20T21:00", endAt: "2026-10-20T22:00", equipmentInAt: "2026-10-21T12:00" });
  const result = row([rentedStart, ownedStart, shared, final], inventory(1), { transfers: [route("owned-in", "z-owned", "shared"), route("owned-out", "shared", "final")] });
  assert.equal(result.planning.requiredFleet, 2); assert.equal(result.planning.rentalPotential, 1);
  assert.equal(result.planning.mandatoryShortage, 0); assert.equal(result.planning.physicalConflict, false); assert.equal(result.planning.optimal, true);
  assert.deepEqual(result.planning.allocations.find((entry) => entry.source === "warehouse").eventIds, ["z-owned", "shared", "final"]);
});

test("consumibles usan los consumos reales y no vuelven a comprar una entrega vieja ya consumida", () => {
  const previous = event("previous", 100, { setupAt: "2025-10-20T08:00", startAt: "2025-10-20T09:00", endAt: "2025-10-20T10:00", equipmentInAt: "2025-10-20T12:00" });
  const stock = inventory(103, [{ itemId: "global-unit", type: "consumo", quantity: 100, sourceDocumentId: previous.warehouseDispatchId }], "consumible");
  const result = row([previous, event("current", 2)], stock, { from: "2026-10-19", to: "2026-10-25" });
  assert.equal(result.planning.requiredFleet, 2); assert.equal(result.planning.purchasePotential, 0);
  assert.equal(result.planning.ownedCapacity, 3); assert.equal(result.planning.rentalPotential, 0);
});

test("la vista previa es de sólo lectura y preserva fuentes, cantidades cero y notas literalmente", () => {
  const original = event("literal", 0); original.source = { rows: [{ kind: "note", cells: ["NOTA", "  literal  "] }, { kind: "item", cells: ["0", "Unidad global sintética"] }] };
  const serialized = JSON.stringify(original); const stock = inventory(); const serializedStock = JSON.stringify(stock);
  const result = plan([original], stock);
  assert.equal(JSON.stringify(original), serialized); assert.equal(JSON.stringify(stock), serializedStock);
  assert.deepEqual(result.events[0].source, original.source); assert.deepEqual(result.events[0].sections, original.sections);
  assert.equal(result.rows[0].quantity, 0); assert.equal(result.rows[0].planning.requiredFleet, 0);
});

test("ciento veinte eventos y cantidades altas se planifican sin límite artificial ni un nodo por cada unidad", () => {
  const base = Date.parse("2026-10-01T00:00:00Z");
  const events = Array.from({ length: 120 }, (_, index) => {
    const at = (hours) => new Date(base + (index * 24 + hours) * 3600000).toISOString().slice(0, 16);
    return event(`many-${String(index).padStart(3, "0")}`, 10000, { setupAt: at(8), startAt: at(9), endAt: at(10), equipmentInAt: at(12) });
  });
  const result = row(events, inventory(10000));
  assert.equal(result.events.length, 120); assert.equal(result.quantity, 1200000);
  assert.equal(result.planning.requiredFleet, 10000); assert.equal(result.planning.rentalPotential, 0);
  assert.equal(result.planning.allocations.length, 1); assert.equal(result.planning.allocations[0].eventIds.length, 120);
});
