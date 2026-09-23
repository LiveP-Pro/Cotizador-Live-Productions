const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createEquipmentContext(loadCurrentCatalogs = false) {
  const context = {
    console,
    URL,
    Blob,
    Map,
    Set,
    Date,
    Math,
    JSON,
    Number,
    String,
    Object,
    Array,
    RegExp,
    Promise,
    window: {
      requerimientoEquipoCatalog: { services: {}, groups: [] },
      requerimientoEquipoInventory: { categories: [] },
      addEventListener() {},
      setTimeout,
      setInterval,
      requestAnimationFrame(callback) { callback(); }
    },
    document: {
      querySelector() { return null; },
      addEventListener() {},
      dispatchEvent() {},
      querySelectorAll() { return []; }
    },
    setTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: false })
  };
  context.globalThis = context;
  vm.createContext(context);
  if (loadCurrentCatalogs) {
    ["equipment-catalog.js", "equipment-inventory.js"].forEach((file) => {
      vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
    });
  }
  const source = fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8");
  vm.runInContext(source, context, { filename: "equipment.js" });
  return context;
}

function evaluate(context, source) {
  return vm.runInContext(source, context);
}

test("separated events reuse equipment instead of adding both quantities", () => {
  const context = createEquipmentContext();
  const quantity = evaluate(context, `
    equipmentPeakRequiredQuantity(
      { key: "luces", description: "Luces", eventQuantities: new Map([["a", 5], ["b", 5]]) },
      [
        { id: "a", setupAt: "2026-09-07T08:00", date: "2026-09-07", equipmentInAt: "2026-09-07T22:00" },
        { id: "b", setupAt: "2026-09-12T08:00", date: "2026-09-12", equipmentInAt: "2026-09-12T22:00" }
      ],
      []
    ).quantity
  `);
  assert.equal(quantity, 5);
});

test("consumables accumulate across events and are classified for purchase", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    const events = [
      { id: "a", setupAt: "2026-09-07T08:00", date: "2026-09-07", equipmentInAt: "2026-09-07T22:00" },
      { id: "b", setupAt: "2026-09-12T08:00", date: "2026-09-12", equipmentInAt: "2026-09-12T22:00" }
    ];
    const row = {
      key: "cinta",
      description: "Cinta gaffer CONSUMIBLE.",
      inventorySourceItem: { description: "Cinta gaffer" },
      eventQuantities: new Map([["a", 5], ["b", 5]])
    };
    const route = createEquipmentSummaryTransferRoute(["a", "b"], "route-consumible", {
      "a::b": [{ identity: "cinta gaffer consumible", quantity: 5 }]
    });
    return {
      quantity: equipmentPeakRequiredQuantity(row, events, [{ route, events }], true).quantity,
      action: equipmentProcurementActionFor(row),
      isConsumable: equipmentDescriptionEndsWithConsumable(row.description)
    };
  })()`);
  assert.equal(result.quantity, 10);
  assert.equal(result.action, "COMPRA");
  assert.equal(result.isConsumable, true);
});

test("consumables are excluded from transfer candidates", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    const from = { id: "a" };
    const to = { id: "b" };
    const rows = [
      {
        identity: "cinta consumible",
        description: "Cinta consumible",
        categoryTitle: "Consumibles",
        eventQuantities: new Map([["a", 4], ["b", 4]])
      },
      {
        identity: "luz led",
        description: "Luz LED",
        categoryTitle: "Iluminación",
        eventQuantities: new Map([["a", 2], ["b", 2]])
      }
    ];
    return equipmentTransferredItemsBetweenEvents(from, to, rows).map((item) => item.description);
  })()`);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), ["Luz LED"]);
});

test("shortage report shows purchase and rent actions without merging different equipment", () => {
  const context = createEquipmentContext();
  const html = evaluate(context, `tableForEquipmentRentalReport([
    { rentalKey: "cinta", description: "Cinta consumible", eventDetails: "A: 4", quantity: 4, inventory: 0, missing: 4, action: "COMPRA", observation: "" },
    { rentalKey: "luz", description: "Luz LED", eventDetails: "A: 2", quantity: 2, inventory: 0, missing: 2, action: "RENTA", observation: "" }
  ], false)`);
  assert.match(html, /COMPRA/);
  assert.match(html, /RENTA/);
  assert.match(html, /Cantidad faltante/);
  assert.match(html, /Acción/);
});

