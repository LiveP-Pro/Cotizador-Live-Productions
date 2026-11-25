"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Engine = require("../equipment-event-store.cjs");
const Draft = require("../equipment-draft-logistics.js");
const at = (day, hour) => `2026-12-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00`;
function event(id, day, quantities, extra = {}) {
  return { id, name: `Nombre ${id}`, place: `Lugar ${id}`, setupApplies: true, setupAt: at(day, 8), startAt: at(day, 10), endAt: at(day, 20), equipmentInAt: at(15, 23),
    sections: [{ id: `section-${id}`, title: "Equipo", notes: ["Nota conservada"], items: Object.entries({ ...quantities, zero: 0 }).map(([id, quantity]) => ({ id, description: `Referencia ${id}`, warehouseInventoryId: id, quantity })) }], ...extra };
}
function inventory(quantities) {
  return { savedAt: "existencias-sinteticas-actuales", state: { items: Object.entries({ ...quantities, zero: 0 }).map(([id, quantity]) => ({ id, name: `Referencia ${id}`, quantity, itemType: "equipo" })), movements: [] } };
}
function options(events) {
  return { now: Date.parse("2026-11-20T12:00:00Z"), routeEstimates: events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 30, handlingMinutes: 30, distanceKm: 5 }))) };
}
const analyze = (events, stock, extra = {}) => Draft.analyze(events, stock, { ...options(events), ...extra });
const recommendations = result => result.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.commonItems.filter(line => line.ownTransferQuantity > 0).map(line => `${bundle.fromEventId}>${bundle.toEventId}:${line.warehouseInventoryId}=${line.ownTransferQuantity}`)).sort();
const ids = result => result.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.recommendedTransferIds);

test("entre tres cuadros del primer día se concentra el cuadro completo en el montaje real del día siguiente", () => {
  const events = [event("parcial-a", 3, { a: 1 }), event("parcial-b", 3, { b: 1 }), event("completo", 3, { a: 1, b: 1, c: 1 }), event("montaje", 4, { a: 1, b: 1, c: 1 }, { startAt: at(5, 10), endAt: at(5, 20) })];
  const stock = inventory({ a: 2, b: 2, c: 1 }), before = JSON.stringify({ events, stock });
  const result = analyze(events, stock);
  assert.deepEqual(recommendations(result), ["completo>montaje:a=1", "completo>montaje:b=1", "completo>montaje:c=1"]);
  const comparison = result.routePolicy.originComparisons.find(entry => entry.toEventId === "montaje");
  assert.deepEqual(comparison.preferredFromEventIds, ["completo"]);
  assert.equal(comparison.toDate, "2026-12-04");
  assert.equal(comparison.comparisons.find(entry => entry.fromEventId === "parcial-a").priorityLayer, null);
  assert.equal(result.events.length, 4); assert.equal(result.rows.find(row => row.warehouseInventoryId === "c").demand, 2);
  assert.equal(JSON.stringify({ events, stock }), before);
});

test("36 cantidades diferentes conservan el cuadro dominante sin ponderar cables contra consolas", () => {
  for (let index = 1; index <= 36; index += 1) {
    const full = { a: 1 + index % 5, b: 1 + index % 3, c: 1 + index % 7 };
    const part = { a: Math.max(0, full.a - 1), b: 0, c: index % 2 ? Math.max(0, full.c - 1) : 0 };
    const events = [event("parcial", 3, part), event("completo", 3, full), event("destino", 4, full)];
    const stock = inventory(Object.fromEntries(Object.keys(full).map(id => [id, full[id] + part[id]])));
    assert.deepEqual(recommendations(analyze(events, stock)), Object.entries(full).map(([id, amount]) => `completo>destino:${id}=${amount}`).sort(), `caso ${index}`);
  }
});

test("los orígenes complementarios se conservan sin preparar de nuevo lo que lleva el otro camión", () => {
  const events = [event("audio", 3, { a: 1 }), event("luces", 3, { b: 1 }), event("destino", 4, { a: 1, b: 1 })];
  const result = analyze(events, inventory({ a: 1, b: 1 }));
  assert.deepEqual(recommendations(result), ["audio>destino:a=1", "luces>destino:b=1"]);
  assert.equal(result.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.preloadItems).length, 0);
});

