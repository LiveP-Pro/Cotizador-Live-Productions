const assert = require('node:assert/strict');
const test = require('node:test');
const { setImmediate: turn } = require('node:timers/promises');
const { webcrypto } = require('node:crypto');
const workspace = require('../equipment-workspace.js');

const event = (id = 'synthetic-event-a', updatedAt = '2026-10-20T12:00:00.001Z') => ({ id, updatedAt, name: 'Evento sintético', setupAt: '2026-10-20T09:00', startAt: '2026-10-20T11:00', endAt: '2026-10-20T17:00', equipmentInAt: '2026-10-20T21:00', sections: [{ title: 'Audio', items: [{ quantity: 0, description: 'Consola de prueba' }] }] });
const transfer = () => ({ fromEventId: 'synthetic-event-a', toEventId: 'synthetic-event-b', warehouseInventoryId: 'synthetic-console', quantity: 2, travelMinutes: 60, handlingMinutes: 120 });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function response(body, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(JSON.stringify(body)) }; }
function harness(handler) {
  const calls = [], states = [];
  const api = workspace.create({ date: '2026-10-20', crypto: webcrypto, onState: state => states.push(state), fetch: async (url, init) => {
    const call = { url, init, body: init.body ? JSON.parse(init.body) : undefined };
    calls.push(call);
    return handler(call, calls.length);
  } });
  return { api, calls, states };
}
function readResponse(call, revision = 0, events = [event()], transfers = []) {
  if (call.url === '/api/cuadros-equipo/eventos') return response({ revision, events, transfers });
  if (call.url === '/api/cuadros-equipo/trasiegos') return response({ revision, transfers });
  const query = new URL(call.url, 'https://example.test').searchParams;
  return response({ revision, rows: [{ synthetic: true }], from: query.get('from'), to: query.get('to') });
}

test('la semana local de Guatemala cruza meses y años sin convertir a UTC', () => {
  assert.deepEqual(workspace.weekFor('2026-10-20'), { from: '2026-10-19', to: '2026-10-25' });
  assert.deepEqual(workspace.weekFor('2027-01-01'), { from: '2026-12-28', to: '2027-01-03' });
  assert.deepEqual(workspace.weekFor('2026-10-25'), { from: '2026-10-19', to: '2026-10-25' });
  assert.equal(workspace.validDate('2026-02-30'), false);
  assert.equal(workspace.validDate('2028-02-29'), true);
  assert.throws(() => workspace.weekFor('2026-13-01'), /fecha válida/);
});

test('el rango rechaza fechas imposibles y filtra por montaje-regreso incluyendo extremos', () => {
  const { api } = harness(call => readResponse(call));
  assert.throws(() => api.setRange({ from: '2026-02-30', to: '2026-03-02' }), /rango/);
  assert.throws(() => api.setRange({ from: '2026-10-21', to: '2026-10-20' }), /rango/);
  assert.equal(workspace.intersects({ setupAt: '2026-10-18T09:00', equipmentInAt: '2026-10-19T01:00' }, api.getState().range), true);
  assert.equal(workspace.intersects({ setupAt: '2026-10-26T09:00', equipmentInAt: '2026-10-26T21:00' }, api.getState().range), false);
  assert.equal(workspace.intersects({ date: '2026-10-25' }, api.getState().range), true);
});

test('refresh conserva revision 0, trasiegos y snapshots independientes con credenciales del mismo origen', async () => {
  const route = { id: 'synthetic-route', status: 'confirmed' };
  const h = harness(call => readResponse(call, 0, [event(), { ...event('cancelled'), status: 'cancelled' }], [route, { id: 'retired', status: 'cancelled' }]));
  const result = await h.api.refresh();
  assert.equal(result.revision, 0);
  assert.equal(result.loaded, true);
  assert.equal(result.stale, false);
  assert.equal(result.refreshing, false);
  assert.equal(h.api.getState().refreshing, false);
  assert.deepEqual(result.transfers, [route]);
  assert.equal(result.events.length, 1);
  result.events[0].name = 'Cambiar fuera del estado';
  assert.equal(h.api.getState().events[0].name, 'Evento sintético');
  assert.ok(h.calls.every(call => call.init.credentials === 'same-origin' && call.init.cache === 'no-store'));
});

