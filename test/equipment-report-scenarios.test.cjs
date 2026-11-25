const assert = require("node:assert/strict");
const test = require("node:test");
const reporting = require("../equipment-reporting.cjs");

// Every stock item, quantity and location here is a synthetic current input.
function fixture(stockQuantity = 3) {
  const name = "Unidad sintética de audio";
  const inventory = { savedAt: "2026-11-23T12:00:00.000Z", state: { datasetId: "synthetic-current-scenarios", items: [
    { id: "scenario-audio", name, category: "Audio vigente", itemType: "equipo", quantity: stockQuantity }
  ], movements: [] } };
  const makeEvent = (id, quantity, schedule) => {
    const cells = [
      { ref: `${id}!A1`, address: "A1", sheet: id, value: quantity },
      { ref: `${id}!B1`, address: "B1", sheet: id, value: name }
    ];
    const item = { quantity, description: name, warehouseInventoryId: "scenario-audio", inventoryCategory: "Categoría original", sourceRefs: cells.map(cell => cell.ref) };
    return { id, status: "draft", client: `Cliente ${id}`, name: `Cliente ${id}`, place: `Lugar ${id}`, date: schedule.startAt.slice(0, 10), ...schedule,
      sourceCells: cells, sourceImport: { sourceEventId: id, metadata: { client: `Cliente ${id}` } },
      sections: [{ title: "Categoría original", items: [item], rows: [{ type: "item", sourceItemIndex: 0, quantity, description: name, sourceRefs: item.sourceRefs, cells }] }] };
  };
  const events = [
    makeEvent("scenario-origin", 3, { setupAt: "2026-11-25T08:00", startAt: "2026-11-25T12:00", endAt: "2026-11-25T20:00", equipmentInAt: "2026-11-28T10:00" }),
    makeEvent("scenario-destination", 2, { setupAt: "2026-11-26T08:00", startAt: "2026-11-26T12:00", endAt: "2026-11-26T20:00", equipmentInAt: "2026-11-27T10:00" })
  ];
  return { name, inventory, events, makeEvent };
}
const build = (events, inventory, extra = {}) => {
  const routeEstimates = extra.routeEstimates || events.flatMap((event, index) => events.slice(index + 1).map(destination => ({ fromPlace: event.place, toPlace: destination.place, travelMinutes: 60, handlingMinutes: 120 })));
  const preview = reporting.createEquipmentReportModel({ events, ...extra, routeEstimates }, inventory);
  const selectedTransferIds = preview.draftLogistics.candidates.filter(candidate => candidate.status === "ready").map(candidate => candidate.id);
  return reporting.createEquipmentPlanningReportModel({ events, ...extra, routeEstimates, selectedTransferIds }, inventory);
};
const audioRow = model => model.scenarioRows.find(row => row.warehouseInventoryId === "scenario-audio");

test("renta compara ocupación sin trasiego contra el plan de traslado, con categoría física vigente", () => {
  const { events, inventory } = fixture(), before = JSON.stringify({ events, inventory });
  const model = build(events, inventory), row = audioRow(model);
  assert.equal(row.category, "Audio vigente");
  assert.equal(row.demand, 5); assert.equal(row.ownedCapacity, 3);
  assert.equal(row.requiredWithoutTransfer, 5); assert.equal(row.rentWithoutTransfer, 2);
  assert.equal(row.requiredWithTransfer, 3); assert.equal(row.rentWithTransfer, 0);
  assert.equal(row.pending, false);
  assert.equal(model.transferRoutes.length, 1);
  assert.equal(model.transferRoutes[0].fromEventId, events[0].id);
  assert.equal(model.transferRoutes[0].toEventId, events[1].id);
  assert.equal(model.transferRoutes[0].quantity, 2);
  assert.equal(model.transferRoutes[0].requiresConfirmation, true);
  assert.equal(model.transferRoutes[0].requiresTimeConfirmation, false);
  assert.equal(model.rentalComparison.length, 1);
  assert.equal(model.productionMutations, 0);
  assert.equal(JSON.stringify({ events, inventory }), before);
  assert.equal(model.details[0].original.inventoryCategory, "Categoría original");
});

test("regreso a bodega y preparación permiten reutilización sin sumar todos los eventos", () => {
  const { events, inventory } = fixture(); events[0].equipmentInAt = "2026-11-25T22:00";
  const row = audioRow(build(events, inventory));
  assert.equal(row.demand, 5);
  assert.equal(row.requiredWithoutTransfer, 3); assert.equal(row.rentWithoutTransfer, 0);
  assert.equal(row.requiredWithTransfer, 3); assert.equal(row.rentWithTransfer, 0);
});

