"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Draft = require("../equipment-draft-logistics.js");
const Reporting = require("../equipment-reporting.cjs");

// Only synthetic current inputs. Nothing here loads catalogs or production data.
const now = Date.parse("2026-11-25T12:00:00Z");
function stock(quantities = [2], consumable = false) {
  return { savedAt: "synthetic-current-only", state: { movements: [], items: quantities.map((quantity, index) => ({
    id: `ref-${index}`, name: `${consumable ? "Consumible" : "Equipo"} sintético ${index}`, category: "Pruebas", quantity,
    itemType: consumable ? "consumible" : "equipo"
  })) } };
}
function event(id, day, quantities = [2], extra = {}) {
  const at = (hour, date = day) => `2026-11-${date}T${hour}:00`;
  const items = quantities.map((quantity, index) => ({ id: `${id}-line-${index}`, quantity, description: `Equipo sintético ${index}`,
    warehouseInventoryId: `ref-${index}`, sourceCells: [{ sheet: id, ref: `A${index + 1}`, value: quantity }, { sheet: id, ref: `B${index + 1}`, value: `Equipo sintético ${index}` }] }));
  return { id, status: "draft", name: `Evento ${id}`, place: `Lugar ${id}`, date: `2026-11-${day}`, setupAt: at("08"), startAt: at("10"), endAt: at("18"),
    equipmentInAt: "2026-11-30T12:00", sourceCells: items.flatMap(item => item.sourceCells),
    sections: [{ title: "Categoría literal", notes: ["  Nota que se conserva  "], rows: [{ type: "header", description: "ENCABEZADO ORIGINAL" }], items }], ...extra };
}
function estimates(events) {
  return events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 30, handlingMinutes: 30, distanceKm: 10 })));
}
function analyze(events, inventory, options = {}) { return Draft.analyze(events, inventory, { now, routeEstimates: estimates(events), ...options }); }
function idsFor(plan, from, to) { return plan.candidates.filter(route => route.fromEventId === from && route.toEventId === to).map(route => route.id); }

test("los tres días activos no generan propuestas de primero a tercero, aunque el día intermedio use otra referencia", () => {
  const events = [event("first", "26", [2, 0]), event("middle", "27", [0, 1]), event("last", "28", [2, 0])];
  const plan = analyze(events, stock([2, 1]));
  assert.equal(idsFor(plan, "first", "last").length, 0);
  assert.equal(plan.routePolicy.version, "consecutive-kit-v1");
  assert.ok(plan.operationalCalendar.some(day => day.date === "2026-11-27"));
});

test("un montaje del día siguiente participa aunque su celebración sea un día después, sin duplicar demanda ni fuentes", () => {
  const events = [event("source", "26", [1, 1, 1, 1, 1]), event("target-small", "27", [1, 1, 0, 0, 0]),
    event("target-setup", "28", [1, 1, 1, 1, 0], { setupAt: "2026-11-27T08:00", startAt: "2026-11-28T10:00", endAt: "2026-11-28T18:00" })];
  const inventory = stock([1, 1, 1, 1, 1]), before = JSON.stringify({ events, inventory });
  const plan = analyze(events, inventory);
  assert.ok(idsFor(plan, "source", "target-setup").length > 0);
  const best = plan.routeBundles.find(bundle => bundle.fromEventId === "source" && bundle.toEventId === "target-setup");
  assert.ok(best?.recommended);
  assert.equal(best.sourceCoverage, 0.8);
  assert.equal(plan.events.length, 3);
  assert.equal(plan.rows.reduce((sum, row) => sum + row.demand, 0), 11);
  assert.equal(JSON.stringify({ events, inventory }), before);
  assert.deepEqual(plan.events, events);
  const calendar = plan.operationalCalendar.flatMap(day => day.operations.map(operation => ({ date: day.date, ...operation })));
  assert.ok(calendar.some(operation => operation.eventId === "target-setup" && operation.kind === "setup" && operation.date === "2026-11-27"));
  assert.ok(calendar.some(operation => operation.eventId === "target-setup" && operation.kind === "event" && operation.date === "2026-11-28"));
});

