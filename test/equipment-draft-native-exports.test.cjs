const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const test = require("node:test");
const ExcelJS = require("exceljs");
const reporting = require("../equipment-reporting.cjs");

// Synthetic current input only. No production event, catalog or stock file.
function fixture() {
  const inventory = { savedAt: "2026-11-23T18:00:00Z", state: { datasetId: "current-native-draft-test", items: [
    { id: "own-current", name: "Unidad reutilizable actual de prueba", category: "Audio", itemType: "equipo", quantity: 3 },
    { id: "consume-current", name: "Material consumible actual de prueba", category: "Insumos", itemType: "consumible", quantity: 5 }
  ], movements: [{ id: "actual-consumption-a", type: "consumo", itemId: "consume-current", quantity: 2, sourceEventId: "current-event-a", sourceDocumentId: "current-document-a" }] } };
  const events = ["a", "b", "c"].map((letter, index) => ({ id: `current-event-${letter}`, status: "draft", place: `Lugar actual ${letter}`, name: `Evento actual ${letter}`, date: `2026-11-${25 + index}`,
    ...(index === 0 ? { warehouseDispatchId: "current-document-a" } : {}), setupAt: `2026-11-${25 + index}T08:00`, startAt: `2026-11-${25 + index}T12:00`,
    endAt: `2026-11-${25 + index}T20:00`, equipmentInAt: "2026-11-29T10:00",
    sourceCells: [{ sheet: "Fuente actual", ref: `Fuente!A${index + 1}`, value: 0 }, { sheet: "Fuente actual", ref: `Fuente!B${index + 1}`, value: `Nota actual ${letter}` }],
    sections: [{ title: "Cuadro actual", items: [
      { id: `own-${letter}`, quantity: 3, description: "Unidad reutilizable actual de prueba", warehouseInventoryId: "own-current" },
      { id: `material-${letter}`, quantity: 2, description: "Material consumible actual de prueba", warehouseInventoryId: "consume-current" },
      { id: `zero-${letter}`, quantity: 0, description: "Línea original en cero" }
    ], rows: [{ type: "note", description: `Nota actual ${letter}`, quantity: null }] }]
  }));
  const routeEstimates = [0, 1].map(index => ({ fromPlace: events[index].place, toPlace: events[index + 1].place, travelMinutes: 60, handlingMinutes: 120 }));
  return { events, inventory, routeEstimates };
}
const build = (input, extra = {}, options = {}) => reporting.createEquipmentReportModel({ events: input.events, routeEstimates: input.routeEstimates, ...extra }, input.inventory, options);
const own = model => model.rows.find(row => row.warehouseInventoryId === "own-current");
const material = model => model.rows.find(row => row.warehouseInventoryId === "consume-current");

test("native reports apply only the explicitly selected valid legs and retain drafts, zeros and source cells", () => {
  const input = fixture(), before = JSON.stringify(input), baseline = build(input);
  assert.equal(own(baseline).shortage, 6);
  assert.equal(baseline.draftLogistics.candidates.length, 2);
  assert.equal(baseline.counts.equipmentRows, 9); assert.equal(baseline.counts.zeroQuantityRows, 3); assert.equal(baseline.counts.sourceCells, 6);
  assert.ok(baseline.events.every(event => event.status === "draft"));
  const ids = baseline.draftLogistics.candidates.map(candidate => candidate.id);
  const partial = build(input, { selectedTransferIds: ids.slice(0, 1), expectedSnapshotId: baseline.draftLogistics.snapshotId });
  const complete = build(input, { selectedTransferIds: ids });
  assert.equal(own(partial).shortage, 3); assert.equal(own(complete).shortage, 0);
  assert.equal(partial.draftLogistics.selectedTransfers.length, 1); assert.equal(complete.draftLogistics.selectedTransfers.length, 2);
  const transfer = reporting.createEquipmentTransferReportModel({ events: input.events, routeEstimates: input.routeEstimates, selectedTransferIds: ids.slice(0, 1) }, input.inventory);
  assert.equal(transfer.transferRoutes.length, 1); assert.equal(transfer.transferRoutes[0].id, ids[0]);
  assert.equal(reporting.createEquipmentTransferReportModel({ events: input.events, routeEstimates: input.routeEstimates }, input.inventory).transferRoutes.length, 0);
  const htmlModel = reporting.createEquipmentPlanningReportModel({ events: input.events, routeEstimates: input.routeEstimates, selectedTransferIds: ids.slice(0, 1) }, input.inventory);
  assert.equal(htmlModel.rentalComparison[0].rentWithTransfer, 3);
  assert.equal(htmlModel.physicalSummary[0].uniquePhysicalNeeded, 6); assert.equal(htmlModel.physicalSummary[0].ownUnitsPlanned, 3);
  assert.equal(JSON.stringify(input), before);
});

