const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function context(options = {}) {
  const documentListeners = new Map();
  const windowListeners = new Map();
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: options.fetch || (async () => ({ ok: false })),
    window: {
      EquipmentIdentity: require("../equipment-identity.js"),
      requerimientoEquipoCatalog: { services: {}, groups: [] },
      requerimientoEquipoInventory: options.inventory || { categories: [] },
      location: { protocol: options.protocol || "file:", hash: "#requerimiento-equipo" },
      ...(options.BroadcastChannel ? { BroadcastChannel: options.BroadcastChannel } : {}),
      addEventListener(name, callback) { windowListeners.set(name, callback); },
      setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: {
      visibilityState: "visible",
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener(name, callback) { documentListeners.set(name, callback); },
      dispatchEvent(event) { documentListeners.get(event.type)?.(event); }
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  return { sandbox, documentListeners, windowListeners };
}

function run(sandbox, source) { return vm.runInContext(source, sandbox); }
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("indexed lookups preserve strict resolver priority, ambiguous identities and current inventory refreshes", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const inventory = [{ id: "alpha", name: "Modelo actual A", category: "Prueba", quantity: 3,
      descriptionAliases: ["Alias sin aprobar"], approvedDescriptionAliases: [{ name: "Nombre anterior", approved: true, approvedAt: "2026-11-05T12:00:00.000Z" }] },
      { id: "beta", name: "Nombre anterior", category: "Prueba", quantity: 4 },
      { id: "duplicate-a", name: "Modelo duplicado", category: "A", quantity: 5 },
      { id: "duplicate-b", name: "Modelo duplicado", category: "B", quantity: 6 },
      { id: "archived", name: "Modelo retirado", category: "Prueba", quantity: 7, archived: true }];
    applyEquipmentWarehouseInventoryPayload({state:{items:inventory,movements:[]}});
    const cases = [{description:"NOMBRE ANTERIOR"}, {description:"Nombre anterior",warehouseInventoryId:"alpha"},
      {description:"Alias sin aprobar"}, {description:"Modelo duplicado"}, {description:"Modelo retirado",warehouseInventoryId:"archived"},
      {description:"Otro modelo",warehouseInventoryId:"alpha"},
      {description:"Otro modelo",warehouseInventoryId:"alpha",inventoryIdentityConfirmed:{itemId:"alpha",description:"Otro modelo",confirmedAt:"2026-11-05T12:00:00.000Z"}}];
    const parity = cases.map(line => ({ indexed:equipmentWarehouseRecordsForItem(line).map(record=>record.id),
      expected:window.EquipmentIdentity.resolve(line,inventory).item?.id || null }));
    const direct = equipmentWarehouseRecordsForDescription("Nombre anterior").map(record=>record.id);
    inventory[0].name="Modelo reemplazado";inventory[0].approvedDescriptionAliases=[];
    applyEquipmentWarehouseInventoryPayload({state:{items:inventory,movements:[]}});
    return {parity,direct,old:equipmentWarehouseRecordsForDescription("Modelo actual A").length,
      current:equipmentWarehouseRecordsForDescription("Modelo reemplazado").map(record=>record.id)};
  })()`));
  for (const row of result.parity) assert.deepEqual(row.indexed, row.expected ? [row.expected] : []);
  assert.deepEqual(result.direct, ["beta"]); assert.equal(result.old, 0); assert.deepEqual(result.current, ["alpha"]);
});

test("repeated current inventory lookups reuse the approved index without calling the full catalog resolver", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const original = window.EquipmentIdentity; let fullResolverCalls = 0;
    window.EquipmentIdentity = { ...original, resolve(...args) { fullResolverCalls++; return original.resolve(...args); } };
    const items = Array.from({length:274}, (_,index) => ({id:"synthetic-"+index,name:"Unidad sintética "+index,category:"Prueba",quantity:index}));
    applyEquipmentWarehouseInventoryPayload({state:{items,movements:[]}});
    let matched = 0;
    for(let index=0;index<10000;index++) {
      const selected=index%274;
      matched+=equipmentWarehouseRecordsForDescription("Unidad sintética "+selected).length;
      matched+=equipmentWarehouseRecordsForItem({description:"Unidad sintética "+selected,warehouseInventoryId:"synthetic-"+selected}).length;
    }
    return {matched,fullResolverCalls};
  })()`));
  assert.equal(result.matched, 20000); assert.equal(result.fullResolverCalls, 0);
});

