"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Draft = require("../equipment-draft-logistics.js");
const View = require("../equipment-transfer-presentation.js");
const Reporting = require("../equipment-reporting.cjs");
const copy = value => JSON.parse(JSON.stringify(value));
const now = Date.parse("2026-11-25T12:00Z");
function fixture() {
  const inventory = { savedAt: "fuente-sintética-vigente", state: { movements: [], items: [
    { id: "a", name: "Unidad A", quantity: 5, itemType: "equipo" },
    { id: "b", name: "Unidad B", quantity: 5, itemType: "equipo" },
    { id: "c", name: "Unidad C", quantity: 5, itemType: "equipo" },
    { id: "supply", name: "Cinta <consumible>", quantity: 5, itemType: "consumible" },
    { id: "similar", name: "Unidad A", quantity: 5, itemType: "equipo" }
  ] } };
  const event = (id, day, quantities) => ({ id, name: `Evento ${id}`, place: `Sede ${id}`, date: `2026-11-${day}`,
    setupAt: `2026-11-${day}T08:00`, startAt: `2026-11-${day}T12:00`, endAt: `2026-11-${day}T20:00`, equipmentInAt: "2026-11-30T12:00",
    sourceCells: [{ ref: "A1", sheet: id, value: 0 }, { ref: "B1", sheet: id, value: "Nota original" }],
    sections: [{ title: "Categoría actual", rows: [{ type: "note", description: "Nota literal" }], items: Object.entries(quantities).map(([id, quantity]) => ({ quantity,
      description: inventory.state.items.find(item => item.id === id)?.name || 'Requerimiento <desconocido> "literal"', ...(id === "unknown" ? {} : { warehouseInventoryId: id }) })) }] });
  const events = [event("origen", 26, { a: 2, b: 1 }), event("destino", 27, { a: 3, b: 0, c: 2, supply: 3, unknown: 4 })];
  return { events, inventory, event };
}
const estimates = events => events.flatMap(from => events.filter(to => to.id !== from.id).map(to => ({ fromPlace: from.place, toPlace: to.place, travelMinutes: 30, handlingMinutes: 30, distanceKm: 10 })));
const analyze = (input, extra = {}) => Draft.analyze(input.events, input.inventory, { now, routeEstimates: estimates(input.events), ...extra });
function selection(input, quantity) {
  const preview = analyze(input), candidate = preview.candidates.find(route => route.fromEventId === "origen" && route.toEventId === "destino" && route.warehouseInventoryId === "a");
  assert.ok(candidate);
  return { selectedTransferIds: [candidate.id], transferEdits: [{ id: candidate.id, quantity }] };
}
const additions = card => Object.fromEntries(card.additionalItems.map(item => [item.warehouseInventoryId || item.description, item.quantity]));

test("destino tres menos dos recibidas da una adicional; editar a una recibida da dos", () => {
  const input = fixture(), before = copy({ events: input.events, inventory: input.inventory });
  for (const [quantity, expected] of [[2, 1], [1, 2]]) {
    const plan = analyze(input, selection(input, quantity)), original = copy(plan), view = View.build(plan), card = view.cards[0];
    assert.equal(card.usedItems[0].quantity, quantity); assert.equal(additions(card).a, expected);
    assert.equal(additions(card).c, 2); assert.equal(additions(card).supply, 3);
    assert.equal(card.additionalItems.find(item => item.pendingIdentification).quantity, 4);
    assert.equal(card.additionalItems.some(item => item.warehouseInventoryId === "b"), false, "cero no se convierte en pedido adicional");
    assert.equal(card.additionalIsProvisional, false); assert.equal(card.additionalExplanation, "");
    assert.deepEqual(copy(plan), original);
  }
  assert.deepEqual({ events: input.events, inventory: input.inventory }, before);
});

