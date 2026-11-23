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
  const correctableScheduleIssue = (issue) => ["conflicting_schedule", "conflicting_setup", "conflicting_schedule_weekday", "conflicting_schedule_order"].includes(issue?.code) || issue?.code === "conflicting_metadata" && issue.field === "date";
  const scheduleIssues = (event) => (event.issues || []).filter(correctableScheduleIssue);
  const sourceIssues = (event) => (event.issues || []).filter((issue) => !correctableScheduleIssue(issue));
  const editableEvent = (event) => !!event && (event.canImport === true || Number(event.itemCount) > 0 && scheduleIssues(event).length > 0 && !sourceIssues(event).length);
  const duplicateGroups = (preview) => (preview?.duplicateCandidates || []).filter((group) => group.requiresReview && group.eventIds?.length > 1);
  function duplicateChoice(group, selections) {
    const entries = group.eventIds.map((id) => selections.find((entry) => entry.id === id));
    const choice = entries[0]?.duplicateReviews?.[group.id];
    if (!choice || choice !== "all" && !group.eventIds.includes(choice)) return "";
    return entries.every((entry) => entry?.duplicateReviews?.[group.id] === choice && entry.selected === (choice === "all" || entry.id === choice)) ? choice : "";
  }
  function scheduleFor(event) {
    const parts = (field, prefix) => ({ [`${prefix}Date`]: text(event[`${prefix}Date`] || event[field]).slice(0, 10), [`${prefix}Time`]: text(event[`${prefix}Time`] || text(event[field]).slice(11, 16)) });
    const fields = { ...parts("setupAt", "setup"), ...parts("startAt", "start"), ...parts("endAt", "end"), ...parts("teardownAt", "teardown"), ...parts("equipmentInAt", "equipmentIn") };
    return { ...fields, setupApplies: event.setupApplies === false ? "no" : event.setupApplies === true || fields.setupDate || fields.setupTime ? "yes" : "" };
  }
  function selectionsFor(preview) {
    return (preview?.events || []).map((event) => ({ ...scheduleFor(event), id: event.id, selected: editableEvent(event), duplicateReviews: {}, scheduleReviewed: !scheduleIssues(event).length, date: text(event.date || event.startDate || text(event.startAt).slice(0, 10)), place: text(event.place), type: text(event.type), name: text(event.client || event.name) }));
  }
  function selectionError(preview, selections) {
    if (preview?.verification?.complete !== true) return "La revisión no conserva todas las celdas originales. No se cargó ningún evento; revise la fuente.";
    if ((preview.events || []).some((event) => sourceIssues(event).length || !editableEvent(event))) return "Hay un cuadro pendiente de interpretar. Corrija la fuente antes de cargar; no se omitirá ningún cuadro.";
    if (duplicateGroups(preview).some((group) => !duplicateChoice(group, selections || []))) return "Confirme si los cuadros con equipo idéntico son eventos distintos o una copia.";
    const references = new Set(duplicateGroups(preview).flatMap((group) => { const choice = duplicateChoice(group, selections || []); return choice && choice !== "all" ? group.eventIds.filter((id) => id !== choice) : []; }));
    if ((preview.events || []).some((event) => !references.has(event.id) && scheduleIssues(event).length && !(selections || []).find((selection) => selection.id === event.id)?.scheduleReviewed)) return "Confirme las fechas y horarios de los cuadros señalados antes de cargar.";
    const chosen = (selections || []).filter((selection) => selection.selected);
    if (!chosen.length) return "Seleccione al menos un cuadro de evento que se pueda cargar.";
    if (chosen.some((selection) => !(preview.events || []).some((event) => event.id === selection.id && editableEvent(event)))) return "Hay un cuadro pendiente de interpretar. Revise el archivo antes de cargarlo.";
    if (new Set(chosen.map((selection) => selection.id)).size !== chosen.length) return "El mismo cuadro está seleccionado más de una vez.";
    for (const entry of chosen) {
      if (!["", "yes", "no"].includes(entry.setupApplies || "")) return "Revise si el montaje aplica en los eventos seleccionados.";
      const dates = [entry.date, entry.endDate, entry.teardownDate, entry.equipmentInDate, ...(entry.setupApplies !== "no" ? [entry.setupDate] : [])];
      if (dates.some((value) => value && !validDate(value))) return "Revise las fechas de los eventos seleccionados.";
      const times = [entry.startTime, entry.endTime, entry.teardownTime, entry.equipmentInTime, ...(entry.setupApplies !== "no" ? [entry.setupTime] : [])];
      if (times.some((value) => value && !validTime(value))) return "Revise las horas de los eventos seleccionados; use el formato de 24 horas.";
      const sequence = [entry.setupApplies === "yes" ? joinDateTime(entry.setupDate, entry.setupTime) : "", joinDateTime(entry.date, entry.startTime), joinDateTime(entry.endDate, entry.endTime), joinDateTime(entry.teardownDate, entry.teardownTime), joinDateTime(entry.equipmentInDate, entry.equipmentInTime)].filter(Boolean);
      if (sequence.some((value, index) => index && value < sequence[index - 1])) return "Revise el orden de montaje, inicio, finalización y regreso a bodega. Si el evento termina otro día, indique su fecha de finalización.";
    }
    return "";
  }
  function prepareEvents(preview, selections) {
    const error = selectionError(preview, selections);
    if (error) throw new Error(error);
    const chosen = new Map(selections.filter((entry) => entry.selected).map((entry) => [entry.id, entry]));
    const prepared = preview.events.filter((event) => chosen.has(event.id)).map((event) => {
      const fields = chosen.get(event.id), output = clone(event);
      output.date = text(fields.date); output.place = text(fields.place).trim(); output.name = text(fields.name).trim() || output.place || "Evento personalizado";
      output.client = text(fields.name).trim(); output.type = text(fields.type).trim() || "Personalizado";
      output.setupAt = fields.setupApplies === "yes" ? joinDateTime(fields.setupDate, fields.setupTime) : "";
      if (fields.setupApplies === "yes" || fields.setupApplies === "no") output.setupApplies = fields.setupApplies === "yes";
      else delete output.setupApplies;
      output.startAt = joinDateTime(fields.date, fields.startTime);
      output.endAt = joinDateTime(fields.endDate, fields.endTime);
      output.teardownAt = joinDateTime(fields.teardownDate, fields.teardownTime);
      output.equipmentInAt = joinDateTime(fields.equipmentInDate, fields.equipmentInTime);
      output.setupDate = fields.setupApplies === "no" ? "" : text(fields.setupDate);
      output.setupTime = fields.setupApplies === "no" ? "" : text(fields.setupTime);
      output.startDate = output.date; output.startTime = text(fields.startTime);
      output.endDate = text(fields.endDate); output.endTime = text(fields.endTime);
      output.teardownDate = text(fields.teardownDate); output.teardownTime = text(fields.teardownTime);
      output.equipmentInDate = text(fields.equipmentInDate); output.equipmentInTime = text(fields.equipmentInTime);
      output.serviceName = output.documentServiceName || "Cuadro personalizado";
      output.pendingLogistics = true; output.snapshotLocked = true;
      // Corrections are distinct from the immutable source ledger and cannot
      // overwrite the original event date/client/location or source cells.
      output.sourceImport = output.sourceImport || {};
      if (event.issues?.length) output.sourceImport.sourceIssues = clone(event.issues);
      if (event.warnings?.length) output.sourceImport.sourceWarnings = clone(event.warnings);
      if (scheduleIssues(event).length) output.sourceImport.scheduleConflictsReviewed = fields.scheduleReviewed === true;
      output.sourceImport.reviewedMetadata = { date: output.date, place: output.place, name: output.name, type: output.type,
        ...(typeof output.setupApplies === "boolean" ? { setupApplies: output.setupApplies } : {}),
        setupDate: output.setupDate, setupTime: output.setupTime, startDate: output.startDate, startTime: output.startTime,
        endDate: output.endDate, endTime: output.endTime, teardownDate: output.teardownDate, teardownTime: output.teardownTime, equipmentInDate: output.equipmentInDate, equipmentInTime: output.equipmentInTime,
        setupAt: output.setupAt, startAt: output.startAt, endAt: output.endAt, teardownAt: output.teardownAt, equipmentInAt: output.equipmentInAt };
      delete output.canImport; delete output.issues; delete output.warnings;
      return output;
    });
    for (const group of duplicateGroups(preview)) {
      const choice = duplicateChoice(group, selections), retained = prepared.filter((event) => group.eventIds.includes(event.id));
      const decision = { candidateId: group.id, choice, selectedEventIds: retained.map((event) => event.id) };
      for (const event of retained) {
        (event.sourceImport.duplicateDecisions ||= []).push(clone(decision));
        if (choice !== "all") {
          (event.sourceImport.referenceTables ||= []).push(...preview.events.filter((source) => group.eventIds.includes(source.id) && source.id !== choice).map((source) => ({ ...clone(source), selectionDecision: clone(decision) })));
        }
      }
    }
    return prepared;
  }
  function totals(preview, selections) {
    const ids = new Set((selections || []).filter((entry) => entry.selected).map((entry) => entry.id));
    return (preview?.events || []).reduce((sum, event) => ids.has(event.id) ? { events: sum.events + 1, items: sum.items + Number(event.itemCount || 0), zeros: sum.zeros + Number(event.zeroCount || 0), cells: sum.cells + (event.sourceCells || []).length } : sum, { events: 0, items: 0, zeros: 0, cells: 0 });
  }
  function renderSource(cells) {
    return `<details class="equipment-batch-source"><summary>Ver todas las celdas originales (${cells.length})</summary><div class="equipment-batch-table-scroll"><table><thead><tr><th>Celda</th><th>Contenido original</th><th>Nota</th></tr></thead><tbody>${cells.map((cell) => `<tr><td>${escape(cell.sheet ? `${cell.sheet}!${cell.address}` : cell.ref)}</td><td>${escape(cell.value)}</td><td>${escape(typeof cell.note === "object" ? JSON.stringify(cell.note) : cell.note || "")}</td></tr>`).join("")}</tbody></table></div></details>`;
  }
  function renderEvent(event, selection, index) {
    const editable = editableEvent(event);
    const fields = [["date", "Fecha del evento", "date"], ["place", "Ubicación", "text"], ["type", "Tipo de evento", "text"], ["name", "Cliente / referencia", "text"]];
    const schedule = [["setupDate", "Fecha del montaje", "date"], ["setupTime", "Hora del montaje", "time"], ["startTime", "Hora de inicio del evento", "time"], ["endDate", "Fecha de finalización", "date"], ["endTime", "Hora de finalización del evento", "time"], ["teardownDate", "Fecha del desmontaje", "date"], ["teardownTime", "Hora del desmontaje", "time"], ["equipmentInDate", "Fecha de regreso a bodega", "date"], ["equipmentInTime", "Hora de regreso a bodega", "time"]];
    const scheduleMarkup = `<fieldset class="equipment-batch-schedule"><legend>Fechas y horarios para la logística</legend><div class="equipment-batch-fields"><label>¿Aplica montaje?<select data-batch-field="setupApplies" data-batch-index="${index}"${!editable ? " disabled" : ""}><option value=""${!selection.setupApplies ? " selected" : ""}>Pendiente de confirmar</option><option value="yes"${selection.setupApplies === "yes" ? " selected" : ""}>Sí, requiere montaje</option><option value="no"${selection.setupApplies === "no" ? " selected" : ""}>No aplica</option></select></label>${schedule.map(([field, label, type]) => `<label>${label}<input type="${type}" data-batch-field="${field}" data-batch-index="${index}" value="${escape(selection[field])}"${field.startsWith("setup") ? ` data-batch-mount="${index}"` : ""}${!editable || field.startsWith("setup") && selection.setupApplies === "no" ? " disabled" : ""}></label>`).join("")}</div><p>Solo se completan los horarios identificados en el archivo. Revise las fechas; si finaliza después de medianoche, indique el día correcto. El regreso a bodega permite comprobar cuándo vuelve a estar disponible el equipo.</p></fieldset>`;
    return `<article class="equipment-batch-card" data-batch-card="${index}"><header><label class="equipment-batch-choice"><input type="checkbox" data-batch-select="${index}"${selection.selected ? " checked" : ""}${!editable ? " disabled" : ""}><strong>${escape(event.place || event.client || `Cuadro ${index + 1}`)}</strong></label><span>${escape(event.sourceSheet)} · Cuadro ${index + 1}</span></header><p>${event.itemCount} líneas de equipo · ${event.zeroCount} cantidades en 0 · ${(event.sourceCells || []).length} celdas conservadas</p><div class="equipment-batch-fields">${fields.map(([field, label, type]) => `<label>${label}<input type="${type}" data-batch-field="${field}" data-batch-index="${index}" value="${escape(selection[field])}"${!editable ? " disabled" : ""}></label>`).join("")}</div>${scheduleMarkup}${scheduleIssues(event).length ? `<div class="equipment-batch-correction"><p>La fecha o el horario original necesita confirmación. Revise y corrija los campos de este cuadro.</p><label><input type="checkbox" data-batch-review="${index}"${selection.scheduleReviewed ? " checked" : ""}>Confirmé las fechas y horarios</label></div>` : ""}${event.contracted ? `<p class="equipment-batch-contract"><strong>Equipo contratado:</strong> ${escape(event.contracted)}</p>` : ""}${sourceIssues(event).length ? `<div class="equipment-batch-error"><strong>Este cuadro necesita revisión de la fuente</strong><ul>${sourceIssues(event).map((issue) => `<li>${escape(issue.message)}${issue.refs?.length ? ` (${escape(issue.refs.join(", "))})` : ""}</li>`).join("")}</ul></div>` : ""}${event.warnings?.length ? `<ul class="equipment-batch-warnings">${event.warnings.map((warning) => `<li>${escape(warning.message)}</li>`).join("")}</ul>` : ""}<details class="equipment-batch-source"><summary>Revisar cuadro completo y sus categorías</summary><div class="equipment-batch-table-scroll"><table><thead><tr><th>Cantidad</th><th>Descripción, encabezado u observación</th><th>Origen</th></tr></thead><tbody>${(event.sections || []).flatMap((section) => section.rows || []).map((row) => `<tr data-batch-row-type="${escape(row.type)}"><td>${row.quantity === null || row.quantity === undefined ? "" : escape(row.quantity)}</td><td>${escape(row.description)}${row.notes?.length ? `<small>${escape(row.notes.join(" · "))}</small>` : ""}</td><td>${escape((row.cells || []).map((cell) => cell.address || cell.ref).join(", "))}</td></tr>`).join("")}</tbody></table></div></details>${renderSource(event.sourceCells || [])}</article>`;
  }
  function renderPreview(preview, selections) {
    const sheets = preview.sheets || [];
    const duplicateMarkup = duplicateGroups(preview).map((group, index) => `<section class="equipment-batch-correction"><label for="equipmentBatchDuplicate${index}"><strong>Hay cuadros con el mismo equipo</strong></label><p>Confirme si corresponden a eventos distintos o si uno es una copia. Ambos cuadros originales se conservarán completos.</p><select id="equipmentBatchDuplicate${index}" data-batch-duplicate="${index}"><option value="">Pendiente de confirmar</option>${group.eventIds.map((id) => { const position = preview.events.findIndex((event) => event.id === id), event = preview.events[position]; return `<option value="${escape(id)}">Solo cuadro ${position + 1} · ${escape(event?.sourceSheet || "")}</option>`; }).join("")}<option value="all">Son eventos distintos: incluir todos</option></select></section>`).join("");
    return `<p class="equipment-batch-summary"><strong>${escape(preview.source?.fileName || "Archivo")}</strong><br>${preview.events.length} cuadros detectados · ${preview.verification.representedCellCount} de ${preview.verification.sourceCellCount} celdas conservadas</p><p class="equipment-batch-notice">Todos los cuadros completos están seleccionados. Revise sus datos y cargue los eventos en un solo paso. Puede corregir sus datos sin alterar la fuente. Se cargarán como borradores, sin reservar equipo ni modificar el inventario.</p>${duplicateMarkup}<fieldset class="equipment-batch-sheets"><legend>Pestañas del archivo</legend>${sheets.map((sheet, index) => {
      const available = preview.events.map((event, eventIndex) => ({ event, selection: selections[eventIndex] })).filter((entry) => sheet.eventIds.includes(entry.event.id) && editableEvent(entry.event));
      return `<label><input type="checkbox" data-batch-sheet="${index}"${available.length && available.every((entry) => entry.selection.selected) ? " checked" : ""}${!available.length ? " disabled" : ""}>${escape(sheet.name)} <small>${sheet.sourceCellCount} celdas</small></label>`;
    }).join("")}</fieldset><p id="equipmentBatchTotals" class="equipment-batch-summary" role="status"></p><p id="equipmentBatchValidation" class="equipment-batch-validation" role="status"></p>${preview.events.map((event, index) => renderEvent(event, selections[index], index)).join("")}`;
  }
  function markup() {
    return `<header class="equipment-batch-header"><div><p id="equipmentBatchStep">1. Cargar eventos</p><h2 id="equipmentBatchTitle">Importar varios eventos</h2></div><button type="button" data-batch-action="close" aria-label="Cerrar">×</button></header><div id="equipmentBatchBody" class="equipment-batch-body"><p id="equipmentBatchInstructions" class="equipment-batch-notice">Cargue un libro Excel .xlsx con varias pestañas o cuadros, o un PDF digital con columnas Cantidad y Descripción. Se conservan encabezados, observaciones y cantidades en 0. Se leen las fechas y horas indicadas; los datos ausentes quedan pendientes para su revisión.</p><input id="equipmentBatchFile" type="file" accept=".xlsx,.pdf" hidden><button type="button" id="equipmentBatchChoose" data-batch-action="choose">Elegir Excel o PDF</button><div id="equipmentBatchContent"></div></div><footer class="equipment-batch-footer"><p id="equipmentBatchStatus" role="status" aria-live="polite"></p><div><button type="button" id="equipmentBatchClose" data-batch-action="close">Cancelar</button><button type="button" id="equipmentBatchApply" data-batch-action="apply" disabled>Cargar eventos y preparar reportes</button><button type="button" id="equipmentBatchTransfer" data-batch-action="apply-transfer" data-live-permission="equipment.reports" hidden disabled>Revisar trasiego</button><button type="button" id="equipmentBatchRent" data-batch-action="apply-rent" data-live-permission="equipment.reports" hidden disabled>Generar renta</button><button type="button" id="equipmentBatchPurchase" data-batch-action="apply-purchase" data-live-permission="equipment.reports" hidden disabled>Generar compra de consumibles</button><button type="button" id="equipmentBatchSummary" data-batch-action="report-summary" hidden disabled>Ver resumen general</button></div><small id="equipmentBatchReportNotice">Los eventos se cargan como borradores. Renta y compra son reportes provisionales; el trasiego requiere revisión y confirmación.</small></footer>`;
  }
  function init(options = {}) {
    const doc = options.document || (typeof document === "undefined" ? null : document);
    if (!doc?.body || !doc.createElement) return null;
    if (instances.has(doc)) return instances.get(doc);
    const opener = doc.getElementById(options.openerId || "equipmentBatchImportButton");
    if (!opener) return null;
    const dialog = doc.createElement("dialog"); dialog.id = "equipmentBatchDialog"; dialog.className = "equipment-batch-dialog"; dialog.setAttribute("aria-labelledby", "equipmentBatchTitle"); dialog.innerHTML = markup(); doc.body.appendChild(dialog);
    const get = (id) => doc.getElementById(id);
    let preview = null, selections = [], request = null, generation = 0, busy = false, applying = false, reporting = false, imported = null;
    const status = (message, error = false) => { get("equipmentBatchStatus").textContent = message; get("equipmentBatchStatus").dataset.error = error ? "true" : "false"; };
    const bridge = () => options.bridge || (typeof window !== "undefined" ? window.liveEquipmentPlanner : null);
    function allowed(mode = "") {
      const access = options.access || (typeof window !== "undefined" ? window.LiveAccess : null);
      if (typeof access?.can !== "function") return true;
      const user = typeof options.session === "function" ? options.session() : options.session || (typeof window !== "undefined" ? window.LIVE_SESSION : null);
      return access.can(user, "equipment.write") && (!mode || mode === "summary" || access.can(user, "equipment.reports"));
    }
    function update() {
      const counts = totals(preview, selections), node = get("equipmentBatchTotals");
      if (node && preview) node.textContent = `${counts.events} eventos seleccionados · ${counts.items} líneas de equipo · ${counts.zeros} cantidades en 0 · ${counts.cells} celdas`;
      const error = selectionError(preview, selections), validation = get("equipmentBatchValidation");
      if (validation && preview) validation.textContent = error;
      const locked = busy || applying || reporting;
      for (const [id, mode] of [["equipmentBatchApply", ""], ["equipmentBatchTransfer", "transfer"], ["equipmentBatchRent", "rent"], ["equipmentBatchPurchase", "purchase"], ["equipmentBatchSummary", "summary"]]) {
        const button = get(id); if (!button) continue;
        button.hidden = !allowed(mode) || (mode ? !imported : !!imported);
        button.disabled = locked || !allowed(mode) || (imported ? !mode : !!error);
      }
      get("equipmentBatchChoose").hidden = !!imported;
      get("equipmentBatchChoose").disabled = applying || reporting;
      get("equipmentBatchInstructions").hidden = !!imported;
      get("equipmentBatchClose").textContent = imported ? "Cerrar" : "Cancelar";
      get("equipmentBatchClose").disabled = applying || reporting;
      get("equipmentBatchStep").textContent = imported ? "2. Reportes listos" : "1. Cargar eventos";
      get("equipmentBatchTitle").textContent = imported ? "Eventos cargados" : "Importar varios eventos";
      dialog.querySelectorAll("[data-batch-sheet]").forEach((element) => {
        const sheet = preview?.sheets?.[Number(element.dataset.batchSheet)]; if (!sheet) return;
        const available = selections.filter((entry) => sheet.eventIds.includes(entry.id) && editableEvent(preview.events.find((event) => event.id === entry.id)));
        element.checked = available.length > 0 && available.every((entry) => entry.selected); element.indeterminate = available.some((entry) => entry.selected) && !element.checked;
      });
      dialog.querySelectorAll("[data-batch-duplicate]").forEach((element) => {
        const group = duplicateGroups(preview)[Number(element.dataset.batchDuplicate)];
        if (group) element.value = duplicateChoice(group, selections);
      });
    }
    function reset() { preview = null; selections = []; imported = null; get("equipmentBatchContent").innerHTML = ""; get("equipmentBatchFile").value = ""; status(""); update(); }
    function close() {
      if (applying || reporting) return false;
      generation++; request?.abort(); request = null; busy = false;
      if (dialog.open) dialog.close();
      // Retain successful imports when the ready panel is dismissed. Reopening
      // can generate another report without offering the same import again.
      if (!imported) reset();
      opener.focus(); return true;
    }
    function open() {
      if (applying || reporting) return false;
      if (!dialog.open) { if (!imported) reset(); dialog.showModal(); (get(imported ? "equipmentBatchSummary" : "equipmentBatchChoose"))?.focus(); }
      return true;
    }
    async function openFile(file) { if (!file || !open()) return null; return read(file); }
    async function read(file) {
      if (!file || applying || reporting) return null;
      const token = ++generation; request?.abort(); const controller = new AbortController(); request = controller;
      busy = true; preview = null; selections = []; imported = null; update();
      get("equipmentBatchContent").textContent = "Leyendo todos los cuadros y comprobando cada celda…"; status("La lectura no guarda datos ni reserva equipo.");
      try {
        if (!/\.(xlsx|pdf)$/i.test(file.name)) throw new Error("Use un archivo Excel .xlsx o PDF digital. Guarde primero los archivos .xls como .xlsx.");
        if (file.size > MAX_FILE_BYTES) throw new Error("El archivo supera el límite de 15 MB. Divídalo sin eliminar datos.");
        const bytes = await file.arrayBuffer(); if (token !== generation) return null;
        const response = await (options.fetch || fetch)("/api/requerimientos-equipo/importar-eventos", { method: "POST", credentials: "same-origin", headers: { "X-File-Name": encodeURIComponent(file.name), "Content-Type": file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") }, body: bytes, signal: controller.signal });
        const result = await response.json(); if (token !== generation) return null;
        if (!response.ok) throw new Error(result?.error || "No se pudo leer el archivo.");
        if (!Array.isArray(result?.events) || !result.verification || result.events.some((event) => !event || typeof event.id !== "string") || new Set(result.events.map((event) => event.id)).size !== result.events.length) throw new Error("El servidor no devolvió una revisión válida. No se cargó ningún evento.");
        preview = result; selections = selectionsFor(result); get("equipmentBatchContent").innerHTML = renderPreview(preview, selections); get("equipmentBatchBody").scrollTop = 0;
        const error = selectionError(preview, selections);
        status(error ? "Revise los cuadros señalados antes de cargar." : "Todos los eventos completos están seleccionados. Cárguelos para preparar trasiego, renta y compra.");
        return clone(preview);
      } catch (error) {
        if (token !== generation || error?.name === "AbortError") return null;
        preview = null; selections = []; get("equipmentBatchContent").textContent = "No se cargó ningún evento."; status(error?.message || "No se pudo leer el archivo.", true); return null;
      } finally { if (token === generation) { busy = false; request = null; update(); } }
    }
    function renderReady() {
      const source = imported.fileName || "Archivo", events = Array.isArray(imported.result?.events) ? imported.result.events : imported.events, count = events.length;
      const reused = Number.isInteger(imported.result?.addedCount) ? Math.max(0, count - imported.result.addedCount) : 0;
      get("equipmentBatchBody").scrollTop = 0;
      get("equipmentBatchContent").innerHTML = `<section class="equipment-batch-ready"><strong>${count} eventos cargados y listos para preparar reportes</strong><p>${escape(source)}</p>${reused ? `<p>${reused} cuadros del mismo archivo ya estaban cargados; se conservaron sus ediciones.</p>` : ""}<p>Puede generar los reportes desde los botones de abajo. Los eventos se cargaron una sola vez; si un reporte falla puede volver a generarlo.</p><ul>${events.map((event) => `<li>${escape(event.place || event.name || "Evento")} · ${escape(event.date || "Fecha pendiente")}</li>`).join("")}</ul></section>`;
    }
    function reportError(error) {
      status(`Los eventos ya se cargaron. ${error?.message || "No se pudo generar el reporte."} Puede reintentarlo.`, true);
      try { options.onError?.(error); } catch (_) { /* Keep the ready panel usable if external status fails. */ }
    }
    async function report(mode) {
      if (!imported || busy || applying || reporting) return false;
      if (!allowed(mode)) { status("Su usuario no tiene permiso para esta acción.", true); return false; }
      if (typeof imported.connection?.afterImport !== "function") { reportError(new Error("No está disponible la conexión con los reportes.")); return false; }
      let completed = false;
      reporting = true; update(); status(mode === "summary" ? "Abriendo el resumen general…" : "Preparando el reporte con los eventos cargados…");
      try {
        await imported.connection.afterImport(mode, { events: clone(imported.events), result: imported.result });
        completed = true;
        status(mode === "summary" ? "Resumen general disponible. Puede continuar con los reportes." : "Reporte preparado. Puede generar los demás reportes con los mismos eventos."); return true;
      } catch (error) { reportError(error); return false; }
      finally { reporting = false; update(); if (completed && ["summary", "transfer"].includes(mode)) close(); }
    }
    async function apply(mode = "") {
      if (busy || applying || reporting) return false;
      if (imported) return mode ? report(mode) : false;
      if (!allowed(mode)) { status("Su usuario no tiene permiso para esta acción.", true); return false; }
      let events, connection;
      try {
        events = prepareEvents(preview, selections); connection = bridge();
        if (typeof connection?.importEvents !== "function") throw new Error("No está disponible la conexión con los borradores. El archivo se conserva para reintentar.");
        if (mode && typeof connection.afterImport !== "function") throw new Error("No está disponible la conexión para continuar con el reporte. Puede cargar los borradores y generarlo desde el resumen.");
        applying = true; update(); status("Cargando los borradores completos…");
        const result = await connection.importEvents(events);
        // Consume the preview immediately after the import resolves, before any
        // external callback or report can fail. No action can import it again.
        imported = { events: clone(events), result, connection, fileName: preview?.source?.fileName };
        preview = null; selections = []; get("equipmentBatchFile").value = ""; renderReady(); update();
        status(`${events.length} eventos cargados. Elija el reporte que necesita.`);
        if (typeof options.onImported === "function") {
          try { await options.onImported(result, clone(events)); }
          catch (error) { reportError(error); }
        }
      } catch (error) { status(error?.message || "No se pudieron cargar los borradores.", true); return false; }
      finally { applying = false; update(); }
      if (mode) return report(mode);
      get("equipmentBatchSummary")?.focus(); return true;
    }
    async function onClick(event) {
      const action = event.target?.closest?.("[data-batch-action]")?.dataset.batchAction;
      if (action === "close") close();
      else if (action === "choose" && !applying && !reporting) get("equipmentBatchFile").click();
      else if (["apply", "apply-transfer", "apply-rent", "apply-purchase"].includes(action)) await apply(action === "apply" ? "" : action.slice(6));
      else if (action === "report-summary") await report("summary");
    }
    function onChange(event) {
      const element = event.target;
      if (element.id === "equipmentBatchFile") { read(element.files?.[0]); return; }
      if (busy || applying || reporting || !preview) return;
      if (element.dataset.batchSelect !== undefined) selections[Number(element.dataset.batchSelect)].selected = element.checked;
      if (element.dataset.batchReview !== undefined) selections[Number(element.dataset.batchReview)].scheduleReviewed = element.checked;
      if (element.dataset.batchDuplicate !== undefined) {
        const group = duplicateGroups(preview)[Number(element.dataset.batchDuplicate)];
        if (group) selections.forEach((selection) => {
          if (!group.eventIds.includes(selection.id)) return;
          selection.duplicateReviews[group.id] = element.value;
          if (element.value) selection.selected = element.value === "all" || selection.id === element.value;
        });
        dialog.querySelectorAll("[data-batch-select]").forEach((input) => { input.checked = selections[Number(input.dataset.batchSelect)].selected; });
      }
      if (element.dataset.batchField === "setupApplies") {
        const index = Number(element.dataset.batchIndex), selection = selections[index];
        if (selection) selection.setupApplies = element.value;
        dialog.querySelectorAll("[data-batch-mount]").forEach((input) => { if (Number(input.dataset.batchMount) === index) input.disabled = element.value === "no"; });
      }
      if (element.dataset.batchSheet !== undefined) {
        const sheet = preview.sheets[Number(element.dataset.batchSheet)];
        selections.forEach((selection, index) => { if (sheet.eventIds.includes(selection.id) && editableEvent(preview.events[index])) selection.selected = element.checked; });
        dialog.querySelectorAll("[data-batch-select]").forEach((input) => { input.checked = selections[Number(input.dataset.batchSelect)].selected; });
      }
      update();
    }
    function onInput(event) {
      const element = event.target; if (busy || applying || reporting || !element.dataset.batchField) return;
      const index = Number(element.dataset.batchIndex), selection = selections[index], field = element.dataset.batchField;
      if (selection) {
        const source = preview?.events[index];
        if (field === "date" && source?.scheduleDerivedFields?.endDate === "event.date" && !selection.endDateEdited && selection.endDate === selection.date && validTime(selection.startTime) && validTime(selection.endTime) && selection.endTime >= selection.startTime) {
          selection.endDate = element.value;
          dialog.querySelectorAll("[data-batch-field]").forEach((input) => { if (input.dataset.batchField === "endDate" && Number(input.dataset.batchIndex) === index) input.value = element.value; });
        }
        if (field === "endDate") selection.endDateEdited = true;
        selection[field] = element.value;
      }
      update();
    }
    function onCancel(event) { event.preventDefault(); close(); }
    dialog.addEventListener("click", onClick); dialog.addEventListener("change", onChange); dialog.addEventListener("input", onInput); dialog.addEventListener("cancel", onCancel); opener.addEventListener("click", open);
    doc.addEventListener?.("live:session-updated", update);
    const api = { open, openFile, close, read, getPreview: () => preview ? clone(preview) : null, getImported: () => imported ? { events: clone(imported.events), result: imported.result } : null, destroy() { if (applying || reporting) return false; close(); imported = null; opener.removeEventListener("click", open); doc.removeEventListener?.("live:session-updated", update); dialog.remove(); instances.delete(doc); return true; } };
    instances.set(doc, api); return api;
  }
  return { selectionsFor, selectionError, prepareEvents, totals, renderPreview, renderEvent, markup, init };
});
