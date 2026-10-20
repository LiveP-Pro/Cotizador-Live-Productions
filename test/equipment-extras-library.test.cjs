const test = require("node:test");
const assert = require("node:assert/strict");
const library = require("../equipment-extras-library.js");

const records = () => [
  { id: "warehouse-a", physical: 0, item: { name: "Luz de prueba A", category: "Iluminación", itemType: "equipo" } },
  { id: "warehouse-b", physical: 5, consumable: true, item: { name: "Líquido de prueba", category: "Consumibles" } }
];
const known = () => ({ id: "extra-a", description: "Luz de prueba A", category: "Iluminación", defaultQuantity: 1, warehouseInventoryId: "warehouse-a", itemType: "equipo" });
const unknown = () => ({ id: "extra-b", description: "Extra de prueba", category: "Extras", defaultQuantity: 1, itemType: "equipo" });

test("cantidades de selección: rechaza vacíos, cero, negativos, fracciones e infinitos", () => {
  for (const value of ["", " ", 0, "0", -1, 1.5, Infinity, NaN, null, undefined, {}, true, "no", Number.MAX_SAFE_INTEGER + 1]) assert.equal(library.positiveQuantity(value), null);
  for (const value of [1, "2", " 3 ", 999999]) assert.equal(library.positiveQuantity(value), Number(value));
});

test("solo usa registros actuales, no stock guardado en la biblioteca", () => {
  const extra = { ...known(), physical: 80 };
  assert.equal(library.currentInventoryItem(extra, records()).id, "warehouse-a");
  assert.equal(library.currentInventoryItem(extra, []), null);
  assert.deepEqual(library.inventoryChoices([...records(), { id: "archived", archived: true, item: { name: "Viejo" } }, { id: "empty" }]).map((item) => item.id), ["warehouse-a", "warehouse-b"]);
  assert.equal(library.inventoryChoices(records())[1].itemType, "consumible");
});

test("equipo de bodega con cantidad cero sigue reconocido, nunca crea existencias", () => {
  const item = library.selectionPayload(known(), 2, "purchase", records());
  assert.equal(item.warehouseInventoryId, "warehouse-a");
  assert.equal(item.quantity, 2);
  assert.equal(item.libraryExtraId, "extra-a");
  for (const field of ["physical", "stock", "purchase", "procurementChoice", "inventoryIngressReceipts"]) assert.equal(field in item, false);
  assert.equal(records()[0].physical, 0);
});

test("no relaciona equipos por parecido ni elimina signos o números", () => {
  assert.equal(library.currentInventoryItem({ description: "Luz de prueba A2", category: "Iluminación" }, records()), null);
  assert.equal(library.currentInventoryItem({ description: "Luz-de-prueba A", category: "Iluminación" }, records()), null);
  assert.equal(library.currentInventoryItem({ description: "Luz de prueba A", category: "Otra categoría" }, records()), null);
  assert.equal(library.currentInventoryItem({ description: " LUZ DE PRUEBA A ", category: "iluminacion" }, records()).id, "warehouse-a");
  assert.equal(library.currentInventoryItem({ description: "Luz de prueba A", category: "Iluminación" }, [...records(), { id: "duplicate", item: { name: "Luz de prueba A", category: "Iluminación" } }]), null);
});

test("vínculo inválido no cae en coincidencias de nombre ni inventarios previos", () => {
  assert.equal(library.currentInventoryItem({ ...known(), warehouseInventoryId: "deleted-id" }, records()), null);
  assert.throws(() => library.draftPayload({ ...known(), warehouseInventoryId: "deleted-id" }, records(), 2), /ya no está/);
  assert.throws(() => library.draftPayload({ ...known(), description: "Descripción cambiada" }, records(), 2), /seleccione nuevamente/i);
});

