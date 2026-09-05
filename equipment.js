const equipmentCatalog = window.requerimientoEquipoCatalog || { services: {}, groups: [] };
const equipmentServices = equipmentCatalog.services;
const equipmentServiceGroups = equipmentCatalog.groups;
const equipmentInventoryCatalog = window.requerimientoEquipoInventory || { categories: [] };
const equipmentInventorySourceCategories = Array.isArray(equipmentInventoryCatalog.categories)
  ? equipmentInventoryCatalog.categories
  : [];

const equipmentWarehouseInventoryState = {
  loaded: false,
  fingerprint: "",
  freshness: 0,
  records: [],
  recordsById: new Map(),
  recordsByLookupKey: new Map(),
  refreshPromise: null,
  refreshTimer: null
};

const equipmentState = {
  selectedServiceId: "",
  selectedServiceIds: new Set(),
  djAudioType: "qsc",
  events: [],
  selectedExtraIds: new Set(),
  manualMainItems: [],
  manualMainSections: [],
  manualExtras: [],
  itemOverrides: new Map(),
  sectionAddedItems: new Map(),
  removedItemIds: new Set(),
  inventory: new Map(),
  observations: new Map(),
  deletedStack: [],
  selectedEventId: "",
  activeWindow: "review",
  rentPreviewVisible: false,
  rentalOverrides: new Map(),
  servicePickerOpen: false,
  summarySearchTerm: "",
  summaryTransferEnabled: false,
  summaryTransferRoutes: [],
  activeSummaryTransferRouteId: "",
  expandedEquipmentSectionIds: new Set(),
  draftWarehouseDispatchId: createEquipmentWarehouseDispatchId()
};

const equipmentCatalogEditorState = {
  loaded: false,
  loadingPromise: null,
  open: false,
  saving: false,
  serviceId: "",
  audioType: "",
  draft: null
};

let equipmentEventCounter = 1;
let equipmentManualMainCounter = 1;
let equipmentManualSectionCounter = 1;
let equipmentExtraCounter = 1;
let equipmentTransferRouteCounter = 1;
let equipmentLogisticsDecision = null;

const EQUIPMENT_TRANSFER_BUFFER_MINUTES = 120;

