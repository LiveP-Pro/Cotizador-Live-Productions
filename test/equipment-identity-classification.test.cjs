const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const identity = require("../equipment-identity.js");
const { calculateEquipmentAvailability } = require("../equipment-event-store.cjs");
const { prepareWarehouseSave } = require("../warehouse-ledger.cjs");
const confirmedAt = "2026-11-04T12:00:00.000Z";
const stock = [
  { id: "normal", name: "Par LED normal con cable AC", category: "Iluminación", quantity: 27, itemType: "equipo" },
  { id: "matiz", name: "Par LED matiz con cable AC", category: "Iluminación", quantity: 22, itemType: "equipo" }
];
function event(items) { return { id: "synthetic-event", name: "Evento sintético", date: "2026-11-05", place: "Lugar de prueba",
  sections: [{ title: "Prueba", items }] }; }

test("physical identity only normalizes case, accents and whitespace", () => {
  assert.equal(identity.normalizeName("  ILUMINACIÓN  Á  "), "iluminacion a");
  assert.notEqual(identity.normalizeName("Cable 5 mt"), identity.normalizeName("Cable 5mts"));
  assert.notEqual(identity.normalizeName("Monitor 24\""), identity.normalizeName("Monitor 24"));
  assert.equal(identity.resolve({ description: "PAR led MATIZ con cable ac" }, stock).item.id, "matiz");
  const unresolved = identity.resolve({ description: "Par LED RGB con cable AC" }, stock);
  assert.equal(unresolved.status, "unmatched"); assert.equal(unresolved.item, null);
  assert.equal(unresolved.candidates.length, 2);
});

test("legacy aliases and source keys never silently establish physical equivalence", () => {
  const items = [{ id: "one", name: "Modelo nuevo", sourceKey: "Modelo anterior", descriptionAliases: ["Modelo distinto"] }];
  assert.equal(identity.resolve({ description: "Modelo anterior" }, items).status, "unmatched");
  assert.equal(identity.resolve({ description: "Modelo distinto" }, items).status, "unmatched");
  items[0].approvedDescriptionAliases = [{ name: "Modelo anterior", approved: true, approvedAt: confirmedAt }];
  assert.equal(identity.resolve({ description: "Modelo anterior" }, items).status, "approved_alias");
  items[0].approvedDescriptionAliases[0].approved = false;
  assert.equal(identity.resolve({ description: "Modelo anterior" }, items).status, "unmatched");
});

test("stale and conflicting automatically assigned IDs require a deliberate identity confirmation", () => {
  const line = { description: "Par LED RGB con cable AC", warehouseInventoryId: "normal" };
  assert.equal(identity.resolve(line, stock).status, "identity_conflict");
  line.inventoryIdentityConfirmed = { itemId: "normal", description: line.description, confirmedAt };
  assert.equal(identity.resolve(line, stock).status, "confirmed_id");
  line.description = "Par LED matiz con cable AC";
  assert.equal(identity.resolve(line, stock).status, "identity_conflict");
  line.warehouseInventoryId = "deleted";
  assert.equal(identity.resolve(line, stock).status, "stale_id");
  assert.equal(identity.resolve({ description: stock[0].name }, [...stock, { ...stock[0], id: "duplicate" }]).status, "ambiguous");
});

test("classification is central and remains advisory until Contabilidad explicitly confirms it", () => {
  const extinguisher = { id: "ext", name: "Extintor", itemType: "consumible", quantity: 3 };
  const warning = identity.classification(extinguisher);
  assert.equal(warning.itemType, "consumible"); assert.equal(warning.pending, true); assert.equal(warning.suggestedType, "equipo");
  assert.equal(extinguisher.itemType, "consumible");
  extinguisher.classificationConfirmed = { itemType: "consumible", name: extinguisher.name, confirmedAt };
  assert.equal(identity.classification(extinguisher).pending, false);
  extinguisher.itemType = "equipo";
  assert.equal(identity.classificationConfirmed(extinguisher), false);
  assert.equal(identity.itemType({ name: "Prueba / consumible", itemType: "equipo" }), "equipo");
  assert.equal(identity.itemType({ name: "Prueba / consumible" }), "consumible");
  assert.equal(identity.classification({ name: "Gafer", itemType: "equipo" }).pending, true);
  assert.equal(identity.classification({ name: "Unidad sintética", itemType: "equipo" }).pending, false);
});

