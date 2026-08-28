import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth.js";
import { calculateQuote } from "./pricing.js";

const now = () => new Date().toISOString();
const COLLECTION_NAMES = ["users", "clients", "drivers", "vehicles", "quotes", "itineraries", "history"];

export function normalizeClientName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("es-GT")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanClientValue(value) {
  return String(value ?? "").trim();
}

function roundMoney(value) {
  const number = Number(value);
  return Math.round(Math.max(0, Number.isFinite(number) ? number : 0) * 100) / 100;
}

function cleanPaymentProofForMigration(proof = {}, quote = {}, index = 0) {
  const fileName = cleanClientValue(proof.fileName).slice(0, 180);
  const mimeType = cleanClientValue(proof.mimeType).toLowerCase().slice(0, 80);
  const dataUrl = cleanClientValue(proof.dataUrl).slice(0, 12_000_000);
  if (!fileName || !mimeType || !dataUrl) return null;
  return {
    ...proof,
    fileName,
    mimeType,
    size: Math.max(0, Math.round(Number(proof.size || 0))),
    dataUrl,
    amount: roundMoney(proof.amount ?? (index === 0 ? quote.amountPaid || quote.totals?.total || 0 : 0)),
    reference: cleanClientValue(proof.reference || quote.paymentReference).slice(0, 120),
    notes: cleanClientValue(proof.notes || quote.paymentNotes).slice(0, 1000),
    uploadedAt: proof.uploadedAt || quote.acceptedAt || quote.updatedAt || now(),
    uploadedBy: proof.uploadedBy || quote.updatedBy || quote.createdBy || "system",
  };
}

function migrateQuotePayments(quote = {}) {
  const rawProofs = Array.isArray(quote.paymentProofs) && quote.paymentProofs.length
    ? quote.paymentProofs
    : quote.paymentProof
      ? [quote.paymentProof]
      : [];
  const paymentProofs = rawProofs
    .map((proof, index) => cleanPaymentProofForMigration(proof, quote, index))
    .filter(Boolean)
    .slice(0, 10);
  const proofTotal = roundMoney(paymentProofs.reduce((sum, proof) => sum + roundMoney(proof.amount), 0));
  const amountPaid = proofTotal || roundMoney(quote.amountPaid || 0);
  return {
    ...quote,
    amountPaid,
    paymentReference: quote.paymentReference || paymentProofs.map((proof) => proof.reference).filter(Boolean).join(" / "),
    paymentNotes: quote.paymentNotes || "",
    paymentProof: quote.paymentProof || paymentProofs[0] || null,
    paymentProofs,
  };
}

function clientNameQuality(value) {
  const name = cleanClientValue(value);
  if (!name) return 0;
  const letters = name.replace(/[^\p{Letter}]/gu, "");
  if (!letters) return 1;
  if (letters === letters.toLocaleUpperCase("es-GT")) return 2;
  if (letters === letters.toLocaleLowerCase("es-GT")) return 3;
  return 4;
}

function preferredClientName(current, incoming) {
  const currentName = cleanClientValue(current);
  const incomingName = cleanClientValue(incoming);
  if (!currentName) return incomingName;
  if (!incomingName) return currentName;
  return clientNameQuality(incomingName) > clientNameQuality(currentName)
    ? incomingName
    : currentName;
}

function mergeClientNit(current, incoming) {
  const currentNit = cleanClientValue(current);
  const incomingNit = cleanClientValue(incoming);
  if (!incomingNit) return currentNit;
  const incomingIsGeneric = normalizeClientName(incomingNit) === "cf";
  const currentIsSpecific = currentNit && normalizeClientName(currentNit) !== "cf";
  return incomingIsGeneric && currentIsSpecific ? currentNit : incomingNit;
}

function mergeClientNotes(current, incoming) {
  const currentNotes = cleanClientValue(current);
  const incomingNotes = cleanClientValue(incoming);
  if (!currentNotes) return incomingNotes;
  if (!incomingNotes || currentNotes === incomingNotes) return currentNotes;
  return `${currentNotes}\n${incomingNotes}`;
}

