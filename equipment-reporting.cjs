"use strict";

// Read-only report generation. This module never opens an event store or writes
// to the warehouse: its only inputs are selected current events and the active
// warehouse snapshot supplied by the authenticated server endpoint.
const { calculateEquipmentAvailability, normalizeEvent, localTime, eventReservationStartAt, resolveEquipmentPurchasedLine, effectiveEquipmentProcurementChoice } = require("./equipment-event-store.cjs");
const EquipmentIdentity = require("./equipment-identity.js");
const EquipmentDocumentAudit = require("./equipment-document-audit.js");
const EquipmentHandoffs = require("./equipment-handoffs.js");

const DISCLAIMER = "PROVISIONAL · Sin reservas ni movimientos de inventario. Solo se aplican los horarios indicados y los trasiegos propios seleccionados que siguen siendo válidos. Los consumibles se cuentan por evento y el consumo ya registrado no se solicita otra vez. Los pendientes no constituyen órdenes de compra o renta.";
const TRANSFER_DISCLAIMER = "PLAN PROVISIONAL DE TRASIEGO · Sin reservas ni movimientos de inventario. Incluye únicamente los trasiegos propios seleccionados y válidos y las decisiones vigentes de la agenda. La renta usa esta misma selección. Revise los horarios y los tiempos de transporte antes de ejecutar el traslado.";
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
    // Validation must not turn an unsaved draft into a confirmed reservation.
    validated.status = event.status || "draft";
    return validated;
  }).filter(event => event.status !== "cancelled");
  if (!events.length) throw invalid("No hay eventos activos para descargar.");
  // UI review, HTML, PDF and Excel use the same calculation. Only IDs are
  // accepted from the browser: route quantities, identity and current stock are
  // recalculated by the shared engine. Actual agenda decisions are server-only.
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
  const physicalHistory = planningPerformedHandoffs({ events, stocks, details }, inventory);
  // A document pointer posted by a draft is not ownership proof. In particular,
  // another event's consumption must not fulfill this event's demand. Custody
  // proofs retain their original root movement, so check the verified holder
  // before rejecting a legitimately received reusable unit.
  let verifiedCustody;
  const invalidDocumentEvents = new Set();
  for (const event of events) {
    if (!event.warehouseDispatchId) continue;
    const itemIds = new Set(details.filter(line => line.eventId === event.id && line.quantity > 0).map(line => line.resolvedInventoryId).filter(Boolean));
    const claimed = list((inventory.state || inventory).movements).filter(movement => !movement.sourceUnmatched && !movement.procurementChoice
      && ["salida", "ingreso_evento", "consumo"].includes(movement.type) && finite(movement.quantity) > 0
      && text(movement.sourceDocumentId) === event.warehouseDispatchId && itemIds.has(text(movement.itemId)));
    for (const movement of claimed) {
      if (text(movement.sourceEventId) === event.id) continue;
      const canonicalOwner = !text(movement.sourceEventId) && list(options.storedEvents).some(stored => stored.id === event.id && stored.warehouseDispatchId === event.warehouseDispatchId);
      if (canonicalOwner) continue;
      let receivedByThisEvent = false;
      if (movement.type !== "consumo" && list((inventory.state || inventory).equipmentHandoffs).length) {
        try { verifiedCustody ||= EquipmentHandoffs.getCustodyRecords(inventory.state || inventory); }
        catch (_) { verifiedCustody = []; }
        receivedByThisEvent = verifiedCustody.some(record => record.handoffId && record.holderEventId === event.id
          && record.holderDocumentId === event.warehouseDispatchId && text(record.rootMovement.itemId) === text(movement.itemId)
          && record.rootMovementId === text(movement.type === "salida" ? movement.id : movement.relatedMovementId));
      }
      if (!receivedByThisEvent) {
        invalidDocumentEvents.add(event.id);
        physicalHistory.reasons.set(text(movement.itemId), "La salida de bodega indicada pertenece a otro evento o no tiene un propietario verificable. Revise su vínculo antes de descontar consumo o acreditar equipo propio; no se usó ese crédito para cerrar la renta o compra.");
      }
    }
  }
  // A receipt is physical evidence even if its original planned route was
  // later cancelled. Count that quantity once, not again as an agenda decision.
  const actualReceipts = list((inventory.state || inventory).equipmentHandoffs);
  const agendaTransfers = list(options.transfers).map(transfer => ({ ...transfer, items: list(transfer.items).map(item => {
    const delivered = actualReceipts.filter(receipt => receipt.transferId === transfer.id && receipt.itemId === item.warehouseInventoryId
      && receipt.fromEventId === transfer.fromEventId && receipt.toEventId === transfer.toEventId).reduce((sum, receipt) => sum + finite(receipt.quantity), 0);
    return { ...item, quantity: Math.max(0, finite(item.quantity) - delivered) };
  }).filter(item => item.quantity > 0) })).filter(transfer => transfer.items.length);
  const calculationEvents = events.map(event => invalidDocumentEvents.has(event.id) ? { ...event, warehouseDispatchId: "" } : event);
  const draftLogistics = require("./equipment-draft-logistics.js").analyze(calculationEvents, inventory, {
    selectedTransferIds: payload.selectedTransferIds === undefined ? [] : payload.selectedTransferIds,
    expectedSnapshotId: payload.expectedSnapshotId, routeEstimates: payload.routeEstimates,
    transfers: [...agendaTransfers, ...physicalHistory.transfers],
    inventoryBlockReasons: [...physicalHistory.reasons].map(([warehouseInventoryId, reason]) => ({ warehouseInventoryId, reason })),
    globalInventoryBlockReason: physicalHistory.globalReason,
    ...(options.now === undefined ? {} : { now: options.now })
  });
  // Preserve the submitted pointer for review; only its unverified credit was
  // removed from the calculation copy above.
  draftLogistics.events = JSON.parse(JSON.stringify(events));
  for (const selection of list(draftLogistics.invalidSelections)) pending.push({ kind: "TRASIEGO", eventId: selection.eventId || "", event: selection.event || "",
    description: selection.id || selection.transferId || "Selección de trasiego por revisar", quantity: null,
    reason: selection.reason || selection.message || "El trasiego seleccionado ya no es válido. No se utilizó para reducir la renta.", sourceRefs: selection.sourceRefs || "" });
  const rows = draftLogistics.rows.map(row => {
    const stock = byId.get(row.warehouseInventoryId), explicit = row.procurementChoice;
    const demand = Number(row.demand ?? row.quantity);
    const pendingIdentity = demand > 0 && Boolean(row.pendingIdentification || (!stock && !["rent", "purchase"].includes(explicit)));
    const pendingClassification = demand > 0 && Boolean(row.pendingClassification);
    const available = stock ? stock.available : null;
    // Diagnostic only: unresolved classification must never create an order.
    const potential = stock ? Math.max(0, demand - available) : null;
    const action = demand === 0 ? "SIN USO (0)" : pendingIdentity ? "IDENTIFICAR EQUIPO" : pendingClassification ? "REVISAR CLASIFICACIÓN" : row.purchase > 0 ? "COMPRA" : row.rental > 0 ? "RENTA" : row.shortage === null ? "POR REVISAR" : "CUBIERTO";
    const shortage = demand === 0 ? 0 : pendingIdentity || pendingClassification ? null : row.shortage;
    const matchingDetails = details.filter(line => stock ? line.resolvedInventoryId === stock.id : line.description === row.description && line.category === row.category);
    const refs = matchingDetails.map(line => line.sourceRefs).filter(Boolean);
    const result = { ...row, demand, available, shortage, potential, action, pendingIdentification: pendingIdentity, pendingClassification, sourceRefs: [...new Set(refs)].join("; "),
      originalDescriptions: [...new Set(matchingDetails.map(line => line.description))].join("\n") || row.description };
    if (pendingIdentity || pendingClassification) pending.push({ kind: pendingIdentity ? "IDENTIDAD" : "CLASIFICACIÓN", eventId: "", event: list(row.events).map(event => event.place || event.name || event.eventId).join("; "), description: row.description,
      quantity: demand, reason: pendingIdentity ? "No hay una referencia física inequívoca. Existencia y faltante quedan pendientes; no se supone existencia cero." : list(row.classificationWarnings).map(warning => warning.message || warning).join(" ") || "Revise la clasificación en Contabilidad antes de emitir una orden.", sourceRefs: result.sourceRefs });
    return result;
  }).sort((a, b) => text(a.category).localeCompare(text(b.category), "es") || text(a.description).localeCompare(text(b.description), "es"));
  for (const item of list(draftLogistics.pending)) {
    const row = rows.find(entry => entry.id === item.rowId);
    if (!row || row.pendingIdentification || row.pendingClassification) continue;
    pending.push({ kind: "PLAN", eventId: "", event: list(row.events).map(event => event.place || event.name || event.eventId).join("; "),
      description: row.description, quantity: row.demand, reason: list(item.reasons).join(" ") || item.reason || "Revise los datos del plan antes de cerrar este pedido.", sourceRefs: row.sourceRefs });
  }
  return { provisional: true, disclaimer: DISCLAIMER, createdAt: options.createdAt || new Date().toISOString(), from: payload.from || "", to: payload.to || "",
    inventorySavedAt: inventory.savedAt || "", events, rows, stocks, details, sourceCells, preservedRows, pending,
    rental: rows.filter(row => row.action === "RENTA" && row.shortage > 0), purchase: rows.filter(row => row.action === "COMPRA" && row.shortage > 0),
    counts: { events: events.length, equipmentRows: details.length, zeroQuantityRows: details.filter(row => row.quantity === 0).length, sourceCells: sourceCells.length, references: rows.length },
    originalEvents, originalInventory: inventory, transfers: list(draftLogistics.selectedTransfers), draftLogistics, physicalHistory, productionMutations: 0 };
}

