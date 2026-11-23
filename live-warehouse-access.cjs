"use strict";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "").trim();

function has(user, permission) {
  return Boolean(user && user.active !== false && Array.isArray(user.permissions)
    && (user.permissions.includes("*") || user.permissions.includes(permission)));
}

function fullHistoryAccess(user) {
  return has(user, "warehouse.logs") || has(user, "warehouse.movements.manage");
}

function ownsMovement(movement, user) {
  const id = text(user?.id || user?.userId);
  return Boolean(has(user, "warehouse.movements") && id
    && id === text(movement?.createdBy?.userId || movement?.createdBy?.id));
}

function pick(value, fields) {
  const result = {};
  if (!value || typeof value !== "object") return result;
  for (const field of fields) if (own(value, field)) result[field] = clone(value[field]);
  return result;
}

// Keep every movement and its operational identity. Availability and return
// matching must produce the same result with or without permission to see the
// employee's notes, files, signatures and identity.
const MOVEMENT_FIELDS = Object.freeze([
  "id", "type", "itemId", "itemName", "quantity", "previousQuantity", "newQuantity",
  "date", "dateTime", "rentalDays", "batchId", "relatedMovementId", "createdAt", "updatedAt",
  "sourceType", "sourceDocumentId", "sourceEventId", "sourceEventName", "sourceEventPlace",
  "sourceEventDate", "sourceExpectedReturnAt", "sourceCategory", "sourceRequestedName", "sourceLineKey",
  "sourceUnmatched", "procurementChoice", "procurementAction"
]);
const ITEM_FIELDS = Object.freeze([
  "id", "name", "category", "quantity", "itemType", "archived", "sourceKey", "sourceRow",
  "createdAt", "updatedAt", "descriptionAliases"
]);
const STATE_FIELDS = Object.freeze(["version", "datasetId", "createdAt", "updatedAt", "title", "subtitles"]);
const INVENTORY_METADATA_FIELDS = Object.freeze(["source", "sourceSpreadsheetId", "sourceSheetId", "importedSource"]);
const HANDOFF_FIELDS = Object.freeze(["id", "transferId", "fromEventId", "toEventId", "fromDocumentId", "toDocumentId",
  "fromEventName", "fromEventPlace", "toEventName", "toEventPlace", "toEventDate", "toExpectedReturnAt", "itemId", "itemName", "quantity", "createdAt", "links"]);

function projectHandoff(handoff, user) {
  if (handoff?.activityExcluded !== true && fullHistoryAccess(user)) return clone(handoff);
  const result = pick(handoff, HANDOFF_FIELDS);
  result.links = (Array.isArray(handoff?.links) ? handoff.links : []).map(link => pick(link,
    ["sourceMovementId", "sourceDocumentId", "sourceEventId", "parentHandoffId", "quantity"]));
  if (handoff?.activityExcluded === true) result.activityExcluded = true;
  return result;
}

function projectMovement(movement, user) {
  if (movement?.activityExcluded === true) return { ...pick(movement, MOVEMENT_FIELDS), activityExcluded: true };
  return fullHistoryAccess(user) || ownsMovement(movement, user) ? clone(movement) : pick(movement, MOVEMENT_FIELDS);
}

function projectItem(item, user) {
  if (fullHistoryAccess(user) || has(user, "warehouse.inventory")) return clone(item);
  const result = pick(item, ITEM_FIELDS);
  if (Array.isArray(item?.approvedDescriptionAliases)) result.approvedDescriptionAliases = item.approvedDescriptionAliases
    .map((entry) => pick(entry, ["name", "approved", "approvedAt"]));
  if (item?.classificationConfirmed && typeof item.classificationConfirmed === "object") {
    result.classificationConfirmed = pick(item.classificationConfirmed, ["itemType", "name", "confirmedAt"]);
  }
  if (Array.isArray(item?.equipmentPurchaseLinks)) result.equipmentPurchaseLinks = item.equipmentPurchaseLinks
    .map((entry) => pick(entry, ["requestId", "eventId", "itemId", "description", "receivedQuantity"]));
  return result;
}

