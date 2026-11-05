"use strict";

// Read-only report generation. This module never opens an event store or writes
// to the warehouse: its only inputs are selected current events and the active
// warehouse snapshot supplied by the authenticated server endpoint.
const { calculateEquipmentAvailability, normalizeEvent, localTime, resolveEquipmentPurchasedLine, effectiveEquipmentProcurementChoice } = require("./equipment-event-store.cjs");
const EquipmentIdentity = require("./equipment-identity.js");
const EquipmentDocumentAudit = require("./equipment-document-audit.js");

const DISCLAIMER = "PROVISIONAL · Sin reservas ni movimientos de inventario. No se supone ningún trasiego, retorno o reutilización entre eventos. Los pendientes no constituyen órdenes de compra o renta.";
const MAX_CELL_TEXT = 30000;
function invalid(message) { return Object.assign(new Error(message), { statusCode: 400 }); }
function text(value) { return String(value ?? ""); }
function html(value) { return text(value).replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function list(value) { return Array.isArray(value) ? value : []; }
function originalCellValue(cell) {
  if (Object.hasOwn(cell, "value")) return cell.value;
  if (Object.hasOwn(cell, "literal")) return cell.literal;
  if (cell.effectiveValue) return cell.effectiveValue.numberValue ?? cell.effectiveValue.stringValue ?? cell.effectiveValue.boolValue ?? "";
  return cell.formattedValue ?? cell.text ?? "";
}
function primitive(value) {
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  return value === null || value === undefined ? "" : JSON.stringify(value);
}
function displayTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return text(value);
  return new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" }).format(date) + " (Guatemala)";
}
function chunks(value) {
  const source = text(value); const result = [];
  // Keep UTF-16 surrogate pairs together, so rejoining the JSON is lossless.
  for (let start = 0; start < source.length;) {
    let end = Math.min(source.length, start + MAX_CELL_TEXT);
    if (end < source.length && /[\uD800-\uDBFF]/.test(source[end - 1])) end -= 1;
    result.push(source.slice(start, end)); start = end;
  }
  return result.length ? result : [""];
}
function losslessJson(value) {
  // ASCII JSON also avoids splitting an astral character inside the XLSX XML
  // writer's own internal stream buffers. JSON.parse restores every code unit.
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, character => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0"));
}
function sourceCellsForEvent(event) {
  const output = [], seen = new Set();
  function visit(node, path = "event") {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach((entry, index) => visit(entry, `${path}[${index}]`)); return; }
    for (const [name, value] of Object.entries(node)) {
      if (["sourceCells", "cells"].includes(name) && Array.isArray(value)) {
        value.forEach((cell, index) => {
          if (!cell || typeof cell !== "object") return;
          const ref = text(cell.ref || cell.sourceRef || cell.address || cell.a1 || `${path}.${name}[${index}]`);
          const original = originalCellValue(cell);
          const key = JSON.stringify([cell.sheet || cell.sheetName || event.sourceSheet || "", ref, original]);
          if (!seen.has(key)) { seen.add(key); output.push({ eventId: event.id, event: event.place || event.name || event.id,
            sheet: cell.sheet || cell.sheetName || event.sourceSheet || "", ref, value: original, cell }); }
        });
      } else if (name !== "inventory" && name !== "warehouseInventory") visit(value, `${path}.${name}`);
    }
  }
  visit(event); return output;
}
function sourceRefs(line, section) {
  const refs = [...list(line.sourceRefs), ...list(line.sourceCells).map(cell => cell.ref || cell.address),
    ...list(line.cells).map(cell => cell.ref || cell.address)];
  const sourceRow = list(section.rows).find(row => row.sourceItemIndex === line.sourceItemIndex);
  refs.push(...list(sourceRow?.sourceRefs), ...list(sourceRow?.cells).map(cell => cell.ref || cell.address));
  return [...new Set(refs.filter(Boolean))].join("; ");
}
function warehouseRows(inventory) {
  const state = inventory?.state || inventory || {};
  const changes = { salida: ["out", 1], ingreso_evento: ["out", -1], consumo: ["consumed", 1], taller: ["workshop", 1], danado: ["workshop", 1], devolucion_taller: ["workshop", -1], renta: ["rented", 1], devolucion_renta: ["rented", -1], perdido: ["lost", 1], recuperado: ["lost", -1] };
  return list(state.items).filter(item => item && !item.archived).map(item => {
    const buckets = { out: 0, consumed: 0, workshop: 0, rented: 0, lost: 0 };
    for (const movement of list(state.movements)) {
      if (String(movement.itemId) !== String(item.id) || movement.sourceUnmatched || movement.procurementChoice) continue;
      const change = changes[movement.type];
      if (change) buckets[change[0]] += change[1] * Math.max(0, finite(movement.quantity));
    }
    for (const name of Object.keys(buckets)) buckets[name] = Math.max(0, buckets[name]);
    return { id: String(item.id), name: item.name || "", category: item.category || "", itemType: EquipmentIdentity.itemType(item),
      registered: Math.max(0, finite(item.quantity)), ...buckets,
      available: Math.max(0, finite(item.quantity) - Object.values(buckets).reduce((sum, value) => sum + value, 0)), original: item };
  });
}

