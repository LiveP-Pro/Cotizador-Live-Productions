const crypto = require("node:crypto");

const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "").trim();

function invalid(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function stockNumber(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalid(`${label}: ingrese una cantidad entera mayor o igual a cero.`);
  }
  return value;
}

function limitedText(value, label, limit, required = false) {
  if (value !== undefined && value !== null && typeof value !== "string") throw invalid(`${label} no es válido.`);
  const result = text(value);
  if ((required && !result) || result.length > limit) throw invalid(`${label}: escriba ${required ? "entre 1 y " : "hasta "}${limit} caracteres.`);
  return result;
}

function normalizeStockIngress(payload) {
  const requestId = limitedText(payload?.requestId, "Identificador del ingreso", 240, true);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(requestId)) throw invalid("El identificador del ingreso no es válido.");
  if (!Array.isArray(payload?.items) || payload.items.length < 1 || payload.items.length > 100) {
    throw invalid("El ingreso debe incluir entre 1 y 100 filas de equipo.");
  }
  const items = payload.items.map((item, index) => ({
    description: limitedText(item?.description, `Fila ${index + 1}, equipo`, 240, true),
    quantity: stockNumber(item?.quantity, `Fila ${index + 1}`),
    category: limitedText(item?.category, `Fila ${index + 1}, categoría`, 160, true)
  }));
  const suppliedEvent = payload?.event;
  if (suppliedEvent !== undefined && (suppliedEvent === null || typeof suppliedEvent !== "object" || Array.isArray(suppliedEvent))) {
    throw invalid("Los datos del evento no son válidos.");
  }
  const event = {
    id: limitedText(suppliedEvent?.id, "Identificador del evento", 240),
    name: limitedText(suppliedEvent?.name, "Nombre del evento", 240),
    place: limitedText(suppliedEvent?.place, "Lugar del evento", 240),
    date: limitedText(suppliedEvent?.date, "Fecha del evento", 10)
  };
  if (event.date && (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || Number.isNaN(Date.parse(event.date)) || new Date(event.date).toISOString().slice(0, 10) !== event.date)) {
    throw invalid("La fecha del evento no es válida.");
  }
  return { requestId, items, event };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function stockIngressFingerprint(request) {
  return crypto.createHash("sha256").update(stableJson({ items: request.items, event: request.event })).digest("hex");
}

function nextWarehouseTimestamp(previous, now = Date.now()) {
  const earlier = Date.parse(previous || "");
  const current = Number.isFinite(now) ? now : Date.now();
  return new Date(Math.max(current, Number.isFinite(earlier) ? earlier + 1 : current)).toISOString();
}

function entityMap(entities, label) {
  const indexed = new Map();
  for (const entity of Array.isArray(entities) ? entities : []) {
    const id = text(entity?.id);
    if (!id || indexed.has(id)) throw invalid(`${label}: hay identificadores vacíos o repetidos. Conserve cada registro con su identificador original.`);
    indexed.set(id, entity);
  }
  return indexed;
}

