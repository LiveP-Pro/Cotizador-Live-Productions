const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// All catalog, warehouse and event data in this suite are synthetic current
// sources. No application catalog, inventory, saved events or credentials are read.
const plain = (value) => JSON.parse(JSON.stringify(value));
const evaluate = (context, source) => vm.runInContext(source, context);
const occurrences = (html, value) => html.split(value).length - 1;

function source(version = "synthetic-v2") {
  return {
    authoritative: true,
    version,
    fileName: "Fuente sintética actual.xlsx",
    sourceFileUrl: "/api/cuadros-equipo/fuentes/synthetic-current",
    sheetName: "Cuadro sintético"
  };
}

function cell(ref, value) {
  return { address: ref.split("!")[1], ref, value };
}

function catalog() {
  const importSource = source();
  return {
    version: importSource.version,
    groups: [{ id: "synthetic", label: "Servicios sintéticos actuales", serviceIds: ["first", "second"] }],
    services: {
      first: {
        name: "Servicio sintético primero", importSource,
        mainSections: [{
          id: "synthetic-v2-first-audio", title: "Áudio", importSource,
          items: [[0, "Equipo literal cero"], [2, "Equipo literal dos"]],
          rows: [
            { type: "header", description: "Encabezado del cuadro actual", cells: [cell("Cuadro sintético!A2", "Encabezado del cuadro actual")] },
            { type: "category", description: "Subcategoría literal", cells: [cell("Cuadro sintético!B3", "Subcategoría literal")] },
            { type: "item", sourceType: "data", sourceItemIndex: 0, quantity: 0, description: "Equipo literal cero", notes: ["Nota de equipo cero"], cells: [cell("Cuadro sintético!A4", 0), cell("Cuadro sintético!B4", "Equipo literal cero")] },
            { type: "note", description: "Observación entre equipos", cells: [cell("Cuadro sintético!B5", "Observación entre equipos")] },
            { type: "item", sourceType: "data", sourceItemIndex: 1, quantity: 2, description: "Equipo literal dos", cells: [cell("Cuadro sintético!A6", 2), cell("Cuadro sintético!B6", "Equipo literal dos")] },
            { type: "note", description: "Observación final actual", cells: [cell("Cuadro sintético!B7", "Observación final actual")] }
          ], notes: ["Observación final actual", "Nota adicional del cuadro"]
        }, {
          id: "synthetic-v2-cell-only", title: "Pantalla sintética", importSource,
          items: [], rows: [{ type: "unlabeledQuantity", quantity: 0, description: "0", cells: [cell("Cuadro sintético!D3", 0)] }]
        }]
      },
      second: {
        name: "Servicio sintético segundo", importSource,
        mainSections: [{
          id: "synthetic-v2-second-audio", title: "  AUDIO  ", importSource,
          items: [[4, "Equipo literal cuatro"]],
          rows: [{ type: "item", sourceType: "data", sourceItemIndex: 0, quantity: 4, description: "Equipo literal cuatro", cells: [cell("Cuadro sintético!G4", 4), cell("Cuadro sintético!H4", "Equipo literal cuatro")] }]
        }]
      }
    }
  };
}

function context(currentCatalog = catalog()) {
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: false }),
    window: {
      requerimientoEquipoCatalog: plain(currentCatalog),
      requerimientoEquipoInventory: { categories: [] },
      location: { protocol: "file:", hash: "#requerimiento-equipo" },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: {
      querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener() {}, dispatchEvent() {}
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox, { filename: "equipment.js" });
  return sandbox;
}

