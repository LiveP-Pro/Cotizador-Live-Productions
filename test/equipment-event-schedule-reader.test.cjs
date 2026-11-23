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

test("a las joins a full event date and time without turning it into a range", async () => {
  for (const value of ["24/11/2026 a las 18:00", "24 de noviembre de 2026 a las 6 p.m."]) {
    const event = onlyEvent(await previewRows([["Inicio del evento", value], ...equipment]));
    assert.equal(event.startAt, "2026-11-24T18:00");
    assert.equal(event.endTime, "");
    assert.equal(event.sourceImport.metadata.startAt, value);
  }
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

test("general event ranges and weekday clocks retain metadata, dates and source references", async () => {
  const preview = await previewRows([
    ["Fecha del evento", "24/11/2026"], ["Nombre del cliente", "Cliente sintetico"],
    ["Lugar del evento", "Salon sintetico"], ["Tipo de evento", "Celebracion sintetica"],
    ["Horario de montaje", "martes10:00am"], ["Horario del evento general", "2:00pm a 9:00pm"],
    ["Horario de desmontaje", "MARTES 9:00pm"], ["Horario que llega a bodega", "miércoles1:00am"], ...equipment
  ]);
  const event = onlyEvent(preview);
  assert.equal(event.name, "Cliente sintetico");
  assert.equal(event.client, "Cliente sintetico");
  assert.equal(event.place, "Salon sintetico");
  assert.equal(event.type, "Celebracion sintetica");
  assert.equal(event.setupAt, "2026-11-24T10:00");
  assert.equal(event.startAt, "2026-11-24T14:00");
  assert.equal(event.endAt, "2026-11-24T21:00");
  assert.equal(event.teardownAt, "2026-11-24T21:00");
  assert.equal(event.equipmentInAt, "2026-11-25T01:00");
  assert.equal(event.scheduleDerivedFields.setupDate, "event.date + weekday");
  assert.equal(event.scheduleDerivedFields.teardownDate, "event.date + weekday");
  assert.equal(event.scheduleDerivedFields.equipmentInDate, "event.date + weekday");
  assert.deepEqual(event.scheduleRefs.startTime, ["xlsx:1:A6", "xlsx:1:B6"]);
  assert.deepEqual(event.scheduleRefs.equipmentInAt, ["xlsx:1:A1", "xlsx:1:B1", "xlsx:1:A8", "xlsx:1:B8"]);
  assert.equal(event.sourceImport.metadata.eventTimeRange, "2:00pm a 9:00pm");
  assert.equal(event.sourceImport.metadata.teardownTime, "MARTES 9:00pm");
  assert.equal(event.sourceImport.metadata.equipmentInTime, "miércoles1:00am");
  assert.equal(verifyEventImport(preview).complete, true);
});

test("overnight range uses only a matching explicit following-day teardown to resolve its end date", async () => {
  const rows = [
    ["Fecha del evento", "24/11/2026"], ["Horario de montaje", "lunes 6:00am"],
    ["Horario del evento general", "8:00pm a 1:00am"]
  ];
  const event = onlyEvent(await previewRows([...rows, ["Horario de desmontaje", "miércoles 1:00am"], ...equipment]));
  assert.equal(event.setupAt, "2026-11-23T06:00");
  assert.equal(event.startAt, "2026-11-24T20:00");
  assert.equal(event.endAt, "2026-11-25T01:00");
  assert.equal(event.teardownAt, "2026-11-25T01:00");
  assert.equal(event.scheduleDerivedFields.endDate, "teardown.date + matching event end time");
  assert.ok(event.warnings.some((warning) => warning.code === "schedule_date_from_teardown"));
  assert.deepEqual(event.scheduleRefs.endAt, ["xlsx:1:A1", "xlsx:1:B1", "xlsx:1:A3", "xlsx:1:B3", "xlsx:1:A4", "xlsx:1:B4"]);
  for (const teardown of [[], [["Horario de desmontaje", "miércoles 2:00am"]]]) {
    const pending = onlyEvent(await previewRows([...rows, ...teardown, ...equipment]));
    assert.equal(pending.endTime, "01:00");
    assert.equal(pending.endDate, "");
    assert.equal(pending.endAt, "");
    assert.equal(pending.scheduleDerivedFields.endDate, undefined);
  }
  const finalHour = onlyEvent(await previewRows([
    ["Fecha del evento", "24/11/2026"], ["Hora de inicio", "20:00"], ["Hora fin", "01:00"],
    ["Horario de desmontaje", "miércoles 1:00am"], ...equipment
  ]));
  assert.equal(finalHour.endTime, "01:00");
  assert.equal(finalHour.endDate, "");
  assert.equal(finalHour.endAt, "");
});

test("qualified weekdays and malformed ranges retain source text without an invented complete schedule", async () => {
  const event = onlyEvent(await previewRows([
    ["Fecha del evento", "24/11/2026"], ["Horario de montaje", "lunes de la próxima semana 9:00am"],
    ["Horario del evento general", "6:00pm a 8:00pm a 10:00pm"], ...equipment
  ]));
  assert.equal(event.setupTime, "09:00");
  assert.equal(event.setupDate, "");
  assert.equal(event.setupAt, "");
  assert.equal(event.startTime, "");
  assert.equal(event.endTime, "");
  assert.equal(event.sourceImport.metadata.eventTimeRange, "6:00pm a 8:00pm a 10:00pm");
  assert.ok(event.warnings.some((warning) => warning.code === "unreadable_schedule"));
});

test("weekday schedules without an explicit event date stay pending even when the sheet name has a date", async () => {
  const event = onlyEvent(await previewRows([
    ["Horario de montaje", "martes 10:00am"], ["Horario del evento general", "8:00pm a 1:00am"],
    ["Horario de desmontaje", "miércoles 1:00am"], ["Horario que llega a bodega", "miércoles 3:00am"], ...equipment
  ]));
  assert.equal(event.date, "");
  assert.equal(event.startTime, "20:00");
  assert.equal(event.endTime, "01:00");
  assert.equal(event.teardownTime, "01:00");
  assert.equal(event.equipmentInTime, "03:00");
  for (const prefix of ["setup", "start", "end", "teardown", "equipmentIn"]) {
    assert.equal(event[prefix + "Date"], "");
    assert.equal(event[prefix + "At"], "");
  }
  assert.deepEqual(event.scheduleDerivedFields, {});
});

test("weekday mounting after the explicit event date requires correction without rewriting that date", async () => {
  const preview = await previewRows([
    ["Fecha del evento", "24/11/2026"], ["Horario de montaje", "miércoles 9:00am"],
    ["Horario del evento general", "4:00pm a 11:00pm"], ["Horario de desmontaje", "miércoles 11:00pm"], ...equipment
  ]);
  const event = preview.events[0];
  assert.equal(preview.verification.complete, true);
  assert.equal(event.date, "2026-11-24");
  assert.equal(event.dateLiteral, "24/11/2026");
  assert.equal(event.startAt, "2026-11-24T16:00");
  assert.equal(event.setupAt, "2026-11-25T09:00");
  assert.equal(event.canImport, false);
  assert.ok(event.issues.some((issue) => issue.code === "conflicting_schedule_order" && /montaje/.test(issue.message)));
  assert.equal(event.sourceImport.metadata.setupTime, "miércoles 9:00am");
});

function correctionRows(overrides = {}) {
  const values = {
    date: "24/11/2026", setup: "miércoles 9:00am", range: "4:00pm a 11:00pm",
    teardown: "miércoles 11:00pm", equipmentIn: "jueves 3:00am", ...overrides
  };
  return [
    ["Fecha del evento", values.date], ["Horario de montaje", values.setup],
    ["Horario del evento general", values.range], ["Horario de desmontaje", values.teardown],
    ...(values.equipmentIn ? [["Horario que llega a bodega", values.equipmentIn]] : []), ...equipment
  ];
}

test("corroborated weekday schedules suggest a unique corrected date while preserving the written conflict", async () => {
  const preview = await previewRows(correctionRows());
  const event = preview.events[0], suggestion = event.scheduleSuggestion;
  assert.equal(preview.verification.complete, true);
  assert.equal(event.date, "2026-11-24");
  assert.equal(event.startAt, "2026-11-24T16:00");
  assert.equal(event.dateLiteral, "24/11/2026");
  assert.equal(event.sourceImport.metadata.date, "24/11/2026");
  assert.equal(event.sourceImport.schedule.startDate, "2026-11-24");
  assert.ok(event.issues.some((issue) => issue.code === "conflicting_schedule_order"));
  assert.equal(suggestion.code, "corroborated_event_date");
  assert.equal(suggestion.originalDate, "2026-11-24");
  assert.equal(suggestion.date, "2026-11-25");
  assert.equal(suggestion.schedule.setupAt, "2026-11-25T09:00");
  assert.equal(suggestion.schedule.startAt, "2026-11-25T16:00");
  assert.equal(suggestion.schedule.endAt, "2026-11-25T23:00");
  assert.equal(suggestion.schedule.teardownAt, "2026-11-25T23:00");
  assert.equal(suggestion.schedule.equipmentInAt, "2026-11-26T03:00");
  for (const field of ["date", "setupTime", "eventTimeRange", "teardownTime", "equipmentInTime"]) {
    const evidence = suggestion.evidence.find((entry) => entry.field === field);
    assert.ok(evidence, `Missing source evidence for ${field}`);
    assert.equal(evidence.value, event.sourceImport.metadata[field]);
    assert.deepEqual(evidence.refs, event.metadataRefs[field]);
    assert.ok(evidence.refs.every((ref) => suggestion.refs.includes(ref)));
  }
  assert.equal(verifyEventImport(preview).complete, true);
});

test("fully written setup, teardown and return dates corroborate a corrected event date", async () => {
  const preview = await previewRows(correctionRows({
    setup: "25/11/2026 9:00am", teardown: "25/11/2026 11:00pm", equipmentIn: "26/11/2026 3:00am"
  }));
  const event = preview.events[0];
  assert.equal(preview.verification.complete, true);
  assert.equal(event.date, "2026-11-24");
  assert.equal(event.sourceImport.metadata.date, "24/11/2026");
  assert.equal(event.scheduleSuggestion.date, "2026-11-25");
  assert.equal(event.scheduleSuggestion.schedule.startAt, "2026-11-25T16:00");
  assert.equal(event.scheduleSuggestion.schedule.endAt, "2026-11-25T23:00");
  assert.equal(event.scheduleSuggestion.schedule.equipmentInAt, "2026-11-26T03:00");
});

test("date corrections require the complete independent schedule corroboration", async () => {
  const incompleteOrConflicting = [
    { equipmentIn: "" },
    { setup: "miércoles 5:00pm" },
    { teardown: "miércoles 10:00pm" },
    { teardown: "jueves 11:00pm" },
    { equipmentIn: "miércoles 10:00pm" },
    { setup: "miércoles de la próxima semana 9:00am" },
    { date: "" },
    { date: "25/11/2026" },
    { range: "4:00pm a 11:00pm a 1:00am" },
    { range: "24/11/2026 4:00pm a 24/11/2026 11:00pm" },
    { setup: "martes 25/11/2026 9:00am" }
  ];
  for (const overrides of incompleteOrConflicting) {
    const preview = await previewRows(correctionRows(overrides));
    assert.equal(preview.verification.complete, true);
    assert.ok(!preview.events[0].scheduleSuggestion, JSON.stringify(overrides));
  }
  const contradictorySetup = await previewRows([["Requiere montaje", "No"], ...correctionRows()]);
  assert.equal(contradictorySetup.verification.complete, true);
  assert.ok(!contradictorySetup.events[0].scheduleSuggestion);
  const conflictingDates = await previewRows([["Fecha del evento", "23/11/2026"], ...correctionRows()]);
  assert.equal(conflictingDates.verification.complete, true);
  assert.ok(conflictingDates.events[0].issues.some((issue) => issue.code === "conflicting_metadata"));
  assert.ok(!conflictingDates.events[0].scheduleSuggestion);
});

test("a written weekday that disagrees with a full written date stays a source conflict", async () => {
  const preview = await previewRows([
    ["Fecha del evento", "24/11/2026"], ["Montaje", "lunes 24/11/2026 09:00"], ...equipment
  ]);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.events[0].setupAt, "2026-11-24T09:00");
  assert.equal(preview.events[0].canImport, false);
  assert.ok(preview.events[0].issues.some((issue) => issue.code === "conflicting_schedule_weekday"));
});

test("identical parallel tables remain complete candidates for an explicit reference-or-separate-event choice", async () => {
  const preview = await previewRows([
    ["", "", "Fecha del evento", "24/11/2026"],
    ["", "", "Nombre del cliente", "Cliente sintetico"],
    ["Cantidad", "Descripción", "Cantidad", "Descripción"],
    [0, "Equipo sintetico cero", 0, "Equipo sintetico cero"],
    [2, "Equipo sintetico segundo", 2, "Equipo sintetico segundo"]
  ]);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.events.length, 2);
  assert.deepEqual(preview.events.map((event) => event.itemCount), [2, 2]);
  assert.deepEqual(preview.events.map((event) => event.zeroCount), [1, 1]);
  assert.deepEqual(preview.events.map((event) => event.name), ["", "Cliente sintetico"]);
  assert.equal(preview.duplicateCandidates.length, 1);
  assert.deepEqual(preview.duplicateCandidates[0].eventIds, preview.events.map((event) => event.id));
  assert.equal(preview.duplicateCandidates[0].requiresReview, true);
  assert.ok(preview.events.every((event) => event.duplicateCandidateIds[0] === preview.duplicateCandidates[0].id));
  assert.ok(preview.events.every((event) => event.warnings.some((warning) => warning.code === "duplicate_equipment_tables")));
  assert.equal(preview.sourceCells.length, preview.events.reduce((sum, event) => sum + event.sourceCells.length, 0));
});

