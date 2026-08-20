import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../server.js";

async function startTestApp() {
  const directory = await mkdtemp(join(tmpdir(), "luxury-travel-test-"));
  const { server } = await createApp({ dataFile: join(directory, "database.json") });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    directory,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await rm(directory, { recursive: true, force: true });
    },
  };
}

async function login(baseUrl, email = "admin@luxurytravel.gt", password = "Luxury2026!") {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200);
  return {
    cookie: response.headers.get("set-cookie").split(";")[0],
    payload: await response.json(),
  };
}

async function request(baseUrl, cookie, path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Cookie: cookie,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

test("flujo principal: login, cotización, PDF e itinerario", async (context) => {
  const app = await startTestApp();
  context.after(app.close);

  const { cookie, payload } = await login(app.baseUrl);
  assert.equal(payload.user.role, "administrador");
  assert.ok(payload.permissions.includes("quotes"));

  const initialBootstrapResponse = await request(app.baseUrl, cookie, "/api/bootstrap");
  const initialBootstrap = await initialBootstrapResponse.json();
  assert.equal(initialBootstrap.vehicles.length, 3);
  assert.deepEqual(
    initialBootstrap.vehicles.map((vehicle) => vehicle.fleetName),
    [
      "Mercedes Benz Sprinter 311, 1",
      "Mercedes Benz Sprinter 311, 2",
      "Mercedes Benz Sprinter 316, 3",
    ],
  );
  const vehicleId = initialBootstrap.vehicles[0].id;
  const sprinter316Id = initialBootstrap.vehicles.find((vehicle) => vehicle.model === "Sprinter 316").id;
  const threeVehicleIds = initialBootstrap.vehicles.map((vehicle) => vehicle.id);
  const sprinter316 = initialBootstrap.vehicles.find((vehicle) => vehicle.id === sprinter316Id);
  assert.equal(sprinter316.capacity, 14);
  assert.equal(sprinter316.superLuxuryCapacity, 10);
  assert.equal(sprinter316.luxurySeatCapacity, 10);
  assert.equal(sprinter316.m1SeatCapacity, 14);
  assert.equal(sprinter316.m3SeatCapacity, 11);
  assert.equal(sprinter316.supportsSuperLuxurySeats, true);

  const quoteResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente de prueba",
      clientNit: "1234567-8",
      clientPhone: "5555-1212",
      clientEmail: "cliente@example.com",
      serviceDate: "2026-07-10",
      departureTime: "08:00",
      origin: "Ciudad de Guatemala",
      destination: "Antigua Guatemala",
      passengers: 8,
      luggage: 3,
      vehicleId,
      hasBed: true,
      hasPlayStation5: true,
      hasTv: true,
      serviceType: "Traslado privado",
      kilometers: 40,
      minutes: 60,
      waitingMinutes: 0,
      includeTax: true,
      discountPercent: 0,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(quoteResponse.status, 201);
  const quote = await quoteResponse.json();
  assert.equal(quote.number, "Coti-Luxury-0001-Cliente-de-prueba-5555-1212");
  assert.equal(quote.clientNit, "1234567-8");
  assert.equal(quote.totals.distanceCharge, 200);
  assert.equal(quote.totals.timeCharge, 60);
  assert.equal(quote.totals.subtotal, 260);
  assert.equal(quote.totals.tax, 31.2);
  assert.equal(quote.totals.total, 291.2);
  assert.equal(quote.maxPassengers, 8);
  assert.equal(quote.hasBed, true);
  assert.equal(quote.hasPlayStation5, true);
  assert.equal(quote.hasTv, true);

  const fixedFareResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente tarifa fija",
      clientPhone: "4444-0000",
      serviceDate: "2026-07-12",
      departureTime: "10:00",
      origin: "Ciudad de Guatemala",
      destination: "ANTIGUA",
      passengers: 4,
      vehicleId,
      serviceType: "Servicio de Ida",
      destinationRateId: "antigua",
      destinationRateName: "ANTIGUA",
      serviceRateType: "oneWay",
      fixedFare: 1500,
      fixedFareIncludesTax: false,
      includeTax: true,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(fixedFareResponse.status, 201);
  const fixedFareQuote = await fixedFareResponse.json();
  assert.equal(fixedFareQuote.totals.total, 1680);
  assert.equal(fixedFareQuote.totals.taxPercent, 12);
  assert.equal(fixedFareQuote.totals.tax, 180);

  const multiServiceResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente multi servicio",
      clientPhone: "5555-7777",
      serviceDate: "2026-07-12",
      departureTime: "10:00",
      origin: "Ciudad de Guatemala",
      destination: "Servicios seleccionados",
      passengers: 4,
      vehicleId,
      serviceSelections: [
        {
          destinationId: "aeropuerto-ciudad",
          destination: "AEROPUERTO / CIUDAD",
          type: "oneWay",
          label: "Servicio de Ida",
          amount: 1250,
        },
        {
          destinationId: "antigua",
          destination: "ANTIGUA",
          type: "roundTrip",
          label: "Servicio de Ida y Vuelta",
          amount: 3000,
        },
      ],
      fixedFareIncludesTax: false,
      includeTax: true,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(multiServiceResponse.status, 201);
  const multiServiceQuote = await multiServiceResponse.json();
  assert.equal(multiServiceQuote.serviceSelections.length, 2);
  assert.equal(multiServiceQuote.fixedFare, 4250);
  assert.equal(multiServiceQuote.totals.tax, 510);
  assert.equal(multiServiceQuote.totals.total, 4760);

  const finalPriceMultiDestinationResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente multi servicio",
      clientPhone: "5555-7777",
      quoteDate: "2026-07-10",
      serviceDate: "2026-07-12",
      departureTime: "08:00",
      origin: "Punto A",
      destination: "Punto B",
      passengers: 12,
      vehicleIds: threeVehicleIds,
      vehicleCount: 3,
      destinationMode: "multiple",
      destinationCount: 2,
      priceDisplayMode: "final",
      finalManualPrice: 7500,
      serviceSelections: [
        {
          destination: "Punto B",
          type: "oneWay",
          label: "Servicio de Ida",
          amount: 0,
          serviceDate: "2026-07-12",
          origin: "Punto A",
          destinationAddress: "Punto B",
          departureTime: "08:00",
          notes: "Recibir al cliente en la entrada principal.",
          legNumber: 1,
        },
        {
          destination: "Punto C",
          type: "oneWay",
          label: "Servicio de Ida",
          amount: 0,
          serviceDate: "2026-07-13",
          origin: "Punto B",
          destinationAddress: "Punto C",
          departureTime: "09:00",
          notes: "Segundo recorrido del itinerario.",
          legNumber: 2,
        },
      ],
      includeTax: false,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(finalPriceMultiDestinationResponse.status, 201);
  const finalPriceMultiDestinationQuote = await finalPriceMultiDestinationResponse.json();
  assert.equal(finalPriceMultiDestinationQuote.destinationMode, "multiple");
  assert.equal(finalPriceMultiDestinationQuote.destinationCount, 2);
  assert.equal(finalPriceMultiDestinationQuote.priceDisplayMode, "final");
  assert.equal(finalPriceMultiDestinationQuote.fixedFareIsTotal, true);
  assert.equal(finalPriceMultiDestinationQuote.serviceSelections.length, 2);
  assert.equal(finalPriceMultiDestinationQuote.serviceSelections[0].notes, "Recibir al cliente en la entrada principal.");
  assert.equal(finalPriceMultiDestinationQuote.serviceSelections[1].origin, "Punto B");
  assert.equal(finalPriceMultiDestinationQuote.totals.baseFare, 7500);
  assert.equal(finalPriceMultiDestinationQuote.totals.total, 7500);

  const superLuxuryResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente butacas super lujo",
      clientPhone: "5555-9999",
      serviceDate: "2026-07-12",
      departureTime: "10:00",
      origin: "Ciudad de Guatemala",
      destination: "Antigua",
      passengers: 10,
      vehicleId: sprinter316Id,
      hasPlayStation5: true,
      hasTv: true,
      hasSuperLuxurySeats: true,
      serviceType: "Servicio de Ida",
      destinationRateId: "antigua",
      destinationRateName: "ANTIGUA",
      serviceRateType: "oneWay",
      fixedFare: 1500,
      fixedFareIncludesTax: false,
      includeTax: true,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(superLuxuryResponse.status, 201);
  const superLuxuryQuote = await superLuxuryResponse.json();
  assert.equal(superLuxuryQuote.maxPassengers, 10);
  assert.equal(superLuxuryQuote.seatConfiguration, "luxury");
  assert.equal(superLuxuryQuote.hasSuperLuxurySeats, true);

  const superLuxuryOverCapacityResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente demasiados pasajeros",
      serviceDate: "2026-07-12",
      departureTime: "10:00",
      origin: "Ciudad de Guatemala",
      destination: "Antigua",
      passengers: 11,
      vehicleId: sprinter316Id,
      hasSuperLuxurySeats: true,
    }),
  });
  assert.equal(superLuxuryOverCapacityResponse.status, 400);
  assert.match((await superLuxuryOverCapacityResponse.json()).error, /Butacas de lujo/);

  const multiVehicleResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente tres sprinter",
      clientPhone: "2222-0000",
      serviceDate: "2026-07-12",
      departureTime: "10:00",
      origin: "Aeropuerto",
      destination: "AEROPUERTO / CIUDAD",
      passengers: 9,
      vehicleIds: threeVehicleIds,
      vehicleCount: 3,
      serviceType: "Servicio de Ida",
      destinationRateId: "aeropuerto-ciudad",
      destinationRateName: "AEROPUERTO / CIUDAD",
      serviceRateType: "oneWay",
      fixedFare: 1250,
      fixedFareIncludesTax: false,
      includeTax: true,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(multiVehicleResponse.status, 201);
  const multiVehicleQuote = await multiVehicleResponse.json();
  assert.equal(multiVehicleQuote.totals.baseFare, 3750);
  assert.equal(multiVehicleQuote.totals.tax, 450);
  assert.equal(multiVehicleQuote.totals.total, 4200);

  const manualVehicleResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente manual",
      clientPhone: "3333-0000",
      serviceDate: "2026-07-13",
      departureTime: "11:00",
      origin: "Ciudad de Guatemala",
      destination: "Destino especial",
      passengers: 4,
      vehicleIds: [vehicleId],
      vehicleCount: 2,
      vehicleManualName: "Vehículo externo VIP",
      driverManualName: "Piloto externo",
      hasTv: true,
      fixedFare: 7500,
      includeTax: false,
      status: "borrador",
      pdfTemplate: "noir",
    }),
  });
  assert.equal(manualVehicleResponse.status, 201);
  const manualVehicleQuote = await manualVehicleResponse.json();
  assert.equal(manualVehicleQuote.vehicleManualName, "Vehículo externo VIP");
  assert.equal(manualVehicleQuote.driverManualName, "Piloto externo");
  assert.equal(manualVehicleQuote.hasTv, true);
  assert.equal(manualVehicleQuote.vehicleCount, 1);
  assert.equal(manualVehicleQuote.totals.baseFare, 7500);
  assert.equal(manualVehicleQuote.totals.total, 7500);

  const singleVehicleTransfersResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente cinco traslados",
      serviceDate: "2026-08-19",
      passengers: 8,
      vehicleIds: [vehicleId],
      vehicleCount: 2,
      vehicleManualName: "Vehículo alternativo opcional",
      priceDisplayMode: "detailed",
      serviceSelections: [4000, 2500, 7500, 3000, 7800].map((amount, index) => ({
        destination: `Traslado ${index + 1}`,
        type: "oneWay",
        label: "Servicio de Ida",
        amount,
        serviceDate: `2026-08-${19 + index}`,
        legNumber: index + 1,
      })),
      discountAmount: 4600,
      includeTax: true,
      status: "borrador",
    }),
  });
  assert.equal(singleVehicleTransfersResponse.status, 201);
  const singleVehicleTransfersQuote = await singleVehicleTransfersResponse.json();
  assert.equal(singleVehicleTransfersQuote.vehicleCount, 1);
  assert.equal(singleVehicleTransfersQuote.totals.baseFare, 24800);
  assert.equal(singleVehicleTransfersQuote.totals.discount, 4600);
  assert.equal(singleVehicleTransfersQuote.totals.tax, 2424);
  assert.equal(singleVehicleTransfersQuote.totals.total, 22624);

  const incompleteQuoteResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      allowIncomplete: true,
      quoteDate: "2026-08-19",
      passengers: 1,
      includeTax: false,
      serviceSelections: [
        {
          instanceId: "route-incomplete",
          destinationId: "manual-route-incomplete",
          destination: "Traslado 1",
          type: "oneWay",
          label: "Servicio de ida",
          amount: 0,
        },
      ],
    }),
  });
  assert.equal(incompleteQuoteResponse.status, 201);
  const incompleteQuote = await incompleteQuoteResponse.json();
  assert.equal(incompleteQuote.clientId, "");
  assert.equal(incompleteQuote.serviceSelections.length, 1);

  const overCapacityResponse = await request(app.baseUrl, cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "Cliente sin espacio",
      serviceDate: "2026-07-11",
      departureTime: "09:00",
      origin: "Ciudad de Guatemala",
      destination: "Antigua Guatemala",
      vehicleId,
      passengers: 9,
      hasBed: true,
    }),
  });
  assert.equal(overCapacityResponse.status, 400);
  assert.match((await overCapacityResponse.json()).error, /máxima total es de 8 pasajeros/);

  const pdfResponse = await request(
    app.baseUrl,
    cookie,
    `/api/quotes/${quote.id}/pdf?template=executive`,
  );
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
  const pdf = Buffer.from(await pdfResponse.arrayBuffer());
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.ok(pdf.length > 1500);

  const itineraryResponse = await request(
    app.baseUrl,
    cookie,
    `/api/quotes/${quote.id}/itineraries`,
    {
      method: "POST",
      body: JSON.stringify({ type: "cliente", instructions: "Presentarse 10 minutos antes." }),
    },
  );
  assert.equal(itineraryResponse.status, 201);
  const itinerary = await itineraryResponse.json();
  assert.equal(itinerary.type, "cliente");
  assert.equal(itinerary.quoteNumber, quote.number);
  assert.equal(itinerary.clientNit, "1234567-8");
  assert.equal(itinerary.hasBed, true);
  assert.equal(itinerary.hasPlayStation5, true);
  assert.equal(itinerary.hasTv, true);

  const acceptResponse = await request(app.baseUrl, cookie, `/api/quotes/${quote.id}/accept`, {
    method: "POST",
    body: JSON.stringify({
      amountPaid: quote.totals.total,
      paymentReference: "DEP-001",
      paymentProof: {
        fileName: "deposito.pdf",
        mimeType: "application/pdf",
        size: 14,
        dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
      },
    }),
  });
  assert.equal(acceptResponse.status, 200);
  const acceptedQuote = await acceptResponse.json();
  assert.equal(acceptedQuote.status, "aceptada");
  assert.equal(acceptedQuote.amountPaid, quote.totals.total);
  assert.equal(acceptedQuote.paymentProof.fileName, "deposito.pdf");

  const dashboardResponse = await request(app.baseUrl, cookie, "/api/dashboard");
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.monthSales, quote.totals.total);

  const bootstrapResponse = await request(app.baseUrl, cookie, "/api/bootstrap");
  assert.equal(bootstrapResponse.status, 200);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.quotes.length, 9);
  assert.equal(bootstrap.clients.length, 7);
  assert.equal(bootstrap.clients.find((client) => client.name === "Cliente de prueba").nit, "1234567-8");
  assert.equal(bootstrap.itineraries.length, 1);
  assert.ok(bootstrap.history.length >= 3);
});