test("un intervalo insuficiente no ahorra renta y una ruta de minutos revisados sí puede hacerlo", () => {
  const { events, inventory } = fixture();
  Object.assign(events[1], { date: "2026-11-25", setupAt: "2026-11-25T21:00", startAt: "2026-11-25T22:00", endAt: "2026-11-25T23:00", equipmentInAt: "2026-11-26T02:00" });
  const ordinary = build(events, inventory);
  assert.equal(audioRow(ordinary).rentWithoutTransfer, 2); assert.equal(audioRow(ordinary).rentWithTransfer, 2);
  assert.equal(ordinary.transferRoutes.length, 0);
  const reviewed = build(events, inventory, { routeEstimates: [{ fromPlace: events[0].place, toPlace: events[1].place, travelMinutes: 0, handlingMinutes: 0 }] });
  assert.equal(audioRow(reviewed).rentWithTransfer, 0);
  assert.equal(reviewed.transferRoutes[0].requiresTimeConfirmation, false);
  assert.equal(reviewed.transferRoutes[0].travelMinutes, 0);
  events[1].setupAt = "2026-11-25T19:00";
  const overlapping = build(events, inventory, { routeEstimates: [{ fromPlace: events[0].place, toPlace: events[1].place, travelMinutes: 0, handlingMinutes: 0 }] });
  assert.equal(audioRow(overlapping).rentWithTransfer, 2);
  assert.equal(overlapping.transferRoutes.length, 0);
});

test("la capacidad insuficiente solo descuenta el equipo propio seleccionado sin reutilizar renta invisiblemente", () => {
  const { events, inventory } = fixture(1), model = build(events, inventory), row = audioRow(model);
  assert.equal(row.requiredWithoutTransfer, 5); assert.equal(row.rentWithoutTransfer, 4);
  assert.equal(row.requiredWithTransfer, 4); assert.equal(row.rentWithTransfer, 3);
  assert.equal(model.transferRoutes[0].quantity, 1);
  assert.equal(model.rentalTransferRoutes.length, 0);
});

test("el plan global conserva cadenas físicas sin asignar una unidad a destinos simultáneos", () => {
  const { events, inventory, makeEvent } = fixture();
  events[1].equipmentInAt = "2026-11-27T03:00";
  events.push(makeEvent("scenario-third", 3, { setupAt: "2026-11-27T08:00", startAt: "2026-11-27T12:00", endAt: "2026-11-27T20:00", equipmentInAt: "2026-11-28T10:00" }));
  const model = build(events, inventory), row = audioRow(model);
  assert.equal(row.requiredWithoutTransfer, 6); assert.equal(row.rentWithoutTransfer, 3);
  assert.equal(row.requiredWithTransfer, 4); assert.equal(row.rentWithTransfer, 1);
  assert.ok(model.transferRoutes.every(route => !(route.fromEventId === events[0].id && route.toEventId === events[2].id)), "The unused third unit may not bypass the intermediate day");
  const routes = [...model.transferRoutes, ...model.rentalTransferRoutes];
  for (const event of events) {
    const amount = event.sections[0].items[0].quantity;
    assert.ok(routes.filter(route => route.fromEventId === event.id).reduce((sum, route) => sum + route.quantity, 0) <= amount);
    assert.ok(routes.filter(route => route.toEventId === event.id).reduce((sum, route) => sum + route.quantity, 0) <= amount);
  }
});

test("horarios incompletos o contradictorios conservan la demanda como pendiente, nunca renta cero", () => {
  for (const change of [event => { delete event.startAt; }, event => { event.endAt = "2026-11-25T24:00"; }, event => { event.endAt = "2026-11-25T07:00"; }]) {
    const { events, inventory } = fixture(); change(events[0]);
    const original = JSON.stringify(events), model = build(events, inventory), row = audioRow(model);
    assert.equal(row.demand, 5);
    assert.equal(row.rentWithoutTransfer, 2); assert.equal(row.rentWithTransfer, 2);
    assert.equal(row.rentalProvisional, true);
    assert.equal(row.pendingWithoutTransfer, true); assert.equal(row.pendingWithTransfer, true);
    assert.ok(row.reason);
    assert.equal(model.transferRoutes.length, 0);
    assert.ok(model.scenarioExcludedEvents.some(event => event.eventId === events[0].id));
    assert.equal(JSON.stringify(events), original);
  }
});

