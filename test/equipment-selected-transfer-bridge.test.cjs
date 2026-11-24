"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Draft = require("../equipment-draft-logistics.js");
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
  const document = documentHarness(), nodes = new Map(), calls = [], writes = [], displayed = [];
  document.addEventListener = () => {}; document.dispatchEvent = () => {};
  const originalQuery = document.querySelector.bind(document);
  document.querySelector = selector => nodes.get(selector) || originalQuery(selector);
  for (const name of ["EventPlace","EventName","EventType","EventSetupAt","EventSetupApplies","EventDate","EventStartAt","EventEndAt","EventInAt","EventResponsible","Notes","SaveStatus","SharedStatus","AgendaFrom","AgendaTo","PlannerOverview","PlannerPending","PlannerStatus","PlannerSummary","PlannerSearch","PlannerOnlyPending"]) {
    const element = document.createElement("div"); element.setAttribute = () => {}; element.removeAttribute = () => {}; element.scrollIntoView = () => {};
    element.classList.add = () => {}; element.classList.remove = () => {}; element.classList.contains = () => false;
    nodes.set(`#equipment${name}`,element); document.body.append(element);
  }
  let inventory = stock(); let reportTicket = 0;
  class TestURL extends URL { static createObjectURL(){return 'blob:synthetic';} static revokeObjectURL(){} }
  const context = vm.createContext({ console, URL: TestURL, Blob, Date, Intl, Map, Set, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},document });
  context.window = context; Object.assign(context, { requerimientoEquipoCatalog: { version:"current-test-only",services:{},groups:[] }, requerimientoEquipoInventory:{categories:[]},
    location:{protocol:"https:",hash:"#requerimiento-equipo"},addEventListener(){},requestAnimationFrame(fn){fn();},confirm(){return false;},LiveAccess:{can(){return true;}},LIVE_SESSION:{} });
  context.fetch = async (url, init={}) => {
    if(url!=="/api/cuadros-equipo/reportes/provisional"||init.method!=="POST"){writes.push({url,init});throw new Error("No stock or event writes allowed");}
    const body=JSON.parse(init.body);calls.push({url,init,body});
    const plan=Draft.analyze(body.events,inventory,{now:Date.parse("2026-11-23T12:00:00Z"),selectedTransferIds:body.selectedTransferIds,transferEdits:body.transferEdits,routeEstimates:body.routeEstimates});
    if(body.mode==="plan")return {ok:true,status:200,json:async()=>copy(plan)};
    if(["transfer","rent","purchase"].includes(body.mode))return {ok:true,status:200,headers:{get(name){return {"Content-Type":"text/html; charset=utf-8","X-Equipment-Report-Status":"provisional"}[name]||null;}},text:async()=>`<html><body>${JSON.stringify(plan.rows.map(row=>({rental:row.rental,purchase:row.purchase})))}</body></html>`};
    return {ok:true,status:200,headers:{get(name){return name==="Content-Type"?"application/octet-stream":name==="Content-Disposition"?`attachment; filename="current.${body.mode==="master"?"xlsx":"pdf"}"`:null;}},blob:async()=>new Blob([body.mode==="master"?"PKsynthetic":"%PDF-synthetic"])};
  };
  const run = code => vm.runInContext(code,context);
  for(const file of ["equipment-location.js","equipment-identity.js","equipment-import-identity.js","equipment-document-audit.js","equipment-draft-transfers.js","equipment-planner.js","equipment.js"])run(fs.readFileSync(require.resolve(`../${file}`),"utf8"));
  run(`renderEquipmentModule=()=>{if(window.testPlanner)window.testPlanner.render();};
    loadEquipmentEvent=id=>{equipmentState.selectedEventId=id;const event=selectedEquipmentEvent();if(event){restoreEquipmentEventSnapshot(event);populateEquipmentEventFields(event);}equipmentState.activeWindow='summary';renderEquipmentModule();return !!event;};
    equipmentSharedWorkspace.state={events:[],transfers:[],routeEstimates:[],loaded:true};
    equipmentSharedWorkspace.state.routeEstimates=${JSON.stringify(routeEstimates)};
    initEquipmentPlannerBridge();window.testPlanner=equipmentPlannerInstance;`);
  const bridge=context.liveEquipmentPlanner,planner=context.testPlanner;
  bridge.reportViewer={open(){return ++reportTicket;},setContent(html){displayed.push(html);return true;},fail(message){throw new Error(message);}};
  function applyStock(value){inventory=copy(value);context.testRecords=inventory.state.items.map(item=>({id:item.id,item:copy(item),available:item.quantity,physical:item.quantity,consumable:item.itemType==="consumible"}));run("equipmentWarehouseInventoryState.records=window.testRecords;equipmentWarehouseInventoryState.loaded=true;");}
  applyStock(inventory);
  function importEvents(events,options={}){context.currentImport=copy(events);context.currentOptions=copy(options);return copy(run("window.liveEquipmentPlanner.importEvents(window.currentImport,window.currentOptions)"));}
  function snapshot(){return run("JSON.stringify({events:equipmentState.events,dirty:equipmentSharedWorkspace.dirty,selected:equipmentState.selectedEventId,dirtyIds:[...equipmentPlannerDirtyIds]})");}
  if(source.length)importEvents(source);
  return {document,nodes,calls,writes,displayed,run,context,bridge,planner,importEvents,snapshot,events:()=>copy(bridge.events()),applyStock,
    modal:()=>document.querySelector(".equipment-draft-overlay"),
    async click(selector){const element=this.modal()?.querySelector(selector);assert.ok(element,selector);await element.emit("click");await flush();}};
}

