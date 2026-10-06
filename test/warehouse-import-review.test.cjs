const assert = require("node:assert/strict");
const test = require("node:test");
const { prepare, decide, finalize } = require("../warehouse-import-review.js");

const NOW = "2026-10-06T16:00:00.000Z";

test("approved import decisions keep both descriptions available for later synchronization", () => {
  for (const action of ["keep-name", "imported-name"]) {
    const before = inventory([item()]);
    const plan = prepare(before, { items: [{ name: "Microfono Shure SM58", category: "AUDIO", quantity: 3 }] });
    decide(plan, 0, action, "current-a");
    const after = finalize(plan, { now: NOW });
    const current = after.items[0];
    assert.equal(current.sourceKey, before.items[0].sourceKey);
    assert.ok([current.name, ...current.descriptionAliases].includes("Micrófono Shure SM58"));
    assert.ok([current.name, ...current.descriptionAliases].includes("Microfono Shure SM58"));
  }
});

test("a recognized old description and an unspecified file type update the same current consumable", () => {
  const current = inventory([item({ name: "Consumible de pruebas renombrado", itemType: "consumible",
    sourceKey: "suministro de prueba", descriptionAliases: ["Suministro original"] })]);
  const plan = prepare(current, { items: [{ name: "Suministro original", category: "AUDIO", quantity: 0 }] });
  assert.equal(plan.rows[0].status, "variant");
  assert.equal(plan.rows[0].candidates[0].id, "current-a");
  decide(plan, 0, "keep-name", "current-a");
  const result = finalize(plan, { now: NOW });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 0);
  assert.equal(result.items[0].itemType, "consumible");
});
const copy = (value) => JSON.parse(JSON.stringify(value));

function inventory(items = []) {
  return {
    version: 4,
    datasetId: "synthetic-current-inventory",
    title: "Inventario de prueba",
    source: "datos sintéticos de pruebas",
    subtitles: ["AUDIO"],
    items,
    movements: [{ id: "movement-a", itemId: "current-a", type: "taller", quantity: 2 }],
    rentalDraft: [{ id: "rental-a", itemId: "current-a", quantity: 1 }],
    workshopDraft: [{ id: "workshop-a", itemId: "current-a", quantity: 2 }],
  };
}

function item(overrides = {}) {
  return {
    id: "current-a",
    name: "Micrófono Shure SM58",
    category: "AUDIO",
    itemType: "equipo",
    quantity: 8,
    notes: "Serie de prueba",
    sourceKey: "microfono shure sm58",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

test("an exact import replaces even zero stock while retaining IDs, references and absent rows", () => {
  const current = inventory([item(), item({ id: "other-b", name: "Atril de prueba", quantity: 4 })]);
  const before = copy(current);
  const uploaded = { items: [{ id: "spreadsheet-row-2", name: "Micrófono Shure SM58", category: "AUDIO", quantity: 0 }] };
  const uploadedBefore = copy(uploaded);
  const plan = prepare(current, uploaded);
  assert.equal(plan.rows[0].status, "exact");
  const result = finalize(plan, { now: NOW });

  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].id, "current-a");
  assert.equal(result.items[0].quantity, 0);
  assert.equal(result.items[0].notes, "Serie de prueba");
  assert.equal(result.items[0].sourceKey, "microfono shure sm58");
  assert.equal(result.items[0].createdAt, before.items[0].createdAt);
  assert.equal(result.items[0].updatedAt, NOW);
  assert.deepEqual(result.items[1], before.items[1]);
  assert.deepEqual(result.movements, before.movements);
  assert.deepEqual(result.rentalDraft, before.rentalDraft);
  assert.deepEqual(result.workshopDraft, before.workshopDraft);
  assert.equal(result.datasetId, before.datasetId);
  assert.deepEqual(current, before);
  assert.deepEqual(uploaded, uploadedBefore);
});

test("case and accent variants require an explicit decision before changing inventory", () => {
  const current = inventory([item()]);
  const before = copy(current);
  const plan = prepare(current, { items: [{ name: "MICROFONO SHURE SM58", category: "audio", quantity: 3 }] });
  assert.equal(plan.rows[0].status, "variant");
  assert.equal(plan.rows[0].decision, null);
  assert.throws(() => finalize(plan), /cada descripción diferente/);
  assert.deepEqual(current, before);

  decide(plan, 0, "keep-name", "current-a");
  const result = finalize(plan, { now: NOW });
  assert.equal(result.items[0].name, "Micrófono Shure SM58");
  assert.equal(result.items[0].quantity, 3);
});

