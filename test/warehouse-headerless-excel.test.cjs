const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseInventoryFile } = require("../warehouse-import.cjs");

async function workbook(sheets, configure = () => {}) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    rows.forEach(row => sheet.addRow(row));
  }
  configure(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function parse(sheets, configure, options = {}) {
  return parseInventoryFile(await workbook(sheets, configure), { fileName: "inventario-actual-sintetico.xlsx", ...options });
}

async function reject(sheets, configure, options = {}) {
  await assert.rejects(() => parse(sheets, configure, options), error => {
    assert.equal(error.code, "WAREHOUSE_IMPORT_INVALID");
    assert.equal(error.statusCode, 400);
    return true;
  });
}

test("a quantity-first initial inventory sheet imports category rows, descriptions and extra notes without headers", async () => {
  const result = await parse({ "INVENTARIO INICIAL": [
    ["INVENTARIO"], ["CONSOLAS"],
    [1, "Consola sintética X32 mesa digital cable AC", "Estuche sintético"],
    [2, "Consola sintética X16", "Cable AC incluido", "Revisión sintética"],
    ["MICROFONOS"], [4, "Micrófono sintético SM58"]
  ] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.name, item.category]), [
    [1, "Consola sintética X32 mesa digital cable AC", "CONSOLAS"],
    [2, "Consola sintética X16", "CONSOLAS"], [4, "Micrófono sintético SM58", "MICROFONOS"]
  ]);
  assert.equal(result.items[0].notes, "Estuche sintético");
  assert.equal(result.items[1].notes, "Cable AC incluido | Revisión sintética");
  assert.equal(result.items[0].sourceRow, 3);
  assert.equal(result.items[0].sourceLocation, "Hoja «INVENTARIO INICIAL», fila 3");
});

test("a single quantity-first row is enough when the two columns are unambiguous", async () => {
  const result = await parse({ "Una fila actual": [[9, "Equipo sintético G7"]] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.name, item.category]), [[9, "Equipo sintético G7", "Sin categoría"]]);
});

test("name-first numeric values require explicit quantity headings instead of inferred model counts", async () => {
  await reject({ "Nombre primero": [["Cable sintético K12.2", 0, "Conector sintético", "Caja actual"], ["Cable sintético K12.20", 3]] });
  const result = await parse({ "Nombre con encabezados": [["Equipo", "Cantidad", "Notas"], ["Cable sintético K12.2", 0, "Conector sintético"]] });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity, item.notes]), [["Cable sintético K12.2", 0, "Conector sintético"]]);
});

test("literal zero and a formula with cached zero remain valid headerless quantities", async () => {
  const result = await parse({ "Ceros actuales": [[0, "Unidad cero literal sintética"], [{ formula: "1-1", result: 0 }, "Unidad cero calculada sintética"], [0, "Equipo", "Notas"]] });
  assert.deepEqual(result.items.map(item => item.quantity), [0, 0, 0]);
  assert.deepEqual(result.items.map(item => item.sourceRow), [1, 2, 3]);
  assert.equal(result.items[2].notes, "Notas");
  assert.ok(!result.warnings.some(warning => /fórmula no tiene un resultado/.test(warning)));
});

test("a formula without a cached value never borrows model digits as the quantity", async () => {
  const result = await parse({ "Fórmula pendiente": [[3, "Equipo sintético S20"], [{ formula: "2+3" }, "Micrófono sintético 512"]] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.name]), [[3, "Equipo sintético S20"]]);
  assert.ok(result.warnings.some(warning => /fórmula no tiene un resultado/.test(warning)));
});

test("merged quantity-first descriptions use their master cell exactly once", async () => {
  const result = await parse({ "Cantidad con combinadas": [["INVENTARIO"], ["CONSOLAS"], [0, "Consola sintética combinada X32", null, null, "Cable actual"]] }, book => {
    const sheet = book.getWorksheet("Cantidad con combinadas");
    sheet.mergeCells("A1:E1"); sheet.mergeCells("A2:E2"); sheet.mergeCells("B3:D3");
  });
  assert.equal(result.items.length, 1);
  assert.deepEqual([result.items[0].quantity, result.items[0].name, result.items[0].category, result.items[0].notes], [0, "Consola sintética combinada X32", "CONSOLAS", "Cable actual"]);
});

test("merged name-first spans require explicit headers and then use the description master once", async () => {
  await reject({ "Nombre sin encabezados": [["LUCES"], ["Lámpara sintética combinada 512", null, null, 2]] }, book => {
    book.getWorksheet("Nombre sin encabezados").mergeCells("A2:C2");
  });
  const result = await parse({ "Nombre con encabezados": [["LUCES"], ["Equipo", null, null, "Cantidad"], ["Lámpara sintética combinada 512", null, null, 2]] }, book => {
    book.getWorksheet("Nombre con encabezados").mergeCells("A3:C3");
  });
  assert.deepEqual(result.items.map(item => [item.name, item.quantity, item.category]), [["Lámpara sintética combinada 512", 2, "LUCES"]]);
});

