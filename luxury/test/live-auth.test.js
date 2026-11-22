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
const { createLiveUserStore } = require("../../live-users.cjs");

async function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luxury-live-auth-"));
  const salt = "synthetic-shared-identity";
  const legacyAdmin = { username: "RootAdminTest", sessionSecret: crypto.randomBytes(32).toString("hex"),
    password: { algorithm: "pbkdf2-sha256", iterations: 210000, salt,
      hash: crypto.pbkdf2Sync("Root-test-123", salt, 210000, 32, "sha256").toString("hex") } };
  fs.writeFileSync(path.join(directory, "cotizador-auth.json"), JSON.stringify(legacyAdmin), { mode: 0o600 });
  const store = createLiveUserStore({ directory, legacyAdmin });
  const admin = store.list()[0];
  const full = store.create({ username: "Full.employee", displayName: "Empleado completo sintético", password: "Eight888",
    permissions: ["luxury.access"] }, admin);
  const restricted = store.create({ username: "Warehouse.employee", displayName: "Empleado de bodega sintético", password: "Store-test-123",
    permissions: ["warehouse.read", "warehouse.movements"] }, admin);
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
    const json = await response.json();
    return { status: response.status, body: json, cookie: response.headers.get("set-cookie")?.split(";")[0] || "",
      cookies: response.headers.getSetCookie() };
  }
  const rootCookie = (user, changes = {}) => {
    const payload = { ...store.sessionFor(user), exp: Date.now() + 3600000, ...changes };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", legacyAdmin.sessionSecret).update(body).digest("base64url");
    return `cotizador_session=${body}.${signature}`;
  };
  return { directory, legacyAdmin, store, admin, full, restricted, app, request, rootCookie };
}

test("a signed current Live account with luxury.access opens every Luxury module without duplicating credentials", async (t) => {
  const h = await fixture(t);
  const response = await h.request("/api/bootstrap", { cookie: h.rootCookie(h.full) });
  assert.equal(response.status, 200);
  assert.equal(response.body.user.username, h.full.username);
  assert.equal(response.body.user.authProvider, "live-productions");
  assert.equal(response.body.user.role, "administrador");
  for (const permission of ["dashboard", "quotes", "clients", "vehicles", "drivers", "rates", "users", "history"]) {
    assert.ok(response.body.permissions.includes(permission), permission);
  }
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
  h.store.update(h.full.id, { password: "Replacement-test-123" }, h.admin);
  assert.equal((await h.request("/api/session", { cookie: login.cookie })).status, 401);
  const next = await h.request("/api/login", { method: "POST", body: { username: h.full.username, password: "Replacement-test-123" } });
  assert.equal(next.status, 200);
  h.store.update(h.full.id, { permissions: ["warehouse.read"] }, h.admin);
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
  h.store.update(h.full.id, { active: false }, h.admin);
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

test("a federated administrator can restore a valid Luxury snapshot while preserving its native administrator", async (t) => {
  const h = await fixture(t);
  const snapshot = h.app.db.exportSnapshot();
  const nativeAdministrator = snapshot.users.find((user) => user.role === "administrador");
  const hash = nativeAdministrator.passwordHash;
  const response = await h.request("/api/admin/database-backup", { method: "POST", cookie: h.rootCookie(h.full),
    body: { confirmation: "IMPORTAR RESPALDO", database: snapshot } });
  assert.equal(response.status, 200);
  assert.equal(h.app.db.find("users", nativeAdministrator.id).passwordHash, hash);
  assert.equal(h.app.db.data.history[0].userId, `live:${h.full.id}`);
  assert.equal(h.app.db.data.history[0].userName, h.full.displayName);
  assert.equal(h.app.db.list("users").some((user) => user.liveUserId === h.full.id), false);
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