function applyStockIngress(current, payload, { actor = {}, timestamp = new Date().toISOString() } = {}) {
  const request = normalizeStockIngress(payload);
  const fingerprint = stockIngressFingerprint(request);
  const receipts = Array.isArray(current?.state?.equipmentStockReceipts) ? current.state.equipmentStockReceipts : [];
  const previousReceipt = receipts.find((entry) => entry.requestId === request.requestId);
  if (previousReceipt) {
    if (previousReceipt.fingerprint !== fingerprint) throw invalid("Ese identificador ya se usó para un ingreso diferente. No se duplicó ni modificó el inventario.", 409);
    return { duplicate: true, receipt: { requestId: request.requestId, duplicate: true, items: clone(previousReceipt.items) } };
  }
  const state = clone(current.state);
  entityMap(state.items, "Inventario");
  const changes = [];
  const receivedItems = [];
  for (const input of request.items) {
    const matches = state.items.filter((item) => !item.archived && text(item.name) === input.description && text(item.category) === input.category);
    if (matches.length > 1) throw invalid(`Hay varios registros de «${input.description}» en «${input.category}». Identifique el registro correcto antes de ingresar equipo.`, 409);
    let item = matches[0];
    const before = item ? clone(item) : null;
    const previousQuantity = item ? stockNumber(item.quantity, `Inventario de «${input.description}»`) : 0;
    const newQuantity = previousQuantity + input.quantity;
    if (!Number.isSafeInteger(newQuantity)) throw invalid(`La cantidad total de «${input.description}» excede el máximo permitido.`);
    if (!item) {
      if (state.items.length >= 10000) throw invalid("El inventario excede el límite de 10,000 equipos.");
      item = { id: `warehouse-${crypto.randomUUID()}`, name: input.description, category: input.category,
        quantity: 0, itemType: /(?:^|\s)\/?\s*consumible$/i.test(input.description) ? "consumible" : "equipo",
        notes: "", archived: false, createdAt: timestamp };
      state.items.push(item);
    }
    item.quantity = newQuantity;
    if (!before || input.quantity > 0) {
      item.updatedAt = timestamp;
      changes.push({ action: before ? "ingreso" : "alta", entityType: "item", entityId: item.id,
        description: input.description, category: input.category, quantity: input.quantity,
        previousQuantity, newQuantity, before, after: clone(item) });
    }
    receivedItems.push({ itemId: item.id, description: input.description, quantity: input.quantity,
      category: input.category, previousQuantity, newQuantity });
  }
  const storedReceipt = { requestId: request.requestId, fingerprint, createdAt: timestamp, actor: clone(actor),
    event: request.event, items: receivedItems };
  return { duplicate: false, state, changes, storedReceipt,
    receipt: { requestId: request.requestId, duplicate: false, items: clone(receivedItems) } };
}

function movementEvent(movement) {
  return { id: text(movement?.sourceEventId), name: text(movement?.sourceEventName || movement?.reference),
    place: text(movement?.sourceEventPlace), date: text(movement?.sourceEventDate || movement?.date) };
}

const AUDIT_VOLATILE_FIELDS = new Set(["createdAt", "updatedAt", "savedAt", "publishedAt"]);
const MOVEMENT_FILE_FIELDS = ["sourcePdfUrl", "sourceJsonUrl", "sourceFileName", "sourceJsonFileName"];

function binaryEvidence(value) {
  const content = text(value);
  if (!content) return null;
  return { sha256: crypto.createHash("sha256").update(content).digest("hex"),
    byteLength: Buffer.byteLength(content), inline: true };
}

function auditSnapshot(value, field = "") {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (["warehouseSignature", "workshopSignature", "dataUrl"].includes(field) || /^data:[^,]*,/i.test(value)) return binaryEvidence(value);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => auditSnapshot(entry));
  if (typeof value !== "object") return value;
  const output = {};
  for (const [key, entry] of Object.entries(value)) {
    if (AUDIT_VOLATILE_FIELDS.has(key) || ["auditEntries", "equipmentStockReceipts"].includes(key)) continue;
    output[key] = auditSnapshot(entry, key);
  }
  return output;
}

function withoutEmptyDefaults(value) {
  if (Array.isArray(value)) return value.map(withoutEmptyDefaults);
  if (!value || typeof value !== "object") return typeof value === "string" ? value.trim() : value;
  const result = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = withoutEmptyDefaults(entry);
    if (normalized === null || normalized === undefined || normalized === "" || normalized === false
      || Array.isArray(normalized) && !normalized.length
      || normalized && typeof normalized === "object" && !Array.isArray(normalized) && !Object.keys(normalized).length) continue;
    result[key] = normalized;
  }
  return result;
}

