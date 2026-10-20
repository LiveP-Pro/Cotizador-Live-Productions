const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// All services, equipment, inventory IDs and schedules below are synthetic.
// These integration tests never load production workbooks or saved events.
function harness() {
  const nodes = new Map(), requests = [], responses = [], documentListeners = new Map();
  class Element {
    constructor(id = "") {
      this.id = id; this.value = ""; this.textContent = ""; this.dataset = {}; this.listeners = {}; this.children = []; this.open = false; this.hidden = false; this.disabled = false;
      const classes = new Set();
      this.classList = { add: (...values) => values.forEach((value) => classes.add(value)), remove: (...values) => values.forEach((value) => classes.delete(value)), contains: (value) => classes.has(value), toggle(value, force) { if (force === undefined) force = !classes.has(value); if (force) classes.add(value); else classes.delete(value); return force; } };
    }
    set innerHTML(value) {
      this.html = value;
      for (const match of value.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const element = new Element(match[3]);
        element.value = match[2].match(/\bvalue="([^"]*)"/)?.[1] || "";
        nodes.set("#" + element.id, element); this.children.push(element);
      }
    }
    get innerHTML() { return this.html || ""; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    removeEventListener(type, listener) { this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== listener); }
    async emit(type, target = this) { for (const listener of [...(this.listeners[type] || [])]) await listener({ type, target, preventDefault() {} }); }
    setAttribute(name, value) { this[name] = value; }
    removeAttribute(name) { delete this[name]; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    append(element) { this.children.push(element); if (element.id) nodes.set("#" + element.id, element); }
    appendChild(element) { this.append(element); return element; }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit("close"); }
  }
  class Option { constructor(text, value, defaultSelected, selected) { Object.assign(this, { text, value, defaultSelected: !!defaultSelected, selected: !!selected }); } }
  const select = new Element("equipmentServiceSelect");
  select.multiple = true; select.options = [];
  select.replaceChildren = () => { select.options = []; };
  select.add = (option) => select.options.push(option);
  select.append = (group) => select.options.push(...group.children);
  Object.defineProperty(select, "selectedOptions", { get: () => select.options.filter((option) => option.selected) });
  nodes.set("#equipmentServiceSelect", select);
  for (const suffix of ["EventPlace", "EventName", "EventType", "EventSetupAt", "EventDate", "EventStartAt", "EventEndAt", "EventInAt", "EventResponsible", "Notes", "SaveStatus", "CatalogEditorStatus", "CatalogSaveButton", "CatalogConfirmDialog", "CatalogConfirmAccept", "CatalogConfirmCancel", "CatalogConfirmClose", "SharedStatus", "AgendaFrom", "AgendaTo"]) nodes.set("#equipment" + suffix, new Element("equipment" + suffix));
  const body = new Element("body");
  const context = vm.createContext({
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise, Option,
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    window: {
      requerimientoEquipoCatalog: {
        version: "synthetic-personalization-integration",
        services: { "fixture-template": { name: "Servicio de integración", mainSections: [{ id: "fixture-category", title: "Categoría sintética", items: [[0, "Equipo cero sintético"], [2, "Equipo sintético A"]] }] } },
        groups: [{ id: "fixtures", label: "Servicios sintéticos", serviceIds: ["fixture-template"] }]
      },
      requerimientoEquipoInventory: { categories: [] }, location: { protocol: "http:", hash: "#requerimiento-equipo", origin: "http://localhost" },
      setTimeout() { return 1; }, setInterval() { return 1; }, clearInterval() {}, addEventListener() {}, requestAnimationFrame(callback) { callback(); }
    },
    document: { body, visibilityState: "visible", querySelector: (selector) => nodes.get(selector) || null, getElementById: (id) => nodes.get("#" + id) || null, querySelectorAll() { return []; }, addEventListener(type, callback) { if (!documentListeners.has(type)) documentListeners.set(type, []); documentListeners.get(type).push(callback); }, dispatchEvent() {}, createElement() { return new Element(); } },
    fetch: async (url, init = {}) => {
      requests.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
      if (responses.length) { const response = responses.shift(); return typeof response === "function" ? response(url, init) : response; }
      return { ok: true, json: async () => ({ serviceId: "fixture-template", service: { name: "Servicio de integración actualizado", mainSections: [{ id: "fixture-category", title: "Categoría sintética", items: [[0, "Equipo cero sintético"], [9, "Equipo sintético A"]] }] } }) };
    }
  });
  const run = (code) => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, "..", "equipment-workspace.js"), "utf8"));
  run(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"));
  run("populateNativeEquipmentServiceSelect(); renderEquipmentModule = () => {};");
  const get = (id) => nodes.get(id.startsWith("#") ? id : "#" + id);
  function fields(overrides = {}) {
    const values = {
      EventPlace: "Ubicación sintética", EventName: "Evento sintético", EventType: "Evento personalizado sintético",
      EventSetupAt: "2026-11-12T08:00", EventStartAt: "2026-11-12T17:30", EventEndAt: "2026-11-13T00:45",
      EventDate: "2026-11-11", EventInAt: "2026-11-13T03:00", EventResponsible: "Responsable sintético", Notes: "  Nota con espacios\ny segunda línea  ", ...overrides
    };
    for (const [suffix, value] of Object.entries(values)) get("equipment" + suffix).value = value;
  }
  return { context, run, get, nodes, fields, requests, responses, Element, documentListeners };
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("tipo, inicio, finalización, montaje y regreso sobreviven ventana e importación JSON", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow()");
  const current = plain(h.run("selectedEquipmentEvent()"));
  assert.equal(current.type, "Evento personalizado sintético");
  assert.equal(current.date, "2026-11-12", "el inicio real determina la fecha del evento");
  assert.equal(current.startAt, "2026-11-12T17:30");
  assert.equal(current.endAt, "2026-11-13T00:45");
  assert.equal(current.setupAt, "2026-11-12T08:00");
  assert.equal(current.equipmentInAt, "2026-11-13T03:00");
  assert.equal(current.notes, "  Nota con espacios\ny segunda línea  ");
  const payload = h.run("JSON.stringify(equipmentEditablePayload('rent'))");
  h.run(`importEquipmentEditablePayload(${payload})`);
  for (const [field, expected] of [["Type", current.type], ["StartAt", current.startAt], ["EndAt", current.endAt], ["SetupAt", current.setupAt], ["InAt", current.equipmentInAt]]) assert.equal(h.get("equipmentEvent" + field).value, expected);
  assert.equal(h.get("equipmentNotes").value, current.notes);
});

