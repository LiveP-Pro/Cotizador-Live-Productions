const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const unzipper = require("unzipper");
const { parseServiceFile, verifyServiceImport } = require("../equipment-service-import.cjs");

async function workbook(sheets, customize) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row));
  }
  customize?.(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}

function pdf(pages, { imagePages = [], imageSize = [500, 350] } = {}) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  if (imagePages.length) objects.push("<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 7 >>\nstream\n000000>\nendstream");
  const pageIds = [];
  for (const [pageIndex, rows] of pages.entries()) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    let content = rows.map((row, index) => row.map(([x, value]) => {
      const escaped = String(value).replace(/[\\()]/g, "\\$&");
      return `BT /F1 10 Tf 1 0 0 1 ${x} ${750 - index * 22} Tm (${escaped}) Tj ET`;
    }).join("\n")).join("\n");
    const hasImage = imagePages.includes(pageIndex + 1);
    if (hasImage) content += `\nq ${imageSize[0]} 0 0 ${imageSize[1]} 40 100 cm /Im1 Do Q`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> ${hasImage ? "/XObject << /Im1 4 0 R >>" : ""} >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let result = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(result)); result += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => { result += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  result += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(result);
}

function itemRows(preview) { return preview.services.flatMap((service) => service.mainSections.flatMap((section) => section.items)); }
function rows(preview) { return preview.services.flatMap((service) => service.mainSections.flatMap((section) => section.rows)); }

test("every nonempty cell including zero, headers and extra columns survives multi-service Excel import", async () => {
  const buffer = await workbook({ "Fuente sintetica": [
    ["Servicio", "Categoria", "Descripcion", "Cantidad", "Notas", "Codigo"],
    ["Servicio A", "Audio", "Unidad modelo 2026", 0, "Revisar cable", "ABC-64"],
    ["Servicio B", "Luces", "Lampara modelo 512", 2, "Sin uso", "XYZ"],
    ["Servicio A", "Audio", "Cable de prueba", 3, "Conector", "123"],
    ["Servicio A", "Audio", null, null, "Nota sin cantidad"]
  ] });
  const preview = await parseServiceFile(buffer, { fileName: "servicios.xlsx" });
  assert.equal(preview.services.length, 2);
  assert.deepEqual(preview.services.map((service) => service.name), ["Servicio A", "Servicio B"]);
  assert.deepEqual(preview.services[0].mainSections.flatMap((section) => section.items), [[0, "Unidad modelo 2026"], [3, "Cable de prueba"]]);
  assert.equal(preview.sourceCells.length, 27);
  assert.equal(preview.sourceCells.find((cell) => cell.address === "D2").value, 0);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.verification.representedCellCount, 27);
  assert.deepEqual(preview.verification.missingRefs, []);
  assert.match(preview.source.sha256, /^[a-f0-9]{64}$/);
  assert.ok(rows(preview).some((row) => row.type === "header" && row.quantity === null));
  assert.ok(rows(preview).some((row) => row.type === "note" && row.description.includes("Nota sin cantidad") && row.quantity === null));
  assert.ok(preview.services[0].mainSections.flatMap((section) => section.notes).some((note) => note.includes("Codigo: ABC-64")));
  assert.deepEqual(rows(preview).sort((a, b) => a.sourceOrder - b.sourceOrder).flatMap((row) => row.cells.map((cell) => cell.ref)), preview.sourceCells.map((cell) => cell.ref));
});

test("multiple sheets and service blocks preserve all category headings, notes and zero rows", async () => {
  const buffer = await workbook({
    "Hoja A": [["Servicio: Paquete A"], ["Categoria: Consola"], ["Cantidad", "Descripcion"], [0, "Unidad modelo 64"], [2, "Microfono"], [null, "Nota: Incluir soporte"]],
    "Hoja B": [["Servicio: Paquete B"], ["Categoria: Luz"], ["Descripcion", "Cantidad"], ["Lampara", 3], ["Servicio: Paquete C"], ["Categoria: Tarima"], ["Descripcion", "Cantidad"], ["Plataforma", 1]]
  });
  const preview = await parseServiceFile(buffer, { fileName: "varios.xlsx" });
  assert.deepEqual(preview.services.map((service) => service.name), ["Paquete A", "Paquete B", "Paquete C"]);
  assert.deepEqual(itemRows(preview), [[0, "Unidad modelo 64"], [2, "Microfono"], [3, "Lampara"], [1, "Plataforma"]]);
  assert.equal(preview.verification.complete, true);
  assert.ok(rows(preview).some((row) => row.headingKind === "category" && row.description === "Categoria: Tarima"));
  assert.ok(rows(preview).some((row) => row.type === "note" && row.description === "Nota: Incluir soporte"));
  assert.ok(rows(preview).filter((row) => row.type !== "item").every((row) => row.quantity === null));
});

