import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { once } from "node:events";
import { createApp } from "../server.js";
import { hashPassword, parseCookies } from "../lib/auth.js";

const require = createRequire(import.meta.url);
const { createLiveUserStore, ALL_PERMISSION_IDS } = require("../../live-users.cjs");

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luxury-live-auth-"));
  const salt = "synthetic-shared-identity";
  const legacyAdmin = { username: "RootAdminTest", sessionSecret: crypto.randomBytes(32).toString("hex"),
    password: { algorithm: "pbkdf2-sha256", iterations: 210000, salt,
      hash: crypto.pbkdf2Sync("Root-test-123", salt, 210000, 32, "sha256").toString("hex") } };
  fs.writeFileSync(path.join(directory, "cotizador-auth.json"), JSON.stringify(legacyAdmin), { mode: 0o600 });
  const store = createLiveUserStore({ directory, legacyAdmin });
  const admin = store.list()[0];
  const owner = store.provisionDeveloperAccount({ password: "Owner-test-123" }, admin);
  const full = store.create({ username: "Full.employee", displayName: "Empleado completo sintético", password: "Eight888",
    permissions: ["luxury.access"] }, owner);
  const restricted = store.create({ username: "Warehouse.employee", displayName: "Empleado de bodega sintético", password: "Store-test-123",
    permissions: ["warehouse.read", "warehouse.movements"] }, owner);
  const app = await createApp({ dataFile: path.join(directory, "luxury-fixture.json"), liveAuthDataDir: directory });
  await app.db.create("users", { name: "Usuario nativo independiente", email: "native@example.test", role: "administrador", active: true,
    passwordHash: hashPassword("Native-test-123") }, "system");
  app.server.listen(0, "127.0.0.1");
  await once(app.server, "listening");
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => app.server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  async function request(url, { method = "GET", body, cookie = "" } = {}) {
    const response = await fetch(origin + url, { method,
      headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const json = method === "HEAD" ? null : await response.json();
    return { status: response.status, body: json, cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
      cookies: response.headers.getSetCookie() };
  }
  const rootCookie = (user, changes = {}) => {
    const payload = { ...store.sessionFor(user), exp: Date.now() + 3600000, ...changes };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", legacyAdmin.sessionSecret).update(body).digest("base64url");
    return `cotizador_session=${body}.${signature}`;
  };
  return { directory, legacyAdmin, store, admin, owner, full, restricted, app, request, rootCookie };
}

test("a signed current Live account opens Luxury operational modules without duplicating credentials", async (t) => {
  const h = await fixture(t);
  const response = await h.request("/api/bootstrap", { cookie: h.rootCookie(h.full) });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.username, h.full.username);
  assert.equal(response.body.user.authProvider, "live-productions");
  assert.equal(response.body.user.role, "administrador");
  for (const permission of ["dashboard", "quotes", "clients", "vehicles", "drivers", "rates", "history"]) {
    assert.ok(response.body.permissions.includes(permission), permission);
  }
  assert.equal(response.body.permissions.includes("users"), false);
  assert.equal(Object.hasOwn(response.body, "users"), false);
  assert.equal(h.app.db.list("users").some((user) => user.id === response.body.user.id), false);
  const created = await h.request("/api/clients", { method: "POST", cookie: h.rootCookie(h.full),
    body: { name: "Cliente de prueba federada", phone: "55555555" } });
  assert.equal(created.status, 201);
  assert.equal(h.app.db.data.history[0].userName, h.full.displayName);
  assert.equal(h.app.db.data.history[0].userId, `live:${h.full.id}`);
  assert.equal(JSON.stringify(response.body).includes("Eight888"), false);
});

