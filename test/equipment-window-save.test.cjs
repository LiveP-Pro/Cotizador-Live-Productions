const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function element(value = "") {
  const classes = new Set();
  const attributes = new Map();
  return {
    value, textContent: "", dataset: {}, disabled: false,
    classList: {
      add(name) { classes.add(name); }, remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }
    },
    setAttribute(name, next) { attributes.set(name, next); },
    getAttribute(name) { return attributes.get(name); },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener() {}, focus() {}
  };
}

function context() {
  const source = { authoritative: true, fileName: "Fuente sintética actual.xlsx", version: "window-save-current" };
  const audio = (name, code, quantity) => ({
    name, importSource: source, mainSections: [{
      id: `current-audio-${code}`, title: "Audio", importSource: source,
      items: [[quantity, `Altavoz sintético ${code}`], [0, `Equipo cero ${code}`]],
      rows: [
        { type: "item", sourceItemIndex: 0, quantity, description: `Altavoz sintético ${code}`,
          notes: [`Nota sintética ${code}`], cells: [{ ref: `AUDIO!${code}2`, value: quantity }] },
        { type: "item", sourceItemIndex: 1, quantity: 0, description: `Equipo cero ${code}`,
          cells: [{ ref: `AUDIO!${code}3`, value: 0 }] }
      ]
    }], extras: []
  });
  const dj = (name, code) => ({
    name, importSource: source, mainSections: [
      { id: `current-${code}-audio`, title: "Audio", items: [[9, `Audio base sintético ${code}`]], importSource: source },
      { id: `current-${code}-light`, title: "Iluminación", items: [[3, `Luz sintética ${code}`]], importSource: source }
    ], extras: [{ id: `extra-${code}`, title: "Complemento sintético", items: [[1, `Complemento ${code}`]] }]
  });
  const catalog = {
    version: source.version, services: {
      "dj-completo": dj("DJ COMPLETO", "completo"), "dj-privado": dj("DJ PRIVADO", "privado"),
      "audio-qsc": audio("AUDIO QSC", "Q", 2), "audio-jbl": audio("AUDIO JBL", "J", 4),
      turbosound: audio("TURBOSOUND", "T", 6), ip2000: audio("IP2000", "I", 8)
    }, groups: [
      { label: "DJ", serviceIds: ["dj-completo", "dj-privado"] },
      { label: "AUDIO", serviceIds: ["audio-qsc", "audio-jbl", "turbosound", "ip2000"] }
    ]
  };
  const elements = new Map([
    "#equipmentEventPlace", "#equipmentEventName", "#equipmentEventSetupAt", "#equipmentEventDate",
    "#equipmentEventInAt", "#equipmentEventResponsible", "#equipmentNotes", "#equipmentManualSubtitle",
    "#equipmentSaveStatus", "#equipmentAddEventButton", "#equipmentSaveWindowButton"
  ].map((selector) => [selector, element()]));
  const externalRequests = [];
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {},
    fetch: async (...args) => { externalRequests.push(args); throw new Error("External writes are forbidden in synthetic tests"); },
    window: {
      requerimientoEquipoCatalog: catalog, requerimientoEquipoInventory: { categories: [] },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: {
      querySelector(selector) { return elements.get(selector) || null; }, querySelectorAll() { return []; },
      addEventListener() {}, dispatchEvent() {}
    }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  vm.runInContext(`
    renderEquipmentModule = () => {};
    reconcilePendingEquipmentStockIngress = async () => {};
    let syntheticRegistrationCalls = 0;
    registerSavedEquipmentExtras = async items => {
      syntheticRegistrationCalls++;
      if (items.some(item => item.procurementChoice === "save")) throw new Error("Test needs an explicit synthetic receipt");
      return items;
    };
  `, sandbox);
  return { sandbox, elements, externalRequests };
}

const execute = (fixture, code) => vm.runInContext(code, fixture.sandbox);
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);

async function selectDj(fixture, serviceId, audioId) {
  fixture.sandbox.syntheticServiceId = serviceId;
  fixture.sandbox.syntheticAudioId = audioId;
  execute(fixture, "requestEquipmentDjAudioChoice = async () => syntheticAudioId;");
  assert.equal(await execute(fixture, "applyEquipmentUserServiceSelection([syntheticServiceId])"), true);
}

