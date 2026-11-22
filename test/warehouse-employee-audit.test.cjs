const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { prepareWarehouseSave, validateWarehousePermissions } = require("../warehouse-ledger.cjs");

const timestamp = "2026-11-22T18:00:00.000Z";
const now = Date.parse(timestamp);
const employee = { id: "employee-1", username: "bodega1", name: "Empleado Uno" };
const manager = { id: "employee-2", username: "supervision", name: "Supervisión" };
const permissions = ["warehouse.movements"];
function context(actor = employee, extra = {}) {
  return { actor, permissions, enforceMovementOwnership: true, ...extra };
}
function inventory() {
  return { savedAt: "2026-11-22T17:00:00.000Z", state: {
    version: 3, subtitles: [], items: [{ id: "speaker", name: "Altavoz sintético", category: "AUDIO", quantity: 8 }],
    movements: [], auditEntries: [{ id: "old-evidence", timestamp: "2026-11-20T15:00:00.000Z", actor: { username: "anterior" } }],
    equipmentStockReceipts: [], rentalDraft: [], workshopDraft: []
  } };
}
function outgoing(id = "outgoing-1") {
  return { id, type: "salida", itemId: "speaker", itemName: "Altavoz sintético", quantity: 2,
    date: "2026-11-23", dateTime: "2026-11-23T10:00", responsible: "Responsable operativo", notes: "Evento de prueba" };
}

test("the server seals employee identity and recording time independently of event time or supplied authors", () => {
  const current = inventory();
  const candidate = structuredClone(current.state);
  candidate.movements.push({ ...outgoing(), createdBy: manager, updatedBy: manager, actor: manager,
    createdAt: "1999-01-01T00:00:00Z", registeredAt: "1999-01-01T00:00:00Z" });
  candidate.auditEntries = [{ id: "forged-evidence", actor: manager }];
  const saved = prepareWarehouseSave(current, candidate, context(), now);
  const movement = saved.state.movements[0];
  assert.equal(movement.createdBy.userId, employee.id);
  assert.equal(movement.createdBy.username, employee.username);
  assert.equal(movement.createdBy.displayName, employee.name);
  assert.equal(movement.createdAt, timestamp);
  assert.equal(movement.registeredAt, timestamp);
  assert.equal(movement.dateTime, "2026-11-23T10:00");
  assert.equal(movement.responsible, "Responsable operativo");
  assert.equal(movement.updatedBy, undefined);
  assert.equal(movement.actor, undefined);
  assert.deepEqual(saved.state.auditEntries[0], current.state.auditEntries[0]);
  assert.equal(saved.state.auditEntries.at(-1).actor.userId, employee.id);
  assert.equal(saved.state.auditEntries.at(-1).timestamp, timestamp);
  assert.equal(current.state.movements.length, 0);
});

test("client omissions and changed signatures never transfer original employee ownership", () => {
  const first = inventory();
  const draft = structuredClone(first.state);
  draft.movements.push(outgoing());
  const saved = prepareWarehouseSave(first, draft, context(), now);
  const candidate = structuredClone(saved.state);
  Object.assign(candidate.movements[0], { createdBy: manager, registeredAt: "1900-01-01", createdAt: "1900-01-01", notes: "Corrección autorizada" });
  const updated = prepareWarehouseSave(saved, candidate,
    context(manager, { permissions: ["warehouse.movements.manage"] }), now + 1000);
  assert.equal(updated.state.movements[0].createdBy.userId, employee.id);
  assert.equal(updated.state.movements[0].registeredAt, timestamp);
  assert.equal(updated.state.movements[0].createdAt, timestamp);
  assert.equal(updated.state.movements[0].updatedBy.userId, manager.id);
  assert.equal(updated.state.movements[0].updatedAt, "2026-11-22T18:00:01.000Z");
  assert.equal(updated.state.auditEntries.at(-1).actor.userId, manager.id);
  const noChange = structuredClone(updated.state);
  delete noChange.movements[0].createdBy;
  noChange.movements[0].updatedBy = employee;
  const sealed = prepareWarehouseSave(updated, noChange, context(), now + 2000);
  assert.deepEqual(sealed.state.movements[0].createdBy, updated.state.movements[0].createdBy);
  assert.deepEqual(sealed.state.movements[0].updatedBy, updated.state.movements[0].updatedBy);
  assert.deepEqual(sealed.state.auditEntries, updated.state.auditEntries);
});