test("un segundo origen solo aporta el saldo útil y una precarga adicional aparece en un solo camión", () => {
  const events = [event("parcial", 3, { a: 1 }), event("completo", 3, { a: 2, b: 1 }), event("destino", 4, { a: 3, b: 1, extra: 1 })];
  const stock = inventory({ a: 3, b: 1, extra: 1 }), result = analyze(events, stock);
  assert.deepEqual(recommendations(result), ["completo>destino:a=2", "completo>destino:b=1", "parcial>destino:a=1"]);
  const partial = result.routePolicy.originComparisons.find(entry => entry.toEventId === "destino").comparisons.find(entry => entry.fromEventId === "parcial");
  assert.equal(partial.priorityLayer, 1); assert.deepEqual(partial.quantityByReference, { a: 1 });
  const preloads = result.routeBundles.filter(bundle => bundle.recommended).flatMap(bundle => bundle.preloadItems.map(line => ({ from: bundle.fromEventId, id: line.warehouseInventoryId, quantity: line.quantity })));
  assert.deepEqual(preloads, [{ from: "completo", id: "extra", quantity: 1 }]);
  const chosen = analyze(events, stock, { selectedTransferIds: ids(result) });
  assert.equal(chosen.invalidSelections.length, 0); assert.equal(chosen.rows.find(row => row.warehouseInventoryId === "a").rental, 0);
});

test("la propiedad se asigna al kit completo antes de desempatar por ID si no existe una salida física previa", () => {
  const events = [event("a-parcial", 3, { a: 1 }), event("z-completo", 3, { a: 1, b: 1 }), event("destino", 4, { a: 1, b: 1 })];
  assert.deepEqual(recommendations(analyze(events, inventory({ a: 1, b: 1 }))), ["z-completo>destino:a=1", "z-completo>destino:b=1"]);
  const renamed = events.map((entry, index) => ({ ...entry, name: `Nuevo ${index}`, place: `Otro lugar ${index}` })).reverse();
  assert.deepEqual(recommendations(analyze(renamed, inventory({ a: 1, b: 1 }))), ["z-completo>destino:a=1", "z-completo>destino:b=1"]);
});

test("un regreso posible a bodega no desarma el cuadro completo cuando el trasiego directo cubre igual demanda", () => {
  const events = [event("parcial", 3, { a: 1 }, { equipmentInAt: at(3, 22) }), event("completo", 3, { a: 1, b: 1 }), event("destino", 4, { a: 1, b: 1 })];
  const stock = inventory({ a: 2, b: 1 }), result = analyze(events, stock);
  assert.deepEqual(recommendations(result), ["completo>destino:a=1", "completo>destino:b=1"]);
  const chosen = analyze(events, stock, { selectedTransferIds: ids(result) });
  assert.equal(chosen.invalidSelections.length, 0); assert.equal(chosen.rows.find(row => row.warehouseInventoryId === "a").rental, 0);
});

test("una unidad físicamente despachada no se inventa en el cuadro completo y solo se reutiliza desde su custodia", () => {
  const events = [event("parcial", 3, { a: 1 }), event("completo", 3, { a: 1, b: 1 }), event("destino", 4, { a: 1, b: 1 })];
  const stock = inventory({ a: 1, b: 1 }); stock.state.movements.push({ id: "salida", type: "salida", itemId: "a", quantity: 1, sourceEventId: "parcial", dateTime: at(3, 8) });
  const opts = { now: Date.parse("2026-12-03T18:00Z") }, result = analyze(events, stock, opts);
  assert.deepEqual(recommendations(result), ["completo>destino:b=1", "parcial>destino:a=1"]);
  const chosen = analyze(events, stock, { ...opts, selectedTransferIds: ids(result) });
  assert.equal(chosen.invalidSelections.length, 0); assert.equal(chosen.rows.find(row => row.warehouseInventoryId === "a").rental, 1);
  const earlier = events.map(entry => entry.id === "parcial" ? { ...entry, endAt: at(3, 10) } : entry.id === "completo" ? { ...entry, setupAt: at(3, 12), startAt: at(3, 14) } : entry);
  const slower = options(earlier).routeEstimates.map(route => route.fromPlace === "Lugar parcial" && route.toPlace === "Lugar completo" ? { ...route, travelMinutes: 150 } : route);
  const laterPlan = analyze(earlier, stock, { ...opts, routeEstimates: slower });
  assert.deepEqual(recommendations(laterPlan), ["completo>destino:b=1", "parcial>destino:a=1"], "terminar el evento no equivale a regreso físico a bodega ni inventa un traslado imposible al otro origen");
});

