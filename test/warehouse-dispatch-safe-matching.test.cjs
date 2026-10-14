const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const test = require("node:test");

function createHarness(items, approvedNameAliases = []) {
  let inventory = { state: { items: structuredClone(items), approvedNameAliases: structuredClone(approvedNameAliases), movements: [] }, savedAt: "2026-10-13T10:00:00.000Z" };
  const context = { crypto, Date, Map, Set, console,
    warehouseAuditActor() { return { id: "synthetic-user", username: "Usuario sintético" }; },
    readWarehouseInventory() { return structuredClone(inventory); },
    async writeWarehouseInventory(saved) { inventory = structuredClone(saved); }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.indexOf("function warehouseDispatchLookupKey(");
  const end = source.indexOf("async function saveEquipmentBoard(", start);
  vm.runInContext(source.slice(start, end), context);
  return {
    async ingest(lines) {
      return JSON.parse(JSON.stringify(await context.receiveEquipmentBoardInWarehouse({ mode: "full", warehouseDispatch: {
        id: "synthetic-board", eventId: "synthetic-event", name: "Evento sintético", place: "Lugar sintético", eventDate: "2026-10-13", items: lines
      } }, { fileName: "synthetic.pdf", jsonFileName: "synthetic.json", pdfUrl: "/test/synthetic.pdf", jsonUrl: "/test/synthetic.json" })));
    },
    state() { return structuredClone(inventory.state); },
    available(id) { return context.warehouseAvailableForDispatch(inventory.state, id); },
    candidates(line) { return context.warehouseDispatchCandidates(line, context.warehouseDispatchInventoryLookup(inventory.state)).map((item) => item.id); }
  };
}
function stock(id, name, category = "AUDIO", quantity = 10, additional = {}) { return { id, name, category, quantity, itemType: "equipo", ...additional }; }
function line(description, additional = {}) { return { description, quantity: 2, ...additional }; }

test("feet, inches, punctuation, AC/DC models, number and consumable suffix identify separate physical equipment", async () => {
  const items = [stock("inches", 'Pedestal 12"'), stock("feet", "Pedestal 12'"), stock("ac", "Fuente AC/DC-12"),
    stock("dc", "Fuente AC-DC/12"), stock("model12", "Modelo 12"), stock("model120", "Modelo 120"),
    stock("punctuation", "Modelo No. 2"), stock("other-punctuation", "Modelo No 2"),
    stock("consumable", "Cinta / consumible", "AUDIO", 10, { itemType: "consumible" }), stock("plain", "Cinta")];
  const harness = createHarness(items);
  const result = await harness.ingest([line('Pedestal 12"'), line("Fuente AC/DC-12"), line("Modelo 12"), line("Modelo No. 2"), line("Cinta")]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 10);
  assert.deepEqual(harness.state().movements.map((movement) => movement.itemId), ["inches", "ac", "model12", "punctuation", "plain"]);
  for (const id of ["feet", "dc", "model120", "other-punctuation", "consumable"]) assert.equal(harness.available(id), 10, id);
  assert.equal(result.warehouseReceipt.consumedQuantity, 0);
});

test("only case, accents and whitespace are normalized for literal current names", async () => {
  const harness = createHarness([stock("console", "Consola ÁC/DC 12\"", "AUDIO")]);
  const result = await harness.ingest([line('  CONSOLA   AC/DC 12" ') ]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 2);
  assert.equal(harness.available("console"), 8);
});

test("a mismatching existing explicit ID never reserves stock even when the requested name exists elsewhere", async () => {
  const harness = createHarness([stock("inches", 'Pedestal 12"'), stock("feet", "Pedestal 12'")]);
  const result = await harness.ingest([line('Pedestal 12"', { warehouseInventoryId: "feet", warehouseItemIds: ["inches"] })]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 0);
  assert.equal(result.warehouseReceipt.unmappedQuantity, 2);
  assert.equal(harness.available("inches"), 10);
  assert.equal(harness.available("feet"), 10);
  assert.equal(harness.state().movements[0].sourceUnmatched, true);
});

test("a missing old ID resolves only a singleton current name or approved alias", async () => {
  const harness = createHarness([stock("current", "Equipo actual")], [{ alias: "Equipo typo actual", itemId: "current" }]);
  const result = await harness.ingest([line("Equipo typo actual", { warehouseInventoryId: "missing-old-id" })]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 2);
  assert.equal(harness.state().movements[0].itemId, "current");
  assert.equal(harness.available("current"), 8);
});

test("legacy source keys and per-item aliases are ignored while current approved aliases are accepted", async () => {
  const harness = createHarness([stock("current", "Equipo actual", "AUDIO", 10,
    { sourceKey: "Nombre anterior", descriptionAliases: ["Alias anterior"] })], [{ alias: "Typo actual aprobado", itemId: "current" }]);
  const result = await harness.ingest([line("Nombre anterior"), line("Alias anterior"), line("Typo actual aprobado")]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 2);
  assert.equal(result.warehouseReceipt.unmappedQuantity, 4);
  assert.deepEqual(harness.state().movements.map((movement) => movement.itemId), ["", "", "current"]);
});

test("approved aliases cannot shadow another current literal name or target a missing or archived item", async () => {
  const harness = createHarness([stock("a", "Equipo A"), stock("b", "Equipo B"), stock("archived", "Equipo archivado", "AUDIO", 10, { archived: true })],
    [{ alias: "Equipo B", itemId: "a" }, { alias: "Alias sin target", itemId: "missing" }, { alias: "Alias archivado", itemId: "archived" }]);
  const result = await harness.ingest([line("Equipo B"), line("Alias sin target"), line("Alias archivado")]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 2);
  assert.equal(harness.available("a"), 10);
  assert.equal(harness.available("b"), 8);
});

test("ambiguous homonyms never distribute a requirement across separate physical records", async () => {
  const items = [stock("a", "Equipo repetido"), stock("b", "Equipo repetido")];
  for (const additional of [{}, { warehouseItemIds: ["a", "b"] }, { warehouseInventoryId: "missing" }]) {
    const harness = createHarness(items);
    const result = await harness.ingest([line("Equipo repetido", additional)]);
    assert.equal(result.warehouseReceipt.mappedQuantity, 0);
    assert.equal(result.warehouseReceipt.unmappedQuantity, 2);
    assert.equal(harness.available("a"), 10);
    assert.equal(harness.available("b"), 10);
  }
});

test("a category disambiguates only when it yields exactly one current record", async () => {
  const items = [stock("audio", "Equipo repetido", "AUDIO"), stock("video", "Equipo repetido", "VIDEO"), stock("another-video", "Equipo repetido", "VIDEO")];
  const resolved = createHarness(items);
  assert.equal((await resolved.ingest([line("Equipo repetido", { category: "audio" })])).warehouseReceipt.mappedQuantity, 2);
  assert.equal(resolved.available("audio"), 8);
  const ambiguous = createHarness(items);
  assert.equal((await ambiguous.ingest([line("Equipo repetido", { category: "VIDEO" })])).warehouseReceipt.mappedQuantity, 0);
  const unique = createHarness([stock("unique", "Nombre único", "AUDIO")]);
  assert.equal((await unique.ingest([line("Nombre único", { category: "Título diferente del cuadro" })])).warehouseReceipt.mappedQuantity, 2);
});

test("ambiguous consumable candidates never change a line to consumption", async () => {
  const harness = createHarness([stock("equipment", "Equipo repetido"), stock("consumable", "Equipo repetido", "AUDIO", 10, { itemType: "consumible" })]);
  const result = await harness.ingest([line("Equipo repetido")]);
  assert.equal(result.warehouseReceipt.mappedQuantity, 0);
  assert.equal(result.warehouseReceipt.consumedQuantity, 0);
  assert.equal(result.warehouseReceipt.purchaseQuantity, 0);
  assert.equal(harness.state().movements[0].type, "salida");
});

test("current item type controls actual consumption and zero source quantities remain zero", async () => {
  const harness = createHarness([stock("equipment", "Equipo / consumible", "AUDIO", 10), stock("zero", "Equipo cero", "VIDEO", 0)]);
  const result = await harness.ingest([line("Equipo / consumible", { consumable: true }), line("Equipo cero"), line("Equipo cero", { quantity: 0 })]);
  assert.equal(result.warehouseReceipt.consumedQuantity, 0);
  assert.equal(harness.state().movements[0].type, "salida");
  assert.equal(harness.available("zero"), 0);
  assert.equal(harness.state().items[1].quantity, 0);
  assert.equal(harness.state().movements.length, 2);
});

test("legacy explicit rent, save and purchase decisions never reserve even a matching known physical record", async () => {
  const harness = createHarness([stock("current", "Equipo actual")]);
  const result = await harness.ingest(["rent", "save", "purchase"].map((procurementChoice) => line("Equipo actual", { procurementChoice, warehouseInventoryId: "current" })));
  assert.equal(result.warehouseReceipt.mappedQuantity, 0);
  assert.equal(result.warehouseReceipt.unmappedQuantity, 6);
  assert.equal(harness.available("current"), 10);
  assert.deepEqual(harness.state().movements.map((movement) => movement.procurementChoice), ["rent", "save", "purchase"]);
});

test("backend physical matches agree with equipment's current names, aliases and identity validation", () => {
  const items = [stock("inches", 'Pedestal 12"', "AUDIO", 3), stock("feet", "Pedestal 12'", "AUDIO", 7),
    stock("duplicate-a", "Equipo repetido", "AUDIO", 2), stock("duplicate-b", "Equipo repetido", "VIDEO", 4)];
  const aliases = [{ alias: "Pedestal typo 12 pulgadas", itemId: "inches" }];
  const backend = createHarness(items, aliases);
  const context = { console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout, setInterval, clearInterval,
    window: { requerimientoEquipoCatalog: { services: {}, groups: [] }, requerimientoEquipoInventory: { categories: [] }, addEventListener() {}, setTimeout, setInterval, requestAnimationFrame(callback) { callback(); } },
    document: { querySelector() { return null; }, addEventListener() {}, dispatchEvent() {}, querySelectorAll() { return []; } },
    fetch: async () => ({ ok: false }) };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context);
  context.payload = { state: { items, movements: [], approvedNameAliases: aliases }, savedAt: "2026-10-13T10:00:00.000Z" };
  vm.runInContext("applyEquipmentWarehouseInventoryPayload(payload)", context);
  for (const entry of [line('Pedestal 12"'), line("Pedestal typo 12 pulgadas"), line('Pedestal 12"', { warehouseInventoryId: "feet" }),
    line('Pedestal 12"', { warehouseInventoryId: "missing" }), line("Equipo repetido"), line("Equipo repetido", { category: "VIDEO" })]) {
    context.entry = { ...entry, inventoryCategory: entry.category };
    const frontendIds = vm.runInContext("equipmentWarehouseRecordsForItem(entry).map(record=>record.id)", context);
    assert.deepEqual(Array.from(frontendIds), Array.from(backend.candidates(entry)), entry.description);
  }
});