test("Nueva ventana limpia fechas y tipo sin modificar los del evento guardado", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.savedId = equipmentState.selectedEventId; startNewEquipmentWindowDraft()");
  for (const field of ["Type", "StartAt", "EndAt", "SetupAt", "InAt"]) assert.equal(h.get("equipmentEvent" + field).value, "");
  assert.equal(h.get("equipmentNotes").value, "");
  h.run("loadEquipmentEvent(window.savedId)");
  assert.equal(h.get("equipmentEventType").value, "Evento personalizado sintético");
  assert.equal(h.get("equipmentEventEndAt").value, "2026-11-13T00:45");
});

test("cero, consumible, biblioteca y decisiones conservan metadatos en snapshot y JSON", () => {
  const h = harness(); h.fields();
  h.run(`setEquipmentServiceSelection(['fixture-template']);
    equipmentState.manualExtras = [
      {id:'manual-extra-rent',description:'Extra renta sintético',quantity:3,inventoryCategory:'Extras sintéticos',procurementChoice:'rent',itemType:'equipo',libraryExtraId:'library-rent'},
      {id:'manual-extra-consumable',description:'Consumible sintético',quantity:0,inventoryCategory:'Consumibles sintéticos',procurementChoice:'purchase',itemType:'consumible',libraryExtraId:'library-consumable'}
    ]; saveCurrentEquipmentWindow();`);
  let current = plain(h.run("selectedEquipmentEvent()"));
  const rent = current.sections.flatMap((section) => section.items).find((item) => item.description === "Extra renta sintético");
  const consumable = current.sections.flatMap((section) => section.items).find((item) => item.description === "Consumible sintético");
  assert.equal(rent.procurementChoice, "rent"); assert.equal(rent.libraryExtraId, "library-rent");
  assert.equal(consumable.quantity, 0); assert.equal(consumable.itemType, "consumible"); assert.equal(consumable.procurementChoice, "purchase");
  const payload = h.run("JSON.stringify(equipmentEditablePayload('rent'))");
  h.run(`importEquipmentEditablePayload(${payload})`);
  current = plain(h.run("selectedEquipmentEvent()"));
  const items = current.sections.flatMap((section) => section.items);
  assert.equal(items.find((item) => item.description === "Consumible sintético").quantity, 0);
  assert.equal(items.find((item) => item.description === "Consumible sintético").libraryExtraId, "library-consumable");
  assert.equal(items.find((item) => item.description === "Extra renta sintético").procurementChoice, "rent");
  assert.equal(items.find((item) => item.description === "Equipo cero sintético").quantity, 0);
});

test("editar los horarios de una ventana no modifica otra ni mezcla notas", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.firstId = equipmentState.selectedEventId; startNewEquipmentWindowDraft()");
  h.fields({ EventName: "Segundo evento", EventType: "Segundo tipo", EventSetupAt: "2026-11-15T08:00", EventStartAt: "2026-11-15T15:00", EventEndAt: "2026-11-15T18:00", EventInAt: "2026-11-15T21:00", Notes: "Nota segunda" });
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.secondId = equipmentState.selectedEventId; loadEquipmentEvent(window.firstId)");
  assert.equal(h.get("equipmentEventStartAt").value, "2026-11-12T17:30");
  assert.equal(h.get("equipmentNotes").value, "  Nota con espacios\ny segunda línea  ");
  h.run("loadEquipmentEvent(window.secondId)");
  assert.equal(h.get("equipmentEventStartAt").value, "2026-11-15T15:00");
  assert.equal(h.get("equipmentEventType").value, "Segundo tipo");
  assert.equal(h.get("equipmentNotes").value, "Nota segunda");
});