function createEquipmentTransferReportModel(payload, inventory, options = {}) {
  const model = createEquipmentReportModel(payload, inventory, options);
  return transferReportFromBase(model);
}

function transferReportFromBase(model) {
  const draft = model.draftLogistics;
  const eventsById = new Map(model.events.map(event => [event.id, event]));
  const eventSummary = event => ({ id: event.id, client: event.client || event.name || "", name: event.name || "", place: event.place || "", date: event.date || "", type: event.type || "",
    setupApplies: event.setupApplies, setupAt: event.setupAt || "", startAt: event.startAt || "", endAt: event.endAt || "", equipmentInAt: event.equipmentInAt || "" });
  const routes = [];
  const proposed = list(draft.selectedTransfers);
  const receiptIds = new Set(list(model.physicalHistory?.performed).map(receipt => receipt.id));
  const actual = list(draft.actualTransfers).filter(transfer => !receiptIds.has(transfer.id)).flatMap(transfer => list(transfer.items).map(item => ({ ...transfer, ...item, agendaDecision: true })));
  for (const route of [...proposed, ...actual]) {
    const from = eventsById.get(route.fromEventId), to = eventsById.get(route.toEventId);
    const row = model.rows.find(entry => entry.warehouseInventoryId === route.warehouseInventoryId && entry.itemType !== "consumible" && !entry.external);
    if (!from || !to || !row || row.pending || !(route.quantity > 0)) continue;
    const refs = model.details.filter(line => [from.id, to.id].includes(line.eventId) && line.resolvedInventoryId === row.warehouseInventoryId).map(line => line.sourceRefs).filter(Boolean);
    routes.push({ ...route, source: "warehouse", description: row.description, category: row.category || "Sin categoría", warehouseInventoryId: row.warehouseInventoryId,
      departureAt: route.departureAt || from.endAt, setupAt: route.setupAt || eventReservationStartAt(to), from: eventSummary(from), to: eventSummary(to),
      sourceRefs: [...new Set(refs)].join("; "), provisional: true, requiresConfirmation: !route.agendaDecision });
  }
  const order = (a, b) => text(a.departureAt).localeCompare(text(b.departureAt)) || text(a.fromEventId).localeCompare(text(b.fromEventId))
    || text(a.toEventId).localeCompare(text(b.toEventId)) || text(a.category).localeCompare(text(b.category), "es") || text(a.description).localeCompare(text(b.description), "es");
  routes.sort(order);
  const excluded = model.events.filter(event => planningEventIssue(event) || !text(event.place).trim()).map(event => ({ eventId: event.id,
    event: event.place || event.name || event.id, reason: planningEventIssue(event) || "Falta la ubicación del evento." }));
  const warnings = [...new Set(list(draft.warnings))];
  if (excluded.length) warnings.push("Los eventos con datos de logística pendientes se conservan en el detalle, pero no participan en las propuestas de trasiego.");
  if (!routes.length) warnings.push("No hay trasiegos propios seleccionados y válidos. Abra el listado de Generar trasiego y marque únicamente las rutas que realizará.");
  return { ...model, reportMode: "transfer", disclaimer: TRANSFER_DISCLAIMER, transferRoutes: routes, rentalTransferRoutes: [],
    transferExcludedEvents: excluded, transferWarnings: [...new Set(warnings)], logistics: { routePairs: draft.routePairs, warnings: draft.warnings },
    transferPlanningEventIds: model.events.filter(event => !excluded.some(entry => entry.eventId === event.id)).map(event => event.id), productionMutations: 0 };
}

