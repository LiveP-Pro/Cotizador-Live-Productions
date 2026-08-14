import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth.js";

const now = () => new Date().toISOString();
const COLLECTION_NAMES = ["users", "clients", "drivers", "vehicles", "quotes", "itineraries", "history"];

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
      superLuxuryCapacity: 9,
      luggageCapacity: 12,
      status: "disponible",
      color: "Negro",
      supportsBed: true,
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
    schemaVersion: 8,
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
  constructor(filePath) {
    this.filePath = resolve(filePath);
    this.backupDirectory = join(dirname(this.filePath), "backups");
    this.data = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      this.data = JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.data = seedDatabase();
      await this.persist();
    }
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
    const temporary = `${backupPath}.tmp`;
    const payload = JSON.stringify(this.data, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporary, payload, "utf8");
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
    const temporary = `${this.filePath}.tmp`;
    this.writeQueue = this.writeQueue.then(async () => {
      await writeFile(temporary, payload, "utf8");
      await rename(temporary, this.filePath);
    });
    await this.writeQueue;
  }
}
