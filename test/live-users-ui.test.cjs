const assert = require("node:assert/strict");
const test = require("node:test");
const ui = require("../live-users.js");

const definitions = [
  { id: "users.manage", label: "Administrar usuarios", group: "Administración" },
  { id: "warehouse.read", label: "Ver inventario", description: "Consulta de equipos", group: "Bodega" },
  { id: "warehouse.movements", label: "Registrar movimientos", group: "Bodega" }
];
const roles = [
  { id: "administrador", label: "Administrador", permissions: definitions.map((permission) => permission.id) },
  { id: "bodega", label: "Bodega", permissions: ["warehouse.read", "warehouse.movements"] },
  { id: "personalizado", label: "Personalizado", permissions: [] }
];
const adminSession = { authenticated: true, user: "AdminSintetico", permissions: ["users.manage"] };
const user = { id: "employee-1", username: "BodegaSintetica", displayName: "Empleado de prueba", active: true, role: "bodega", permissions: ["warehouse.read", "warehouse.movements"] };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

function containerFixture() {
  const status = { textContent: "", dataset: {}, setAttribute() {} };
  const list = { innerHTML: "" };
  const listeners = new Map();
  const fields = Object.fromEntries(["username", "displayName", "role", "password", "passwordConfirmation", "active"].map((name) => [name, { name, value: "", checked: false, focus() {}, disabled: false }]));
  fields.username.value = "BodegaSintetica";
  fields.displayName.value = "Empleado de prueba";
  fields.role.value = "bodega";
  fields.password.value = fields.passwordConfirmation.value = "Sintetica-clave-25";
  fields.active.checked = true;
  const permissions = definitions.map((definition) => ({ name: "permissions", value: definition.id, checked: definition.id !== "users.manage", disabled: false }));
  const form = {
    querySelector(selector) { return fields[selector.match(/name="([^"]+)"/)?.[1]] || null; },
    querySelectorAll(selector) { return selector.includes(":checked") ? permissions.filter((permission) => permission.checked) : permissions; }
  };
  const container = {
    innerHTML: "", attributes: {},
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name) { listeners.delete(name); },
    setAttribute(name, value) { this.attributes[name] = value; },
    querySelector(selector) {
      if (selector === "[data-users-status]") return status;
      if (selector === "[data-users-list]") return list;
      if (selector === "[data-users-form]") return form;
      if (selector === "[data-users-developer-form]") return this.innerHTML.includes("data-users-developer-form") ? form : null;
      return form.querySelector(selector);
    },
    querySelectorAll() { return [...Object.values(fields), ...permissions]; }
  };
  return { container, status, fields, permissions, listeners };
}

test("administration requires an authenticated explicit permission; a role name does not grant access", () => {
  assert.equal(ui.canManageUsers(adminSession), true);
  assert.equal(ui.canManageUsers({ authenticated: false, permissions: ["users.manage"] }), false);
  assert.equal(ui.canManageUsers({ authenticated: true, role: "administrador", permissions: ["warehouse.read"] }), false);
  assert.equal(ui.canManageUsers({ authenticated: true, user: { permissions: ["users.manage"] } }), true);
});

test("public user state and rendered administration never expose hashes, salts or password values", () => {
  const privateUser = { ...user, password: "SECRET_VALUE", passwordHash: "SECRET_HASH", salt: "SECRET_SALT", sessionVersion: 9 };
  const visible = ui.publicUser(privateUser);
  const html = ui.render([privateUser], ui.normalizeCatalog({ permissions: definitions, roles }), user.id);
  for (const secret of ["SECRET_VALUE", "SECRET_HASH", "SECRET_SALT"]) {
    assert.equal(JSON.stringify(visible).includes(secret), false);
    assert.equal(html.includes(secret), false);
  }
  assert.equal(Object.hasOwn(visible, "sessionVersion"), false);
  assert.match(html, /autocomplete="new-password"/);
  assert.match(html, /name="username"[^>]+readonly/);
});

