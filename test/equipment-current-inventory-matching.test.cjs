const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createContext(categories = []) {
  const context = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    window: {
      requerimientoEquipoCatalog: { services: {}, groups: [] },
      requerimientoEquipoInventory: { categories },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: { querySelector() { return null; }, addEventListener() {}, dispatchEvent() {}, querySelectorAll() { return []; } },
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: false })
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context);
  return context;
}

function evaluate(context, code) {
  const value = vm.runInContext(code, context);
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function apply(context, items, approvedNameAliases = [], datasetId = "synthetic-current-source") {
  context.fixture = { savedAt: "2026-10-13T18:00:00Z", state: { datasetId, items, movements: [], approvedNameAliases } };
  evaluate(context, "applyEquipmentWarehouseInventoryPayload(fixture)");
}

test("inventory canonical matching changes only case, accents and spacing", () => {
  const context = createContext();
  assert.equal(evaluate(context, `equipmentInventoryCanonicalKey("  MÓDULO   sintético AC ")`), "modulo sintetico ac");
  for (const [first, second] of [
    ['Marco sintético 12"', "Marco sintético 12'"],
    ["Fuente sintética 12V AC", "Fuente sintética 12V DC"],
    ["Modelo sintético X32", "Modelo sintético X32R"],
    ["Cable sintético 5m", "Cable sintético 10m"],
    ["Marco sintético 2x1", "Marco sintético 2x2"],
    ["Cinta sintética", "Cinta sintética / consumible"],
    ["Modelo sintético USB-A", "Modelo sintético USB-C"]
  ]) {
    context.pair = [first, second];
    assert.equal(evaluate(context, "equipmentInventoryCanonicalKey(pair[0]) === equipmentInventoryCanonicalKey(pair[1])"), false, `${first} must remain distinct from ${second}`);
  }
});

test("legacy source keys, aliases and ordinal IDs cannot borrow current stock", () => {
  const context = createContext([{ title: "FUENTE SINTÉTICA", items: [{ sourceRow: 8, description: "Equipo estático sintético", value: 99 }] }]);
  apply(context, [{ id: "item-0001", name: "Equipo sintético vigente", category: "Z", quantity: 4,
    sourceKey: "Equipo sintético anterior", descriptionAliases: ["Alias sintético anterior"] }]);
  assert.deepEqual(evaluate(context, `equipmentWarehouseRecordsForDescription("Equipo sintético anterior")`), []);
  assert.deepEqual(evaluate(context, `equipmentWarehouseRecordsForDescription("Alias sintético anterior")`), []);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({
    key: equipmentInventoryRowKey(equipmentInventorySourceCategories[0].items[0]),
    description: "Equipo estático sintético", categoryTitle: "FUENTE SINTÉTICA"
  })`), 0);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({ warehouseInventoryId: "item-0001", description: "Equipo estático sintético" })`), 0);
  assert.match(evaluate(context, `equipmentInventoryAutomaticObservationFor({warehouseInventoryId:"item-0001",description:"Equipo estático sintético"})`), /referencia guardada no coincide/);
});

test("approved aliases reference current item IDs and are cleared with the next source", () => {
  const context = createContext();
  const items = [{ id: "inventario-disponible-synthetic-r8", name: "Subwoofer sintético", category: "AUDIO", quantity: 3 }];
  apply(context, items, [{ alias: "Subwofer sintético", itemId: items[0].id }]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"SUBWOFER SINTÉTICO",categoryTitle:"SERVICIO SINTÉTICO"})`), 3);
  assert.equal(evaluate(context, `equipmentRecognizedInventoryChoice("Subwofer sintético")`), true);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"inventario-disponible-synthetic-r8",description:"Subwofer sintético"})`), 3);
  apply(context, items, [], "synthetic-replacement-source");
  assert.equal(evaluate(context, `equipmentRecognizedInventoryChoice("Subwofer sintético")`), false);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Subwofer sintético"})`), 0);
});

test("an approved alias cannot shadow the literal name of another physical item", () => {
  const context = createContext();
  apply(context, [
    { id: "current-a", name: "Equipo sintético A", category: "A", quantity: 1 },
    { id: "current-b", name: "Equipo sintético B", category: "B", quantity: 9 }
  ], [{ alias: "Equipo sintético A", itemId: "current-b" }]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético A"})`), 1);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"current-b",description:"Equipo sintético A"})`), 0);
});

test("duplicate names require a unique category or an explicit matching ID", () => {
  const context = createContext();
  apply(context, [
    { id: "current-a", name: "Equipo sintético duplicado", category: "A", quantity: 2 },
    { id: "current-b", name: "Equipo sintético duplicado", category: "B", quantity: 7 }
  ]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético duplicado",categoryTitle:"C"})`), 0);
  assert.deepEqual(evaluate(context, `equipmentWarehouseRecordsForDescription("Equipo sintético duplicado","C")`), []);
  assert.deepEqual(evaluate(context, `equipmentWarehouseRecordsForItem({description:"Equipo sintético duplicado"},{title:"C"})`), []);
  assert.match(evaluate(context, `equipmentInventoryAutomaticObservationFor({description:"Equipo sintético duplicado",categoryTitle:"C"})`), /Coincidencia ambigua/);
  assert.equal(evaluate(context, `equipmentRecognizedInventoryChoice("Equipo sintético duplicado")`), false);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"equipo sintético duplicado",categoryTitle:"B"})`), 7);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético duplicado",warehouseInventoryId:"current-a"})`), 2);
});

