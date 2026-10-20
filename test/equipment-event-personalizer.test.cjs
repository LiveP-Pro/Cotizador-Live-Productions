const assert = require("node:assert/strict");
const test = require("node:test");
const personalizer = require("../equipment-event-personalizer.js");

const inventory = [
  { id: "synthetic-console", name: "Consola análoga", category: "Audio", itemType: "equipo", available: 3 },
  { id: "synthetic-tape", name: "Cinta negra", category: "Consumibles", itemType: "consumible", available: 2 }
];
const metadata = () => ({ place: "Lugar de prueba", type: "Privado", setupAt: "2026-10-20T09:00", startAt: "2026-10-20T11:00", endAt: "2026-10-20T18:00", equipmentInAt: "2026-10-20T21:00", notes: "Observación del evento" });
const serviceGroups = [{ id: "personalizados", label: "Personalizados" }, { id: "synthetic-events", label: "Eventos de prueba" }];
function draft(source = "Cantidad\tDescripción\tCategoría\tObservaciones\n0\tConsola análoga\tAudio\tConservar cero\n2\tCinta negra\tConsumibles\tUso del evento") {
  return { ...personalizer.parseClipboard(source), id: "synthetic-event-one", metadata: metadata() };
}

test("TSV conserva comillas escapadas, tabs y saltos dentro de las celdas", () => {
  const input = 'Cantidad\tDescripción\tObservaciones\r\n0\t"Consola\tmodelo A"\t"Dijo ""listo""\r\nlínea 2"\r\n';
  const parsed = personalizer.parseClipboard(input);
  assert.equal(parsed.sourceRowCount, 2);
  assert.equal(parsed.sourceCellCount, 6);
  assert.deepEqual(parsed.rows[1].cells, ["0", "Consola\tmodelo A", 'Dijo "listo"\r\nlínea 2']);
  assert.equal(parsed.rows[1].quantity, "0");
  assert.equal(parsed.rows[1].notes, 'Dijo "listo"\r\nlínea 2');
  assert.throws(() => personalizer.parseClipboard('1\t"sin cerrar'), /falta cerrar/);
  assert.throws(() => personalizer.parseClipboard('1\t"dato"otro'), /fuera de una celda/);
});

test("reconoce encabezados permutados y conserva cada columna adicional", () => {
  const value = draft("Observaciones\tDescripción\tCantidad\tCategoría\tSerie\nRevisar cable\tConsola análoga\t0\tAudio\tSN-PRUEBA");
  assert.equal(value.rows[1].quantity, "0");
  assert.deepEqual(value.rows[1].extras, [{ column: 4, label: "Serie", value: "SN-PRUEBA" }]);
  const event = personalizer.buildEvent(value, inventory);
  assert.equal(event.sections.flatMap((section) => section.items)[0].quantity, 0);
  assert.deepEqual(event.source.rows.map((row) => row.cells), personalizer.readTsv("Observaciones\tDescripción\tCantidad\tCategoría\tSerie\nRevisar cable\tConsola análoga\t0\tAudio\tSN-PRUEBA"));
  assert.deepEqual(event.sections.flatMap((section) => section.items)[0].notes, ["Revisar cable", "Serie: SN-PRUEBA"]);
});

