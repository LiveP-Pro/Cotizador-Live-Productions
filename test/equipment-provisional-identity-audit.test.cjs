const test = require('node:test');
const assert = require('node:assert/strict');
const { createEquipmentReportModel } = require('../equipment-reporting.cjs');
const stamp = '2026-11-04T12:00:00.000Z';
function inventory(items, extra = {}) { return { savedAt: stamp, state: { items, movements: [], ...extra } }; }
function event(items, fields = {}) { return { id: 'synthetic-report-a', place: 'Lugar de prueba', date: '2026-11-05',
  sections: [{ title: 'Categoría sintética', items }], ...fields }; }
function sourceLine(description, quantity, fields = {}) { return { id: 'synthetic-line', description, quantity,
  sourceCells: [{ ref: "'Fuente actual'!A7", value: quantity }, { ref: "'Fuente actual'!B7", value: description }], ...fields }; }

test('native reports preserve unused zero rows without procurement or identity/classification tasks', () => {
  const model = createEquipmentReportModel({ events: [event([
    sourceLine('Desconocido sin uso', 0), sourceLine('Extintor sintético', 0, { id: 'second' }),
    sourceLine('Externo sin uso', 0, { id: 'third', procurementChoice: 'rent' })
  ])] }, inventory([{ id: 'ext', name: 'Extintor sintético', category: 'Categoría sintética', itemType: 'consumible', quantity: 0 }]));
  assert.equal(model.counts.equipmentRows, 3); assert.equal(model.counts.zeroQuantityRows, 3); assert.equal(model.rows.length, 3);
  assert.equal(model.rental.length, 0); assert.equal(model.purchase.length, 0);
  assert.equal(model.pending.filter(row => ['IDENTIDAD', 'CLASIFICACIÓN'].includes(row.kind)).length, 0);
  assert.ok(model.rows.every(row => /^SIN USO/.test(row.action)));
});

test('a saved extra uses inventory only after its claimed ingress exists in the server ledger and keeps source references', () => {
  const line = sourceLine('Unidad sintética', 3, { warehouseInventoryId: 'one', procurementChoice: 'save',
    inventoryIngressReceipts: [{ requestId: 'received-synthetic', index: 0, itemId: 'one', quantity: 3 }] });
  const events = [event([line])];
  const stock = inventory([{ id: 'one', name: 'Unidad sintética', category: 'Categoría sintética', itemType: 'equipo', quantity: 3 }]);
  let model = createEquipmentReportModel({ events }, stock);
  assert.equal(model.rows[0].available, null); assert.equal(model.rows[0].shortage, null);
  assert.equal(model.rental.length, 0); assert.equal(model.purchase.length, 0);
  stock.state.equipmentStockReceipts = [{ requestId: 'received-synthetic', items: [{ itemId: 'one', quantity: 3 }] }];
  model = createEquipmentReportModel({ events }, stock);
  assert.equal(model.rows[0].warehouseInventoryId, 'one'); assert.equal(model.rows[0].available, 3); assert.equal(model.rows[0].shortage, 0);
  assert.match(model.rows[0].sourceRefs, /Fuente actual.*A7/); assert.match(model.rows[0].sourceRefs, /Fuente actual.*B7/);
  assert.equal(model.details[0].resolvedInventoryId, 'one');
});

test('received purchase proof survives a renamed physical description without losing source cells or procurement preference', () => {
  const line = sourceLine('Descripción original de compra', 5, { procurementChoice: 'purchase' });
  const stock = inventory([{ id: 'one', name: 'Descripción vigente corregida', category: 'Categoría sintética', itemType: 'equipo', quantity: 2,
    equipmentPurchaseLinks: [{ requestId: 'purchase-received-synthetic', eventId: 'synthetic-report-a', itemId: 'synthetic-line',
      description: line.description, receivedAt: stamp, receivedQuantity: 2 }] }]);
  const model = createEquipmentReportModel({ events: [event([line])] }, stock);
  assert.equal(model.rows[0].warehouseInventoryId, 'one'); assert.equal(model.rows[0].shortage, 3); assert.equal(model.purchase.length, 1);
  assert.equal(model.purchase[0].action, 'COMPRA'); assert.equal(model.purchase[0].originalDescriptions, line.description);
  assert.match(model.rows[0].sourceRefs, /Fuente actual.*A7/); assert.match(model.rows[0].sourceRefs, /Fuente actual.*B7/);
  assert.equal(model.details[0].resolvedInventoryId, 'one'); assert.equal(model.sourceCells.length, 2);
});

test('provisional native rental does not subtract an unselected route or client-supplied transfer', () => {
  // Keep the units assigned to A past B so ordinary warehouse reuse cannot
  // legitimately cover B; only an explicit reviewed selection could do so.
  const shared = { setupAt: '2026-11-05T08:00', startAt: '2026-11-05T09:00', endAt: '2026-11-05T10:00', equipmentInAt: '2026-11-07T11:00' };
  const events = [event([sourceLine('Unidad sintética', 2)], shared), event([sourceLine('Unidad sintética', 2)], {
    id: 'synthetic-report-b', date: '2026-11-06', place: 'Otro lugar',
    setupAt: '2026-11-06T08:00', startAt: '2026-11-06T09:00', endAt: '2026-11-06T10:00', equipmentInAt: '2026-11-06T11:00'
  })];
  const stock = inventory([{ id: 'one', name: 'Unidad sintética', category: 'Categoría sintética', itemType: 'equipo', quantity: 2 }]);
  const before = JSON.stringify({ events, stock });
  const model = createEquipmentReportModel({ events, transfers: [{ status: 'confirmed', fromEventId: events[0].id, toEventId: events[1].id,
    items: [{ warehouseInventoryId: 'one', quantity: 2 }] }] }, stock);
  assert.equal(model.rows[0].demand, 4); assert.equal(model.rows[0].available, 2); assert.equal(model.rental[0].shortage, 2);
  assert.deepEqual(model.transfers, []); assert.equal(model.productionMutations, 0);
  assert.equal(JSON.stringify({ events, stock }), before);
});
