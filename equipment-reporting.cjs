"use strict";

// Read-only report generation. This module never opens an event store or writes
// to the warehouse: its only inputs are selected current events and the active
// warehouse snapshot supplied by the authenticated server endpoint.
const { calculateEquipmentAvailability, normalizeEvent, localTime, eventReservationStartAt, resolveEquipmentPurchasedLine, effectiveEquipmentProcurementChoice } = require("./equipment-event-store.cjs");
const EquipmentIdentity = require("./equipment-identity.js");
const EquipmentDocumentAudit = require("./equipment-document-audit.js");

const DISCLAIMER = "PROVISIONAL · Sin reservas ni movimientos de inventario. No se supone ningún trasiego, retorno o reutilización entre eventos. Los pendientes no constituyen órdenes de compra o renta.";
const TRANSFER_DISCLAIMER = "PROPUESTA PROVISIONAL DE TRASIEGO · Sin reservas ni movimientos de inventario. Las rutas no están confirmadas. Revise los horarios y los tiempos de transporte antes de organizar el traslado. Este reporte no reduce los resúmenes conservadores de renta o compra.";
const MAX_CELL_TEXT = 30000;
function invalid(message) { return Object.assign(new Error(message), { statusCode: 400 }); }
function text(value) { return String(value ?? ""); }
function html(value) { return text(value).replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character])); }
function finite(value) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function list(value) { return Array.isArray(value) ? value : []; }
function eventScheduleLabel(event, field, pending = "Pendiente") {
  if (field === "setupAt" && event.setupApplies === false) return event.setupAt
    ? `No aplica; dato de montaje por revisar: ${text(event.setupAt)}` : "No aplica";
  if (event[field]) return text(event[field]);
  const prefix = { setupAt: "setup", startAt: "start", endAt: "end", equipmentInAt: "equipmentIn" }[field];
  const date = text(event[`${prefix}Date`] || (field === "startAt" ? event.date : ""));
  const time = text(event[`${prefix}Time`]);
  if (date && time) return `${date} · ${time} (por confirmar)`;
  if (date) return `${date} · hora pendiente`;
  if (time) return `Fecha pendiente · ${time}`;
  return pending;
}
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
function warningRefs(message) {
  const refs = [message?.sourceRefs, message?.refs].flatMap(value => typeof value === "string" ? [value] : list(value));
  return [...new Set(refs.filter(Boolean))];
}
function sourceDocuments(event) {
  const documents = [], seen = new Set();
  function visit(document, reference = false) {
    if (!document || typeof document !== "object" || seen.has(document)) return;
    seen.add(document); documents.push({ document, reference });
    for (const entry of [...list(document.referenceTables), ...list(document.sourceImport?.referenceTables)]) visit(entry, true);
  }
  visit(event); return documents;
}
function sourceWarningRows(event) {
  const unique = new Map();
  for (const { document, reference } of sourceDocuments(event)) {
    const source = document.sourceImport || {};
    const eventIds = new Set([event.id, event.sourceImport?.sourceEventId, document.id, source.sourceEventId].filter(Boolean));
    const messages = [...list(document.warnings), ...list(document.issues), ...list(source.warnings),
      ...list(source.sourceIssues), ...list(source.sourceWarnings), ...list(source.acceptedWarnings)];
    for (const message of messages) {
      // A reference copy has no separate event schedule or location to finish.
      if (reference && ["pending_times", "missing_date", "missing_place"].includes(message?.code)) continue;
      if (list(message?.eventIds).length && !message.eventIds.some(id => eventIds.has(id))) continue;
      const reason = typeof message === "string" ? message : message?.message || message?.reason || message?.description || message?.code || (message && JSON.stringify(message)) || "";
      if (!reason) continue;
      const key = message?.code === "pending_times" ? "pending_times" : reason;
      const refs = warningRefs(message);
      if (unique.has(key)) {
        const row = unique.get(key); row.refs = [...new Set([...row.refs, ...refs])];
        continue;
      }
      unique.set(key, { kind: "FUENTE", eventId: event.id, event: event.place || event.name || event.id,
        description: typeof message === "object" ? message.description || message.code || "Aviso del archivo" : "Aviso del archivo",
        quantity: ["number", "string"].includes(typeof message?.quantity) ? message.quantity : null, reason, refs });
    }
  }
  return [...unique.values()].map(({ refs, ...row }) => ({ ...row,
    reason: event.sourceImport?.warningsAccepted ? `Aviso del archivo aceptado al cargar: ${row.reason}` : row.reason,
    sourceRefs: refs.join("; ") }));
}
function unresolvedSourceRow(event, row, reference = false) {
  const literal = text(row.description) || list(row.cells || row.sourceCells).map(cell => text(originalCellValue(cell))).join(" | ");
  return { kind: "FUENTE", eventId: event.id, event: event.place || event.name || event.id,
    description: reference ? "Fila de referencia sin interpretar" : "Fila del archivo sin interpretar", quantity: row.quantity ?? null,
    reason: `Revise la fila original: ${literal}. Su cantidad no se convirtió en cero ni se incluyó en la demanda de equipo.`,
    sourceRefs: [...new Set([...warningRefs(row), ...list(row.cells || row.sourceCells).map(cell => cell.ref || cell.address)].filter(Boolean))].join("; ") };
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
    pending.push(...sourceWarningRows(event));
    pending.push(...EquipmentDocumentAudit.audit(event));
    const applicableTimes = Object.entries(metadataNames).filter(([field]) => field !== "setupAt" || event.setupApplies !== false);
    for (const [field, label] of applicableTimes) if (!event[field] || !Number.isFinite(localTime(event[field]))) pending.push({ kind: "HORARIO", eventId: event.id, event: event.place || event.name || event.id,
      description: label, quantity: null, reason: event[field] ? "Corrija esta fecha u hora. Su valor literal se conserva; no se usa para reducir renta." : "Pendiente: no se presupone ningún trasiego o retorno.", sourceRefs: "" });
    if (event.setupApplies === false && event.setupAt) pending.push({ kind: "HORARIO", eventId: event.id, event: event.place || event.name || event.id,
      description: metadataNames.setupAt, quantity: null, reason: "El evento indica que no aplica montaje y conserva un dato de montaje. Confirme cuál corresponde antes de reservar; ambos valores se muestran en el reporte.", sourceRefs: "" });
    const suppliedTimes = applicableTimes.map(([field]) => localTime(event[field])).filter(Number.isFinite);
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
      list(section.rows).forEach((row, rowIndex) => {
        preservedRows.push({ eventId: event.id, event: event.place || event.name || event.id, sectionIndex,
          section: section.title || "", rowIndex, type: row.type || row.kind || "", quantity: row.quantity ?? "", description: row.description ?? "",
          notes: list(row.notes).join("\n") || row.notes || "", refs: [...list(row.sourceRefs), ...list(row.cells).map(cell => cell.ref || cell.address)].filter(Boolean).join("; "), original: row });
        if ((row.type || row.kind) === "unresolved") pending.push(unresolvedSourceRow(event, row));
      });
      if (section.notes?.length) preservedRows.push({ eventId: event.id, event: event.place || event.name || event.id, sectionIndex, section: section.title || "", rowIndex: "", type: "notes", quantity: "", description: "Notas de la sección", notes: list(section.notes).join("\n"), refs: "", original: section.notes });
    });
    for (const { document, reference } of sourceDocuments(event)) {
      if (!reference) continue;
      list(document.sections).forEach((section, sectionIndex) => list(section.rows).forEach((row, rowIndex) => {
        preservedRows.push({ eventId: event.id, event: event.place || event.name || event.id, sectionIndex,
          section: `Referencia del archivo · ${section.title || document.sourceSheet || ""}`, rowIndex, type: row.type || row.kind || "", quantity: row.quantity ?? "", description: row.description ?? "",
          notes: list(row.notes).join("\n") || row.notes || "", refs: [...list(row.sourceRefs), ...list(row.cells).map(cell => cell.ref || cell.address)].filter(Boolean).join("; "), original: row });
        if ((row.type || row.kind) === "unresolved") pending.push(unresolvedSourceRow(event, row, true));
      }));
    }
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

