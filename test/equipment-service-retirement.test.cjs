const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ExcelJS = require("exceljs");
const { createHarness, inventory } = require("./helpers/equipment-server-harness.cjs");

const version = "synthetic-current";
const bookName = "Fuente actual sintetica.xlsx";
const baseService = (name) => ({ name, mainSections: [{ title: "Anterior", items: [[999, "Equipo base retirado"]] }], audioOptions: {} });
function fixture(t) {
  const h = createHarness(t);
  fs.writeFileSync(path.join(h.dir, "equipment-catalog.js"), "window.requerimientoEquipoCatalog = " + JSON.stringify({
    version, groups: [{ id: "audio", label: "Audio", serviceIds: ["retired", "kept"] }],
    services: { retired: baseService("Servicio retirado"), kept: baseService("Servicio conservado") }
  }) + ";");
  h.write("warehouseInventoryPath", inventory(27));
  return h;
}
async function upload(h, names, { fileName = bookName, replace = true } = {}) {
  const book = new ExcelJS.Workbook();
  names.forEach((name, index) => {
    const sheet = book.addWorksheet("Cuadro " + (index + 1));
    [["Servicio: " + name], ["Categoria: Fuente actual"], ["Cantidad", "Descripcion", "Notas"],
      [0, "Unidad actual cero", "Nota actual"], [2, "Unidad actual distinta", "Detalle actual"]].forEach((row) => sheet.addRow(row));
  });
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  const response = await h.dispatch("POST", "/api/cuadros-equipo/importar-archivo", undefined, {
    body: buffer, headers: { "x-file-name": encodeURIComponent(fileName), "content-length": String(buffer.length) }
  });
  assert.equal(response.statusCode, 200, response.body.toString());
  const preview = response.json();
  assert.equal(preview.verification.complete, true);
  return { preview, payload: { importToken: preview.importToken, baseCatalogVersion: version, replaceExistingByName: replace,
    services: preview.services.map((service, index) => ({ index, name: service.name, groupId: "audio" })) } };
}
async function commit(h, uploadResult) {
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", uploadResult.payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  return response.json();
}
async function retire(h) {
  await commit(h, await upload(h, ["Servicio retirado", "Servicio conservado"]));
  return commit(h, await upload(h, ["Servicio conservado"]));
}
async function readCurrent(h) {
  const response = await h.dispatch("GET", "/api/cuadros-equipo/catalogo?baseVersion=" + version);
  assert.equal(response.statusCode, 200);
  return response.json();
}

test("an omitted base service stays retired in a fresh GET and after another current-source import", async (t) => {
  const h = fixture(t);
  const stockBefore = fs.readFileSync(h.paths.warehouseInventoryPath);
  const baseBefore = fs.readFileSync(path.join(h.dir, "equipment-catalog.js"));
  const result = await retire(h);
  assert.deepEqual(result.removedServiceIds, ["retired"]);
  let current = await readCurrent(h);
  assert.deepEqual(current.removedServiceIds, ["retired"]);
  assert.equal(current.services.retired, undefined);
  assert.deepEqual(current.retiredServices.retired, { name: "Servicio retirado", groupId: "audio", bookKey: "fuente actual sintetica.xlsx" });
  assert.equal(JSON.stringify(current.retiredServices).includes("Equipo base retirado"), false);
  await commit(h, await upload(h, ["Otro servicio actual"], { fileName: "Otra fuente actual.xlsx" }));
  current = await readCurrent(h);
  assert.deepEqual(current.removedServiceIds, ["retired"]);
  const nextPreview = (await upload(h, ["Servicio conservado"])).preview;
  assert.equal(nextPreview.existingTargets.some((target) => target.id === "retired"), false);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), stockBefore);
  assert.deepEqual(fs.readFileSync(path.join(h.dir, "equipment-catalog.js")), baseBefore);
});

test("a new version can restore its retired service at the exact id using only its newly supplied rows", async (t) => {
  const h = fixture(t);
  await retire(h);
  const result = await commit(h, await upload(h, ["Servicio retirado", "Servicio conservado"]));
  assert.deepEqual(Object.keys(result.services), ["retired", "kept"]);
  assert.equal(result.updatedCount, 2);
  assert.equal(result.addedCount, 0);
  assert.deepEqual(result.removedServiceIds, []);
  const current = await readCurrent(h);
  assert.deepEqual(current.removedServiceIds, []);
  assert.deepEqual(current.retiredServices, {});
  assert.deepEqual(current.services.retired.mainSections.flatMap((section) => section.items),
    [[0, "Unidad actual cero"], [2, "Unidad actual distinta"]]);
  assert.equal(JSON.stringify(current.services.retired).includes("Equipo base retirado"), false);
  assert.equal(current.services["servicio-retirado-2"], undefined);
});

test("another book cannot silently restore an identity retired by a different current source", async (t) => {
  const h = fixture(t);
  await retire(h);
  const result = await commit(h, await upload(h, ["Servicio retirado"], { fileName: "Otra fuente actual.xlsx" }));
  assert.equal(result.services.retired, undefined);
  assert.equal(result.addedCount, 1);
  assert.deepEqual(result.removedServiceIds, ["retired"]);
  assert.equal((await readCurrent(h)).retiredServices.retired.bookKey, "fuente actual sintetica.xlsx");
});

test("changing a retired identity during review rejects restoration without source or catalog writes", async (t) => {
  const h = fixture(t);
  await retire(h);
  const next = await upload(h, ["Servicio retirado", "Servicio conservado"]);
  const changed = await readCurrent(h);
  changed.retiredServices.retired.name = "Nombre cambiado mientras se revisaba";
  h.write("equipmentCatalogOverridesPath", changed);
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const sourceFilesBefore = fs.readdirSync(h.paths.equipmentServiceSourcesDir);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", next.payload);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  assert.deepEqual(fs.readdirSync(h.paths.equipmentServiceSourcesDir), sourceFilesBefore);
});

test("an explicit manual edit restores its chosen id and clears its retirement metadata", async (t) => {
  const h = fixture(t);
  await retire(h);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", {
    baseCatalogVersion: version, serviceId: "retired", custom: true, groupId: "audio", name: "Servicio ingresado manualmente",
    mainSections: [{ title: "Manual actual", items: [[0, "Unidad manual actual"]] }], audioOptions: {}
  });
  assert.equal(response.statusCode, 200, response.body.toString());
  const current = await readCurrent(h);
  assert.deepEqual(current.removedServiceIds, []);
  assert.deepEqual(current.retiredServices, {});
  assert.deepEqual(current.services.retired.mainSections[0].items, [[0, "Unidad manual actual"]]);
});

test("ordinary repeated imports retain their current custom id instead of incrementing its suffix", async (t) => {
  const h = fixture(t);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await commit(h, await upload(h, ["Nuevo servicio actual"], { replace: false }));
    assert.deepEqual(Object.keys(result.services), ["nuevo-servicio-actual"]);
    assert.deepEqual(result.removedServiceIds, []);
  }
});
