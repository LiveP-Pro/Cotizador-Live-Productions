const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// All services, equipment and documents below are synthetic current sources.
// The application catalogs, stored inventories and credentials are never read.
function context() {
  const elements = new Map();
  const selectors = new Map();
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: false }),
    window: {
      requerimientoEquipoCatalog: {
        services: {}, groups: [{ id: "synthetic", label: "Servicios sintéticos", serviceIds: [] }]
      },
      requerimientoEquipoInventory: { categories: [] },
      location: { protocol: "file:", hash: "#requerimiento-equipo" },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: {
      querySelector(selector) { return elements.get(selector) || null; },
      querySelectorAll(selector) { return selectors.get(selector) || []; },
      addEventListener() {}, dispatchEvent() {}
    }
  };
  sandbox.globalThis = sandbox;
  sandbox.testElements = elements;
  sandbox.testSelectors = selectors;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  return sandbox;
}

const evaluate = (sandbox, source) => vm.runInContext(source, sandbox);
const plain = (value) => JSON.parse(JSON.stringify(value));
const occurrences = (html, value) => html.split(value).length - 1;
const categoryCount = (html) => occurrences(html, 'class="equipment-category-row"');

function service(name, sections, importSource) {
  return { name, custom: true, groupId: "synthetic", mainSections: sections, ...(importSource ? { importSource } : {}) };
}

function install(sandbox, services, selectedIds = Object.keys(services)) {
  sandbox.syntheticCatalog = { services };
  sandbox.syntheticSelectedIds = selectedIds;
  evaluate(sandbox, "applyEquipmentCatalogOverrides(syntheticCatalog); setEquipmentServiceSelection(syntheticSelectedIds);");
}

test("multiple services group repeated normalized categories while retaining distinct source rows and snapshots", () => {
  const sandbox = context();
  install(sandbox, {
    first: service("Servicio sintético uno", [
      { id: "first-audio", title: "Áudio", items: [[0, "Unidad homónima"]], rows: [{ type: "item", sourceItemIndex: 0, notes: ["Nota del primer audio"] }] },
      { id: "first-light", title: "Iluminación", items: [[2, "Unidad homónima"]], rows: [{ type: "item", sourceItemIndex: 0, notes: ["Nota de iluminación"] }] }
    ]),
    second: service("Servicio sintético dos", [
      { id: "second-audio", title: "  AUDIO  ", items: [[4, "Unidad homónima"]], rows: [{ type: "item", sourceItemIndex: 0, notes: ["Nota del segundo audio"] }] }
    ])
  });
  const result = plain(evaluate(sandbox, `(() => {
    const sections = selectedEquipmentSections();
    const sourceBefore = JSON.stringify(equipmentServices);
    const sectionsBefore = JSON.stringify(sections);
    const snapshotBefore = JSON.stringify(captureEquipmentEventSnapshot());
    const groups = equipmentDisplaySectionGroups(sections);
    const html = tableForEquipmentSections(sections, true);
    return {
      groups: groups.map(group => ({ id: group.id, category: normalizeEquipmentKey(group.title),
        sourceIds: group.sections.map(section => section.id),
        items: group.sections.flatMap(section => section.items.map(item => ({ id: item.id, quantity: item.quantity, name: item.description, sourceItemIndex: item.sourceItemIndex }))) })),
      sourceIds: sections.map(section => section.id), html,
      unchanged: sourceBefore === JSON.stringify(equipmentServices) && sectionsBefore === JSON.stringify(sections)
        && snapshotBefore === JSON.stringify(captureEquipmentEventSnapshot())
    };
  })()`));
  assert.deepEqual(result.groups.map(group => group.category), ["audio", "iluminacion"]);
  assert.equal(new Set(result.groups.map(group => group.id)).size, 2);
  assert.deepEqual(result.groups[0].sourceIds, [result.sourceIds[0], result.sourceIds[2]]);
  assert.deepEqual(result.groups[1].sourceIds, [result.sourceIds[1]]);
  assert.deepEqual(result.groups.map(group => group.items.map(item => item.quantity)), [[0, 4], [2]]);
  assert.deepEqual(result.groups[0].items.map(item => item.sourceItemIndex), [0, 0]);
  assert.equal(new Set(result.groups.flatMap(group => group.items.map(item => item.id))).size, 3);
  assert.equal(categoryCount(result.html), 2);
  assert.equal(occurrences(result.html, "Unidad homónima"), 3);
  for (const note of ["Nota del primer audio", "Nota de iluminación", "Nota del segundo audio"]) {
    assert.equal(occurrences(result.html, note), 1);
  }
  assert.equal(result.unchanged, true);
});

