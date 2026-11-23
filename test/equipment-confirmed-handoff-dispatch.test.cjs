const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const vm = require("node:vm");
const test = require("node:test");
const EquipmentIdentity = require("../equipment-identity.js");
const EquipmentHandoffs = require("../equipment-handoffs.js");
const { calculateEquipmentAvailability } = require("../equipment-event-store.cjs");
const { prepareWarehouseSave } = require("../warehouse-ledger.cjs");

// Current synthetic records only. All writes below replace an in-memory value;
// no production inventory, accounts, service file, or generated PDF is touched.
function harness({ stock = 8, needs = { A: 3, B: 2, C: 2 }, routes = [["A", "B", 2]], consumables = {} } = {}) {
  let inventory = { savedAt: "2026-11-23T12:00:00.000Z", state: { items: [
    { id: "unit", name: "Unidad sintética", category: "Audio sintético", itemType: "equipo", quantity: stock },
    { id: "supply", name: "Consumible sintético", category: "Insumos sintéticos", itemType: "consumible", quantity: 30 }
  ], movements: [], equipmentHandoffs: [] } };
  const events = Object.entries(needs).map(([id, quantity], index) => ({ id, status: "confirmed", name: `Evento ${id}`, place: `Lugar ${id}`,
    date: `2026-12-0${index + 1}`, setupAt: `2026-12-0${index + 1}T08:00`, startAt: `2026-12-0${index + 1}T12:00`, endAt: `2026-12-0${index + 1}T20:00`,
    equipmentInAt: "2026-12-07T10:00", warehouseDispatchId: `document-${id}`, sections: [{ title: "Audio sintético", items: [
      { warehouseInventoryId: "unit", description: "Unidad sintética", quantity },
      ...(consumables[id] ? [{ warehouseInventoryId: "supply", description: "Consumible sintético", quantity: consumables[id] }] : [])
    ] }] }));
  const transfers = routes.map(([fromEventId, toEventId, quantity], index) => ({ id: `route-${index}`, status: "confirmed", fromEventId, toEventId,
    travelMinutes: 60, handlingMinutes: 120, items: [{ warehouseInventoryId: "unit", quantity }] }));
  let writes = 0;
  const actor = { id: "synthetic-receiver", userId: "synthetic-receiver", username: "synthetic.receiver", name: "Receptor sintético" };
  const context = vm.createContext({ crypto, Date, Map, Set, console, EquipmentIdentity, EquipmentHandoffs, calculateEquipmentAvailability,
    equipmentEventStore: { readEvents: () => structuredClone({ events, transfers }) },
    readWarehouseInventory: () => structuredClone(inventory), warehouseAuditActor: () => actor,
    async writeWarehouseInventory(saved, options) {
      const prepared = prepareWarehouseSave(inventory, saved.state, { ...options, actor });
      Object.assign(saved, prepared); inventory = structuredClone(prepared); writes++;
    } });
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.indexOf("function warehouseDispatchLookupKey("), end = source.indexOf("async function saveEquipmentBoard(", start);
  vm.runInContext(source.slice(start, end), context, { filename: "server-dispatch.js" });
  async function dispatch(id, options = {}) {
    const event = events.find(event => event.id === id);
    const items = structuredClone(options.items || event.sections[0].items);
    const editable = { mode: "full", savedAt: "2026-11-23T12:00:00.000Z", warehouseDispatch: {
      id: options.documentId || event.warehouseDispatchId, eventId: id, name: event.name, place: event.place,
      eventDate: event.date, equipmentOutAt: event.setupAt, equipmentInAt: event.equipmentInAt, items,
      // Client-supplied credits are not evidence and must never be consulted.
      ...(options.client || {}) } };
    return JSON.parse(JSON.stringify(await context.receiveEquipmentBoardInWarehouse(editable,
      { fileName: `${id}-${options.reprint || 1}.pdf`, pdfUrl: `/synthetic/${id}.pdf` }, {})));
  }
  function returnUnits(movementId, quantity, handoffId = "") {
    const before = structuredClone(inventory), next = structuredClone(inventory.state);
    const root = next.movements.find(movement => movement.id === movementId);
    next.movements.push({ id: `return-${next.movements.length}`, type: "ingreso_evento", itemId: root.itemId, itemName: root.itemName, quantity,
      relatedMovementId: root.id, sourceDocumentId: root.sourceDocumentId, sourceEventId: root.sourceEventId,
      sourceLineKey: handoffId ? EquipmentHandoffs.makeReturnKey(handoffId) : "", dateTime: "2026-12-08T10:00", createdAt: "2026-12-08T16:00:00.000Z" });
    inventory = structuredClone(prepareWarehouseSave(before, next, { actor, source: "synthetic-real-return" }));
  }
  return { dispatch, returnUnits, events, transfers,
    state: () => structuredClone(inventory.state), writes: () => writes,
    out: (itemId = "unit") => inventory.state.movements.filter(movement => movement.itemId === itemId)
      .reduce((sum, movement) => sum + (movement.type === "salida" ? 1 : movement.type === "ingreso_evento" ? -1 : 0) * movement.quantity, 0),
    consumed: () => inventory.state.movements.filter(movement => movement.itemId === "supply" && movement.type === "consumo").reduce((sum, movement) => sum + movement.quantity, 0),
    setState: value => { inventory = { state: structuredClone(value), savedAt: inventory.savedAt }; } };
}