test("encabezados, categorías, notas y separadores permanecen en el orden original", () => {
  const source = "\nCantidad\tDescripción\nAUDIO\n0\tConsola análoga\nNota: cable incluido\n\nCONSUMIBLES\n1\tCinta negra\nObservación: retirar al terminar";
  const value = draft(source);
  assert.deepEqual(value.rows.map((row) => row.kind), ["blank", "header", "category", "item", "note", "blank", "category", "item", "note"]);
  const event = personalizer.buildEvent(value, inventory);
  assert.deepEqual(event.sections.flatMap((section) => section.rows).map((row) => row.sourceRow), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(event.sections.flatMap((section) => section.rows).map((row) => row.cells.map((cell) => cell.value)), personalizer.readTsv(source));
  assert.equal(event.sections.flatMap((section) => section.items).length, 2);
  assert.equal(event.sections.flatMap((section) => section.items)[0].quantity, 0);
});

test("las equivalencias sólo admiten espacio, caso y acento, sin mezclar signos o modelos", () => {
  const row = { description: "  CONSOLA  ANALOGA " };
  assert.equal(personalizer.resolveRow(row, inventory).record.id, "synthetic-console");
  assert.equal(personalizer.resolveRow({ description: "Consola-análoga" }, inventory).status, "unknown");
  assert.equal(personalizer.resolveRow({ description: "Consola análoga 2" }, inventory).status, "unknown");
  const multiple = [...inventory, { id: "synthetic-console-distinct", name: "Consola análoga", category: "Otra bodega", itemType: "equipo" }];
  assert.equal(personalizer.resolveRow(row, multiple).status, "ambiguous");
  assert.equal(personalizer.resolveRow({ ...row, warehouseInventoryId: "synthetic-console-distinct" }, multiple).record.category, "Otra bodega");
  assert.equal(personalizer.resolveRow({ ...row, warehouseInventoryId: "removed-record" }, inventory).status, "stale");
});

test("el equipo desconocido requiere renta o compra explícita y no aumenta inventario", () => {
  const value = draft("1\tEquipo nuevo de prueba");
  assert.match(personalizer.validateDraft(value, inventory)[0].message, /Elija Rentar o Comprar/);
  value.rows[0].procurementChoice = "rent";
  assert.deepEqual(personalizer.validateDraft(value, inventory), []);
  let item = personalizer.buildEvent(value, inventory).sections[0].items[0];
  assert.equal(item.procurementChoice, "rent");
  assert.equal(item.warehouseInventoryId, undefined);
  value.rows[0].procurementChoice = "purchase";
  value.rows[0].itemType = "consumible";
  item = personalizer.buildEvent(value, inventory).sections[0].items[0];
  assert.equal(item.itemType, "consumible");
  assert.equal(item.procurementChoice, "purchase");
  assert.deepEqual(inventory.map((record) => record.available), [3, 2]);
  value.rows[0].procurementChoice = "rent";
  assert.ok(personalizer.validateDraft(value, inventory).some((error) => /consumibles faltantes/.test(error.message)));
});

test("cantidades faltantes o inválidas no se convierten en cero ni se descartan", () => {
  assert.equal(personalizer.parseQuantity(0), 0);
  assert.equal(personalizer.parseQuantity("2,5"), 2.5);
  for (const invalid of ["", "-1", "Infinity", "1,200.5", "2x", null]) assert.equal(personalizer.parseQuantity(invalid), null);
  const value = draft("\tConsola análoga\n2\t");
  assert.equal(value.rows.length, 2);
  const errors = personalizer.validateDraft(value, inventory);
  assert.ok(errors.some((error) => error.field === "quantity" && error.rowId === value.rows[0].id));
  assert.ok(errors.some((error) => error.field === "description" && error.rowId === value.rows[1].id));
  assert.throws(() => personalizer.buildEvent(value, inventory), /cantidad/);
});

test("fechas completas, reales y cronología montaje-evento-finalización-regreso son obligatorias", () => {
  const value = draft();
  assert.deepEqual(personalizer.validateDraft(value, inventory), []);
  value.metadata.endAt = "2026-10-20T10:00";
  assert.ok(personalizer.validateDraft(value, inventory).some((error) => error.field === "endAt"));
  value.metadata = metadata(); value.metadata.equipmentInAt = "2026-10-20T17:59";
  assert.ok(personalizer.validateDraft(value, inventory).some((error) => error.field === "equipmentInAt"));
  value.metadata = metadata(); value.metadata.setupAt = "2026-02-30T09:00";
  assert.ok(personalizer.validateDraft(value, inventory).some((error) => error.field === "setupAt"));
  value.metadata = metadata(); value.metadata.startAt = "";
  assert.ok(personalizer.validateDraft(value, inventory).some((error) => error.field === "startAt"));
  value.metadata = metadata(); value.metadata.place = "  ";
  assert.ok(personalizer.validateDraft(value, inventory).some((error) => error.field === "place"));
});

test("más de 5,000 filas y sus ceros se conservan sin límite arbitrario ni corte", () => {
  const count = 6201;
  const source = "Cantidad\tDescripción\tCategoría\tObservaciones\n" + Array.from({ length: count }, (_, index) => `${index % 3}\tConsola análoga\tAudio\tNota ${index}`).join("\n");
  const value = draft(source);
  assert.equal(value.rows.length, count + 1);
  assert.equal(value.sourceCellCount, (count + 1) * 4);
  const event = personalizer.buildEvent(value, inventory);
  const items = event.sections.flatMap((section) => section.items);
  assert.equal(items.length, count);
  assert.equal(items.filter((item) => item.quantity === 0).length, 2067);
  assert.equal(items.at(-1).notes[0], "Nota 6200");
  assert.equal(event.source.rows.at(-1).cells[3], "Nota 6200");
});

test("cancelar borra el borrador completo y nunca llama al guardado", async () => {
  let commits = 0;
  const session = personalizer.createSession({ inventory: () => inventory, onCommit: async () => { commits += 1; } });
  session.open(); session.paste("0\tConsola análoga"); session.draft.metadata = metadata();
  assert.deepEqual(session.review(), []);
  assert.equal(session.discard(), true);
  assert.equal(session.isOpen, false);
  assert.deepEqual(session.draft.rows, []);
  assert.equal(session.draft.metadata.place, "");
  session.open();
  assert.deepEqual(session.draft.rows, []);
  assert.equal(commits, 0);
  await assert.rejects(session.commit(), /Revise/);
});

test("error al guardar conserva borrador y permite reintento con el mismo ID", async () => {
  const committedIds = [];
  const session = personalizer.createSession({ inventory, onCommit: async (event) => {
    committedIds.push(event.id);
    if (committedIds.length === 1) throw new Error("Fallo temporal de prueba");
    return { saved: true };
  } });
  session.open(); session.paste("0\tConsola análoga"); session.draft.metadata = metadata();
  const id = session.draft.id;
  session.review();
  await assert.rejects(session.commit(), /Fallo temporal/);
  assert.equal(session.isOpen, true);
  assert.equal(session.draft.id, id);
  assert.equal(session.draft.rows[0].quantity, "0");
  assert.equal(session.reviewed, false);
  session.review();
  await session.commit();
  assert.deepEqual(committedIds, [id, id]);
  assert.equal(session.isOpen, false);
  assert.deepEqual(session.draft.rows, []);
});

test("guardar es atómico: no permite segundo envío ni cerrar durante el envío", async () => {
  let resolveCommit;
  const session = personalizer.createSession({ inventory, onCommit: () => new Promise((resolve) => { resolveCommit = resolve; }) });
  session.open(); session.paste("1\tConsola análoga"); session.draft.metadata = metadata(); session.review();
  const pending = session.commit();
  assert.equal(session.busy, true);
  assert.equal(session.discard(), false);
  await assert.rejects(session.commit(), /se está guardando/);
  resolveCommit({ saved: true }); await pending;
  assert.equal(session.busy, false);
});

test("un error de lectura no reemplaza la tabla actual y quitar fila conserva las demás", () => {
  const session = personalizer.createSession({ inventory });
  session.open(); session.paste("0\tConsola análoga\n2\tCinta negra");
  const previous = JSON.stringify(session.draft);
  assert.throws(() => session.paste('1\t"truncado'), /falta cerrar/);
  assert.equal(JSON.stringify(session.draft), previous);
  session.removeRow(session.draft.rows[1].id);
  assert.equal(session.draft.rows.length, 1);
  assert.equal(session.draft.rows[0].quantity, "0");
});

function browserHarness(options = {}) {
  const elements = new Map();
  class Element {
    constructor(id = "") { this.id = id; this.dataset = {}; this.listeners = {}; this.value = ""; this.disabled = false; this.open = false; this.hidden = false; this.textContent = ""; }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<(?:[\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)) {
        const child = new Element(match[2]);
        child.disabled = /\sdisabled(?:\s|\/|$)/.test(match[1]);
        child.hidden = /\shidden(?:\s|\/|$)/.test(match[1]);
        const metadataName = match[1].match(/data-personalizer-metadata="([^"]+)"/)?.[1];
        if (metadataName) child.dataset.personalizerMetadata = metadataName;
        const usageMode = match[1].match(/data-personalizer-usage-mode="([^"]+)"/)?.[1];
        if (usageMode) child.dataset.personalizerUsageMode = usageMode;
        const templateField = match[1].match(/data-personalizer-template-field="([^"]+)"/)?.[1];
        if (templateField) child.dataset.personalizerTemplateField = templateField;
        elements.set(child.id, child);
      }
    }
    get innerHTML() { return this.html || ""; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, handler) { (this.listeners[name] ||= []).push(handler); }
    removeEventListener(name, handler) { this.listeners[name] = (this.listeners[name] || []).filter((entry) => entry !== handler); }
    async emit(name, event = {}) { for (const handler of this.listeners[name] || []) await handler({ target: this, preventDefault() {}, ...event }); }
    querySelectorAll() { return [...elements.values()].filter((entry) => entry !== this); }
    showModal() { this.open = true; }
    close() { this.open = false; for (const handler of this.listeners.close || []) handler({ target: this }); }
    focus() { this.focused = true; }
    remove() { elements.delete(this.id); }
  }
  const doc = { body: { appendChild(element) { elements.set(element.id, element); } }, createElement() { return new Element(); }, getElementById(id) { return elements.get(id); } };
  const opener = new Element("equipmentPersonalizeEventButton"); elements.set(opener.id, opener);
  const api = personalizer.init({ document: doc, inventory: () => inventory, serviceGroups: () => serviceGroups, ...options });
  const dialog = elements.get("equipmentPersonalizerDialog");
  return { api, doc, dialog, get: (id) => elements.get(id),
    async action(action) { const target = { dataset: { personalizerAction: action }, closest() { return this; } }; await dialog.emit("click", { target }); },
    async input(id, value) { const target = elements.get(id); target.value = value; await dialog.emit("input", { target }); },
    async valid() { for (const [field, value] of Object.entries(metadata())) await this.input(`equipmentPersonalizer-${field}`, value); await this.input("equipmentPersonalizerClipboard", "0\tConsola análoga"); await this.action("parse"); }
  };
}

