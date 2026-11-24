const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const reporting = require("../equipment-reporting.cjs");
const { createHarness } = require("./helpers/equipment-server-harness.cjs");

// Only current synthetic input. No production events, accounts or stock files.
function fixture() {
  const inventory = { savedAt: "2026-11-23T12:00:00.000Z", state: { datasetId: "html-current-synthetic", items: [
    { id: "synthetic-speaker", name: "Bocina de prueba actual", category: "Audio", itemType: "equipo", quantity: 3 },
    { id: "synthetic-tape", name: "Cinta de prueba actual", category: "Consumibles", itemType: "consumible", quantity: 1 }
  ], movements: [] } };
  const events = [0, 1].map(index => ({ id: `synthetic-html-${index}`, status: "draft", client: `Cliente de prueba ${index}`,
    name: `Cliente de prueba ${index}`, place: index ? "Destino sintético" : '<script>origen sintético</script>', date: `2026-11-${25 + index}`,
    setupAt: `2026-11-${25 + index}T08:00`, startAt: `2026-11-${25 + index}T12:00`, endAt: `2026-11-${25 + index}T18:00`,
    equipmentInAt: "2026-11-28T10:00", sourceCells: [{ sheet: `Prueba ${index}`, ref: `Prueba${index}!A1`, value: 0 }],
    sections: [{ title: "Archivo sintético", items: [
      { quantity: 3, description: "Bocina de prueba actual", warehouseInventoryId: "synthetic-speaker" },
      { quantity: 2, description: "Cinta de prueba actual", warehouseInventoryId: "synthetic-tape" },
      { quantity: 0, description: "Línea cero de prueba" }
    ], rows: [{ type: "note", description: "Nota original de prueba", cells: [{ sheet: `Prueba ${index}`, ref: `Prueba${index}!A1`, value: 0 }] }] }]
  }));
  return { events, inventory };
}

function serverFunctionSource(name) {
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, "m"));
  const end = source.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end + 2);
}

function htmlHarness(t) {
  const h = createHarness(t), current = fixture();
  h.write("warehouseInventoryPath", current.inventory);
  let models = 0, lastModel;
  Object.assign(h.api, reporting, {
    createEquipmentPlanningReportModel(...args) {
      models++; lastModel = reporting.createEquipmentPlanningReportModel(...args); return lastModel;
    },
    enqueueSave() { throw new Error("An HTML report must bypass the print/save queue"); },
    generatePdf() { throw new Error("An HTML report must not launch Chromium"); },
    equipmentEventStore: new Proxy({}, { get(_target, key) { if (key === "readEvents") return () => ({ events: [], transfers: [], revision: 0 }); throw new Error("An HTML report must not mutate the event store"); } }),
    receiveEquipmentBoardInWarehouse() { throw new Error("An HTML report must not dispatch stock"); }
  });
  vm.runInContext(serverFunctionSource("downloadProvisionalEquipmentReport"), h.api);
  return { ...h, ...current, modelCount: () => models, model: () => lastModel };
}

test("the three HTML reports use active stock and render once without a print queue, Chromium or persistent writes", async t => {
  const h = htmlHarness(t), before = fs.readFileSync(h.paths.warehouseInventoryPath);
  const source = JSON.stringify(h.events), existing = fs.readdirSync(h.dir).sort();
  for (const [index, mode] of ["transfer", "rent", "purchase"].entries()) {
    const response = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", {
      format: "html", mode, events: h.events,
      inventory: { state: { items: [{ id: "forged", name: "INVENTARIO FALSO", quantity: 999999 }] } }
    });
    assert.equal(response.statusCode, 200, response.body.toString());
    assert.equal(h.modelCount(), index + 1);
    assert.equal(response.headers["Content-Type"], "text/html; charset=utf-8");
    assert.equal(response.headers["Content-Length"], response.body.length);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.equal(response.headers["X-Content-Type-Options"], "nosniff");
    assert.match(response.headers["Content-Security-Policy"], /default-src 'none'/);
    assert.match(response.headers["Content-Disposition"], /^inline;.*\.html"$/);
    assert.equal(response.headers["X-Equipment-Report-Status"], "provisional");
    assert.equal(response.headers["X-Equipment-Report-Format"], "html");
    assert.equal(response.headers["X-Equipment-Report-Events"], "2");
    assert.equal(response.headers["X-Equipment-Report-Rows"], "6");
    assert.equal(response.headers["X-Equipment-Report-Source-Cells"], "2");
    assert.match(response.body.toString(), /<!doctype html>/i);
    assert.ok(!response.body.toString().startsWith("%PDF"));
    assert.match(response.body.toString(), /Bocina de prueba actual|Cinta de prueba actual/);
    assert.ok(!response.body.toString().includes('<script>origen sintético</script>'));
    assert.ok(!response.body.toString().includes("INVENTARIO FALSO"));
    assert.equal(h.model().productionMutations, 0);
    assert.equal(h.model().counts.zeroQuantityRows, 2);
    assert.equal(h.model().originalInventory.state.items[0].quantity, 3);
  }
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
  assert.deepEqual(fs.readdirSync(h.dir).sort(), existing);
  assert.equal(JSON.stringify(h.events), source);
});

test("HTML reports require a live report permission before building any model", async t => {
  const h = htmlHarness(t), payload = { format: "html", mode: "rent", events: h.events };
  const anonymous = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", payload, { auth: false });
  assert.equal(anonymous.statusCode, 401);
  assert.match(anonymous.json().error, /sesión/);
  h.api.authenticatedPrincipal = () => ({ id: "synthetic-reader", username: "Lector de prueba", active: true, permissions: ["equipment.read", "equipment.write"] });
  const reader = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", payload);
  assert.equal(reader.statusCode, 403);
  assert.match(reader.json().error, /permiso/);
  assert.equal(h.modelCount(), 0);
});

test("unsupported HTML modes and formats return useful JSON errors without joining the print queue", async t => {
  const h = htmlHarness(t);
  for (const payload of [
    { format: "html", mode: "master" }, { format: "html", mode: "summary" }, { format: "html", mode: "other" },
    { format: "text", mode: "rent" }, { format: null, mode: "rent" }, { format: {}, mode: "purchase" }
  ]) {
    const response = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", { ...payload, events: h.events });
    assert.equal(response.statusCode, 400, JSON.stringify(payload));
    assert.match(response.headers["Content-Type"], /application\/json/);
    assert.ok(response.json().error.length > 10);
  }
  assert.equal(h.modelCount(), 0);
});

test("malformed HTML report inputs keep the original draft and return the concrete validation message", async t => {
  const h = htmlHarness(t), before = fs.readFileSync(h.paths.warehouseInventoryPath);
  for (const patch of [{ events: [] }, { events: [{ ...h.events[0], sections: [{ items: [{ quantity: -1, description: "Equipo de prueba" }] }] }] }, { from: "2026-11-28", to: "2026-11-25" }]) {
    const response = await h.dispatch("POST", "/api/cuadros-equipo/reportes/provisional", { format: "html", mode: "transfer", events: h.events, ...patch });
    assert.equal(response.statusCode, 400);
    assert.ok(response.json().error.length > 10);
  }
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), before);
});
