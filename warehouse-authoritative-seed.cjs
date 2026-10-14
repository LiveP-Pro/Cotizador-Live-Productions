const crypto = require("node:crypto");
const { prepareWarehouseSave } = require("./warehouse-ledger.cjs");
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "").trim();

function seedState(payload) { return payload?.state || payload || {}; }
function authoritativeSeed(payload) { return seedState(payload).authoritativeInventorySource === true; }

function sourceMetadata(payload) {
  const state = seedState(payload);
  const source = state.inventorySource || (state.source && typeof state.source === "object" ? state.source : {}) || {};
  return {
    datasetId: text(state.datasetId),
    sourceId: text(source.spreadsheetId || source.sourceSpreadsheetId || source.sourceId || state.sourceSpreadsheetId),
    sheetId: Number(source.sheetId ?? source.sourceSheetId ?? state.sourceSheetId),
    quantityColumn: text(source.quantityColumn),
    sourceHash: text(source.sourceHash || source.sha256 || source.hash || state.sourceHash)
  };
}

function stockProjection(items) {
  return (Array.isArray(items) ? items : []).filter((item) => !item.archived)
    .map((item) => [text(item.id), text(item.name), text(item.category), item.quantity]);
}

function sourceFingerprint(payload) {
  const metadata = sourceMetadata(payload);
  return metadata.sourceHash || crypto.createHash("sha256").update(JSON.stringify(stockProjection(seedState(payload).items))).digest("hex");
}

function validateAuthoritativeSeed(seed) {
  const state = seedState(seed), metadata = sourceMetadata(seed);
  if (!authoritativeSeed(seed) || !metadata.datasetId || !metadata.sourceId || metadata.sheetId !== 862474686 || metadata.quantityColumn !== "L") {
    throw new Error("El inventario autorizado debe identificar su dataset, fuente, hoja 862474686 y columna L.");
  }
  if (!Array.isArray(state.items) || !state.items.length || state.items.length > 10000) throw new Error("La fuente autorizada debe contener entre 1 y 10,000 registros.");
  const ids = new Set();
  for (const item of state.items) {
    if (!text(item.id) || ids.has(text(item.id)) || !text(item.name) || !text(item.category)
      || !Number.isSafeInteger(item.quantity) || item.quantity < 0 || item.archived) throw new Error("La fuente autorizada tiene un identificador, nombre, categoría o cantidad inválida; no se sustituyó el inventario.");
    ids.add(text(item.id));
  }
  return metadata;
}

function protectedWarehouseMetadata(current, candidate) {
  const state = clone(candidate), previous = current?.state || {};
  for (const field of ["appliedInventorySources", "historicalMovements"]) {
    state[field] = clone(Array.isArray(previous[field]) ? previous[field] : []);
  }
  for (const field of ["inventorySource", "sourceCells", "approvedNameAliases", "sourceSpreadsheetId", "sourceSheetId"]) {
    if (Object.hasOwn(previous, field)) state[field] = clone(previous[field]);
  }
  return state;
}

function planAuthoritativeSeed(current, seed, now = Date.now()) {
  const metadata = validateAuthoritativeSeed(seed), fingerprint = sourceFingerprint(seed);
  const previous = current || { state: { items: [], movements: [], auditEntries: [], equipmentStockReceipts: [], historicalMovements: [] }, savedAt: "" };
  const markers = Array.isArray(previous.state.appliedInventorySources) ? previous.state.appliedInventorySources : [];
  const existing = markers.find((entry) => entry.datasetId === metadata.datasetId);
  if (existing) {
    if (existing.sourceHash !== fingerprint) throw new Error("El dataset ya aplicado cambió de contenido. Identifique la versión nueva antes de sustituir inventario.");
    return { applied: false, saved: current, metadata };
  }
  const previousIds = new Set((previous.state.items || []).map((item) => text(item.id)));
  if (seedState(seed).items.some((item) => previousIds.has(text(item.id)))) {
    throw new Error("Los identificadores de la fuente nueva deben usar un namespace nuevo por dataset y fila; no reutilice identidades de inventarios previos.");
  }
  const candidate = clone(seedState(seed));
  if (!candidate.inventorySource && candidate.source && typeof candidate.source === "object") candidate.inventorySource = clone(candidate.source);
  // Preserve old rows only as immutable history. Do not use them as stock,
  // aliases, quantities, or defaults for any item in this source.
  candidate.movements = clone(previous.state.movements || []);
  const saved = prepareWarehouseSave(previous, candidate, {
    actor: { id: "server-deployment", username: "Servidor", name: "Actualización autorizada de fuente" },
    source: "actualizacion-inventario-fuente"
  }, now);
  const archived = (previous.state.movements || []).map((movement) => ({ ...clone(movement),
    archivedAt: saved.savedAt, historicalDatasetId: text(previous.state.datasetId), archiveReason: "Inventario disponible actualizado desde la fuente autorizada" }));
  saved.state.movements = [];
  saved.state.historicalMovements = [...clone(previous.state.historicalMovements || []), ...archived];
  saved.state.appliedInventorySources = [...clone(markers), { ...metadata, sourceHash: fingerprint, appliedAt: saved.savedAt }];
  saved.state.auditEntries.push({ id: `audit-${crypto.randomUUID()}`, timestamp: saved.savedAt,
    actor: { id: "server-deployment", username: "Servidor", name: "Actualización autorizada de fuente" },
    action: "actualizacion_fuente", entityType: "inventory-source", entityId: metadata.datasetId,
    description: "Inventario disponible actualizado desde la fuente autorizada", source: "actualizacion-inventario-fuente",
    before: { datasetId: text(previous.state.datasetId) }, after: { ...metadata, sourceHash: fingerprint },
    historicalMovementCount: archived.length });
  return { applied: true, saved, metadata };
}

function warehouseSourceStatus(current, seed, version) {
  const metadata = sourceMetadata(seed), fingerprint = authoritativeSeed(seed) ? sourceFingerprint(seed) : "";
  const marker = (current?.state?.appliedInventorySources || []).find((entry) => entry.datasetId === metadata.datasetId && entry.sourceHash === fingerprint);
  return { version, datasetId: metadata.datasetId, sourceId: metadata.sourceId, applied: Boolean(marker), sourceHash: fingerprint,
    agreesWithSource: Boolean(marker) && JSON.stringify(stockProjection(current?.state?.items)) === JSON.stringify(stockProjection(seedState(seed).items)) };
}

module.exports = { authoritativeSeed, planAuthoritativeSeed, protectedWarehouseMetadata, warehouseSourceStatus };
