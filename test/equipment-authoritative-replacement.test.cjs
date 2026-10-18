const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function harness() {
  const context = vm.createContext({
    window: { requerimientoEquipoCatalog: { version: "synthetic-current", groups: [{ label: "Prueba", serviceIds: ["stable"] }], services: {
      stable: { name: "Servicio sintetico", mainSections: [{ id: "old-main", title: "Anterior", audioVariant: true, items: [[9, "Equipo anterior"]] }],
        audioOptions: { qsc: { label: "Variante anterior", items: [[77, "Audio anterior"]] }, other: { label: "Otra anterior", items: [[33, "Otro audio anterior"]] } },
        extras: [{ id: "old-extra", title: "Extra anterior", items: [[12, "Extra de una version anterior"]] }] }
    } } },
    document: { querySelector() { return null; }, addEventListener() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), context);
  const run = (code) => vm.runInContext(code, context);
  const json = (code) => JSON.parse(run("JSON.stringify(" + code + ")"));
  return { context, run, json };
}
function freshOverride() {
  return { name: "Servicio sintetico", custom: true, groupId: "prueba", importSource: { authoritative: true, fileName: "Fuente actual sintetica.xlsx" },
    mainSections: [{ id: "fresh-main", title: "Categoria actual", audioVariant: true, items: [[0, "Equipo actual con cantidad cero"]] }] };
}

test("fresh authoritative source without optional audio or extras removes old equipment from actual resolved sections", () => {
  const h = harness();
  h.context.override = freshOverride();
  assert.equal(h.run("applyEquipmentCatalogServiceOverride('stable', override)"), true);
  assert.deepEqual(h.json("equipmentServices.stable.audioOptions"), {});
  assert.deepEqual(h.json("equipmentServices.stable.extras"), []);
  assert.deepEqual(h.json("serviceWithEquipmentAudioOption('stable').mainSections[0].items"), [[0, "Equipo actual con cantidad cero"]]);
  assert.equal(h.run("equipmentServices.stable.custom"), true);
  assert.deepEqual(h.json("equipmentServiceGroups[0].serviceIds"), ["stable"]);
  assert.equal(JSON.stringify(h.json("equipmentServices.stable")).includes("anterior"), false);
});

test("authoritative optional audio and extras replace old versions without losing literal names zero notes or ownership", () => {
  const h = harness();
  const override = freshOverride();
  override.audioOptions = { fresh: { label: "Audio actual", items: [[0, "  Audio actual literal  "]] } };
  override.extras = [{ id: "fresh-extra", title: "Extras actuales", items: [[0, "Extra actual cero"], [2, "Extra actual distinto"]], notes: ["Nota actual"],
    rows: [{ type: "note", description: "Observacion actual" }] }];
  h.context.override = override;
  h.run("applyEquipmentCatalogServiceOverride('stable', override); equipmentState.djAudioType = 'fresh'");
  assert.deepEqual(Object.keys(h.json("equipmentServices.stable.audioOptions")), ["fresh"]);
  assert.deepEqual(h.json("serviceWithEquipmentAudioOption('stable').mainSections[0].items"), [[0, "  Audio actual literal  "]]);
  assert.deepEqual(h.json("equipmentServices.stable.extras"), override.extras);
  override.extras[0].items[0][0] = 999;
  override.extras[0].notes[0] = "No debe modificar el servicio";
  override.audioOptions.fresh.items[0][0] = 999;
  assert.equal(h.run("equipmentServices.stable.extras[0].items[0][0]"), 0);
  assert.equal(h.run("equipmentServices.stable.extras[0].notes[0]"), "Nota actual");
  assert.equal(h.run("equipmentServices.stable.audioOptions.fresh.items[0][0]"), 0);
  assert.equal(JSON.stringify(h.json("equipmentServices.stable")).includes("anterior"), false);
});

test("explicit empty audio and extras also clear a preceding imported source", () => {
  const h = harness();
  const first = freshOverride();
  first.audioOptions = { prior: { label: "Importacion anterior", items: [[5, "Audio importado anterior"]] } };
  first.extras = [{ id: "prior-extra", title: "Anterior importado", items: [[3, "Extra importado anterior"]] }];
  h.context.override = first;
  h.run("applyEquipmentCatalogServiceOverride('stable', override)");
  h.context.override = { ...freshOverride(), audioOptions: {}, extras: [] };
  h.run("applyEquipmentCatalogServiceOverride('stable', override)");
  assert.deepEqual(h.json("equipmentServices.stable.audioOptions"), {});
  assert.deepEqual(h.json("equipmentServices.stable.extras"), []);
});

test("non-authoritative editor updates preserve existing audio alternatives and extras", () => {
  const h = harness();
  const extrasBefore = h.json("equipmentServices.stable.extras");
  h.context.override = { name: "Nombre editado", mainSections: [{ title: "Edicion", items: [[0, "Equipo editado"]] }],
    audioOptions: { qsc: { label: "Variante editada", items: [[2, "Audio editado"]] } } };
  h.run("applyEquipmentCatalogServiceOverride('stable', override)");
  assert.deepEqual(h.json("equipmentServices.stable.audioOptions.qsc.items"), [[2, "Audio editado"]]);
  assert.deepEqual(h.json("equipmentServices.stable.audioOptions.other.items"), [[33, "Otro audio anterior"]]);
  assert.deepEqual(h.json("equipmentServices.stable.extras"), extrasBefore);
});