test("un vendedor no puede modificar tarifas", async (context) => {
  const app = await startTestApp();
  context.after(app.close);
  const admin = await login(app.baseUrl);

  const createUserResponse = await request(app.baseUrl, admin.cookie, "/api/users", {
    method: "POST",
    body: JSON.stringify({
      name: "Vendedor Prueba",
      email: "ventas@example.com",
      password: "Ventas2026!",
      role: "vendedor",
    }),
  });
  assert.equal(createUserResponse.status, 201);

  const seller = await login(app.baseUrl, "ventas@example.com", "Ventas2026!");
  assert.ok(seller.payload.permissions.includes("quotes"));
  assert.ok(!seller.payload.permissions.includes("rates"));

  const ratesResponse = await request(app.baseUrl, seller.cookie, "/api/rates", {
    method: "PUT",
    body: JSON.stringify({ pricePerKm: 1 }),
  });
  assert.equal(ratesResponse.status, 403);
});

test("reutiliza el mismo cliente aunque cambien mayúsculas, acentos o datos de contacto", async (context) => {
  const app = await startTestApp();
  context.after(app.close);
  const admin = await login(app.baseUrl);

  const firstResponse = await request(app.baseUrl, admin.cookie, "/api/clients", {
    method: "POST",
    body: JSON.stringify({
      name: "Denis Tanchez",
      phone: "5555-1212",
    }),
  });
  assert.equal(firstResponse.status, 201);
  const firstClient = await firstResponse.json();

  const repeatedResponse = await request(app.baseUrl, admin.cookie, "/api/clients", {
    method: "POST",
    body: JSON.stringify({
      name: "  DENÍS   TANCHEZ ",
      nit: "1234567-8",
    }),
  });
  assert.equal(repeatedResponse.status, 200);
  const repeatedClient = await repeatedResponse.json();
  assert.equal(repeatedClient.id, firstClient.id);
  assert.equal(repeatedClient.mergedExisting, true);

  const quoteResponse = await request(app.baseUrl, admin.cookie, "/api/quotes", {
    method: "POST",
    body: JSON.stringify({
      clientName: "denis tanchez",
      clientEmail: "denis@example.com",
      allowIncomplete: true,
    }),
  });
  assert.equal(quoteResponse.status, 201);

  const bootstrapResponse = await request(app.baseUrl, admin.cookie, "/api/bootstrap");
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.clients.length, 1);
  assert.equal(bootstrap.clients[0].name, "Denis Tanchez");
  assert.equal(bootstrap.clients[0].phone, "5555-1212");
  assert.equal(bootstrap.clients[0].nit, "1234567-8");
  assert.equal(bootstrap.clients[0].email, "denis@example.com");
});

