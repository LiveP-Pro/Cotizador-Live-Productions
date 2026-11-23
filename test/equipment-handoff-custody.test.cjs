const assert = require("node:assert/strict");
const test = require("node:test");
const Handoffs = require("../equipment-handoffs.js");

// Current, entirely synthetic physical movements and neutral handoff receipts.
const clone = value => structuredClone(value);
function fixture(quantity = 3) {
  return { items: [{ id: "stock-synthetic", name: "Equipo sintético", itemType: "equipo", quantity: 10 }],
    movements: [{ id: "out-A", type: "salida", itemId: "stock-synthetic", quantity,
      sourceEventId: "A", sourceDocumentId: "document-A", sourceEventName: "Evento A", sourceEventPlace: "Lugar A",
      dateTime: "2026-12-01T08:00", createdAt: "2026-11-23T12:00:00Z", sourceLineKey: "line-A" }], equipmentHandoffs: [] };
}
function receipt(id = "handoff-AB", from = "A", to = "B", quantity = 2, parent = "", movement = "out-A") {
  return { id, transferId: `transfer-${from}-${to}`, fromEventId: from, toEventId: to,
    fromDocumentId: `document-${from}`, toDocumentId: `document-${to}`, toEventName: `Evento ${to}`, toEventPlace: `Lugar ${to}`,
    itemId: "stock-synthetic", quantity, createdAt: "2026-11-23T13:00:00Z",
    links: [{ sourceMovementId: movement, sourceDocumentId: "document-A", sourceEventId: "A", parentHandoffId: parent, quantity }] };
}
function returned(id, quantity, handoffId = "", root = "out-A") {
  return { id, type: "ingreso_evento", itemId: "stock-synthetic", quantity, relatedMovementId: root,
    sourceDocumentId: "document-A", sourceEventId: "A", sourceLineKey: handoffId ? Handoffs.makeReturnKey(handoffId) : "line-A",
    dateTime: "2026-12-10T12:00", createdAt: "2026-12-10T18:00:00Z" };
}
const holder = (state, event) => Handoffs.getCustodyRecords(state).filter(record => record.holderEventId === event);
const remaining = (state, event) => holder(state, event).reduce((sum, record) => sum + record.remainingQuantity, 0);

test("a neutral handoff partitions one physical exit without changing the source ledger", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt());
  const before = JSON.stringify(state), records = Handoffs.getCustodyRecords(state);
  assert.equal(remaining(state, "A"), 1); assert.equal(remaining(state, "B"), 2);
  assert.equal(records.reduce((sum, record) => sum + record.initialQuantity, 0), 3);
  assert.equal(records.reduce((sum, record) => sum + record.remainingQuantity, 0), 3);
  const b = holder(state, "B")[0];
  assert.notEqual(b.id, "out-A"); assert.equal(b.movement.id, b.id);
  assert.equal(b.rootMovementId, "out-A"); assert.equal(b.rootMovement.quantity, 3);
  assert.equal(b.movement.sourceDocumentId, "document-B"); assert.equal(b.rootMovement.sourceDocumentId, "document-A");
  assert.equal(b.receivedQuantity, 2); assert.equal(b.transferredQuantity, 0);
  assert.equal(JSON.stringify(state), before);
});

test("incoming allocations are bounded by the physical portion still held by the source event", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt()); const before = JSON.stringify(state);
  const a = Handoffs.allocateIncoming({ state, fromEventId: "A", itemId: "stock-synthetic", quantity: 10 });
  const b = Handoffs.allocateIncoming({ state, fromEventId: "B", itemId: "stock-synthetic", quantity: 10 });
  assert.equal(a[0].quantity, 1); assert.equal(a[0].parentHandoffId, "");
  assert.equal(b[0].quantity, 2); assert.equal(b[0].parentHandoffId, "handoff-AB");
  assert.equal(b[0].sourceMovementId, "out-A"); assert.equal(b[0].sourceDocumentId, "document-A");
  assert.deepEqual(Handoffs.allocateIncoming({ state, fromEventId: "B", fromDocumentId: "stale-document", itemId: "stock-synthetic", quantity: 2 }), []);
  assert.equal(JSON.stringify(state), before);
});

test("splits and chained transfers retain original movement provenance without reusing a unit twice", () => {
  const state = fixture();
  state.equipmentHandoffs.push(receipt(), receipt("handoff-BC", "B", "C", 1, "handoff-AB"));
  assert.equal(remaining(state, "A"), 1); assert.equal(remaining(state, "B"), 1); assert.equal(remaining(state, "C"), 1);
  const c = Handoffs.allocateIncoming({ state, fromEventId: "C", itemId: "stock-synthetic", quantity: 5 });
  assert.equal(c[0].parentHandoffId, "handoff-BC"); assert.equal(c[0].sourceMovementId, "out-A"); assert.equal(c[0].quantity, 1);
  const split = fixture(); split.equipmentHandoffs.push(receipt("handoff-AB", "A", "B", 1), receipt("handoff-AC", "A", "C", 2));
  assert.equal(remaining(split, "A"), 0); assert.equal(remaining(split, "B"), 1); assert.equal(remaining(split, "C"), 2);
  assert.deepEqual(Handoffs.allocateIncoming({ state: split, fromEventId: "A", itemId: "stock-synthetic", quantity: 1 }), []);
});

