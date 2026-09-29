const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const initial = JSON.parse(fs.readFileSync(path.join(root, "inventory-initial-state.json"), "utf8"));

function loadCatalog() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(
    fs.readFileSync(path.join(root, "equipment-inventory.js"), "utf8"),
    context,
    { filename: "equipment-inventory.js" }
  );
  return JSON.parse(JSON.stringify(context.window.requerimientoEquipoInventory));
}

test("public inventory assets contain no warehouse catalog data", () => {
  const catalog = loadCatalog();
  assert.equal(catalog.datasetId, "");
  assert.deepEqual(catalog.categories, []);
  assert.equal(catalog.sourceItemCount, 0);
  assert.equal(catalog.consumableItemCount, 0);
});

test("bundled fallback is an archived placeholder only", () => {
  assert.equal(initial.state.datasetId, "");
  assert.equal(initial.state.source, "Inventario privado del servidor");
  assert.equal(initial.state.items.length, 1);
  assert.equal(initial.state.items[0].archived, true);
  assert.equal(initial.state.items[0].quantity, 0);
  assert.deepEqual(initial.state.movements, []);
});

test("private inventory identifiers are not embedded in public assets", () => {
  const publicSource = [
    fs.readFileSync(path.join(root, "equipment-inventory.js"), "utf8"),
    fs.readFileSync(path.join(root, "inventory-initial-state.json"), "utf8")
  ].join("\n");
  assert.doesNotMatch(publicSource, /docs\.google\.com|spreadsheets\/d\//i);
  assert.doesNotMatch(publicSource, /sourceSpreadsheetId|spreadsheetId/i);
});
