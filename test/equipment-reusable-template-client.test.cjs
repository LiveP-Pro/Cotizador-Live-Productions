const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness: createServerHarness } = require('./helpers/equipment-server-harness.cjs');
const { createEquipmentEventStore, calculateEquipmentAvailability } = require('../equipment-event-store.cjs');
const personalizer = require('../equipment-event-personalizer.js');

// Reuse the UI fixture definition without registering or executing its tests.
const fixtureSource = fs.readFileSync(path.join(__dirname, 'equipment-personalization-integration.test.cjs'), 'utf8');
const fixtureDefinition = fixtureSource.slice(fixtureSource.indexOf('function harness() {'), fixtureSource.indexOf('\nconst plain ='));
const createUiHarness = new Function('fs', 'path', 'vm', '__dirname', fixtureDefinition + '; return harness;')(fs, path, vm, __dirname);
const clone = value => JSON.parse(JSON.stringify(value));
const stock = { savedAt: '2026-10-20T12:00:00.000Z', state: { datasetId: 'synthetic-reuse-client', movements: [], items: [
  { id: 'physical-a', name: 'Consola homónima sintética', category: 'Audio', quantity: 3, itemType: 'equipo' },
  { id: 'physical-b', name: 'Consola homónima sintética', category: 'Audio', quantity: 2, itemType: 'equipo' },
  { id: 'physical-consumable', name: 'Consumible sintético', category: 'Consumibles', quantity: 5, itemType: 'consumible' }
] } };

function currentEvent(reusable = true) {
  const parsed = personalizer.parseClipboard('Cantidad\tDescripción\tCategoría\tObservaciones\tDetalle\nAUDIO\n0\tConsola homónima sintética\tAudio\t  Nota literal\tSerie B\nObservación: no mezclar consolas\n2\tConsumible sintético\tConsumibles\tNota consumible\tDetalle extra');
  parsed.id = 'synthetic-reusable-event';
  parsed.metadata = { place: 'Lugar sintético', type: 'Tipo sintético', setupAt: '2026-11-12T08:00', startAt: '2026-11-12T10:00', endAt: '2026-11-12T18:00', equipmentInAt: '2026-11-12T21:00', notes: '  Observación general\ncon salto  ' };
  parsed.rows.find(row => row.description === 'Consola homónima sintética').warehouseInventoryId = 'physical-b';
  if (reusable) Object.assign(parsed, { usageMode: 'service', serviceName: 'Servicio reutilizable sintético', serviceGroupId: 'personalizados' });
  const event = personalizer.buildEvent(parsed, stock.state.items, [{ id: 'personalizados', label: 'Personalizados' }]);
  const audio = event.sections.find(section => section.items.some(item => item.warehouseInventoryId === 'physical-b'));
  audio.sourceCells = [{ ref: 'Celdas!A3', value: 0 }, { ref: 'Celdas!B3', value: 'Consola homónima sintética' }];
  audio.items[0].sourceCells = clone(audio.sourceCells);
  if (reusable) event.serviceTemplate.mainSections = clone(event.sections);
  return event;
}