test("unknown LED variants and contradictory legacy IDs never consume or rent normal LED inventory", () => {
  const result = calculateEquipmentAvailability([event([
    { description: "Par LED RGB con cable AC", quantity: 70, warehouseInventoryId: "normal" },
    { description: stock[1].name, quantity: 30, warehouseInventoryId: "matiz" },
    { description: "Renglón cero de prueba", quantity: 0 }
  ])], { items: stock, movements: [] });
  const unresolved = result.rows.find((row) => row.description === "Par LED RGB con cable AC");
  assert.equal(unresolved.pendingIdentification, true); assert.equal(unresolved.identityStatus, "identity_conflict");
  assert.equal(unresolved.procurementBlocked, true); assert.equal(unresolved.planning.rentalPotential, 0);
  assert.equal(unresolved.planning.pendingPotential.rental, 70); assert.equal(unresolved.quantity, 70);
  assert.equal(result.rows.some((row) => row.warehouseInventoryId === "normal"), false);
  assert.equal(result.rows.find((row) => row.warehouseInventoryId === "matiz").planning.rentalPotential, 8);
  assert.equal(result.rows.find((row) => row.description === "Renglón cero de prueba").quantity, 0);
});

test("a suspicious consumable classification cannot generate procurement or proposed transfers", () => {
  const inventory = { items: [{ id: "ext", name: "Extintor", itemType: "consumible", quantity: 3 }], movements: [] };
  const events = [event([{ description: "Extintor", quantity: 6 }])];
  let row = calculateEquipmentAvailability(events, inventory).rows[0];
  assert.equal(row.pendingClassification, true); assert.equal(row.action, "REVISAR");
  assert.equal(row.planning.purchasePotential, 0); assert.equal(row.planning.pendingPotential.purchase, 3);
  assert.deepEqual(row.planning.routes, []); assert.deepEqual(inventory.movements, []);
  inventory.items[0].itemType = "equipo";
  inventory.items[0].classificationConfirmed = { itemType: "equipo", name: "Extintor", confirmedAt };
  row = calculateEquipmentAvailability(events, inventory).rows[0];
  assert.equal(row.pendingClassification, false); assert.equal(row.planning.rentalPotential, 3);
});

function warehouseHarness(item, accept = true) {
  const confirmations = []; let saves = 0;
  const sandbox = { window: { EquipmentIdentity: identity,
    confirm(message) { confirmations.push(message); return accept; } },
    document: { readyState: "loading", addEventListener() {} } };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  const instrumentation = `
    window.identityHarness = {
      initialize(item) { state = { items: [normalizeItem(item)], movements: [] }; elements.status = { dataset: {} }; renderAll = () => {}; scheduleSave = () => { window.saved(); }; },
      change(field, value) { const target = { dataset: { field }, value, closest() { return { dataset: { warehouseItem: state.items[0].id } }; } }; updateInlineField(target); return target.value; },
      confirmType() { confirmCurrentItemClassification(state.items[0].id); },
      snapshot() { return JSON.parse(JSON.stringify(state)); }, normalizeItem
    };
  `;
  sandbox.window.saved = () => { saves += 1; };
  vm.runInContext(source.replace('  if (document.readyState === "loading") {', instrumentation + '  if (document.readyState === "loading") {'), sandbox);
  sandbox.window.identityHarness.initialize(item);
  return { api: sandbox.window.identityHarness, confirmations, saves: () => saves };
}

test("Contabilidad can confirm or cancel type changes without changing quantities or movements", () => {
  const original = { id: "fixture", name: "Extintor", itemType: "consumible", quantity: 3 };
  const cancelled = warehouseHarness(original, false);
  assert.equal(cancelled.api.change("itemType", "equipo"), "consumible");
  assert.equal(cancelled.api.snapshot().items[0].itemType, "consumible"); assert.equal(cancelled.saves(), 0);
  const accepted = warehouseHarness(original);
  accepted.api.change("itemType", "equipo");
  const snapshot = accepted.api.snapshot();
  assert.equal(snapshot.items[0].quantity, 3); assert.equal(snapshot.items[0].itemType, "equipo");
  assert.equal(identity.classificationConfirmed(snapshot.items[0]), true);
  assert.equal(accepted.saves(), 1); assert.equal(snapshot.movements.length, 0);
});

