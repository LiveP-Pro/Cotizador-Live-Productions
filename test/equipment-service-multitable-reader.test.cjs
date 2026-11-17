const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { parseServiceFile, readSourceFile, verifyServiceImport } = require("../equipment-service-import.cjs");

// These are current synthetic sources. No stored inventories, earlier exports,
// application catalogs or customer workbooks supply test fixture values.
async function workbook(sheets, configure = () => {}) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    rows.forEach(row => sheet.addRow(row));
  }
  configure(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}

const serviceItems = service => service.mainSections.flatMap(section => section.items);
const rows = preview => preview.services.flatMap(service => service.mainSections.flatMap(section => section.rows));
const digest = content => crypto.createHash("sha256").update(content).digest("hex");

function complete(preview) {
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.equal(verifyServiceImport(preview).complete, true);
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
  assert.deepEqual(preview.verification.missingRefs, []);
  assert.deepEqual(preview.verification.mismatchedRefs, []);
  assert.deepEqual(preview.verification.duplicateRefs, []);
  const represented = rows(preview).flatMap(row => row.cells);
  assert.equal(represented.length, preview.sourceCells.length);
  assert.equal(new Set(represented.map(cell => cell.ref)).size, preview.sourceCells.length);
  const sourceByRef = new Map(preview.sourceCells.map(cell => [cell.ref, cell]));
  represented.forEach(cell => assert.deepEqual(cell, sourceByRef.get(cell.ref)));
}

test("explicit headers in titled parallel tables preserve every cell, extra note and zero independently", async () => {
  const file = await workbook({ "Audio sintético": [
    ["Servicio: Audio alfa", null, null, "Servicio: Audio beta"],
    ["Cantidad", "Descripción", "Notas", "Cantidad", "Descripción", "Notas"],
    [0, "  Unidad literal alfa  ", "Nota alfa", 2, "Unidad beta", "Nota beta"],
    [1, "Otra unidad alfa", null, "0", "Unidad cero beta"],
    [null, null, "Observación: conservar A", null, null, "Observación: conservar B"]
  ] });
  const hash = digest(file);
  const preview = await parseServiceFile(file, { fileName: "paralelos-sinteticos.xlsx" });
  complete(preview);
  assert.deepEqual(preview.services.map(service => service.name), ["Audio alfa", "Audio beta"]);
  assert.deepEqual(preview.services.map(serviceItems), [
    [[0, "  Unidad literal alfa  "], [1, "Otra unidad alfa"]],
    [[2, "Unidad beta"], [0, "Unidad cero beta"]]
  ]);
  assert.equal(preview.sourceCells.length, 20);
  assert.deepEqual(preview.services.map(service => service.sourceSheet), ["Audio sintético", "Audio sintético"]);
  assert.ok(rows(preview).some(row => row.description === "Observación: conservar A"));
  assert.ok(rows(preview).some(row => row.description === "Observación: conservar B"));
  assert.equal(digest(file), hash);
  assert.equal(preview.source.sha256, hash);
});

test("plain titled vertical tables and a separate worksheet retain source order without being fused", async () => {
  const file = await workbook({
    "Cuadros verticales": [
      ["Servicio sintético primero"], ["Cantidad", "Descripción", "Notas"],
      [0, "Unidad de la primera tabla", "Nota primera"],
      [null, null, "Observación: cierre primero"], [],
      ["Servicio sintético segundo"], ["Cantidad", "Descripción", "Notas"],
      [4, "Unidad de la segunda tabla", "Nota segunda"]
    ],
    "Luces sintéticas": [
      ["Servicio: Luz separada"], ["Descripción", "Cantidad"], ["Unidad de otra hoja", 3]
    ]
  }, book => {
    for (const address of ["A1", "A6"]) book.worksheets[0].getCell(address).font = { bold: true };
  });
  const preview = await parseServiceFile(file, { fileName: "verticales-y-hojas.xlsx" });
  complete(preview);
  assert.deepEqual(preview.services.map(service => service.name), [
    "Servicio sintético primero", "Servicio sintético segundo", "Luz separada"
  ]);
  assert.deepEqual(preview.services.map(serviceItems), [
    [[0, "Unidad de la primera tabla"]], [[4, "Unidad de la segunda tabla"]], [[3, "Unidad de otra hoja"]]
  ]);
  assert.deepEqual(preview.services.map(service => service.sourceSheet), [
    "Cuadros verticales", "Cuadros verticales", "Luces sintéticas"
  ]);
  assert.ok(preview.services[0].sourceRefs.includes("xlsx:1:C4"));
  assert.ok(!preview.services[1].sourceRefs.includes("xlsx:1:C4"));
  assert.ok(preview.services[2].sourceRefs.every(ref => ref.startsWith("xlsx:2:")));
});

