import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { JsonDatabase } from "../lib/db.js";

async function temporaryDatabase() {
  const directory = await mkdtemp(join(tmpdir(), "luxury-db-recovery-"));
  return {
    directory,
    primary: join(directory, "luxury-travel.json"),
    mirror: join(directory, "luxury-travel-recovery.json"),
    backups: join(directory, "backups"),
    close: () => rm(directory, { recursive: true, force: true }),
  };
}

function openDatabase(files) {
  return new JsonDatabase(files.primary, {
    mirrorFile: files.mirror,
    backupDirectory: files.backups,
  });
}

test("recupera la base principal desde el espejo", async (context) => {
  const files = await temporaryDatabase();
  context.after(files.close);

  const original = await openDatabase(files).init();
  original.data.clients.push({ id: "cliente-espejo", name: "Cliente espejo" });
  await original.persist();
  await unlink(files.primary);

  const recovered = await openDatabase(files).init();
  assert.equal(recovered.data.clients.some((client) => client.id === "cliente-espejo"), true);
  assert.deepEqual(
    JSON.parse(await readFile(files.primary, "utf8")),
    JSON.parse(await readFile(files.mirror, "utf8")),
  );
});

test("recupera desde el respaldo diario si principal y espejo están dañados", async (context) => {
  const files = await temporaryDatabase();
  context.after(files.close);

  const original = await openDatabase(files).init();
  original.data.clients.push({ id: "cliente-respaldo", name: "Cliente respaldo" });
  await original.persist();
  await original.createBackup("respaldo-verificado", { unique: true });
  await writeFile(files.primary, "archivo dañado", "utf8");
  await writeFile(files.mirror, "archivo dañado", "utf8");

  const recovered = await openDatabase(files).init();
  assert.equal(recovered.data.clients.some((client) => client.id === "cliente-respaldo"), true);
});

test("se detiene si existen archivos dañados y ninguna copia válida", async (context) => {
  const files = await temporaryDatabase();
  context.after(files.close);
  await writeFile(files.primary, "archivo dañado", "utf8");
  await writeFile(files.mirror, "archivo dañado", "utf8");

  await assert.rejects(openDatabase(files).init(), /No se encontró una copia válida/);
  assert.equal(await readFile(files.primary, "utf8"), "archivo dañado");
});

test("repara totales duplicados de cotizaciones existentes", async (context) => {
  const files = await temporaryDatabase();
  context.after(files.close);

  const original = await openDatabase(files).init();
  const vehicleId = original.data.vehicles[0].id;
  original.data.schemaVersion = 9;
  original.data.quotes.push({
    id: "cotizacion-total-duplicado",
    vehicleId,
    vehicleIds: [vehicleId],
    vehicleCount: 1,
    priceDisplayMode: "detailed",
    fixedFare: 24800,
    fixedFareIsTotal: false,
    discountAmount: 0,
    discountPercent: 0,
    includeTax: false,
    serviceSelections: [4000, 2500, 7500, 3000, 7800].map((amount, index) => ({
      amount,
      destination: `Traslado ${index + 1}`,
    })),
    totals: {
      baseFare: 49600,
      discount: 4600,
      tax: 5400,
      taxPercent: 12,
      total: 50400,
    },
  });
  await original.persist();

  const repaired = await openDatabase(files).init();
  const quote = repaired.data.quotes.find((item) => item.id === "cotizacion-total-duplicado");
  assert.equal(repaired.data.schemaVersion, 12);
  assert.equal(quote.vehicleCount, 1);
  assert.equal(quote.fixedFare, 24800);
  assert.equal(quote.discountAmount, 4600);
  assert.equal(quote.includeTax, true);
  assert.equal(quote.totals.baseFare, 24800);
  assert.equal(quote.totals.discount, 4600);
  assert.equal(quote.totals.tax, 2424);
  assert.equal(quote.totals.total, 22624);
});

test("consolida clientes repetidos y conserva sus cotizaciones y contacto", async (context) => {
  const files = await temporaryDatabase();
  context.after(files.close);

  const original = await openDatabase(files).init();
  original.data.schemaVersion = 11;
  original.data.clients.push(
    {
      id: "jorge-original",
      name: "Jorge Merida",
      nit: "CF",
      phone: "",
      email: "",
      company: "",
      notes: "Cliente frecuente.",
      createdAt: "2026-08-16T12:00:00.000Z",
      createdBy: original.data.users[0].id,
    },
    {
      id: "jorge-duplicado",
      name: "JORGE MÉRIDA",
      nit: "5487123-9",
      phone: "30903172",
      email: "jorge@example.com",
      company: "",
      notes: "",
      createdAt: "2026-08-19T12:00:00.000Z",
      createdBy: original.data.users[0].id,
    },
  );
  original.data.quotes.push({
    id: "cotizacion-jorge",
    clientId: "jorge-duplicado",
    clientName: "JORGE MERIDA",
  });
  await original.persist();

  const repaired = await openDatabase(files).init();
  assert.equal(repaired.data.clients.length, 1);
  assert.equal(repaired.data.clients[0].id, "jorge-original");
  assert.equal(repaired.data.clients[0].name, "Jorge Merida");
  assert.equal(repaired.data.clients[0].nit, "5487123-9");
  assert.equal(repaired.data.clients[0].phone, "30903172");
  assert.equal(repaired.data.clients[0].email, "jorge@example.com");
  assert.equal(repaired.data.quotes[0].clientId, "jorge-original");
});
