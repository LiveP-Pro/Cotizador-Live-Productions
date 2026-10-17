const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createHarness() {
  class Option {
    constructor(text, value, defaultSelected, selected) {
      Object.assign(this, { text, value, defaultSelected: Boolean(defaultSelected), selected: Boolean(selected) });
    }
  }
  const serviceSelect = {
    multiple: true,
    options: [],
    replaceChildren() { this.options = []; },
    add(option) { this.options.push(option); },
    append(group) { this.options.push(...group.children); },
    get selectedOptions() { return this.options.filter((option) => option.selected); }
  };
  const fields = Object.fromEntries([
    "Place", "Name", "SetupAt", "Date", "InAt", "Responsible"
  ].map((name) => [`#equipmentEvent${name}`, { value: "" }]));
  const context = {
    window: {
      requerimientoEquipoCatalog: {
        version: "synthetic-selection-refresh",
        services: {
          "synthetic-a": { name: "Synthetic A", mainSections: [{ title: "Synthetic A", items: [[0, "Zero A"], [2, "Two A"]] }] },
          "synthetic-b": { name: "Synthetic B", mainSections: [{ title: "Synthetic B", items: [[1, "One B"]] }] }
        },
        groups: [{ id: "synthetic", label: "Synthetic", serviceIds: ["synthetic-a", "synthetic-b"] }]
      }
    },
    document: {
      querySelector(selector) { return selector === "#equipmentServiceSelect" ? serviceSelect : fields[selector] || null; },
      addEventListener() {},
      createElement() { return { children: [], append(option) { this.children.push(option); } }; }
    },
    Option,
    async fetch() {
      return { ok: true, async json() {
        return {
          baseCatalogVersion: "synthetic-selection-refresh",
          services: { "synthetic-a": { name: "Synthetic A", mainSections: [{ title: "Synthetic A", items: [[0, "Zero A"], [2, "Two A"]] }] } }
        };
      } };
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context);
  const evaluate = (source) => vm.runInContext(source, context);
  evaluate("populateNativeEquipmentServiceSelect()");
  return { context, serviceSelect, fields, evaluate };
}

test("rebuilding the native service options preserves all committed selections", () => {
  const harness = createHarness();
  harness.evaluate("setEquipmentServiceSelection(['synthetic-a', 'synthetic-b'])");
  harness.evaluate("populateNativeEquipmentServiceSelect(); syncSelectedEquipmentService()");
  assert.deepEqual(harness.serviceSelect.selectedOptions.map((option) => option.value), ["synthetic-a", "synthetic-b"]);
  assert.deepEqual(JSON.parse(harness.evaluate("JSON.stringify(selectedEquipmentServiceIds())")), ["synthetic-a", "synthetic-b"]);
  assert.equal(harness.evaluate("currentEquipmentService().name"), "Synthetic A + Synthetic B");
});

test("refreshing an unchanged editable catalog retains the active event, quantities and draft fields", async () => {
  const harness = createHarness();
  harness.fields["#equipmentEventPlace"].value = "Synthetic venue";
  harness.fields["#equipmentEventDate"].value = "2026-11-05";
  harness.evaluate(`
    setEquipmentServiceSelection(['synthetic-a']);
    equipmentState.selectedEventId = 'synthetic-event';
    equipmentState.events = [{ id: 'synthetic-event', ...currentEquipmentEventDraft(), ...captureEquipmentEventSnapshot() }];
    renderEquipmentModule = function () { syncSelectedEquipmentService(); };
  `);
  await harness.evaluate("loadEquipmentCatalogOverrides(true)");
  assert.deepEqual(harness.serviceSelect.selectedOptions.map((option) => option.value), ["synthetic-a"]);
  assert.equal(harness.evaluate("currentEquipmentService().name"), "Synthetic A");
  assert.equal(harness.evaluate("equipmentState.selectedEventId"), "synthetic-event");
  assert.equal(harness.fields["#equipmentEventPlace"].value, "Synthetic venue");
  assert.equal(harness.fields["#equipmentEventDate"].value, "2026-11-05");
  assert.deepEqual(JSON.parse(harness.evaluate("JSON.stringify(selectedEquipmentSections()[0].items.map(item => normalizeEquipmentItem(item).quantity))")), [0, 2]);
});

test("an intentionally empty draft stays empty after options are rebuilt", () => {
  const harness = createHarness();
  harness.evaluate("setEquipmentServiceSelection([]); populateNativeEquipmentServiceSelect(); syncSelectedEquipmentService()");
  assert.deepEqual(harness.serviceSelect.selectedOptions.map((option) => option.value), []);
  assert.equal(harness.evaluate("currentEquipmentService()"), null);
});

test("removing a selected service from the current source does not restore its selection", () => {
  const harness = createHarness();
  harness.evaluate(`
    setEquipmentServiceSelection(['synthetic-a', 'synthetic-b']);
    applyEquipmentCatalogOverrides({ removedServiceIds: ['synthetic-a'] });
    populateNativeEquipmentServiceSelect();
    syncSelectedEquipmentService();
  `);
  assert.deepEqual(harness.serviceSelect.selectedOptions.map((option) => option.value), ["synthetic-b"]);
  assert.equal(harness.serviceSelect.options.some((option) => option.value === "synthetic-a"), false);
  assert.deepEqual(JSON.parse(harness.evaluate("JSON.stringify(selectedEquipmentServiceIds())")), ["synthetic-b"]);
  assert.notEqual(harness.evaluate("equipmentState.selectedServiceId"), "synthetic-a");
  assert.equal(harness.evaluate("currentEquipmentService().name"), "Synthetic B");
});
