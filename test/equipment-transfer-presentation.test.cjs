"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm");
const Draft = require("../equipment-draft-logistics.js");
const Presentation = require("../equipment-transfer-presentation.js");
const Reporting = require("../equipment-reporting.cjs");
const clone = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const names = { a: "Consola <analógica>", b: "Luz original", c: "Cable original", d: "Base original", e: "Equipo que sobra", zero: "Cero original", other: "Otra referencia", supply: "Consumible actual" };
  const inventory = { savedAt: "fuente-sintética-vigente", state: { movements: [], items: Object.entries(names).map(([id, name]) => ({ id, name, quantity: 10, itemType: id === "supply" ? "consumible" : "equipo" })) } };
  const event = (id, day, quantities, extra = {}) => ({ id, client: `Cliente ${id}`, name: `Evento ${id}`, place: `Sede ${id}`, date: `2026-11-${day}`,
    setupAt: `2026-11-${day}T08:00`, startAt: `2026-11-${day}T12:00`, endAt: `2026-11-${day}T20:00`, equipmentInAt: "2026-11-30T10:00",
    sourceCells: [{ sheet: id, ref: "A1", value: 0 }, { sheet: id, ref: "B1", value: "Nota <literal> conservada" }],
    sections: [{ title: "Categoría intacta", rows: [{ type: "note", description: "Observación literal" }], items: Object.entries(quantities).map(([id, quantity]) => ({ warehouseInventoryId: id, description: names[id], quantity })) }], ...extra });
  const events = [event("origen", 26, { a: 1, b: 2, c: 3, d: 4, e: 1, zero: 0, supply: 2 }),
    event("montaje", 27, { a: 1, b: 2, c: 3, d: 4, zero: 0, supply: 1 }, { client: 'Destino <script>alert("x")</script>', startAt: "2026-11-28T12:00", endAt: "2026-11-28T20:00", date: "2026-11-28" }),
    event("parcial-a", 27, { a: 1 }), event("parcial-b", 27, { b: 2 }), event("otro-a", 28, { other: 1 }), event("otro-b", 28, { other: 1 })];
  const routeEstimates = events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 30, handlingMinutes: 30, distanceKm: 10 })));
  return { events, inventory, routeEstimates, now: Date.parse("2026-11-25T12:00Z") };
}
function analyze(input, extra = {}) { return Draft.analyze(input.events, input.inventory, { routeEstimates: input.routeEstimates, now: input.now, ...extra }); }
function report(input, extra = {}) { return Reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates: input.routeEstimates, ...extra }, input.inventory, { now: input.now }); }

