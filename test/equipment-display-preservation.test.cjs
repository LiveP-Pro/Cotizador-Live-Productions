const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function harness() {
  const context = vm.createContext({
    window: { requerimientoEquipoCatalog: { services: {}, groups: [] } },
    document: { querySelector() { return null; }, addEventListener() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'equipment.js'), 'utf8'), context);
  return { context, run: (code) => vm.runInContext(code, context) };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

test('display grouping preserves every original fragment, distinct equipment and source object', () => {
  const h = harness();
  const sections = [
    { id: 'lights-a', title: 'ILUMINACION / LUCES A', importSource: { authoritative: true }, items: [{ id: 'lamp-a', quantity: 0, description: 'Lámpara modelo A' }] },
    { id: 'audio', title: 'AUDIO', importSource: { authoritative: true }, items: [{ id: 'audio-a', quantity: 2, description: 'Bocina prueba' }] },
    { id: 'manual-lights', title: 'ILUMINACION', manualSection: true, items: [{ id: 'lamp-b', quantity: 1, description: 'Lámpara modelo B', editable: true }] },
    { id: 'doc-lights', title: 'LUCES', documentSection: true, items: [{ id: 'lamp-c', quantity: 3, description: 'Lámpara modelo C', editable: true }] }
  ];
  const original = JSON.stringify(sections);
  h.context.source = deepFreeze(sections);
  const groups = h.run('equipmentDisplaySectionGroups(source)');
  assert.deepEqual(Array.from(groups, (g) => g.title), ['ILUMINACION / LUCES A', 'ILUMINACION', 'LUCES', 'AUDIO']);
  assert.deepEqual(Array.from(groups.flatMap((g) => g.sections), (s) => s.id), ['lights-a', 'manual-lights', 'doc-lights', 'audio']);
  const actual = Array.from(groups.flatMap((g) => g.sections.flatMap((s) => s.items)), (i) => [i.id, i.quantity, i.description]);
  assert.deepEqual(actual, [['lamp-a', 0, 'Lámpara modelo A'], ['lamp-b', 1, 'Lámpara modelo B'], ['lamp-c', 3, 'Lámpara modelo C'], ['audio-a', 2, 'Bocina prueba']]);
  assert.equal(JSON.stringify(sections), original);
});

test('repeated subtype labels join their unique current parent but ambiguous labels stay separate', () => {
  const h = harness();
  h.context.source = [
    { id: 's1', title: 'ESTRUCTURAS / SOPORTE PRUEBA', items: [] },
    { id: 's2', title: 'AUDIO', items: [] },
    { id: 's3', title: 'SOPORTE PRUEBA', documentSection: true, items: [] }
  ];
  assert.deepEqual(Array.from(h.run('equipmentDisplaySectionGroups(source)'), (g) => g.title), ['ESTRUCTURAS / SOPORTE PRUEBA', 'SOPORTE PRUEBA', 'AUDIO']);
  h.context.source = [
    { id: 's1', title: 'ESTRUCTURAS / SOPORTE PRUEBA', items: [] },
    { id: 's2', title: 'AUDIO / SOPORTE PRUEBA', items: [] },
    { id: 's3', title: 'SOPORTE PRUEBA', documentSection: true, items: [] }
  ];
  assert.deepEqual(Array.from(h.run('equipmentDisplaySectionGroups(source)'), (g) => g.title), ['ESTRUCTURAS / SOPORTE PRUEBA', 'AUDIO / SOPORTE PRUEBA', 'SOPORTE PRUEBA']);
});

test('expanded category actions retain source section and item IDs after grouping', () => {
  const h = harness();
  h.context.source = [
    { id: 'source-a', title: 'LUCES', importSource: { authoritative: true }, items: [{ id: 'light-0', quantity: 0, description: 'Equipo A', editable: true }] },
    { id: 'source-b', title: 'AUDIO', importSource: { authoritative: true }, items: [{ id: 'audio-2', quantity: 2, description: 'Equipo B', editable: true }] },
    { id: 'source-c', title: 'LUCES', importSource: { authoritative: true }, items: [{ id: 'light-3', quantity: 3, description: 'Equipo C', editable: true }] },
    { id: 'manual-source', title: 'LUCES', manualSection: true, items: [{ id: 'manual-1', quantity: 1, description: 'Equipo D', editable: true, manual: true }] }
  ];
  h.run('equipmentDisplaySectionGroups(source).forEach(group => equipmentState.expandedEquipmentSectionIds.add(group.id))');
  const html = h.run('tableForEquipmentSections(source)');
  for (const id of ['light-0', 'audio-2', 'light-3', 'manual-1']) {
    assert.equal((html.match(new RegExp(`data-remove-equipment-item="${id}"`, 'g')) || []).length, 1);
    assert.equal((html.match(new RegExp(`data-equipment-item-id="${id}" data-equipment-field="quantity"`, 'g')) || []).length, 1);
  }
  assert.match(html, /data-equipment-category-add="source-a"/);
  assert.match(html, /data-equipment-category-add="source-b"/);
  assert.match(html, /data-equipment-category-add="manual-source"/);
  assert.match(html, /data-equipment-manual-section-title="manual-source"/);
  assert.match(html, /data-remove-equipment-section="manual-source"/);
  assert.match(html, /value="0"/);
});

test('white-row suppression never hides notes, numeric source cells or distinct headings', () => {
  const h = harness();
  const rows = [
    { type: 'category', description: 'LUCES', notes: ['Conservar esta nota'] },
    { type: 'heading', description: 'LUCES', cells: [{ value: 'LUCES' }, { value: 0 }] },
    { type: 'heading', description: 'LUCES', cells: [{ value: 'LUCES' }, { value: 'Observación adicional' }] },
    { type: 'note', description: 'LUCES' },
    { type: 'category', description: 'LUCES MODELO ESPECIAL' }
  ];
  rows.forEach((row) => {
    h.context.row = row;
    assert.equal(h.run('equipmentSourceHeadingRepeatsDisplayTitle(row, "LUCES")'), false);
  });
  h.context.row = { type: 'category', description: ' luces ', cells: [{ value: 'Luces' }] };
  assert.equal(h.run('equipmentSourceHeadingRepeatsDisplayTitle(row, "ILUMINACION / LUCES")'), true);
});

test('preview retains zero quantities, observations and one original-file link across merged fragments', () => {
  const h = harness();
  const source = { authoritative: true, fileName: 'Sintético.xlsx', sourceFileUrl: '/synthetic-upload/only' };
  h.context.source = [
    { id: 'a', title: 'LUCES', importSource: source, items: [[0, 'Modelo A']], rows: [
      { type: 'category', description: 'LUCES', cells: [{ value: 'LUCES' }] },
      { type: 'item', description: 'Modelo A', quantity: 0, notes: ['Nota de A'], cells: [{ value: 0 }, { value: 'Modelo A' }] },
      { type: 'note', description: 'Instrucción adicional' }
    ] },
    { id: 'b', title: 'LUCES', importSource: source, items: [[2, 'Modelo B']], notes: ['Nota de B'] }
  ];
  const html = h.run('tableForEquipmentSections(source, true)');
  for (const text of ['Modelo A', 'Modelo B', 'Nota de A', 'Nota de B', 'Instrucción adicional']) assert.match(html, new RegExp(text));
  assert.match(html, /quantity-cell">0<\/td>/);
  assert.equal((html.match(/Archivo original:/g) || []).length, 1);
  assert.equal((html.match(/data-source-row-type="category"/g) || []).length, 0);
  assert.equal((html.match(/class="equipment-category-row"/g) || []).length, 1);
});
