"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Draft = require("../equipment-draft-logistics.js");
const Engine = require("../equipment-event-store.cjs");
const now = Date.parse("2026-11-23T12:00:00Z");
const estimates = [{ fromPlace: "Sede sintética", toPlace: "Sede sintética", travelMinutes: 0, handlingMinutes: 120 }];
function inventory(quantity = 3, movements = [], itemType = "equipo") {
  return { savedAt: "synthetic-current", state: { items: [{ id: "synthetic-unit", name: "Unidad sintética", category: "Pruebas", quantity, itemType }], movements } };
}
function event(id, quantity = 3, hour = 8, extra = {}) {
  const at = (value) => `2026-11-25T${String(value).padStart(2, "0")}:00`;
  return { id, name: `Prueba ${id}`, place: "Sede sintética", status: "confirmed", setupAt: at(hour), startAt: at(hour), endAt: at(hour + 1), equipmentInAt: "2026-11-26T12:00",
    warehouseDispatchId: `dispatch-${id}`, sections: [{ id: `section-${id}`, title: "Pruebas", notes: ["  Nota literal á  "], rows: [{ type: "header", description: "ENCABEZADO" }],
      items: [{ id: `line-${id}`, description: "Unidad sintética", warehouseInventoryId: "synthetic-unit", quantity, sourceCells: [{ ref: "B3", value: String(quantity) }] }] }], ...extra };
}
function analyze(events, stock = inventory(), options = {}) { return Draft.analyze(events, stock, { now, ...options }); }
function row(result) { return result.rows.find((entry) => entry.warehouseInventoryId === "synthetic-unit"); }
function allIds(result) { return result.candidates.map((candidate) => candidate.id); }

test("sin selección la demanda conserva su faltante y las rutas siguen siendo propuestas", () => {
  const result = analyze([event("a"), event("b", 3, 12), event("c", 3, 16)], inventory(), { routeEstimates: estimates });
  assert.equal(row(result).demand, 9); assert.equal(row(result).baselineRequired, 9); assert.equal(row(result).required, 9);
  assert.equal(row(result).rental, 6); assert.equal(result.candidates.length, 2); assert.equal(result.selectedTransfers.length, 0);
  assert.ok(result.candidates.every((candidate) => candidate.status === "ready" && !candidate.selected));
});

test("A → B → C usa las mismas tres unidades propias una vez y elimina sólo la renta que cubren", () => {
  const events = [event("a"), event("b", 3, 12), event("c", 3, 16)];
  const baseline = analyze(events, inventory(), { routeEstimates: estimates });
  const result = analyze(events, inventory(), { routeEstimates: estimates, selectedTransferIds: allIds(baseline), expectedSnapshotId: baseline.snapshotId });
  assert.equal(row(result).required, 3); assert.equal(row(result).rental, 0); assert.equal(row(result).selectedTransferReduction, 6);
  assert.equal(result.selectedTransfers.length, 2); assert.equal(result.rental.length, 0); assert.equal(result.productionMutations, 0);
  assert.deepEqual(result.actualTransfers, []); assert.equal(result.invalidSelections.length, 0);
});

test("desmarcar una pierna recalcula la renta sin usar una ruta alternativa invisible", () => {
  const events = [event("a"), event("b", 3, 12), event("c", 3, 16)];
  const first = analyze(events, inventory(), { routeEstimates: estimates }); const ids = allIds(first);
  for (const keep of [ids.slice(0, 1), ids.slice(1)]) {
    const partial = analyze(events, inventory(), { routeEstimates: estimates, selectedTransferIds: keep });
    assert.equal(row(partial).required, 6); assert.equal(row(partial).rental, 3); assert.equal(partial.selectedTransfers.length, 1);
  }
  assert.equal(row(analyze(events, inventory(), { routeEstimates: estimates, selectedTransferIds: [] })).rental, 6);
});

test("una unidad de origen no abastece dos destinos simultáneos y el faltante restante sí se renta", () => {
  const events = [event("a", 3), event("b", 3, 12), event("c", 2, 12)];
  const proposed = analyze(events, inventory(), { routeEstimates: estimates });
  assert.ok(proposed.candidates.filter((route) => route.fromEventId === "a").reduce((sum, route) => sum + route.quantity, 0) <= 3);
  const result = analyze(events, inventory(), { routeEstimates: estimates, selectedTransferIds: allIds(proposed) });
  assert.equal(row(result).required, 5); assert.equal(row(result).rental, 2);
});

