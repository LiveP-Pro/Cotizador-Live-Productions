const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const review = require("../warehouse-import-review.js");

const worksheets = ["INICIAL", "PERDIDO", 'Reparación & revisión "actual"'];
const file = { name: "inventario-actual-sintetico.xlsx", size: 2500, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

function fixture(options = {}) {
  const calls = [];
  const element = () => ({ textContent: "", innerHTML: "", value: "", dataset: {}, disabled: false, querySelector() { return null; } });
  const elements = {
    status: element(), importInput: element(), importSummary: element(), importBody: element(), importError: element(),
    importApplyButton: element(), importCancelButton: element(), importCloseButton: element(),
    importDialog: { open: false, showModal() { this.open = true; }, close() { this.open = false; } }
  };
  const state = { items: [{ id: "current-unit", name: "Consola X32", quantity: 10, category: "Audio" }], movements: [], updatedAt: "2026-10-13T12:00:00Z" };
  const sandbox = {
    console,
    window: { location: { protocol: "https:" }, WarehouseImportReview: review, requerimientoEquipoInventory: { categories: [] } },
    document: { readyState: "loading", addEventListener() {} },
    async fetch(url, request) {
      calls.push({ url, request });
      const worksheet = decodeURIComponent(request.headers["X-Inventory-Worksheet"] || "");
      if (options.respond) return options.respond(worksheet, calls.length);
      const items = worksheet === "INICIAL"
        ? [{ name: "Consola X32", quantity: 0, category: "Audio" }]
        : [{ name: "Consola X32 en archivo", quantity: worksheet === "PERDIDO" ? 2 : 8, category: "Audio" }];
      return { ok: true, async json() { return { source: file.name, items, warnings: [], worksheets, worksheet }; } };
    }
  };
  vm.createContext(sandbox);
  const source = fs.readFileSync(path.join(__dirname, "..", "inventory.js"), "utf8");
  const instrumented = source.replace('  if (document.readyState === "loading") {', `
    window.__worksheetReviewTest = {
      importBackup, changeImportWorksheet, closeImportReview, applyImportReview, renderImportReview,
      setup(nextState, nextElements) { state = nextState; Object.assign(elements, nextElements); },
      currentReview() { return importReview; }, currentState() { return state; }
    };
  if (document.readyState === "loading") {`);
  vm.runInContext(instrumented, sandbox, { filename: "inventory.js" });
  const api = sandbox.window.__worksheetReviewTest;
  api.setup(state, elements);
  return { api, elements, calls, state };
}

test("the current workbook exposes every worksheet with an escaped name and an explicit all-sheets option", async () => {
  const { api, elements, calls } = fixture();
  await api.importBackup(file);
  assert.equal(calls[0].request.headers["X-Inventory-Worksheet"], undefined);
  assert.equal(api.currentReview().worksheet, "");
  assert.match(elements.importBody.innerHTML, /id="warehouseImportWorksheetSelect"/);
  assert.match(elements.importBody.innerHTML, /value="" selected>Todas las hojas/);
  assert.match(elements.importBody.innerHTML, /Reparación &amp; revisión &quot;actual&quot;/);
  assert.equal(elements.importBody.innerHTML.includes('value="Reparación & revisión "actual""'), false);
  assert.match(elements.importBody.innerHTML, /evitar duplicarlos/);
});

test("switching the source sheet discards old decisions, uses current inventory and performs only read-only previews", async () => {
  const { api, calls, state } = fixture();
  await api.importBackup(file);
  const previous = api.currentReview();
  review.decide(previous.plan, 0, "keep-name", "current-unit");
  assert.ok(previous.plan.rows[0].decision);
  state.items[0].quantity = 12;
  const baseline = JSON.stringify(state);
  await api.changeImportWorksheet({ target: { id: "warehouseImportWorksheetSelect", value: "PERDIDO" } });
  const current = api.currentReview();
  assert.notEqual(current.plan, previous.plan);
  assert.equal(current.plan.rows[0].decision, null);
  assert.equal(current.plan.rows[0].item.quantity, 2);
  assert.equal(current.plan.rows[0].candidates[0].quantity, 12);
  assert.equal(JSON.parse(current.baseline).items[0].quantity, 12);
  assert.equal(current.file, file);
  assert.equal(current.worksheet, "PERDIDO");
  assert.equal(calls[1].request.headers["X-Inventory-Worksheet"], encodeURIComponent("PERDIDO"));
  assert.equal(calls[1].request.body, file);
  assert.deepEqual(calls.map((call) => call.request.method), ["POST", "POST"]);
  assert.equal(JSON.stringify(state), baseline);
  api.closeImportReview();
  assert.equal(api.currentReview(), null);
  assert.equal(JSON.stringify(state), baseline);
});

test("an uninterpretable sheet disables saving and preserves sheet selection for a read-only retry", async () => {
  const { api, elements, calls, state } = fixture({
    respond(worksheet) {
      const failed = worksheet === worksheets[2];
      return { ok: !failed, async json() {
        return failed ? { error: "La hoja tiene varias cantidades posibles." }
          : { source: file.name, items: [{ name: "Consola X32", quantity: 0, category: "Audio" }], warnings: [], worksheets, worksheet };
      } };
    }
  });
  const baseline = JSON.stringify(state);
  await api.importBackup(file);
  await api.changeImportWorksheet({ target: { id: "warehouseImportWorksheetSelect", value: worksheets[2] } });
  assert.equal(calls[1].request.headers["X-Inventory-Worksheet"], encodeURIComponent(worksheets[2]));
  assert.equal(api.currentReview().plan, null);
  assert.equal(elements.importApplyButton.disabled, true);
  assert.equal(elements.importDialog.open, true);
  assert.match(elements.importError.textContent, /varias cantidades/);
  await api.applyImportReview();
  assert.equal(calls.length, 2);
  await api.changeImportWorksheet({ target: { id: "warehouseImportWorksheetSelect", value: "INICIAL" } });
  assert.equal(api.currentReview().plan.rows[0].item.quantity, 0);
  assert.equal(api.currentReview().worksheet, "INICIAL");
  assert.equal(elements.importApplyButton.disabled, false);
  assert.deepEqual(calls.map((call) => call.request.method), ["POST", "POST", "POST"]);
  assert.equal(JSON.stringify(state), baseline);
});

test("a sheet cannot change while its existing import is being saved", async () => {
  const { api, calls } = fixture();
  await api.importBackup(file);
  const current = api.currentReview();
  current.busy = true;
  api.renderImportReview();
  await api.changeImportWorksheet({ target: { id: "warehouseImportWorksheetSelect", value: "INICIAL" } });
  assert.equal(calls.length, 1);
  assert.equal(api.currentReview(), current);
  assert.equal(current.worksheet, "");
});
