"use strict";

// Read only the file supplied in this request. This module never reads catalogs,
// snapshots, inventory or previous imports and never writes events/reservations.
const { readSourceFile } = require("./equipment-service-import.cjs");
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "");
const clean = (value) => text(value).replace(/\s+/g, " ").trim();
const key = (value) => clean(value).normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[.:]+$/g, "");
const count = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value
  : /^\d+(?:[.,]\d+)?$/.test(clean(value)) ? Number(clean(value).replace(",", ".")) : null;
const metadataLabels = {
  client: ["cliente", "nombre del cliente", "client"],
  place: ["lugar", "lugar del evento", "ubicacion", "ubicacion del evento", "direccion", "venue"],
  date: ["fecha", "fecha del evento", "fecha evento", "date"],
  setupDate: ["fecha montaje", "fecha de montaje", "fecha del montaje", "dia de montaje", "dia del montaje"],
  setupTime: ["hora montaje", "hora de montaje", "hora del montaje", "horario de montaje"],
  setupAt: ["montaje", "fecha y hora de montaje", "fecha y hora del montaje", "fecha hora montaje"],
  setupApplies: ["requiere montaje", "montaje requerido", "aplica montaje", "montaje aplica"],
  startDate: ["fecha de inicio", "fecha inicio", "fecha de inicio del evento"],
  startTime: ["hora", "hora evento", "hora del evento", "hora de inicio", "hora inicio", "hora de inicio del evento", "inicio", "horario del evento"],
  eventTimeRange: ["horario del evento general", "horario general del evento"],
  startAt: ["inicio del evento", "inicio evento", "fecha y hora del evento", "fecha y hora de inicio", "fecha y hora de inicio del evento", "fecha hora evento"],
  endDate: ["fecha final", "fecha fin", "fecha de fin", "fecha de finalizacion", "fecha finalizacion", "fecha de finalizacion del evento"],
  endTime: ["hora final", "hora fin", "hora de fin", "hora de finalizacion", "hora finalizacion", "hora de finalizacion del evento", "hora en que finaliza el evento", "finaliza", "finalizacion", "finalizacion del evento", "fin", "fin del evento", "termina", "hora de cierre"],
  endAt: ["fecha y hora de fin", "fecha y hora de finalizacion", "fecha y hora de finalizacion del evento"],
  teardownDate: ["fecha desmontaje", "fecha de desmontaje", "fecha del desmontaje"],
  teardownTime: ["hora desmontaje", "hora de desmontaje", "hora del desmontaje", "horario de desmontaje"],
  teardownAt: ["desmontaje", "fecha y hora de desmontaje", "fecha y hora del desmontaje"],
  equipmentInDate: ["fecha de regreso", "fecha regreso", "fecha de retorno", "fecha de regreso a bodega"],
  equipmentInTime: ["hora de regreso", "hora regreso", "hora de retorno", "hora de regreso a bodega", "horario que llega a bodega", "horario de llegada a bodega", "hora de llegada a bodega"],
  equipmentInAt: ["regreso a bodega", "retorno a bodega", "fecha y hora de regreso", "fecha y hora de regreso a bodega"],
  type: ["evento", "tipo de evento", "event type"],
  contracted: ["equipo contratado", "servicio contratado", "servicios contratados", "contratado"],
  guests: ["cantidad de invitados", "invitados", "numero de invitados"]
};
const labelField = (value) => Object.keys(metadataLabels).find((field) => metadataLabels[field].includes(key(value)));
const weekdays = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const schedulePrefixes = ["setup", "start", "end", "teardown", "equipmentIn"];

