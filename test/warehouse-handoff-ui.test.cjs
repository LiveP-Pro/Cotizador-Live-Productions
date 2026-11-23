const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const EquipmentHandoffs = require("../equipment-handoffs.js");

const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  return { items: [{ id: "speaker", name: "Bocina sintética", category: "AUDIO", itemType: "equipo", quantity: 5 },
    { id: "tape", name: "Cinta sintética", category: "INSUMOS", itemType: "consumible", quantity: 10 }],
  movements: [{ id: "original-out", type: "salida", itemId: "speaker", itemName: "Bocina sintética", quantity: 3,
    dateTime: "2026-11-25T08:00", createdAt: "2026-11-25T14:00:00Z", sourceType: "requerimiento-equipo",
    sourceDocumentId: "document-a", sourceEventId: "event-a", sourceEventName: "Evento A", reference: "Evento A" },
    { id: "consume-a", type: "consumo", itemId: "tape", itemName: "Cinta sintética", quantity: 2, sourceDocumentId: "document-a", sourceEventName: "Evento A" },
    { id: "consume-b", type: "consumo", itemId: "tape", itemName: "Cinta sintética", quantity: 3, sourceDocumentId: "document-b", sourceEventName: "Evento B" }],
  equipmentHandoffs: [{ id: "handoff-ab", transferId: "route-ab", fromEventId: "event-a", toEventId: "event-b", fromDocumentId: "document-a",
    toDocumentId: "document-b", fromEventName: "Evento A", toEventName: "Evento B", toEventPlace: "Lugar B", itemId: "speaker", itemName: "Bocina sintética",
    quantity: 2, createdAt: "2026-11-26T08:00:00Z", links: [{ sourceMovementId: "original-out", sourceDocumentId: "document-a", sourceEventId: "event-a", parentHandoffId: "", quantity: 2 }] }] };
}
function harness(input = fixture()) {
  const field = () => ({ textContent: "", innerHTML: "", dataset: {}, classList: { add() {}, remove() {} }, focus() {} });
  const fields = { status: field(), eventsBoard: field(), dialogTitle: field(), dialogSaveButton: field(), dialogBody: field(),
    dialog: { showModal() {}, close() {}, classList: { add() {}, remove() {} } } };
  fields.dialogBody.querySelector = selector => ({ value: selector === "#dialogDateTime" ? "2026-11-28T10:00" : "Prueba de devolución" });
  let sequence = 0;
  const context = vm.createContext({ window: { EquipmentHandoffs, location: { protocol: "https:" },
    crypto: { randomUUID: () => `synthetic-${++sequence}` }, requestAnimationFrame(callback) { callback(); },
    setTimeout() { return 1; }, clearTimeout() {}, localStorage: { setItem() {} }, confirm() { throw new Error("A return cannot require extra stock"); } },
  document: { readyState: "loading", addEventListener() {}, querySelector() { return null; }, dispatchEvent() {} },
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } });
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  vm.runInContext(source.replace('  if (document.readyState === "loading") {', `
    window.handoffUi = {
      initialize(input, fields) { state=normalizeState(input); Object.assign(elements,fields); warehouseReady=true; renderAll=()=>{}; switchWindow=()=>{}; },
      records() { return movementLifecycleRecords('salida','ingreso_evento'); },
      apply(payload) { return applyManualWarehouseMovement({itemId:'speaker',quantity:1,responsible:'Empleado sintético',reason:'Devolución real',dateTime:'2026-11-28T10:00',...payload}); },
      snapshot() { return JSON.parse(JSON.stringify(state)); },
      stats(id) { return statsForItem(itemById(id)); },
      renderEventsBoard, openEventReturnDialog, saveDialog
    };
  ` + '  if (document.readyState === "loading") {'), context);
  context.window.handoffUi.initialize(input, fields);
  return { api: context.window.handoffUi, fields, context };
}

