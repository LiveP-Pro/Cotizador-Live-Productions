"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createLiveUserStore, hashPassword, DEVELOPER_USER_ID, DEVELOPER_USERNAME, ALL_PERMISSION_IDS } = require("../live-users.cjs");
const entryPoint = path.resolve(__dirname, "../scripts/live-users-admin.cjs");
const ordinaryPermissions = ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage");
const password = "Synthetic-password-123";
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "live-users-cli-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function run(directory, batch, args = []) {
  return spawnSync(process.execPath, [entryPoint, "apply", "--data-dir", directory, ...args], {
    input: typeof batch === "string" ? batch : JSON.stringify(batch), encoding: "utf8", env: { ...process.env, COTIZADOR_DATA_DIR: "" }
  });
}
function successful(result) {
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function raw(directory) { return JSON.parse(fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8")); }
function initialBatch() {
  return { version: 1, bootstrapAdministrator: { username: "synthetic.admin", password },
    owner: { displayName: "Synthetic owner", password }, users: [
      { username: "synthetic.employee", displayName: "Synthetic employee", password, role: "bodega" },
      { username: "synthetic.viewer", password, permissions: ["equipment.read"] }
    ] };
}
function session(store, identifier) { return { ...store.sessionFor(identifier), exp: Date.now() + 60000 }; }

test("internal CLI creates complete batch with private salted hashes, sanitized output and idempotent reapplication", (t) => {
  const directory = fixture(t), batch = initialBatch();
  const result = successful(run(directory, batch));
  assert.equal(result.users.length, 4);
  assert.equal(result.changed, true);
  const stored = raw(directory);
  assert.equal(stored.users.find((user) => user.id === DEVELOPER_USER_ID).username, DEVELOPER_USERNAME);
  assert.equal(stored.users.find((user) => user.username === "synthetic.admin").permissions.includes("users.manage"), false);
  assert.equal(fs.statSync(path.join(directory, "usuarios-live.json")).mode & 0o777, 0o600);
  assert.equal(new Set(stored.users.map((user) => user.password.salt)).size, 4);
  assert.equal(JSON.stringify(stored).includes(password), false);
  const output = JSON.stringify(result);
  for (const secret of [password, ...stored.users.flatMap((user) => [user.password.hash, user.password.salt])]) assert.equal(output.includes(secret), false);
  const before = fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8");
  assert.equal(successful(run(directory, batch)).changed, false);
  assert.equal(fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8"), before);
  const list = spawnSync(process.execPath, [entryPoint, "list"], { encoding: "utf8", env: { ...process.env, COTIZADOR_DATA_DIR: directory } });
  assert.equal(list.status, 0, list.stderr);
  assert.equal(JSON.parse(list.stdout).users.length, 4);
  for (const user of stored.users) assert.equal(list.stdout.includes(user.password.hash), false);
  assert.equal(fs.existsSync(path.join(directory, "usuarios-live.lock")), false);
});

test("batch updates existing credentials without old passwords, preserves IDs/history and revokes only changed sessions after reload", (t) => {
  const directory = fixture(t);
  successful(run(directory, initialBatch()));
  const store = createLiveUserStore({ directory });
  const original = raw(directory);
  const employee = store.getUser("synthetic.employee"), viewer = store.getUser("synthetic.viewer");
  const employeeSession = session(store, employee), viewerSession = session(store, viewer);
  const ownerSession = session(store, DEVELOPER_USER_ID), adminSession = session(store, "synthetic.admin");
  const moduleFile = path.join(directory, "module-data.json");
  fs.writeFileSync(moduleFile, "preserve unrelated module data");
  const updatedPassword = "Synthetic-reset-456";
  const batch = { version: 1, owner: { password: updatedPassword }, users: [
    { username: "synthetic.employee", password: updatedPassword, permissions: ["warehouse.read"] },
    { username: "synthetic.admin", password: updatedPassword, permissions: ordinaryPermissions }
  ] };
  successful(run(directory, batch));
  store.reload();
  assert.equal(store.resolveSession(employeeSession), null);
  assert.equal(store.resolveSession(ownerSession), null);
  assert.equal(store.resolveSession(adminSession), null);
  assert.equal(store.resolveSession(viewerSession).id, viewer.id);
  for (const username of [DEVELOPER_USERNAME, "synthetic.employee", "synthetic.admin"]) {
    const current = store.authenticate(username, updatedPassword);
    const before = original.users.find((user) => user.username === username);
    assert.equal(current.id, before.id);
    assert.equal(current.createdAt, before.createdAt);
    assert.equal(current.sessionVersion, before.sessionVersion + 1);
  }
  assert.equal(store.authenticate("synthetic.employee", password), null);
  const current = raw(directory);
  assert.deepEqual(current.audit.slice(0, original.audit.length), original.audit);
  assert.deepEqual(current.users.find((user) => user.id === viewer.id), original.users.find((user) => user.id === viewer.id));
  assert.equal(fs.readFileSync(moduleFile, "utf8"), "preserve unrelated module data");
  const bytes = fs.readFileSync(store.filePath, "utf8");
  assert.equal(successful(run(directory, batch)).changed, false);
  assert.equal(fs.readFileSync(store.filePath, "utf8"), bytes);
});

test("dry runs validate new and existing batches without creating directories or changing files", (t) => {
  const parent = fixture(t), directory = path.join(parent, "new-private-directory");
  const result = successful(run(directory, initialBatch(), ["--dry-run"]));
  assert.equal(result.dryRun, true);
  assert.equal(result.changed, true);
  assert.equal(fs.existsSync(directory), false);
  successful(run(directory, initialBatch()));
  const before = fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8");
  successful(run(directory, { version: 1, users: [{ username: "synthetic.employee", active: false }] }, ["--dry-run"]));
  assert.equal(fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8"), before);
});

test("invalid batches never partially initialize or change the registry and never echo secrets", (t) => {
  const directory = fixture(t);
  const invalid = initialBatch();
  invalid.users.push({ username: "missing.password" });
  const failure = run(directory, invalid);
  assert.notEqual(failure.status, 0);
  assert.equal(fs.existsSync(path.join(directory, "usuarios-live.json")), false);
  successful(run(directory, initialBatch()));
  const before = fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8");
  const attempts = [
    { version: 1, users: [{ username: "synthetic.employee", password: "Valid-change-123" }, { username: "new.employee" }] },
    { version: 1, users: [{ username: "synthetic.employee", permissions: ["users.manage"] }] },
    { version: 1, users: [{ username: DEVELOPER_USERNAME, password }] },
    { version: 1, users: [{ username: "synthetic.employee", isDeveloper: true }] },
    { version: 1, users: [{ username: "synthetic.employee", auditExempt: true }] },
    { version: 1, users: [{ username: "synthetic.employee", id: DEVELOPER_USER_ID }] },
    { version: 1, users: [{ username: "synthetic.employee", password: "short" }] },
    { version: 1, users: [{ username: "synthetic.employee" }, { username: "SYNTHETIC.EMPLOYEE" }] },
    ...["username", "active", "role", "permissions", "isDeveloper"].map((field) => ({ version: 1, owner: { [field]: true } })),
    `{"version":1,"users":[],"secret":"${password}"`,
    { version: 2, users: [] }
  ];
  for (const batch of attempts) {
    const result = run(directory, batch);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout.includes(password), false);
    assert.equal(result.stderr.includes(password), false);
    assert.equal(fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8"), before);
  }
});

test("CLI imports existing administrator hashes unchanged and refuses corrupt registries/config without fallback", (t) => {
  const directory = fixture(t), configPath = path.join(directory, "cotizador-auth.json");
  const config = { username: "existing.synthetic", password: hashPassword(password), sessionSecret: "synthetic-session-secret" };
  fs.writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 });
  successful(run(directory, { version: 1, owner: { password }, users: [] }));
  const stored = raw(directory), existing = stored.users.find((user) => user.username === config.username);
  assert.deepEqual(existing.password, config.password);
  assert.equal(fs.readFileSync(configPath, "utf8"), JSON.stringify(config));
  const registryPath = path.join(directory, "usuarios-live.json");
  fs.writeFileSync(registryPath, "{corrupt-private-data");
  const failure = run(directory, initialBatch());
  assert.notEqual(failure.status, 0);
  assert.equal(fs.readFileSync(registryPath, "utf8"), "{corrupt-private-data");
  assert.equal(failure.stderr.includes("corrupt-private-data"), false);
  fs.unlinkSync(registryPath);
  fs.writeFileSync(configPath, "{corrupt-private-auth");
  assert.notEqual(run(directory, initialBatch()).status, 0);
  assert.equal(fs.existsSync(registryPath), false);
  assert.equal(fs.readFileSync(configPath, "utf8"), "{corrupt-private-auth");
});

test("reload fails closed on corruption or deletion and observes a repaired registry", (t) => {
  const directory = fixture(t);
  successful(run(directory, initialBatch()));
  const store = createLiveUserStore({ directory });
  const valid = fs.readFileSync(store.filePath, "utf8");
  const prior = session(store, "synthetic.employee");
  fs.writeFileSync(store.filePath, "{corrupt");
  assert.throws(() => store.reload(), /No se pudo leer/);
  assert.throws(() => store.resolveSession(prior));
  fs.unlinkSync(store.filePath);
  assert.throws(() => store.reload(), /No se pudo leer/);
  assert.equal(fs.existsSync(store.filePath), false);
  fs.writeFileSync(store.filePath, valid, { mode: 0o600 });
  store.reload();
  assert.equal(store.resolveSession(prior).username, "synthetic.employee");
});

test("console writer lock prevents overlapping commits and CLI requires explicit data directory", (t) => {
  const directory = fixture(t);
  successful(run(directory, initialBatch()));
  const before = fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8");
  const lockPath = path.join(directory, "usuarios-live.lock");
  fs.writeFileSync(lockPath, "synthetic-lock", { mode: 0o600 });
  assert.notEqual(run(directory, { version: 1, users: [{ username: "synthetic.employee", active: false }] }).status, 0);
  assert.equal(fs.readFileSync(lockPath, "utf8"), "synthetic-lock");
  assert.equal(fs.readFileSync(path.join(directory, "usuarios-live.json"), "utf8"), before);
  const noDirectory = spawnSync(process.execPath, [entryPoint, "list"], { encoding: "utf8", env: { ...process.env, COTIZADOR_DATA_DIR: "" } });
  assert.notEqual(noDirectory.status, 0);
  const passwordArgument = spawnSync(process.execPath, [entryPoint, "apply", "--data-dir", directory, "--password", password], { encoding: "utf8" });
  assert.notEqual(passwordArgument.status, 0);
  assert.equal(passwordArgument.stderr.includes(password), false);
});

test("internal activation migrates a reserved existing account without its old password and preserves prior audit references", (t) => {
  const directory = fixture(t);
  const options = { directory, legacyAdmin: { username: "synthetic.original", password: hashPassword(password) } };
  const bootstrap = createLiveUserStore(options);
  const seeded = raw(directory), originalId = "synthetic-reserved-account";
  seeded.users[0].permissions = [...ALL_PERMISSION_IDS];
  seeded.users.push({ ...seeded.users[0], id: originalId, username: DEVELOPER_USERNAME,
    displayName: "Existing synthetic owner", legacySessionEligible: false });
  fs.writeFileSync(bootstrap.filePath, JSON.stringify(seeded), { mode: 0o600 });
  const before = createLiveUserStore(options);
  const legacy = session(before, seeded.legacyAdminId), owner = session(before, originalId);
  const resetPassword = "Synthetic-new-owner-456";
  const result = successful(run(directory, { version: 1, owner: { password: resetPassword } }));
  assert.equal(result.changed, true);
  before.reload();
  assert.equal(before.resolveSession(legacy), null);
  assert.equal(before.resolveSession(owner), null);
  assert.equal(before.getUser(originalId), null);
  assert.equal(before.authenticate(DEVELOPER_USERNAME, resetPassword).id, DEVELOPER_USER_ID);
  assert.equal(before.authenticate("synthetic.original", password).id, seeded.legacyAdminId);
  const updated = raw(directory);
  assert.equal(updated.users.length, seeded.users.length);
  assert.equal(updated.users.find((user) => user.id === DEVELOPER_USER_ID).createdAt, seeded.users[1].createdAt);
  assert.deepEqual(updated.users.find((user) => user.id === seeded.legacyAdminId).password, seeded.users[0].password);
  assert.deepEqual(updated.audit.slice(0, seeded.audit.length), seeded.audit);
  assert.equal(updated.audit.some((entry) => entry.changes.id?.before === originalId && entry.changes.id?.after === DEVELOPER_USER_ID), true);
});