test("el equipo confirmado A→B conserva una sola salida física y un recibo enlazado al movimiento original", async () => {
  const h = harness({ stock: 5 }); h.events.find(event => event.id === "B").equipmentInAt = "2026-12-08T11:00";
  await h.dispatch("A");
  const original = h.state().movements.find(movement => movement.itemId === "unit");
  const result = await h.dispatch("B");
  assert.equal(h.out(), 3); assert.equal(result.warehouseReceipt.mappedQuantity, 0);
  assert.equal(result.warehouseReceipt.handoffQuantity, 2);
  assert.equal(h.state().movements.filter(movement => movement.type === "salida" && movement.itemId === "unit").length, 1);
  const [receipt] = h.state().equipmentHandoffs;
  assert.equal(receipt.toEventId, "B"); assert.equal(receipt.quantity, 2);
  assert.equal(receipt.fromEventName, "Evento A"); assert.equal(receipt.itemName, "Unidad sintética");
  assert.equal(receipt.links[0].sourceMovementId, original.id);
  assert.equal(receipt.links[0].sourceDocumentId, "document-A");
  assert.equal(receipt.createdBy.userId, "synthetic-receiver");
  const received = EquipmentHandoffs.getCustodyRecords(h.state()).find(record => record.handoffId === receipt.id);
  assert.equal(received.movement.sourceEventDate, "2026-12-02");
  assert.equal(received.movement.sourceExpectedReturnAt, "2026-12-08T11:00");
  assert.equal(received.rootMovement.sourceExpectedReturnAt, "2026-12-07T10:00");
  assert.equal(h.state().movements.some(movement => movement.type === "ingreso_evento"), false);
});

test("el destino solo pide a bodega la cantidad adicional y conserva consumo completo por evento", async () => {
  const h = harness({ stock: 8, needs: { A: 2, B: 5 }, consumables: { A: 2, B: 3 } });
  await h.dispatch("A"); const result = await h.dispatch("B");
  assert.equal(h.out(), 5); assert.equal(h.consumed(), 5);
  assert.equal(result.warehouseReceipt.handoffQuantity, 2);
  assert.equal(h.state().movements.filter(movement => movement.type === "salida" && movement.sourceEventId === "B").reduce((sum, movement) => sum + movement.quantity, 0), 3);
  assert.equal(h.state().equipmentHandoffs.some(receipt => receipt.itemId === "supply"), false);
});