test("alternating live categories render one heading each, every source row once, and edit the original item", () => {
  const sandbox = context();
  install(sandbox, {
    mixed: service("Servicio sintético mixto", [{
      id: "mixed-source", title: "Cuadro sintético", items: [[0, "Audio sintético primero"], [2, "Luz sintética"], [3, "Audio sintético último"]],
      rows: [
        { type: "header", description: "Encabezado sintético del cuadro" },
        { type: "item", sourceItemIndex: 0, notes: ["Nota del audio cero"] },
        { type: "note", description: "Observación después del audio cero" },
        { type: "item", sourceItemIndex: 1, notes: ["Nota de la luz"] },
        { type: "item", sourceItemIndex: 2, notes: ["Nota del último audio"] },
        { type: "note", description: "Observación final del cuadro" }
      ], notes: ["Observación final del cuadro"]
    }], { fileName: "Fuente sintética mixta.xlsx", sourceFileUrl: "/api/cuadros-equipo/fuentes/synthetic-mixed" })
  });
  const result = plain(evaluate(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { movements: [], items: [
      { id: "stock-a", name: "Audio sintético primero", category: "Audio", quantity: 10 },
      { id: "stock-light", name: "Luz sintética", category: "Iluminación", quantity: 10 },
      { id: "stock-b", name: "Audio sintético último", category: "Audio", quantity: 10 }
    ] } });
    const sections = selectedEquipmentSections();
    const before = JSON.stringify(sections);
    const snapshotBefore = JSON.stringify(captureEquipmentEventSnapshot());
    const sourceBefore = JSON.stringify(equipmentServices);
    const groups = equipmentDisplaySectionGroups(equipmentLiveSectionsForDisplay(sections));
    const compact = tableForEquipmentSections(sections, true);
    const editable = tableForEquipmentSections(sections, false);
    const unchanged = before === JSON.stringify(sections) && snapshotBefore === JSON.stringify(captureEquipmentEventSnapshot());
    const lastId = sections[0].items[2].id;
    updateEquipmentItem(lastId, "quantity", "7");
    return {
      groups: groups.map(group => ({ id: group.id, title: group.title,
        sourceIds: group.sections.map(section => section.id),
        indices: group.sections.map(section => section.items.map(item => item.sourceItemIndex)) })),
      originalId: sections[0].id, lastId, compact, editable, unchanged,
      edited: selectedEquipmentSections()[0].items.map(item => item.quantity),
      sourceUnchanged: sourceBefore === JSON.stringify(equipmentServices)
    };
  })()`));
  assert.deepEqual(result.groups.map(group => group.title), ["Audio", "Iluminación"]);
  assert.equal(new Set(result.groups.map(group => group.id)).size, 2);
  assert.deepEqual(result.groups[0].indices, [[0], [2]]);
  assert.deepEqual(result.groups[1].indices, [[1]]);
  assert.ok(result.groups.every(group => group.sourceIds.every(id => id === result.originalId)));
  assert.equal(categoryCount(result.compact), 2);
  assert.equal(categoryCount(result.editable), 2);
  assert.ok(result.compact.indexOf("Audio sintético primero") < result.compact.indexOf("Audio sintético último"));
  assert.ok(result.compact.indexOf("Audio sintético último") < result.compact.indexOf("Luz sintética"));
  assert.match(result.compact, /class="equipment-qty equipment-service-quantity-cell">0<\/td>/);
  for (const text of ["Encabezado sintético del cuadro", "Nota del audio cero", "Observación después del audio cero", "Nota de la luz", "Nota del último audio", "Observación final del cuadro", "Fuente sintética mixta.xlsx"]) {
    assert.equal(occurrences(result.compact, text), 1, text);
    assert.equal(occurrences(result.editable, text), 1, text);
  }
  assert.equal(occurrences(result.editable, `data-equipment-item-id="${result.lastId}"`), 2);
  assert.deepEqual(result.edited, [0, 2, 7]);
  assert.equal(result.unchanged, true);
  assert.equal(result.sourceUnchanged, true);
});

test("manual and standalone document headings remain independent of matching service categories", () => {
  const sandbox = context();
  sandbox.syntheticSections = [
    { id: "source-a", title: "Audio", inventoryCategory: "Audio", items: [{ id: "source-a-0", quantity: 1, description: "Equipo de servicio" }] },
    { id: "manual-a", title: "Audio", manualSection: true, items: [{ id: "manual-a-0", quantity: 2, description: "Extra sintético" }] },
    { id: "document-a", title: "Audio", documentSection: true, items: [{ id: "document-a-0", quantity: 0, description: "Equipo documental", sourceItemIndex: 0 }],
      rows: [{ type: "header", description: "Encabezado documental" }, { type: "item", sourceItemIndex: 0, notes: ["Nota documental"] }],
      importSource: { fileName: "Documento sintético.pdf", sourceFileUrl: "/api/cuadros-equipo/fuentes/synthetic-document" } },
    { id: "manual-custom", title: "Ceremonia personalizada", manualSection: true, items: [{ id: "custom-0", quantity: 3, description: "Extra de ceremonia" }] },
    { id: "source-b", title: "AUDIO", inventoryCategory: "AUDIO", items: [{ id: "source-b-0", quantity: 4, description: "Otro equipo de servicio" }] }
  ];
  const result = plain(evaluate(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { movements: [], items: [
      { id: "document-stock", name: "Nombre de bodega distinto", sourceKey: "Equipo documental", category: "Categoría de bodega", quantity: 10 }
    ] } });
    const before = JSON.stringify(syntheticSections);
    const groups = equipmentDisplaySectionGroups(equipmentLiveSectionsForDisplay(syntheticSections));
    return { groups: groups.map(group => ({ id: group.id, title: group.title, sourceIds: group.sections.map(section => section.id) })),
      html: tableForEquipmentSections(syntheticSections, true), unchanged: before === JSON.stringify(syntheticSections) };
  })()`));
  assert.deepEqual(result.groups.map(group => group.sourceIds), [["source-a", "source-b"], ["manual-a"], ["document-a"], ["manual-custom"]]);
  assert.deepEqual(result.groups.map(group => group.title), ["Audio", "Audio", "Audio", "Ceremonia personalizada"]);
  assert.equal(new Set(result.groups.map(group => group.id)).size, 4);
  assert.equal(categoryCount(result.html), 4);
  for (const text of ["Equipo documental", "Encabezado documental", "Nota documental", "Documento sintético.pdf", "Ceremonia personalizada"]) {
    assert.equal(occurrences(result.html, text), 1);
  }
  assert.ok(!result.html.includes("Nombre de bodega distinto"));
  assert.equal(result.unchanged, true);
});

