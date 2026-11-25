const test = require('node:test');
const assert = require('node:assert/strict');
const batch = require('../equipment-batch-events.js');

// This client-only harness uses synthetic events and never writes to a server.
function harness(options = {}) {
  const ids = new Map(), elements = [];
  class Element {
    constructor(id = '') { this.id = id; this.dataset = {}; this.listeners = {}; this.value = ''; this.open = false; elements.push(this); }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
        const attrs = match[2], id = attrs.match(/\bid="([^"]+)"/)?.[1] || '', dataset = {};
        for (const attr of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) dataset[attr[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attr[2];
        if (!id && !Object.keys(dataset).length) continue;
        const child = new Element(id); child.dataset = dataset;
        if (id) ids.set(id, child);
      }
    }
    get innerHTML() { return this.html || ''; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    removeEventListener(name, callback) { this.listeners[name] = (this.listeners[name] || []).filter(entry => entry !== callback); }
    querySelectorAll(selector) {
      const key = selector.match(/\[data-([a-z-]+)\]/)?.[1]?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return key ? elements.filter(entry => entry.dataset[key] !== undefined) : [];
    }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { this.focused = true; }
    remove() { ids.delete(this.id); }
    click() { this.clicked = true; }
    async emit(name, event = {}) { for (const handler of this.listeners[name] || []) await handler({ target: this, preventDefault() {}, ...event }); }
  }
  const opener = new Element('equipmentBatchImportButton'); ids.set(opener.id, opener);
  const document = { body: { appendChild(element) { ids.set(element.id, element); } }, createElement() { return new Element(); }, getElementById(id) { return ids.get(id); } };
  const api = batch.init({ document, confirmWarnings: () => true, retryDelayMs: 0, ...options }), dialog = ids.get('equipmentBatchDialog');
  return { api, dialog, get: id => ids.get(id), async action(action) { await dialog.emit('click', { target: { dataset: { batchAction: action }, closest() { return this; } } }); } };
}
function preview(overrides = {}) {
  const event = { id: 'clear-synthetic', date: '2026-11-25', place: 'Sede sintética', client: 'Cliente sintético', sourceSheet: 'Sintética', itemCount: 1, zeroCount: 1,
    setupApplies: false, startAt: '2026-11-25T12:00', endAt: '2026-11-25T13:00', equipmentInAt: '2026-11-25T15:00',
    sourceCells: [{ ref: 'synthetic-A1', address: 'A1', value: 0 }], sections: [{ title: 'Prueba', items: [{ quantity: 0, description: 'Equipo sintético' }], rows: [{ type: 'item', quantity: 0, description: 'Equipo sintético' }] }], ...overrides };
  return { source: { fileName: 'reinicio-sintético.xlsx' }, events: [event], sheets: [{ name: 'Sintética', sourceCellCount: 1, eventIds: [event.id] }], verification: { complete: true, sourceCellCount: 1, representedCellCount: 1 } };
}
const file = () => ({ name: 'reinicio-sintético.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 10, arrayBuffer: async () => new ArrayBuffer(10) });
const response = data => ({ ok: true, json: async () => structuredClone(data) });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('clear forgets a successful import and reopens a fresh picker; the same file imports again exactly once', async () => {
  let reads = 0, imports = 0;
  const h = harness({ fetch: async () => { reads++; return response(preview()); }, bridge: { importEvents(events) { return { count: events.length, run: ++imports }; } } });
  await h.api.openFile(file()); await h.action('apply');
  assert.equal(h.api.getImported().result.run, 1);
  h.api.close(); h.api.open(); assert.equal(h.get('equipmentBatchTitle').textContent, 'Eventos cargados');
  h.get('equipmentBatchFile').value = 'previous-file.xlsx';
  assert.equal(h.api.clear(), true); assert.equal(h.dialog.open, false);
  assert.equal(h.api.getImported(), null); assert.equal(h.api.getPreview(), null); assert.equal(h.api.isBusy(), false);
  assert.equal(h.get('equipmentBatchFile').value, ''); assert.equal(h.get('equipmentBatchContent').innerHTML, '');
  h.api.open(); assert.equal(h.get('equipmentBatchTitle').textContent, 'Importar varios eventos');
  assert.equal(h.get('equipmentBatchInstructions').hidden, false); assert.equal(h.get('equipmentBatchChoose').hidden, false);
  assert.equal(h.get('equipmentBatchTransfer').hidden, true); assert.equal(h.get('equipmentBatchApply').disabled, true);
  await h.api.openFile(file()); await h.action('apply'); await h.action('apply');
  assert.equal(reads, 2); assert.equal(imports, 2); assert.equal(h.api.getImported().result.run, 2);
});

test('clear aborts an active upload and a late old response cannot replace the newly read file', async () => {
  const pending = [];
  const h = harness({ fetch: (url, options) => new Promise(resolve => pending.push({ resolve, signal: options.signal })) });
  const oldRead = h.api.openFile(file()); await tick();
  assert.equal(h.api.isBusy(), false, 'read-only preview may be cancelled by reset');
  assert.equal(h.api.clear(), true); assert.equal(pending[0].signal.aborted, true);
  const currentRead = h.api.openFile(file()); await tick();
  pending[1].resolve(response(preview({ id: 'new-synthetic', place: 'Sede nueva sintética' }))); await currentRead;
  pending[0].resolve(response(preview())); assert.equal(await oldRead, null);
  assert.equal(h.api.getPreview().events[0].place, 'Sede nueva sintética');
  assert.equal(h.api.getImported(), null); assert.equal(h.dialog.open, true);
});

test('clear before arrayBuffer finishes prevents the cancelled file from even reaching the reader endpoint', async () => {
  let release, requests = 0;
  const h = harness({ fetch: async () => { requests++; return response(preview()); } });
  const oldRead = h.api.openFile({ ...file(), arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
  assert.equal(h.api.clear(), true); release(new ArrayBuffer(10));
  assert.equal(await oldRead, null); assert.equal(requests, 0); assert.equal(h.api.getPreview(), null); assert.equal(h.dialog.open, false);
});

test('clear invalidates pending warning approval without importing or restoring the old preview', async () => {
  let approve, imports = 0;
  const h = harness({ fetch: async () => response(preview({ issues: [{ code: 'conflicting_schedule', message: 'Hora sintética pendiente' }] })),
    confirmWarnings: () => new Promise(resolve => { approve = resolve; }), bridge: { importEvents() { imports++; return { count: 1 }; } } });
  await h.api.openFile(file()); const applying = h.action('apply');
  assert.equal(typeof approve, 'function'); assert.equal(h.api.clear(), true);
  h.api.open(); approve(true); await applying;
  assert.equal(imports, 0); assert.equal(h.api.getPreview(), null); assert.equal(h.api.getImported(), null);
  assert.equal(h.get('equipmentBatchContent').innerHTML, ''); assert.equal(h.get('equipmentBatchApply').disabled, true);
});

test('clear refuses actual import, post-import callback and report work until each completes', async () => {
  let finishImport, finishNotice, finishReport;
  const h = harness({ fetch: async () => response(preview()), bridge: {
    importEvents: () => new Promise(resolve => { finishImport = resolve; }), afterImport: () => new Promise(resolve => { finishReport = resolve; })
  }, onImported: () => new Promise(resolve => { finishNotice = resolve; }) });
  await h.api.openFile(file()); const applying = h.action('apply');
  assert.equal(h.api.isBusy(), true); assert.equal(h.api.clear(), false); assert.ok(h.api.getPreview());
  finishImport({ count: 1 }); await tick();
  assert.equal(h.api.isBusy(), true); assert.equal(h.api.clear(), false); assert.ok(h.api.getImported());
  finishNotice(); await applying;
  const reporting = h.action('apply-transfer'); assert.equal(h.api.isBusy(), true); assert.equal(h.api.clear(), false);
  finishReport({ reportClosed: true }); await reporting;
  assert.equal(h.api.isBusy(), false); assert.equal(h.api.clear(), true);
  assert.equal(h.dialog.open, false); assert.equal(h.api.getImported(), null); assert.equal(h.api.getPreview(), null);
});

test('clear and destroy are safe after destruction and late reads remain discarded', async () => {
  let deliver;
  const h = harness({ fetch: () => new Promise(resolve => { deliver = resolve; }) });
  const reading = h.api.openFile(file()); await tick(); assert.equal(h.api.destroy(), true);
  assert.equal(h.api.clear(), false); assert.equal(h.api.destroy(), true); assert.equal(h.api.open(), false); assert.equal(h.api.isBusy(), false);
  deliver(response(preview())); assert.equal(await reading, null); assert.equal(h.api.getImported(), null); assert.equal(h.api.getPreview(), null);
});
