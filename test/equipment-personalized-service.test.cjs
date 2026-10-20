const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHarness, inventory } = require("./helpers/equipment-server-harness.cjs");

// This suite uses only synthetic current clipboard data and current inventory.
// It never reads production catalog data or a historical workbook.
function fixture(t) {
  const h = createHarness(t);
  const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  const start = source.indexOf("async function savePersonalizedEquipmentService(");
  const end = source.indexOf("\n}\n", start) + 2;
  vm.runInContext(source.slice(start, end), h.api, { filename: "personalized-service-handler.js" });
  const base = { version: "synthetic-current", groups: [{ id: "audio", label: "Audio sintético", serviceIds: ["current-base"] }], services: {
    "current-base": { name: "Servicio vigente", mainSections: [{ title: "Base sintética", items: [[0, "Unidad vigente cero"]] }], audioOptions: {} }
  } };
  fs.writeFileSync(path.join(h.dir, "equipment-catalog.js"), "window.requerimientoEquipoCatalog = " + JSON.stringify(base) + ";");
  h.write("warehouseInventoryPath", inventory(3));
  return h;
}
function payload(id = "servicio-clipboard-a", name = "Servicio nuevo desde portapapeles", groupId = "personalizados") {
  return { baseCatalogVersion: "synthetic-current", template: { id, name, groupId,
    mainSections: [{ id: "clipboard-section-1", title: "  Categoría literal  ", notes: ["  Observación literal  ", 0],
      sourceCells: [{ ref: "Clipboard!A1", value: "Cantidad" }, { ref: "Clipboard!A2", value: 0 }],
      rows: [{ type: "header", description: "Cantidad / Descripción", cells: [{ column: 0, value: "Cantidad" }, { column: 1, value: "Descripción" }] },
        { type: "item", sourceRow: 2, sourceItemIndex: 0, cells: [{ column: 0, value: 0 }, { column: 1, value: "  Equipo literal cero  " }] },
        { type: "note", sourceRow: 3, description: "Nota posterior", cells: [{ column: 2, value: "Nota posterior" }] }],
      items: [{ id: "clipboard-item-1", quantity: 0, description: "  Equipo literal cero  ", warehouseInventoryId: "synthetic-unit", itemType: "equipo",
        sourceItemIndex: 0, notes: ["Nota de la línea"], sourceCells: [{ ref: "Clipboard!A2", value: 0 }] },
      { id: "clipboard-item-2", quantity: 2, description: "Material sintético", itemType: "consumible", procurementChoice: "purchase", procurementPreference: "purchase" }] }],
    source: { format: "clipboard-tsv", rows: [{ id: "row-1", cells: ["Cantidad", "Descripción", "Notas"], kind: "header" },
      { id: "row-2", cells: ["0", "  Equipo literal cero  ", "Nota de la línea"], kind: "item" }] }, notes: "  Notas del cuadro\nSegunda línea  " } };
}
function saved(h) { return JSON.parse(fs.readFileSync(h.paths.equipmentCatalogOverridesPath, "utf8")); }
const post = (h, body, options) => h.dispatch("POST", "/api/cuadros-equipo/servicios-personalizados", body, options);

test("a reusable clipboard service is created only on explicit authenticated commit and preserves every zero and source field", async (t) => {
  const h = fixture(t); const body = payload(); const original = structuredClone(body);
  const stockBefore = fs.readFileSync(h.paths.warehouseInventoryPath); const baseBefore = fs.readFileSync(path.join(h.dir, "equipment-catalog.js"));
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  assert.equal((await post(h, body, { auth: false })).statusCode, 401);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  const response = await post(h, body);
  assert.equal(response.statusCode, 200, response.body.toString());
  const result = response.json(); assert.equal(result.created, true); assert.equal(result.duplicate, false);
  assert.equal(result.serviceId, body.template.id); assert.match(result.serviceRevision, /^[a-f0-9]{64}$/);
  assert.equal(result.groups.personalizados.label, "Personalizados");
  const service = result.service; assert.equal(service.custom, true); assert.equal(service.groupId, "personalizados");
  assert.deepEqual(service.mainSections[0].items, body.template.mainSections[0].items);
  assert.deepEqual(service.mainSections[0].rows, body.template.mainSections[0].rows);
  assert.deepEqual(service.mainSections[0].sourceCells, body.template.mainSections[0].sourceCells);
  assert.deepEqual(service.mainSections[0].notes, body.template.mainSections[0].notes);
  assert.equal(service.mainSections[0].title, body.template.mainSections[0].title);
  assert.equal(service.importSource.authoritative, true); assert.equal(service.importSource.personalized, true);
  assert.deepEqual(service.importSource.source, body.template.source);
  assert.deepEqual(service.importSource.sourceSections, body.template.mainSections); assert.equal(service.notes, body.template.notes);
  assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath), stockBefore); assert.deepEqual(fs.readFileSync(path.join(h.dir, "equipment-catalog.js")), baseBefore);
  assert.equal(fs.existsSync(path.join(h.dir, ".equipment-private")), false, "creating a service neither reserves nor saves an event");
  assert.deepEqual(body, original, "request data never changes while building the service");
});

