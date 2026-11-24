const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Current synthetic inputs only. Reporting must not save events or inventory.
const plain = value => JSON.parse(JSON.stringify(value));
function harness() {
  const nodes = new Map(), downloads = [], selectors = [], requests = [];
  for (const id of ["equipmentSaveStatus", "equipmentSharedStatus", "equipmentSummaryTransferButton", "equipmentTransferWindowButton", "equipmentSaveTransferPdfButton", "equipmentAgendaFrom", "equipmentAgendaTo"]) nodes.set("#" + id, { id, textContent: "", value: "", disabled: false, classList: { add() {}, remove() {} } });
  const context = vm.createContext({ console, URL, Date, Map, Set, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    window: { requerimientoEquipoCatalog: { services: {}, groups: [] }, requerimientoEquipoInventory: { categories: [] }, location: { protocol: "https:" }, addEventListener() {}, setTimeout() {} },
    document: { querySelector: selector => nodes.get(selector) || null, querySelectorAll: () => [], addEventListener() {} },
    fetch: async (...args) => { requests.push(args); throw new Error("No production requests permitted in this test"); }
  });
  const run = code => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"));
  context.window.downloads = downloads;
  context.window.selectors = selectors;
  context.window.nextTransferResult = {ok:true};
  context.window.nextDownloadResult = { ok: true, fileName: "Trasiego-sintetico-PROVISIONAL.pdf" };
  run(`window.testPlannerInstance={render(){},async openTransfers(){window.selectors.push(true);return window.nextTransferResult;},async download(mode,button,events){window.downloads.push({mode,buttonId:button?.id,events});if(window.downloadFailure)throw new Error(window.downloadFailure);return window.nextDownloadResult;}};
    window.EquipmentPlanner={create(bridge){window.testBridge=bridge;return {init(){return window.testPlannerInstance;}};}};
    renderEquipmentModule=()=>{};
    switchEquipmentWindow=value=>{equipmentState.activeWindow=value;};
    loadEquipmentEvent=()=>{};
    resolveEquipmentPendingExtraChoices=()=>{throw new Error('Report must not resolve stock ingress or purchases');};
    saveEquipmentSharedWindow=()=>{throw new Error('Report must not save events');};
    persistEquipmentSharedEvent=()=>{throw new Error('Report must not confirm reservations');};
    equipmentSharedWorkspace.enabled=true;
    equipmentSharedWorkspace.dirty=false;
    equipmentSharedWorkspace.state={events:[],transfers:[],routeEstimates:[],loaded:true};
    equipmentState.events=[{id:'draft-synthetic',status:'draft',date:'2026-11-25',place:'Lugar sintético',sections:[{title:'Audio',items:[{quantity:2,description:'Equipo sintético'}]}]}];
    equipmentWarehouseInventoryState.records=[{id:'stock-synthetic',available:5,item:{name:'Equipo sintético',quantity:5}}];
    initEquipmentPlannerBridge();`);
  const snapshot = () => run("JSON.stringify({events:equipmentState.events,dirty:equipmentSharedWorkspace.dirty,transfers:equipmentSharedWorkspace.state.transfers,inventory:equipmentWarehouseInventoryState.records,routes:equipmentState.summaryTransferRoutes,dirtyIds:[...equipmentPlannerDirtyIds]})");
  return { context, run, nodes, downloads, selectors, requests, snapshot, bridge: context.window.testBridge };
}

test("summary and preview open the selection list without saving or changing their quantities", async () => {
  for (const target of ["summary", "preview"]) {
    const h = harness(), before = h.snapshot();
    const result = await h.run(`requestEquipmentTransferDecision('${target}')`);
    assert.equal(result.ok, true);
    assert.equal(h.selectors.length, 1);assert.equal(h.downloads.length, 0);
    assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
  }
});