test("dos orígenes aportan uno y dos a un destino de cinco y el saldo dos se presenta una sola vez", () => {
  const input = fixture(); input.events = [input.event("origen", 26, { a: 1 }), input.event("otro", 26, { a: 2 }), input.event("destino", 27, { a: 5 })];
  const preview = analyze(input), selectedTransferIds = preview.candidates.filter(route => route.toEventId === "destino").map(route => route.id);
  assert.equal(selectedTransferIds.length, 2);
  const plan = analyze(input, { selectedTransferIds }), before = copy(plan), cards = View.build(plan).cards;
  assert.equal(cards.length, 2); assert.equal(cards.reduce((total, card) => total + card.usedItems[0].quantity, 0), 3);
  assert.ok(cards.every(card => additions(card).a === 2));
  assert.deepEqual(cards.map(card => card.showAdditionalItems), [true, false]);
  assert.deepEqual(copy(plan), before);
});

test("la misma ruta confirmada presente en dos estructuras no acredita dos veces", () => {
  const input = fixture(), plan = analyze(input, selection(input, 1)), selected = plan.selectedTransfers[0], before = copy(plan);
  const reportingShape = { events: plan.events, rows: plan.rows, transferRoutes: [{ ...selected, agendaDecision: true }],
    draftLogistics: { ...plan, actualTransfers: [{ id: selected.id, fromEventId: selected.fromEventId, toEventId: selected.toEventId, status: "confirmed", items: [{ id: "identificador-de-línea", warehouseInventoryId: "a", quantity: 1 }] }] } };
  const view = View.build(reportingShape);
  assert.equal(view.cards.length, 1); assert.equal(view.cards[0].usedItems[0].quantity, 1); assert.equal(additions(view.cards[0]).a, 2);
  assert.deepEqual(copy(plan), before);
});

test("referencias físicas con el mismo nombre no cumplen la demanda de otra referencia", () => {
  const input = fixture(); input.events[1].sections[0].items.push({ warehouseInventoryId: "similar", description: "Unidad A", quantity: 2 });
  const card = View.build(analyze(input, selection(input, 2))).cards[0];
  assert.equal(additions(card).a, 1); assert.equal(additions(card).similar, 2);
});

test("recomendaciones y rutas sin viaje confirmado distinguen su saldo hipotético sin cambiar renta", () => {
  const input = fixture();
  for (const extra of [{}, { routeEstimates: [] }]) {
    const plan = analyze(input, extra), before = copy(plan), card = View.build(plan).cards[0];
    assert.ok(card); assert.ok(["recommended", "verify"].includes(card.status));
    assert.equal(additions(card).a, 1); assert.equal(card.additionalIsProvisional, true);
    assert.equal(card.additionalExplanation, "Adicional si se realiza el trasiego propuesto.");
    assert.equal(plan.selectedTransfers.length, 0); assert.deepEqual(copy(plan), before);
  }
});

test("plan.rows es la autoridad y no suma espejos, referencias ni líneas originales otra vez", () => {
  const input = fixture(), plan = analyze(input, selection(input, 2));
  plan.events[1].sections[0].items.push({ warehouseInventoryId: "a", description: "Unidad A", quantity: 900 });
  plan.events[1].sections[0].rows.push({ type: "item", quantity: 800, description: "Unidad A" });
  plan.events[1].sourceImport = { referenceTables: [{ sections: [{ items: [{ warehouseInventoryId: "a", description: "Unidad A", quantity: 700 }] }] }] };
  assert.equal(additions(View.build(plan).cards[0]).a, 1);
  const emptyAuthority = { ...plan, rows: [] };
  assert.deepEqual(View.build(emptyAuthority).cards[0].additionalItems, [], "una tabla de demanda vacía explícita no se rellena con otros datos");
});

test("fallback sin tabla analizada lee sólo items y conserva desconocidos separados y decimales", () => {
  const input = fixture(), plan = analyze(input, selection(input, 1));
  delete plan.rows;
  plan.events[1].sections[0].items = [[2.5, "Desconocido literal"], [0, "Cero original"], [1, "Desconocido literal"], [1e-10, "Cantidad pequeña válida"], { warehouseInventoryId: "a", description: "Unidad A", quantity: 2.5 }];
  plan.events[1].sections[0].rows.push({ type: "item", quantity: 999, description: "Desconocido literal" });
  const card = View.build(plan).cards[0], unknown = card.additionalItems.filter(item => !item.warehouseInventoryId);
  assert.deepEqual(unknown.map(item => item.quantity), [2.5, 1, 1e-10]);
  assert.equal(additions(card).a, 1.5); assert.equal(card.additionalItems.length, 4);
});

