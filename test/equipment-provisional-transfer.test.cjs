const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const reporting = require("../equipment-reporting.cjs");
const { createHarness } = require("./helpers/equipment-server-harness.cjs");

// All quantities, locations and equipment in this suite are synthetic inputs.
function fixture(quantity = 3) {
  const inventory = { savedAt: "2026-11-04T12:00:00.000Z", state: { datasetId: "synthetic-transfer-current", items: [
    { id: "audio-synthetic", name: "Unidad sintética de audio", category: "Audio", itemType: "equipo", quantity }
  ], movements: [] } };
  const make = (id, amount, schedule) => {
    const cells = [
      { sheet: id, ref: `${id}!A1`, address: "A1", value: amount },
      { sheet: id, ref: `${id}!B1`, address: "B1", value: "Unidad sintética de audio" }
    ];
    const item = { quantity: amount, description: "Unidad sintética de audio", warehouseInventoryId: "audio-synthetic", sourceRefs: cells.map(cell => cell.ref) };
    return { id, status: "draft", place: `Lugar ${id}`, name: `Cliente ${id}`, type: "Prueba sintética", date: schedule.startAt.slice(0, 10), ...schedule,
      sourceCells: cells, sections: [{ title: "Audio", items: [item], rows: [{ type: "item", sourceItemIndex: 0, quantity: amount, description: item.description, sourceRefs: item.sourceRefs, cells }] }] };
  };
  const events = [
    make("origen-sintetico", 3, { setupAt: "2026-11-05T08:00", startAt: "2026-11-05T12:00", endAt: "2026-11-05T18:00", equipmentInAt: "2026-11-07T12:00" }),
    make("destino-sintetico", 2, { setupAt: "2026-11-06T08:00", startAt: "2026-11-06T12:00", endAt: "2026-11-06T18:00", equipmentInAt: "2026-11-06T20:00" })
  ];
  return { events, inventory };
}

function selectReviewed(payload, inventory) {
  const preview = reporting.createEquipmentReportModel(payload, inventory);
  return { ...payload, selectedTransferIds: preview.draftLogistics.candidates.filter(route => route.status === "ready").map(route => route.id) };
}

test("trasiego provisional muestra propuestas revisables sin acreditar rutas no elegidas ni alterar renta conservadora", () => {
  const { events, inventory } = fixture(), before = JSON.stringify({ events, inventory });
  const ordinary = reporting.createEquipmentReportModel({ events }, inventory);
  const model = reporting.createEquipmentTransferReportModel({ events }, inventory);
  assert.equal(model.reportMode, "transfer");
  assert.equal(model.productionMutations, 0);
  assert.equal(model.provisional, true);
  assert.equal(model.transferRoutes.length, 0);
  const route = model.draftLogistics.candidates[0];
  assert.equal(route.fromEventId, events[0].id);
  assert.equal(route.toEventId, events[1].id);
  assert.equal(route.warehouseInventoryId, "audio-synthetic");
  assert.equal(route.quantity, 2);
  assert.equal(route.category, "Audio");
  assert.equal(route.description, "Unidad sintética de audio");
  assert.equal(route.departureAt, events[0].endAt);
  assert.equal(route.setupAt, events[1].setupAt);
  assert.equal(route.travelMinutes, 60);
  assert.equal(route.handlingMinutes, 120);
  assert.equal(route.requiresTimeConfirmation, true);
  assert.equal(route.requiresConfirmation, true);
  assert.ok(model.details.some(line => line.sourceRefs.includes("origen-sintetico!A1")));
  assert.ok(model.details.some(line => line.sourceRefs.includes("destino-sintetico!B1")));
  assert.equal(model.rentalTransferRoutes.length, 0);
  assert.equal(model.counts.events, 2);
  assert.equal(model.counts.equipmentRows, 2);
  assert.deepEqual(model.sourceCells.map(cell => cell.ref).sort(), events.flatMap(event => event.sourceCells.map(cell => cell.ref)).sort());
  assert.deepEqual(model.rental, ordinary.rental, "proposal must not reduce the conservative rental report");
  assert.equal(ordinary.rental[0].shortage, 2);
  assert.deepEqual(model.originalEvents, events);
  assert.equal(JSON.stringify({ events, inventory }), before);
});

