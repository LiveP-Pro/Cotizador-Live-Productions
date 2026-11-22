const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseEventFile, parseTime, verifyEventImport } = require("../equipment-event-import.cjs");

// Every workbook, PDF, date and equipment name in this file is synthetic.
async function previewRows(rows, configure) {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Cuadro sintetico 24-11-2026");
  rows.forEach((row) => sheet.addRow(row));
  configure?.(sheet);
  return parseEventFile(Buffer.from(await workbook.xlsx.writeBuffer()), { fileName: "horarios-sinteticos.xlsx" });
}
const equipment = [["Cantidad", "Descripción"], [0, "Equipo sintetico cero"], [2, "Equipo sintetico segundo"]];
function onlyEvent(preview) {
  assert.equal(preview.events.length, 1);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  const event = preview.events[0];
  assert.equal(event.canImport, true, JSON.stringify(event.issues));
  assert.deepEqual(event.sections.flatMap((section) => section.items).map((item) => item.quantity), [0, 2]);
  return event;
}

test("explicit setup, event and following-day end times are read without changing source cells", async () => {
  const preview = await previewRows([
    ["Fecha del evento:", "24/11/2026"], ["Montaje:", "23 de noviembre de 2026 a las 2:30 p.m."],
    ["Inicio del evento:", "24/11/2026 7:30 p.m."], ["Finalización del evento:", "25/11/2026 1:00 a.m."],
    ["Fecha de regreso a bodega:", "25/11/2026"], ["Hora de regreso a bodega:", "04:00"], ...equipment
  ], (sheet) => { sheet.getCell("B8").note = "Nota sintetica original"; });
  const event = onlyEvent(preview);
  assert.equal(event.date, "2026-11-24");
  assert.equal(event.setupApplies, true);
  assert.equal(event.setupAt, "2026-11-23T14:30");
  assert.equal(event.startAt, "2026-11-24T19:30");
  assert.equal(event.endAt, "2026-11-25T01:00");
  assert.equal(event.equipmentInAt, "2026-11-25T04:00");
  assert.deepEqual(event.scheduleRefs.endAt, ["xlsx:1:A4", "xlsx:1:B4"]);
  assert.equal(event.sourceImport.metadata.endTime, "25/11/2026 1:00 a.m.");
  assert.ok(preview.sourceCells.some((cell) => String(cell.note).includes("Nota sintetica original")));
  assert.equal(verifyEventImport(preview).complete, true);
});

test("split setup date and hour and inline event date/time retain their exact provenance", async () => {
  const event = onlyEvent(await previewRows([
    ["Fecha de montaje", "23-11-2026"], ["Hora de montaje", "08:45"],
    ["Fecha y hora del evento: 24/11/2026 18:00"], ["Fecha y hora de finalización: 24/11/2026 23:30"], ...equipment
  ]));
  assert.equal(event.date, "2026-11-24");
  assert.equal(event.setupAt, "2026-11-23T08:45");
  assert.equal(event.startAt, "2026-11-24T18:00");
  assert.equal(event.endAt, "2026-11-24T23:30");
  assert.deepEqual(event.scheduleRefs.setupAt, ["xlsx:1:A1", "xlsx:1:B1", "xlsx:1:A2", "xlsx:1:B2"]);
  assert.equal(event.dateLiteral, "24/11/2026 18:00");
});

test("no setup is read only when explicitly stated; event start uses its written event date", async () => {
  const event = onlyEvent(await previewRows([
    ["Montaje", "No aplica"], ["Fecha del evento", "24/11/2026"], ["Hora del evento", "6 p.m."],
    ["Hora de finalización", "11:15 p.m."], ...equipment
  ]));
  assert.equal(event.setupApplies, false);
  assert.equal(event.setupAt, "");
  assert.equal(event.startAt, "2026-11-24T18:00");
  assert.equal(event.endTime, "23:15");
  assert.equal(event.endDate, "2026-11-24");
  assert.equal(event.endAt, "2026-11-24T23:15");
  assert.equal(event.scheduleDerivedFields.endDate, "event.date");
  assert.ok(event.warnings.some((warning) => warning.code === "schedule_date_from_event"));
  assert.deepEqual(event.scheduleRefs.endAt, ["xlsx:1:A2", "xlsx:1:B2", "xlsx:1:A4", "xlsx:1:B4"]);
});

