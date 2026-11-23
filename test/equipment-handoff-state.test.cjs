const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { projectWarehousePayload, mergeWarehousePrivateFields } = require("../live-warehouse-access.cjs");
const { prepareWarehouseSave } = require("../warehouse-ledger.cjs");

// Synthetic operational evidence only. A handoff moves custody, never stock.
const employee = { id: "handoff-employee", username: "handoff-employee", name: "Empleado sintético" };
const movementUser = { ...employee, permissions: ["warehouse.movements"] };
const planner = { id: "handoff-planner", permissions: ["equipment.read"] };
const administrator = { id: "handoff-admin", permissions: ["warehouse.inventory", "warehouse.logs", "warehouse.movements.manage"] };
const now = Date.parse("2026-11-24T16:00:00.000Z");

function handoff() {
  return { id: "handoff-one", transferId: "confirmed-route", fromEventId: "event-a", toEventId: "event-b",
    fromDocumentId: "dispatch-a", toDocumentId: "dispatch-b", itemId: "speaker", itemName: "Altavoz sintético", quantity: 2,
    fromEventName: "Evento A", toEventName: "Evento B", toEventPlace: "Lugar B", expectedReturnAt: "2026-11-25T12:00",
    createdAt: "2026-11-24T15:00:00.000Z", createdBy: { userId: "PRIVATE actor", username: "PRIVATE username" },
    notes: "PRIVATE handoff evidence", attachment: { dataUrl: "PRIVATE attachment" },
    links: [{ sourceMovementId: "out-a", sourceDocumentId: "dispatch-a", sourceEventId: "event-a", parentHandoffId: "", quantity: 2 }] };
}

function inventory() {
  return { savedAt: "2026-11-24T15:00:00.000Z", state: { version: 4, datasetId: "synthetic-handoff-state",
    subtitles: ["AUDIO"], items: [{ id: "speaker", name: "Altavoz sintético", category: "AUDIO", quantity: 5, itemType: "equipo" }],
    movements: [{ id: "out-a", type: "salida", itemId: "speaker", itemName: "Altavoz sintético", quantity: 3,
      sourceDocumentId: "dispatch-a", sourceEventId: "event-a", date: "2026-11-24", dateTime: "2026-11-24T08:00" }],
    equipmentHandoffs: [handoff()], equipmentStockReceipts: [], auditEntries: [{ id: "original-evidence" }], rentalDraft: [], workshopDraft: [] } };
}

function normalizeInInventoryUi(raw) {
  const context = vm.createContext({ window: {}, document: { readyState: "loading", addEventListener() {} } });
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  vm.runInContext(source.replace('  if (document.readyState === "loading") {',
    '  window.normalizeHandoffStateForTest = normalizeState;\n  if (document.readyState === "loading") {'), context);
  return JSON.parse(JSON.stringify(context.window.normalizeHandoffStateForTest(raw)));
}

test("limited warehouse reads preserve custody and original return links without exposing handoff history", () => {
  const current = inventory();
  current.state.equipmentHandoffs[0].links[0].privateEvidence = { notes: "PRIVATE linked evidence" };
  const before = structuredClone(current);
  for (const user of [planner, movementUser]) {
    const projected = projectWarehousePayload(current, user);
    assert.equal(projected.state.equipmentHandoffs.length, 1);
    const record = projected.state.equipmentHandoffs[0];
    assert.equal(record.id, "handoff-one"); assert.equal(record.transferId, "confirmed-route");
    assert.equal(record.fromEventId, "event-a"); assert.equal(record.toEventId, "event-b");
    assert.equal(record.itemId, "speaker"); assert.equal(record.quantity, 2);
    assert.deepEqual(record.links, handoff().links);
    assert.doesNotMatch(JSON.stringify(projected), /PRIVATE/);
    projected.state.equipmentHandoffs[0].links[0].quantity = 999;
    assert.deepEqual(current, before);
  }
});

test("handoff operational evidence survives the actual inventory normalizer", () => {
  const current = inventory(), projected = projectWarehousePayload(current, planner);
  const normalized = normalizeInInventoryUi(projected.state);
  assert.deepEqual(normalized.equipmentHandoffs, projected.state.equipmentHandoffs);
  assert.equal(normalized.movements[0].quantity, 3);
  assert.equal(normalized.items[0].quantity, 5);
  assert.equal(normalized.equipmentHandoffs[0].links[0].sourceMovementId, "out-a");
});

test("clients cannot create, edit or erase server handoffs through a warehouse save, including administrators", () => {
  for (const user of [movementUser, administrator]) {
    const current = inventory(), before = structuredClone(current);
    const candidate = projectWarehousePayload(current, user).state;
    candidate.equipmentHandoffs = [{ ...handoff(), id: "forged-handoff", quantity: 1000, toEventId: "forged-destination" }];
    const merged = mergeWarehousePrivateFields(current.state, candidate, user);
    assert.deepEqual(merged.equipmentHandoffs, current.state.equipmentHandoffs);
    assert.deepEqual(current, before);
    merged.equipmentHandoffs[0].quantity = 999;
    assert.deepEqual(current, before);
  }
});