test("category controls select the displayed category but update its original source section", () => {
  const sandbox = context();
  install(sandbox, {
    mixed: service("Servicio sintético con homónimos", [{ id: "mixed-source", title: "Cuadro sintético", items: [[2, "Unidad homónima"], [3, "Unidad homónima"]] }])
  });
  const controls = plain(evaluate(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { movements: [], items: [
      { id: "stock-audio", name: "Unidad homónima", category: "Audio", quantity: 10 },
      { id: "stock-light", name: "Unidad homónima", category: "Iluminación", quantity: 10 }
    ] } });
    const raw = selectedEquipmentSections()[0];
    equipmentState.itemOverrides.set(raw.items[0].id, { warehouseInventoryId: "stock-audio", inventoryCategory: "Audio" });
    equipmentState.itemOverrides.set(raw.items[1].id, { warehouseInventoryId: "stock-light", inventoryCategory: "Iluminación" });
    const groups = equipmentDisplaySectionGroups(equipmentLiveSectionsForDisplay(selectedEquipmentSections()));
    const light = groups.find(group => group.title === "Iluminación");
    equipmentState.expandedEquipmentSectionIds.add(light.id);
    return { sectionId: raw.id, displayId: light.id, title: light.title, html: tableForEquipmentSections(selectedEquipmentSections(), false) };
  })()`));
  assert.ok(controls.html.includes(`data-equipment-category-add="${controls.sectionId}"`));
  assert.ok(controls.html.includes(`data-equipment-category-display-id="${controls.displayId}"`));
  assert.ok(controls.html.includes('data-equipment-category-title="Iluminación"'));
  assert.ok(controls.html.includes(`data-equipment-category-choice="${controls.displayId}"`));
  assert.ok(controls.html.includes(`data-equipment-category-quantity="${controls.displayId}"`));
  sandbox.testSelectors.set("[data-equipment-category-choice]", [{ dataset: { equipmentCategoryChoice: controls.displayId }, value: "Unidad homónima" }]);
  sandbox.testSelectors.set("[data-equipment-category-quantity]", [{ dataset: { equipmentCategoryQuantity: controls.displayId }, value: "4" }]);
  sandbox.syntheticControl = controls;
  const result = plain(evaluate(sandbox, `(() => {
    addEquipmentChoiceToSection(syntheticControl.sectionId, syntheticControl.displayId, syntheticControl.title);
    return { items: selectedEquipmentSections()[0].items.map(item => ({ quantity: item.quantity, inventoryId: item.warehouseInventoryId })),
      source: equipmentServices.mixed.mainSections[0].items, added: [...equipmentState.sectionAddedItems.keys()] };
  })()`));
  assert.deepEqual(result.items, [{ quantity: 2, inventoryId: "stock-audio" }, { quantity: 7, inventoryId: "stock-light" }]);
  assert.deepEqual(result.source, [[2, "Unidad homónima"], [3, "Unidad homónima"]]);
  assert.deepEqual(result.added, []);
});

test("added equipment keeps imported notes with their original source item after category splitting", () => {
  const sandbox = context();
  install(sandbox, {
    imported: service("Servicio sintético con notas", [{
      id: "notes-source", title: "Cuadro sintético", items: [[1, "Audio original"], [2, "Luz original"]],
      rows: [
        { type: "header", description: "Encabezado original con notas" },
        { type: "item", sourceItemIndex: 0, notes: ["Nota ligada a audio original"] },
        { type: "item", sourceItemIndex: 1, notes: ["Nota ligada a luz original"] }
      ]
    }])
  });
  const result = plain(evaluate(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { movements: [], items: [
      { id: "original-audio", name: "Audio original", category: "Audio", quantity: 10 },
      { id: "original-light", name: "Luz original", category: "Iluminación", quantity: 10 },
      { id: "added-light", name: "Luz agregada", category: "Iluminación", quantity: 10 },
      { id: "added-structure", name: "Estructura agregada", category: "Estructuras", quantity: 10 }
    ] } });
    const raw = selectedEquipmentSections()[0];
    equipmentState.sectionAddedItems.set(raw.id, [
      { id: "synthetic-added-light", quantity: 4, description: "Luz agregada", warehouseInventoryId: "added-light", inventoryCategory: "Iluminación", manual: true },
      { id: "synthetic-added-structure", quantity: 5, description: "Estructura agregada", warehouseInventoryId: "added-structure", inventoryCategory: "Estructuras", manual: true }
    ]);
    return { html: tableForEquipmentSections(selectedEquipmentSections(), true),
      originals: equipmentServices.imported.mainSections[0].items };
  })()`));
  for (const text of ["Audio original", "Luz original", "Luz agregada", "Estructura agregada", "Encabezado original con notas", "Nota ligada a audio original", "Nota ligada a luz original"]) {
    assert.equal(occurrences(result.html, text), 1, text);
  }
  assert.ok(result.html.indexOf("Luz original") < result.html.indexOf("Nota ligada a luz original"));
  assert.ok(result.html.indexOf("Nota ligada a luz original") < result.html.indexOf("Luz agregada"));
  assert.ok(result.html.indexOf("Audio original") < result.html.indexOf("Nota ligada a audio original"));
  assert.deepEqual(result.originals, [[1, "Audio original"], [2, "Luz original"]]);
});