test("el mismo cuadro repetido en un lote y un ZIP con bytes distintos no duplica eventos ni fuentes", () => {
  const h=integration(),raw=sourceEvent(0,0);const first=h.importEvents([raw,copy(raw)]);
  assert.equal(first.count,1);assert.equal(first.addedCount,1);assert.equal(h.events().length,1);
  const clone=copy(raw);clone.sourceImport.sha256="new-zip-bytes";clone.sourceImport.byteLength=888;clone.sourceImport.sourceCells.forEach(cell=>{cell.ref="new:"+cell.ref;cell.sourceOrder=900;});
  const second=h.importEvents([clone]);assert.equal(second.addedCount,0);assert.equal(second.reusedCount,1);assert.equal(h.events().length,1);
  assert.equal(h.events()[0].sections[0].items[0].quantity,0);assert.deepEqual(h.events()[0].sourceCells,raw.sourceCells);assert.equal(h.writes.length,0);
});

test("una revisión sin decisión es atómica y reemplazar elimina completamente las filas anteriores", () => {
  const h=integration();const old=sourceEvent(0,4);old.sections[0].items.push({quantity:9,description:"Sólo en versión anterior"});h.importEvents([old]);const before=h.snapshot(),id=h.events()[0].id;
  const revised=sourceEvent(0,0);revised.sourceImport.sha256="revised";revised.sourceImport.sourceCells[0].value=0;revised.notes="Sólo nota nueva";
  assert.throws(()=>h.importEvents([sourceEvent(1),revised]),/coincide|Elija/);assert.equal(h.snapshot(),before);
  const result=h.importEvents([revised],{decisions:[{index:0,action:"replace",existingEventId:id}]});
  assert.equal(result.replacedCount,1);assert.equal(result.events[0].id,id);assert.equal(h.events().length,1);assert.equal(h.events()[0].sections[0].items.length,1);
  assert.equal(h.events()[0].sections[0].items[0].quantity,0);assert.deepEqual(h.events()[0].sourceImport,revised.sourceImport);assert.equal(h.events()[0].notes,revised.notes);assert.equal(h.writes.length,0);
});

