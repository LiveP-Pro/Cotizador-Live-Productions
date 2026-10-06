const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function context() {
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: async () => ({ ok: false }),
    window: {
      requerimientoEquipoCatalog: {
        version: "synthetic-current",
        services: {},
        groups: [{ id: "existing", label: "Categoría existente", serviceIds: [] }]
      },
      requerimientoEquipoInventory: { categories: [] },
      location: { protocol: "file:", hash: "#requerimiento-equipo" },
      addEventListener() {},
      setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: {
      visibilityState: "visible",
      querySelector() { return null; }, querySelectorAll() { return []; },
      addEventListener() {}, dispatchEvent() {}
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // Keep dictionary prototypes inside this VM, including the reserved-name case.
  vm.runInContext('window.requerimientoEquipoCatalog = { version: "synthetic-current", services: {}, groups: [{ id: "existing", label: "Categoría existente", serviceIds: [] }] };', sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  return sandbox;
}

const execute = (sandbox, source) => vm.runInContext(source, sandbox);
const plain = (value) => JSON.parse(JSON.stringify(value));

function importedService(name, groupId, bookKey = "current-source.xlsx") {
  return {
    name, custom: true, groupId, updatedAt: "2026-10-06T12:00:00Z",
    mainSections: [{
      id: `${groupId}-source-section`, title: "Título del archivo", items: [[0, "Equipo nuevo del archivo"], [2, "Otro equipo nuevo"]],
      notes: ["Observación completa del cuadro"],
      rows: [
        { type: "header", quantity: null, description: "Cantidad / Equipo", cells: [{ ref: "Cuadro!A1", value: "Cantidad" }, { ref: "Cuadro!B1", value: "Equipo" }] },
        { type: "item", quantity: 0, description: "Equipo nuevo del archivo", notes: ["Nota asociada al equipo cero"], cells: [{ ref: "Cuadro!A2", value: 0 }, { ref: "Cuadro!B2", value: "Equipo nuevo del archivo" }] },
        { type: "note", quantity: null, description: "Observación entre equipos", cells: [{ ref: "Cuadro!C2", value: "Observación entre equipos" }] },
        { type: "item", quantity: 2, description: "Otro equipo nuevo", notes: ["Nota asociada al segundo equipo"], cells: [{ ref: "Cuadro!A3", value: 2 }, { ref: "Cuadro!B3", value: "Otro equipo nuevo" }] },
        { type: "note", quantity: null, description: "Observación completa del cuadro", cells: [{ ref: "Cuadro!B4", value: "Observación completa del cuadro" }] }
      ]
    }],
    importSource: { importId: "synthetic-import", bookKey, fileName: bookKey, sourceFileUrl: "/api/cuadros-equipo/fuentes/synthetic-import" }
  };
}

test("a committed import installs new groups and permits source names absent from inventory", () => {
  const sandbox = context();
  sandbox.payload = {
    groups: { special: { id: "special", label: "Categoría nueva", serviceIds: ["uploaded"] } },
    services: { uploaded: importedService("Servicio entregado", "special") }
  };
  const result = plain(execute(sandbox, `(() => {
    applyEquipmentCatalogOverrides(payload);
    applyEquipmentCatalogOverrides(payload);
    setEquipmentServiceSelection(["uploaded"]);
    const sections = selectedEquipmentSections();
    const draft = equipmentCatalogDraftForService("uploaded");
    return {
      groups: equipmentServiceGroups,
      knownName: equipmentRecognizedInventoryChoice("Equipo nuevo del archivo"),
      validation: equipmentCatalogEditorValidation(draft),
      quantities: sections[0].items.map((item) => item.quantity),
      html: tableForEquipmentSections(sections, false)
    };
  })()`));
  assert.equal(result.groups.filter((group) => group.id === "special").length, 1);
  assert.deepEqual(result.groups.find((group) => group.id === "special").serviceIds, ["uploaded"]);
  assert.equal(result.knownName, false);
  assert.equal(result.validation.ok, true);
  assert.deepEqual(result.quantities, [0, 2]);
  assert.match(result.html, /value="0"/);
  assert.match(result.html, /value="Equipo nuevo del archivo" aria-invalid="false"/);
});

test("a source service named constructor creates its own catalog entry without inheriting a built-in", () => {
  const sandbox = context();
  sandbox.payload = { services: { constructor: importedService("constructor", "existing") } };
  const result = plain(execute(sandbox, `(() => {
    applyEquipmentCatalogOverrides(payload);
    setEquipmentServiceSelection(["constructor"]);
    return { own: Object.hasOwn(equipmentServices, "constructor"),
      type: typeof equipmentServices.constructor,
      name: currentEquipmentServices()[0]?.name,
      quantity: selectedEquipmentSections()[0]?.items[0]?.quantity };
  })()`));
  assert.equal(result.own, true);
  assert.equal(result.type, "object");
  assert.equal(result.name, "constructor");
  assert.equal(result.quantity, 0);
});

test("source headings, item notes, zero and provenance survive event snapshot and JSON round trip", () => {
  const sandbox = context();
  sandbox.payload = { services: { uploaded: importedService("Servicio entregado", "existing") } };
  const result = plain(execute(sandbox, `(() => {
    applyEquipmentCatalogOverrides(payload);
    setEquipmentServiceSelection(["uploaded"]);
    const snapshot = captureEquipmentEventSnapshot();
    const roundTrip = cloneEquipmentSnapshotSections(JSON.parse(JSON.stringify(snapshot.sections)));
    return { snapshot, roundTrip, html: tableForEquipmentSections(roundTrip, true),
      editorPayload: equipmentCatalogEditorPayload(equipmentCatalogDraftForService("uploaded")) };
  })()`));
  assert.equal(result.snapshot.sections[0].items[0].quantity, 0);
  assert.deepEqual(result.roundTrip[0].rows, sandbox.payload.services.uploaded.mainSections[0].rows);
  assert.deepEqual(result.roundTrip[0].notes, ["Observación completa del cuadro"]);
  assert.deepEqual(result.roundTrip[0].items.map((item) => item.sourceItemIndex), [0, 1]);
  assert.equal(result.roundTrip[0].importSource.fileName, "current-source.xlsx");
  for (const text of ["Cantidad / Equipo", "Nota asociada al equipo cero", "Nota asociada al segundo equipo", "Observación entre equipos", "Observación completa del cuadro"]) {
    assert.ok(result.html.includes(text));
  }
  assert.match(result.html, /class="equipment-qty equipment-service-quantity-cell">0<\/td>/);
  assert.match(result.html, /href="\/api\/cuadros-equipo\/fuentes\/synthetic-import"/);
  assert.deepEqual(result.editorPayload.mainSections[0].rows, result.roundTrip[0].rows);
  assert.deepEqual(result.editorPayload.mainSections[0].items, [[0, "Equipo nuevo del archivo"], [2, "Otro equipo nuevo"]]);
});

test("replacement removes only the specified book services and a full reload removes stale imported entries", () => {
  const sandbox = context();
  sandbox.first = {
    groups: [{ id: "special", label: "Categoría nueva", serviceIds: ["previous"] }],
    services: {
      previous: importedService("Versión anterior del libro actual", "special"),
      other: importedService("Otro libro vigente", "existing", "other-current-source.xlsx")
    }
  };
  sandbox.replacement = {
    groups: { special: { id: "special", label: "Categoría nueva", serviceIds: ["replacement"] } },
    removedServiceIds: ["previous"],
    services: { replacement: importedService("Nueva versión completa", "special") }
  };
  const result = plain(execute(sandbox, `(() => {
    applyEquipmentCatalogOverrides(first);
    setEquipmentServiceSelection(["previous"]);
    const oldEvent = captureEquipmentEventSnapshot();
    equipmentState.events.push({ ...oldEvent, id: "saved-event" });
    applyEquipmentCatalogOverrides(replacement);
    const afterCommit = Object.keys(equipmentServices).sort();
    const selectionAfterCommit = [...equipmentState.selectedServiceIds];
    applyEquipmentCatalogOverrides({
      baseCatalogVersion: "synthetic-current",
      groups: replacement.groups,
      services: { replacement: replacement.services.replacement, other: first.services.other }
    });
    return { afterCommit, afterReload: Object.keys(equipmentServices).sort(), selectionAfterCommit,
      groupIds: equipmentCatalogGroupById("special").serviceIds,
      oldEvent: equipmentState.events[0] };
  })()`));
  assert.deepEqual(result.afterCommit, ["other", "replacement"]);
  assert.deepEqual(result.afterReload, ["other", "replacement"]);
  assert.deepEqual(result.selectionAfterCommit, []);
  assert.deepEqual(result.groupIds, ["replacement"]);
  assert.equal(result.oldEvent.serviceName, "Versión anterior del libro actual");
  assert.equal(result.oldEvent.sections[0].items[0].quantity, 0);
});

test("fresh catalog hydration restores imported groups and complete service metadata", () => {
  const sandbox = context();
  sandbox.persisted = {
    baseCatalogVersion: "synthetic-current",
    groups: { special: { id: "special", label: "Categoría nueva", serviceIds: ["uploaded"] } },
    services: { uploaded: importedService("Servicio entregado", "special") }
  };
  const result = plain(execute(sandbox, `(() => {
    applyEquipmentCatalogOverrides(JSON.parse(JSON.stringify(persisted)));
    setEquipmentServiceSelection(["uploaded"]);
    return { group: equipmentCatalogGroupForService("uploaded"),
      service: equipmentServices.uploaded, snapshot: captureEquipmentEventSnapshot() };
  })()`));
  assert.equal(result.group.label, "Categoría nueva");
  assert.deepEqual(result.group.serviceIds, ["uploaded"]);
  assert.equal(result.service.importSource.bookKey, "current-source.xlsx");
  assert.equal(result.service.mainSections[0].importSource.sourceFileUrl, "/api/cuadros-equipo/fuentes/synthetic-import");
  assert.equal(result.snapshot.sections[0].items[0].quantity, 0);
  assert.equal(result.snapshot.sections[0].rows.length, 5);
});

test("live category splitting renders each source item and its notes once while retaining zero", () => {
  const sandbox = context();
  sandbox.payload = { services: { uploaded: importedService("Servicio entregado", "existing") } };
  const result = plain(execute(sandbox, `(() => {
    applyEquipmentCatalogOverrides(payload);
    setEquipmentServiceSelection(["uploaded"]);
    applyEquipmentWarehouseInventoryPayload({ state: { items: [
      { id: "inventory-a", name: "Equipo nuevo del archivo", category: "Categoría vigente A", quantity: 0 },
      { id: "inventory-b", name: "Otro equipo nuevo", category: "Categoría vigente B", quantity: 2 }
    ], movements: [] } });
    const snapshot = captureEquipmentEventSnapshot();
    const displayed = equipmentLiveSectionsForDisplay(snapshot.sections);
    return { displayed, html: tableForEquipmentSections(snapshot.sections, true) };
  })()`));
  assert.deepEqual(result.displayed.map((section) => section.title), ["Categoría vigente A", "Categoría vigente B"]);
  assert.equal(result.displayed[0].items[0].quantity, 0);
  assert.equal(result.displayed[0].items[0].sourceItemIndex, 0);
  assert.equal(result.displayed[1].items[0].sourceItemIndex, 1);
  for (const text of ["Nota asociada al equipo cero", "Nota asociada al segundo equipo", "Observación entre equipos", "Observación completa del cuadro"]) {
    assert.equal(result.html.split(text).length - 1, 1);
  }
  assert.match(result.html, /class="equipment-qty equipment-service-quantity-cell">0<\/td>/);
});
