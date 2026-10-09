const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8");

function createContext(elements = new Map()) {
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
      querySelectorAll() { return []; },
      addEventListener() {}, dispatchEvent(event) { context.dispatchedEvents.push(event); }
    },
    dispatchedEvents: [],
    CustomEvent: class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    setTimeout, setInterval, clearInterval,
    fetch: async () => ({ ok: false })
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "equipment.js" });
  return context;
}

const evaluate = (context, code) => vm.runInContext(code, context);
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadWarehouse(context, items = [], savedAt = "2026-10-07T08:00:00.000Z") {
  context.testWarehousePayload = { savedAt, state: { updatedAt: savedAt, items, movements: [] } };
  evaluate(context, "applyEquipmentWarehouseInventoryPayload(testWarehousePayload)");
}

function input(value, dataset = {}) {
  return { value: String(value), dataset: { ...dataset }, focus() { this.focused = true; } };
}

function setInputs(context, quantity, description, dataset = {}) {
  context.quantityInput = input(quantity);
  context.descriptionInput = input(description, dataset);
}

test("unknown extra waits for the chosen decision and preserves its exact name", async () => {
  const context = createContext();
  loadWarehouse(context);
  setInputs(context, 3, "Equipo sintético fuera de inventario");
  evaluate(context, `
    let resolveTestChoice;
    requestEquipmentUnknownChoice = () => new Promise((resolve) => { resolveTestChoice = resolve; });
  `);
  const pending = evaluate(context, "equipmentExtraFromInputs(quantityInput, descriptionInput)");
  assert.equal(typeof pending?.then, "function");
  let settled = false;
  pending.then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false, "adding an extra must wait for the dialog decision");
  evaluate(context, 'resolveTestChoice("rent")');
  const extra = await pending;
  assert.equal(extra.description, "Equipo sintético fuera de inventario");
  assert.equal(extra.quantity, 3);
  assert.equal(extra.procurementChoice, "rent");
});

test("inventory match bypasses the unknown dialog, while service-only names require it", async () => {
  const context = createContext();
  loadWarehouse(context, [{ id: "synthetic-known", name: "Equipo sintético conocido", category: "Prueba", quantity: 5, itemType: "equipo" }]);
  evaluate(context, `
    let dialogCalls = 0;
    requestEquipmentUnknownChoice = async () => { dialogCalls++; return "save"; };
    equipmentServices["synthetic-service"] = {
      name: "Servicio sintético", importSource: { synthetic: true },
      mainSections: [{ title: "Prueba", items: [[1, "Equipo sintético de servicio"]] }]
    };
  `);
  setInputs(context, 2, "Equipo sintético conocido");
  const known = await evaluate(context, "equipmentExtraFromInputs(quantityInput, descriptionInput)");
  assert.equal(known.warehouseInventoryId, "synthetic-known");
  assert.equal(evaluate(context, "dialogCalls"), 0);
  const serviceChoice = evaluate(context, 'equipmentExtraNameChoices().find((entry) => entry.name === "Equipo sintético de servicio")');
  assert.ok(serviceChoice, "synthetic service source remains selectable");
  setInputs(context, 2, serviceChoice.name, { equipmentChoiceId: serviceChoice.id });
  const sourceOnly = await evaluate(context, "equipmentExtraFromInputs(quantityInput, descriptionInput)");
  assert.equal(evaluate(context, "dialogCalls"), 1);
  assert.equal(sourceOnly.procurementChoice, "save");
  assert.equal(sourceOnly.description, serviceChoice.name);
  assert.ok(sourceOnly.stockIngressSourceId, "new Save selections carry a stable ingress intent before registration");
  assert.equal(Object.hasOwn(evaluate(context, "cloneEquipmentSnapshotItem({ procurementChoice: 'save', quantity: 2, description: 'Equipo sintético', stockIngressSourceId: 'synthetic-private-source' })"), "stockIngressSourceId"), false);
});

