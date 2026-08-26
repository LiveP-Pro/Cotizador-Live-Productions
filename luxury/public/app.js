const state = {
  user: null,
  permissions: [],
  clients: [],
  drivers: [],
  vehicles: [],
  quotes: [],
  itineraries: [],
  history: [],
  rates: null,
  settings: null,
  users: [],
  module: "dashboard",
  deferredInstall: null,
};

const APP_BASE_PATH = window.location.pathname.startsWith("/luxury") ? "/luxury" : "";

function appPath(pathname = "/") {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${APP_BASE_PATH}${normalized}`;
}

function assetUrl(fileName) {
  return `${window.location.origin}${appPath(`/assets/${fileName}`)}`;
}

const visibleModuleIds = new Set(["dashboard", "quotes"]);
const accessibleModuleIds = new Set([...visibleModuleIds, "clients"]);

const allModules = [
  { id: "dashboard", label: "Resumen", permission: "dashboard", icon: "dashboard" },
  { id: "quotes", label: "Cotizador", permission: "quotes", icon: "file" },
  {
    id: "clientItineraries",
    label: "Itinerarios cliente",
    permission: "clientItineraries",
    icon: "map",
  },
  {
    id: "driverItineraries",
    label: "Itinerarios piloto",
    permission: "driverItineraries",
    icon: "route",
  },
  { id: "clients", label: "Clientes", permission: "clients", icon: "users" },
  { id: "vehicles", label: "Vehículos", permission: "vehicles", icon: "car" },
  { id: "drivers", label: "Pilotos", permission: "drivers", icon: "steering" },
  { id: "rates", label: "Tarifas", permission: "rates", icon: "tag" },
  { id: "history", label: "Historial", permission: "history", icon: "history" },
  { id: "settings", label: "Configuración", permission: "settings", icon: "settings" },
];

const modules = allModules.filter((item) => visibleModuleIds.has(item.id));

const pageInfo = {
  dashboard: ["Operaciones", "Resumen"],
  quotes: ["Comercial", "Cotizador"],
  clientItineraries: ["Documentos", "Itinerarios para cliente"],
  driverItineraries: ["Operación", "Itinerarios para piloto"],
  clients: ["Directorio", "Historial de clientes"],
  vehicles: ["Flota", "Vehículos"],
  drivers: ["Equipo", "Pilotos"],
  rates: ["Finanzas", "Tarifas"],
  history: ["Auditoría", "Historial de servicios"],
  settings: ["Administración", "Configuración"],
};

const icons = {
  dashboard: '<svg viewBox="0 0 24 24"><path d="M4 13h6V4H4v9zm0 7h6v-4H4v4zm10 0h6v-9h-6v9zm0-16v4h6V4h-6z"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3zM9 3v15M15 6v15"/></svg>',
  route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h3a3 3 0 003-3V8a3 3 0 013-3"/></svg>',
  users: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  car: '<svg viewBox="0 0 24 24"><path d="M5 17h14l1-5-2-5H6l-2 5zM7 17v2M17 17v2M4 12h16M7 14h.01M17 14h.01"/></svg>',
  steering: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M3.5 10h17M12 14v7M6 10l4 4M18 10l-4 4"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><path d="M20 13l-7 7-9-9V4h7z"/><circle cx="8.5" cy="8.5" r="1"/></svg>',
  history: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 109-9 9 9 0 00-8.5 6M3 4v5h5M12 7v5l3 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0015 19.4a1.7 1.7 0 00-1 .6 1.7 1.7 0 00-.4 1.1V21H9.6v-.09A1.7 1.7 0 008.5 19.4a1.7 1.7 0 00-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 004.6 15a1.7 1.7 0 00-.6-1 1.7 1.7 0 00-1.1-.4H3V9.6h.09A1.7 1.7 0 004.6 8.5a1.7 1.7 0 00-.34-1.88L4.2 6.56l2.83-2.83.06.06A1.7 1.7 0 009 4.6a1.7 1.7 0 001-.6 1.7 1.7 0 00.4-1.1V3h4v.09A1.7 1.7 0 0015.5 4.6a1.7 1.7 0 001.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0019.4 9a1.7 1.7 0 00.6 1 1.7 1.7 0 001.1.4H21v4h-.09A1.7 1.7 0 0019.4 15z"/></svg>',
  plus: '<svg class="inline-icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L8 18l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  print: '<svg viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4V9h16v9h-2M6 14h12v7H6z"/></svg>',
  itinerary: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/></svg>',
};

const serviceStatuses = new Set(["aceptada", "confirmada", "completada"]);
const allowedVehicleModels = ["Mercedes Benz Sprinter 311", "Mercedes Benz Sprinter 316"];
const sprinter311UnitConfigurations = {
  1: [
    {
      id: "m1-forward-15",
      title: "Todos hacia enfrente",
      detail: "15 pasajeros · Artículo personal.",
      layout: "Todos los asientos viendo hacia enfrente.",
      capacity: 15,
      hasBed: false,
      allowsLuggage: false,
    },
    {
      id: "m1-facing-bed-8",
      title: "Sillones frente a frente + cama",
      detail: "2 sillones de 3 y 2 pasajeros adelante · 8 pasajeros · Permite maletas.",
      layout: "Dos sillones de 3 pasajeros viéndose de frente, cama y 2 pasajeros adelante.",
      capacity: 8,
      hasBed: true,
      allowsLuggage: true,
    },
    {
      id: "m1-facing-row-12",
      title: "Sillones frente a frente + fila de 4",
      detail: "2 sillones de 3, una fila de 4 y 2 adelante · 12 pasajeros · Permite maletas.",
      layout: "Dos sillones de 3 viéndose de frente, una fila de 4 y 2 pasajeros adelante.",
      capacity: 12,
      hasBed: false,
      allowsLuggage: true,
    },
    {
      id: "m1-three-rows-11",
      title: "Tres filas de 3",
      detail: "3 filas de 3 y 2 pasajeros adelante · 11 pasajeros · Permite maletas.",
      layout: "Tres filas de 3 pasajeros con espacio para maletas y 2 pasajeros adelante.",
      capacity: 11,
      hasBed: false,
      allowsLuggage: true,
    },
  ],
  2: [
    {
      id: "m2-forward-18",
      title: "Todos hacia adelante",
      detail: "4 filas de 4 y 2 pasajeros adelante · 18 pasajeros · Maletas de mano.",
      layout: "Todos los asientos viendo hacia adelante.",
      capacity: 18,
      hasBed: false,
      allowsLuggage: true,
    },
    {
      id: "m2-facing-bed-10",
      title: "Filas frente a frente + cama",
      detail: "2 filas de 4 y 2 pasajeros adelante · 10 pasajeros · Permite maletas.",
      layout: "Dos filas de 4 asientos viéndose de frente, cama y 2 pasajeros adelante.",
      capacity: 10,
      hasBed: true,
      allowsLuggage: true,
    },
    {
      id: "m2-three-rows-14",
      title: "Tres filas hacia enfrente",
      detail: "1 fila de 4, 2 filas de 3+1 y 2 adelante · 14 pasajeros · Permite maletas.",
      layout: "Tres filas viendo al frente: una de 4, dos de 3+1 y 2 pasajeros adelante.",
      capacity: 14,
      hasBed: false,
      allowsLuggage: true,
    },
  ],
};
const serviceRateTypes = {
  oneWay: { label: "Servicio de Ida", field: "oneWay" },
  roundTrip: { label: "Servicio de Ida y Vuelta", field: "roundTrip" },
  internal: { label: "Servicio Traslados Internos", field: "internal" },
};
const serviceRateColumns = [
  ["oneWay", "Precio ida"],
  ["roundTrip", "Precio por ida y vuelta"],
  ["internal", "Traslados precio por día completo"],
];
const QUOTE_DRAFT_KEY = "luxury-travel:new-quote-draft";
const APP_VERSION = "81";
const destinationRates = [
  { id: "aeropuerto-ciudad", destination: "AEROPUERTO / CIUDAD", oneWay: 1250, roundTrip: 2500, internal: 3000 },
  { id: "antigua", destination: "ANTIGUA", oneWay: 1500, roundTrip: 3000, internal: 3000 },
  { id: "el-paredon", destination: "EL PAREDON", oneWay: 4000, roundTrip: 8000, internal: 3600 },
  { id: "panajachel", destination: "PANAJACHEL", oneWay: 3800, roundTrip: 7600, internal: 3700 },
  { id: "coban", destination: "COBAN", oneWay: 4900, roundTrip: 9800, internal: 3100 },
  { id: "semuc-chamey", destination: "SEMUC CHAMEY", oneWay: 5500, roundTrip: 11000, internal: 4500 },
  { id: "peten", destination: "PETEN", oneWay: 7300, roundTrip: 14600, internal: 3400 },
  { id: "retaulehu", destination: "RETAULEHU", oneWay: 4900, roundTrip: 9800, internal: 3700 },
  { id: "puerto-san-jose", destination: "PUERTO SAN JOSE", oneWay: 4000, roundTrip: 8000, internal: 3600 },
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function posterMoney(value) {
  const amount = Number(value || 0);
  const hasDecimals = Math.round(amount) !== amount;
  return new Intl.NumberFormat("es-GT", {
    style: "currency",
    currency: "GTQ",
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function vehicleDisplayName(vehicle) {
  if (!vehicle) return "Por asignar";
  return (
    vehicle.fleetName ||
    `${vehicle.brand} ${vehicle.model}${vehicle.unitNumber ? `, ${vehicle.unitNumber}` : ""}`
  );
}

function vehicleUnitLabel(vehicle) {
  return `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim();
}

function vehicleOperationalName(vehicle) {
  const unitNumber = Math.round(Number(vehicle?.unitNumber || 0));
  return unitNumber >= 1 && unitNumber <= 3 ? `M${unitNumber}` : vehicleUnitLabel(vehicle);
}

