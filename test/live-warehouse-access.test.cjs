const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { projectWarehousePayload, mergeWarehousePrivateFields } = require("../live-warehouse-access.cjs");
const { prepareWarehouseSave } = require("../warehouse-ledger.cjs");

const employee = { id: "employee-one", username: "employee", permissions: ["warehouse.read", "warehouse.movements"] };
const planner = { id: "planner-one", permissions: ["equipment.read", "equipment.write"] };
function fixture() {
  return { savedAt: "2026-11-22T18:00:00.000Z", state: {
    version: 4, datasetId: "synthetic-dataset", source: "PRIVATE inventory filename", sourceSpreadsheetId: "PRIVATE spreadsheet",
    sourceSheetId: 3, createdAt: "2026-11-20T18:00:00.000Z", updatedAt: "2026-11-22T18:00:00.000Z", title: "Inventario", subtitles: ["AUDIO"],
    importedSource: { notes: "PRIVATE inventory source", authorization: { actor: { id: "PRIVATE import actor" } } },
    secretFutureMetadata: "PRIVATE future metadata",
    items: [{ id: "speaker", name: "Altavoz sintético", category: "AUDIO", quantity: 8, itemType: "equipo", notes: "PRIVATE item notes",
      attachment: { dataUrl: "PRIVATE item file" }, classificationConfirmed: { itemType: "equipo", name: "Altavoz sintético", confirmedAt: "2026-11-20T18:00:00.000Z", actor: "PRIVATE classification" },
      approvedDescriptionAliases: [{ name: "Altavoz anterior", approved: true, approvedAt: "2026-11-20T18:00:00.000Z", actor: "PRIVATE alias" }],
      equipmentPurchaseLinks: [{ requestId: "receipt-1", eventId: "event-1", itemId: "line-1", description: "Altavoz sintético", receivedQuantity: 0, notes: "PRIVATE purchase" }] }],
    movements: [
      { id: "outgoing", type: "salida", itemId: "speaker", itemName: "Altavoz sintético", quantity: 2, date: "2026-11-22", dateTime: "2026-11-22T08:00", sourceEventId: "event-1", sourceEventName: "Evento de prueba", notes: "PRIVATE other notes", repair: "PRIVATE repair", sparePart: "PRIVATE spare", responsible: "PRIVATE person", sourcePlanner: "PRIVATE planner", attachment: { dataUrl: "PRIVATE photo" }, warehouseSignature: "PRIVATE signature", customEvidence: "PRIVATE evidence", sourcePdfUrl: "/PRIVATE-file.pdf", createdBy: { userId: "employee-other", username: "PRIVATE other username" } },
      { id: "returned", type: "ingreso_evento", itemId: "speaker", quantity: 1, relatedMovementId: "outgoing", notes: "PRIVATE returned note" },
      { id: "zero", type: "consumo", itemId: "speaker", quantity: 0, date: "2026-11-22", dateTime: "2026-11-22T08:00", notes: "PRIVATE zero note" }
    ],
    auditEntries: [{ id: "audit-one", actor: { name: "PRIVATE audit actor" }, before: { notes: "PRIVATE historic notes" } }],
    equipmentStockReceipts: [{ requestId: "receipt-1", fingerprint: "synthetic-fingerprint", actor: { username: "PRIVATE receipt actor" }, event: { id: "event-1", name: "Evento", notes: "PRIVATE receipt event" }, items: [{ itemId: "speaker", description: "Altavoz sintético", quantity: 0, category: "AUDIO", previousQuantity: 8, newQuantity: 8, notes: "PRIVATE receipt item" }] }],
    rentalDraft: [{ id: "draft-1", itemId: "speaker", itemName: "Altavoz sintético", quantity: 1, description: "PRIVATE draft notes", attachment: "PRIVATE draft photo" }], workshopDraft: []
  } };
}

test("planners get all operational rows and zero stock evidence without employee notes, files or history", () => {
  const original = fixture();
  const source = structuredClone(original);
  const projected = projectWarehousePayload(source, planner);
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE/);
  assert.equal(projected.savedAt, source.savedAt);
  assert.deepEqual(projected.state.movements.map((movement) => [movement.id, movement.type, movement.itemId, movement.quantity]),
    source.state.movements.map((movement) => [movement.id, movement.type, movement.itemId, movement.quantity]));
  assert.equal(projected.state.movements[1].relatedMovementId, "outgoing");
  assert.equal(projected.state.movements[0].sourceEventId, "event-1");
  assert.equal(projected.state.items[0].quantity, 8);
  assert.equal(projected.state.items[0].classificationConfirmed.itemType, "equipo");
  assert.equal(projected.state.items[0].approvedDescriptionAliases[0].approved, true);
  assert.equal(projected.state.items[0].equipmentPurchaseLinks[0].receivedQuantity, 0);
  assert.equal(projected.state.equipmentStockReceipts[0].items[0].quantity, 0);
  assert.equal(projected.state.equipmentStockReceipts[0].requestId, "receipt-1");
  assert.deepEqual(projected.state.auditEntries, []);
  projected.state.movements[0].quantity = 999;
  assert.deepEqual(source, original);
});

test("history and movement administrators receive complete independent snapshots", () => {
  for (const permissions of [["warehouse.logs"], ["warehouse.movements.manage"], ["*"]]) {
    const current = fixture();
    const result = projectWarehousePayload(current, { id: "supervisor", permissions });
    assert.deepEqual(result, current);
    result.state.movements[0].notes = "changed clone";
    assert.equal(current.state.movements[0].notes, "PRIVATE other notes");
  }
  const disabled = projectWarehousePayload(fixture(), { active: false, permissions: ["warehouse.logs"] });
  assert.doesNotMatch(JSON.stringify(disabled), /PRIVATE/);
});