test("identical equipment in explicitly identified distinct events is informational and keeps both ledgers", async () => {
  const preview = await previewRows([
    ["Fecha del evento", "24/11/2026", "Fecha del evento", "25/11/2026"],
    ["Nombre del cliente", "Cliente sintetico A", "Nombre del cliente", "Cliente sintetico B"],
    ["Lugar del evento", "Salon sintetico A", "Lugar del evento", "Salon sintetico B"],
    ["Cantidad", "Descripción", "Cantidad", "Descripción"],
    [0, "Equipo sintetico cero", 0, "Equipo sintetico cero"],
    [2, "Equipo sintetico segundo", 2, "Equipo sintetico segundo"]
  ]);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.events.length, 2);
  assert.ok(preview.events.every((event) => event.canImport));
  assert.deepEqual(preview.events.map((event) => event.itemCount), [2, 2]);
  assert.deepEqual(preview.events.map((event) => event.zeroCount), [1, 1]);
  assert.equal(preview.duplicateCandidates.length, 1);
  assert.equal(preview.duplicateCandidates[0].requiresReview, false);
  assert.deepEqual(preview.duplicateCandidates[0].eventIds, preview.events.map((event) => event.id));
  assert.ok(preview.events.every((event) => event.warnings.some((warning) => warning.code === "duplicate_equipment_tables" && warning.severity === "info")));
  assert.equal(preview.sourceCells.length, preview.events.reduce((sum, event) => sum + event.sourceCells.length, 0));
});