export function mergeClientDetails(current = {}, incoming = {}) {
  return {
    name: preferredClientName(current.name, incoming.name),
    nit: mergeClientNit(current.nit, incoming.nit),
    phone: cleanClientValue(incoming.phone) || cleanClientValue(current.phone),
    email: cleanClientValue(incoming.email).toLocaleLowerCase("es-GT")
      || cleanClientValue(current.email).toLocaleLowerCase("es-GT"),
    company: cleanClientValue(incoming.company) || cleanClientValue(current.company),
    notes: mergeClientNotes(current.notes, incoming.notes),
  };
}

function clientTimestamp(client, field, fallback) {
  const timestamp = Date.parse(client?.[field] || "");
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

export function consolidateDuplicateClients(data) {
  if (!data || !Array.isArray(data.clients) || data.clients.length < 2) {
    return { changed: false, mergedCount: 0 };
  }

  const groups = new Map();
  data.clients.forEach((client, index) => {
    const key = normalizeClientName(client?.name);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ client, index });
  });

  const replacementById = new Map();
  const mergedById = new Map();
  let mergedCount = 0;

  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    const ordered = [...entries].sort((left, right) => {
      const leftTime = clientTimestamp(left.client, "createdAt", left.index);
      const rightTime = clientTimestamp(right.client, "createdAt", right.index);
      return leftTime - rightTime || left.index - right.index;
    });
    const canonical = ordered[0].client;
    let merged = { ...canonical };
    for (const { client } of ordered.slice(1)) {
      merged = {
        ...merged,
        ...mergeClientDetails(merged, client),
      };
      replacementById.set(client.id, canonical.id);
      mergedCount += 1;
    }
    const latest = [...ordered].sort((left, right) => {
      const leftTime = clientTimestamp(left.client, "updatedAt", left.index);
      const rightTime = clientTimestamp(right.client, "updatedAt", right.index);
      return rightTime - leftTime || right.index - left.index;
    })[0].client;
    mergedById.set(canonical.id, {
      ...merged,
      id: canonical.id,
      createdAt: canonical.createdAt,
      createdBy: canonical.createdBy,
      updatedAt: latest.updatedAt || merged.updatedAt || canonical.createdAt,
      updatedBy: latest.updatedBy || merged.updatedBy || canonical.createdBy,
    });
  }

  if (!mergedCount) return { changed: false, mergedCount: 0 };

  data.clients = data.clients
    .filter((client) => !replacementById.has(client.id))
    .map((client) => mergedById.get(client.id) || client);

  const canonicalByName = new Map(
    data.clients.map((client) => [normalizeClientName(client.name), client.id]),
  );
  for (const collection of ["quotes", "itineraries"]) {
    if (!Array.isArray(data[collection])) continue;
    data[collection] = data[collection].map((record) => {
      const replacementId = replacementById.get(record.clientId);
      const nameMatch = !record.clientId
        ? canonicalByName.get(normalizeClientName(record.clientName))
        : "";
      const clientId = replacementId || nameMatch || record.clientId;
      return clientId === record.clientId ? record : { ...record, clientId };
    });
  }
  if (Array.isArray(data.history)) {
    data.history = data.history.map((entry) => {
      const replacementId = entry.entityType === "clients"
        ? replacementById.get(entry.entityId)
        : "";
      return replacementId ? { ...entry, entityId: replacementId } : entry;
    });
  }

  return { changed: true, mergedCount };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El respaldo no contiene una base de datos válida.");
  }
  for (const name of COLLECTION_NAMES) {
    if (!Array.isArray(value[name])) {
      throw new Error(`El respaldo no contiene la colección ${name}.`);
    }
  }
  if (!value.rates || typeof value.rates !== "object" || Array.isArray(value.rates)) {
    throw new Error("El respaldo no contiene las tarifas.");
  }
  if (!value.settings || typeof value.settings !== "object" || Array.isArray(value.settings)) {
    throw new Error("El respaldo no contiene la configuración.");
  }
  const administrator = value.users.find(
    (user) => user?.role === "administrador" && user?.active !== false && user?.passwordHash,
  );
  if (!administrator) {
    throw new Error("El respaldo debe contener al menos un administrador activo.");
  }
  return cloneJson(value);
}

