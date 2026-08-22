import { createServer as createHttpServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { JsonDatabase, mergeClientDetails, normalizeClientName } from "./lib/db.js";
import {
  hashPassword,
  parseCookies,
  publicUser,
  sessionCookie,
  verifyPassword,
} from "./lib/auth.js";
import { calculateQuote } from "./lib/pricing.js";
import { calculateRoute } from "./lib/routes.js";
import { buildQuotePdf } from "./lib/pdf.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)));
const PUBLIC_DIR = join(ROOT, "public");
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function loadDotEnv() {
  return readFile(join(ROOT, ".env"), "utf8")
    .then((content) => {
      content.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]] !== undefined) return;
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      });
    })
    .catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
}

const ROLE_PERMISSIONS = {
  administrador: new Set([
    "dashboard",
    "quotes",
    "clientItineraries",
    "driverItineraries",
    "clients",
    "vehicles",
    "drivers",
    "rates",
    "history",
    "settings",
    "users",
  ]),
  vendedor: new Set([
    "dashboard",
    "quotes",
    "clientItineraries",
    "driverItineraries",
    "clients",
    "vehicles",
    "drivers",
    "history",
  ]),
  piloto: new Set(["dashboard", "driverItineraries", "history"]),
};

const COLLECTION_PERMISSION = {
  clients: "clients",
  drivers: "drivers",
  vehicles: "vehicles",
  quotes: "quotes",
  itineraries: "clientItineraries",
  history: "history",
  users: "users",
};

function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function parseBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function guatemalaDateParts(date = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guatemala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function guatemalaDateValue(date = new Date()) {
  const parts = guatemalaDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function guatemalaMonthValue(date = new Date()) {
  const parts = guatemalaDateParts(date);
  return `${parts.year}-${parts.month}`;
}

const SERVICE_STATUSES = new Set(["aceptada", "confirmada", "completada"]);
const SPRINTER_311_UNIT_CONFIGURATIONS = {
  1: [
    { id: "m1-forward-15", capacity: 15, hasBed: false },
    { id: "m1-facing-bed-8", capacity: 8, hasBed: true },
    { id: "m1-facing-row-12", capacity: 12, hasBed: false },
    { id: "m1-three-rows-11", capacity: 11, hasBed: false },
  ],
  2: [
    { id: "m2-forward-18", capacity: 18, hasBed: false },
    { id: "m2-facing-bed-10", capacity: 10, hasBed: true },
    { id: "m2-three-rows-14", capacity: 14, hasBed: false },
  ],
};
const SPRINTER_311_CONFIGURATION_IDS = new Set(
  Object.values(SPRINTER_311_UNIT_CONFIGURATIONS).flat().map((item) => item.id),
);
const PAYMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function cleanIdList(value) {
  const raw = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(raw.map((item) => cleanString(item, 80)).filter(Boolean))];
}

function cleanVehicleConfigurations(value) {
  let raw = value;
  if (typeof raw === "string" && raw.trim()) {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .map(([vehicleId, configurationId]) => [
        cleanString(vehicleId, 80),
        cleanString(configurationId, 50),
      ])
      .filter(([vehicleId, configurationId]) =>
        vehicleId && SPRINTER_311_CONFIGURATION_IDS.has(configurationId)),
  );
}

function sprinter311UnitConfiguration(vehicle, configurationId) {
  const unitNumber = Math.round(Number(vehicle?.unitNumber || 0));
  return (SPRINTER_311_UNIT_CONFIGURATIONS[unitNumber] || [])
    .find((item) => item.id === configurationId) || null;
}

function sprinter311ConfigurationById(configurationId) {
  return Object.values(SPRINTER_311_UNIT_CONFIGURATIONS)
    .flat()
    .find((item) => item.id === configurationId) || null;
}

function cleanServiceSelections(value) {
  let raw = Array.isArray(value) ? value : [];
  if (!raw.length && typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) raw = parsed;
    } catch {
      raw = [];
    }
  }
  return raw
    .map((item) => ({
      instanceId: cleanString(item?.instanceId, 80),
      destinationId: cleanString(item?.destinationId || item?.destinationRateId, 80),
      destination: cleanString(item?.destination || item?.destinationRateName, 300),
      type: cleanString(item?.type || item?.serviceRateType, 40),
      label: cleanString(item?.label || item?.serviceType, 100),
      amount: Math.max(0, cleanNumber(item?.amount ?? item?.fixedFare)),
      serviceDate: cleanString(item?.serviceDate, 20),
      returnDate: cleanString(item?.returnDate || item?.serviceEndDate, 20),
      origin: cleanString(item?.origin, 300),
      destinationAddress: cleanString(item?.destinationAddress, 300),
      departureTime: cleanString(item?.departureTime, 10),
      returnTime: cleanString(item?.returnTime, 10),
      passengers: Math.max(0, Math.round(cleanNumber(item?.passengers))),
      hasLuggage:
        item?.hasLuggage === undefined || item?.hasLuggage === ""
          ? undefined
          : parseBoolean(item?.hasLuggage),
      luggageDescription: cleanString(item?.luggageDescription, 500),
      notes: cleanString(item?.notes, 1200),
      legNumber: Math.max(0, Math.round(cleanNumber(item?.legNumber))),
    }))
    .filter((item) => item.destination && item.type)
    .slice(0, 50);
}

function quotePiece(value, fallback = "sin-dato") {
  const normalized = cleanString(value, 120)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function extractQuoteSequence(number) {
  const match = String(number || "").match(/Coti-Luxury-(\d{4})/i);
  if (match) return Number(match[1]);
  const legacy = String(number || "").match(/(\d{4})$/);
  return legacy ? Number(legacy[1]) : 0;
}

function formatQuoteNumber(sequence, clientName, clientPhone) {
  return `Coti-Luxury-${String(sequence).padStart(4, "0")}-${quotePiece(clientName, "cliente")}-${quotePiece(clientPhone, "telefono")}`;
}

function nextQuoteSequence(db) {
  return (
    Math.max(
      0,
      ...db
        .list("quotes")
        .map((quote) => Number(quote.quoteSequence || extractQuoteSequence(quote.number)) || 0),
    ) + 1
  );
}

function normalizePaymentProof(body, actorId) {
  const proof = body.paymentProof || {};
  const fileName = cleanString(proof.fileName, 180);
  const mimeType = cleanString(proof.mimeType, 80).toLowerCase();
  const dataUrl = cleanString(proof.dataUrl, 12_000_000);
  if (!fileName || !mimeType || !dataUrl) {
    const error = new Error("Suba la boleta de pago o depósito en imagen o PDF.");
    error.statusCode = 400;
    throw error;
  }
  if (!PAYMENT_MIME_TYPES.has(mimeType)) {
    const error = new Error("El comprobante debe ser PDF, JPG, PNG o WEBP.");
    error.statusCode = 400;
    throw error;
  }
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) {
    const error = new Error("El comprobante no tiene un formato válido.");
    error.statusCode = 400;
    throw error;
  }
  return {
    fileName,
    mimeType,
    size: Math.max(0, Math.round(cleanNumber(proof.size))),
    dataUrl,
    uploadedAt: new Date().toISOString(),
    uploadedBy: actorId,
  };
}

