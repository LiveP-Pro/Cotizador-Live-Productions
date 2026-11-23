"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createLiveUserStore, publicUser, hasPermission, hashPassword, ALL_PERMISSION_IDS,
  DEVELOPER_USER_ID, DEVELOPER_USERNAME } = require("../live-users.cjs");

const password = "Synthetic-123";
const ordinaryPermissions = ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage");
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "live-users-owner-only-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const options = { directory, legacyAdmin: { username: "OriginalAdmin", password: hashPassword(password) } };
  const store = createLiveUserStore(options);
  return { options, store, legacy: store.list()[0] };
}
const signedSession = (store, user) => ({ ...store.sessionFor(user), exp: Date.now() + 3600000 });
function seedOrdinaryAdministrators(store, names = ["Jorge", "Diana"]) {
  const state = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  state.users[0].permissions = [...ALL_PERMISSION_IDS];
  for (const username of names) {
    state.users.push({ ...state.users[0], id: `synthetic-${username.toLowerCase()}`, username,
      displayName: username, legacySessionEligible: false });
  }
  fs.writeFileSync(store.filePath, JSON.stringify(state), { mode: 0o600 });
  return state;
}

test("users.manage requires the protected owner identity even when legacy permissions or flags claim otherwise", () => {
  const ordinary = { id: "ordinary", username: "Jorge", active: true, role: "administrador",
    permissions: [...ALL_PERMISSION_IDS], isDeveloper: true, auditExempt: true };
  assert.equal(hasPermission(ordinary, "users.manage"), false);
  assert.equal(hasPermission({ ...ordinary, id: DEVELOPER_USER_ID }, "users.manage"), false);
  assert.equal(hasPermission({ ...ordinary, username: DEVELOPER_USERNAME }, "users.manage"), false);
  const owner = { ...ordinary, id: DEVELOPER_USER_ID, username: DEVELOPER_USERNAME, permissions: [] };
  assert.equal(hasPermission(owner, "users.manage"), true);
  assert.equal(hasPermission({ ...owner, active: false }, "users.manage"), false);
  assert.equal(publicUser(ordinary).permissions.includes("users.manage"), false);
  assert.equal(publicUser({ ...ordinary, canActivateDeveloper: true }).canActivateDeveloper, false);
});

test("bootstrap grants only the original active account a one-time owner activation capability", (t) => {
  const { options, store: initial, legacy } = fixture(t);
  seedOrdinaryAdministrators(initial);
  const store = createLiveUserStore(options);
  const jorge = store.getUser("Jorge");
  assert.equal(store.canActivateDeveloper(legacy), true);
  assert.equal(store.canActivateDeveloper(jorge), false);
  assert.equal(store.canActivateDeveloper({ ...jorge, canActivateDeveloper: true, permissions: [...ALL_PERMISSION_IDS] }), false);
  for (const user of [legacy, jorge, store.getUser("Diana")]) {
    assert.equal(store.hasPermission(user, "users.manage"), false);
    assert.equal(store.authenticate(user.username, password).canActivateDeveloper, user.id === legacy.id);
    assert.equal(store.resolveSession(signedSession(store, user)).canActivateDeveloper, user.id === legacy.id);
    assert.equal(store.getUser(user.id).canActivateDeveloper, user.id === legacy.id);
  }
  const before = fs.readFileSync(store.filePath, "utf8");
  for (const actor of [legacy, jorge]) {
    assert.throws(() => store.create({ username: "Unauthorized", password }, actor), { statusCode: 403 });
    for (const patch of [{ password: "Reset-other-123" }, { permissions: [] }, { active: false }, { displayName: "Renamed" }]) {
      assert.throws(() => store.update(jorge.id, patch, actor), { statusCode: 403 });
    }
  }
  assert.throws(() => store.provisionDeveloperAccount({ password }, jorge), { statusCode: 403 });
  assert.throws(() => store.provisionDeveloperAccount({ username: "SomeoneElse", password }, legacy), { statusCode: 400 });
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  const owner = store.provisionDeveloperAccount({ username: "DGIANT", password }, legacy);
  assert.equal(owner.id, DEVELOPER_USER_ID);
  assert.equal(owner.canActivateDeveloper, false);
  assert.equal(store.canActivateDeveloper(legacy), false);
  assert.equal(store.list().every((user) => user.canActivateDeveloper === false), true);
  for (const actor of [legacy, jorge, owner]) {
    assert.throws(() => store.provisionDeveloperAccount({ password: "Replacement-123" }, actor), { statusCode: 409 });
  }
  assert.equal(store.authenticate(DEVELOPER_USERNAME, password).id, owner.id);
});

