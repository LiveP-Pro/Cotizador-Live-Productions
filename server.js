const http = require("node:http");
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
const dbPath = path.join(dataDir, "cotizaciones.sqlite");
const maxBodyBytes = 100 * 1024 * 1024;
const quoteSequenceStart = 10667n;
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

  CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes (quote_number);
  CREATE INDEX IF NOT EXISTS idx_quotes_client_name ON quotes (client_name);
  CREATE INDEX IF NOT EXISTS idx_quotes_quote_date ON quotes (quote_date);
  CREATE INDEX IF NOT EXISTS idx_quotes_event_date ON quotes (event_date);
`);

function jsonResponse(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function errorResponse(response, statusCode, message) {
  jsonResponse(response, statusCode, { error: message });
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
    pdfUrl: `/cotizaciones-generadas/${encodeURIComponent(row.file_name)}`,
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

function nextQuoteNumber() {
  const row = db
    .prepare(`
      SELECT quote_number
      FROM quotes
      WHERE quote_number GLOB '[0-9]*'
      ORDER BY length(quote_number) DESC, quote_number DESC
      LIMIT 1
    `)
    .get();

  if (!row?.quote_number) return quoteSequenceStart.toString();

  try {
    const next = BigInt(row.quote_number) + 1n;
    return (next > quoteSequenceStart ? next : quoteSequenceStart).toString();
  } catch {
    return quoteSequenceStart.toString();
  }
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
  const result = insertQuoteRecord(quoteData, fileName, target);

  jsonResponse(response, 201, {
    id: Number(result.lastInsertRowid),
    fileName,
    pdfUrl: `/cotizaciones-generadas/${encodeURIComponent(fileName)}`,
    folder: pdfDir,
    nextNumber: nextQuoteNumber()
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
          pdfUrl: `/cotizaciones-generadas/${encodeURIComponent(fileName)}`
        });
      });
      db.exec("COMMIT");
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
    if (request.method === "POST" && url.pathname === "/api/cotizaciones") {
      const payload = await readJsonBody(request);
      await enqueueSave(() => saveQuote(payload, response));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/cotizaciones/lote") {
      const payload = await readJsonBody(request);
      await enqueueSave(() => saveQuoteBatch(payload, response));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/cotizaciones") {
      jsonResponse(response, 200, { records: listQuotes(url.searchParams.get("search")) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/secuencia") {
      jsonResponse(response, 200, { nextNumber: nextQuoteNumber() });
      return;
    }

    const quoteMatch = url.pathname.match(/^\/api\/cotizaciones\/(\d+)$/);
    if (request.method === "GET" && quoteMatch) {
      const quote = getQuote(Number(quoteMatch[1]));
      if (!quote) errorResponse(response, 404, "No se encontró la cotización.");
      else jsonResponse(response, 200, quote);
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

  const browserPath = findBrowserExecutable();
  if (browserPath) getPdfEngine(browserPath).catch(() => {});
});