test("legacy aliases and a contradictory auto-assigned ID cannot consume another physical model", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [{ id: "normal", name: "Par LED normal", sourceKey: "Par LED matiz",
      descriptionAliases: ["Par LED matiz"], category: "Luces", quantity: 80 }], movements: [] } });
    const section = { title: "Luces", manualSection: true, items: [{ quantity: 70, description: "Par LED matiz", warehouseInventoryId: "normal" }] };
    equipmentState.events = [{ id: "synthetic", active: true, sections: [section] }];
    const original = JSON.stringify(equipmentState.events);
    const rows = equipmentRowsSummary().filter(row => row.type === "item");
    const stock = rows.find(row => row.inventorySourceItem);
    const unbound = rows.find(row => !row.inventorySourceItem && row.quantity > 0);
    return { stockQuantity: stock.quantity, unboundQuantity: unbound.quantity,
      stockIdentity: equipmentSummaryRowIdentity(stock), pendingIdentity: equipmentSummaryRowIdentity(unbound),
      record: equipmentWarehouseInventoryRecordFor(unbound)?.id || null,
      dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]), unchanged: original === JSON.stringify(equipmentState.events) };
  })()`));
  assert.equal(result.stockQuantity, 0); assert.equal(result.unboundQuantity, 70); assert.equal(result.record, null);
  assert.notEqual(result.pendingIdentity, result.stockIdentity);
  assert.deepEqual(result.dispatch[0].warehouseItemIds, []); assert.equal(result.dispatch[0].inventoryMatchUnresolved, true);
  assert.equal(result.unchanged, true);
});

test("manual planner binding supports a legacy zero row and preserves its section source evidence", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    window.EquipmentPlanner = { create() { return { init() { return { render() {} }; } }; } };
    renderEquipmentModule = () => {};
    applyEquipmentWarehouseInventoryPayload({ state: { items: [{ id: "one", name: "Nombre vigente", category: "Categoría vigente", quantity: 3 }], movements: [] } });
    const sourceCells = [{ ref: "Fuente!A7", value: 0 }, { ref: "Fuente!B7", value: "Nombre anterior" }];
    equipmentState.events = [{ id: "legacy", sections: [{ title: "Sección original", sourceCells, notes: ["Nota literal"], items: [[0, "Nombre anterior"]] }] }];
    initEquipmentPlannerBridge();
    window.liveEquipmentPlanner.bindIdentity([{ eventId: "legacy", sectionIndex: 0, itemIndex: 0, description: "Nombre anterior" }], "one");
    const event = equipmentState.events[0], item = event.sections[0].items[0];
    return { item, sourceCells: event.sections[0].sourceCells, notes: event.sections[0].notes,
      snapshot: event.documentSections[0].items[0], resolved: equipmentWarehouseRecordsForItem(item).map(record => record.id) };
  })()`));
  assert.equal(result.item.quantity, 0); assert.equal(result.item.description, "Nombre anterior");
  assert.equal(result.item.warehouseInventoryId, "one"); assert.equal(result.item.inventoryIdentityConfirmed.itemId, "one");
  assert.deepEqual(result.resolved, ["one"]); assert.equal(result.sourceCells[0].value, 0); assert.deepEqual(result.notes, ["Nota literal"]);
  assert.deepEqual(result.snapshot.inventoryIdentityConfirmed, result.item.inventoryIdentityConfirmed);
});