test("merged titles, rich text and cached formula zeros remain in the exact source ledger", async () => {
  const buffer = await workbook({ "Fuente": [
    ["Servicio sintetico"], ["AUDIO"], ["Cantidad", "Descripcion", "Notas"],
    [{ formula: "1-1", result: 0 }, { richText: [{ text: "Unidad " }, { text: "especial" }] }, "Detalle\nsegunda linea"]
  ] }, (book) => { book.worksheets[0].mergeCells("A1:C1"); book.worksheets[0].getCell("A2").font = { bold: true }; });
  const archive = await unzipper.Open.buffer(buffer);
  const sheetXml = (await archive.files.find((entry) => entry.path === "xl/worksheets/sheet1.xml").buffer()).toString();
  assert.match(sheetXml, /<c r="A4"[^>]*><f>1-1<\/f><v>0<\/v><\/c>/);
  const preview = await parseServiceFile(buffer, { fileName: "formatos.xlsx" });
  assert.equal(preview.services[0].name, "Servicio sintetico");
  assert.equal(preview.sourceCells.length, 8);
  assert.deepEqual(itemRows(preview), [[0, "Unidad especial"]]);
  assert.equal(preview.verification.complete, true);
  assert.deepEqual(preview.sourceCells.find((cell) => cell.address === "A4").rawValue, { formula: "1-1", result: 0 });
  assert.equal(preview.sourceCells.find((cell) => cell.address === "C4").value, "Detalle\nsegunda linea");
});

test("ambiguous quantities, missing results and model numbers preserve source but block publication", async () => {
  const buffer = await workbook({ "Prueba": [
    ["Descripcion", "Cantidad"], ["Unidad valida", 0], ["Modelo 2026", "Pendiente"],
    ["Unidad sin cantidad"], ["Formula sin cache", { formula: "1+1" }], ["Separador ambiguo", "1.000"]
  ] });
  const preview = await parseServiceFile(buffer, { fileName: "ambiguo.xlsx" });
  assert.deepEqual(itemRows(preview), [[0, "Unidad valida"]]);
  assert.equal(preview.verification.complete, false);
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
  assert.deepEqual(preview.verification.missingRefs, []);
  assert.ok(preview.verification.blockers.some((warning) => warning.includes("fórmula")));
  assert.ok(rows(preview).some((row) => row.type === "unresolved" && row.description.includes("Modelo 2026")));
  assert.equal(preview.sourceCells.find((cell) => cell.address === "B5").rawValue.formula, "1+1");
});

test("ambiguous repeated quantity headers block while retaining every competing cell", async () => {
  const buffer = await workbook({ "Prueba": [["Descripcion", "Cantidad", "Qty"], ["Unidad", 2, 5]] });
  const preview = await parseServiceFile(buffer, { fileName: "columnas.xlsx" });
  assert.equal(preview.verification.complete, false);
  assert.equal(preview.sourceCells.length, 6);
  assert.equal(preview.verification.representedCellCount, 6);
  assert.match(preview.verification.blockers.join(" "), /columnas ambiguas/);
  const adjacent = await parseServiceFile(await workbook({ "Cuadros": [
    ["Descripcion", "Cantidad", "Descripcion", "Cantidad"],
    ["Unidad izquierda", 0, "Unidad derecha", 3]
  ] }), { fileName: "dos-cuadros.xlsx" });
  assert.equal(adjacent.verification.complete, false);
  assert.equal(adjacent.sourceCells.length, 8);
  assert.equal(adjacent.verification.representedCellCount, 8);
  assert.equal(adjacent.sourceCells.find((cell) => cell.address === "B2").value, 0);
  assert.match(adjacent.verification.blockers.join(" "), /Separe los cuadros en hojas o bloques/);
});