test("simultaneous events add their equipment requirements", () => {
  const context = createEquipmentContext();
  const quantity = evaluate(context, `
    equipmentPeakRequiredQuantity(
      { key: "luces", description: "Luces", eventQuantities: new Map([["a", 5], ["b", 5]]) },
      [
        { id: "a", setupAt: "2026-09-12T08:00", date: "2026-09-12", equipmentInAt: "2026-09-12T22:00" },
        { id: "b", setupAt: "2026-09-12T10:00", date: "2026-09-12", equipmentInAt: "2026-09-12T23:00" }
      ],
      []
    ).quantity
  `);
  assert.equal(quantity, 10);
});

test("a one-hour turnaround triggers rent while three hours permits reuse", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    const origin = { id: "a", setupAt: "2026-09-11T08:00", date: "2026-09-11", equipmentInAt: "2026-09-12T03:00" };
    return {
      tight: equipmentLogisticsPairAnalysis(origin, { id: "b", setupAt: "2026-09-12T04:00", date: "2026-09-12", equipmentInAt: "2026-09-12T20:00" }).rentApplies,
      reusable: equipmentLogisticsPairAnalysis(origin, { id: "c", setupAt: "2026-09-12T06:00", date: "2026-09-12", equipmentInAt: "2026-09-12T20:00" }).rentApplies
    };
  })()`);
  assert.equal(result.tight, true);
  assert.equal(result.reusable, false);
});

test("only manually selected transfer units reduce the destination requirement", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    const events = [
      { id: "a", setupAt: "2026-09-12T08:00", date: "2026-09-12", equipmentInAt: "2026-09-12T22:00" },
      { id: "b", setupAt: "2026-09-12T10:00", date: "2026-09-12", equipmentInAt: "2026-09-12T23:00" }
    ];
    const row = { key: "luces", description: "Luces", eventQuantities: new Map([["a", 5], ["b", 5]]) };
    const route = createEquipmentSummaryTransferRoute(["a", "b"], "route-1", {
      "a::b": [{ identity: "luces", quantity: 2 }]
    });
    const adjusted = equipmentPeakRequiredQuantity(row, events, [{ route, events }], true);
    const untouched = equipmentPeakRequiredQuantity(row, events, [], true);
    return { adjusted: adjusted.quantity, untouched: untouched.quantity, routes: adjusted.appliedRouteIds.size };
  })()`);
  assert.equal(result.untouched, 10);
  assert.equal(result.adjusted, 8);
  assert.equal(result.routes, 1);
});

