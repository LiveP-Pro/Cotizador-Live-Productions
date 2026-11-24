const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ExcelJS = require("exceljs");
const reporting = require("../equipment-reporting.cjs");
const { createHarness } = require("./helpers/equipment-server-harness.cjs");

// Only synthetic current records. No production catalog, inventory or event file.
function fixture() {
  const inventory = { savedAt: "2026-11-04T12:00:00.000Z", state: { datasetId: "current-synthetic-report", items: [
    { id: "console", name: "Consola sintética", category: "Audio", itemType: "equipo", quantity: 5 },
    { id: "tape", name: "Duc tape sintético", category: "Insumos", itemType: "consumible", quantity: 3 },
    { id: "normal", name: "Par LED normal sintético", category: "Luces", itemType: "equipo", quantity: 99, sourceKey: "Par LED matiz sintético", descriptionAliases: ["Par LED matiz sintético"] },
    { id: "extinguisher", name: "Extintor sintético", category: "Seguridad", itemType: "consumible", quantity: 1 },
    { id: "zero", name: "Unidad cero sintética", category: "Audio", itemType: "equipo", quantity: 0 }
  ], movements: [ { itemId: "console", type: "taller", quantity: 1 }, { itemId: "console", type: "salida", quantity: 1 } ] } };
  const events = [1, 2].map(index => ({ id: `synthetic-event-${index}`, place: `Lugar sintético ${index}`, name: `Nombre ${index}`, type: "Prueba", date: `2026-11-0${4 + index}`,
    setupAt: `2026-11-0${4 + index}T08:00`, startAt: `2026-11-0${4 + index}T12:00`, endAt: `2026-11-0${4 + index}T18:00`, equipmentInAt: `2026-11-0${4 + index}T20:00`,
    sourceCells: [{ ref: `Fuente!A${index}`, value: 0 }, { ref: `Fuente!B${index}`, value: "Nota literal" }],
    sections: [{ title: "Audio", items: [ { quantity: 4, description: "Consola sintética", sourceCells: [{ ref: `Fuente!C${index}`, value: 4 }] },
      { quantity: 4, description: "Duc tape sintético" }, { quantity: 2, description: "Par LED matiz sintético" },
      { quantity: 2, description: "Extintor sintético" }, { quantity: 0, description: "Unidad cero sintética" } ],
      rows: [{ type: "header", description: "Encabezado original", cells: [{ ref: `Fuente!B${index}`, value: "Nota literal" }] },
        { type: "note", description: "No perder esta observación", quantity: null, notes: ["Comentario adicional"] }]
    }] }));
  return { inventory, events };
}

function modelFixture() { const { events, inventory } = fixture(); return reporting.createEquipmentReportModel({ events, from: "2026-11-02", to: "2026-11-08", inventory: { quantity: 99999 } }, inventory, { createdAt: "2026-11-04T12:00:00.000Z" }); }

test("provisional conserva todos los eventos, ceros, celdas y notas y respeta el regreso indicado a bodega", () => {
  const { events, inventory } = fixture(); const before = JSON.stringify({ events, inventory });
  const model = modelFixture();
  assert.equal(model.counts.events, 2); assert.equal(model.counts.equipmentRows, 10); assert.equal(model.counts.zeroQuantityRows, 2); assert.equal(model.sourceCells.length, 6);
  const consoleRow = model.rows.find(row => row.warehouseInventoryId === "console");
  assert.equal(consoleRow.demand, 8); assert.equal(consoleRow.available, 3); assert.equal(consoleRow.shortage, 1); assert.equal(consoleRow.action, "RENTA");
  assert.equal(model.rows.find(row => row.warehouseInventoryId === "tape").shortage, 5);
  assert.equal(model.transfers.length, 0); assert.equal(model.productionMutations, 0);
  assert.ok(model.preservedRows.some(row => row.type === "header")); assert.ok(model.preservedRows.some(row => row.description === "No perder esta observación"));
  assert.equal(JSON.stringify({ events, inventory }), before);
});

