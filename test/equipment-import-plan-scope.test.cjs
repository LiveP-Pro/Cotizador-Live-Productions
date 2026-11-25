"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Reporting = require("../equipment-reporting.cjs");
const copy = value => JSON.parse(JSON.stringify(value));
const decode = value => String(value).replace(/&quot;/g, '\"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const camel = value => value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function documentHarness() {
  let document;
  class Element {
    constructor(tag = "div", attributes = {}) {
      this.tagName = tag.toLowerCase(); this.attributes = attributes; this.children = []; this.parentElement = null;
      this.listeners = {}; this.dataset = {}; this.disabled = Object.hasOwn(attributes, "disabled"); this.checked = Object.hasOwn(attributes, "checked");
      this.value = attributes.value || ""; this._text = ""; this._html = ""; this.className = attributes.class || "";
      for (const [name, value] of Object.entries(attributes)) if (name.startsWith("data-")) this.dataset[camel(name.slice(5))] = value;
      this.classList = { toggle: (name, force) => { const classes = new Set(this.className.split(/\s+/).filter(Boolean)); const include = force === undefined ? !classes.has(name) : force; include ? classes.add(name) : classes.delete(name); this.className = [...classes].join(" "); } };
    }
    append(child) { child.parentElement = this; this.children.push(child); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); this.parentElement = null; }
    get innerHTML() { return this._html; }
    set innerHTML(value) {
      this._html = String(value); this._text = ""; this.children = [];
      const stack = [this]; const voids = new Set(["input", "img", "br", "hr", "meta", "link"]);
      for (const token of this._html.matchAll(/<\/?[A-Za-z][^>]*>|[^<]+/g)) {
        const raw = token[0];
        if (raw.startsWith("</")) { const tag = raw.match(/^<\/([A-Za-z0-9-]+)/)[1].toLowerCase(); while (stack.length > 1) { if (stack.pop().tagName === tag) break; } continue; }
        if (!raw.startsWith("<")) { const literal=decode(raw),current=stack.at(-1);current._text+=literal;if(current.tagName==='textarea')current.value+=literal;continue; }
        const tag = raw.match(/^<([A-Za-z0-9-]+)/)[1].toLowerCase(); const attributes = {};
        const attrText = raw.slice(tag.length + 1, -1);
        for (const match of attrText.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attributes[match[1]] = decode(match[2] ?? match[3] ?? match[4] ?? "");
        const child = new Element(tag, attributes); stack.at(-1).append(child);
        if (!voids.has(tag)) stack.push(child);
      }
    }
    set textContent(value) { this._text = String(value); this.children = []; this._html = ""; }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
    matches(selector) {
      let current = selector.trim();
      if (current.includes(":not([disabled])")) { if (this.disabled) return false; current = current.replace(":not([disabled])", ""); }
      const tag = current.match(/^[A-Za-z][A-Za-z0-9-]*/)?.[0]; if (tag && this.tagName !== tag.toLowerCase()) return false;
      const id = current.match(/#([A-Za-z0-9_-]+)/)?.[1]; if (id && this.attributes.id !== id) return false;
      const className = current.match(/\.([A-Za-z0-9_-]+)/)?.[1]; if (className && !this.className.split(/\s+/).includes(className)) return false;
      for (const match of current.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)) {
        if (match[1] === "disabled") { if (!this.disabled) return false; continue; }
        const actual = this.attributes[match[1]];
        if (actual === undefined || match[2] !== undefined && actual !== match[2]) return false;
      }
      return true;
    }
    querySelectorAll(selector) {
      const selectors = selector.split(","); const found = [];
      function visit(element) { for (const child of element.children) { if (selectors.some((item) => child.matches(item))) found.push(child); visit(child); } }
      visit(this); return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    async emit(type, extras = {}) { if (this.disabled && ["click", "change"].includes(type)) return; const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...extras }; for (const listener of this.listeners[type] || []) await listener(event); }
    click() { return this.emit("click"); }
    focus() { document.activeElement = this; }
    getClientRects() { return this.parentElement ? [{}] : []; }
  }
  document = { createElement: (tag) => new Element(tag), activeElement: null, body: new Element("body") };
  document.querySelector = (selector) => document.body.querySelector(selector); document.querySelectorAll = (selector) => document.body.querySelectorAll(selector);
  const focus = new Element("button"); document.body.append(focus); focus.focus();
  return document;
}