test("la selección de una alternativa distinta del destino principal recalcula la renta usando solamente esa selección", () => {
  const events = [event("source", "26"), event("primary", "27"), event("alternative", "27", [1])], inventory = stock();
  const preview = analyze(events, inventory), ids = idsFor(preview, "source", "alternative");
  assert.equal(ids.length, 1);
  const plan = analyze(events, inventory, { selectedTransferIds: ids });
  assert.deepEqual(plan.selectedTransfers.map(route => route.toEventId), ["alternative"]);
  assert.equal(plan.rows[0].rental, 2);
  assert.equal(plan.rows[0].selectedTransferReduction, 1);
});

test("el manifiesto del camión incluye el destino alternativo elegido y no mezcla el destino automático descartado", async () => {
  const events = [event("source", "26"), event("primary", "27"), event("alternative", "27", [1])], inventory = stock();
  const preview = analyze(events, inventory), selectedTransferIds = idsFor(preview, "source", "alternative");
  const model = Reporting.createEquipmentReportModel({ events, routeEstimates: estimates(events), selectedTransferIds }, inventory, { now });
  const workbook = await Reporting.createEquipmentMasterWorkbook(model), sheet = workbook.getWorksheet("Preparar camión");
  const transfers = sheet.getRows(5, sheet.rowCount - 4).filter(row => row.getCell(3).value === "Trasiego seleccionado");
  assert.equal(transfers.length, 1);
  assert.equal(transfers[0].getCell(2).value, "Lugar alternative");
  assert.equal(transfers[0].getCell(5).value, 1);
  assert.ok(!sheet.getRows(5, sheet.rowCount - 4).some(row => row.getCell(2).value === "Lugar primary"));
});

test("una división requiere confirmación y sólo la división física autorizada reduce el faltante", () => {
  const events = [event("source", "26"), event("left", "27", [1]), event("right", "27", [1])], inventory = stock();
  const preview = analyze(events, inventory), selectedTransferIds = [...idsFor(preview, "source", "left"), ...idsFor(preview, "source", "right")];
  assert.equal(selectedTransferIds.length, 2);
  const denied = analyze(events, inventory, { selectedTransferIds });
  assert.equal(denied.selectedTransfers.length, 0);
  assert.ok(denied.invalidSelections.every(issue => issue.code === "split_confirmation_required"));
  const accepted = analyze(events, inventory, { selectedTransferIds, splitAuthorizedOrigins: ["source"] });
  assert.equal(accepted.invalidSelections.length, 0);
  assert.equal(accepted.selectedTransfers.length, 2);
  assert.equal(accepted.rows[0].required, 2);
  assert.equal(accepted.rows[0].rental, 0);
  assert.deepEqual(accepted.splitAuthorizedOrigins, ["source"]);
});

test("la aprobación de división no permite sobreasignar unidades físicas ni usar orígenes inexistentes", () => {
  const events = [event("source", "26"), event("left", "27"), event("right", "27")], inventory = stock();
  const preview = analyze(events, inventory), selectedTransferIds = [...idsFor(preview, "source", "left"), ...idsFor(preview, "source", "right")];
  const attempted = analyze(events, inventory, { selectedTransferIds, splitAuthorizedOrigins: ["source"] });
  assert.equal(attempted.selectedTransfers.length, 0);
  assert.ok(attempted.invalidSelections.some(issue => issue.code === "physical_conflict"));
  assert.throws(() => analyze(events, inventory, { splitAuthorizedOrigins: ["unknown"] }), /orígenes vigentes/);
  assert.throws(() => analyze(events, inventory, { splitAuthorizedOrigins: ["source", "source"] }), /orígenes vigentes/);
});

