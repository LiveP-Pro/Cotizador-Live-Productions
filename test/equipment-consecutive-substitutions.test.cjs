'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Changes = require('../equipment-draft-substitutions.js');
const copy = value => JSON.parse(JSON.stringify(value));
function fixture() {
  const cells = [{ address: 'A1', value: 0, note: '  Literal  ' }, { address: 'B1', value: 'Descripción original' }];
  const events = [{ id: 'event-original', status: 'draft', name: 'Nombre variable', sourceCells: copy(cells),
    sourceImport: { fileName: 'Fuente sintética actual.xlsx', sourceCells: copy(cells) }, notes: '  Nota completa  ',
    sections: [{ id: 'section-1', title: 'Categoría original', notes: ['  Otra nota  '], sourceCells: copy(cells),
      rows: [{ type: 'note', description: 'Encabezado literal' }, { type: 'item', sourceItemIndex: 0, cells: copy(cells) }, { type: 'item', sourceItemIndex: 1 }],
      items: [{ id: 'line-1', description: 'Equipo modelo A', quantity: 1, warehouseInventoryId: 'model-a', sourceCells: copy(cells), procurementChoice: 'rent' },
        { id: 'line-zero', description: 'Cero literal', quantity: 0 }] }] }];
  const inventory = { state: { items: [
    { id: 'model-a', name: 'Equipo modelo A', category: 'A', itemType: 'equipo', quantity: 1 },
    { id: 'model-b', name: 'Equipo modelo B', category: 'B', itemType: 'equipo', quantity: 2 },
    { id: 'supply', name: 'Insumo sintético', category: 'Pruebas', itemType: 'consumible', quantity: 20 },
    { id: 'old', name: 'Archivado', archived: true, quantity: 1 }
  ], movements: [] } };
  const change = { eventId: 'event-original', sectionIndex: 0, itemIndex: 0, replacementInventoryId: 'model-b',
    quantity: 1, compatibilityConfirmed: true, reason: 'Compatibilidad revisada para este evento y mismo kit de mañana.' };
  return { events, inventory, change };
}
test('una sustitución explícita conserva todas las celdas, ceros, notas y orden de la fuente', () => {
  const { events, inventory, change } = fixture(), beforeEvents = JSON.stringify(events), beforeStock = JSON.stringify(inventory);
  const result = Changes.replace(events, change, inventory), event = result[0];
  assert.equal(JSON.stringify(events), beforeEvents); assert.equal(JSON.stringify(inventory), beforeStock);
  assert.deepEqual(event.sourceCells, events[0].sourceCells); assert.deepEqual(event.sourceImport, events[0].sourceImport);
  assert.deepEqual(event.sections[0].rows, events[0].sections[0].rows);
  assert.deepEqual(event.sections[0].sourceCells, events[0].sections[0].sourceCells);
  assert.deepEqual(event.sections[0].notes, events[0].sections[0].notes);
  assert.equal(event.sections[0].items[1].quantity, 0); assert.equal(event.notes, events[0].notes);
  assert.equal(event.sections[0].items[0].description, 'Equipo modelo B');
  assert.equal(event.sections[0].items[0].warehouseInventoryId, 'model-b');
  assert.equal(event.sections[0].items[0].procurementChoice, undefined);
  assert.deepEqual(event.planEquipmentChanges[0].before, events[0].sections[0].items[0]);
  assert.equal(event.planEquipmentChanges[0].operation.compatibilityConfirmed, true);
  assert.deepEqual(Changes.validatePatch(events[0], event, inventory).sections, event.sections);
});
test('nombres similares nunca cambian equipo sin confirmación técnica y selección de referencia', () => {
  const { events, inventory, change } = fixture();
  for (const invalid of [{ compatibilityConfirmed: false }, { replacementInventoryId: '' }, { replacementInventoryId: 'missing' }, { reason: '' }]) {
    assert.throws(() => Changes.replace(events, { ...change, ...invalid }, inventory), /Confirme|Seleccione|motivo/);
  }
  assert.equal(events[0].sections[0].items[0].warehouseInventoryId, 'model-a');
});
test('consumibles, archivo y cantidades inválidas no se convierten en equipo para trasiego', () => {
  const { events, inventory, change } = fixture();
  assert.deepEqual(Changes.options(inventory).map(item => item.id).sort(), ['model-a', 'model-b']);
  for (const id of ['supply', 'old']) assert.throws(() => Changes.replace(events, { ...change, replacementInventoryId: id }, inventory), /reutilizable/);
  for (const quantity of ['', null, 0, -1, Infinity]) assert.throws(() => Changes.replace(events, { ...change, quantity }, inventory), /cantidad/);
  assert.throws(() => Changes.replace(events, { ...change, itemIndex: 1 }, inventory), /cero|positiva/);
  events[0].sections[0].items[0].warehouseInventoryId = 'supply';
  assert.throws(() => Changes.replace(events, change, inventory), /consumible/);
});
test('cambio de origen o pérdida de una celda invalida el parche completo', () => {
  const { events, inventory, change } = fixture(), result = Changes.replace(events, change, inventory)[0];
  const stale = copy(events[0]); stale.sections[0].items[0].quantity = 2;
  assert.throws(() => Changes.validatePatch(stale, result, inventory), /original cambió/);
  const omitted = copy(result); omitted.sections[0].sourceCells = [];
  assert.throws(() => Changes.validatePatch(events[0], omitted, inventory), /otros cambios/);
  const deleted = copy(result); deleted.sections[0].items.pop();
  assert.throws(() => Changes.validatePatch(events[0], deleted, inventory), /otros cambios/);
});
test('historial de revisiones conserva cada sustitución y permite reabrir sin cambios', () => {
  const { events, inventory, change } = fixture();
  const first = Changes.replace(events, change, inventory)[0];
  const second = Changes.replace([first], { ...change, replacementInventoryId: 'model-a', reason: 'Revisión manual posterior.' }, inventory)[0];
  assert.equal(second.planEquipmentChanges.length, 2);
  assert.deepEqual(Changes.validatePatch(events[0], second, inventory).sections, second.sections);
  assert.deepEqual(Changes.validatePatch(second, second, inventory), {});
  const tampered = copy(second); tampered.planEquipmentChanges[0].before.quantity = 999;
  assert.throws(() => Changes.validatePatch(first, tampered, inventory), /historial/);
});
test('falta de existencia se muestra pendiente sin inventar ingresos ni equivalencias', () => {
  const { events, inventory, change } = fixture();
  const result = Changes.replace(events, { ...change, quantity: 3 }, inventory)[0];
  assert.equal(result.planEquipmentChanges[0].availableAtReview, 2);
  assert.equal(result.planEquipmentChanges[0].pendingAvailability, true);
  assert.equal(inventory.state.items.find(item => item.id === 'model-b').quantity, 2);
  assert.equal(inventory.state.items.find(item => item.id === 'model-b').approvedDescriptionAliases, undefined);
});
test('eventos confirmados no alteran silenciosamente sus reservas desde el editor provisional', () => {
  const { events, inventory, change } = fixture(); events[0].status = 'confirmed';
  assert.throws(() => Changes.replace(events, change, inventory), /flujo de revisión/);
});