test("desconocido exige acción explícita; consumibles faltantes requieren compra", () => {
  assert.throws(() => library.selectionPayload(unknown(), 1, "", records()), /Elija Rentar o Comprar/);
  assert.throws(() => library.selectionPayload(unknown(), 1, "save", records()), /Elija Rentar o Comprar/);
  for (const action of ["rent", "purchase"]) {
    const item = library.selectionPayload(unknown(), 3, action, records());
    assert.equal(item.procurementChoice, action);
    assert.equal(item.itemType, "equipo");
    assert.equal("warehouseInventoryId" in item, false);
    assert.equal("stock" in item, false);
  }
  assert.throws(() => library.selectionPayload({ ...unknown(), itemType: "consumible" }, 3, "rent", records()), /consumibles.*comprar/);
  const consumable = library.selectionPayload({ ...unknown(), itemType: "consumible" }, 3, "purchase", records());
  assert.equal(consumable.itemType, "consumible");
  assert.equal(consumable.procurementChoice, "purchase");
});

test("crear extra genera solo metadatos, revisión y vínculo exacto vigente", () => {
  assert.deepEqual(library.draftPayload({ ...known(), physical: 100, defaultQuantity: "2" }, records(), 7), {
    description: "Luz de prueba A", category: "Iluminación", defaultQuantity: 2, itemType: "equipo", warehouseInventoryId: "warehouse-a", revision: 7
  });
  assert.equal(library.draftPayload(unknown(), records(), 0).revision, 0);
  assert.throws(() => library.draftPayload({ ...unknown(), description: "" }, records()), /descripción/);
  assert.throws(() => library.draftPayload({ ...unknown(), category: "" }, records()), /categoría/);
  assert.throws(() => library.draftPayload({ ...unknown(), defaultQuantity: 0 }, records()), /cantidad/);
});