function sourceEvent(index = 0, quantity = 3) {
  const hour = 8 + index * 4; const at = value => `2026-11-25T${String(value).padStart(2,"0")}:00`;
  const cells = [{ sheet: `Sintética ${index}`, row: 1, column: 1, address: "A1", ref: `current:${index}:A1`, value: quantity, note: "Nota literal  " },
    { sheet: `Sintética ${index}`, row: 1, column: 2, address: "B1", ref: `current:${index}:B1`, value: "Unidad sintética" }];
  return { id: `source-${index}`, name: `Cliente sintético ${index}`, client: `Cliente sintético ${index}`, place: "Sede sintética", type: "Prueba", date: "2026-11-25",
    setupApplies: true, setupAt: at(hour), startAt: at(hour), endAt: at(hour+1), equipmentInAt: "2026-11-26T12:00", notes: "  Nota original  ", sourceCells: copy(cells),
    sourceImport: { fileName: "Fuente actual sintética.xlsx", format: "xlsx", sha256: `bytes-${index}`, sheet: `Sintética ${index}`, block: `table-${index}`,
      sourceBlockKey: `table-${index}`, sourceCells: copy(cells), metadata: { parsedDate: "2026-11-25", client: `Cliente sintético ${index}`, place: "Sede sintética" } },
    sections: [{ id: `section-${index}`, title: "Pruebas", notes: [" Nota de sección "], sourceCells: copy(cells),
      rows: [{ type: "item", quantity, description: "Unidad sintética", sourceItemIndex: 0, cells: copy(cells) }, { type: "note", description: "Nota literal del cuadro" }],
      items: [{ id: `line-${index}`, warehouseInventoryId: "synthetic-unit", description: "Unidad sintética", quantity, sourceCells: copy(cells) }] }] };
}
function stock(quantity=3) { return { savedAt: "synthetic-current", state: { items: [{ id: "synthetic-unit", name: "Unidad sintética", category: "Pruebas", quantity, itemType: "equipo" }], movements: [] } }; }
const routeEstimates = [{ fromPlace: "Sede sintética", toPlace: "Sede sintética", travelMinutes: 0, handlingMinutes: 120 }];
function integration({ source = [] } = {}) {
  const document = documentHarness(), nodes = new Map(), calls = [], writes = [], displayed = [], server = { events: [], requests: [], reports: [], revision: "scope-synthetic-v1" };
  document.addEventListener = () => {}; document.dispatchEvent = () => {};
  const originalQuery = document.querySelector.bind(document);
  document.querySelector = selector => nodes.get(selector) || originalQuery(selector);
  for (const name of ["EventPlace","EventName","EventType","EventSetupAt","EventSetupApplies","EventDate","EventStartAt","EventEndAt","EventInAt","EventResponsible","Notes","SaveStatus","SharedStatus","AgendaFrom","AgendaTo","PlannerOverview","PlannerPending","PlannerStatus","PlannerSummary","PlannerSearch","PlannerOnlyPending"]) {
    const element = document.createElement("div"); element.setAttribute = () => {}; element.removeAttribute = () => {}; element.scrollIntoView = () => {};
    element.classList.add = () => {}; element.classList.remove = () => {}; element.classList.contains = () => false;
    nodes.set(`#equipment${name}`,element); document.body.append(element);
  }
  let inventory = stock(1000); let reportTicket = 0;
  class TestURL extends URL { static createObjectURL(){return 'blob:synthetic';} static revokeObjectURL(){} }
  const context = vm.createContext({ console, URL: TestURL, Blob, Date, Intl, Map, Set, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},document });
  context.window = context; Object.assign(context, { requerimientoEquipoCatalog: { version:"current-test-only",services:{},groups:[] }, requerimientoEquipoInventory:{categories:[]},
    location:{protocol:"https:",hash:"#requerimiento-equipo"},addEventListener(){},requestAnimationFrame(fn){fn();},confirm(){return false;},LiveAccess:{can(){return true;}},LIVE_SESSION:{} });
  context.fetch = async (url, init={}) => {
    if ((init.method || "GET") === "GET" && ["/api/cuadros-equipo/eventos", "/api/cuadros-equipo/disponibilidad"].some(prefix => url.startsWith(prefix))) {
      server.requests.push({ url, method: "GET" });
      return { ok: true, status: 200, json: async () => url.startsWith("/api/cuadros-equipo/eventos")
        ? { events: copy(server.events), transfers: [], revision: server.revision }
        : { rows: [], revision: server.revision, ...Object.fromEntries(new URL(url, "https://synthetic.invalid").searchParams) } };
    }
    if (server.allowSave && init.method === "PUT" && url.startsWith("/api/cuadros-equipo/eventos/")) {
      const event = { ...JSON.parse(init.body).event, status: "confirmed", updatedAt: "2026-11-01T14:00:00.000Z" };
      server.requests.push({ url, method: "PUT" });
      server.events = server.events.filter(existing => existing.id !== event.id).concat(copy(event)); server.revision += "-saved";
      return { ok: true, status: 200, json: async () => ({ event: copy(event), events: copy(server.events), revision: server.revision }) };
    }
    if(url!=="/api/cuadros-equipo/reportes/provisional"||init.method!=="POST"){writes.push({url,init});throw new Error("No stock or event writes allowed");}
    const body=JSON.parse(init.body);calls.push({url,init,body});
    const report = Reporting.createEquipmentReportModel(body, inventory, { now: Date.parse("2026-11-01T12:00:00Z"), storedEvents: server.events });
    server.reports.push(report);
    const plan = report.draftLogistics;
    if(body.mode==="plan")return {ok:true,status:200,json:async()=>copy(plan)};
    if(["transfer","rent","purchase"].includes(body.mode))return {ok:true,status:200,headers:{get(name){return {"Content-Type":"text/html; charset=utf-8","X-Equipment-Report-Status":"provisional"}[name]||null;}},text:async()=>`<html><body>${JSON.stringify(plan.rows.map(row=>({rental:row.rental,purchase:row.purchase})))}</body></html>`};
    return {ok:true,status:200,headers:{get(name){return name==="Content-Type"?"application/octet-stream":name==="Content-Disposition"?`attachment; filename="current.${body.mode==="master"?"xlsx":"pdf"}"`:null;}},blob:async()=>new Blob([body.mode==="master"?"PKsynthetic":"%PDF-synthetic"])};
  };
  const run = code => vm.runInContext(code,context);
  for(const file of ["equipment-workspace.js","equipment-location.js","equipment-identity.js","equipment-import-identity.js","equipment-document-audit.js","equipment-draft-substitutions.js","equipment-transfer-presentation.js","equipment-draft-transfers.js","equipment-planner.js","equipment.js"])run(fs.readFileSync(require.resolve(`../${file}`),"utf8"));
  run(`renderEquipmentModule=()=>{if(window.testPlanner)window.testPlanner.render();};
    loadEquipmentEvent=id=>{equipmentState.selectedEventId=id;const event=selectedEquipmentEvent();if(event){restoreEquipmentEventSnapshot(event);populateEquipmentEventFields(event);}equipmentState.activeWindow='summary';renderEquipmentModule();return !!event;};
    equipmentSharedWorkspace.state={events:[],transfers:[],routeEstimates:[],loaded:true};
    equipmentSharedWorkspace.state.routeEstimates=${JSON.stringify(routeEstimates)};
    initEquipmentPlannerBridge();window.testPlanner=equipmentPlannerInstance;`);
  const bridge=context.liveEquipmentPlanner,planner=context.testPlanner;
  run(`equipmentSharedWorkspace.enabled=true;
    equipmentSharedWorkspace.client=window.EquipmentWorkspace.create({date:'2026-11-25',fetch:window.fetch,onState:applyEquipmentSharedState});`);
  bridge.reportViewer={open(){return ++reportTicket;},setContent(html){displayed.push(html);return true;},fail(message){throw new Error(message);}};
  function applyStock(value){inventory=copy(value);context.testRecords=inventory.state.items.map(item=>({id:item.id,item:copy(item),available:item.quantity,physical:item.quantity,consumable:item.itemType==="consumible"}));run("equipmentWarehouseInventoryState.records=window.testRecords;equipmentWarehouseInventoryState.loaded=true;");}
  applyStock(inventory);
  function importEvents(events,options={}){context.currentImport=copy(events);context.currentOptions=copy(options);return copy(run("window.liveEquipmentPlanner.importEvents(window.currentImport,window.currentOptions)"));}
  function snapshot(){return run("JSON.stringify({events:equipmentState.events,dirty:equipmentSharedWorkspace.dirty,selected:equipmentState.selectedEventId,dirtyIds:[...equipmentPlannerDirtyIds]})");}
  if(source.length)importEvents(source);
  return {document,nodes,calls,writes,displayed,server,run,context,bridge,planner,importEvents,snapshot,refresh:()=>run("equipmentSharedWorkspace.client.refresh()"),shared:()=>copy(run("equipmentSharedWorkspace.state")),events:()=>copy(bridge.events()),applyStock,
    modal:()=>document.querySelector(".equipment-draft-overlay"),
    async click(selector){const element=this.modal()?.querySelector(selector);assert.ok(element,selector);await element.emit("click");await flush();}};
}