function projectReceipt(receipt) {
  const result = pick(receipt, ["requestId", "fingerprint", "createdAt"]);
  if (receipt?.activityExcluded === true) result.activityExcluded = true;
  if (Array.isArray(receipt?.items)) result.items = receipt.items.map((item) => pick(item,
    ["itemId", "description", "quantity", "category", "previousQuantity", "newQuantity"]));
  if (receipt?.event && typeof receipt.event === "object") result.event = pick(receipt.event, ["id", "name", "place", "date"]);
  return result;
}

function redactExcludedActivity(value) {
  if (Array.isArray(value)) return value.map(redactExcludedActivity);
  if (!value || typeof value !== "object") return clone(value);
  if (value.activityExcluded === true) {
    if (own(value, "type") && own(value, "quantity")) return { ...pick(value, MOVEMENT_FIELDS), activityExcluded: true };
    if (own(value, "requestId") && Array.isArray(value.items)) return { ...projectReceipt(value), activityExcluded: true };
    // A developer import still needs its authorization mode and confirmation,
    // but its actor is excluded from activity reports just like movements.
    if (own(value, "mode") && own(value, "confirmedAt")) return {
      ...pick(value, ["mode", "confirmed", "confirmedAt"]), activityExcluded: true };
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactExcludedActivity(entry)]));
}

function projectState(state, user) {
  const full = fullHistoryAccess(user);
  const result = full ? redactExcludedActivity(state) : pick(state, STATE_FIELDS);
  if (has(user, "warehouse.inventory")) Object.assign(result,
    pick(state, INVENTORY_METADATA_FIELDS));
  result.items = (Array.isArray(state?.items) ? state.items : []).map((item) => projectItem(item, user));
  result.movements = (Array.isArray(state?.movements) ? state.movements : []).map((movement) => projectMovement(movement, user));
  result.auditEntries = full ? redactExcludedActivity(Array.isArray(state?.auditEntries) ? state.auditEntries : []) : [];
  result.equipmentStockReceipts = (Array.isArray(state?.equipmentStockReceipts) ? state.equipmentStockReceipts : [])
    .map((receipt) => full ? redactExcludedActivity(receipt) : projectReceipt(receipt));
  if (Array.isArray(state?.equipmentHandoffs)) result.equipmentHandoffs = state.equipmentHandoffs
    .map(handoff => projectHandoff(handoff, user));
  // Drafts are shared operational lists, rather than historical evidence. Keep
  // just the identity/quantity needed to use them, not arbitrary embedded files.
  for (const field of ["rentalDraft", "workshopDraft"]) if (!full && Array.isArray(state?.[field])) {
    result[field] = state[field].map((line) => pick(line, ["id", "itemId", "itemName", "quantity"]));
  }
  if (result.importedSource) result.importedSource = redactExcludedActivity(result.importedSource);
  return result;
}

function projectWarehousePayload(payload, user) {
  if (!payload || typeof payload !== "object") return clone(payload);
  if (!own(payload, "state")) return projectState(payload, user);
  const result = clone(payload);
  result.state = projectState(payload.state, user);
  // Some save endpoints also include a receipt outside state.
  if ((!fullHistoryAccess(user) || result.receipt?.activityExcluded === true) && result.receipt && typeof result.receipt === "object") {
    result.receipt = { ...pick(result.receipt, ["requestId", "duplicate"]),
      ...(Array.isArray(result.receipt.items) ? { items: result.receipt.items.map((item) => pick(item,
        ["itemId", "description", "quantity", "category", "previousQuantity", "newQuantity"])) } : {}) };
  }
  if (fullHistoryAccess(user)) return redactExcludedActivity(result);
  return result;
}

// Restore only fields that the requesting user could not have read. This does
// not restore omitted movements/items or overwrite their visible fields: the
// ledger must still see attempted deletions and operational edits and apply its
// ownership and stock checks. Unknown private keys cannot be added by a client.
function restoreHidden(previous, candidate, visible) {
  if (!previous || typeof previous !== "object" || Array.isArray(previous)) return clone(candidate);
  const result = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? clone(candidate) : {};
  for (const field of new Set([...Object.keys(previous), ...Object.keys(result)])) {
    if (!own(visible, field)) {
      if (own(previous, field)) result[field] = clone(previous[field]);
      else delete result[field];
      continue;
    }
    if (Array.isArray(previous[field]) && Array.isArray(result[field]) && Array.isArray(visible[field])) {
      result[field] = result[field].map((entry, index) => previous[field][index] && visible[field][index]
        && typeof entry === "object" && entry !== null
        ? restoreHidden(previous[field][index], entry, visible[field][index]) : clone(entry));
    } else if (previous[field] && result[field] && visible[field]
      && typeof previous[field] === "object" && typeof result[field] === "object" && typeof visible[field] === "object") {
      result[field] = restoreHidden(previous[field], result[field], visible[field]);
    }
  }
  return result;
}