test("identical complete event identities still require duplicate-table review", async () => {
  const preview = await previewRows([
    ["Fecha del evento", "24/11/2026", "Fecha del evento", "24/11/2026"],
    ["Nombre del cliente", "Cliente sintetico", "Nombre del cliente", "CLIENTE SINTETICO"],
    ["Lugar del evento", "Salon sintetico", "Lugar del evento", "SALON SINTETICO"],
    ["Cantidad", "Descripción", "Cantidad", "Descripción"],
    [0, "Equipo sintetico cero", 0, "Equipo sintetico cero"],
    [2, "Equipo sintetico segundo", 2, "Equipo sintetico segundo"]
  ]);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.events.length, 2);
  assert.equal(preview.duplicateCandidates.length, 1);
  assert.equal(preview.duplicateCandidates[0].requiresReview, true);
  assert.ok(preview.events.every((event) => event.warnings.some((warning) => warning.code === "duplicate_equipment_tables" && warning.severity === "warning")));
});

function identicalTableRows(identities) {
  return [
    identities.flatMap((identity) => identity?.date ? ["Fecha del evento", identity.date] : ["", ""]),
    identities.flatMap((identity) => identity?.client ? ["Nombre del cliente", identity.client] : ["", ""]),
    identities.flatMap((identity) => identity?.place ? ["Lugar del evento", identity.place] : ["", ""]),
    identities.flatMap(() => ["Cantidad", "Descripción"]),
    identities.flatMap(() => [0, "Equipo sintetico cero"]),
    identities.flatMap(() => [2, "Equipo sintetico segundo"])
  ];
}
const completeIdentity = { date: "24/11/2026", client: "Cliente sintetico", place: "Salon sintetico" };