function previewPlan(event, changes = {}) {
  return { revision: 4, inventorySavedAt: "synthetic-stock-v1", rows: [{ warehouseInventoryId: "synthetic-console", description: "Consola análoga", category: "Audio", itemType: "equipo",
    required: 5, available: 3, capacity: 3, missing: 2, action: "RENTA", reservations: [
      { eventId: "synthetic-other", name: "Otro evento confirmado", place: "Otro lugar", quantity: 5, setupAt: "2026-10-20T10:00", equipmentInAt: "2026-10-20T20:00" },
      { eventId: event.id, name: event.name, place: event.place, quantity: 0, setupAt: event.setupAt, equipmentInAt: event.equipmentInAt }
    ], ...changes }] };
}

test("la revisión consulta disponibilidad real antes de habilitar Cargar y muestra faltantes y eventos", async () => {
  let previews = 0, commits = 0, received;
  const harness = browserHarness({ onPreview: async (event) => { previews += 1; received = event; return previewPlan(event); }, onCommit: async () => { commits += 1; } });
  await harness.api.open(); await harness.valid();
  assert.equal(harness.get("equipmentPersonalizerReviewButton").textContent, "Revisar disponibilidad");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  await harness.action("review");
  assert.equal(previews, 1); assert.equal(commits, 0);
  assert.equal(received.sections.flatMap(section => section.items)[0].quantity, 0);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, false);
  const html = harness.get("equipmentPersonalizerReview").innerHTML;
  assert.match(html, /Necesario/); assert.match(html, /Disponible en bodega/); assert.match(html, /Capacidad para cubrir eventos/);
  assert.match(html, /<td>5<\/td><td>3<\/td><td>3<\/td>/); assert.match(html, /Rentar 2/);
  assert.match(html, /Otro evento confirmado/); assert.match(html, /Este cuadro/);
  assert.match(html, /todavía no reserva ni guarda/);
  await harness.action("commit"); assert.equal(commits, 1);
});