test("un intervalo insuficiente entre eventos queda sin propuesta hasta revisar tiempos de ruta", () => {
  const { events, inventory } = fixture();
  Object.assign(events[1], { date: "2026-11-05", setupAt: "2026-11-05T20:00", startAt: "2026-11-05T21:00", endAt: "2026-11-05T22:00", equipmentInAt: "2026-11-06T00:00" });
  const model = reporting.createEquipmentTransferReportModel({ events }, inventory);
  assert.equal(model.transferRoutes.length, 0, "two available hours cannot satisfy default three-hour logistics");
  assert.equal(model.rentalTransferRoutes.length, 0);
  assert.equal(model.counts.events, 2);
  const reviewedPayload = { events, routeEstimates: [
    { fromPlace: events[0].place, toPlace: events[1].place, travelMinutes: 30, handlingMinutes: 30 }
  ] };
  const reviewed = reporting.createEquipmentTransferReportModel(selectReviewed(reviewedPayload, inventory), inventory);
  assert.equal(reviewed.transferRoutes[0].quantity, 2);
  assert.equal(reviewed.transferRoutes[0].requiresTimeConfirmation, false);
});

test("sólo la continuidad propia elegida reduce renta y los minutos revisados pueden ser cero", () => {
  const { events, inventory } = fixture(1);
  const payload = { events, routeEstimates: [{ fromPlace: events[0].place, toPlace: events[1].place, travelMinutes: 0, handlingMinutes: 0 }] };
  const model = reporting.createEquipmentTransferReportModel(selectReviewed(payload, inventory), inventory);
  assert.equal(model.transferRoutes.length, 1);
  assert.equal(model.transferRoutes[0].quantity, 1);
  assert.equal(model.rentalTransferRoutes.length, 0, "No unselected continuity of supplier units is silently credited");
  assert.equal(model.rows[0].rental, 3);
  assert.equal(model.transferRoutes[0].travelMinutes, 0);
  assert.equal(model.transferRoutes[0].handlingMinutes, 0);
  assert.equal(model.transferRoutes[0].requiresTimeConfirmation, false);
  const markup = reporting.renderEquipmentReportHtml(model, "transfer");
  assert.match(markup, /proveedor/i);
  assert.throws(() => reporting.createEquipmentTransferReportModel({ ...payload, routeEstimates: [{ ...payload.routeEstimates[0], travelMinutes: "" }] }, inventory), /número/);
  assert.throws(() => reporting.createEquipmentTransferReportModel({ ...payload, routeEstimates: [{ ...payload.routeEstimates[0], handlingMinutes: -1 }] }, inventory), /mayor o igual/);
});

test("horarios ausentes, inválidos o contradictorios no impiden descargar y nunca fabrican una ruta", () => {
  for (const patch of [
    { setupAt: "" },
    { endAt: "fecha por confirmar" },
    { endAt: "2026-11-05T07:00" },
    { equipmentInAt: "2026-11-05T13:00" },
    { setupApplies: false, setupAt: "2026-11-05T08:00" },
    { place: "" }
  ]) {
    const { events, inventory } = fixture(); Object.assign(events[0], patch);
    const before = JSON.stringify(events);
    const model = reporting.createEquipmentTransferReportModel({ events }, inventory);
    assert.equal(model.transferRoutes.length, 0, JSON.stringify(patch));
    assert.equal(model.rentalTransferRoutes.length, 0, JSON.stringify(patch));
    assert.ok(model.transferExcludedEvents.some(entry => entry.eventId === events[0].id));
    assert.equal(model.counts.events, 2);
    assert.equal(model.counts.equipmentRows, 2);
    assert.equal(model.counts.sourceCells, 4);
    assert.ok(model.pending.some(entry => entry.eventId === events[0].id));
    const markup = reporting.renderEquipmentReportHtml(model, "transfer");
    assert.match(markup, /Unidad sintética de audio/);
    assert.ok(markup.includes(events[0].name));
    if (patch.endAt === "fecha por confirmar") assert.match(markup, /fecha por confirmar/);
    assert.equal(JSON.stringify(events), before);
  }
});

test("sin inventario identificado, con consumibles o clasificación pendiente no se propone trasladar equipo propio", () => {
  for (const kind of ["unknown", "consumable", "classification"]) {
    const { events, inventory } = fixture();
    if (kind === "unknown") inventory.state.items = [];
    if (kind === "consumable") {
      inventory.state.items[0].name = "Duc tape sintético"; inventory.state.items[0].itemType = "consumible";
      events.forEach(event => { event.sections[0].items[0].description = "Duc tape sintético"; });
    }
    if (kind === "classification") {
      inventory.state.items[0].name = "Extintor sintético"; inventory.state.items[0].itemType = "consumible";
      events.forEach(event => { event.sections[0].items[0].description = "Extintor sintético"; });
    }
    const model = reporting.createEquipmentTransferReportModel({ events }, inventory);
    assert.equal(model.transferRoutes.length, 0, kind);
    assert.equal(model.rentalTransferRoutes.length, 0, kind);
    assert.match(reporting.renderEquipmentReportHtml(model, "transfer"), /PROVISIONAL/);
    assert.equal(model.counts.equipmentRows, 2);
    if (kind === "unknown") assert.ok(model.pending.some(row => row.kind === "IDENTIDAD"));
    if (kind === "classification") assert.ok(model.pending.some(row => row.kind === "CLASIFICACIÓN"));
  }
});

