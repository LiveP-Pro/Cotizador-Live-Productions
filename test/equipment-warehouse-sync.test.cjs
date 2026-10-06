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

test("aliases and canonical source keys map renamed active stock once without changing event templates", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const sections = [{ title: "Categoria original", items: [[2, "Unidad original"], [3, "Nombre intermedio"]] }];
    equipmentState.events = [{ id: "evento-prueba", active: true, sections }];
    const original = JSON.stringify(sections);
    applyEquipmentWarehouseInventoryPayload({ state: {
      items: [{ id: "activo-1", name: "Unidad actual", sourceKey: "unidad original",
        descriptionAliases: ["Unidad original", "Nombre intermedio", "Nombre intermedio"],
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
    identity: "unidad original", observation: "Nota del inventario: Nota vigente" }]);
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
      descriptionAliases: [], itemType: "consumible", category: "Primera", quantity: 5 }], movements: [] } };
    applyEquipmentWarehouseInventoryPayload(payload);
    const first = equipmentRowsSummary().find((row) => row.inventorySourceItem);
    payload.state.items[0] = { ...payload.state.items[0], name: "Unidad final", category: "Final",
      itemType: "equipo", quantity: 0, descriptionAliases: ["Unidad actual"], notes: "Nota final" };
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

test("stable source identity retains transfer choices after active names change", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    const payload = { state: { items: [{ id: "activo", name: "Unidad original", sourceKey: "unidad original", quantity: 5 }], movements: [] } };
    applyEquipmentWarehouseInventoryPayload(payload);
    const selections = { "evento-a::evento-b": [{ identity: "unidad original", quantity: 2 }] };
    payload.state.items[0] = { ...payload.state.items[0], name: "Unidad renombrada", descriptionAliases: ["Unidad original"] };
    applyEquipmentWarehouseInventoryPayload(payload);
    return { normalized: normalizeEquipmentTransferLegSelections(selections),
      oldIdentity: equipmentInventoryIdentityForDescription("Unidad original"),
      newIdentity: equipmentInventoryIdentityForDescription("Unidad renombrada") };
  })()`));
  assert.equal(result.oldIdentity, "unidad original");
  assert.equal(result.newIdentity, "unidad original");
  assert.deepEqual(result.normalized, { "evento-a::evento-b": [{ identity: "unidad original", quantity: 2 }] });
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

test("category disambiguates a current name colliding with another item's source key and alias", () => {
  const { sandbox } = context();
  const result = plain(run(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "a", name: "Unidad B", sourceKey: "unidad a", category: "Categoria A", quantity: 5 },
      { id: "b", name: "Unidad C", sourceKey: "unidad b", descriptionAliases: ["Unidad B"], category: "Categoria B", quantity: 4 }
    ], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [{ title: "Categoria B", items: [[3, "Unidad B"]] }] }];
    const rows = equipmentRowsSummary().filter((row) => row.type === "item");
    const display = equipmentLiveSectionsForDisplay(equipmentState.events[0].sections);
    const dispatch = equipmentWarehouseDispatchItems(equipmentState.events[0]);
    return { rows: rows.map((row) => ({ name: row.description, required: row.quantity, available: equipmentInventoryAvailableValueFor(row) })),
      display, dispatch, stableSelection: normalizeEquipmentTransferLegSelections({ "a::b": [{ identity: "unidad b", quantity: 2 }] }) };
  })()`));
  assert.deepEqual(result.rows, [{ name: "Unidad B", required: 0, available: 5 }, { name: "Unidad C", required: 3, available: 4 }]);
  assert.equal(result.display[0].title, "Categoria B");
  assert.equal(result.display[0].items[0].description, "Unidad C");
  assert.deepEqual(result.dispatch[0].warehouseItemIds, ["b"]);
  assert.equal(result.dispatch[0].description, "Unidad C");
  assert.equal(result.dispatch[0].category, "Categoria B");
  assert.deepEqual(result.stableSelection, { "a::b": [{ identity: "unidad b", quantity: 2 }] });
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
        { title: "Categoria A", items: [[requiredA, "Unidad compartida"]] },
        { title: "Categoria B", items: [[requiredB, "Unidad compartida"]] }
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
