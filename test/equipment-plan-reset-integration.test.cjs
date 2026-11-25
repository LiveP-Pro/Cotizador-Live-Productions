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


const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
function stateOf(h) { return plain(h.run("({events:equipmentState.events,dirty:equipmentSharedWorkspace.dirty,dirtyIds:[...equipmentPlannerDirtyIds],selected:equipmentState.selectedEventId,scope:equipmentPlanEventIds===null?null:[...equipmentPlanEventIds],routes:equipmentState.summaryTransferRoutes,inventory:[...equipmentState.inventory],observations:[...equipmentState.observations],overrides:[...equipmentState.rentalOverrides],search:equipmentState.summarySearchTerm})")); }
function accept(h, value=true) { h.context.window.confirm=()=>value; }
function seedPlanningState(h) {
  h.run(`equipmentState.summaryTransferRoutes=[{id:'old-route',eventIds:equipmentState.events.map(e=>e.id)}];equipmentState.activeSummaryTransferRouteId='old-route';equipmentState.summaryTransferEnabled=true;equipmentState.summaryTransferAutomatic=false;
    equipmentState.inventory.set('local-row',9);equipmentState.observations.set('local-row','Nota de plan');equipmentState.rentalOverrides.set('local-row',4);equipmentState.rentPreviewVisible=true;equipmentState.purchasePreviewVisible=true;equipmentState.summarySearchTerm='Búsqueda anterior';
    equipmentWarehouseInventoryState.loaded=true;equipmentWarehouseInventoryState.records=[{id:'stock-synthetic',available:15,physical:15,item:{id:'stock-synthetic',name:'Referencia sintética',quantity:15,itemType:'equipo'}}];
    window.resetCalls={batch:0,personalizer:0,extras:0};
    equipmentSharedWorkspace.batchImport={isBusy:()=>false,clear:()=>{window.resetCalls.batch++;return true;}};
    equipmentSharedWorkspace.personalizer={close:()=>{window.resetCalls.personalizer++;return true;}};
    equipmentSharedWorkspace.extras={getState:()=>({pending:false}),close:()=>{window.resetCalls.extras++;}};`);
}

test('cancelar Limpiar todo conserva seis cuadros, ceros, notas, selección y decisiones', async()=>{
  const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);const before=stateOf(h),source=plain(h.events());
  accept(h,false);assert.equal(await h.run('clearEquipmentWorkingArea()'),false);
  assert.deepEqual(stateOf(h),before);assert.deepEqual(h.events(),source);assert.equal(h.requests.length,0);assert.equal(h.saves.length,0);
  assert.equal(h.context.window.resetCalls.batch,0);
});

test('aceptar limpia el plan completo y una actualización tardía de la agenda no repone Mil Flores ni otros cuadros',async()=>{
  const h=harness();h.importEvents(syntheticEvents());h.shared(h.events().map(event=>({...event,updatedAt:'remote-before-reset'})));seedPlanningState(h);
  const stockBefore=plain(h.run('equipmentWarehouseInventoryState.records')),ledgerBefore=plain(h.run('equipmentSharedWorkspace.state'));
  accept(h);assert.equal(await h.run('clearEquipmentWorkingArea()'),true);
  const empty=stateOf(h);assert.equal(empty.events.length,0);assert.deepEqual(empty.scope,[]);assert.deepEqual(empty.dirtyIds,[]);assert.equal(empty.selected,'');assert.equal(empty.dirty,false);
  assert.deepEqual(empty.routes,[]);assert.deepEqual(empty.inventory,[]);assert.deepEqual(empty.observations,[]);assert.deepEqual(empty.overrides,[]);assert.equal(empty.search,'');
  assert.equal(h.run('equipmentState.summaryTransferEnabled'),false);assert.equal(h.run('equipmentState.summaryTransferAutomatic'),true);assert.equal(h.run('equipmentState.rentPreviewVisible'),false);
  assert.deepEqual(plain(h.run('equipmentWarehouseInventoryState.records')),stockBefore);assert.deepEqual(plain(h.run('equipmentSharedWorkspace.state')),ledgerBefore);
  await h.run('equipmentSharedWorkspace.client.refresh()');await flush();
  assert.equal(h.events().length,0);assert.equal(h.run('equipmentPlannerInstance.model().events.length'),0);assert.equal(h.run('equipmentPlannerInstance.model().rows.length'),0);
  assert.equal(h.requests.length,0);assert.equal(h.saves.length,0);
});

