"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PERMISSION_DEFINITIONS = Object.freeze([
  { id: "users.manage", label: "Administrar usuarios y permisos", group: "Administración", description: "Crear usuarios, cambiar contraseñas y definir sus accesos." },
  { id: "luxury.access", label: "Acceso completo a Luxury Travel", group: "Luxury Travel", description: "Usar todos los módulos de Luxury Travel con la misma cuenta." },
  { id: "quotes.read", label: "Consultar cotizaciones", group: "Cotizaciones", description: "Ver las cotizaciones de Live Productions." },
  { id: "quotes.write", label: "Crear y modificar cotizaciones", group: "Cotizaciones", description: "Guardar, editar y eliminar cotizaciones." },
  { id: "requirements.read", label: "Consultar requerimientos", group: "Requerimientos", description: "Ver los requerimientos y las tareas de trabajo." },
  { id: "requirements.write", label: "Modificar requerimientos", group: "Requerimientos", description: "Crear requerimientos y actualizar tareas y colaboradores." },
  { id: "equipment.read", label: "Consultar Requerimiento de Equipo", group: "Requerimiento de Equipo", description: "Ver servicios, eventos, existencias y planificación de equipo." },
  { id: "equipment.write", label: "Preparar eventos y trasiegos", group: "Requerimiento de Equipo", description: "Importar y guardar eventos, extras y trasiegos." },
  { id: "equipment.reports", label: "Generar reportes de equipo", group: "Requerimiento de Equipo", description: "Generar reportes de trasiego, renta y compra." },
  { id: "equipment.catalog", label: "Modificar tipos de servicio", group: "Requerimiento de Equipo", description: "Importar y editar los cuadros y categorías de servicios." },
  { id: "warehouse.read", label: "Consultar Contabilidad de Equipo", group: "Contabilidad de Equipo", description: "Consultar el inventario, movimientos y bitácoras." },
  { id: "warehouse.inventory", label: "Modificar e importar inventario", group: "Contabilidad de Equipo", description: "Crear y editar equipos, cantidades e importaciones de inventario." },
  { id: "warehouse.movements", label: "Registrar movimientos propios", group: "Contabilidad de Equipo", description: "Registrar salidas, devoluciones, taller y otros movimientos propios." },
  { id: "warehouse.movements.manage", label: "Administrar movimientos de otros empleados", group: "Contabilidad de Equipo", description: "Editar o eliminar movimientos registrados por otros empleados." },
  { id: "warehouse.logs", label: "Consultar bitácoras e historial", group: "Contabilidad de Equipo", description: "Revisar las bitácoras y el historial de acciones de los empleados." }
].map((entry) => Object.freeze(entry)));
const ALL_PERMISSION_IDS = Object.freeze(PERMISSION_DEFINITIONS.map((entry) => entry.id));
const ROLE_PRESETS = Object.freeze([
  { id: "administrador", label: "Administración", permissions: ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage") },
  { id: "bodega", label: "Bodega", permissions: ["equipment.read", "warehouse.read", "warehouse.movements", "warehouse.logs"] },
  { id: "planificacion", label: "Planificación", permissions: ["equipment.read", "equipment.write", "equipment.reports", "warehouse.read"] },
  { id: "consulta", label: "Consulta", permissions: ["quotes.read", "requirements.read", "equipment.read", "warehouse.read"] },
  { id: "personalizado", label: "Permisos personalizados", permissions: [] }
].map((entry) => Object.freeze({ ...entry, permissions: Object.freeze(entry.permissions) })));
const MAX_USERS = 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const DEVELOPER_USER_ID = "live-developer-dgiant";
const DEVELOPER_USERNAME = "Dgiant";
const clone = (value) => JSON.parse(JSON.stringify(value));
const usernameKey = (value) => String(value || "").normalize("NFC").trim().toLocaleLowerCase("en-US");
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function isDeveloperIdentity(user) {
  return Boolean(user && user.id === DEVELOPER_USER_ID && usernameKey(user.username) === usernameKey(DEVELOPER_USERNAME));
}

function invalid(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  return error;
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const first = Buffer.from(left, "utf8"), second = Buffer.from(right, "utf8");
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function validatePassword(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw invalid(`La contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres.`);
  }
  return password;
}

function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.randomBytes(16).toString("hex");
  return { algorithm: "scrypt", salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}

function validPasswordHash(value) {
  if (!value || typeof value !== "object" || typeof value.salt !== "string" || !value.salt || value.salt.length > 512
    || typeof value.hash !== "string" || !/^[a-f0-9]+$/i.test(value.hash)) return false;
  if (value.algorithm === "scrypt") return value.hash.length === 128;
  return value.algorithm === "pbkdf2-sha256" && value.hash.length === 64
    && Number.isSafeInteger(value.iterations) && value.iterations > 0 && value.iterations <= 10000000;
}

function verifyPassword(password, stored) {
  if (typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH || !validPasswordHash(stored)) return false;
  try {
    const candidate = stored.algorithm === "scrypt"
      ? crypto.scryptSync(password, stored.salt, 64).toString("hex")
      : crypto.pbkdf2Sync(password, stored.salt, stored.iterations, 32, "sha256").toString("hex");
    return safeEqual(candidate, stored.hash);
  } catch { return false; }
}

function publicUser(user) {
  if (!user) return null;
  const isDeveloper = isDeveloperIdentity(user);
  return {
    id: user.id, username: user.username, displayName: user.displayName,
    role: isDeveloper ? "administrador" : user.role, active: user.active,
    permissions: effectivePermissions(user),
    isDeveloper, auditExempt: isDeveloper, canActivateDeveloper: false,
    sessionVersion: user.sessionVersion, createdAt: user.createdAt, updatedAt: user.updatedAt
  };
}

function hasPermission(user, permission) {
  if (!user || user.active === false) return false;
  if (permission === "users.manage") return isDeveloperIdentity(user);
  return Boolean(isDeveloperIdentity(user) && ALL_PERMISSION_IDS.includes(permission)
    || Array.isArray(user.permissions) && user.permissions.includes(permission));
}

function effectivePermissions(user) {
  return isDeveloperIdentity(user) ? [...ALL_PERMISSION_IDS]
    : (Array.isArray(user?.permissions) ? user.permissions : []).filter((permission) => permission !== "users.manage");
}

function requireDelegablePermissions(permissions) {
  if (permissions.includes("users.manage")) {
    throw invalid("La administración de usuarios es exclusiva del propietario y no se puede delegar.", 403);
  }
  return permissions;
}

function normalizePermissions(value) {
  if (!Array.isArray(value) || value.some((permission) => typeof permission !== "string" || !ALL_PERMISSION_IDS.includes(permission))) {
    throw invalid("La lista de permisos contiene un acceso no reconocido.");
  }
  return ALL_PERMISSION_IDS.filter((permission) => value.includes(permission));
}

function normalizeRole(value) {
  const role = value === undefined ? "personalizado" : String(value);
  if (!ROLE_PRESETS.some((preset) => preset.id === role)) throw invalid("Seleccione un perfil de usuario válido.");
  return role;
}

function normalizeUsername(value) {
  if (typeof value !== "string") throw invalid("Escriba un nombre de usuario válido.");
  const username = value.trim();
  if (!/^[a-z0-9_.@-]{3,80}$/i.test(username)) {
    throw invalid("El usuario debe tener entre 3 y 80 letras, números, puntos, guiones o el signo @.");
  }
  return username;
}

function normalizeDisplayName(value, fallback) {
  const displayName = value === undefined ? fallback : String(value || "").trim();
  if (!displayName || displayName.length > 120 || /[\u0000-\u001f\u007f]/.test(displayName)) {
    throw invalid("Escriba un nombre del empleado de hasta 120 caracteres.");
  }
  return displayName;
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw invalid("Los datos del usuario no son válidos.");
  const allowed = new Set(["username", "displayName", "role", "active", "permissions", "password"]);
  if (Object.keys(payload).some((key) => !allowed.has(key))) throw invalid("Los datos contienen un campo de usuario no permitido.");
  if (own(payload, "active") && typeof payload.active !== "boolean") throw invalid("El estado del usuario no es válido.");
}

// This input belongs only to the server console; no HTTP handler may invoke it.
function normalizeInternalBatch(payload) {
  const object = (value, allowed) => {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.includes(key))) {
      throw invalid("El lote contiene un objeto o campo no permitido.");
    }
  };
  object(payload, ["version", "owner", "users", "bootstrapAdministrator"]);
  if (payload.version !== 1) throw invalid("La versión del lote no es válida.");
  if (!own(payload, "owner") && !own(payload, "bootstrapAdministrator") && !own(payload, "users")) {
    throw invalid("El lote debe incluir cuentas para crear o actualizar.");
  }
  const normalizeEntry = (entry, owner = false) => {
    object(entry, owner ? ["displayName", "password"] : ["username", "displayName", "password", "role", "permissions", "active"]);
    const result = {};
    if (!owner) {
      result.username = normalizeUsername(entry.username);
      if (usernameKey(result.username) === usernameKey(DEVELOPER_USERNAME)) {
        throw invalid("La identidad reservada solo se puede configurar mediante owner.");
      }
      if (own(entry, "role")) result.role = normalizeRole(entry.role);
      if (own(entry, "permissions")) result.permissions = requireDelegablePermissions(normalizePermissions(entry.permissions));
      if (own(entry, "active")) {
        if (typeof entry.active !== "boolean") throw invalid("El estado del usuario no es válido.");
        result.active = entry.active;
      }
    }
    if (own(entry, "displayName")) result.displayName = normalizeDisplayName(entry.displayName);
    if (own(entry, "password")) result.password = validatePassword(entry.password);
    return result;
  };
  const result = { version: 1, users: [] };
  if (own(payload, "owner")) result.owner = normalizeEntry(payload.owner, true);
  if (own(payload, "bootstrapAdministrator")) result.bootstrapAdministrator = normalizeEntry(payload.bootstrapAdministrator);
  if (own(payload, "users")) {
    if (!Array.isArray(payload.users) || payload.users.length > MAX_USERS) throw invalid("La lista de cuentas no es válida.");
    result.users = payload.users.map((entry) => normalizeEntry(entry));
    const keys = new Set();
    for (const entry of result.users) {
      const key = usernameKey(entry.username);
      if (keys.has(key)) throw invalid("El lote contiene nombres de usuario repetidos.");
      keys.add(key);
    }
  }
  return result;
}

