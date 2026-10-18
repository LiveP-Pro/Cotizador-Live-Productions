const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { parseServiceFile, verifyServiceImport } = require("../equipment-service-import.cjs");

async function source(rows, configure) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Fuente sintética");
  rows.forEach((row) => sheet.addRow(row));
  configure?.(sheet);
  return Buffer.from(await book.xlsx.writeBuffer());
}
const allRows = (preview) => preview.services.flatMap((service) => service.mainSections.flatMap((section) => section.rows));
const items = (preview) => preview.services.flatMap((service) => service.mainSections.flatMap((section) => section.items));

test("Excel conserva espacios exactos de las descripciones, también con cantidad cero", async () => {
  const descriptions = ["Unidad sintética ", "  Cable  de prueba\nsegunda línea  ", "Rich text con espacio "];
  const file = await source([
    ["Servicio: Prueba de espacios"], ["Cantidad", "Descripción"],
    [0, descriptions[0]], [2, descriptions[1]],
    [{ formula: "1-1", result: 0 }, { richText: [{ text: "Rich text " }, { text: "con espacio " }] }]
  ]);
  const preview = await parseServiceFile(file, { fileName: "espacios-sinteticos.xlsx" });
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.deepEqual(items(preview), [[0, descriptions[0]], [2, descriptions[1]], [0, descriptions[2]]]);
  const itemRows = allRows(preview).filter((row) => row.type === "item");
  assert.deepEqual(itemRows.map((row) => row.description), descriptions);
  for (const [index, address] of ["B3", "B4", "B5"].entries()) {
    const cell = preview.sourceCells.find((entry) => entry.address === address);
    assert.equal(cell.value, descriptions[index]);
    assert.equal(itemRows[index].cells.find((entry) => entry.ref === cell.ref).value, descriptions[index]);
  }
  assert.equal(verifyServiceImport(preview).complete, true);
});

test("la comparación celda por celda detecta si se recorta una descripción original", async () => {
  const preview = await parseServiceFile(await source([
    ["Servicio: Prueba exacta"], ["Cantidad", "Descripción"], [0, "Equipo sintético "], [1, "Otra unidad"]
  ]), { fileName: "verificacion-exacta.xlsx" });
  const section = preview.services[0].mainSections.find((entry) => entry.items.length);
  section.items[0][1] = section.items[0][1].trim();
  section.rows.find((row) => row.type === "item").description = section.items[0][1];
  const verification = verifyServiceImport(preview);
  assert.equal(verification.complete, false);
  assert.ok(verification.blockers.some((blocker) => /descripción no coincide/.test(blocker)));
});

test("los cuadros sin encabezados conservan sus espacios y no aceptan descripción vacía", async () => {
  const preview = await parseServiceFile(await source([
    ["Cuadro sintético"], [0, "Unidad cero  "], [1, "  Unidad uno"]
  ]), { fileName: "sin-encabezados-espacios.xlsx" });
  assert.equal(preview.verification.complete, true);
  assert.deepEqual(items(preview), [[0, "Unidad cero  "], [1, "  Unidad uno"]]);
  const blank = await parseServiceFile(await source([
    ["Servicio: Incompleto"], ["Cantidad", "Descripción"], [0, "   "]
  ]), { fileName: "vacio-sintetico.xlsx" });
  assert.equal(blank.verification.complete, false);
  assert.deepEqual(items(blank), []);
  assert.equal(blank.verification.sourceCellCount, blank.verification.representedCellCount);
});