test("error del servidor al revisar conserva el borrador y bloquea cargar hasta un nuevo éxito", async () => {
  let calls = 0, commits = 0;
  const harness = browserHarness({ onPreview: async (event) => { if (++calls === 1) throw new Error("No se pudo consultar el inventario"); return previewPlan(event); }, onCommit: async () => { commits += 1; } });
  await harness.api.open(); await harness.valid();
  const before = JSON.stringify(harness.api.getDraft()); await harness.action("review");
  assert.equal(harness.dialog.open, true); assert.equal(JSON.stringify(harness.api.getDraft()), before);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  assert.match(harness.get("equipmentPersonalizerErrors").innerHTML, /consultar el inventario/);
  assert.equal(commits, 0);
  await harness.action("review"); assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, false);
});

test("no habilita cargar con un plan incompleto o que omite un equipo en cero", async () => {
  let mode = "omitted";
  const harness = browserHarness({ onPreview: async (event) => mode === "omitted" ? { rows: [] } : previewPlan(event, { missing: undefined }) });
  await harness.api.open(); await harness.valid(); await harness.action("review");
  assert.match(harness.get("equipmentPersonalizerErrors").innerHTML, /no incluye todo el equipo/);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  mode = "invalid"; await harness.action("review");
  assert.match(harness.get("equipmentPersonalizerErrors").innerHTML, /cálculo de un equipo está incompleto/);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
});