test("shared recommendations never present a pending classification or identity as a purchase or rental order", () => {
  const { sandbox } = context();
  const markup = run(sandbox, `(() => {
    const host = { innerHTML: "", querySelector() { return null; }, querySelectorAll() { return []; } };
    equipmentQuery = selector => selector === "#equipmentSharedRecommendations" ? host : null;
    equipmentSharedWorkspace.state = { events: [], transfers: [], range: { from: "2026-11-02", to: "2026-11-08" },
      plan: { rows: [{ description: "Extintor de prueba", itemType: "consumible", quantity: 6, missing: 3, capacity: 3, required: 6,
        pendingClassification: true, procurementBlocked: true, action: "REVISAR", events: [],
        planning: { rentalPotential: 0, purchasePotential: 0, optimal: false, warnings: [] } }], invalidTransfers: [], logistics: {} } };
    renderEquipmentSharedPlan(); return host.innerHTML;
  })()`);
  assert.ok(!/3 por comprar|3 por rentar/.test(markup));
  assert.match(markup, /Revisar|Completar|pendiente/);
});

test("explicitly approved aliases map renamed active stock once without changing event templates", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const sections = [{ title: "Categoria original", items: [[2, "Unidad original"], [3, "Nombre intermedio"]] }];
    equipmentState.events = [{ id: "evento-prueba", active: true, sections }];
    const original = JSON.stringify(sections);
    applyEquipmentWarehouseInventoryPayload({ state: {
      items: [{ id: "activo-1", name: "Unidad actual", sourceKey: "unidad original",
        descriptionAliases: ["Unidad original", "Nombre intermedio", "Nombre intermedio"],
        approvedDescriptionAliases: ["Unidad original", "Nombre intermedio"].map(name => ({ name, approved: true, approvedAt: "2026-11-04T12:00:00.000Z" })),
        category: "Categoria actual", quantity: 1, notes: "Nota vigente", itemType: "equipo" }], movements: []
    } });
    const rows = equipmentRowsSummary().filter((row) => row.type === "item");
    const rentals = equipmentRentalRows();
    const display = equipmentLiveSectionsForDisplay(sections);
    const dispatch = equipmentWarehouseDispatchItems(equipmentState.events[0]);
    return { rows: rows.map((row) => ({ name: row.description, category: row.categoryTitle,
        required: row.quantity, available: equipmentInventoryAvailableValueFor(row),
        identity: equipmentSummaryRowIdentity(row), observation: equipmentInventoryAutomaticObservationFor(row) })),
      rental: rentals.map((row) => ({ name: row.description, inventory: row.inventory, missing: row.missing })),
      display, dispatch, unchanged: JSON.stringify(sections) === original,
      recognizedOriginal: equipmentRecognizedInventoryChoice("Unidad original"),
      recognizedIntermediate: equipmentRecognizedInventoryChoice("Nombre intermedio") };
  })()`));
  assert.deepEqual(result.rows, [{ name: "Unidad actual", category: "Categoria actual", required: 5, available: 1,
    identity: "inventario-bodega-activo-1", observation: "Nota del inventario: Nota vigente" }]);
  assert.deepEqual(result.rental, [{ name: "Unidad actual", inventory: 1, missing: 4 }]);
  assert.equal(result.unchanged, true);
  assert.equal(result.recognizedOriginal, true);
  assert.equal(result.recognizedIntermediate, true);
  assert.equal(result.display[0].title, "Categoria actual");
  assert.deepEqual(result.display[0].items.map((item) => item.description), ["Unidad actual", "Unidad actual"]);
  assert.deepEqual(result.display[0].items.map((item) => item.quantity), [2, 3]);
  assert.equal(result.dispatch.length, 1);
  assert.equal(result.dispatch[0].description, "Unidad actual");
  assert.equal(result.dispatch[0].category, "Categoria actual");
  assert.deepEqual(result.dispatch[0].warehouseItemIds, ["activo-1"]);
  assert.equal(result.dispatch[0].quantity, 5);
});

test("fingerprint notices movement edits with unchanged IDs, counts and timestamps", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const payload = { savedAt: "2026-10-06T10:00:00Z", state: { updatedAt: "2026-10-06T10:00:00Z",
      items: [{ id: "activo", name: "Unidad", quantity: 8, category: "Prueba" }],
      movements: [{ id: "salida", itemId: "activo", type: "taller", quantity: 2,
        dateTime: "2026-10-06T09:00", repair: "Falla inicial", sparePart: "Parte A" }] } };
    applyEquipmentWarehouseInventoryPayload(payload);
    const before = equipmentWarehouseInventoryState.records[0].available;
    payload.state.movements[0].quantity = 5;
    payload.state.movements[0].repair = "Falla actual";
    payload.state.movements[0].sparePart = "Parte B";
    const changed = applyEquipmentWarehouseInventoryPayload(payload);
    const record = equipmentWarehouseInventoryState.records[0];
    return { before, changed, after: record.available, observation: record.automaticObservation,
      unchanged: applyEquipmentWarehouseInventoryPayload(payload) };
  })()`));
  assert.equal(result.before, 6);
  assert.equal(result.changed, true);
  assert.equal(result.after, 3);
  assert.match(result.observation, /Falla actual/);
  assert.match(result.observation, /Parte B/);
  assert.equal(result.unchanged, false);
});

