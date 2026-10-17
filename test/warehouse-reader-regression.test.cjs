const assert = require("node:assert/strict");
const test = require("node:test");
const { createRequire } = require("node:module");
const { deflateSync } = require("node:zlib");
const ExcelJS = require("exceljs");
const JSZip = createRequire(require.resolve("exceljs"))("jszip");
const { parseInventoryFile } = require("../warehouse-import.cjs");
const { normalizeXlsxNamespaces, normalizeXmlNamespaces } = require("../warehouse-xlsx-normalize.cjs");

// Fixtures are created only from engineering examples; no catalog or stock file
// participates in these tests.
async function workbook(sheets, configure = () => {}) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    rows.forEach((row) => sheet.addRow(row));
  }
  configure(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}
const parseXlsx = (buffer, options = {}) => parseInventoryFile(buffer, { fileName: "engineering.xlsx", ...options });
const escapePdf = (value) => String(value).replace(/[\\()]/g, "\\$&");
const text = (x, y, value) => `BT /F1 10 Tf 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`;
const headers = () => [text(50, 720, "Cantidad"), text(150, 720, "Descripcion"), text(430, 720, "Notas")];
const item = (count, name, y = 690) => [text(50, y, count), text(150, y, name)];

function stream(bytes, dictionary = "") {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return Buffer.concat([Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`), data, Buffer.from("\nendstream")]);
}
function pdf(pages) {
  const objects = [null, "<< /Type /Catalog /Pages 2 0 R >>", null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageIds = [];
  for (const page of pages) {
    const pageId = objects.length; pageIds.push(pageId); objects.push(null);
    const contentId = objects.length; objects.push(null);
    const names = [], operations = [...(page.operations || [])];
    for (const [index, image] of (page.images || []).entries()) {
      const id = objects.length, name = `Im${index}`; names.push(`/${name} ${id} 0 R`);
      const width = 4, height = 4;
      objects.push(stream(deflateSync(Buffer.from([0, 255, 0, 255, 255, 0, 255, 0, 0, 255, 0, 255, 255, 0, 255, 0])),
        `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`));
      operations.push(`q ${image.width} 0 0 ${image.height} ${image.x} ${image.y} cm /${name} Do Q`);
    }
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> /XObject << ${names.join(" ")} >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = stream(operations.join("\n"));
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const chunks = [Buffer.from("%PDF-1.4\n%engineering\n")], offsets = [0]; let length = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    const entry = Buffer.concat([Buffer.from(`${id} 0 obj\n`), Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id]), Buffer.from("\nendobj\n")]);
    offsets[id] = length; chunks.push(entry); length += entry.length;
  }
  chunks.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`));
  return Buffer.concat(chunks);
}
const parsePdf = (pages) => parseInventoryFile(pdf(pages), { fileName: "engineering.pdf" });

test("Excel namespaces x: and ns0: retain formulas zero, sheets and source bytes", async () => {
  const ordinary = await workbook({ First: [["Cantidad", "Equipo", "Notas"], [0, "Modelo AC/DC-12", "x: texto <ns0:literal>"], [{ formula: "1-1", result: 0 }, "Modelo AC-DC/12", 0]],
    Second: [["Equipo", "Stock"], ['Soporte 12"', 2], ["Soporte 12'", 3]] });
  for (const prefix of ["x", "ns0"]) {
    const zip = await JSZip.loadAsync(ordinary);
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !/\.(xml|rels)$/.test(entry.name)) continue;
      let xml = await entry.async("string");
      if (!/xmlns="http:\/\/schemas\.openxmlformats\.org\/(?:spreadsheetml\/2006\/main|package\/2006\/(?:relationships|content-types))"/.test(xml)) continue;
      xml = xml.replace(/xmlns="([^"]+)"/, `xmlns:${prefix}="$1"`).replace(/<(\/?)([A-Za-z_][\w.-]*)(?=[\s/>])/g, `<$1${prefix}:$2`);
      zip.file(entry.name, xml);
    }
    const prefixed = await zip.generateAsync({ type: "nodebuffer" }), originalCopy = Buffer.from(prefixed);
    const result = await parseXlsx(prefixed);
    assert.equal(result.verification.complete, true, JSON.stringify(result.blockers));
    assert.deepEqual(result.items.map((row) => [row.name, row.quantity]), [["Modelo AC/DC-12", 0], ["Modelo AC-DC/12", 0], ['Soporte 12"', 2], ["Soporte 12'", 3]]);
    assert.deepEqual(prefixed, originalCopy);
    assert.equal(result.sourceCells.find((cell) => cell.address === "A3" && cell.sheet === "First").rawValue.result, 0);
    const normalized = await JSZip.loadAsync(await normalizeXlsxNamespaces(prefixed));
    assert.match(await normalized.file("xl/workbook.xml").async("string"), /r:id="rId/);
  }
});