test("authoritative services keep source names, categories and rows when warehouse names and categories disagree", () => {
  const sandbox = context();
  const result = plain(evaluate(sandbox, `(() => {
    setEquipmentServiceSelection(["first", "second"]);
    const before = JSON.stringify(equipmentServices);
    const snapshotBefore = JSON.stringify(captureEquipmentEventSnapshot());
    applyEquipmentWarehouseInventoryPayload({ state: { movements: [], items: [
      { id: "synthetic-stock-zero", name: "Bodega renombró cero", sourceKey: "Equipo literal cero", category: "Otra categoría", quantity: 40 },
      { id: "synthetic-stock-two", name: "Bodega renombró dos", sourceKey: "Equipo literal dos", category: "Categoría distinta", quantity: 50 },
      { id: "synthetic-stock-four", name: "Bodega renombró cuatro", sourceKey: "Equipo literal cuatro", category: "Otra categoría", quantity: 60 }
    ] } });
    const sections = selectedEquipmentSections();
    const live = equipmentLiveSectionsForDisplay(sections);
    const groups = equipmentDisplaySectionGroups(sections);
    return {
      sourceRows: sections.map(section => section.rows), liveRows: live.map(section => section.rows),
      names: live.flatMap(section => section.items.map(item => item.description)),
      quantities: live.flatMap(section => section.items.map(item => item.quantity)),
      groups: groups.map(group => ({ category: normalizeEquipmentKey(group.title), sections: group.sections.map(section => section.id) })),
      sourceIds: sections.map(section => section.id), compact: tableForEquipmentSections(sections, true),
      editable: tableForEquipmentSections(sections, false),
      unchanged: before === JSON.stringify(equipmentServices) && snapshotBefore === JSON.stringify(captureEquipmentEventSnapshot())
    };
  })()`));
  assert.deepEqual(result.names, ["Equipo literal cero", "Equipo literal dos", "Equipo literal cuatro"]);
  assert.deepEqual(result.quantities, [0, 2, 4]);
  assert.deepEqual(result.liveRows, result.sourceRows);
  assert.deepEqual(result.groups.map(group => group.category), ["audio", "pantalla sintetica"]);
  assert.deepEqual(result.groups[0].sections, [result.sourceIds[0], result.sourceIds[2]]);
  assert.deepEqual(result.groups[1].sections, [result.sourceIds[1]]);
  for (const html of [result.compact, result.editable]) {
    assert.equal(occurrences(html, 'class="equipment-category-row"'), 2);
    assert.ok(!html.includes("Bodega renombró"));
    assert.ok(!html.includes("Otra categoría"));
    for (const text of ["Equipo literal cero", "Equipo literal dos", "Equipo literal cuatro", "Encabezado del cuadro actual", "Subcategoría literal", "Nota de equipo cero", "Observación entre equipos", "Observación final actual", "Nota adicional del cuadro", "Fuente sintética actual.xlsx"]) {
      assert.equal(occurrences(html, text), 1, text);
    }
    assert.match(html, /data-source-row-type="unlabeledQuantity"><td colspan="[23]">0<\/td>/);
  }
  assert.match(result.compact, /class="equipment-qty equipment-service-quantity-cell">0<\/td>/);
  assert.equal(result.unchanged, true);
});

test("source-version section IDs isolate earlier session edits and keep earlier event snapshots intact", () => {
  const sandbox = context();
  const result = plain(evaluate(sandbox, `(() => {
    const oldSectionId = equipmentSectionKey({ id: "synthetic-v1-first-audio" }, 0, "main", "first");
    const oldItemId = equipmentItemKey(oldSectionId, 0);
    const historical = {
      id: "synthetic-historical-event", serviceIds: ["first"], serviceId: "first", serviceName: "Servicio sintético anterior",
      itemOverrides: [[oldItemId, { quantity: 99, description: "Edición de sesión sintética anterior" }]],
      removedItemIds: [equipmentItemKey(oldSectionId, 1)],
      sectionAddedItems: [[oldSectionId, [{ id: "synthetic-added-before", quantity: 5, description: "Agregado anterior", manual: true }]]],
      sections: [{ id: oldSectionId, title: "Categoría sintética anterior", importSource: { authoritative: true, version: "synthetic-v1", fileName: "Fuente sintética anterior.xlsx" },
        items: [{ id: oldItemId, quantity: 99, description: "Edición de sesión sintética anterior", sourceItemIndex: 0 }],
        rows: [{ type: "item", sourceItemIndex: 0, description: "Equipo original de evento anterior", cells: [{ ref: "Anterior!A4", value: 1 }] }] }]
    };
    equipmentState.events = [historical];
    const historicalBefore = JSON.stringify(historical);
    restoreEquipmentEventSnapshot(historical);
    const current = selectedEquipmentSections();
    const saved = sectionsForEquipmentEvent(historical);
    const editable = cloneEquipmentEventForEditable(historical);
    const compactSaved = tableForEquipmentSections(saved, true);
    return {
      currentIds: current.map(section => section.id), oldSectionId,
      currentItems: current.flatMap(section => section.items.map(item => [item.quantity, item.description])),
      saved, editable, compactSaved, historicalUnchanged: historicalBefore === JSON.stringify(historical)
    };
  })()`));
  assert.ok(result.currentIds.every(id => id !== result.oldSectionId && id.includes("synthetic-v2")));
  assert.deepEqual(result.currentItems, [[0, "Equipo literal cero"], [2, "Equipo literal dos"]]);
  assert.deepEqual(result.editable.sections, result.saved);
  assert.equal(result.saved[0].importSource.version, "synthetic-v1");
  assert.equal(result.saved[0].items[0].quantity, 99);
  assert.equal(result.saved[0].items[0].description, "Edición de sesión sintética anterior");
  assert.match(result.compactSaved, /Edición de sesión sintética anterior/);
  assert.ok(!result.compactSaved.includes("Equipo literal dos"));
  assert.equal(result.historicalUnchanged, true);
});