test("one fully identified event retains an identical anonymous table as a complete reference without active double counting", async () => {
  const preview = await previewRows(identicalTableRows([null, completeIdentity]), (sheet) => {
    sheet.getCell("A5").note = "Nota sintetica de la copia con cero";
    sheet.getCell("A5").numFmt = '0 "unidades"';
  });
  assert.equal(preview.events.length, 1);
  assert.equal(preview.tableCount, 2);
  assert.equal(preview.eventCount, 1);
  assert.equal(preview.itemCount, 2);
  assert.equal(preview.zeroCount, 1);
  assert.equal(preview.referenceTableCount, 1);
  const event = preview.events[0], [reference] = event.sourceImport.referenceTables;
  assert.equal(event.client, completeIdentity.client);
  assert.equal(event.itemCount, 2);
  assert.equal(event.zeroCount, 1);
  assert.equal(reference.client, "");
  assert.equal(reference.date, "");
  assert.equal(reference.place, "");
  assert.equal(reference.itemCount, 2);
  assert.equal(reference.zeroCount, 1);
  assert.deepEqual(reference.sections.flatMap((section) => section.items.map((item) => item.quantity)), [0, 2]);
  assert.deepEqual(reference.documentSections, reference.sections);
  assert.deepEqual(reference.sourceCells, reference.sourceImport.sourceCells);
  assert.ok(reference.sourceCells.some((cell) => cell.address === "A5" && String(cell.note).includes("Nota sintetica de la copia con cero")));
  assert.deepEqual(preview.sheets[0].eventIds, [event.id]);
  assert.deepEqual(preview.sheets[0].tableIds, [reference.id, event.id]);
  assert.deepEqual(preview.sheets[0].referenceTableIds, [reference.id]);
  assert.equal(preview.referenceCopies.length, 1);
  assert.equal(preview.referenceCopies[0].eventId, event.id);
  assert.deepEqual(preview.referenceCopies[0].referenceTableIds, [reference.id]);
  assert.equal(preview.sourceCells.length, event.sourceCells.length + reference.sourceCells.length);
  assert.equal(preview.verification.representedCellCount, preview.sourceCells.length);
  assert.equal(preview.verification.complete, true);
});

