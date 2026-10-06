const assert = require("node:assert/strict");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { parseInventoryFile } = require("../warehouse-import.cjs");

async function xlsx(sheets) {
  const workbook = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row));
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// Minimal synthetic PDFs keep fixtures independent from equipment catalogs.
function pdf(pages) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageIds = [];
  for (const rows of pages) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    const content = rows.map((row, index) => (row.cells || row).map(([x, value]) => {
      const escaped = String(value).replace(/[\\()]/g, "\\$&");
      return `BT /F1 10 Tf 1 0 0 1 ${x} ${row.y ?? (750 - index * 22)} Tm (${escaped}) Tj ET`;
    }).join("\n")).join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { body += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

test("Excel imports all sheets, categories, notes and zero without treating model numbers as quantities", async () => {
  const buffer = await xlsx({
    "Equipo de prueba": [
      ["Inventario sintetico"],
      ["Descripción", "Cantidad", "Observaciones", "Codigo"],
      ["Audio"],
      ["Unidad modelo 2026", 0, "Pendiente de revisar", "ABC-64"],
      ["Cable modelo 64", 3, "Conector nuevo"]
    ],
    "Luces de prueba": [
      ["Nombre", "Stock", "Categoria", "Notas"],
      ["Lampara 512", 2, "Iluminacion", "Sintetico"]
    ]
  });
  const result = await parseInventoryFile(buffer, { fileName: "prueba.xlsx" });
  assert.equal(result.source, "prueba.xlsx");
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items[0], {
    name: "Unidad modelo 2026", category: "Audio", quantity: 0,
    notes: "Pendiente de revisar | ABC-64", sourceRow: 4,
    sourceLocation: "Hoja «Equipo de prueba», fila 4"
  });
  assert.equal(result.items[2].category, "Iluminacion");
  assert.equal(result.items[2].notes, "Sintetico");
});

test("Excel uses cached formula values and preserves rich text descriptions", async () => {
  const buffer = await xlsx({ "Prueba": [
    ["Equipo", "Cantidad"],
    [{ richText: [{ text: "Unidad " }, { text: "sintetica" }] }, { formula: "1+2", result: 3 }],
    ["Unidad cero", { formula: "1-1", result: 0 }],
    ["Sin resultado", { formula: "4+1" }]
  ] });
  const result = await parseInventoryFile(buffer, { fileName: "formula.xlsx" });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].quantity, 3);
  assert.equal(result.items[0].name, "Unidad sintetica");
  assert.equal(result.items[1].quantity, 0);
  assert.equal(result.items[1].name, "Unidad cero");
  assert.ok(!result.warnings.some((warning) => warning.includes("Unidad cero")));
  assert.ok(result.warnings.some((warning) => warning.includes("fórmula no tiene un resultado")));
  assert.ok(result.warnings.some((warning) => warning.includes("Sin resultado")));
});

test("Excel rejects ambiguous quantity columns", async () => {
  const buffer = await xlsx({ "Prueba": [["Equipo", "Cantidad", "Stock"], ["Unidad", 2, 5]] });
  await assert.rejects(parseInventoryFile(buffer, { fileName: "ambiguo.xlsx" }), /varias columnas/);
});

test("Excel warnings retain unquantified, fractional and ambiguous rows for review", async () => {
  const buffer = await xlsx({ "Prueba": [
    ["Equipo", "Cantidad", "Notas"],
    ["Valido", "0", "Nota"],
    ["Modelo 512", "Pendiente", "No inventar cantidad"],
    ["Fraccion", 1.5],
    ["Ambiguo", "1.000"],
    ["Excesivo", "99999999999999999999.0"]
  ] });
  const result = await parseInventoryFile(buffer, { fileName: "cantidades.xlsx" });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].quantity, 0);
  for (const name of ["Modelo 512", "Fraccion", "Ambiguo", "Excesivo"]) assert.ok(result.warnings.some((warning) => warning.includes(name)));
});

test("Excel without quantity headers never uses description model numbers as quantities", async () => {
  const buffer = await xlsx({ "Prueba": [["Equipo", "Modelo"], ["Unidad", "2026"], ["Cable", "64"]] });
  await assert.rejects(parseInventoryFile(buffer, { fileName: "sin-cantidad.xlsx" }), /encabezados/);
});

test("digital PDF reads positioned table columns, categories and zero across pages", async () => {
  const buffer = pdf([
    [
      [[40, "EQUIPO"], [370, "CANTIDAD"], [465, "NOTAS"]],
      [[40, "Audio sintetico"]],
      [[40, "Unidad modelo 2026"], [385, "0"], [465, "Revisar"]],
      [[40, "Cable 64"], [385, "4"], [465, "Nuevo"]]
    ],
    [
      [[40, "DESCRIPCION"], [370, "QTY"], [465, "OBSERVACIONES"]],
      [[40, "Prueba de luces"]],
      [[40, "Lampara 512"], [385, "2"], [465, "Sin uso"]]
    ]
  ]);
  const result = await parseInventoryFile(buffer, { fileName: "prueba.pdf" });
  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items.map((item) => item.quantity), [0, 4, 2]);
  assert.deepEqual(result.items.map((item) => item.name), ["Unidad modelo 2026", "Cable 64", "Lampara 512"]);
  assert.equal(result.items[0].category, "Audio sintetico");
  assert.equal(result.items[2].category, "Prueba de luces");
  assert.equal(result.items[0].notes, "Revisar");
  assert.equal(result.items[2].sourceLocation, "Página 2, fila 3");
});