function planningEventIssue(event) {
  const values = [eventReservationStartAt(event), event.startAt, event.endAt, event.equipmentInAt];
  const times = values.map(localTime);
  if (event.setupApplies === false && text(event.setupAt)) return "El montaje indica que no aplica y conserva una fecha de montaje.";
  if (times.some(time => !Number.isFinite(time))) return "Faltan fechas u horas válidas de montaje o salida, inicio, finalización o regreso a bodega.";
  if (times.some((time, index) => index && time < times[index - 1])) return "Las fechas de montaje, inicio, finalización y regreso a bodega se contradicen.";
  return "";
}

function planningPerformedHandoffs(base, inventory) {
  const state = inventory.state || inventory, receipts = state.equipmentHandoffs;
  const transfers = [], performed = [], reasons = new Map();
  if (receipts === undefined || Array.isArray(receipts) && !receipts.length) return { transfers, performed, reasons, globalReason: "" };
  let custody;
  try { custody = EquipmentHandoffs.getCustodyRecords(state); }
  catch (_) { return { transfers, performed, reasons, globalReason: "Revise el historial de trasiegos y devoluciones. No se calcularon cantidades que podrían contar dos veces el mismo equipo." }; }
  const events = new Map(base.events.map(event => [event.id, event]));
  const stock = new Map(base.stocks.map(item => [item.id, item]));
  const byItem = new Map();
  for (const receipt of receipts) {
    const itemId = text(receipt.itemId);
    if (!byItem.has(itemId)) byItem.set(itemId, []);
    byItem.get(itemId).push(receipt);
  }
  for (const [itemId, itemReceipts] of byItem) {
    const touched = new Set(itemReceipts.flatMap(receipt => [text(receipt.fromEventId), text(receipt.toEventId)]));
    const rowStock = stock.get(itemId);
    let reason = "";
    if (!rowStock || rowStock.itemType === "consumible") reason = "El historial de traslado no corresponde a un equipo reutilizable vigente. Revise su identificación y tipo.";
    else if (itemReceipts.some(receipt => !events.has(text(receipt.fromEventId)) || !events.has(text(receipt.toEventId)))) reason = "Falta un evento del historial de trasiego en esta selección. Incluya todos los eventos vinculados antes de cerrar sus cantidades.";
    else if (itemReceipts.some(receipt => {
      const from = events.get(text(receipt.fromEventId)), to = events.get(text(receipt.toEventId));
      return from.warehouseDispatchId && from.warehouseDispatchId !== text(receipt.fromDocumentId)
        || to.warehouseDispatchId && to.warehouseDispatchId !== text(receipt.toDocumentId);
    })) reason = "Un cuadro del reporte no coincide con la salida o recepción real del trasiego. Revise sus documentos de bodega.";
    else if (base.details.some(line => line.quantity > 0 && line.resolvedInventoryId === itemId && !touched.has(line.eventId))) reason = "Este equipo combina trasiegos ya realizados y otros eventos. Revise sus devoluciones reales antes de asignarlo de nuevo; no se supone que las unidades ya regresaron.";
    else {
      const held = custody.filter(record => text(record.rootMovement.itemId) === itemId).reduce((sum, record) => sum + record.remainingQuantity, 0);
      const physicalPool = Math.max(0, rowStock.registered - rowStock.consumed - rowStock.workshop - rowStock.rented - rowStock.lost);
      if (held > physicalPool) reason = "Los movimientos físicos exceden las existencias vigentes. Revise el historial antes de calcular otra renta o salida.";
    }
    if (reason) { reasons.set(itemId, reason); continue; }
    for (const receipt of itemReceipts) {
      // Zero minutes here is evidence of an ALREADY performed handoff, never
      // a new travel estimate. The allocation engine treats it as a fixed arc.
      transfers.push({ id: receipt.id, status: "confirmed", fromEventId: receipt.fromEventId, toEventId: receipt.toEventId,
        items: [{ warehouseInventoryId: itemId, quantity: Number(receipt.quantity) }], travelMinutes: 0, handlingMinutes: 0 });
      performed.push({ id: receipt.id, itemId, description: rowStock.name, category: rowStock.category, quantity: Number(receipt.quantity),
        from: events.get(text(receipt.fromEventId)), to: events.get(text(receipt.toEventId)), alreadyPerformed: true });
    }
  }
  return { transfers, performed, reasons, globalReason: "" };
}

