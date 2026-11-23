const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseEventFile } = require("../equipment-event-import.cjs");

// Synthetic documents only; no customer files or production data are fixtures.
function pdf(rows) {
  const escape = (value) => String(value).replace(/[\\()]/g, "\\$&");
  const operations = rows.flatMap((row, index) => {
    const cells = typeof row === "string" ? [[50, row]] : row;
    return cells.map(([x, value]) => `BT /F1 10 Tf ${x} ${860 - index * 23} Td (${escape(value)}) Tj ET`);
  }).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1600 900] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    `<< /Length ${Buffer.byteLength(operations)} >>\nstream\n${operations}\nendstream`
  ];
  const chunks = [Buffer.from("%PDF-1.4\n")], offsets = [0];
  let size = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(size);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`);
    chunks.push(chunk); size += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

const brand = "L I V E P R O D U C T I O N S - R E Q U E R I M I E N T O D E E Q U I P O";
const disclaimer = [
  "PLAN PROVISIONAL - Compara los mismos eventos con el inventario vigente.",
  "Abrir o imprimir estos reportes no confirma reservas, movimientos, rentas ni",
  "compras."
];
const sourceRows = [
  "Cliente: Trasiego de equipo", "Lugar: Salon sintetico", "Fecha del evento: 24/11/2026",
  "Requiere montaje: no", "Hora del evento: 18:00",
  "Fecha y hora de finalizacion: 25/11/2026 00:30", "Regreso a bodega: 25/11/2026 02:00",
  [[50, "Cantidad"], [200, "Descripcion"]], [[50, "0"], [200, "Equipo sintetico en cero"]],
  [[50, "2"], [200, "Equipo sintetico segundo"]], "Nota original conservada"
];
const parse = (rows, fileName = "documento-sintetico.pdf") => parseEventFile(pdf(rows), { fileName });
const isReportError = (error) => {
  assert.equal(error.code, "EQUIPMENT_EVENT_REPORT_NOT_SOURCE");
  assert.equal(error.statusCode, 400);
  assert.match(error.message, /Excel original/);
  assert.match(error.message, /cuadros completos de equipo y horarios/);
  return true;
};

test("los reportes derivados conocidos no se convierten en eventos aun con tablas legibles", async () => {
  for (const title of [
    "Trasiego de equipo", "Resumen de trasiego - PROVISIONAL",
    "Renta con y sin trasiego", "Resumen de renta - PROVISIONAL",
    "Consumo y compra por evento", "Resumen de compra de insumos - PROVISIONAL",
    "Resumen de equipo - PROVISIONAL"
  ]) {
    await assert.rejects(parse([brand, title, ...disclaimer, "Eventos incluidos", ...sourceRows]), isReportError, title);
  }
});

test("el reporte de rutas se reconoce sin un resumen de eventos y con el aviso actual", async () => {
  await assert.rejects(parse([
    brand, "Trasiego de equipo", "PROPUESTA PROVISIONAL - Plan para organizar el equipo.",
    "Abrir o imprimir este reporte no registra salidas de bodega, rentas ni compras.",
    [[50, "Categoria"], [200, "Equipo"], [500, "Cantidad a trasladar"]],
    [[50, "AUDIO"], [200, "Equipo sintetico"], [500, "2"]]
  ]), isReportError);
});

test("el resumen horizontal de un reporte no produce un evento falso llamado Montaje", async () => {
  await assert.rejects(parse([
    brand, "Trasiego de equipo", ...disclaimer, "Eventos incluidos",
    [[50, "Evento"], [180, "Fecha"], [300, "Ubicacion"], [430, "Montaje"], [560, "Inicio"], [690, "Finalizacion"], [850, "Regreso a bodega"]]
  ]), isReportError);
});

test("cada firma es obligatoria y los PDF originales conservan equipos, cero y horarios", async () => {
  const fingerprints = [brand, "Trasiego de equipo", disclaimer.join(" "), "Eventos incluidos"];
  for (let omitted = 0; omitted < fingerprints.length; omitted++) {
    const preview = await parse([...fingerprints.filter((_, index) => index !== omitted), ...sourceRows]);
    assert.equal(preview.eventCount, 1, `firma omitida ${omitted}`);
    assert.equal(preview.itemCount, 2);
    assert.equal(preview.zeroCount, 1);
    assert.equal(preview.verification.complete, true);
    const event = preview.events[0];
    assert.equal(event.canImport, true, JSON.stringify(event.issues));
    assert.equal(event.client, "Trasiego de equipo");
    assert.equal(event.setupApplies, false);
    assert.equal(event.date, "2026-11-24");
    assert.equal(event.startAt, "2026-11-24T18:00");
    assert.equal(event.endAt, "2026-11-25T00:30");
    assert.equal(event.equipmentInAt, "2026-11-25T02:00");
    assert.ok(preview.sourceCells.some((cell) => cell.value === "Nota original conservada"));
  }
});

test("un nombre de cliente o archivo parecido a un reporte no impide importar un PDF original", async () => {
  const preview = await parse([
    brand, "Cliente: Trasiego de equipo", ...disclaimer, "Eventos incluidos", ...sourceRows
  ], "Trasiego de equipo - Live Productions.pdf");
  assert.equal(preview.eventCount, 1);
  assert.equal(preview.itemCount, 2);
  assert.equal(preview.verification.complete, true);
});

test("las firmas de reportes no bloquean los libros Excel originales", async () => {
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet("Evento sintetico");
  for (const row of [
    ["Cliente:", "Cliente sintetico"], ["Lugar:", "Salon sintetico"], ["Fecha:", "24/11/2026"],
    [brand], ["Trasiego de equipo"], ...disclaimer.map((line) => [line]), ["Eventos incluidos"],
    ["Cantidad", "Descripcion"], [0, "Equipo sintetico en cero"], [2, "Equipo sintetico segundo"]
  ]) sheet.addRow(row);
  const preview = await parseEventFile(Buffer.from(await workbook.xlsx.writeBuffer()), { fileName: "trasiego-sintetico.xlsx" });
  assert.equal(preview.eventCount, 1);
  assert.equal(preview.itemCount, 2);
  assert.equal(preview.zeroCount, 1);
  assert.equal(preview.verification.complete, true);
});