test("canceling or invalid quantities never adds an unknown extra", async () => {
  const status = { textContent: "" };
  const context = createContext(new Map([["#equipmentSaveStatus", status]]));
  loadWarehouse(context);
  evaluate(context, 'let dialogCalls = 0; requestEquipmentUnknownChoice = async () => { dialogCalls++; return null; };');
  for (const quantity of ["", "0", "-1", "1.5", "abc"]) {
    setInputs(context, quantity, "Equipo sintético desconocido");
    assert.equal(await evaluate(context, "equipmentExtraFromInputs(quantityInput, descriptionInput)"), null);
  }
  setInputs(context, 1, "   ");
  assert.equal(await evaluate(context, "equipmentExtraFromInputs(quantityInput, descriptionInput)"), null);
  assert.equal(evaluate(context, "dialogCalls"), 0);
  setInputs(context, 1, "Equipo sintético desconocido");
  assert.equal(await evaluate(context, "equipmentExtraFromInputs(quantityInput, descriptionInput)"), null);
  assert.equal(evaluate(context, "dialogCalls"), 1);
  assert.equal(evaluate(context, "equipmentState.manualMainSections.length"), 0);
});

test("batch cancel preserves all entries and purchase sends its exact inventory-registration request", async () => {
  const context = createContext();
  loadWarehouse(context);
  context.testBatch = [
    { quantityInput: input(2), descriptionInput: input("Equipo sintético A") },
    { quantityInput: input(3), descriptionInput: input("Equipo sintético B") }
  ];
  evaluate(context, `
    renderEquipmentModule = () => {};
    let testDecisions = ["save", null];
    requestEquipmentUnknownChoice = async () => testDecisions.shift();
  `);
  assert.equal(await evaluate(context, "addEquipmentExtraBatch(testBatch)"), false);
  assert.equal(evaluate(context, "equipmentState.manualMainSections.length"), 0, "canceling the second row must not append the first row");
  assert.equal(context.dispatchedEvents.length, 0);
  evaluate(context, 'testDecisions = ["rent", "purchase"]');
  assert.equal(await evaluate(context, "addEquipmentExtraBatch(testBatch)"), true);
  assert.deepEqual(plain(evaluate(context, "equipmentState.manualMainSections[0].items.map((item) => ({ name: item.description, quantity: item.quantity, choice: item.procurementChoice }))")), [
    { name: "Equipo sintético A", quantity: 2, choice: "rent" },
    { name: "Equipo sintético B", quantity: 3, choice: "purchase" }
  ]);
  assert.equal(context.dispatchedEvents.length, 1);
  assert.equal(context.dispatchedEvents[0].type, "live:warehouse-purchase-request");
  assert.deepEqual(plain(context.dispatchedEvents[0].detail), {
    items: [{ description: "Equipo sintético B", quantity: 3 }], returnPage: "requerimiento-equipo"
  });
});

test("extra append and quantity refresh immediately update the selected event, rent report and editable JSON", () => {
  const context = createContext(new Map([
    ["#equipmentEventPlace", input("Lugar sintético")],
    ["#equipmentEventName", input("Evento sintético activo")],
    ["#equipmentEventSetupAt", input("2026-10-07T08:00")],
    ["#equipmentEventDate", input("2026-10-07")],
    ["#equipmentEventInAt", input("2026-10-07T22:00")],
    ["#equipmentEventResponsible", input("Responsable sintético")]
  ]));
  loadWarehouse(context);
  const appended = plain(evaluate(context, `(() => {
    equipmentServices.synthetic = { name: "Servicio sintético", mainSections: [], extras: [] };
    setEquipmentServiceSelection(["synthetic"]);
    equipmentState.events = [{ id: "synthetic-selected", name: "Evento sintético activo", date: "2026-10-07", setupAt: "2026-10-07T08:00", equipmentInAt: "2026-10-07T22:00", serviceIds: ["synthetic"], sections: [] }];
    equipmentState.selectedEventId = "synthetic-selected";
    appendEquipmentExtraItems([{ quantity: 2, description: "Equipo sintético recién agregado", inventoryCategory: "Prueba", procurementChoice: "rent" }]);
    const payload = JSON.parse(JSON.stringify(equipmentEditablePayload("rent", { fileName: "sintetico.pdf" })));
    return {
      eventItems: equipmentState.events[0].sections.flatMap((section) => section.items),
      report: equipmentProcurementReportRows("rent"),
      jsonItems: payload.events[0].sections.flatMap((section) => section.items)
    };
  })()`));
  assert.equal(appended.eventItems.length, 1);
  assert.equal(appended.eventItems[0].quantity, 2);
  assert.equal(appended.eventItems[0].procurementChoice, "rent");
  assert.equal(appended.report.length, 1);
  assert.equal(appended.report[0].quantity, 2);
  assert.equal(appended.report[0].missing, 2);
  assert.deepEqual(appended.jsonItems, appended.eventItems);
  const refreshed = plain(evaluate(context, `(() => {
    equipmentState.manualMainSections[0].items[0].quantity = 5;
    refreshEquipmentSummaryAndPreview();
    return {
      eventQuantity: equipmentState.events[0].sections[0].items[0].quantity,
      reportQuantity: equipmentProcurementReportRows("rent")[0].quantity,
      jsonQuantity: equipmentEditablePayload("rent", { fileName: "sintetico.pdf" }).events[0].sections[0].items[0].quantity
    };
  })()`));
  assert.deepEqual(refreshed, { eventQuantity: 5, reportQuantity: 5, jsonQuantity: 5 });
});

