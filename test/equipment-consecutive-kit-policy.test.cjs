"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../equipment-event-store.cjs");
const Draft = require("../equipment-draft-logistics.js");
const item = (id, quantity) => ({ id: `line-${id}`, warehouseInventoryId: id, description: `Referencia ${id}`, quantity });
const at = (day, hour) => `2026-11-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
function event(id, day, quantities, extra = {}) { return { id, name: `Evento ${id}`, place: `Sede ${id}`, setupApplies: true,
  setupAt: at(day, 8), startAt: at(day, 10), endAt: at(day, 20), equipmentInAt: at(30, 23),
  sections: [{ id: `s-${id}`, title: "Equipo", notes: ["nota intacta"], items: Object.entries(quantities).map(([id, quantity]) => item(id, quantity)) }], ...extra }; }
function inventory(quantities) { return { savedAt: "sintetico-actual", state: { items: Object.entries(quantities).map(([id, quantity]) => ({ id, name: `Referencia ${id}`, quantity, itemType: id === "supply" ? "consumible" : "equipo" })), movements: [] } }; }
function options(events) { return { now: Date.parse("2026-11-20T12:00:00Z"), routeEstimates: events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 30, handlingMinutes: 30, distanceKm: 10 }))) }; }
const plan = (events, stock, extra = {}) => Engine.calculateEquipmentAvailability(events, stock, { ...options(events), ...extra });
const policy = result => result.logistics.routePolicy;
const primary = result => policy(result).primaryDestinations.map(pair => `${pair.fromEventId}>${pair.toEventId}`).sort();

test("el calendario global incluye un montaje el viernes para una celebración del sábado sin duplicar demanda", () => {
  const events = [event("jueves", 26, { a: 1, b: 2, c: 3, d: 4, e: 1 }),
    event("celebracion1", 27, { a: 1 }), event("celebracion2", 27, { b: 2 }),
    event("montaje", 27, { a: 1, b: 2, c: 3, d: 4 }, { startAt: at(28, 12), endAt: at(28, 20) })];
  const stock = inventory({ a: 5, b: 5, c: 5, d: 5, e: 1 });
  const original = JSON.stringify({ events, stock }), result = plan(events, stock);
  assert.ok(primary(result).includes("jueves>montaje"));
  const comparison = policy(result).pairs.find(pair => pair.fromEventId === "jueves" && pair.toEventId === "montaje");
  assert.equal(comparison.sourceCoverage, .8); assert.equal(comparison.toDate, "2026-11-27"); assert.equal(comparison.toOperation, "setup");
  assert.equal(policy(result).operationalCalendar.find(day => day.date === "2026-11-27").operations.filter(op => op.eventId === "montaje")[0].kind, "setup");
  assert.equal(policy(result).operationalCalendar.find(day => day.date === "2026-11-28").operations.filter(op => op.eventId === "montaje")[0].kind, "event");
  assert.equal(result.events.length, 4); assert.equal(result.rows.find(row => row.warehouseInventoryId === "c").quantity, 6);
  assert.equal(JSON.stringify({ events, stock }), original);
});

test("no hay rutas directas de día uno a tres aunque el equipo no aparezca el día dos", () => {
  const events = [event("uno", 26, { a: 2 }), event("intermedio", 27, { otro: 1 }), event("tres", 28, { a: 2 })];
  const result = plan(events, inventory({ a: 2, otro: 1 }));
  assert.ok(!result.rows.flatMap(row => row.planning.routes).some(route => route.fromEventId === "uno" && route.toEventId === "tres"));
  assert.ok(!result.rows.flatMap(row => row.planning.alternativeRoutes || []).some(route => route.fromEventId === "uno" && route.toEventId === "tres"));
  assert.equal(policy(result).pairs.find(pair => pair.fromEventId === "uno" && pair.toEventId === "tres").allowed, false);
  const emptyDay = plan([events[0], events[2]], inventory({ a: 2 }));
  assert.ok(!emptyDay.rows[0].planning.routes.length);
});

test("el máximo flujo automático no divide consola y luces hacia destinos diferentes", () => {
  const events = [event("origen", 26, { a: 1, b: 1 }), event("completo", 27, { a: 1, b: 1 }), event("parcial", 27, { a: 1 })];
  const result = plan(events, inventory({ a: 2, b: 1 }));
  assert.deepEqual(primary(result), ["origen>completo"]);
  const routes = result.rows.flatMap(row => row.planning.routes).filter(route => route.fromEventId === "origen");
  assert.ok(routes.length); assert.deepEqual([...new Set(routes.map(route => route.toEventId))], ["completo"]);
  assert.ok(result.rows.flatMap(row => row.planning.alternativeRoutes || []).some(route => route.toEventId === "parcial"));
});

test("alternativas incomparables se dejan para elección manual sin ponderar cables contra consolas", () => {
  const events = [event("origen", 26, { console: 1, cable: 100 }), event("audio", 27, { console: 1 }), event("cables", 27, { cable: 100 })];
  const result = plan(events, inventory({ console: 1, cable: 100 }));
  assert.deepEqual(primary(result), []);
  assert.deepEqual(policy(result).ambiguousOrigins[0].toEventIds, ["audio", "cables"]);
  assert.equal(result.rows.flatMap(row => row.planning.routes).length, 0);
  assert.ok(result.rows.flatMap(row => row.planning.alternativeRoutes || []).length >= 2);
});

test("si aprovechan el mismo equipo se prefiere menos preparación adicional y luego viaje verificado", () => {
  const events = [event("o", 26, { a: 1 }), event("simple", 27, { a: 1 }), event("extra", 27, { a: 1, b: 1 })];
  assert.ok(primary(plan(events, inventory({ a: 2, b: 1 }))).includes("o>simple"));
  const tied = [events[0], events[1], event("viaje", 27, { a: 1 })];
  const opts = options(tied); opts.routeEstimates.find(route => route.fromPlace === "Sede o" && route.toPlace === "Sede viaje").travelMinutes = 10;
  assert.ok(primary(plan(tied, inventory({ a: 2 }), opts)).includes("o>viaje"));
});

test("nombres y orden de hojas no alteran la decisión y un solapamiento no gana por tener más coincidencias", () => {
  const events = [event("o", 26, { a: 1, b: 1 }), event("good", 27, { a: 1 }), event("overlap", 27, { a: 1, b: 1 }, { setupAt: at(26, 19), startAt: at(26, 19) })];
  const stock = inventory({ a: 2, b: 1 });
  const first = primary(plan(events, stock));
  const renamed = events.map((value, index) => ({ ...value, name: `Nombre completamente nuevo ${index}` })).reverse();
  assert.deepEqual(primary(plan(renamed, stock)), first); assert.ok(first.includes("o>good"));
});

test("salida anterior al montaje reserva desde la salida y no libera equipo instalado entre montaje y celebración", () => {
  const setup = event("montaje", 27, { a: 1 }, { equipmentOutAt: at(26, 18), startAt: at(28, 12), endAt: at(28, 20) });
  assert.equal(Engine.eventReservationStartAt(setup), at(26, 18));
  const events = [setup, event("otro", 28, { a: 1 })];
  const result = plan(events, inventory({ a: 1 }));
  assert.equal(result.rows[0].required, 2);
  assert.equal(result.rows[0].planning.alternativeRoutes.length, 0);
});

test("la política conserva una ruta confirmada anterior que salta días y la identifica como excepción", () => {
  const events = [event("o", 26, { a: 1 }), event("d", 28, { a: 1 })];
  const transfer = { id: "ruta-confirmada", fromEventId: "o", toEventId: "d", status: "confirmed", travelMinutes: 30, handlingMinutes: 30, items: [{ warehouseInventoryId: "a", quantity: 1 }] };
  const result = plan(events, inventory({ a: 1 }), { transfers: [transfer] });
  assert.equal(result.invalidTransfers.length, 0); assert.equal(result.transfers.length, 1);
  assert.equal(policy(result).exceptions[0].code, "confirmed_policy_exception"); assert.equal(policy(result).exceptions[0].preserved, true);
  assert.equal(result.rows[0].planning.allocations[0].quantity, 1);
});

test("una cadena consecutiva usa la misma unidad y los consumibles se acumulan una sola vez por evento", () => {
  const events = [event("a", 26, { gear: 1, supply: 2, zero: 0 }), event("b", 27, { gear: 1, supply: 2, zero: 0 }), event("c", 28, { gear: 1, supply: 2, zero: 0 })];
  const stock = inventory({ gear: 1, supply: 3, zero: 0 }), base = Draft.analyze(events, stock, options(events));
  const ids = base.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.recommendedTransferIds);
  const selected = Draft.analyze(events, stock, { ...options(events), selectedTransferIds: ids });
  assert.equal(selected.rows.find(row => row.warehouseInventoryId === "gear").rental, 0);
  assert.equal(selected.rows.find(row => row.warehouseInventoryId === "supply").purchase, 3);
  assert.equal(selected.rows.find(row => row.warehouseInventoryId === "zero").demand, 0);
  assert.equal(selected.selectedTransfers.length, 2);
});

test("el manifiesto de una selección parcial prepara la diferencia contra lo elegido, no contra la demanda original", () => {
  const events = [event("o", 26, { a: 2 }), event("d", 27, { a: 3 })];
  const stock = inventory({ a: 5 }), base = Draft.analyze(events, stock, options(events));
  const route = base.candidates.find(route => route.fromEventId === "o" && route.toEventId === "d");
  const selected = Draft.analyze(events, stock, { ...options(events), selectedTransferIds: [route.id], transferEdits: [{ id: route.id, quantity: 1 }] });
  const manifest = selected.routeBundles.find(bundle => bundle.selected);
  assert.equal(manifest.commonItems[0].selectedQuantity, 1);
  assert.equal(manifest.preloadItems[0].requestedQuantity, 2);
  assert.equal(manifest.preloadItems[0].quantity, 2);
  assert.equal(selected.rows[0].demand, 5, "preparación no duplica demanda");
});

test("dos orígenes simultáneos no recomiendan la misma existencia propia dos veces", () => {
  const events = [event("o1", 26, { a: 1 }), event("o2", 26, { a: 1 }), event("d", 27, { a: 2 })];
  const result = Draft.analyze(events, inventory({ a: 1 }), options(events));
  const recommended = result.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.commonItems);
  assert.equal(recommended.reduce((sum, line) => sum + line.ownTransferQuantity, 0), 1);
  const ids = result.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.recommendedTransferIds);
  const chosen = Draft.analyze(events, inventory({ a: 1 }), { ...options(events), selectedTransferIds: ids });
  assert.equal(chosen.invalidSelections.length, 0); assert.equal(chosen.selectedTransfers.length, 1);
});

test("la fecha operativa de destino sigue siendo montaje aunque su bloqueo de salida empiece el día anterior", () => {
  const events = [event("o", 26, { a: 1 }, { endAt: at(26, 12) }),
    event("d", 27, { a: 1 }, { equipmentOutAt: at(26, 18), startAt: at(28, 12), endAt: at(28, 20) })];
  const result = plan(events, inventory({ a: 1 }));
  const route = result.rows[0].planning.alternativeRoutes[0];
  assert.equal(route.toDate, "2026-11-27"); assert.equal(route.toAt, at(27, 8));
  assert.equal(route.setupAt, at(26, 18), "la obligación de custodia sigue usando la salida temprana");
  assert.equal(route.dayDifference, 1);
});

test("la API persistente rechaza nuevas rutas que saltan días y conserva el reintento exacto del historial", t => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "consecutive-api-history-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = Engine.createEquipmentEventStore({ directory, now: () => Date.parse("2026-11-20T12:00:00Z") });
  const events = [event("o", 26, { a: 1 }), event("d", 28, { a: 1 })], stock = inventory({ a: 1 });
  for (const evt of events) store.putEvent(evt.id, { event: evt });
  const transfer = { id: "old-route", fromEventId: "o", toEventId: "d", travelMinutes: 30, handlingMinutes: 30,
    items: [{ warehouseInventoryId: "a", quantity: 1 }], status: "confirmed" };
  assert.throws(() => store.putTransfer(transfer.id, transfer, "Prueba", stock), /saltar días/);
  assert.equal(store.readTransfers().transfers.length, 0);
  const file = path.join(directory, ".equipment-private", "eventos-y-extras.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  state.transfers.push({ ...transfer, createdAt: "2026-11-19T12:00:00Z", updatedAt: "2026-11-19T12:00:00Z", updatedBy: "historial sintético" });
  fs.writeFileSync(file, JSON.stringify(state));
  const before = fs.readFileSync(file, "utf8"), revision = state.revision;
  assert.equal(store.readTransfers().transfers.length, 1);
  assert.equal(store.putTransfer(transfer.id, transfer, "Prueba", stock).revision, revision);
  assert.equal(fs.readFileSync(file, "utf8"), before, "un reintento no migra ni reescribe historial");
});

test("la API persistente exige aceptación de una división y permite un reintento idempotente", t => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "consecutive-api-split-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = Engine.createEquipmentEventStore({ directory, now: () => Date.parse("2026-11-20T12:00:00Z") });
  const events = [event("o", 26, { a: 2 }), event("d1", 27, { a: 1 }), event("d2", 27, { a: 1 })], stock = inventory({ a: 2 });
  for (const evt of events) store.putEvent(evt.id, { event: evt });
  const route = (id, toEventId) => ({ id, fromEventId: "o", toEventId, travelMinutes: 30, handlingMinutes: 30, items: [{ warehouseInventoryId: "a", quantity: 1 }] });
  store.putTransfer("first", route("first", "d1"), "Prueba", stock);
  assert.throws(() => store.putTransfer("second", route("second", "d2"), "Prueba", stock), error => error.requiresSplitConfirmation === true);
  assert.equal(store.readTransfers().transfers.length, 1);
  const accepted = store.putTransfer("second", { transfer: route("second", "d2"), splitAuthorizedOrigins: ["o"] }, "Prueba", stock);
  assert.equal(accepted.transfers.length, 2);
  assert.equal(store.putTransfer("second", route("second", "d2"), "Prueba", stock).revision, accepted.revision);
});
