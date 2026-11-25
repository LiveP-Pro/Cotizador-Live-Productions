"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { harness, fixtureEvents, fixtureInventory, response, deferred, flush } = require("./helpers/equipment-draft-transfer-harness.cjs");

test("el modal usa el endpoint único en mode plan y sólo marca propuestas listas la primera vez", async () => {
  const h = harness(); await h.api.show();
  assert.equal(h.calls.length, 2); assert.ok(h.calls.every((call) => call.url === "/api/cuadros-equipo/reportes/provisional" && call.init.method === "POST" && call.body.mode === "plan" && call.body.format === "json"));
  assert.ok(h.calls.every((call) => call.init.credentials === "same-origin"));
  const checkboxes = h.modal().querySelectorAll("[data-draft-route]"); assert.equal(checkboxes.length, 3); assert.equal(checkboxes.filter((input) => input.checked).length, 2); assert.ok(checkboxes.every((input) => !input.disabled));
  assert.equal(h.calls[1].body.selectedTransferIds.length, 2); assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.updates.length, 0);
});

test("desmarcar recalcula renta y aplicar conserva únicamente esa selección", async () => {
  const h = harness(); const beforeStock = JSON.stringify(h.stock()); await h.api.show(); await h.toggle(0, false);
  assert.equal(h.calls.at(-1).body.selectedTransferIds.length, 1); assert.match(h.get("[data-draft-routes]").textContent, /3 ×.*Unidad sintética/);
  await h.apply();
  assert.equal(h.api.isOpen(), false); assert.equal(h.api.selection().selectedTransferIds.length, 1); assert.equal(h.updates.length, 1);
  assert.equal(h.api.requestOptions().selectedTransferIds.length, 1); assert.equal(h.api.result().rows[0].rental, 3);
  assert.equal(JSON.stringify(h.stock()), beforeStock); assert.ok(h.calls.every((call) => call.body.mode === "plan"));
});

test("quitar todos y aplicar mantiene selección vacía al volver a abrir", async () => {
  const h = harness(); await h.api.show(); await h.click("[data-draft-select-none]"); await h.apply();
  assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.api.result().rows[0].rental, 6);
  const callCount = h.calls.length; await h.api.show();
  assert.equal(h.calls.length, callCount + 1); assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => !input.checked));
});

test("cancelar descarta horarios y selección temporales sin modificar los cuadros ni el inventario", async () => {
  const h = harness(); const beforeEvents = JSON.stringify(h.events()), beforeStock = JSON.stringify(h.stock()); await h.api.show();
  h.get('[data-draft-event="0"][data-draft-field="place"]').value = "Otro lugar temporal";
  h.get('[data-draft-event="0"][data-draft-field="endAt"]').value = "2026-11-25T10:30";
  await h.click("[data-draft-recalculate]"); await h.click("[data-draft-close]");
  assert.equal(h.api.isOpen(), false); assert.equal(h.updates.length, 0); assert.equal(h.api.selection().selectedTransferIds.length, 0);
  assert.equal(JSON.stringify(h.events()), beforeEvents); assert.equal(JSON.stringify(h.stock()), beforeStock);
});

test("los minutos estimados se muestran deshabilitados y confirmar un par habilita una propuesta revisada", async () => {
  const h = harness({ estimates: [] }); await h.api.show();
  assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => !input.checked && input.disabled));
  await h.click('[data-draft-confirm-time="0"]');
  assert.equal(h.calls.at(-1).body.routeEstimates.length, 1); assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => !input.disabled));
  await h.toggle(0, true); assert.equal(h.calls.at(-1).body.selectedTransferIds.length, 1);
});

test("un campo de minutos vacío no se interpreta como cero ni envía una validación", async () => {
  const h = harness({ estimates: [] }); await h.api.show(); const count = h.calls.length;
  h.get('[data-draft-handling="0"]').value = ""; await h.click('[data-draft-confirm-time="0"]');
  assert.equal(h.calls.length, count); assert.match(h.get("[data-draft-status]").textContent, /minutos enteros/);
  assert.ok(h.modal().querySelectorAll("[data-draft-route]").every((input) => input.disabled));
});

test("un error de red en refresh no produce un bucle de reintentos durante render", async () => {
  const h = harness({ onChange: (state) => { void state.api.refresh(); } });
  h.responses.push(response({ error: "Fallo temporal" }, 503)); await h.api.refresh(); await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.api.result(), null); assert.match(h.statuses.at(-1), /Fallo temporal/);
  await h.api.refresh(); await flush(); assert.equal(h.calls.length, 1);
  await h.api.refresh({ force: true }); assert.equal(h.calls.length, 2); assert.ok(h.api.result());
});

test("un error del modal conserva el borrador y no aplica ni reintenta al dibujar", async () => {
  const h = harness(); h.responses.push(response({ error: "No disponible" }, 503)); await h.api.show(); await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.get("[data-draft-apply]").disabled, true); assert.match(h.get("[data-draft-status]").textContent, /No disponible/);
  assert.equal(h.updates.length, 0); assert.equal(h.api.selection().selectedTransferIds.length, 0); assert.equal(h.api.isOpen(), true);
});

