const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function htmlAssets(html) {
  const assets = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    if (/^<link\b/i.test(tag) && !/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const match = tag.match(/\s(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (!match || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(match[1])) continue;
    const filename = match[1].split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\//, "");
    if (/^[^/]+\.(?:js|css)$/i.test(filename)) assets.add(filename);
  }
  return [...assets].sort();
}

function rootCopies(dockerfile) {
  const copies = new Set();
  const instructions = dockerfile.replace(/\\\r?\n/g, " ").split(/\r?\n/);
  for (const instruction of instructions) {
    const match = instruction.match(/^\s*COPY\s+(.+)$/i);
    if (!match) continue;
    const argumentsText = match[1].replace(/^(?:--\S+\s+)+/, "").trim();
    const entries = argumentsText.startsWith("[") ? JSON.parse(argumentsText) : argumentsText.split(/\s+/);
    if (![".", "./", "/app", "/app/"].includes(entries.pop())) continue;
    entries.forEach(source => copies.add(source.replace(/^\.\//, "")));
  }
  return copies;
}

test("every root script and stylesheet referenced by the shipped page is copied into the Docker image", () => {
  const assets = htmlAssets(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const copies = rootCopies(dockerfile);
  assert.ok(assets.length > 0, "No page assets were checked");
  assert.deepEqual(assets.filter(asset => !fs.existsSync(path.join(root, asset))), [], "Page assets must exist locally");
  assert.deepEqual(assets.filter(asset => !copies.has(asset)), [], "Page assets must be included in Docker COPY sources targeting /app");

  // Reproduce the packaging omission that made autocomplete return 404 after deployment.
  const omitted = rootCopies(dockerfile.replace(/\bequipment-name-picker\.(?:js|css)\s*/g, ""));
  assert.deepEqual(assets.filter(asset => !omitted.has(asset)), ["equipment-name-picker.css", "equipment-name-picker.js"]);
});

function staticHandler(directory) {
  const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const start = serverSource.indexOf("function serveStatic(");
  const end = serverSource.indexOf("\nasync function handleRequest(", start);
  assert.ok(start >= 0 && end > start, "The shipped static handler must be available");
  const context = {
    fs, path, Buffer, rootDir: directory,
    pdfDir: path.join(directory, "cotizaciones-generadas"),
    equipmentPdfDir: path.join(directory, "cuadros-equipo"),
    warehouseAssetVersion: "deployment-test",
    mimeTypes: { ".js": "text/javascript", ".css": "text/css" },
    errorResponse(response, status, message) {
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: message }));
    },
    requireAuth(request, response) {
      context.errorResponse(response, 401, "Authentication required");
      return false;
    }
  };
  vm.runInNewContext(serverSource.slice(start, end), context, { filename: "server-static-handler.js" });
  return pathname => new Promise((resolve, reject) => {
    const result = {};
    const response = {
      writeHead(status, headers) { Object.assign(result, { status, headers }); },
      end(body) { resolve({ ...result, body: String(body || "") }); }
    };
    try { context.serveStatic({}, response, pathname); } catch (error) { reject(error); }
  });
}

test("the shipped static handler serves every page script and stylesheet without exposing private files", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "live-deployment-assets-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const assets = htmlAssets(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  assert.ok(assets.length > 0, "No page assets were checked");
  const privateFiles = [
    "cotizador-auth.json", "usuarios-live.json", "inventory-initial-state.json",
    "live-users.cjs", "live-users.js", "live-users.css", "scripts/live-users-admin.cjs",
    "live-warehouse-access.cjs", "server.js", "platform-server.js",
    "luxury/lib/live-auth.cjs", "data/cotizador-auth.json", "data/usuarios-live.json",
    ".equipment-private/usuarios-live.json", "assets/cotizador-auth.json"
  ];
  const privateContent = "synthetic private fixture that must never be served";
  for (const filename of [...assets, ...privateFiles]) {
    const target = path.join(directory, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, privateFiles.includes(filename) ? privateContent : `asset:${filename}`);
  }
  const request = staticHandler(directory);
  for (const filename of assets) {
    const response = await request(`/${filename}`);
    assert.equal(response.status, 200, `${filename} must be publicly available`);
    assert.equal(response.body, `asset:${filename}`, `${filename} must return the actual file`);
  }
  for (const filename of [...privateFiles, "cotizador-auth%2Ejson", "usuarios-live%2Ejson"]) {
    const response = await request(`/${filename}`);
    assert.equal(response.status, 404, `${filename} must stay private even when it exists`);
    assert.ok(!response.body.includes(privateContent), `${filename} must not leak file contents`);
  }
});