test("búsqueda todos los términos y salida HTML escapada", () => {
  const malicious = { ...unknown(), id: 'bad" onclick="alert(1)', description: '<img src=x onerror="alert(1)">', category: "<& categoría" };
  const items = [known(), unknown(), malicious, { ...unknown(), id: "retired", archived: true }];
  assert.deepEqual(library.filterItems(items, "ILUMINACION prueba").map((item) => item.id), ["extra-a"]);
  const html = library.renderItems(items, "", records());
  assert.doesNotMatch(html, /<img|data-extra-select="bad"|onerror="alert/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /data-extra-select="retired"/);
  assert.match(library.renderItems(items, "sin coincidencias", records()), /No se encontraron/);
});

test("dos equipos de nombre idéntico conservan identidades físicas distintas", () => {
  const extraRecords = [...records(), { id: "warehouse-distinct", item: { name: "Luz de prueba A", category: "Iluminación" } }];
  const second = { ...known(), id: "extra-other", warehouseInventoryId: "warehouse-distinct" };
  const html = library.renderItems([known(), second], "", extraRecords);
  assert.match(html, /Registro de inventario: warehouse-a/);
  assert.match(html, /Registro de inventario: warehouse-distinct/);
  assert.equal(library.selectionPayload(known(), 1, "", extraRecords).warehouseInventoryId, "warehouse-a");
  assert.equal(library.selectionPayload(second, 1, "", extraRecords).warehouseInventoryId, "warehouse-distinct");
});

function harness(options = {}) {
  const elements = new Map(), requests = [], added = [], responses = [];
  class Element {
    constructor(id) { this.id = id || ""; this.dataset = {}; this.listeners = {}; this.value = ""; this.open = false; this.checked = false; this.disabled = false; this.hidden = false; this.textContent = ""; this.children = []; }
    set innerHTML(value) {
      this.html = value; this.children = [];
      for (const match of value.matchAll(/<([a-z]+)\b([^>]*(?:\bid="([^"]+)"|\bdata-extra-(?:select|remove)="([^"]+)")[^>]*)>/g)) {
        const element = new Element(match[3]);
        const attrs = match[2];
        element.value = attrs.match(/\bvalue="([^"]*)"/)?.[1] || "";
        element.hidden = /\shidden(?:\s|$)/.test(attrs);
        for (const property of ["select", "remove"]) {
          const found = attrs.match(new RegExp(`data-extra-${property}="([^"]+)"`));
          if (found) element.dataset[property === "select" ? "extraSelect" : "extraRemove"] = found[1];
        }
        if (element.id) elements.set(element.id, element);
        this.children.push(element);
      }
    }
    get innerHTML() { return this.html || ""; }
    addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
    removeEventListener(type, listener) { this.listeners[type] = (this.listeners[type] || []).filter((item) => item !== listener); }
    async emit(type, target = this) { for (const listener of this.listeners[type] || []) await listener({ target, preventDefault() {} }); }
    querySelectorAll() { return this.children.filter((item) => item.dataset.extraSelect !== undefined || item.dataset.extraRemove !== undefined); }
    contains(element) { return this.children.includes(element); }
    closest(selector) { return /data-extra-/.test(selector) && (this.dataset.extraSelect !== undefined || this.dataset.extraRemove !== undefined) ? this : null; }
    appendChild(element) { this.children.push(element); return element; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { this.focused = true; }
    remove() { this.removed = true; }
  }
  const document = { body: new Element("body"), createElement: () => new Element(), getElementById: (id) => elements.get(id), defaultView: null };
  elements.set("equipmentExtrasLibraryButton", new Element("equipmentExtrasLibraryButton"));
  let stored = (options.items || [known(), unknown()]).map((item) => ({ ...item })), rev = 1, currentRecords = records(), ready = true;
  const fetch = async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : undefined;
    requests.push({ url, init, body });
    if (responses.length) { const next = responses.shift(); return typeof next === "function" ? next(url, init) : next; }
    let returned;
    if (init.method === "POST") { const item = { ...body, id: "created-extra" }; delete item.revision; delete item.requestId; stored.push(item); rev++; returned = { item }; }
    if (init.method === "DELETE") { stored = stored.filter((item) => encodeURIComponent(item.id) !== url.split("/").at(-1)); rev++; }
    return { ok: true, status: 200, json: async () => ({ ...returned, items: stored, revision: rev }) };
  };
  const instance = library.init({ document, fetch, inventory: () => currentRecords, inventoryReady: () => ready, onAdd: async (item) => { if (options.onAdd) return options.onAdd(item); added.push(item); } });
  const get = (id) => elements.get(id);
  return { instance, get, requests, responses, added, document, setRecords: (value) => { currentRecords = value; }, setReady: (value) => { ready = value; },
    async select(id) { const list = get("equipmentExtrasList"); const button = list.children.find((item) => item.dataset.extraSelect === id); assert.ok(button); await list.emit("click", button); },
    async remove(id) { const list = get("equipmentExtrasList"); const button = list.children.find((item) => item.dataset.extraRemove === id); assert.ok(button); await list.emit("click", button); },
    async create(description = "Extra nuevo", category = "Extras") { get("equipmentExtrasDescription").value = description; get("equipmentExtrasCategory").value = category; await get("equipmentExtrasLibraryForm").emit("submit"); },
    async add(quantity, action) { get("equipmentExtrasQuantity").value = quantity; get("equipmentExtrasRent").checked = action === "rent"; get("equipmentExtrasPurchase").checked = action === "purchase"; await get("equipmentExtrasQuantityForm").emit("submit"); }
  };
}

test("abrir carga de API privada, búsqueda, cerrar borra borrador y no escribe", async () => {
  const h = harness();
  await h.instance.open();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].init.credentials, "same-origin");
  assert.equal(h.instance.getState().items.length, 2);
  h.get("equipmentExtrasDescription").value = "No guardar";
  h.get("equipmentExtrasSearch").value = "EXTRA DE";
  await h.get("equipmentExtrasSearch").emit("input");
  assert.match(h.get("equipmentExtrasCount").textContent, /1 de 2/);
  await h.get("equipmentExtrasLibraryClose").emit("click");
  assert.equal(h.get("equipmentExtrasDescription").value, "");
  assert.equal(h.requests.length, 1);
  assert.equal(h.get("equipmentExtrasLibraryDialog").open, false);
  await h.instance.open();
  assert.equal(h.instance.getState().items.length, 2);
  assert.equal(h.get("equipmentExtrasDescription").value, "");
});