function luxuryVehicles(adminId, createdAt) {
  return [
    {
      id: randomUUID(),
      brand: "Mercedes Benz",
      model: "Sprinter 311",
      unitNumber: 1,
      fleetName: "Mercedes Benz Sprinter 311, 1",
      year: 2024,
      plate: "SPRINTER-1",
      capacity: 15,
      capacityWithBed: 8,
      capacityWithLuggage: 10,
      luggageCapacity: 12,
      status: "disponible",
      color: "Negro",
      supportsBed: true,
      supportsPlayStation5: true,
      createdAt,
      createdBy: adminId,
    },
    {
      id: randomUUID(),
      brand: "Mercedes Benz",
      model: "Sprinter 311",
      unitNumber: 2,
      fleetName: "Mercedes Benz Sprinter 311, 2",
      year: 2024,
      plate: "SPRINTER-2",
      capacity: 15,
      capacityWithBed: 8,
      capacityWithLuggage: 10,
      luggageCapacity: 12,
      status: "disponible",
      color: "Negro",
      supportsBed: true,
      supportsPlayStation5: true,
      createdAt,
      createdBy: adminId,
    },
    {
      id: randomUUID(),
      brand: "Mercedes Benz",
      model: "Sprinter 316",
      unitNumber: 3,
      fleetName: "Mercedes Benz Sprinter 316, 3",
      year: 2024,
      plate: "SPRINTER-3",
      capacity: 14,
      capacityWithBed: 8,
      capacityWithLuggage: 14,
      superLuxuryCapacity: 10,
      luxurySeatCapacity: 10,
      m1SeatCapacity: 14,
      m3SeatCapacity: 11,
      luggageCapacity: 12,
      status: "disponible",
      color: "Negro",
      supportsBed: false,
      supportsPlayStation5: true,
      supportsSuperLuxurySeats: true,
      createdAt,
      createdBy: adminId,
    },
  ];
}

function seedDatabase() {
  const createdAt = now();
  const adminId = randomUUID();
  const driverId = randomUUID();

  return {
    schemaVersion: 13,
    users: [
      {
        id: adminId,
        name: "Administrador Luxury Travel",
        email: "admin@luxurytravel.gt",
        phone: "",
        role: "administrador",
        active: true,
        passwordHash: hashPassword("Luxury2026!"),
        createdAt,
        createdBy: "system",
      },
    ],
    clients: [],
    drivers: [
      {
        id: driverId,
        name: "Piloto de demostración",
        phone: "5555-0000",
        license: "A-000000",
        status: "disponible",
        notes: "",
        createdAt,
        createdBy: adminId,
      },
    ],
    vehicles: luxuryVehicles(adminId, createdAt),
    quotes: [],
    itineraries: [],
    history: [],
    rates: {
      pricePerKm: 5,
      pricePerMinute: 1,
      minimumFare: 150,
      nightSurcharge: 0,
      waitingPerHour: 75,
      airportSurcharge: 50,
      discountPercent: 0,
      taxPercent: 12,
      nightStart: "20:00",
      nightEnd: "05:00",
      updatedAt: createdAt,
      updatedBy: adminId,
    },
    settings: {
      companyName: "Luxury Travel",
      legalName: "Luxury Travel Guatemala",
      phone: "",
      email: "reservas@luxurytravel.gt",
      address: "Ciudad de Guatemala, Guatemala",
      currency: "GTQ",
      quotePrefix: "Coti-Luxury",
      clientItineraryPrefix: "LT-CLI",
      driverItineraryPrefix: "LT-PIL",
      defaultPdfTemplate: "noir",
      updatedAt: createdAt,
      updatedBy: adminId,
    },
  };
}

export class JsonDatabase {
  constructor(filePath, options = {}) {
    this.filePath = resolve(filePath);
    this.mirrorFilePath = options.mirrorFile ? resolve(options.mirrorFile) : "";
    this.backupDirectory = options.backupDirectory
      ? resolve(options.backupDirectory)
      : join(dirname(this.filePath), "backups");
    this.data = null;
    this.writeQueue = Promise.resolve();
    this.recoverySource = "";
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    await mkdir(this.backupDirectory, { recursive: true });
    const backupFiles = (await readdir(this.backupDirectory))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse()
      .map((name) => join(this.backupDirectory, name));
    const candidates = [this.filePath, this.mirrorFilePath, ...backupFiles].filter(Boolean);
    const invalidCandidates = [];

    for (const candidate of [...new Set(candidates)]) {
      try {
        this.data = validateSnapshot(JSON.parse(await readFile(candidate, "utf8")));
        this.recoverySource = candidate;
        break;
      } catch (error) {
        if (error.code !== "ENOENT") invalidCandidates.push(`${candidate}: ${error.message}`);
      }
    }

    if (!this.data) {
      if (invalidCandidates.length) {
        throw new Error(
          `No se encontró una copia válida de Luxury Travel. ${invalidCandidates.join(" | ")}`,
        );
      }
      this.data = seedDatabase();
      this.recoverySource = "nueva";
    }
    await this.persist();
    await this.migrate();
    await this.createDailyBackup();
    return this;
  }