test("a catalog override from an earlier base version cannot replace or remove current authoritative services", () => {
  const sandbox = context();
  const result = plain(evaluate(sandbox, `(() => {
    setEquipmentServiceSelection(["first", "second"]);
    const before = JSON.stringify({ services: equipmentServices, groups: equipmentServiceGroups, selected: selectedEquipmentServiceIds() });
    const staleApplied = applyEquipmentCatalogOverrides({
      baseCatalogVersion: "synthetic-v1", removedServiceIds: ["second"],
      groups: [{ id: "synthetic-old-group", label: "Grupo de sesión anterior", serviceIds: [] }],
      services: { first: { name: "Nombre de sesión anterior", mainSections: [{ id: "synthetic-v1-first-audio", title: "Categoría de sesión anterior", items: [[99, "Equipo de sesión anterior"]] }] } }
    });
    const staleUnchanged = before === JSON.stringify({ services: equipmentServices, groups: equipmentServiceGroups, selected: selectedEquipmentServiceIds() });
    const currentApplied = applyEquipmentCatalogOverrides({ baseCatalogVersion: "synthetic-v2", services: {
      first: { ...equipmentServices.first, name: "Edición autorizada de la fuente actual" },
      second: { ...equipmentServices.second }
    } });
    return { staleApplied, staleUnchanged, currentApplied, name: equipmentServices.first.name,
      marker: equipmentServices.first.mainSections[0].importSource };
  })()`));
  assert.equal(result.staleApplied, false);
  assert.equal(result.staleUnchanged, true);
  assert.equal(result.currentApplied, true);
  assert.equal(result.name, "Edición autorizada de la fuente actual");
  assert.equal(result.marker.authoritative, true);
  assert.equal(result.marker.version, "synthetic-v2");
});

test("empty current catalog hydration keeps sixty-two authoritative base services and retires missing custom imports", () => {
  const initial = catalog();
  const template = initial.services.first;
  initial.services = Object.fromEntries(Array.from({ length: 62 }, (_, index) => {
    const service = plain(template);
    service.name = `Servicio sintético base ${index + 1}`;
    service.mainSections.forEach(section => { section.id += `-base-${index}`; });
    return [`synthetic-base-${index}`, service];
  }));
  initial.groups[0].serviceIds = Object.keys(initial.services);
  const sandbox = context(initial);
  const result = plain(evaluate(sandbox, `(() => {
    const baseIds = Object.keys(equipmentServices);
    const baseBefore = JSON.stringify(equipmentServices);
    for (const [id, authoritative] of [["custom-import", false], ["custom-authoritative-import", true]]) {
      applyEquipmentCatalogServiceOverride(id, {
        custom: true, groupId: "synthetic", name: "Importación sintética externa " + id,
        importSource: { fileName: "Otra fuente sintética.xlsx", authoritative },
        mainSections: [{ id: id + "-source", title: "Categoría externa", items: [[0, "Equipo externo sintético"]] }]
      });
    }
    setEquipmentServiceSelection([...baseIds, "custom-import", "custom-authoritative-import"]);
    const historical = { id: "saved-synthetic-custom", serviceIds: ["custom-import"],
      sections: [{ id: "saved-source", title: "Cuadro sintético guardado", items: [[0, "Equipo histórico sintético"]] }] };
    equipmentState.events = [historical];
    const historicalBefore = JSON.stringify(historical);
    applyEquipmentCatalogOverrides({ version: 3, baseCatalogVersion: "synthetic-v2", savedAt: "", services: {}, groups: {}, imports: {} });
    const afterEmpty = { ids: Object.keys(equipmentServices), selected: selectedEquipmentServiceIds(),
      groupIds: equipmentServiceGroups[0].serviceIds, baseUnchanged: baseBefore === JSON.stringify(equipmentServices),
      historicalUnchanged: historicalBefore === JSON.stringify(historical) };
    applyEquipmentCatalogOverrides({ baseCatalogVersion: "synthetic-v2", services: {}, removedServiceIds: [baseIds[0]] });
    return { baseIds, afterEmpty, afterExplicitRemoval: Object.keys(equipmentServices), removedSelected: selectedEquipmentServiceIds().includes(baseIds[0]) };
  })()`));
  assert.equal(result.afterEmpty.ids.length, 62);
  assert.deepEqual(result.afterEmpty.ids, result.baseIds);
  assert.deepEqual(result.afterEmpty.selected, result.baseIds);
  assert.deepEqual(result.afterEmpty.groupIds, result.baseIds);
  assert.equal(result.afterEmpty.baseUnchanged, true);
  assert.equal(result.afterEmpty.historicalUnchanged, true);
  assert.deepEqual(result.afterExplicitRemoval, result.baseIds.slice(1));
  assert.equal(result.removedSelected, false);
});

