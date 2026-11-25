"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Draft = require("../equipment-draft-logistics.js");
const { harness, fixtureEvents, fixtureInventory, flush, deferred, response } = require("./helpers/equipment-draft-transfer-harness.cjs");

const copy = value => JSON.parse(JSON.stringify(value));
const NOW = Date.parse("2026-11-23T12:00:00Z");
const at = hour => `2026-11-25T${String(Math.floor(hour)).padStart(2, "0")}:${hour % 1 ? "30" : "00"}`;
const literalCells = id => [
  { ref: `synthetic:${id}:A1`, address: "A1", value: 0, note: "  Nota literal con espacios  " },
  { ref: `synthetic:${id}:B1`, address: "B1", value: "REFERENCIA ORIGINAL" }
];
function line(id, quantity, extra = {}) {
  return { id: `line-${id}`, warehouseInventoryId: id, description: `Referencia sintética ${id}`, quantity, ...extra };
}
function event(id, setup, end, items, extra = {}) {
  return { id, name: `Evento sintético ${id}`, place: `Sede ${id}`, date: "2026-11-25", setupApplies: true,
    setupAt: at(setup), startAt: at(setup + 0.5), endAt: at(end), equipmentInAt: "2026-11-26T12:00",
    coordinates: { lat: 14.6 + (id === "E" ? 0.01 : 0), lng: -90.5 },
    mapUrl: `https://www.google.com/maps?q=${14.6 + (id === "E" ? 0.01 : 0)},-90.5`,
    sourceCells: literalCells(id), sourceImport: { fileName: "Prueba sintética actual.xlsx", sourceCells: literalCells(id) },
    sections: [{ id: `section-${id}`, title: "  Categoría literal  ", notes: ["  Sin modificar  "],
      rows: [{ type: "note", description: "Encabezado literal" }, { type: "item", quantity: 0, description: "Cero literal" }],
      items: [...items, line("zero", 0)] }], ...extra };
}
function inventory(quantities = { console: 2, speaker: 4, lamp: 1, supply: 3, zero: 0 }) {
  return { savedAt: "synthetic-current", state: { items: Object.entries(quantities).map(([id, quantity]) => ({ id,
    name: `Referencia sintética ${id}`, category: "Pruebas", itemType: id === "supply" ? "consumible" : "equipo", quantity })), movements: [] } };
}
function estimates(events, minutes = 30) {
  return events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place,
    travelMinutes: minutes, handlingMinutes: 30, distanceKm: Math.abs((from.coordinates?.lat || 0) - (to.coordinates?.lat || 0)) * 111 })));
}
function fixture() {
  return [event("B", 8, 10, [line("console", 2), line("speaker", 4), line("supply", 3)]),
    event("E", 14, 16, [line("console", 2), line("speaker", 4), line("lamp", 1), line("supply", 3)])];
}
function analyze(events, stock = inventory(), options = {}) {
  return Draft.analyze(events, stock, { now: NOW, routeEstimates: estimates(events), ...options });
}
const row = (plan, id) => plan.rows.find(entry => entry.warehouseInventoryId === id);
const bundle = (plan, from = "B", to = "E") => (plan.routeBundles || []).find(entry => entry.fromEventId === from && entry.toEventId === to);
const readyIds = plan => plan.candidates.filter(candidate => !candidate.requiresManualReview).map(candidate => candidate.id);

