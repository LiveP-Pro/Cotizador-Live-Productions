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
  for (const name of ["EventPlace", "EventName", "EventType", "EventSetupAt", "EventDate", "EventStartAt", "EventEndAt", "EventInAt", "EventResponsible", "Notes", "MainTable", "PdfMainTable", "PdfTitle", "PdfPlace", "PdfEvent", "PdfDate", "PdfNotes", "SaveStatus", "EventsList", "SaveWindowButton", "SharedStatus", "AgendaFrom", "AgendaTo"]) nodes.set("#equipment" + name, new Element());
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

test("lotes se agregan sin POST de guardado, preservan los seis cuadros y el ledger con cinco ceros", () => {
  const h = harness(), source = syntheticEvents();
  assert.equal(h.importEvents(source.slice(0, 3)).count, 3);
  assert.equal(h.importEvents(source.slice(3)).count, 3);
  const events = h.events(); assert.equal(events.length, 6); assert.equal(new Set(events.map((event) => event.id)).size, 6);
  assert.equal(events.flatMap((event) => event.sections.flatMap((section) => section.items)).filter((item) => item.quantity === 0).length, 5);
  assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
  for (const event of events) {
    const original = source.find((entry) => entry.name === event.name);
    assert.deepEqual(event.sourceCells, original.sourceCells); assert.deepEqual(event.sourceImport, original.sourceImport); assert.deepEqual(event.metadataCells, original.metadataCells);
    assert.equal(event.setupAt || "", ""); assert.equal(event.updatedAt, undefined);
    assert.deepEqual(event.sections.flatMap((section) => section.rows.flatMap((row) => row.cells)), original.sourceCells);
  }
});

test("a six-event batch renders the requested summary once instead of rendering review and summary in sequence", () => {
  const h = harness();
  h.run("window.syntheticRenderCount=0;window.originalSyntheticRender=renderEquipmentModule;renderEquipmentModule=function(...args){window.syntheticRenderCount++;return window.originalSyntheticRender(...args);};");
  h.importEvents(syntheticEvents());
  assert.equal(h.run("window.syntheticRenderCount"), 1);
  assert.equal(h.run("equipmentState.activeWindow"), "summary");
  assert.equal(h.events().length, 6); assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
});

test("un lote invalido es atomico: no acepta cantidad faltante o texto convirtiendola a cero", () => {
  for (const invalidQuantity of [null, undefined, "", "texto", -1]) {
    const h = harness(), source = syntheticEvents(2); source[1].sections[0].items[0].quantity = invalidQuantity;
    assert.throws(() => h.importEvents(source), /cantidad|descripción|descripcion/);
    assert.equal(h.events().length, 0); assert.equal(h.requests.length, 0);
  }
});

test("navegar, crear ventana y refrescar la agenda conserva celdas, metadata y cinco ceros del lote local", () => {
  const h = harness(), source = syntheticEvents(); h.importEvents(source); const originalEvents = h.events(), ids = originalEvents.map((event) => event.id); h.shared([]);
  for (const id of ids) h.selectEvent(id);
  h.run("startNewEquipmentWindowDraft()");
  h.run("applyEquipmentSharedState(window.syntheticSharedState)");
  assert.equal(h.events().length, 6);
  for (const id of ids) {
    h.selectEvent(id); const event = h.events().find((entry) => entry.id === id), original = originalEvents.find((entry) => entry.id === id);
    assert.deepEqual(event.sourceCells, original.sourceCells); assert.deepEqual(event.sourceImport, original.sourceImport);
    assert.deepEqual(event.sections.flatMap((section) => section.rows.flatMap((row) => row.cells)), original.sourceCells);
  }
  assert.equal(h.events().flatMap((event) => event.sections.flatMap((section) => section.items)).filter((item) => item.quantity === 0).length, 5);
  assert.equal(h.requests.length, 0);
});

test("eliminar borrador activo solo quita ese cuadro y no toca otros eventos ni inventario", async () => {
  const h = harness(); h.importEvents(syntheticEvents()); h.shared([]); const before = h.events(), id = before[0].id;
  assert.equal(await h.run(`cancelEquipmentSharedEvent(${JSON.stringify(id)})`), true);
  const after = h.events(); assert.equal(after.length, 5); assert.ok(!after.some((event) => event.id === id));
  for (const event of after) assert.deepEqual(event.sourceCells, before.find((entry) => entry.id === event.id).sourceCells);
  assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
});

