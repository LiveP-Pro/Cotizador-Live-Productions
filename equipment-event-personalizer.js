(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentEventPersonalizer = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  const PAGE_SIZE = 75;
  const instances = new WeakMap();
  let sequence = 0;
  const text = (value) => value === undefined || value === null ? "" : String(value);
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const escape = (value) => text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  // Do not remove punctuation or model numbers: similar names can be different equipment.
  const normalize = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  const meaningful = (value) => text(value).trim() !== "";
  const cellLabel = (index) => {
    let value = index + 1, result = "";
    while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
    return result;
  };

  function readTsv(source) {
    const input = text(source).replace(/^\uFEFF/, "");
    if (!input) return [];
    const matrix = [];
    let cells = [], value = "", quoted = false, afterQuote = false;
    function endCell() { cells.push(value); value = ""; afterQuote = false; }
    function endRow() { endCell(); matrix.push(cells); cells = []; }
    for (let index = 0; index < input.length; index += 1) {
      const character = input[index];
      if (quoted) {
        if (character === '"' && input[index + 1] === '"') { value += '"'; index += 1; }
        else if (character === '"') { quoted = false; afterQuote = true; }
        else value += character;
      } else if (character === '"' && !value && !afterQuote) quoted = true;
      else if (character === "\t") endCell();
      else if (character === "\r" || character === "\n") {
        if (character === "\r" && input[index + 1] === "\n") index += 1;
        endRow();
      } else {
        if (afterQuote && !/\s/.test(character)) throw new Error(`Fila ${matrix.length + 1}: hay texto fuera de una celda entre comillas. Revise el contenido pegado.`);
        value += character;
      }
    }
    if (quoted) throw new Error(`Fila ${matrix.length + 1}: falta cerrar una celda entre comillas. No se cargó ninguna fila.`);
    // A clipboard terminal newline is a separator, not an extra source row.
    if (value !== "" || cells.length || !/[\r\n]$/.test(input)) endRow();
    return matrix;
  }

  const fieldNames = {
    quantity: new Set(["cantidad", "cant", "cant.", "qty", "quantity", "unidades"]),
    description: new Set(["descripcion", "descripcion de equipo", "descripcion del equipo", "equipo", "articulo", "nombre del equipo", "description"]),
    category: new Set(["categoria", "category", "grupo", "tipo de equipo"]),
    notes: new Set(["nota", "notas", "observacion", "observaciones", "comentarios", "notes"])
  };

  function headerLayout(cells) {
    const layout = {};
    cells.forEach((value, index) => {
      for (const [field, names] of Object.entries(fieldNames)) if (names.has(normalize(value)) && layout[field] === undefined) layout[field] = index;
    });
    return layout.quantity !== undefined && layout.description !== undefined ? layout : null;
  }

  function parseQuantity(value) {
    const raw = text(value).trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return null;
    const parsed = Number(raw.replace(",", "."));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function sourceExtras(cells, layout, labels) {
    const mapped = new Set(Object.values(layout));
    return cells.flatMap((value, index) => !mapped.has(index) && meaningful(value) ? [{ column: index, label: text(labels?.[index]) || `Columna ${cellLabel(index)}`, value }] : []);
  }

  function parseClipboard(source) {
    const matrix = readTsv(source);
    const rows = [];
    let layout = { quantity: 0, description: 1, category: 2, notes: 3 }, labels = [];
    matrix.forEach((cells, index) => {
      const detected = headerLayout(cells);
      const base = { id: `clipboard-row-${index + 1}`, sourceRow: index + 1, cells: [...cells], layout: { ...layout }, quantity: "", description: "", category: "", notes: "", warehouseInventoryId: "", procurementChoice: "", itemType: "equipo", extras: [] };
      if (detected) {
        layout = detected; labels = [...cells];
        rows.push({ ...base, layout: { ...layout }, kind: "header", description: cells.filter(meaningful).join(" · ") });
        return;
      }
      const nonempty = cells.filter(meaningful);
      if (!nonempty.length) { rows.push({ ...base, kind: "blank" }); return; }
      const quantity = cells[layout.quantity] ?? "";
      const description = cells[layout.description] ?? "";
      const category = cells[layout.category] ?? "";
      const notes = cells[layout.notes] ?? "";
      const extras = sourceExtras(cells, layout, labels);
      // A single text cell in a quantity column is a source heading or note.
      if (nonempty.length === 1 && parseQuantity(nonempty[0]) === null && !meaningful(description)) {
        const content = nonempty[0];
        const isNote = /^(?:nota|observaci[oó]n|importante|recordar)\s*[:.-]/i.test(content.trim());
        rows.push({ ...base, kind: isNote ? "note" : "category", description: content, extras });
      } else {
        rows.push({ ...base, kind: "item", quantity, description, category, notes, extras });
      }
    });
    return { format: "clipboard-tsv", rows, sourceRowCount: matrix.length, sourceCellCount: matrix.reduce((sum, row) => sum + row.filter(meaningful).length, 0) };
  }

  function inventoryRecords(inventory) {
    const seen = new Set();
    return (Array.isArray(inventory) ? inventory : []).flatMap((record) => {
      const id = text(record?.id || record?.warehouseInventoryId);
      const name = text(record?.name || record?.description || record?.item?.name);
      if (!id || !name.trim() || seen.has(id)) return [];
      seen.add(id);
      return [{ ...record, id, name, category: text(record.category || record.inventoryCategory || record.item?.category),
        itemType: record.itemType === "consumible" || record.consumable === true || record.item?.itemType === "consumible" ? "consumible" : "equipo" }];
    });
  }

  function inventoryIndex(inventory) {
    if (inventory?.byName instanceof Map) return inventory;
    const byName = new Map();
    for (const record of inventoryRecords(inventory)) {
      const name = normalize(record.name);
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(record);
    }
    return { byName };
  }

  function resolveRow(row, inventory) {
    const matches = inventoryIndex(inventory).byName.get(normalize(row.description)) || [];
    const selected = row.warehouseInventoryId && matches.find((record) => record.id === text(row.warehouseInventoryId));
    if (selected) return { status: "recognized", record: selected, matches };
    if (row.warehouseInventoryId) return { status: "stale", matches };
    if (matches.length === 1) return { status: "recognized", record: matches[0], matches };
    if (matches.length > 1) return { status: "ambiguous", matches };
    return { status: ["rent", "purchase"].includes(row.procurementChoice) ? "procurement" : "unknown", matches };
  }

  function dateMillis(value) {
    const input = text(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return NaN;
    const result = new Date(input);
    const parts = input.match(/\d+/g).map(Number);
    if (result.getFullYear() !== parts[0] || result.getMonth() + 1 !== parts[1] || result.getDate() !== parts[2]
      || result.getHours() !== parts[3] || result.getMinutes() !== parts[4]) return NaN;
    return result.getTime();
  }

  function serviceGroups(groups) {
    const seen = new Set();
    return (Array.isArray(groups) ? groups : []).flatMap((group) => {
      const id = text(group?.id).trim(), label = text(group?.label).trim();
      if (!id || !label || seen.has(id)) return [];
      seen.add(id);
      return [{ id, label }];
    });
  }

  function validateDraft(draft, inventory, groups = []) {
    const errors = [];
    const indexedInventory = inventoryIndex(inventory);
    const metadata = draft?.metadata || draft || {};
    for (const [field, label] of [["place", "la ubicación"], ["type", "el tipo de evento"]]) {
      if (!meaningful(metadata[field])) errors.push({ field, message: `Escriba ${label}.` });
    }
    if (draft?.usageMode && !["once", "service"].includes(draft.usageMode)) errors.push({ field: "usageMode", message: "Elija Usar una vez o Guardar también como nuevo tipo de servicio." });
    if (draft?.usageMode === "service") {
      if (!meaningful(draft.serviceName)) errors.push({ field: "serviceName", message: "Escriba el nombre del nuevo tipo de servicio para encontrarlo y reutilizarlo." });
      else if (text(draft.serviceName).trim().length > 240) errors.push({ field: "serviceName", message: "El nombre del nuevo servicio debe tener como máximo 240 caracteres." });
      if (!serviceGroups(groups).some((group) => group.id === text(draft.serviceGroupId))) errors.push({ field: "serviceGroupId", message: "Seleccione una categoría vigente para el nuevo tipo de servicio." });
    }
    const times = [["setupAt", "montaje"], ["startAt", "inicio del evento"], ["endAt", "finalización del evento"], ["equipmentInAt", "regreso a bodega"]];
    times.forEach(([field, label]) => { if (!Number.isFinite(dateMillis(metadata[field]))) errors.push({ field, message: `Indique una fecha y hora válida de ${label}.` }); });
    for (let index = 1; index < times.length; index += 1) {
      const [previous] = times[index - 1], [next, label] = times[index];
      if (dateMillis(metadata[previous]) > dateMillis(metadata[next])) errors.push({ field: next, message: `La fecha de ${label} no puede ser anterior a ${times[index - 1][1]}.` });
    }
    const rows = Array.isArray(draft?.rows) ? draft.rows : [];
    if (!rows.some((row) => row.kind === "item")) errors.push({ field: "rows", message: "Agregue al menos una fila de equipo. La cantidad 0 también es válida." });
    rows.forEach((row, index) => {
      const prefix = `Fila ${row.sourceRow || index + 1}: `;
      if (row.kind !== "item") return;
      if (parseQuantity(row.quantity) === null) errors.push({ rowId: row.id, field: "quantity", message: `${prefix}indique una cantidad numérica mayor o igual a 0.` });
      if (!meaningful(row.description)) errors.push({ rowId: row.id, field: "description", message: `${prefix}escriba la descripción del equipo.` });
      if (!meaningful(row.description)) return;
      const resolved = resolveRow(row, indexedInventory);
      if (resolved.status === "ambiguous" || resolved.status === "stale") errors.push({ rowId: row.id, field: "warehouseInventoryId", message: `${prefix}seleccione el registro exacto del inventario; hay coincidencias que requieren revisión.` });
      if (resolved.status === "unknown") errors.push({ rowId: row.id, field: "procurementChoice", message: `${prefix}el equipo no figura en el inventario. Elija Rentar o Comprar.` });
      if (!resolved.record && row.itemType === "consumible" && row.procurementChoice === "rent") errors.push({ rowId: row.id, field: "procurementChoice", message: `${prefix}los consumibles faltantes deben incluirse en Compra. Seleccione Comprar.` });
    });
    return errors;
  }

  function rowSource(row) {
    return { sourceRow: row.sourceRow, cells: (row.cells || []).map((value, column) => ({ column, value: text(value) })) };
  }

  function buildEvent(draft, inventory, groups = []) {
    const indexedInventory = inventoryIndex(inventory);
    const errors = validateDraft(draft, indexedInventory, groups);
    if (errors.length) { const error = new Error(errors[0].message); error.validationErrors = errors; throw error; }
    const metadata = draft.metadata || draft;
    const sections = [];
    let activeCategory = "Equipo personalizado", section = null, ordinal = 0;
    function nextSection(title) {
      section = { id: `personalized-section-${++ordinal}`, title, items: [], rows: [] };
      sections.push(section);
      return section;
    }
    for (const row of draft.rows) {
      if (row.kind === "category") { activeCategory = text(row.description).trim() || "Equipo personalizado"; nextSection(activeCategory); }
      if (row.kind === "item" && meaningful(row.category) && normalize(row.category) !== normalize(section?.title)) nextSection(text(row.category).trim());
      if (!section) nextSection(activeCategory);
      const original = rowSource(row);
      if (row.kind !== "item") {
        section.rows.push({ ...original, type: row.kind === "blank" ? "blank" : row.kind, description: text(row.description), ...(meaningful(row.notes) ? { notes: [text(row.notes)] } : {}) });
        continue;
      }
      const resolved = resolveRow(row, indexedInventory);
      const sourceItemIndex = section.items.length;
      const extraNotes = (row.extras || []).map((entry) => `${entry.label}: ${entry.value}`);
      const notes = [...(meaningful(row.notes) ? [text(row.notes)] : []), ...extraNotes];
      const item = { id: row.id, sourceItemIndex, quantity: parseQuantity(row.quantity), description: text(row.description),
        itemType: resolved.record?.itemType || row.itemType || "equipo", inventoryCategory: resolved.record?.category || text(row.category) || section.title,
        ...(resolved.record ? { warehouseInventoryId: resolved.record.id } : { procurementChoice: row.procurementChoice }),
        ...(notes.length ? { notes } : {}) };
      section.items.push(item);
      section.rows.push({ ...original, type: "item", sourceItemIndex, ...(notes.length ? { notes } : {}) });
    }
    const id = text(draft.id) || `personalized-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
    const event = { id,
      place: text(metadata.place).trim(), name: text(metadata.type).trim() || text(metadata.place).trim(), type: text(metadata.type).trim(),
      setupAt: metadata.setupAt, startAt: metadata.startAt, endAt: metadata.endAt, date: metadata.startAt.slice(0, 10), equipmentInAt: metadata.equipmentInAt,
      notes: text(metadata.notes), serviceName: "Cuadro personalizado", sections,
      source: { format: "clipboard-tsv", sourceRowCount: draft.sourceRowCount || 0, sourceCellCount: draft.sourceCellCount || 0, rows: copy(draft.rows) } };
    if (draft.usageMode === "service") event.serviceTemplate = {
      id: `servicio-${id}`, name: text(draft.serviceName).trim(), groupId: text(draft.serviceGroupId),
      mainSections: copy(sections), source: copy(event.source), notes: event.notes
    };
    return event;
  }

  function emptyDraft() {
    return { id: `personalized-${Date.now().toString(36)}-${(++sequence).toString(36)}`, metadata: { place: "", type: "", setupAt: "", startAt: "", endAt: "", equipmentInAt: "", notes: "" },
      usageMode: "once", serviceName: "", serviceNameTouched: false, serviceGroupId: "", rows: [], sourceRowCount: 0, sourceCellCount: 0 };
  }

  function createSession(options = {}) {
    let draft = emptyDraft(), open = false, busy = false, checked = false;
    const inventory = () => typeof options.inventory === "function" ? options.inventory() : options.inventory || [];
    const groups = () => serviceGroups(typeof options.serviceGroups === "function" ? options.serviceGroups() : options.serviceGroups || []);
    return {
      get draft() { return draft; }, get isOpen() { return open; }, get busy() { return busy; }, get reviewed() { return checked; },
      open() { if (busy) return false; draft = emptyDraft(); checked = false; open = true; return true; },
      discard() { if (busy) return false; draft = emptyDraft(); checked = false; open = false; return true; },
      changed() { checked = false; },
      paste(source) { const parsed = parseClipboard(source); draft.rows = parsed.rows; draft.sourceRowCount = parsed.sourceRowCount; draft.sourceCellCount = parsed.sourceCellCount; checked = false; return parsed; },
      removeRow(id) { if (busy) return false; draft.rows = draft.rows.filter((row) => row.id !== id); checked = false; return true; },
      review() { const errors = validateDraft(draft, inventory(), groups()); checked = !errors.length; return errors; },
      async commit() {
        if (busy) throw new Error("El evento se está guardando. Espere la confirmación.");
        if (!open) throw new Error("Abra el cuadro personalizado antes de cargarlo.");
        if (!checked) throw new Error("Revise las filas y la disponibilidad antes de cargar el evento.");
        const event = buildEvent(draft, inventory(), groups());
        if (typeof options.onCommit !== "function") throw new Error("No está disponible la conexión para guardar el evento. El borrador se conserva.");
        busy = true;
        try {
          const result = await options.onCommit(copy(event));
          open = false; checked = false; draft = emptyDraft();
          return { event, result };
        } catch (error) { checked = false; throw error; }
        finally { busy = false; }
      }
    };
  }

  function renderMarkup() {
    const fields = [["place", "Ubicación del evento", "text"], ["type", "Tipo de evento", "text"],
      ["setupAt", "Fecha y hora del montaje", "datetime-local"], ["startAt", "Fecha y hora del evento", "datetime-local"],
      ["endAt", "Fecha y hora de finalización", "datetime-local"], ["equipmentInAt", "Regreso previsto a bodega", "datetime-local"]];
    return `<div class="equipment-personalizer-shell"><header class="equipment-personalizer-header"><div><p class="equipment-personalizer-eyebrow">Evento personalizado</p><h2 id="equipmentPersonalizerTitle">Personaliza tu Cuadro de Evento</h2></div><button type="button" class="equipment-personalizer-close" data-personalizer-action="close" aria-label="Cerrar sin guardar">×</button></header>
      <div class="equipment-personalizer-body"><ol class="equipment-personalizer-steps" aria-label="Pasos del evento"><li>1. Armar evento</li><li>2. Revisar equipo</li><li>3. Cargar y reservar</li></ol>
      <section aria-labelledby="equipmentPersonalizerMetadataHeading"><h3 id="equipmentPersonalizerMetadataHeading">Datos del evento</h3><div class="equipment-personalizer-fields">${fields.map(([field, label, type]) => `<label>${label}<input id="equipmentPersonalizer-${field}" data-personalizer-metadata="${field}" type="${type}" required /></label>`).join("")}</div><label class="equipment-personalizer-notes">Observaciones del evento<textarea id="equipmentPersonalizer-notes" data-personalizer-metadata="notes" rows="2"></textarea></label><p class="equipment-personalizer-hint">El equipo queda ocupado desde el montaje hasta su regreso a bodega. Incluya desmontaje y transporte en ese horario.</p></section>
      <fieldset class="equipment-personalizer-usage"><legend>¿Cómo quieres usar este cuadro?</legend><div class="equipment-personalizer-usage-options"><label><input id="equipmentPersonalizerUsageOnce" type="radio" name="equipmentPersonalizerUsage" value="once" data-personalizer-usage-mode="once" checked><span><strong>Usar una vez</strong><small>Cargar únicamente este evento.</small></span></label><label><input id="equipmentPersonalizerUsageService" type="radio" name="equipmentPersonalizerUsage" value="service" data-personalizer-usage-mode="service"><span><strong>Guardar también como nuevo tipo de servicio</strong><small>Reutilizar este cuadro en futuros eventos.</small></span></label></div><div id="equipmentPersonalizerServiceFields" class="equipment-personalizer-service-fields" hidden><label>Nombre del nuevo servicio<input id="equipmentPersonalizerServiceName" type="text" maxlength="240" data-personalizer-template-field="name" placeholder="Ej. Producción personalizada para evento corporativo"></label><label>Categoría del nuevo servicio<select id="equipmentPersonalizerServiceGroup" data-personalizer-template-field="groupId"><option value="">Seleccione una categoría</option></select></label><p class="equipment-personalizer-permanent-hint">Al confirmar se guardará este cuadro de forma permanente en Tipo de Servicio. No se guardará ningún cambio al cerrar o cancelar.</p></div></fieldset>
      <section aria-labelledby="equipmentPersonalizerPasteHeading"><h3 id="equipmentPersonalizerPasteHeading">Pega tu cuadro de Excel</h3><p class="equipment-personalizer-hint">Copia las celdas y pégalas aquí. Usa encabezados Cantidad, Descripción, Categoría y Observaciones; también puedes pegar cantidad y descripción sin encabezados. Se conservarán las columnas adicionales, las notas y las cantidades en 0.</p><textarea id="equipmentPersonalizerClipboard" class="equipment-personalizer-clipboard" rows="5" spellcheck="false" aria-label="Pegar celdas de Excel" placeholder="Cantidad&#9;Descripción&#9;Categoría&#9;Observaciones"></textarea><div class="equipment-personalizer-inline-actions"><button type="button" data-personalizer-action="parse">Preparar cuadro pegado</button><button type="button" class="equipment-personalizer-secondary" data-personalizer-action="add">Agregar fila</button></div></section>
      <section aria-labelledby="equipmentPersonalizerRowsHeading"><h3 id="equipmentPersonalizerRowsHeading">Revisión del cuadro</h3><p id="equipmentPersonalizerCounts" role="status" aria-live="polite">Todavía no hay filas.</p><div id="equipmentPersonalizerRows"></div><div id="equipmentPersonalizerPagination" class="equipment-personalizer-pagination"></div></section>
      <div id="equipmentPersonalizerStatus" class="equipment-personalizer-status" role="status" aria-live="polite"></div><div id="equipmentPersonalizerErrors" class="equipment-personalizer-errors" role="alert" hidden></div><div id="equipmentPersonalizerReview" class="equipment-personalizer-review" hidden></div></div>
      <footer class="equipment-personalizer-footer"><p>Al cerrar o cancelar, se descarta este borrador. El inventario cambia únicamente al confirmar las operaciones correspondientes.</p><div><button type="button" class="equipment-personalizer-secondary" data-personalizer-action="close">Cancelar</button><button type="button" data-personalizer-action="review" id="equipmentPersonalizerReviewButton">Revisar disponibilidad</button><button type="button" data-personalizer-action="commit" id="equipmentPersonalizerCommitButton" disabled>Cargar evento</button></div></footer></div>`;
  }

  function renderRow(row, index, inventory) {
    const isItem = row.kind === "item";
    const resolved = isItem ? resolveRow(row, inventory) : null;
    const kindOptions = [["item", "Equipo"], ["category", "Categoría"], ["note", "Nota"], ["header", "Encabezado"], ["blank", "Separador"]]
      .map(([value, name]) => `<option value="${value}"${row.kind === value ? " selected" : ""}>${name}</option>`).join("");
    let inventoryMarkup = "";
    if (resolved?.record) inventoryMarkup = `<span class="equipment-personalizer-match">En inventario · ${escape(resolved.record.category || "Sin categoría")} · ${resolved.record.itemType === "consumible" ? "Consumible" : "Equipo"}</span>`;
    else if (resolved?.status === "ambiguous" || resolved?.status === "stale") {
      inventoryMarkup = `<label class="equipment-personalizer-row-warning">Elige el registro exacto<select data-personalizer-field="warehouseInventoryId"><option value="">Seleccionar inventario</option>${resolved.matches.map((record) => `<option value="${escape(record.id)}"${record.id === row.warehouseInventoryId ? " selected" : ""}>${escape(record.name)} · ${escape(record.category)} · ID ${escape(record.id)}</option>`).join("")}</select></label>`;
    } else if (isItem) {
      inventoryMarkup = `<label class="equipment-personalizer-row-warning">No figura en inventario<select data-personalizer-field="procurementChoice"><option value="">¿Qué acción quieres?</option><option value="rent"${row.procurementChoice === "rent" ? " selected" : ""}${row.itemType === "consumible" ? " disabled" : ""}>Rentar</option><option value="purchase"${row.procurementChoice === "purchase" ? " selected" : ""}>Comprar</option></select></label><label>Tipo<select data-personalizer-field="itemType"><option value="equipo"${row.itemType !== "consumible" ? " selected" : ""}>Equipo reutilizable</option><option value="consumible"${row.itemType === "consumible" ? " selected" : ""}>Consumible</option></select></label>`;
    }
    const extras = (row.extras || []).map((entry) => `<span><strong>${escape(entry.label)}:</strong> ${escape(entry.value)}</span>`).join("");
    const original = (row.cells || []).filter(meaningful).length > 0 ? `<details class="equipment-personalizer-source"><summary>Ver celdas originales</summary><dl>${(row.cells || []).map((value, column) => `<dt>${cellLabel(column)}${row.sourceRow || index + 1}</dt><dd>${escape(value)}</dd>`).join("")}</dl></details>` : "";
    return `<tr data-personalizer-row="${escape(row.id)}"><th scope="row">${row.sourceRow || index + 1}<select aria-label="Tipo de fila ${row.sourceRow || index + 1}" data-personalizer-field="kind">${kindOptions}</select></th><td><input aria-label="Cantidad fila ${row.sourceRow || index + 1}" data-personalizer-field="quantity" inputmode="decimal" value="${escape(row.quantity)}"${isItem ? "" : " disabled"} /></td><td><textarea aria-label="Descripción fila ${row.sourceRow || index + 1}" data-personalizer-field="description" rows="2">${escape(row.description)}</textarea>${original}</td><td><input aria-label="Categoría fila ${row.sourceRow || index + 1}" data-personalizer-field="category" value="${escape(row.category)}"${isItem ? "" : " disabled"} /></td><td><textarea aria-label="Observaciones fila ${row.sourceRow || index + 1}" data-personalizer-field="notes" rows="2">${escape(row.notes)}</textarea>${extras ? `<div class="equipment-personalizer-extra-cells">${extras}</div>` : ""}</td><td class="equipment-personalizer-resolution">${inventoryMarkup || '<span class="equipment-personalizer-muted">Se conserva en el cuadro</span>'}</td><td><button type="button" class="equipment-personalizer-remove" data-personalizer-action="remove" aria-label="Eliminar fila ${row.sourceRow || index + 1}">×</button></td></tr>`;
  }

  function renderAvailability(plan, event) {
    if (!plan || !Array.isArray(plan.rows)) throw new Error("No se recibió un cálculo válido de disponibilidad. Vuelva a revisar antes de cargar.");
    const items = (event.sections || []).flatMap((section) => section.items || []);
    const identity = (row) => row.warehouseInventoryId ? `inventory:${row.warehouseInventoryId}`
      : JSON.stringify(["external", normalize(row.description), text(row.procurementChoice), text(row.itemType || "equipo"), normalize(row.inventoryCategory || row.category)]);
    const expected = new Set(items.map(identity)), received = new Set(plan.rows.map(identity));
    if ([...expected].some((key) => !received.has(key))) throw new Error("El cálculo no incluye todo el equipo del cuadro. Ninguna fila se cargó; vuelva a revisar.");
    const rows = plan.rows.filter((row) => expected.has(identity(row)));
    for (const row of rows) {
      if ([row.required, row.available, row.missing, row.capacity ?? row.available].some((value) => typeof value !== "number" || !Number.isFinite(value) || value < 0) || !meaningful(row.action)) {
        throw new Error("El cálculo de un equipo está incompleto. Vuelva a revisar antes de cargar.");
      }
    }
    const formatDate = (value) => text(value).replace("T", " ") || "Horario pendiente";
    const actionText = (row) => row.action === "RENTA" ? `Rentar ${row.missing}` : row.action === "COMPRA" ? `Comprar ${row.missing}`
      : row.action === "TRASIEGO" ? "Trasiego confirmado" : row.action === "DISPONIBLE" ? "Disponible" : "Revisar pendientes";
    const rentalCount = rows.filter((row) => row.missing > 0 && row.action === "RENTA").length;
    const purchaseCount = rows.filter((row) => row.missing > 0 && row.action === "COMPRA").length;
    return `<div class="equipment-personalizer-availability"><h4>Disponibilidad con los eventos guardados</h4><p>${rows.length} equipos revisados: ${rentalCount} con faltante para renta y ${purchaseCount} para compra. Este cálculo todavía no reserva ni guarda el evento.</p><p class="equipment-personalizer-hint">Necesario es el máximo simultáneo de equipo reutilizable o el total de consumibles. La capacidad considera el equipo reservado, despachado o en taller; una sugerencia de trasiego requiere confirmación.</p><div class="equipment-personalizer-availability-scroll"><table class="equipment-personalizer-availability-table"><thead><tr><th>Equipo</th><th>Necesario</th><th>Disponible en bodega</th><th>Capacidad para cubrir eventos</th><th>Faltante</th><th>Acción recomendada</th></tr></thead><tbody>${rows.map((row) => {
      const reservations = Array.isArray(row.reservations) ? row.reservations : Array.isArray(row.events) ? row.events : [];
      const events = reservations.length ? `<details><summary>Eventos considerados (${reservations.length})</summary><ul>${reservations.map((reservation) => `<li><strong>${escape(reservation.name || reservation.eventId || "Evento")}</strong>${reservation.eventId === event.id ? " · Este cuadro" : ""}${reservation.place ? ` · ${escape(reservation.place)}` : ""}<br>${escape(formatDate(reservation.setupAt))} → ${escape(formatDate(reservation.equipmentInAt))} · ${escape(reservation.quantity ?? 0)} unidades${reservation.pendingLogistics ? " · Horario pendiente" : ""}</li>`).join("")}</ul></details>` : "";
      const transfers = Array.isArray(row.transfers) && row.transfers.length ? `<p class="equipment-personalizer-transfer-hint">Trasiego por confirmar: ${row.transfers.map((entry) => `${escape(entry.fromName || entry.fromEventId)} → ${escape(entry.toName || entry.toEventId)} (${escape(entry.quantity)} unidades)`).join("; ")}.</p>` : "";
      return `<tr><td><strong>${escape(row.description)}</strong>${row.category ? `<small>${escape(row.category)} · ${row.itemType === "consumible" ? "Consumible" : "Equipo"}</small>` : ""}${events}</td><td>${escape(row.required)}</td><td>${escape(row.available)}</td><td>${escape(row.capacity ?? row.available)}</td><td class="${row.missing > 0 ? "equipment-personalizer-shortage" : ""}">${escape(row.missing)}</td><td><strong>${escape(actionText(row))}</strong>${transfers}${row.pendingLogistics ? '<p class="equipment-personalizer-row-warning">Hay eventos con horarios pendientes de completar.</p>' : ""}</td></tr>`;
    }).join("")}</tbody></table></div><p class="equipment-personalizer-hint">La disponibilidad se comprueba nuevamente al cargar para detectar cambios hechos por otros usuarios.</p></div>`;
  }

  function init(options = {}) {
    const doc = options.document || (typeof document === "undefined" ? null : document);
    if (!doc?.createElement || !doc.body) return null;
    if (instances.has(doc)) return instances.get(doc);
    const dialog = doc.createElement("dialog");
    dialog.id = "equipmentPersonalizerDialog";
    dialog.className = "equipment-personalizer-dialog";
    dialog.setAttribute("aria-labelledby", "equipmentPersonalizerTitle");
    dialog.innerHTML = renderMarkup();
    doc.body.appendChild(dialog);
    const get = (id) => doc.getElementById(id);
    const session = createSession(options);
    const inventory = () => typeof options.inventory === "function" ? options.inventory() : options.inventory || [];
    const groups = () => serviceGroups(typeof options.serviceGroups === "function" ? options.serviceGroups() : options.serviceGroups || []);
    let page = 0, busyOpening = false, destroyed = false, clipboardDirty = false, previewBusy = false, previewGeneration = 0;
    const status = (value) => { get("equipmentPersonalizerStatus").textContent = value; };
    function errors(entries) {
      const panel = get("equipmentPersonalizerErrors");
      panel.hidden = !entries.length;
      panel.innerHTML = entries.length ? `<p>${entries.length} ${entries.length === 1 ? "punto por revisar" : "puntos por revisar"}:</p><ul>${entries.map((entry) => `<li>${escape(entry.message || entry)}</li>`).join("")}</ul>` : "";
    }
    function changed() {
      previewGeneration += 1;
      session.changed(); get("equipmentPersonalizerCommitButton").disabled = true;
      get("equipmentPersonalizerReview").hidden = true;
    }
    function setBusy(busy, allowClose = false) {
      dialog.setAttribute("aria-busy", busy ? "true" : "false");
      dialog.querySelectorAll("button,input,textarea,select").forEach((element) => {
        if (busy) { element.dataset.personalizerWasDisabled = element.disabled ? "true" : "false"; element.disabled = !(allowClose && element.dataset.personalizerAction === "close"); }
        else { element.disabled = element.dataset.personalizerWasDisabled === "true"; delete element.dataset.personalizerWasDisabled; }
      });
      if (!busy) get("equipmentPersonalizerCommitButton").disabled = !session.reviewed;
    }
    function renderRows() {
      const { rows } = session.draft;
      const maxPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
      page = Math.max(0, Math.min(page, maxPage));
      const start = page * PAGE_SIZE, visible = rows.slice(start, start + PAGE_SIZE);
      const counts = { items: 0, zero: 0, preserved: 0, unknown: 0, ambiguous: 0 };
      const currentInventory = inventoryIndex(inventory());
      rows.forEach((row) => {
        if (row.kind !== "item") { counts.preserved += 1; return; }
        counts.items += 1;
        if (parseQuantity(row.quantity) === 0) counts.zero += 1;
        const match = resolveRow(row, currentInventory);
        if (match.status === "unknown") counts.unknown += 1;
        if (["ambiguous", "stale"].includes(match.status)) counts.ambiguous += 1;
      });
      get("equipmentPersonalizerCounts").textContent = `${rows.length} filas en el cuadro: ${counts.items} de equipo (${counts.zero} en 0) y ${counts.preserved} de encabezados, categorías, notas o separadores. ${counts.unknown} sin acción y ${counts.ambiguous} por identificar.`;
      get("equipmentPersonalizerRows").innerHTML = rows.length ? `<div class="equipment-personalizer-table-scroll"><table><thead><tr><th>Fila / tipo</th><th>Cantidad</th><th>Descripción</th><th>Categoría</th><th>Observaciones</th><th>Inventario / acción</th><th><span class="equipment-personalizer-sr-only">Eliminar</span></th></tr></thead><tbody>${visible.map((row, index) => renderRow(row, start + index, currentInventory)).join("")}</tbody></table></div>` : '<p class="equipment-personalizer-empty">Pega tu cuadro o agrega una fila para comenzar.</p>';
      get("equipmentPersonalizerPagination").innerHTML = rows.length ? `<button type="button" class="equipment-personalizer-secondary" data-personalizer-action="previous"${page === 0 ? " disabled" : ""}>Anterior</button><span>Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} de ${rows.length} filas. Todas se cargarán.</span><button type="button" class="equipment-personalizer-secondary" data-personalizer-action="next"${page === maxPage ? " disabled" : ""}>Siguiente</button>` : "";
    }
    function renderUsage() {
      const reusable = session.draft.usageMode === "service";
      const choices = groups();
      if (!session.draft.serviceGroupId && choices.some((group) => group.id === "personalizados")) session.draft.serviceGroupId = "personalizados";
      get("equipmentPersonalizerUsageOnce").checked = !reusable;
      get("equipmentPersonalizerUsageService").checked = reusable;
      get("equipmentPersonalizerServiceFields").hidden = !reusable;
      get("equipmentPersonalizerServiceName").required = reusable;
      get("equipmentPersonalizerServiceGroup").required = reusable;
      get("equipmentPersonalizerServiceName").value = session.draft.serviceName;
      get("equipmentPersonalizerServiceGroup").innerHTML = '<option value="">Seleccione una categoría</option>' + choices.map((group) => `<option value="${escape(group.id)}">${escape(group.label)}</option>`).join("");
      get("equipmentPersonalizerServiceGroup").value = session.draft.serviceGroupId;
      get("equipmentPersonalizerCommitButton").textContent = reusable ? "Guardar servicio y cargar evento" : "Cargar evento";
    }
    function clearForm() {
      for (const field of Object.keys(session.draft.metadata)) { const input = get(`equipmentPersonalizer-${field}`); if (input) input.value = ""; }
      get("equipmentPersonalizerClipboard").value = "";
      clipboardDirty = false;
      get("equipmentPersonalizerReview").hidden = true;
      get("equipmentPersonalizerCommitButton").disabled = true;
      errors([]); status(""); page = 0; renderRows();
      renderUsage();
      get("equipmentPersonalizerReviewButton").textContent = typeof options.onPreview === "function" ? "Revisar disponibilidad" : "Revisar cuadro";
    }
    function stopPreview() {
      previewGeneration += 1;
      if (previewBusy) { previewBusy = false; setBusy(false); }
    }
    function close() {
      if (!session.discard()) return false;
      stopPreview();
      if (dialog.open) dialog.close();
      clearForm();
      return true;
    }
    async function open() {
      if (session.busy || busyOpening || destroyed) return false;
      if (dialog.open) return true;
      busyOpening = true;
      try {
        if (typeof options.beforeOpen === "function") await options.beforeOpen();
        if (destroyed) return false;
        session.open(); clearForm();
        dialog.showModal(); get("equipmentPersonalizer-place").focus();
        return true;
      } catch (error) {
        if (typeof options.onError === "function") options.onError(error);
        else if (typeof console !== "undefined") console.error("No se pudo abrir el cuadro personalizado:", error);
        return false;
      } finally { busyOpening = false; }
    }
    function readRowField(target) {
      const element = target?.closest?.("[data-personalizer-row]");
      const row = element && session.draft.rows.find((entry) => entry.id === element.dataset.personalizerRow);
      if (!row || !target.dataset.personalizerField) return null;
      const field = target.dataset.personalizerField;
      row[field] = target.value;
      if (field === "description") { row.warehouseInventoryId = ""; row.procurementChoice = ""; }
      changed();
      return { row, field, element };
    }
    async function onClick(event) {
      const button = event.target?.closest?.("[data-personalizer-action]");
      if (!button || session.busy) return;
      const action = button.dataset.personalizerAction;
      if (action === "close") { close(); return; }
      if (previewBusy) return;
      if (action === "parse") {
        const input = get("equipmentPersonalizerClipboard").value;
        if (!meaningful(input)) { errors([{ message: "Pegue las celdas de Excel antes de preparar el cuadro." }]); return; }
        try {
          session.paste(input); clipboardDirty = false; page = 0; changed(); errors([]); renderRows();
          status(`Se recibieron ${session.draft.sourceRowCount} filas y ${session.draft.sourceCellCount} celdas con información. Revise el tipo de cada fila y los equipos sin identificar.`);
        } catch (error) { errors([error]); }
      } else if (action === "add") {
        const rowNumber = session.draft.rows.reduce((highest, row) => Math.max(highest, row.sourceRow || 0), 0) + 1;
        session.draft.rows.push({ id: `manual-row-${++sequence}`, sourceRow: rowNumber, kind: "item", cells: [], quantity: "1", description: "", category: "", notes: "", procurementChoice: "", warehouseInventoryId: "", itemType: "equipo", extras: [] });
        changed(); page = Math.floor((session.draft.rows.length - 1) / PAGE_SIZE); renderRows();
      } else if (action === "remove") {
        const row = button.closest("[data-personalizer-row]");
        if (row) { session.removeRow(row.dataset.personalizerRow); changed(); renderRows(); }
      } else if (action === "previous" || action === "next") { page += action === "next" ? 1 : -1; renderRows(); }
      else if (action === "review") {
        if (clipboardDirty) { errors([{ message: "Hay contenido pegado que todavía no está en la tabla. Pulse Preparar cuadro pegado antes de revisar." }]); return; }
        const validation = session.review(); errors(validation); renderRows();
        if (validation.length) { status("Corrija los puntos indicados. Ningún equipo se ha guardado todavía."); return; }
        const eventPreview = buildEvent(session.draft, inventory(), groups());
        const items = eventPreview.sections.flatMap((section) => section.items);
        const counts = { recognized: items.filter((item) => item.warehouseInventoryId).length, rent: items.filter((item) => item.procurementChoice === "rent").length, purchase: items.filter((item) => item.procurementChoice === "purchase").length };
        const panel = get("equipmentPersonalizerReview");
        const permanence = eventPreview.serviceTemplate ? `<div class="equipment-personalizer-permanent-review"><strong>También guardarás un nuevo tipo de servicio: ${escape(eventPreview.serviceTemplate.name)}</strong><p>Categoría: ${escape(groups().find((group) => group.id === eventPreview.serviceTemplate.groupId)?.label || eventPreview.serviceTemplate.groupId)}. El cuadro, sus cantidades y notas quedarán disponibles de forma permanente para futuros eventos al confirmar.</p></div>` : '<p>Este cuadro se usará únicamente para este evento.</p>';
        const overview = `<h3>Cuadro listo para cargar</h3><p><strong>${escape(eventPreview.name)}</strong> · ${escape(eventPreview.place)}</p><p>${session.draft.rows.length} filas conservadas; ${items.length} líneas de equipo: ${counts.recognized} vinculadas al inventario, ${counts.rent} para renta y ${counts.purchase} para compra.</p>${permanence}`;
        if (typeof options.onPreview !== "function") {
          panel.hidden = false; panel.innerHTML = overview + '<p>Las filas están completas. Al cargar, se comprobará la disponibilidad con las reservas de los demás eventos.</p>';
          get("equipmentPersonalizerCommitButton").disabled = false; status(eventPreview.serviceTemplate ? "Cuadro revisado. Confirme con Guardar servicio y cargar evento." : "Cuadro revisado. Confirme con Cargar evento.");
          return;
        }
        session.changed();
        const generation = ++previewGeneration;
        previewBusy = true; get("equipmentPersonalizerCommitButton").disabled = true; panel.hidden = true;
        setBusy(true, true); status("Consultando el inventario y las reservas de los demás eventos…");
        try {
          const plan = await options.onPreview(copy(eventPreview));
          if (generation !== previewGeneration || !session.isOpen || !dialog.open || destroyed) return;
          const html = renderAvailability(plan, eventPreview);
          const latestValidation = session.review();
          if (latestValidation.length) { const error = new Error(latestValidation[0].message); error.validationErrors = latestValidation; throw error; }
          panel.innerHTML = overview + html; panel.hidden = false;
          status(eventPreview.serviceTemplate ? "Disponibilidad revisada. Confirme con Guardar servicio y cargar evento para crear el servicio permanente y reservar este evento." : "Disponibilidad revisada. Confirme con Cargar evento para guardar y reservar.");
        } catch (error) {
          if (generation !== previewGeneration || !session.isOpen || destroyed) return;
          session.changed(); errors(error.validationErrors || [error]);
          status("No se pudo completar la revisión de disponibilidad. El borrador se conserva y todavía no se ha guardado.");
        } finally {
          if (generation === previewGeneration) { previewBusy = false; setBusy(false); }
        }
      } else if (action === "commit") {
        setBusy(true); status(session.draft.usageMode === "service" ? "Guardando el nuevo servicio y el evento…" : "Guardando el evento y comprobando disponibilidad…"); errors([]);
        try {
          await session.commit();
          if (dialog.open) dialog.close(); clearForm();
        } catch (error) {
          errors(error.validationErrors || [error]); status("El borrador se conserva. Corrija el problema y vuelva a revisar para reintentar.");
        } finally { setBusy(false); }
      }
    }
    function onInput(event) {
      if (previewBusy || session.busy) return;
      const target = event.target;
      if (target?.dataset?.personalizerUsageMode) {
        if (!["once", "service"].includes(target.dataset.personalizerUsageMode)) return;
        session.draft.usageMode = target.dataset.personalizerUsageMode;
        if (session.draft.usageMode === "service" && !session.draft.serviceNameTouched && !meaningful(session.draft.serviceName)) session.draft.serviceName = text(session.draft.metadata.type).trim();
        changed(); renderUsage();
      } else if (target?.dataset?.personalizerTemplateField) {
        const field = target.dataset.personalizerTemplateField;
        if (field === "name") { session.draft.serviceName = target.value; session.draft.serviceNameTouched = true; }
        if (field === "groupId") session.draft.serviceGroupId = target.value;
        changed();
      } else if (target?.dataset?.personalizerMetadata) { session.draft.metadata[target.dataset.personalizerMetadata] = target.value; changed(); }
      else if (target?.dataset?.personalizerField) readRowField(target);
      else if (target?.id === "equipmentPersonalizerClipboard") { clipboardDirty = true; changed(); status("Pulse Preparar cuadro pegado para incorporar este contenido a la tabla."); }
    }
    function onChange(event) {
      if (previewBusy || session.busy) return;
      if (event.target?.dataset?.personalizerUsageMode || event.target?.dataset?.personalizerTemplateField) { onInput(event); return; }
      const changedRow = readRowField(event.target); if (changedRow) renderRows();
    }
    function onCancel(event) { event.preventDefault(); close(); }
    function onClose() { if (!session.busy && session.isOpen) { stopPreview(); session.discard(); clearForm(); } }
    dialog.addEventListener("click", onClick);
    dialog.addEventListener("input", onInput);
    dialog.addEventListener("change", onChange);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose);
    const opener = get(options.openerId || "equipmentPersonalizeEventButton");
    if (opener) opener.addEventListener("click", open);
    const api = { open, close, getDraft: () => copy(session.draft), destroy() {
      if (session.busy) return false;
      destroyed = true; close();
      if (opener) opener.removeEventListener("click", open);
      dialog.remove(); instances.delete(doc); return true;
    } };
    instances.set(doc, api);
    return api;
  }

  return { parseClipboard, readTsv, parseQuantity, normalize, inventoryRecords, inventoryIndex, resolveRow, dateMillis, serviceGroups, validateDraft, buildEvent, createSession, renderMarkup, renderRow, renderAvailability, init };
});