  async migrate() {
    let changed = false;
    if (Number(this.data.schemaVersion || 1) < 2) {
      const adminId = this.data.users.find((user) => user.role === "administrador")?.id || "system";
      const createdAt = now();
      this.data.vehicles = this.data.vehicles.filter(
        (vehicle) => !(vehicle.brand === "Toyota" && vehicle.plate === "P-000AAA"),
      );
      const currentUnits = new Set(
        this.data.vehicles
          .filter((vehicle) => vehicle.brand === "Mercedes Benz")
          .map((vehicle) => vehicle.unitNumber),
      );
      for (const vehicle of luxuryVehicles(adminId, createdAt)) {
        if (!currentUnits.has(vehicle.unitNumber)) this.data.vehicles.push(vehicle);
      }
      this.data.schemaVersion = 2;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 3) {
      this.data.clients = this.data.clients.map((client) => ({
        nit: "",
        ...client,
      }));
      this.data.quotes = this.data.quotes.map((quote, index) => ({
        clientNit: "",
        destinationRateId: "",
        destinationRateName: "",
        serviceRateType: "",
        fixedFare: 0,
        fixedFareIncludesTax: true,
        quoteSequence: quote.quoteSequence || index + 1,
        amountPaid: Number(quote.amountPaid || 0),
        acceptedAt: quote.acceptedAt || "",
        paymentProof: quote.paymentProof || null,
        ...quote,
      }));
      this.data.itineraries = this.data.itineraries.map((itinerary) => ({
        clientNit: "",
        ...itinerary,
      }));
      this.data.settings.quotePrefix = "Coti-Luxury";
      this.data.schemaVersion = 3;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 4) {
      this.data.quotes = this.data.quotes.map((quote) => ({
        vehicleManualName: "",
        driverManualName: "",
        hasTv: false,
        ...quote,
      }));
      this.data.itineraries = this.data.itineraries.map((itinerary) => ({
        vehicleManualName: "",
        driverManualName: "",
        hasTv: false,
        ...itinerary,
      }));
      this.data.schemaVersion = 4;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 5) {
      this.data.quotes = this.data.quotes.map((quote) => ({
        quoteDate: String(quote.createdAt || "").slice(0, 10),
        serviceStartDate: quote.serviceDate || "",
        serviceEndDate: quote.returnDate || quote.serviceDate || "",
        returnDate: quote.returnDate || "",
        hasLuggage: Boolean(quote.luggage),
        luggageDescription: quote.luggage ? `${quote.luggage} maletas` : "",
        ...quote,
      }));
      this.data.schemaVersion = 5;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 6) {
      this.data.quotes = this.data.quotes.map((quote) => ({
        vehicleCount: Array.isArray(quote.vehicleIds) && quote.vehicleIds.length ? quote.vehicleIds.length : 1,
        discountAmount: 0,
        ...quote,
      }));
      this.data.schemaVersion = 6;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 7) {
      this.data.quotes = this.data.quotes.map((quote) => ({
        serviceSelections: Array.isArray(quote.serviceSelections) ? quote.serviceSelections : [],
        ...quote,
      }));
      this.data.schemaVersion = 7;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 8) {
      this.data.vehicles = this.data.vehicles.map((vehicle) => {
        const isSprinter316 = vehicle.brand === "Mercedes Benz" && vehicle.model === "Sprinter 316" && Number(vehicle.unitNumber) === 3;
        return {
          supportsSuperLuxurySeats: false,
          superLuxuryCapacity: 0,
          ...vehicle,
          ...(isSprinter316
            ? {
                capacity: 14,
                supportsSuperLuxurySeats: true,
                superLuxuryCapacity: 9,
              }
            : {}),
        };
      });
      this.data.quotes = this.data.quotes.map((quote) => ({
        hasSuperLuxurySeats: false,
        ...quote,
      }));
      this.data.itineraries = this.data.itineraries.map((itinerary) => ({
        hasSuperLuxurySeats: false,
        ...itinerary,
      }));
      this.data.schemaVersion = 8;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 9) {
      this.data.vehicles = this.data.vehicles.map((vehicle) => {
        const isSprinter316 = vehicle.brand === "Mercedes Benz" && vehicle.model === "Sprinter 316";
        const isSprinter311 = vehicle.brand === "Mercedes Benz" && vehicle.model === "Sprinter 311";
        return {
          ...vehicle,
          ...(isSprinter311
            ? {
                capacity: 15,
                capacityWithBed: 8,
                capacityWithLuggage: 10,
              }
            : {}),
          ...(isSprinter316
            ? {
                capacity: 14,
                capacityWithLuggage: 14,
                supportsBed: false,
                supportsSuperLuxurySeats: true,
                superLuxuryCapacity: 10,
                luxurySeatCapacity: 10,
                m1SeatCapacity: 14,
                m3SeatCapacity: 11,
              }
            : {}),
        };
      });
      this.data.quotes = this.data.quotes.map((quote) => ({
        passengerDescription: "",
        seatConfiguration: quote.hasSuperLuxurySeats ? "luxury" : "",
        ...quote,
      }));
      this.data.itineraries = this.data.itineraries.map((itinerary) => ({
        passengerDescription: "",
        seatConfiguration: itinerary.hasSuperLuxurySeats ? "luxury" : "",
        ...itinerary,
      }));
      this.data.schemaVersion = 9;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 10) {
      this.data.quotes = this.data.quotes.map((quote) => {
        const vehicleIds = [...new Set(
          (Array.isArray(quote.vehicleIds) ? quote.vehicleIds : quote.vehicleId ? [quote.vehicleId] : [])
            .map((id) => String(id || "").trim())
            .filter(Boolean),
        )];
        const serviceSelections = Array.isArray(quote.serviceSelections)
          ? quote.serviceSelections
          : [];
        const transferTotal = serviceSelections.reduce(
          (sum, item) => sum + Math.max(0, Number(item?.amount || 0)),
          0,
        );
        const priceDisplayMode = quote.priceDisplayMode === "final" ? "final" : "detailed";
        if (priceDisplayMode !== "detailed" || transferTotal <= 0) return quote;
        const storedTotals = quote.totals && typeof quote.totals === "object"
          ? quote.totals
          : {};
        const explicitDiscount = Math.max(0, Number(quote.discountAmount || 0));
        const storedDiscount = Math.max(0, Number(storedTotals.discount || 0));
        const includeStoredTax = Number(storedTotals.tax || 0) > 0
          || Number(storedTotals.taxPercent || 0) > 0;
        const repaired = {
          ...quote,
          vehicleId: vehicleIds[0] || quote.vehicleId || "",
          vehicleIds,
          vehicleCount: vehicleIds.length || (quote.vehicleId || quote.vehicleManualName ? 1 : Math.max(1, Number(quote.vehicleCount || 1))),
          priceDisplayMode,
          fixedFare: transferTotal,
          fixedFareIsTotal: false,
          discountAmount: explicitDiscount || storedDiscount,
          includeTax: quote.includeTax === true || includeStoredTax,
        };
        return {
          ...repaired,
          totals: calculateQuote(repaired, this.data.rates),
        };
      });
      this.data.schemaVersion = 10;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 11) {
      this.data.schemaVersion = 11;
      changed = true;
    }
    const clientConsolidation = consolidateDuplicateClients(this.data);
    if (clientConsolidation.changed) changed = true;
    if (Number(this.data.schemaVersion || 1) < 12) {
      this.data.schemaVersion = 12;
      changed = true;
    }
    if (Number(this.data.schemaVersion || 1) < 13) {
      this.data.quotes = this.data.quotes.map(migrateQuotePayments);
      this.data.schemaVersion = 13;
      changed = true;
    }
    if (changed) await this.persist();
  }

