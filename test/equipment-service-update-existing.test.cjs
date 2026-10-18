const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");
const { createHarness, inventory } = require("./helpers/equipment-server-harness.cjs");

const version = "synthetic-current";
function service(name = "Servicio sintetico", quantity = 9) {
  return { name, mainSections: [{ id: "old-section", title: "Anterior", items: [[quantity, "Unidad anterior"], [8, "Fila retirada"]] }], audioOptions: {} };
}
function writeBase(h, services, groups = [{ label: "Audio", serviceIds: Object.keys(services) }]) {
  fs.writeFileSync(path.join(h.dir, "equipment-catalog.js"), "window.requerimientoEquipoCatalog = " + JSON.stringify({ version, services, groups }) + ";");
}
function writePrivate(h, services = {}, groups = {}) {
  h.write("equipmentCatalogOverridesPath", { version: 3, baseCatalogVersion: version, savedAt: "synthetic-before", services, groups, imports: {} });
}
async function upload(h, names = ["Servicio sintetico"], fileName = "Fuente nueva sintetica.xlsx") {
  const book = new ExcelJS.Workbook();
  names.forEach((name, index) => {
    const sheet = book.addWorksheet("Cuadro " + (index + 1));
    [["Servicio: " + name], ["Categoria: Categoria fuente"], ["Cantidad", "Descripcion", "Notas"],
      [0, "Unidad nueva con cantidad cero", "Nota actual"], [2, "Unidad nueva distinta", "Detalle actual"]]
      .forEach((row) => sheet.addRow(row));
  });
  const buffer = Buffer.from(await book.xlsx.writeBuffer());
  const response = await h.dispatch("POST", "/api/cuadros-equipo/importar-archivo", undefined, {
    body: buffer, headers: { "x-file-name": encodeURIComponent(fileName),
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-length": String(buffer.length) }
  });
  assert.equal(response.statusCode, 200, response.body.toString());
  const preview = response.json();
  assert.equal(preview.verification.complete, true);
  return { preview, payload: { importToken: preview.importToken, baseCatalogVersion: version, replaceExistingByName: true,
    services: preview.services.map((entry, index) => ({ index, name: entry.name, groupId: "audio" })) } };
}
function readPrivate(h) { return JSON.parse(fs.readFileSync(h.paths.equipmentCatalogOverridesPath, "utf8")); }

test("preview exposes only merged target identity and derives groups without explicit ids", async (t) => {
  const h = createHarness(t);
  writeBase(h, { "stable-id": service(), "other-base": service("Otro servicio") });
  writePrivate(h, { "stable-id": { ...service("Nombre privado"), groupId: "grupo-privado" } }, {
    "grupo-privado": { label: "Grupo privado", serviceIds: ["stable-id"] }
  });
  const { preview } = await upload(h);
  assert.deepEqual(preview.existingTargets, [
    { id: "stable-id", name: "Nombre privado", groupId: "grupo-privado" },
    { id: "other-base", name: "Otro servicio", groupId: "audio" }
  ]);
  preview.existingTargets.forEach((target) => assert.deepEqual(Object.keys(target).sort(), ["groupId", "id", "name"]));
});

test("opt-in updates the base service id using only fresh rows and preserves unrelated private stock and books", async (t) => {
  const h = createHarness(t);
  writeBase(h, { "stable-id": service() });
  const unrelated = { ...service("Otro libro intacto", 777), custom: true, groupId: "audio", importSource: { bookKey: "otro libro.xlsx" } };
  writePrivate(h, { "unrelated-id": unrelated });
  h.write("warehouseInventoryPath", inventory(23));
  const stockBefore = fs.readFileSync(h.paths.warehouseInventoryPath);
  const baseBefore = fs.readFileSync(path.join(h.dir, "equipment-catalog.js"));
  const { preview, payload } = await upload(h);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  const saved = response.json();
  assert.deepEqual(Object.keys(saved.services), ["stable-id"]);
  assert.equal(saved.updatedCount, 1);
  assert.equal(saved.addedCount, 0);
  const updated = saved.services["stable-id"];
  assert.equal(updated.custom, true);
  assert.equal(updated.groupId, "audio");
  assert.equal(updated.importSource.authoritative, true);
  assert.deepEqual(updated.mainSections.map(({ items, rows, notes }) => ({ items, rows, notes })),
    preview.services[0].mainSections.map(({ items, rows, notes }) => ({ items, rows, notes })));
  assert.deepEqual(updated.mainSections.flatMap((section) => section.items), [[0, "Unidad nueva con cantidad cero"], [2, "Unidad nueva distinta"]]);
  assert.equal(JSON.stringify(updated).includes("Fila retirada"), false);
  const stored = readPrivate(h);
  assert.deepEqual(stored.services["unrelated-id"], unrelated);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), stockBefore);
  assert.deepEqual(fs.readFileSync(path.join(h.dir, "equipment-catalog.js")), baseBefore);
});