test("employees may correct only their own movements; legacy ownership remains unknown", () => {
  const current = inventory();
  current.state.movements = [{ ...outgoing(), createdBy: { userId: employee.id, username: employee.username } }];
  const ownEdit = structuredClone(current.state);
  ownEdit.movements[0].notes = "Motivo de corrección";
  assert.doesNotThrow(() => prepareWarehouseSave(current, ownEdit, context(), now));
  assert.throws(() => prepareWarehouseSave(current, ownEdit, context(manager), now), { statusCode: 403 });
  const deletion = structuredClone(current.state);
  deletion.movements = [];
  assert.throws(() => prepareWarehouseSave(current, deletion, context(manager), now), { statusCode: 403 });
  const removed = prepareWarehouseSave(current, deletion, context(manager, { permissions: ["warehouse.movements.manage"] }), now);
  assert.equal(removed.state.auditEntries.at(-1).action, "eliminacion_bitacora");
  assert.equal(removed.state.auditEntries.at(-1).actor.userId, manager.id);
  assert.equal(removed.state.auditEntries.at(-1).before.createdBy.userId, employee.id);
  const legacy = inventory();
  legacy.state.movements = [outgoing()];
  const legacyEdit = structuredClone(legacy.state);
  legacyEdit.movements[0].notes = "Corrección de archivo antiguo";
  assert.throws(() => prepareWarehouseSave(legacy, legacyEdit, context(), now), { statusCode: 403 });
  const legacySaved = prepareWarehouseSave(legacy, legacyEdit, context(manager, { permissions: ["warehouse.movements.manage"] }), now);
  assert.equal(legacySaved.state.movements[0].createdBy, undefined);
  assert.equal(legacySaved.state.movements[0].registeredAt, undefined);
  assert.equal(legacySaved.state.movements[0].updatedBy.userId, manager.id);
});

test("movement rights permit exact ingress and discharge quantities, never hidden stock changes", () => {
  for (const [type, signed] of [["ingreso", 3], ["baja", -3]]) {
    const current = inventory();
    const next = structuredClone(current.state);
    next.items[0].quantity += signed;
    next.movements.push({ ...outgoing(), type, quantity: 3, notes: "Motivo sintético" });
    assert.doesNotThrow(() => validateWarehousePermissions(current.state, next, context()));
    next.items[0].quantity += 1;
    assert.throws(() => validateWarehousePermissions(current.state, next, context()), { statusCode: 403 });
    next.items[0].quantity -= 1;
    next.items[0].name = "Nombre alterado sin permiso";
    assert.throws(() => validateWarehousePermissions(current.state, next, context()), { statusCode: 403 });
  }
  const current = inventory();
  for (const mutation of [
    (next) => { next.items[0].quantity = 100; },
    (next) => { next.subtitles.push("Categoría oculta"); },
    (next) => { next.movements.push({ ...outgoing(), type: "ingreso", quantity: 3, notes: "Motivo" }); },
    (next) => { next.items[0].quantity += 3; next.movements.push({ ...outgoing(), type: "ingreso", quantity: 3, notes: "" }); }
  ]) {
    const next = structuredClone(current.state);
    mutation(next);
    assert.throws(() => prepareWarehouseSave(current, next, context(), now));
  }
});

test("inventory-only rights can record stock adjustments but log-read rights cannot mutate data", () => {
  const current = inventory();
  const next = structuredClone(current.state);
  next.items[0].quantity = 5;
  next.movements.push({ ...outgoing(), type: "ajuste", quantity: 5, previousQuantity: 8, newQuantity: 5 });
  assert.doesNotThrow(() => prepareWarehouseSave(current, next, context(employee, { permissions: ["warehouse.inventory"] }), now));
  assert.throws(() => prepareWarehouseSave(current, next, context(employee, { permissions: ["warehouse.logs"] }), now), { statusCode: 403 });
});