  get collectionNames() {
    return COLLECTION_NAMES;
  }

  exportSnapshot() {
    return cloneJson(this.data);
  }

  async replaceSnapshot(snapshot) {
    const nextData = validateSnapshot(snapshot);
    await this.createBackup("antes-de-importar", { unique: true });
    this.data = nextData;
    await this.persist();
    await this.migrate();
    await this.createDailyBackup();
    return this.exportSnapshot();
  }

  async createDailyBackup() {
    const date = now().slice(0, 10);
    return this.createBackup(`luxury-travel-${date}`, { skipExisting: true });
  }

  async createBackup(label = "luxury-travel", options = {}) {
    await mkdir(this.backupDirectory, { recursive: true });
    const suffix = options.unique ? `-${now().replace(/[:.]/g, "-")}` : "";
    const fileName = `${label}${suffix}.json`;
    const backupPath = join(this.backupDirectory, fileName);
    if (options.skipExisting) {
      try {
        await readFile(backupPath, "utf8");
        return backupPath;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const temporary = `${backupPath}.tmp-${process.pid}-${randomUUID()}`;
    const payload = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
      await rename(temporary, backupPath);
    });
    await this.writeQueue;
    await this.pruneBackups();
    return backupPath;
  }

  async pruneBackups(limit = 30) {
    const entries = (await readdir(this.backupDirectory))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse();
    await Promise.all(entries.slice(limit).map((name) => unlink(join(this.backupDirectory, name))));
  }

