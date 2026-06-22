const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawn, spawnSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const rootDir = __dirname;
const port = Number.parseInt(process.env.PORT || "8787", 10);
const host = process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
const macBundleAppPath = `${path.sep}Cotizador Live Productions.app${path.sep}Contents${path.sep}Resources${path.sep}app`;
const defaultDataDir =
  process.platform === "darwin" && rootDir.includes(macBundleAppPath)
    ? path.join(os.homedir(), "Documents", "Cotizador Live Productions")
    : rootDir;
const dataDir = process.env.COTIZADOR_DATA_DIR
  ? path.resolve(process.env.COTIZADOR_DATA_DIR)
  : defaultDataDir;
const pdfDir = path.join(dataDir, "cotizaciones-generadas");
const backupDir = path.join(dataDir, "respaldo-cotizaciones");
const dbPath = path.join(dataDir, "cotizaciones.sqlite");
const maxBodyBytes = 100 * 1024 * 1024;
const quoteSequenceStart = 10757n;
const whatsappConfig = {
  apiVersion: process.env.WHATSAPP_API_VERSION || "v23.0",
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN || ""
};
let saveQueue = Promise.resolve();
let cachedBrowserPath;
let pdfEnginePromise;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8"
};

fs.mkdirSync(pdfDir, { recursive: true });
fs.mkdirSync(backupDir, { recursive: true });

const authConfigPath = path.join(dataDir, "cotizador-auth.json");
const defaultPasswordHash = {
  algorithm: "pbkdf2-sha256",
  iterations: 210000,
  salt: "4735e732b458c196f2d378103a6102da",
  hash: "982f65163a62c92be2eeada89a8a42284a594e7e5391bc11fb13c0d32581fe10"
};

function hashPassword(password, salt, iterations = defaultPasswordHash.iterations) {
  return crypto.pbkdf2Sync(String(password || ""), salt, iterations, 32, "sha256").toString("hex");
}

function newPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return {
    algorithm: "pbkdf2-sha256",
    iterations: defaultPasswordHash.iterations,
    salt,
    hash: hashPassword(password, salt)
  };
}

function loadAuthConfig() {
  const envPassword = process.env.COTIZADOR_ADMIN_PASSWORD;
  const envHash = process.env.COTIZADOR_ADMIN_PASSWORD_HASH;
  const envSalt = process.env.COTIZADOR_ADMIN_PASSWORD_SALT;
  const envIterations = Number.parseInt(process.env.COTIZADOR_ADMIN_PASSWORD_ITERATIONS || "", 10);
  const envConfig = {
    username: process.env.COTIZADOR_ADMIN_USER || "LiveAdmon",
    password: envPassword
      ? newPasswordHash(envPassword)
      : envHash && envSalt
        ? {
            algorithm: "pbkdf2-sha256",
            iterations: Number.isFinite(envIterations) && envIterations > 0 ? envIterations : defaultPasswordHash.iterations,
            salt: envSalt,
            hash: envHash
          }
        : defaultPasswordHash,
    sessionSecret: process.env.COTIZADOR_SESSION_SECRET || crypto.randomBytes(32).toString("hex")
  };

  try {
    const stored = JSON.parse(fs.readFileSync(authConfigPath, "utf8"));
    return {
      username: String(stored.username || envConfig.username),
      password: stored.password?.hash ? stored.password : envConfig.password,
      sessionSecret: String(stored.sessionSecret || envConfig.sessionSecret)
    };
  } catch {
    fs.writeFileSync(authConfigPath, JSON.stringify(envConfig, null, 2), { mode: 0o600 });
    return envConfig;
  }
}

const authConfig = loadAuthConfig();

const db = new DatabaseSync(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT NOT NULL,
    quote_code TEXT,
    quote_date TEXT,
    event_date TEXT,
    client_name TEXT,
    client_phone TEXT,
    event_place TEXT,
    package_name TEXT,
    service_name TEXT,
    total REAL,
    file_name TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    quote_data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requirement_collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_key TEXT UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requirement_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_key TEXT UNIQUE,
    collaborator_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente',
    done_token TEXT NOT NULL UNIQUE,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collaborator_id) REFERENCES requirement_collaborators(id)
  );

  CREATE TABLE IF NOT EXISTS requirement_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    collaborator_id INTEGER,
    action TEXT NOT NULL,
    collaborator_name TEXT,
    collaborator_phone TEXT,
    description TEXT,
    status TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes (quote_number);
  CREATE INDEX IF NOT EXISTS idx_quotes_client_name ON quotes (client_name);
  CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes (quote_date);
  CREATE INDEX IF NOT EXISTS idx_quotes_event_date ON quotes (event_date);
  CREATE INDEX IF NOT EXISTS idx_requirement_tasks_collaborator ON requirement_tasks (collaborator_id);
  CREATE INDEX IF NOT EXISTS idx_requirement_tasks_status ON requirement_tasks (status);
  CREATE INDEX IF NOT EXISTS idx_requirement_history_created ON requirement_history (created_at);
`);

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function writeDatabaseBackup(backupPath) {
  const tempPath = path.join(
    backupDir,
    `.tmp-${path.basename(backupPath)}-${process.pid}-${Date.now()}`
  );
  try {
    db.exec(`VACUUM INTO ${sqlLiteral(tempPath)}`);
    fs.renameSync(tempPath, backupPath);
  } catch (error) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {}
    throw error;
  }
}

function createDailyDatabaseBackup() {
  try {
    const quoteTotal = db.prepare("SELECT COUNT(*) AS total FROM quotes").get().total;
    const requirementTotal = db.prepare("SELECT COUNT(*) AS total FROM requirement_tasks").get().total;
    const total = quoteTotal + requirementTotal;
    if (!total) return;

    const today = new Date().toISOString().slice(0, 10);
    const backupPath = path.join(backupDir, `cotizaciones-${today}.sqlite`);
    if (!fs.existsSync(backupPath)) writeDatabaseBackup(backupPath);
    writeDatabaseBackup(path.join(backupDir, "cotizaciones-ultima.sqlite"));
  } catch (error) {
    console.warn(`No se pudo crear respaldo de cotizaciones: ${error.message}`);
  }
}

createDailyDatabaseBackup();

function jsonResponse(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function errorResponse(response, statusCode, message) {
  jsonResponse(response, statusCode, { error: message });
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function timingSafeTextEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((cookies, item) => {
      const separator = item.indexOf("=");
      if (separator === -1) return cookies;
      cookies[decodeURIComponent(item.slice(0, separator))] = decodeURIComponent(item.slice(separator + 1));
      return cookies;
    }, {});
}

function signSession(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", authConfig.sessionSecret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifySessionToken(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return null;
  const expected = crypto
    .createHmac("sha256", authConfig.sessionSecret)
    .update(body)
    .digest("base64url");
  if (!timingSafeTextEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.user !== authConfig.username) return null;
    return payload;
  } catch {
    return null;
  }
}

function authenticatedUser(request) {
  const cookies = parseCookies(request);
  const session = verifySessionToken(cookies.cotizador_session);
  return session?.user || "";
}

function sessionCookie(request, token) {
  const secure =
    request.headers["x-forwarded-proto"] === "https" ||
    request.socket.encrypted ||
    process.env.NODE_ENV === "production";
  return [
    `cotizador_session=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=604800",
    secure ? "Secure" : ""
  ]
    .filter(Boolean)
    .join("; ");
}

