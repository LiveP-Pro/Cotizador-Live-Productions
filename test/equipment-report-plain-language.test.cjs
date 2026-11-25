const assert = require('node:assert/strict');
const test = require('node:test');
const reporting = require('../equipment-reporting.cjs');

// Fresh synthetic events and stock only; no prior book/catalog data.
function fixture(quantities = [2, 2], own = 2, consumable = false) {
  const name = consumable ? 'Cinta consumible sintética' : 'Unidad reutilizable sintética';
  const inventory = { savedAt: '2026-11-23T12:00:00.000Z', state: { items: [{ id: 'plain-stock', name, category: consumable ? 'Consumibles' : 'Audio', itemType: consumable ? 'consumible' : 'equipo', quantity: own }], movements: [] } };
  const events = quantities.map((quantity, index) => {
    const day = String(25 + index).padStart(2, '0');
    const sourceCells = [{ ref: `Fuente-${index}!A1`, sheet: `Evento ${index}`, address: 'A1', value: quantity }, { ref: `Fuente-${index}!B1`, sheet: `Evento ${index}`, address: 'B1', value: name }];
    return { id: `plain-${index}`, client: `Evento ${String.fromCharCode(65 + index)}`, name: `Evento ${String.fromCharCode(65 + index)}`, place: `Lugar ${index}`, date: `2026-11-${day}`,
      setupAt: `2026-11-${day}T08:00`, startAt: `2026-11-${day}T12:00`, endAt: `2026-11-${day}T21:00`, equipmentInAt: '2026-11-29T10:00', sourceCells,
      sourceImport: { sourceCells, metadata: { date: `2026-11-${day}` } },
      sections: [{ title: consumable ? 'Consumibles' : 'Audio', items: [{ id: `line-${index}`, quantity, description: name, warehouseInventoryId: 'plain-stock' }], rows: [{ type: 'item', quantity, description: name, sourceItemIndex: 0, cells: sourceCells }] }] };
  });
  return { name, events, inventory };
}
function model(input) {
  // These report-layout cases explicitly choose the current reviewed routes.
  // They must not rely on an invisible automatic selection in production.
  const routeEstimates = input.events.slice(0, -1).map((event, index) => ({ fromPlace: event.place, toPlace: input.events[index + 1].place, travelMinutes: 60, handlingMinutes: 120 }));
  const preview = reporting.createEquipmentReportModel({ events: input.events, routeEstimates }, input.inventory);
  const selectedTransferIds = preview.draftLogistics.candidates.filter(candidate => candidate.status === 'ready').map(candidate => candidate.id);
  return reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates, selectedTransferIds }, input.inventory);
}

test('the same physical units at A and B count once, with additional need rented only when stock is insufficient', () => {
  for (const [quantities, own, unique, ownUsed, rented] of [[[2, 2], 2, 2, 2, 0], [[3, 2], 3, 3, 3, 0], [[2, 5], 2, 5, 2, 3]]) {
    const input = fixture(quantities, own), before = JSON.stringify(input), report = model(input), row = report.physicalSummary[0];
    assert.equal(row.totalRequested, quantities.reduce((sum, value) => sum + value, 0));
    assert.equal(row.uniquePhysicalNeeded, unique); assert.equal(row.ownUnitsPlanned, ownUsed); assert.equal(row.rentalUnitsNeeded, rented);
    assert.equal(row.ownUnitsPlanned + row.rentalUnitsNeeded, row.uniquePhysicalNeeded);
    assert.equal(report.productionMutations, 0); assert.equal(JSON.stringify(input), before);
    // The physical arithmetic remains available in Renta; the transfer-only
    // document now deliberately contains the two requested equipment lists.
    for (const mode of ['rent']) {
      const markup = reporting.renderEquipmentPlanningReportHtml(report, mode);
      assert.match(markup, /Resumen final: equipo físico/); assert.match(markup, /2 unidades físicas, no 4/);
      assert.match(markup, /Solo se renta el faltante real/);
    }
    assert.doesNotMatch(reporting.renderEquipmentPlanningReportHtml(report, 'transfer'), /Resumen final: equipo físico/);
  }
});