test("the source-cell verifier applies quantity, item and cell checks recursively to retained references", async () => {
  const original = await previewRows(identicalTableRows([null, completeIdentity]));
  assert.equal(original.verification.complete, true);
  const mutations = [
    (reference) => { reference.sections.flatMap((section) => section.rows).find((row) => row.type === "item").quantity = 9; },
    (reference) => { reference.sections.flatMap((section) => section.items)[0].quantity = 9; },
    (reference) => { reference.sourceCells[0].value = "Celda sintetica alterada"; },
    (reference) => { reference.sourceImport.sourceCells[0].value = "Celda sintetica alterada"; },
    (reference) => { reference.sections.flatMap((section) => section.rows).find((row) => row.type === "item").cells[0].value = 9; },
    (reference) => { reference.documentSections[0].title = "Seccion sintetica alterada"; }
  ];
  for (const mutate of mutations) {
    const preview = JSON.parse(JSON.stringify(original));
    mutate(preview.events[0].sourceImport.referenceTables[0]);
    assert.equal(verifyEventImport(preview).complete, false);
  }
});

test("a unique complete identity can retain multiple anonymous copies while partially identified copies stay reviewable", async () => {
  const consolidated = await previewRows(identicalTableRows([null, completeIdentity, null]));
  assert.equal(consolidated.events.length, 1);
  assert.equal(consolidated.tableCount, 3);
  assert.equal(consolidated.eventCount, 1);
  assert.equal(consolidated.referenceTableCount, 2);
  assert.equal(consolidated.itemCount, 2);
  assert.equal(consolidated.zeroCount, 1);
  assert.equal(consolidated.events[0].sourceImport.referenceTables.length, 2);
  assert.equal(consolidated.verification.complete, true);
  const ambiguous = await previewRows(identicalTableRows([{ client: "Otro cliente sintetico" }, completeIdentity]));
  assert.equal(ambiguous.events.length, 2);
  assert.equal(ambiguous.referenceTableCount, 0);
  assert.equal(ambiguous.duplicateCandidates[0].requiresReview, true);
  assert.ok(ambiguous.events.every((event) => event.warnings.some((warning) => warning.code === "duplicate_equipment_tables")));
  assert.equal(ambiguous.verification.complete, true);
});

