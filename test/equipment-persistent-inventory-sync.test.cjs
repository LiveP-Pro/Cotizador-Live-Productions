const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const imports = require("../warehouse-import-review.js");
const { createHarness, inventory } = require("./helpers/equipment-server-harness.cjs");

// All service, stock and persistence data are synthetic current sources. These
// checks read application code only, never bundled inventories or saved events.
const plain = value => JSON.parse(JSON.stringify(value));
const stock = (quantity = 7, savedAt = "2026-11-17T10:00:00Z") => ({ savedAt, state: {
  items: [{ id: "current-a", name: "Unidad vigente", category: "AUDIO", quantity, itemType: "equipo" }], movements: []
} });

function context(fetch = async () => ({ ok: false })) {
  const listeners = new Map();
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch,
    window: {
      location: { protocol: "https:", hash: "#requerimiento-equipo" },
      EquipmentIdentity: require("../equipment-identity.js"),
      requerimientoEquipoCatalog: { services: { current: {
        name: "Servicio sintético vigente", importSource: { authoritative: true, version: "current-file" },
        mainSections: [{ id: "current-audio", title: "Audio", importSource: { authoritative: true },
          items: [[3, "Unidad vigente"], [0, "Línea de fuente cero"]],
          rows: [{ type: "note", description: "Nota literal de la fuente vigente" }] }], extras: []
      } }, groups: [{ label: "Servicios", serviceIds: ["current"] }] },
      requerimientoEquipoInventory: { categories: [{ title: "Semilla sintética que no es la fuente remota", items: [
        { description: "Unidad empaquetada anterior", sourceRow: 1, value: 91 }
      ] }] },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: {
      querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener(name, callback) { listeners.set(name, callback); }, dispatchEvent() {}
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  return { sandbox, listeners, run: code => vm.runInContext(code, sandbox) };
}

function install(h, payload) {
  h.sandbox.syntheticPayload = plain(payload);
  return h.run("applyEquipmentWarehouseInventoryPayload(syntheticPayload)");
}

test("a fresh HTTP session never exposes packaged or manual stock when the current inventory GET fails", async () => {
  const h = context();
  h.run('equipmentState.inventory.set("legacy-row", "88"); setEquipmentServiceSelection(["current"]);');
  assert.deepEqual(plain(h.run("equipmentInventorySummaryCategories()")), []);
  assert.deepEqual(plain(h.run("equipmentInventoryChoiceCategories()")), []);
  assert.equal(h.run('inventoryValueFor({key:"legacy-row",description:"Unidad empaquetada anterior"})'), "");
  assert.equal(await h.run("refreshEquipmentWarehouseInventory()"), false);
  assert.deepEqual(plain(h.run("equipmentInventorySummaryCategories()")), []);
  const html = h.run("tableForEquipmentInventory(equipmentRowsSummary(), true)");
  assert.match(html, /readonly aria-readonly="true"/);
  assert.match(html, /Esperando el inventario actual de Contabilidad/);
  assert.ok(!html.includes("Unidad empaquetada anterior"));
  assert.ok(!html.includes('value="88"'));
  assert.ok(!html.includes('value="91"'));
  assert.deepEqual(plain(h.run("equipmentRentalRows()")), []);
  assert.match(h.run("equipmentRentReportValidationMessage()"), /inventario actual de Contabilidad/);
  assert.match(h.run("equipmentRentReportValidationMessage('purchase')"), /inventario actual de Contabilidad/);
});

test("the confirmed replacement remains the only stock source in fresh page and device contexts", async () => {
  const previous = { items: [
    { id: "current-a", name: "Unidad vigente", category: "AUDIO", quantity: 7, itemType: "equipo" },
    { id: "absent", name: "Artículo ausente del archivo actual", category: "AUDIO", quantity: 6, itemType: "equipo" }
  ], movements: [{ id: "repair", type: "taller", itemId: "current-a", quantity: 2 }], subtitles: ["AUDIO"] };
  const source = { source: "Archivo vigente sintético.xlsx", items: [
    { name: "Unidad vigente", category: "AUDIO", quantity: 0, sourceRow: 3 },
    { name: "Nuevo equipo vigente", category: "VIDEO", quantity: 4, sourceRow: 4 }
  ] };
  let id = 0;
  const stored = { savedAt: "2026-11-17T12:00:00Z", state: imports.finalize(
    imports.prepare(previous, source, { mode: "replace" }),
    { confirmedReplacement: true, createId: () => `new-${++id}` }
  ) };
  let gets = 0;
  for (let device = 0; device < 2; device++) {
    const h = context(async (url, options) => {
      assert.equal(url, "/api/inventario-bodega");
      assert.equal(options.cache, "no-store");
      gets++;
      return { ok: true, json: async () => plain(stored) };
    });
    h.run('setEquipmentServiceSelection(["current"]);');
    const before = h.run("JSON.stringify(equipmentServices)");
    assert.equal(await h.run("refreshEquipmentWarehouseInventory()"), true);
    const visible = plain(h.run("equipmentInventorySummaryCategories().flatMap(category => category.items.map(item => [item.description,item.value]))"));
    assert.deepEqual(visible, [["Unidad vigente", 0], ["Nuevo equipo vigente", 4]]);
    assert.equal(h.run("equipmentWarehouseInventoryState.recordsById.has('absent')"), false);
    assert.equal(h.run("JSON.stringify(equipmentServices)"), before);
    assert.deepEqual(plain(h.run("selectedEquipmentSections()[0].items.map(item=>[item.quantity,item.description])")), [[3,"Unidad vigente"],[0,"Línea de fuente cero"]]);
    assert.deepEqual(plain(h.run("selectedEquipmentSections()[0].rows")), [{ type: "note", description: "Nota literal de la fuente vigente" }]);
    assert.equal(h.run("equipmentRowsSummary().find(row=>row.description==='Unidad vigente').quantity"), 3);
  }
  assert.equal(gets, 2);
  assert.equal(stored.state.movements[0].id, "repair");
});

test("a retained summary row uses the new quantity and cannot retain archived or removed stock", () => {
  const h = context();
  h.run('setEquipmentServiceSelection(["current"]);');
  install(h, stock());
  h.run("const retained = equipmentRowsSummary().find(row=>row.description==='Unidad vigente');");
  assert.equal(h.run("inventoryValueFor(retained)"), 7);
  install(h, stock(0, "2026-11-17T11:00:00Z"));
  assert.equal(h.run("inventoryValueFor(retained)"), 0);
  const archived = stock(20, "2026-11-17T12:00:00Z"); archived.state.items[0].archived = true;
  install(h, archived);
  assert.equal(h.run("equipmentWarehouseInventoryRecordFor(retained)"), null);
  assert.equal(h.run("equipmentInventoryAvailableValueFor(retained)"), 0);
  install(h, { savedAt: "2026-11-17T13:00:00Z", state: { items: [], movements: [] } });
  assert.equal(h.run("inventoryValueFor(retained)"), 0);
  assert.deepEqual(plain(h.run("equipmentInventoryChoiceCategories()")), []);
});

test("accepted stock records are immutable snapshots of the published input until another payload is accepted", () => {
  const h = context();
  install(h, stock());
  h.run(`syntheticPayload.state.items[0].name="Nombre aún no confirmado";
    syntheticPayload.state.items[0].quantity=999;
    syntheticPayload.state.items[0].descriptionAliases=["Alias no confirmado"];`);
  assert.equal(h.run("equipmentWarehouseInventoryState.records[0].item.name"), "Unidad vigente");
  assert.equal(h.run("equipmentWarehouseInventoryState.records[0].item.quantity"), 7);
  assert.equal(h.run("equipmentWarehouseRecordsForDescription('Nombre aún no confirmado').length"), 0);
  assert.equal(h.run("equipmentWarehouseRecordsForDescription('Unidad vigente').length"), 1);
});

test("failed refreshes retain only the last confirmed remote inventory and later imports replace it atomically", async () => {
  const h = context();
  h.run('setEquipmentServiceSelection(["current"]);');
  install(h, stock(5));
  const snapshot = h.run("JSON.stringify(equipmentWarehouseInventoryState.records)");
  assert.equal(await h.run("refreshEquipmentWarehouseInventory()"), false);
  assert.equal(h.run("JSON.stringify(equipmentWarehouseInventoryState.records)"), snapshot);
  assert.ok(!h.run("JSON.stringify(equipmentInventorySummaryCategories())").includes("Unidad empaquetada anterior"));
  const next = { savedAt: "2026-11-17T15:00:00Z", state: { items: [
    { id: "new-model", name: "Otro modelo físico actual", category: "ILUMINACION", quantity: 0, itemType: "equipo" }
  ], movements: [] } };
  h.listeners.get("live:warehouse-server-updated")({ detail: next });
  assert.deepEqual(plain(h.run("equipmentWarehouseInventoryState.records.map(record=>[record.id,record.physical])")), [["new-model",0]]);
  assert.equal(h.run("equipmentWarehouseRecordsForDescription('Unidad vigente').length"), 0);
  assert.equal(h.run("equipmentRowsSummary().find(row=>row.description==='Unidad vigente').quantity"), 3);
});


test("an authorized file replacement survives backend reread and a separate Requerimiento session", async t => {
  const backend = createHarness(t);
  const original = inventory(8);
  original.state.items.push({ id: "prior-only", name: "Equipo retirado por archivo actual", category: "PRUEBA", quantity: 6 });
  backend.write("warehouseInventoryPath", original);
  const incoming = { source: "Inventario actual sintético.xlsx", items: [
    { name: "Unidad sintetica", category: "Prueba", quantity: 0 },
    { name: "Equipo agregado actual", category: "NUEVA", quantity: 4 }
  ] };
  const replacement = imports.finalize(imports.prepare(original.state, incoming, { mode: "replace" }),
    { confirmedReplacement: true, createId: () => "new-active" });
  const response = await backend.dispatch("PUT", "/api/inventario-bodega", {
    state: replacement, expectedSavedAt: original.savedAt, setAsInitial: true,
    importMode: "replace", confirmedImport: true
  });
  assert.equal(response.statusCode, 200);
  const restarted = createHarness(t);
  restarted.api.warehouseInventoryPath = backend.paths.warehouseInventoryPath;
  for (const reader of [backend, restarted]) {
    const h = context(async (url, options) => {
      assert.equal(url, "/api/inventario-bodega");
      assert.equal(options.cache, "no-store");
      const current = await reader.dispatch("GET", url);
      return { ok: current.statusCode === 200, json: async () => current.json() };
    });
    await h.run("initEquipmentWarehouseInventorySync()");
    assert.deepEqual(plain(h.run("equipmentWarehouseInventoryState.records.map(record=>[record.id,record.item.name,record.physical])")), [
      ["synthetic-unit", "Unidad sintetica", 0], ["new-active", "Equipo agregado actual", 4]
    ]);
    assert.equal(h.run("equipmentWarehouseInventoryState.recordsById.has('prior-only')"), false);
    assert.ok(!h.run("JSON.stringify(equipmentInventoryChoiceCategories())").includes("Unidad empaquetada"));
  }
});


test("a verified shared plan remains a stock source while pending local inventory never creates artificial rental rows", () => {
  const h = context();
  h.run(`equipmentSharedWorkspace.enabled=true;
    const currentPlan={description:"Unidad vigente",warehouseInventoryId:"current-a",category:"AUDIO",itemType:"equipo",
      quantity:3,required:3,capacity:1,missing:2,action:"RENTA",events:[],transfers:[]};
    equipmentSharedWorkspace.state={loaded:true,revision:4,plan:{revision:4,rows:[currentPlan]}};
    const reportRows=[{type:"item",key:"current-a",description:"Unidad vigente",quantity:3,
      eventQuantities:new Map(),sharedPlanning:currentPlan}];
    equipmentRowsSummary=()=>reportRows;`);
  assert.equal(h.run("equipmentWarehouseInventoryState.loaded"), false);
  assert.deepEqual(plain(h.run("equipmentRentalRows().map(row=>({quantity:row.quantity,inventory:row.inventory,missing:row.missing}))")),
    [{ quantity:3,inventory:1,missing:2 }]);
  assert.equal(h.run("equipmentRentReportValidationMessage()"), "");
  h.run("equipmentSharedWorkspace.state.stale=true;");
  assert.match(h.run("equipmentRentReportValidationMessage()"), /Actualice la agenda/);
  h.run("equipmentSharedWorkspace.state.stale=false;delete reportRows[0].sharedPlanning;");
  assert.deepEqual(plain(h.run("equipmentRentalRows()")), []);
});