test("horarios invertidos se rechazan antes de guardar la ventana", () => {
  const h = harness(); h.fields({ EventEndAt: "2026-11-12T14:00" });
  h.run("setEquipmentServiceSelection(['fixture-template'])");
  assert.equal(h.run("saveCurrentEquipmentWindow()"), false);
  assert.equal(h.run("equipmentState.events.length"), 0);
  assert.equal(h.requests.length, 0);
});

function openSyntheticEditor(h) {
  h.fields();
  h.run(`applyEquipmentWarehouseInventoryPayload({state:{items:[
    {id:'stock-zero',name:'Equipo cero sintético',category:'Categoría sintética',quantity:0,itemType:'equipo'},
    {id:'stock-a',name:'Equipo sintético A',category:'Categoría sintética',quantity:5,itemType:'equipo'}
  ],movements:[]}}); setEquipmentServiceSelection(['fixture-template']);
  equipmentState.manualExtras = [{id:'extra-existing',description:'Extra conservado sintético',quantity:3,inventoryCategory:'Extras',procurementChoice:'rent',libraryExtraId:'library-existing',itemType:'equipo'}];
  saveCurrentEquipmentWindow();
  equipmentCatalogEditorState.open = true;
  equipmentCatalogEditorState.serviceId = 'fixture-template';
  equipmentCatalogEditorState.draft = equipmentCatalogDraftForService('fixture-template');
  equipmentCatalogEditorState.draft.sections[0].items[1].quantity = 9;`);
}

test("confirmación permanente Cancelar no envía PUT ni cambia la plantilla", async () => {
  const h = harness(); openSyntheticEditor(h);
  const saving = h.run("saveEquipmentCatalogEditor()");
  assert.equal(h.get("equipmentCatalogConfirmDialog").open, true);
  assert.equal(h.requests.length, 0);
  await h.get("equipmentCatalogConfirmCancel").emit("click"); await saving;
  assert.equal(h.requests.length, 0);
  assert.equal(h.run("equipmentServices['fixture-template'].mainSections[0].items[1][0]"), 2);
  assert.equal(h.run("equipmentCatalogEditorState.open"), true);
});

test("X y Escape de confirmación descartan borrador permanente sin escribir", async () => {
  for (const action of ["close", "escape"]) {
    const h = harness(); openSyntheticEditor(h);
    const saving = h.run("saveEquipmentCatalogEditor()");
    if (action === "close") await h.get("equipmentCatalogConfirmClose").emit("click");
    else await h.get("equipmentCatalogConfirmDialog").emit("cancel");
    await saving;
    assert.equal(h.requests.length, 0);
    assert.equal(h.run("equipmentCatalogEditorState.draft"), null);
    assert.equal(h.run("equipmentCatalogEditorState.open"), false);
    assert.equal(h.run("equipmentServices['fixture-template'].mainSections[0].items[1][0]"), 2);
  }
});

test("aceptar guarda una vez y preserva instantánea, ceros y extras del evento existente", async () => {
  const h = harness(); openSyntheticEditor(h);
  const oldItems = plain(h.run("selectedEquipmentSections().flatMap(section=>section.items.map(cloneEquipmentSnapshotItem))"));
  const saving = h.run("saveEquipmentCatalogEditor()");
  await h.get("equipmentCatalogConfirmAccept").emit("click"); await saving;
  const writes = h.requests.filter((request) => request.init.method === "PUT");
  assert.equal(writes.length, 1); assert.equal(writes[0].url, "/api/cuadros-equipo/catalogo");
  assert.equal(writes[0].body.mainSections[0].items[1][0], 9);
  assert.equal(h.run("equipmentServices['fixture-template'].mainSections[0].items[1][0]"), 9);
  const current = plain(h.run("selectedEquipmentSections().flatMap(section=>section.items.map(cloneEquipmentSnapshotItem))"));
  for (const item of oldItems) {
    const matches = current.filter((candidate) => candidate.description === item.description);
    assert.equal(matches.length, 1, "cada línea previa se conserva una vez");
    assert.equal(matches[0].quantity, item.quantity);
    assert.equal(matches[0].procurementChoice, item.procurementChoice);
    assert.equal(matches[0].libraryExtraId, item.libraryExtraId);
  }
  assert.equal(h.run("selectedEquipmentEvent().snapshotLocked"), true);
  const saved = JSON.parse(h.run("JSON.stringify(equipmentEditablePayload('rent'))"));
  assert.equal(saved.event.sections.flatMap((section) => section.items).find((item) => item.description === "Equipo sintético A").quantity, 2);
  assert.equal(saved.event.sections.flatMap((section) => section.items).find((item) => item.description === "Extra conservado sintético").quantity, 3);
  h.run("startNewEquipmentWindowDraft(); setEquipmentServiceSelection(['fixture-template'])");
  assert.equal(h.run("selectedEquipmentSections().flatMap(section=>section.items).find(item=>item.description==='Equipo sintético A').quantity"), 9);
});

