const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("../equipment-service-import.js");

function sourcePreview() {
  return {
    importToken: "current-upload-token",
    source: { fileName: "Servicios actuales.xlsx", format: "xlsx" },
    services: [{
      name: "Servicio del archivo",
      mainSections: [{
        title: "AUDIO",
        items: [[0, "Bocina <modelo>"]],
        notes: ["Conservar observación"],
        rows: [
          { type: "header", quantity: null, description: "Cantidad / Descripción", cells: [] },
          { type: "item", quantity: 0, description: "Bocina <modelo>", cells: [] },
          { type: "note", quantity: null, description: "Conservar observación", cells: [] }
        ]
      }]
    }],
    sourceCells: [
      { ref: "Cuadro!A1", value: "Servicio del archivo" },
      { ref: "Cuadro!A4", value: 0 },
      { ref: "Cuadro!B4", value: "Bocina <modelo>" },
      { ref: "Cuadro!B5", value: "Conservar observación" }
    ],
    warnings: [],
    verification: { complete: true, sourceCellCount: 4, representedCellCount: 4, missingRefs: [] }
  };
}

const groups = [{ id: "audio", label: "AUDIO" }, { id: "iluminacion", label: "Iluminación" }];

test("ningún servicio se guarda sin elegir explícitamente su categoría", () => {
  const preview = sourcePreview();
  const selections = ui.draftFor(preview);
  assert.equal(selections[0].category, "");
  assert.match(ui.selectionError(preview, selections, groups), /elija una categoría/i);
  assert.throws(() => ui.createPayload(preview, selections, groups, "current-base"));
});

test("una fuente con celdas faltantes impide guardar aun con categorías válidas", () => {
  const preview = sourcePreview();
  preview.verification = { complete: false, sourceCellCount: 4, representedCellCount: 3, missingRefs: ["Cuadro!B5"] };
  const selections = [{ name: preview.services[0].name, category: "audio", newCategory: "" }];
  assert.match(ui.selectionError(preview, selections, groups), /todo el contenido/i);
  assert.throws(() => ui.createPayload(preview, selections, groups, "current-base"), /todo el contenido/i);
});

test("guardar envía solamente las decisiones vinculadas al archivo verificado", () => {
  const preview = sourcePreview();
  const original = JSON.stringify(preview);
  const payload = ui.createPayload(preview, [{ name: "  Servicio revisado  ", category: "audio", newCategory: "" }], groups, "current-base");
  assert.deepEqual(payload, {
    baseCatalogVersion: "current-base",
    importToken: "current-upload-token",
    services: [{ index: 0, name: "Servicio revisado", groupId: "audio" }]
  });
  assert.equal(JSON.stringify(preview), original);
  assert.equal(preview.services[0].mainSections[0].items[0][0], 0);
});

test("crear una categoría exige nombre y detecta categorías existentes con acentos", () => {
  const preview = sourcePreview();
  const selection = { name: "Servicio", category: ui.NEW_CATEGORY, newCategory: "" };
  assert.match(ui.selectionError(preview, [selection], groups), /nombre de la nueva categoría/i);
  selection.newCategory = "ILUMINACION";
  assert.match(ui.selectionError(preview, [selection], groups), /ya existe/i);
  selection.newCategory = "  Servicio especial  ";
  assert.deepEqual(ui.createPayload(preview, [selection], groups, "current-base").services, [{ index: 0, name: "Servicio", groupLabel: "Servicio especial" }]);
});

test("la revisión conserva cero, encabezados, notas y todas las celdas sin ejecutar HTML", () => {
  const preview = sourcePreview();
  preview.sourceCells.push({ ref: "Cuadro!B6", value: '<img src=x onerror="alert(1)">' });
  const html = ui.renderPreview(preview, ui.draftFor(preview), groups);
  assert.match(html, /class="equipment-service-import-quantity">0<\/td>/);
  assert.match(html, /data-import-row-type="header"/);
  assert.match(html, /data-import-row-type="note"/);
  assert.match(html, /Conservar observación/);
  for (const cell of preview.sourceCells) assert.ok(html.includes(cell.ref));
  assert.ok(html.includes("Bocina &lt;modelo&gt;"));
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  assert.equal(html.includes('<img src=x'), false);
});

test("la revisión avisa cuándo el libro actual reemplaza sus servicios anteriores", () => {
  const preview = sourcePreview();
  preview.replaces = { count: 2, serviceNames: ["Servicio anterior A", "Servicio anterior B"] };
  const html = ui.renderPreview(preview, ui.draftFor(preview), groups);
  assert.match(html, /reemplazará los servicios importados anteriormente/);
  assert.match(html, /Servicio anterior A/);
  assert.match(html, /Servicio anterior B/);
});
