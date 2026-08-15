const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { DatabaseSync, backup: backupDatabase } = require("node:sqlite");
const { resolveLuxuryDataDir } = require("./luxury/lib/platform-storage.cjs");

const rootDir = __dirname;
const externalPort = Number.parseInt(process.env.PORT || "8787", 10);
const externalHost = process.env.HOST || "0.0.0.0";
const livePort = Number.parseInt(process.env.LIVE_INTERNAL_PORT || "8791", 10);
const luxuryPort = Number.parseInt(process.env.LUXURY_INTERNAL_PORT || "8792", 10);
const dataDir = path.resolve(process.env.COTIZADOR_DATA_DIR || path.join(rootDir, "data"));
const luxuryDataDir = resolveLuxuryDataDir(dataDir);
const luxuryDataFile = path.join(luxuryDataDir, "luxury-travel.json");
const luxuryMirrorFile = path.join(luxuryDataDir, "luxury-travel-recovery.json");
const luxuryBackupDir = path.join(luxuryDataDir, "luxury-travel-backups");
const legacyLuxuryDataDir = path.join(luxuryDataDir, "luxury-travel");
const legacyLuxuryDataFile = path.join(legacyLuxuryDataDir, "luxury-travel.json");
const luxuryBootstrapMarker = path.join(luxuryDataDir, ".luxury-bootstrap-complete.json");
const luxuryPrefix = "/luxury";
const liveBackupPath = "/__live/backup";
const liveRestorePath = "/__live/restore";
const bootstrapPath = "/__luxury/bootstrap";
const bootstrapStatusPath = "/__luxury/status";
const maxBootstrapBytes = 25 * 1024 * 1024;
const bootstrapPublicKey = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAhYv70h+c08cH7uge3VbKRyCRK3SDT0sFF47ni6yu+SM=
-----END PUBLIC KEY-----`;

let liveChild = null;
let luxuryChild = null;
let server = null;
let shuttingDown = false;
let bootstrapInProgress = false;
let liveRestoreInProgress = false;
let luxuryStorageState = null;

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(luxuryDataDir, { recursive: true });
fs.mkdirSync(luxuryBackupDir, { recursive: true });
fs.mkdirSync(legacyLuxuryDataDir, { recursive: true });

function atomicWrite(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporaryPath, body, { mode: 0o600 });
  fs.renameSync(temporaryPath, filePath);
}

function luxuryRecoveryCandidates() {
  const candidates = [luxuryDataFile, luxuryMirrorFile, legacyLuxuryDataFile];
  for (const backupDir of [luxuryBackupDir, path.join(legacyLuxuryDataDir, "backups")]) {
    try {
      for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          candidates.push(path.join(backupDir, entry.name));
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") console.warn(`No se pudo revisar ${backupDir}: ${error.message}`);
    }
  }
  return [...new Set(candidates)]
    .filter((candidate) => fs.existsSync(candidate))
    .sort((first, second) => fs.statSync(second).mtimeMs - fs.statSync(first).mtimeMs);
}

function prepareLuxuryStorage() {
  if (luxuryStorageState?.initialized && fs.existsSync(luxuryDataFile)) {
    return luxuryStorageState;
  }

  for (const candidate of luxuryRecoveryCandidates()) {
    try {
      const snapshot = JSON.parse(fs.readFileSync(candidate, "utf8"));
      const counts = validateLuxurySnapshot(snapshot);
      const payload = JSON.stringify(snapshot, null, 2);
      if (candidate !== luxuryDataFile) atomicWrite(luxuryDataFile, payload);
      if (candidate !== luxuryMirrorFile) atomicWrite(luxuryMirrorFile, payload);
      atomicWrite(
        luxuryBootstrapMarker,
        JSON.stringify({ recoveredAt: new Date().toISOString(), source: path.basename(candidate), counts }, null, 2),
      );
      luxuryStorageState = { initialized: true, source: candidate, counts };
      return luxuryStorageState;
    } catch (error) {
      console.warn(`Se descartó un respaldo inválido de Luxury Travel (${candidate}): ${error.message}`);
    }
  }

  luxuryStorageState = { initialized: false, source: "", counts: null };
  return luxuryStorageState;
}

function isLuxuryInitialized() {
  return prepareLuxuryStorage().initialized;
}

function childEnvironment(extra = {}) {
  return {
    ...process.env,
    HOST: "127.0.0.1",
    ...extra,
  };
}

function startLive() {
  liveChild = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: rootDir,
    env: childEnvironment({ PORT: String(livePort) }),
    stdio: "inherit",
  });
  liveChild.on("exit", (code, signal) => {
    liveChild = null;
    if (shuttingDown) return;
    console.error(`Live Productions se detuvo (${code ?? signal ?? "sin código"}).`);
    shuttingDown = true;
    if (luxuryChild) luxuryChild.kill("SIGTERM");
    if (server?.listening) {
      server.close(() => process.exit(1));
      setTimeout(() => process.exit(1), 5000).unref();
    } else {
      process.exit(1);
    }
  });
}

function startLuxury() {
  if (luxuryChild || !isLuxuryInitialized()) return;
  luxuryChild = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.join(rootDir, "luxury"),
    env: childEnvironment({
      PORT: String(luxuryPort),
      NODE_ENV: "production",
      DATA_FILE: luxuryDataFile,
      DATA_MIRROR_FILE: luxuryMirrorFile,
      DATA_BACKUP_DIR: luxuryBackupDir,
      COOKIE_SECURE: String(process.env.COOKIE_SECURE || "true"),
      LUXURY_SESSION_COOKIE: "lt_luxury_session",
      LUXURY_ALLOW_HASHED_ADMIN: "true",
      LUXURY_ADMIN_PASSWORD: process.env.LUXURY_ADMIN_PASSWORD || "",
      ALLOW_ROUTE_FALLBACK: process.env.ALLOW_ROUTE_FALLBACK || "true",
    }),
    stdio: "inherit",
  });
  luxuryChild.on("exit", (code, signal) => {
    luxuryChild = null;
    if (shuttingDown) return;
    console.error(`Luxury Travel se detuvo (${code ?? signal ?? "sin código"}); Live Productions continúa activo.`);
    setTimeout(startLuxury, 3000).unref();
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function verifySignedRequest(request, pathname) {
  const timestamp = String(request.headers["x-platform-timestamp"] || "");
  const signatureHeader = String(request.headers["x-platform-signature"] || "");
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60_000) {
    return false;
  }
  const signature = Buffer.from(signatureHeader, "base64");
  if (!signature.length) return false;
  const message = Buffer.from(`${request.method}\n${pathname}\n${timestamp}`, "utf8");
  return crypto.verify(null, message, bootstrapPublicKey, signature);
}

async function createLiveBackupSnapshot() {
  const sourcePath = path.join(dataDir, "cotizaciones.sqlite");
  if (!fs.existsSync(sourcePath)) return null;

  const backupDir = path.join(dataDir, "respaldo-cotizaciones");
  const temporaryPath = path.join(
    backupDir,
    `.platform-live-${process.pid}-${Date.now()}.sqlite`,
  );
  fs.mkdirSync(backupDir, { recursive: true });

  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    await backupDatabase(source, temporaryPath);
    return temporaryPath;
  } catch (error) {
    fs.rmSync(temporaryPath, { force: true });
    throw error;
  } finally {
    source.close();
  }
}

async function downloadLiveBackup(request, response) {
  if (!verifySignedRequest(request, liveBackupPath)) {
    sendJson(response, 403, { error: "La firma de respaldo no es válida." });
    return;
  }

  let backupFile;
  let temporary = false;
  try {
    backupFile = await createLiveBackupSnapshot();
    temporary = Boolean(backupFile);
  } catch (error) {
    console.error(`No se pudo crear el respaldo firmado de Live Productions: ${error.message}`);
  }

  if (!backupFile) {
    backupFile = path.join(dataDir, "respaldo-cotizaciones", "cotizaciones-ultima.sqlite");
  }
  if (!fs.existsSync(backupFile)) {
    sendJson(response, 503, { error: "El respaldo de Live Productions todavía no está disponible." });
    return;
  }

  const cleanup = () => {
    if (temporary) fs.rmSync(backupFile, { force: true });
  };
  const stat = fs.statSync(backupFile);
  response.writeHead(200, {
    "Content-Type": "application/vnd.sqlite3",
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename="live-productions-${new Date()
      .toISOString()
      .slice(0, 10)}.sqlite"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const stream = fs.createReadStream(backupFile);
  stream.on("close", cleanup);
  stream.on("error", (error) => {
    cleanup();
    if (!response.headersSent) sendJson(response, 500, { error: "No se pudo leer el respaldo." });
    else response.destroy(error);
  });
  stream.pipe(response);
}

const liveDatabaseTables = [
  "app_state",
  "quotes",
  "requirement_collaborators",
  "requirement_tasks",
  "requirement_history",
];
const liveRestoreTables = ["app_state", "quotes"];
const protectedRequirementTables = [
  "requirement_collaborators",
  "requirement_tasks",
  "requirement_history",
];

function sqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function inspectLiveDatabase(database) {
  const integrity = database.prepare("PRAGMA integrity_check").all();
  if (integrity.length !== 1 || Object.values(integrity[0])[0] !== "ok") {
    throw new Error("El respaldo SQLite no superó la comprobación de integridad.");
  }

  const availableTables = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name),
  );
  const counts = {};
  const columns = {};
  for (const table of liveDatabaseTables) {
    if (!availableTables.has(table)) {
      throw new Error(`El respaldo SQLite no contiene la tabla ${table}.`);
    }
    const identifier = sqlIdentifier(table);
    counts[table] = Number(database.prepare(`SELECT COUNT(*) AS total FROM ${identifier}`).get().total);
    columns[table] = database
      .prepare(`PRAGMA table_info(${identifier})`)
      .all()
      .map((column) => column.name);
  }
  return { counts, columns };
}

function totalLiveRows(counts) {
  return Object.values(counts).reduce((total, count) => total + Number(count || 0), 0);
}

async function restoreLiveBackup(request, response) {
  if (!verifySignedRequest(request, liveRestorePath)) {
    sendJson(response, 403, { error: "La firma de restauración no es válida." });
    return;
  }
  if (liveRestoreInProgress) {
    sendJson(response, 409, { error: "Ya hay una restauración de Live Productions en curso." });
    return;
  }

  liveRestoreInProgress = true;
  let source;
  let target;
  let temporaryPath = "";
  try {
    const body = await readRequestBody(request);
    fs.mkdirSync(path.join(dataDir, "respaldo-cotizaciones"), { recursive: true });
    temporaryPath = path.join(
      dataDir,
      "respaldo-cotizaciones",
      `.live-restore-${process.pid}-${Date.now()}.sqlite`,
    );
    fs.writeFileSync(temporaryPath, body, { mode: 0o600 });

    source = new DatabaseSync(temporaryPath, { readOnly: true });
    const sourceInfo = inspectLiveDatabase(source);
    if (protectedRequirementTables.some((table) => sourceInfo.counts[table] > 0)) {
      const error = new Error(
        "El respaldo contiene datos históricos de Requerimiento de Equipo y no puede importarse.",
      );
      error.statusCode = 400;
      throw error;
    }
    if (!totalLiveRows(sourceInfo.counts)) {
      const error = new Error("El respaldo de Live Productions está vacío.");
      error.statusCode = 400;
      throw error;
    }

    const targetPath = path.join(dataDir, "cotizaciones.sqlite");
    if (!fs.existsSync(targetPath)) {
      const error = new Error("La base activa de Live Productions todavía no está disponible.");
      error.statusCode = 503;
      throw error;
    }
    target = new DatabaseSync(targetPath);
    target.exec("PRAGMA busy_timeout = 10000");
    const targetInfo = inspectLiveDatabase(target);
    if (totalLiveRows(targetInfo.counts)) {
      const error = new Error(
        "La base activa de Live Productions ya contiene información; la restauración está cerrada.",
      );
      error.statusCode = 409;
      throw error;
    }
    for (const table of liveDatabaseTables) {
      if (JSON.stringify(sourceInfo.columns[table]) !== JSON.stringify(targetInfo.columns[table])) {
        const error = new Error(`La estructura de la tabla ${table} no es compatible.`);
        error.statusCode = 400;
        throw error;
      }
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDirectory = path.join(dataDir, "respaldo-cotizaciones");
    await backupDatabase(target, path.join(backupDirectory, `antes-restaurar-live-${stamp}.sqlite`));

    target.exec("BEGIN IMMEDIATE");
    try {
      for (const table of liveRestoreTables) {
        const columns = sourceInfo.columns[table];
        if (!columns.length || !sourceInfo.counts[table]) continue;
        const tableIdentifier = sqlIdentifier(table);
        const columnList = columns.map(sqlIdentifier).join(", ");
        const placeholders = columns.map(() => "?").join(", ");
        const insert = target.prepare(
          `INSERT INTO ${tableIdentifier} (${columnList}) VALUES (${placeholders})`,
        );
        for (const row of source.prepare(`SELECT ${columnList} FROM ${tableIdentifier}`).all()) {
          insert.run(...columns.map((column) => row[column]));
        }
      }
      target.exec("COMMIT");
    } catch (error) {
      target.exec("ROLLBACK");
      throw error;
    }

    const restoredInfo = inspectLiveDatabase(target);
    if (JSON.stringify(restoredInfo.counts) !== JSON.stringify(sourceInfo.counts)) {
      throw new Error("La verificación posterior no coincide con el respaldo recibido.");
    }
    await backupDatabase(target, path.join(backupDirectory, `live-restaurado-${stamp}.sqlite`));
    sendJson(response, 201, {
      ok: true,
      counts: restoredInfo.counts,
      message: "Live Productions fue restaurado y el acceso de restauración quedó cerrado.",
    });
  } catch (error) {
    sendJson(response, error.statusCode || 400, {
      error: error.message || "No se pudo restaurar Live Productions.",
    });
  } finally {
    try {
      source?.close();
    } catch {}
    try {
      target?.close();
    } catch {}
    if (temporaryPath) fs.rmSync(temporaryPath, { force: true });
    liveRestoreInProgress = false;
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    request.on("data", (chunk) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBootstrapBytes) {
        rejected = true;
        const error = new Error("El respaldo supera el límite permitido.");
        error.statusCode = 413;
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    request.on("error", (error) => {
      if (!rejected) reject(error);
    });
  });
}

function validateLuxurySnapshot(snapshot) {
  const collections = ["users", "clients", "drivers", "vehicles", "quotes", "itineraries", "history"];
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("El respaldo de Luxury Travel no es válido.");
  }
  for (const collection of collections) {
    if (!Array.isArray(snapshot[collection])) {
      throw new Error(`El respaldo no contiene la colección ${collection}.`);
    }
  }
  if (!snapshot.settings || !snapshot.rates) {
    throw new Error("El respaldo no contiene configuración y tarifas.");
  }
  const administrator = snapshot.users.find(
    (user) => user?.role === "administrador" && user?.active !== false && user?.passwordHash,
  );
  if (!administrator) {
    throw new Error("El respaldo no contiene un administrador activo.");
  }
  return Object.fromEntries(collections.map((name) => [name, snapshot[name].length]));
}

async function bootstrapLuxury(request, response) {
  if (isLuxuryInitialized()) {
    sendJson(response, 409, { error: "Luxury Travel ya fue inicializado; el acceso de migración está cerrado." });
    return;
  }
  if (bootstrapInProgress) {
    sendJson(response, 409, { error: "La inicialización de Luxury Travel ya está en curso." });
    return;
  }

  bootstrapInProgress = true;
  try {
    const body = await readRequestBody(request);
    const signatureHeader = String(request.headers["x-luxury-signature"] || "");
    const signature = Buffer.from(signatureHeader, "base64");
    const verified =
      signature.length > 0 && crypto.verify(null, body, bootstrapPublicKey, signature);
    if (!verified) {
      sendJson(response, 403, { error: "La firma del respaldo no es válida." });
      return;
    }

    const snapshot = JSON.parse(body.toString("utf8"));
    const counts = validateLuxurySnapshot(snapshot);
    const payload = JSON.stringify(snapshot, null, 2);
    atomicWrite(luxuryDataFile, payload);
    atomicWrite(luxuryMirrorFile, payload);
    atomicWrite(
      luxuryBootstrapMarker,
      JSON.stringify({ completedAt: new Date().toISOString(), counts }, null, 2),
    );
    luxuryStorageState = { initialized: true, source: luxuryDataFile, counts };
    startLuxury();
    sendJson(response, 201, {
      ok: true,
      counts,
      message: "Luxury Travel fue inicializado y el acceso de migración quedó cerrado.",
    });
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: error.message || "No se pudo importar el respaldo." });
  } finally {
    bootstrapInProgress = false;
  }
}

function rewriteLuxuryResponseHeaders(headers) {
  const rewritten = { ...headers };
  if (rewritten["set-cookie"]) {
    const cookies = Array.isArray(rewritten["set-cookie"])
      ? rewritten["set-cookie"]
      : [rewritten["set-cookie"]];
    rewritten["set-cookie"] = cookies.map((cookie) =>
      String(cookie).replace(/Path=\/(;|$)/i, "Path=/luxury/$1"),
    );
  }
  if (typeof rewritten.location === "string" && rewritten.location.startsWith("/")) {
    rewritten.location = `${luxuryPrefix}${rewritten.location}`;
  }
  return rewritten;
}

function proxyRequest(request, response, targetPort, options = {}) {
  const originalUrl = request.url || "/";
  const forwardedUrl = options.stripPrefix
    ? originalUrl.slice(options.stripPrefix.length) || "/"
    : originalUrl;
  const proxy = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      method: request.method,
      path: forwardedUrl,
      headers: {
        ...request.headers,
        host: `127.0.0.1:${targetPort}`,
        "x-forwarded-host": request.headers.host || "",
        "x-forwarded-proto": request.headers["x-forwarded-proto"] || "https",
        ...(options.stripPrefix ? { "x-forwarded-prefix": options.stripPrefix } : {}),
      },
    },
    (proxyResponse) => {
      const headers = options.stripPrefix
        ? rewriteLuxuryResponseHeaders(proxyResponse.headers)
        : proxyResponse.headers;
      response.writeHead(proxyResponse.statusCode || 502, headers);
      proxyResponse.pipe(response);
    },
  );
  proxy.on("error", (error) => {
    if (!response.headersSent) {
      sendJson(response, 503, {
        error: options.stripPrefix
          ? "Luxury Travel está iniciando. Intente nuevamente en unos segundos."
          : "Live Productions está iniciando. Intente nuevamente en unos segundos.",
      });
    } else {
      response.destroy(error);
    }
  });
  request.pipe(proxy);
}

async function handleRequest(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === bootstrapStatusPath && request.method === "GET") {
    const storage = prepareLuxuryStorage();
    sendJson(response, 200, {
      live: Boolean(liveChild),
      luxuryInitialized: storage.initialized,
      luxuryRunning: Boolean(luxuryChild),
      luxuryPrimary: fs.existsSync(luxuryDataFile),
      luxuryRecovery: fs.existsSync(luxuryMirrorFile),
    });
    return;
  }

  if (url.pathname === liveBackupPath && request.method === "GET") {
    await downloadLiveBackup(request, response);
    return;
  }

  if (url.pathname === liveRestorePath && request.method === "POST") {
    await restoreLiveBackup(request, response);
    return;
  }

  if (url.pathname === bootstrapPath && request.method === "POST") {
    await bootstrapLuxury(request, response);
    return;
  }

  if (url.pathname === luxuryPrefix) {
    response.writeHead(308, { Location: `${luxuryPrefix}/${url.search}` });
    response.end();
    return;
  }

  if (url.pathname.startsWith(`${luxuryPrefix}/`)) {
    if (!isLuxuryInitialized()) {
      sendJson(response, 503, { error: "Luxury Travel está pendiente de inicialización segura." });
      return;
    }
    if (!luxuryChild) startLuxury();
    proxyRequest(request, response, luxuryPort, { stripPrefix: luxuryPrefix });
    return;
  }

  proxyRequest(request, response, livePort);
}

startLive();
startLuxury();

server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (!response.headersSent) sendJson(response, 500, { error: "Error interno de plataforma." });
    else response.destroy(error);
  });
});

server.listen(externalPort, externalHost, () => {
  console.log(`Plataforma Live Productions lista en http://${externalHost}:${externalPort}`);
  console.log(`Live Productions interno: 127.0.0.1:${livePort}`);
  console.log(`Luxury Travel: ${isLuxuryInitialized() ? "inicializado" : "pendiente de migración"}`);
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Cerrando plataforma por ${signal}.`);
  if (liveChild) liveChild.kill("SIGTERM");
  if (luxuryChild) luxuryChild.kill("SIGTERM");
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