test("authoritative source metadata and literal cells survive catalog editor and snapshot roundtrips", () => {
  const initial = catalog();
  // Different section coordinates prove the section metadata is retained instead
  // of every section receiving only the service-level metadata.
  initial.services.first.mainSections[0].importSource = { ...source(), startColumn: "A", endColumn: "B" };
  initial.services.first.mainSections[1].importSource = { ...source(), startColumn: "D", endColumn: "E" };
  const sandbox = context(initial);
  const result = plain(evaluate(sandbox, `(() => {
    setEquipmentServiceSelection(["first"]);
    const draft = equipmentCatalogDraftForService("first");
    const payload = equipmentCatalogEditorPayload(draft);
    const snapshot = captureEquipmentEventSnapshot();
    const cloned = cloneEquipmentSnapshotSections(snapshot.sections);
    const exported = cloneEquipmentEventForEditable({ id: "synthetic-event", ...snapshot });
    const applied = applyEquipmentCatalogServiceOverride("first", payload);
    return { draft, payload, snapshot, cloned, exported, applied, service: equipmentServices.first };
  })()`));
  assert.equal(result.applied, true);
  assert.deepEqual(result.draft.importSource, initial.services.first.importSource);
  assert.deepEqual(result.payload.importSource, initial.services.first.importSource);
  for (const [index, original] of initial.services.first.mainSections.entries()) {
    for (const section of [result.draft.sections[index], result.payload.mainSections[index], result.service.mainSections[index], result.snapshot.sections[index], result.cloned[index], result.exported.sections[index]]) {
      assert.deepEqual(section.importSource, original.importSource);
      assert.deepEqual(section.rows, original.rows);
      assert.deepEqual(section.notes || [], original.notes || []);
    }
    assert.equal(result.payload.mainSections[index].id, original.id);
    assert.deepEqual(result.payload.mainSections[index].items, original.items);
    assert.deepEqual(result.service.mainSections[index].items, original.items);
  }
  // Mutating a cloned cell must not mutate source or snapshot cells.
  const independent = plain(evaluate(sandbox, `(() => {
    const snapshot = captureEquipmentEventSnapshot();
    const cloned = cloneEquipmentSnapshotSections(snapshot.sections);
    cloned[0].rows[0].cells[0].value = "Cambio sintético aislado";
    return [equipmentServices.first.mainSections[0].rows[0].cells[0].value, snapshot.sections[0].rows[0].cells[0].value];
  })()`));
  assert.deepEqual(independent, ["Encabezado del cuadro actual", "Encabezado del cuadro actual"]);
});

test("opening and saving an authoritative service without edits preserves literal whitespace in names and titles", () => {
  const initial = catalog();
  const service = initial.services.first;
  service.name = "  Servicio literal de fuente  ";
  const section = service.mainSections[0];
  section.title = "  Categoría literal de fuente  ";
  section.items = [[0, "  Equipo literal cero  "], [2, "Equipo literal dos "]];
  section.notes = ["  Observación literal de fuente  "];
  section.rows = [
    { type: "category", description: section.title, cells: [cell("Cuadro sintético!B3", section.title)] },
    ...section.items.map(([quantity, description], index) => ({ type: "item", sourceType: "data", sourceItemIndex: index, quantity, description,
      cells: [cell(`Cuadro sintético!A${index + 4}`, quantity), cell(`Cuadro sintético!B${index + 4}`, description)] }))
  ];
  service.mainSections[1].title = "  Encabezado sin equipos  ";
  const sandbox = context(initial);
  const result = plain(evaluate(sandbox, `(() => {
    const draft = equipmentCatalogDraftForService("first");
    const payload = equipmentCatalogEditorPayload(draft);
    applyEquipmentCatalogServiceOverride("first", payload);
    return { draft, payload, saved: equipmentServices.first };
  })()`));
  assert.equal(result.draft.name, service.name);
  assert.equal(result.payload.name, service.name);
  assert.equal(result.saved.name, service.name);
  for (const [index, original] of service.mainSections.entries()) {
    assert.equal(result.draft.sections[index].title, original.title);
    assert.equal(result.payload.mainSections[index].title, original.title);
    assert.equal(result.saved.mainSections[index].title, original.title);
    assert.deepEqual(result.draft.sections[index].items.map(item => [item.quantity, item.description]), original.items);
    assert.deepEqual(result.payload.mainSections[index].items, original.items);
    assert.deepEqual(result.saved.mainSections[index].items, original.items);
    assert.deepEqual(result.saved.mainSections[index].rows, original.rows);
    assert.deepEqual(result.saved.mainSections[index].notes || [], original.notes || []);
  }
});

