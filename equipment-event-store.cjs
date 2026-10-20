"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function invalid(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value) { return String(value ?? "").trim(); }
function key(value) { return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-GT").replace(/\s+/g, " "); }
function validId(value) { return /^[A-Za-z0-9][A-Za-z0-9_-]{0,239}$/.test(String(value ?? "")); }
function quantity(value, label = "La cantidad") {
  if (value === "" || value === null || value === undefined || !["number", "string"].includes(typeof value)) throw invalid(`${label} debe ser un número válido.`);
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw invalid(`${label} debe ser un número mayor o igual a cero.`);
  return result;
}
function stamp(previous, now) { return new Date(Math.max(Number(now), Date.parse(previous || "") + 1 || 0)).toISOString(); }
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((name) => `${JSON.stringify(name)}:${stable(value[name])}`).join(",")}}`;
  return JSON.stringify(value);
}
function eventComparable(event) {
  const candidate = clone(event);
  ["createdAt", "updatedAt", "updatedBy", "cancelledAt", "cancelledBy"].forEach((name) => delete candidate[name]);
  return stable(candidate);
}
function localTime(value) {
  const literal = text(value);
  if (!literal) return NaN;
  // datetime-local values in this application belong to Guatemala (UTC-06).
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(literal) ? `${literal}-06:00` : literal;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(normalized)) return NaN;
  const parsed = Date.parse(normalized);
  const match = literal.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match || Number(match[2]) > 12 || Number(match[3]) > new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate()
      || Number(match[2]) < 1 || Number(match[3]) < 1 || Number(match[4]) > 23 || Number(match[5]) > 59) return NaN;
  return parsed;
}
function eventTiming(event) {
  const setup = localTime(event.setupAt || event.equipmentOutAt);
  const start = localTime(event.startAt);
  const end = localTime(event.endAt);
  const returned = localTime(event.equipmentInAt);
  // Legacy windows already reserve from setup until return. Their missing
  // event start/end never makes their equipment available to another event.
  const complete = [setup, returned].every(Number.isFinite);
  const supplied = [setup, start, end, returned].filter(Number.isFinite);
  if (supplied.some((value, index) => index && value < supplied[index - 1])) throw invalid("Revise las fechas: montaje, inicio, finalización y regreso a bodega deben seguir ese orden.");
  return { setup, start, end, returned, complete };
}
function lineObjects(event) {
  const result = [];
  for (const section of event.sections || []) {
    for (let index = 0; index < (section.items || []).length; index += 1) {
      const raw = section.items[index];
      const line = Array.isArray(raw) ? { quantity: raw[0], description: raw[1] } : raw;
      if (!line || typeof line !== "object") throw invalid("Cada línea de equipo debe incluir cantidad y descripción.");
      if (!text(line.description)) throw invalid("Una línea de equipo no tiene descripción.");
      result.push({ ...line, quantity: quantity(line.quantity), category: line.inventoryCategory || line.category || section.title || "", sectionId: section.id || "", sourceItemIndex: index });
    }
  }
  return result;
}
function normalizeEvent(id, raw) {
  if (!validId(id)) throw invalid("El identificador del evento no es válido.");
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("El evento no es válido.");
  if (raw.id && raw.id !== id) throw invalid("El identificador del evento no coincide.");
  if (!Array.isArray(raw.sections)) throw invalid("El evento debe incluir sus secciones de equipo.");
  const event = clone({ ...raw, id, status: raw.status === "cancelled" ? "cancelled" : "confirmed" });
  if (event.warehouseDispatchId && !validId(event.warehouseDispatchId)) throw invalid("El identificador de salida no es válido.");
  for (const name of ["setupAt", "startAt", "endAt", "equipmentInAt"]) {
    if (text(event[name]) && !Number.isFinite(localTime(event[name]))) throw invalid(`La fecha ${name} no es válida.`);
  }
  for (const section of event.sections) {
    if (!section || !Array.isArray(section.items)) throw invalid("Cada sección debe incluir sus líneas de equipo.");
  }
  lineObjects(event);
  eventTiming(event);
  return event;
}

function effectiveEquipmentProcurementChoice(line, inventory) {
  const choice = ["rent", "purchase", "save"].includes(line?.procurementChoice) ? line.procurementChoice : "";
  if (choice !== "save") return choice;
  const state = inventory?.state || inventory || {};
  const itemId = text(line?.warehouseInventoryId);
  if (!itemId || !(state.items || []).some((item) => !item.archived && String(item.id) === itemId)) return choice;
  const receipts = Array.isArray(state.equipmentStockReceipts) ? state.equipmentStockReceipts : [];
  for (const claimed of Array.isArray(line.inventoryIngressReceipts) ? line.inventoryIngressReceipts : []) {
    if (!Number.isInteger(claimed?.index) || claimed.index < 0 || String(claimed.itemId || "") !== itemId) continue;
    const stored = receipts.find((receipt) => text(receipt.requestId) === text(claimed.requestId));
    const received = stored?.items?.[claimed.index];
    if (received && String(received.itemId) === itemId && Number.isFinite(Number(received.quantity))
        && Number(received.quantity) >= 0 && Number(received.quantity) === Number(claimed.quantity)) return "";
  }
  return choice;
}

function resolveEquipmentPurchasedLine(event, line, inventory) {
  if (line?.procurementChoice !== "purchase" || !text(event?.id) || !text(line?.id)) return line;
  const state = inventory?.state || inventory || {};
  const matches = (state.items || []).filter((item) => !item.archived && text(item.id) && Array.isArray(item.equipmentPurchaseLinks)
    && item.equipmentPurchaseLinks.some((link) => text(link?.requestId) && Number.isFinite(Number(link.receivedQuantity)) && Number(link.receivedQuantity) > 0
      && text(link.eventId) === event.id && text(link.itemId) === line.id && key(link.description) === key(line.description)));
  if (matches.length !== 1) return line;
  const item = matches[0];
  return { ...line, warehouseInventoryId: String(item.id), procurementChoice: "", procurementPreference: "purchase", inventoryCategory: item.category || line.inventoryCategory || line.category,
    itemType: item.itemType === "consumible" || /(?:^|\s)\/?\s*consumible$/i.test(item.name || "") ? "consumible" : "equipo" };
}

function eventItemQuantity(event, id, inventory) {
  const items = (inventory?.state || inventory || {}).items || [];
  return lineObjects(event).map((line) => resolveEquipmentPurchasedLine(event, line, inventory)).filter((line) => {
    if (effectiveEquipmentProcurementChoice(line, inventory)) return false;
    if (line.warehouseInventoryId) return String(line.warehouseInventoryId) === id;
    const matches = items.filter((item) => !item.archived && [item.name, item.sourceKey, ...(Array.isArray(item.descriptionAliases) ? item.descriptionAliases : [])].some((name) => key(name) === key(line.description)));
    return matches.length === 1 && String(matches[0].id) === id;
  }).reduce((sum, line) => sum + line.quantity, 0);
}
function validateTransfer(transfer, events, inventory, others = []) {
  if (transfer.fromEventId === transfer.toEventId) throw invalid("El trasiego debe enlazar dos eventos diferentes.");
  const from = events.find((event) => event.id === transfer.fromEventId && event.status !== "cancelled");
  const to = events.find((event) => event.id === transfer.toEventId && event.status !== "cancelled");
  if (!from || !to) throw invalid("Los dos eventos deben estar guardados antes de confirmar el trasiego.");
  const pending = [transfer.toEventId]; const visited = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (id === transfer.fromEventId) throw invalid("El trasiego no puede crear un ciclo entre eventos.", 409);
    if (visited.has(id)) continue;
    visited.add(id);
    others.filter((entry) => entry.id !== transfer.id && entry.status !== "cancelled" && entry.fromEventId === id).forEach((entry) => pending.push(entry.toEventId));
  }
  const endAt = localTime(from.endAt || from.equipmentInAt);
  const setupAt = localTime(to.setupAt || to.equipmentOutAt);
  if (!eventTiming(from).complete || !eventTiming(to).complete || !Number.isFinite(endAt) || !Number.isFinite(setupAt) || endAt + (transfer.travelMinutes + transfer.handlingMinutes) * 60000 > setupAt) {
    throw invalid("El trasiego no tiene tiempo suficiente para desmontaje, transporte y preparación antes del siguiente montaje.");
  }
  const items = (inventory?.state || inventory || {}).items || [];
  for (const line of transfer.items) {
    const id = line.warehouseInventoryId;
    const item = items.find((entry) => String(entry.id) === id && !entry.archived);
    if (!item || item.itemType === "consumible" || /(?:^|\s)\/?\s*consumible$/i.test(item.name || "")) throw invalid("El trasiego requiere un equipo vigente no consumible del inventario.");
    const sourceQuantity = eventItemQuantity(from, id, inventory);
    const destinationQuantity = eventItemQuantity(to, id, inventory);
    let outgoing = line.quantity; let incoming = line.quantity;
    for (const other of others) {
      if (other.id === transfer.id || other.status === "cancelled") continue;
      const amount = other.items.filter((entry) => entry.warehouseInventoryId === id).reduce((sum, entry) => sum + entry.quantity, 0);
      if (other.fromEventId === from.id) outgoing += amount;
      if (other.toEventId === to.id) incoming += amount;
    }
    if (outgoing > sourceQuantity || incoming > destinationQuantity) throw invalid("La cantidad de trasiego supera el equipo del evento o ya está asignada a otra ruta.", 409);
  }
  return { from, to, endAt, setupAt };
}

function normalizeTransfer(id, raw) {
  if (!validId(id) || !raw || !validId(raw.fromEventId) || !validId(raw.toEventId)) throw invalid("Los identificadores de la ruta no son válidos.");
  if (!Array.isArray(raw.items) || !raw.items.length) throw invalid("Seleccione el equipo y las cantidades del trasiego.");
  const seen = new Set();
  const items = raw.items.map((line) => {
    const warehouseInventoryId = text(line?.warehouseInventoryId);
    if (!warehouseInventoryId || seen.has(warehouseInventoryId)) throw invalid("Cada equipo del trasiego debe tener un identificador único de inventario.");
    seen.add(warehouseInventoryId);
    const amount = quantity(line.quantity);
    if (amount <= 0) throw invalid("La cantidad de trasiego debe ser mayor a cero.");
    return { warehouseInventoryId, quantity: amount };
  });
  return { id, fromEventId: raw.fromEventId, toEventId: raw.toEventId, items,
    travelMinutes: quantity(raw.travelMinutes, "El tiempo de transporte"),
    handlingMinutes: quantity(raw.handlingMinutes ?? 120, "El tiempo de desmontaje y preparación"), status: "confirmed" };
}

function createEquipmentEventStore({ directory, now = Date.now } = {}) {
  if (!directory) throw new Error("Falta el directorio privado del programa.");
  const privateDir = path.join(directory, ".equipment-private");
  const filePath = path.join(privateDir, "eventos-y-extras.json");
  function read() {
    let raw;
    try { raw = fs.readFileSync(filePath, "utf8"); }
    catch (error) { if (error.code === "ENOENT") return { version: 1, revision: 0, events: [], extras: [], transfers: [], audit: [] }; throw error; }
    const state = JSON.parse(raw);
    if (state.version !== 1 || !Number.isSafeInteger(state.revision) || !Array.isArray(state.events) || !Array.isArray(state.extras) || !Array.isArray(state.audit)) {
      throw invalid("El registro privado de eventos no se puede leer. No se cargó otra fuente.", 503);
    }
    if (state.transfers === undefined) state.transfers = [];
    if (!Array.isArray(state.transfers)) throw invalid("El registro privado de trasiegos no se puede leer.", 503);
    return state;
  }
  function write(state) {
    fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
    const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`;
    try { fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 }); fs.renameSync(temporary, filePath); }
    finally { try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; } }
  }
  function audit(state, action, entity, actor) {
    state.revision += 1;
    state.audit.push({ id: crypto.randomUUID(), revision: state.revision, action, entityId: entity.id, timestamp: entity.updatedAt, actor: text(actor) });
    write(state);
  }
  function extraView(state, item) { return { ...(item ? { item: clone(item) } : {}), items: clone(state.extras.filter((entry) => !entry.archived)), revision: state.revision }; }
  function eventView(state, event) { return { ...(event ? { event: clone(event) } : {}), events: clone(state.events.filter((entry) => entry.status !== "cancelled")), transfers: clone(state.transfers.filter((entry) => entry.status !== "cancelled")), revision: state.revision }; }
  function transferView(state, transfer) { return { ...(transfer ? { transfer: clone(transfer) } : {}), transfers: clone(state.transfers.filter((entry) => entry.status !== "cancelled")), revision: state.revision }; }
  function checkRevision(state, payload) {
    if (payload.revision !== undefined && payload.revision !== state.revision) throw invalid("El registro cambió en otra pestaña o equipo. Actualice la lista antes de guardar.", 409);
  }
  return {
    readExtras() { return extraView(read()); },
    readEvents() { return eventView(read()); },
    readTransfers() { return transferView(read()); },
    previewEvent(raw) {
      const state = read(); const id = raw?.id || `preview-${crypto.randomUUID()}`;
      const event = normalizeEvent(id, raw);
      if (event.warehouseDispatchId && state.events.some((entry) => entry.id !== id && entry.status !== "cancelled" && entry.warehouseDispatchId === event.warehouseDispatchId)) throw invalid("Esa salida de bodega ya está enlazada a otro evento.", 409);
      const current = eventView(state);
      return { ...current, event, events: [...current.events.filter((entry) => entry.id !== id), event] };
    },
    addExtra(payload = {}, actor = "") {
      const state = read();
      if (!text(payload.description)) throw invalid("Escriba la descripción del extra.");
      const values = { description: String(payload.description), category: String(payload.category ?? ""),
        defaultQuantity: quantity(payload.defaultQuantity ?? 1), warehouseInventoryId: text(payload.warehouseInventoryId),
        itemType: payload.itemType === "consumible" ? "consumible" : "equipo" };
      const requestId = text(payload.requestId);
      const duplicateRequest = requestId && state.extras.find((entry) => entry.requestId === requestId);
      if (duplicateRequest) {
        if (stable(values) !== stable(Object.fromEntries(Object.keys(values).map((name) => [name, duplicateRequest[name]])))) throw invalid("Ese intento ya guardó un extra diferente.", 409);
        if (duplicateRequest.archived) throw invalid("El extra guardado por ese intento fue retirado. Cree uno nuevo.", 409);
        return extraView(state, duplicateRequest);
      }
      const duplicate = state.extras.find((entry) => !entry.archived && key(entry.description) === key(values.description) && key(entry.category) === key(values.category) && entry.warehouseInventoryId === values.warehouseInventoryId);
      if (duplicate) return extraView(state, duplicate);
      checkRevision(state, payload);
      const timestamp = stamp(state.audit.at(-1)?.timestamp, now());
      const item = { id: `extra-${crypto.randomUUID()}`, ...values, archived: false, createdAt: timestamp, updatedAt: timestamp, ...(requestId ? { requestId } : {}) };
      state.extras.push(item); audit(state, "crear-extra", item, actor); return extraView(state, item);
    },
    archiveExtra(id, payload = {}, actor = "") {
      const state = read();
      const item = state.extras.find((entry) => entry.id === id);
      if (!item) throw invalid("El extra ya no existe.", 404);
      if (item.archived) return extraView(state, item);
      checkRevision(state, payload);
      if (payload.expectedUpdatedAt !== undefined && payload.expectedUpdatedAt !== item.updatedAt) throw invalid("El extra cambió. Actualice la lista antes de retirarlo.", 409);
      Object.assign(item, { archived: true, archivedAt: stamp(item.updatedAt, now()) }); item.updatedAt = item.archivedAt;
      audit(state, "retirar-extra", item, actor); return extraView(state, item);
    },
    putEvent(id, payload = {}, actor = "", inventory) {
      const state = read();
      const event = normalizeEvent(id, payload.event);
      const current = state.events.find((entry) => entry.id === id);
      if (current && eventComparable(current) === eventComparable(event)) return eventView(state, current);
      if (current && current.status === "cancelled") throw invalid("Este evento fue cancelado. Cree una nueva ventana para volver a reservar.", 409);
      if (current && !text(payload.expectedUpdatedAt)) throw invalid("Consulte la versión actual del evento antes de guardar cambios.", 428);
      if (current && payload.expectedUpdatedAt !== current.updatedAt) throw invalid("El evento cambió en otra pestaña o equipo. Conserve su cuadro y vuelva a cargar la versión actual.", 409);
      if (!current && text(payload.expectedUpdatedAt)) throw invalid("El evento que intenta editar ya no está disponible.", 409);
      if (event.warehouseDispatchId && state.events.some((entry) => entry.id !== id && entry.status !== "cancelled" && entry.warehouseDispatchId === event.warehouseDispatchId)) throw invalid("Esa salida de bodega ya está enlazada a otro evento.", 409);
      const linkedTransfers = state.transfers.filter((entry) => entry.status !== "cancelled" && (entry.fromEventId === id || entry.toEventId === id));
      if (linkedTransfers.length) {
        if (!inventory) throw invalid("Actualice el inventario antes de modificar un evento con trasiegos confirmados.", 409);
        const proposedEvents = [...state.events.filter((entry) => entry.id !== id), event];
        for (const transfer of linkedTransfers) {
          try { validateTransfer(transfer, proposedEvents, inventory, state.transfers); }
          catch (error) { throw invalid(`El cambio afecta un trasiego confirmado. Cancele o ajuste esa ruta primero. ${error.message}`, 409); }
        }
      }
      const timestamp = stamp(state.audit.at(-1)?.timestamp, now());
      Object.assign(event, { createdAt: current?.createdAt || timestamp, updatedAt: timestamp, updatedBy: text(actor) });
      if (current) state.events[state.events.indexOf(current)] = event; else state.events.push(event);
      audit(state, current ? "editar-evento" : "reservar-evento", event, actor); return eventView(state, event);
    },
    cancelEvent(id, payload = {}, actor = "") {
      const state = read();
      const event = state.events.find((entry) => entry.id === id);
      if (!event) throw invalid("El evento ya no existe.", 404);
      if (event.status === "cancelled") return eventView(state, event);
      if (!text(payload.expectedUpdatedAt)) throw invalid("Consulte la versión actual del evento antes de cancelarlo.", 428);
      if (payload.expectedUpdatedAt !== event.updatedAt) throw invalid("El evento cambió en otra pestaña o equipo. Actualice antes de cancelarlo.", 409);
      Object.assign(event, { status: "cancelled", cancelledAt: stamp(event.updatedAt, now()), cancelledBy: text(actor) }); event.updatedAt = event.cancelledAt;
      state.transfers.filter((entry) => entry.status !== "cancelled" && (entry.fromEventId === id || entry.toEventId === id)).forEach((transfer) => {
        Object.assign(transfer, { status: "cancelled", updatedAt: event.updatedAt, cancelledAt: event.updatedAt, cancelledBy: text(actor) });
      });
      audit(state, "cancelar-evento", event, actor); return eventView(state, event);
    },
    putTransfer(id, payload = {}, actor = "", inventory) {
      const state = read(); const transfer = normalizeTransfer(id, payload.transfer || payload);
      const current = state.transfers.find((entry) => entry.id === id);
      if (current && eventComparable(current) === eventComparable(transfer)) return transferView(state, current);
      if (current?.status === "cancelled") throw invalid("El trasiego fue cancelado. Cree una nueva ruta.", 409);
      if (current && !text(payload.expectedUpdatedAt)) throw invalid("Consulte la versión actual del trasiego antes de guardar.", 428);
      if (current && current.updatedAt !== payload.expectedUpdatedAt) throw invalid("El trasiego cambió en otro equipo. Actualice la lista antes de guardar.", 409);
      validateTransfer(transfer, state.events, inventory, state.transfers);
      const timestamp = stamp(state.audit.at(-1)?.timestamp, now());
      Object.assign(transfer, { createdAt: current?.createdAt || timestamp, updatedAt: timestamp, updatedBy: text(actor) });
      if (current) state.transfers[state.transfers.indexOf(current)] = transfer; else state.transfers.push(transfer);
      audit(state, current ? "editar-trasiego" : "confirmar-trasiego", transfer, actor); return transferView(state, transfer);
    },
    cancelTransfer(id, payload = {}, actor = "") {
      const state = read(); const transfer = state.transfers.find((entry) => entry.id === id);
      if (!transfer) throw invalid("El trasiego ya no existe.", 404);
      if (transfer.status === "cancelled") return transferView(state, transfer);
      if (!text(payload.expectedUpdatedAt)) throw invalid("Consulte la versión actual del trasiego antes de cancelar.", 428);
      if (transfer.updatedAt !== payload.expectedUpdatedAt) throw invalid("El trasiego cambió en otro equipo. Actualice la lista antes de cancelar.", 409);
      Object.assign(transfer, { status: "cancelled", cancelledAt: stamp(transfer.updatedAt, now()), cancelledBy: text(actor) }); transfer.updatedAt = transfer.cancelledAt;
      audit(state, "cancelar-trasiego", transfer, actor); return transferView(state, transfer);
    }
  };
}