test("retries are idempotent even after a lost response and never rewrite a service that was later edited", async (t) => {
  const h = fixture(t); const body = payload(); const first = await post(h, body); assert.equal(first.statusCode, 200);
  let before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath); h.advance(1000);
  const retry = await post(h, structuredClone(body)); assert.equal(retry.statusCode, 200); assert.equal(retry.json().created, false); assert.equal(retry.json().duplicate, true);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  const current = saved(h); current.services[body.template.id].name = "Nombre editado después de crear";
  current.services[body.template.id].mainSections[0].items[1].quantity = 4;
  h.write("equipmentCatalogOverridesPath", current); before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const afterEdit = await post(h, body); assert.equal(afterEdit.statusCode, 200);
  assert.equal(afterEdit.json().service.name, "Nombre editado después de crear"); assert.equal(afterEdit.json().service.mainSections[0].items[1].quantity, 4);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
});

test("the stable clipboard identity cannot be reused for another name, group, quantity or source cell", async (t) => {
  const h = fixture(t); const original = payload(); await post(h, original); const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  for (const mutate of [body => { body.template.name = "Otro nombre"; }, body => { body.template.groupId = "audio"; },
    body => { body.template.mainSections[0].items[1].quantity = 3; }, body => { body.template.source.rows[1].cells[2] = "Otra nota"; }]) {
    const body = structuredClone(original); mutate(body); assert.equal((await post(h, body)).statusCode, 409);
    assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
  }
});

test("active catalog names and reserved ids never overwrite existing or retired services", async (t) => {
  const h = fixture(t);
  assert.equal((await post(h, payload("current-base", "Nombre diferente"))).statusCode, 409);
  assert.equal((await post(h, payload("new-identity", "  SERVICIO VIGENTE  "))).statusCode, 409);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  h.write("equipmentCatalogOverridesPath", { version: 3, baseCatalogVersion: "synthetic-current", services: {}, groups: {}, imports: {},
    removedServiceIds: ["retired-id"], retiredServices: { "retired-id": { name: "Nombre retirado", groupId: "audio" } } });
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  assert.equal((await post(h, payload("retired-id", "Nuevo nombre"))).statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
});

test("only actual current groups or the explicit default group are valid and other services stay unchanged", async (t) => {
  const h = fixture(t); assert.equal((await post(h, payload("new-a", "Servicio nuevo", "grupo-ausente"))).statusCode, 400);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
  h.write("equipmentCatalogOverridesPath", { version: 3, baseCatalogVersion: "synthetic-current", services: { "unrelated": {
    name: "Otro servicio privado", custom: true, groupId: "private-group", mainSections: [{ title: "Actual", items: [[7, "Unidad ajena"]] }] } },
    groups: { "private-group": { id: "private-group", label: "Grupo privado actual", serviceIds: ["unrelated"] } }, imports: { "existing-import": { source: "Current synthetic source" } } });
  const before = saved(h); const response = await post(h, payload("new-b", "Nuevo en grupo privado", "private-group"));
  assert.equal(response.statusCode, 200, response.body.toString());
  assert.deepEqual(response.json().services.unrelated, before.services.unrelated); assert.deepEqual(saved(h).imports, before.imports);
  assert.deepEqual(response.json().groups["private-group"].serviceIds, ["unrelated", "new-b"]);
  assert.equal(saved(h).groups.personalizados, undefined, "the virtual default category is not created until selected and committed");
});

test("large valid clipboard sections are never silently truncated and blank or negative quantities are rejected", async (t) => {
  const h = fixture(t); const body = payload(); body.template.mainSections[0].items = Array.from({ length: 2001 }, (_, index) => ({ id: "row-" + index, quantity: 0, description: "Unidad sintética " + index, sourceItemIndex: index }));
  const response = await post(h, body); assert.equal(response.statusCode, 200, response.body.toString());
  assert.equal(response.json().service.mainSections[0].items.length, 2001); assert.equal(response.json().service.mainSections[0].items.at(-1).sourceItemIndex, 2000);
  for (const quantity of ["", "   ", -1, null]) {
    const invalid = payload("invalid-" + String(quantity).replace(/[^a-z0-9]/g, "x"), "Nuevo inválido " + String(quantity)); invalid.template.mainSections[0].items[0].quantity = quantity;
    assert.equal((await post(h, invalid)).statusCode, 400);
  }
  assert.equal(Object.keys(saved(h).services).length, 1);
});

test("ordinary permanent edits retain item metadata and section source cells while legacy arrays remain arrays", (t) => {
  const h = fixture(t); const section = payload().template.mainSections[0];
  const normalized = h.api.normalizeEquipmentCatalogSections([section], true);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized[0].items)), section.items);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized[0].sourceCells)), section.sourceCells);
  assert.deepEqual(JSON.parse(JSON.stringify(normalized[0].notes)), section.notes);
  assert.deepEqual(JSON.parse(JSON.stringify(h.api.normalizeEquipmentCatalogItems([[0, "  Cero literal  "]], "Prueba", true))), [[0, "  Cero literal  "]]);
});

