const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const root = path.join(__dirname, "..");

async function runStartupCheck(dataDir) {
  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: root,
    env: {
      ...process.env,
      COTIZADOR_DATA_DIR: dataDir,
      EQUIPMENT_PDF_DIR: path.join(dataDir, "equipment-pdfs"),
      WAREHOUSE_INITIAL_STATE_PATH: path.join(dataDir, "unused-synthetic-initial.json"),
      COTIZADOR_ADMIN_USER: "warehouse-synthetic-user",
      COTIZADOR_ADMIN_PASSWORD: "warehouse-test-password",
      COTIZADOR_SESSION_SECRET: "warehouse-test-session-secret",
      DISABLE_PDF_WARMUP: "1",
      WAREHOUSE_MIGRATION_ONLY: "1"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Servidor no inició:\n${output}`)), 10000);
    const onData = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0 && output.includes("Migración de inventario verificada")) resolve();
      else reject(new Error(`Migración terminó con código ${code}:\n${output}`));
    });
  });
}

test("warehouse startup preserves active stock across different initial datasets and repeated restarts", { timeout: 30000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "warehouse-migration-"));
  const inventoryPath = path.join(dataDir, "inventario-bodega.json");
  const privateInitialPath = path.join(dataDir, "inventario-bodega-inicial.json");
  const active = {
    state: {
      version: 3,
      datasetId: "active-inventory-synthetic",
      source: "fuente activa sintetica",
      items: [{ id: "old-1", category: "PRUEBA", name: "Equipo anterior", quantity: 1 }],
      movements: []
    },
    savedAt: "2026-09-27T00:00:00.000Z"
  };
  const privateInitial = {
    state: {
      version: 4,
      datasetId: "private-inventory-test-20260928",
      source: "prueba privada",
      items: [
        { id: "new-1", category: "PRUEBA", name: "Equipo de prueba", itemType: "equipo", quantity: 3 },
        { id: "new-2", category: "PRUEBA", name: "Consumible de prueba", itemType: "consumible", quantity: 8 }
      ],
      movements: []
    },
    savedAt: "2026-09-28T00:00:00.000Z"
  };
  fs.writeFileSync(inventoryPath, JSON.stringify(active, null, 2));
  fs.writeFileSync(privateInitialPath, JSON.stringify(privateInitial, null, 2));
  const originalActiveBytes = fs.readFileSync(inventoryPath);
  const originalInitialBytes = fs.readFileSync(privateInitialPath);
  try {
    await runStartupCheck(dataDir);

    const preserved = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    assert.notEqual(active.state.datasetId, privateInitial.state.datasetId);
    assert.deepEqual(preserved, active);
    assert.deepEqual(fs.readFileSync(inventoryPath), originalActiveBytes);
    assert.deepEqual(fs.readFileSync(privateInitialPath), originalInitialBytes);
    const migrationBackups = fs.readdirSync(dataDir).filter((name) => name.startsWith("inventario-bodega-antes-"));
    assert.equal(migrationBackups.length, 0);
    assert.equal(fs.existsSync(path.join(dataDir, "inventario-bodega-anterior.json")), false);

    preserved.state.items[0].quantity = 777;
    fs.writeFileSync(inventoryPath, JSON.stringify(preserved, null, 2));
    const editedActiveBytes = fs.readFileSync(inventoryPath);
    await runStartupCheck(dataDir);

    const restarted = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    assert.equal(restarted.state.items[0].quantity, 777);
    assert.deepEqual(restarted, preserved);
    assert.deepEqual(fs.readFileSync(inventoryPath), editedActiveBytes);
    assert.deepEqual(fs.readFileSync(privateInitialPath), originalInitialBytes);
    assert.equal(fs.readdirSync(dataDir).filter((name) => name.startsWith("inventario-bodega-antes-")).length, 0);
    assert.equal(fs.existsSync(path.join(dataDir, "inventario-bodega-anterior.json")), false);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