test("la cadena de tres días mantiene las mismas dos unidades y editar una pierna recalcula el faltante", () => {
  const events = [event("first", "26"), event("middle", "27"), event("last", "28")], inventory = stock();
  const preview = analyze(events, inventory), selectedTransferIds = [...idsFor(preview, "first", "middle"), ...idsFor(preview, "middle", "last")];
  assert.equal(selectedTransferIds.length, 2);
  const complete = analyze(events, inventory, { selectedTransferIds });
  assert.equal(complete.rows[0].required, 2); assert.equal(complete.rows[0].rental, 0);
  const partial = analyze(events, inventory, { selectedTransferIds, transferEdits: [{ id: selectedTransferIds[1], quantity: 1, note: "Llevar sólo una" }] });
  assert.equal(partial.rows[0].required, 3); assert.equal(partial.rows[0].rental, 1);
  assert.equal(partial.selectedTransfers.find(route => route.id === selectedTransferIds[1]).quantity, 1);
});

test("el HTML breve conserva el plan dividido y Excel mantiene calendario y todas las celdas", async () => {
  const events = [event("source", "26"), event("left", "27", [1]), event("right", "27", [1])], inventory = stock();
  const preview = analyze(events, inventory), selectedTransferIds = [...idsFor(preview, "source", "left"), ...idsFor(preview, "source", "right")];
  const payload = { events, routeEstimates: estimates(events), selectedTransferIds, splitAuthorizedOrigins: ["source"], transferEdits: [{ id: selectedTransferIds[0], quantity: 1, note: "Nota exacta <segura>" }] };
  const model = Reporting.createEquipmentPlanningReportModel(payload, inventory, { now });
  assert.equal(model.transferRoutes.length, 2); assert.equal(model.rows[0].rental, 0);
  const html = Reporting.renderEquipmentPlanningReportHtml(model);
  assert.doesNotMatch(html, /Calendario y comparación entre días consecutivos|Resumen final|Celdas originales/);
  assert.equal((html.match(/class="transfer-card"/g) || []).length, 2);
  assert.match(html, /Evento source · Lugar source → Montaje · Evento left · Lugar left/);
  assert.match(html, /Evento source · Lugar source → Montaje · Evento right · Lugar right/);
  assert.match(html, /jueves 26\/11\/2026 → viernes 27\/11\/2026/);
  assert.match(html, /Nota exacta &lt;segura&gt;/);
  assert.equal(model.counts.sourceCells, 6);
  const master = await Reporting.createEquipmentMasterWorkbook(model);
  assert.equal(master.getWorksheet("Trasiegos elegidos").rowCount - 4, 2);
  assert.equal(master.getWorksheet("Celdas fuente").rowCount - 4, 6);
  assert.ok(master.getWorksheet("Calendario operativo").rowCount > 4);
  assert.ok(master.getWorksheet("Comparativa de destinos").rowCount > 4);
  assert.equal(model.productionMutations, 0);
});

test("los consumibles se acumulan, conservan ceros y nunca aparecen como candidatos de trasiego", () => {
  const inventory = stock([3], true), events = [event("first", "26", [2]), event("middle", "27", [0]), event("last", "28", [4])];
  for (const entry of events) for (const item of entry.sections[0].items) item.description = "Consumible sintético 0";
  const plan = analyze(events, inventory);
  assert.equal(plan.candidates.length, 0); assert.equal(plan.rows[0].demand, 6);
  assert.equal(plan.rows[0].purchase, 3); assert.equal(plan.rows[0].rental, 0);
  assert.equal(plan.events[1].sections[0].items[0].quantity, 0);
});

