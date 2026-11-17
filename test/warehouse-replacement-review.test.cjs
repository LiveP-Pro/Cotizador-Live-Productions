const test = require("node:test");
const assert = require("node:assert/strict");
const { prepare, decide, finalize, summarizeReplacement } = require("../warehouse-import-review.js");
const { prepareWarehouseSave } = require("../warehouse-ledger.cjs");

// Only synthetic current sources are used; no real warehouse data is loaded.
const NOW = "2026-11-17T14:00:00.000Z";
const clone = value => JSON.parse(JSON.stringify(value));
const item = (id, name, extra = {}) => ({ id, name, category: "AUDIO", quantity: 9,
  itemType: "equipo", sourceKey: `synthetic-${id}`, notes: "Nota anterior", archived: false,
  createdAt: "2026-11-01T00:00:00.000Z", ...extra });
const state = (items = []) => ({ version: 4, datasetId: "synthetic-current", source: "Fuente sintética anterior",
  items, subtitles: ["CATEGORÍA ANTERIOR"],
  movements: [{ id: "movement-current", itemId: "current-a", type: "taller", quantity: 2, notes: "Bitácora vigente" }],
  rentalDraft: [{ id: "rental-current", itemId: "current-a", quantity: 1 }, { id: "rental-absent", itemId: "absent", quantity: 1 }],
  workshopDraft: [{ id: "workshop-current", itemId: "current-a", quantity: 2 }, { id: "workshop-absent", itemId: "absent", quantity: 3 }],
  auditEntries: [{ id: "audit-original", action: "taller" }], equipmentStockReceipts: [{ requestId: "receipt-current" }] });
const active = value => value.items.filter(entry => !entry.archived);
const confirm = (plan, extra = {}) => finalize(plan, { now: NOW, confirmedReplacement: true, ...extra });

test("replacement preview is pure and explicitly requires confirmation before creating any inventory item", () => {
  const before = state([item("current-a", "Unidad sintética X32"), item("absent", "Unidad ausente")]);
  const incoming = { source: "Inventario sintético nuevo.xlsx", items: [
    { name: "Unidad sintética X32", category: "AUDIO", quantity: 0 },
    { name: "Cable sintético nuevo", category: "CABLES", quantity: 5 }
  ] };
  const initial = clone({ before, incoming });
  const plan = prepare(before, incoming, { mode: "replace" });
  assert.deepEqual(plan.replacementSummary, { totalRows: 2, importedRows: 2, totalQuantity: 5,
    updated: 1, added: 1, archived: 1, skipped: 0, quantityMeaning: "registered", preservesMovements: true });
  let generated = 0;
  for (const authorization of [undefined, false, "true"]) {
    assert.throws(() => finalize(plan, { confirmedReplacement: authorization, createId() { generated++; return "unused"; } }), /Confirme expresamente/);
  }
  assert.equal(generated, 0);
  assert.deepEqual({ before, incoming }, initial);
});

