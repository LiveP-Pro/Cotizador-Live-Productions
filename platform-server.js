const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const rootDir = __dirname;
const externalPort = Number.parseInt(process.env.PORT || "8787", 10);
const externalHost = process.env.HOST || "0.0.0.0";
const livePort = Number.parseInt(process.env.LIVE_INTERNAL_PORT || "8791", 10);
const luxuryPort = Number.parseInt(process.env.LUXURY_INTERNAL_PORT || "8792", 10);
const dataDir = path.resolve(process.env.COTIZADOR_DATA_DIR || path.join(rootDir, "data"));
const luxuryDataDir = path.join(dataDir, "luxury-travel");
const luxuryDataFile = path.join(luxuryDataDir, "luxury-travel.json");
const luxuryBootstrapMarker = path.join(luxuryDataDir, ".bootstrap-complete.json");
const luxuryPrefix = "/luxury";
const liveBackupPath = "/__live/backup";
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

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(luxuryDataDir, { recursive: true });

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
  if (luxuryChild || !fs.existsSync(luxuryBootstrapMarker)) return;
  luxuryChild = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: path.join(rootDir, "luxury"),
    env: childEnvironment({
      PORT: String(luxuryPort),
      NODE_ENV: "production",
      DATA_FILE: luxuryDataFile,
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

function downloadLiveBackup(request, response) {
  if (!verifySignedRequest(request, liveBackupPath)) {
    sendJson(response, 403, { error: "La firma de respaldo no es válida." });
    return;
  }
  const backupFile = path.join(dataDir, "respaldo-cotizaciones", "cotizaciones-ultima.sqlite");
  if (!fs.existsSync(backupFile)) {
    sendJson(response, 503, { error: "El respaldo de Live Productions todavía no está disponible." });
    return;
  }
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
  fs.createReadStream(backupFile).pipe(response);
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
        const error = new Error("El respaldo de Luxury Travel supera el límite permitido.");
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
  if (fs.existsSync(luxuryBootstrapMarker)) {
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
    const temporaryDataFile = `${luxuryDataFile}.tmp-${process.pid}`;
    fs.writeFileSync(temporaryDataFile, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
    fs.renameSync(temporaryDataFile, luxuryDataFile);
    fs.writeFileSync(
      luxuryBootstrapMarker,
      JSON.stringify({ completedAt: new Date().toISOString(), counts }, null, 2),
      { mode: 0o600 },
    );
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
    sendJson(response, 200, {
      live: Boolean(liveChild),
      luxuryInitialized: fs.existsSync(luxuryBootstrapMarker),
      luxuryRunning: Boolean(luxuryChild),
    });
    return;
  }

  if (url.pathname === liveBackupPath && request.method === "GET") {
    downloadLiveBackup(request, response);
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
    if (!fs.existsSync(luxuryBootstrapMarker)) {
      sendJson(response, 503, { error: "Luxury Travel está pendiente de inicialización segura." });
      return;
    }
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
  console.log(`Luxury Travel: ${fs.existsSync(luxuryBootstrapMarker) ? "inicializado" : "pendiente de migración"}`);
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