test("current recorded consumption is fulfilled once; a different event only changes available stock", () => {
  const input = fixture(), report = build(input), row = material(report);
  assert.equal(row.demand, 6); assert.equal(row.available, 3); assert.equal(row.alreadyConsumed, 2); assert.equal(row.remainingConsumption, 4); assert.equal(row.shortage, 1);
  input.inventory.state.movements[0].sourceEventId = "other-event";
  input.inventory.state.movements[0].sourceDocumentId = "other-document";
  const other = material(build(input));
  assert.equal(other.alreadyConsumed, 0); assert.equal(other.remainingConsumption, 6); assert.equal(other.shortage, 3);
  input.events[1].warehouseDispatchId = input.events[0].warehouseDispatchId;
  assert.throws(() => build(input), /misma salida de bodega/);
});

test("a stale selection is visible and never produces a covered order from outdated stock", () => {
  const input = fixture(), baseline = build(input), ids = baseline.draftLogistics.candidates.map(candidate => candidate.id);
  input.inventory.state.items[0].quantity = 1;
  const report = build(input, { selectedTransferIds: ids, expectedSnapshotId: baseline.draftLogistics.snapshotId, inventory: { available: 99999 } });
  assert.equal(report.draftLogistics.selectedTransfers.length, 0); assert.ok(report.draftLogistics.invalidSelections.length);
  assert.ok(report.pending.some(row => row.kind === "TRASIEGO"));
  assert.equal(own(report).available, 1); assert.notEqual(own(report).action, "CUBIERTO");
  assert.notEqual(own(report).shortage, 0);
});

test("a draft cannot claim another event's dispatch document as consumption fulfillment or owned stock", () => {
  const input = fixture(), event = input.events[0];
  input.inventory.state.movements[0].sourceEventId = "other-event-owner";
  const before = JSON.stringify(input), report = build(input), row = material(report);
  assert.equal(row.shortage, null); assert.equal(row.hardBlocked, true); assert.equal(row.alreadyConsumed, 0);
  assert.match(row.reasons.join(" "), /pertenece a otro evento/);
  assert.ok(!report.purchase.some(entry => entry.warehouseInventoryId === row.warehouseInventoryId));
  assert.equal(report.events[0].warehouseDispatchId, event.warehouseDispatchId);
  assert.equal(report.draftLogistics.events[0].warehouseDispatchId, event.warehouseDispatchId);
  assert.equal(JSON.stringify(input), before);
  // A legacy movement without event ownership also needs current server proof.
  delete input.inventory.state.movements[0].sourceEventId;
  assert.equal(material(build(input)).shortage, null);
  const verified = build(input, {}, { storedEvents: [{ id: event.id, warehouseDispatchId: event.warehouseDispatchId }] });
  assert.equal(material(verified).alreadyConsumed, 2); assert.equal(material(verified).shortage, 1);
  // Unbacked dispatch pointers must not add an unrelated physical exit back to capacity.
  input.inventory.state.movements = [{ id: "foreign-out", type: "salida", itemId: "own-current", quantity: 3, sourceEventId: "other-event-owner", sourceDocumentId: event.warehouseDispatchId }];
  const reusable = own(build(input));
  assert.equal(reusable.shortage, null); assert.equal(reusable.available, 0); assert.equal(reusable.capacity, 0);
});