test("equipo sin identidad, clasificación contradictoria o ingreso pendiente no fabrica una cifra de renta", () => {
  for (const configure of [
    ({ events }) => events.forEach(event => { delete event.sections[0].items[0].warehouseInventoryId; event.sections[0].items[0].description = "Unidad pendiente sin coincidencias"; }),
    ({ events, inventory }) => { inventory.state.items[0].name = "Duc tape sintético"; events.forEach(event => { event.sections[0].items[0].description = inventory.state.items[0].name; }); },
    ({ events }) => events.forEach(event => { event.sections[0].items[0].procurementChoice = "save"; })
  ]) {
    const input = fixture(); configure(input);
    const model = build(input.events, input.inventory), row = model.scenarioRows[0];
    assert.equal(row.pending, true);
    assert.equal(row.rentWithoutTransfer, null); assert.equal(row.rentWithTransfer, null);
    assert.equal(model.transferRoutes.length, 0); assert.equal(model.rentalTransferRoutes.length, 0);
  }
});

test("consumibles se suman incluso sin horarios y la compra usa existencias vigentes", () => {
  const { events, inventory } = fixture();
  inventory.state.items = [{ id: "scenario-tape", name: "Cinta sintética consumible", category: "Consumibles vigentes", itemType: "consumible", quantity: 3 }];
  for (const event of events) {
    for (const field of ["setupAt", "startAt", "endAt", "equipmentInAt"]) delete event[field];
    event.sections[0].items = [{ quantity: 4, description: "Cinta sintética consumible", warehouseInventoryId: "scenario-tape" }];
  }
  const model = build(events, inventory), row = model.consumablePurchases[0];
  assert.equal(row.itemType, "consumible"); assert.equal(row.category, "Consumibles vigentes");
  assert.equal(row.demand, 8); assert.equal(row.available, 3); assert.equal(row.purchaseQuantity, 5);
  assert.equal(row.pending, false);
  assert.equal(model.rentalComparison.length, 0);
  assert.equal(model.transferRoutes.length, 0); assert.equal(model.rentalTransferRoutes.length, 0);
  inventory.state.movements.push({ itemId: "scenario-tape", type: "consumo", quantity: 1 });
  assert.equal(build(events, inventory).consumablePurchases[0].purchaseQuantity, 6);
});

test("taller y salidas físicas no vinculadas reducen la capacidad sin inventar retornos", () => {
  const { events, inventory } = fixture();
  inventory.state.movements.push({ itemId: "scenario-audio", type: "taller", quantity: 1 });
  let row = audioRow(build(events, inventory));
  assert.equal(row.ownedCapacity, 2); assert.equal(row.rentWithoutTransfer, 3); assert.equal(row.rentWithTransfer, 1);
  inventory.state.movements.push({ itemId: "scenario-audio", type: "salida", quantity: 1, sourceEventId: "another-physical-event" });
  row = audioRow(build(events, inventory));
  assert.equal(row.ownedCapacity, 1); assert.equal(row.rentWithoutTransfer, 4); assert.equal(row.rentWithTransfer, 3);
});

test("el conjunto seleccionado se compara completo aunque el filtro de la agenda sea distinto", () => {
  const { events, inventory } = fixture();
  const model = build(events, inventory, { from: "2027-01-01", to: "2027-01-02" });
  assert.equal(model.events.length, 2); assert.equal(audioRow(model).demand, 5);
  assert.equal(audioRow(model).rentWithoutTransfer, 2); assert.equal(audioRow(model).rentWithTransfer, 0);
  assert.equal(model.transferRoutes[0].quantity, 2);
});

test("una compra explícita de equipo reutilizable no se mezcla con renta ni compra de consumibles", () => {
  const { events, inventory } = fixture();
  for (const event of events) event.sections[0].items[0].procurementChoice = "purchase";
  const model = build(events, inventory);
  assert.equal(model.rentalComparison.length, 0); assert.equal(model.consumablePurchases.length, 0);
  assert.equal(model.otherEquipmentPurchases.length, 1);
  assert.equal(model.otherEquipmentPurchases[0].demand, 5);
  assert.equal(model.transferRoutes.length, 0); assert.equal(model.rentalTransferRoutes.length, 0);
});

