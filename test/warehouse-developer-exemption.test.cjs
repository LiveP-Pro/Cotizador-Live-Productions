const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { applyStockIngress, prepareWarehouseSave, developerAuditExempt } = require("../warehouse-ledger.cjs");
const { projectWarehousePayload, mergeWarehousePrivateFields } = require("../live-warehouse-access.cjs");

const developer = { id: "live-developer-dgiant", username: "Dgiant", name: "Developer" };
const employee = { id: "employee-synthetic", username: "employee", name: "Employee" };
const permissions = ["warehouse.inventory", "warehouse.movements", "warehouse.movements.manage", "warehouse.logs"];
const timestamp = "2026-11-22T20:00:00.000Z";
function context(actor = developer, extra = {}) {
  return { actor, permissions, enforceMovementOwnership: true, developerAuditExempt: actor.id === developer.id, ...extra };
}
function movement(id = "new-operation") {
  return { id, type: "salida", itemId: "speaker", itemName: "Synthetic speaker", quantity: 2,
    date: "2026-11-23", dateTime: "2026-11-23T10:00", notes: "Reason", responsible: "Responsible", reference: "Synthetic event" };
}
function inventory() {
  return { savedAt: "2026-11-22T18:00:00.000Z", state: { version: 4, items: [
    { id: "speaker", name: "Synthetic speaker", category: "AUDIO", quantity: 8, itemType: "equipo" }
  ], movements: [], auditEntries: [{ id: "existing-employee-evidence", actor: employee, description: "Original employee evidence" }],
  equipmentStockReceipts: [], subtitles: [], rentalDraft: [], workshopDraft: [] } };
}

test("only the reserved developer principal plus the separate server context enables exemption", () => {
  assert.equal(developerAuditExempt(context()), true);
  for (const trial of [
    context(employee, { developerAuditExempt: true }),
    context({ id: developer.id, username: employee.username }, { developerAuditExempt: true }),
    context({ id: employee.id, username: developer.username }, { developerAuditExempt: true }),
    context(developer, { developerAuditExempt: false }),
    context({ ...employee, isDeveloper: true, auditExempt: true }, { developerAuditExempt: false }),
    context(employee, { incognito: true, developerAuditExempt: false })
  ]) {
    assert.equal(developerAuditExempt(trial), false);
    const current = inventory(), candidate = structuredClone(current.state);
    candidate.developerAuditExempt = true;
    candidate.activityExcluded = true;
    candidate.movements.push({ ...movement(), activityExcluded: true, developerAuditExempt: true });
    const saved = prepareWarehouseSave(current, candidate, trial, Date.parse(timestamp));
    assert.equal(saved.state.movements[0].activityExcluded, undefined);
    assert.equal(saved.state.movements[0].developerAuditExempt, undefined);
    assert.equal(saved.state.developerAuditExempt, undefined);
    assert.equal(saved.state.activityExcluded, undefined);
    assert.equal(saved.state.auditEntries.length, 2);
    assert.equal(saved.state.auditEntries.at(-1).actor.userId, trial.actor.id);
  }
});

test("developer movements remain operational while adding no activity or altering prior employee history", () => {
  const current = inventory(), candidate = structuredClone(current.state);
  candidate.movements.push(movement());
  candidate.auditEntries = [];
  const saved = prepareWarehouseSave(current, candidate, context(), Date.parse(timestamp));
  assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
  assert.equal(saved.state.movements[0].activityExcluded, true);
  assert.equal(saved.state.movements[0].createdBy.userId, developer.id);
  assert.equal(saved.state.items[0].quantity - saved.state.movements[0].quantity, 6);
  for (const user of [
    { ...employee, permissions: ["equipment.read"] },
    { ...employee, permissions },
    { ...developer, permissions }
  ]) {
    const response = projectWarehousePayload(saved, user);
    assert.equal(response.state.movements[0].activityExcluded, true);
    assert.equal(response.state.movements[0].quantity, 2);
    assert.equal(response.state.movements[0].id, "new-operation");
    assert.equal(response.state.movements[0].createdBy, undefined);
    assert.equal(response.state.movements[0].notes, undefined);
    assert.doesNotMatch(JSON.stringify(response), /Dgiant|live-developer-dgiant/);
    assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
  }
});