test("the master reopens with formulas for the selected physical plan and remaining consumption", async () => {
  const input = fixture(), baseline = build(input), report = build(input, { selectedTransferIds: [baseline.draftLogistics.candidates[0].id] });
  const workbook = await reporting.createEquipmentMasterWorkbook(report), reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
  const sheet = reopened.getWorksheet("Resumen de equipo"), headers = sheet.getRow(4).values;
  const column = label => headers.indexOf(label);
  const rowFor = id => sheet.getRows(5, sheet.rowCount - 4).find(row => row.getCell(3).value === id);
  const audio = rowFor("own-current"), consumed = rowFor("consume-current");
  assert.equal(audio.getCell(column("Total solicitado")).result, 9);
  assert.equal(audio.getCell(column("Unidades físicas sin trasiego")).value, 9);
  assert.equal(audio.getCell(column("Cubierto por trasiego seleccionado")).value, 3);
  assert.equal(audio.getCell(column("Capacidad propia para estos eventos")).value, 3);
  assert.equal(audio.getCell(column("Faltante provisional")).result, 3);
  assert.match(audio.getCell(column("Faltante provisional")).formula, /^MAX\(0,[A-Z]+\d+-[A-Z]+\d+\+[A-Z]+\d+-[A-Z]+\d+\)$/);
  assert.equal(consumed.getCell(column("Consumo ya registrado")).value, 2);
  assert.equal(consumed.getCell(column("Demanda pendiente")).value, 4);
  assert.equal(consumed.getCell(column("Capacidad propia para estos eventos")).value, 3);
  assert.equal(consumed.getCell(column("Faltante provisional")).result, 1);
  assert.equal(reopened.getWorksheet("Celdas fuente").rowCount - 4, 6);
  const raw = reopened.getWorksheet("Datos completos").getRows(5, reopened.getWorksheet("Datos completos").rowCount - 4);
  const plan = JSON.parse(raw.filter(row => row.getCell(1).value === "Plan validado").sort((a, b) => a.getCell(3).value - b.getCell(3).value).map(row => row.getCell(5).value).join(""));
  assert.deepEqual(plan.selectedTransferIds, report.draftLogistics.selectedTransferIds); assert.equal(plan.productionMutations, 0);
});

function functionSource(name) {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m")), end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start); return source.slice(start, end + 2);
}
function apiHarness(input) {
  const state = { allowed: true, queue: 0, reads: 0, stores: 0, pdfs: [] };
  const context = vm.createContext({ ...reporting, ...require("../equipment-event-store.cjs"), EquipmentIdentity: require("../equipment-identity.js"), console, URL, Buffer, Date, Intl, path, os, fsp,
    readWarehouseInventory: () => { state.reads += 1; return JSON.parse(JSON.stringify(input.inventory)); },
    equipmentEventStore: { readEvents: () => ({ events: [], transfers: [], revision: 7 }), putEvent: () => { state.stores += 1; throw Error("No operational writes allowed"); } },
    requireAuth: (_request, response) => { if (!state.allowed) { response.writeHead(403, {}); response.end("Permission denied"); } return state.allowed; },
    readJsonBody: async () => state.payload,
    jsonResponse: (response, status, value) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify(value)); },
    errorResponse: (response, status, message) => { response.writeHead(status, { "Content-Type": "application/json" }); response.end(JSON.stringify({ error: message })); },
    enqueueSave: async callback => { state.queue += 1; return callback(); },
    generatePdf: async (html, target) => { state.pdfs.push(html); await fsp.writeFile(target, "%PDF-current-test"); }
  });
  vm.runInContext(`${functionSource("validateEquipmentOcrReview")}\n${functionSource("validateEquipmentEventConfirmation")}\n${functionSource("downloadProvisionalEquipmentReport")}\n${functionSource("handleRequest")}`, context);
  return { state, async request(payload, requestOptions = {}) {
    state.payload = payload;
    const response = { status: 0, headers: {}, body: Buffer.alloc(0), writeHead(status, headers) { this.status = status; this.headers = headers; }, end(value) { this.body = Buffer.isBuffer(value) ? value : Buffer.from(value || ""); } };
    await context.handleRequest({ method: requestOptions.method || "POST", url: requestOptions.url || "/api/cuadros-equipo/reportes/provisional", headers: { host: "test.invalid" } }, response);
    return response;
  } };
}

