"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const ExcelJS = require("exceljs");

const root = path.resolve(__dirname, "..");
const endpoint = "/api/requerimientos-equipo/importar-eventos";
const fileType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const maxFileBytes = 15 * 1024 * 1024;

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function workbook() {
  const book = new ExcelJS.Workbook();
  for (const index of [1, 2]) {
    const sheet = book.addWorksheet(`Evento sintético ${index}`);
    for (const row of [["Fecha del evento:", "25/11/2026"], ["Lugar:", `Salón sintético ${index}`],
      ["Requiere montaje:", "No"], ["Hora del evento:", "18:00"],
      ["Fecha y hora de finalización:", "26/11/2026 00:30"], ["Regreso a bodega:", "26/11/2026 02:00"],
      ["AUDIO"], ["Cantidad", "Descripción"], [0, `Equipo en cero ${index}`], [2, `Equipo sintético ${index}`],
      ["Nota original: conservar esta observación"]]) sheet.addRow(row);
    sheet.getCell("B10").note = "Nota de celda original";
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
function form(bytes, name, selectedSheets) {
  const body = new FormData();
  body.append("file", new Blob([bytes], { type: fileType }), name);
  if (selectedSheets !== undefined) body.append("selectedSheets", JSON.stringify(selectedSheets));
  return body;
}
function digitalPdf() {
  const cells = [[50, 780, "Lugar: Salon PDF sintetico"], [50, 755, "Fecha: 25/11/2026"],
    [50, 720, "Cantidad"], [180, 720, "Descripcion"], [50, 690, "0"], [180, 690, "Equipo PDF en cero"],
    [50, 660, "3"], [180, 660, "Equipo PDF segundo"]];
  const operations = cells.map(([x, y, value]) => `BT /F1 12 Tf ${x} ${y} Td (${value}) Tj ET`).join("\n");
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>",
    `<< /Length ${Buffer.byteLength(operations)} >>\nstream\n${operations}\nendstream`];
  const chunks = [Buffer.from("%PDF-1.4\n")], offsets = [];
  let size = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(size);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`); chunks.push(chunk); size += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
async function result(response) {
  assert.match(response.headers.get("content-type") || "", /^application\/json/);
  return { status: response.status, body: await response.json() };
}
function chunked(origin, body, contentType, cookie) {
  return new Promise((resolve, reject) => {
    const request = http.request(new URL(endpoint, origin), { method: "POST", headers: { "Content-Type": contentType, cookie, Connection: "close" } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString("utf8")) }); }
        catch (error) { reject(error); }
      });
    });
    request.on("error", reject);
    // A real chunked body has no Content-Length and splits inside the envelope.
    for (let offset = 0; offset < body.length; offset += 997) request.write(body.subarray(offset, offset + 997));
    request.end();
  });
}

test("the production platform accepts bounded native multipart event files and preserves raw compatibility", { timeout: 60000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "event-multipart-http-"));
  const ports = new Set();
  while (ports.size < 3) ports.add(await freePort());
  const [externalPort, livePort, luxuryPort] = [...ports];
  const origin = `http://127.0.0.1:${externalPort}`, password = crypto.randomBytes(24).toString("hex");
  const initial = path.join(directory, "inventario-bodega-inicial.json");
  fs.writeFileSync(initial, JSON.stringify({ state: { items: [{ id: "synthetic-multipart-stock", name: "Equipo sintético", category: "Prueba", quantity: 0 }], movements: [] } }));
  const child = spawn(process.execPath, ["--no-warnings", "platform-server.js"], { cwd: root,
    env: { ...process.env, NODE_ENV: "production", HOST: "127.0.0.1", PORT: String(externalPort), LIVE_INTERNAL_PORT: String(livePort), LUXURY_INTERNAL_PORT: String(luxuryPort),
      COTIZADOR_DATA_DIR: directory, EQUIPMENT_PDF_DIR: path.join(directory, "reports"), WAREHOUSE_INITIAL_STATE_PATH: initial,
      COTIZADOR_ADMIN_USER: "SyntheticMultipartQA", COTIZADOR_ADMIN_PASSWORD: password, COTIZADOR_SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
      COOKIE_SECURE: "false", DISABLE_PDF_WARMUP: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; }); child.stderr.on("data", (chunk) => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = new Promise((resolve) => child.once("exit", resolve)); child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
      try { await ended; } finally { clearTimeout(timer); }
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });
  let ready = false;
  for (let index = 0; index < 150; index++) {
    if (child.exitCode !== null) throw new Error(`Synthetic platform exited: ${output}`);
    try { const response = await fetch(origin + "/api/sesion", { headers: { Connection: "close" } }); if (response.ok) { await response.arrayBuffer(); ready = true; break; } }
    catch { /* Wait for the production child to start. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  const login = await fetch(origin + "/api/login", { method: "POST", headers: { "Content-Type": "application/json", Connection: "close" }, body: JSON.stringify({ username: "SyntheticMultipartQA", password }) });
  assert.equal(login.status, 200); const cookie = login.headers.get("set-cookie").split(";")[0]; await login.arrayBuffer();
  const upload = (body, headers = {}) => fetch(origin + endpoint, { method: "POST", headers: { cookie, ...headers }, body }).then(result);
  const bytes = await workbook(), name = "Eventos miércoles y sábado.xlsx";
  const before = fs.readFileSync(path.join(directory, "inventario-bodega.json"));

  await t.test("raw and multipart retain identical UTF-8 names, schedules, notes, zeroes and every source cell", async () => {
    const raw = await upload(bytes, { "X-File-Name": encodeURIComponent(name), "Content-Type": fileType });
    const multipart = await upload(form(bytes, name));
    assert.equal(raw.status, 200); assert.equal(multipart.status, 200);
    assert.deepEqual(multipart.body, raw.body);
    assert.equal(multipart.body.events.length, 2); assert.equal(multipart.body.itemCount, 4); assert.equal(multipart.body.zeroCount, 2);
    assert.equal(multipart.body.verification.complete, true);
    assert.equal(multipart.body.source.fileName, name);
    for (const event of multipart.body.events) {
      assert.equal(event.setupApplies, false); assert.equal(event.startAt, "2026-11-25T18:00");
      assert.equal(event.endAt, "2026-11-26T00:30"); assert.equal(event.equipmentInAt, "2026-11-26T02:00");
    }
    assert.ok(multipart.body.sourceCells.some((cell) => JSON.stringify(cell.note || "").includes("Nota de celda original")));
  });
  await t.test("selected sheets work with standard multipart fields and raw compatibility headers", async () => {
    const selected = ["Evento sintético 2"];
    const multipart = await upload(form(bytes, name, selected));
    const raw = await upload(bytes, { "X-File-Name": encodeURIComponent(name), "Content-Type": fileType, "X-Event-Sheets": encodeURIComponent(JSON.stringify(selected)) });
    assert.equal(multipart.status, 200); assert.deepEqual(multipart.body, raw.body); assert.equal(multipart.body.events.length, 1);
  });
  await t.test("chunked multipart preserves binary file bytes without a content length", async () => {
    const request = new Request(origin + endpoint, { method: "POST", body: form(bytes, name) });
    const uploaded = await chunked(origin, Buffer.from(await request.arrayBuffer()), request.headers.get("content-type"), cookie);
    assert.equal(uploaded.status, 200); assert.equal(uploaded.body.source.fileName, name); assert.equal(uploaded.body.events.length, 2);
    assert.equal(uploaded.body.verification.complete, true);
  });
  await t.test("a digital source PDF remains supported through the same native file field", async () => {
    const body = new FormData(); body.append("file", new Blob([digitalPdf()], { type: "application/pdf" }), "Evento revisión.pdf");
    const uploaded = await upload(body);
    assert.equal(uploaded.status, 200); assert.equal(uploaded.body.events.length, 1);
    assert.equal(uploaded.body.itemCount, 2); assert.equal(uploaded.body.zeroCount, 1);
    assert.equal(uploaded.body.source.fileName, "Evento revisión.pdf");
    assert.equal(uploaded.body.events[0].date, "2026-11-25"); assert.equal(uploaded.body.verification.complete, true);
  });
  await t.test("malformed, missing, repeated or invalid file fields return actionable JSON errors", async () => {
    const invalid = [];
    invalid.push({ body: "incomplete", headers: { "Content-Type": "multipart/form-data" } });
    invalid.push({ body: "--synthetic-boundary\r\nContent-Disposition: form-data; name=\"file\"; filename=\"bad.xlsx\"\r\n\r\ntruncated", headers: { "Content-Type": "multipart/form-data; boundary=synthetic-boundary" } });
    const missing = new FormData(); missing.append("note", "No file"); invalid.push({ body: missing });
    const text = new FormData(); text.append("file", "not a file"); invalid.push({ body: text });
    const multiple = form(bytes, name); multiple.append("file", new Blob([bytes]), "second.xlsx"); invalid.push({ body: multiple });
    const wrong = new FormData(); wrong.append("another", new Blob([bytes]), name); invalid.push({ body: wrong });
    const empty = form(Buffer.alloc(0), name); invalid.push({ body: empty });
    invalid.push({ body: form(bytes, "unsupported.exe") });
    const badSelection = form(bytes, name); badSelection.append("selectedSheets", "bad json"); invalid.push({ body: badSelection });
    for (const entry of invalid) { const received = await upload(entry.body, entry.headers); assert.equal(received.status, 400); assert.equal(typeof received.body.error, "string"); }
  });
  await t.test("file and envelope limits are enforced before parsing oversized input", async () => {
    const tooLarge = await upload(form(Buffer.alloc(maxFileBytes + 1), "oversized.xlsx"));
    assert.equal(tooLarge.status, 413); assert.match(tooLarge.body.error, /15 MB/);
    const envelope = form(bytes, name); envelope.append("selectedSheets", "x".repeat(maxFileBytes + 64 * 1024));
    const received = await upload(envelope); assert.equal(received.status, 413);
    const raw = await upload(Buffer.alloc(maxFileBytes + 1), { "Content-Type": fileType, "X-File-Name": name }); assert.equal(raw.status, 413);
  });
  await t.test("authentication remains required and previews never modify inventory", async () => {
    const response = await fetch(origin + endpoint, { method: "POST", headers: { Connection: "close" }, body: form(bytes, name) });
    const received = await result(response); assert.equal(received.status, 401); assert.match(received.body.error, /sesión/);
    assert.deepEqual(fs.readFileSync(path.join(directory, "inventario-bodega.json")), before);
  });
});