test("canceling a later pending decision commits neither purchase intent nor save nor redirect", async () => {
  const context = createContext();
  loadWarehouse(context);
  evaluate(context, `
    equipmentState.manualExtras = [
      { id: "synthetic-pending-a", quantity: 2, description: "Equipo sintético pendiente A" },
      { id: "synthetic-pending-b", quantity: 3, description: "Equipo sintético pendiente B" }
    ];
    let saveCalls = 0;
    saveCurrentEquipmentWindow = () => { saveCalls++; return true; };
    let pendingChoices = ["purchase", null];
    requestEquipmentUnknownChoice = async () => pendingChoices.shift();
  `);
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), false);
  assert.deepEqual(plain(evaluate(context, "equipmentState.manualExtras.map((item) => item.procurementChoice || null)")), [null, null]);
  assert.equal(evaluate(context, "saveCalls"), 0);
  assert.equal(context.dispatchedEvents.length, 0);
  evaluate(context, 'pendingChoices = ["rent", "purchase"]');
  assert.equal(await evaluate(context, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.deepEqual(plain(evaluate(context, "equipmentState.manualExtras.map((item) => item.procurementChoice)")), ["rent", "purchase"]);
  assert.equal(evaluate(context, "saveCalls"), 1);
  assert.equal(context.dispatchedEvents.length, 1);
  assert.deepEqual(plain(context.dispatchedEvents[0].detail.items), [{ description: "Equipo sintético pendiente B", quantity: 3 }]);
});

test("same-name legacy stored Save, rent and purchase extras keep separate summary and report identities", () => {
  const context = createContext();
  loadWarehouse(context);
  const result = evaluate(context, `(() => {
    const common = { description: "Equipo sintético compartido", inventoryCategory: "Prueba" };
    appendEquipmentExtraItems([
      { ...common, quantity: 2, procurementChoice: "save" },
      { ...common, quantity: 3, procurementChoice: "rent" },
      { ...common, quantity: 4, procurementChoice: "purchase" }
    ]);
    appendEquipmentExtraItems([{ ...common, quantity: 1, procurementChoice: "rent" }]);
    const sections = cloneEquipmentSnapshotSections(manualMainSectionsForTable());
    equipmentState.events = [{ id: "synthetic-event", name: "Evento sintético", date: "2026-10-07", setupAt: "2026-10-07T08:00", equipmentInAt: "2026-10-07T22:00", sections }];
    const rows = equipmentRowsSummary().filter((row) => row.type === "item");
    return {
      items: sections.flatMap((section) => section.items).map((item) => ({ choice: item.procurementChoice, quantity: item.quantity })),
      rows: rows.map((row) => ({ key: row.key, choice: row.procurementChoice, quantity: row.quantity, action: equipmentProcurementActionFor(row), available: equipmentInventoryAvailableValueFor(row) })),
      rent: equipmentProcurementReportRows("rent").map((row) => ({ quantity: row.quantity, missing: row.missing, action: row.action })),
      purchase: equipmentProcurementReportRows("purchase").map((row) => ({ quantity: row.quantity, missing: row.missing, action: row.action })),
      dispatch: equipmentWarehouseDispatchItems(equipmentState.events[0]).map((item) => ({ choice: item.procurementChoice, quantity: item.quantity }))
    };
  })()`);
  const value = plain(result);
  assert.deepEqual(value.items, [{ choice: "save", quantity: 2 }, { choice: "rent", quantity: 4 }, { choice: "purchase", quantity: 4 }]);
  assert.equal(value.rows.length, 3);
  assert.equal(new Set(value.rows.map((row) => row.key)).size, 3);
  assert.deepEqual(value.rows.map(({ choice, quantity, action, available }) => ({ choice, quantity, action, available })), [
    { choice: "save", quantity: 2, action: "GUARDAR", available: 0 },
    { choice: "rent", quantity: 4, action: "RENTA", available: 0 },
    { choice: "purchase", quantity: 4, action: "COMPRA", available: 0 }
  ]);
  assert.deepEqual(value.rent, [{ quantity: 4, missing: 4, action: "RENTA" }]);
  assert.deepEqual(value.purchase, [{ quantity: 4, missing: 4, action: "COMPRA" }]);
  assert.deepEqual(value.dispatch, value.items);
});