test("los estimados sin revisión se muestran pero seleccionarlos no reduce la renta", () => {
  const events = [event("a"), event("b", 3, 12)]; const proposed = analyze(events);
  assert.equal(proposed.candidates[0].status, "review"); assert.equal(proposed.candidates[0].requiresManualReview, true);
  const attempted = analyze(events, inventory(), { selectedTransferIds: allIds(proposed) });
  assert.equal(attempted.selectedTransfers.length, 0); assert.equal(attempted.invalidSelections[0].code, "time_review_required");
  assert.equal(row(attempted).pending, true); assert.equal(row(attempted).required, null); assert.equal(row(attempted).rental, null);
  const reviewed = analyze(events, inventory(), { routeEstimates: estimates, selectedTransferIds: allIds(proposed) });
  assert.equal(reviewed.candidates[0].id, proposed.candidates[0].id); assert.equal(row(reviewed).rental, 0);
});

test("las rutas usan origen y destino dirigidos, con transporte y preparación comprobables", () => {
  const events = [event("a", 3, 8, { place: "Sede A" }), event("b", 3, 12, { place: "Sede B" })];
  const manual = [{ fromPlace: "sede a", toPlace: "SEDE B", travelMinutes: 120, handlingMinutes: 30 }];
  const result = analyze(events, inventory(), { routeEstimates: manual }); const candidate = result.candidates[0];
  assert.equal(candidate.travelSource, "user"); assert.equal(candidate.requiredMinutes, 150); assert.equal(candidate.slackMinutes, 30);
  assert.equal(candidate.releaseAt, events[0].endAt); assert.equal(candidate.arriveAt, candidate.arrivalAt);
  const tooLate = analyze(events, inventory(), { routeEstimates: [{ ...manual[0], travelMinutes: 181 }] });
  assert.equal(tooLate.candidates.length, 0);
});

test("un cambio de inventario invalida la selección anterior en lugar de mantener una falsa cobertura", () => {
  const events = [event("a"), event("b", 3, 12)]; const old = analyze(events, inventory(), { routeEstimates: estimates });
  const changed = analyze(events, inventory(2), { routeEstimates: estimates, selectedTransferIds: allIds(old), expectedSnapshotId: old.snapshotId });
  assert.equal(changed.staleSelection, true); assert.equal(changed.selectedTransfers.length, 0); assert.equal(changed.invalidSelections[0].code, "stale_snapshot");
  assert.equal(row(changed).pending, true); assert.equal(row(changed).rental, null);
});

test("IDs desconocidos o duplicados no inyectan cantidades ni movimientos", () => {
  const events = [event("a"), event("b", 3, 12)]; const proposed = analyze(events, inventory(), { routeEstimates: estimates });
  assert.throws(() => analyze(events, inventory(), { selectedTransferIds: ["ruta-arbitraria"] }), { statusCode: 400 });
  assert.throws(() => analyze(events, inventory(), { selectedTransferIds: [proposed.candidates[0].id, proposed.candidates[0].id] }), { statusCode: 400 });
  const result = analyze(events, inventory(), { selectedTransferIds: ["draft-transfer-00000000000000000000000000000000"] });
  assert.equal(result.invalidSelections[0].code, "proposal_unavailable"); assert.equal(result.selectedTransfers.length, 0); assert.equal(row(result).pending, true);
});

test("taller, pérdida y renta de salida reducen las unidades propias antes de proponer rutas", () => {
  const movements = ["taller", "perdido", "renta"].map((type) => ({ itemId: "synthetic-unit", type, quantity: 1 }));
  const stock = inventory(5, movements); const events = [event("a", 5), event("b", 5, 12)];
  const proposed = analyze(events, stock, { routeEstimates: estimates });
  assert.equal(row(proposed).capacity, 2); assert.equal(proposed.candidates[0].quantity, 2);
  const result = analyze(events, stock, { routeEstimates: estimates, selectedTransferIds: allIds(proposed) });
  assert.equal(row(result).required, 8); assert.equal(row(result).rental, 6);
});

test("consumibles suman todos los eventos y nunca producen trasiegos", () => {
  const result = analyze([event("a", 5), event("b", 4, 12)], inventory(5, [], "consumible"), { routeEstimates: estimates });
  assert.equal(row(result).demand, 9); assert.equal(row(result).remainingConsumption, 9); assert.equal(row(result).alreadyConsumed, 0);
  assert.equal(row(result).purchase, 4); assert.equal(row(result).rental, 0); assert.equal(result.candidates.length, 0);
});

