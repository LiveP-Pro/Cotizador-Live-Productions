const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ui = require("../equipment-service-import.js");

const groups = [{ id: "actual", label: "ACTUAL" }, { id: "otro", label: "OTRO" }];
function preview() {
  return {
    importToken: "synthetic-current-upload", verification: { complete: true },
    services: ["Iluminación A", "Servicio nuevo"].map((name) => ({ name, mainSections: [{ title: "Equipos", items: [[0, "Equipo de prueba"]] }] })),
    existingTargets: [{ id: "existing-id", name: "  ILUMINACION  A ", groupId: "actual" }]
  };
}
const selections = () => preview().services.map((service) => ({ name: service.name, category: "actual", newCategory: "" }));

test("la actualización exige marcar la opción y el payload anterior no cambia", () => {
  const p = preview();
  const original = JSON.stringify(p);
  assert.equal("replaceExistingByName" in ui.createPayload(p, selections(), groups, "base"), false);
  assert.equal("replaceExistingByName" in ui.createPayload(p, selections(), groups, "base", { replaceExistingByName: false }), false);
  assert.equal(ui.createPayload(p, selections(), groups, "base", { replaceExistingByName: true }).replaceExistingByName, true);
  assert.equal(JSON.stringify(p), original);
  assert.deepEqual(ui.draftFor(p)[0], { name: "Iluminación A", category: "", newCategory: "" });
});

test("la revisión cuenta coincidencias por nombre del archivo y categoría exacta", () => {
  const p = preview();
  const selected = selections();
  const options = { replaceExistingByName: true };
  let html = ui.renderPreview(p, selected, groups, options);
  assert.match(html, /Se actualizarán 1 servicios existentes y se agregarán 1 servicios nuevos/);
  assert.match(html, /id="equipmentImportReplaceExisting" type="checkbox" checked/);
  assert.match(html, /class="equipment-service-import-quantity">0<\/td>/);
  selected[0].name = "Nombre nuevo del servicio actualizado";
  assert.match(ui.renderPreview(p, selected, groups, options), /Se actualizarán 1 servicios existentes/);
  selected[0].category = "otro";
  assert.match(ui.renderPreview(p, selected, groups, options), /Se actualizarán 0 servicios existentes y se agregarán 2 servicios nuevos/);
});

test("la revisión no equipara signos, modelos, categorías nuevas ni equipos", () => {
  const p = preview();
  p.existingTargets[0].name = "Iluminación-A";
  let html = ui.renderPreview(p, selections(), groups, { replaceExistingByName: true });
  assert.match(html, /Se actualizarán 0 servicios existentes/);
  p.existingTargets[0].name = "Iluminación A";
  const selected = selections();
  selected[0].category = ui.NEW_CATEGORY;
  selected[0].newCategory = "Nueva";
  html = ui.renderPreview(p, selected, groups, { replaceExistingByName: true });
  assert.match(html, /Se actualizarán 0 servicios existentes/);
});

test("una coincidencia ambigua bloquea actualizar pero conserva la importación normal", () => {
  const p = preview();
  p.existingTargets.push({ id: "another-id", name: "Iluminación A", groupId: "actual" });
  assert.match(ui.selectionError(p, selections(), groups, { replaceExistingByName: true }), /varios servicios existentes/);
  assert.throws(() => ui.createPayload(p, selections(), groups, "base", { replaceExistingByName: true }), /varios servicios existentes/);
  assert.equal(ui.selectionError(p, selections(), groups), "");
  assert.doesNotThrow(() => ui.createPayload(p, selections(), groups, "base"));
  assert.match(ui.renderPreview(p, selections(), groups, { replaceExistingByName: true }), /No se puede decidir cuál actualizar/);
});

test("los metadatos ausentes conservan el control desmarcado y cero coincidencias", () => {
  const p = preview();
  delete p.existingTargets;
  const html = ui.renderPreview(p, selections(), groups);
  assert.match(html, /id="equipmentImportReplaceExisting" type="checkbox" \/>/);
  assert.match(html, /Hay 0 coincidencias/);
  assert.equal(ui.createPayload(p, selections(), groups, "base", { replaceExistingByName: true }).replaceExistingByName, true);
});