test("PDF quantity-first headers identify quantities separately from model numbers", async () => {
  const buffer = pdf([[
    [[40, "CANTIDAD"], [150, "EQUIPO"]],
    [[55, "3"], [150, "Unidad modelo 512"]],
    [[55, "0"], [150, "Unidad modelo 64"]]
  ]]);
  const result = await parseInventoryFile(buffer, { fileName: "cantidad-primero.pdf" });
  assert.deepEqual(result.items.map((item) => item.quantity), [3, 0]);
  assert.equal(result.items[0].name, "Unidad modelo 512");
});

test("PDF wrapped descriptions and notes continue the previous item without discarding distinct unquantified rows", async () => {
  const buffer = pdf([[
    { y: 750, cells: [[40, "EQUIPO"], [370, "CANTIDAD"], [465, "NOTAS"]] },
    { y: 728, cells: [[40, "Unidad modelo 512"], [385, "2"], [465, "Nota primera"]] },
    { y: 716, cells: [[40, "con accesorio sintetico"], [465, "segunda parte"]] },
    { y: 687, cells: [[40, "Articulo sin cantidad"]] },
    { y: 665, cells: [[40, "Otra unidad"], [385, "0"]] }
  ]]);
  const result = await parseInventoryFile(buffer, { fileName: "multilinea.pdf" });
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].name, "Unidad modelo 512 con accesorio sintetico");
  assert.equal(result.items[0].notes, "Nota primera segunda parte");
  assert.equal(result.items[1].category, "Sin categoría");
  assert.ok(result.warnings.some((warning) => warning.includes("Articulo sin cantidad") && warning.includes("cantidad vacía")));
});

test("worksheet names are locations rather than inferred inventory categories", async () => {
  const buffer = await xlsx({ "INVENTARIO": [["Equipo", "Cantidad"], ["Unidad sintetica", 3], ["Articulo sin cantidad"], ["Otra unidad", 2]] });
  const result = await parseInventoryFile(buffer, { fileName: "categorias.xlsx" });
  assert.deepEqual(result.items.map((item) => item.category), ["Sin categoría", "Sin categoría"]);
  assert.ok(result.warnings.some((warning) => warning.includes("Articulo sin cantidad") && warning.includes("cantidad vacía")));
  assert.match(result.items[0].sourceLocation, /INVENTARIO/);
});

test("oversized files and PDFs exceeding page limits fail before extraction", async () => {
  await assert.rejects(parseInventoryFile(Buffer.alloc(15 * 1024 * 1024 + 1), { fileName: "grande.xlsx" }), /15 MB/);
  await assert.rejects(parseInventoryFile(pdf(Array.from({ length: 101 }, () => [])), { fileName: "muchas-paginas.pdf" }), /100 páginas/);
});

test("headerless aligned PDF quantities require review and preserve zero", async () => {
  const buffer = pdf([[
    [[40, "Unidad modelo 2026"], [400, "0"]],
    [[40, "Cable modelo 64"], [400, "5"]]
  ]]);
  const result = await parseInventoryFile(buffer, { fileName: "sin-encabezado.pdf" });
  assert.deepEqual(result.items.map((item) => item.quantity), [0, 5]);
  assert.ok(result.warnings.some((warning) => warning.includes("número de orden")));
});

test("PDF isolated numeric model fragments do not become quantities", async () => {
  const buffer = pdf([[
    [[40, "Modelo"], [150, "512"], [280, "sintetico"]],
    [[40, "Modelo"], [150, "64"], [280, "sintetico"]]
  ]]);
  await assert.rejects(parseInventoryFile(buffer, { fileName: "modelos.pdf" }), /No se identificaron artículos/);
});

test("scanned, malformed, empty and unsupported files fail with useful messages", async () => {
  await assert.rejects(parseInventoryFile(pdf([[]]), { fileName: "escaneado.pdf" }), /escaneado.*Excel original/);
  await assert.rejects(parseInventoryFile(Buffer.from("No es PDF"), { fileName: "roto.pdf" }), /No se pudo leer el PDF/);
  await assert.rejects(parseInventoryFile(Buffer.from("No es Excel"), { fileName: "roto.xlsx" }), /No se pudo leer el archivo Excel/);
  await assert.rejects(parseInventoryFile(Buffer.alloc(0), { fileName: "vacio.xlsx" }), /vacío/);
  await assert.rejects(parseInventoryFile(Buffer.from("prueba"), { fileName: "viejo.xls" }), /\.xls deben guardarse como \.xlsx/);
});
