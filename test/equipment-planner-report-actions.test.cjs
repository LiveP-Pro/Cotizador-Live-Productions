const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const markup = '<!doctype html><html><head><title>Reporte sintético</title></head><body><h1>Reporte actual</h1><p>0 unidades sin uso</p></body></html>';
const htmlResponse = (html = markup, overrides = {}) => ({ ok: true, status: 200, text: async () => html,
  headers: { get: name => ({ "Content-Type": "text/html; charset=utf-8", "X-Equipment-Report-Status": "provisional" })[name] || null }, ...overrides });
const errorResponse = (status, detail = "") => ({ ok: false, status, json: async () => detail ? { error: detail } : Promise.reject(new SyntaxError("Non-JSON gateway response")) });

function harness(respond, options = {}) {
  const requests = [], downloads = [], status = { textContent: "" }, opens = [], contents = [], failures = [];
  let ticket = 0, opened = false, retry = null, eventReads = 0;
  const viewer = {
    open(settings) { ticket++; opened = true; retry = settings.onRetry; opens.push(settings.title); return ticket; },
    setContent(html, token) { if (!opened || token !== ticket) return false; contents.push(html); return true; },
    fail(message, token = ticket) { if (opened && token === ticket) failures.push(message); },
    isOpen() { return opened; }, close() { opened = false; ticket++; }, retry() { return retry?.(); }
  };
  const context = vm.createContext({
    Blob, console, setTimeout() {},
    URL: { createObjectURL: () => "blob:synthetic-report", revokeObjectURL() {} },
    document: { querySelector: () => status, body: { append() {} },
      createElement: () => ({ click() { downloads.push(this.download); }, remove() {} }) },
    fetch: async (url, init) => { requests.push({ url, body: JSON.parse(init.body), credentials: init.credentials }); return respond(); }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment-planner.js"), "utf8"), context);
  if (options.window) context.window = options.window;
  const planner = context.EquipmentPlanner.create({ events: () => { eventReads++; return [{ id: "unrelated-event" }]; }, inventory: () => [],
    range: () => options.range || { from: "2026-11-05", to: "2026-11-08" }, transferOptions: () => options.transferOptions || {}, reportViewer: viewer });
  return { planner, requests, downloads, status, viewer, opens, contents, failures, eventReads: () => eventReads };
}

test("the three reports open printable views with one click and do not download HTML as PDF", async () => {
  const h = harness(() => htmlResponse());
  for (const mode of ["transfer", "rent", "purchase"]) {
    const result = await h.planner.download(mode);
    assert.equal(result.ok, true); assert.equal(result.reportOpened, true);
  }
  assert.deepEqual(h.opens, ["Trasiegos seleccionados", "Reporte de renta", "Reporte de compra"]);
  assert.deepEqual(h.requests.map(request => request.body.format), ["html", "html", "html"]);
  assert.ok(h.requests.every(request => request.credentials === "same-origin"));
  assert.deepEqual(h.contents, [markup, markup, markup]); assert.deepEqual(h.downloads, []);
});

test("a failed report retries the same source events, range and route estimates without reading another event set", async () => {
  let attempt = 0;
  const range = { from: "2026-11-05", to: "2026-11-08" };
  const routeEstimates = [{ fromPlace: "Origen", toPlace: "Destino", travelMinutes: 35, handlingMinutes: 20 }];
  const h = harness(() => ++attempt === 1 ? errorResponse(503, "Fallo temporal de reporte") : htmlResponse(), { range, transferOptions: { routeEstimates } });
  const selected = [{ id: "current-file-event", sections: [{ items: [{ quantity: 0, description: "Línea original en cero" }] }] }];
  const original = JSON.parse(JSON.stringify(selected)), button = { disabled: false };
  const failure = await h.planner.download("rent", button, selected);
  assert.equal(failure.ok, false); assert.match(failure.message, /Fallo temporal.*HTTP 503/); assert.equal(button.disabled, false);
  selected[0].sections[0].items[0].quantity = 999; range.from = "2027-01-01"; routeEstimates[0].travelMinutes = 999;
  const success = await h.viewer.retry();
  assert.equal(success.ok, true); assert.equal(success.reportOpened, true); assert.equal(button.disabled, false);
  assert.equal(h.eventReads(), 0); assert.deepEqual(h.requests.map(request => request.body.events), [original, original]);
  assert.ok(h.requests.every(request => request.body.from === "2026-11-05" && request.body.to === "2026-11-08" && request.body.routeEstimates[0].travelMinutes === 35));
  assert.equal(h.contents.length, 1); assert.equal(h.downloads.length, 0);
});

test("concurrent clicks send only one request and closing during a request never reopens the viewer", async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; })), button = { disabled: false };
  const first = h.planner.download("purchase", button);
  assert.equal(h.opens.length, 1); assert.equal(h.requests.length, 1); assert.equal(button.disabled, true);
  assert.equal((await h.planner.download("transfer")).ok, false); assert.equal(h.requests.length, 1);
  h.viewer.close(); finish(htmlResponse());
  const result = await first;
  assert.equal(result.ok, true); assert.equal(result.reportClosed, true); assert.equal(result.reportOpened, false);
  assert.equal(h.contents.length, 0); assert.equal(h.opens.length, 1); assert.equal(button.disabled, false);
});