test("Luxury login accepts root usernames and keeps federated sessions bound to current permissions and password versions", async (t) => {
  const h = await fixture(t);
  const login = await h.request("/api/login", { method: "POST", body: { email: h.full.username, password: "Eight888" } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.username, h.full.username);
  assert.ok(login.cookie.startsWith("lt_session="));
  assert.equal((await h.request("/api/session", { cookie: login.cookie })).status, 200);
  h.store.update(h.full.id, { password: "Replacement-test-123" }, h.owner);
  assert.equal((await h.request("/api/session", { cookie: login.cookie })).status, 401);
  const next = await h.request("/api/login", { method: "POST", body: { username: h.full.username, password: "Replacement-test-123" } });
  assert.equal(next.status, 200);
  h.store.update(h.full.id, { permissions: ["warehouse.read"] }, h.owner);
  assert.equal((await h.request("/api/session", { cookie: next.cookie })).status, 401);
  assert.equal((await h.request("/api/login", { method: "POST", body: { username: h.full.username, password: "Replacement-test-123" } })).status, 403);
});

test("restricted and disabled root identities cannot fall back to a valid independent native cookie", async (t) => {
  const h = await fixture(t);
  const native = await h.request("/api/login", { method: "POST", body: { email: "native@example.test", password: "Native-test-123" } });
  assert.equal(native.status, 200);
  assert.equal((await h.request("/api/session", { cookie: native.cookie })).status, 200);
  assert.equal((await h.request("/api/session", { cookie: `${h.rootCookie(h.restricted)}; ${native.cookie}` })).status, 401);
  assert.equal((await h.request("/api/login", { method: "POST", body: { email: h.restricted.username, password: "Store-test-123" } })).status, 403);
  const previous = h.rootCookie(h.full);
  h.store.update(h.full.id, { active: false }, h.owner);
  assert.equal((await h.request("/api/session", { cookie: `${previous}; ${native.cookie}` })).status, 401);
  assert.equal((await h.request("/api/session", { cookie: `cotizador_session=invalid-signature; ${native.cookie}` })).status, 200);
});

test("a native account matching a root-managed employee cannot bypass their root password or Luxury restriction", async (t) => {
  const h = await fixture(t);
  await h.app.db.create("users", { name: h.restricted.displayName, email: "managed-native@example.test", role: "administrador", active: true,
    passwordHash: hashPassword("Old-native-test-123") }, "system");
  assert.equal((await h.request("/api/login", { method: "POST", body: { email: "managed-native@example.test", password: "Old-native-test-123" } })).status, 401);
  assert.equal((await h.request("/api/login", { method: "POST", body: { email: "managed-native@example.test", password: "Store-test-123" } })).status, 403);
  const independent = await h.request("/api/login", { method: "POST", body: { email: "native@example.test", password: "Native-test-123" } });
  assert.equal(independent.status, 200);
  assert.equal(independent.body.user.email, "native@example.test");
});

test("rotating the root session secret revokes Luxury federation without changing independent native logins", async (t) => {
  const h = await fixture(t);
  const root = h.rootCookie(h.full);
  const login = await h.request("/api/login", { method: "POST", body: { email: h.full.username, password: "Eight888" } });
  assert.equal(login.status, 200);
  fs.writeFileSync(path.join(h.directory, "cotizador-auth.json"), JSON.stringify({ ...h.legacyAdmin,
    sessionSecret: crypto.randomBytes(32).toString("hex") }), { mode: 0o600 });
  assert.equal((await h.request("/api/session", { cookie: root })).status, 401);
  assert.equal((await h.request("/api/session", { cookie: login.cookie })).status, 401);
  assert.equal((await h.request("/api/login", { method: "POST", body: { email: "native@example.test", password: "Native-test-123" } })).status, 200);
});

test("single sign-out expires both root and Luxury cookies for a root-cookie session", async (t) => {
  const h = await fixture(t);
  const logout = await h.request("/api/logout", { method: "POST", cookie: h.rootCookie(h.full) });
  assert.equal(logout.status, 200);
  assert.equal(logout.cookies.length, 2);
  assert.ok(logout.cookies.some((cookie) => cookie.startsWith("cotizador_session=;") && cookie.includes("Path=/;")));
  assert.ok(logout.cookies.some((cookie) => cookie.startsWith("lt_session=;") && cookie.includes("Max-Age=0")));
  assert.deepEqual(parseCookies("malformed=%E0%A4%A; valid=value; bare"), { valid: "value" });
});

test("the protected owner can restore a valid Luxury snapshot while preserving its native administrator", async (t) => {
  const h = await fixture(t);
  const snapshot = h.app.db.exportSnapshot();
  const usersBefore = snapshot.users;
  // A legacy snapshot may contain users, but HTTP restore cannot alter them.
  snapshot.users = [{ id: "injected-owner", name: "Cuenta no permitida", email: "injected@example.test",
    role: "administrador", active: true, passwordHash: hashPassword("Injected-test-123") }];
  const response = await h.request("/api/admin/database-backup", { method: "POST", cookie: h.rootCookie(h.owner),
    body: { confirmation: "IMPORTAR RESPALDO", database: snapshot } });
  assert.equal(response.status, 200);
  assert.deepEqual(h.app.db.exportSnapshot().users, usersBefore);
  assert.equal(h.app.db.data.history[0].userId, `live:${h.owner.id}`);
  assert.equal(h.app.db.data.history[0].userName, h.owner.displayName);
  assert.equal(h.app.db.list("users").some((user) => user.liveUserId === h.owner.id), false);
});

test("a missing root registry fails closed without bootstrapping or writing identity files", async (t) => {
  const h = await fixture(t);
  const authBefore = fs.readFileSync(path.join(h.directory, "cotizador-auth.json"));
  fs.unlinkSync(path.join(h.directory, "usuarios-live.json"));
  const login = await h.request("/api/login", { method: "POST", body: { email: h.full.username, password: "Eight888" } });
  assert.equal(login.status, 503);
  assert.equal(fs.existsSync(path.join(h.directory, "usuarios-live.json")), false);
  assert.deepEqual(fs.readFileSync(path.join(h.directory, "cotizador-auth.json")), authBefore);
});

test("Luxury carries the protected developer identity only from the current root account", async (t) => {
  const h = await fixture(t);
  const developer = h.owner;
  const ownerSession = await h.request("/api/session", { cookie: h.rootCookie(developer) });
  assert.equal(ownerSession.status, 200);
  assert.equal(ownerSession.body.user.isDeveloper, true);
  assert.equal(ownerSession.body.user.auditExempt, true);
  const ordinary = await h.request("/api/session", { cookie: h.rootCookie(h.full) });
  assert.equal(ordinary.status, 200);
  assert.equal(ordinary.body.user.isDeveloper, false);
  assert.equal(ordinary.body.user.auditExempt, false);
  const login = await h.request("/api/login", { method: "POST", body: { username: "Dgiant", password: "Owner-test-123", isDeveloper: false } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.isDeveloper, true);
  assert.equal(login.body.user.liveUserId, developer.id);
});

test("legacy all-access administrators and native administrators cannot administer Luxury accounts or backups", async (t) => {
  const h = await fixture(t);
  const jorge = h.store.create({ username: "JorgeJJ.test", displayName: "Jorge JJ sintético", role: "administrador",
    password: "Jorge-test-123", permissions: ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage") }, h.owner);
  const diana = h.store.create({ username: "DianaDall.test", displayName: "Diana Dall sintética", role: "administrador",
    password: "Diana-test-123", permissions: ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage") }, h.owner);
  // Simulate an untouched registry written before users.manage became reserved.
  const registryPath = path.join(h.directory, "usuarios-live.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  for (const user of registry.users.filter((user) => [h.admin.id, jorge.id, diana.id].includes(user.id))) {
    user.permissions = [...ALL_PERMISSION_IDS];
    user.isDeveloper = true;
    user.auditExempt = true;
  }
  fs.writeFileSync(registryPath, JSON.stringify(registry), { mode: 0o600 });

  const nativeLogin = await h.request("/api/login", { method: "POST", body: {
    email: "native@example.test", password: "Native-test-123", role: "administrador",
    isDeveloper: true, auditExempt: true, permissions: ["users"] } });
  assert.equal(nativeLogin.status, 200);
  const userId = h.app.db.list("users")[0].id;
  const newUser = { name: "Usuario no permitido", email: "forbidden@example.test", password: "Forbidden-test-123", role: "administrador" };
  const cookies = [h.rootCookie(h.admin), h.rootCookie(jorge), h.rootCookie(diana), nativeLogin.cookie];
  for (const cookie of cookies) {
    for (const endpoint of ["/api/session", "/api/bootstrap"]) {
      const response = await h.request(endpoint, { cookie });
      assert.equal(response.status, 200);
      assert.equal(response.body.permissions.includes("users"), false);
      assert.equal(response.body.user.permissions.includes("users"), false);
      assert.ok(response.body.permissions.includes("quotes"));
      assert.ok(response.body.permissions.includes("settings"));
      assert.equal(Object.hasOwn(response.body, "users"), false);
    }
    for (const [method, endpoint] of [
      ["GET", "/api/users"], ["POST", "/api/users"], ["GET", `/api/users/${userId}`],
      ["PUT", `/api/users/${userId}`], ["PATCH", `/api/users/${userId}`], ["DELETE", `/api/users/${userId}`],
      ["PATCH", "/api/users/unknown/action"],
    ]) {
      const response = await h.request(endpoint, { method, cookie, ...(method === "GET" ? {} : { body: newUser }) });
      assert.equal(response.status, 404, `${method} ${endpoint}`);
    }
    for (const method of ["GET", "POST"]) {
      assert.equal((await h.request("/api/admin/database-backup", { method, cookie,
        ...(method === "POST" ? { body: newUser } : {}) })).status, 403);
    }
    assert.equal((await h.request("/api/dashboard", { cookie })).status, 200);
    assert.equal((await h.request("/api/clients", { method: "POST", cookie,
      body: { name: `Cliente permitido ${cookies.indexOf(cookie)}` } })).status, 201);
  }
  for (const [username, password] of [[h.admin.username, "Root-test-123"], [jorge.username, "Jorge-test-123"],
    [diana.username, "Diana-test-123"]]) {
    const login = await h.request("/api/login", { method: "POST", body: { username, password,
      liveUserId: h.owner.id, isDeveloper: true, permissions: ["users"] } });
    assert.equal(login.status, 200);
    assert.equal(login.body.permissions.includes("users"), false);
    assert.equal(login.body.user.permissions.includes("users"), false);
    assert.equal(login.body.user.isDeveloper, false);
    assert.equal((await h.request("/api/users", { cookie: login.cookie })).status, 404);
  }
  assert.equal(h.app.db.list("users").some((user) => user.email === newUser.email), false);
});

test("protected Dgiant has operational access and secure backups without web account administration", async (t) => {
  const h = await fixture(t);
  const login = await h.request("/api/login", { method: "POST", body: { username: "Dgiant", password: "Owner-test-123" } });
  assert.equal(login.status, 200);
  for (const response of [login, await h.request("/api/session", { cookie: login.cookie }),
    await h.request("/api/bootstrap", { cookie: h.rootCookie(h.owner) })]) {
    assert.equal(response.status, 200);
    assert.equal(response.body.permissions.includes("users"), false);
    assert.equal(response.body.user.permissions.includes("users"), false);
    assert.equal(Object.hasOwn(response.body, "users"), false);
    assert.ok(response.body.permissions.includes("quotes"));
    assert.ok(response.body.permissions.includes("settings"));
  }
  const usersBefore = h.app.db.exportSnapshot().users;
  for (const cookie of ["", login.cookie, h.rootCookie(h.owner)]) {
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      for (const endpoint of ["/api/users", `/api/users/${usersBefore[0].id}`, "/api/users/unknown/action"]) {
        const response = await h.request(endpoint, { method, cookie,
          ...(["POST", "PUT", "PATCH"].includes(method) ? { body: {
            name: "Cuenta prohibida", email: "owner-created@example.test", password: "Created-test-123", role: "administrador",
          } } : {}) });
        assert.equal(response.status, 404, `${method} ${endpoint}`);
      }
    }
  }
  const backup = await h.request("/api/admin/database-backup", { cookie: login.cookie });
  assert.equal(backup.status, 200);
  assert.equal(Object.hasOwn(backup.body, "users"), false);
  assert.equal(JSON.stringify(backup.body).includes("passwordHash"), false);
  assert.deepEqual(h.app.db.exportSnapshot().users, usersBefore);
  const restored = await h.request("/api/admin/database-backup", { method: "POST", cookie: login.cookie,
    body: { confirmation: "IMPORTAR RESPALDO", database: backup.body } });
  assert.equal(restored.status, 200);
  assert.deepEqual(h.app.db.exportSnapshot().users, usersBefore);
});

test("owner-pending federation denies user management without falling back to the legacy or native administrator", async (t) => {
  const h = await fixture(t);
  const registryPath = path.join(h.directory, "usuarios-live.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  registry.users = registry.users.filter((user) => user.id !== h.owner.id);
  fs.writeFileSync(registryPath, JSON.stringify(registry), { mode: 0o600 });
  const native = await h.request("/api/login", { method: "POST", body: { email: "native@example.test", password: "Native-test-123" } });
  assert.equal(native.status, 200);
  for (const cookie of [h.rootCookie(h.admin), native.cookie]) {
    const session = await h.request("/api/session", { cookie });
    assert.equal(session.status, 200);
    assert.equal(session.body.permissions.includes("users"), false);
    assert.equal((await h.request("/api/users", { cookie })).status, 404);
    assert.equal((await h.request("/api/users", { method: "POST", cookie,
      body: { name: "No permitido", email: "pending@example.test", password: "Pending-test-123" } })).status, 404);
    assert.equal((await h.request("/api/admin/database-backup", { cookie })).status, 403);
    assert.equal((await h.request("/api/dashboard", { cookie })).status, 200);
  }
});

test("changing the protected owner's password immediately revokes both types of Luxury sessions", async (t) => {
  const h = await fixture(t);
  const login = await h.request("/api/login", { method: "POST", body: { username: "Dgiant", password: "Owner-test-123" } });
  const rootCookie = h.rootCookie(h.owner);
  assert.equal((await h.request("/api/session", { cookie: login.cookie })).status, 200);
  h.store.update(h.owner.id, { password: "Owner-replacement-test-123" }, h.owner);
  for (const cookie of [rootCookie, login.cookie]) {
    assert.equal((await h.request("/api/session", { cookie })).status, 401);
    assert.equal((await h.request("/api/users", { cookie })).status, 404);
    assert.equal((await h.request("/api/admin/database-backup", { cookie })).status, 401);
  }
  const next = await h.request("/api/login", { method: "POST", body: { username: "Dgiant", password: "Owner-replacement-test-123" } });
  assert.equal(next.status, 200);
  assert.equal((await h.request("/api/session", { cookie: next.cookie })).status, 200);
  assert.equal((await h.request("/api/users", { cookie: next.cookie })).status, 404);
});