test("separate vertical service declarations with the same name remain separate source tables", async () => {
  const preview = await parseServiceFile(await workbook({ "Repetidos sintéticos": [
    ["Servicio: Nombre compartido"], ["Cantidad", "Descripción"], [5, "Equipo del cuadro primero"], [],
    ["Servicio: Nombre compartido"], ["Cantidad", "Descripción"], [0, "Equipo del cuadro segundo"]
  ] }), { fileName: "nombres-repetidos.xlsx" });
  complete(preview);
  assert.deepEqual(preview.services.map(service => service.name), ["Nombre compartido", "Nombre compartido"]);
  assert.deepEqual(preview.services.map(serviceItems), [[[5, "Equipo del cuadro primero"]], [[0, "Equipo del cuadro segundo"]]]);
  assert.ok(preview.services[0].sourceRefs.includes("xlsx:1:A1"));
  assert.ok(!preview.services[0].sourceRefs.includes("xlsx:1:A5"));
  assert.ok(preview.services[1].sourceRefs.includes("xlsx:1:A5"));
});

test("a global preamble is preserved in the first real table instead of creating a service without equipment", async () => {
  for (const data of [
    [
      ["Resumen sintético actual"],
      ["Servicio: Alfa", null, null, "Servicio: Beta"],
      ["Cantidad", "Descripción", null, "Cantidad", "Descripción"],
      [0, "Unidad alfa", null, 2, "Unidad beta"]
    ],
    [
      ["Resumen sintético actual"], ["Servicio: Alfa"], ["Cantidad", "Descripción"], [0, "Unidad alfa"], [],
      ["Servicio: Beta"], ["Cantidad", "Descripción"], [2, "Unidad beta"]
    ]
  ]) {
    const preview = await parseServiceFile(await workbook({ "Cuadros con preámbulo": data }), { fileName: "preambulo.xlsx" });
    complete(preview);
    assert.deepEqual(preview.services.map(service => service.name), ["Alfa", "Beta"]);
    assert.deepEqual(preview.services.map(serviceItems), [[[0, "Unidad alfa"]], [[2, "Unidad beta"]]]);
    const prefix = preview.services[0].mainSections.flatMap(section => section.rows).find(row => row.sourceRefs.includes("xlsx:1:A1"));
    assert.equal(prefix.type, "note");
    assert.equal(prefix.description, "Resumen sintético actual");
    assert.ok(!preview.services[1].sourceRefs.includes("xlsx:1:A1"));
  }
});

test("quantity-first inferred tables accept explicit quantity/category headings without inventing an item", async () => {
  const preview = await parseServiceFile(await workbook({ "Estructura sintética": [
    ["Paquete sintético"], ["Cantidad", "Consola"], [0, "Mesa sintética modelo 32"], [2, "Mesa sintética modelo 64"],
    ["Cantidad", "Iluminación"], [3, "Unidad sintética modelo 512"]
  ] }), { fileName: "categorias-con-cantidad.xlsx" });
  complete(preview);
  assert.deepEqual(preview.services.map(serviceItems), [[[0, "Mesa sintética modelo 32"], [2, "Mesa sintética modelo 64"], [3, "Unidad sintética modelo 512"]]]);
  assert.deepEqual(preview.services[0].mainSections.filter(section => section.items.length).map(section => section.title), ["Consola", "Iluminación"]);
  assert.equal(preview.sourceCells.length, 11);
  assert.equal(rows(preview).some(row => row.type === "unresolved"), false);
});

test("competing adjacent columns without separate titles remain fully represented and cannot be certified", async () => {
  for (const data of [
    [["Descripción", "Cantidad", "Descripción", "Cantidad"], ["Unidad izquierda", 0, "Unidad derecha", 3]],
    [["Ficha sintética ambigua"], [1, "Modelo 64", 2, "Posible otro cuadro"], [3, "Modelo 72", 4, "Detalle adicional"]]
  ]) {
    const preview = await parseServiceFile(await workbook({ "Ambigüedad sintética": data }), { fileName: "ambiguo.xlsx" });
    assert.equal(preview.verification.complete, false);
    assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
    assert.deepEqual(preview.verification.missingRefs, []);
    assert.deepEqual(preview.verification.duplicateRefs, []);
  }
});