function createEquipmentReportModel(payload, inventory, options = {}) {
  if (!payload || !Array.isArray(payload.events) || !payload.events.length) throw invalid("Cargue al menos un evento para descargar el reporte.");
  if (!inventory || !Array.isArray((inventory.state || inventory).items)) throw invalid("No se pudo consultar el inventario activo de Contabilidad de Equipo.");
  for (const field of ["from", "to"]) {
    if (payload[field] && (typeof payload[field] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload[field]) || !Number.isFinite(localTime(`${payload[field]}T00:00`)))) throw invalid("El período del reporte no es válido.");
  }
  if (payload.from && payload.to && payload.from > payload.to) throw invalid("El inicio del período debe ser anterior o igual a su finalización.");
  const originalEvents = JSON.parse(JSON.stringify(payload.events));
  const identifiers = new Set();
  const events = payload.events.map((event, index) => {
    const id = text(event?.id || `reporte-evento-${index + 1}`).trim();
    if (identifiers.has(id)) throw invalid("Hay identificadores de evento repetidos. Actualice los cuadros antes de descargar.");
    identifiers.add(id);
    // Provisional exports must also be possible while correcting a schedule.
    // Validate lines and IDs independently; retain the literal dates in the
    // report, but never feed them into a reuse/transfer calculation here.
    const validated = normalizeEvent(id, { ...event, setupAt: "", startAt: "", endAt: "", equipmentInAt: "", equipmentOutAt: "" });
    for (const name of ["setupAt", "startAt", "endAt", "equipmentInAt", "equipmentOutAt"]) {
      if (Object.hasOwn(event, name)) validated[name] = event[name]; else delete validated[name];
    }
    return validated;
  }).filter(event => event.status !== "cancelled");
  if (!events.length) throw invalid("No hay eventos activos para descargar.");
  // All times are retained in the master, but NO route, return or interval is
  // used to reduce procurement in a report explicitly requested as provisional.
  const calculationEvents = events.map(event => ({ ...event, setupAt: "", startAt: "", endAt: "", equipmentInAt: "", equipmentOutAt: "" }));
  const availability = calculateEquipmentAvailability(calculationEvents, inventory, { transfers: [], routeEstimates: [] });
  const stocks = warehouseRows(inventory), byId = new Map(stocks.map(item => [item.id, item]));
  const pending = [], details = [], sourceCells = [], preservedRows = [];
  const metadataNames = { setupAt: "Fecha y hora de montaje", startAt: "Fecha y hora de inicio", endAt: "Fecha y hora de finalización", equipmentInAt: "Regreso a bodega" };
  for (const event of events) {
    const sourceMessages = [...list(event.warnings), ...list(event.issues), ...list(event.sourceImport?.warnings)];
    const knownMessages = new Set();
    for (const message of sourceMessages) {
      const reason = typeof message === "string" ? message : message?.message || message?.reason || message?.description || message?.code || (message && JSON.stringify(message)) || "";
      if (!reason || knownMessages.has(reason)) continue;
      knownMessages.add(reason);
      pending.push({ kind: "FUENTE", eventId: event.id, event: event.place || event.name || event.id,
        description: typeof message === "object" ? message.description || message.code || "Aviso del archivo" : "Aviso del archivo",
        quantity: typeof message?.quantity === "number" ? message.quantity : null, reason,
        sourceRefs: typeof message?.sourceRefs === "string" ? message.sourceRefs : list(message?.sourceRefs).join("; ") });
    }
    pending.push(...EquipmentDocumentAudit.audit(event));
    for (const [field, label] of Object.entries(metadataNames)) if (!event[field] || !Number.isFinite(localTime(event[field]))) pending.push({ kind: "HORARIO", eventId: event.id, event: event.place || event.name || event.id,
      description: label, quantity: null, reason: event[field] ? "Corrija esta fecha u hora. Su valor literal se conserva; no se usa para reducir renta." : "Pendiente: no se presupone ningún trasiego o retorno.", sourceRefs: "" });
    const suppliedTimes = Object.keys(metadataNames).map(field => localTime(event[field])).filter(Number.isFinite);
    if (suppliedTimes.some((time, index) => index > 0 && time < suppliedTimes[index - 1])) pending.push({ kind: "HORARIO", eventId: event.id, event: event.place || event.name || event.id,
      description: "Orden de fechas y horas", quantity: null, reason: "Revise el orden: montaje, inicio, finalización y regreso a bodega. El reporte conserva los valores originales y no supone reutilización.", sourceRefs: "" });
    if (!text(event.place).trim()) pending.push({ kind: "UBICACIÓN", eventId: event.id, event: event.name || event.id, description: "Ubicación del evento", quantity: null, reason: "Indique el lugar para evaluar logística.", sourceRefs: "" });
    sourceCells.push(...sourceCellsForEvent(event));
    list(event.sections).forEach((section, sectionIndex) => {
      list(section.items).forEach((raw, itemIndex) => {
        const line = Array.isArray(raw) ? { quantity: raw[0], description: raw[1] } : raw;
        const purchasedLine = resolveEquipmentPurchasedLine(event, line, inventory);
        const effectiveChoice = effectiveEquipmentProcurementChoice(purchasedLine, inventory);
        const resolved = purchasedLine !== line
          ? { item: (inventory.state || inventory).items.find(item => !item.archived && String(item.id) === String(purchasedLine.warehouseInventoryId)) }
          : EquipmentIdentity.resolve(line, (inventory.state || inventory).items);
        details.push({ eventId: event.id, event: event.place || event.name || event.id, date: event.date || "", sectionIndex, itemIndex,
          category: line.inventoryCategory || line.category || section.title || "", quantity: Number(line.quantity), description: line.description,
          warehouseInventoryId: line.warehouseInventoryId || "", resolvedInventoryId: !effectiveChoice && resolved.item ? String(resolved.item.id) : "", notes: list(line.notes).join("\n") || line.notes || line.observations || "",
          sourceRefs: sourceRefs({ ...line, sourceItemIndex: line.sourceItemIndex ?? itemIndex }, section), original: line });
      });
      list(section.rows).forEach((row, rowIndex) => preservedRows.push({ eventId: event.id, event: event.place || event.name || event.id, sectionIndex,
        section: section.title || "", rowIndex, type: row.type || row.kind || "", quantity: row.quantity ?? "", description: row.description ?? "",
        notes: list(row.notes).join("\n") || row.notes || "", refs: [...list(row.sourceRefs), ...list(row.cells).map(cell => cell.ref || cell.address)].filter(Boolean).join("; "), original: row }));
      if (section.notes?.length) preservedRows.push({ eventId: event.id, event: event.place || event.name || event.id, sectionIndex, section: section.title || "", rowIndex: "", type: "notes", quantity: "", description: "Notas de la sección", notes: list(section.notes).join("\n"), refs: "", original: section.notes });
    });
    for (const row of list(event.nonEquipmentRows)) preservedRows.push({ eventId: event.id, event: event.place || event.name || event.id, sectionIndex: "", section: "Fuente del evento", rowIndex: row.row ?? "", type: row.type || "fuente", quantity: row.quantity ?? "", description: row.description || "", notes: list(row.notes).join("\n") || "", refs: list(row.sourceCells).map(cell => cell.ref || cell.address).filter(Boolean).join("; "), original: row });
  }
  const rows = availability.rows.map(row => {
    const stock = byId.get(row.warehouseInventoryId), explicit = row.procurementChoice;
    const demand = Number(row.quantity);
    const pendingIdentity = demand > 0 && Boolean(row.pendingIdentification || (!stock && !["rent", "purchase"].includes(explicit)));
    const pendingClassification = demand > 0 && Boolean(row.pendingClassification);
    const available = stock ? stock.available : null;
    const potential = stock ? Math.max(0, demand - available) : null;
    const action = demand === 0 ? "SIN USO (0)" : pendingIdentity ? "IDENTIFICAR EQUIPO" : pendingClassification ? "REVISAR CLASIFICACIÓN" : explicit === "rent" ? "RENTA" : explicit === "purchase" ? "COMPRA" : potential > 0 ? row.itemType === "consumible" || row.preferredPurchase ? "COMPRA" : "RENTA" : "CUBIERTO";
    const shortage = demand === 0 ? 0 : pendingIdentity || pendingClassification ? null : explicit === "rent" || explicit === "purchase" ? demand : potential;
    const matchingDetails = details.filter(line => stock ? line.resolvedInventoryId === stock.id : line.description === row.description && line.category === row.category);
    const refs = matchingDetails.map(line => line.sourceRefs).filter(Boolean);
    const result = { ...row, demand, available, shortage, potential, action, pendingIdentification: pendingIdentity, pendingClassification, sourceRefs: [...new Set(refs)].join("; "),
      originalDescriptions: [...new Set(matchingDetails.map(line => line.description))].join("\n") || row.description };
    if (pendingIdentity || pendingClassification) pending.push({ kind: pendingIdentity ? "IDENTIDAD" : "CLASIFICACIÓN", eventId: "", event: list(row.events).map(event => event.place || event.name || event.eventId).join("; "), description: row.description,
      quantity: demand, reason: pendingIdentity ? "No hay una referencia física inequívoca. Existencia y faltante quedan pendientes; no se supone existencia cero." : list(row.classificationWarnings).map(warning => warning.message || warning).join(" ") || "Revise la clasificación en Contabilidad antes de emitir una orden.", sourceRefs: result.sourceRefs });
    return result;
  }).sort((a, b) => text(a.category).localeCompare(text(b.category), "es") || text(a.description).localeCompare(text(b.description), "es"));
  return { provisional: true, disclaimer: DISCLAIMER, createdAt: options.createdAt || new Date().toISOString(), from: payload.from || "", to: payload.to || "",
    inventorySavedAt: inventory.savedAt || "", events, rows, stocks, details, sourceCells, preservedRows, pending,
    rental: rows.filter(row => row.action === "RENTA" && row.shortage > 0), purchase: rows.filter(row => row.action === "COMPRA" && row.shortage > 0),
    counts: { events: events.length, equipmentRows: details.length, zeroQuantityRows: details.filter(row => row.quantity === 0).length, sourceCells: sourceCells.length, references: rows.length },
    originalEvents, originalInventory: inventory, transfers: [], productionMutations: 0 };
}