test("handoff ordering follows parent links and remains deterministic for equal timestamps", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt("handoff-BC", "B", "C", 1, "handoff-AB"), receipt());
  const first = Handoffs.getCustodyRecords(state), second = Handoffs.getCustodyRecords(clone(state));
  assert.deepEqual(second, first); assert.equal(remaining(state, "C"), 1);
});

test("partial returns at each holder release only real returned units against the original exit", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt(), receipt("handoff-BC", "B", "C", 1, "handoff-AB"));
  state.movements.push(returned("return-A", 1), returned("return-B", 1, "handoff-AB"));
  assert.equal(remaining(state, "A"), 0); assert.equal(remaining(state, "B"), 0); assert.equal(remaining(state, "C"), 1);
  state.movements.push(returned("return-C", 1, "handoff-BC"));
  assert.equal(Handoffs.getCustodyRecords(state).reduce((sum, record) => sum + record.remainingQuantity, 0), 0);
  assert.deepEqual(Handoffs.allocateIncoming({ state, fromEventId: "C", itemId: "stock-synthetic", quantity: 1 }), []);
});

test("the origin cannot return portions already transferred and the destination cannot over-return", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt());
  for (const movement of [returned("over-origin", 2), returned("over-destination", 3, "handoff-AB")]) {
    const invalid = clone(state); invalid.movements.push(movement);
    assert.throws(() => Handoffs.getCustodyRecords(invalid), /supera el equipo/);
  }
});

test("forged return tags, roots and destination document IDs never release transferred units", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt());
  for (const movement of [returned("unknown-tag", 1, "handoff-nonexistent"), returned("wrong-root", 1, "handoff-AB", "out-unrelated"),
    { ...returned("wrong-doc", 1, "handoff-AB"), sourceDocumentId: "document-B" },
    { ...returned("wrong-item", 1, "handoff-AB"), itemId: "other-stock" }]) {
    const invalid = clone(state); invalid.movements.push(movement);
    assert.throws(() => Handoffs.getCustodyRecords(invalid), /salida original/);
  }
});

test("untagged returns of an original with handoffs still preserve its physical item and document", () => {
  const state = fixture(); state.equipmentHandoffs.push(receipt());
  for (const movement of [{ ...returned("wrong-item", 1), itemId: "different-item" },
    { ...returned("wrong-document", 1), sourceDocumentId: "document-B" }, returned("virtual-related", 1, "", "handoff:handoff-AB:out-A")]) {
    const invalid = clone(state); invalid.movements.push(movement);
    assert.throws(() => Handoffs.getCustodyRecords(invalid), /salida original/);
  }
});

test("duplicate receipts, duplicated links, missing provenance and impossible chains reject all new credit", () => {
  const state = fixture();
  const cases = [
    [receipt(), receipt()],
    [receipt(), receipt("handoff-AC", "A", "C", 2)],
    [{ ...receipt(), quantity: 4, links: [...receipt().links, ...receipt().links] }],
    [{ ...receipt(), links: [{ ...receipt().links[0], sourceMovementId: "missing" }] }],
    [{ ...receipt(), links: [{ ...receipt().links[0], sourceDocumentId: "forged-doc" }] }],
    [receipt("handoff-BC", "B", "C", 1, "handoff-missing")],
    [receipt(), receipt("handoff-BA", "B", "A", 1, "handoff-AB")],
    [receipt("handoff-BC", "B", "C", 1, "handoff-CB"), receipt("handoff-CB", "C", "B", 1, "handoff-BC")]
  ];
  for (const handoffs of cases) {
    const invalid = clone(state); invalid.equipmentHandoffs = handoffs;
    assert.throws(() => Handoffs.allocateIncoming({ state: invalid, fromEventId: "A", itemId: "stock-synthetic", quantity: 1 }), error => error.statusCode === 409);
  }
  const unreadable = clone(state); unreadable.equipmentHandoffs = {};
  assert.throws(() => Handoffs.getCustodyRecords(unreadable), error => error.statusCode === 409);
  assert.throws(() => Handoffs.validateReturns(unreadable, clone(unreadable)), error => error.statusCode === 409);
});

test("unmatched external requests and consumables cannot create handoff credits", () => {
  for (const change of [state => { state.movements[0].sourceUnmatched = true; }, state => { state.movements[0].procurementChoice = "rent"; },
    state => { state.movements[0].type = "consumo"; }, state => { state.items[0].itemType = "consumible"; }, state => { state.items[0].archived = true; }]) {
    const state = fixture(); change(state);
    assert.deepEqual(Handoffs.allocateIncoming({ state, fromEventId: "A", itemId: "stock-synthetic", quantity: 3 }), []);
  }
  const archived = fixture(); archived.items[0].archived = true;
  assert.equal(remaining(archived, "A"), 3, "archival never erases the real pending return");
  const ambiguous = fixture(); ambiguous.items.push(clone(ambiguous.items[0]));
  assert.deepEqual(Handoffs.allocateIncoming({ state: ambiguous, fromEventId: "A", itemId: "stock-synthetic", quantity: 1 }), []);
});