function syntheticRemoteEvent(id, overrides = {}) {
  return { id, name: "Evento remoto sintético", place: "Ubicación remota", type: "Remoto", date: "2026-11-12", setupAt: "2026-11-12T08:00", startAt: "2026-11-12T17:30", endAt: "2026-11-13T00:45", equipmentInAt: "2026-11-13T03:00", updatedAt: "2026-10-20T14:00:00.000Z", serviceIds: ["fixture-template"], serviceId: "fixture-template", sections: [{ id: "remote-section", title: "Categoría remota", items: [{ id: "remote-item", description: "Equipo remoto sintético", quantity: 4 }] }], ...overrides };
}
function stateFor(events) { return { events, range: { from: "2026-11-09", to: "2026-11-15" }, revision: "revision-synthetic", plan: { rows: [] }, transfers: [], loaded: true }; }

test("refresco compartido conserva el borrador no guardado y actualiza otros eventos", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.savedId=equipmentState.selectedEventId; selectedEquipmentEvent().updatedAt='2026-10-20T13:00:00.000Z'; equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;");
  const id = h.run("window.savedId");
  h.get("equipmentEventPlace").value = "Ubicación sin guardar";
  h.get("equipmentNotes").value = "Notas sin guardar";
  h.context.remote = stateFor([syntheticRemoteEvent(id), syntheticRemoteEvent("other-event")]);
  h.run("applyEquipmentSharedState(remote)");
  assert.equal(h.get("equipmentEventPlace").value, "Ubicación sin guardar");
  assert.equal(h.get("equipmentNotes").value, "Notas sin guardar");
  assert.equal(h.run("selectedEquipmentEvent().updatedAt"), "2026-10-20T13:00:00.000Z");
  assert.equal(h.run("equipmentState.events.find(event=>event.id==='other-event').place"), "Ubicación remota");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
});

test("cargar agenda por primera vez no sobrescribe campos de un borrador nuevo", () => {
  const h = harness(); h.fields();
  h.run("equipmentSharedWorkspace.dirty=true;");
  h.context.remote = stateFor([syntheticRemoteEvent("other-event")]);
  h.run("applyEquipmentSharedState(remote)");
  assert.equal(h.get("equipmentEventPlace").value, "Ubicación sintética");
  assert.equal(h.get("equipmentEventType").value, "Evento personalizado sintético");
  assert.equal(h.get("equipmentEventStartAt").value, "2026-11-12T17:30");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
});

test("borrador activo persiste si otro usuario mueve su evento fuera del período", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.savedId=equipmentState.selectedEventId; selectedEquipmentEvent().updatedAt='2026-10-20T13:00:00.000Z'; equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;");
  const id = h.run("window.savedId");
  h.get("equipmentEventPlace").value = "Cambios locales pendientes";
  h.context.remote = stateFor([syntheticRemoteEvent(id, { date: "2026-12-01", setupAt: "2026-12-01T08:00", startAt: "2026-12-01T17:30", endAt: "2026-12-01T19:00", equipmentInAt: "2026-12-01T22:00" })]);
  h.run("applyEquipmentSharedState(remote)");
  assert.equal(h.get("equipmentEventPlace").value, "Cambios locales pendientes");
  assert.equal(h.run("selectedEquipmentEvent()?.id"), id, "la ventana sigue ligada a su ID; no se convierte en un evento nuevo al guardar");
});

test("refresco limpio instala cambio remoto y cerrar/cancelar remoto limpia selección", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.savedId=equipmentState.selectedEventId; selectedEquipmentEvent().updatedAt='2026-10-20T13:00:00.000Z'; equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=false;");
  const id = h.run("window.savedId"); h.context.remote = stateFor([syntheticRemoteEvent(id)]);
  h.run("applyEquipmentSharedState(remote)");
  assert.equal(h.get("equipmentEventPlace").value, "Ubicación remota");
  assert.equal(h.get("equipmentEventType").value, "Remoto");
  h.context.remote = stateFor([]); h.run("applyEquipmentSharedState(remote)");
  assert.equal(h.run("equipmentState.selectedEventId"), "");
  assert.equal(h.get("equipmentEventPlace").value, "");
});

test("recomendaciones remotas nunca se presentan como actuales si el cuadro tiene cambios pendientes", () => {
  const h = harness();
  h.run("equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true; equipmentSharedWorkspace.state={plan:{rows:[{warehouseInventoryId:'synthetic-stock',required:50,itemType:'equipo',action:'RENTA'}]}};");
  h.context.localRows = [{ id: "local", warehouseInventoryId: "synthetic-stock", description: "Equipo sintético", quantity: 2 }];
  assert.deepEqual(plain(h.run("equipmentApplySharedPlanning(localRows)")), h.context.localRows);
});