async function syncClientForQuote(db, quote, actorId) {
  if (!quote.clientName) {
    quote.clientId = "";
    return null;
  }
  const clientNameKey = normalizeClientName(quote.clientName);
  let client = db
    .list("clients")
    .find((item) => normalizeClientName(item.name) === clientNameKey);
  if (!client && quote.clientId) {
    const linkedClient = db.find("clients", quote.clientId);
    if (normalizeClientName(linkedClient?.name) === clientNameKey) client = linkedClient;
  }
  const payload = {
    name: quote.clientName,
    nit: quote.clientNit,
    phone: quote.clientPhone,
    email: quote.clientEmail,
  };
  if (!client) {
    client = await db.create(
      "clients",
      {
        ...payload,
        company: "",
        notes: "Creado automáticamente desde una cotización.",
      },
      actorId,
    );
  } else {
    client = await db.update(
      "clients",
      client.id,
      mergeClientDetails(client, payload),
      actorId,
    );
  }
  quote.clientId = client.id;
  quote.clientNit = quote.clientNit || client.nit || "";
  quote.clientPhone = quote.clientPhone || client.phone || "";
  quote.clientEmail = quote.clientEmail || client.email || "";
  return client;
}

function normalizeEntity(collection, body) {
  if (collection === "clients") {
    return {
      name: cleanString(body.name, 120),
      nit: cleanString(body.nit, 40),
      phone: cleanString(body.phone, 40),
      email: cleanString(body.email, 160).toLowerCase(),
      company: cleanString(body.company, 120),
      notes: cleanString(body.notes, 1000),
    };
  }
  if (collection === "drivers") {
    return {
      name: cleanString(body.name, 120),
      phone: cleanString(body.phone, 40),
      email: cleanString(body.email, 160).toLowerCase(),
      license: cleanString(body.license, 80),
      licenseExpires: cleanString(body.licenseExpires, 20),
      status: cleanString(body.status || "disponible", 30),
      userId: cleanString(body.userId, 80),
      notes: cleanString(body.notes, 1000),
    };
  }
  if (collection === "vehicles") {
    const capacity = Math.min(15, Math.max(1, Math.round(cleanNumber(body.capacity, 15))));
    return {
      brand: cleanString(body.brand, 80),
      model: cleanString(body.model, 80),
      unitNumber: Math.max(0, Math.round(cleanNumber(body.unitNumber))),
      fleetName: cleanString(body.fleetName, 120),
      year: Math.round(cleanNumber(body.year, new Date().getFullYear())),
      plate: cleanString(body.plate, 30).toUpperCase(),
      capacity,
      capacityWithBed: Math.min(
        capacity,
        Math.max(1, Math.round(cleanNumber(body.capacityWithBed, 8))),
      ),
      capacityWithLuggage: Math.min(
        capacity,
        Math.max(1, Math.round(cleanNumber(body.capacityWithLuggage, 10))),
      ),
      superLuxuryCapacity: Math.min(
        capacity,
        Math.max(0, Math.round(cleanNumber(body.superLuxuryCapacity, 0))),
      ),
      luxurySeatCapacity: Math.min(
        capacity,
        Math.max(0, Math.round(cleanNumber(body.luxurySeatCapacity, 0))),
      ),
      m1SeatCapacity: Math.min(
        capacity,
        Math.max(0, Math.round(cleanNumber(body.m1SeatCapacity, 0))),
      ),
      m3SeatCapacity: Math.min(
        capacity,
        Math.max(0, Math.round(cleanNumber(body.m3SeatCapacity, 0))),
      ),
      luggageCapacity: Math.max(0, Math.round(cleanNumber(body.luggageCapacity))),
      color: cleanString(body.color, 40),
      status: cleanString(body.status || "disponible", 30),
      supportsBed: body.supportsBed === undefined ? true : parseBoolean(body.supportsBed),
      supportsPlayStation5:
        body.supportsPlayStation5 === undefined
          ? true
          : parseBoolean(body.supportsPlayStation5),
      supportsSuperLuxurySeats: parseBoolean(body.supportsSuperLuxurySeats),
      notes: cleanString(body.notes, 1000),
    };
  }
  return body;
}

