const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const test = require("node:test");
const { authoritativeSeed, planAuthoritativeSeed, protectedWarehouseMetadata, warehouseSourceStatus } = require("../warehouse-authoritative-seed.cjs");

function fixture() {
  const current = { savedAt: "2026-10-13T10:00:00.000Z", state: {
    datasetId: "synthetic-prior", items: [{ id: "prior-item", name: "Nombre previo sintético", category: "AUDIO", quantity: 99 }],
    movements: [{ id: "prior-movement", itemId: "prior-item", itemName: "Nombre previo sintético", type: "salida", quantity: 5 }],
    historicalMovements: [{ id: "older-movement", itemId: "older-item", itemName: "Historia sintética", type: "taller", quantity: 1 }],
    auditEntries: [{ id: "prior-audit", action: "ingreso" }], equipmentStockReceipts: [{ requestId: "prior-receipt", fingerprint: "synthetic", items: [] }]
  } };
  const seed = { savedAt: "2026-10-13T11:00:00.000Z", state: {
    authoritativeInventorySource: true, datasetId: "synthetic-source-20261013-L", version: 4,
    inventorySource: { spreadsheetId: "synthetic-spreadsheet", sheetId: 862474686, quantityColumn: "L", sourceHash: "synthetic-source-hash" },
    items: [{ id: "synthetic-source-20261013-L-row1", name: "Equipo fuente A", category: "AUDIO", quantity: 0, itemType: "equipo" },
      { id: "synthetic-source-20261013-L-row2", name: "Equipo fuente B", category: "VIDEO", quantity: 7, itemType: "equipo" }],
    approvedNameAliases: [{ alias: "Equipo typo fuente B", itemId: "synthetic-source-20261013-L-row2" }],
    sourceCells: [{ ref: "synthetic!L1", value: 0 }, { ref: "synthetic!L2", value: 7 }], movements: [], auditEntries: [], equipmentStockReceipts: []
  } };
  return { current, seed };
}

test("authoritative seed keeps only current source stock, archives old movements and preserves immutable history", () => {
  const { current, seed } = fixture();
  const original = structuredClone(current);
  const result = planAuthoritativeSeed(current, seed, Date.parse(current.savedAt));
  assert.equal(result.applied, true);
  assert.deepEqual(result.saved.state.items, seed.state.items);
  assert.deepEqual(result.saved.state.movements, []);
  assert.equal(result.saved.state.historicalMovements.length, 2);
  assert.equal(result.saved.state.historicalMovements[1].id, "prior-movement");
  assert.equal(result.saved.state.historicalMovements[1].quantity, 5);
  assert.deepEqual(result.saved.state.equipmentStockReceipts, current.state.equipmentStockReceipts);
  assert.equal(result.saved.state.auditEntries[0].id, "prior-audit");
  assert.ok(!result.saved.state.auditEntries.some((entry) => entry.action === "eliminacion_bitacora"));
  assert.equal(result.saved.state.auditEntries.at(-1).action, "actualizacion_fuente");
  assert.deepEqual(result.saved.state.approvedNameAliases, seed.state.approvedNameAliases);
  assert.deepEqual(result.saved.state.sourceCells, seed.state.sourceCells);
  assert.ok(Date.parse(result.saved.savedAt) > Date.parse(current.savedAt));
  assert.deepEqual(current, original);
});

test("the durable marker prevents baseline reapplication after edits, imports and server restarts", () => {
  const { current, seed } = fixture();
  const first = planAuthoritativeSeed(current, seed).saved;
  first.state.items[1].quantity = 4;
  first.state.datasetId = "synthetic-user-import";
  const restarted = planAuthoritativeSeed(first, seed);
  assert.equal(restarted.applied, false);
  assert.equal(restarted.saved.state.items[1].quantity, 4);
  const differentSource = structuredClone(seed);
  differentSource.state.inventorySource.sourceHash = "new-content-reusing-version";
  assert.throws(() => planAuthoritativeSeed(first, differentSource), /dataset ya aplicado cambió/);
});

test("ordinary saves preserve markers, archive and source metadata even when omitted or forged", () => {
  const { current, seed } = fixture();
  const applied = planAuthoritativeSeed(current, seed).saved;
  const candidate = { items: structuredClone(applied.state.items), movements: [],
    appliedInventorySources: [], historicalMovements: [{ id: "forged" }],
    inventorySource: { spreadsheetId: "forged" }, sourceCells: [{ ref: "forged", value: 9 }], approvedNameAliases: [{ alias: "forged", itemId: "forged" }] };
  const safe = protectedWarehouseMetadata(applied, candidate);
  assert.deepEqual(safe.appliedInventorySources, applied.state.appliedInventorySources);
  assert.deepEqual(safe.historicalMovements, applied.state.historicalMovements);
  assert.deepEqual(safe.inventorySource, seed.state.inventorySource);
  assert.deepEqual(safe.sourceCells, seed.state.sourceCells);
  assert.deepEqual(safe.approvedNameAliases, seed.state.approvedNameAliases);
});