test("los consumos registrados del evento se descuentan una sola vez de la demanda y del stock neto", () => {
  const a = event("a", 5); const events = [a, event("b", 4, 12)];
  const stock = inventory(8, [{ itemId: "synthetic-unit", type: "consumo", quantity: 3, sourceDocumentId: a.warehouseDispatchId }], "consumible");
  const result = analyze(events, stock); const item = row(result);
  assert.equal(item.available, 5); assert.equal(item.remainingConsumption, 6); assert.equal(item.alreadyConsumed, 3); assert.equal(item.purchase, 1);
  assert.equal(item.required, 6); assert.equal(item.shortage, 1);
});

test("un consumo de otro documento reduce stock pero no descuenta demanda de estos eventos", () => {
  const stock = inventory(10, [{ itemId: "synthetic-unit", type: "consumo", quantity: 4, sourceDocumentId: "unrelated" }], "consumible");
  const result = analyze([event("a", 5), event("b", 4, 12)], stock);
  assert.equal(row(result).remainingConsumption, 9); assert.equal(row(result).alreadyConsumed, 0); assert.equal(row(result).purchase, 3);
});

test("dos eventos no pueden reutilizar el mismo documento para duplicar el crédito de consumo o salida", () => {
  const first = event("a"); const second = event("b", 3, 12, { warehouseDispatchId: first.warehouseDispatchId });
  assert.throws(() => analyze([first, second], inventory(8, [], "consumible")), { statusCode: 400 });
  assert.throws(() => analyze([first, { ...second, id: "a", warehouseDispatchId: "other" }]), { statusCode: 400 });
});

test("sin horarios el faltante reutilizable queda pendiente y los consumibles mantienen su suma", () => {
  const first = event("a"); delete first.endAt;
  const reusable = analyze([first, event("b", 2, 12)]);
  assert.equal(row(reusable).demand, 5); assert.equal(row(reusable).required, 5); assert.equal(row(reusable).rental, 2);
  assert.equal(row(reusable).rentalProvisional, true); assert.equal(row(reusable).pending, true); assert.equal(reusable.candidates.length, 0);
  const consumable = analyze([first, event("b", 2, 12)], inventory(3, [], "consumible"));
  assert.equal(row(consumable).purchase, 2); assert.equal(row(consumable).remainingConsumption, 5);
});

test("fechas inválidas permanecen literales y nunca generan rutas inventadas", () => {
  const first = event("a", 3, 8, { endAt: "2026-02-30T10:00" });
  const result = analyze([first, event("b", 3, 12)]);
  assert.equal(result.events[0].endAt, "2026-02-30T10:00"); assert.equal(result.candidates.length, 0); assert.equal(row(result).rental, 3); assert.equal(row(result).rentalProvisional, true);
});

test("montaje no aplicable usa el inicio real sin inventar un montaje", () => {
  const first = event("a", 3, 8, { setupApplies: false, setupAt: "" });
  const result = analyze([first, event("b", 3, 12)], inventory(), { routeEstimates: estimates });
  assert.equal(row(result).pending, false); assert.equal(result.candidates.length, 1);
});

test("identidad ambigua o un ID con descripción distinta no se convierte en stock cero", () => {
  const first = event("a"); first.sections[0].items[0].description = "Unidad sintética diferente";
  const result = analyze([first]); const item = result.rows[0];
  assert.equal(item.pending, true); assert.equal(item.available, null); assert.equal(item.capacity, null); assert.equal(item.rental, null); assert.equal(result.candidates.length, 0);
});

test("clasificación pendiente mantiene diagnóstico y bloquea pedidos automáticos", () => {
  const stock = inventory(); stock.state.items[0].name = "Consola sintética"; stock.state.items[0].itemType = "consumible";
  const first = event("a"); first.sections[0].items[0].description = "Consola sintética";
  const result = analyze([first], stock); const item = row(result);
  assert.equal(item.pendingClassification, true); assert.equal(item.pending, true); assert.equal(item.purchase, null); assert.equal(item.action, "REVISAR CLASIFICACIÓN");
});

test("compras explícitas mantienen su decisión sin necesidad de inventar horarios", () => {
  const first = event("a", 4, 8, { setupAt: "", startAt: "", endAt: "", equipmentInAt: "" });
  first.sections[0].items[0].procurementChoice = "purchase";
  const result = analyze([first]);
  assert.equal(result.rows[0].purchase, 4); assert.equal(result.rows[0].pending, false); assert.equal(result.candidates.length, 0);
});

