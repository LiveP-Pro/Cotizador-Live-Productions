"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateEquipmentAvailability, localTime } = require("../equipment-event-store.cjs");

const NOW = Date.parse("2026-01-01T00:00:00Z");
const BASE = Date.parse("2026-11-01T00:00:00Z");
const at = hours => new Date(BASE + hours * 3600000).toISOString().slice(0, 16);
const normalizePlace = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
function inventory(quantity = 1, itemType = "equipo") {
  return { savedAt: "synthetic-current", state: { items: [{ id: "oracle-unit", name: "Unidad sintética para oráculo", category: "Pruebas", itemType, quantity }], movements: [] } };
}
function event(id, setupHours, endHours, quantity = 1, extra = {}) {
  return { id, name: `Evento sintético ${id}`, place: "Sede sintética", type: "Prueba", status: "confirmed",
    setupAt: at(setupHours), startAt: at(setupHours + 0.25), endAt: at(endHours), equipmentInAt: at(Math.max(endHours + 12, 72)),
    sections: [{ id: `section-${id}`, title: "Pruebas", items: [{ id: `line-${id}`, description: "Unidad sintética para oráculo", warehouseInventoryId: "oracle-unit", quantity }] }], ...extra };
}
function rowFor(events, quantity = 1, options = {}, itemType = "equipo") {
  const result = calculateEquipmentAvailability(events, inventory(quantity, itemType), { now: NOW, ...options });
  const row = result.rows.find(value => value.warehouseInventoryId === "oracle-unit");
  assert.ok(row, "el resumen debe conservar la fila de inventario");
  return row;
}
function planningFor(events, quantity = 1, options = {}) {
  const row = rowFor(events, quantity, options);
  assert.ok(row.planning, "se requiere planificación global independiente del faltante sin confirmar");
  return row.planning;
}
function feasibility(events, options = {}) {
  return (before, after) => {
    if (before.id === after.id) return false;
    const next = localTime(after.setupAt);
    if (localTime(before.equipmentInAt) + Math.max(120, Number(before.preparationMinutes) || 120) * 60000 <= next) return true;
    if (!before.endAt) return false;
    const samePlace = normalizePlace(before.place) && normalizePlace(before.place) === normalizePlace(after.place);
    const specified = (options.routeEstimates || []).find(route => normalizePlace(route.fromPlace) === normalizePlace(before.place) && normalizePlace(route.toPlace) === normalizePlace(after.place));
    const travel = specified ? Number(specified.travelMinutes) : samePlace ? 0 : 60;
    const handling = specified?.handlingMinutes === undefined ? 120 : Number(specified.handlingMinutes);
    return localTime(before.endAt) + (travel + handling) * 60000 <= next;
  };
}

// This deliberately uses a tiny exhaustive labelled-unit matching, not the
// production solver. Every unit has at most one predecessor and successor.
// Minimum path cover in a temporal DAG = demand units minus maximum matching.
function exhaustiveFleet(events, options = {}) {
  const units = events.flatMap(evt => Array.from({ length: evt.sections[0].items[0].quantity }, () => evt));
  const canFollow = feasibility(events, options), memo = new Map();
  function search(index, usedDestinations) {
    if (index === units.length) return 0;
    const key = `${index}:${usedDestinations}`;
    if (memo.has(key)) return memo.get(key);
    let best = search(index + 1, usedDestinations);
    for (let destination = 0; destination < units.length; destination += 1) {
      if (!(usedDestinations & (1 << destination)) && canFollow(units[index], units[destination])) {
        best = Math.max(best, 1 + search(index + 1, usedDestinations | (1 << destination)));
      }
    }
    memo.set(key, best); return best;
  }
  return units.length - search(0, 0);
}
function checkAllocationConservation(events, plan, stock) {
  const expected = new Map(events.map(evt => [evt.id, evt.sections[0].items[0].quantity]));
  const covered = new Map(); let owned = 0, rented = 0;
  for (const path of plan.allocations) {
    assert.ok(Number.isFinite(path.quantity) && path.quantity > 0);
    assert.equal(new Set(path.eventIds).size, path.eventIds.length, "ningún camino puede repetir un evento");
    if (path.source === "warehouse") owned += path.quantity;
    else { assert.equal(path.source, "rental"); rented += path.quantity; }
    for (const id of path.eventIds) covered.set(id, (covered.get(id) || 0) + path.quantity);
  }
  for (const [id, demand] of expected) assert.equal(covered.get(id) || 0, demand, `se cubre exactamente la demanda ${id}`);
  assert.ok(owned <= stock, "los caminos de bodega no inventan unidades");
  assert.equal(owned + rented, plan.requiredFleet);
  assert.equal(rented, plan.rentalPotential);
}