test("un kit B → E recomienda el mismo equipo y cuantifica la precarga sin duplicar demanda ni inventario", () => {
  const events = fixture(), stock = inventory(), originalEvents = JSON.stringify(events), originalStock = JSON.stringify(stock);
  const base = analyze(events, stock), route = bundle(base);
  assert.ok(route, "se necesita la recomendación agrupada de origen y destino");
  assert.equal(route.status, "ready"); assert.equal(route.preloadsApplied, false);
  assert.equal(route.commonItems.find(item => item.warehouseInventoryId === "console").quantity, 2);
  assert.equal(route.commonItems.find(item => item.warehouseInventoryId === "speaker").quantity, 4);
  const extra = route.preloadItems.find(item => item.warehouseInventoryId === "lamp");
  assert.ok(extra); assert.equal(extra.quantity, 1); assert.equal(extra.validated, false); assert.equal(extra.inventoryChecked, true);
  assert.ok(!route.commonItems.some(item => ["supply", "zero"].includes(item.warehouseInventoryId)));
  assert.ok(!route.preloadItems.some(item => ["supply", "zero"].includes(item.warehouseInventoryId)));
  assert.equal(row(base, "console").demand, 4); assert.equal(row(base, "console").rental, 2);
  const selected = analyze(events, stock, { selectedTransferIds: readyIds(base) });
  assert.equal(row(selected, "console").rental, 0); assert.equal(row(selected, "speaker").rental, 0);
  assert.equal(row(selected, "lamp").demand, 1); assert.equal(row(selected, "lamp").rental, 0);
  assert.equal(row(selected, "supply").purchase, 3); assert.equal(row(base, "supply").purchase, 3);
  assert.equal(JSON.stringify(events), originalEvents); assert.equal(JSON.stringify(stock), originalStock);
});

test("la precarga no usa una unidad ocupada durante B aunque vuelva a bodega antes de E", () => {
  const events = fixture(); events.push(event("C", 6, 7, [line("lamp", 1)], { equipmentInAt: at(11) }));
  const plan = analyze(events), route = bundle(plan);
  assert.ok(route); assert.equal(row(plan, "lamp").rental, 0, "la unidad puede servir E tras volver y prepararse");
  const extra = route.preloadItems.find(item => item.warehouseInventoryId === "lamp");
  assert.equal(extra?.quantity || 0, 0, "no puede salir con B a las 08:00 mientras sigue fuera en C");
  const otherTruck = bundle(plan, "C", "E");
  assert.ok(otherTruck?.recommended && otherTruck.commonItems.some(item => item.warehouseInventoryId === "lamp" && item.ownTransferQuantity === 1), "la lámpara se cubre desde C, donde sí está físicamente disponible para salir");
  assert.ok(!route.missingItems.some(item => item.warehouseInventoryId === "lamp"), "no se duplica la preparación de una referencia cubierta por otro origen recomendado");
});

test("cantidades de trasiego editadas conservan el ID y renta sólo lo que realmente falta", () => {
  const events = fixture(), stock = inventory(), base = analyze(events, stock);
  const consoleTransfer = base.candidates.find(candidate => candidate.warehouseInventoryId === "console");
  assert.ok(consoleTransfer); assert.equal(consoleTransfer.quantity, 2); assert.equal(consoleTransfer.maxQuantity, 2);
  const partial = analyze(events, stock, { selectedTransferIds: [consoleTransfer.id], transferEdits: [{ id: consoleTransfer.id, quantity: 1, note: "  Cargar sólo una unidad  " }] });
  assert.equal(partial.candidates.find(candidate => candidate.id === consoleTransfer.id).maxQuantity, 2);
  assert.equal(partial.selectedTransfers.find(candidate => candidate.id === consoleTransfer.id).quantity, 1);
  assert.equal(row(partial, "console").rental, 1); assert.equal(row(partial, "console").demand, 4);
  assert.equal(row(partial, "supply").purchase, 3);
  const removed = analyze(events, stock, { selectedTransferIds: [consoleTransfer.id], transferEdits: [{ id: consoleTransfer.id, quantity: 0 }] });
  assert.equal(row(removed, "console").rental, 2); assert.ok(!removed.selectedTransfers.some(candidate => candidate.id === consoleTransfer.id));
  for (const quantity of [-1, 3, NaN, Infinity]) assert.throws(() => analyze(events, stock, {
    selectedTransferIds: [consoleTransfer.id], transferEdits: [{ id: consoleTransfer.id, quantity }] }), /cantidad|válid|máxim|existenc|trasiego/i);
});