test("current worksheets keep quantity-first inference separate from explicit name-first mappings", async () => {
  const result = await parse({ "Cantidad primero": [["CONSOLAS"], [1, "Unidad sintética X32"]], "Nombre sin encabezados": [["LUCES"], ["Unidad sin encabezados sintética 512", 0]], "Nombre con encabezados": [["LUCES"], ["Equipo", "Cantidad"], ["Unidad cuantificada sintética 512", 0]] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.category, item.sourceRow]), [[1, "CONSOLAS", 2], [0, "LUCES", 3]]);
  assert.ok(result.items[0].sourceLocation.includes("Cantidad primero"));
  assert.ok(result.items[1].sourceLocation.includes("Nombre con encabezados"));
  assert.ok(result.warnings.some(warning => warning.includes("Nombre sin encabezados")));
});

test("a clearly formatted category between items changes only subsequent headerless items", async () => {
  const result = await parse({ "Categorías actuales": [["Audio sintético"], [1, "Consola sintética C7"], ["Video sintético"], [2, "Pantalla sintética V8"]] }, book => {
    const sheet = book.getWorksheet("Categorías actuales"); sheet.getCell("A1").font = { bold: true }; sheet.getCell("A3").font = { bold: true };
  });
  assert.deepEqual(result.items.map(item => item.category), ["Audio sintético", "Video sintético"]);
});

test("partial equipment/model headings prevent model numbers from becoming quantities in either orientation", async () => {
  await reject({ "Modelo derecha": [["Equipo", "Modelo"], ["Unidad sintética", 2026], ["Cable sintético", 64]] });
  await reject({ "Modelo izquierda": [["Modelo", "Equipo"], [2026, "Unidad sintética"], [64, "Cable sintético"]] });
});

test("a No. column cannot silently become an inferred quantity column", async () => {
  await reject({ "Número izquierda": [["No.", "Equipo"], [1, "Unidad sintética"], [2, "Cable sintético"]] });
  await reject({ "Número derecha": [["Equipo", "No."], ["Unidad sintética", 1], ["Cable sintético", 2]] });
});

test("two numeric columns without headings are ambiguous rather than guessed quantities", async () => {
  await reject({ "Números ambiguos": [[1, "Unidad sintética X32", 32], [2, "Unidad sintética X16", 16]] });
});

test("a headerless row with multiple numbers is skipped with its source text preserved in warnings", async () => {
  const result = await parse({ "Filas actuales mixtas": [[3, "Unidad válida sintética V8"], [1, "Compresor sintético N22", 32], [0, "Unidad válida sintética cero"]] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.name]), [[3, "Unidad válida sintética V8"], [0, "Unidad válida sintética cero"]]);
  assert.ok(result.warnings.some(warning => warning.includes("Compresor sintético N22") && warning.includes("32")));
});

test("an explicit quantity heading still permits a separate numeric model column", async () => {
  const result = await parse({ "Encabezados completos": [["Cantidad", "Equipo", "Modelo"], [0, "Unidad sintética", 2026]] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.name, item.notes]), [[0, "Unidad sintética", "2026"]]);
});

test("a later complete heading can import a valid region after a rejected partial heading", async () => {
  const result = await parse({ "Regiones actuales": [["Equipo", "Modelo"], ["Unidad no cuantificada sintética", 2026], [], ["Cantidad", "Equipo"], [0, "Unidad cuantificada sintética"]] });
  assert.deepEqual(result.items.map(item => [item.quantity, item.name, item.sourceRow]), [[0, "Unidad cuantificada sintética", 5]]);
});


test("selecting the current zero-only worksheet excludes lost-sheet duplicates and preserves workbook sheet choices", async () => {
  const sheets = {
    "INICIAL ÁUDIO": [["CONSOLAS"], [0, "Consola seleccionada sintética X32"]],
    "PERDIDO": [["CONSOLAS"], [3, "Consola seleccionada sintética X32"]],
    "LUCES ACTUALES": [["Cantidad", "Equipo"], [2, "Lámpara seleccionada sintética P8"]],
    "SIN DATOS": [["Equipo", "Modelo"], ["Modelo no cuantificado sintético", 2026]]
  };
  const selected = await parse(sheets, undefined, { worksheet: "INICIAL ÁUDIO" });
  assert.deepEqual(selected.items.map(item => [item.quantity, item.name]), [[0, "Consola seleccionada sintética X32"]]);
  assert.deepEqual(selected.worksheets, Object.keys(sheets));
  assert.equal(selected.worksheet, "INICIAL ÁUDIO");
  assert.equal(selected.items[0].sourceRow, 2);
  assert.ok(selected.items[0].sourceLocation.includes("INICIAL ÁUDIO"));
  const all = await parse(sheets);
  assert.equal(all.worksheet, "");
  assert.deepEqual(all.worksheets, Object.keys(sheets));
  assert.deepEqual(all.items.map(item => item.quantity), [0, 3, 2]);
});

test("an unknown selected worksheet is rejected rather than importing another sheet", async () => {
  await reject({ "INICIAL": [[0, "Unidad actual sintética"]] }, undefined, { worksheet: "No existe" });
});

test("an invalid selected worksheet cannot fall back to valid stock elsewhere in the workbook", async () => {
  await reject({ "INICIAL": [[0, "Unidad actual sintética"]], "SIN DATOS": [["Equipo", "Modelo"], ["Modelo sintético", 2026]] }, undefined, { worksheet: "SIN DATOS" });
});
