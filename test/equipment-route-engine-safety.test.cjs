"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Draft = require("../equipment-draft-logistics.js");
const Engine = require("../equipment-event-store.cjs");
const now = Date.parse("2026-11-24T12:00:00Z");
const at = (hour) => `2026-11-25T${String(hour).padStart(2, "0")}:00`;
const item = (id, quantity) => ({ id: `line-${id}`, warehouseInventoryId: id, description: `Sintético ${id}`, quantity });
const event = (id, start, end, items, extra = {}) => ({ id, name: `Evento ${id}`, place: `Sede ${id}`, setupAt: at(start), startAt: at(start), endAt: at(end), equipmentInAt: "2026-11-26T12:00",
  sections: [{ id: `s-${id}`, title: "Categoría sintética", notes: ["  Nota literal\n"], rows: [{ type: "header", description: "Encabezado" }], items }], ...extra });
const inventory = (quantities) => ({ savedAt: "fixture-actual", state: { items: Object.entries(quantities).map(([id, quantity]) => ({ id, name: `Sintético ${id}`, quantity, itemType: "equipo" })), movements: [] } });
const estimates = (events) => events.flatMap(from => events.filter(to => from.id !== to.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 10, handlingMinutes: 10, distanceKm: to.id === "E" ? 1 : 100 })));
const analyze = (events, stock, opts = {}) => Draft.analyze(events, stock, { now, routeEstimates: estimates(events), ...opts });

test("el desempate conserva el kit B a E en lugar de separar consola y altavoces hacia un evento menos parecido", () => {
  const events = [event("B", 8, 10, [item("console", 2), item("speaker", 4)]),
    event("F", 14, 16, [item("console", 2), item("lamp", 100)]), event("E", 14, 16, [item("console", 2), item("speaker", 4), item("lamp", 1)])];
  const stock = inventory({ console: 2, speaker: 4, lamp: 100 }); const source = JSON.stringify({ events, stock });
  const plan = analyze(events, stock);
  assert.deepEqual(plan.candidates.filter(route => route.fromEventId === "B").map(route => [route.toEventId, route.warehouseInventoryId]).sort(), [["E", "console"], ["E", "speaker"]]);
  const bundle = plan.routeBundles.find(route => route.fromEventId === "B" && route.toEventId === "E");
  assert.equal(bundle.recommended, true); assert.equal(bundle.preloadItems.find(line => line.warehouseInventoryId === "lamp").quantity, 1);
  const selected = analyze(events, stock, { selectedTransferIds: bundle.recommendedTransferIds });
  assert.equal(selected.rows.find(row => row.warehouseInventoryId === "console").rental, 2);
  assert.equal(selected.rows.find(row => row.warehouseInventoryId === "lamp").rental, 1);
  assert.equal(JSON.stringify({ events, stock }), source);
});

test("un máximo de tres puede editarse a fracción y cero, sin cambiar identidad y sin conservar crédito de la cantidad anterior", () => {
  const events = [event("B", 8, 10, [item("console", 3), item("zero", 0)]), event("E", 14, 16, [item("console", 3), item("zero", 0)])];
  const stock = inventory({ console: 3, zero: 0 }); const initial = analyze(events, stock); const route = initial.candidates[0];
  const partial = analyze(events, stock, { selectedTransferIds: [route.id], transferEdits: [{ id: route.id, quantity: 1.5, note: "  Traslado parcial\nRevisado  " }] });
  assert.equal(partial.candidates[0].id, route.id); assert.equal(partial.candidates[0].quantity, 3); assert.equal(partial.candidates[0].maxQuantity, 3);
  assert.equal(partial.candidates[0].selectedQuantity, 1.5); assert.equal(partial.selectedTransfers[0].quantity, 1.5);
  assert.equal(partial.selectedTransfers[0].transfer.note, "Traslado parcial\nRevisado"); assert.equal(partial.rows.find(row => row.warehouseInventoryId === "console").rental, 1.5);
  const removed = analyze(events, stock, { routeEstimates: [], selectedTransferIds: [route.id], transferEdits: [{ id: route.id, quantity: 0 }] });
  assert.equal(removed.selectedTransfers.length, 0); assert.equal(removed.invalidSelections.length, 0);
  assert.equal(removed.rows.find(row => row.warehouseInventoryId === "console").rental, 3);
  assert.equal(removed.rows.find(row => row.warehouseInventoryId === "zero").demand, 0);
});