test("ceros y copia de referencia conservan celdas sin duplicar demanda ni mutar la fuente", () => {
  const { events, inventory } = fixture();
  const reference = structuredClone(events[0]); reference.id = "scenario-reference";
  reference.sourceCells = reference.sourceCells.map(cell => ({ ...cell, ref: cell.ref.replace("scenario-origin", "scenario-reference"), sheet: "scenario-reference" }));
  reference.sourceImport.sourceEventId = reference.id;
  reference.sections[0].items[0].sourceRefs = reference.sourceCells.map(cell => cell.ref);
  reference.sections[0].rows[0].sourceRefs = reference.sourceCells.map(cell => cell.ref);
  reference.sections[0].rows[0].cells = reference.sourceCells;
  events[0].sourceImport.referenceTables = [reference];
  events[1].sections[0].items.push({ quantity: 0, description: "Línea cero sin identidad" });
  const before = JSON.stringify({ events, inventory }), model = build(events, inventory);
  const zero = model.scenarioRows.find(row => row.description === "Línea cero sin identidad");
  assert.equal(zero.demand, 0); assert.equal(zero.rentWithoutTransfer, 0); assert.equal(zero.rentWithTransfer, 0);
  assert.equal(model.counts.events, 2); assert.equal(model.counts.equipmentRows, 3); assert.equal(model.counts.zeroQuantityRows, 1);
  assert.equal(model.sourceCells.length, 6);
  assert.equal(audioRow(model).demand, 5);
  assert.ok(model.preservedRows.some(row => row.section.startsWith("Referencia del archivo")));
  assert.equal(JSON.stringify({ events, inventory }), before);
});

test("vistas de un clic comparan escenarios y mantienen detalles cerrados con texto escapado", () => {
  const { events, inventory } = fixture();
  inventory.state.items[0].category = '<script>alert("category")</script>';
  events[0].client = "<img src=x onerror=alert(1)>";
  const model = build(events, inventory);
  const rent = reporting.renderEquipmentPlanningReportHtml(model, "rent");
  assert.match(rent, /sin trasiego/i); assert.match(rent, /con trasiego/i);
  assert.match(rent, /&lt;script&gt;/); assert.ok(!rent.includes('<script>alert("category")</script>'));
  assert.match(rent, /<details\b/); assert.doesNotMatch(rent, /<details\b[^>]*\bopen(?:\s|>)/);
  assert.match(rent, /PROVISIONAL/);
  const transfer = reporting.renderEquipmentPlanningReportHtml(model, "transfer");
  assert.match(transfer, /Lugar scenario-origin/); assert.match(transfer, /Lugar scenario-destination/);
  assert.match(transfer, /miércoles 25\/11\/2026/); assert.match(transfer, /jueves 26\/11\/2026/);
  assert.match(transfer, /Coincidencia de equipo/);
  assert.match(transfer, /&lt;img/); assert.ok(!transfer.includes("<img src=x"));
});

test("cantidades calculadas aparecen primero y los pendientes permanecen accesibles sin mezclarse con órdenes", () => {
  const { events, inventory, name } = fixture();
  inventory.state.items.push({ id: "scenario-consumable", name: "Consumible calculable sintético", category: "Insumos", itemType: "consumible", quantity: 1 });
  events[0].sections[0].items.push(
    { quantity: 1, description: "Referencia pendiente sintética" },
    { quantity: 3, description: "Consumible calculable sintético", warehouseInventoryId: "scenario-consumable" },
    { quantity: 4, description: "Consumible pendiente sintético", itemType: "consumible" }
  );
  const model = build(events, inventory), before = JSON.stringify(model);
  const rent = reporting.renderEquipmentPlanningReportHtml(model, "rent");
  const mainRent = /<section class="rental-results">([\s\S]*?)<\/section>/.exec(rent)[1];
  assert.ok(mainRent.includes(name));
  assert.ok(!mainRent.includes("Referencia pendiente sintética"));
  assert.match(rent, /pueden cambiar las cantidades finales/);
  assert.match(rent, /<section class="report-pending"><h2>Datos por revisar/);
  assert.ok(rent.indexOf('class="rental-results"') < rent.indexOf('class="report-pending"'));
  assert.ok(rent.includes("Referencia pendiente sintética"));
  const purchase = reporting.renderEquipmentPlanningReportHtml(model, "purchase");
  const mainPurchase = /<section class="purchase-results">([\s\S]*?)<\/section>/.exec(purchase)[1];
  assert.ok(mainPurchase.includes("Consumible calculable sintético"));
  assert.ok(mainPurchase.includes("Consumible pendiente sintético"));
  assert.match(mainPurchase, /Pendiente/);
  assert.match(purchase, /Datos por revisar/);
  assert.ok(purchase.includes("Consumible pendiente sintético"));
  const transfer = reporting.renderEquipmentPlanningReportHtml(model, "transfer");
  assert.doesNotMatch(transfer, /report-pending|Referencia pendiente sintética|Consumible pendiente sintético/);
  assert.match(transfer, /rutas pendientes de verificar/);
  assert.equal(JSON.stringify(model), before);
});
