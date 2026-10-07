const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Only synthetic current sources are used; no service or equipment catalog is loaded.
function context() {
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: false }),
    window: {
      requerimientoEquipoCatalog: { services: {}, groups: [] },
      requerimientoEquipoInventory: { categories: [] },
      location: { protocol: "file:", hash: "#requerimiento-equipo" },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: { querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, dispatchEvent() {} }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  return sandbox;
}

function run(sandbox, source) { return JSON.parse(JSON.stringify(vm.runInContext(source, sandbox))); }

test("base three plus selected extra two produces one demand five despite stock two", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [{ id: "audio-1", name: "Unidad sintetica", sourceKey: "unidad sintetica", category: "Audio", quantity: 2 }], movements: [] } });
    equipmentState.events = [{ id: "evento-a", active: true, setupAt: "2026-10-09T08:00", date: "2026-10-09", equipmentInAt: "2026-10-09T20:00", sections: [
      { title: "Audio", items: [[3, "Unidad sintetica"]] },
      { title: "Extras / Ceremonia", manualSection: true, items: [{ id: "extra-1", quantity: 2, description: "Unidad sintetica", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" }] }
    ] }];
    const source = JSON.stringify(equipmentState.events);
    const rows = equipmentRowsSummary();
    return { rows: rows.filter(row => row.type === "item").map(row => ({ name: row.description, category: row.categoryTitle, quantity: row.quantity, eventQuantity: row.eventQuantities.get("evento-a"), available: equipmentInventoryAvailableValueFor(row) })),
      categories: rows.filter(row => row.type === "category").map(row => row.title),
      dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]),
      rentals: equipmentRentalRows().map(row => ({ quantity: row.quantity, inventory: row.inventory, missing: row.missing })),
      unchanged: source === JSON.stringify(equipmentState.events), physical: equipmentWarehouseInventoryState.recordsById.get("audio-1").physical };
  })()`);
  assert.deepEqual(result.rows, [{ name: "Unidad sintetica", category: "Audio", quantity: 5, eventQuantity: 5, available: 2 }]);
  assert.ok(!result.categories.some(title => title.includes("Extras")));
  assert.equal(result.dispatch.length, 1);
  assert.equal(result.dispatch[0].quantity, 5);
  assert.deepEqual(result.dispatch[0].warehouseItemIds, ["audio-1"]);
  assert.deepEqual(result.rentals, [{ quantity: 5, inventory: 2, missing: 3 }]);
  assert.equal(result.unchanged, true);
  assert.equal(result.physical, 2);
});

test("explicit IDs keep homonymous equipment in Audio and Luces separate without allocating by capacity", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "audio-1", name: "Unidad homonima", sourceKey: "unidad homonima", category: "Audio", quantity: 1 },
      { id: "luces-1", name: "Unidad homonima", sourceKey: "unidad homonima", category: "Luces", quantity: 30 }
    ], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [
      { title: "Audio", items: [[3, "Unidad homonima"]] },
      { title: "Extras / Ceremonia", manualSection: true, items: [
        { id: "extra-a", quantity: 2, description: "Unidad homonima", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" },
        { id: "extra-b", quantity: 4, description: "Unidad homonima", warehouseInventoryId: "luces-1", inventoryCategory: "Luces" }
      ] }
    ] }];
    return { rows: equipmentRowsSummary().filter(row => row.type === "item").map(row => ({ id: row.inventorySourceItem?.warehouseInventoryId, category: row.categoryTitle, quantity: row.quantity, identity: equipmentSummaryRowIdentity(row) })), dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]) };
  })()`);
  assert.deepEqual(result.rows.map(({ id, category, quantity }) => ({ id, category, quantity })), [
    { id: "audio-1", category: "Audio", quantity: 5 }, { id: "luces-1", category: "Luces", quantity: 4 }
  ]);
  assert.notEqual(result.rows[0].identity, result.rows[1].identity);
  assert.equal(result.dispatch.length, 2);
  assert.deepEqual(result.dispatch.map(row => [row.category, row.quantity, row.warehouseItemIds]), [
    ["Audio", 5, ["audio-1"]], ["Luces", 4, ["luces-1"]]
  ]);
});