test("ni Maps ni coordenadas inventan minutos confirmados y un solapamiento impide la ruta", () => {
  const events = fixture(), unreviewed = analyze(events, inventory(), { routeEstimates: [] });
  assert.ok(unreviewed.candidates.every(candidate => candidate.requiresManualReview));
  assert.ok(!(unreviewed.routeBundles || []).some(route => route.recommended && route.status === "ready"));
  const overlapping = fixture(); overlapping[1].setupAt = at(9); overlapping[1].startAt = at(9.5);
  const plan = analyze(overlapping);
  assert.ok(!plan.candidates.some(candidate => candidate.fromEventId === "B" && candidate.toEventId === "E"));
  assert.ok(!(plan.routeBundles || []).some(route => route.fromEventId === "B" && route.toEventId === "E" && route.recommended && route.status === "ready"));
  assert.equal(row(plan, "console").rental, 2);
});

test("sin coordenadas ni distancia de dos sedes distintas la cercanía queda por verificar", () => {
  const events = fixture().map(event => { const result = copy(event); delete result.coordinates; delete result.mapUrl; return result; });
  const plan = analyze(events, inventory(), { routeEstimates: [{ fromPlace: events[0].place, toPlace: events[1].place, travelMinutes: 30, handlingMinutes: 30 }] });
  const route = bundle(plan); assert.ok(route); assert.equal(route.status, "review");
  assert.equal(route.proximity.distanceKm, null); assert.equal(route.recommended, false);
  assert.ok(route.preloadItems.every(item => item.quantity === 0 && !item.inventoryChecked));
});

test("una unidad origen no abastece dos destinos simultáneos y las precargas recomendadas comparten una sola existencia", () => {
  const stock = inventory({ console: 1, speaker: 1, lamp: 1, supply: 0, zero: 0 });
  const events = [event("B", 8, 10, [line("console", 1)]), event("C", 8, 10, [line("speaker", 1)]),
    event("E", 14, 16, [line("console", 1), line("lamp", 1)]), event("F", 14, 16, [line("speaker", 1), line("lamp", 1)])];
  const base = analyze(events, stock);
  const all = analyze(events, stock, { selectedTransferIds: readyIds(base) });
  assert.equal(row(all, "console").rental, 0); assert.equal(row(all, "speaker").rental, 0);
  assert.equal(row(all, "lamp").rental, 1);
  const reserved = (base.routeBundles || []).filter(route => route.recommended).flatMap(route => route.preloadItems || [])
    .filter(item => item.warehouseInventoryId === "lamp").reduce((sum, item) => sum + item.quantity, 0);
  assert.ok(reserved <= 1, `se recomendó precargar ${reserved} con existencia 1`);
  const oneOrigin = [event("B", 8, 10, [line("console", 1)]), event("E", 14, 16, [line("console", 1)]),
    event("F", 14, 16, [line("console", 1)])];
  const proposal = analyze(oneOrigin, stock), refused = analyze(oneOrigin, stock, { selectedTransferIds: readyIds(proposal) });
  assert.equal(refused.selectedTransfers.filter(route => route.fromEventId === "B").length, 0, "una división no aceptada no reduce renta");
  assert.ok(refused.invalidSelections.some(entry => entry.code === "split_confirmation_required"));
  const firstDestination = proposal.candidates.find(route => route.fromEventId === "B" && route.toEventId === "E");
  assert.ok(firstDestination);
  const picked = analyze(oneOrigin, stock, { selectedTransferIds: [firstDestination.id] });
  assert.equal(picked.selectedTransfers.filter(route => route.fromEventId === "B").reduce((sum, route) => sum + route.quantity, 0), 1);
  assert.equal(row(picked, "console").rental, 1);
  const excessive = analyze(oneOrigin, stock, { selectedTransferIds: readyIds(proposal), splitAuthorizedOrigins: ["B"] });
  assert.ok(excessive.selectedTransfers.filter(route => route.fromEventId === "B").reduce((sum, route) => sum + route.quantity, 0) <= 1,
    "aceptar dividir no autoriza duplicar la única unidad física");
  assert.ok(excessive.invalidSelections.length > 0);
});

