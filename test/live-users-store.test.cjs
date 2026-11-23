const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const {
  createLiveUserStore, PERMISSION_DEFINITIONS, ROLE_PRESETS, ALL_PERMISSION_IDS, hasPermission,
  DEVELOPER_USER_ID, isDeveloperIdentity
} = require("../live-users.cjs");

const legacyPassword = "Legacy-test-123";
function legacyConfig() {
  const salt = "synthetic-legacy-salt";
  return { username: "AdministradorPrueba", password: { algorithm: "pbkdf2-sha256", iterations: 210000, salt,
    hash: crypto.pbkdf2Sync(legacyPassword, salt, 210000, 32, "sha256").toString("hex") } };
}
function fixture(t, { provision = true } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "live-users-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const legacyAdmin = legacyConfig();
  const options = { directory, legacyAdmin, clock: () => new Date("2026-11-22T12:30:45.000Z") };
  const store = createLiveUserStore(options);
  const legacy = store.list()[0];
  const admin = provision ? store.provisionDeveloperAccount({ password: "Owner-test-123" }, legacy) : legacy;
  return { directory, options, store, admin, legacy };
}
const session = (store, user) => ({ ...store.sessionFor(user), exp: Date.now() + 3600000 });
const createEmployee = (store, admin, overrides = {}) => store.create({ username: "bodega.prueba", displayName: "Empleado sintético",
  password: "Employee-test-123", role: "bodega", ...overrides }, admin);