test("confirmed replacement follows the file, archives absent items, and retains IDs, ledgers and current-source evidence", () => {
  const before = state([item("current-a", "Unidad sintética X32"), item("absent", "Unidad ausente"),
    item("already-archived", "Unidad histórica", { archived: true, quantity: 7 })]);
  const incoming = { source: "Inventario sintético nuevo.xlsx", items: [
    { name: "Unidad sintética X32", category: "AUDIO", quantity: 0, sourceRow: 3, sourceLocation: "Hoja sintética, fila 3" },
    { name: "Cable sintético nuevo", category: "CABLES", quantity: 5, notes: "Nota actual", sourceRow: 5 }
  ], sourceCells: [{ address: "B3", value: 0 }], sourceRows: [
    { type: "category", description: "ESTRUCTURA", cells: [{ address: "A1", value: "ESTRUCTURA" }] }
  ], correctionDecisions: [{ sourceRow: 5, action: "quantity", value: 5 }],
  verification: { complete: true }, notes: [{ text: "Nota literal" }] };
  const original = clone({ before, incoming });
  const plan = prepare(before, incoming, { mode: "replace" });
  const untouchedPlan = clone(plan);
  const result = confirm(plan, { createId: () => "new-current" });
  assert.deepEqual(active(result).map(entry => [entry.id, entry.name, entry.quantity, entry.notes]), [
    ["current-a", "Unidad sintética X32", 0, ""], ["new-current", "Cable sintético nuevo", 5, "Nota actual"]
  ]);
  assert.equal(active(result)[0].sourceKey, before.items[0].sourceKey);
  assert.equal(active(result)[0].createdAt, before.items[0].createdAt);
  assert.equal(result.items.find(entry => entry.id === "absent").archived, true);
  assert.deepEqual(result.items.find(entry => entry.id === "already-archived"), before.items[2]);
  for (const field of ["movements", "auditEntries", "equipmentStockReceipts"]) assert.deepEqual(result[field], before[field]);
  assert.deepEqual(result.rentalDraft, [before.rentalDraft[0]]);
  assert.deepEqual(result.workshopDraft, [before.workshopDraft[0]]);
  assert.deepEqual(result.subtitles, ["ESTRUCTURA", "AUDIO", "CABLES"]);
  assert.equal(result.source, incoming.source);
  for (const field of ["sourceCells", "sourceRows", "correctionDecisions", "verification", "notes", "items"]) {
    assert.deepEqual(result.importedSource[field], incoming[field]);
  }
  assert.deepEqual(result.importedSource.identityDecisions, [
    { index: 0, sourceRow: 3, sourceLocation: "Hoja sintética, fila 3", action: "imported-name", targetId: "current-a" },
    { index: 1, sourceRow: 5, sourceLocation: "", action: "add" }
  ]);
  assert.deepEqual({ before, incoming }, original);
  assert.deepEqual(plan, untouchedPlan);
  assert.deepEqual(confirm(plan, { createId: () => "new-current" }), result);
});

test("similar descriptions and approved aliases do not silently reuse a different physical identity during replacement", () => {
  const before = state([item("current-a", "Unidad sintética X32", { descriptionAliases: ["Nombre sintético anterior"] })]);
  const plan = prepare(before, { items: [
    { name: "Unidad sintética X16", category: "AUDIO", quantity: 1 },
    { name: "Nombre sintético anterior", category: "AUDIO", quantity: 2 }
  ] }, { mode: "replace" });
  assert.ok(plan.rows.every(row => row.decision.action === "add"));
  const result = confirm(plan, { createId: () => "new-physical" });
  assert.deepEqual(active(result).map(entry => [entry.name, entry.quantity]), [["Unidad sintética X16", 1], ["Nombre sintético anterior", 2]]);
  assert.ok(active(result).every(entry => entry.id !== "current-a"));
  assert.equal(result.items.find(entry => entry.id === "current-a").archived, true);
  assert.deepEqual(result.movements, before.movements);
});

test("duplicate uploaded descriptions are separate source rows and never overwrite the same current stock", () => {
  const plan = prepare(state([item("current-a", "Unidad sintética X32")]), { items: [
    { name: "Unidad sintética X32", category: "AUDIO", quantity: 0 },
    { name: "Unidad sintética X32", category: "AUDIO", quantity: 4 }
  ] }, { mode: "replace" });
  assert.ok(plan.rows.every(row => row.status === "duplicate" && row.decision.action === "add"));
  const result = confirm(plan, { createId: () => "current-a" });
  assert.deepEqual(active(result).map(entry => entry.quantity), [0, 4]);
  assert.equal(new Set(result.items.map(entry => entry.id)).size, 3);
  assert.ok(active(result).every(entry => entry.id !== "current-a"));
  assert.equal(plan.replacementSummary.archived, 1);
});

test("an explicit approved identity decision preserves its movement references and recomputes the replacement summary", () => {
  const plan = prepare(state([item("current-a", "Unidad sintética X32")]), { items: [
    { name: "Unidad sintética X16", category: "AUDIO", quantity: 1 },
    { name: "Unidad sintética X64", category: "AUDIO", quantity: 2 }
  ] }, { mode: "replace" });
  decide(plan, 0, "imported-name", "current-a");
  assert.throws(() => decide(plan, 1, "keep-name", "current-a"), /otra fila/);
  assert.deepEqual(plan.replacementSummary, summarizeReplacement(plan));
  assert.equal(plan.replacementSummary.updated, 1);
  assert.equal(plan.replacementSummary.added, 1);
  assert.equal(plan.replacementSummary.archived, 0);
  const result = confirm(plan);
  assert.equal(active(result)[0].id, "current-a");
  assert.equal(active(result)[0].name, "Unidad sintética X16");
  assert.deepEqual(active(result)[0].descriptionAliases, ["Unidad sintética X32"]);
  assert.equal(result.movements[0].itemId, "current-a");
});

