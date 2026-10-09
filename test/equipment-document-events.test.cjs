const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function element(value = "") {
  const classes = new Set();
  return {
    value, textContent: "", dataset: {},
    classList: { add(value) { classes.add(value); }, remove(value) { classes.delete(value); }, contains(value) { return classes.has(value); }, toggle(value, enabled) { enabled ? classes.add(value) : classes.delete(value); } },
    setAttribute() {}, addEventListener() {}, focus() {}
  };
}

function createContext() {
  const elements = new Map([
    ["#equipmentEventPlace", element()], ["#equipmentEventName", element()],
    ["#equipmentEventSetupAt", element()], ["#equipmentEventDate", element()],
    ["#equipmentEventInAt", element()], ["#equipmentEventResponsible", element()],
    ["#equipmentSaveStatus", element()], ["#equipmentNotes", element()]
  ]);
  const context = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    window: {
      requerimientoEquipoCatalog: { services: {}, groups: [] },
      requerimientoEquipoInventory: { categories: [] },
      addEventListener() {}, setTimeout, setInterval,
      requestAnimationFrame(callback) { callback(); }
    },
    document: {
      querySelector(selector) { return elements.get(selector) || null; },
      querySelectorAll() { return []; }, addEventListener() {}, dispatchEvent() {}
    },
    setTimeout, setInterval, clearInterval, fetch: async () => ({ ok: false })
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context, { filename: "equipment.js" });
  context.testPayload = documentPayload();
  return context;
}

function documentPayload() {
  return {
    type: "live-productions-equipment-requirement", summaryTransferAutomatic: false,
    events: ["A", "B", "C"].map((label, index) => ({
      id: `synthetic-original-${label}`, name: `Evento sintético ${label}`, place: `Lugar sintético ${label}`,
      setupAt: `2026-10-0${index + 7}T08:00`, date: `2026-10-0${index + 7}`, equipmentInAt: `2026-10-0${index + 7}T22:00`,
      responsible: "Responsable sintético", serviceName: `Cuadro documental ${label}`,
      sections: [
        {
          title: `Categoría ${label}`, items: [[0, `Equipo cero ${label}`], [index + 2, `Equipo exclusivo ${label}`]],
          rows: [
            { type: "header", cells: [{ value: `Encabezado ${label}` }, { value: "Cantidad" }] },
            { type: "category", description: `Subcategoría ${label}` },
            { type: "item", sourceItemIndex: 0, cells: [{ value: 0 }, { value: `Equipo cero ${label}` }] },
            { type: "note", description: `Observación entre filas ${label}` },
            { type: "item", sourceItemIndex: 1, notes: [`Nota de equipo ${label}`] }
          ],
          notes: [`Nota del cuadro ${label}`], importSource: { fileName: `Documento sintético ${label}.pdf`, synthetic: true }
        },
        { title: `Notas finales ${label}`, items: [], rows: [{ type: "note", description: `Nota sin cantidad ${label}` }] }
      ]
    }))
  };
}

const evaluate = (context, code) => vm.runInContext(code, context);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("standalone document import preserves three windows, every source row and zeros without creating services", () => {
  const context = createContext();
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  const actual = plain(evaluate(context, `({
    windows: equipmentState.events.map((event) => ({
      serviceIds: event.serviceIds, rows: event.documentSections.map((section) => section.rows),
      notes: event.documentSections.map((section) => section.notes || []),
      quantities: event.documentSections.flatMap((section) => section.items.map((item) => item.quantity))
    })),
    services: Object.keys(equipmentServices), groups: equipmentServiceGroups,
    selected: selectedEquipmentSections().map((section) => ({ title: section.title, descriptions: section.items.map((item) => item.description) })),
    editable: selectedEquipmentSections().flatMap((section) => section.items).every((item) => item.editable),
    uiOnly: currentEquipmentService().documentOnly
  })`));
  assert.equal(actual.windows.length, 3);
  for (let index = 0; index < 3; index++) {
    assert.deepEqual(actual.windows[index].serviceIds, []);
    assert.deepEqual(actual.windows[index].rows, context.testPayload.events[index].sections.map((section) => section.rows));
    assert.deepEqual(actual.windows[index].notes, context.testPayload.events[index].sections.map((section) => section.notes || []));
    assert.deepEqual(actual.windows[index].quantities, [0, index + 2]);
  }
  assert.deepEqual(actual.services, []);
  assert.deepEqual(actual.groups, []);
  assert.equal(actual.editable, true);
  assert.equal(actual.uiOnly, true);
  assert.deepEqual(actual.selected.map((section) => section.title), ["Categoría A", "Notas finales A"]);
  const html = evaluate(context, "tableForEquipmentSections(selectedEquipmentSections())");
  assert.match(html, /Equipo cero A/);
  assert.match(html, /min="0"/);
  assert.match(html, /value="0"/);
  assert.match(html, /Encabezado A/);
  assert.match(html, /Subcategoría A/);
  assert.match(html, /Observación entre filas A/);
  assert.match(html, /Nota de equipo A/);
  assert.match(html, /Nota del cuadro A/);
  assert.match(html, /Nota sin cantidad A/);
});

