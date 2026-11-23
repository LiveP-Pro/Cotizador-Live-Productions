const assert = require("node:assert/strict");
const test = require("node:test");
const access = require("../live-access.js");

const principal = (...permissions) => ({ id: "synthetic-employee", username: "empleado.sintetico", permissions });
const owner = (...permissions) => ({ id: "live-developer-dgiant", username: "Dgiant", active: true,
  isDeveloper: true, permissions });
const bootstrap = () => ({ id: "synthetic-legacy-admin", username: "legacy.sintetico", active: true,
  canActivateDeveloper: true, permissions: [] });

test("user administration has no web page or route, including for the protected owner", () => {
  const identities = [null, principal(), principal("users.manage"), owner("users.manage"), bootstrap(),
    { ...owner("users.manage"), active: false }];
  const paths = ["/api/users", "/api/users/", "/api/users/bootstrap", "/api/users/developer",
    "/api/users/audit", "/api/users/synthetic-employee", "/api/users/a/b", "/api/account/password"];
  for (const user of identities) {
    assert.equal(access.canPage(user, "usuarios"), false);
    for (const path of paths) {
      for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
        assert.equal(access.routePermissions(method, path), null, `${method} ${path}`);
        assert.equal(access.canRoute(user, method, path), false, `${method} ${path}`);
      }
    }
  }
});

test("the protected owner retains its internal identity without delegating administration to an employee", () => {
  const developer = owner("users.manage");
  assert.equal(access.can(developer, "users.manage"), true);
  for (const impostor of [principal("users.manage"),
    { ...developer, id: "other-user" }, { ...developer, username: "other.user" },
    { ...developer, isDeveloper: false }, { ...developer, active: false }]) {
    assert.equal(access.can(impostor, "users.manage"), false);
  }
});

test("a role name or an empty permission list cannot authorize module APIs", () => {
  const paths = [
    ["GET", "/api/users"],
    ["POST", "/api/users"],
    ["GET", "/api/inventario-bodega"],
    ["PUT", "/api/inventario-bodega"],
    ["GET", "/api/cuadros-equipo/eventos"],
    ["POST", "/api/cuadros-equipo"],
    ["GET", "/api/cotizaciones"],
    ["GET", "/api/requerimientos"]
  ];
  for (const [method, path] of paths) {
    assert.equal(access.canRoute(null, method, path), false, path);
    assert.equal(access.canRoute(principal(), method, path), false, path);
    assert.equal(access.canRoute({ role: "administrador", permissions: [] }, method, path), false, path);
  }
});

test("equipment consultation can read current stock and calculate previews without dispatching or editing", () => {
  const reader = principal("equipment.read");
  for (const [method, path] of [
    ["GET", "/api/inventario-bodega"],
    ["HEAD", "/api/inventario-bodega"],
    ["GET", "/api/cuadros-equipo/catalogo?current=1"],
    ["GET", "/api/cuadros-equipo/fuentes/synthetic-current-file"],
    ["GET", "/api/cuadros-equipo/eventos"],
    ["GET", "/api/cuadros-equipo/trasiegos"],
    ["GET", "/api/cuadros-equipo/extras"],
    ["GET", "/api/cuadros-equipo/disponibilidad"],
    ["POST", "/api/cuadros-equipo/disponibilidad"],
    ["POST", "/api/cuadros-equipo/plan-logistico"]
  ]) assert.equal(access.canRoute(reader, method, path), true, `${method} ${path}`);
  for (const [method, path] of [
    ["PUT", "/api/inventario-bodega"],
    ["POST", "/api/inventario-bodega/ingresos-desde-equipo"],
    ["PUT", "/api/cuadros-equipo/eventos/synthetic-event"],
    ["DELETE", "/api/cuadros-equipo/eventos/synthetic-event"],
    ["PUT", "/api/cuadros-equipo/trasiegos/synthetic-transfer"],
    ["POST", "/api/cuadros-equipo/extras"],
    ["DELETE", "/api/cuadros-equipo/extras/synthetic-extra"],
    ["POST", "/api/requerimientos-equipo/importar-eventos"],
    ["PUT", "/api/cuadros-equipo/catalogo"],
    ["POST", "/api/cuadros-equipo"]
  ]) assert.equal(access.canRoute(reader, method, path), false, `${method} ${path}`);
});