test("choosing an imported description preserves the current identity and movement history", () => {
  const current = inventory([item()]);
  const plan = prepare(current, { items: [{ name: "Microfono Shure SM58", category: "AUDIO", quantity: 5, notes: "Nota del archivo" }] });
  decide(plan, 0, "imported-name", "current-a");
  const result = finalize(plan, { now: NOW });
  assert.equal(result.items[0].id, "current-a");
  assert.equal(result.items[0].name, "Microfono Shure SM58");
  assert.equal(result.items[0].quantity, 5);
  assert.equal(result.items[0].notes, "Nota del archivo");
  assert.equal(result.items[0].sourceKey, current.items[0].sourceKey);
  assert.deepEqual(result.movements, current.movements);
});

test("different model numbers are shown as a discrepancy and never applied automatically", () => {
  const plan = prepare(inventory([item()]), { items: [{ name: "Micrófono Shure SM57", category: "AUDIO", quantity: 1 }] });
  assert.equal(plan.rows[0].status, "variant");
  assert.equal(plan.rows[0].decision, null);
  assert.deepEqual(plan.rows[0].candidates[0].difference, { removed: ["sm58"], added: ["sm57"] });
});

test("the same description in another category is a separate inventory item", () => {
  const plan = prepare(inventory([item()]), { items: [{ name: "Micrófono Shure SM58", category: "ILUMINACION", quantity: 2 }] });
  assert.equal(plan.rows[0].status, "new");
  assert.deepEqual(plan.rows[0].candidates, []);
  const result = finalize(plan, { now: NOW, createId: () => "new-lighting" });
  assert.equal(result.items[0].quantity, 8);
  assert.equal(result.items[1].id, "new-lighting");
  assert.equal(result.items[1].category, "ILUMINACION");
  assert.ok(result.subtitles.includes("ILUMINACION"));
});

test("equipment and consumables with the same name cannot automatically share stock", () => {
  const plan = prepare(inventory([item()]), {
    items: [{ name: "Micrófono Shure SM58", category: "AUDIO", itemType: "consumible", quantity: 1 }],
  });
  assert.equal(plan.rows[0].status, "new");
  const result = finalize(plan, { now: NOW, createId: () => "new-consumable" });
  assert.equal(result.items[0].quantity, 8);
  assert.equal(result.items[1].itemType, "consumible");
});

test("multiple current matches stay unresolved until a particular item is selected", () => {
  const current = inventory([item(), item({ id: "current-b", quantity: 12 })]);
  const plan = prepare(current, { items: [{ name: "Micrófono Shure SM58", category: "AUDIO", quantity: 6 }] });
  assert.equal(plan.rows[0].status, "ambiguous");
  assert.equal(plan.rows[0].candidates.length, 2);
  assert.throws(() => finalize(plan), /cada descripción diferente/);
  assert.throws(() => decide(plan, 0, "keep-name", "missing-id"), /coincidencia válida/);
  decide(plan, 0, "keep-name", "current-b");
  const result = finalize(plan, { now: NOW });
  assert.equal(result.items[0].quantity, 8);
  assert.equal(result.items[1].quantity, 6);
});

test("two uploaded rows cannot silently overwrite the same current item", () => {
  const plan = prepare(inventory([item()]), {
    items: [
      { name: "Micrófono Shure SM58", category: "AUDIO", quantity: 2 },
      { name: "Micrófono Shure SM58", category: "AUDIO", quantity: 9 },
    ],
  });
  assert.deepEqual(plan.rows.map((row) => row.status), ["duplicate", "duplicate"]);
  assert.throws(() => finalize(plan), /cada descripción diferente/);
  decide(plan, 0, "keep-name", "current-a");
  assert.throws(() => decide(plan, 1, "keep-name", "current-a"), /otra fila/);
  decide(plan, 1, "add");
  const result = finalize(plan, { now: NOW, createId: () => "separate-b" });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].quantity, 2);
  assert.equal(result.items[1].quantity, 9);
  assert.equal(result.items[1].id, "separate-b");
});

