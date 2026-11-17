const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseInventoryFile } = require("../warehouse-import.cjs");

// All workbooks below are synthetic. The current customer workbook is audited
// separately and is never embedded or substituted for a test fixture.
async function parse(sheets, configure = () => {}, options = {}) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    rows.forEach(row => sheet.addRow(row));
  }
  configure(book);
  return parseInventoryFile(Buffer.from(await book.xlsx.writeBuffer()), {
    fileName: "inventario-disponible-sintetico.xlsx", ...options
  });
}

async function rejects(sheets, options = {}) {
  await assert.rejects(() => parse(sheets, undefined, options), error => {
    assert.equal(error.code, "WAREHOUSE_IMPORT_INVALID");
    assert.equal(error.statusCode, 400);
    return true;
  });
}

test("Inventario disponible and Disponible map explicit descriptions and quantities, including zero and category rows", async () => {
  const result = await parse({ INVENTARIO: [
    ["INVENTARIO DISPONIBLE", "DISPONIBLE"], ["CONSOLAS"],
    ["Consola sintética X32 con cable AC", 1],
    ["Consola sintética XR18", 2], ["ILUMINACION"],
    ["Lámpara sintética DMX512", 0]
  ] });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity, item.category, item.sourceRow]), [
    ["Consola sintética X32 con cable AC", 1, "CONSOLAS", 3],
    ["Consola sintética XR18", 2, "CONSOLAS", 4],
    ["Lámpara sintética DMX512", 0, "ILUMINACION", 6]
  ]);
  assert.equal(result.items[0].sourceLocation, "Hoja «INVENTARIO», fila 3");
  assert.equal(result.warnings.length, 2);
  assert.ok(result.warnings.every(warning => warning.includes("encabezado de categoría")));
  assert.deepEqual(result.worksheets, ["INVENTARIO"]);
  assert.equal(result.verification.complete, true);
  assert.equal(result.verification.sourceCellCount, 10);
  assert.equal(result.verification.representedCellCount, 10);
  assert.equal(result.sourceCells.find(cell => cell.address === "B6").value, 0);
});

test("normalized available headers retain separate numeric model and notes columns without treating models as quantity", async () => {
  const result = await parse({ "Audio actual": [
    ["  Inventario disponible:  ", " Disponible. ", "Modelo", "Notas"],
    ["Unidad sintética M32", 0, 2026, "Estuche actual"],
    ["Unidad sintética M64", 3, 512, "Cable actual"]
  ] });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity, item.notes]), [
    ["Unidad sintética M32", 0, "Estuche actual | 2026"],
    ["Unidad sintética M64", 3, "Cable actual | 512"]
  ]);
  assert.equal(result.warnings.length, 0);
});

test("matching descriptions remain distinct source rows and preserve zeros rather than merging counts", async () => {
  const result = await parse({ INVENTARIO: [
    ["Inventario disponible", "Disponible"], ["AUDIO"],
    ["Equipo sintético compartido", 0], ["Equipo sintético compartido", 4],
    ["VIDEO"], ["Equipo sintético compartido", 2]
  ] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.category, item.sourceRow]), [
    [0, "AUDIO", 3], [4, "AUDIO", 4], [2, "VIDEO", 6]
  ]);
  assert.equal(new Set(result.items.map(item => item.sourceLocation)).size, 3);
});