test("owner activation removes historical management grants and revokes affected sessions while preserving other access and credentials", (t) => {
  const { options, store: initial, legacy } = fixture(t);
  const seeded = seedOrdinaryAdministrators(initial, ["Jorge", "Diana", "Regular"]);
  seeded.users.find((user) => user.username === "Regular").permissions = ["equipment.read"];
  fs.writeFileSync(initial.filePath, JSON.stringify(seeded), { mode: 0o600 });
  const store = createLiveUserStore(options);
  const sessions = new Map(store.list().map((user) => [user.id, signedSession(store, user)]));
  const unsignedLegacy = { user: legacy.username, exp: Date.now() + 3600000 };
  assert.equal(store.resolveSession(unsignedLegacy).id, legacy.id);
  const owner = store.provisionDeveloperAccount({ password }, legacy);
  const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  assert.deepEqual(saved.audit.slice(0, seeded.audit.length), seeded.audit);
  for (const original of seeded.users) {
    const current = saved.users.find((user) => user.id === original.id);
    assert.deepEqual(current.password, original.password);
    assert.equal(current.username, original.username);
    assert.equal(current.role, original.role);
    assert.equal(current.active, original.active);
    assert.equal(current.createdAt, original.createdAt);
    assert.equal(current.permissions.includes("users.manage"), false);
    assert.equal(store.getUser(original.id).auditExempt, false);
    if (original.username === "Regular") {
      assert.equal(current.sessionVersion, original.sessionVersion);
      assert.equal(store.resolveSession(sessions.get(original.id)).id, original.id);
      assert.deepEqual(current.permissions, original.permissions);
    } else {
      assert.equal(current.sessionVersion, original.sessionVersion + 1);
      assert.equal(store.resolveSession(sessions.get(original.id)), null);
      assert.deepEqual(current.permissions, ordinaryPermissions);
    }
    assert.equal(store.authenticate(original.username, password).id, original.id);
  }
  assert.equal(store.resolveSession(unsignedLegacy), null);
  assert.equal(createLiveUserStore(options).resolveSession(sessions.get(legacy.id)), null);
  assert.deepEqual(owner.permissions, ALL_PERMISSION_IDS);
  const afterActivation = fs.readFileSync(store.filePath, "utf8");
  for (const actor of [store.getUser("Jorge"), store.getUser("Diana"), store.getUser(legacy.id)]) {
    assert.throws(() => store.update(actor.id, { permissions: [...ALL_PERMISSION_IDS] }, actor), { statusCode: 403 });
    assert.throws(() => store.update(owner.id, { password: "Stolen-owner-123" }, actor), { statusCode: 403 });
    assert.throws(() => store.create({ username: "Forbidden", password }, actor), { statusCode: 403 });
  }
  assert.equal(fs.readFileSync(store.filePath, "utf8"), afterActivation);
  const jorge = store.getUser("Jorge");
  store.changeOwnPassword(jorge.id, { currentPassword: password, newPassword: "Jorge-new-123" }, jorge);
  assert.equal(store.authenticate("Jorge", "Jorge-new-123").id, jorge.id);
  store.update(jorge.id, { permissions: ["warehouse.read"], password: "Owner-reset-123" }, owner);
  assert.equal(store.authenticate("Jorge", "Owner-reset-123").id, jorge.id);
});