function expiredSessionCookie() {
  return "cotizador_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function verifyCredentials(username, password) {
  if (String(username || "") !== authConfig.username) return false;
  const passwordConfig = authConfig.password || defaultPasswordHash;
  const candidate = hashPassword(password, passwordConfig.salt, passwordConfig.iterations);
  return timingSafeTextEqual(candidate, passwordConfig.hash);
}

function requireAuth(request, response) {
  if (authenticatedUser(request)) return true;
  errorResponse(response, 401, "Inicie sesión para continuar.");
  return false;
}

function cleanFileName(value) {
  const baseName = path.basename(String(value || "cotizacion.pdf"));
  const cleanName = baseName
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const withName = cleanName || "cotizacion.pdf";
  return withName.toLocaleLowerCase("es-GT").endsWith(".pdf") ? withName : `${withName}.pdf`;
}

function uniquePdfTarget(fileName) {
  const parsed = path.parse(cleanFileName(fileName));
  let candidate = `${parsed.name}${parsed.ext}`;
  let target = path.join(pdfDir, candidate);
  let counter = 2;

  while (fs.existsSync(target)) {
    candidate = `${parsed.name}-${counter}${parsed.ext}`;
    target = path.join(pdfDir, candidate);
    counter += 1;
  }

  return { fileName: candidate, target };
}

function pdfUrl(fileName) {
  return `/cotizaciones-generadas/${encodeURIComponent(fileName)}`;
}

function publicOrigin(request) {
  const hostHeader = request.headers["x-forwarded-host"] || request.headers.host || "";
  const protoHeader = request.headers["x-forwarded-proto"] || "";
  const proto = protoHeader ? String(protoHeader).split(",")[0].trim() : request.socket.encrypted ? "https" : "http";
  const hostName = String(hostHeader).split(",")[0].trim();
  return hostName ? `${proto}://${hostName}` : "";
}

function absolutePdfUrl(request, fileName) {
  const origin = publicOrigin(request);
  return origin ? new URL(pdfUrl(fileName), origin).href : pdfUrl(fileName);
}

function existingPdfPath(row) {
  const storedPath = path.resolve(String(row?.pdf_path || ""));
  if (storedPath.startsWith(pdfDir)) return storedPath;
  return path.join(pdfDir, row.file_name);
}

function updatePdfTarget(row) {
  return {
    fileName: row.file_name,
    target: existingPdfPath(row)
  };
}

function browserCandidates() {
  const candidates = [];
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);

  if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    );
  }

  if (process.platform === "win32") {
    const programFiles = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]
      .filter(Boolean);
    programFiles.forEach((basePath) => {
      candidates.push(
        path.join(basePath, "Google", "Chrome", "Application", "chrome.exe"),
        path.join(basePath, "Microsoft", "Edge", "Application", "msedge.exe")
      );
    });
  }

  candidates.push("google-chrome", "chrome", "chromium", "chromium-browser", "msedge");
  return candidates;
}

function findBrowserExecutable() {
  if (cachedBrowserPath !== undefined) return cachedBrowserPath;

  for (const candidate of browserCandidates()) {
    if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
      cachedBrowserPath = candidate;
      return cachedBrowserPath;
    }
    if (!path.isAbsolute(candidate)) {
      const result = spawnSync(candidate, ["--version"], { stdio: "ignore" });
      if (result.status === 0) {
        cachedBrowserPath = candidate;
        return cachedBrowserPath;
      }
    }
  }

  cachedBrowserPath = "";
  return cachedBrowserPath;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForDevToolsPort(profileDir, child) {
  const activePortFile = path.join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Chrome se cerró antes de preparar el motor de PDF.");
    }

    try {
      const [portLine] = (await fsp.readFile(activePortFile, "utf8")).trim().split(/\r?\n/);
      const debugPort = Number.parseInt(portLine, 10);
      if (Number.isFinite(debugPort) && debugPort > 0) return debugPort;
    } catch {
      // Chrome creates DevToolsActivePort after its profile is ready.
    }

    await wait(50);
  }

  throw new Error("Chrome tardó demasiado en preparar el motor de PDF.");
}

