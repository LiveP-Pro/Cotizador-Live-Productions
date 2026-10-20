const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Reuse the real purchase form harness and its inventory.js instrumentation.
// Every item, identifier, event reference and quantity below is synthetic.
function harness(items = []) {
  let helper = fs.readFileSync(path.join(__dirname, "warehouse-purchase-request.test.cjs"), "utf8");
  helper = helper.slice(0, helper.indexOf("\ntest("));
  helper = helper.replace("      addNewItem,", `      addNewItem,
      setItems(items) { state.items = items.map(normalizeItem); },
      persistServerState,
      reload(payload) { state = normalizeState(payload.state); serverSavedAt = payload.savedAt; warehouseDirty = false; pendingEquipmentPurchaseLinks.clear(); },
  `);
  const result = new Function("require", "__dirname", helper + "\nreturn createPurchaseHarness();")(require, __dirname);
  result.initialize(); result.context.window.__purchaseHarness.setItems(items);
  result.form.newItemType = { value: "" };
  const requests = [], responses = [];
  result.context.fetch = async (_url, init) => {
    const body = JSON.parse(init.body); requests.push(body);
    const reply = responses.shift();
    if (reply) return reply(body);
    return { ok: true, json: async () => ({ savedAt: "2026-10-20T20:00:00.000Z", state: structuredClone(body.state) }) };
  };
  result.requestDetailed = (payload) => result.context.window.prepareWarehousePurchase(payload);
  result.save = () => result.context.window.__purchaseHarness.persistServerState();
  result.reload = (payload) => result.context.window.__purchaseHarness.reload(payload);
  result.writes = requests; result.responses = responses;
  return result;
}
const stock = () => [{ id: "current-unit-a", name: "Unidad sintética A", category: "PRUEBAS", quantity: 3, itemType: "consumible", notes: "Nota vigente" },
  { id: "other-unit", name: "Otra unidad", category: "OTRA", quantity: 9, itemType: "equipo", notes: "No cambiar" }];
const refs = [{ eventId: "event-synthetic", itemId: "event-line-synthetic", description: "Unidad sintética A" }];
function request(warehouseInventoryId = "current-unit-a") {
  return { requestId: "purchase-test-attempt", items: [{ description: "Unidad sintética A", quantity: 2, warehouseInventoryId,
    inventoryCategory: "PRUEBAS", itemType: "consumible", eventItemRefs: structuredClone(refs) }] };
}

test("known-item purchase preserves metadata and increments the same current inventory id", async () => {
  const h = harness(stock()); const beforeOther = h.snapshot().state.items[1];
  h.requestDetailed(request());
  const pending = h.snapshot().purchaseRequests[0];
  assert.equal(pending.warehouseInventoryId, "current-unit-a"); assert.equal(pending.inventoryCategory, "PRUEBAS");
  assert.equal(pending.itemType, "consumible"); assert.deepEqual(JSON.parse(JSON.stringify(pending.eventItemRefs)), refs);
  assert.equal(h.form.newCategory.value, "PRUEBAS"); assert.equal(h.form.newQuantity.value, "0");
  h.form.newQuantity.value = "2"; h.add();
  const local = h.snapshot().state;
  assert.equal(local.items.length, 2); assert.equal(local.items[0].id, "current-unit-a"); assert.equal(local.items[0].quantity, 5);
  assert.equal(local.items[0].itemType, "consumible"); assert.equal(local.items[0].notes, "Nota vigente");
  assert.deepEqual(local.items[1], beforeOther);
  const movement = local.movements[0];
  assert.equal(movement.type, "ingreso"); assert.equal(movement.quantity, 2); assert.equal(movement.previousQuantity, 3); assert.equal(movement.newQuantity, 5);
  assert.equal(local.items[0].equipmentPurchaseLinks, undefined, "no receipt proof is published before the server confirms");
  await h.save();
  const saved = h.snapshot().state.items[0];
  assert.equal(saved.equipmentPurchaseLinks.length, 1);
  assert.equal(saved.equipmentPurchaseLinks[0].eventId, refs[0].eventId);
  assert.equal(saved.equipmentPurchaseLinks[0].itemId, refs[0].itemId);
  assert.equal(saved.equipmentPurchaseLinks[0].receivedQuantity, 2);
  assert.equal(h.writes[0].state.items[0].quantity, 5);
  assert.equal(h.writes[0].expectedSavedAt, "2026-10-17T12:00:00.000Z");
});

