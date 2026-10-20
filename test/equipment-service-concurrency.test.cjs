const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createHarness } = require("./helpers/equipment-server-harness.cjs");

const version = "synthetic-current";
function service(name, quantity = 0) {
  return { name, mainSections: [{ id: "synthetic-section", title: "Categoría sintética", items: [[quantity, "Unidad sintética actual"]], notes: ["Observación conservada"] }], audioOptions: {} };
}
function fixture(t) {
  const h = createHarness(t);
  fs.writeFileSync(path.join(h.dir, "equipment-catalog.js"), "window.requerimientoEquipoCatalog = " + JSON.stringify({ version,
    services: { a: service("Servicio A"), b: service("Servicio B") }, groups: [{ id: "pruebas", label: "Pruebas", serviceIds: ["a", "b"] }] }) + ";");
  return h;
}
async function revisions(h) {
  const response = await h.dispatch("GET", `/api/cuadros-equipo/catalogo?baseVersion=${version}`);
  assert.equal(response.statusCode, 200, response.body.toString()); return response.json().serviceRevisions;
}
function payload(id, quantity, expectedServiceRevision) {
  return { baseCatalogVersion: version, serviceId: id, ...service(`Servicio ${id.toUpperCase()}`, quantity), ...(expectedServiceRevision ? { expectedServiceRevision } : {}) };
}

test("base service edits require a reviewed revision and reject stale concurrent writes without changing current data", async (t) => {
  const h = fixture(t); const initial = await revisions(h);
  assert.match(initial.a, /^[a-f0-9]{64}$/);
  const missing = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload("a", 2));
  assert.equal(missing.statusCode, 428); assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  const first = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload("a", 2, initial.a));
  assert.equal(first.statusCode, 200, first.body.toString()); assert.notEqual(first.json().serviceRevision, initial.a);
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const stale = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload("a", 9, initial.a));
  assert.equal(stale.statusCode, 409); assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  const updated = await revisions(h); assert.equal(updated.a, first.json().serviceRevision);
  assert.deepEqual(first.json().service.mainSections[0].items, [[2, "Unidad sintética actual"]]);
  const stored = JSON.parse(before); assert.equal(stored.serviceRevisions, undefined, "computed revision metadata never becomes source catalog data");
});

test("editing a different service does not invalidate an independently reviewed service token", async (t) => {
  const h = fixture(t); const initial = await revisions(h);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload("a", 2, initial.a))).statusCode, 200);
  const afterA = await revisions(h); assert.equal(afterA.b, initial.b);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload("b", 3, initial.b))).statusCode, 200);
  const current = JSON.parse(fs.readFileSync(h.paths.equipmentCatalogOverridesPath));
  assert.equal(current.services.a.mainSections[0].items[0][0], 2); assert.equal(current.services.b.mainSections[0].items[0][0], 3);
});

test("new service create-only writes need no previous token but cannot overwrite a base or private identity", async (t) => {
  const h = fixture(t);
  const create = { ...payload("new", 0), custom: true, groupId: "pruebas", createOnly: true };
  const first = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", create);
  assert.equal(first.statusCode, 200); assert.match(first.json().serviceRevision, /^[a-f0-9]{64}$/);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", create)).statusCode, 409);
  assert.equal((await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", { ...create, serviceId: "a" })).statusCode, 409);
  assert.deepEqual(JSON.parse(fs.readFileSync(h.paths.equipmentCatalogOverridesPath)).services.new.mainSections[0].items, [[0, "Unidad sintética actual"]]);
});

test("an outdated base version cannot replace another current catalog or bypass optimistic protection", async (t) => {
  const h = fixture(t); const token = (await revisions(h)).a;
  const initial = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", payload("a", 2, token));
  assert.equal(initial.statusCode, 200);
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const response = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", { ...payload("a", 7, token), baseCatalogVersion: "synthetic-obsolete" });
  assert.equal(response.statusCode, 409); assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
});