test("an unavailable selected warehouse item retains its saved category instead of its source section category", () => {
  const sandbox = context();
  sandbox.syntheticSections = [{
    id: "audio-source", title: "Servicio sintético / Audio", inventoryCategory: "Audio", items: [
      { id: "original-audio", quantity: 2, description: "Audio sintético", warehouseInventoryId: "current-audio", inventoryCategory: "Audio" },
      { id: "added-light", quantity: 3, description: "Luz sintética archivada", warehouseInventoryId: "archived-light", inventoryCategory: "Iluminación", manual: true }
    ]
  }];
  const result = plain(evaluate(sandbox, `(() => {
    applyEquipmentWarehouseInventoryPayload({ state: { movements: [], items: [
      { id: "current-audio", name: "Audio sintético", category: "Audio", quantity: 10 },
      { id: "archived-light", name: "Luz sintética archivada", category: "Iluminación", quantity: 10, archived: true }
    ] } });
    const before = JSON.stringify(syntheticSections);
    return { groups: equipmentDisplaySectionGroups(syntheticSections).map(group => ({ title: group.title,
      ids: group.sections.flatMap(section => section.items.map(item => item.id)) })),
      html: tableForEquipmentSections(syntheticSections, true), unchanged: before === JSON.stringify(syntheticSections) };
  })()`));
  assert.deepEqual(result.groups, [
    { title: "Audio", ids: ["original-audio"] },
    { title: "Iluminación", ids: ["added-light"] }
  ]);
  assert.equal(categoryCount(result.html), 2);
  assert.equal(occurrences(result.html, "Luz sintética archivada"), 1);
  assert.equal(result.unchanged, true);
});

