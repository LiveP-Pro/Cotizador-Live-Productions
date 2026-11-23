const assert = require("node:assert/strict");
const test = require("node:test");
const Identity = require("../equipment-identity.js");
const { createEquipmentPlanningReportModel } = require("../equipment-reporting.cjs");

// Synthetic input only: classification review must not rewrite inventory.
function fixture(type) {
  const item = { id: "synthetic-cleaner", name: "Espuma limpiadora sintética", category: "Limpieza", itemType: type, quantity: 3 };
  const inventory = { savedAt: "2026-11-23T12:00:00Z", state: { items: [item], movements: [] } };
  const events = [2, 3].map((quantity, index) => ({ id: `cleaner-event-${index}`, name: `Evento ${index}`, place: `Lugar ${index}`, date: `2026-11-${25 + index}`,
    setupAt: `2026-11-${25 + index}T08:00`, startAt: `2026-11-${25 + index}T12:00`, endAt: `2026-11-${25 + index}T20:00`, equipmentInAt: "2026-11-28T10:00",
    sections: [{ title: "Limpieza", items: [{ description: item.name, quantity, warehouseInventoryId: item.id }] }] }));
  return { item, inventory, events };
}

test("unconfirmed cleaning foam marked reusable is reviewed instead of proposing a consumable handoff", () => {
  const { item, inventory, events } = fixture("equipo"), before = JSON.stringify(inventory);
  assert.equal(Identity.classification(item).suggestedType, "consumible");
  const model = createEquipmentPlanningReportModel({ events }, inventory);
  assert.equal(model.scenarioRows[0].pendingClassification, true);
  assert.equal(model.scenarioRows[0].rentWithTransfer, null);
  assert.equal(model.transferRoutes.length, 0);
  assert.equal(JSON.stringify(inventory), before);
  assert.equal(Identity.classification({ ...item, name: "Máquina de espuma sintética" }).pending, false);
});

test("confirmed consumable foam sums each event even when reusable equipment would not need rent", () => {
  const { inventory, events } = fixture("consumible");
  const model = createEquipmentPlanningReportModel({ events }, inventory), row = model.consumablePurchases[0];
  assert.equal(row.demand, 5);
  assert.equal(row.purchaseQuantity, 2);
  assert.equal(model.transferRoutes.length, 0);
  assert.equal(model.rentalComparison.length, 0);
});