test("ambiguous unselected homonyms remain unresolved rather than silently consuming either stock", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "audio-1", name: "Unidad homonima", category: "Audio", quantity: 10 },
      { id: "luces-1", name: "Unidad homonima", category: "Luces", quantity: 10 }
    ], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [
      { title: "Audio", items: [[3, "Unidad homonima"]] },
      { title: "Luces", items: [[4, "Unidad homonima"]] },
      { title: "Extras", manualSection: true, items: [{ id: "ambiguo", quantity: 2, description: "Unidad homonima" }] }
    ] }];
    return { rows: equipmentRowsSummary().filter(row => row.type === "item").map(row => ({ id: row.inventorySourceItem?.warehouseInventoryId || null, quantity: row.quantity })), dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]) };
  })()`);
  assert.deepEqual(result.rows.filter(row => row.id), [{ id: "audio-1", quantity: 3 }, { id: "luces-1", quantity: 4 }]);
  assert.ok(result.rows.some(row => row.id === null && row.quantity === 2));
  assert.ok(result.dispatch.some(row => row.quantity === 2 && row.warehouseItemIds.length === 0));
});

test("custom Extras title survives live display while ID resolves the current equipment name", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [{ id: "audio-1", name: "Unidad vigente", sourceKey: "unidad original", category: "Audio", quantity: 4 }], movements: [] } });
    const sections = [{ id: "extras", title: "Ceremonia personalizada", manualSection: true, inventoryCategory: "Audio", items: [{ id: "extra", quantity: 0, description: "Unidad original", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" }] }];
    const source = JSON.stringify(sections);
    return { display: equipmentLiveSectionsForDisplay(sections), unchanged: source === JSON.stringify(sections) };
  })()`);
  assert.equal(result.display[0].title, "Ceremonia personalizada");
  assert.equal(result.display[0].manualSection, true);
  assert.equal(result.display[0].items[0].description, "Unidad vigente");
  assert.equal(result.display[0].items[0].quantity, 0);
  assert.equal(result.display[0].items[0].warehouseInventoryId, "audio-1");
  assert.equal(result.unchanged, true);
});

test("event section snapshot round trip retains zero, explicit selection and manual source category", () => {
  const result = run(context(), `(() => {
    const source = [{ id: "extras", title: "Ceremonia personalizada", manualSection: true, inventoryCategory: "Audio", items: [{ id: "extra", quantity: 0, description: "Unidad", warehouseInventoryId: "audio-1", inventoryCategory: "Audio", sourceItemIndex: 4, editable: true, manual: true }] }];
    const copied = cloneEquipmentSnapshotSections(source);
    const restored = cloneEquipmentEventForEditable({ id: "evento", sections: copied, manualExtras: source[0].items, setupAt: "2026-10-09T08:00", date: "2026-10-09", equipmentInAt: "2026-10-09T20:00" });
    return { copied, restored, normalized: normalizeEquipmentItem(source[0].items[0]), unchanged: source[0].items[0].quantity === 0 };
  })()`);
  assert.equal(result.copied[0].manualSection, true);
  assert.equal(result.copied[0].inventoryCategory, "Audio");
  for (const item of [result.copied[0].items[0], result.restored.sections[0].items[0], result.restored.manualExtras[0], result.normalized]) {
    assert.equal(item.warehouseInventoryId, "audio-1");
    assert.equal(item.inventoryCategory, "Audio");
    assert.equal(item.quantity, 0);
    assert.equal(item.sourceItemIndex, 4);
  }
  assert.equal(result.restored.setupAt, "2026-10-09T08:00");
  assert.equal(result.restored.equipmentInAt, "2026-10-09T20:00");
  assert.equal(result.unchanged, true);
});

test("without warehouse data selected extras use canonical source name and category without merging homonyms", () => {
  const result = run(context(), `(() => {
    equipmentState.events = [{ id: "evento", active: true, sections: [
      { title: "Audio", items: [[3, "Unidad sintetica"]] },
      { title: "Luces", items: [[4, "Unidad sintetica"]] },
      { title: "Extras / Ceremonia", manualSection: true, items: [{ id: "extra", quantity: 2, description: "  UNIDAD sintetica  ", inventoryCategory: "Audio" }] }
    ] }];
    const source = JSON.stringify(equipmentState.events);
    const rows = equipmentRowsSummary();
    return { rows: rows.filter(row => row.type === "item").map(row => ({ category: row.categoryTitle, quantity: row.quantity, identity: equipmentSummaryRowIdentity(row), key: row.key })), categories: rows.filter(row => row.type === "category").map(row => row.title), unchanged: source === JSON.stringify(equipmentState.events) };
  })()`);
  assert.deepEqual(result.rows.map(row => [row.category, row.quantity]), [["Audio", 5], ["Luces", 4]]);
  assert.notEqual(result.rows[0].identity, result.rows[1].identity);
  assert.notEqual(result.rows[0].key, result.rows[1].key);
  assert.ok(!result.categories.some(title => title.includes("Extras")));
  assert.equal(result.unchanged, true);
});