test("igual contexto en otra fuente sólo propone decisión y nunca combina equipos parecidos", () => {
  const h=integration();const first=sourceEvent(0);h.importEvents([first]);const before=h.snapshot(),id=h.events()[0].id;
  const separate=copy(first);separate.sourceImport.fileName="Otra fuente actual.pdf";separate.sourceImport.format="pdf";separate.sourceImport.sha256="pdf-new";separate.sections[0].items[0].description="Unidad sintética variante 2";
  assert.throws(()=>h.importEvents([separate]),/Elija|coincide/);assert.equal(h.snapshot(),before);
  h.importEvents([separate],{decisions:[{index:0,action:"separate",existingEventId:id}]});assert.equal(h.events().length,2);
  assert.ok(h.events().some(event=>event.sections[0].items[0].description==="Unidad sintética variante 2"));
});

test("una cantidad booleana no puede convertirse silenciosamente en una fila numérica cero", () => {
  const h=integration();const raw=sourceEvent(0);raw.sections[0].items[0].quantity=false;
  assert.throws(()=>h.importEvents([raw]),/cantidad|descripción/);assert.equal(h.events().length,0);assert.equal(h.writes.length,0);
});

test("actualizar horarios valida todas las referencias antes de cambiar un evento y conserva fuentes/ceros", () => {
  const h=integration({source:[sourceEvent(0,0),sourceEvent(1)]});const before=h.snapshot(),events=h.events();
  const patch={id:events[0].id,place:"Lugar ajustado",setupApplies:true,setupAt:"2026-11-25T07:00",startAt:"2026-11-25T08:00",endAt:"2026-11-25T10:00",equipmentInAt:"2026-11-26T12:00"};
  assert.throws(()=>h.bridge.updateEventDetails([patch,{...patch,id:"not-loaded"}]),/ya no está cargado/);assert.equal(h.snapshot(),before);
  h.bridge.updateEventDetails([patch]);const after=h.events().find(event=>event.id===patch.id);assert.equal(after.place,"Lugar ajustado");assert.equal(after.sections[0].items[0].quantity,0);
  assert.deepEqual(after.sourceImport,events[0].sourceImport);assert.deepEqual(after.sections[0].rows,events[0].sections[0].rows);assert.equal(h.writes.length,0);
});

test("aplicar trasiegos actualiza horarios, resumen y todas las solicitudes de reporte con la misma selección", async () => {
  const h=integration({source:[sourceEvent(0),sourceEvent(1),sourceEvent(2)]});await flush();await h.planner.openTransfers();
  h.modal().querySelector('[data-draft-event="0"][data-draft-field="endAt"]').value="2026-11-25T09:30";
  await h.click("[data-draft-recalculate]");await h.click("[data-draft-select-all]");await h.click("[data-draft-apply]");await h.click("[data-draft-confirm-accept]");await flush();
  assert.equal(h.events()[0].endAt,"2026-11-25T09:30");assert.equal(h.planner.model().rows[0].plan.rental,0);assert.equal(h.planner.model().rows[0].required,3);
  const applied=h.calls.filter(call=>call.body.mode==="plan").at(-1).body.selectedTransferIds;assert.equal(applied.length,2);
  for(const mode of ["transfer","rent","purchase","summary","master"]){const result=await h.planner.download(mode);assert.equal(result.ok,true,JSON.stringify(result));}
  const reports=h.calls.filter(call=>call.body.mode!=="plan");assert.equal(reports.length,5);
  for(const call of reports){assert.deepEqual(call.body.selectedTransferIds,applied);assert.equal(call.body.events[0].endAt,"2026-11-25T09:30");assert.deepEqual(call.body.routeEstimates,routeEstimates);}
  assert.equal(h.writes.length,0);
});

test("actualizar inventario borra la cifra reducida anterior antes de publicar otro resultado", async () => {
  const h=integration({source:[sourceEvent(0),sourceEvent(1),sourceEvent(2)]});await flush();await h.planner.openTransfers();await h.click("[data-draft-apply]");await h.click("[data-draft-confirm-accept]");await flush();
  assert.equal(h.planner.model().rows[0].plan.rental,0);h.applyStock(stock(1));h.planner.render();
  assert.equal(h.planner.model().rows[0].plan,undefined);assert.match(h.nodes.get("#equipmentPlannerSummary").innerHTML,/Por calcular/);
  await flush();assert.equal(h.planner.model().rows[0].plan.rental,null);assert.equal(h.planner.model().rows[0].missing,null);assert.equal(h.writes.length,0);
});