function legacyFingerprint(legacyAdmin) {
  return crypto.createHash("sha256").update(JSON.stringify({
    username: String(legacyAdmin.username || ""), password: legacyAdmin.password
  })).digest("hex");
}

function readStoredState(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    const stored = JSON.parse(raw);
    if (stored?.version !== 1 || !Array.isArray(stored.users) || !Array.isArray(stored.audit)
      || !stored.users.length || stored.users.length > MAX_USERS || typeof stored.legacyAdminId !== "string"
      || !/^[a-f0-9]{64}$/.test(stored.legacyFingerprint || "")) throw new Error("invalid");
    const ids = new Set(), usernames = new Set();
    for (const user of stored.users) {
      if (!user || typeof user.id !== "string" || !user.id || ids.has(user.id)
        || user.id === DEVELOPER_USER_ID && !isDeveloperIdentity(user)
        || typeof user.username !== "string" || !user.username || usernames.has(usernameKey(user.username))
        || typeof user.displayName !== "string" || !user.displayName || user.displayName.length > 120
        || !ROLE_PRESETS.some((preset) => preset.id === user.role)
        || typeof user.active !== "boolean" || !Number.isSafeInteger(user.sessionVersion) || user.sessionVersion < 1
        || !validPasswordHash(user.password) || !Array.isArray(user.permissions)
        || !user.permissions.every((permission) => ALL_PERMISSION_IDS.includes(permission))) throw new Error("invalid");
      if (isDeveloperIdentity(user) && (user.role !== "administrador" || !user.active)) throw new Error("invalid");
      ids.add(user.id); usernames.add(usernameKey(user.username));
    }
    const developer = stored.users.find(isDeveloperIdentity);
    const bootstrapAdministrator = stored.users.find((user) => user.id === stored.legacyAdminId);
    if (!ids.has(stored.legacyAdminId) || !(developer ? developer.active : bootstrapAdministrator?.active)) throw new Error("invalid");
    return { state: stored, raw };
  } catch {
    throw new Error("No se pudo leer el registro de usuarios. Se conservó el archivo original; no se restablecieron las cuentas.");
  }
}