test("zero warehouse stock still keeps required base and extra quantities and source rows intact", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [{ id: "audio-1", name: "Unidad", category: "Audio", quantity: 0 }], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [
      { title: "Audio", items: [[3, "Unidad"], [0, "Nota sintetica"]] },
      { title: "Extras", manualSection: true, items: [{ id: "extra", quantity: 2, description: "Unidad", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" }] }
    ] }];
    const source = JSON.stringify(equipmentState.events);
    return { rows: equipmentRowsSummary().filter(row => row.type === "item").map(row => ({ name: row.description, quantity: row.quantity, available: equipmentInventoryAvailableValueFor(row) })), unchanged: source === JSON.stringify(equipmentState.events), physical: equipmentWarehouseInventoryState.recordsById.get("audio-1").physical };
  })()`);
  assert.ok(result.rows.some(row => row.name === "Unidad" && row.quantity === 5 && row.available === 0));
  assert.ok(result.rows.some(row => row.name === "Nota sintetica" && row.quantity === 0));
  assert.equal(result.unchanged, true);
  assert.equal(result.physical, 0);
});

test("explicit ID removed from active inventory cannot fall back to a surviving homonym", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "audio-1", name: "Unidad", category: "Audio", quantity: 8, archived: true },
      { id: "luces-1", name: "Unidad", category: "Luces", quantity: 20 }
    ], movements: [] } });
    equipmentState.events = [{ id: "evento", active: true, sections: [{ title: "Extras", manualSection: true, items: [{ id: "extra", quantity: 2, description: "Unidad", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" }] }] }];
    return { rows: equipmentRowsSummary().filter(row => row.type === "item").map(row => ({ id: row.inventorySourceItem?.warehouseInventoryId || null, quantity: row.quantity, available: equipmentInventoryAvailableValueFor(row) })), dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]) };
  })()`);
  assert.ok(result.rows.some(row => row.id === "luces-1" && row.quantity === 0));
  assert.ok(result.rows.some(row => row.id === null && row.quantity === 2 && row.available === 0));
  assert.deepEqual(result.dispatch[0].warehouseItemIds, []);
});

test("extras retain per-event quantities and established timing reuse rules", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [{ id: "audio-1", name: "Unidad", category: "Audio", quantity: 2 }], movements: [] } });
    const sections = (base, extra) => [{ title: "Audio", items: [[base, "Unidad"]] }, { title: "Extras", manualSection: true, items: [{ id: "extra", quantity: extra, description: "Unidad", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" }] }];
    equipmentState.events = [
      { id: "a", active: true, setupAt: "2026-10-09T08:00", date: "2026-10-09", equipmentInAt: "2026-10-09T20:00", sections: sections(3, 2) },
      { id: "b", active: true, setupAt: "2026-10-11T08:00", date: "2026-10-11", equipmentInAt: "2026-10-11T20:00", sections: sections(1, 1) }
    ];
    const source = JSON.stringify(equipmentState.events);
    const separated = equipmentRowsSummary().find(row => row.inventorySourceItem?.warehouseInventoryId === "audio-1");
    const unchanged = source === JSON.stringify(equipmentState.events);
    equipmentState.events[1].setupAt = "2026-10-09T10:00"; equipmentState.events[1].date = "2026-10-09"; equipmentState.events[1].equipmentInAt = "2026-10-09T22:00";
    const overlapping = equipmentRowsSummary().find(row => row.inventorySourceItem?.warehouseInventoryId === "audio-1");
    return { separated: { quantity: separated.quantity, original: separated.originalQuantity, events: [...separated.eventQuantities] }, overlapping: { quantity: overlapping.quantity, events: [...overlapping.eventQuantities] }, unchanged };
  })()`);
  assert.deepEqual(result.separated, { quantity: 5, original: 7, events: [["a", 5], ["b", 2]] });
  assert.deepEqual(result.overlapping, { quantity: 7, events: [["a", 5], ["b", 2]] });
  assert.equal(result.unchanged, true);
});

test("Backline transfer quantities use the explicitly chosen ID despite custom section title", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "audio-1", name: "Unidad", sourceKey: "unidad", category: "Audio", quantity: 1 },
      { id: "luces-1", name: "Unidad", sourceKey: "unidad", category: "Luces", quantity: 9 }
    ], movements: [] } });
    const event = { id: "evento", sections: [{ title: "BACKLINE / Ceremonia", manualSection: true, items: [{ id: "extra", quantity: 2, description: "Unidad", warehouseInventoryId: "audio-1", inventoryCategory: "Audio" }] }] };
    return { quantities: [...equipmentEventBacklineQuantities(event)], selectedIdentity: equipmentWarehouseRecordIdentity(equipmentWarehouseInventoryState.recordsById.get("audio-1")) };
  })()`);
  assert.deepEqual(result.quantities, [[result.selectedIdentity, 2]]);
});

