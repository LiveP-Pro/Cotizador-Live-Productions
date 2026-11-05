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
  function selectionsFor(preview) {
    return (preview?.events || []).map((event) => ({ id: event.id, selected: event.canImport === true, date: text(event.date), place: text(event.place), type: text(event.type), name: text(event.client || event.name) }));
  }
  function selectionError(preview, selections) {
    if (preview?.verification?.complete !== true) return "La revisión no conserva todas las celdas originales. No se cargó ningún evento; revise la fuente.";
    const chosen = (selections || []).filter((selection) => selection.selected);
    if (!chosen.length) return "Seleccione al menos un cuadro de evento que se pueda cargar.";
    if (chosen.some((selection) => !(preview.events || []).some((event) => event.id === selection.id && event.canImport === true))) return "Hay un cuadro pendiente de interpretar. Revise el archivo antes de cargarlo.";
    if (new Set(chosen.map((selection) => selection.id)).size !== chosen.length) return "El mismo cuadro está seleccionado más de una vez.";
    for (const entry of chosen) {
      if (entry.date && !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return "Revise las fechas de los eventos seleccionados.";
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
      output.serviceName = output.documentServiceName || "Cuadro personalizado";
      output.pendingLogistics = true; output.snapshotLocked = true;
      // Corrections are distinct from the immutable source ledger and cannot
      // overwrite the original event date/client/location or source cells.
      output.sourceImport.reviewedMetadata = { date: output.date, place: output.place, name: output.name, type: output.type };
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
    return `<article class="equipment-batch-card" data-batch-card="${index}"><header><label class="equipment-batch-choice"><input type="checkbox" data-batch-select="${index}"${selection.selected ? " checked" : ""}${!event.canImport ? " disabled" : ""}><strong>${escape(event.place || event.client || `Cuadro ${index + 1}`)}</strong></label><span>${escape(event.sourceSheet)} · Cuadro ${index + 1}</span></header><p>${event.itemCount} líneas de equipo · ${event.zeroCount} cantidades en 0 · ${(event.sourceCells || []).length} celdas conservadas</p><div class="equipment-batch-fields">${fields.map(([field, label, type]) => `<label>${label}<input type="${type}" data-batch-field="${field}" data-batch-index="${index}" value="${escape(selection[field])}"${!event.canImport ? " disabled" : ""}></label>`).join("")}</div>${event.contracted ? `<p class="equipment-batch-contract"><strong>Equipo contratado:</strong> ${escape(event.contracted)}</p>` : ""}${event.issues?.length ? `<div class="equipment-batch-error"><strong>Este cuadro necesita revisión de la fuente</strong><ul>${event.issues.map((issue) => `<li>${escape(issue.message)}${issue.refs?.length ? ` (${escape(issue.refs.join(", "))})` : ""}</li>`).join("")}</ul></div>` : ""}${event.warnings?.length ? `<ul class="equipment-batch-warnings">${event.warnings.map((warning) => `<li>${escape(warning.message)}</li>`).join("")}</ul>` : ""}<details class="equipment-batch-source"><summary>Revisar cuadro completo y sus categorías</summary><div class="equipment-batch-table-scroll"><table><thead><tr><th>Cantidad</th><th>Descripción, encabezado u observación</th><th>Origen</th></tr></thead><tbody>${(event.sections || []).flatMap((section) => section.rows || []).map((row) => `<tr data-batch-row-type="${escape(row.type)}"><td>${row.quantity === null || row.quantity === undefined ? "" : escape(row.quantity)}</td><td>${escape(row.description)}${row.notes?.length ? `<small>${escape(row.notes.join(" · "))}</small>` : ""}</td><td>${escape((row.cells || []).map((cell) => cell.address || cell.ref).join(", "))}</td></tr>`).join("")}</tbody></table></div></details>${renderSource(event.sourceCells || [])}</article>`;
  }
  function renderPreview(preview, selections) {
    const sheets = preview.sheets || [];
    return `<p class="equipment-batch-summary"><strong>${escape(preview.source?.fileName || "Archivo")}</strong><br>${preview.events.length} cuadros detectados · ${preview.verification.representedCellCount} de ${preview.verification.sourceCellCount} celdas conservadas</p><p class="equipment-batch-notice">Seleccione las pestañas y los cuadros que corresponden a eventos. Puede corregir sus datos sin alterar la fuente. Se cargarán como borradores, sin reservar equipo ni modificar el inventario.</p><fieldset class="equipment-batch-sheets"><legend>Pestañas del archivo</legend>${sheets.map((sheet, index) => {
      const available = preview.events.map((event, eventIndex) => ({ event, selection: selections[eventIndex] })).filter((entry) => sheet.eventIds.includes(entry.event.id) && entry.event.canImport);
      return `<label><input type="checkbox" data-batch-sheet="${index}"${available.length && available.every((entry) => entry.selection.selected) ? " checked" : ""}${!available.length ? " disabled" : ""}>${escape(sheet.name)} <small>${sheet.sourceCellCount} celdas</small></label>`;
    }).join("")}</fieldset><p id="equipmentBatchTotals" class="equipment-batch-summary" role="status"></p>${preview.events.map((event, index) => renderEvent(event, selections[index], index)).join("")}`;
  }
  function markup() {
    return `<header class="equipment-batch-header"><div><p>1. Cargar eventos</p><h2 id="equipmentBatchTitle">Importar varios eventos</h2></div><button type="button" data-batch-action="close" aria-label="Cerrar sin cargar">×</button></header><div class="equipment-batch-body"><p class="equipment-batch-notice">Cargue un libro Excel .xlsx con varias pestañas o cuadros, o un PDF digital con columnas Cantidad y Descripción. Los encabezados, observaciones y cantidades en 0 se conservan. No se deducen horarios.</p><input id="equipmentBatchFile" type="file" accept=".xlsx,.pdf" hidden><button type="button" data-batch-action="choose">Elegir Excel o PDF</button><div id="equipmentBatchContent"></div></div><footer class="equipment-batch-footer"><p id="equipmentBatchStatus" role="status" aria-live="polite"></p><div><button type="button" data-batch-action="close">Cancelar</button><button type="button" id="equipmentBatchApply" data-batch-action="apply" disabled>Cargar eventos como borradores</button></div></footer>`;
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
    function update() {
      const counts = totals(preview, selections), node = get("equipmentBatchTotals");
      if (node) node.textContent = `${counts.events} eventos seleccionados · ${counts.items} líneas de equipo · ${counts.zeros} cantidades en 0 · ${counts.cells} celdas`;
      get("equipmentBatchApply").disabled = busy || applying || !!selectionError(preview, selections);
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
        status(result.verification.complete ? "Revise los eventos y seleccione cuáles cargar. Los horarios y el inventario se resolverán después." : selectionError(preview, selections), !result.verification.complete);
      } catch (error) {
        if (token !== generation || error.name === "AbortError") return;
        get("equipmentBatchContent").textContent = "No se cargó ningún evento."; status(error.message || "No se pudo leer el archivo.", true);
      } finally { if (token === generation) { busy = false; request = null; update(); } }
    }
    async function onClick(event) {
      const action = event.target?.closest?.("[data-batch-action]")?.dataset.batchAction;
      if (action === "close") close();
      else if (action === "choose" && !applying) get("equipmentBatchFile").click();
      else if (action === "apply" && !busy && !applying) {
        try {
          const events = prepareEvents(preview, selections), connection = bridge();
          if (typeof connection?.importEvents !== "function") throw new Error("No está disponible la conexión con los borradores. El archivo se conserva para reintentar.");
          applying = true; update(); status("Cargando los borradores completos…");
          const result = await connection.importEvents(events);
          applying = false;
          if (typeof options.onImported === "function") options.onImported(result, events);
          close();
        } catch (error) { applying = false; update(); status(error.message || "No se pudieron cargar los borradores.", true); }
      }
    }
    function onChange(event) {
      const element = event.target;
      if (element.id === "equipmentBatchFile") { read(element.files?.[0]); return; }
      if (busy || applying || !preview) return;
      if (element.dataset.batchSelect !== undefined) selections[Number(element.dataset.batchSelect)].selected = element.checked;
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
    const api = { open, close, read, getPreview: () => preview ? clone(preview) : null, destroy() { if (applying) return false; close(); opener.removeEventListener("click", open); dialog.remove(); instances.delete(doc); return true; } };
    instances.set(doc, api); return api;
  }
  return { selectionsFor, selectionError, prepareEvents, totals, renderPreview, renderEvent, markup, init };
});