test("existing owner stores mask obsolete management grants at every public boundary without rewriting data on read", (t) => {
  const { options, store, legacy } = fixture(t);
  const owner = store.provisionDeveloperAccount({ password }, legacy);
  const employee = store.create({ username: "Diana", role: "administrador", password }, owner);
  const state = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  state.users.find((user) => user.id === employee.id).permissions = [...ALL_PERMISSION_IDS];
  state.users.find((user) => user.id === legacy.id).active = false;
  fs.writeFileSync(store.filePath, JSON.stringify(state), { mode: 0o600 });
  const before = fs.readFileSync(store.filePath, "utf8");
  const reopened = createLiveUserStore(options);
  const views = [reopened.getUser(employee.id), reopened.authenticate(employee.username, password),
    reopened.resolveSession(signedSession(reopened, employee)), reopened.list().find((user) => user.id === employee.id)];
  for (const user of views) {
    assert.deepEqual(user.permissions, ordinaryPermissions);
    assert.equal(user.canActivateDeveloper, false);
    assert.equal(user.isDeveloper, false);
    assert.equal(user.auditExempt, false);
    assert.equal(hasPermission(user, "users.manage"), false);
  }
  assert.equal(reopened.hasPermission(employee, "users.manage"), false);
  assert.equal(reopened.hasPermission(owner, "users.manage"), true);
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
  assert.throws(() => reopened.create({ username: "Another", password, permissions: [...ALL_PERMISSION_IDS] }, owner), { statusCode: 403 });
  assert.throws(() => reopened.update(employee.id, { permissions: ["users.manage"] }, owner), { statusCode: 403 });
  assert.equal(fs.readFileSync(store.filePath, "utf8"), before);
});

test("a store requires the active original bootstrap account before activation and an active protected owner afterwards", (t) => {
  const { options, store, legacy } = fixture(t);
  let state = seedOrdinaryAdministrators(store);
  state.users[0].active = false;
  fs.writeFileSync(store.filePath, JSON.stringify(state), { mode: 0o600 });
  const invalidBootstrap = fs.readFileSync(store.filePath, "utf8");
  assert.throws(() => createLiveUserStore(options), /no se restablecieron las cuentas/);
  assert.equal(fs.readFileSync(store.filePath, "utf8"), invalidBootstrap);
  state.users[0].active = true;
  state.users[0].permissions = [];
  fs.writeFileSync(store.filePath, JSON.stringify(state), { mode: 0o600 });
  const reopened = createLiveUserStore(options);
  assert.equal(reopened.canActivateDeveloper(legacy), true);
  const owner = reopened.provisionDeveloperAccount({ password }, legacy);
  state = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  state.users.find((user) => user.id === owner.id).active = false;
  fs.writeFileSync(store.filePath, JSON.stringify(state), { mode: 0o600 });
  const invalidOwner = fs.readFileSync(store.filePath, "utf8");
  assert.throws(() => createLiveUserStore(options), /no se restablecieron las cuentas/);
  assert.equal(fs.readFileSync(store.filePath, "utf8"), invalidOwner);
});

test("activation migrates the original Dgiant account without replacing its password or reviving legacy sessions", (t) => {
  const { options, store } = fixture(t);
  const state = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  state.users[0].username = DEVELOPER_USERNAME;
  const previous = state.users[0];
  fs.writeFileSync(store.filePath, JSON.stringify(state), { mode: 0o600 });
  const original = createLiveUserStore(options);
  const before = signedSession(original, previous);
  assert.throws(() => original.provisionDeveloperAccount({ password: "Incorrect-123" }, previous), { statusCode: 401 });
  const owner = original.provisionDeveloperAccount({ password }, previous);
  const saved = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  assert.equal(saved.users.length, 1);
  assert.equal(saved.legacyAdminId, DEVELOPER_USER_ID);
  assert.deepEqual(saved.users[0].password, previous.password);
  assert.equal(owner.sessionVersion, previous.sessionVersion + 1);
  assert.equal(original.resolveSession(before), null);
  assert.equal(original.getUser(previous.id), null);
  const reopened = createLiveUserStore(options);
  assert.equal(reopened.authenticate(DEVELOPER_USERNAME, password).id, DEVELOPER_USER_ID);
  assert.equal(reopened.getUser(owner.id).canActivateDeveloper, false);
});