test("Contabilidad rename stores only explicitly approved physical identity and invalidates old type approval", () => {
  const original = { id: "fixture", name: "Modelo anterior", itemType: "equipo", quantity: 2,
    classificationConfirmed: { itemType: "equipo", name: "Modelo anterior", confirmedAt } };
  const cancelled = warehouseHarness(original, false);
  cancelled.api.change("name", "Otro modelo");
  assert.equal(cancelled.api.snapshot().items[0].name, original.name); assert.equal(cancelled.saves(), 0);
  const accepted = warehouseHarness(original);
  accepted.api.change("name", "Nombre corregido");
  const item = accepted.api.snapshot().items[0];
  assert.equal(identity.resolve({ description: "Modelo anterior" }, [item]).item.id, "fixture");
  assert.equal(item.classificationConfirmed, undefined); assert.equal(item.quantity, 2);
  const normalized = accepted.api.normalizeItem(item);
  assert.equal(normalized.approvedDescriptionAliases.length, 1);
});

test("authoritative warehouse saves preserve classification confirmations and approved aliases as audited edits", () => {
  const current = { savedAt: confirmedAt, state: { items: [{ id: "fixture", name: "Unidad sintética", itemType: "equipo", quantity: 0 }],
    movements: [], auditEntries: [], equipmentStockReceipts: [] } };
  const next = structuredClone(current.state);
  next.items[0].classificationConfirmed = { itemType: "equipo", name: "Unidad sintética", confirmedAt };
  next.items[0].approvedDescriptionAliases = [{ name: "Nombre corregido sintético", approved: true, approvedAt: confirmedAt }];
  const saved = prepareWarehouseSave(current, next, { actor: { name: "Persona de prueba" } }, Date.parse(confirmedAt));
  assert.equal(identity.classificationConfirmed(saved.state.items[0]), true);
  assert.equal(identity.approvedAliases(saved.state.items[0]).length, 1);
  assert.equal(saved.state.items[0].quantity, 0); assert.deepEqual(saved.state.movements, []);
  assert.equal(saved.state.auditEntries.length, 1); assert.equal(saved.state.auditEntries[0].action, "edicion");
  assert.equal(saved.state.auditEntries[0].quantity, 0); assert.equal(saved.state.auditEntries[0].actor.name, "Persona de prueba");
});

test("an estimated or reviewed route cannot reduce a confirmed reservation shortage until the transfer itself is confirmed", () => {
  const inventory = { items: [{ id: "unit", name: "Unidad sintética de ruta", itemType: "equipo", quantity: 3 }], movements: [] };
  const sections = [{ title: "Prueba", items: [{ description: "Unidad sintética de ruta", quantity: 3, warehouseInventoryId: "unit" }] }];
  const events = [{ id: "a", place: "Lugar A", date: "2026-11-05", setupAt: "2026-11-05T08:00", startAt: "2026-11-05T09:00",
    endAt: "2026-11-05T10:00", equipmentInAt: "2026-11-05T23:00", sections },
  { id: "b", place: "Lugar B", date: "2026-11-05", setupAt: "2026-11-05T14:00", startAt: "2026-11-05T15:00",
    endAt: "2026-11-05T18:00", equipmentInAt: "2026-11-05T20:00", sections }];
  const before = JSON.stringify({ events, inventory });
  const options = { from: "2026-11-02", to: "2026-11-08", now: Date.parse(confirmedAt) };
  let result = calculateEquipmentAvailability(events, inventory, options);
  assert.equal(result.rows[0].missing, 3); assert.equal(result.rows[0].action, "RENTA");
  assert.equal(result.rows[0].planning.rentalPotential, 3); assert.equal(result.rows[0].transfers.length, 0);
  assert.ok(result.rows[0].planning.alternativeRoutes.length > 0, "la alternativa estimada permanece visible para revisión");
  assert.equal(result.transfers.length, 0);
  result = calculateEquipmentAvailability(events, inventory, { ...options,
    routeEstimates: [{ fromPlace: "Lugar A", toPlace: "Lugar B", travelMinutes: 30, handlingMinutes: 30 }] });
  assert.equal(result.rows[0].missing, 3); assert.equal(result.transfers.length, 0);
  assert.equal(result.rows[0].transfers[0].requiresTimeConfirmation, false);
  result = calculateEquipmentAvailability(events, inventory, { ...options, transfers: [{ id: "confirmed-synthetic", status: "confirmed",
    fromEventId: "a", toEventId: "b", travelMinutes: 30, handlingMinutes: 30, items: [{ warehouseInventoryId: "unit", quantity: 3 }] }] });
  assert.equal(result.invalidTransfers.length, 0); assert.equal(result.transfers.length, 1); assert.equal(result.rows[0].missing, 0);
  assert.equal(result.rows[0].action, "TRASIEGO"); assert.equal(JSON.stringify({ events, inventory }), before);
});