test("seleccionar muestra cantidad; cancelar y Escape no agregan", async () => {
  const h = harness(); await h.instance.open(); await h.select("extra-a");
  assert.equal(h.get("equipmentExtrasQuantityDialog").open, true);
  assert.equal(h.get("equipmentExtrasUnknown").hidden, true);
  await h.get("equipmentExtrasQuantityClose").emit("click");
  assert.equal(h.added.length, 0);
  assert.equal(h.instance.getState().selected, null);
  await h.select("extra-b");
  await h.get("equipmentExtrasQuantityDialog").emit("cancel");
  assert.equal(h.get("equipmentExtrasQuantityDialog").open, false);
  assert.equal(h.added.length, 0);
  assert.equal(h.requests.length, 1);
});

test("agregar conocido usa cantidad exacta y mantiene la biblioteca abierta", async () => {
  const h = harness(); await h.instance.open(); await h.select("extra-a"); await h.add("2");
  assert.equal(h.added.length, 1);
  assert.equal(h.added[0].warehouseInventoryId, "warehouse-a");
  assert.equal(h.added[0].quantity, 2);
  assert.equal(h.get("equipmentExtrasQuantityDialog").open, false);
  assert.equal(h.get("equipmentExtrasLibraryDialog").open, true);
  assert.equal(h.requests.length, 1);
});

test("desconocido y consumible requieren acción sin fabricar ingreso a inventario", async () => {
  const h = harness({ items: [{ ...unknown(), itemType: "consumible" }] }); await h.instance.open(); await h.select("extra-b");
  assert.equal(h.get("equipmentExtrasRent").disabled, true);
  assert.equal(h.get("equipmentExtrasPurchase").checked, true);
  await h.add("3", "rent"); assert.equal(h.added.length, 0); assert.match(h.get("equipmentExtrasQuantityStatus").textContent, /consumibles.*comprar/);
  await h.add("0", "purchase"); assert.equal(h.added.length, 0); assert.match(h.get("equipmentExtrasQuantityStatus").textContent, /mayor que cero/);
  await h.add("3"); assert.equal(h.added.length, 0); assert.match(h.get("equipmentExtrasQuantityStatus").textContent, /Elija Rentar o Comprar/);
  await h.add("3", "purchase"); assert.equal(h.added[0].procurementChoice, "purchase");
  assert.equal(h.added[0].itemType, "consumible"); assert.equal("inventoryIngressReceipts" in h.added[0], false);
  assert.equal(h.requests.filter((request) => request.init.method).length, 0);
});

test("si el inventario cambia durante la selección pide nueva acción", async () => {
  const h = harness(); await h.instance.open(); await h.select("extra-a");
  h.setRecords([]); await h.add("2");
  assert.equal(h.added.length, 0);
  assert.equal(h.get("equipmentExtrasUnknown").hidden, false);
  await h.add("2", "rent"); assert.equal(h.added[0].procurementChoice, "rent");
});

test("inventario sin cargar impide crear o agregar y no se interpreta como cero", async () => {
  const h = harness(); await h.instance.open(); h.setReady(false);
  await h.select("extra-a"); assert.equal(h.get("equipmentExtrasQuantityDialog").open, false);
  assert.match(h.get("equipmentExtrasLibraryStatus").textContent, /todavía no está disponible/);
  await h.create(); assert.equal(h.requests.length, 1);
  h.setReady(true); await h.select("extra-a"); h.setReady(false); await h.add("2"); assert.equal(h.added.length, 0);
});

test("guardar biblioteca usa POST revisión y persiste al abrir nuevamente", async () => {
  const h = harness(); await h.instance.open(); await h.create();
  const post = h.requests[1];
  assert.equal(post.init.method, "POST"); assert.equal(post.init.credentials, "same-origin");
  assert.equal(post.body.revision, 1); assert.equal(post.body.defaultQuantity, 1); assert.ok(post.body.requestId);
  for (const field of ["physical", "stock", "quantity", "inventoryIngressReceipts"]) assert.equal(field in post.body, false);
  assert.equal(h.get("equipmentExtrasDescription").value, ""); assert.equal(h.instance.getState().items.length, 3);
  h.instance.close(); await h.instance.open(); assert.equal(h.instance.getState().items.length, 3);
  assert.equal(h.added.length, 0);
});