test("identidad dudosa no usa aliases antiguos ni existencia cero; clasificación sospechosa no emite órdenes", () => {
  const model = modelFixture();
  const led = model.rows.find(row => row.description === "Par LED matiz sintético");
  assert.equal(led.available, null); assert.equal(led.shortage, null); assert.equal(led.action, "IDENTIFICAR EQUIPO");
  assert.ok(!model.rental.includes(led)); assert.ok(!model.purchase.includes(led));
  const extinguisher = model.rows.find(row => row.warehouseInventoryId === "extinguisher");
  assert.equal(extinguisher.pendingClassification, true); assert.equal(extinguisher.shortage, null); assert.equal(extinguisher.potential, 3);
  assert.equal(extinguisher.action, "REVISAR CLASIFICACIÓN"); assert.ok(!model.purchase.includes(extinguisher));
  assert.deepEqual(model.pending.map(row => row.kind).sort(), ["CLASIFICACIÓN", "IDENTIDAD"]);
});

test("horarios ausentes permiten exportación provisional y decisiones externas explícitas conservan cantidad", () => {
  const { events, inventory } = fixture();
  for (const event of events) for (const name of ["setupAt", "startAt", "endAt", "equipmentInAt"]) delete event[name];
  events[0].sections[0].items.push({ quantity: 4, description: "Luminaria externa sintética", procurementChoice: "rent" });
  const model = reporting.createEquipmentReportModel({ events }, inventory);
  assert.equal(model.pending.filter(row => row.kind === "HORARIO").length, 8);
  const rented = model.rental.find(row => row.description === "Luminaria externa sintética");
  assert.equal(rented.shortage, 4); assert.equal(rented.available, null);
  const markup = reporting.renderEquipmentReportHtml(model, "rent");
  assert.match(markup, /PROVISIONAL/); assert.match(markup, /Sin reservas ni movimientos/); assert.match(markup, /Luminaria externa sintética/);
  assert.match(markup, /Pendientes por resolver/); assert.ok(!markup.includes("<script"));
});