function mergeWarehousePrivateFields(currentState, candidateState, user) {
  const current = currentState || {}, candidate = clone(candidateState || {});
  if (!fullHistoryAccess(user)) {
    const visible = projectState(current, user);
    // Work on metadata separately so no array-index merge can resurrect deleted
    // movements or associate one employee's private evidence with another ID.
    const currentMetadata = { ...current }, candidateMetadata = { ...candidate }, visibleMetadata = { ...visible };
    for (const field of ["items", "movements", "equipmentStockReceipts", "equipmentHandoffs", "auditEntries"]) {
      delete currentMetadata[field]; delete candidateMetadata[field]; delete visibleMetadata[field];
    }
    if (has(user, "warehouse.inventory")) for (const field of INVENTORY_METADATA_FIELDS) {
      delete currentMetadata[field]; delete candidateMetadata[field]; delete visibleMetadata[field];
    }
    Object.assign(candidate, restoreHidden(currentMetadata, candidateMetadata, visibleMetadata));
    // Delete attempted unknown metadata keys that restoreHidden removed.
    for (const field of Object.keys(candidateMetadata)) if (!own(visibleMetadata, field) && !own(currentMetadata, field)) delete candidate[field];
    const itemsById = new Map((current.items || []).map((item) => [text(item?.id), item]));
    const movementsById = new Map((current.movements || []).map((movement) => [text(movement?.id), movement]));
    if (Array.isArray(candidate.items)) candidate.items = candidate.items.map((item) => {
      const previous = itemsById.get(text(item?.id));
      return previous && !has(user, "warehouse.inventory") ? restoreHidden(previous, item, projectItem(previous, user)) : item;
    });
    if (Array.isArray(candidate.movements)) candidate.movements = candidate.movements.map((movement) => {
      const previous = movementsById.get(text(movement?.id));
      return previous && !ownsMovement(previous, user) ? restoreHidden(previous, movement, projectMovement(previous, user)) : movement;
    });
  }
  // Even a full-history administrator receives only operational fields for the
  // reserved developer's excluded rows. Restore their hidden server evidence
  // before the ledger compares edits, without restoring any deleted row.
  const movementsById = new Map((current.movements || []).map((movement) => [text(movement?.id), movement]));
  if (Array.isArray(candidate.movements)) candidate.movements = candidate.movements.map((movement) => {
    const previous = movementsById.get(text(movement?.id));
    return previous?.activityExcluded === true ? restoreHidden(previous, movement, projectMovement(previous, user)) : movement;
  });
  const previousAuthorization = current.importedSource?.authorization, nextAuthorization = candidate.importedSource?.authorization;
  if (previousAuthorization?.activityExcluded === true && nextAuthorization
    && JSON.stringify(pick(previousAuthorization, ["mode", "confirmed", "confirmedAt"]))
      === JSON.stringify(pick(nextAuthorization, ["mode", "confirmed", "confirmedAt"]))) {
    candidate.importedSource.authorization = restoreHidden(current.importedSource.authorization,
      candidate.importedSource.authorization, redactExcludedActivity(current.importedSource.authorization));
  }
  // These are server-owned even for an administrator. The ledger will append
  // new evidence/receipts after it validates the actual requested changes.
  candidate.auditEntries = clone(Array.isArray(current.auditEntries) ? current.auditEntries : []);
  candidate.equipmentStockReceipts = clone(Array.isArray(current.equipmentStockReceipts) ? current.equipmentStockReceipts : []);
  candidate.equipmentHandoffs = clone(Array.isArray(current.equipmentHandoffs) ? current.equipmentHandoffs : []);
  return candidate;
}

module.exports = { projectWarehousePayload, mergeWarehousePrivateFields };
