const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const root = path.join(__dirname, "..");

async function runMigration(dataDir) {
  const child = spawn(process.execPath, ["--no-warnings", "server.js"], {
    cwd: root,
    env: {
      ...process.env,
      COTIZADOR_DATA_DIR: dataDir,
      EQUIPMENT_PDF_DIR: path.join(dataDir, "equipment-pdfs"),
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

test("warehouse dataset migration replaces legacy inventory exactly once and keeps a backup", { timeout: 30000 }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "warehouse-migration-"));
  const inventoryPath = path.join(dataDir, "inventario-bodega.json");
  const privateInitialPath = path.join(dataDir, "inventario-bodega-inicial.json");
  const legacy = {
    state: {
      version: 3,
      source: "inventario anterior",
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
  fs.writeFileSync(inventoryPath, JSON.stringify(legacy, null, 2));
  fs.writeFileSync(privateInitialPath, JSON.stringify(privateInitial, null, 2));
  try {
    await runMigration(dataDir);

    const migrated = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    assert.equal(migrated.state.datasetId, privateInitial.state.datasetId);
    assert.equal(migrated.state.items.length, 2);
    const migrationBackups = fs.readdirSync(dataDir).filter((name) => name.startsWith("inventario-bodega-antes-"));
    assert.equal(migrationBackups.length, 1);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, migrationBackups[0]), "utf8")), legacy);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, "inventario-bodega-anterior.json"), "utf8")), legacy);

    migrated.state.items[0].quantity = 777;
    fs.writeFileSync(inventoryPath, JSON.stringify(migrated, null, 2));
    await runMigration(dataDir);

    const restarted = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    assert.equal(restarted.state.items[0].quantity, 777);
    assert.equal(fs.readdirSync(dataDir).filter((name) => name.startsWith("inventario-bodega-antes-")).length, 1);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