test("an obsolete base catalog never replaces current private state", async (t) => {
  const h = fixture(t); const body = payload(); body.baseCatalogVersion = "outdated-source";
  assert.equal((await post(h, body)).statusCode, 409); assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath), false);
});

test("an unversioned nonempty private catalog is never silently adopted into the current source", async (t) => {
  const h = fixture(t);
  h.write("equipmentCatalogOverridesPath", { services: { "private-without-version": { name: "Origen no identificado" } } });
  const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  assert.equal((await post(h, payload())).statusCode, 409);
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
});

test("concurrent commits serialize one creation and refuse a same-name different-id collision", async (t) => {
  const h = fixture(t); const body = payload();
  const retries = await Promise.all([post(h, structuredClone(body)), post(h, structuredClone(body))]);
  assert.deepEqual(retries.map(response => response.statusCode), [200, 200]);
  assert.deepEqual(retries.map(response => response.json().created), [true, false]);
  assert.equal(Object.keys(saved(h).services).length, 1);
  const collisions = await Promise.all([post(h, payload("service-race-a", "Otro servicio único")), post(h, payload("service-race-b", "Otro servicio único"))]);
  assert.deepEqual(collisions.map(response => response.statusCode), [200, 409]);
  assert.equal(Object.keys(saved(h).services).length, 2);
});

test("a large personalized service remains permanently editable without losing metadata or imposing legacy row limits", async (t) => {
  const h = fixture(t); const body = payload(); body.template.mainSections[0].items = Array.from({ length: 2001 }, (_, index) => ({
    id: "row-" + index, quantity: 0, description: "Unidad sintética " + index, sourceItemIndex: index, sourceCells: [{ column: 0, value: 0 }]
  }));
  const created = await post(h, body); assert.equal(created.statusCode, 200);
  const result = created.json();
  const updated = await h.dispatch("PUT", "/api/cuadros-equipo/catalogo", { baseCatalogVersion: "synthetic-current", serviceId: body.template.id,
    expectedServiceRevision: result.serviceRevision, name: "Nuevo nombre de servicio grande", custom: true, groupId: "personalizados",
    mainSections: result.service.mainSections, audioOptions: {} });
  assert.equal(updated.statusCode, 200, updated.body.toString());
  assert.equal(updated.json().service.mainSections[0].items.length, 2001);
  assert.deepEqual(updated.json().service.mainSections[0].items.at(-1), body.template.mainSections[0].items.at(-1));
  assert.deepEqual(updated.json().service.mainSections[0].sourceCells, body.template.mainSections[0].sourceCells);
});

test("an original committed retry remains idempotent after its original group was changed and removed", async (t) => {
  const h = fixture(t);
  h.write("equipmentCatalogOverridesPath", { version: 3, baseCatalogVersion: "synthetic-current", services: {}, groups: {
    "temporary": { id: "temporary", label: "Grupo temporal actual", serviceIds: [] }
  }, imports: {} });
  const body = payload("service-group-retry", "Servicio de prueba de reintento", "temporary");
  assert.equal((await post(h, body)).statusCode, 200);
  const current = saved(h); current.services[body.template.id].groupId = "audio"; delete current.groups.temporary;
  h.write("equipmentCatalogOverridesPath", current); const before = fs.readFileSync(h.paths.equipmentCatalogOverridesPath);
  const retry = await post(h, body);
  assert.equal(retry.statusCode, 200); assert.equal(retry.json().duplicate, true); assert.equal(retry.json().service.groupId, "audio");
  assert.deepEqual(fs.readFileSync(h.paths.equipmentCatalogOverridesPath), before);
});
