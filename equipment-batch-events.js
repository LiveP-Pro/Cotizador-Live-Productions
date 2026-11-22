(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentBatchEvents = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";
  const MAX_FILE_BYTES = 15 * 1024 * 1024, instances = new WeakMap();
  const text = (value) => String(value ?? "");
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escape = (value) => text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const joinDateTime = (date, time) => date && time ? `${date}T${time}` : "";
  function validDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
    return date.getUTCFullYear() === +match[1] && date.getUTCMonth() + 1 === +match[2] && date.getUTCDate() === +match[3];
  }
  const validTime = (value) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text(value));
  function scheduleFor(event) {
    const parts = (field, prefix) => ({ [`${prefix}Date`]: text(event[`${prefix}Date`] || event[field]).slice(0, 10), [`${prefix}Time`]: text(event[`${prefix}Time`] || text(event[field]).slice(11, 16)) });
    const fields = { ...parts("setupAt", "setup"), ...parts("startAt", "start"), ...parts("endAt", "end"), ...parts("equipmentInAt", "equipmentIn") };
    return { ...fields, setupApplies: event.setupApplies === false ? "no" : event.setupApplies === true || fields.setupDate || fields.setupTime ? "yes" : "" };
  }
  function selectionsFor(preview) {
    return (preview?.events || []).map((event) => ({ ...scheduleFor(event), id: event.id, selected: event.canImport === true, date: text(event.date || event.startDate || text(event.startAt).slice(0, 10)), place: text(event.place), type: text(event.type), name: text(event.client || event.name) }));
  }
  function selectionError(preview, selections) {
    if (preview?.verification?.complete !== true) return "La revisión no conserva todas las celdas originales. No se cargó ningún evento; revise la fuente.";
    const chosen = (selections || []).filter((selection) => selection.selected);
    if (!chosen.length) return "Seleccione al menos un cuadro de evento que se pueda cargar.";
    if (chosen.some((selection) => !(preview.events || []).some((event) => event.id === selection.id && event.canImport === true))) return "Hay un cuadro pendiente de interpretar. Revise el archivo antes de cargarlo.";
    if (new Set(chosen.map((selection) => selection.id)).size !== chosen.length) return "El mismo cuadro está seleccionado más de una vez.";
    for (const entry of chosen) {
      if (!["", "yes", "no"].includes(entry.setupApplies || "")) return "Revise si el montaje aplica en los eventos seleccionados.";
      const dates = [entry.date, entry.endDate, entry.equipmentInDate, ...(entry.setupApplies !== "no" ? [entry.setupDate] : [])];
      if (dates.some((value) => value && !validDate(value))) return "Revise las fechas de los eventos seleccionados.";
      const times = [entry.startTime, entry.endTime, entry.equipmentInTime, ...(entry.setupApplies !== "no" ? [entry.setupTime] : [])];
      if (times.some((value) => value && !validTime(value))) return "Revise las horas de los eventos seleccionados; use el formato de 24 horas.";
      const sequence = [entry.setupApplies === "yes" ? joinDateTime(entry.setupDate, entry.setupTime) : "", joinDateTime(entry.date, entry.startTime), joinDateTime(entry.endDate, entry.endTime), joinDateTime(entry.equipmentInDate, entry.equipmentInTime)].filter(Boolean);
      if (sequence.some((value, index) => index && value < sequence[index - 1])) return "Revise el orden de montaje, inicio, finalización y regreso a bodega. Si el evento termina otro día, indique su fecha de finalización.";
    }
    return "";
  }
  function prepareEvents(preview, selections) {
    const error = selectionError(preview, selections);
    if (error) throw new Error(error);
    const chosen = new Map(selections.filter((entry) => entry.selected).map((entry) => [entry.id, entry]));
    return preview.events.filter((event) => chosen.has(event.id)).map((event) => {
      const fields = chosen.get(event.id), output = clone(event);
      output.date = text(fields.date); output.place = text(fields.place).trim(); output.name = text(fields.name).trim() || output.place || "Evento personalizado";
      output.client = text(fields.name).trim(); output.type = text(fields.type).trim() || "Personalizado";
      output.setupAt = fields.setupApplies === "yes" ? joinDateTime(fields.setupDate, fields.setupTime) : "";
      if (fields.setupApplies === "yes" || fields.setupApplies === "no") output.setupApplies = fields.setupApplies === "yes";
      else delete output.setupApplies;
      output.startAt = joinDateTime(fields.date, fields.startTime);
      output.endAt = joinDateTime(fields.endDate, fields.endTime);
      output.equipmentInAt = joinDateTime(fields.equipmentInDate, fields.equipmentInTime);
      output.setupDate = fields.setupApplies === "no" ? "" : text(fields.setupDate);
      output.setupTime = fields.setupApplies === "no" ? "" : text(fields.setupTime);
      output.startDate = output.date; output.startTime = text(fields.startTime);
      output.endDate = text(fields.endDate); output.endTime = text(fields.endTime);
      output.equipmentInDate = text(fields.equipmentInDate); output.equipmentInTime = text(fields.equipmentInTime);
      output.serviceName = output.documentServiceName || "Cuadro personalizado";
      output.pendingLogistics = true; output.snapshotLocked = true;
      // Corrections are distinct from the immutable source ledger and cannot
      // overwrite the original event date/client/location or source cells.
      output.sourceImport = output.sourceImport || {};
      output.sourceImport.reviewedMetadata = { date: output.date, place: output.place, name: output.name, type: output.type,
        ...(typeof output.setupApplies === "boolean" ? { setupApplies: output.setupApplies } : {}),
        setupDate: output.setupDate, setupTime: output.setupTime, startDate: output.startDate, startTime: output.startTime,
        endDate: output.endDate, endTime: output.endTime, equipmentInDate: output.equipmentInDate, equipmentInTime: output.equipmentInTime,
        setupAt: output.setupAt, startAt: output.startAt, endAt: output.endAt, equipmentInAt: output.equipmentInAt };
      delete output.canImport; delete output.issues; delete output.warnings;
      return output;
    });
  }
  function totals(preview, selections) {
    const ids = new Set((selections || []).filter((entry) => entry.selected).map((entry) => entry.id));
    return (preview?.events || []).reduce((sum, event) => ids.has(event.id) ? { events: sum.events + 1, items: sum.items + Number(event.itemCount || 0), zeros: sum.zeros + Number(event.zeroCount || 0), cells: sum.cells + (event.sourceCells || []).length } : sum, { events: 0, items: 0, zeros: 0, cells: 0 });
  }
  function renderSource(cells) {
    return `<details class="equipment-batch-source"><summary>Ver todas las celdas originales (${cells.length})</summary><div class="equipment-batch-table-scroll"><table><thead><tr><th>Celda</th><th>Contenido original</th><th>Nota</th></tr></thead><tbody>${cells.map((cell) => `<tr><td>${escape(cell.sheet ? `${cell.sheet}!${cell.address}` : cell.ref)}</td><td>${escape(cell.value)}</td><td>${escape(typeof cell.note === "object" ? JSON.stringify(cell.note) : cell.note || "")}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
  function renderEvent(event, selection, index) {
    const fields = [["date", "Fecha del evento", "date"], ["place", "Ubicación", "text"], ["type", "Tipo de evento", "text"], ["name", "Cliente / referencia", "text"]];
    const schedule = [["setupDate", "Fecha del montaje", "date"], ["setupTime", "Hora del montaje", "time"], ["startTime", "Hora de inicio del evento", "time"], ["endDate", "Fecha de finalización", "date"], ["endTime", "Hora de finalización del evento", "time"], ["equipmentInDate", "Fecha de regreso a bodega", "date"], ["equipmentInTime", "Hora de regreso a bodega", "time"]];
    const scheduleMarkup = `<fieldset class="equipment-batch-schedule"><legend>Fechas y horarios para la logística</legend><div class="equipment-batch-fields"><label>¿Aplica montaje?<select data-batch-field="setupApplies" data-batch-index="${index}"${!event.canImport ? " disabled" : ""}><option value=""${!selection.setupApplies ? " selected" : ""}>Pendiente de confirmar</option><option value="yes"${selection.setupApplies === "yes" ? " selected" : ""}>Sí, requiere montaje</option><option value="no"${selection.setupApplies === "no" ? " selected" : ""}>No aplica</option></select></label>${schedule.map(([field, label, type]) => `<label>${label}<input type="${type}" data-batch-field="${field}" data-batch-index="${index}" value="${escape(selection[field])}"${field.startsWith("setup") ? ` data-batch-mount="${index}"` : ""}${!event.canImport || field.startsWith("setup") && selection.setupApplies === "no" ? " disabled" : ""}></label>`).join("")}</div><p>Solo se completan los horarios identificados en el archivo. Revise las fechas; si finaliza después de medianoche, indique el día correcto. El regreso a bodega permite comprobar cuándo vuelve a estar disponible el equipo.</p></fieldset>`;
    return `<article class="equipment-batch-card" data-batch-card="${index}"><header><label class="equipment-batch-choice"><input type="checkbox" data-batch-select="${index}"${selection.selected ? " checked" : ""}${!event.canImport ? " disabled" : ""}><strong>${escape(event.place || event.client || `Cuadro ${index + 1}`)}</strong></label><span>${escape(event.sourceSheet)} · Cuadro ${index + 1}</span></header><p>${event.itemCount} líneas de equipo · ${event.zeroCount} cantidades en 0 · ${(event.sourceCells || []).length} celdas conservadas</p><div class="equipment-batch-fields">${fields.map(([field, label, type]) => `<label>${label}<input type="${type}" data-batch-field="${field}" data-batch-index="${index}" value="${escape(selection[field])}"${!event.canImport ? " disabled" : ""}></label>`).join("")}</div>${scheduleMarkup}${event.contracted ? `<p class="equipment-batch-contract"><strong>Equipo contratado:</strong> ${escape(event.contracted)}</p>` : ""}${event.issues?.length ? `<div class="equipment-batch-error"><strong>Este cuadro necesita revisión de la fuente</strong><ul>${event.issues.map((issue) => `<li>${escape(issue.message)}${issue.refs?.length ? ` (${escape(issue.refs.join(", "))})` : ""}</li>`).join("")}</ul></div>` : ""}${event.warnings?.length ? `<ul class="equipment-batch-warnings">${event.warnings.map((warning) => `<li>${escape(warning.message)}</li>`).join("")}</ul>` : ""}<details class="equipment-batch-source"><summary>Revisar cuadro completo y sus categorías</summary><div class="equipment-batch-table-scroll"><table><thead><tr><th>Cantidad</th><th>Descripción, encabezado u observación</th><th>Origen</th></tr></thead><tbody>${(event.sections || []).flatMap((section) => section.rows || []).map((row) => `<tr data-batch-row-type="${escape(row.type)}"><td>${row.quantity === null || row.quantity === undefined ? "" : escape(row.quantity)}</td><td>${escape(row.description)}${row.notes?.length ? `<small>${escape(row.notes.join(" · "))}</small>` : ""}</td><td>${escape((row.cells || []).map((cell) => cell.address || cell.ref).join(", "))}</td></tr>`).join("")}</tbody></table></div></details>${renderSource(event.sourceCells || [])}</article>`;
  }
  function renderPreview(preview, selections) {
    const sheets = preview.sheets || [];
    return `<p class="equipment-batch-summary"><strong>${escape(preview.source?.fileName || "Archivo")}</strong><br>${preview.events.length} cuadros detectados · ${preview.verification.representedCellCount} de ${preview.verification.sourceCellCount} celdas conservadas</p><p class="equipment-batch-notice">Seleccione las pestañas y los cuadros que corresponden a eventos. Puede corregir sus datos sin alterar la fuente. Se cargarán como borradores, sin reservar equipo ni modificar el inventario.</p><fieldset class="equipment-batch-sheets"><legend>Pestañas del archivo</legend>${sheets.map((sheet, index) => {
      const available = preview.events.map((event, eventIndex) => ({ event, selection: selections[eventIndex] })).filter((entry) => sheet.eventIds.includes(entry.event.id) && entry.event.canImport);
      return `<label><input type="checkbox" data-batch-sheet="${index}"${available.length && available.every((entry) => entry.selection.selected) ? " checked" : ""}${!available.length ? " disabled" : ""}>${escape(sheet.name)} <small>${sheet.sourceCellCount} celdas</small></label>`;
    }).join("")}</fieldset><p id="equipmentBatchTotals" class="equipment-batch-summary" role="status"></p>${preview.events.map((event, index) => renderEvent(event, selections[index], index)).join("")}`;
  }
  function markup() {
    return `<header class="equipment-batch-header"><div><p>1. Cargar eventos</p><h2 id="equipmentBatchTitle">Importar varios eventos</h2></div><button type="button" data-batch-action="close" aria-label="Cerrar sin cargar">×</button></header><div class="equipment-batch-body"><p class="equipment-batch-notice">Cargue un libro Excel .xlsx con varias pestañas o cuadros, o un PDF digital con columnas Cantidad y Descripción. Se conservan encabezados, observaciones y cantidades en 0. Se leen las fechas y horas indicadas; los datos ausentes quedan pendientes para su revisión.</p><input id="equipmentBatchFile" type="file" accept=".xlsx,.pdf" hidden><button type="button" data-batch-action="choose">Elegir Excel o PDF</button><div id="equipmentBatchContent"></div></div><footer class="equipment-batch-footer"><p id="equipmentBatchStatus" role="status" aria-live="polite"></p><div><button type="button" data-batch-action="close">Cancelar</button><button type="button" id="equipmentBatchApply" data-batch-action="apply" disabled>Cargar eventos como borradores</button><button type="button" id="equipmentBatchTransfer" data-batch-action="apply-transfer" data-live-permission="equipment.reports" disabled>Cargar y revisar trasiego</button><button type="button" id="equipmentBatchRent" data-batch-action="apply-rent" data-live-permission="equipment.reports" disabled>Cargar y generar renta</button><button type="button" id="equipmentBatchPurchase" data-batch-action="apply-purchase" data-live-permission="equipment.reports" disabled>Cargar y generar compra de insumos</button></div><small>Renta y compra se generan como reportes provisionales. Los trasiegos requieren revisión y confirmación.</small></footer>`;
  }
  function init(options = {}) {
    const doc = options.document || (typeof document === "undefined" ? null : document);
    if (!doc?.body || !doc.createElement) return null;
    if (instances.has(doc)) return instances.get(doc);
    const opener = doc.getElementById(options.openerId || "equipmentBatchImportButton");
    if (!opener) return null;
    const dialog = doc.createElement("dialog"); dialog.id = "equipmentBatchDialog"; dialog.className = "equipment-batch-dialog"; dialog.setAttribute("aria-labelledby", "equipmentBatchTitle"); dialog.innerHTML = markup(); doc.body.appendChild(dialog);
    const get = (id) => doc.getElementById(id);
    let preview = null, selections = [], request = null, generation = 0, busy = false, applying = false;
    const status = (message, error = false) => { get("equipmentBatchStatus").textContent = message; get("equipmentBatchStatus").dataset.error = error ? "true" : "false"; };
    const bridge = () => options.bridge || (typeof window !== "undefined" ? window.liveEquipmentPlanner : null);
    function allowed(mode = "") {
      const access = options.access || (typeof window !== "undefined" ? window.LiveAccess : null);
      if (typeof access?.can !== "function") return true;
      const user = typeof options.session === "function" ? options.session() : options.session || (typeof window !== "undefined" ? window.LIVE_SESSION : null);
      return access.can(user, "equipment.write") && (!mode || access.can(user, "equipment.reports"));
    }
    function update() {
      const counts = totals(preview, selections), node = get("equipmentBatchTotals");
      if (node) node.textContent = `${counts.events} eventos seleccionados · ${counts.items} líneas de equipo · ${counts.zeros} cantidades en 0 · ${counts.cells} celdas`;
      const invalid = !!selectionError(preview, selections);
      for (const [id, mode] of [["equipmentBatchApply", ""], ["equipmentBatchTransfer", "transfer"], ["equipmentBatchRent", "rent"], ["equipmentBatchPurchase", "purchase"]]) {
        const button = get(id); if (!button) continue;
        button.hidden = !allowed(mode);
        button.disabled = busy || applying || invalid || !allowed(mode);
      }
      dialog.querySelectorAll("[data-batch-sheet]").forEach((element) => {
        const sheet = preview?.sheets?.[Number(element.dataset.batchSheet)]; if (!sheet) return;
        const available = selections.filter((entry) => sheet.eventIds.includes(entry.id) && preview.events.find((event) => event.id === entry.id)?.canImport);
        element.checked = available.length > 0 && available.every((entry) => entry.selected); element.indeterminate = available.some((entry) => entry.selected) && !element.checked;
      });
    }
    function reset() { preview = null; selections = []; get("equipmentBatchContent").innerHTML = ""; get("equipmentBatchFile").value = ""; status(""); update(); }
    function close() {
      if (applying) return false;
      generation++; request?.abort(); request = null; busy = false;
      if (dialog.open) dialog.close(); reset(); opener.focus(); return true;
    }
    function open() { if (applying) return false; if (!dialog.open) { reset(); dialog.showModal(); dialog.querySelector('[data-batch-action="choose"]').focus(); } return true; }
    async function read(file) {
      if (!file || applying) return;
      const token = ++generation; request?.abort(); request = new AbortController(); busy = true; preview = null; selections = []; update();
      get("equipmentBatchContent").textContent = "Leyendo todos los cuadros y comprobando cada celda…"; status("La lectura no guarda datos ni reserva equipo.");
      try {
        if (!/\.(xlsx|pdf)$/i.test(file.name)) throw new Error("Use un archivo Excel .xlsx o PDF digital. Guarde primero los archivos .xls como .xlsx.");
        if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera el límite de 15 MB. Divídalo sin eliminar datos.");
        const bytes = await file.arrayBuffer(); if (token !== generation) return;
        const response = await (options.fetch || fetch)("/api/requerimientos-equipo/importar-eventos", { method: "POST", credentials: "same-origin", headers: { "X-File-Name": encodeURIComponent(file.name), "Content-Type": file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") }, body: bytes, signal: request.signal });
        const result = await response.json(); if (token !== generation) return;
        if (!response.ok) throw new Error(result.error || "No se pudo leer el archivo.");
        if (!Array.isArray(result.events) || !result.verification) throw new Error("El servidor no devolvió una revisión válida. No se cargó ningún evento.");
        preview = result; selections = selectionsFor(result); get("equipmentBatchContent").innerHTML = renderPreview(preview, selections);
        status(result.verification.complete ? "Revise los eventos, sus fechas y horarios. Después de cargar y confirmar podrá generar trasiegos, renta y compra con la agenda actual." : selectionError(preview, selections), !result.verification.complete);
      } catch (error) {
        if (token !== generation || error.name === "AbortError") return;
        get("equipmentBatchContent").textContent = "No se cargó ningún evento."; status(error.message || "No se pudo leer el archivo.", true);
      } finally { if (token === generation) { busy = false; request = null; update(); } }
    }
    async function onClick(event) {
      const action = event.target?.closest?.("[data-batch-action]")?.dataset.batchAction;
      if (action === "close") close();
      else if (action === "choose" && !applying) get("equipmentBatchFile").click();
      else if (["apply", "apply-transfer", "apply-rent", "apply-purchase"].includes(action) && !busy && !applying) {
        const mode = action === "apply" ? "" : action.slice(6);
        if (!allowed(mode)) { status("Su usuario no tiene permiso para esta acción.", true); return; }
        let result, events, connection;
        try {
          events = prepareEvents(preview, selections); connection = bridge();
          if (typeof connection?.importEvents !== "function") throw new Error("No está disponible la conexión con los borradores. El archivo se conserva para reintentar.");
          if (mode && typeof connection.afterImport !== "function") throw new Error("No está disponible la conexión para continuar con el reporte. Puede cargar los borradores y generarlo desde el resumen.");
          applying = true; update(); status("Cargando los borradores completos…");
          result = await connection.importEvents(events);
        } catch (error) { applying = false; update(); status(error.message || "No se pudieron cargar los borradores.", true); return; }
        // Once import succeeds, consume and close the preview before attempting
        // reports. A failed download must never make the same source importable
        // again through this dialog or duplicate its events on retry.
        applying = false; close();
        try {
          if (typeof options.onImported === "function") await options.onImported(result, events);
          if (mode) await connection.afterImport(mode, { events: clone(events), result });
        } catch (error) {
          if (typeof options.onError === "function") options.onError(error);
          else status(`Los eventos ya se cargaron. ${error.message || "No se pudo continuar con el reporte; vuelva a generarlo desde el resumen."}`, true);
        }
      }
    }
    function onChange(event) {
      const element = event.target;
      if (element.id === "equipmentBatchFile") { read(element.files?.[0]); return; }
      if (busy || applying || !preview) return;
      if (element.dataset.batchSelect !== undefined) selections[Number(element.dataset.batchSelect)].selected = element.checked;
      if (element.dataset.batchField === "setupApplies") {
        const index = Number(element.dataset.batchIndex), selection = selections[index];
        if (selection) selection.setupApplies = element.value;
        dialog.querySelectorAll("[data-batch-mount]").forEach((input) => { if (Number(input.dataset.batchMount) === index) input.disabled = element.value === "no"; });
      }
      if (element.dataset.batchSheet !== undefined) {
        const sheet = preview.sheets[Number(element.dataset.batchSheet)];
        selections.forEach((selection, index) => { if (sheet.eventIds.includes(selection.id) && preview.events[index].canImport) selection.selected = element.checked; });
        dialog.querySelectorAll("[data-batch-select]").forEach((input) => { input.checked = selections[Number(input.dataset.batchSelect)].selected; });
      }
      update();
    }
    function onInput(event) {
      const element = event.target; if (busy || applying || !element.dataset.batchField) return;
      const selection = selections[Number(element.dataset.batchIndex)]; if (selection) selection[element.dataset.batchField] = element.value; update();
    }
    function onCancel(event) { event.preventDefault(); close(); }
    dialog.addEventListener("click", onClick); dialog.addEventListener("change", onChange); dialog.addEventListener("input", onInput); dialog.addEventListener("cancel", onCancel); opener.addEventListener("click", open);
    doc.addEventListener?.("live:session-updated", update);
    const api = { open, close, read, getPreview: () => preview ? clone(preview) : null, destroy() { if (applying) return false; close(); opener.removeEventListener("click", open); doc.removeEventListener?.("live:session-updated", update); dialog.remove(); instances.delete(doc); return true; } };
    instances.set(doc, api); return api;
  }
  return { selectionsFor, selectionError, prepareEvents, totals, renderPreview, renderEvent, markup, init };
});