test("seis eventos producen solo la recomendación dominante, su día de montaje y dos listas", () => {
  const input = fixture(), before = clone(input), plan = analyze(input), planBefore = clone(plan), view = Presentation.build(plan);
  assert.equal(view.eventCount, 6); assert.equal(view.cards.length, 1);
  const card = view.cards[0];
  assert.equal(card.fromEventId, "origen"); assert.equal(card.toEventId, "montaje");
  assert.equal(card.fromDayLabel, "jueves 26/11/2026"); assert.equal(card.toDayLabel, "viernes 27/11/2026");
  assert.equal(card.percentage, 80); assert.equal(card.percentageLabel, "80%");
  assert.match(card.toLabel, /^Montaje · Destino/);
  assert.deepEqual(card.usedItems.map(item => [item.warehouseInventoryId, item.quantity]), [["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
  assert.deepEqual(card.unusedItems, [{ warehouseInventoryId: "e", description: "Equipo que sobra", quantity: 1 }]);
  assert.deepEqual(input, before); assert.deepEqual(clone(plan), planBefore);
  assert.equal(plan.rows.find(row => row.warehouseInventoryId === "zero").demand, 0);
  assert.equal(plan.rows.find(row => row.warehouseInventoryId === "supply").demand, 3);
});

test("la selección parcial muestra exactamente lo elegido y no vuelve a añadir lo recomendado", () => {
  const input = fixture(), preview = analyze(input), first = preview.candidates.find(route => route.fromEventId === "origen" && route.toEventId === "montaje" && route.warehouseInventoryId === "b");
  const selected = analyze(input, { selectedTransferIds: [first.id], transferEdits: [{ id: first.id, quantity: 1 }] });
  const view = Presentation.build(selected);
  assert.equal(view.cards.length, 1); assert.equal(view.cards[0].status, "selected");
  assert.deepEqual(view.cards[0].usedItems.map(item => [item.warehouseInventoryId, item.quantity]), [["b", 1]]);
  assert.deepEqual(view.cards[0].unusedItems.map(item => item.warehouseInventoryId), ["e"], "una referencia compartida sin marcar no se anuncia como no requerida");
  assert.equal(view.cards[0].percentage, preview.routeBundles.find(bundle => bundle.toEventId === "montaje" && bundle.fromEventId === "origen").sourceCoverage * 100);
});

test("la vista nunca convierte una ruta día uno a tres ni un solapamiento en recomendación", () => {
  const input = fixture(), plan = analyze(input), bundle = plan.routeBundles.find(bundle => bundle.recommended);
  const tooLate = clone(plan); tooLate.events.find(event => event.id === "montaje").setupAt = "2026-11-28T08:00";
  assert.equal(Presentation.build(tooLate).cards.length, 0);
  const blocked = clone(plan); blocked.routeBundles.find(entry => entry.id === bundle.id).timing.feasible = false;
  assert.equal(Presentation.build(blocked).cards.length, 0);
  assert.match(Presentation.build(blocked).pendingMessage, /No hay un trasiego recomendado verificable/);
});

test("una condición de viaje usa los vectores físicos sin inventar prioridad ante un empate", () => {
  const input = fixture(), plan = analyze(input), bundle = plan.routeBundles.find(bundle => bundle.recommended);
  bundle.recommended = false; bundle.status = "review"; bundle.timing.requiresTimeConfirmation = true;
  const before = clone(plan), view = Presentation.build(plan);
  assert.equal(view.cards.length, 1); assert.equal(view.cards[0].status, "verify");
  assert.match(view.cards[0].recommendation, /verificar traslado/);
  assert.deepEqual(clone(plan), before);
  const alternative = plan.routeBundles.find(entry => entry.fromEventId === "origen" && entry.toEventId === "parcial-a");
  alternative.comparison.transferableVector = clone(bundle.comparison.transferableVector);
  alternative.comparison.additionalVector = clone(bundle.comparison.additionalVector);
  const alternativePair = plan.routePolicy.pairs.find(entry => entry.fromEventId === "origen" && entry.toEventId === "parcial-a");
  alternativePair.transferableVector = clone(bundle.comparison.transferableVector);
  alternativePair.additionalVector = clone(bundle.comparison.additionalVector);
  assert.equal(Presentation.build(plan).cards.length, 0, "no se inventa prioridad entre alternativas ambiguas");
});

test("sin viaje confirmado se puede leer la propuesta única pero no se elige ni descuenta renta", () => {
  const input = fixture(), plan = analyze(input, { routeEstimates: [] }), before = clone(plan);
  assert.equal(plan.selectedTransfers.length, 0);
  const view = Presentation.build(plan), card = view.cards.find(card => card.fromEventId === "origen");
  assert.ok(card); assert.equal(card.toEventId, "montaje"); assert.equal(card.status, "verify"); assert.equal(card.needsVerification, true);
  assert.equal(card.percentage, 80); assert.equal(card.usedItems.length, 4);
  assert.deepEqual(clone(plan), before); assert.equal(plan.selectedTransfers.length, 0);
});

test("sin horas verificables hay un aviso condensado, sin listas de equipos pendientes", () => {
  const input = fixture(); input.events.forEach(event => { event.startAt = ""; event.endAt = ""; });
  const plan = analyze(input), view = Presentation.build(plan);
  assert.equal(view.eventCount, 6); assert.deepEqual(view.cards, []);
  assert.equal(typeof view.pendingMessage, "string"); assert.ok(view.pendingMessage.length < 180);
  assert.equal(view.pendingItems, undefined);
});

test("el mismo helper funciona en navegador sin requerir el motor ni modificar fuentes", () => {
  const context = vm.createContext({ Intl, Date, Map, Set });
  vm.runInContext(fs.readFileSync(require.resolve("../equipment-transfer-presentation.js"), "utf8"), context);
  const plan = analyze(fixture());
  assert.deepEqual(JSON.parse(JSON.stringify(context.EquipmentTransferPresentation.build(plan))), Presentation.build(plan));
});

test("HTML de trasiego omite resúmenes y apéndices, conserva el máster y escapa las etiquetas", async () => {
  const input = fixture(), before = clone(input), model = report(input), source = clone(model.sourceCells);
  const markup = Reporting.renderEquipmentPlanningReportHtml(model, "transfer");
  assert.match(markup, /6 eventos analizados/); assert.match(markup, /Coincidencia de equipo: <strong>80%/);
  assert.match(markup, /jueves 26\/11\/2026/); assert.match(markup, /viernes 27\/11\/2026/);
  assert.match(markup, /Equipo que se utilizará/); assert.match(markup, /Equipo que no se utilizará en el destino/);
  assert.match(markup, /Destino &lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup, /<script|Resumen final|Resumen de equipo|Resumen de trasiego|Datos por revisar|Eventos incluidos|Calendario y comparación|Comparativa|Celdas originales|Renta con|Compra por|archivo original completo|Fuente!|Observación literal/);
  assert.equal(Reporting.renderEquipmentTransferReportHtml(model), markup);
  assert.equal(Reporting.renderEquipmentReportHtml(model, "transfer"), markup);
  const workbook = await Reporting.createEquipmentMasterWorkbook(model);
  for (const name of ["Celdas fuente", "Filas originales", "Comparativa de orígenes", "Resumen de equipo", "Detalle por evento", "Renta provisional", "Compra provisional"]) assert.ok(workbook.getWorksheet(name), name);
  assert.equal(model.counts.events, 6); assert.equal(model.counts.zeroQuantityRows, 2);
  assert.deepEqual(model.sourceCells, source); assert.deepEqual(input, before);
  assert.match(Reporting.renderEquipmentPlanningReportHtml(model, "rent"), /Resumen final: equipo físico/);
  assert.match(Reporting.renderEquipmentPlanningReportHtml(model, "purchase"), /Consumo por evento y compra necesaria/);
});
