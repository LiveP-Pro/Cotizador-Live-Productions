const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { createHarness } = require("./helpers/equipment-server-harness.cjs");

async function sourceWorkbook() {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Fuente sintetica");
  [
    ["Servicio: Servicio sintetico"],
    ["Categoria: AUDIO ORIGINAL"],
    ["Cantidad", "Descripcion", "Notas"],
    [0, "Unidad modelo 2026", "Nota original"],
    [3, "Cable de prueba", "Conservar detalle"],
    [null, null, "Nota: conservar tambien esta fila"]
  ].forEach((row) => sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}

async function upload(h, options = {}) {
  const buffer = await sourceWorkbook();
  const response = await h.dispatch("POST", "/api/cuadros-equipo/importar-archivo", undefined, {
    body: buffer, headers: { "x-file-name": encodeURIComponent("Fuente actual sintetica.xlsx"),
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-length": String(buffer.length) },
    ...options
  });
  assert.equal(response.statusCode, 200, response.body.toString());
  const preview = response.json();
  assert.equal(preview.verification.complete, true);
  const payload = { importToken: preview.importToken, baseCatalogVersion: "synthetic-current",
    services: preview.services.map((service, index) => ({ index, name: service.name, groupId: "audio" })) };
  return { buffer, preview, payload };
}

test("verified service import stores authoritative source metadata, zero, headings and notes", async (t) => {
  const h = createHarness(t);
  const { buffer, preview, payload } = await upload(h);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  const saved = response.json();
  const service = Object.values(saved.services)[0];
  assert.equal(service.importSource.authoritative, true);
  assert.equal(service.importSource.fileName, "Fuente actual sintetica.xlsx");
  assert.equal(service.mainSections.length, preview.services[0].mainSections.length);
  service.mainSections.forEach((section, index) => {
    assert.equal(section.importSource.authoritative, true);
    assert.equal(section.importSource.sourceFileUrl, saved.sourceFileUrl);
    assert.equal(section.title, preview.services[0].mainSections[index].title);
    assert.deepEqual(section.items, preview.services[0].mainSections[index].items);
    assert.deepEqual(section.rows, preview.services[0].mainSections[index].rows);
    assert.deepEqual(section.notes, preview.services[0].mainSections[index].notes);
  });
  assert.equal(service.mainSections.flatMap((section) => section.items)[0][0], 0);
  assert.deepEqual(fs.readFileSync(path.join(h.paths.equipmentServiceSourcesDir, saved.importId + ".xlsx")), buffer);
  const privateResponse = await h.dispatch("GET", saved.sourceFileUrl, undefined, { auth: false });
  assert.equal(privateResponse.statusCode, 401);
  const authorized = await h.dispatch("GET", saved.sourceFileUrl);
  assert.equal(authorized.statusCode, 200);
  assert.equal(authorized.headers["Cache-Control"], "no-store");
  assert.deepEqual(authorized.body, buffer);
});

test("a retry after a lost response returns the completed import without writing again", async (t) => {
  const h = createHarness(t);
  const { payload } = await upload(h);
  const first = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(first.statusCode, 200);
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const retried = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(retried.statusCode, 200);
  assert.deepEqual(retried.json(), first.json());
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  assert.equal(fs.readdirSync(h.paths.equipmentServiceSourcesDir).length, 2);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesBackupPath), false);
  const changed = structuredClone(payload);
  changed.services[0].name = "Otra decision";
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", changed)).statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
});

test("authentication, preview ownership and the 20 minute expiry remain required", async (t) => {
  const h = createHarness(t);
  const unauthorized = await h.dispatch("POST", "/api/cuadros-equipo/importar-archivo", undefined, { auth: false });
  assert.equal(unauthorized.statusCode, 401);
  const { payload } = await upload(h);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload, { auth: false })).statusCode, 401);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload, { owner: "different-synthetic-session" })).statusCode, 410);
  h.advance(20 * 60 * 1000 + 1);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload)).statusCode, 410);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  assert.equal(fs.existsSync(h.paths.equipmentServiceSourcesDir), false);
});

test("source cell verification rejects a partial or edited commit even if the preview was complete", async (t) => {
  const h = createHarness(t);
  const { payload } = await upload(h);
  const entry = h.api.equipmentServiceImportPreviews.get(payload.importToken);
  entry.preview.services[0].mainSections.find((section) => section.items.length).items[0][0] = 999;
  assert.equal(entry.preview.verification.complete, true);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 422);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  assert.equal(fs.existsSync(h.paths.equipmentServiceSourcesDir), false);
});

test("concurrent replacements of the same source cannot overwrite one another", async (t) => {
  const h = createHarness(t);
  const first = await upload(h);
  const second = await upload(h);
  const responses = await Promise.all([first, second].map(({ payload }) => h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload)));
  assert.deepEqual(responses.map((response) => response.statusCode), [200, 409]);
  const stored = JSON.parse(fs.readFileSync(h.paths.equipmentCatalogOverridesPath, "utf8"));
  assert.equal(Object.keys(stored.services).length, 1);
  assert.equal(Object.keys(stored.imports).length, 1);
});

test("a new version replaces only its own current source and preserves other sources", async (t) => {
  const h = createHarness(t);
  h.write("equipmentCatalogOverridesPath", { version: 3, baseCatalogVersion: "synthetic-current", groups: {}, imports: {}, services: {
    "previous-same-source": { name: "Previous synthetic version", groupId: "audio", importSource: { bookKey: "fuente actual sintetica.xlsx" } },
    "separate-source": { name: "Separate synthetic source", groupId: "audio", importSource: { bookKey: "otra fuente sintetica.xlsx" } }
  } });
  const { preview, payload } = await upload(h);
  assert.equal(preview.replaces.count, 1);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().removedServiceIds, ["previous-same-source"]);
  const stored = JSON.parse(fs.readFileSync(h.paths.equipmentCatalogOverridesPath, "utf8"));
  assert.equal(stored.services["previous-same-source"], undefined);
  assert.equal(stored.services["separate-source"].name, "Separate synthetic source");
  assert.equal(Object.keys(stored.services).length, 2);
});

test("older editors that omit import metadata still preserve authoritative literal names", async (t) => {
  const h = createHarness(t);
  const importSource = { authoritative: true, fileName: "Fuente certificada sintetica.xlsx", bookKey: "synthetic-certified" };
  h.write("equipmentCatalogOverridesPath", { version: 3, baseCatalogVersion: "synthetic-current", groups: {}, imports: {}, services: {
    "certified-service": { name: "Original synthetic name", mainSections: [], importSource }
  } });
  const payload = { baseCatalogVersion: "synthetic-current", serviceId: "certified-service", custom: true, groupId: "audio",
    name: "  Nombre editado literal  ", mainSections: [{ id: "synthetic-section", title: "  Categoria literal  ", items: [[0, "  Descripcion literal  "]] }], audioOptions: {} };
  payload.expectedServiceRevision = (await h.dispatch("GET", "/api/cuadros-equipo/catalogo?baseVersion=synthetic-current")).json().serviceRevisions["certified-service"];
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  const service = response.json().service;
  assert.equal(service.name, payload.name);
  assert.equal(service.mainSections[0].title, payload.mainSections[0].title);
  assert.deepEqual(service.mainSections[0].items, payload.mainSections[0].items);
  assert.deepEqual(service.importSource, importSource);
});