test("guardar ventana compartida persiste una vez con horarios completos, cero y decisión de compra", async () => {
  const h = harness(); h.fields();
  h.run(`setEquipmentServiceSelection(['fixture-template']);
    equipmentState.manualExtras = [{id:'extra-shared',description:'Consumible compartido sintético',quantity:0,itemType:'consumible',inventoryCategory:'Consumibles',procurementChoice:'purchase',libraryExtraId:'library-shared'}];
    equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;
    equipmentSharedWorkspace.client=window.EquipmentWorkspace.create({date:'2026-11-12',onState:applyEquipmentSharedState});`);
  let saved;
  h.responses.push((_url, init) => {
    const { event } = JSON.parse(init.body);
    saved = { ...event, updatedAt: "2026-10-20T15:00:00.000Z", status: "reserved" };
    return { ok: true, json: async () => ({ event: saved, events: [saved], revision: "saved-revision" }) };
  });
  h.responses.push(() => ({ ok: true, json: async () => ({ events: [saved], revision: "saved-revision" }) }));
  h.responses.push(() => ({ ok: true, json: async () => ({ rows: [], revision: "saved-revision" }) }));
  assert.equal(await h.run("saveEquipmentSharedWindow()"), true);
  const writes = h.requests.filter((request) => request.init.method === "PUT");
  assert.equal(writes.length, 1);
  assert.match(writes[0].url, /^\/api\/cuadros-equipo\/eventos\//);
  assert.equal(writes[0].init.credentials, "same-origin");
  assert.equal(writes[0].body.event.startAt, "2026-11-12T17:30");
  assert.equal(writes[0].body.event.endAt, "2026-11-13T00:45");
  assert.equal(writes[0].body.event.snapshotLocked, true);
  const item = writes[0].body.event.sections.flatMap((section) => section.items).find((item) => item.description === "Consumible compartido sintético");
  assert.equal(item.quantity, 0); assert.equal(item.procurementChoice, "purchase"); assert.equal(item.itemType, "consumible"); assert.equal(item.libraryExtraId, "library-shared");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), false);
  assert.equal(h.run("equipmentSharedWorkspace.saving"), false);
  assert.equal(h.run("selectedEquipmentEvent().id"), saved.id);
  assert.equal(h.get("equipmentEventType").value, "Evento personalizado sintético");
  assert.ok(h.requests.every((request) => !/inventario-bodega/.test(request.url)), "reservar no altera las existencias físicas");
});

test("conflicto remoto al guardar conserva ventana y borrador para resolver sin duplicar", async () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.savedId=equipmentState.selectedEventId; selectedEquipmentEvent().updatedAt='2026-10-20T13:00:00.000Z'; equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true; equipmentSharedWorkspace.client=window.EquipmentWorkspace.create({date:'2026-11-12',onState:applyEquipmentSharedState});");
  const id = h.run("window.savedId");
  h.get("equipmentNotes").value = "Cambios locales no confirmados";
  h.responses.push({ ok: false, status: 409, json: async () => ({ error: "Otro usuario modificó el evento. Actualice antes de continuar." }) });
  await assert.rejects(h.run("saveEquipmentSharedWindow()"), /Otro usuario modificó/);
  assert.equal(h.run("selectedEquipmentEvent().id"), id);
  assert.equal(h.get("equipmentNotes").value, "Cambios locales no confirmados");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  assert.equal(h.run("equipmentSharedWorkspace.saving"), false);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].body.expectedUpdatedAt, "2026-10-20T13:00:00.000Z");
  assert.equal(h.requests[0].body.event.id, id);
});

test("inicializar agenda compartida conserva borrador activo y conecta ambos modales", async () => {
  const h = harness(); h.fields();
  h.nodes.set("#equipmentPersonalizeEventButton", new h.Element("equipmentPersonalizeEventButton"));
  h.context.window.EquipmentEventPersonalizer = { init: (options) => { h.context.personalizerOptions = options; return {}; } };
  h.context.window.EquipmentExtrasLibrary = { init: (options) => { h.context.extrasOptions = options; return {}; } };
  h.run("waitForEquipmentAuthenticatedApp=async()=>{}; equipmentSharedWorkspace.dirty=true;");
  const remote = syntheticRemoteEvent("init-remote");
  h.responses.push({ ok: true, json: async () => ({ events: [remote], revision: "init-revision" }) });
  h.responses.push({ ok: true, json: async () => ({ rows: [], revision: "init-revision" }) });
  await h.run("initEquipmentSharedWorkspace()");
  assert.equal(h.get("equipmentEventPlace").value, "Ubicación sintética");
  assert.equal(h.get("equipmentEventEndAt").value, "2026-11-13T00:45");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  assert.equal(h.context.personalizerOptions.openerId, "equipmentPersonalizeEventButton");
  assert.equal(h.context.extrasOptions.openerId, "equipmentExtrasLibraryButton");
  assert.equal(h.context.extrasOptions.inventoryReady(), false);
  assert.equal(typeof h.context.personalizerOptions.beforeOpen, "function");
  assert.equal(typeof h.context.personalizerOptions.onCommit, "function");
  assert.equal(h.run("equipmentSharedWorkspace.state.events[0].id"), "init-remote");
});