function createLiveUserStore({ directory, legacyAdmin, clock = () => new Date(), readOnly = false, deferBootstrap = false } = {}) {
  if (!directory) throw new Error("Indique el directorio privado para guardar los usuarios.");
  const filePath = path.join(directory, "usuarios-live.json");
  let state, diskContents;
  const timestamp = () => {
    const value = clock();
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("El reloj del servidor no es válido.");
    return date.toISOString();
  };
  const persist = (next) => {
    if (readOnly) throw invalid("El registro de usuarios está abierto solo para consulta.", 403);
    fs.mkdirSync(directory, { recursive: true });
    const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
    try {
      const serialized = JSON.stringify(next, null, 2) + "\n";
      fs.writeFileSync(temporary, serialized, { mode: 0o600, flag: "wx" });
      fs.renameSync(temporary, filePath);
      diskContents = serialized;
      state = next;
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  };

  try {
    const loaded = readStoredState(filePath);
    state = loaded.state;
    diskContents = loaded.raw;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error("No se pudo leer el registro de usuarios. Se conservó el archivo original; no se restablecieron las cuentas.");
    }
    if (deferBootstrap) {
      state = null;
    } else {
      if (readOnly) throw new Error("El registro de usuarios todavía no está disponible para consulta.");
      if (!legacyAdmin || !String(legacyAdmin.username || "").trim() || !validPasswordHash(legacyAdmin.password)) {
        throw new Error("Se necesita la cuenta administradora existente para inicializar los usuarios sin cambiar su contraseña.");
      }
      const createdAt = timestamp();
      const legacyAdminId = crypto.randomUUID();
      const administrator = {
        id: legacyAdminId, username: String(legacyAdmin.username), displayName: String(legacyAdmin.username),
        role: "administrador", active: true, permissions: ALL_PERMISSION_IDS.filter((permission) => permission !== "users.manage"), password: clone(legacyAdmin.password),
        sessionVersion: 1, legacySessionEligible: true, createdAt, updatedAt: createdAt
      };
      persist({ version: 1, legacyAdminId, legacyFingerprint: legacyFingerprint(legacyAdmin), users: [administrator], audit: [{ id: crypto.randomUUID(), timestamp: createdAt, action: "users.bootstrap",
        actor: { id: administrator.id, username: administrator.username, displayName: administrator.displayName },
        target: { id: administrator.id, username: administrator.username }, changes: { migratedExistingAdministrator: true } }] });
    }
  }

  const reload = () => {
    try {
      const loaded = readStoredState(filePath);
      state = loaded.state;
      diskContents = loaded.raw;
    } catch {
      state = null;
      throw new Error("No se pudo leer el registro de usuarios. No se autorizaron sesiones ni se restablecieron las cuentas.");
    }
  };

  const findUser = (identifier) => {
    if (identifier && typeof identifier === "object") {
      if (identifier.id) return state.users.find((user) => user.id === identifier.id) || null;
      if (identifier.userId) return state.users.find((user) => user.id === identifier.userId) || null;
      identifier = identifier.username || identifier.user;
    }
    return state.users.find((user) => user.id === identifier || usernameKey(user.username) === usernameKey(identifier)) || null;
  };
  const requireAdministrator = (actor) => {
    const user = findUser(actor);
    if (!user || !user.active) throw invalid("Inicie sesión para administrar usuarios.", 401);
    if (!isDeveloperIdentity(user)) throw invalid("Solo el propietario puede administrar usuarios y permisos.", 403);
    return user;
  };
  const canActivateDeveloper = (actor) => {
    const user = findUser(actor);
    return Boolean(user?.active && user.id === state.legacyAdminId && !state.users.some(isDeveloperIdentity));
  };
  const exposeUser = (user) => user ? { ...publicUser(user), canActivateDeveloper: canActivateDeveloper(user) } : null;
  const ensureAdministrator = (users) => {
    if (!users.some((user) => hasPermission(user, "users.manage"))) {
      throw invalid("Debe conservar la cuenta activa del propietario para administrar usuarios.", 409);
    }
  };
  const appendAudit = (next, action, actor, target, changes, at) => {
    next.audit.push({ id: crypto.randomUUID(), timestamp: at, action,
      actor: { id: actor.id, username: actor.username, displayName: actor.displayName },
      target: { id: target.id, username: target.username }, changes });
  };
  const authenticate = (username, password) => {
    const user = state.users.find((entry) => usernameKey(entry.username) === usernameKey(username));
    if (!user || !user.active || !verifyPassword(password, user.password)) return null;
    return exposeUser(user);
  };
  const sessionFor = (identifier) => {
    const user = findUser(identifier);
    if (!user || !user.active) return null;
    return { user: user.username, userId: user.id, sessionVersion: user.sessionVersion };
  };
  const resolveSession = (payload) => {
    if (!payload || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    if (payload.userId) {
      const user = state.users.find((entry) => entry.id === payload.userId);
      return user?.active && payload.user === user.username && payload.sessionVersion === user.sessionVersion ? exposeUser(user) : null;
    }
    const administrator = state.users.find((user) => user.id === state.legacyAdminId);
    const sameLegacyConfig = legacyAdmin && state.legacyFingerprint === legacyFingerprint(legacyAdmin);
    return administrator?.active && administrator.legacySessionEligible === true && administrator.sessionVersion === 1
      && sameLegacyConfig && payload.user === administrator.username ? exposeUser(administrator) : null;
  };
  const create = (payload, actor) => {
    const administrator = requireAdministrator(actor);
    validatePayload(payload);
    if (state.users.length >= MAX_USERS) throw invalid("Se alcanzó el límite de usuarios registrados.", 409);
    const username = normalizeUsername(payload.username);
    if (usernameKey(username) === usernameKey(DEVELOPER_USERNAME)) throw invalid("La cuenta del desarrollador requiere la provisión protegida del servidor.", 409);
    if (state.users.some((user) => usernameKey(user.username) === usernameKey(username))) throw invalid("Ese nombre de usuario ya está registrado.", 409);
    const role = normalizeRole(payload.role);
    const permissions = own(payload, "permissions") ? requireDelegablePermissions(normalizePermissions(payload.permissions))
      : [...ROLE_PRESETS.find((preset) => preset.id === role).permissions];
    const at = timestamp();
    const user = { id: crypto.randomUUID(), username, displayName: normalizeDisplayName(payload.displayName, username),
      role, active: payload.active !== false, permissions, password: hashPassword(payload.password),
      sessionVersion: 1, legacySessionEligible: false, createdAt: at, updatedAt: at };
    const next = clone(state);
    next.users.push(user);
    appendAudit(next, "users.create", administrator, user,
      { displayName: user.displayName, role, active: user.active, permissions: [...permissions] }, at);
    persist(next);
    return exposeUser(user);
  };
  const update = (id, payload, actor) => {
    const administrator = requireAdministrator(actor);
    validatePayload(payload);
    const original = state.users.find((user) => user.id === id);
    if (!original) throw invalid("No se encontró el usuario.", 404);
    if (isDeveloperIdentity(original) && administrator.id !== original.id) {
      throw invalid("Solo el propietario puede modificar su cuenta de desarrollador.", 403);
    }
    const user = clone(original);
    user.permissions = effectivePermissions(original);
    if (own(payload, "username")) user.username = normalizeUsername(payload.username);
    if (state.users.some((entry) => entry.id !== id && usernameKey(entry.username) === usernameKey(user.username))) throw invalid("Ese nombre de usuario ya está registrado.", 409);
    if (own(payload, "displayName")) user.displayName = normalizeDisplayName(payload.displayName, user.username);
    if (own(payload, "role")) user.role = normalizeRole(payload.role);
    if (own(payload, "permissions")) {
      user.permissions = normalizePermissions(payload.permissions);
      if (!isDeveloperIdentity(original)) requireDelegablePermissions(user.permissions);
    }
    if (own(payload, "active")) user.active = payload.active;
    if (isDeveloperIdentity(original)) {
      if (user.username !== original.username || user.role !== "administrador" || !user.active
        || own(payload, "permissions") && JSON.stringify(user.permissions) !== JSON.stringify(ALL_PERMISSION_IDS)) {
        throw invalid("La identidad del desarrollador conserva su usuario, estado y acceso completo.", 409);
      }
      user.permissions = [...ALL_PERMISSION_IDS];
    } else if (usernameKey(user.username) === usernameKey(DEVELOPER_USERNAME)) {
      throw invalid("La cuenta del desarrollador requiere la provisión protegida del servidor.", 409);
    }
    if (own(payload, "password") && payload.password !== "") user.password = hashPassword(payload.password);
    const changes = {};
    for (const key of ["username", "displayName", "role", "active", "permissions"]) {
      if (JSON.stringify(original[key]) !== JSON.stringify(user[key])) changes[key] = { before: clone(original[key]), after: clone(user[key]) };
    }
    if (user.password.hash !== original.password.hash) changes.passwordChanged = true;
    if (!Object.keys(changes).length) return exposeUser(original);
    const at = timestamp();
    user.sessionVersion += 1; user.legacySessionEligible = false; user.updatedAt = at;
    const next = clone(state);
    next.users = next.users.map((entry) => entry.id === id ? user : entry);
    ensureAdministrator(next.users);
    appendAudit(next, "users.update", administrator, user, changes, at);
    persist(next);
    return exposeUser(user);
  };
  const changeOwnPassword = (id, payload, actor) => {
    const user = findUser(actor);
    if (!user?.active || user.id !== id) throw invalid("No puede cambiar la contraseña de este usuario.", 403);
    if (!verifyPassword(payload?.currentPassword, user.password)) throw invalid("La contraseña actual es incorrecta.", 401);
    const next = clone(state), updated = next.users.find((entry) => entry.id === id);
    updated.password = hashPassword(payload?.newPassword);
    updated.sessionVersion += 1; updated.legacySessionEligible = false; updated.updatedAt = timestamp();
    appendAudit(next, "users.password.change", user, updated, { passwordChanged: true }, updated.updatedAt);
    persist(next);
    return exposeUser(updated);
  };
  const provisionDeveloperAccount = (payload, actor) => {
    const administrator = findUser(actor);
    if (!administrator?.active) throw invalid("Inicie sesión para activar la cuenta del propietario.", 401);
    if (state.users.some(isDeveloperIdentity)) throw invalid("La cuenta del desarrollador ya está provisionada.", 409);
    if (!canActivateDeveloper(administrator)) throw invalid("Solo la cuenta administradora original puede activar al propietario.", 403);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
      || Object.keys(payload).some((key) => !["username", "displayName", "password"].includes(key))) {
      throw invalid("La provisión del desarrollador solo admite nombre, usuario y contraseña.");
    }
    if (payload.username !== undefined && usernameKey(payload.username) !== usernameKey(DEVELOPER_USERNAME)) {
      throw invalid("La identidad reservada del desarrollador no se puede asignar a otro usuario.");
    }
    if (state.users.some((user) => user.id === DEVELOPER_USER_ID)) throw invalid("La cuenta del desarrollador ya está provisionada.", 409);
    const existing = state.users.find((user) => usernameKey(user.username) === usernameKey(DEVELOPER_USERNAME));
    if (!existing && state.users.length >= MAX_USERS) throw invalid("Se alcanzó el límite de usuarios registrados.", 409);
    validatePassword(payload.password);
    if (existing && !verifyPassword(payload.password, existing.password)) {
      throw invalid("Confirme la contraseña actual del propietario para migrar su cuenta existente.", 401);
    }
    const at = timestamp();
    const developer = { id: DEVELOPER_USER_ID, username: DEVELOPER_USERNAME,
      displayName: normalizeDisplayName(payload.displayName, existing?.displayName || DEVELOPER_USERNAME),
      role: "administrador", active: true, permissions: [...ALL_PERMISSION_IDS],
      password: existing ? clone(existing.password) : hashPassword(payload.password),
      sessionVersion: existing ? existing.sessionVersion + 1 : 1, legacySessionEligible: false,
      createdAt: existing?.createdAt || at, updatedAt: at };
    const next = clone(state);
    next.users = existing ? next.users.map((user) => user.id === existing.id ? developer : user) : [...next.users, developer];
    if (existing && next.legacyAdminId === existing.id) next.legacyAdminId = developer.id;
    for (const user of next.users) {
      if (isDeveloperIdentity(user)) continue;
      const lostManagement = user.permissions.includes("users.manage");
      if (lostManagement) user.permissions = effectivePermissions(user);
      if (lostManagement || user.id === state.legacyAdminId) {
        user.sessionVersion += 1;
        user.legacySessionEligible = false;
        user.updatedAt = at;
      }
    }
    appendAudit(next, "users.developer.provision", administrator, developer,
      { protectedIdentity: true, migratedExistingAccount: Boolean(existing) }, at);
    persist(next);
    return exposeUser(developer);
  };

  const applyInternalBatch = (payload, { dryRun = false } = {}) => {
    if (readOnly) throw invalid("El registro de usuarios está abierto solo para consulta.", 403);
    const batch = normalizeInternalBatch(payload);
    if (typeof dryRun !== "boolean") throw invalid("La opción de simulación no es válida.");
    if (batch.bootstrapAdministrator && (state
      ? usernameKey(state.users.find((user) => user.id === state.legacyAdminId)?.username) !== usernameKey(batch.bootstrapAdministrator.username)
      : legacyAdmin)) {
      throw invalid("La cuenta inicial no puede reemplazar a una cuenta administradora existente.", 409);
    }
    const entries = state && batch.bootstrapAdministrator ? [batch.bootstrapAdministrator, ...batch.users] : batch.users;
    if (new Set(entries.map((entry) => usernameKey(entry.username))).size !== entries.length) {
      throw invalid("El lote contiene nombres de usuario repetidos.");
    }
    const at = timestamp();
    const actor = { id: "server-console", username: "server-console", displayName: "Consola interna del servidor" };
    let next = state ? clone(state) : null;
    if (!next) {
      const supplied = batch.bootstrapAdministrator;
      if (!supplied && (!legacyAdmin || typeof legacyAdmin.username !== "string" || !legacyAdmin.username.trim()
        || !validPasswordHash(legacyAdmin.password))) {
        throw invalid("Indique bootstrapAdministrator para inicializar un directorio sin cuentas existentes.");
      }
      if (supplied && !own(supplied, "password")) throw invalid("La cuenta inicial requiere una contraseña.");
      const username = supplied ? supplied.username : legacyAdmin.username;
      const role = supplied?.role || "administrador";
      const administrator = { id: crypto.randomUUID(), username, displayName: supplied?.displayName || username,
        role, active: supplied?.active !== false,
        permissions: supplied?.permissions || [...ROLE_PRESETS.find((preset) => preset.id === role).permissions],
        password: supplied ? hashPassword(supplied.password) : clone(legacyAdmin.password),
        sessionVersion: 1, legacySessionEligible: !supplied, createdAt: at, updatedAt: at };
      const source = { username, password: administrator.password };
      next = { version: 1, legacyAdminId: administrator.id, legacyFingerprint: legacyFingerprint(source), users: [administrator], audit: [] };
      appendAudit(next, "users.bootstrap", actor, administrator, { migratedExistingAdministrator: !supplied, internal: true }, at);
    }
    // Validate existence-dependent requirements before computing any replacement hashes.
    for (const entry of entries) {
      if (!next.users.some((user) => usernameKey(user.username) === usernameKey(entry.username)) && !own(entry, "password")) {
        throw invalid("Cada cuenta nueva requiere una contraseña.");
      }
    }
    const previousOwner = next.users.find(isDeveloperIdentity);
    const reserved = next.users.find((user) => usernameKey(user.username) === usernameKey(DEVELOPER_USERNAME));
    if (batch.owner && !reserved && !own(batch.owner, "password")) throw invalid("La cuenta nueva del propietario requiere una contraseña.");
    const originals = new Map(next.users.map((user) => [user.id, clone(user)]));
    const newIds = new Set();
    let migratedOwnerId;
    const setPassword = (target, entry) => {
      if (own(entry, "password") && !verifyPassword(entry.password, target.password)) target.password = hashPassword(entry.password);
    };
    if (batch.owner) {
      let owner = reserved;
      if (!owner) {
        owner = { id: DEVELOPER_USER_ID, username: DEVELOPER_USERNAME, displayName: DEVELOPER_USERNAME,
          password: hashPassword(batch.owner.password), sessionVersion: 1, legacySessionEligible: false, createdAt: at, updatedAt: at };
        next.users.push(owner); newIds.add(owner.id);
      } else if (!isDeveloperIdentity(owner)) {
        migratedOwnerId = owner.id;
        owner.id = DEVELOPER_USER_ID;
        if (next.legacyAdminId === migratedOwnerId) next.legacyAdminId = owner.id;
      }
      owner.username = DEVELOPER_USERNAME; owner.role = "administrador"; owner.active = true;
      owner.permissions = [...ALL_PERMISSION_IDS];
      if (own(batch.owner, "displayName")) owner.displayName = batch.owner.displayName;
      setPassword(owner, batch.owner);
    }
    for (const entry of entries) {
      let user = next.users.find((candidate) => usernameKey(candidate.username) === usernameKey(entry.username));
      if (!user) {
        const role = entry.role || "personalizado";
        user = { id: crypto.randomUUID(), username: entry.username, displayName: entry.displayName || entry.username,
          role, active: entry.active !== false, permissions: entry.permissions || [...ROLE_PRESETS.find((preset) => preset.id === role).permissions],
          password: hashPassword(entry.password), sessionVersion: 1, legacySessionEligible: false, createdAt: at, updatedAt: at };
        next.users.push(user); newIds.add(user.id);
      } else {
        for (const key of ["username", "displayName", "role", "active", "permissions"]) {
          if (own(entry, key)) user[key] = clone(entry[key]);
        }
        setPassword(user, entry);
      }
    }
    if (next.users.length > MAX_USERS) throw invalid("Se alcanzó el límite de usuarios registrados.", 409);
    const owner = next.users.find(isDeveloperIdentity);
    if (!(owner ? owner.active : next.users.find((user) => user.id === next.legacyAdminId)?.active)) {
      throw invalid("Debe conservar la cuenta activa del propietario o la cuenta administradora inicial.", 409);
    }
    const changedUsers = [];
    for (const user of next.users) {
      if (!isDeveloperIdentity(user)) user.permissions = effectivePermissions(user);
      const original = originals.get(user.id) || (user.id === DEVELOPER_USER_ID && migratedOwnerId ? originals.get(migratedOwnerId) : null);
      const changes = {};
      if (newIds.has(user.id)) changes.created = true;
      if (original) {
        for (const key of ["id", "username", "displayName", "role", "active", "permissions"]) {
          if (JSON.stringify(original[key]) !== JSON.stringify(user[key])) changes[key] = { before: clone(original[key]), after: clone(user[key]) };
        }
        if (JSON.stringify(original.password) !== JSON.stringify(user.password)) changes.passwordChanged = true;
        if (!previousOwner && owner && original.id === (state?.legacyAdminId || next.legacyAdminId)) changes.legacySessionsRevoked = true;
      }
      if (!Object.keys(changes).length) continue;
      if (original) {
        if (original.sessionVersion >= Number.MAX_SAFE_INTEGER) throw invalid("No se pudo renovar la versión de sesión de una cuenta.", 409);
        user.sessionVersion = original.sessionVersion + 1;
      }
      user.legacySessionEligible = false; user.updatedAt = at;
      appendAudit(next, newIds.has(user.id) ? "users.internal.create" : "users.internal.update", actor, user, changes, at);
      changedUsers.push(publicUser(user));
    }
    const changed = !state || changedUsers.length > 0;
    if (changed && !dryRun) {
      let current;
      try { current = fs.readFileSync(filePath, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (current !== diskContents) throw invalid("El registro cambió durante la operación; vuelva a ejecutar el lote.", 409);
      persist(next);
    }
    return { dryRun, changed, changedUsers, users: next.users.map(publicUser) };
  };

  return { filePath, list: () => state.users.map(exposeUser), getUser: (id) => exposeUser(findUser(id)),
    authenticate, sessionFor, resolveSession, create, update, changeOwnPassword, provisionDeveloperAccount, canActivateDeveloper, reload, applyInternalBatch,
    audit: () => clone(state.audit), hasPermission: (identifier, permission) => hasPermission(findUser(identifier), permission) };
}

module.exports = { createLiveUserStore, publicUser, hasPermission, hashPassword, verifyPassword,
  PERMISSION_DEFINITIONS, ROLE_PRESETS, ALL_PERMISSION_IDS, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH,
  DEVELOPER_USER_ID, DEVELOPER_USERNAME, isDeveloperIdentity, normalizeInternalBatch };