test("all untrusted employee names, identifiers, permissions and group labels are escaped", () => {
  const malicious = '<img src=x onerror="bad()">';
  const catalog = ui.normalizeCatalog({ permissions: [{ id: malicious, label: malicious, description: malicious, group: malicious }], roles: [{ id: "personalizado", label: malicious, permissions: [] }] });
  const html = ui.render([{ ...user, id: malicious, displayName: malicious, username: malicious, permissions: [malicious] }], catalog, malicious);
  assert.ok(!html.includes(malicious));
  assert.match(html, /&lt;img/);
  assert.match(html, /&quot;/);
});

test("creation requires confirmed passwords while editing can preserve a password and remove all permissions", () => {
  const catalog = ui.normalizeCatalog({ permissions: definitions, roles });
  const values = { username: user.username, displayName: user.displayName, role: "bodega", active: true, permissions: user.permissions, password: "Sintetica-clave-25", passwordConfirmation: "Sintetica-clave-25" };
  assert.deepEqual(ui.createPayload(values, catalog), { username: user.username, displayName: user.displayName, role: "bodega", active: true, permissions: user.permissions, password: "Sintetica-clave-25" });
  assert.throws(() => ui.createPayload({ ...values, password: "1234567", passwordConfirmation: "1234567" }, catalog), /8 y 256/);
  assert.equal(ui.createPayload({ ...values, password: "A1-b2_C3", passwordConfirmation: "A1-b2_C3" }, catalog).password, "A1-b2_C3");
  assert.throws(() => ui.createPayload({ ...values, username: "no es usuario" }, catalog), /3 y 80/);
  assert.throws(() => ui.createPayload({ ...values, displayName: "x".repeat(121) }, catalog), /120 caracteres/);
  assert.throws(() => ui.createPayload({ ...values, passwordConfirmation: "Diferente-clave-25" }, catalog), /no coinciden/);
  assert.throws(() => ui.createPayload({ ...values, permissions: ["invented.admin"] }, catalog), /ya no están disponibles/);
  assert.deepEqual(ui.createPayload({ ...values, role: "personalizado", permissions: [], password: "", passwordConfirmation: "", active: false }, catalog, true), { displayName: user.displayName, role: "personalizado", permissions: [], active: false });
});

test("a denied session cannot fetch users or submit mutations", async () => {
  const fixture = containerFixture(); let requests = 0;
  const controller = ui.init({ container: fixture.container, session: { authenticated: true, permissions: ["warehouse.read"] }, fetch: async () => { requests += 1; } });
  assert.equal(await controller.load(), false);
  assert.equal(await controller.save(), false);
  assert.equal(requests, 0);
  assert.match(fixture.container.innerHTML, /no tiene permiso/);
  controller.destroy();
});

test("one creation is sent while a save is pending and the server-confirmed user becomes an edit", async () => {
  const fixture = containerFixture(); const calls = []; let resolveSave; let savedCalls = 0;
  const controller = ui.init({ container: fixture.container, session: adminSession, onSaved: () => { savedCalls += 1; }, fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === "GET") return response({ users: [], permissions: definitions, roles });
    return new Promise((resolve) => { resolveSave = resolve; });
  } });
  assert.equal(await controller.load(), true);
  const first = controller.save();
  assert.equal(await controller.save(), false);
  assert.equal(controller.getState().busy, true);
  assert.equal(fixture.container.attributes["aria-busy"], "true");
  resolveSave(response({ user: { ...user, passwordHash: "NEVER_EXPOSE" } }));
  assert.equal(await first, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].credentials, "same-origin");
  assert.deepEqual(JSON.parse(calls[1].body).permissions, user.permissions);
  assert.equal(controller.getState().selectedId, user.id);
  assert.equal(controller.getState().busy, false);
  assert.equal(JSON.stringify(controller.getState()).includes("NEVER_EXPOSE"), false);
  assert.equal(JSON.stringify(controller.getState()).includes("Sintetica-clave-25"), false);
  assert.equal(savedCalls, 1);
  assert.match(fixture.container.innerHTML, /name="password"[^>]+autocomplete="new-password"/);
  controller.destroy();
});

