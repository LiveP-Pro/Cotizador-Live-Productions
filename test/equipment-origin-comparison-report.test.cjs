"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Reporting = require("../equipment-reporting.cjs");
const ExcelJS = require("exceljs");
const clone = (value) => JSON.parse(JSON.stringify(value));
const now = Date.parse("2026-11-25T12:00:00Z");
function fixture() {
  const inventory = { savedAt: "synthetic-current-only", state: { movements: [], items: Array.from({ length: 5 }, (_, index) => ({ id: `synthetic-${index}`, name: `Equipo de prueba ${index}`, category: "Prueba", quantity: 3, itemType: "equipo" })) } };
  const event = (id, place, quantities, extra = {}) => ({ id, status: "draft", name: `Nombre variable ${id}`, place, date: "2026-11-26", setupAt: "2026-11-26T08:00", startAt: "2026-11-26T16:00", endAt: "2026-11-26T23:00", equipmentInAt: "2026-11-29T09:00",
    sourceCells: [{ sheet: id, ref: `${id}!A1`, value: "Encabezado literal" }, { sheet: id, ref: `${id}!A2`, value: 0 }],
    sections: [{ title: "Prueba", rows: [{ type: "note", description: "Nota original" }], items: quantities.map((quantity, index) => ({ id: `${id}-${index}`, warehouseInventoryId: `synthetic-${index}`, description: `Equipo de prueba ${index}`, quantity })) }], ...extra });
  const events = [event("small-a", "Sitio pequeño A", [1, 0, 0, 0, 0]), event("small-b", "Sitio pequeño B", [0, 1, 0, 0, 0]),
    event("whole-kit", "Sitio grande <ruta>", [1, 1, 1, 1, 0], { endAt: "2026-11-27T01:00", teardownAt: "2026-11-27T02:00" }),
    event("target", "Sitio de destino", [1, 1, 1, 1, 1], { date: "2026-11-28", setupAt: "2026-11-27T08:00", startAt: "2026-11-28T16:00", endAt: "2026-11-28T23:00", equipmentInAt: "2026-11-29T09:00" })];
  const routeEstimates = events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 30, handlingMinutes: 30 })));
  return { inventory, events, routeEstimates };
}
function model(input, options = {}) { return Reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates: input.routeEstimates, ...options }, input.inventory, { now }); }
function targetRows(sheet) { return sheet.getRows(5, Math.max(0, sheet.rowCount - 4)).filter(row => row.getCell(1).value === "Montaje · Sitio de destino"); }

test("el HTML presenta solo el origen elegido y Excel conserva la comparativa completa sin duplicar equipo", async () => {
  const input = fixture(), before = clone(input), plan = model(input);
  const origins = plan.draftLogistics.routePolicy.originComparisons.find(group => group.toEventId === "target");
  assert.equal(origins.comparisons.length, 3);
  assert.deepEqual(origins.preferredFromEventIds, ["whole-kit"]);
  const preferred = origins.comparisons.find(entry => entry.fromEventId === "whole-kit");
  assert.equal(preferred.fromDate, "2026-11-26");
  assert.equal(preferred.destinationCoverage, 0.8);
  const html = Reporting.renderEquipmentPlanningReportHtml(plan);
  assert.doesNotMatch(html, /Orígenes comparados para cada montaje o evento|Liberación real del origen/);
  assert.match(html, /Recomendación por coincidencia; verificar traslado/);
  assert.match(html, /Sitio grande &lt;ruta&gt;/);
  assert.match(html, /jueves 26\/11\/2026/);
  assert.match(html, /viernes 27\/11\/2026/);
  const workbook = await Reporting.createEquipmentMasterWorkbook(plan), reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = reopened.getWorksheet("Comparativa de orígenes");
  assert.ok(sheet);
  assert.equal(sheet.getRow(4).getCell(4).value, "Día del evento de origen");
  assert.equal(sheet.getRow(4).getCell(5).value, "Liberación real del origen");
  const rows = targetRows(sheet);
  assert.equal(rows.length, 3);
  const row = rows.find(entry => entry.getCell(3).value === "Sitio grande <ruta>");
  assert.match(row.getCell(2).value, /27 de noviembre de 2026/);
  assert.match(row.getCell(4).value, /26 de noviembre de 2026/);
  assert.match(row.getCell(5).value, /27 de noviembre de 2026.*2:00/);
  assert.equal(row.getCell(7).value, "80%");
  assert.equal(row.getCell(8).value, "Origen prioritario recomendado");
  assert.match(row.getCell(9).value, /1 × Equipo de prueba 0/);
  assert.ok(rows.filter(entry => entry !== row).every(entry => entry.getCell(8).value !== "Origen prioritario recomendado"));
  assert.deepEqual(input, before);
  assert.equal(plan.counts.events, 4);
  assert.equal(plan.counts.equipmentRows, 20);
  assert.equal(plan.counts.zeroQuantityRows, 9);
  assert.equal(plan.counts.sourceCells, 8);
});

test("la tabla de orígenes identifica exactamente el trasiego elegido y comparte cantidades con el manifiesto", async () => {
  const input = fixture(), preview = model(input);
  const selectedTransferIds = preview.draftLogistics.candidates.filter(route => route.fromEventId === "whole-kit" && route.toEventId === "target").map(route => route.id);
  assert.equal(selectedTransferIds.length, 4);
  const plan = model(input, { selectedTransferIds });
  assert.equal(plan.draftLogistics.selectedTransfers.length, 4);
  const workbook = await Reporting.createEquipmentMasterWorkbook(plan), rows = targetRows(workbook.getWorksheet("Comparativa de orígenes"));
  assert.equal(rows.find(row => row.getCell(3).value === "Sitio grande <ruta>").getCell(8).value, "Elegido y validado");
  assert.ok(rows.filter(row => row.getCell(3).value !== "Sitio grande <ruta>").every(row => row.getCell(8).value !== "Elegido y validado"));
  assert.match(Reporting.renderEquipmentPlanningReportHtml(plan), /Trasiego elegido para este plan/);
  assert.equal(plan.productionMutations, 0);
});

test("sin liberación verificable el reporte muestra pendiente y conserva el día operativo original", async () => {
  const input = fixture(), plan = model(input);
  const source = plan.events.find(event => event.id === "whole-kit");
  source.endAt = ""; source.teardownAt = "";
  for (const group of plan.draftLogistics.routePolicy.originComparisons) for (const comparison of group.comparisons) if (comparison.fromEventId === source.id) {
    delete comparison.fromAt; delete comparison.releaseDate;
  }
  const workbook = await Reporting.createEquipmentMasterWorkbook(plan), row = targetRows(workbook.getWorksheet("Comparativa de orígenes")).find(entry => entry.getCell(3).value === source.place);
  assert.match(row.getCell(4).value, /26 de noviembre de 2026/);
  assert.equal(row.getCell(5).value, "Pendiente");
});

test("la ausencia de comparativas de origen no fabrica decisiones ni elimina fuente del reporte", async () => {
  const input = fixture(), plan = model(input), before = clone(plan.sourceCells);
  plan.draftLogistics.routePolicy.originComparisons = [];
  assert.doesNotMatch(Reporting.renderEquipmentPlanningReportHtml(plan), /<h3>Orígenes comparados para cada montaje o evento<\/h3>/);
  const workbook = await Reporting.createEquipmentMasterWorkbook(plan);
  assert.equal(workbook.getWorksheet("Comparativa de orígenes").rowCount, 4);
  assert.deepEqual(plan.sourceCells, before);
});