test("identical tables with any metadata remain separate for review even without client, date or place", async () => {
  const metadataCases = [
    ["Cantidad de invitados", 0, "guests"],
    ["Tipo de evento", "Celebracion sintetica", "type"],
    ["Equipo contratado", "Servicio sintetico", "contracted"],
    ["Hora de montaje", "09:00", "setupTime"],
    ["Hora de finalización", "23:00", "endTime"],
    ["Regreso a bodega", "25/11/2026 03:00", "equipmentInAt"],
    ["Requiere montaje", "No", "setupApplies"]
  ];
  for (const [label, value, field] of metadataCases) {
    const preview = await previewRows([[label, value, "", ""], ...identicalTableRows([null, completeIdentity])]);
    assert.equal(preview.events.length, 2, label);
    assert.equal(preview.eventCount, 2, label);
    assert.equal(preview.tableCount, 2, label);
    assert.equal(preview.itemCount, 4, label);
    assert.equal(preview.zeroCount, 2, label);
    assert.equal(preview.referenceTableCount, 0, label);
    assert.equal(preview.events[0].sourceImport.metadata[field], String(value), label);
    assert.equal(preview.duplicateCandidates[0].requiresReview, true, label);
    assert.ok(preview.events.every((event) => !event.sourceImport.referenceTables?.length), label);
    assert.equal(preview.sourceCells.length, preview.events.reduce((sum, event) => sum + event.sourceCells.length, 0), label);
    assert.equal(preview.verification.complete, true, label);
    assert.equal(preview.verification.representedCellCount, preview.sourceCells.length, label);
  }
});

test("anonymous identical tables with multiple complete identities or different sheets remain separate", async () => {
  const ambiguous = await previewRows(identicalTableRows([
    completeIdentity, null, { date: "25/11/2026", client: "Otro cliente sintetico", place: "Otro salon sintetico" }
  ]));
  assert.equal(ambiguous.events.length, 3);
  assert.equal(ambiguous.referenceTableCount, 0);
  assert.equal(ambiguous.duplicateCandidates[0].requiresReview, true);
  assert.equal(ambiguous.verification.complete, true);
  const workbook = new ExcelJS.Workbook();
  const anonymous = workbook.addWorksheet("Copia sintetica"), identified = workbook.addWorksheet("Evento sintetico");
  identicalTableRows([null]).forEach((row) => anonymous.addRow(row));
  identicalTableRows([completeIdentity]).forEach((row) => identified.addRow(row));
  const separateSheets = await parseEventFile(Buffer.from(await workbook.xlsx.writeBuffer()), { fileName: "cuadros-sinteticos.xlsx" });
  assert.equal(separateSheets.events.length, 2);
  assert.equal(separateSheets.referenceTableCount, 0);
  assert.equal(separateSheets.verification.complete, true);
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