test("session revocation discards a pending user response and prevents further writes", async () => {
  const fixture = containerFixture(); let resolveLoad; let calls = 0;
  const controller = ui.init({ container: fixture.container, session: adminSession, fetch: async () => { calls += 1; return new Promise((resolve) => { resolveLoad = resolve; }); } });
  const loading = controller.load();
  controller.setSession({ authenticated: false });
  resolveLoad(response({ users: [user], permissions: definitions, roles }));
  assert.equal(await loading, false);
  assert.deepEqual(controller.getState().users, []);
  assert.equal(await controller.save(), false);
  assert.equal(calls, 1);
  assert.match(fixture.container.innerHTML, /no tiene permiso/);
  controller.destroy();
});

test("server errors remain visible and a failed save can be retried without stale busy state", async () => {
  const fixture = containerFixture(); let writes = 0;
  const controller = ui.init({ container: fixture.container, session: adminSession, fetch: async (_url, options) => {
    if (options.method === "GET") return response({ users: [], permissions: definitions, roles });
    writes += 1;
    return writes === 1 ? response({ error: "Ese usuario ya existe." }, 409) : response({ user });
  } });
  await controller.load();
  assert.equal(await controller.save(), false);
  assert.equal(fixture.status.textContent, "Ese usuario ya existe.");
  assert.equal(controller.getState().busy, false);
  assert.equal(await controller.save(), true);
  assert.equal(writes, 2);
  controller.destroy();
});

test("templates select only their explicit permissions and manual edits switch to a custom template", async () => {
  const fixture = containerFixture();
  const controller = ui.init({ container: fixture.container, session: adminSession, fetch: async () => response({ users: [], permissions: definitions, roles }) });
  await controller.load();
  fixture.fields.role.value = "bodega";
  fixture.listeners.get("change")({ target: fixture.fields.role });
  assert.deepEqual(fixture.permissions.filter((permission) => permission.checked).map((permission) => permission.value), user.permissions);
  fixture.fields.role.value = "administrador";
  fixture.permissions[0].checked = false;
  fixture.listeners.get("change")({ target: fixture.permissions[0] });
  assert.equal(fixture.fields.role.value, "personalizado");
  controller.destroy();
});

const developer = {
  id: "live-developer-dgiant", username: "Dgiant", displayName: "Desarrollador de prueba", role: "administrador",
  active: true, permissions: definitions.map((permission) => permission.id), isDeveloper: true, auditExempt: true
};

