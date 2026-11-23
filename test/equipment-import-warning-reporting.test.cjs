const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const reporting = require("../equipment-reporting.cjs");

// Entirely synthetic, current inputs. No saved catalog or event data is read.
function fixture() {
  const cell = (ref, value) => ({ ref, address: ref, sheet: "Fuente sintética actual", value });
  const cells = [cell("A1", 3), cell("B1", "Equipo sintético"), cell("A2", 0), cell("B2", "Equipo sin uso"),
    cell("A3", "-2"), cell("B3", "Cantidad original por corregir"), cell("A4", 5), cell("B5", "Observación sin cantidad")];
  const rows = [
    { type: "item", quantity: 3, description: "Equipo sintético", sourceItemIndex: 0, sourceRefs: ["A1", "B1"], cells: cells.slice(0, 2) },
    { type: "item", quantity: 0, description: "Equipo sin uso", sourceItemIndex: 1, sourceRefs: ["A2", "B2"], cells: cells.slice(2, 4) },
    { type: "unresolved", quantity: null, description: "-2 | Cantidad original por corregir", sourceRefs: ["A3", "B3"], cells: cells.slice(4, 6) },
    { type: "unresolved", quantity: null, description: "5", sourceRefs: ["A4"], cells: cells.slice(6, 7) },
    { type: "note", quantity: null, description: "Observación sin cantidad", sourceRefs: ["B5"], cells: cells.slice(7) }
  ];
  const issue = { code: "conflicting_schedule_order", message: "Confirme el orden del horario original", refs: ["C1"] };
  const referenceCells = [cell("D1", 3), cell("E1", "Equipo sintético"), cell("D2", "sin leer"), cell("E2", "Texto conservado de referencia")];
  const reference = { id: "synthetic-reference", sourceSheet: "Fuente sintética actual", sourceCells: referenceCells,
    warnings: [{ code: "missing_date", message: "Una copia de referencia no tiene fecha" }, { code: "pending_times", message: "Borrador de referencia" }],
    sections: [{ title: "Audio", items: [{ quantity: 3, description: "Equipo sintético" }], rows: [
      { type: "item", quantity: 3, description: "Equipo sintético", cells: referenceCells.slice(0, 2) },
      { type: "unresolved", quantity: null, description: "sin leer | Texto conservado de referencia", cells: referenceCells.slice(2) }
    ] }] };
  const event = { id: "synthetic-accepted-draft", place: "Sitio sintético", date: "2026-11-25",
    setupAt: "2026-11-25T08:00", startAt: "2026-11-25T12:00", endAt: "2026-11-25T18:00", equipmentInAt: "2026-11-25T20:00",
    warnings: [{ code: "pending_times", message: "Borrador sin reservas" }],
    sourceCells: [...cells, cell("C1", "Horario original contradictorio")],
    sections: [{ title: "Audio", items: [{ quantity: 3, description: "Equipo sintético" }, { quantity: 0, description: "Equipo sin uso" }], rows }],
    sourceImport: { sourceEventId: "synthetic-accepted-draft", warningsAccepted: true, sourceIssues: [issue],
      sourceWarnings: [{ code: "pending_times", message: "Revise los horarios antes de reservar" }, { code: "unreadable_schedule", message: "Horario escrito sin interpretar", refs: ["C1"] }],
      acceptedWarnings: [{ ...issue, refs: ["C2"], eventIds: ["synthetic-accepted-draft"] },
        { code: "another_event", message: "Aviso de otro evento", eventIds: ["synthetic-other-event"] }],
      referenceTables: [reference] } };
  const inventory = { savedAt: "2026-11-23T12:00:00.000Z", state: { items: [{ id: "synthetic-stock", name: "Equipo sintético", category: "Audio", itemType: "equipo", quantity: 10 }], movements: [] } };
  return { event, inventory, refs: [...event.sourceCells, ...referenceCells].map(cell => cell.ref) };
}