test("migrates the existing administrator without changing credentials or exposing password hashes", (t) => {
  const { store, options, directory, admin } = fixture(t, { provision: false });
  assert.equal(store.authenticate(admin.username, legacyPassword).id, admin.id);
  assert.equal(store.authenticate("administradorprueba", legacyPassword).id, admin.id);
  assert.equal(store.authenticate(admin.username, "wrong-password"), null);
  assert.deepEqual(admin.permissions, ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage"));
  assert.equal(admin.sessionVersion, 1);
  assert.equal(hasPermission(admin, "users.manage"), false);
  assert.equal(admin.canActivateDeveloper, true);
  assert.equal(store.canActivateDeveloper(admin), true);
  const publicOutput = JSON.stringify({ list: store.list(), authenticated: store.authenticate(admin.username, legacyPassword), audit: store.audit() });
  assert.equal(publicOutput.includes(legacyPassword), false);
  assert.equal(publicOutput.includes(options.legacyAdmin.password.hash), false);
  assert.equal(publicOutput.includes("synthetic-legacy-salt"), false);
  assert.equal(fs.statSync(path.join(directory, "usuarios-live.json")).mode & 0o777, 0o600);
  const reopened = createLiveUserStore(options);
  assert.equal(reopened.list()[0].id, admin.id);
  assert.equal(reopened.authenticate(admin.username, legacyPassword).id, admin.id);
  assert.equal(reopened.audit().length, 1);
});

test("new employee credentials use individual salted scrypt hashes and persist across store restart", (t) => {
  const { store, options, admin } = fixture(t);
  const first = createEmployee(store, admin);
  const second = createEmployee(store, admin, { username: "otra.bodega" });
  assert.equal(store.authenticate(first.username, "Employee-test-123").id, first.id);
  assert.equal(hasPermission(first, "warehouse.movements"), true);
  assert.equal(hasPermission(first, "warehouse.movements.manage"), false);
  assert.equal(hasPermission(first, "users.manage"), false);
  const persisted = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  const savedFirst = persisted.users.find((user) => user.id === first.id);
  const savedSecond = persisted.users.find((user) => user.id === second.id);
  assert.equal(savedFirst.password.algorithm, "scrypt");
  assert.notEqual(savedFirst.password.salt, savedSecond.password.salt);
  assert.notEqual(savedFirst.password.hash, savedSecond.password.hash);
  assert.equal(JSON.stringify(persisted).includes("Employee-test-123"), false);
  const reopened = createLiveUserStore(options);
  assert.equal(reopened.authenticate(first.username, "Employee-test-123").id, first.id);
  assert.deepEqual(reopened.getUser(first.id).permissions, first.permissions);
  assert.equal(reopened.getUser(second.username).id, second.id);
});

test("legacy administrator sessions survive bootstrap until a verified own password change", (t) => {
  const { store, options, admin } = fixture(t, { provision: false });
  const old = { user: admin.username, exp: Date.now() + 3600000 };
  assert.equal(store.resolveSession(old).id, admin.id);
  assert.equal(store.resolveSession({ ...old, user: "another-user" }), null);
  assert.equal(store.resolveSession({ ...old, exp: Date.now() - 1 }), null);
  assert.equal(store.resolveSession({ user: admin.username }), null);
  const signed = session(store, admin);
  store.changeOwnPassword(admin.id, { currentPassword: legacyPassword, newPassword: "Updated-legacy-123" }, admin);
  assert.equal(store.resolveSession(old), null);
  assert.equal(store.resolveSession(signed), null);
  assert.equal(store.resolveSession(session(store, admin)).id, admin.id);
  assert.equal(createLiveUserStore(options).resolveSession(old), null);
});

test("changing permissions, disabling accounts and resetting passwords revoke old sessions permanently", (t) => {
  const { store, options, admin } = fixture(t);
  const employee = createEmployee(store, admin);
  const firstSession = session(store, employee);
  assert.equal(store.resolveSession(firstSession).id, employee.id);
  const revised = store.update(employee.id, { permissions: ["equipment.read"] }, admin);
  assert.equal(revised.sessionVersion, employee.sessionVersion + 1);
  assert.equal(store.resolveSession(firstSession), null);
  const secondSession = session(store, employee);
  store.update(employee.id, { active: false }, admin);
  assert.equal(store.resolveSession(secondSession), null);
  assert.equal(store.authenticate(employee.username, "Employee-test-123"), null);
  store.update(employee.id, { active: true, password: "New-secret-9876" }, admin);
  assert.equal(store.resolveSession(secondSession), null);
  assert.equal(store.authenticate(employee.username, "Employee-test-123"), null);
  assert.equal(store.authenticate(employee.username, "New-secret-9876").id, employee.id);
  const reopened = createLiveUserStore(options);
  assert.equal(reopened.resolveSession(firstSession), null);
  assert.equal(reopened.resolveSession(secondSession), null);
  assert.equal(reopened.authenticate(employee.username, "New-secret-9876").id, employee.id);
});

test("role labels never override explicit granular permissions or grant administrator privileges", (t) => {
  const { store, admin } = fixture(t);
  const employee = createEmployee(store, admin, { role: "administrador", permissions: ["warehouse.read"] });
  assert.equal(employee.role, "administrador");
  assert.deepEqual(employee.permissions, ["warehouse.read"]);
  assert.equal(hasPermission(employee, "users.manage"), false);
  assert.throws(() => store.create({ username: "forged.user", password: "Forged-test-123" }, employee), { statusCode: 403 });
  assert.throws(() => store.update(employee.id, { permissions: ALL_PERMISSION_IDS }, { ...employee, permissions: ALL_PERMISSION_IDS }), { statusCode: 403 });
  assert.throws(() => store.update(employee.id, { permissions: ALL_PERMISSION_IDS }, { id: "missing", permissions: ALL_PERMISSION_IDS }), { statusCode: 401 });
  const empty = createEmployee(store, admin, { username: "sin.accesos", role: "personalizado", permissions: [] });
  assert.deepEqual(empty.permissions, []);
  assert.equal(hasPermission(empty, "warehouse.read"), false);
});

test("the protected owner stays active and user management cannot be delegated", (t) => {
  const { store, admin } = fixture(t);
  const before = fs.readFileSync(store.filePath, "utf8");
  assert.throws(() => store.update(admin.id, { active: false }, admin), { statusCode: 409 });
  assert.throws(() => store.update(admin.id, { permissions: ["warehouse.read"] }, admin), { statusCode: 409 });
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  assert.throws(() => createEmployee(store, admin, { username: "admin.respaldo", role: "personalizado", permissions: ["users.manage"] }), { statusCode: 403 });
  const backup = createEmployee(store, admin, { username: "admin.respaldo", role: "administrador" });
  assert.throws(() => store.update(backup.id, { permissions: ["users.manage"] }, admin), { statusCode: 403 });
  assert.throws(() => store.update(admin.id, { active: false }, backup), { statusCode: 403 });
  assert.equal(store.getUser(admin.id).active, true);
  assert.equal(hasPermission(store.getUser(backup.id), "users.manage"), false);
});

test("user validation rejects duplicate identities, weak passwords, unknown permissions and protected fields before writing", (t) => {
  const { store, admin } = fixture(t);
  createEmployee(store, admin);
  const before = fs.readFileSync(store.filePath, "utf8");
  for (const payload of [
    { username: "BODEGA.PRUEBA", password: "Valid-test-123" },
    { username: "invalid user", password: "Valid-test-123" },
    { username: "new.employee", password: "short" },
    { username: "new.employee", password: "x".repeat(257) },
    { username: "new.employee", password: "Valid-test-123", permissions: ["not.real"] },
    { username: "new.employee", password: "Valid-test-123", active: "true" },
    { username: "new.employee", password: "Valid-test-123", passwordHash: "injected" },
    { username: "new.employee", password: "Valid-test-123", sessionVersion: 99 },
    { username: "new.employee", password: "Valid-test-123", role: "unknown" }
  ]) assert.throws(() => store.create(payload, admin));
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  assert.throws(() => store.update(admin.id, { username: "bodega.prueba" }, admin), { statusCode: 409 });
  assert.equal(store.list().length, 3);
});

test("audits use authenticated employee identities and server timestamps without recording any passwords", (t) => {
  const { store, options, admin } = fixture(t);
  const prior = store.audit().length;
  const employee = createEmployee(store, { ...admin, username: "forged.name", displayName: "Forged actor" });
  store.update(employee.id, { password: "Another-test-123", permissions: ["equipment.read", "warehouse.read"] }, admin);
  const audit = store.audit();
  assert.equal(audit.length, prior + 2);
  assert.equal(audit[prior].action, "users.create");
  assert.deepEqual(audit[prior].actor, { id: admin.id, username: admin.username, displayName: admin.displayName });
  assert.equal(audit[prior].timestamp, "2026-11-22T12:30:45.000Z");
  assert.equal(audit[prior + 1].changes.passwordChanged, true);
  assert.equal(audit[prior + 1].target.id, employee.id);
  const serialized = JSON.stringify(audit);
  assert.equal(serialized.includes("Another-test-123"), false);
  assert.equal(serialized.includes("Employee-test-123"), false);
  assert.equal(serialized.includes(options.legacyAdmin.password.hash), false);
  audit[prior].actor.username = "mutated outside store";
  assert.equal(store.audit()[prior].actor.username, admin.username);
});

test("a corrupt or inaccessible user file never triggers an administrator reset or overwrites existing accounts", (t) => {
  const { directory, store, options } = fixture(t);
  fs.writeFileSync(store.filePath, "{broken json", { mode: 0o600 });
  assert.throws(() => createLiveUserStore(options), /no se restablecieron las cuentas/);
  assert.equal(fs.readFileSync(store.filePath, "utf8"), "{broken json");
  fs.unlinkSync(store.filePath);
  assert.throws(() => createLiveUserStore({ directory }), /cuenta administradora existente/);
  assert.equal(fs.existsSync(store.filePath), false);
  fs.mkdirSync(store.filePath);
  assert.throws(() => createLiveUserStore(options), /no se restablecieron las cuentas/);
  assert.equal(fs.statSync(store.filePath).isDirectory(), true);
});

test("own password changes require the current password and revoke sessions without administrator access", (t) => {
  const { store, admin } = fixture(t);
  const employee = createEmployee(store, admin);
  const oldSession = session(store, employee);
  assert.throws(() => store.changeOwnPassword(employee.id, { currentPassword: "wrong", newPassword: "Self-test-123" }, employee), { statusCode: 401 });
  assert.throws(() => store.changeOwnPassword(admin.id, { currentPassword: legacyPassword, newPassword: "Self-test-123" }, employee), { statusCode: 403 });
  store.changeOwnPassword(employee.id, { currentPassword: "Employee-test-123", newPassword: "Self-test-123" }, employee);
  assert.equal(store.resolveSession(oldSession), null);
  assert.equal(store.authenticate(employee.username, "Employee-test-123"), null);
  assert.equal(store.authenticate(employee.username, "Self-test-123").id, employee.id);
  assert.equal(store.audit().at(-1).actor.id, employee.id);
  assert.equal(store.audit().at(-1).action, "users.password.change");
});

test("the permission catalog and role presets are stable, complete and isolated from caller mutations", () => {
  assert.equal(new Set(PERMISSION_DEFINITIONS.map((permission) => permission.id)).size, PERMISSION_DEFINITIONS.length);
  assert.equal(ALL_PERMISSION_IDS.includes("warehouse.movements.manage"), true);
  assert.equal(ALL_PERMISSION_IDS.includes("luxury.access"), true);
  const administrator = ROLE_PRESETS.find((role) => role.id === "administrador");
  assert.deepEqual(administrator.permissions, ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage"));
  assert.equal(ROLE_PRESETS.find((role) => role.id === "bodega").permissions.includes("warehouse.movements.manage"), false);
  assert.equal(ROLE_PRESETS.find((role) => role.id === "bodega").permissions.includes("users.manage"), false);
  assert.throws(() => administrator.permissions.push("fake"));
});

test("eight-character passwords are accepted and a read-only identity bridge cannot create or mutate accounts", (t) => {
  const { store, options, admin } = fixture(t);
  const employee = createEmployee(store, admin, { password: "Eight888", permissions: ["luxury.access"] });
  assert.equal(store.authenticate(employee.username, "Eight888").id, employee.id);
  const before = fs.readFileSync(store.filePath, "utf8");
  const readOnly = createLiveUserStore({ ...options, readOnly: true });
  assert.equal(readOnly.authenticate(employee.username, "Eight888").id, employee.id);
  assert.throws(() => readOnly.update(employee.id, { active: false }, admin), { statusCode: 403 });
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  fs.unlinkSync(store.filePath);
  assert.throws(() => createLiveUserStore({ ...options, readOnly: true }), /no está disponible/);
  assert.equal(fs.existsSync(store.filePath), false);
});

test("the protected developer is unique, authenticates normally and alone receives server-derived exemption flags", (t) => {
  const { store, options, admin, legacy } = fixture(t);
  const ordinaryAdministrator = createEmployee(store, admin, { username: "all.permissions", role: "administrador" });
  assert.equal(legacy.isDeveloper, false);
  assert.equal(legacy.auditExempt, false);
  assert.equal(ordinaryAdministrator.isDeveloper, false);
  assert.equal(ordinaryAdministrator.auditExempt, false);
  assert.throws(() => createEmployee(store, admin, { username: " DGIANT " }), { statusCode: 409 });
  assert.throws(() => store.update(ordinaryAdministrator.id, { username: "Dgiant" }, admin), { statusCode: 409 });
  const developer = store.getUser(admin.id);
  assert.equal(developer.id, DEVELOPER_USER_ID);
  assert.equal(developer.username, "Dgiant");
  assert.equal(developer.isDeveloper, true);
  assert.equal(developer.auditExempt, true);
  assert.equal(developer.active, true);
  assert.equal(developer.role, "administrador");
  assert.deepEqual(developer.permissions, ALL_PERMISSION_IDS);
  assert.equal(store.authenticate("DGIANT", "Owner-test-123").id, DEVELOPER_USER_ID);
  assert.equal(store.authenticate("DGIANT", "wrong-password"), null);
  assert.throws(() => store.provisionDeveloperAccount({ password: "Owner-test-123" }, admin), { statusCode: 409 });
  const reopened = createLiveUserStore(options);
  assert.equal(reopened.authenticate("dgiant", "Owner-test-123").auditExempt, true);
  assert.equal(reopened.list().filter((user) => user.isDeveloper).length, 1);
  assert.equal(reopened.list().filter((user) => user.auditExempt).length, 1);
});

test("developer credentials and identity cannot be reset, transferred or forged by another administrator", (t) => {
  const { store, admin: developer, legacy: admin } = fixture(t);
  const employee = createEmployee(store, developer);
  const before = fs.readFileSync(store.filePath, "utf8");
  for (const patch of [{ password: "Stolen-test-123" }, { displayName: "Otro propietario" }, { active: false }, { permissions: [] }]) {
    assert.throws(() => store.update(developer.id, patch, admin), { statusCode: 403 });
  }
  for (const patch of [{ id: DEVELOPER_USER_ID }, { isDeveloper: true }, { auditExempt: true }]) {
    assert.throws(() => store.update(employee.id, patch, developer), { statusCode: 400 });
    assert.throws(() => store.create({ username: "forged.developer", password: "Forged-test-123", ...patch }, developer), { statusCode: 400 });
  }
  assert.throws(() => store.update(developer.id, { password: "Stolen-test-123" }, { ...employee, isDeveloper: true, auditExempt: true }), { statusCode: 403 });
  assert.throws(() => store.provisionDeveloperAccount({ username: "another.owner", password: "Owner-test-123" }, admin), { statusCode: 409 });
  assert.throws(() => store.changeOwnPassword(developer.id, { currentPassword: "Owner-test-123", newPassword: "Stolen-test-123" }, employee), { statusCode: 403 });
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  assert.equal(isDeveloperIdentity({ ...employee, isDeveloper: true, auditExempt: true }), false);
  assert.equal(isDeveloperIdentity({ ...employee, id: DEVELOPER_USER_ID, username: "another.owner" }), false);
  assert.equal(isDeveloperIdentity({ ...employee, username: "Dgiant" }), false);
  assert.equal(store.getUser(employee.id).auditExempt, false);
});

test("the developer can update their own name and password while protected access remains immutable", (t) => {
  const { store, admin: developer } = fixture(t);
  for (const patch of [{ username: "different.owner" }, { role: "personalizado" }, { active: false }, { permissions: ["users.manage"] }]) {
    assert.throws(() => store.update(developer.id, patch, developer), { statusCode: 409 });
  }
  const prior = session(store, developer);
  store.update(developer.id, { displayName: "Propietario actualizado", password: "Updated-owner-123" }, developer);
  assert.equal(store.resolveSession(prior), null);
  assert.equal(store.authenticate("Dgiant", "Owner-test-123"), null);
  const updated = store.authenticate("Dgiant", "Updated-owner-123");
  assert.equal(updated.auditExempt, true);
  assert.equal(updated.displayName, "Propietario actualizado");
  assert.deepEqual(updated.permissions, ALL_PERMISSION_IDS);
  store.changeOwnPassword(developer.id, { currentPassword: "Updated-owner-123", newPassword: "Final-owner-123" }, updated);
  assert.equal(store.authenticate("Dgiant", "Final-owner-123").isDeveloper, true);
});

test("explicit developer migration requires the existing password and preserves past audit entries", (t) => {
  const { store, options, admin } = fixture(t, { provision: false });
  const raw = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  const employee = { ...raw.users[0], id: "synthetic-existing-owner", username: "Dgiant", legacySessionEligible: false };
  raw.users.push(employee);
  fs.writeFileSync(store.filePath, JSON.stringify(raw), { mode: 0o600 });
  const existing = createLiveUserStore(options);
  assert.equal(existing.getUser("Dgiant").isDeveloper, false);
  const before = existing.audit();
  const oldSession = session(existing, existing.getUser("Dgiant"));
  assert.throws(() => existing.provisionDeveloperAccount({ password: "Different-owner-123" }, admin), { statusCode: 401 });
  const migrated = existing.provisionDeveloperAccount({ password: legacyPassword }, admin);
  assert.equal(migrated.id, DEVELOPER_USER_ID);
  assert.equal(migrated.isDeveloper, true);
  assert.equal(existing.resolveSession(oldSession), null);
  assert.equal(existing.getUser(employee.id), null);
  assert.deepEqual(existing.audit().slice(0, before.length), before);
  assert.equal(existing.authenticate("Dgiant", legacyPassword).auditExempt, true);
});