test("oráculo independiente compara 160 agendas pequeñas con cobertura exhaustiva y permutación", () => {
  let seed = 74129;
  const next = limit => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % limit; };
  for (let sample = 0; sample < 160; sample += 1) {
    const length = 2 + next(3), stock = next(4);
    const events = Array.from({ length }, (_, index) => {
      const start = next(6) * 4;
      return event(`case-${sample}-${index}`, start, start + 1 + next(3) * 4, 1 + next(2));
    });
    const expected = exhaustiveFleet(events), plan = planningFor(events, stock);
    assert.equal(plan.requiredFleet, expected, `agenda ${sample}`);
    assert.equal(plan.rentalPotential, Math.max(0, expected - stock), `renta agenda ${sample}`);
    checkAllocationConservation(events, plan, stock);
    const reversed = planningFor([...events].reverse(), stock);
    assert.equal(reversed.requiredFleet, expected, `orden inverso ${sample}`);
    assert.equal(reversed.rentalPotential, plan.rentalPotential);
    checkAllocationConservation(events, reversed, stock);
  }
});

test("una unidad recorre A → B → C sin crear tres unidades ni rentar", () => {
  const events = [event("a", 0, 1), event("b", 4, 5), event("c", 8, 9)];
  const row = rowFor(events), plan = row.planning;
  assert.equal(plan.requiredFleet, 1); assert.equal(plan.rentalPotential, 0);
  assert.equal(plan.routes.length, 2);
  assert.equal(row.missing, 2, "la propuesta no aplica un trasiego sin confirmarlo");
  checkAllocationConservation(events, plan, 1);
});

test("se busca A → C aunque B esté intercalado y siga ocupado", () => {
  const events = [event("a", 0, 1), event("b", 1, 20), event("c", 4, 5)];
  const plan = planningFor(events, 2);
  assert.equal(plan.requiredFleet, 2); assert.equal(plan.rentalPotential, 0);
  assert.ok(plan.routes.some(route => route.fromEventId === "a" && route.toEventId === "c"));
  checkAllocationConservation(events, plan, 2);
});

test("la misma unidad origen no abastece dos destinos simultáneos", () => {
  const events = [event("a", 0, 1), event("b", 4, 8), event("c", 4, 8)];
  const plan = planningFor(events, 1);
  assert.equal(plan.requiredFleet, 2); assert.equal(plan.rentalPotential, 1);
  assert.ok(plan.routes.filter(route => route.fromEventId === "a").reduce((sum, route) => sum + route.quantity, 0) <= 1);
  checkAllocationConservation(events, plan, 1);
});

test("la elección global evita el emparejamiento voraz que bloquea al segundo origen", () => {
  const events = [event("a", 0, 1, 1, { place: "Sede A" }), event("b", 0, 1, 1, { place: "Sede B" }),
    event("c", 4, 5, 1, { place: "Sede C" }), event("d", 4, 5, 1, { place: "Sede D" })];
  const routeEstimates = [
    { fromPlace: "Sede A", toPlace: "Sede C", travelMinutes: 60, handlingMinutes: 120 },
    { fromPlace: "Sede A", toPlace: "Sede D", travelMinutes: 60, handlingMinutes: 120 },
    { fromPlace: "Sede B", toPlace: "Sede C", travelMinutes: 60, handlingMinutes: 120 },
    { fromPlace: "Sede B", toPlace: "Sede D", travelMinutes: 500, handlingMinutes: 120 }
  ];
  const plan = planningFor(events, 2, { routeEstimates });
  assert.equal(plan.requiredFleet, exhaustiveFleet(events, { routeEstimates }));
  assert.equal(plan.requiredFleet, 2); assert.equal(plan.rentalPotential, 0);
  assert.ok(plan.routes.some(route => route.fromEventId === "a" && route.toEventId === "d"));
  assert.ok(plan.routes.some(route => route.fromEventId === "b" && route.toEventId === "c"));
});