test("explicit zero quantities win over service/category directives and header aliases in equipment descriptions", async () => {
  const preview = await parseServiceFile(await workbook({ "Fuente": [
    ["Descripcion", "Cantidad", "Notas"],
    ["Unidad A", 2, "ok"],
    ["Paquete: Cable sintetico", 0],
    ["Categoria: Adaptadores", 0],
    ["Equipo", 0, "Cantidad"],
    ["Descripcion", "Cantidad", "Notas"],
    ["Unidad B", 1, "ok"]
  ] }), { fileName: "precedencia.xlsx" });
  assert.equal(preview.services.length, 1);
  assert.deepEqual(itemRows(preview), [[2, "Unidad A"], [0, "Paquete: Cable sintetico"], [0, "Categoria: Adaptadores"], [0, "Equipo"], [1, "Unidad B"]]);
  assert.equal(preview.verification.complete, true);
  assert.equal(rows(preview).filter((row) => row.type === "header").length, 2);
});

test("verification detects removed, edited, reordered or duplicated source cells and edited generated quantities", async () => {
  const original = await parseServiceFile(await workbook({ "Prueba": [["Descripcion", "Cantidad", "Notas"], ["Unidad", 0, "Nota"]] }), { fileName: "fuente.xlsx" });
  assert.equal(verifyServiceImport(original).complete, true);
  const mutated = () => JSON.parse(JSON.stringify(original));
  const removed = mutated(); removed.services[0].mainSections[0].rows[0].cells.pop();
  assert.equal(verifyServiceImport(removed).complete, false);
  assert.ok(verifyServiceImport(removed).missingRefs.length);
  const edited = mutated(); edited.services[0].mainSections[0].rows[1].cells[0].value = "Otra unidad";
  assert.equal(verifyServiceImport(edited).complete, false);
  const quantityEdit = mutated(); quantityEdit.services[0].mainSections[0].items[0][0] = 7;
  quantityEdit.services[0].mainSections[0].rows[1].quantity = 7;
  assert.equal(verifyServiceImport(quantityEdit).complete, false);
  const reordered = mutated(); reordered.services[0].mainSections[0].rows[1].sourceOrder = 100;
  assert.equal(verifyServiceImport(reordered).complete, false);
  const cellOrder = mutated();
  const reorderedHeader = cellOrder.services[0].mainSections[0].rows[0];
  reorderedHeader.cells.reverse(); reorderedHeader.sourceRefs.reverse();
  cellOrder.services[0].sourceRefs = cellOrder.services[0].mainSections[0].rows.flatMap((row) => row.sourceRefs);
  assert.equal(verifyServiceImport(cellOrder).complete, false);
  const rowOrder = mutated(); rowOrder.services[0].mainSections[0].rows.reverse();
  rowOrder.services[0].sourceRefs = rowOrder.services[0].mainSections[0].rows.flatMap((row) => row.sourceRefs);
  assert.equal(verifyServiceImport(rowOrder).complete, false);
  const duplicated = mutated(); duplicated.services[0].mainSections[0].rows.push(duplicated.services[0].mainSections[0].rows[1]);
  assert.equal(verifyServiceImport(duplicated).complete, false);
  assert.ok(verifyServiceImport(duplicated).duplicateRefs.length);
  const omittedNote = mutated(); omittedNote.services[0].mainSections[0].notes.pop();
  assert.equal(verifyServiceImport(omittedNote).complete, false);
  const headerText = mutated();
  headerText.services[0].mainSections[0].rows[0].description = "Encabezado inventado";
  headerText.services[0].mainSections[0].notes[0] = "Encabezado inventado";
  assert.equal(verifyServiceImport(headerText).complete, false);
});