function validDay(year, month, day) {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
}
function parseDate(value, cell = {}) {
  const raw = clean(value);
  let parts = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (parts) return validDay(+parts[1], +parts[2], +parts[3]);
  parts = raw.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (parts) return validDay(+parts[3], +parts[2], +parts[1]);
  const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  parts = key(raw).match(/(?:^|\s)(\d{1,2})\s*(?:de\s+)?([a-z]+)\s*(?:de\s+|del\s+)?(\d{4})$/);
  if (parts && months.includes(parts[2])) return validDay(+parts[3], months.indexOf(parts[2]) + 1, +parts[1]);
  // A bare numeric quantity is not a date. Only Excel Date cells have an ISO raw value.
  const original = cell.rawValue;
  if (typeof original === "string" && /^\d{4}-\d{2}-\d{2}T/.test(original)) return parseDate(original);
  return "";
}
function parseTime(value, cell = {}, { allowBareHour = true } = {}) {
  const original = typeof cell.rawValue === "object" && cell.rawValue !== null ? cell.rawValue.result : cell.rawValue;
  const iso = typeof original === "string" && original.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    const format = text(cell.numberFormat).replace(/"[^"]*"|\\.|\[(?![hms]+\])[^\]]*\]/gi, "");
    if (format && !/[hs]|am\/pm|\[m\]/i.test(format)) return "";
    return Number(iso[1]) < 24 && Number(iso[2]) < 60 ? `${iso[1]}:${iso[2]}` : "";
  }
  // A fractional Excel day is only read here, in an explicitly labelled hour.
  // Ordinary numeric equipment quantities never pass through this function.
  const numeric = typeof value === "number" ? value : typeof original === "number" ? original : null;
  if (numeric !== null) {
    if (numeric < 0 || numeric >= 1) return "";
    const minutes = Math.round(numeric * 24 * 60);
    return minutes < 1440 ? `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` : "";
  }
  let raw = key(value).replace(/^a\s+las\s+/, "").replace(/\s*(?:horas?|hrs?\.?|h)$/, "").trim();
  const parts = raw.match(/^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/);
  if (!parts || !allowBareHour && !parts[2] && !parts[4]) return "";
  let hour = Number(parts[1]), minute = Number(parts[2] || 0);
  if (minute > 59 || Number(parts[3] || 0) > 59 || hour > 23) return "";
  if (parts[4]) {
    if (hour < 1 || hour > 12) return "";
    hour = hour % 12 + (/^p/i.test(parts[4]) ? 12 : 0);
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
function temporalParts(value, cell = {}, { allowBareHour = false } = {}) {
  const original = typeof cell.rawValue === "object" && cell.rawValue !== null ? cell.rawValue.result : cell.rawValue;
  const raw = typeof original === "string" && /^\d{4}-\d{2}-\d{2}T/.test(original) ? original : clean(value);
  const dateToken = raw.match(/\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{1,2}\s*(?:de\s+)?[a-záéíóúñ]+\s*(?:de\s+|del\s+)?\d{4}/i)?.[0];
  const date = parseDate(dateToken || value, cell);
  const weekdayMatch = key(raw).match(/^(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\s*,?\s*(?=(?:a\s+las\s+)?\d)/);
  const clockSource = weekdayMatch ? key(raw).slice(weekdayMatch[0].length) : raw;
  const clockToken = clockSource.match(/(?:^|[\sT,;])(\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?|\d{1,2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?))(?=$|[\sZ,+;)-])/i)?.[1];
  const time = parseTime(clockToken || (!date ? clockSource : ""), cell, { allowBareHour });
  return { date, time, ...(weekdayMatch ? { weekday: weekdays.indexOf(weekdayMatch[1]) } : {}) };
}
function eventRangeParts(value, cell, options) {
  const parts = clean(value).replace(/^de\s+/i, "").split(/\s+(?:a(?!\s+las\b)|al|hasta)\s+|\s*[–—]\s*|\s+-\s+/i);
  if (parts.length === 1) return temporalParts(value, cell, options);
  if (parts.length !== 2) return { date: "", time: "" };
  const start = temporalParts(parts[0], {}, options), end = temporalParts(parts[1], {}, options);
  // Never accept half a range by accidentally retaining just its first clock.
  if (!start.time || !end.time) return { date: "", time: "" };
  return { ...start, endDate: end.date, endTime: end.time, ...(end.weekday !== undefined ? { endWeekday: end.weekday } : {}) };
}
function appliesValue(value) {
  const normalized = key(value).replace(/[.]/g, "");
  if (["no", "no aplica", "n/a", "na", "sin montaje", "no requiere", "no requiere montaje", "no se requiere montaje"].includes(normalized)) return false;
  if (["si", "aplica", "con montaje", "requiere montaje", "requerido"].includes(normalized)) return true;
  return undefined;
}
function noteText(note) {
  if (typeof note === "string") return note;
  if (Array.isArray(note?.texts)) return note.texts.map((entry) => text(entry.text)).join("");
  return note ? JSON.stringify(note) : "";
}
function metadataInRow(cells) {
  const result = [];
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index], raw = text(cell.value), colon = raw.indexOf(":");
    const field = labelField(colon >= 0 ? raw.slice(0, colon) : raw);
    if (!field) continue;
    const inline = colon >= 0 ? raw.slice(colon + 1).trim() : "";
    const valueCell = inline ? cell : cells[index + 1];
    let value = inline || text(valueCell?.value);
    const scheduleField = /^(?:setup|start|end|teardown|equipmentIn|eventTimeRange)/.test(field);
    // Equipment named "Montaje" or "Inicio" is still equipment when paired
    // with a quantity, even in a table whose description column comes first.
    if (scheduleField && !inline && (count(cells[index - 1]?.value) !== null || count(valueCell?.value) !== null)
      && !/hora|fecha|requiere|aplica/.test(key(raw))) continue;
    if (clean(value)) {
      const partsReader = ["eventTimeRange", "startTime", "startAt"].includes(field) ? eventRangeParts : temporalParts;
      let parts = partsReader(value, valueCell, { allowBareHour: /Time$/.test(field) });
      let refs = inline ? cell.refs || [cell.ref] : [cell.ref, ...(valueCell?.refs || [valueCell?.ref])].filter(Boolean);
      // Some files write a single "Fecha y hora" label followed by a date and
      // a separate hour cell. Join only complementary temporal values, never
      // unrelated notes or another metadata label in a parallel table.
      const extraCell = !inline && cells[index + 2];
      if (extraCell && (field === "date" || /At$/.test(field)) && !labelField(text(extraCell.value).split(":")[0])) {
        const extra = temporalParts(extraCell.value, extraCell);
        if (parts.date && !parts.time && extra.time && !extra.date || parts.time && !parts.date && extra.date && !extra.time) {
          value += ` ${text(extraCell.value)}`;
          parts = { date: parts.date || extra.date, time: parts.time || extra.time };
          refs = [...refs, ...(extraCell.refs || [extraCell.ref])];
        }
      }
      result.push({ field, value, date: field === "date" || /Date$/.test(field) ? parts.date : "", parts,
        refs });
    }
  }
  return result;
}
function scheduleForMetadata(metadata, parsed, metadataRefs, warnings, issues) {
  const schedule = {}, refs = {}, derivedFields = {}, weekdaySources = [];
  let hasEventRangeEnd = false;
  const add = (name, value, field) => {
    if (!value) return;
    if (schedule[name] && schedule[name] !== value) {
      issues.push({ code: "conflicting_schedule", message: "Hay fechas u horarios distintos para el mismo momento del evento. Revise el dato original.", refs: [...new Set([...(refs[name] || []), ...(metadataRefs[field] || [])])] });
      return;
    }
    schedule[name] = value;
    refs[name] = [...new Set([...(refs[name] || []), ...(metadataRefs[field] || [])])];
  };
  const rememberWeekday = (prefix, parts, field) => {
    if (parts.weekday !== undefined) weekdaySources.push({ prefix, weekday: parts.weekday, field });
  };
  const addRangeEnd = (parts, field) => {
    if (parts.endTime) hasEventRangeEnd = true;
    add("endTime", parts.endTime, field);
    add("endDate", parts.endDate, field);
    if (parts.endWeekday !== undefined) weekdaySources.push({ prefix: "end", weekday: parts.endWeekday, field });
  };
  for (const prefix of schedulePrefixes) {
    for (const suffix of ["Date", "Time", "At"]) {
      const field = prefix + suffix, parts = parsed[field];
      if (!parts) continue;
      if (suffix !== "Time" || parts.date && parts.time) add(prefix + "Date", parts.date, field);
      if (suffix !== "Date") add(prefix + "Time", parts.time, field);
      rememberWeekday(prefix, parts, field);
      if (prefix === "start") addRangeEnd(parts, field);
      if (!parts.date && !parts.time && appliesValue(metadata[field]) === undefined) {
        warnings.push({ code: "unreadable_schedule", message: `Revise el horario «${metadata[field]}»; se conservó el texto original sin asignar una fecha u hora.`, refs: metadataRefs[field] || [] });
      }
    }
  }
  add("startDate", parsed.date?.date, "date");
  // A full date/time explicitly written or formatted in the event-date value
  // carries its clock too. Date-only Excel formats never supply a time.
  add("startTime", parsed.date?.time, "date");
  if (parsed.eventTimeRange) {
    const parts = parsed.eventTimeRange;
    add("startDate", parts.date, "eventTimeRange");
    add("startTime", parts.time, "eventTimeRange");
    addRangeEnd(parts, "eventTimeRange");
    rememberWeekday("start", parts, "eventTimeRange");
    if (!parts.time || !parts.endTime) warnings.push({ code: "unreadable_schedule", message: `Revise el horario «${metadata.eventTimeRange}»; se conservó el texto original sin asignar un rango completo.`, refs: metadataRefs.eventTimeRange || [] });
  }
  const shiftDate = (date, offset) => {
    const shifted = new Date(`${date}T00:00:00Z`);
    shifted.setUTCDate(shifted.getUTCDate() + offset);
    return shifted.toISOString().slice(0, 10);
  };
  // A weekday is relative to the explicitly written event date, never the
  // worksheet name or today's date. Use the nearest occurrence and expose the
  // derivation for review; chronology checks below flag contradictory days.
  for (const { prefix, weekday, field } of weekdaySources) {
    const name = prefix + "Date", writtenDate = schedule[name];
    if (writtenDate) {
      if (new Date(`${writtenDate}T00:00:00Z`).getUTCDay() !== weekday) issues.push({ code: "conflicting_schedule_weekday", message: "Una fecha y su día de la semana no coinciden. Revise los horarios originales.", refs: [...new Set([...(refs[name] || []), ...(metadataRefs[field] || [])])] });
      continue;
    }
    if (!schedule.startDate) continue;
    const eventWeekday = new Date(`${schedule.startDate}T00:00:00Z`).getUTCDay();
    const offset = (weekday - eventWeekday + 10) % 7 - 3;
    schedule[name] = shiftDate(schedule.startDate, offset);
    refs[name] = [...new Set([...(refs.startDate || []), ...(metadataRefs[field] || [])])];
    derivedFields[name] = "event.date + weekday";
    warnings.push({ code: "schedule_date_from_weekday", message: `La fecha de ${prefix === "setup" ? "montaje" : prefix === "teardown" ? "desmontaje" : prefix === "equipmentIn" ? "regreso a bodega" : prefix === "end" ? "finalización" : "inicio"} se calculó con el día escrito y la fecha del evento. Revísela antes de confirmar.`, refs: refs[name] });
  }
  let setupApplies = appliesValue(metadata.setupApplies);
  if (setupApplies === undefined) setupApplies = appliesValue(metadata.setupAt);
  if (setupApplies === false && (schedule.setupDate || schedule.setupTime)) issues.push({ code: "conflicting_setup", message: "El documento dice que no aplica montaje y también indica su fecha u hora. Revise ambos datos.", refs: [...new Set([...(metadataRefs.setupApplies || []), ...(metadataRefs.setupAt || []), ...(refs.setupDate || []), ...(refs.setupTime || [])])] });
  if (setupApplies === undefined && (schedule.setupDate || schedule.setupTime)) setupApplies = true;
  if (setupApplies !== undefined) schedule.setupApplies = setupApplies;
  // A later clock time can share the event's explicit day. Expose that choice
  // separately for review; an earlier clock never invents the following day.
  if (!schedule.endDate && schedule.endTime && schedule.startDate && schedule.startTime && schedule.endTime >= schedule.startTime) {
    schedule.endDate = schedule.startDate;
    refs.endDate = [...(refs.startDate || [])];
    derivedFields.endDate = "event.date";
    warnings.push({ code: "schedule_date_from_event", message: "La finalización usa la misma fecha del evento porque su hora es posterior o igual al inicio. Revise esta fecha antes de confirmar.", refs: [...new Set([...(refs.startDate || []), ...(refs.endTime || [])])] });
  }
  // An overnight range alone does not prove the next day. A written teardown
  // day/date at the exact end clock corroborates that date without inventing it.
  if (hasEventRangeEnd && !schedule.endDate && schedule.endTime && schedule.startDate && schedule.startTime && schedule.endTime < schedule.startTime
    && schedule.teardownDate === shiftDate(schedule.startDate, 1) && schedule.teardownTime === schedule.endTime) {
    schedule.endDate = schedule.teardownDate;
    refs.endDate = [...new Set([...(refs.startDate || []), ...(refs.endTime || []), ...(refs.teardownDate || []), ...(refs.teardownTime || [])])];
    derivedFields.endDate = "teardown.date + matching event end time";
    warnings.push({ code: "schedule_date_from_teardown", message: "La finalización pasa al día siguiente porque el desmontaje indica ese día y la misma hora. Revise esta fecha antes de confirmar.", refs: refs.endDate });
  }
  for (const prefix of schedulePrefixes) {
    schedule[prefix + "Date"] ||= "";
    schedule[prefix + "Time"] ||= "";
    schedule[prefix + "At"] = schedule[prefix + "Date"] && schedule[prefix + "Time"] ? `${schedule[prefix + "Date"]}T${schedule[prefix + "Time"]}` : "";
    if (schedule[prefix + "Date"] || schedule[prefix + "Time"]) {
      if (!schedule[prefix + "At"]) warnings.push({ code: "incomplete_schedule", message: `Falta confirmar ${schedule[prefix + "Date"] ? "la hora" : "la fecha"} de ${prefix === "setup" ? "montaje" : prefix === "start" ? "inicio del evento" : prefix === "end" ? "finalización del evento" : prefix === "teardown" ? "desmontaje" : "regreso a bodega"}. No se dedujo del resto del documento.`, refs: [...(refs[prefix + "Date"] || []), ...(refs[prefix + "Time"] || [])] });
      refs[prefix + "At"] = [...new Set([...(refs[prefix + "Date"] || []), ...(refs[prefix + "Time"] || [])])];
    }
  }
  const orderChecks = [
    ["setup", "start", "El montaje queda después del inicio del evento. Revise la fecha del evento y el día de montaje."],
    ["start", "end", "La finalización queda antes del inicio del evento. Revise sus fechas y horarios."],
    [schedule.endAt ? "end" : "start", "teardown", "El desmontaje queda antes del evento. Revise sus fechas y horarios."],
    [schedule.teardownAt ? "teardown" : schedule.endAt ? "end" : "start", "equipmentIn", "El regreso a bodega queda antes de terminar el evento o desmontaje. Revise sus fechas y horarios."]
  ];
  for (const [before, after, message] of orderChecks) if (schedule[before + "At"] && schedule[after + "At"] && schedule[before + "At"] > schedule[after + "At"]) {
    issues.push({ code: "conflicting_schedule_order", message, refs: [...new Set([...(refs[before + "At"] || []), ...(refs[after + "At"] || [])])] });
  }
  return { schedule, refs, derivedFields };
}
function corroboratedScheduleSuggestion(metadata, parsed, metadataRefs, original, originalIssues) {
  // A correction needs independent written days at both ends of a complete
  // range. Keep the original schedule intact; consumers may review this proposal.
  if (originalIssues.some((issue) => ["conflicting_metadata", "conflicting_schedule", "conflicting_schedule_weekday", "conflicting_setup"].includes(issue.code))) return undefined;
  const anchors = ["date", "startDate", "startTime", "startAt", "eventTimeRange"].filter((field) => parsed[field]?.date);
  if (anchors.length !== 1) return undefined;
  const anchor = anchors[0], originalDate = parsed[anchor].date;
  const writtenDayFields = (prefix) => ["Date", "Time", "At"].map((suffix) => prefix + suffix)
    .filter((field) => parsed[field]?.date || parsed[field]?.weekday !== undefined);
  const setupFields = writtenDayFields("setup"), teardownFields = writtenDayFields("teardown"), returnFields = writtenDayFields("equipmentIn");
  const rangeFields = ["eventTimeRange", "startTime", "startAt"].filter((field) => parsed[field]?.endTime);
  const date = original.setupDate;
  if (!setupFields.length || !teardownFields.length || !returnFields.length || !rangeFields.length
    || !date || date === originalDate || date !== original.teardownDate
    || !original.setupTime || !original.startTime || !original.endTime || !original.teardownTime
    || original.startTime > original.endTime || original.setupTime > original.startTime || original.teardownTime !== original.endTime) return undefined;
  const revised = clone(parsed);
  revised[anchor].date = date;
  const warnings = [], issues = [];
  const proposed = scheduleForMetadata(metadata, revised, metadataRefs, warnings, issues);
  const schedule = proposed.schedule;
  if (issues.length || schedule.startDate !== date || schedule.endDate !== date
    || schedule.setupDate !== date || schedule.teardownDate !== date
    || !schedule.setupAt || !schedule.startAt || !schedule.endAt || !schedule.teardownAt || !schedule.equipmentInAt
    || schedule.setupAt > schedule.startAt || schedule.endAt !== schedule.teardownAt || schedule.equipmentInAt <= schedule.teardownAt) return undefined;
  const fields = [...new Set([anchor, ...setupFields, ...rangeFields, ...teardownFields, ...returnFields])];
  const evidence = fields.map((field) => ({ field, value: metadata[field], refs: clone(metadataRefs[field] || []) }));
  return { code: "corroborated_event_date", originalDate, date, schedule, scheduleRefs: proposed.refs, derivedFields: proposed.derivedFields,
    reason: "matching_setup_teardown_days_and_event_range", message: "Montaje y desmontaje indican el mismo día, sus horas enmarcan el evento y el regreso es posterior. Se propone usar ese día como fecha del evento; el dato original se conserva.",
    evidence, refs: [...new Set(evidence.flatMap((entry) => entry.refs))] };
}
function candidatesForRows(rows) {
  const candidates = new Map();
  for (const row of rows) {
    const cells = row.cells, byColumn = new Map(cells.map((cell) => [cell.column, cell]));
    if (metadataInRow(cells).length) continue;
    for (const cell of cells) {
      const next = byColumn.get(cell.column + 1);
      if (count(cell.value) === null || !next || typeof next.value !== "string" || !clean(next.value) || count(next.value) !== null) continue;
      candidates.set(cell.column, (candidates.get(cell.column) || 0) + 1);
    }
    const quantities = cells.filter((cell) => ["cantidad", "cant", "cant.", "qty", "quantity", "unidades"].includes(key(cell.value)));
    for (const quantity of quantities) {
      const next = byColumn.get(quantity.column + 1);
      if (next && ["descripcion", "equipo", "descripcion de equipo", "descripcion del equipo", "description"].includes(key(next.value))) candidates.set(quantity.column, Math.max(2, candidates.get(quantity.column) || 0));
    }
  }
  const columns = [...candidates.keys()].sort((a, b) => a - b);
  return columns.filter((column) => !columns.some((other) => other === column - 1));
}
const tableFields = {
  quantity: ["cantidad", "cant", "cant.", "qty", "quantity", "unidades"],
  description: ["descripcion", "equipo", "descripcion de equipo", "descripcion del equipo", "nombre del equipo", "description", "equipment"],
  category: ["categoria", "category", "seccion", "grupo", "rubro"],
  notes: ["nota", "notas", "observacion", "observaciones", "comentario", "comentarios", "notes"]
};
const tableField = (value) => Object.keys(tableFields).find((field) => tableFields[field].includes(key(value)));
function excelLayouts(rows) {
  const headers = [], headerIssues = [];
  for (const row of rows) {
    if (metadataInRow(row.cells).length || row.cells.some((cell) => count(cell.value) !== null)) continue;
    const quantities = row.cells.filter((cell) => tableField(cell.value) === "quantity");
    if (!quantities.length) continue;
    const descriptions = row.cells.filter((cell) => tableField(cell.value) === "description");
    const pairs = [];
    if (descriptions.length) {
      if (quantities.length !== descriptions.length) {
        headerIssues.push({ code: "ambiguous_headers", message: "Hay encabezados Cantidad o Descripción repetidos sin una correspondencia única. Separe los cuadros o corrija los encabezados.", refs: row.cells.map((cell) => cell.ref) });
        continue;
      }
      quantities.forEach((quantity, index) => pairs.push({ quantity: quantity.column, description: descriptions[index].column, explicit: true, optional: {} }));
    } else {
      for (const quantity of quantities) {
        const description = row.cells.find((cell) => cell.column === quantity.column + 1);
        if (description && typeof description.value === "string" && clean(description.value) && !tableField(description.value)) pairs.push({ quantity: quantity.column, description: description.column, explicit: true, optional: {} });
        else headerIssues.push({ code: "missing_header_pair", message: "Un encabezado Cantidad no tiene una columna de descripción inequívoca. Revise este cuadro antes de cargarlo.", refs: [quantity.ref] });
      }
    }
    pairs.sort((a, b) => Math.min(a.quantity, a.description) - Math.min(b.quantity, b.description));
    if (pairs.some((pair, index) => index > 0 && Math.min(pair.quantity, pair.description) <= Math.max(pairs[index - 1].quantity, pairs[index - 1].description))) {
      headerIssues.push({ code: "overlapping_headers", message: "Los encabezados de cuadros paralelos se cruzan. Separe cada evento en un bloque o pestaña.", refs: row.cells.map((cell) => cell.ref) });
      continue;
    }
    for (const cell of row.cells) {
      const field = tableField(cell.value); if (!["category", "notes"].includes(field) || !pairs.length) continue;
      const distance = (pair) => Math.min(Math.abs(cell.column - pair.quantity), Math.abs(cell.column - pair.description));
      const nearest = Math.min(...pairs.map(distance)), matches = pairs.filter((pair) => distance(pair) === nearest);
      if (matches.length !== 1 || matches[0].optional[field] !== undefined) {
        headerIssues.push({ code: "ambiguous_optional_header", message: `La columna ${field === "category" ? "Categoría" : "Observaciones"} no corresponde a un único cuadro. Separe los bloques o quite el encabezado duplicado.`, refs: [cell.ref] });
      } else matches[0].optional[field] = cell.column;
    }
    headers.push(...pairs);
  }
  if (!headers.length) return { columns: headerIssues.length ? [] : candidatesForRows(rows).map((column) => ({ quantity: column, description: column + 1, start: column, optional: {}, explicit: false })), issues: headerIssues };
  const unique = new Map();
  for (const header of headers) {
    const id = `${header.quantity}:${header.description}`;
    if (unique.has(id) && JSON.stringify(unique.get(id).optional) !== JSON.stringify(header.optional)) headerIssues.push({ code: "changed_optional_columns", message: "Cambió la posición de Categoría u Observaciones dentro del mismo cuadro. Separe las tablas para conservar su interpretación.", refs: [] });
    else unique.set(id, header);
  }
  const columns = [...unique.values()].map((column) => ({ ...column, start: Math.min(column.quantity, column.description, ...Object.values(column.optional)) })).sort((a, b) => a.start - b.start);
  if (columns.some((column, index) => index > 0 && column.start <= Math.max(columns[index - 1].quantity, columns[index - 1].description, ...Object.values(columns[index - 1].optional)))) headerIssues.push({ code: "changed_columns", message: "Cambió la posición de las columnas o se superponen dos cuadros. Sepárelos en bloques inequívocos antes de cargar.", refs: [] });
  // An ambiguous header is not interpreted using a plausible neighboring text
  // column. Keep the whole sheet visible and require a source correction.
  return headerIssues.length ? { columns: [], issues: headerIssues } : { columns, issues: [] };
}
function sourceRowsFromCells(cells) {
  const grouped = new Map();
  for (const cell of cells) {
    const id = `${cell.sheet || "PDF"}\u0000${cell.page || ""}\u0000${cell.row}`;
    if (!grouped.has(id)) grouped.set(id, { row: cell.row, page: cell.page, order: cell.sourceOrder, cells: [] });
    grouped.get(id).cells.push(cell);
  }
  return [...grouped.values()].map((row) => ({ ...row, cells: row.cells.sort((a, b) => a.column - b.column) }));
}
function eventForBlock(rows, { sheet, index, quantityColumn, descriptionColumn, optionalColumns = {}, source, blockers = [] }) {
  const sections = [], sourceCells = [], metadata = {}, metadataParsed = {}, metadataRefs = {}, warnings = [], issues = [...blockers];
  let section = null, itemRows = 0, zeroRows = 0, tableStarted = false;
  const ensure = (title) => {
    const selectedTitle = title ?? section?.title ?? "Equipo";
    if (!section || selectedTitle !== section.title) { section = { id: `import-section-${sections.length + 1}`, title: selectedTitle, items: [], rows: [] }; sections.push(section); }
    return section;
  };
  for (const row of rows) {
    const cells = row.cells, parsedCells = row.columns || cells;
    sourceCells.push(...cells);
    const fields = metadataInRow(parsedCells);
    for (const field of fields) {
      if (metadata[field.field] && metadata[field.field] !== field.value) issues.push({ code: "conflicting_metadata", field: field.field, message: `${field.field === "place" ? "Ubicación" : field.field === "date" ? "Fecha" : "Dato del evento"} tiene valores distintos. Separe los eventos o revise este cuadro.`, refs: field.refs });
      else { metadata[field.field] = field.value; metadataRefs[field.field] = field.refs; metadataParsed[field.field] = field.parts; if (field.field === "date") metadata.parsedDate = field.date; }
    }
    const quantityCell = parsedCells.find((cell) => cell.column === (row.quantityColumn ?? quantityColumn));
    const descriptionCell = parsedCells.find((cell) => cell.column === (row.descriptionColumn ?? descriptionColumn));
    const categoryCell = parsedCells.find((cell) => cell.column === optionalColumns.category);
    const quantity = count(quantityCell?.value), description = text(descriptionCell?.value);
    let type = "note", heading = "";
    if (fields.length) type = "metadata";
    else if (quantity !== null && clean(description)) { type = "item"; if (clean(categoryCell?.value)) ensure(text(categoryCell.value)); }
    else if (quantityCell && tableField(quantityCell.value) === "quantity" && clean(description)) { type = "header"; if (tableField(description) !== "description") ensure(description); }
    else if (quantity !== null && !clean(description)) {
      type = "unresolved";
      issues.push({ code: "missing_description", message: "Hay una cantidad sin descripción. Corrija la fuente antes de cargar este cuadro.", refs: cells.map((cell) => cell.ref) });
    } else if (tableStarted && quantityCell && clean(quantityCell.value) && clean(description) && !/^(nota|notas|observaci[oó]n|observaciones|importante)\s*[:.-]/i.test(clean(quantityCell.value))) {
      type = "unresolved";
      issues.push({ code: "invalid_quantity", message: "Hay una cantidad no numérica o negativa. Corrija el valor original; no se convirtió en cero ni se omitió la fila.", refs: cells.map((cell) => cell.ref) });
    } else {
      const nonempty = cells.filter((cell) => clean(cell.value));
      if ((nonempty.length === 1 || descriptionCell?.isHeading && !clean(quantityCell?.value)) && !/^(nota|observaci[oó]n|importante)\s*[:.-]/i.test(clean(descriptionCell?.value || nonempty[0]?.value))
        && ((descriptionCell || nonempty[0])?.isHeading || /^[A-ZÁÉÍÓÚÑ\d\s/().\-]+$/.test(clean((descriptionCell || nonempty[0])?.value)))) {
        type = "heading"; heading = text((descriptionCell || nonempty[0]).value); ensure(heading);
      }
    }
    if (type === "header" || type === "item") tableStarted = true;
    const target = ensure();
    const preserved = { type, sourceOrder: row.order, sourceRow: row.row, sourceRefs: cells.map((cell) => cell.ref), cells: clone(cells), description: heading || cells.map((cell) => text(cell.value)).join(" | "), quantity: type === "item" ? quantity : null };
    const notes = cells.filter((cell) => cell.note).map((cell) => `${cell.address || cell.ref}: ${noteText(cell.note)}`);
    if (type === "item") {
      itemRows++; if (quantity === 0) zeroRows++;
      const primaryRefs = new Set([...(quantityCell.refs || [quantityCell.ref]), ...(descriptionCell.refs || [descriptionCell.ref]), ...(categoryCell ? categoryCell.refs || [categoryCell.ref] : [])]);
      const extras = cells.filter((cell) => !primaryRefs.has(cell.ref) && clean(cell.value)).map((cell) => text(cell.value));
      const itemNotes = [...extras, ...notes];
      const item = { id: `file-item-${index}-${itemRows}`, sourceItemIndex: target.items.length, quantity, description, itemType: "equipo", inventoryCategory: target.title,
        sourceRefs: [...(quantityCell.refs || [quantityCell.ref]), ...(descriptionCell.refs || [descriptionCell.ref])], ...(itemNotes.length ? { notes: itemNotes } : {}) };
      preserved.quantityRefs = quantityCell.refs || [quantityCell.ref]; preserved.descriptionRefs = descriptionCell.refs || [descriptionCell.ref]; preserved.description = description; preserved.sourceItemIndex = target.items.length;
      target.items.push(item);
    }
    if (notes.length) preserved.notes = notes;
    target.rows.push(preserved);
  }
  if (!itemRows) issues.push({ code: "no_equipment", message: "No se identificó un cuadro con cantidad y descripción. Todo el contenido se conserva para revisarlo; esta hoja no se cargará como evento.", refs: [] });
  const { schedule, refs: scheduleRefs, derivedFields: scheduleDerivedFields } = scheduleForMetadata(metadata, metadataParsed, metadataRefs, warnings, issues);
  const scheduleSuggestion = corroboratedScheduleSuggestion(metadata, metadataParsed, metadataRefs, schedule, issues);
  if (!metadata.parsedDate && schedule.startDate) metadata.parsedDate = schedule.startDate;
  if (!metadata.parsedDate) warnings.push({ code: "missing_date", message: "Confirme la fecha del evento con año; no se dedujo del nombre de la pestaña." });
  if (!metadata.place) warnings.push({ code: "missing_place", message: "Indique la ubicación para planificar los trayectos." });
  warnings.push({ code: "pending_times", message: "Borrador sin reservas. Revise los horarios leídos y complete los datos pendientes antes de confirmar equipo." });
  const id = `file-${source.sha256.slice(0, 16)}-${index}`;
  return { id, sourceSheet: sheet, sourceBlock: index, date: metadata.parsedDate || "", dateLiteral: metadata.date || metadata.startAt || metadata.startDate || "", place: metadata.place || "", name: metadata.client || "", type: metadata.type || "", client: metadata.client || "",
    ...schedule, ...(scheduleSuggestion ? { scheduleSuggestion } : {}), contracted: metadata.contracted || "", metadataRefs, scheduleRefs, scheduleDerivedFields, sections, documentSections: clone(sections), sourceCells,
    documentServiceName: "Cuadro personalizado", snapshotLocked: true, sourceImport: { ...clone(source), sheet, block: index, metadata: clone(metadata), schedule: clone(schedule), scheduleRefs: clone(scheduleRefs), scheduleDerivedFields: clone(scheduleDerivedFields), sourceCells: clone(sourceCells) },
    itemCount: itemRows, zeroCount: zeroRows, issues, warnings, canImport: itemRows > 0 && !issues.length };
}
function verifyEventImport(preview) {
  const expected = new Map((preview.sourceCells || []).map((cell) => [cell.ref, cell]));
  const represented = new Map(), duplicates = [], changed = [], itemMismatches = [];
  const inspect = (event) => {
    let previousOrder = -1;
    for (const section of event.sections || []) for (const row of section.rows || []) {
      if (row.sourceOrder < previousOrder) itemMismatches.push(...row.sourceRefs); previousOrder = row.sourceOrder;
      for (const cell of row.cells || []) {
        if (represented.has(cell.ref)) duplicates.push(cell.ref);
        represented.set(cell.ref, cell);
        if (JSON.stringify(cell) !== JSON.stringify(expected.get(cell.ref))) changed.push(cell.ref);
      }
      if (row.type === "item") {
        const values = (refs) => (refs || []).map((ref) => text(expected.get(ref)?.value)).join(" ");
        const item = section.items?.[row.sourceItemIndex];
        const description = preview.source.format === "pdf" ? clean(values(row.descriptionRefs)) : values(row.descriptionRefs);
        if (!row.quantityRefs?.length || !row.descriptionRefs?.length || count(values(row.quantityRefs)) !== row.quantity || description !== row.description || item?.quantity !== row.quantity || item?.description !== row.description) itemMismatches.push(...row.sourceRefs);
      }
    }
    if (JSON.stringify(event.sourceCells) !== JSON.stringify((event.sections || []).flatMap((section) => section.rows.flatMap((row) => row.cells)))) changed.push(`event:${event.id}`);
    if (JSON.stringify(event.documentSections) !== JSON.stringify(event.sections)) changed.push(`sections:${event.id}`);
    if (event.sourceImport?.sourceCells && JSON.stringify(event.sourceImport.sourceCells) !== JSON.stringify(event.sourceCells)) changed.push(`source:${event.id}`);
    for (const reference of event.sourceImport?.referenceTables || []) inspect(reference);
  };
  for (const event of preview.events || []) inspect(event);
  const missing = [...expected.keys()].filter((ref) => !represented.has(ref));
  return { algorithm: "event-source-cell-ledger-v1", complete: expected.size > 0 && expected.size === preview.sourceCells.length && !missing.length && !duplicates.length && !changed.length && !itemMismatches.length,
    sourceCellCount: expected.size, representedCellCount: represented.size, missingRefs: missing, duplicateRefs: [...new Set(duplicates)], mismatchedRefs: [...new Set([...changed, ...itemMismatches])] };
}
function buildEventPreview(data) {
  const sheets = new Map();
  for (const cell of data.sourceCells) {
    const sheet = cell.sheet || "PDF";
    if (!sheets.has(sheet)) sheets.set(sheet, []);
    sheets.get(sheet).push(cell);
  }
  const events = [], sheetList = [];
  let block = 0;
  for (const [sheet, cells] of sheets) {
    let rows = sourceRowsFromCells(cells), columns;
    const first = events.length;
    const blockers = (data.blockers || []).map((message) => ({ code: "unreadable_source", message, refs: [] }));
    if (data.source.format === "pdf") {
      rows = (data.sourceRows || []).map((row) => ({ ...row, row: row.cells[0]?.row || 0 }));
      const groups = []; let current = [], currentFields = {}, hasItems = false;
      const pdfColumns = (row) => {
        const q = (row.columns || []).find((cell) => ["cantidad", "cant", "cant.", "qty", "quantity", "unidades"].includes(key(cell.value)));
        const d = (row.columns || []).find((cell) => ["descripcion", "equipo", "descripcion de equipo", "descripcion del equipo", "description"].includes(key(cell.value)));
        return q && d ? { quantity: q.column, description: d.column } : null;
      };
      let activeColumns = null;
      const flush = () => { if (current.length) groups.push({ rows: current, columns: activeColumns }); current = []; currentFields = {}; hasItems = false; activeColumns = null; };
      for (const row of rows) {
        const fields = metadataInRow(row.columns || row.cells);
        const starts = fields.some((entry) => ["client", "place", "type"].includes(entry.field)
          && currentFields[entry.field] && currentFields[entry.field] !== entry.value);
        if (hasItems && starts) flush();
        for (const entry of fields) currentFields[entry.field] = entry.value;
        const detected = pdfColumns(row); if (detected) activeColumns = detected;
        if (activeColumns && (row.columns || []).some((cell) => cell.column === activeColumns.quantity && count(cell.value) !== null)
          && (row.columns || []).some((cell) => cell.column === activeColumns.description && clean(cell.value))) hasItems = true;
        current.push({ ...row, ...(activeColumns ? { quantityColumn: activeColumns.quantity, descriptionColumn: activeColumns.description } : {}) });
      }
      flush();
      for (const group of groups) events.push(eventForBlock(group.rows, { sheet, index: ++block,
        quantityColumn: group.columns?.quantity ?? -1, descriptionColumn: group.columns?.description ?? -2, source: data.source,
        blockers: [...blockers, ...(!group.columns ? [{ code: "pdf_columns", message: "Este cuadro PDF no tiene columnas Cantidad y Descripción inequívocas. Revise el contenido o use el Excel original.", refs: [] }] : [])] }));
    } else {
      const layout = excelLayouts(rows); columns = layout.columns;
      if (!columns.length) events.push(eventForBlock(rows, { sheet, index: ++block, quantityColumn: -1, descriptionColumn: -2, source: data.source, blockers: [...blockers, ...layout.issues] }));
      else columns.forEach((column, index) => {
        const min = index === 0 ? -Infinity : column.start, max = columns[index + 1]?.start ?? Infinity;
        const blockRows = rows.map((row) => ({ ...row, cells: row.cells.filter((cell) => cell.column >= min && cell.column < max) })).filter((row) => row.cells.length);
        const hasMetadata = blockRows.some((row) => metadataInRow(row.cells).length);
        const hasHeader = blockRows.some((row) => row.cells.some((cell) => cell.column === column.quantity && ["cantidad", "cant", "cant.", "qty", "quantity", "unidades"].includes(key(cell.value))));
        const ambiguous = columns.length > 1 && !hasMetadata && !hasHeader && !column.explicit ? [{ code: "ambiguous_parallel_layout", message: "Hay varios pares numéricos sin metadatos ni encabezados que separen los eventos. Separe los cuadros o indique Cantidad y Descripción para cada uno.", refs: [] }] : [];
        events.push(eventForBlock(blockRows, { sheet, index: ++block, quantityColumn: column.quantity, descriptionColumn: column.description, optionalColumns: column.optional, source: data.source, blockers: [...blockers, ...ambiguous] }));
      });
    }
    sheetList.push({ name: sheet, sourceCellCount: cells.length, eventIds: events.slice(first).map((event) => event.id) });
  }
  // A copy without any event metadata has one unambiguous owner only when
  // exactly one equal table on this sheet supplies a complete event identity.
  const duplicateCandidates = [], referenceCopies = [], referenceIds = new Set();
  for (const sheet of sheetList) {
    const matches = new Map();
    for (const event of events.filter((entry) => entry.sourceSheet === sheet.name && entry.itemCount)) {
      const signature = JSON.stringify(event.sections.flatMap((section) => section.items.map((item) => [item.quantity, item.description])));
      if (!matches.has(signature)) matches.set(signature, []);
      matches.get(signature).push(event);
    }
    for (const group of matches.values()) if (group.length > 1) {
      const identities = group.map((event) => [key(event.client), event.date, key(event.place)]);
      const identified = group.filter((event, index) => identities[index].every(Boolean));
      const anonymous = group.filter((event) => Object.keys(event.sourceImport.metadata).length === 0);
      const owner = identified.length === 1 && anonymous.length === group.length - 1 ? identified[0] : null;
      const distinctSourceEvents = identities.every((identity) => identity.every(Boolean))
        && new Set(identities.map((identity) => JSON.stringify(identity))).size === group.length;
      const candidate = { id: `duplicate-equipment-${duplicateCandidates.length + 1}`, sourceSheet: sheet.name, eventIds: group.map((event) => event.id), itemCount: group[0].itemCount, reason: "identical_equipment", requiresReview: !owner && !distinctSourceEvents };
      duplicateCandidates.push(candidate);
      if (owner) {
        owner.sourceImport.referenceTables = anonymous;
        owner.referenceTableIds = anonymous.map((event) => event.id);
        owner.referenceTableCount = anonymous.length;
        anonymous.forEach((event) => referenceIds.add(event.id));
        const reference = { id: `reference-equipment-${referenceCopies.length + 1}`, sourceSheet: sheet.name, eventId: owner.id,
          referenceTableIds: [...owner.referenceTableIds], itemCount: owner.itemCount, reason: "identical_equipment_without_identity" };
        referenceCopies.push(reference);
        Object.assign(candidate, { resolution: "reference_copy", activeEventIds: [owner.id], referenceTableIds: [...owner.referenceTableIds] });
        owner.warnings.push({ code: "reference_equipment_table", severity: "info", message: "El cuadro sin metadatos de evento repite el equipo del único evento identificado en esta hoja. Se conserva completo como referencia y el equipo se cuenta una vez.", refs: anonymous.flatMap((event) => event.sourceCells.map((cell) => cell.ref)) });
        continue;
      }
      for (const event of group) {
        event.duplicateCandidateIds = [candidate.id];
        event.warnings.push({ code: "duplicate_equipment_tables", severity: distinctSourceEvents ? "info" : "warning", message: distinctSourceEvents
          ? "Los cuadros tienen el mismo equipo y datos completos que identifican eventos distintos. Todos se conservaron completos."
          : "Hay cuadros con las mismas cantidades y descripciones en esta hoja. Confirme si son eventos separados o una copia de referencia; ambos se conservaron completos.", refs: event.sections.flatMap((section) => section.items.flatMap((item) => item.sourceRefs)) });
      }
    }
  }
  for (const sheet of sheetList) {
    sheet.tableIds = [...sheet.eventIds];
    sheet.referenceTableIds = sheet.tableIds.filter((id) => referenceIds.has(id));
    sheet.eventIds = sheet.tableIds.filter((id) => !referenceIds.has(id));
    sheet.tableCount = sheet.tableIds.length;
    sheet.eventCount = sheet.eventIds.length;
    sheet.referenceTableCount = sheet.referenceTableIds.length;
  }
  const activeEvents = events.filter((event) => !referenceIds.has(event.id));
  const preview = { source: clone(data.source), sourceCells: clone(data.sourceCells), documentLines: clone(data.documentLines || []), sheets: sheetList,
    events: activeEvents, duplicateCandidates, referenceCopies, tableCount: events.length, eventCount: activeEvents.length, referenceTableCount: referenceIds.size,
    itemCount: activeEvents.reduce((sum, event) => sum + event.itemCount, 0), zeroCount: activeEvents.reduce((sum, event) => sum + event.zeroCount, 0) };
  preview.verification = verifyEventImport(preview);
  return preview;
}
async function parseEventFile(buffer, options = {}) {
  const data = await readSourceFile(buffer, { ...options, preserveCellNotes: true });
  return buildEventPreview(data);
}
module.exports = { parseEventFile, buildEventPreview, verifyEventImport, parseDate, parseTime };
