const test = require("node:test");
const assert = require("node:assert/strict");
const picker = require("../equipment-name-picker.js");

function choices() {
  return [
    { id: "audio-32", warehouseInventoryId: "audio-32", name: "Consola Behringer X32", category: "Audio", itemType: "equipo" },
    { id: "audio-320", name: "Consola Behringer X320", category: "Audio", itemType: "equipo" },
    { id: "audio-32-compact", name: "Consola Behringer X32 Compact", category: "Audio", itemType: "equipo" },
    { id: "speaker-12-2", name: "Bocina QSC K12.2", category: "Audio", itemType: "equipo" },
    { id: "speaker-12-20", name: "Bocina QSC K12.20", category: "Audio", itemType: "equipo" },
    { id: "speaker-122", name: "Bocina QSC K122", category: "Audio", itemType: "equipo" },
    { id: "light", name: "Máquina de iluminación LED", category: "Iluminación", itemType: "equipo", aliases: ["Luz LED anterior"] },
    { id: "template-zero", name: "Equipo nuevo sin existencias", category: "Fuente actual", quantity: 0 }
  ];
}

test("Spanish accents, case and punctuation find exact current names without modifying records", () => {
  const records = choices();
  const original = JSON.stringify(records);
  const results = picker.filterChoices("MAQUINA, iluminacion -- led", records);
  assert.deepEqual(results.map((choice) => choice.id), ["light"]);
  assert.equal(results[0].name, "Máquina de iluminación LED");
  assert.equal(JSON.stringify(records), original);
});

test("complete model numbers exclude other numeric models while partial typing still suggests candidates", () => {
  const records = choices();
  assert.deepEqual(picker.filterChoices("Consola X32", records).map((choice) => choice.id), ["audio-32", "audio-32-compact"]);
  assert.deepEqual(picker.filterChoices("K12.2", records).map((choice) => choice.id), ["speaker-12-2"]);
  assert.deepEqual(picker.filterChoices("K122", records).map((choice) => choice.id), ["speaker-122"]);
  assert.equal(picker.filterChoices("SM58", [{ id: "mic-58", name: "Micrófono SM-58", category: "Audio" }])[0]?.id, "mic-58");
  assert.equal(picker.filterChoices("SM-58", [{ id: "mic-58", name: "Micrófono SM58", category: "Audio" }])[0]?.id, "mic-58");
  const partial = picker.filterChoices("X3", records).map((choice) => choice.id);
  assert.ok(partial.includes("audio-32"));
  assert.ok(partial.includes("audio-320"));
});

test("approved aliases and one-letter spelling differences only suggest the official current name", () => {
  const records = choices();
  assert.deepEqual(picker.filterChoices("Luz LED anterior", records).map((choice) => choice.name), ["Máquina de iluminación LED"]);
  assert.deepEqual(picker.filterChoices("Bocna K12.2", records).map((choice) => choice.name), ["Bocina QSC K12.2"]);
  assert.equal(records.find((choice) => choice.id === "speaker-12-2").name, "Bocina QSC K12.2");
});

test("same names in distinct current records stay separate and display category, type or record identity", () => {
  const records = [
    { id: "warehouse-a", warehouseInventoryId: "record-a", name: "Unidad", category: "Grupo A", itemType: "equipo" },
    { id: "warehouse-b", warehouseInventoryId: "record-b", name: "Unidad", category: "Grupo B", itemType: "equipo" },
    { id: "warehouse-consumable", warehouseInventoryId: "record-consumable", name: "Unidad", category: "Grupo A", itemType: "consumible" },
    { id: "warehouse-c", warehouseInventoryId: "record-c", name: "Unidad", category: "Grupo A", itemType: "equipo" }
  ];
  const results = picker.filterChoices("unidad", records);
  assert.equal(results.length, 4);
  assert.equal(new Set(results.map((choice) => choice.id)).size, 4);
  const html = picker.renderOptions(results);
  assert.match(html, /Grupo A · Equipo/);
  assert.match(html, /Grupo B · Equipo/);
  assert.match(html, /Grupo A · Consumible/);
  assert.match(html, /Registro record-a/);
  assert.match(html, /Registro record-c/);
  assert.equal(html.includes('aria-selected="true"'), false);
});

test("zero-stock source equipment remains selectable and duplicate IDs do not create extra suggestions", () => {
  const records = choices();
  records.push({ ...records[0] });
  assert.equal(picker.filterChoices("Consola X32", records).filter((choice) => choice.id === "audio-32").length, 1);
  const result = picker.filterChoices("Equipo nuevo", records);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "template-zero");
  assert.equal(result[0].quantity, 0);
});

test("popup names, categories and list IDs escape uploaded text and expose accessible selection state", () => {
  const html = picker.renderOptions([{ id: "record-safe", name: '<img src=x onerror="alert(1)">', category: 'Audio <script>alert(1)</script>', itemType: "equipo" }], { listId: 'list" onclick="x', activeIndex: 0 });
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.ok(html.includes('role="option" aria-selected="true"'));
  assert.ok(html.includes('id="list&quot; onclick=&quot;x-option-0"'));
});