test("the protected developer badge comes from server metadata and offers no transferable audit exemption", () => {
  const catalog = ui.normalizeCatalog({ permissions: definitions, roles });
  const html = ui.render([developer], catalog, developer.id, "", { ...adminSession, userId: "another-admin" });
  assert.match(html, /is-developer">Desarrollador/);
  assert.match(html, /Solo su titular puede actualizar su nombre y contraseña/);
  assert.match(html, /class="live-users-form-fields" disabled data-users-locked="true"/);
  assert.doesNotMatch(html, /type="submit"/);
  assert.doesNotMatch(html, /type="password"/);
  assert.doesNotMatch(html, /name="(?:isDeveloper|auditExempt)"/);
  const ordinary = ui.render([{ ...user, username: "Dgiant" }], catalog, user.id, "", adminSession);
  assert.doesNotMatch(ordinary, /is-developer/);
  assert.equal(ui.publicUser(developer).isDeveloper, true);
  assert.equal(ui.publicUser({ ...user, isDeveloper: "true" }).isDeveloper, false);
});

test("another administrator cannot submit changes to the protected developer even through a programmatic save", async () => {
  const fixture = containerFixture(); let requests = 0;
  const controller = ui.init({ container: fixture.container, session: { ...adminSession, userId: "another-admin" }, fetch: async () => {
    requests += 1;
    return response({ users: [developer], permissions: definitions, roles });
  } });
  await controller.load();
  fixture.listeners.get("click")({ target: { closest: () => ({ dataset: { usersSelect: developer.id } }) } });
  assert.equal(controller.getState().selectedId, developer.id);
  assert.equal(await controller.save(), false);
  assert.equal(requests, 1);
  assert.match(fixture.status.textContent, /Solo el titular/);
  controller.destroy();
});

test("the developer can update their own name and password while fixed profile fields never enter the PATCH", async () => {
  const fixture = containerFixture(); const calls = [];
  fixture.fields.displayName.value = "Nombre sintético actualizado";
  fixture.fields.role.dataset = { usersLocked: "true" };
  const controller = ui.init({ container: fixture.container, session: { ...adminSession, userId: developer.id }, fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === "GET") return response({ users: [developer], permissions: definitions, roles });
    return response({ user: { ...developer, displayName: "Nombre sintético actualizado" } });
  } });
  await controller.load();
  fixture.listeners.get("click")({ target: { closest: () => ({ dataset: { usersSelect: developer.id } }) } });
  assert.equal(fixture.fields.role.disabled, true);
  assert.match(fixture.container.innerHTML, /Puede actualizar su nombre y contraseña/);
  assert.match(fixture.container.innerHTML, /name="role" disabled data-users-locked="true"/);
  assert.match(fixture.container.innerHTML, /type="submit"/);
  assert.equal(await controller.save(), true);
  assert.equal(calls[1].method, "PATCH");
  assert.equal(calls[1].url, "/api/users/live-developer-dgiant");
  assert.deepEqual(JSON.parse(calls[1].body), { displayName: "Nombre sintético actualizado", password: "Sintetica-clave-25" });
  assert.equal(fixture.fields.role.disabled, true);
  controller.destroy();
});

function clickAction(fixture, action) {
  fixture.listeners.get("click")({ target: { closest: () => ({ dataset: { usersAction: action } }) } });
}

test("developer activation is explicit, permission-gated, and available only while the protected account is absent", async () => {
  const catalog = ui.normalizeCatalog({ permissions: definitions, roles });
  assert.match(ui.render([], catalog, "", "", adminSession), /data-users-action="activate-developer"/);
  assert.doesNotMatch(ui.render([], catalog, "", "", { authenticated: true, permissions: [] }), /data-users-action="activate-developer"/);
  assert.doesNotMatch(ui.render([developer], catalog, "", "", adminSession, true), /data-users-(?:action="activate-developer"|developer-form)/);
  assert.doesNotMatch(ui.render([], { ...catalog, permissions: [] }, "", "", adminSession), /data-users-action="activate-developer"/);
  const fixture = containerFixture(); const calls = [];
  const controller = ui.init({ container: fixture.container, session: adminSession, fetch: async (url, options) => {
    calls.push({ url, ...options });
    return response({ users: [], permissions: definitions, roles });
  } });
  assert.equal(await controller.activateDeveloper(), false);
  assert.equal(calls.length, 0);
  await controller.load();
  clickAction(fixture, "activate-developer");
  assert.equal(calls.length, 1);
  assert.equal(controller.getState().activatingDeveloper, true);
  assert.match(fixture.container.innerHTML, /name="username"[^>]+value="Dgiant" readonly/);
  assert.match(fixture.container.innerHTML, /Nombre \(opcional\)/);
  assert.match(fixture.container.innerHTML, /Confirmar activación de Dgiant/);
  for (const passwordInput of fixture.container.innerHTML.matchAll(/<input[^>]+type="password"[^>]*>/g)) {
    assert.doesNotMatch(passwordInput[0], /\bvalue=/);
    assert.match(passwordInput[0], /minlength="8" maxlength="256"/);
  }
  assert.equal(await controller.save(), false);
  assert.equal(calls.length, 1);
  clickAction(fixture, "cancel-developer");
  assert.equal(controller.getState().activatingDeveloper, false);
  assert.doesNotMatch(fixture.container.innerHTML, /data-users-developer-form/);
  assert.equal(await controller.activateDeveloper(), false);
  controller.setSession({ authenticated: true, permissions: [] });
  clickAction(fixture, "activate-developer");
  assert.equal(await controller.activateDeveloper(), false);
  assert.equal(calls.length, 1);
  controller.destroy();
});