test("saving a standalone window retains its document instead of requiring a service or erasing sections", async () => {
  const context = createContext();
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  evaluate(context, `
    let decisionCalls = 0;
    let confirmedDocumentIngresses = [];
    requestEquipmentUnknownChoice = async () => { decisionCalls++; return "save"; };
    registerSavedEquipmentExtras = async (items) => {
      items.filter((item) => item.procurementChoice === "save").forEach((item, index) => {
        item.warehouseInventoryId = "synthetic-document-stock-" + index;
        item.inventoryIngressReceipts = [{ requestId: "synthetic-document-receipt", itemId: item.warehouseInventoryId, quantity: item.quantity, index }];
        confirmedDocumentIngresses.push({ description: item.description, quantity: item.quantity });
      });
      return items;
    };
  `);
  assert.equal(evaluate(context, "decisionCalls"), 0);
  const before = plain(evaluate(context, "equipmentState.events[0].documentSections"));
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(evaluate(context, "decisionCalls"), 2);
  const after = plain(evaluate(context, "equipmentState.events[0]"));
  assert.equal(after.sections.length, 2);
  assert.deepEqual(after.sections.map((section) => section.rows), before.map((section) => section.rows));
  assert.deepEqual(after.sections.flatMap((section) => section.items.map((item) => item.quantity)), [0, 2]);
  assert.deepEqual(after.documentSections.flatMap((section) => section.items.map((item) => item.procurementChoice)), ["save", "save"]);
  assert.deepEqual(plain(evaluate(context, "confirmedDocumentIngresses")), [
    { description: "Equipo cero A", quantity: 0 }, { description: "Equipo exclusivo A", quantity: 2 }
  ]);
  assert.deepEqual(after.documentSections.flatMap((section) => section.items.map((item) => item.inventoryIngressReceipts[0].quantity)), [0, 2]);
  assert.deepEqual(after.serviceIds, []);
});

test("document edits, zeros, deletion and extras remain isolated when switching the three windows", () => {
  const context = createContext();
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  const changed = plain(evaluate(context, `(() => {
    const first = equipmentState.events[0];
    const second = equipmentState.events[1];
    const itemId = selectedEquipmentSections()[0].items[1].id;
    updateEquipmentItem(itemId, "quantity", 0);
    updateEquipmentItem(itemId, "description", "Equipo documental A editado");
    appendEquipmentExtraItems([{ description: "Extra exclusivo A", quantity: 3, procurementChoice: "rent" }]);
    refreshEquipmentSummaryAndPreview();
    loadEquipmentEvent(second.id);
    const secondDescriptions = selectedEquipmentSections().flatMap((section) => section.items.map((item) => item.description));
    const secondQty = selectedEquipmentSections()[0].items[1].quantity;
    loadEquipmentEvent(first.id);
    const restored = selectedEquipmentSections().flatMap((section) => section.items);
    removeManualEquipmentItem(itemId);
    loadEquipmentEvent(second.id);
    loadEquipmentEvent(first.id);
    const deleted = selectedEquipmentSections().flatMap((section) => section.items.map((item) => item.description));
    return { secondDescriptions, secondQty, restored, deleted,
      otherSnapshots: equipmentState.events.slice(1).map((event) => event.documentSections.flatMap((section) => section.items.map((item) => item.description))) };
  })()`));
  assert.deepEqual(changed.secondDescriptions, ["Equipo cero B", "Equipo exclusivo B"]);
  assert.equal(changed.secondQty, 3);
  assert.equal(changed.restored.find((item) => item.description === "Equipo documental A editado").quantity, 0);
  assert.equal(changed.restored.find((item) => item.description === "Extra exclusivo A").quantity, 3);
  assert.deepEqual(changed.deleted, ["Equipo cero A", "Extra exclusivo A"]);
  assert.deepEqual(changed.otherSnapshots, [["Equipo cero B", "Equipo exclusivo B"], ["Equipo cero C", "Equipo exclusivo C"]]);
});