test("same-category duplicate source rows also remain separate and ambiguous", () => {
  const context = createContext();
  apply(context, [
    { id: "current-a", name: "Equipo sintético duplicado", category: "A", quantity: 2 },
    { id: "current-b", name: "Equipo sintético duplicado", category: "A", quantity: 7 }
  ]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético duplicado",categoryTitle:"A"})`), 0);
  assert.deepEqual(evaluate(context, `equipmentInventorySummaryCategories()[0].items.map(item=>item.warehouseInventoryId)`), ["current-a", "current-b"]);
});

test("an absent historical ID can resolve only an unambiguous current literal or approved alias", () => {
  const context = createContext();
  apply(context, [
    { id: "current-sub", name: "Subwoofer sintético", category: "AUDIO", quantity: 3 },
    { id: "current-a", name: "Equipo sintético duplicado", category: "A", quantity: 2 },
    { id: "current-b", name: "Equipo sintético duplicado", category: "B", quantity: 7 }
  ], [{ alias: "Subwofer sintético", itemId: "current-sub" }]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"absent-old-id",description:"Subwoofer sintético",categoryTitle:"CUADRO"})`), 3);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"absent-old-id",description:"Subwofer sintético",categoryTitle:"CUADRO"})`), 3);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"absent-old-id",description:"Equipo sintético duplicado",categoryTitle:"CUADRO"})`), 0);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"absent-old-id",description:"Equipo sintético duplicado",categoryTitle:"B"})`), 7);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"current-a",description:"Subwoofer sintético",categoryTitle:"AUDIO"})`), 0);
  const summary = evaluate(context, `(() => {
    equipmentState.summaryTransferAutomatic = false;
    equipmentState.events = [{id:"event-rebind",date:"2026-10-13",sections:[{title:"CUADRO",items:[
      {quantity:2,description:"Subwoofer sintético",warehouseInventoryId:"absent-old-id"}
    ]}]}];
    return equipmentRowsSummary().filter(row=>row.type==="item"&&row.quantity>0).map(row=>({id:row.inventorySourceItem?.warehouseInventoryId,required:row.quantity}));
  })()`);
  assert.deepEqual(summary, [{ id: "current-sub", required: 2 }]);
});

test("summary cannot spread an ambiguous requirement over different physical inventory rows", () => {
  const context = createContext();
  apply(context, [
    { id: "current-a", name: "Equipo sintético duplicado", category: "A", quantity: 2 },
    { id: "current-b", name: "Equipo sintético duplicado", category: "B", quantity: 7 }
  ]);
  const result = evaluate(context, `(() => {
    equipmentState.summaryTransferAutomatic = false;
    equipmentState.events = [{id:"event-synthetic",date:"2026-10-13",setupAt:"2026-10-13T08:00",equipmentInAt:"2026-10-13T19:00",sections:[
      {id:"section",title:"C",items:[{quantity:5,description:"Equipo sintético duplicado"}]}
    ]}];
    const rows = equipmentRowsSummary();
    return {physicalRows:rows.filter(row=>row.inventorySourceItem).map(row=>({id:row.inventorySourceItem.warehouseInventoryId,required:row.quantity})),
      requiredRows:equipmentFilterSummaryRows(rows).filter(row=>row.type!=="category").map(row=>({required:row.quantity,available:equipmentInventoryAvailableValueFor(row),observation:equipmentInventoryAutomaticObservationFor(row)}))};
  })()`);
  assert.deepEqual(result.physicalRows, [{ id: "current-a", required: 0 }, { id: "current-b", required: 0 }]);
  assert.equal(result.requiredRows.length, 1);
  assert.equal(result.requiredRows[0].required, 5);
  assert.equal(result.requiredRows[0].available, 0);
  assert.match(result.requiredRows[0].observation, /Coincidencia ambigua/);
});

test("zero stock remains a recognized current row and generates its actual shortage", () => {
  const context = createContext();
  apply(context, [{ id: "current-zero", name: "Equipo sintético cero", category: "Z", quantity: 0 }]);
  const result = evaluate(context, `(() => {
    equipmentState.summaryTransferAutomatic = false;
    equipmentState.events = [{id:"event-zero",date:"2026-10-13",setupAt:"2026-10-13T08:00",equipmentInAt:"2026-10-13T19:00",sections:[
      {id:"section",title:"CUADRO SINTÉTICO",items:[{quantity:4,description:"Equipo sintético cero"}]}
    ]}];
    const rows = equipmentFilterSummaryRows(equipmentRowsSummary());
    return {recognized:equipmentRecognizedInventoryChoice("Equipo sintético cero"),
      inventoryRow:equipmentInventorySummaryCategories()[0].items[0],
      required:rows.find(row=>row.type==="item").quantity,
      html:tableForEquipmentInventory(rows,true)};
  })()`);
  assert.equal(result.recognized, true);
  assert.equal(result.inventoryRow.value, 0);
  assert.equal(result.required, 4);
  assert.match(result.html, /value="0"/);
  assert.match(result.html, /equipment-available-stock">0/);
  assert.match(result.html, /equipment-missing-total equipment-shortage-cell">4/);
  assert.doesNotMatch(result.html, /class="equipment-inventory-zero-row/);
});

test("summary shows registered and available warehouse stock separately from the shortage", () => {
  const context = createContext();
  context.fixture = { savedAt: "2026-10-13T18:00:00Z", state: { items: [
    { id: "current-stock", name: "Equipo sintético disponible", category: "AUDIO", quantity: 21 }
  ], movements: [
    { id: "event-out", itemId: "current-stock", type: "salida", quantity: 1 },
    { id: "shop-out", itemId: "current-stock", type: "taller", quantity: 1 },
    { id: "lost", itemId: "current-stock", type: "perdido", quantity: 1 },
    { id: "used", itemId: "current-stock", type: "consumo", quantity: 1 }
  ] } };
  evaluate(context, "applyEquipmentWarehouseInventoryPayload(fixture)");
  const result = evaluate(context, `(() => {
    equipmentState.inventory.set("inventario-bodega-current-stock", 9999);
    const row = { key:"inventario-bodega-current-stock",description:"Equipo sintético disponible",warehouseInventoryId:"current-stock",quantity:30,eventQuantities:new Map() };
    return {registered:equipmentInventoryPhysicalValueFor(row),available:equipmentInventoryAvailableValueFor(row),html:tableForEquipmentInventory([row],true)};
  })()`);
  assert.equal(result.registered, 21);
  assert.equal(result.available, 17);
  assert.match(result.html, /value="21"[^>]*readonly aria-readonly="true" title="Editar en Contabilidad de Equipo"/);
  assert.match(result.html, /equipment-available-stock">17<\/td>/);
  assert.match(result.html, /equipment-missing-total equipment-shortage-cell">13<\/td>/);
  assert.match(result.html, />EQUIPO FALTANTE<\/th>/);
  assert.match(result.html, />RENTA<\/td>/);
  assert.doesNotMatch(result.html, />-13<\/td>|9999/);
});

test("current authoritative source values remain read-only while the warehouse payload loads", () => {
  const context = createContext([{ title: "AUDIO", items: [[0, "Equipo sintético cero", "Dato actual"]] }]);
  const html = evaluate(context, `(() => {
    const row = {key:equipmentInventoryRowKey(equipmentInventorySourceCategories[0].items[0]),description:"Equipo sintético cero",quantity:2,eventQuantities:new Map()};
    equipmentState.inventory.set(row.key,9999);
    return tableForEquipmentInventory([row],true);
  })()`);
  assert.match(html, /value="0"[^>]*readonly aria-readonly="true" title="Editar en Contabilidad de Equipo"/);
  assert.match(html, /equipment-available-stock">0<\/td>/);
  assert.match(html, /equipment-missing-total equipment-shortage-cell">2<\/td>/);
  assert.doesNotMatch(html, /9999/);
});

test("tuple source rows preserve zero values, notes, order and category-specific keys", () => {
  const context = createContext([
    { title: "TÍTULO A", items: [[0, "Equipo sintético", "Nota A"], [1, "Segundo equipo", 0]] },
    { title: "TÍTULO B", items: [[0, "Equipo sintético", "Nota B"]] }
  ]);
  const result = evaluate(context, `({categories:equipmentInventorySourceCategories,
    keys:equipmentInventorySourceCategories.flatMap(category=>category.items.map(equipmentInventoryRowKey))})`);
  assert.equal(result.categories[0].title, "TÍTULO A");
  assert.equal(result.categories[0].items[0].value, 0);
  assert.equal(result.categories[0].items[0].notes, "Nota A");
  assert.equal(result.categories[0].items[1].notes, 0);
  assert.equal(result.categories[1].items[0].notes, "Nota B");
  assert.equal(new Set(result.keys).size, 3);
  assert.equal(evaluate(context, `equipmentInventoryNumber(defaultInventoryValueFor({key:equipmentInventoryRowKey(equipmentInventorySourceCategories[0].items[0]),description:"Equipo sintético"}))`), 0);
});

test("authoritative service cells and headings remain literal when a current alias resolves stock", () => {
  const context = createContext();
  apply(context, [{ id: "current-sub", name: "Subwoofer sintético", category: "INVENTARIO SINTÉTICO", quantity: 2 }],
    [{ alias: "Subwofer sintético", itemId: "current-sub" }]);
  const sections = [{ id: "source-section", title: "TÍTULO LITERAL DEL CUADRO", importSource: { authoritative: true },
    items: [{ quantity: 0, description: "Subwofer sintético" }], notes: ["Nota literal"] }];
  context.currentSource = sections;
  assert.deepEqual(evaluate(context, "equipmentLiveSectionsForDisplay(currentSource)"), sections);
});
