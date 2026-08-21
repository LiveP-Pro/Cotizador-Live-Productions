const equipmentCatalog = window.requerimientoEquipoCatalog || { services: {}, groups: [] };
const equipmentServices = equipmentCatalog.services;
const equipmentServiceGroups = equipmentCatalog.groups;
const equipmentInventoryCatalog = window.requerimientoEquipoInventory || { categories: [] };
const equipmentInventorySourceCategories = Array.isArray(equipmentInventoryCatalog.categories)
  ? equipmentInventoryCatalog.categories
  : [];

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
  removedItemIds: new Set(),
  inventory: new Map(),
  observations: new Map(),
  deletedStack: [],
  selectedEventId: "",
  activeWindow: "review",
  servicePickerOpen: false,
  summarySearchTerm: "",
  summaryTransferEnabled: false,
  summaryTransferRoutes: [],
  activeSummaryTransferRouteId: ""
};

let equipmentEventCounter = 1;
let equipmentManualMainCounter = 1;
let equipmentManualSectionCounter = 1;
let equipmentExtraCounter = 1;
let equipmentTransferRouteCounter = 1;

function equipmentQuery(selector) {
  return document.querySelector(selector);
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
  return event?.date || equipmentDateKeyFromDateTime(event?.equipmentOutAt) || equipmentDateKeyFromDateTime(event?.equipmentInAt) || "";
}

function equipmentEventSortDateTime(event) {
  const dateKey = equipmentEventOperationalDateKey(event);
  return event?.equipmentOutAt || event?.equipmentInAt || (dateKey ? `${dateKey}T00:00` : "9999-12-31T23:59");
}

function equipmentEventTransferDateTime(event) {
  if (event?.equipmentOutAt) return formatEquipmentDateTime(event.equipmentOutAt);
  const dateKey = equipmentEventOperationalDateKey(event);
  return dateKey ? `${formatEquipmentDate(dateKey)} · Hora por definir` : "Fecha y hora por definir";
}

function equipmentDateOnlyFromDateTime(value) {
  const dateKey = equipmentDateKeyFromDateTime(value);
  return dateKey ? formatEquipmentDate(dateKey) : "Por definir";
}

function equipmentEventDateLabel(event) {
  return event?.date ? formatEquipmentDate(event.date) : "Por definir";
}

function equipmentEventOutDateLabel(event) {
  return event?.equipmentOutAt
    ? equipmentDateOnlyFromDateTime(event.equipmentOutAt)
    : event?.date
      ? formatEquipmentDate(event.date)
      : "Por definir";
}

function equipmentEventInterval(event) {
  const start = event?.equipmentOutAt || (event?.date ? `${event.date}T00:00` : "");
  const end = event?.equipmentInAt || (event?.date ? `${event.date}T23:59` : "");
  if (!start || !end) return null;
  return { start, end: end < start ? start : end };
}

function equipmentTransferDateKey(event) {
  return event?.date
    || equipmentDateKeyFromDateTime(event?.equipmentOutAt)
    || equipmentDateKeyFromDateTime(event?.equipmentInAt)
    || "";
}

function equipmentMaxConcurrentQuantityForEvents(row, events = []) {
  const points = [];
  let hasTimedEvent = false;
  let simpleTotal = 0;
  events.forEach((event) => {
    const quantity = Number(row.eventQuantities.get(event.id)) || 0;
    if (quantity <= 0) return;
    simpleTotal += quantity;
    const interval = equipmentEventInterval(event);
    if (!interval) return;
    hasTimedEvent = true;
    points.push({ at: interval.start, type: "start", quantity });
    points.push({ at: interval.end, type: "end", quantity });
  });
  if (!hasTimedEvent || !points.length) return simpleTotal;
  points.sort((first, second) => {
    const dateOrder = first.at.localeCompare(second.at);
    if (dateOrder) return dateOrder;
    if (first.type === second.type) return 0;
    return first.type === "end" ? -1 : 1;
  });
  let current = 0;
  let maximum = 0;
  points.forEach((point) => {
    if (point.type === "end") {
      current = Math.max(0, current - point.quantity);
      return;
    }
    current += point.quantity;
    maximum = Math.max(maximum, current);
  });
  return maximum || simpleTotal;
}

function equipmentMaxConcurrentQuantity(row, events = activeEquipmentEvents()) {
  const eventsByDate = new Map();
  let undatedTotal = 0;
  events.forEach((event) => {
    const quantity = Number(row.eventQuantities.get(event.id)) || 0;
    if (quantity <= 0) return;
    const dateKey = equipmentTransferDateKey(event);
    if (!dateKey) {
      undatedTotal += quantity;
      return;
    }
    if (!eventsByDate.has(dateKey)) eventsByDate.set(dateKey, []);
    eventsByDate.get(dateKey).push(event);
  });
  const datedMaximum = Math.max(
    0,
    ...[...eventsByDate.values()].map((dateEvents) => equipmentMaxConcurrentQuantityForEvents(row, dateEvents))
  );
  return undatedTotal + datedMaximum || Number(row.quantity) || 0;
}

function createEquipmentSummaryTransferRoute(eventIds = [], routeId = "") {
  return {
    id: routeId || `transfer-route-${Date.now()}-${equipmentTransferRouteCounter++}`,
    eventIds: [...new Set((Array.isArray(eventIds) ? eventIds : []).map(String).filter(Boolean))]
  };
}