test("document JSON roundtrip does not duplicate manual extras or leak one event into another", () => {
  const context = createContext();
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  const result = plain(evaluate(context, `(() => {
    appendEquipmentExtraItems([{ description: "Extra documental A", quantity: 1, procurementChoice: "rent" }]);
    const serialized = JSON.parse(JSON.stringify(equipmentEditablePayload("rent", { fileName: "sintetico.pdf" })));
    importEquipmentEditablePayload(serialized);
    return equipmentState.events.map((event) => {
      loadEquipmentEvent(event.id);
      return {
        name: event.name,
        descriptions: selectedEquipmentSections().flatMap((section) => section.items.map((item) => item.description)),
        sections: captureEquipmentEventSnapshot().sections.length,
        documentSections: event.documentSections.length,
        rows: event.documentSections.map((section) => section.rows)
      };
    });
  })()`));
  assert.deepEqual(result.map((event) => event.descriptions), [
    ["Equipo cero A", "Equipo exclusivo A", "Extra documental A"],
    ["Equipo cero B", "Equipo exclusivo B"], ["Equipo cero C", "Equipo exclusivo C"]
  ]);
  assert.deepEqual(result.map((event) => event.sections), [3, 2, 2]);
  assert.deepEqual(result.map((event) => event.documentSections), [2, 2, 2]);
  for (let index = 0; index < 3; index++) assert.deepEqual(result[index].rows, context.testPayload.events[index].sections.map((section) => section.rows));
});

test("reset and empty document snapshots cannot inherit the currently edited event", () => {
  const context = createContext();
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  assert.deepEqual(plain(evaluate(context, 'sectionsForEquipmentEvent({ documentSections: [], sections: [] })')), []);
  assert.deepEqual(plain(evaluate(context, 'equipmentWarehouseDispatchItems({ documentSections: [], sections: [] })')), []);
  const result = plain(evaluate(context, `(() => {
    const saved = equipmentState.events[0].documentSections;
    resetEquipmentWindowDraft();
    return { documentSections: equipmentState.documentSections, documentServiceName: equipmentState.documentServiceName,
      selected: selectedEquipmentSections(), savedCount: saved.length, service: currentEquipmentService() };
  })()`));
  assert.deepEqual(result.documentSections, []);
  assert.equal(result.documentServiceName, "");
  assert.deepEqual(result.selected, []);
  assert.equal(result.savedCount, 2);
  assert.equal(result.service, null);
});

test("loaded warehouse stock does not rewrite document categories, order, notes or zero quantities", () => {
  const context = createContext();
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  context.syntheticWarehouse = {
    savedAt: "2026-10-07T10:00:00.000Z",
    state: { updatedAt: "2026-10-07T10:00:00.000Z", movements: [], items: [
      { id: "synthetic-stock", name: "Nombre de bodega sintético", sourceKey: "Equipo exclusivo A", category: "Categoría de bodega", quantity: 5, itemType: "equipo" }
    ] }
  };
  evaluate(context, "applyEquipmentWarehouseInventoryPayload(syntheticWarehouse)");
  const displayed = plain(evaluate(context, "warehousePdfSections()"));
  assert.deepEqual(displayed.map((section) => section.title), ["Categoría A", "Notas finales A"]);
  assert.deepEqual(displayed[0].items.map((item) => ({ quantity: item.quantity, name: item.description })), [
    { quantity: 0, name: "Equipo cero A" }, { quantity: 2, name: "Equipo exclusivo A" }
  ]);
  assert.deepEqual(displayed[0].rows, context.testPayload.events[0].sections[0].rows);
  const itemId = displayed[0].items[1].id;
  context.syntheticItemId = itemId;
  evaluate(context, 'updateEquipmentItem(syntheticItemId, "quantity", "cantidad inválida")');
  assert.equal(evaluate(context, "selectedEquipmentSections()[0].items[1].quantity"), 2);
});

test("explicit documentSections-only JSON initializes an effective snapshot for every event", () => {
  const context = createContext();
  context.testPayload.events = context.testPayload.events.map(({ sections, ...event }) => ({ ...event, documentSections: sections }));
  evaluate(context, "importEquipmentEditablePayload(testPayload)");
  const sections = plain(evaluate(context, "equipmentState.events.map(sectionsForEquipmentEvent)"));
  assert.deepEqual(sections.map((eventSections) => eventSections.flatMap((section) => section.items.map((item) => item.quantity))), [[0, 2], [0, 3], [0, 4]]);
});