test("sin existencia no se propone trasladar una unidad ficticia de bodega", () => {
  const events = [event("a", 0, 1), event("b", 4, 5), event("c", 8, 9)];
  const row = rowFor(events, 0);
  assert.equal(row.planning.requiredFleet, 1); assert.equal(row.planning.rentalPotential, 1);
  assert.deepEqual(row.transfers, []); assert.deepEqual(row.planning.routes, []);
  checkAllocationConservation(events, row.planning, 0);
});

test("un trasiego confirmado permanece fijo aunque una ruta alternativa permitiría reutilizar más", () => {
  const events = [event("a", 0, 1), event("middle", 4, 5), event("b", 8, 9)];
  const transfer = { id: "fixed-a-b", status: "confirmed", fromEventId: "a", toEventId: "b", travelMinutes: 0, handlingMinutes: 120,
    items: [{ warehouseInventoryId: "oracle-unit", quantity: 1 }] };
  assert.equal(planningFor(events, 1).requiredFleet, 1);
  const plan = planningFor(events, 1, { transfers: [transfer] });
  assert.equal(plan.requiredFleet, 2); assert.equal(plan.rentalPotential, 1);
  checkAllocationConservation(events, plan, 1);
});

test("las sedes y tiempos de transporte cambian la factibilidad con la misma fecha", () => {
  const origin = event("a", 0, 1, 1, { place: "SALÓN Á" }), destination = event("b", 3, 4, 1, { place: "  salón a " });
  assert.equal(planningFor([origin, destination], 1).requiredFleet, 1);
  destination.place = "Otra sede";
  const slow = { fromPlace: origin.place, toPlace: destination.place, travelMinutes: 61, handlingMinutes: 120 };
  assert.equal(planningFor([origin, destination], 1, { routeEstimates: [slow] }).requiredFleet, 2);
  const fast = { ...slow, travelMinutes: 0 };
  assert.equal(planningFor([origin, destination], 1, { routeEstimates: [fast] }).requiredFleet, 1);
});

test("una unión de renta y bodega mantiene toda la cadena confirmada en la unidad propia", () => {
  // Lexical order deliberately puts the rental predecessor first. A greedy
  // root-first decomposition must not let it consume the owned B→C handoff.
  const events = [event("a-rental", 0, 1), event("z-owned", 0, 1), event("b", 8, 9, 2), event("c", 12, 13)];
  const route = (id, fromEventId, toEventId) => ({ id, status: "confirmed", fromEventId, toEventId, travelMinutes: 0, handlingMinutes: 120,
    items: [{ warehouseInventoryId: "oracle-unit", quantity: 1 }] });
  const plan = planningFor(events, 1, { transfers: [route("fixed-a-b", "z-owned", "b"), route("fixed-b-c", "b", "c")] });
  assert.equal(plan.requiredFleet, 2); assert.equal(plan.rentalPotential, 1);
  assert.equal(plan.physicalConflict, false); assert.equal(plan.mandatoryShortage, 0);
  assert.ok(plan.allocations.some(path => path.source === "warehouse" && path.eventIds.join(",") === "z-owned,b,c"));
  assert.ok(plan.allocations.some(path => path.source === "rental" && path.eventIds.join(",") === "a-rental,b"));
  checkAllocationConservation(events, plan, 1);
});

test("el regreso normal a bodega conserva dos horas de preparación y permite uso posterior", () => {
  const origin = event("a", 0, 1, 1, { equipmentInAt: at(2), endAt: "" });
  assert.equal(planningFor([origin, event("b", 4, 5)], 1).requiredFleet, 1);
  assert.equal(planningFor([origin, event("b", 3.99, 5)], 1).requiredFleet, 2);
});

test("consumibles acumulan compras y nunca se convierten en rutas reutilizables", () => {
  const row = rowFor([event("a", 0, 1, 3), event("b", 4, 5, 2)], 3, {}, "consumible");
  assert.equal(row.required, 5); assert.equal(row.missing, 2); assert.equal(row.action, "COMPRA");
  assert.deepEqual(row.transfers, []);
});

test("los ceros se conservan en el resumen y no crean demanda ni trasiego", () => {
  const events = [event("zero", 0, 1, 0), event("positive", 4, 5, 1)];
  const row = rowFor(events, 1);
  assert.equal(row.eventQuantities.zero, 0); assert.equal(row.planning.requiredFleet, 1);
  assert.ok(!row.transfers.some(route => route.fromEventId === "zero" || route.toEventId === "zero"));
  checkAllocationConservation(events, row.planning, 1);
});