test("ceros y cuadro de referencia conservan su evidencia sin duplicar demanda; el PDF escapa el contenido", () => {
  const { events, inventory } = fixture();
  events[0].place = '<script>origen</script>'; events[1].name = '<img src=x onerror=1>';
  const zeroCells = [{ sheet: events[0].id, ref: `${events[0].id}!A2`, address: "A2", value: 0 }, { sheet: events[0].id, ref: `${events[0].id}!B2`, address: "B2", value: "Línea cero sintética" }];
  events[0].sourceCells.push(...zeroCells);
  events[0].sections[0].items.push({ quantity: 0, description: "Línea cero sintética" });
  events[0].sections[0].rows.push({ type: "item", sourceItemIndex: 1, quantity: 0, description: "Línea cero sintética", cells: zeroCells });
  const copy = structuredClone(events[0]); copy.id = "referencia-sintetica";
  copy.sourceCells = [{ sheet: "Referencia", ref: "Referencia!D1", address: "D1", value: 3 }, { sheet: "Referencia", ref: "Referencia!E1", address: "E1", value: "Unidad sintética de audio" }];
  copy.sections = [{ title: "Audio", items: [{ quantity: 3, description: "Unidad sintética de audio" }], rows: [{ type: "item", quantity: 3, description: "Unidad sintética de audio", cells: copy.sourceCells }] }];
  events[0].sourceImport = { referenceTables: [copy] };
  const before = JSON.stringify({ events, inventory });
  const payload = { events, routeEstimates: [{ fromPlace: events[0].place, toPlace: events[1].place, travelMinutes: 60, handlingMinutes: 120 }] };
  const model = reporting.createEquipmentTransferReportModel(selectReviewed(payload, inventory), inventory);
  assert.equal(model.counts.events, 2); assert.equal(model.counts.equipmentRows, 3); assert.equal(model.counts.zeroQuantityRows, 1);
  assert.equal(model.counts.sourceCells, 8); assert.equal(model.transferRoutes[0].quantity, 2);
  assert.ok(model.preservedRows.some(row => row.section.startsWith("Referencia del archivo")));
  const markup = reporting.renderEquipmentReportHtml(model, "transfer");
  assert.ok(!markup.includes('<script>origen</script>')); assert.ok(!markup.includes('<img src=x onerror=1>'));
  assert.match(markup, /&lt;script&gt;origen&lt;\/script&gt;/); assert.match(markup, /&lt;img src=x onerror=1&gt;/);
  assert.match(markup, /Línea cero sintética/); assert.match(markup, /PROVISIONAL/);
  assert.equal(JSON.stringify({ events, inventory }), before);
});

function serverFunctionSource(name) {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 2);
}

test("endpoint de trasiego usa inventario vigente, entrega PDF autenticado y no registra reservas ni movimientos", async t => {
  const h = createHarness(t), { events, inventory } = fixture(); h.write("warehouseInventoryPath", inventory);
  const before = fs.readFileSync(h.paths.warehouseInventoryPath); let printed = 0; const tempPaths = [];
  Object.assign(h.api, reporting, { os,
    async generatePdf(markup, target) {
      printed++; assert.match(markup, /trasiego/i); assert.match(markup, /PROVISIONAL/);
      assert.match(markup, /Unidad sintética de audio/);
      tempPaths.push(path.dirname(target)); await fs.promises.writeFile(target, "%PDF-synthetic-transfer-report");
    },
    equipmentEventStore: new Proxy({ readEvents: () => ({ events: [], transfers: [] }) }, { get(target, name) {
      if (name === "readEvents") return target[name];
      throw new Error("A provisional transfer report must not write to the event store");
    } }),
    async receiveEquipmentBoardInWarehouse() { throw new Error("A provisional transfer report must not dispatch stock"); }
  });
  vm.runInContext(serverFunctionSource("downloadProvisionalEquipmentReport"), h.api);
  const response = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", { mode: "transfer", events, inventory: { state: { items: [] } } });
  assert.equal(response.statusCode, 200, response.body.toString());
  assert.equal(response.headers["Content-Type"], "application/pdf");
  assert.equal(response.headers["X-Equipment-Report-Status"], "provisional");
  assert.equal(response.headers["X-Equipment-Report-Events"], "2");
  assert.match(response.headers["Content-Disposition"], /Resumen-trasiego-PROVISIONAL.*\.pdf/);
  assert.ok(response.body.toString().startsWith("%PDF"));
  assert.equal(printed, 1); assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  for (const temp of tempPaths) assert.equal(fs.existsSync(temp), false);
  assert.equal((await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", { mode: "transfer", events }, { auth: false })).statusCode, 401);
});