test('cambiar rango durante refresh espera el nuevo rango y nunca publica el cálculo anterior', async () => {
  const gate = deferred();
  const h = harness(async (call, count) => { if (count <= 2) await gate.promise; return readResponse(call, 3); });
  const first = h.api.refresh();
  h.api.setRange({ from: '2026-10-26', to: '2026-11-01' });
  const second = h.api.refresh();
  assert.equal(first, second);
  gate.resolve();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.plan.from, '2026-10-26'); assert.equal(b.plan.to, '2026-11-01');
  assert.equal(h.calls.length, 4);
  assert.ok(h.states.filter(state => state.plan).every(state => state.plan.from === state.range.from && state.plan.to === state.range.to));
});

test('una consulta antigua fallida no bloquea la consulta del rango nuevo', async () => {
  const gate = deferred();
  const h = harness(async (call, count) => { if (count <= 2) { await gate.promise; throw new Error('Consulta de rango anterior interrumpida'); } return readResponse(call, 2); });
  const pending = h.api.refresh();
  h.api.setRange({ from: '2026-11-02', to: '2026-11-08' }); gate.resolve();
  const state = await pending;
  assert.equal(state.plan.from, '2026-11-02'); assert.equal(state.lastError, null);
});

test('una mutación durante un GET descarta la respuesta anterior y refresh espera la escritura', async () => {
  const readGate = deferred(), writeGate = deferred();
  let readCount = 0;
  const saved = { ...event(), name: 'Versión actual', updatedAt: '2026-10-20T12:00:00.002Z' };
  const h = harness(async call => {
    if (call.init.method === 'PUT') { await writeGate.promise; return response({ event: saved, events: [saved], transfers: [], revision: 2 }); }
    const old = ++readCount <= 2;
    if (old) await readGate.promise;
    return readResponse(call, old ? 1 : 2, old ? [event()] : [saved]);
  });
  const refreshing = h.api.refresh();
  const saving = h.api.save(saved);
  await turn(); readGate.resolve(); await turn();
  assert.equal(h.api.getState().plan, null);
  assert.equal(readCount, 2);
  writeGate.resolve(); await saving;
  const state = await refreshing;
  assert.equal(state.revision, 2); assert.equal(state.events[0].name, 'Versión actual'); assert.equal(readCount, 4);
  assert.ok(h.states.filter(state => state.plan).every(state => state.revision === 2));
});

test('refresh pedido durante guardado espera hasta tener cálculo posterior al guardado', async () => {
  const gate = deferred();
  const h = harness(async call => {
    if (call.init.method === 'PUT') { await gate.promise; return response({ event: event(), events: [event()], transfers: [], revision: 4 }); }
    return readResponse(call, 4);
  });
  const saving = h.api.save(event()); const refreshing = h.api.refresh();
  await turn(); assert.equal(h.calls.length, 1);
  gate.resolve(); await saving;
  const state = await refreshing;
  assert.equal(state.revision, 4); assert.equal(state.plan.revision, 4); assert.equal(h.calls.length, 3);
});

test('reintenta agenda/plan con distinta revisión y acepta sólo un par coherente', async () => {
  let round = 0;
  const h = harness(call => {
    if (call.url === '/api/cuadros-equipo/eventos') { round += 1; return response({ events: [event()], transfers: [], revision: round === 1 ? 0 : 2 }); }
    const result = readResponse(call, round === 1 ? 1 : 2); return result;
  });
  const state = await h.api.refresh();
  assert.equal(state.revision, 2); assert.equal(h.calls.length, 4);
  assert.ok(h.states.filter(value => value.plan).every(value => value.plan.revision === value.revision));
});