test("activation payload fixes the identity and validates the optional name plus confirmed password boundaries", () => {
  const values = { username: "Ignored.synthetic", displayName: "", password: "Test-123", passwordConfirmation: "Test-123", permissions: ["users.manage"], isDeveloper: true };
  assert.deepEqual(ui.createDeveloperPayload(values), { username: "Dgiant", displayName: "Dgiant", password: "Test-123" });
  assert.deepEqual(ui.createDeveloperPayload({ ...values, displayName: "  Nombre sintético  " }), { username: "Dgiant", displayName: "Nombre sintético", password: "Test-123" });
  for (const password of ["1234567", "x".repeat(257)]) {
    assert.throws(() => ui.createDeveloperPayload({ ...values, password, passwordConfirmation: password }), /8 y 256/);
  }
  assert.equal(ui.createDeveloperPayload({ ...values, password: "x".repeat(256), passwordConfirmation: "x".repeat(256) }).password.length, 256);
  assert.throws(() => ui.createDeveloperPayload({ ...values, password: "", passwordConfirmation: "" }), /Escriba la contraseña/);
  assert.throws(() => ui.createDeveloperPayload({ ...values, passwordConfirmation: "Different-test" }), /no coinciden/);
  assert.throws(() => ui.createDeveloperPayload({ ...values, displayName: "x".repeat(121) }), /120 caracteres/);
  assert.throws(() => ui.createDeveloperPayload({ ...values, displayName: "Nombre\ncontrol" }), /caracteres de control/);
});

test("one explicit activation POST sends only the supported fields, clears passwords, and refreshes the protected user", async () => {
  const fixture = containerFixture(); const calls = []; let resolveActivation; let savedCalls = 0; let activated = false;
  const controller = ui.init({ container: fixture.container, session: adminSession, onSaved: () => { savedCalls += 1; }, fetch: async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === "GET") return response({ users: activated ? [developer] : [], permissions: definitions, roles });
    return new Promise((resolve) => { resolveActivation = resolve; });
  } });
  await controller.load();
  clickAction(fixture, "activate-developer");
  fixture.fields.username.value = "tampered.synthetic";
  fixture.fields.displayName.value = "  ";
  fixture.fields.password.value = fixture.fields.passwordConfirmation.value = "Activation-test-123";
  const pending = controller.activateDeveloper();
  assert.equal(await controller.activateDeveloper(), false);
  assert.equal(controller.getState().busy, true);
  assert.equal(fixture.fields.password.value, "");
  assert.equal(fixture.fields.passwordConfirmation.value, "");
  assert.equal(JSON.stringify(controller.getState()).includes("Activation-test-123"), false);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "/api/users/developer");
  assert.equal(calls[1].method, "POST");
  assert.equal(calls[1].credentials, "same-origin");
  assert.deepEqual(JSON.parse(calls[1].body), { username: "Dgiant", displayName: "Dgiant", password: "Activation-test-123" });
  activated = true;
  resolveActivation(response({ user: { ...developer, password: "NEVER_SHOW_ACTIVATION_PASSWORD" } }, 201));
  assert.equal(await pending, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[2].url, "/api/users");
  assert.equal(calls[2].method, "GET");
  assert.equal(savedCalls, 1);
  assert.deepEqual(controller.getState().users, [ui.publicUser(developer)]);
  assert.equal(controller.getState().selectedId, developer.id);
  assert.equal(controller.getState().busy, false);
  assert.equal(controller.getState().activatingDeveloper, false);
  assert.match(fixture.status.textContent, /activada\. Cierre sesión e ingrese como Dgiant/);
  assert.doesNotMatch(fixture.container.innerHTML, /data-users-action="activate-developer"|data-users-developer-form|Activation-test-123|NEVER_SHOW_ACTIVATION_PASSWORD/);
  assert.equal(await controller.activateDeveloper(), false);
  controller.destroy();
});