function comparableEntity(entity, entityType, ignoreId = false) {
  const normalized = auditSnapshot(entity);
  if (ignoreId) delete normalized.id;
  normalized.quantity = Number(entity.quantity ?? 0);
  if (entityType === "item") {
    normalized.category = text(entity.category || "SIN CATEGORIA").toUpperCase();
    normalized.name = text(entity.name || "Equipo sin nombre");
    normalized.itemType = text(entity.itemType).toLowerCase() === "consumible" || /(?:^|\s)\/?\s*consumible$/i.test(normalized.name)
      ? "consumible" : "equipo";
    normalized.archived = Boolean(entity.archived);
    normalized.descriptionAliases = [...new Set((entity.descriptionAliases || []).map(text).filter(Boolean))].sort();
    // These are provenance/defaults synthesized while loading an existing row.
    // They do not themselves represent an inventory transaction or a user edit.
    delete normalized.sourceKey;
    delete normalized.sourceRow;
    delete normalized.importSource;
  } else {
    normalized.type = entity.type === "danado" ? "taller" : entity.type;
    normalized.rentalDays = Math.max(1, Number(entity.rentalDays) || 1);
    normalized.previousQuantity = entity.previousQuantity === undefined || entity.previousQuantity === null ? null : Number(entity.previousQuantity);
    normalized.newQuantity = entity.newQuantity === undefined || entity.newQuantity === null ? null : Number(entity.newQuantity);
    normalized.dateTime = text(entity.dateTime) || (entity.date ? `${entity.date}T00:00` : "");
    const choice = ["save", "rent", "purchase"].includes(text(entity.procurementChoice).toLowerCase()) ? text(entity.procurementChoice).toLowerCase() : "";
    normalized.procurementChoice = choice;
    normalized.procurementAction = { save: "GUARDAR", rent: "RENTA", purchase: "COMPRA" }[choice] || text(entity.procurementAction).toUpperCase();
    if (entity.attachment?.dataUrl || entity.attachment?.url) {
      normalized.attachment = { ...normalized.attachment, name: text(entity.attachment.name) || "archivo",
        type: text(entity.attachment.type) || "application/octet-stream" };
    } else normalized.attachment = null;
    // Re-generating the PDF only replaces links, not the recorded movement.
    MOVEMENT_FILE_FIELDS.forEach((key) => { delete normalized[key]; });
  }
  return withoutEmptyDefaults(normalized);
}

function sourceMovementIdentity(movement) {
  if (!text(movement?.sourceDocumentId) || !text(movement?.sourceLineKey) || !text(movement?.type)) return "";
  return stableJson([text(movement.sourceDocumentId), text(movement.sourceLineKey), text(movement.itemId), text(movement.type)]);
}

function uniqueSourceMovements(movements) {
  const grouped = new Map();
  for (const movement of movements.values()) {
    const identity = sourceMovementIdentity(movement);
    if (!identity) continue;
    if (!grouped.has(identity)) grouped.set(identity, []);
    grouped.get(identity).push(movement);
  }
  return new Map([...grouped].filter(([, entries]) => entries.length === 1).map(([identity, entries]) => [identity, entries[0]]));
}