test("cancelar confirmacion de un evento remoto conserva sus datos y no envia solicitudes", async () => {
  const h = harness(); h.importEvents(syntheticEvents(2)); const events = h.events().map((event) => ({ ...event, updatedAt: "synthetic-existing-v1" })); h.shared(events);
  h.context.window.syntheticRemote = events; h.run("equipmentPlannerDirtyIds.clear();equipmentSharedWorkspace.dirty=false;applyEquipmentSharedState(window.syntheticSharedState)"); h.selectEvent(events[0].id);
  const before = h.events(); assert.equal(await h.run(`cancelEquipmentSharedEvent(${JSON.stringify(events[0].id)})`), false);
  assert.deepEqual(h.events(), before); assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
});

test("confirmar otro cuadro conserva ediciones independientes de dos eventos y todos sus datos fuente", async () => {
  const h = harness(); h.importEvents(syntheticEvents(3)); const existing = h.events().map((event) => ({ ...event, updatedAt: "synthetic-existing-v1" })); h.shared(existing);
  h.run("equipmentPlannerDirtyIds.clear();equipmentSharedWorkspace.dirty=false;applyEquipmentSharedState(window.syntheticSharedState)");
  const [first, second, third] = existing;
  h.selectEvent(first.id); h.field("EventPlace", "Primera ubicacion editada"); h.field("Notes", "Primera nota editada"); h.markDirty();
  h.selectEvent(second.id); h.field("EventPlace", "Segunda ubicacion editada"); h.field("Notes", "Segunda nota editada"); h.markDirty();
  h.selectEvent(third.id); h.field("EventSetupAt", "2026-11-07T08:00"); h.field("EventStartAt", "2026-11-07T12:00"); h.field("EventEndAt", "2026-11-07T14:00"); h.field("EventInAt", "2026-11-07T17:00"); h.markDirty();
  await h.run("saveEquipmentSharedWindow()");
  assert.equal(h.saves.length, 1); assert.equal(h.saves[0].id, third.id);
  const after = h.events(), a = after.find((event) => event.id === first.id), b = after.find((event) => event.id === second.id);
  assert.equal(a.place, "Primera ubicacion editada"); assert.equal(a.notes, "Primera nota editada"); assert.equal(b.place, "Segunda ubicacion editada"); assert.equal(b.notes, "Segunda nota editada");
  assert.deepEqual(a.sourceCells, first.sourceCells); assert.deepEqual(b.sourceCells, second.sourceCells); assert.deepEqual(a.sourceImport, first.sourceImport); assert.deepEqual(b.sourceImport, second.sourceImport);
  assert.equal(h.run(`equipmentPlannerDirtyIds.has(${JSON.stringify(first.id)})`), true); assert.equal(h.run(`equipmentPlannerDirtyIds.has(${JSON.stringify(second.id)})`), true);
  assert.equal(h.requests.length, 0);
});

test("puede quitar otro borrador sin exigir confirmar la ventana activa y conserva sus ediciones", async () => {
  const h = harness(); h.importEvents(syntheticEvents(3)); h.shared([]); const before = h.events(), [first, second] = before;
  h.selectEvent(first.id); h.field("EventPlace", "Ubicacion activa sin guardar"); h.field("Notes", "Nota activa sin guardar"); h.markDirty();
  assert.equal(await h.run(`cancelEquipmentSharedEvent(${JSON.stringify(second.id)})`), true);
  const after = h.events(); assert.equal(after.length, 2); assert.ok(!after.some((event) => event.id === second.id));
  const active = after.find((event) => event.id === first.id); assert.equal(active.place, "Ubicacion activa sin guardar"); assert.equal(active.notes, "Nota activa sin guardar"); assert.deepEqual(active.sourceCells, first.sourceCells);
  assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
});

test("guardar y reabrir JSON editable conserva las celdas originales, notas de celda y cinco ceros", () => {
  const h = harness(), source = syntheticEvents(); h.importEvents(source);
  const before = h.events(); const payload = h.run("JSON.stringify(equipmentEditablePayload('rent'))");
  assert.throws(() => h.run(`importEquipmentEditablePayload(${payload})`), /guardar|cambios|borrador|sin confirmar/i);
  assert.deepEqual(h.events(), before);
  const fresh = harness(); fresh.run(`importEquipmentEditablePayload(${payload})`);
  const after = fresh.events(); assert.equal(after.length, 6);
  for (const event of after) {
    const original = before.find((entry) => entry.name === event.name);
    assert.deepEqual(event.sourceCells, original.sourceCells); assert.deepEqual(event.sourceImport, original.sourceImport); assert.deepEqual(event.metadataCells, original.metadataCells);
    assert.deepEqual(event.sections.flatMap((section) => section.rows.flatMap((row) => row.cells)), original.sourceCells);
  }
  assert.equal(after.flatMap((event) => event.sections.flatMap((section) => section.items)).filter((item) => item.quantity === 0).length, 5);
  assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
});