function vehicleModelName(vehicle) {
  return `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim();
}

function vehicleIsSprinter316(vehicle) {
  return vehicleModelName(vehicle).toLowerCase().includes("sprinter 316");
}

function vehicleBaseCapacity(vehicle) {
  const fallback = vehicleIsSprinter316(vehicle) ? 14 : 15;
  const configured = Math.max(1, Number(vehicle?.capacity || fallback));
  return vehicleIsSprinter316(vehicle) ? Math.min(14, configured) : Math.min(15, configured);
}

function formHasLuggage(form) {
  return Number(form.elements.luggage?.value || 0) > 0 ||
    Boolean(String(form.elements.luggageDescription?.value || "").trim());
}

function sprinter311ConfigurationsForVehicle(vehicle) {
  if (!vehicle || vehicleIsSprinter316(vehicle)) return [];
  const unitNumber = Math.round(Number(vehicle.unitNumber || 0));
  return sprinter311UnitConfigurations[unitNumber] || [];
}

function quoteVehicleConfigurations(source = {}) {
  let value = source.vehicleConfigurations ?? source.vehicleConfigurationsJson ?? {};
  if (typeof value === "string" && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function selectedVehicleConfigurationMap(form) {
  const selectedIds = new Set(
    $$('input[name="vehicleIds"]:checked', form).map((input) => input.value),
  );
  return Object.fromEntries(
    $$('input[data-vehicle-configuration]:checked', form)
      .filter((input) => selectedIds.has(input.dataset.vehicleId))
      .map((input) => [input.dataset.vehicleId, input.value]),
  );
}

function selectedVehicleConfiguration(vehicle, form) {
  const configurationId = selectedVehicleConfigurationMap(form)[vehicle?.id];
  return sprinter311ConfigurationsForVehicle(vehicle).find((item) => item.id === configurationId) || null;
}

function defaultVehicleConfigurationId(vehicle, quote = {}) {
  const configurations = sprinter311ConfigurationsForVehicle(vehicle);
  const storedId = quoteVehicleConfigurations(quote)[vehicle?.id];
  if (configurations.some((item) => item.id === storedId)) return storedId;
  const legacyConfiguration = quote.sprinter311Configuration || (quote.hasBed ? "bed" : "");
  if (legacyConfiguration === "bed") {
    return configurations.find((item) => item.hasBed)?.id || configurations[0]?.id || "";
  }
  if (legacyConfiguration === "luggage") {
    return configurations.find((item) => item.allowsLuggage && !item.hasBed)?.id || configurations[0]?.id || "";
  }
  return configurations[0]?.id || "";
}

function sprinter311ConfigurationValue(form) {
  const configuredVehicles = selectedVehiclesFromForm(form)
    .filter((vehicle) => !vehicleIsSprinter316(vehicle))
    .map((vehicle) => selectedVehicleConfiguration(vehicle, form))
    .filter(Boolean);
  if (configuredVehicles.some((item) => item.hasBed)) return "bed";
  if (configuredVehicles.length) {
    return configuredVehicles.some((item) => item.allowsLuggage) ? "luggage" : "standard";
  }
  const selected = form.elements.sprinter311Configuration?.value;
  if (["bed", "luggage", "standard"].includes(selected)) return selected;
  if (form.elements.hasBed?.checked) return "bed";
  return formHasLuggage(form) ? "luggage" : "standard";
}

function vehicleCapacityWithOptions(vehicle, form) {
  if (vehicleIsSprinter316(vehicle)) {
    const configuration = form.elements.seatConfiguration?.value || "m1";
    if (configuration === "luxury") return Math.max(1, Number(vehicle?.luxurySeatCapacity || 10));
    if (configuration === "m3") return Math.max(1, Number(vehicle?.m3SeatCapacity || 11));
    return Math.max(1, Number(vehicle?.m1SeatCapacity || 14));
  }
  const unitConfiguration = selectedVehicleConfiguration(vehicle, form);
  if (unitConfiguration) return unitConfiguration.capacity;
  const configuration = sprinter311ConfigurationValue(form);
  if (configuration === "bed") return Math.max(1, Number(vehicle?.capacityWithBed || 8));
  if (configuration === "luggage") {
    return Math.max(1, Number(vehicle?.capacityWithLuggage || 10));
  }
  return vehicleBaseCapacity(vehicle);
}

function luxuryVehicles() {
  return state.vehicles.filter((vehicle) => allowedVehicleModels.includes(vehicleModelName(vehicle)));
}

function quoteVehicleIds(quote = {}) {
  return Array.isArray(quote.vehicleIds) && quote.vehicleIds.length
    ? quote.vehicleIds
    : quote.vehicleId
      ? [quote.vehicleId]
      : [];
}

function selectedVehiclesFromForm(form) {
  const selected = $$('input[name="vehicleIds"]:checked', form)
    .map((input) => state.vehicles.find((vehicle) => vehicle.id === input.value))
    .filter(Boolean);
  if (selected.length) return selected;
  const fallback = state.vehicles.find((vehicle) => vehicle.id === form.elements.vehicleId?.value);
  return fallback ? [fallback] : [];
}

function formUsesFleetTelevision(form) {
  const manualVehicleName = String(form.elements.vehicleManualName?.value || "").trim();
  return !manualVehicleName && $$('input[name="vehicleIds"]:checked', form).length > 0;
}

function explicitVehicleCount(source = {}) {
  const vehicleIds = Array.isArray(source.vehicleIds)
    ? [...new Set(source.vehicleIds.filter(Boolean))]
    : [];
  if (vehicleIds.length) return vehicleIds.length;
  if (source.vehicleId || String(source.vehicleManualName || "").trim()) return 1;
  return Math.max(1, Number(source.vehicleCount || 1));
}

function quoteAmenityLabels(item = {}) {
  const seatLabel = item.seatConfiguration === "luxury" || item.hasSuperLuxurySeats
    ? "Butacas de lujo"
    : item.seatConfiguration === "m1"
      ? "Butacas M1"
      : item.seatConfiguration === "m3"
        ? "Sillones M3"
        : "";
  return [
    item.hasPlayStation5 ? "PlayStation 5" : "",
    item.hasTv ? "TV" : "",
    seatLabel,
    item.hasBed ? "Cama" : "",
  ].filter(Boolean);
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

function addDaysToDateValue(value, days = 1) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function newestQuotesFirst(quotes = []) {
  return [...quotes].sort((a, b) => {
    const createdOrder = String(b.createdAt || b.quoteDate || "").localeCompare(
      String(a.createdAt || a.quoteDate || ""),
    );
    if (createdOrder) return createdOrder;
    return Number(b.quoteSequence || 0) - Number(a.quoteSequence || 0);
  });
}

function time12Parts(value) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return { time: "", period: "AM" };
  const match = raw.match(/^(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return { time: raw, period: "AM" };
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (minute > 59 || hour > 23) return { time: raw, period: match[3] || "AM" };
  let period = match[3];
  if (period) {
    if (hour > 12 || hour < 1) return { time: raw, period };
  } else {
    period = hour >= 12 ? "PM" : "AM";
    hour %= 12;
    if (!hour) hour = 12;
  }
  return {
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    period,
  };
}

function time12To24(value, period) {
  const parts = time12Parts(`${String(value || "").trim()} ${period || ""}`);
  const match = parts.time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return String(value || "").trim();
  let hour = Number(match[1]) % 12;
  if (parts.period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function formatTime12(value) {
  if (!value) return "";
  const parts = time12Parts(value);
  return parts.time ? `${parts.time} ${parts.period}` : String(value);
}

function formatDate(value, options = {}) {
  if (!value) return "Por definir";
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(safeValue);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: options.short ? "medium" : "long",
    ...(options.time ? { timeStyle: "short" } : {}),
  }).format(date);
}

function statusBadge(status) {
  const value = status || "activo";
  const style = ["confirmada", "aceptada", "completada", "disponible", "activo"].includes(value)
    ? "success"
    : ["pendiente", "borrador", "mantenimiento"].includes(value)
      ? "warning"
      : ["cancelada", "inactivo"].includes(value)
        ? "danger"
        : "info";
  return `<span class="badge badge-${style}">${escapeHtml(value)}</span>`;
}

function isServiceQuote(quote) {
  return serviceStatuses.has(quote.status) && Boolean(quote.paymentProof);
}

function loadQuoteDraft() {
  try {
    const raw = localStorage.getItem(QUOTE_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveQuoteDraft(form) {
  try {
    localStorage.setItem(QUOTE_DRAFT_KEY, JSON.stringify(quoteFormData(form)));
  } catch {
    // If storage is unavailable, the form still works normally.
  }
}

function clearQuoteDraft() {
  try {
    localStorage.removeItem(QUOTE_DRAFT_KEY);
  } catch {
    // Ignore storage cleanup errors.
  }
}

async function api(path, options = {}) {
  const response = await fetch(appPath(path), {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/login") showLogin();
    throw new Error(payload.error || "No fue posible completar la solicitud.");
  }
  return payload;
}

function toast(message, type = "success") {
  const element = document.createElement("div");
  element.className = `toast ${type === "error" ? "error" : ""}`;
  element.textContent = message;
  $("#toast-root").append(element);
  setTimeout(() => element.remove(), 4200);
}

function showLogin() {
  state.user = null;
  $("#app-shell").hidden = true;
  $("#login-view").hidden = false;
  closeModal();
  showLuxuryLogin();
}

function showApp() {
  $("#login-view").hidden = true;
  $("#app-shell").hidden = false;
  $("#app-shell").classList.add("sidebar-collapsed");
  $("#sidebar-user-name").textContent = state.user.name;
  $("#sidebar-user-role").textContent = state.user.role;
  $("#sidebar-avatar").textContent = state.user.name.slice(0, 1).toUpperCase();
  renderNav();
  const requestedModule = new URLSearchParams(window.location.search).get("module");
  navigate(canOpenModule(requestedModule) ? requestedModule : defaultModuleId());
}

function showLuxuryLogin() {
  $(".login-brand").hidden = false;
  $(".login-panel").hidden = false;
  $("#login-form input[name='email']")?.focus();
}

function renderNav() {
  $("#main-nav").innerHTML = modules
    .filter((item) => state.permissions.includes(item.permission))
    .map(
      (item) => `
        <button class="nav-button ${state.module === item.id ? "active" : ""}" data-module="${item.id}">
          ${icons[item.icon]}
          <span>${item.label}</span>
        </button>
      `,
    )
    .join("");
}

function canOpenModule(moduleId) {
  return allModules.some(
    (item) =>
      accessibleModuleIds.has(item.id) &&
      item.id === moduleId &&
      state.permissions.includes(item.permission),
  );
}

function defaultModuleId() {
  if (canOpenModule("dashboard")) return "dashboard";
  return modules.find((item) => state.permissions.includes(item.permission))?.id || "";
}

async function loadData() {
  const payload = await api("/api/bootstrap");
  Object.assign(state, payload);
}

async function navigate(moduleId) {
  if (!moduleId) return;
  if (!canOpenModule(moduleId)) {
    moduleId = defaultModuleId();
    if (!moduleId) return;
  }
  state.module = moduleId;
  const [eyebrow, title] = pageInfo[moduleId];
  $("#page-eyebrow").textContent = eyebrow;
  $("#page-title").textContent = title;
  renderNav();
  closeSidebar();
  const content = $("#app-content");
  content.innerHTML = '<div class="empty-state"><span>Cargando información...</span></div>';

  try {
    await loadData();
    const renderers = {
      dashboard: renderDashboard,
      quotes: renderQuotes,
      clientItineraries: () => renderItineraries("cliente"),
      driverItineraries: () => renderItineraries("piloto"),
      clients: () => renderDirectory("clients"),
      vehicles: () => renderDirectory("vehicles"),
      drivers: () => renderDirectory("drivers"),
      rates: renderRates,
      history: renderHistory,
      settings: renderSettings,
    };
    renderers[moduleId]?.();
    content.focus({ preventScroll: true });
  } catch (error) {
    content.innerHTML = `<div class="empty-state"><div><strong>No fue posible cargar el módulo</strong><span>${escapeHtml(error.message)}</span></div></div>`;
  }
}

function renderDashboard() {
  const accepted = state.quotes.filter(isServiceQuote);
  const currentMonth = guatemalaMonthValue();
  const monthSales = accepted
    .filter((quote) => String(quote.acceptedAt || "").startsWith(currentMonth))
    .reduce((sum, quote) => sum + Number(quote.amountPaid || quote.totals?.total || 0), 0);
  const monthSalesQuotes = accepted
    .filter((quote) => String(quote.acceptedAt || "").startsWith(currentMonth))
    .sort((a, b) => String(b.acceptedAt).localeCompare(String(a.acceptedAt)));
  const upcoming = [...state.quotes]
    .filter((quote) => quote.serviceDate >= guatemalaDateValue() && isServiceQuote(quote))
    .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))
    .slice(0, 6);

  $("#app-content").innerHTML = `
    <div class="page-actions">
      <p>Una vista clara de la actividad comercial y los próximos servicios de Luxury Travel.</p>
      ${state.permissions.includes("quotes") ? `<button class="button button-primary" data-action="new-quote">${icons.plus} Nueva cotización</button>` : ""}
    </div>
    <section class="stats-grid">
      ${statCard("Cotizador", state.quotes.length, "file", "quotes")}
      ${statCard(
        "Clientes",
        state.clients.length,
        "users",
        state.permissions.includes("clients") ? "clients" : "",
      )}
      ${statCard("Próximos servicios", upcoming.length, "route")}
      ${statCard("Ventas del mes", money(monthSales), "tag", "quotes")}
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <div class="panel-header">
          <h2>Próximos servicios</h2>
          ${state.permissions.includes("quotes") ? '<button class="button button-secondary button-small" data-module-link="quotes">Ver todos</button>' : ""}
        </div>
        ${upcoming.length ? quoteTable(upcoming, { compact: true }) : emptyState("Sin servicios próximos", "Los servicios confirmados aparecerán aquí.")}
      </div>
      <div class="panel">
        <div class="panel-header"><h2>Acciones rápidas</h2></div>
        <div class="panel-body quick-actions">
          ${state.permissions.includes("quotes") ? quickAction("new-quote", "file", "Crear cotización", "Calcular ruta y precio") : ""}
        </div>
      </div>
    </section>
    <div class="panel">
      <div class="panel-header">
        <h2>Ventas del mes</h2>
        ${state.permissions.includes("quotes") ? '<button class="button button-secondary button-small" data-module-link="quotes">Ver cotizaciones</button>' : ""}
      </div>
      ${monthSalesQuotes.length ? salesTable(monthSalesQuotes) : emptyState("Sin ventas aceptadas este mes", "Al aceptar una cotización con comprobante aparecerá aquí con el monto pagado.")}
    </div>
  `;
  bindCommonActions();
}

function statCard(label, value, iconName, moduleId = "") {
  return `
    <button class="stat-card ${moduleId ? "stat-card-clickable" : ""}" ${moduleId ? `data-module-link="${moduleId}"` : ""}>
      <div class="stat-icon">${icons[iconName]}</div>
      <strong class="stat-value">${escapeHtml(value)}</strong>
      <span class="stat-label">${label}</span>
    </button>
  `;
}

function quickAction(action, iconName, title, description) {
  return `
    <button class="quick-action" data-action="${action}">
      <div class="stat-icon">${icons[iconName]}</div>
      <div><strong>${title}</strong><span>${description}</span></div>
    </button>
  `;
}

function renderQuotes() {
  const quotes = newestQuotesFirst(state.quotes);
  $("#app-content").innerHTML = `
    <div class="page-actions">
      <p>Cree propuestas con ruta, tarifa, recargos, IVA y una presentación lista para enviar.</p>
      <button class="button button-primary" data-action="new-quote">${icons.plus} Nueva cotización</button>
    </div>
    <div class="panel">
      <div class="panel-header">
        <h2>${quotes.length} cotizaciones</h2>
        <input class="search-input" type="search" placeholder="Buscar cliente o número" data-search-table />
      </div>
      ${quotes.length ? quoteTable(quotes) : emptyState("Aún no hay cotizaciones", "Cree la primera para iniciar el historial comercial.")}
    </div>
  `;
  bindCommonActions();
}

function quoteTable(quotes, options = {}) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cotización</th>
            <th>Cliente</th>
            <th>Servicio</th>
            <th>Ruta</th>
            <th>Total</th>
            <th>Estado</th>
            ${options.compact ? "" : '<th class="quote-actions-heading">Acciones</th>'}
          </tr>
        </thead>
        <tbody>
          ${quotes
            .map(
              (quote) => `
                <tr class="interactive-row" data-row-action="edit-quote" data-id="${quote.id}" data-search-row="${escapeHtml(`${quote.number} ${quote.clientName} ${quote.clientPhone} ${quote.origin} ${quote.destination}`.toLowerCase())}">
                  <td><span class="cell-primary">${escapeHtml(quote.number)}</span><span class="cell-secondary">${formatDate(quote.createdAt, { short: true })}</span></td>
                  <td><span class="cell-primary">${escapeHtml(quote.clientName)}</span><span class="cell-secondary">${escapeHtml([quote.clientNit ? `NIT ${quote.clientNit}` : "", quote.clientPhone].filter(Boolean).join(" · "))}</span></td>
                  <td><span class="cell-primary">${formatDate(quote.serviceDate, { short: true })}</span><span class="cell-secondary">${escapeHtml(quote.departureTime)} · ${escapeHtml(quote.serviceType)}</span></td>
                  <td><span class="cell-primary">${escapeHtml(quote.origin)}</span><span class="cell-secondary">a ${escapeHtml(quote.destination)} · ${quote.kilometers || 0} km</span></td>
                  <td><span class="cell-primary">${money(quote.amountPaid || quoteTaxBreakdown(quote).total)}</span><span class="cell-secondary">${quote.amountPaid ? "Monto pagado" : `IVA ${quoteTaxBreakdown(quote).taxPercent || 0}%`}</span></td>
                  <td>${statusBadge(quote.status)}</td>
                  ${
                    options.compact
                      ? ""
                      : `
                    <td class="quote-actions-cell">
                      <div class="table-actions">
                        ${
                          isServiceQuote(quote)
                            ? `<button class="icon-button" title="Ver comprobante" aria-label="Ver comprobante" data-action="view-payment-proof" data-id="${quote.id}">${icons.tag}</button>`
                            : `<button class="icon-button" title="Aceptar servicio y subir comprobante" aria-label="Aceptar servicio" data-action="accept-quote" data-id="${quote.id}">${icons.tag}</button>`
                        }
                        <button class="icon-button" title="Descargar cotización" aria-label="Descargar cotización" data-action="quote-pdf" data-id="${quote.id}">${icons.download}</button>
                        <button class="icon-button" title="Generar itinerarios" aria-label="Generar itinerarios" data-action="quote-itinerary" data-id="${quote.id}">${icons.itinerary}</button>
                        <button class="icon-button" title="Editar cotización" aria-label="Editar cotización" data-action="edit-quote" data-id="${quote.id}">${icons.edit}</button>
                        <button class="icon-button" title="Eliminar cotización" aria-label="Eliminar cotización" data-action="delete-record" data-collection="quotes" data-id="${quote.id}">${icons.trash}</button>
                      </div>
                    </td>`
                  }
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function salesTable(quotes) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Cotización</th><th>Cliente</th><th>Pago</th><th>Servicio</th><th>Comprobante</th></tr></thead>
        <tbody>
          ${quotes
            .map(
              (quote) => `
                <tr class="interactive-row" data-row-action="edit-quote" data-id="${quote.id}">
                  <td><span class="cell-primary">${escapeHtml(quote.number)}</span><span class="cell-secondary">${formatDate(quote.acceptedAt, { short: true, time: true })}</span></td>
                  <td><span class="cell-primary">${escapeHtml(quote.clientName)}</span><span class="cell-secondary">${escapeHtml(quote.clientPhone || "")}</span></td>
                  <td><span class="cell-primary">${money(quote.amountPaid || quote.totals?.total)}</span><span class="cell-secondary">${escapeHtml(quote.paymentReference || "Sin referencia")}</span></td>
                  <td><span class="cell-primary">${formatDate(quote.serviceDate, { short: true })}</span><span class="cell-secondary">${escapeHtml(quote.serviceType)}</span></td>
                  <td><button class="button button-secondary button-small" data-action="view-payment-proof" data-id="${quote.id}">Ver comprobante</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderDirectory(collection) {
  const config = directoryConfig(collection);
  const records =
    collection === "clients"
      ? [...state.clients].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      : state[collection];
  $("#app-content").innerHTML = `
    <div class="page-actions">
      <p>${config.description}</p>
      <button class="button button-primary" data-action="new-record" data-collection="${collection}">${icons.plus} ${config.button}</button>
    </div>
    <div class="panel">
      <div class="panel-header">
        <h2>${records.length} ${config.plural}</h2>
        <input class="search-input" type="search" placeholder="Buscar..." data-search-table />
      </div>
      ${records.length ? directoryTable(collection, records) : emptyState(config.emptyTitle, config.emptyText)}
    </div>
  `;
  bindCommonActions();
}

function directoryConfig(collection) {
  return {
    clients: {
      plural: "clientes",
      button: "Nuevo cliente",
      description: "Centralice datos de contacto, empresa y notas importantes de cada cliente.",
      emptyTitle: "Aún no hay clientes",
      emptyText: "Los clientes creados desde una cotización también aparecerán aquí.",
    },
    vehicles: {
      plural: "vehículos",
      button: "Nuevo vehículo",
      description: "Controle la capacidad y disponibilidad de la flota.",
      emptyTitle: "Aún no hay vehículos",
      emptyText: "Registre la flota disponible para asignarla a los servicios.",
    },
    drivers: {
      plural: "pilotos",
      button: "Nuevo piloto",
      description: "Administre información operativa, licencia y disponibilidad de pilotos.",
      emptyTitle: "Aún no hay pilotos",
      emptyText: "Registre pilotos para asignarlos a cotizaciones e itinerarios.",
    },
  }[collection];
}

function directoryTable(collection, records) {
  const header = {
    clients: ["Cliente", "NIT", "Contacto", "Creado", ""],
    vehicles: ["Vehículo", "Placa", "Capacidad", "Estado", ""],
    drivers: ["Piloto", "Contacto", "Licencia", "Estado", ""],
  }[collection];

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${header.map((label) => `<th>${label}</th>`).join("")}</tr></thead>
        <tbody>
          ${records
            .map((record) => {
              let cells;
              if (collection === "clients") {
                cells = [
                  `<span class="cell-primary">${escapeHtml(record.name)}</span><span class="cell-secondary">${escapeHtml(record.email)}</span>`,
                  escapeHtml(record.nit || "CF"),
                  `${escapeHtml(record.phone || "Sin teléfono")}`,
                  formatDate(record.createdAt, { short: true }),
                ];
              } else if (collection === "vehicles") {
                cells = [
                  `<span class="cell-primary">${escapeHtml(vehicleDisplayName(record))}</span><span class="cell-secondary">${escapeHtml(`${record.year} · ${record.color || "Sin color"}`)}</span>`,
                  escapeHtml(record.plate),
                  `${record.capacity} pasajeros · ${record.capacityWithBed || 8} con cama`,
                  statusBadge(record.status),
                ];
              } else {
                cells = [
                  `<span class="cell-primary">${escapeHtml(record.name)}</span><span class="cell-secondary">${escapeHtml(record.email || "")}</span>`,
                  escapeHtml(record.phone || "Sin teléfono"),
                  `<span class="cell-primary">${escapeHtml(record.license || "Sin registrar")}</span><span class="cell-secondary">${escapeHtml(record.licenseExpires || "")}</span>`,
                  statusBadge(record.status),
                ];
              }
              return `
                <tr class="interactive-row" data-row-action="edit-record" data-collection="${collection}" data-id="${record.id}" data-search-row="${escapeHtml(Object.values(record).join(" ").toLowerCase())}">
                  ${cells.map((cell) => `<td>${cell}</td>`).join("")}
                  <td>
                    <div class="table-actions">
                      <button class="icon-button" title="Editar" data-action="edit-record" data-collection="${collection}" data-id="${record.id}">${icons.edit}</button>
                      <button class="icon-button" title="Eliminar" data-action="delete-record" data-collection="${collection}" data-id="${record.id}">${icons.trash}</button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderItineraries(type) {
  const records = state.itineraries
    .filter((item) => item.type === type)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const title = type === "cliente" ? "itinerarios para cliente" : "itinerarios para piloto";
  $("#app-content").innerHTML = `
    <div class="page-actions">
      <p>${type === "cliente" ? "Documentos claros y elegantes para compartir la información esencial del viaje." : "Instrucciones operativas con horarios, contactos, vehículo y ruta asignada."}</p>
      ${state.permissions.includes("quotes") ? '<button class="button button-secondary" data-module-link="quotes">Crear desde cotización</button>' : ""}
    </div>
    ${
      records.length
        ? `<div class="itinerary-grid">${records.map(itineraryCard).join("")}</div>`
        : emptyState(`Aún no hay ${title}`, "Genérelos desde el menú de acciones de una cotización.")
    }
  `;
  bindCommonActions();
}

function itineraryCard(item) {
  return `
    <article class="itinerary-card">
      <div class="itinerary-card-header">
        <div>
          <span class="eyebrow">${escapeHtml(item.number)}</span>
          <h3>${escapeHtml(item.clientName)}</h3>
        </div>
        ${statusBadge(item.status)}
      </div>
      <div class="route-line">
        <div class="route-stop"><span>Salida · ${escapeHtml(item.departureTime)}</span><strong>${escapeHtml(item.origin)}</strong></div>
        <div class="route-stop"><span>Destino</span><strong>${escapeHtml(item.destination)}</strong></div>
      </div>
      <div class="itinerary-meta">
        <div class="meta-box"><span>Fecha</span><strong>${formatDate(item.serviceDate, { short: true })}</strong></div>
        <div class="meta-box"><span>Pasajeros</span><strong>${item.passengers || 0}</strong></div>
        <div class="meta-box"><span>Vehículo</span><strong>${escapeHtml(item.vehicleName || "Por asignar")}</strong></div>
        <div class="meta-box"><span>Piloto</span><strong>${escapeHtml(item.driverName || "Por asignar")}</strong></div>
        <div class="meta-box"><span>Servicio</span><strong>${escapeHtml(item.serviceType)}</strong></div>
        <div class="meta-box"><span>Comodidades</span><strong>${escapeHtml(quoteAmenityLabels(item).join(" · ") || "Estándar")}</strong></div>
        <div class="meta-box"><span>Creado</span><strong>${formatDate(item.createdAt, { short: true })}</strong></div>
      </div>
      <div class="form-footer">
        <button class="button button-secondary button-small" data-action="print-itinerary" data-id="${item.id}">${icons.print} Imprimir / PDF</button>
        ${state.user.role === "administrador" ? `<button class="button button-danger button-small" data-action="delete-record" data-collection="itineraries" data-id="${item.id}">Eliminar</button>` : ""}
      </div>
    </article>
  `;
}

function renderRates() {
  const rates = state.rates;
  $("#app-content").innerHTML = `
    <div class="page-actions">
      <p>Las cotizaciones nuevas utilizan estos valores. Los documentos existentes conservan su cálculo histórico.</p>
    </div>
    <form id="rates-form" class="panel">
      <div class="panel-header"><h2>Configuración de tarifas</h2></div>
      <div class="panel-body">
        <div class="form-grid">
          ${numberField("pricePerKm", "Precio por kilómetro", rates.pricePerKm, "Q", "Fórmula base: kilómetros × precio por km.")}
          ${numberField("pricePerMinute", "Precio por minuto", rates.pricePerMinute, "Q", "Fórmula base: minutos × precio por minuto.")}
          ${numberField("minimumFare", "Tarifa mínima", rates.minimumFare, "Q")}
          ${numberField("waitingPerHour", "Recargo por espera / hora", rates.waitingPerHour, "Q")}
          ${numberField("nightSurcharge", "Recargo nocturno", rates.nightSurcharge, "Q")}
          ${numberField("airportSurcharge", "Recargo por aeropuerto", rates.airportSurcharge, "Q")}
          ${numberField("discountPercent", "Descuento predeterminado", rates.discountPercent, "%")}
          ${numberField("taxPercent", "IVA", rates.taxPercent, "%")}
          <label>Inicio de horario nocturno<input type="time" name="nightStart" value="${escapeHtml(rates.nightStart)}" /></label>
          <label>Fin de horario nocturno<input type="time" name="nightEnd" value="${escapeHtml(rates.nightEnd)}" /></label>
        </div>
        <div class="form-footer"><button class="button button-primary" type="submit">Guardar tarifas</button></div>
      </div>
    </form>
  `;
  $("#rates-form").addEventListener("submit", saveRates);
}

function numberField(name, label, value, suffix, note = "") {
  return `
    <label>${label}
      <input type="number" name="${name}" value="${value}" min="0" step="0.01" required />
      <span class="form-note">${suffix}${note ? ` · ${note}` : ""}</span>
    </label>
  `;
}

function renderHistory() {
  const today = guatemalaDateValue();
  const services = state.permissions.includes("quotes")
    ? [...state.quotes]
        .filter(
          (quote) =>
            quote.serviceDate <= today ||
            ["confirmada", "completada", "cancelada"].includes(quote.status),
        )
        .sort((a, b) => String(b.serviceDate).localeCompare(String(a.serviceDate)))
    : [...state.itineraries]
        .filter((item) => item.type === "piloto" && item.serviceDate <= today)
        .sort((a, b) => String(b.serviceDate).localeCompare(String(a.serviceDate)));
  $("#app-content").innerHTML = `
    <div class="page-actions"><p>Consulte servicios realizados o confirmados y, debajo, la trazabilidad de cambios del sistema.</p></div>
    <div class="panel">
      <div class="panel-header"><h2>Historial de servicios</h2></div>
      ${
        services.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>Servicio</th><th>Fecha</th><th>Cliente</th><th>Ruta</th><th>Asignación</th><th>Estado</th></tr></thead>
              <tbody>${services
                .map(
                  (item) => `<tr>
                    <td><span class="cell-primary">${escapeHtml(item.number || item.quoteNumber)}</span><span class="cell-secondary">${escapeHtml(item.serviceType)}</span></td>
                    <td>${formatDate(item.serviceDate, { short: true })}</td>
                    <td>${escapeHtml(item.clientName)}</td>
                    <td><span class="cell-primary">${escapeHtml(item.origin)}</span><span class="cell-secondary">a ${escapeHtml(item.destination)}</span></td>
                    <td><span class="cell-primary">${escapeHtml(item.driverName || "Por asignar")}</span><span class="cell-secondary">${escapeHtml(item.vehicleName || "")}</span></td>
                    <td>${statusBadge(item.status)}</td>
                  </tr>`,
                )
                .join("")}</tbody>
            </table></div>`
          : emptyState("Aún no hay servicios en el historial", "Los servicios confirmados, completados o con fecha pasada aparecerán aquí.")
      }
    </div>
    <div class="panel">
      <div class="panel-header"><h2>Registro de actividad</h2><input class="search-input" type="search" placeholder="Buscar actividad" data-search-table /></div>
      ${
        state.history.length
          ? `<div class="table-wrap"><table>
              <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
              <tbody>${state.history
                .map(
                  (item) => `<tr data-search-row="${escapeHtml(Object.values(item).join(" ").toLowerCase())}">
                    <td>${formatDate(item.createdAt, { short: true, time: true })}</td>
                    <td>${escapeHtml(item.userName)}</td>
                    <td>${statusBadge(item.action)}</td>
                    <td>${escapeHtml(item.entityType)}</td>
                    <td>${escapeHtml(item.detail)}</td>
                  </tr>`,
                )
                .join("")}</tbody>
            </table></div>`
          : emptyState("Sin actividad registrada", "Las acciones del sistema aparecerán aquí.")
      }
    </div>
  `;
  bindSearch();
}

function renderSettings() {
  const settings = state.settings;
  $("#app-content").innerHTML = `
    <div class="page-actions"><p>Información corporativa, numeración de documentos, plantillas y acceso de usuarios.</p></div>
    <div class="settings-grid">
      <form id="settings-form" class="panel">
        <div class="panel-header"><h2>Empresa y documentos</h2></div>
        <div class="panel-body">
          <div class="form-grid">
            <label>Nombre comercial<input name="companyName" value="${escapeHtml(settings.companyName)}" required /></label>
            <label>Razón social<input name="legalName" value="${escapeHtml(settings.legalName)}" /></label>
            <label>Teléfono<input name="phone" value="${escapeHtml(settings.phone)}" /></label>
            <label>Correo<input type="email" name="email" value="${escapeHtml(settings.email)}" /></label>
            <label class="full">Dirección<input name="address" value="${escapeHtml(settings.address)}" /></label>
            <label>Prefijo de cotización<input name="quotePrefix" value="Coti-Luxury" readonly required /><span class="form-note">Fijo para guardar cotizaciones como Coti-Luxury-0001-cliente-teléfono.</span></label>
            <label>Prefijo itinerario cliente<input name="clientItineraryPrefix" value="${escapeHtml(settings.clientItineraryPrefix)}" required /></label>
            <label>Prefijo itinerario piloto<input name="driverItineraryPrefix" value="${escapeHtml(settings.driverItineraryPrefix)}" required /></label>
            <label>Plantilla PDF predeterminada
              <select name="defaultPdfTemplate">
                ${templateOptions(settings.defaultPdfTemplate)}
              </select>
            </label>
          </div>
          <div class="form-footer"><button class="button button-primary" type="submit">Guardar configuración</button></div>
        </div>
      </form>
      <div class="panel">
        <div class="panel-header"><h2>Usuarios y roles</h2><button class="button button-secondary button-small" data-action="new-user">${icons.plus} Nuevo</button></div>
        ${
          state.users.length
            ? `<div class="table-wrap"><table>
                <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
                <tbody>${state.users
                  .map(
                    (user) => `<tr>
                      <td><span class="cell-primary">${escapeHtml(user.name)}</span><span class="cell-secondary">${escapeHtml(user.email)}</span></td>
                      <td>${escapeHtml(user.role)}</td>
                      <td>${statusBadge(user.active ? "activo" : "inactivo")}</td>
                      <td><div class="table-actions"><button class="icon-button" data-action="edit-user" data-id="${user.id}">${icons.edit}</button></div></td>
                    </tr>`,
                  )
                  .join("")}</tbody>
              </table></div>`
            : emptyState("Sin usuarios", "Cree cuentas para vendedores y pilotos.")
        }
      </div>
    </div>
  `;
  $("#settings-form").addEventListener("submit", saveSettings);
  bindCommonActions();
}

function templateOptions(selected) {
  return [
    ["noir", "Luxury Premium · negro, marfil y dorado"],
    ["ivory", "Luxury Marfil · presentación clásica"],
    ["executive", "Luxury Ejecutiva · presentación corporativa"],
  ]
    .map(([value, label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`)
    .join("");
}

function emptyState(title, text) {
  return `<div class="empty-state"><div><strong>${title}</strong><span>${text}</span></div></div>`;
}

function bindCommonActions() {
  $$("[data-action]").forEach((button) => {
    button.addEventListener("click", handleAction);
  });
  $$("[data-row-action]").forEach((row) => {
    row.addEventListener("click", handleRowAction);
  });
  $$("[data-module-link]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.moduleLink));
  });
  bindSearch();
}

function handleRowAction(event) {
  if (event.target.closest("button, a, input, select, textarea, [data-action]")) return;
  const row = event.currentTarget;
  const { rowAction, id, collection } = row.dataset;
  if (rowAction === "edit-quote") openQuoteModal(state.quotes.find((item) => item.id === id));
  if (rowAction === "edit-record") openRecordModal(collection, state[collection].find((item) => item.id === id));
}

function bindSearch() {
  const input = $("[data-search-table]");
  if (!input) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    $$("[data-search-row]").forEach((row) => {
      row.hidden = query && !row.dataset.searchRow.includes(query);
    });
  });
}

async function handleAction(event) {
  const button = event.currentTarget;
  const { action, id, collection } = button.dataset;
  if (action === "new-quote") openQuoteModal();
  if (action === "edit-quote") openQuoteModal(state.quotes.find((item) => item.id === id));
  if (action === "quote-pdf") downloadQuotePdf(id);
  if (action === "quote-itinerary") openItineraryModal(id);
  if (action === "accept-quote") openAcceptQuoteModal(id);
  if (action === "view-payment-proof") openPaymentProofModal(id);
  if (action === "print-itinerary") printItinerary(id);
  if (action === "new-record") openRecordModal(collection);
  if (action === "edit-record") openRecordModal(collection, state[collection].find((item) => item.id === id));
  if (action === "new-client") openRecordModal("clients");
  if (action === "new-vehicle") openRecordModal("vehicles");
  if (action === "new-user") openUserModal();
  if (action === "edit-user") openUserModal(state.users.find((item) => item.id === id));
  if (action === "delete-record") await deleteRecord(collection, id);
}