test("fuentes, ceros, notas y las estructuras de entrada permanecen intactas", () => {
  const first = event("a", 0); first.source = { rows: [{ kind: "item", cells: ["0", " Unidad sintética ", "Nota"] }, { kind: "note", cells: ["OTRA NOTA"] }] };
  const stock = inventory(); const beforeEvent = JSON.stringify(first); const beforeStock = JSON.stringify(stock);
  const result = analyze([first], stock);
  assert.equal(JSON.stringify(first), beforeEvent); assert.equal(JSON.stringify(stock), beforeStock);
  assert.deepEqual(result.events[0], first); assert.equal(result.rows[0].demand, 0); assert.equal(result.rows[0].required, 0);
  assert.equal(result.rows[0].action, "SIN USO (0)"); assert.equal(result.candidates.length, 0);
});

test("la reutilización normal de bodega se distingue de la reducción por trasiegos elegidos", () => {
  const first = event("a", 3, 8, { equipmentInAt: "2026-11-25T10:00" }); const second = event("b", 3, 12);
  const result = analyze([first, second], inventory(), { routeEstimates: estimates }); const item = row(result);
  assert.equal(item.demand, 6); assert.equal(item.baselineRequired, 3); assert.equal(item.required, 3);
  assert.equal(item.warehouseReuseReduction, 3); assert.equal(item.selectedTransferReduction, 0); assert.equal(item.totalReuseReduction, 3); assert.equal(item.rental, 0);
});

test("un trasiego físico real se respeta y nunca se apaga como si fuera una propuesta", () => {
  const events = [event("a"), event("b", 3, 12)];
  const actual = { id: "actual-route", fromEventId: "a", toEventId: "b", items: [{ warehouseInventoryId: "synthetic-unit", quantity: 3 }], travelMinutes: 0, handlingMinutes: 120, status: "confirmed" };
  const result = analyze(events, inventory(), { transfers: [actual], selectedTransferIds: [] });
  assert.equal(row(result).required, 3); assert.equal(row(result).rental, 0); assert.equal(result.actualTransfers.length, 1);
  assert.equal(result.selectedTransfers.length, 0); assert.equal(result.candidates.length, 0);
});

test("UMD no exige Node en el navegador y mantiene el cálculo del lado del servidor", () => {
  const context = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(require.resolve("../equipment-draft-logistics.js"), "utf8"), context);
  assert.equal(typeof context.EquipmentDraftLogistics.routeId, "function");
  const route = { warehouseInventoryId: "physical", fromEventId: "a", toEventId: "b", quantity: 1, departureAt: "2026-11-25T10:00", setupAt: "2026-11-25T14:00", travelMinutes: 60, handlingMinutes: 120 };
  assert.equal(context.EquipmentDraftLogistics.routeId(route), Draft.routeId(route));
  assert.throws(() => context.EquipmentDraftLogistics.analyze([], inventory()), (error) => error.statusCode === 503);
});

test("create inyecta el mismo motor exacto sin duplicar el inventario ni las rutas", () => {
  let calls = 0;
  const adapter = Draft.create({ ...Engine, calculateAvailability(...args) { calls += 1; return Engine.calculateEquipmentAvailability(...args); } });
  const result = adapter.analyze([event("a"), event("b", 3, 12)], inventory(), { now, routeEstimates: estimates });
  assert.equal(calls, 1); assert.equal(row(result).rental, 3);
});

test("una advertencia de custodia validada por servidor bloquea los mismos importes en todos los formatos", () => {
  const events = [event("a"), event("b", 3, 12)];
  const result = analyze(events, inventory(), { routeEstimates: estimates, inventoryBlockReasons: [{ warehouseInventoryId: "synthetic-unit", reason: "La custodia registrada no coincide con los eventos seleccionados." }] });
  assert.equal(result.candidates.length, 0); assert.equal(row(result).hardBlocked, true); assert.equal(row(result).required, null); assert.equal(row(result).rental, null);
  assert.ok(row(result).reasons[0].includes("custodia"));
  const global = analyze(events, inventory(), { globalInventoryBlockReason: "El historial físico está incompleto." });
  assert.equal(global.rows[0].hardBlocked, true); assert.equal(global.candidates.length, 0);
});