// Every event, item, quantity, place, and cell below is generated in this test.
// The scenario mirrors only the observable refresh race: an imported file with
// six events must not silently acquire a seventh previously saved reservation.
function sixEventFile() {
  const sizes = [100, 110, 120, 130, 100, 121];
  return sizes.map((count, index) => {
    const event = sourceEvent(index);
    const day = String(5 + index % 3).padStart(2, "0");
    Object.assign(event, { id: `source-${index}`, place: index === 5 ? "Antigua sintética" : `Sede sintética ${index}`, date: `2026-11-${day}`,
      setupAt: `2026-11-${day}T08:00`, startAt: `2026-11-${day}T10:00`, endAt: `2026-11-${day}T18:00`, equipmentInAt: `2026-11-${day}T23:00` });
    event.sections[0].items = Array.from({length: count}, (_, line) => ({ id: `line-${index}-${line}`, warehouseInventoryId: "synthetic-unit", description: "Unidad sintética", quantity: index < 5 && line === 0 ? 0 : 1 }));
    event.sourceCells = event.sections[0].items.flatMap((item, line) => [
      { sheet: `Sintética ${index}`, address: `A${line + 1}`, ref: `source-${index}:A${line + 1}`, value: item.quantity },
      { sheet: `Sintética ${index}`, address: `B${line + 1}`, ref: `source-${index}:B${line + 1}`, value: item.description, note: "Nota literal de fuente  " }
    ]);
    event.sourceImport = { fileName: "Archivo actual sintético.xlsx", format: "xlsx", sha256: "synthetic-six-events", sheet: `Sintética ${index}`, block: `table-${index}`, sourceBlockKey: `table-${index}`, sourceCells: copy(event.sourceCells), metadata: { parsedDate: event.date, client: event.client, place: event.place } };
    event.sections[0].rows = event.sections[0].items.map((item, line) => ({ type: "item", sourceItemIndex: line, quantity: item.quantity, description: item.description, cells: copy(event.sourceCells.slice(line * 2, line * 2 + 2)) }));
    event.sections[0].rows.push({ type: "note", description: "Nota sin cantidad preservada  " });
    event.sections[0].sourceCells = copy(event.sourceCells);
    return event;
  });
}
function savedReservation() {
  const event = sixEventFile()[5];
  event.id = "previous-reservation-distinct-id"; event.client = "Otra persona con reserva"; event.name = "Otra persona con reserva"; event.status = "confirmed"; event.updatedAt = "2026-11-01T12:00:00.000Z";
  event.sections[0].items = event.sections[0].items.slice(0, 20);
  delete event.sourceImport; delete event.sourceCells;
  event.sections[0].rows = []; delete event.sections[0].sourceCells;
  return event;
}
const lineCount = events => events.reduce((sum, event) => sum + event.sections.reduce((sum, section) => sum + section.items.length, 0), 0);
const zeroCount = events => events.flatMap(event => event.sections.flatMap(section => section.items)).filter(item => item.quantity === 0).length;

