const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const corrections = require("../warehouse-import-corrections.js");

// Source rows and equipment in these tests are synthetic current workbooks.
// No existing inventory, uploaded workbook, cached catalog or credentials are read.
const clone = (value) => JSON.parse(JSON.stringify(value));
const cell = (row, column, value, sheet = "SINTETICO") => ({
  key: column, value, rawValue: value, sheet, row, column,
  address: `${String.fromCharCode(64 + column)}${row}`,
  ref: `xlsx:${sheet}:${String.fromCharCode(64 + column)}${row}`
});
const location = (row, sheet = "SINTETICO") => `Hoja «${sheet}», fila ${row}`;
const row = (index, type, cells, description, quantity = null, category = "AUDIO") => ({
  type, description, quantity, category, cells, sourceOrder: index - 1,
  sourceRow: index, sourceLocation: location(index, cells[0]?.sheet)
});

function preview() {
  const rows = [
    row(1, "header", [cell(1, 1, "INVENTARIO DISPONIBLE"), cell(1, 2, "DISPONIBLE")], "INVENTARIO DISPONIBLE | DISPONIBLE"),
    row(2, "category", [cell(2, 1, "AUDIO")], "AUDIO"),
    row(3, "item", [cell(3, 1, "Equipo sintético inicial"), cell(3, 2, 0)], "Equipo sintético inicial", 0),
    row(4, "unresolved", [cell(4, 1, "Equipo sintético pendiente 512 ")], "Equipo sintético pendiente 512 "),
    row(5, "note", [cell(5, 1, "Observación: conservar texto literal")], "Observación: conservar texto literal"),
    row(6, "item", [cell(6, 1, "Equipo sintético final"), cell(6, 2, 3)], "Equipo sintético final", 3)
  ];
  const blocker = `${location(4)}: fila sin descripción o con cantidad vacía; revise el equipo sintético.`;
  return {
    source: "Fuente sintética actual.xlsx", worksheets: ["SINTETICO"], worksheet: "SINTETICO",
    items: [
      { name: "Equipo sintético inicial", quantity: 0, category: "AUDIO", notes: "Nota del cero", sourceRow: 3, sourceLocation: location(3) },
      { name: "Equipo sintético final", quantity: 3, category: "AUDIO", notes: "", sourceRow: 6, sourceLocation: location(6) }
    ], sourceRows: rows, sourceCells: rows.flatMap(entry => entry.cells),
    warnings: [blocker], blockers: [blocker], notes: [{ text: rows[4].description, category: "AUDIO" }],
    verification: { algorithm: "inventory-source-rows-v1", complete: false, sourceCellCount: 9,
      representedCellCount: 9, unresolvedRowCount: 1, blockers: [blocker] }
  };
}

function refreshLedger(input) {
  input.sourceCells = input.sourceRows.flatMap(entry => entry.cells);
  input.verification.sourceCellCount = input.sourceCells.length;
  input.verification.representedCellCount = input.sourceCells.length;
}

test("pending quantity is editable without converting blank to zero or modifying the source", () => {
  const input = preview(), before = clone(input);
  const review = corrections.prepare(input);
  assert.equal(corrections.pending(review), 1);
  assert.deepEqual(review.blockers, []);
  assert.equal(review.entries[0].name, "Equipo sintético pendiente 512");
  assert.equal(review.entries[0].quantity, "");
  assert.deepEqual(review.entries[0].required, ["quantity"]);
  assert.equal(review.entries[0].qtyRef, "B4");
  assert.equal(review.entries[0].qtyLocation, "SINTETICO!B4");
  assert.equal(review.entries[0].decision, null);
  assert.throws(() => corrections.finalize(review), /cada fila pendiente/);
  assert.deepEqual(input, before);
});

test("explicit zero is included in source order with notes, raw cells and manual authorization intact", () => {
  const input = preview(), before = clone(input);
  const review = corrections.prepare(input);
  corrections.resolve(review, review.entries[0].id, { action: "include", quantity: "0", author: "Operador sintético" });
  const result = corrections.finalize(review);
  assert.deepEqual(result.items.map(item => [item.sourceRow, item.quantity]), [[3, 0], [4, 0], [6, 3]]);
  assert.equal(result.items[0].notes, "Nota del cero");
  assert.deepEqual(result.notes, input.notes);
  assert.deepEqual(result.sourceCells, input.sourceCells);
  assert.deepEqual(result.sourceRows, input.sourceRows);
  assert.equal(result.sourceRows[3].type, "unresolved");
  assert.equal(result.verification.algorithm, "inventory-source-rows-v1+manual-review");
  assert.equal(result.verification.complete, true);
  assert.equal(result.originalVerification.complete, false);
  assert.deepEqual(result.originalBlockers, input.blockers);
  assert.equal(result.correctionDecisions[0].authorization, "explicit-import-review");
  assert.equal(result.correctionDecisions[0].author, "Operador sintético");
  assert.equal(result.correctionDecisions[0].quantity, 0);
  assert.deepEqual(result.correctionDecisions[0].originalCells, input.sourceRows[3].cells);
  assert.equal(result.verification.sourceUnresolvedRowCount, 1);
  assert.equal(result.verification.unresolvedRowCount, 0);
  assert.deepEqual(input, before);
});