test("unsaved edits of a confirmed window also open the selection list", async () => {
  const h = harness(); h.run("equipmentState.events[0].status='confirmed';equipmentState.events[0].updatedAt='synthetic-saved';equipmentSharedWorkspace.dirty=true;");
  const before = h.snapshot(); assert.equal(h.run("equipmentHasTransferDrafts()"), true);
  assert.equal((await h.run("requestEquipmentTransferDecision('summary')")).ok, true);
  assert.equal(h.selectors.length, 1);assert.equal(h.downloads.length, 0); assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
});

test("saving the draft transfer PDF bypasses extra ingress and reservation confirmation", async () => {
  const h = harness(); h.run("equipmentSharedWorkspace.dirty=true;equipmentState.manualExtras=[{description:'Ingreso pendiente sintético',quantity:1,procurementChoice:'save'}];");
  const before = h.snapshot();
  assert.equal((await h.run("saveEquipmentPdf('transfer')")).ok, true);
  assert.equal(h.downloads[0].buttonId, "equipmentSaveTransferPdfButton");
  assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
});

test("a failed draft transfer download preserves the drafts and permits a retry", async () => {
  const h = harness(), before = h.snapshot(); h.context.window.downloadFailure = "Descarga sintética interrumpida";
  const failed = await h.run("downloadEquipmentDraftTransfer()");
  assert.equal(failed.ok, false); assert.match(failed.message, /interrumpida/);
  assert.match(h.nodes.get("#equipmentSaveStatus").textContent, /interrumpida/);
  delete h.context.window.downloadFailure;
  assert.equal((await h.run("downloadEquipmentDraftTransfer()")).ok, true);
  assert.equal(h.downloads.length, 2); assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
});

test("missing report permissions, an active save, or a missing generator do not dispatch a report", async () => {
  for (const [setup, message] of [
    ["window.LiveAccess={can(){return false;}}", /permiso/],
    ["equipmentSharedWorkspace.saving=true", /guardado actual/],
    ["equipmentPlannerInstance=null", /generador/]
  ]) {
    const h = harness(); h.run(setup); const before = h.snapshot();
    const result = await h.run("requestEquipmentTransferDecision('summary')");
    assert.equal(result.ok, false); assert.match(result.message, message);
    assert.equal(h.downloads.length, 0); assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
  }
});

test("the batch transfer action opens selection and propagates a retryable error without downloading an unselected plan", async () => {
  const h = harness(); h.run("equipmentState.events=[]");
  const source = [0, 1].map(index => ({ id: `source-${index}`, date: "2026-11-25", place: `Lugar ${index}`, sourceImport: { sourceEventId: `source-${index}` }, sections: [{ title: "Audio", items: [{ quantity: index, description: `Equipo ${index}` }] }] }));
  const result = h.bridge.importEvents(source), ids = result.events.map(event => event.id), before = h.snapshot();
  assert.ok(ids.every(id => !id.startsWith("source-")));
  h.context.window.nextTransferResult = { ok: false, message: "Fallo de trasiego sintético" };
  await assert.rejects(h.bridge.afterImport("transfer", { result, events: [{ id: "unrelated-fallback" }] }), /Fallo de trasiego/);
  assert.equal(h.selectors.length, 1);assert.equal(h.downloads.length, 0);
  h.context.window.nextTransferResult = { ok: true };
  await h.bridge.afterImport("transfer", { result });
  assert.equal(h.selectors.length, 2);assert.equal(h.downloads.length, 0);
  assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
});

test("the bridge passes independent route estimate snapshots to provisional planning", () => {
  const h = harness(); h.run("equipmentSharedWorkspace.state.routeEstimates=[{fromEventId:'origin',toEventId:'destination',travelMinutes:30,handlingMinutes:20,reviewed:true}]");
  const before = h.snapshot(), options = h.bridge.transferOptions();
  assert.equal(options.routeEstimates.length, 1); options.routeEstimates[0].travelMinutes = 999; options.routeEstimates.push({});
  assert.equal(h.run("equipmentSharedWorkspace.state.routeEstimates[0].travelMinutes"), 30);
  assert.equal(h.run("equipmentSharedWorkspace.state.routeEstimates.length"), 1);
  assert.equal(h.snapshot(), before); assert.equal(h.requests.length, 0);
});
