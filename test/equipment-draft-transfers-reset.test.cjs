'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { harness, fixtureEvents, copy, response, deferred, flush } = require('./helpers/equipment-draft-transfer-harness.cjs');

const emptySelection = { selectedTransferIds: [], transferEdits: [], routeEstimates: [], splitAuthorizedOrigins: [] };
function newPlanEvents() {
  return fixtureEvents().map((event, index) => ({ ...event, id: `fresh-${index}`, name: `Nuevo archivo sintético ${index}` }));
}
async function editFirstRoute(h, quantity = 1) {
  h.get('[data-draft-quantity="0"]').value = String(quantity);
  h.get('[data-draft-note="0"]').value = 'Nota descartable del plan anterior';
  await h.click('[data-draft-save-edit="0"]');
}

test('reiniciar elimina una selección parcial confirmada, notas, tiempos locales y caché sin tocar inventario', async () => {
  const h = harness(), stock = JSON.stringify(h.stock());
  await h.api.show(); await h.openEditor();
  await editFirstRoute(h);
  h.get('[data-draft-travel="0"]').value = '1';
  await h.click('[data-draft-confirm-time="0"]');
  await h.apply();
  assert.ok(h.api.selection().selectedTransferIds.length);
  assert.ok(h.api.selection().transferEdits.some(edit => edit.quantity === 1 && edit.note));
  assert.ok(h.api.selection().routeEstimates.length);
  assert.ok(h.api.result());
  const calls = h.calls.length, updates = h.updates.length;
  h.setEvents([]);
  h.api.reset();
  assert.deepEqual(copy(h.api.selection()), emptySelection);
  assert.equal(h.api.result(), null);
  assert.equal(h.api.error(), '');
  assert.equal(h.api.isOpen(), false);
  assert.equal(h.notices.at(-1), null);
  assert.equal(h.calls.length, calls, 'reiniciar no realiza solicitudes');
  assert.equal(h.updates.length, updates, 'reiniciar no escribe eventos ni movimientos');
  assert.equal(JSON.stringify(h.stock()), stock);
  assert.equal(h.api.requestOptions().routeEstimates.length, 1, 'las estimaciones base vigentes del servidor siguen disponibles');
  assert.equal(h.api.requestOptions().routeEstimates[0].travelMinutes, 0);
});

test('una respuesta de cálculo anterior no restaura la caché ni publica un error después de reiniciar', async () => {
  const h = harness(), delayed = deferred();
  h.responses.push(() => delayed.promise);
  const pending = h.api.refresh();
  const previous = h.calls.at(-1), plan = h.planFor(previous);
  h.setEvents([]); h.api.reset();
  const notices = h.notices.length, statuses = h.statuses.length;
  delayed.resolve(response(plan));
  assert.equal(await pending, null);
  assert.equal(h.api.result(), null);
  assert.equal(h.notices.length, notices);
  assert.equal(h.statuses.length, statuses);
  assert.deepEqual(copy(h.api.selection()), emptySelection);
});

test('el fallo tardío de una solicitud descartada no repone mensajes del plan anterior', async () => {
  const h = harness(), delayed = deferred();
  h.responses.push(() => delayed.promise);
  const pending = h.api.refresh();
  h.setEvents([]); h.api.reset();
  delayed.resolve(response({ error: 'Error anterior que ya no corresponde' }, 500));
  await pending;
  assert.equal(h.api.error(), '');
  assert.equal(h.notices.at(-1), null);
  assert.equal(h.statuses.length, 0);
});

test('reiniciar cierra un cálculo abierto y una respuesta tardía no modifica el nuevo modal', async () => {
  const h = harness(), delayed = deferred();
  h.responses.push(() => delayed.promise);
  const oldShow = h.api.show();
  const oldPlan = h.planFor(h.calls.at(-1));
  assert.equal(h.api.isOpen(), true);
  h.setEvents([]); h.api.reset();
  assert.equal(h.api.isOpen(), false);
  h.setEvents(newPlanEvents());
  await h.api.show(); await h.openEditor();
  const currentModal = h.modal(), text = currentModal.textContent, callCount = h.calls.length;
  delayed.resolve(response(oldPlan)); await oldShow;
  assert.equal(h.modal(), currentModal);
  assert.equal(h.modal().textContent, text);
  assert.equal(h.calls.length, callCount, 'el cálculo anterior no inicia una segunda selección automática');
  assert.match(text, /Nuevo archivo sintético/);
  assert.deepEqual(copy(h.api.selection()), emptySelection, 'la recomendación nueva sigue siendo un borrador');
});

test('una confirmación cancelada y desprendida no puede aplicarse tras reiniciar ni cerrar otra confirmación', async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await editFirstRoute(h);
  await h.click('[data-draft-apply]');
  const oldAccept = h.get('[data-draft-confirm-accept]');
  const oldCancel = h.get('[data-draft-confirm-cancel]');
  await h.click('[data-draft-confirm-cancel]');
  h.setEvents([]); h.api.reset(); h.setEvents(newPlanEvents());
  await h.api.show(); await h.openEditor(); await editFirstRoute(h, 2); await h.click('[data-draft-apply]');
  const currentConfirmation = h.get('[data-draft-confirm-accept]');
  const calls = h.calls.length;
  await oldAccept.emit('click'); await oldCancel.emit('click'); await flush();
  assert.equal(h.updates.length, 0);
  assert.equal(h.calls.length, calls);
  assert.equal(h.get('[data-draft-confirm-accept]'), currentConfirmation);
  assert.deepEqual(copy(h.api.selection()), emptySelection);
});

