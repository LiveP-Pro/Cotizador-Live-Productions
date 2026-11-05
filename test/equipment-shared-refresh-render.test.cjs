const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const plain = (value) => JSON.parse(JSON.stringify(value));

// Synthetic UI and document fixtures only. No production catalog, workbook,
// inventory, prior export, or saved event is used by these regression tests.
function syntheticEvents(size = 6) {
  return Array.from({ length: size }, (_, index) => {
    const sourceCells = [
      { ref: `synthetic:${index}:A1`, sheet: `Synthetic ${index}`, address: "A1", value: "Lugar del evento:", sourceOrder: 0 },
      { ref: `synthetic:${index}:B1`, sheet: `Synthetic ${index}`, address: "B1", value: `Lugar sintetico ${index}`, sourceOrder: 0 },
      { ref: `synthetic:${index}:A2`, sheet: `Synthetic ${index}`, address: "A2", value: index < 5 ? 0 : 1, sourceOrder: 1 },
      { ref: `synthetic:${index}:B2`, sheet: `Synthetic ${index}`, address: "B2", value: `Equipo sintetico ${index}`, sourceOrder: 1 },
      { ref: `synthetic:${index}:B3`, sheet: `Synthetic ${index}`, address: "B3", value: "Nota literal con espacios  ", note: "Nota de celda sintetica", sourceOrder: 2 }
    ];
    const sections = [{ id: `section-${index}`, title: "Categoria sintetica", items: [{ id: `item-${index}`, quantity: index < 5 ? 0 : 1, description: `Equipo sintetico ${index}`, warehouseInventoryId: `stock-${index}`, itemType: "equipo", sourceItemIndex: 0 }], rows: [
      { type: "metadata", sourceOrder: 0, quantity: null, description: "Lugar del evento: | Lugar sintetico", cells: sourceCells.slice(0, 2) },
      { type: "item", sourceOrder: 1, sourceItemIndex: 0, quantity: index < 5 ? 0 : 1, description: `Equipo sintetico ${index}`, cells: sourceCells.slice(2, 4), quantityRefs: [sourceCells[2].ref], descriptionRefs: [sourceCells[3].ref] },
      { type: "note", sourceOrder: 2, quantity: null, description: "Nota literal con espacios  ", cells: sourceCells.slice(4) }
    ] }];
    return { id: `source-synthetic-${index}`, name: `Cliente sintetico ${index}`, place: `Lugar sintetico ${index}`, type: "Evento sintetico", date: `2026-11-${String(5 + index % 3).padStart(2, "0")}`, notes: `  Nota evento ${index}\nLinea dos  `,
      sourceCells, metadataCells: sourceCells.slice(0, 2), sourceImport: { fileName: "Solo sintetico.xlsx", metadata: { place: `Lugar sintetico ${index}`, date: "Fecha literal sintetica" }, sourceCells }, sections, documentSections: sections, snapshotLocked: true };
  });
}
function harness() {
  const nodes = new Map(), requests = [], saves = [];
  class Element {
    constructor() { this.value = ""; this.textContent = ""; this.innerHTML = ""; this.dataset = {}; this.children = []; this.listeners = {}; this.disabled = false; const classes = new Set(); this.classList = { add: (value) => classes.add(value), remove: (value) => classes.delete(value), contains: (value) => classes.has(value), toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); } }; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    setAttribute() {} removeAttribute() {} scrollIntoView() {} querySelector() { return null; } querySelectorAll() { return []; }
    append(element) { this.children.push(element); }
  }
  class Option { constructor(text, value, defaultSelected, selected) { Object.assign(this, { text, value, defaultSelected: !!defaultSelected, selected: !!selected }); } }
  for (const name of ["EventPlace", "EventName", "EventType", "EventSetupAt", "EventDate", "EventStartAt", "EventEndAt", "EventInAt", "EventResponsible", "Notes", "MainTable", "PdfMainTable", "PdfTitle", "PdfPlace", "PdfEvent", "PdfDate", "PdfNotes", "SaveStatus", "EventsList", "SaveWindowButton", "SharedStatus", "AgendaFrom", "AgendaTo", "PlannerOverview", "PlannerPending", "PlannerSummary", "PlannerStatus", "InventoryTable", "SharedRecommendations"]) nodes.set("#equipment" + name, new Element());
  nodes.get("#equipmentAgendaFrom").value = "2026-11-02"; nodes.get("#equipmentAgendaTo").value = "2026-11-08";
  const select = new Element(); select.multiple = true; select.options = []; select.replaceChildren = () => { select.options = []; }; select.add = (option) => select.options.push(option); select.append = (group) => select.options.push(...group.children); Object.defineProperty(select, "selectedOptions", { get: () => select.options.filter((option) => option.selected) }); nodes.set("#equipmentServiceSelect", select);
  const context = vm.createContext({ console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise, Option,
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    window: { requerimientoEquipoCatalog: { version: "synthetic-planner-bridge", services: {}, groups: [] }, requerimientoEquipoInventory: { categories: [] }, location: { protocol: "http:", hash: "#requerimiento-equipo" }, setTimeout() { return 1; }, requestAnimationFrame(callback) { callback(); }, confirm() { return false; }, EquipmentPlanner: { create(bridge) { return { init() { return { render() {} }; } }; } } },
    document: { querySelector: (selector) => nodes.get(selector) || null, querySelectorAll() { return []; }, addEventListener() {}, dispatchEvent() {}, createElement: () => new Element() },
    fetch: async (url, init = {}) => { requests.push({ url, init }); throw new Error("Esta prueba no debe escribir ni consultar una red real"); }
  });
  const run = (code) => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, "..", "equipment-workspace.js"), "utf8"));
  for (const asset of ["equipment-identity.js", "equipment-document-audit.js", "equipment-planner.js"]) run(fs.readFileSync(path.join(__dirname, "..", asset), "utf8"));
  context.window.EquipmentIdentity = context.EquipmentIdentity; context.window.EquipmentDocumentAudit = context.EquipmentDocumentAudit; context.window.EquipmentPlanner = context.EquipmentPlanner;
  run(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"));
  run("populateNativeEquipmentServiceSelect(); initEquipmentPlannerBridge();");
  function importEvents(events) { context.window.syntheticImport = plain(events); return plain(run("window.liveEquipmentPlanner.importEvents(window.syntheticImport)")); }
  function events() { return plain(run("window.liveEquipmentPlanner.events()")); }
  function selectEvent(id) { return run(`loadEquipmentEvent(${JSON.stringify(id)})`); }
  function field(name, value) { nodes.get("#equipment" + name).value = value; }
  function markDirty() { run("markEquipmentSharedDirty()"); }
  function shared(remoteEvents = []) {
    context.window.syntheticSharedEvents = plain(remoteEvents);
    context.window.syntheticSaves = saves;
    run(`equipmentSharedWorkspace.enabled=true;
      window.syntheticSharedState={events:window.syntheticSharedEvents,transfers:[],plan:{rows:[]},range:{from:'2026-11-02',to:'2026-11-08'},loaded:true};
      equipmentSharedWorkspace.client={
        getState(){return window.syntheticSharedState;},visibleEvents(){return window.syntheticSharedState.events;},setRange(range){window.syntheticSharedState.range=range;},
        async save(event){const saved={...JSON.parse(JSON.stringify(event)),updatedAt:'synthetic-saved-v2',status:'confirmed'};window.syntheticSaves.push(saved);window.syntheticSharedState.events=window.syntheticSharedState.events.filter(item=>item.id!==saved.id).concat(saved);return saved;},
        async refresh(){applyEquipmentSharedState(window.syntheticSharedState);return window.syntheticSharedState;},
        async cancel(){throw new Error('No se debe cancelar una reserva real en esta prueba');}
      };`);
  }
  return { context, run, importEvents, events, selectEvent, field, markDirty, requests, saves, shared, nodes };
}