test("category and declared physical type must match before a replacement reuses an identity", () => {
  const before = state([item("current-a", "Unidad sintética")]);
  for (const raw of [
    { name: "Unidad sintética", category: "ILUMINACION", quantity: 3 },
    { name: "Unidad sintética", category: "AUDIO", itemType: "consumible", quantity: 3 },
    { name: "Unidad sintética", quantity: 3 }
  ]) {
    const plan = prepare(before, { items: [raw] }, { mode: "replace" });
    assert.equal(plan.rows[0].decision.action, "add");
    const result = confirm(plan);
    assert.notEqual(active(result)[0].id, "current-a");
    assert.equal(result.items.find(entry => entry.id === "current-a").archived, true);
  }
});

test("registered quantities are not inflated by preserved workshop, rental, or outgoing movement amounts", () => {
  const before = state([item("current-a", "Unidad sintética")]);
  before.movements.push({ id: "outgoing-current", itemId: "current-a", type: "salida", quantity: 3 });
  const result = confirm(prepare(before, { items: [{ name: "Unidad sintética", category: "AUDIO", quantity: 5 }] }, { mode: "replace" }));
  assert.equal(active(result)[0].quantity, 5);
  assert.deepEqual(result.movements, before.movements);
  const saved = prepareWarehouseSave({ state: before, savedAt: "2026-11-17T13:00:00.000Z" }, result,
    { actor: { name: "Operador sintético" }, source: "contabilidad-equipo" }, Date.parse(NOW));
  assert.deepEqual(saved.state.movements, before.movements);
  assert.deepEqual(saved.state.equipmentStockReceipts, before.equipmentStockReceipts);
  assert.equal(saved.state.auditEntries[0].id, "audit-original");
  assert.ok(saved.state.auditEntries.some(entry => entry.action === "cambio_cantidad" && entry.newQuantity === 5));
});

test("replacement never invents missing or invalid quantities or accepts an all-skipped source", () => {
  for (const quantity of [undefined, null, "", " ", -1, 1.2, "pendiente"]) {
    assert.throws(() => prepare(state(), { items: [{ name: "Unidad sintética", quantity }] }, { mode: "replace" }), /cantidad no válida/);
  }
  const plan = prepare(state(), { items: [{ name: "Unidad sintética", quantity: 0 }] }, { mode: "replace" });
  decide(plan, 0, "skip");
  assert.equal(plan.replacementSummary.skipped, 1);
  assert.throws(() => confirm(plan), /al menos un artículo/);
});

test("a merge also retains the current file evidence, corrections and authorized identity decisions", () => {
  const before = state([item("current-a", "Unidad sintética X32")]);
  const incoming = { source: "Fuente sintética revisada.xlsx", items: [
    { name: "Unidad sintética X32", category: "AUDIO", quantity: 3, sourceRow: 5 }
  ], sourceCells: [{ address: "B5", value: null }], sourceRows: [{ sourceRow: 5, type: "unresolved" }],
  correctionDecisions: [{ sourceRow: 5, action: "quantity", value: 3 }], verification: { complete: true } };
  const plan = prepare(before, incoming, { mode: "merge" });
  const result = finalize(plan, { now: NOW });
  assert.equal(result.source, before.source);
  assert.equal(result.importedSource.mode, "merge");
  for (const field of ["sourceCells", "sourceRows", "correctionDecisions", "verification"]) {
    assert.deepEqual(result.importedSource[field], incoming[field]);
  }
  assert.deepEqual(result.importedSource.identityDecisions, [{ index: 0, sourceRow: 5, sourceLocation: "",
    action: "keep-name", targetId: "current-a" }]);
  assert.deepEqual(result.movements, before.movements);
  assert.equal(result.items[0].quantity, 3);
});