test("an end after midnight stays an explicit hour awaiting its date, with no day inferred from a tab", async () => {
  const event = onlyEvent(await previewRows([
    ["Hora del montaje", "14:00"], ["Hora de inicio", "20:00"], ["Hora fin", "01:00"], ...equipment
  ]));
  assert.equal(event.date, "");
  assert.equal(event.startAt, "");
  assert.equal(event.startTime, "20:00");
  assert.equal(event.endTime, "01:00");
  assert.equal(event.endAt, "");
  assert.equal(event.setupDate, "");
  assert.equal(event.setupTime, "14:00");
  assert.equal(event.setupAt, "");
  const dated = onlyEvent(await previewRows([
    ["Fecha del evento", "24/11/2026"], ["Hora de inicio", "20:00"], ["Hora fin", "01:00"], ...equipment
  ]));
  assert.equal(dated.startAt, "2026-11-24T20:00");
  assert.equal(dated.endTime, "01:00");
  assert.equal(dated.endDate, "");
  assert.equal(dated.endAt, "");
  assert.deepEqual(dated.scheduleDerivedFields, {});
});

test("Excel date, time and datetime formats preserve the written local clock without UTC shifts", async () => {
  const event = onlyEvent(await previewRows([
    ["Fecha del evento", new Date(Date.UTC(2026, 10, 24))],
    ["Montaje", new Date(Date.UTC(2026, 10, 23, 14, 30))],
    ["Hora del evento", new Date(Date.UTC(1899, 11, 30, 18, 45))],
    ["Fecha de finalización", new Date(Date.UTC(2026, 10, 25))],
    ["Hora de finalización", 1 / 24], ...equipment
  ], (sheet) => {
    sheet.getCell("B1").numFmt = "[$-es-GT]dd/mm/yyyy";
    sheet.getCell("B2").numFmt = "dd/mm/yyyy hh:mm";
    sheet.getCell("B3").numFmt = "hh:mm";
    sheet.getCell("B4").numFmt = "dd/mm/yyyy";
    sheet.getCell("B5").numFmt = "hh:mm";
  }));
  assert.equal(event.setupAt, "2026-11-23T14:30");
  assert.equal(event.startAt, "2026-11-24T18:45");
  assert.equal(event.endAt, "2026-11-25T01:00");
  assert.equal(event.sourceCells.find((cell) => cell.address === "B1").numberFormat, "[$-es-GT]dd/mm/yyyy");
});

test("date-only Excel setup never introduces midnight, while explicitly formatted midnight is valid", async () => {
  const event = onlyEvent(await previewRows([
    ["Montaje", new Date(Date.UTC(2026, 10, 23))],
    ["Fecha del evento", new Date(Date.UTC(2026, 10, 24))],
    ["Hora del evento", 0], ...equipment
  ], (sheet) => {
    sheet.getCell("B1").numFmt = "dd/mm/yyyy";
    sheet.getCell("B2").numFmt = "dd/mm/yyyy";
    sheet.getCell("B3").numFmt = "hh:mm";
  }));
  assert.equal(event.setupDate, "2026-11-23");
  assert.equal(event.setupTime, "");
  assert.equal(event.setupAt, "");
  assert.equal(event.startTime, "00:00");
  assert.equal(event.startAt, "2026-11-24T00:00");
});

test("one date/time label can be followed by separate date and hour cells without dropping either", async () => {
  const event = onlyEvent(await previewRows([
    ["Fecha y hora de montaje", "23/11/2026", "14:15"],
    ["Fecha y hora del evento", new Date(Date.UTC(2026, 10, 24)), "18:00"], ...equipment
  ], (sheet) => { sheet.getCell("B2").numFmt = "dd/mm/yyyy"; }));
  assert.equal(event.setupAt, "2026-11-23T14:15");
  assert.equal(event.startAt, "2026-11-24T18:00");
  assert.deepEqual(event.scheduleRefs.startAt, ["xlsx:1:A2", "xlsx:1:B2", "xlsx:1:C2"]);
});

test("a date value can carry an explicit written or Excel-formatted event clock", async () => {
  const written = onlyEvent(await previewRows([["Fecha del evento", "24/11/2026 6 p.m."], ...equipment]));
  assert.equal(written.startAt, "2026-11-24T18:00");
  const formatted = onlyEvent(await previewRows([["Fecha del evento", new Date(Date.UTC(2026, 10, 24, 18, 15))], ...equipment], (sheet) => { sheet.getCell("B1").numFmt = "dd/mm/yyyy hh:mm"; }));
  assert.equal(formatted.startAt, "2026-11-24T18:15");
  const dateOnly = onlyEvent(await previewRows([["Fecha del evento", new Date(Date.UTC(2026, 10, 24))], ...equipment], (sheet) => { sheet.getCell("B1").numFmt = "dd/mm/yyyy"; }));
  assert.equal(dateOnly.startAt, "");
});