test('si la revisión sigue cambiando no publica disponibilidad obsoleta', async () => {
  const h = harness(call => call.url === '/api/cuadros-equipo/eventos' ? response({ events: [event()], transfers: [], revision: 0 }) : readResponse(call, 1));
  await assert.rejects(h.api.refresh(), error => error.status === 409 && error.code === 'STALE_PLAN');
  assert.equal(h.calls.length, 6); assert.equal(h.api.getState().plan, null); assert.equal(h.api.getState().stale, true);
  assert.equal(h.api.getState().refreshing, false);
});

test('no acepta cálculo que corresponde a otro rango ni respuestas incompletas', async () => {
  const h = harness(call => call.url === '/api/cuadros-equipo/eventos' ? response({ events: [], transfers: [], revision: 0 }) : response({ rows: [], revision: 0, from: '2020-01-01', to: '2020-01-07' }));
  await assert.rejects(h.api.refresh(), error => error.code === 'INVALID_RANGE');
  const incomplete = harness(() => response({ revision: 0 }));
  await assert.rejects(incomplete.api.refresh(), error => error.code === 'INVALID_RESPONSE');
  assert.equal(incomplete.api.getState().loaded, false);
});

test('doubleclick de guardar comparte envío; una modificación diferente pendiente se rechaza', async () => {
  const gate = deferred();
  const h = harness(async call => { await gate.promise; const e = call.body.event; return response({ event: e, events: [e], transfers: [], revision: 1 }); });
  const original = event();
  const first = h.api.save(original), second = h.api.save(JSON.parse(JSON.stringify(original)));
  assert.equal(first, second);
  await assert.rejects(h.api.save({ ...original, name: 'Otro cambio' }), error => error.code === 'PENDING_CHANGE');
  await turn(); assert.equal(h.calls.length, 1);
  original.sections[0].items[0].quantity = 99;
  gate.resolve(); await first;
  assert.equal(h.calls[0].body.event.sections[0].items[0].quantity, 0);
  assert.equal(h.api.getState().pending, 0);
});

test('escrituras de eventos diferentes se serializan y una respuesta anterior no borra la siguiente', async () => {
  const firstGate = deferred();
  const a = event('a'), b = event('b');
  const h = harness(async call => {
    if (call.body.event.id === 'a') { await firstGate.promise; return response({ event: a, events: [a], transfers: [], revision: 1 }); }
    return response({ event: b, events: [a, b], transfers: [], revision: 2 });
  });
  const p1 = h.api.save(a), p2 = h.api.save(b);
  await turn(); assert.equal(h.calls.length, 1); assert.equal(h.api.getState().pending, 2);
  firstGate.resolve(); await Promise.all([p1, p2]);
  assert.deepEqual(h.api.getState().events.map(e => e.id), ['a', 'b']); assert.equal(h.api.getState().revision, 2);
});

test('conflicto optimista conserva el cuadro y no sustituye expectedUpdatedAt por una versión más reciente', async () => {
  const h = harness(call => call.init.method === 'PUT' ? response({ error: 'Cambió en otra pestaña' }, 409) : readResponse(call, 7, [{ ...event(), updatedAt: 'newer' }]));
  await h.api.refresh();
  const original = event();
  await assert.rejects(h.api.save(original), error => error.status === 409 && /otra pestaña/.test(error.message));
  assert.equal(h.calls.at(-1).body.expectedUpdatedAt, original.updatedAt);
  assert.equal(h.api.getState().events[0].updatedAt, 'newer');
  assert.equal(h.api.getState().plan, null); assert.equal(h.api.getState().lastError.status, 409);
  assert.equal(original.updatedAt, '2026-10-20T12:00:00.001Z');
});