test("cerrar durante preview descarta el borrador e ignora la respuesta tardía incluso después de reabrir", async () => {
  let resolvePreview, calls = 0;
  const harness = browserHarness({ onPreview: (event) => { calls += 1; return new Promise(resolve => { resolvePreview = () => resolve(previewPlan(event)); }); } });
  await harness.api.open(); await harness.valid();
  const reviewing = harness.action("review");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  await harness.action("review"); assert.equal(calls, 1);
  await harness.action("close");
  assert.equal(harness.dialog.open, false); assert.equal(harness.api.getDraft().rows.length, 0);
  await harness.api.open(); await harness.input("equipmentPersonalizer-type", "Borrador nuevo");
  resolvePreview(); await reviewing;
  assert.equal(harness.api.getDraft().metadata.type, "Borrador nuevo");
  assert.equal(harness.get("equipmentPersonalizerReview").hidden, true);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
});

test("Escape cancela una revisión en vuelo y un rechazo tardío no ensucia el siguiente borrador", async () => {
  let rejectPreview;
  const harness = browserHarness({ onPreview: () => new Promise((_resolve, reject) => { rejectPreview = reject; }) });
  await harness.api.open(); await harness.valid();
  const reviewing = harness.action("review");
  await harness.dialog.emit("cancel"); await harness.api.open();
  rejectPreview(new Error("Error tardío")); await reviewing;
  assert.equal(harness.get("equipmentPersonalizerErrors").hidden, true);
  assert.equal(harness.api.getDraft().rows.length, 0);
});

test("no admite ediciones ni guardado concurrente mientras se calcula disponibilidad", async () => {
  let resolvePreview, committed = 0;
  const harness = browserHarness({ onPreview: (event) => new Promise(resolve => { resolvePreview = () => resolve(previewPlan(event)); }), onCommit: async () => { committed += 1; } });
  await harness.api.open(); await harness.valid();
  const reviewing = harness.action("review");
  const before = harness.api.getDraft().metadata.type;
  await harness.input("equipmentPersonalizer-type", "Cambio mientras consulta"); await harness.action("commit");
  assert.equal(harness.api.getDraft().metadata.type, before); assert.equal(committed, 0);
  resolvePreview(); await reviewing;
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, false);
  await harness.input("equipmentPersonalizer-type", "Cambio posterior");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  assert.equal(harness.get("equipmentPersonalizerReview").hidden, true);
});

test("sin callback de disponibilidad la acción se llama Revisar cuadro y no afirma existencias consultadas", async () => {
  const harness = browserHarness(); await harness.api.open(); await harness.valid(); await harness.action("review");
  assert.equal(harness.get("equipmentPersonalizerReviewButton").textContent, "Revisar cuadro");
  assert.doesNotMatch(harness.get("equipmentPersonalizerReview").innerHTML, /Disponibilidad con los eventos guardados/);
});

test("preview distingue compra de consumible y trasiego sugerido sin confirmar como disponibilidad", () => {
  const event = personalizer.buildEvent(draft(), inventory);
  const plan = previewPlan(event, { required: 3, available: 3, capacity: 3, missing: 0, action: "DISPONIBLE", transfers: [{ fromName: "Evento A", toName: "Evento B", quantity: 1 }] });
  plan.rows.push({ warehouseInventoryId: "synthetic-tape", description: "Cinta negra", category: "Consumibles", itemType: "consumible", required: 4, available: 2, capacity: 2, missing: 2, action: "COMPRA", reservations: [] });
  const html = personalizer.renderAvailability(plan, event);
  assert.match(html, /Comprar 2/); assert.match(html, /Trasiego por confirmar/); assert.match(html, /1 para compra/);
  assert.doesNotMatch(html, /Trasiego confirmado/);
});

test("la X, Cancelar y Escape descartan sin guardar y al reabrir no reaparece el borrador", async () => {
  let commits = 0;
  for (const action of ["close", "cancel"]) {
    const harness = browserHarness({ onCommit: async () => { commits += 1; } });
    await harness.api.open(); await harness.valid();
    assert.equal(harness.api.getDraft().rows.length, 1);
    if (action === "cancel") await harness.dialog.emit("cancel"); else await harness.action("close");
    assert.equal(harness.dialog.open, false);
    assert.equal(harness.api.getDraft().rows.length, 0);
    await harness.api.open();
    assert.equal(harness.get("equipmentPersonalizerClipboard").value, "");
    assert.equal(harness.get("equipmentPersonalizer-place").value, "");
  }
  assert.equal(commits, 0);
  assert.match(personalizer.renderMarkup(), /aria-label="Cerrar sin guardar"/);
  assert.match(personalizer.renderMarkup(), />Cancelar<\/button>/);
});