test("cambiar ventana o crear otra no abandona cambios compartidos sin guardar", () => {
  for (const action of ["switch", "new"]) {
    const h = harness(); h.fields();
    h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.firstId=equipmentState.selectedEventId; startNewEquipmentWindowDraft()");
    h.fields({ EventName: "Segundo evento sintético" });
    h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.secondId=equipmentState.selectedEventId; loadEquipmentEvent(window.firstId); selectedEquipmentEvent().updatedAt='2026-10-20T13:00:00.000Z'; equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;");
    h.get("equipmentNotes").value = "No abandonar este borrador";
    if (action === "switch") h.run("loadEquipmentEvent(window.secondId)");
    else h.run("startNewEquipmentWindowDraft()");
    assert.equal(h.run("equipmentState.selectedEventId"), h.run("window.firstId"));
    assert.equal(h.get("equipmentNotes").value, "No abandonar este borrador");
    assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
    assert.equal(h.requests.length, 0);
  }
});

test("eliminar y deshacer mediante botones marcan cambios pendientes compartidos", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=false; window.firstItemId=selectedEquipmentSections()[0].items[0].id; removeManualEquipmentItem(window.firstItemId)");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  h.run("equipmentSharedWorkspace.dirty=false; restoreLastDeletedEquipment()");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
});

test("extras manuales por acciones internas invalidan plan compartido antes de guardar", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=false; appendEquipmentExtraItems([{description:'Extra manual sintético',quantity:2,procurementChoice:'rent',inventoryCategory:'Extras'}])");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  assert.equal(h.run("selectedEquipmentSections().flatMap(section=>section.items).find(item=>item.description==='Extra manual sintético').quantity"), 2);
});

test("actualizar cantidad programáticamente marca cambios antes del siguiente refresco", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=false; window.secondItemId=selectedEquipmentSections()[0].items[1].id; updateEquipmentItem(window.secondItemId,'quantity',3)");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
});

test("PDF de otra ventana no guarda la actual si hay cambios sin confirmar", async () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.firstId=equipmentState.selectedEventId; startNewEquipmentWindowDraft()");
  h.fields({ EventName: "Segundo evento sintético" });
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); window.secondId=equipmentState.selectedEventId; loadEquipmentEvent(window.firstId); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true; window.pdfSaves=0; saveEquipmentPdf=async()=>{window.pdfSaves++};");
  h.get("equipmentNotes").value = "No guardar otro evento";
  await h.run("saveEquipmentEventPdf(window.secondId)");
  assert.equal(h.run("window.pdfSaves"), 0);
  assert.equal(h.requests.length, 0);
  assert.equal(h.run("equipmentState.selectedEventId"), h.run("window.firstId"));
  assert.equal(h.get("equipmentNotes").value, "No guardar otro evento");
});

test("volver a pulsar la ventana activa no restaura encima del borrador pendiente", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;");
  h.get("equipmentNotes").value = "Nota recién escrita sin render";
  h.run("loadEquipmentEvent(equipmentState.selectedEventId)");
  assert.equal(h.get("equipmentNotes").value, "Nota recién escrita sin render");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
});

test("importar JSON con cambios pendientes se detiene antes de reemplazar ventanas", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;");
  h.get("equipmentNotes").value = "Borrador protegido antes de importar";
  const before = h.run("JSON.stringify(equipmentState.events)");
  h.context.payload = { type: "live-productions-equipment-requirement", events: [syntheticRemoteEvent("import-another")] };
  assert.throws(() => h.run("importEquipmentEditablePayload(payload)"), /Guarde los cambios.*antes de importar/);
  assert.equal(h.run("JSON.stringify(equipmentState.events)"), before);
  assert.equal(h.get("equipmentNotes").value, "Borrador protegido antes de importar");
  assert.equal(h.requests.length, 0);
});

test("JSON importado usa ID nuevo sin versión de concurrencia ajena y conserva datos fuente", () => {
  const h = harness();
  h.run("equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.client={getState:()=>({events:[]})};");
  const source = syntheticRemoteEvent("source-old-id", {
    createdAt: "2026-10-19T12:00:00.000Z", warehouseDispatchId: "synthetic-new-dispatch", notes: "  Nota original\ncon segunda línea  ",
    sections: [{ id: "import-source", title: "Categoría fuente", items: [{ id: "source-zero", quantity: 0, description: "Equipo fuente cero", libraryExtraId: "library-source", itemType: "consumible", procurementChoice: "purchase", inventoryCategory: "Categoría fuente" }] }],
    serviceIds: [], serviceId: ""
  });
  h.context.payload = { type: "live-productions-equipment-requirement", events: [source] };
  h.run("importEquipmentEditablePayload(payload)");
  const restored = plain(h.run("selectedEquipmentEvent()"));
  assert.notEqual(restored.id, "source-old-id");
  assert.equal("updatedAt" in restored, false);
  assert.equal("createdAt" in restored, false);
  assert.equal(restored.notes, source.notes);
  const item = restored.sections[0].items[0];
  assert.equal(item.quantity, 0); assert.equal(item.itemType, "consumible"); assert.equal(item.procurementChoice, "purchase"); assert.equal(item.libraryExtraId, "library-source");
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  h.context.remote = stateFor([]); h.run("applyEquipmentSharedState(remote)");
  assert.equal(h.run("selectedEquipmentEvent().id"), restored.id, "un borrador importado no se considera ya guardado en el servidor");
  assert.equal(h.requests.length, 0);
});

