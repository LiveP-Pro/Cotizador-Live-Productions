const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Synthetic services only; this harness never loads catalogs or saved gear data.
function harness() {
  const nodes = new Map(), requests = [], responses = [];
  class Element {
    constructor(id) { this.id = id; this.value = ''; this.dataset = {}; this.listeners = {}; this.textContent = ''; this.disabled = false; this.matches = {}; this.classList = { add() {}, remove() {}, toggle() {} }; }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    async emit(name) { for (const handler of this.listeners[name] || []) await handler({ target: this, currentTarget: this }); }
    setAttribute(name, value) { this[name] = value; }
    querySelectorAll(selector) { return this.matches[selector] || []; }
    querySelector() { return null; }
    focus() {}
  }
  for (const suffix of ['EventPlace', 'EventName', 'EventType', 'EventSetupAt', 'EventStartAt', 'EventEndAt', 'EventDate', 'EventInAt', 'EventResponsible', 'Notes', 'SaveStatus', 'CatalogEditorStatus', 'CatalogSaveButton', 'CatalogEditorContent']) nodes.set('#equipment' + suffix, new Element('equipment' + suffix));
  const context = vm.createContext({ console, Date, URL, Blob, Math, JSON, Map, Set, Number, String, Boolean, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {},
    window: { requerimientoEquipoCatalog: { version: 'synthetic-schedule-v1', groups: [{ id: 'fixtures', label: 'PRUEBAS', serviceIds: ['fixture'] }], services: { fixture: { name: 'Servicio sintético', mainSections: [{ id: 'section-1', title: 'Audio', items: [[0, 'Equipo sintético']] }], extras: [] } } },
      requerimientoEquipoInventory: { categories: [] }, location: { protocol: 'http:', hash: '#requerimiento-equipo' }, addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(fn) { fn(); } },
    document: { querySelector: selector => nodes.get(selector) || null, querySelectorAll() { return []; }, addEventListener() {}, dispatchEvent() {} },
    fetch: async (url, init = {}) => { requests.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined }); const response = responses.shift(); return typeof response === 'function' ? response(url, init) : response || { ok: true, json: async () => ({}) }; }
  });
  const run = source => vm.runInContext(source, context);
  run(fs.readFileSync(path.join(__dirname, '..', 'equipment.js'), 'utf8'));
  run(`renderEquipmentModule = () => {}; renderEquipmentCatalogEditor = () => {};
    equipmentRecognizedInventoryChoice = () => true; currentEquipmentService = () => ({id:'fixture'});
    reportEquipmentTimelineValidation = validation => { window.lastValidation = validation; };
    populateNativeEquipmentServiceSelect = () => {};`);
  const metadata = { EventPlace: 'Lugar sintético', EventName: 'Evento sintético', EventType: 'Prueba', EventSetupAt: '2026-10-20T09:00', EventStartAt: '2026-10-20T11:00', EventEndAt: '2026-10-20T17:00', EventDate: '2026-10-20', EventInAt: '2026-10-20T21:00' };
  for (const [field, value] of Object.entries(metadata)) nodes.get('#equipment' + field).value = value;
  function editor() {
    run(`equipmentCatalogEditorState.serviceRevisions = {fixture:'revision-a'};
      equipmentCatalogEditorState.open = true;
      equipmentCatalogEditorState.draft = equipmentCatalogDraftForService('fixture');
      equipmentCatalogEditorState.draft.sections[0].editorId = 'section-1';
      requestEquipmentCatalogPermanentConfirmation = async () => true;`);
  }
  return { run, context, nodes, requests, responses, Element, editor, get: id => nodes.get('#' + id) };
}
const plain = value => JSON.parse(JSON.stringify(value));
const complete = () => ({ setupAt: '2026-10-20T09:00', startAt: '2026-10-20T11:00', endAt: '2026-10-20T17:00', equipmentInAt: '2026-10-20T21:00', date: '2026-10-20' });

test('fechas imposibles, horas desbordadas y sufijos incompletos se rechazan sin normalizar', () => {
  const h = harness();
  for (const value of ['2026-02-30T09:00', '2026-13-01T09:00', '2026-10-20T25:00', '2026-10-20T12:60', '2026-10-20T12:30basura', '2026-10-20T12:30:99']) {
    h.context.value = value; assert.equal(h.run('Number.isNaN(equipmentDateTimeMillis(value))'), true, value);
  }
  for (const value of ['2028-02-29T09:00', '2026-10-20T00:00', '2026-10-20T23:59', '2026-10-20T12:30:00.000Z']) {
    h.context.value = value; assert.equal(h.run('Number.isFinite(equipmentDateTimeMillis(value))'), true, value);
  }
});