function createEquipmentTransferReportModel(payload, inventory, options = {}) {
  // Keep the full conservative report and its source ledger. Planning is an
  // additional read-only proposal; it never changes the procurement quantities.
  const model = createEquipmentReportModel(payload, inventory, options);
  const eligible = [], excluded = [];
  for (const event of model.events) {
    const values = [eventReservationStartAt(event), event.startAt, event.endAt, event.equipmentInAt];
    const times = values.map(localTime);
    let reason = "";
    if (!text(event.place)) reason = "Falta la ubicación. No se dedujo un lugar para proponer un traslado.";
    else if (event.setupApplies === false && text(event.setupAt)) reason = "El montaje indica que no aplica y conserva una fecha. Confirme ese dato antes de proponer una ruta.";
    else if (times.some(time => !Number.isFinite(time))) reason = "Faltan fechas u horas válidas de montaje o salida, inicio, finalización o regreso a bodega. El equipo del evento queda pendiente de logística.";
    else if (times.some((time, index) => index && time < times[index - 1])) reason = "Las fechas de montaje, inicio, finalización y regreso a bodega se contradicen. No se propuso una ruta para este evento.";
    if (reason) excluded.push({ eventId: event.id, event: event.place || event.name || event.id, reason });
    else eligible.push(event);
  }
  const availability = calculateEquipmentAvailability(eligible, inventory, { from: model.from, to: model.to,
    transfers: [], routeEstimates: payload.routeEstimates });
  const eventsById = new Map(model.events.map(event => [event.id, event]));
  const eventSummary = event => ({ id: event.id, client: event.client || event.name || "", name: event.name || "", place: event.place || "", date: event.date || "", type: event.type || "",
    setupApplies: event.setupApplies, setupAt: event.setupAt || "", startAt: event.startAt || "", endAt: event.endAt || "", equipmentInAt: event.equipmentInAt || "" });
  const routes = [], rentalRoutes = [];
  for (const row of availability.rows) {
    const add = (route, source, output) => {
      const from = eventsById.get(route.fromEventId), to = eventsById.get(route.toEventId);
      if (!from || !to || !(route.quantity > 0)) return;
      const refs = model.details.filter(line => [from.id, to.id].includes(line.eventId) && line.resolvedInventoryId === row.warehouseInventoryId)
        .map(line => line.sourceRefs).filter(Boolean);
      output.push({ ...route, source, description: row.description, category: row.category || "Sin categoría", warehouseInventoryId: row.warehouseInventoryId,
        from: eventSummary(from), to: eventSummary(to), sourceRefs: [...new Set(refs)].join("; "), provisional: true, requiresConfirmation: true });
    };
    for (const route of list(row.planning?.routes)) add(route, "warehouse", routes);
    for (const route of list(row.planning?.rentalRoutes)) add(route, "rental", rentalRoutes);
  }
  const order = (a, b) => text(a.departureAt).localeCompare(text(b.departureAt)) || text(a.fromEventId).localeCompare(text(b.fromEventId))
    || text(a.toEventId).localeCompare(text(b.toEventId)) || text(a.category).localeCompare(text(b.category), "es") || text(a.description).localeCompare(text(b.description), "es");
  routes.sort(order); rentalRoutes.sort(order);
  const warnings = [...new Set(list(availability.logistics?.warnings))];
  if (excluded.length) warnings.push("Los eventos con datos de logística pendientes se conservan en el detalle, pero no participan en las propuestas de trasiego.");
  if (!routes.length) warnings.push("No se identificaron tramos de equipo propio para proponer. Revise los pendientes y el detalle de cada evento; no se inventaron rutas.");
  return { ...model, reportMode: "transfer", disclaimer: TRANSFER_DISCLAIMER, transferRoutes: routes, rentalTransferRoutes: rentalRoutes,
    transferExcludedEvents: excluded, transferWarnings: [...new Set(warnings)], logistics: availability.logistics,
    transferPlanningEventIds: eligible.map(event => event.id), productionMutations: 0 };
}