test("rechaza ediciones repetidas, cantidades booleanas, notas inválidas y exceso real sin mutar datos", () => {
  const events = [event("B", 8, 10, [item("console", 3)]), event("E", 14, 16, [item("console", 3)])]; const stock = inventory({ console: 3 });
  const route = analyze(events, stock).candidates[0]; const original = JSON.stringify(events);
  const cases = [[{ id: route.id, quantity: true }], [{ id: route.id, quantity: "" }], [{ id: route.id, quantity: 1, note: {} }], [{ id: route.id, quantity: 1, note: "a".repeat(2001) }],
    [{ id: route.id, quantity: 1 }, { id: route.id, quantity: 2 }], [{ id: route.id, quantity: 4 }]];
  for (const transferEdits of cases) assert.throws(() => analyze(events, stock, { selectedTransferIds: [route.id], transferEdits }));
  assert.equal(JSON.stringify(events), original);
});

test("una ubicación conocida cercana gana el desempate frente a una distancia desconocida sin inventar sus kilómetros", () => {
  const events = [event("B", 8, 10, [item("console", 1)], { location: { lat: 14.6, lng: -90.5 } }),
    event("Unknown", 14, 16, [item("console", 1)]), event("Known", 14, 16, [item("console", 1)], { location: { lat: 14.6001, lng: -90.5001 } })];
  const routeEstimates = estimates(events).map(({ distanceKm, ...rest }) => rest); const plan = analyze(events, inventory({ console: 1 }), { routeEstimates });
  assert.equal(plan.candidates.find(route => route.fromEventId === "B").toEventId, "Known");
  const unknown = plan.routeBundles.find(route => route.fromEventId === "B" && route.toEventId === "Unknown");
  assert.equal(unknown.proximity.distanceKm, null); assert.equal(unknown.proximity.source, "unavailable"); assert.equal(unknown.status, "review");
});

test("la normalización conserva distancia manual cero y rechaza distancia negativa o infinita", () => {
  const route = { fromPlace: "B", toPlace: "E", travelMinutes: 0, handlingMinutes: 10 };
  assert.equal(Engine.normalizeEquipmentLogisticsOptions({ routeEstimates: [{ ...route, distanceKm: 0 }] }).routeEstimates[0].distanceKm, 0);
  for (const distanceKm of [-1, Infinity, NaN, false]) assert.throws(() => Engine.normalizeEquipmentLogisticsOptions({ routeEstimates: [{ ...route, distanceKm }] }));
});

test("el camión respeta un desmontaje posterior al fin del evento y no sale con el equipo antes de tiempo", () => {
  const b = event("B", 8, 10, [item("console", 1)], { teardownAt: at(15) });
  const e = event("E", 14, 16, [item("console", 1)]); const stock = inventory({ console: 1 });
  const blocked = analyze([b, e], stock);
  assert.equal(blocked.candidates.length, 0); assert.equal(blocked.routeBundles[0].status, "blocked"); assert.equal(blocked.routeBundles[0].timing.departureAt, at(15));
  const later = { ...e, setupAt: at(16), startAt: at(16), endAt: at(18) };
  const ready = analyze([b, later], stock); assert.equal(ready.candidates.length, 1); assert.equal(ready.candidates[0].departureAt, at(15));
  const applied = analyze([b, later], stock, { selectedTransferIds: ready.candidates.map(route => route.id) });
  assert.equal(applied.rows[0].rental, 0); assert.equal(applied.invalidSelections.length, 0);
  const invalid = analyze([{ ...b, teardownAt: at(9) }, e], stock);
  assert.equal(invalid.candidates.length, 0); assert.equal(invalid.rows[0].rentalProvisional, true); assert.equal(invalid.events[0].teardownAt, at(9));
});

test("una salida de bodega anterior al montaje adelanta el bloqueo de la carga adicional", () => {
  const b = event("B", 10, 12, [item("console", 2)], { equipmentOutAt: at(8) });
  const e = event("E", 16, 18, [item("console", 2), item("lamp", 1)]);
  const previous = event("C", 4, 5, [item("lamp", 1)], { equipmentInAt: at(7) });
  const plan = analyze([b, e, previous], inventory({ console: 2, lamp: 1 }));
  const route = plan.routeBundles.find(bundle => bundle.fromEventId === "B" && bundle.toEventId === "E");
  assert.equal(route.recommended, true); assert.equal(route.preloadItems[0].holdFrom, at(8)); assert.equal(route.preloadItems[0].quantity, 0);
  assert.equal(route.missingItems[0].quantity, 1);
});