function openModal(title, body, options = {}) {
  $("#modal-root").innerHTML = `
    <div class="modal-overlay" data-modal-overlay>
      <section class="modal ${options.wide ? "modal-wide" : ""}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header class="modal-header">
          <div><p class="eyebrow">${options.eyebrow || "Luxury Travel"}</p><h2>${escapeHtml(title)}</h2></div>
          <button class="icon-button" data-close-modal aria-label="Cerrar"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </header>
        <div class="modal-body">${body}</div>
      </section>
    </div>
  `;
  $("[data-close-modal]").addEventListener("click", closeModal);
  $("[data-modal-overlay]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
}

function closeModal() {
  $("#modal-root").innerHTML = "";
}

function openRecordModal(collection, record = {}) {
  const isEdit = Boolean(record.id);
  const fields = {
    clients: `
      <div class="form-grid">
        <label>Nombre completo<input name="name" value="${escapeHtml(record.name)}" required /></label>
        <label>NIT<input name="nit" value="${escapeHtml(record.nit)}" placeholder="CF o número de NIT" /></label>
        <label>Teléfono<input name="phone" value="${escapeHtml(record.phone)}" /></label>
        <label>Correo electrónico<input type="email" name="email" value="${escapeHtml(record.email)}" /></label>
        <label>Empresa<input name="company" value="${escapeHtml(record.company)}" /></label>
        <label class="full">Notas<textarea name="notes">${escapeHtml(record.notes)}</textarea></label>
      </div>`,
    vehicles: `
      <div class="form-grid">
        <label>Marca<input name="brand" value="${escapeHtml(record.brand)}" required /></label>
        <label>Modelo<input name="model" value="${escapeHtml(record.model)}" required /></label>
        <label>Número de unidad<input type="number" name="unitNumber" value="${record.unitNumber || ""}" min="1" /></label>
        <label>Nombre en flota<input name="fleetName" value="${escapeHtml(record.fleetName)}" placeholder="Mercedes Benz Sprinter 311, 1" /></label>
        <label>Año<input type="number" name="year" value="${record.year || new Date().getFullYear()}" min="1990" max="2100" /></label>
        <label>Placa<input name="plate" value="${escapeHtml(record.plate)}" required /></label>
        <label>Capacidad de pasajeros<input type="number" name="capacity" value="${record.capacity || 15}" min="1" max="15" /></label>
        <label>Capacidad con cama<input type="number" name="capacityWithBed" value="${record.capacityWithBed || 8}" min="1" max="8" /></label>
        <label>Capacidad con equipaje<input type="number" name="capacityWithLuggage" value="${record.capacityWithLuggage || 10}" min="1" max="15" /></label>
        <label>Capacidad Butacas de lujo<input type="number" name="luxurySeatCapacity" value="${record.luxurySeatCapacity ?? record.superLuxuryCapacity ?? (vehicleIsSprinter316(record) ? 10 : 0)}" min="0" max="14" /></label>
        <label>Capacidad Butacas M1<input type="number" name="m1SeatCapacity" value="${record.m1SeatCapacity ?? (vehicleIsSprinter316(record) ? 14 : 0)}" min="0" max="14" /></label>
        <label>Capacidad Sillones M3<input type="number" name="m3SeatCapacity" value="${record.m3SeatCapacity ?? (vehicleIsSprinter316(record) ? 11 : 0)}" min="0" max="14" /></label>
        <input type="hidden" name="superLuxuryCapacity" value="${record.luxurySeatCapacity ?? record.superLuxuryCapacity ?? (vehicleIsSprinter316(record) ? 10 : 0)}" />
        <label>Capacidad de maletas<input type="number" name="luggageCapacity" value="${record.luggageCapacity || 4}" min="0" /></label>
        <label>Color<input name="color" value="${escapeHtml(record.color)}" /></label>
        <label>Estado<select name="status">${statusOptions(record.status)}</select></label>
        <label><span><input type="checkbox" name="supportsBed" ${record.supportsBed !== false ? "checked" : ""} /> Permite cama</span></label>
        <label><span><input type="checkbox" name="supportsPlayStation5" ${record.supportsPlayStation5 !== false ? "checked" : ""} /> Incluye PlayStation 5</span></label>
        <label><span><input type="checkbox" name="supportsSuperLuxurySeats" ${record.supportsSuperLuxurySeats ? "checked" : ""} /> Permite configuraciones especiales</span></label>
        <label class="full">Notas<textarea name="notes">${escapeHtml(record.notes)}</textarea></label>
      </div>`,
    drivers: `
      <div class="form-grid">
        <label>Nombre completo<input name="name" value="${escapeHtml(record.name)}" required /></label>
        <label>Teléfono<input name="phone" value="${escapeHtml(record.phone)}" /></label>
        <label>Correo electrónico<input type="email" name="email" value="${escapeHtml(record.email)}" /></label>
        <label>Número de licencia<input name="license" value="${escapeHtml(record.license)}" /></label>
        <label>Vencimiento de licencia<input type="date" name="licenseExpires" value="${escapeHtml(record.licenseExpires)}" /></label>
        <label>Estado<select name="status">${statusOptions(record.status)}</select></label>
        <label>Usuario piloto vinculado<select name="userId"><option value="">Sin vincular</option>${state.users
          .filter((user) => user.role === "piloto")
          .map((user) => `<option value="${user.id}" ${record.userId === user.id ? "selected" : ""}>${escapeHtml(user.name)}</option>`)
          .join("")}</select></label>
        <label class="full">Notas<textarea name="notes">${escapeHtml(record.notes)}</textarea></label>
      </div>`,
  }[collection];
  const labels = { clients: "cliente", vehicles: "vehículo", drivers: "piloto" };
  openModal(`${isEdit ? "Editar" : "Nuevo"} ${labels[collection]}`, `
    <form id="record-form" class="modal-form">
      ${fields}
      <p class="form-error" data-form-error></p>
      <div class="form-footer">
        <button type="button" class="button button-secondary" data-close-form>Cancelar</button>
        <button type="submit" class="button button-primary">${isEdit ? "Guardar cambios" : "Crear registro"}</button>
      </div>
    </form>
  `);
  $("[data-close-form]").addEventListener("click", closeModal);
  $("#record-form").addEventListener("submit", (event) => saveRecord(event, collection, record.id));
}

function statusOptions(selected = "disponible") {
  return ["disponible", "asignado", "mantenimiento", "inactivo"]
    .map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`)
    .join("");
}

function serviceTypeOptions(selected = "") {
  const values = [
    ...Object.values(serviceRateTypes).map((item) => item.label),
    "Traslado privado",
    "Aeropuerto",
    "Tour",
    "Disposición por horas",
    "Viaje corporativo",
    "Otro",
  ];
  return values
    .map((value) => `<option value="${value}" ${selected === value ? "selected" : ""}>${value}</option>`)
    .join("");
}

function serviceSelectionKey(selection) {
  return `${selection.destinationId}|${selection.type}`;
}

function serviceInstanceId(prefix = "svc") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serviceDetailInputName(selection, field) {
  return `serviceDetail_${selection.instanceId}_${field}`;
}

function serviceDetailValue(selection, field, fallback = "") {
  const value = selection?.[field];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function serviceSelectionFromRate(destinationId, type) {
  const rate = destinationRates.find((item) => item.id === destinationId);
  const rateType = serviceRateTypes[type];
  if (!rate || !rateType) return null;
  return {
    destinationId: rate.id,
    destination: rate.destination,
    type,
    label: rateType.label,
    amount: Number(rate[rateType.field] || 0),
  };
}

function normalizeServiceSelection(selection = {}) {
  const type = String(selection.type || selection.serviceRateType || "").trim();
  const rateType = serviceRateTypes[type];
  const destinationId = String(selection.destinationId || selection.destinationRateId || "").trim();
  const rate = destinationRates.find((item) => item.id === destinationId);
  const destination = String(selection.destination || selection.destinationRateName || rate?.destination || "").trim();
  const label = String(selection.label || rateType?.label || selection.serviceType || "Servicio seleccionado").trim();
  const amount = Number(selection.amount ?? (rate && rateType ? rate[rateType.field] : selection.fixedFare || 0));
  const passengers = Number(selection.passengers);
  if (!destination || !type || !Number.isFinite(amount) || amount < 0) return null;
  return {
    instanceId: String(selection.instanceId || "").trim() || serviceInstanceId(String(destinationId).startsWith("manual-") ? "manual" : "svc"),
    destinationId: destinationId || destination.toLowerCase().replace(/\s+/g, "-"),
    destination,
    type,
    label,
    amount,
    serviceDate: String(selection.serviceDate || "").trim(),
    returnDate: String(selection.returnDate || selection.serviceEndDate || "").trim(),
    origin: String(selection.origin || "").trim(),
    destinationAddress: String(selection.destinationAddress || "").trim(),
    departureTime: String(selection.departureTime || "").trim(),
    returnTime: String(selection.returnTime || "").trim(),
    passengers: Number.isFinite(passengers) && passengers > 0 ? Math.round(passengers) : "",
    hasLuggage:
      selection.hasLuggage === undefined || selection.hasLuggage === ""
        ? ""
        : selection.hasLuggage === true || selection.hasLuggage === "true",
    luggageDescription: String(selection.luggageDescription || "").trim(),
    notes: String(selection.notes || "").trim(),
    legNumber: Math.max(0, Math.round(Number(selection.legNumber || 0))),
  };
}

function parseServiceSelections(value) {
  let list = Array.isArray(value) ? value : [];
  if (!list.length && typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  return list.map(normalizeServiceSelection).filter(Boolean);
}

function quoteServiceSelections(quote = {}) {
  const selections = parseServiceSelections(quote.serviceSelections || quote.serviceSelectionsJson);
  if (selections.length) return selections;
  const fallback = serviceSelectionFromRate(quote.destinationRateId, quote.serviceRateType || "oneWay");
  if (fallback) return [fallback];
  const manual = normalizeServiceSelection({
    destinationId: quote.destinationRateId,
    destination: quote.destinationRateName,
    type: quote.serviceRateType,
    label: quote.serviceType,
    amount: quote.fixedFare,
  });
  return manual ? [manual] : [];
}

function selectedServiceEntriesFromForm(form) {
  const storedRaw = form.elements.serviceSelectionsJson?.value;
  const storedSelections = parseServiceSelections(storedRaw);
  const checkboxes = $$('input[name="serviceSelectionKeys"]', form);
  if (checkboxes.length) {
    const manualSelections = storedSelections
      .filter((selection) => String(selection.destinationId || "").startsWith("manual-"));
    const tableSelections = checkboxes
      .filter((input) => input.checked)
      .map((input) => {
        const [destinationId, type] = input.value.split("|");
        return serviceSelectionFromRate(destinationId, type);
      })
      .filter(Boolean);
    return [...tableSelections, ...manualSelections];
  }
  if (String(storedRaw || "").trim()) return storedSelections;
  const selections = quoteServiceSelections({
    serviceSelections: form.elements.serviceSelectionsJson?.value,
    destinationRateId: form.elements.destinationRateId?.value,
    destinationRateName: form.elements.destinationRateName?.value,
    serviceRateType: form.elements.serviceRateType?.value,
    serviceType: form.elements.serviceType?.value,
    fixedFare: form.elements.fixedFare?.value,
  });
  return selections;
}

function serviceSelectionsTotal(selections) {
  return selections.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function serviceSelectionsDestinationLabel(selections) {
  return [...new Set(selections.map((item) => item.destination).filter(Boolean))].join(" + ");
}

function serviceSelectionsServiceLabel(selections) {
  if (!selections.length) return "Servicio personalizado";
  if (selections.length === 1) return selections[0].label;
  return `${selections.length} traslados seleccionados`;
}

function serviceSelectionToggleText(selections) {
  return selections.length
    ? `${selections.length} traslado${selections.length === 1 ? "" : "s"} elegido${selections.length === 1 ? "" : "s"}`
    : "Click para agregar traslados";
}

function serviceSelectionSummaryHtml(selections) {
  if (!selections.length) {
    return `<p class="service-selection-empty">Sin traslados seleccionados. Abra el menú y haga clic en un precio para agregarlo.</p>`;
  }
  return `
    <div class="selected-services-total">
      <span>${selections.length} traslado${selections.length === 1 ? "" : "s"} seleccionado${selections.length === 1 ? "" : "s"}</span>
      <strong>${money(serviceSelectionsTotal(selections))}</strong>
    </div>
    <ul>
      ${selections
        .map(
          (item, index) => `
            <li>
              <span>${escapeHtml(item.label)} · ${escapeHtml(item.destination)}</span>
              <strong>${money(item.amount)}</strong>
              <button type="button" class="text-inline-button" data-remove-service-selection="${escapeHtml(item.instanceId)}" data-remove-service-index="${index}">Quitar</button>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function setServiceSelections(form, selections, options = {}) {
  form.elements.serviceSelectionsJson.value = JSON.stringify(selections);
  renderDestinationRatePreview(form);
  syncServiceSelections(form);
  if (options.keepMenuOpen) {
    const panel = $("[data-service-menu-panel]", form);
    const toggle = $("[data-service-menu-toggle]", form);
    if (panel && toggle) {
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
    }
  }
}

function addRateServiceSelection(form, key) {
  const [destinationId, type] = String(key || "").split("|");
  const selection = serviceSelectionFromRate(destinationId, type);
  if (!selection) return;
  const currentSelections = serviceSelectionsWithDetailsFromForm(form);
  const first = currentSelections[0];
  const canReplaceBlank = currentSelections.length === 1
    && /^(?:Destino|Traslado) 1$/i.test(String(first?.destination || "").trim())
    && Number(first?.amount || 0) === 0
    && !first?.departureTime
    && !first?.notes;
  const nextSelections = canReplaceBlank
    ? [{ ...first, ...selection, instanceId: first.instanceId }]
    : [...currentSelections, { ...selection, instanceId: serviceInstanceId("svc") }];
  if (nextSelections.length > 1) {
    form.elements.destinationMode.value = "multiple";
    form.elements.destinationCount.value = String(nextSelections.length);
    syncDestinationMode(form);
  }
  setServiceSelections(form, nextSelections, { keepMenuOpen: true });
  toast(`${selection.label} · ${selection.destination} agregado.`);
}

function removeServiceSelection(form, instanceId, indexValue) {
  const selections = serviceSelectionsWithDetailsFromForm(form);
  const index = Number(indexValue);
  const nextSelections = instanceId
    ? selections.filter((selection) => selection.instanceId !== instanceId)
    : selections.filter((_, itemIndex) => itemIndex !== index);
  setServiceSelections(form, nextSelections);
}

function addManualServiceSelection(form) {
  const selections = serviceSelectionsWithDetailsFromForm(form);
  const nextSelections = [
    ...selections,
    createRouteSelection(selections.length, form, selections.at(-1) || {}),
  ];
  if (nextSelections.length > 1) {
    form.elements.destinationMode.value = "multiple";
    form.elements.destinationCount.value = String(nextSelections.length);
    syncDestinationMode(form);
  }
  setServiceSelections(form, nextSelections);
  toast(`Traslado ${nextSelections.length} agregado.`);
}

function renderDestinationRatePreview(form) {
  const selections = selectedServiceEntriesFromForm(form);
  const selectedCounts = selections.reduce((counts, selection) => {
    const key = serviceSelectionKey(selection);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const target = $("[data-destination-rate-preview]", form);
  target.innerHTML = `
    <button type="button" class="service-dropdown-toggle" data-service-menu-toggle aria-expanded="false">
      <span>Tipo de Servicio</span>
      <strong>${serviceSelectionToggleText(selections)}</strong>
    </button>
    <div class="service-dropdown-panel" data-service-menu-panel hidden>
      <div class="service-price-table" role="table" aria-label="Precios por destino y tipo de servicio">
        <div class="service-price-title">Precios</div>
        <div class="service-price-head">Destino</div>
        <div class="service-price-head">Precio ida</div>
        <div class="service-price-head">Precio por ida<br>y vuelta</div>
        <div class="service-price-head">Traslados precio<br>por día completo</div>
        ${destinationRates
          .map(
            (rate) => `
              <div class="service-price-destination">${escapeHtml(rate.destination)}</div>
              ${serviceRateColumns
                .map(([type]) => {
                  const selection = serviceSelectionFromRate(rate.id, type);
                  const key = serviceSelectionKey(selection);
                  const count = selectedCounts.get(key) || 0;
                  return `
                    <button type="button" class="service-price-option ${count ? "active" : ""}" data-add-service-selection="${escapeHtml(key)}">
                      <span>${money(selection.amount)}</span>
                      <small>${count ? `${count} agregado${count === 1 ? "" : "s"}` : "Agregar"}</small>
                    </button>
                  `;
                })
                .join("")}
            `,
          )
          .join("")}
      </div>
    </div>
    <div class="selected-services-summary" data-selected-services-summary>
      ${serviceSelectionSummaryHtml(selections)}
    </div>
  `;
}

function routePointLabel(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return index < alphabet.length ? `Punto ${alphabet[index]}` : `Punto ${index + 1}`;
}

function destinationModeValue(form) {
  return form.elements.destinationMode?.value === "multiple" ? "multiple" : "single";
}

function createRouteSelection(index, form, previous = {}) {
  const type = "oneWay";
  const previousDate = previous.serviceDate || form.elements.serviceDate?.value || guatemalaDateValue();
  const serviceDate = index > 0 ? addDaysToDateValue(previousDate, 1) : previousDate;
  return {
    instanceId: serviceInstanceId("route"),
    destinationId: `manual-route-${index + 1}-${Date.now()}`,
    destination: `Traslado ${index + 1}`,
    type,
    label: serviceRateTypes[type].label,
    amount: 0,
    serviceDate,
    returnDate: serviceDate,
    origin: previous.destinationAddress || "",
    destinationAddress: "",
    departureTime: "",
    returnTime: "",
    passengers: Number(form.elements.passengers?.value || 1),
    hasLuggage: Number(form.elements.luggage?.value || 0) > 0,
    luggageDescription: form.elements.luggageDescription?.value || "",
    notes: "",
    legNumber: index + 1,
  };
}

function applySequentialTransferDates(form) {
  const selections = selectedServiceEntriesFromForm(form);
  if (selections.length < 2) return;
  const firstDateInput = form.elements[serviceDetailInputName(selections[0], "serviceDate")];
  const firstDate = firstDateInput?.value || selections[0].serviceDate;
  if (!firstDate) return;
  selections.slice(1).forEach((selection, index) => {
    const input = form.elements[serviceDetailInputName(selection, "serviceDate")];
    if (input) input.value = addDaysToDateValue(firstDate, index + 1);
  });
}

function syncDestinationMode(form, { ensureCount = false } = {}) {
  const mode = destinationModeValue(form);
  const countField = $(`[data-destination-count-wrap]`, form);
  const singleBuilder = $(`[data-single-destination-builder]`, form);
  if (countField) countField.hidden = mode !== "multiple";
  if (singleBuilder) singleBuilder.hidden = mode === "multiple";
  $$(`[data-destination-mode-option]`, form).forEach((option) => {
    const input = $("input", option);
    option.classList.toggle("active", Boolean(input?.checked));
  });

  if (!ensureCount) return;
  const requested = mode === "multiple"
    ? Math.max(2, Math.min(20, Math.round(Number(form.elements.destinationCount?.value || 2))))
    : 1;
  const current = serviceSelectionsWithDetailsFromForm(form);
  const next = current.slice(0, requested);
  while (next.length < requested) {
    next.push(createRouteSelection(next.length, form, next[next.length - 1]));
  }
  next.forEach((selection, index) => {
    selection.legNumber = index + 1;
    if (!selection.destination || /^(?:Destino|Traslado) \d+$/.test(selection.destination)) {
      selection.destination = `Traslado ${index + 1}`;
    }
  });
  form.elements.serviceSelectionsJson.value = JSON.stringify(next);
  renderDestinationRatePreview(form);
  syncServiceSelections(form);
}

function syncPriceDisplayMode(form) {
  const mode = form.elements.priceDisplayMode?.value === "final" ? "final" : "detailed";
  const finalPrice = $("[data-final-price-wrap]", form);
  if (finalPrice) finalPrice.hidden = mode !== "final";
  $$(`[data-price-mode-option]`, form).forEach((option) => {
    const input = $("input", option);
    option.classList.toggle("active", Boolean(input?.checked));
  });
}

function renderServiceDetailBlocks(form) {
  const target = $("[data-service-detail-list]", form);
  if (!target) return;
  const selections = selectedServiceEntriesFromForm(form);
  if (!selections.length) {
    target.innerHTML = `
      <div class="service-detail-empty">
        <strong>Aún no hay traslados</strong>
        <span>Agregue un traslado manual o elija una tarifa para crear su ficha.</span>
      </div>
    `;
    return;
  }
  target.innerHTML = `
    <div class="service-detail-intro">
      <strong>Datos de cada traslado</strong>
      <span>Complete fecha, descripción, hora de salida opcional y precio. Puede agregar todos los traslados que necesite.</span>
    </div>
    ${selections
      .map((selection, index) => {
        const serviceNumber = index + 1;
        const departure = time12Parts(serviceDetailValue(selection, "departureTime"));
        return `
          <article class="service-detail-card" data-service-detail-card data-service-instance-id="${escapeHtml(selection.instanceId)}">
            <div class="service-detail-card-head">
              <span>Traslado ${serviceNumber}</span>
              <em>${Number(selection.amount || 0) > 0 ? money(selection.amount) : "Precio pendiente"}</em>
              ${selections.length > 1 ? `<button type="button" class="service-card-remove" data-remove-service-card="${escapeHtml(selection.instanceId)}" aria-label="Quitar traslado ${serviceNumber}">Quitar</button>` : ""}
            </div>
            <div class="form-grid transfer-detail-grid">
              <label>Fecha
                <input type="date" name="${serviceDetailInputName(selection, "serviceDate")}" value="${escapeHtml(serviceDetailValue(selection, "serviceDate", form.elements.serviceDate.value))}" />
              </label>
              <label>Descripción
                <input name="${serviceDetailInputName(selection, "destination")}" value="${escapeHtml(selection.destination)}" placeholder="Ej. Hotel Camino Real → Aeropuerto La Aurora" />
              </label>
              <label>Hora de salida <small class="field-hint">Opcional; si queda vacía no aparecerá en la cotización.</small>
                <span class="time-12-editor">
                  <input name="${serviceDetailInputName(selection, "departureTime12")}" value="${escapeHtml(departure.time)}" inputmode="numeric" placeholder="Ej. 08:30" aria-label="Hora de salida en formato de 12 horas" />
                  <select name="${serviceDetailInputName(selection, "departurePeriod")}" aria-label="AM o PM">
                    <option value="AM" ${departure.period === "AM" ? "selected" : ""}>AM</option>
                    <option value="PM" ${departure.period === "PM" ? "selected" : ""}>PM</option>
                  </select>
                </span>
              </label>
              <label>Precio
                <input type="number" name="${serviceDetailInputName(selection, "amount")}" value="${Number(selection.amount || 0) || ""}" min="0" step="0.01" placeholder="0.00" />
              </label>
              <label class="full">Notas opcionales
                <textarea name="${serviceDetailInputName(selection, "notes")}" placeholder="Indicaciones, disponibilidad, cortesías o información especial">${escapeHtml(serviceDetailValue(selection, "notes"))}</textarea>
              </label>
            </div>
          </article>
        `;
      })
      .join("")}
  `;
}

function serviceSelectionsWithDetailsFromForm(form) {
  return selectedServiceEntriesFromForm(form).map((selection, index) => {
    const get = (field) => form.elements[serviceDetailInputName(selection, field)];
    const description = get("destination")?.value?.trim() || selection.destination || `Traslado ${index + 1}`;
    const serviceDate = get("serviceDate")?.value || selection.serviceDate || form.elements.serviceDate.value;
    const luggageDescription = form.elements.luggageDescription?.value?.trim() || "";
    const hasLuggage = Number(form.elements.luggage?.value || 0) > 0 || Boolean(luggageDescription);
    return {
      ...selection,
      destination: description,
      type: get("type")?.value || selection.type || "oneWay",
      label: serviceRateTypes[get("type")?.value || selection.type]?.label || selection.label,
      amount: Math.max(0, Number(get("amount")?.value ?? selection.amount ?? 0)),
      serviceDate,
      returnDate: serviceDate,
      origin: selection.origin || "",
      destinationAddress: description,
      departureTime: get("departureTime12")
        ? time12To24(get("departureTime12").value, get("departurePeriod")?.value)
        : selection.departureTime || "",
      returnTime: "",
      passengers: Number(form.elements.passengers.value || selection.passengers || 1),
      hasLuggage,
      luggageDescription: hasLuggage ? luggageDescription : "",
      notes: get("notes") ? get("notes").value.trim() : selection.notes || "",
      legNumber: index + 1,
    };
  });
}

function syncPrimaryServiceFields(form, selections) {
  const first = selections[0] || {};
  if (!selections.length) return;
  const last = selections.at(-1) || first;
  const finalDate = latestQuoteServiceDate(selections) || first.returnDate || first.serviceDate;
  form.elements.serviceDate.value = first.serviceDate || form.elements.serviceDate.value || guatemalaDateValue();
  form.elements.returnDate.value = selections.length > 1
    ? finalDate || form.elements.returnDate.value || guatemalaDateValue()
    : first.returnDate || first.serviceDate || form.elements.returnDate.value || guatemalaDateValue();
  form.elements.serviceStartDate.value = form.elements.serviceDate.value;
  form.elements.serviceEndDate.value = form.elements.returnDate.value;
  const syncSummaryTime = (fieldName, periodName, value, editedFlag) => {
    if (!value || form.dataset[editedFlag] === "true") return;
    const parts = time12Parts(value);
    form.elements[fieldName].value = parts.time;
    form.elements[periodName].value = parts.period;
  };
  syncSummaryTime(
    "summaryDepartureTime12",
    "summaryDeparturePeriod",
    first.departureTime,
    "summaryDepartureEdited",
  );
  syncSummaryTime(
    "summaryReturnTime12",
    "summaryReturnPeriod",
    last.returnTime || (selections.length > 1 ? last.departureTime : first.returnTime),
    "summaryReturnEdited",
  );
}

function syncServiceSelections(form) {
  const selections = serviceSelectionsWithDetailsFromForm(form);
  const first = selections[0];
  form.elements.serviceSelectionsJson.value = JSON.stringify(selections);
  form.elements.fixedFare.value = String(serviceSelectionsTotal(selections));
  form.elements.fixedFareIncludesTax.value = "false";
  form.elements.destinationRateId.value = first?.destinationId || "";
  form.elements.serviceRateType.value = first?.type || "oneWay";
  form.elements.destinationRateName.value = serviceSelectionsDestinationLabel(selections);
  form.elements.serviceType.value = serviceSelectionsServiceLabel(selections);
  syncPrimaryServiceFields(form, selections);
  $$("[data-service-selection-option]", form).forEach((label) => {
    const input = $("input", label);
    label.classList.toggle("active", Boolean(input?.checked));
  });
  const summary = $("[data-selected-services-summary]", form);
  if (summary) summary.innerHTML = serviceSelectionSummaryHtml(selections);
  const toggleText = $("[data-service-menu-toggle] strong", form);
  if (toggleText) toggleText.textContent = serviceSelectionToggleText(selections);
  renderServiceDetailBlocks(form);
  updateQuoteSummary(form);
}

function renderVehicleConfigurationPanels(form, quote = {}) {
  const container = $("[data-sprinter311-configurations]", form);
  if (!container) return;
  const vehicles = luxuryVehicles().filter((vehicle) => sprinter311ConfigurationsForVehicle(vehicle).length);
  container.innerHTML = vehicles
    .map((vehicle) => {
      const configurations = sprinter311ConfigurationsForVehicle(vehicle);
      const selectedConfigurationId = defaultVehicleConfigurationId(vehicle, quote);
      return `
        <div class="seat-configuration unit-configuration-panel" data-vehicle-configuration-panel data-vehicle-id="${escapeHtml(vehicle.id)}">
          <strong>Configuración ${escapeHtml(vehicleOperationalName(vehicle))}</strong>
          <div class="seat-configuration-options unit-configuration-options">
            ${configurations
              .map(
                (configuration) => `
                  <label>
                    <input
                      type="radio"
                      name="vehicleConfiguration-${escapeHtml(vehicle.id)}"
                      value="${escapeHtml(configuration.id)}"
                      data-vehicle-configuration
                      data-vehicle-id="${escapeHtml(vehicle.id)}"
                      ${configuration.id === selectedConfigurationId ? "checked" : ""}
                    />
                    <span>
                      <b>${escapeHtml(configuration.title)}</b>
                      <small>${escapeHtml(configuration.detail)}</small>
                      <small class="configuration-layout">${escapeHtml(configuration.layout)}</small>
                    </span>
                  </label>
                `,
              )
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");
}

function syncVehicleConfigurationPanels(form) {
  const selectedIds = new Set(
    $$('input[name="vehicleIds"]:checked', form).map((input) => input.value),
  );
  $$('[data-vehicle-configuration-panel]', form).forEach((panel) => {
    const enabled = selectedIds.has(panel.dataset.vehicleId);
    panel.hidden = !enabled;
    const options = $$('input[data-vehicle-configuration]', panel);
    options.forEach((input) => {
      input.disabled = !enabled;
    });
    if (enabled && !options.some((input) => input.checked) && options[0]) options[0].checked = true;
  });
  const configurationField = form.elements.vehicleConfigurationsJson;
  if (configurationField) {
    configurationField.value = JSON.stringify(selectedVehicleConfigurationMap(form));
  }
}

function renderVehicleUnitPanel(form, selectedIds = [], quote = {}) {
  const vehicles = luxuryVehicles();
  const selectedSet = new Set(selectedIds);
  const shouldSelectFirst = !selectedIds.length && !String(form.elements.vehicleManualName?.value || "").trim();
  $("[data-vehicle-unit-panel]", form).innerHTML = vehicles.length
    ? `
      <span class="unit-panel-title">Seleccione una o varias Mercedes Benz Sprinter</span>
      <div class="vehicle-unit-options">
        ${vehicles
          .map((vehicle, index) => {
            const checked = selectedSet.has(vehicle.id) || (shouldSelectFirst && index === 0);
            const configurationCount = sprinter311ConfigurationsForVehicle(vehicle).length;
            const capacityDetails = vehicleIsSprinter316(vehicle)
              ? "Mercedes Benz Sprinter 316 · Butacas de lujo, Butacas M1 o Sillones M3"
              : `${vehicleUnitLabel(vehicle)} · ${configurationCount} configuraciones disponibles`;
            return `
              <label class="vehicle-unit-option">
                <input type="checkbox" name="vehicleIds" value="${vehicle.id}" ${checked ? "checked" : ""} />
                <span><strong>${escapeHtml(vehicleOperationalName(vehicle))}</strong><small>${escapeHtml(capacityDetails)}</small></span>
              </label>
            `;
          })
          .join("")}
      </div>
    `
    : `<div class="rate-empty">No hay Sprinter disponibles.</div>`;
  renderVehicleConfigurationPanels(form, quote);
  syncSelectedVehicleField(form);
  syncVehicleConfigurationPanels(form);
}

function syncSelectedVehicleField(form) {
  const selectedIds = $$('input[name="vehicleIds"]:checked', form).map((input) => input.value);
  form.elements.vehicleId.value = selectedIds[0] || "";
}

async function saveRecord(event, collection, id) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form));
  if (collection === "vehicles") {
    body.supportsBed = form.elements.supportsBed.checked;
    body.supportsPlayStation5 = form.elements.supportsPlayStation5.checked;
    body.supportsSuperLuxurySeats = form.elements.supportsSuperLuxurySeats.checked;
  }
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  try {
    const saved = await api(`/api/${collection}${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    toast(
      saved.mergedExisting
        ? "El cliente ya existía; su ficha fue actualizada sin crear un duplicado."
        : id
          ? "Registro actualizado."
          : "Registro creado.",
    );
    closeModal();
    await navigate(state.module);
  } catch (error) {
    $("[data-form-error]", form).textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function openQuoteModal(quote = {}) {
  const isEdit = Boolean(quote.id);
  const draft = !isEdit ? loadQuoteDraft() : null;
  if (draft) quote = { ...quote, ...draft };
  const today = guatemalaDateValue();
  const quoteDate = isEdit
    ? quote.quoteDate || String(quote.createdAt || "").slice(0, 10) || today
    : today;
  const serviceStartDate = quote.serviceStartDate || quote.serviceDate || today;
  const serviceEndDate = quote.serviceEndDate || quote.returnDate || quote.serviceDate || today;
  const defaultVehicleName = quote.vehicleManualName || "";
  const initialServiceSelections = quoteServiceSelections(quote);
  const initialDestinationMode = quote.destinationMode === "multiple" || (!quote.destinationMode && initialServiceSelections.length > 1)
    ? "multiple"
    : "single";
  const initialDestinationCount = Math.max(2, Math.min(20, Math.round(Number(quote.destinationCount || initialServiceSelections.length || 2))));
  const initialPriceDisplayMode = quote.priceDisplayMode === "final" ? "final" : "detailed";
  const initialDiscountAmount = Math.max(0, Number(quote.discountAmount || quote.totals?.discountAmount || quote.totals?.discount || 0));
  const initialSeatConfiguration = ["luxury", "m1", "m3"].includes(quote.seatConfiguration)
    ? quote.seatConfiguration
    : quote.hasSuperLuxurySeats
      ? "luxury"
      : "m1";
  const initialLuggageQuantity = Math.max(0, Number(quote.luggage || (quote.hasLuggage ? 1 : 0)));
  const orderedInitialServices = orderedQuoteServices({ serviceSelections: initialServiceSelections });
  const firstInitialService = orderedInitialServices[0] || {};
  const lastInitialService = orderedInitialServices.at(-1) || firstInitialService;
  const initialDepartureTime = quote.departureTime || firstInitialService.departureTime || "";
  const initialReturnTime = quote.returnTime || lastInitialService.returnTime ||
    (orderedInitialServices.length > 1 ? lastInitialService.departureTime : "") || "";
  const initialDisplayOrigin = String(quote.origin || firstInitialService.origin || "").trim();
  const initialDisplayDestination = String(
    quote.destination || lastInitialService.destinationAddress || lastInitialService.destination || "",
  ).trim();
  const initialDepartureParts = time12Parts(initialDepartureTime);
  const initialReturnParts = time12Parts(initialReturnTime);
  openModal(
    isEdit ? `Editar ${quote.number}` : "Nueva cotización",
    `
      <form id="quote-form" class="modal-form" novalidate>
        <style data-quote-live-preview-styles>${quoteDocumentStyles()}</style>
        ${!isEdit ? `
          <div class="quote-form-toolbar">
            <div>
              <strong>Borrador automático activo</strong>
              <span>Puede cerrar y continuar después, o limpiar todo para iniciar desde cero.</span>
            </div>
            <button type="button" class="button button-secondary" data-refresh-quote>Refresh</button>
          </div>
        ` : ""}
        <div class="quote-layout">
          <div class="quote-form-sections">
            <section class="form-section" data-quote-step="route">
              <h3>1. Elegir traslados</h3>
              <div class="destination-mode-grid">
                <label class="destination-mode-option ${initialDestinationMode === "single" ? "active" : ""}" data-destination-mode-option>
                  <input type="radio" name="destinationMode" value="single" ${initialDestinationMode === "single" ? "checked" : ""} />
                  <b>1 traslado</b>
                  <span>Complete una sola ficha con fecha, descripción, hora opcional y precio.</span>
                </label>
                <label class="destination-mode-option ${initialDestinationMode === "multiple" ? "active" : ""}" data-destination-mode-option>
                  <input type="radio" name="destinationMode" value="multiple" ${initialDestinationMode === "multiple" ? "checked" : ""} />
                  <b>Traslados múltiples</b>
                  <span>Cree todos los traslados que necesite, cada uno con fecha, descripción, hora opcional y precio.</span>
                </label>
              </div>
              <label class="destination-count-field" data-destination-count-wrap ${initialDestinationMode === "multiple" ? "" : "hidden"}>¿Cuántos traslados necesita?
                <input type="number" name="destinationCount" value="${initialDestinationCount}" min="2" max="20" step="1" inputmode="numeric" />
                <small>Escriba la cantidad de traslados, de 2 a 20.</small>
              </label>
            </section>
            <section class="form-section" data-quote-step="vehicles">
              <h3>3. Tipo de vehículo, pasajeros y equipaje</h3>
              <div class="form-grid">
                <div class="vehicle-unit-panel full" data-vehicle-unit-panel></div>
                <label class="full">Otro tipo de vehículo <small class="field-hint">Opcional. Describe una alternativa y no suma otra unidad al precio.</small>
                  <input name="vehicleManualName" value="${escapeHtml(defaultVehicleName)}" placeholder="Ej. Toyota Hiace, microbús o camioneta ejecutiva" />
                </label>
                <div class="seat-configuration full" data-seat-configuration>
                  <strong>Configuración Mercedes Benz Sprinter 316</strong>
                  <div class="seat-configuration-options">
                    <label><input type="radio" name="seatConfiguration" value="luxury" ${initialSeatConfiguration === "luxury" ? "checked" : ""} /><span><b>Butacas de lujo</b><small>9 pasajeros atrás + 1 adelante con equipaje. Máximo 10.</small></span></label>
                    <label><input type="radio" name="seatConfiguration" value="m1" ${initialSeatConfiguration === "m1" ? "checked" : ""} /><span><b>Butacas M1</b><small>13 pasajeros atrás + 1 adelante con equipaje. Máximo 14.</small></span></label>
                    <label><input type="radio" name="seatConfiguration" value="m3" ${initialSeatConfiguration === "m3" ? "checked" : ""} /><span><b>Sillones M3</b><small>10 pasajeros atrás + 1 adelante. Máximo 11.</small></span></label>
                  </div>
                </div>
                <div class="unit-configuration-panels full" data-sprinter311-configurations></div>
                <div class="passenger-luggage-editor full">
                  <fieldset>
                    <legend>Pasajeros</legend>
                    <label>Cantidad
                      <input type="number" name="passengers" value="${Math.max(1, Number(quote.passengers || 1))}" min="1" max="${Math.max(1, Number(quote.maxPassengers || 15))}" step="1" inputmode="numeric" />
                    </label>
                    <label>Descripción
                      <input name="passengerDescription" value="${escapeHtml(quote.passengerDescription || "")}" placeholder="Ej. 9 atrás y 1 adelante" />
                    </label>
                  </fieldset>
                  <fieldset>
                    <legend>Equipaje</legend>
                    <label>Cantidad
                      <input type="number" name="luggage" value="${initialLuggageQuantity}" min="0" step="1" inputmode="numeric" />
                    </label>
                    <label>Categorías y cantidades
                      <input name="luggageDescription" value="${escapeHtml(quote.luggageDescription || "")}" placeholder="Ej. 8 maletas grandes, 4 mochilas, 2 hieleras" />
                    </label>
                  </fieldset>
                </div>
                <div class="capacity-note full" data-capacity-note role="status" aria-live="polite">Capacidad disponible.</div>
                <div class="premium-options full">
                  <label class="premium-option premium-option-full">
                    <input type="checkbox" name="hasPlayStation5" ${quote.hasPlayStation5 ? "checked" : ""} />
                    <span class="premium-option-icon">PS</span>
                    <span><strong>PlayStation 5</strong><small>Mostrar esta comodidad en la cotización final.</small></span>
                  </label>
                </div>
              </div>
            </section>
            <section class="form-section" data-quote-step="route-summary">
              <h3>4. Lugar de salida, destino y horarios</h3>
              <p class="form-note">Estos datos aparecerán una sola vez en el encabezado de la cotización.</p>
              <div class="form-grid">
                <label>Lugar de salida
                  <input name="displayOrigin" value="${escapeHtml(initialDisplayOrigin)}" placeholder="Ej. Neo Apartamentos, zona 10" />
                </label>
                <label>Destino
                  <input name="displayDestination" value="${escapeHtml(initialDisplayDestination)}" placeholder="Ej. Petén, Tikal" />
                </label>
                <label>Hora de salida
                  <span class="time-12-editor">
                    <input name="summaryDepartureTime12" value="${escapeHtml(initialDepartureParts.time)}" inputmode="numeric" placeholder="Ej. 07:00" aria-label="Hora de salida en formato de 12 horas" />
                    <select name="summaryDeparturePeriod" aria-label="AM o PM">
                      <option value="AM" ${initialDepartureParts.period === "AM" ? "selected" : ""}>AM</option>
                      <option value="PM" ${initialDepartureParts.period === "PM" ? "selected" : ""}>PM</option>
                    </select>
                  </span>
                </label>
                <label>Hora de regreso
                  <span class="time-12-editor">
                    <input name="summaryReturnTime12" value="${escapeHtml(initialReturnParts.time)}" inputmode="numeric" placeholder="Ej. 05:00" aria-label="Hora de regreso en formato de 12 horas" />
                    <select name="summaryReturnPeriod" aria-label="AM o PM">
                      <option value="AM" ${initialReturnParts.period === "AM" ? "selected" : ""}>AM</option>
                      <option value="PM" ${initialReturnParts.period === "PM" ? "selected" : ""}>PM</option>
                    </select>
                  </span>
                </label>
              </div>
            </section>
            <section class="form-section" data-quote-step="client">
              <h3>2. Datos del cliente</h3>
              <div class="form-grid">
                <label>Nombre del cliente<input name="clientName" value="${escapeHtml(quote.clientName)}" placeholder="Persona a quien se dirige la cotización" /></label>
                <label>Número de teléfono<input type="tel" name="clientPhone" value="${escapeHtml(quote.clientPhone)}" placeholder="Ej. 5555-5555" autocomplete="tel" /></label>
                <label>Fecha de cotización<input type="date" name="quoteDate" value="${escapeHtml(quoteDate)}" /></label>
              </div>
            </section>
            <section class="form-section">
              <h3>5. Información del viaje</h3>
              <div data-single-destination-builder ${initialDestinationMode === "multiple" ? "hidden" : ""}>
                <div class="manual-service-box">
                  <h4>¿Necesita otro traslado?</h4>
                  <p class="form-note">Puede agregar una nueva ficha y completar sus datos de forma independiente.</p>
                  <button type="button" class="button button-secondary" data-add-manual-service>Agregar otro traslado</button>
                </div>
                <div class="form-grid service-rate-picker">
                  <label class="visually-hidden">Destino tarifado
                    <select name="destinationRateId" data-destination-rate-select>
                      <option value="">Personalizado / calcular por ruta</option>
                      ${destinationRates.map((rate) => `<option value="${rate.id}" ${quote.destinationRateId === rate.id ? "selected" : ""}>${escapeHtml(rate.destination)}</option>`).join("")}
                    </select>
                  </label>
                  <label class="visually-hidden">Tipo de tarifa
                    <select name="serviceRateType" data-service-rate-type>
                      ${Object.entries(serviceRateTypes).map(([value, item]) => `<option value="${value}" ${quote.serviceRateType === value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
                    </select>
                  </label>
                  <div class="destination-rate-preview full" data-destination-rate-preview></div>
                </div>
              </div>
              <div class="service-detail-list" data-service-detail-list></div>
              <label>Notas generales para la cotización
                <textarea name="notes" placeholder="Condiciones generales, disponibilidad o información que aplica a toda la cotización">${escapeHtml(quote.notes)}</textarea>
              </label>
            </section>
            <section class="form-section">
              <h3>6. Presentación del precio</h3>
              <div class="price-mode-grid">
                <label class="price-mode-option ${initialPriceDisplayMode === "detailed" ? "active" : ""}" data-price-mode-option>
                  <input type="radio" name="priceDisplayMode" value="detailed" ${initialPriceDisplayMode === "detailed" ? "checked" : ""} />
                  <b>Precios desglosados</b>
                  <span>Muestra cada traslado ordenado por fecha y el total al final.</span>
                </label>
                <label class="price-mode-option ${initialPriceDisplayMode === "final" ? "active" : ""}" data-price-mode-option>
                  <input type="radio" name="priceDisplayMode" value="final" ${initialPriceDisplayMode === "final" ? "checked" : ""} />
                  <b>Solo precio final</b>
                  <span>Oculta los precios individuales y muestra únicamente el monto final.</span>
                </label>
              </div>
              <label data-final-price-wrap ${initialPriceDisplayMode === "final" ? "" : "hidden"}>Precio final de toda la cotización
                <input type="number" name="finalManualPrice" value="${quote.finalManualPrice || (initialPriceDisplayMode === "final" ? quote.fixedFare || "" : "")}" min="0" step="0.01" placeholder="0.00" />
              </label>
              <div class="form-grid">
                <label><span><input type="checkbox" name="includeTax" ${quote.includeTax === true ? "checked" : ""} /> Agregar IVA 12%</span></label>
                <div class="discount-control">
                  <label><span><input type="checkbox" name="includeDiscount" ${initialDiscountAmount > 0 ? "checked" : ""} /> Aplicar descuento</span></label>
                  <label data-discount-amount-wrap ${initialDiscountAmount > 0 ? "" : "hidden"}>Monto del descuento
                    <input type="number" name="discountAmount" value="${initialDiscountAmount || ""}" min="0" step="0.01" inputmode="decimal" placeholder="0.00" />
                  </label>
                </div>
              </div>
            </section>
          </div>
          <div class="quote-side-column">
            <aside class="quote-summary" data-quote-summary></aside>
            <section class="quote-live-preview-panel">
              <header>
                <span>Previsualización en tiempo real</span>
                <strong>Cotización principal</strong>
              </header>
              <div class="quote-live-preview-frame">
                <div class="quote-live-preview-canvas" data-quote-live-preview></div>
              </div>
            </section>
          </div>
        </div>
        <input type="hidden" name="serviceDate" value="${escapeHtml(serviceStartDate)}" />
        <input type="hidden" name="returnDate" value="${escapeHtml(serviceEndDate)}" />
        <input type="hidden" name="hasLuggage" value="${initialLuggageQuantity > 0 ? "true" : "false"}" />
        <input type="hidden" name="clientId" value="${escapeHtml(quote.clientId)}" />
        <input type="hidden" name="clientNit" value="${escapeHtml(quote.clientNit)}" />
        <input type="hidden" name="clientEmail" value="${escapeHtml(quote.clientEmail)}" />
        <input type="hidden" name="vehicleId" value="${escapeHtml(quote.vehicleId)}" />
        <input type="hidden" name="vehicleConfigurationsJson" value="${escapeHtml(JSON.stringify(quoteVehicleConfigurations(quote)))}" />
        <input type="hidden" name="driverId" value="${escapeHtml(quote.driverId)}" />
        <input type="hidden" name="driverManualName" value="${escapeHtml(quote.driverManualName)}" />
        <input type="hidden" name="destinationRateName" value="${escapeHtml(quote.destinationRateName)}" />
        <input type="hidden" name="fixedFare" value="${escapeHtml(quote.fixedFare || 0)}" />
        <input type="hidden" name="fixedFareIncludesTax" value="${quote.fixedFareIncludesTax === false ? "false" : "true"}" />
        <input type="hidden" name="serviceSelectionsJson" value="${escapeHtml(JSON.stringify(initialServiceSelections))}" />
        <input type="hidden" name="serviceType" value="${escapeHtml(quote.serviceType || "Servicio personalizado")}" />
        <input type="hidden" name="serviceStartDate" value="${escapeHtml(serviceStartDate)}" />
        <input type="hidden" name="serviceEndDate" value="${escapeHtml(serviceEndDate)}" />
        <input type="hidden" name="arrivalTime" value="${escapeHtml(quote.arrivalTime)}" />
        <input type="hidden" name="endLocation" value="${escapeHtml(quote.endLocation)}" />
        <input type="hidden" name="kilometers" value="${quote.kilometers || 0}" />
        <input type="hidden" name="minutes" value="${quote.minutes || 0}" />
        <input type="hidden" name="waitingMinutes" value="${quote.waitingMinutes || 0}" />
        <input type="hidden" name="extraCharges" value="${quote.extraCharges || 0}" />
        <input type="hidden" name="discountPercent" value="0" />
        <input type="hidden" name="pdfTemplate" value="${escapeHtml(quote.pdfTemplate || state.settings.defaultPdfTemplate)}" />
        <input type="hidden" name="status" value="${escapeHtml(quote.status || "borrador")}" />
        <input type="hidden" name="routeProvider" value="${escapeHtml(quote.routeProvider)}" />
        <input type="hidden" name="driverUserId" value="${escapeHtml(quote.driverUserId)}" />
        <input class="visually-hidden" type="checkbox" name="applyNightSurcharge" ${quote.applyNightSurcharge ? "checked" : ""} />
        <input class="visually-hidden" type="checkbox" name="applyAirportSurcharge" ${quote.applyAirportSurcharge ? "checked" : ""} />
        ${!isEdit ? `<div class="draft-note">Borrador automático activo. El botón Refresh de la parte superior limpia únicamente esta nueva cotización.</div>` : ""}
        <p class="form-error" data-form-error></p>
        <div class="form-footer">
          <button type="button" class="button button-secondary" data-close-form>Cancelar</button>
          <button type="button" class="button button-gold" data-save-quote-preview>Guardar imagen de cotización</button>
          <button type="submit" class="button button-primary">${isEdit ? "Guardar cambios" : "Crear cotización"}</button>
        </div>
      </form>
    `,
    { wide: true, eyebrow: "Cotizador" },
  );

  const form = $("#quote-form");
  const formSections = $(".quote-form-sections", form);
  const vehicleStep = $('[data-quote-step="vehicles"]', form);
  const clientStep = $('[data-quote-step="client"]', form);
  if (formSections && vehicleStep && clientStep) formSections.insertBefore(clientStep, vehicleStep);
  $("[data-close-form]").addEventListener("click", closeModal);
  $("[data-refresh-quote]")?.addEventListener("click", () => {
    clearQuoteDraft();
    openQuoteModal();
    toast("Cotización reiniciada desde cero.");
  });
  $("[data-save-quote-preview]", form)?.addEventListener("click", () => saveQuotePreviewImage(form));
  $("[data-destination-rate-preview]").addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-service-menu-toggle]");
    if (toggle) {
      const panel = $("[data-service-menu-panel]", form);
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      toggle.setAttribute("aria-expanded", String(willOpen));
      return;
    }
    const addService = event.target.closest("[data-add-service-selection]");
    if (addService) {
      addRateServiceSelection(form, addService.dataset.addServiceSelection);
      if (!isEdit) saveQuoteDraft(form);
      return;
    }
    const removeService = event.target.closest("[data-remove-service-selection]");
    if (removeService) {
      removeServiceSelection(form, removeService.dataset.removeServiceSelection, removeService.dataset.removeServiceIndex);
      if (!isEdit) saveQuoteDraft(form);
    }
  });
  $("[data-destination-rate-preview]").addEventListener("change", (event) => {
    if (!event.target.matches('input[name="serviceSelectionKeys"]')) return;
    syncServiceSelections(form);
    if (!isEdit) saveQuoteDraft(form);
  });
  $("[data-add-manual-service]").addEventListener("click", () => {
    addManualServiceSelection(form);
    if (!isEdit) saveQuoteDraft(form);
  });
  $$('input[name="destinationMode"]', form).forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      syncDestinationMode(form, { ensureCount: true });
      if (!isEdit) saveQuoteDraft(form);
    });
  });
  const applyDestinationCount = () => {
    const requested = Number(form.elements.destinationCount.value);
    if (!Number.isInteger(requested) || requested < 2 || requested > 20) return;
    syncDestinationMode(form, { ensureCount: true });
    if (!isEdit) saveQuoteDraft(form);
  };
  form.elements.destinationCount.addEventListener("input", applyDestinationCount);
  form.elements.destinationCount.addEventListener("change", applyDestinationCount);
  $$('input[name="priceDisplayMode"]', form).forEach((input) => {
    input.addEventListener("change", () => {
      syncPriceDisplayMode(form);
      updateQuoteSummary(form);
      if (!isEdit) saveQuoteDraft(form);
    });
  });
  $("[data-service-detail-list]", form).addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-remove-service-card]");
    if (!removeButton) return;
    removeServiceSelection(form, removeButton.dataset.removeServiceCard);
    if (destinationModeValue(form) === "multiple") {
      form.elements.destinationCount.value = String(Math.max(2, serviceSelectionsWithDetailsFromForm(form).length));
      syncDestinationMode(form, { ensureCount: true });
    }
    if (!isEdit) saveQuoteDraft(form);
  });
  $("[data-service-detail-list]", form).addEventListener("change", (event) => {
    const selections = selectedServiceEntriesFromForm(form);
    const first = selections[0];
    if (!first || destinationModeValue(form) !== "multiple") return;
    if (event.target.name !== serviceDetailInputName(first, "serviceDate")) return;
    applySequentialTransferDates(form);
    syncServiceSelections(form);
    if (!isEdit) saveQuoteDraft(form);
  });
  renderVehicleUnitPanel(form, quoteVehicleIds(quote), quote);
  syncQuoteCapacity(form);
  $("[data-vehicle-unit-panel]").addEventListener("change", (event) => {
    if (event.target.matches('input[name="vehicleIds"]') && event.target.checked) {
      form.elements.vehicleManualName.value = "";
    }
    syncQuoteCapacity(form);
  });
  form.elements.vehicleManualName.addEventListener("input", () => {
    if (form.elements.vehicleManualName.value.trim()) {
      $$('input[name="vehicleIds"]', form).forEach((input) => {
        input.checked = false;
      });
    }
    syncQuoteCapacity(form);
  });
  form.elements.hasPlayStation5.addEventListener("change", () => syncQuoteCapacity(form));
  $("[data-sprinter311-configurations]", form)?.addEventListener("change", (event) => {
    if (!event.target.matches("input[data-vehicle-configuration]")) return;
    delete form.dataset.capacityWarning;
    delete form.dataset.capacityWarningKey;
    syncQuoteCapacity(form, true);
  });
  $$('input[name="seatConfiguration"]', form).forEach((input) => {
    input.addEventListener("change", () => syncQuoteCapacity(form, true));
  });
  form.elements.luggage.addEventListener("input", () => syncQuoteCapacity(form, true));
  form.elements.luggageDescription.addEventListener("input", () => syncQuoteCapacity(form, true));
  form.elements.passengers.addEventListener("input", () => {
    delete form.dataset.capacityWarning;
    delete form.dataset.capacityWarningKey;
    syncQuoteCapacity(form, true);
  });
  ["summaryDepartureTime12", "summaryDeparturePeriod"].forEach((name) => {
    form.elements[name].addEventListener("input", () => {
      form.dataset.summaryDepartureEdited = "true";
    });
    form.elements[name].addEventListener("change", () => {
      form.dataset.summaryDepartureEdited = "true";
    });
  });
  ["summaryReturnTime12", "summaryReturnPeriod"].forEach((name) => {
    form.elements[name].addEventListener("input", () => {
      form.dataset.summaryReturnEdited = "true";
    });
    form.elements[name].addEventListener("change", () => {
      form.dataset.summaryReturnEdited = "true";
    });
  });
  form.elements.serviceDate.addEventListener("change", () => {
    form.elements.serviceStartDate.value = form.elements.serviceDate.value;
    if (!form.elements.returnDate.value) form.elements.returnDate.value = form.elements.serviceDate.value;
  });
  form.elements.returnDate.addEventListener("change", () => {
    form.elements.serviceEndDate.value = form.elements.returnDate.value;
  });
  const syncDiscountControl = () => {
    const enabled = form.elements.includeDiscount.checked;
    const amountWrap = $("[data-discount-amount-wrap]", form);
    amountWrap.hidden = !enabled;
    form.elements.discountAmount.disabled = !enabled;
    if (enabled && !form.elements.discountAmount.value) form.elements.discountAmount.focus();
  };
  form.elements.includeDiscount.addEventListener("change", syncDiscountControl);
  syncDiscountControl();
  const trackFormChange = () => {
    updateQuoteSummary(form);
    if (!isEdit) saveQuoteDraft(form);
  };
  form.addEventListener("input", trackFormChange);
  form.addEventListener("change", trackFormChange);
  form.addEventListener("submit", (event) => saveQuote(event, quote.id));
  renderDestinationRatePreview(form);
  syncDestinationMode(form, { ensureCount: true });
  syncPriceDisplayMode(form);
  syncServiceSelections(form);
  updateQuoteSummary(form);
  if (draft) {
    saveQuoteDraft(form);
    toast("Borrador recuperado con la fecha de hoy.");
  }
}