class CdpConnection {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("No se pudo conectar con el motor de PDF.")),
        8000
      );
      this.socket.addEventListener(
        "open",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true }
      );
      this.socket.addEventListener(
        "error",
        () => {
          clearTimeout(timeout);
          reject(new Error("No se pudo conectar con el motor de PDF."));
        },
        { once: true }
      );
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(
        typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8")
      );
      if (!message.id || !this.pending.has(message.id)) return;

      const { resolve, reject, timeout } = this.pending.get(message.id);
      clearTimeout(timeout);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "Chrome no pudo generar el PDF."));
      else resolve(message.result || {});
    });

    this.socket.addEventListener("close", () => {
      this.rejectPending(new Error("El motor de PDF se cerró inesperadamente."));
    });
  }

  rejectPending(error) {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}, sessionId) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("El motor de PDF no está disponible."));
    }

    const id = this.nextId;
    this.nextId += 1;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome tardó demasiado al ejecutar ${method}.`));
      }, 20000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify(message));
    });
  }

  close() {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) this.socket.close();
    this.rejectPending(new Error("El motor de PDF fue cerrado."));
  }
}

class ReusablePdfEngine {
  constructor(browserPath, profileDir, child, connection, targetId, sessionId, frameId) {
    this.browserPath = browserPath;
    this.profileDir = profileDir;
    this.child = child;
    this.connection = connection;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.frameId = frameId;
    this.closed = false;
  }

  static async create(browserPath) {
    const profileDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cotizador-live-browser-"));
    const args = [
      "--headless=new",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-component-update",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-allow-origins=*",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "about:blank"
    ];
    const child = spawn(browserPath, args, { stdio: ["ignore", "ignore", "ignore"] });

    try {
      const debugPort = await waitForDevToolsPort(profileDir, child);
      const versionResponse = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (!versionResponse.ok) throw new Error("Chrome no publicó su interfaz de impresión.");
      const version = await versionResponse.json();
      const connection = new CdpConnection(version.webSocketDebuggerUrl);
      await connection.connect();
      const { targetId } = await connection.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await connection.send("Target.attachToTarget", {
        targetId,
        flatten: true
      });
      await connection.send("Page.enable", {}, sessionId);
      await connection.send("Runtime.enable", {}, sessionId);
      const { frameTree } = await connection.send("Page.getFrameTree", {}, sessionId);
      const engine = new ReusablePdfEngine(
        browserPath,
        profileDir,
        child,
        connection,
        targetId,
        sessionId,
        frameTree.frame.id
      );
      child.once("exit", () => {
        engine.closed = true;
      });
      return engine;
    } catch (error) {
      child.kill();
      await fsp.rm(profileDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  async print(html, pdfPath) {
    if (this.closed) throw new Error("El motor de PDF ya no está disponible.");

    await this.connection.send(
      "Page.setDocumentContent",
      { frameId: this.frameId, html },
      this.sessionId
    );
    await this.connection.send(
      "Runtime.evaluate",
      {
        expression: `new Promise((resolve) => {
          const images = [...document.images];
          const imageReady = images.map((image) => image.complete
            ? Promise.resolve()
            : new Promise((done) => {
                image.addEventListener("load", done, { once: true });
                image.addEventListener("error", done, { once: true });
              }));
          Promise.all([document.fonts ? document.fonts.ready : Promise.resolve(), ...imageReady])
            .then(() => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        })`,
        awaitPromise: true,
        returnByValue: true
      },
      this.sessionId
    );
    const renderCheck = await this.connection.send(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const documentNode = document.querySelector("#quoteDocument");
          const quotePage = document.querySelector(".quote-document");
          const rect = quotePage ? quotePage.getBoundingClientRect() : null;
          const text = (document.body?.innerText || "").replace(/\\s+/g, " ").trim();
          const images = [...document.images].length;
          if (!documentNode || !quotePage) {
            return { ok: false, message: "No se encontró la cotización dentro del HTML enviado al PDF." };
          }
          if (!rect || rect.width < 100 || rect.height < 100) {
            return { ok: false, message: "La cotización no tiene tamaño visible para imprimir." };
          }
          if (text.length < 20 && images === 0) {
            return { ok: false, message: "La cotización no tiene contenido visible para guardar." };
          }
          return { ok: true, textLength: text.length, width: rect.width, height: rect.height, images };
        })()`,
        returnByValue: true
      },
      this.sessionId
    );
    const check = renderCheck.result?.value || {};
    if (!check.ok) throw new Error(check.message || "No se pudo preparar el contenido del PDF.");
    const { data } = await this.connection.send(
      "Page.printToPDF",
      {
        displayHeaderFooter: false,
        printBackground: true,
        preferCSSPageSize: true,
        paperWidth: 8.5,
        paperHeight: 13,
        marginTop: 0.18,
        marginBottom: 0.18,
        marginLeft: 0.18,
        marginRight: 0.18
      },
      this.sessionId
    );
    if (!data) throw new Error("Chrome generó un PDF vacío.");
    await fsp.writeFile(pdfPath, Buffer.from(data, "base64"));
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.connection.send("Browser.close").catch(() => {});
    this.connection.close();
    if (this.child.exitCode === null) this.child.kill();
    await fsp.rm(this.profileDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function getPdfEngine(browserPath) {
  if (!pdfEnginePromise) {
    pdfEnginePromise = ReusablePdfEngine.create(browserPath).catch((error) => {
      pdfEnginePromise = null;
      throw error;
    });
  }
  const engine = await pdfEnginePromise;
  if (engine.closed) {
    pdfEnginePromise = null;
    return getPdfEngine(browserPath);
  }
  return engine;
}

async function resetPdfEngine() {
  if (!pdfEnginePromise) return;
  const enginePromise = pdfEnginePromise;
  pdfEnginePromise = null;
  const engine = await enginePromise.catch(() => null);
  if (engine) await engine.close();
}

function runBrowserPrint(browserPath, htmlPath, pdfPath, profileDir) {
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-pdf-header-footer",
    "--print-to-pdf-no-header",
    `--user-data-dir=${profileDir}`,
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(browserPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let finished = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const pdfExists = () => {
      try {
        return fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0;
      } catch {
        return false;
      }
    };
    const timeout = setTimeout(() => {
      if (pdfExists()) {
        child.kill("SIGTERM");
        finish();
        return;
      }

      child.kill("SIGKILL");
      finish(new Error("Chrome tardó demasiado en generar el PDF."));
    }, 20000);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", finish);
    child.on("close", (code) => {
      if (code === 0 || pdfExists()) finish();
      else finish(new Error(stderr.trim() || `Chrome terminó con código ${code}.`));
    });
  });
}

async function generatePdf(html, pdfPath) {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    throw new Error("No se encontró Google Chrome, Microsoft Edge o Chromium para generar el PDF.");
  }

  try {
    const engine = await getPdfEngine(browserPath);
    await engine.print(html, pdfPath);
    const stat = await fsp.stat(pdfPath);
    if (!stat.size) throw new Error("El PDF se generó vacío.");
    return;
  } catch (error) {
    await resetPdfEngine();
    if (
      /cotizaci[oó]n|contenido|visible|imprimir/i.test(error.message || "")
    ) {
      throw error;
    }
  }

  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cotizador-live-"));
  const htmlPath = path.join(tempDir, "cotizacion.html");
  const profileDir = path.join(tempDir, "chrome-profile");

  try {
    await fsp.writeFile(htmlPath, html, "utf8");
    await fsp.mkdir(profileDir, { recursive: true });
    await runBrowserPrint(browserPath, htmlPath, pdfPath, profileDir);
    const stat = await fsp.stat(pdfPath);
    if (!stat.size) throw new Error("El PDF se generó vacío.");
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await resetPdfEngine();
    process.exit(0);
  });
}

function rowToRecord(row) {
  return {
    id: row.id,
    quoteNumber: row.quote_number,
    quoteCode: row.quote_code,
    quoteDate: row.quote_date,
    eventDate: row.event_date,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    eventPlace: row.event_place,
    packageName: row.package_name,
    serviceName: row.service_name,
    total: row.total,
    fileName: row.file_name,
    pdfUrl: pdfUrl(row.file_name),
    createdAt: row.created_at
  };
}