function createEquipmentPlanningReportModel(payload, inventory, options = {}) {
  const base = createEquipmentReportModel(payload, inventory, options);
  const transfer = transferReportFromBase(base);
  const eventById = new Map(base.events.map(event => [event.id, event]));
  const physicalHistory = base.physicalHistory;
  const scenarioRows = base.rows.map(row => {
    const consumable = row.itemType === "consumible", empty = row.demand === 0;
    const equipmentPurchase = !consumable && (row.procurementChoice === "purchase" || row.preferredPurchase);
    const alreadyPerformed = !physicalHistory.globalReason && !physicalHistory.reasons.has(row.warehouseInventoryId)
      && physicalHistory.performed.some(receipt => receipt.itemId === row.warehouseInventoryId);
    const relatedEvents = list(row.events).map(entry => eventById.get(entry.eventId)).filter(Boolean);
    const routes = transfer.transferRoutes.filter(route => route.warehouseInventoryId === row.warehouseInventoryId);
    const reasons = [...list(row.reasons)];
    if (equipmentPurchase) reasons.push("Este equipo tiene una decisión de compra; no se convirtió en una renta ni en un consumible.");
    if (alreadyPerformed) reasons.push("Estas unidades ya fueron trasladadas físicamente; no se simula deshacer su entrega ni otra salida de bodega.");
    const pending = !empty && Boolean(row.pending || row.shortage === null);
    return { ...row, ownedCapacity: row.capacity, equipmentPurchase, events: relatedEvents,
      requiredWithoutTransfer: consumable ? row.remainingConsumption : alreadyPerformed ? null : row.baselineRequired,
      rentWithoutTransfer: consumable || equipmentPurchase || row.hardBlocked || alreadyPerformed ? null : Math.max(0, row.baselineRequired - row.capacity),
      requiredWithTransfer: row.required, rentWithTransfer: consumable || equipmentPurchase ? null : row.rental,
      purchaseQuantity: consumable ? row.purchase : null,
      withoutTransferAlreadyPerformed: alreadyPerformed, pending, pendingWithoutTransfer: pending, pendingWithTransfer: pending,
      reason: [...new Set(reasons)].join(" "), routes, rentalRoutes: [], requiresRentalSupplierConfirmation: false, requiresTimeConfirmation: false };
  });
  const physicalSummary = scenarioRows.filter(row => row.itemType !== "consumible" && !row.equipmentPurchase).map(row => ({
    id: row.id, warehouseInventoryId: row.warehouseInventoryId, category: row.category, description: row.description,
    totalRequested: row.demand, uniquePhysicalNeeded: row.required,
    ownUnitsPlanned: row.required === null || row.capacity === null ? null : Math.min(row.required, row.capacity),
    rentalUnitsNeeded: row.rental, transferMovements: row.required === null ? null : row.routes.reduce((sum, route) => sum + Number(route.quantity), 0),
    rentalTransferMovements: row.required === null ? null : 0, pending: row.pending, reason: row.reason, eventQuantities: { ...row.eventQuantities }
  }));
  return { ...base, reportMode: "planning", disclaimer: DISCLAIMER,
    scenarioRows, physicalSummary, performedHandoffs: physicalHistory.performed.filter(receipt => !physicalHistory.reasons.has(receipt.itemId) && !physicalHistory.globalReason),
    rentalComparison: scenarioRows.filter(row => row.itemType !== "consumible" && !row.equipmentPurchase),
    consumablePurchases: scenarioRows.filter(row => row.itemType === "consumible"), otherEquipmentPurchases: scenarioRows.filter(row => row.equipmentPurchase),
    transferRoutes: transfer.transferRoutes, rentalTransferRoutes: [], scenarioWarnings: [...new Set([...transfer.transferWarnings, ...scenarioRows.flatMap(row => row.reason ? [row.reason] : [])])],
    scenarioExcludedEvents: transfer.transferExcludedEvents, logistics: transfer.logistics, productionMutations: 0 };
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
    ["Trasiegos seleccionados válidos", list(model.draftLogistics?.selectedTransfers).length], ["Selecciones de trasiego rechazadas", list(model.draftLogistics?.invalidSelections).length],
    ["Importante", "Los consumibles se suman por evento y se descuenta solo su consumo ya registrado. Los reutilizables respetan los horarios indicados, las decisiones vigentes y únicamente los trasiegos seleccionados y válidos. No se suman cantidades de unidades distintas en un total general."],
    ["Datos originales", "Las hojas Celdas fuente, Filas originales y Datos completos conservan la información recibida. Datos completos contiene JSON dividido en partes, sin truncar celdas largas."]
  ];
  addTableSheet(workbook, "Control", ["Concepto", "Detalle"], info, { widths: [42, 110] });
  addTableSheet(workbook, "Eventos", ["ID", "Ubicación", "Nombre", "Tipo", "Fecha", "Montaje", "Inicio", "Finalización", "Regreso a bodega", "Observaciones"], model.events.map(event => [event.id, event.place || "", event.name || "", event.type || "", event.date || "", eventScheduleLabel(event, "setupAt", "PENDIENTE"), eventScheduleLabel(event, "startAt", "PENDIENTE"), eventScheduleLabel(event, "endAt", "PENDIENTE"), eventScheduleLabel(event, "equipmentInAt", "PENDIENTE"), event.notes || ""]));
  const headers = ["Categoría", "Descripción del equipo", "ID físico", ...model.events.map(event => `${event.date || "Sin fecha"}\n${event.place || event.name || event.id}`), "Total solicitado", "Inventario disponible", "Faltante provisional", "Acción", "Observaciones", "Descripciones originales", "Celdas de origen",
    "Consumo ya registrado", "Demanda pendiente", "Unidades físicas sin trasiego", "Cubierto por trasiego seleccionado", "Retención adicional por trasiego", "Capacidad propia para estos eventos"];
  const totalColumn = 4 + model.events.length;
  const consumedColumn = totalColumn + 7, remainingColumn = consumedColumn + 1, baselineColumn = consumedColumn + 2,
    reusedColumn = consumedColumn + 3, additionalColumn = consumedColumn + 4, capacityColumn = consumedColumn + 5;
  addTableSheet(workbook, "Resumen de equipo", headers, model.rows.map((row, index) => {
    const spreadsheetRow = index + 5;
    const sum = `SUM(D${spreadsheetRow}:${columnName(totalColumn - 1)}${spreadsheetRow})`;
    const total = { formula: sum, result: row.demand };
    const reference = column => `${columnName(column)}${spreadsheetRow}`;
    const shortageFormula = row.demand === 0 ? `MAX(0,${reference(totalColumn)})`
      : row.itemType === "consumible" ? `MAX(0,${reference(remainingColumn)}-${reference(capacityColumn)})`
      : `MAX(0,${reference(baselineColumn)}-${reference(reusedColumn)}+${reference(additionalColumn)}-${reference(capacityColumn)})`;
    const shortage = row.shortage === null ? "POR REVISAR" : { formula: shortageFormula, result: row.shortage };
    const delta = row.selectedTransferReduction;
    const notes = row.pendingClassification ? list(row.classificationWarnings).map(warning => warning.message || warning).join(" ")
      : row.pendingIdentification ? "No se supone existencia cero." : list(row.reasons).join(" ") || "Solo se aplican los trasiegos seleccionados y válidos.";
    return [row.category || "Sin categoría", row.description, row.warehouseInventoryId || "PENDIENTE / EXTERNO", ...model.events.map(event => finite(row.eventQuantities?.[event.id])), total, row.available === null ? "POR IDENTIFICAR" : row.available,
      shortage, row.action, notes, row.originalDescriptions, row.sourceRefs,
      row.alreadyConsumed ?? 0, row.remainingDemand ?? Math.max(0, row.demand - (row.alreadyConsumed || 0)), row.baselineRequired ?? "POR REVISAR",
      delta === null || delta === undefined ? "POR REVISAR" : Math.max(0, delta), delta === null || delta === undefined ? "POR REVISAR" : Math.max(0, -delta), row.capacity ?? "POR REVISAR"];
  }), { freezeColumns: 2 });
  const procurementHeaders = ["Categoría", "Descripción", "ID físico", "Total solicitado", "Inventario disponible", "Cantidad provisional", "Acción", "Celdas de origen", "Consumo ya registrado", "Demanda pendiente", "Unidades físicas necesarias", "Capacidad propia para estos eventos", "Trasiegos seleccionados"];
  const procurementValues = rows => rows.map(row => [row.category || "", row.description, row.warehouseInventoryId || "EXTERNO", row.demand, row.available === null ? "NO IDENTIFICADO / EXTERNO" : row.available, row.shortage, row.action, row.sourceRefs,
    row.alreadyConsumed ?? 0, row.remainingDemand ?? row.demand, row.required, row.capacity, list(row.selectedTransferIds).join("; ")]);
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
  const raw = [...model.originalEvents.map((event, index) => ({ kind: "Evento", id: event.id || model.events[index]?.id || "", data: event })),
    { kind: "Inventario activo", id: model.inventorySavedAt, data: model.originalInventory },
    { kind: "Plan validado", id: model.draftLogistics?.snapshotId || "", data: model.draftLogistics }];
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
      return `<section class="route"><h3>${html(route.from.place)} → ${html(route.to.place)}</h3><p>${rental ? "COORDINAR CON PROVEEDOR · No representa equipo propio disponible." : "EQUIPO PROPIO · Selección validada para este plan. Estas mismas unidades ya están consideradas en su cálculo de renta; el reporte no registra otra salida de bodega."}</p><h4>Origen</h4>${schedule(route.from)}<h4>Destino</h4>${schedule(route.to)}${reportTable(["Categoría", "Equipo", "Cantidad a trasladar", "Salida del origen", "Requerido en destino", "Tiempo por revisar", "Celdas de origen"], entries.map(entry => [entry.category, entry.description, entry.quantity, entry.departureAt || "Pendiente", entry.setupAt || "Pendiente", timeLabel(entry), entry.sourceRefs || "Ver archivo original"]))}</section>`;
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
  const titles = { transfer: "Trasiego de equipo", rent: "Renta con y sin trasiego", purchase: "Consumo y compra por evento" };
  const amount = value => value === null || value === undefined ? "Pendiente" : value;
  const eventName = event => event.client || event.name || event.place || event.id;
  const dateOnly = value => {
    const ms = localTime(`${text(value).slice(0, 10)}T12:00`);
    return Number.isFinite(ms) ? new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "long", year: "numeric" }).format(new Date(ms)) : "Por revisar";
  };
  const dateTime = value => {
    const ms = localTime(value);
    return Number.isFinite(ms) ? new Intl.DateTimeFormat("es-GT", { timeZone: "America/Guatemala", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(ms)) : "Por revisar";
  };
  const scheduleLabel = (event, field) => {
    if (field === "setupAt" && event.setupApplies === false) return "No aplica";
    if (event[field]) return dateTime(event[field]);
    const prefix = { setupAt: "setup", startAt: "start", endAt: "end", equipmentInAt: "equipmentIn" }[field];
    const date = event[prefix + "Date"] || (field === "startAt" ? event.date : "");
    const time = event[prefix + "Time"];
    if (date && time && Number.isFinite(localTime(`${date}T${time}`))) return `${dateTime(`${date}T${time}`)} (por confirmar)`;
    return date ? `${dateOnly(date)} · hora pendiente` : "Pendiente";
  };
  const table = (headers, rows, className = "") => `<div class="table-scroll">${reportTable(headers, rows, className)}</div>`;
  const groups = routes => {
    const result = new Map();
    for (const route of routes) {
      const id = JSON.stringify([route.fromEventId, route.toEventId]);
      if (!result.has(id)) result.set(id, []);
      result.get(id).push(route);
    }
    return [...result.values()];
  };
  const ownGroups = groups(model.transferRoutes), rentalGroups = groups(model.rentalTransferRoutes);
  const timingLabel = route => `${route.travelMinutes} min de viaje + ${route.handlingMinutes} min para desmontar y preparar${route.requiresTimeConfirmation ? " (tiempos estimados: revisar)" : " (tiempos indicados)"}.`;
  // Keep the route identity inside THEAD: it repeats when the equipment list
  // crosses a printed page, so its destination can never become ambiguous.
  const routeMarkup = (routeGroups, rental = false) => routeGroups.map(entries => {
    const route = entries[0], from = route.from, to = route.to;
    return `<section class="route"><div class="table-scroll"><table class="route-items"><thead><tr class="route-repeat"><th colspan="3"><h3>${html(eventName(from))} → ${html(eventName(to))}</h3><p>Sale de ${html(from.place)} desde ${html(dateTime(from.endAt))} · Llegar a ${html(to.place)} antes de ${html(dateTime(route.setupAt))}</p><p>${html(timingLabel(route))}${rental ? " Coordinar estas mismas unidades con el proveedor de renta." : " Trasladar las mismas unidades; no solicitar otra salida de bodega por ellas."}</p></th></tr><tr><th>Categoría</th><th>Equipo</th><th>Cantidad a trasladar</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${html(entry.category)}</td><td>${html(entry.description)}</td><td class="number">${html(entry.quantity)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }).join("");
  const pendingRows = model.scenarioRows.filter(row => row.pending);
  const pendingBanner = pendingRows.length ? `<p class="warning"><strong>Falta revisar ${pendingRows.length} equipos o materiales.</strong> Estos datos pueden cambiar las cantidades finales. La lista «Datos por revisar» se incluye al final de este reporte.</p>` : "";
  const pendingSection = pendingRows.length ? `<section class="report-pending"><h2>Datos por revisar (${pendingRows.length})</h2><p>Resuelva estos datos antes de cerrar las cantidades de renta, compra o traslado. Pendiente no significa cero.</p>${table(["Categoría", "Equipo o material", "Solicitado", "Qué falta revisar"], pendingRows.map(row => [row.category, row.description, row.demand, row.reason || "Revise su identificación, clasificación o datos de los eventos."]), "review-table")}</section>` : "";
  const physicalSummary = mode === "purchase" ? "" : `<section class="physical-summary"><h2>Resumen final: equipo físico que se necesita</h2><p>Si las mismas 2 unidades se usan en el evento A y después en el B, se necesitan <strong>2 unidades físicas, no 4</strong>. El traslado no vuelve a descontarlas de bodega. Solo se renta el faltante real; si otro evento necesita más unidades o coincide en horario, ese adicional sí puede generar renta.</p>${table(["Categoría", "Equipo", "Solicitado entre eventos", "Unidades físicas necesarias", "Unidades propias que se usan", "Unidades por rentar"], list(model.physicalSummary).map(row => [row.category, row.description, row.totalRequested, amount(row.uniquePhysicalNeeded), amount(row.ownUnitsPlanned), amount(row.rentalUnitsNeeded)]), "physical-summary-table")}<p>«Propias que se usan» cuenta las unidades una sola vez a lo largo de su recorrido; no es una nueva orden de salida.</p></section>`;
  const overviewRow = (entries, source) => [source, eventName(entries[0].from), eventName(entries[0].to), dateTime(entries[0].from.endAt), dateTime(entries[0].setupAt)];
  const overviewRows = [...ownGroups.map(entries => overviewRow(entries, "Propio")), ...rentalGroups.map(entries => overviewRow(entries, "Del proveedor"))];
  const overview = overviewRows.length ? `<section class="route-overview"><h2>De dónde sale y a dónde va</h2>${table(["Tipo de equipo", "Sale del evento", "Va al evento", "Disponible desde", "Llegar antes de"], overviewRows, "route-overview-table")}</section>` : "";
  const rentalValues = rows => rows.map(row => [row.category, row.description, amount(row.ownedCapacity), row.withoutTransferAlreadyPerformed ? "Ya trasladado" : amount(row.rentWithoutTransfer), amount(row.rentWithTransfer),
    row.rentWithoutTransfer === null || row.rentWithTransfer === null ? "Pendiente" : row.rentWithoutTransfer - row.rentWithTransfer,
    row.events.map(event => `${eventName(event)}: ${row.eventQuantities[event.id] || 0}`).join("; "),
    row.reason || (row.requiresRentalSupplierConfirmation ? "Coordinar la continuidad con el proveedor." : row.requiresTimeConfirmation ? "Revisar tiempos estimados de traslado." : row.routes.length ? "Realizar los trasiegos indicados." : "Cubierto con los horarios indicados.")]);
  let content;
  if (mode === "transfer") {
    content = `<p class="lead">${ownGroups.length} trasiegos propuestos con equipo propio.</p>${pendingBanner}${overview}<h2>Qué equipo llevar en cada trasiego</h2>`
      + (ownGroups.length ? routeMarkup(ownGroups) : '<p>No hay trasiegos propios calculables con los datos actuales. Revise el resumen final y los datos pendientes.</p>')
      + (rentalGroups.length ? `<h2>Traslado de equipo del proveedor</h2><p>Este equipo es rentado y se coordina aparte. No se suma como equipo propio de bodega.</p>${routeMarkup(rentalGroups, true)}` : "")
      + (model.scenarioExcludedEvents.length ? `<h2>Eventos con datos pendientes</h2>${table(["Evento", "Qué falta revisar"], model.scenarioExcludedEvents.map(event => [event.event, event.reason]))}` : "")
      + physicalSummary;
  } else if (mode === "rent") {
    const relevant = model.rentalComparison.filter(row => !row.hardBlocked && row.rentWithTransfer !== null && (row.rentWithoutTransfer > 0 || row.rentWithTransfer > 0));
    const covered = model.rentalComparison.filter(row => !row.pending && !relevant.includes(row));
    const headers = ["Categoría", "Equipo", "Propio disponible para el plan", "Rentar sin trasiego", "Rentar con trasiego", "Renta que se evita", "Uso por evento", "Qué hacer"];
    content = `<p class="lead">Cuánto rentar para los mismos ${model.events.length} eventos.</p><p><strong>Sin trasiego:</strong> el equipo vuelve a bodega y cumple su preparación antes de salir otra vez. <strong>Con trasiego:</strong> las mismas unidades pasan directamente de un evento al siguiente.</p>${pendingBanner}<section class="rental-results"><h2>Equipo por rentar calculado</h2>${!relevant.length ? `<p>${pendingRows.length ? "La renta todavía tiene datos pendientes; no se debe interpretar la tabla vacía como renta cero." : "No hay renta adicional para las referencias calculadas."}</p>` : ""}${table(headers, rentalValues(relevant), "rental-table")}</section>${physicalSummary}${overview}`
      + (ownGroups.length || rentalGroups.length ? `<h2>Trasiegos necesarios para este resultado</h2>${routeMarkup(ownGroups)}${rentalGroups.length ? `<h3>Coordinar con el proveedor de renta</h3>${routeMarkup(rentalGroups, true)}` : ""}` : "")
      + (covered.length ? `<details class="optional-appendix"><summary>Consultar ${covered.length} equipos cubiertos o con cantidad cero</summary>${table(headers, rentalValues(covered), "rental-table")}</details>` : "")
      + (model.otherEquipmentPurchases.length ? `<h2>Equipo con decisión de compra</h2>${table(["Categoría", "Equipo", "Solicitado", "Qué revisar"], model.otherEquipmentPurchases.map(row => [row.category, row.description, row.demand, row.reason]))}` : "");
  } else {
    const headers = ["Categoría", "Consumible", ...model.events.map(eventName), "Consumo total", "Ya consumido", "Falta consumir", "Disponible ahora", "Comprar"];
    const values = model.consumablePurchases.map(row => [row.category, row.description, ...model.events.map(event => row.eventQuantities[event.id] || 0), row.demand, amount(row.alreadyConsumed), amount(row.remainingConsumption), amount(row.available), amount(row.purchaseQuantity)]);
    content = `<p class="lead">Los consumibles se cuentan por cada evento, aunque el equipo se trasiegue.</p><p>Ejemplo: 2 unidades para el evento A y 3 para el B son <strong>5 unidades de consumo</strong>. El trasiego del equipo no reduce ese consumo. Si un consumo ya está registrado en Contabilidad, se muestra aparte y no se compra otra vez.</p>${pendingBanner}<section class="purchase-results"><h2>Consumo por evento y compra necesaria</h2>${!values.length ? `<p>${pendingRows.length ? "Primero deben identificarse o clasificarse los materiales pendientes; una tabla vacía no significa consumo cero." : "No hay consumibles en los eventos incluidos."}</p>` : ""}${table(headers, values, "consumables-table")}</section>`
      + (model.otherEquipmentPurchases.length ? `<h2>Compra de equipo reutilizable</h2><p>Se muestra aparte; no forma parte del consumo por evento.</p>${table(["Categoría", "Equipo", "Solicitado", "Qué revisar"], model.otherEquipmentPurchases.map(row => [row.category, row.description, row.demand, row.reason]))}` : "");
  }
  const eventsTable = table(["Evento", "Fecha", "Lugar", "Montaje", "Inicio", "Termina", "Regresa a bodega"], model.events.map(event => [eventName(event), dateOnly(event.date), event.place || "Pendiente", scheduleLabel(event, "setupAt"), scheduleLabel(event, "startAt"), scheduleLabel(event, "endAt"), scheduleLabel(event, "equipmentInAt")]), "events-table");
  const allSourceDetails = `<details class="source-appendix optional-appendix"><summary>Consultar el archivo original completo</summary><p>${model.counts.equipmentRows} líneas de equipo, ${model.counts.zeroQuantityRows} cantidades en cero y ${model.counts.sourceCells} celdas originales conservadas.</p><h2>Equipos por evento</h2>${table(["Evento", "Fecha original", "Categoría original", "Equipo", "Cantidad", "Observaciones", "Celdas"], model.details.map(row => [row.event, row.date, row.category, row.description, row.quantity, primitive(row.notes), row.sourceRefs]))}<h2>Encabezados, notas y filas originales</h2>${table(["Evento", "Sección", "Tipo", "Cantidad", "Contenido", "Observaciones", "Celdas"], model.preservedRows.map(row => [row.event, row.section, row.type, row.quantity, row.description, primitive(row.notes), row.refs]))}<h2>Celdas originales</h2>${table(["Evento", "Hoja", "Celda", "Valor", "Dato original completo"], model.sourceCells.map(cell => [cell.event, cell.sheet, cell.ref, primitive(cell.value), primitive(cell.cell)]))}</details>`;
  const sourcePending = `<details class="optional-appendix"><summary>Consultar avisos del archivo y sus referencias (${model.pending.length})</summary>${table(["Tipo", "Evento", "Descripción", "Cantidad", "Motivo", "Celdas"], model.pending.map(row => [row.kind, row.event, row.description, row.quantity ?? "", row.reason, row.sourceRefs]), "pending-table")}</details>`;
  const assumptions = model.scenarioWarnings.length ? `<details class="optional-appendix"><summary>Consultar detalles del cálculo y tiempos estimados</summary><ul>${model.scenarioWarnings.map(warning => `<li>${html(warning)}</li>`).join("")}</ul></details>` : "";
  const movementDetail = mode === "purchase" ? "" : `<details class="optional-appendix"><summary>Consultar movimientos entre eventos (no son unidades nuevas de bodega)</summary>${table(["Equipo", "Movimientos de unidades propias entre tramos", "Movimientos de unidades del proveedor"], list(model.physicalSummary).map(row => [row.description, amount(row.transferMovements), amount(row.rentalTransferMovements)]))}<p>Una unidad que pasa de A a B y de B a C aparece en dos movimientos, pero sigue siendo una sola unidad física.</p></details>`;
  const performedSection = list(model.performedHandoffs).length ? `<section class="performed-handoffs"><h2>Equipo que ya fue trasladado</h2><p>Estas entregas ya están registradas. No son nuevas propuestas ni otra salida de bodega. Para ellas, el escenario «sin trasiego» dice «Ya trasladado» porque no se deshace una entrega real.</p>${table(["Categoría", "Equipo", "Cantidad ya entregada", "Salió del evento", "Se recibió en"], model.performedHandoffs.map(receipt => [receipt.category, receipt.description, receipt.quantity, eventName(receipt.from), eventName(receipt.to)]))}</section>` : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${html(titles[mode])} · Live Productions</title><style>
  @page{size:letter landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#172638;font:13px Arial,sans-serif;line-height:1.45}.equipment-pdf-document{max-width:1200px;padding:22px;margin:auto}.brand{font-weight:700;letter-spacing:2px;color:#52647a;font-size:11px}h1{font-size:26px;margin:8px 0}h2{font-size:18px;margin:22px 0 9px}h3{font-size:15px;margin:16px 0 6px}.meta{font-size:12px;color:#52647a}.banner,.warning{padding:12px;border:1px solid #d7bf80;background:#fff9e9;border-radius:7px}.lead{font-size:15px;font-weight:600}.table-scroll{max-width:100%;overflow-x:auto}table{width:100%;border-collapse:collapse;margin:10px 0;table-layout:auto}th,td{padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere;border-bottom:1px solid #d9e2eb}th{background:#18324f;color:#fff}thead{display:table-header-group}.number{text-align:right}tr:nth-child(even) td{background:#f3f6fa}.route{margin:18px 0}.route-repeat th{background:#e7edf4;color:#172638}.route-repeat h3{margin:0}.route-repeat p{margin:5px 0;font-weight:400}.route-items{table-layout:fixed}.route-items th:nth-child(1){width:20%}.route-items th:nth-child(2){width:65%}.route-items th:nth-child(3){width:15%}details{margin:18px 0;padding:12px;border:1px solid #d9e2eb;border-radius:7px}summary{cursor:pointer;font-weight:700}.rental-table{min-width:1100px;table-layout:fixed}.rental-table th:nth-child(1){width:10%}.rental-table th:nth-child(2){width:24%}.rental-table th:nth-child(3){width:10%}.rental-table th:nth-child(4),.rental-table th:nth-child(5),.rental-table th:nth-child(6){width:8%}.rental-table th:nth-child(7){width:17%}.rental-table th:nth-child(8){width:15%}.physical-summary-table{table-layout:fixed;min-width:850px}.physical-summary-table th:nth-child(1){width:12%}.physical-summary-table th:nth-child(2){width:32%}.physical-summary-table th:nth-child(n+3){width:14%}.consumables-table{table-layout:fixed;min-width:1100px}.consumables-table th:first-child{width:10%}.consumables-table th:nth-child(2){width:24%}.review-table{table-layout:fixed}.review-table th:nth-child(2){width:28%}.review-table th:nth-child(4){width:40%}.source-appendix td{font-size:11px}.pending-table{table-layout:fixed}.pending-table th:nth-child(5){width:35%}.pending-table th:nth-child(6){width:20%}
  @media(max-width:600px){.equipment-pdf-document{padding:14px}h1{font-size:23px}.events-table,.route-overview-table{min-width:850px}}@media print{body{font-size:10px}.equipment-pdf-document{padding:0;max-width:none}.table-scroll{overflow:visible}table,.rental-table,.events-table,.physical-summary-table,.consumables-table,.route-overview-table{min-width:0}th,td{padding:4px}tr{break-inside:avoid}h1,h2,h3{break-after:avoid}.route-items thead{display:table-header-group;break-inside:avoid}.route-items tbody tr:first-child{break-before:avoid}.optional-appendix:not([open]){display:none!important}details[open]>summary{display:none}.banner{padding:7px}.meta{font-size:9px}}
  </style></head><body><main class="equipment-pdf-document"><div class="brand">LIVE PRODUCTIONS · REQUERIMIENTO DE EQUIPO</div><h1>${html(titles[mode])}</h1><p class="meta">${model.events.length} eventos · Generado: ${html(displayTimestamp(model.createdAt))} · Inventario consultado: ${html(displayTimestamp(model.inventorySavedAt))}</p><p class="banner">PROPUESTA PROVISIONAL · Plan para organizar el equipo. Revise los horarios y los tiempos de traslado antes de ejecutarlo. Abrir o imprimir este reporte no registra salidas de bodega, rentas ni compras.</p>${performedSection}${content}${pendingSection}<section><h2>Eventos incluidos</h2>${eventsTable}</section>${movementDetail}${assumptions}${sourcePending}${allSourceDetails}</main></body></html>`;
}

module.exports = { createEquipmentReportModel, createEquipmentTransferReportModel, createEquipmentPlanningReportModel, createEquipmentMasterWorkbook, renderEquipmentReportHtml, renderEquipmentTransferReportHtml, renderEquipmentPlanningReportHtml, sourceCellsForEvent, warehouseRows, eventScheduleLabel, DISCLAIMER, TRANSFER_DISCLAIMER };
