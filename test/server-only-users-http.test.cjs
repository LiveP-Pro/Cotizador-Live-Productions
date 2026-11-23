"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { pathToFileURL } = require("node:url");
const { createLiveUserStore, hashPassword, ALL_PERMISSION_IDS } = require("../live-users.cjs");

const root = path.resolve(__dirname, "..");
const password = "Synthetic-http-123";

function request(origin, pathname, { method = "GET", cookie = "", body } = {}) {
  return new Promise((resolve, reject) => {
    const encoded = body === undefined ? null : JSON.stringify(body);
    const req = http.request(new URL(pathname, origin), {
      method,
      headers: { ...(cookie ? { cookie } : {}), ...(encoded ? {
        "content-type": "application/json", "content-length": Buffer.byteLength(encoded)
      } : {}) }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try { json = JSON.parse(text); } catch { /* HEAD and static files are not JSON. */ }
        resolve({ status: response.statusCode, body: json, text, headers: response.headers,
          cookie: response.headers["set-cookie"]?.[0]?.split(";")[0] || "" });
      });
      response.on("error", reject);
    });
    req.on("error", reject);
    if (encoded) req.write(encoded);
    req.end();
  });
}

async function startRoot(directory) {
  // Use an actual ephemeral listening port without editing the shipped server.
  const launcher = `
    const http = require("node:http");
    const original = http.createServer;
    http.createServer = (...args) => {
      const server = original(...args);
      server.on("listening", () => process.send({ port: server.address().port }));
      return server;
    };
    require(${JSON.stringify(path.join(root, "server.js"))});
  `;
  const child = spawn(process.execPath, ["--no-warnings", "-e", launcher], {
    cwd: root,
    env: {
      PATH: process.env.PATH, NODE_ENV: "test", HOST: "127.0.0.1", PORT: "0",
      COTIZADOR_DATA_DIR: directory, EQUIPMENT_PDF_DIR: path.join(directory, "equipment-pdfs"),
      WAREHOUSE_INITIAL_STATE_PATH: path.join(directory, "unused-initial.json"),
      DISABLE_PDF_WARMUP: "1"
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  let closePromise;
  const close = () => closePromise ||= (async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 3000);
    try { await exited; } finally { clearTimeout(timeout); }
  })();
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Synthetic server did not start: ${output}`)), 15000);
      child.once("message", (message) => { clearTimeout(timer); resolve(message.port); });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Synthetic server exited ${code}: ${output}`)); });
    });
    return { origin: `http://127.0.0.1:${port}`, close };
  } catch (error) {
    await close();
    throw error;
  }
}

function seed(directory) {
  const legacyAdmin = { username: "SyntheticOriginal", password: hashPassword(password),
    sessionSecret: "synthetic-http-session-secret-with-no-production-use" };
  fs.writeFileSync(path.join(directory, "cotizador-auth.json"), JSON.stringify(legacyAdmin), { mode: 0o600 });
  fs.writeFileSync(path.join(directory, "inventario-bodega.json"), JSON.stringify({
    savedAt: "2026-11-23T00:00:00.000Z", state: { datasetId: "synthetic-http-only", movements: [],
      items: [{ id: "synthetic-one", name: "Unidad sintética", category: "Prueba", quantity: 0 }] }
  }), { mode: 0o600 });
  const store = createLiveUserStore({ directory, legacyAdmin });
  const administrator = store.list()[0];
  const owner = store.provisionDeveloperAccount({ password }, administrator);
  const full = store.create({ username: "SyntheticFull", role: "administrador", password }, owner);
  const warehouse = store.create({ username: "SyntheticWarehouse", role: "bodega", password }, owner);
  const planner = store.create({ username: "SyntheticPlanner", role: "planificacion", password }, owner);
  const readOnly = store.create({ username: "SyntheticReader", role: "consulta", password }, owner);
  const luxury = store.create({ username: "SyntheticLuxury", permissions: ["luxury.access"], password }, owner);
  // Historical grants and spoofed flags must not restore any public management.
  const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  Object.assign(saved.users.find((user) => user.id === full.id), {
    permissions: [...ALL_PERMISSION_IDS], isDeveloper: true, auditExempt: true, canActivateDeveloper: true
  });
  fs.writeFileSync(store.filePath, JSON.stringify(saved), { mode: 0o600 });
  return { legacyAdmin, store, owner, full, warehouse, planner, readOnly, luxury,
    profiles: [owner, administrator, full, warehouse, planner, readOnly, luxury] };
}

