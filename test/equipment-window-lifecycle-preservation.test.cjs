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
    'PdfPlace', 'PdfDate', 'SaveStatus', 'EventsList', 'SaveWindowButton',
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

const originalItems = [[0, 'Fixture zero light'], [2, 'Fixture model A'], [3, 'Fixture model B']];

test('adding a multiservice window keeps its equipment visible, selected, and present exactly once', async () => {
  const h = harness();
  h.eventFields();
  h.run("setEquipmentServiceSelection(['fixture-lights', 'fixture-sound']); renderEquipmentModule()");
  assert.equal(await h.run('addEquipmentEvent()'), true);
  assert.equal(h.run('equipmentState.events.length'), 1);
  assert.equal(h.run('selectedEquipmentEvent() === equipmentState.events[0]'), true);
  assert.deepEqual(h.items(), originalItems);
  assert.deepEqual(h.select.selectedOptions.map(o => o.value), ['fixture-lights', 'fixture-sound']);
  for (const [, description] of originalItems) {
    assert.equal(h.nodes['#equipmentPdfMainTable'].innerHTML.split(description).length - 1, 1);
  }
  assert.match(h.nodes['#equipmentPdfMainTable'].innerHTML, /quantity-cell">0<\/td>/);
  assert.equal(h.nodes['#equipmentPdfPlace'].textContent, 'Fixture venue');
});

test('repeated summary, review and native-option rebuilds do not lose a saved selection or zero row', () => {
  const h = harness();
  h.eventFields();
  h.run("setEquipmentServiceSelection(['fixture-lights', 'fixture-sound']); saveCurrentEquipmentWindow()");
  for (let i = 0; i < 3; i++) {
    h.run("switchEquipmentWindow('summary'); populateNativeEquipmentServiceSelect(); switchEquipmentWindow('review')");
    assert.deepEqual(h.items(), originalItems);
    assert.equal(h.run('equipmentState.events.length'), 1);
    assert.equal(h.run('equipmentEventLineCount(selectedEquipmentEvent())'), 3);
    assert.equal(h.nodes['#equipmentPdfPlace'].textContent, 'Fixture venue');
  }
});

test('explicit new window preserves edits on the saved window before clearing its editor', () => {
  const h = harness();
  h.eventFields();
  h.run("setEquipmentServiceSelection(['fixture-lights', 'fixture-sound']); saveCurrentEquipmentWindow()");
  const eventId = h.run('equipmentState.selectedEventId');
  h.nodes['#equipmentEventPlace'].value = 'Fixture edited venue';
  h.nodes['#equipmentEventResponsible'].value = 'Fixture updated responsible';
  h.run('renderEquipmentModule(); startNewEquipmentWindowDraft()');
  assert.equal(h.run('equipmentState.selectedEventId'), '');
  assert.deepEqual(h.items(), []);
  assert.equal(h.run('equipmentState.events.length'), 1);
  h.run(`loadEquipmentEvent(${JSON.stringify(eventId)})`);
  assert.equal(h.nodes['#equipmentEventPlace'].value, 'Fixture edited venue');
  assert.equal(h.nodes['#equipmentEventResponsible'].value, 'Fixture updated responsible');
  assert.deepEqual(h.items(), originalItems);
});

test('opening a different saved catalog window retains current field edits and all service rows', () => {
  const h = harness();
  h.eventFields('Fixture first');
  h.run("setEquipmentServiceSelection(['fixture-lights', 'fixture-sound']); saveCurrentEquipmentWindow()");
  const first = h.run('equipmentState.selectedEventId');
  h.run('resetEquipmentWindowDraft()');
  h.eventFields('Fixture second');
  h.run("setEquipmentServiceSelection(['fixture-sound']); saveCurrentEquipmentWindow()");
  const second = h.run('equipmentState.selectedEventId');
  h.run(`loadEquipmentEvent(${JSON.stringify(first)})`);
  h.nodes['#equipmentEventPlace'].value = 'Fixture first edited';
  h.run('renderEquipmentModule()');
  h.run(`loadEquipmentEvent(${JSON.stringify(second)}); loadEquipmentEvent(${JSON.stringify(first)})`);
  assert.equal(h.nodes['#equipmentEventPlace'].value, 'Fixture first edited');
  assert.deepEqual(h.items(), originalItems);
  assert.equal(h.run('equipmentState.events.length'), 2);
  assert.equal(h.run('equipmentEventLineCount(equipmentState.events[0])'), 3);
  assert.equal(h.run('equipmentEventLineCount(equipmentState.events[1])'), 1);
});

test('the sidebar PDF action selects its window and preserves that exact editor snapshot', async () => {
  const h = harness();
  h.eventFields('Fixture first');
  h.run("setEquipmentServiceSelection(['fixture-lights', 'fixture-sound']); saveCurrentEquipmentWindow()");
  const first = h.run('equipmentState.selectedEventId');
  h.run('resetEquipmentWindowDraft()');
  h.eventFields('Fixture second');
  h.run("setEquipmentServiceSelection(['fixture-sound']); saveCurrentEquipmentWindow()");
  // The I/O boundary is replaced, while save-by-ID, selection, snapshot and rendering run normally.
  h.run('saveEquipmentPdf = async function(mode) { window.pdfMode = mode; window.pdfSnapshot = currentEquipmentEditableEvent(); }');
  await h.run(`saveEquipmentEventPdf(${JSON.stringify(first)})`);
  assert.equal(h.run('window.pdfMode'), 'full');
  assert.equal(h.run('equipmentState.selectedEventId'), first);
  assert.equal(h.run('window.pdfSnapshot.place'), 'Fixture first');
  assert.equal(h.run('window.pdfSnapshot.sections.reduce((sum, section) => sum + section.items.length, 0)'), 3);
  assert.equal(h.run('window.pdfSnapshot.sections[0].items[0].quantity'), 0);
  assert.deepEqual(h.items(), originalItems);
});