test('401 incluso con HTML exige sesión y una respuesta 200 ilegible no vacía la agenda', async () => {
  let mode = 'normal';
  const h = harness(call => {
    if (mode === '401') return { ok: false, status: 401, json: async () => { throw new Error('HTML'); } };
    if (mode === 'bad') return { ok: true, status: 200, json: async () => { throw new Error('JSON incompleto'); } };
    return readResponse(call, 5);
  });
  await h.api.refresh(); mode = '401';
  await assert.rejects(h.api.refresh(), error => error.status === 401 && /Inicie sesión/.test(error.message));
  assert.equal(h.api.getState().loaded, false); assert.equal(h.api.getState().plan, null); assert.equal(h.api.getState().events.length, 1);
  mode = 'normal'; await h.api.refresh(); mode = 'bad';
  await assert.rejects(h.api.refresh(), error => error.code === 'INVALID_RESPONSE');
  assert.equal(h.api.getState().events.length, 1); assert.equal(h.api.getState().plan, null);
});

test('red fallida deja un estado explícitamente pendiente y permite volver a consultar', async () => {
  let failed = false;
  const h = harness(call => { if (failed) throw new Error('Sin red'); return readResponse(call, 5); });
  await h.api.refresh(); failed = true;
  await assert.rejects(h.api.refresh(), error => error.status === 0 && error.code === 'NETWORK');
  assert.equal(h.api.getState().stale, true); assert.equal(h.api.getState().events.length, 1);
  failed = false; await h.api.refresh(); assert.equal(h.api.getState().lastError, null); assert.equal(h.api.getState().stale, false);
});

test('cancelar es idempotente y una respuesta con eventos cancelados libera la lista y rutas', async () => {
  const gate = deferred();
  const h = harness(async call => {
    if (call.init.method === 'DELETE') { await gate.promise; return response({ event: { ...event(), status: 'cancelled' }, events: [{ ...event(), status: 'cancelled' }], transfers: [{ id: 'route', status: 'cancelled' }], revision: 2 }); }
    return readResponse(call, 1);
  });
  await h.api.refresh();
  const p1 = h.api.cancel(event()), p2 = h.api.cancel(event()); assert.equal(p1, p2);
  assert.equal(h.api.getState().plan, null);
  gate.resolve(); await p1; await h.api.cancel(event());
  assert.deepEqual(h.api.visibleEvents(), []); assert.deepEqual(h.api.transfers(), []);
  assert.equal(h.calls.filter(call => call.init.method === 'DELETE').length, 2);
  assert.equal(h.calls.at(-1).body.expectedUpdatedAt, event().updatedAt);
});

test('nuevo evento sin updatedAt no inventa una versión y respuesta incompleta permite reintentar', async () => {
  let calls = 0;
  const h = harness(call => {
    if (++calls === 1) return response({ revision: 1 });
    return response({ event: call.body.event, events: [call.body.event], transfers: [], revision: 1 });
  });
  const e = event(); delete e.updatedAt;
  await assert.rejects(h.api.save(e), error => error.code === 'INVALID_RESPONSE');
  assert.equal(h.api.getState().events.length, 0);
  await h.api.save(e);
  assert.equal('expectedUpdatedAt' in h.calls[0].body, false);
  assert.deepEqual(h.calls[0].body, h.calls[1].body); assert.equal(h.api.getState().events[0].id, e.id);
});

test('confirmar trasiego usa ID determinista en equipos distintos y conserva el contrato del servidor', async () => {
  const make = () => harness(call => {
    const id = decodeURIComponent(call.url.split('/').at(-1));
    const saved = { id, ...call.body.transfer, updatedAt: 'route-version', status: 'confirmed' };
    return response({ transfer: saved, transfers: [saved], revision: 4 });
  });
  const one = make(), two = make();
  const a = await one.api.confirmTransfer(transfer()), b = await two.api.confirmTransfer(transfer());
  assert.match(a.id, /^trasiego-[0-9a-f]{64}$/); assert.equal(a.id, b.id);
  assert.deepEqual(one.calls[0].body.transfer.items, [{ warehouseInventoryId: 'synthetic-console', quantity: 2 }]);
  assert.equal('expectedUpdatedAt' in one.calls[0].body, false);
  assert.deepEqual(one.api.transfers(), [a]); assert.equal(one.api.getState().plan, null);
});