test("already returned source stock cannot be promised again", () => {
  const state = fixture(); state.movements.push(returned("all-returned", 3));
  assert.deepEqual(Handoffs.allocateIncoming({ state, fromEventId: "A", itemId: "stock-synthetic", quantity: 3 }), []);
});

test("legacy returns without handoffs retain original document FIFO matching", () => {
  const state = fixture(2); delete state.equipmentHandoffs;
  state.movements.push({ ...clone(state.movements[0]), id: "out-A-second", quantity: 3, dateTime: "2026-12-02T08:00" });
  state.movements.push({ ...returned("legacy-return", 4), relatedMovementId: "" });
  assert.equal(remaining(state, "A"), 1);
  assert.equal(Handoffs.validateReturns(state, clone(state)), true);
});

test("new returns validate against immutable server handoffs and original physical identities", () => {
  const previous = fixture(); previous.equipmentHandoffs.push(receipt());
  const next = clone(previous); next.movements.push(returned("valid-return-B", 2, "handoff-AB"));
  assert.equal(Handoffs.validateReturns(previous, next), true);
  const metadata = clone(previous); metadata.movements[0].sourcePdfUrl = "/synthetic-new.pdf";
  assert.equal(Handoffs.validateReturns(previous, metadata), true);
  for (const mutation of [value => { value.movements = []; }, value => { value.movements[0].quantity = 1; },
    value => { value.movements[0].itemId = "different"; }, value => { value.movements[0].sourceEventId = "forged"; },
    value => { value.equipmentHandoffs[0].quantity = 1; }, value => { value.equipmentHandoffs = []; }]) {
    const invalid = clone(previous); mutation(invalid);
    assert.throws(() => Handoffs.validateReturns(previous, invalid), error => error.statusCode === 409);
  }
});

test("multiple original exits join at one event without losing individual return links", () => {
  const state = fixture(1);
  state.movements.push({ ...clone(state.movements[0]), id: "out-A-second", quantity: 2, dateTime: "2026-12-02T08:00" });
  const links = Handoffs.allocateIncoming({ state, fromEventId: "A", itemId: "stock-synthetic", quantity: 3 });
  state.equipmentHandoffs.push({ ...receipt(), quantity: 3, links });
  assert.equal(holder(state, "B").length, 2);
  assert.equal(new Set(holder(state, "B").map(record => record.id)).size, 2);
  state.movements.push(returned("return-first-root", 1, "handoff-AB"), returned("return-second-root", 2, "handoff-AB", "out-A-second"));
  assert.equal(remaining(state, "B"), 0);
});

test("neutral transfer actor metadata never replaces the ownership of the original movement", () => {
  const state = fixture(); state.movements[0].createdBy = { userId: "origin-user" }; state.movements[0].activityExcluded = true;
  state.equipmentHandoffs.push({ ...receipt(), createdBy: { userId: "handoff-user" } });
  const b = holder(state, "B")[0];
  assert.equal(b.movement.createdBy.userId, "handoff-user"); assert.equal(b.movement.activityExcluded, false);
  assert.equal(b.rootMovement.createdBy.userId, "origin-user"); assert.equal(b.rootMovement.activityExcluded, true);
  delete state.equipmentHandoffs[0].createdBy;
  assert.equal(holder(state, "B")[0].movement.createdBy, undefined, "unknown handoff ownership never inherits the original employee");
});

test("destination custody shows its own event and expected return dates while retaining original provenance", () => {
  const state = fixture();
  state.movements[0].sourceEventDate = "2026-12-01";
  state.movements[0].sourceExpectedReturnAt = "2026-12-02T01:00";
  state.equipmentHandoffs.push({ ...receipt(), toEventDate: "2026-12-03", toExpectedReturnAt: "2026-12-04T06:00" });
  const b = holder(state, "B")[0];
  assert.equal(b.movement.sourceEventDate, "2026-12-03"); assert.equal(b.movement.sourceExpectedReturnAt, "2026-12-04T06:00");
  assert.equal(b.rootMovement.sourceEventDate, "2026-12-01"); assert.equal(b.rootMovement.sourceExpectedReturnAt, "2026-12-02T01:00");
  delete state.equipmentHandoffs[0].toEventDate; delete state.equipmentHandoffs[0].toExpectedReturnAt;
  assert.equal(holder(state, "B")[0].movement.sourceExpectedReturnAt, "2026-12-02T01:00", "older receipts keep a readable original fallback");
});

test("return keys preserve stable receipt identity without accepting malformed tags", () => {
  assert.equal(Handoffs.parseReturnKey(Handoffs.makeReturnKey("handoff-AB")), "handoff-AB");
  assert.equal(Handoffs.parseReturnKey("ordinary-line"), "");
  assert.throws(() => Handoffs.parseReturnKey("handoff-return:"), error => error.statusCode === 409);
  assert.throws(() => Handoffs.makeReturnKey("unsafe/identifier"), error => error.statusCode === 409);
});