test("re-emitted source documents retain original creator and do not invent another transaction", () => {
  const current = inventory();
  const draft = structuredClone(current.state);
  draft.movements = [{ ...outgoing(), sourceDocumentId: "document-1", sourceLineKey: "line-1" }];
  const first = prepareWarehouseSave(current, draft, context(), now);
  const replacement = structuredClone(first.state);
  replacement.movements[0].id = "regenerated-id";
  replacement.movements[0].createdBy = manager;
  replacement.movements[0].sourcePdfUrl = "/new.pdf";
  const second = prepareWarehouseSave(first, replacement, context(manager, { source: "requerimiento-equipo" }), now + 1000);
  assert.equal(second.state.movements[0].createdBy.userId, employee.id);
  assert.deepEqual(second.state.auditEntries, first.state.auditEntries);
});

test("private initial-state restores retain historical attribution without assigning the restoring employee", () => {
  const current = inventory();
  const restored = structuredClone(current.state);
  const legacy = { ...outgoing("historical-unknown"), createdAt: "2026-10-01T08:00:00.000Z" };
  const attributed = { ...outgoing("historical-attributed"), createdBy: { userId: "historical-employee", username: "anterior" },
    createdAt: "2026-10-02T08:00:00.000Z", registeredAt: "2026-10-02T08:00:00.000Z" };
  restored.movements = [legacy, attributed];
  const saved = prepareWarehouseSave(current, restored, { actor: manager, source: "restauracion-inventario" }, now);
  assert.deepEqual(saved.state.movements, restored.movements);
  assert.equal(saved.state.auditEntries.at(-1).actor.userId, manager.id);
});

function uiHarness() {
  const listeners = new Map();
  const context = { window: { LIVE_SESSION: { userId: employee.id, permissions } },
    document: { readyState: "loading", addEventListener(name, fn) { listeners.set(name, fn); } },
    console, setTimeout, clearTimeout };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  vm.runInContext(source.replace('  if (document.readyState === "loading") {',
    '  window.auditTest = { normalizeMovement, warehouseActorLabel, warehouseCanManageMovement, movementActorMarkup, renderLog, renderWarehouseHistory, setElements(value) { Object.assign(elements, value); }, setState(value) { state = value; } };\n  if (document.readyState === "loading") {'), context);
  return context;
}

test("movement UI retains acknowledged author, escapes names and distinguishes responsibility from login", () => {
  const context = uiHarness();
  const ui = context.window.auditTest;
  const movement = ui.normalizeMovement({ ...outgoing(), createdBy: { userId: employee.id, username: "bodega1", displayName: "<Empleado>" }, registeredAt: timestamp });
  assert.equal(movement.createdBy.userId, employee.id);
  assert.equal(movement.registeredAt, timestamp);
  assert.equal(ui.warehouseCanManageMovement(movement), true);
  assert.equal(ui.warehouseCanManageMovement({ ...movement, createdBy: { userId: manager.id } }), false);
  const markup = ui.movementActorMarkup(movement);
  assert.match(markup, /&lt;Empleado&gt; \(bodega1\)/);
  assert.doesNotMatch(markup, /<Empleado>/);
  assert.match(ui.movementActorMarkup(outgoing()), /Usuario no registrado/);
  context.window.LIVE_SESSION.permissions = ["warehouse.movements.manage"];
  assert.equal(ui.warehouseCanManageMovement(outgoing()), true);
});

test("log and automatic-history UI stay hidden for a session without log access", () => {
  const context = uiHarness();
  const logList = { innerHTML: "" }, historyList = { innerHTML: "sensitive history" };
  context.window.auditTest.setElements({ logList, historyList });
  context.window.auditTest.setState(inventory().state);
  context.window.auditTest.renderLog();
  context.window.auditTest.renderWarehouseHistory();
  assert.match(logList.innerHTML, /no tiene acceso/);
  assert.equal(historyList.innerHTML, "");
});