test("the existing authorized endpoint returns one plan for JSON, PDF, HTML and master without persisting drafts", async () => {
  const input = fixture(), before = JSON.stringify(input), harness = apiHarness(input);
  const basePayload = { events: input.events, routeEstimates: input.routeEstimates, inventory: { state: { items: [{ id: "own-current", quantity: 999999 }] } }, transfers: [{ id: "forged-route" }] };
  const first = await harness.request({ ...basePayload, mode: "plan", format: "json" });
  assert.equal(first.status, 200); assert.equal(harness.state.queue, 0);
  const plan = JSON.parse(first.body); assert.equal(plan.rows.find(row => row.warehouseInventoryId === "own-current").shortage, 6);
  assert.equal(plan.productionMutations, 0); assert.equal(plan.originalInventory, undefined); assert.equal(plan.revision, 7);
  const selectedTransferIds = [plan.candidates[0].id], payload = { ...basePayload, selectedTransferIds, expectedSnapshotId: plan.snapshotId };
  const applied = JSON.parse((await harness.request({ ...payload, mode: "plan", format: "json" })).body);
  assert.equal(applied.rows.find(row => row.warehouseInventoryId === "own-current").shortage, 3);
  assert.equal(applied.rows.find(row => row.warehouseInventoryId === "consume-current").shortage, 1);
  const html = await harness.request({ ...payload, mode: "rent", format: "html" });
  assert.equal(html.status, 200); assert.equal(harness.state.queue, 0);
  assert.match(html.body.toString(), /Rentar con trasiego/);
  for (const mode of ["rent", "purchase", "transfer"]) {
    const pdf = await harness.request({ ...payload, mode, format: "pdf" });
    assert.equal(pdf.status, 200); assert.equal(pdf.headers["Content-Type"], "application/pdf");
    assert.equal(pdf.body.toString(), "%PDF-current-test");
  }
  assert.equal(harness.state.pdfs.length, 3);
  const xlsx = await harness.request({ ...payload, mode: "master", format: "xlsx" });
  assert.equal(xlsx.status, 200);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(xlsx.body);
  assert.equal(book.getWorksheet("Renta provisional").getCell("F5").value, 3);
  assert.equal(book.getWorksheet("Compra provisional").getCell("F5").value, 1);
  assert.equal(harness.state.stores, 0); assert.equal(JSON.stringify(input), before);
  harness.state.allowed = false;
  const readCount = harness.state.reads, denied = await harness.request({ ...payload, mode: "plan", format: "json" });
  assert.equal(denied.status, 403); assert.equal(harness.state.reads, readCount);
});

test("confirmation rejects uncertain OCR even when a caller forges warning or review flags", () => {
  const context = vm.createContext({ ...require("../equipment-event-store.cjs"), EquipmentIdentity: require("../equipment-identity.js") });
  vm.runInContext(`${functionSource("validateEquipmentOcrReview")}\n${functionSource("validateEquipmentEventConfirmation")}`, context);
  const input = fixture();
  const validate = event => context.validateEquipmentEventConfirmation(event.id, { event }, input.inventory);
  const event = structuredClone(input.events[0]);
  event.sourceCells[0].ocrConfidence = 89;
  event.sourceImport = { ocrPages: [1], warningsAccepted: true, ocrReviewReviewed: true, skipOcrReview: true, ocrReview: { reviewed: true } };
  const before = JSON.stringify({ event, inventory: input.inventory });
  assert.throws(() => validate(event), error => error.statusCode === 422 && /poco legibles/.test(error.message));
  assert.equal(JSON.stringify({ event, inventory: input.inventory }), before);
  event.sourceCells[0].ocrConfidence = 95;
  delete event.sourceImport.ocrReview;
  assert.throws(() => validate(event), error => error.statusCode === 422 && /revisión OCR/.test(error.message));
  event.sourceImport.ocrReview = { reviewed: true };
  assert.equal(validate(event).id, event.id);
  event.sections[0].rows.push({ type: "note", description: "Texto OCR dudoso", cells: [{ ref: "PDF:p1:line9", ocrConfidence: 40, value: "No confirmado" }] });
  assert.throws(() => validate(event), error => error.statusCode === 422 && /poco legibles/.test(error.message));
  const plain = structuredClone(input.events[0]);
  assert.equal(validate(plain).id, plain.id, "ordinary Excel and digital documents do not acquire an OCR requirement");
});

test("the event confirmation handler blocks uncertain OCR before any store write", async () => {
  const input = fixture(), harness = apiHarness(input), event = structuredClone(input.events[0]);
  event.sourceCells[0].ocrConfidence = 70;
  event.sourceImport = { ocrPages: [1], warningsAccepted: true, ocrReview: { reviewed: true } };
  const response = await harness.request({ event }, { method: "PUT", url: `/api/cuadros-equipo/eventos/${event.id}` });
  assert.equal(response.status, 422); assert.match(JSON.parse(response.body).error, /poco legibles/); assert.equal(harness.state.stores, 0);
});