test('después de limpiar el mismo archivo carga seis eventos nuevos completos sin reutilizar decisiones anteriores',async()=>{
  const h=harness(),source=syntheticEvents();h.importEvents(source);seedPlanningState(h);const ids=h.events().map(event=>event.id);accept(h);await h.run('clearEquipmentWorkingArea()');
  const result=h.importEvents(source);assert.equal(result.addedCount,6);assert.equal(result.reusedCount,0);assert.equal(h.events().length,6);assert.ok(h.events().every(event=>!ids.includes(event.id)));
  assert.equal(h.events().flatMap(event=>event.sections.flatMap(section=>section.items)).filter(item=>item.quantity===0).length,5);
  for(let i=0;i<6;i++){assert.deepEqual(h.events()[i].sourceCells,source[i].sourceCells);assert.deepEqual(h.events()[i].sections[0].rows,source[i].sections[0].rows);assert.equal(h.events()[i].notes,source[i].notes);}
  assert.deepEqual(stateOf(h).routes,[]);assert.equal(h.saves.length,0);assert.equal(h.requests.length,0);
});

test('un guardado o una aplicación en curso impide limpiar y mantiene todos los datos',async()=>{
  for(const busy of ['shared','batch']){
    const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);accept(h);
    h.run(busy==='shared'?'equipmentSharedWorkspace.saving=true':'equipmentSharedWorkspace.batchImport.isBusy=()=>true');const before=stateOf(h);
    assert.equal(await h.run('clearEquipmentWorkingArea()'),false,busy);assert.deepEqual(stateOf(h),before,busy);assert.equal(h.requests.length,0);
  }
});

test('si empieza un guardado mientras la confirmación está abierta no se descarta ningún cuadro',async()=>{
  const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);
  h.run('window.pendingResetResolve=null;requestEquipmentPlanResetConfirmation=()=>new Promise(resolve=>window.pendingResetResolve=resolve)');const before=stateOf(h);
  const pending=h.run('clearEquipmentWorkingArea()');assert.equal(typeof h.context.window.pendingResetResolve,'function');h.run('equipmentSharedWorkspace.saving=true');h.context.window.pendingResetResolve(true);
  assert.equal(await pending,false);assert.deepEqual(stateOf(h),before);assert.equal(h.requests.length,0);
});

function plannerReportHarness(respond) {
  const requests=[],contents=[],failures=[],downloads=[],node={textContent:''};let ticket=0,opened=false,retry=null;
  const viewer={open(options){opened=true;retry=options.onRetry;return ++ticket;},close(){opened=false;ticket++;},setContent(markup,token){if(!opened||token!==ticket)return false;contents.push(markup);return true;},fail(message){failures.push(message);},isOpen(){return opened;}};
  const context=vm.createContext({Blob,AbortController,console,setTimeout(){},URL:{createObjectURL:()=> 'blob:synthetic',revokeObjectURL(){}},
    document:{querySelector:selector=>selector==='#equipmentPlannerStatus'?node:null,body:{append(){}},createElement:()=>({click(){downloads.push(this.download);},remove(){}})},
    fetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body),signal:init.signal});return respond();}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','equipment-planner.js'),'utf8'),context);
  let events=[{id:'current-synthetic-event'}];
  const planner=context.EquipmentPlanner.create({events:()=>events,inventory:()=>[],reportViewer:viewer});
  return {planner,requests,contents,failures,downloads,node,viewer,retry:()=>retry?.(),setEvents:values=>{events=values;}};
}
const syntheticHtmlResponse=(html='<html>Resultado anterior</html>')=>({ok:true,status:200,text:async()=>html,headers:{get:name=>({'Content-Type':'text/html; charset=utf-8','X-Equipment-Report-Status':'provisional'}[name]||null)}});

