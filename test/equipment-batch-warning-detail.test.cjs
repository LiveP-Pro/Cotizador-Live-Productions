const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { parseEventFile, verifyEventImport } = require('../equipment-event-import.cjs');
const ui = require('../equipment-batch-events.js');

// All dates, worksheets, equipment names and quantities in this file are
// synthetic. No earlier service or inventory catalog is a test data source.
async function syntheticPreview(withConflict = true) {
  const book = new ExcelJS.Workbook();
  for (let index = 0; index < 6; index++) {
    const lucky = index === 5 && withConflict;
    const sheet = book.addWorksheet(index === 5 ? 'LUCKY VEGA' : `EVENTO SINTETICO ${index + 1}`);
    const rows = [
      ['Fecha del evento', '06/11/2026'],
      ['Nombre del cliente', `Cliente sintético ${index + 1}`],
      ['Lugar del evento', `Sede sintética ${index + 1}`],
      ['Horario de montaje', `${lucky ? 'sábado' : 'viernes'} 9:00am`],
      ['Horario del evento general', '4:00pm a 11:00pm'],
      ['Horario de desmontaje', `${lucky ? 'sábado' : 'viernes'} 11:00pm`],
      ['Horario que llega a bodega', `${lucky ? 'domingo' : 'sábado'} 3:00am`],
      ['AUDIO'],
      ['Cantidad', 'Descripción'],
      [0, `Equipo sintético cero ${index + 1}`],
      [1, `Equipo sintético uno ${index + 1}`],
      ['Nota: conservar este contenido literalmente']
    ];
    rows.forEach((row) => sheet.addRow(row));
    sheet.getCell('A8').font = { bold: true };
    sheet.getCell('B10').note = 'Nota sintética asociada a la cantidad cero';
  }
  return parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: 'seis-eventos-sinteticos-opcionales.xlsx' });
}

let coherentPromise, conflictPromise;
const coherent = async () => structuredClone(await (coherentPromise ||= syntheticPreview(false)));
const conflict = async () => structuredClone(await (conflictPromise ||= syntheticPreview(true)));
function selectOnly(preview, index = 0) {
  const selections = ui.selectionsFor(preview);
  selections.forEach((entry, position) => { entry.selected = position === index; });
  return selections;
}
const scheduleWarnings = (preview, selections) => ui.selectionWarnings(preview, selections).filter((warning) => /schedule|setup/.test(warning.code));

test('un tipo de evento vacío es opcional: seis horarios coherentes no generan advertencias ni confirmación', async () => {
  const preview = await coherent(), before = JSON.stringify(preview);
  const selections = ui.selectionsFor(preview);
  assert.equal(preview.events.length, 6);
  assert.ok(preview.events.every((event) => !event.type));
  assert.ok(preview.events.every((event) => event.warnings.some((warning) => warning.code === 'schedule_date_from_weekday')));
  assert.ok(preview.events.every((event) => event.warnings.some((warning) => warning.code === 'schedule_date_from_event')));
  assert.deepEqual(ui.selectionWarnings(preview, selections), []);
  const drafts = ui.prepareEvents(preview, selections);
  assert.equal(drafts.length, 6);
  assert.equal(JSON.stringify(preview), before);
});

test('la propuesta de fecha no se aplica automáticamente al leer el archivo', async () => {
  const preview = await conflict(), before = JSON.stringify(preview), event = preview.events[5];
  assert.equal(event.sourceSheet, 'LUCKY VEGA');
  assert.equal(event.date, '2026-11-06');
  assert.equal(event.scheduleSuggestion.date, '2026-11-07');
  const selection = ui.selectionsFor(preview)[5];
  assert.equal(selection.date, '2026-11-06');
  assert.equal(selection.startTime, '16:00');
  assert.equal(selection.endDate, '2026-11-06');
  assert.equal(selection.setupDate, '2026-11-07');
  assert.equal(selection.suggestionApplied, false);
  assert.equal(JSON.stringify(preview), before);
});