test("matching uses the original source name with exact category and only normalizes accents case and whitespace", async (t) => {
  const h = createHarness(t);
  writeBase(h, {
    "audio-target": service("  SERVÍCIO   SINTÉTICO  "),
    "other-category": service("Servicio sintetico", 333)
  }, [{ label: "Audio", serviceIds: ["audio-target"] }, { id: "different", label: "Otra", serviceIds: ["other-category"] }]);
  const { payload } = await upload(h);
  payload.services[0].name = "Nombre visible actualizado";
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  assert.deepEqual(Object.keys(response.json().services), ["audio-target"]);
  assert.equal(response.json().services["audio-target"].name, "Nombre visible actualizado");
  assert.equal(readPrivate(h).services["other-category"], undefined);
});

test("matching preserves meaningful punctuation instead of inventing service equivalences", async (t) => {
  const h = createHarness(t);
  writeBase(h, { "different-service": service("Servicio-sintetico") });
  const { payload } = await upload(h);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  assert.equal(response.json().addedCount, 1);
  assert.equal(response.json().updatedCount, 0);
  assert.equal(response.json().services["different-service"], undefined);
});

test("ambiguous same-name services in one group block the entire update", async (t) => {
  const h = createHarness(t);
  writeBase(h, { first: service(), second: service("SERVÍCIO SINTÉTICO") });
  const { payload } = await upload(h);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /varios servicios/);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  assert.equal(fs.existsSync(h.paths.equipmentServiceSourcesDir), false);
});

test("a concurrent edit of the selected private target returns 409 without overwriting it", async (t) => {
  const h = createHarness(t);
  writeBase(h, {});
  writePrivate(h, { target: { ...service(), groupId: "audio" } });
  const { payload } = await upload(h);
  const current = readPrivate(h);
  current.services.target.mainSections[0].items[0][0] = 444;
  h.write("equipmentCatalogOverridesPath", current);
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  assert.equal(fs.existsSync(h.paths.equipmentServiceSourcesDir), false);
});

test("a concurrent rename or new matching target cannot silently turn an update into a duplicate", async (t) => {
  for (const action of ["rename", "add"]) {
    const h = createHarness(t);
    writeBase(h, { target: service() });
    const { payload } = await upload(h);
    if (action === "rename") writeBase(h, { target: service("Nombre cambiado por otro usuario") });
    else writePrivate(h, { extra: { ...service(), groupId: "audio" } });
    const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
    assert.equal(response.statusCode, 409, action);
    assert.equal(fs.existsSync(h.paths.equipmentServiceSourcesDir), false);
  }
});

test("two source sheets cannot overwrite the same existing target within one import", async (t) => {
  const h = createHarness(t);
  writeBase(h, { target: service() });
  const { payload } = await upload(h, ["Servicio sintetico", "SERVÍCIO SINTÉTICO"]);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 400);
  assert.match(response.json().error, /mismo servicio/);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  assert.equal(fs.existsSync(h.paths.equipmentServiceSourcesDir), false);
});

test("a repeated replacement keeps the same id and the same-source replacement safeguards", async (t) => {
  const h = createHarness(t);
  writeBase(h, { "stable-id": service() });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { preview, payload } = await upload(h);
    assert.equal(preview.replaces.count, attempt);
    const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
    assert.equal(response.statusCode, 200, response.body.toString());
    assert.deepEqual(Object.keys(response.json().services), ["stable-id"]);
    assert.equal(response.json().updatedCount, 1);
    assert.equal(response.json().addedCount, 0);
    assert.deepEqual(Object.keys(readPrivate(h).services), ["stable-id"]);
  }
});

test("idempotency includes the replacement decision and unchanged retries write nothing", async (t) => {
  const h = createHarness(t);
  writeBase(h, { target: service() });
  const { payload } = await upload(h);
  const first = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(first.statusCode, 200);
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const retry = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(retry.statusCode, 200);
  assert.deepEqual(retry.json(), first.json());
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", { ...payload, replaceExistingByName: false })).statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  assert.equal(fs.readdirSync(h.paths.equipmentServiceSourcesDir).length, 2);
});

test("the default import keeps its existing create-with-suffix behavior", async (t) => {
  const h = createHarness(t);
  writeBase(h, { "servicio-sintetico": service() });
  const { payload } = await upload(h);
  delete payload.replaceExistingByName;
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/importar-servicios", payload);
  assert.equal(response.statusCode, 200, response.body.toString());
  assert.deepEqual(Object.keys(response.json().services), ["servicio-sintetico-2"]);
  assert.equal(response.json().addedCount, 1);
  assert.equal(response.json().updatedCount, 0);
});
