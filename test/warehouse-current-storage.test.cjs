const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const { createHarness, inventory } = require("./helpers/equipment-server-harness.cjs");

test("a healthy active inventory starts without requiring any initial source", (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPath", inventory(7));
  const before = fs.readFileSync(h.paths.warehouseInventoryPath);
  h.api.ensureWarehouseInventoryStorage();
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  assert.equal(fs.existsSync(h.paths.warehouseInventoryBackupPath), false);
});

test("another initial dataset never replaces or rewrites a healthy active inventory", (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPath", inventory(7, "active-current"));
  h.write("warehouseInventoryPrivateInitialPath", inventory(99, "different-initial"));
  const before = fs.readFileSync(h.paths.warehouseInventoryPath);
  h.api.ensureWarehouseInventoryStorage();
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  assert.equal(h.api.readWarehouseInventory().state.items[0].quantity, 7);
  assert.equal(fs.existsSync(h.paths.warehouseInventoryBackupPath), false);
});

test("an unreadable active inventory stops startup and reads without activating another source", (t) => {
  const h = createHarness(t);
  fs.writeFileSync(h.paths.warehouseInventoryPath, "{broken-active");
  h.write("warehouseInventoryPrivateInitialPath", inventory(99));
  h.write("warehouseInventoryBackupPath", inventory(88));
  assert.throws(() => h.api.ensureWarehouseInventoryStorage(), /inventario activo no se puede leer/);
  assert.throws(() => h.api.readWarehouseInventory(), /sin cargar otra fuente/);
  assert.equal(fs.readFileSync(h.paths.warehouseInventoryPath, "utf8"), "{broken-active");
});

test("a runtime read of a missing active file does not fall back to an initial inventory", (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPrivateInitialPath", inventory(99));
  assert.throws(() => h.api.readWarehouseInventory(), /inventario activo no se puede leer/);
  assert.equal(fs.existsSync(h.paths.warehouseInventoryPath), false);
});

test("first startup creates the absent active file from the selected current initial source", (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPrivateInitialPath", inventory(0, "selected-source"));
  h.write("warehouseInventoryOverrideInitialPath", inventory(99, "other-source"));
  h.api.ensureWarehouseInventoryStorage();
  const actual = h.api.readWarehouseInventory();
  assert.equal(actual.state.datasetId, "selected-source");
  assert.equal(actual.state.items[0].quantity, 0);
  assert.equal(fs.existsSync(h.paths.warehouseInventoryBackupPath), false);
});

test("an invalid first existing initial source never falls through to another file", (t) => {
  const h = createHarness(t);
  fs.writeFileSync(h.paths.warehouseInventoryPrivateInitialPath, "{broken-current-source");
  h.write("warehouseInventoryOverrideInitialPath", inventory(99));
  assert.throws(() => h.api.ensureWarehouseInventoryStorage());
  assert.equal(fs.existsSync(h.paths.warehouseInventoryPath), false);
});

test("a legacy file without savedAt has a stable mtime revision without being rewritten", (t) => {
  const h = createHarness(t);
  const payload = inventory(0);
  delete payload.savedAt;
  h.write("warehouseInventoryPath", payload);
  const timestamp = new Date("2026-10-16T10:12:14.000Z");
  fs.utimesSync(h.paths.warehouseInventoryPath, timestamp, timestamp);
  const before = fs.readFileSync(h.paths.warehouseInventoryPath);
  const first = h.api.readWarehouseInventory();
  h.advance(60000);
  const second = h.api.readWarehouseInventory();
  assert.equal(first.savedAt, timestamp.toISOString());
  assert.equal(first.savedAt, second.savedAt);
  assert.equal(second.state.items[0].quantity, 0);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  assert.equal(fs.statSync(h.paths.warehouseInventoryPath).mtime.toISOString(), timestamp.toISOString());
});