test("digital PDF keeps all pages, column text, service blocks, zero, headers and notes", async () => {
  const buffer = pdf([
    [
      [[40, "Servicio: Paquete A"]], [[40, "Categoria: Audio"]],
      [[40, "DESCRIPCION"], [320, "CANTIDAD"], [450, "NOTAS"]],
      [[40, "Unidad modelo 2026"], [335, "0"], [450, "Detalle"]],
      [[450, "Nota sin cantidad"]]
    ],
    [
      [[40, "Servicio: Paquete B"]], [[40, "Categoria: Luz"]],
      [[40, "DESCRIPCION"], [320, "CANTIDAD"], [450, "NOTAS"]],
      [[40, "Lampara modelo 512"], [335, "2"], [450, "Revisar"]],
      [[40, "Pagina 2 de 2"]]
    ]
  ]);
  const preview = await parseServiceFile(buffer, { fileName: "servicios.pdf" });
  assert.deepEqual(preview.services.map((service) => service.name), ["Paquete A", "Paquete B"]);
  assert.deepEqual(itemRows(preview), [[0, "Unidad modelo 2026"], [2, "Lampara modelo 512"]]);
  assert.equal(preview.documentLines.length, 10);
  assert.equal(preview.verification.complete, true);
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
  assert.ok(rows(preview).some((row) => row.type === "note" && row.description.includes("Nota sin cantidad")));
  assert.ok(rows(preview).some((row) => row.description.includes("Pagina 2 de 2")));
  assert.ok(rows(preview).every((row) => row.sourceRefs.every((ref) => ref.startsWith("pdf:"))));
});

test("PDF quantity-first tables read their quantity column instead of model numbers", async () => {
  const preview = await parseServiceFile(pdf([[
    [[40, "Servicio: Sintetico"]], [[40, "CANTIDAD"], [150, "EQUIPO"]],
    [[55, "3"], [150, "Modelo 512 sintetico"]], [[55, "0"], [150, "Modelo 64 sintetico"]]
  ]]), { fileName: "cantidades.pdf" });
  assert.deepEqual(itemRows(preview), [[3, "Modelo 512 sintetico"], [0, "Modelo 64 sintetico"]]);
  assert.equal(preview.verification.complete, true);
});

test("PDF without quantity headers remains represented and blocks model-number guessing", async () => {
  const preview = await parseServiceFile(pdf([[
    [[40, "Modelo 512"], [400, "2"]], [[40, "Modelo 64"], [400, "0"]]
  ]]), { fileName: "sin-encabezados.pdf" });
  assert.deepEqual(itemRows(preview), []);
  assert.equal(preview.verification.complete, false);
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
});

test("PDF mixed scanned tables with selectable footers block verification while small logos remain allowed", async () => {
  const digital = [
    [[40, "Servicio: Sintetico"]], [[40, "DESCRIPCION"], [320, "CANTIDAD"]],
    [[40, "Unidad"], [335, "0"]]
  ];
  const mixed = await parseServiceFile(pdf([digital, [[[40, "Pagina 2 de 2"]]]], { imagePages: [2] }), { fileName: "mixto.pdf" });
  assert.deepEqual(itemRows(mixed), [[0, "Unidad"]]);
  assert.equal(mixed.verification.complete, false);
  assert.equal(mixed.verification.sourceCellCount, mixed.verification.representedCellCount);
  assert.match(mixed.verification.blockers.join(" "), /Página 2.*imagen grande/);
  const samePage = await parseServiceFile(pdf([digital], { imagePages: [1] }), { fileName: "tabla-mixta.pdf" });
  assert.equal(samePage.verification.complete, false);
  const logo = await parseServiceFile(pdf([digital], { imagePages: [1], imageSize: [40, 40] }), { fileName: "logo.pdf" });
  assert.equal(logo.verification.complete, true);
});

test("invalid, scanned, empty, unsupported and oversized input have useful Spanish failures", async () => {
  await assert.rejects(parseServiceFile(Buffer.from("Invalido"), { fileName: "roto.xlsx" }), /No se pudo leer el Excel/);
  await assert.rejects(parseServiceFile(Buffer.from("Invalido"), { fileName: "roto.pdf" }), /No se pudo leer el PDF/);
  await assert.rejects(parseServiceFile(pdf([[]]), { fileName: "escaneado.pdf" }), /escaneado.*Excel original/);
  await assert.rejects(parseServiceFile(Buffer.alloc(0), { fileName: "vacio.xlsx" }), /vacío/);
  await assert.rejects(parseServiceFile(Buffer.from("xls"), { fileName: "viejo.xls" }), /\.xls deben guardarse/);
  await assert.rejects(parseServiceFile(Buffer.alloc(15 * 1024 * 1024 + 1), { fileName: "grande.xlsx" }), /15 MB/);
  await assert.rejects(parseServiceFile(pdf(Array.from({ length: 101 }, () => [])), { fileName: "largo.pdf" }), /100 páginas/);
});