test("archive and removal invalidate active inventory and cannot resurrect saved manual stock", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    equipmentState.events = [{ id: "evento", active: true, sections: [{ title: "Prueba", items: [[4, "Unidad"]] }] }];
    equipmentState.inventory.set("unidad", "99");
    const payload = { state: { items: [{ id: "activo", name: "Unidad", sourceKey: "unidad", quantity: 9 }], movements: [] } };
    applyEquipmentWarehouseInventoryPayload(payload);
    const available = inventoryValueFor(equipmentRowsSummary().find((row) => row.type === "item"));
    payload.state.items[0].archived = true;
    const archivedChanged = applyEquipmentWarehouseInventoryPayload(payload);
    const row = equipmentRowsSummary().find((entry) => entry.type === "item");
    const html = tableForEquipmentInventory([row], true);
    const afterArchive = inventoryValueFor(row);
    payload.state.items = [];
    const removedChanged = applyEquipmentWarehouseInventoryPayload(payload);
    return { available, archivedChanged, afterArchive, removedChanged,
      afterRemoval: inventoryValueFor(row), records: equipmentWarehouseInventoryState.records.length,
      html, dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0])[0] };
  })()`));
  assert.equal(result.available, 9);
  assert.equal(result.archivedChanged, true);
  assert.equal(result.removedChanged, true);
  assert.equal(result.afterArchive, 0);
  assert.equal(result.afterRemoval, 0);
  assert.equal(result.records, 0);
  assert.match(result.html, /readonly aria-readonly="true"/);
  assert.deepEqual(result.dispatch.warehouseItemIds, []);
});

test("current type, category, aliases, notes and zero quantities update without rewriting sources", () => {
  const { sandbox } = context({ inventory: { categories: [{ title: "Fuente", items: [{ sourceRow: 1, description: "Unidad original consumible", value: 50 }] }] } });
  const result = plain(run(sandbox, `(() => {
    equipmentState.events = [{ id: "evento", active: true, sections: [{ title: "Fuente", items: [[2, "Unidad original consumible"], [0, "Nota de la plantilla"]] }] }];
    const payload = { state: { items: [{ id: "item-0001", name: "Unidad actual", sourceKey: "unidad original consumible",
      descriptionAliases: [], approvedDescriptionAliases: [{ name: "Unidad original consumible", approved: true, approvedAt: "2026-11-04T12:00:00.000Z" }],
      itemType: "consumible", category: "Primera", quantity: 5 }], movements: [] } };
    applyEquipmentWarehouseInventoryPayload(payload);
    const first = equipmentRowsSummary().find((row) => row.inventorySourceItem);
    payload.state.items[0] = { ...payload.state.items[0], name: "Unidad final", category: "Final",
      itemType: "equipo", quantity: 0, descriptionAliases: ["Unidad actual"], notes: "Nota final",
      approvedDescriptionAliases: [...payload.state.items[0].approvedDescriptionAliases, { name: "Unidad actual", approved: true, approvedAt: "2026-11-04T12:01:00.000Z" }] };
    const changed = applyEquipmentWarehouseInventoryPayload(payload);
    const row = equipmentRowsSummary().find((entry) => entry.inventorySourceItem);
    const compact = tableForEquipmentSections(equipmentState.events[0].sections, true);
    const editable = tableForEquipmentSections(equipmentState.events[0].sections.map((section) => ({ ...section,
      items: section.items.map((item, index) => ({ ...normalizeEquipmentItem(item), id: "linea-" + index, editable: true })) })), false);
    return { changed, initialAction: equipmentProcurementActionFor(first), finalAction: equipmentProcurementActionFor(row),
      name: row.description, category: row.categoryTitle, available: inventoryValueFor(row),
      required: row.quantity, note: equipmentInventoryAutomaticObservationFor(row), compact, editable,
      templateName: equipmentState.events[0].sections[0].items[0][1],
      originalQuantity: equipmentState.events[0].sections[0].items[0][0],
      zeroTemplateQuantity: equipmentState.events[0].sections[0].items[1][0] };
  })()`));
  assert.equal(result.changed, true);
  assert.equal(result.initialAction, "COMPRA");
  assert.equal(result.finalAction, "RENTA");
  assert.equal(result.available, 0);
  assert.equal(result.required, 2);
  assert.equal(result.name, "Unidad final");
  assert.equal(result.category, "Final");
  assert.match(result.note, /Nota final/);
  assert.match(result.compact, /Unidad final/);
  assert.match(result.compact, /Nota de la plantilla/);
  assert.match(result.editable, /value="Unidad final"/);
  assert.match(result.editable, /data-equipment-item-id="linea-0"/);
  assert.equal(result.templateName, "Unidad original consumible");
  assert.equal(result.originalQuantity, 2);
  assert.equal(result.zeroTemplateQuantity, 0);
});

test("stable physical identity retains transfer choices after approved active name changes", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const payload = { state: { items: [{ id: "activo", name: "Unidad original", sourceKey: "unidad original", quantity: 5 }], movements: [] } };
    applyEquipmentWarehouseInventoryPayload(payload);
    const selections = { "evento-a::evento-b": [{ identity: "inventario-bodega-activo", quantity: 2 }] };
    payload.state.items[0] = { ...payload.state.items[0], name: "Unidad renombrada", descriptionAliases: ["Unidad original"],
      approvedDescriptionAliases: [{ name: "Unidad original", approved: true, approvedAt: "2026-11-04T12:00:00.000Z" }] };
    applyEquipmentWarehouseInventoryPayload(payload);
    return { normalized: normalizeEquipmentTransferLegSelections(selections),
      oldIdentity: equipmentInventoryIdentityForDescription("Unidad original"),
      newIdentity: equipmentInventoryIdentityForDescription("Unidad renombrada") };
  })()`));
  assert.equal(result.oldIdentity, "inventario-bodega-activo");
  assert.equal(result.newIdentity, "inventario-bodega-activo");
  assert.deepEqual(result.normalized, { "evento-a::evento-b": [{ identity: "inventario-bodega-activo", quantity: 2 }] });
});

