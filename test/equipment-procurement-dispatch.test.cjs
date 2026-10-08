const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createDispatchHarness(items, movements = []) {
  let inventory = {
    state: { items: structuredClone(items), movements: structuredClone(movements) },
    savedAt: "2026-10-07T00:00:00.000Z"
  };
  const context = { crypto, Date, Map, Set, console,
    readWarehouseInventory() { return structuredClone(inventory); },
    async writeWarehouseInventory(saved) { inventory = structuredClone(saved); }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.indexOf("function warehouseDispatchLookupKey(");
  const end = source.indexOf("async function saveEquipmentBoard(", start);
  assert.ok(start >= 0 && end > start, "Dispatch functions must be present in the server.");
  vm.runInContext(source.slice(start, end), context, { filename: "server-dispatch.js" });
  return {
    async ingest(lines, documentId = "synthetic-dispatch", fileName = "synthetic.pdf") {
      const result = await context.receiveEquipmentBoardInWarehouse({
        mode: "full", savedAt: "2026-10-07T00:00:00.000Z", notes: "Nota sintética del evento",
        warehouseDispatch: {
          id: documentId, eventId: "synthetic-event", name: "Evento sintético", place: "Lugar sintético",
          eventDate: "2026-10-08", equipmentOutAt: "2026-10-08T10:00",
          equipmentInAt: "2026-10-08T22:00", responsible: "Responsable sintético", items: lines
        }
      }, { fileName, jsonFileName: `${fileName}.json`, pdfUrl: `/test/${fileName}`, jsonUrl: `/test/${fileName}.json` });
      return JSON.parse(JSON.stringify(result));
    },
    state() { return structuredClone(inventory.state); },
    available(itemId = "synthetic-item") { return context.warehouseAvailableForDispatch(inventory.state, itemId); }
  };
}

function syntheticStock(itemType = "equipo", name = "Equipo sintético", quantity = 8) {
  return [{ id: "synthetic-item", name, quantity, itemType, category: "Categoría sintética" }];
}

function syntheticLine(procurementChoice, quantity = 2, description = "Equipo sintético") {
  return {
    description, quantity, category: "Categoría sintética",
    warehouseInventoryId: "synthetic-item", warehouseItemIds: ["synthetic-item"],
    ...(procurementChoice ? { procurementChoice } : {})
  };
}

test("each explicit extra decision retains the event line without reserving matching stock", async () => {
  for (const [choice, action, type] of [["save", "GUARDAR", "salida"], ["rent", "RENTA", "salida"], ["purchase", "COMPRA", "compra"]]) {
    const harness = createDispatchHarness(syntheticStock());
    const result = await harness.ingest([syntheticLine(choice)]);
    const [movement] = harness.state().movements;
    assert.equal(harness.available(), 8, choice);
    assert.equal(movement.procurementChoice, choice);
    assert.equal(movement.procurementAction, action);
    assert.equal(movement.type, type);
    assert.equal(movement.itemId, "");
    assert.equal(movement.itemName, "Equipo sintético");
    assert.equal(movement.quantity, 2);
    assert.equal(movement.sourceUnmatched, true);
    assert.equal(movement.sourceDocumentId, "synthetic-dispatch");
    assert.equal(movement.sourceEventId, "synthetic-event");
    assert.equal(movement.sourceEventName, "Evento sintético");
    assert.equal(movement.sourceExpectedReturnAt, "2026-10-08T22:00");
    assert.equal(result.warehouseReceipt.mappedQuantity, 0);
    assert.equal(result.warehouseReceipt.unmappedQuantity, 2);
    assert.equal(result.warehouseReceipt.consumedQuantity, 0);
    assert.equal(result.warehouseReceipt.purchaseQuantity, choice === "purchase" ? 2 : 0);
  }
});

test("same-name choices remain separate from a normal warehouse line", async () => {
  const harness = createDispatchHarness(syntheticStock());
  const result = await harness.ingest([
    syntheticLine("save", 1), syntheticLine("rent", 2), syntheticLine("purchase", 3), syntheticLine("", 4)
  ]);
  assert.deepEqual(harness.state().movements.map((movement) => ({
    choice: movement.procurementChoice || "", action: movement.procurementAction || "",
    quantity: movement.quantity, itemId: movement.itemId
  })), [
    { choice: "save", action: "GUARDAR", quantity: 1, itemId: "" },
    { choice: "rent", action: "RENTA", quantity: 2, itemId: "" },
    { choice: "purchase", action: "COMPRA", quantity: 3, itemId: "" },
    { choice: "", action: "", quantity: 4, itemId: "synthetic-item" }
  ]);
  assert.equal(new Set(harness.state().movements.map((movement) => movement.sourceLineKey)).size, 4);
  assert.equal(harness.available(), 4);
  assert.equal(result.warehouseReceipt.mappedQuantity, 4);
  assert.equal(result.warehouseReceipt.unmappedQuantity, 6);
  assert.equal(result.warehouseReceipt.purchaseQuantity, 3);
});

test("explicit rent and save override consumable classification without consuming stock", async () => {
  const description = "Material sintético / consumible";
  const harness = createDispatchHarness(syntheticStock("consumible", description));
  const result = await harness.ingest([
    { ...syntheticLine("rent", 2, description), consumable: true },
    { ...syntheticLine("save", 3, description), consumable: true }
  ]);
  assert.equal(harness.available(), 8);
  assert.deepEqual(harness.state().movements.map((movement) => movement.procurementAction), ["RENTA", "GUARDAR"]);
  assert.equal(result.warehouseReceipt.consumedQuantity, 0);
  assert.equal(result.warehouseReceipt.purchaseQuantity, 0);
});

test("re-ingesting a document preserves every decision and quantity without duplicates", async () => {
  const harness = createDispatchHarness(syntheticStock());
  const lines = [syntheticLine("save", 1), syntheticLine("rent", 2), syntheticLine("purchase", 3)];
  await harness.ingest(lines);
  const result = await harness.ingest(lines, "synthetic-dispatch", "updated.pdf");
  const movements = harness.state().movements;
  assert.equal(movements.length, 3);
  assert.deepEqual(movements.map((movement) => [movement.procurementChoice, movement.procurementAction, movement.quantity]), [
    ["save", "GUARDAR", 1], ["rent", "RENTA", 2], ["purchase", "COMPRA", 3]
  ]);
  assert.ok(movements.every((movement) => movement.sourceFileName === "updated.pdf"));
  assert.equal(harness.available(), 8);
  assert.equal(result.warehouseReceipt.updated, true);
});

test("a registered purchase dispatched without its pending choice uses real warehouse stock", async () => {
  const harness = createDispatchHarness(syntheticStock());
  await harness.ingest([syntheticLine("purchase", 3)]);
  const result = await harness.ingest([syntheticLine("", 3)]);
  const [movement] = harness.state().movements;
  assert.equal(harness.state().movements.length, 1);
  assert.equal(movement.type, "salida");
  assert.equal(movement.itemId, "synthetic-item");
  assert.equal(movement.procurementChoice, undefined);
  assert.equal(harness.available(), 5);
  assert.equal(result.warehouseReceipt.purchaseQuantity, 0);
  assert.equal(result.warehouseReceipt.mappedQuantity, 3);
});

test("a returned dispatch retains its decisions and only updates its file references", async () => {
  const existing = [
    { id: "external-rent", sourceDocumentId: "synthetic-dispatch", type: "salida", itemId: "", itemName: "Equipo sintético", quantity: 2,
      sourceUnmatched: true, procurementChoice: "rent", procurementAction: "RENTA" },
    { id: "synthetic-return", sourceDocumentId: "synthetic-dispatch", type: "ingreso_evento", itemId: "synthetic-item", quantity: 0 }
  ];
  const harness = createDispatchHarness(syntheticStock(), existing);
  const result = await harness.ingest([syntheticLine("purchase", 9)], "synthetic-dispatch", "updated.pdf");
  assert.equal(result.warehouseReceipt.locked, true);
  assert.equal(result.warehouseReceipt.mappedQuantity, 0);
  assert.equal(result.warehouseReceipt.unmappedQuantity, 2);
  assert.equal(harness.state().movements.length, 2);
  assert.equal(harness.state().movements[0].procurementChoice, "rent");
  assert.equal(harness.state().movements[0].quantity, 2);
  assert.equal(harness.state().movements[0].sourceFileName, "updated.pdf");
  assert.equal(harness.available(), 8);
});