test("un administrador puede exportar e importar un respaldo sin perder su acceso", async (context) => {
  const app = await startTestApp();
  context.after(app.close);
  const admin = await login(app.baseUrl);

  const exportResponse = await request(
    app.baseUrl,
    admin.cookie,
    "/api/admin/database-backup",
  );
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers.get("content-disposition"), /luxury-travel-backup/);
  const snapshot = await exportResponse.json();
  snapshot.clients.push({
    id: "cliente-migrado",
    name: "Cliente migrado",
    nit: "CF",
    phone: "5555-1000",
    email: "cliente-migrado@example.com",
    createdAt: new Date().toISOString(),
    createdBy: snapshot.users[0].id,
  });

  const importResponse = await request(
    app.baseUrl,
    admin.cookie,
    "/api/admin/database-backup",
    {
      method: "POST",
      body: JSON.stringify({ confirmation: "IMPORTAR RESPALDO", database: snapshot }),
    },
  );
  assert.equal(importResponse.status, 200);
  const importResult = await importResponse.json();
  assert.equal(importResult.counts.clients, 1);
  assert.match(importResponse.headers.get("set-cookie"), /Max-Age=0/);

  const expiredSessionResponse = await request(app.baseUrl, admin.cookie, "/api/bootstrap");
  assert.equal(expiredSessionResponse.status, 401);

  const restoredAdmin = await login(app.baseUrl);
  const bootstrapResponse = await request(app.baseUrl, restoredAdmin.cookie, "/api/bootstrap");
  assert.equal(bootstrapResponse.status, 200);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.clients.find((client) => client.id === "cliente-migrado").name, "Cliente migrado");

  const backupFiles = await readdir(join(app.directory, "backups"));
  assert.ok(backupFiles.some((name) => name.startsWith("antes-de-importar-")));
});