test("a newly committed restore replaces an older state and an older response cannot revert it", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const original = { savedAt: "2026-10-06T12:00:00Z", state: {
      updatedAt: "2026-10-06T11:59:00Z", items: [{ id: "activo", name: "Unidad actual", quantity: 8 }], movements: [] } };
    applyEquipmentWarehouseInventoryPayload(original);
    const restored = { savedAt: "2026-10-06T12:01:00Z", state: {
      updatedAt: "2026-01-01T09:00:00Z", items: [{ id: "activo", name: "Unidad restaurada", quantity: 2 }], movements: [] } };
    const accepted = applyEquipmentWarehouseInventoryPayload(restored);
    const staleAccepted = applyEquipmentWarehouseInventoryPayload(original);
    return { accepted, staleAccepted, name: equipmentWarehouseInventoryState.records[0].item.name,
      available: equipmentWarehouseInventoryState.records[0].available };
  })()`));
  assert.equal(result.accepted, true);
  assert.equal(result.staleAccepted, false);
  assert.equal(result.name, "Unidad restaurada");
  assert.equal(result.available, 2);
});

test("an explicit physical selection disambiguates a confirmed alias colliding with another current name", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "a", name: "Unidad B", sourceKey: "unidad a", category: "Categoria A", quantity: 5 },
      { id: "b", name: "Unidad C", sourceKey: "unidad b", descriptionAliases: ["Unidad B"], category: "Categoria B", quantity: 4,
        approvedDescriptionAliases: [{ name: "Unidad B", approved: true, approvedAt: "2026-11-04T12:00:00.000Z" }] }
    ], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [{ title: "Categoria B", items: [{ quantity: 3, description: "Unidad B", warehouseInventoryId: "b" }] }] }];
    const rows = equipmentRowsSummary().filter((row) => row.type === "item");
    const display = equipmentLiveSectionsForDisplay(equipmentState.events[0].sections);
    const dispatch = equipmentWarehouseDispatchItems(equipmentState.events[0]);
    return { rows: rows.map((row) => ({ name: row.description, required: row.quantity, available: equipmentInventoryAvailableValueFor(row) })),
      display, dispatch, stableSelection: normalizeEquipmentTransferLegSelections({ "a::b": [{ identity: "inventario-bodega-b", quantity: 2 }] }) };
  })()`));
  assert.deepEqual(result.rows, [{ name: "Unidad B", required: 0, available: 5 }, { name: "Unidad C", required: 3, available: 4 }]);
  assert.equal(result.display[0].title, "Categoria B");
  assert.equal(result.display[0].items[0].description, "Unidad C");
  assert.deepEqual(result.dispatch[0].warehouseItemIds, ["b"]);
  assert.equal(result.dispatch[0].description, "Unidad C");
  assert.equal(result.dispatch[0].category, "Categoria B");
  assert.deepEqual(result.stableSelection, { "a::b": [{ identity: "inventario-bodega-b", quantity: 2 }] });
});

