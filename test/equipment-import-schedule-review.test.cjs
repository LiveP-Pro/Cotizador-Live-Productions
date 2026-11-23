const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const batch = require("../equipment-batch-events.js");
const personalizer = require("../equipment-event-personalizer.js");
const { normalizeEvent, eventReservationStartAt, calculateEquipmentAvailability, createEquipmentEventStore } = require("../equipment-event-store.cjs");

// All source content and inventory in this file are synthetic.
function preview(fields = {}) {
  return { source: { fileName: "agenda-sintetica.xlsx" }, verification: { complete: true, sourceCellCount: 3, representedCellCount: 3 }, sheets: [], events: [{
    id: "synthetic-import", canImport: true, date: "2026-11-25", place: "Salón sintético", type: "Prueba", name: "Cliente sintético",
    itemCount: 1, zeroCount: 1, sourceCells: [{ ref: "source-1", sheet: "Agenda", address: "A1", value: "Horario original" }],
    sections: [{ id: "source-section", title: "Audio", items: [{ id: "source-item", quantity: 0, description: "Unidad sintética", notes: ["Conservar nota"] }], rows: [] }],
    sourceImport: { metadata: { date: "25/11/2026", original: "Horario original" } }, ...fields
  }] };
}
test("review imports complete source schedules and records corrections apart from the original ledger", () => {
  const source = preview({ setupApplies: true, setupAt: "2026-11-24T16:30", startAt: "2026-11-25T20:00", endAt: "2026-11-26T01:00", equipmentInAt: "2026-11-26T04:00" });
  const original = JSON.stringify(source), selections = batch.selectionsFor(source);
  assert.equal(selections[0].setupApplies, "yes");
  assert.equal(selections[0].endDate, "2026-11-26");
  assert.equal(selections[0].endTime, "01:00");
  selections[0].setupTime = "15:00";
  const event = batch.prepareEvents(source, selections)[0];
  assert.equal(event.setupAt, "2026-11-24T15:00");
  assert.equal(event.startAt, "2026-11-25T20:00");
  assert.equal(event.endAt, "2026-11-26T01:00");
  assert.equal(event.sourceImport.reviewedMetadata.setupAt, event.setupAt);
  assert.equal(event.sourceImport.metadata.original, "Horario original");
  assert.equal(event.sections[0].items[0].quantity, 0);
  assert.deepEqual(event.sections[0].items[0].notes, ["Conservar nota"]);
  assert.equal(JSON.stringify(source), original);
});
test("a source final hour without a day remains incomplete instead of inventing a same-day or overnight finish", () => {
  const source = preview({ startTime: "20:00", endTime: "01:00" });
  const selections = batch.selectionsFor(source), event = batch.prepareEvents(source, selections, { acknowledgeWarnings: true })[0];
  assert.equal(event.startAt, "2026-11-25T20:00");
  assert.equal(event.endTime, "01:00");
  assert.equal(event.endDate, "");
  assert.equal(event.endAt, "");
  assert.equal(event.setupAt, "");
  assert.equal(event.setupApplies, undefined);
  assert.equal(event.equipmentInAt, "");
  assert.equal(event.pendingLogistics, true);
  selections[0].endDate = "2026-11-25";
  assert.equal(batch.selectionError(source, selections), "");
  assert.ok(batch.selectionWarnings(source, selections).some((warning) => warning.code === "schedule_pending"));
  selections[0].endDate = "2026-11-26";
  assert.equal(batch.prepareEvents(source, selections)[0].endAt, "2026-11-26T01:00");
});
test("explicit no-mount review clears effective mount data without editing original source metadata", () => {
  const source = preview({ setupApplies: true, setupAt: "2026-11-24T16:00", startAt: "2026-11-25T11:00" });
  const selections = batch.selectionsFor(source);
  selections[0].setupApplies = "no";
  const event = batch.prepareEvents(source, selections)[0];
  assert.equal(event.setupApplies, false);
  assert.equal(event.setupAt, "");
  assert.equal(event.setupDate, "");
  assert.equal(source.events[0].setupAt, "2026-11-24T16:00");
  assert.equal(eventReservationStartAt(event), "2026-11-25T11:00");
});
test("schedule warnings allow drafts after one acknowledgement and keep invalid literal dates out of effective timestamps", () => {
  const source = preview(), selections = batch.selectionsFor(source);
  selections[0].date = "2026-02-30";
  assert.equal(batch.selectionError(source, selections), "");
  assert.throws(() => batch.prepareEvents(source, selections), /Confirme las advertencias/);
  const invalidDateDraft = batch.prepareEvents(source, selections, { acknowledgeWarnings: true })[0];
  assert.equal(invalidDateDraft.date, ""); assert.equal(invalidDateDraft.sourceImport.reviewedInput.date, "2026-02-30");
  selections[0].date = "2026-11-25"; selections[0].startTime = "24:00";
  assert.ok(batch.selectionWarnings(source, selections).some((warning) => warning.code === "schedule_pending"));
  assert.equal(batch.prepareEvents(source, selections, { acknowledgeWarnings: true })[0].startAt, "");
  selections[0].startTime = "18:00"; selections[0].endDate = "2026-11-25"; selections[0].endTime = "20:00";
  selections[0].equipmentInDate = "2026-11-25"; selections[0].equipmentInTime = "19:00";
  assert.ok(batch.selectionWarnings(source, selections).some((warning) => warning.code === "schedule_pending"));
  assert.equal(batch.prepareEvents(source, selections, { acknowledgeWarnings: true })[0].equipmentInAt, "2026-11-25T19:00");
  selections[0].equipmentInTime = "21:00";
  assert.equal(batch.selectionError(source, selections), "");
});
test("schedule preview exposes every clock, explicit mount choice and original cell evidence", () => {
  const source = preview({ setupApplies: false, startAt: "2026-11-25T20:00", endTime: "01:00" });
  const html = batch.renderPreview(source, batch.selectionsFor(source));
  for (const field of ["setupApplies", "setupDate", "setupTime", "startTime", "endDate", "endTime", "equipmentInDate", "equipmentInTime"]) assert.ok(html.includes(`data-batch-field="${field}"`), field);
  assert.match(html, /data-batch-field="setupTime"[^>]+disabled/);
  assert.match(html, /después de medianoche/);
  assert.match(html, /Horario original/);
});
test("personalized events can explicitly omit montage and still validate actual start/end/return dates", () => {
  const draft = { ...personalizer.parseClipboard("0\tUnidad sintética"), metadata: { place: "Lugar sintético", type: "Prueba", setupApplies: false, setupAt: "", startAt: "2026-11-25T11:00", endAt: "2026-11-25T12:00", equipmentInAt: "2026-11-25T14:00" } };
  const inventory = [{ id: "synthetic-stock", name: "Unidad sintética", category: "Audio", itemType: "equipo" }];
  assert.deepEqual(personalizer.validateDraft(draft, inventory), []);
  const event = personalizer.buildEvent(draft, inventory);
  assert.equal(event.setupApplies, false); assert.equal(event.setupAt, "");
  assert.equal(eventReservationStartAt(event), event.startAt);
  draft.metadata.setupApplies = true;
  assert.ok(personalizer.validateDraft(draft, inventory).some((error) => error.field === "setupAt"));
});
test("server reserves a no-mount event from actual start and persists this choice across store instances", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "equipment-synthetic-no-mount-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const event = { id: "synthetic-no-mount", name: "Sin montaje sintético", place: "Lugar sintético", setupApplies: false, setupAt: "", startAt: "2026-11-25T11:00", endAt: "2026-11-25T12:00", equipmentInAt: "2026-11-25T14:00", sections: [{ title: "Audio", items: [{ quantity: 2, description: "Unidad sintética", warehouseInventoryId: "synthetic-stock" }] }] };
  const stock = { savedAt: "synthetic-revision", state: { items: [{ id: "synthetic-stock", name: "Unidad sintética", quantity: 3, category: "Audio", itemType: "equipo" }], movements: [] } };
  const store = createEquipmentEventStore({ directory });
  store.putEvent(event.id, { event }, "Empleado sintético");
  const restored = createEquipmentEventStore({ directory }).readEvents().events[0];
  assert.equal(restored.setupApplies, false); assert.equal(restored.setupAt, "");
  const plan = calculateEquipmentAvailability([restored], stock, { now: Date.parse("2026-01-01T00:00:00Z") });
  assert.equal(plan.rows[0].required, 2);
  assert.equal(plan.rows[0].missing, 0);
  assert.equal(plan.rows[0].reservations[0].pendingLogistics, false);
  assert.equal(plan.rows[0].reservations[0].setupAt, event.startAt);
  assert.throws(() => normalizeEvent(event.id, { ...event, setupAt: "2026-11-25T10:00" }), /no aplica montaje/);
  assert.throws(() => normalizeEvent(event.id, { ...event, setupApplies: "false" }), /montaje aplica/);
});
test("planner excludes montage from pending schedules only after an explicit no-mount choice", () => {
  const planner = require("../equipment-planner.js");
  const event = { ...preview().events[0], setupApplies: false, setupAt: "", startAt: "2026-11-25T11:00", endAt: "2026-11-25T12:00", equipmentInAt: "2026-11-25T14:00" };
  assert.deepEqual(planner.analyze([event], []).eventPending, []);
  const absentStart = planner.analyze([{ ...event, startAt: "" }], []).eventPending;
  assert.deepEqual(absentStart[0].missing, ["startAt"]);
  const unconfirmedMount = { ...event }; delete unconfirmedMount.setupApplies;
  assert.deepEqual(planner.analyze([unconfirmedMount], []).eventPending[0].missing, ["setupAt"]);
});
test("provisional Excel and PDF show no-mount plus actual event times without a false mount pending", async () => {
  const reporting = require("../equipment-reporting.cjs"), ExcelJS = require("exceljs");
  const event = { ...preview().events[0], setupApplies: false, setupAt: "", startAt: "2026-11-25T11:00", endAt: "2026-11-25T12:00", equipmentInAt: "2026-11-25T14:00" };
  const inventory = { state: { items: [], movements: [] } };
  const original = JSON.stringify(event), model = reporting.createEquipmentReportModel({ events: [event] }, inventory);
  assert.equal(model.pending.filter((entry) => entry.kind === "HORARIO").length, 0);
  const markup = reporting.renderEquipmentReportHtml(model, "rent");
  assert.match(markup, /No aplica/); assert.match(markup, /2026-11-25T11:00/);
  const workbook = await reporting.createEquipmentMasterWorkbook(model), reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const cells = []; reopened.getWorksheet("Eventos").eachRow((row) => row.eachCell((cell) => cells.push(cell.value)));
  assert.ok(cells.includes("No aplica")); assert.ok(cells.includes(event.endAt));
  assert.equal(JSON.stringify(event), original);
});
test("report timeline keeps partial final hours visible and warns contradictory montage without hiding the literal", () => {
  const reporting = require("../equipment-reporting.cjs");
  const event = { ...preview().events[0], setupApplies: false, setupAt: "2026-11-24T16:00", startAt: "2026-11-25T20:00", endTime: "01:00" };
  const model = reporting.createEquipmentReportModel({ events: [event] }, { state: { items: [], movements: [] } });
  assert.ok(model.pending.some((entry) => /no aplica montaje/.test(entry.reason)));
  const markup = reporting.renderEquipmentReportHtml(model);
  assert.match(markup, /No aplica; dato de montaje por revisar: 2026-11-24T16:00/);
  assert.match(markup, /Fecha pendiente · 01:00/);
  assert.equal(model.events[0].endAt, undefined);
});
test("agenda week intersection uses physical dispatch or actual event start when montage does not apply", () => {
  const workspace = require("../equipment-workspace.js"), range = { from: "2026-11-16", to: "2026-11-22" };
  const event = { setupApplies: false, setupAt: "", equipmentOutAt: "2026-11-22T18:00", startAt: "2026-11-23T10:00", endAt: "2026-11-23T12:00", equipmentInAt: "2026-11-23T14:00" };
  assert.equal(workspace.intersects(event, range), true);
  const withoutDispatch = { ...event, equipmentOutAt: "" };
  assert.equal(workspace.intersects(withoutDispatch, range), false);
  assert.equal(workspace.intersects(withoutDispatch, { from: "2026-11-23", to: "2026-11-29" }), true);
});