test("editable JSON and normalized snapshots preserve all three procurement choices and zeros", () => {
  const context = createContext();
  const choices = evaluate(context, `(() => {
    const items = ["save", "rent", "purchase"].map((procurementChoice, index) => ({
      id: "synthetic-item-" + index, quantity: index, description: "Equipo sintético " + index,
      inventoryCategory: "Prueba", procurementChoice
    }));
    const event = cloneEquipmentEventForEditable({
      id: "synthetic-event", manualMainItems: items, manualExtras: items,
      manualMainSections: [{ title: "Prueba", items }],
      sectionAddedItems: [["synthetic-section", items]],
      sections: [{ title: "Prueba", manualSection: true, items }]
    });
    const restored = importedEquipmentEvent(JSON.parse(JSON.stringify(event)));
    return [restored.manualMainItems, restored.manualExtras, restored.manualMainSections[0].items,
      restored.sectionAddedItems[0][1], restored.sections[0].items].map((collection) =>
      collection.map((item) => ({ choice: item.procurementChoice, quantity: item.quantity })));
  })()`);
  const expected = [{ choice: "save", quantity: 0 }, { choice: "rent", quantity: 1 }, { choice: "purchase", quantity: 2 }];
  for (const collection of plain(choices)) assert.deepEqual(collection, expected);
});

test("registered purchase or saved extra uses new warehouse stock; rented extra stays external", () => {
  const context = createContext();
  loadWarehouse(context);
  evaluate(context, `
    const testUnknownItems = ["save", "rent", "purchase"].map((procurementChoice) => ({
      description: "Equipo sintético adquirido", inventoryCategory: "Prueba", procurementChoice, quantity: 2
    }));
  `);
  assert.deepEqual(plain(evaluate(context, "testUnknownItems.map(equipmentPendingProcurementChoice)")), ["save", "rent", "purchase"]);
  loadWarehouse(context, [{ id: "synthetic-purchased", name: "Equipo sintético adquirido", category: "Prueba", quantity: 7, itemType: "equipo" }], "2026-10-07T09:00:00.000Z");
  assert.deepEqual(plain(evaluate(context, "testUnknownItems.map(equipmentPendingProcurementChoice)")), ["", "rent", ""]);
  const result = plain(evaluate(context, `(() => {
    equipmentState.events = [{ id: "synthetic-event", date: "2026-10-07", setupAt: "2026-10-07T08:00", equipmentInAt: "2026-10-07T22:00", sections: [{ title: "Prueba", manualSection: true, items: testUnknownItems }] }];
    return equipmentRowsSummary().filter((row) => row.type === "item" && row.quantity > 0).map((row) => ({
      choice: row.procurementChoice || "", quantity: row.quantity,
      available: equipmentInventoryAvailableValueFor(row), action: equipmentProcurementActionFor(row)
    }));
  })()`));
  assert.equal(result.length, 2, "registered save and purchase extras merge into the inventory item");
  assert.deepEqual(result.find((row) => !row.choice), { choice: "", quantity: 4, available: 7, action: "RENTA" });
  assert.deepEqual(result.find((row) => row.choice === "rent"), { choice: "rent", quantity: 2, available: 0, action: "RENTA" });
  const dispatch = plain(evaluate(context, "equipmentWarehouseDispatchItems(equipmentState.events[0])"));
  const rented = dispatch.find((item) => item.procurementChoice === "rent");
  assert.equal(rented.quantity, 2);
  assert.deepEqual(rented.warehouseItemIds, [], "explicit rent must not dispatch matching warehouse stock");
  const stocked = dispatch.find((item) => !item.procurementChoice);
  assert.equal(stocked.quantity, 4);
  assert.deepEqual(stocked.warehouseItemIds, ["synthetic-purchased"]);
});