test("within one category an exact current name wins over another record's historical alias", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "a", name: "Unidad B", sourceKey: "unidad a", category: "Prueba", quantity: 5 },
      { id: "b", name: "Unidad C", sourceKey: "unidad c", descriptionAliases: ["Unidad B"], category: "Prueba", quantity: 4 }
    ], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [{ title: "Prueba", items: [[3, "Unidad B"]] }] }];
    return { rows: equipmentRowsSummary().filter((row) => row.type === "item").map((row) => ({ name: row.description, required: row.quantity })),
      dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]) };
  })()`));
  assert.deepEqual(result.rows, [{ name: "Unidad B", required: 3 }, { name: "Unidad C", required: 0 }]);
  assert.deepEqual(result.dispatch[0].warehouseItemIds, ["a"]);
});

test("equal source keys in different categories retain distinct stock and transfer identities", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "a", name: "Unidad compartida", sourceKey: "unidad compartida", category: "Categoria A", quantity: 2 },
      { id: "b", name: "Unidad compartida", sourceKey: "unidad compartida", category: "Categoria B", quantity: 4 }
    ], movements: [] } });
    const makeEvent = (id, date, requiredA, requiredB) => ({ id, active: true, setupAt: date + "T08:00",
      date, equipmentInAt: date + "T20:00", sections: [
        { title: "Categoria A", items: [{ quantity: requiredA, description: "Unidad compartida", warehouseInventoryId: "a" }] },
        { title: "Categoria B", items: [{ quantity: requiredB, description: "Unidad compartida", warehouseInventoryId: "b" }] }
      ] });
    equipmentState.events = [makeEvent("evento-1", "2026-10-10", 3, 1), makeEvent("evento-2", "2026-10-10", 2, 4)];
    const rows = equipmentRowsSummary().filter((row) => row.type === "item");
    const comparison = equipmentTransferComparisonRows(rows);
    const dispatch = equipmentWarehouseDispatchItems(equipmentState.events[0]);
    return { rows: rows.map((row) => ({ id: row.inventorySourceItem.warehouseInventoryId,
      identity: equipmentSummaryRowIdentity(row), required: row.quantity, available: equipmentInventoryAvailableValueFor(row) })),
      comparison: comparison.map((row) => ({ identity: row.identity, category: row.categoryTitle,
        first: row.eventQuantities.get("evento-1"), second: row.eventQuantities.get("evento-2") })),
      rental: equipmentRentalRows().map((row) => ({ identity: row.matchKey, missing: row.missing })), dispatch };
  })()`));
  assert.deepEqual(result.rows, [
    { id: "a", identity: "inventario-bodega-a", required: 5, available: 2 },
    { id: "b", identity: "inventario-bodega-b", required: 5, available: 4 }
  ]);
  assert.deepEqual(result.comparison, [
    { identity: "inventario-bodega-a", category: "Categoria A", first: 3, second: 2 },
    { identity: "inventario-bodega-b", category: "Categoria B", first: 1, second: 4 }
  ]);
  assert.deepEqual(result.rental, [{ identity: "inventario-bodega-a", missing: 3 }, { identity: "inventario-bodega-b", missing: 1 }]);
  assert.equal(result.dispatch.length, 2);
  assert.deepEqual(result.dispatch.map((line) => line.warehouseItemIds), [["a"], ["b"]]);
});