function normalizeQuote(body, rates, existing = {}) {
  const vehicleIds = cleanIdList(body.vehicleIds);
  const vehicleId = vehicleIds[0] || cleanString(body.vehicleId, 80);
  const selectedVehicleIds = vehicleIds.length ? vehicleIds : vehicleId ? [vehicleId] : [];
  const hasVehicleConfigurationsField =
    Object.prototype.hasOwnProperty.call(body, "vehicleConfigurations") ||
    Object.prototype.hasOwnProperty.call(body, "vehicleConfigurationsJson");
  const requestedVehicleConfigurations = cleanVehicleConfigurations(
    hasVehicleConfigurationsField
      ? body.vehicleConfigurations ?? body.vehicleConfigurationsJson
      : existing.vehicleConfigurations || {},
  );
  const vehicleConfigurations = Object.fromEntries(
    Object.entries(requestedVehicleConfigurations)
      .filter(([selectedVehicleId]) => selectedVehicleIds.includes(selectedVehicleId)),
  );
  const configuredUnitDefinitions = Object.values(vehicleConfigurations)
    .map(sprinter311ConfigurationById)
    .filter(Boolean);
  const configuredHasBed = configuredUnitDefinitions.some((item) => item.hasBed);
  const vehicleManualName = cleanString(body.vehicleManualName, 140);
  const vehicleCount = vehicleIds.length
    ? vehicleIds.length
    : vehicleId || vehicleManualName
      ? 1
      : Math.max(1, Math.round(cleanNumber(body.vehicleCount, 1)));
  const serviceSelections = cleanServiceSelections(body.serviceSelections || body.serviceSelectionsJson);
  const selectedFare = serviceSelections.reduce((sum, item) => sum + item.amount, 0);
  const priceDisplayMode = cleanString(body.priceDisplayMode || existing.priceDisplayMode || "detailed", 20) === "final"
    ? "final"
    : "detailed";
  const finalManualPrice = Math.max(0, cleanNumber(body.finalManualPrice, existing.finalManualPrice || 0));
  const hasSeatConfigurationField = Object.prototype.hasOwnProperty.call(body, "seatConfiguration");
  const requestedSeatConfiguration = cleanString(
    hasSeatConfigurationField
      ? body.seatConfiguration
      : existing.seatConfiguration || (parseBoolean(body.hasSuperLuxurySeats) ? "luxury" : ""),
    20,
  );
  const seatConfiguration = ["luxury", "m1", "m3"].includes(requestedSeatConfiguration)
    ? requestedSeatConfiguration
    : "";
  const requestedSprinter311Configuration = cleanString(
    configuredUnitDefinitions.length
      ? configuredHasBed
        ? "bed"
        : Object.values(vehicleConfigurations).every((configurationId) => configurationId === "m1-forward-15")
          ? "standard"
          : "luggage"
      : body.sprinter311Configuration || existing.sprinter311Configuration ||
        (parseBoolean(body.hasBed) ? "bed" : parseBoolean(body.hasLuggage) ? "luggage" : "standard"),
    20,
  );
  const sprinter311Configuration = ["bed", "luggage", "standard"].includes(requestedSprinter311Configuration)
    ? requestedSprinter311Configuration
    : "standard";
  const fixedFare = priceDisplayMode === "final"
    ? finalManualPrice || Math.max(0, cleanNumber(body.fixedFare, existing.fixedFare || 0))
    : selectedFare || Math.max(0, cleanNumber(body.fixedFare, existing.fixedFare || 0));
  const selectedDestinations = [...new Set(serviceSelections.map((item) => item.destination).filter(Boolean))].join(" + ");
  const selectedServiceType =
    serviceSelections.length === 1
      ? serviceSelections[0].label
      : serviceSelections.length
        ? `${serviceSelections.length} traslados seleccionados`
        : "";
  const quote = {
    ...existing,
    clientId: cleanString(body.clientId, 80),
    clientName: cleanString(body.clientName, 120),
    clientNit: cleanString(body.clientNit, 40),
    clientPhone: cleanString(body.clientPhone, 40),
    clientEmail: cleanString(body.clientEmail, 160).toLowerCase(),
    quoteDate: cleanString(body.quoteDate, 20),
    serviceDate: cleanString(body.serviceDate || body.serviceStartDate, 20),
    serviceStartDate: cleanString(body.serviceStartDate || body.serviceDate, 20),
    serviceEndDate: cleanString(body.serviceEndDate || body.returnDate || body.serviceDate, 20),
    returnDate: cleanString(body.returnDate || body.serviceEndDate, 20),
    departureTime: cleanString(body.departureTime, 10),
    origin: cleanString(body.origin, 300),
    destination: cleanString(body.destination, 300),
    arrivalTime: cleanString(body.arrivalTime, 10),
    returnTime: cleanString(body.returnTime, 10),
    endLocation: cleanString(body.endLocation, 300),
    passengers: Math.max(1, Math.round(cleanNumber(body.passengers, 1))),
    passengerDescription: cleanString(body.passengerDescription, 240),
    luggage: Math.max(0, Math.round(cleanNumber(body.luggage))),
    hasLuggage: body.hasLuggage === undefined ? Boolean(cleanString(body.luggageDescription, 500) || cleanNumber(body.luggage)) : parseBoolean(body.hasLuggage),
    luggageDescription: cleanString(body.luggageDescription, 500),
    vehicleId,
    vehicleIds: selectedVehicleIds,
    vehicleConfigurations,
    vehicleCount,
    vehicleManualName,
    hasBed: configuredUnitDefinitions.length
      ? configuredHasBed
      : sprinter311Configuration === "bed" || parseBoolean(body.hasBed),
    sprinter311Configuration,
    hasPlayStation5: parseBoolean(body.hasPlayStation5),
    hasTv: parseBoolean(body.hasTv),
    seatConfiguration,
    hasSuperLuxurySeats: seatConfiguration
      ? seatConfiguration === "luxury"
      : parseBoolean(body.hasSuperLuxurySeats),
    driverId: cleanString(body.driverId, 80),
    driverUserId: cleanString(body.driverUserId, 80),
    driverManualName: cleanString(body.driverManualName, 120),
    serviceType: cleanString(body.serviceType || selectedServiceType || "Traslado privado", 160),
    notes: cleanString(body.notes, 2000),
    destinationRateId: cleanString(body.destinationRateId, 80),
    destinationRateName: cleanString(body.destinationRateName || selectedDestinations, 300),
    serviceRateType: cleanString(body.serviceRateType, 40),
    serviceSelections,
    destinationMode: cleanString(body.destinationMode || existing.destinationMode || (serviceSelections.length > 1 ? "multiple" : "single"), 20) === "multiple"
      ? "multiple"
      : "single",
    destinationCount: Math.max(1, Math.min(20, Math.round(cleanNumber(body.destinationCount, serviceSelections.length || 1)))),
    priceDisplayMode,
    finalManualPrice,
    fixedFare,
    fixedFareIsTotal: priceDisplayMode === "final",
    fixedFareIncludesTax:
      body.fixedFareIncludesTax === undefined ? true : parseBoolean(body.fixedFareIncludesTax),
    kilometers: Math.max(0, cleanNumber(body.kilometers)),
    minutes: Math.max(0, Math.round(cleanNumber(body.minutes))),
    waitingMinutes: Math.max(0, Math.round(cleanNumber(body.waitingMinutes))),
    extraCharges: Math.max(0, cleanNumber(body.extraCharges)),
    discountPercent: Math.max(0, cleanNumber(body.discountPercent)),
    discountAmount: Math.max(0, cleanNumber(body.discountAmount)),
    applyNightSurcharge: parseBoolean(body.applyNightSurcharge),
    applyAirportSurcharge: parseBoolean(body.applyAirportSurcharge),
    includeTax: body.includeTax === undefined ? true : parseBoolean(body.includeTax),
    status: cleanString(body.status || existing.status || "borrador", 30),
    routeProvider: cleanString(body.routeProvider, 80),
    pdfTemplate: cleanString(body.pdfTemplate || "noir", 30),
  };
  quote.totals = calculateQuote(quote, rates);
  return quote;
}