test("all report formats receive the same selection context while consumable accounting stays in the common engine", async () => {
  const routeEstimates = [{ fromPlace: "A", toPlace: "B", travelMinutes: 15, handlingMinutes: 10 }];
  const h = harness(() => htmlResponse(), { transferOptions: { routeEstimates } });
  for (const mode of ["transfer", "rent", "purchase"]) assert.equal((await h.planner.download(mode)).ok, true);
  assert.deepEqual(h.requests[0].body.routeEstimates, routeEstimates);
  assert.deepEqual(h.requests[1].body.routeEstimates, routeEstimates);
  assert.deepEqual(h.requests[2].body.routeEstimates, routeEstimates);
  assert.ok(h.requests.every(request=>Array.isArray(request.body.selectedTransferIds)&&request.body.selectedTransferIds.length===0));
});

test("permission denial before a report or retry sends no request and never opens a new view", async () => {
  let allowed = true;
  const h = harness(() => errorResponse(502), { window: { LIVE_SESSION: {}, LiveAccess: { can: () => allowed } } });
  assert.equal((await h.planner.download("purchase")).ok, false); assert.equal(h.requests.length, 1);
  allowed = false; assert.equal((await h.viewer.retry()).ok, false);
  assert.equal(h.requests.length, 1); assert.equal(h.opens.length, 1); assert.match(h.failures.at(-1), /permiso/);
  for (const mode of ["transfer", "rent", "purchase"]) assert.equal((await h.planner.download(mode)).ok, false);
  assert.equal(h.requests.length, 1); assert.equal(h.opens.length, 1);
});

test("permission revocation during a response prevents showing its contents", async () => {
  let allowed = true, finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }), { window: { LiveAccess: { can: () => allowed } } });
  const pending = h.planner.download("transfer"); allowed = false; finish(htmlResponse());
  assert.equal((await pending).ok, false); assert.equal(h.contents.length, 0); assert.match(h.failures[0], /permiso/);
});

test("gateway and authentication failures show useful HTTP codes without copying raw HTML", async () => {
  for (const code of [401, 403, 413, 429, 502, 503, 504]) {
    const h = harness(() => errorResponse(code));
    const result = await h.planner.download("transfer");
    assert.equal(result.ok, false); assert.match(result.message, new RegExp(`HTTP ${code}`));
    assert.ok(result.message.length > 30); assert.equal(h.contents.length, 0); assert.equal(h.downloads.length, 0);
    assert.equal(h.viewer.isOpen(), true); assert.equal(h.failures.length, 1);
  }
});

test("HTML views require the report content type and server report marker, and reject empty bodies", async () => {
  for (const response of [htmlResponse("", {}), htmlResponse(markup, { headers: { get: name => name === "Content-Type" ? "application/pdf" : "provisional" } }), htmlResponse(markup, { headers: { get: name => name === "Content-Type" ? "text/html" : null } })]) {
    const h = harness(() => response), result = await h.planner.download("rent");
    assert.equal(result.ok, false); assert.equal(h.contents.length, 0); assert.equal(h.downloads.length, 0);
  }
});

test("master and summary keep binary downloads, while an HTML response can never be saved as a PDF", async () => {
  const binary = (type, body, name) => ({ ok: true, status: 200, blob: async () => new Blob([body]), headers: { get: header => header === "Content-Type" ? type : header === "Content-Disposition" ? `attachment; filename="${name}"` : null } });
  let response = binary("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "PKsynthetic", "Master.xlsx");
  const h = harness(() => response);
  assert.equal((await h.planner.download("master")).ok, true);
  response = binary("application/pdf", "%PDF-synthetic", "Resumen.pdf");
  assert.equal((await h.planner.download("summary")).ok, true);
  response = binary("text/html", "<html>Error</html>", "Resumen.pdf");
  assert.equal((await h.planner.download("summary")).ok, false);
  response = binary("application/pdf", "<html>Error</html>", "Resumen.pdf");
  assert.equal((await h.planner.download("summary")).ok, false);
  assert.deepEqual(h.downloads, ["Master.xlsx", "Resumen.pdf"]); assert.equal(h.opens.length, 0);
  assert.ok(h.requests.every(request => !Object.hasOwn(request.body, "format")));
});