async function delayedSavedReservation() {
  const h = integration();
  await h.refresh();
  h.importEvents(sixEventFile());
  assert.equal(h.events().length, 6); assert.equal(lineCount(h.events()), 681);
  h.server.events = [savedReservation()];
  h.server.revision = "scope-synthetic-v2";
  await h.refresh();
  return h;
}

test("un refresco tardío de la agenda no añade una séptima reserva al archivo de seis eventos", async () => {
  const h = await delayedSavedReservation(), before = copy(h.server.events);
  assert.equal(h.events().length, 6, "el plan sólo contiene los seis cuadros importados, no la reserva anterior del mismo lugar y día");
  assert.equal(lineCount(h.events()), 681, "la agenda externa no agrega sus veinte líneas al documento actual");
  assert.equal(zeroCount(h.events()), 5);
  assert.equal(h.shared().events.length, 1, "la reserva existente se conserva en el contexto compartido");
  for (let index = 0; index < 12; index++) await h.refresh();
  assert.equal(h.events().length, 6); assert.equal(lineCount(h.events()), 681);
  assert.deepEqual(h.server.events, before, "no se cancela, reescribe ni borra la reserva real para ocultar un duplicado");
  assert.deepEqual(h.shared().events, before); assert.equal(h.writes.length, 0);
  assert.ok(h.server.requests.every(request => request.method === "GET"));
});

