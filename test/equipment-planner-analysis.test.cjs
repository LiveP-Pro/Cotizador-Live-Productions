const test = require('node:test');
const assert = require('node:assert/strict');
const { analyze } = require('../equipment-planner.js');

const confirmedAt = '2026-11-04T12:00:00.000Z';
function record(id, name, available, options = {}) {
  return { id, available, item: { id, name, category: 'Inventario sintético', itemType: 'equipo', quantity: available, ...options } };
}
function event(id, items, options = {}) {
  return { id, place: `Lugar ${id}`, date: '2026-11-05', sections: [{ title: 'Sección de origen', items }], ...options };
}
function line(description, quantity, options = {}) { return { description, quantity, ...options }; }
function snapshot(value) { return JSON.parse(JSON.stringify(value)); }

test('normal and matiz stock are separate physical references even if the other model has enough spare units', () => {
  const records = [record('normal', 'Par LED normal con cable AC', 80), record('matiz', 'Par LED matiz con cable AC', 5)];
  const model = analyze([event('a', [line(records[0].item.name, 5), line(records[1].item.name, 80)])], records);
  assert.equal(model.rows.length, 2);
  const normal = model.rows.find(row => row.item?.id === 'normal');
  const matiz = model.rows.find(row => row.item?.id === 'matiz');
  assert.equal(normal.available, 80); assert.equal(normal.missing, 0); assert.equal(normal.quantity, 5);
  assert.equal(matiz.available, 5); assert.equal(matiz.missing, 75); assert.equal(matiz.quantity, 80);
  assert.deepEqual(model.rent.map(row => row.item.id), ['matiz']);
});

test('a generic LED description cannot use a previously automatic normal-model ID or show zero as known stock', () => {
  const records = [record('normal', 'Par LED normal con cable AC', 80), record('matiz', 'Par LED matiz con cable AC', 5)];
  const model = analyze([event('a', [line('Par LED RGB con cable AC', 70, { warehouseInventoryId: 'normal' })])], records);
  assert.equal(model.rows[0].resolution.status, 'identity_conflict');
  assert.equal(model.rows[0].available, null); assert.equal(model.rows[0].missing, null);
  assert.equal(model.identityPending.length, 1); assert.equal(model.rent.length, 0); assert.equal(model.purchase.length, 0);
});

test('ambiguous and archived references stay pending instead of summing or resurrecting inventory', () => {
  const model = analyze([event('a', [line('Unidad duplicada', 3), line('Unidad retirada', 2)])], [
    record('same-a', 'Unidad duplicada', 7), record('same-b', 'Unidad duplicada', 9), record('archived', 'Unidad retirada', 12, { archived: true })
  ]);
  assert.equal(model.identityPending.length, 2);
  assert.deepEqual(model.rows.map(row => row.available), [null, null]);
  assert.deepEqual(model.rows.map(row => row.missing), [null, null]);
  assert.equal(model.rent.length, 0); assert.equal(model.purchase.length, 0);
});

test('one physical ID across several source categories is counted once with all event quantities', () => {
  const stock = record('physical', 'Unidad física sintética', 3, { category: 'Categoría vigente' });
  const events = [event('a', [line(stock.item.name, 2)]), event('b', [], { sections: [
    { title: 'Otra categoría del archivo', items: [line(stock.item.name, 4, { warehouseInventoryId: 'physical' })] }
  ] })];
  const model = analyze(events, [stock]);
  assert.equal(model.rows.length, 1); assert.equal(model.rows[0].category, 'Categoría vigente');
  assert.equal(model.rows[0].available, 3); assert.equal(model.rows[0].quantity, 6); assert.equal(model.rows[0].missing, 3);
  assert.deepEqual(model.rows[0].eventQuantities, { a: 2, b: 4 }); assert.equal(model.rows[0].sources.length, 2);
});

test('classification concerns remain pending until Contabilidad confirms a reusable or consumable type', () => {
  const records = [record('ext', 'Extintor', 3, { itemType: 'consumible' }), record('gafer', 'Gafer', 1)];
  const events = [event('a', [line('Extintor', 6), line('Gafer', 4)])];
  const before = snapshot(records);
  let model = analyze(events, records);
  assert.equal(model.classificationPending.length, 2); assert.equal(model.rent.length, 0); assert.equal(model.purchase.length, 0);
  assert.deepEqual(records, before);
  records[0].item.itemType = 'equipo';
  records[0].item.classificationConfirmed = { itemType: 'equipo', name: 'Extintor', confirmedAt };
  records[1].item.itemType = 'consumible';
  records[1].item.classificationConfirmed = { itemType: 'consumible', name: 'Gafer', confirmedAt };
  model = analyze(events, records);
  assert.equal(model.classificationPending.length, 0);
  assert.deepEqual(model.rent.map(row => [row.item.id, row.missing]), [['ext', 3]]);
  assert.deepEqual(model.purchase.map(row => [row.item.id, row.missing]), [['gafer', 3]]);
});