function createEquipmentWarehouseDispatchId() {
  if (globalThis.crypto?.randomUUID) return `cuadro-${globalThis.crypto.randomUUID()}`;
  return `cuadro-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function equipmentQuery(selector) {
  return document.querySelector(selector);
}

function invalidateEquipmentRentalPreview() {
  equipmentState.rentalOverrides.clear();
  equipmentState.rentPreviewVisible = false;
}

function escapeEquipmentHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEquipmentKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\bno\.\s*/g, "no ")
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const equipmentInventoryAliases = {
  "hdmi de 5mts": "cable hdmi 5 mt"
};

function equipmentInventoryCanonicalKey(value) {
  const key = normalizeEquipmentKey(value);
  return equipmentInventoryAliases[key] || key;
}

function cleanEquipmentFilePart(value, fallback) {
  const clean = String(value || fallback || "equipo")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback || "equipo";
}

function formatEquipmentDate(value) {
  if (!value) return "Por definir";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatEquipmentDateForFile(value) {
  if (!value) return "Fecha por definir";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function formatEquipmentDateTimeForFile(value) {
  const clean = String(value || "").trim();
  if (!clean) return "Montaje por definir";
  const [datePart, timePart = ""] = clean.split("T");
  const dateLabel = formatEquipmentDateForFile(datePart);
  const [hour, minute] = timePart.split(":");
  return hour && minute ? `${dateLabel} ${hour}-${minute}` : dateLabel;
}

function currentEquipmentDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatEquipmentDateTime(value, fallback = "Por definir") {
  const clean = String(value || "").trim();
  if (!clean) return fallback;
  const [datePart, timePart = ""] = clean.split("T");
  const dateLabel = formatEquipmentDate(datePart);
  const [hour, minute] = timePart.split(":");
  const timeLabel = hour && minute ? `${hour}:${minute}` : "Hora por definir";
  return `${dateLabel} · ${timeLabel}`;
}

function equipmentDateKeyFromDateTime(value) {
  return String(value || "").split("T")[0] || "";
}

function equipmentEventOperationalDateKey(event) {
  return event?.date
    || equipmentDateKeyFromDateTime(equipmentEventSetupAt(event))
    || equipmentDateKeyFromDateTime(event?.equipmentInAt)
    || "";
}

function equipmentDateTimeInputValue(value) {
  const clean = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(clean) ? clean.slice(0, 16) : "";
}

function equipmentEventSetupAt(event) {
  return equipmentDateTimeInputValue(event?.setupAt || event?.mountingAt || event?.phone);
}

function equipmentEventChronologicalKey(event) {
  const setupAt = equipmentEventSetupAt(event);
  const dateKey = event?.date
    || equipmentDateKeyFromDateTime(setupAt)
    || equipmentDateKeyFromDateTime(event?.equipmentInAt)
    || "9999-12-31";
  const sequenceTime = setupAt
    || (event?.date ? `${event.date}T23:59` : "")
    || event?.equipmentInAt
    || "9999-12-31T23:59";
  return `${dateKey}|${sequenceTime}`;
}

function sortEquipmentEventsByDate(events = []) {
  return [...events]
    .map((event, index) => ({ event, index, key: equipmentEventChronologicalKey(event) }))
    .sort((first, second) => first.key.localeCompare(second.key) || first.index - second.index)
    .map(({ event }) => event);
}

function equipmentEventSortDateTime(event) {
  const dateKey = equipmentEventOperationalDateKey(event);
  return equipmentEventSetupAt(event) || event?.equipmentInAt || (dateKey ? `${dateKey}T00:00` : "9999-12-31T23:59");
}

function equipmentEventTransferDateTime(event) {
  const setupAt = equipmentEventSetupAt(event);
  if (setupAt) return formatEquipmentDateTime(setupAt);
  const dateKey = equipmentEventOperationalDateKey(event);
  return dateKey ? `${formatEquipmentDate(dateKey)} · Hora por definir` : "Fecha y hora por definir";
}

function equipmentEventSetupDateTimeLabel(event) {
  return formatEquipmentDateTime(equipmentEventSetupAt(event));
}

function equipmentDateOnlyFromDateTime(value) {
  const dateKey = equipmentDateKeyFromDateTime(value);
  return dateKey ? formatEquipmentDate(dateKey) : "Por definir";
}

function equipmentEventDateLabel(event) {
  return event?.date ? formatEquipmentDate(event.date) : "Por definir";
}

function equipmentDateTimeMillis(value) {
  const clean = equipmentDateTimeInputValue(value);
  if (!clean) return Number.NaN;
  const [datePart, timePart] = clean.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

function equipmentEventUsageWindow(event) {
  const setupAt = equipmentEventSetupAt(event);
  const eventDate = String(event?.date || "").trim();
  const returnAt = equipmentDateTimeInputValue(event?.equipmentInAt);
  const startValue = setupAt || (eventDate ? `${eventDate}T00:00` : "");
  let endValue = returnAt || (eventDate ? `${eventDate}T23:59` : "");
  let startMs = equipmentDateTimeMillis(startValue);
  let endMs = equipmentDateTimeMillis(endValue);
  if (Number.isFinite(startMs) && !Number.isFinite(endMs)) {
    endMs = startMs + (24 * 60 * 60 * 1000);
    endValue = "";
  }
  if (!Number.isFinite(startMs) && Number.isFinite(endMs)) {
    startMs = endMs - (24 * 60 * 60 * 1000);
  }
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs < startMs) {
    endMs = startMs;
  }
  const availableAtMs = Number.isFinite(endMs)
    ? endMs + (EQUIPMENT_TRANSFER_BUFFER_MINUTES * 60 * 1000)
    : Number.NaN;
  return {
    startValue,
    endValue,
    startMs,
    endMs,
    availableAtMs,
    hasExactStart: Boolean(setupAt),
    hasExactEnd: Boolean(returnAt)
  };
}

function formatEquipmentMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return "tiempo por definir";
  const absoluteMinutes = Math.max(0, Math.round(Math.abs(totalMinutes)));
  const days = Math.floor(absoluteMinutes / 1440);
  const hours = Math.floor((absoluteMinutes % 1440) / 60);
  const minutes = absoluteMinutes % 60;
  return [days ? `${days} d` : "", hours ? `${hours} h` : "", minutes || (!days && !hours) ? `${minutes} min` : ""]
    .filter(Boolean)
    .join(" ");
}

function equipmentLogisticsPairAnalysis(from, to) {
  const fromWindow = equipmentEventUsageWindow(from);
  const toWindow = equipmentEventUsageWindow(to);
  const rawGapMinutes = Number.isFinite(fromWindow.endMs) && Number.isFinite(toWindow.startMs)
    ? (toWindow.startMs - fromWindow.endMs) / 60000
    : Number.NaN;
  const availableGapMinutes = Number.isFinite(fromWindow.availableAtMs) && Number.isFinite(toWindow.startMs)
    ? (toWindow.startMs - fromWindow.availableAtMs) / 60000
    : Number.NaN;
  const timestampsAvailable = Number.isFinite(rawGapMinutes);
  const timingKnown = timestampsAvailable && fromWindow.hasExactEnd && toWindow.hasExactStart;
  const overlaps = timestampsAvailable && rawGapMinutes < 0;
  const tight = timestampsAvailable && rawGapMinutes >= 0 && rawGapMinutes < EQUIPMENT_TRANSFER_BUFFER_MINUTES;
  const rentApplies = overlaps || tight;
  return {
    from,
    to,
    fromWindow,
    toWindow,
    rawGapMinutes,
    availableGapMinutes,
    timingKnown,
    overlaps,
    tight,
    rentApplies
  };
}

function equipmentScheduleAnalysis(events = activeEquipmentEvents()) {
  const orderedEvents = sortEquipmentEventsByDate(events).filter(Boolean);
  const pairs = orderedEvents.slice(0, -1).map((event, index) => (
    equipmentLogisticsPairAnalysis(event, orderedEvents[index + 1])
  ));
  const rankedPairs = [...pairs].sort((first, second) => {
    if (first.rentApplies !== second.rentApplies) return first.rentApplies ? -1 : 1;
    const firstGap = Number.isFinite(first.rawGapMinutes) ? first.rawGapMinutes : Number.POSITIVE_INFINITY;
    const secondGap = Number.isFinite(second.rawGapMinutes) ? second.rawGapMinutes : Number.POSITIVE_INFINITY;
    return firstGap - secondGap;
  });
  return {
    events: orderedEvents,
    pairs,
    focusPair: rankedPairs[0] || null,
    rentApplies: pairs.some((pair) => pair.rentApplies),
    timingIncomplete: pairs.some((pair) => !pair.timingKnown)
  };
}

function equipmentTransferredRouteQuantity(row, events = []) {
  return Math.max(
    0,
    ...events.map((event) => Number(row.eventQuantities.get(event.id)) || 0)
  );
}

function equipmentTransferLegKey(fromId, toId) {
  return `${String(fromId || "")}::${String(toId || "")}`;
}

function normalizeEquipmentTransferLegSelections(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([legKey, selections]) => [
    String(legKey || ""),
    (Array.isArray(selections) ? selections : [])
      .map((selection) => ({
        identity: equipmentInventoryCanonicalKey(selection?.identity),
        quantity: Math.max(0, Math.floor(Number(selection?.quantity) || 0))
      }))
      .filter((selection) => selection.identity && selection.quantity > 0)
  ]).filter(([legKey]) => legKey));
}

function createEquipmentSummaryTransferRoute(eventIds = [], routeId = "", legSelections = {}) {
  return {
    id: routeId || `transfer-route-${Date.now()}-${equipmentTransferRouteCounter++}`,
    eventIds: [...new Set((Array.isArray(eventIds) ? eventIds : []).map(String).filter(Boolean))],
    legSelections: normalizeEquipmentTransferLegSelections(legSelections)
  };
}

function cleanupEquipmentSummaryTransferRoutes(events = activeEquipmentEvents()) {
  const availableIds = new Set(events.map((event) => event.id));
  equipmentState.summaryTransferRoutes = (Array.isArray(equipmentState.summaryTransferRoutes)
    ? equipmentState.summaryTransferRoutes
    : [])
    .map((route) => {
      const eventIds = [...new Set((Array.isArray(route?.eventIds) ? route.eventIds : [])
        .map(String)
        .filter((eventId) => availableIds.has(eventId)))];
      const validLegKeys = new Set(eventIds.slice(0, -1).map((eventId, index) => (
        equipmentTransferLegKey(eventId, eventIds[index + 1])
      )));
      const legSelections = Object.fromEntries(Object.entries(normalizeEquipmentTransferLegSelections(route?.legSelections))
        .filter(([legKey]) => validLegKeys.has(legKey)));
      const normalizedRoute = route && typeof route === "object"
        ? route
        : createEquipmentSummaryTransferRoute();
      normalizedRoute.id = String(normalizedRoute.id || "")
        || `transfer-route-${Date.now()}-${equipmentTransferRouteCounter++}`;
      normalizedRoute.eventIds = eventIds;
      normalizedRoute.legSelections = legSelections;
      return normalizedRoute;
    });
  if (equipmentState.summaryTransferEnabled && !equipmentState.summaryTransferRoutes.length) {
    equipmentState.summaryTransferRoutes.push(createEquipmentSummaryTransferRoute());
  }
  const activeRouteExists = equipmentState.summaryTransferRoutes.some(
    (route) => route.id === equipmentState.activeSummaryTransferRouteId
  );
  if (!activeRouteExists) {
    equipmentState.activeSummaryTransferRouteId = equipmentState.summaryTransferRoutes[0]?.id || "";
  }
}

function equipmentActiveSummaryTransferRoute(events = activeEquipmentEvents()) {
  cleanupEquipmentSummaryTransferRoutes(events);
  return equipmentState.summaryTransferRoutes.find(
    (route) => route.id === equipmentState.activeSummaryTransferRouteId
  ) || equipmentState.summaryTransferRoutes[0] || null;
}

function equipmentTransferRouteEvents(route, events = activeEquipmentEvents()) {
  if (!route) return [];
  const eventsById = new Map(events.map((event) => [event.id, event]));
  return route.eventIds.map((eventId) => eventsById.get(eventId)).filter(Boolean);
}

function equipmentSummaryTransferRoutesWithEvents(events = activeEquipmentEvents(), validOnly = false) {
  cleanupEquipmentSummaryTransferRoutes(events);
  return equipmentState.summaryTransferRoutes
    .map((route, index) => ({
      route,
      index,
      events: equipmentTransferRouteEvents(route, events)
    }))
    .filter((entry) => !validOnly || entry.events.length >= 2);
}

function equipmentSummaryRowIdentity(row) {
  return equipmentInventoryCanonicalKey(row?.inventorySourceItem?.description || row?.description || row?.key);
}

function equipmentTransferSelectedQuantity(route, from, to, identity) {
  const legKey = equipmentTransferLegKey(from?.id, to?.id);
  const selections = normalizeEquipmentTransferLegSelections(route?.legSelections)?.[legKey] || [];
  return selections
    .filter((selection) => selection.identity === identity)
    .reduce((total, selection) => total + (Number(selection.quantity) || 0), 0);
}

function equipmentTransferInboundStats(row, eventId, transferRoutes) {
  const identity = equipmentSummaryRowIdentity(row);
  let quantity = 0;
  const routeIds = new Set();
  transferRoutes.forEach(({ route, events: routeEvents }) => {
    routeEvents.slice(0, -1).forEach((from, index) => {
      const to = routeEvents[index + 1];
      if (to.id !== eventId) return;
      const selectedQuantity = equipmentTransferSelectedQuantity(route, from, to, identity);
      if (selectedQuantity <= 0) return;
      quantity += selectedQuantity;
      routeIds.add(route.id);
    });
  });
  return { quantity, routeIds };
}

function equipmentPeakRequiredQuantity(row, events, transferRoutes = [], applyTransfers = true) {
  const points = [];
  let quantityWithoutDates = 0;
  const appliedRouteIds = new Set();
  events.forEach((event) => {
    const eventQuantity = Math.max(0, Number(row.eventQuantities.get(event.id)) || 0);
    if (!eventQuantity) return;
    const inbound = applyTransfers
      ? equipmentTransferInboundStats(row, event.id, transferRoutes)
      : { quantity: 0, routeIds: new Set() };
    const effectiveQuantity = Math.max(0, eventQuantity - inbound.quantity);
    if (effectiveQuantity < eventQuantity) inbound.routeIds.forEach((routeId) => appliedRouteIds.add(routeId));
    if (!effectiveQuantity) return;
    const usage = equipmentEventUsageWindow(event);
    if (!Number.isFinite(usage.startMs) || !Number.isFinite(usage.availableAtMs)) {
      quantityWithoutDates += effectiveQuantity;
      return;
    }
    points.push({ time: usage.startMs, delta: effectiveQuantity, order: 1 });
    points.push({ time: usage.availableAtMs, delta: -effectiveQuantity, order: 0 });
  });
  points.sort((first, second) => first.time - second.time || first.order - second.order);
  let current = quantityWithoutDates;
  let peak = current;
  points.forEach((point) => {
    current += point.delta;
    peak = Math.max(peak, current);
  });
  return { quantity: Math.max(0, peak), appliedRouteIds };
}

function equipmentTransferAdjustedQuantity(row, events, transferRoutes) {
  const result = equipmentPeakRequiredQuantity(row, events, transferRoutes, true);
  return { quantity: result.quantity, appliedRouteCount: result.appliedRouteIds.size };
}

function equipmentEventReturnDateTime(event) {
  if (event?.equipmentInAt) return formatEquipmentDateTime(event.equipmentInAt);
  const dateKey = equipmentEventOperationalDateKey(event);
  return dateKey ? `${formatEquipmentDate(dateKey)} · Hora por definir` : "Fecha y hora por definir";
}

function equipmentNormalizeServiceIds(value) {
  const values = value instanceof Set ? [...value] : Array.isArray(value) ? value : [value];
  const seen = new Set();
  return values
    .map((serviceId) => String(serviceId || "").trim())
    .filter((serviceId) => {
      if (!serviceId || !equipmentServices[serviceId] || seen.has(serviceId)) return false;
      seen.add(serviceId);
      return true;
    });
}

function selectedEquipmentServiceIds() {
  const selectedIds = equipmentNormalizeServiceIds(equipmentState.selectedServiceIds);
  if (selectedIds.length) return selectedIds;
  return equipmentNormalizeServiceIds(equipmentState.selectedServiceId);
}

function sameEquipmentServiceIds(firstIds, secondIds) {
  const first = equipmentNormalizeServiceIds(firstIds);
  const second = equipmentNormalizeServiceIds(secondIds);
  return first.length === second.length && first.every((serviceId, index) => serviceId === second[index]);
}

function updateNativeEquipmentServiceSelect() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  const selectedIds = new Set(selectedEquipmentServiceIds());
  [...serviceSelect.options].forEach((option) => {
    option.selected = selectedIds.has(option.value);
  });
}

function populateNativeEquipmentServiceSelect() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  serviceSelect.replaceChildren();
  const placeholder = new Option("Seleccione servicios", "", true, false);
  placeholder.disabled = true;
  serviceSelect.add(placeholder);
  equipmentServiceGroups.forEach((group) => {
    const optionGroup = document.createElement("optgroup");
    optionGroup.label = group.label;
    group.serviceIds.forEach((serviceId) => {
      const service = equipmentServices[serviceId];
      if (service) optionGroup.append(new Option(service.name, serviceId, false, false));
    });
    if (optionGroup.children.length) serviceSelect.append(optionGroup);
  });
}

function serviceWithEquipmentAudioOption(serviceId) {
  const service = equipmentServices[serviceId] || null;
  if (!service) return null;
  const baseService = {
    ...service,
    id: serviceId,
    serviceId
  };
  if (!service.audioOptions) return baseService;
  const audioType = service.audioOptions[equipmentState.djAudioType] ? equipmentState.djAudioType : "qsc";
  const audioOption = service.audioOptions?.[audioType] || service.audioOptions?.qsc;
  return {
    ...baseService,
    mainSections: (service.mainSections || []).map((section) => {
      if (!section.audioVariant || !audioOption) return section;
      return {
        ...section,
        id: `${section.id || "audio"}-${audioType}`,
        title: `AUDIO - ${audioOption.label}`,
        items: audioOption.items
      };
    })
  };
}

function currentEquipmentServices() {
  return selectedEquipmentServiceIds()
    .map(serviceWithEquipmentAudioOption)
    .filter(Boolean);
}

function equipmentServicesLabel(services = currentEquipmentServices(), fallback = "Seleccione un servicio") {
  if (!services.length) return fallback;
  if (services.length === 1) return services[0].name;
  return services.map((service) => service.name).join(" + ");
}

function currentEquipmentService() {
  const services = currentEquipmentServices();
  if (!services.length) return null;
  if (services.length === 1) return services[0];
  return {
    id: "multiple-services",
    serviceId: "multiple-services",
    name: equipmentServicesLabel(services, "Cuadro de equipo"),
    source: services.map((service) => service.source || service.name).join(" / "),
    mainSections: [],
    extras: []
  };
}

function equipmentExtraSelectionKey(serviceId, extraId) {
  return `${serviceId || "servicio"}::${extraId || "extra"}`;
}

function isEquipmentExtraSelected(serviceId, extraId, allowLegacyId = false) {
  const key = equipmentExtraSelectionKey(serviceId, extraId);
  return equipmentState.selectedExtraIds.has(key) || (allowLegacyId && equipmentState.selectedExtraIds.has(extraId));
}

function setEquipmentServiceSelection(serviceIds, options = {}) {
  const normalizedIds = equipmentNormalizeServiceIds(serviceIds);
  equipmentState.selectedServiceIds = new Set(normalizedIds);
  equipmentState.selectedServiceId = normalizedIds[0] || "";
  if (options.clearExtras) equipmentState.selectedExtraIds.clear();
  updateNativeEquipmentServiceSelect();
  const selectedServices = currentEquipmentServices();
  const hasCurrentAudioType = selectedServices.some((service) => service.audioOptions?.[equipmentState.djAudioType]);
  if (!hasCurrentAudioType) equipmentState.djAudioType = "qsc";
}

function renderEquipmentServicePicker() {
  const host = equipmentQuery("#equipmentServicePicker");
  if (!host) return;
  const selectedIds = new Set(selectedEquipmentServiceIds());
  const selectedServices = currentEquipmentServices();
  const selectedLabel = selectedIds.size
    ? selectedIds.size === 1
      ? equipmentServicesLabel(selectedServices, "1 servicio seleccionado")
      : `${selectedIds.size} servicios seleccionados`
    : "Seleccione servicios";
  const groupsHtml = equipmentServiceGroups
    .map((group) => {
      const services = group.serviceIds
        .map((serviceId) => ({ serviceId, service: equipmentServices[serviceId] }))
        .filter((entry) => entry.service);
      if (!services.length) return "";
      const groupHasSelectedService = services.some((entry) => selectedIds.has(entry.serviceId));
      const openAttribute = groupHasSelectedService ? " open" : "";
      const options = services
        .map(({ serviceId, service }) => {
          const isActive = selectedIds.has(serviceId);
          const activeClass = isActive ? " is-active" : "";
          return `
            <button class="equipment-service-option${activeClass}" type="button" aria-pressed="${isActive ? "true" : "false"}" data-equipment-service-option="${escapeEquipmentHtml(serviceId)}">
              <span>${escapeEquipmentHtml(service.name)}</span>
            </button>`;
        })
        .join("");
      return `
        <details class="equipment-service-group"${openAttribute}>
          <summary>${escapeEquipmentHtml(group.label)}</summary>
          <div class="equipment-service-options">${options}</div>
        </details>`;
    })
    .join("");
  const menuOpenAttribute = equipmentState.servicePickerOpen ? " open" : "";
  host.innerHTML = `
    <details class="equipment-service-menu" data-equipment-service-menu${menuOpenAttribute}>
      <summary class="equipment-service-menu-summary">
        <span>Tipo de Servicio</span>
        <small>${escapeEquipmentHtml(selectedLabel)}</small>
      </summary>
      <div class="equipment-service-menu-content">${groupsHtml}</div>
    </details>`;
  host.querySelector("[data-equipment-service-menu]")?.addEventListener("toggle", (event) => {
    equipmentState.servicePickerOpen = event.currentTarget.open;
  });
  host.querySelectorAll("[data-equipment-service-option]").forEach((button) => {
    button.addEventListener("click", () => toggleEquipmentService(button.dataset.equipmentServiceOption || ""));
  });
}

function toggleEquipmentService(serviceId) {
  if (!equipmentServices[serviceId]) return;
  const selectedIds = new Set(selectedEquipmentServiceIds());
  if (selectedIds.has(serviceId)) {
    selectedIds.delete(serviceId);
  } else {
    selectedIds.add(serviceId);
  }
  setEquipmentServiceSelection([...selectedIds], { clearExtras: true });
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  renderEquipmentModule();
}

function selectEquipmentService(serviceId = "") {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  const selectedIds = serviceSelect?.multiple
    ? [...serviceSelect.selectedOptions].map((option) => option.value)
    : [serviceId || serviceSelect?.value || ""];
  setEquipmentServiceSelection(selectedIds, { clearExtras: true });
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  renderEquipmentModule();
}

function syncSelectedEquipmentService() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  const selectedIds = serviceSelect.multiple
    ? [...serviceSelect.selectedOptions].map((option) => option.value)
    : [serviceSelect.value];
  if (sameEquipmentServiceIds(selectedIds, selectedEquipmentServiceIds())) return;
  setEquipmentServiceSelection(selectedIds);
}

function equipmentSectionKey(section, index, scope, serviceId = "") {
  const servicePrefix = serviceId ? `${serviceId}-` : "";
  return `${servicePrefix}${scope}-${section.id || normalizeEquipmentKey(section.title) || index}`;
}

function equipmentItemKey(sectionKey, itemIndex) {
  return `${sectionKey}-item-${itemIndex}`;
}

function normalizeEquipmentItem(item) {
  if (Array.isArray(item)) {
    return {
      id: "",
      quantity: item[0],
      description: item[1],
      editable: false,
      manual: false
    };
  }
  return {
    id: item.id || "",
    quantity: item.quantity,
    description: item.description,
    editable: item.editable !== false,
    manual: Boolean(item.manual)
  };
}

function editableEquipmentItems(section, sectionKey) {
  const sourceItems = (section.items || [])
    .map(([quantity, description], itemIndex) => {
      const id = equipmentItemKey(sectionKey, itemIndex);
      const override = equipmentState.itemOverrides.get(id) || {};
      return {
        id,
        quantity: override.quantity ?? quantity,
        description: override.description ?? description,
        editable: true,
        manual: false
      };
    })
    .filter((item) => !equipmentState.removedItemIds.has(item.id));
  const addedItems = cloneEquipmentSnapshotItems(equipmentState.sectionAddedItems.get(sectionKey) || [])
    .map((item) => ({ ...item, editable: true, manual: true }));
  return [...sourceItems, ...addedItems];
}

function manualMainSectionsForTable() {
  const legacySection = equipmentState.manualMainItems.length
    ? [
        {
          id: "equipo-manual",
          title: "Equipo agregado manualmente",
          manualSection: true,
          items: equipmentState.manualMainItems.map((item) => ({
            ...item,
            editable: true,
            manual: true
          }))
        }
      ]
    : [];
  const manualSections = equipmentState.manualMainSections
    .filter((section) => section.title || section.items.length)
    .map((section) => ({
      id: section.id,
      title: section.title || "Equipo agregado manualmente",
      manualSection: true,
      items: section.items.map((item) => ({
        ...item,
        editable: true,
        manual: true
      }))
    }));
  return [...legacySection, ...manualSections];
}

function ensureManualMainSection() {
  if (!equipmentState.manualMainSections.length) {
    equipmentState.manualMainSections.push({
      id: `manual-section-${Date.now()}-${equipmentManualSectionCounter++}`,
      title: "Equipo agregado manualmente",
      items: []
    });
  }
  return equipmentState.manualMainSections[equipmentState.manualMainSections.length - 1];
}

function selectedEquipmentSections() {
  const services = currentEquipmentServices();
  if (!services.length) return [];
  const hasMultipleServices = services.length > 1;
  const mainSections = services.flatMap((service) => {
    return (service.mainSections || []).map((section, index) => {
      const sectionKey = equipmentSectionKey(section, index, "main", service.id);
      return {
        ...section,
        id: sectionKey,
        title: hasMultipleServices ? `${service.name} / ${section.title}` : section.title,
        items: editableEquipmentItems(section, sectionKey)
      };
    }).filter((section) => section.items.length);
  });
  const manualMainSection = manualMainSectionsForTable();
  const selectedExtrasSections = services.flatMap((service) => {
    return (service.extras || [])
      .filter((extra) => isEquipmentExtraSelected(service.id, extra.id, services.length <= 1))
      .map((extra, index) => {
        const sectionKey = equipmentSectionKey(extra, index, "extra", service.id);
        return {
          ...extra,
          id: sectionKey,
          title: hasMultipleServices ? `${service.name} / ${extra.title}` : extra.title,
          items: editableEquipmentItems(extra, sectionKey)
        };
      })
      .filter((section) => section.items.length);
  });
  const manualExtrasSection = equipmentState.manualExtras.length
    ? [
        {
          id: "extras-manuales",
          title: "Extras manuales",
          items: equipmentState.manualExtras.map((extra) => ({
            ...extra,
            editable: true,
            manual: true
          }))
        }
      ]
    : [];
  return [...mainSections, ...manualMainSection, ...selectedExtrasSections, ...manualExtrasSection];
}

function warehousePdfSections() {
  return selectedEquipmentSections();
}

function currentEquipmentEventDraft() {
  const setupAt = equipmentQuery("#equipmentEventSetupAt")?.value || "";
  return {
    id: "event-draft",
    place: equipmentQuery("#equipmentEventPlace")?.value.trim() || "Lugar por definir",
    name: equipmentQuery("#equipmentEventName")?.value.trim() || "Evento por definir",
    setupAt,
    date: equipmentQuery("#equipmentEventDate")?.value || "",
    equipmentOutAt: setupAt,
    equipmentInAt: equipmentQuery("#equipmentEventInAt")?.value || "",
    responsible: equipmentQuery("#equipmentEventResponsible")?.value.trim() || "Por definir"
  };
}

function selectedEquipmentEvent() {
  return equipmentState.events.find((item) => item.id === equipmentState.selectedEventId) || null;
}

function activeEquipmentEvents() {
  return equipmentState.events.length ? sortEquipmentEventsByDate(equipmentState.events) : [currentEquipmentEventDraft()];
}

function equipmentPdfEvents() {
  return [currentEquipmentEventDraft()];
}

function cloneEquipmentSnapshotItem(item, index = 0) {
  const normalized = normalizeEquipmentItem(item || {});
  return {
    id: normalized.id || `snapshot-item-${index}`,
    quantity: Number(normalized.quantity) || 0,
    description: normalized.description || "",
    editable: normalized.editable !== false,
    manual: Boolean(normalized.manual)
  };
}

function cloneEquipmentSnapshotItems(items = []) {
  return items.map((item, index) => cloneEquipmentSnapshotItem(item, index));
}

function cloneEquipmentSnapshotSections(sections = []) {
  return sections.map((section, index) => ({
    id: section.id || `snapshot-section-${index}`,
    title: section.title || "",
    items: cloneEquipmentSnapshotItems(section.items || [])
  }));
}

function equipmentMapToEntries(map) {
  return [...map.entries()].map(([key, value]) => [key, { ...(value || {}) }]);
}

function equipmentEntriesToMap(entries = []) {
  return new Map(entries.map(([key, value]) => [key, { ...(value || {}) }]));
}

function equipmentAddedItemsToEntries(map) {
  return [...map.entries()].map(([key, items]) => [key, cloneEquipmentSnapshotItems(items || [])]);
}

function equipmentEntriesToAddedItemsMap(entries = []) {
  return new Map((Array.isArray(entries) ? entries : []).map(([key, items]) => [
    String(key || ""),
    cloneEquipmentSnapshotItems(Array.isArray(items) ? items : [])
  ]).filter(([key]) => key));
}

function captureEquipmentEventSnapshot() {
  const services = currentEquipmentServices();
  const serviceIds = selectedEquipmentServiceIds();
  return {
    serviceIds,
    serviceId: serviceIds[0] || "",
    serviceName: equipmentServicesLabel(services, ""),
    djAudioType: equipmentState.djAudioType,
    selectedExtraIds: [...equipmentState.selectedExtraIds],
    manualMainItems: cloneEquipmentSnapshotItems(equipmentState.manualMainItems),
    manualMainSections: equipmentState.manualMainSections.map((section, index) => ({
      id: section.id || `manual-section-${index}`,
      title: section.title || "",
      items: cloneEquipmentSnapshotItems(section.items || [])
    })),
    manualExtras: cloneEquipmentSnapshotItems(equipmentState.manualExtras),
    itemOverrides: equipmentMapToEntries(equipmentState.itemOverrides),
    sectionAddedItems: equipmentAddedItemsToEntries(equipmentState.sectionAddedItems),
    removedItemIds: [...equipmentState.removedItemIds],
    sections: cloneEquipmentSnapshotSections(selectedEquipmentSections())
  };
}

function captureEquipmentEventSnapshotForServiceIds(serviceIds) {
  const previousServiceIds = selectedEquipmentServiceIds();
  const previousSelectedServiceId = equipmentState.selectedServiceId;
  const previousDjAudioType = equipmentState.djAudioType;
  setEquipmentServiceSelection(serviceIds);
  const snapshot = captureEquipmentEventSnapshot();
  setEquipmentServiceSelection(previousServiceIds);
  equipmentState.selectedServiceId = previousSelectedServiceId;
  equipmentState.djAudioType = previousDjAudioType;
  updateNativeEquipmentServiceSelect();
  return snapshot;
}

function restoreEquipmentEventSnapshot(event) {
  if (!event) return;
  const restoredServiceIds = Array.isArray(event.serviceIds) && event.serviceIds.length
    ? event.serviceIds
    : event.serviceId;
  setEquipmentServiceSelection(restoredServiceIds);
  equipmentState.djAudioType = event.djAudioType || "qsc";
  equipmentState.selectedExtraIds = new Set(event.selectedExtraIds || []);
  equipmentState.manualMainItems = cloneEquipmentSnapshotItems(event.manualMainItems || []);
  equipmentState.manualMainSections = (event.manualMainSections || []).map((section, index) => ({
    id: section.id || `manual-section-${Date.now()}-${index}`,
    title: section.title || "",
    items: cloneEquipmentSnapshotItems(section.items || [])
  }));
  equipmentState.manualExtras = cloneEquipmentSnapshotItems(event.manualExtras || []);
  equipmentState.itemOverrides = equipmentEntriesToMap(event.itemOverrides || []);
  equipmentState.sectionAddedItems = equipmentEntriesToAddedItemsMap(event.sectionAddedItems || []);
  equipmentState.removedItemIds = new Set(event.removedItemIds || []);
  updateNativeEquipmentServiceSelect();
}

function populateEquipmentEventFields(event) {
  const placeInput = equipmentQuery("#equipmentEventPlace");
  const nameInput = equipmentQuery("#equipmentEventName");
  const setupAtInput = equipmentQuery("#equipmentEventSetupAt");
  const dateInput = equipmentQuery("#equipmentEventDate");
  const inAtInput = equipmentQuery("#equipmentEventInAt");
  const responsibleInput = equipmentQuery("#equipmentEventResponsible");
  if (placeInput) placeInput.value = event?.place || "";
  if (nameInput) nameInput.value = event?.name || "";
  if (setupAtInput) setupAtInput.value = event ? equipmentEventSetupAt(event) : "";
  if (dateInput) dateInput.value = event?.date || "";
  if (inAtInput) inAtInput.value = event?.equipmentInAt || "";
  if (responsibleInput) responsibleInput.value = event?.responsible || "";
}

function updateEquipmentEventFromCurrent(event) {
  if (!event) return;
  const draft = currentEquipmentEventDraft();
  const snapshot = captureEquipmentEventSnapshot();
  Object.assign(event, draft, snapshot, { id: event.id });
}

function syncActiveEquipmentEvent() {
  const event = equipmentState.events.find((item) => item.id === equipmentState.selectedEventId);
  if (event) updateEquipmentEventFromCurrent(event);
}

function sectionsForEquipmentEvent(event) {
  if (event?.sections?.length) return cloneEquipmentSnapshotSections(event.sections);
  return selectedEquipmentSections();
}

function loadEquipmentEvent(eventId) {
  const event = equipmentState.events.find((item) => item.id === eventId);
  if (!event) return;
  equipmentState.selectedEventId = event.id;
  restoreEquipmentEventSnapshot(event);
  populateEquipmentEventFields(event);
  equipmentState.activeWindow = "review";
  renderEquipmentModule();
}

function eventColumnName(event) {
  return event?.place?.trim() || event?.name?.trim() || "Lugar por definir";
}

function equipmentSummaryColumnName(event, index = 0) {
  const serviceName = event?.serviceName?.trim() || "";
  const name = event?.place?.trim() || event?.name?.trim() || serviceName;
  return name || `Ventana ${index + 1}`;
}

function equipmentEventCardTitle(event, index = 0) {
  return event?.place?.trim() || event?.name?.trim() || `Ventana ${index + 1}`;
}

function equipmentEventNameForFile(event) {
  return event?.name?.trim() || event?.place?.trim() || "Evento por definir";
}

function eventSummaryText(events, field, fallback = "Por definir") {
  const values = events
    .map((event) => (field === "date" ? formatEquipmentDate(event[field]) : event[field]))
    .filter((value) => value && value !== "Por definir");
  return values.length ? values.join(" / ") : fallback;
}

function eventSummaryDateTimeText(events, field, fallback = "Por definir") {
  const values = events
    .map((event) => formatEquipmentDateTime(event[field], ""))
    .filter(Boolean);
  return values.length ? values.join(" / ") : fallback;
}

function eventSummarySetupDateTimeText(events, fallback = "Por definir") {
  const values = events
    .map((event) => formatEquipmentDateTime(equipmentEventSetupAt(event), ""))
    .filter(Boolean);
  return values.length ? values.join(" / ") : fallback;
}

function equipmentEventsByOperationalDate(events = activeEquipmentEvents()) {
  const groups = new Map();
  events.forEach((event) => {
    const dateKey = equipmentEventOperationalDateKey(event);
    if (!dateKey) return;
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(event);
  });
  return groups;
}

function equipmentSummaryDateNotice() {
  const events = equipmentState.events;
  if (!events.length) return { text: "", type: "" };
  const schedule = equipmentScheduleAnalysis(events);
  if (schedule.timingIncomplete) {
    return {
      type: "warning",
      text: "Complete la fecha y hora de montaje y de ingreso para confirmar disponibilidad, renta y trasiego."
    };
  }
  if (schedule.events.length > 1 && schedule.rentApplies) {
    return {
      type: "warning",
      text: "Hay eventos con horarios simultáneos o con menos de 2 horas entre ingreso y montaje. El equipo coincidente se considera ocupado y puede generar renta."
    };
  }
  if (schedule.events.length > 1) {
    return {
      type: "ok",
      text: "Los intervalos no se traslapan. El equipo puede reutilizarse y no se duplica en el cálculo de renta."
    };
  }
  return { text: "", type: "" };
}

function renderEquipmentSummaryDateNotice() {
  const notice = equipmentQuery("#equipmentSummaryDateNotice");
  if (!notice) return;
  const { text, type } = equipmentSummaryDateNotice();
  notice.textContent = text;
  notice.classList.toggle("is-hidden", !text);
  notice.classList.toggle("is-warning", type === "warning");
  notice.classList.toggle("is-ok", type === "ok");
}

function equipmentRowsSummary() {
  const groups = [];
  const groupsByKey = new Map();
  const rowsByEquipmentKey = new Map();
  const inventoryRowsByEquipmentKey = new Map();
  const itemRows = [];
  const events = activeEquipmentEvents();
  const ensureGroup = (title, alwaysVisible = false) => {
    const categoryTitle = String(title || "Equipo sin categoria").trim() || "Equipo sin categoria";
    const categoryKey = normalizeEquipmentKey(categoryTitle) || `categoria-${groups.length + 1}`;
    let group = groupsByKey.get(categoryKey);
    if (!group) {
      group = {
        type: "category",
        key: `category-${categoryKey}`,
        title: categoryTitle,
        rows: [],
        alwaysVisible
      };
      groupsByKey.set(categoryKey, group);
      groups.push(group);
    } else if (alwaysVisible) {
      group.alwaysVisible = true;
    }
    return group;
  };

  equipmentInventorySummaryCategories().forEach((category) => {
    const group = ensureGroup(category?.title, true);
    (Array.isArray(category?.items) ? category.items : []).forEach((item) => {
      const description = String(item?.description || "").trim();
      const matchKey = equipmentInventoryCanonicalKey(description);
      if (!matchKey) return;
      const row = {
        type: "item",
        key: equipmentInventoryRowKey(item),
        matchKey,
        quantity: 0,
        description,
        eventQuantities: new Map(),
        categoryKey: group.key,
        categoryTitle: group.title,
        inventorySourceItem: item
      };
      const lookupKeys = [description, item?.legacyDescription]
        .map(equipmentInventoryCanonicalKey)
        .filter(Boolean);
      [...new Set(lookupKeys)].forEach((lookupKey) => {
        if (!inventoryRowsByEquipmentKey.has(lookupKey)) inventoryRowsByEquipmentKey.set(lookupKey, []);
        inventoryRowsByEquipmentKey.get(lookupKey).push(row);
      });
      itemRows.push(row);
      group.rows.push(row);
    });
  });
  events.forEach((event) => {
    const sections = equipmentState.events.length ? sectionsForEquipmentEvent(event) : selectedEquipmentSections();
    sections.forEach((section) => {
      const categoryTitle = String(section.title || "Equipo sin categoria").trim() || "Equipo sin categoria";
      const group = ensureGroup(categoryTitle);
      section.items.forEach((rawItem) => {
        const { quantity, description } = normalizeEquipmentItem(rawItem);
        const key = normalizeEquipmentKey(description);
        if (!key) return;
        const perEventQuantity = Number(quantity) || 0;
        const inventoryRows = inventoryRowsByEquipmentKey.get(equipmentInventoryCanonicalKey(description)) || [];
        if (inventoryRows.length) {
          let remainingQuantity = perEventQuantity;
          inventoryRows.forEach((inventoryRow) => {
            if (remainingQuantity <= 0) return;
            const currentEventQuantity = Number(inventoryRow.eventQuantities.get(event.id)) || 0;
            const sourceCapacity = Math.max(0, equipmentInventoryAvailableValueFor(inventoryRow));
            const availableCapacity = Math.max(0, sourceCapacity - currentEventQuantity);
            const allocatedQuantity = Math.min(remainingQuantity, availableCapacity);
            if (allocatedQuantity <= 0) return;
            inventoryRow.eventQuantities.set(event.id, currentEventQuantity + allocatedQuantity);
            inventoryRow.quantity += allocatedQuantity;
            remainingQuantity -= allocatedQuantity;
          });
          if (remainingQuantity > 0) {
            const shortageRow = inventoryRows[inventoryRows.length - 1];
            shortageRow.eventQuantities.set(
              event.id,
              (Number(shortageRow.eventQuantities.get(event.id)) || 0) + remainingQuantity
            );
            shortageRow.quantity += remainingQuantity;
          }
          return;
        }
        let row = rowsByEquipmentKey.get(key);
        if (!row) {
          row = {
            type: "item",
            key,
            quantity: 0,
            description,
            eventQuantities: new Map(),
            categoryKey: group.key,
            categoryTitle: group.title
          };
          rowsByEquipmentKey.set(key, row);
          itemRows.push(row);
          group.rows.push(row);
        }
        row.eventQuantities.set(
          event.id,
          (Number(row.eventQuantities.get(event.id)) || 0) + perEventQuantity
        );
        row.quantity += perEventQuantity;
      });
    });
  });
  const transferRoutes = equipmentState.summaryTransferEnabled
    ? equipmentSummaryTransferRoutesWithEvents(events, true)
    : [];
  itemRows.forEach((row) => {
    const originalQuantity = Number(row.quantity) || 0;
    const adjustment = equipmentTransferAdjustedQuantity(row, events, transferRoutes);
    row.originalQuantity = originalQuantity;
    row.quantity = Math.min(originalQuantity, adjustment.quantity);
    row.transferApplied = adjustment.appliedRouteCount > 0;
    row.transferRouteCount = adjustment.appliedRouteCount;
  });
  return groups.flatMap((group) => group.rows.length || group.alwaysVisible ? [{
    type: "category",
    key: group.key,
    title: group.title
  }, ...group.rows] : []);
}

function equipmentTransferComparisonRows(rows = equipmentRowsSummary()) {
  const groups = new Map();
  rows.forEach((row) => {
    if (!row || row.type === "category") return;
    const identity = equipmentInventoryCanonicalKey(
      row.inventorySourceItem?.description || row.description || row.key
    );
    if (!identity) return;
    let group = groups.get(identity);
    if (!group) {
      group = {
        identity,
        description: row.description,
        categoryTitle: row.categoryTitle || "Equipo",
        descriptionFromInventory: Boolean(row.inventorySourceItem),
        eventQuantities: new Map()
      };
      groups.set(identity, group);
    } else if (row.inventorySourceItem && !group.descriptionFromInventory) {
      group.description = row.description;
      group.categoryTitle = row.categoryTitle || group.categoryTitle;
      group.descriptionFromInventory = true;
    }
    row.eventQuantities?.forEach((quantity, eventId) => {
      group.eventQuantities.set(
        eventId,
        (Number(group.eventQuantities.get(eventId)) || 0) + (Number(quantity) || 0)
      );
    });
  });
  return [...groups.values()];
}

function equipmentTransferredItemsBetweenEvents(from, to, comparisonRows = equipmentTransferComparisonRows()) {
  return comparisonRows
    .map((row) => {
      const fromQuantity = Number(row.eventQuantities.get(from?.id)) || 0;
      const toQuantity = Number(row.eventQuantities.get(to?.id)) || 0;
      return {
        ...row,
        fromQuantity,
        toQuantity,
        quantity: Math.min(fromQuantity, toQuantity)
      };
    })
    .filter((item) => item.quantity > 0);
}

function equipmentSelectedTransferredItemsBetweenEvents(route, from, to, candidates = null) {
  const availableItems = candidates || equipmentTransferredItemsBetweenEvents(from, to);
  const availableByIdentity = new Map(availableItems.map((item) => [item.identity, item]));
  const legKey = equipmentTransferLegKey(from?.id, to?.id);
  const selectedQuantities = new Map();
  (normalizeEquipmentTransferLegSelections(route?.legSelections)?.[legKey] || []).forEach((selection) => {
    selectedQuantities.set(
      selection.identity,
      (Number(selectedQuantities.get(selection.identity)) || 0) + (Number(selection.quantity) || 0)
    );
  });
  return [...selectedQuantities.entries()].map(([identity, selectedQuantity]) => {
    const candidate = availableByIdentity.get(identity);
    if (!candidate) return null;
    const quantity = Math.min(Math.max(0, selectedQuantity), Number(candidate.quantity) || 0);
    return quantity > 0 ? { ...candidate, availableQuantity: candidate.quantity, quantity } : null;
  }).filter(Boolean);
}

function equipmentSetTransferLegSelections(route, from, to, selections) {
  if (!route) return;
  const legKey = equipmentTransferLegKey(from?.id, to?.id);
  route.legSelections = normalizeEquipmentTransferLegSelections(route.legSelections);
  route.legSelections[legKey] = (Array.isArray(selections) ? selections : [])
    .map((selection) => ({
      identity: equipmentInventoryCanonicalKey(selection?.identity),
      quantity: Math.max(0, Math.floor(Number(selection?.quantity) || 0))
    }))
    .filter((selection) => selection.identity && selection.quantity > 0);
}

function equipmentTransferUnusedByLeg() {
  if (!equipmentState.summaryTransferEnabled) return [];
  const events = activeEquipmentEvents();
  const transferRoutes = equipmentSummaryTransferRoutesWithEvents(events, true);
  if (!transferRoutes.length) return [];
  const comparisonRows = equipmentTransferComparisonRows();
  return transferRoutes.flatMap(({ route, events: routeEvents, index: routeIndex }) => {
    return routeEvents.slice(0, -1).map((from, legIndex) => {
      const to = routeEvents[legIndex + 1];
      const candidates = equipmentTransferredItemsBetweenEvents(from, to, comparisonRows);
      const transferredByIdentity = new Map(
        equipmentSelectedTransferredItemsBetweenEvents(route, from, to, candidates)
          .map((item) => [item.identity, Number(item.quantity) || 0])
      );
      const items = comparisonRows
        .map((row) => {
          const fromQuantity = Number(row.eventQuantities.get(from.id)) || 0;
          const toQuantity = Number(row.eventQuantities.get(to.id)) || 0;
          const transferredQuantity = Number(transferredByIdentity.get(row.identity)) || 0;
          return {
            ...row,
            fromQuantity,
            toQuantity,
            quantity: Math.max(0, fromQuantity - transferredQuantity)
          };
        })
        .filter((item) => item.quantity > 0);
      return { routeIndex, legIndex, from, to, items };
    });
  });
}

function renderEquipmentTransferUnusedPanel() {
  const host = equipmentQuery("#equipmentSummaryTransferUnused");
  if (!host) return;
  const legs = equipmentTransferUnusedByLeg();
  const hasConfiguredRoute = equipmentState.summaryTransferEnabled
    && equipmentSummaryTransferRoutesWithEvents(activeEquipmentEvents(), true).length > 0;
  host.classList.toggle("is-hidden", !hasConfiguredRoute);
  if (!hasConfiguredRoute) {
    host.innerHTML = "";
    return;
  }
  const legsWithUnusedItems = legs.filter((leg) => leg.items.length);
  if (!legsWithUnusedItems.length) {
    host.innerHTML = `
      <div class="equipment-transfer-unused-heading">
        <strong>Equipo no requerido para evento</strong>
        <span>Todo el equipo del origen también se utiliza en cada destino configurado.</span>
      </div>`;
    return;
  }
  host.innerHTML = `
    <div class="equipment-transfer-unused-heading">
      <strong>Equipo no requerido para evento</strong>
      <span>Estas cantidades no deben continuar al siguiente destino y no se suman como equipo trasegado.</span>
    </div>
    <div class="equipment-transfer-unused-list">
      ${legsWithUnusedItems.map(({ routeIndex, legIndex, from, to, items }) => {
        const fromIndex = activeEquipmentEvents().indexOf(from);
        const toIndex = activeEquipmentEvents().indexOf(to);
        const fromTitle = equipmentEventCardTitle(from, fromIndex);
        const toTitle = equipmentEventCardTitle(to, toIndex);
        const destinationEventName = to?.name?.trim() || "Evento por definir";
        return `
          <section class="equipment-transfer-unused-leg" data-equipment-unused-leg="${escapeEquipmentHtml(`${from.id}:${to.id}`)}">
            <div class="equipment-transfer-unused-leg-heading">
              <span>${escapeEquipmentHtml(`Trasiego ${routeIndex + 1} · tramo ${legIndex + 1}`)}</span>
              <strong>${escapeEquipmentHtml(toTitle)}</strong>
              <small>${escapeEquipmentHtml(`Evento: ${destinationEventName} · Fecha: ${equipmentEventDateLabel(to)}`)}</small>
              <p>${escapeEquipmentHtml(`Desde ${fromTitle}: no trasladar al destino las siguientes cantidades.`)}</p>
            </div>
            <div class="equipment-transfer-unused-items">
              ${items.map((item) => `
                <div class="equipment-transfer-unused-item" data-equipment-unused-key="${escapeEquipmentHtml(item.identity)}">
                  <strong>${escapeEquipmentHtml(item.quantity)}</strong>
                  <span>
                    ${escapeEquipmentHtml(item.description)}
                    <small>${escapeEquipmentHtml(item.categoryTitle)}</small>
                  </span>
                </div>`).join("")}
            </div>
          </section>`;
      }).join("")}
    </div>`;
}

function equipmentFilterSummaryRows(rows, searchTerm = equipmentState.summarySearchTerm) {
  const query = normalizeEquipmentKey(searchTerm);
  const filtered = [];
  let currentCategory = null;
  let currentMatches = [];
  const flushCategory = () => {
    if (currentCategory && currentMatches.length) {
      filtered.push(currentCategory, ...currentMatches);
    }
  };
  rows.forEach((row) => {
    if (row.type === "category") {
      flushCategory();
      currentCategory = row;
      currentMatches = [];
      return;
    }
    if ((Number(row.quantity) || 0) <= 0) return;
    const haystack = normalizeEquipmentKey(`${row.description || ""} ${row.categoryTitle || ""}`);
    if (!query || haystack.includes(query)) currentMatches.push(row);
  });
  flushCategory();
  return filtered;
}

function equipmentSummaryTransferNotice() {
  if (!equipmentState.summaryTransferEnabled) return { text: "", type: "" };
  const events = activeEquipmentEvents();
  if (events.length < 2) {
    return {
      type: "warning",
      text: "Agregue al menos dos ventanas para seleccionar lugares de trasiego."
    };
  }
  const transferRoutes = equipmentSummaryTransferRoutesWithEvents(events, true);
  if (!transferRoutes.length) {
    return {
      type: "warning",
      text: "Agregue un origen y un destino al trasiego. Puede continuarlo sin límite o crear trasiegos múltiples."
    };
  }
  const labels = transferRoutes
    .map(({ route, events: routeEvents }, routeIndex) => {
      const routeLabel = routeEvents
        .map((event) => equipmentSummaryColumnName(event, events.indexOf(event)))
        .join(" -> ");
      const selectedTypes = routeEvents.slice(0, -1).reduce((total, from, index) => (
        total + equipmentSelectedTransferredItemsBetweenEvents(route, from, routeEvents[index + 1]).length
      ), 0);
      return `Trasiego ${routeIndex + 1}: ${routeLabel} (${selectedTypes} tipos elegidos)`;
    })
    .join(" | ");
  return {
    type: "ok",
    text: `${labels}. Solo el equipo elegido se descuenta como trasegado; todo lo demás conserva su cálculo por fecha y hora.`
  };
}

function renderEquipmentSummaryTransferNotice() {
  const notice = equipmentQuery("#equipmentSummaryTransferNotice");
  if (!notice) return;
  const { text, type } = equipmentSummaryTransferNotice();
  notice.textContent = text;
  notice.classList.toggle("is-hidden", !text);
  notice.classList.toggle("is-warning", type === "warning");
  notice.classList.toggle("is-ok", type === "ok");
}

function equipmentTransferLegEditorHtml(route, from, to, legIndex, comparisonRows) {
  const legKey = equipmentTransferLegKey(from.id, to.id);
  const candidates = equipmentTransferredItemsBetweenEvents(from, to, comparisonRows);
  const selectedItems = equipmentSelectedTransferredItemsBetweenEvents(route, from, to, candidates);
  const options = candidates.map((item) => `
    <option value="${escapeEquipmentHtml(item.identity)}" data-max="${escapeEquipmentHtml(item.quantity)}">
      ${escapeEquipmentHtml(`${item.description} · máximo ${item.quantity}`)}
    </option>`).join("");
  const selectedRows = selectedItems.map((item) => `
    <tr>
      <td>
        <input
          class="equipment-transfer-selected-quantity"
          data-equipment-transfer-selected-quantity
          data-equipment-transfer-leg-key="${escapeEquipmentHtml(legKey)}"
          data-equipment-transfer-identity="${escapeEquipmentHtml(item.identity)}"
          type="number"
          min="1"
          max="${escapeEquipmentHtml(item.availableQuantity)}"
          step="1"
          value="${escapeEquipmentHtml(item.quantity)}"
          aria-label="Cantidad de ${escapeEquipmentHtml(item.description)} para trasegar"
        />
      </td>
      <td>${escapeEquipmentHtml(item.description)}</td>
      <td>${escapeEquipmentHtml(item.categoryTitle)}</td>
      <td><button type="button" data-equipment-transfer-remove-item data-equipment-transfer-leg-key="${escapeEquipmentHtml(legKey)}" data-equipment-transfer-identity="${escapeEquipmentHtml(item.identity)}" aria-label="Quitar ${escapeEquipmentHtml(item.description)} del trasiego">X</button></td>
    </tr>`).join("");
  const timing = equipmentLogisticsPairAnalysis(from, to);
  const timingLabel = timing.timingKnown
    ? timing.rentApplies
      ? `Tiempo ajustado: ${formatEquipmentMinutes(timing.rawGapMinutes)} entre ingreso y montaje. Revise si corresponde renta.`
      : `Tiempo disponible: ${formatEquipmentMinutes(timing.rawGapMinutes)} entre ingreso y montaje.`
    : "Complete montaje e ingreso para validar el tiempo del traslado.";
  return `
    <section class="equipment-transfer-leg-editor" data-equipment-transfer-leg-editor data-from-event-id="${escapeEquipmentHtml(from.id)}" data-to-event-id="${escapeEquipmentHtml(to.id)}">
      <header>
        <div>
          <span>${escapeEquipmentHtml(`Tramo ${legIndex + 1}`)}</span>
          <strong>${escapeEquipmentHtml(`${from.place || "Origen"} hacia ${to.place || "Destino"}`)}</strong>
        </div>
        <small class="${timing.rentApplies ? "is-warning" : ""}">${escapeEquipmentHtml(timingLabel)}</small>
      </header>
      <div class="equipment-transfer-item-picker">
        <label>
          Equipo que se va a trasegar
          <select data-equipment-transfer-item-select ${candidates.length ? "" : "disabled"}>
            <option value="">Seleccione equipo</option>
            ${options}
          </select>
        </label>
        <label>
          Cantidad
          <input data-equipment-transfer-item-quantity type="number" min="1" step="1" value="1" ${candidates.length ? "" : "disabled"} />
        </label>
        <button type="button" data-equipment-transfer-add-item disabled title="Agregar equipo al trasiego" aria-label="Agregar equipo al trasiego">+</button>
      </div>
      ${selectedRows ? `
        <div class="equipment-transfer-selected-list">
          <table>
            <thead><tr><th>Cantidad</th><th>Equipo</th><th>Categoría</th><th>Acción</th></tr></thead>
            <tbody>${selectedRows}</tbody>
          </table>
        </div>` : '<p class="equipment-empty">Aún no ha seleccionado equipo para este tramo.</p>'}
    </section>`;
}

function renderEquipmentSummaryTransferSelector() {
  const host = equipmentQuery("#equipmentSummaryTransferSelector");
  if (!host) return;
  const events = activeEquipmentEvents();
  cleanupEquipmentSummaryTransferRoutes(events);
  host.classList.toggle("is-hidden", !equipmentState.summaryTransferEnabled);
  if (!equipmentState.summaryTransferEnabled) {
    host.innerHTML = "";
    return;
  }
  if (events.length < 2) {
    host.innerHTML = `<p class="equipment-empty">Cree dos o más ventanas para elegir los lugares del trasiego.</p>`;
    return;
  }
  const routes = equipmentSummaryTransferRoutesWithEvents(events);
  const activeRoute = equipmentActiveSummaryTransferRoute(events);
  const activeRouteEvents = equipmentTransferRouteEvents(activeRoute, events);
  const availableEvents = events.filter((event) => !activeRoute?.eventIds.includes(event.id));
  const routeTabs = routes
    .map(({ route, events: routeEvents }, index) => `
      <button
        type="button"
        class="equipment-transfer-route-tab${route.id === activeRoute?.id ? " is-active" : ""}"
        data-equipment-transfer-route-id="${escapeEquipmentHtml(route.id)}"
      >
        Trasiego ${index + 1}
        <span>${escapeEquipmentHtml(routeEvents.length)} lugares</span>
      </button>`)
    .join("");
  const chain = activeRouteEvents.length
    ? activeRouteEvents
        .map((event, index) => {
          const eventIndex = events.indexOf(event);
          const title = equipmentEventCardTitle(event, eventIndex);
          return `
            ${index ? '<span class="equipment-transfer-chain-arrow" aria-hidden="true">→</span>' : ""}
            <article class="equipment-transfer-chain-event">
              <span>${escapeEquipmentHtml(index ? `Destino ${index}` : "Origen")}</span>
              <strong>${escapeEquipmentHtml(`${eventIndex + 1}. ${title}`)}</strong>
              <small>${escapeEquipmentHtml(`Evento: ${event.name || "Por definir"} · Montaje: ${equipmentEventSetupDateTimeLabel(event)}`)}</small>
              <button
                type="button"
                data-equipment-transfer-remove-event="${escapeEquipmentHtml(event.id)}"
                aria-label="Quitar ${escapeEquipmentHtml(title)} del trasiego"
              >Quitar</button>
            </article>`;
        })
        .join("")
    : `<p class="equipment-empty">Seleccione primero el origen y después agregue todos los destinos de esta ruta.</p>`;
  const eventOptions = availableEvents
    .map((event) => {
      const eventIndex = events.indexOf(event);
      const title = equipmentEventCardTitle(event, eventIndex);
      return `<option value="${escapeEquipmentHtml(event.id)}">${escapeEquipmentHtml(`${eventIndex + 1}. ${title} · ${equipmentEventTransferDateTime(event)}`)}</option>`;
    })
    .join("");
  const comparisonRows = activeRouteEvents.length > 1 ? equipmentTransferComparisonRows() : [];
  const legEditors = activeRouteEvents.slice(0, -1)
    .map((from, index) => equipmentTransferLegEditorHtml(activeRoute, from, activeRouteEvents[index + 1], index, comparisonRows))
    .join("");
  host.innerHTML = `
    <div class="equipment-transfer-selector-head">
      <div>
        <strong>Trasiegos múltiples</strong>
        <span>Cada ruta puede continuar por todos los eventos que necesite.</span>
      </div>
      <div class="equipment-transfer-selector-actions">
        <button type="button" data-equipment-transfer-new-route>Trasiego múltiple</button>
        <button type="button" data-equipment-transfer-delete-route>Eliminar trasiego</button>
      </div>
    </div>
    <div class="equipment-transfer-route-tabs" role="tablist" aria-label="Rutas de trasiego">${routeTabs}</div>
    <div class="equipment-transfer-chain">${chain}</div>
    <div class="equipment-transfer-leg-editors">${legEditors}</div>
    <div class="equipment-transfer-continue-row">
      <label>
        ${activeRouteEvents.length ? "Siguiente lugar" : "Lugar de origen"}
        <select data-equipment-transfer-next-event ${availableEvents.length ? "" : "disabled"}>
          <option value="">Seleccione un evento</option>
          ${eventOptions}
        </select>
      </label>
      <button type="button" data-equipment-transfer-continue disabled>Continuar trasiego</button>
      <button type="button" data-equipment-transfer-clear-route ${activeRouteEvents.length ? "" : "disabled"}>Limpiar ruta</button>
    </div>`;
}

function bindEquipmentSummaryTransferSelector() {
  const host = equipmentQuery("#equipmentSummaryTransferSelector");
  if (!host) return;
  host.querySelectorAll("[data-equipment-transfer-route-id]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.activeSummaryTransferRouteId = button.dataset.equipmentTransferRouteId || "";
      renderEquipmentModule();
    });
  });
  host.querySelectorAll("[data-equipment-transfer-remove-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = equipmentActiveSummaryTransferRoute();
      if (!route) return;
      invalidateEquipmentRentalPreview();
      route.eventIds = route.eventIds.filter((eventId) => eventId !== button.dataset.equipmentTransferRemoveEvent);
      renderEquipmentModule();
    });
  });
  const nextEventSelect = host.querySelector("[data-equipment-transfer-next-event]");
  const continueButton = host.querySelector("[data-equipment-transfer-continue]");
  nextEventSelect?.addEventListener("change", () => {
    if (continueButton) continueButton.disabled = !nextEventSelect.value;
  });
  continueButton?.addEventListener("click", () => {
    const route = equipmentActiveSummaryTransferRoute();
    const eventId = nextEventSelect?.value || "";
    if (!route || !eventId || route.eventIds.includes(eventId)) return;
    const destination = activeEquipmentEvents().find((event) => event.id === eventId);
    const origin = equipmentTransferRouteEvents(route).at(-1) || null;
    const addEventToRoute = () => {
      invalidateEquipmentRentalPreview();
      route.eventIds.push(eventId);
      renderEquipmentModule();
    };
    if (!origin || !destination) {
      addEventToRoute();
      return;
    }
    openEquipmentLogisticsDecision({
      from: origin,
      to: destination,
      context: "transfer-leg",
      onTransfer: addEventToRoute,
      onRent: () => previewEquipmentRentReport({ skipLogisticsDecision: true })
    });
  });
  host.querySelector("[data-equipment-transfer-new-route]")?.addEventListener("click", () => {
    invalidateEquipmentRentalPreview();
    const route = createEquipmentSummaryTransferRoute();
    equipmentState.summaryTransferRoutes.push(route);
    equipmentState.activeSummaryTransferRouteId = route.id;
    renderEquipmentModule();
  });
  host.querySelector("[data-equipment-transfer-delete-route]")?.addEventListener("click", () => {
    invalidateEquipmentRentalPreview();
    const activeRouteId = equipmentState.activeSummaryTransferRouteId;
    equipmentState.summaryTransferRoutes = equipmentState.summaryTransferRoutes.filter(
      (route) => route.id !== activeRouteId
    );
    if (!equipmentState.summaryTransferRoutes.length) {
      equipmentState.summaryTransferRoutes.push(createEquipmentSummaryTransferRoute());
    }
    equipmentState.activeSummaryTransferRouteId = equipmentState.summaryTransferRoutes[0].id;
    renderEquipmentModule();
  });
  host.querySelector("[data-equipment-transfer-clear-route]")?.addEventListener("click", () => {
    const route = equipmentActiveSummaryTransferRoute();
    if (route) {
      invalidateEquipmentRentalPreview();
      route.eventIds = [];
      route.legSelections = {};
    }
    renderEquipmentModule();
  });
  host.querySelectorAll("[data-equipment-transfer-leg-editor]").forEach((editor) => {
    const select = editor.querySelector("[data-equipment-transfer-item-select]");
    const quantityInput = editor.querySelector("[data-equipment-transfer-item-quantity]");
    const addButton = editor.querySelector("[data-equipment-transfer-add-item]");
    const updateAddButton = () => {
      if (addButton) addButton.disabled = !select?.value;
      const option = select?.selectedOptions?.[0];
      if (quantityInput && option?.dataset?.max) quantityInput.max = option.dataset.max;
    };
    select?.addEventListener("change", updateAddButton);
    addButton?.addEventListener("click", () => {
      const route = equipmentActiveSummaryTransferRoute();
      const events = activeEquipmentEvents();
      const from = events.find((event) => event.id === editor.dataset.fromEventId);
      const to = events.find((event) => event.id === editor.dataset.toEventId);
      const identity = equipmentInventoryCanonicalKey(select?.value);
      if (!route || !from || !to || !identity) return;
      const candidates = equipmentTransferredItemsBetweenEvents(from, to);
      const candidate = candidates.find((item) => item.identity === identity);
      if (!candidate) return;
      const requested = Math.max(1, Math.floor(Number(quantityInput?.value) || 1));
      invalidateEquipmentRentalPreview();
      const selected = equipmentSelectedTransferredItemsBetweenEvents(route, from, to, candidates)
        .map((item) => ({ identity: item.identity, quantity: item.quantity }));
      const existing = selected.find((item) => item.identity === identity);
      if (existing) existing.quantity = Math.min(candidate.quantity, existing.quantity + requested);
      else selected.push({ identity, quantity: Math.min(candidate.quantity, requested) });
      equipmentSetTransferLegSelections(route, from, to, selected);
      renderEquipmentModule();
    });
  });
  host.querySelectorAll("[data-equipment-transfer-selected-quantity]").forEach((input) => {
    input.addEventListener("change", () => {
      const route = equipmentActiveSummaryTransferRoute();
      const [fromId, toId] = String(input.dataset.equipmentTransferLegKey || "").split("::");
      const events = activeEquipmentEvents();
      const from = events.find((event) => event.id === fromId);
      const to = events.find((event) => event.id === toId);
      if (!route || !from || !to) return;
      const candidates = equipmentTransferredItemsBetweenEvents(from, to);
      const candidate = candidates.find((item) => item.identity === input.dataset.equipmentTransferIdentity);
      const selected = equipmentSelectedTransferredItemsBetweenEvents(route, from, to, candidates)
        .map((item) => ({ identity: item.identity, quantity: item.quantity }));
      const item = selected.find((selection) => selection.identity === input.dataset.equipmentTransferIdentity);
      if (!item || !candidate) return;
      invalidateEquipmentRentalPreview();
      item.quantity = Math.min(candidate.quantity, Math.max(1, Math.floor(Number(input.value) || 1)));
      equipmentSetTransferLegSelections(route, from, to, selected);
      renderEquipmentModule();
    });
  });
  host.querySelectorAll("[data-equipment-transfer-remove-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const route = equipmentActiveSummaryTransferRoute();
      const [fromId, toId] = String(button.dataset.equipmentTransferLegKey || "").split("::");
      const events = activeEquipmentEvents();
      const from = events.find((event) => event.id === fromId);
      const to = events.find((event) => event.id === toId);
      if (!route || !from || !to) return;
      invalidateEquipmentRentalPreview();
      const selections = equipmentSelectedTransferredItemsBetweenEvents(route, from, to)
        .filter((item) => item.identity !== button.dataset.equipmentTransferIdentity)
        .map((item) => ({ identity: item.identity, quantity: item.quantity }));
      equipmentSetTransferLegSelections(route, from, to, selections);
      renderEquipmentModule();
    });
  });
}

function tableForEquipmentSections(sections, compact = false) {
  if (!sections.length) {
    return `<p class="equipment-empty">Seleccione un servicio para cargar el equipo.</p>`;
  }
  const rows = sections
    .map((section) => {
      const inventoryCategories = compact ? [] : equipmentInventoryCategoriesForSection(section);
      const sectionId = String(section.id || "");
      const expanded = !compact && equipmentState.expandedEquipmentSectionIds.has(sectionId);
      const items = section.items
        .map((rawItem) => {
          const item = normalizeEquipmentItem(rawItem);
          if (!compact && item.editable && item.id) {
            const recognized = equipmentRecognizedInventoryChoice(item.description);
            const recognitionClass = recognized ? "" : " is-unrecognized";
            return `
              <tr class="equipment-service-item-row${recognitionClass}">
                <td class="equipment-qty equipment-service-quantity-cell">
                  <input class="equipment-line-quantity" data-equipment-item-id="${escapeEquipmentHtml(item.id)}" data-equipment-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(item.quantity)}" />
                </td>
                <td class="equipment-service-description-cell">
                  <input class="equipment-line-description${recognitionClass}" data-equipment-item-id="${escapeEquipmentHtml(item.id)}" data-equipment-field="description" type="text" list="equipmentInventoryNameOptions" value="${escapeEquipmentHtml(item.description)}" aria-invalid="${recognized ? "false" : "true"}" />
                  <span class="equipment-name-warning${recognized ? " is-hidden" : ""}">Nombre no reconocido. Seleccione el nombre exacto del inventario.</span>
                </td>
                <td class="equipment-row-action">
                  <button class="equipment-row-remove" type="button" data-remove-equipment-item="${escapeEquipmentHtml(item.id)}" aria-label="Eliminar línea">X</button>
                </td>
              </tr>`;
          }
          return `
            <tr>
              <td class="equipment-qty equipment-service-quantity-cell">${escapeEquipmentHtml(item.quantity)}</td>
              <td class="equipment-service-description-cell">${escapeEquipmentHtml(item.description)}</td>
              ${compact ? "" : `<td class="equipment-row-action"></td>`}
            </tr>`;
        })
        .join("");
      if (compact) {
        return `
          <tr class="equipment-category-row">
            <td colspan="2">${escapeEquipmentHtml(section.title)}</td>
          </tr>
          ${items}`;
      }
      const categoryTitleEditor = section.manualSection
        ? `<label>Nombre de la categoría<input data-equipment-manual-section-title="${escapeEquipmentHtml(sectionId)}" type="text" value="${escapeEquipmentHtml(section.title)}" /></label>`
        : "";
      const categoryRemoveButton = section.manualSection
        ? `<button class="equipment-category-remove" type="button" data-remove-equipment-section="${escapeEquipmentHtml(sectionId)}">Eliminar categoría</button>`
        : "";
      const library = expanded ? `
        <tr class="equipment-category-library-row">
          <td colspan="3">
            <div class="equipment-category-library">
              ${categoryTitleEditor}
              <label class="equipment-category-choice-label">
                Equipo disponible en esta categoría
                <select data-equipment-category-choice="${escapeEquipmentHtml(sectionId)}">
                  <option value="">Seleccione el equipo</option>
                  ${equipmentInventoryOptionsHtml(inventoryCategories)}
                </select>
              </label>
              <label class="equipment-category-quantity-label">
                Cantidad
                <input data-equipment-category-quantity="${escapeEquipmentHtml(sectionId)}" type="number" min="0" step="1" value="1" />
              </label>
              <button type="button" data-equipment-category-add="${escapeEquipmentHtml(sectionId)}">Agregar</button>
              ${categoryRemoveButton}
            </div>
          </td>
        </tr>` : "";
      return `
        <tr class="equipment-category-row">
          <td colspan="3">
            <button class="equipment-category-toggle" type="button" data-equipment-category-toggle="${escapeEquipmentHtml(sectionId)}" aria-expanded="${expanded ? "true" : "false"}">
              <span>${escapeEquipmentHtml(section.title)}</span>
              <small>${expanded ? "Ocultar opciones" : "Ver y elegir equipo"}</small>
              <b aria-hidden="true">${expanded ? "−" : "+"}</b>
            </button>
          </td>
        </tr>
        ${library}
        ${items}`;
    })
    .join("");

  return `
    <table class="equipment-base-table equipment-service-table${compact ? " equipment-table-compact" : ""}">
      <colgroup>
        <col class="equipment-service-quantity-column" />
        <col class="equipment-service-description-column" />
        ${compact ? "" : '<col class="equipment-service-action-column" />'}
      </colgroup>
      <thead>
        <tr>
          <th class="equipment-service-quantity-heading">Cantidad</th>
          <th class="equipment-service-description-heading">Equipo</th>
          ${compact ? "" : '<th class="equipment-service-action-heading">Acción</th>'}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function equipmentEventLineCount(event) {
  return sectionsForEquipmentEvent(event).reduce((total, section) => total + (section.items?.length || 0), 0);
}