test("saved event categories remain separate before warehouse hydration without changing editable source data", () => {
  const sandbox = context();
  install(sandbox, {
    saved: service("Servicio sintético guardado", [{ id: "saved-audio", title: "Audio", items: [[1, "Audio original guardado"]] }])
  });
  const result = plain(evaluate(sandbox, `(() => {
    const sourceSection = selectedEquipmentSections()[0];
    equipmentState.sectionAddedItems.set(sourceSection.id, [{
      id: "saved-added-light", quantity: 5, description: "Luz guardada sin conexión",
      warehouseInventoryId: "saved-light-stock", inventoryCategory: "Iluminación", manual: true
    }]);
    const saved = cloneEquipmentEventForEditable(JSON.parse(JSON.stringify({
      id: "synthetic-saved-event", ...captureEquipmentEventSnapshot(),
      setupAt: "2026-10-13T08:00", date: "2026-10-13", equipmentInAt: "2026-10-13T20:00"
    })));
    const savedBefore = JSON.stringify(saved);
    restoreEquipmentEventSnapshot(saved);
    const sections = selectedEquipmentSections();
    const sectionsBefore = JSON.stringify(sections);
    const snapshotBefore = JSON.stringify(captureEquipmentEventSnapshot());
    const groups = equipmentDisplaySectionGroups(sections);
    const html = tableForEquipmentSections(sections, true);
    return { loaded: equipmentWarehouseInventoryState.loaded,
      groups: groups.map(group => ({ title: group.title, items: group.sections.flatMap(section => section.items.map(item => ({ id: item.id, quantity: item.quantity }))) })),
      originalItemId: sourceSection.items[0].id, html,
      unchanged: savedBefore === JSON.stringify(saved) && sectionsBefore === JSON.stringify(sections)
        && snapshotBefore === JSON.stringify(captureEquipmentEventSnapshot())
    };
  })()`));
  assert.equal(result.loaded, false);
  assert.deepEqual(result.groups, [
    { title: "Audio", items: [{ id: result.originalItemId, quantity: 1 }] },
    { title: "Iluminación", items: [{ id: "saved-added-light", quantity: 5 }] }
  ]);
  assert.equal(categoryCount(result.html), 2);
  assert.equal(occurrences(result.html, "Luz guardada sin conexión"), 1);
  assert.equal(result.unchanged, true);
});