test("Agregar ventana keeps the saved DJ window visible and Nueva ventana starts an independent second window across all audio choices", async () => {
  for (const [firstAudio, firstCode, secondAudio, secondCode] of [
    ["audio-qsc", "Q", "turbosound", "T"], ["audio-jbl", "J", "ip2000", "I"]
  ]) {
    const fixture = context();
    await selectDj(fixture, "dj-completo", firstAudio);
    fixture.elements.get("#equipmentEventName").value = "Evento sintético primero";
    fixture.elements.get("#equipmentNotes").value = "Borrador sintético";
    execute(fixture, `
      equipmentState.selectedExtraIds.add(equipmentExtraSelectionKey("dj-completo", "extra-completo"));
      appendEquipmentExtraItems([{ description: "Extra primero", quantity: 2, procurementChoice: "rent" }]);
      const firstAudioSection = selectedEquipmentSections()[0];
      equipmentState.itemOverrides.set(firstAudioSection.items[0].id, { quantity: 11 });
      equipmentState.sectionAddedItems.set(firstAudioSection.id, [{
        id: "synthetic-added-first", description: "Equipo añadido a audio primero", quantity: 2, procurementChoice: "rent"
      }]);
      equipmentState.removedItemIds.add(selectedEquipmentSections()[1].items[0].id);
    `);
    const firstSnapshot = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
    assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
    const firstEvent = plain(execute(fixture, "equipmentState.events[0]"));
    assert.deepEqual(firstEvent.sections, firstSnapshot.sections);
    assert.deepEqual(firstEvent.selectedExtraIds, firstSnapshot.selectedExtraIds);
    assert.deepEqual(firstEvent.itemOverrides, firstSnapshot.itemOverrides);
    assert.deepEqual(firstEvent.sectionAddedItems, firstSnapshot.sectionAddedItems);
    assert.deepEqual(firstEvent.removedItemIds, firstSnapshot.removedItemIds);
    assert.deepEqual(firstEvent.djAudioSelections, { "dj-completo": firstAudio });
    assert.equal(firstEvent.name, "Evento sintético primero");
    assert.ok(firstEvent.sections.flatMap((section) => section.items).some((item) => item.description === `Equipo cero ${firstCode}` && item.quantity === 0));
    assert.ok(JSON.stringify(firstEvent.sections).includes(`Nota sintética ${firstCode}`));
    assert.equal(execute(fixture, "equipmentState.selectedEventId"), firstEvent.id);
    assert.deepEqual(plain(execute(fixture, "selectedEquipmentServiceIds()")), ["dj-completo"]);
    assert.equal(fixture.elements.get("#equipmentNotes").value, "Borrador sintético");
    assert.equal(firstEvent.notes, "Borrador sintético");
    execute(fixture, "startNewEquipmentWindowDraft()");
    assert.equal(execute(fixture, "equipmentState.selectedEventId"), "");
    assert.deepEqual(plain(execute(fixture, "selectedEquipmentServiceIds()")), []);
    assert.deepEqual(plain(execute(fixture, "equipmentState.djAudioSelections")), {});
    assert.deepEqual(plain(execute(fixture, "equipmentState.manualMainSections")), []);
    assert.equal(execute(fixture, "equipmentState.itemOverrides.size + equipmentState.sectionAddedItems.size + equipmentState.removedItemIds.size"), 0);
    assert.equal(fixture.elements.get("#equipmentEventName").value, "");
    assert.equal(fixture.elements.get("#equipmentNotes").value, "");
    await selectDj(fixture, "dj-privado", secondAudio);
    execute(fixture, 'appendEquipmentExtraItems([{ description: "Extra segundo", quantity: 5, procurementChoice: "rent" }]);');
    assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
    const events = plain(execute(fixture, "equipmentState.events"));
    assert.equal(events.length, 2);
    assert.notEqual(events[0].id, events[1].id);
    assert.notEqual(events[0].warehouseDispatchId, events[1].warehouseDispatchId);
    assert.deepEqual(events[0], firstEvent);
    assert.deepEqual(events[1].djAudioSelections, { "dj-privado": secondAudio });
    assert.deepEqual(events[1].itemOverrides, []);
    assert.deepEqual(events[1].sectionAddedItems, []);
    assert.deepEqual(events[1].removedItemIds, []);
    const secondItems = events[1].sections.flatMap((section) => section.items);
    assert.ok(secondItems.some((item) => item.description === `Altavoz sintético ${secondCode}`));
    assert.ok(secondItems.some((item) => item.description === "Extra segundo" && item.quantity === 5));
    assert.ok(!secondItems.some((item) => item.description === "Extra primero" || item.description === `Altavoz sintético ${firstCode}`));
    assert.deepEqual(fixture.externalRequests, []);
  }
});

