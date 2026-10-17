const test = require("node:test");
const assert = require("node:assert/strict");
const { deflateSync } = require("node:zlib");
const { parseServiceFile } = require("../equipment-service-import.cjs");

// All PDF bytes are synthetic. No document, catalog, or historical fixture is read.
const literal = (value) => String(value).replace(/[\\()]/g, "\\$&");
const text = (x, y, value) => `BT /F1 12 Tf ${x} ${y} Td (${literal(value)}) Tj ET`;
const headers = (y = 720) => [text(50, y, "Cantidad"), text(150, y, "Descripcion")];
const item = (count, name, y = 690) => [text(50, y, count), text(150, y, name)];

function stream(dict, bytes) {
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes, "ascii");
  return Buffer.concat([Buffer.from(`<< ${dict} /Length ${body.length} >>\nstream\n`), body, Buffer.from("\nendstream")]);
}

function syntheticPdf(pages) {
  const objects = [null, "<< /Type /Catalog /Pages 2 0 R >>", null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  const pageIds = [];
  for (const page of pages) {
    const pageId = objects.length;
    pageIds.push(pageId);
    objects.push(null);
    const contentId = objects.length;
    objects.push(null);
    const imageNames = [];
    const operations = [...(page.operations || [])];
    for (const [index, image] of (page.images || []).entries()) {
      const objectId = objects.length;
      const name = `Im${index + 1}`;
      imageNames.push(`/${name} ${objectId} 0 R`);
      objects.push(stream(`/Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, deflateSync(image.pixels)));
      operations.push(`q ${image.displayWidth} 0 0 ${image.displayHeight} ${image.x} ${image.y} cm /${name} Do Q`);
    }
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> /XObject << ${imageNames.join(" ")} >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = stream("", operations.join("\n"));
  }
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const chunks = [Buffer.from("%PDF-1.4\n%synthetic-reader-fixture\n")];
  const offsets = [0];
  let size = chunks[0].length;
  for (let id = 1; id < objects.length; id += 1) {
    const entry = Buffer.concat([Buffer.from(`${id} 0 obj\n`), Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id]), Buffer.from("\nendobj\n")]);
    offsets[id] = size;
    chunks.push(entry);
    size += entry.length;
  }
  chunks.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
}

const glyphs = {
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};
function rasterTable({ x = 45, y = 480, displayWidth = 350, displayHeight = 80 } = {}) {
  const width = 350;
  const height = 80;
  const pixels = Buffer.alloc(width * height, 255);
  function label(value, left, top) {
    for (const [index, character] of [...value].entries()) {
      for (const [row, bits] of (glyphs[character] || []).entries()) {
        for (const [column, bit] of [...bits].entries()) {
          if (bit !== "1") continue;
          for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) pixels[(top + row * 2 + dy) * width + left + index * 12 + column * 2 + dx] = 0;
        }
      }
    }
  }
  label("QTY", 10, 8);
  label("ITEM", 100, 8);
  label("7", 10, 45);
  label("ITEM B", 100, 45);
  for (let row = 0; row < height; row += 1) pixels[row * width] = pixels[row * width + width - 1] = pixels[row * width + 80] = 0;
  for (const row of [0, 32, height - 1]) for (let column = 0; column < width; column += 1) pixels[row * width + column] = 0;
  return { width, height, pixels, x, y, displayWidth, displayHeight };
}

function cropRaster(source, left, width) {
  const pixels = Buffer.alloc(width * source.height);
  for (let row = 0; row < source.height; row += 1) source.pixels.copy(pixels, row * width, row * source.width + left, row * source.width + left + width);
  return { ...source, pixels, width, x: source.x + left, displayWidth: width };
}

const parse = (pages) => parseServiceFile(syntheticPdf(pages), { fileName: "solo-fixture-sintetico.pdf", mimeType: "application/pdf" });
const itemRows = (preview) => preview.services.flatMap((service) => service.mainSections.flatMap((section) => section.rows.filter((row) => row.type === "item")));

test("PDF digital conserva cero, fragmentos originales, notas y referencias", async () => {
  const preview = await parse([{ operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A"), text(150, 660, "Nota: conservar este cable")] }]);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.deepEqual(itemRows(preview).map((row) => [row.quantity, row.description]), [[0, "Equipo A"]]);
  assert.equal(preview.services[0].name, "Sintetico A");
  assert.equal(preview.verification.sourceCellCount, preview.sourceCells.length);
  assert.equal(preview.verification.representedCellCount, preview.sourceCells.length);
  assert.ok(preview.sourceCells.some((cell) => cell.value === "0"));
  assert.ok(preview.sourceCells.some((cell) => cell.value === "Nota: conservar este cable"));
  assert.deepEqual(new Set(preview.sourceCells.map((cell) => cell.page)), new Set([1]));
});

test("PDF de varias paginas conserva cabeceras repetidas y todos los equipos", async () => {
  const preview = await parse([
    { operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")] },
    { operations: [...headers(), ...item(3, "Equipo B")] },
  ]);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.deepEqual(itemRows(preview).map((row) => [row.quantity, row.description]), [[0, "Equipo A"], [3, "Equipo B"]]);
  assert.deepEqual(new Set(preview.sourceCells.map((cell) => cell.page)), new Set([1, 2]));
  assert.equal(preview.verification.missingRefs.length, 0);
});

test("PDF con cuadros separados por directiva conserva ambos servicios", async () => {
  const preview = await parse([
    { operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")] },
    { operations: [text(150, 760, "Servicio: Sintetico B"), ...headers(), ...item(7, "Equipo B")] },
  ]);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.deepEqual(preview.services.map((service) => service.name), ["Sintetico A", "Sintetico B"]);
  assert.deepEqual(itemRows(preview).map((row) => [row.quantity, row.description]), [[0, "Equipo A"], [7, "Equipo B"]]);
});

test("PDF totalmente escaneado rechaza texto no seleccionable", async () => {
  await assert.rejects(() => parse([{ images: [rasterTable({ x: 0, y: 0, displayWidth: 600, displayHeight: 800 })] }]), /no contiene texto seleccionable|escaneado/i);
});

test("PDF con tabla digital y pagina escaneada no certifica la omision", async () => {
  const preview = await parse([
    { operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")] },
    { images: [rasterTable({ x: 0, y: 0, displayWidth: 600, displayHeight: 800 })] },
  ]);
  assert.equal(preview.verification.complete, false);
  assert.ok(preview.verification.blockers.some((message) => /imagen|escanead|seleccionable/i.test(message)));
});

test("PDF acepta logo pequeno sobre la tabla sin perder el cero", async () => {
  const preview = await parse([{ operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")], images: [rasterTable({ x: 480, y: 735, displayWidth: 50, displayHeight: 40 })] }]);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.deepEqual(itemRows(preview).map((row) => [row.quantity, row.description]), [[0, "Equipo A"]]);
});

test("PDF acepta logo pequeno bajo la tabla fuera de ambas columnas", async () => {
  const preview = await parse([{ operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")], images: [rasterTable({ x: 40, y: 100, displayWidth: 40, displayHeight: 40 })] }]);
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.deepEqual(itemRows(preview).map((row) => [row.quantity, row.description]), [[0, "Equipo A"]]);
});

test("PDF no certifica cuadro raster pequeno bajo la cabecera como si no existiera", async () => {
  const preview = await parse([{ operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")], images: [rasterTable()] }]);
  assert.equal(preview.verification.complete, false, "La fila raster 7 ITEM B no tiene referencias de texto y debe detener la certificacion.");
  assert.ok(preview.verification.blockers.some((message) => /imagen|escanead|seleccionable/i.test(message)));
});

test("PDF no certifica un cuadro raster dividido en mosaicos pequenos", async () => {
  const image = rasterTable();
  const preview = await parse([{ operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")], images: [cropRaster(image, 0, 80), cropRaster(image, 90, 260)] }]);
  assert.equal(preview.verification.complete, false, "Los mosaicos juntos contienen cantidad y descripcion raster sin referencias verificables.");
  assert.ok(preview.verification.blockers.some((message) => /imagen|escanead|seleccionable/i.test(message)));
});

test("PDF no certifica una pagina con cuadro vectorial sin texto seleccionable", async () => {
  const preview = await parse([
    { operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")] },
    { operations: ["45 480 350 80 re S", "125 480 m 125 560 l S", "45 520 m 395 520 l S", "60 493 3 14 re f", "60 507 10 3 re f", "67 500 3 7 re f", "145 493 3 17 re f", "148 493 9 3 re f", "148 500 9 3 re f", "148 507 9 3 re f", "157 496 3 4 re f", "157 503 3 4 re f"] },
  ]);
  assert.equal(preview.verification.complete, false, "La pagina vectorial tiene contenido dibujado no verificable, aunque otra pagina si tenga texto.");
  assert.ok(preview.verification.blockers.some((message) => /pagina|página|vector|seleccionable|texto/i.test(message)));
});

test("PDF conserva el contexto de la tabla heredada antes de una nueva cabecera en la siguiente pagina", async () => {
  const preview = await parse([
    { operations: [text(50, 760, "Servicio: Sintetico A"), ...headers(), ...item(0, "Equipo A")] },
    { operations: [text(50, 760, "Nota: continuacion"), ...headers(500), ...item(3, "Equipo C", 470)],
      images: [rasterTable({ y: 600 })] },
  ]);
  assert.equal(preview.verification.complete, false, "Una cabecera posterior no debe ocultar una tabla raster que continua la pagina anterior.");
  assert.deepEqual(itemRows(preview).map(row => [row.quantity, row.description]), [[0, "Equipo A"], [3, "Equipo C"]]);
  assert.ok(preview.verification.blockers.some(message => /imagen|seleccionable/i.test(message)));
});
