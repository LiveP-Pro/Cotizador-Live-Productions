"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Draft = require("../equipment-draft-logistics.js");
const Reports = require("../equipment-reporting.cjs");
const clone = (value) => JSON.parse(JSON.stringify(value));
const inventory = { savedAt: "synthetic-current", state: { items: [{ id: "synthetic-reference", name: "Referencia sintética", category: "Prueba", quantity: 3, itemType: "equipo" }], movements: [] } };
function event(id, extra = {}) {
  return { id, status: "draft", name: "Nombre arbitrario", place: "Lugar arbitrario", date: "2026-11-26", setupAt: "2026-11-26T08:00", startAt: "2026-11-27T16:00", endAt: "2026-11-27T22:00", equipmentInAt: "2026-11-28T03:00",
    sourceImport: { sha256: "synthetic-current-file-hash", fileName: "Archivo de prueba.xlsx", sheet: "Cuadro", block: 0,
      sourceEventId: "synthetic-source-event", sourceCells: [{ ref: "Cuadro!A1", sheet: "Cuadro", row: 1, column: 1, value: "ENCABEZADO" }, { ref: "Cuadro!A2", sheet: "Cuadro", row: 2, column: 1, value: 0 }] },
    sections: [{ id: "section", title: "Prueba", rows: [{ type: "header", description: "ENCABEZADO" }, { type: "note", description: "Nota literal que permanece" }], items: [
      { id: "line", description: "Referencia sintética", warehouseInventoryId: "synthetic-reference", quantity: 3, notes: ["Nota literal"] },
      { id: "zero", description: "Referencia sintética", warehouseInventoryId: "synthetic-reference", quantity: 0 } ] }], ...extra };
}
function analyze(events) { return Draft.analyze(events, inventory, { now: Date.parse("2026-11-25T12:00:00Z") }); }
function report(events) { return Reports.createEquipmentReportModel({ events }, inventory, { now: Date.parse("2026-11-25T12:00:00Z") }); }
for (const [name, calculate] of [["análisis", analyze], ["reporte", report]]) {
  test(`${name}: ID repetido idéntico o contradictorio nunca genera demanda doble`, () => {
    const original = event("one");
    for (const second of [clone(original), { ...clone(original), place: "Otro sitio", sections: [{ title: "Prueba", items: [{ description: "Referencia sintética", quantity: 9 }] }] }]) {
      const input = [original, second], before = clone(input);
      assert.throws(() => calculate(input), (error) => error.statusCode === 400 && /evento|identificador/i.test(error.message));
      assert.deepEqual(input, before, "no se borran cuadros ni celdas para esconder la repetición");
    }
  });
  test(`${name}: el mismo bloque cero con IDs distintos se rechaza conservando celdas y ceros`, () => {
    const input = [event("one"), event("two")], before = clone(input);
    assert.throws(() => calculate(input), (error) => error.statusCode === 400 && /mismo cuadro de origen/.test(error.message));
    assert.deepEqual(input, before);
    assert.equal(input.flatMap((entry) => entry.sections.flatMap((section) => section.items)).filter((line) => line.quantity === 0).length, 2);
  });
  test(`${name}: renombrar archivo o editar fecha no vuelve independiente un cuadro idéntico`, () => {
    const first = event("one"), second = event("two", { date: "2026-11-29", setupAt: "", startAt: "", endAt: "", equipmentInAt: "" });
    second.sourceImport.fileName = "Nombre cambiado.xlsx";
    assert.throws(() => calculate([first, second]), /mismo cuadro de origen/);
  });
  test(`${name}: cuadros diferentes del mismo archivo no se fusionan por nombre o equipo`, () => {
    const first = event("one"), second = event("two");
    second.sourceImport.block = 1;
    second.sourceImport.sourceCells = second.sourceImport.sourceCells.map((cell) => ({ ...cell, row: cell.row + 20, ref: `${cell.sheet}!A${cell.row + 20}` }));
    second.sourceImport.sourceEventId = "different-source-event";
    const result = calculate([first, second]);
    assert.equal(result.events.length, 2);
  });
  test(`${name}: eventos genuinamente distintos con datos iguales conservan ambos requerimientos`, () => {
    const first = event("one", { sourceImport: undefined }), second = event("two", { sourceImport: undefined });
    const result = calculate([first, second]);
    assert.equal(result.events.length, 2);
    assert.equal(result.rows.find((row) => row.warehouseInventoryId === "synthetic-reference").demand, 6);
  });
  test(`${name}: una copia expresamente independiente se conserva con su demanda y ceros`, () => {
    const first = event("one"), second = event("two"), third = event("three");
    for (const entry of [second, third]) entry.sourceImport.independentEventDecision = { action: "separate", existingEventId: first.id };
    const result = calculate([first, second, third]);
    assert.equal(result.events.length, 3);
    assert.equal(result.rows.find((row) => row.warehouseInventoryId === "synthetic-reference").demand, 9);
    assert.equal(result.events.flatMap((entry) => entry.sections.flatMap((section) => section.items)).filter((line) => line.quantity === 0).length, 3);
  });
  test(`${name}: un sello independiente ajeno no autoriza otra copia duplicada`, () => {
    const first = event("one"), second = event("two");
    second.sourceImport.independentEventDecision = { action: "separate", existingEventId: "unrelated" };
    assert.throws(() => calculate([first, second]), /mismo cuadro de origen/);
  });
  test(`${name}: se respeta la decisión explícita de cuadros independientes del importador`, () => {
    const first = event("one"), second = event("two");
    first.sourceImport.sourceEventId = "source-one"; second.sourceImport.sourceEventId = "source-two";
    first.sourceImport.duplicateDecisions = [{ choice: "selected_as_independent", selectedEventIds: ["source-one", "source-two"] }];
    const result = calculate([first, second]);
    assert.equal(result.events.length, 2);
  });
  test(`${name}: una copia cancelada no duplica la demanda activa`, () => {
    const result = calculate([event("one"), event("two", { status: "cancelled" })]);
    assert.equal(result.events.length, 1);
    assert.equal(result.rows.find((row) => row.warehouseInventoryId === "synthetic-reference").demand, 3);
  });
  test(`${name}: el montaje del día anterior conserva un solo evento y una demanda`, () => {
    const original = event("one"), result = calculate([original]);
    assert.equal(result.events.length, 1);
    assert.equal(result.rows.find((row) => row.warehouseInventoryId === "synthetic-reference").demand, 3);
    assert.equal(result.events[0].setupAt, "2026-11-26T08:00");
    assert.equal(result.events[0].startAt, "2026-11-27T16:00");
  });
}
test("el origen y contenido exactos permiten detectar copias sin hash, no solo su nombre", () => {
  const first = event("one"), second = event("two");
  delete first.sourceImport.sha256; delete second.sourceImport.sha256;
  assert.throws(() => analyze([first, second]), /mismo cuadro de origen/);
  second.sourceImport.sourceCells[1].value = 7;
  assert.equal(analyze([first, second]).events.length, 2, "contenido distinto exige revisión de importación, no una fusión por nombre");
});
test("un identificador fuente explícito vincula copias del mismo archivo aunque no expongan número de bloque", () => {
  const first = event("one"), second = event("two");
  for (const entry of [first, second]) { delete entry.sourceImport.block; delete entry.sourceImport.fileName; }
  assert.throws(() => analyze([first, second]), /mismo cuadro de origen/);
  second.sourceImport.sourceEventId = "another-physical-event";
  assert.equal(analyze([first, second]).events.length, 2);
});