test("namespace normalization preserves literal XML-looking text, attributes and extension namespaces", () => {
  const xml = '<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="urn:rel" xmlns="urn:extension"><x:c r:id="keep"><x:t><![CDATA[<x:literal>]]>x: texto &lt;x:tag&gt;</x:t></x:c><extra>original</extra><!-- <x:comment> --></x:worksheet>';
  const normalized = normalizeXmlNamespaces(xml);
  assert.match(normalized, /r:id="keep"/);
  assert.match(normalized, /<!\[CDATA\[<x:literal>\]\]>/);
  assert.match(normalized, /<!-- <x:comment> -->/);
  assert.match(normalized, /<extra xmlns="urn:extension">original<\/extra>/);
});

test("uninterpretable Excel rows block a partial import while retaining every original cell", async () => {
  const result = await parseXlsx(await workbook({ Engineering: [["Equipo", "Cantidad", "Notas"], ["Equipo valido", 0, "conservar"], ["Equipo pendiente", "pendiente", "resolver"], ["Otro equipo", 3]] }));
  assert.equal(result.verification.complete, false);
  assert.ok(result.blockers.some((message) => message.includes("fila 3") && message.includes("Equipo pendiente")));
  assert.equal(result.sourceCells.length, 11);
  assert.equal(result.verification.representedCellCount, 11);
  assert.equal(result.sourceRows.filter((row) => row.type === "unresolved").length, 1);
  assert.deepEqual(result.verification.blockers, result.blockers);
});

test("a bad second worksheet cannot certify an otherwise valid workbook; explicit selection is independent", async () => {
  const buffer = await workbook({ Valid: [["Cantidad", "Equipo"], [0, "Equipo cero"]], Ambiguous: [["Modelo", "Equipo"], [512, "Otro equipo"]] });
  const all = await parseXlsx(buffer);
  assert.equal(all.verification.complete, false);
  assert.ok(all.blockers.some((message) => message.includes("Ambiguous")));
  const selected = await parseXlsx(buffer, { worksheet: "Valid" });
  assert.equal(selected.verification.complete, true);
  assert.equal(selected.items[0].quantity, 0);
  assert.ok(selected.sourceCells.every((cell) => cell.sheet === "Valid"));
});

test("a formula without a cached result is a blocker, never a quantity zero", async () => {
  const result = await parseXlsx(await workbook({ Engineering: [["Cantidad", "Equipo"], [{ formula: "1-1", result: 0 }, "Cero valido"], [{ formula: "3+3" }, "Pendiente"]] }));
  assert.equal(result.verification.complete, false);
  assert.deepEqual(result.items.map((row) => row.quantity), [0]);
  assert.ok(result.blockers.some((message) => message.includes("A3") && message.includes("fórmula")));
  assert.equal(result.sourceCells.find((cell) => cell.address === "A3").rawValue.formula, "3+3");
});

test("subtitles, standalone observations and note-only worksheets remain represented without stock", async () => {
  const buffer = await workbook({ Engineering: [["Cantidad", "Equipo", "Notas"], ["Audio sintetico"], [0, "Equipo A", "nota A"], [null, null, "segunda parte"], ["Video sintetico"], [2, "Equipo B"], ["Nota: conservar sin mojar"]],
    Notes: [["Observaciones"], ["Nota: contenido general"]] }, (book) => { book.getWorksheet("Engineering").getCell("A5").font = { bold: true }; });
  const result = await parseXlsx(buffer);
  assert.equal(result.verification.complete, true, JSON.stringify(result.blockers));
  assert.deepEqual(result.items.map((row) => row.category), ["Audio sintetico", "Video sintetico"]);
  assert.equal(result.items[0].notes, "nota A | segunda parte");
  assert.ok(result.notes.some((row) => row.text === "Nota: conservar sin mojar"));
  assert.ok(result.notes.some((row) => row.text === "Nota: contenido general"));
  assert.equal(new Set(result.sourceCells.map((cell) => cell.ref)).size, result.sourceCells.length);
});

