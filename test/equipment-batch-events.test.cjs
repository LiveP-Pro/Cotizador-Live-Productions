const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseEventFile, verifyEventImport, parseDate } = require("../equipment-event-import.cjs");
const ui = require("../equipment-batch-events.js");
const personalizer = require("../equipment-event-personalizer.js");

// All files and equipment names below are synthetic, constructed for this test.
async function syntheticWorkbook({ ambiguous = false } = {}) {
  const book = new ExcelJS.Workbook();
  for (const [sheetIndex, blocks] of [1, 2, 3].entries()) {
    const sheet = book.addWorksheet(`Dia ${sheetIndex + 1}`);
    for (let block = 0; block < blocks; block++) {
      const col = block * 3 + 1;
      const data = [["Fecha del evento:", `${["jueves", "viernes", "sábado"][sheetIndex]}, ${5 + sheetIndex} de noviembre de 2026`], ["Equipo contratado:", `Servicio sintetico ${sheetIndex}-${block}`], ["Nombre del cliente:", `Cliente ${sheetIndex}-${block}`], ["Lugar del evento:", `Lugar ${sheetIndex}-${block}`], ["Cantidad de invitados:", "Dato literal 100-200"], ["AUDIO"], ["Cantidad", "Descripcion"], [0, `Equipo en cero ${sheetIndex}-${block}`], [2, `Equipo prueba ${sheetIndex}-${block}`], ["Nota: conservar el orden"], [1, "Equipo final"]];
      data.forEach((row, ri) => row.forEach((value, ci) => { sheet.getCell(ri + 1, col + ci).value = value; }));
      sheet.getCell(6, col).font = { bold: true };
      sheet.getCell(9, col + 1).note = "Nota original del equipo";
      sheet.getCell(12, col + 1).value = "";
      sheet.getCell(12, col + 1).note = "Nota en celda sin valor";
      if (ambiguous && sheetIndex === 1 && block === 1) sheet.getCell(13, col).value = 3;
    }
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
function syntheticPdf(pages) {
  const escape = (text) => String(text).replace(/[\\()]/g, "\\$&");
  const draw = (x, y, text) => `BT /F1 12 Tf ${x} ${y} Td (${escape(text)}) Tj ET`;
  const objects = [null, "<< /Type /Catalog /Pages 2 0 R >>", null, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageIds = [];
  for (const page of pages) {
    const pageId = objects.length, contentId = pageId + 1; pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    const operations = page.map(([x, y, value]) => draw(x, y, value)).join("\n");
    objects.push(`<< /Length ${Buffer.byteLength(operations)} >>\nstream\n${operations}\nendstream`);
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const chunks = [Buffer.from("%PDF-1.4\n")], offsets = [0]; let size = chunks[0].length;
  for (let id = 1; id < objects.length; id++) { offsets[id] = size; const chunk = Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`); chunks.push(chunk); size += chunk.length; }
  chunks.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

test("importacion multiple conserva seis cuadros, metadatos, todas celdas, notas y ceros sin deducir horarios", async () => {
  const preview = await parseEventFile(await syntheticWorkbook(), { fileName: "solo-sintetico.xlsx" });
  assert.equal(preview.events.length, 6);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
  assert.equal(preview.events.reduce((sum, event) => sum + event.zeroCount, 0), 6);
  assert.equal(preview.events.reduce((sum, event) => sum + event.itemCount, 0), 18);
  assert.ok(preview.events.every((event) => event.canImport));
  assert.equal(preview.events[0].date, "2026-11-05");
  assert.equal(preview.events[5].date, "2026-11-07");
  assert.equal(preview.events[5].place, "Lugar 2-2");
  assert.ok(preview.sourceCells.some((cell) => JSON.stringify(cell.note || "").includes("Nota en celda sin valor")));
  assert.ok(preview.events.every((event) => !event.setupAt && !event.startAt && !event.endAt && !event.equipmentInAt));
  const original = JSON.stringify(preview);
  const selections = ui.selectionsFor(preview); selections[0].selected = false; selections[1].place = "Ubicacion corregida";
  const drafts = ui.prepareEvents(preview, selections);
  assert.equal(drafts.length, 5); assert.equal(drafts[0].place, "Ubicacion corregida");
  assert.notEqual(drafts[0].sourceImport.metadata.place, drafts[0].place);
  assert.equal(JSON.stringify(preview), original, "las correcciones no modifican el ledger original");
  assert.equal(ui.totals(preview, selections).events, 5);
  assert.equal(ui.totals(preview, selections).zeros, 5);
});

test("un cuadro ambiguo conserva las filas pendientes y permite cargar tras aceptar una advertencia", async () => {
  const preview = await parseEventFile(await syntheticWorkbook({ ambiguous: true }), { fileName: "ambiguo-sintetico.xlsx" });
  assert.equal(preview.verification.complete, true, "la fuente sigue completa aunque requiera correccion");
  assert.equal(preview.events.filter((event) => !event.canImport).length, 1);
  const selections = ui.selectionsFor(preview);
  assert.throws(() => ui.prepareEvents(preview, selections), /Confirme las advertencias/);
  const unresolved = preview.events.find((event) => !event.canImport);
  assert.ok(unresolved.sections.flatMap((section) => section.rows).some((row) => row.type === "unresolved" && row.cells.some((cell) => cell.value === 3)));
  const drafts = ui.prepareEvents(preview, selections, { acknowledgeWarnings: true });
  assert.equal(drafts.length, 6);
  assert.ok(drafts.find((event) => event.id === unresolved.id).sections.flatMap((section) => section.rows).some((row) => row.type === "unresolved"));
  assert.ok(drafts.every((event) => event.sourceImport.warningsAccepted));
});

test("verificacion detecta borrar una nota, alterar cantidad o perder un cero antes de cargar", async () => {
  const preview = await parseEventFile(await syntheticWorkbook(), { fileName: "verificacion-sintetica.xlsx" });
  const first = preview.events[0].sections.flatMap((section) => section.rows).find((row) => row.type === "item");
  first.quantity = 5;
  assert.equal(verifyEventImport(preview).complete, false);
  preview.verification = verifyEventImport(preview);
  assert.throws(() => ui.prepareEvents(preview, ui.selectionsFor(preview)), /todas las celdas/);
});

test("fechas espanolas y Excel Date conservan el ano; no se inventa desde la pestana ni se acepta fecha imposible", () => {
  assert.equal(parseDate("sábado, 7 de noviembre de 2026"), "2026-11-07");
  assert.equal(parseDate("07/11/2026"), "2026-11-07");
  assert.equal(parseDate("2026-11-07T00:00:00.000Z"), "2026-11-07");
  assert.equal(parseDate("05-11"), "");
  assert.equal(parseDate(46331), "");
  assert.equal(parseDate("31/02/2026"), "");
});

test("PDF digital importa varios eventos y conserva fragmentos, encabezados, notas y cero", async () => {
  const buffer = syntheticPdf([
    [[50, 780, "Evento: Evento sintetico A"], [50, 760, "Lugar: Salon sintetico A"], [50, 740, "Fecha: 05/11/2026"], [50, 710, "Cantidad"], [150, 710, "Descripcion"], [50, 680, "0"], [150, 680, "Equipo"], [195, 680, "sintetico"], [150, 650, "Nota: conservar"]],
    [[50, 780, "Evento: Evento sintetico B"], [50, 760, "Lugar: Salon sintetico B"], [50, 740, "Fecha: 06/11/2026"], [50, 710, "Cantidad"], [150, 710, "Descripcion"], [50, 680, "3"], [150, 680, "Equipo B"]]
  ]);
  const preview = await parseEventFile(buffer, { fileName: "eventos-sinteticos.pdf" });
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.equal(preview.events.length, 2);
  assert.ok(preview.events.every((event) => event.canImport), JSON.stringify(preview.events.map((event) => event.issues)));
  assert.equal(preview.events[0].zeroCount, 1);
  assert.equal(preview.events[1].date, "2026-11-06");
  assert.equal(preview.events[0].sections.flatMap((section) => section.items)[0].description, "Equipo sintetico");
});

test("render de vista previa escapa el archivo, nombres y celdas sin ejecutarlos", async () => {
  const preview = await parseEventFile(await syntheticWorkbook(), { fileName: '<img src=x onerror=alert(1)>.xlsx' });
  preview.events[0].place = '<script>alert(1)</script>';
  const html = ui.renderPreview(preview, ui.selectionsFor(preview));
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(html.includes("&lt;img"));
  assert.ok(!html.includes("<script>")); assert.ok(!html.includes("<img"));
  assert.ok(html.includes("data-batch-sheet")); assert.ok(html.includes("celdas originales"));
});

test("personalizador carga borrador completo sin horarios ni coincidencias y no llama commit", async () => {
  let drafts = 0, commits = 0;
  const session = personalizer.createSession({ inventory: [], onDraft: async (event) => { drafts++; assert.equal(event.sections[0].items[0].quantity, 0); assert.equal(event.setupAt, ""); assert.equal(event.serviceTemplate, undefined); return { count: 1 }; }, onCommit: async () => { commits++; } });
  session.open(); session.paste("Cantidad\tDescripcion\n0\tEquipo sintetico sin inventario\n1\tEquipo segundo\nNota: conservar");
  session.draft.usageMode = "service"; session.draft.serviceName = "Servicio futuro";
  const result = await session.loadDraft();
  assert.equal(result.provisional, true); assert.equal(drafts, 1); assert.equal(commits, 0); assert.equal(session.isOpen, false);
  assert.equal(result.event.requestedServiceTemplate.name, "Servicio futuro");
  assert.ok(result.event.sections.flatMap((section) => section.rows).some((row) => row.description?.includes("Nota: conservar")));
});

test("personalizador no deja cargar cantidades incompletas y conserva el borrador al fallar la conexion", async () => {
  const session = personalizer.createSession({ inventory: [], onDraft: async () => { throw new Error("conexion sintetica"); } });
  session.open(); session.paste("2\tEquipo sintetico");
  await assert.rejects(session.loadDraft(), /conexion sintetica/);
  assert.equal(session.isOpen, true); assert.equal(session.draft.rows[0].description, "Equipo sintetico");
  session.draft.rows[0].quantity = "";
  await assert.rejects(session.loadDraft(), /cantidad numerica|cantidad numérica/);
  session.discard(); assert.equal(session.draft.rows.length, 0);
});

function browserHarness(options = {}) {
  const ids = new Map(), elements = [];
  class Element {
    constructor(id = "") { this.id = id; this.dataset = {}; this.listeners = {}; this.value = ""; this.disabled = false; this.open = false; this.textContent = ""; elements.push(this); }
    set innerHTML(html) {
      this.html = html;
      for (const match of html.matchAll(/<([\w-]+)\b([^>]*)>/g)) {
        const attrs = match[2], id = attrs.match(/\bid="([^"]+)"/)?.[1] || "";
        const dataset = {};
        for (const attribute of attrs.matchAll(/data-([a-z-]+)="([^"]*)"/g)) dataset[attribute[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = attribute[2];
        if (!id && !Object.keys(dataset).length) continue;
        const child = new Element(id); child.dataset = dataset; child.disabled = /\sdisabled(?:\s|\/|$)/.test(attrs); child.checked = /\schecked(?:\s|\/|$)/.test(attrs);
        if (id) ids.set(id, child);
      }
    }
    get innerHTML() { return this.html || ""; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    removeEventListener(name, callback) { this.listeners[name] = (this.listeners[name] || []).filter((entry) => entry !== callback); }
    querySelector(selector) { if (selector.includes("batch-action")) return elements.find((entry) => entry.dataset.batchAction === "choose"); return null; }
    querySelectorAll(selector) {
      const name = selector.match(/\[data-([a-z-]+)\]/)?.[1]?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return name ? elements.filter((entry) => entry.dataset[name] !== undefined) : [];
    }
    showModal() { this.open = true; }
    close() { this.open = false; }
    focus() { this.focused = true; }
    remove() { ids.delete(this.id); }
    click() { this.clicked = true; }
    async emit(name, event = {}) { for (const handler of this.listeners[name] || []) await handler({ target: this, preventDefault() {}, ...event }); }
  }
  const opener = new Element("equipmentBatchImportButton"); ids.set(opener.id, opener);
  const doc = { body: { appendChild(element) { ids.set(element.id, element); } }, createElement() { return new Element(); }, getElementById(id) { return ids.get(id); } };
  const api = ui.init({ document: doc, confirmWarnings: () => true, ...options }); const dialog = ids.get("equipmentBatchDialog");
  return { api, dialog, get: (id) => ids.get(id), async action(action) { const target = { dataset: { batchAction: action }, closest() { return this; } }; await dialog.emit("click", { target }); } };
}
const fakeFile = () => ({ name: "sintetico.xlsx", size: 10, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", arrayBuffer: async () => new ArrayBuffer(10) });

test("X y Cancelar descartan el preview; una respuesta tardia no reaparece ni importa eventos", async () => {
  const preview = await parseEventFile(await syntheticWorkbook(), { fileName: "sintetico.xlsx" });
  let deliver, calls = 0;
  const harness = browserHarness({ fetch: () => new Promise((resolve) => { deliver = resolve; }), bridge: { importEvents() { calls++; } } });
  harness.api.open(); const pending = harness.api.read(fakeFile());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.dialog.open, true);
  await harness.action("close");
  assert.equal(harness.dialog.open, false); assert.equal(harness.api.getPreview(), null);
  deliver({ ok: true, json: async () => preview }); await pending;
  assert.equal(harness.api.getPreview(), null); assert.equal(calls, 0);
  harness.api.open(); assert.equal(harness.api.getPreview(), null);
  assert.equal(harness.get("equipmentBatchContent").innerHTML, "");
});

test("Cargar todos entrega solo borradores; una falla conserva el archivo y evita envios concurrentes", async () => {
  const preview = await parseEventFile(await syntheticWorkbook(), { fileName: "sintetico.xlsx" });
  let calls = 0, finish;
  const harness = browserHarness({ fetch: async () => ({ ok: true, json: async () => preview }), bridge: { importEvents(events) { calls++; assert.equal(events.length, 6); assert.ok(events.every((event) => event.pendingLogistics && !event.startAt)); return new Promise((resolve, reject) => { finish = { resolve, reject }; }); } } });
  harness.api.open(); await harness.api.read(fakeFile());
  assert.equal(harness.get("equipmentBatchApply").disabled, false);
  const applying = harness.action("apply");
  await harness.action("apply"); await harness.action("close");
  assert.equal(calls, 1); assert.equal(harness.dialog.open, true);
  finish.reject(new Error("fallo de conexion sintetico")); await applying;
  assert.equal(harness.dialog.open, true); assert.equal(harness.api.getPreview().events.length, 6);
  assert.match(harness.get("equipmentBatchStatus").textContent, /conexion sintetico/);
  const retry = harness.action("apply"); finish.resolve({ count: 6 }); await retry;
  assert.equal(calls, 2); assert.equal(harness.dialog.open, true); assert.equal(harness.api.getPreview(), null);
  assert.equal(harness.api.getImported().events.length, 6);
  assert.equal(harness.get("equipmentBatchRent").hidden, false);
  await harness.action("apply"); assert.equal(calls, 2, "la vista lista no vuelve a importar");
});

test("pares numericos paralelos sin metadatos ni encabezados requieren revision, sin inferir eventos", async () => {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Ambigua sintetica");
  sheet.addRow([2, "Equipo sintetico A", 3, "Dato adicional ambiguo"]);
  sheet.addRow([0, "Equipo sintetico B", 1, "Otro dato"]);
  const preview = await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: "pares-sinteticos.xlsx" });
  assert.equal(preview.verification.complete, true);
  assert.ok(preview.events.every((event) => !event.canImport));
  assert.equal(preview.verification.sourceCellCount, 8);
});

function permutations(values) { return values.length ? values.flatMap((value, index) => permutations(values.filter((_, other) => other !== index)).map((tail) => [value, ...tail])) : [[]]; }

test("Excel admite las 24 posiciones de Cantidad Descripcion Categoria Observaciones conservando columnas extra y sus ceros", async () => {
  const variants = permutations(["Cantidad", "Descripción", "Categoría", "Observaciones"]);
  for (const headers of variants) {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Permutada sintetica");
    sheet.addRow(["Lugar del evento:", "Salon sintetico permutado"]); sheet.addRow(["Fecha:", "07/11/2026"]);
    sheet.addRow([...headers, "Otra columna", "Dato en cero"]);
    const row = { Cantidad: 0, "Descripción": "  Equipo sintetico con espacios  ", "Categoría": "Luces sinteticas", Observaciones: "No perder esta nota" };
    sheet.addRow([...headers.map((name) => row[name]), "Información adicional literal", 0]);
    sheet.addRow([...headers.map((name) => ({ ...row, Cantidad: 3, "Descripción": "Equipo segundo sintetico" })[name]), "Otro dato", 0]);
    sheet.getCell(4, headers.indexOf("Descripción") + 1).note = "Comentario original";
    const preview = await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: "permutaciones-sinteticas.xlsx" });
    assert.equal(preview.events.length, 1, headers.join(",")); assert.equal(preview.verification.complete, true, headers.join(","));
    const event = preview.events[0]; assert.equal(event.canImport, true, JSON.stringify({ headers, issues: event.issues })); assert.equal(event.zeroCount, 1);
    const items = event.sections.flatMap((section) => section.items); assert.deepEqual(items.map((item) => item.quantity), [0, 3]); assert.equal(items[0].description, row["Descripción"]);
    assert.equal(items[0].inventoryCategory, "Luces sinteticas"); assert.ok(items[0].notes.includes("No perder esta nota")); assert.ok(items[0].notes.includes("Información adicional literal")); assert.ok(items[0].notes.includes("0"));
    assert.ok(preview.sourceCells.some((cell) => JSON.stringify(cell.note || "").includes("Comentario original")));
  }
});

test("cuadros paralelos con encabezados permutados separan metadatos categorias y notas sin perder datos", async () => {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Paralelos sinteticos");
  sheet.addRow(["Lugar:", "Salon A", "", "", "", "", "Lugar:", "Salon B"]);
  sheet.addRow(["Categoría", "Observaciones", "Descripción", "Cantidad", "Dato extra", "", "Descripción", "Observaciones", "Categoría", "Cantidad", "Dato extra"]);
  sheet.addRow(["Audio sintetico", "Nota A", "Equipo A", 0, 0, "", "Equipo B", "Nota B", "Luces sinteticas", 4, 0]);
  const preview = await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: "paralelos-permutados-sinteticos.xlsx" });
  assert.equal(preview.verification.complete, true); assert.equal(preview.events.length, 2); assert.ok(preview.events.every((event) => event.canImport), JSON.stringify(preview.events.map((event) => event.issues)));
  assert.deepEqual(preview.events.map((event) => event.place), ["Salon A", "Salon B"]);
  const items = preview.events.map((event) => event.sections.flatMap((section) => section.items)[0]);
  assert.deepEqual(items.map((item) => [item.quantity, item.description, item.inventoryCategory]), [[0, "Equipo A", "Audio sintetico"], [4, "Equipo B", "Luces sinteticas"]]);
  assert.ok(items[0].notes.includes("Nota A")); assert.ok(!items[0].notes.includes("Nota B")); assert.ok(items[1].notes.includes("Nota B"));
});

test("negritas y categorias con observaciones adicionales permanecen en orden, sin convertirse en equipo", async () => {
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Categorias sinteticas");
  sheet.addRow(["Descripción", "Cantidad", "Observaciones"]);
  sheet.addRow(["AUDIO SINTETICO", "", "Conservar nota de categoria"]); sheet.getCell("A2").font = { bold: true };
  sheet.addRow(["Equipo sintetico", 0, "Nota de equipo"]);
  sheet.addRow(["Nota: instruccion final", "", "Otra observacion"]);
  const preview = await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: "categorias-sinteticas.xlsx" });
  assert.equal(preview.verification.complete, true); assert.equal(preview.events[0].canImport, true); assert.equal(preview.events[0].itemCount, 1);
  assert.deepEqual(preview.events[0].sections.flatMap((section) => section.rows).map((row) => row.type), ["header", "heading", "item", "note"]);
  assert.equal(preview.events[0].sections.flatMap((section) => section.items)[0].inventoryCategory, "AUDIO SINTETICO");
  assert.equal(preview.sourceCells.filter((cell) => cell.value === "Conservar nota de categoria").length, 1);
});

test("encabezados repetidos o posiciones cruzadas se bloquean sin descartar ninguna celda", async () => {
  for (const headers of [["Descripción", "Cantidad", "Descripción"], ["Cantidad", "Cantidad", "Descripción", "Descripción"], ["Cantidad", "Descripción", "Observaciones", "Observaciones"]]) {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Ambigua sintetica"); sheet.addRow(headers); sheet.addRow(["Equipo sintetico", 2, "Dato tercero", 0]);
    const preview = await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: "encabezados-ambiguos-sinteticos.xlsx" });
    assert.equal(preview.verification.complete, true); assert.ok(preview.events.every((event) => !event.canImport), JSON.stringify(headers)); assert.equal(preview.sourceCells.length, headers.length + 4);
    assert.ok(preview.events.some((event) => event.issues.some((issue) => /headers|header|columns/.test(issue.code))));
  }
});

test("una cantidad textual o negativa despues del encabezado no se omite ni se transforma en cero", async () => {
  for (const badQuantity of ["dos", -2]) {
    const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Cantidad invalida sintetica");
    sheet.addRow(["Descripción", "Cantidad", "Observaciones"]); sheet.addRow(["Equipo sintetico", badQuantity, "No convertir a cero"]); sheet.addRow(["Equipo valido", 0, "Conservar"]);
    const preview = await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()), { fileName: "cantidad-invalida-sintetica.xlsx" });
    assert.equal(preview.verification.complete, true); assert.equal(preview.events[0].canImport, false); assert.ok(preview.events[0].issues.some((issue) => issue.code === "invalid_quantity")); assert.equal(preview.events[0].itemCount, 1); assert.equal(preview.events[0].zeroCount, 1);
    assert.ok(preview.sourceCells.some((cell) => cell.value === badQuantity));
  }
});

function clientPreview(fields = {}) {
  const event = { id: "client-synthetic-1", canImport: true, date: "2026-11-25", place: "Lugar sintético", client: "Cliente sintético", itemCount: 1, zeroCount: 1,
    sourceSheet: "Agenda sintética", sourceCells: [{ ref: "synthetic-A1", sheet: "Agenda sintética", address: "A1", value: 0 }],
    sections: [{ title: "Equipo sintético", items: [{ quantity: 0, description: "Unidad sintética" }], rows: [{ type: "item", quantity: 0, description: "Unidad sintética", cells: [{ address: "A1", value: 0 }] }] }],
    sourceImport: { metadata: { date: "25/11/2026", place: "Lugar sintético" } }, ...fields };
  return { source: { fileName: "cliente-sintetico.xlsx" }, sheets: [{ name: event.sourceSheet, sourceCellCount: 1, eventIds: [event.id] }], verification: { complete: true, sourceCellCount: 1, representedCellCount: 1 }, events: [event] };
}
const deliverPreview = (preview) => ({ ok: true, json: async () => structuredClone(preview) });

// These tests exercise the browser client with synthetic data only.
test("openFile abre directamente y descarta lecturas reemplazadas, canceladas o inválidas", async () => {
  const pending = [], first = clientPreview(), second = clientPreview({ id: "client-synthetic-2", place: "Segundo lugar sintético" });
  const h = browserHarness({ fetch: (url, options) => new Promise((resolve) => pending.push({ resolve, signal: options.signal })) });
  assert.equal(await h.api.openFile(null), null); assert.equal(h.dialog.open, false);
  const oldRead = h.api.openFile(fakeFile()); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.dialog.open, true); assert.equal(pending.length, 1);
  const latestRead = h.api.openFile(fakeFile()); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pending[0].signal.aborted, true);
  pending[1].resolve(deliverPreview(second)); assert.equal((await latestRead).events[0].id, "client-synthetic-2");
  pending[0].resolve(deliverPreview(first)); assert.equal(await oldRead, null);
  assert.equal(h.api.getPreview().events[0].place, "Segundo lugar sintético");
  assert.equal(await h.api.read(null), null); assert.equal(h.api.getPreview().events[0].id, "client-synthetic-2");
  h.api.close(); assert.equal(h.api.getPreview(), null);
  assert.equal(await h.api.openFile({ ...fakeFile(), name: "invalido.xls" }), null);
  assert.match(h.get("equipmentBatchStatus").textContent, /\.xlsx/);
  assert.equal(pending.length, 2);
});

test("openFile devuelve null ante respuestas malformadas y errores sin objeto; conserva una ruta de reintento", async () => {
  let attempt = 0;
  const h = browserHarness({ fetch: async () => { attempt++; if (attempt === 1) throw null; if (attempt === 2) return deliverPreview({ events: null }); return deliverPreview(clientPreview()); } });
  assert.equal(await h.api.openFile(fakeFile()), null);
  assert.match(h.get("equipmentBatchStatus").textContent, /No se pudo leer/);
  assert.equal(await h.api.openFile(fakeFile()), null);
  assert.match(h.get("equipmentBatchStatus").textContent, /revisión válida/);
  assert.ok(await h.api.openFile(fakeFile())); assert.equal(h.get("equipmentBatchApply").disabled, false);
});

test("una carga prepara todos los reportes, bloquea concurrencia y conserva el resultado al cerrar", async () => {
  let imports = 0, notified = 0, releaseNotification, releaseReport;
  const reports = [], result = { count: 1, events: [{ id: "actual-synthetic-id" }] };
  const h = browserHarness({ fetch: async () => deliverPreview(clientPreview()), onImported: async (received, events) => {
    notified++; assert.equal(received, result); assert.equal(events.length, 1); await new Promise((resolve) => { releaseNotification = resolve; });
  }, bridge: { importEvents() { imports++; return result; }, afterImport(mode, context) { reports.push(mode); assert.equal(context.result, result); assert.equal(context.events.length, 1); if (mode === "rent") return new Promise((resolve) => { releaseReport = resolve; }); } } });
  await h.api.openFile(fakeFile()); const importing = h.action("apply");
  await new Promise((resolve) => setImmediate(resolve));
  await h.action("apply"); await h.action("apply-rent"); assert.equal(h.api.close(), false);
  assert.equal(imports, 1); assert.equal(notified, 1); assert.deepEqual(reports, []);
  releaseNotification(); await importing;
  assert.equal(h.dialog.open, true); assert.equal(h.api.getPreview(), null);
  assert.equal(h.get("equipmentBatchApply").hidden, true);
  const reporting = h.action("apply-rent");
  await h.action("apply-rent"); await h.action("apply-purchase"); await h.action("apply");
  assert.equal(h.api.close(), false); assert.deepEqual(reports, ["rent"]);
  releaseReport(); await reporting; await h.action("apply-purchase");
  assert.deepEqual(reports, ["rent", "purchase"]); assert.equal(imports, 1); assert.equal(notified, 1);
  await h.action("report-summary"); assert.equal(h.dialog.open, false);
  h.api.open(); assert.equal(h.dialog.open, true); await h.action("apply-purchase");
  assert.equal(imports, 1); assert.equal(notified, 1); assert.equal(h.api.getImported().events.length, 1);
});

test("fallos del reporte o de onImported no vuelven a ofrecer importar el archivo", async () => {
  let imports = 0, notified = 0, reports = 0;
  const h = browserHarness({ fetch: async () => deliverPreview(clientPreview()), onImported() { notified++; throw null; }, bridge: {
    importEvents() { imports++; return { count: 1 }; }, afterImport() { reports++; if (reports === 1) throw new Error("Reporte sintético fallido"); }
  } });
  await h.api.openFile(fakeFile()); await h.action("apply");
  assert.match(h.get("equipmentBatchStatus").textContent, /ya se cargaron/);
  await h.action("apply-rent"); assert.match(h.get("equipmentBatchStatus").textContent, /Reporte sintético fallido/);
  await h.action("apply-rent"); await h.action("apply");
  assert.equal(imports, 1); assert.equal(notified, 1); assert.equal(reports, 2);
  assert.equal(h.dialog.open, true); assert.equal(h.api.getPreview(), null);
});

test("conflictos de fecha se corrigen sin alterar la fuente ni mover fechas escritas de otros horarios", async () => {
  const preview = clientPreview({ canImport: false, date: "2026-11-25", setupAt: "2026-11-26T10:00", setupApplies: true,
    startAt: "2026-11-25T11:00", endAt: "2026-11-25T14:00", teardownAt: "2026-11-26T15:00", equipmentInAt: "2026-11-27T10:00",
    scheduleDerivedFields: { endDate: "event.date", setupDate: "event.date + weekday" }, issues: [{ code: "conflicting_schedule_order", message: "Fechas originales contradictorias", refs: ["A1"] }] });
  const original = JSON.stringify(preview), selections = ui.selectionsFor(preview);
  assert.equal(selections[0].selected, true); assert.throws(() => ui.prepareEvents(preview, selections), /Confirme las advertencias/);
  const html = ui.renderPreview(preview, selections);
  assert.doesNotMatch(html, /data-batch-review=/); assert.doesNotMatch(html, /data-batch-field="date"[^>]* disabled/);
  const h = browserHarness({ fetch: async () => deliverPreview(preview), bridge: { importEvents(events) {
    assert.equal(events[0].date, "2026-11-26"); assert.equal(events[0].endDate, "2026-11-26");
    assert.equal(events[0].setupAt, "2026-11-26T10:00"); assert.equal(events[0].equipmentInAt, "2026-11-27T10:00");
    assert.equal(events[0].sourceImport.metadata.date, "25/11/2026"); assert.equal(events[0].sourceImport.warningsAccepted, true); return { count: 1 };
  } } });
  await h.api.openFile(fakeFile());
  await h.dialog.emit("input", { target: { dataset: { batchField: "date", batchIndex: "0" }, value: "2026-11-26" } });
  assert.equal(h.get("equipmentBatchApply").disabled, false); await h.action("apply");
  assert.equal(JSON.stringify(preview), original);
  const manual = browserHarness({ fetch: async () => deliverPreview(preview) }); await manual.api.openFile(fakeFile());
  await manual.dialog.emit("input", { target: { dataset: { batchField: "endDate", batchIndex: "0" }, value: "2026-11-27" } });
  await manual.dialog.emit("input", { target: { dataset: { batchField: "date", batchIndex: "0" }, value: "2026-11-26" } });
  assert.equal(manual.get("equipmentBatchApply").disabled, false);
  assert.match(manual.get("equipmentBatchWarnings").innerHTML, /contradictorios/, "la fecha final editada se conserva y queda pendiente de revisión");
});

test("cuadros idénticos pueden cargarse con una advertencia y el cuadro excluido permanece íntegro como referencia", async () => {
  const preview = clientPreview(), second = structuredClone(preview.events[0]);
  second.id = "client-synthetic-2"; second.sourceCells = [{ ref: "synthetic-D1", sheet: second.sourceSheet, address: "D1", value: 0 }];
  preview.events.push(second); preview.sheets[0].eventIds.push(second.id); preview.verification.sourceCellCount = preview.verification.representedCellCount = 2;
  preview.duplicateCandidates = [{ id: "synthetic-duplicate", eventIds: preview.events.map((event) => event.id), requiresReview: true }];
  const original = JSON.stringify(preview), selections = ui.selectionsFor(preview);
  assert.ok(selections.every((entry) => entry.selected)); assert.equal(ui.selectionError(preview, selections), "");
  assert.ok(ui.selectionWarnings(preview, selections).some((warning) => warning.code === "unresolved_duplicates"));
  assert.equal(ui.prepareEvents(preview, selections, { acknowledgeWarnings: true }).length, 2);
  selections.forEach((entry) => { entry.duplicateReviews["synthetic-duplicate"] = "all"; });
  assert.equal(ui.prepareEvents(preview, selections).length, 2, "incluir ambos requiere confirmar que son eventos distintos");
  let imported;
  const h = browserHarness({ fetch: async () => deliverPreview(preview), bridge: { importEvents(events) { imported = events; return { count: events.length }; } } });
  await h.api.openFile(fakeFile()); assert.equal(h.get("equipmentBatchApply").disabled, false);
  await h.dialog.emit("change", { target: { dataset: { batchDuplicate: "0" }, value: preview.events[0].id } });
  assert.equal(h.get("equipmentBatchApply").disabled, false); await h.action("apply");
  assert.equal(imported.length, 1); assert.equal(imported[0].sections[0].items.length, 1);
  assert.equal(imported[0].sourceImport.referenceTables.length, 1);
  const reference = imported[0].sourceImport.referenceTables[0];
  assert.deepEqual(reference.sourceCells, second.sourceCells); assert.deepEqual(reference.sections, second.sections);
  assert.equal(reference.selectionDecision.choice, preview.events[0].id);
  assert.equal(JSON.stringify(preview), original);
});

test("una sola confirmación permite aceptar avisos; Cancelar conserva el archivo y no carga nada", async () => {
  const preview = clientPreview({ date: "", place: "", issues: [{ code: "conflicting_schedule", message: "Horario original contradictorio" }], warnings: [{ code: "pending_times", message: "Horario pendiente" }] });
  let calls = 0, imports = 0, notified = 0, approve;
  const h = browserHarness({ fetch: async () => deliverPreview(preview), confirmWarnings(message, warnings) {
    calls++; assert.match(message, /como borradores/); assert.ok(warnings.length >= 1);
    if (calls === 1) return false;
    return new Promise((resolve) => { approve = resolve; });
  }, onImported() { notified++; }, bridge: { importEvents(events) {
    imports++; assert.equal(events.length, 1); assert.equal(events[0].sourceImport.warningsAccepted, true); assert.equal(events[0].sections[0].items[0].quantity, 0); return { count: 1 };
  } } });
  await h.api.openFile(fakeFile()); assert.equal(h.get("equipmentBatchApply").disabled, false);
  assert.match(h.get("equipmentBatchWarnings").innerHTML, /Advertencias para la carga/);
  assert.doesNotMatch(h.get("equipmentBatchContent").innerHTML, /data-batch-review|equipment-batch-error|equipment-batch-warnings/);
  await h.action("apply"); assert.equal(calls, 1); assert.equal(imports, 0); assert.equal(h.dialog.open, true); assert.ok(h.api.getPreview());
  const accepted = h.action("apply"); await h.action("apply"); await h.action("apply-rent");
  assert.equal(calls, 2); assert.equal(imports, 0); approve(true); await accepted;
  assert.equal(imports, 1); assert.equal(notified, 1); assert.equal(h.api.getPreview(), null);
  await h.action("apply"); assert.equal(imports, 1); assert.equal(calls, 2);
});

test("confirmaciones tardías no cargan después de cerrar, cambiar archivo, editar selección o revocar permisos", async () => {
  const soft = clientPreview({ issues: [{ code: "conflicting_schedule", message: "Horario por revisar" }] });
  for (const action of ["close", "replace", "edit", "revoke", "destroy"]) {
    let approve, imports = 0;
    const session = { permissions: ["equipment.write", "equipment.reports"] };
    const h = browserHarness({ fetch: async () => deliverPreview(soft), confirmWarnings: () => new Promise((resolve) => { approve = resolve; }),
      access: { can(user, permission) { return user.permissions.includes(permission); } }, session, bridge: { importEvents() { imports++; return { count: 1 }; } } });
    await h.api.openFile(fakeFile()); const pending = h.action("apply");
    if (action === "close") h.api.close();
    if (action === "replace") await h.api.openFile(fakeFile());
    if (action === "edit") await h.dialog.emit("input", { target: { dataset: { batchField: "name", batchIndex: "0" }, value: "Referencia editada" } });
    if (action === "revoke") session.permissions = [];
    if (action === "destroy") h.api.destroy();
    approve(true); await pending; assert.equal(imports, 0, action);
  }
});

test("una confirmación reemplazada no desbloquea otra carga en curso", async () => {
  const soft = clientPreview({ date: "" }), approvals = []; let imports = 0, finish;
  const h = browserHarness({ fetch: async () => deliverPreview(soft), confirmWarnings: () => new Promise((resolve) => approvals.push(resolve)), bridge: {
    importEvents() { imports++; return new Promise((resolve) => { finish = resolve; }); }
  } });
  await h.api.openFile(fakeFile()); const old = h.action("apply"); await h.api.openFile(fakeFile()); const current = h.action("apply");
  approvals[1](true); await new Promise((resolve) => setImmediate(resolve)); assert.equal(imports, 1);
  approvals[0](true); await old; await h.action("apply"); assert.equal(h.api.close(), false); assert.equal(imports, 1);
  finish({ count: 1 }); await current; assert.equal(imports, 1);
});

test("datos activos inválidos y pérdida de celdas siguen bloqueados aunque se acepten advertencias", () => {
  const source = clientPreview(), selections = ui.selectionsFor(source);
  for (const quantity of [null, undefined, "", "dos", -1, false, Infinity]) {
    const invalid = structuredClone(source); invalid.events[0].sections[0].items[0].quantity = quantity;
    assert.match(ui.selectionError(invalid, selections), /cantidad o descripción inválida/);
    assert.throws(() => ui.prepareEvents(invalid, selections, { acknowledgeWarnings: true }), /cantidad o descripción inválida/);
  }
  const missingDescription = structuredClone(source); missingDescription.events[0].sections[0].items[0].description = " ";
  assert.throws(() => ui.prepareEvents(missingDescription, selections, { acknowledgeWarnings: true }), /cantidad o descripción inválida/);
  source.verification.complete = false;
  assert.throws(() => ui.prepareEvents(source, selections, { acknowledgeWarnings: true }), /todas las celdas/);
});

test("una propuesta corroborada completa los horarios revisados y conserva la fecha original", () => {
  const preview = clientPreview({ date: "2026-11-06", startAt: "2026-11-06T16:00", endAt: "2026-11-06T23:00", setupAt: "2026-11-07T10:00", setupApplies: true,
    sourceImport: { metadata: { date: "06/11/2026" }, schedule: { startAt: "2026-11-06T16:00" } },
    scheduleSuggestion: { code: "corroborated_event_date", date: "2026-11-07", originalDate: "2026-11-06", schedule: { startDate: "2026-11-07", startAt: "2026-11-07T16:00", endDate: "2026-11-07", endAt: "2026-11-07T23:00", setupAt: "2026-11-07T10:00", setupApplies: true, equipmentInAt: "2026-11-08T10:00" } } });
  const original = JSON.stringify(preview), selections = ui.selectionsFor(preview);
  assert.equal(selections[0].date, "2026-11-07"); assert.equal(selections[0].endDate, "2026-11-07"); assert.equal(selections[0].equipmentInDate, "2026-11-08");
  assert.throws(() => ui.prepareEvents(preview, selections), /Confirme las advertencias/);
  const draft = ui.prepareEvents(preview, selections, { acknowledgeWarnings: true })[0];
  assert.equal(draft.sourceImport.sourceEventId, preview.events[0].id);
  assert.equal(draft.sourceImport.scheduleSuggestionAccepted, true); assert.equal(draft.sourceImport.metadata.date, "06/11/2026"); assert.equal(draft.sourceImport.schedule.startAt, "2026-11-06T16:00");
  selections[0].date = "2026-11-08";
  assert.equal(ui.prepareEvents(preview, selections, { acknowledgeWarnings: true })[0].sourceImport.scheduleSuggestionAccepted, false);
  assert.equal(JSON.stringify(preview), original);
});

test("las celdas de cuadros de referencia cuentan en la selección sin añadir líneas de equipo", () => {
  const preview = clientPreview(), reference = structuredClone(preview.events[0]);
  reference.id = "reference-synthetic"; reference.sourceCells = [{ ref: "synthetic-reference-B1", sheet: reference.sourceSheet, address: "B1", value: "Dato de referencia" }];
  preview.events[0].sourceImport.referenceTables = [reference]; preview.referenceTableCount = 1; preview.tableCount = 2;
  const counts = ui.totals(preview, ui.selectionsFor(preview));
  assert.equal(counts.events, 1); assert.equal(counts.items, 1); assert.equal(counts.zeros, 1); assert.equal(counts.cells, 2);
  const html = ui.renderPreview(preview, ui.selectionsFor(preview));
  assert.match(html, /1 eventos · 1 hojas · 1 cuadro de referencia/); assert.match(html, /Cuadro original de referencia/); assert.match(html, /Dato de referencia/);
});

test("pendientes rutinarios sin horarios escritos no obligan a confirmar un archivo válido", async () => {
  const preview = clientPreview({ warnings: [{ code: "pending_times", message: "Horarios pendientes" }, { code: "incomplete_schedule", message: "Hora inicial pendiente" }] });
  let confirmations = 0, imports = 0;
  const h = browserHarness({ fetch: async () => deliverPreview(preview), confirmWarnings() { confirmations++; return false; }, bridge: { importEvents() { imports++; return { count: 1 }; } } });
  await h.api.openFile(fakeFile()); await h.action("apply"); assert.equal(confirmations, 0); assert.equal(imports, 1);
});