test("route cleanup keeps manual selections made through an active route reference", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    const events = [
      { id: "a", active: true },
      { id: "b", active: true }
    ];
    equipmentState.events = events;
    equipmentState.summaryTransferEnabled = true;
    const route = createEquipmentSummaryTransferRoute(["a", "b"], "route-1");
    equipmentState.summaryTransferRoutes = [route];
    equipmentState.activeSummaryTransferRouteId = route.id;
    const activeRoute = equipmentActiveSummaryTransferRoute(events);

    cleanupEquipmentSummaryTransferRoutes(events);
    equipmentSetTransferLegSelections(activeRoute, events[0], events[1], [
      { identity: "Ipad con cargador", quantity: 2 }
    ]);
    cleanupEquipmentSummaryTransferRoutes(events);

    return {
      sameReference: equipmentState.summaryTransferRoutes[0] === activeRoute,
      selections: equipmentState.summaryTransferRoutes[0].legSelections["a::b"]
    };
  })()`);
  assert.equal(result.sameReference, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.selections)), [
    { identity: "ipad con cargador", quantity: 2 }
  ]);
});

test("same-day logistics decision recommends transfer and names exact times", () => {
  const context = createEquipmentContext();
  const message = evaluate(context, `(() => {
    const origin = {
      id: "a",
      place: "Evento Viernes",
      date: "2026-09-11",
      setupAt: "2026-09-11T08:00",
      equipmentInAt: "2026-09-12T03:00"
    };
    const destination = {
      id: "b",
      place: "Evento Sábado",
      date: "2026-09-12",
      setupAt: "2026-09-12T04:00",
      equipmentInAt: "2026-09-13T02:00"
    };
    return equipmentLogisticsDecisionMessage(
      equipmentLogisticsPairAnalysis(origin, destination),
      "transfer"
    );
  })()`);
  assert.match(message.summary, /11\/09\/2026/);
  assert.match(message.summary, /12\/09\/2026/);
  assert.match(message.detail, /12\/09\/2026 · 03:00/);
  assert.match(message.detail, /12\/09\/2026 · 04:00/);
  assert.equal(message.title, "Se recomienda trasegar");
  assert.match(message.detail, /FALTA TIEMPO/);
  assert.match(message.recommendation, /SE RECOMIENDA TRASEGAR/);
});

test("event date must stay inside setup and warehouse-return dates", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => ({
    before: equipmentEventTimelineValidation({
      setupAt: "2026-09-18T08:00",
      date: "2026-09-17",
      equipmentInAt: "2026-09-20T02:00"
    }, { requireComplete: true }),
    inside: equipmentEventTimelineValidation({
      setupAt: "2026-09-18T08:00",
      date: "2026-09-19",
      equipmentInAt: "2026-09-20T02:00"
    }, { requireComplete: true })
  }))()`);
  assert.equal(result.before.valid, false);
  assert.equal(result.before.code, "event-outside-operation-range");
  assert.match(result.before.summary, /FUERA DE LAS FECHAS ESTABLECIDAS/);
  assert.equal(result.inside.valid, true);
});

test("warehouse return cannot be earlier than setup", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `equipmentEventTimelineValidation({
    setupAt: "2026-09-18T08:00",
    date: "2026-09-18",
    equipmentInAt: "2026-09-18T07:00"
  }, { requireComplete: true })`);
  assert.equal(result.valid, false);
  assert.equal(result.code, "return-before-setup");
});

test("same-day warehouse return is flagged even with more than two hours", () => {
  const context = createEquipmentContext();
  const analysis = evaluate(context, `equipmentLogisticsPairAnalysis(
    { id: "a", setupAt: "2026-09-18T08:00", date: "2026-09-18", equipmentInAt: "2026-09-19T01:00" },
    { id: "b", setupAt: "2026-09-19T08:00", date: "2026-09-19", equipmentInAt: "2026-09-20T01:00" }
  )`);
  assert.equal(analysis.sameDayTurnaround, true);
  assert.equal(analysis.rentApplies, false);
});