function validateQuoteCapacity(db, quote) {
  const vehicles = (quote.vehicleIds?.length ? quote.vehicleIds : quote.vehicleId ? [quote.vehicleId] : [])
    .map((id) => db.find("vehicles", id))
    .filter(Boolean);
  const isSprinter316 = (vehicle) =>
    vehicle.brand === "Mercedes Benz" && vehicle.model === "Sprinter 316";
  const hasLuggage = Number(quote.luggage || 0) > 0 || quote.hasLuggage === true;
  vehicles.forEach((vehicle) => {
    const requestedConfiguration = quote.vehicleConfigurations?.[vehicle.id];
    if (requestedConfiguration && !sprinter311UnitConfiguration(vehicle, requestedConfiguration)) {
      const error = new Error("La configuración seleccionada no corresponde a esa unidad Mercedes.");
      error.statusCode = 400;
      throw error;
    }
  });
  const capacityForVehicle = (vehicle) => {
    if (isSprinter316(vehicle)) {
      if (quote.seatConfiguration === "luxury" || quote.hasSuperLuxurySeats) {
        return Math.max(1, Number(vehicle.luxurySeatCapacity || vehicle.superLuxuryCapacity || 10));
      }
      if (quote.seatConfiguration === "m3") return Math.max(1, Number(vehicle.m3SeatCapacity || 11));
      return Math.max(1, Number(vehicle.m1SeatCapacity || vehicle.capacity || 14));
    }
    const unitConfiguration = sprinter311UnitConfiguration(
      vehicle,
      quote.vehicleConfigurations?.[vehicle.id],
    );
    if (unitConfiguration) return unitConfiguration.capacity;
    if (quote.sprinter311Configuration === "bed" || quote.hasBed) {
      return Math.max(1, Number(vehicle.capacityWithBed || 8));
    }
    if (quote.sprinter311Configuration === "luggage" || hasLuggage) {
      return Math.max(1, Number(vehicle.capacityWithLuggage || 10));
    }
    return Math.max(1, Number(vehicle.capacity || 15));
  };
  const manualCapacity = quote.vehicleManualName ? Math.max(15, Number(quote.passengers || 1)) : 0;
  const maximum = vehicles.length || quote.vehicleManualName
    ? vehicles.reduce((sum, vehicle) => sum + capacityForVehicle(vehicle), 0) + manualCapacity
    : quote.sprinter311Configuration === "bed" || quote.hasBed
      ? 8
      : quote.sprinter311Configuration === "luggage" || hasLuggage
        ? 10
        : 15;
  quote.maxPassengers = maximum;

  if ((quote.sprinter311Configuration === "bed" || quote.hasBed) && vehicles.length && !vehicles.some((vehicle) => !isSprinter316(vehicle))) {
    const error = new Error("La cama solo aplica para las Mercedes Benz Sprinter 311.");
    error.statusCode = 400;
    throw error;
  }
  if (quote.hasPlayStation5 && vehicles.some((vehicle) => vehicle.supportsPlayStation5 === false)) {
    const error = new Error("El vehículo seleccionado no dispone de PlayStation 5.");
    error.statusCode = 400;
    throw error;
  }
  if (quote.seatConfiguration && !vehicles.some(isSprinter316)) {
    const error = new Error("La configuración de asientos seleccionada solo aplica para Mercedes Benz Sprinter 316.");
    error.statusCode = 400;
    throw error;
  }
  if (quote.passengers > maximum) {
    const hasUnitConfigurations = Object.keys(quote.vehicleConfigurations || {}).length > 0;
    const error = new Error(
      hasUnitConfigurations
        ? `La configuración seleccionada permite un máximo total de ${maximum} pasajeros.`
        : quote.seatConfiguration === "luxury" || quote.hasSuperLuxurySeats
        ? `Con Butacas de lujo la capacidad máxima total es de ${maximum} pasajeros.`
        : quote.seatConfiguration === "m3"
          ? `Con Sillones M3 la capacidad máxima total es de ${maximum} pasajeros.`
          : quote.hasBed
            ? `Con cama seleccionada la capacidad máxima total es de ${maximum} pasajeros.`
            : `La capacidad máxima del vehículo es de ${maximum} pasajeros.`,
    );
    error.statusCode = 400;
    throw error;
  }
}