function realWorkspace(h, events = []) {
  const server = { events: plain(events), revision: "refresh-test-v1", rows: [], transfers: [], routeEstimates: [], fail: false, requests: [] };
  h.context.window.refreshTestFetch = async (url, init = {}) => {
    server.requests.push({ url, method: init.method || "GET" });
    if (server.fail) return { ok: false, status: 503, json: async () => ({ error: "Error de conexión simulado; el cuadro se conserva." }) };
    if (init.method === "PUT") {
      const event = { ...JSON.parse(init.body).event, updatedAt: "2026-11-05T12:00:01.000Z" };
      server.events = server.events.filter(item => item.id !== event.id).concat(event); server.revision += "-saved";
      return { ok: true, json: async () => ({ event, events: plain(server.events), revision: server.revision }) };
    }
    return { ok: true, json: async () => url.includes("/eventos")
      ? { events: plain(server.events), transfers: plain(server.transfers), revision: server.revision }
      : { rows: plain(server.rows), revision: server.revision, from: "2026-11-02", to: "2026-11-08" } };
  };
  h.run(`equipmentSharedWorkspace.enabled=true;
    window.refreshTestRenders=0;window.refreshTestPlans=0;window.refreshTestPlannerRenders=0;window.refreshTestStates=[];
    const originalRefreshTestRender=renderEquipmentModule;renderEquipmentModule=function(...args){window.refreshTestRenders++;return originalRefreshTestRender(...args);};
    const originalRefreshTestPlan=renderEquipmentSharedPlan;renderEquipmentSharedPlan=function(...args){window.refreshTestPlans++;return originalRefreshTestPlan(...args);};
    const originalRefreshTestPlanner=equipmentPlannerInstance.render;equipmentPlannerInstance.render=function(...args){window.refreshTestPlannerRenders++;return originalRefreshTestPlanner(...args);};
    equipmentSharedWorkspace.client=window.EquipmentWorkspace.create({date:'2026-11-05',fetch:window.refreshTestFetch,onState:state=>{
      applyEquipmentSharedState(state);window.refreshTestStates.push({refreshing:state.refreshing,pending:state.pending,error:state.lastError,status:equipmentQuery('#equipmentSharedStatus').textContent,isError:equipmentQuery('#equipmentSharedStatus').classList.contains('is-error')});
    }});`);
  return { server, refresh: () => h.run("equipmentSharedWorkspace.client.refresh()"), renders: () => h.run("window.refreshTestRenders"), reset: () => h.run("window.refreshTestRenders=0;window.refreshTestPlans=0;window.refreshTestPlannerRenders=0;window.refreshTestStates=[]"), states: () => plain(h.context.window.refreshTestStates) };
}