function addTableSheet(workbook, name, headers, values, options = {}) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4, xSplit: options.freezeColumns || 0 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  sheet.getCell(1, 1).value = name.toLocaleUpperCase("es-GT") + " · PROVISIONAL";
  sheet.getCell(1, 1).font = { name: "Arial", size: 16, bold: true, color: { argb: "FF12233D" } };
  sheet.mergeCells(1, 1, 1, Math.max(2, headers.length));
  sheet.getCell(2, 1).value = DISCLAIMER; sheet.mergeCells(2, 1, 2, Math.max(2, headers.length));
  sheet.getCell(2, 1).font = { name: "Arial", size: 10, color: { argb: "FF7A4A00" } }; sheet.getCell(2, 1).alignment = { wrapText: true, vertical: "top" }; sheet.getRow(2).height = 34;
  sheet.getRow(4).values = headers;
  sheet.getRow(4).font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12233D" } }; sheet.getRow(4).height = 28;
  for (const valuesRow of values) {
    const row = sheet.addRow(valuesRow.map(value => {
      if (value === undefined || value === null) return "";
      if (typeof value === "string" && value.length > 32700) return chunks(value)[0] + "\n[Continúa: texto íntegro conservado en Datos completos, dividido en partes numeradas.]";
      return value;
    }));
    row.font = { name: "Arial", size: 10 }; row.alignment = { vertical: "top", wrapText: true };
    row.eachCell(cell => { cell.border = { bottom: { style: "hair", color: { argb: "FFDCE2EA" } } }; if (typeof cell.value === "number" || cell.value?.formula) { cell.numFmt = "0.##"; cell.alignment = { horizontal: "right", vertical: "top", wrapText: true }; } });
    if (row.number % 2) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F7FB" } };
  }
  headers.forEach((header, index) => { sheet.getColumn(index + 1).width = options.widths?.[index] || (/descrip|observ|motivo|nota|fuente|original|JSON/i.test(header) ? 42 : /evento|categor/i.test(header) ? 27 : 18); });
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, sheet.rowCount), column: headers.length } };
  sheet.headerFooter.oddFooter = "PROVISIONAL · Sin reservas ni movimientos de inventario | Página &P de &N";
  sheet.pageSetup.printTitlesRow = "1:4";
  return sheet;
}
function columnName(index) { let name = ""; for (; index > 0; index = Math.floor((index - 1) / 26)) name = String.fromCharCode(65 + (index - 1) % 26) + name; return name; }