test("saltos o bloqueos descartados no restan llegada al completar otro trasiego válido", () => {
  const input = fixture(); input.events = [input.event("viejo", 25, { a: 2 }), ...input.events];
  const plan = analyze(input, selection(input, 1));
  const valid = plan.selectedTransfers[0];
  plan.selectedTransfers.push({ ...valid, id: "ruta-salto-sintética", fromEventId: "viejo", quantity: 2 });
  const cards = View.build(plan).cards;
  assert.equal(cards.length, 1); assert.equal(additions(cards[0]).a, 2);
});

test("consumible, identidad pendiente, compra preferida y decisión externa no reciben crédito reutilizable", () => {
  const input = fixture(), original = analyze(input, selection(input, 2));
  for (const patch of [{ itemType: "consumible" }, { preferredPurchase: true }, { procurementChoice: "purchase" }, { procurementChoice: "rent" }, { pendingIdentification: true }, { pendingClassification: true }]) {
    const plan = copy(original), row = plan.rows.find(row => row.warehouseInventoryId === "a");
    Object.assign(row, patch);
    const card = View.build(plan).cards[0];
    assert.equal(additions(card).a, 3, JSON.stringify(patch));
  }
});

test("HTML breve añade el saldo exacto y escapa consumibles y desconocidos; el máster conserva fuente e inventario", async () => {
  const input = fixture(), options = selection(input, 1), before = copy({ events: input.events, inventory: input.inventory });
  const model = Reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates: estimates(input.events), ...options }, input.inventory, { now });
  const modelBefore = copy(model), markup = Reporting.renderEquipmentPlanningReportHtml(model, "transfer");
  const extra = markup.match(/<h3>Equipo adicional para completar el evento<\/h3>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(extra); assert.match(extra, /<td class="number">2<\/td><td>Unidad A/);
  assert.match(extra, /Cinta &lt;consumible&gt;/); assert.match(extra, /Requerimiento &lt;desconocido&gt; &quot;literal&quot;/);
  assert.doesNotMatch(extra, /<desconocido>|<consumible>|Resumen final|Renta/);
  assert.deepEqual(copy(model), modelBefore);
  const fullTransfer = Reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates: estimates(input.events), ...selection(input, 2) }, input.inventory, { now });
  const fullMarkup = Reporting.renderEquipmentPlanningReportHtml(fullTransfer, "transfer");
  const fullExtra = fullMarkup.match(/<h3>Equipo adicional para completar el evento<\/h3>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(fullExtra); assert.match(fullExtra, /<td class="number">1<\/td><td>Unidad A/);
  const workbook = await Reporting.createEquipmentMasterWorkbook(model);
  assert.equal(workbook.getWorksheet("Celdas fuente").rowCount - 4, 4);
  assert.equal(model.counts.zeroQuantityRows, 1); assert.equal(model.originalEvents[1].sections[0].items[1].quantity, 0);
  assert.deepEqual({ events: input.events, inventory: input.inventory }, before); assert.equal(model.productionMutations, 0);
});

test("HTML de dos llegadas imprime un solo cuadro adicional para el mismo destino", () => {
  const input = fixture(); input.events = [input.event("origen", 26, { a: 1 }), input.event("otro", 26, { a: 2 }), input.event("destino", 27, { a: 5 })];
  const preview = analyze(input), selectedTransferIds = preview.candidates.filter(route => route.toEventId === "destino").map(route => route.id);
  const model = Reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates: estimates(input.events), selectedTransferIds }, input.inventory, { now });
  const markup = Reporting.renderEquipmentPlanningReportHtml(model, "transfer");
  assert.equal((markup.match(/class="transfer-card"/g) || []).length, 2);
  assert.equal((markup.match(/<h3>Equipo adicional para completar el evento<\/h3>/g) || []).length, 1);
  assert.match(markup, /<td class="number">2<\/td><td>Unidad A/);
});