test("equipo coincidente conserva su puntuación y el viaje verificado desempata sin depender del orden del archivo", () => {
  const stock = inventory({ console: 1, zero: 0 });
  const events = [event("B", 8, 10, [line("console", 1)]), event("E", 14, 16, [line("console", 1)]),
    event("F", 14, 16, [line("console", 1)], { coordinates: { lat: 15.6, lng: -91.5 }, mapUrl: "https://maps.google.com/?q=15.6,-91.5" })];
  const reviewedRoutes = estimates(events).map(route => ({ ...route,
    travelMinutes: route.fromPlace === "Sede B" && route.toPlace === "Sede F" ? 120 : 30 }));
  const first = analyze(events, stock, { routeEstimates: reviewedRoutes }), reversed = analyze([...events].reverse(), stock, { routeEstimates: reviewedRoutes });
  assert.equal(row(first, "console").baselineRequired, row(reversed, "console").baselineRequired);
  const near = bundle(first, "B", "E"), far = bundle(first, "B", "F");
  assert.ok(near && far); assert.ok(near.proximity.distanceKm < far.proximity.distanceKm);
  assert.equal(near.score, far.score, "el porcentaje del mismo kit no se altera por distancia ni puntuaciones ocultas");
  assert.equal(near.recommended, true, "el viaje confirmado más corto desempata el mismo kit y preparación adicional");
  assert.equal(far.recommended, false);
  assert.deepEqual(first.routePolicy.primaryDestinations, reversed.routePolicy.primaryDestinations);
  assert.ok(first.candidates.some(route => route.fromEventId === "B" && route.toEventId === "E"));
});

test("cancelar la confirmación conserva borrador editable, aceptar aplica una sola vez y no toca el inventario", async () => {
  const h = harness(), beforeEvents = JSON.stringify(h.events()), beforeStock = JSON.stringify(h.stock());
  await h.api.show(); await h.openEditor();
  const quantity = h.get('[data-draft-quantity="0"]'); assert.ok(quantity); quantity.value = "1";
  const note = h.get('[data-draft-note="0"]'); assert.ok(note); note.value = "  Nota editada del trasiego  ";
  await h.click('[data-draft-save-edit="0"]');
  assert.equal(h.updates.length, 0); assert.equal(h.api.selection().selectedTransferIds.length, 0);
  await h.click("[data-draft-apply]"); assert.ok(h.get("[data-draft-confirm-accept]"));
  await h.click("[data-draft-confirm-cancel]");
  assert.equal(h.updates.length, 0); assert.equal(JSON.stringify(h.events()), beforeEvents);
  assert.equal(h.get('[data-draft-quantity="0"]').value, "1");
  await h.click("[data-draft-apply]"); await h.click("[data-draft-confirm-accept]");
  assert.equal(h.updates.length, 1); assert.equal(h.api.isOpen(), false); assert.equal(JSON.stringify(h.stock()), beforeStock);
  const options = h.api.requestOptions(); assert.equal(options.transferEdits.length, 1); assert.equal(options.transferEdits[0].quantity, 1);
  assert.match(options.transferEdits[0].note, /Nota editada/);
  assert.ok(h.calls.every(call => call.url === "/api/cuadros-equipo/reportes/provisional" && call.body.mode === "plan"));
});

test("cerrar con X una edición de Maps no mantiene cambios ni selección", async () => {
  const h = harness(), before = JSON.stringify(h.events()); await h.api.show(); await h.openEditor();
  const map = h.get('[data-draft-event="0"][data-draft-field="mapUrl"]'); assert.ok(map);
  map.value = "https://www.google.com/maps?q=14.6,-90.5"; await h.click("[data-draft-recalculate]");
  await h.click("[data-draft-apply]"); await h.click("[data-draft-confirm-close]");
  assert.equal(h.updates.length, 0); assert.equal(h.api.isOpen(), true);
  await h.click("[data-draft-close]");
  assert.equal(h.api.isOpen(), false); assert.equal(JSON.stringify(h.events()), before);
  assert.equal(h.api.selection().selectedTransferIds.length, 0);
});