test("developer corrections preserve employee attribution and every preexisting audit entry", () => {
  const current = inventory();
  current.state.movements.push({ ...movement("employee-original"), createdBy: { userId: employee.id, username: employee.username },
    registeredAt: "2026-11-20T18:00:00.000Z", updatedBy: { userId: employee.id }, updatedAt: "2026-11-21T18:00:00.000Z" });
  const candidate = structuredClone(current.state);
  candidate.movements[0].notes = "Developer correction";
  candidate.movements[0].createdBy = developer;
  candidate.movements[0].activityExcluded = true;
  const saved = prepareWarehouseSave(current, candidate, context(), Date.parse(timestamp));
  assert.deepEqual(saved.state.movements[0].createdBy, current.state.movements[0].createdBy);
  assert.deepEqual(saved.state.movements[0].updatedBy, current.state.movements[0].updatedBy);
  assert.equal(saved.state.movements[0].updatedAt, current.state.movements[0].updatedAt);
  assert.equal(saved.state.movements[0].activityExcluded, undefined);
  assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
});

test("employee changes to an excluded operation are audited and cannot clear the server marker", () => {
  const current = inventory(), initial = structuredClone(current.state);
  initial.movements.push(movement());
  const first = prepareWarehouseSave(current, initial, context(), Date.parse(timestamp));
  const response = projectWarehousePayload(first, { ...employee, permissions });
  const candidate = response.state;
  candidate.movements[0].quantity = 3;
  candidate.movements[0].activityExcluded = false;
  candidate.movements[0].createdBy = employee;
  const merged = mergeWarehousePrivateFields(first.state, candidate, { ...employee, permissions });
  const second = prepareWarehouseSave(first, merged, context(employee), Date.parse(timestamp) + 1000);
  assert.equal(second.state.movements[0].activityExcluded, true);
  assert.equal(second.state.movements[0].createdBy.userId, developer.id);
  assert.equal(second.state.auditEntries.length, first.state.auditEntries.length + 1);
  assert.equal(second.state.auditEntries.at(-1).actor.userId, employee.id);
  const projected = projectWarehousePayload(second, { ...employee, permissions });
  assert.doesNotMatch(JSON.stringify(projected), /Dgiant|live-developer-dgiant/);
  assert.equal(projected.state.auditEntries.at(-1).actor.userId, employee.id);
  assert.equal(projected.state.auditEntries.at(-1).after.quantity, 3);
});

test("developer stock receipts retain exact stock and idempotency but no new activity or exposed actor", () => {
  const current = inventory();
  const payload = { requestId: "synthetic-receipt", items: [{ description: "Synthetic speaker", category: "AUDIO", quantity: 3 }] };
  const ingress = applyStockIngress(current, payload, { actor: developer, timestamp });
  const saved = prepareWarehouseSave(current, ingress.state, context(developer, {
    ingressChanges: ingress.changes, stockReceipt: ingress.storedReceipt
  }), Date.parse(timestamp));
  assert.equal(saved.state.items[0].quantity, 11);
  assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
  assert.equal(saved.state.equipmentStockReceipts[0].activityExcluded, true);
  const projected = projectWarehousePayload(saved, { ...employee, permissions });
  assert.equal(projected.state.equipmentStockReceipts[0].requestId, payload.requestId);
  assert.equal(projected.state.equipmentStockReceipts[0].items[0].quantity, 3);
  assert.equal(projected.state.equipmentStockReceipts[0].actor, undefined);
  assert.doesNotMatch(JSON.stringify(projected), /Dgiant|live-developer-dgiant/);
  assert.equal(applyStockIngress(saved, payload).duplicate, true);
});