test("omitting a row is explicit and audited, while an empty replacement is refused", () => {
  const review = corrections.prepare(preview());
  corrections.resolve(review, 0, { action: "skip" });
  const result = corrections.finalize(review);
  assert.equal(result.items.length, 2);
  assert.equal(result.correctionDecisions[0].action, "skip");
  assert.equal(result.correctionDecisions[0].quantity, null);
  assert.equal(result.verification.explicitlySkippedRows, 1);
  const noValidItems = preview();
  noValidItems.items = [];
  const empty = corrections.prepare(noValidItems);
  corrections.resolve(empty, 0, { action: "skip" });
  assert.throws(() => corrections.finalize(empty), /lista vacía/);
});

test("invalid or changed counts remain pending instead of reusing a previous confirmation", () => {
  const review = corrections.prepare(preview());
  for (const value of ["", " ", null, undefined, false, -1, "-1", "1.5", "1.000", "modelo 512", "9007199254740992"]) {
    assert.throws(() => corrections.resolve(review, 0, { quantity: value }), /cantidad entera explícita/);
    assert.equal(corrections.pending(review), 1);
  }
  corrections.resolve(review, 0, { quantity: "2" });
  assert.equal(corrections.pending(review), 0);
  corrections.update(review, 0, { quantity: "" });
  assert.equal(corrections.pending(review), 1);
  assert.throws(() => corrections.finalize(review), /cada fila pendiente/);
  corrections.resolve(review, 0, { quantity: 4 });
  assert.throws(() => corrections.resolve(review, 0, { quantity: "" }), /cantidad entera explícita/);
  assert.equal(corrections.pending(review), 1);
});

test("numeric models without a declared quantity column never provide a suggested count", () => {
  const input = preview();
  input.sourceRows[0].cells[1].value = "Modelo";
  input.sourceRows[0].cells[1].rawValue = "Modelo";
  input.sourceRows[3].cells.push(cell(4, 2, 512));
  refreshLedger(input);
  const review = corrections.prepare(input);
  assert.equal(review.entries[0].quantityColumnKnown, false);
  assert.equal(review.entries[0].quantity, "");
  assert.equal(review.entries[0].qtyRef, "");
  assert.deepEqual(review.entries[0].required, ["quantity"]);
  assert.throws(() => corrections.resolve(review, 0, { action: "include" }), /cantidad entera explícita/);
  corrections.resolve(review, 0, { quantity: 2 });
  assert.equal(corrections.finalize(review).items[1].quantity, 2);
});

test("each worksheet uses its own explicit column layout and duplicate names stay separate", () => {
  const input = preview();
  const nextHeader = row(1, "header", [cell(1, 1, "Cantidad", "OTRA"), cell(1, 3, "Equipo", "OTRA")], "Cantidad | Equipo");
  const nextPending = row(2, "unresolved", [cell(2, 1, 0, "OTRA")], "0");
  nextHeader.sourceOrder = 6; nextPending.sourceOrder = 7;
  input.sourceRows.push(nextHeader, nextPending);
  refreshLedger(input);
  const issue = `${location(2, "OTRA")}: sin nombre.`;
  input.blockers.push(issue);
  const review = corrections.prepare(input);
  assert.equal(review.entries[1].qtyRef, "A2");
  assert.equal(review.entries[1].quantity, "0");
  assert.deepEqual(review.entries[1].required, ["name"]);
  corrections.resolve(review, 0, { quantity: 2 });
  corrections.resolve(review, 1, { name: "Equipo sintético pendiente 512", quantity: 0 });
  const result = corrections.finalize(review);
  assert.equal(result.items.filter(item => item.name === "Equipo sintético pendiente 512").length, 2);
  assert.equal(result.items.at(-1).sourceLocation, location(2, "OTRA"));
});

