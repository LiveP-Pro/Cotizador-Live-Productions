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
  startAt: ["inicio del evento", "inicio evento", "fecha y hora del evento", "fecha y hora de inicio", "fecha y hora de inicio del evento", "fecha hora evento"],
  endDate: ["fecha final", "fecha fin", "fecha de fin", "fecha de finalizacion", "fecha finalizacion", "fecha de finalizacion del evento"],
  endTime: ["hora final", "hora fin", "hora de fin", "hora de finalizacion", "hora finalizacion", "hora de finalizacion del evento", "hora en que finaliza el evento", "finaliza", "finalizacion", "finalizacion del evento", "fin", "fin del evento", "termina", "hora de cierre"],
  endAt: ["fecha y hora de fin", "fecha y hora de finalizacion", "fecha y hora de finalizacion del evento"],
  equipmentInDate: ["fecha de regreso", "fecha regreso", "fecha de retorno", "fecha de regreso a bodega"],
  equipmentInTime: ["hora de regreso", "hora regreso", "hora de retorno", "hora de regreso a bodega"],
  equipmentInAt: ["regreso a bodega", "retorno a bodega", "fecha y hora de regreso", "fecha y hora de regreso a bodega"],
  type: ["evento", "tipo de evento", "event type"],
  contracted: ["equipo contratado", "servicio contratado", "servicios contratados", "contratado"],
  guests: ["cantidad de invitados", "invitados", "numero de invitados"]
};
const labelField = (value) => Object.keys(metadataLabels).find((field) => metadataLabels[field].includes(key(value)));

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
  const clockToken = raw.match(/(?:^|[\sT,;])(\d{1,2}:\d{2}(?::\d{2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?|\d{1,2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?))(?=$|[\sZ,+;)-])/i)?.[1];
  const time = parseTime(clockToken || (!date ? value : ""), cell, { allowBareHour });
  return { date, time };
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
    const scheduleField = /^(?:setup|start|end|equipmentIn)/.test(field);
    // Equipment named "Montaje" or "Inicio" is still equipment when paired
    // with a quantity, even in a table whose description column comes first.
    if (scheduleField && !inline && (count(cells[index - 1]?.value) !== null || count(valueCell?.value) !== null)
      && !/hora|fecha|requiere|aplica/.test(key(raw))) continue;
    if (clean(value)) {
      let parts = temporalParts(value, valueCell, { allowBareHour: /Time$/.test(field) });
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
  const schedule = {}, refs = {}, derivedFields = {};
  const add = (name, value, field) => {
    if (!value) return;
    if (schedule[name] && schedule[name] !== value) {
      issues.push({ code: "conflicting_schedule", message: "Hay fechas u horarios distintos para el mismo momento del evento. Revise el dato original.", refs: [...new Set([...(refs[name] || []), ...(metadataRefs[field] || [])])] });
      return;
    }
    schedule[name] = value;
    refs[name] = [...new Set([...(refs[name] || []), ...(metadataRefs[field] || [])])];
  };
  for (const prefix of ["setup", "start", "end", "equipmentIn"]) {
    for (const suffix of ["Date", "Time", "At"]) {
      const field = prefix + suffix, parts = parsed[field];
      if (!parts) continue;
      if (suffix !== "Time" || parts.date && parts.time) add(prefix + "Date", parts.date, field);
      if (suffix !== "Date") add(prefix + "Time", parts.time, field);
      if (!parts.date && !parts.time && appliesValue(metadata[field]) === undefined) {
        warnings.push({ code: "unreadable_schedule", message: `Revise el horario «${metadata[field]}»; se conservó el texto original sin asignar una fecha u hora.`, refs: metadataRefs[field] || [] });
      }
    }
  }
  add("startDate", parsed.date?.date, "date");
  // A full date/time explicitly written or formatted in the event-date value
  // carries its clock too. Date-only Excel formats never supply a time.
  add("startTime", parsed.date?.time, "date");
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
  for (const prefix of ["setup", "start", "end", "equipmentIn"]) {
    schedule[prefix + "Date"] ||= "";
    schedule[prefix + "Time"] ||= "";
    schedule[prefix + "At"] = schedule[prefix + "Date"] && schedule[prefix + "Time"] ? `${schedule[prefix + "Date"]}T${schedule[prefix + "Time"]}` : "";
    if (schedule[prefix + "Date"] || schedule[prefix + "Time"]) {
      if (!schedule[prefix + "At"]) warnings.push({ code: "incomplete_schedule", message: `Falta confirmar ${schedule[prefix + "Date"] ? "la hora" : "la fecha"} de ${prefix === "setup" ? "montaje" : prefix === "start" ? "inicio del evento" : prefix === "end" ? "finalización del evento" : "regreso a bodega"}. No se dedujo del resto del documento.`, refs: [...(refs[prefix + "Date"] || []), ...(refs[prefix + "Time"] || [])] });
      refs[prefix + "At"] = [...new Set([...(refs[prefix + "Date"] || []), ...(refs[prefix + "Time"] || [])])];
    }
  }
  return { schedule, refs, derivedFields };
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
      if (metadata[field.field] && metadata[field.field] !== field.value) issues.push({ code: "conflicting_metadata", message: `${field.field === "place" ? "Ubicación" : field.field === "date" ? "Fecha" : "Dato del evento"} tiene valores distintos. Separe los eventos o revise este cuadro.`, refs: field.refs });
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
  if (!metadata.parsedDate && schedule.startDate) metadata.parsedDate = schedule.startDate;
  if (!metadata.parsedDate) warnings.push({ code: "missing_date", message: "Confirme la fecha del evento con año; no se dedujo del nombre de la pestaña." });
  if (!metadata.place) warnings.push({ code: "missing_place", message: "Indique la ubicación para planificar los trayectos." });
  warnings.push({ code: "pending_times", message: "Borrador sin reservas. Revise los horarios leídos y complete los datos pendientes antes de confirmar equipo." });
  const id = `file-${source.sha256.slice(0, 16)}-${index}`;
  return { id, sourceSheet: sheet, sourceBlock: index, date: metadata.parsedDate || "", dateLiteral: metadata.date || metadata.startAt || metadata.startDate || "", place: metadata.place || "", name: metadata.client || "", type: metadata.type || "", client: metadata.client || "",
    ...schedule, contracted: metadata.contracted || "", metadataRefs, scheduleRefs, scheduleDerivedFields, sections, documentSections: clone(sections), sourceCells,
    documentServiceName: "Cuadro personalizado", snapshotLocked: true, sourceImport: { ...clone(source), sheet, block: index, metadata: clone(metadata), schedule: clone(schedule), scheduleRefs: clone(scheduleRefs), scheduleDerivedFields: clone(scheduleDerivedFields), sourceCells: clone(sourceCells) },
    itemCount: itemRows, zeroCount: zeroRows, issues, warnings, canImport: itemRows > 0 && !issues.length };
}
function verifyEventImport(preview) {
  const expected = new Map((preview.sourceCells || []).map((cell) => [cell.ref, cell]));
  const represented = new Map(), duplicates = [], changed = [], itemMismatches = [];
  for (const event of preview.events || []) {
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
  }
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
  const preview = { source: clone(data.source), sourceCells: clone(data.sourceCells), documentLines: clone(data.documentLines || []), sheets: sheetList, events };
  preview.verification = verifyEventImport(preview);
  return preview;
}
async function parseEventFile(buffer, options = {}) {
  const data = await readSourceFile(buffer, { ...options, preserveCellNotes: true });
  return buildEventPreview(data);
}
module.exports = { parseEventFile, buildEventPreview, verifyEventImport, parseDate, parseTime };
