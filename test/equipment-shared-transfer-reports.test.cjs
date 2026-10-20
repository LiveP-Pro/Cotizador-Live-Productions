const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Synthetic current records only: no production events or source equipment.
function harness() {
  const elements = new Map();
  const element = () => ({ value: "", innerHTML: "", textContent: "", dataset: {}, disabled: false, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, scrollIntoView() { this.scrolled = true; } });
  for (const id of ["equipmentSaveStatus", "equipmentSharedStatus", "equipmentTransferPdfRoutes", "equipmentSaveTransferPdfButton", "equipmentPdfTransferDestinations", "equipmentTransferPanel", "equipmentTransferPlan", "equipmentSharedRecommendations"]) elements.set("#" + id, element());
  const context = vm.createContext({
    console, URL, Date, Map, Set, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    window: { requerimientoEquipoCatalog: { services: {}, groups: [] }, requerimientoEquipoInventory: { categories: [] }, addEventListener() {}, setTimeout() {}, requestAnimationFrame(callback) { callback(); } },
    document: { querySelector: (selector) => elements.get(selector) || null, querySelectorAll() { return []; }, addEventListener() {} },
    fetch: async () => { throw new Error("A report must not write to the server"); }
  });
  const run = (code) => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, "..", "equipment-workspace.js"), "utf8"));
  run(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"));
  const events = [
    { id: "origin", place: "Origen sintético", name: "Evento origen", date: "2026-10-25", setupAt: "2026-10-25T08:00", startAt: "2026-10-25T12:00", endAt: "2026-10-25T20:00", equipmentInAt: "2026-10-27T15:00", updatedAt: "2026-10-20T08:00:00Z", sections: [{ title: "Audio", items: [{ quantity: 3, description: "Equipo transferible sintético", warehouseInventoryId: "stock-shared" }] }] },
    { id: "destination", place: "Destino sintético", name: "Evento destino", date: "2026-10-26", setupAt: "2026-10-26T02:00", startAt: "2026-10-26T05:00", endAt: "2026-10-26T10:00", equipmentInAt: "2026-10-26T12:00", updatedAt: "2026-10-20T08:00:00Z", sections: [{ title: "Audio", items: [{ quantity: 2, description: "Equipo transferible sintético", warehouseInventoryId: "stock-shared" }] }] }
  ];
  const transfer = { id: "confirmed-transfer", status: "confirmed", fromEventId: "origin", toEventId: "destination", travelMinutes: 60, handlingMinutes: 120, items: [{ warehouseInventoryId: "stock-shared", quantity: 2 }] };
  context.fixtureEvents = events; context.fixtureTransfer = transfer;
  context.fixtureState = { loaded: true, stale: false, refreshing: false, pending: 0, revision: 4, range: { from: "2026-10-26", to: "2026-11-01" }, events, transfers: [transfer], plan: { revision: 4, transfers: [transfer], invalidTransfers: [], rows: [], inventorySavedAt: "2026-10-20T08:00:00Z" } };
  run(`applyEquipmentWarehouseInventoryPayload({savedAt:'2026-10-20T08:00:00Z',state:{items:[{id:'stock-shared',name:'Equipo transferible sintético',category:'Audio sintético',itemType:'equipo',quantity:3}],movements:[]}});
    equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.state=fixtureState;
    equipmentState.events=[fixtureEvents[1]]; equipmentState.selectedEventId='origin';
    renderEquipmentModule=()=>{window.renderCount=(window.renderCount||0)+1;};`);
  return { run, context, elements, get: (id) => elements.get("#" + id) };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("reporte usa rutas compartidas confirmadas, cantidad exacta y origen global fuera de vista", () => {
  const h = harness();
  const plan = plain(h.run("equipmentTransferPlanData()"));
  assert.equal(plan.shared, true); assert.equal(plan.routes.length, 1);
  assert.deepEqual(plan.events.map((event) => event.id), ["origin", "destination"]);
  const route = plan.routes[0];
  assert.equal(route.from.id, "origin"); assert.equal(route.to.id, "destination");
  assert.equal(route.configured, true); assert.equal(route.confirmed, true);
  assert.equal(route.items[0].warehouseInventoryId, "stock-shared");
  assert.equal(route.items[0].quantity, 2);
  assert.equal(route.items[0].description, "Equipo transferible sintético");
  assert.equal(route.items[0].categoryTitle, "Audio sintético");
  assert.equal(route.timing.departureAt, "2026-10-25T20:00");
  assert.equal(route.timing.rawGapMinutes, 360);
});

test("rutas locales no confirmadas nunca entran en PDF compartido", () => {
  const h = harness();
  h.run("equipmentState.summaryTransferEnabled=true; equipmentState.summaryTransferRoutes=[{id:'local-unconfirmed',eventIds:['origin','destination'],legSelections:{}}]");
  const plan = plain(h.run("equipmentTransferPlanData()"));
  assert.deepEqual(plan.routes.map((entry) => entry.route.id), ["confirmed-transfer"]);
  h.run("equipmentSharedWorkspace.state.transfers=[]; renderEquipmentTransferPdf()");
  assert.equal(h.get("equipmentSaveTransferPdfButton").disabled, true);
  assert.doesNotMatch(h.get("equipmentTransferPdfRoutes").innerHTML, /Equipo transferible/);
});

test("rutas canceladas, inválidas y con extremos inexistentes se excluyen", () => {
  const h = harness();
  h.run(`equipmentSharedWorkspace.state.transfers=[
    {...fixtureTransfer,id:'cancelled-route',status:'cancelled'},
    {...fixtureTransfer,id:'invalid-route'},
    {...fixtureTransfer,id:'orphan-route',toEventId:'missing-event'},
    fixtureTransfer];
    equipmentSharedWorkspace.state.plan.transfers=equipmentSharedWorkspace.state.transfers;
    equipmentSharedWorkspace.state.plan.invalidTransfers=[{id:'invalid-route',message:'Cantidad cambió'}];`);
  assert.deepEqual(plain(h.run("equipmentTransferPlanData().routes.map(entry=>entry.route.id)")), ["confirmed-transfer"]);
});

test("un evento cancelado invalida su ruta sin recuperar datos locales", () => {
  const h = harness(); h.run("fixtureEvents[0].status='cancelled'");
  assert.equal(h.run("equipmentTransferPlanData().routes.length"), 0);
});

test("agenda sucia, desactualizada o en consulta no habilita PDF de trasiego", () => {
  for (const setup of ["equipmentSharedWorkspace.dirty=true", "equipmentSharedWorkspace.saving=true", "fixtureState.stale=true", "fixtureState.refreshing=true", "fixtureState.pending=1", "fixtureState.loaded=false", "fixtureState.plan=null"]) {
    const h = harness(); h.run(setup); h.run("renderEquipmentTransferPdf()");
    assert.equal(h.run("equipmentTransferPlanData().routes.length"), 0, setup);
    assert.equal(h.get("equipmentSaveTransferPdfButton").disabled, true, setup);
    assert.ok(h.run("equipmentTransferPlanData().unavailableReason.length") > 0, setup);
  }
});

test("inventario no cargado o cambiado requiere nueva comprobación del servidor", () => {
  const h = harness(); h.run("equipmentWarehouseInventoryState.loaded=false");
  assert.match(h.run("equipmentTransferPlanData().unavailableReason"), /inventario/);
  h.run("equipmentWarehouseInventoryState.loaded=true; equipmentWarehouseInventoryState.freshness=Date.parse('2026-10-20T09:00:00Z')");
  assert.match(h.run("equipmentTransferPlanData().unavailableReason"), /inventario cambió/);
  assert.equal(h.run("equipmentTransferPlanData().routes.length"), 0);
});

test("revisiones distintas y cantidades sin verificar no se presentan como confirmadas", () => {
  const h = harness(); h.run("fixtureState.plan.revision=3");
  assert.equal(h.run("equipmentTransferPlanData().routes.length"), 0);
  h.run("fixtureState.plan.revision=4; fixtureState.plan.transfers=[{...fixtureTransfer,items:[{warehouseInventoryId:'stock-shared',quantity:1}]}]");
  assert.equal(h.run("equipmentTransferPlanData().routes.length"), 0);
  assert.deepEqual(plain(h.run("equipmentTransferPlanData().excludedTransferIds")), ["confirmed-transfer"]);
});

test("equipo desconocido, consumible, cantidad inválida o logística imposible no pasan al reporte", () => {
  for (const setup of [
    "fixtureTransfer.items[0].warehouseInventoryId='missing-stock'",
    "equipmentWarehouseInventoryState.recordsById.get('stock-shared').consumable=true",
    "fixtureTransfer.items[0].quantity=0",
    "fixtureTransfer.travelMinutes=1000"
  ]) {
    const h = harness(); h.run(setup);
    assert.equal(h.run("equipmentTransferPlanData().routes.length"), 0, setup);
  }
});

test("PDF y destino del cuadro contienen los equipos confirmados y escapan texto", () => {
  const h = harness();
  h.run("equipmentWarehouseInventoryState.recordsById.get('stock-shared').item.name='<img src=x onerror=1>'; fixtureEvents[1].place='<script>destino</script>'; renderEquipmentTransferPdf(); renderEquipmentPdfTransferDestinations()");
  assert.equal(h.get("equipmentSaveTransferPdfButton").disabled, false);
  assert.match(h.get("equipmentTransferPdfRoutes").innerHTML, /&lt;img/);
  assert.match(h.get("equipmentTransferPdfRoutes").innerHTML, />2<\/td>/);
  assert.doesNotMatch(h.get("equipmentTransferPdfRoutes").innerHTML, /<img|<script>/);
  assert.match(h.get("equipmentPdfTransferDestinations").innerHTML, /&lt;script&gt;destino/);
});

test("summary abre administración compartida sin abrir decisión local ni modificar rutas", () => {
  const h = harness();
  h.run("openEquipmentLogisticsDecision=()=>{throw new Error('No local bypass')}; equipmentState.summaryTransferEnabled=true; window.routeCount=equipmentState.summaryTransferRoutes.length; requestEquipmentTransferDecision('summary')");
  assert.equal(h.run("equipmentState.activeWindow"), "summary");
  assert.equal(h.run("equipmentState.summaryTransferEnabled"), false);
  assert.equal(h.run("equipmentState.summaryTransferRoutes.length"), h.run("window.routeCount"));
  assert.match(h.get("equipmentSaveStatus").textContent, /confirme.*agenda compartida/);
  assert.equal(h.get("equipmentSharedRecommendations").scrolled, true);
});

test("preview muestra confirmados y dirige al panel compartido cuando no existen", () => {
  const h = harness();
  assert.equal(h.run("requestEquipmentTransferDecision('preview')"), true);
  assert.equal(h.run("equipmentState.activeWindow"), "transfer");
  assert.equal(h.get("equipmentTransferPanel").scrolled, true);
  h.run("fixtureState.transfers=[]");
  assert.equal(h.run("requestEquipmentTransferDecision('preview')"), false);
  assert.equal(h.run("equipmentState.activeWindow"), "summary");
});

test("modo legacy conserva su cálculo de rutas cuando la agenda compartida está deshabilitada", () => {
  const h = harness();
  h.run(`equipmentSharedWorkspace.enabled=false; equipmentState.events=fixtureEvents; equipmentState.summaryTransferEnabled=true;
    equipmentTransferComparisonRows=()=>[];
    equipmentSummaryTransferRoutesWithEvents=()=>[{route:{id:'legacy-route',eventIds:['origin','destination']},events:fixtureEvents,index:0}];
    equipmentEffectiveTransferRoutes=entries=>entries;
    equipmentTransferredItemsBetweenEvents=()=>[{quantity:1,description:'Equipo legacy sintético'}];
    equipmentSelectedTransferredItemsBetweenEvents=()=>[{quantity:1,description:'Equipo legacy sintético'}];`);
  const plan = plain(h.run("equipmentTransferPlanData()"));
  assert.equal(plan.shared, undefined); assert.equal(plan.routes[0].route.id, "legacy-route");
  assert.equal(plan.routes[0].items[0].quantity, 1);
});
