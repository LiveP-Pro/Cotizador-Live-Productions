const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function harness() {
  class Option {
    constructor(text, value, defaultSelected, selected) {
      Object.assign(this, { text, value, defaultSelected: !!defaultSelected, selected: !!selected });
    }
  }
  const element = () => ({
    value: '', textContent: '', innerHTML: '', dataset: {},
    classList: { toggle() {}, add() {}, remove() {} },
    setAttribute() {}, addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }
  });
  const select = {
    ...element(),
    multiple: true, options: [],
    replaceChildren() { this.options = []; },
    add(option) { this.options.push(option); },
    append(group) { this.options.push(...group.children); },
    get selectedOptions() { return this.options.filter(option => option.selected); }
  };
  // These hosts capture the real render output; renderEquipmentModule is never replaced.
  const nodes = Object.fromEntries([
    'EventPlace', 'EventName', 'EventSetupAt', 'EventDate', 'EventInAt',
    'EventResponsible', 'Notes', 'MainTable', 'PdfMainTable', 'PdfTitle',
    'PdfPlace', 'PdfDate', 'PdfNotes', 'SaveStatus', 'EventsList', 'SaveWindowButton',
    'AddEventButton', 'NewWindowButton'
  ].map(name => [`#equipment${name}`, element()]));
  nodes['#equipmentServiceSelect'] = select;
  const context = vm.createContext({
    window: {
      requerimientoEquipoCatalog: {
        version: 'synthetic-window-lifecycle',
        services: {
          'fixture-lights': { name: 'Fixture lights', mainSections: [{ title: 'LUCES', items: [[0, 'Fixture zero light'], [2, 'Fixture model A']] }] },
          'fixture-sound': { name: 'Fixture sound', mainSections: [{ title: 'AUDIO', items: [[3, 'Fixture model B']] }] }
        },
        groups: [{ id: 'fixtures', label: 'Fixtures', serviceIds: ['fixture-lights', 'fixture-sound'] }]
      },
      setTimeout() { return 1; }
    },
    document: {
      querySelector(selector) { return nodes[selector] || null; },
      querySelectorAll() { return []; },
      addEventListener() {},
      createElement() { return { children: [], append(option) { this.children.push(option); } }; }
    },
    Option
  });
  const run = code => vm.runInContext(code, context);
  const sourcePath = process.env.EQUIPMENT_LIFECYCLE_SOURCE || path.join(__dirname, '..', 'equipment.js');
  run(fs.readFileSync(sourcePath, 'utf8'));
  run('populateNativeEquipmentServiceSelect()');
  function eventFields(place = 'Fixture venue') {
    nodes['#equipmentEventPlace'].value = place;
    nodes['#equipmentEventName'].value = 'Fixture event';
    nodes['#equipmentEventSetupAt'].value = '2026-11-05T07:00';
    nodes['#equipmentEventDate'].value = '2026-11-05';
    nodes['#equipmentEventInAt'].value = '2026-11-06T01:00';
  }
  function items() {
    return JSON.parse(run('JSON.stringify(selectedEquipmentSections().flatMap(section => section.items.map(item => [item.quantity, item.description])))'));
  }
  return { run, nodes, select, eventFields, items };
}


// The following fixtures are synthetic. No source catalog, inventory or saved
// production event is used to test window metadata and undo isolation.
function saveWindow(h, place, note, serviceId = 'fixture-lights') {
  h.eventFields(place);
  h.nodes['#equipmentNotes'].value = note;
  h.run(`setEquipmentServiceSelection([${JSON.stringify(serviceId)}]); saveCurrentEquipmentWindow()`);
  return h.run('equipmentState.selectedEventId');
}

function openWindow(h, id) {
  h.run(`loadEquipmentEvent(${JSON.stringify(id)})`);
}

test('observations survive Nueva ventana and restoring the saved window without trimming', () => {
  const h = harness();
  const first = saveWindow(h, 'Fixture first', '  Fixture note A\nSecond line  ');
  h.run('startNewEquipmentWindowDraft()');
  assert.equal(h.nodes['#equipmentNotes'].value, '');
  openWindow(h, first);
  assert.equal(h.nodes['#equipmentNotes'].value, '  Fixture note A\nSecond line  ');
  assert.equal(h.nodes['#equipmentPdfNotes'].textContent, 'Fixture note A\nSecond line');
  assert.equal(h.run('selectedEquipmentEvent().notes'), '  Fixture note A\nSecond line  ');
});

test('switching windows saves each latest note and renders only the selected event note', () => {
  const h = harness();
  const first = saveWindow(h, 'Fixture first', 'Fixture note A');
  h.run('startNewEquipmentWindowDraft()');
  const second = saveWindow(h, 'Fixture second', 'Fixture note B', 'fixture-sound');
  h.nodes['#equipmentNotes'].value = 'Fixture note B edited';
  openWindow(h, first);
  assert.equal(h.nodes['#equipmentNotes'].value, 'Fixture note A');
  assert.equal(h.nodes['#equipmentPdfNotes'].textContent, 'Fixture note A');
  h.nodes['#equipmentNotes'].value = 'Fixture note A edited';
  openWindow(h, second);
  assert.equal(h.nodes['#equipmentNotes'].value, 'Fixture note B edited');
  assert.equal(h.nodes['#equipmentPdfNotes'].textContent, 'Fixture note B edited');
  openWindow(h, first);
  assert.equal(h.nodes['#equipmentNotes'].value, 'Fixture note A edited');
});

