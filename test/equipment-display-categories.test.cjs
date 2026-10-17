const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function harness(sections = []) {
  const context = {
    window: { requerimientoEquipoCatalog: { services: {}, groups: [] } },
    document: { querySelector() { return null; }, addEventListener() {} },
    sections
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context);
  const evaluate = (source) => vm.runInContext(source, context);
  return { evaluate, json(source) { return JSON.parse(evaluate(`JSON.stringify(${source})`)); } };
}

function section(id, title, options = {}) {
  return {
    id, title, inventoryCategory: title, importSource: { authoritative: true, sourceFileId: "synthetic-current-file" },
    items: [{ id: `${id}-item-0`, quantity: options.quantity ?? 0, description: options.description || `${id} equipment`,
      sourceItemIndex: 0, editable: true, manual: false }],
    rows: [
      { type: "category", description: title, cells: [{ value: title, ref: `${id}!A1` }], sourceRefs: [`${id}!A1`], sourceOrder: 0 },
      { type: "item", sourceItemIndex: 0, quantity: options.quantity ?? 0, description: options.description || `${id} equipment`,
        notes: ["Item observation retained"], sourceOrder: 1, sourceRefs: [`${id}!A2`, `${id}!B2`],
        cells: [{ value: options.quantity ?? 0, ref: `${id}!A2` }, { value: options.description || `${id} equipment`, ref: `${id}!B2` }] }
    ],
    notes: [title, "Item observation retained", "Section observation retained"],
    ...options
  };
}

for (const compact of [false, true]) {
  test(`duplicate category rows are hidden while equipment zero and notes remain (${compact ? "PDF" : "editor"})`, () => {
    const h = harness([section("synthetic-a", "EFECTOS ESPECIALES", { description: "EFECTOS ESPECIALES" })]);
    const markup = h.evaluate(`tableForEquipmentSections(sections, ${compact})`);
    assert.doesNotMatch(markup, /data-source-row-type="category"/);
    assert.match(markup, /Item observation retained/);
    assert.match(markup, /Section observation retained/);
    assert.equal((markup.match(/class="equipment-category-row"/g) || []).length, 1);
    assert.equal((markup.match(/EFECTOS ESPECIALES/g) || []).length, 2, "one heading and one equipment item remain");
    assert.match(markup, compact ? />0<\/td>/ : /data-equipment-item-id="synthetic-a-item-0"[^>]*value="0"/);
  });

  test(`a repeated leaf and quantity label are hidden without removing equipment (${compact ? "PDF" : "editor"})`, () => {
    const fixture = section("synthetic-console", "AUDIO / Consola", { description: "Consola", quantity: 2 });
    fixture.rows[0] = { type: "category", description: "Cantidad · Consola", cells: [{ value: "Cantidad" }, { value: "Consola" }] };
    const h = harness([fixture]);
    const markup = h.evaluate(`tableForEquipmentSections(sections, ${compact})`);
    assert.doesNotMatch(markup, /data-source-row-type="category"/);
    assert.match(markup, /AUDIO \/ Consola/);
    assert.match(markup, compact ? />Consola<\/td>/ : /value="Consola"/);
  });
}

test("only equivalent heading/category rows are suppressed; all additional source information stays", () => {
  const h = harness();
  const title = "ILUMINACIÓN / Láser";
  const row = { type: "heading", description: "  LÁSER  ", cells: [{ value: "  LÁSER  " }] };
  const check = (candidate) => {
    h.evaluate(`globalThis.candidate = ${JSON.stringify(candidate)}`);
    return h.evaluate(`equipmentSourceHeadingRepeatsDisplayTitle(candidate, ${JSON.stringify(title)})`);
  };
  assert.equal(check(row), true);
  assert.equal(check({ ...row, type: "category" }), true);
  assert.equal(check({ ...row, type: "note" }), false);
  assert.equal(check({ ...row, type: "item", quantity: 0 }), false);
  assert.equal(check({ ...row, quantity: 0 }), false);
  assert.equal(check({ ...row, quantity: "0" }), false);
  assert.equal(check({ ...row, quantity: 2 }), false);
  assert.equal(check({ ...row, type: "header" }), true);
  assert.equal(check({ type: "header", description: "Cantidad | Descripción", cells: [{ value: "Cantidad" }, { value: "Descripción" }] }), false);
  assert.equal(check({ type: "header", description: "CUADRO DE MONTAJE", cells: [{ value: "CUADRO DE MONTAJE" }] }), false);
  assert.equal(check({ ...row, notes: ["Keep this observation"] }), false);
  assert.equal(check({ ...row, cells: [{ value: "Láser" }, { value: "Only outdoors" }] }), false);
  assert.equal(check({ ...row, cells: [{ value: "Láser" }, { value: 0 }] }), false);
  assert.equal(check({ ...row, description: "Láser.", cells: [{ value: "Láser." }] }), false);
  assert.equal(check({ ...row, description: '"Láser"', cells: [{ value: '"Láser"' }] }), false);
});

test("a homonymous note and a category carrying an extra cell are rendered", () => {
  const fixture = section("synthetic-notes", "ILUMINACION / Láser");
  fixture.rows.unshift({ type: "note", description: "Láser", cells: [{ value: "Láser" }] });
  fixture.rows[1] = { type: "category", description: "Láser · Only outdoors", cells: [{ value: "Láser" }, { value: "Only outdoors" }] };
  const h = harness([fixture]);
  const markup = h.evaluate("tableForEquipmentSections(sections, true)");
  assert.match(markup, /data-source-row-type="note"[^>]*><td[^>]*>Láser<\/td>/);
  assert.match(markup, /Láser · Only outdoors/);
});