test("authenticated inventory PUT requires a nonempty revision and rejects stale snapshots unchanged", async (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPath", inventory(7));
  const before = fs.readFileSync(h.paths.warehouseInventoryPath);
  for (const revision of [undefined, null, "", "  ", 123]) {
    const response = await h.dispatch("PUT", "/api/inventario-bodega", { state: inventory(99).state, expectedSavedAt: revision });
    assert.equal(response.statusCode, 428);
  }
  const stale = await h.dispatch("PUT", "/api/inventario-bodega", { state: inventory(99).state, expectedSavedAt: "obsolete-revision" });
  assert.equal(stale.statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  assert.equal(fs.existsSync(h.paths.warehouseInventoryBackupPath), false);
});

test("an inventory PUT without authentication cannot read or change stock", async (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPath", inventory(7));
  const before = fs.readFileSync(h.paths.warehouseInventoryPath);
  const response = await h.dispatch("PUT", "/api/inventario-bodega", inventory(99), { auth: false });
  assert.equal(response.statusCode, 401);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
});

test("queued updates against the same revision commit once and retain server-owned evidence", async (t) => {
  const h = createHarness(t);
  const active = inventory(7);
  active.state.auditEntries = [{ id: "synthetic-audit", description: "Original evidence" }];
  active.state.equipmentStockReceipts = [{ requestId: "synthetic-receipt", items: [] }];
  h.write("warehouseInventoryPath", active);
  const expectedSavedAt = (await h.dispatch("GET", "/api/inventario-bodega")).json().savedAt;
  const responses = await Promise.all([9, 99].map((quantity) => h.dispatch("PUT", "/api/inventario-bodega", {
    state: inventory(quantity).state, expectedSavedAt
  })));
  assert.deepEqual(responses.map((response) => response.statusCode), [200, 409]);
  const saved = h.api.readWarehouseInventory();
  assert.equal(saved.state.items[0].quantity, 9);
  assert.notEqual(saved.savedAt, expectedSavedAt);
  assert.equal(saved.state.auditEntries[0].id, "synthetic-audit");
  assert.equal(saved.state.equipmentStockReceipts[0].requestId, "synthetic-receipt");
});

test("the stable revision of a legacy file can be used to save rather than conflict forever", async (t) => {
  const h = createHarness(t);
  const payload = inventory(0);
  delete payload.savedAt;
  h.write("warehouseInventoryPath", payload);
  const before = (await h.dispatch("GET", "/api/inventario-bodega")).json();
  h.advance(120000);
  const response = await h.dispatch("PUT", "/api/inventario-bodega", { state: inventory(4).state, expectedSavedAt: before.savedAt });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().state.items[0].quantity, 4);
});

test("equipment stock ingress remains atomic and idempotent without a PUT revision", async (t) => {
  const h = createHarness(t);
  h.write("warehouseInventoryPath", inventory(2));
  const before = (await h.dispatch("GET", "/api/inventario-bodega")).json();
  const payload = { requestId: "synthetic-stock-ingress", event: { id: "synthetic-event", name: "Prueba", date: "2026-10-17" },
    items: [{ description: "Unidad sintetica", category: "Prueba", quantity: 3 }] };
  const first = await h.dispatch("POST", "/api/inventario-bodega/ingresos-desde-equipo", payload);
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().state.items[0].quantity, 5);
  assert.equal(first.json().receipt.duplicate, false);
  const retried = await h.dispatch("POST", "/api/inventario-bodega/ingresos-desde-equipo", payload);
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.json().state.items[0].quantity, 5);
  assert.equal(retried.json().receipt.duplicate, true);
  assert.equal(retried.json().state.equipmentStockReceipts.length, 1);
  const stale = await h.dispatch("PUT", "/api/inventario-bodega", { state: before.state, expectedSavedAt: before.savedAt });
  assert.equal(stale.statusCode, 409);
  assert.equal(h.api.readWarehouseInventory().state.items[0].quantity, 5);
});
