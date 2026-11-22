(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LiveUsers = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  const instances = new WeakMap();
  const string = (value) => value === undefined || value === null ? "" : String(value);
  const escape = (value) => string(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const permissionIds = (values) => [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string"))];

  function canManageUsers(session) {
    return session?.authenticated === true && permissionIds(session.permissions || session.user?.permissions).includes("users.manage");
  }

  function publicUser(user) {
    return {
      id: string(user?.id), username: string(user?.username), displayName: string(user?.displayName),
      role: string(user?.role || "personalizado"), active: user?.active !== false,
      permissions: permissionIds(user?.permissions), createdAt: string(user?.createdAt), updatedAt: string(user?.updatedAt),
      isDeveloper: user?.isDeveloper === true, auditExempt: user?.auditExempt === true
    };
  }

  function ownsDeveloperProfile(session, user) {
    const id = string(session?.userId || session?.id || session?.user?.id);
    return user?.isDeveloper === true && !!id && id === string(user.id);
  }

  function normalizeCatalog(payload) {
    const ids = new Set();
    const permissions = (Array.isArray(payload?.permissions) ? payload.permissions : []).flatMap((permission) => {
      const id = string(permission?.id);
      if (!id || ids.has(id)) return [];
      ids.add(id);
      return [{ id, label: string(permission.label || id), description: string(permission.description), group: string(permission.group || "Accesos") }];
    });
    const roleIds = new Set();
    const roles = (Array.isArray(payload?.roles) ? payload.roles : []).flatMap((role) => {
      const id = string(role?.id);
      if (!id || roleIds.has(id)) return [];
      roleIds.add(id);
      return [{ id, label: string(role.label || id), permissions: permissionIds(role.permissions).filter((value) => ids.has(value)) }];
    });
    if (!roleIds.has("personalizado")) roles.push({ id: "personalizado", label: "Personalizado", permissions: [] });
    return { permissions, roles };
  }

  function createPayload(values, catalog, editing = false) {
    const username = string(values?.username).trim();
    const displayName = string(values?.displayName).trim();
    const password = string(values?.password);
    const confirmation = string(values?.passwordConfirmation);
    const allowed = new Set((catalog?.permissions || []).map((permission) => permission.id));
    const permissions = permissionIds(values?.permissions);
    if (!editing && !username) throw new Error("Escriba el usuario con el que iniciará sesión.");
    if (!editing && !/^[a-z0-9_.@-]{3,80}$/i.test(username)) throw new Error("El usuario debe tener entre 3 y 80 letras, números, puntos, guiones o el signo @.");
    if (!displayName) throw new Error("Escriba el nombre del empleado.");
    if (displayName.length > 120 || /[\u0000-\u001f\u007f]/.test(displayName)) throw new Error("El nombre debe tener hasta 120 caracteres y no incluir caracteres de control.");
    if (!editing && !password) throw new Error("Escriba una contraseña para el nuevo usuario.");
    if (password && (password.length < 8 || password.length > 256)) throw new Error("La contraseña debe tener entre 8 y 256 caracteres.");
    if (password !== confirmation) throw new Error("Las contraseñas no coinciden.");
    if (!allowed.size) throw new Error("Actualice la lista de permisos antes de guardar.");
    if (permissions.some((id) => !allowed.has(id))) throw new Error("Hay permisos que ya no están disponibles. Actualice la lista.");
    const role = string(values?.role || "personalizado");
    if (!(catalog?.roles || []).some((item) => item.id === role)) throw new Error("Elija una plantilla de permisos disponible.");
    return {
      ...(!editing ? { username } : {}), displayName, active: values?.active !== false, role, permissions,
      ...(password ? { password } : {})
    };
  }

  function renderPermissions(catalog, selected, locked = false) {
    const groups = new Map();
    const chosen = new Set(permissionIds(selected));
    for (const permission of catalog.permissions) {
      if (!groups.has(permission.group)) groups.set(permission.group, []);
      groups.get(permission.group).push(permission);
    }
    return [...groups].map(([group, permissions]) => `<fieldset class="live-users-permission-group"><legend>${escape(group)}</legend>${permissions.map((permission) => `<label class="live-users-check"><input type="checkbox" name="permissions" value="${escape(permission.id)}"${chosen.has(permission.id) ? " checked" : ""}${locked ? ' disabled data-users-locked="true"' : ""}><span><strong>${escape(permission.label)}</strong>${permission.description ? `<small>${escape(permission.description)}</small>` : ""}</span></label>`).join("")}</fieldset>`).join("");
  }

  function renderForm(user, catalog, session) {
    const editing = !!user;
    const draft = user || { username: "", displayName: "", role: "personalizado", active: true, permissions: [] };
    const selectedRole = catalog.roles.some((role) => role.id === draft.role) ? draft.role : "personalizado";
    const developer = draft.isDeveloper === true;
    const protectedProfile = developer && !ownsDeveloperProfile(session, draft);
    const lock = developer ? ' disabled data-users-locked="true"' : "";
    const notice = developer ? `<p class="live-users-protected"><span class="live-users-badge is-developer">Desarrollador</span><span>Cuenta de desarrollador protegida. ${protectedProfile ? "Solo su titular puede actualizar su nombre y contraseña." : "Puede actualizar su nombre y contraseña. El perfil conserva todos los accesos."}</span></p>` : "";
    return `<form class="live-users-form" data-users-form novalidate>${notice}<fieldset class="live-users-form-fields"${protectedProfile ? ' disabled data-users-locked="true"' : ""}><legend>${protectedProfile ? "Consultar perfil" : editing ? "Editar empleado" : "Crear usuario"}</legend>
      <div class="live-users-fields"><label>Nombre del empleado<input name="displayName" type="text" autocomplete="off" maxlength="120" required value="${escape(draft.displayName)}"></label>
      <label>Usuario para iniciar sesión<input name="username" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" minlength="3" maxlength="80" required value="${escape(draft.username)}"${editing ? " readonly" : ""}></label>
      <label>Plantilla de permisos<select name="role"${lock}>${catalog.roles.map((role) => `<option value="${escape(role.id)}"${role.id === selectedRole ? " selected" : ""}>${escape(role.label)}</option>`).join("")}</select></label>
      <label class="live-users-check live-users-active"><input name="active" type="checkbox"${draft.active ? " checked" : ""}${lock}><span><strong>Usuario activo</strong><small>Solo los usuarios activos pueden iniciar sesión.</small></span></label></div>
      <p class="live-users-hint">${developer ? "Los accesos de este perfil están protegidos." : "Seleccione una plantilla o ajuste cada permiso. Cada empleado debe usar su propio usuario para identificar sus movimientos y bitácoras."}</p>
      <div class="live-users-permissions">${renderPermissions(catalog, draft.permissions, developer)}</div>
      ${protectedProfile ? "" : `<section class="live-users-password"><h3>${editing ? "Cambiar contraseña" : "Contraseña inicial"}</h3><p class="live-users-hint">${editing ? "Deje ambos campos vacíos para conservar la contraseña actual. Cambiar la contraseña o los permisos cierra las sesiones anteriores de este usuario." : "Establezca una contraseña de al menos 8 caracteres y entréguela directamente al empleado."}</p>
      <div class="live-users-fields"><label>${editing ? "Nueva contraseña" : "Contraseña"}<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="256"${editing ? "" : " required"}></label>
      <label>Confirmar contraseña<input name="passwordConfirmation" type="password" autocomplete="new-password" minlength="8" maxlength="256"${editing ? "" : " required"}></label></div></section>
      <button type="submit" class="live-users-primary">${editing ? "Guardar cambios" : "Crear usuario"}</button>`}</fieldset></form>`;
  }

  function renderUserList(users, selectedId, query = "") {
    const text = string(query).trim().toLocaleLowerCase("es-GT");
    const filtered = users.filter((user) => `${user.displayName} ${user.username}`.toLocaleLowerCase("es-GT").includes(text));
    if (!filtered.length) return '<p class="live-users-empty">No se encontraron usuarios.</p>';
    return filtered.map((user) => `<button type="button" class="live-users-person${user.id === selectedId ? " is-selected" : ""}" data-users-select="${escape(user.id)}" aria-pressed="${user.id === selectedId}"><span><strong>${escape(user.displayName || user.username)}</strong><small>${escape(user.username)}</small>${user.isDeveloper === true ? '<span class="live-users-badge is-developer">Desarrollador</span>' : ""}</span><span class="live-users-badge${user.active ? "" : " is-inactive"}">${user.active ? "Activo" : "Inactivo"}</span></button>`).join("");
  }

  function render(users, catalog, selectedId, query = "", session = {}) {
    const selected = users.find((user) => user.id === selectedId);
    return `<section class="live-users"><header class="live-users-header"><div><p class="live-users-eyebrow">Administración</p><h2>Usuarios y permisos</h2><p>Cree accesos individuales y defina qué puede hacer cada empleado.</p></div><button type="button" data-users-action="refresh">Actualizar lista</button></header>
      <p class="live-users-status" data-users-status role="status" aria-live="polite"></p>
      <div class="live-users-layout"><aside class="live-users-sidebar" aria-label="Empleados"><button type="button" class="live-users-primary" data-users-action="new">+ Crear usuario</button><label>Buscar empleado<input data-users-search type="search" autocomplete="off" value="${escape(query)}" placeholder="Nombre o usuario"></label><div data-users-list>${renderUserList(users, selectedId, query)}</div></aside><div class="live-users-editor">${renderForm(selected, catalog, session)}</div></div></section>`;
  }

  // The host supplies the session returned by /api/session and refreshes it in
  // onSaved if the signed-in administrator changes their own access.
  function init(options = {}) {
    const container = options.container;
    if (!container?.addEventListener || !container?.querySelector) return null;
    if (instances.has(container)) return instances.get(container);
    const fetcher = options.fetch || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
    let session = clone(options.session || {});
    let users = [], catalog = { permissions: [], roles: [{ id: "personalizado", label: "Personalizado", permissions: [] }] };
    let selectedId = "", query = "", busy = false, loading = false, destroyed = false, generation = 0;

    function status(message, error = false) {
      const element = container.querySelector("[data-users-status]");
      if (!element) return;
      element.textContent = message;
      element.dataset.error = String(error);
      element.setAttribute("role", error ? "alert" : "status");
    }

    function updateBusy() {
      const disabled = busy || loading;
      container.setAttribute("aria-busy", String(disabled));
      container.querySelectorAll("button,input,select,fieldset.live-users-form-fields").forEach((element) => { element.disabled = disabled || element.dataset?.usersLocked === "true"; });
    }

    function draw() {
      if (destroyed) return;
      if (!canManageUsers(session)) {
        container.innerHTML = '<section class="live-users"><p class="live-users-status" data-users-status role="status">Su usuario no tiene permiso para administrar usuarios.</p></section>';
      } else container.innerHTML = render(users, catalog, selectedId, query, session);
      updateBusy();
    }

    async function request(method, url, body) {
      if (!fetcher) throw new Error("No se pudo conectar con el servidor.");
      const response = await fetcher(url, {
        method, credentials: "same-origin", cache: "no-store",
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && typeof options.onUnauthorized === "function") options.onUnauthorized();
        throw new Error(result.error || "No se pudo completar la operación. Vuelva a intentarlo.");
      }
      return result;
    }

    async function load() {
      if (destroyed || busy || loading || !canManageUsers(session)) return false;
      const current = ++generation;
      loading = true;
      updateBusy();
      status("Cargando usuarios…");
      try {
        const result = await request("GET", "/api/users");
        if (destroyed || current !== generation || !canManageUsers(session)) return false;
        const nextCatalog = normalizeCatalog(result);
        if (!nextCatalog.permissions.length || !Array.isArray(result.users)) throw new Error("No se recibió la lista completa de usuarios y permisos. Actualice la lista.");
        users = result.users.map(publicUser);
        catalog = nextCatalog;
        if (!users.some((user) => user.id === selectedId)) selectedId = "";
        loading = false;
        draw();
        status(`${users.length} ${users.length === 1 ? "usuario registrado" : "usuarios registrados"}.`);
        return true;
      } catch (error) {
        if (!destroyed && current === generation) status(error.message, true);
        return false;
      } finally {
        if (current === generation) { loading = false; updateBusy(); }
      }
    }

    function formValues() {
      const form = container.querySelector("[data-users-form]");
      if (!form) return null;
      const value = (name) => form.querySelector(`[name="${name}"]`)?.value || "";
      return {
        username: value("username"), displayName: value("displayName"), role: value("role"),
        active: form.querySelector('[name="active"]')?.checked === true,
        permissions: [...form.querySelectorAll('[name="permissions"]:checked')].map((input) => input.value),
        password: value("password"), passwordConfirmation: value("passwordConfirmation")
      };
    }

    async function save() {
      if (destroyed || busy || loading || !canManageUsers(session)) return false;
      const selected = users.find((user) => user.id === selectedId);
      if (selected?.isDeveloper && !ownsDeveloperProfile(session, selected)) {
        status("Solo el titular de la cuenta de desarrollador puede cambiar su nombre o contraseña.", true);
        return false;
      }
      let payload;
      try { payload = createPayload(formValues(), catalog, !!selectedId); }
      catch (error) { status(error.message, true); return false; }
      if (selected?.isDeveloper) payload = { displayName: payload.displayName, ...(payload.password ? { password: payload.password } : {}) };
      const current = ++generation;
      const editingId = selectedId;
      busy = true;
      updateBusy();
      status(editingId ? "Guardando cambios…" : "Creando usuario…");
      try {
        const result = await request(editingId ? "PATCH" : "POST", `/api/users${editingId ? "/" + encodeURIComponent(editingId) : ""}`, payload);
        if (destroyed || current !== generation || !canManageUsers(session)) return false;
        const user = publicUser(result.user || result);
        if (!user.id || !user.username) throw new Error("El servidor no confirmó el usuario guardado. Actualice la lista antes de volver a intentarlo.");
        users = users.filter((item) => item.id !== user.id).concat(user).sort((a, b) => a.displayName.localeCompare(b.displayName, "es-GT"));
        selectedId = user.id;
        busy = false;
        draw();
        status(editingId ? "Cambios guardados. Los próximos movimientos usarán los permisos actuales." : "Usuario creado. El empleado ya puede iniciar sesión con su acceso.");
        if (typeof options.onSaved === "function") {
          try { await options.onSaved({ ...result, user }); }
          catch { status("El usuario quedó guardado. Actualice la página para comprobar su sesión actual.", true); }
        }
        return true;
      } catch (error) {
        if (!destroyed && current === generation) status(error.message, true);
        return false;
      } finally {
        if (current === generation) { busy = false; updateBusy(); }
      }
    }

    function click(event) {
      const button = event.target.closest?.("[data-users-action],[data-users-select]");
      if (!button || destroyed || busy || loading || !canManageUsers(session)) return;
      if (button.dataset.usersAction === "refresh") { void load(); return; }
      if (button.dataset.usersAction === "new") { selectedId = ""; draw(); container.querySelector('[name="displayName"]')?.focus(); return; }
      if (button.dataset.usersSelect && users.some((user) => user.id === button.dataset.usersSelect)) {
        selectedId = button.dataset.usersSelect;
        draw();
        container.querySelector('[name="displayName"]')?.focus();
      }
    }

    function input(event) {
      if (event.target.matches?.("[data-users-search]")) {
        query = event.target.value;
        const list = container.querySelector("[data-users-list]");
        if (list) list.innerHTML = renderUserList(users, selectedId, query);
      }
    }

    function change(event) {
      if (destroyed || busy || loading || !canManageUsers(session)) return;
      if (users.some((user) => user.id === selectedId && user.isDeveloper)) return;
      const form = container.querySelector("[data-users-form]");
      if (!form) return;
      if (event.target.name === "role") {
        const role = catalog.roles.find((item) => item.id === event.target.value);
        if (!role || role.id === "personalizado") return;
        const selected = new Set(role.permissions);
        form.querySelectorAll('[name="permissions"]').forEach((checkbox) => { checkbox.checked = selected.has(checkbox.value); });
      } else if (event.target.name === "permissions") {
        const field = form.querySelector('[name="role"]');
        if (field) field.value = "personalizado";
      }
    }

    function submit(event) {
      if (!event.target.matches?.("[data-users-form]")) return;
      event.preventDefault();
      void save();
    }

    container.addEventListener("click", click);
    container.addEventListener("input", input);
    container.addEventListener("change", change);
    container.addEventListener("submit", submit);
    const api = {
      load, save,
      setSession(next) {
        session = clone(next || {});
        if (!canManageUsers(session)) {
          generation += 1; busy = false; loading = false; users = []; selectedId = "";
        }
        draw();
      },
      getState: () => clone({ users, selectedId, loading, busy, permissions: catalog.permissions, roles: catalog.roles }),
      destroy() {
        destroyed = true; generation += 1;
        container.removeEventListener("click", click); container.removeEventListener("input", input);
        container.removeEventListener("change", change); container.removeEventListener("submit", submit);
        container.innerHTML = ""; instances.delete(container);
      }
    };
    instances.set(container, api);
    draw();
    return api;
  }

  return { init, canManageUsers, publicUser, ownsDeveloperProfile, normalizeCatalog, createPayload, renderPermissions, renderUserList, render };
});