test("event B receives the same physical units and returns them against original A once", () => {
  const h = harness(), initial = plain(h.api.snapshot());
  const records = plain(h.api.records()), original = records.find(record => !record.handoffId), received = records.find(record => record.handoffId === "handoff-ab");
  assert.equal(original.remainingQuantity, 1); assert.equal(received.remainingQuantity, 2);
  assert.equal(h.api.stats("speaker").physical, 2);
  assert.throws(() => h.api.apply({ type: "ingreso_evento", quantity: 2, relatedMovementId: original.movement.id }), /Solo quedan 1/);
  h.api.apply({ type: "ingreso_evento", quantity: 2, relatedMovementId: received.movement.id });
  const returned = plain(h.api.snapshot()).movements.at(-1);
  assert.equal(returned.relatedMovementId, "original-out"); assert.equal(returned.sourceDocumentId, "document-a");
  assert.equal(returned.sourceEventId, "event-a"); assert.equal(returned.sourceLineKey, "handoff-return:handoff-ab");
  assert.equal(h.api.stats("speaker").physical, 4);
  assert.throws(() => h.api.apply({ type: "ingreso_evento", quantity: 1, relatedMovementId: received.movement.id }), /movimiento pendiente/);
  h.api.apply({ type: "ingreso_evento", quantity: 1, relatedMovementId: original.movement.id });
  assert.equal(h.api.stats("speaker").physical, 5); assert.equal(h.api.stats("speaker").out, 0);
  assert.deepEqual(plain(h.api.snapshot()).equipmentHandoffs, initial.equipmentHandoffs);
  assert.equal(h.api.stats("tape").consumed, 5, "each event consumes its own supplies");
});

test("split and continuing handoffs expose only the portion currently held by each event", () => {
  const input = fixture();
  input.equipmentHandoffs.push({ id: "handoff-bc", transferId: "route-bc", fromEventId: "event-b", toEventId: "event-c", fromDocumentId: "document-b", toDocumentId: "document-c",
    toEventName: "Evento C", itemId: "speaker", quantity: 1, createdAt: "2026-11-27T08:00:00Z", links: [{ sourceMovementId: "original-out", sourceDocumentId: "document-a", sourceEventId: "event-a", parentHandoffId: "handoff-ab", quantity: 1 }] });
  const h = harness(input), records = plain(h.api.records());
  assert.deepEqual(records.map(record => [record.holderEventId, record.remainingQuantity]).sort(), [["event-a", 1], ["event-b", 1], ["event-c", 1]]);
  for (const record of records) h.api.apply({ type: "ingreso_evento", quantity: 1, relatedMovementId: record.movement.id });
  assert.equal(h.api.stats("speaker").out, 0); assert.equal(h.api.stats("speaker").physical, 5);
  assert.ok(plain(h.api.snapshot()).movements.filter(movement => movement.type === "ingreso_evento").every(movement => movement.relatedMovementId === "original-out"));
});

test("the event board names a transfer receipt without inventing a second warehouse exit", async () => {
  const h = harness(); h.api.renderEventsBoard();
  const board = h.fields.eventsBoard.innerHTML;
  assert.match(board, /Recibió por trasiego: 2/); assert.match(board, /Recibido por trasiego desde Evento A/);
  assert.match(board, /Salió de bodega: 0 · Recibió por trasiego: 2/);
  assert.match(board, /data-return-event="cuadro:document-b"/);
  assert.equal(plain(h.api.snapshot()).movements.filter(movement => movement.type === "salida").length, 1);
  h.api.openEventReturnDialog("cuadro:document-b"); await h.api.saveDialog();
  assert.equal(h.api.stats("speaker").out, 1);
  const returned = plain(h.api.snapshot()).movements.at(-1);
  assert.equal(returned.quantity, 2); assert.equal(returned.sourceLineKey, "handoff-return:handoff-ab");
  assert.equal(returned.relatedMovementId, "original-out");
});

test("missing custody support or an invalid chain disables returns instead of releasing forwarded stock", () => {
  const h = harness(); h.context.window.EquipmentHandoffs = null;
  assert.deepEqual(plain(h.api.records()), []); assert.match(h.fields.status.textContent, /Actualice la página/);
  const invalid = fixture(); invalid.equipmentHandoffs[0].links[0].quantity = 9;
  const broken = harness(invalid); assert.deepEqual(plain(broken.api.records()), []);
  assert.equal(broken.api.stats("speaker").physical, 2); assert.equal(broken.api.stats("speaker").out, 3);
});