test("un traslado confirmado que saltaba una fecha se conserva como excepción y no vuelve a proponerse", () => {
  const events = [event("first", "26", [2, 0]), event("middle", "27", [0, 1]), event("last", "28", [2, 0])];
  const inventory = stock([2, 1]), transfer = { id: "confirmed-historical-route", fromEventId: "first", toEventId: "last", status: "confirmed",
    travelMinutes: 30, handlingMinutes: 30, items: [{ warehouseInventoryId: "ref-0", quantity: 2 }] };
  const plan = analyze(events, inventory, { transfers: [transfer] });
  assert.equal(plan.actualTransfers.length, 1);
  assert.equal(plan.actualTransfers[0].id, transfer.id);
  assert.equal(idsFor(plan, "first", "last").length, 0);
  assert.ok(plan.routePolicy.exceptions.length > 0);
  assert.equal(plan.rows.find(row => row.warehouseInventoryId === "ref-0").rental, 0);
});

test("la auditoría de sustitución permanece en renta y Excel, sin extender el documento breve de trasiego", async () => {
  const events = [event("first", "26", [1])], inventory = stock([2]);
  events[0].planEquipmentChanges = [{ type: "manual-compatible-replacement", confirmedAt: "2026-11-25T12:00:00Z",
    operation: { eventId: "first", sectionIndex: 0, itemIndex: 0, replacementInventoryId: "ref-0", quantity: 1,
      compatibilityConfirmed: true, reason: "Revisión técnica aceptada <manual>" },
    before: { description: "Original literal", warehouseInventoryId: "original-id", quantity: 1 },
    after: { description: "Equipo sintético 0", warehouseInventoryId: "ref-0", quantity: 1 } }];
  const before = JSON.stringify(events), model = Reporting.createEquipmentPlanningReportModel({ events }, inventory, { now });
  const html = Reporting.renderEquipmentPlanningReportHtml(model, "rent");
  assert.match(html, /Original literal/); assert.match(html, /Revisión técnica aceptada &lt;manual&gt;/);
  assert.doesNotMatch(Reporting.renderEquipmentPlanningReportHtml(model), /Original literal|Revisión técnica aceptada|Sustituciones aceptadas/);
  const master = await Reporting.createEquipmentMasterWorkbook(model);
  assert.equal(master.getWorksheet("Sustituciones aceptadas").getRow(5).getCell(3).value, "Original literal");
  assert.equal(model.counts.sourceCells, 2); assert.equal(JSON.stringify(events), before);
});

test("la auditoría conserva descripción y cantidad de líneas originales en formato de arreglo y muestra fechas legibles", async () => {
  const Changes = require("../equipment-draft-substitutions.js"), inventory = stock([2, 2]), original = [event("first", "26", [1])];
  original[0].sections[0].items[0] = [1, "Equipo sintético 0"];
  const events = Changes.replace(original, { eventId: "first", sectionIndex: 0, itemIndex: 0, replacementInventoryId: "ref-1",
    quantity: 1, compatibilityConfirmed: true, reason: "Reemplazo compatible confirmado." }, inventory, { at: "2026-11-25T12:00:00Z" });
  const model = Reporting.createEquipmentPlanningReportModel({ events }, inventory, { now }), master = await Reporting.createEquipmentMasterWorkbook(model);
  const audit = master.getWorksheet("Sustituciones aceptadas").getRow(5);
  assert.equal(audit.getCell(3).value, "Equipo sintético 0"); assert.equal(audit.getCell(5).value, 1);
  assert.equal(audit.getCell(6).value, "Equipo sintético 1");
  const visible = Reporting.renderEquipmentPlanningReportHtml(model, "rent").split('<details class="source-appendix')[0];
  assert.doesNotMatch(visible, /2026-11-\d\dT/);
  assert.match(visible, /26 de noviembre de 2026/);
  assert.deepEqual(events[0].sourceCells, original[0].sourceCells);
});