test("el resumen también usa el resultado servidor para rentas externas explícitas", async () => {
  const a=sourceEvent(0,1),b=sourceEvent(1,1);a.equipmentInAt="2026-11-25T10:00";
  for(const event of [a,b]){delete event.sections[0].items[0].warehouseInventoryId;event.sections[0].items[0].procurementChoice="rent";}
  const h=integration({source:[a,b]});await flush();const result=h.planner.model().rows[0];
  assert.ok(result,JSON.stringify({events:h.events(),model:h.planner.model()}));assert.equal(result.quantity,2);assert.ok(result.plan);assert.equal(result.plan.required,1);assert.equal(result.missing,1);assert.equal(result.action,"RENTA");assert.equal(h.writes.length,0);
});

test('Maps se valida de forma atómica y reemplaza coordenadas anteriores sin tocar las celdas ni ceros',()=>{
  const source=sourceEvent(0,0);source.mapUrl='https://www.google.com/maps?q=14,-90';source.location={lat:14,lng:-90};
  const h=integration({source:[source,sourceEvent(1)]}),event=h.events()[0],before=h.snapshot();
  const patch={...event,mapUrl:'https://www.google.com/maps?q=14.1,-90.1'};
  assert.throws(()=>h.bridge.updateEventDetails([patch,{...h.events()[1],mapUrl:'https://evil.invalid/maps'}]),/Google Maps/);
  assert.equal(h.snapshot(),before);
  h.bridge.updateEventDetails([patch]);const updated=h.events()[0];
  assert.equal(updated.mapUrl,patch.mapUrl);assert.deepEqual(updated.location,{lat:14.1,lng:-90.1});
  assert.deepEqual(updated.sourceCells,event.sourceCells);assert.deepEqual(updated.sourceImport,event.sourceImport);assert.deepEqual(updated.sections,event.sections);
  h.bridge.updateEventDetails([{...updated,mapUrl:''}]);assert.equal(h.events()[0].location,undefined);assert.equal(h.events()[0].mapUrl,'');assert.equal(h.writes.length,0);
});

test('cantidades y notas editadas requieren aceptar y llegan iguales a los cinco reportes',async()=>{
  const h=integration({source:[sourceEvent(0),sourceEvent(1)]});await flush();await h.planner.openTransfers();
  const quantity=h.modal().querySelector('[data-draft-quantity="0"]'),note=h.modal().querySelector('[data-draft-note="0"]');
  quantity.value='2';note.value='Camión de prueba: dos unidades, nota literal';
  await h.click('[data-draft-save-edit="0"]');await h.click('[data-draft-apply]');
  assert.ok(h.modal().querySelector('[data-draft-confirm-accept]'));assert.equal(h.planner.model().rows[0].plan.rental,3,'antes de aceptar no modifica la selección comprometida');
  await h.click('[data-draft-confirm-cancel]');assert.ok(h.modal());assert.equal(h.planner.model().rows[0].plan.rental,3);
  await h.click('[data-draft-apply]');await h.click('[data-draft-confirm-accept]');await flush();
  assert.equal(h.planner.model().rows[0].plan.rental,1);assert.equal(h.events()[0].sections[0].items[0].quantity,3);
  for(const mode of ['transfer','rent','purchase','summary','master'])assert.equal((await h.planner.download(mode)).ok,true);
  const calls=h.calls.filter(call=>call.body.mode!=='plan');assert.equal(calls.length,5);
  for(const call of calls){assert.equal(call.body.transferEdits.length,1);assert.equal(call.body.transferEdits[0].quantity,2);assert.match(call.body.transferEdits[0].note,/dos unidades/);assert.equal(call.body.selectedTransferIds.length,1);}
  assert.equal(h.writes.length,0);
});