async function createEquipmentMasterWorkbook(model) {
  const ExcelJS = require("exceljs"); const workbook = new ExcelJS.Workbook();
  workbook.creator = "Live Productions · Requerimiento de Equipo"; workbook.subject = "Resumen provisional de eventos e inventario activo";
  workbook.description = model.disclaimer; workbook.created = new Date(model.createdAt); workbook.calcProperties.fullCalcOnLoad = true;
  const info = [
    ["Estado", "PROVISIONAL"], ["Criterio", model.disclaimer], ["Generado", displayTimestamp(model.createdAt)], ["Inventario activo consultado", displayTimestamp(model.inventorySavedAt)],
    ["Eventos", model.counts.events], ["Renglones de equipo", model.counts.equipmentRows], ["Renglones con cantidad cero", model.counts.zeroQuantityRows], ["Celdas fuente incluidas", model.counts.sourceCells],
    ["Referencias del resumen", model.counts.references], ["Referencias para renta provisional", model.rental.length], ["Referencias para compra provisional", model.purchase.length],
    ["Pendientes", model.pending.length], ["Reservas confirmadas por esta descarga", 0], ["Movimientos de inventario por esta descarga", 0],
    ["Fuente de inventario", "Inventario activo del servidor de Contabilidad de Equipo; no se acepta existencia enviada por el navegador."],
    ["Importante", "Los consumibles se suman para todos los eventos. Los reutilizables también se suman en este escenario conservador, sin reducción por retornos o trasiegos. No se suman cantidades de unidades distintas en un total general."],
    ["Datos originales", "Las hojas Celdas fuente, Filas originales y Datos completos conservan la información recibida. Datos completos contiene JSON dividido en partes, sin truncar celdas largas."]
  ];
  addTableSheet(workbook, "Control", ["Concepto", "Detalle"], info, { widths: [42, 110] });
  addTableSheet(workbook, "Eventos", ["ID", "Ubicación", "Nombre", "Tipo", "Fecha", "Montaje", "Inicio", "Finalización", "Regreso a bodega", "Observaciones"], model.events.map(event => [event.id, event.place || "", event.name || "", event.type || "", event.date || "", event.setupAt || "PENDIENTE", event.startAt || "PENDIENTE", event.endAt || "PENDIENTE", event.equipmentInAt || "PENDIENTE", event.notes || ""]));
  const headers = ["Categoría", "Descripción del equipo", "ID físico", ...model.events.map(event => `${event.date || "Sin fecha"}\n${event.place || event.name || event.id}`), "Total solicitado", "Inventario disponible", "Faltante provisional", "Acción", "Observaciones", "Descripciones originales", "Celdas de origen"];
  const totalColumn = 4 + model.events.length, availableColumn = totalColumn + 1;
  addTableSheet(workbook, "Resumen de equipo", headers, model.rows.map((row, index) => {
    const spreadsheetRow = index + 5;
    const sum = `SUM(D${spreadsheetRow}:${columnName(totalColumn - 1)}${spreadsheetRow})`;
    const total = { formula: sum, result: row.demand };
    const shortage = row.shortage === null ? "POR REVISAR" : row.external ? { formula: `${columnName(totalColumn)}${spreadsheetRow}`, result: row.shortage } : { formula: `MAX(0,${columnName(totalColumn)}${spreadsheetRow}-${columnName(availableColumn)}${spreadsheetRow})`, result: row.shortage };
    return [row.category || "Sin categoría", row.description, row.warehouseInventoryId || "PENDIENTE / EXTERNO", ...model.events.map(event => finite(row.eventQuantities?.[event.id])), total, row.available === null ? "POR IDENTIFICAR" : row.available,
      shortage, row.action, row.pendingClassification ? list(row.classificationWarnings).map(warning => warning.message || warning).join(" ") : row.pendingIdentification ? "No se supone existencia cero." : "Sin reutilización ni trasiego supuesto.", row.originalDescriptions, row.sourceRefs];
  }), { freezeColumns: 2 });
  const procurementHeaders = ["Categoría", "Descripción", "ID físico", "Total solicitado", "Inventario disponible", "Cantidad provisional", "Acción", "Celdas de origen"];
  const procurementValues = rows => rows.map(row => [row.category || "", row.description, row.warehouseInventoryId || "EXTERNO", row.demand, row.available === null ? "NO IDENTIFICADO / EXTERNO" : row.available, row.shortage, row.action, row.sourceRefs]);
  addTableSheet(workbook, "Renta provisional", procurementHeaders, procurementValues(model.rental));
  addTableSheet(workbook, "Compra provisional", procurementHeaders, procurementValues(model.purchase));
  addTableSheet(workbook, "Pendientes", ["Tipo", "Evento", "Descripción", "Cantidad solicitada", "Motivo / acción", "Celdas de origen"], model.pending.map(row => [row.kind, row.event, row.description, row.quantity ?? "", row.reason, row.sourceRefs]));
  addTableSheet(workbook, "Detalle por evento", ["Evento", "Fecha", "Categoría", "Cantidad", "Descripción original", "ID físico recibido", "Observaciones", "Celdas de origen"], model.details.map(row => [row.event, row.date, row.category, row.quantity, row.description, row.warehouseInventoryId, primitive(row.notes), row.sourceRefs]));
  addTableSheet(workbook, "Inventario consultado", ["ID físico", "Categoría", "Descripción", "Tipo registrado", "Registrado", "En eventos", "Consumido", "En taller", "En renta", "Perdido", "Disponible"], model.stocks.map(row => [row.id, row.category, row.name, row.itemType, row.registered, row.out, row.consumed, row.workshop, row.rented, row.lost, row.available]));
  addTableSheet(workbook, "Celdas fuente", ["Evento", "Hoja", "Celda original", "Valor original", "Parte", "Total de partes"], model.sourceCells.flatMap(cell => {
    const value = primitive(cell.value); const parts = typeof value === "string" ? chunks(value) : [value];
    return parts.map((part, index) => [cell.event, cell.sheet, cell.ref, part, index + 1, parts.length]);
  }));
  addTableSheet(workbook, "Filas originales", ["Evento", "Sección", "Orden de sección", "Orden de fila", "Tipo", "Cantidad", "Descripción original", "Observaciones", "Celdas de origen"], model.preservedRows.map(row => [row.event, row.section, row.sectionIndex, row.rowIndex, row.type, row.quantity, row.description, primitive(row.notes), row.refs]));
  const raw = [...model.originalEvents.map((event, index) => ({ kind: "Evento", id: event.id || model.events[index]?.id || "", data: event })), { kind: "Inventario activo", id: model.inventorySavedAt, data: model.originalInventory }];
  addTableSheet(workbook, "Datos completos", ["Tipo", "ID / versión", "Parte", "Total de partes", "JSON original · unir partes en orden"], raw.flatMap(entry => { const parts = chunks(losslessJson(entry.data)); return parts.map((part, index) => [entry.kind, entry.id, index + 1, parts.length, part]); }), { widths: [20, 32, 12, 18, 120] });
  return workbook;
}