test("UI revisa, conserva el borrador si falla y cierra únicamente al guardar correctamente", async () => {
  let calls = 0, refreshes = 0;
  const harness = browserHarness({ beforeOpen: async () => { refreshes += 1; }, onCommit: async () => { if (++calls === 1) throw new Error("Error de prueba"); return { saved: true }; } });
  assert.equal(personalizer.init({ document: harness.doc }), harness.api);
  await harness.api.open(); await harness.valid(); await harness.action("review");
  assert.equal(refreshes, 1);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, false);
  await harness.action("commit");
  assert.equal(harness.dialog.open, true);
  assert.equal(harness.api.getDraft().rows.length, 1);
  assert.match(harness.get("equipmentPersonalizerErrors").innerHTML, /Error de prueba/);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  await harness.action("review"); await harness.action("commit");
  assert.equal(calls, 2);
  assert.equal(harness.dialog.open, false);
  assert.equal(harness.api.getDraft().rows.length, 0);
});

test("no carga la tabla anterior si hay contenido pegado pendiente de preparar", async () => {
  let calls = 0;
  const harness = browserHarness({ onCommit: async () => { calls += 1; } });
  await harness.api.open(); await harness.valid(); await harness.action("review");
  await harness.input("equipmentPersonalizerClipboard", "2\tCinta negra"); await harness.action("review");
  assert.match(harness.get("equipmentPersonalizerErrors").innerHTML, /todavía no está en la tabla/);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  assert.equal(calls, 0);
});