test('solo el evento contradictorio avisa: un mensaje identifica hoja, fecha escrita, propuesta y celdas', async () => {
  const preview = await conflict(), selections = ui.selectionsFor(preview);
  const warnings = ui.selectionWarnings(preview, selections);
  assert.equal(warnings.length, 1, JSON.stringify(warnings));
  assert.equal(warnings[0].code, 'schedule_suggestion');
  assert.deepEqual(warnings[0].eventIds, [preview.events[5].id]);
  assert.match(warnings[0].message, /LUCKY VEGA/);
  assert.match(warnings[0].message, /06\/11(?:\/2026)?/);
  assert.match(warnings[0].message, /07\/11(?:\/2026)?/);
  for (const address of ['B1', 'B4', 'B6']) assert.ok(warnings[0].message.includes(address), warnings[0].message);
  assert.doesNotMatch(warnings[0].message, /Hay datos del evento, fechas u horarios pendientes, calculados o contradictorios/);
});

test('aceptar o retirar una fecha propuesta es reversible y conserva el original y todas las cantidades cero', async () => {
  assert.equal(typeof ui.reviewScheduleSuggestion, 'function');
  const preview = await conflict(), before = JSON.stringify(preview), selections = ui.selectionsFor(preview), event = preview.events[5];
  const originalSelection = structuredClone(selections[5]);
  const accepted = ui.reviewScheduleSuggestion(event, selections[5], true);
  assert.notStrictEqual(accepted, selections[5]);
  assert.deepEqual(selections[5], originalSelection, 'la selección anterior no se modifica');
  assert.equal(accepted.date, '2026-11-07');
  assert.equal(accepted.endDate, '2026-11-07');
  assert.equal(accepted.equipmentInDate, '2026-11-08');
  assert.equal(accepted.suggestionApplied, true);
  assert.equal(accepted.endDateEdited, false);
  selections[5] = accepted;
  assert.deepEqual(ui.selectionWarnings(preview, selections), []);
  const drafts = ui.prepareEvents(preview, selections);
  assert.equal(drafts.length, 6);
  assert.equal(drafts.reduce((sum, entry) => sum + entry.sections.flatMap((section) => section.items).filter((item) => item.quantity === 0).length, 0), 6);
  drafts.forEach((draft, index) => assert.deepEqual(draft.sourceCells, preview.events[index].sourceCells));
  assert.equal(drafts[5].sourceImport.scheduleSuggestionAccepted, true);
  assert.equal(drafts[5].sourceImport.metadata.date, '06/11/2026');
  assert.equal(drafts[5].sourceImport.schedule.startDate, '2026-11-06');
  assert.equal(verifyEventImport(preview).complete, true);
  const restored = ui.reviewScheduleSuggestion(event, accepted, false);
  assert.equal(restored.date, '2026-11-06');
  assert.equal(restored.endDate, '2026-11-06');
  assert.equal(restored.suggestionApplied, false);
  assert.equal(restored.endDateEdited, false);
  assert.equal(JSON.stringify(preview), before);
});

test('un horario incompleto identifica el evento, el regreso a bodega y la hora que falta', async () => {
  const preview = await coherent(), selections = selectOnly(preview);
  selections[0].equipmentInTime = '';
  const warnings = scheduleWarnings(preview, selections);
  assert.equal(warnings.length, 1, JSON.stringify(warnings));
  assert.deepEqual(warnings[0].eventIds, [preview.events[0].id]);
  assert.match(warnings[0].message, /EVENTO SINTETICO 1|Sede sintética 1|Cliente sintético 1/);
  assert.match(warnings[0].message, /regreso.*bodega|bodega.*regreso/i);
  assert.match(warnings[0].message, /hora/i);
  assert.match(warnings[0].message, /B7/);
  selections[0].equipmentInTime = '03:00';
  assert.deepEqual(scheduleWarnings(preview, selections), []);
});

test('una hora inválida no se oculta por ser editable y se elimina el aviso al corregirla', async () => {
  const preview = await coherent(), selections = selectOnly(preview);
  selections[0].endTime = '25:90';
  const warnings = scheduleWarnings(preview, selections);
  assert.equal(warnings.length, 1, JSON.stringify(warnings));
  assert.deepEqual(warnings[0].eventIds, [preview.events[0].id]);
  assert.match(warnings[0].message, /finalizaci[oó]n/i);
  assert.match(warnings[0].message, /25:90|inv[aá]lid|no v[aá]lid/i);
  selections[0].endTime = '23:00';
  assert.deepEqual(scheduleWarnings(preview, selections), []);
});