function renderEquipmentEvents() {
  const host = equipmentQuery("#equipmentEventsList");
  if (!host) return;
  if (!equipmentState.events.length) {
    host.innerHTML = `<p class="equipment-empty equipment-window-empty">Cree una ventana para que aparezca en este panel.</p>`;
    return;
  }
  const orderedEvents = sortEquipmentEventsByDate(equipmentState.events);
  host.innerHTML = orderedEvents
    .map((event, index) => {
      const activeClass = event.id === equipmentState.selectedEventId ? " is-active" : "";
      const lineCount = equipmentEventLineCount(event);
      const serviceName = event.serviceName || "Sin servicio";
      const date = formatEquipmentDate(event.date);
      const setupAt = equipmentEventSetupDateTimeLabel(event);
      const cardTitle = equipmentEventCardTitle(event, index);
      const eventName = event.name && event.name !== "Evento por definir" ? event.name : "";
      const eventNameLine = eventName ? `<span>Evento: ${escapeEquipmentHtml(eventName)}</span>` : "";
      const logisticsLine = event.equipmentInAt
        ? `<span>Ingreso: ${escapeEquipmentHtml(equipmentEventReturnDateTime(event))}</span>`
        : "";
      return `
        <article class="equipment-event-card${activeClass}">
          <button class="equipment-event-open" type="button" data-open-event="${escapeEquipmentHtml(event.id)}">
            <strong>${escapeEquipmentHtml(`${index + 1}. ${cardTitle}`)}</strong>
            <small>${escapeEquipmentHtml(serviceName)}</small>
            ${eventNameLine}
            <span>Fecha del evento: ${escapeEquipmentHtml(date)}</span>
            <span>Montaje: ${escapeEquipmentHtml(setupAt)}</span>
            ${logisticsLine}
            <span>${escapeEquipmentHtml(lineCount)} líneas de equipo</span>
          </button>
          <div class="equipment-event-card-actions">
            <button class="equipment-event-pdf-button" type="button" data-save-event="${escapeEquipmentHtml(event.id)}" aria-label="Guardar PDF de ${escapeEquipmentHtml(cardTitle)}">PDF</button>
            <button class="equipment-event-remove-button" type="button" data-remove-event="${escapeEquipmentHtml(event.id)}" aria-label="Eliminar ventana">X</button>
            <button class="equipment-event-save-button" type="button" data-save-window="${escapeEquipmentHtml(event.id)}" aria-label="Guardar cambios de ${escapeEquipmentHtml(cardTitle)}">Guardar</button>
          </div>
        </article>`;
    })
    .join("");
  host.querySelectorAll("[data-open-event]").forEach((button) => {
    button.addEventListener("click", () => loadEquipmentEvent(button.dataset.openEvent));
  });
  host.querySelectorAll("[data-save-event]").forEach((button) => {
    button.addEventListener("click", () => saveEquipmentEventPdf(button.dataset.saveEvent));
  });
  host.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", () => removeEquipmentEventById(button.dataset.removeEvent));
  });
  host.querySelectorAll("[data-save-window]").forEach((button) => {
    button.addEventListener("click", () => saveEquipmentWindowById(button.dataset.saveWindow));
  });
}

function startNewEquipmentWindowDraft() {
  resetEquipmentWindowDraft();
  renderEquipmentModule();
  const status = equipmentQuery("#equipmentSaveStatus");
  if (status) status.textContent = "Nueva ventana lista. Ingrese los datos y seleccione el tipo de servicio.";
}