  list(name) {
    this.assertCollection(name);
    return this.data[name];
  }

  find(name, id) {
    return this.list(name).find((item) => item.id === id) || null;
  }

  async create(name, value, actorId) {
    this.assertCollection(name);
    const timestamp = now();
    const item = {
      ...value,
      id: value.id || randomUUID(),
      createdAt: value.createdAt || timestamp,
      createdBy: value.createdBy || actorId,
      updatedAt: timestamp,
      updatedBy: actorId,
    };
    this.data[name].push(item);
    await this.persist();
    return item;
  }

  async update(name, id, patch, actorId) {
    this.assertCollection(name);
    const index = this.data[name].findIndex((item) => item.id === id);
    if (index < 0) return null;

    const current = this.data[name][index];
    const next = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      createdBy: current.createdBy,
      updatedAt: now(),
      updatedBy: actorId,
    };
    this.data[name][index] = next;
    await this.persist();
    return next;
  }

  async remove(name, id) {
    this.assertCollection(name);
    const index = this.data[name].findIndex((item) => item.id === id);
    if (index < 0) return false;
    this.data[name].splice(index, 1);
    await this.persist();
    return true;
  }

  async setObject(name, value, actorId) {
    if (!["rates", "settings"].includes(name)) {
      throw new Error(`Objeto no permitido: ${name}`);
    }
    this.data[name] = {
      ...this.data[name],
      ...value,
      updatedAt: now(),
      updatedBy: actorId,
    };
    await this.persist();
    return this.data[name];
  }

  async audit(actorId, action, entityType, entityId, detail = "") {
    const user = this.find("users", actorId);
    this.data.history.unshift({
      id: randomUUID(),
      action,
      entityType,
      entityId,
      detail,
      userId: actorId,
      userName: user?.name || "Sistema",
      createdAt: now(),
    });
    this.data.history = this.data.history.slice(0, 2000);
    await this.persist();
  }

  nextNumber(collection, prefix) {
    const year = new Date().getFullYear();
    const count = this.list(collection).filter((item) =>
      String(item.number || "").startsWith(`${prefix}-${year}`),
    ).length;
    return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  assertCollection(name) {
    if (!this.collectionNames.includes(name)) {
      throw new Error(`Colección no permitida: ${name}`);
    }
  }

  async persist() {
    const payload = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      const targets = [this.mirrorFilePath, this.filePath].filter(
        (target, index, values) => target && values.indexOf(target) === index,
      );
      for (const target of targets) {
        await mkdir(dirname(target), { recursive: true });
        const temporary = `${target}.tmp-${process.pid}-${randomUUID()}`;
        await writeFile(temporary, payload, { encoding: "utf8", mode: 0o600 });
        await rename(temporary, target);
      }
    });
    await this.writeQueue;
  }
}