test('reiniciar invalida una respuesta HTML tardía sin abrir ni repoblar el reporte descartado',async()=>{
  let finish;const h=plannerReportHarness(()=>new Promise(resolve=>{finish=resolve;})),button={disabled:false};
  const pending=h.planner.download('rent',button);assert.equal(h.requests.length,1);assert.equal(button.disabled,true);
  h.setEvents([]);h.planner.reset();assert.equal(button.disabled,false);assert.equal(h.viewer.isOpen(),false);assert.equal(h.requests[0].signal.aborted,true);
  const resetStatus=h.node.textContent;finish(syntheticHtmlResponse());const result=await pending;
  assert.equal(result.cancelled,true);assert.equal(h.contents.length,0);assert.equal(h.failures.length,0);assert.equal(h.node.textContent,resetStatus);
});

test('reiniciar también descarta un cuerpo HTML pendiente después de recibir las cabeceras',async()=>{
  let finishText;const response=syntheticHtmlResponse();response.text=()=>new Promise(resolve=>{finishText=resolve;});
  const h=plannerReportHarness(()=>response),pending=h.planner.download('transfer');await flush();assert.equal(typeof finishText,'function');
  h.planner.reset();finishText('<html>Cuerpo tardío anterior</html>');assert.equal((await pending).cancelled,true);assert.equal(h.contents.length,0);assert.equal(h.failures.length,0);
});

test('reiniciar invalida una descarga PDF cuyo cuerpo termina después de limpiar',async()=>{
  let finishBlob;const h=plannerReportHarness(()=>({ok:true,status:200,headers:{get:name=>name==='Content-Type'?'application/pdf':null},blob:()=>new Promise(resolve=>{finishBlob=resolve;})}));
  const pending=h.planner.download('summary');await flush();assert.equal(typeof finishBlob,'function');h.planner.reset();finishBlob(new Blob(['%PDF-synthetic']));
  assert.equal((await pending).cancelled,true);assert.equal(h.downloads.length,0);assert.equal(h.failures.length,0);
});

test('el botón Reintentar de un reporte anterior no puede enviar el plan eliminado',async()=>{
  const h=plannerReportHarness(()=>({ok:false,status:503,json:async()=>({error:'Fallo sintético'})}));assert.equal((await h.planner.download('rent')).ok,false);assert.equal(h.requests.length,1);
  h.planner.reset();const result=await h.retry();assert.equal(result.cancelled,true);assert.equal(h.requests.length,1);assert.equal(h.viewer.isOpen(),false);
});

test('una respuesta vieja no libera el bloqueo ni el botón de la descarga del plan nuevo',async()=>{
  const finishers=[],h=plannerReportHarness(()=>new Promise(resolve=>finishers.push(resolve))),oldButton={disabled:false},newButton={disabled:false};
  const old=h.planner.download('rent',oldButton);h.planner.reset();h.setEvents([{id:'fresh-synthetic-event'}]);const current=h.planner.download('purchase',newButton);assert.equal(h.requests.length,2);
  finishers[0](syntheticHtmlResponse());assert.equal((await old).cancelled,true);assert.equal(newButton.disabled,true);
  assert.equal((await h.planner.download('transfer')).ok,false);assert.equal(h.requests.length,2);
  finishers[1](syntheticHtmlResponse('<html>Plan nuevo</html>'));assert.equal((await current).ok,true);assert.equal(newButton.disabled,false);assert.deepEqual(h.contents,['<html>Plan nuevo</html>']);
});

function attachResetDialog(h){
  const nodes={};
  for(const name of ['Dialog','Accept','Cancel','Close']){
    const element={open:false,disabled:false,listeners:{},focus(){h.context.document.activeElement=this;},
      addEventListener(type,callback){(this.listeners[type]||=[]).push(callback);},
      removeEventListener(type,callback){this.listeners[type]=(this.listeners[type]||[]).filter(item=>item!==callback);},
      async emit(type,extra={}){const event={preventDefault(){this.defaultPrevented=true;},target:this,currentTarget:this,...extra};for(const callback of [...(this.listeners[type]||[])])await callback(event);},
      showModal(){this.open=true;},close(){this.open=false;return this.emit('close');},setAttribute(){},removeAttribute(){}};
    nodes[name]=element;h.nodes.set('#equipmentPlanReset'+name,element);
  }
  return nodes;
}