test("a description with missing quantity warns and cannot become the next equipment category", async () => {
  const result = await parse({ INVENTARIO: [
    ["Inventario disponible", "Disponible"], ["ILUMINACION"],
    ["Lámpara sintética inicial", 2], ["Lámpara sintética pendiente de cantidad"],
    ["Lámpara sintética siguiente", 3], ["EFECTOS ESPECIALES"], ["Efecto sintético final", 1]
  ] });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity, item.category]), [
    ["Lámpara sintética inicial", 2, "ILUMINACION"],
    ["Lámpara sintética siguiente", 3, "ILUMINACION"],
    ["Efecto sintético final", 1, "EFECTOS ESPECIALES"]
  ]);
  const warning = result.warnings.find(message => message.includes("Lámpara sintética pendiente de cantidad"));
  assert.match(warning, /fila 4/);
  assert.match(warning, /cantidad.*(?:vacía|inválida|falta)/);
  assert.ok(!warning.includes("encabezado de categoría"));
  assert.equal(result.verification.complete, false);
  assert.equal(result.verification.unresolvedRowCount, 1);
  assert.deepEqual(result.blockers, [warning]);
  const unresolved = result.sourceRows.find(row => row.sourceRow === 4);
  assert.equal(unresolved.type, "unresolved");
  assert.equal(unresolved.category, "ILUMINACION");
  assert.equal(unresolved.quantity, null);
  assert.deepEqual(unresolved.cells.map(cell => [cell.address, cell.value]), [
    ["A4", "Lámpara sintética pendiente de cantidad"]
  ]);
  assert.equal(result.verification.sourceCellCount, result.verification.representedCellCount);
});

test("missing available quantities cannot be inferred from a model, code or ordinal column", async () => {
  for (const label of ["Modelo", "Código", "No."]) {
    await rejects({ "Modelo derecha": [["Inventario disponible", label], ["Unidad sintética", 2026]] });
    await rejects({ "Modelo izquierda": [[label, "Inventario disponible"], [2026, "Unidad sintética"]] });
  }
  await rejects({ "Nombre sin encabezados": [["Unidad sintética X32", 1]] });
});

test("available inventory headers do not resolve ambiguous duplicate description or quantity columns", async () => {
  await rejects({ "Cantidades ambiguas": [["Inventario disponible", "Disponible", "Stock"], ["Unidad sintética", 2, 5]] });
  await rejects({ "Nombres ambiguos": [["Inventario disponible", "Descripción", "Disponible"], ["Unidad sintética uno", "Unidad sintética dos", 2]] });
});

test("equipment whose literal description matches a header still imports when its row contains an explicit quantity", async () => {
  const result = await parse({ INVENTARIO: [
    ["Inventario disponible", "Disponible"], ["AUDIO"],
    ["Inventario disponible", 0], ["Disponible", 2], ["Equipo", 3]
  ] });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity]), [
    ["Inventario disponible", 0], ["Disponible", 2], ["Equipo", 3]
  ]);
});

test("merged available descriptions keep their master cells and explicit quantity columns exactly once", async () => {
  const result = await parse({ "Columnas actuales": [
    ["LUCES"],
    [null, "Inventario disponible", null, null, "Disponible", "Notas"],
    [null, "Lámpara sintética combinada 512", null, null, 0, "Cable actual"]
  ] }, book => {
    const sheet = book.getWorksheet("Columnas actuales");
    sheet.mergeCells("B2:D2");
    sheet.mergeCells("B3:D3");
  });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity, item.category, item.notes]), [
    ["Lámpara sintética combinada 512", 0, "LUCES", "Cable actual"]
  ]);
});

test("available-header worksheet selection excludes other sheets and never falls back from an invalid selected worksheet", async () => {
  const sheets = {
    ACTUAL: [["Inventario disponible", "Disponible"], ["Equipo sintético actual X32", 0]],
    OTRO: [["Equipo", "Cantidad"], ["Otro equipo sintético", 7]],
    INVALIDO: [["Inventario disponible", "Modelo"], ["Modelo sintético sin cantidad", 2026]]
  };
  const selected = await parse(sheets, undefined, { worksheet: "ACTUAL" });
  assert.deepEqual(selected.items.map(item => [item.name, item.quantity]), [["Equipo sintético actual X32", 0]]);
  assert.deepEqual(selected.worksheets, ["ACTUAL", "OTRO", "INVALIDO"]);
  assert.equal(selected.worksheet, "ACTUAL");
  await rejects(sheets, { worksheet: "INVALIDO" });
});