test("server normalization preserves authoritative payload text, zero quantities, literal rows and provenance", () => {
  const sandbox = context();
  const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = serverSource.indexOf("function normalizeEquipmentBaseCatalogVersion(");
  const end = serverSource.indexOf("\nfunction readEquipmentCatalogOverridesFile(", start);
  assert.ok(start >= 0 && end > start, "extract pure catalog normalizers without starting the server or accessing stores");
  vm.runInContext(serverSource.slice(start, end), sandbox, { filename: "server-catalog-normalizers.js" });
  const importSource = source();
  const sectionSource = { ...importSource, startColumn: "D", endColumn: "E" };
  sandbox.syntheticServerPayload = {
    baseCatalogVersion: importSource.version, serviceId: "first", name: "  Servicio literal de servidor  ", importSource,
    audioOptions: {}, mainSections: [{
      id: "synthetic-v2-server-source", title: "  Categoría literal de servidor  ", importSource: sectionSource,
      items: [[0, "  Equipo cero literal de servidor  "], [2, "Equipo literal con espacio final "]],
      rows: [
        { type: "header", description: "  Encabezado literal  ", cells: [cell("Cuadro sintético!D1", "  Encabezado literal  ")] },
        { type: "item", sourceType: "data", sourceItemIndex: 0, quantity: 0, description: "  Equipo cero literal de servidor  ", cells: [cell("Cuadro sintético!D2", 0), cell("Cuadro sintético!E2", "  Equipo cero literal de servidor  ")] },
        { type: "item", sourceType: "data", sourceItemIndex: 1, quantity: 2, description: "Equipo literal con espacio final ", cells: [cell("Cuadro sintético!D3", 2), cell("Cuadro sintético!E3", "Equipo literal con espacio final ")] },
        { type: "unlabeledQuantity", quantity: 0, description: "0", cells: [cell("Cuadro sintético!D4", 0)] }
      ], notes: ["  Nota literal de servidor  "]
    }]
  };
  const payload = plain(sandbox.syntheticServerPayload);
  const result = plain(evaluate(sandbox, `(() => {
    const normalized = normalizeEquipmentCatalogOverride(syntheticServerPayload);
    applyEquipmentCatalogServiceOverride(normalized.serviceId, normalized.service);
    return { normalized, applied: equipmentServices.first };
  })()`));
  assert.equal(result.normalized.baseCatalogVersion, payload.baseCatalogVersion);
  assert.equal(result.normalized.serviceId, payload.serviceId);
  for (const service of [result.normalized.service, result.applied]) {
    assert.equal(service.name, payload.name);
    assert.deepEqual(service.importSource, importSource);
    assert.equal(service.mainSections[0].id, payload.mainSections[0].id);
    assert.equal(service.mainSections[0].title, payload.mainSections[0].title);
    assert.deepEqual(service.mainSections[0].items, payload.mainSections[0].items);
    assert.deepEqual(service.mainSections[0].rows, payload.mainSections[0].rows);
    assert.deepEqual(service.mainSections[0].notes, payload.mainSections[0].notes);
    assert.deepEqual(service.mainSections[0].importSource, sectionSource);
  }
});