function sheetsForSelection() {
  return {
    "Audio actual": [["Servicio: Audio actual"], ["Cantidad", "Descripción"], [0, "Unidad de audio actual"]],
    "INVENTARIO": [["Servicio: Cuadro que requiere selección expresa"], ["Cantidad", "Descripción"], [99, "Unidad de la hoja inventario"]],
    "Inventario de luces": [["Servicio: Luz actual"], ["Cantidad", "Descripción"], [2, "Unidad de luces actual"]]
  };
}

test("service import reports all worksheets and explicitly excludes the inventory sheet by default", async () => {
  const file = await workbook(sheetsForSelection());
  const preview = await parseServiceFile(file, { fileName: "seleccion.xlsx" });
  complete(preview);
  assert.deepEqual(preview.source.worksheets, ["Audio actual", "INVENTARIO", "Inventario de luces"]);
  assert.deepEqual(preview.source.selectedSheets, ["Audio actual", "Inventario de luces"]);
  assert.deepEqual(preview.source.excludedSheets, ["INVENTARIO"]);
  assert.deepEqual(preview.services.map(service => service.sourceSheet), ["Audio actual", "Inventario de luces"]);
  assert.equal(preview.sourceCells.length, 10);
  assert.ok(!preview.sourceCells.some(cell => cell.sheet === "INVENTARIO"));
  assert.ok(preview.warnings.some(warning => /INVENTARIO/.test(warning)));
  const raw = await readSourceFile(file, { fileName: "seleccion.xlsx" });
  assert.equal(raw.sourceCells.length, 15, "El lector compartido de documentos mantiene su alcance original sin excluir hojas");
});

test("explicit worksheet selection follows physical workbook order and can intentionally include any sheet", async () => {
  const file = await workbook(sheetsForSelection());
  const preview = await parseServiceFile(file, { fileName: "elegidas.xlsx", selectedSheets: ["Inventario de luces", "Audio actual"] });
  complete(preview);
  assert.deepEqual(preview.source.selectedSheets, ["Audio actual", "Inventario de luces"]);
  assert.deepEqual(preview.services.map(service => service.name), ["Audio actual", "Luz actual"]);
  const explicit = await parseServiceFile(file, { fileName: "elegidas.xlsx", selectedSheets: ["INVENTARIO"] });
  complete(explicit);
  assert.deepEqual(explicit.source.selectedSheets, ["INVENTARIO"]);
  assert.deepEqual(explicit.source.excludedSheets, ["Audio actual", "Inventario de luces"]);
  assert.deepEqual(explicit.services.map(serviceItems), [[[99, "Unidad de la hoja inventario"]]]);
  assert.ok(explicit.sourceCells.every(cell => cell.sheet === "INVENTARIO"));
});

test("invalid, empty or unknown worksheet selections fail clearly before any table can be certified", async () => {
  const file = await workbook(sheetsForSelection());
  for (const selectedSheets of [[], ["Hoja que no existe"], "Audio actual", [7]]) {
    await assert.rejects(() => parseServiceFile(file, { fileName: "seleccion.xlsx", selectedSheets }), error => {
      assert.equal(error.code, "EQUIPMENT_SERVICE_IMPORT_INVALID");
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /hoja|selecci/i);
      return true;
    });
  }
});

test("verification rejects a changed physical source sheet instead of trusting display metadata", async () => {
  const preview = await parseServiceFile(await workbook({ "Hoja real": [
    ["Servicio: Origen visible"], ["Cantidad", "Descripción"], [0, "Unidad del origen actual"]
  ] }), { fileName: "origen.xlsx" });
  complete(preview);
  const changed = JSON.parse(JSON.stringify(preview));
  changed.services[0].sourceSheet = "Hoja distinta";
  assert.equal(verifyServiceImport(changed).complete, false);
  assert.ok(verifyServiceImport(changed).blockers.some(message => /hoja|origen/i.test(message)));
  const missing = JSON.parse(JSON.stringify(preview));
  delete missing.services[0].sourceSheet;
  assert.equal(verifyServiceImport(missing).complete, false);
  const changedTable = JSON.parse(JSON.stringify(preview));
  changedTable.services[0].sourceTableIndex += 1;
+  assert.equal(verifyServiceImport(changedTable).complete, false);
});