function capacityLimitMessage(form, vehicles, requestedPassengers, maximum) {
  const rules = vehicles.map((vehicle) => {
    if (!vehicleIsSprinter316(vehicle)) {
      const configuration = selectedVehicleConfiguration(vehicle, form);
      if (configuration) {
        return `${vehicleOperationalName(vehicle)} con “${configuration.title}” permite un máximo de ${configuration.capacity} pasajeros`;
      }
      return `${vehicleOperationalName(vehicle)} permite un máximo de ${vehicleCapacityWithOptions(vehicle, form)} pasajeros`;
    }
    const configuration = form.elements.seatConfiguration?.value || "m1";
    const configurationRule = configuration === "luxury"
      ? "butacas de lujo permite un máximo de 10 pasajeros"
      : configuration === "m3"
        ? "sillones M3 permite un máximo de 11 pasajeros"
        : "butacas M1 permite un máximo de 14 pasajeros";
    return `${vehicleOperationalName(vehicle)} con ${configurationRule}`;
  });
  const ruleText = rules.length ? `${rules.join("; ")}. ` : "";
  return `Capacidad excedida: solicitó ${requestedPassengers} pasajeros. ${ruleText}Máximo total permitido: ${maximum}. La cantidad se ajustó automáticamente.`;
}

function syncQuoteCapacity(form, announce = false) {
  syncSelectedVehicleField(form);
  syncVehicleConfigurationPanels(form);
  const vehicles = selectedVehiclesFromForm(form);
  const manualVehicleName = String(form.elements.vehicleManualName?.value || "").trim();
  const hasSprinter316 = vehicles.some(vehicleIsSprinter316);
  const hasSprinter311 = vehicles.some((vehicle) => !vehicleIsSprinter316(vehicle));
  const seatPanel = $(`[data-seat-configuration]`, form);
  if (seatPanel) seatPanel.hidden = !hasSprinter316;
  const luggageQuantity = Math.max(0, Math.round(Number(form.elements.luggage.value || 0)));
  form.elements.luggage.value = String(luggageQuantity);
  const hasLuggage = formHasLuggage(form);
  form.elements.hasLuggage.value = hasLuggage ? "true" : "false";
  const sprinter311Configuration = sprinter311ConfigurationValue(form);
  const manualCapacity = manualVehicleName
    ? Math.max(15, Math.round(Number(form.elements.passengers?.value || 1)))
    : 0;
  const passengerInput = form.elements.passengers;
  const requestedPassengers = Math.max(1, Math.round(Number(passengerInput.value || 1)));
  const maximum = vehicles.length || manualVehicleName
    ? vehicles.reduce((sum, vehicle) => sum + vehicleCapacityWithOptions(vehicle, form), 0) + manualCapacity
    : 15;
  passengerInput.max = String(maximum);
  const configuration = form.elements.seatConfiguration?.value || "m1";
  const warningKey = [
    vehicles.map((vehicle) => vehicle.id).sort().join(","),
    manualVehicleName,
    maximum,
    hasLuggage ? "luggage" : "no-luggage",
    sprinter311Configuration,
    JSON.stringify(selectedVehicleConfigurationMap(form)),
    configuration,
  ].join("|");
  if (form.dataset.capacityWarningKey && form.dataset.capacityWarningKey !== warningKey) {
    delete form.dataset.capacityWarning;
    delete form.dataset.capacityWarningKey;
  }
  if (requestedPassengers > maximum) {
    passengerInput.value = String(maximum);
    const warningMessage = capacityLimitMessage(form, vehicles, requestedPassengers, maximum);
    form.dataset.capacityWarning = warningMessage;
    form.dataset.capacityWarningKey = warningKey;
    if (announce) {
      toast(warningMessage);
    }
  } else {
    passengerInput.value = String(requestedPassengers);
  }
  if (Number(passengerInput.value) < 1) passengerInput.value = "1";
  const vehicleNames = [
    ...vehicles.map((vehicle) => `${vehicleOperationalName(vehicle)} (${vehicleUnitLabel(vehicle)})`),
    manualVehicleName,
  ].filter(Boolean);
  const vehicleText = vehicleNames.length
    ? vehicleNames.join(" + ")
    : "la Sprinter seleccionada";
  const amenities = [
    form.elements.hasPlayStation5.checked ? "PlayStation 5" : "",
    formUsesFleetTelevision(form) ? "TV" : "",
  ].filter(Boolean).join(" · ");
  const configurationLabel = configuration === "luxury"
    ? "Butacas de lujo (9 atrás + 1 adelante)"
    : configuration === "m3"
      ? "Sillones M3 (10 atrás + 1 adelante)"
      : "Butacas M1 (13 atrás + 1 adelante)";
  const details = [];
  if (hasSprinter311) {
    vehicles
      .filter((vehicle) => !vehicleIsSprinter316(vehicle))
      .forEach((vehicle) => {
        const unitConfiguration = selectedVehicleConfiguration(vehicle, form);
        if (unitConfiguration) {
          details.push(`${vehicleOperationalName(vehicle)}: ${unitConfiguration.title}, máximo ${unitConfiguration.capacity}`);
        }
      });
  }
  if (hasSprinter316) details.push(`M3: ${configurationLabel}`);
  const capacityNote = $("[data-capacity-note]", form);
  const warningMessage = form.dataset.capacityWarning || "";
  capacityNote.classList.toggle("is-warning", Boolean(warningMessage));
  capacityNote.textContent = warningMessage || `${vehicleText}: máximo total ${maximum} pasajeros. ${details.join(" · ")}${amenities ? ` · ${amenities}` : ""}`;
  updateQuoteSummary(form);
}