test("accepted draft warnings retain source conflicts and refs once per event", () => {
  const { event, inventory } = fixture(), before = JSON.stringify(event);
  const model = reporting.createEquipmentReportModel({ events: [event] }, inventory);
  const conflict = model.pending.filter(row => row.reason === "Aviso del archivo aceptado al cargar: Confirme el orden del horario original");
  assert.equal(conflict.length, 1);
  assert.equal(conflict[0].sourceRefs, "C1; C2");
  assert.ok(model.pending.some(row => row.reason === "Aviso del archivo aceptado al cargar: Horario escrito sin interpretar" && row.sourceRefs === "C1"));
  assert.equal(model.pending.filter(row => row.description === "pending_times").length, 1);
  assert.ok(!model.pending.some(row => /Aviso de otro evento|Una copia de referencia no tiene fecha|Borrador de referencia/.test(row.reason)));
  assert.ok(!model.pending.some(row => row.kind === "HORARIO"), "source conflicts do not make the accepted current schedule invalid");
  const contradictory = structuredClone(event); contradictory.endAt = "2026-11-25T07:00";
  assert.ok(reporting.createEquipmentReportModel({ events: [contradictory] }, inventory).pending.some(row => row.kind === "HORARIO" && row.description === "Orden de fechas y horas"));
  assert.equal(JSON.stringify(event), before);
  assert.equal(model.productionMutations, 0);
});

test("accepted warnings follow original source identity after the bridge assigns a runtime ID", () => {
  const { event, inventory } = fixture();
  event.id = "runtime-synthetic-draft";
  event.sourceImport.acceptedWarnings.push({ code: "schedule_suggestion", message: "Fecha propuesta aceptada para el borrador", eventIds: [event.sourceImport.sourceEventId] });
  const model = reporting.createEquipmentReportModel({ events: [event] }, inventory);
  const accepted = model.pending.filter(row => row.kind === "FUENTE");
  assert.ok(accepted.some(row => row.eventId === event.id && row.description === "schedule_suggestion" && row.reason === "Aviso del archivo aceptado al cargar: Fecha propuesta aceptada para el borrador"));
  assert.ok(accepted.some(row => row.description === "conflicting_schedule_order" && row.sourceRefs === "C1; C2"));
  assert.ok(!accepted.some(row => row.reason.includes("Aviso de otro evento")));
});

test("unresolved source and reference rows stay visible without becoming zero demand or duplicate equipment", () => {
  const { event, inventory, refs } = fixture();
  const model = reporting.createEquipmentReportModel({ events: [event] }, inventory);
  assert.equal(model.counts.equipmentRows, 2);
  assert.equal(model.counts.zeroQuantityRows, 1);
  assert.equal(model.rows.find(row => row.description === "Equipo sintético").demand, 3);
  assert.deepEqual(model.sourceCells.map(cell => cell.ref).sort(), refs.sort());
  const unresolved = model.pending.filter(row => /Fila .*sin interpretar/.test(row.description));
  assert.equal(unresolved.length, 3);
  assert.ok(unresolved.every(row => row.quantity === null));
  assert.ok(unresolved.some(row => row.reason.includes("-2 | Cantidad original por corregir") && row.sourceRefs === "A3; B3"));
  assert.ok(unresolved.some(row => row.reason.includes("5") && row.sourceRefs === "A4"));
  assert.ok(unresolved.some(row => row.reason.includes("Texto conservado de referencia") && row.sourceRefs === "D2; E2"));
  assert.ok(!model.pending.some(row => row.reason.includes("Observación sin cantidad")));
  assert.ok(model.preservedRows.some(row => row.section.startsWith("Referencia del archivo") && row.quantity === 3));
  assert.ok(model.preservedRows.some(row => row.description === "Observación sin cantidad"));
  for (const invalid of [-2, "", "sin leer"]) {
    const bad = structuredClone(event); bad.sections[0].items[0].quantity = invalid;
    assert.throws(() => reporting.createEquipmentReportModel({ events: [bad] }, inventory), /número/);
  }
});

test("Excel and printable reports show accepted source warnings and literal unresolved rows", async () => {
  const { event, inventory } = fixture();
  const model = reporting.createEquipmentReportModel({ events: [event] }, inventory);
  const workbook = await reporting.createEquipmentMasterWorkbook(model);
  const reopened = new ExcelJS.Workbook(); await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const pending = reopened.getWorksheet("Pendientes");
  const values = pending.getRows(5, pending.rowCount - 4).map(row => row.values.slice(1));
  assert.ok(values.some(row => row[4] === "Aviso del archivo aceptado al cargar: Confirme el orden del horario original" && row[5] === "C1; C2"));
  assert.ok(values.some(row => row[3] === "" && row[4].includes("-2 | Cantidad original por corregir")));
  const originals = reopened.getWorksheet("Filas originales");
  assert.ok(originals.getRows(5, originals.rowCount - 4).some(row => String(row.getCell(2).value).startsWith("Referencia del archivo")));
  const markup = reporting.renderEquipmentReportHtml(model, "rent");
  for (const literal of ["Confirme el orden del horario original", "-2 | Cantidad original por corregir", "Texto conservado de referencia", "A3; B3"]) assert.ok(markup.includes(literal));
});