test("unknown purchases create a new record with source category and consumable type only after positive real quantity", async () => {
  const h = harness(stock()); h.requestDetailed(request(""));
  h.add(); assert.equal(h.snapshot().state.items.length, 2);
  assert.match(h.form.status.textContent, /cantidad real comprada, mayor a 0/);
  h.form.newQuantity.value = "-1"; h.add(); assert.equal(h.snapshot().state.items.length, 2);
  h.form.newQuantity.value = "1.5"; h.add(); assert.equal(h.snapshot().state.items.length, 2);
  h.form.newQuantity.value = "2"; h.add();
  const item = h.snapshot().state.items[2];
  assert.notEqual(item.id, "current-unit-a", "same visible name never silently merges a physically distinct unknown item");
  assert.equal(item.quantity, 2); assert.equal(item.category, "PRUEBAS"); assert.equal(item.itemType, "consumible");
  assert.equal(item.equipmentPurchaseLinks, undefined);
  await h.save();
  assert.equal(h.snapshot().state.items[2].equipmentPurchaseLinks[0].description, refs[0].description);
});

test("stale ids, archived ids and similar-but-different names never update the wrong physical equipment", () => {
  for (const makeStock of [() => stock().filter((item) => item.id !== "current-unit-a"), () => { const items = stock(); items[0].archived = true; return items; },
    () => { const items = stock(); items[0].name = "Unidad sintética A."; return items; }]) {
    const items = makeStock(); const h = harness(items); const before = h.snapshot().state;
    h.requestDetailed(request()); h.form.newQuantity.value = "2"; h.add();
    assert.deepEqual(h.snapshot().state, before); assert.equal(h.snapshot().purchaseRequests.length, 1);
    assert.match(h.form.status.textContent, /equipo solicitado cambió o ya no está activo/);
  }
});

test("retrying persistence and double-clicking add never record the same acquisition twice", async () => {
  const h = harness(stock()); h.requestDetailed(request()); h.form.newQuantity.value = "2"; h.add(); h.add();
  assert.equal(h.snapshot().state.items[0].quantity, 5); assert.equal(h.snapshot().state.movements.length, 1);
  h.responses.push(() => ({ ok: false, status: 503, json: async () => ({ error: "Synthetic save failure" }) }));
  await assert.rejects(h.save(), /Synthetic save failure/);
  assert.equal(h.snapshot().state.items[0].equipmentPurchaseLinks, undefined);
  assert.equal(h.requestDetailed(request()), false, "an already-applied local purchase attempt is not queued again while its save is pending");
  await h.save();
  assert.equal(h.snapshot().state.items[0].quantity, 5); assert.equal(h.snapshot().state.movements.length, 1);
  assert.equal(h.snapshot().state.items[0].equipmentPurchaseLinks.length, 1);
  assert.equal(h.writes[0].state.items[0].quantity, 5); assert.equal(h.writes[1].state.items[0].quantity, 5);
  await h.save(); assert.equal(h.snapshot().state.items[0].equipmentPurchaseLinks.length, 1);
});

test("confirmed purchase references survive normalization and reload and reject a repeated received request", async () => {
  const h = harness(stock()); h.requestDetailed(request()); h.form.newQuantity.value = "2"; h.add(); await h.save();
  const payload = { state: h.snapshot().state, savedAt: "2026-10-20T20:00:00.000Z" };
  h.reload(payload); assert.equal(h.snapshot().state.items[0].equipmentPurchaseLinks.length, 1);
  assert.equal(h.requestDetailed(request()), false);
  assert.equal(h.snapshot().state.items[0].quantity, 5); assert.equal(h.snapshot().state.movements.length, 1);
  assert.equal(h.snapshot().purchaseRequests.length, 0);
});

test("a stale inventory revision preserves pending purchase references without fabricating proof", async () => {
  const h = harness(stock()); h.requestDetailed(request()); h.form.newQuantity.value = "2"; h.add();
  h.responses.push(() => ({ ok: false, status: 409, json: async () => ({ error: "Otra persona actualizó el inventario" }) }));
  await assert.rejects(h.save(), (error) => error.status === 409);
  const item = h.snapshot().state.items[0]; assert.equal(item.quantity, 5); assert.equal(item.equipmentPurchaseLinks, undefined);
  assert.equal(h.writes[0].state.items[0].equipmentPurchaseLinks[0].eventId, refs[0].eventId);
  assert.equal(h.writes[0].expectedSavedAt, "2026-10-17T12:00:00.000Z");
});