test("new developer import authorization is private while later employee imports keep their own attribution", () => {
  const current = inventory(), candidate = structuredClone(current.state);
  candidate.items[0].quantity = 10;
  candidate.importedSource = { fileName: "Current inventory.xlsx", authorization: {
    actor: developer, mode: "replace", confirmed: true, confirmedAt: timestamp
  } };
  const first = prepareWarehouseSave(current, candidate, context(), Date.parse(timestamp));
  assert.equal(first.state.importedSource.authorization.activityExcluded, true);
  const projected = projectWarehousePayload(first, { ...employee, permissions });
  assert.equal(projected.state.importedSource.authorization.actor, undefined);
  assert.equal(projected.state.importedSource.authorization.mode, "replace");
  assert.doesNotMatch(JSON.stringify(projected), /Dgiant|live-developer-dgiant/);
  projected.state.importedSource.authorization = { actor: employee, mode: "merge", confirmed: true,
    confirmedAt: "2026-11-22T20:01:00.000Z", activityExcluded: true };
  projected.state.items[0].quantity = 12;
  const merged = mergeWarehousePrivateFields(first.state, projected.state, { ...employee, permissions });
  const second = prepareWarehouseSave(first, merged, context(employee), Date.parse(timestamp) + 60000);
  assert.equal(second.state.importedSource.authorization.actor.id, employee.id);
  assert.equal(second.state.importedSource.authorization.activityExcluded, undefined);
  assert.equal(second.state.auditEntries.at(-1).actor.userId, employee.id);
});

test("the inventory UI excludes developer operations from logs and activity PDFs, keeping their stock effect", () => {
  const prints = [];
  const sandbox = { window: { LIVE_SESSION: { userId: employee.id, permissions } }, document: { readyState: "loading", addEventListener() {} } };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  vm.runInContext(source.replace('  if (document.readyState === "loading") {', `
    window.developerActivityTest = {
      initialize(value, controls, print) { state = normalizeState(value); Object.assign(elements, controls); openPrintDocument = print; },
      renderLog, printEventPdf, inventoryTotals, normalizeMovement, appendWarehouseMovement,
      state() { return state; }
    };
    if (document.readyState === "loading") {`), sandbox);
  const fixture = inventory().state;
  fixture.movements = [{ ...movement("hidden-dev"), activityExcluded: true }, { ...movement("visible-employee"), quantity: 1 }];
  const controls = { logList: { innerHTML: "" }, logTypeFilter: { value: "all" }, logSearch: { value: "" }, status: { dataset: {} } };
  const ui = sandbox.window.developerActivityTest;
  ui.initialize(fixture, controls, (title, html) => { prints.push({ title, html }); });
  ui.renderLog();
  assert.doesNotMatch(controls.logList.innerHTML, /hidden-dev/);
  assert.match(controls.logList.innerHTML, /visible-employee/);
  assert.equal(ui.inventoryTotals().physical, 5);
  assert.equal(ui.state().movements.length, 2);
  assert.equal(ui.state().movements[0].activityExcluded, true);
  sandbox.window.LIVE_SESSION = { ...developer, userId: developer.id, permissions, isDeveloper: true, auditExempt: true };
  ui.appendWarehouseMovement({ ...movement("local-dev-pending"), quantity: 1 });
  ui.renderLog();
  assert.doesNotMatch(controls.logList.innerHTML, /local-dev-pending/);
  assert.match(controls.logList.innerHTML, /visible-employee/);
  assert.equal(ui.inventoryTotals().physical, 4);
  assert.equal(ui.state().movements.at(-1).activityExcluded, undefined);
  ui.printEventPdf("Synthetic event");
  assert.equal(prints.length, 1);
  assert.equal((prints[0].html.match(/Salida de bodega/g) || []).length, 1);
});