function classList() {
  const values = new Set();
  return { add(value) { values.add(value); }, remove(value) { values.delete(value); }, contains(value) { return values.has(value); }, toggle(value, enabled) { enabled ? values.add(value) : values.delete(value); } };
}

function decodeAttribute(value) {
  return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function createBulkHost() {
  let markup = "";
  const host = {
    rows: [],
    querySelectorAll(selector) {
      if (selector === ".equipment-bulk-extra-row") return this.rows;
      return this.rows.flatMap((row) => row.querySelectorAll(selector));
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  };
  Object.defineProperty(host, "innerHTML", {
    get() { return markup; },
    set(value) {
      markup = value;
      host.rows = [...value.matchAll(/<div\b[^>]*class="equipment-bulk-extra-row"[^>]*>([\s\S]*?)<\/div>/g)].map((match) => {
        const row = {
          parentElement: host, elements: [], span: { textContent: "" },
          remove() { host.rows.splice(host.rows.indexOf(this), 1); },
          querySelectorAll(selector) {
            if (selector === "span") return [this.span];
            const wanted = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);
            if (wanted) return this.elements.filter((element) => Object.hasOwn(element.attributes, wanted[1]) && (wanted[2] === undefined || element.attributes[wanted[1]] === wanted[2]));
            if (selector === "input" || selector === "button") return this.elements.filter((element) => element.tag === selector);
            return [];
          },
          querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        };
        for (const child of match[1].matchAll(/<(input|button)\b([^>]*)>/g)) {
          const attributes = Object.fromEntries([...child[2].matchAll(/([\w-]+)="([^"]*)"/g)].map((entry) => [entry[1], decodeAttribute(entry[2])]));
          const element = {
            ...input(attributes.value || ""), tag: child[1], attributes, parentElement: row,
            addEventListener() {}, closest() { return row; },
            setAttribute(name, value) { this.attributes[name] = String(value); if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value); },
            getAttribute(name) { return this.attributes[name] ?? null; }
          };
          for (const [name, value] of Object.entries(attributes)) if (name.startsWith("data-")) element.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
          row.elements.push(element);
        }
        return row;
      });
    }
  });
  return host;
}

test("bulk extras allow removing unused and populated rows while preserving and reindexing survivors", () => {
  const host = createBulkHost();
  const count = input(5);
  const addButton = { classList: classList() };
  const status = { textContent: "" };
  const context = createContext(new Map([
    ["#equipmentBulkExtrasRows", host], ["#equipmentBulkExtraCount", count],
    ["#equipmentAddBulkExtrasButton", addButton], ["#equipmentSaveStatus", status]
  ]));
  evaluate(context, "prepareEquipmentBulkExtras()");
  assert.equal(host.rows.length, 5);
  assert.ok(host.rows.every((row) => row.querySelectorAll("button").length > 0), "every extra row has a removal button");
  for (let index = 0; index < 4; index++) {
    host.querySelector(`[data-equipment-bulk-description="${index}"]`).value = `Equipo sintético ${index + 1}`;
    host.querySelector(`[data-equipment-bulk-quantity="${index}"]`).value = String(index + 2);
  }
  context.rowToRemove = host.rows[4];
  evaluate(context, "removeEquipmentBulkExtraRow(rowToRemove)");
  assert.equal(host.rows.length, 4, "the unused fifth line can be removed without completing it");
  context.rowToRemove = host.rows[1];
  evaluate(context, "removeEquipmentBulkExtraRow(rowToRemove)");
  assert.equal(host.rows.length, 3);
  assert.deepEqual(host.querySelectorAll("[data-equipment-bulk-description]").map((entry) => entry.value), ["Equipo sintético 1", "Equipo sintético 3", "Equipo sintético 4"]);
  assert.deepEqual(host.querySelectorAll("[data-equipment-bulk-quantity]").map((entry) => entry.value), ["2", "4", "5"]);
  assert.deepEqual(host.querySelectorAll("[data-equipment-bulk-description]").map((entry) => entry.dataset.equipmentBulkDescription), ["0", "1", "2"]);
  assert.deepEqual(host.querySelectorAll("[data-equipment-bulk-quantity]").map((entry) => entry.dataset.equipmentBulkQuantity), ["0", "1", "2"]);
});