function setup(t) {
  const ui = createUiHarness();
  const server = createServerHarness(t);
  const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = serverSource.indexOf('async function savePersonalizedEquipmentService(');
  const end = serverSource.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(serverSource.slice(start, end + 2), server.api);
  server.api.equipmentEventStore = createEquipmentEventStore({ directory: server.dir, now: () => Date.parse('2026-10-20T12:00:00Z') });
  server.api.calculateEquipmentAvailability = calculateEquipmentAvailability;
  server.write('warehouseInventoryPath', clone(stock));
  fs.writeFileSync(path.join(server.dir, 'equipment-catalog.js'), 'window.requerimientoEquipoCatalog = ' + JSON.stringify(ui.context.window.requerimientoEquipoCatalog) + ';');
  const controls = { failService: false, failEvent: false };
  ui.context.fetch = async (url, init = {}) => {
    const payload = init.body ? JSON.parse(init.body) : undefined;
    ui.requests.push({ url, init, body: clone(payload || {}) });
    if (url === '/api/cuadros-equipo/servicios-personalizados' && controls.failService) return { ok: false, status: 409, json: async () => ({ error: 'Conflicto sintético de nuevo servicio' }) };
    if (/\/eventos\//.test(url) && init.method === 'PUT' && controls.failEvent) return { ok: false, status: 409, json: async () => ({ error: 'Conflicto sintético al guardar evento' }) };
    const result = await server.dispatch(init.method || 'GET', url, payload);
    return { ok: result.statusCode >= 200 && result.statusCode < 300, status: result.statusCode, json: async () => result.json() };
  };
  ui.context.syntheticStock = clone(stock);
  ui.run(`applyEquipmentWarehouseInventoryPayload(syntheticStock);
    equipmentSharedWorkspace.enabled=true;
    equipmentSharedWorkspace.client=window.EquipmentWorkspace.create({date:'2026-11-12',onState:applyEquipmentSharedState});`);
  return { ...ui, server, controls, setEvent(event) { ui.context.syntheticEvent = clone(event); },
    save() { return ui.run('savePersonalizedEquipmentEvent(syntheticEvent)'); },
    serviceWrites() { return ui.requests.filter(request => request.url === '/api/cuadros-equipo/servicios-personalizados'); },
    eventWrites() { return ui.requests.filter(request => /\/eventos\//.test(request.url) && request.init.method === 'PUT'); } };
}

test('Usar una vez guarda un evento real y no crea ni solicita ningún servicio', async t => {
  const h = setup(t), event = currentEvent(false); h.setEvent(event);
  await h.save();
  assert.equal(h.serviceWrites().length, 0); assert.equal(h.eventWrites().length, 1);
  assert.equal(h.server.api.equipmentEventStore.readEvents().events.length, 1);
  assert.equal(fs.existsSync(h.server.paths.equipmentCatalogOverridesPath), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
});

test('reutilizable crea el servicio privado antes de guardar un evento y lo incorpora al selector', async t => {
  const h = setup(t), event = currentEvent(); h.setEvent(event);
  await h.save();
  const writes = h.requests.filter(request => ['POST', 'PUT'].includes(request.init.method));
  assert.equal(writes[0].url, '/api/cuadros-equipo/servicios-personalizados');
  assert.match(writes[1].url, /\/eventos\/synthetic-reusable-event$/);
  assert.equal(h.eventWrites().length, 1);
  const options = h.get('equipmentServiceSelect').options.filter(option => option.value === event.serviceTemplate.id);
  assert.equal(options.length, 1); assert.equal(options[0].text, 'Servicio reutilizable sintético');
  const actual = h.server.api.equipmentEventStore.readEvents().events[0];
  assert.equal(actual.reusableServiceId, event.serviceTemplate.id); assert.equal(actual.serviceTemplate, undefined);
  assert.equal(actual.warehouseDispatchId, 'salida-synthetic-reusable-event');
  assert.deepEqual(actual.source.rows, event.source.rows);
});

test('si falla el servicio no se escribe un evento ni se cambia el selector o inventario', async t => {
  const h = setup(t), event = currentEvent(); h.setEvent(event); h.controls.failService = true;
  await assert.rejects(h.save(), /Conflicto sintético de nuevo servicio/);
  assert.equal(h.eventWrites().length, 0); assert.equal(h.server.api.equipmentEventStore.readEvents().events.length, 0);
  assert.equal(h.get('equipmentServiceSelect').options.some(option => option.value === event.serviceTemplate.id), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
  assert.deepEqual(h.context.syntheticEvent, event);
});

test('evento fallido tras crear servicio deja mensaje claro y reintento conserva IDs sin duplicar', async t => {
  const h = setup(t), event = currentEvent(); h.setEvent(event); h.controls.failEvent = true;
  await assert.rejects(h.save(), /tipo de servicio ya quedó guardado.*Reintente Cargar; no se duplicará el servicio/);
  assert.equal(h.server.api.equipmentEventStore.readEvents().events.length, 0);
  assert.deepEqual(h.context.syntheticEvent, event);
  h.controls.failEvent = false; await h.save();
  assert.equal(h.serviceWrites().length, 2);
  assert.deepEqual(h.serviceWrites()[0].body, h.serviceWrites()[1].body);
  assert.equal(h.eventWrites()[0].body.event.id, h.eventWrites()[1].body.event.id);
  assert.equal(h.eventWrites()[0].body.event.warehouseDispatchId, h.eventWrites()[1].body.event.warehouseDispatchId);
  const catalog = JSON.parse(fs.readFileSync(h.server.paths.equipmentCatalogOverridesPath));
  assert.deepEqual(Object.keys(catalog.services), [event.serviceTemplate.id]);
  assert.equal(h.server.api.equipmentEventStore.readEvents().events.length, 1);
  await h.save();
  assert.equal(h.server.api.equipmentEventStore.readEvents().events.length, 1);
  assert.equal(h.get('equipmentServiceSelect').options.filter(option => option.value === event.serviceTemplate.id).length, 1);
});

test('plantilla guardada conserva filas, notas, celdas, cero y el ID físico homónimo exacto', async t => {
  const h = setup(t), event = currentEvent(); h.setEvent(event); await h.save();
  h.run(`resetEquipmentWindowDraft(); setEquipmentServiceSelection([syntheticEvent.serviceTemplate.id]);`);
  const source = event.serviceTemplate.mainSections;
  const result = clone(h.run('selectedEquipmentSections()'));
  const actual = result.flatMap(section => section.items).find(item => item.description === 'Consola homónima sintética');
  assert.equal(actual.quantity, 0); assert.equal(actual.warehouseInventoryId, 'physical-b');
  assert.deepEqual(actual.notes, source.flatMap(section => section.items).find(item => item.warehouseInventoryId === 'physical-b').notes);
  assert.deepEqual(actual.sourceCells, [{ ref: 'Celdas!A3', value: 0 }, { ref: 'Celdas!B3', value: 'Consola homónima sintética' }]);
  assert.deepEqual(result.filter(section => section.title !== 'Observaciones del servicio').flatMap(section => section.rows || []), source.flatMap(section => section.rows || []));
  const html = h.run('tableForEquipmentSections(selectedEquipmentSections(),false)');
  assert.match(html, /Consola homónima sintética/); assert.match(html, /Nota literal/); assert.match(html, /no mezclar consolas/);
  assert.match(html, /value="0"/);
});

test('cambiar cantidad en plantilla reutilizada conserva ID físico; cambiar descripción elimina vínculo', async t => {
  const h = setup(t), event = currentEvent(); h.setEvent(event); await h.save();
  h.run('resetEquipmentWindowDraft(); setEquipmentServiceSelection([syntheticEvent.serviceTemplate.id]); window.boundItem=selectedEquipmentSections().flatMap(section=>section.items).find(item=>item.warehouseInventoryId==="physical-b");');
  h.run('updateEquipmentItem(window.boundItem.id,"quantity","2")');
  let actual = clone(h.run('selectedEquipmentSections().flatMap(section=>section.items).find(item=>item.id===window.boundItem.id)'));
  assert.equal(actual.quantity, 2); assert.equal(actual.warehouseInventoryId, 'physical-b');
  h.run('updateEquipmentItem(window.boundItem.id,"description","Equipo distinto sintético")');
  actual = clone(h.run('selectedEquipmentSections().flatMap(section=>section.items).find(item=>item.id===window.boundItem.id)'));
  assert.equal(actual.warehouseInventoryId, undefined); assert.equal(actual.description, 'Equipo distinto sintético');
});

test('editor permanente serializa metadatos de objetos sin transformar arrays legacy ni perder sourceCells', async t => {
  const h = setup(t), event = currentEvent();
  const legacy = { id: 'legacy-section', title: 'Legacy', items: [[0, '  Equipo legacy sintético  ']], notes: ['Nota legacy'], rows: [{ type: 'note', description: 'Encabezado legacy' }] };
  event.serviceTemplate.mainSections.push(legacy); h.setEvent(event); await h.save();
  h.context.expected = clone(event.serviceTemplate.mainSections);
  const payload = clone(h.run('equipmentCatalogEditorPayload(equipmentCatalogDraftForService(syntheticEvent.serviceTemplate.id))'));
  const object = payload.mainSections.flatMap(section => section.items).find(item => !Array.isArray(item) && item.warehouseInventoryId === 'physical-b');
  assert.equal(object.quantity, 0); assert.equal(object.warehouseInventoryId, 'physical-b'); assert.equal(object.itemType, 'equipo');
  assert.deepEqual(object.notes, event.serviceTemplate.mainSections.flatMap(section => section.items).find(item => item.warehouseInventoryId === 'physical-b').notes);
  assert.deepEqual(object.sourceCells, [{ ref: 'Celdas!A3', value: 0 }, { ref: 'Celdas!B3', value: 'Consola homónima sintética' }]);
  assert.deepEqual(payload.mainSections.at(-1).items, legacy.items);
  assert.deepEqual(payload.mainSections.flatMap(section => section.rows || []), event.serviceTemplate.mainSections.flatMap(section => section.rows || []));
  assert.deepEqual(payload.mainSections.find(section => section.sourceCells)?.sourceCells, event.serviceTemplate.mainSections.find(section => section.sourceCells)?.sourceCells);
});

test('nota general del servicio aparece una vez en revisión y PDF sin modificar fuente ni cantidades', async t => {
  const h = setup(t), event = currentEvent(); h.setEvent(event); await h.save();
  h.run('resetEquipmentWindowDraft(); setEquipmentServiceSelection([syntheticEvent.serviceTemplate.id]);');
  const sections = clone(h.run('selectedEquipmentSections()'));
  const generalNotes = sections.filter(section => section.title === 'Observaciones del servicio');
  assert.equal(generalNotes.length, 1);
  assert.equal(generalNotes[0].rows[0].description, event.notes);
  const html = h.run('tableForEquipmentSections(selectedEquipmentSections(),false)');
  const pdf = h.run('tableForEquipmentSections(selectedEquipmentSections(),true)');
  assert.equal(html.split(event.notes).length - 1, 1);
  assert.equal(pdf.split(event.notes).length - 1, 1);
  const payload = clone(h.run('equipmentCatalogEditorPayload(equipmentCatalogDraftForService(syntheticEvent.serviceTemplate.id))'));
  assert.equal(payload.importSource.templateNotes, event.notes);
  assert.deepEqual(payload.mainSections.flatMap(section => section.rows || []), event.serviceTemplate.mainSections.flatMap(section => section.rows || []));
  assert.equal(payload.mainSections.some(section => section.title === 'Observaciones del servicio'), false, 'el bloque virtual no reescribe categorías de origen');
  assert.deepEqual(payload.mainSections.flatMap(section => section.items).map(item => Array.isArray(item) ? item[0] : item.quantity), event.serviceTemplate.mainSections.flatMap(section => section.items).map(item => item.quantity));
  const snapshot = clone(h.run('cloneEquipmentSnapshotSections(selectedEquipmentSections())'));
  assert.equal(snapshot.filter(section => section.title === 'Observaciones del servicio').length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
});

test('plantilla antes externa usa inventario actual al reutilizarse después del ingreso real', async t => {
  for (const choice of ['rent', 'purchase']) {
    const h = setup(t), event = currentEvent();
    const section = { id: 'external-current', title: 'Audio', items: [{ id: 'external-line', quantity: 0, description: 'Equipo externo sintético', inventoryCategory: 'Audio', itemType: 'equipo', procurementChoice: choice }], rows: [{ type: 'note', description: 'Conservar nota externa' }, { type: 'item', sourceItemIndex: 0, notes: ['Nota ligada'] }] };
    event.sections.push(clone(section)); event.serviceTemplate.mainSections.push(clone(section));
    h.setEvent(event); await h.save();
    const next = clone(stock); next.savedAt = '2026-10-20T15:00:00Z'; next.state.items.push({ id: 'new-actual-stock', name: '  EQUIPO EXTERNO SINTETICO  ', category: 'Audio', quantity: 4, itemType: 'consumible' });
    h.context.nextStock = next;
    h.run('applyEquipmentWarehouseInventoryPayload(nextStock); resetEquipmentWindowDraft(); setEquipmentServiceSelection([syntheticEvent.serviceTemplate.id]);');
    const actual = clone(h.run('selectedEquipmentSections().flatMap(section=>section.items).find(item=>item.description==="Equipo externo sintético")'));
    assert.equal(actual.warehouseInventoryId, 'new-actual-stock', choice);
    assert.equal(actual.procurementChoice, undefined); assert.equal(actual.itemType, 'consumible'); assert.equal(actual.quantity, 0);
    assert.equal(actual.procurementPreference, choice === 'purchase' ? 'purchase' : undefined);
    assert.equal(h.context.syntheticEvent.serviceTemplate.mainSections.at(-1).items[0].procurementChoice, choice);
    assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
  }
});

test('vínculo nuevo exige nombre exacto y conserva homónimos físicos ambiguos e IDs originales', t => {
  const h = setup(t);
  const next = clone(stock); next.savedAt = '2026-10-20T15:00:00Z';
  next.state.items.push({ id: 'unique-organized', name: 'Equipo único sintético', category: 'Nueva organización', quantity: 2, itemType: 'equipo' },
    { id: 'category-a', name: 'Equipo por categoría', category: 'Audio', quantity: 1, itemType: 'equipo' },
    { id: 'category-b', name: 'Equipo por categoría', category: 'Luces', quantity: 1, itemType: 'equipo' },
    { id: 'model-x2', name: 'Modelo sintético X2', category: 'Audio', aliases: ['Modelo sintético X'], quantity: 5, itemType: 'equipo' });
  h.context.nextStock = next; h.run('applyEquipmentWarehouseInventoryPayload(nextStock)');
  const metadata = (raw, section = { title: 'Audio', importSource: { personalized: true } }) => {
    h.context.testRaw = clone(raw); h.context.testSection = clone(section);
    return clone(h.run('equipmentReusableTemplateItemMetadata(testRaw,testSection)'));
  };
  const raw = { quantity: 0, description: '  EQUIPO UNICO SINTETICO  ', inventoryCategory: 'Audio', procurementChoice: 'rent' };
  assert.equal(metadata(raw).warehouseInventoryId, 'unique-organized', 'un nombre único puede cambiar de categoría organizativa');
  assert.equal(metadata({ ...raw, description: 'Equipo por categoría' }).warehouseInventoryId, 'category-a');
  assert.equal(metadata({ ...raw, description: 'Consola homónima sintética' }).warehouseInventoryId, undefined, 'dos registros en la misma categoría siguen ambiguos');
  for (const description of ['Modelo sintético X', 'Modelo sintético X2.', 'Equipo por categoria!']) {
    const result = metadata({ ...raw, description });
    assert.equal(result.warehouseInventoryId, undefined, description); assert.equal(result.procurementChoice, 'rent');
  }
  const retired = { ...raw, warehouseInventoryId: 'removed-physical-record' };
  assert.deepEqual(metadata(retired), { warehouseInventoryId: 'removed-physical-record', inventoryCategory: 'Audio', procurementChoice: 'rent' });
  assert.deepEqual(metadata(raw, { title: 'Audio' }), { inventoryCategory: 'Audio', procurementChoice: 'rent' });
  assert.deepEqual(raw, { quantity: 0, description: '  EQUIPO UNICO SINTETICO  ', inventoryCategory: 'Audio', procurementChoice: 'rent' });
  assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
});

test('compra parcial reutilizada cuenta stock actual y sólo compra el faltante; renta usa el faltante', t => {
  const h = setup(t), event = currentEvent(false);
  for (const choice of ['purchase', 'rent']) for (const available of [0, 1, 2, 3]) {
    const next = clone(stock); next.savedAt = `2026-10-20T${15 + available}:00:00Z`;
    next.state.items.push({ id: 'current-external', name: 'Equipo externo actual', category: 'Audio', quantity: available, itemType: 'equipo' });
    h.context.nextStock = next; h.run('applyEquipmentWarehouseInventoryPayload(nextStock)');
    h.context.testSection = { title: 'Audio', importSource: { personalized: true }, items: [{ quantity: 2, description: 'Equipo externo actual', procurementChoice: choice }] };
    const items = clone(h.run('editableEquipmentItems(testSection,"test-current")'));
    const planned = calculateEquipmentAvailability([{ ...event, sections: [{ id: 'current-section', title: 'Audio', items }] }], next, { now: Date.parse('2026-10-20T12:00:00Z') });
    const row = planned.rows.find(row => row.warehouseInventoryId === 'current-external');
    assert.ok(row); assert.equal(row.required, 2); assert.equal(row.available, available);
    assert.equal(row.missing, Math.max(0, 2 - available));
    assert.equal(row.action, available >= 2 ? 'DISPONIBLE' : choice === 'purchase' ? 'COMPRA' : 'RENTA');
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
});

test('snapshot guardado conserva renta original; nueva selección explícita usa inventario con evento activo', async t => {
  const h = setup(t), event = currentEvent();
  const section = { id: 'snapshot-external', title: 'Audio', items: [{ id: 'snapshot-line', quantity: 1, description: 'Equipo snapshot sintético', procurementChoice: 'rent' }], rows: [{ type: 'note', description: 'Nota de snapshot inalterable' }] };
  event.sections.push(clone(section)); event.serviceTemplate.mainSections.push(clone(section));
  h.setEvent(event); await h.save();
  const saved = clone(h.server.api.equipmentEventStore.readEvents().events[0]); assert.equal(saved.snapshotLocked, true);
  const next = clone(stock); next.savedAt = '2026-10-20T15:00:00Z'; next.state.items.push({ id: 'snapshot-current-id', name: 'Equipo snapshot sintético', category: 'Audio', quantity: 2, itemType: 'equipo' });
  h.context.nextStock = next; h.context.savedSnapshot = saved;
  h.run('applyEquipmentWarehouseInventoryPayload(nextStock);restoreEquipmentEventSnapshot(savedSnapshot)');
  let actual = clone(h.run('selectedEquipmentSections().flatMap(section=>section.items).filter(item=>item.description==="Equipo snapshot sintético")'));
  assert.equal(actual.length, 1); assert.equal(actual[0].procurementChoice, 'rent'); assert.equal(actual[0].warehouseInventoryId, undefined);
  h.run('setEquipmentServiceSelection([syntheticEvent.serviceTemplate.id])');
  actual = clone(h.run('selectedEquipmentSections().flatMap(section=>section.items).filter(item=>item.description==="Equipo snapshot sintético")'));
  assert.ok(actual.some(item => item.warehouseInventoryId === 'snapshot-current-id' && !item.procurementChoice), 'seleccionar plantilla nueva resuelve stock aunque el evento guardado siga activo');
  assert.ok(actual.some(item => item.procurementChoice === 'rent' && !item.warehouseInventoryId), 'el snapshot original no se reescribe');
  assert.deepEqual(h.server.api.equipmentEventStore.readEvents().events[0].sections, saved.sections);
  assert.deepEqual(JSON.parse(fs.readFileSync(h.server.paths.warehouseInventoryPath)), stock);
});
