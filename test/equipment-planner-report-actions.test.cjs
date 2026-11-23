const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function harness(respond) {
  const requests = [], downloads = [], status = { textContent: "" };
  const context = vm.createContext({
    Blob, console, setTimeout() {},
    URL: { createObjectURL: () => "blob:synthetic-report", revokeObjectURL() {} },
    document: { querySelector: () => status, body: { append() {} },
      createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }) },
    fetch: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return respond(); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment-planner.js"), "utf8"), context);
  const planner = context.EquipmentPlanner.create({ events: () => [{ id: "unrelated-event" }], inventory: () => [],
    range: () => ({ from: "2026-11-05", to: "2026-11-08" }) });
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