function auditWarehouseChanges(previous, next, context = {}) {
  const changes = [...(context.ingressChanges || [])];
  const ingressIds = new Set(changes.filter((entry) => entry.entityType === "item").map((entry) => entry.entityId));
  const beforeItems = entityMap(previous.items, "Inventario anterior");
  const afterItems = entityMap(next.items, "Inventario");
  for (const [id, item] of afterItems) {
    if (ingressIds.has(id)) continue;
    const before = beforeItems.get(id);
    if (before && stableJson(comparableEntity(before, "item")) === stableJson(comparableEntity(item, "item"))) continue;
    const previousQuantity = before ? Number(before.quantity) : 0;
    const newQuantity = Number(item.quantity);
    const action = !before ? "alta" : Boolean(before.archived) !== Boolean(item.archived) ? item.archived ? "archivado" : "reactivado"
      : previousQuantity !== newQuantity ? "cambio_cantidad" : "edicion";
    changes.push({ action, entityType: "item", entityId: id, description: text(item.name), category: text(item.category),
      previousQuantity, newQuantity, quantity: newQuantity - previousQuantity,
      before: before ? clone(before) : null, after: clone(item) });
  }
  for (const [id, before] of beforeItems) {
    if (!afterItems.has(id)) changes.push({ action: "eliminacion", entityType: "item", entityId: id,
      description: text(before.name), category: text(before.category), previousQuantity: Number(before.quantity),
      newQuantity: 0, quantity: -Number(before.quantity), before: clone(before), after: null });
  }
  const beforeMovements = entityMap(previous.movements, "Bitácora anterior");
  const afterMovements = entityMap(next.movements, "Bitácora");
  const beforeSources = context.source === "requerimiento-equipo" ? uniqueSourceMovements(beforeMovements) : new Map();
  const afterSources = context.source === "requerimiento-equipo" ? uniqueSourceMovements(afterMovements) : new Map();
  const replacedMovementIds = new Set();
  for (const [id, movement] of afterMovements) {
    let before = beforeMovements.get(id);
    let replaced = false;
    if (!before) {
      const identity = sourceMovementIdentity(movement);
      const sourceBefore = beforeSources.get(identity);
      if (sourceBefore && afterSources.has(identity) && !afterMovements.has(text(sourceBefore.id))) {
        before = sourceBefore;
        replaced = true;
        replacedMovementIds.add(text(sourceBefore.id));
      }
    }
    if (before && stableJson(comparableEntity(before, "movement", replaced)) === stableJson(comparableEntity(movement, "movement", replaced))) continue;
    changes.push({ action: before ? "edicion_movimiento" : text(movement.type) || "movimiento", entityType: "movement", entityId: id,
      description: text(movement.itemName), category: text(movement.sourceCategory),
      quantity: Number(movement.quantity) || 0, previousQuantity: movement.previousQuantity ?? null,
      newQuantity: movement.newQuantity ?? null, before: before ? clone(before) : null, after: clone(movement),
      event: movementEvent(movement) });
  }
  for (const [id, before] of beforeMovements) {
    if (!afterMovements.has(id) && !replacedMovementIds.has(id)) changes.push({ action: "eliminacion_bitacora", entityType: "movement", entityId: id,
      description: text(before.itemName), category: text(before.sourceCategory), quantity: Number(before.quantity) || 0,
      previousQuantity: before.previousQuantity ?? null, newQuantity: before.newQuantity ?? null,
      before: clone(before), after: null, event: movementEvent(before) });
  }
  return changes;
}

function prepareWarehouseSave(current, candidate, context = {}, now = Date.now()) {
  const state = clone(candidate);
  const savedAt = nextWarehouseTimestamp(current.savedAt, now);
  const changes = auditWarehouseChanges(current.state, state, context);
  // These two records are server-owned. Client omissions, replacements, or
  // additions never alter existing audit evidence or idempotency receipts.
  state.auditEntries = clone(Array.isArray(current.state.auditEntries) ? current.state.auditEntries : []);
  state.equipmentStockReceipts = clone(Array.isArray(current.state.equipmentStockReceipts) ? current.state.equipmentStockReceipts : []);
  for (const change of changes) state.auditEntries.push({ ...change, before: auditSnapshot(change.before), after: auditSnapshot(change.after),
    id: `audit-${crypto.randomUUID()}`, timestamp: savedAt, actor: clone(context.actor || {}),
    source: text(context.source || "contabilidad-equipo"), requestId: text(context.requestId),
    event: change.event || clone(context.event || {}) });
  if (context.stockReceipt) {
    if (state.equipmentStockReceipts.some((receipt) => receipt.requestId === context.stockReceipt.requestId)) {
      throw invalid("El ingreso ya fue registrado. Vuelva a consultar su recibo antes de reintentar.", 409);
    }
    state.equipmentStockReceipts.push(clone(context.stockReceipt));
  }
  state.updatedAt = savedAt;
  return { state, savedAt };
}

module.exports = { normalizeStockIngress, stockIngressFingerprint, applyStockIngress,
  nextWarehouseTimestamp, prepareWarehouseSave, auditWarehouseChanges };
