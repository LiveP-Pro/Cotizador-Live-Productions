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

function setRequirements(context, items, title = "CUADRO SINTÉTICO") {
  context.requiredItems = items;
  context.requiredTitle = title;
  evaluate(context, `equipmentState.summaryTransferAutomatic=false;
    equipmentState.events=[{id:"synthetic-event",name:"Evento sintético",date:"2026-10-13",
      setupAt:"2026-10-13T08:00",equipmentOutAt:"2026-10-13T07:00",equipmentInAt:"2026-10-13T19:00",
      sections:[{id:"synthetic-section",title:requiredTitle,items:requiredItems}]}]`);
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
  })`), null);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({ warehouseInventoryId: "item-0001", description: "Equipo estático sintético" })`), null);
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
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Subwofer sintético"})`), null);
});

test("an approved alias cannot shadow the literal name of another physical item", () => {
  const context = createContext();
  apply(context, [
    { id: "current-a", name: "Equipo sintético A", category: "A", quantity: 1 },
    { id: "current-b", name: "Equipo sintético B", category: "B", quantity: 9 }
  ], [{ alias: "Equipo sintético A", itemId: "current-b" }]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético A"})`), 1);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"current-b",description:"Equipo sintético A"})`), null);
});

test("duplicate names require a unique category or an explicit matching ID", () => {
  const context = createContext();
  apply(context, [
    { id: "current-a", name: "Equipo sintético duplicado", category: "A", quantity: 2 },
    { id: "current-b", name: "Equipo sintético duplicado", category: "B", quantity: 7 }
  ]);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético duplicado",categoryTitle:"C"})`), null);
  assert.deepEqual(evaluate(context, `equipmentWarehouseRecordsForDescription("Equipo sintético duplicado","C")`), []);
  assert.deepEqual(evaluate(context, `equipmentWarehouseRecordsForItem({description:"Equipo sintético duplicado"},{title:"C"})`), []);
  assert.match(evaluate(context, `equipmentInventoryAutomaticObservationFor({description:"Equipo sintético duplicado",categoryTitle:"C"})`), /coincidencia ambigua/i);
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
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({description:"Equipo sintético duplicado",categoryTitle:"A"})`), null);
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
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"absent-old-id",description:"Equipo sintético duplicado",categoryTitle:"CUADRO"})`), null);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"absent-old-id",description:"Equipo sintético duplicado",categoryTitle:"B"})`), 7);
  assert.equal(evaluate(context, `equipmentInventoryAvailableValueFor({warehouseInventoryId:"current-a",description:"Subwoofer sintético",categoryTitle:"AUDIO"})`), null);
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
  assert.equal(result.requiredRows[0].available, null);
  assert.match(result.requiredRows[0].observation, /coincidencia ambigua/i);
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

test("an unidentified requirement remains pending in summary and PDF tables while current inventory loads", () => {
  const context = createContext([{ title: "AUDIO", items: [[0, "Equipo sintético cero", "Dato actual"]] }]);
  setRequirements(context, [{ quantity: 2, description: "Equipo sintético sin vínculo" }]);
  const result = evaluate(context, `(() => {
    const row=equipmentRowsSummary().find(row=>row.description==="Equipo sintético sin vínculo");
    return {quantity:row.quantity,pending:equipmentInventoryIdentificationPending(row),
      physical:equipmentInventoryPhysicalValueFor(row),available:equipmentInventoryAvailableValueFor(row),
      observation:equipmentInventoryAutomaticObservationFor(row),rentalRows:equipmentRentalRows(),
      html:tableForEquipmentInventory([row],true),pdfHtml:tableForEquipmentInventory([row],false),
      emptyReport:tableForEquipmentRentalReport([],false)};
  })()`);
  assert.equal(result.quantity, 2);
  assert.equal(result.pending, true);
  assert.equal(result.physical, null);
  assert.equal(result.available, null);
  assert.match(result.observation, /pendiente de identificar/);
  assert.deepEqual(result.rentalRows, []);
  for (const html of [result.html, result.pdfHtml]) {
    assert.match(html, /equipment-available-stock">Por identificar<\/td>/);
    assert.match(html, /equipment-missing-total ">Por identificar<\/td>/);
    assert.doesNotMatch(html, />RENTA<|>COMPRA<|class="equipment-inventory-input"[^>]*value="0"/);
  }
  assert.match(result.emptyReport, /Quedan 1 equipos por identificar/);
  assert.doesNotMatch(result.emptyReport, /No hay equipo faltante/);
});

test("pending source matches distinguish duplicate categories and do not add stock from another source row", () => {
  const context = createContext([
    { title: "A", items: [[2, "Equipo sintético repetido", "Fila A"]] },
    { title: "B", items: [[7, "Equipo sintético repetido", "Fila B"]] }
  ]);
  setRequirements(context, [{ quantity: 8, description: "Equipo sintético repetido", inventoryCategory: "B" }]);
  const result = evaluate(context, `({ambiguous:equipmentInventoryIdentificationPending({description:"Equipo sintético repetido",categoryTitle:"C"}),
    ambiguousStock:equipmentInventoryAvailableValueFor({description:"Equipo sintético repetido",categoryTitle:"C"}),
    selectedStock:equipmentInventoryAvailableValueFor({description:"Equipo sintético repetido",categoryTitle:"B"}),
    rental:equipmentRentalRows().map(row=>({quantity:row.quantity,inventory:row.inventory,missing:row.missing}))})`);
  assert.equal(result.ambiguous, true);
  assert.equal(result.ambiguousStock, null);
  assert.equal(result.selectedStock, 7);
  assert.deepEqual(result.rental, [{ quantity: 8, inventory: 7, missing: 1 }]);
});

test("an incompatible current static ID cannot allocate demand or claim that item's inventory", () => {
  const context = createContext([{ title: "A", items: [{warehouseInventoryId:"current-static",value:8,description:"Modelo sintético B"}] }]);
  setRequirements(context, [{ quantity: 5, description: "Modelo sintético A", warehouseInventoryId: "current-static" }]);
  const result = evaluate(context, `({rows:equipmentRowsSummary().filter(row=>row.type==="item").map(row=>({description:row.description,quantity:row.quantity,pending:equipmentInventoryIdentificationPending(row)})),
    rental:equipmentRentalRows()})`);
  assert.deepEqual(result.rows, [
    { description: "Modelo sintético B", quantity: 0, pending: false },
    { description: "Modelo sintético A", quantity: 5, pending: true }
  ]);
  assert.deepEqual(result.rental, []);
});

test("an absent saved ID uses one current static source row without counting its stock twice", () => {
  const context = createContext([{title:"A",items:[{warehouseInventoryId:"current-a",value:3,description:"Equipo sintético A"}]}]);
  setRequirements(context, [{quantity:5,description:"Equipo sintético A",warehouseInventoryId:"missing-saved-id"}]);
  const result = evaluate(context, `({rows:equipmentRowsSummary().filter(row=>row.type==="item").map(row=>({quantity:row.quantity,pending:equipmentInventoryIdentificationPending(row)})),
    rental:equipmentRentalRows().map(row=>({quantity:row.quantity,inventory:row.inventory,missing:row.missing}))})`);
  assert.deepEqual(result.rows, [{quantity:5,pending:false}]);
  assert.deepEqual(result.rental, [{quantity:5,inventory:3,missing:2}]);
});

test("an incompatible loaded ID cannot share demand, observations or transfers with its actual item", () => {
  const context = createContext();
  apply(context, [
    {id:"current-b",name:"Modelo sintético B",category:"B",quantity:8},
    {id:"other-b",name:"Modelo sintético B",category:"C",quantity:20}
  ]);
  setRequirements(context, [
    {quantity:5,description:"Modelo sintético A",warehouseInventoryId:"current-b"},
    {quantity:10,description:"Modelo sintético B",warehouseInventoryId:"current-b"}
  ]);
  const result = evaluate(context, `(() => {
    const rows=equipmentRowsSummary();
    const unknown=rows.find(row=>row.description==="Modelo sintético A");
    const known=rows.find(row=>row.inventorySourceItem?.warehouseInventoryId==="current-b");
    equipmentState.observations.set(unknown.key,"Nota de equipo pendiente");
    return {unknown:{key:unknown.key,identity:equipmentSummaryRowIdentity(unknown),quantity:unknown.quantity,pending:equipmentInventoryIdentificationPending(unknown)},
      known:{key:known.key,identity:equipmentSummaryRowIdentity(known),quantity:known.quantity,observation:equipmentInventoryCombinedObservationFor(known)},
      rental:equipmentRentalRows().map(row=>({description:row.description,quantity:row.quantity,inventory:row.inventory,missing:row.missing})),
      transfer:equipmentTransferComparisonRows(rows).map(row=>row.description),dispatch:equipmentWarehouseDispatchItems(equipmentState.events[0])};
  })()`);
  assert.equal(result.unknown.pending, true);
  assert.equal(result.unknown.quantity, 5);
  assert.equal(result.known.quantity, 10);
  assert.notEqual(result.unknown.key, result.known.key);
  assert.notEqual(result.unknown.identity, result.known.identity);
  assert.doesNotMatch(result.known.observation, /Nota de equipo pendiente/);
  assert.deepEqual(result.rental, [{description:"Modelo sintético B",quantity:10,inventory:8,missing:2}]);
  assert.doesNotMatch(JSON.stringify(result.transfer), /Modelo sintético A/);
  assert.deepEqual(result.dispatch.find(row=>row.description==="Modelo sintético A").warehouseItemIds, []);
  assert.deepEqual(result.dispatch.find(row=>row.description==="Modelo sintético B").warehouseItemIds, ["current-b"]);
});

test("nonempty rental tables and their PDF content warn about excluded unidentified equipment", () => {
  const context = createContext();
  apply(context, [{id:"current-zero",name:"Equipo sintético cero",category:"AUDIO",quantity:0}]);
  setRequirements(context, [
    {quantity:4,description:"Equipo sintético cero"},
    {quantity:2,description:"Equipo sintético pendiente"},
    {quantity:0,description:"Fila sintética cero pendiente"}
  ]);
  const result = evaluate(context, `(() => {
    const rows=equipmentProcurementReportRows("rent");
    return {rows:rows.map(row=>({quantity:row.quantity,inventory:row.inventory,missing:row.missing})),
      editor:tableForEquipmentRentalReport(rows,true),pdf:tableForEquipmentRentalReport(rows,false)};
  })()`);
  assert.deepEqual(result.rows, [{quantity:4,inventory:0,missing:4}]);
  for (const html of [result.editor, result.pdf]) {
    assert.match(html, /Quedan 1 equipos por identificar en el resumen\. Complete su identificación para calcular sus faltantes\./);
    assert.match(html, /Equipo sintético cero/);
    assert.doesNotMatch(html, /Equipo sintético pendiente<|Fila sintética cero pendiente</);
  }
});

test("explicit rental and purchase requests keep their chosen quantities without inventing physical shortages", () => {
  const context = createContext();
  apply(context, [{id:"current-known",name:"Equipo sintético conocido",category:"AUDIO",quantity:5}]);
  setRequirements(context, [
    {quantity:2,description:"Equipo sintético conocido",procurementChoice:"rent"},
    {quantity:2,description:"Equipo sintético renta pendiente",procurementChoice:"rent"},
    {quantity:3,description:"Equipo sintético compra pendiente",procurementChoice:"purchase"},
    {quantity:4,description:"Equipo sintético guardar pendiente",procurementChoice:"save"}
  ]);
  const result = evaluate(context, `(() => {
    const rows=equipmentFilterSummaryRows(equipmentRowsSummary());
    const known=rows.find(row=>row.description==="Equipo sintético conocido"&&row.quantity>0);
    const rental=equipmentProcurementReportRows("rent");
    const purchase=equipmentProcurementReportRows("purchase");
    return {rental:rental.map(row=>({description:row.description,inventory:row.inventory,missing:row.missing,observation:row.observation})),
      purchase:purchase.map(row=>({inventory:row.inventory,missing:row.missing,action:row.action})),
      summary:tableForEquipmentInventory([known],false),rentHtml:tableForEquipmentRentalReport(rental,false),purchaseHtml:tableForEquipmentRentalReport(purchase,false)};
  })()`);
  const known = result.rental.find(row=>row.description==="Equipo sintético conocido");
  const unknown = result.rental.find(row=>row.description==="Equipo sintético renta pendiente");
  assert.equal(known.inventory, 5);
  assert.equal(known.missing, 2);
  assert.match(known.observation, /Renta solicitada por el usuario/);
  assert.equal(unknown.inventory, null);
  assert.equal(unknown.missing, 2);
  assert.deepEqual(result.purchase, [{inventory:null,missing:3,action:"COMPRA"}]);
  assert.match(result.summary, /equipment-available-stock">5<\/td>/);
  assert.match(result.summary, /equipment-missing-total equipment-rest-ok">0<\/td>/);
  assert.match(result.summary, />RENTA<\/td>/);
  assert.doesNotMatch(result.summary, /equipment-shortage-cell/);
  for (const html of [result.rentHtml, result.purchaseHtml]) {
    assert.match(html, /Cantidad solicitada para renta \/ compra/);
    assert.match(html, /Por identificar/);
    assert.doesNotMatch(html, /Cantidad faltante/);
  }
});

test("editing an explicitly rented quantity keeps the displayed request instead of subtracting owned stock", () => {
  const context = createContext();
  apply(context, [{id:"current-known",name:"Equipo sintético conocido",category:"AUDIO",quantity:5}]);
  setRequirements(context, [{quantity:2,description:"Equipo sintético conocido",procurementChoice:"rent"}]);
  const rentalKey = evaluate(context, 'equipmentProcurementReportRows("rent")[0].rentalKey');
  const quantityInput = {dataset:{equipmentRentalField:"quantity"},value:"3",addEventListener(type, callback) {this.onInput=callback;}};
  const missingInput = {dataset:{equipmentRentalField:"missing"},value:"2",addEventListener(type, callback) {this.onInput=callback;}};
  const rowElement = {dataset:{equipmentRentalKey:rentalKey},querySelectorAll() {return [quantityInput,missingInput];},querySelector() {return missingInput;}};
  const host = {querySelectorAll() {return [rowElement];}};
  context.document.querySelector = selector => selector==="#equipmentRentPdfTable" ? host : null;
  evaluate(context, "bindEquipmentRentalReportInputs()");
  quantityInput.onInput();
  assert.equal(missingInput.value, "3");
  assert.deepEqual(evaluate(context, 'equipmentProcurementReportRows("rent").map(row=>({quantity:row.quantity,inventory:row.inventory,missing:row.missing}))'),
    [{quantity:3,inventory:5,missing:3}]);
});