for (const compact of [false, true]) {
  test(`observations attached to non-item rows stay visible without exact duplicates (${compact ? "PDF" : "editor"})`, () => {
    const fixture = section("synthetic-row-note", "ILUMINACION / Láser");
    fixture.rows[0].notes = ["Attached observation retained", "Attached observation retained", fixture.rows[0].description];
    fixture.notes.push("Attached observation retained");
    const h = harness([fixture]);
    const markup = h.evaluate(`tableForEquipmentSections(sections, ${compact})`);
    assert.match(markup, /data-source-row-type="category"/);
    assert.equal((markup.match(/Attached observation retained/g) || []).length, 1);
    assert.equal((markup.match(/ILUMINACION \/ Láser/g) || []).length, 2, "the category cell itself is not repeated as a note");
  });
}

test("roots and distinct subcategories from several services form contiguous category blocks", () => {
  const fixtures = [
    section("first-light", "ILUMINACION / Láser"), section("audio", "AUDIO / Consola"),
    section("second-light", "ILUMINACION / Baño de color"), section("structures", "ESTRUCTURAS / Truss"),
    section("third-light", "Luces"), section("fourth-light", "ILUMINACION")
  ];
  const h = harness(fixtures);
  assert.deepEqual(h.json("equipmentDisplaySectionGroups(sections).map(group => group.title)"), [
    "ILUMINACION / Láser", "ILUMINACION / Baño de color", "Luces", "ILUMINACION", "AUDIO / Consola", "ESTRUCTURAS / Truss"
  ]);
});

test("a standalone subtype joins its unique currently declared root, including manual/document fragments", () => {
  const fixtures = [
    section("lights", "ILUMINACION / Láser"), section("structure", "ESTRUCTURAS / ESTRUCTURA LUCES"),
    section("audio", "AUDIO"), section("standalone", "ESTRUCTURA LUCES"),
    section("manual", "Luces", { manualSection: true }), section("document", "ILUMINACION / Extra", { documentSection: true })
  ];
  const h = harness(fixtures);
  assert.deepEqual(h.json("equipmentDisplaySectionGroups(sections).flatMap(group => group.sections.map(fragment => fragment.id))"), [
    "lights", "manual", "document", "structure", "standalone", "audio"
  ]);
  const markup = h.evaluate("tableForEquipmentSections(sections, false)");
  assert.match(markup, /data-equipment-category-toggle="manual"/);
  assert.match(markup, /data-equipment-category-toggle="document"/);
  h.evaluate("equipmentState.expandedEquipmentSectionIds.add('manual')");
  const expanded = h.evaluate("tableForEquipmentSections(sections, false)");
  assert.match(expanded, /data-equipment-manual-section-title="manual"/);
  assert.match(expanded, /data-remove-equipment-section="manual"/);
});

test("a standalone subtype with multiple declared parents is not assigned a guessed root", () => {
  const h = harness([section("first", "FIRST / Shared"), section("audio", "AUDIO"),
    section("standalone", "Shared"), section("last", "LAST / Shared")]);
  assert.deepEqual(h.json("equipmentDisplaySectionGroups(sections).map(group => group.title)"), [
    "FIRST / Shared", "AUDIO", "Shared", "LAST / Shared"
  ]);
});

test("grouped source fragments keep every item ID and action without merging equipment", () => {
  const fixtures = [section("one", "ILUMINACION / Láser", { quantity: 0 }), section("audio", "AUDIO"),
    section("two", "ILUMINACION / Láser", { quantity: 2 })];
  const h = harness(fixtures);
  assert.deepEqual(h.json("equipmentDisplaySectionGroups(sections)[0].sections.map(fragment => fragment.id)"), ["one", "two"]);
  const markup = h.evaluate("tableForEquipmentSections(sections, false)");
  for (const id of ["one-item-0", "audio-item-0", "two-item-0"]) {
    assert.match(markup, new RegExp(`data-remove-equipment-item="${id}"`));
  }
  assert.equal((markup.match(/class="equipment-category-row"/g) || []).length, 2);
  h.evaluate("equipmentState.expandedEquipmentSectionIds.add(equipmentDisplaySectionGroups(sections)[0].id)");
  const expanded = h.evaluate("tableForEquipmentSections(sections, false)");
  assert.match(expanded, /data-equipment-category-add="one"/);
});

test("rendering and regrouping leave source rows, cells, ledger, quantities and saved snapshots unchanged", () => {
  const fixtures = [section("light-one", "ILUMINACION / Láser"), section("audio", "AUDIO"),
    section("light-two", "Luces", { quantity: 2 })];
  fixtures[0].sourceLedger = { cells: fixtures[0].rows.flatMap((row) => row.cells), totalCells: 3 };
  const before = JSON.stringify(fixtures);
  const h = harness(fixtures);
  const snapshot = h.json("cloneEquipmentSnapshotSections(sections)");
  h.evaluate("equipmentDisplaySectionGroups(sections); tableForEquipmentSections(sections, false); tableForEquipmentSections(warehousePdfSections(), true); tableForEquipmentSections(sections, true)");
  assert.equal(JSON.stringify(fixtures), before);
  assert.deepEqual(h.json("cloneEquipmentSnapshotSections(sections)"), snapshot);
  assert.deepEqual(h.json("equipmentDisplaySectionGroups(sections).flatMap(group => group.sections).flatMap(fragment => fragment.items.map(item => ({id: item.id, quantity: item.quantity})))"), [
    { id: "light-one-item-0", quantity: 0 }, { id: "light-two-item-0", quantity: 2 }, { id: "audio-item-0", quantity: 0 }
  ]);
});