function addEquipmentEvent() {
  if (equipmentState.selectedEventId) {
    startNewEquipmentWindowDraft();
    return;
  }
  const draft = currentEquipmentEventDraft();
  const status = equipmentQuery("#equipmentSaveStatus");
  const serviceIds = selectedEquipmentServiceIds();
  if (!serviceIds.length) {
    if (status) status.textContent = "Seleccione el tipo de servicio antes de crear una ventana.";
    return;
  }
  if (!draft.place || draft.place === "Lugar por definir") {
    if (status) status.textContent = "Escriba el lugar del evento antes de crear la ventana.";
    return;
  }
  if (!draft.name || draft.name === "Evento por definir") {
    if (status) status.textContent = "Escriba el nombre del evento antes de crear la ventana.";
    return;
  }
  const createdEvent = {
    ...draft,
    ...captureEquipmentEventSnapshot(),
    id: `event-${Date.now()}-${equipmentEventCounter++}`,
    warehouseDispatchId: equipmentState.draftWarehouseDispatchId
  };
  invalidateEquipmentRentalPreview();
  equipmentState.events.push(createdEvent);
  resetEquipmentWindowDraft();
  renderEquipmentModule();
  const nextStatus = equipmentQuery("#equipmentSaveStatus");
  if (nextStatus) {
    nextStatus.textContent = `Ventana agregada para ${draft.place}. Ya puede capturar el siguiente evento.`;
  }
}

function refreshEquipmentSummaryAndPreview() {
  if (equipmentQuery("#equipmentInventoryTable")) {
    equipmentQuery("#equipmentInventoryTable").innerHTML = tableForEquipmentInventory(equipmentFilterSummaryRows(equipmentRowsSummary()), true);
  }
  renderEquipmentSummaryDateNotice();
  renderEquipmentSummaryTransferSelector();
  renderEquipmentSummaryTransferNotice();
  renderEquipmentTransferUnusedPanel();
  renderEquipmentTransferPanel();
  bindEquipmentInventoryInputs();
  bindEquipmentSummaryTransferSelector();
  renderEquipmentPdfPreview();
  renderEquipmentWindowState();
}

function updateEquipmentItem(itemId, field, value) {
  let manualMain = equipmentState.manualMainItems.find((item) => item.id === itemId);
  if (!manualMain) {
    for (const section of equipmentState.manualMainSections) {
      manualMain = section.items.find((item) => item.id === itemId);
      if (manualMain) break;
    }
  }
  if (!manualMain) {
    for (const items of equipmentState.sectionAddedItems.values()) {
      manualMain = items.find((item) => item.id === itemId);
      if (manualMain) break;
    }
  }
  const manualExtra = equipmentState.manualExtras.find((item) => item.id === itemId);
  const target = manualMain || manualExtra;
  const nextValue = field === "quantity" ? Number(value || 0) || 0 : String(value || "");
  if (target) {
    target[field] = nextValue;
    return;
  }
  const override = equipmentState.itemOverrides.get(itemId) || {};
  override[field] = nextValue;
  equipmentState.itemOverrides.set(itemId, override);
}

function pushDeletedEquipment(entry) {
  equipmentState.deletedStack.push(entry);
}

function removeManualEquipmentItem(itemId) {
  const legacyIndex = equipmentState.manualMainItems.findIndex((item) => item.id === itemId);
  if (legacyIndex >= 0) {
    const [item] = equipmentState.manualMainItems.splice(legacyIndex, 1);
    pushDeletedEquipment({ type: "manual-main", item, index: legacyIndex });
    renderEquipmentModule();
    return;
  }

  for (const section of equipmentState.manualMainSections) {
    const itemIndex = section.items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) {
      const [item] = section.items.splice(itemIndex, 1);
      pushDeletedEquipment({ type: "manual-section-item", sectionId: section.id, item, index: itemIndex });
      renderEquipmentModule();
      return;
    }
  }

  for (const [sectionId, items] of equipmentState.sectionAddedItems.entries()) {
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex < 0) continue;
    const [item] = items.splice(itemIndex, 1);
    if (!items.length) equipmentState.sectionAddedItems.delete(sectionId);
    pushDeletedEquipment({ type: "section-added-item", sectionId, item, index: itemIndex });
    renderEquipmentModule();
    return;
  }

  const extraIndex = equipmentState.manualExtras.findIndex((item) => item.id === itemId);
  if (extraIndex >= 0) {
    const [item] = equipmentState.manualExtras.splice(extraIndex, 1);
    pushDeletedEquipment({ type: "manual-extra", item, index: extraIndex });
    renderEquipmentModule();
    return;
  }

  const override = equipmentState.itemOverrides.get(itemId);
  equipmentState.removedItemIds.add(itemId);
  equipmentState.itemOverrides.delete(itemId);
  pushDeletedEquipment({ type: "service-item", itemId, override });
  renderEquipmentModule();
}

function removeManualEquipmentSection(sectionId) {
  if (sectionId === "equipo-manual") {
    const items = [...equipmentState.manualMainItems];
    if (!items.length) return;
    equipmentState.manualMainItems = [];
    pushDeletedEquipment({ type: "manual-main-items", items });
  } else {
    const sectionIndex = equipmentState.manualMainSections.findIndex((section) => section.id === sectionId);
    if (sectionIndex < 0) return;
    const [section] = equipmentState.manualMainSections.splice(sectionIndex, 1);
    pushDeletedEquipment({ type: "manual-section", section, index: sectionIndex });
  }
  renderEquipmentModule();
}

function restoreLastDeletedEquipment() {
  const entry = equipmentState.deletedStack.pop();
  if (!entry) return;
  if (entry.type === "manual-main") {
    equipmentState.manualMainItems.splice(entry.index, 0, entry.item);
  } else if (entry.type === "manual-section-item") {
    const section = equipmentState.manualMainSections.find((item) => item.id === entry.sectionId);
    if (section) section.items.splice(entry.index, 0, entry.item);
  } else if (entry.type === "manual-extra") {
    equipmentState.manualExtras.splice(entry.index, 0, entry.item);
  } else if (entry.type === "section-added-item") {
    const items = equipmentState.sectionAddedItems.get(entry.sectionId) || [];
    items.splice(entry.index, 0, entry.item);
    equipmentState.sectionAddedItems.set(entry.sectionId, items);
  } else if (entry.type === "service-item") {
    equipmentState.removedItemIds.delete(entry.itemId);
    if (entry.override) equipmentState.itemOverrides.set(entry.itemId, entry.override);
  } else if (entry.type === "manual-main-items") {
    equipmentState.manualMainItems = [...entry.items, ...equipmentState.manualMainItems];
  } else if (entry.type === "manual-section") {
    equipmentState.manualMainSections.splice(entry.index, 0, entry.section);
  }
  renderEquipmentModule();
}

function equipmentManualSectionForId(sectionId) {
  return equipmentState.manualMainSections.find((section) => section.id === sectionId) || null;
}

function addEquipmentChoiceToSection(sectionId) {
  const section = selectedEquipmentSections().find((entry) => entry.id === sectionId);
  const select = [...document.querySelectorAll("[data-equipment-category-choice]")]
    .find((element) => element.dataset.equipmentCategoryChoice === sectionId);
  const quantityInput = [...document.querySelectorAll("[data-equipment-category-quantity]")]
    .find((element) => element.dataset.equipmentCategoryQuantity === sectionId);
  const status = equipmentQuery("#equipmentSaveStatus");
  const description = String(select?.value || "").trim();
  const quantity = Math.max(0, Number(quantityInput?.value || 0) || 0);
  if (!section || !description) {
    if (status) status.textContent = "Seleccione un equipo del inventario antes de agregarlo.";
    return;
  }
  const existing = (section.items || [])
    .map(normalizeEquipmentItem)
    .find((item) => equipmentInventoryCanonicalKey(item.description) === equipmentInventoryCanonicalKey(description));
  if (existing?.id) {
    updateEquipmentItem(existing.id, "quantity", (Number(existing.quantity) || 0) + quantity);
  } else if (sectionId === "extras-manuales") {
    equipmentState.manualExtras.push({
      id: `manual-extra-${Date.now()}-${equipmentExtraCounter++}`,
      quantity,
      description
    });
  } else {
    const manualSection = equipmentManualSectionForId(sectionId);
    if (manualSection) {
      manualSection.items.push({
        id: `manual-main-${Date.now()}-${equipmentManualMainCounter++}`,
        quantity,
        description
      });
    } else {
      const addedItems = equipmentState.sectionAddedItems.get(sectionId) || [];
      addedItems.push({
        id: `section-item-${Date.now()}-${equipmentManualMainCounter++}`,
        quantity,
        description
      });
      equipmentState.sectionAddedItems.set(sectionId, addedItems);
    }
  }
  if (status) status.textContent = `Equipo agregado en ${section.title}: ${description}`;
  renderEquipmentModule();
}

function updateEquipmentRecognitionState(input) {
  if (!input || input.dataset.equipmentField !== "description") return;
  const recognized = equipmentRecognizedInventoryChoice(input.value);
  input.classList.toggle("is-unrecognized", !recognized);
  input.setAttribute("aria-invalid", String(!recognized));
  const row = input.closest("tr");
  row?.classList.toggle("is-unrecognized", !recognized);
  row?.querySelector(".equipment-name-warning")?.classList.toggle("is-hidden", recognized);
}

function bindEquipmentSectionInputs() {
  const host = equipmentQuery("#equipmentMainTable");
  if (!host) return;
  host.querySelectorAll("[data-equipment-item-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateEquipmentItem(input.dataset.equipmentItemId, input.dataset.equipmentField, event.target.value);
      updateEquipmentRecognitionState(input);
      refreshEquipmentSummaryAndPreview();
    });
    input.addEventListener("change", renderEquipmentModule);
  });
  host.querySelectorAll("[data-equipment-category-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.equipmentCategoryToggle || "";
      if (equipmentState.expandedEquipmentSectionIds.has(sectionId)) {
        equipmentState.expandedEquipmentSectionIds.delete(sectionId);
      } else {
        equipmentState.expandedEquipmentSectionIds.add(sectionId);
      }
      renderEquipmentModule();
    });
  });
  host.querySelectorAll("[data-equipment-category-add]").forEach((button) => {
    button.addEventListener("click", () => addEquipmentChoiceToSection(button.dataset.equipmentCategoryAdd || ""));
  });
  host.querySelectorAll("[data-equipment-manual-section-title]").forEach((input) => {
    input.addEventListener("change", () => {
      const section = equipmentManualSectionForId(input.dataset.equipmentManualSectionTitle || "");
      if (section && input.value.trim()) section.title = input.value.trim();
      renderEquipmentModule();
    });
  });
  host.querySelectorAll("[data-remove-equipment-item]").forEach((button) => {
    button.addEventListener("click", () => removeManualEquipmentItem(button.dataset.removeEquipmentItem));
  });
  host.querySelectorAll("[data-remove-equipment-section]").forEach((button) => {
    button.addEventListener("click", () => removeManualEquipmentSection(button.dataset.removeEquipmentSection));
  });
}

function addManualMainEquipmentItem() {
  const quantityInput = equipmentQuery("#equipmentManualMainQuantity");
  const descriptionInput = equipmentQuery("#equipmentManualMainDescription");
  const status = equipmentQuery("#equipmentSaveStatus");
  const description = descriptionInput?.value.trim() || "";
  const quantity = Number(quantityInput?.value || 0) || 0;
  if (!description) {
    if (status) status.textContent = "Escriba el nombre del equipo antes de agregarlo.";
    return;
  }
  const manualSection = ensureManualMainSection();
  manualSection.items.push({
    id: `manual-main-${Date.now()}-${equipmentManualMainCounter++}`,
    quantity,
    description
  });
  if (descriptionInput) descriptionInput.value = "";
  if (quantityInput) quantityInput.value = "1";
  if (status) status.textContent = `Equipo agregado: ${description}`;
  renderEquipmentModule();
}

function addManualEquipmentSubtitle() {
  const subtitleInput = equipmentQuery("#equipmentManualSubtitle");
  const status = equipmentQuery("#equipmentSaveStatus");
  const title = subtitleInput?.value.trim() || "";
  if (!title) {
    if (status) status.textContent = "Escriba el subtítulo antes de agregarlo.";
    return;
  }
  equipmentState.manualMainSections.push({
    id: `manual-section-${Date.now()}-${equipmentManualSectionCounter++}`,
    title,
    items: []
  });
  if (subtitleInput) subtitleInput.value = "";
  if (status) status.textContent = `Subtítulo agregado: ${title}`;
  renderEquipmentModule();
}

function renderEquipmentPredefinedExtras() {
  const host = equipmentQuery("#equipmentPredefinedExtras");
  if (!host) return;
  const services = currentEquipmentServices();
  const extraEntries = services.flatMap((service) => {
    return (service.extras || []).map((extra) => ({ service, extra }));
  });
  if (!extraEntries.length) {
    host.innerHTML = `<p class="equipment-empty">Este servicio no tiene extras cargados.</p>`;
    return;
  }
  const hasMultipleServices = services.length > 1;
  host.innerHTML = extraEntries
    .map(({ service, extra }) => {
      const extraKey = equipmentExtraSelectionKey(service.id, extra.id);
      const checked = isEquipmentExtraSelected(service.id, extra.id, services.length <= 1) ? "checked" : "";
      const itemCount = extra.items?.length || 0;
      const title = hasMultipleServices ? `${service.name} / ${extra.title}` : extra.title;
      return `
        <label class="equipment-extra-card">
          <input type="checkbox" data-extra-key="${escapeEquipmentHtml(extraKey)}" data-extra-id="${escapeEquipmentHtml(extra.id)}" ${checked} />
          <span>
            <strong>${escapeEquipmentHtml(title)}</strong>
            <span>${escapeEquipmentHtml(itemCount)} línea(s) de equipo</span>
          </span>
        </label>`;
    })
    .join("");
  host.querySelectorAll("[data-extra-key]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        equipmentState.selectedExtraIds.add(input.dataset.extraKey);
        equipmentState.selectedExtraIds.delete(input.dataset.extraId);
      } else {
        equipmentState.selectedExtraIds.delete(input.dataset.extraKey);
        equipmentState.selectedExtraIds.delete(input.dataset.extraId);
      }
      renderEquipmentModule();
    });
  });
}

function renderManualEquipmentExtras() {
  const host = equipmentQuery("#equipmentManualExtrasList");
  if (!host) return;
  if (!equipmentState.manualExtras.length) {
    host.innerHTML = `<p class="equipment-empty">Aún no hay extras manuales agregados.</p>`;
    return;
  }
  host.innerHTML = equipmentState.manualExtras
    .map((extra) => {
      const recognized = equipmentRecognizedInventoryChoice(extra.description);
      return `
        <article class="equipment-extra-line equipment-extra-line-editable${recognized ? "" : " is-unrecognized"}">
          <label>
            Cantidad
            <input data-manual-extra-id="${escapeEquipmentHtml(extra.id)}" data-equipment-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(extra.quantity)}" />
          </label>
          <label>
            Equipo extra
            <input class="${recognized ? "" : "is-unrecognized"}" data-manual-extra-id="${escapeEquipmentHtml(extra.id)}" data-equipment-field="description" type="text" list="equipmentInventoryNameOptions" value="${escapeEquipmentHtml(extra.description)}" aria-invalid="${recognized ? "false" : "true"}" />
            <span class="equipment-name-warning${recognized ? " is-hidden" : ""}">Nombre no reconocido por el inventario.</span>
          </label>
          <button type="button" data-remove-extra="${escapeEquipmentHtml(extra.id)}" aria-label="Eliminar extra">X</button>
        </article>`;
    })
    .join("");
  host.querySelectorAll("[data-manual-extra-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateEquipmentItem(input.dataset.manualExtraId, input.dataset.equipmentField, event.target.value);
      if (input.dataset.equipmentField === "description") {
        const recognized = equipmentRecognizedInventoryChoice(input.value);
        input.classList.toggle("is-unrecognized", !recognized);
        input.setAttribute("aria-invalid", String(!recognized));
        input.closest("article")?.classList.toggle("is-unrecognized", !recognized);
        input.parentElement?.querySelector(".equipment-name-warning")?.classList.toggle("is-hidden", recognized);
      }
      refreshEquipmentSummaryAndPreview();
    });
    input.addEventListener("change", renderEquipmentModule);
  });
  host.querySelectorAll("[data-remove-extra]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.manualExtras = equipmentState.manualExtras.filter((extra) => extra.id !== button.dataset.removeExtra);
      renderEquipmentModule();
    });
  });
}

function addManualEquipmentExtra() {
  const quantityInput = equipmentQuery("#equipmentExtraQuantity");
  const descriptionInput = equipmentQuery("#equipmentExtraDescription");
  const status = equipmentQuery("#equipmentSaveStatus");
  const description = descriptionInput?.value.trim() || "";
  const quantity = Number(quantityInput?.value || 0) || 0;
  if (!description) {
    if (status) status.textContent = "Escriba el nombre del extra antes de agregarlo.";
    return;
  }
  equipmentState.manualExtras.push({
    id: `manual-extra-${Date.now()}-${equipmentExtraCounter++}`,
    quantity,
    description
  });
  if (descriptionInput) descriptionInput.value = "";
  if (quantityInput) quantityInput.value = "1";
  if (status) status.textContent = `Extra agregado: ${description}`;
  renderEquipmentModule();
}

const equipmentDefaultInventory = new Map();
const equipmentDefaultInventoryLookup = new Map();
const equipmentInventoryStaticItemsByWarehouseId = new Map();
const equipmentInventoryWarehouseIdByRowKey = new Map();
function equipmentInventoryLookupKey(value) {
  return normalizeEquipmentKey(value)
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function equipmentInventorySourceValue(item) {
  if (item && Object.prototype.hasOwnProperty.call(item, "value")) return item.value;
  return item?.sourceQuantity ?? "";
}

function equipmentInventoryNumber(value) {
  const clean = String(value ?? "").trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(clean)) return 0;
  const number = Number(clean);
  return Number.isFinite(number) ? number : 0;
}

function equipmentInventoryIsExplicitZero(value) {
  const clean = String(value ?? "").trim().replace(",", ".");
  return Boolean(clean) && /^-?\d+(?:\.\d+)?$/.test(clean) && Number(clean) === 0;
}

function equipmentInventoryNeedsManualEntry(value) {
  return String(value ?? "").trim() === "" || equipmentInventoryIsExplicitZero(value);
}

function equipmentInventoryRowKey(item) {
  if (item?.warehouseInventoryId) {
    return `inventario-bodega-${String(item.warehouseInventoryId).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  }
  const sourceRow = Number(item?.sourceRow) || "sin-fila";
  const descriptionKey = equipmentInventoryLookupKey(item?.description) || "equipo";
  return `inventario-${sourceRow}-${descriptionKey}`;
}

const equipmentInventoryItemsByLookupKey = new Map();
let equipmentInventoryStaticItemIndex = 0;
equipmentInventorySourceCategories.forEach((category) => {
  (Array.isArray(category?.items) ? category.items : []).forEach((item) => {
    const rowKey = equipmentInventoryRowKey(item);
    equipmentInventoryStaticItemIndex += 1;
    const warehouseId = `item-${String(equipmentInventoryStaticItemIndex).padStart(4, "0")}`;
    const lookupKey = equipmentInventoryLookupKey(item?.description);
    const sourceValue = equipmentInventorySourceValue(item);
    equipmentDefaultInventory.set(rowKey, sourceValue);
    equipmentInventoryStaticItemsByWarehouseId.set(warehouseId, item);
    equipmentInventoryWarehouseIdByRowKey.set(rowKey, warehouseId);
    if (!lookupKey) return;
    if (!equipmentInventoryItemsByLookupKey.has(lookupKey)) equipmentInventoryItemsByLookupKey.set(lookupKey, []);
    equipmentInventoryItemsByLookupKey.get(lookupKey).push(item);
  });
});
equipmentInventoryItemsByLookupKey.forEach((items, lookupKey) => {
  if (items.length === 1) equipmentDefaultInventoryLookup.set(lookupKey, equipmentInventorySourceValue(items[0]));
});

function equipmentWarehouseNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, number);
}

function equipmentWarehouseMovementDateTime(movement) {
  return String(movement?.dateTime || movement?.date || movement?.createdAt || "");
}

function equipmentWarehouseMovementStats(itemId, movements) {
  const stats = { out: 0, workshop: 0, rented: 0, lost: 0, workshopLots: [], rentalLots: [] };
  const entries = (Array.isArray(movements) ? movements : [])
    .filter((movement) => String(movement?.itemId || "") === String(itemId || ""))
    .slice()
    .sort((first, second) => {
      const firstKey = `${first?.dateTime || first?.date || ""}|${first?.createdAt || ""}`;
      const secondKey = `${second?.dateTime || second?.date || ""}|${second?.createdAt || ""}`;
      return firstKey.localeCompare(secondKey);
    });

  const removeLotQuantity = (lots, quantity, relatedMovementId = "") => {
    let remaining = quantity;
    const target = lots.find((lot) => lot.movementId === relatedMovementId);
    const candidates = [...(target ? [target] : []), ...lots.filter((lot) => lot !== target)];
    for (const lot of candidates) {
      if (remaining <= 0) break;
      const returned = Math.min(lot.quantity, remaining);
      lot.quantity -= returned;
      remaining -= returned;
    }
  };

  entries.forEach((movement) => {
    const quantity = equipmentWarehouseNumber(movement?.quantity);
    if (!quantity) return;
    if (movement.type === "salida") stats.out += quantity;
    if (movement.type === "ingreso_evento") stats.out -= quantity;
    if (movement.type === "taller") {
      stats.workshop += quantity;
      stats.workshopLots.push({
        movementId: movement.id,
        quantity,
        dateTime: equipmentWarehouseMovementDateTime(movement),
        repair: movement.repair,
        sparePart: movement.sparePart
      });
    }
    if (movement.type === "devolucion_taller") {
      stats.workshop -= quantity;
      removeLotQuantity(stats.workshopLots, quantity, movement.relatedMovementId);
    }
    if (movement.type === "renta") {
      stats.rented += quantity;
      stats.rentalLots.push({
        movementId: movement.id,
        quantity,
        dateTime: equipmentWarehouseMovementDateTime(movement),
        reference: movement.reference
      });
    }
    if (movement.type === "devolucion_renta") {
      stats.rented -= quantity;
      removeLotQuantity(stats.rentalLots, quantity, movement.relatedMovementId);
    }
    if (movement.type === "perdido") stats.lost += quantity;
    if (movement.type === "recuperado") stats.lost -= quantity;
  });

  stats.out = Math.max(0, stats.out);
  stats.workshop = Math.max(0, stats.workshop);
  stats.rented = Math.max(0, stats.rented);
  stats.lost = Math.max(0, stats.lost);
  stats.workshopLots = stats.workshopLots.filter((lot) => lot.quantity > 0);
  stats.rentalLots = stats.rentalLots.filter((lot) => lot.quantity > 0);
  stats.reserved = stats.out + stats.workshop + stats.rented + stats.lost;
  return stats;
}

function equipmentWarehouseAutomaticObservation(stats) {
  const notes = [];
  if (stats.workshop > 0) {
    const dates = [...new Set(stats.workshopLots.map((lot) => formatEquipmentDateTime(lot.dateTime, "")).filter(Boolean))];
    const repairs = [...new Set(stats.workshopLots.map((lot) => String(lot.repair || "").trim()).filter(Boolean))];
    const spareParts = [...new Set(stats.workshopLots.map((lot) => String(lot.sparePart || "").trim()).filter(Boolean))];
    const detail = [
      dates.length ? `Salió de bodega: ${dates.join(", ")}` : "",
      repairs.length ? `Falla: ${repairs.join(" / ")}` : "",
      spareParts.length ? `Repuesto: ${spareParts.join(" / ")}` : ""
    ].filter(Boolean).join(". ");
    notes.push(`En taller: ${stats.workshop}${detail ? `. ${detail}` : ""}`);
  }
  if (stats.out > 0) notes.push(`${stats.out} ${stats.out === 1 ? "unidad está" : "unidades están"} fuera por evento`);
  if (stats.rented > 0) {
    const dates = [...new Set(stats.rentalLots.map((lot) => formatEquipmentDateTime(lot.dateTime, "")).filter(Boolean))];
    const clients = [...new Set(stats.rentalLots.map((lot) => String(lot.reference || "").trim()).filter(Boolean))];
    const detail = [
      dates.length ? `Salió de bodega: ${dates.join(", ")}` : "",
      clients.length ? `Cliente: ${clients.join(" / ")}` : ""
    ].filter(Boolean).join(". ");
    notes.push(`En renta: ${stats.rented}${detail ? `. ${detail}` : ""}`);
  }
  if (stats.lost > 0) notes.push(`${stats.lost} ${stats.lost === 1 ? "unidad está reportada" : "unidades están reportadas"} como pérdida`);
  return notes.join(" · ");
}

function equipmentWarehousePayloadFingerprint(payload) {
  const state = payload?.state || payload || {};
  const movements = Array.isArray(state?.movements) ? state.movements : [];
  return JSON.stringify({
    savedAt: payload?.savedAt || "",
    updatedAt: state?.updatedAt || "",
    items: (Array.isArray(state?.items) ? state.items : []).map((item) => [
      item?.id,
      item?.name,
      item?.category,
      item?.quantity,
      item?.updatedAt
    ]),
    movementCount: movements.length,
    lastMovementId: movements.at(-1)?.id || ""
  });
}

function applyEquipmentWarehouseInventoryPayload(payload) {
  const state = payload?.state || payload;
  if (!state || !Array.isArray(state.items)) return false;
  const freshness = Date.parse(payload?.savedAt || state?.updatedAt || "") || 0;
  if (
    equipmentWarehouseInventoryState.loaded &&
    freshness > 0 &&
    equipmentWarehouseInventoryState.freshness > freshness
  ) {
    return false;
  }
  const fingerprint = equipmentWarehousePayloadFingerprint(payload);
  if (equipmentWarehouseInventoryState.loaded && fingerprint === equipmentWarehouseInventoryState.fingerprint) {
    return false;
  }

  const movements = Array.isArray(state.movements) ? state.movements : [];
  const records = state.items
    .filter((item) => item && !item.archived)
    .map((item) => {
      const stats = equipmentWarehouseMovementStats(item.id, movements);
      const physical = equipmentWarehouseNumber(item.quantity);
      const staticItem = equipmentInventoryStaticItemsByWarehouseId.get(String(item.id || "")) || null;
      return {
        id: String(item.id || ""),
        item,
        physical,
        available: Math.max(0, physical - stats.reserved),
        stats,
        staticItem,
        automaticObservation: equipmentWarehouseAutomaticObservation(stats)
      };
    });

  const recordsById = new Map();
  const recordsByLookupKey = new Map();
  records.forEach((record) => {
    if (record.id) recordsById.set(record.id, record);
    [record.item?.name, record.staticItem?.description]
      .map(equipmentInventoryCanonicalKey)
      .filter(Boolean)
      .forEach((lookupKey) => {
        if (!recordsByLookupKey.has(lookupKey)) recordsByLookupKey.set(lookupKey, []);
        const matches = recordsByLookupKey.get(lookupKey);
        if (!matches.includes(record)) matches.push(record);
      });
  });

  equipmentWarehouseInventoryState.loaded = true;
  equipmentWarehouseInventoryState.fingerprint = fingerprint;
  equipmentWarehouseInventoryState.freshness = Math.max(equipmentWarehouseInventoryState.freshness, freshness);
  equipmentWarehouseInventoryState.records = records;
  equipmentWarehouseInventoryState.recordsById = recordsById;
  equipmentWarehouseInventoryState.recordsByLookupKey = recordsByLookupKey;
  invalidateEquipmentRentalPreview();
  return true;
}

function equipmentInventorySummaryCategories() {
  if (!equipmentWarehouseInventoryState.loaded) return equipmentInventorySourceCategories;
  const categories = [];
  const categoriesByKey = new Map();
  equipmentWarehouseInventoryState.records.forEach((record) => {
    const title = String(record.item?.category || "Equipo sin categoria").trim() || "Equipo sin categoria";
    const categoryKey = normalizeEquipmentKey(title);
    let category = categoriesByKey.get(categoryKey);
    if (!category) {
      category = { title, items: [] };
      categoriesByKey.set(categoryKey, category);
      categories.push(category);
    }
    category.items.push({
      description: String(record.item?.name || "Equipo sin nombre"),
      legacyDescription: record.staticItem?.description || "",
      value: record.physical,
      sourceQuantity: String(record.physical),
      warehouseInventoryId: record.id,
      warehouseRecord: record
    });
  });
  return categories;
}

function equipmentInventoryChoiceCategories() {
  return equipmentInventorySummaryCategories()
    .map((category) => ({
      title: String(category?.title || "Equipo").trim() || "Equipo",
      items: (Array.isArray(category?.items) ? category.items : [])
        .map((item) => String(item?.description || "").trim())
        .filter(Boolean)
    }))
    .filter((category) => category.items.length);
}

function equipmentInventoryChoiceMap() {
  const choices = new Map();
  equipmentInventoryChoiceCategories().forEach((category) => {
    category.items.forEach((description) => {
      const key = equipmentInventoryCanonicalKey(description);
      if (key && !choices.has(key)) choices.set(key, { description, category: category.title });
    });
  });
  return choices;
}

function equipmentRecognizedInventoryChoice(description) {
  const key = equipmentInventoryCanonicalKey(description);
  return Boolean(key && equipmentInventoryChoiceMap().has(key));
}

function equipmentCategoryMatchKey(value) {
  return normalizeEquipmentKey(value)
    .replace(/\b(equipo|para|de|del|la|las|los)\b/g, " ")
    .replace(/\b(consolas|pedestales|estructuras|herramientas|instrumentos|accesorios)\b/g, (word) => word.slice(0, -1))
    .replace(/\s+/g, " ")
    .trim();
}

function equipmentInventoryCategoriesForSection(section) {
  const categories = equipmentInventoryChoiceCategories();
  const sectionKeys = new Set((section?.items || [])
    .map((item) => equipmentInventoryCanonicalKey(normalizeEquipmentItem(item).description))
    .filter(Boolean));
  const titleParts = String(section?.title || "")
    .split("/")
    .map(equipmentCategoryMatchKey)
    .filter(Boolean);
  const matches = categories.filter((category) => {
    const categoryKey = equipmentCategoryMatchKey(category.title);
    const titleMatches = titleParts.some((titleKey) => titleKey === categoryKey || titleKey.includes(categoryKey) || categoryKey.includes(titleKey));
    const itemMatches = category.items.some((description) => sectionKeys.has(equipmentInventoryCanonicalKey(description)));
    return titleMatches || itemMatches;
  });
  return matches.length ? matches : categories;
}

function equipmentInventoryOptionsHtml(categories, selectedDescription = "") {
  const selectedKey = equipmentInventoryCanonicalKey(selectedDescription);
  return categories.map((category) => {
    const options = category.items.map((description) => {
      const selected = equipmentInventoryCanonicalKey(description) === selectedKey ? " selected" : "";
      return `<option value="${escapeEquipmentHtml(description)}"${selected}>${escapeEquipmentHtml(description)}</option>`;
    }).join("");
    return `<optgroup label="${escapeEquipmentHtml(category.title)}">${options}</optgroup>`;
  }).join("");
}

function renderEquipmentInventoryNameOptions() {
  const datalist = equipmentQuery("#equipmentInventoryNameOptions");
  if (!datalist) return;
  datalist.innerHTML = equipmentInventoryChoiceCategories()
    .flatMap((category) => category.items)
    .map((description) => `<option value="${escapeEquipmentHtml(description)}"></option>`)
    .join("");
}

function cloneEquipmentCatalogItems(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const normalized = normalizeEquipmentItem(item);
    return {
      id: normalized.id || `catalog-item-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      quantity: Math.max(0, Number(normalized.quantity) || 0),
      description: String(normalized.description || "").trim()
    };
  });
}