test("separate equipment models, dimensions, punctuation and repeated rows never merge in the reader", async () => {
  const names = ['Equipo 12"', "Equipo 12'", "Fuente AC/DC-12", "Fuente AC-DC/12", "Modelo 32", "Modelo 320", "Repetido", "Repetido"];
  const result = await parseXlsx(await workbook({ Engineering: [["Equipo", "Cantidad"], ...names.map((name, index) => [name, index])] }));
  assert.deepEqual(result.items.map((row) => row.name), names);
  assert.equal(result.items.length, 8);
  assert.equal(result.verification.complete, true);
});

test("PDF inherits columns across pages and retains zero plus original fragments", async () => {
  const result = await parsePdf([{ operations: [...headers(), text(150, 705, "AUDIO"), ...item(0, "Equipo A", 680), text(430, 680, "nota original")] },
    { operations: [...item(3, "Equipo B", 730), ...item(0, "Equipo C", 700)] }]);
  assert.equal(result.verification.complete, true, JSON.stringify(result.blockers));
  assert.deepEqual(result.items.map((row) => [row.quantity, row.category]), [[0, "AUDIO"], [3, "AUDIO"], [0, "AUDIO"]]);
  assert.ok(result.sourceCells.some((cell) => cell.page === 2 && cell.value === "0"));
  assert.equal(result.verification.sourceCellCount, result.verification.representedCellCount);
});

test("PDF missing quantities block certification instead of silently importing the other rows", async () => {
  const result = await parsePdf([{ operations: [...headers(), ...item(0, "Equipo A"), text(150, 650, "Otro equipo sin cantidad"), ...item(2, "Equipo B", 610)] }]);
  assert.equal(result.verification.complete, false);
  assert.ok(result.blockers.some((message) => message.includes("Otro equipo sin cantidad")));
  assert.ok(result.sourceRows.some((row) => row.type === "unresolved"));
});

test("PDF model columns without quantity headings never become guessed stock", async () => {
  await assert.rejects(() => parsePdf([{ operations: [text(50, 720, "Equipo"), text(350, 720, "Modelo"), text(50, 690, "Equipo A"), text(350, 690, "512"), text(50, 660, "Equipo B"), text(350, 660, "64")] }]), /No se identificaron artículos/);
});

test("PDF notes remain notes and an uppercase subtitle is never appended to the previous model", async () => {
  const result = await parsePdf([{ operations: [...headers(), ...item(0, "Equipo A"), text(430, 678, "observacion continuada"), text(150, 665, "VIDEO"), ...item(1, "Equipo B", 640), text(150, 610, "Nota: conservar")] }]);
  assert.equal(result.verification.complete, true, JSON.stringify(result.blockers));
  assert.deepEqual(result.items.map((row) => row.name), ["Equipo A", "Equipo B"]);
  assert.equal(result.items[1].category, "VIDEO");
  assert.equal(result.items[0].notes, "observacion continuada");
  assert.ok(result.notes.some((row) => row.text === "Nota: conservar"));
});

for (const [name, pages] of [
  ["scanned second page", [{ operations: [...headers(), ...item(0, "Equipo A")] }, { images: [{ x: 0, y: 0, width: 600, height: 800 }] }]],
  ["small raster table below its header", [{ operations: [...headers(), ...item(0, "Equipo A")], images: [{ x: 45, y: 480, width: 350, height: 80 }] }]],
  ["raster table split into tiles", [{ operations: [...headers(), ...item(0, "Equipo A")], images: [{ x: 45, y: 480, width: 80, height: 80 }, { x: 135, y: 480, width: 260, height: 80 }] }]],
  ["drawn second page without selectable text", [{ operations: [...headers(), ...item(0, "Equipo A")] }, { operations: ["45 480 350 80 re S", "60 493 3 14 re f"] }]],
  ["headerless raster table next to aligned digital stock", [{ operations: [...item(0, "Equipo A", 720), ...item(2, "Equipo B", 690)], images: [{ x: 45, y: 480, width: 350, height: 80 }] }]]
]) test(`PDF rejects the whole import for ${name}`, async () => {
  await assert.rejects(() => parsePdf(pages), (error) => error.code === "WAREHOUSE_IMPORT_INVALID" && /imagen|escanead|gráfico|seleccionable/i.test(error.message));
});

test("small logos outside the table and a genuinely blank page do not block valid digital stock", async () => {
  const result = await parsePdf([{ operations: [...headers(), ...item(0, "Equipo A")], images: [{ x: 480, y: 735, width: 40, height: 40 }, { x: 40, y: 100, width: 40, height: 40 }] }, {}]);
  assert.equal(result.verification.complete, true, JSON.stringify(result.blockers));
  assert.equal(result.items[0].quantity, 0);
  assert.ok(result.warnings.some((message) => message.includes("Página 2") && message.includes("vacía")));
});