function quoteFormData(form) {
  const body = Object.fromEntries(new FormData(form));
  const serviceSelections = serviceSelectionsWithDetailsFromForm(form);
  const firstService = serviceSelections[0];
  syncPrimaryServiceFields(form, serviceSelections);
  body.serviceSelections = serviceSelections;
  body.serviceSelectionsJson = JSON.stringify(serviceSelections);
  form.elements.serviceSelectionsJson.value = body.serviceSelectionsJson;
  body.destinationMode = destinationModeValue(form);
  body.destinationCount = body.destinationMode === "multiple"
    ? Math.max(2, Math.min(20, Math.round(Number(form.elements.destinationCount.value || serviceSelections.length || 2))))
    : Math.max(1, serviceSelections.length || 1);
  body.priceDisplayMode = form.elements.priceDisplayMode.value === "final" ? "final" : "detailed";
  body.finalManualPrice = Math.max(0, Number(form.elements.finalManualPrice.value || 0));
  body.fixedFare = String(body.priceDisplayMode === "final" ? body.finalManualPrice : serviceSelectionsTotal(serviceSelections));
  body.fixedFareIsTotal = body.priceDisplayMode === "final";
  body.destinationRateId = firstService?.destinationId || "";
  body.destinationRateName = serviceSelectionsDestinationLabel(serviceSelections);
  body.serviceRateType = firstService?.type || "oneWay";
  body.serviceType = serviceSelectionsServiceLabel(serviceSelections);
  body.serviceDate = form.elements.serviceDate.value;
  body.returnDate = form.elements.returnDate.value;
  body.origin = form.elements.displayOrigin.value.trim();
  body.destination = form.elements.displayDestination.value.trim();
  body.departureTime = time12To24(
    form.elements.summaryDepartureTime12.value,
    form.elements.summaryDeparturePeriod.value,
  );
  body.returnTime = time12To24(
    form.elements.summaryReturnTime12.value,
    form.elements.summaryReturnPeriod.value,
  );
  body.serviceStartDate = body.serviceDate;
  body.serviceEndDate = body.returnDate || body.serviceDate;
  body.passengerDescription = form.elements.passengerDescription.value.trim();
  body.luggage = Math.max(0, Math.round(Number(form.elements.luggage.value || 0)));
  body.luggageDescription = form.elements.luggageDescription.value.trim();
  body.hasLuggage = body.luggage > 0 || Boolean(body.luggageDescription);
  if (!body.hasLuggage) body.luggageDescription = "";
  body.vehicleIds = $$('input[name="vehicleIds"]:checked', form).map((input) => input.value);
  body.vehicleId = body.vehicleIds[0] || form.elements.vehicleId.value;
  body.vehicleManualName = String(form.elements.vehicleManualName.value || "").trim();
  body.vehicleCount = explicitVehicleCount(body);
  body.vehicleConfigurations = selectedVehicleConfigurationMap(form);
  body.vehicleConfigurationsJson = JSON.stringify(body.vehicleConfigurations);
  form.elements.vehicleConfigurationsJson.value = body.vehicleConfigurationsJson;
  body.hasBed = selectedVehiclesFromForm(form)
    .filter((vehicle) => !vehicleIsSprinter316(vehicle))
    .some((vehicle) => selectedVehicleConfiguration(vehicle, form)?.hasBed);
  body.sprinter311Configuration = selectedVehiclesFromForm(form).some((vehicle) => !vehicleIsSprinter316(vehicle))
    ? sprinter311ConfigurationValue(form)
    : "";
  body.hasPlayStation5 = form.elements.hasPlayStation5.checked;
  body.hasTv = formUsesFleetTelevision(form);
  body.seatConfiguration = selectedVehiclesFromForm(form).some(vehicleIsSprinter316)
    ? form.elements.seatConfiguration.value
    : "";
  body.hasSuperLuxurySeats = body.seatConfiguration === "luxury";
  body.applyNightSurcharge = form.elements.applyNightSurcharge.checked;
  body.applyAirportSurcharge = form.elements.applyAirportSurcharge.checked;
  body.includeTax = form.elements.includeTax.checked;
  body.includeDiscount = form.elements.includeDiscount.checked;
  body.discountAmount = body.includeDiscount
    ? Math.max(0, Number(form.elements.discountAmount.value || 0))
    : 0;
  body.fixedFareIncludesTax = form.elements.fixedFareIncludesTax.value !== "false";
  return body;
}

function calculateTotalsLocal(body) {
  const rates = state.rates;
  const vehicleCount = explicitVehicleCount(body);
  const kilometers = Number(body.kilometers || 0);
  const minutes = Number(body.minutes || 0);
  const fixedFare = Number(body.fixedFare || 0);
  const fixedFareIncludesTax = false;
  const distanceCharge = fixedFare ? 0 : kilometers * rates.pricePerKm;
  const timeCharge = fixedFare ? 0 : minutes * rates.pricePerMinute;
  const fixedFareIsTotal = body.fixedFareIsTotal === true || body.fixedFareIsTotal === "true";
  const baseCalculated = fixedFare ? (fixedFareIsTotal ? fixedFare : fixedFare * vehicleCount) : distanceCharge + timeCharge;
  const hasPricedRoute = fixedFare > 0 || distanceCharge > 0 || timeCharge > 0;
  const baseFare = hasPricedRoute ? Math.max(baseCalculated, rates.minimumFare) : 0;
  const night = body.applyNightSurcharge ? rates.nightSurcharge : 0;
  const airport = body.applyAirportSurcharge ? rates.airportSurcharge : 0;
  const waiting = (Number(body.waitingMinutes || 0) / 60) * rates.waitingPerHour;
  const extra = Number(body.extraCharges || 0);
  const beforeDiscount = baseFare + night + airport + waiting + extra;
  const discountPercent = Number(body.discountPercent || 0);
  const percentDiscount = beforeDiscount * (discountPercent / 100);
  const discountAmount = Number(body.discountAmount || 0);
  const discount = Math.min(beforeDiscount, percentDiscount + discountAmount);
  const subtotal = beforeDiscount - discount;
  const taxPercent = body.includeTax ? rates.taxPercent : 0;
  const includedTax = fixedFareIncludesTax && taxPercent > 0;
  const taxableSubtotal = includedTax ? subtotal / (1 + taxPercent / 100) : subtotal;
  const tax = includedTax ? subtotal - taxableSubtotal : subtotal * (taxPercent / 100);
  return {
    fixedFare,
    vehicleCount,
    fixedFareIncludesTax,
    fixedFareIsTotal,
    distanceCharge,
    timeCharge,
    baseFare,
    nightSurcharge: night,
    airportSurcharge: airport,
    waitingCharge: waiting,
    discount,
    discountAmount,
    discountPercent,
    subtotal: taxableSubtotal,
    tax,
    total: includedTax ? subtotal : subtotal + tax,
  };
}

function updateQuoteSummary(form) {
  const body = quoteFormData(form);
  const totals = calculateTotalsLocal(body);
  const sortedServices = [...body.serviceSelections].sort((a, b) => {
    const dateOrder = String(a.serviceDate || "9999-12-31").localeCompare(String(b.serviceDate || "9999-12-31"));
    return dateOrder || Number(a.legNumber || 0) - Number(b.legNumber || 0);
  });
  const serviceLines = body.serviceSelections.length
    ? sortedServices
        .map(
          (item) => `
            <div class="summary-service-row">
              <span>${item.serviceDate ? `${escapeHtml(formatDate(item.serviceDate, { short: true }))} · ` : ""}${escapeHtml(item.label)} · ${escapeHtml(item.destination)}</span>
              ${body.priceDisplayMode === "detailed" ? `<strong>${money(Number(item.amount || 0) * totals.vehicleCount)}</strong>` : ""}
            </div>
          `,
        )
        .join("")
    : `<div class="summary-service-row"><span>Agregue al menos un traslado</span><strong>${money(0)}</strong></div>`;
  $("[data-quote-summary]", form).innerHTML = `
    <div class="quote-summary-header"><span>${totals.fixedFare ? "Total de la cotización" : "Total estimado"}</span><strong>${money(totals.total)}</strong></div>
    <div class="summary-lines">
      <div class="summary-service-list"><span>${body.priceDisplayMode === "detailed" ? "Desglose por traslado" : "Traslados incluidos"}</span>${serviceLines}</div>
      ${body.priceDisplayMode === "detailed" ? `<div class="summary-line"><span>Total servicios por Mercedes</span><strong>${money(totals.fixedFare)}</strong></div>` : ""}
      <div class="summary-line"><span>Mercedes seleccionadas</span><strong>${escapeHtml(totals.vehicleCount)}</strong></div>
      <div class="summary-line"><span>${body.priceDisplayMode === "final" ? "Precio final ingresado" : "Subtotal vehículos"}</span><strong>${money(totals.baseFare)}</strong></div>
      ${totals.discount > 0 ? `<div class="summary-line"><span>Descuento</span><strong>-${money(totals.discount)}</strong></div>` : ""}
      ${body.includeTax
        ? `<div class="summary-line"><span>IVA ${state.rates.taxPercent}%</span><strong>${money(totals.tax)}</strong></div>`
        : '<div class="summary-line summary-tax-message"><span>Esta cotización no incluye IVA</span></div>'}
      <div class="summary-line"><span>Fecha inicio</span><strong>${escapeHtml(formatDate(sortedServices[0]?.serviceDate || body.serviceDate, { short: true }))}</strong></div>
      <div class="summary-line"><span>Fecha final</span><strong>${escapeHtml(formatDate(sortedServices.at(-1)?.returnDate || body.returnDate, { short: true }))}</strong></div>
      <div class="summary-line"><span>Pasajeros</span><strong>${escapeHtml(`${body.passengers || 1}${body.passengerDescription ? ` · ${body.passengerDescription}` : ""}`)}</strong></div>
      <div class="summary-line"><span>Equipaje</span><strong>${escapeHtml(body.hasLuggage ? body.luggageDescription || `${body.luggage} piezas` : "Sin equipaje")}</strong></div>
      <div class="summary-line"><span>Comodidades</span><strong>${escapeHtml(quoteAmenityLabels(body).join(" · ") || "Estándar")}</strong></div>
      <div class="summary-line summary-total"><span>Total</span><strong>${money(totals.total)}</strong></div>
    </div>
  `;
  renderQuoteLivePreview(form, body, totals);
}

async function calculateRouteForForm(form) {
  const status = $("[data-route-status]", form);
  const button = $("[data-calculate-route]", form);
  const originField = form.elements.displayOrigin || form.elements.origin;
  const destinationField = form.elements.displayDestination || form.elements.destination;
  if (!originField?.value || !destinationField?.value) {
    status.textContent = "Ingrese el punto de salida y el destino.";
    return;
  }
  button.disabled = true;
  status.textContent = "Calculando la mejor ruta disponible...";
  try {
    const result = await api("/api/routes/calculate", {
      method: "POST",
      body: JSON.stringify({
        origin: originField.value,
        destination: destinationField.value,
      }),
    });
    form.elements.kilometers.value = result.kilometers;
    form.elements.minutes.value = result.minutes;
    form.elements.routeProvider.value = result.provider;
    status.textContent = `${result.kilometers} km · ${result.minutes} minutos · ${result.provider}`;
    updateQuoteSummary(form);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function quoteMissingInformation(body) {
  const missing = [];
  if (!String(body.clientName || "").trim()) missing.push("Nombre del cliente");
  if (!String(body.clientPhone || "").trim()) missing.push("Número de teléfono del cliente");
  if (!String(body.quoteDate || "").trim()) missing.push("Fecha de cotización");
  if (!body.vehicleIds?.length && !String(body.vehicleManualName || "").trim()) {
    missing.push("Tipo de vehículo");
  }
  if (!Number(body.passengers || 0)) missing.push("Cantidad de pasajeros");
  if (!String(body.origin || "").trim()) missing.push("Lugar de salida del encabezado");
  if (!String(body.destination || "").trim()) missing.push("Destino del encabezado");
  if (!String(body.departureTime || "").trim()) missing.push("Hora de salida del encabezado");
  if (!String(body.returnTime || "").trim()) missing.push("Hora de regreso del encabezado");
  if (Number(body.luggage || 0) > 0 && !String(body.luggageDescription || "").trim()) {
    missing.push("Categorías y cantidades del equipaje");
  }
  if (!body.serviceSelections?.length) {
    missing.push("Al menos un traslado");
  } else {
    body.serviceSelections.forEach((item, index) => {
      const number = index + 1;
      const description = String(item.destination || "").trim();
      if (!String(item.serviceDate || "").trim()) missing.push(`Fecha del traslado ${number}`);
      if (!description || /^(?:Destino|Traslado) \d+$/i.test(description)) {
        missing.push(`Descripción del traslado ${number}`);
      }
      if (body.priceDisplayMode === "detailed" && Number(item.amount || 0) <= 0) {
        missing.push(`Precio del traslado ${number}`);
      }
    });
  }
  if (body.priceDisplayMode === "final" && Number(body.finalManualPrice || 0) <= 0) {
    missing.push("Precio final de la cotización");
  }
  return missing;
}

function confirmIncompleteQuote(missing) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "quote-confirm-overlay";
    overlay.innerHTML = `
      <section class="quote-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-confirm-title">
        <span class="quote-confirm-eyebrow">Información pendiente</span>
        <h2 id="quote-confirm-title">¿Desea guardar sin completar estos datos?</h2>
        <p>La cotización puede guardarse. Revise exactamente qué información quedará pendiente:</p>
        <ul>${missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        <div class="quote-confirm-actions">
          <button type="button" class="button button-secondary" data-incomplete-cancel>Volver a completar</button>
          <button type="button" class="button button-primary" data-incomplete-save>Guardar de todos modos</button>
        </div>
      </section>
    `;
    const finish = (accepted) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(accepted);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
    };
    overlay.querySelector("[data-incomplete-cancel]").addEventListener("click", () => finish(false));
    overlay.querySelector("[data-incomplete-save]").addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector("[data-incomplete-cancel]").focus();
  });
}

async function saveQuote(event, id) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  syncQuoteCapacity(form, true);
  const body = quoteFormData(form);
  const missing = quoteMissingInformation(body);
  $("[data-form-error]", form).textContent = "";
  if (missing.length) {
    const shouldSave = await confirmIncompleteQuote(missing);
    if (!shouldSave) return;
  }
  body.allowIncomplete = missing.length > 0;
  button.disabled = true;
  try {
    const savedQuote = await api(`/api/quotes${id ? `/${id}` : ""}`, {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    });
    if (!id) clearQuoteDraft();
    toast(id ? "Cotización actualizada." : "Cotización creada correctamente.");
    closeModal();
    await navigate("quotes");
    if (!id) downloadQuotePdf(savedQuote.id);
  } catch (error) {
    $("[data-form-error]", form).textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("No fue posible leer el comprobante.")));
    reader.readAsDataURL(file);
  });
}