test("una cadena propia confirmada tiene prioridad física y las entradas fijas se restan una sola vez", () => {
  const events = [event("previo", 2, { a: 1 }), event("parcial", 3, { a: 1 }), event("completo", 3, { a: 1, b: 1 }), event("destino", 4, { a: 1, b: 1 })];
  const fixed = { id: "cadena", status: "confirmed", fromEventId: "previo", toEventId: "parcial", travelMinutes: 30, handlingMinutes: 30, items: [{ warehouseInventoryId: "a", quantity: 1 }] };
  const stock = inventory({ a: 1, b: 1 }), result = analyze(events, stock, { transfers: [fixed] });
  assert.deepEqual(recommendations(result), ["completo>destino:b=1", "parcial>destino:a=1"]);
  const earlier = events.map(entry => entry.id === "parcial" ? { ...entry, endAt: at(3, 10) } : entry.id === "completo" ? { ...entry, setupAt: at(3, 12), startAt: at(3, 14) } : entry);
  const slower = options(earlier).routeEstimates.map(route => route.fromPlace === "Lugar parcial" && route.toPlace === "Lugar completo" ? { ...route, travelMinutes: 150 } : route);
  assert.deepEqual(recommendations(analyze(earlier, stock, { transfers: [fixed], routeEstimates: slower })), ["completo>destino:b=1", "parcial>destino:a=1"], "la custodia de una cadena fija tampoco se libera al terminar la presentación");
  const withIncoming = events.filter(entry => entry.id !== "previo").map(entry => entry.id === "destino" ? event("destino", 4, { a: 2, b: 1 }) : entry);
  const incoming = { ...fixed, fromEventId: "parcial", toEventId: "destino" };
  const incomingPlan = analyze(withIncoming, inventory({ a: 2, b: 1 }), { transfers: [incoming] });
  assert.deepEqual(recommendations(incomingPlan), ["completo>destino:a=1", "completo>destino:b=1"]);
});

test("salir después de medianoche no permite saltar del día del evento al tercer día", () => {
  const events = [event("jueves", 3, { a: 1 }, { endAt: at(4, 2), teardownAt: at(4, 3) }), event("sabado", 5, { a: 1 })];
  const result = analyze(events, inventory({ a: 1 }));
  assert.equal(result.candidates.length, 0);
  const pair = result.routePolicy.pairs.find(entry => entry.fromEventId === "jueves" && entry.toEventId === "sabado");
  assert.equal(pair.allowed, false); assert.equal(pair.dayDifference, 2); assert.equal(pair.fromDate, "2026-12-03");
  assert.equal(pair.releaseDate, "2026-12-04"); assert.equal(pair.fromAt, at(4, 3)); assert.equal(pair.fromOperationalAt, at(3, 10));
  const valid = analyze([events[0], event("viernes", 4, { a: 1 }, { setupAt: at(4, 9) })], inventory({ a: 1 }));
  assert.deepEqual(recommendations(valid), ["jueves>viernes:a=1"]);
  const visible = valid.routePolicy.originComparisons.find(entry => entry.toEventId === "viernes").comparisons[0];
  assert.equal(visible.fromOperationalAt, at(3, 10)); assert.equal(visible.releaseDate, "2026-12-04"); assert.equal(visible.fromAt, at(4, 3));
});

test("el límite persistente tampoco acepta jueves que termina viernes hacia el montaje del sábado", t => {
  const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "kit-origins-calendar-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = Engine.createEquipmentEventStore({ directory, now: () => Date.parse("2026-11-20T12:00:00Z") });
  const events = [event("jueves", 3, { a: 1 }, { endAt: at(4, 2) }), event("sabado", 5, { a: 1 })];
  events.forEach(entry => store.putEvent(entry.id, { event: entry }));
  assert.throws(() => store.putTransfer("salto", { fromEventId: "jueves", toEventId: "sabado", travelMinutes: 30, handlingMinutes: 30, items: [{ warehouseInventoryId: "a", quantity: 1 }] }, "Prueba", inventory({ a: 1 })), /saltar días/);
  assert.equal(store.readTransfers().transfers.length, 0);
});

test("el motor rechaza IDs de evento repetidos antes de sumar inventario y conserva las fuentes intactas", () => {
  const entry = event("mismo", 3, { a: 1 }), stock = inventory({ a: 2 }), before = JSON.stringify({ entry, stock });
  assert.throws(() => Engine.calculateEquipmentAvailability([entry, structuredClone(entry)], stock, options([entry])), /mismo evento más de una vez/);
  assert.equal(JSON.stringify({ entry, stock }), before);
});