test("fallo al guardar preserva borrador y requestId para reintento idempotente", async () => {
  const h = harness(); await h.instance.open();
  h.responses.push({ ok: false, status: 409, json: async () => ({ error: "La biblioteca cambió. Actualice la lista." }) });
  await h.create(); assert.equal(h.get("equipmentExtrasDescription").value, "Extra nuevo");
  assert.match(h.get("equipmentExtrasLibraryStatus").textContent, /Actualice/);
  assert.equal(h.get("equipmentExtrasLibraryStatus").dataset.error, "true");
  await h.create(); assert.equal(h.requests[1].body.requestId, h.requests[2].body.requestId);
  assert.equal(h.instance.getState().items.length, 3);
});

test("retirar pide confirmación, X no cambia nada, DELETE conserva eventos e inventario", async () => {
  const h = harness(); await h.instance.open(); await h.remove("extra-a");
  assert.equal(h.get("equipmentExtrasRemoveDialog").open, true);
  await h.get("equipmentExtrasRemoveClose").emit("click"); assert.equal(h.requests.length, 1);
  await h.remove("extra-a"); await h.get("equipmentExtrasRemoveConfirm").emit("click");
  assert.equal(h.requests[1].init.method, "DELETE"); assert.equal(h.requests[1].body.revision, 1);
  assert.equal(h.requests[1].url, "/api/cuadros-equipo/extras/extra-a");
  assert.equal(h.instance.getState().items.length, 1);
  assert.equal(h.added.length, 0); assert.equal(records()[0].physical, 0);
});

test("fallo de sesión se ve y nunca simula guardado local", async () => {
  const h = harness(); h.responses.push({ ok: false, status: 401, json: async () => ({ error: "Unauthorized" }) });
  await h.instance.open(); assert.match(h.get("equipmentExtrasLibraryStatus").textContent, /sesión/);
  assert.equal(h.instance.getState().items.length, 0); assert.equal(h.instance.getState().pending, false);
});

test("respuesta incompleta no descarta filas silenciosamente", async () => {
  const h = harness(); h.responses.push({ ok: true, status: 200, json: async () => ({ items: [known(), { id: "broken" }], revision: 1 }) });
  await h.instance.open(); assert.match(h.get("equipmentExtrasLibraryStatus").textContent, /incompleta/);
  assert.equal(h.instance.getState().items.length, 0);
});

test("doble clic mientras agrega no repite callback y X no abandona operación en curso", async () => {
  let resolveAdd; let count = 0;
  const h = harness({ onAdd: () => { count++; return new Promise((resolve) => { resolveAdd = resolve; }); } });
  await h.instance.open(); await h.select("extra-a");
  const first = h.add("2"); await Promise.resolve();
  await h.add("2"); await h.get("equipmentExtrasQuantityClose").emit("click");
  assert.equal(count, 1); assert.equal(h.get("equipmentExtrasQuantityDialog").open, true);
  resolveAdd(); await first; assert.equal(h.get("equipmentExtrasQuantityDialog").open, false);
});

test("fallo del evento conserva selección para corregir y no genera POST de stock", async () => {
  const h = harness({ onAdd: async () => { throw new Error("Complete la ubicación del evento."); } });
  await h.instance.open(); await h.select("extra-a"); await h.add("2");
  assert.equal(h.get("equipmentExtrasQuantityDialog").open, true);
  assert.match(h.get("equipmentExtrasQuantityStatus").textContent, /ubicación/);
  assert.equal(h.requests.length, 1);
});

test("init es idempotente, destroy elimina vínculo y permite nueva inicialización", async () => {
  const h = harness(); assert.equal(library.init({ document: h.document }), h.instance);
  assert.equal(h.instance.destroy(), true);
  assert.notEqual(library.init({ document: h.document, inventory: records }), h.instance);
});