test("un cambio del inventario invalida el resultado cacheado y recalcula contra el estado actual", async () => {
  const h = harness(); await h.api.show(); await h.apply(); assert.equal(h.api.result().rows[0].rental, 0);
  h.setStock(fixtureInventory(2)); assert.equal(h.api.result(), null); await h.api.refresh();
  assert.ok(h.api.result().invalidSelections.length > 0); assert.equal(h.api.result().rows[0].rental, null); assert.equal(h.updates.length, 1);
});

test("un permiso denegado no envía cálculo ni muestra una renta reducida", async () => {
  const h = harness(); h.setPermission(false); await h.api.refresh(); await h.api.show();
  assert.equal(h.calls.length, 0); assert.equal(h.api.result(), null); assert.equal(h.api.isOpen(), false);
  assert.equal(h.get("[data-draft-apply]"), undefined); assert.equal(h.updates.length, 0);
  assert.match(h.statuses.at(-1), /permiso/);
});

test("revocar permiso oculta inmediatamente el plan que antes tenía renta reducida", async () => {
  const h = harness(); await h.api.show(); await h.apply(); assert.equal(h.api.result().rows[0].rental, 0);
  h.setPermission(false); assert.equal(h.api.result(), null);
  await h.api.refresh(); assert.equal(h.api.result(), null); assert.equal(h.notices.at(-1), null);
});

test("un 403 del servidor deja el pedido sin aplicar y conserva sus eventos", async () => {
  const h = harness(); const before = JSON.stringify(h.events()); h.responses.push(response({ error: "Sesión sin permiso" }, 403)); await h.api.show();
  assert.equal(h.calls.length, 1); assert.equal(h.api.result(), null); assert.equal(h.get("[data-draft-apply]").disabled, true);
  assert.equal(JSON.stringify(h.events()), before); assert.match(h.get("[data-draft-status]").textContent, /sin permiso/);
});

test("una respuesta incompleta no se acepta como pedido sin faltantes", async () => {
  const h = harness(); h.responses.push(response({ rows: [] })); await h.api.show();
  assert.equal(h.api.result(), null); assert.equal(h.updates.length, 0); assert.equal(h.get("[data-draft-apply]").disabled, true);
  assert.match(h.get("[data-draft-status]").textContent, /plan válido/);
});

test("una respuesta antigua de refresh no reemplaza la petición más reciente", async () => {
  const h = harness(); const a = deferred(), b = deferred(); h.responses.push(a.promise, b.promise);
  const first = h.api.refresh({ force: true });
  const modified = h.events(); modified[0].sections[0].items[0].quantity = 1; h.setEvents(modified);
  const second = h.api.refresh({ force: true });
  b.resolve(response(h.planFor(h.calls[1]))); await second; const expected = h.api.result().rows[0].demand;
  a.resolve(response(h.planFor(h.calls[0]))); await first;
  assert.equal(expected, 7); assert.equal(h.api.result().rows[0].demand, 7);
});

test("revocar permiso durante refresh invalida la respuesta pendiente y su cobertura anterior", async () => {
  const h = harness(); const gate = deferred(); h.responses.push(gate.promise); const request = h.api.refresh({ force: true });
  h.setPermission(false); await h.api.refresh(); gate.resolve(response(h.planFor(h.calls[0]))); await request;
  assert.equal(h.api.result(), null); assert.ok(h.notices.every((result) => result === null));
});

test("cerrar durante Aplicar impide que una respuesta anterior modifique o cierre el modal nuevo", async () => {
  const h = harness(); await h.api.show(); const gate = deferred(); h.responses.push(gate.promise);
  await h.click("[data-draft-apply]"); const applying = h.get("[data-draft-confirm-accept]").emit("click"); await flush(); const applyCall = h.calls.at(-1);
  h.api.close(); await h.api.show(); const newerModal = h.modal();
  gate.resolve(response(h.planFor(applyCall))); await applying; await flush();
  assert.equal(h.updates.length, 0); assert.equal(h.api.isOpen(), true); assert.equal(h.modal(), newerModal); assert.equal(h.api.selection().selectedTransferIds.length, 0);
});

test("cerrar durante el primer cálculo no dispara una segunda consulta para un modal descartado", async () => {
  const h = harness(); const gate = deferred(); h.responses.push(gate.promise); const showing = h.api.show(); await flush();
  h.api.close(); gate.resolve(response(h.planFor(h.calls[0]))); await showing; await flush();
  assert.equal(h.calls.length, 1); assert.equal(h.api.isOpen(), false); assert.equal(h.updates.length, 0);
});