test("JSON de un cuadro ya compartido se identifica por salida antes de duplicarlo", () => {
  const h = harness(); h.fields();
  h.run("setEquipmentServiceSelection(['fixture-template']); saveCurrentEquipmentWindow(); equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=false; equipmentSharedWorkspace.client={getState:()=>({events:[{id:'existing-shared',warehouseDispatchId:'same-synthetic-dispatch'}]})};");
  const before = h.run("JSON.stringify(equipmentState.events)");
  h.context.payload = { type: "live-productions-equipment-requirement", events: [syntheticRemoteEvent("old-export-id", { warehouseDispatchId: "same-synthetic-dispatch" })] };
  assert.throws(() => h.run("importEquipmentEditablePayload(payload)"), /ya está en la agenda.*Ábralo desde las ventanas/);
  assert.equal(h.run("JSON.stringify(equipmentState.events)"), before);
  assert.equal(h.get("equipmentEventPlace").value, "Ubicación sintética");
  assert.equal(h.requests.length, 0);
});

test("categorías repetidas del cuadro pegado comparten encabezado visual sin perder cero, notas ni celdas", () => {
  const h = harness();
  h.context.sourceSections = [
    ["fragment-a", "Audio", 2, "Equipo de audio primero"],
    ["fragment-b", "Consumibles", 1, "Consumible intermedio"],
    ["fragment-c", "Iluminación", 3, "Luz intermedia"],
    ["fragment-d", "Audio", 0, "Equipo de audio cero"]
  ].map(([id, title, quantity, description], index) => ({
    id, title, documentSection: true, sourceCells: [{ ref: `A${index + 1}`, value: quantity }, { ref: `B${index + 1}`, value: description }],
    items: [{ id: id + "-item", quantity, description, sourceItemIndex: 0 }],
    rows: [{ type: "item", sourceItemIndex: 0, cells: [{ ref: `A${index + 1}`, value: quantity }, { ref: `B${index + 1}`, value: description }], notes: [`Nota ${id}`] }]
  }));
  const before = JSON.stringify(h.context.sourceSections);
  const html = h.run("tableForEquipmentSections(sourceSections,true)");
  assert.equal((html.match(/<td colspan="2">Audio<\/td>/g) || []).length, 1);
  assert.equal((html.match(/equipment-category-row/g) || []).length, 3);
  for (const section of h.context.sourceSections) {
    assert.equal(html.split(section.items[0].description).length - 1, 1);
    assert.equal(html.split(`Nota ${section.id}`).length - 1, 1);
  }
  assert.match(html, /class="equipment-qty equipment-service-quantity-cell">0<\/td>/);
  assert.ok(html.indexOf("Equipo de audio cero") < html.indexOf("Consumible intermedio"), "las filas de Audio aparecen juntas");
  assert.equal(JSON.stringify(h.context.sourceSections), before, "la presentación no altera IDs, notas, celdas ni orden fuente guardado");
});

module.exports = { harness, plain };

test("vincular inventario exacto conserva cero, notas, celdas y texto del cuadro", () => {
  const h = harness();
  h.run("equipmentSharedWorkspace.enabled = true; applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'physical-one',name:'Equipo sintético A',category:'Audio',itemType:'equipo',quantity:3}],movements:[]}})");
  h.context.fixture = { id: "binding", snapshotLocked: true, sections: [{ id: "s", title: "Audio", rows: [{ type: "note", text: "Fila original" }], items: [{ id: "zero", description: "  Equipo sintético A  ", quantity: 0, notes: ["  no borrar  "], sourceCells: ["0", "  Equipo sintético A  ", "Extra"] }] }] };
  const result = plain(h.run("equipmentBindSharedInventory(fixture)"));
  assert.equal(result.sections[0].items[0].warehouseInventoryId, "physical-one");
  assert.equal(result.sections[0].items[0].quantity, 0);
  assert.equal(result.sections[0].items[0].description, "  Equipo sintético A  ");
  assert.deepEqual(result.sections[0].items[0].notes, ["  no borrar  "]);
  assert.deepEqual(result.sections[0].items[0].sourceCells, ["0", "  Equipo sintético A  ", "Extra"]);
  assert.deepEqual(result.sections[0].rows, h.context.fixture.sections[0].rows);
  assert.deepEqual(result.documentSections[0].items[0].sourceCells, result.sections[0].items[0].sourceCells);
});

test("coincidencias físicas ambiguas no se convierten en equivalencias", () => {
  const h = harness();
  h.run("equipmentSharedWorkspace.enabled = true; applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'one',name:'Equipo sintético A',category:'Audio',quantity:3},{id:'two',name:'Equipo sintético A',category:'Audio',quantity:2}],movements:[]}})");
  h.context.fixture = { sections: [{ title: "Audio", items: [{ id: "x", description: "Equipo sintético A", quantity: 1 }] }] };
  assert.throws(() => h.run("equipmentBindSharedInventory(fixture)"), /varios registros físicos/);
});

