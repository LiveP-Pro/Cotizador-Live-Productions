const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Planner = require('../equipment-planner.js');
const plain = value => JSON.parse(JSON.stringify(value));

// Deliberately synthetic: these references do not copy a current or historical
// equipment catalog, inventory, saved event, or workbook.
function inventory() {
  return Array.from({ length: 274 }, (_, index) => ({
    id: `synthetic-${index + 1}`,
    item: { id: `synthetic-${index + 1}`, name: `Equipo sintético ${index + 1}`, category: 'Categoría sintética', itemType: 'equipo' },
    available: 1
  }));
}

test('initial reference options are bounded and every current reference remains reachable by its name or category', () => {
  const records = inventory(), before = JSON.stringify(records);
  const initial = Planner.referenceChoices(records);
  assert.equal(initial.records.length, 20); assert.equal(initial.total, 274); assert.equal(initial.matched, 274);
  assert.equal(initial.suggested, false);
  const last = Planner.referenceChoices(records, '  EQUIPO SINTETICO   274  ');
  assert.deepEqual(last.records.map(record => record.id), ['synthetic-274']);
  assert.equal(last.matched, 1); assert.equal(last.total, 274);
  const category = Planner.referenceChoices(records, 'CATEGORIA SINTETICA');
  assert.equal(category.records.length, 20); assert.equal(category.matched, 274);
  assert.equal(Planner.referenceChoices(records, 'no existe esta referencia').records.length, 0);
  assert.equal(JSON.stringify(records), before);
});

test('only up to eight current suggestions are offered; archived and invented candidate IDs never become options', () => {
  const records = inventory(); records[0].item.archived = true;
  records.push({ id: 'archived-wrapper', archived: true, item: { name: 'Referencia archivada' } });
  records.push({ id: '', item: { name: 'Referencia sin ID' } });
  const candidates = [...records.slice(0, 13).map(record => ({ id: record.id })), { id: 'invented-id' }];
  const initial = Planner.referenceChoices(records, '', candidates);
  assert.equal(initial.suggested, true); assert.equal(initial.records.length, 8); assert.equal(initial.total, 273);
  assert.ok(initial.records.every(record => records.includes(record) && record.id !== 'synthetic-1'));
  assert.equal(Planner.referenceChoices(records, 'Equipo sintético 1').records.some(record => record.id === 'synthetic-1'), false);
  assert.deepEqual(Planner.referenceChoices(records, '', [{ id: 'invented-id' }, { id: 'synthetic-1' }]).records.map(record => record.id), records.slice(1, 21).map(record => record.id));
});

function browser() {
  const nodes = new Map(), selected = { value: '', innerHTML: '' }, count = { textContent: '' };
  const search = { value: '', dataset: { plannerReferenceSearch: '0' }, addEventListener(name, fn) { this[name] = fn; } };
  const bind = { dataset: { plannerBind: '0' }, addEventListener(name, fn) { this[name] = fn; } };
  const pending = {
    _html: '',
    set innerHTML(value) { this._html = value; selected.innerHTML = /<select[^>]*data-planner-identity="0"[^>]*>([\s\S]*?)<\/select>/.exec(value)?.[1] || ''; },
    get innerHTML() { return this._html; },
    querySelector(selector) { return selector === '[data-planner-identity="0"]' ? selected : selector === '[data-planner-reference-count="0"]' ? count : null; },
    querySelectorAll(selector) { return selector === '[data-planner-reference-search]' ? [search] : selector === '[data-planner-bind]' ? [bind] : []; }
  };
  nodes.set('#equipmentPlannerOverview', { innerHTML: '' }); nodes.set('#equipmentPlannerPending', pending); nodes.set('#equipmentPlannerStatus', { textContent: '' });
  const confirmations = [];
  const context = vm.createContext({ document: { querySelector: selector => nodes.get(selector) || null, querySelectorAll: () => [] } });
  context.window = context; context.confirm = message => { confirmations.push(message); return false; };
  for (const name of ['equipment-identity.js', 'equipment-document-audit.js', 'equipment-planner.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', name), 'utf8'), context, { filename: name });
  return { context, nodes, selected, count, search, bind, pending, confirmations };
}

test('typing only updates bounded reference choices; linking still requires a manual selection and explicit confirmation', () => {
  const b = browser(); let records = inventory(); const bindings = [];
  const events = [{ id: 'synthetic-event', place: 'Sitio sintético', date: '2026-11-05', sections: [{ title: 'Sin categoría conocida', items: [{ quantity: 3, description: 'Referencia sin coincidencias', sourceCells: [{ ref: 'synthetic:B7', value: 'Referencia sin coincidencias' }] }] }] }];
  const before = JSON.stringify(events);
  b.context.EquipmentPlanner.create({ events: () => events, inventory: () => records, bindIdentity: (sources, id) => bindings.push({ sources: plain(sources), id }) }).render();
  assert.equal((b.selected.innerHTML.match(/<option/g) || []).length, 21);
  assert.doesNotMatch(b.selected.innerHTML, /\bselected\b/); assert.equal(b.selected.value, '');
  b.bind.click(); assert.equal(b.confirmations.length, 0); assert.equal(bindings.length, 0);
  b.search.value = 'Equipo sintético 274'; b.search.input();
  assert.equal((b.selected.innerHTML.match(/<option/g) || []).length, 2);
  assert.match(b.selected.innerHTML, /value="synthetic-274"/); assert.match(b.count.textContent, /1 de 1 coincidencias/);
  assert.equal(b.selected.value, ''); assert.equal(bindings.length, 0); assert.equal(b.confirmations.length, 0);
  b.selected.value = 'synthetic-274'; b.bind.click();
  assert.equal(bindings.length, 0); assert.equal(b.confirmations.length, 1); assert.match(b.confirmations[0], /Referencia sin coincidencias.*Equipo sintético 274/);
  b.context.confirm = () => true; b.bind.click();
  assert.equal(bindings.length, 1); assert.equal(bindings[0].id, 'synthetic-274'); assert.deepEqual(bindings[0].sources[0].sourceCells, events[0].sections[0].items[0].sourceCells);
  records = records.map(record => record.id === 'synthetic-274' ? { ...record, item: { ...record.item, archived: true } } : record);
  b.bind.click(); assert.equal(bindings.length, 1); assert.match(b.nodes.get('#equipmentPlannerStatus').textContent, /ya no está disponible/);
  b.search.input(); assert.equal((b.selected.innerHTML.match(/<option/g) || []).length, 1); assert.equal(b.selected.value, '');
  assert.equal(JSON.stringify(events), before);
});