test('two legs of a three-event chain are movements, not duplicated physical units', () => {
  const report = model(fixture([2, 2, 2], 2)), row = report.physicalSummary[0];
  assert.equal(row.totalRequested, 6); assert.equal(row.uniquePhysicalNeeded, 2); assert.equal(row.ownUnitsPlanned, 2); assert.equal(row.rentalUnitsNeeded, 0);
  assert.equal(row.transferMovements, 4);
  const markup = reporting.renderEquipmentPlanningReportHtml(report, 'transfer');
  assert.equal((markup.match(/class="transfer-card"/g) || []).length, 2);
  assert.doesNotMatch(markup, /movimientos entre eventos|Resumen final/);
});

test('consumption is shown per event and total, including zero rows, while only the remaining shortage is bought', () => {
  const input = fixture([2, 3, 0], 1, true), before = JSON.stringify(input), report = model(input), row = report.consumablePurchases[0];
  assert.equal(row.demand, 5); assert.equal(row.remainingConsumption, 5); assert.equal(row.alreadyConsumed, 0); assert.equal(row.purchaseQuantity, 4);
  assert.deepEqual(row.eventQuantities, { 'plain-0': 2, 'plain-1': 3, 'plain-2': 0 });
  assert.equal(report.transferRoutes.length, 0); assert.equal(report.physicalSummary.length, 0);
  const markup = reporting.renderEquipmentPlanningReportHtml(report, 'purchase');
  const visible = markup.split('<details class="source-appendix')[0];
  assert.match(visible, /Evento A/); assert.match(visible, /Evento B/); assert.match(visible, /Evento C/); assert.match(visible, /Consumo total/);
  assert.match(visible, /<td class="number">2<\/td><td class="number">3<\/td><td class="number">0<\/td>/);
  assert.match(visible, /El trasiego del equipo no reduce ese consumo/);
  assert.equal(JSON.stringify(input), before);
});

test('recorded consumption for a selected event is not purchased a second time', () => {
  for (const useDispatchId of [false, true]) {
    const input = fixture([2, 3], 4, true);
    if (useDispatchId) input.events[0].warehouseDispatchId = 'plain-dispatch-a';
    input.inventory.state.movements.push({ id: 'consumed-a', type: 'consumo', itemId: 'plain-stock', quantity: 2,
      sourceEventId: input.events[0].id, ...(useDispatchId ? { sourceDocumentId: 'plain-dispatch-a' } : {}) });
    const before = JSON.stringify(input), report = model(input), row = report.consumablePurchases[0];
    assert.equal(row.demand, 5); assert.equal(row.alreadyConsumed, 2); assert.equal(row.remainingConsumption, 3); assert.equal(row.available, 2); assert.equal(row.purchaseQuantity, 1);
    assert.equal(JSON.stringify(input), before);
  }
});