test("Agregar ventana while editing updates the existing window once and keeps its editor selected", async () => {
  const fixture = context();
  await selectDj(fixture, "dj-completo", "audio-qsc");
  assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
  execute(fixture, "startNewEquipmentWindowDraft()");
  await selectDj(fixture, "dj-privado", "audio-jbl");
  assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
  const secondBefore = plain(execute(fixture, "equipmentState.events[1]"));
  execute(fixture, "loadEquipmentEvent(equipmentState.events[0].id); requestEquipmentDjAudioChoice = async () => 'ip2000';");
  assert.equal(await execute(fixture, "changeEquipmentDjAudio('dj-completo')"), true);
  fixture.elements.get("#equipmentEventName").value = "Primer evento editado";
  execute(fixture, 'appendEquipmentExtraItems([{ description: "Extra de edición", quantity: 7, procurementChoice: "rent" }]);');
  const edited = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
  const originalId = execute(fixture, "equipmentState.events[0].id");
  assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
  const events = plain(execute(fixture, "equipmentState.events"));
  assert.equal(events.length, 2);
  assert.equal(events[0].id, originalId);
  assert.equal(events[0].name, "Primer evento editado");
  assert.deepEqual(events[0].sections, edited.sections);
  assert.deepEqual(events[0].djAudioSelections, { "dj-completo": "ip2000" });
  assert.deepEqual(events[1], secondBefore);
  assert.equal(execute(fixture, "equipmentState.selectedEventId"), originalId);
  assert.equal(execute(fixture, "currentEquipmentService().id"), "dj-completo");
});

