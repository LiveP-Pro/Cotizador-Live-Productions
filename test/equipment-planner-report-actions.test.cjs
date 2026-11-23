const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness(respond, options = {}) {
  const requests = [], downloads = [], status = { textContent: "" };
  const context = vm.createContext({
    Blob, console, setTimeout() {},
    URL: { createObjectURL: () => "blob:synthetic-report", revokeObjectURL() {} },
    document: { querySelector: () => status, body: { append() {} },
      createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }) },
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return respond(); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment-planner.js"), "utf8"), context);
  if (options.window) context.window = options.window;
  const planner = context.EquipmentPlanner.create({ events: () => [{ id: "unrelated-event" }], inventory: () => [],
    range: () => ({ from: "2026-11-05", to: "2026-11-08" }), transferOptions: () => options.transferOptions || {} });
  return { planner, requests, downloads, status };
}

test("failed file report download returns a retryable error and the retry uses only selected source events", async () => {
  let attempt = 0;
  const h = harness(() => ++attempt === 1
    ? { ok: false, json: async () => ({ error: "Fallo de descarga sintetico" }) }
    : { ok: true, blob: async () => new Blob(["synthetic report"]), headers: { get: () => 'attachment; filename="Renta-sintetica.pdf"' } });
  const selected = [{ id: "current-file-event", sections: [{ items: [{ quantity: 0, description: "Linea cero sintetica" }] }] }];
  const button = { disabled: false };
  const failure = await h.planner.download("rent", button, selected);
  assert.equal(failure.ok, false);
  assert.match(failure.message, /Fallo de descarga/);
  assert.equal(button.disabled, false);
  assert.equal(h.downloads.length, 0);
  const success = await h.planner.download("rent", button, selected);
  assert.equal(success.ok, true);
  assert.deepEqual(h.downloads, ["Renta-sintetica.pdf"]);
  assert.deepEqual(h.requests.map(r => r.body.events), [selected, selected]);
  assert.ok(h.requests.every(r => r.body.from === "2026-11-05" && r.body.to === "2026-11-08"));
});

test("a second report request cannot report success while the first download is pending", async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const first = h.planner.download("purchase");
  const second = await h.planner.download("purchase");
  assert.equal(second.ok, false);
  assert.equal(h.requests.length, 1);
  finish({ ok: false, json: async () => ({ error: "Servicio temporalmente ocupado" }) });
  assert.equal((await first).ok, false);
});

test("transfer reports include current route estimates and retry the same selected draft events", async () => {
  let attempt = 0;
  const routeEstimates = [{ fromEventId: "source", toEventId: "destination", travelMinutes: 35, handlingMinutes: 20, reviewed: true }];
  const h = harness(() => ++attempt === 1
    ? { ok: false, json: async () => ({ error: "Fallo de trasiego sintético" }) }
    : { ok: true, blob: async () => new Blob(["synthetic transfer"]), headers: { get: () => 'attachment; filename="Trasiego-PROVISIONAL.pdf"' } }, { transferOptions: { routeEstimates } });
  const selected = [{ id: "current-draft", sections: [{ items: [{ quantity: 0, description: "Línea original en cero" }] }] }], original = JSON.stringify(selected), button = { disabled: false };
  assert.equal((await h.planner.download("transfer", button, selected)).ok, false);
  assert.equal(button.disabled, false);
  assert.equal((await h.planner.download("transfer", button, selected)).ok, true);
  assert.deepEqual(h.downloads, ["Trasiego-PROVISIONAL.pdf"]);
  assert.ok(h.requests.every(request => request.url === "/api/cuadros-equipo/reportes/provisional" && request.body.mode === "transfer"));
  assert.deepEqual(h.requests.map(request => request.body.events), [selected, selected]);
  assert.deepEqual(h.requests.map(request => request.body.routeEstimates), [routeEstimates, routeEstimates]);
  assert.equal(JSON.stringify(selected), original);
});

test("concurrent transfer downloads are locked until completion and permission denial sends nothing", async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; })), button = { disabled: false };
  const pending = h.planner.download("transfer", button);
  assert.equal(button.disabled, true);
  assert.equal((await h.planner.download("transfer")).ok, false); assert.equal(h.requests.length, 1);
  finish({ ok: true, blob: async () => new Blob(["synthetic transfer"]), headers: { get: () => 'attachment; filename="Trasiego.pdf"' } });
  assert.equal((await pending).ok, true); assert.equal(button.disabled, false);
  const denied = harness(() => { throw new Error("Permission denial must occur before fetch"); }, { window: { LiveAccess: { can: () => false } } });
  const result = await denied.planner.download("transfer");
  assert.equal(result.ok, false); assert.match(result.message, /permiso/);
  assert.equal(denied.requests.length, 0); assert.equal(denied.downloads.length, 0);
});

test("route estimates are not added to rent or purchase report payloads", async () => {
  const h = harness(() => ({ ok: true, blob: async () => new Blob(["synthetic report"]), headers: { get: () => 'attachment; filename="Reporte.pdf"' } }), { transferOptions: { routeEstimates: [{ travelMinutes: 99 }] } });
  assert.equal((await h.planner.download("rent")).ok, true); assert.equal((await h.planner.download("purchase")).ok, true);
  assert.ok(h.requests.every(request => !Object.hasOwn(request.body, "routeEstimates")));
});
