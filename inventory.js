(() => {
  const STORAGE_KEY = "liveWarehouseInventoryStateV3";
  const PREVIOUS_STORAGE_KEY = "liveWarehouseInventoryStateV2";
  const LEGACY_STORAGE_KEY = "liveWarehouseInventoryStateV1";
  const API_PATH = "/api/inventario-bodega";
  const MODULE_PATH = "/warehouse-module.html?v=20260901-03";
  const movementLabels = {
    salida: "Salida de bodega",
    ingreso_evento: "Ingreso de evento",
    taller: "Salida a taller",
    devolucion_taller: "Devolución de taller",
    renta: "Renta de equipo",
    devolucion_renta: "Devolución de renta",
    ajuste: "Ajuste de conteo",
    perdido: "Equipo perdido",
    recuperado: "Equipo recuperado"
  };

  let state = null;
  let activeWindow = "inventory";
  let saveTimer = null;
  let persistenceMode = "local";
  let dialogContext = null;
  const signaturePads = {};
  const elements = {};

  function todayInputValue() {
    return new Date().toISOString().slice(0, 10);
  }

  function dateTimeLocalValue(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function displayDateTime(movement) {
    const value = movement?.dateTime || movement?.date || "";
    return formatWarehouseDateTime(value);
  }

  function formatWarehouseDateTime(value) {
    const clean = normalizeText(value).replace(" ", "T");
    if (!clean) return "Sin fecha";
    const [datePart, timePart = ""] = clean.split("T");
    const [year, month, day] = datePart.split("-");
    const dateLabel = year && month && day ? `${day}/${month}/${year}` : datePart;
    const timeLabel = timePart ? ` ${timePart.slice(0, 5)}` : "";
    return `${dateLabel}${timeLabel}`;
  }

  function uid(prefix) {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, Math.round(number));
  }

  function normalizeText(value) {
    return String(value || "").trim();
  }

  function warehouseCanonicalKey(value) {
    return normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[“”"']/g, "")
      .replace(/\bno\.\s*/g, "no ")
      .replace(/[.,;:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const warehouseCatalogItems = (Array.isArray(window.requerimientoEquipoInventory?.categories)
    ? window.requerimientoEquipoInventory.categories
    : [])
    .flatMap((category) => (Array.isArray(category?.items) ? category.items : []));
  const warehouseCatalogKeys = new Set(
    warehouseCatalogItems.map((item) => warehouseCanonicalKey(item?.description)).filter(Boolean)
  );

  function inventorySourceKey(item, index) {
    const savedKey = warehouseCanonicalKey(item?.sourceKey);
    if (savedKey) return savedKey;
    const nameKey = warehouseCanonicalKey(item?.name);
    if (warehouseCatalogKeys.has(nameKey)) return nameKey;
    const idMatch = /^item-(\d+)$/.exec(normalizeText(item?.id));
    const sourceIndex = idMatch ? Number(idMatch[1]) - 1 : index;
    const sourceItem = warehouseCatalogItems[sourceIndex];
    return warehouseCanonicalKey(sourceItem?.description) || nameKey;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function signatureData(id) {
    const pad = signaturePads[id];
    if (!pad || pad.empty) return "";
    return pad.canvas.toDataURL("image/png");
  }

  function clearSignature(id) {
    const pad = signaturePads[id];
    if (!pad) return;
    pad.context.clearRect(0, 0, pad.canvas.width, pad.canvas.height);
    pad.empty = true;
  }

  function initSignaturePad(id, canvas) {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#111111";
    signaturePads[id] = { canvas, context, drawing: false, empty: true };

    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      return {
        x: ((source.clientX - rect.left) / rect.width) * canvas.width,
        y: ((source.clientY - rect.top) / rect.height) * canvas.height
      };
    };
    const start = (event) => {
      event.preventDefault();
      const pad = signaturePads[id];
      const current = point(event);
      pad.drawing = true;
      pad.context.beginPath();
      pad.context.moveTo(current.x, current.y);
    };
    const move = (event) => {
      const pad = signaturePads[id];
      if (!pad?.drawing) return;
      event.preventDefault();
      const current = point(event);
      pad.context.lineTo(current.x, current.y);
      pad.context.stroke();
      pad.empty = false;
    };
    const end = () => {
      const pad = signaturePads[id];
      if (pad) pad.drawing = false;
    };

    canvas.addEventListener("pointerdown", start);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointerleave", end);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", end);
  }

  function categoryLabel(value) {
    return normalizeText(value || "SIN CATEGORIA").toUpperCase();
  }

  function normalizeItem(item, index = 0) {
    const now = new Date().toISOString();
    return {
      id: normalizeText(item?.id) || `item-${String(index + 1).padStart(4, "0")}`,
      category: categoryLabel(item?.category),
      name: normalizeText(item?.name) || "Equipo sin nombre",
      sourceKey: inventorySourceKey(item, index),
      quantity: normalizeNumber(item?.quantity),
      notes: normalizeText(item?.notes),
      archived: Boolean(item?.archived),
      createdAt: item?.createdAt || now,
      updatedAt: item?.updatedAt || now
    };
  }

  function normalizeAttachment(attachment) {
    if (!attachment?.dataUrl && !attachment?.url) return null;
    return {
      name: normalizeText(attachment.name) || "archivo",
      type: normalizeText(attachment.type) || "application/octet-stream",
      dataUrl: attachment.dataUrl || "",
      url: normalizeText(attachment.url)
    };
  }

  function attachmentHref(attachment) {
    return attachment?.dataUrl || attachment?.url || "";
  }

  function normalizeMovement(movement, index = 0) {
    let type = movement?.type;
    if (type === "danado") type = "taller";
    if (!movementLabels[type]) type = "salida";
    return {
      id: normalizeText(movement?.id) || `movement-${String(index + 1).padStart(4, "0")}`,
      type,
      itemId: normalizeText(movement?.itemId),
      itemName: normalizeText(movement?.itemName),
      quantity: normalizeNumber(movement?.quantity),
      previousQuantity: Number.isFinite(Number(movement?.previousQuantity))
        ? normalizeNumber(movement.previousQuantity)
        : null,
      date: movement?.date || todayInputValue(),
      responsible: normalizeText(movement?.responsible),
      reference: normalizeText(movement?.reference),
      repair: normalizeText(movement?.repair),
      sparePart: normalizeText(movement?.sparePart),
      description: normalizeText(movement?.description),
      rentalDays: Math.max(1, normalizeNumber(movement?.rentalDays) || 1),
      notes: normalizeText(movement?.notes),
      batchId: normalizeText(movement?.batchId),
      relatedMovementId: normalizeText(movement?.relatedMovementId),
      attachment: normalizeAttachment(movement?.attachment),
      warehouseSignature: normalizeText(movement?.warehouseSignature),
      workshopSignature: normalizeText(movement?.workshopSignature),
      sourceType: normalizeText(movement?.sourceType),
      sourceDocumentId: normalizeText(movement?.sourceDocumentId),
      sourceEventId: normalizeText(movement?.sourceEventId),
      sourceEventName: normalizeText(movement?.sourceEventName),
      sourceEventPlace: normalizeText(movement?.sourceEventPlace),
      sourcePlanner: normalizeText(movement?.sourcePlanner),
      sourceEventDate: normalizeText(movement?.sourceEventDate),
      sourceExpectedReturnAt: normalizeText(movement?.sourceExpectedReturnAt),
      sourcePdfUrl: normalizeText(movement?.sourcePdfUrl),
      sourceJsonUrl: normalizeText(movement?.sourceJsonUrl),
      sourceFileName: normalizeText(movement?.sourceFileName),
      sourceJsonFileName: normalizeText(movement?.sourceJsonFileName),
      sourceCategory: normalizeText(movement?.sourceCategory),
      sourceRequestedName: normalizeText(movement?.sourceRequestedName),
      sourceLineKey: normalizeText(movement?.sourceLineKey),
      sourceUnmatched: Boolean(movement?.sourceUnmatched),
      dateTime: normalizeText(movement?.dateTime) || `${movement?.date || todayInputValue()}T00:00`,
      createdAt: movement?.createdAt || new Date().toISOString()
    };
  }

  function normalizeRentalDraftLine(line, index = 0) {
    return {
      id: normalizeText(line?.id) || `rent-line-${String(index + 1).padStart(4, "0")}`,
      itemId: normalizeText(line?.itemId),
      itemName: normalizeText(line?.itemName),
      description: normalizeText(line?.description || line?.itemName),
      quantity: normalizeNumber(line?.quantity) || 1
    };
  }

  function normalizeWorkshopDraftLine(line, index = 0) {
    return {
      id: normalizeText(line?.id) || `workshop-line-${String(index + 1).padStart(4, "0")}`,
      itemId: normalizeText(line?.itemId),
      itemName: normalizeText(line?.itemName),
      quantity: normalizeNumber(line?.quantity) || 1
    };
  }

  function seedState() {
    const seed = Array.isArray(window.LIVE_WAREHOUSE_INITIAL_INVENTORY)
      ? window.LIVE_WAREHOUSE_INITIAL_INVENTORY
      : [];
    const now = new Date().toISOString();
    return {
      version: 3,
      source: window.LIVE_WAREHOUSE_INITIAL_INVENTORY_META?.source || "EQUIPO-DE-AUDIO.xlsx / hoja INVENTARIO",
      createdAt: now,
      updatedAt: now,
      title: window.LIVE_WAREHOUSE_INITIAL_INVENTORY_META?.title || "INVENTARIO",
      subtitles: [...(window.LIVE_WAREHOUSE_INITIAL_INVENTORY_META?.subtitles || [])].map(categoryLabel),
      items: seed.map(normalizeItem),
      movements: [],
      rentalDraft: [],
      workshopDraft: []
    };
  }

  function normalizeState(raw) {
    const base = raw?.state || raw || {};
    const seeded = seedState();
    const items = Array.isArray(base.items) ? base.items : seeded.items;
    const movements = Array.isArray(base.movements) ? base.movements : [];
    const rentalDraft = Array.isArray(base.rentalDraft) ? base.rentalDraft : [];
    const workshopDraft = Array.isArray(base.workshopDraft) ? base.workshopDraft : [];
    const subtitles = Array.isArray(base.subtitles) && base.subtitles.length ? base.subtitles : seeded.subtitles;
    return {
      version: 3,
      source: base.source || seeded.source,
      createdAt: base.createdAt || new Date().toISOString(),
      updatedAt: base.updatedAt || new Date().toISOString(),
      title: base.title || seeded.title,
      subtitles: [...new Set(subtitles.map(categoryLabel))],
      items: items.map(normalizeItem),
      movements: movements.map(normalizeMovement),
      rentalDraft: rentalDraft.map(normalizeRentalDraftLine),
      workshopDraft: workshopDraft.map(normalizeWorkshopDraftLine)
    };
  }

  function isHttpPage() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  }

  async function ensureWarehouseMarkup() {
    if (document.querySelector("#warehouseModule")) return true;
    const host = document.querySelector("#warehouseModuleHost");
    if (!host) return false;

    try {
      const response = await fetch(MODULE_PATH, { credentials: "same-origin" });
      if (!response.ok) throw new Error("No se pudo cargar el módulo");
      host.innerHTML = await response.text();
      return Boolean(document.querySelector("#warehouseModule"));
    } catch {
      host.innerHTML = '<p class="warehouse-module-loading warehouse-module-error">No se pudo cargar Inventario Bodega. Actualice la página.</p>';
      return false;
    }
  }

  function waitForAuthenticatedApp() {
    const siteApp = document.querySelector("#siteApp");
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

  function saveLocalState() {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The inventory remains usable during the session if storage is blocked.
    }
  }

  function readLocalState() {
    try {
      const stored =
        window.localStorage?.getItem(STORAGE_KEY) ||
        window.localStorage?.getItem(PREVIOUS_STORAGE_KEY) ||
        window.localStorage?.getItem(LEGACY_STORAGE_KEY);
      return stored ? normalizeState(JSON.parse(stored)) : null;
    } catch {
      return null;
    }
  }

  async function loadServerState() {
    if (!isHttpPage()) return null;
    const response = await fetch(API_PATH, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Inventario no disponible en servidor");
    const data = await response.json();
    if (!data?.state?.items?.length) return null;
    persistenceMode = "server";
    return normalizeState(data.state);
  }

  async function persistServerState() {
    if (!isHttpPage()) return false;
    const response = await fetch(API_PATH, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state })
    });
    if (!response.ok) throw new Error("No se pudo guardar en servidor");
    persistenceMode = "server";
    return true;
  }

  function setStatus(message, tone = "neutral") {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.tone = tone;
  }

  async function loadState() {
    try {
      const serverState = await loadServerState();
      if (serverState) {
        state = serverState;
        saveLocalState();
        setStatus("Inventario cargado desde servidor.", "success");
        return;
      }
    } catch {
      persistenceMode = "local";
    }

    state = readLocalState() || seedState();
    saveLocalState();
    try {
      await persistServerState();
      setStatus("Inventario guardado en servidor.", "success");
    } catch {
      persistenceMode = "local";
      setStatus("Inventario guardado en este navegador. Use Exportar respaldo para copia externa.", "neutral");
    }
  }

  async function saveState(options = {}) {
    if (!state) return;
    state.updatedAt = new Date().toISOString();
    saveLocalState();
    try {
      await persistServerState();
      if (!options.silent) setStatus("Cambios guardados en servidor.", "success");
    } catch {
      persistenceMode = "local";
      if (!options.silent) setStatus("Cambios guardados en este navegador.", "warning");
    }
  }

  function scheduleSave() {
    saveLocalState();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveState({ silent: true }), 500);
  }

  function activeItems() {
    return state.items.filter((item) => !item.archived);
  }

  function itemById(id) {
    return state.items.find((item) => item.id === id) || null;
  }

  function statsForItem(item) {
    const stats = { out: 0, workshop: 0, rented: 0, lost: 0 };
    state.movements.forEach((movement) => {
      if (movement.itemId !== item.id) return;
      const quantity = normalizeNumber(movement.quantity);
      if (movement.type === "salida") stats.out += quantity;
      if (movement.type === "ingreso_evento") stats.out -= quantity;
      if (movement.type === "taller") stats.workshop += quantity;
      if (movement.type === "devolucion_taller") stats.workshop -= quantity;
      if (movement.type === "renta") stats.rented += quantity;
      if (movement.type === "devolucion_renta") stats.rented -= quantity;
      if (movement.type === "perdido") stats.lost += quantity;
      if (movement.type === "recuperado") stats.lost -= quantity;
    });
    stats.out = Math.max(0, stats.out);
    stats.workshop = Math.max(0, stats.workshop);
    stats.rented = Math.max(0, stats.rented);
    stats.lost = Math.max(0, stats.lost);
    stats.reserved = stats.out + stats.workshop + stats.rented + stats.lost;
    stats.physical = Math.max(0, normalizeNumber(item.quantity) - stats.reserved);
    stats.deficit = Math.max(0, stats.reserved - normalizeNumber(item.quantity));
    return stats;
  }

  function movementChronologyKey(movement) {
    return `${movement?.dateTime || movement?.date || ""}|${movement?.createdAt || ""}|${movement?.id || ""}`;
  }

  function movementLifecycleRecords(outgoingType, returnType) {
    const outgoingMovements = state.movements
      .filter((movement) => movement.type === outgoingType)
      .slice()
      .sort((first, second) => movementChronologyKey(first).localeCompare(movementChronologyKey(second)));
    const records = outgoingMovements.map((movement) => ({
      movement,
      initialQuantity: normalizeNumber(movement.quantity),
      returnedQuantity: 0,
      remainingQuantity: normalizeNumber(movement.quantity),
      returns: []
    }));
    const recordsById = new Map(records.map((record) => [record.movement.id, record]));
    state.movements
      .filter((movement) => movement.type === returnType)
      .slice()
      .sort((first, second) => movementChronologyKey(first).localeCompare(movementChronologyKey(second)))
      .forEach((movement) => {
        let quantityToApply = normalizeNumber(movement.quantity);
        const target = recordsById.get(movement.relatedMovementId);
        const returnKey = movementChronologyKey(movement);
        const candidates = [
          ...(target && target.movement.itemId === movement.itemId ? [target] : []),
          ...records.filter(
            (record) =>
              record !== target &&
              record.movement.itemId === movement.itemId &&
              (
                (!record.movement.sourceDocumentId && !movement.sourceDocumentId) ||
                record.movement.sourceDocumentId === movement.sourceDocumentId
              ) &&
              record.remainingQuantity > 0 &&
              movementChronologyKey(record.movement) <= returnKey
          )
        ];
        candidates.forEach((record) => {
          if (quantityToApply <= 0 || record.remainingQuantity <= 0) return;
          const applied = Math.min(quantityToApply, record.remainingQuantity);
          record.remainingQuantity -= applied;
          record.returnedQuantity += applied;
          record.returns.push({ movement, quantity: applied });
          quantityToApply -= applied;
        });
      });

    return records.sort((first, second) =>
      movementChronologyKey(second.movement).localeCompare(movementChronologyKey(first.movement))
    );
  }

  function lifecycleRecordsByItem(records, activeOnly = false) {
    const groups = new Map();
    records.forEach((record) => {
      if (activeOnly && record.remainingQuantity <= 0) return;
      const itemId = record.movement.itemId;
      if (!groups.has(itemId)) groups.set(itemId, []);
      groups.get(itemId).push(record);
    });
    return groups;
  }

  function inventoryLifecycle() {
    const workshop = movementLifecycleRecords("taller", "devolucion_taller");
    const rental = movementLifecycleRecords("renta", "devolucion_renta");
    return {
      workshop,
      rental,
      activeWorkshopByItem: lifecycleRecordsByItem(workshop, true),
      activeRentalByItem: lifecycleRecordsByItem(rental, true)
    };
  }

  function availabilityObservationData(item, lifecycle) {
    const rows = [];
    const workshop = lifecycle.activeWorkshopByItem.get(item.id) || [];
    const rental = lifecycle.activeRentalByItem.get(item.id) || [];
    if (workshop.length) {
      rows.push({
        type: "workshop",
        label: `En taller: ${workshop.reduce((sum, record) => sum + record.remainingQuantity, 0)}`,
        dates: [...new Set(workshop.map((record) => displayDateTime(record.movement)))],
        detail: [...new Set(workshop.map((record) => record.movement.repair).filter(Boolean))].join(" / ")
      });
    }
    if (rental.length) {
      rows.push({
        type: "rental",
        label: `En renta: ${rental.reduce((sum, record) => sum + record.remainingQuantity, 0)}`,
        dates: [...new Set(rental.map((record) => displayDateTime(record.movement)))],
        detail: [...new Set(rental.map((record) => record.movement.reference).filter(Boolean))].join(" / ")
      });
    }
    return rows;
  }

  function availabilityObservationText(item, lifecycle) {
    return availabilityObservationData(item, lifecycle)
      .map((row) => {
        const departure = row.dates.length ? `Salió de bodega: ${row.dates.join(", ")}.` : "";
        const detailLabel = row.type === "workshop" ? "Falla" : "Cliente";
        const detail = row.detail ? `${detailLabel}: ${row.detail}.` : "";
        return `${row.label}. ${departure} ${detail}`.replace(/\s+/g, " ").trim();
      })
      .join(" ");
  }

  function availabilityObservationHtml(item, lifecycle) {
    const observations = availabilityObservationData(item, lifecycle);
    if (!observations.length) {
      return '<span class="warehouse-observation-empty">Sin equipo en renta o taller.</span>';
    }
    return `
      <div class="warehouse-availability-notes">
        ${observations
          .map(
            (row) => `
              <div class="warehouse-availability-note" data-type="${escapeHtml(row.type)}">
                <strong>${escapeHtml(row.label)}</strong>
                <span>Salió de bodega: ${escapeHtml(row.dates.join(", "))}</span>
                ${row.detail ? `<span>${escapeHtml(row.type === "workshop" ? "Falla" : "Cliente")}: ${escapeHtml(row.detail)}</span>` : ""}
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }

  function inventoryTotals() {
    return activeItems().reduce(
      (totals, item) => {
        const stats = statsForItem(item);
        totals.items += 1;
        totals.registered += normalizeNumber(item.quantity);
        totals.physical += stats.physical;
        totals.out += stats.out;
        totals.workshop += stats.workshop;
        totals.rented += stats.rented;
        totals.lost += stats.lost;
        if (normalizeNumber(item.quantity) === 0 && item.notes.includes("Sin cantidad")) {
          totals.needsQuantity += 1;
        }
        return totals;
      },
      { items: 0, registered: 0, physical: 0, out: 0, workshop: 0, rented: 0, lost: 0, needsQuantity: 0 }
    );
  }

  function renderSummary() {
    const totals = inventoryTotals();
    const cards = [
      ["Equipos", totals.items],
      ["Inventario disponible", totals.physical],
      ["Cantidad registrada", totals.registered],
      ["Fuera eventos", totals.out],
      ["Taller", totals.workshop],
      ["En renta", totals.rented],
      ["Diferencias", totals.lost],
      ["Sin cantidad libro", totals.needsQuantity]
    ];
    elements.summary.innerHTML = cards
      .map(
        ([label, value]) => `
          <article class="warehouse-summary-card">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </article>
        `
      )
      .join("");
  }

  function categories() {
    return [...new Set([...(state.subtitles || []), ...activeItems().map((item) => categoryLabel(item.category))])];
  }

  function renderCategoryFilter() {
    const current = elements.categoryFilter.value || "all";
    elements.categoryFilter.innerHTML = [
      '<option value="all">Todas</option>',
      ...categories().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join("");
    elements.categoryFilter.value = [...elements.categoryFilter.options].some((option) => option.value === current)
      ? current
      : "all";
  }

  function itemMatchesStatus(item, statusFilter) {
    if (statusFilter === "all") return true;
    const stats = statsForItem(item);
    if (statusFilter === "available") return stats.physical > 0;
    if (statusFilter === "out") return stats.out > 0;
    if (statusFilter === "workshop") return stats.workshop > 0;
    if (statusFilter === "rented") return stats.rented > 0;
    if (statusFilter === "lost") return stats.lost > 0;
    if (statusFilter === "needs-quantity") {
      return normalizeNumber(item.quantity) === 0 && item.notes.includes("Sin cantidad");
    }
    return true;
  }

  function filteredItems() {
    const term = normalizeText(elements.search.value).toLowerCase();
    const category = elements.categoryFilter.value || "all";
    const statusFilter = elements.statusFilter.value || "all";
    return activeItems()
      .filter((item) => (category === "all" ? true : categoryLabel(item.category) === category))
      .filter((item) => itemMatchesStatus(item, statusFilter))
      .filter((item) => {
        if (!term) return true;
        return `${item.name} ${item.category} ${item.notes}`.toLowerCase().includes(term);
      });
  }

  function latestMovementFor(itemId, types) {
    return state.movements
      .filter((movement) => movement.itemId === itemId && types.includes(movement.type))
      .slice()
      .sort((a, b) => `${b.dateTime || b.date} ${b.createdAt}`.localeCompare(`${a.dateTime || a.date} ${a.createdAt}`))[0];
  }

  function renderInventoryTable() {
    const rows = filteredItems();
    if (!rows.length) {
      elements.inventoryTable.innerHTML = '<p class="warehouse-empty">No hay equipo con esos filtros.</p>';
      return;
    }

    let lastCategory = "";
    const lifecycle = inventoryLifecycle();
    const body = rows
      .map((item) => {
        const stats = statsForItem(item);
        const categoryRow =
          lastCategory !== categoryLabel(item.category)
            ? `<tr class="equipment-category-row"><td colspan="7">${escapeHtml(categoryLabel(item.category))}</td></tr>`
            : "";
        lastCategory = categoryLabel(item.category);
        const latestOut = latestMovementFor(item.id, ["salida"]);
        const latestWorkshop = latestMovementFor(item.id, ["taller"]);
        const latestRental = latestMovementFor(item.id, ["renta"]);
        return `
          ${categoryRow}
          <tr data-warehouse-item="${escapeHtml(item.id)}">
            <td>
              <textarea class="warehouse-inline-input warehouse-name-input" data-field="name" rows="2" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</textarea>
            </td>
            <td>
              <input class="warehouse-inline-input warehouse-qty-input" data-field="totalReal" type="number" min="0" step="1" value="${escapeHtml(item.quantity)}" aria-label="Cantidad registrada de ${escapeHtml(item.name)}" />
            </td>
            <td>
              <output class="warehouse-available-value${stats.reserved > 0 ? " is-reduced" : ""}" aria-label="Inventario disponible de ${escapeHtml(item.name)}">${escapeHtml(stats.physical)}</output>
            </td>
            <td>
              <button class="warehouse-cell-action" type="button" data-action="events" data-item-id="${escapeHtml(item.id)}">
                <strong>${escapeHtml(stats.out)}</strong>
                <span>${escapeHtml(latestOut?.reference || "Salida / entrada")}</span>
              </button>
            </td>
            <td>
              <button class="warehouse-cell-action" type="button" data-action="workshop" data-item-id="${escapeHtml(item.id)}">
                <strong>${escapeHtml(stats.workshop)}</strong>
                <span>${escapeHtml(latestWorkshop?.repair || "Bitácora")}</span>
              </button>
            </td>
            <td>
              <button class="warehouse-cell-action" type="button" data-action="rental" data-item-id="${escapeHtml(item.id)}">
                <strong>${escapeHtml(stats.rented)}</strong>
                <span>${escapeHtml(latestRental?.reference || "Agregar a PDF")}</span>
              </button>
            </td>
            <td>${availabilityObservationHtml(item, lifecycle)}</td>
          </tr>
        `;
      })
      .join("");

    elements.inventoryTable.innerHTML = `
      <table class="equipment-base-table warehouse-inventory-table">
        <thead>
          <tr>
            <th>Descripción</th>
            <th>Cantidad</th>
            <th>Inventario disponible</th>
            <th>Fuera</th>
            <th>Taller</th>
            <th>Renta</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function movementItemName(movement) {
    return movement.itemName || itemById(movement.itemId)?.name || "Equipo eliminado";
  }

  function activeMovements(types) {
    return state.movements.filter((movement) => types.includes(movement.type));
  }

  function eventKey(movement) {
    return movement.sourceDocumentId ? `cuadro:${movement.sourceDocumentId}` : movement.reference || "Sin evento";
  }

  function renderEventsBoard() {
    const movements = activeMovements(["salida", "ingreso_evento"]);
    if (!movements.length) {
      elements.eventsBoard.innerHTML = '<p class="warehouse-empty">Aún no hay salidas o ingresos por evento.</p>';
      return;
    }

    const groups = new Map();
    movements.forEach((movement) => {
      const key = eventKey(movement);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(movement);
    });
    const lifecycleByGroup = new Map();
    movementLifecycleRecords("salida", "ingreso_evento").forEach((record) => {
      const key = eventKey(record.movement);
      if (!lifecycleByGroup.has(key)) lifecycleByGroup.set(key, []);
      lifecycleByGroup.get(key).push(record);
    });

    elements.eventsBoard.innerHTML = [...groups.entries()]
      .sort((a, b) => (b[1][0].dateTime || b[1][0].date).localeCompare(a[1][0].dateTime || a[1][0].date))
      .map(([groupKey, entries]) => {
        const sourceEntry = entries.find((entry) => entry.sourceType === "requerimiento-equipo") || null;
        const name = sourceEntry?.sourceEventName || sourceEntry?.reference || groupKey;
        const eventRecords = lifecycleByGroup.get(groupKey) || [];
        const outgoing = entries.filter((entry) => entry.type === "salida").reduce((sum, entry) => sum + entry.quantity, 0);
        const incoming = entries.filter((entry) => entry.type === "ingreso_evento").reduce((sum, entry) => sum + entry.quantity, 0);
        const pending = eventRecords.reduce((sum, record) => sum + record.remainingQuantity, 0);
        const sourcePdfUrl = sourceEntry?.sourcePdfUrl || attachmentHref(sourceEntry?.attachment);
        const entryLines = entries
          .slice()
          .sort((a, b) => `${b.dateTime || b.date} ${b.createdAt}`.localeCompare(`${a.dateTime || a.date} ${a.createdAt}`))
          .map(
            (entry) => `
              <div>
                <span>${escapeHtml(displayDateTime(entry))}</span>
                <strong>${escapeHtml(movementLabels[entry.type])}</strong>
                <p>${escapeHtml(entry.quantity)} x ${escapeHtml(movementItemName(entry))}</p>
                ${entry.responsible ? `<small>Responsable: ${escapeHtml(entry.responsible)}</small>` : ""}
                ${entry.sourceUnmatched ? '<small class="warehouse-unmapped-note">No descontado: requiere renta o no estaba disponible.</small>' : ""}
                ${entry.attachment ? `<a href="${escapeHtml(attachmentHref(entry.attachment))}" download="${escapeHtml(entry.attachment.name)}">Ver archivo: ${escapeHtml(entry.attachment.name)}</a>` : ""}
              </div>
            `
          )
          .join("");
        return `
          <article class="warehouse-board-card">
            <header>
              <div>
                ${sourceEntry ? '<span class="warehouse-source-pill">Cuadro recibido</span>' : ""}
                <strong>${escapeHtml(name)}</strong>
                <span>Salió: ${escapeHtml(outgoing)} · Entró: ${escapeHtml(incoming)} · Pendiente: ${escapeHtml(pending)}</span>
              </div>
              <div class="warehouse-board-actions">
                ${sourcePdfUrl ? `<a class="warehouse-row-button" href="${escapeHtml(sourcePdfUrl)}" target="_blank" rel="noopener">Ver cuadro</a>` : ""}
                ${pending > 0 ? `<button class="warehouse-row-button" type="button" data-return-event="${escapeHtml(groupKey)}">Registrar devolución</button>` : ""}
                <button class="warehouse-row-button" type="button" data-print-event="${escapeHtml(groupKey)}">PDF evento</button>
              </div>
            </header>
            ${sourceEntry ? `
              <div class="warehouse-event-meta">
                <span><strong>Lugar:</strong> ${escapeHtml(sourceEntry.sourceEventPlace || "Por definir")}</span>
                <span><strong>Planner:</strong> ${escapeHtml(sourceEntry.sourcePlanner || "Por definir")}</span>
                <span><strong>Salida:</strong> ${escapeHtml(displayDateTime(sourceEntry))}</span>
                <span><strong>Regreso previsto:</strong> ${escapeHtml(sourceEntry.sourceExpectedReturnAt ? formatWarehouseDateTime(sourceEntry.sourceExpectedReturnAt) : "Por definir")}</span>
              </div>` : ""}
            ${sourceEntry
              ? `<details class="warehouse-event-lines-disclosure">
                  <summary>Ver equipo y movimientos (${escapeHtml(entries.length)} renglones)</summary>
                  <div class="warehouse-board-lines">${entryLines}</div>
                </details>`
              : `<div class="warehouse-board-lines">${entryLines}</div>`}
          </article>
        `;
      })
      .join("");
  }

  function renderWorkshopBoard() {
    const records = inventoryLifecycle().workshop
      .sort((first, second) => {
        const activeDifference = Number(second.remainingQuantity > 0) - Number(first.remainingQuantity > 0);
        return activeDifference || movementChronologyKey(second.movement).localeCompare(movementChronologyKey(first.movement));
      })
      .slice(0, 150);

    if (!records.length) {
      elements.workshopBoard.innerHTML = '<p class="warehouse-empty">No hay salidas a taller registradas.</p>';
      return;
    }
    const activeQuantity = records.reduce((sum, record) => sum + record.remainingQuantity, 0);
    const activeRecords = records.filter((record) => record.remainingQuantity > 0).length;
    const rows = records
      .map((record) => {
        const movement = record.movement;
        const item = itemById(movement.itemId);
        const isActive = record.remainingQuantity > 0;
        const returns = record.returns.length
          ? record.returns
              .map((entry) => `${entry.quantity} x ${displayDateTime(entry.movement)}`)
              .join(" · ")
          : "Pendiente";
        return `
          <tr>
            <td><span class="warehouse-status-pill${isActive ? " is-active" : ""}">${isActive ? "En taller" : "Devuelto"}</span></td>
            <td>
              <strong>${escapeHtml(movementItemName(movement))}</strong>
              <small>${escapeHtml(item?.category || "Sin categoría")}</small>
            </td>
            <td>${escapeHtml(movement.quantity)}${isActive ? `<small>Pendiente: ${escapeHtml(record.remainingQuantity)}</small>` : ""}</td>
            <td>${escapeHtml(displayDateTime(movement))}</td>
            <td>${escapeHtml(movement.repair || "Sin detalle")}</td>
            <td>${escapeHtml(movement.sparePart || "Sin detalle")}</td>
            <td>${escapeHtml(movement.responsible || "Sin responsable")}</td>
            <td>${escapeHtml(returns)}</td>
            <td>
              ${isActive ? `<button class="warehouse-row-button" type="button" data-workshop-return="${escapeHtml(movement.itemId)}" data-related-movement="${escapeHtml(movement.id)}">Regresar</button>` : '<small>Completo</small>'}
            </td>
          </tr>
        `;
      })
      .join("");
    elements.workshopBoard.innerHTML = `
      <div class="warehouse-control-summary">
        <div class="warehouse-control-summary-header">
          <span>Registros activos: ${escapeHtml(activeRecords)}</span>
          <span>Equipo pendiente: ${escapeHtml(activeQuantity)}</span>
        </div>
        <div class="warehouse-table-wrap">
          <table class="equipment-base-table warehouse-control-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Equipo</th>
                <th>Cantidad</th>
                <th>Salida a taller</th>
                <th>Qué tiene malo</th>
                <th>Repuesto necesario</th>
                <th>Responsables</th>
                <th>Regreso a bodega</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderRentalDraft() {
    if (!state.rentalDraft.length) {
      elements.rentalDraft.innerHTML = '<p class="warehouse-empty">Use el botón Renta en la tabla para agregar equipo al PDF.</p>';
      return;
    }

    elements.rentalDraft.innerHTML = `
      <table class="equipment-base-table warehouse-rental-draft-table">
        <thead>
          <tr>
            <th>Cantidad</th>
            <th>Descripción editable</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${state.rentalDraft
            .map(
              (line) => `
                <tr data-rental-line="${escapeHtml(line.id)}">
                  <td><input class="warehouse-inline-input warehouse-qty-input" data-rental-field="quantity" type="number" min="1" step="1" value="${escapeHtml(line.quantity)}" /></td>
                  <td><textarea class="warehouse-inline-input warehouse-name-input" data-rental-field="description" rows="2">${escapeHtml(line.description)}</textarea></td>
                  <td><button class="warehouse-row-button" type="button" data-remove-rental-line="${escapeHtml(line.id)}">Quitar</button></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderWorkshopBulkItems() {
    const current = elements.workshopBulkItem.value;
    const options = activeItems()
      .slice()
      .sort((a, b) => `${a.category} ${a.name}`.localeCompare(`${b.category} ${b.name}`, "es"))
      .map((item) => {
        const stats = statsForItem(item);
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.category} - ${item.name} (cantidad ${stats.physical})`)}</option>`;
      });
    elements.workshopBulkItem.innerHTML = options.join("");
    if (activeItems().some((item) => item.id === current)) elements.workshopBulkItem.value = current;
  }

  function renderWorkshopDraft() {
    if (!state.workshopDraft.length) {
      elements.workshopDraft.innerHTML = '<p class="warehouse-empty">Seleccione equipos para preparar una salida múltiple a taller.</p>';
      return;
    }
    elements.workshopDraft.innerHTML = `
      <table class="equipment-base-table warehouse-rental-draft-table">
        <thead>
          <tr>
            <th>Cantidad</th>
            <th>Equipo</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${state.workshopDraft
            .map(
              (line) => `
                <tr data-workshop-line="${escapeHtml(line.id)}">
                  <td><input class="warehouse-inline-input warehouse-qty-input" data-workshop-field="quantity" type="number" min="1" step="1" value="${escapeHtml(line.quantity)}" /></td>
                  <td>${escapeHtml(line.itemName)}</td>
                  <td><button class="warehouse-row-button" type="button" data-remove-workshop-line="${escapeHtml(line.id)}">Quitar</button></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderRentedBoard() {
    const records = inventoryLifecycle().rental
      .sort((first, second) => {
        const activeDifference = Number(second.remainingQuantity > 0) - Number(first.remainingQuantity > 0);
        return activeDifference || movementChronologyKey(second.movement).localeCompare(movementChronologyKey(first.movement));
      })
      .slice(0, 150);

    if (!records.length) {
      elements.rentedBoard.innerHTML = '<p class="warehouse-empty">No hay rentas registradas.</p>';
      return;
    }
    const activeQuantity = records.reduce((sum, record) => sum + record.remainingQuantity, 0);
    const activeRecords = records.filter((record) => record.remainingQuantity > 0).length;
    const rows = records
      .map((record) => {
        const movement = record.movement;
        const isActive = record.remainingQuantity > 0;
        const returns = record.returns.length
          ? record.returns
              .map((entry) => `${entry.quantity} x ${displayDateTime(entry.movement)}`)
              .join(" · ")
          : "Pendiente";
        return `
          <tr>
            <td><span class="warehouse-status-pill${isActive ? " is-active" : ""}">${isActive ? "En renta" : "Devuelto"}</span></td>
            <td>${escapeHtml(movement.reference || "Sin cliente")}</td>
            <td>
              <strong>${escapeHtml(movement.description || movementItemName(movement))}</strong>
              <small>${escapeHtml(movementItemName(movement))}</small>
            </td>
            <td>${escapeHtml(movement.quantity)}${isActive ? `<small>Pendiente: ${escapeHtml(record.remainingQuantity)}</small>` : ""}</td>
            <td>${escapeHtml(movement.rentalDays || 1)}</td>
            <td>${escapeHtml(displayDateTime(movement))}</td>
            <td>${escapeHtml(returns)}</td>
            <td>${escapeHtml(movement.responsible || "Sin responsable")}</td>
            <td>
              ${isActive ? `<button class="warehouse-row-button" type="button" data-rental-return="${escapeHtml(movement.itemId)}" data-related-movement="${escapeHtml(movement.id)}">Devolver</button>` : '<small>Completo</small>'}
            </td>
          </tr>
        `;
      })
      .join("");
    elements.rentedBoard.innerHTML = `
      <div class="warehouse-control-summary">
        <div class="warehouse-control-summary-header">
          <span>Rentas activas: ${escapeHtml(activeRecords)}</span>
          <span>Equipo pendiente: ${escapeHtml(activeQuantity)}</span>
        </div>
        <div class="warehouse-table-wrap">
          <table class="equipment-base-table warehouse-control-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Cliente</th>
                <th>Descripción del equipo</th>
                <th>Cantidad</th>
                <th>Días</th>
                <th>Fecha y hora de renta</th>
                <th>Fecha y hora de devolución</th>
                <th>Responsable</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  function movementMatchesLogFilter(movement) {
    const typeFilter = elements.logTypeFilter.value || "all";
    if (typeFilter !== "all" && movement.type !== typeFilter) return false;
    const term = normalizeText(elements.logSearch.value).toLowerCase();
    if (!term) return true;
    return [
      movementLabels[movement.type],
      movementItemName(movement),
      movement.responsible,
      movement.reference,
      movement.repair,
      movement.sparePart,
      movement.description,
      movement.notes,
      movement.dateTime,
      movement.date
    ]
      .join(" ")
      .toLowerCase()
      .includes(term);
  }

  function renderLog() {
    const movements = state.movements
      .filter(movementMatchesLogFilter)
      .slice()
      .sort((a, b) => `${b.dateTime || b.date} ${b.createdAt}`.localeCompare(`${a.dateTime || a.date} ${a.createdAt}`))
      .slice(0, 150);

    if (!movements.length) {
      elements.logList.innerHTML = '<p class="warehouse-empty">Sin bitácoras registradas.</p>';
      return;
    }

    elements.logList.innerHTML = movements
      .map((movement) => {
        const adjustment = movement.type === "ajuste" && movement.previousQuantity !== null
          ? `Antes: ${movement.previousQuantity}. Nuevo total físico: ${movement.quantity}.`
          : `Cantidad: ${movement.quantity}.`;
        return `
          <article class="warehouse-log-entry">
            <div>
              <span class="warehouse-log-type">${escapeHtml(movementLabels[movement.type])}</span>
              <strong>${escapeHtml(movementItemName(movement))}</strong>
              <small>${escapeHtml(displayDateTime(movement))} · ${escapeHtml(adjustment)}</small>
            </div>
            <p>${escapeHtml([movement.reference, movement.responsible].filter(Boolean).join(" · "))}</p>
            ${movement.description ? `<p><strong>Descripción:</strong> ${escapeHtml(movement.description)}</p>` : ""}
            ${movement.repair ? `<p><strong>Qué tiene malo:</strong> ${escapeHtml(movement.repair)}</p>` : ""}
            ${movement.sparePart ? `<p><strong>Repuesto:</strong> ${escapeHtml(movement.sparePart)}</p>` : ""}
            ${movement.notes ? `<p>${escapeHtml(movement.notes)}</p>` : ""}
            ${movement.attachment ? `<a href="${escapeHtml(attachmentHref(movement.attachment))}" download="${escapeHtml(movement.attachment.name)}">Ver archivo adjunto</a>` : ""}
            ${movement.sourcePdfUrl ? `<a href="${escapeHtml(movement.sourcePdfUrl)}" target="_blank" rel="noopener">Ver cuadro de Requerimiento de equipo</a>` : ""}
            <button class="warehouse-row-button" type="button" data-delete-movement="${escapeHtml(movement.id)}">Eliminar</button>
          </article>
        `;
      })
      .join("");
  }

  function publishWarehouseAvailability() {
    const lifecycle = inventoryLifecycle();
    const publishedAt = new Date().toISOString();
    const payload = {
      version: 1,
      updatedAt: state.updatedAt,
      publishedAt,
      savedAt: publishedAt,
      state,
      items: activeItems().map((item) => {
        const stats = statsForItem(item);
        return {
          id: item.id,
          sourceKey: item.sourceKey || warehouseCanonicalKey(item.name),
          name: item.name,
          category: item.category,
          quantity: normalizeNumber(item.quantity),
          available: stats.physical,
          out: stats.out,
          workshop: stats.workshop,
          rented: stats.rented,
          lost: stats.lost,
          observation: availabilityObservationText(item, lifecycle)
        };
      })
    };
    window.LIVE_WAREHOUSE_AVAILABILITY = payload;
    document.dispatchEvent(new CustomEvent("live:warehouse-inventory-updated", { detail: payload }));
  }

  function renderAll() {
    renderSummary();
    renderCategoryFilter();
    renderInventoryTable();
    renderEventsBoard();
    renderWorkshopBulkItems();
    renderWorkshopDraft();
    renderWorkshopBoard();
    renderRentalDraft();
    renderRentedBoard();
    renderLog();
    publishWarehouseAvailability();
  }

  function askDifferenceReason(message) {
    const reason = window.prompt(message);
    if (reason === null) return null;
    return normalizeText(reason) || "Sin justificación escrita";
  }

  function addAuditMovement(item, previousQuantity, quantity, notes = "Ajuste manual de inventario.") {
    state.movements.push({
      id: uid("movement"),
      type: "ajuste",
      itemId: item.id,
      itemName: item.name,
      quantity,
      previousQuantity,
      date: todayInputValue(),
      dateTime: dateTimeLocalValue(),
      responsible: "",
      reference: "Inventario editable",
      repair: "",
      sparePart: "",
      description: "",
      notes,
      batchId: "",
      attachment: null,
      warehouseSignature: "",
      workshopSignature: "",
      createdAt: new Date().toISOString()
    });
  }

  function updateInlineField(target) {
    const row = target.closest("[data-warehouse-item]");
    const item = row ? itemById(row.dataset.warehouseItem) : null;
    if (!item) return;

    const field = target.dataset.field;
    if (field === "physicalQuantity") {
      const stats = statsForItem(item);
      const previousPhysical = stats.physical;
      const physicalQuantity = normalizeNumber(target.value);
      if (previousPhysical !== physicalQuantity) {
        const reason = askDifferenceReason(
          `Cantidad física anterior: ${previousPhysical}. Nueva cantidad física: ${physicalQuantity}. ¿Por qué no cuadra el equipo?`
        );
        if (reason === null) {
          target.value = previousPhysical;
          return;
        }
        if (physicalQuantity < previousPhysical) {
          state.movements.push({
            id: uid("movement"),
            type: "perdido",
            itemId: item.id,
            itemName: item.name,
            quantity: previousPhysical - physicalQuantity,
            previousQuantity: previousPhysical,
            date: todayInputValue(),
            dateTime: dateTimeLocalValue(),
            responsible: "",
            reference: "Diferencia de inventario",
            repair: "",
            sparePart: "",
            description: "",
            notes: reason,
            batchId: "",
            attachment: null,
            warehouseSignature: "",
            workshopSignature: "",
            createdAt: new Date().toISOString()
          });
        } else {
          const previousTotal = normalizeNumber(item.quantity);
          item.quantity = physicalQuantity + stats.reserved;
          addAuditMovement(item, previousTotal, item.quantity, `Ajuste por diferencia física: ${reason}`);
        }
      }
    } else if (field === "totalReal") {
      const previousTotal = normalizeNumber(item.quantity);
      const totalReal = normalizeNumber(target.value);
      if (previousTotal !== totalReal) {
        const reason = askDifferenceReason(
          `Cantidad registrada anterior: ${previousTotal}. Nueva cantidad registrada: ${totalReal}. ¿Por qué cambió el inventario?`
        );
        if (reason === null) {
          target.value = previousTotal;
          return;
        }
        item.quantity = totalReal;
        addAuditMovement(item, previousTotal, totalReal, `Cambio de cantidad registrada: ${reason}`);
      }
    } else if (field === "name") {
      item.name = normalizeText(target.value) || item.name;
    }

    item.updatedAt = new Date().toISOString();
    scheduleSave();
    renderAll();
    setStatus("Cambio guardado.", "success");
  }

  function addNewItem() {
    const name = normalizeText(elements.newName.value);
    if (!name) {
      setStatus("Escriba el nombre completo del equipo.", "warning");
      elements.newName.focus();
      return;
    }

    const now = new Date().toISOString();
    const item = {
      id: uid("item"),
      category: categoryLabel(elements.newCategory.value || "GENERAL"),
      name,
      sourceKey: warehouseCanonicalKey(name),
      quantity: normalizeNumber(elements.newQuantity.value),
      notes: normalizeText(elements.newNotes.value),
      archived: false,
      createdAt: now,
      updatedAt: now
    };
    state.items.push(item);
    state.movements.push({
      id: uid("movement"),
      type: "ajuste",
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      previousQuantity: 0,
      date: todayInputValue(),
      responsible: "",
      reference: "Equipo nuevo",
      repair: "",
      sparePart: "",
      description: "",
      notes: "Equipo agregado al inventario.",
      batchId: "",
      attachment: null,
      createdAt: now
    });

    elements.newName.value = "";
    elements.newCategory.value = "";
    elements.newQuantity.value = "1";
    elements.newNotes.value = "";
    scheduleSave();
    renderAll();
    setStatus("Equipo agregado al inventario.", "success");
  }

  function addSubtitle() {
    const subtitle = categoryLabel(elements.newSubtitle.value);
    if (!subtitle) {
      setStatus("Escriba el nombre del subtítulo.", "warning");
      elements.newSubtitle.focus();
      return;
    }
    if (!state.subtitles.includes(subtitle)) state.subtitles.push(subtitle);
    elements.newCategory.value = subtitle;
    elements.newSubtitle.value = "";
    scheduleSave();
    renderCategoryFilter();
    renderInventoryTable();
    setStatus("Subtítulo agregado. Ya puede agregar equipo en esa categoría.", "success");
  }

  function movementReducesPhysical(type) {
    return ["salida", "taller", "renta", "perdido"].includes(type);
  }

  function addMovement(payload) {
    const item = itemById(payload.itemId);
    if (!item && !normalizeText(payload.itemName)) return false;
    const quantity = normalizeNumber(payload.quantity);
    if (quantity <= 0) {
      setStatus("La cantidad debe ser mayor a 0.", "warning");
      return false;
    }
    const stats = item ? statsForItem(item) : null;
    if (item && movementReducesPhysical(payload.type) && quantity > stats.physical) {
      const ok = window.confirm(
        `Total físico en bodega: ${stats.physical}. ¿Desea registrar ${quantity} y dejar faltante?`
      );
      if (!ok) return false;
    }

    const dateTime = normalizeText(payload.dateTime || payload.date) || dateTimeLocalValue();
    state.movements.push({
      id: uid("movement"),
      type: payload.type,
      itemId: item?.id || "",
      itemName: item?.name || normalizeText(payload.itemName),
      quantity,
      previousQuantity: null,
      date: dateTime.slice(0, 10) || todayInputValue(),
      dateTime,
      responsible: normalizeText(payload.responsible),
      reference: normalizeText(payload.reference),
      repair: normalizeText(payload.repair),
      sparePart: normalizeText(payload.sparePart),
      description: normalizeText(payload.description),
      rentalDays: Math.max(1, normalizeNumber(payload.rentalDays) || 1),
      notes: normalizeText(payload.notes),
      batchId: normalizeText(payload.batchId),
      relatedMovementId: normalizeText(payload.relatedMovementId),
      attachment: normalizeAttachment(payload.attachment),
      warehouseSignature: normalizeText(payload.warehouseSignature),
      workshopSignature: normalizeText(payload.workshopSignature),
      sourceType: normalizeText(payload.sourceType),
      sourceDocumentId: normalizeText(payload.sourceDocumentId),
      sourceEventId: normalizeText(payload.sourceEventId),
      sourceEventName: normalizeText(payload.sourceEventName),
      sourceEventPlace: normalizeText(payload.sourceEventPlace),
      sourcePlanner: normalizeText(payload.sourcePlanner),
      sourceEventDate: normalizeText(payload.sourceEventDate),
      sourceExpectedReturnAt: normalizeText(payload.sourceExpectedReturnAt),
      sourcePdfUrl: normalizeText(payload.sourcePdfUrl),
      sourceJsonUrl: normalizeText(payload.sourceJsonUrl),
      sourceFileName: normalizeText(payload.sourceFileName),
      sourceJsonFileName: normalizeText(payload.sourceJsonFileName),
      sourceCategory: normalizeText(payload.sourceCategory),
      sourceRequestedName: normalizeText(payload.sourceRequestedName),
      sourceLineKey: normalizeText(payload.sourceLineKey),
      sourceUnmatched: Boolean(payload.sourceUnmatched),
      createdAt: new Date().toISOString()
    });
    return true;
  }

  function readFileAsDataUrl(file) {
    if (!file) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
  }

  function switchWindow(name) {
    activeWindow = name || "inventory";
    elements.windowButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.warehouseWindow === activeWindow);
    });
    elements.views.forEach((view) => {
      view.classList.toggle("is-active", view.dataset.warehouseView === activeWindow);
    });
  }

  function openDialog(kind, itemId, relatedMovementId = "") {
    const item = itemById(itemId);
    if (!item) return;
    dialogContext = { kind, itemId, relatedMovementId };
    const stats = statsForItem(item);

    if (kind === "events") {
      elements.dialogTitle.textContent = "Fuera / Evento";
      elements.dialogSaveButton.textContent = "Guardar movimiento";
      elements.dialogBody.innerHTML = `
        <div class="warehouse-selected-equipment">
          <span>Equipo seleccionado</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>Total físico en bodega: ${escapeHtml(stats.physical)}</small>
        </div>
        <div class="warehouse-form-grid">
          <label>
            Movimiento
            <select id="dialogEventType">
              <option value="salida">Salida de bodega</option>
              <option value="ingreso_evento">Ingreso de evento</option>
            </select>
          </label>
          <label>
            Cantidad
            <input id="dialogQuantity" type="number" min="1" step="1" value="1" />
          </label>
          <label>
            Fecha y hora
            <input id="dialogDateTime" type="datetime-local" value="${escapeHtml(dateTimeLocalValue())}" />
          </label>
          <label>
            Evento
            <input id="dialogReference" type="text" autocomplete="off" placeholder="Nombre del evento" />
          </label>
          <label>
            Responsable
            <input id="dialogResponsible" type="text" autocomplete="off" placeholder="Quien retira o recibe" />
          </label>
          <label>
            PDF / archivo del evento
            <input id="dialogAttachment" type="file" />
          </label>
          <label class="warehouse-field-wide">
            Observaciones
            <textarea id="dialogNotes" rows="3" placeholder="Notas de salida o ingreso"></textarea>
          </label>
        </div>
      `;
    }

    if (kind === "workshop") {
      elements.dialogTitle.textContent = "Salida a taller";
      elements.dialogSaveButton.textContent = "Guardar bitácora";
      elements.dialogBody.innerHTML = `
        <div class="warehouse-selected-equipment">
          <span>Equipo seleccionado</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>Total físico en bodega: ${escapeHtml(stats.physical)}</small>
        </div>
        <div class="warehouse-form-grid">
          <label>
            Fecha y hora fija
            <input id="dialogDateTime" type="datetime-local" value="${escapeHtml(dateTimeLocalValue())}" readonly />
          </label>
          <label>
            Cantidad
            <input id="dialogQuantity" type="number" min="1" step="1" value="1" />
          </label>
          <label>
            Responsable
            <input id="dialogResponsible" type="text" autocomplete="off" placeholder="Quien envía a taller" />
          </label>
          <label class="warehouse-field-wide">
            Qué tiene malo
            <textarea id="dialogRepair" rows="3" placeholder="Detalle de la falla"></textarea>
          </label>
          <label class="warehouse-field-wide">
            Repuesto necesario
            <textarea id="dialogSparePart" rows="3" placeholder="Repuesto, cable, pieza o servicio necesario"></textarea>
          </label>
        </div>
        <div class="warehouse-signature-grid">
          <div class="warehouse-signature-pad">
            <span>Firma responsable de bodega</span>
            <canvas id="dialogWarehouseSignature" width="520" height="160"></canvas>
            <button class="warehouse-row-button" type="button" data-clear-signature="dialogWarehouse">Limpiar firma</button>
          </div>
          <div class="warehouse-signature-pad">
            <span>Firma encargado de taller</span>
            <canvas id="dialogWorkshopSignature" width="520" height="160"></canvas>
            <button class="warehouse-row-button" type="button" data-clear-signature="dialogWorkshop">Limpiar firma</button>
          </div>
        </div>
      `;
    }

    if (kind === "workshopReturn" || kind === "rentalReturn") {
      const relatedMovement = state.movements.find((movement) => movement.id === relatedMovementId);
      const records = kind === "workshopReturn"
        ? inventoryLifecycle().workshop
        : inventoryLifecycle().rental;
      const relatedRecord = records.find((record) => record.movement.id === relatedMovementId);
      const maximum = relatedRecord?.remainingQuantity || (kind === "workshopReturn" ? stats.workshop : stats.rented);
      elements.dialogTitle.textContent = kind === "workshopReturn" ? "Devolución de taller" : "Devolución de renta";
      elements.dialogSaveButton.textContent = "Registrar devolución";
      elements.dialogBody.innerHTML = `
        <div class="warehouse-selected-equipment">
          <span>Equipo seleccionado</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${kind === "workshopReturn" ? `En taller: ${maximum}` : `En renta: ${maximum}`}${relatedMovement?.reference ? ` · ${escapeHtml(relatedMovement.reference)}` : ""}</small>
        </div>
        <div class="warehouse-form-grid">
          <label>
            Fecha y hora
            <input id="dialogDateTime" type="datetime-local" value="${escapeHtml(dateTimeLocalValue())}" />
          </label>
          <label>
            Cantidad
            <input id="dialogQuantity" type="number" min="1" max="${escapeHtml(maximum)}" step="1" value="${escapeHtml(maximum)}" />
          </label>
          <label>
            Responsable
            <input id="dialogResponsible" type="text" autocomplete="off" placeholder="Quien recibe" />
          </label>
          <label class="warehouse-field-wide">
            Observaciones
            <textarea id="dialogNotes" rows="3" placeholder="Estado en que regresa"></textarea>
          </label>
        </div>
      `;
    }

    if (kind === "rental") {
      elements.dialogTitle.textContent = "Agregar a renta PDF";
      elements.dialogSaveButton.textContent = "Agregar a PDF";
      elements.dialogBody.innerHTML = `
        <div class="warehouse-selected-equipment">
          <span>Equipo seleccionado</span>
          <strong>${escapeHtml(item.name)}</strong>
          <small>Total físico en bodega: ${escapeHtml(stats.physical)}</small>
        </div>
        <div class="warehouse-form-grid">
          <label>
            Cantidad
            <input id="dialogQuantity" type="number" min="1" step="1" value="1" />
          </label>
          <label class="warehouse-field-wide">
            Descripción editable para PDF
            <textarea id="dialogDescription" rows="3">${escapeHtml(item.name)}</textarea>
          </label>
        </div>
      `;
    }

    if (elements.dialog.showModal) elements.dialog.showModal();
    else elements.dialog.classList.add("is-open");
    initSignaturePad("dialogWarehouse", elements.dialogBody.querySelector("#dialogWarehouseSignature"));
    initSignaturePad("dialogWorkshop", elements.dialogBody.querySelector("#dialogWorkshopSignature"));
  }

  function openEventReturnDialog(groupKey) {
    const records = movementLifecycleRecords("salida", "ingreso_evento")
      .filter((record) => eventKey(record.movement) === groupKey && record.remainingQuantity > 0);
    if (!records.length) {
      setStatus("El equipo de este evento ya regresó por completo.", "success");
      return;
    }
    const source = records.find((record) => record.movement.sourceType === "requerimiento-equipo")?.movement
      || records[0].movement;
    dialogContext = {
      kind: "eventBatchReturn",
      groupKey,
      recordIds: records.map((record) => record.movement.id)
    };
    elements.dialogTitle.textContent = "Devolución del cuadro";
    elements.dialogSaveButton.textContent = "Registrar devolución completa";
    elements.dialogBody.innerHTML = `
      <div class="warehouse-selected-equipment">
        <span>Evento</span>
        <strong>${escapeHtml(source.sourceEventName || source.reference || "Sin evento")}</strong>
        <small>${escapeHtml(records.reduce((sum, record) => sum + record.remainingQuantity, 0))} unidades pendientes en ${escapeHtml(records.length)} renglones</small>
      </div>
      <div class="warehouse-return-list">
        ${records.map((record) => `<span><strong>${escapeHtml(record.remainingQuantity)}</strong> x ${escapeHtml(movementItemName(record.movement))}</span>`).join("")}
      </div>
      <div class="warehouse-form-grid">
        <label>
          Fecha y hora de regreso
          <input id="dialogDateTime" type="datetime-local" value="${escapeHtml(dateTimeLocalValue())}" />
        </label>
        <label>
          Responsable que recibe
          <input id="dialogResponsible" type="text" autocomplete="off" placeholder="Nombre del responsable" />
        </label>
        <label class="warehouse-field-wide">
          Observaciones de devolución
          <textarea id="dialogNotes" rows="3" placeholder="Estado y novedades del equipo al regresar"></textarea>
        </label>
      </div>
    `;
    if (elements.dialog.showModal) elements.dialog.showModal();
    else elements.dialog.classList.add("is-open");
  }

  function closeDialog() {
    dialogContext = null;
    if (elements.dialog.close) elements.dialog.close();
    elements.dialog.classList.remove("is-open");
  }

  async function saveDialog() {
    if (!dialogContext) return;
    if (dialogContext.kind === "eventBatchReturn") {
      const recordsById = new Map(
        movementLifecycleRecords("salida", "ingreso_evento").map((record) => [record.movement.id, record])
      );
      const records = dialogContext.recordIds.map((id) => recordsById.get(id)).filter(
        (record) => record && record.remainingQuantity > 0
      );
      if (!records.length) {
        closeDialog();
        renderAll();
        setStatus("El equipo de este evento ya regresó por completo.", "success");
        return;
      }
      const dateTime = elements.dialogBody.querySelector("#dialogDateTime")?.value || dateTimeLocalValue();
      const responsible = elements.dialogBody.querySelector("#dialogResponsible")?.value;
      const notes = elements.dialogBody.querySelector("#dialogNotes")?.value;
      records.forEach((record) => {
        const movement = record.movement;
        addMovement({
          type: "ingreso_evento",
          itemId: movement.itemId,
          itemName: movementItemName(movement),
          quantity: record.remainingQuantity,
          dateTime,
          responsible,
          reference: movement.reference,
          notes,
          batchId: movement.batchId,
          relatedMovementId: movement.id,
          sourceType: movement.sourceType,
          sourceDocumentId: movement.sourceDocumentId,
          sourceEventId: movement.sourceEventId,
          sourceEventName: movement.sourceEventName,
          sourceEventPlace: movement.sourceEventPlace,
          sourcePlanner: movement.sourcePlanner,
          sourceEventDate: movement.sourceEventDate,
          sourceExpectedReturnAt: movement.sourceExpectedReturnAt,
          sourcePdfUrl: movement.sourcePdfUrl,
          sourceJsonUrl: movement.sourceJsonUrl,
          sourceFileName: movement.sourceFileName,
          sourceJsonFileName: movement.sourceJsonFileName,
          sourceCategory: movement.sourceCategory,
          sourceRequestedName: movement.sourceRequestedName,
          sourceLineKey: movement.sourceLineKey,
          sourceUnmatched: movement.sourceUnmatched
        });
      });
      closeDialog();
      switchWindow("events");
      scheduleSave();
      renderAll();
      setStatus("Devolución completa del cuadro registrada.", "success");
      return;
    }
    const item = itemById(dialogContext.itemId);
    if (!item) return;
    const quantity = normalizeNumber(elements.dialogBody.querySelector("#dialogQuantity")?.value);
    if (dialogContext.kind === "workshopReturn" || dialogContext.kind === "rentalReturn") {
      const records = dialogContext.kind === "workshopReturn"
        ? inventoryLifecycle().workshop
        : inventoryLifecycle().rental;
      const relatedRecord = records.find((record) => record.movement.id === dialogContext.relatedMovementId);
      const stats = statsForItem(item);
      const maximum = relatedRecord?.remainingQuantity || (dialogContext.kind === "workshopReturn" ? stats.workshop : stats.rented);
      if (quantity <= 0 || quantity > maximum) {
        setStatus(`La devolución debe estar entre 1 y ${maximum}.`, "warning");
        return;
      }
    }

    if (dialogContext.kind === "events") {
      const file = elements.dialogBody.querySelector("#dialogAttachment")?.files?.[0];
      const attachment = await readFileAsDataUrl(file);
      const ok = addMovement({
        type: elements.dialogBody.querySelector("#dialogEventType")?.value || "salida",
        itemId: item.id,
        quantity,
        dateTime: elements.dialogBody.querySelector("#dialogDateTime")?.value,
        reference: elements.dialogBody.querySelector("#dialogReference")?.value,
        responsible: elements.dialogBody.querySelector("#dialogResponsible")?.value,
        notes: elements.dialogBody.querySelector("#dialogNotes")?.value,
        attachment
      });
      if (!ok) return;
      switchWindow("events");
    }

    if (dialogContext.kind === "workshop") {
      const ok = addMovement({
        type: "taller",
        itemId: item.id,
        quantity,
        dateTime: elements.dialogBody.querySelector("#dialogDateTime")?.value,
        responsible: elements.dialogBody.querySelector("#dialogResponsible")?.value,
        reference: "Taller",
        repair: elements.dialogBody.querySelector("#dialogRepair")?.value,
        sparePart: elements.dialogBody.querySelector("#dialogSparePart")?.value,
        warehouseSignature: signatureData("dialogWarehouse"),
        workshopSignature: signatureData("dialogWorkshop")
      });
      if (!ok) return;
      switchWindow("workshop");
    }

    if (dialogContext.kind === "workshopReturn") {
      const relatedMovement = state.movements.find((movement) => movement.id === dialogContext.relatedMovementId);
      const ok = addMovement({
        type: "devolucion_taller",
        itemId: item.id,
        quantity,
        dateTime: elements.dialogBody.querySelector("#dialogDateTime")?.value,
        responsible: elements.dialogBody.querySelector("#dialogResponsible")?.value,
        reference: relatedMovement?.reference || "Taller",
        batchId: relatedMovement?.batchId,
        relatedMovementId: relatedMovement?.id,
        notes: elements.dialogBody.querySelector("#dialogNotes")?.value
      });
      if (!ok) return;
      switchWindow("workshop");
    }

    if (dialogContext.kind === "rentalReturn") {
      const relatedMovement = state.movements.find((movement) => movement.id === dialogContext.relatedMovementId);
      const ok = addMovement({
        type: "devolucion_renta",
        itemId: item.id,
        quantity,
        dateTime: elements.dialogBody.querySelector("#dialogDateTime")?.value,
        responsible: elements.dialogBody.querySelector("#dialogResponsible")?.value,
        reference: relatedMovement?.reference || "Renta",
        batchId: relatedMovement?.batchId,
        relatedMovementId: relatedMovement?.id,
        notes: elements.dialogBody.querySelector("#dialogNotes")?.value
      });
      if (!ok) return;
      switchWindow("rental");
    }

    if (dialogContext.kind === "rental") {
      state.rentalDraft.push({
        id: uid("rent-line"),
        itemId: item.id,
        itemName: item.name,
        description: normalizeText(elements.dialogBody.querySelector("#dialogDescription")?.value) || item.name,
        quantity: quantity || 1
      });
      switchWindow("rental");
    }

    closeDialog();
    scheduleSave();
    renderAll();
    setStatus("Movimiento guardado.", "success");
  }

  function updateRentalDraftField(target) {
    const row = target.closest("[data-rental-line]");
    const line = row ? state.rentalDraft.find((entry) => entry.id === row.dataset.rentalLine) : null;
    if (!line) return;
    if (target.dataset.rentalField === "quantity") line.quantity = normalizeNumber(target.value) || 1;
    if (target.dataset.rentalField === "description") line.description = normalizeText(target.value);
    scheduleSave();
    renderRentalDraft();
  }

  function removeRentalLine(id) {
    state.rentalDraft = state.rentalDraft.filter((line) => line.id !== id);
    scheduleSave();
    renderRentalDraft();
  }

  function addWorkshopDraftLine() {
    const item = itemById(elements.workshopBulkItem.value);
    if (!item) {
      setStatus("Seleccione un equipo para taller.", "warning");
      return;
    }
    const quantity = normalizeNumber(elements.workshopBulkQuantity.value) || 1;
    const existing = state.workshopDraft.find((line) => line.itemId === item.id);
    if (existing) {
      existing.quantity += quantity;
    } else {
      state.workshopDraft.push({
        id: uid("workshop-line"),
        itemId: item.id,
        itemName: item.name,
        quantity
      });
    }
    elements.workshopBulkQuantity.value = "1";
    scheduleSave();
    renderWorkshopDraft();
    setStatus("Equipo agregado a la salida múltiple de taller.", "success");
  }

  function updateWorkshopDraftField(target) {
    const row = target.closest("[data-workshop-line]");
    const line = row ? state.workshopDraft.find((entry) => entry.id === row.dataset.workshopLine) : null;
    if (!line) return;
    line.quantity = normalizeNumber(target.value) || 1;
    scheduleSave();
    renderWorkshopDraft();
  }

  function removeWorkshopLine(id) {
    state.workshopDraft = state.workshopDraft.filter((line) => line.id !== id);
    scheduleSave();
    renderWorkshopDraft();
  }

  function clearWorkshopDraft() {
    state.workshopDraft = [];
    elements.workshopBulkRepair.value = "";
    elements.workshopBulkSparePart.value = "";
    elements.workshopBulkNotes.value = "";
    clearSignature("workshopWarehouse");
    clearSignature("workshopShop");
    elements.workshopBulkDateTime.value = dateTimeLocalValue();
    scheduleSave();
    renderWorkshopDraft();
  }

  function registerWorkshopDraft() {
    if (!state.workshopDraft.length) {
      setStatus("Agregue al menos un equipo a la salida múltiple de taller.", "warning");
      return;
    }
    const repair = normalizeText(elements.workshopBulkRepair.value);
    if (!repair) {
      setStatus("Escriba la razón o qué tiene malo el equipo.", "warning");
      elements.workshopBulkRepair.focus();
      return;
    }
    const dateTime = elements.workshopBulkDateTime.value || dateTimeLocalValue();
    const batchId = uid("taller");
    const warehouseResponsible = normalizeText(elements.workshopBulkWarehouseResponsible.value);
    const shopResponsible = normalizeText(elements.workshopBulkShopResponsible.value);
    const responsible = [warehouseResponsible && `Bodega: ${warehouseResponsible}`, shopResponsible && `Taller: ${shopResponsible}`]
      .filter(Boolean)
      .join(" / ");
    const warehouseSignature = signatureData("workshopWarehouse");
    const workshopSignature = signatureData("workshopShop");

    for (const line of state.workshopDraft) {
      const ok = addMovement({
        type: "taller",
        itemId: line.itemId,
        quantity: line.quantity,
        dateTime,
        responsible,
        reference: "Taller",
        repair,
        sparePart: elements.workshopBulkSparePart.value,
        notes: elements.workshopBulkNotes.value,
        batchId,
        warehouseSignature,
        workshopSignature
      });
      if (!ok) return;
    }

    clearWorkshopDraft();
    scheduleSave();
    renderAll();
    switchWindow("workshop");
    setStatus("Salida múltiple a taller registrada.", "success");
  }

  function openPrintDocument(title, bodyHtml) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setStatus("El navegador bloqueó la ventana de PDF. Permita ventanas emergentes para imprimir.", "warning");
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="UTF-8" />
          <title>${escapeHtml(title)}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 32px; color: #111; font-family: Arial, Helvetica, sans-serif; }
            header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 3px solid #111; padding-bottom: 18px; margin-bottom: 22px; }
            h1 { margin: 0; font-size: 26px; text-transform: uppercase; }
            h2 { margin: 22px 0 10px; font-size: 16px; text-transform: uppercase; }
            p { margin: 5px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border: 1px solid #111; padding: 8px; text-align: left; vertical-align: top; }
            th { color: #fff; background: #111; text-transform: uppercase; }
            .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin: 18px 0; }
            .line { min-height: 34px; border-bottom: 1px solid #111; }
            .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 60px; }
            .signature { border-top: 1px solid #111; padding-top: 8px; text-align: center; font-weight: 700; }
            @page { size: letter; margin: 18mm; }
          </style>
        </head>
        <body>${bodyHtml}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  }

  function generateRentalPdf() {
    if (!state.rentalDraft.length) {
      setStatus("Agregue equipo a la renta antes de generar PDF.", "warning");
      return;
    }
    const client = normalizeText(elements.rentalClient.value) || "Por definir";
    const responsible = normalizeText(elements.rentalResponsible.value) || "Por definir";
    const dateTime = elements.rentalDate.value || dateTimeLocalValue();
    const rentalDays = Math.max(1, normalizeNumber(elements.rentalDays.value) || 1);
    const notes = normalizeText(elements.rentalNotes.value);
    const batchId = uid("renta");

    const registered = [];
    for (const line of state.rentalDraft) {
      const item = itemById(line.itemId);
      if (!item) continue;
      const ok = addMovement({
        type: "renta",
        itemId: item.id,
        quantity: line.quantity,
        dateTime,
        responsible,
        reference: client,
        description: line.description,
        rentalDays,
        notes,
        batchId
      });
      if (!ok) return;
      registered.push(line);
    }

    const rows = registered
      .map(
        (line) => `
          <tr>
            <td>${escapeHtml(line.quantity)}</td>
            <td>${escapeHtml(line.description)}</td>
            <td><div class="line"></div></td>
          </tr>
        `
      )
      .join("");
    openPrintDocument(
      `Renta de equipo - ${client}`,
      `
        <header>
          <div>
            <p>Live Productions</p>
            <h1>Renta de equipo</h1>
          </div>
          <div>
            <p><strong>Fecha y hora:</strong> ${escapeHtml(dateTime.replace("T", " "))}</p>
            <p><strong>Documento:</strong> ${escapeHtml(batchId)}</p>
          </div>
        </header>
        <section class="meta">
          <p><strong>Cliente / proveedor:</strong> ${escapeHtml(client)}</p>
          <p><strong>Responsable:</strong> ${escapeHtml(responsible)}</p>
          <p><strong>Días de renta:</strong> ${escapeHtml(rentalDays)}</p>
          <p><strong>Monto:</strong></p>
          <div class="line"></div>
        </section>
        ${notes ? `<p><strong>Observaciones:</strong> ${escapeHtml(notes)}</p>` : ""}
        <table>
          <thead>
            <tr>
              <th>Cantidad</th>
              <th>Descripción del equipo</th>
              <th>Monto a mano</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="signatures">
          <div class="signature">Entrega Live Productions</div>
          <div class="signature">Recibe conforme</div>
        </div>
      `
    );

    state.rentalDraft = [];
    elements.rentalClient.value = "";
    elements.rentalResponsible.value = "";
    elements.rentalDays.value = "1";
    elements.rentalNotes.value = "";
    elements.rentalDate.value = dateTimeLocalValue();
    scheduleSave();
    renderAll();
    setStatus("Renta registrada. Use la ventana abierta para guardar como PDF.", "success");
  }

  function printEventPdf(groupKey) {
    const entries = state.movements
      .filter((movement) => ["salida", "ingreso_evento"].includes(movement.type) && eventKey(movement) === groupKey)
      .slice()
      .sort((a, b) => `${a.dateTime || a.date} ${a.createdAt}`.localeCompare(`${b.dateTime || b.date} ${b.createdAt}`));
    const eventName = entries.find((entry) => entry.sourceEventName)?.sourceEventName
      || entries[0]?.reference
      || "Sin evento";
    const rows = entries
      .map(
        (entry) => `
          <tr>
            <td>${escapeHtml(displayDateTime(entry))}</td>
            <td>${escapeHtml(movementLabels[entry.type])}</td>
            <td>${escapeHtml(entry.quantity)}</td>
            <td>${escapeHtml(movementItemName(entry))}</td>
            <td>${escapeHtml(entry.responsible)}</td>
          </tr>
        `
      )
      .join("");
    openPrintDocument(
      `Evento - ${eventName}`,
      `
        <header>
          <div>
            <p>Live Productions</p>
            <h1>Control de equipo fuera</h1>
          </div>
          <div><p><strong>Evento:</strong> ${escapeHtml(eventName)}</p></div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Movimiento</th>
              <th>Cantidad</th>
              <th>Equipo</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="signatures">
          <div class="signature">Entrega</div>
          <div class="signature">Recibe</div>
        </div>
      `
    );
  }

  function printWorkshopReport() {
    const records = inventoryLifecycle().workshop
      .slice()
      .sort((first, second) => movementChronologyKey(first.movement).localeCompare(movementChronologyKey(second.movement)));
    if (!records.length) {
      setStatus("No hay equipo en reporte de taller.", "warning");
      return;
    }
    const rows = records
      .map((record) => {
        const entry = record.movement;
        const returns = record.returns.length
          ? record.returns.map((row) => `${row.quantity} x ${displayDateTime(row.movement)}`).join(" / ")
          : "Pendiente";
        return `
          <tr>
            <td>${escapeHtml(displayDateTime(entry))}</td>
            <td>${escapeHtml(returns)}</td>
            <td>${escapeHtml(entry.quantity)}</td>
            <td>${escapeHtml(record.remainingQuantity > 0 ? `En taller: ${record.remainingQuantity}` : "Devuelto")}</td>
            <td>${escapeHtml(movementItemName(entry))}</td>
            <td>${escapeHtml(entry.repair || "")}</td>
            <td>${escapeHtml(entry.sparePart || "")}</td>
            <td>${escapeHtml(entry.responsible || "")}</td>
          </tr>
        `;
      })
      .join("");
    const firstSigned = records
      .map((record) => record.movement)
      .find((entry) => entry.warehouseSignature || entry.workshopSignature);
    const signatureHtml = firstSigned
      ? `
        <div class="signatures">
          <div class="signature">
            ${firstSigned.warehouseSignature ? `<img src="${firstSigned.warehouseSignature}" alt="Firma responsable de bodega" style="max-width:220px;max-height:90px;display:block;margin:0 auto 8px;" />` : ""}
            Responsable de bodega
          </div>
          <div class="signature">
            ${firstSigned.workshopSignature ? `<img src="${firstSigned.workshopSignature}" alt="Firma encargado de taller" style="max-width:220px;max-height:90px;display:block;margin:0 auto 8px;" />` : ""}
            Encargado de taller
          </div>
        </div>
      `
      : "";
    openPrintDocument(
      "Reporte taller",
      `
        <header>
          <div>
            <p>Live Productions</p>
            <h1>Reporte de equipo en taller</h1>
          </div>
          <div><p><strong>Generado:</strong> ${escapeHtml(dateTimeLocalValue().replace("T", " "))}</p></div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Sale de bodega / ingresa a taller</th>
              <th>Regresa a bodega</th>
              <th>Cantidad</th>
              <th>Estado</th>
              <th>Equipo</th>
              <th>Qué tiene malo</th>
              <th>Repuesto</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${signatureHtml}
      `
    );
  }

  function printRentalReport() {
    const records = inventoryLifecycle().rental
      .slice()
      .sort((first, second) => movementChronologyKey(first.movement).localeCompare(movementChronologyKey(second.movement)));
    if (!records.length) {
      setStatus("No hay rentas para generar el resumen.", "warning");
      return;
    }
    const rows = records
      .map((record) => {
        const entry = record.movement;
        const returns = record.returns.length
          ? record.returns.map((row) => `${row.quantity} x ${displayDateTime(row.movement)}`).join(" / ")
          : "Pendiente";
        return `
          <tr>
            <td>${escapeHtml(entry.reference || "Sin cliente")}</td>
            <td>${escapeHtml(entry.description || movementItemName(entry))}</td>
            <td>${escapeHtml(entry.quantity)}</td>
            <td>${escapeHtml(entry.rentalDays || 1)}</td>
            <td>${escapeHtml(displayDateTime(entry))}</td>
            <td>${escapeHtml(returns)}</td>
            <td>${escapeHtml(record.remainingQuantity > 0 ? `En renta: ${record.remainingQuantity}` : "Devuelto")}</td>
            <td>${escapeHtml(entry.responsible || "")}</td>
          </tr>
        `;
      })
      .join("");
    openPrintDocument(
      "Resumen de rentas",
      `
        <header>
          <div>
            <p>Live Productions</p>
            <h1>Resumen de rentas de equipo</h1>
          </div>
          <div><p><strong>Generado:</strong> ${escapeHtml(formatWarehouseDateTime(dateTimeLocalValue()))}</p></div>
        </header>
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descripción del equipo</th>
              <th>Cantidad</th>
              <th>Días</th>
              <th>Fecha y hora de renta</th>
              <th>Fecha y hora de devolución</th>
              <th>Estado</th>
              <th>Responsable</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
    );
  }

  function deleteMovement(id) {
    const movement = state.movements.find((entry) => entry.id === id);
    if (!movement) return;
    const ok = window.confirm("¿Eliminar esta bitácora? El inventario se recalculará automáticamente.");
    if (!ok) return;

    if (movement.type === "ajuste" && movement.previousQuantity !== null) {
      const item = itemById(movement.itemId);
      if (item) {
        const stats = statsForItem(item);
        item.quantity = movement.previousQuantity + stats.reserved;
      }
    }
    state.movements = state.movements.filter((entry) => entry.id !== id);
    scheduleSave();
    renderAll();
    setStatus("Bitácora eliminada.", "success");
  }

  function exportBackup() {
    const payload = { exportedAt: new Date().toISOString(), state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventario-bodega-live-productions-${todayInputValue()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const imported = normalizeState(payload.state || payload);
      if (!imported.items.length) throw new Error("El archivo no tiene inventario.");
      state = imported;
      await saveState();
      renderAll();
      setStatus("Respaldo importado correctamente.", "success");
    } catch (error) {
      setStatus(`No se pudo importar el respaldo: ${error.message}`, "warning");
    } finally {
      elements.importInput.value = "";
    }
  }

  async function resetSeed() {
    const ok = window.confirm("¿Restaurar el inventario inicial del libro? Esto reemplaza movimientos y ediciones actuales.");
    if (!ok) return;
    try {
      if (isHttpPage()) {
        const response = await fetch(`${API_PATH}/restaurar`, {
          method: "POST",
          credentials: "same-origin"
        });
        if (!response.ok) throw new Error("No se pudo restaurar en el servidor");
        const payload = await response.json();
        state = normalizeState(payload.state);
        persistenceMode = "server";
      } else {
        state = seedState();
      }
      saveLocalState();
      renderAll();
      setStatus("Inventario restaurado desde el libro inicial.", "success");
    } catch (error) {
      setStatus(`No se pudo restaurar el inventario: ${error.message}`, "warning");
    }
  }

  function bindEvents() {
    elements.addSubtitleButton.addEventListener("click", addSubtitle);
    elements.addItemButton.addEventListener("click", addNewItem);
    elements.saveNowButton.addEventListener("click", () => saveState());
    elements.exportButton.addEventListener("click", exportBackup);
    elements.importInput.addEventListener("change", (event) => importBackup(event.target.files?.[0]));
    elements.resetSeedButton.addEventListener("click", resetSeed);
    elements.generateRentalPdfButton.addEventListener("click", generateRentalPdf);
    elements.printWorkshopReportButton.addEventListener("click", printWorkshopReport);
    elements.printRentalReportButton.addEventListener("click", printRentalReport);
    elements.clearRentalButton.addEventListener("click", () => {
      state.rentalDraft = [];
      scheduleSave();
      renderRentalDraft();
    });
    elements.addWorkshopDraftButton.addEventListener("click", addWorkshopDraftLine);
    elements.registerWorkshopDraftButton.addEventListener("click", registerWorkshopDraft);
    elements.clearWorkshopDraftButton.addEventListener("click", clearWorkshopDraft);

    elements.windowButtons.forEach((button) => {
      button.addEventListener("click", () => switchWindow(button.dataset.warehouseWindow));
    });

    [elements.search, elements.categoryFilter, elements.statusFilter].forEach((input) => {
      input.addEventListener("input", renderInventoryTable);
      input.addEventListener("change", renderInventoryTable);
    });
    elements.clearFiltersButton.addEventListener("click", () => {
      elements.search.value = "";
      elements.categoryFilter.value = "all";
      elements.statusFilter.value = "all";
      renderInventoryTable();
    });

    [elements.logSearch, elements.logTypeFilter].forEach((input) => {
      input.addEventListener("input", renderLog);
      input.addEventListener("change", renderLog);
    });

    elements.inventoryTable.addEventListener("change", (event) => {
      if (event.target.matches("[data-field]")) updateInlineField(event.target);
    });
    elements.inventoryTable.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "events") openDialog("events", button.dataset.itemId);
      if (button.dataset.action === "workshop") openDialog("workshop", button.dataset.itemId);
      if (button.dataset.action === "rental") openDialog("rental", button.dataset.itemId);
    });
    elements.eventsBoard.addEventListener("click", (event) => {
      const printButton = event.target.closest("[data-print-event]");
      if (printButton) printEventPdf(printButton.dataset.printEvent);
      const returnButton = event.target.closest("[data-return-event]");
      if (returnButton) openEventReturnDialog(returnButton.dataset.returnEvent);
    });
    elements.workshopBoard.addEventListener("click", (event) => {
      const button = event.target.closest("[data-workshop-return]");
      if (button) openDialog("workshopReturn", button.dataset.workshopReturn, button.dataset.relatedMovement);
    });
    elements.rentedBoard.addEventListener("click", (event) => {
      const button = event.target.closest("[data-rental-return]");
      if (button) openDialog("rentalReturn", button.dataset.rentalReturn, button.dataset.relatedMovement);
    });
    elements.rentalDraft.addEventListener("change", (event) => {
      if (event.target.matches("[data-rental-field]")) updateRentalDraftField(event.target);
    });
    elements.rentalDraft.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-rental-line]");
      if (button) removeRentalLine(button.dataset.removeRentalLine);
    });
    elements.workshopDraft.addEventListener("change", (event) => {
      if (event.target.matches("[data-workshop-field]")) updateWorkshopDraftField(event.target);
    });
    elements.workshopDraft.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-workshop-line]");
      if (button) removeWorkshopLine(button.dataset.removeWorkshopLine);
    });
    elements.logList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-movement]");
      if (button) deleteMovement(button.dataset.deleteMovement);
    });

    elements.root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-clear-signature]");
      if (button) clearSignature(button.dataset.clearSignature);
    });
    elements.dialogCloseButton.addEventListener("click", closeDialog);
    elements.dialogCancelButton.addEventListener("click", closeDialog);
    elements.dialogSaveButton.addEventListener("click", saveDialog);
  }

  function collectElements() {
    const root = document.querySelector("#warehouseModule");
    if (!root) return false;
    Object.assign(elements, {
      root,
      status: root.querySelector("#warehouseStatus"),
      summary: root.querySelector("#warehouseSummary"),
      saveNowButton: root.querySelector("#warehouseSaveNowButton"),
      exportButton: root.querySelector("#warehouseExportButton"),
      importInput: root.querySelector("#warehouseImportInput"),
      resetSeedButton: root.querySelector("#warehouseResetSeedButton"),
      windowButtons: [...root.querySelectorAll("[data-warehouse-window]")],
      views: [...root.querySelectorAll("[data-warehouse-view]")],
      newName: root.querySelector("#warehouseNewName"),
      newSubtitle: root.querySelector("#warehouseNewSubtitle"),
      newCategory: root.querySelector("#warehouseNewCategory"),
      newQuantity: root.querySelector("#warehouseNewQuantity"),
      newNotes: root.querySelector("#warehouseNewNotes"),
      addItemButton: root.querySelector("#warehouseAddItemButton"),
      addSubtitleButton: root.querySelector("#warehouseAddSubtitleButton"),
      search: root.querySelector("#warehouseSearch"),
      categoryFilter: root.querySelector("#warehouseCategoryFilter"),
      statusFilter: root.querySelector("#warehouseStatusFilter"),
      clearFiltersButton: root.querySelector("#warehouseClearFiltersButton"),
      inventoryTable: root.querySelector("#warehouseInventoryTable"),
      eventsBoard: root.querySelector("#warehouseEventsBoard"),
      workshopBoard: root.querySelector("#warehouseWorkshopBoard"),
      printWorkshopReportButton: root.querySelector("#warehousePrintWorkshopReportButton"),
      workshopBulkItem: root.querySelector("#warehouseWorkshopBulkItem"),
      workshopBulkQuantity: root.querySelector("#warehouseWorkshopBulkQuantity"),
      workshopBulkDateTime: root.querySelector("#warehouseWorkshopBulkDateTime"),
      workshopBulkWarehouseResponsible: root.querySelector("#warehouseWorkshopBulkWarehouseResponsible"),
      workshopBulkShopResponsible: root.querySelector("#warehouseWorkshopBulkShopResponsible"),
      workshopBulkRepair: root.querySelector("#warehouseWorkshopBulkRepair"),
      workshopBulkSparePart: root.querySelector("#warehouseWorkshopBulkSparePart"),
      workshopBulkNotes: root.querySelector("#warehouseWorkshopBulkNotes"),
      workshopDraft: root.querySelector("#warehouseWorkshopDraft"),
      addWorkshopDraftButton: root.querySelector("#warehouseAddWorkshopDraftButton"),
      registerWorkshopDraftButton: root.querySelector("#warehouseRegisterWorkshopDraftButton"),
      clearWorkshopDraftButton: root.querySelector("#warehouseClearWorkshopDraftButton"),
      workshopWarehouseSignature: root.querySelector("#warehouseWorkshopWarehouseSignature"),
      workshopShopSignature: root.querySelector("#warehouseWorkshopShopSignature"),
      rentalClient: root.querySelector("#warehouseRentalClient"),
      rentalResponsible: root.querySelector("#warehouseRentalResponsible"),
      rentalDate: root.querySelector("#warehouseRentalDate"),
      rentalDays: root.querySelector("#warehouseRentalDays"),
      rentalNotes: root.querySelector("#warehouseRentalNotes"),
      rentalDraft: root.querySelector("#warehouseRentalDraft"),
      rentedBoard: root.querySelector("#warehouseRentedBoard"),
      generateRentalPdfButton: root.querySelector("#warehouseGenerateRentalPdfButton"),
      printRentalReportButton: root.querySelector("#warehousePrintRentalReportButton"),
      clearRentalButton: root.querySelector("#warehouseClearRentalButton"),
      logSearch: root.querySelector("#warehouseLogSearch"),
      logTypeFilter: root.querySelector("#warehouseLogTypeFilter"),
      logList: root.querySelector("#warehouseLogList"),
      dialog: root.querySelector("#warehouseActionDialog"),
      dialogTitle: root.querySelector("#warehouseDialogTitle"),
      dialogBody: root.querySelector("#warehouseDialogBody"),
      dialogCloseButton: root.querySelector("#warehouseDialogCloseButton"),
      dialogCancelButton: root.querySelector("#warehouseDialogCancelButton"),
      dialogSaveButton: root.querySelector("#warehouseDialogSaveButton")
    });
    return Object.values(elements).every((value) => (Array.isArray(value) ? value.length : Boolean(value)));
  }

  async function initWarehouse() {
    if (!(await ensureWarehouseMarkup())) return;
    if (!collectElements()) return;
    elements.rentalDate.value = dateTimeLocalValue();
    elements.workshopBulkDateTime.value = dateTimeLocalValue();
    initSignaturePad("workshopWarehouse", elements.workshopWarehouseSignature);
    initSignaturePad("workshopShop", elements.workshopShopSignature);
    bindEvents();
    setStatus("Esperando acceso al inventario...", "neutral");
    await waitForAuthenticatedApp();
    await loadState();
    renderAll();
    switchWindow(activeWindow);
  }

  document.addEventListener("live:warehouse-server-updated", (event) => {
    if (!event.detail?.state?.items?.length) return;
    state = normalizeState(event.detail.state);
    persistenceMode = "server";
    saveLocalState();
    if (elements.root) {
      renderAll();
      setStatus("Cuadro recibido desde Requerimiento de equipo.", "success");
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWarehouse);
  } else {
    initWarehouse();
  }
})();
