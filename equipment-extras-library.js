(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentExtrasLibrary = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  const ENDPOINT = "/api/cuadros-equipo/extras";
  const instances = new WeakMap();
  const text = (value) => value === null || value === undefined ? "" : String(value);
  const key = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const escape = (value) => text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function positiveQuantity(value) {
    if (typeof value !== "number" && typeof value !== "string") return null;
    if (!text(value).trim()) return null;
    const quantity = Number(value);
    return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
  }

  // Only the current warehouse records supplied by the host are used here.
  // Search similarity never establishes a physical inventory relationship.
  function inventoryChoices(records) {
    const seen = new Set();
    return (Array.isArray(records) ? records : []).flatMap((record) => {
      if (!record || record.archived || record.deleted) return [];
      const item = record.item || record;
      if (item.archived || item.deleted) return [];
      const id = text(record.warehouseInventoryId || record.id || item.id).trim();
      const name = text(item.name ?? item.description ?? record.name ?? record.description).trim();
      if (!id || !name || seen.has(id)) return [];
      seen.add(id);
      const category = text(item.category ?? record.category ?? record.inventoryCategory).trim();
      const consumable = record.consumable === true || item.itemType === "consumible" || item.type === "consumible" || record.itemType === "consumible";
      return [{ id, warehouseInventoryId: id, name, category, itemType: consumable ? "consumible" : "equipo" }];
    });
  }

  function inventoryLookup(records) {
    const choices = inventoryChoices(records);
    const ids = new Map(choices.map((choice) => [choice.id, choice]));
    const names = new Map();
    const signature = (name, category) => JSON.stringify([key(name), key(category)]);
    for (const choice of choices) {
      const value = signature(choice.name, choice.category);
      if (!names.has(value)) names.set(value, []);
      names.get(value).push(choice);
    }
    return (extra) => {
      const id = text(extra?.warehouseInventoryId).trim();
      if (id) return ids.get(id) || null;
      if (!key(extra?.description)) return null;
      const matches = names.get(signature(extra.description, extra?.category ?? extra?.inventoryCategory)) || [];
      return matches.length === 1 ? matches[0] : null;
    };
  }

  function currentInventoryItem(extra, records) {
    return inventoryLookup(records)(extra);
  }

  function draftPayload(draft, records, revision) {
    const description = text(draft?.description).trim();
    const category = text(draft?.category).trim();
    const defaultQuantity = positiveQuantity(draft?.defaultQuantity);
    if (!description) throw new Error("Escriba la descripción del extra.");
    if (!category) throw new Error("Escriba la categoría del extra.");
    if (defaultQuantity === null) throw new Error("La cantidad debe ser un número entero mayor que cero.");
    const matched = currentInventoryItem(draft, records);
    if (draft?.warehouseInventoryId && !matched) throw new Error("El registro seleccionado ya no está en el inventario actual. Seleccione el equipo nuevamente.");
    if (matched && (key(description) !== key(matched.name) || key(category) !== key(matched.category))) {
      throw new Error("La descripción o categoría cambió. Seleccione nuevamente el equipo del inventario.");
    }
    const itemType = matched?.itemType || (draft?.itemType === "consumible" ? "consumible" : "equipo");
    return { description, category, defaultQuantity, itemType,
      ...(matched ? { warehouseInventoryId: matched.id } : {}),
      ...(revision !== undefined && revision !== null ? { revision } : {}) };
  }

  function selectionPayload(extra, quantityValue, action, records) {
    const quantity = positiveQuantity(quantityValue);
    if (quantity === null) throw new Error("Ingrese una cantidad entera mayor que cero.");
    const matched = currentInventoryItem(extra, records);
    if (!matched && extra.itemType === "consumible" && action === "rent") {
      throw new Error("Los consumibles faltantes se deben comprar. Seleccione Comprar para generar esa necesidad.");
    }
    if (!matched && action !== "rent" && action !== "purchase") {
      throw new Error("Elija Rentar o Comprar para este extra que no está en el inventario actual.");
    }
    return {
      libraryExtraId: text(extra.id), description: text(extra.description), quantity,
      inventoryCategory: matched?.category || text(extra.category),
      itemType: matched?.itemType || (extra.itemType === "consumible" ? "consumible" : "equipo"),
      ...(matched ? { warehouseInventoryId: matched.id } : { procurementChoice: action })
    };
  }

  function filterItems(items, query) {
    const tokens = key(query).split(" ").filter(Boolean);
    return (Array.isArray(items) ? items : []).filter((item) => !item.archived && !item.deleted && tokens.every((token) => key(item.description + " " + text(item.category)).includes(token)));
  }

  function renderItems(items, query, records) {
    const filtered = filterItems(items, query);
    if (!filtered.length) return '<p class="equipment-extras-empty">' + (query ? "No se encontraron extras. Pruebe otra búsqueda." : "Su biblioteca está vacía. Guarde un extra para usarlo en sus eventos.") + "</p>";
    const lookup = inventoryLookup(records);
    const names = new Map();
    const signature = (item) => JSON.stringify([key(item.description), key(item.category)]);
    for (const item of filtered) { const name = signature(item); names.set(name, (names.get(name) || 0) + 1); }
    return filtered.map((item) => {
      const known = lookup(item);
      const ambiguousName = names.get(signature(item)) > 1;
      const identity = ambiguousName && known ? `<p class="equipment-extras-item-stock">Registro de inventario: ${escape(known.id)}</p>` : "";
      return `<article class="equipment-extras-item"><div><h3>${escape(item.description)}</h3><p>${escape(item.category)} · ${item.itemType === "consumible" ? "Consumible" : "Equipo"}</p><p class="equipment-extras-item-stock">${known ? "Vinculado a Contabilidad de Equipo" : "Al agregar: elegir renta o compra"}</p>${identity}</div><div class="equipment-extras-item-actions"><button type="button" data-extra-select="${escape(item.id)}">Agregar</button><button type="button" class="equipment-extras-remove" data-extra-remove="${escape(item.id)}" aria-label="Retirar ${escape(item.description)} de la biblioteca" title="Retirar de la biblioteca">×</button></div></article>`;
    }).join("");
  }

  function shell() {
    return `<dialog class="equipment-extras-dialog" id="equipmentExtrasLibraryDialog" aria-labelledby="equipmentExtrasLibraryTitle"><div class="equipment-extras-shell"><header class="equipment-extras-header"><div><h2 id="equipmentExtrasLibraryTitle">Extras</h2><p>Guarde extras para reutilizarlos en sus eventos. Las existencias se consultan en Contabilidad de Equipo.</p></div><button type="button" id="equipmentExtrasLibraryClose" aria-label="Cerrar biblioteca de extras">×</button></header><div class="equipment-extras-content"><section class="equipment-extras-create"><h3>Guardar un nuevo extra</h3><p>Se guarda en la biblioteca. Esto no registra una compra ni un ingreso a bodega.</p><form id="equipmentExtrasLibraryForm" novalidate><div class="equipment-extras-fields"><label class="equipment-extras-description">Descripción<input id="equipmentExtrasDescription" name="description" type="text" autocomplete="off" required /></label><label>Categoría<input id="equipmentExtrasCategory" name="category" type="text" value="Extras" autocomplete="off" required /></label><label>Tipo<select id="equipmentExtrasItemType" name="itemType"><option value="equipo">Equipo</option><option value="consumible">Consumible</option></select></label><label>Cantidad inicial al seleccionarlo<input id="equipmentExtrasDefaultQuantity" name="defaultQuantity" type="number" min="1" step="1" value="1" required /></label></div><button type="submit" id="equipmentExtrasCreate">Guardar en biblioteca</button></form></section><section class="equipment-extras-browse"><div class="equipment-extras-search"><label for="equipmentExtrasSearch">Buscar extras<input id="equipmentExtrasSearch" type="search" autocomplete="off" placeholder="Descripción o categoría" /></label><button type="button" id="equipmentExtrasRefresh">Actualizar lista</button></div><p id="equipmentExtrasCount" class="equipment-extras-count"></p><div id="equipmentExtrasList"></div></section></div><footer class="equipment-extras-footer"><p id="equipmentExtrasLibraryStatus" role="status" aria-live="polite"></p><button type="button" id="equipmentExtrasLibraryCancel">Cerrar</button></footer></div></dialog><dialog class="equipment-extras-dialog equipment-extras-small" id="equipmentExtrasQuantityDialog" aria-labelledby="equipmentExtrasQuantityTitle"><header class="equipment-extras-header"><div><h2 id="equipmentExtrasQuantityTitle">¿Cuántas quieres?</h2><p id="equipmentExtrasSelectedName"></p></div><button type="button" id="equipmentExtrasQuantityClose" aria-label="Cerrar selección del extra">×</button></header><form id="equipmentExtrasQuantityForm" novalidate><div class="equipment-extras-content"><label class="equipment-extras-quantity-label" for="equipmentExtrasQuantity">Cantidad<input id="equipmentExtrasQuantity" type="number" min="1" step="1" required /></label><fieldset id="equipmentExtrasUnknown"><legend>¿Qué acción deseas tomar?</legend><p>No reconozco este equipo en el inventario actual. Elija cómo cubrir esta necesidad.</p><label><input type="radio" name="extraProcurement" id="equipmentExtrasRent" value="rent" /> Rentar</label><label><input type="radio" name="extraProcurement" id="equipmentExtrasPurchase" value="purchase" /> Comprar</label><p>Comprar prepara la necesidad de compra; las existencias aumentan al confirmar el ingreso real en Contabilidad de Equipo.</p></fieldset></div><footer class="equipment-extras-footer"><p id="equipmentExtrasQuantityStatus" role="status" aria-live="polite"></p><div><button type="button" id="equipmentExtrasQuantityCancel">Cancelar</button><button type="submit" id="equipmentExtrasAdd">Agregar al evento</button></div></footer></form></dialog><dialog class="equipment-extras-dialog equipment-extras-small" id="equipmentExtrasRemoveDialog" aria-labelledby="equipmentExtrasRemoveTitle"><header class="equipment-extras-header"><h2 id="equipmentExtrasRemoveTitle">Retirar de la biblioteca</h2><button type="button" id="equipmentExtrasRemoveClose" aria-label="Cerrar retiro del extra">×</button></header><div class="equipment-extras-content"><p id="equipmentExtrasRemoveName"></p><p>Este extra dejará de aparecer para nuevas selecciones. Los eventos anteriores, el inventario y sus movimientos se conservan.</p></div><footer class="equipment-extras-footer"><p id="equipmentExtrasRemoveStatus" role="status" aria-live="polite"></p><div><button type="button" id="equipmentExtrasRemoveCancel">Cancelar</button><button type="button" id="equipmentExtrasRemoveConfirm">Retirar de biblioteca</button></div></footer></dialog>`;
  }

  function init(options = {}) {
    const document = options.document || (typeof globalThis.document === "object" ? globalThis.document : null);
    if (!document?.body) return null;
    const opener = document.getElementById(options.openerId || "equipmentExtrasLibraryButton");
    if (!opener) return null;
    const previous = instances.get(opener);
    if (previous) return previous;
    const fetcher = options.fetch || (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
    const host = document.createElement("div");
    host.className = "equipment-extras-host";
    host.innerHTML = shell();
    document.body.appendChild(host);
    const get = (id) => document.getElementById(id);
    const dialog = get("equipmentExtrasLibraryDialog");
    const quantityDialog = get("equipmentExtrasQuantityDialog");
    const removeDialog = get("equipmentExtrasRemoveDialog");
    let items = [], revision, selected = null, removing = null, draftInventoryId = "", pending = false, loading = false, generation = 0;
    let requestFingerprint = "", requestId = "", sequence = 0;
    let picker = null;
    const inventory = () => typeof options.inventory === "function" ? options.inventory() : options.inventory || [];
    const inventoryReady = () => typeof options.inventoryReady !== "function" || options.inventoryReady() === true;
    const status = (id, message, error = false) => {
      const element = get(id);
      element.textContent = text(message);
      element.dataset.error = String(error);
    };
    const controls = ["equipmentExtrasCreate", "equipmentExtrasRefresh", "equipmentExtrasLibraryClose", "equipmentExtrasLibraryCancel", "equipmentExtrasQuantityClose", "equipmentExtrasQuantityCancel", "equipmentExtrasAdd", "equipmentExtrasRemoveClose", "equipmentExtrasRemoveCancel", "equipmentExtrasRemoveConfirm"];
    function busy(value) {
      pending = value;
      for (const id of controls) get(id).disabled = value;
      host.querySelectorAll("[data-extra-select], [data-extra-remove]").forEach((element) => { element.disabled = value; });
    }
    function render() {
      const query = get("equipmentExtrasSearch").value;
      get("equipmentExtrasList").innerHTML = renderItems(items, query, inventory());
      get("equipmentExtrasCount").textContent = `${filterItems(items, query).length} de ${items.length} extras`;
      if (pending) busy(true);
    }
    function clearDraft() {
      draftInventoryId = "";
      requestFingerprint = ""; requestId = "";
      get("equipmentExtrasDescription").value = "";
      get("equipmentExtrasCategory").value = "Extras";
      get("equipmentExtrasItemType").value = "equipo";
      get("equipmentExtrasDefaultQuantity").value = "1";
      picker?.close();
    }
    function closeQuantity() {
      if (pending) return;
      selected = null;
      get("equipmentExtrasQuantity").value = "";
      get("equipmentExtrasRent").checked = false;
      get("equipmentExtrasRent").disabled = false;
      get("equipmentExtrasPurchase").checked = false;
      status("equipmentExtrasQuantityStatus", "");
      if (quantityDialog.open) quantityDialog.close();
    }
    function closeRemove() {
      if (pending) return;
      removing = null;
      status("equipmentExtrasRemoveStatus", "");
      if (removeDialog.open) removeDialog.close();
    }
    function close() {
      if (pending) return;
      generation += 1;
      loading = false;
      closeQuantity(); closeRemove(); clearDraft();
      get("equipmentExtrasSearch").value = "";
      status("equipmentExtrasLibraryStatus", "");
      if (dialog.open) dialog.close();
      opener.focus();
    }
    async function request(url, init = {}) {
      if (!fetcher) throw new Error("No se puede conectar con la biblioteca. Recargue la página.");
      const controller = typeof globalThis.AbortController === "function" ? new globalThis.AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), 30000) : null;
      try {
        const response = await fetcher(url, { credentials: "same-origin", ...init, ...(controller ? { signal: controller.signal } : {}) });
        let body;
        try { body = await response.json(); } catch { throw new Error("La biblioteca no respondió correctamente. Actualice la lista antes de reintentar."); }
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) throw new Error("Su sesión no permite esta operación. Inicie sesión nuevamente o revise sus permisos.");
          throw new Error(text(body?.error || body?.message) || "No se pudo guardar el cambio. Actualice la lista y reintente.");
        }
        return body;
      } catch (error) {
        if (controller?.signal.aborted) throw new Error("No se pudo confirmar la operación por un problema de conexión. Actualice la lista antes de reintentar.");
        throw error;
      } finally {
        if (timeout !== null) clearTimeout(timeout);
      }
    }
    function readResponse(body) {
      const ids = new Set();
      if (!Array.isArray(body?.items) || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.items.some((item) => {
        const id = text(item?.id).trim();
        if (!id || !text(item?.description).trim() || ids.has(id)) return true;
        ids.add(id); return false;
      })) throw new Error("La respuesta de la biblioteca está incompleta. Actualice la lista.");
      items = body.items.filter((item) => item && text(item.id).trim() && text(item.description).trim() && !item.archived && !item.deleted);
      revision = body.revision;
      render();
    }
    async function refresh() {
      if (pending || loading) return;
      const token = generation;
      loading = true;
      get("equipmentExtrasCreate").disabled = true;
      get("equipmentExtrasRefresh").disabled = true;
      status("equipmentExtrasLibraryStatus", "Cargando biblioteca…");
      try {
        const body = await request(ENDPOINT);
        if (token !== generation || !dialog.open) return;
        readResponse(body);
        status("equipmentExtrasLibraryStatus", "");
      } catch (error) {
        if (token === generation && dialog.open) status("equipmentExtrasLibraryStatus", error.message || "No se pudo cargar la biblioteca.", true);
      } finally {
        if (token === generation) { loading = false; busy(false); }
      }
    }
    async function open() {
      if (dialog.open) return;
      clearDraft();
      selected = null; removing = null;
      get("equipmentExtrasSearch").value = "";
      status("equipmentExtrasLibraryStatus", "");
      render();
      dialog.showModal();
      await refresh();
      if (dialog.open) get("equipmentExtrasSearch").focus();
    }
    async function create(event) {
      event.preventDefault();
      if (pending || loading || !dialog.open) return;
      let payload;
      try {
        if (!inventoryReady()) throw new Error("El inventario de Contabilidad de Equipo todavía no está disponible. Espere a que termine de cargar o actualice la página.");
        payload = draftPayload({ description: get("equipmentExtrasDescription").value, category: get("equipmentExtrasCategory").value, itemType: get("equipmentExtrasItemType").value, defaultQuantity: get("equipmentExtrasDefaultQuantity").value, ...(draftInventoryId ? { warehouseInventoryId: draftInventoryId } : {}) }, inventory(), revision);
        const fingerprint = JSON.stringify([payload.description, payload.category, payload.defaultQuantity, payload.itemType, payload.warehouseInventoryId || ""]);
        if (fingerprint !== requestFingerprint) {
          requestFingerprint = fingerprint;
          requestId = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID() : `extra-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
        }
        payload.requestId = requestId;
      } catch (error) { status("equipmentExtrasLibraryStatus", error.message, true); return; }
      busy(true);
      status("equipmentExtrasLibraryStatus", "Guardando extra…");
      try {
        readResponse(await request(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
        clearDraft();
        status("equipmentExtrasLibraryStatus", "Extra guardado en la biblioteca. Ya puede agregarlo al evento.");
      } catch (error) { status("equipmentExtrasLibraryStatus", error.message, true); }
      finally { busy(false); }
    }
    function select(id) {
      if (pending || loading) return;
      if (!inventoryReady()) { status("equipmentExtrasLibraryStatus", "El inventario de Contabilidad de Equipo todavía no está disponible. Espere a que termine de cargar o actualice la página.", true); return; }
      selected = items.find((item) => text(item.id) === text(id));
      if (!selected) return;
      get("equipmentExtrasSelectedName").textContent = selected.description;
      get("equipmentExtrasQuantity").value = text(positiveQuantity(selected.defaultQuantity) || 1);
      get("equipmentExtrasRent").checked = false;
      const known = currentInventoryItem(selected, inventory());
      const consumablePurchase = !known && selected.itemType === "consumible";
      get("equipmentExtrasRent").disabled = consumablePurchase;
      get("equipmentExtrasPurchase").checked = consumablePurchase;
      get("equipmentExtrasUnknown").hidden = Boolean(known);
      status("equipmentExtrasQuantityStatus", consumablePurchase ? "Los consumibles faltantes generan una necesidad de compra." : "");
      quantityDialog.showModal();
      get("equipmentExtrasQuantity").focus();
    }
    async function add(event) {
      event.preventDefault();
      if (pending || !selected || !quantityDialog.open) return;
      let item;
      try {
        if (!inventoryReady()) throw new Error("El inventario de Contabilidad de Equipo todavía no está disponible. Espere a que termine de cargar o actualice la página.");
        const action = get("equipmentExtrasRent").checked ? "rent" : get("equipmentExtrasPurchase").checked ? "purchase" : "";
        item = selectionPayload(selected, get("equipmentExtrasQuantity").value, action, inventory());
        if (typeof options.onAdd !== "function") throw new Error("No se pudo identificar el evento activo. Cierre y vuelva a seleccionar su evento.");
      } catch (error) {
        get("equipmentExtrasUnknown").hidden = Boolean(currentInventoryItem(selected, inventory()));
        status("equipmentExtrasQuantityStatus", error.message, true); return;
      }
      busy(true);
      status("equipmentExtrasQuantityStatus", "Agregando al evento…");
      try {
        const result = await options.onAdd(clone(item));
        if (result === false) throw new Error("No se pudo agregar el extra. Revise el evento activo y reintente.");
        busy(false);
        closeQuantity();
        status("equipmentExtrasLibraryStatus", `Se agregó ${item.description}: ${item.quantity}.`);
      } catch (error) { status("equipmentExtrasQuantityStatus", error.message || "No se pudo agregar el extra.", true); }
      finally { busy(false); }
    }
    function remove(id) {
      if (pending || loading) return;
      removing = items.find((item) => text(item.id) === text(id));
      if (!removing) return;
      get("equipmentExtrasRemoveName").textContent = removing.description;
      status("equipmentExtrasRemoveStatus", "");
      removeDialog.showModal();
    }
    async function confirmRemove() {
      if (pending || !removing || !removeDialog.open) return;
      busy(true);
      status("equipmentExtrasRemoveStatus", "Retirando extra…");
      try {
        readResponse(await request(ENDPOINT + "/" + encodeURIComponent(removing.id), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(revision === undefined || revision === null ? {} : { revision }) }));
        busy(false);
        closeRemove();
        status("equipmentExtrasLibraryStatus", "Extra retirado de la biblioteca. Los eventos e inventario se conservan.");
      } catch (error) { status("equipmentExtrasRemoveStatus", error.message, true); }
      finally { busy(false); }
    }
    for (const id of ["equipmentExtrasLibraryClose", "equipmentExtrasLibraryCancel"]) get(id).addEventListener("click", close);
    for (const id of ["equipmentExtrasQuantityClose", "equipmentExtrasQuantityCancel"]) get(id).addEventListener("click", closeQuantity);
    for (const id of ["equipmentExtrasRemoveClose", "equipmentExtrasRemoveCancel"]) get(id).addEventListener("click", closeRemove);
    for (const [element, closer] of [[dialog, close], [quantityDialog, closeQuantity], [removeDialog, closeRemove]]) {
      element.addEventListener("cancel", (event) => { event.preventDefault(); closer(); });
    }
    get("equipmentExtrasRefresh").addEventListener("click", refresh);
    get("equipmentExtrasLibraryForm").addEventListener("submit", create);
    get("equipmentExtrasQuantityForm").addEventListener("submit", add);
    get("equipmentExtrasRemoveConfirm").addEventListener("click", confirmRemove);
    get("equipmentExtrasSearch").addEventListener("input", render);
    get("equipmentExtrasList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-extra-select], [data-extra-remove]");
      if (!button || !get("equipmentExtrasList").contains(button)) return;
      if (button.dataset.extraSelect !== undefined) select(button.dataset.extraSelect);
      else remove(button.dataset.extraRemove);
    });
    const invalidateLink = () => { draftInventoryId = ""; };
    get("equipmentExtrasDescription").addEventListener("input", invalidateLink);
    get("equipmentExtrasCategory").addEventListener("input", invalidateLink);
    const pickerApi = options.namePicker || document.defaultView?.EquipmentNamePicker;
    if (pickerApi?.attach) picker = pickerApi.attach(get("equipmentExtrasDescription"), { getChoices: () => inventoryChoices(inventory()), onSelect(choice) {
      draftInventoryId = choice.id;
      get("equipmentExtrasCategory").value = choice.category;
      get("equipmentExtrasItemType").value = choice.itemType;
    }, onChange: invalidateLink });
    opener.addEventListener("click", open);
    const api = { open, close, refresh, getState: () => clone({ items, revision, pending, loading, selected, removing }), destroy() {
      if (pending) return false;
      close(); picker?.detach(); opener.removeEventListener("click", open); host.remove(); instances.delete(opener); return true;
    } };
    instances.set(opener, api);
    return api;
  }

  return { init, positiveQuantity, inventoryChoices, currentInventoryItem, draftPayload, selectionPayload, filterItems, renderItems, shell };
});