test("unlocated blockers and formula problems on otherwise valid rows cannot be silently waived", () => {
  const input = preview();
  input.blockers.push("Página 2: imagen sin texto verificable.", `${location(6)}, celda C6: la fórmula no tiene resultado.`);
  const review = corrections.prepare(input);
  corrections.resolve(review, 0, { quantity: 2 });
  assert.equal(review.blockers.length, 2);
  assert.equal(corrections.pending(review), 2);
  assert.throws(() => corrections.finalize(review), /imagen sin texto verificable/);
  const unexplained = corrections.prepare({ items: [{ name: "Unidad sintética", quantity: 0 }], verification: { complete: false } });
  assert.equal(corrections.pending(unexplained), 1);
  assert.throws(() => corrections.finalize(unexplained), /no pudo verificar/);
});

test("a manually supplied quantity resolves an uncalculated quantity formula while retaining its raw expression", () => {
  const input = preview();
  input.sourceRows[3].cells.push({ ...cell(4, 2, ""), rawValue: { formula: "1+2" } });
  refreshLedger(input);
  const issue = `${location(4)}, celda B4: la fórmula no tiene un resultado guardado.`;
  input.blockers.push(issue);
  const review = corrections.prepare(input);
  assert.equal(review.entries[0].quantity, "");
  corrections.resolve(review, 0, { quantity: 3 });
  const result = corrections.finalize(review);
  assert.equal(result.items[1].quantity, 3);
  assert.deepEqual(result.correctionDecisions[0].originalCells.at(-1).rawValue, { formula: "1+2" });
  assert.deepEqual(result.sourceCells, input.sourceCells);
});

test("completing a pending quantity does not waive a missing formula result in notes on the same row", () => {
  const input = preview();
  input.sourceRows[0].cells.push(cell(1, 3, "Notas"));
  const formulaCell = { ...cell(4, 3, ""), rawValue: { formula: "A1" } };
  input.sourceRows[3].cells.push(formulaCell);
  refreshLedger(input);
  const issue = `${location(4)}, celda C4: la fórmula no tiene un resultado guardado.`;
  input.blockers.push(issue);
  const review = corrections.prepare(input);
  assert.deepEqual(review.blockers, [issue]);
  corrections.resolve(review, 0, { quantity: 2 });
  assert.equal(corrections.pending(review), 1);
  assert.throws(() => corrections.finalize(review), /celda C4/);
});

test("PDF column anchors suggest descriptions without inventing missing counts", () => {
  const pdfCell = (index, x, value) => ({ ref: `pdf:1:${index}`, page: 1, x, value, width: 40 });
  const input = {
    source: "Fuente sintética actual.pdf", items: [{ name: "Equipo PDF válido", quantity: 1, category: "Audio", sourceLocation: "Página 1, fila 2" }],
    sourceRows: [
      { type: "header", sourceOrder: 0, sourceRow: 1, sourceLocation: "Página 1, fila 1", cells: [pdfCell(1, 40, "EQUIPO"), pdfCell(2, 370, "CANTIDAD")] },
      { type: "item", sourceOrder: 1, sourceRow: 2, sourceLocation: "Página 1, fila 2", cells: [pdfCell(3, 40, "Equipo PDF válido"), pdfCell(4, 370, "1")] },
      { type: "unresolved", sourceOrder: 2, sourceRow: 3, sourceLocation: "Página 1, fila 3", category: "Audio", description: "Equipo PDF modelo 512", cells: [pdfCell(5, 40, "Equipo PDF"), pdfCell(6, 130, "modelo 512")] }
    ], blockers: ["Página 1, fila 3: sin cantidad."], verification: { complete: false }
  };
  input.sourceCells = input.sourceRows.flatMap(entry => entry.cells);
  const review = corrections.prepare(input);
  assert.equal(review.entries[0].name, "Equipo PDF modelo 512");
  assert.equal(review.entries[0].quantity, "");
  assert.equal(review.entries[0].qtyRef, "");
  corrections.resolve(review, 0, { quantity: 0 });
  const result = corrections.finalize(review);
  assert.equal(result.items.at(-1).quantity, 0);
  assert.deepEqual(result.sourceCells, input.sourceCells);
});

test("valid input and unknown fields remain intact and the helper loads in a browser without CommonJS", () => {
  const input = preview();
  input.sourceRows = input.sourceRows.filter(entry => entry.type !== "unresolved");
  input.sourceCells = input.sourceRows.flatMap(entry => entry.cells);
  input.blockers = [];
  input.verification = { algorithm: "inventory-source-rows-v1", complete: true };
  input.otherMetadata = { literal: "  Conservar  " };
  const review = corrections.prepare(input);
  assert.equal(corrections.pending(review), 0);
  const result = corrections.finalize(review);
  assert.deepEqual(result.otherMetadata, input.otherMetadata);
  assert.deepEqual(result.verification, input.verification);
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "warehouse-import-corrections.js"), "utf8"), sandbox);
  assert.equal(typeof sandbox.window.WarehouseImportCorrections.prepare, "function");
});