test("real workspace refreshes preserve six drafts while identical data does not redraw tables or Planner", async () => {
  const h = harness(); h.importEvents(syntheticEvents()); const workspace = realWorkspace(h);
  await workspace.refresh(); const before = h.events(); workspace.reset();
  for (let index = 0; index < 21; index++) await workspace.refresh();
  assert.equal(workspace.renders(), 0); assert.equal(h.run("window.refreshTestPlans"), 0); assert.equal(h.run("window.refreshTestPlannerRenders"), 0);
  assert.deepEqual(h.events(), before); assert.equal(h.events().length, 6);
  assert.equal(h.events().flatMap(event => event.sections.flatMap(section => section.items)).filter(item => item.quantity === 0).length, 5);
  assert.equal(workspace.server.requests.length, 44); assert.ok(workspace.server.requests.every(request => request.method === "GET"));
  const states = workspace.states(); assert.equal(states.length, 63); assert.ok(states.some(state => state.refreshing && /Actualizando agenda/.test(state.status)));
  assert.match(states.at(-1).status, /Cambios sin guardar/); assert.equal(states.at(-1).isError, false);
});

test("inventory and external event changes redraw once and do not duplicate the plan or Planner", async () => {
  const h = harness(), remote = syntheticEvents(1).map(event => ({ ...event, updatedAt: "2026-11-05T10:00:00.000Z" }));
  const workspace = realWorkspace(h, remote); await workspace.refresh(); workspace.reset();
  h.run("applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'stock-0',name:'Equipo sintetico 0',category:'Categoria sintetica',quantity:27,itemType:'equipo'}],movements:[]}})");
  await workspace.refresh(); assert.equal(workspace.renders(), 1); assert.equal(h.run("window.refreshTestPlans"), 1); assert.equal(h.run("window.refreshTestPlannerRenders"), 1);
  assert.equal(h.run("equipmentPlannerInstance.model().rows[0].available"), 27);
  workspace.reset();
  h.run("applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'stock-0',name:'Equipo sintetico 0',category:'Categoria sintetica',quantity:26,itemType:'equipo'}],movements:[]}})");
  await workspace.refresh(); assert.equal(workspace.renders(), 1); assert.equal(h.run("equipmentPlannerInstance.model().rows[0].available"), 26);
  workspace.reset(); workspace.server.events[0].place = "Ubicación externa actualizada"; workspace.server.events[0].updatedAt = "2026-11-05T11:00:00.000Z";
  await workspace.refresh(); assert.equal(workspace.renders(), 1); assert.equal(h.events()[0].place, "Ubicación externa actualizada");
  workspace.reset(); workspace.server.rows = [{ description: "Cambio real del plan", quantity: 0 }]; await workspace.refresh(); assert.equal(workspace.renders(), 1);
});