test("a report-only employee can generate and download reports without event or warehouse mutation grants", () => {
  const reporter = principal("equipment.reports");
  assert.equal(access.canPage(reporter, "requerimiento-equipo"), true);
  assert.equal(access.canRoute(reporter, "GET", "/api/inventario-bodega"), true);
  assert.equal(access.canRoute(reporter, "POST", "/api/cuadros-equipo"), true);
  assert.equal(access.canRoute(reporter, "POST", "/api/cuadros-equipo/reportes/provisional"), true);
  assert.equal(access.canRoute(reporter, "GET", "/cuadros-equipo/synthetic-report.pdf"), true);
  assert.equal(access.canRoute(reporter, "PUT", "/api/cuadros-equipo/eventos/event-1"), false);
  assert.equal(access.canRoute(reporter, "PUT", "/api/cuadros-equipo/trasiegos/transfer-1"), false);
  assert.equal(access.canRoute(reporter, "POST", "/api/requerimientos-equipo/importar-eventos"), false);
  assert.equal(access.canRoute(reporter, "PUT", "/api/inventario-bodega"), false);
  assert.equal(access.canRoute(reporter, "POST", "/api/inventario-bodega/ingresos-desde-equipo"), false);
  assert.equal(access.can(reporter, "equipment.write"), false);
  assert.equal(access.can(reporter, "warehouse.movements"), false);
});

test("inventory import permission does not imply managing employees or other employees' movements", () => {
  const inventoryEditor = principal("warehouse.inventory");
  assert.equal(access.canPage(inventoryEditor, "contabilidad-equipo"), true);
  assert.equal(access.canRoute(inventoryEditor, "GET", "/api/inventario-bodega"), true);
  assert.equal(access.canRoute(inventoryEditor, "POST", "/api/inventario-bodega/importar-archivo"), true);
  assert.equal(access.canRoute(inventoryEditor, "POST", "/api/inventario-bodega/restaurar"), true);
  assert.equal(access.canRoute(inventoryEditor, "PUT", "/api/inventario-bodega"), true);
  assert.equal(access.can(inventoryEditor, "warehouse.movements.manage"), false);
  assert.equal(access.can(inventoryEditor, "warehouse.movements"), false);
  assert.equal(access.canRoute(inventoryEditor, "GET", "/api/users"), false);
  assert.equal(access.canRoute(inventoryEditor, "GET", "/api/users/audit"), false);
  assert.equal(access.canRoute(inventoryEditor, "PATCH", "/api/users/employee-1"), false);
  assert.equal(access.canRoute(inventoryEditor, "POST", "/api/cuadros-equipo/importar-archivo"), false);
});

test("own-movement access and log consultation do not grant inventory replacement", () => {
  const mover = principal("warehouse.movements");
  const logReader = principal("warehouse.logs");
  assert.equal(access.canRoute(mover, "GET", "/api/inventario-bodega"), true);
  assert.equal(access.canRoute(mover, "PUT", "/api/inventario-bodega"), true);
  assert.equal(access.can(mover, "warehouse.movements.manage"), false);
  assert.equal(access.canRoute(mover, "POST", "/api/inventario-bodega/importar-archivo"), false);
  assert.equal(access.canRoute(mover, "POST", "/api/inventario-bodega/restaurar"), false);
  assert.equal(access.canRoute(logReader, "GET", "/api/inventario-bodega"), true);
  assert.equal(access.canRoute(logReader, "PUT", "/api/inventario-bodega"), false);
});

test("service-catalog editing and event preparation remain separate capabilities", () => {
  const catalogEditor = principal("equipment.catalog");
  const eventEditor = principal("equipment.write");
  for (const path of ["/api/cuadros-equipo/catalogo", "/api/cuadros-equipo/importar-servicios"]) {
    assert.equal(access.canRoute(catalogEditor, "PUT", path), true, path);
    assert.equal(access.canRoute(eventEditor, "PUT", path), false, path);
  }
  assert.equal(access.canRoute(catalogEditor, "POST", "/api/cuadros-equipo/importar-archivo"), true);
  assert.equal(access.canRoute(catalogEditor, "DELETE", "/api/cuadros-equipo/importar-archivo/synthetic-token"), true);
  assert.equal(access.canRoute(catalogEditor, "POST", "/api/cuadros-equipo/servicios-personalizados"), true);
  assert.equal(access.canRoute(catalogEditor, "PUT", "/api/cuadros-equipo/eventos/event-1"), false);
  assert.equal(access.canRoute(eventEditor, "PUT", "/api/cuadros-equipo/eventos/event-1"), true);
  assert.equal(access.canRoute(eventEditor, "DELETE", "/api/cuadros-equipo/trasiegos/transfer-1"), true);
  assert.equal(access.canRoute(eventEditor, "POST", "/api/requerimientos-equipo/importar-eventos"), true);
  assert.equal(access.canRoute(eventEditor, "POST", "/api/cuadros-equipo"), false);
});

