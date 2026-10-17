const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const sourceRoot = process.env.READERS_TEST_ROOT || path.join(__dirname, '..');
const review = require(path.join(sourceRoot, 'warehouse-import-review.js'));

function fixture(options = {}) {
  const calls = [];
  let cacheReads = 0;
  const element = () => ({ textContent: '', innerHTML: '', value: '', dataset: {}, disabled: false,
    querySelector() { return null; } });
  const elements = { status: element(), importInput: element(), importSummary: element(), importBody: element(),
    importError: element(), importApplyButton: element(), importCancelButton: element(), importCloseButton: element(),
    importDialog: { open: false, showModal() { this.open = true; }, close() { this.open = false; } } };
  const stale = { version: 4, items: [{ id: 'old-local', name: 'Equipo local antiguo', category: 'Pruebas', quantity: 99 }],
    movements: [], subtitles: [], rentalDraft: [], workshopDraft: [], auditEntries: [], equipmentStockReceipts: [] };
  const sandbox = { console, window: { location: { protocol: 'https:' }, WarehouseImportReview: review,
      LIVE_WAREHOUSE_INITIAL_INVENTORY: [{ name: 'Semilla antigua', quantity: 50 }],
      localStorage: { getItem() { cacheReads += 1; return JSON.stringify(stale); }, setItem() {} },
      clearTimeout() {}, setTimeout() {} },
    document: { readyState: 'loading', addEventListener() {}, dispatchEvent() { throw Error('No publicar stock sin revisión'); } },
    async fetch(url, request = {}) {
      calls.push({ url, request });
      if (options.respond) return options.respond(url, request);
      return { ok: false, status: 503, async json() { return { error: 'Conexión interrumpida' }; } };
    } };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(sourceRoot, 'inventory.js'), 'utf8');
  const instrumented = source.replace('  if (document.readyState === "loading") {', `
    window.readerSafety = { loadState, persistServerState, publishWarehouseAvailability, importBackup, applyImportReview,
      setup(next, revision = '') { state = next; serverSavedAt = revision; Object.assign(elements, window.testElements); },
      state() { return state; }, review() { return importReview; }, revision() { return serverSavedAt; } };
  if (document.readyState === "loading") {`);
  sandbox.window.testElements = elements;
  vm.runInContext(instrumented, sandbox, { filename: 'inventory.js' });
  const api = sandbox.window.readerSafety;
  api.setup(stale);
  return { api, calls, elements, stale, cacheReads: () => cacheReads };
}

test('un fallo inicial de GET nunca escribe ni reactiva stock de caché o semilla', async () => {
  const f = fixture();
  assert.equal(await f.api.loadState(), false);
  assert.deepEqual(f.calls.map(x => x.request.method || 'GET'), ['GET']);
  assert.equal(f.cacheReads(), 0);
  assert.equal(f.api.state().items.length, 0);
  assert.equal(f.api.revision(), '');
  assert.match(f.elements.status.textContent, /inventario actual/i);
  assert.doesNotThrow(() => f.api.publishWarehouseAvailability());
});

test('no se envía PUT con un estado local cuya revisión remota nunca se leyó', async () => {
  const f = fixture();
  await assert.rejects(f.api.persistServerState(), error => error.status === 428);
  assert.equal(f.calls.length, 0);
});

test('un GET sin revisión estable no habilita edición ni carga una copia antigua', async () => {
  const f = fixture({ respond: async () => ({ ok: true, async json() {
    return { state: { items: [{ id: 'actual', name: 'Unidad actual', quantity: 0 }] } };
  } }) });
  assert.equal(await f.api.loadState(), false);
  assert.equal(f.api.revision(), '');
  assert.equal(f.api.state().items.length, 0);
  assert.equal(f.cacheReads(), 0);
});

test('una fuente incompleta no habilita guardar y permite elegir otra hoja', async () => {
  const f = fixture({ respond: async () => ({ ok: true, async json() {
    return { source: 'prueba.xlsx', items: [{ name: 'Unidad A', category: 'Pruebas', quantity: 0 }],
      worksheets: ['Completa', 'Incompleta'], blockers: ['Hoja Incompleta: fila 4 sin cantidad.'],
      verification: { complete: false } };
  } }) });
  await f.api.importBackup({ name: 'prueba.xlsx', size: 200, type: 'application/octet-stream' });
  assert.equal(f.api.review().plan, null);
  assert.equal(f.elements.importApplyButton.disabled, true);
  assert.match(f.elements.importError.textContent, /fila 4/);
  assert.match(f.elements.importBody.innerHTML, /Completa/);
  await f.api.applyImportReview();
  assert.deepEqual(f.calls.map(x => x.request.method), ['POST']);
});

test('resolver una vista previa sin revisión remota nunca guarda el inventario', async () => {
  const f = fixture({ respond: async () => ({ ok: true, async json() {
    return { source: 'prueba.pdf', items: [{ name: 'Equipo totalmente nuevo', category: 'Nuevo', quantity: 0 }], warnings: [] };
  } }) });
  await f.api.importBackup({ name: 'prueba.pdf', size: 200, type: 'application/pdf' });
  await f.api.applyImportReview();
  assert.deepEqual(f.calls.map(x => x.request.method), ['POST']);
  assert.match(f.elements.importError.textContent, /inventario actual/);
});

test('modelos con guion, barra y medidas decimales conservan identidades separadas', () => {
  const current = { items: [], movements: [], subtitles: [] };
  const imported = { items: [
    { name: 'Modelo X-1', category: 'Pruebas', quantity: 0 },
    { name: 'Modelo X/1', category: 'Pruebas', quantity: 2 },
    { name: 'Tramo 0.30 m', category: 'Pruebas', quantity: 3 },
    { name: 'Tramo 0 30 m', category: 'Pruebas', quantity: 4 }
  ] };
  const plan = review.prepare(current, imported);
  assert.deepEqual(plan.rows.map(x => x.status), ['new', 'new', 'new', 'new']);
  const result = review.finalize(plan, { now: '2026-10-17T19:00:00.000Z' });
  assert.equal(new Set(result.items.map(x => x.sourceKey)).size, 4);
  assert.deepEqual(result.items.map(x => x.quantity), [0, 2, 3, 4]);
  assert.deepEqual(review.difference('Modelo X-1', 'Modelo X/1'), { removed: ['x-1'], added: ['x/1'] });
});