test("invalid clocks or impossible dates remain visible and do not become invented schedule values", async () => {
  const event = onlyEvent(await previewRows([
    ["Fecha del evento", "31/02/2026"], ["Hora del evento", "25:75"], ["Hora fin", "tal vez de noche"], ...equipment
  ]));
  assert.equal(event.date, "");
  assert.equal(event.startAt, "");
  assert.equal(event.startTime, "");
  assert.equal(event.endAt, "");
  assert.equal(event.sourceImport.metadata.endTime, "tal vez de noche");
  assert.ok(event.warnings.some((warning) => warning.code === "unreadable_schedule"));
  assert.equal(parseTime("13:00 pm"), "");
  assert.equal(parseTime("24:00"), "");
  assert.equal(parseTime("12:00 a.m."), "00:00");
  assert.equal(parseTime("12:00 p.m."), "12:00");
});

test("contradictory setup declarations preserve all cells and require source review", async () => {
  const preview = await previewRows([
    ["Requiere montaje", "No"], ["Fecha y hora de montaje", "23/11/2026 14:00"], ...equipment
  ]);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.events[0].canImport, false);
  assert.ok(preview.events[0].issues.some((issue) => issue.code === "conflicting_setup"));
});

test("parallel event schedules remain assigned to their original table", async () => {
  const eventPreview = await previewRows([
    ["Fecha", "24/11/2026", "", "Fecha", "25/11/2026"],
    ["Hora de inicio", "18:00", "", "Hora de inicio", "20:00"],
    ["Montaje", "No aplica", "", "Montaje", "24/11/2026 15:00"],
    ["Cantidad", "Descripción", "", "Cantidad", "Descripción"],
    [0, "Equipo sintetico A", "", 2, "Equipo sintetico B"]
  ]);
  assert.equal(eventPreview.verification.complete, true);
  assert.equal(eventPreview.events.length, 2);
  assert.ok(eventPreview.events.every((event) => event.canImport));
  assert.deepEqual(eventPreview.events.map((event) => event.startAt), ["2026-11-24T18:00", "2026-11-25T20:00"]);
  assert.deepEqual(eventPreview.events.map((event) => event.setupAt), ["", "2026-11-24T15:00"]);
  assert.equal(eventPreview.events[0].setupApplies, false);
  assert.equal(eventPreview.events[1].setupApplies, true);
});

test("equipment named Montaje or Inicio is never reclassified as schedule metadata", async () => {
  for (const rows of [
    [["Cantidad", "Descripción"], [0, "Montaje"], [2, "Inicio"]],
    [["Descripción", "Cantidad"], ["Montaje", 0], ["Inicio", 2]]
  ]) {
    const event = (await previewRows(rows)).events[0];
    assert.equal(event.canImport, true, JSON.stringify(event.issues));
    assert.deepEqual(event.sections.flatMap((section) => section.items).map((item) => [item.quantity, item.description]), [[0, "Montaje"], [2, "Inicio"]]);
    assert.equal(event.setupAt, "");
    assert.equal(event.startAt, "");
  }
});

function syntheticPdf(lines) {
  const escape = (value) => String(value).replace(/[\\()]/g, "\\$&");
  const stream = lines.map(([x, y, value]) => `BT /F1 12 Tf ${x} ${y} Td (${escape(value)}) Tj ET`).join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [4 0 R] /Count 1 >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  const chunks = [Buffer.from("%PDF-1.4\n")], offsets = [0]; let size = chunks[0].length;
  objects.forEach((object, index) => { offsets.push(size); const part = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`); chunks.push(part); size += part.length; });
  chunks.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

test("digital PDF schedule labels and fragment references survive the same event-reader path", async () => {
  const preview = await parseEventFile(syntheticPdf([
    [50, 780, "Lugar: Salon sintetico"], [50, 755, "Montaje: 23/11/2026 14:00"],
    [50, 730, "Fecha del evento: 24/11/2026"], [50, 705, "Hora del evento: 18:30"],
    [50, 680, "Fecha y hora de finalizacion: 25/11/2026 00:30"],
    [50, 645, "Cantidad"], [150, 645, "Descripcion"], [50, 620, "0"], [150, 620, "Equipo sintetico cero"],
    [50, 590, "2"], [150, 590, "Equipo sintetico segundo"]
  ]), { fileName: "horarios-sinteticos.pdf" });
  const event = onlyEvent(preview);
  assert.equal(event.setupAt, "2026-11-23T14:00");
  assert.equal(event.startAt, "2026-11-24T18:30");
  assert.equal(event.endAt, "2026-11-25T00:30");
  assert.ok(event.scheduleRefs.endAt.every((ref) => /^pdf:/.test(ref)));
});