test("the warehouse ledger retains authoritative custody if a caller omits or tampers with the collection", () => {
  for (const attempt of [undefined, [], [{ ...handoff(), quantity: 999 }]]) {
    const current = inventory(), candidate = structuredClone(current.state);
    if (attempt === undefined) delete candidate.equipmentHandoffs; else candidate.equipmentHandoffs = attempt;
    const saved = prepareWarehouseSave(current, candidate, { actor: employee, permissions: ["warehouse.movements"], enforceMovementOwnership: true }, now);
    assert.deepEqual(saved.state.equipmentHandoffs, current.state.equipmentHandoffs);
    assert.deepEqual(saved.state.movements, current.state.movements);
    assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
    assert.equal(saved.state.items[0].quantity, 5);
    assert.equal(current.state.movements.reduce((total, movement) => total + movement.quantity, 0), 3);
  }
});

function nextHandoff() {
  const entry = handoff();
  return { ...entry, id: "handoff-two", transferId: "confirmed-second-route", toEventId: "event-c", toDocumentId: "dispatch-c",
    toEventName: "Evento C", toEventPlace: "Lugar C", quantity: 1, createdAt: "1900-01-01T00:00:00.000Z",
    createdBy: { userId: "forged-client-author", username: "forged" }, activityExcluded: true,
    links: [{ ...entry.links[0], quantity: 1 }] };
}

test("a server-authorized neutral handoff appends once, records the employee and never adds a stock movement", () => {
  const current = inventory(), before = structuredClone(current), candidate = structuredClone(current.state);
  const saved = prepareWarehouseSave(current, candidate, { actor: employee, permissions: ["warehouse.movements"],
    enforceMovementOwnership: true, source: "requerimiento-equipo", handoffReceipts: [nextHandoff()] }, now);
  assert.equal(saved.state.equipmentHandoffs.length, 2);
  assert.deepEqual(saved.state.equipmentHandoffs[0], current.state.equipmentHandoffs[0]);
  const created = saved.state.equipmentHandoffs[1];
  assert.equal(created.quantity, 1);
  assert.equal(created.createdBy.userId, employee.id);
  assert.equal(created.activityExcluded, undefined);
  assert.equal(created.createdAt, saved.savedAt);
  assert.deepEqual(created.links, nextHandoff().links);
  assert.deepEqual(saved.state.movements, current.state.movements);
  assert.equal(saved.state.items[0].quantity, 5);
  const audits = saved.state.auditEntries.filter(entry => entry.entityType === "handoff");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "trasiego_equipo");
  assert.equal(audits[0].entityId, created.id);
  assert.equal(audits[0].actor.userId, employee.id);
  assert.equal(audits[0].event.id, "event-c");
  assert.equal(audits[0].event.name, "Evento C");
  assert.deepEqual(current, before);
});

test("neutral handoff history follows the reserved developer exemption without exposing its private actor", () => {
  const developer = { id: "live-developer-dgiant", username: "Dgiant", name: "Developer" };
  const current = inventory();
  const saved = prepareWarehouseSave(current, structuredClone(current.state), { actor: developer, permissions: ["warehouse.movements"],
    enforceMovementOwnership: true, source: "requerimiento-equipo", handoffReceipts: [nextHandoff()], developerAuditExempt: true }, now);
  assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
  const record = saved.state.equipmentHandoffs[1];
  assert.equal(record.createdBy.userId, developer.id);
  assert.equal(record.activityExcluded, true);
  for (const user of [planner, administrator, { ...developer, permissions: administrator.permissions }]) {
    const result = projectWarehousePayload(saved, user).state.equipmentHandoffs[1];
    assert.equal(result.quantity, 1); assert.deepEqual(result.links, record.links);
    assert.equal(result.activityExcluded, true); assert.equal(result.createdBy, undefined);
    assert.doesNotMatch(JSON.stringify(result), /Dgiant|live-developer-dgiant/);
  }
});

test("a repeated neutral receipt is idempotent while the same ID cannot change its immutable destination or quantity", () => {
  const current = inventory(), context = { actor: employee, permissions: ["warehouse.movements"], enforceMovementOwnership: true,
    source: "requerimiento-equipo", handoffReceipts: [nextHandoff()] };
  const first = prepareWarehouseSave(current, structuredClone(current.state), context, now);
  const again = prepareWarehouseSave(first, structuredClone(first.state), context, now + 1000);
  assert.deepEqual(again.state.equipmentHandoffs, first.state.equipmentHandoffs);
  assert.deepEqual(again.state.auditEntries, first.state.auditEntries);
  assert.deepEqual(again.state.movements, first.state.movements);
  for (const changed of [{ ...nextHandoff(), quantity: 2 }, { ...nextHandoff(), toEventId: "another-destination" }]) {
    assert.throws(() => prepareWarehouseSave(first, structuredClone(first.state), { ...context, handoffReceipts: [changed] }, now + 1000),
      { statusCode: 409 });
  }
});

test("even a movement administrator cannot remove or repurpose the physical origin of equipment still held by another event", () => {
  const mutations = [
    candidate => { candidate.movements = []; },
    candidate => { candidate.movements[0].quantity = 1; },
    candidate => { candidate.movements[0].itemId = "another-stock-item"; }
  ];
  for (const mutate of mutations) {
    const current = inventory(), candidate = structuredClone(current.state);
    mutate(candidate);
    assert.throws(() => prepareWarehouseSave(current, candidate, { actor: { id: administrator.id, username: "admin" },
      permissions: administrator.permissions, enforceMovementOwnership: true, source: "contabilidad-equipo" }, now),
    { statusCode: 409 });
    assert.equal(current.state.movements[0].quantity, 3);
    assert.equal(current.state.equipmentHandoffs[0].quantity, 2);
  }
});