test("Excel máster reabre con fórmulas, ceros tipados y fuente JSON completa sin truncamiento", async () => {
  const { events, inventory } = fixture(); events[0].notes = "Nota extensa " + "á😀".repeat(18000);
  // Long source values are split into numbered parts; the exact JSON is also
  // retained independently so no arbitrary spreadsheet cell limit drops data.
  events[0].sourceCells.push({ ref: "Fuente!Z1", value: "x".repeat(65000) });
  const model = reporting.createEquipmentReportModel({ events }, inventory);
  const workbook = await reporting.createEquipmentMasterWorkbook(model);
  const reopened = new ExcelJS.Workbook(); await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(reopened.worksheets.length, 11);
  const summary = reopened.getWorksheet("Resumen de equipo");
  const row = summary.getRows(5, summary.rowCount - 4).find(row => row.getCell(3).value === "console");
  assert.equal(row.getCell(6).value.formula, `SUM(D${row.number}:E${row.number})`); assert.equal(row.getCell(6).value.result, 8);
  assert.equal(row.getCell(8).value.result, 1); assert.match(row.getCell(8).value.formula, /^MAX\(0,/);
  const details = reopened.getWorksheet("Detalle por evento");
  assert.equal(details.getRows(5, details.rowCount - 4).filter(row => row.getCell(4).value === 0).length, 2);
  const raw = reopened.getWorksheet("Datos completos");
  const restored = raw.getRows(5, raw.rowCount - 4).filter(row => row.getCell(2).value === events[0].id).sort((a, b) => a.getCell(3).value - b.getCell(3).value).map(row => row.getCell(5).value).join("");
  const actualJson = JSON.stringify(JSON.parse(restored)), expectedJson = JSON.stringify(events[0]);
  if (actualJson !== expectedJson) {
    let offset = 0; while (actualJson[offset] === expectedJson[offset] && offset < actualJson.length) offset += 1;
    assert.fail(`JSON diferente en ${offset}: actual ${JSON.stringify(actualJson.slice(offset, offset + 100))}, esperado ${JSON.stringify(expectedJson.slice(offset, offset + 100))}; longitudes ${actualJson.length}/${expectedJson.length}`);
  }
  const cells = reopened.getWorksheet("Celdas fuente");
  assert.equal(cells.getRows(5, cells.rowCount - 4).filter(row => row.getCell(3).value === "Fuente!Z1").map(row => row.getCell(4).value).join("").length, 65000);
  assert.ok(summary.getCell(2, 1).value.includes("PROVISIONAL"));
  assert.match(reopened.getWorksheet("Eventos").getCell("J5").value, /texto íntegro conservado/);
});

function serverFunctionSource(name) {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m")); const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start); return source.slice(start, end + 2);
}

test("endpoint autenticado descarga los cuatro formatos con inventario servidor y sin escribir reservas o bodega", async t => {
  const h = createHarness(t), { events, inventory } = fixture(); h.write("warehouseInventoryPath", inventory);
  const before = fs.readFileSync(h.paths.warehouseInventoryPath); let printed = 0; const tempPaths = [];
  Object.assign(h.api, reporting, { os,
    async generatePdf(markup, target) { printed += 1; assert.match(markup, /PROVISIONAL/); tempPaths.push(path.dirname(target)); await fs.promises.writeFile(target, "%PDF-synthetic-report"); },
    equipmentEventStore: new Proxy({}, { get(_target, key) { if (key === "readEvents") return () => ({ events: [], transfers: [], revision: 0 }); throw new Error("A download must never mutate event reservations"); } }),
    async receiveEquipmentBoardInWarehouse() { throw new Error("No warehouse dispatch"); }
  });
  vm.runInContext(serverFunctionSource("downloadProvisionalEquipmentReport"), h.api);
  for (const mode of ["master", "summary", "rent", "purchase"]) {
    const response = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", { mode, events, inventory: { state: { items: [] } } });
    assert.equal(response.statusCode, 200, response.body.toString().slice(0, 250));
    assert.equal(response.headers["X-Equipment-Report-Status"], "provisional"); assert.equal(response.headers["X-Equipment-Report-Events"], "2");
    assert.match(response.headers["Content-Disposition"], /attachment; filename=.*PROVISIONAL/);
    if (mode === "master") {
      const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(response.body);
      assert.equal(workbook.getWorksheet("Inventario consultado").getCell("K5").value, 3);
    } else assert.ok(response.body.toString().startsWith("%PDF"));
    assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  }
  assert.equal(printed, 3); for (const directory of tempPaths) assert.equal(fs.existsSync(directory), false);
  assert.equal((await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", { events }, { auth: false })).statusCode, 401);
});

test("reporte rechaza eventos inválidos y escapa descripciones en PDF sin ocultar pendientes", () => {
  const { events, inventory } = fixture(); assert.throws(() => reporting.createEquipmentReportModel({ events: [] }, inventory), /al menos un evento/);
  events[0].sections[0].items[0].quantity = -1; assert.throws(() => reporting.createEquipmentReportModel({ events }, inventory), /mayor o igual/);
  events[0].sections[0].items[0].quantity = 4; events[0].place = '<script>alert("x")</script>';
  const markup = reporting.renderEquipmentReportHtml(reporting.createEquipmentReportModel({ events }, inventory));
  assert.ok(!markup.includes('<script>alert("x")</script>')); assert.match(markup, /&lt;script&gt;/);
});

test("cantidades cero desconocidas se conservan sin abrir pendientes ni pedidos y fechas incorrectas son revisables", () => {
  const { events, inventory } = fixture();
  events[0].sections[0].items.push({ quantity: 0, description: "Modelo no registrado sin uso" });
  events[0].setupAt = "fecha por definir"; events[1].endAt = "2026-11-06T07:00";
  const model = reporting.createEquipmentReportModel({ events }, inventory);
  const zero = model.rows.find(row => row.description === "Modelo no registrado sin uso");
  assert.equal(zero.demand, 0); assert.equal(zero.available, null); assert.equal(zero.shortage, 0); assert.equal(zero.action, "SIN USO (0)");
  assert.ok(!model.pending.some(row => row.description === zero.description));
  assert.equal(model.events[0].setupAt, "fecha por definir");
  assert.ok(model.pending.some(row => row.description === "Orden de fechas y horas"));
  assert.ok(model.pending.some(row => row.reason.includes("Corrija esta fecha")));
});