function listQuotes(search) {
  const text = String(search || "").trim();
  const limit = 80;

  if (!text) {
    return db
      .prepare(`
        SELECT * FROM quotes
        ORDER BY length(quote_number) DESC, quote_number DESC, id DESC
        LIMIT ?
      `)
      .all(limit)
      .map(rowToRecord);
  }

  const contains = `%${text}%`;
  const startsWith = `${text}%`;
  return db
    .prepare(`
      SELECT * FROM quotes
      WHERE quote_number LIKE ?
         OR quote_code LIKE ?
         OR client_name LIKE ?
         OR client_phone LIKE ?
         OR quote_date LIKE ?
         OR event_date LIKE ?
         OR event_place LIKE ?
         OR file_name LIKE ?
      ORDER BY length(quote_number) DESC, quote_number DESC, id DESC
      LIMIT ?
    `)
    .all(startsWith, contains, contains, contains, contains, contains, contains, contains, limit)
    .map(rowToRecord);
}

function getQuote(id) {
  const row = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  if (!row) return null;
  return {
    record: rowToRecord(row),
    quoteData: JSON.parse(row.quote_data)
  };
}

function normalizeWhatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 8) return `502${digits}`;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanRequirementText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeRequirementStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return status === "realizado" || status === "hecho" || status === "done" ? "realizado" : "pendiente";
}

function newRequirementToken() {
  return crypto.randomBytes(18).toString("base64url");
}

function requirementDoneUrl(request, token) {
  const origin = publicOrigin(request);
  const pathName = `/requerimientos/realizado/${encodeURIComponent(token)}`;
  return origin ? new URL(pathName, origin).href : pathName;
}

function requirementHistoryLabel(action) {
  if (action === "task_created") return "Tarea creada";
  if (action === "task_status") return "Estado actualizado";
  if (action === "task_sent") return "WhatsApp enviado";
  if (action === "task_done_whatsapp") return "Realizado desde WhatsApp";
  if (action === "collaborator_created") return "Colaborador creado";
  if (action === "collaborator_updated") return "Colaborador actualizado";
  if (action === "local_import") return "Historial importado";
  return "Actualización";
}