test("source status exposes only metadata and verifies all source rows including zeros", () => {
  const { current, seed } = fixture();
  const applied = planAuthoritativeSeed(current, seed).saved;
  const status = warehouseSourceStatus(applied, seed, "synthetic-code-version");
  assert.deepEqual(Object.keys(status).sort(), ["agreesWithSource", "applied", "datasetId", "sourceHash", "sourceId", "version"].sort());
  assert.equal(status.applied, true);
  assert.equal(status.agreesWithSource, true);
  assert.ok(!JSON.stringify(status).includes("Equipo fuente"));
  applied.state.items[0].quantity = 1;
  assert.equal(warehouseSourceStatus(applied, seed, "synthetic").agreesWithSource, false);
});

test("invalid source rows or reused historical identities stop migration without mutating any state", () => {
  const { current, seed } = fixture();
  for (const change of [s => s.items[0].quantity = -1, s => s.items[0].id = "prior-item",
    s => s.items[1].id = s.items[0].id, s => s.inventorySource.quantityColumn = "G"]) {
    const invalid = structuredClone(seed);
    change(invalid.state);
    assert.throws(() => planAuthoritativeSeed(current, invalid));
  }
  assert.equal(current.state.items[0].quantity, 99);
});

function storageHarness(current, seed, privateSeed = current) {
  const files = new Map([["/synthetic/current.json", JSON.stringify(current)], ["/synthetic/bundled.json", JSON.stringify(seed)]]);
  if (privateSeed) files.set("/synthetic/private.json", JSON.stringify(privateSeed));
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const context = { crypto, path, authoritativeSeed, planAuthoritativeSeed, Date, process: { pid: 1 },
    dataDir: "/synthetic", warehouseInventoryPath: "/synthetic/current.json", warehouseInventoryPrivateInitialPath: "/synthetic/private.json",
    warehouseInventoryOverrideInitialPath: "", warehouseInventoryBundledInitialPath: "/synthetic/bundled.json", warehouseInventoryBackupPath: "/synthetic/backup.json",
    console: { log() {}, warn() {} }, fs: {
      existsSync(file) { return files.has(file); }, readFileSync(file) { return files.get(file); },
      copyFileSync(from, to) { files.set(to, files.get(from)); }, writeFileSync(file, content) { files.set(file, content); },
      renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); }
    } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf("function normalizeWarehouseInventoryPayload("), source.indexOf("async function writeWarehouseInventoryFile(")), context);
  return { files, context, read(file = "/synthetic/current.json") { return JSON.parse(files.get(file)); } };
}

test("startup prioritizes the authorized deployment seed over private initial data and backs up both before replacing", () => {
  const { current, seed } = fixture();
  const harness = storageHarness(current, seed);
  harness.context.ensureWarehouseInventoryStorage();
  const applied = harness.read();
  assert.equal(applied.state.datasetId, seed.state.datasetId);
  assert.deepEqual(applied.state.items.map((item) => item.quantity), [0, 7]);
  assert.deepEqual(harness.read("/synthetic/private.json"), applied);
  const backupFiles = [...harness.files.keys()].filter((file) => file.includes("inventario-bodega-antes-"));
  assert.equal(backupFiles.length, 2);
  for (const file of backupFiles) assert.deepEqual(harness.read(file), current);
  applied.state.items[1].quantity = 9;
  harness.files.set("/synthetic/current.json", JSON.stringify(applied));
  harness.context.ensureWarehouseInventoryStorage();
  assert.equal(harness.read().state.items[1].quantity, 9);
  assert.equal(harness.read().state.historicalMovements.length, 2);
});

test("unreadable active inventory stops startup migration before any backup or replacement", () => {
  const { current, seed } = fixture();
  const harness = storageHarness(current, seed);
  harness.files.set("/synthetic/current.json", "unreadable synthetic file");
  const before = new Map(harness.files);
  assert.throws(() => harness.context.ensureWarehouseInventoryStorage());
  assert.deepEqual(harness.files, before);
});

test("the public metadata endpoint never exposes row data even when a parse error contains sensitive row text", async () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.indexOf('    if (request.method === "GET" && url.pathname === "/api/inventario-bodega/fuente-estado")');
  const end = source.indexOf('\n    if (request.method === "GET" && url.pathname === "/api/sesion")', start);
  assert.ok(start > 0 && end > start);
  let result;
  const context = { request: { method: "GET" }, url: { pathname: "/api/inventario-bodega/fuente-estado" },
    response: { setHeader() {} }, warehouseAssetVersion: "synthetic-version", warehouseInventoryBundledInitialPath: "synthetic",
    fs: { existsSync() { return true; } }, readWarehouseInventoryFile() { throw new Error("Equipo confidencial de prueba en JSON corrupto"); },
    readWarehouseInventory() { throw new Error("Equipo confidencial de prueba"); }, warehouseSourceStatus,
    jsonResponse(res, status, data) { result = { status, data }; } };
  vm.createContext(context);
  vm.runInContext(`(function(){${source.slice(start, end)}})()`, context);
  assert.equal(result.status, 503);
  assert.deepEqual(Object.keys(result.data).sort(), ["agreesWithSource", "applied", "datasetId", "sourceHash", "sourceId", "version"].sort());
  assert.ok(!JSON.stringify(result).includes("Equipo confidencial"));
});