function calculateEquipmentAvailability(events, inventory, options = {}) {
  const state = inventory?.state || inventory || {};
  const now = Number(options.now ?? Date.now());
  const from = options.from ? localTime(`${options.from}T00:00`) : -Infinity;
  const to = options.to ? localTime(`${options.to}T23:59:59.999`) : Infinity;
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) throw invalid("El período de disponibilidad no es válido.");
  const activeEvents = (events || []).filter((event) => event.status !== "cancelled");
  const inventoryById = new Map((state.items || []).filter((item) => item && !item.archived).map((item) => [String(item.id), item]));
  const nameIndex = new Map();
  for (const item of inventoryById.values()) {
    for (const name of new Set([item.name, item.sourceKey, ...(Array.isArray(item.descriptionAliases) ? item.descriptionAliases : [])].map(key).filter(Boolean))) {
      if (!nameIndex.has(name)) nameIndex.set(name, []);
      nameIndex.get(name).push(item);
    }
  }
  const movements = state.movements || [];
  const stock = new Map();
  for (const item of inventoryById.values()) {
    const buckets = { out: 0, consumed: 0, workshop: 0, rented: 0, lost: 0 };
    const changes = { salida: ["out", 1], ingreso_evento: ["out", -1], consumo: ["consumed", 1], taller: ["workshop", 1], danado: ["workshop", 1], devolucion_taller: ["workshop", -1], renta: ["rented", 1], devolucion_renta: ["rented", -1], perdido: ["lost", 1], recuperado: ["lost", -1] };
    for (const movement of movements) {
      if (String(movement.itemId) !== String(item.id) || movement.sourceUnmatched || movement.procurementChoice) continue;
      const change = changes[movement.type];
      if (change) buckets[change[0]] += change[1] * Math.max(0, Number(movement.quantity) || 0);
    }
    stock.set(String(item.id), {
      available: Math.max(0, (Number(item.quantity) || 0) - Object.values(buckets).reduce((sum, amount) => sum + Math.max(0, amount), 0)),
      maximum: Math.max(0, (Number(item.quantity) || 0) - [buckets.consumed, buckets.workshop, buckets.rented, buckets.lost].reduce((sum, amount) => sum + Math.max(0, amount), 0)),
      credited: 0
    });
  }
  const rows = new Map();
  const visibleEvents = [];
  const confirmedTransfers = [];
  const invalidTransfers = [];
  for (const transfer of options.transfers || []) {
    if (transfer.status === "cancelled") continue;
    try { validateTransfer(transfer, activeEvents, inventory, options.transfers); confirmedTransfers.push(transfer); }
    catch (error) { invalidTransfers.push({ id: transfer.id, message: error.message }); }
  }
  const physicalHolds = new Map();
  function tracePhysicalHandoff(eventId, itemId, amount, routeIds = []) {
    let remaining = amount;
    const outgoing = confirmedTransfers.filter((transfer) => transfer.fromEventId === eventId && transfer.items.some((line) => line.warehouseInventoryId === itemId));
    for (const transfer of outgoing) {
      const taken = Math.min(remaining, transfer.items.find((line) => line.warehouseInventoryId === itemId).quantity);
      if (taken > 0) tracePhysicalHandoff(transfer.toEventId, itemId, taken, [...routeIds, transfer.id]);
      remaining -= taken;
    }
    if (remaining <= 0 || !routeIds.length) return;
    const event = activeEvents.find((entry) => entry.id === eventId);
    const availableAt = localTime(event.equipmentInAt) + Math.max(120, Number(event.preparationMinutes) || 120) * 60000;
    if (Number.isFinite(availableAt) && availableAt < now) {
      if (!physicalHolds.has(itemId)) physicalHolds.set(itemId, []);
      physicalHolds.get(itemId).push({ event, quantity: remaining, start: availableAt, routeIds });
    }
  }
  for (const event of activeEvents) {
    const sent = new Map();
    for (const movement of movements) {
      if (movement.sourceUnmatched || movement.procurementChoice || !["salida", "ingreso_evento"].includes(movement.type)) continue;
      if (event.warehouseDispatchId ? String(movement.sourceDocumentId || "") !== event.warehouseDispatchId : String(movement.sourceEventId || "") !== event.id) continue;
      const id = String(movement.itemId || "");
      sent.set(id, (sent.get(id) || 0) + (movement.type === "salida" ? 1 : -1) * Math.max(0, Number(movement.quantity) || 0));
    }
    for (const [id, amount] of sent) if (amount > 0 && inventoryById.has(id)) tracePhysicalHandoff(event.id, id, amount);
  }
  for (const event of activeEvents) {
    const timing = eventTiming(event);
    const preparationMinutes = Math.max(120, Number(event.preparationMinutes) || 120);
    const visible = !timing.complete || timing.setup <= to && timing.returned + preparationMinutes * 60000 >= from;
    if (visible) visibleEvents.push({ ...event, pendingLogistics: !timing.complete });
    const matchedMovements = movements.filter((movement) => !movement.sourceUnmatched && !movement.procurementChoice && (event.warehouseDispatchId
      ? String(movement.sourceDocumentId || "") === event.warehouseDispatchId
      : String(movement.sourceEventId || "") === event.id));
    const dispatch = new Map();
    for (const movement of matchedMovements) {
      const id = String(movement.itemId || "");
      if (!inventoryById.has(id)) continue;
      if (!dispatch.has(id)) dispatch.set(id, { out: 0, consumed: 0, firstOut: Infinity });
      const entry = dispatch.get(id);
      const amount = Math.max(0, Number(movement.quantity) || 0);
      if (movement.type === "salida") { entry.out += amount; const at = localTime(movement.dateTime || (movement.date ? `${movement.date}T00:00` : "")); if (Number.isFinite(at)) entry.firstOut = Math.min(entry.firstOut, at); }
      if (movement.type === "ingreso_evento") entry.out -= amount;
      if (movement.type === "consumo") entry.consumed += amount;
    }
    const eventLines = new Map();
    for (const rawLine of lineObjects(event)) {
      const line = resolveEquipmentPurchasedLine(event, rawLine, inventory);
      const explicit = effectiveEquipmentProcurementChoice(line, inventory);
      const byName = nameIndex.get(key(line.description)) || [];
      const item = !explicit && (line.warehouseInventoryId ? inventoryById.get(String(line.warehouseInventoryId)) : byName.length === 1 ? byName[0] : null);
      const id = item ? String(item.id) : "";
      const consumable = item ? item.itemType === "consumible" || /(?:^|\s)\/?\s*consumible$/i.test(item.name || "") : line.itemType === "consumible" || line.consumable === true;
      const rowKey = id || `external:${explicit || "pending"}:${consumable ? "consumible" : "equipo"}:${key(line.category)}:${key(line.description)}`;
      if (!rows.has(rowKey)) rows.set(rowKey, { id: rowKey, warehouseInventoryId: id, description: item?.name || line.description, category: item?.category || line.category,
        itemType: consumable ? "consumible" : "equipo", available: id ? stock.get(id).available : 0,
        required: 0, quantity: 0, missing: 0, action: "DISPONIBLE", external: !id, procurementChoice: explicit,
        pendingIdentification: !id && !explicit, eventQuantities: {}, events: [], reservations: [], transfers: [], intervals: [] });
      const row = rows.get(rowKey);
      if (line.procurementPreference === "purchase" && explicit !== "rent" && explicit !== "save") row.preferredPurchase = true;
      if (!eventLines.has(rowKey)) eventLines.set(rowKey, { row, quantity: 0, id, consumable });
      eventLines.get(rowKey).quantity += line.quantity;
    }
    for (const { row, quantity: amount, id, consumable } of eventLines.values()) {
      const sent = dispatch.get(id) || { out: 0, consumed: 0, firstOut: Infinity };
      const outstanding = Math.max(0, sent.out);
      // A sent reusable unit belongs to this reservation already. Add it back
      // to capacity once, then block its complete physical-out interval.
      if (id && !consumable && outstanding) stock.get(id).credited += outstanding;
      let occupiedStart = timing.setup;
      let occupiedEnd = timing.returned + (consumable ? 0 : preparationMinutes * 60000);
      let reserved = consumable ? Math.max(0, amount - sent.consumed) : Math.max(amount, outstanding);
      if (consumable && timing.complete && timing.setup < from && timing.returned < from && !row.external) {
        row.reservedBeforePeriod = (row.reservedBeforePeriod || 0) + reserved;
      }
      if (outstanding && !consumable) {
        occupiedStart = Math.min(Number.isFinite(occupiedStart) ? occupiedStart : now, Number.isFinite(sent.firstOut) ? sent.firstOut : now);
        if (!Number.isFinite(occupiedEnd) || occupiedEnd < now) occupiedEnd = Infinity;
      }
      const outgoing = !consumable && id ? confirmedTransfers.filter((transfer) => transfer.fromEventId === event.id).flatMap((transfer) => transfer.items
        .filter((line) => line.warehouseInventoryId === id).map((line) => ({ quantity: line.quantity,
          end: localTime(activeEvents.find((entry) => entry.id === transfer.toEventId)?.setupAt || activeEvents.find((entry) => entry.id === transfer.toEventId)?.equipmentOutAt) }))) : [];
      const chunks = [{ quantity: Math.max(0, reserved - outgoing.reduce((sum, line) => sum + line.quantity, 0)), end: occupiedEnd }, ...outgoing];
      const intersects = Number.isFinite(occupiedStart) && occupiedStart <= to && chunks.some((chunk) => chunk.end >= from);
      if (!visible && !intersects) continue;
      row.quantity += amount;
      row.eventQuantities[event.id] = (Object.hasOwn(row.eventQuantities, event.id) ? row.eventQuantities[event.id] : 0) + amount;
      const reservation = { eventId: event.id, name: event.name || "Evento", place: event.place || "", type: event.type || "", quantity: amount,
        remainingQuantity: reserved, setupAt: event.setupAt || "", startAt: event.startAt || "", endAt: event.endAt || "", equipmentInAt: event.equipmentInAt || "",
        notes: event.notes || "", pendingLogistics: !timing.complete, alreadyDispatched: outstanding, alreadyConsumed: sent.consumed,
        preparationMinutes: consumable ? 0 : preparationMinutes,
        logisticsMinutes: Math.max(60, Number(event.logisticsMinutes || event.transferMinutes) || 60) };
      row.events.push(reservation); row.reservations.push(reservation);
      if (!timing.complete && !outstanding) { row.pendingLogistics = true; continue; }
      if (intersects) for (const chunk of chunks) {
        if (chunk.end >= from) row.intervals.push({ start: Math.max(occupiedStart, from), end: Math.min(chunk.end, to), quantity: chunk.quantity, reservation });
      }
    }
  }
  for (const row of rows.values()) {
    for (const hold of physicalHolds.get(row.warehouseInventoryId) || []) {
      if (hold.start > to) continue;
      let reservation = row.events.find((entry) => entry.eventId === hold.event.id);
      if (!reservation) {
        const amount = eventItemQuantity(hold.event, row.warehouseInventoryId, inventory);
        reservation = { eventId: hold.event.id, name: hold.event.name || "Evento", place: hold.event.place || "", quantity: amount,
          setupAt: hold.event.setupAt || "", startAt: hold.event.startAt || "", endAt: hold.event.endAt || "", equipmentInAt: hold.event.equipmentInAt || "",
          alreadyDispatched: hold.quantity, pendingLogistics: false };
        row.events.push(reservation); row.reservations.push(reservation); row.quantity += amount; row.eventQuantities[hold.event.id] = amount;
      }
      reservation.awaitingPhysicalReturn = true;
      row.intervals.push({ start: Math.max(hold.start, from), end: to, quantity: hold.quantity, reservation });
    }
    const stockEntry = row.warehouseInventoryId ? stock.get(row.warehouseInventoryId) : null;
    const capacity = stockEntry ? Math.max(0, Math.min(stockEntry.maximum, stockEntry.available + stockEntry.credited) - (row.reservedBeforePeriod || 0)) : 0;
    row.capacity = capacity;
    if (row.itemType === "consumible" || row.procurementChoice === "purchase") row.required = row.intervals.reduce((sum, entry) => sum + entry.quantity, 0);
    else {
      const points = row.intervals.flatMap((entry) => [{ at: entry.start, change: entry.quantity, end: false }, { at: entry.end, change: -entry.quantity, end: true }]);
      row.confirmedTransfers = confirmedTransfers.filter((transfer) => {
        if (!transfer.items.some((line) => line.warehouseInventoryId === row.warehouseInventoryId)) return false;
        if ((physicalHolds.get(row.warehouseInventoryId) || []).some((hold) => hold.routeIds.includes(transfer.id) && hold.start <= to)) return true;
        const source = activeEvents.find((entry) => entry.id === transfer.fromEventId); const destination = activeEvents.find((entry) => entry.id === transfer.toEventId);
        return localTime(source.setupAt || source.equipmentOutAt) <= to && localTime(destination.equipmentInAt) + Math.max(120, Number(destination.preparationMinutes) || 120) * 60000 >= from;
      });
      points.sort((left, right) => left.at - right.at);
      let current = 0;
      for (let index = 0; index < points.length;) {
        const at = points[index].at; let change = 0;
        while (index < points.length && points[index].at === at) { change += points[index].change; index += 1; }
        current += change; row.required = Math.max(row.required, current);
      }
    }
    row.missing = Math.max(0, row.required - capacity);
    const ordered = row.reservations.filter((reservation) => reservation.quantity > 0 && !reservation.pendingLogistics)
      .map((reservation) => ({ start: localTime(reservation.setupAt), quantity: reservation.quantity, reservation })).sort((a, b) => a.start - b.start);
    if (!row.external && row.itemType !== "consumible") {
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1]; const next = ordered[index];
        const handlingMinutes = 120;
        const travelMinutes = Math.max(0, Number(options.travelMinutes ?? 60));
        const departure = localTime(previous.reservation.endAt || previous.reservation.equipmentInAt);
        const margin = handlingMinutes + travelMinutes;
        const outgoingQuantity = confirmedTransfers.filter((transfer) => transfer.fromEventId === previous.reservation.eventId).flatMap((transfer) => transfer.items).filter((line) => line.warehouseInventoryId === row.warehouseInventoryId).reduce((sum, line) => sum + line.quantity, 0);
        const incomingQuantity = confirmedTransfers.filter((transfer) => transfer.toEventId === next.reservation.eventId).flatMap((transfer) => transfer.items).filter((line) => line.warehouseInventoryId === row.warehouseInventoryId).reduce((sum, line) => sum + line.quantity, 0);
        const candidateQuantity = Math.min(Math.max(0, previous.quantity - outgoingQuantity), Math.max(0, next.quantity - incomingQuantity), capacity);
        if (Number.isFinite(departure) && next.start - departure >= margin * 60000
            && candidateQuantity > 0
            && !confirmedTransfers.some((transfer) => transfer.fromEventId === previous.reservation.eventId && transfer.toEventId === next.reservation.eventId && transfer.items.some((line) => line.warehouseInventoryId === row.warehouseInventoryId))) row.transfers.push({
          fromEventId: previous.reservation.eventId, toEventId: next.reservation.eventId,
          fromName: previous.reservation.name, toName: next.reservation.name, fromEventName: previous.reservation.name, toEventName: next.reservation.name,
          fromPlace: previous.reservation.place, toPlace: next.reservation.place,
          quantity: candidateQuantity, availableMinutes: (next.start - departure) / 60000,
          requiredMinutes: margin, travelMinutes, handlingMinutes, requiresConfirmation: true
        });
      }
    }
    row.action = row.procurementChoice === "save" ? "PENDIENTE" : row.missing > 0 ? row.itemType === "consumible" || row.procurementChoice === "purchase" || row.preferredPurchase ? "COMPRA" : "RENTA" : row.pendingLogistics ? "PENDIENTE" : row.confirmedTransfers?.length ? "TRASIEGO" : "DISPONIBLE";
    delete row.intervals;
  }
  return { rows: [...rows.values()].filter((row) => row.events.length), events: visibleEvents, transfers: confirmedTransfers, invalidTransfers, inventorySavedAt: inventory?.savedAt || "", from: options.from || "", to: options.to || "" };
}

module.exports = { createEquipmentEventStore, calculateEquipmentAvailability, normalizeEvent, effectiveEquipmentProcurementChoice, resolveEquipmentPurchasedLine, localTime };