test('conserva los códigos legacy de regreso anterior y evento fuera del rango', () => {
  const h = harness(); h.context.e = { ...complete(), equipmentInAt: '2026-10-20T08:00' };
  assert.equal(h.run('equipmentEventTimelineValidation(e,{requireComplete:true}).code'), 'return-before-setup');
  h.context.e = { ...complete(), date: '2026-10-19' };
  assert.equal(h.run('equipmentEventTimelineValidation(e,{requireComplete:true}).code'), 'event-outside-operation-range');
  h.context.e = { ...complete(), date: '2026-02-30' };
  assert.equal(h.run('equipmentEventTimelineValidation(e,{requireComplete:true}).valid'), false);
});

test('nuevo evento compartido exige montaje, inicio, finalización y regreso aunque exista fecha oculta', () => {
  const h = harness(); h.run('equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.client={getState:()=>({events:[]})};');
  h.get('equipmentEventStartAt').value = ''; h.get('equipmentEventEndAt').value = '';
  assert.equal(h.run('validateCurrentEquipmentWindowDraft()'), false);
  const validation = plain(h.context.window.lastValidation);
  assert.equal(validation.code, 'missing-schedule'); assert.ok(validation.invalidFields.includes('startAt')); assert.ok(validation.invalidFields.includes('endAt'));
  assert.equal(h.requests.length, 0);
  h.get('equipmentEventStartAt').value = '2026-10-20T11:00'; h.get('equipmentEventEndAt').value = '2026-10-20T17:00';
  assert.equal(h.run('validateCurrentEquipmentWindowDraft()'), true);
});

test('legacy persistido permite únicamente horas que faltaban en el snapshot del servidor', () => {
  const h = harness();
  h.context.persisted = { id: 'legacy', updatedAt: 'persisted-version', ...complete(), startAt: '', endAt: '' };
  h.run('equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.client={getState:()=>({events:[persisted]})}; equipmentState.selectedEventId="legacy";');
  h.get('equipmentEventStartAt').value = ''; h.get('equipmentEventEndAt').value = '';
  assert.equal(h.run('validateCurrentEquipmentWindowDraft()'), true);
  h.context.persisted.endAt = '2026-10-20T17:00';
  assert.equal(h.run('validateCurrentEquipmentWindowDraft()'), false);
  assert.ok(h.context.window.lastValidation.invalidFields.includes('endAt'));
});

test('borrar horas en selectedEvent no convierte un evento moderno en legacy permitido', () => {
  const h = harness(); h.context.persisted = { id: 'modern', updatedAt: 'persisted-version', ...complete() };
  h.run('equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.client={getState:()=>({events:[persisted]})}; equipmentState.selectedEventId="modern"; equipmentState.events=[{...persisted,startAt:"",endAt:""}];');
  h.get('equipmentEventStartAt').value = ''; h.get('equipmentEventEndAt').value = '';
  assert.equal(h.run('validateCurrentEquipmentWindowDraft()'), false);
});

test('cronología parcial legacy compara todos los tiempos conocidos sin liberar ni inventar horas', () => {
  const h = harness();
  for (const partial of [{ ...complete(), startAt: '', endAt: '2026-10-20T08:00' }, { ...complete(), startAt: '2026-10-20T22:00', endAt: '' }]) {
    h.context.e = partial;
    assert.equal(h.run('equipmentEventTimelineValidation(e,{requireComplete:true}).code'), 'event-hours-outside-operation-range');
  }
  h.context.e = { ...complete(), startAt: '', endAt: '' };
  assert.equal(h.run('equipmentEventTimelineValidation(e,{requireComplete:true}).valid'), true);
  assert.equal(h.context.e.startAt, ''); assert.equal(h.context.e.endAt, '');
});

test('cantidad permanente conserva literal al escribir y distingue cero de vacío o negativo', async () => {
  const h = harness(); h.editor();
  const input = new h.Element('quantity'); input.dataset.catalogItemQuantity = 'section-1:0';
  h.get('equipmentCatalogEditorContent').matches['[data-catalog-item-quantity]'] = [input]; h.run('bindEquipmentCatalogEditorInputs()');
  for (const value of ['', '  ', '-2', 'no-numérico']) {
    input.value = value; await input.emit('input');
    assert.equal(h.run('equipmentCatalogEditorState.draft.sections[0].items[0].quantity'), value);
    assert.equal(h.run('equipmentCatalogEditorValidation().ok'), false); assert.equal(input['aria-invalid'], 'true');
  }
  input.value = '0'; await input.emit('input');
  assert.equal(h.run('equipmentCatalogEditorValidation().ok'), true);
  assert.equal(h.run('equipmentCatalogEditorPayload().mainSections[0].items[0][0]'), 0);
  assert.equal(input['aria-invalid'], 'false');
});

