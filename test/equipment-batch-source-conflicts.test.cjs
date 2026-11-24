"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseEventFile, verifyEventImport } = require("../equipment-event-import.cjs");
const batch = require("../equipment-batch-events.js");

// These are wholly synthetic input documents, independent of any catalog,
// inventory, saved event, or customer workbook.
async function previewWith({ metadata = [], conflictingRange = false } = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Evento sintético de revisión");
  sheet.addRows([
    ["Fecha del evento", "25/11/2026"],
    ["Lugar del evento", "Sede sintética de revisión"],
    ["Nombre del cliente", "Cliente sintético original"],
    ...metadata,
    ["Fecha y hora del montaje", "25/11/2026 10:00"],
    ["Hora de inicio del evento", "14:00"],
    ...(conflictingRange ? [["Horario del evento general", "15:00 a 21:00"]] : []),
    ["Hora de finalización del evento", "21:00"],
    ["Fecha y hora del desmontaje", "25/11/2026 21:00"],
    ["Fecha y hora de regreso a bodega", "26/11/2026 01:00"],
    ["Cantidad", "Descripción"],
    [0, "Referencia sintética en cero"],
    [2, "Referencia sintética de prueba"]
  ]);
  return parseEventFile(Buffer.from(await workbook.xlsx.writeBuffer()), {
    fileName: "conflictos-de-fuente-sinteticos.xlsx"
  });
}

function applicableWarnings(preview, selections, eventId) {
  return batch.selectionWarnings(preview, selections)
    .filter((warning) => warning.eventIds.includes(eventId));
}

function assertSpecificSourceWarning(preview, warnings, issue) {
  assert.ok(warnings.length > 0, "un conflicto original no debe quedar sin aviso");
  const addresses = issue.refs.map((ref) => preview.sourceCells.find((cell) => cell.ref === ref)?.address).filter(Boolean);
  assert.ok(addresses.some((address) => warnings.some((warning) => warning.message.includes(address))),
    "la advertencia debe señalar las celdas originales del conflicto");
}

test("tipo opcional vacío no genera avisos cuando las fechas y horas son coherentes", async () => {
  const preview = await previewWith();
  const original = JSON.stringify(preview);
  const selections = batch.selectionsFor(preview);
  assert.equal(preview.events.length, 1);
  assert.equal(preview.events[0].type, "");
  assert.equal(batch.selectionError(preview, selections), "");
  assert.deepEqual(batch.selectionWarnings(preview, selections), []);
  const [event] = batch.prepareEvents(preview, selections);
  assert.equal(event.date, "2026-11-25");
  assert.equal(event.zeroCount, 1);
  assert.equal(event.itemCount, 2);
  assert.equal(JSON.stringify(preview), original, "preparar el evento no altera la fuente original");
});

test("dos clientes escritos en el mismo cuadro mantienen una advertencia y todas sus celdas", async () => {
  const preview = await previewWith({ metadata: [["Nombre del cliente", "Segundo cliente sintético"]] });
  const [event] = preview.events;
  const issue = event.issues.find((entry) => entry.code === "conflicting_metadata" && entry.field === "client");
  assert.ok(issue, "el lector debe identificar el conflicto real del documento");
  const selections = batch.selectionsFor(preview);
  const warnings = applicableWarnings(preview, selections, event.id);
  assertSpecificSourceWarning(preview, warnings, issue);
  assert.throws(() => batch.prepareEvents(preview, selections), /Confirme las advertencias/);
  assert.equal(verifyEventImport(preview).complete, true);
  assert.ok(preview.sourceCells.some((cell) => cell.value === "Cliente sintético original"));
  assert.ok(preview.sourceCells.some((cell) => cell.value === "Segundo cliente sintético"));
});

test("tipo opcional presente con dos valores contradictorios se distingue de un campo vacío", async () => {
  const preview = await previewWith({ metadata: [["Tipo de evento", "Evento sintético A"], ["Tipo de evento", "Evento sintético B"]] });
  const [event] = preview.events;
  const issue = event.issues.find((entry) => entry.code === "conflicting_metadata" && entry.field === "type");
  assert.ok(issue);
  const selections = batch.selectionsFor(preview);
  assertSpecificSourceWarning(preview, applicableWarnings(preview, selections, event.id), issue);
  assert.throws(() => batch.prepareEvents(preview, selections), /Confirme las advertencias/);
  assert.equal(verifyEventImport(preview).complete, true);
});

test("editar solo la hora final no resuelve el conflicto de inicio de una celda de rango compartida", async () => {
  const preview = await previewWith({ conflictingRange: true });
  const [event] = preview.events;
  const issue = event.issues.find((entry) => entry.code === "conflicting_schedule");
  assert.ok(issue, "el inicio explícito 14:00 contradice el inicio 15:00 del rango");
  const selections = batch.selectionsFor(preview);
  assertSpecificSourceWarning(preview, applicableWarnings(preview, selections, event.id), issue);
  const originalStartTime = selections[0].startTime;
  selections[0].endTime = "20:00";
  assert.equal(selections[0].startTime, originalStartTime);
  assertSpecificSourceWarning(preview, applicableWarnings(preview, selections, event.id), issue);
  assert.throws(() => batch.prepareEvents(preview, selections), /Confirme las advertencias/);
  assert.equal(verifyEventImport(preview).complete, true);
});
