const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { Writable } = require("node:stream");
const { finished } = require("node:stream/promises");
const ledger = require("../../warehouse-ledger.cjs");
const serviceReader = require("../../equipment-service-import.cjs");

const source = fs.readFileSync(path.join(__dirname, "..", "..", "server.js"), "utf8");
const names = [
  "normalizeWarehouseInventoryPayload", "readWarehouseInventoryFile", "warehouseInventoryInitialPaths",
  "readWarehouseInventoryInitial", "readWarehouseInventory", "warehouseInventoryDatasetId",
  "warehouseInventoryMigrationBackupPath", "replaceWarehouseInventorySync", "ensureWarehouseInventoryStorage",
  "writeWarehouseInventoryFile", "warehouseAuditActor", "writeWarehouseInventory", "persistWarehouseInventory",
  "saveWarehouseInventory", "ingressEquipmentStock", "normalizeEquipmentBaseCatalogVersion",
  "emptyEquipmentCatalogOverrides", "normalizeEquipmentCatalogItems", "normalizeEquipmentCatalogSections",
  "normalizeEquipmentCatalogAudioOptions", "normalizeEquipmentCatalogOverride", "readEquipmentCatalogOverridesFile",
  "readEquipmentCatalogOverrides", "readEquipmentCatalogOverridesForVersion", "writeEquipmentCatalogOverrides",
  "saveEquipmentCatalogOverride", "equipmentImportSlug", "currentEquipmentBaseCatalog", "currentEquipmentImportCatalog",
  "equipmentImportBookKey", "equipmentImportBookServices", "equipmentImportOwner", "pruneEquipmentImportPreviews",
  "previewEquipmentServiceFile", "saveImportedEquipmentServices", "downloadEquipmentServiceSource",
  "jsonResponse", "errorResponse", "requireAuth", "enqueueSave", "handleRequest"
];
function functionSource(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  if (start < 0) throw new Error(`Missing server function: ${name}`);
  const end = source.indexOf("\n}", start);
  if (end < 0) throw new Error(`Missing server function boundary: ${name}`);
  return source.slice(start, end + 2);
}

class Response extends Writable {
  constructor() { super(); this.chunks = []; this.statusCode = 0; this.headers = {}; }
  _write(chunk, encoding, done) { this.chunks.push(Buffer.from(chunk)); done(); }
  writeHead(status, headers) { this.statusCode = status; this.headers = headers; return this; }
  get body() { return Buffer.concat(this.chunks); }
  json() { return JSON.parse(this.body.toString("utf8")); }
}

function createHarness(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "equipment-current-server-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const paths = {
    warehouseInventoryPath: path.join(dir, "active.json"),
    warehouseInventoryBackupPath: path.join(dir, "previous.json"),
    warehouseInventoryPrivateInitialPath: path.join(dir, "initial-current.json"),
    warehouseInventoryOverrideInitialPath: path.join(dir, "initial-override.json"),
    warehouseInventoryBundledInitialPath: path.join(dir, "initial-bundled.json"),
    equipmentCatalogOverridesPath: path.join(dir, "catalog-current.json"),
    equipmentCatalogOverridesBackupPath: path.join(dir, "catalog-previous.json"),
    equipmentServiceSourcesDir: path.join(dir, "sources-current")
  };
  let now = Date.parse("2026-10-17T12:00:00.000Z");
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const context = vm.createContext({
    fs, fsp: fs.promises, path, crypto, Buffer, URL, Date: Clock,
    process: { pid: process.pid }, console: { warn() {}, log() {} },
    rootDir: dir, dataDir: dir, ...paths, ...ledger, ...serviceReader,
    equipmentServiceImportPreviews: new Map(), activeWarehouseImports: 0,
    maxWarehouseImportBytes: 15 * 1024 * 1024, maxServicePreviewBytes: 64 * 1024 * 1024,
    saveQueue: Promise.resolve(),
    authenticatedUser: (request) => request.user || null,
    parseCookies: (request) => ({ cotizador_session: request.owner || "synthetic-owner" }),
    readJsonBody: async (request) => request.payload
  });
  vm.runInContext(names.map(functionSource).join("\n\n"), context, { filename: "server.js" });
  const write = (name, value) => fs.writeFileSync(paths[name] || path.join(dir, name), JSON.stringify(value));
  fs.writeFileSync(path.join(dir, "equipment-catalog.js"), "window.requerimientoEquipoCatalog = " + JSON.stringify({
    version: "synthetic-current", groups: [{ id: "audio", label: "Audio", serviceIds: [] }], services: {}
  }) + ";");
  async function dispatch(method, url, payload, options = {}) {
    const response = new Response();
    const body = options.body;
    const request = { method, url, payload, headers: { host: "synthetic.local", ...(options.headers || {}) },
      user: options.auth === false ? null : "Synthetic tester", owner: options.owner || "synthetic-owner",
      async *[Symbol.asyncIterator]() { if (body) yield body; } };
    await context.handleRequest(request, response);
    await finished(response);
    return response;
  }
  return { dir, paths, api: context, write, dispatch, advance: (ms) => { now += ms; } };
}

function inventory(quantity = 2, datasetId = "synthetic-active") {
  return { savedAt: "2026-10-17T10:00:00.000Z", state: { datasetId,
    items: [{ id: "synthetic-unit", name: "Unidad sintetica", category: "Prueba", quantity }], movements: [] } };
}

module.exports = { createHarness, inventory };