test("seventeen equipment zeros and two unlabeled quantity zeros survive editor, snapshot and compact PDF rows", () => {
  const initial = catalog();
  const section = initial.services.first.mainSections[0];
  section.items = Array.from({ length: 17 }, (_, index) => [0, `Equipo cero sintético ${index + 1}`]);
  section.rows = [
    { type: "header", description: "Diecinueve ceros de fuente sintética", cells: [cell("Cuadro sintético!B2", "Diecinueve ceros de fuente sintética")] },
    ...section.items.map(([quantity, description], index) => ({ type: "item", sourceType: "data", sourceItemIndex: index, quantity, description,
      cells: [cell(`Cuadro sintético!A${index + 4}`, quantity), cell(`Cuadro sintético!B${index + 4}`, description)] })),
    { type: "note", description: "Nota después de todos los ceros", cells: [cell("Cuadro sintético!B21", "Nota después de todos los ceros")] }
  ];
  section.notes = [];
  initial.services.first.mainSections[1].rows.push({ type: "unlabeledQuantity", quantity: 0, description: "0", cells: [cell("Cuadro sintético!G3", 0)] });
  const sandbox = context(initial);
  const result = plain(evaluate(sandbox, `(() => {
    setEquipmentServiceSelection(["first"]);
    const sections = selectedEquipmentSections();
    const snapshot = captureEquipmentEventSnapshot();
    const draft = equipmentCatalogDraftForService("first");
    const payload = equipmentCatalogEditorPayload(draft);
    const sourceZeroCount = sections => sections.flatMap(section => (section.rows || []).flatMap(row => row.cells || [])).filter(cell => cell.value === 0).length;
    return {
      counts: [sourceZeroCount(sections), sourceZeroCount(snapshot.sections), sourceZeroCount(draft.sections), sourceZeroCount(payload.mainSections)],
      items: snapshot.sections.flatMap(section => section.items.map(item => item.quantity)),
      compact: tableForEquipmentSections(warehousePdfSections(), true),
      rows: snapshot.sections.map(section => section.rows), payloadRows: payload.mainSections.map(section => section.rows)
    };
  })()`));
  assert.deepEqual(result.counts, [19, 19, 19, 19]);
  assert.deepEqual(result.items, Array(17).fill(0));
  assert.deepEqual(result.payloadRows, result.rows);
  assert.equal(occurrences(result.compact, 'class="equipment-qty equipment-service-quantity-cell">0</td>'), 17);
  assert.equal(occurrences(result.compact, 'data-source-row-type="unlabeledQuantity"><td colspan="2">0</td>'), 2);
  for (let index = 1; index <= 17; index++) {
    assert.match(result.compact, new RegExp(`>Equipo cero sintético ${index}</td>`));
  }
  assert.match(result.compact, /Diecinueve ceros de fuente sintética/);
  assert.match(result.compact, /Nota después de todos los ceros/);
});

test("a selected source extra without equipment items retains its headers, notes and unlabeled zero", () => {
  const initial = catalog();
  const extra = {
    id: "synthetic-v2-extra-notes", title: "Observaciones adicionales", importSource: source(), items: [],
    rows: [
      { type: "header", description: "Encabezado del extra actual", cells: [cell("Cuadro sintético!K2", "Encabezado del extra actual")] },
      { type: "unlabeledQuantity", quantity: 0, description: "0", cells: [cell("Cuadro sintético!J3", 0)] },
      { type: "note", description: "Observación sin equipo adicional", cells: [cell("Cuadro sintético!K4", "Observación sin equipo adicional")] }
    ], notes: ["Nota final del extra"]
  };
  initial.services.first.extras = [extra];
  const sandbox = context(initial);
  const result = plain(evaluate(sandbox, `(() => {
    setEquipmentServiceSelection(["first"]);
    equipmentState.selectedExtraIds.add(equipmentExtraSelectionKey("first", "synthetic-v2-extra-notes"));
    const selected = selectedEquipmentSections();
    const snapshot = captureEquipmentEventSnapshot();
    return { extra: selected.at(-1), snapshotExtra: snapshot.sections.at(-1), html: tableForEquipmentSections(selected, true) };
  })()`));
  for (const section of [result.extra, result.snapshotExtra]) {
    assert.equal(section.title, extra.title);
    assert.deepEqual(section.items, []);
    assert.deepEqual(section.rows, extra.rows);
    assert.deepEqual(section.notes, extra.notes);
    assert.deepEqual(section.importSource, extra.importSource);
  }
  for (const text of ["Observaciones adicionales", "Encabezado del extra actual", "Observación sin equipo adicional", "Nota final del extra"]) {
    assert.equal(occurrences(result.html, text), 1, text);
  }
  // The main source also contains one unlabeled zero.
  assert.equal(occurrences(result.html, 'data-source-row-type="unlabeledQuantity"><td colspan="2">0</td>'), 2);
});