function collaboratorRecord(row) {
  return {
    id: String(row.id),
    name: row.name,
    phone: row.phone,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function taskRecord(row, request) {
  return {
    id: String(row.id),
    collaboratorId: String(row.collaborator_id),
    description: row.description,
    text: row.description,
    status: normalizeRequirementStatus(row.status),
    doneUrl: requirementDoneUrl(request, row.done_token),
    sentAt: row.sent_at || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function historyRecord(row) {
  return {
    id: String(row.id),
    taskId: row.task_id ? String(row.task_id) : "",
    collaboratorId: row.collaborator_id ? String(row.collaborator_id) : "",
    action: row.action,
    actionLabel: requirementHistoryLabel(row.action),
    collaboratorName: row.collaborator_name || "",
    collaboratorPhone: row.collaborator_phone || "",
    description: row.description || "",
    status: normalizeRequirementStatus(row.status),
    createdAt: row.created_at
  };
}

function recordRequirementHistory({
  taskId = null,
  collaboratorId = null,
  action,
  collaboratorName = "",
  collaboratorPhone = "",
  description = "",
  status = "pendiente",
  createdAt = nowIso()
}) {
  db.prepare(`
    INSERT INTO requirement_history (
      task_id,
      collaborator_id,
      action,
      collaborator_name,
      collaborator_phone,
      description,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    taskId,
    collaboratorId,
    action,
    collaboratorName,
    collaboratorPhone,
    description,
    normalizeRequirementStatus(status),
    createdAt
  );
}

function listRequirements(request) {
  const collaborators = db
    .prepare(`
      SELECT *
      FROM requirement_collaborators
      WHERE archived = 0
      ORDER BY lower(name), id
    `)
    .all()
    .map((row) => ({ ...collaboratorRecord(row), tasks: [] }));

  const collaboratorMap = new Map(collaborators.map((collaborator) => [collaborator.id, collaborator]));
  db.prepare(`
    SELECT *
    FROM requirement_tasks
    ORDER BY updated_at DESC, id DESC
  `)
    .all()
    .forEach((row) => {
      const collaborator = collaboratorMap.get(String(row.collaborator_id));
      if (collaborator) collaborator.tasks.push(taskRecord(row, request));
    });

  const history = db
    .prepare(`
      SELECT *
      FROM requirement_history
      ORDER BY created_at DESC, id DESC
      LIMIT 500
    `)
    .all()
    .map(historyRecord);

  return { collaborators, history };
}

function getRequirementCollaborator(id) {
  return db
    .prepare("SELECT * FROM requirement_collaborators WHERE id = ? AND archived = 0")
    .get(id);
}

function findExistingRequirementCollaborator(name, phone) {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  return db
    .prepare("SELECT * FROM requirement_collaborators WHERE archived = 0")
    .all()
    .find((row) => {
      const sameName = row.name.toLocaleLowerCase("es-GT") === name.toLocaleLowerCase("es-GT");
      const samePhone = normalizedPhone && normalizeWhatsappPhone(row.phone) === normalizedPhone;
      return sameName || samePhone;
    }) || null;
}

function getRequirementTask(id) {
  return db
    .prepare(`
      SELECT t.*, c.name AS collaborator_name, c.phone AS collaborator_phone
      FROM requirement_tasks t
      JOIN requirement_collaborators c ON c.id = t.collaborator_id
      WHERE t.id = ?
    `)
    .get(id);
}

function createRequirementCollaborator(payload, request, response) {
  const name = cleanRequirementText(payload.name);
  const phone = cleanRequirementText(payload.phone);
  if (!name || !phone) {
    errorResponse(response, 400, "Agregue nombre del colaborador y número de WhatsApp.");
    return;
  }

  const existing = findExistingRequirementCollaborator(name, phone);
  const now = nowIso();
  if (existing) {
    db.prepare(`
      UPDATE requirement_collaborators
      SET name = ?, phone = ?, updated_at = ?
      WHERE id = ?
    `).run(name, phone, now, existing.id);
    recordRequirementHistory({
      collaboratorId: existing.id,
      action: "collaborator_updated",
      collaboratorName: name,
      collaboratorPhone: phone,
      description: "Colaborador existente actualizado",
      status: "pendiente",
      createdAt: now
    });
    createDailyDatabaseBackup();
    jsonResponse(response, 200, listRequirements(request));
    return;
  }

  const result = db
    .prepare(`
      INSERT INTO requirement_collaborators (client_key, name, phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(payload.clientKey || null, name, phone, now, now);

  recordRequirementHistory({
    collaboratorId: Number(result.lastInsertRowid),
    action: "collaborator_created",
    collaboratorName: name,
    collaboratorPhone: phone,
    description: "Colaborador agregado",
    status: "pendiente",
    createdAt: now
  });

  createDailyDatabaseBackup();
  jsonResponse(response, 201, listRequirements(request));
}

function updateRequirementCollaborator(id, payload, request, response) {
  const existing = getRequirementCollaborator(id);
  if (!existing) {
    errorResponse(response, 404, "No se encontró el colaborador.");
    return;
  }

  const name = cleanRequirementText(payload.name);
  const phone = cleanRequirementText(payload.phone);
  if (!name || !phone) {
    errorResponse(response, 400, "Agregue nombre del colaborador y número de WhatsApp.");
    return;
  }

  const now = nowIso();
  db.prepare(`
    UPDATE requirement_collaborators
    SET name = ?, phone = ?, updated_at = ?
    WHERE id = ?
  `).run(name, phone, now, id);

  recordRequirementHistory({
    collaboratorId: id,
    action: "collaborator_updated",
    collaboratorName: name,
    collaboratorPhone: phone,
    description: `Antes: ${existing.name} / ${existing.phone}`,
    status: "pendiente",
    createdAt: now
  });

  createDailyDatabaseBackup();
  jsonResponse(response, 200, listRequirements(request));
}

function createRequirementTask(payload, request, response) {
  const collaboratorId = Number(payload.collaboratorId);
  const collaborator = getRequirementCollaborator(collaboratorId);
  if (!collaborator) {
    errorResponse(response, 404, "No se encontró el colaborador.");
    return;
  }

  const description = String(payload.description || payload.text || "").trim();
  if (!description) {
    errorResponse(response, 400, "Escriba el requerimiento antes de crear la tarea.");
    return;
  }

  const now = nowIso();
  const status = normalizeRequirementStatus(payload.status);
  const doneToken = newRequirementToken();
  const sentAt = payload.sent ? now : "";
  const result = db
    .prepare(`
      INSERT INTO requirement_tasks (
        client_key,
        collaborator_id,
        description,
        status,
        done_token,
        sent_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(payload.clientKey || null, collaboratorId, description, status, doneToken, sentAt, now, now);

  const taskId = Number(result.lastInsertRowid);
  recordRequirementHistory({
    taskId,
    collaboratorId,
    action: "task_created",
    collaboratorName: collaborator.name,
    collaboratorPhone: collaborator.phone,
    description,
    status,
    createdAt: now
  });

  if (sentAt) {
    recordRequirementHistory({
      taskId,
      collaboratorId,
      action: "task_sent",
      collaboratorName: collaborator.name,
      collaboratorPhone: collaborator.phone,
      description,
      status,
      createdAt: now
    });
  }

  createDailyDatabaseBackup();
  const row = getRequirementTask(taskId);
  jsonResponse(response, 201, {
    task: taskRecord(row, request),
    requirements: listRequirements(request)
  });
}

function updateRequirementTaskStatus(id, payload, request, response) {
  const task = getRequirementTask(id);
  if (!task) {
    errorResponse(response, 404, "No se encontró la tarea.");
    return;
  }

  const status = normalizeRequirementStatus(payload.status);
  const now = nowIso();
  db.prepare("UPDATE requirement_tasks SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);

  recordRequirementHistory({
    taskId: id,
    collaboratorId: task.collaborator_id,
    action: "task_status",
    collaboratorName: task.collaborator_name,
    collaboratorPhone: task.collaborator_phone,
    description: task.description,
    status,
    createdAt: now
  });

  createDailyDatabaseBackup();
  jsonResponse(response, 200, listRequirements(request));
}

function markRequirementTaskSent(id, request, response) {
  const task = getRequirementTask(id);
  if (!task) {
    errorResponse(response, 404, "No se encontró la tarea.");
    return;
  }

  const now = nowIso();
  db.prepare("UPDATE requirement_tasks SET sent_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
  recordRequirementHistory({
    taskId: id,
    collaboratorId: task.collaborator_id,
    action: "task_sent",
    collaboratorName: task.collaborator_name,
    collaboratorPhone: task.collaborator_phone,
    description: task.description,
    status: task.status,
    createdAt: now
  });

  createDailyDatabaseBackup();
  jsonResponse(response, 200, listRequirements(request));
}

function importRequirementState(payload, request, response) {
  const collaborators = Array.isArray(payload.collaborators) ? payload.collaborators : [];
  let importedTasks = 0;
  const now = nowIso();

  db.exec("BEGIN IMMEDIATE");
  try {
    collaborators.forEach((collaborator) => {
      const name = cleanRequirementText(collaborator.name);
      const phone = cleanRequirementText(collaborator.phone);
      if (!name || !phone) return;

      const clientKey = collaborator.id ? `local-collaborator:${collaborator.id}` : null;
      let row = clientKey
        ? db.prepare("SELECT * FROM requirement_collaborators WHERE client_key = ?").get(clientKey)
        : null;

      if (!row) {
        const result = db
          .prepare(`
            INSERT INTO requirement_collaborators (client_key, name, phone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `)
          .run(clientKey, name, phone, collaborator.createdAt || now, collaborator.updatedAt || now);
        row = { id: Number(result.lastInsertRowid), name, phone };
        recordRequirementHistory({
          collaboratorId: row.id,
          action: "local_import",
          collaboratorName: name,
          collaboratorPhone: phone,
          description: "Colaborador importado desde historial local",
          status: "pendiente",
          createdAt: now
        });
      }

      (Array.isArray(collaborator.tasks) ? collaborator.tasks : []).forEach((task) => {
        const description = String(task.description || task.text || "").trim();
        if (!description) return;
        const taskClientKey = task.id ? `local-task:${task.id}` : null;
        if (taskClientKey) {
          const existingTask = db.prepare("SELECT id FROM requirement_tasks WHERE client_key = ?").get(taskClientKey);
          if (existingTask) return;
        }

        const taskStatus = normalizeRequirementStatus(task.status);
        const taskCreatedAt = task.createdAt || now;
        const taskUpdatedAt = task.updatedAt || taskCreatedAt;
        const result = db
          .prepare(`
            INSERT INTO requirement_tasks (
              client_key,
              collaborator_id,
              description,
              status,
              done_token,
              sent_at,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            taskClientKey,
            row.id,
            description,
            taskStatus,
            newRequirementToken(),
            task.sentAt || "",
            taskCreatedAt,
            taskUpdatedAt
          );
        importedTasks += 1;
        recordRequirementHistory({
          taskId: Number(result.lastInsertRowid),
          collaboratorId: row.id,
          action: "local_import",
          collaboratorName: row.name,
          collaboratorPhone: row.phone,
          description,
          status: taskStatus,
          createdAt: now
        });
      });
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  createDailyDatabaseBackup();
  jsonResponse(response, 200, {
    importedTasks,
    ...listRequirements(request)
  });
}

function completeRequirementByToken(token, response) {
  const task = db
    .prepare(`
      SELECT t.*, c.name AS collaborator_name, c.phone AS collaborator_phone
      FROM requirement_tasks t
      JOIN requirement_collaborators c ON c.id = t.collaborator_id
      WHERE t.done_token = ?
    `)
    .get(token);

  if (!task) {
    response.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tarea no encontrada</title></head><body><h1>Tarea no encontrada</h1><p>El enlace de realizado no existe o ya no está disponible.</p></body></html>`);
    return;
  }

  const now = nowIso();
  if (normalizeRequirementStatus(task.status) !== "realizado") {
    db.prepare("UPDATE requirement_tasks SET status = 'realizado', updated_at = ? WHERE id = ?").run(now, task.id);
    recordRequirementHistory({
      taskId: task.id,
      collaboratorId: task.collaborator_id,
      action: "task_done_whatsapp",
      collaboratorName: task.collaborator_name,
      collaboratorPhone: task.collaborator_phone,
      description: task.description,
      status: "realizado",
      createdAt: now
    });
    createDailyDatabaseBackup();
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Tarea realizada - Live Productions</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f4f7;color:#171717;font-family:Arial,Helvetica,sans-serif}
      main{width:min(560px,calc(100% - 32px));padding:28px;background:#fff;border:1px solid #d8dce2;border-radius:8px;box-shadow:0 18px 55px rgba(23,23,23,.12)}
      p{line-height:1.45}.eyebrow{margin:0 0 8px;color:#63666d;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
      h1{margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1}
      .status{display:inline-block;margin-top:12px;padding:8px 11px;color:#17633a;background:#e0f2e7;border-radius:999px;font-size:12px;font-weight:800;text-transform:uppercase}
    </style>
  </head>
  <body>
    <main>
      <p class="eyebrow">Live Productions</p>
      <h1>Tarea marcada como realizada</h1>
      <p><strong>${escapeHtml(task.collaborator_name)}</strong>, la tarea quedó actualizada en el historial compartido.</p>
      <p>${escapeHtml(task.description)}</p>
      <span class="status">Realizado</span>
    </main>
  </body>
</html>`);
}

function whatsappIsConfigured() {
  return Boolean(whatsappConfig.phoneNumberId && whatsappConfig.accessToken);
}

async function readWhatsappResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function sendWhatsappDocument({ to, pdfLink, fileName, caption }) {
  if (!whatsappIsConfigured()) {
    throw new Error(
      "WhatsApp PDF no esta configurado. Agregue WHATSAPP_ACCESS_TOKEN y WHATSAPP_PHONE_NUMBER_ID en Render."
    );
  }

  const endpoint = `https://graph.facebook.com/${whatsappConfig.apiVersion}/${whatsappConfig.phoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: {
      link: pdfLink,
      filename: fileName,
      caption
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${whatsappConfig.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await readWhatsappResponse(response);

  if (!response.ok) {
    const message = data?.error?.message || data?.error?.error_user_msg || "WhatsApp no pudo enviar el PDF.";
    throw new Error(message);
  }

  return data;
}

function quoteBigInt(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;

  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

function normalizeNextQuoteNumber(value) {
  const number = quoteBigInt(value);
  return number && number >= quoteSequenceStart ? number : quoteSequenceStart;
}

function highestStoredQuoteNextNumber() {
  const row = db
    .prepare(`
      SELECT quote_number
      FROM quotes
      WHERE quote_number <> ''
        AND quote_number NOT GLOB '*[^0-9]*'
      ORDER BY length(quote_number) DESC, quote_number DESC
      LIMIT 1
    `)
    .get();

  const lastNumber = quoteBigInt(row?.quote_number);
  if (!lastNumber) return quoteSequenceStart;
  const nextNumber = lastNumber + 1n;
  return nextNumber > quoteSequenceStart ? nextNumber : quoteSequenceStart;
}

function storedNextQuoteNumber() {
  const row = db.prepare("SELECT value FROM app_state WHERE key = ?").get("next_quote_number");
  if (!row?.value) return null;
  return normalizeNextQuoteNumber(row.value);
}

function saveNextQuoteNumber(value) {
  const nextNumber = normalizeNextQuoteNumber(value).toString();
  db.prepare(`
    INSERT INTO app_state (key, value)
    VALUES ('next_quote_number', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(nextNumber);
  return nextNumber;
}

function nextQuoteNumber() {
  const storedNext = storedNextQuoteNumber();
  const recordNext = highestStoredQuoteNextNumber();
  const nextNumber = storedNext && storedNext > recordNext ? storedNext : recordNext;

  if (!storedNext || nextNumber !== storedNext) {
    return saveNextQuoteNumber(nextNumber);
  }

  return nextNumber.toString();
}

function advanceQuoteSequenceFrom(startNumber, count = 1) {
  const baseNumber = quoteBigInt(startNumber);
  if (!baseNumber) return nextQuoteNumber();
  const proposedNext = baseNumber + BigInt(Math.max(1, Number(count) || 1));
  const currentNext = normalizeNextQuoteNumber(nextQuoteNumber());
  const nextNumber = proposedNext > currentNext ? proposedNext : currentNext;
  return saveNextQuoteNumber(nextNumber);
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("La cotización es demasiado grande para guardar.");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function enqueueSave(task) {
  const queuedTask = saveQueue.then(task, task);
  saveQueue = queuedTask.catch(() => {});
  return queuedTask;
}

function selectedServiceName(quoteData) {
  return quoteData.packageName && quoteData.packageId !== "ninguno"
    ? quoteData.packageName
    : (quoteData.selectedExtras || []).map((extra) => extra.description).join(", ");
}

function insertQuoteRecord(quoteData, fileName, target) {
  return db
    .prepare(`
      INSERT INTO quotes (
        quote_number,
        quote_code,
        quote_date,
        event_date,
        client_name,
        client_phone,
        event_place,
        package_name,
        service_name,
        total,
        file_name,
        pdf_path,
        quote_data
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      String(quoteData.quoteNumber || ""),
      quoteData.quoteCode || "",
      quoteData.quoteDate || "",
      quoteData.eventDate || "",
      quoteData.clientName || "",
      quoteData.clientPhone || "",
      quoteData.eventPlace || "",
      quoteData.packageName || "",
      selectedServiceName(quoteData),
      Number(quoteData.totals?.grandTotal || 0),
      fileName,
      target,
      JSON.stringify(quoteData)
    );
}

function updateQuoteRecord(id, quoteData, fileName, target) {
  return db
    .prepare(`
      UPDATE quotes
      SET quote_code = ?,
          quote_date = ?,
          event_date = ?,
          client_name = ?,
          client_phone = ?,
          event_place = ?,
          package_name = ?,
          service_name = ?,
          total = ?,
          file_name = ?,
          pdf_path = ?,
          quote_data = ?
      WHERE id = ?
    `)
    .run(
      quoteData.quoteCode || "",
      quoteData.quoteDate || "",
      quoteData.eventDate || "",
      quoteData.clientName || "",
      quoteData.clientPhone || "",
      quoteData.eventPlace || "",
      quoteData.packageName || "",
      selectedServiceName(quoteData),
      Number(quoteData.totals?.grandTotal || 0),
      fileName,
      target,
      JSON.stringify(quoteData),
      id
    );
}

async function saveQuote(payload, response) {
  const html = String(payload.html || "");
  const quoteData = payload.quoteData || {};

  if (!html.includes("quote-document")) {
    errorResponse(response, 400, "No se recibió el HTML de la cotización.");
    return;
  }

  const expectedNumber = nextQuoteNumber();
  const quoteNumber = String(quoteData.quoteNumber || "");
  if (quoteNumber !== expectedNumber) {
    errorResponse(
      response,
      409,
      `El correlativo cambió. El siguiente número disponible es ${expectedNumber}. Revise la cotización y vuelva a guardar.`
    );
    return;
  }

  const { fileName, target } = uniquePdfTarget(payload.fileName || quoteData.fileName);
  quoteData.fileName = fileName;
  await generatePdf(html, target);
  let result;
  try {
    db.exec("BEGIN IMMEDIATE");
    result = insertQuoteRecord(quoteData, fileName, target);
    advanceQuoteSequenceFrom(quoteNumber, 1);
    db.exec("COMMIT");
    createDailyDatabaseBackup();
  } catch (error) {
    db.exec("ROLLBACK");
    await fsp.rm(target, { force: true }).catch(() => {});
    throw error;
  }

  jsonResponse(response, 201, {
    id: Number(result.lastInsertRowid),
    fileName,
    pdfUrl: pdfUrl(fileName),
    folder: pdfDir,
    nextNumber: nextQuoteNumber()
  });
}

async function updateQuote(id, payload, response) {
  const html = String(payload.html || "");
  const quoteData = payload.quoteData || {};
  const existing = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);

  if (!existing) {
    errorResponse(response, 404, "No se encontró la cotización para actualizar.");
    return;
  }

  if (!html.includes("quote-document")) {
    errorResponse(response, 400, "No se recibió el HTML de la cotización.");
    return;
  }

  const quoteNumber = String(quoteData.quoteNumber || "");
  if (quoteNumber !== String(existing.quote_number || "")) {
    errorResponse(
      response,
      409,
      `Esta cotización cargada conserva el correlativo ${existing.quote_number}. Use Nueva cotización para crear otro correlativo.`
    );
    return;
  }

  const oldTarget = existingPdfPath(existing);
  const { fileName, target } = updatePdfTarget(existing);
  const tempTarget = path.join(pdfDir, `.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}.pdf`);

  try {
    quoteData.fileName = fileName;
    await generatePdf(html, tempTarget);
    await fsp.rename(tempTarget, target);
    updateQuoteRecord(id, quoteData, fileName, target);
    if (oldTarget !== target) await fsp.rm(oldTarget, { force: true }).catch(() => {});
    createDailyDatabaseBackup();

    jsonResponse(response, 200, {
      id,
      fileName,
      pdfUrl: pdfUrl(fileName),
      folder: pdfDir,
      nextNumber: nextQuoteNumber()
    });
  } catch (error) {
    await fsp.rm(tempTarget, { force: true }).catch(() => {});
    throw error;
  }
}

async function deleteQuote(id, response) {
  const existing = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  if (!existing) {
    errorResponse(response, 404, "No se encontró la cotización para eliminar.");
    return;
  }

  try {
    db.exec("BEGIN IMMEDIATE");
    db.prepare("DELETE FROM quotes WHERE id = ?").run(id);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  await fsp.rm(existingPdfPath(existing), { force: true }).catch(() => {});
  jsonResponse(response, 200, {
    id,
    fileName: existing.file_name,
    nextNumber: nextQuoteNumber()
  });
}

async function sendQuoteByWhatsapp(id, payload, request, response) {
  const existing = db.prepare("SELECT * FROM quotes WHERE id = ?").get(id);
  if (!existing) {
    errorResponse(response, 404, "No se encontró la cotización para enviar.");
    return;
  }

  const target = existingPdfPath(existing);
  if (!fs.existsSync(target)) {
    errorResponse(response, 404, "No se encontró el PDF guardado para esta cotización.");
    return;
  }

  const phone = normalizeWhatsappPhone(payload.phone || existing.client_phone);
  if (!phone) {
    errorResponse(response, 400, "Agregue el número telefónico del cliente para enviar el PDF por WhatsApp.");
    return;
  }

  const pdfLink = absolutePdfUrl(request, existing.file_name);
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(?::|\/)/i.test(pdfLink)) {
    errorResponse(
      response,
      400,
      "Para enviar el PDF como documento por WhatsApp use la página publicada en internet, no localhost."
    );
    return;
  }

  const captionParts = ["Cotización"];
  if (existing.quote_number) captionParts.push(existing.quote_number);
  const serviceName = existing.service_name || existing.package_name;
  if (serviceName) captionParts.push(serviceName);
  captionParts.push("Live Productions");

  const data = await sendWhatsappDocument({
    to: phone,
    pdfLink,
    fileName: existing.file_name,
    caption: captionParts.join(" - ")
  });

  jsonResponse(response, 200, {
    id,
    quoteNumber: existing.quote_number,
    fileName: existing.file_name,
    phone,
    pdfUrl: pdfUrl(existing.file_name),
    whatsappMessageId: data?.messages?.[0]?.id || "",
    status: "sent"
  });
}

async function saveQuoteBatch(payload, response) {
  const quotes = Array.isArray(payload.quotes) ? payload.quotes : [];
  if (quotes.length < 2) {
    errorResponse(response, 400, "Debe incluir al menos dos cotizaciones en el lote.");
    return;
  }

  const expectedStart = nextQuoteNumber();
  let expectedNumber = BigInt(expectedStart);

  for (const quote of quotes) {
    const html = String(quote.html || "");
    const quoteNumber = String(quote.quoteData?.quoteNumber || "");
    if (!html.includes("quote-document")) {
      errorResponse(response, 400, "Una de las cotizaciones no contiene HTML válido.");
      return;
    }
    if (quoteNumber !== expectedNumber.toString()) {
      errorResponse(
        response,
        409,
        `El correlativo cambió. El siguiente número disponible es ${expectedStart}. Revise el lote y vuelva a guardar.`
      );
      return;
    }
    expectedNumber += 1n;
  }

  const generated = [];
  try {
    for (const quote of quotes) {
      const quoteData = quote.quoteData || {};
      const { fileName, target } = uniquePdfTarget(quote.fileName || quoteData.fileName);
      quoteData.fileName = fileName;
      generated.push({ quoteData, fileName, target });
      await generatePdf(String(quote.html), target);
    }

    const saved = [];
    db.exec("BEGIN IMMEDIATE");
    try {
      generated.forEach(({ quoteData, fileName, target }) => {
        const result = insertQuoteRecord(quoteData, fileName, target);
        saved.push({
          id: Number(result.lastInsertRowid),
          quoteNumber: String(quoteData.quoteNumber || ""),
          fileName,
          pdfUrl: pdfUrl(fileName)
        });
      });
      advanceQuoteSequenceFrom(expectedStart, generated.length);
      db.exec("COMMIT");
      createDailyDatabaseBackup();
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }

    jsonResponse(response, 201, {
      quotes: saved,
      folder: pdfDir,
      nextNumber: nextQuoteNumber()
    });
  } catch (error) {
    await Promise.all(
      generated.map(({ target }) => fsp.rm(target, { force: true }).catch(() => {}))
    );
    throw error;
  }
}

function serveStatic(request, response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const isPdfRequest = requestedPath.startsWith("/cotizaciones-generadas/");
  const baseDir = isPdfRequest ? pdfDir : rootDir;
  const relativePath = isPdfRequest
    ? requestedPath.replace(/^\/cotizaciones-generadas\//, "")
    : `.${requestedPath}`;
  const filePath = path.resolve(baseDir, relativePath);

  if (!filePath.startsWith(baseDir)) {
    errorResponse(response, 403, "Ruta no permitida.");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      errorResponse(response, 404, "Archivo no encontrado.");
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLocaleLowerCase("es-GT")] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(data);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/sesion") {
      const user = authenticatedUser(request);
      jsonResponse(response, 200, { authenticated: Boolean(user), user });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      const payload = await readJsonBody(request);
      if (!verifyCredentials(payload.username, payload.password)) {
        errorResponse(response, 401, "Usuario o contraseña incorrectos.");
        return;
      }
      const token = signSession({
        user: authConfig.username,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000
      });
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": sessionCookie(request, token)
      });
      response.end(JSON.stringify({ authenticated: true, user: authConfig.username }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
      response.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": expiredSessionCookie()
      });
      response.end(JSON.stringify({ authenticated: false }));
      return;
    }

    const requirementDoneMatch = url.pathname.match(/^\/requerimientos\/realizado\/([^/]+)\/?$/);
    if (request.method === "GET" && requirementDoneMatch) {
      completeRequirementByToken(decodeURIComponent(requirementDoneMatch[1]), response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/requerimientos") {
      if (!requireAuth(request, response)) return;
      jsonResponse(response, 200, listRequirements(request));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/requerimientos/import") {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() => importRequirementState(payload, request, response));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/requerimientos/colaboradores") {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() => createRequirementCollaborator(payload, request, response));
      return;
    }

    const requirementCollaboratorMatch = url.pathname.match(/^\/api\/requerimientos\/colaboradores\/(\d+)$/);
    if (request.method === "PUT" && requirementCollaboratorMatch) {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() =>
        updateRequirementCollaborator(Number(requirementCollaboratorMatch[1]), payload, request, response)
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/requerimientos/tareas") {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() => createRequirementTask(payload, request, response));
      return;
    }

    const requirementTaskMatch = url.pathname.match(/^\/api\/requerimientos\/tareas\/(\d+)$/);
    if (request.method === "PUT" && requirementTaskMatch) {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() =>
        updateRequirementTaskStatus(Number(requirementTaskMatch[1]), payload, request, response)
      );
      return;
    }

    const requirementSentMatch = url.pathname.match(/^\/api\/requerimientos\/tareas\/(\d+)\/enviado$/);
    if (request.method === "POST" && requirementSentMatch) {
      if (!requireAuth(request, response)) return;
      await enqueueSave(() => markRequirementTaskSent(Number(requirementSentMatch[1]), request, response));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/cotizaciones") {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() => saveQuote(payload, response));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/cotizaciones/lote") {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() => saveQuoteBatch(payload, response));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/cotizaciones") {
      if (!requireAuth(request, response)) return;
      jsonResponse(response, 200, { records: listQuotes(url.searchParams.get("search")) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/secuencia") {
      if (!requireAuth(request, response)) return;
      jsonResponse(response, 200, { nextNumber: nextQuoteNumber() });
      return;
    }

    const quoteMatch = url.pathname.match(/^\/api\/cotizaciones\/(\d+)$/);
    if (request.method === "GET" && quoteMatch) {
      if (!requireAuth(request, response)) return;
      const quote = getQuote(Number(quoteMatch[1]));
      if (!quote) errorResponse(response, 404, "No se encontró la cotización.");
      else jsonResponse(response, 200, quote);
      return;
    }

    if (request.method === "PUT" && quoteMatch) {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await enqueueSave(() => updateQuote(Number(quoteMatch[1]), payload, response));
      return;
    }

    if (request.method === "DELETE" && quoteMatch) {
      if (!requireAuth(request, response)) return;
      await enqueueSave(() => deleteQuote(Number(quoteMatch[1]), response));
      return;
    }

    const whatsappQuoteMatch = url.pathname.match(/^\/api\/cotizaciones\/(\d+)\/whatsapp$/);
    if (request.method === "POST" && whatsappQuoteMatch) {
      if (!requireAuth(request, response)) return;
      const payload = await readJsonBody(request);
      await sendQuoteByWhatsapp(Number(whatsappQuoteMatch[1]), payload, request, response);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      serveStatic(request, response, url.pathname);
      return;
    }

    errorResponse(response, 405, "Método no permitido.");
  } catch (error) {
    errorResponse(response, 500, error.message || "Error interno del servidor.");
  }
}

const server = http.createServer(handleRequest);

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`No se pudo iniciar Cotizador Live Productions: el puerto ${port} ya esta ocupado por otro programa.`);
    console.error(`Cierre el programa que usa el puerto ${port} o reinicie la Mac y vuelva a abrir el cotizador.`);
  } else if (error.code === "EACCES" || error.code === "EPERM") {
    console.error(`No se pudo iniciar Cotizador Live Productions: macOS no permitio usar 127.0.0.1:${port}.`);
    console.error("Cierre Safari y vuelva a abrir la app. Si continua, reinicie la Mac.");
  } else {
    console.error(`No se pudo iniciar Cotizador Live Productions: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const visibleHost = host === "0.0.0.0" ? "localhost" : host;
  console.log(`Cotizador Live Productions listo en http://${visibleHost}:${port}/index.html`);
  console.log(`PDFs: ${pdfDir}`);
  console.log(`SQLite: ${dbPath}`);
  console.log(`Respaldos SQLite: ${backupDir}`);

  const browserPath = findBrowserExecutable();
  if (browserPath) getPdfEngine(browserPath).catch(() => {});
});
