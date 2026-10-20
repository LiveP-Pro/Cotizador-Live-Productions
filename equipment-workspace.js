(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EquipmentWorkspace = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const text = value => value === undefined || value === null ? '' : String(value);
  const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']' : value && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}' : JSON.stringify(value);
  function validDate(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text(date))) return false;
    const value = new Date(`${date}T12:00:00`);
    return Number.isFinite(value.getTime()) && `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` === date;
  }
  function weekFor(date) {
    if (meaningful(date) && !validDate(date)) throw new Error('Seleccione una fecha válida.');
    const value = validDate(date) ? new Date(`${date}T12:00:00`) : new Date();
    const offset = (value.getDay() + 6) % 7;
    value.setDate(value.getDate() - offset);
    const format = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const from = format(value);
    value.setDate(value.getDate() + 6);
    return { from, to: format(value) };
  }
  function meaningful(value) { return text(value).trim() !== ''; }
  function errorWith(message, status, code) { const error = new Error(message); error.status = status; error.code = code; return error; }
  function activeEvents(events) { return events.filter(event => event && event.status !== 'cancelled'); }
  function activeTransfers(transfers) { return transfers.filter(transfer => transfer && transfer.status !== 'cancelled'); }
  function transferValues(candidate) {
    const raw = candidate?.transfer || candidate || {};
    const items = Array.isArray(raw.items) ? raw.items.map(line => ({ warehouseInventoryId: text(line.warehouseInventoryId), quantity: Number(line.quantity) }))
      : [{ warehouseInventoryId: text(raw.warehouseInventoryId), quantity: Number(raw.quantity) }];
    const fromEventId = text(raw.fromEventId), toEventId = text(raw.toEventId);
    if (!meaningful(fromEventId) || !meaningful(toEventId) || fromEventId === toEventId || !items.length
      || items.some(line => !line.warehouseInventoryId || !Number.isFinite(line.quantity) || line.quantity <= 0)
      || new Set(items.map(line => line.warehouseInventoryId)).size !== items.length) throw errorWith('Seleccione los eventos, el equipo y una cantidad válida para el trasiego.', 400, 'INVALID_TRANSFER');
    const travelMinutes = Number(raw.travelMinutes ?? 60), handlingMinutes = Number(raw.handlingMinutes ?? 120);
    if (!Number.isFinite(travelMinutes) || travelMinutes < 0 || !Number.isFinite(handlingMinutes) || handlingMinutes < 0) throw errorWith('Los tiempos de transporte y preparación deben ser números mayores o iguales a 0.', 400, 'INVALID_TRANSFER');
    items.sort((left, right) => left.warehouseInventoryId < right.warehouseInventoryId ? -1 : left.warehouseInventoryId > right.warehouseInventoryId ? 1 : 0);
    return { fromEventId, toEventId, items, travelMinutes, handlingMinutes };
  }
  function intersects(event, range) {
    if (!range?.from || !range?.to) return true;
    const start = String(event.setupAt || event.startAt || event.date || '').slice(0, 10);
    const end = String(event.equipmentInAt || event.endAt || event.date || start).slice(0, 10);
    return !start || (start <= range.to && end >= range.from);
  }
  function create(options = {}) {
    const request = options.fetch || ((...args) => fetch(...args));
    let state = { events: [], transfers: [], routeEstimates: [], revision: '', plan: null, range: weekFor(options.date), loaded: false, stale: true, refreshing: false, pending: 0, lastError: null };
    let refreshing = null, mutation = 0, pending = 0, writeTail = Promise.resolve();
    const operations = new Map();
    const cancelledTransferIds = new Set();
    const emit = () => options.onState?.(copy(state));
    const invalidate = () => { state.plan = null; state.stale = true; };
    function report(error) {
      invalidate();
      state.lastError = { message: error.message, status: error.status || 0, code: error.code || '' };
      if (error.status === 401) state.loaded = false;
      emit();
    }
    async function json(url, init = {}) {
      let response;
      try { response = await request(url, { credentials: 'same-origin', cache: 'no-store', ...init }); }
      catch (cause) { const error = errorWith('No se pudo conectar con el servidor. El cuadro se conserva; revise la conexión e intente nuevamente.', 0, 'NETWORK'); error.cause = cause; throw error; }
      let body, parseError;
      try { body = await response.json(); } catch (error) { parseError = error; body = {}; }
      if (!response.ok) {
        throw errorWith(body?.error || (response.status === 401 ? 'Inicie sesión para consultar la agenda y el inventario.' : response.status === 409 || response.status === 428
          ? 'El registro cambió. Conserve su cuadro y actualice la agenda antes de continuar.' : 'No se pudo sincronizar la agenda. Intente nuevamente.'), response.status, body?.code || 'HTTP');
      }
      if (parseError || !body || typeof body !== 'object') throw errorWith('El servidor devolvió una respuesta incompleta. No se reemplazó su cuadro.', 502, 'INVALID_RESPONSE');
      return body;
    }
    function refresh() {
      if (refreshing) return refreshing;
      state.refreshing = true; state.lastError = null;
      const task = (async () => {
        for (;;) {
          while (pending) await writeTail;
          const generation = mutation, range = { ...state.range }, routeEstimates = copy(state.routeEstimates);
          const query = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
          try {
            let agenda, plan, consistent = false;
            for (let attempt = 0; attempt < 3; attempt += 1) {
              [agenda, plan] = await Promise.all([json('/api/cuadros-equipo/eventos'), routeEstimates.length
                ? json('/api/cuadros-equipo/plan-logistico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...range, routeEstimates }) })
                : json('/api/cuadros-equipo/disponibilidad' + query)]);
              if (generation !== mutation || range.from !== state.range.from || range.to !== state.range.to || pending) break;
              if (!Array.isArray(agenda.events) || !Array.isArray(plan.rows) || agenda.revision === undefined || plan.revision === undefined) throw errorWith('La agenda o el cálculo de disponibilidad está incompleto. Actualice para volver a consultar.', 502, 'INVALID_RESPONSE');
              if (plan.from !== undefined && plan.from !== range.from || plan.to !== undefined && plan.to !== range.to) throw errorWith('El cálculo recibido corresponde a otro período. Vuelva a actualizar la agenda.', 502, 'INVALID_RANGE');
              if (agenda.revision === plan.revision) { consistent = true; break; }
            }
            // Every waiter receives the latest requested range, even if it changed during a GET.
            if (generation !== mutation || range.from !== state.range.from || range.to !== state.range.to || pending) continue;
            if (!consistent) throw errorWith('La agenda cambió durante la consulta. Vuelva a actualizar para calcular disponibilidad con una sola versión.', 409, 'STALE_PLAN');
            state = { ...state, events: activeEvents(agenda.events), transfers: activeTransfers(Array.isArray(agenda.transfers) ? agenda.transfers : []),
              revision: agenda.revision, plan, loaded: true, stale: false, lastError: null };
            emit();
            return copy({ ...state, refreshing: false });
          } catch (error) {
            if (error.status !== 401 && (generation !== mutation || range.from !== state.range.from || range.to !== state.range.to || pending)) continue;
            report(error); throw error;
          }
        }
      })().finally(() => { if (refreshing === task) refreshing = null; state.refreshing = false; emit(); });
      refreshing = task; emit();
      return refreshing;
    }
    function enqueue(entity, signature, operation) {
      const active = operations.get(entity);
      if (active) return active.signature === signature ? active.promise : Promise.reject(errorWith('Ese registro tiene un cambio pendiente. Espere la confirmación antes de modificarlo otra vez.', 409, 'PENDING_CHANGE'));
      pending += 1; mutation += 1; state.pending = pending; state.lastError = null; invalidate();
      const promise = writeTail.then(operation).catch(error => { report(error); throw error; }).finally(() => {
        pending -= 1; state.pending = pending; operations.delete(entity); emit();
      });
      operations.set(entity, { signature, promise });
      writeTail = promise.catch(() => {}); emit();
      return promise;
    }
    function acceptMutation(body) {
      if (body.transfer?.status === 'cancelled' && body.transfer.id) cancelledTransferIds.add(text(body.transfer.id));
      if (Array.isArray(body.transfers)) body.transfers.filter(transfer => transfer?.status === 'cancelled').forEach(transfer => cancelledTransferIds.add(text(transfer.id)));
      if (Array.isArray(body.events)) state.events = activeEvents(body.events);
      if (Array.isArray(body.transfers)) state.transfers = activeTransfers(body.transfers);
      state.revision = body.revision ?? state.revision; state.loaded = true; state.lastError = null; invalidate();
      emit();
    }
    function save(event) {
      const snapshot = copy(event || {}), id = text(snapshot.id);
      if (!id) return Promise.reject(errorWith('El evento debe tener un identificador.', 400, 'INVALID_EVENT'));
      const payload = { event: snapshot, ...(snapshot.updatedAt ? { expectedUpdatedAt: snapshot.updatedAt } : {}) };
      return enqueue(`event:${id}`, stable(['save', payload]), async () => {
        const body = await json('/api/cuadros-equipo/eventos/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!body.event || body.event.id !== id || !Array.isArray(body.events)) throw errorWith('No se pudo verificar el evento guardado. Conserve el cuadro y vuelva a consultar la agenda.', 502, 'INVALID_RESPONSE');
        acceptMutation(body); return copy(body.event);
      });
    }
    function cancel(event) {
      const snapshot = copy(event || {}), id = text(snapshot.id);
      if (!id) return Promise.reject(errorWith('Seleccione el evento que desea cancelar.', 400, 'INVALID_EVENT'));
      const payload = snapshot.updatedAt ? { expectedUpdatedAt: snapshot.updatedAt } : {};
      return enqueue(`event:${id}`, stable(['cancel', payload]), async () => {
        const body = await json('/api/cuadros-equipo/eventos/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!Array.isArray(body.events)) throw errorWith('No se pudo verificar la cancelación. Actualice la agenda antes de continuar.', 502, 'INVALID_RESPONSE');
        acceptMutation(body); return copy(body);
      });
    }
    async function transferId(transfer, previousCancelledId = '') {
      const values = [transfer.fromEventId, transfer.toEventId, transfer.items.map(item => item.warehouseInventoryId).sort()];
      // A cancelled route stays immutable. Its ID becomes the generation token
      // of the next route, so independent clients derive the same replacement.
      if (previousCancelledId) values.push('after-cancelled', previousCancelledId);
      const identity = stable(values);
      const cryptoApi = options.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto);
      if (!cryptoApi?.subtle?.digest) throw errorWith('Actualice el navegador para confirmar una ruta de trasiego de forma segura.', 400, 'CRYPTO_UNAVAILABLE');
      const bytes = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(identity));
      return 'trasiego-' + Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
    }
    async function confirmTransfer(candidate) {
      const snapshot = copy(candidate || {}), transfer = transferValues(snapshot);
      const raw = snapshot.transfer || snapshot;
      const explicitId = text(raw.id);
      let id = explicitId || await transferId(transfer);
      let generations = 0;
      while (!explicitId && cancelledTransferIds.has(id)) {
        if (++generations > 256) throw errorWith('Esta ruta tiene demasiadas versiones canceladas para comprobarla en una sola consulta. Actualice la agenda y revise el historial antes de confirmar otra ruta.', 409, 'TRANSFER_GENERATION_LIMIT');
        id = await transferId(transfer, id);
      }
      const expectedUpdatedAt = snapshot.expectedUpdatedAt || raw.updatedAt;
      const payload = { transfer, ...(explicitId && expectedUpdatedAt ? { expectedUpdatedAt } : {}) };
      return enqueue(`transfer:${id}`, stable(['confirm', payload]), async () => {
        for (;;) {
          try {
            const body = await json('/api/cuadros-equipo/trasiegos/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!body.transfer || body.transfer.id !== id || !Array.isArray(body.transfers)) throw errorWith('No se pudo verificar el trasiego confirmado. Actualice la agenda antes de continuar.', 502, 'INVALID_RESPONSE');
            acceptMutation(body); return copy(body.transfer);
          } catch (error) {
            // Only the server's explicit immutable-cancelled response permits a
            // new generation. Availability/conflict/auth/network errors do not.
            const cancelled = !explicitId && [400, 409].includes(error.status)
              && (error.code === 'TRANSFER_CANCELLED' || /^El trasiego fue cancelado\. Cree una nueva ruta\.?$/.test(error.message));
            if (!cancelled) throw error;
            cancelledTransferIds.add(id);
            if (++generations > 256) throw errorWith('Esta ruta tiene demasiadas versiones canceladas para comprobarla en una sola consulta. Actualice la agenda y revise el historial antes de confirmar otra ruta.', 409, 'TRANSFER_GENERATION_LIMIT');
            id = await transferId(transfer, id);
            while (cancelledTransferIds.has(id)) {
              if (++generations > 256) throw errorWith('Esta ruta tiene demasiadas versiones canceladas para comprobarla en una sola consulta. Actualice la agenda y revise el historial antes de confirmar otra ruta.', 409, 'TRANSFER_GENERATION_LIMIT');
              id = await transferId(transfer, id);
            }
          }
        }
      });
    }
    function cancelTransfer(transfer) {
      const snapshot = copy(transfer || {}), id = text(snapshot.id);
      if (!id) return Promise.reject(errorWith('Seleccione la ruta de trasiego que desea cancelar.', 400, 'INVALID_TRANSFER'));
      const payload = snapshot.updatedAt ? { expectedUpdatedAt: snapshot.updatedAt } : {};
      return enqueue(`transfer:${id}`, stable(['cancel', payload]), async () => {
        const body = await json('/api/cuadros-equipo/trasiegos/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!Array.isArray(body.transfers)) throw errorWith('No se pudo verificar la cancelación del trasiego. Actualice la agenda.', 502, 'INVALID_RESPONSE');
        acceptMutation(body); return copy(body);
      });
    }
    async function refreshTransfers() {
      try {
        const generation = mutation;
        const body = await json('/api/cuadros-equipo/trasiegos');
        if (!Array.isArray(body.transfers) || body.revision === undefined) throw errorWith('No se pudo leer el registro de trasiegos.', 502, 'INVALID_RESPONSE');
        if (generation !== mutation || pending || body.revision !== state.revision) return copy((await refresh()).transfers);
        state.transfers = activeTransfers(body.transfers);
        emit();
        return copy(state.transfers);
      } catch (error) { report(error); throw error; }
    }
    return { refresh, save, cancel, confirmTransfer, cancelTransfer, refreshTransfers, transfers: () => copy(state.transfers), getState: () => copy(state), visibleEvents: () => copy(state.events.filter(e => intersects(e, state.range))), setLogisticsEstimates(estimates) {
      if (!Array.isArray(estimates) || estimates.some(estimate => !estimate || typeof estimate !== 'object' || Array.isArray(estimate)
        || !meaningful(estimate.fromPlace) || !meaningful(estimate.toPlace)
        || !Number.isFinite(estimate.travelMinutes) || estimate.travelMinutes < 0
        || !Number.isFinite(estimate.handlingMinutes) || estimate.handlingMinutes < 0)) {
        throw errorWith('Indique los dos eventos y tiempos de transporte y preparación válidos para calcular el trasiego.', 400, 'INVALID_LOGISTICS_ESTIMATES');
      }
      if (stable(state.routeEstimates) === stable(estimates)) return;
      state.routeEstimates = copy(estimates); invalidate(); mutation++; emit();
    }, setRange(range) {
      if (!validDate(range?.from) || !validDate(range?.to) || range.to < range.from) throw new Error('Seleccione un rango de fechas válido.');
      if (state.range.from === range.from && state.range.to === range.to) return;
      state.range = { from: range.from, to: range.to }; invalidate(); mutation++; emit();
    } };
  }
  return { create, weekFor, intersects, validDate, transferValues };
});