test('reintento de trasiego después de perder respuesta usa exactamente la misma ruta sin duplicarla', async () => {
  let count = 0;
  const h = harness(call => {
    if (++count === 1) throw new Error('Respuesta perdida después de guardar');
    const saved = { id: call.url.split('/').at(-1), ...call.body.transfer, updatedAt: 'v1' };
    return response({ transfer: saved, transfers: [saved], revision: 1 });
  });
  await assert.rejects(h.api.confirmTransfer(transfer()), error => error.code === 'NETWORK');
  await h.api.confirmTransfer(transfer());
  assert.equal(h.calls[0].url, h.calls[1].url); assert.deepEqual(h.calls[0].body, h.calls[1].body);
  assert.equal(h.api.transfers().length, 1);
});

test('doubleclick de trasiego y edición conservan expectedUpdatedAt y cantidades sin ambigüedad', async () => {
  const gate = deferred();
  const h = harness(async call => {
    await gate.promise;
    const saved = { id: call.url.split('/').at(-1), ...call.body.transfer, updatedAt: 'v2' };
    return response({ transfer: saved, transfers: [saved], revision: 2 });
  });
  const candidate = { ...transfer(), id: 'known-route', updatedAt: 'v1' };
  const p1 = h.api.confirmTransfer(candidate), p2 = h.api.confirmTransfer(candidate);
  await turn(); assert.equal(h.calls.length, 1);
  await assert.rejects(h.api.confirmTransfer({ ...candidate, quantity: 3 }), error => error.code === 'PENDING_CHANGE');
  gate.resolve(); await Promise.all([p1, p2]);
  assert.equal(h.calls[0].body.expectedUpdatedAt, 'v1'); assert.equal(h.api.transfers()[0].updatedAt, 'v2');
});

test('cancelar ruta confirmada envía su versión y actualiza el registro privado recibido', async () => {
  const h = harness(call => response({ transfer: { id: 'route-a', status: 'cancelled' }, transfers: [], revision: 2 }));
  await h.api.cancelTransfer({ id: 'route-a', updatedAt: 'route-v1' });
  assert.equal(h.calls[0].init.method, 'DELETE'); assert.deepEqual(h.calls[0].body, { expectedUpdatedAt: 'route-v1' });
  assert.deepEqual(h.api.getState().transfers, []); assert.equal(h.api.getState().revision, 2);
});

test('GET de rutas con revisión diferente refresca agenda y disponibilidad antes de publicarlo', async () => {
  let revision = 1;
  const route = { id: 'route-current', status: 'confirmed' };
  const h = harness(call => readResponse(call, revision, [event()], revision === 1 ? [] : [route]));
  await h.api.refresh(); revision = 2;
  assert.deepEqual(await h.api.refreshTransfers(), [route]);
  assert.equal(h.api.getState().revision, 2); assert.equal(h.api.getState().plan.revision, 2);
  assert.equal(h.calls.filter(call => call.url === '/api/cuadros-equipo/trasiegos').length, 1);
});

test('trasiego rechaza cero, inventarios duplicados, mismo evento y tiempos inválidos antes de escribir', async () => {
  const h = harness(() => { throw new Error('No debe solicitar al servidor'); });
  for (const candidate of [{ ...transfer(), quantity: 0 }, { ...transfer(), travelMinutes: -1 }, { ...transfer(), toEventId: 'synthetic-event-a' },
    { ...transfer(), items: [{ warehouseInventoryId: 'x', quantity: 1 }, { warehouseInventoryId: 'x', quantity: 2 }] }]) {
    await assert.rejects(h.api.confirmTransfer(candidate), error => error.code === 'INVALID_TRANSFER');
  }
  assert.equal(h.calls.length, 0);
  await assert.rejects(h.api.save({}), error => error.code === 'INVALID_EVENT');
  await assert.rejects(h.api.cancel({}), error => error.code === 'INVALID_EVENT');
});