test("legacy activation requires the current password, keeps API errors visible, and can be retried", async () => {
  const fixture = containerFixture(); let writes = 0; let unauthorizedCalls = 0; let activated = false;
  const legacy = { ...user, username: "dGiAnT" };
  const controller = ui.init({ container: fixture.container, session: adminSession, onUnauthorized: () => { unauthorizedCalls += 1; }, fetch: async (_url, options) => {
    if (options.method === "GET") return response({ users: activated ? [developer] : [legacy], permissions: definitions, roles });
    writes += 1;
    if (writes === 1) return response({ error: "Confirme la contraseña actual del propietario para migrar su cuenta existente." }, 401);
    activated = true;
    return response({ user: developer }, 201);
  } });
  await controller.load();
  clickAction(fixture, "activate-developer");
  assert.match(fixture.container.innerHTML, /Ya existe el usuario Dgiant/);
  assert.match(fixture.container.innerHTML, /contraseña actual para migrar/);
  assert.match(fixture.container.innerHTML, /autocomplete="current-password"/);
  fixture.fields.password.value = fixture.fields.passwordConfirmation.value = "Wrong-test-123";
  assert.equal(await controller.activateDeveloper(), false);
  assert.match(fixture.status.textContent, /Confirme la contraseña actual/);
  assert.equal(unauthorizedCalls, 0);
  assert.equal(controller.getState().busy, false);
  assert.equal(controller.getState().activatingDeveloper, true);
  assert.equal(fixture.fields.password.value, "");
  fixture.fields.password.value = fixture.fields.passwordConfirmation.value = "Current-test-123";
  assert.equal(await controller.activateDeveloper(), true);
  assert.equal(writes, 2);
  assert.deepEqual(controller.getState().users, [ui.publicUser(developer)]);
  controller.destroy();
});

test("invalid activation never writes and revoked sessions discard pending activation responses", async () => {
  const fixture = containerFixture(); let writes = 0; let resolveActivation;
  const controller = ui.init({ container: fixture.container, session: adminSession, fetch: async (_url, options) => {
    if (options.method === "GET") return response({ users: [], permissions: definitions, roles });
    writes += 1;
    return new Promise((resolve) => { resolveActivation = resolve; });
  } });
  await controller.load();
  clickAction(fixture, "activate-developer");
  fixture.fields.password.value = "Valid-test-123";
  fixture.fields.passwordConfirmation.value = "Other-test-123";
  assert.equal(await controller.activateDeveloper(), false);
  assert.match(fixture.status.textContent, /no coinciden/);
  assert.equal(writes, 0);
  assert.equal(fixture.fields.password.value, "");
  fixture.fields.password.value = fixture.fields.passwordConfirmation.value = "Valid-test-123";
  const pending = controller.activateDeveloper();
  controller.setSession({ authenticated: false });
  resolveActivation(response({ user: developer }, 201));
  assert.equal(await pending, false);
  assert.equal(writes, 1);
  assert.deepEqual(controller.getState().users, []);
  assert.equal(controller.getState().busy, false);
  assert.doesNotMatch(fixture.container.innerHTML, /Dgiant|Valid-test-123/);
  controller.destroy();
});