function reportTable(headers, rows) {
  return `<table${headers[0] === "Tipo" ? ' class="pending-table"' : ""}><thead><tr>${headers.map(value => `<th>${html(value)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map((value, index) => `<td${typeof value === "number" ? ' class="number"' : ""}>${html(value)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No hay referencias en esta sección.</td></tr>`}</tbody></table>`;
}
function renderEquipmentReportHtml(model, mode = "summary") {
  const title = mode === "rent" ? "Resumen de renta" : mode === "purchase" ? "Resumen de compra de insumos" : "Resumen de equipo";
  const selected = mode === "rent" ? model.rental : mode === "purchase" ? model.purchase : model.rows;
  let category = "";
  const categoryRows = selected.map(row => {
    const prefix = row.category !== category ? `<tr class="category"><td colspan="6">${html(row.category || "Sin categoría")}</td></tr>` : ""; category = row.category;
    return prefix + `<tr><td>${html(row.description)}</td><td class="number">${html(row.demand)}</td><td class="number">${html(row.available === null ? "Por identificar / externo" : row.available)}</td><td class="number">${html(row.shortage === null ? "Por revisar" : row.shortage)}</td><td>${html(row.action)}</td><td>${html(row.sourceRefs || "Ver detalle en Excel máster")}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${html(title)} provisional</title><style>
  @page{size:letter landscape;margin:12mm;@bottom-center{content:"PROVISIONAL - Sin reservas ni movimientos de inventario";font:8px Arial,sans-serif;color:#586777}}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#182638;margin:0}.equipment-pdf-document{width:100%;min-height:140px}.banner{border:2px solid #bd8600;background:#fff6dc;padding:9px;font-size:11px;margin:10px 0}h1{font-size:25px;margin:4px 0}h2{font-size:15px;margin:18px 0 6px}p{line-height:1.45}.brand{letter-spacing:2px;font-weight:700;color:#53677d}.meta{color:#53677d}table{width:100%;border-collapse:collapse;table-layout:auto;margin:8px 0}thead{display:table-header-group}th{background:#152b46;color:#fff;text-align:left;padding:7px}td{padding:6px;border-bottom:1px solid #d7e0e8;vertical-align:top;overflow-wrap:anywhere}tr:nth-child(even) td{background:#f3f6fa}tr{break-inside:avoid}.category td{background:#dae3ef!important;font-weight:bold}.number{text-align:right;white-space:nowrap}.pending-table td:first-child,.pending-table th:first-child{white-space:nowrap}.pending td{background:#fff8e8}</style></head><body><main class="equipment-pdf-document"><div class="brand">LIVE PRODUCTIONS · REQUERIMIENTO DE EQUIPO</div><h1>${html(title)} · PROVISIONAL</h1><div class="meta">Generado: ${html(displayTimestamp(model.createdAt))} · Inventario consultado: ${html(displayTimestamp(model.inventorySavedAt))} · ${model.counts.events} eventos · ${model.counts.equipmentRows} renglones de equipo (${model.counts.zeroQuantityRows} en cero) · Fuente: Contabilidad de Equipo</div><div class="banner">${html(model.disclaimer)}</div>
  <h2>Eventos incluidos</h2>${reportTable(["Fecha", "Ubicación", "Tipo", "Montaje", "Inicio", "Finalización", "Regreso a bodega"], model.events.map(event => [event.date || "Pendiente", event.place || event.name || event.id, event.type || "", event.setupAt || "Pendiente", event.startAt || "Pendiente", event.endAt || "Pendiente", event.equipmentInAt || "Pendiente"]))}
  <h2>${html(title)}: ${selected.length} referencias</h2><table><thead><tr><th>Descripción</th><th>Total solicitado</th><th>Inventario disponible</th><th>Faltante provisional</th><th>Acción</th><th>Celdas de origen</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="6">No hay faltantes confirmados en esta sección.</td></tr>'}</tbody></table>
  <h2>Pendientes por resolver (${model.pending.length})</h2><p>Estos casos se excluyen de las órdenes de compra o renta hasta identificarlos o confirmar su clasificación. Las cantidades con horarios pendientes son conservadoras y podrían disminuir al confirmar una logística viable.</p>${reportTable(["Tipo", "Evento", "Descripción", "Cantidad", "Motivo / acción", "Celdas"], model.pending.map(row => [row.kind, row.event, row.description, row.quantity ?? "", row.reason, row.sourceRefs]))}
  </main></body></html>`;
}

module.exports = { createEquipmentReportModel, createEquipmentMasterWorkbook, renderEquipmentReportHtml, sourceCellsForEvent, warehouseRows, DISCLAIMER };