test("vincular manualmente y elegir renta o compra conserva toda metadata original de una linea objeto en cero", () => {
  const h = harness(), source = syntheticEvents(1), item = source[0].sections[0].items[0];
  delete item.warehouseInventoryId;
  Object.assign(item, { note: "Nota escalar literal de linea", notes: ["Nota de lista literal"], sourceMetadata: { originalColumn: "B", zero: 0, nested: { preserve: true } }, sourceCells: plain(source[0].sourceCells.slice(2, 4)), sourceRefs: ["synthetic:0:A2", "synthetic:0:B2"], observations: "Observacion original" });
  h.importEvents(source);
  h.run("applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'physical-manual-synthetic',name:'Equipo fisico diferente confirmado',category:'Categoria actual sintetica',quantity:3,itemType:'equipo'}],movements:[]}})");
  const event = h.events()[0];
  h.context.window.syntheticSources = [{ eventId: event.id, sectionIndex: 0, itemIndex: 0, description: item.description }];
  function retained() {
    const current = h.events()[0].sections[0].items[0]; assert.equal(current.quantity, 0);
    for (const field of ["note", "notes", "sourceMetadata", "sourceCells", "sourceRefs", "observations"]) assert.deepEqual(current[field], item[field], field);
    assert.deepEqual(h.events()[0].sourceCells, source[0].sourceCells); return current;
  }
  retained();
  h.run("window.liveEquipmentPlanner.bindIdentity(window.syntheticSources,'physical-manual-synthetic')");
  let current = retained(); assert.equal(current.warehouseInventoryId, "physical-manual-synthetic"); assert.equal(current.inventoryIdentityConfirmed.itemId, "physical-manual-synthetic");
  h.run("window.liveEquipmentPlanner.chooseProcurement(window.syntheticSources,'purchase')");
  current = retained(); assert.equal(current.procurementChoice, "purchase"); assert.equal(current.warehouseInventoryId, undefined);
  h.run("window.liveEquipmentPlanner.chooseProcurement(window.syntheticSources,'rent')"); current = retained(); assert.equal(current.procurementChoice, "rent");
  h.run("startNewEquipmentWindowDraft()"); h.selectEvent(event.id); retained();
  assert.equal(h.requests.length, 0); assert.equal(h.saves.length, 0);
});

test("reimporting the same file does not duplicate edited drafts and selects the source report dates", () => {
  const h = harness(), source = syntheticEvents(2);
  source.forEach((event, index) => { Object.assign(event.sourceImport, { sha256: "synthetic-current-file", sheet: "Fuente actual", block: index }); });
  source[0].setupAt = "2026-11-04T18:00";
  source[1].equipmentInAt = "2026-11-08T03:00";
  h.field("AgendaFrom", "2026-11-23"); h.field("AgendaTo", "2026-11-29");
  const first = h.importEvents(source);
  assert.equal(first.addedCount, 2);
  assert.equal(first.events.length, 2);
  assert.equal(h.nodes.get("#equipmentAgendaFrom").value, "2026-11-04");
  assert.equal(h.nodes.get("#equipmentAgendaTo").value, "2026-11-08");
  h.selectEvent(first.events[0].id); h.field("Notes", "Correccion manual que se debe conservar"); h.markDirty();
  const again = h.importEvents(source);
  assert.equal(again.addedCount, 0);
  assert.equal(h.events().length, 2);
  assert.deepEqual(again.events.map(event => event.id), first.events.map(event => event.id));
  assert.equal(h.events().find(event => event.id === first.events[0].id).notes, "Correccion manual que se debe conservar");
  assert.equal(h.requests.length, 0);
});

test("file report actions use the imported event IDs and surface a failed download without reimporting", async () => {
  const h = harness(), result = h.importEvents(syntheticEvents(2));
  h.context.window.syntheticReportResult = result;
  h.run("window.syntheticReportCalls=[];equipmentPlannerInstance={render(){},async download(mode,button,events){window.syntheticReportCalls.push({mode,events});return {ok:false,message:'Fallo sintetico de descarga'};}};");
  await assert.rejects(h.run("window.liveEquipmentPlanner.afterImport('rent',{result:window.syntheticReportResult})"), /Fallo sintetico/);
  const calls = plain(h.context.window.syntheticReportCalls);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].events.map(event => event.id), result.events.map(event => event.id));
  assert.equal(h.events().length, 2);
  assert.equal(h.requests.length, 0);
});