test("generar trasiego y sus reportes conserva el alcance del archivo y la reserva externa sólo bloquea disponibilidad", async () => {
  const h = await delayedSavedReservation();
  await h.planner.openTransfers();
  assert.equal(h.modal().querySelectorAll('[data-draft-field="place"]').length, 0, "la recomendación inicial no monta el editor completo");
  await h.click('[data-draft-toggle-editor]');
  const locationInputs = h.modal().querySelectorAll('[data-draft-field="place"]');
  assert.equal(locationInputs.length, 6, "el editor no muestra dos veces la ubicación por un registro ajeno al archivo");
  assert.equal(locationInputs.filter(input => input.value === "Antigua sintética").length, 1);
  const planCalls = h.calls.filter(call => call.body.mode === "plan");
  assert.ok(planCalls.length); assert.equal(planCalls.at(-1).body.events.length, 6); assert.equal(lineCount(planCalls.at(-1).body.events), 681);
  const report = h.server.reports.at(-1);
  assert.equal(report.counts.events, 6); assert.equal(report.counts.equipmentRows, 681);
  assert.equal(report.externalReservationConflicts.length, 1, "se conserva el bloqueo de stock de la reserva guardada fuera del documento");
  assert.equal(report.rows[0].rental, null, "no se declara disponible el equipo ya reservado fuera del plan");
  await h.click('[data-draft-close]');
  assert.equal(h.modal(), null);
  for (const mode of ["transfer", "rent", "purchase", "summary", "master"]) {
    const result = await h.planner.download(mode); assert.equal(result.ok, true, JSON.stringify(result));
  }
  for (const call of h.calls) { assert.equal(call.body.events.length, 6); assert.equal(lineCount(call.body.events), 681); }
  assert.equal(h.writes.length, 0); assert.equal(h.server.events.length, 1);
});

