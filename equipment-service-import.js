(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentServiceImport = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const NEW_CATEGORY = "__new__";
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const string = (value) => value === undefined || value === null ? "" : String(value);
  const escape = (value) => string(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const key = (value) => string(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

  function draftFor(preview) {
    return (preview?.services || []).map((service) => ({
      name: string(service.name).trim(),
      category: "",
      newCategory: ""
    }));
  }

  function verificationError(preview) {
    if (!Array.isArray(preview?.services) || !preview.services.length) {
      return "El archivo no contiene cuadros de servicio que se puedan guardar.";
    }
    if (preview?.verification?.complete !== true) {
      return "No se pudo conservar todo el contenido del archivo. Revise las advertencias antes de volver a importarlo.";
    }
    if (!string(preview.importToken).trim()) {
      return "La revisión del archivo no está disponible. Elija el archivo nuevamente.";
    }
    return "";
  }

  function selectionError(preview, selections, groups) {
    const invalidPreview = verificationError(preview);
    if (invalidPreview) return invalidPreview;
    if (!Array.isArray(selections) || selections.length !== preview.services.length) {
      return "Revise el nombre y la categoría de cada servicio.";
    }
    for (let index = 0; index < selections.length; index += 1) {
      const selection = selections[index];
      const prefix = `Servicio ${index + 1}: `;
      if (!string(selection.name).trim()) return `${prefix}escriba un nombre.`;
      if (selection.category === NEW_CATEGORY) {
        if (!string(selection.newCategory).trim()) return `${prefix}escriba el nombre de la nueva categoría.`;
        if ((groups || []).some((group) => key(group.label) === key(selection.newCategory))) {
          return `${prefix}esa categoría ya existe. Elíjala en la lista.`;
        }
      } else if (!(groups || []).some((group) => string(group.id) === selection.category)) {
        return `${prefix}elija una categoría existente o cree una nueva.`;
      }
    }
    return "";
  }

  function createPayload(preview, selections, groups, baseCatalogVersion) {
    const error = selectionError(preview, selections, groups);
    if (error) throw new Error(error);
    return {
      baseCatalogVersion: string(baseCatalogVersion),
      importToken: string(preview.importToken),
      services: selections.map((selection, index) => ({
        index,
        name: string(selection.name).trim(),
        ...(selection.category === NEW_CATEGORY
          ? { groupLabel: string(selection.newCategory).trim() }
          : { groupId: selection.category })
      }))
    };
  }

  function cellValue(cell) {
    const value = cell?.value !== undefined ? cell.value : cell?.text;
    return typeof value === "object" && value !== null ? JSON.stringify(value) : string(value);
  }

  function renderCells(cells) {
    if (!Array.isArray(cells) || !cells.length) return "";
    return `<div class="equipment-service-import-table-wrap"><table class="equipment-service-import-table"><thead><tr><th scope="col">Ubicación</th><th scope="col">Contenido</th></tr></thead><tbody>${cells.map((cell) => {
      const location = cell?.ref || [cell?.sheet, cell?.address || [cell?.row, cell?.column].filter((part) => part !== undefined && part !== null).join(":")].filter(Boolean).join(" · ");
      return `<tr><td>${escape(location)}</td><td>${escape(cellValue(cell))}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function renderSource(preview) {
    const cells = Array.isArray(preview?.sourceCells) ? preview.sourceCells : [];
    const lines = Array.isArray(preview?.documentLines) ? preview.documentLines : [];
    if (!cells.length && !lines.length) return "";
    return `<details class="equipment-service-import-source" id="equipmentServiceImportSource"><summary>Ver todo el contenido del archivo (${cells.length ? `${cells.length} celdas` : `${lines.length} líneas`})</summary>${renderCells(cells)}${lines.length ? `<h4>Texto original del PDF</h4><div class="equipment-service-import-table-wrap"><table class="equipment-service-import-table"><thead><tr><th scope="col">Ubicación</th><th scope="col">Contenido</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${escape(line.ref || `Página ${line.page}, línea ${line.line}`)}</td><td>${escape(line.text !== undefined ? line.text : (line.cells || []).map(cellValue).join(" · "))}</td></tr>`).join("")}</tbody></table></div>` : ""}</details>`;
  }

  function renderNotes(notes) {
    if (!Array.isArray(notes) || !notes.length) return "";
    return notes.map((note) => `<p class="equipment-service-import-notes">${escape(typeof note === "object" && note !== null ? note.text ?? note.description ?? JSON.stringify(note) : note)}</p>`).join("");
  }

  function renderSection(section) {
    const rows = Array.isArray(section?.rows) && section.rows.length ? section.rows : (section?.items || []).map((item) => ({
      type: "item",
      quantity: Array.isArray(item) ? item[0] : item.quantity,
      description: Array.isArray(item) ? item[1] : item.description,
      cells: []
    }));
    return `<section class="equipment-service-import-section"><h4>${escape(section?.title || "Cuadro de equipo")}</h4>${rows.length ? `<div class="equipment-service-import-table-wrap"><table class="equipment-service-import-table"><thead><tr><th scope="col" class="equipment-service-import-quantity">Cantidad</th><th scope="col">Descripción, encabezado u observación</th><th scope="col">Otras celdas</th></tr></thead><tbody>${rows.map((row) => {
      const quantity = row.quantity === undefined || row.quantity === null ? "" : row.quantity;
      const additional = (row.cells || []).filter((cell) => cellValue(cell) !== string(row.description) && !(quantity !== "" && cellValue(cell) === string(quantity))).map(cellValue).join("\n");
      return `<tr data-import-row-type="${escape(row.type || "item")}"><td class="equipment-service-import-quantity">${escape(quantity)}</td><td>${escape(row.description)}</td><td>${escape(additional)}</td></tr>`;
    }).join("")}</tbody></table></div>` : ""}${renderNotes(section?.notes)}</section>`;
  }

  function categoryOptions(groups, selected) {
    return `<option value="">Elija una opción</option>${(groups || []).map((group) => `<option value="${escape(group.id)}"${selected === string(group.id) ? " selected" : ""}>Agregar en ${escape(group.label)}</option>`).join("")}<option value="${NEW_CATEGORY}"${selected === NEW_CATEGORY ? " selected" : ""}>Crear nueva categoría</option>`;
  }

  function renderCard(service, selection, index, groups) {
    const notes = renderNotes(service.notes);
    return `<article class="equipment-service-import-card" data-import-service="${index}"><h3>Servicio ${index + 1}</h3><div class="equipment-service-import-fields"><label for="equipmentImportServiceName${index}">Nombre del tipo de servicio<input id="equipmentImportServiceName${index}" type="text" data-import-field="name" data-import-index="${index}" value="${escape(selection.name)}" autocomplete="off" maxlength="240" /></label><label for="equipmentImportServiceCategory${index}">Dónde guardar este servicio<select id="equipmentImportServiceCategory${index}" data-import-field="category" data-import-index="${index}">${categoryOptions(groups, selection.category)}</select></label><label for="equipmentImportServiceNewCategory${index}" class="equipment-service-import-new-category" data-import-new-category="${index}"${selection.category !== NEW_CATEGORY ? " hidden" : ""}>Nombre de la nueva categoría<input id="equipmentImportServiceNewCategory${index}" type="text" data-import-field="newCategory" data-import-index="${index}" value="${escape(selection.newCategory)}" autocomplete="off" maxlength="160" placeholder="Ej. Servicio especial" /></label></div>${(service.mainSections || []).map(renderSection).join("")}${notes}${Array.isArray(service.sourceCells) && service.sourceCells.length ? `<details class="equipment-service-import-source"><summary>Contenido original de este servicio</summary>${renderCells(service.sourceCells)}</details>` : ""}</article>`;
  }

  function renderPreview(preview, selections, groups) {
    const source = preview.source || {};
    const services = preview.services || [];
    const count = services.reduce((total, service) => total + (service.mainSections || []).reduce((sum, section) => sum + (section.items || []).length, 0), 0);
    const sourceCount = preview.verification?.sourceCellCount;
    const preservedCount = preview.verification?.representedCellCount;
    const verification = Number.isInteger(sourceCount) && Number.isInteger(preservedCount) ? ` · ${preservedCount} de ${sourceCount} celdas conservadas` : "";
    const warnings = (preview.warnings || []).map((warning) => typeof warning === "object" && warning !== null ? warning.message ?? warning.text ?? JSON.stringify(warning) : warning);
    const blocker = verificationError(preview);
    const replacement = preview.replaces && Number(preview.replaces.count) > 0
      ? `<div class="equipment-service-import-notice is-warning"><strong>Este archivo reemplazará los servicios importados anteriormente desde este mismo libro.</strong><p>${escape(preview.replaces.count)} ${Number(preview.replaces.count) === 1 ? "servicio se sustituirá" : "servicios se sustituirán"} con el contenido completo de esta versión.</p>${Array.isArray(preview.replaces.serviceNames) && preview.replaces.serviceNames.length ? `<ul>${preview.replaces.serviceNames.map((name) => `<li>${escape(name)}</li>`).join("")}</ul>` : ""}</div>`
      : "";
    const bulk = services.length > 1 ? `<section class="equipment-service-import-bulk"><h3>Usar la misma categoría para todos</h3><div class="equipment-service-import-fields"><label for="equipmentImportBulkCategory">Categoría<select id="equipmentImportBulkCategory">${categoryOptions(groups, "")}</select></label><label for="equipmentImportBulkNewCategory" id="equipmentImportBulkNewCategoryLabel" hidden>Nombre de la nueva categoría<input id="equipmentImportBulkNewCategory" type="text" autocomplete="off" maxlength="160" /></label></div><button id="equipmentImportApplyBulkCategory" type="button">Aplicar a todos</button></section>` : "";
    return `<p class="equipment-service-import-summary"><strong>${escape(source.fileName || "Archivo importado")}</strong><br>${services.length} ${services.length === 1 ? "servicio" : "servicios"} · ${count} ${count === 1 ? "fila de equipo" : "filas de equipo"}${escape(verification)}</p><p class="equipment-service-import-notice">Cada cuadro se guardará como un tipo de servicio. Elija una categoría existente o cree una nueva; los datos del archivo se conservarán completos.</p>${replacement}${blocker ? `<p class="equipment-service-import-notice is-error">${escape(blocker)}</p>` : ""}${warnings.length ? `<div class="equipment-service-import-notice is-warning"><strong>Revise estas observaciones</strong><ul>${warnings.map((warning) => `<li>${escape(warning)}</li>`).join("")}</ul></div>` : ""}${bulk}${services.map((service, index) => renderCard(service, selections[index], index, groups)).join("")}${renderSource(preview)}`;
  }

  function init(options = {}) {
    if (typeof document === "undefined") return null;
    const ids = {
      opener: "equipmentImportServiceFileButton", input: "equipmentServiceImportFileInput", dialog: "equipmentServiceImportDialog",
      content: "equipmentServiceImportContent", status: "equipmentServiceImportDialogStatus", pageStatus: "equipmentServiceImportStatus",
      close: "equipmentServiceImportCloseButton", cancel: "equipmentServiceImportCancelButton", choose: "equipmentServiceImportChooseButton", save: "equipmentServiceImportSaveButton"
    };
    const elements = Object.fromEntries(Object.entries(ids).map(([name, id]) => [name, document.getElementById(id)]));
    if (Object.values(elements).some((element) => !element)) return null;
    if (elements.opener.dataset.importInitialized === "true") return null;
    elements.opener.dataset.importInitialized = "true";
    let state = { preview: null, selections: [], busy: false, committed: false, request: null, requestId: 0 };
    const groups = () => clone(typeof options.groups === "function" ? options.groups() || [] : options.groups || []);
    const baseVersion = () => typeof options.baseVersion === "function" ? options.baseVersion() : options.baseVersion;

    function status(message, error = false) {
      elements.status.textContent = message;
      elements.status.dataset.error = error ? "true" : "false";
    }

    function updateSave() {
      elements.save.disabled = state.busy || state.committed || !!selectionError(state.preview, state.selections, groups());
      elements.choose.disabled = state.busy && state.preview !== null;
      elements.close.disabled = state.busy && state.preview !== null;
      elements.cancel.disabled = state.busy && state.preview !== null;
    }

    function close() {
      if (state.busy && state.preview !== null) return;
      if (state.preview?.importToken && !state.committed) {
        fetch("/api/cuadros-equipo/importar-archivo/" + encodeURIComponent(state.preview.importToken),
          { method: "DELETE", credentials: "same-origin" }).catch(() => {});
      }
      state.requestId += 1;
      if (state.request) state.request.abort();
      state.request = null;
      state.busy = false;
      if (elements.dialog.open) elements.dialog.close();
      elements.input.value = "";
      state.preview = null;
      state.selections = [];
      state.committed = false;
      elements.opener.focus();
    }

    function choose() {
      if (state.busy && state.preview !== null) return;
      close();
      elements.input.click();
    }

    async function importFile(file) {
      if (!file) return;
      state.requestId += 1;
      const requestId = state.requestId;
      state.preview = null;
      state.selections = [];
      state.committed = false;
      state.busy = true;
      state.request = new AbortController();
      elements.content.innerHTML = `<p class="equipment-service-import-summary"><strong>${escape(file.name)}</strong></p><p class="equipment-service-import-notice" role="status">Leyendo los cuadros y comparando todo el contenido…</p>`;
      status("El archivo se revisa antes de guardar los servicios.");
      updateSave();
      elements.pageStatus.textContent = "";
      if (!elements.dialog.open) elements.dialog.showModal();
      try {
        if (!/\.(xlsx|pdf)$/i.test(file.name)) throw new Error("Seleccione un archivo Excel .xlsx o un PDF con texto. Para archivos .xls, guarde primero una copia .xlsx.");
        if (file.size > MAX_FILE_SIZE) throw new Error("El archivo supera el tamaño máximo de 15 MB.");
        const bytes = await file.arrayBuffer();
        if (requestId !== state.requestId) return;
        const response = await fetch("/api/cuadros-equipo/importar-archivo", {
          method: "POST", credentials: "same-origin", signal: state.request.signal,
          headers: { "Content-Type": /\.pdf$/i.test(file.name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "X-File-Name": encodeURIComponent(file.name) },
          body: bytes
        });
        const preview = await response.json().catch(() => ({}));
        if (requestId !== state.requestId) return;
        if (!response.ok) throw new Error(preview.error || "No se pudo leer el archivo. Vuelva a intentarlo.");
        state.preview = preview;
        state.selections = draftFor(preview);
        elements.content.innerHTML = renderPreview(preview, state.selections, groups());
        status(verificationError(preview) || "Elija dónde guardar cada servicio.", !!verificationError(preview));
        elements.content.querySelector('[data-import-field="category"]')?.focus();
      } catch (error) {
        if (requestId !== state.requestId || error.name === "AbortError") return;
        elements.content.innerHTML = `<p class="equipment-service-import-notice is-error">${escape(error.message || "No se pudo leer el archivo.")}</p>`;
        status("Elija otro archivo o vuelva a intentar la importación.", true);
      } finally {
        if (requestId === state.requestId) {
          state.busy = false;
          state.request = null;
          updateSave();
        }
      }
    }

    function updateField(target) {
      const index = Number(target.dataset.importIndex);
      const field = target.dataset.importField;
      if (!Number.isInteger(index) || !state.selections[index] || !["name", "category", "newCategory"].includes(field)) return;
      state.selections[index][field] = target.value;
      if (field === "category") {
        elements.content.querySelector(`[data-import-new-category="${index}"]`).hidden = target.value !== NEW_CATEGORY;
      }
      const error = selectionError(state.preview, state.selections, groups());
      status(error || "Todo listo. Guarde los servicios para que queden disponibles.");
      updateSave();
    }

    function applyBulkCategory() {
      if (state.busy || !state.preview) return;
      const category = document.getElementById("equipmentImportBulkCategory").value;
      const label = document.getElementById("equipmentImportBulkNewCategory").value;
      if (!category || category === NEW_CATEGORY && !label.trim()) {
        status("Elija una categoría; si es nueva, escriba su nombre.", true);
        return;
      }
      state.selections.forEach((selection) => {
        selection.category = category;
        selection.newCategory = category === NEW_CATEGORY ? label : "";
      });
      elements.content.innerHTML = renderPreview(state.preview, state.selections, groups());
      status(selectionError(state.preview, state.selections, groups()) || "La categoría se aplicó a todos los servicios.");
      updateSave();
    }

    async function save() {
      if (state.busy || state.committed || !state.preview) return;
      let body;
      try {
        body = createPayload(state.preview, state.selections, groups(), baseVersion());
      } catch (error) {
        status(error.message, true);
        updateSave();
        return;
      }
      state.busy = true;
      updateSave();
      const disabledFields = [...elements.content.querySelectorAll("input,select,button")];
      disabledFields.forEach((field) => { field.disabled = true; });
      status("Guardando los nuevos tipos de servicio…");
      try {
        const response = await fetch("/api/cuadros-equipo/importar-servicios", {
          method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "No se pudieron guardar los servicios. Sus opciones siguen disponibles para reintentar.");
        state.committed = true;
        if (typeof options.onSaved === "function") await options.onSaved(payload);
        const count = state.selections.length;
        state.busy = false;
        close();
        elements.pageStatus.textContent = `${count === 1 ? "El nuevo tipo de servicio quedó guardado" : `Los ${count} nuevos tipos de servicio quedaron guardados`} y disponible${count === 1 ? "" : "s"} en la lista de servicios.`;
      } catch (error) {
        status(state.committed ? "Los servicios quedaron guardados. Recargue la página para actualizar la lista." : error.message || "No se pudieron guardar los servicios. Vuelva a intentarlo.", true);
      } finally {
        state.busy = false;
        disabledFields.forEach((field) => { field.disabled = state.committed; });
        updateSave();
      }
    }

    elements.opener.addEventListener("click", async () => {
      if (typeof options.beforeOpen === "function") {
        elements.opener.disabled = true;
        try {
          await options.beforeOpen();
        } catch (error) {
          elements.pageStatus.textContent = error.message || "No se pudo cargar la lista de categorías. Vuelva a intentarlo.";
          return;
        } finally {
          elements.opener.disabled = false;
        }
      }
      elements.input.value = "";
      elements.input.click();
    });
    elements.input.addEventListener("change", () => importFile(elements.input.files[0]));
    elements.close.addEventListener("click", close);
    elements.cancel.addEventListener("click", close);
    elements.choose.addEventListener("click", choose);
    elements.save.addEventListener("click", save);
    elements.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    elements.content.addEventListener("input", (event) => updateField(event.target));
    elements.content.addEventListener("change", (event) => {
      if (event.target.id === "equipmentImportBulkCategory") {
        document.getElementById("equipmentImportBulkNewCategoryLabel").hidden = event.target.value !== NEW_CATEGORY;
      } else updateField(event.target);
    });
    elements.content.addEventListener("click", (event) => {
      if (event.target.closest("#equipmentImportApplyBulkCategory")) applyBulkCategory();
    });
    return { openFile: importFile, close, getState: () => clone({ preview: state.preview, selections: state.selections, busy: state.busy, committed: state.committed }) };
  }

  return { init, draftFor, selectionError, createPayload, renderPreview, NEW_CATEGORY };
});