test("el modal muestra toda carga grande mediante páginas, sin truncar ni guardar HTML de origen", async () => {
  const harness = browserHarness(); await harness.api.open();
  await harness.input("equipmentPersonalizerClipboard", Array.from({ length: 5010 }, (_, index) => `${index % 2}\tConsola análoga\tAudio\tNota ${index}`).join("\n"));
  await harness.action("parse");
  assert.equal(harness.api.getDraft().rows.length, 5010);
  assert.match(harness.get("equipmentPersonalizerPagination").innerHTML, /Mostrando 1–75 de 5010 filas. Todas se cargarán/);
  assert.equal((harness.get("equipmentPersonalizerRows").innerHTML.match(/data-personalizer-row=/g) || []).length, 75);
  await harness.action("next");
  assert.match(harness.get("equipmentPersonalizerPagination").innerHTML, /Mostrando 76–150/);
  const dangerous = draft('1\t<script>alert("no")</script>'); dangerous.rows[0].procurementChoice = "rent";
  const html = personalizer.renderRow(dangerous.rows[0], 0, inventory);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("el modal no muestra ni exige Nombre del evento y deriva el nombre interno del tipo", async () => {
  const html = personalizer.renderMarkup();
  assert.doesNotMatch(html, /Nombre del evento|equipmentPersonalizer-name|data-personalizer-metadata="name"/);
  const value = draft();
  value.metadata.name = "Nombre antiguo que ya no se solicita";
  assert.deepEqual(personalizer.validateDraft(value, inventory), []);
  assert.equal(personalizer.buildEvent(value, inventory).name, "Privado");
  const harness = browserHarness(); await harness.api.open();
  assert.equal(harness.get("equipmentPersonalizer-name"), undefined);
});

test("Usar una vez es predeterminado y nunca adjunta una plantilla de servicio", async () => {
  const session = personalizer.createSession({ inventory, serviceGroups });
  session.open(); session.paste("0\tConsola análoga"); session.draft.metadata = metadata();
  assert.equal(session.draft.usageMode, "once");
  session.draft.serviceName = "Valor retenido al cambiar de modo";
  session.draft.serviceGroupId = "no-existe";
  assert.deepEqual(session.review(), []);
  assert.equal("serviceTemplate" in personalizer.buildEvent(session.draft, inventory, serviceGroups), false);
  const harness = browserHarness(); await harness.api.open();
  assert.equal(harness.get("equipmentPersonalizerUsageOnce").checked, true);
  assert.equal(harness.get("equipmentPersonalizerServiceFields").hidden, true);
  assert.equal(harness.get("equipmentPersonalizerServiceName").required, false);
  assert.equal(harness.get("equipmentPersonalizerCommitButton").textContent, "Cargar evento");
});

test("guardar servicio exige nombre explícito y categoría vigente sin equiparar categorías", () => {
  const value = draft(); value.usageMode = "service"; value.serviceName = ""; value.serviceGroupId = "inexistente";
  let errors = personalizer.validateDraft(value, inventory, serviceGroups);
  assert.ok(errors.some(error => error.field === "serviceName"));
  assert.ok(errors.some(error => error.field === "serviceGroupId"));
  value.serviceName = "Nuevo servicio de prueba"; value.serviceGroupId = "PERSONALIZADOS";
  assert.ok(personalizer.validateDraft(value, inventory, serviceGroups).some(error => error.field === "serviceGroupId"));
  value.serviceGroupId = "personalizados";
  assert.deepEqual(personalizer.validateDraft(value, inventory, serviceGroups), []);
  value.serviceName = " ";
  assert.throws(() => personalizer.buildEvent(value, inventory, serviceGroups), /nombre del nuevo tipo de servicio/);
});

test("plantilla reutilizable conserva exactamente secciones, ceros, notas, columnas e inventario", () => {
  const value = draft("Cantidad\tDescripción\tCategoría\tObservaciones\tDetalle\nAUDIO\n0\tConsola análoga\tAudio\tMantener cero\tSerie de prueba\nNota: conservar al final\n1\tEquipo externo sintético\tOtro\tLlevar cable\tDetalle extra");
  value.rows.find(row => row.description === "Equipo externo sintético").procurementChoice = "rent";
  value.usageMode = "service"; value.serviceName = "  Servicio reutilizable sintético  "; value.serviceGroupId = "personalizados";
  const event = personalizer.buildEvent(value, inventory, serviceGroups);
  const template = event.serviceTemplate;
  assert.equal(template.id, "servicio-synthetic-event-one"); assert.equal(template.name, "Servicio reutilizable sintético");
  assert.equal(template.groupId, "personalizados");
  assert.deepEqual(template.mainSections, event.sections);
  assert.deepEqual(template.source, event.source); assert.equal(template.notes, event.notes);
  assert.deepEqual(template.source.rows.map(row => row.cells), value.rows.map(row => row.cells));
  const items = template.mainSections.flatMap(section => section.items);
  assert.equal(items[0].quantity, 0); assert.equal(items[0].warehouseInventoryId, "synthetic-console");
  assert.equal(items[1].procurementChoice, "rent"); assert.equal(items[1].itemType, "equipo");
  assert.deepEqual(items[0].notes, ["Mantener cero", "Detalle: Serie de prueba"]);
  template.mainSections[0].title = "Cambiar copia";
  assert.notEqual(event.sections[0].title, "Cambiar copia");
});

test("elegir guardar servicio muestra campos, categoría Personalizados y confirmación permanente", async () => {
  let commits = 0;
  const harness = browserHarness({ onCommit: async () => { commits += 1; } });
  await harness.api.open(); await harness.valid();
  await harness.input("equipmentPersonalizerUsageService", "service");
  assert.equal(harness.api.getDraft().usageMode, "service");
  assert.equal(harness.get("equipmentPersonalizerServiceFields").hidden, false);
  assert.equal(harness.get("equipmentPersonalizerServiceName").required, true);
  assert.equal(harness.get("equipmentPersonalizerServiceGroup").value, "personalizados");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").textContent, "Guardar servicio y cargar evento");
  assert.equal(harness.get("equipmentPersonalizerServiceName").value, "Privado");
  await harness.input("equipmentPersonalizerServiceName", "Servicio creado de prueba");
  await harness.action("review");
  assert.match(harness.get("equipmentPersonalizerReview").innerHTML, /nuevo tipo de servicio: Servicio creado de prueba/);
  assert.match(harness.get("equipmentPersonalizerReview").innerHTML, /de forma permanente/);
  assert.equal(commits, 0, "revisar no escribe servicios ni eventos");
});

test("cambiar modo o datos de plantilla invalida la revisión previa sin guardar", async () => {
  let previews = 0, commits = 0;
  const harness = browserHarness({ onPreview: async event => { previews += 1; return previewPlan(event); }, onCommit: async () => { commits += 1; } });
  await harness.api.open(); await harness.valid(); await harness.action("review");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, false);
  await harness.input("equipmentPersonalizerUsageService", "service");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  assert.equal(harness.get("equipmentPersonalizerReview").hidden, true);
  await harness.action("review");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, false);
  await harness.input("equipmentPersonalizerServiceName", "Nombre modificado");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  await harness.action("review"); await harness.input("equipmentPersonalizerServiceGroup", "synthetic-events");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  await harness.action("review"); await harness.input("equipmentPersonalizerUsageOnce", "once");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  assert.equal(previews, 4); assert.equal(commits, 0);
});