function planningEventIssue(event) {
  const values = [eventReservationStartAt(event), event.startAt, event.endAt, event.equipmentInAt];
  const times = values.map(localTime);
  if (event.setupApplies === false && text(event.setupAt)) return "El montaje indica que no aplica y conserva una fecha de montaje.";
  if (times.some(time => !Number.isFinite(time))) return "Faltan fechas u horas válidas de montaje o salida, inicio, finalización o regreso a bodega.";
  if (times.some((time, index) => index && time < times[index - 1])) return "Las fechas de montaje, inicio, finalización y regreso a bodega se contradicen.";
  return "";
}

function createEquipmentPlanningReportModel(payload, inventory, options = {}) {
  const base = createEquipmentReportModel(payload, inventory, options);
  const eventIssues = new Map(base.events.map(event => [event.id, planningEventIssue(event)]));
  const eventById = new Map(base.events.map(event => [event.id, event]));
  // A malformed schedule stays in the ledger and demand, but cannot acquire a
  // fabricated interval. The engine's pending rows are explicitly null below.
  const calculationEvents = base.events.map(event => eventIssues.get(event.id)
    ? { ...event, setupAt: "", startAt: "", endAt: "", equipmentInAt: "", equipmentOutAt: "" }
    : event);
  // The posted event selection is the report scope. Agenda filters may differ
  // from an uploaded workbook; both scenarios must still compare these events.
  const availability = calculateEquipmentAvailability(calculationEvents, inventory, { transfers: [], routeEstimates: payload.routeEstimates,
    ...(options.now === undefined ? {} : { now: options.now }) });
  const sourceRows = new Map(base.rows.map(row => [row.id, row]));
  const stockById = new Map(base.stocks.map(stock => [stock.id, stock]));
  const summary = event => ({ id: event.id, client: event.client || event.name || "", name: event.name || "", place: event.place || "", date: event.date || "", type: event.type || "",
    setupApplies: event.setupApplies, setupAt: event.setupAt || "", startAt: event.startAt || "", endAt: event.endAt || "", equipmentInAt: event.equipmentInAt || "" });
  const scenarioRows = availability.rows.map(row => {
    const source = sourceRows.get(row.id), stock = stockById.get(row.warehouseInventoryId);
    const demand = Number(row.quantity), empty = demand === 0;
    const identityPending = Boolean(row.pendingIdentification || row.pendingClassification || row.procurementBlocked || row.procurementChoice === "save");
    const relatedEvents = row.events.map(entry => eventById.get(entry.eventId)).filter(Boolean);
    const timingPending = relatedEvents.some(event => eventIssues.get(event.id));
    const placePending = relatedEvents.some(event => !text(event.place).trim());
    const isConsumable = row.itemType === "consumible";
    const equipmentPurchase = !isConsumable && (row.procurementChoice === "purchase" || row.preferredPurchase);
    const reasons = [];
    if (!empty && row.pendingIdentification) reasons.push("Identifique esta referencia en el inventario vigente; no se supone existencia cero.");
    if (!empty && row.pendingClassification) reasons.push("Confirme si la referencia es equipo reutilizable o consumible en Contabilidad.");
    if (!empty && row.procurementChoice === "save") reasons.push("El ingreso de este equipo a Contabilidad está pendiente.");
    if (timingPending && !isConsumable) reasons.push("Complete o corrija los horarios de los eventos que usan este equipo antes de cerrar la comparación.");
    if (placePending && !isConsumable) reasons.push("Falta la ubicación de un evento para evaluar su trasiego.");
    if (equipmentPurchase) reasons.push("Este equipo tiene una decisión de compra; no se convirtió en una renta ni en un consumible.");
    if (!empty && !isConsumable && row.planning?.optimal === false && !identityPending && !timingPending) reasons.push("El plan requiere revisar las restricciones o movimientos físicos antes de cerrar el escenario con trasiego.");
    const pendingWithoutTransfer = !empty && !isConsumable && (identityPending || timingPending || equipmentPurchase);
    const pendingWithTransfer = !empty && !isConsumable && (pendingWithoutTransfer || placePending || row.planning?.optimal === false);
    const requiredWithoutTransfer = empty ? 0 : isConsumable ? demand : pendingWithoutTransfer ? null : Number(row.required);
    const rentWithoutTransfer = empty ? 0 : isConsumable ? null : pendingWithoutTransfer ? null : Number(row.missing);
    const requiredWithTransfer = empty ? 0 : isConsumable ? demand : pendingWithTransfer ? null : Number(row.planning.requiredFleet);
    const rentWithTransfer = empty ? 0 : isConsumable ? null : pendingWithTransfer ? null : Number(row.planning.rentalPotential);
    const purchaseQuantity = !isConsumable ? null : empty ? 0 : identityPending || row.procurementChoice === "rent" ? null
      : row.procurementChoice === "purchase" ? demand : stock ? Math.max(0, demand - stock.available) : null;
    if (isConsumable && row.procurementChoice === "rent") reasons.push("El artículo está clasificado como consumible y marcado para renta; revise esa decisión.");
    const mapRoute = (route, routeSource) => {
      const from = eventById.get(route.fromEventId), to = eventById.get(route.toEventId);
      const refs = base.details.filter(line => [from?.id, to?.id].includes(line.eventId) && line.resolvedInventoryId === row.warehouseInventoryId).map(line => line.sourceRefs).filter(Boolean);
      return { ...route, source: routeSource, description: row.description, category: row.category || "Sin categoría", warehouseInventoryId: row.warehouseInventoryId,
        from: from ? summary(from) : null, to: to ? summary(to) : null, sourceRefs: [...new Set(refs)].join("; "), provisional: true, requiresConfirmation: true };
    };
    const routes = pendingWithTransfer || isConsumable || equipmentPurchase ? [] : list(row.planning?.routes).map(route => mapRoute(route, "warehouse"));
    const rentalRoutes = pendingWithTransfer || isConsumable || equipmentPurchase ? [] : list(row.planning?.rentalRoutes).map(route => mapRoute(route, "rental"));
    const warnings = list(row.planning?.warnings);
    return { id: row.id, warehouseInventoryId: row.warehouseInventoryId || "", description: row.description, category: row.category || "Sin categoría", itemType: row.itemType,
      demand, available: stock ? stock.available : null, ownedCapacity: identityPending ? null : Number(row.capacity),
      requiredWithoutTransfer, rentWithoutTransfer, requiredWithTransfer, rentWithTransfer, purchaseQuantity,
      pending: !empty && (isConsumable ? purchaseQuantity === null : pendingWithoutTransfer || pendingWithTransfer),
      pendingWithoutTransfer, pendingWithTransfer, pendingIdentification: !empty && row.pendingIdentification, pendingClassification: !empty && row.pendingClassification,
      equipmentPurchase, reason: [...new Set(reasons)].join(" "), eventQuantities: { ...row.eventQuantities },
      events: relatedEvents.map(summary), sourceRefs: source?.sourceRefs || "", routes, rentalRoutes, warnings,
      allocations: pendingWithTransfer || isConsumable || equipmentPurchase ? [] : list(row.planning?.allocations),
      assumptions: list(row.planning?.assumptions), requiresRentalSupplierConfirmation: rentalRoutes.length > 0,
      requiresTimeConfirmation: [...routes, ...rentalRoutes].some(route => route.requiresTimeConfirmation) };
  }).sort((a, b) => text(a.category).localeCompare(text(b.category), "es") || text(a.description).localeCompare(text(b.description), "es"));
  const transferRoutes = scenarioRows.flatMap(row => row.routes), rentalTransferRoutes = scenarioRows.flatMap(row => row.rentalRoutes);
  const routeOrder = (a, b) => text(a.departureAt).localeCompare(text(b.departureAt)) || text(a.fromEventId).localeCompare(text(b.fromEventId))
    || text(a.toEventId).localeCompare(text(b.toEventId)) || text(a.category).localeCompare(text(b.category), "es") || text(a.description).localeCompare(text(b.description), "es");
  transferRoutes.sort(routeOrder); rentalTransferRoutes.sort(routeOrder);
  const scenarioExcludedEvents = base.events.filter(event => eventIssues.get(event.id) || !text(event.place).trim()).map(event => ({ eventId: event.id,
    event: event.client || event.name || event.place || event.id, reason: eventIssues.get(event.id) || "Falta la ubicación del evento." }));
  const scenarioWarnings = [...new Set([...list(availability.logistics?.warnings), ...scenarioRows.flatMap(row => row.reason ? [row.reason] : [])])];
  if (scenarioRows.some(row => row.pendingIdentification || row.pendingClassification)) scenarioWarnings.push("Las referencias pendientes de identidad o clasificación pueden cambiar los reportes. Sus existencias y faltantes no se interpretan como cero.");
  return { ...base, reportMode: "planning", disclaimer: "PLAN PROVISIONAL · Compara los mismos eventos con el inventario vigente. Las rutas y sus tiempos estimados requieren revisión. Abrir o imprimir estos reportes no confirma reservas, movimientos, rentas ni compras.",
    scenarioRows, rentalComparison: scenarioRows.filter(row => row.itemType !== "consumible" && !row.equipmentPurchase),
    consumablePurchases: scenarioRows.filter(row => row.itemType === "consumible"), otherEquipmentPurchases: scenarioRows.filter(row => row.equipmentPurchase),
    transferRoutes, rentalTransferRoutes, scenarioWarnings: [...new Set(scenarioWarnings)], scenarioExcludedEvents,
    logistics: availability.logistics, productionMutations: 0 };
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
  addTableSheet(workbook, "Eventos", ["ID", "Ubicación", "Nombre", "Tipo", "Fecha", "Montaje", "Inicio", "Finalización", "Regreso a bodega", "Observaciones"], model.events.map(event => [event.id, event.place || "", event.name || "", event.type || "", event.date || "", eventScheduleLabel(event, "setupAt", "PENDIENTE"), eventScheduleLabel(event, "startAt", "PENDIENTE"), eventScheduleLabel(event, "endAt", "PENDIENTE"), eventScheduleLabel(event, "equipmentInAt", "PENDIENTE"), event.notes || ""]));
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

function reportTable(headers, rows, className = "") {
  const classes = [headers[0] === "Tipo" ? "pending-table" : "", className].filter(Boolean).join(" ");
  return `<table${classes ? ` class="${html(classes)}"` : ""}><thead><tr>${headers.map(value => `<th>${html(value)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map((value, index) => `<td${typeof value === "number" ? ' class="number"' : ""}>${html(value)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">No hay referencias en esta sección.</td></tr>`}</tbody></table>`;
}
function renderEquipmentTransferReportHtml(model) {
  const schedule = event => reportTable(["Cliente / evento", "Fecha", "Ubicación", "Montaje", "Inicio", "Finalización", "Regreso a bodega"], [[
    event.client || event.name || event.id, event.date || "Pendiente", event.place || "Pendiente", eventScheduleLabel(event, "setupAt"),
    eventScheduleLabel(event, "startAt"), eventScheduleLabel(event, "endAt"), eventScheduleLabel(event, "equipmentInAt")]]);
  const renderRoutes = (routes, rental = false) => {
    const groups = new Map();
    for (const route of routes) {
      const id = JSON.stringify([route.fromEventId, route.toEventId]);
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(route);
    }
    if (!groups.size) return `<p>${rental ? "No se propusieron traslados de equipo rentado entre eventos." : "No hay tramos de equipo propio propuestos. El detalle de los eventos y los pendientes se conserva a continuación."}</p>`;
    return [...groups.values()].map(entries => {
      const route = entries[0];
      const timeLabel = entry => entry.requiresTimeConfirmation
        ? `${entry.travelMinutes} min de transporte + ${entry.handlingMinutes} min de desmontaje / preparación · ESTIMADOS; requieren confirmación`
        : `${entry.travelMinutes} min de transporte + ${entry.handlingMinutes} min de desmontaje / preparación · tiempos indicados por el usuario; ruta pendiente de confirmar`;
      return `<section class="route"><h3>${html(route.from.place)} → ${html(route.to.place)}</h3><p>${rental ? "COORDINAR CON PROVEEDOR · Propuesta de traslado de las mismas unidades rentadas. No representa equipo propio disponible." : "EQUIPO PROPIO · Propuesta sin confirmar. No registra una salida ni reduce la renta del reporte conservador."}</p><h4>Origen</h4>${schedule(route.from)}<h4>Destino</h4>${schedule(route.to)}${reportTable(["Categoría", "Equipo", "Cantidad propuesta", "Salida del origen", "Requerido en destino", "Tiempo por revisar", "Celdas de origen"], entries.map(entry => [entry.category, entry.description, entry.quantity, entry.departureAt || "Pendiente", entry.setupAt || "Pendiente", timeLabel(entry), entry.sourceRefs || "Ver archivo original"]))}</section>`;
    }).join("");
  };
  const eventDetails = model.events.map(event => {
    const lines = model.details.filter(line => line.eventId === event.id).sort((a, b) => text(a.category).localeCompare(text(b.category), "es") || a.sectionIndex - b.sectionIndex || a.itemIndex - b.itemIndex);
    const notes = model.preservedRows.filter(row => row.eventId === event.id && !row.section.startsWith("Referencia del archivo") && row.type !== "item" && (row.description || row.notes));
    return `<section class="event-detail"><h3>${html(event.client || event.name || event.place || event.id)}</h3>${schedule(event)}${reportTable(["Categoría", "Equipo solicitado", "Cantidad", "Observaciones", "Celdas"], lines.map(line => [line.category, line.description, line.quantity, line.notes, line.sourceRefs]), "transfer-item-table")}${notes.length ? `<h4>Encabezados y observaciones del archivo</h4>${reportTable(["Sección", "Tipo", "Contenido", "Observaciones", "Celdas"], notes.map(row => [row.section, row.type, row.description, row.notes, row.refs]), "transfer-note-table")}` : ""}</section>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen de trasiego provisional</title><style>
  @page{size:letter landscape;margin:12mm;@bottom-center{content:"PROPUESTA PROVISIONAL - Sin reservas ni movimientos de inventario";font:8px Arial,sans-serif;color:#586777}}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#182638;margin:0}.equipment-pdf-document{width:100%;min-height:140px}.brand{letter-spacing:2px;font-weight:700;color:#53677d}h1{font-size:25px;margin:4px 0}h2{font-size:17px;margin:22px 0 8px}h3{font-size:14px;margin:18px 0 6px}h4{font-size:11px;margin:12px 0 4px}.meta{color:#53677d}.banner{border:2px solid #bd8600;background:#fff6dc;padding:9px;font-size:11px;margin:10px 0}p,li{line-height:1.45}table{width:100%;border-collapse:collapse;margin:8px 0;table-layout:auto}thead{display:table-header-group}th{background:#152b46;color:#fff;text-align:left;padding:4px}td{padding:4px;border-bottom:1px solid #d7e0e8;vertical-align:top;overflow-wrap:anywhere}tr:nth-child(even) td{background:#f3f6fa}tr{break-inside:avoid}h2,h3,h4{break-after:avoid}.route,.event-detail{margin:18px 0}.number{text-align:right;white-space:nowrap}.pending-table{table-layout:fixed}.pending-table th:nth-child(1){width:8%}.pending-table th:nth-child(2){width:15%}.pending-table th:nth-child(3){width:18%}.pending-table th:nth-child(4){width:6%}.pending-table th:nth-child(5){width:32%}.pending-table th:nth-child(6){width:21%}.transfer-item-table,.transfer-note-table{table-layout:fixed}.transfer-item-table th:nth-child(1){width:15%}.transfer-item-table th:nth-child(2){width:45%}.transfer-item-table th:nth-child(3){width:7%}.transfer-item-table th:nth-child(4){width:20%}.transfer-item-table th:nth-child(5){width:13%}.transfer-note-table th:nth-child(1){width:18%}.transfer-note-table th:nth-child(2){width:8%}.transfer-note-table th:nth-child(3){width:35%}.transfer-note-table th:nth-child(4){width:20%}.transfer-note-table th:nth-child(5){width:19%}</style></head><body><main class="equipment-pdf-document"><div class="brand">LIVE PRODUCTIONS · REQUERIMIENTO DE EQUIPO</div><h1>Resumen de trasiego · PROVISIONAL</h1><p class="meta">Generado: ${html(displayTimestamp(model.createdAt))} · Inventario consultado: ${html(displayTimestamp(model.inventorySavedAt))} · ${model.counts.events} eventos · ${model.counts.equipmentRows} renglones de equipo (${model.counts.zeroQuantityRows} en cero) · ${model.counts.sourceCells} celdas originales conservadas</p><div class="banner">${html(model.disclaimer)}</div><h2>Advertencias y revisión de logística</h2><ul>${list(model.transferWarnings).map(warning => `<li>${html(warning)}</li>`).join("") || "<li>Las propuestas requieren revisión y confirmación antes del traslado.</li>"}</ul><h2>Propuestas entre eventos · equipo propio (${model.transferRoutes.length})</h2>${renderRoutes(model.transferRoutes)}<h2>Equipo rentado · coordinación con proveedor (${model.rentalTransferRoutes.length})</h2>${renderRoutes(model.rentalTransferRoutes, true)}<h2>Eventos pendientes de proponer una ruta (${model.transferExcludedEvents.length})</h2>${reportTable(["Evento", "Motivo"], model.transferExcludedEvents.map(event => [event.event, event.reason]))}<h2>Detalle del equipo por evento</h2><p>Las cantidades de esta sección son los requerimientos originales de cada evento, incluidas las cantidades en cero. No son cantidades confirmadas para trasegar. Las copias de referencia no añaden equipo.</p>${eventDetails}<h2>Pendientes por resolver (${model.pending.length})</h2>${reportTable(["Tipo", "Evento", "Descripción", "Cantidad", "Motivo / acción", "Celdas"], model.pending.map(row => [row.kind, row.event, row.description, row.quantity ?? "", row.reason, row.sourceRefs]))}</main></body></html>`;
}
function renderEquipmentReportHtml(model, mode = "summary") {
  if (mode === "transfer") return renderEquipmentTransferReportHtml(model);
  const title = mode === "rent" ? "Resumen de renta" : mode === "purchase" ? "Resumen de compra de insumos" : "Resumen de equipo";
  const selected = mode === "rent" ? model.rental : mode === "purchase" ? model.purchase : model.rows;
  let category = "";
  const categoryRows = selected.map(row => {
    const prefix = row.category !== category ? `<tr class="category"><td colspan="6">${html(row.category || "Sin categoría")}</td></tr>` : ""; category = row.category;
    return prefix + `<tr><td>${html(row.description)}</td><td class="number">${html(row.demand)}</td><td class="number">${html(row.available === null ? "Por identificar / externo" : row.available)}</td><td class="number">${html(row.shortage === null ? "Por revisar" : row.shortage)}</td><td>${html(row.action)}</td><td>${html(row.sourceRefs || "Ver detalle en Excel máster")}</td></tr>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${html(title)} provisional</title><style>
  @page{size:letter landscape;margin:12mm;@bottom-center{content:"PROVISIONAL - Sin reservas ni movimientos de inventario";font:8px Arial,sans-serif;color:#586777}}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#182638;margin:0}.equipment-pdf-document{width:100%;min-height:140px}.banner{border:2px solid #bd8600;background:#fff6dc;padding:9px;font-size:11px;margin:10px 0}h1{font-size:25px;margin:4px 0}h2{font-size:15px;margin:18px 0 6px}p{line-height:1.45}.brand{letter-spacing:2px;font-weight:700;color:#53677d}.meta{color:#53677d}table{width:100%;border-collapse:collapse;table-layout:auto;margin:8px 0}thead{display:table-header-group}th{background:#152b46;color:#fff;text-align:left;padding:7px}td{padding:6px;border-bottom:1px solid #d7e0e8;vertical-align:top;overflow-wrap:anywhere}tr:nth-child(even) td{background:#f3f6fa}tr{break-inside:avoid}.category td{background:#dae3ef!important;font-weight:bold}.number{text-align:right;white-space:nowrap}.pending-table td:first-child,.pending-table th:first-child{white-space:nowrap}.pending td{background:#fff8e8}</style></head><body><main class="equipment-pdf-document"><div class="brand">LIVE PRODUCTIONS · REQUERIMIENTO DE EQUIPO</div><h1>${html(title)} · PROVISIONAL</h1><div class="meta">Generado: ${html(displayTimestamp(model.createdAt))} · Inventario consultado: ${html(displayTimestamp(model.inventorySavedAt))} · ${model.counts.events} eventos · ${model.counts.equipmentRows} renglones de equipo (${model.counts.zeroQuantityRows} en cero) · Fuente: Contabilidad de Equipo</div><div class="banner">${html(model.disclaimer)}</div>
  <h2>Eventos incluidos</h2>${reportTable(["Fecha", "Ubicación", "Tipo", "Montaje", "Inicio", "Finalización", "Regreso a bodega"], model.events.map(event => [event.date || "Pendiente", event.place || event.name || event.id, event.type || "", eventScheduleLabel(event, "setupAt"), eventScheduleLabel(event, "startAt"), eventScheduleLabel(event, "endAt"), eventScheduleLabel(event, "equipmentInAt")]))}
  <h2>${html(title)}: ${selected.length} referencias</h2><table><thead><tr><th>Descripción</th><th>Total solicitado</th><th>Inventario disponible</th><th>Faltante provisional</th><th>Acción</th><th>Celdas de origen</th></tr></thead><tbody>${categoryRows || '<tr><td colspan="6">No hay faltantes confirmados en esta sección.</td></tr>'}</tbody></table>
  <h2>Pendientes por resolver (${model.pending.length})</h2><p>Estos casos se excluyen de las órdenes de compra o renta hasta identificarlos o confirmar su clasificación. Las cantidades con horarios pendientes son conservadoras y podrían disminuir al confirmar una logística viable.</p>${reportTable(["Tipo", "Evento", "Descripción", "Cantidad", "Motivo / acción", "Celdas"], model.pending.map(row => [row.kind, row.event, row.description, row.quantity ?? "", row.reason, row.sourceRefs]))}
  </main></body></html>`;
}

function renderEquipmentPlanningReportHtml(model, mode = "transfer") {
  if (!["transfer", "rent", "purchase"].includes(mode)) throw invalid("Seleccione trasiego, renta o compra de consumibles.");
  const titles = { transfer: "Trasiego de equipo", rent: "Renta con y sin trasiego", purchase: "Compra de consumibles" };
  const amount = value => value === null || value === undefined ? "Pendiente" : value;
  const eventName = event => event.client || event.name || event.place || event.id;
  const eventCodes = new Map(model.events.map((event, index) => [event.id, `E${index + 1}`]));
  const table = (headers, rows, className = "") => `<div class="table-scroll">${reportTable(headers, rows, className)}</div>`;
  const eventsTable = table(["Evento", "Fecha", "Ubicación", "Montaje", "Inicio", "Finalización", "Regreso a bodega"], model.events.map(event => [`${eventCodes.get(event.id)} · ${eventName(event)}`, event.date || "Pendiente", event.place || "Pendiente",
    eventScheduleLabel(event, "setupAt"), eventScheduleLabel(event, "startAt"), eventScheduleLabel(event, "endAt"), eventScheduleLabel(event, "equipmentInAt")]), "events-table");
  const routeGroups = routes => {
    const groups = new Map();
    for (const route of routes) {
      const key = JSON.stringify([route.fromEventId, route.toEventId]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    }
    return groups;
  };
  const routeMarkup = (routes, rental = false) => [...routeGroups(routes).values()].map(entries => {
    const route = entries[0], from = route.from, to = route.to;
    const timing = route.requiresTimeConfirmation
      ? `${route.travelMinutes} min de transporte y ${route.handlingMinutes} min de desmontaje / preparación, estimados y pendientes de revisar.`
      : `${route.travelMinutes} min de transporte y ${route.handlingMinutes} min de desmontaje / preparación, indicados por el usuario.`;
    return `<section class="route"><h3>${html(eventName(from))} → ${html(eventName(to))}</h3><p><strong>Origen:</strong> ${html(from.place)} · finaliza ${html(from.endAt)}. <strong>Destino:</strong> ${html(to.place)} · equipo requerido ${html(route.setupAt)}.</p><p>${html(timing)}${rental ? " Confirme con el proveedor que las mismas unidades rentadas pueden continuar al siguiente evento." : " Revise la ruta antes de confirmar el traslado."}</p>${table(["Categoría", "Equipo", "Cantidad a trasladar"], entries.map(entry => [entry.category, entry.description, entry.quantity]), "route-items")}</section>`;
  }).join("");
  const pendingRows = model.scenarioRows.filter(row => row.pending);
  const pendingBanner = pendingRows.length ? `<p class="warning">${pendingRows.length} referencias tienen datos pendientes y pueden cambiar las cantidades finales. Revise la sección de pendientes antes de cerrar el reporte; sus datos no se sustituyen por cero ni se omiten del archivo.</p>` : "";
  const rentalValues = rows => rows.map(row => [row.category, row.description, amount(row.ownedCapacity), amount(row.rentWithoutTransfer), amount(row.rentWithTransfer),
    row.rentWithoutTransfer === null || row.rentWithTransfer === null ? "Pendiente" : row.rentWithoutTransfer - row.rentWithTransfer,
    row.events.map(event => `${eventCodes.get(event.id)}: ${row.eventQuantities[event.id] || 0}`).join("; "),
    row.reason || (row.requiresRentalSupplierConfirmation ? "Requiere continuidad de las mismas unidades rentadas y confirmación del proveedor."
      : row.requiresTimeConfirmation ? "El resultado con trasiego usa tiempos de transporte estimados; revíselos." : row.routes.length ? "Requiere realizar los trasiegos propuestos." : "Calculado con los horarios indicados.")]);
  let content;
  if (mode === "transfer") {
    const pairCount = routeGroups(model.transferRoutes).size;
    content = `<p class="lead">${pairCount} tramos propuestos entre eventos con equipo propio · ${model.transferRoutes.length} referencias a trasladar.</p>${pendingBanner}`
      + (model.transferRoutes.length ? routeMarkup(model.transferRoutes) : '<p>No hay trasiegos de equipo propio que se puedan proponer con los datos actuales. Revise los pendientes; la falta de una propuesta no significa que falte todo el equipo.</p>')
      + (model.rentalTransferRoutes.length ? `<h2>Continuidad de equipo rentado</h2><p>Estas unidades corresponden al proveedor, y se muestran separadas del equipo propio. El escenario de renta con trasiego depende de coordinar esta continuidad.</p>${routeMarkup(model.rentalTransferRoutes, true)}` : "")
      + (model.scenarioExcludedEvents.length ? `<h2>Eventos con logística pendiente</h2>${table(["Evento", "Dato por completar"], model.scenarioExcludedEvents.map(event => [event.event, event.reason]))}` : "")
      + (pendingRows.length ? `<details class="optional-appendix report-pending"><summary>Consultar ${pendingRows.length} referencias pendientes de evaluar</summary>${table(["Categoría", "Equipo", "Cantidad solicitada", "Dato por completar"], pendingRows.map(row => [row.category, row.description, row.demand, row.reason]))}</details>` : "");
  } else if (mode === "rent") {
    const relevant = model.rentalComparison.filter(row => !row.pending && (row.rentWithoutTransfer > 0 || row.rentWithTransfer > 0));
    const rentalPending = model.rentalComparison.filter(row => row.pending);
    const covered = model.rentalComparison.filter(row => !row.pending && !relevant.includes(row));
    const headers = ["Categoría", "Equipo", "Capacidad propia", "Rentar sin trasiego", "Rentar con trasiego", "Reducción de renta", "Eventos / cantidades", "Revisión"];
    content = `<p class="lead">Compare las dos alternativas para los mismos ${model.events.length} eventos.</p><p><strong>Sin trasiego:</strong> el equipo regresa a bodega y cumple su tiempo de preparación antes de reutilizarse. <strong>Con trasiego:</strong> se propone trasladar las mismas unidades directamente entre eventos cuando los horarios lo permiten.</p>${pendingBanner}<section class="rental-results"><h2>Equipo por rentar calculado</h2>${!relevant.length && rentalPending.length ? '<p>La renta todavía no está cerrada: revise las referencias pendientes. La ausencia de cantidades calculadas no equivale a renta cero.</p>' : ""}${table(headers, rentalValues(relevant), "rental-table")}</section>`
      + (model.transferRoutes.length || model.rentalTransferRoutes.length ? `<h2>Trasiegos necesarios para obtener el resultado con trasiego</h2>${routeMarkup(model.transferRoutes)}${model.rentalTransferRoutes.length ? `<h3>Continuidad con el proveedor de renta</h3>${routeMarkup(model.rentalTransferRoutes, true)}` : ""}` : "")
      + (rentalPending.length ? `<details class="optional-appendix report-pending"><summary>Consultar ${rentalPending.length} referencias de renta pendientes</summary>${table(headers, rentalValues(rentalPending), "rental-table")}</details>` : "")
      + (covered.length ? `<details class="optional-appendix"><summary>Ver ${covered.length} referencias cubiertas o con cantidad cero</summary>${table(headers, rentalValues(covered), "rental-table")}</details>` : "")
      + (model.otherEquipmentPurchases.length ? `<h2>Equipo con decisión de compra</h2><p>Estas referencias no son consumibles ni se convirtieron automáticamente en renta.</p>${table(["Categoría", "Equipo", "Cantidad solicitada", "Revisión"], model.otherEquipmentPurchases.map(row => [row.category, row.description, row.demand, row.reason]))}` : "");
  } else {
    const relevant = model.consumablePurchases.filter(row => !row.pending && row.purchaseQuantity > 0);
    const purchasePending = model.consumablePurchases.filter(row => row.pending);
    const covered = model.consumablePurchases.filter(row => !row.pending && !relevant.includes(row));
    const purchaseValues = rows => rows.map(row => [row.category, row.description, row.demand, amount(row.available), amount(row.purchaseQuantity), row.reason || "Se suman todos los eventos. El consumible no se reutiliza mediante trasiego."]);
    const headers = ["Categoría", "Consumible", "Total solicitado", "Disponible en Contabilidad", "Comprar", "Revisión"];
    content = `<p class="lead">Los consumibles de todos los eventos se suman una sola vez y se comparan con las existencias actuales. Hacer trasiegos no reduce su consumo.</p>${pendingBanner}${!relevant.length && pendingRows.length ? '<p class="warning">La compra de consumibles no está cerrada: primero se deben identificar o clasificar las referencias pendientes. Una tabla vacía no significa que no sea necesario comprar.</p>' : ""}<section class="purchase-results"><h2>Consumibles por comprar calculados</h2>${table(headers, purchaseValues(relevant), "purchase-table")}</section>`
      + (purchasePending.length ? `<details class="optional-appendix report-pending"><summary>Consultar ${purchasePending.length} consumibles pendientes</summary>${table(headers, purchaseValues(purchasePending), "purchase-table")}</details>` : "")
      + (covered.length ? `<details class="optional-appendix"><summary>Ver ${covered.length} consumibles cubiertos o con cantidad cero</summary>${table(headers, purchaseValues(covered), "purchase-table")}</details>` : "")
      + (model.otherEquipmentPurchases.length ? `<h2>Otras decisiones de compra de equipo</h2><p>Se conservan aparte porque corresponden a equipo reutilizable.</p>${table(["Categoría", "Equipo", "Cantidad solicitada", "Revisión"], model.otherEquipmentPurchases.map(row => [row.category, row.description, row.demand, row.reason]))}` : "");
  }
  const allSourceDetails = `<details class="source-appendix optional-appendix"><summary>Consultar el detalle completo del archivo y sus celdas originales</summary><h2>Equipos por evento</h2>${table(["Evento", "Fecha", "Categoría original", "Equipo", "Cantidad", "Observaciones", "Celdas"], model.details.map(row => [row.event, row.date, row.category, row.description, row.quantity, primitive(row.notes), row.sourceRefs]))}<h2>Encabezados, notas y filas originales</h2>${table(["Evento", "Sección", "Tipo", "Cantidad", "Contenido", "Observaciones", "Celdas"], model.preservedRows.map(row => [row.event, row.section, row.type, row.quantity, row.description, primitive(row.notes), row.refs]))}<h2>Celdas originales conservadas</h2>${table(["Evento", "Hoja", "Celda", "Valor", "Dato original completo"], model.sourceCells.map(cell => [cell.event, cell.sheet, cell.ref, primitive(cell.value), primitive(cell.cell)]))}</details>`;
  const sourcePending = `<details class="optional-appendix"><summary>Consultar ${model.pending.length} avisos y referencias del archivo</summary>${table(["Tipo", "Evento", "Descripción", "Cantidad", "Motivo", "Celdas"], model.pending.map(row => [row.kind, row.event, row.description, row.quantity ?? "", row.reason, row.sourceRefs]), "pending-table")}</details>`;
  const assumptions = model.scenarioWarnings.length ? `<details class="optional-appendix"><summary>Revisar supuestos y restricciones de logística (${model.scenarioWarnings.length})</summary><ul>${model.scenarioWarnings.map(warning => `<li>${html(warning)}</li>`).join("")}</ul></details>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(titles[mode])} · Live Productions</title><style>
  @page{size:letter landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#172638;font:13px Arial,sans-serif;line-height:1.45}.equipment-pdf-document{max-width:1200px;padding:22px;margin:auto}.brand{font-weight:700;letter-spacing:2px;color:#52647a;font-size:11px}h1{font-size:26px;margin:8px 0}h2{font-size:18px;margin:22px 0 9px}h3{font-size:15px;margin:16px 0 6px}.meta{font-size:12px;color:#52647a}.banner,.warning{padding:12px;border:1px solid #d7bf80;background:#fff9e9;border-radius:7px}.lead{font-size:15px;font-weight:600}.table-scroll{max-width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;margin:10px 0;table-layout:auto}th,td{padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere;border-bottom:1px solid #d9e2eb}th{background:#18324f;color:#fff}thead{display:table-header-group}.number{text-align:right}tr:nth-child(even) td{background:#f3f6fa}.route{margin:18px 0;padding:12px;border:1px solid #d9e2eb;border-radius:7px}.route p{margin:6px 0}details{margin:18px 0;padding:12px;border:1px solid #d9e2eb;border-radius:7px}summary{cursor:pointer;font-weight:700}.rental-table{min-width:1100px;table-layout:fixed}.rental-table th:nth-child(1){width:12%}.rental-table th:nth-child(2){width:23%}.rental-table th:nth-child(3){width:9%}.rental-table th:nth-child(4){width:9%}.rental-table th:nth-child(5){width:9%}.rental-table th:nth-child(6){width:8%}.rental-table th:nth-child(7){width:16%}.rental-table th:nth-child(8){width:14%}.source-appendix td{font-size:11px}.pending-table{table-layout:fixed}.pending-table th:nth-child(5){width:35%}.pending-table th:nth-child(6){width:20%}
  @media(max-width:600px){.equipment-pdf-document{padding:14px}h1{font-size:23px}.events-table{min-width:850px}.route{padding:9px}}@media print{body{font-size:10px}.equipment-pdf-document{padding:0;max-width:none}.table-scroll{overflow:visible}table,.rental-table,.events-table{min-width:0}th,td{padding:4px}tr{break-inside:avoid}h1,h2,h3{break-after:avoid}.route{border:0;padding:0}.optional-appendix:not([open]){display:none!important}details[open]>summary{display:none}.banner{padding:7px}.meta{font-size:9px}}
  </style></head><body><main class="equipment-pdf-document"><div class="brand">LIVE PRODUCTIONS · REQUERIMIENTO DE EQUIPO</div><h1>${html(titles[mode])}</h1><p class="meta">${model.counts.events} eventos · ${model.counts.equipmentRows} líneas de equipo (${model.counts.zeroQuantityRows} en cero) · ${model.counts.sourceCells} celdas originales conservadas · Inventario: ${html(displayTimestamp(model.inventorySavedAt))} · Generado: ${html(displayTimestamp(model.createdAt))}</p><p class="banner">${html(model.disclaimer)}</p>${content}<section><h2>Eventos incluidos</h2><p>Los códigos E1, E2 y siguientes identifican las cantidades por evento en los cuadros.</p>${eventsTable}</section>${assumptions}${sourcePending}${allSourceDetails}</main></body></html>`;
}

module.exports = { createEquipmentReportModel, createEquipmentTransferReportModel, createEquipmentPlanningReportModel, createEquipmentMasterWorkbook, renderEquipmentReportHtml, renderEquipmentTransferReportHtml, renderEquipmentPlanningReportHtml, sourceCellsForEvent, warehouseRows, eventScheduleLabel, DISCLAIMER, TRANSFER_DISCLAIMER };