test('Cancelar, la X y Escape del cuadro de limpieza conservan íntegros los seis eventos',async()=>{
  for(const action of ['Cancel','Close','Escape']){
    const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);const dialog=attachResetDialog(h),before=stateOf(h);
    const pending=h.run('clearEquipmentWorkingArea()');assert.equal(dialog.Dialog.open,true,action);
    if(action==='Escape')await dialog.Dialog.emit('cancel');else await dialog[action].emit('click');
    assert.equal(await pending,false,action);assert.deepEqual(stateOf(h),before,action);assert.equal(dialog.Dialog.open,false,action);assert.equal(h.requests.length,0);
  }
});

test('Limpiar y cargar archivo del cuadro borra el plan y abre un importador nuevo vacío',async()=>{
  const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);const dialog=attachResetDialog(h);
  h.run('window.resetCalls.open=0;equipmentSharedWorkspace.batchImport.open=()=>{window.resetCalls.open++;return true;}');
  const pending=h.run('clearEquipmentWorkingArea()');assert.equal(dialog.Dialog.open,true);await dialog.Accept.emit('click');
  assert.equal(await pending,true);assert.equal(h.events().length,0);assert.equal(h.context.window.resetCalls.batch,1);assert.equal(h.context.window.resetCalls.open,1);assert.equal(dialog.Dialog.open,false);assert.equal(h.requests.length,0);
});

const legacyResetGuards=[
  {name:'una captura de extras en curso',code:'equipmentExtraEntryBusy=true'},
  {name:'una elección de servicio o audio en curso',code:'equipmentDjServiceSelectionBusy=true'},
  {name:'un ingreso a Contabilidad pendiente',code:"equipmentState.pendingStockIngressRequest={requestId:'synthetic-idempotent-ingress',sourceIds:['synthetic-source'],items:[{description:'Referencia sintética',quantity:1}],event:{id:'synthetic-event'}}"}
];
for(const guard of legacyResetGuards){
  test(`Limpiar espera ${guard.name} sin cerrar controladores ni descartar datos`,async()=>{
    const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);accept(h);h.run(guard.code);const before=stateOf(h),pendingBefore=plain(h.run('equipmentState.pendingStockIngressRequest'));
    assert.equal(await h.run('clearEquipmentWorkingArea()'),false);assert.deepEqual(stateOf(h),before);assert.deepEqual(plain(h.run('equipmentState.pendingStockIngressRequest')),pendingBefore);
    assert.deepEqual(plain(h.context.window.resetCalls),{batch:0,personalizer:0,extras:0});assert.equal(h.requests.length,0);assert.equal(h.saves.length,0);
    assert.match(h.nodes.get('#equipmentSharedStatus').textContent,/Espere|ingreso.*pendiente/i);
  });
}

test('los bloqueos de extras, servicio e ingreso se comprueban nuevamente al aceptar la confirmación',async()=>{
  for(const guard of legacyResetGuards){
    const h=harness();h.importEvents(syntheticEvents());seedPlanningState(h);const dialog=attachResetDialog(h),before=stateOf(h);
    const pending=h.run('clearEquipmentWorkingArea()');assert.equal(dialog.Dialog.open,true);h.run(guard.code);const ingressBefore=plain(h.run('equipmentState.pendingStockIngressRequest'));await dialog.Accept.emit('click');
    assert.equal(await pending,false,guard.name);assert.deepEqual(stateOf(h),before,guard.name);assert.deepEqual(plain(h.run('equipmentState.pendingStockIngressRequest')),ingressBefore);
    assert.deepEqual(plain(h.context.window.resetCalls),{batch:0,personalizer:0,extras:0});assert.equal(h.requests.length,0);assert.equal(h.saves.length,0);
  }
});