test("unknown source homonyms keep their scoped identities in Backline and warehouse dispatch", () => {
  const result = run(context(), `(() => {
    const event = { id: "evento", sections: [
      { title: "BACKLINE / Audio", manualSection: true, inventoryCategory: "Audio", items: [{ quantity: 2, description: "Unidad desconocida", inventoryCategory: "Audio" }] },
      { title: "BACKLINE / Luces", manualSection: true, inventoryCategory: "Luces", items: [{ quantity: 3, description: "Unidad desconocida", inventoryCategory: "Luces" }] }
    ] };
    equipmentState.events = [event];
    const source = JSON.stringify(event);
    return { summary: equipmentRowsSummary().filter(row => row.type === "item").map(row => ({ identity: equipmentSummaryRowIdentity(row), quantity: row.quantity })),
      backline: [...equipmentEventBacklineQuantities(event)], dispatch: equipmentWarehouseDispatchItems(event), unchanged: source === JSON.stringify(event) };
  })()`);
  assert.equal(result.summary.length, 2);
  assert.notEqual(result.summary[0].identity, result.summary[1].identity);
  assert.deepEqual(result.backline, result.summary.map(row => [row.identity, row.quantity]));
  assert.equal(result.dispatch.length, 2);
  assert.deepEqual(result.dispatch.map(row => row.quantity), [2, 3]);
  assert.deepEqual(result.dispatch.map(row => row.warehouseItemIds), [[], []]);
  assert.equal(result.unchanged, true);
});

test("legacy ambiguous extra explicitly marks warehouse lookup unresolved to prevent backend name fallback", () => {
  const result = run(context(), `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "audio-1", name: "Unidad", category: "Audio", quantity: 8 },
      { id: "luces-1", name: "Unidad", category: "Luces", quantity: 9 }
    ], movements: [] } });
    const event = { id: "evento", sections: [{ title: "Extras", manualSection: true, items: [{ quantity: 2, description: "Unidad" }] }] };
    equipmentState.events = [event];
    return { rows: equipmentRowsSummary().filter(row => row.type === "item").map(row => ({ id: row.inventorySourceItem?.warehouseInventoryId || null, quantity: row.quantity, available: equipmentInventoryAvailableValueFor(row) })), dispatch: equipmentWarehouseDispatchItems(event) };
  })()`);
  assert.deepEqual(result.rows, [{ id: "audio-1", quantity: 0, available: 8 }, { id: "luces-1", quantity: 0, available: 9 }, { id: null, quantity: 2, available: 0 }]);
  assert.equal(result.dispatch.length, 1);
  assert.equal(result.dispatch[0].quantity, 2);
  assert.deepEqual(result.dispatch[0].warehouseItemIds, []);
  assert.equal(result.dispatch[0].inventoryMatchUnresolved, true);
});

test("scoped unknown equipment names containing slashes retain selected transfer quantities", () => {
  const result = run(context(), `(() => {
    const sections = () => [{ title: "Audio", items: [[2, "Unidad / vocal"]] }, { title: "Luces", items: [[3, "Unidad / vocal"]] }];
    const from = { id: "a", setupAt: "2026-10-10T08:00", date: "2026-10-10", equipmentInAt: "2026-10-10T12:00", sections: sections() };
    const to = { id: "b", setupAt: "2026-10-11T08:00", date: "2026-10-11", equipmentInAt: "2026-10-11T12:00", sections: sections() };
    equipmentState.events = [from, to];
    const source = JSON.stringify(equipmentState.events);
    const candidates = equipmentTransferredItemsBetweenEvents(from, to);
    const route = { id: "ruta", legSelections: {} };
    equipmentSetTransferLegSelections(route, from, to, candidates);
    return { candidates: candidates.map(row => [row.identity, row.quantity]), saved: route.legSelections["a::b"].map(row => [row.identity, row.quantity]),
      selected: equipmentSelectedTransferredItemsBetweenEvents(route, from, to, candidates).map(row => [row.identity, row.quantity]), unchanged: source === JSON.stringify(equipmentState.events) };
  })()`);
  assert.equal(result.candidates.length, 2);
  assert.deepEqual(result.saved, result.candidates);
  assert.deepEqual(result.selected, result.candidates);
  assert.equal(result.unchanged, true);
});