test("reimprimir conserva IDs, recibos y distribución física aunque cambie después la disponibilidad del origen", async () => {
  const h = harness(); await h.dispatch("A"); await h.dispatch("B");
  const before = h.state(), ids = before.movements.map(movement => movement.id);
  const result = await h.dispatch("B", { reprint: 2 });
  assert.equal(result.warehouseReceipt.locked, true);
  assert.deepEqual(h.state().movements.map(movement => movement.id), ids);
  assert.deepEqual(h.state().equipmentHandoffs, before.equipmentHandoffs);
  assert.equal(h.out(), 3);
  const other = harness(); await other.dispatch("B"); await other.dispatch("A");
  const original = other.state().movements.map(movement => [movement.id, movement.quantity]);
  await other.dispatch("B", { reprint: 2 });
  assert.deepEqual(other.state().movements.map(movement => [movement.id, movement.quantity]), original);
  assert.equal(other.state().equipmentHandoffs.length, 0); assert.equal(other.out(), 5);
});

test("una cadena y una división conservan las porciones físicas sin reutilizarlas dos veces", async () => {
  const h = harness({ routes: [["A", "B", 2], ["B", "C", 2]] });
  await h.dispatch("A"); await h.dispatch("B"); await h.dispatch("C");
  assert.equal(h.out(), 3); assert.equal(h.state().equipmentHandoffs.length, 2);
  const [first, second] = h.state().equipmentHandoffs;
  assert.equal(second.links[0].sourceMovementId, first.links[0].sourceMovementId);
  assert.equal(second.links[0].parentHandoffId, first.id);
  assert.equal(EquipmentHandoffs.getCustodyRecords(h.state()).reduce((sum, record) => sum + record.remainingQuantity, 0), 3);
  const split = harness({ stock: 8, needs: { A: 4, B: 2, C: 2 }, routes: [["A", "B", 2], ["A", "C", 2]] });
  await split.dispatch("A", { items: [{ warehouseInventoryId: "unit", description: "Unidad sintética", quantity: 3 }] });
  await split.dispatch("B"); await split.dispatch("C");
  assert.deepEqual(split.state().equipmentHandoffs.map(receipt => receipt.quantity), [2, 1]);
  assert.equal(split.out(), 4);
});

test("los retornos reales se enlazan al origen y cierran todas las porciones una sola vez", async () => {
  const h = harness(); await h.dispatch("A"); await h.dispatch("B");
  const [receipt] = h.state().equipmentHandoffs, originalId = receipt.links[0].sourceMovementId;
  assert.throws(() => h.returnUnits(originalId, 3), /trasiego|permanece|supera/);
  h.returnUnits(originalId, 2, receipt.id); assert.equal(h.out(), 1);
  h.returnUnits(originalId, 1); assert.equal(h.out(), 0);
  assert.throws(() => h.returnUnits(originalId, 1, receipt.id), /supera|permanece|regres/);
  const before = h.state().movements.map(movement => movement.id);
  await h.dispatch("B", { reprint: 2 });
  assert.deepEqual(h.state().movements.map(movement => movement.id), before); assert.equal(h.out(), 0);
});

test("sin ruta confirmada vigente o sin salida física pendiente no se acredita un trasiego", async () => {
  for (const status of ["cancelled", "proposed", "missing", "invalid", "fractional", "returned", "unissued"]) {
    const h = harness();
    if (status !== "unissued") await h.dispatch("A");
    if (status === "cancelled" || status === "proposed") h.transfers[0].status = status;
    if (status === "missing") h.transfers.length = 0;
    if (status === "invalid") h.transfers[0].items[0].quantity = 20;
    if (status === "fractional") h.transfers[0].items[0].quantity = 1.5;
    if (status === "returned") h.returnUnits(h.state().movements.find(movement => movement.itemId === "unit").id, 3);
    const result = await h.dispatch("B", { client: { handoffQuantity: 999, incomingTransfers: [{ quantity: 999 }] } });
    assert.equal(result.warehouseReceipt.handoffQuantity, 0, status);
    assert.equal(h.state().equipmentHandoffs.length, 0, status);
  }
});