function harness(sourcePreview, saveResponses = []) {
  const elements = new Map();
  class Element {
    constructor(id) { this.id = id; this.dataset = {}; this.listeners = {}; this.value = ""; this.open = false; this.checked = false; this.disabled = false; this.hidden = false; this.textContent = ""; this.children = []; }
    set innerHTML(html) {
      this.html = html;
      this.children = [];
      for (const match of html.matchAll(/<(input|select|button|p|label)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const child = new Element(match[3]);
        child.checked = /\schecked(?:\s|$)/.test(match[2]);
        child.hidden = /\shidden(?:\s|$)/.test(match[2]);
        child.value = match[2].match(/\bvalue="([^"]*)"/)?.[1] || "";
        const field = match[2].match(/data-import-field="([^"]+)"/)?.[1];
        const index = match[2].match(/data-import-index="([^"]+)"/)?.[1];
        if (field) child.dataset.importField = field;
        if (index) child.dataset.importIndex = index;
        elements.set(child.id, child);
        this.children.push(child);
      }
    }
    get innerHTML() { return this.html || ""; }
    addEventListener(event, handler) { (this.listeners[event] ||= []).push(handler); }
    async emit(event, target = this) { for (const handler of this.listeners[event] || []) await handler({ target, preventDefault() {} }); }
    querySelector(selector) {
      if (selector === '[data-import-field="category"]') return this.children.find((child) => child.dataset.importField === "category");
      if (selector.startsWith("[data-import-new-category=")) return { hidden: true };
      return null;
    }
    querySelectorAll() { return this.children; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() {}
    click() {}
  }
  for (const id of ["equipmentImportServiceFileButton", "equipmentServiceImportFileInput", "equipmentServiceImportDialog", "equipmentServiceImportContent", "equipmentServiceImportDialogStatus", "equipmentServiceImportStatus", "equipmentServiceImportCloseButton", "equipmentServiceImportCancelButton", "equipmentServiceImportChooseButton", "equipmentServiceImportSaveButton"]) elements.set(id, new Element(id));
  const bodies = [];
  const context = vm.createContext({ module: { exports: {} }, AbortController, document: { getElementById: (id) => elements.get(id) }, fetch: async (_url, init) => {
    if (init.method === "PUT") {
      bodies.push(JSON.parse(init.body));
      return saveResponses.shift() || { ok: true, json: async () => ({ updatedCount: 1, addedCount: 1 }) };
    }
    return { ok: true, json: async () => sourcePreview };
  } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment-service-import.js"), "utf8"), context);
  const instance = context.module.exports.init({ groups, baseVersion: "synthetic-base" });
  return { instance, bodies, get: (id) => elements.get(id), async importFile() { await instance.openFile({ name: "Synthetic.xlsx", size: 4, arrayBuffer: async () => new ArrayBuffer(4) }); }, async bulk(category = "actual") {
    elements.get("equipmentImportBulkCategory").value = category;
    await elements.get("equipmentServiceImportContent").emit("click", { closest: (selector) => selector === "#equipmentImportApplyBulkCategory" });
  }, async toggle(value) {
    elements.get("equipmentImportReplaceExisting").checked = value;
    await elements.get("equipmentServiceImportContent").emit("change", elements.get("equipmentImportReplaceExisting"));
  } };
}

test("marcar, aplicar categoría a todos y cambiar una categoría conserva el estado y los conteos", async () => {
  const h = harness(preview());
  await h.importFile();
  assert.equal(h.instance.getState().replaceExistingByName, false);
  await h.toggle(true);
  await h.bulk();
  assert.equal(h.instance.getState().replaceExistingByName, true);
  assert.equal(h.get("equipmentImportReplaceExisting").checked, true);
  assert.match(h.get("equipmentServiceImportContent").innerHTML, /Se actualizarán 1 servicios existentes/);
  const category = h.get("equipmentImportServiceCategory0");
  category.value = "otro";
  await h.get("equipmentServiceImportContent").emit("change", category);
  assert.match(h.get("equipmentImportReplacementSummary").textContent, /Se actualizarán 0 servicios existentes y se agregarán 2 servicios nuevos/);
  await h.toggle(false);
  assert.equal(h.instance.getState().replaceExistingByName, false);
});

test("un fallo al guardar conserva la opción para reintentar y muestra los conteos confirmados", async () => {
  const h = harness(preview(), [{ ok: false, json: async () => ({ error: "Reintente con la selección actual" }) }]);
  await h.importFile();
  await h.bulk();
  await h.toggle(true);
  await h.get("equipmentServiceImportSaveButton").emit("click");
  assert.equal(h.instance.getState().replaceExistingByName, true);
  assert.equal(h.get("equipmentImportReplaceExisting").checked, true);
  assert.equal(h.get("equipmentServiceImportSaveButton").disabled, false);
  assert.match(h.get("equipmentServiceImportDialogStatus").textContent, /Reintente/);
  await h.get("equipmentServiceImportSaveButton").emit("click");
  assert.equal(h.bodies.length, 2);
  assert.ok(h.bodies.every((body) => body.replaceExistingByName === true));
  assert.match(h.get("equipmentServiceImportStatus").textContent, /Se actualizaron 1 servicios existentes y se agregaron 1 servicios nuevos/);
  await h.importFile();
  assert.equal(h.instance.getState().replaceExistingByName, false);
  assert.equal(h.get("equipmentImportReplaceExisting").checked, false);
});

test("la ambigüedad impide el botón guardar y desmarcar restaura el flujo habitual", async () => {
  const p = preview();
  p.existingTargets.push({ id: "ambiguous", name: "Iluminación A", groupId: "actual" });
  const h = harness(p);
  await h.importFile();
  await h.bulk();
  assert.equal(h.get("equipmentServiceImportSaveButton").disabled, false);
  await h.toggle(true);
  assert.equal(h.get("equipmentServiceImportSaveButton").disabled, true);
  assert.match(h.get("equipmentServiceImportDialogStatus").textContent, /varios servicios existentes/);
  await h.toggle(false);
  assert.equal(h.get("equipmentServiceImportSaveButton").disabled, false);
});