test("a short turnaround across midnight still triggers the automatic logistics decision", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    equipmentState.events = [
      { id: "a", active: true, setupAt: "2026-09-18T08:00", date: "2026-09-18", equipmentInAt: "2026-09-18T23:30" },
      { id: "b", active: true, setupAt: "2026-09-19T00:30", date: "2026-09-19", equipmentInAt: "2026-09-20T01:00" }
    ];
    const pair = equipmentAutomaticLogisticsPair("b");
    return {
      from: pair?.from?.id || "",
      to: pair?.to?.id || "",
      tight: Boolean(pair?.tight),
      sameDay: Boolean(pair?.sameDayTurnaround)
    };
  })()`);
  assert.equal(result.from, "a");
  assert.equal(result.to, "b");
  assert.equal(result.tight, true);
  assert.equal(result.sameDay, false);
});

test("configured transfer pair is recognized without asking the decision again", () => {
  const context = createEquipmentContext();
  const result = evaluate(context, `(() => {
    const events = [
      { id: "a", active: true },
      { id: "b", active: true },
      { id: "c", active: true }
    ];
    equipmentState.events = events;
    equipmentState.summaryTransferEnabled = true;
    equipmentState.summaryTransferRoutes = [
      createEquipmentSummaryTransferRoute(["a", "b"], "route-1"),
      createEquipmentSummaryTransferRoute(["a", "c"], "route-2")
    ];
    return {
      first: equipmentPairHasConfiguredTransfer(events[0], events[1], events),
      second: equipmentPairHasConfiguredTransfer(events[0], events[2], events),
      unrelated: equipmentPairHasConfiguredTransfer(events[1], events[2], events),
      routeCount: equipmentSummaryTransferRoutesWithEvents(events, true).length
    };
  })()`);
  assert.equal(result.first, true);
  assert.equal(result.second, true);
  assert.equal(result.unrelated, false);
  assert.equal(result.routeCount, 2);
});

// Regression fixtures are synthetic and never enter the service or stock catalog.
function createTransferRegressionContext() {
  const context = createEquipmentContext();
  evaluate(context, `
    equipmentState.events = [
      { id: "a", active: true, place: "Origen A", name: "Prueba A",
        serviceName: "SUNDAY FUNDAY - BATERIA ACUSTICA OPCION A",
        serviceIds: [], setupAt: "2026-09-25T07:00", date: "2026-09-25", equipmentInAt: "2026-09-26T02:00",
        sections: [
          { title: "BACKLINE INSTRUMENTOS / Teclado", items: [[1, "Teclado de prueba"], [1, "Bombo acústico de prueba"], [0, "Fila cero"]] },
          { title: "Audio", items: [[4, "Monitor de prueba"]] },
          { title: "Consumibles", items: [[6, "Pila de prueba consumible"]] }
        ] },
      { id: "b", active: true, place: "Destino B", name: "Prueba B",
        serviceName: "SUNDAY FUNDAY - BATERIA ELECTRICA OPCION A",
        serviceIds: [], setupAt: "2026-09-26T07:00", date: "2026-09-26", equipmentInAt: "2026-09-27T02:00",
        sections: [
          { title: "BACKLINE INSTRUMENTOS / Teclado", items: [[1, "Teclado de prueba"], [1, "Batería eléctrica de prueba"]] },
          { title: "Audio", items: [[2, "Monitor de prueba"]] },
          { title: "Consumibles", items: [[4, "Pila de prueba consumible"]] }
        ] }
    ];
    equipmentState.inventory = new Map([["teclado de prueba", 1], ["monitor de prueba", 4]]);
    equipmentState.summaryTransferEnabled = true;
    equipmentState.summaryTransferRoutes = [createEquipmentSummaryTransferRoute(["a", "b"], "ruta-1")];
    equipmentState.activeSummaryTransferRouteId = "ruta-1";
  `);
  return context;
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("new two-event route preselects exact shared non-consumable equipment", () => {
  const context = createTransferRegressionContext();
  const items = plain(evaluate(context, `equipmentTransferPlanData().routes[0].items.map(({ description, quantity }) => ({ description, quantity }))`));
  assert.deepEqual(items, [
    { description: "Teclado de prueba", quantity: 1 },
    { description: "Monitor de prueba", quantity: 2 }
  ]);
});

test("summary action says TRASIEGO even when the peak quantity does not change", () => {
  const context = createTransferRegressionContext();
  const result = evaluate(context, `(() => {
    const rows = equipmentRowsSummary();
    const row = rows.find((item) => item.description === "Teclado de prueba");
    return { applied: row.transferApplied, quantity: row.quantity, html: tableForEquipmentInventory([row], false) };
  })()`);
  assert.equal(result.applied, true);
  assert.equal(result.quantity, 1);
  assert.match(result.html, /equipment-action-transfer">TRASIEGO<\/td>/);
  assert.match(result.html, /equipment-transfer-summary-row/);
});

test("explicit uncheck removes item from summary and PDF and stays removed after redraw", () => {
  const context = createTransferRegressionContext();
  const result = evaluate(context, `(() => {
    equipmentTransferPlanData();
    const [from, to] = equipmentState.events;
    const route = equipmentState.summaryTransferRoutes[0];
    equipmentSetTransferLegSelections(route, from, to, [{ identity: "monitor de prueba", quantity: 2 }]);
    equipmentRowsSummary(); equipmentTransferPlanData();
    const row = equipmentRowsSummary().find((item) => item.description === "Teclado de prueba");
    const plan = equipmentTransferPlanData();
    return { applied: row.transferApplied, html: equipmentTransferItemsTable(plan.routes[0].items, to) };
  })()`);
  assert.equal(result.applied, false);
  assert.doesNotMatch(result.html, /Teclado de prueba/);
  assert.match(result.html, /Monitor de prueba/);
});

test("unchecking every item keeps an intentional empty list and disables transfer PDF", () => {
  const context = createTransferRegressionContext();
  const result = evaluate(context, `(() => {
    equipmentTransferPlanData();
    equipmentSetTransferLegSelections(equipmentState.summaryTransferRoutes[0], ...equipmentState.events, []);
    equipmentRowsSummary(); equipmentRowsSummary();
    return equipmentConfiguredTransferRoutesWithItems().length;
  })()`);
  assert.equal(result, 0);
});

test("backline-only uses source sections, excludes audio and preserves choices on No", () => {
  const context = createTransferRegressionContext();
  const result = plain(evaluate(context, `(() => {
    equipmentTransferPlanData();
    const route = equipmentState.summaryTransferRoutes[0];
    route.legOptions = { "a::b": { backlineOnly: true } };
    const only = equipmentTransferPlanData().routes[0].items.map((item) => item.description);
    const audio = equipmentRowsSummary().find((row) => row.description === "Monitor de prueba").transferApplied;
    route.legOptions["a::b"].backlineOnly = false;
    const all = equipmentTransferPlanData().routes[0].items.map((item) => item.description);
    return { only, audio, all };
  })()`));
  assert.deepEqual(result.only, ["Teclado de prueba"]);
  assert.equal(result.audio, false);
  assert.deepEqual(result.all, ["Teclado de prueba", "Monitor de prueba"]);
});

test("Sunday Funday option is available for all current variants, not other services", () => {
  const context = createEquipmentContext();
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment-catalog.js"), "utf8"), context);
  const result = plain(evaluate(context, `(() => {
    const services = Object.values(window.requerimientoEquipoCatalog.services).filter((item) => /sunday\\s+funday/i.test(item.name));
    return { count: services.length,
      all: services.every((item) => equipmentEventIsSundayFunday({ serviceName: item.name })),
      other: equipmentEventIsSundayFunday({ serviceName: "DJ Privado", serviceIds: ["dj-privado"] }) };
  })()`));
  assert.ok(result.count >= 9);
  assert.equal(result.all, true);
  assert.equal(result.other, false);
});

test("purchase report contains only COMPRA; rent report contains only RENTA", () => {
  const context = createTransferRegressionContext();
  const result = plain(evaluate(context, `({
    purchase: equipmentProcurementReportRows("purchase").map((row) => ({ description: row.description, missing: row.missing, action: row.action })),
    rental: equipmentProcurementReportRows("rent").map((row) => row.action),
    filename: equipmentPdfFileName("purchase")
  })`));
  assert.deepEqual(result.purchase, [{ description: "Pila de prueba consumible", missing: 10, action: "COMPRA" }]);
  assert.ok(result.rental.length > 0);
  assert.ok(result.rental.every((action) => action === "RENTA"));
  assert.match(result.filename, /^Informe de compra.*\.pdf$/);
});

test("editor has checked boxes and route-specific controls in the transfer tab", () => {
  const context = createTransferRegressionContext();
  const html = evaluate(context, `(() => {
    const plan = equipmentTransferPlanData();
    const leg = plan.routes[0];
    return equipmentTransferLegEditorHtml(leg.route, leg.from, leg.to, 0, plan.comparisonRows);
  })()`);
  assert.equal((html.match(/data-equipment-transfer-toggle-item/g) || []).length, 2);
  assert.match(html, /data-route-id="ruta-1"/);
  assert.match(html, /data-equipment-transfer-backline-only/);
  assert.match(html, /type="checkbox"\s+checked/);
});

test("no double allocation of the same origin units across multiple transfer routes", () => {
  const context = createTransferRegressionContext();
  const result = evaluate(context, `(() => {
    equipmentState.events.push({ ...equipmentState.events[1], id: "c", place: "Destino C" });
    equipmentState.summaryTransferRoutes.push(createEquipmentSummaryTransferRoute(["a", "c"], "ruta-2"));
    return equipmentTransferPlanData().routes.reduce((sum, leg) => sum + (leg.items.find((item) => item.description === "Teclado de prueba")?.quantity || 0), 0);
  })()`);
  assert.equal(result, 1);
});

test("stale selected quantity is capped when an event requirement decreases", () => {
  const context = createTransferRegressionContext();
  const result = evaluate(context, `(() => {
    equipmentTransferPlanData();
    equipmentState.events[1].sections[1].items = [[1, "Monitor de prueba"]];
    return equipmentTransferPlanData().routes[0].items.find((item) => item.description === "Monitor de prueba").quantity;
  })()`);
  assert.equal(result, 1);
});

test("JSON round trip retains backline preference, all route events and empty selections", () => {
  const context = createTransferRegressionContext();
  const result = plain(evaluate(context, `(() => {
    equipmentTransferPlanData();
    const route = equipmentState.summaryTransferRoutes[0];
    route.legOptions = { "a::b": { backlineOnly: true } };
    equipmentSetTransferLegSelections(route, ...equipmentState.events, []);
    const payload = equipmentEditablePayload("full");
    importEquipmentEditablePayload(JSON.parse(JSON.stringify(payload)));
    const restored = equipmentState.summaryTransferRoutes[0];
    return { eventCount: equipmentState.events.length,
      selected: Object.values(restored.legSelections),
      options: Object.values(restored.legOptions),
      transferCount: equipmentConfiguredTransferRoutesWithItems().length };
  })()`));
  assert.equal(result.eventCount, 2);
  assert.deepEqual(result.selected, [[]]);
  assert.deepEqual(result.options, [{ backlineOnly: true }]);
  assert.equal(result.transferCount, 0);
});


test("all current Sunday variants build nonempty synchronized plans using the unchanged current catalogs", () => {
  const context = createEquipmentContext(true);
  const results = plain(evaluate(context, `(() => {
    const ids = Object.keys(equipmentServices).filter((id) => /sunday\\s+funday/i.test(equipmentServices[id].name));
    return ids.map((serviceId) => {
      const snapshot = captureEquipmentEventSnapshotForServiceIds([serviceId]);
      equipmentState.events = [
        { ...snapshot, id: "a", active: true, place: "A", date: "2026-09-25", setupAt: "2026-09-25T07:00", equipmentInAt: "2026-09-26T02:00" },
        { ...snapshot, id: "b", active: true, place: "B", date: "2026-09-26", setupAt: "2026-09-26T07:00", equipmentInAt: "2026-09-27T02:00" }
      ];
      equipmentState.summaryTransferEnabled = true;
      const route = createEquipmentSummaryTransferRoute(["a", "b"], "actual-catalog-test");
      equipmentState.summaryTransferRoutes = [route];
      const all = equipmentTransferPlanData().routes[0].items;
      const summary = equipmentRowsSummary().filter((row) => row.transferApplied);
      route.legOptions = { "a::b": { backlineOnly: true } };
      const backline = equipmentTransferPlanData().routes[0].items;
      const allowed = equipmentEventBacklineQuantities(equipmentState.events[0]);
      return { serviceId, count: all.length, summaryCount: summary.length,
        onlyBackline: backline.every((item) => allowed.has(item.identity)), backlineCount: backline.length,
        noConsumables: all.every((item) => !equipmentRowIsConsumable(item)) };
    });
  })()`));
  assert.ok(results.length >= 9);
  results.forEach((result) => {
    assert.ok(result.count > 0, result.serviceId);
    assert.ok(result.summaryCount > 0, result.serviceId);
    assert.equal(result.onlyBackline, true, result.serviceId);
    assert.equal(result.noConsumables, true, result.serviceId);
  });
});