test('borrar el inicio de un horario completo señala la hora faltante sin inventarla', async () => {
  const preview = await coherent(), selections = selectOnly(preview);
  selections[0].startTime = '';
  const warnings = scheduleWarnings(preview, selections);
  assert.equal(warnings.length, 1, JSON.stringify(warnings));
  assert.deepEqual(warnings[0].eventIds, [preview.events[0].id]);
  assert.match(warnings[0].message, /hora.*inicio|inicio.*hora/i);
  assert.match(warnings[0].message, /B5/);
  assert.equal(selections[0].startTime, '', 'la comprobación no rellena la hora borrada');
  selections[0].startTime = '16:00';
  assert.deepEqual(scheduleWarnings(preview, selections), []);
});

test('un borrador con fecha y sin ningún horario no genera avisos rutinarios ni inventa tiempos', async () => {
  const preview = await coherent(), selections = selectOnly(preview), event = preview.events[0];
  delete event.scheduleSuggestion;
  event.issues = [];
  event.warnings = [{ code: 'pending_times', message: 'Horarios pendientes' }, { code: 'incomplete_schedule', message: 'Hora inicial pendiente' }];
  for (const prefix of ['setup', 'start', 'end', 'teardown', 'equipmentIn']) {
    event[prefix + 'Date'] = '';
    event[prefix + 'Time'] = '';
    event[prefix + 'At'] = '';
    selections[0][prefix + 'Date'] = '';
    selections[0][prefix + 'Time'] = '';
  }
  delete event.setupApplies;
  selections[0].setupApplies = '';
  assert.equal(selections[0].date, '2026-11-06');
  assert.deepEqual(scheduleWarnings(preview, selections), []);
  assert.deepEqual(ui.selectionWarnings(preview, selections), []);
  const drafts = ui.prepareEvents(preview, selections);
  assert.equal(drafts.length, 1);
  for (const field of ['setupAt', 'startAt', 'endAt', 'teardownAt', 'equipmentInAt']) assert.equal(drafts[0][field], '');
});

test('una contradicción del orden se explica y no permanece después de corregir los campos actuales', async () => {
  const preview = await coherent(), selections = selectOnly(preview), event = preview.events[0];
  selections[0].setupDate = '2026-11-07';
  const warnings = scheduleWarnings(preview, selections);
  assert.equal(warnings.length, 1, JSON.stringify(warnings));
  assert.match(warnings[0].message, /montaje/i);
  assert.match(warnings[0].message, /despu[eé]s|posterior|antes/i);
  // The immutable source issue remains as provenance. Current coherent UI
  // corrections must not trigger a stale generic contradiction warning.
  event.issues.push({ code: 'conflicting_schedule_order', message: 'El montaje original queda después del inicio.', refs: event.scheduleRefs.setupAt });
  selections[0].setupDate = '2026-11-06';
  assert.deepEqual(scheduleWarnings(preview, selections), []);
  assert.ok(event.issues.some((issue) => issue.code === 'conflicting_schedule_order'));
});

test('las derivaciones coherentes por fecha del evento y desmontaje no se presentan como errores', async () => {
  const preview = await coherent(), selections = selectOnly(preview), event = preview.events[0];
  event.warnings.push({ code: 'schedule_date_from_teardown', message: 'Una derivación ya coherente.', refs: event.scheduleRefs.endAt });
  assert.deepEqual(ui.selectionWarnings(preview, selections), []);
});

test('la vista marca tipo opcional y permite revisar explícitamente la propuesta sin inyectar HTML', async () => {
  const preview = await conflict(), event = preview.events[5], selections = ui.selectionsFor(preview);
  event.sourceSheet = 'LUCKY <img src=x onerror=alert(1)>';
  event.client = 'Cliente <script>alert(1)</script>';
  event.scheduleSuggestion.message = '<img src=x onerror=alert(1)>';
  const html = ui.renderEvent(event, selections[5], 5);
  assert.match(html, /Tipo de evento\s*\(opcional\)/i);
  assert.match(html, /data-batch-suggestion="5"/);
  assert.doesNotMatch(html, /data-batch-suggestion="5"[^>]*\schecked(?:\s|>)/);
  assert.match(html, /06\/11(?:\/2026)?/);
  assert.match(html, /07\/11(?:\/2026)?/);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  const accepted = ui.reviewScheduleSuggestion(event, selections[5], true);
  assert.match(ui.renderEvent(event, accepted, 5), /data-batch-suggestion="5"[^>]*\schecked(?:\s|>)/);
});
