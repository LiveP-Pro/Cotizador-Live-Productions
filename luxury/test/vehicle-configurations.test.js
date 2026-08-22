import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../server.js";

async function startTestApp(context) {
  const directory = await mkdtemp(join(tmpdir(), "luxury-vehicle-config-"));
  const { server } = await createApp({ dataFile: join(directory, "database.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function authenticatedApp(context) {
  const baseUrl = await startTestApp(context);
  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@luxurytravel.gt", password: "Luxury2026!" }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const bootstrapResponse = await fetch(`${baseUrl}/api/bootstrap`, { headers: { Cookie: cookie } });
  const bootstrap = await bootstrapResponse.json();
  return { baseUrl, cookie, vehicles: bootstrap.vehicles };
}

async function createQuote(app, vehicle, configurationId, passengers) {
  return fetch(`${app.baseUrl}/api/quotes`, {
    method: "POST",
    headers: { Cookie: app.cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      clientName: "Prueba de capacidad",
      serviceDate: "2026-08-22",
      origin: "Ciudad de Guatemala",
      destination: "Antigua",
      serviceType: "Servicio de Ida",
      passengers,
      vehicleId: vehicle.id,
      vehicleIds: [vehicle.id],
      vehicleConfigurations: { [vehicle.id]: configurationId },
      fixedFare: 1500,
      fixedFareIncludesTax: false,
      includeTax: false,
    }),
  });
}

test("M1 guarda su configuración y limita a 8 pasajeros cuando lleva cama", async (context) => {
  const app = await authenticatedApp(context);
  const m1 = app.vehicles.find((vehicle) => Number(vehicle.unitNumber) === 1);

  const validResponse = await createQuote(app, m1, "m1-facing-bed-8", 8);
  assert.equal(validResponse.status, 201);
  const quote = await validResponse.json();
  assert.equal(quote.maxPassengers, 8);
  assert.equal(quote.hasBed, true);
  assert.equal(quote.vehicleConfigurations[m1.id], "m1-facing-bed-8");

  const invalidResponse = await createQuote(app, m1, "m1-facing-bed-8", 9);
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /máximo total de 8 pasajeros/i);
});

test("M2 permite 18 pasajeros únicamente en su configuración hacia adelante", async (context) => {
  const app = await authenticatedApp(context);
  const m2 = app.vehicles.find((vehicle) => Number(vehicle.unitNumber) === 2);

  const validResponse = await createQuote(app, m2, "m2-forward-18", 18);
  assert.equal(validResponse.status, 201);
  const quote = await validResponse.json();
  assert.equal(quote.maxPassengers, 18);
  assert.equal(quote.vehicleConfigurations[m2.id], "m2-forward-18");

  const invalidResponse = await createQuote(app, m2, "m2-three-rows-14", 15);
  assert.equal(invalidResponse.status, 400);
  assert.match((await invalidResponse.json()).error, /máximo total de 14 pasajeros/i);
});