test("same-page committed payload applies immediately and focus, return and other-tab events refetch", async () => {
  let fetches = 0;
  let broadcastHandler;
  class BroadcastChannel {
    constructor(name) { assert.equal(name, "live-warehouse-inventory"); }
    addEventListener(name, callback) { assert.equal(name, "message"); broadcastHandler = callback; }
  }
  const payload = { state: { updatedAt: "2026-10-06T10:00:00Z", items: [{ id: "activo", name: "Unidad", quantity: 2 }], movements: [] } };
  const { sandbox, documentListeners, windowListeners } = context({ protocol: "http:", BroadcastChannel, fetch: async () => {
    fetches += 1;
    return { ok: true, json: async () => payload };
  } });
  await run(sandbox, "initEquipmentWarehouseInventorySync()");
  assert.equal(fetches, 1);
  for (const [name, event] of [["focus", {}], ["hashchange", {}], ["storage", { key: "liveWarehouseInventoryCommitted" }]]) {
    windowListeners.get(name)(event);
    await run(sandbox, "equipmentWarehouseInventoryState.refreshPromise");
  }
  documentListeners.get("visibilitychange")();
  await run(sandbox, "equipmentWarehouseInventoryState.refreshPromise");
  assert.equal(fetches, 5);
  documentListeners.get("live:warehouse-server-updated")({ detail: { state: {
    updatedAt: "2026-10-06T11:00:00Z", items: [{ id: "activo", name: "Unidad", quantity: 0 }], movements: []
  } } });
  assert.equal(run(sandbox, "equipmentWarehouseInventoryState.records[0].available"), 0);
  broadcastHandler({ data: { state: {
    updatedAt: "2026-10-06T12:00:00Z", items: [{ id: "activo", name: "Unidad", quantity: 4 }], movements: []
  } } });
  assert.equal(run(sandbox, "equipmentWarehouseInventoryState.records[0].available"), 4);
});