test("read-only quotes and general requirements cannot use save, delete or outbound mutation routes", () => {
  const quotes = principal("quotes.read");
  const requirements = principal("requirements.read");
  for (const path of ["/api/cotizaciones", "/api/cotizaciones/41", "/api/secuencia", "/cotizaciones-generadas/synthetic.pdf"]) {
    assert.equal(access.canRoute(quotes, "GET", path), true, path);
  }
  assert.equal(access.canRoute(quotes, "POST", "/api/cotizaciones"), false);
  assert.equal(access.canRoute(quotes, "DELETE", "/api/cotizaciones/41"), false);
  assert.equal(access.canRoute(quotes, "POST", "/api/cotizaciones/41/whatsapp"), false);
  assert.equal(access.canRoute(requirements, "GET", "/api/requerimientos"), true);
  assert.equal(access.canRoute(requirements, "PATCH", "/api/requerimientos/tareas/41"), false);
  assert.equal(access.canRoute(requirements, "POST", "/api/requerimientos/colaboradores"), false);
  assert.equal(access.canRoute(requirements, "POST", "/api/requerimientos/rescate"), false);
  assert.equal(access.canRoute(quotes, "GET", "/api/requerimientos"), false);
  assert.equal(access.canRoute(requirements, "GET", "/api/cotizaciones"), false);
});

test("unmapped routes and pages fail closed, including for the owner", () => {
  const manager = owner("users.manage");
  for (const path of ["", "/api/unknown", "/api/users/employee-1/unknown", "/api/cuadros-equipo/unknown", "/api/requerimientos-equipo/unknown"]) {
    assert.equal(access.routePermissions("GET", path), null, path);
    assert.equal(access.canRoute(manager, "GET", path), false, path);
  }
  assert.equal(access.canPage(manager, "unknown-module"), false);
  assert.equal(access.canPage(manager, "usuarios"), false);
  assert.equal(access.canPage(principal(), "usuarios"), false);
  assert.equal(access.canPage(principal(), "inicio"), true);
  assert.equal(access.canRoute(null, "POST", "/api/account/password"), false);
  assert.equal(access.canRoute(principal(), "POST", "/api/account/password"), false);
});

test("UI navigation and feature controls follow current permissions and are hidden again on revocation", () => {
  function element(attributes, dataset = {}) {
    return {
      dataset, hidden: false,
      getAttribute(name) { return attributes[name] || null; },
      setAttribute(name, value) { attributes[name] = value; }
    };
  }
  const report = element({ "data-live-permission": "equipment.reports" });
  const edit = element({ "data-live-permission": "equipment.write" });
  const stock = element({ "data-live-any-permission": "warehouse.inventory warehouse.movements" });
  const manageUsers = element({ "data-live-permission": "users.manage" });
  const navEquipment = element({}, { pageLink: "requerimiento-equipo" });
  const navWarehouse = element({}, { pageLink: "contabilidad-equipo" });
  const navUsers = element({}, { pageLink: "usuarios" });
  const navUnknown = element({}, { pageLink: "unknown-module" });
  const controls = [report, edit, stock, manageUsers];
  const links = [navEquipment, navWarehouse, navUsers, navUnknown];
  const document = { querySelectorAll(selector) { return selector === "[data-page-link]" ? links : controls; } };
  access.applyUi(document, principal("equipment.reports"));
  assert.equal(report.hidden, false);
  assert.equal(report.getAttribute("aria-hidden"), "false");
  assert.equal(edit.hidden, true);
  assert.equal(stock.hidden, true);
  assert.equal(navEquipment.hidden, false);
  assert.equal(navWarehouse.hidden, true);
  assert.equal(navUsers.hidden, true);
  assert.equal(navUnknown.hidden, true);
  access.applyUi(document, principal("users.manage", "warehouse.movements"));
  assert.equal(report.hidden, true);
  assert.equal(report.getAttribute("aria-hidden"), "true");
  assert.equal(stock.hidden, false);
  assert.equal(navEquipment.hidden, true);
  assert.equal(navWarehouse.hidden, false);
  assert.equal(navUsers.hidden, true);
  assert.equal(manageUsers.hidden, true);
  access.applyUi(document, owner("users.manage", "warehouse.movements"));
  assert.equal(navUsers.hidden, true);
  assert.equal(manageUsers.hidden, false);
  access.applyUi(document, bootstrap());
  assert.equal(navUsers.hidden, true);
  assert.equal(manageUsers.hidden, true);
  assert.equal(navWarehouse.hidden, true);
  access.applyUi(document, null);
  for (const control of [...controls, ...links]) {
    assert.equal(control.hidden, true);
    assert.equal(control.getAttribute("aria-hidden"), "true");
  }
});