test('a wholly unused consumable is still visible in the main consumption table with genuine zeros', () => {
  const input = fixture([0, 0], 0, true), report = model(input);
  const row = report.consumablePurchases[0];
  assert.equal(row.demand, 0); assert.equal(row.purchaseQuantity, 0);
  const markup = reporting.renderEquipmentPlanningReportHtml(report, 'purchase');
  const main = markup.match(/<section class="purchase-results">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(main); assert.ok(main.includes(input.name));
  assert.match(main, /<td class="number">0<\/td><td class="number">0<\/td>/);
  assert.doesNotMatch(main, /<details/);
});

test('consumption from another event is a stock change, not fulfillment of this event demand', () => {
  const input = fixture([2, 3], 4, true);
  input.events[0].warehouseDispatchId = 'plain-dispatch-a';
  input.inventory.state.movements.push({ id: 'other-consumption', type: 'consumo', itemId: 'plain-stock', quantity: 2, sourceEventId: input.events[0].id, sourceDocumentId: 'another-dispatch' });
  const row = model(input).consumablePurchases[0];
  assert.equal(row.alreadyConsumed, 0); assert.equal(row.remainingConsumption, 5); assert.equal(row.available, 2); assert.equal(row.purchaseQuantity, 3);
});

test('printed route tables repeat readable identities and preserve literal source dates separately', () => {
  const input = fixture(), before = JSON.stringify(input), report = model(input), markup = reporting.renderEquipmentPlanningReportHtml(report, 'transfer');
  const visible = markup.split('<details class="source-appendix')[0];
  assert.match(visible, /Evento A · Lugar 0 → Montaje · Evento B · Lugar 1/);
  assert.match(visible, /<thead><tr><th>Cantidad<\/th><th>Equipo/);
  assert.match(visible, /miércoles 25\/11\/2026 → jueves 26\/11\/2026/); assert.doesNotMatch(visible, /2026-11-\d\dT/);
  assert.doesNotMatch(visible, /celdas originales conservadas|códigos E1/);
  assert.equal(report.events[0].date, '2026-11-25'); assert.equal(JSON.stringify(input), before);
});

test('unresolved items retain their review in renta and the transfer-only document keeps a brief notice', () => {
  const input = fixture();
  input.events[0].sections[0].items.push({ quantity: 1, description: 'Equipo pendiente sintético <script>' });
  const report = model(input), markup = reporting.renderEquipmentPlanningReportHtml(report, 'rent');
  const review = markup.match(/<section class="report-pending">([\s\S]*?)<\/section>/)?.[1];
  assert.ok(review); assert.match(review, /Equipo pendiente sintético &lt;script&gt;/); assert.match(review, /Identifique esta referencia/);
  assert.doesNotMatch(review, /<details/); assert.match(markup, /Sus cantidades|cantidades finales/);
  assert.equal(report.physicalSummary.find(row => row.description.includes('pendiente')).uniquePhysicalNeeded, null);
  const transfer = reporting.renderEquipmentPlanningReportHtml(report, 'transfer');
  assert.doesNotMatch(transfer, /Equipo pendiente sintético|Datos por revisar/);
  assert.match(transfer, /rutas pendientes de verificar/);
});

function performedFixture() {
  const input = fixture([3, 2], 3);
  Object.assign(input.events[0], { warehouseDispatchId: 'dispatch-a', date: '2026-11-20', setupAt: '2026-11-20T08:00', startAt: '2026-11-20T12:00', endAt: '2026-11-20T20:00', equipmentInAt: '2026-11-21T02:00' });
  Object.assign(input.events[1], { warehouseDispatchId: 'dispatch-b', date: '2026-11-21', setupAt: '2026-11-21T08:00', startAt: '2026-11-21T12:00', endAt: '2026-11-21T20:00', equipmentInAt: '2026-11-22T02:00' });
  input.inventory.state.movements.push({ id: 'out-a', type: 'salida', itemId: 'plain-stock', quantity: 3, sourceEventId: 'plain-0', sourceDocumentId: 'dispatch-a', sourceLineKey: 'line-a', dateTime: '2026-11-20T08:00' });
  input.inventory.state.equipmentHandoffs = [{ id: 'actual-a-b', transferId: 'route-that-may-later-be-cancelled', fromEventId: 'plain-0', toEventId: 'plain-1', fromDocumentId: 'dispatch-a', toDocumentId: 'dispatch-b', itemId: 'plain-stock', quantity: 2,
    links: [{ sourceMovementId: 'out-a', sourceDocumentId: 'dispatch-a', sourceEventId: 'plain-0', parentHandoffId: '', quantity: 2 }] }];
  return input;
}
const historyModel = input => reporting.createEquipmentPlanningReportModel({ events: input.events }, input.inventory, { now: Date.parse('2026-11-23T18:00:00Z') });

test('an already performed handoff fixes the physical chain even after estimated returns are past', () => {
  for (const originReturned of [false, true]) {
    const input = performedFixture();
    if (originReturned) input.inventory.state.movements.push({ id: 'return-retained-a', type: 'ingreso_evento', itemId: 'plain-stock', quantity: 1, relatedMovementId: 'out-a', sourceEventId: 'plain-0', sourceDocumentId: 'dispatch-a', sourceLineKey: 'line-a', dateTime: '2026-11-22T08:00' });
    const before = JSON.stringify(input), report = historyModel(input), row = report.scenarioRows[0], physical = report.physicalSummary[0];
    assert.equal(row.requiredWithTransfer, 3); assert.equal(row.rentWithTransfer, 0); assert.equal(row.pending, false);
    assert.equal(physical.uniquePhysicalNeeded, 3); assert.equal(physical.ownUnitsPlanned, 3); assert.equal(physical.rentalUnitsNeeded, 0);
    assert.equal(row.withoutTransferAlreadyPerformed, true); assert.equal(row.requiredWithoutTransfer, null); assert.equal(row.rentWithoutTransfer, null);
    assert.equal(report.performedHandoffs.length, 1); assert.equal(report.performedHandoffs[0].quantity, 2);
    assert.equal(report.transferRoutes.length, 0, 'actual receipt must not appear as a new proposed delivery');
    const markup = reporting.renderEquipmentPlanningReportHtml(report, 'rent');
    assert.match(markup, /Equipo que ya fue trasladado/); assert.match(markup, /Ya trasladado/);
    assert.equal(JSON.stringify(input), before, 'the original physical exit and returns remain unchanged');
  }
});

test('an incomplete or corrupt handoff history is pending instead of inventing free units or rental', () => {
  for (const configure of [input => { input.events = input.events.slice(1); }, input => { input.inventory.state.equipmentHandoffs[0].links[0].sourceMovementId = 'missing-physical-exit'; }, input => { input.events[1].warehouseDispatchId = 'different-current-document'; }]) {
    const input = performedFixture(); configure(input); const before = JSON.stringify(input), report = historyModel(input), row = report.scenarioRows[0];
    assert.equal(row.pending, true); assert.equal(row.requiredWithTransfer, null); assert.equal(row.rentWithTransfer, null); assert.equal(row.rentWithoutTransfer, null);
    assert.equal(report.transferRoutes.length, 0); assert.equal(report.performedHandoffs.length, 0); assert.ok(row.reason);
    assert.equal(JSON.stringify(input), before);
  }
});

test('historical receipts and a future cohort require real-return review before reallocating stock', () => {
  const input = performedFixture();
  input.inventory.state.movements.push({ id: 'partial-return-b', type: 'ingreso_evento', itemId: 'plain-stock', quantity: 1, relatedMovementId: 'out-a', sourceEventId: 'plain-0', sourceDocumentId: 'dispatch-a', sourceLineKey: 'handoff-return:actual-a-b', dateTime: '2026-11-22T08:00' });
  const third = fixture([1], 3).events[0];
  Object.assign(third, { id: 'plain-future', client: 'Evento futuro', name: 'Evento futuro', place: 'Lugar futuro', date: '2026-11-30', setupAt: '2026-11-30T08:00', startAt: '2026-11-30T12:00', endAt: '2026-11-30T20:00', equipmentInAt: '2026-12-01T02:00' });
  input.events.push(third);
  const before = JSON.stringify(input), report = historyModel(input), row = report.scenarioRows[0];
  assert.equal(row.pending, true); assert.equal(row.requiredWithTransfer, null); assert.equal(row.rentWithTransfer, null);
  assert.match(row.reason, /otros eventos|devoluciones reales/); assert.equal(report.transferRoutes.length, 0);
  assert.equal(JSON.stringify(input), before);
});