test('una escritura fallida no bloquea refresh pendiente ni las escrituras siguientes', async () => {
  const gate = deferred();
  let puts = 0;
  const h = harness(async call => {
    if (call.init.method === 'PUT') {
      if (++puts === 1) { await gate.promise; return response({ error: 'Conflicto sintético' }, 409); }
      return response({ event: call.body.event, events: [call.body.event], transfers: [], revision: 3 });
    }
    return readResponse(call, puts > 1 ? 3 : 2);
  });
  const saving = h.api.save(event()), refreshing = h.api.refresh();
  const rejection = assert.rejects(saving, error => error.status === 409);
  gate.resolve(); await rejection;
  const state = await refreshing;
  assert.equal(state.revision, 2); assert.equal(h.api.getState().pending, 0);
  await h.api.save(event()); assert.equal(h.api.getState().revision, 3);
});

test('una versión vieja de ruta se rechaza sin sustituir los trasiegos del estado', async () => {
  const existing = { id: 'route-a', updatedAt: 'newer-route', status: 'confirmed' };
  const h = harness(call => call.init.method === 'PUT' ? response({ error: 'El trasiego cambió' }, 409) : readResponse(call, 8, [event()], [existing]));
  await h.api.refresh();
  await assert.rejects(h.api.confirmTransfer({ ...transfer(), id: 'route-a', updatedAt: 'old-route' }), error => error.status === 409);
  assert.deepEqual(h.api.transfers(), [existing]);
  assert.equal(h.calls.at(-1).body.expectedUpdatedAt, 'old-route'); assert.equal(h.api.getState().plan, null);
});

test('orden de los equipos no cambia la identidad de una ruta agrupada', async () => {
  const h = harness(call => {
    const saved = { id: call.url.split('/').at(-1), ...call.body.transfer };
    return response({ transfer: saved, transfers: [saved], revision: 1 });
  });
  const raw = transfer();
  raw.items = [{ warehouseInventoryId: 'z', quantity: 1 }, { warehouseInventoryId: 'a', quantity: 2 }];
  await h.api.confirmTransfer(raw);
  await h.api.confirmTransfer({ ...raw, items: [...raw.items].reverse() });
  assert.equal(h.calls[0].url, h.calls[1].url); assert.deepEqual(h.calls[0].body, h.calls[1].body);
});