test('confirmed aliases require explicit evidence and never rewrite source descriptions or cells', () => {
  const cells = [{ ref: "'Hoja actual'!A7", value: 0 }, { ref: "'Hoja actual'!B7", value: '  Nombre Á anterior  ', note: 'No borrar la observación' }];
  const headers = [{ ref: "'Hoja actual'!B6", value: 'CATEGORÍA ORIGINAL' }];
  const events = [event('a', [line('  Nombre Á anterior  ', 0, { sourceCells: cells, notes: ['Nota literal de fila'] })], {
    sourceCells: [...headers, ...cells], observations: 'Observación literal de evento',
    sections: [{ title: 'CATEGORÍA ORIGINAL', sourceCells: headers, notes: ['Nota de sección'],
      items: [line('  Nombre Á anterior  ', 0, { sourceCells: cells, notes: ['Nota literal de fila'] })] }]
  })];
  const records = [record('one', 'Nombre corregido', 0, { approvedDescriptionAliases: [{ name: 'Nombre Á anterior', approved: true, approvedAt: confirmedAt }] })];
  const originalEvents = snapshot(events), originalRecords = snapshot(records);
  const model = analyze(events, records);
  assert.equal(model.lineCount, 1); assert.equal(model.zeroCount, 1); assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].quantity, 0); assert.equal(model.rows[0].sources[0].description, '  Nombre Á anterior  ');
  assert.deepEqual(model.rows[0].sources[0].sourceCells, cells); assert.deepEqual(model.rows[0].sources[0].sectionCells, headers);
  assert.deepEqual(events, originalEvents); assert.deepEqual(records, originalRecords); assert.deepEqual(model.events, originalEvents);
});

test('zero-quantity rows remain visible without triggering identification, classification, purchase or rental actions', () => {
  const model = analyze([event('a', [line('Desconocido sin uso', 0), line('Extintor', 0),
    line('Extra externo rentado sin uso', 0, { procurementChoice: 'rent' }), line('Insumo externo sin uso', 0, { procurementChoice: 'purchase' })])],
  [record('ext', 'Extintor', 0, { itemType: 'consumible' })]);
  assert.equal(model.lineCount, 4); assert.equal(model.zeroCount, 4); assert.equal(model.rows.length, 4);
  assert.equal(model.identityPending.length, 0); assert.equal(model.classificationPending.length, 0);
  assert.equal(model.rent.length, 0); assert.equal(model.purchase.length, 0);
  assert.equal(model.rows.some(row => ['RENTA', 'COMPRA', 'IDENTIFICAR', 'REVISAR TIPO'].includes(row.action)), false);
});

test('provisional shortages never decrease merely because times, places or an unconfirmed route make reuse plausible', () => {
  const records = [record('physical', 'Unidad sintética', 2)];
  const events = [event('a', [line('Unidad sintética', 2)], {
    setupAt: '2026-11-05T08:00', startAt: '2026-11-05T09:00', endAt: '2026-11-05T10:00', equipmentInAt: '2026-11-05T11:00'
  }), event('b', [line('Unidad sintética', 2)], {
    setupAt: '2026-11-06T08:00', startAt: '2026-11-06T09:00', endAt: '2026-11-06T10:00', equipmentInAt: '2026-11-06T11:00', date: '2026-11-06',
    proposedRoutes: [{ fromEventId: 'a', toEventId: 'b', quantity: 2, status: 'suggested' }]
  })];
  let model = analyze(events, records);
  assert.equal(model.eventPending.length, 0); assert.equal(model.rows[0].missing, 2); assert.equal(model.rent[0].missing, 2);
  delete events[1].setupAt;
  model = analyze(events, records);
  assert.equal(model.eventPending.length, 1); assert.equal(model.rows[0].missing, 2);
});

test('an extra saved for later ingress cannot borrow physical inventory merely because its name is identical', () => {
  const model = analyze([event('a', [line('Unidad sintética', 6, { procurementChoice: 'save', warehouseInventoryId: 'one' })])],
    [record('one', 'Unidad sintética', 2)]);
  assert.equal(model.rows[0].available, null); assert.equal(model.rows[0].missing, null);
  assert.equal(model.rent.length, 0); assert.equal(model.purchase.length, 0);
  assert.ok(!['RENTA', 'COMPRA', 'CUBIERTO'].includes(model.rows[0].action));
});

test('invalid quantities stay visible for correction and are never converted into a valid zero row', () => {
  const events = [event('a', [line('Cantidad vacía', ''), line('Cantidad nula', null), line('Cantidad inválida', 'dos'), line('Cantidad negativa', -1)])];
  const original = snapshot(events);
  const model = analyze(events, []);
  assert.equal(model.lineCount, 4); assert.equal(model.zeroCount, 0);
  assert.equal(model.rows.length, 4); assert.equal(model.rent.length, 0); assert.equal(model.purchase.length, 0);
  assert.equal(model.invalidLines.length, 4);
  assert.deepEqual(model.events, original); assert.deepEqual(events, original);
});