function validateRequired(entity, fields) {
  const missing = fields.filter((field) => !String(entity[field] ?? "").trim());
  if (missing.length) {
    const error = new Error(`Complete los campos obligatorios: ${missing.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }
}

function validateQuoteVehicle(entity) {
  if (!entity.vehicleId && !entity.vehicleManualName) {
    const error = new Error("Seleccione una Sprinter o escriba un vehículo manual.");
    error.statusCode = 400;
    throw error;
  }
}

function json(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12_000_000) {
      const error = new Error("La solicitud excede el límite permitido.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("El contenido JSON no es válido.");
    error.statusCode = 400;
    throw error;
  }
}

function routeMatch(pathname, pattern) {
  const keys = [];
  const regex = new RegExp(
    `^${pattern.replace(/:[^/]+/g, (token) => {
      keys.push(token.slice(1));
      return "([^/]+)";
    })}$`,
  );
  const match = pathname.match(regex);
  if (!match) return null;
  return Object.fromEntries(keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
}

function hasPermission(user, permission) {
  return ROLE_PERMISSIONS[user?.role]?.has(permission) || false;
}

function requirePermission(user, permission) {
  if (!hasPermission(user, permission)) {
    const error = new Error("No tiene permisos para realizar esta acción.");
    error.statusCode = 403;
    throw error;
  }
}

function databaseCounts(snapshot) {
  return {
    users: snapshot.users.length,
    clients: snapshot.clients.length,
    drivers: snapshot.drivers.length,
    vehicles: snapshot.vehicles.length,
    quotes: snapshot.quotes.length,
    itineraries: snapshot.itineraries.length,
    history: snapshot.history.length,
  };
}

function withNames(db, quote) {
  const vehicleIds = quote.vehicleIds?.length ? quote.vehicleIds : quote.vehicleId ? [quote.vehicleId] : [];
  const vehicleNames = vehicleIds
    .map((id) => {
      const vehicle = db.find("vehicles", id);
      return vehicle
        ? vehicle.fleetName ||
            `${vehicle.brand} ${vehicle.model}${vehicle.unitNumber ? `, ${vehicle.unitNumber}` : ""}`
        : "";
    })
    .filter(Boolean);
  if (quote.vehicleManualName) vehicleNames.push(quote.vehicleManualName);
  return {
    ...quote,
    vehicleName: vehicleNames.join(" + "),
    driverName: quote.driverManualName || (quote.driverId ? db.find("drivers", quote.driverId)?.name || "" : ""),
    creatorName: db.find("users", quote.createdBy)?.name || "Usuario",
  };
}

function filterForUser(db, collection, user, records) {
  if (user.role !== "piloto") return records;
  if (collection === "itineraries") {
    return records.filter(
      (item) =>
        item.type === "piloto" &&
        (item.assignedUserId === user.id || item.createdBy === user.id),
    );
  }
  if (collection === "history") {
    return records.filter((item) => item.userId === user.id);
  }
  return [];
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    json(res, 403, { error: "Ruta no permitida." });
    return;
  }

  let finalPath = filePath;
  try {
    const info = await stat(finalPath);
    if (info.isDirectory()) finalPath = join(finalPath, "index.html");
    const content = await readFile(finalPath);
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[extname(finalPath)] || "application/octet-stream",
      "Cache-Control":
        finalPath.endsWith("index.html") ||
        finalPath.endsWith("sw.js") ||
        finalPath.endsWith("manifest.webmanifest")
          ? "no-cache"
          : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data: blob: http: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-src 'self' data: blob:",
    });
    if (req.method === "HEAD") res.end();
    else res.end(content);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const content = await readFile(join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"], "Cache-Control": "no-cache" });
    res.end(content);
  }
}

export async function createApp(options = {}) {
  await loadDotEnv();
  const dataFile = options.dataFile || process.env.DATA_FILE || join(ROOT, "data/luxury-travel.json");
  const mirrorFile = options.mirrorFile || process.env.DATA_MIRROR_FILE || "";
  const backupDirectory = options.backupDirectory || process.env.DATA_BACKUP_DIR || "";
  const db = await new JsonDatabase(dataFile, { mirrorFile, backupDirectory }).init();
  const production = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const administratorEmail = cleanString(
    process.env.LUXURY_ADMIN_EMAIL || "admin@luxurytravel.gt",
    160,
  ).toLowerCase();
  const administratorPassword = String(process.env.LUXURY_ADMIN_PASSWORD || "");
  const allowHashedAdministrator =
    String(process.env.LUXURY_ALLOW_HASHED_ADMIN || "false") === "true";
  if (production && !administratorPassword && !allowHashedAdministrator) {
    throw new Error("Configure LUXURY_ADMIN_PASSWORD antes de publicar Luxury Travel.");
  }
  if (administratorPassword) {
    const administrator = db
      .list("users")
      .find((item) => item.role === "administrador" && item.email.toLowerCase() === administratorEmail);
    if (!administrator) {
      throw new Error(`No existe un administrador con el correo ${administratorEmail}.`);
    }
    if (!verifyPassword(administratorPassword, administrator.passwordHash)) {
      await db.update(
        "users",
        administrator.id,
        { passwordHash: hashPassword(administratorPassword), active: true },
        "system",
      );
    }
  }
  const sessions = new Map();
  const failedLogins = new Map();
  const sessionHours = Number(process.env.SESSION_HOURS || 12);
  const cookieSecure = String(process.env.COOKIE_SECURE || "false") === "true";
  const sessionCookieName = /^[A-Za-z0-9_-]+$/.test(
    String(process.env.LUXURY_SESSION_COOKIE || ""),
  )
    ? String(process.env.LUXURY_SESSION_COOKIE)
    : "lt_session";

  function getSession(req) {
    const token = parseCookies(req.headers.cookie)[sessionCookieName];
    const session = token ? sessions.get(token) : null;
    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    const user = db.find("users", session.userId);
    return user?.active ? { token, user } : null;
  }

  async function apiHandler(req, res, url) {
    const { pathname } = url;
    if (pathname === "/api/health" && req.method === "GET") {
      json(res, 200, { ok: true, service: "Luxury Travel Manager" });
      return;
    }

    if (pathname === "/api/login" && req.method === "POST") {
      const key = req.socket.remoteAddress || "local";
      const attempts = failedLogins.get(key) || { count: 0, resetAt: Date.now() + 15 * 60_000 };
      if (attempts.resetAt < Date.now()) {
        attempts.count = 0;
        attempts.resetAt = Date.now() + 15 * 60_000;
      }
      if (attempts.count >= 10) {
        json(res, 429, { error: "Demasiados intentos. Espere unos minutos." });
        return;
      }

      const body = await readJson(req);
      const email = cleanString(body.email, 160).toLowerCase();
      const user = db.list("users").find((item) => item.email === email);
      if (!user?.active || !verifyPassword(String(body.password || ""), user.passwordHash)) {
        attempts.count += 1;
        failedLogins.set(key, attempts);
        json(res, 401, { error: "Correo o contraseña incorrectos." });
        return;
      }

      failedLogins.delete(key);
      const token = randomBytes(32).toString("hex");
      const maxAge = Math.round(sessionHours * 60 * 60);
      sessions.set(token, { userId: user.id, expiresAt: Date.now() + maxAge * 1000 });
      await db.audit(user.id, "inicio_sesion", "user", user.id, "Inicio de sesión");
      json(
        res,
        200,
        { user: publicUser(user), permissions: [...ROLE_PERMISSIONS[user.role]] },
        {
          "Set-Cookie": sessionCookie(token, {
            maxAge,
            secure: cookieSecure,
            name: sessionCookieName,
          }),
        },
      );
      return;
    }

    const session = getSession(req);
    if (!session) {
      json(res, 401, { error: "Debe iniciar sesión." });
      return;
    }
    const { user } = session;

    if (pathname === "/api/admin/database-backup" && req.method === "GET") {
      requirePermission(user, "users");
      const snapshot = db.exportSnapshot();
      const date = guatemalaDateValue();
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="luxury-travel-backup-${date}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(snapshot, null, 2));
      return;
    }

    if (pathname === "/api/admin/database-backup" && req.method === "POST") {
      requirePermission(user, "users");
      const body = await readJson(req);
      if (cleanString(body.confirmation, 80) !== "IMPORTAR RESPALDO") {
        const error = new Error("Confirme la importación con el texto IMPORTAR RESPALDO.");
        error.statusCode = 400;
        throw error;
      }
      const snapshot = body.database;
      if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
        const error = new Error("Adjunte una base de datos válida en el campo database.");
        error.statusCode = 400;
        throw error;
      }
      const currentAdministrator = db.find("users", user.id);
      const importedAdministrator = Array.isArray(snapshot.users)
        ? snapshot.users.find(
            (item) =>
              item?.role === "administrador" &&
              String(item?.email || "").toLowerCase() === String(currentAdministrator?.email || "").toLowerCase(),
          )
        : null;
      if (!currentAdministrator?.passwordHash || !importedAdministrator) {
        const error = new Error("El respaldo no contiene la cuenta administradora actual.");
        error.statusCode = 400;
        throw error;
      }
      importedAdministrator.passwordHash = currentAdministrator.passwordHash;
      importedAdministrator.active = true;
      await db.replaceSnapshot(snapshot);
      const restoredAdministrator = db
        .list("users")
        .find((item) => item.email.toLowerCase() === currentAdministrator.email.toLowerCase());
      await db.audit(
        restoredAdministrator.id,
        "respaldo_importado",
        "database",
        "luxury-travel",
        "Base de datos restaurada desde un respaldo verificado",
      );
      const counts = databaseCounts(db.exportSnapshot());
      sessions.clear();
      json(
        res,
        200,
        { ok: true, counts, message: "Respaldo importado. Inicie sesión nuevamente." },
        {
          "Set-Cookie": sessionCookie("", {
            maxAge: 0,
            secure: cookieSecure,
            name: sessionCookieName,
          }),
        },
      );
      return;
    }

    if (pathname === "/api/logout" && req.method === "POST") {
      sessions.delete(session.token);
      json(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie": sessionCookie("", {
            maxAge: 0,
            secure: cookieSecure,
            name: sessionCookieName,
          }),
        },
      );
      return;
    }

    if (pathname === "/api/session" && req.method === "GET") {
      json(res, 200, {
        user: publicUser(user),
        permissions: [...ROLE_PERMISSIONS[user.role]],
      });
      return;
    }

    if (pathname === "/api/bootstrap" && req.method === "GET") {
      const payload = {
        user: publicUser(user),
        permissions: [...ROLE_PERMISSIONS[user.role]],
        clients: hasPermission(user, "clients") ? db.list("clients") : [],
        drivers: hasPermission(user, "drivers") ? db.list("drivers") : [],
        vehicles: hasPermission(user, "vehicles") ? db.list("vehicles") : [],
        quotes: hasPermission(user, "quotes")
          ? db.list("quotes").map((quote) => withNames(db, quote))
          : [],
        itineraries: filterForUser(db, "itineraries", user, db.list("itineraries")),
        history: hasPermission(user, "history")
          ? filterForUser(db, "history", user, db.list("history")).slice(0, 250)
          : [],
        rates: hasPermission(user, "rates") || hasPermission(user, "quotes") ? db.data.rates : null,
        settings: db.data.settings,
        users: hasPermission(user, "users") ? db.list("users").map(publicUser) : [],
      };
      json(res, 200, payload);
      return;
    }

    if (pathname === "/api/dashboard" && req.method === "GET") {
      requirePermission(user, "dashboard");
      const quotes = db.list("quotes");
      const currentMonth = guatemalaMonthValue();
      const monthQuotes = quotes.filter((item) => String(item.acceptedAt || "").startsWith(currentMonth));
      json(res, 200, {
        quotes: quotes.length,
        clients: db.list("clients").length,
        upcomingServices: quotes.filter(
          (item) =>
            item.serviceDate >= guatemalaDateValue() &&
            SERVICE_STATUSES.has(item.status) &&
            item.paymentProof,
        ).length,
        monthSales: monthQuotes
          .filter((item) => SERVICE_STATUSES.has(item.status))
          .reduce((total, item) => total + Number(item.amountPaid || item.totals?.total || 0), 0),
      });
      return;
    }

    if (pathname === "/api/routes/calculate" && req.method === "POST") {
      requirePermission(user, "quotes");
      const body = await readJson(req);
      const result = await calculateRoute(body.origin, body.destination, {
        googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
        allowFallback: String(process.env.ALLOW_ROUTE_FALLBACK || "true") === "true",
      });
      json(res, 200, result);
      return;
    }

    if (pathname === "/api/quotes/calculate" && req.method === "POST") {
      requirePermission(user, "quotes");
      const body = await readJson(req);
      json(res, 200, calculateQuote(body, db.data.rates));
      return;
    }

    if (pathname === "/api/rates" && req.method === "PUT") {
      requirePermission(user, "rates");
      const body = await readJson(req);
      const rates = await db.setObject(
        "rates",
        {
          pricePerKm: Math.max(0, cleanNumber(body.pricePerKm)),
          pricePerMinute: Math.max(0, cleanNumber(body.pricePerMinute)),
          minimumFare: Math.max(0, cleanNumber(body.minimumFare)),
          nightSurcharge: Math.max(0, cleanNumber(body.nightSurcharge)),
          waitingPerHour: Math.max(0, cleanNumber(body.waitingPerHour)),
          airportSurcharge: Math.max(0, cleanNumber(body.airportSurcharge)),
          discountPercent: Math.min(100, Math.max(0, cleanNumber(body.discountPercent))),
          taxPercent: Math.max(0, cleanNumber(body.taxPercent, 12)),
          nightStart: cleanString(body.nightStart, 10),
          nightEnd: cleanString(body.nightEnd, 10),
        },
        user.id,
      );
      await db.audit(user.id, "actualizar", "rates", "rates", "Tarifas actualizadas");
      json(res, 200, rates);
      return;
    }

    if (pathname === "/api/settings" && req.method === "PUT") {
      requirePermission(user, "settings");
      const body = await readJson(req);
      const settings = await db.setObject(
        "settings",
        {
          companyName: cleanString(body.companyName, 120),
          legalName: cleanString(body.legalName, 160),
          phone: cleanString(body.phone, 40),
          email: cleanString(body.email, 160),
          address: cleanString(body.address, 250),
          currency: cleanString(body.currency || "GTQ", 10),
          quotePrefix: cleanString(body.quotePrefix || "Coti-Luxury", 20),
          clientItineraryPrefix: cleanString(body.clientItineraryPrefix || "LT-CLI", 20).toUpperCase(),
          driverItineraryPrefix: cleanString(body.driverItineraryPrefix || "LT-PIL", 20).toUpperCase(),
          defaultPdfTemplate: cleanString(body.defaultPdfTemplate || "noir", 30),
        },
        user.id,
      );
      await db.audit(user.id, "actualizar", "settings", "settings", "Configuración actualizada");
      json(res, 200, settings);
      return;
    }

    let match = routeMatch(pathname, "/api/quotes/:id/pdf");
    if (match && req.method === "GET") {
      requirePermission(user, "quotes");
      const quote = db.find("quotes", match.id);
      if (!quote) {
        json(res, 404, { error: "Cotización no encontrada." });
        return;
      }
      const pdf = buildQuotePdf(
        withNames(db, quote),
        { settings: db.data.settings },
        url.searchParams.get("template") || quote.pdfTemplate,
      );
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.number}.pdf"`,
        "Content-Length": pdf.length,
      });
      res.end(pdf);
      return;
    }

    match = routeMatch(pathname, "/api/quotes/:id/accept");
    if (match && req.method === "POST") {
      requirePermission(user, "quotes");
      const quote = db.find("quotes", match.id);
      if (!quote) {
        json(res, 404, { error: "Cotización no encontrada." });
        return;
      }
      const body = await readJson(req);
      const paymentProof = normalizePaymentProof(body, user.id);
      const amountPaid = Math.max(0, cleanNumber(body.amountPaid, quote.totals?.total || 0));
      if (!amountPaid) {
        json(res, 400, { error: "Ingrese el monto pagado por el cliente." });
        return;
      }
      const acceptedAt = new Date().toISOString();
      const updated = await db.update(
        "quotes",
        quote.id,
        {
          status: "aceptada",
          amountPaid,
          acceptedAt,
          paymentReference: cleanString(body.paymentReference, 120),
          paymentNotes: cleanString(body.paymentNotes, 1000),
          paymentProof,
        },
        user.id,
      );
      await db.audit(
        user.id,
        "aceptar_servicio",
        "quotes",
        quote.id,
        `${quote.number} · ${amountPaid}`,
      );
      json(res, 200, withNames(db, updated));
      return;
    }

    match = routeMatch(pathname, "/api/quotes/:id/itineraries");
    if (match && req.method === "POST") {
      const quote = db.find("quotes", match.id);
      if (!quote) {
        json(res, 404, { error: "Cotización no encontrada." });
        return;
      }
      const body = await readJson(req);
      const type = body.type === "piloto" ? "piloto" : "cliente";
      requirePermission(user, type === "piloto" ? "driverItineraries" : "clientItineraries");
      const prefix =
        type === "piloto"
          ? db.data.settings.driverItineraryPrefix
          : db.data.settings.clientItineraryPrefix;
      const itinerary = await db.create(
        "itineraries",
        {
          number: db.nextNumber("itineraries", prefix),
          quoteId: quote.id,
          quoteNumber: quote.number,
          type,
          status: "activo",
          title: type === "piloto" ? `Servicio ${quote.number}` : `Su viaje con Luxury Travel`,
          clientName: quote.clientName,
          clientNit: quote.clientNit,
          clientPhone: quote.clientPhone,
          serviceDate: quote.serviceDate,
          departureTime: quote.departureTime,
          arrivalTime: quote.arrivalTime,
          returnTime: quote.returnTime,
          origin: quote.origin,
          destination: quote.destination,
          endLocation: quote.endLocation,
          passengers: quote.passengers,
          passengerDescription: quote.passengerDescription,
          luggage: quote.luggage,
          luggageDescription: quote.luggageDescription,
          vehicleId: quote.vehicleId,
          vehicleIds: quote.vehicleIds || (quote.vehicleId ? [quote.vehicleId] : []),
          vehicleManualName: quote.vehicleManualName,
          vehicleName: withNames(db, quote).vehicleName,
          hasBed: quote.hasBed,
          sprinter311Configuration: quote.sprinter311Configuration,
          hasPlayStation5: quote.hasPlayStation5,
          hasTv: quote.hasTv,
          seatConfiguration: quote.seatConfiguration,
          hasSuperLuxurySeats: quote.hasSuperLuxurySeats,
          maxPassengers: quote.maxPassengers,
          driverId: quote.driverId,
          driverManualName: quote.driverManualName,
          driverName: withNames(db, quote).driverName,
          assignedUserId: quote.driverUserId,
          serviceType: quote.serviceType,
          instructions: cleanString(body.instructions || quote.notes, 2000),
          contactNotes: cleanString(body.contactNotes, 1000),
        },
        user.id,
      );
      await db.audit(
        user.id,
        "crear",
        "itinerary",
        itinerary.id,
        `${itinerary.number} · ${type}`,
      );
      json(res, 201, itinerary);
      return;
    }

    match = routeMatch(pathname, "/api/:collection/:id");
    if (match && ["GET", "PUT", "DELETE"].includes(req.method)) {
      const { collection, id } = match;
      const permission = COLLECTION_PERMISSION[collection];
      if (!permission) {
        json(res, 404, { error: "Recurso no encontrado." });
        return;
      }
      requirePermission(user, permission);
      if (collection === "history" && req.method !== "GET") {
        json(res, 405, { error: "El historial es de solo lectura." });
        return;
      }
      const current = db.find(collection, id);
      if (!current) {
        json(res, 404, { error: "Registro no encontrado." });
        return;
      }
      if (req.method === "GET") {
        json(res, 200, collection === "users" ? publicUser(current) : current);
        return;
      }
      if (req.method === "DELETE") {
        if (collection === "users" && id === user.id) {
          json(res, 400, { error: "No puede eliminar su propio usuario." });
          return;
        }
        await db.remove(collection, id);
        await db.audit(user.id, "eliminar", collection, id, "Registro eliminado");
        json(res, 200, { ok: true });
        return;
      }

      const body = await readJson(req);
      let patch;
      if (collection === "quotes") {
        patch = normalizeQuote(body, db.data.rates, current);
        if (!parseBoolean(body.allowIncomplete)) {
          validateRequired(patch, ["clientName"]);
          validateQuoteVehicle(patch);
          validateQuoteCapacity(db, patch);
        }
        if (SERVICE_STATUSES.has(patch.status) && !current.paymentProof) {
          const error = new Error("Para aceptar una cotización debe subir la boleta de pago o depósito.");
          error.statusCode = 400;
          throw error;
        }
        await syncClientForQuote(db, patch, user.id);
        const sequence =
          Number(current.quoteSequence || extractQuoteSequence(current.number)) || nextQuoteSequence(db);
        patch.quoteSequence = sequence;
        patch.number = formatQuoteNumber(sequence, patch.clientName, patch.clientPhone);
      } else if (collection === "users") {
        validateRequired(body, ["name", "email"]);
        const email = cleanString(body.email, 160).toLowerCase();
        if (db.list("users").some((item) => item.id !== id && item.email === email)) {
          json(res, 409, { error: "Ya existe un usuario con ese correo." });
          return;
        }
        if (body.password && String(body.password).length < 8) {
          json(res, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
          return;
        }
        patch = {
          name: cleanString(body.name, 120),
          email,
          phone: cleanString(body.phone, 40),
          role: ["administrador", "vendedor", "piloto"].includes(body.role)
            ? body.role
            : current.role,
          active: body.active === undefined ? current.active : parseBoolean(body.active),
        };
        if (body.password) patch.passwordHash = hashPassword(String(body.password));
      } else {
        patch = normalizeEntity(collection, body);
        if (collection === "clients") {
          validateRequired(patch, ["name"]);
          const clientNameKey = normalizeClientName(patch.name);
          if (
            db
              .list("clients")
              .some((item) => item.id !== id && normalizeClientName(item.name) === clientNameKey)
          ) {
            json(res, 409, {
              error: "Ya existe un cliente con ese nombre. Edite su ficha existente.",
            });
            return;
          }
        }
      }
      const updated = await db.update(collection, id, patch, user.id);
      await db.audit(user.id, "actualizar", collection, id, updated.number || updated.name || "");
      json(res, 200, collection === "users" ? publicUser(updated) : updated);
      return;
    }

    match = routeMatch(pathname, "/api/:collection");
    if (match && ["GET", "POST"].includes(req.method)) {
      const { collection } = match;
      const permission = COLLECTION_PERMISSION[collection];
      if (!permission) {
        json(res, 404, { error: "Recurso no encontrado." });
        return;
      }
      requirePermission(user, permission);
      if (collection === "history" && req.method !== "GET") {
        json(res, 405, { error: "El historial es de solo lectura." });
        return;
      }
      if (req.method === "GET") {
        const records = filterForUser(db, collection, user, db.list(collection));
        json(
          res,
          200,
          collection === "users"
            ? records.map(publicUser)
            : collection === "quotes"
              ? records.map((quote) => withNames(db, quote))
              : records,
        );
        return;
      }

      const body = await readJson(req);
      let entity;
      if (collection === "quotes") {
        entity = normalizeQuote(body, db.data.rates);
        if (!parseBoolean(body.allowIncomplete)) {
          validateRequired(entity, ["clientName"]);
          validateQuoteVehicle(entity);
          validateQuoteCapacity(db, entity);
        }
        if (SERVICE_STATUSES.has(entity.status)) {
          const error = new Error("Para aceptar una cotización debe subir la boleta de pago o depósito.");
          error.statusCode = 400;
          throw error;
        }
        const sequence = nextQuoteSequence(db);
        entity.quoteSequence = sequence;
        entity.number = formatQuoteNumber(sequence, entity.clientName, entity.clientPhone);
        await syncClientForQuote(db, entity, user.id);
      } else if (collection === "users") {
        validateRequired(body, ["name", "email", "password"]);
        if (String(body.password).length < 8) {
          json(res, 400, { error: "La contraseña debe tener al menos 8 caracteres." });
          return;
        }
        const email = cleanString(body.email, 160).toLowerCase();
        if (db.list("users").some((item) => item.email === email)) {
          json(res, 409, { error: "Ya existe un usuario con ese correo." });
          return;
        }
        entity = {
          name: cleanString(body.name, 120),
          email,
          phone: cleanString(body.phone, 40),
          role: ["administrador", "vendedor", "piloto"].includes(body.role)
            ? body.role
            : "vendedor",
          active: true,
          passwordHash: hashPassword(String(body.password)),
        };
      } else {
        entity = normalizeEntity(collection, body);
        validateRequired(
          entity,
          collection === "vehicles"
            ? ["brand", "model", "plate"]
            : collection === "history"
              ? ["action"]
              : ["name"],
        );
        if (collection === "clients") {
          const clientNameKey = normalizeClientName(entity.name);
          const existingClient = db
            .list("clients")
            .find((item) => normalizeClientName(item.name) === clientNameKey);
          if (existingClient) {
            const updatedClient = await db.update(
              "clients",
              existingClient.id,
              mergeClientDetails(existingClient, entity),
              user.id,
            );
            await db.audit(
              user.id,
              "actualizar",
              "clients",
              updatedClient.id,
              `${updatedClient.name} · cliente existente reutilizado`,
            );
            json(res, 200, { ...updatedClient, mergedExisting: true });
            return;
          }
        }
      }
      const created = await db.create(collection, entity, user.id);
      await db.audit(
        user.id,
        "crear",
        collection,
        created.id,
        created.number || created.name || created.plate || "",
      );
      json(res, 201, collection === "users" ? publicUser(created) : created);
      return;
    }

    json(res, 404, { error: "Endpoint no encontrado." });
  }

  const server = createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) {
        await apiHandler(req, res, url);
      } else if (["GET", "HEAD"].includes(req.method)) {
        await serveStatic(req, res, url.pathname);
      } else {
        json(res, 405, { error: "Método no permitido." });
      }
    } catch (error) {
      if (!error.statusCode || error.statusCode >= 500) {
        console.error(error);
      }
      json(res, error.statusCode || 500, {
        error: error.statusCode ? error.message : "Ocurrió un error interno.",
      });
    }
  });

  return { server, db };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server } = await createApp();
  const port = Number(process.env.PORT || 8790);
  const host = process.env.HOST || "127.0.0.1";
  server.listen(port, host, () => {
    console.log(`Luxury Travel disponible en http://${host}:${port}`);
  });
}