test("un cálculo del modal descartado no altera los checks de un modal nuevo con otros datos", async () => {
  const h = harness(); const gate = deferred(); h.responses.push(gate.promise); const oldOpening = h.api.show(); await flush();
  const oldCall = h.calls[0]; h.api.close(); const modified = h.events(); modified[0].sections[0].items[0].quantity = 2; h.setEvents(modified);
  await h.api.show(); const currentModal = h.modal(); await h.toggle(0, false);
  const before = h.modal().querySelectorAll("[data-draft-route]").map((input) => input.checked); const calls = h.calls.length;
  gate.resolve(response(h.planFor(oldCall))); await oldOpening; await flush();
  assert.equal(h.calls.length, calls); assert.equal(h.modal(), currentModal);
  assert.deepEqual(h.modal().querySelectorAll("[data-draft-route]").map((input) => input.checked), before);
  await h.apply(); assert.equal(h.updates.length, 1); assert.equal(h.api.isOpen(), false); assert.equal(h.api.result().invalidSelections.length, 0);
});

test("descripciones, lugares y errores maliciosos se muestran como texto escapado", async () => {
  const bad = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const events = fixtureEvents(); for (const event of events) { event.place = bad; event.sections[0].items[0].description = bad; }
  const h = harness({ events, estimates: [{ fromPlace: bad, toPlace: bad, travelMinutes: 0, handlingMinutes: 120 }] });
  const stock = h.stock(); stock.state.items[0].name = bad; h.setStock(stock); await h.api.show();
  assert.equal(h.modal().querySelectorAll("img,script").length, 0); assert.match(h.get("[data-draft-routes]").innerHTML, /&lt;img/);
  assert.match(h.modal().textContent, /<img src=x onerror="alert\(1\)">/);
  h.responses.push(response({ error: bad }, 503)); await h.click("[data-draft-recalculate]");
  assert.equal(h.get("[data-draft-status]").textContent, bad); assert.equal(h.modal().querySelectorAll("img,script").length, 0);
});

test("Escape cierra y devuelve el foco sin guardar ningún cambio", async () => {
  const h = harness(); const priorFocus = h.document.activeElement; await h.api.show();
  await h.modal().emit("keydown", { key: "Escape" }); assert.equal(h.api.isOpen(), false); assert.equal(h.document.activeElement, priorFocus); assert.equal(h.updates.length, 0);
});

test("aplicar recoge cantidades y minutos editados aunque no se pulse Revisar cambio", async () => {
  const h = harness(); await h.api.show();
  h.get('[data-draft-quantity="0"]').value = "1";
  h.get('[data-draft-note="0"]').value = "Cargar primero en el camión";
  h.get('[data-draft-travel="0"]').value = "10";
  h.get('[data-draft-distance="0"]').value = "2.5";
  await h.click('[data-draft-apply]');
  assert.ok(h.get('[data-draft-confirm-accept]')); assert.equal(h.updates.length, 0);
  await h.click('[data-draft-confirm-accept]');
  assert.equal(h.updates.length, 1);
  assert.equal(h.api.selection().transferEdits[0].quantity, 1);
  assert.equal(h.api.selection().transferEdits[0].note, "Cargar primero en el camión");
  assert.equal(h.api.selection().routeEstimates[0].travelMinutes, 10);
  assert.equal(h.api.selection().routeEstimates[0].distanceKm, 2.5);
});

test("una cantidad fuera del máximo no abre confirmación ni guarda cambios", async () => {
  const h = harness(); await h.api.show(); const calls = h.calls.length;
  h.get('[data-draft-quantity="0"]').value = "4";
  await h.click('[data-draft-apply]');
  assert.equal(h.get('[data-draft-confirm-accept]'), null); assert.equal(h.updates.length, 0);
  assert.equal(h.calls.length, calls); assert.match(h.get('[data-draft-status]').textContent, /entre 0 y 3/);
});


test("desmontaje opcional se edita y confirma sin cambiar fuente; cancelar lo descarta", async () => {
  const events = fixtureEvents();
  events[0].teardownAt = "2026-11-25T09:30";
  events[0].sourceImport = { sourceCells: [{ ref: "synthetic:A1", value: "Nota original literal" }] };
  const h = harness({events}); const before = JSON.stringify(h.events()); await h.api.show();
  const field = h.get('[data-draft-event="0"][data-draft-field="teardownAt"]');
  assert.ok(field); assert.equal(field.value, "2026-11-25T09:30");
  assert.equal(h.get('[data-draft-event="1"][data-draft-field="teardownAt"]').value, "");
  field.value = "2026-11-25T10:00";
  await h.click('[data-draft-recalculate]'); await h.click('[data-draft-close]');
  assert.equal(JSON.stringify(h.events()), before); assert.equal(h.updates.length, 0);
  await h.api.show();
  h.get('[data-draft-event="0"][data-draft-field="teardownAt"]').value = "2026-11-25T10:00";
  await h.click('[data-draft-recalculate]'); await h.apply();
  assert.equal(h.updates.length, 1); assert.equal(h.events()[0].teardownAt, "2026-11-25T10:00");
  assert.equal(h.events()[1].teardownAt, "");
  assert.equal(JSON.stringify(h.events()[0].sourceImport), JSON.stringify(events[0].sourceImport));
});