test('sidebar PDF action captures the requested window notes instead of the open window notes', async () => {
  const h = harness();
  const first = saveWindow(h, 'Fixture first', 'Fixture note A');
  h.run('startNewEquipmentWindowDraft()');
  saveWindow(h, 'Fixture second', 'Fixture note B', 'fixture-sound');
  h.run('saveEquipmentPdf = async function() { window.syntheticPdfEvent = currentEquipmentEditableEvent(); }');
  await h.run(`saveEquipmentEventPdf(${JSON.stringify(first)})`);
  assert.equal(h.run('window.syntheticPdfEvent.notes'), 'Fixture note A');
  assert.equal(h.run('window.syntheticPdfEvent.place'), 'Fixture first');
  assert.equal(h.nodes['#equipmentPdfNotes'].textContent, 'Fixture note A');
});

test('editable JSON round trip retains distinct notes and an intentionally empty event note', () => {
  const h = harness();
  saveWindow(h, 'Fixture first', 'Fixture note A');
  h.run('startNewEquipmentWindowDraft()');
  saveWindow(h, 'Fixture second', '', 'fixture-sound');
  const payload = h.run('JSON.stringify(equipmentEditablePayload("rent"))');
  const saved = JSON.parse(payload);
  assert.deepEqual(saved.events.map(event => event.notes), ['Fixture note A', '']);
  h.run(`importEquipmentEditablePayload(${payload})`);
  const ids = JSON.parse(h.run('JSON.stringify(equipmentState.events.map(event => event.id))'));
  openWindow(h, ids[0]);
  assert.equal(h.nodes['#equipmentNotes'].value, 'Fixture note A');
  openWindow(h, ids[1]);
  assert.equal(h.nodes['#equipmentNotes'].value, '');
  assert.equal(h.nodes['#equipmentPdfNotes'].textContent, '');
});

test('legacy editable notes are retained while an explicit per-event empty note wins', () => {
  const h = harness();
  const payload = {
    type: 'live-productions-equipment-requirement', notes: 'Legacy common note',
    summaryTransferAutomatic: false,
    events: [
      { id: 'legacy-a', name: 'Legacy A', date: '2026-11-05', serviceId: 'fixture-lights' },
      { id: 'legacy-b', name: 'Legacy B', date: '2026-11-06', serviceId: 'fixture-sound', notes: '' }
    ]
  };
  h.run(`importEquipmentEditablePayload(${JSON.stringify(payload)})`);
  assert.equal(h.nodes['#equipmentNotes'].value, 'Legacy common note');
  const ids = JSON.parse(h.run('JSON.stringify(equipmentState.events.map(event => event.id))'));
  openWindow(h, ids[1]);
  assert.equal(h.nodes['#equipmentNotes'].value, '');
  openWindow(h, ids[0]);
  assert.equal(h.nodes['#equipmentNotes'].value, 'Legacy common note');
});

test('undo of a removed source row remains local to its window and retains quantity zero', () => {
  const h = harness();
  const first = saveWindow(h, 'Fixture first', 'A');
  h.run('startNewEquipmentWindowDraft()');
  const second = saveWindow(h, 'Fixture second', 'B');
  openWindow(h, first);
  h.run('removeManualEquipmentItem(selectedEquipmentSections()[0].items[0].id)');
  assert.deepEqual(h.items(), [[2, 'Fixture model A']]);
  openWindow(h, second);
  h.run('restoreLastDeletedEquipment()');
  assert.equal(h.items().length, 2);
  openWindow(h, first);
  h.run('restoreLastDeletedEquipment()');
  assert.deepEqual(h.items(), [[0, 'Fixture zero light'], [2, 'Fixture model A']]);
});

test('undo cannot insert another window manual equipment into the active window', () => {
  const h = harness();
  const first = saveWindow(h, 'Fixture first', 'A');
  h.run('startNewEquipmentWindowDraft()');
  const second = saveWindow(h, 'Fixture second', 'B', 'fixture-sound');
  openWindow(h, first);
  h.run("equipmentState.manualMainItems.push({ id: 'manual-first-only', quantity: 4, description: 'Fixture first manual' }); removeManualEquipmentItem('manual-first-only')");
  openWindow(h, second);
  h.run('restoreLastDeletedEquipment()');
  assert.deepEqual(h.items(), [[3, 'Fixture model B']]);
  openWindow(h, first);
  h.run('restoreLastDeletedEquipment()');
  assert.deepEqual(h.items().at(-1), [4, 'Fixture first manual']);
  openWindow(h, second);
  assert.deepEqual(h.items(), [[3, 'Fixture model B']]);
});

test('fresh startup applies retired service IDs without reviving their base equipment', () => {
  const h = harness();
  h.run("applyEquipmentCatalogOverrides({ baseCatalogVersion: 'synthetic-window-lifecycle', services: {}, removedServiceIds: ['fixture-lights'] }); populateNativeEquipmentServiceSelect()");
  assert.deepEqual(h.select.options.map(option => option.value).filter(Boolean), ['fixture-sound']);
  assert.equal(h.run("Object.hasOwn(equipmentServices, 'fixture-lights')"), false);
  h.run("setEquipmentServiceSelection(['fixture-lights'])");
  assert.deepEqual(h.items(), []);
});