function batchHarness(options) {
  const ids = new Map(), elements = [], listeners = new Map();
  class Element {
    constructor(id = "") { this.id = id; this.dataset = {}; this.listeners = {}; this.open = false; this.disabled = false; this.hidden = false; this.value = ""; elements.push(this); }
    set innerHTML(value) {
      this.html = value;
      for (const match of value.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
        const attrs = match[2], id = attrs.match(/\bid="([^"]+)"/)?.[1] || "", data = {};
        for (const attribute of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) data[attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attribute[2];
        if (!id && !Object.keys(data).length) continue;
        const element = new Element(id); element.dataset = data;
        if (id) ids.set(id, element);
      }
    }
    get innerHTML() { return this.html || ""; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    removeEventListener() {}
    querySelector() { return elements.find((entry) => entry.dataset.batchAction === "choose"); }
    querySelectorAll(selector) { const name = selector.match(/\[data-([a-z-]+)\]/)?.[1]?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); return name ? elements.filter((entry) => entry.dataset[name] !== undefined) : []; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() {}
    remove() {}
  }
  const opener = new Element("equipmentBatchImportButton"); ids.set(opener.id, opener);
  const document = { body: { appendChild(element) { ids.set(element.id, element); } }, createElement() { return new Element(); }, getElementById(id) { return ids.get(id); }, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
  const api = batch.init({ document, fetch: async () => ({ ok: true, json: async () => preview() }), ...options }), dialog = ids.get("equipmentBatchDialog");
  return { api, dialog, get: (id) => ids.get(id), emitSession() { listeners.get("live:session-updated")?.(); }, async action(action) { const target = { dataset: { batchAction: action }, closest() { return this; } }; for (const callback of dialog.listeners.click || []) await callback({ target }); } };
}
const syntheticFile = () => ({ name: "agenda-sintetica.xlsx", size: 10, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", arrayBuffer: async () => new ArrayBuffer(10) });
test("each import report action loads exactly once and reports from the consumed preview", async () => {
  for (const mode of ["transfer", "rent", "purchase"]) {
    let imports = 0, after = 0, finish;
    const harness = batchHarness({ bridge: { importEvents(events) { imports++; assert.equal(events[0].sections[0].items[0].quantity, 0); return new Promise((resolve) => { finish = resolve; }); }, afterImport(receivedMode, context) {
      after++; assert.equal(receivedMode, mode); assert.equal(context.result.count, 1); assert.equal(context.events.length, 1); assert.equal(harness.dialog.open, true); assert.equal(harness.api.getPreview(), null);
    } } });
    harness.api.open(); await harness.api.read(syntheticFile());
    const applying = harness.action(`apply-${mode}`);
    await harness.action(`apply-${mode}`);
    assert.equal(imports, 1); assert.equal(after, 0);
    finish({ count: 1 }); await applying;
    assert.equal(after, 1); assert.equal(imports, 1);
    assert.equal(harness.dialog.open, mode !== "transfer");
    assert.notEqual(harness.get("equipmentBatchStatus").dataset.error, "true");
  }
});
test("a failed report callback retries only the report and retains imported events", async () => {
  let imports = 0, reports = 0, errorMessage = "";
  const harness = batchHarness({ onError(error) { errorMessage = error.message; }, bridge: { importEvents() { imports++; return { count: 1 }; }, afterImport() { reports++; throw new Error("Fallo sintético de descarga"); } } });
  harness.api.open(); await harness.api.read(syntheticFile());
  await harness.action("apply-rent");
  assert.equal(imports, 1); assert.equal(reports, 1); assert.match(errorMessage, /Fallo sintético/);
  assert.equal(harness.dialog.open, true); assert.equal(harness.api.getPreview(), null);
  await harness.action("apply-rent");
  assert.equal(imports, 1); assert.equal(reports, 2);
});
test("import report shortcuts require both event writing and report permissions", async () => {
  let imports = 0;
  const session = { permissions: ["equipment.write"] };
  const harness = batchHarness({ access: { can(user, permission) { return user.permissions.includes(permission); } }, session, bridge: { importEvents() { imports++; }, afterImport() {} } });
  harness.api.open(); await harness.api.read(syntheticFile());
  assert.equal(harness.get("equipmentBatchApply").hidden, false);
  for (const id of ["equipmentBatchTransfer", "equipmentBatchRent", "equipmentBatchPurchase"]) assert.equal(harness.get(id).hidden, true);
  await harness.action("apply-rent"); assert.equal(imports, 0);
  session.permissions.push("equipment.reports"); harness.emitSession();
  assert.equal(harness.get("equipmentBatchRent").hidden, true, "el paso inicial solo muestra la carga completa");
  await harness.action("apply");
  assert.equal(harness.get("equipmentBatchRent").hidden, false);
  assert.equal(harness.get("equipmentBatchRent").disabled, false);
  session.permissions = ["equipment.reports"]; harness.emitSession();
  assert.equal(harness.get("equipmentBatchApply").hidden, true);
  assert.equal(harness.get("equipmentBatchRent").hidden, true);
});
