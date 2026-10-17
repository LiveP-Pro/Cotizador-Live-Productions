const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function harness() {
  const classes = () => {
    const values = new Set();
    return {
      add(value) { values.add(value); },
      remove(value) { values.delete(value); },
      contains(value) { return values.has(value); },
      toggle(value, force) {
        const next = force === undefined ? !values.has(value) : Boolean(force);
        if (next) values.add(value); else values.delete(value);
        return next;
      }
    };
  };
  const element = () => ({
    value: "", textContent: "", innerHTML: "", dataset: {},
    classList: classes(), listeners: new Map(),
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    append(child) { (this.children ||= []).push(child); }
  });
  class Option {
    constructor(text, value, defaultSelected, selected) {
      Object.assign(this, { text, value, defaultSelected: Boolean(defaultSelected), selected: Boolean(selected) });
    }
  }
  const select = {
    ...element(), multiple: true, options: [],
    replaceChildren() { this.options = []; },
    add(option) { this.options.push(option); },
    append(group) { this.options.push(...group.children); },
    get selectedOptions() { return this.options.filter((option) => option.selected); }
  };
  const selectors = [
    "#equipmentAddEventButton", "#equipmentNewWindowButton", "#equipmentSaveWindowButton",
    "#equipmentReviewWindowButton", "#equipmentSummaryWindowButton", "#equipmentSaveStatus",
    "#equipmentMainTable", "#equipmentPdfMainTable", "#equipmentEventsList",
    "#equipmentPdfTitle", "#equipmentPdfPlace", "#equipmentPdfEvent", "#equipmentNotes",
    "#equipmentWorkspace", "#equipmentMainPanel", "#equipmentReviewPdfPreview",
    ...["Place", "Name", "SetupAt", "Date", "InAt", "Responsible"].map((name) => `#equipmentEvent${name}`)
  ];
  const elements = Object.fromEntries(selectors.map((selector) => [selector, element()]));
  elements["#equipmentServiceSelect"] = select;
  const source = {
    version: "synthetic-window-workflow",
    services: {
      "synthetic-98": {
        name: "Synthetic service with 98 lines",
        mainSections: [{ title: "Synthetic category A", items: Array.from({ length: 98 }, (_, index) => [index, `Synthetic equipment ${index}`]) }]
      },
      "synthetic-second": {
        name: "Synthetic second service",
        mainSections: [{ title: "Synthetic category B", items: [[2, "Different synthetic equipment"]] }]
      }
    },
    groups: [{ id: "synthetic", label: "Synthetic services", serviceIds: ["synthetic-98", "synthetic-second"] }]
  };
  const context = vm.createContext({
    window: { requerimientoEquipoCatalog: source, requestAnimationFrame(callback) { callback(); }, setTimeout() {} },
    document: {
      querySelector(selector) { return elements[selector] || null; },
      querySelectorAll() { return []; }, addEventListener() {}, createElement: element
    },
    Option,
    async fetch() {
      return { ok: true, async json() { return { baseCatalogVersion: source.version, services: source.services }; } };
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context);
  const run = (code) => vm.runInContext(code, context);
  // Exercise actual button handlers, validation, snapshots and rendering without
  // starting background synchronization or making any warehouse writes.
  run("initEquipmentCatalogSync = function () {}; initEquipmentWarehouseInventorySync = function () {}; initEquipmentModule();");
  function draft(serviceId = "synthetic-98", suffix = "A") {
    elements["#equipmentEventPlace"].value = `Synthetic venue ${suffix}`;
    elements["#equipmentEventName"].value = `Synthetic event ${suffix}`;
    elements["#equipmentEventSetupAt"].value = suffix === "A" ? "2026-11-05T07:00" : "2026-11-12T07:00";
    elements["#equipmentEventDate"].value = suffix === "A" ? "2026-11-05" : "2026-11-12";
    elements["#equipmentEventInAt"].value = suffix === "A" ? "2026-11-06T01:00" : "2026-11-13T01:00";
    run(`setEquipmentServiceSelection(${JSON.stringify([serviceId])}); renderEquipmentModule();`);
  }
  return {
    run, elements, select, draft,
    click(selector) { const handler = elements[selector].listeners.get("click"); assert.equal(typeof handler, "function"); return handler({ type: "click" }); },
    json(code) { return JSON.parse(run(`JSON.stringify(${code})`)); }
  };
}

test("Agregar ventana keeps the saved service, all 98 lines and zero visible in editor and PDF", async () => {
  const h = harness();
  h.draft();
  assert.equal(await h.click("#equipmentAddEventButton"), true);
  const event = h.json("selectedEquipmentEvent()");
  assert.equal(h.run("equipmentState.events.length"), 1);
  assert.equal(h.run("equipmentEventLineCount(selectedEquipmentEvent())"), 98);
  assert.equal(h.run("currentEquipmentService().name"), "Synthetic service with 98 lines");
  assert.equal(h.elements["#equipmentEventPlace"].value, "Synthetic venue A");
  assert.equal(h.elements["#equipmentSaveWindowButton"].textContent, "Guardar cambios");
  assert.match(h.elements["#equipmentEventsList"].innerHTML, /equipment-event-card is-active/);
  assert.match(h.elements["#equipmentEventsList"].innerHTML, /98 líneas de equipo/);
  assert.match(h.elements["#equipmentMainTable"].innerHTML, /value="0"/);
  assert.match(h.elements["#equipmentPdfMainTable"].innerHTML, /quantity-cell">0<\/td>/);
  for (let index = 0; index < 98; index += 1) {
    assert.match(h.elements["#equipmentMainTable"].innerHTML, new RegExp(`Synthetic equipment ${index}(?:"|<)`));
    assert.match(h.elements["#equipmentPdfMainTable"].innerHTML, new RegExp(`Synthetic equipment ${index}<`));
  }
  assert.doesNotMatch(h.elements["#equipmentMainTable"].innerHTML, /Seleccione un servicio/);
  assert.equal(await h.click("#equipmentAddEventButton"), true);
  assert.equal(h.run("equipmentState.events.length"), 1, "repeated save must update the selected event instead of duplicate it");
  assert.equal(h.run("equipmentState.selectedEventId"), event.id);
});

test("Nueva ventana is the explicit clean draft action and preserves the first saved event and latest edits", async () => {
  const h = harness();
  h.draft();
  await h.click("#equipmentAddEventButton");
  const firstId = h.run("equipmentState.selectedEventId");
  h.elements["#equipmentEventPlace"].value = "Edited synthetic venue";
  h.run("updateEquipmentItem(selectedEquipmentSections()[0].items[1].id, 'quantity', 123)");
  h.click("#equipmentNewWindowButton");
  assert.equal(h.run("equipmentState.events.length"), 1);
  assert.equal(h.run("equipmentState.selectedEventId"), "");
  assert.equal(h.run("currentEquipmentService()"), null);
  assert.equal(h.elements["#equipmentEventPlace"].value, "");
  assert.equal(h.elements["#equipmentEventDate"].value, "");
  assert.equal(h.elements["#equipmentNotes"].value, "");
  assert.equal(h.select.selectedOptions.length, 0);
  assert.equal(h.run("equipmentState.events[0].place"), "Edited synthetic venue");
  assert.equal(h.run("equipmentState.events[0].sections[0].items[1].quantity"), 123);
  h.draft("synthetic-second", "B");
  assert.equal(await h.click("#equipmentAddEventButton"), true);
  assert.equal(h.run("equipmentState.events.length"), 2);
  assert.equal(h.run("equipmentEventLineCount(selectedEquipmentEvent())"), 1);
  assert.doesNotMatch(h.elements["#equipmentMainTable"].innerHTML, /Synthetic equipment 97/);
  h.run(`loadEquipmentEvent(${JSON.stringify(firstId)})`);
  assert.equal(h.run("equipmentEventLineCount(selectedEquipmentEvent())"), 98);
  assert.equal(h.elements["#equipmentEventPlace"].value, "Edited synthetic venue");
  assert.match(h.elements["#equipmentMainTable"].innerHTML, /value="123"/);
  assert.match(h.elements["#equipmentPdfMainTable"].innerHTML, /quantity-cell">0<\/td>/);
});

test("an unsaved draft is cleared only by Nueva ventana and is never automatically inserted into saved events", () => {
  const h = harness();
  h.draft();
  h.click("#equipmentNewWindowButton");
  assert.equal(h.run("equipmentState.events.length"), 0);
  assert.equal(h.run("equipmentState.selectedEventId"), "");
  assert.equal(h.run("currentEquipmentService()"), null);
});

test("the saved 98-line event survives review/summary navigation and current catalog refresh", async () => {
  const h = harness();
  h.draft();
  await h.click("#equipmentAddEventButton");
  const selectedId = h.run("equipmentState.selectedEventId");
  h.click("#equipmentSummaryWindowButton");
  h.click("#equipmentReviewWindowButton");
  await h.run("loadEquipmentCatalogOverrides(true)");
  h.run("renderEquipmentModule()");
  assert.equal(h.run("equipmentState.selectedEventId"), selectedId);
  assert.equal(h.run("equipmentEventLineCount(selectedEquipmentEvent())"), 98);
  assert.equal(h.select.selectedOptions[0].value, "synthetic-98");
  assert.equal(h.elements["#equipmentPdfTitle"].textContent, "Synthetic service with 98 lines");
  assert.equal(h.elements["#equipmentPdfPlace"].textContent, "Synthetic venue A");
  assert.match(h.elements["#equipmentMainTable"].innerHTML, /Synthetic equipment 97/);
  assert.match(h.elements["#equipmentPdfMainTable"].innerHTML, /Synthetic equipment 97/);
  assert.equal(h.elements["#equipmentMainPanel"].classList.contains("is-hidden"), false);
  assert.equal(h.elements["#equipmentReviewPdfPreview"].classList.contains("is-hidden"), false);
});

test("switching saved windows preserves the outgoing service window's latest fields and quantities", async () => {
  const h = harness();
  h.draft();
  await h.click("#equipmentAddEventButton");
  const firstId = h.run("equipmentState.selectedEventId");
  h.click("#equipmentNewWindowButton");
  h.draft("synthetic-second", "B");
  await h.click("#equipmentAddEventButton");
  const secondId = h.run("equipmentState.selectedEventId");
  h.run(`loadEquipmentEvent(${JSON.stringify(firstId)})`);
  h.elements["#equipmentEventPlace"].value = "Updated while opening another window";
  h.elements["#equipmentEventResponsible"].value = "Synthetic responsible person";
  h.run("updateEquipmentItem(selectedEquipmentSections()[0].items[2].id, 'quantity', 456)");
  h.run(`loadEquipmentEvent(${JSON.stringify(secondId)})`);
  assert.equal(h.elements["#equipmentEventPlace"].value, "Synthetic venue B");
  h.run(`loadEquipmentEvent(${JSON.stringify(firstId)})`);
  assert.equal(h.elements["#equipmentEventPlace"].value, "Updated while opening another window");
  assert.equal(h.elements["#equipmentEventResponsible"].value, "Synthetic responsible person");
  assert.equal(h.run("selectedEquipmentSections()[0].items[2].quantity"), 456);
  assert.equal(h.run("equipmentState.events.length"), 2);
  assert.equal(h.run("equipmentEventLineCount(selectedEquipmentEvent())"), 98);
  assert.match(h.elements["#equipmentPdfMainTable"].innerHTML, /quantity-cell">456<\/td>/);
});

test("Nueva ventana cannot reset the active draft while an extra equipment save decision is pending", () => {
  const h = harness();
  h.draft();
  h.run("equipmentExtraEntryBusy = true");
  assert.equal(h.click("#equipmentNewWindowButton"), false);
  assert.equal(h.run("currentEquipmentService().name"), "Synthetic service with 98 lines");
  assert.equal(h.elements["#equipmentEventPlace"].value, "Synthetic venue A");
});
