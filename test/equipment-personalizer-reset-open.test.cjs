const test = require('node:test');
const assert = require('node:assert/strict');
const personalizer = require('../equipment-event-personalizer.js');

// Synthetic UI only. No inventory, server, reservation or service is modified.
function harness(options = {}) {
  const elements = new Map();
  class Element {
    constructor(id = '') { this.id = id; this.dataset = {}; this.listeners = {}; this.value = ''; this.open = false; this.disabled = false; }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<(?:[\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const child = new Element(match[2]); child.type = match[1].match(/\btype="([^"]+)"/)?.[1];
        for (const attr of match[1].matchAll(/data-([a-z-]+)="([^"]*)"/g)) child.dataset[attr[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attr[2];
        elements.set(child.id, child);
      }
    }
    get innerHTML() { return this.html || ''; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    removeEventListener(name, handler) { this.listeners[name] = (this.listeners[name] || []).filter(entry => entry !== handler); }
    async emit(name, event = {}) { for (const handler of this.listeners[name] || []) await handler({ target: this, preventDefault() {}, ...event }); }
    querySelectorAll() { return [...elements.values()].filter(entry => entry !== this); }
    showModal() { this.open = true; }
    close() { this.open = false; for (const handler of this.listeners.close || []) handler({ target: this }); }
    focus() { this.focused = true; }
    remove() { elements.delete(this.id); }
  }
  const document = { body: { appendChild(element) { elements.set(element.id, element); } }, createElement() { return new Element(); }, getElementById(id) { return elements.get(id); } };
  const api = personalizer.init({ document, inventory: [], ...options }), dialog = elements.get('equipmentPersonalizerDialog');
  return { api, dialog, get: id => elements.get(id), async action(action) { await dialog.emit('click', { target: { dataset: { personalizerAction: action }, closest() { return this; } } }); } };
}

test('close while beforeOpen is pending cancels the opening and preserves the fresh empty state', async () => {
  let finish;
  const h = harness({ beforeOpen: () => new Promise(resolve => { finish = resolve; }) });
  const opening = h.api.open(); assert.equal(h.dialog.open, false);
  assert.equal(h.api.close(), true); const fresh = h.api.getDraft();
  finish(); assert.equal(await opening, false); assert.equal(h.dialog.open, false);
  assert.deepEqual(h.api.getDraft(), fresh); assert.equal(h.get('equipmentPersonalizerClipboard').value, '');
});

test('an old cancelled opening cannot unlock, replace or show a newer pending opening', async () => {
  const finishes = [];
  const h = harness({ beforeOpen: () => new Promise(resolve => finishes.push(resolve)) });
  const old = h.api.open(); h.api.close(); const current = h.api.open();
  finishes[0](); assert.equal(await old, false); assert.equal(h.dialog.open, false);
  assert.equal(await h.api.open(), false, 'the newer opening is still busy'); assert.equal(finishes.length, 2);
  finishes[1](); assert.equal(await current, true); assert.equal(h.dialog.open, true);
  assert.equal(h.api.getDraft().rows.length, 0);
});

test('an error from cancelled beforeOpen is ignored; current opening errors still reach onError', async () => {
  const rejects = [], errors = [];
  const h = harness({ beforeOpen: () => new Promise((resolve, reject) => rejects.push(reject)), onError: error => errors.push(error.message) });
  const old = h.api.open(); h.api.close(); rejects[0](new Error('cancelled synthetic request'));
  assert.equal(await old, false); assert.deepEqual(errors, []); assert.equal(h.dialog.open, false);
  const current = h.api.open(); rejects[1](new Error('current synthetic request'));
  assert.equal(await current, false); assert.deepEqual(errors, ['current synthetic request']);
});

test('destroy cancels pending beforeOpen and its completion never reopens the removed dialog', async () => {
  let finish;
  const h = harness({ beforeOpen: () => new Promise(resolve => { finish = resolve; }) });
  const opening = h.api.open(); assert.equal(h.api.destroy(), true); finish();
  assert.equal(await opening, false); assert.equal(h.dialog.open, false); assert.equal(await h.api.open(), false);
});

test('close still refuses a draft that is being applied and succeeds after the callback finishes', async () => {
  let finish;
  const h = harness({ onDraft: () => new Promise(resolve => { finish = resolve; }) });
  await h.api.open(); h.get('equipmentPersonalizerClipboard').value = '0\tEquipo sintético'; await h.action('parse');
  const applying = h.action('draft'); assert.equal(typeof finish, 'function');
  assert.equal(h.api.close(), false); assert.equal(h.dialog.open, true); assert.equal(h.api.getDraft().rows.length, 1);
  finish({ count: 1 }); await applying;
  assert.equal(h.api.close(), true); assert.equal(h.dialog.open, false); assert.equal(h.api.getDraft().rows.length, 0);
});