test("modo compartido no convierte compra ni ingreso con comprobante inventado en existencias", () => {
  const h = harness();
  h.run("equipmentSharedWorkspace.enabled = true; applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'one',name:'Equipo sintético A',category:'Audio',quantity:3}],movements:[]}})");
  assert.equal(h.run("equipmentPendingProcurementChoice({description:'Equipo sintético A',warehouseInventoryId:'one',procurementChoice:'purchase'})"), "purchase");
  assert.equal(h.run("equipmentPendingProcurementChoice({description:'Equipo sintético A',warehouseInventoryId:'one',procurementChoice:'save',inventoryIngressReceipts:[{requestId:'fake',itemId:'one',quantity:3,index:0}]})"), "save");
  h.run("applyEquipmentWarehouseInventoryPayload({state:{items:[{id:'one',name:'Equipo sintético A',category:'Audio',quantity:3}],movements:[],equipmentStockReceipts:[{requestId:'real',items:[{itemId:'one',quantity:3}]}]}})");
  assert.equal(h.run("equipmentPendingProcurementChoice({description:'Equipo sintético A',warehouseInventoryId:'one',procurementChoice:'save',inventoryIngressReceipts:[{requestId:'real',itemId:'one',quantity:3,index:0}]})"), "");
});

test("compra recibida enlaza sólo evento, línea y descripción exactos preservando origen", () => {
  const h = harness();
  h.context.inventory = { state: { items: [{ id: "real", name: "Equipo comprado", category: "Audio", quantity: 1, itemType: "equipo", equipmentPurchaseLinks: [{ requestId: "req", eventId: "event-buy", itemId: "line-buy", description: "Equipo comprado", receivedQuantity: 1 }] }], movements: [] } };
  h.run("applyEquipmentWarehouseInventoryPayload(inventory)");
  h.context.fixture = { id: "event-buy", sections: [{ id: "s", title: "Audio", rows: [{ type: "note", text: "Origen" }], items: [{ id: "line-buy", description: "Equipo comprado", quantity: 2, procurementChoice: "purchase", notes: ["Literal"], sourceCells: ["2", "Equipo comprado"] }] }] };
  const result = plain(h.run("equipmentEventWithReceivedPurchases(fixture)"));
  assert.equal(result.sections[0].items[0].warehouseInventoryId, "real");
  assert.equal(result.sections[0].items[0].quantity, 2, "la compra recibida no altera la cantidad solicitada");
  assert.equal(result.sections[0].items[0].procurementChoice, undefined);
  assert.deepEqual(result.sections[0].items[0].sourceCells, ["2", "Equipo comprado"]);
  h.context.fixture.sections[0].items[0].description = "Equipo comprado.";
  assert.equal(h.run("equipmentEventWithReceivedPurchases(fixture)"), null, "puntuación no prueba equivalencia física");
  h.context.fixture.sections[0].items[0].description = "Equipo comprado";
  h.context.fixture.id = "other";
  assert.equal(h.run("equipmentEventWithReceivedPurchases(fixture)"), null);
});

test("solicitud de compra conserva ID físico, tipo y referencias y no mezcla homónimos", () => {
  const h = harness();
  h.run("CustomEvent = function(type, options){this.type=type;this.detail=options.detail}; sentPurchases=[]; document.dispatchEvent=event=>sentPurchases.push(event); equipmentSharedWorkspace.enabled=true");
  h.context.events = [{ id: "buy-event", sections: [{ title: "Audio", items: [{ id: "buy-one", description: "Equipo comprado", quantity: 2, procurementChoice: "purchase", inventoryCategory: "Audio" }] }] }];
  h.run("equipmentSharedWorkspace.state={events}");
  h.context.items = [{ description: "Equipo comprado", quantity: 2, procurementChoice: "purchase", inventoryCategory: "Audio", itemType: "equipo" }, { description: "Pila", quantity: 3, procurementChoice: "purchase", inventoryCategory: "Consumo", warehouseInventoryId: "pila-A", itemType: "consumible" }, { description: "Pila", quantity: 2, procurementChoice: "purchase", inventoryCategory: "Consumo", warehouseInventoryId: "pila-B", itemType: "consumible" }];
  h.run("sendEquipmentPurchaseRequest(items)");
  const detail = plain(h.run("sentPurchases[0].detail"));
  assert.ok(detail.requestId);
  assert.equal(detail.items.length, 3);
  assert.deepEqual(detail.items[0].eventItemRefs, [{ eventId: "buy-event", itemId: "buy-one", description: "Equipo comprado" }]);
  assert.equal(detail.items[1].warehouseInventoryId, "pila-A");
  assert.equal(detail.items[2].warehouseInventoryId, "pila-B");
  assert.equal(detail.items[1].itemType, "consumible");
});

test("revisión personalizada consulta servidor sin guardar el evento", async () => {
  const h = harness();
  h.responses.push({ ok: true, json: async () => ({ preview: true, rows: [], revision: 2 }) });
  h.context.fixture = { id: "preview", date: "2026-11-12", startAt: "2026-11-12T17:00", sections: [] };
  assert.equal((await h.run("previewEquipmentSharedEvent(fixture)")).preview, true);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, "/api/cuadros-equipo/disponibilidad");
  assert.equal(h.requests[0].init.method, "POST");
  assert.equal(h.requests[0].body.from, "2026-11-09");
  assert.equal(h.requests[0].body.to, "2026-11-15");
});