function openAcceptQuoteModal(id) {
  const quote = state.quotes.find((item) => item.id === id);
  if (!quote) return;
  openModal("Aceptar servicio", `
    <form id="accept-quote-form">
      <p class="muted">Para convertir <strong>${escapeHtml(quote.number)}</strong> en servicio, suba la boleta de pago o depósito del cliente.</p>
      <div class="form-grid">
        <label>Monto pagado<input type="number" name="amountPaid" value="${quote.amountPaid || quote.totals?.total || 0}" min="0" step="0.01" required /></label>
        <label>Referencia / depósito<input name="paymentReference" value="${escapeHtml(quote.paymentReference)}" placeholder="No. boleta, banco o transferencia" /></label>
        <label class="full">Boleta de pago o depósito<input type="file" name="paymentFile" accept="application/pdf,image/png,image/jpeg,image/webp" required /></label>
        <label class="full">Notas de pago<textarea name="paymentNotes" placeholder="Observaciones del depósito o saldo pendiente">${escapeHtml(quote.paymentNotes)}</textarea></label>
      </div>
      <p class="form-error" data-form-error></p>
      <div class="form-footer"><button type="button" class="button button-secondary" data-close-form>Cancelar</button><button class="button button-primary" type="submit">Aceptar y pasar a servicio</button></div>
    </form>
  `);
  $("[data-close-form]").addEventListener("click", closeModal);
  $("#accept-quote-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.paymentFile.files[0];
    if (!file) {
      $("[data-form-error]", form).textContent = "Suba la boleta de pago o depósito.";
      return;
    }
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await api(`/api/quotes/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({
          amountPaid: form.elements.amountPaid.value,
          paymentReference: form.elements.paymentReference.value,
          paymentNotes: form.elements.paymentNotes.value,
          paymentProof: {
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            dataUrl,
          },
        }),
      });
      toast("Servicio aceptado y venta registrada.");
      closeModal();
      await navigate("dashboard");
    } catch (error) {
      $("[data-form-error]", form).textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function openPaymentProofModal(id) {
  const quote = state.quotes.find((item) => item.id === id);
  const proof = quote?.paymentProof;
  if (!proof) {
    toast("Esta cotización aún no tiene comprobante.", "error");
    return;
  }
  const preview = proof.mimeType?.startsWith("image/")
    ? `<img class="payment-proof-preview" src="${proof.dataUrl}" alt="Comprobante de pago" />`
    : `<iframe class="payment-proof-frame" src="${proof.dataUrl}" title="Comprobante PDF"></iframe>`;
  openModal(`Comprobante ${quote.number}`, `
    <div class="payment-proof-modal">
      <div class="payment-proof-meta">
        <span>Monto pagado</span><strong>${money(quote.amountPaid || quote.totals?.total)}</strong>
        <span>Referencia</span><strong>${escapeHtml(quote.paymentReference || "Sin referencia")}</strong>
        <span>Archivo</span><strong>${escapeHtml(proof.fileName)}</strong>
      </div>
      ${preview}
      <div class="form-footer">
        <a class="button button-secondary" href="${proof.dataUrl}" download="${escapeHtml(proof.fileName)}">Descargar comprobante</a>
        <button class="button button-primary" data-close-form>Cerrar</button>
      </div>
    </div>
  `, { wide: true, eyebrow: "Ventas" });
  $("[data-close-form]").addEventListener("click", closeModal);
}

function pending(value) {
  return value ? value : "Pendiente";
}

function formatDocumentDate(value) {
  if (!value) return "Pendiente";
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(safeValue);
  if (Number.isNaN(date.valueOf())) return value;
  const formatted = new Intl.DateTimeFormat("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatPosterDate(value) {
  if (!value) return "Pendiente";
  const safeValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(safeValue);
  if (Number.isNaN(date.valueOf())) return value;
  const formatted = new Intl.DateTimeFormat("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function cleanVehicleLabel(label) {
  return String(label || "Mercedes Benz Sprinter").replace(/\s*,\s*\d+$/, "");
}

function quoteVehicleNumber(quote, vehicle) {
  const fleetCount = Array.isArray(quote.vehicleIds) ? quote.vehicleIds.length : quote.vehicleId ? 1 : 0;
  const manualCount = quote.vehicleManualName ? 1 : 0;
  if (Number(quote.vehicleCount || 0) > 1) return Number(quote.vehicleCount);
  if (fleetCount + manualCount > 1) return fleetCount + manualCount;
  return vehicle?.unitNumber || 1;
}

function quoteRegularPrice(quote) {
  const total = Number(quote.totals?.total || 0);
  const discount = Number(quote.totals?.discount || 0);
  return total + discount;
}

function quoteTaxLabel(quote) {
  return Number(quote.totals?.taxPercent || 0) > 0 ? "PRECIO INCLUYE IVA" : "PRECIO NO INCLUYE IVA";
}

function quoteServiceText(quote) {
  const selections = quoteServiceSelections(quote);
  if (selections.length > 1) {
    return selections.map((item) => `${item.label} en ${item.destination}`).join(" / ");
  }
  if (quote.serviceType && quote.destinationRateName) {
    return `${quote.serviceType} en ${quote.destinationRateName}.`;
  }
  return quote.serviceType || quote.notes || "Servicio personalizado.";
}

function formatLuggageDescription(value) {
  return String(value || "")
    .replace(/\s*,?\s+y\s+(?=\d+(?:[.,]\d+)?\b)/giu, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function quoteLuggageText(quote) {
  if (quote.hasLuggage === false) return "No";
  const quantity = Math.max(0, Math.round(Number(quote.luggage || 0)));
  const description = formatLuggageDescription(quote.luggageDescription);
  if (description) {
    return quantity > 0 && !/^\s*\d+(?:[.,]\d+)?\b/u.test(description)
      ? `${quantity} ${description}`
      : description;
  }
  if (quantity > 0) return `${quantity} piezas`;
  return "Pendiente";
}

function quoteEndDate(quote) {
  return quote.serviceEndDate || quote.returnDate || quote.serviceDate;
}

function quoteSelectedFare(quote) {
  return Number(quote.fixedFare || quote.totals?.fixedFare || quote.totals?.total || 0);
}

function quoteVehicleCountForPrice(quote) {
  return explicitVehicleCount(quote);
}

function quoteFixedFareIsTotal(quote) {
  return quote.priceDisplayMode === "final" || quote.fixedFareIsTotal === true || quote.fixedFareIsTotal === "true";
}

function quoteTaxBreakdown(quote) {
  const totals = quote.totals || {};
  const selections = quoteServiceSelections(quote);
  const hasDetailedTransfers = quote.priceDisplayMode !== "final" && selections.length > 0;
  if (hasDetailedTransfers) {
    const vehicleCount = quoteVehicleCountForPrice(quote);
    const subtotal = selections.reduce(
      (sum, item) => sum + Math.max(0, Number(item.amount || 0)),
      0,
    ) * vehicleCount;
    const discountAmount = Math.max(0, Number(quote.discountAmount || 0));
    const discountPercent = Math.max(0, Number(quote.discountPercent || 0));
    const configuredDiscount = discountAmount || discountPercent
      ? discountAmount + subtotal * (discountPercent / 100)
      : Math.max(0, Number(totals.discount || 0));
    const discount = Math.min(subtotal, configuredDiscount);
    const journey = subtotal - discount;
    const taxPercent = quote.includeTax === true
      ? Math.max(0, Number(totals.taxPercent || state.rates.taxPercent || 0))
      : 0;
    const tax = Math.round(journey * (taxPercent / 100) * 100) / 100;
    const total = Math.round((journey + tax) * 100) / 100;
    return {
      subtotal,
      discount,
      journey,
      taxPercent,
      tax,
      total,
      includesTax: taxPercent > 0,
    };
  }
  const discount = Number(totals.discount ?? quote.discountAmount ?? 0);
  const storedJourney = Number(totals.subtotal);
  const subtotal = Number(
    totals.subtotalBeforeDiscount ??
      (Number.isFinite(storedJourney) ? storedJourney + discount : totals.baseFare ?? quoteSelectedFare(quote)),
  );
  const journey = Number.isFinite(storedJourney)
    ? storedJourney
    : Math.max(0, subtotal - discount);
  const tax = Number(totals.tax || 0);
  const total = Number(totals.total || journey + tax);
  const taxPercent = Number(totals.taxPercent || 0);
  const includesTax = quote.includeTax === true || taxPercent > 0;
  return { subtotal, discount, journey, taxPercent, tax, total, includesTax };
}

function quotePosterFinancialRows(totals) {
  const hasAdjustments = totals.discount > 0 || totals.includesTax;
  return `
    <div class="poster-price-summary-row">
      <span>Total del servicio</span>
      <strong>${escapeHtml(posterMoney(totals.subtotal))}</strong>
    </div>
    ${totals.discount > 0
      ? `<div class="poster-price-summary-row poster-price-discount"><span>Descuento</span><strong>-${escapeHtml(posterMoney(totals.discount))}</strong></div>`
      : ""}
    ${totals.includesTax
      ? `<div class="poster-price-summary-row"><span>IVA ${escapeHtml(totals.taxPercent || 12)}%</span><strong>${escapeHtml(posterMoney(totals.tax))}</strong></div>`
      : ""}
    ${hasAdjustments
      ? `<div class="poster-price-summary-row poster-price-total"><span>Total</span><strong>${escapeHtml(posterMoney(totals.total))}</strong></div>`
      : ""}
  `;
}

function quotePriceCard(quote) {
  const fare = quoteSelectedFare(quote);
  const vehicleCount = quoteVehicleCountForPrice(quote);
  const totalFare = fare * vehicleCount;
  const selections = quoteServiceSelections(quote);
  const oneWayAmount = quote.serviceRateType === "roundTrip" ? totalFare / 2 : totalFare;
  const breakdown = quoteTaxBreakdown(quote);
  const taxLine = `
    <section class="quote-tax-note" style="width:92mm;margin:3mm auto 0;border:1px solid #d7aa56;border-radius:2mm;background:#fff;padding:2mm 4mm;color:#111;text-align:center;font-size:3.4mm;font-weight:900;text-transform:uppercase;line-height:1.45">
      ${selections.length > 1 ? `<div>${selections.map((item) => `${escapeHtml(item.label)} ${money(item.amount)}`).join(" · ")}</div>` : ""}
      ${vehicleCount > 1 ? `<div>${vehicleCount} Mercedes seleccionadas · ${money(fare)} c/u</div>` : ""}
      ${breakdown.discount ? `<div>Descuento -${money(breakdown.discount)}</div>` : ""}
      <div>${money(breakdown.journey)}</div>
      <div>+ IVA ${money(breakdown.tax)}</div>
      <div>Total ${money(breakdown.total)}</div>
    </section>
  `;
  if (selections.length > 1) {
    return `
      <section class="quote-price-card quote-price-card-single" style="grid-template-columns:1fr">
        <div><span>Servicios seleccionados</span><strong>${money(totalFare)}</strong></div>
      </section>
      ${taxLine}
    `;
  }
  if (quote.serviceRateType === "internal") {
    return `
      <section class="quote-price-card quote-price-card-two" style="grid-template-columns:1fr 1fr">
        <div><span>Traslados internos</span><strong>${money(totalFare)}</strong></div>
        <div><span>Día completo</span><strong>${money(totalFare)}</strong></div>
      </section>
      ${taxLine}
    `;
  }
  if (quote.serviceRateType === "oneWay") {
    return `
      <section class="quote-price-card quote-price-card-single" style="grid-template-columns:1fr">
        <div><span>Viaje ida</span><strong>${money(totalFare)}</strong></div>
      </section>
      ${taxLine}
    `;
  }
  return `
    <section class="quote-price-card quote-price-card-two" style="grid-template-columns:1fr 1fr">
      <div><span>Viaje ida</span><strong>${money(oneWayAmount)}</strong></div>
      <div><span>Viaje vuelta</span><strong>${money(oneWayAmount)}</strong></div>
    </section>
    ${taxLine}
  `;
}

function quoteInfoItem(icon, label, primary, secondary = "") {
  return `
    <div class="quote-info-item">
      <b>${escapeHtml(icon)}</b>
      <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(primary || "Pendiente")}</strong>${secondary ? `<small>${escapeHtml(secondary)}</small>` : ""}</div>
    </div>
  `;
}

function quoteFeature(icon, label, detail = "") {
  return `
    <div class="quote-feature">
      <b>${escapeHtml(icon)}</b>
      <span>${escapeHtml(label)}</span>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </div>
  `;
}

function quotePosterPrice(quote) {
  const fare = quoteSelectedFare(quote);
  const vehicleCount = quoteVehicleCountForPrice(quote);
  const totalFare = quoteFixedFareIsTotal(quote) ? fare : fare * vehicleCount;
  const selections = quoteServiceSelections(quote);
  const breakdown = quoteTaxBreakdown(quote);
  const oneWayAmount = quote.serviceRateType === "roundTrip" ? totalFare / 2 : totalFare;
  const detail = [
    selections.length > 1 ? selections.map((item) => `${item.label} ${money(item.amount)}`).join(" · ") : "",
    vehicleCount > 1 ? `${vehicleCount} vehículos · ${money(fare)} c/u` : "",
    breakdown.discount ? `Descuento -${money(breakdown.discount)}` : "",
  ].filter(Boolean);
  const taxDetail = Number(quote.totals?.taxPercent || 0) > 0
    ? `+ IVA ${money(breakdown.tax)} · Total ${money(breakdown.total)}`
    : quoteTaxLabel(quote);

  if (selections.length > 1) {
    return {
      leftLabel: "Servicios seleccionados",
      leftAmount: money(totalFare),
      rightLabel: "Total cotizado",
      rightAmount: money(breakdown.total),
      detail,
      taxDetail,
    };
  }
  if (quote.serviceRateType === "internal") {
    return {
      leftLabel: "Traslados internos",
      leftAmount: money(totalFare),
      rightLabel: "Día completo",
      rightAmount: money(totalFare),
      detail,
      taxDetail,
    };
  }
  if (quote.serviceRateType === "oneWay") {
    return {
      leftLabel: "Viaje ida",
      leftAmount: money(totalFare),
      rightLabel: "Total",
      rightAmount: money(breakdown.total),
      detail,
      taxDetail,
    };
  }
  return {
    leftLabel: "Viaje ida",
    leftAmount: money(oneWayAmount),
    rightLabel: "Viaje vuelta",
    rightAmount: money(oneWayAmount),
    detail,
    taxDetail,
  };
}

function posterShortText(value, fallback = "Pendiente") {
  return String(value || fallback).trim();
}

function orderedQuoteServices(quote) {
  return [...quoteServiceSelections(quote)].sort((a, b) => {
    const dateOrder = String(a.serviceDate || "9999-12-31").localeCompare(String(b.serviceDate || "9999-12-31"));
    return dateOrder || Number(a.legNumber || 0) - Number(b.legNumber || 0);
  });
}

function latestQuoteServiceDate(selections) {
  return selections
    .flatMap((item) => [item.serviceDate, item.returnDate])
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")))
    .sort()
    .at(-1) || "";
}

function quotePosterPrimaryService(quote) {
  const selections = orderedQuoteServices(quote);
  const first = selections[0] || {};
  const last = selections.at(-1) || first;
  const finalDate = selections.length > 1
    ? latestQuoteServiceDate(selections)
    : first.returnDate || first.serviceDate;
  return {
    serviceDate: first.serviceDate || quote.serviceStartDate || quote.serviceDate,
    returnDate: finalDate || quoteEndDate(quote),
    origin: quote.origin || first.origin,
    destination: quote.destination || first.destinationAddress || first.destination,
    departureTime: quote.departureTime || first.departureTime,
    returnTime: quote.returnTime || last.returnTime ||
      (selections.length > 1 ? last.departureTime : first.returnTime),
    passengers: quote.passengers || first.passengers || 1,
    passengerDescription: quote.passengerDescription || "",
    luggageDescription: quote.hasLuggage === false || first.hasLuggage === false
      ? "No"
      : quoteLuggageText(quote) || formatLuggageDescription(first.luggageDescription),
  };
}

function posterLuggageDensity(value) {
  const length = String(value || "").trim().length;
  if (length > 42) return "poster-luggage-dense";
  if (length > 24) return "poster-luggage-compact";
  return "";
}

function posterCompactDate(value) {
  if (!value) return "Pendiente";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return formatDate(value, { short: true });
}

function posterServiceDateRange(item) {
  const start = item.serviceDate;
  const end = item.returnDate && (!start || item.returnDate >= start) ? item.returnDate : start;
  if (!start) return posterCompactDate(end);
  if (!end || end === start) return posterCompactDate(start);
  return `${posterCompactDate(start)} al ${posterCompactDate(end)}`;
}

function quotePosterServiceLines(quote) {
  const selections = orderedQuoteServices(quote);
  if (!selections.length) return [{ label: `1. Traslado 1 · ${quoteServiceText(quote)}`, amount: quoteSelectedFare(quote) }];
  return selections.map((item, index) => {
    const genericDestination = /^(?:Destino|Traslado) \d+$/i.test(String(item.destination || "").trim());
    const destination = genericDestination
      ? item.destinationAddress || item.destination
      : item.destination || item.destinationAddress;
    return {
      label: `${index + 1}. Traslado ${index + 1} · ${posterServiceDateRange(item)}${destination ? ` · ${destination}` : ""}${item.departureTime ? ` · Salida ${formatTime12(item.departureTime)}` : ""}`,
      amount: quote.priceDisplayMode === "final" ? null : Number(item.amount || 0) * quoteVehicleCountForPrice(quote),
    };
  });
}

function quotePosterServicesHtml(quote) {
  const lines = quotePosterServiceLines(quote);
  const totals = quoteTaxBreakdown(quote);
  const useColumns = lines.length > 5;
  const midpoint = Math.ceil(lines.length / 2);
  const columns = useColumns ? [lines.slice(0, midpoint), lines.slice(midpoint)] : [lines];
  const row = (item) => `
    <div class="poster-service-price-row">
      <span>${escapeHtml(item.label)}</span>
      ${item.amount === null ? "" : `<strong>${escapeHtml(posterMoney(item.amount))}</strong>`}
    </div>
  `;
  return `
    <section class="poster-service-price-box ${useColumns ? "poster-service-price-box-columns" : ""} ${lines.length > 12 ? "poster-service-price-box-dense" : ""}">
      <header>
        <span>Detalle del servicio</span>
        <small>${lines.length} traslado${lines.length === 1 ? "" : "s"}</small>
      </header>
      <div class="poster-service-price-columns">
        ${columns.map((column) => `<div class="poster-service-price-list">${column.map(row).join("")}</div>`).join("")}
      </div>
      ${totals.includesTax ? "" : '<div class="poster-service-tax-note">NOTA: Esta cotización no incluye IVA</div>'}
      <footer class="poster-price-breakdown">
        ${quotePosterFinancialRows(totals)}
      </footer>
    </section>
  `;
}

function quotePosterNoteEntries(quote) {
  const entries = [];
  if (String(quote.notes || "").trim()) {
    entries.push({ label: "Nota general", text: String(quote.notes).trim() });
  }
  orderedQuoteServices(quote).forEach((item, index) => {
    if (!String(item.notes || "").trim()) return;
    entries.push({
      label: `Traslado ${index + 1}`,
      text: String(item.notes).trim(),
    });
  });
  return entries;
}

function quotePosterNotesHtml(quote) {
  const notes = quotePosterNoteEntries(quote);
  if (!notes.length) return "";
  return `
    <aside class="poster-quote-notes">
      <strong>Notas del servicio</strong>
      <div>
        ${notes
          .map(
            (note) => `
              <p><b>${escapeHtml(note.label)}:</b> ${escapeHtml(note.text)}</p>
            `,
          )
          .join("")}
      </div>
    </aside>
  `;
}

function quotePosterContinuationHtml(quote, options = {}) {
  const selections = orderedQuoteServices(quote);
  const hasServiceNotes = selections.some((item) => item.notes);
  if (!options.force && selections.length < 2 && !hasServiceNotes && !quote.notes) return "";

  return `
    <section class="poster-continuation" data-client-name="${escapeHtml(quote.clientName || "")}">
      <header class="poster-continuation-header">
        <div><span>Luxury Travel Guatemala</span><h2>Itinerario del recorrido</h2></div>
        <strong>${selections.length} traslado${selections.length === 1 ? "" : "s"}</strong>
      </header>
      <div class="poster-route-list">
        ${selections
          .map(
            (item, index) => `
              <article class="poster-route-card">
                <div class="poster-route-number">${String(index + 1).padStart(2, "0")}</div>
                <div class="poster-route-content">
                  <div class="poster-route-heading">
                    <div>
                      <span>Traslado ${index + 1}</span>
                      <h3>${escapeHtml(item.destination || item.destinationAddress || "Descripción pendiente")}</h3>
                    </div>
                  </div>
                  <div class="poster-route-meta">
                    <span><b>Fecha</b>${escapeHtml(formatDocumentDate(item.serviceDate))}</span>
                    ${item.departureTime ? `<span><b>Hora de salida</b>${escapeHtml(formatTime12(item.departureTime))}</span>` : ""}
                    <span><b>Equipaje</b>${escapeHtml(item.hasLuggage === false ? "No" : quoteLuggageText(quote))}</span>
                  </div>
                  ${item.notes ? `<p><b>Notas:</b> ${escapeHtml(item.notes)}</p>` : ""}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      ${quote.notes ? `<aside class="poster-general-notes"><strong>Notas generales</strong><p>${escapeHtml(quote.notes)}</p></aside>` : ""}
      <footer>Viaja con <b>comodidad, exclusividad y seguridad.</b></footer>
    </section>
  `;
}

function quotePosterVehicleHtml(quote) {
  const vehicles = quoteDisplayVehicles(quote);
  const manualVehicleOnly = Boolean(String(quote.vehicleManualName || "").trim()) && !quoteVehicleIds(quote).length;
  return `
    ${manualVehicleOnly ? '<div class="poster-manual-vehicle-mask" aria-hidden="true"></div>' : ""}
    <div class="poster-vehicle-value">
      <b>${escapeHtml(vehicles.count)}</b>
      <div class="poster-vehicle-copy">
        <strong>${escapeHtml(vehicles.primary)}</strong>
        <span>Área ejecutiva</span>
      </div>
    </div>
  `;
}

function quotePosterFeatureIcon(type) {
  const icons = {
    seats: '<circle cx="17" cy="8" r="3"/><path d="M14 14v11h15v-5H19v-6zM10 29h23M17 25v4M29 25v4"/>',
    air: '<path d="M24 4v40M9 12l30 24M39 12 9 36M18 8l6 6 6-6M18 40l6-6 6 6M7 19l8 2-2-8M41 29l-8-2 2 8M7 29l8-2-2 8M41 19l-8 2 2-8"/>',
    wifi: '<path d="M7 20c10-9 24-9 34 0M13 27c7-6 15-6 22 0M19 34c3-3 7-3 10 0"/><circle cx="24" cy="40" r="2"/>',
    usb: '<path d="M17 31 31 17M28 14l6-6M32 18l6-6M14 28l6 6-5 5-6-6zM31 17l4 4"/>',
    playstation: '<path d="M14 19h20c5 0 8 5 7 10l-2 8c-1 4-6 5-8 2l-4-5h-6l-4 5c-2 3-7 2-8-2l-2-8c-1-5 2-10 7-10zM15 26v8M11 30h8M31 27h.1M36 32h.1"/>',
    tv: '<rect x="7" y="10" width="34" height="25" rx="1"/><path d="M18 41h12M24 35v6"/>',
    bed: '<path d="M7 34V15M7 29h34v8M12 22h8c3 0 5 2 5 5v2H12zM25 20h9c4 0 7 3 7 7v2H25zM11 37v4M38 37v4"/>',
    luxury: '<path d="M14 18v17h20V18c0-5-4-9-10-9s-10 4-10 9zM10 25h4M34 25h4M10 25v12h28V25M14 35v6M34 35v6M39 8v8M35 12h8"/>',
    driver: '<circle cx="24" cy="17" r="6"/><path d="M13 42v-7c0-6 5-11 11-11s11 5 11 11v7M14 11h20l-4-5H18zM19 28l5 6 5-6"/>',
    fuel: '<rect x="10" y="7" width="21" height="34" rx="2"/><path d="M14 12h13v9H14zM31 15h5l4 5v15c0 4-6 4-6 0v-8M14 34h13"/>',
    luggage: '<rect x="10" y="15" width="28" height="27" rx="3"/><path d="M18 15v-5h12v5M17 21v15M31 21v15M8 24h2M38 24h2"/>',
    beverage: '<path d="M14 17h21l-3 25H17zM19 17l4-8h11M27 9l5 8M18 25h14"/>',
  };
  return `<svg class="poster-feature-icon" viewBox="0 0 48 48" aria-hidden="true">${icons[type] || ""}</svg>`;
}

function quotePosterFeatureItem([type, label]) {
  return `<div class="poster-feature-item">${quotePosterFeatureIcon(type)}<span>${escapeHtml(label)}</span></div>`;
}

function quotePosterAmenitiesHtml(quote) {
  const vehicleItems = [
    ["seats", "Asientos de lujo"],
    ["air", "Aire acondicionado"],
    ["wifi", "Wifi"],
    ["usb", "Puestos USB"],
  ];
  if (quote.hasPlayStation5) vehicleItems.push(["playstation", "PlayStation 5"]);
  if (quote.hasTv) vehicleItems.push(["tv", "TV"]);
  if (quote.hasBed) vehicleItems.push(["bed", "Cama"]);
  if (quote.seatConfiguration === "luxury" || quote.hasSuperLuxurySeats) vehicleItems.push(["luxury", "Butacas de lujo"]);
  if (quote.seatConfiguration === "m1") vehicleItems.push(["luxury", "Butacas M1"]);
  if (quote.seatConfiguration === "m3") vehicleItems.push(["luxury", "Sillones M3"]);

  const includedItems = [
    ["driver", "Piloto profesional"],
    ["fuel", "Combustible"],
    ["luggage", "Viáticos del piloto"],
    ["beverage", "Bebidas de cortesía"],
  ];

  return `
    <div class="poster-feature-grid poster-vehicle-features poster-feature-count-${vehicleItems.length}" style="--feature-count:${vehicleItems.length}">
      ${vehicleItems.map(quotePosterFeatureItem).join("")}
    </div>
    <div class="poster-feature-grid poster-included-features" style="--feature-count:${includedItems.length}">
      ${includedItems.map(quotePosterFeatureItem).join("")}
    </div>
  `;
}

function quotePosterServicePriceHtml(quote) {
  const price = quotePosterPrice(quote);
  const selections = quoteServiceSelections(quote);
  if (selections.length > 1) {
    return `
      <section class="poster-price-band poster-price-list">
        <div class="poster-price-list-items">
          ${selections
            .map(
              (item) => `
                <article>
                  <span>${escapeHtml(item.label)}</span>
                  <small>${escapeHtml(item.destination)}</small>
                  <strong>${escapeHtml(money(Number(item.amount || 0) * quoteVehicleCountForPrice(quote)))}</strong>
                </article>
              `,
            )
            .join("")}
        </div>
        <aside>
          <span>Total</span>
          <strong>${escapeHtml(price.rightAmount)}</strong>
        </aside>
      </section>
    `;
  }
  return `
    <section class="poster-price-band">
      <article>
        <b>&#8594;</b>
        <div>
          <span>${escapeHtml(price.leftLabel)}</span>
          <strong>${escapeHtml(price.leftAmount)}</strong>
        </div>
      </article>
      <i></i>
      <article>
        <b>&#8635;</b>
        <div>
          <span>${escapeHtml(price.rightLabel)}</span>
          <strong>${escapeHtml(price.rightAmount)}</strong>
        </div>
      </article>
    </section>
  `;
}

function quoteDisplayVehicles(quote) {
  const vehicles = quoteVehicleIds(quote)
    .map((vehicleId) => state.vehicles.find((item) => item.id === vehicleId))
    .filter(Boolean);
  const names = vehicles.map(vehicleDisplayName);
  if (quote.vehicleManualName) names.push(quote.vehicleManualName);
  if (quote.vehicleName && !names.length) names.push(quote.vehicleName);
  if (!names.length) names.push("Mercedes Benz Sprinter");
  const uniqueNames = [...new Set(names)];
  return {
    count: quoteVehicleCountForPrice(quote),
    primary: cleanVehicleLabel(uniqueNames[0]),
    all: uniqueNames,
  };
}

function quoteDocumentFact(code, label, value, detail = "") {
  return `
    <article class="lt-fact">
      <div class="lt-fact-icon">${escapeHtml(code)}</div>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "Pendiente")}</strong>
        ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
      </div>
    </article>
  `;
}

function quoteDocumentAmenity(code, label, detail = "") {
  return `
    <article class="lt-amenity">
      <div>${escapeHtml(code)}</div>
      <strong>${escapeHtml(label)}</strong>
      ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
    </article>
  `;
}

function posterIcon(type) {
  const icons = {
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 8h16M5 5h14v16H5z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2 4 2 4H6"/></svg>',
    users: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3 20a6 6 0 0112 0M13 20a5 5 0 018 0"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7V5a4 4 0 018 0v2M6 7h12l1 14H5z"/></svg>',
  };
  return icons[type] || icons.flag;
}

function quotePosterFact(icon, label, value) {
  return `
    <article class="poster-fact">
      <b>${posterIcon(icon)}</b>
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "Pendiente")}</strong>
      </div>
    </article>
  `;
}

function quotePosterPageHtml(quote) {
  const service = quotePosterPrimaryService(quote);
  const templateImage = `${assetUrl("quote-template-master-2x.png")}?v=5`;
  const passengerDescription = String(service.passengerDescription || "")
    .trim()
    .replace(/^\((.*)\)$/, "$1");
  return `
    <div class="quote-poster-content quote-poster-v2">
      <img class="quote-template-bg" src="${templateImage}" alt="">
      <div class="poster-template-clean-mask" aria-hidden="true"></div>
      <strong class="poster-client-name">${escapeHtml(quote.clientName || "Cliente")}</strong>
      <div class="poster-dynamic-value poster-start-date">${escapeHtml(formatPosterDate(service.serviceDate))}</div>
      ${service.departureTime ? `<div class="poster-dynamic-value poster-start-time">${escapeHtml(formatTime12(service.departureTime))}</div>` : ""}
      <div class="poster-dynamic-value poster-origin">${escapeHtml(service.origin || "Pendiente")}</div>
      <div class="poster-dynamic-value poster-destination">${escapeHtml(service.destination || "Pendiente")}</div>
      <div class="poster-dynamic-value poster-end-date"><span>${escapeHtml(formatPosterDate(service.returnDate))}</span></div>
      <div class="poster-dynamic-value poster-return-time"><span>${escapeHtml(service.returnTime ? formatTime12(service.returnTime) : "Pendiente")}</span></div>
      <div class="poster-dynamic-value poster-passengers"><strong>${escapeHtml(`${service.passengers || 1} pasajeros`)}</strong>${passengerDescription ? `<small>(${escapeHtml(passengerDescription)})</small>` : ""}</div>
      <div class="poster-dynamic-value poster-luggage ${posterLuggageDensity(service.luggageDescription)}"><span>Equipaje</span><strong>${escapeHtml(service.luggageDescription || "No")}</strong></div>
      <div class="poster-top-spacer" aria-hidden="true"></div>
      <section class="poster-adaptive-lower">
        ${quotePosterServicesHtml(quote)}
        ${quotePosterNotesHtml(quote)}
        <div class="poster-template-lower">
          <img class="quote-template-lower-bg" src="${templateImage}" alt="" aria-hidden="true">
          ${quotePosterVehicleHtml(quote)}
          ${quotePosterAmenitiesHtml(quote)}
          <footer class="poster-quote-footer">Viaja con <b>comodidad, exclusividad y seguridad.</b></footer>
        </div>
      </section>
    </div>
  `;
}

function quotePreviewRecord(body, totals) {
  return {
    ...body,
    id: "quote-live-preview",
    number: "Vista previa",
    createdAt: new Date().toISOString(),
    totals: {
      ...totals,
      taxPercent: body.includeTax ? state.rates.taxPercent : 0,
      subtotalBeforeDiscount: totals.baseFare,
    },
  };
}

function renderQuoteLivePreview(form, body, totals) {
  const target = $("[data-quote-live-preview]", form);
  if (!target) return;
  target.innerHTML = quotePosterPageHtml(quotePreviewRecord(body, totals));
}

async function saveQuotePreviewImage(form) {
  updateQuoteSummary(form);
  const page = $("[data-quote-live-preview] .quote-poster-content", form);
  if (!page) return;
  const client = String(form.elements.clientName.value || "Borrador").trim();
  await downloadDocumentImage(`Cotizacion-Luxury-${client}`, "png", {
    pageElement: page,
    style: quoteDocumentStyles(),
    fileSuffix: "01-Cotizacion",
  });
}

function downloadQuotePdf(id) {
  const quote = state.quotes.find((item) => item.id === id);
  if (!quote) return;
  openPremiumDocument(
    quote.number,
    "quote",
    quotePosterPageHtml(quote),
  );
}

function openRouteItineraryDocument(quote) {
  const quoteReference = String(quote.number || "")
    .match(/Coti-Luxury-\d{4}/i)?.[0] || quote.number || "Cotizacion";
  const title = `Itinerario del Recorrido-${quote.clientName || "Cliente"}-${quoteReference}`;
  openPremiumDocument(
    title,
    "route",
    quotePosterContinuationHtml(quote, { force: true }),
  );
}

function openItineraryModal(quoteId) {
  const quote = state.quotes.find((item) => item.id === quoteId);
  if (!quote) return;
  openModal("Generar itinerarios", `
    <form id="itinerary-form">
      <p class="muted itinerary-linked-quote">Documentos vinculados a <strong>${escapeHtml(quote.number)}</strong> para <strong>${escapeHtml(quote.clientName)}</strong>.</p>
      <div class="itinerary-type-grid" role="radiogroup" aria-label="Tipo de itinerario">
        <label class="itinerary-type-option active" data-itinerary-type-option>
          <input type="radio" name="type" value="cliente" checked />
          <span class="itinerary-type-badge">CL</span>
          <span class="itinerary-type-copy">
            <small>Cliente</small>
            <b>Itinerario del recorrido</b>
            <em>Usa automáticamente los traslados de la cotización y podrá editarse antes de guardarlo.</em>
          </span>
        </label>
        <label class="itinerary-type-option" data-itinerary-type-option>
          <input type="radio" name="type" value="piloto" />
          <span class="itinerary-type-badge">PI</span>
          <span class="itinerary-type-copy">
            <small>Piloto</small>
            <b>Itinerario para piloto</b>
            <em>Permite agregar instrucciones operativas y datos de contacto para el piloto.</em>
          </span>
        </label>
      </div>
      <section class="itinerary-client-panel" data-itinerary-client-panel>
        <span>Listo para generar</span>
        <strong>Itinerario del recorrido</strong>
        <p>Se abrirá con todos sus campos editables. Al guardarlo podrá elegir la carpeta de destino.</p>
      </section>
      <div class="form-grid itinerary-pilot-fields" data-itinerary-pilot-fields hidden>
        <label class="full">Recorrido o instrucciones<textarea name="instructions" placeholder="Escriba una actividad por línea para crear el recorrido del piloto.">${escapeHtml(quote.notes)}</textarea></label>
        <label class="full">Notas de contacto<textarea name="contactNotes" placeholder="Contacto alterno, indicaciones de acceso, letrero de bienvenida..."></textarea></label>
      </div>
      <p class="form-error" data-form-error></p>
      <div class="form-footer"><button type="button" class="button button-secondary" data-close-form>Cancelar</button><button class="button button-primary" type="submit" data-generate-itinerary>Abrir itinerario del recorrido</button></div>
    </form>
  `);
  $("[data-close-form]").addEventListener("click", closeModal);
  const itineraryForm = $("#itinerary-form");
  const syncItineraryType = () => {
    const isClient = itineraryForm.elements.type.value === "cliente";
    $$('[data-itinerary-type-option]', itineraryForm).forEach((option) => {
      option.classList.toggle("active", option.querySelector("input").checked);
    });
    $("[data-itinerary-client-panel]", itineraryForm).hidden = !isClient;
    $("[data-itinerary-pilot-fields]", itineraryForm).hidden = isClient;
    $("[data-generate-itinerary]", itineraryForm).textContent = isClient
      ? "Abrir itinerario del recorrido"
      : "Generar itinerario para piloto";
  };
  $$('input[name="type"]', itineraryForm).forEach((input) => {
    input.addEventListener("change", syncItineraryType);
  });
  syncItineraryType();
  itineraryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const body = Object.fromEntries(new FormData(form));
      if (body.type === "cliente") {
        closeModal();
        openRouteItineraryDocument(quote);
        return;
      }
      const item = await api(`/api/quotes/${quoteId}/itineraries`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast(`${item.number} generado.`);
      closeModal();
      await navigate("driverItineraries");
    } catch (error) {
      $("[data-form-error]", form).textContent = error.message;
    }
  });
}

function documentFact(label, primary, secondary = "") {
  return `<div class="document-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(primary || "Por definir")}</strong>${secondary ? `<small>${escapeHtml(secondary)}</small>` : ""}</div>`;
}

function itinerarySteps(item) {
  const custom = String(item.instructions || "")
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (custom.length) return custom;
  return [
    `Salida de ${item.origin} · ${item.departureTime || "hora por definir"}`,
    `Llegada a ${item.destination} · ${item.arrivalTime || "hora estimada"}`,
    item.returnTime ? `Hora de regreso · ${item.returnTime}` : "",
    `Finalización en ${item.endLocation || item.destination}`,
  ].filter(Boolean);
}

function printItinerary(id) {
  const item = state.itineraries.find((record) => record.id === id);
  if (!item) return;
  const steps = itinerarySteps(item);
  const isDriver = item.type === "piloto";
  const amenities = [
    "Piloto privado",
    "Aire acondicionado",
    "WiFi",
    "Combustible",
    item.seatConfiguration === "luxury" || item.hasSuperLuxurySeats
      ? "Butacas de lujo"
      : item.seatConfiguration === "m1"
        ? "Butacas M1"
        : item.seatConfiguration === "m3"
          ? "Sillones M3"
          : "Butacas cómodas",
    item.hasBed ? "Cama instalada" : "",
    item.hasPlayStation5 ? "PlayStation 5" : "",
    item.hasTv ? "TV" : "",
  ].filter(Boolean);

  const clientContent = `
    <section class="itinerary-title"><h1>Itinerario</h1><span>${escapeHtml(item.number)} · Cliente VIP</span></section>
    <section class="itinerary-columns">
      <div class="detail-list">
        ${itineraryDetail("Cliente", item.clientName)}
        ${item.clientNit ? itineraryDetail("NIT", item.clientNit) : ""}
        ${itineraryDetail("Fecha del viaje", formatDate(item.serviceDate))}
        ${itineraryDetail("Hora de llegada", item.arrivalTime || item.departureTime)}
        ${itineraryDetail("Lugar de salida", item.origin)}
        ${itineraryDetail("Lugar de destino", item.destination)}
        ${itineraryDetail("Lugar de finalización", item.endLocation || item.destination)}
        ${itineraryDetail("Cantidad de pasajeros", `${item.passengers} pasajeros`)}
        ${itineraryDetail("Vehículo asignado", item.vehicleName || "Por confirmar")}
        ${itineraryDetail("Piloto asignado", item.driverName || "Por confirmar")}
      </div>
      ${vehicleDocumentCard(item, amenities)}
    </section>
  `;

  const driverContent = `
    <section class="itinerary-title"><h1>Itinerario piloto</h1><span>${escapeHtml(item.number)} · Uso interno</span></section>
    <section class="itinerary-columns">
      <div class="driver-timeline">
        ${steps.map((step, index) => `<div><b>${index + 1}</b><span>${escapeHtml(step)}</span></div>`).join("")}
        ${itineraryDetail("Piloto asignado", item.driverName || "Por asignar")}
        ${itineraryDetail("Vehículo asignado", item.vehicleName || "Por asignar")}
        ${itineraryDetail("Cliente / contacto", `${item.clientName}${item.clientNit ? ` · NIT ${item.clientNit}` : ""} · ${item.clientPhone || "Sin teléfono"}`)}
      </div>
      ${vehicleDocumentCard(item, ["Recorrido del día", ...steps])}
    </section>
  `;

  openPremiumDocument(
    item.number,
    isDriver ? "driver" : "client",
    isDriver ? driverContent : clientContent,
  );
}

function itineraryDetail(label, value) {
  return `<div class="itinerary-detail"><i></i><div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || "Por definir")}</strong></div></div>`;
}

function vehicleDocumentCard(item, features) {
  return `
    <aside class="vehicle-card">
      <span class="vehicle-card-label">Vehículo asignado</span>
      <h2>${escapeHtml(item.vehicleName || "Mercedes Benz Sprinter")}</h2>
      <div class="vehicle-silhouette">MERCEDES<br>BENZ</div>
      <div class="vehicle-features">
        ${features.map((feature, index) => `<div><b>${String(index + 1).padStart(2, "0")}</b><span>${escapeHtml(feature)}</span></div>`).join("")}
      </div>
    </aside>
  `;
}

function quoteDocumentStyles() {
  return `
    *,*::before,*::after{box-sizing:border-box}
    .sheet.sheet-quote{position:relative;align-self:start;justify-self:center;width:1023px;height:max-content;min-height:1537px;background:#fff;color:#080d17;font-family:Arial,sans-serif;box-shadow:0 0 30px #777;overflow:hidden}
    .sheet.sheet-route{position:relative;align-self:start;justify-self:center;width:1023px;height:max-content;min-height:720px;background:#f6f1e8;color:#080d17;font-family:Arial,sans-serif;box-shadow:0 0 30px #777;overflow:hidden}
    .sheet-route .poster-continuation{min-height:720px}
    .quote-poster-content{position:relative;inset:auto;width:1023px;min-height:1537px;background:#fff;font-family:Arial,sans-serif}
    .quote-template-bg{position:absolute;inset:0;z-index:0;display:block;width:1023px;height:1537px;object-fit:fill}
    .quote-poster-content>*:not(.quote-template-bg){z-index:2}
    .quote-poster-content>.poster-template-clean-mask{position:absolute;left:0;top:1004px;z-index:1;width:1023px;height:270px;background:#fff;pointer-events:none}
    .poster-top-spacer{position:relative;height:1004px;pointer-events:none}
    .poster-adaptive-lower{position:relative;z-index:5;background:#fff;padding-top:0}
    .poster-client-name{position:absolute;left:45px;top:662px;width:545px;overflow:hidden;color:#bd8123;font-size:48px;font-weight:900;letter-spacing:.025em;line-height:1.08;text-transform:uppercase;white-space:nowrap;text-overflow:ellipsis}
    .poster-dynamic-value{position:absolute;display:flex;align-items:flex-start;justify-content:center;color:#111;font-size:18px;font-weight:600;line-height:1.15;text-align:center;text-wrap:balance}
    .poster-start-date{left:104px;top:817px;width:156px;height:94px}.poster-start-time{left:104px;top:956px;width:156px;height:45px;align-items:center}
    .poster-origin{left:282px;top:852px;width:188px;height:97px}.poster-destination{left:493px;top:852px;width:155px;height:94px}
    .poster-end-date{left:696px;top:846px;width:138px;height:78px}.poster-end-date>span,.poster-return-time>span{display:inline-block;width:max-content;max-width:100%;border-bottom:2px solid #d9ad57;padding:0 5px 7px}.poster-return-time{left:696px;top:949px;width:138px;height:68px}
    .poster-passengers{left:852px;top:842px;width:157px;height:76px;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center}.poster-passengers strong,.poster-passengers small{font-size:18px;line-height:1.12}.poster-passengers strong{font-weight:800}.poster-passengers small{display:block;margin-top:5px;color:#111;font-weight:600}.poster-luggage{left:852px;top:920px;width:157px;height:82px;display:flex;flex-direction:column;align-items:center;overflow:hidden;border-top:2px solid #d9ad57;padding:6px 3px 0;text-align:center}.poster-luggage span,.poster-luggage strong{font-size:16px;line-height:1.05}.poster-luggage span{flex:0 0 auto;font-weight:800;letter-spacing:0;text-transform:uppercase}.poster-luggage strong{display:block;max-width:100%;margin-top:3px;overflow-wrap:anywhere;font-weight:600;white-space:normal;text-wrap:balance}.poster-luggage-compact span{font-size:14px}.poster-luggage-compact strong{font-size:13px;line-height:1.02}.poster-luggage-dense span{font-size:12px}.poster-luggage-dense strong{font-size:10.5px;line-height:1}
    .poster-service-price-box{position:relative;width:calc(100% - 16px);min-height:274px;margin:0 8px;display:flex;flex-direction:column;border:2px solid #d1a044;border-radius:26px;background:linear-gradient(145deg,#02050c,#080d17);box-shadow:0 10px 25px rgba(0,0,0,.12);padding:18px 30px 16px;color:#fff;overflow:hidden}
    .poster-service-price-box>header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid rgba(213,166,72,.62);padding-bottom:10px;color:#dfb24e;text-transform:uppercase}.poster-service-price-box>header span,.poster-service-price-box>header small{font-size:18px;font-weight:900;letter-spacing:.1em}
    .poster-service-price-columns{display:grid;grid-template-columns:1fr;gap:26px;min-height:0;flex:1;padding:13px 0 11px}.poster-service-price-box-columns .poster-service-price-columns{grid-template-columns:repeat(2,minmax(0,1fr))}.poster-service-price-list{display:grid;align-content:center;gap:6px;min-width:0}.poster-service-price-box-columns .poster-service-price-list+ .poster-service-price-list{border-left:1px solid rgba(213,166,72,.38);padding-left:22px}
    .poster-service-price-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;min-width:0;color:#f8f8f6;font-size:15px;line-height:1.2}.poster-service-price-row span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.poster-service-price-row strong{color:#e2b348;font-size:18px;font-weight:900;white-space:nowrap}.poster-service-price-box-columns .poster-service-price-row{gap:9px;font-size:12px}.poster-service-price-box-columns .poster-service-price-row strong{font-size:16px}.poster-service-price-box-dense .poster-service-price-list{gap:3px}.poster-service-price-box-dense .poster-service-price-row{font-size:10px;line-height:1.08}.poster-service-price-box-dense .poster-service-price-row strong{font-size:13px;line-height:1.08}
    .poster-service-tax-note{border-top:1px solid rgba(213,166,72,.42);padding:9px 4px 7px;color:#fff;font-size:12px;font-weight:900;letter-spacing:.06em}.poster-price-breakdown{display:grid;width:540px;max-width:100%;margin-left:auto;border-top:1px solid rgba(213,166,72,.62);text-transform:uppercase}.poster-price-summary-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:28px;min-height:38px;border-bottom:1px solid rgba(213,166,72,.32);padding:7px 4px 7px 20px}.poster-price-summary-row span{color:#f5f5f3;font-size:12px;font-weight:900;letter-spacing:.1em}.poster-price-summary-row strong{color:#e5b64c;font-family:Georgia,serif;font-size:22px;line-height:1;white-space:nowrap}.poster-price-discount strong{color:#f0d48e}.poster-price-total{min-height:51px;border-bottom:0;padding-top:10px;padding-bottom:10px}.poster-price-total span{font-size:14px}.poster-price-total strong{font-size:32px}
    .poster-quote-notes{display:grid;grid-template-columns:150px minmax(0,1fr);gap:18px;margin:16px 48px;border-left:5px solid #c99532;background:#fff;padding:5px 0 5px 18px;color:#171717}.poster-quote-notes>strong{padding-top:2px;color:#9e6b1a;font-size:13px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}.poster-quote-notes>div{display:grid;gap:5px}.poster-quote-notes p{margin:0;font-size:13px;line-height:1.42}.poster-quote-notes b{color:#9e6b1a}
    .poster-template-lower{position:relative;height:293px;overflow:hidden;background:#fff}.quote-template-lower-bg{position:absolute;left:0;top:-1274px;z-index:0;display:block;width:1023px;height:1537px;object-fit:fill}
    .poster-manual-vehicle-mask{position:absolute;left:20px;top:14px;z-index:2;width:174px;height:135px;border-radius:0 0 0 20px;background:#fff}
    .poster-vehicle-value{position:absolute;left:197px;top:27px;z-index:3;height:119px;display:inline-grid;grid-template-columns:58px minmax(0,max-content);gap:10px;align-items:center;color:#111;text-transform:uppercase}
    .poster-vehicle-value>b{color:#bd8123;font-size:65px;line-height:1;text-align:center}.poster-vehicle-copy{max-width:132px;border-right:2px solid #d9ad57;padding-right:12px}.poster-vehicle-value strong,.poster-vehicle-value span{display:block}.poster-vehicle-value strong{font-size:16px;font-weight:900;line-height:1.04}.poster-vehicle-value span{margin-top:5px;font-size:13px;font-weight:800}
    .poster-feature-grid{position:absolute;z-index:3;display:grid;grid-template-columns:repeat(var(--feature-count),minmax(0,1fr));color:#bc7b19;text-transform:uppercase}
    .poster-vehicle-features{left:412px;top:49px;width:594px;height:94px}
    .poster-included-features{left:25px;top:181px;width:973px;height:64px}
    .poster-feature-item{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;border-left:1px solid #e1bc79;padding:1px 5px;text-align:center}
    .poster-feature-item:first-child{border-left:0}.poster-feature-icon{display:block;width:42px;height:42px;overflow:visible;fill:none;stroke:currentColor;stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round}
    .poster-feature-item span{display:block;margin-top:3px;color:#171717;font-size:10px;font-weight:900;line-height:1.05;text-wrap:balance}
    .poster-vehicle-features.poster-feature-count-5 .poster-feature-icon,.poster-vehicle-features.poster-feature-count-6 .poster-feature-icon{width:36px;height:36px}.poster-vehicle-features.poster-feature-count-5 .poster-feature-item span,.poster-vehicle-features.poster-feature-count-6 .poster-feature-item span{font-size:8.5px}
    .poster-vehicle-features.poster-feature-count-7 .poster-feature-icon,.poster-vehicle-features.poster-feature-count-8 .poster-feature-icon{width:30px;height:30px;stroke-width:3}.poster-vehicle-features.poster-feature-count-7 .poster-feature-item span,.poster-vehicle-features.poster-feature-count-8 .poster-feature-item span{font-size:7.5px;line-height:1}
    .poster-included-features .poster-feature-icon{width:36px;height:36px}.poster-included-features .poster-feature-item span{font-size:10px}
    .poster-quote-footer{position:absolute;left:0;top:245px;z-index:5;display:flex;width:1023px;height:48px;align-items:center;justify-content:center;border-bottom:3px solid #c99532;background:#020712;color:#fff;font-size:14px;font-weight:500;letter-spacing:.18em;text-align:center;text-transform:uppercase}.poster-quote-footer b{margin-left:7px;color:#dcae45}
    .poster-continuation{position:relative;z-index:4;display:grid;gap:24px;background:linear-gradient(180deg,#faf8f3,#f3eee4);padding:56px 54px 0;color:#111}
    .poster-continuation.is-editing{outline:4px solid #c99532;outline-offset:-4px}.poster-continuation.is-editing *{cursor:text}.poster-continuation.is-editing [contenteditable="true"]:focus{outline:2px dashed rgba(154,106,30,.7);outline-offset:3px}
    .poster-continuation-header{display:flex;align-items:end;justify-content:space-between;gap:24px;border-bottom:2px solid #c99532;padding-bottom:18px}.poster-continuation-header span{color:#ad7820;font-size:13px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.poster-continuation-header h2{margin:7px 0 0;font-family:Georgia,serif;font-size:38px;font-weight:500}.poster-continuation-header>strong{border:1px solid #c99532;border-radius:999px;padding:9px 15px;color:#9a6716;font-size:14px;text-transform:uppercase}
    .poster-route-list{display:grid;gap:16px}.poster-route-card{display:grid;grid-template-columns:64px minmax(0,1fr);gap:18px;border:1px solid #d7b46c;border-radius:18px;background:#fff;padding:20px;box-shadow:0 10px 30px rgba(25,22,15,.06)}.poster-route-number{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:#050a13;color:#dcae45;font-family:Georgia,serif;font-size:21px}.poster-route-content{min-width:0}.poster-route-heading{display:flex;align-items:start;justify-content:space-between;gap:18px}.poster-route-heading span{color:#a16d19;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.poster-route-heading h3{margin:5px 0 0;font-size:20px;line-height:1.25}.poster-route-heading h3 b{color:#c18b2c}.poster-route-heading>strong{color:#aa741b;font-family:Georgia,serif;font-size:23px;white-space:nowrap}.poster-route-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:16px;border-top:1px solid #ead8b4;padding-top:14px}.poster-route-meta span{color:#333;font-size:11px;line-height:1.35}.poster-route-meta b{display:block;margin-bottom:3px;color:#9a6a1e;font-size:9px;letter-spacing:.08em;text-transform:uppercase}.poster-route-content p{margin:14px 0 0;border-left:3px solid #c99532;background:#f8f2e7;padding:10px 12px;font-size:12px;line-height:1.45}
    .poster-general-notes{border:1px solid #d7b46c;border-radius:16px;background:#fff;padding:18px 20px}.poster-general-notes strong{color:#9a6a1e;font-size:12px;letter-spacing:.1em;text-transform:uppercase}.poster-general-notes p{margin:7px 0 0;font-size:13px;line-height:1.5}
    .poster-continuation footer{margin:0 -54px;background:#020712;padding:17px;color:#fff;font-size:14px;letter-spacing:.18em;text-align:center;text-transform:uppercase}.poster-continuation footer b{color:#dcae45}
  `;
}

function openPremiumDocument(title, type, content) {
  const hero = {
    client: "client-itinerary-hero.png",
    driver: "driver-itinerary-hero.png",
  }[type];
  const origin = `${window.location.origin}${APP_BASE_PATH}`;
  const sheetHtml =
    type === "quote"
      ? `<main class="sheet sheet-quote">${content}</main>`
      : type === "route"
        ? `<main class="sheet sheet-route">${content}</main>`
      : `<main class="sheet sheet-${type}"><header class="hero"><img src="${origin}/assets/${hero}" alt=""></header><div class="document-content">${content}</div><footer class="document-footer">Viaja con <b>comodidad, exclusividad y seguridad.</b></footer></main>`;
  const documentHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#d8d2c8;color:#0a101b;font-family:Arial,sans-serif}.sheet{width:210mm;min-height:297mm;margin:0 auto;background:#f8f3ea;overflow:hidden;box-shadow:0 0 30px #777}.hero{height:76mm;overflow:hidden;border-bottom:2mm solid #d3a63d}.hero img{display:block;width:100%;height:100%;object-fit:cover;object-position:center top}.document-content{padding:8mm 8mm 0}.document-title p{margin:0;color:#060b17;font-size:11mm;font-weight:800;letter-spacing:.02em;text-transform:uppercase}.document-title h1{margin:0;color:#a9761d;font-size:6.2mm;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.document-title>span,.itinerary-title>span{display:block;margin-top:2mm;color:#75664d;font-size:2.5mm;letter-spacing:.08em;text-transform:uppercase}.quote-facts{display:grid;grid-template-columns:1.1fr 1.2fr 1.2fr 1.2fr 1fr;gap:0;margin-top:6mm;border:1px solid #d3a63d;border-radius:5mm;background:#fff;overflow:hidden}.document-fact{min-height:31mm;padding:5mm 3.5mm;border-right:1px solid #dec58e}.document-fact:last-child{border:0}.document-fact span,.document-fact strong,.document-fact small{display:block}.document-fact span{color:#8b6827;font-size:2.4mm;font-weight:800;text-transform:uppercase}.document-fact strong{margin-top:2.2mm;font-size:3.3mm;line-height:1.35}.document-fact small{margin-top:1.5mm;color:#5f6466;font-size:2.7mm}.price-band{display:flex;align-items:center;justify-content:space-between;margin-top:5mm;border-radius:5mm;background:#030a19;color:white;padding:5mm 8mm}.price-band span{display:block;color:#d6aa4e;font-size:2.5mm;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.price-band strong{display:block;margin-top:1mm;color:#e0b454;font-family:Georgia,serif;font-size:8mm}.price-meta{display:flex;gap:6mm}.price-meta span{color:#fff;font-size:2.5mm;letter-spacing:0}.include-section{margin-top:5mm;border:1px solid #d3a63d;border-radius:5mm;background:#fff;padding:5mm}.include-section h2{width:42mm;margin:-8mm auto 4mm;border-radius:0 0 4mm 4mm;background:linear-gradient(90deg,#b67d1d,#efc96f,#b67d1d);padding:2mm;color:#111;text-align:center;font-size:4mm;letter-spacing:.12em;text-transform:uppercase}.amenity-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm}.amenity{min-height:17mm;border-right:1px dotted #d3a63d;text-align:center}.amenity:nth-child(5n){border:0}.amenity b{display:grid;place-items:center;width:8mm;height:8mm;margin:0 auto 2mm;border-radius:50%;background:#050c1a;color:#e0b454;font-size:2.4mm}.amenity span{font-size:2.4mm;font-weight:700;line-height:1.25;text-transform:uppercase}.document-notes{margin-top:4mm;border-left:1.5mm solid #d3a63d;background:#efe6d7;padding:3mm 4mm}.document-notes strong{color:#8b6827;font-size:2.5mm;text-transform:uppercase}.document-notes p{margin:1mm 0 0;font-size:2.5mm;line-height:1.4}.itinerary-title{margin-top:-1mm;text-align:center}.itinerary-title h1{margin:0;color:#8c641e;font-family:Georgia,serif;font-size:9mm;font-weight:500;letter-spacing:.07em;text-transform:uppercase}.itinerary-columns{display:grid;grid-template-columns:1.5fr .9fr;gap:7mm;margin-top:5mm}.detail-list{display:grid}.itinerary-detail{display:grid;grid-template-columns:8mm 1fr;gap:3mm;align-items:center;min-height:17mm;border-bottom:1px solid #caa45e;padding:2mm 0}.itinerary-detail i{display:block;width:7mm;height:7mm;border:1px solid #d3a63d;border-radius:50%;background:#050c1a;box-shadow:inset 0 0 0 2mm #050c1a}.itinerary-detail span,.itinerary-detail strong{display:block}.itinerary-detail span{color:#90691f;font-size:2.7mm;font-weight:800;text-transform:uppercase}.itinerary-detail strong{margin-top:1mm;font-size:3.4mm;font-weight:500;line-height:1.25}.vehicle-card{min-height:152mm;border:1px solid #d3a63d;border-radius:5mm;background:linear-gradient(145deg,#020814,#070d16);color:white;padding:6mm}.vehicle-card-label{display:block;color:#dcae45;font-size:2.7mm;text-align:center;text-transform:uppercase}.vehicle-card h2{margin:2mm 0;color:#dcae45;font-family:Georgia,serif;font-size:4.2mm;text-align:center;text-transform:uppercase}.vehicle-silhouette{display:grid;place-items:center;height:39mm;margin:3mm 0;border-bottom:1px solid #b98b32;color:#2b3036;font-size:8mm;font-weight:900;letter-spacing:.1em;text-align:center}.vehicle-features{display:grid}.vehicle-features div,.driver-timeline>div{display:grid;grid-template-columns:8mm 1fr;gap:2mm;align-items:start;border-bottom:1px solid #815f22;padding:2.6mm 0}.vehicle-features b,.driver-timeline b{color:#dcae45;font-size:2.7mm}.vehicle-features span{font-size:2.7mm;line-height:1.3}.driver-timeline{display:grid;align-content:start}.driver-timeline>div{min-height:14mm;border-bottom:1px solid #caa45e}.driver-timeline>div span{font-size:3.2mm;font-weight:700;line-height:1.35}.driver-timeline>.itinerary-detail{grid-template-columns:8mm 1fr}.document-footer{display:flex;align-items:center;justify-content:center;min-height:14mm;margin-top:5mm;background:#020814;color:white;font-size:3mm;letter-spacing:.19em;text-transform:uppercase}.document-footer b{color:#dcae45;margin:0 1.5mm}.sheet-quote{position:relative;width:1024px;min-height:1536px;background:#fff;box-shadow:0 0 30px #777}.quote-template-bg{position:absolute;inset:0;z-index:0;display:block;width:100%;height:100%;object-fit:cover}.quote-poster-content{position:absolute;inset:0;z-index:1;font-family:Arial,sans-serif}.poster-client{position:absolute;left:50px;top:612px;display:grid;grid-template-columns:auto 1fr;column-gap:8px;align-items:end;width:462px;border-radius:12px;background:rgba(255,255,255,.9);padding:5px 10px;color:#060b17;text-transform:uppercase}.poster-client span{font-size:18px;font-weight:900}.poster-client strong{overflow:hidden;color:#b27c23;font-size:28px;font-weight:950;line-height:1;letter-spacing:.04em;text-overflow:ellipsis;white-space:nowrap}.poster-client small{grid-column:1/-1;margin-top:2px;color:#111;font-size:12px;font-weight:900;letter-spacing:.02em}.poster-value{position:absolute;display:grid;align-content:center;min-height:34px;border-radius:8px;background:rgba(255,255,255,.96);padding:3px 7px;color:#111;font-size:20px;font-weight:500;line-height:1.15;text-align:left}.poster-start-date{left:118px;top:724px;width:128px}.poster-start-time{left:118px;top:840px;width:126px}.poster-origin{left:342px;top:739px;width:120px;text-align:center}.poster-destination{left:516px;top:739px;width:120px;text-align:center}.poster-end-date{left:722px;top:724px;width:112px}.poster-return-time{left:724px;top:840px;width:114px}.poster-passengers{left:892px;top:724px;width:88px;font-size:18px;text-align:center}.poster-luggage{left:890px;top:831px;width:96px;font-size:17px;line-height:1.2}.poster-service-note{position:absolute;left:48px;top:914px;max-width:928px;border-radius:999px;background:rgba(255,255,255,.92);padding:7px 18px;color:#111;font-size:16px;font-weight:850;text-align:center;text-transform:uppercase}.poster-price-band{position:absolute;left:28px;top:965px;width:968px;height:144px;display:grid;grid-template-columns:1fr 2px 1fr;align-items:center;border-radius:22px;background:#030917;color:#fff;overflow:hidden}.poster-price-band div{display:grid;align-content:center;height:100%;padding:0 66px}.poster-price-band div:last-child{text-align:center}.poster-price-band i{display:block;width:2px;height:98px;background:#c49a42}.poster-price-band span{color:#fff;font-size:25px;font-weight:900;letter-spacing:.04em;line-height:1.1;text-transform:uppercase}.poster-price-band strong{display:block;margin-top:10px;color:#dcae45;font-size:49px;font-weight:950;line-height:1}.poster-tax-badge{position:absolute;left:306px;top:1124px;width:396px;min-height:46px;display:grid;place-items:center;border:1px solid #d7aa56;border-radius:7px;background:rgba(255,255,255,.96);padding:6px 12px;color:#111;text-align:center;text-transform:uppercase}.poster-tax-badge span{font-size:20px;font-weight:900;line-height:1.1}.poster-tax-badge small{display:block;margin-top:4px;color:#343434;font-size:10px;font-weight:850;line-height:1.2}.poster-vehicle-number{position:absolute;left:214px;top:1271px;min-width:44px;border-radius:8px;background:rgba(255,255,255,.92);color:#b17c22;font-size:58px;font-weight:950;line-height:.95;text-align:center}.poster-vehicle-name{position:absolute;left:215px;top:1334px;width:150px;border-radius:8px;background:rgba(255,255,255,.95);padding:2px 4px;color:#111;font-size:16px;font-weight:950;line-height:1.05;text-transform:uppercase}.poster-vehicle-tags{position:absolute;left:415px;top:1342px;display:flex;flex-wrap:wrap;gap:7px;max-width:520px}.poster-vehicle-tags span{border:1px solid #d7aa56;border-radius:999px;background:rgba(255,255,255,.96);padding:5px 8px;color:#111;font-size:12px;font-weight:900;text-transform:uppercase}.screen-actions{position:fixed;right:20px;bottom:20px;display:flex;gap:8px}.screen-actions button{border:0;border-radius:10px;background:#050c1a;color:white;padding:12px 16px;font-weight:700;cursor:pointer}.screen-actions button:first-child{background:#c79538;color:#111}@media print{html,body{background:white}.sheet{box-shadow:none}.screen-actions{display:none}}
    ${type === "quote" || type === "route" ? quoteDocumentStyles() : ""}
  </style></head><body>${sheetHtml}</body></html>`;

  const parsedDocument = new DOMParser().parseFromString(documentHtml, "text/html");
  const documentStyles = parsedDocument.querySelector("style").textContent;
  const sheetMarkup = parsedDocument.querySelector(".sheet").outerHTML;
  const quoteDownloadButtons =
    type === "quote"
      ? `
          <button class="button button-gold" data-download-document-image="png" data-document-page=".quote-poster-content" data-file-suffix="01-Cotizacion">Descargar cotización PNG Full HD</button>
        `
      : type === "route"
        ? `
          <button class="button button-secondary" data-edit-journey>Hacer todo editable</button>
          <button class="button button-gold" data-download-document-image="png" data-document-page=".poster-continuation" data-document-label="Itinerario">Guardar itinerario PNG Full HD</button>
        `
      : "";

  $("#modal-root").innerHTML = `
    <style data-premium-document-styles>${documentStyles}</style>
    <div class="modal-overlay" data-document-overlay>
      <section class="document-preview-modal document-preview-${type}" role="dialog" aria-modal="true" aria-label="Vista previa ${escapeHtml(title)}">
        <header class="document-preview-toolbar">
          <strong>${escapeHtml(title)}</strong>
          ${quoteDownloadButtons}
          <button class="button button-secondary" data-print-document>Imprimir / Guardar PDF</button>
          <button class="button button-secondary" data-close-document>Cerrar</button>
        </header>
        <div class="document-preview-scroll">${sheetMarkup}</div>
      </section>
    </div>
  `;
  $("[data-print-document]").addEventListener("click", () => {
    document.body.classList.add("printing-document");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-document"), 200);
  });
  if (type === "route") {
    const continuation = $(".document-preview-scroll .poster-continuation");
    const editButton = $("[data-edit-journey]");
    if (continuation) {
      continuation.contentEditable = "true";
      continuation.spellcheck = false;
      continuation.classList.add("is-editing");
    }
    if (editButton) editButton.textContent = "Finalizar edición";
  }
  $("[data-edit-journey]")?.addEventListener("click", (event) => {
    const continuation = $(".document-preview-scroll .poster-continuation");
    if (!continuation) return;
    const editing = continuation.contentEditable !== "true";
    continuation.contentEditable = String(editing);
    continuation.classList.toggle("is-editing", editing);
    event.currentTarget.textContent = editing ? "Finalizar edición" : "Hacer todo editable";
    if (editing) {
      continuation.focus();
      toast("El itinerario del recorrido ya se puede editar directamente.");
    }
  });
  $$("[data-download-document-image]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await downloadDocumentImage(title, button.dataset.downloadDocumentImage, {
          pageSelector: button.dataset.documentPage,
          fileSuffix: button.dataset.fileSuffix,
          documentLabel: button.dataset.documentLabel,
        });
      } finally {
        button.disabled = false;
      }
    });
  });
  $("[data-close-document]").addEventListener("click", () => {
    document.body.classList.remove("printing-document");
    closeModal();
  });
  $("[data-document-overlay]").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
}

function safeFileName(value, extension) {
  const base = String(value || "Luxury-Travel")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return `${base || "Luxury-Travel"}.${extension}`;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("No fue posible preparar la imagen.")));
    reader.readAsDataURL(blob);
  });
}

async function inlineImages(root) {
  const images = [...root.querySelectorAll("img")];
  await Promise.all(
    images.map(async (image) => {
      const response = await fetch(image.src);
      const blob = await response.blob();
      image.src = await blobToDataUrl(blob);
    }),
  );
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("No fue posible renderizar la cotización.")));
    image.src = src;
  });
}

async function downloadDocumentImage(title, format = "png", options = {}) {
  const suppliedPage = options.pageElement || null;
  const sheet = suppliedPage?.closest(".sheet") || $(".document-preview-scroll .sheet");
  const style = options.style || $("[data-premium-document-styles]")?.textContent || "";
  if (!sheet && !suppliedPage) return;
  const pageSelector = options.pageSelector || ".sheet";
  const page = suppliedPage || (pageSelector === ".sheet" ? sheet : $(pageSelector, sheet));
  if (!page) return;
  let measurementHost;
  try {
    const clone = page.cloneNode(true);
    clone.classList.remove("is-editing");
    clone.removeAttribute("contenteditable");
    clone.removeAttribute("spellcheck");
    await inlineImages(clone);
    const canonicalWidth = page.matches(".quote-poster-content, .poster-continuation")
      ? 1023
      : Math.ceil(Math.max(page.offsetWidth, page.scrollWidth));
    clone.style.width = `${canonicalWidth}px`;
    clone.style.height = "auto";
    clone.style.minHeight = page.matches(".quote-poster-content") ? "1537px" : "0";
    clone.style.maxWidth = "none";
    clone.style.maxHeight = "none";
    clone.style.overflow = "visible";
    clone.style.zoom = "1";
    clone.style.transform = "none";
    clone.style.margin = "0";
    measurementHost = document.createElement("div");
    measurementHost.setAttribute("aria-hidden", "true");
    measurementHost.style.cssText = `position:fixed;left:-20000px;top:0;width:${canonicalWidth}px;visibility:hidden;pointer-events:none;z-index:-1;overflow:visible`;
    const measurementStyle = document.createElement("style");
    measurementStyle.textContent = `${style}.sheet,.quote-poster-content,.poster-continuation{margin:0!important;box-shadow:none!important}`;
    measurementHost.append(measurementStyle, clone);
    document.body.appendChild(measurementHost);
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const width = canonicalWidth;
    const minimumHeight = page.matches(".quote-poster-content") ? 1537 : 1;
    const cloneTop = clone.getBoundingClientRect().top;
    const descendantBottom = [...clone.querySelectorAll("*")].reduce((bottom, element) => {
      const bounds = element.getBoundingClientRect();
      return Math.max(bottom, bounds.bottom - cloneTop);
    }, 0);
    const height = Math.ceil(Math.max(clone.offsetHeight, clone.scrollHeight, descendantBottom, minimumHeight));
    clone.style.height = `${height}px`;
    const scale = 3;
    const serialized = new XMLSerializer().serializeToString(clone);
    measurementHost.remove();
    measurementHost = null;
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">
            <style>${style}.sheet,.quote-poster-content,.poster-continuation{margin:0!important;box-shadow:none!important}</style>
            ${serialized}
          </div>
        </foreignObject>
      </svg>
    `;
    const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const extension = format === "jpeg" ? "jpg" : "png";
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    const fileName = safeFileName(options.fileSuffix ? `${title}-${options.fileSuffix}` : title, extension);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, 0.94));
    if (window.showSaveFilePicker && blob) {
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: "Imagen PNG", accept: { [mimeType]: [`.${extension}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } else {
      const link = document.createElement("a");
      link.download = fileName;
      link.href = blob ? URL.createObjectURL(blob) : canvas.toDataURL(mimeType, 0.94);
      link.click();
      if (blob) setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }
    const documentLabel = options.documentLabel || (options.fileSuffix === "Itinerario-del-recorrido" ? "Itinerario" : "Cotización");
    toast(`${documentLabel} guardado en ${format.toUpperCase()} Full HD.`);
  } catch (error) {
    measurementHost?.remove();
    if (error?.name === "AbortError") return;
    toast(error.message, "error");
  }
}

function openUserModal(user = {}) {
  const isEdit = Boolean(user.id);
  openModal(isEdit ? "Editar usuario" : "Nuevo usuario", `
    <form id="user-form">
      <div class="form-grid">
        <label>Nombre completo<input name="name" value="${escapeHtml(user.name)}" required /></label>
        <label>Correo electrónico<input type="email" name="email" value="${escapeHtml(user.email)}" required /></label>
        <label>Teléfono<input name="phone" value="${escapeHtml(user.phone)}" /></label>
        <label>Rol<select name="role">${["administrador", "vendedor", "piloto"].map((role) => `<option ${user.role === role ? "selected" : ""}>${role}</option>`).join("")}</select></label>
        <label class="full">${isEdit ? "Nueva contraseña (opcional)" : "Contraseña"}<input type="password" name="password" ${isEdit ? "" : "required"} minlength="8" /></label>
        ${isEdit ? `<label><span><input type="checkbox" name="active" ${user.active ? "checked" : ""} /> Usuario activo</span></label>` : ""}
      </div>
      <p class="form-error" data-form-error></p>
      <div class="form-footer"><button type="button" class="button button-secondary" data-close-form>Cancelar</button><button class="button button-primary" type="submit">Guardar usuario</button></div>
    </form>
  `);
  $("[data-close-form]").addEventListener("click", closeModal);
  $("#user-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    if (isEdit) body.active = form.elements.active.checked;
    try {
      await api(`/api/users${isEdit ? `/${user.id}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      toast("Usuario guardado.");
      closeModal();
      await navigate("settings");
    } catch (error) {
      $("[data-form-error]", form).textContent = error.message;
    }
  });
}

async function deleteRecord(collection, id) {
  const labels = {
    clients: "este cliente",
    vehicles: "este vehículo",
    drivers: "este piloto",
    quotes: "esta cotización",
    itineraries: "este itinerario",
  };
  if (!window.confirm(`¿Desea eliminar ${labels[collection] || "este registro"}? Esta acción no se puede deshacer.`)) return;
  try {
    await api(`/api/${collection}/${id}`, { method: "DELETE" });
    toast("Registro eliminado.");
    await navigate(state.module);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function saveRates(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/api/rates", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    toast("Tarifas actualizadas.");
    await navigate("rates");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    toast("Configuración guardada.");
    await navigate("settings");
  } catch (error) {
    toast(error.message, "error");
  }
}

function openSidebar() {
  $("#app-shell").classList.toggle("sidebar-collapsed");
  const isCollapsed = $("#app-shell").classList.contains("sidebar-collapsed");
  $("#menu-button").setAttribute("aria-expanded", String(!isCollapsed));
  if (window.matchMedia("(max-width: 920px)").matches) {
    if (isCollapsed) {
      $("#sidebar").classList.remove("open");
      $("#sidebar-backdrop").classList.remove("open");
    } else {
      $("#sidebar").classList.add("open");
      $("#sidebar-backdrop").classList.add("open");
    }
  }
}

function closeSidebar() {
  if (window.matchMedia("(max-width: 920px)").matches) {
    $("#app-shell").classList.add("sidebar-collapsed");
    $("#menu-button").setAttribute("aria-expanded", "false");
  }
  $("#sidebar").classList.remove("open");
  $("#sidebar-backdrop").classList.remove("open");
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorNode = $("#login-error");
  errorNode.textContent = "";
  const button = $('button[type="submit"]', form);
  button.disabled = true;
  try {
    const payload = await api("/api/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    state.user = payload.user;
    state.permissions = payload.permissions;
    await loadData();
    showApp();
  } catch (error) {
    errorNode.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function logout() {
  try {
    await api("/api/logout", { method: "POST" });
  } finally {
    showLogin();
  }
}

function isRunningAsInstalledApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.navigator.standalone === true
  );
}

function installHelpContent() {
  const userAgent = navigator.userAgent;
  const isAppleMobile =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isMac = /Macintosh|Mac OS X/i.test(userAgent) && !isAppleMobile;
  const isSafari =
    /Safari/i.test(userAgent) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);

  let browserTitle = "Chrome o Microsoft Edge";
  let steps = [
    "Abra el menú del navegador.",
    "Seleccione Instalar Luxury Travel o Instalar aplicación.",
    "Confirme la instalación. Luxury Travel aparecerá como una aplicación independiente.",
  ];

  if (isAppleMobile) {
    browserTitle = "Safari en iPhone o iPad";
    steps = [
      "Abra Luxury Travel en Safari.",
      "Toque el botón Compartir.",
      "Seleccione Agregar a pantalla de inicio y confirme con Agregar.",
    ];
  } else if (isMac && isSafari) {
    browserTitle = "Safari en Mac";
    steps = [
      "Abra el menú Archivo de Safari.",
      "Seleccione Agregar al Dock.",
      "Confirme con Agregar. La aplicación quedará disponible en el Dock y en Aplicaciones.",
    ];
  } else if (isAndroid) {
    browserTitle = "Android";
    steps = [
      "Toque Instalar aplicación en la parte superior de Luxury Travel.",
      "Si su navegador muestra la ventana de instalación, confírmela.",
      "Si no aparece, abra esta página en Chrome y seleccione Instalar aplicación o Agregar a pantalla principal en el menú de tres puntos.",
    ];
  }

  const securityNotice = window.isSecureContext
    ? "La instalación está disponible de forma segura desde este sitio."
    : "La instalación requiere abrir Luxury Travel mediante HTTPS.";

  return `
    <div class="install-guide">
      <div class="install-guide-brand">
        <img src="${appPath("/assets/pwa-icon-192.png")}" alt="" />
        <div>
          <p class="eyebrow">${escapeHtml(browserTitle)}</p>
          <h3>Instalar Luxury Travel</h3>
          <p>La aplicación abrirá los mismos módulos de Resumen y Cotizador, con los mismos usuarios y datos de la página.</p>
        </div>
      </div>
      <ol class="install-steps">
        ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
      <p class="install-security ${window.isSecureContext ? "" : "warning"}">${escapeHtml(securityNotice)}</p>
      <p class="muted install-online-note">Para iniciar sesión, consultar clientes y guardar cotizaciones se necesita conexión a internet.</p>
    </div>
  `;
}

function setupPwa() {
  const installButton = $("#install-button");
  const displayMode = window.matchMedia("(display-mode: standalone)");
  const updateInstallButton = () => {
    installButton.hidden = false;
  };

  updateInstallButton();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register(appPath(`/sw.js?v=${APP_VERSION}`), { scope: appPath("/") })
      .then((registration) => registration.update())
      .catch((error) => console.error("No fue posible registrar la aplicación PWA.", error));
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredInstall = event;
    updateInstallButton();
  });

  window.addEventListener("appinstalled", () => {
    state.deferredInstall = null;
    installButton.hidden = false;
    toast("Luxury Travel se instaló correctamente.");
  });

  displayMode.addEventListener?.("change", updateInstallButton);

  installButton.addEventListener("click", async () => {
    if (isRunningAsInstalledApp()) {
      openModal(
        "Aplicación instalada",
        `
          <div class="install-guide">
            <div class="install-guide-brand">
              <img src="${appPath("/assets/pwa-icon-192.png")}" alt="" />
              <div>
                <p class="eyebrow">Luxury Travel PWA</p>
                <h3>La aplicación ya está instalada</h3>
                <p>Está usando Luxury Travel como aplicación independiente. Resumen y Cotizador permanecen conectados a los mismos usuarios y datos.</p>
              </div>
            </div>
          </div>
        `,
        { eyebrow: "Instalación" },
      );
      return;
    }

    if (!state.deferredInstall) {
      openModal("Instalar aplicación", installHelpContent(), { eyebrow: "Luxury Travel PWA" });
      return;
    }

    const installPrompt = state.deferredInstall;
    state.deferredInstall = null;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      installButton.hidden = false;
    } else {
      installButton.hidden = false;
    }
  });

  const updateOnlineState = () => {
    $("#offline-banner").hidden = navigator.onLine;
  };
  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  updateOnlineState();
}

async function init() {
  const liveHomeLink = $("#live-home-link");
  if (liveHomeLink && APP_BASE_PATH) {
    liveHomeLink.href = "/#inicio";
  } else if (liveHomeLink && ["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    liveHomeLink.href = "/demo-live.html?v=44";
  }
  $("#today-label").textContent = new Intl.DateTimeFormat("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  $("#login-form").addEventListener("submit", login);
  $("[data-toggle-password]").addEventListener("click", (event) => {
    const input = $("#login-password");
    input.type = input.type === "password" ? "text" : "password";
    event.currentTarget.textContent = input.type === "password" ? "Ver" : "Ocultar";
  });
  $("#logout-button").addEventListener("click", logout);
  $("#menu-button").addEventListener("click", openSidebar);
  $("#sidebar-backdrop").addEventListener("click", closeSidebar);
  $("#main-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-module]");
    if (button) navigate(button.dataset.module);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal();
      closeSidebar();
    }
  });
  setupPwa();

  try {
    const session = await api("/api/session");
    state.user = session.user;
    state.permissions = session.permissions;
    await loadData();
    showApp();
  } catch {
    showLogin();
  }
}

init();