test("refresh errors remain visible through the final emission and recovery updates the state", async () => {
  const h = harness(); h.importEvents(syntheticEvents(1)); const workspace = realWorkspace(h); await workspace.refresh(); const before = h.events(); workspace.reset();
  workspace.server.fail = true; await assert.rejects(workspace.refresh(), /Error de conexión simulado/);
  assert.deepEqual(h.events(), before); assert.equal(workspace.renders(), 1);
  let states = workspace.states(); assert.ok(states.at(-1).isError); assert.match(states.at(-1).status, /Error de conexión simulado/); assert.equal(states.at(-1).refreshing, false);
  workspace.reset(); workspace.server.fail = false; await workspace.refresh(); states = workspace.states(); assert.equal(states.at(-1).isError, false); assert.match(states.at(-1).status, /Cambios sin guardar/);
  assert.equal(h.events().length, 1);
});

test("navigation updates the render fingerprint and refreshes preserve independent edits and source cells", async () => {
  const h = harness(); h.importEvents(syntheticEvents(2)); const workspace = realWorkspace(h); await workspace.refresh(); const ids = h.events().map(event => event.id);
  h.selectEvent(ids[1]); workspace.reset(); await workspace.refresh(); assert.equal(workspace.renders(), 0);
  h.field("EventPlace", "Lugar editado sin confirmar"); h.field("Notes", "Nota original editada"); h.markDirty(); await workspace.refresh();
  assert.equal(workspace.renders(), 1); const edited = h.events().find(event => event.id === ids[1]); assert.equal(edited.place, "Lugar editado sin confirmar"); assert.equal(edited.notes, "Nota original editada");
  assert.deepEqual(edited.sourceCells, syntheticEvents(2)[1].sourceCells);
  h.selectEvent(ids[0]); h.selectEvent(ids[1]); workspace.reset(); await workspace.refresh(); assert.equal(workspace.renders(), 0);
  assert.equal(h.events().find(event => event.id === ids[1]).place, "Lugar editado sin confirmar"); assert.ok(workspace.server.requests.every(request => request.method === "GET"));
});

test("real workspace save emissions expose the pending state and render the saved agenda", async () => {
  const h = harness(), event = syntheticEvents(1)[0], workspace = realWorkspace(h); await workspace.refresh(); workspace.reset();
  h.context.window.refreshTestEvent = event; await h.run("equipmentSharedWorkspace.client.save(window.refreshTestEvent)");
  const states = workspace.states(); assert.ok(states.some(state => state.pending === 1 && /Guardando cambios/.test(state.status)));
  assert.equal(states.at(-1).pending, 0); assert.equal(h.events().length, 1); assert.equal(h.events()[0].updatedAt, "2026-11-05T12:00:01.000Z");
  assert.equal(workspace.server.requests.filter(request => request.method === "PUT").length, 1); assert.equal(h.run("window.refreshTestPlans"), workspace.renders()); assert.equal(h.run("window.refreshTestPlannerRenders"), workspace.renders());
});
