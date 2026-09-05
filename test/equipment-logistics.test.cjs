const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createEquipmentContext() {
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

test("logistics decision names both event dates and exact operational times", () => {
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
  assert.equal(message.title, "Tiempo ajustado para trasegar");
});