test('a partially received purchase shows only remaining shortage and matches the native report with the renamed physical item', () => {
  const { createEquipmentReportModel } = require('../equipment-reporting.cjs');
  const source = line('Descripción original de compra', 5, { id: 'synthetic-line', procurementChoice: 'purchase', sourceCells: [{ ref: "'Fuente actual'!A7", value: 5 }, { ref: "'Fuente actual'!B7", value: 'Descripción original de compra', note: 'Conservar' }] });
  const events = [event('synthetic-report-a', [source])];
  const stock = record('one', 'Descripción vigente corregida', 2, { equipmentPurchaseLinks: [{ requestId: 'purchase-received-synthetic', eventId: 'synthetic-report-a', itemId: 'synthetic-line', description: source.description, receivedAt: confirmedAt, receivedQuantity: 2 }] });
  const original = snapshot({ events, stock });
  const model = analyze(events, [stock]);
  const report = createEquipmentReportModel({ events }, { savedAt: confirmedAt, state: { items: [stock.item], movements: [] } });
  assert.equal(model.rows.length, 1); assert.equal(model.rows[0].item.id, 'one'); assert.equal(model.rows[0].resolution.status, 'purchase_receipt');
  assert.equal(model.rows[0].quantity, 5); assert.equal(model.rows[0].available, 2); assert.equal(model.rows[0].missing, 3);
  assert.equal(model.purchase.length, 1); assert.equal(model.rent.length, 0); assert.equal(model.purchase[0].action, 'COMPRA');
  assert.equal(model.purchase[0].missing, report.purchase[0].shortage); assert.equal(report.rows[0].warehouseInventoryId, model.rows[0].item.id);
  assert.deepEqual(model.rows[0].sources[0].sourceCells, source.sourceCells); assert.deepEqual({ events, stock }, original);
});

test('a receipt never subtracts units twice and a linked purchase keeps Compra for its remaining reusable-equipment shortage', () => {
  const received = { requestId: 'synthetic-purchase', eventId: 'a', itemId: 'purchase-line', description: 'Unidad sintética', receivedQuantity: 2 };
  let model = analyze([event('a', [line('Unidad sintética', 5, { id: 'purchase-line', procurementChoice: 'purchase' })])], [record('one', 'Unidad sintética', 5, { equipmentPurchaseLinks: [received] })]);
  assert.equal(model.rows[0].quantity, 5); assert.equal(model.rows[0].available, 5); assert.equal(model.rows[0].missing, 0); assert.equal(model.purchase.length, 0);
  model = analyze([event('a', [line('Unidad sintética', 5, { id: 'purchase-line', procurementPreference: 'purchase', warehouseInventoryId: 'one' })])], [record('one', 'Unidad sintética', 2, { equipmentPurchaseLinks: [received] })]);
  assert.equal(model.rows[0].missing, 3); assert.equal(model.rows[0].action, 'COMPRA'); assert.equal(model.rent.length, 0);
});

test('unproven or ambiguous purchase links do not claim physical stock and explicit rental remains rental', () => {
  const source = line('Unidad compra sintética', 5, { id: 'purchase-line', procurementChoice: 'purchase' });
  const proof = { requestId: 'synthetic-purchase', eventId: 'a', itemId: 'purchase-line', description: source.description, receivedQuantity: 2 };
  for (const patch of [{ requestId: '' }, { eventId: 'other' }, { itemId: 'other-line' }, { description: 'Otro artículo' }, { receivedQuantity: 0 }, { receivedQuantity: 'invalido' }]) {
    const model = analyze([event('a', [source])], [record('one', 'Unidad compra sintética', 2, { equipmentPurchaseLinks: [{ ...proof, ...patch }] })]);
    assert.equal(model.rows[0].item, null); assert.equal(model.rows[0].missing, 5); assert.equal(model.purchase[0].missing, 5);
  }
  const duplicate = analyze([event('a', [source])], [record('one', 'Unidad compra sintética', 2, { equipmentPurchaseLinks: [proof] }), record('two', 'Otra unidad', 2, { equipmentPurchaseLinks: [proof] })]);
  assert.equal(duplicate.rows[0].item, null); assert.equal(duplicate.purchase[0].missing, 5);
  const rented = analyze([event('a', [{ ...source, procurementChoice: 'rent' }])], [record('one', 'Unidad compra sintética', 2, { equipmentPurchaseLinks: [proof] })]);
  assert.equal(rented.rent[0].missing, 5); assert.equal(rented.purchase.length, 0);
});
