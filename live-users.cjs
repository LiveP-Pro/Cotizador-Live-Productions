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
  { id: "administrador", label: "Administración", permissions: [...ALL_PERMISSION_IDS] },
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
    permissions: isDeveloper ? [...ALL_PERMISSION_IDS] : [...user.permissions],
    isDeveloper, auditExempt: isDeveloper,
    sessionVersion: user.sessionVersion, createdAt: user.createdAt, updatedAt: user.updatedAt
  };
}

function hasPermission(user, permission) {
  return Boolean(user && user.active !== false && (isDeveloperIdentity(user) && ALL_PERMISSION_IDS.includes(permission)
    || Array.isArray(user.permissions) && user.permissions.includes(permission)));
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

function legacyFingerprint(legacyAdmin) {
  return crypto.createHash("sha256").update(JSON.stringify({
    username: String(legacyAdmin.username || ""), password: legacyAdmin.password
  })).digest("hex");
}

function createLiveUserStore({ directory, legacyAdmin, clock = () => new Date(), readOnly = false } = {}) {
  if (!directory) throw new Error("Indique el directorio privado para guardar los usuarios.");
  const filePath = path.join(directory, "usuarios-live.json");
  let state;
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
      fs.writeFileSync(temporary, JSON.stringify(next, null, 2) + "\n", { mode: 0o600, flag: "wx" });
      fs.renameSync(temporary, filePath);
      state = next;
    } finally {
      try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  };

  try {
    const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
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
    if (!ids.has(stored.legacyAdminId) || !stored.users.some((user) => hasPermission(user, "users.manage"))) throw new Error("invalid");
    state = stored;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw new Error("No se pudo leer el registro de usuarios. Se conservó el archivo original; no se restablecieron las cuentas.");
    }
    if (readOnly) throw new Error("El registro de usuarios todavía no está disponible para consulta.");
    if (!legacyAdmin || !String(legacyAdmin.username || "").trim() || !validPasswordHash(legacyAdmin.password)) {
      throw new Error("Se necesita la cuenta administradora existente para inicializar los usuarios sin cambiar su contraseña.");
    }
    const createdAt = timestamp();
    const legacyAdminId = crypto.randomUUID();
    const administrator = {
      id: legacyAdminId, username: String(legacyAdmin.username), displayName: String(legacyAdmin.username),
      role: "administrador", active: true, permissions: [...ALL_PERMISSION_IDS], password: clone(legacyAdmin.password),
      sessionVersion: 1, legacySessionEligible: true, createdAt, updatedAt: createdAt
    };
    persist({ version: 1, legacyAdminId, legacyFingerprint: legacyFingerprint(legacyAdmin), users: [administrator], audit: [{ id: crypto.randomUUID(), timestamp: createdAt, action: "users.bootstrap",
      actor: { id: administrator.id, username: administrator.username, displayName: administrator.displayName },
      target: { id: administrator.id, username: administrator.username }, changes: { migratedExistingAdministrator: true } }] });
  }

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
    if (!hasPermission(user, "users.manage")) throw invalid("No tiene permiso para administrar usuarios.", 403);
    return user;
  };
  const ensureAdministrator = (users) => {
    if (!users.some((user) => hasPermission(user, "users.manage"))) {
      throw invalid("Debe conservar al menos un administrador activo con permiso para administrar usuarios.", 409);
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
    return publicUser(user);
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
      return user?.active && payload.user === user.username && payload.sessionVersion === user.sessionVersion ? publicUser(user) : null;
    }
    const administrator = state.users.find((user) => user.id === state.legacyAdminId);
    const sameLegacyConfig = legacyAdmin && state.legacyFingerprint === legacyFingerprint(legacyAdmin);
    return administrator?.active && administrator.legacySessionEligible === true && administrator.sessionVersion === 1
      && sameLegacyConfig && payload.user === administrator.username ? publicUser(administrator) : null;
  };
  const create = (payload, actor) => {
    const administrator = requireAdministrator(actor);
    validatePayload(payload);
    if (state.users.length >= MAX_USERS) throw invalid("Se alcanzó el límite de usuarios registrados.", 409);
    const username = normalizeUsername(payload.username);
    if (usernameKey(username) === usernameKey(DEVELOPER_USERNAME)) throw invalid("La cuenta del desarrollador requiere la provisión protegida del servidor.", 409);
    if (state.users.some((user) => usernameKey(user.username) === usernameKey(username))) throw invalid("Ese nombre de usuario ya está registrado.", 409);
    const role = normalizeRole(payload.role);
    const permissions = own(payload, "permissions") ? normalizePermissions(payload.permissions)
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
    return publicUser(user);
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
    if (own(payload, "username")) user.username = normalizeUsername(payload.username);
    if (state.users.some((entry) => entry.id !== id && usernameKey(entry.username) === usernameKey(user.username))) throw invalid("Ese nombre de usuario ya está registrado.", 409);
    if (own(payload, "displayName")) user.displayName = normalizeDisplayName(payload.displayName, user.username);
    if (own(payload, "role")) user.role = normalizeRole(payload.role);
    if (own(payload, "permissions")) user.permissions = normalizePermissions(payload.permissions);
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
    if (!Object.keys(changes).length) return publicUser(original);
    const at = timestamp();
    user.sessionVersion += 1; user.legacySessionEligible = false; user.updatedAt = at;
    const next = clone(state);
    next.users = next.users.map((entry) => entry.id === id ? user : entry);
    ensureAdministrator(next.users);
    appendAudit(next, "users.update", administrator, user, changes, at);
    persist(next);
    return publicUser(user);
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
    return publicUser(updated);
  };
  const provisionDeveloperAccount = (payload, actor) => {
    const administrator = requireAdministrator(actor);
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
    appendAudit(next, "users.developer.provision", administrator, developer,
      { protectedIdentity: true, migratedExistingAccount: Boolean(existing) }, at);
    persist(next);
    return publicUser(developer);
  };

  return { filePath, list: () => state.users.map(publicUser), getUser: (id) => publicUser(findUser(id)),
    authenticate, sessionFor, resolveSession, create, update, changeOwnPassword, provisionDeveloperAccount,
    audit: () => clone(state.audit), hasPermission: (identifier, permission) => hasPermission(findUser(identifier), permission) };
}

module.exports = { createLiveUserStore, publicUser, hasPermission, hashPassword, verifyPassword,
  PERMISSION_DEFINITIONS, ROLE_PRESETS, ALL_PERMISSION_IDS, MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH,
  DEVELOPER_USER_ID, DEVELOPER_USERNAME, isDeveloperIdentity };