test('reiniciar mientras se valida Aceptar impide que el cálculo antiguo guarde sus cambios', async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await editFirstRoute(h);
  await h.click('[data-draft-apply]');
  const delayed = deferred(); h.responses.push(() => delayed.promise);
  const accepting = h.get('[data-draft-confirm-accept]').emit('click');
  const oldPlan = h.planFor(h.calls.at(-1));
  h.setEvents([]); h.api.reset();
  delayed.resolve(response(oldPlan)); await accepting; await flush();
  assert.equal(h.updates.length, 0);
  assert.equal(h.api.isOpen(), false);
  assert.deepEqual(copy(h.api.selection()), emptySelection);
  assert.ok(!h.statuses.some(message => /Cambios aplicados/.test(message)));
});

test('un refresco posterior a Aplicar no anuncia ni restaura el plan si ya se reinició', async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await editFirstRoute(h);
  await h.click('[data-draft-apply]');
  const delayed = deferred();
  h.responses.push(call => response(h.planFor(call)), () => delayed.promise);
  const accepting = h.get('[data-draft-confirm-accept]').emit('click');
  await flush();
  assert.equal(h.updates.length, 1, 'Aplicar terminó antes de que el usuario reiniciara');
  const oldPlan = h.planFor(h.calls.at(-1));
  h.setEvents([]); h.api.reset();
  const statuses = h.statuses.length;
  delayed.resolve(response(oldPlan)); await accepting;
  assert.deepEqual(copy(h.api.selection()), emptySelection);
  assert.equal(h.api.result(), null);
  assert.equal(h.statuses.length, statuses, 'el éxito tardío no sustituye el mensaje del nuevo plan vacío');
});

test('una autorización de dividir el camión tampoco se conserva después de reiniciar', async () => {
  const events = fixtureEvents();
  for (const [index, event] of events.entries()) {
    event.date = index ? '2026-11-27' : '2026-11-25';
    event.setupAt = index ? '2026-11-26T08:00' : '2026-11-25T08:00';
    event.startAt = index ? '2026-11-27T12:00' : '2026-11-25T10:00';
    event.endAt = index ? '2026-11-27T18:00' : '2026-11-25T18:00';
    event.equipmentInAt = '2026-11-28T12:00';
    event.sections[0].items = [
      { warehouseInventoryId: 'synthetic-a', quantity: index === 2 ? 0 : 1, description: 'Referencia A' },
      { warehouseInventoryId: 'synthetic-b', quantity: index === 1 ? 0 : 1, description: 'Referencia B' }
    ];
  }
  const h = harness({ events });
  h.setStock({ savedAt: 'synthetic-current', state: { items: [
    { id: 'synthetic-a', name: 'Referencia A', itemType: 'equipo', quantity: 1 },
    { id: 'synthetic-b', name: 'Referencia B', itemType: 'equipo', quantity: 1 }
  ], movements: [] } });
  await h.api.show(); await h.openEditor();
  let plan = h.planFor(h.calls.at(-1));
  await h.click(`[data-draft-choose-bundle="${plan.routeBundles.findIndex(bundle => bundle.toEventId === 'event-1')}"]`);
  plan = h.planFor(h.calls.at(-1));
  await h.toggle(plan.candidates.findIndex(route => route.toEventId === 'event-2'), true);
  await h.click('[data-draft-confirm-accept]'); await h.apply();
  assert.deepEqual(copy(h.api.selection().splitAuthorizedOrigins), ['event-0']);
  h.setEvents([]); h.api.reset();
  assert.deepEqual(copy(h.api.selection()), emptySelection);
  assert.deepEqual(copy(h.api.requestOptions().splitAuthorizedOrigins), []);
});

test('reabrir tras reiniciar propone sólo rutas del archivo nuevo, sin recuperar cantidades anteriores', async () => {
  const h = harness(); await h.api.show(); await h.openEditor(); await editFirstRoute(h); await h.apply();
  const priorIds = copy(h.api.selection().selectedTransferIds);
  const firstCall = h.calls.length;
  h.setEvents([]); h.api.reset(); h.setEvents(newPlanEvents());
  await h.api.show(); await h.openEditor();
  const requests = h.calls.slice(firstCall);
  assert.deepEqual(requests[0].body.selectedTransferIds, []);
  assert.deepEqual(requests[0].body.transferEdits, []);
  assert.deepEqual(requests[0].body.splitAuthorizedOrigins, []);
  const last = requests.at(-1).body;
  assert.ok(last.selectedTransferIds.length, 'la nueva selección automática sí se calcula desde cero');
  assert.ok(last.selectedTransferIds.every(id => !priorIds.includes(id)));
  assert.ok(last.events.every(event => event.id.startsWith('fresh-')));
  assert.ok(!last.transferEdits.some(edit => edit.note === 'Nota descartable del plan anterior'));
  await h.apply();
  assert.ok(h.api.selection().selectedTransferIds.every(id => !priorIds.includes(id)));
});

test('reiniciar es idempotente y borra un error previo incluso sin eventos', async () => {
  const h = harness(); h.responses.push(response({ error: 'Fallo del plan anterior' }, 500));
  await h.api.refresh(); assert.match(h.api.error(), /Fallo del plan anterior/);
  h.setEvents([]); h.api.reset(); h.api.reset(); await h.api.show(); await h.openEditor();
  assert.equal(h.api.error(), '');
  assert.deepEqual(copy(h.api.selection()), emptySelection);
  assert.equal(h.api.result(), null);
  assert.equal(h.api.isOpen(), false);
  assert.equal(h.updates.length, 0);
});