test('agregar cantidad a una fila editada suma números y no concatena textos', async () => {
  const h = harness(); h.editor();
  const button = new h.Element('add'); button.dataset.catalogAddItem = 'section-1';
  const choice = new h.Element('choice'); choice.dataset.catalogChoice = 'section-1'; choice.value = 'Equipo sintético';
  const quantity = new h.Element('addQuantity'); quantity.dataset.catalogChoiceQuantity = 'section-1'; quantity.value = '3';
  const content = h.get('equipmentCatalogEditorContent');
  content.matches['[data-catalog-add-item]'] = [button]; content.matches['[data-catalog-choice]'] = [choice]; content.matches['[data-catalog-choice-quantity]'] = [quantity];
  h.run('equipmentCatalogEditorState.draft.sections[0].items[0].quantity="2"; bindEquipmentCatalogEditorInputs()');
  await button.emit('click'); assert.equal(h.run('equipmentCatalogEditorState.draft.sections[0].items[0].quantity'), 5);
  quantity.value = ''; await button.emit('click'); assert.equal(h.run('equipmentCatalogEditorState.draft.sections[0].items[0].quantity'), 5);
});

test('cambiar o invalidar draft mientras se confirma no guarda un cuadro diferente', async () => {
  for (const mode of ['replace', 'invalid', 'saving']) {
    const h = harness(); h.editor(); let confirm;
    h.context.confirmPromise = new Promise(resolve => { confirm = resolve; });
    h.run('requestEquipmentCatalogPermanentConfirmation=()=>confirmPromise');
    const saving = h.run('saveEquipmentCatalogEditor()');
    if (mode === 'replace') h.run('equipmentCatalogEditorState.draft={...equipmentCatalogEditorState.draft}');
    if (mode === 'invalid') h.run('equipmentCatalogEditorState.draft.sections[0].items[0].quantity=""');
    if (mode === 'saving') h.run('equipmentCatalogEditorState.saving=true');
    confirm(true); await saving;
    assert.equal(h.requests.length, 0, mode);
  }
});

test('revision del servicio se captura al abrir draft y no cambia con un GET posterior', () => {
  const h = harness(); h.editor();
  h.run('applyEquipmentCatalogOverrides({baseCatalogVersion:"synthetic-schedule-v1",services:{},serviceRevisions:{fixture:"revision-b"}})');
  assert.equal(h.run('equipmentCatalogEditorState.serviceRevisions.fixture'), 'revision-b');
  assert.equal(h.run('equipmentCatalogEditorPayload().expectedServiceRevision'), 'revision-a');
  assert.equal(h.run('equipmentCatalogDraftForService("fixture").expectedServiceRevision'), 'revision-b');
});

test('409 permanente conserva borrador y token original; éxito actualiza revision sin modificar inventario', async () => {
  const h = harness(); h.editor();
  h.responses.push({ ok: false, status: 409, json: async () => ({ error: 'La plantilla cambió en otro equipo' }) });
  await h.run('saveEquipmentCatalogEditor()');
  assert.equal(h.requests[0].body.expectedServiceRevision, 'revision-a');
  assert.equal(h.run('equipmentCatalogEditorState.open'), true); assert.ok(h.run('equipmentCatalogEditorState.draft'));
  assert.match(h.get('equipmentCatalogEditorStatus').textContent, /otro equipo/);
  h.responses.push({ ok: true, json: async () => ({ serviceId: 'fixture', service: { name: 'Servicio sintético', mainSections: [{ id: 'section-1', title: 'Audio', items: [[0, 'Equipo sintético']] }] }, serviceRevision: 'revision-c' }) });
  await h.run('saveEquipmentCatalogEditor()');
  assert.equal(h.run('equipmentCatalogEditorState.serviceRevisions.fixture'), 'revision-c');
  assert.equal(h.run('equipmentCatalogEditorState.open'), false);
  assert.equal(h.requests.length, 2);
});

test('crear servicio no hereda el token de edición ni omite createOnly', () => {
  const h = harness(); h.editor();
  h.run('equipmentCatalogEditorState.draft.mode="create"; equipmentCatalogEditorState.draft.name="Servicio nuevo sintético"; equipmentCatalogEditorState.draft.groupId="fixtures"');
  assert.equal(h.run('equipmentCatalogEditorPayload().createOnly'), true);
  assert.equal(h.run('Object.prototype.hasOwnProperty.call(equipmentCatalogEditorPayload(),"expectedServiceRevision")'), false);
});

test('abrir editor exige una versión recién consultada y conserva la selección cuando falla la lectura', async () => {
  const h = harness();
  h.run('equipmentState.selectedServiceIds=new Set(["fixture"]); equipmentState.selectedServiceId="fixture";');
  h.responses.push({ ok: true, json: async () => ({ baseCatalogVersion: 'synthetic-schedule-v1', services: {}, groups: [], serviceRevisions: { fixture: 'fresh-revision' } }) });
  await h.run('openEquipmentCatalogEditor()');
  assert.equal(h.run('equipmentCatalogEditorState.draft.expectedServiceRevision'), 'fresh-revision');
  h.run('closeEquipmentCatalogEditor()');
  h.responses.push({ ok: false, status: 401, json: async () => ({ error: 'Sesión vencida' }) });
  await h.run('openEquipmentCatalogEditor()');
  assert.equal(h.run('equipmentCatalogEditorState.open'), false);
  assert.equal(h.run('equipmentCatalogEditorState.draft'), null);
  assert.match(h.get('equipmentSaveStatus').textContent, /versión actual del servicio/);
});
