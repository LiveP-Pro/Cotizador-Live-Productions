const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHarness, inventory } = require("./helpers/equipment-server-harness.cjs");

// Synthetic server state only. The user workbook and production warehouse are
// never read or written by these authorization/concurrency checks.
const clone = value => JSON.parse(JSON.stringify(value));

function currentInventory() {
  const current = inventory(5);
  current.state.movements = [{ id: "synthetic-workshop", itemId: "synthetic-unit", type: "taller", quantity: 2,
    warehouseSignature: "data:image/png;base64,c3ludGhldGlj", notes: "Firma y nota sintéticas",
    customCurrentEvidence: { reviewedBy: "Operador sintético", line: [0, 2] } }];
  current.state.auditEntries = [{ id: "synthetic-original-audit", description: "Evidencia original" }];
  current.state.equipmentStockReceipts = [{ requestId: "synthetic-original-receipt", items: [] }];
  return current;
}

function candidateFrom(current, quantity = 3) {
  const candidate = clone(current.state);
  candidate.items[0].quantity = quantity;
  candidate.movements = [{ id: "synthetic-forged-movement", itemId: "synthetic-unit", type: "salida", quantity: 999 }];
  candidate.auditEntries = [];
  candidate.equipmentStockReceipts = [];
  candidate.importedSource = { source: "Archivo sintético actual.xlsx", sourceCells: [{ address: "B3", value: 3 }],
    correctionDecisions: [{ sourceRow: 3, action: "quantity", value: 3 }],
    authorization: { mode: "forged", actor: { name: "Autor falso" }, confirmedAt: "1900-01-01T00:00:00.000Z" } };
  return candidate;
}

test("file import without literal consent is rejected without rewriting inventory, backups or initial data", async t => {
  const h = createHarness(t);
  const before = currentInventory();
  h.write("warehouseInventoryPath", before);
  const bytes = fs.readFileSync(h.paths.warehouseInventoryPath);
  const files = fs.readdirSync(h.dir).sort();
  for (const consent of [undefined, null, false, "true", 1]) {
    const response = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidateFrom(before),
      expectedSavedAt: before.savedAt, setAsInitial: true, importMode: "replace", confirmedImport: consent });
    assert.equal(response.statusCode, 400);
    assert.match(response.json().error, /Confirme expresamente/);
    assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), bytes);
    assert.deepEqual(fs.readdirSync(h.dir).sort(), files);
  }
});

test("unknown import modes and unauthenticated file changes cannot alter current stock", async t => {
  const h = createHarness(t);
  const before = currentInventory();
  h.write("warehouseInventoryPath", before);
  const bytes = fs.readFileSync(h.paths.warehouseInventoryPath);
  for (const mode of ["", "erase", null, 12]) {
    const response = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidateFrom(before),
      expectedSavedAt: before.savedAt, importMode: mode, confirmedImport: true });
    assert.equal(response.statusCode, 400);
  }
  const anonymous = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidateFrom(before),
    expectedSavedAt: before.savedAt, importMode: "replace", confirmedImport: true }, { auth: false });
  assert.equal(anonymous.statusCode, 401);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), bytes);
  assert.equal(fs.existsSync(h.paths.warehouseInventoryBackupPath), false);
});

test("confirmed merge and replacement preserve server movements exactly and record the real authorization", async t => {
  for (const mode of ["merge", "replace"]) {
    const h = createHarness(t);
    const before = currentInventory();
    h.write("warehouseInventoryPath", before);
    const candidate = candidateFrom(before);
    const response = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidate,
      expectedSavedAt: before.savedAt, setAsInitial: true, importMode: mode, confirmedImport: true });
    assert.equal(response.statusCode, 200);
    const saved = response.json();
    assert.equal(saved.state.items[0].quantity, 3);
    assert.deepEqual(saved.state.movements, before.state.movements);
    assert.deepEqual(saved.state.equipmentStockReceipts, before.state.equipmentStockReceipts);
    assert.equal(saved.state.auditEntries[0].id, "synthetic-original-audit");
    assert.deepEqual(saved.state.importedSource.sourceCells, candidate.importedSource.sourceCells);
    assert.deepEqual(saved.state.importedSource.correctionDecisions, candidate.importedSource.correctionDecisions);
    const authorization = saved.state.importedSource.authorization;
    assert.equal(authorization.mode, mode);
    assert.equal(authorization.confirmed, true);
    assert.equal(authorization.actor.username, "Synthetic tester");
    assert.equal(authorization.actor.name, "Synthetic tester");
    assert.equal(authorization.confirmedAt, new h.api.Date().toISOString());
    assert.ok(Date.parse(authorization.confirmedAt) <= Date.parse(saved.savedAt));
    assert.notEqual(authorization.actor.name, "Autor falso");
    assert.deepEqual(JSON.parse(fs.readFileSync(h.paths.warehouseInventoryBackupPath)), before);
    assert.deepEqual(JSON.parse(fs.readFileSync(h.paths.warehouseInventoryPrivateInitialPath)).state.movements, before.state.movements);
  }
});

test("a changed inventory revision rejects even a confirmed replacement without overwriting the newer source", async t => {
  const h = createHarness(t);
  const before = currentInventory();
  h.write("warehouseInventoryPath", before);
  const first = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidateFrom(before, 7),
    expectedSavedAt: before.savedAt, importMode: "replace", confirmedImport: true });
  assert.equal(first.statusCode, 200);
  const active = fs.readFileSync(h.paths.warehouseInventoryPath);
  const backup = fs.readFileSync(h.paths.warehouseInventoryBackupPath);
  const stale = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidateFrom(before, 99),
    expectedSavedAt: before.savedAt, importMode: "replace", confirmedImport: true });
  assert.equal(stale.statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), active);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryBackupPath), backup);
});

test("an authorized JSON restore may restore its own ledgers while ordinary edits keep their existing endpoint contract", async t => {
  for (const mode of ["restore", undefined]) {
    const h = createHarness(t);
    const before = currentInventory();
    h.write("warehouseInventoryPath", before);
    const candidate = candidateFrom(before);
    const response = await h.dispatch("PUT", "/api/inventario-bodega", { state: candidate,
      expectedSavedAt: before.savedAt, ...(mode ? { importMode: mode, confirmedImport: true } : {}) });
    assert.equal(response.statusCode, 200);
    const saved = response.json();
    assert.deepEqual(saved.state.movements, candidate.movements);
    assert.deepEqual(saved.state.equipmentStockReceipts, before.state.equipmentStockReceipts);
    assert.equal(saved.state.auditEntries[0].id, "synthetic-original-audit");
    if (mode) assert.equal(saved.state.importedSource.authorization.mode, "restore");
  }
});