test("una devolución parcial limita el crédito y una decisión de renta externa no reclama unidades propias", async () => {
  const h = harness(); await h.dispatch("A");
  h.returnUnits(h.state().movements.find(movement => movement.itemId === "unit").id, 2);
  const result = await h.dispatch("B"); assert.equal(result.warehouseReceipt.handoffQuantity, 1);
  assert.equal(h.out(), 2);
  const external = harness(); await external.dispatch("A");
  const rented = await external.dispatch("B", { items: [{ warehouseInventoryId: "unit", description: "Unidad sintética", quantity: 2, procurementChoice: "rent" }] });
  assert.equal(rented.warehouseReceipt.handoffQuantity, 0); assert.equal(external.out(), 3);
});

test("un cuadro con trasiego no cambia cantidades ni crea otra recepción usando un ID distinto", async () => {
  const h = harness(); await h.dispatch("A"); await h.dispatch("B");
  const before = JSON.stringify(h.state()), writes = h.writes();
  await assert.rejects(h.dispatch("B", { items: [{ warehouseInventoryId: "unit", description: "Unidad sintética", quantity: 3 }] }), /salida física|trasiego/);
  await assert.rejects(h.dispatch("B", { documentId: "fake-new-document" }), /identificador|cuadro guardado|otro cuadro/);
  assert.equal(JSON.stringify(h.state()), before); assert.equal(h.writes(), writes);
  const ids = h.state().movements.map(movement => movement.id);
  h.transfers[0].status = "cancelled";
  await h.dispatch("B", { reprint: 3 });
  assert.deepEqual(h.state().movements.map(movement => movement.id), ids); assert.equal(h.out(), 3);
});

test("un evento antiguo sin warehouseDispatchId queda vinculado al primer cuadro que recibió el trasiego", async () => {
  const h = harness(); delete h.events.find(event => event.id === "B").warehouseDispatchId;
  await h.dispatch("A"); await h.dispatch("B", { documentId: "legacy-document-B" });
  const before = JSON.stringify(h.state()), writes = h.writes();
  await assert.rejects(h.dispatch("B", { documentId: "another-document-B" }), /otro cuadro|cuadro original/);
  assert.equal(JSON.stringify(h.state()), before); assert.equal(h.writes(), writes);
  const ids = h.state().movements.map(movement => movement.id);
  await h.dispatch("B", { documentId: "legacy-document-B", reprint: 2 });
  assert.deepEqual(h.state().movements.map(movement => movement.id), ids);
  assert.equal(h.state().equipmentHandoffs.length, 1); assert.equal(h.out(), 3);
});

test("una salida propia previa también vincula el cuadro antiguo antes de que exista una recepción por trasiego", async () => {
  const h = harness(); delete h.events.find(event => event.id === "B").warehouseDispatchId;
  await h.dispatch("B", { documentId: "original-physical-B" });
  await h.dispatch("A");
  assert.equal(h.state().equipmentHandoffs.length, 0);
  const before = JSON.stringify(h.state()), writes = h.writes();
  await assert.rejects(h.dispatch("B", { documentId: "second-physical-B" }), /otro cuadro|cuadro original/);
  assert.equal(JSON.stringify(h.state()), before); assert.equal(h.writes(), writes);
  const movements = h.state().movements.map(movement => [movement.id, movement.quantity]);
  await h.dispatch("B", { documentId: "original-physical-B", reprint: 2 });
  assert.deepEqual(h.state().movements.map(movement => [movement.id, movement.quantity]), movements);
  assert.equal(h.state().equipmentHandoffs.length, 0); assert.equal(h.out(), 5);
});