function cloneEquipmentCatalogAudioOptions(audioOptions = {}) {
  return Object.fromEntries(Object.entries(audioOptions || {}).map(([key, option]) => [key, {
    ...option,
    label: String(option?.label || key),
    items: cloneEquipmentCatalogItems(option?.items).map((item) => [item.quantity, item.description])
  }]));
}

function applyEquipmentCatalogServiceOverride(serviceId, override) {
  const service = equipmentServices[serviceId];
  if (!service || !override || typeof override !== "object") return false;
  if (Array.isArray(override.mainSections) && override.mainSections.length) {
    service.mainSections = override.mainSections.map((section, index) => ({
      ...(section?.id ? { id: String(section.id) } : {}),
      ...(section?.audioVariant ? { audioVariant: true } : {}),
      title: String(section?.title || `Categoría ${index + 1}`),
      items: cloneEquipmentCatalogItems(section?.items).map((item) => [item.quantity, item.description])
    }));
  }
  if (override.audioOptions && typeof override.audioOptions === "object" && Object.keys(override.audioOptions).length) {
    service.audioOptions = {
      ...(service.audioOptions || {}),
      ...cloneEquipmentCatalogAudioOptions(override.audioOptions)
    };
  }
  service.catalogUpdatedAt = override.updatedAt || "";
  return true;
}

function applyEquipmentCatalogOverrides(payload) {
  const services = payload?.services && typeof payload.services === "object" ? payload.services : {};
  let changed = false;
  Object.entries(services).forEach(([serviceId, override]) => {
    changed = applyEquipmentCatalogServiceOverride(serviceId, override) || changed;
  });
  equipmentCatalogEditorState.loaded = true;
  return changed;
}

async function loadEquipmentCatalogOverrides(force = false) {
  if (equipmentCatalogEditorState.loadingPromise) return equipmentCatalogEditorState.loadingPromise;
  if (equipmentCatalogEditorState.loaded && !force) return null;
  equipmentCatalogEditorState.loadingPromise = fetch("/api/cuadros-equipo/catalogo", {
    credentials: "same-origin",
    cache: "no-store"
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo cargar el catálogo editable.");
      const changed = applyEquipmentCatalogOverrides(payload);
      if (changed && !equipmentCatalogEditorState.open) renderEquipmentModule();
      return payload;
    })
    .catch(() => null)
    .finally(() => {
      equipmentCatalogEditorState.loadingPromise = null;
    });
  return equipmentCatalogEditorState.loadingPromise;
}