function cleanupEquipmentSummaryTransferRoutes(events = activeEquipmentEvents()) {
  const availableIds = new Set(events.map((event) => event.id));
  const assignedIds = new Set();
  equipmentState.summaryTransferRoutes = (Array.isArray(equipmentState.summaryTransferRoutes)
    ? equipmentState.summaryTransferRoutes
    : [])
    .map((route) => {
      const eventIds = (Array.isArray(route?.eventIds) ? route.eventIds : [])
        .map(String)
        .filter((eventId) => {
          if (!availableIds.has(eventId) || assignedIds.has(eventId)) return false;
          assignedIds.add(eventId);
          return true;
        });
      return createEquipmentSummaryTransferRoute(eventIds, String(route?.id || ""));
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

function equipmentTransferAdjustedQuantity(row, events, transferRoutes) {
  const routedEventIds = new Set();
  let adjustedQuantity = 0;
  let appliedRouteCount = 0;
  transferRoutes.forEach(({ events: routeEvents }) => {
    routeEvents.forEach((event) => routedEventIds.add(event.id));
    const originalRouteQuantity = routeEvents.reduce(
      (total, event) => total + (Number(row.eventQuantities.get(event.id)) || 0),
      0
    );
    const rowTransferEvents = routeEvents.filter(
      (event) => (Number(row.eventQuantities.get(event.id)) || 0) > 0
    );
    if (rowTransferEvents.length < 2) {
      adjustedQuantity += originalRouteQuantity;
      return;
    }
    const routeQuantity = equipmentMaxConcurrentQuantity(row, rowTransferEvents);
    adjustedQuantity += routeQuantity;
    if (routeQuantity < originalRouteQuantity) appliedRouteCount += 1;
  });
  events.forEach((event) => {
    if (routedEventIds.has(event.id)) return;
    adjustedQuantity += Number(row.eventQuantities.get(event.id)) || 0;
  });
  return { quantity: adjustedQuantity, appliedRouteCount };
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
  return (section.items || [])
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
  return {
    id: "event-draft",
    place: equipmentQuery("#equipmentEventPlace")?.value.trim() || "Lugar por definir",
    name: equipmentQuery("#equipmentEventName")?.value.trim() || "Evento por definir",
    phone: equipmentQuery("#equipmentEventPhone")?.value.trim() || "Por definir",
    date: equipmentQuery("#equipmentEventDate")?.value || "",
    equipmentOutAt: equipmentQuery("#equipmentEventOutAt")?.value || "",
    equipmentInAt: equipmentQuery("#equipmentEventInAt")?.value || "",
    responsible: equipmentQuery("#equipmentEventResponsible")?.value.trim() || "Por definir"
  };
}

function selectedEquipmentEvent() {
  return equipmentState.events.find((item) => item.id === equipmentState.selectedEventId) || null;
}

function activeEquipmentEvents() {
  return equipmentState.events.length ? equipmentState.events : [currentEquipmentEventDraft()];
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
  equipmentState.removedItemIds = new Set(event.removedItemIds || []);
  updateNativeEquipmentServiceSelect();
}

function populateEquipmentEventFields(event) {
  const placeInput = equipmentQuery("#equipmentEventPlace");
  const nameInput = equipmentQuery("#equipmentEventName");
  const plannerInput = equipmentQuery("#equipmentEventPhone");
  const dateInput = equipmentQuery("#equipmentEventDate");
  const outAtInput = equipmentQuery("#equipmentEventOutAt");
  const inAtInput = equipmentQuery("#equipmentEventInAt");
  const responsibleInput = equipmentQuery("#equipmentEventResponsible");
  if (placeInput) placeInput.value = event?.place || "";
  if (nameInput) nameInput.value = event?.name || "";
  if (plannerInput) plannerInput.value = event?.phone || "";
  if (dateInput) dateInput.value = event?.date || "";
  if (outAtInput) outAtInput.value = event?.equipmentOutAt || "";
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
  const groups = equipmentEventsByOperationalDate(events);
  const missingDateCount = events.filter((event) => !equipmentEventOperationalDateKey(event)).length;
  if (groups.size > 1) {
    return {
      type: "warning",
      text: "Hay ventanas en fechas distintas. Si el mismo equipo se moverá entre lugares, active Trasegar Equipo y marque solo esos eventos; los no marcados se suman normal."
    };
  }
  if (missingDateCount) {
    return {
      type: "warning",
      text: "Complete la fecha de cada ventana para confirmar si el resumen y el trasego aplican."
    };
  }
  if (events.length > 1 && groups.size === 1) {
    const [dateKey] = groups.keys();
    return {
      type: "ok",
      text: `Resumen combinado para eventos del mismo día: ${formatEquipmentDate(dateKey)}.`
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

  equipmentInventorySourceCategories.forEach((category) => {
    const group = ensureGroup(category?.title, true);
    (Array.isArray(category?.items) ? category.items : []).forEach((item) => {
      const description = String(item?.description || "").trim();
      const matchKey = normalizeEquipmentKey(description);
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
      if (!inventoryRowsByEquipmentKey.has(matchKey)) inventoryRowsByEquipmentKey.set(matchKey, []);
      inventoryRowsByEquipmentKey.get(matchKey).push(row);
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
        const inventoryRows = inventoryRowsByEquipmentKey.get(key) || [];
        if (inventoryRows.length) {
          let remainingQuantity = perEventQuantity;
          inventoryRows.forEach((inventoryRow) => {
            if (remainingQuantity <= 0) return;
            const currentEventQuantity = Number(inventoryRow.eventQuantities.get(event.id)) || 0;
            const sourceCapacity = Math.max(0, equipmentInventoryNumber(inventoryValueFor(inventoryRow)));
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
    const adjustment = transferRoutes.length
      ? equipmentTransferAdjustedQuantity(row, events, transferRoutes)
      : { quantity: originalQuantity, appliedRouteCount: 0 };
    row.originalQuantity = originalQuantity;
    row.quantity = Math.min(originalQuantity, adjustment.quantity);
    row.transferApplied = row.quantity < originalQuantity;
    row.transferRouteCount = row.transferApplied ? adjustment.appliedRouteCount : 0;
  });
  return groups.flatMap((group) => group.rows.length || group.alwaysVisible ? [{
    type: "category",
    key: group.key,
    title: group.title
  }, ...group.rows] : []);
}

function equipmentFilterSummaryRows(rows, searchTerm = equipmentState.summarySearchTerm) {
  const query = normalizeEquipmentKey(searchTerm);
  if (!query) return rows;
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
    const haystack = normalizeEquipmentKey(`${row.description || ""} ${row.categoryTitle || ""}`);
    if (haystack.includes(query)) currentMatches.push(row);
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
    .map(({ events: routeEvents }, routeIndex) => {
      const routeLabel = routeEvents
        .map((event) => equipmentSummaryColumnName(event, events.indexOf(event)))
        .join(" -> ");
      return `Trasiego ${routeIndex + 1}: ${routeLabel}`;
    })
    .join(" | ");
  return {
    type: "ok",
    text: `${labels}. Los eventos fuera de estas rutas se suman normalmente para renta.`
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
  const assignedIds = new Set(routes.flatMap(({ route }) => route.eventIds));
  const availableEvents = events.filter((event) => !assignedIds.has(event.id));
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
              <small>${escapeEquipmentHtml(equipmentEventTransferDateTime(event))}</small>
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
    route.eventIds.push(eventId);
    renderEquipmentModule();
  });
  host.querySelector("[data-equipment-transfer-new-route]")?.addEventListener("click", () => {
    const route = createEquipmentSummaryTransferRoute();
    equipmentState.summaryTransferRoutes.push(route);
    equipmentState.activeSummaryTransferRouteId = route.id;
    renderEquipmentModule();
  });
  host.querySelector("[data-equipment-transfer-delete-route]")?.addEventListener("click", () => {
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
    if (route) route.eventIds = [];
    renderEquipmentModule();
  });
}

function tableForEquipmentSections(sections, compact = false) {
  if (!sections.length) {
    return `<p class="equipment-empty">Seleccione un servicio para cargar el equipo.</p>`;
  }
  const rows = sections
    .map((section) => {
      const items = section.items
        .map((rawItem) => {
          const item = normalizeEquipmentItem(rawItem);
          if (!compact && item.editable && item.id) {
            return `
              <tr>
                <td class="equipment-qty">
                  <input class="equipment-line-quantity" data-equipment-item-id="${escapeEquipmentHtml(item.id)}" data-equipment-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(item.quantity)}" />
                </td>
                <td>
                  <input class="equipment-line-description" data-equipment-item-id="${escapeEquipmentHtml(item.id)}" data-equipment-field="description" type="text" value="${escapeEquipmentHtml(item.description)}" />
                </td>
                <td class="equipment-row-action">
                  <button class="equipment-row-remove" type="button" data-remove-equipment-item="${escapeEquipmentHtml(item.id)}" aria-label="Eliminar línea">X</button>
                </td>
              </tr>`;
          }
          return `
            <tr>
              <td class="equipment-qty">${escapeEquipmentHtml(item.quantity)}</td>
              <td>${escapeEquipmentHtml(item.description)}</td>
              ${compact ? "" : `<td class="equipment-row-action"></td>`}
            </tr>`;
        })
        .join("");
      const categoryAction = !compact && section.manualSection
        ? `<td class="equipment-row-action"><button class="equipment-row-remove" type="button" data-remove-equipment-section="${escapeEquipmentHtml(section.id)}" aria-label="Eliminar subtítulo">X</button></td>`
        : "";
      return `
        <tr class="equipment-category-row">
          <td colspan="${compact || section.manualSection ? "2" : "3"}">${escapeEquipmentHtml(section.title)}</td>
          ${categoryAction}
        </tr>
        ${items}`;
    })
    .join("");

  return `
    <table class="equipment-base-table equipment-service-table${compact ? " equipment-table-compact" : ""}">
      <thead>
        <tr>
          <th>Cantidad</th>
          <th>Equipo</th>
          ${compact ? "" : "<th>Acción</th>"}
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
  host.innerHTML = equipmentState.events
    .map((event, index) => {
      const activeClass = event.id === equipmentState.selectedEventId ? " is-active" : "";
      const lineCount = equipmentEventLineCount(event);
      const serviceName = event.serviceName || "Sin servicio";
      const planner = event.phone || "Planner por definir";
      const date = formatEquipmentDate(event.date);
      const cardTitle = equipmentEventCardTitle(event, index);
      const eventName = event.name && event.name !== "Evento por definir" ? event.name : "";
      const eventNameLine = eventName ? `<span>Evento: ${escapeEquipmentHtml(eventName)}</span>` : "";
      const logisticsLine = event.equipmentOutAt || event.equipmentInAt
        ? `<span>Salida: ${escapeEquipmentHtml(equipmentEventTransferDateTime(event))} · Ingreso: ${escapeEquipmentHtml(equipmentEventReturnDateTime(event))}</span>`
        : "";
      return `
        <article class="equipment-event-card${activeClass}">
          <button class="equipment-event-open" type="button" data-open-event="${escapeEquipmentHtml(event.id)}">
            <strong>${escapeEquipmentHtml(`${index + 1}. ${cardTitle}`)}</strong>
            <small>${escapeEquipmentHtml(serviceName)}</small>
            ${eventNameLine}
            <span>${escapeEquipmentHtml(date)} · ${escapeEquipmentHtml(planner)}</span>
            ${logisticsLine}
            <span>${escapeEquipmentHtml(lineCount)} líneas de equipo</span>
          </button>
          <div class="equipment-event-card-actions">
            <button class="equipment-event-pdf-button" type="button" data-save-event="${escapeEquipmentHtml(event.id)}" aria-label="Guardar PDF de ${escapeEquipmentHtml(cardTitle)}">PDF</button>
            <button class="equipment-event-remove-button" type="button" data-remove-event="${escapeEquipmentHtml(event.id)}" aria-label="Eliminar ventana">X</button>
          </div>
        </article>`;
    })
    .join("");
  host.querySelectorAll("[data-open-event]").forEach((button) => {
    button.addEventListener("click", () => loadEquipmentEvent(button.dataset.openEvent));
  });
  host.querySelectorAll("[data-save-event]").forEach((button) => {
    button.addEventListener("click", () => {
      loadEquipmentEvent(button.dataset.saveEvent);
      saveEquipmentPdf("full");
    });
  });
  host.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", () => removeEquipmentEventById(button.dataset.removeEvent));
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
    id: `event-${Date.now()}-${equipmentEventCounter++}`
  };
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

function bindEquipmentSectionInputs() {
  const host = equipmentQuery("#equipmentMainTable");
  if (!host) return;
  host.querySelectorAll("[data-equipment-item-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateEquipmentItem(input.dataset.equipmentItemId, input.dataset.equipmentField, event.target.value);
      refreshEquipmentSummaryAndPreview();
    });
    input.addEventListener("change", renderEquipmentModule);
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
    .map(
      (extra) => `
        <article class="equipment-extra-line equipment-extra-line-editable">
          <label>
            Cantidad
            <input data-manual-extra-id="${escapeEquipmentHtml(extra.id)}" data-equipment-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(extra.quantity)}" />
          </label>
          <label>
            Equipo extra
            <input data-manual-extra-id="${escapeEquipmentHtml(extra.id)}" data-equipment-field="description" type="text" value="${escapeEquipmentHtml(extra.description)}" />
          </label>
          <button type="button" data-remove-extra="${escapeEquipmentHtml(extra.id)}" aria-label="Eliminar extra">X</button>
        </article>`
    )
    .join("");
  host.querySelectorAll("[data-manual-extra-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateEquipmentItem(input.dataset.manualExtraId, input.dataset.equipmentField, event.target.value);
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
const equipmentInventoryAliases = {};

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

function equipmentInventoryRowKey(item) {
  const sourceRow = Number(item?.sourceRow) || "sin-fila";
  const descriptionKey = equipmentInventoryLookupKey(item?.description) || "equipo";
  return `inventario-${sourceRow}-${descriptionKey}`;
}

const equipmentInventoryItemsByLookupKey = new Map();
equipmentInventorySourceCategories.forEach((category) => {
  (Array.isArray(category?.items) ? category.items : []).forEach((item) => {
    const rowKey = equipmentInventoryRowKey(item);
    const lookupKey = equipmentInventoryLookupKey(item?.description);
    const sourceValue = equipmentInventorySourceValue(item);
    equipmentDefaultInventory.set(rowKey, sourceValue);
    if (!lookupKey) return;
    if (!equipmentInventoryItemsByLookupKey.has(lookupKey)) equipmentInventoryItemsByLookupKey.set(lookupKey, []);
    equipmentInventoryItemsByLookupKey.get(lookupKey).push(item);
  });
});
equipmentInventoryItemsByLookupKey.forEach((items, lookupKey) => {
  if (items.length === 1) equipmentDefaultInventoryLookup.set(lookupKey, equipmentInventorySourceValue(items[0]));
});

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
  if (equipmentState.inventory.has(row.key)) return equipmentState.inventory.get(row.key);
  return defaultInventoryValueFor(row);
}

function equipmentTransferPlanData() {
  const events = [...equipmentState.events];
  const groups = equipmentEventsByOperationalDate(events);
  const missingDateEvents = events.filter((event) => !equipmentEventOperationalDateKey(event));
  const routes = [];
  const configuredRoutes = equipmentState.summaryTransferEnabled
    ? equipmentSummaryTransferRoutesWithEvents(events, true)
    : [];
  if (configuredRoutes.length) {
    configuredRoutes.forEach(({ events: routeEvents, index: routeIndex }) => {
      for (let index = 0; index < routeEvents.length - 1; index += 1) {
        routes.push({
          routeIndex,
          legIndex: index,
          dateKey: equipmentEventOperationalDateKey(routeEvents[index + 1]),
          from: routeEvents[index],
          to: routeEvents[index + 1],
          configured: true
        });
      }
    });
  } else {
    groups.forEach((groupEvents, dateKey) => {
      const sortedEvents = [...groupEvents].sort((first, second) => equipmentEventSortDateTime(first).localeCompare(equipmentEventSortDateTime(second)));
      for (let index = 0; index < sortedEvents.length - 1; index += 1) {
        routes.push({
          routeIndex: 0,
          legIndex: index,
          dateKey,
          from: sortedEvents[index],
          to: sortedEvents[index + 1],
          configured: false
        });
      }
    });
  }
  return {
    events,
    groups,
    routes,
    configuredRoutes,
    missingDateEvents,
    hasDifferentDates: groups.size > 1
  };
}

function renderEquipmentTransferPanel() {
  const host = equipmentQuery("#equipmentTransferPlan");
  if (!host) return;
  const plan = equipmentTransferPlanData();
  if (plan.events.length < 2) {
    host.innerHTML = `<p class="equipment-empty">Agregue al menos dos ventanas para calcular el trasego de equipo.</p>`;
    return;
  }

  const messages = [];
  if (plan.configuredRoutes.length) {
    messages.push(`${plan.configuredRoutes.length} trasiego(s) configurado(s). Cada ruta puede continuar por varios eventos.`);
  } else if (plan.hasDifferentDates) {
    messages.push("Para eventos en fechas distintas, configure una ruta dentro de Resumen de Equipo con Continuar trasiego. Puede crear rutas adicionales con Trasiego múltiple.");
  }
  if (plan.missingDateEvents.length) {
    messages.push("Hay ventanas sin fecha operativa; complete fecha, salida o ingreso de equipo para evaluar el trasego.");
  }
  if (!plan.routes.length) {
    messages.push("No hay ventanas compartiendo el mismo día en esta vista; para fechas consecutivas use el selector del resumen.");
  }

  const messageHtml = messages
    .map((message) => `<p class="equipment-transfer-note">${escapeEquipmentHtml(message)}</p>`)
    .join("");
  const routeHtml = plan.routes
    .map(({ routeIndex, legIndex, dateKey, from, to, configured }) => `
      <article class="equipment-transfer-card">
        <div>
          <span>${escapeEquipmentHtml(configured ? `Trasiego ${routeIndex + 1} · tramo ${legIndex + 1}` : "Trasiego sugerido")}</span>
          <strong>${escapeEquipmentHtml(from.place || "Lugar por definir")}</strong>
        </div>
        <div>
          <span>Trasegar hacia</span>
          <strong>${escapeEquipmentHtml(to.place || "Lugar por definir")}</strong>
        </div>
        <div>
          <span>Fecha y hora de destino</span>
          <strong>${escapeEquipmentHtml(equipmentEventTransferDateTime(to))}</strong>
        </div>
        <small>Salida desde ${escapeEquipmentHtml(from.place || "evento anterior")} después del ingreso ${escapeEquipmentHtml(equipmentEventReturnDateTime(from))}${dateKey ? ` · destino ${escapeEquipmentHtml(formatEquipmentDate(dateKey))}` : ""}</small>
      </article>`)
    .join("");

  host.innerHTML = `${messageHtml}${routeHtml || ""}`;
}

function tableForEquipmentInventory(rows, editable = true) {
  if (!rows.length) {
    return `<p class="equipment-empty">El resumen aparecerá al seleccionar un servicio.</p>`;
  }
  const events = activeEquipmentEvents();
  const eventDateHeaders = events
    .map((event) => `<th class="equipment-event-column equipment-date-column"><span>Fecha del evento</span><strong>${escapeEquipmentHtml(equipmentEventDateLabel(event))}</strong></th>`)
    .join("");
  const eventOutHeaders = events
    .map((event) => `<th class="equipment-event-column equipment-date-column"><span>Fecha salida equipo</span><strong>${escapeEquipmentHtml(equipmentEventOutDateLabel(event))}</strong></th>`)
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
      const inventoryNumber = equipmentInventoryNumber(inventory);
      const required = Number(row.quantity) || 0;
      const shortage = inventoryNumber - required;
      const needsRent = shortage < 0;
      const zeroInventory = equipmentInventoryIsExplicitZero(inventory);
      const shortageClass = needsRent ? "equipment-shortage-cell" : "equipment-rest-ok";
      const transferApplied = Boolean(row.transferApplied);
      const multipleTransfers = (Number(row.transferRouteCount) || 0) > 1;
      const transferLabel = multipleTransfers ? "TRASIEGO MÚLTIPLE" : "TRASIEGO";
      const actionLabel = needsRent ? (transferApplied ? `RENTA + ${transferLabel}` : "RENTA") : transferApplied ? transferLabel : "";
      const actionClass = needsRent ? "equipment-action-rent" : transferApplied ? "equipment-action-transfer" : "equipment-action-empty";
      const observation = equipmentState.observations.get(row.key) || "";
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
                ? `<input class="equipment-inventory-input" type="text" inputmode="decimal" value="${escapeEquipmentHtml(inventory)}" aria-label="Inventario físico de ${escapeEquipmentHtml(row.description)}" />`
                : escapeEquipmentHtml(inventory)
            }
          </td>
          <td class="equipment-qty ${shortageClass}">${escapeEquipmentHtml(shortage)}</td>
          <td class="${actionClass}">${escapeEquipmentHtml(actionLabel)}</td>
          <td>
            ${
              editable
                ? `<input class="equipment-observation-input" type="text" value="${escapeEquipmentHtml(observation)}" placeholder="Observaciones" />`
                : escapeEquipmentHtml(observation)
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
          <th class="equipment-shortage-column" rowspan="3">FALTANTE DE EQUIPO PARA RENTA</th>
          <th class="equipment-action-column" rowspan="3">ACCION</th>
          <th class="equipment-observation-column" rowspan="3">OBSERVACIONES</th>
        </tr>
        <tr class="equipment-summary-date-row">
          ${eventOutHeaders}
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

function equipmentRentalRows() {
  const events = activeEquipmentEvents();
  return equipmentRowsSummary()
    .filter((row) => row.type !== "category")
    .map((row) => {
      const inventory = inventoryValueFor(row);
      const inventoryNumber = equipmentInventoryNumber(inventory);
      const missing = Math.max(0, row.quantity - inventoryNumber);
      const eventDetails = events
        .map((event) => {
          const quantity = Number(row.eventQuantities.get(event.id)) || 0;
          return quantity > 0 ? `${eventColumnName(event)}: ${quantity}` : "";
        })
        .filter(Boolean)
        .join(" / ");
      return {
        ...row,
        inventory,
        missing,
        eventDetails,
        observation: equipmentState.observations.get(row.key) || ""
      };
    })
    .filter((row) => row.missing > 0);
}

function tableForEquipmentRentalReport(rows) {
  if (!rows.length) {
    return `<p class="equipment-empty">No hay equipo para renta con el inventario actual.</p>`;
  }
  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeEquipmentHtml(row.description)}</td>
          <td>${escapeEquipmentHtml(row.eventDetails)}</td>
          <td class="equipment-qty">${escapeEquipmentHtml(row.quantity)}</td>
          <td class="equipment-qty">${escapeEquipmentHtml(row.inventory)}</td>
          <td class="equipment-rent-needed">${escapeEquipmentHtml(row.missing)}</td>
          <td>${escapeEquipmentHtml(row.observation)}</td>
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
          <th>Inventario</th>
          <th>Equipo para renta</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function bindEquipmentInventoryInputs() {
  equipmentQuery("#equipmentInventoryTable")
    ?.querySelectorAll("tr[data-equipment-key]")
    .forEach((row) => {
      const key = row.dataset.equipmentKey;
      const inventoryInput = row.querySelector(".equipment-inventory-input");
      inventoryInput?.addEventListener("input", (event) => {
        equipmentState.inventory.set(key, event.target.value);
        row.classList.toggle("equipment-inventory-zero-row", equipmentInventoryIsExplicitZero(event.target.value));
        renderEquipmentPdfPreview();
      });
      inventoryInput?.addEventListener("change", (event) => {
        equipmentState.inventory.set(key, event.target.value);
        renderEquipmentModule();
      });
      row.querySelector(".equipment-observation-input")?.addEventListener("change", (event) => {
        equipmentState.observations.set(key, event.target.value);
        renderEquipmentPdfPreview();
      });
    });
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
  equipmentState.removedItemIds.clear();
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  equipmentState.servicePickerOpen = false;
  updateNativeEquipmentServiceSelect();
  populateEquipmentEventFields(null);
  const notesInput = equipmentQuery("#equipmentNotes");
  if (notesInput) notesInput.value = "";
}

function saveCurrentEquipmentWindow() {
  const status = equipmentQuery("#equipmentSaveStatus");
  const draft = currentEquipmentEventDraft();
  if (!currentEquipmentService()) {
    if (status) status.textContent = "Seleccione el tipo de servicio antes de guardar la ventana.";
    return;
  }
  if (!draft.place || draft.place === "Lugar por definir") {
    if (status) status.textContent = "Escriba el lugar del evento antes de guardar la ventana.";
    return;
  }
  if (!draft.name || draft.name === "Evento por definir") {
    if (status) status.textContent = "Escriba el nombre del evento antes de guardar la ventana.";
    return;
  }
  const event = selectedEquipmentEvent();
  if (!event) {
    addEquipmentEvent();
    return;
  }
  updateEquipmentEventFromCurrent(event);
  if (status) status.textContent = `Ventana actualizada: ${event.place || event.name}`;
  renderEquipmentModule();
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
  const phone = eventSummaryText(events, "phone");
  const date = eventSummaryText(events, "date");
  const rentPlace = eventSummaryText(summaryEvents, "place", "Lugar por definir");
  const rentEventName = eventSummaryText(summaryEvents, "name");
  const rentPhone = eventSummaryText(summaryEvents, "phone");
  const rentDate = eventSummaryText(summaryEvents, "date");
  const notes = equipmentQuery("#equipmentNotes")?.value.trim() || "";
  const rentalRows = equipmentRentalRows();

  const title = service?.name || "Cuadro de equipo";
  const rentTitle = "Resumen de renta";
  if (equipmentQuery("#equipmentPdfTitle")) equipmentQuery("#equipmentPdfTitle").textContent = title;
  if (equipmentQuery("#equipmentPdfPlace")) equipmentQuery("#equipmentPdfPlace").textContent = place;
  if (equipmentQuery("#equipmentPdfEvent")) equipmentQuery("#equipmentPdfEvent").textContent = eventName;
  if (equipmentQuery("#equipmentPdfPhone")) equipmentQuery("#equipmentPdfPhone").textContent = phone;
  if (equipmentQuery("#equipmentPdfDate")) equipmentQuery("#equipmentPdfDate").textContent = date;
  if (equipmentQuery("#equipmentPdfOutAt")) equipmentQuery("#equipmentPdfOutAt").textContent = eventSummaryDateTimeText(events, "equipmentOutAt");
  if (equipmentQuery("#equipmentPdfInAt")) equipmentQuery("#equipmentPdfInAt").textContent = eventSummaryDateTimeText(events, "equipmentInAt");

  const notesEl = equipmentQuery("#equipmentPdfNotes");
  if (notesEl) {
    notesEl.textContent = notes;
    notesEl.classList.toggle("is-hidden", !notes);
  }

  if (equipmentQuery("#equipmentPdfMainTable")) {
    equipmentQuery("#equipmentPdfMainTable").innerHTML = tableForEquipmentSections(sections, true);
  }
  if (equipmentQuery("#equipmentRentPdfTitle")) equipmentQuery("#equipmentRentPdfTitle").textContent = rentTitle;
  if (equipmentQuery("#equipmentRentPdfPlace")) equipmentQuery("#equipmentRentPdfPlace").textContent = rentPlace;
  if (equipmentQuery("#equipmentRentPdfEvents")) equipmentQuery("#equipmentRentPdfEvents").textContent = rentEventName;
  if (equipmentQuery("#equipmentRentPdfPhone")) equipmentQuery("#equipmentRentPdfPhone").textContent = rentPhone;
  if (equipmentQuery("#equipmentRentPdfDate")) equipmentQuery("#equipmentRentPdfDate").textContent = rentDate;
  if (equipmentQuery("#equipmentRentPdfOutAt")) equipmentQuery("#equipmentRentPdfOutAt").textContent = eventSummaryDateTimeText(summaryEvents, "equipmentOutAt");
  if (equipmentQuery("#equipmentRentPdfInAt")) equipmentQuery("#equipmentRentPdfInAt").textContent = eventSummaryDateTimeText(summaryEvents, "equipmentInAt");
  const rentNotesEl = equipmentQuery("#equipmentRentPdfNotes");
  if (rentNotesEl) {
    rentNotesEl.textContent = notes;
    rentNotesEl.classList.toggle("is-hidden", !notes);
  }
  if (equipmentQuery("#equipmentRentPdfTable")) {
    equipmentQuery("#equipmentRentPdfTable").innerHTML = tableForEquipmentRentalReport(rentalRows);
  }
}

function renderEquipmentModule() {
  syncSelectedEquipmentService();
  const service = currentEquipmentService();
  const workspace = equipmentQuery("#equipmentWorkspace");
  const shouldShowWorkspace = Boolean(service) || equipmentState.events.length > 0 || ["summary", "transfer"].includes(equipmentState.activeWindow);
  if (workspace) workspace.classList.toggle("is-hidden", !shouldShowWorkspace);
  if (equipmentQuery("#equipmentServiceName")) equipmentQuery("#equipmentServiceName").textContent = service?.name || "";
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
  renderEquipmentTransferPanel();
  renderEquipmentPdfPreview();
  renderEquipmentWindowState();
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
  const sourceHtml = equipmentQuery(documentSelector)?.outerHTML || "";
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
  const service = currentEquipmentService();
  const events = equipmentPdfEvents();
  const eventName = cleanEquipmentFilePart(events.map(equipmentEventNameForFile).join(" - ") || "Evento por definir", "Evento por definir");
  const plannerName = cleanEquipmentFilePart(events.map((event) => event.phone).join(" - ") || "Planner por definir", "Planner por definir");
  const serviceName = cleanEquipmentFilePart(service?.name || "Extras", "Extras");
  const eventDates = cleanEquipmentFilePart(events.map((event) => formatEquipmentDateForFile(event.date)).join(" - "), "Fecha por definir");
  return `${eventName} - ${plannerName} - ${serviceName} - ${eventDates}.pdf`;
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
    place: event?.place || "",
    name: event?.name || "",
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
    removedItemIds: Array.isArray(event?.removedItemIds) ? [...event.removedItemIds] : [],
    sections: cloneEquipmentSnapshotSections(event?.sections || [])
  };
}

function currentEquipmentEditableEvent() {
  return cloneEquipmentEventForEditable({
    ...currentEquipmentEventDraft(),
    ...captureEquipmentEventSnapshot(),
    id: equipmentState.selectedEventId || "event-draft"
  });
}

function equipmentEditablePayload(mode = "full", savedData = {}) {
  const currentEvent = currentEquipmentEditableEvent();
  const events = mode === "rent"
    ? (equipmentState.events.length ? equipmentState.events.map(cloneEquipmentEventForEditable) : [currentEvent])
    : [currentEvent];
  return {
    type: "live-productions-equipment-requirement",
    version: 2,
    mode,
    savedAt: new Date().toISOString(),
    fileName: savedData.fileName || equipmentPdfFileName(mode),
    pdfFileName: savedData.fileName || equipmentPdfFileName(mode),
    jsonFileName: savedData.jsonFileName || equipmentEditableJsonFileName(savedData.fileName || equipmentPdfFileName(mode)),
    pdfUrl: savedData.pdfUrl || "",
    jsonUrl: savedData.jsonUrl || "",
    event: currentEvent,
    events,
    inventory: [...equipmentState.inventory.entries()],
    observations: [...equipmentState.observations.entries()],
    summaryTransferEnabled: equipmentState.summaryTransferEnabled,
    summaryTransferRoutes: equipmentState.summaryTransferRoutes.map((route) => ({
      id: route.id,
      eventIds: [...route.eventIds]
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

async function saveEquipmentPdf(mode = "full") {
  const status = equipmentQuery("#equipmentSaveStatus");
  if (mode === "full" && !currentEquipmentService()) {
    if (status) status.textContent = "Seleccione un servicio antes de guardar.";
    return;
  }
  if (mode === "rent" && !equipmentRowsSummary().some((row) => row.type !== "category")) {
    if (status) status.textContent = "Agregue al menos una ventana con equipo antes de guardar el resumen.";
    return;
  }
  if (mode === "rent" && !equipmentRentalRows().length) {
    if (status) status.textContent = "No hay equipo para rentar con el inventario actual.";
    return;
  }
  try {
    const canChooseFolder = typeof window.showDirectoryPicker === "function";
    if (status) {
      status.textContent = canChooseFolder
        ? "Seleccione cualquier carpeta donde desea guardar el PDF y el JSON editable."
        : "El navegador descargará el PDF y el JSON; en Safari, Firefox o celular elija Guardar desde su sistema de descargas.";
    }
    const directoryHandle = canChooseFolder ? await chooseEquipmentSaveFolder() : null;
    if (status) status.textContent = mode === "rent" ? "Generando PDF de renta..." : "Generando PDF para bodega...";
    const documentSelector = mode === "rent" ? "#equipmentRentPdfDocument" : "#equipmentPdfDocument";
    const title = mode === "rent" ? "Resumen de renta" : "Equipo y extras para bodega";
    const html = await equipmentPdfHtml(documentSelector, title);
    const requestedFileName = equipmentPdfFileName(mode);
    const editablePayload = equipmentEditablePayload(mode, { fileName: requestedFileName });
    const response = await fetch("/api/cuadros-equipo", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: requestedFileName,
        html,
        editableData: editablePayload
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar el cuadro de equipo.");
    const savedLabel = mode === "rent" ? "PDF + JSON de renta guardado" : "PDF + JSON de bodega guardado";
    let statusMessage = `${savedLabel}: ${data.fileName} + ${data.jsonFileName} en ${data.folder}`;
    try {
      statusMessage = await saveEquipmentPdfCopyToComputer(data, savedLabel, equipmentEditablePayload(mode, data), directoryHandle);
    } catch (saveError) {
      const destinationLabel = directoryHandle ? "la carpeta seleccionada" : "las descargas del navegador";
      statusMessage = `${savedLabel}: ${data.fileName} + ${data.jsonFileName}. No se copió a ${destinationLabel}: ${saveError.message}`;
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
    place: rawEvent?.place || "",
    name: rawEvent?.name || "",
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
    ? payload.summaryTransferRoutes.map((route) => createEquipmentSummaryTransferRoute(
        mapRestoredTransferIds(route?.eventIds),
        String(route?.id || "")
      ))
    : [];
  if (!restoredTransferRoutes.length) {
    const legacyTransferIds = mapRestoredTransferIds(payload.summaryTransferEventIds);
    if (legacyTransferIds.length) {
      restoredTransferRoutes = [createEquipmentSummaryTransferRoute(legacyTransferIds)];
    }
  }
  equipmentState.events = events;
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
  loadEquipmentEvent(events[0].id);
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
    "#equipmentEventPhone",
    "#equipmentEventDate",
    "#equipmentEventOutAt",
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
  equipmentQuery("#equipmentSaveRentPdfButton")?.addEventListener("click", () => saveEquipmentPdf("rent"));
  equipmentQuery("#equipmentGenerateRentReportButton")?.addEventListener("click", () => saveEquipmentPdf("rent"));
  equipmentQuery("#equipmentSummaryTransferButton")?.addEventListener("click", () => {
    equipmentState.summaryTransferEnabled = !equipmentState.summaryTransferEnabled;
    if (equipmentState.summaryTransferEnabled) {
      equipmentState.activeWindow = "summary";
      cleanupEquipmentSummaryTransferRoutes(activeEquipmentEvents());
    }
    renderEquipmentModule();
  });
  equipmentQuery("#equipmentSummarySearch")?.addEventListener("input", (event) => {
    equipmentState.summarySearchTerm = event.target.value || "";
    renderEquipmentModule();
  });
  equipmentQuery("#equipmentOpenEditableButton")?.addEventListener("click", () => equipmentQuery("#equipmentEditableFileInput")?.click());
  equipmentQuery("#equipmentEditableFileInput")?.addEventListener("change", openEquipmentEditableFile);
  equipmentQuery("#equipmentReviewWindowButton")?.addEventListener("click", () => switchEquipmentWindow("review"));
  equipmentQuery("#equipmentSummaryWindowButton")?.addEventListener("click", () => switchEquipmentWindow("summary"));
  equipmentQuery("#equipmentTransferWindowButton")?.addEventListener("click", () => switchEquipmentWindow("transfer"));
  equipmentQuery("#equipmentAddWindowButton")?.addEventListener("click", saveCurrentEquipmentWindow);
  equipmentQuery("#equipmentRemoveWindowButton")?.addEventListener("click", removeEquipmentActiveWindow);
  equipmentQuery("#equipmentClearAllButton")?.addEventListener("click", clearEquipmentWorkingArea);
  equipmentQuery("#equipmentUndoDeleteButton")?.addEventListener("click", restoreLastDeletedEquipment);
  renderEquipmentModule();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(renderEquipmentModule);
  } else {
    window.setTimeout(renderEquipmentModule, 0);
  }
}

document.addEventListener("DOMContentLoaded", initEquipmentModule);