test("real HTTP removes every web account action while seven persisted profiles keep login and access", { timeout: 60000 }, async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "server-only-users-http-"));
  let rootServer;
  let luxuryServer;
  t.after(async () => {
    if (rootServer) await rootServer.close();
    if (luxuryServer) {
      luxuryServer.closeAllConnections();
      await new Promise((resolve) => luxuryServer.close(resolve));
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const h = seed(directory);
  const registryBefore = fs.readFileSync(h.store.filePath);
  const authBefore = fs.readFileSync(path.join(directory, "cotizador-auth.json"));
  rootServer = await startRoot(directory);
  const cookies = new Map();

  await t.test("existing credentials and operational role restrictions still work", async () => {
    for (const profile of h.profiles) {
      const login = await request(rootServer.origin, "/api/login", { method: "POST",
        body: { username: profile.username, password, isDeveloper: true, permissions: ALL_PERMISSION_IDS } });
      assert.equal(login.status, 200, profile.username);
      assert.equal(login.body.authenticated, true);
      assert.equal(login.body.id, profile.id);
      assert.equal(login.body.isDeveloper, profile.id === h.owner.id);
      assert.equal(login.body.auditExempt, profile.id === h.owner.id);
      assert.equal(Object.hasOwn(login.body, "canActivateDeveloper"), false);
      assert.ok(!JSON.stringify(login.body).includes(password));
      assert.ok(!JSON.stringify(login.body).includes('"password"'));
      cookies.set(profile.id, login.cookie);
      const session = await request(rootServer.origin, "/api/session", { cookie: login.cookie });
      assert.deepEqual(session.body, login.body);
      const onlyLuxury = profile.id === h.luxury.id;
      const warehouseOrPlanner = [h.warehouse.id, h.planner.id].includes(profile.id);
      for (const [endpoint, allowed] of [
        ["/api/cotizaciones", !onlyLuxury && !warehouseOrPlanner],
        ["/api/requerimientos", !onlyLuxury && !warehouseOrPlanner],
        ["/api/cuadros-equipo/eventos", !onlyLuxury],
        ["/api/inventario-bodega", !onlyLuxury]
      ]) {
        assert.equal((await request(rootServer.origin, endpoint, { cookie: login.cookie })).status,
          allowed ? 200 : 403, `${profile.username} ${endpoint}`);
      }
    }
  });

  await t.test("all public account paths and supported or unsupported methods return 404 without writes", async () => {
    const paths = ["/api/users", "/api/users/", "/api/users/bootstrap", "/api/users/developer", "/api/users/audit",
      `/api/users/${h.owner.id}`, `/api/users/${h.full.id}/password`, "/api/users/unknown/action",
      "/api/users//nested?role=administrador", "/api/account/password", "/api/account/password/nested"];
    const methods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE", "PROPFIND"];
    for (const cookie of ["", ...cookies.values()]) {
      for (const endpoint of paths) {
        for (const method of methods) {
          const response = await request(rootServer.origin, endpoint, { method, cookie,
            ...(["GET", "HEAD"].includes(method) ? {} : { body: { username: "AttemptedWebAccount", password,
              currentPassword: password, newPassword: "Attempted-change-123", permissions: ALL_PERMISSION_IDS,
              active: false, isDeveloper: true, userId: h.owner.id } }) });
          assert.equal(response.status, 404, `${cookie ? "authenticated" : "anonymous"} ${method} ${endpoint}`);
        }
      }
    }
    for (const endpoint of ["/usuarios-live.json", "/cotizador-auth.json", "/live-users.cjs",
      "/live-users.js", "/live-users.css", "/scripts/live-users-admin.cjs", "/server.js", "/platform-server.js",
      "/data/usuarios-live.json", "/luxury/lib/live-auth.cjs"]) {
      const response = await request(rootServer.origin, endpoint, { cookie: cookies.get(h.owner.id) });
      assert.equal(response.status, 404, endpoint);
      assert.ok(!response.text.includes(h.legacyAdmin.sessionSecret));
      assert.ok(!response.text.includes('"password"'));
    }
    assert.deepEqual(fs.readFileSync(h.store.filePath), registryBefore);
    assert.deepEqual(fs.readFileSync(path.join(directory, "cotizador-auth.json")), authBefore);
  });

  await t.test("root restart retains all seven accounts, hashes, permissions and current cookies", async () => {
    await rootServer.close();
    rootServer = await startRoot(directory);
    for (const profile of h.profiles) {
      const response = await request(rootServer.origin, "/api/session", { cookie: cookies.get(profile.id) });
      assert.equal(response.body.authenticated, true, profile.username);
      assert.equal(response.body.id, profile.id);
    }
    assert.deepEqual(fs.readFileSync(h.store.filePath), registryBefore);
    assert.deepEqual(fs.readFileSync(path.join(directory, "cotizador-auth.json")), authBefore);
  });

  await t.test("actual root cookies federate to Luxury and internal changes immediately invalidate old sessions", async () => {
    const { createApp } = await import(pathToFileURL(path.join(root, "luxury/server.js")).href);
    const app = await createApp({ dataFile: path.join(directory, "luxury-synthetic.json"), liveAuthDataDir: directory });
    luxuryServer = app.server;
    await new Promise((resolve) => luxuryServer.listen(0, "127.0.0.1", resolve));
    const luxuryOrigin = `http://127.0.0.1:${luxuryServer.address().port}`;
    const originalCookie = cookies.get(h.full.id);
    const rootFederation = await request(luxuryOrigin, "/api/session", { cookie: originalCookie });
    assert.equal(rootFederation.status, 200);
    assert.equal(rootFederation.body.user.liveUserId, h.full.id);
    assert.equal(rootFederation.body.permissions.includes("users"), false);
    assert.equal(rootFederation.body.user.isDeveloper, false);
    const luxuryLogin = await request(luxuryOrigin, "/api/login", { method: "POST",
      body: { username: h.full.username, password } });
    assert.equal(luxuryLogin.status, 200);
    const blocked = await request(luxuryOrigin, "/api/session", { cookie: cookies.get(h.warehouse.id) });
    assert.equal(blocked.status, 401);

    const internal = createLiveUserStore({ directory, legacyAdmin: h.legacyAdmin });
    internal.update(h.full.id, { password: "Internal-reset-only-123" }, h.owner);
    assert.equal((await request(rootServer.origin, "/api/session", { cookie: originalCookie })).body.authenticated, false);
    assert.equal((await request(rootServer.origin, "/api/cotizaciones", { cookie: originalCookie })).status, 401);
    assert.equal((await request(luxuryOrigin, "/api/session", { cookie: originalCookie })).status, 401);
    assert.equal((await request(luxuryOrigin, "/api/session", { cookie: luxuryLogin.cookie })).status, 401);
    assert.equal((await request(rootServer.origin, "/api/login", { method: "POST",
      body: { username: h.full.username, password } })).status, 401);
    const replacement = await request(rootServer.origin, "/api/login", { method: "POST",
      body: { username: h.full.username, password: "Internal-reset-only-123" } });
    assert.equal(replacement.status, 200);
    assert.equal((await request(luxuryOrigin, "/api/session", { cookie: replacement.cookie })).status, 200);

    internal.update(h.full.id, { permissions: ["warehouse.read"] }, h.owner);
    assert.equal((await request(rootServer.origin, "/api/session", { cookie: replacement.cookie })).body.authenticated, false);
    assert.equal((await request(luxuryOrigin, "/api/session", { cookie: replacement.cookie })).status, 401);
    const restricted = await request(rootServer.origin, "/api/login", { method: "POST",
      body: { username: h.full.username, password: "Internal-reset-only-123" } });
    assert.equal(restricted.status, 200);
    assert.deepEqual(restricted.body.permissions, ["warehouse.read"]);
    assert.equal((await request(rootServer.origin, "/api/cotizaciones", { cookie: restricted.cookie })).status, 403);
    assert.equal((await request(rootServer.origin, "/api/inventario-bodega", { cookie: restricted.cookie })).status, 200);
    internal.update(h.full.id, { active: false }, h.owner);
    assert.equal((await request(rootServer.origin, "/api/session", { cookie: restricted.cookie })).body.authenticated, false);
    assert.equal((await request(rootServer.origin, "/api/login", { method: "POST",
      body: { username: h.full.username, password: "Internal-reset-only-123" } })).status, 401);
    await rootServer.close();
    rootServer = await startRoot(directory);
    assert.equal((await request(rootServer.origin, "/api/session", { cookie: restricted.cookie })).body.authenticated, false);
    assert.equal((await request(rootServer.origin, "/api/session", { cookie: cookies.get(h.owner.id) })).body.authenticated, true);
  });
});
