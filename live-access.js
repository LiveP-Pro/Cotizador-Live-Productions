(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LiveAccess = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";
  const EQUIPMENT_READ = ["equipment.read", "equipment.write", "equipment.reports", "equipment.catalog"];
  const WAREHOUSE_READ = ["warehouse.read", "warehouse.inventory", "warehouse.movements", "warehouse.movements.manage", "warehouse.logs"];
  const PAGE_PERMISSIONS = Object.freeze({
    cotizador: ["quotes.read", "quotes.write"],
    requerimientos: ["requirements.read", "requirements.write"],
    "requerimiento-equipo": EQUIPMENT_READ,
    "contabilidad-equipo": WAREHOUSE_READ,
    inicio: [], quienes: []
  });
  function isOwner(user) {
    return Boolean(user && user.active !== false && user.isDeveloper === true
      && (user.id || user.userId) === "live-developer-dgiant"
      && String(user.username || (typeof user.user === "string" ? user.user : "")).trim().toLowerCase() === "dgiant");
  }
  const can = (user, permission) => user?.active !== false && Array.isArray(user?.permissions)
    && user.permissions.includes(permission) && (permission !== "users.manage" || isOwner(user));
  const canAny = (user, permissions) => permissions.some((permission) => can(user, permission));
  const any = (...permissions) => permissions.map((permission) => [permission]);

  function routePermissions(method, rawPath) {
    const pathname = String(rawPath || "").split("?")[0];
    const read = method === "GET" || method === "HEAD";
    if (pathname === "/api/inventario-bodega") return read
      ? any(...WAREHOUSE_READ, ...EQUIPMENT_READ)
      : any("warehouse.inventory", "warehouse.movements", "warehouse.movements.manage");
    if (pathname.startsWith("/api/inventario-bodega/")) return [["warehouse.inventory"]];
    if (pathname === "/api/requerimientos-equipo/importar-eventos") return [["equipment.write"]];
    if (pathname === "/api/cuadros-equipo") return [["equipment.reports"]];
    if (pathname === "/api/cuadros-equipo/reportes/provisional") return [["equipment.reports"]];
    if (/^\/api\/cuadros-equipo\/(?:catalogo|fuentes\/[^/]+)$/.test(pathname) && read) return any(...EQUIPMENT_READ);
    if (/^\/api\/cuadros-equipo\/(?:catalogo|servicios-personalizados|importar-servicios|importar-archivo(?:\/[^/]+)?)$/.test(pathname)) return [["equipment.catalog"]];
    if (/^\/api\/cuadros-equipo\/(?:eventos|trasiegos|extras)(?:\/[^/]+)?$/.test(pathname)) return read
      ? any(...EQUIPMENT_READ) : [["equipment.write"]];
    if (/^\/api\/cuadros-equipo\/(?:disponibilidad|plan-logistico)$/.test(pathname)) return any(...EQUIPMENT_READ);
    if (/^\/api\/requerimientos(?:\/|$)/.test(pathname)) return read
      ? any("requirements.read", "requirements.write") : [["requirements.write"]];
    if (/^\/api\/cotizaciones(?:\/|$)/.test(pathname) || pathname === "/api/secuencia") return read
      ? any("quotes.read", "quotes.write") : [["quotes.write"]];
    if (pathname.startsWith("/cotizaciones-generadas/")) return any("quotes.read", "quotes.write");
    if (pathname.startsWith("/cuadros-equipo/")) return [["equipment.reports"]];
    return null;
  }
  function canRoute(user, method, pathname) {
    const alternatives = routePermissions(method, pathname);
    return Boolean(user && alternatives && alternatives.some((permissions) => permissions.every((permission) => can(user, permission))));
  }
  function canPage(user, page) {
    const permissions = PAGE_PERMISSIONS[page];
    return Boolean(permissions && (!permissions.length || canAny(user, permissions)));
  }
  function applyUi(document, user) {
    document.querySelectorAll("[data-live-permission], [data-live-any-permission]").forEach((element) => {
      const required = (element.getAttribute("data-live-permission") || "").split(/\s+/).filter(Boolean);
      const choices = (element.getAttribute("data-live-any-permission") || "").split(/\s+/).filter(Boolean);
      const allowed = (!required.length || required.every(permission => can(user, permission)))
        && (!choices.length || canAny(user, choices));
      element.hidden = !allowed;
      element.setAttribute("aria-hidden", String(!allowed));
    });
    document.querySelectorAll("[data-page-link]").forEach((element) => {
      const allowed = canPage(user, element.dataset.pageLink);
      element.hidden = !allowed;
      element.setAttribute("aria-hidden", String(!allowed));
    });
  }
  return Object.freeze({ can, canAny, canRoute, routePermissions, canPage, applyUi, isOwner, PAGE_PERMISSIONS });
});