test("Cancelar y la X del trasiego descartan horarios editados y preservan notas, celdas y cinco ceros", async () => {
  const h = await delayedSavedReservation(), original = h.events(), saved = copy(h.server.events);
  for (const index of [0, 1]) {
    await h.planner.openTransfers();
    await h.click('[data-draft-toggle-editor]');
    h.modal().querySelector('[data-draft-event="0"][data-draft-field="place"]').value = "Cambio que no se acepta";
    const dismiss = h.modal().querySelectorAll('[data-draft-close]')[index];
    assert.ok(dismiss); await dismiss.emit("click"); await flush();
    assert.equal(h.modal(), null); assert.deepEqual(h.events(), original);
    await h.refresh(); assert.equal(h.events().length, 6); assert.equal(zeroCount(h.events()), 5);
    h.events().forEach((event, eventIndex) => {
      assert.deepEqual(event.sourceCells, original[eventIndex].sourceCells);
      assert.deepEqual(event.sourceImport, original[eventIndex].sourceImport);
      assert.deepEqual(event.sections, original[eventIndex].sections);
    });
  }
  assert.deepEqual(h.server.events, saved); assert.equal(h.writes.length, 0);
});

test("una agenda previa cargada no se filtra al plan explícito y un evento personalizado posterior sí se agrega", async () => {
  const h = integration(); h.server.events = [savedReservation()]; h.run("equipmentSharedWorkspace.client.setRange({from:'2026-11-02',to:'2026-11-08'})"); await h.refresh();
  assert.equal(h.events().length, 1, "la agenda normal conserva sus reservas antes de abrir un plan de documento");
  h.importEvents(sixEventFile()); await h.refresh();
  assert.equal(h.events().length, 6); assert.equal(lineCount(h.events()), 681);
  const custom = sourceEvent(7, 0); custom.sourceImport = { fileName: "Personalizado sintético", sheet: "Personalizado", block: "personalized-7", sourceBlockKey: "personalized-7" };
  Object.assign(custom, { date: "2026-11-08", setupAt: "2026-11-08T08:00", startAt: "2026-11-08T10:00", endAt: "2026-11-08T12:00", equipmentInAt: "2026-11-08T15:00", place: "Personalizado que sí se solicita" });
  h.importEvents([custom]); await h.refresh();
  assert.equal(h.events().length, 7); assert.equal(lineCount(h.events()), 682); assert.equal(zeroCount(h.events()), 6);
  assert.equal(h.events().some(event => event.id === h.server.events[0].id), false);
  assert.equal(h.server.events.length, 1); assert.equal(h.writes.length, 0);
});

test("confirmar un cuadro usa la agenda real sin reincorporar su reserva anterior al plan de seis", async () => {
  const h = await delayedSavedReservation(), before = h.events(), reservation = copy(h.server.events[0]);
  h.server.allowSave = true; h.context.eventToSave = before[0];
  const saved = await h.run("persistEquipmentSharedEvent(window.eventToSave)");
  assert.equal(saved.id, before[0].id); assert.equal(h.events().length, 6); assert.equal(lineCount(h.events()), 681); assert.equal(zeroCount(h.events()), 5);
  assert.equal(h.server.events.length, 2); assert.deepEqual(h.server.events.find(event => event.id === reservation.id), reservation);
  assert.equal(h.shared().events.length, 2); assert.equal(h.events().some(event => event.id === reservation.id), false);
  assert.equal(h.server.requests.filter(request => request.method === "PUT").length, 1);
  assert.equal(h.writes.length, 0, "ninguna escritura de bodega, borrado o confirmación adicional");
  await h.refresh(); await h.refresh(); assert.equal(h.events().length, 6);
  for (const event of h.events()) {
    const original = before.find(existing => existing.id === event.id);
    assert.deepEqual(event.sourceCells, original.sourceCells); assert.deepEqual(event.sourceImport, original.sourceImport);
    assert.deepEqual(event.sections.flatMap(section => section.rows), original.sections.flatMap(section => section.rows));
  }
});