test("una reserva vigente fuera del plan impide declarar renta cero sin añadir eventos ni demanda externa", () => {
  const events = [event("source", "26", [1, 1]), event("destination", "27", [1, 1])], inventory = stock([1, 1]);
  const outside = event("outside-current", "27", [1, 0], { status: "confirmed" });
  const routeEstimates = estimates(events), preview = Reporting.createEquipmentReportModel({ events, routeEstimates }, inventory, { now });
  const selectedTransferIds = preview.draftLogistics.candidates.map(route => route.id);
  const before = JSON.stringify({ events, inventory, outside });
  const model = Reporting.createEquipmentReportModel({ events, routeEstimates, selectedTransferIds }, inventory, { now, storedEvents: [outside] });
  const blocked = model.rows.find(row => row.warehouseInventoryId === "ref-0"), independent = model.rows.find(row => row.warehouseInventoryId === "ref-1");
  assert.equal(blocked.rental, null); assert.equal(blocked.hardBlocked, true);
  assert.match(blocked.reason, /Hay reservas vigentes fuera de este plan/);
  assert.equal(independent.rental, 0, "A verifiable rejected route must not turn unrelated references into unknown inventory");
  assert.equal(independent.hardBlocked, false);
  assert.equal(model.draftLogistics.candidates.filter(route => route.warehouseInventoryId === "ref-0").length, 0);
  assert.equal(model.draftLogistics.selectedTransfers.filter(route => route.warehouseInventoryId === "ref-0").length, 0);
  assert.ok(model.draftLogistics.invalidSelections.some(issue => issue.code === "inventory_context_required" && issue.rowId === blocked.id));
  assert.equal(model.externalReservationConflicts.length, 1);
  assert.equal(model.draftLogistics.externalReservationConflicts.length, 1);
  assert.equal(model.counts.events, 2); assert.equal(model.counts.equipmentRows, 4); assert.equal(model.counts.sourceCells, 8);
  assert.equal(blocked.demand, 2); assert.deepEqual(model.originalEvents, events);
  assert.ok(model.pending.some(entry => /reservas vigentes fuera/.test(entry.reason)));
  assert.equal(JSON.stringify({ events, inventory, outside }), before); assert.equal(model.productionMutations, 0);
});

test("reservas externas sin solapamiento, borradores y cantidades cero no bloquean el plan numérico", () => {
  const events = [event("source", "26", [1]), event("destination", "27", [1])], inventory = stock([1]);
  const routeEstimates = estimates(events), preview = Reporting.createEquipmentReportModel({ events, routeEstimates }, inventory, { now });
  const selectedTransferIds = preview.draftLogistics.candidates.map(route => route.id);
  for (const outside of [event("later", "30", [1], { status: "confirmed", setupAt: "2026-12-02T08:00", startAt: "2026-12-02T10:00", endAt: "2026-12-02T18:00", equipmentInAt: "2026-12-03T12:00" }),
    event("earlier", "25", [1], { status: "confirmed", equipmentInAt: "2026-11-25T20:00" }),
    event("zero", "27", [0], { status: "confirmed" }), event("draft", "27", [1]), event("cancelled", "27", [1], { status: "cancelled" })]) {
    const model = Reporting.createEquipmentReportModel({ events, routeEstimates, selectedTransferIds }, inventory, { now, storedEvents: [outside] });
    assert.equal(model.rows[0].rental, 0, outside.id); assert.equal(model.rows[0].hardBlocked, false, outside.id);
    assert.equal(model.externalReservationConflicts.length, 0, outside.id); assert.equal(model.counts.events, 2);
  }
});

test("una reserva externa con horarios pendientes conserva la incertidumbre sin inventar disponibilidad", () => {
  const events = [event("source", "26", [1])], inventory = stock([1]);
  const outside = event("pending-outside", "27", [1], { status: "confirmed", setupAt: "", equipmentInAt: "" });
  const model = Reporting.createEquipmentReportModel({ events }, inventory, { now, storedEvents: [outside] });
  assert.equal(model.rows[0].rental, null); assert.equal(model.rows[0].hardBlocked, true);
  assert.equal(model.externalReservationConflicts.length, 1); assert.equal(model.counts.events, 1);
});