test('integración con registro privado: guardar, detectar faltante, confirmar ruta y cancelar conservan inventario', async t => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { createEquipmentEventStore, calculateEquipmentAvailability } = require('../equipment-event-store.cjs');
  const personalizer = require('../equipment-event-personalizer.js');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'equipment-workspace-integration-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.parse('2026-01-01T00:00:00Z');
  const store = createEquipmentEventStore({ directory, now: () => now });
  const inventory = { savedAt: 'synthetic-stock-v1', state: { items: [{ id: 'synthetic-console', name: 'Consola sintética', category: 'Audio', itemType: 'equipo', quantity: 3 }], movements: [] } };
  const initialStock = JSON.stringify(inventory);
  const api = workspace.create({ date: '2026-10-20', crypto: webcrypto, fetch: async (url, init) => {
    const payload = init.body ? JSON.parse(init.body) : {};
    try {
      if (url === '/api/cuadros-equipo/eventos') return response(store.readEvents());
      if (url === '/api/cuadros-equipo/trasiegos') return response(store.readTransfers());
      if (url.startsWith('/api/cuadros-equipo/disponibilidad?')) {
        const range = new URL(url, 'https://example.test').searchParams, current = store.readEvents();
        return response({ ...calculateEquipmentAvailability(current.events, inventory, { now, from: range.get('from'), to: range.get('to'), transfers: current.transfers }), revision: current.revision });
      }
      const id = decodeURIComponent(url.split('/').at(-1));
      if (url.includes('/trasiegos/')) return response(init.method === 'DELETE' ? store.cancelTransfer(id, payload) : store.putTransfer(id, payload, 'Prueba', inventory));
      return response(init.method === 'DELETE' ? store.cancelEvent(id, payload) : store.putEvent(id, payload, 'Prueba', inventory));
    } catch (error) { return response({ error: error.message }, error.statusCode || 500); }
  } });
  const pasted = personalizer.parseClipboard('Cantidad\tDescripción\nAUDIO\n3\tConsola sintética\nNota: conservar equipo');
  const make = (id, dates) => personalizer.buildEvent({ ...pasted, id, metadata: { place: 'Lugar de prueba', name: id, type: 'Sintético', setupAt: '2026-10-20T09:00', startAt: '2026-10-20T11:00', endAt: '2026-10-20T16:00', equipmentInAt: '2026-10-21T21:00', ...dates } }, [{ id: 'synthetic-console', name: 'Consola sintética', itemType: 'equipo', category: 'Audio' }]);
  const a = await api.save(make('event-a', {}));
  await api.save(make('event-b', { setupAt: '2026-10-20T19:00', startAt: '2026-10-20T20:00', endAt: '2026-10-20T23:00', equipmentInAt: '2026-10-21T22:00' }));
  let state = await api.refresh();
  assert.equal(state.plan.rows[0].required, 6); assert.equal(state.plan.rows[0].missing, 3);
  assert.equal(state.plan.rows[0].action, 'RENTA');
  const route = await api.confirmTransfer({ fromEventId: 'event-a', toEventId: 'event-b', warehouseInventoryId: 'synthetic-console', quantity: 3, travelMinutes: 60, handlingMinutes: 120 });
  state = await api.refresh();
  assert.equal(state.plan.rows[0].required, 3); assert.equal(state.plan.rows[0].missing, 0); assert.equal(state.plan.rows[0].action, 'TRASIEGO');
  assert.equal(state.transfers[0].id, route.id);
  await api.cancelTransfer(route); state = await api.refresh(); assert.equal(state.plan.rows[0].missing, 3);
  const again = await api.confirmTransfer({ fromEventId: 'event-a', toEventId: 'event-b', warehouseInventoryId: 'synthetic-console', quantity: 3, travelMinutes: 60, handlingMinutes: 120 });
  assert.notEqual(again.id, route.id);
  state = await api.refresh(); assert.equal(state.plan.rows[0].missing, 0);
  const retry = await api.confirmTransfer({ fromEventId: 'event-a', toEventId: 'event-b', warehouseInventoryId: 'synthetic-console', quantity: 3, travelMinutes: 60, handlingMinutes: 120 });
  assert.equal(retry.id, again.id); assert.equal(store.readTransfers().transfers.length, 1);
  await api.cancelTransfer(again); state = await api.refresh(); assert.equal(state.plan.rows[0].missing, 3);
  await api.cancel(a); state = await api.refresh(); assert.equal(state.plan.rows[0].missing, 0); assert.equal(state.events.length, 1);
  assert.equal(JSON.stringify(inventory), initialStock);
  assert.deepEqual(store.readEvents().events[0].source.rows.map(row => row.cells), pasted.rows.map(row => row.cells));
});