test("movement ownership only exposes the employee's own full record", () => {
  const current = fixture();
  current.state.movements[1].createdBy = { id: employee.id, username: employee.username };
  const result = projectWarehousePayload(current, employee);
  assert.equal(result.state.movements[1].notes, "PRIVATE returned note");
  assert.deepEqual(result.state.movements[1].createdBy, current.state.movements[1].createdBy);
  assert.equal(result.state.movements[0].notes, undefined);
  result.state.movements[1].attachment = { dataUrl: "New own evidence" };
  const editedOwn = mergeWarehousePrivateFields(current.state, result.state, employee);
  assert.equal(editedOwn.movements[1].attachment.dataUrl, "New own evidence");
  const readonlySameId = projectWarehousePayload(current, { id: employee.id, permissions: ["equipment.read"] });
  assert.equal(readonlySameId.state.movements[1].notes, undefined);
});

test("inventory editors can maintain equipment notes and imported-source provenance without other employees' history", () => {
  const current = fixture();
  const user = { id: "inventory-editor", permissions: ["warehouse.inventory"] };
  const projected = projectWarehousePayload(current, user);
  assert.deepEqual(projected.state.items, current.state.items);
  assert.deepEqual(projected.state.importedSource, current.state.importedSource);
  assert.equal(projected.state.movements[0].notes, undefined);
  assert.deepEqual(projected.state.auditEntries, []);
  const draft = structuredClone(projected.state);
  draft.items[0].notes = "New inventory notes";
  draft.importedSource = { fileName: "New inventory.xlsx" };
  const merged = mergeWarehousePrivateFields(current.state, draft, user);
  assert.equal(merged.items[0].notes, "New inventory notes");
  assert.equal(merged.importedSource.fileName, "New inventory.xlsx");
  assert.equal(merged.movements[0].notes, "PRIVATE other notes");
});

test("partial reads merge hidden fields by record ID without reviving deletions or erasing operational edits", () => {
  const current = fixture();
  const next = projectWarehousePayload(current, employee).state;
  next.movements.reverse();
  const outgoing = next.movements.find((movement) => movement.id === "outgoing");
  outgoing.quantity = 3;
  outgoing.notes = "Forged note";
  outgoing.createdBy = { userId: employee.id };
  outgoing.customAddedSecret = "Forged evidence";
  next.movements = next.movements.filter((movement) => movement.id !== "returned");
  next.auditEntries = [];
  next.equipmentStockReceipts = [];
  const merged = mergeWarehousePrivateFields(current.state, next, employee);
  const result = merged.movements.find((movement) => movement.id === "outgoing");
  assert.equal(result.quantity, 3);
  assert.equal(result.notes, "PRIVATE other notes");
  assert.equal(result.createdBy.userId, "employee-other");
  assert.equal(result.customEvidence, "PRIVATE evidence");
  assert.equal(result.customAddedSecret, undefined);
  assert.equal(merged.movements.some((movement) => movement.id === "returned"), false);
  assert.deepEqual(merged.auditEntries, current.state.auditEntries);
  assert.deepEqual(merged.equipmentStockReceipts, current.state.equipmentStockReceipts);
  assert.equal(merged.secretFutureMetadata, current.state.secretFutureMetadata);
  assert.throws(() => prepareWarehouseSave(current, merged,
    { actor: employee, permissions: employee.permissions, enforceMovementOwnership: true }), { statusCode: 403 });
});

function normalizeInInventoryUi(raw) {
  const context = { window: {}, document: { readyState: "loading", addEventListener() {} } };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  vm.runInContext(source.replace('  if (document.readyState === "loading") {',
    '  window.normalizeForAccessTest = normalizeState;\n  if (document.readyState === "loading") {'), context);
  return JSON.parse(JSON.stringify(context.window.normalizeForAccessTest(raw)));
}

test("a projected GET can pass through the real inventory normalizer, append a movement and retain all hidden evidence", () => {
  const current = fixture();
  const projected = projectWarehousePayload(current, employee);
  const candidate = normalizeInInventoryUi(projected.state);
  candidate.movements.push({ id: "own-new", type: "salida", itemId: "speaker", itemName: "Altavoz sintético", quantity: 1,
    date: "2026-11-23", dateTime: "2026-11-23T09:00", notes: "Own reason", responsible: "Responsible person" });
  const merged = mergeWarehousePrivateFields(current.state, candidate, employee);
  const saved = prepareWarehouseSave(current, merged,
    { actor: employee, permissions: employee.permissions, enforceMovementOwnership: true }, Date.parse("2026-11-22T19:00:00Z"));
  assert.equal(saved.state.movements[0].notes, "PRIVATE other notes");
  assert.equal(saved.state.movements[0].warehouseSignature, "PRIVATE signature");
  assert.equal(saved.state.items[0].notes, "PRIVATE item notes");
  assert.equal(saved.state.movements.at(-1).notes, "Own reason");
  assert.equal(saved.state.movements.at(-1).createdBy.userId, employee.id);
  assert.equal(saved.state.auditEntries.length, current.state.auditEntries.length + 1);
  assert.equal(saved.state.auditEntries.at(-1).action, "salida");
});