test("duplicate new rows require a choice and keep distinct IDs when imported separately", () => {
  const plan = prepare(inventory([]), {
    items: [{ name: "Atril de prueba", category: "AUDIO", quantity: 0 }, { name: "Atril de prueba", category: "AUDIO", quantity: 4 }],
  });
  assert.deepEqual(plan.rows.map((row) => row.status), ["duplicate", "duplicate"]);
  decide(plan, 0, "add");
  decide(plan, 1, "add");
  const result = finalize(plan, { now: NOW, createId: () => "repeated-generated-id" });
  assert.equal(new Set(result.items.map((entry) => entry.id)).size, 2);
  assert.deepEqual(result.items.map((entry) => entry.quantity), [0, 4]);
});

test("skipping a spreadsheet discrepancy leaves that item and its history unchanged", () => {
  const current = inventory([item()]);
  const plan = prepare(current, { items: [{ name: "Micrófono Shure SM57", category: "AUDIO", quantity: 1 }] });
  decide(plan, 0, "skip");
  const result = finalize(plan, { now: NOW });
  assert.deepEqual(result.items, current.items);
  assert.deepEqual(result.movements, current.movements);
});

test("archived current items do not receive quantities from spreadsheet imports", () => {
  const plan = prepare(inventory([item({ archived: true })]), {
    items: [{ name: "Micrófono Shure SM58", category: "AUDIO", quantity: 3 }],
  });
  assert.equal(plan.rows[0].status, "new");
  const result = finalize(plan, { now: NOW, createId: () => "new-active-item" });
  assert.equal(result.items[0].archived, true);
  assert.equal(result.items[0].quantity, 8);
  assert.equal(result.items[1].archived, false);
});

test("JSON restore retains backup IDs, metadata, references and absent-current replacement semantics", () => {
  const current = inventory([item(), item({ id: "absent-current", name: "Item solo actual" })]);
  const backup = inventory([item({ id: "backup-a", name: "MICROFONO SHURE SM58", quantity: 0 })]);
  backup.datasetId = "synthetic-uploaded-backup";
  backup.movements = [{ id: "backup-movement", itemId: "backup-a", type: "salida", quantity: 1 }];
  backup.rentalDraft = [{ id: "backup-rental", itemId: "backup-a", quantity: 1 }];
  backup.workshopDraft = [];
  backup.customMetadata = { source: "prueba restaurada" };
  const before = copy(backup);
  const plan = prepare(current, backup, { mode: "restore" });
  assert.throws(() => decide(plan, 0, "skip"), /no permite omitir/);
  decide(plan, 0, "keep-name", "current-a");
  const restored = finalize(plan, { now: NOW });
  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].id, "backup-a");
  assert.equal(restored.items[0].name, "Micrófono Shure SM58");
  assert.equal(restored.items[0].quantity, 0);
  assert.deepEqual(restored.movements, before.movements);
  assert.deepEqual(restored.rentalDraft, before.rentalDraft);
  assert.deepEqual(restored.customMetadata, before.customMetadata);
  assert.equal(restored.datasetId, before.datasetId);
  assert.deepEqual(backup, before);
});

test("JSON restore refuses missing or repeated item IDs rather than orphaning movements", () => {
  const missing = prepare(inventory([]), { items: [{ name: "Equipo nuevo", quantity: 1 }] }, { mode: "restore" });
  assert.throws(() => finalize(missing), /sin identificador/);
  const repeated = prepare(inventory([]), {
    items: [{ id: "backup-a", name: "Equipo uno", quantity: 1 }, { id: "backup-a", name: "Equipo dos", quantity: 2 }],
  }, { mode: "restore" });
  assert.throws(() => finalize(repeated), /identificadores repetidos/);
});

test("invalid quantities are rejected without silently rounding or coercing blank cells to zero", () => {
  for (const quantity of [undefined, null, "", " ", -1, 1.5, "no disponible", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => prepare(inventory([]), { items: [{ name: "Equipo prueba", quantity }] }), /cantidad no válida/);
  }
  const zero = prepare(inventory([]), { items: [{ name: "Equipo prueba", quantity: "0" }] });
  assert.equal(finalize(zero, { now: NOW }).items[0].quantity, 0);
});

test("finalizing a reviewed plan is repeatable and does not mutate the review input", () => {
  const plan = prepare(inventory([item()]), { items: [{ name: "Micrófono Shure SM58", category: "AUDIO", quantity: 3 }] });
  const before = copy(plan);
  const first = finalize(plan, { now: NOW });
  const second = finalize(plan, { now: NOW });
  assert.deepEqual(first, second);
  assert.deepEqual(plan, before);
});