function equipmentCatalogDraftForService(serviceId) {
  const baseService = equipmentServices[serviceId];
  const resolvedService = serviceWithEquipmentAudioOption(serviceId);
  if (!baseService || !resolvedService) return null;
  const audioType = baseService.audioOptions?.[equipmentState.djAudioType]
    ? equipmentState.djAudioType
    : Object.keys(baseService.audioOptions || {})[0] || "";
  return {
    serviceId,
    name: baseService.name,
    audioType,
    sections: (resolvedService.mainSections || []).map((section, index) => {
      const baseSection = baseService.mainSections?.[index] || {};
      const persistentSectionId = baseSection.id || section.id || `custom-category-${Date.now()}-${index}`;
      return {
        editorId: `catalog-section-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        sourceId: persistentSectionId,
        baseTitle: baseSection.title || section.title || "",
        audioVariant: Boolean(baseSection.audioVariant || section.audioVariant),
        title: String(section.title || `Categoría ${index + 1}`),
        items: cloneEquipmentCatalogItems(section.items)
      };
    })
  };
}

function equipmentCatalogEditorValidation(draft = equipmentCatalogEditorState.draft) {
  if (!draft?.sections?.length) return { ok: false, message: "Agregue al menos una categoría." };
  for (const [sectionIndex, section] of draft.sections.entries()) {
    if (!String(section.title || "").trim()) {
      return { ok: false, message: `Escriba el nombre de la categoría ${sectionIndex + 1}.` };
    }
    for (const [itemIndex, item] of section.items.entries()) {
      const description = String(item.description || "").trim();
      if (!description) {
        return { ok: false, message: `Escriba el nombre del equipo ${itemIndex + 1} en ${section.title}.` };
      }
      if (!equipmentRecognizedInventoryChoice(description)) {
        return { ok: false, message: `No se reconoce "${description}" en ${section.title}. Seleccione el nombre exacto del inventario.` };
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity < 0) {
        return { ok: false, message: `Corrija la cantidad de "${description}" en ${section.title}.` };
      }
    }
  }
  return { ok: true, message: "" };
}

function equipmentCatalogEditorPayload(draft = equipmentCatalogEditorState.draft) {
  const baseService = equipmentServices[draft.serviceId];
  const audioOptions = cloneEquipmentCatalogAudioOptions(baseService.audioOptions || {});
  const mainSections = draft.sections.map((section) => {
    const items = section.items.map((item) => [Math.max(0, Number(item.quantity) || 0), String(item.description || "").trim()]);
    if (section.audioVariant) {
      if (draft.audioType && audioOptions[draft.audioType]) audioOptions[draft.audioType].items = items;
      return {
        ...(section.sourceId ? { id: section.sourceId.replace(/-(qsc|t4|turbosound)$/i, "") } : {}),
        title: section.baseTitle || "Audio",
        audioVariant: true,
        items: []
      };
    }
    return {
      ...(section.sourceId ? { id: section.sourceId } : {}),
      title: String(section.title || "").trim(),
      items
    };
  });
  return {
    serviceId: draft.serviceId,
    name: draft.name,
    mainSections,
    audioOptions
  };
}

function equipmentCatalogEditorSectionMarkup(section) {
  const inventoryCategories = equipmentInventoryCategoriesForSection(section);
  const rows = section.items.map((item, itemIndex) => {
    const recognized = equipmentRecognizedInventoryChoice(item.description);
    return `
      <div class="equipment-catalog-item${recognized ? "" : " is-unrecognized"}">
        <label>Cantidad<input data-catalog-item-quantity="${escapeEquipmentHtml(section.editorId)}:${itemIndex}" type="number" min="0" step="1" value="${escapeEquipmentHtml(item.quantity)}" /></label>
        <label>Equipo<input class="${recognized ? "" : "is-unrecognized"}" data-catalog-item-description="${escapeEquipmentHtml(section.editorId)}:${itemIndex}" type="text" list="equipmentInventoryNameOptions" value="${escapeEquipmentHtml(item.description)}" aria-invalid="${recognized ? "false" : "true"}" />
          <span class="equipment-name-warning${recognized ? " is-hidden" : ""}">Nombre no reconocido por el inventario.</span>
        </label>
        <button type="button" data-catalog-remove-item="${escapeEquipmentHtml(section.editorId)}:${itemIndex}" aria-label="Eliminar equipo">X</button>
      </div>`;
  }).join("");
  return `
    <details class="equipment-catalog-category" open data-catalog-section="${escapeEquipmentHtml(section.editorId)}">
      <summary>${escapeEquipmentHtml(section.title || "Nueva categoría")}<span>${section.items.length} equipo(s)</span></summary>
      <div class="equipment-catalog-category-body">
        <label class="equipment-catalog-category-title">Nombre de la categoría<input data-catalog-section-title="${escapeEquipmentHtml(section.editorId)}" type="text" value="${escapeEquipmentHtml(section.title)}" ${section.audioVariant ? "readonly" : ""} /></label>
        <div class="equipment-catalog-items">${rows || '<p class="equipment-empty">Esta categoría todavía no tiene equipo.</p>'}</div>
        <div class="equipment-catalog-add-item">
          <label>Equipo del inventario<select data-catalog-choice="${escapeEquipmentHtml(section.editorId)}"><option value="">Seleccione el equipo</option>${equipmentInventoryOptionsHtml(inventoryCategories)}</select></label>
          <label>Cantidad<input data-catalog-choice-quantity="${escapeEquipmentHtml(section.editorId)}" type="number" min="0" step="1" value="1" /></label>
          <button type="button" data-catalog-add-item="${escapeEquipmentHtml(section.editorId)}">Agregar equipo</button>
          ${section.audioVariant ? "" : `<button class="equipment-catalog-delete-category" type="button" data-catalog-remove-section="${escapeEquipmentHtml(section.editorId)}">Eliminar categoría</button>`}
        </div>
      </div>
    </details>`;
}

function renderEquipmentCatalogEditor() {
  const overlay = equipmentQuery("#equipmentCatalogEditor");
  const content = equipmentQuery("#equipmentCatalogEditorContent");
  if (!overlay || !content) return;
  overlay.classList.toggle("is-hidden", !equipmentCatalogEditorState.open);
  if (!equipmentCatalogEditorState.open || !equipmentCatalogEditorState.draft) return;
  const draft = equipmentCatalogEditorState.draft;
  const title = equipmentQuery("#equipmentCatalogEditorTitle");
  if (title) title.textContent = `Editar ${draft.name}`;
  content.innerHTML = draft.sections.map(equipmentCatalogEditorSectionMarkup).join("");
  bindEquipmentCatalogEditorInputs();
}

function equipmentCatalogDraftSection(sectionId) {
  return equipmentCatalogEditorState.draft?.sections?.find((section) => section.editorId === sectionId) || null;
}

function equipmentCatalogEditorReference(value) {
  const separatorIndex = String(value || "").lastIndexOf(":");
  if (separatorIndex < 0) return { section: null, itemIndex: -1 };
  const section = equipmentCatalogDraftSection(String(value).slice(0, separatorIndex));
  const itemIndex = Number(String(value).slice(separatorIndex + 1));
  return { section, itemIndex };
}

function bindEquipmentCatalogEditorInputs() {
  const content = equipmentQuery("#equipmentCatalogEditorContent");
  if (!content) return;
  content.querySelectorAll("[data-catalog-section-title]").forEach((input) => {
    input.addEventListener("input", () => {
      const section = equipmentCatalogDraftSection(input.dataset.catalogSectionTitle || "");
      if (section && !section.audioVariant) section.title = input.value;
    });
  });
  content.querySelectorAll("[data-catalog-item-quantity]").forEach((input) => {
    input.addEventListener("input", () => {
      const { section, itemIndex } = equipmentCatalogEditorReference(input.dataset.catalogItemQuantity);
      if (section?.items[itemIndex]) section.items[itemIndex].quantity = Math.max(0, Number(input.value) || 0);
    });
  });
  content.querySelectorAll("[data-catalog-item-description]").forEach((input) => {
    input.addEventListener("input", () => {
      const { section, itemIndex } = equipmentCatalogEditorReference(input.dataset.catalogItemDescription);
      if (section?.items[itemIndex]) section.items[itemIndex].description = input.value;
      const recognized = equipmentRecognizedInventoryChoice(input.value);
      input.classList.toggle("is-unrecognized", !recognized);
      input.setAttribute("aria-invalid", String(!recognized));
      input.closest(".equipment-catalog-item")?.classList.toggle("is-unrecognized", !recognized);
      input.parentElement?.querySelector(".equipment-name-warning")?.classList.toggle("is-hidden", recognized);
    });
  });
  content.querySelectorAll("[data-catalog-remove-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const { section, itemIndex } = equipmentCatalogEditorReference(button.dataset.catalogRemoveItem);
      if (section && itemIndex >= 0) section.items.splice(itemIndex, 1);
      renderEquipmentCatalogEditor();
    });
  });
  content.querySelectorAll("[data-catalog-add-item]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.catalogAddItem || "";
      const section = equipmentCatalogDraftSection(sectionId);
      const choice = [...content.querySelectorAll("[data-catalog-choice]")]
        .find((select) => select.dataset.catalogChoice === sectionId);
      const quantityInput = [...content.querySelectorAll("[data-catalog-choice-quantity]")]
        .find((input) => input.dataset.catalogChoiceQuantity === sectionId);
      const description = String(choice?.value || "").trim();
      if (!section || !description) return;
      const quantity = Math.max(0, Number(quantityInput?.value || 0) || 0);
      const existing = section.items.find((item) => equipmentInventoryCanonicalKey(item.description) === equipmentInventoryCanonicalKey(description));
      if (existing) existing.quantity += quantity;
      else section.items.push({ id: `catalog-item-${Date.now()}`, quantity, description });
      renderEquipmentCatalogEditor();
    });
  });
  content.querySelectorAll("[data-catalog-remove-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const sectionId = button.dataset.catalogRemoveSection || "";
      equipmentCatalogEditorState.draft.sections = equipmentCatalogEditorState.draft.sections
        .filter((section) => section.editorId !== sectionId);
      renderEquipmentCatalogEditor();
    });
  });
}

async function openEquipmentCatalogEditor() {
  const status = equipmentQuery("#equipmentSaveStatus");
  const serviceIds = selectedEquipmentServiceIds();
  if (serviceIds.length !== 1) {
    if (status) status.textContent = "Seleccione exactamente un tipo de servicio para editar su cuadro permanente.";
    return;
  }
  await loadEquipmentCatalogOverrides(true);
  const draft = equipmentCatalogDraftForService(serviceIds[0]);
  if (!draft) {
    if (status) status.textContent = "No se pudo abrir la plantilla del servicio seleccionado.";
    return;
  }
  equipmentCatalogEditorState.open = true;
  equipmentCatalogEditorState.serviceId = serviceIds[0];
  equipmentCatalogEditorState.audioType = draft.audioType;
  equipmentCatalogEditorState.draft = draft;
  const editorStatus = equipmentQuery("#equipmentCatalogEditorStatus");
  if (editorStatus) editorStatus.textContent = "";
  renderEquipmentCatalogEditor();
}

function closeEquipmentCatalogEditor() {
  equipmentCatalogEditorState.open = false;
  equipmentCatalogEditorState.serviceId = "";
  equipmentCatalogEditorState.audioType = "";
  equipmentCatalogEditorState.draft = null;
  renderEquipmentCatalogEditor();
}

function addEquipmentCatalogCategory() {
  const draft = equipmentCatalogEditorState.draft;
  if (!draft) return;
  draft.sections.push({
    editorId: `catalog-section-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sourceId: `custom-category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    baseTitle: "",
    audioVariant: false,
    title: "NUEVA CATEGORÍA",
    items: []
  });
  renderEquipmentCatalogEditor();
}

async function saveEquipmentCatalogEditor() {
  const editorStatus = equipmentQuery("#equipmentCatalogEditorStatus");
  const saveButton = equipmentQuery("#equipmentCatalogSaveButton");
  const validation = equipmentCatalogEditorValidation();
  if (!validation.ok) {
    if (editorStatus) editorStatus.textContent = validation.message;
    return;
  }
  if (equipmentCatalogEditorState.saving) return;
  equipmentCatalogEditorState.saving = true;
  if (saveButton) saveButton.disabled = true;
  if (editorStatus) editorStatus.textContent = "Guardando plantilla...";
  try {
    const payload = equipmentCatalogEditorPayload();
    const response = await fetch("/api/cuadros-equipo/catalogo", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "No se pudo guardar la plantilla.");
    applyEquipmentCatalogServiceOverride(data.serviceId, data.service);
    equipmentState.itemOverrides.clear();
    equipmentState.sectionAddedItems.clear();
    equipmentState.removedItemIds.clear();
    equipmentState.manualMainItems = [];
    equipmentState.manualMainSections = [];
    const event = selectedEquipmentEvent();
    if (event) updateEquipmentEventFromCurrent(event);
    closeEquipmentCatalogEditor();
    renderEquipmentModule();
    const status = equipmentQuery("#equipmentSaveStatus");
    if (status) status.textContent = `Plantilla permanente actualizada: ${payload.name}.`;
  } catch (error) {
    if (editorStatus) editorStatus.textContent = error.message || "No se pudo guardar la plantilla.";
  } finally {
    equipmentCatalogEditorState.saving = false;
    if (saveButton) saveButton.disabled = false;
  }
}

async function initEquipmentCatalogSync() {
  const requirementPage = equipmentQuery("#requerimientoEquipoPage");
  await waitForEquipmentAuthenticatedApp();
  await loadEquipmentCatalogOverrides();
  if (requirementPage && typeof MutationObserver === "function") {
    const observer = new MutationObserver(() => {
      if (requirementPage.classList.contains("is-active") && !equipmentCatalogEditorState.open) {
        loadEquipmentCatalogOverrides(true);
      }
    });
    observer.observe(requirementPage, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("focus", () => {
    if ((!requirementPage || requirementPage.classList.contains("is-active")) && !equipmentCatalogEditorState.open) {
      loadEquipmentCatalogOverrides(true);
    }
  });
}

function equipmentWarehouseInventoryRecordFor(row) {
  const directId = row?.inventorySourceItem?.warehouseInventoryId
    || equipmentInventoryWarehouseIdByRowKey.get(row?.key);
  if (directId && equipmentWarehouseInventoryState.recordsById.has(String(directId))) {
    return equipmentWarehouseInventoryState.recordsById.get(String(directId));
  }
  const lookupKeys = [
    row?.inventorySourceItem?.description,
    row?.inventorySourceItem?.legacyDescription,
    row?.description,
    row?.key
  ].map(equipmentInventoryCanonicalKey).filter(Boolean);
  for (const lookupKey of lookupKeys) {
    const matches = equipmentWarehouseInventoryState.recordsByLookupKey.get(lookupKey) || [];
    if (matches.length === 1) return matches[0];
  }
  return null;
}

function equipmentInventoryAvailableValueFor(row) {
  const record = equipmentWarehouseInventoryRecordFor(row);
  if (record) return record.available;
  return equipmentInventoryNumber(inventoryValueFor(row));
}

function equipmentInventoryAutomaticObservationFor(row) {
  return equipmentWarehouseInventoryRecordFor(row)?.automaticObservation || "";
}

function equipmentInventoryCombinedObservationFor(row) {
  const automatic = equipmentInventoryAutomaticObservationFor(row);
  const manual = String(equipmentState.observations.get(row?.key) || "").trim();
  return [automatic, manual].filter(Boolean).join(" · ");
}

function defaultInventoryValueFor(row) {
  if (equipmentDefaultInventory.has(row?.key)) return equipmentDefaultInventory.get(row.key);
  const lookupKeys = [
    row?.key,
    equipmentInventoryLookupKey(row?.key),
    equipmentInventoryLookupKey(row?.description)
  ].filter(Boolean);
  for (const key of lookupKeys) {
    if (equipmentDefaultInventoryLookup.has(key)) return equipmentDefaultInventoryLookup.get(key);
  }
  for (const key of lookupKeys) {
    const aliasKey = equipmentInventoryAliases[key];
    if (!aliasKey) continue;
    const cleanAliasKey = equipmentInventoryLookupKey(aliasKey);
    if (equipmentDefaultInventoryLookup.has(aliasKey)) return equipmentDefaultInventoryLookup.get(aliasKey);
    if (equipmentDefaultInventoryLookup.has(cleanAliasKey)) return equipmentDefaultInventoryLookup.get(cleanAliasKey);
  }
  return 0;
}

function inventoryValueFor(row) {
  const warehouseRecord = equipmentWarehouseInventoryRecordFor(row);
  if (warehouseRecord) return warehouseRecord.available;
  if (equipmentState.inventory.has(row.key)) return equipmentState.inventory.get(row.key);
  if (equipmentWarehouseInventoryState.loaded) return 0;
  return defaultInventoryValueFor(row);
}

function equipmentTransferPlanData() {
  const events = sortEquipmentEventsByDate(equipmentState.events);
  const groups = equipmentEventsByOperationalDate(events);
  const missingDateEvents = events.filter((event) => {
    const usage = equipmentEventUsageWindow(event);
    return !Number.isFinite(usage.startMs) || !Number.isFinite(usage.endMs);
  });
  const routes = [];
  const configuredRoutes = equipmentState.summaryTransferEnabled
    ? equipmentSummaryTransferRoutesWithEvents(events, true)
    : [];
  if (configuredRoutes.length) {
    configuredRoutes.forEach(({ route, events: routeEvents, index: routeIndex }) => {
      for (let index = 0; index < routeEvents.length - 1; index += 1) {
        routes.push({
          route,
          routeIndex,
          legIndex: index,
          dateKey: equipmentEventOperationalDateKey(routeEvents[index + 1]),
          from: routeEvents[index],
          to: routeEvents[index + 1],
          configured: true
        });
      }
    });
  }
  const comparisonRows = routes.length ? equipmentTransferComparisonRows() : [];
  const detailedRoutes = routes.map((route) => {
    const candidates = equipmentTransferredItemsBetweenEvents(route.from, route.to, comparisonRows);
    return {
      ...route,
      candidates,
      items: equipmentSelectedTransferredItemsBetweenEvents(route.route, route.from, route.to, candidates),
      timing: equipmentLogisticsPairAnalysis(route.from, route.to)
    };
  });
  return {
    events,
    groups,
    routes: detailedRoutes,
    configuredRoutes,
    missingDateEvents,
    hasDifferentDates: groups.size > 1
  };
}

function equipmentTransferItemCount(items = []) {
  return items.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

function equipmentTransferItemsTable(items = []) {
  const itemRows = items
    .map((item) => `
      <tr>
        <td>${escapeEquipmentHtml(item.quantity)}</td>
        <td>${escapeEquipmentHtml(item.description)}</td>
        <td>${escapeEquipmentHtml(item.categoryTitle)}</td>
      </tr>`)
    .join("");
  if (!itemRows) return '<p class="equipment-empty">No hay equipo idéntico requerido en ambos eventos.</p>';
  return `
    <table class="equipment-transfer-items-table">
      <colgroup><col class="equipment-transfer-quantity-column" /><col /><col class="equipment-transfer-category-column" /></colgroup>
      <thead><tr><th>Cantidad</th><th>Equipo</th><th>Categoría</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>`;
}

function equipmentConfiguredTransferRoutesWithItems(plan = equipmentTransferPlanData()) {
  return plan.routes.filter((route) => route.configured && route.items.length);
}

function equipmentTransferDestinationSentence(route) {
  return `Destino: ${route.to?.place || "Lugar por definir"} · Evento: ${route.to?.name || "Por definir"} · Montaje: ${equipmentEventSetupDateTimeLabel(route.to)}`;
}

function renderEquipmentTransferPdf(plan = equipmentTransferPlanData()) {
  const host = equipmentQuery("#equipmentTransferPdfRoutes");
  const saveButton = equipmentQuery("#equipmentSaveTransferPdfButton");
  const routes = equipmentConfiguredTransferRoutesWithItems(plan);
  if (saveButton) {
    saveButton.disabled = !routes.length;
    saveButton.title = routes.length
      ? "Guardar como PDF el equipo de todos los trasiegos configurados"
      : "Seleccione equipo en al menos un tramo para generar el PDF";
  }
  if (!host) return;
  if (!routes.length) {
    host.innerHTML = '<p class="equipment-empty">Configure un tramo y seleccione el equipo que se trasladará para generar este PDF.</p>';
    return;
  }
  host.innerHTML = routes.map(({ routeIndex, legIndex, from, to, items }) => `
    <section class="equipment-transfer-pdf-route">
      <div class="equipment-transfer-pdf-route-heading">
        <div>
          <span>${escapeEquipmentHtml(`Trasiego ${routeIndex + 1} · tramo ${legIndex + 1}`)}</span>
          <h3>${escapeEquipmentHtml(`${from.place || "Lugar por definir"} hacia ${to.place || "Lugar por definir"}`)}</h3>
        </div>
        <strong>${escapeEquipmentHtml(`${items.length} tipos · ${equipmentTransferItemCount(items)} unidades`)}</strong>
      </div>
      <div class="equipment-transfer-pdf-meta">
        <div><span>Origen</span><strong>${escapeEquipmentHtml(from.place || "Lugar por definir")}</strong><small>Evento: ${escapeEquipmentHtml(from.name || "Por definir")}</small></div>
        <div><span>Destino</span><strong>${escapeEquipmentHtml(to.place || "Lugar por definir")}</strong><small>Evento: ${escapeEquipmentHtml(to.name || "Por definir")}</small></div>
        <div><span>Montaje en destino</span><strong>${escapeEquipmentHtml(equipmentEventSetupDateTimeLabel(to))}</strong><small>Fecha del evento: ${escapeEquipmentHtml(equipmentEventDateLabel(to))}</small></div>
      </div>
      ${equipmentTransferItemsTable(items)}
      <p class="equipment-transfer-route-note">${escapeEquipmentHtml(`Salida desde ${from.place || "Lugar por definir"} después del ingreso ${equipmentEventReturnDateTime(from)}. ${equipmentTransferDestinationSentence({ to })}`)}</p>
    </section>`).join("");
}

function renderEquipmentPdfTransferDestinations(plan = equipmentTransferPlanData()) {
  const host = equipmentQuery("#equipmentPdfTransferDestinations");
  if (!host) return;
  const selectedEventId = equipmentState.selectedEventId;
  const routes = plan.routes.filter((route) => route.configured && route.items.length && route.from?.id === selectedEventId);
  host.classList.toggle("is-hidden", !routes.length);
  if (!routes.length) {
    host.innerHTML = "";
    return;
  }
  host.innerHTML = `
    <strong class="equipment-pdf-transfer-title">Destino del equipo trasegado</strong>
    <div class="equipment-pdf-transfer-grid">
      ${routes.map(({ routeIndex, legIndex, to, items }) => `
        <div>
          <span>${escapeEquipmentHtml(`Trasiego ${routeIndex + 1} · tramo ${legIndex + 1}`)}</span>
          <strong>${escapeEquipmentHtml(to.place || "Lugar por definir")}</strong>
          <small>Evento: ${escapeEquipmentHtml(to.name || "Por definir")}</small>
          <small>Montaje: ${escapeEquipmentHtml(equipmentEventSetupDateTimeLabel(to))}</small>
          <small>${escapeEquipmentHtml(`${items.length} tipos · ${equipmentTransferItemCount(items)} unidades`)}</small>
        </div>`).join("")}
    </div>`;
}

function renderEquipmentTransferPanel() {
  const host = equipmentQuery("#equipmentTransferPlan");
  if (!host) return;
  const plan = equipmentTransferPlanData();
  renderEquipmentTransferPdf(plan);
  if (plan.events.length < 2) {
    host.innerHTML = `<p class="equipment-empty">Agregue al menos dos ventanas para calcular el trasego de equipo.</p>`;
    return;
  }

  const messages = [];
  if (plan.configuredRoutes.length) {
    messages.push(`${plan.configuredRoutes.length} trasiego(s) configurado(s). Cada ruta puede continuar por varios eventos.`);
  } else if (plan.hasDifferentDates) {
    messages.push("Configure una ruta dentro de Resumen de Equipo y seleccione manualmente cada equipo que continuará al destino.");
  }
  if (plan.missingDateEvents.length) {
    messages.push("Hay ventanas sin fecha operativa; complete fecha de montaje e ingreso para evaluar el trasiego.");
  }
  if (!plan.routes.length) {
    messages.push("No hay tramos configurados. Use Trasegar Equipo en el resumen para elegir origen, destino y equipo.");
  }

  const messageHtml = messages
    .map((message) => `<p class="equipment-transfer-note">${escapeEquipmentHtml(message)}</p>`)
    .join("");
  const routeHtml = plan.routes
    .map(({ routeIndex, legIndex, dateKey, from, to, configured, items }) => {
      const itemCount = equipmentTransferItemCount(items);
      return `
        <article class="equipment-transfer-card">
          <div class="equipment-transfer-location">
            <span>${escapeEquipmentHtml(configured ? `Trasiego ${routeIndex + 1} · tramo ${legIndex + 1} · origen` : "Trasiego sugerido · origen")}</span>
            <strong>${escapeEquipmentHtml(from.place || "Lugar por definir")}</strong>
            <p>Evento: ${escapeEquipmentHtml(from.name || "Por definir")}</p>
            <p>Servicio: ${escapeEquipmentHtml(from.serviceName || "Por definir")}</p>
          </div>
          <div class="equipment-transfer-location">
            <span>Trasegar hacia</span>
            <strong>${escapeEquipmentHtml(to.place || "Lugar por definir")}</strong>
            <p>Evento: ${escapeEquipmentHtml(to.name || "Por definir")}</p>
            <p>Servicio: ${escapeEquipmentHtml(to.serviceName || "Por definir")}</p>
          </div>
          <div class="equipment-transfer-location">
            <span>Fecha y hora de montaje en destino</span>
            <strong>${escapeEquipmentHtml(equipmentEventSetupDateTimeLabel(to))}</strong>
            <p>Fecha del evento: ${escapeEquipmentHtml(equipmentEventDateLabel(to))}</p>
          </div>
          <section class="equipment-transfer-equipment-list">
            <header>
              <strong>Equipo que se trasegará</strong>
              <span>${escapeEquipmentHtml(`${items.length} tipos · ${itemCount} unidades`)}</span>
            </header>
            ${equipmentTransferItemsTable(items)}
          </section>
          <p class="equipment-transfer-route-note">Salida desde ${escapeEquipmentHtml(from.place || "evento anterior")} después del ingreso ${escapeEquipmentHtml(equipmentEventReturnDateTime(from))}. ${escapeEquipmentHtml(equipmentTransferDestinationSentence({ to }))}${dateKey ? ` · Fecha operativa: ${escapeEquipmentHtml(formatEquipmentDate(dateKey))}` : ""}</p>
        </article>`;
    })
    .join("");

  host.innerHTML = `${messageHtml}${routeHtml || ""}`;
}

function tableForEquipmentInventory(rows, editable = true) {
  if (!rows.length) {
    return `<p class="equipment-empty">No hay equipo requerido con cantidad mayor a 0.</p>`;
  }
  const events = activeEquipmentEvents();
  const eventDateHeaders = events
    .map((event) => `<th class="equipment-event-column equipment-date-column"><span>Fecha del evento</span><strong>${escapeEquipmentHtml(equipmentEventDateLabel(event))}</strong></th>`)
    .join("");
  const eventSetupHeaders = events
    .map((event) => `<th class="equipment-event-column equipment-date-column"><span>Fecha y hora del montaje</span><strong>${escapeEquipmentHtml(equipmentEventSetupDateTimeLabel(event))}</strong></th>`)
    .join("");
  const eventHeaders = events
    .map((event, index) => `<th class="equipment-event-column equipment-location-column">${escapeEquipmentHtml(equipmentSummaryColumnName(event, index))}</th>`)
    .join("");
  const eventQuantityHeaders = events.map(() => `<th class="equipment-event-column">CANTIDAD</th>`).join("");
  const body = rows
    .map((row) => {
      if (row.type === "category") {
        return `
          <tr class="equipment-category-row">
            <td colspan="${events.length + 6}">${escapeEquipmentHtml(row.title)}</td>
          </tr>`;
      }
      const inventory = inventoryValueFor(row);
      const availableInventory = equipmentInventoryAvailableValueFor(row);
      const required = Number(row.quantity) || 0;
      const availableAfterRequirement = availableInventory - required;
      const needsRent = availableAfterRequirement < 0;
      const warehouseRecord = equipmentWarehouseInventoryRecordFor(row);
      const zeroInventory = !warehouseRecord && equipmentInventoryNeedsManualEntry(inventory);
      const shortageClass = needsRent ? "equipment-shortage-cell" : "equipment-rest-ok";
      const transferApplied = Boolean(row.transferApplied);
      const multipleTransfers = (Number(row.transferRouteCount) || 0) > 1;
      const transferLabel = multipleTransfers ? "TRASIEGO MÚLTIPLE" : "TRASIEGO";
      const actionLabel = needsRent
        ? (transferApplied ? `RENTA + ${transferLabel}` : "RENTA")
        : transferApplied
          ? "EQUIPO TRASEGADO NO GENERA RENTA"
          : "";
      const actionClass = needsRent ? "equipment-action-rent" : transferApplied ? "equipment-action-transfer" : "equipment-action-empty";
      const observation = equipmentState.observations.get(row.key) || "";
      const automaticObservation = equipmentInventoryAutomaticObservationFor(row);
      const combinedObservation = equipmentInventoryCombinedObservationFor(row);
      const eventCells = events
        .map((event) => `<td class="equipment-qty equipment-event-column">${escapeEquipmentHtml(row.eventQuantities.get(event.id) || 0)}</td>`)
        .join("");
      return `
        <tr class="${zeroInventory ? "equipment-inventory-zero-row" : ""}" data-equipment-key="${escapeEquipmentHtml(row.key)}">
          <td>${escapeEquipmentHtml(row.description)}</td>
          ${eventCells}
          <td class="equipment-qty equipment-required-total">
            <strong>${escapeEquipmentHtml(required)}</strong>
            ${transferApplied ? `<small>${escapeEquipmentHtml(multipleTransfers ? `${row.transferRouteCount} trasiegos` : "Trasiego de equipo")}</small>` : ""}
          </td>
          <td>
            ${
              editable
                ? `<input class="equipment-inventory-input${warehouseRecord ? " is-warehouse-synced" : ""}" type="text" inputmode="decimal" value="${escapeEquipmentHtml(inventory)}" aria-label="Inventario físico de ${escapeEquipmentHtml(row.description)}" ${warehouseRecord ? 'readonly aria-readonly="true" title="Sincronizado con Contabilidad de equipo"' : ""} />`
                : escapeEquipmentHtml(inventory)
            }
          </td>
          <td class="equipment-qty ${shortageClass}">${escapeEquipmentHtml(availableAfterRequirement)}</td>
          <td class="${actionClass}">${escapeEquipmentHtml(actionLabel)}</td>
          <td>
            ${
              editable
                ? `${automaticObservation ? `<small class="equipment-inventory-auto-observation">${escapeEquipmentHtml(automaticObservation)}</small>` : ""}<input class="equipment-observation-input" type="text" value="${escapeEquipmentHtml(observation)}" placeholder="Observaciones" />`
                : escapeEquipmentHtml(combinedObservation)
            }
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table class="equipment-base-table equipment-inventory-table${editable ? "" : " equipment-table-compact"}">
      <thead>
        <tr class="equipment-summary-date-row">
          <th class="equipment-description-column" rowspan="4">DESCRIPCION DE EQUIPO</th>
          ${eventDateHeaders}
          <th class="equipment-total-column" rowspan="3">EQUIPO REQUERIDO</th>
          <th class="equipment-inventory-column" rowspan="3">INVENTARIO FISICO BODEGA PP</th>
          <th class="equipment-shortage-column" rowspan="3">EQUIPO DISPONIBLE</th>
          <th class="equipment-action-column" rowspan="3">ACCION</th>
          <th class="equipment-observation-column" rowspan="3">OBSERVACIONES</th>
        </tr>
        <tr class="equipment-summary-date-row">
          ${eventSetupHeaders}
        </tr>
        <tr>
          ${eventHeaders}
        </tr>
        <tr class="equipment-inventory-subhead">
          ${eventQuantityHeaders}
          <th class="equipment-total-column">TOTAL</th>
          <th class="equipment-inventory-column">TOTAL</th>
          <th class="equipment-shortage-column">TOTAL</th>
          <th class="equipment-action-column"></th>
          <th class="equipment-observation-column"></th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function consolidateEquipmentRentalRows(summaryRows, events) {
  const groups = new Map();
  (Array.isArray(summaryRows) ? summaryRows : []).forEach((row) => {
    if (!row || row.type === "category") return;
    const identity = equipmentInventoryCanonicalKey(row.inventorySourceItem?.description || row.description || row.key);
    if (!identity) return;
    let group = groups.get(identity);
    if (!group) {
      group = {
        baseRow: row,
        identity,
        description: row.description,
        descriptionFromInventory: Boolean(row.inventorySourceItem),
        quantity: 0,
        eventQuantities: new Map(),
        inventoryEntries: new Map(),
        observations: []
      };
      groups.set(identity, group);
    } else if (row.inventorySourceItem && !group.descriptionFromInventory) {
      group.baseRow = row;
      group.description = row.description;
      group.descriptionFromInventory = true;
    }

    group.quantity += Number(row.quantity) || 0;
    row.eventQuantities?.forEach((quantity, eventId) => {
      group.eventQuantities.set(
        eventId,
        (Number(group.eventQuantities.get(eventId)) || 0) + (Number(quantity) || 0)
      );
    });

    const inventorySourceKey = row.inventorySourceItem ? row.key : `equipo-${identity}`;
    if (!group.inventoryEntries.has(inventorySourceKey)) {
      group.inventoryEntries.set(inventorySourceKey, equipmentInventoryAvailableValueFor(row));
    }
    const observation = equipmentInventoryCombinedObservationFor(row);
    if (observation && !group.observations.includes(observation)) group.observations.push(observation);
  });

  return [...groups.values()]
    .map((group) => {
      const inventoryEntries = [...group.inventoryEntries.values()];
      const inventoryNumber = inventoryEntries.reduce(
        (total, inventory) => total + equipmentInventoryNumber(inventory),
        0
      );
      const inventory = inventoryEntries.length === 1
        ? inventoryEntries[0]
        : inventoryEntries.some((value) => String(value ?? "").trim() !== "")
          ? inventoryNumber
          : "";
      const missing = Math.max(0, group.quantity - inventoryNumber);
      const eventDetails = events
        .map((event) => {
          const quantity = Number(group.eventQuantities.get(event.id)) || 0;
          return quantity > 0 ? `${eventColumnName(event)}: ${quantity}` : "";
        })
        .filter(Boolean)
        .join(" / ");
      return {
        ...group.baseRow,
        key: `renta-${group.identity}`,
        matchKey: group.identity,
        description: group.description,
        quantity: group.quantity,
        eventQuantities: group.eventQuantities,
        inventory,
        missing,
        eventDetails,
        observation: group.observations.join(" / ")
      };
    });
}

function equipmentRentalRows() {
  const events = activeEquipmentEvents();
  return consolidateEquipmentRentalRows(equipmentRowsSummary(), events)
    .map((row) => {
      const rentalKey = row.matchKey || row.key;
      const override = equipmentState.rentalOverrides.get(rentalKey) || {};
      const quantity = Object.hasOwn(override, "quantity") ? Math.max(0, Number(override.quantity) || 0) : row.quantity;
      const inventory = Object.hasOwn(override, "inventory") ? Math.max(0, Number(override.inventory) || 0) : row.inventory;
      const calculatedMissing = Math.max(0, quantity - equipmentInventoryNumber(inventory));
      const missing = override.missingManual
        ? Math.max(0, Number(override.missing) || 0)
        : calculatedMissing;
      return {
        ...row,
        rentalKey,
        description: Object.hasOwn(override, "description") ? String(override.description || "") : row.description,
        eventDetails: Object.hasOwn(override, "eventDetails") ? String(override.eventDetails || "") : row.eventDetails,
        quantity,
        inventory,
        missing,
        observation: Object.hasOwn(override, "observation") ? String(override.observation || "") : row.observation
      };
    })
    .filter((row) => row.missing > 0 || equipmentState.rentalOverrides.has(row.rentalKey));
}

function tableForEquipmentRentalReport(rows, editable = false) {
  if (!rows.length) {
    return `<p class="equipment-empty">No hay equipo para renta con el inventario actual.</p>`;
  }
  const body = rows
    .map(
      (row) => `
        <tr data-equipment-rental-key="${escapeEquipmentHtml(row.rentalKey)}">
          <td>${editable ? `<textarea class="equipment-rental-edit-input" data-equipment-rental-field="description" rows="2">${escapeEquipmentHtml(row.description)}</textarea>` : escapeEquipmentHtml(row.description)}</td>
          <td>${editable ? `<textarea class="equipment-rental-edit-input" data-equipment-rental-field="eventDetails" rows="2">${escapeEquipmentHtml(row.eventDetails)}</textarea>` : escapeEquipmentHtml(row.eventDetails)}</td>
          <td class="equipment-qty">${editable ? `<input class="equipment-rental-edit-input" data-equipment-rental-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(row.quantity)}" />` : escapeEquipmentHtml(row.quantity)}</td>
          <td class="equipment-qty">${editable ? `<input class="equipment-rental-edit-input" data-equipment-rental-field="inventory" type="number" min="0" step="1" value="${escapeEquipmentHtml(row.inventory)}" />` : escapeEquipmentHtml(row.inventory)}</td>
          <td class="equipment-rent-needed">${editable ? `<input class="equipment-rental-edit-input equipment-rental-missing-input" data-equipment-rental-field="missing" type="number" min="0" step="1" value="${escapeEquipmentHtml(row.missing)}" />` : escapeEquipmentHtml(row.missing)}</td>
          <td>${editable ? `<textarea class="equipment-rental-edit-input" data-equipment-rental-field="observation" rows="2">${escapeEquipmentHtml(row.observation)}</textarea>` : escapeEquipmentHtml(row.observation)}</td>
        </tr>`
    )
    .join("");
  return `
    <table class="equipment-base-table equipment-rental-table equipment-table-compact">
      <thead>
        <tr>
          <th>Equipo</th>
          <th>Eventos</th>
          <th>Total requerido</th>
          <th>Inventario disponible</th>
          <th>Equipo para renta</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function bindEquipmentRentalReportInputs() {
  const host = equipmentQuery("#equipmentRentPdfTable");
  if (!host) return;
  host.querySelectorAll("tr[data-equipment-rental-key]").forEach((rowElement) => {
    const rentalKey = rowElement.dataset.equipmentRentalKey || "";
    rowElement.querySelectorAll("[data-equipment-rental-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.equipmentRentalField;
        const override = { ...(equipmentState.rentalOverrides.get(rentalKey) || {}) };
        if (["quantity", "inventory", "missing"].includes(field)) {
          override[field] = Math.max(0, Number(input.value) || 0);
        } else {
          override[field] = input.value;
        }
        if (field === "missing") {
          override.missingManual = true;
        } else if (["quantity", "inventory"].includes(field) && !override.missingManual) {
          const currentRentalRow = equipmentRentalRows().find((row) => row.rentalKey === rentalKey);
          const quantity = field === "quantity" ? override.quantity : currentRentalRow?.quantity;
          const inventory = field === "inventory" ? override.inventory : currentRentalRow?.inventory;
          override.missing = Math.max(0, (Number(quantity) || 0) - (Number(inventory) || 0));
          const missingInput = rowElement.querySelector('[data-equipment-rental-field="missing"]');
          if (missingInput) missingInput.value = String(override.missing);
        }
        equipmentState.rentalOverrides.set(rentalKey, override);
      });
    });
  });
}

function bindEquipmentInventoryInputs() {
  equipmentQuery("#equipmentInventoryTable")
    ?.querySelectorAll("tr[data-equipment-key]")
    .forEach((row) => {
      const key = row.dataset.equipmentKey;
      const inventoryInput = row.querySelector(".equipment-inventory-input");
      if (inventoryInput && !inventoryInput.readOnly) {
        inventoryInput.addEventListener("input", (event) => {
          invalidateEquipmentRentalPreview();
          equipmentState.inventory.set(key, event.target.value);
          row.classList.toggle("equipment-inventory-zero-row", equipmentInventoryNeedsManualEntry(event.target.value));
          renderEquipmentPdfPreview();
        });
        inventoryInput.addEventListener("change", (event) => {
          invalidateEquipmentRentalPreview();
          equipmentState.inventory.set(key, event.target.value);
          renderEquipmentModule();
        });
      }
      row.querySelector(".equipment-observation-input")?.addEventListener("change", (event) => {
        equipmentState.observations.set(key, event.target.value);
        renderEquipmentPdfPreview();
      });
    });
}

function waitForEquipmentAuthenticatedApp() {
  const siteApp = equipmentQuery("#siteApp");
  if (!siteApp || !siteApp.classList.contains("is-hidden")) return Promise.resolve();
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (siteApp.classList.contains("is-hidden")) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(siteApp, { attributes: true, attributeFilter: ["class"] });
  });
}

async function refreshEquipmentWarehouseInventory() {
  if (equipmentWarehouseInventoryState.refreshPromise) return equipmentWarehouseInventoryState.refreshPromise;
  if (!/^https?:$/.test(window.location.protocol)) return false;
  equipmentWarehouseInventoryState.refreshPromise = fetch("/api/inventario-bodega", {
    credentials: "same-origin",
    cache: "no-store"
  })
    .then((response) => {
      if (!response.ok) throw new Error("Inventario de Contabilidad no disponible");
      return response.json();
    })
    .then((payload) => {
      const changed = applyEquipmentWarehouseInventoryPayload(payload);
      if (changed) renderEquipmentModule();
      return changed;
    })
    .catch(() => false)
    .finally(() => {
      equipmentWarehouseInventoryState.refreshPromise = null;
    });
  return equipmentWarehouseInventoryState.refreshPromise;
}

async function initEquipmentWarehouseInventorySync() {
  await waitForEquipmentAuthenticatedApp();
  await refreshEquipmentWarehouseInventory();
  const requirementPage = equipmentQuery("#requerimientoEquipoPage");
  if (requirementPage && typeof MutationObserver === "function") {
    const observer = new MutationObserver(() => {
      if (!requirementPage.classList.contains("is-active")) return;
      refreshEquipmentWarehouseInventory();
      window.setTimeout(refreshEquipmentWarehouseInventory, 900);
    });
    observer.observe(requirementPage, { attributes: true, attributeFilter: ["class"] });
  }
  window.addEventListener("focus", () => {
    if (!requirementPage || requirementPage.classList.contains("is-active")) {
      refreshEquipmentWarehouseInventory();
    }
  });
  equipmentWarehouseInventoryState.refreshTimer = window.setInterval(() => {
    if (!requirementPage || requirementPage.classList.contains("is-active")) {
      refreshEquipmentWarehouseInventory();
    }
  }, 5000);
}

function renderEquipmentWindowState() {
  const activeWindow = ["summary", "transfer"].includes(equipmentState.activeWindow) ? equipmentState.activeWindow : "review";
  const mainPanel = equipmentQuery("#equipmentMainPanel");
  const extrasPanel = equipmentQuery("#equipmentExtrasPanel");
  const inventoryPanel = equipmentQuery("#equipmentInventoryPanel");
  const transferPanel = equipmentQuery("#equipmentTransferPanel");
  const reviewButton = equipmentQuery("#equipmentReviewWindowButton");
  const summaryButton = equipmentQuery("#equipmentSummaryWindowButton");
  const transferButton = equipmentQuery("#equipmentTransferWindowButton");
  const undoButton = equipmentQuery("#equipmentUndoDeleteButton");
  const removeButton = equipmentQuery("#equipmentRemoveWindowButton");
  const addEventButton = equipmentQuery("#equipmentAddEventButton");
  const summaryTransferButton = equipmentQuery("#equipmentSummaryTransferButton");
  const summarySearch = equipmentQuery("#equipmentSummarySearch");
  const reviewPdfPreview = equipmentQuery("#equipmentReviewPdfPreview");
  const rentPdfPreview = equipmentQuery("#equipmentRentPdfPreview");
  const transferPdfPreview = equipmentQuery("#equipmentTransferPdfPreview");
  if (summaryTransferButton) {
    const transferCount = equipmentSummaryTransferRoutesWithEvents(activeEquipmentEvents(), true).length;
    summaryTransferButton.classList.toggle("is-active", equipmentState.summaryTransferEnabled);
    summaryTransferButton.setAttribute("aria-pressed", String(equipmentState.summaryTransferEnabled));
    summaryTransferButton.textContent = equipmentState.summaryTransferEnabled && transferCount
      ? `Trasegar Equipo (${transferCount} ${transferCount === 1 ? "ruta" : "rutas"})`
      : "Trasegar Equipo";
  }
  if (summarySearch && summarySearch.value !== equipmentState.summarySearchTerm) summarySearch.value = equipmentState.summarySearchTerm;
  if (mainPanel) mainPanel.classList.toggle("is-hidden", activeWindow !== "review");
  if (extrasPanel) extrasPanel.classList.toggle("is-hidden", activeWindow !== "review");
  if (inventoryPanel) inventoryPanel.classList.toggle("is-hidden", activeWindow !== "summary");
  if (transferPanel) transferPanel.classList.toggle("is-hidden", activeWindow !== "transfer");
  if (reviewPdfPreview) reviewPdfPreview.classList.toggle("is-hidden", activeWindow !== "review");
  if (rentPdfPreview) {
    rentPdfPreview.classList.toggle(
      "is-hidden",
      activeWindow !== "summary" || !equipmentState.rentPreviewVisible
    );
  }
  if (transferPdfPreview) transferPdfPreview.classList.toggle("is-hidden", activeWindow !== "transfer");
  if (reviewButton) reviewButton.classList.toggle("is-active", activeWindow === "review");
  if (summaryButton) summaryButton.classList.toggle("is-active", activeWindow === "summary");
  if (transferButton) transferButton.classList.toggle("is-active", activeWindow === "transfer");
  if (addEventButton) addEventButton.textContent = equipmentState.selectedEventId ? "Crear nueva ventana" : "Agregar ventana";
  if (undoButton) undoButton.disabled = !equipmentState.deletedStack.length;
  if (removeButton) removeButton.disabled = !equipmentState.selectedEventId;
}

function switchEquipmentWindow(windowName) {
  equipmentState.activeWindow = ["summary", "transfer"].includes(windowName) ? windowName : "review";
  renderEquipmentModule();
}

function resetEquipmentWindowDraft() {
  equipmentState.selectedEventId = "";
  equipmentState.selectedServiceId = "";
  equipmentState.selectedServiceIds.clear();
  equipmentState.djAudioType = "qsc";
  equipmentState.selectedExtraIds.clear();
  equipmentState.manualMainItems = [];
  equipmentState.manualMainSections = [];
  equipmentState.manualExtras = [];
  equipmentState.itemOverrides.clear();
  equipmentState.sectionAddedItems.clear();
  equipmentState.removedItemIds.clear();
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  equipmentState.rentPreviewVisible = false;
  equipmentState.servicePickerOpen = false;
  equipmentState.expandedEquipmentSectionIds.clear();
  equipmentState.draftWarehouseDispatchId = createEquipmentWarehouseDispatchId();
  updateNativeEquipmentServiceSelect();
  populateEquipmentEventFields(null);
  const notesInput = equipmentQuery("#equipmentNotes");
  if (notesInput) notesInput.value = "";
}

function equipmentRentReportValidationMessage() {
  if (!equipmentRowsSummary().some((row) => row.type !== "category")) {
    return "Agregue al menos una ventana con equipo antes de generar el resumen.";
  }
  if (!equipmentRentalRows().length) {
    return "No hay equipo para rentar con el inventario actual.";
  }
  return "";
}

function closeEquipmentLogisticsDecision() {
  const dialog = equipmentQuery("#equipmentLogisticsDialog");
  equipmentLogisticsDecision = null;
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

function runEquipmentLogisticsDecision(action) {
  const callback = action === "rent"
    ? equipmentLogisticsDecision?.onRent
    : equipmentLogisticsDecision?.onTransfer;
  closeEquipmentLogisticsDecision();
  if (typeof callback === "function") callback();
}

function equipmentLogisticsDecisionMessage(analysis, context = "transfer") {
  const from = analysis?.from;
  const to = analysis?.to;
  const fromDate = equipmentEventReturnDateTime(from);
  const toDate = equipmentEventSetupDateTimeLabel(to);
  const fromEventDate = equipmentEventDateLabel(from);
  const toEventDate = equipmentEventDateLabel(to);
  const movement = `El equipo utilizado el ${fromEventDate} en ${from?.place || "el evento de origen"} se propone usar el ${toEventDate} en ${to?.place || "el evento de destino"}.`;
  const timingDetail = `Ingreso del origen: ${fromDate}. Montaje del destino: ${toDate}.`;
  if (!analysis?.timingKnown) {
    return {
      title: "Fechas y horas por confirmar",
      summary: movement,
      detail: `${timingDetail} Complete ambos horarios para que la recomendación sea exacta.`,
      recommendation: "Puede continuar con trasiego o revisar la renta manualmente.",
      status: "warning"
    };
  }
  if (analysis.overlaps) {
    return {
      title: "El equipo aún estará ocupado",
      summary: movement,
      detail: `${timingDetail} El montaje del destino comienza ${formatEquipmentMinutes(analysis.rawGapMinutes)} antes del ingreso del equipo del origen.`,
      recommendation: "La renta aplica por cruce de horarios. También puede forzar el trasiego si confirma otra logística.",
      status: "danger"
    };
  }
  if (analysis.tight) {
    return {
      title: "Tiempo ajustado para trasegar",
      summary: movement,
      detail: `${timingDetail} Hay ${formatEquipmentMinutes(analysis.rawGapMinutes)} entre ambos horarios; el margen operativo recomendado es de ${formatEquipmentMinutes(EQUIPMENT_TRANSFER_BUFFER_MINUTES)}.`,
      recommendation: "Decida si corresponde rentar, trasegar o cancelar.",
      status: "warning"
    };
  }
  return {
    title: context === "rent" ? "No aplica renta conjunta por horario" : "Trasiego disponible",
    summary: movement,
    detail: `${timingDetail} Hay ${formatEquipmentMinutes(analysis.rawGapMinutes)} entre ambos horarios.`,
    recommendation: context === "rent"
      ? "Los eventos no se sumarán entre sí; el reporte conservará únicamente faltantes individuales o simultáneos reales."
      : "El equipo puede seleccionarse para trasiego sin duplicarlo en la renta.",
    status: "ok"
  };
}

function openEquipmentLogisticsDecision({ from, to, context = "transfer", onRent = null, onTransfer = null } = {}) {
  const dialog = equipmentQuery("#equipmentLogisticsDialog");
  if (!dialog || !from || !to) return false;
  const analysis = equipmentLogisticsPairAnalysis(from, to);
  const content = equipmentLogisticsDecisionMessage(analysis, context);
  const title = equipmentQuery("#equipmentLogisticsDialogTitle");
  const summary = equipmentQuery("#equipmentLogisticsDialogSummary");
  const detail = equipmentQuery("#equipmentLogisticsDialogDetail");
  const recommendation = equipmentQuery("#equipmentLogisticsDialogRecommendation");
  const rentButton = equipmentQuery("#equipmentLogisticsRentButton");
  const transferButton = equipmentQuery("#equipmentLogisticsTransferButton");
  if (title) title.textContent = content.title;
  if (summary) summary.textContent = content.summary;
  if (detail) detail.textContent = content.detail;
  if (recommendation) recommendation.textContent = content.recommendation;
  dialog.dataset.status = content.status;
  if (rentButton) {
    rentButton.disabled = typeof onRent !== "function";
    rentButton.textContent = "Rentar";
  }
  if (transferButton) {
    transferButton.disabled = typeof onTransfer !== "function";
    transferButton.textContent = analysis.rentApplies ? "Trasegar de todos modos" : "Trasegar";
  }
  equipmentLogisticsDecision = { onRent, onTransfer };
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  return true;
}

function enableEquipmentTransferConfiguration() {
  equipmentState.summaryTransferEnabled = true;
  equipmentState.activeWindow = "summary";
  cleanupEquipmentSummaryTransferRoutes(activeEquipmentEvents());
  renderEquipmentModule();
  const selector = equipmentQuery("#equipmentSummaryTransferSelector");
  if (selector && typeof selector.scrollIntoView === "function") {
    window.requestAnimationFrame(() => selector.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function requestEquipmentTransferDecision(target = "summary") {
  const status = equipmentQuery("#equipmentSaveStatus");
  const schedule = equipmentScheduleAnalysis(equipmentState.events);
  if (schedule.events.length < 2 || !schedule.focusPair) {
    if (status) status.textContent = "Agregue al menos dos ventanas para configurar un trasiego.";
    return;
  }
  openEquipmentLogisticsDecision({
    from: schedule.focusPair.from,
    to: schedule.focusPair.to,
    context: "transfer",
    onRent: () => previewEquipmentRentReport({ skipLogisticsDecision: true }),
    onTransfer: () => {
      if (target === "preview" && equipmentConfiguredTransferRoutesWithItems().length) {
        equipmentState.activeWindow = "transfer";
        renderEquipmentModule();
        return;
      }
      enableEquipmentTransferConfiguration();
    }
  });
}

function previewEquipmentRentReport(options = {}) {
  const status = equipmentQuery("#equipmentSaveStatus");
  const skipLogisticsDecision = Boolean(options?.skipLogisticsDecision);
  const schedule = equipmentScheduleAnalysis(equipmentState.events);
  if (!skipLogisticsDecision && schedule.events.length > 1 && schedule.focusPair) {
    const hasRentalRows = equipmentRentalRows().length > 0;
    openEquipmentLogisticsDecision({
      from: schedule.focusPair.from,
      to: schedule.focusPair.to,
      context: "rent",
      onRent: hasRentalRows ? () => previewEquipmentRentReport({ skipLogisticsDecision: true }) : null,
      onTransfer: enableEquipmentTransferConfiguration
    });
    if (!hasRentalRows && status) {
      status.textContent = "No hay faltantes para rentar con el inventario y los horarios actuales.";
    }
    return;
  }
  const validationMessage = equipmentRentReportValidationMessage();
  if (validationMessage) {
    if (status) status.textContent = validationMessage;
    return;
  }
  equipmentState.activeWindow = "summary";
  equipmentState.rentPreviewVisible = true;
  renderEquipmentModule();
  if (status) status.textContent = "Previsualización del Resumen de Renta lista para revisar y guardar.";
  const preview = equipmentQuery("#equipmentRentPdfPreview");
  if (preview && typeof preview.scrollIntoView === "function") {
    window.requestAnimationFrame(() => preview.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

function saveCurrentEquipmentWindow() {
  const status = equipmentQuery("#equipmentSaveStatus");
  const draft = currentEquipmentEventDraft();
  if (!currentEquipmentService()) {
    if (status) status.textContent = "Seleccione el tipo de servicio antes de guardar la ventana.";
    return false;
  }
  if (!draft.place || draft.place === "Lugar por definir") {
    if (status) status.textContent = "Escriba el lugar del evento antes de guardar la ventana.";
    return false;
  }
  if (!draft.name || draft.name === "Evento por definir") {
    if (status) status.textContent = "Escriba el nombre del evento antes de guardar la ventana.";
    return false;
  }
  const event = selectedEquipmentEvent();
  if (!event) {
    const previousEventCount = equipmentState.events.length;
    addEquipmentEvent();
    return equipmentState.events.length > previousEventCount;
  }
  invalidateEquipmentRentalPreview();
  updateEquipmentEventFromCurrent(event);
  if (status) status.textContent = `Ventana actualizada: ${event.place || event.name}`;
  renderEquipmentModule();
  return true;
}

function saveEquipmentWindowById(eventId) {
  const event = equipmentState.events.find((item) => item.id === eventId);
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!event) {
    if (status) status.textContent = "No se encontró la ventana que desea guardar.";
    return false;
  }
  if (equipmentState.selectedEventId !== eventId) loadEquipmentEvent(eventId);
  return saveCurrentEquipmentWindow();
}

async function saveEquipmentEventPdf(eventId) {
  if (!saveEquipmentWindowById(eventId)) return;
  await saveEquipmentPdf("full");
}

function removeEquipmentEventById(eventId) {
  if (!eventId) return;
  const status = equipmentQuery("#equipmentSaveStatus");
  if (equipmentState.selectedEventId && equipmentState.selectedEventId !== eventId) {
    syncActiveEquipmentEvent();
  }
  const index = equipmentState.events.findIndex((event) => event.id === eventId);
  if (index < 0) return;
  const removed = equipmentState.events[index];
  const wasSelected = equipmentState.selectedEventId === eventId;
  invalidateEquipmentRentalPreview();
  equipmentState.events.splice(index, 1);
  equipmentState.summaryTransferRoutes.forEach((route) => {
    route.eventIds = route.eventIds.filter((routeEventId) => routeEventId !== eventId);
  });
  if (wasSelected) {
    const nextEvent = equipmentState.events[index] || equipmentState.events[index - 1] || null;
    equipmentState.selectedEventId = "";
    if (nextEvent) {
      loadEquipmentEvent(nextEvent.id);
      if (status) status.textContent = `Ventana eliminada: ${removed.place || removed.name || "sin nombre"}`;
      return;
    }
    resetEquipmentWindowDraft();
  }
  if (status) status.textContent = `Ventana eliminada: ${removed.place || removed.name || "sin nombre"}`;
  renderEquipmentModule();
}

function removeEquipmentActiveWindow() {
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!equipmentState.selectedEventId) {
    if (status) status.textContent = "Seleccione una ventana para eliminarla.";
    return;
  }
  removeEquipmentEventById(equipmentState.selectedEventId);
}

function clearEquipmentWorkingArea() {
  if (!window.confirm("¿Está seguro que desea limpiar todo a 0?")) return;
  equipmentState.events = [];
  resetEquipmentWindowDraft();
  equipmentState.summaryTransferRoutes = [];
  equipmentState.activeSummaryTransferRouteId = "";
  equipmentState.summaryTransferEnabled = false;
  invalidateEquipmentRentalPreview();
  equipmentState.inventory.clear();
  equipmentState.observations.clear();
  renderEquipmentModule();
}

function renderEquipmentPdfPreview() {
  const service = currentEquipmentService();
  const sections = selectedEquipmentSections();
  const events = equipmentPdfEvents();
  const summaryEvents = activeEquipmentEvents();
  const place = eventSummaryText(events, "place", "Lugar por definir");
  const eventName = eventSummaryText(events, "name");
  const setupAt = eventSummarySetupDateTimeText(events);
  const date = eventSummaryText(events, "date");
  const rentPlace = eventSummaryText(summaryEvents, "place", "Lugar por definir");
  const rentEventName = eventSummaryText(summaryEvents, "name");
  const rentSetupAt = eventSummarySetupDateTimeText(summaryEvents);
  const rentDate = eventSummaryText(summaryEvents, "date");
  const notes = equipmentQuery("#equipmentNotes")?.value.trim() || "";
  const rentalRows = equipmentRentalRows();
  const transferPlan = equipmentTransferPlanData();

  const title = service?.name || "Cuadro de equipo";
  const rentTitle = "Resumen de renta";
  if (equipmentQuery("#equipmentPdfTitle")) equipmentQuery("#equipmentPdfTitle").textContent = title;
  if (equipmentQuery("#equipmentPdfPlace")) equipmentQuery("#equipmentPdfPlace").textContent = place;
  if (equipmentQuery("#equipmentPdfEvent")) equipmentQuery("#equipmentPdfEvent").textContent = eventName;
  if (equipmentQuery("#equipmentPdfSetupAt")) equipmentQuery("#equipmentPdfSetupAt").textContent = setupAt;
  if (equipmentQuery("#equipmentPdfDate")) equipmentQuery("#equipmentPdfDate").textContent = date;
  if (equipmentQuery("#equipmentPdfInAt")) equipmentQuery("#equipmentPdfInAt").textContent = eventSummaryDateTimeText(events, "equipmentInAt");

  const notesEl = equipmentQuery("#equipmentPdfNotes");
  if (notesEl) {
    notesEl.textContent = notes;
    notesEl.classList.toggle("is-hidden", !notes);
  }

  if (equipmentQuery("#equipmentPdfMainTable")) {
    equipmentQuery("#equipmentPdfMainTable").innerHTML = tableForEquipmentSections(sections, true);
  }
  renderEquipmentPdfTransferDestinations(transferPlan);
  renderEquipmentTransferPdf(transferPlan);
  if (equipmentQuery("#equipmentRentPdfTitle")) equipmentQuery("#equipmentRentPdfTitle").textContent = rentTitle;
  if (equipmentQuery("#equipmentRentPdfPlace")) equipmentQuery("#equipmentRentPdfPlace").textContent = rentPlace;
  if (equipmentQuery("#equipmentRentPdfEvents")) equipmentQuery("#equipmentRentPdfEvents").textContent = rentEventName;
  if (equipmentQuery("#equipmentRentPdfSetupAt")) equipmentQuery("#equipmentRentPdfSetupAt").textContent = rentSetupAt;
  if (equipmentQuery("#equipmentRentPdfDate")) equipmentQuery("#equipmentRentPdfDate").textContent = rentDate;
  if (equipmentQuery("#equipmentRentPdfInAt")) equipmentQuery("#equipmentRentPdfInAt").textContent = eventSummaryDateTimeText(summaryEvents, "equipmentInAt");
  const rentNotesEl = equipmentQuery("#equipmentRentPdfNotes");
  if (rentNotesEl) {
    rentNotesEl.textContent = notes;
    rentNotesEl.classList.toggle("is-hidden", !notes);
  }
  if (equipmentQuery("#equipmentRentPdfTable")) {
    equipmentQuery("#equipmentRentPdfTable").innerHTML = tableForEquipmentRentalReport(rentalRows, true);
  }
  bindEquipmentRentalReportInputs();
}

function renderEquipmentModule() {
  syncSelectedEquipmentService();
  const service = currentEquipmentService();
  const workspace = equipmentQuery("#equipmentWorkspace");
  const shouldShowWorkspace = Boolean(service) || equipmentState.events.length > 0 || ["summary", "transfer"].includes(equipmentState.activeWindow);
  if (workspace) workspace.classList.toggle("is-hidden", !shouldShowWorkspace);
  if (equipmentQuery("#equipmentServiceName")) equipmentQuery("#equipmentServiceName").textContent = service?.name || "";
  const editTemplateButton = equipmentQuery("#equipmentEditServiceTemplateButton");
  if (editTemplateButton) {
    const selectedServiceCount = selectedEquipmentServiceIds().length;
    editTemplateButton.disabled = selectedServiceCount !== 1;
    editTemplateButton.title = selectedServiceCount === 1
      ? "Editar y guardar permanentemente el cuadro de este servicio"
      : "Seleccione exactamente un tipo de servicio para editar su cuadro";
  }
  renderEquipmentInventoryNameOptions();
  renderDjAudioOptions();
  renderEquipmentServicePicker();
  renderEquipmentEvents();
  if (equipmentQuery("#equipmentMainTable")) {
    equipmentQuery("#equipmentMainTable").innerHTML = tableForEquipmentSections(selectedEquipmentSections());
  }
  bindEquipmentSectionInputs();
  renderEquipmentPredefinedExtras();
  renderManualEquipmentExtras();
  renderEquipmentSummaryTransferSelector();
  if (equipmentQuery("#equipmentInventoryTable")) {
    equipmentQuery("#equipmentInventoryTable").innerHTML = tableForEquipmentInventory(equipmentFilterSummaryRows(equipmentRowsSummary()), true);
  }
  bindEquipmentInventoryInputs();
  bindEquipmentSummaryTransferSelector();
  renderEquipmentSummaryTransferNotice();
  renderEquipmentTransferUnusedPanel();
  renderEquipmentTransferPanel();
  renderEquipmentPdfPreview();
  renderEquipmentWindowState();
  renderEquipmentCatalogEditor();
}

function renderDjAudioOptions() {
  const audioOptions = equipmentQuery("#equipmentDjAudioOptions");
  if (!audioOptions) return;
  const audioServices = currentEquipmentServices().filter((service) => service.audioOptions);
  const service = audioServices[0] || null;
  const hasAudioOptions = Boolean(service);
  audioOptions.classList.toggle("is-hidden", !hasAudioOptions);
  const label = audioOptions.querySelector("[data-audio-options-label]");
  if (label) {
    label.textContent = audioServices.length > 1
      ? `Tipo de audio para ${audioServices.length} servicios`
      : hasAudioOptions ? `Tipo de audio para ${service.name}` : "Tipo de audio";
  }
  audioOptions.querySelectorAll("[data-dj-audio-type]").forEach((button) => {
    const audioType = button.dataset.djAudioType;
    const isAvailable = hasAudioOptions && audioServices.some((audioService) => Boolean(audioService.audioOptions?.[audioType]));
    button.hidden = hasAudioOptions && !isAvailable;
    button.classList.toggle("is-active", button.dataset.djAudioType === equipmentState.djAudioType);
  });
}

async function equipmentPdfHtml(documentSelector = "#equipmentPdfDocument", title = "Cuadro de equipo") {
  const [stylesheet, logoSource] = await Promise.all([
    fetch("styles.css", { credentials: "same-origin" }).then((response) => response.text()),
    equipmentPdfLogoSource()
  ]);
  const sourceElement = equipmentQuery(documentSelector);
  const sourceClone = sourceElement?.cloneNode(true) || null;
  sourceClone?.querySelectorAll("input, textarea, select").forEach((control) => {
    const value = control.tagName === "SELECT"
      ? control.selectedOptions?.[0]?.textContent || ""
      : control.value;
    const replacement = document.createElement("span");
    replacement.className = "equipment-pdf-control-value";
    replacement.textContent = value;
    control.replaceWith(replacement);
  });
  const sourceHtml = sourceClone?.outerHTML || "";
  const documentHtml = equipmentHtmlWithPdfAssets(sourceHtml, logoSource);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeEquipmentHtml(title)}</title>
    <style>
      ${stylesheet}
      body { margin: 0; background: #ffffff; }
      .equipment-pdf-document { display: block; max-width: none; margin: 0; box-shadow: none; border: 0; }
      .equipment-pdf-document .equipment-base-table { min-width: 0; }
      .equipment-pdf-document input { border: 0; padding: 0; }
      @page { size: letter; margin: 8mm; }
    </style>
  </head>
  <body>${documentHtml}</body>
</html>`;
}

async function equipmentUsagePdfHtml() {
  const stylesheet = await fetch("styles.css", { credentials: "same-origin" }).then((response) => response.text());
  const service = currentEquipmentService();
  const title = service?.name ? `Equipo y extras - ${service.name}` : "Equipo y extras";
  const tableHtml = tableForEquipmentSections(warehousePdfSections(), true);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeEquipmentHtml(title)}</title>
    <style>
      ${stylesheet}
      body { margin: 0; background: #ffffff; }
      .equipment-pdf-document { display: block; max-width: none; margin: 0; padding: 0; box-shadow: none; border: 0; }
      .equipment-pdf-document .equipment-base-table { min-width: 0; width: 100%; }
      .equipment-pdf-document .equipment-base-table th,
      .equipment-pdf-document .equipment-base-table td { break-inside: avoid; }
      @page { size: letter; margin: 8mm; }
    </style>
  </head>
  <body>
    <section class="equipment-pdf-document equipment-usage-pdf-document">
      ${tableHtml}
    </section>
  </body>
</html>`;
}

const equipmentDirectoryPickerId = "requerimiento-equipo-cuadros";

function equipmentPdfFileName(mode = "full") {
  if (mode === "rent") {
    return `Resumen de renta - ${formatEquipmentDateForFile(currentEquipmentDateKey())}.pdf`;
  }
  if (mode === "transfer") {
    return `Resumen de trasiego - ${formatEquipmentDateForFile(currentEquipmentDateKey())}.pdf`;
  }
  const service = currentEquipmentService();
  const events = equipmentPdfEvents();
  const eventName = cleanEquipmentFilePart(events.map(equipmentEventNameForFile).join(" - ") || "Evento por definir", "Evento por definir");
  const setupName = cleanEquipmentFilePart(
    events.map((event) => formatEquipmentDateTimeForFile(equipmentEventSetupAt(event))).join(" - "),
    "Montaje por definir"
  );
  const serviceName = cleanEquipmentFilePart(service?.name || "Extras", "Extras");
  const eventDates = cleanEquipmentFilePart(events.map((event) => formatEquipmentDateForFile(event.date)).join(" - "), "Fecha por definir");
  return `${eventName} - ${setupName} - ${serviceName} - ${eventDates}.pdf`;
}

function equipmentEditableJsonFileName(fileName) {
  const pdfName = cleanEquipmentFilePart(fileName || equipmentPdfFileName(), "Cuadro de Equipo.pdf");
  return pdfName.replace(/\.pdf$/i, "") + ".requerimiento-equipo.json";
}

function cleanEquipmentJsonFilePart(value, fallback = "Cuadro de Equipo.requerimiento-equipo.json") {
  const baseName = cleanEquipmentFilePart(value || fallback, fallback).replace(/\.pdf$/i, "");
  return baseName.toLocaleLowerCase("es-GT").endsWith(".json") ? baseName : `${baseName}.json`;
}

function cloneEquipmentEventForEditable(event, index = 0) {
  return {
    id: event?.id || `event-editable-${index}`,
    warehouseDispatchId: event?.warehouseDispatchId || "",
    place: event?.place || "",
    name: event?.name || "",
    setupAt: equipmentEventSetupAt(event),
    phone: event?.phone || "",
    date: event?.date || "",
    equipmentOutAt: event?.equipmentOutAt || "",
    equipmentInAt: event?.equipmentInAt || "",
    responsible: event?.responsible || "",
    serviceIds: equipmentNormalizeServiceIds(event?.serviceIds?.length ? event.serviceIds : event?.serviceId),
    serviceId: equipmentNormalizeServiceIds(event?.serviceIds?.length ? event.serviceIds : event?.serviceId)[0] || "",
    serviceName: event?.serviceName || "",
    djAudioType: event?.djAudioType || "qsc",
    selectedExtraIds: Array.isArray(event?.selectedExtraIds) ? [...event.selectedExtraIds] : [],
    manualMainItems: cloneEquipmentSnapshotItems(event?.manualMainItems || []),
    manualMainSections: (event?.manualMainSections || []).map((section, sectionIndex) => ({
      id: section.id || `manual-section-${index}-${sectionIndex}`,
      title: section.title || "",
      items: cloneEquipmentSnapshotItems(section.items || [])
    })),
    manualExtras: cloneEquipmentSnapshotItems(event?.manualExtras || []),
    itemOverrides: Array.isArray(event?.itemOverrides) ? event.itemOverrides.map(([key, value]) => [key, { ...(value || {}) }]) : [],
    sectionAddedItems: Array.isArray(event?.sectionAddedItems)
      ? event.sectionAddedItems.map(([key, items]) => [String(key || ""), cloneEquipmentSnapshotItems(items || [])])
      : [],
    removedItemIds: Array.isArray(event?.removedItemIds) ? [...event.removedItemIds] : [],
    sections: cloneEquipmentSnapshotSections(event?.sections || [])
  };
}

function currentEquipmentEditableEvent() {
  const selectedEvent = selectedEquipmentEvent();
  const warehouseDispatchId = selectedEvent?.warehouseDispatchId || equipmentState.draftWarehouseDispatchId;
  if (selectedEvent && !selectedEvent.warehouseDispatchId) selectedEvent.warehouseDispatchId = warehouseDispatchId;
  return cloneEquipmentEventForEditable({
    ...currentEquipmentEventDraft(),
    ...captureEquipmentEventSnapshot(),
    id: equipmentState.selectedEventId || "event-draft",
    warehouseDispatchId
  });
}

function equipmentWarehouseDispatchItems(event) {
  const groups = new Map();
  const sections = event?.sections?.length ? event.sections : selectedEquipmentSections();
  sections.forEach((section) => {
    (section.items || []).forEach((rawItem) => {
      const item = normalizeEquipmentItem(rawItem);
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const description = String(item.description || "").trim();
      if (!description || quantity <= 0) return;
      const key = equipmentInventoryCanonicalKey(description);
      let group = groups.get(key);
      if (!group) {
        group = {
          description,
          category: section.title || "Equipo",
          quantity: 0,
          warehouseItemIds: []
        };
        groups.set(key, group);
      }
      group.quantity += quantity;
    });
  });

  groups.forEach((group) => {
    const matches = equipmentWarehouseInventoryState.recordsByLookupKey.get(
      equipmentInventoryCanonicalKey(group.description)
    ) || [];
    group.warehouseItemIds = [...new Set(matches.map((record) => record.id).filter(Boolean))];
  });
  return [...groups.values()];
}

function equipmentWarehouseDispatchPayload(event) {
  return {
    id: event.warehouseDispatchId || equipmentState.draftWarehouseDispatchId,
    eventId: event.id || "event-draft",
    source: "requerimiento-equipo",
    name: event.name || "Evento por definir",
    place: event.place || "Lugar por definir",
    setupAt: equipmentEventSetupAt(event),
    planner: "",
    eventDate: event.date || "",
    equipmentOutAt: equipmentEventSetupAt(event),
    equipmentInAt: event.equipmentInAt || "",
    responsible: event.responsible && event.responsible !== "Por definir" ? event.responsible : "",
    items: equipmentWarehouseDispatchItems(event)
  };
}

function equipmentEditablePayload(mode = "full", savedData = {}) {
  const currentEvent = currentEquipmentEditableEvent();
  const events = mode === "rent"
    ? (equipmentState.events.length ? sortEquipmentEventsByDate(equipmentState.events).map(cloneEquipmentEventForEditable) : [currentEvent])
    : [currentEvent];
  return {
    type: "live-productions-equipment-requirement",
    version: 5,
    mode,
    savedAt: new Date().toISOString(),
    fileName: savedData.fileName || equipmentPdfFileName(mode),
    pdfFileName: savedData.fileName || equipmentPdfFileName(mode),
    jsonFileName: savedData.jsonFileName || equipmentEditableJsonFileName(savedData.fileName || equipmentPdfFileName(mode)),
    pdfUrl: savedData.pdfUrl || "",
    jsonUrl: savedData.jsonUrl || "",
    event: currentEvent,
    events,
    warehouseDispatch: mode === "full" ? equipmentWarehouseDispatchPayload(currentEvent) : null,
    inventory: [...equipmentState.inventory.entries()],
    observations: [...equipmentState.observations.entries()],
    summaryTransferEnabled: equipmentState.summaryTransferEnabled,
    summaryTransferRoutes: equipmentState.summaryTransferRoutes.map((route) => ({
      id: route.id,
      eventIds: [...route.eventIds],
      legSelections: normalizeEquipmentTransferLegSelections(route.legSelections)
    })),
    activeSummaryTransferRouteId: equipmentState.activeSummaryTransferRouteId,
    summaryTransferEventIds: [...(equipmentState.summaryTransferRoutes[0]?.eventIds || [])],
    notes: equipmentQuery("#equipmentNotes")?.value || ""
  };
}

function equipmentPdfDownloadUrl(pdfUrl) {
  try {
    return new URL(pdfUrl, window.location.origin).href;
  } catch {
    return pdfUrl;
  }
}

function clickEquipmentDownloadLink(link) {
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadEquipmentUrlFallback(fileName, url) {
  const link = document.createElement("a");
  link.href = equipmentPdfDownloadUrl(url);
  link.download = fileName;
  link.target = "_blank";
  link.rel = "noopener";
  clickEquipmentDownloadLink(link);
}

function downloadEquipmentBlobFallback(fileName, blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.target = "_blank";
  link.rel = "noopener";
  clickEquipmentDownloadLink(link);
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function downloadEquipmentPdfFallback(fileName, pdfBlob, pdfUrl = "") {
  if (pdfUrl) {
    downloadEquipmentUrlFallback(fileName, pdfUrl);
    return;
  }
  downloadEquipmentBlobFallback(fileName, pdfBlob);
}

function downloadEquipmentJsonFallback(fileName, editablePayload) {
  downloadEquipmentBlobFallback(
    fileName,
    new Blob([JSON.stringify(editablePayload, null, 2)], { type: "application/json;charset=utf-8" })
  );
}

const equipmentPdfLogoPath = "assets/logo-live-productions.jpeg";
let equipmentPdfLogoDataUrlPromise = null;

function equipmentBinaryToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function equipmentAssetDataUrl(assetPath) {
  const response = await fetch(assetPath, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`No se pudo cargar ${assetPath}`);
  const contentType = response.headers?.get("Content-Type") || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${contentType};base64,${equipmentBinaryToBase64(bytes)}`;
}

async function equipmentPdfLogoSource() {
  if (!equipmentPdfLogoDataUrlPromise) {
    equipmentPdfLogoDataUrlPromise = equipmentAssetDataUrl(equipmentPdfLogoPath).catch(() => {
      try {
        return new URL(equipmentPdfLogoPath, window.location.origin).href;
      } catch {
        return equipmentPdfLogoPath;
      }
    });
  }
  return equipmentPdfLogoDataUrlPromise;
}

function equipmentHtmlWithPdfAssets(documentHtml, logoSource) {
  return String(documentHtml || "").replace(
    /src=["']assets\/logo-live-productions\.jpeg["']/g,
    `src="${escapeEquipmentHtml(logoSource)}"`
  );
}

async function writableEquipmentFolderHandle(directoryHandle) {
  if (!directoryHandle) return null;
  if (typeof directoryHandle.queryPermission === "function") {
    const currentPermission = await directoryHandle.queryPermission({ mode: "readwrite" });
    if (currentPermission === "granted") return directoryHandle;
  }
  if (typeof directoryHandle.requestPermission === "function") {
    const requestedPermission = await directoryHandle.requestPermission({ mode: "readwrite" });
    if (requestedPermission === "granted") return directoryHandle;
  }
  return null;
}

async function chooseEquipmentSaveFolder() {
  if (!window.showDirectoryPicker) return null;
  const directoryHandle = await window.showDirectoryPicker({
    id: equipmentDirectoryPickerId,
    mode: "readwrite",
    startIn: "documents"
  });
  const writableHandle = await writableEquipmentFolderHandle(directoryHandle);
  if (!writableHandle) throw new Error("No se otorgó permiso para escribir en la carpeta seleccionada.");
  return writableHandle;
}

async function writeEquipmentFileToFolder(directoryHandle, fileName, content) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

async function saveEquipmentPdfCopyToComputer(data, savedLabel, editablePayload, directoryHandle = null) {
  const fileName = cleanEquipmentFilePart(data?.fileName || "Cuadro de Equipo.pdf", "Cuadro de Equipo.pdf");
  const jsonFileName = cleanEquipmentJsonFilePart(data?.jsonFileName || equipmentEditableJsonFileName(fileName), equipmentEditableJsonFileName(fileName));
  const finalEditablePayload = {
    ...editablePayload,
    fileName,
    pdfFileName: fileName,
    jsonFileName,
    pdfUrl: data?.pdfUrl || "",
    jsonUrl: data?.jsonUrl || "",
    absolutePdfUrl: data?.absolutePdfUrl || "",
    absoluteJsonUrl: data?.absoluteJsonUrl || ""
  };
  const pdfUrl = data?.pdfUrl || data?.absolutePdfUrl;
  if (!pdfUrl) return `${savedLabel}: ${fileName} + editable ${jsonFileName}`;

  const pdfResponse = await fetch(equipmentPdfDownloadUrl(pdfUrl), { credentials: "same-origin" });
  if (!pdfResponse.ok) throw new Error("No se pudo descargar el PDF generado para guardarlo en esta Mac.");
  const pdfBlob = await pdfResponse.blob();

  if (!directoryHandle) {
    downloadEquipmentPdfFallback(fileName, pdfBlob, pdfUrl);
    downloadEquipmentJsonFallback(jsonFileName, finalEditablePayload);
    return `${savedLabel}: ${fileName}. Si no aparece selector de carpeta, revise Descargas o use Guardar en Archivos. También se descargó el editable ${jsonFileName}.`;
  }

  await writeEquipmentFileToFolder(directoryHandle, fileName, pdfBlob);
  await writeEquipmentFileToFolder(
    directoryHandle,
    jsonFileName,
    new Blob([JSON.stringify(finalEditablePayload, null, 2)], { type: "application/json;charset=utf-8" })
  );

  return `${savedLabel}: ${fileName} + editable ${jsonFileName} en ${directoryHandle.name || "carpeta seleccionada"}`;
}

async function saveEquipmentPdfOnlyCopyToComputer(data, savedLabel, directoryHandle = null) {
  const fileName = cleanEquipmentFilePart(data?.fileName || "Resumen de trasiego.pdf", "Resumen de trasiego.pdf");
  const pdfUrl = data?.pdfUrl || data?.absolutePdfUrl;
  if (!pdfUrl) throw new Error("El servidor no devolvió la dirección del PDF generado.");
  const pdfResponse = await fetch(equipmentPdfDownloadUrl(pdfUrl), { credentials: "same-origin" });
  if (!pdfResponse.ok) throw new Error("No se pudo descargar el PDF de trasiego generado.");
  const pdfBlob = await pdfResponse.blob();
  if (!directoryHandle) {
    downloadEquipmentPdfFallback(fileName, pdfBlob, pdfUrl);
    return `${savedLabel}: ${fileName}. Use Guardar en Archivos o revise las descargas del navegador.`;
  }
  await writeEquipmentFileToFolder(directoryHandle, fileName, pdfBlob);
  return `${savedLabel}: ${fileName} en ${directoryHandle.name || "carpeta seleccionada"}`;
}

async function saveEquipmentPdf(mode = "full") {
  const status = equipmentQuery("#equipmentSaveStatus");
  if (mode === "full" && !currentEquipmentService()) {
    if (status) status.textContent = "Seleccione un servicio antes de guardar.";
    return;
  }
  if (mode === "rent") {
    const validationMessage = equipmentRentReportValidationMessage();
    if (validationMessage) {
      if (status) status.textContent = validationMessage;
      return;
    }
  }
  if (mode === "transfer") {
    renderEquipmentTransferPdf();
    if (!equipmentConfiguredTransferRoutesWithItems().length) {
      if (status) status.textContent = "Configure al menos un trasiego con equipo compartido antes de generar el PDF.";
      return;
    }
  }
  try {
    const canChooseFolder = typeof window.showDirectoryPicker === "function";
    const pdfOnly = mode === "transfer";
    if (status) {
      status.textContent = canChooseFolder
        ? `Seleccione cualquier carpeta donde desea guardar ${pdfOnly ? "el PDF de trasiego" : "el PDF y el JSON editable"}.`
        : `El navegador descargará ${pdfOnly ? "el PDF" : "el PDF y el JSON"}; en Safari, Firefox o celular elija Guardar desde su sistema de descargas.`;
    }
    let directoryHandle = null;
    if (canChooseFolder) {
      try {
        directoryHandle = await chooseEquipmentSaveFolder();
      } catch (pickerError) {
        if (pickerError?.name === "AbortError") throw pickerError;
        if (status) status.textContent = "No se pudo abrir el selector de carpeta. Se guardará en el servidor y se usarán las descargas del navegador.";
      }
    }
    if (status) {
      status.textContent = mode === "rent"
        ? "Generando PDF de renta..."
        : mode === "transfer"
          ? "Generando PDF de trasiego..."
          : "Generando PDF para bodega...";
    }
    const documentSelector = mode === "rent"
      ? "#equipmentRentPdfDocument"
      : mode === "transfer"
        ? "#equipmentTransferPdfDocument"
        : "#equipmentPdfDocument";
    const title = mode === "rent"
      ? "Resumen de renta"
      : mode === "transfer"
        ? "Resumen de trasiego"
        : "Equipo y extras para bodega";
    const html = await equipmentPdfHtml(documentSelector, title);
    const requestedFileName = equipmentPdfFileName(mode);
    const editablePayload = pdfOnly ? null : equipmentEditablePayload(mode, { fileName: requestedFileName });
    const response = await fetch("/api/cuadros-equipo", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: requestedFileName,
        html,
        ...(pdfOnly ? { pdfOnly: true } : { editableData: editablePayload })
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar el cuadro de equipo.");
    if (data.warehouseInventory) {
      applyEquipmentWarehouseInventoryPayload(data.warehouseInventory);
      document.dispatchEvent(new CustomEvent("live:warehouse-server-updated", {
        detail: data.warehouseInventory
      }));
    }
    const savedLabel = mode === "rent"
      ? "PDF + JSON de renta guardado"
      : mode === "transfer"
        ? "PDF de trasiego guardado"
        : "PDF + JSON de bodega guardado";
    let statusMessage = pdfOnly
      ? `${savedLabel}: ${data.fileName} en ${data.folder}`
      : `${savedLabel}: ${data.fileName} + ${data.jsonFileName} en ${data.folder}`;
    try {
      statusMessage = pdfOnly
        ? await saveEquipmentPdfOnlyCopyToComputer(data, savedLabel, directoryHandle)
        : await saveEquipmentPdfCopyToComputer(data, savedLabel, equipmentEditablePayload(mode, data), directoryHandle);
    } catch (saveError) {
      const destinationLabel = directoryHandle ? "la carpeta seleccionada" : "las descargas del navegador";
      statusMessage = pdfOnly
        ? `${savedLabel}: ${data.fileName}. No se copió a ${destinationLabel}: ${saveError.message}`
        : `${savedLabel}: ${data.fileName} + ${data.jsonFileName}. No se copió a ${destinationLabel}: ${saveError.message}`;
    }
    if (mode === "full" && data.warehouseReceipt?.received) {
      const receiptAction = data.warehouseReceipt.updated ? "actualizado" : "recibido";
      statusMessage += ` Cuadro ${receiptAction} en Fuera / Eventos sin duplicar la salida.`;
      if (data.warehouseReceipt.unmappedQuantity > 0) {
        statusMessage += ` ${data.warehouseReceipt.unmappedQuantity} unidades quedaron identificadas como renta o no disponibles, sin restarlas de bodega.`;
      }
    }
    if (status) status.textContent = statusMessage;
    if (directoryHandle) window.open(data.pdfUrl, "_blank", "noopener");
  } catch (error) {
    if (status) {
      status.textContent = error?.name === "AbortError"
        ? "Selección de carpeta cancelada. No se guardó el PDF."
        : error.message || "No se pudo guardar el PDF.";
    }
  }
}

function equipmentSimpleEntriesToMap(entries = []) {
  if (!Array.isArray(entries)) return new Map();
  return new Map(entries.map(([key, value]) => [String(key || ""), String(value ?? "")]).filter(([key]) => key));
}

function importedEquipmentEvent(rawEvent, index = 0) {
  const serviceIds = equipmentNormalizeServiceIds(rawEvent?.serviceIds?.length ? rawEvent.serviceIds : rawEvent?.serviceId);
  return {
    ...cloneEquipmentEventForEditable({ ...rawEvent, serviceIds }, index),
    id: `event-${Date.now()}-${equipmentEventCounter++}`,
    warehouseDispatchId: rawEvent?.warehouseDispatchId || createEquipmentWarehouseDispatchId(),
    place: rawEvent?.place || "",
    name: rawEvent?.name || "",
    setupAt: equipmentEventSetupAt(rawEvent),
    phone: rawEvent?.phone || "",
    date: rawEvent?.date || "",
    equipmentOutAt: rawEvent?.equipmentOutAt || "",
    equipmentInAt: rawEvent?.equipmentInAt || "",
    responsible: rawEvent?.responsible || "",
    serviceIds,
    serviceId: serviceIds[0] || "",
    serviceName: rawEvent?.serviceName || equipmentServicesLabel(serviceIds.map(serviceWithEquipmentAudioOption).filter(Boolean), "Sin servicio")
  };
}

function importEquipmentEditablePayload(payload) {
  if (payload?.type !== "live-productions-equipment-requirement") {
    throw new Error("Este JSON no pertenece a Requerimiento de Equipo.");
  }
  const rawEvents = Array.isArray(payload.events) && payload.events.length
    ? payload.events
    : payload.event
      ? [payload.event]
      : [];
  const idMap = new Map();
  const events = rawEvents
    .map((rawEvent, index) => {
      const importedEvent = importedEquipmentEvent(rawEvent, index);
      if (rawEvent?.id) idMap.set(String(rawEvent.id), importedEvent.id);
      return importedEvent;
    })
    .filter((event) => event.serviceIds.length || event.sections.length);
  if (!events.length) throw new Error("El JSON no contiene una ventana editable válida.");
  const availableIds = new Set(events.map((event) => event.id));
  const mapRestoredTransferIds = (eventIds) => (Array.isArray(eventIds) ? eventIds : [])
    .map((eventId) => idMap.get(String(eventId)) || String(eventId || ""))
    .filter((eventId) => availableIds.has(eventId));
  let restoredTransferRoutes = Array.isArray(payload.summaryTransferRoutes)
    ? payload.summaryTransferRoutes.map((route) => {
        const originalEventIds = (Array.isArray(route?.eventIds) ? route.eventIds : []).map(String);
        const restoredEventIds = mapRestoredTransferIds(originalEventIds);
        const restoredLegSelections = {};
        originalEventIds.slice(0, -1).forEach((fromId, index) => {
          const toId = originalEventIds[index + 1];
          const restoredFromId = idMap.get(fromId) || fromId;
          const restoredToId = idMap.get(toId) || toId;
          const selections = normalizeEquipmentTransferLegSelections(route?.legSelections)?.[
            equipmentTransferLegKey(fromId, toId)
          ] || [];
          if (selections.length) {
            restoredLegSelections[equipmentTransferLegKey(restoredFromId, restoredToId)] = selections;
          }
        });
        return createEquipmentSummaryTransferRoute(
          restoredEventIds,
          String(route?.id || ""),
          restoredLegSelections
        );
      })
    : [];
  if (!restoredTransferRoutes.length) {
    const legacyTransferIds = mapRestoredTransferIds(payload.summaryTransferEventIds);
    if (legacyTransferIds.length) {
      restoredTransferRoutes = [createEquipmentSummaryTransferRoute(legacyTransferIds)];
    }
  }
  equipmentState.events = events;
  invalidateEquipmentRentalPreview();
  equipmentState.inventory = equipmentSimpleEntriesToMap(payload.inventory);
  equipmentState.observations = equipmentSimpleEntriesToMap(payload.observations);
  equipmentState.summaryTransferRoutes = restoredTransferRoutes;
  equipmentState.activeSummaryTransferRouteId = restoredTransferRoutes.some(
    (route) => route.id === payload.activeSummaryTransferRouteId
  )
    ? payload.activeSummaryTransferRouteId
    : restoredTransferRoutes[0]?.id || "";
  equipmentState.summaryTransferEnabled = false;
  cleanupEquipmentSummaryTransferRoutes(events);
  equipmentState.summaryTransferEnabled = Boolean(
    payload.summaryTransferEnabled && equipmentState.summaryTransferRoutes.some((route) => route.eventIds.length >= 2)
  );
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = equipmentState.summaryTransferEnabled ? "summary" : "review";
  const notesInput = equipmentQuery("#equipmentNotes");
  if (notesInput) notesInput.value = payload.notes || "";
  loadEquipmentEvent(sortEquipmentEventsByDate(events)[0].id);
  if (equipmentState.summaryTransferEnabled) {
    equipmentState.activeWindow = "summary";
    renderEquipmentModule();
  }
}

async function openEquipmentEditableFile(event) {
  const file = event?.target?.files?.[0];
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    importEquipmentEditablePayload(payload);
    if (status) status.textContent = `Editable cargado: ${file.name}`;
  } catch (error) {
    if (status) status.textContent = error.message || "No se pudo abrir el JSON editable.";
  } finally {
    if (event?.target) event.target.value = "";
  }
}

function initEquipmentModule() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  populateNativeEquipmentServiceSelect();
  serviceSelect.addEventListener("change", () => selectEquipmentService());
  document.querySelectorAll("[data-dj-audio-type]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.djAudioType = button.dataset.djAudioType || "qsc";
      renderEquipmentModule();
    });
  });
  [
    "#equipmentEventPlace",
    "#equipmentEventName",
    "#equipmentEventSetupAt",
    "#equipmentEventDate",
    "#equipmentEventInAt",
    "#equipmentEventResponsible",
    "#equipmentNotes"
  ].forEach((selector) => {
    equipmentQuery(selector)?.addEventListener("input", renderEquipmentModule);
  });
  equipmentQuery("#equipmentAddEventButton")?.addEventListener("click", addEquipmentEvent);
  equipmentQuery("#equipmentAddMainItemButton")?.addEventListener("click", addManualMainEquipmentItem);
  equipmentQuery("#equipmentManualMainDescription")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualMainEquipmentItem();
    }
  });
  equipmentQuery("#equipmentAddSubtitleButton")?.addEventListener("click", addManualEquipmentSubtitle);
  equipmentQuery("#equipmentManualSubtitle")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualEquipmentSubtitle();
    }
  });
  equipmentQuery("#equipmentAddExtraButton")?.addEventListener("click", addManualEquipmentExtra);
  equipmentQuery("#equipmentExtraDescription")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualEquipmentExtra();
    }
  });
  equipmentQuery("#equipmentSavePdfButton")?.addEventListener("click", () => saveEquipmentPdf("full"));
  equipmentQuery("#equipmentSaveRentPdfButton")?.addEventListener("click", previewEquipmentRentReport);
  equipmentQuery("#equipmentGenerateRentReportButton")?.addEventListener("click", previewEquipmentRentReport);
  equipmentQuery("#equipmentDownloadRentPdfButton")?.addEventListener("click", () => saveEquipmentPdf("rent"));
  equipmentQuery("#equipmentSaveTransferPdfButton")?.addEventListener("click", () => saveEquipmentPdf("transfer"));
  equipmentQuery("#equipmentEditServiceTemplateButton")?.addEventListener("click", openEquipmentCatalogEditor);
  equipmentQuery("#equipmentCatalogEditorCloseButton")?.addEventListener("click", closeEquipmentCatalogEditor);
  equipmentQuery("#equipmentCatalogCancelButton")?.addEventListener("click", closeEquipmentCatalogEditor);
  equipmentQuery("#equipmentCatalogAddCategoryButton")?.addEventListener("click", addEquipmentCatalogCategory);
  equipmentQuery("#equipmentCatalogSaveButton")?.addEventListener("click", saveEquipmentCatalogEditor);
  equipmentQuery("#equipmentCatalogEditor")?.addEventListener("click", (event) => {
    if (event.target.id === "equipmentCatalogEditor") closeEquipmentCatalogEditor();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && equipmentCatalogEditorState.open) closeEquipmentCatalogEditor();
  });
  equipmentQuery("#equipmentSummaryTransferButton")?.addEventListener("click", () => requestEquipmentTransferDecision("summary"));
  equipmentQuery("#equipmentSummarySearch")?.addEventListener("input", (event) => {
    equipmentState.summarySearchTerm = event.target.value || "";
    renderEquipmentModule();
  });
  equipmentQuery("#equipmentOpenEditableButton")?.addEventListener("click", () => equipmentQuery("#equipmentEditableFileInput")?.click());
  equipmentQuery("#equipmentEditableFileInput")?.addEventListener("change", openEquipmentEditableFile);
  equipmentQuery("#equipmentReviewWindowButton")?.addEventListener("click", () => switchEquipmentWindow("review"));
  equipmentQuery("#equipmentSummaryWindowButton")?.addEventListener("click", () => switchEquipmentWindow("summary"));
  equipmentQuery("#equipmentTransferWindowButton")?.addEventListener("click", () => requestEquipmentTransferDecision("preview"));
  equipmentQuery("#equipmentRemoveWindowButton")?.addEventListener("click", removeEquipmentActiveWindow);
  equipmentQuery("#equipmentClearAllButton")?.addEventListener("click", clearEquipmentWorkingArea);
  equipmentQuery("#equipmentUndoDeleteButton")?.addEventListener("click", restoreLastDeletedEquipment);
  equipmentQuery("#equipmentLogisticsCloseButton")?.addEventListener("click", closeEquipmentLogisticsDecision);
  equipmentQuery("#equipmentLogisticsCancelButton")?.addEventListener("click", closeEquipmentLogisticsDecision);
  equipmentQuery("#equipmentLogisticsRentButton")?.addEventListener("click", () => runEquipmentLogisticsDecision("rent"));
  equipmentQuery("#equipmentLogisticsTransferButton")?.addEventListener("click", () => runEquipmentLogisticsDecision("transfer"));
  equipmentQuery("#equipmentLogisticsDialog")?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEquipmentLogisticsDecision();
  });
  initEquipmentCatalogSync();
  renderEquipmentModule();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(renderEquipmentModule);
  } else {
    window.setTimeout(renderEquipmentModule, 0);
  }
  initEquipmentWarehouseInventorySync();
}

document.addEventListener("live:warehouse-inventory-updated", (event) => {
  if (applyEquipmentWarehouseInventoryPayload(event.detail)) renderEquipmentModule();
});
if (window.LIVE_WAREHOUSE_AVAILABILITY) {
  applyEquipmentWarehouseInventoryPayload(window.LIVE_WAREHOUSE_AVAILABILITY);
}
document.addEventListener("DOMContentLoaded", initEquipmentModule);