test('reconfirmación en clientes nuevos recorre generaciones canceladas y reintenta sin duplicar', async () => {
  const routes = new Map();
  let revision = 0, lostNextResponse = false;
  const calls = [];
  const create = () => workspace.create({ date: '2026-10-20', crypto: webcrypto, fetch: async (url, init) => {
    calls.push({ url, method: init.method });
    const id = url.split('/').at(-1), payload = JSON.parse(init.body), current = routes.get(id);
    if (init.method === 'DELETE') {
      if (!current) return response({ error: 'El trasiego ya no existe.' }, 404);
      const cancelled = { ...current, status: 'cancelled', updatedAt: `revision-${++revision}` };
      routes.set(id, cancelled);
      return response({ transfer: cancelled, transfers: [...routes.values()].filter(item => item.status !== 'cancelled'), revision });
    }
    if (current?.status === 'cancelled') return response({ error: 'El trasiego fue cancelado. Cree una nueva ruta.' }, 400);
    const saved = current || { id, ...payload.transfer, status: 'confirmed', updatedAt: `revision-${++revision}` };
    routes.set(id, saved);
    if (lostNextResponse) { lostNextResponse = false; throw new Error('La respuesta se perdió después de guardar'); }
    return response({ transfer: saved, transfers: [...routes.values()].filter(item => item.status !== 'cancelled'), revision });
  } });
  const first = create();
  let route = await first.confirmTransfer(transfer());
  const ids = [route.id];
  for (let generation = 0; generation < 3; generation += 1) {
    await first.cancelTransfer(route);
    const freshClient = create();
    if (generation === 2) {
      lostNextResponse = true;
      await assert.rejects(freshClient.confirmTransfer(transfer()), error => error.code === 'NETWORK');
    }
    route = await freshClient.confirmTransfer(transfer());
    const simultaneousOtherClient = create();
    const duplicate = await simultaneousOtherClient.confirmTransfer(transfer());
    assert.equal(duplicate.id, route.id);
    assert.equal([...routes.values()].filter(item => item.status === 'confirmed').length, 1);
    assert.equal(routes.size, generation + 2);
    ids.push(route.id);
  }
  assert.equal(new Set(ids).size, 4);
  assert.equal([...routes.values()].filter(item => item.status === 'cancelled').length, 3);
  assert.ok(calls.length > 10, 'clientes sin caché consultan las generaciones inmutables');
});

test('confirmaciones simultáneas después de cancelar usan la misma generación en dos clientes', async () => {
  const old = new Set(), active = new Map();
  let counter = 0;
  const create = () => workspace.create({ date: '2026-10-20', crypto: webcrypto, fetch: async (url, init) => {
    const id = url.split('/').at(-1), payload = JSON.parse(init.body);
    if (init.method === 'DELETE') { old.add(id); const cancelled = { ...active.get(id), status: 'cancelled', updatedAt: 'cancelled-v1' }; active.delete(id); return response({ transfer: cancelled, transfers: [], revision: 2 }); }
    if (old.has(id)) return response({ error: 'El trasiego fue cancelado. Cree una nueva ruta.' }, 409);
    await turn();
    if (!active.has(id)) active.set(id, { id, ...payload.transfer, updatedAt: `v${++counter}`, status: 'confirmed' });
    return response({ transfer: active.get(id), transfers: [...active.values()], revision: counter });
  } });
  const first = create(); await first.cancelTransfer(await first.confirmTransfer(transfer()));
  const [left, right] = await Promise.all([create().confirmTransfer(transfer()), create().confirmTransfer(transfer())]);
  assert.equal(left.id, right.id); assert.equal(active.size, 1); assert.equal(counter, 2);
});

test('no cambia de ID ante errores normales o al editar explícitamente una ruta cancelada', async () => {
  for (const [status, message, explicit] of [[409, 'No hay cantidades suficientes', false], [400, 'El evento fue cancelado', false], [400, 'El trasiego fue cancelado. Cree una nueva ruta.', true]]) {
    const h = harness(() => response({ error: message }, status));
    const candidate = { ...transfer(), ...(explicit ? { id: 'cancelled-explicit', updatedAt: 'old' } : {}) };
    await assert.rejects(h.api.confirmTransfer(candidate), error => error.status === status && error.message === message);
    assert.equal(h.calls.length, 1);
  }
});

test('un servidor que responde siempre cancelado alcanza un límite explícito y no queda en bucle', async () => {
  const h = harness(() => response({ error: 'El trasiego fue cancelado. Cree una nueva ruta.' }, 400));
  await assert.rejects(h.api.confirmTransfer(transfer()), error => error.code === 'TRANSFER_GENERATION_LIMIT' && /versiones canceladas/.test(error.message));
  assert.equal(h.calls.length, 257); assert.equal(h.api.getState().pending, 0);
});