test("nombre de servicio escrito o vaciado por el usuario no se sobrescribe al alternar modos", async () => {
  const harness = browserHarness(); await harness.api.open(); await harness.valid();
  await harness.input("equipmentPersonalizerUsageService", "service");
  await harness.input("equipmentPersonalizerServiceName", "Nombre propio");
  await harness.input("equipmentPersonalizerUsageOnce", "once");
  await harness.input("equipmentPersonalizer-type", "Tipo distinto");
  await harness.input("equipmentPersonalizerUsageService", "service");
  assert.equal(harness.get("equipmentPersonalizerServiceName").value, "Nombre propio");
  await harness.input("equipmentPersonalizerServiceName", "");
  await harness.input("equipmentPersonalizerUsageOnce", "once"); await harness.input("equipmentPersonalizerUsageService", "service");
  assert.equal(harness.get("equipmentPersonalizerServiceName").value, "");
  await harness.action("review"); assert.match(harness.get("equipmentPersonalizerErrors").innerHTML, /nombre del nuevo tipo de servicio/);
});

test("error al guardar servicio conserva plantilla e IDs exactos para un reintento sin duplicar", async () => {
  const received = [];
  const harness = browserHarness({ onCommit: async event => { received.push(event); if (received.length === 1) throw new Error("Error temporal al guardar el servicio"); return { saved: true }; } });
  await harness.api.open(); await harness.valid(); await harness.input("equipmentPersonalizerUsageService", "service");
  await harness.input("equipmentPersonalizerServiceName", "Servicio para reintento");
  await harness.action("review"); await harness.action("commit");
  assert.equal(harness.dialog.open, true); assert.equal(harness.api.getDraft().usageMode, "service");
  assert.equal(harness.api.getDraft().serviceName, "Servicio para reintento");
  assert.equal(harness.get("equipmentPersonalizerCommitButton").disabled, true);
  await harness.action("review"); await harness.action("commit");
  assert.equal(received.length, 2); assert.deepEqual(received[0], received[1]);
  assert.equal(received[0].serviceTemplate.id, received[1].serviceTemplate.id);
  assert.equal(harness.dialog.open, false);
});

test("X y Cancelar descartan modo servicio sin crear plantilla ni conservar su borrador", async () => {
  let commits = 0;
  for (const action of ["close", "escape"]) {
    const harness = browserHarness({ onCommit: async () => { commits += 1; } });
    await harness.api.open(); await harness.valid(); await harness.input("equipmentPersonalizerUsageService", "service");
    await harness.input("equipmentPersonalizerServiceName", "No debe guardarse"); await harness.action("review");
    if (action === "escape") await harness.dialog.emit("cancel"); else await harness.action("close");
    assert.equal(harness.api.getDraft().usageMode, "once"); assert.equal(harness.api.getDraft().serviceName, "");
    await harness.api.open(); assert.equal(harness.get("equipmentPersonalizerServiceFields").hidden, true);
    assert.equal(harness.get("equipmentPersonalizerUsageOnce").checked, true);
  }
  assert.equal(commits, 0);
});

test("la categoría se vuelve a validar al confirmar si cambia el catálogo durante la revisión", async () => {
  let groups = serviceGroups;
  const session = personalizer.createSession({ inventory, serviceGroups: () => groups, onCommit: async () => { throw new Error("No debe enviarse"); } });
  session.open(); session.paste("0\tConsola análoga"); session.draft.metadata = metadata();
  session.draft.usageMode = "service"; session.draft.serviceName = "Servicio válido"; session.draft.serviceGroupId = "synthetic-events";
  assert.deepEqual(session.review(), []); groups = serviceGroups.filter(group => group.id !== "synthetic-events");
  await assert.rejects(session.commit(), /categoría vigente/);
  assert.equal(session.isOpen, true); assert.equal(session.draft.rows.length, 1);
});