test("Guardar ventana is enabled for a new service, creates it, and keeps the selected window editable", async () => {
  const fixture = context();
  execute(fixture, "renderEquipmentWindowState()");
  const button = fixture.elements.get("#equipmentSaveWindowButton");
  assert.equal(button.disabled, true);
  await selectDj(fixture, "dj-privado", "turbosound");
  execute(fixture, "renderEquipmentWindowState()");
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Guardar ventana");
  assert.equal(await execute(fixture, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(execute(fixture, "equipmentState.events.length"), 1);
  assert.equal(execute(fixture, "equipmentState.selectedEventId"), execute(fixture, "equipmentState.events[0].id"));
  assert.deepEqual(plain(execute(fixture, "selectedEquipmentServiceIds()")), ["dj-privado"]);
  execute(fixture, "renderEquipmentWindowState()");
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Guardar cambios");
  fixture.elements.get("#equipmentEventPlace").value = "Lugar editado";
  assert.equal(await execute(fixture, "saveCurrentEquipmentWindowWithExtraChoices()"), true);
  assert.equal(execute(fixture, "equipmentState.events.length"), 1);
  assert.equal(execute(fixture, "equipmentState.events[0].place"), "Lugar editado");
  assert.equal(fixture.elements.get("#equipmentAddEventButton").textContent, "Agregar ventana");
});

test("canceling an unresolved extra keeps the full draft and never creates or clears a window", async () => {
  const fixture = context();
  await selectDj(fixture, "dj-completo", "audio-qsc");
  fixture.elements.get("#equipmentEventPlace").value = "Lugar pendiente";
  execute(fixture, `
    appendEquipmentExtraItems([{ description: "Extra desconocido sintético", quantity: 4 }]);
    requestEquipmentUnknownChoice = async () => null;
  `);
  const before = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
  const dispatchId = execute(fixture, "equipmentState.draftWarehouseDispatchId");
  assert.equal(await execute(fixture, "addEquipmentEvent()"), false);
  assert.equal(execute(fixture, "equipmentState.events.length"), 0);
  assert.deepEqual(plain(execute(fixture, "captureEquipmentEventSnapshot()")), before);
  assert.equal(execute(fixture, "equipmentState.draftWarehouseDispatchId"), dispatchId);
  assert.equal(fixture.elements.get("#equipmentEventPlace").value, "Lugar pendiente");
  assert.equal(execute(fixture, "syntheticRegistrationCalls"), 0);
  assert.equal(execute(fixture, "equipmentExtraEntryBusy"), false);
  assert.deepEqual(fixture.externalRequests, []);
});

test("an inventory receipt failure preserves the draft and permits a successful retry", async () => {
  const fixture = context();
  await selectDj(fixture, "dj-privado", "ip2000");
  execute(fixture, `
    appendEquipmentExtraItems([{ description: "Extra con ingreso sintético", quantity: 3 }]);
    requestEquipmentUnknownChoice = async () => "save";
    registerSavedEquipmentExtras = async () => { throw new Error("Confirmación sintética rechazada"); };
  `);
  assert.equal(await execute(fixture, "addEquipmentEvent()"), false);
  assert.equal(execute(fixture, "equipmentState.events.length"), 0);
  assert.deepEqual(plain(execute(fixture, "selectedEquipmentServiceIds()")), ["dj-privado"]);
  assert.equal(execute(fixture, "equipmentState.manualMainSections[0].items[0].quantity"), 3);
  assert.equal(execute(fixture, "equipmentExtraEntryBusy"), false);
  assert.match(fixture.elements.get("#equipmentSaveStatus").textContent, /Confirmación sintética rechazada/);
  execute(fixture, `registerSavedEquipmentExtras = async items => {
    for (const item of items) {
      item.warehouseInventoryId = "synthetic-stock";
      item.inventoryIngressReceipts = [{ requestId: "synthetic-confirmation", itemId: "synthetic-stock", quantity: item.quantity, index: 0 }];
    }
    return items;
  };`);
  assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
  const saved = plain(execute(fixture, "equipmentState.events[0].manualMainSections[0].items[0]"));
  assert.equal(saved.procurementChoice, "save");
  assert.equal(saved.warehouseInventoryId, "synthetic-stock");
  assert.equal(saved.inventoryIngressReceipts[0].quantity, 3);
  assert.equal(execute(fixture, "currentEquipmentService().id"), "dj-privado");
  assert.deepEqual(fixture.externalRequests, []);
});

test("invalid complete dates block decisions and stock registration while preserving the draft", async () => {
  const fixture = context();
  await selectDj(fixture, "dj-completo", "audio-jbl");
  fixture.elements.get("#equipmentEventSetupAt").value = "2026-10-14T12:00";
  fixture.elements.get("#equipmentEventDate").value = "2026-10-14";
  fixture.elements.get("#equipmentEventInAt").value = "2026-10-14T09:00";
  execute(fixture, `
    appendEquipmentExtraItems([{ description: "Extra pendiente de fechas", quantity: 8 }]);
    let syntheticDecisionCalls = 0;
    requestEquipmentUnknownChoice = async () => { syntheticDecisionCalls++; return "rent"; };
  `);
  const before = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
  assert.equal(await execute(fixture, "addEquipmentEvent()"), false);
  assert.deepEqual(plain(execute(fixture, "captureEquipmentEventSnapshot()")), before);
  assert.equal(execute(fixture, "equipmentState.events.length"), 0);
  assert.equal(execute(fixture, "syntheticDecisionCalls"), 0);
  assert.equal(execute(fixture, "syntheticRegistrationCalls"), 0);
  assert.equal(fixture.elements.get("#equipmentEventInAt").value, "2026-10-14T09:00");
  assert.equal(fixture.elements.get("#equipmentEventInAt").getAttribute("aria-invalid"), "true");
});

test("Agregar waits for the receipt before saving or resetting and ignores a concurrent second click", async () => {
  const fixture = context();
  await selectDj(fixture, "dj-privado", "turbosound");
  execute(fixture, `
    appendEquipmentExtraItems([{ description: "Extra esperando confirmación", quantity: 2 }]);
    requestEquipmentUnknownChoice = async () => "save";
    let completeSyntheticReceipt;
    let syntheticReceiptCalls = 0;
    registerSavedEquipmentExtras = items => new Promise(resolve => {
      syntheticReceiptCalls++;
      completeSyntheticReceipt = () => {
        items.forEach(item => {
          item.warehouseInventoryId = "synthetic-confirmed-stock";
          item.inventoryIngressReceipts = [{ requestId: "synthetic-ack", itemId: "synthetic-confirmed-stock", quantity: item.quantity, index: 0 }];
        });
        resolve(items);
      };
    });
  `);
  const pending = execute(fixture, "addEquipmentEvent()");
  await flush();
  assert.equal(execute(fixture, "syntheticReceiptCalls"), 1);
  assert.equal(execute(fixture, "equipmentState.events.length"), 0);
  assert.deepEqual(plain(execute(fixture, "selectedEquipmentServiceIds()")), ["dj-privado"]);
  assert.equal(await execute(fixture, "addEquipmentEvent()"), false);
  execute(fixture, "completeSyntheticReceipt()");
  assert.equal(await pending, true);
  assert.equal(execute(fixture, "equipmentState.events.length"), 1);
  assert.equal(execute(fixture, "equipmentState.events[0].manualMainSections[0].items[0].inventoryIngressReceipts[0].quantity"), 2);
  assert.equal(execute(fixture, "currentEquipmentService().id"), "dj-privado");
  assert.equal(execute(fixture, "equipmentExtraEntryBusy"), false);
  assert.deepEqual(fixture.externalRequests, []);
});

test("a standalone document window retains its source notes and zeros until explicit Nueva ventana", async () => {
  const fixture = context();
  execute(fixture, `
    equipmentState.documentServiceName = "Documento sintético actual";
    equipmentState.documentSections = [{
      id: "synthetic-document", title: "Audio documental", documentSection: true,
      items: [{ id: "synthetic-zero", description: "Cero documental", quantity: 0, procurementChoice: "rent" }],
      rows: [{ type: "item", sourceItemIndex: 0, description: "Cero documental", quantity: 0,
        cells: [{ ref: "Fuente!A2", value: 0 }, { ref: "Fuente!B2", value: "Cero documental" }] },
        { type: "note", description: "Nota documental intacta" }]
    }];
  `);
  const before = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
  assert.equal(await execute(fixture, "addEquipmentEvent()"), true);
  const event = plain(execute(fixture, "equipmentState.events[0]"));
  assert.deepEqual(event.documentSections, before.documentSections);
  assert.deepEqual(event.sections, before.sections);
  assert.deepEqual(event.serviceIds, []);
  assert.equal(event.serviceName, "Documento sintético actual");
  assert.equal(event.documentSections[0].items[0].quantity, 0);
  assert.deepEqual(plain(execute(fixture, "cloneEquipmentSnapshotSections(equipmentState.documentSections)")), before.documentSections);
  assert.equal(execute(fixture, "equipmentState.selectedEventId"), event.id);
  execute(fixture, "startNewEquipmentWindowDraft()");
  assert.deepEqual(plain(execute(fixture, "equipmentState.documentSections")), []);
  assert.equal(execute(fixture, "equipmentState.documentServiceName"), "");
  assert.deepEqual(fixture.externalRequests, []);
});

test("incomplete operating times require the sum of both windows and cannot apply a previous transfer", () => {
  const fixture = context();
  const result = plain(execute(fixture, `(() => {
    const row = {
      key: "altavoz sintético compartido", description: "Altavoz sintético compartido",
      eventQuantities: new Map([["synthetic-first", 5], ["synthetic-second", 7]])
    };
    const partialEvents = [
      { id: "synthetic-first", setupAt: "2026-10-14T08:00", date: "", equipmentInAt: "" },
      { id: "synthetic-second", setupAt: "2026-10-18T08:00", date: "", equipmentInAt: "" }
    ];
    const route = createEquipmentSummaryTransferRoute(
      ["synthetic-first", "synthetic-second"], "synthetic-prior-route", {
        "synthetic-first::synthetic-second": [{ identity: equipmentSummaryRowIdentity(row), quantity: 5 }]
      }
    );
    const plainPartial = equipmentPeakRequiredQuantity(row, partialEvents);
    const routedPartial = equipmentPeakRequiredQuantity(row, partialEvents, [{ route, events: partialEvents }], true);
    const completeEvents = [
      { ...partialEvents[0], date: "2026-10-14", equipmentInAt: "2026-10-14T22:00" },
      { ...partialEvents[1], date: "2026-10-18", equipmentInAt: "2026-10-18T22:00" }
    ];
    return {
      partial: plainPartial.quantity, withPriorRoute: routedPartial.quantity,
      appliedRouteIds: [...routedPartial.appliedRouteIds],
      completed: equipmentPeakRequiredQuantity(row, completeEvents).quantity
    };
  })()`));
  assert.deepEqual(result, { partial: 12, withPriorRoute: 12, appliedRouteIds: [], completed: 7 });
  assert.deepEqual(fixture.externalRequests, []);
});

test("a return before setup is invalid even with no event date and cannot save or clear the window", async () => {
  const fixture = context();
  await selectDj(fixture, "dj-completo", "audio-qsc");
  fixture.elements.get("#equipmentEventSetupAt").value = "2026-10-14T18:00";
  fixture.elements.get("#equipmentEventDate").value = "";
  fixture.elements.get("#equipmentEventInAt").value = "2026-10-14T08:00";
  execute(fixture, `
    appendEquipmentExtraItems([{ description: "Extra de rango parcial", quantity: 2 }]);
    let syntheticPartialDecisionCalls = 0;
    requestEquipmentUnknownChoice = async () => { syntheticPartialDecisionCalls++; return "rent"; };
  `);
  const before = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
  assert.equal(execute(fixture, "equipmentEventTimelineValidation(currentEquipmentEventDraft()).valid"), false);
  assert.equal(await execute(fixture, "addEquipmentEvent()"), false);
  assert.equal(execute(fixture, "equipmentState.events.length"), 0);
  assert.equal(execute(fixture, "syntheticPartialDecisionCalls"), 0);
  assert.equal(execute(fixture, "syntheticRegistrationCalls"), 0);
  assert.deepEqual(plain(execute(fixture, "captureEquipmentEventSnapshot()")), before);
  assert.equal(fixture.elements.get("#equipmentEventSetupAt").value, "2026-10-14T18:00");
  assert.equal(fixture.elements.get("#equipmentEventInAt").value, "2026-10-14T08:00");
  assert.deepEqual(fixture.externalRequests, []);
});

test("partial dates reject an event outside either known boundary and permit a coherent partial schedule", async () => {
  for (const { setupAt, date, returnAt, valid } of [
    { setupAt: "2026-10-15T08:00", date: "2026-10-14", returnAt: "", valid: false },
    { setupAt: "", date: "2026-10-15", returnAt: "2026-10-14T22:00", valid: false },
    { setupAt: "2026-10-14T08:00", date: "2026-10-15", returnAt: "", valid: true },
    { setupAt: "", date: "2026-10-14", returnAt: "2026-10-15T22:00", valid: true },
    { setupAt: "2026-10-14T08:00", date: "", returnAt: "", valid: true }
  ]) {
    const fixture = context();
    await selectDj(fixture, "dj-privado", "audio-jbl");
    fixture.elements.get("#equipmentEventSetupAt").value = setupAt;
    fixture.elements.get("#equipmentEventDate").value = date;
    fixture.elements.get("#equipmentEventInAt").value = returnAt;
    const before = plain(execute(fixture, "captureEquipmentEventSnapshot()"));
    const detail = JSON.stringify({ setupAt, date, returnAt });
    assert.equal(execute(fixture, "equipmentEventTimelineValidation(currentEquipmentEventDraft()).valid"), valid, detail);
    assert.equal(await execute(fixture, "addEquipmentEvent()"), valid, detail);
    if (valid) {
      const event = plain(execute(fixture, "equipmentState.events[0]"));
      assert.equal(event.setupAt, setupAt, detail);
      assert.equal(event.date, date, detail);
      assert.equal(event.equipmentInAt, returnAt, detail);
      assert.equal(execute(fixture, "currentEquipmentService().id"), "dj-privado", detail);
      assert.equal(execute(fixture, "equipmentState.selectedEventId"), event.id, detail);
    } else {
      assert.equal(execute(fixture, "equipmentState.events.length"), 0, detail);
      assert.deepEqual(plain(execute(fixture, "captureEquipmentEventSnapshot()")), before, detail);
      assert.equal(fixture.elements.get("#equipmentEventDate").value, date, detail);
      assert.equal(execute(fixture, "syntheticRegistrationCalls"), 0, detail);
    }
    assert.deepEqual(fixture.externalRequests, []);
  }
});