test("una respuesta de aceptar tras cerrar no puede confirmar el plan de otra ventana", async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await h.click("[data-draft-apply]");
  const gate = deferred(); h.responses.push(gate.promise);
  const accepting = h.get("[data-draft-confirm-accept]").emit("click"); await flush(); const request = h.calls.at(-1);
  h.api.close(); await h.api.show(); await h.openEditor(); const newModal = h.modal();
  gate.resolve(response(h.planFor(request))); await accepting; await flush();
  assert.equal(h.updates.length, 0); assert.equal(h.modal(), newModal); assert.equal(h.api.isOpen(), true);
  assert.equal(h.api.selection().selectedTransferIds.length, 0);
});

test("un pin de Maps editado no sigue calculando la distancia con las coordenadas anteriores", async () => {
  const events = fixtureEvents().map(event => ({ ...event, mapUrl: "https://www.google.com/maps?q=14.6,-90.5", location: { lat: 14.6, lng: -90.5 } }));
  const h = harness({ events }); await h.api.show(); await h.openEditor();
  h.get('[data-draft-event="0"][data-draft-field="mapUrl"]').value = "https://www.google.com/maps?q=14.7,-90.6";
  await h.click("[data-draft-recalculate]");
  const current = h.calls.at(-1).body.events[0];
  assert.match(current.mapUrl, /14\.7,-90\.6/);
  assert.ok(!current.location || current.location.lat === 14.7, "no debe viajar la coordenada vieja como evidencia activa");
  assert.ok(!current.coordinates || current.coordinates.lat === 14.7);
  assert.ok(h.get("[data-draft-route]")); assert.equal(h.updates.length, 0);
  await h.click("[data-draft-close]"); assert.deepEqual(h.events(), events);
});

test("editar o reservar un evento desde otra ventana invalida la confirmación antes de aplicar", async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await h.click("[data-draft-apply]");
  const events = h.events(); events[0].place = "Sede corregida en otra ventana"; h.setEvents(events);
  const calls = h.calls.length; await h.click("[data-draft-confirm-accept]");
  assert.equal(h.updates.length, 0); assert.equal(h.calls.length, calls);
  assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.api.isOpen(), true);
  assert.match(h.get("[data-draft-status]").textContent, /cambiaron|actuales/);
  assert.equal(h.events()[0].place, "Sede corregida en otra ventana");
});

test("un cambio de inventario mientras el servidor valida nunca publica la renta reducida anterior", async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await h.click("[data-draft-apply]");
  const gate = deferred(); h.responses.push(gate.promise);
  const accepting = h.get("[data-draft-confirm-accept]").emit("click"); await flush(); const request = h.calls.at(-1);
  const oldResponse = response(h.planFor(request)); h.setStock(fixtureInventory(1));
  gate.resolve(oldResponse); await accepting; await flush();
  assert.equal(h.updates.length, 0); assert.equal(h.api.result(), null); assert.equal(h.api.selection().selectedTransferIds.length, 0);
  assert.equal(h.api.isOpen(), true); assert.match(h.get("[data-draft-status]").textContent, /inventario|cambiaron/);
});

test("la recomendación distingue la demanda compartida de unidades propias y distancia vial indicada", async () => {
  const h = harness({ quantity: 1, estimates: [{ fromPlace: "Sede sintética", toPlace: "Sede sintética", travelMinutes: 15, handlingMinutes: 30, distanceKm: 9 }] });
  await h.api.show(); await h.openEditor();
  const content = h.get("[data-draft-edit-routes]").textContent;
  assert.match(content, /Propio propuesto: 1/); assert.match(content, /Elegido: 1/);
  assert.match(content, /9\.0 km · distancia indicada/);
  assert.doesNotMatch(content, /9\.0 km · distancia en línea recta/);
  assert.equal(h.updates.length, 0); assert.ok(h.calls.at(-1).body.selectedTransferIds.length > 0);
});
