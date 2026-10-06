const ExcelJS = require("exceljs");
const unzipper = require("unzipper");

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_WORKBOOK_BYTES = 100 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_PDF_PAGES = 100;
const MAX_PAGE_TEXT_ITEMS = 10000;
const HEADER_ALIASES = {
  name: new Set(["descripcion", "descripcion del equipo", "descripcion de equipo", "equipo", "nombre", "nombre del equipo", "articulo", "producto", "material", "item", "description", "name", "equipment"]),
  quantity: new Set(["cantidad", "cant", "qty", "quantity", "existencia", "existencias", "stock", "unidades", "cantidad disponible", "disponible"]),
  category: new Set(["categoria", "category", "grupo", "rubro", "clasificacion"]),
  notes: new Set(["observaciones", "observacion", "notas", "nota", "notes", "comments", "comentarios", "comentario"])
};

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeHeader(value) {
  return text(value).normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[.:]+$/g, "").trim();
}

function headerField(value) {
  const normalized = normalizeHeader(value);
  return Object.keys(HEADER_ALIASES).find((field) => HEADER_ALIASES[field].has(normalized));
}

function quantity(value) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
  const raw = text(value).replace(/\s*(?:unidades?|uds?\.?|piezas?)$/i, "").trim();
  if (/^\d+$/.test(raw)) {
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (/^\d+[.,]0+$/.test(raw) && !/^[1-9]\d{0,2}[.,]000$/.test(raw)) {
    const parsed = Number(raw.replace(",", "."));
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  if (/^\d{1,3}(?:[ ,]\d{3})+$/.test(raw)) {
    const parsed = Number(raw.replace(/[ ,]/g, ""));
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function invalid(message) {
  const error = new Error(message);
  error.code = "WAREHOUSE_IMPORT_INVALID";
  error.statusCode = 400;
  return error;
}

function cellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return value;
  if (Array.isArray(value.richText)) return value.richText.map((entry) => entry.text).join("");
  // cell.value filters falsy cached formula results; cell.result preserves 0.
  if ("formula" in value || "sharedFormula" in value) return cell.result ?? "";
  if ("text" in value) return value.text;
  return cell.text || "";
}

function findHeader(cells, location) {
  const columns = {};
  const duplicates = [];
  for (const cell of cells) {
    const field = headerField(cell.value);
    if (!field) continue;
    if (columns[field] !== undefined && ["name", "quantity"].includes(field)) duplicates.push(field);
    else if (columns[field] === undefined) columns[field] = cell.key;
  }
  if (columns.name === undefined || columns.quantity === undefined) return null;
  if (duplicates.length) throw invalid(`${location}: hay varias columnas de descripción o cantidad. Identifique una sola columna de cada tipo antes de importar.`);
  return columns;
}

function rowSummary(cells) {
  return cells.map((cell) => text(cell.value)).filter(Boolean).join(" | ");
}

function readMappedRow(cells, columns, category, sourceRow, sourceLocation, warnings) {
  const values = new Map(cells.map((cell) => [cell.key, cell.value]));
  const name = text(values.get(columns.name));
  const rawQuantity = values.get(columns.quantity);
  const parsedQuantity = quantity(rawQuantity);
  if (!name || parsedQuantity === null) {
    warnings.push(`${sourceLocation}: fila sin descripción o con cantidad vacía, ambigua o inválida; revise «${rowSummary(cells)}».`);
    return null;
  }
  const notes = [];
  if (columns.notes !== undefined && text(values.get(columns.notes))) notes.push(text(values.get(columns.notes)));
  const mappedColumns = new Set(Object.values(columns));
  for (const cell of cells) {
    if (!mappedColumns.has(cell.key) && text(cell.value)) notes.push(text(cell.value));
  }
  return {
    name,
    category: text(values.get(columns.category)) || category || "Sin categoría",
    quantity: parsedQuantity,
    notes: notes.join(" | "),
    sourceRow,
    sourceLocation
  };
}

function categoryHeading(cells, columns) {
  const nonempty = cells.filter((cell) => text(cell.value));
  if (nonempty.length !== 1 || quantity(nonempty[0].value) !== null) return "";
  if (columns && nonempty[0].key === columns.notes) return "";
  const value = text(nonempty[0].value);
  if (/^(?:nota|observacion|observaciones|comentario)\s*:/i.test(normalizeHeader(value))) return "";
  return value.length <= 160 ? value : "";
}

async function parseWorkbook(buffer, fileName) {
  const workbook = new ExcelJS.Workbook();
  try {
    // Read ZIP metadata before ExcelJS expands XML, then enforce the actual
    // decompressed size while streaming so forged ZIP sizes cannot bypass it.
    const archive = await unzipper.Open.buffer(buffer);
    if (archive.files.length > 2000 || archive.files.reduce((sum, file) => sum + file.uncompressedSize, 0) > MAX_WORKBOOK_BYTES) {
      throw invalid("El libro Excel contiene demasiados datos comprimidos. Divídalo en archivos más pequeños antes de importar.");
    }
    let expandedBytes = 0;
    for (const entry of archive.files) {
      await new Promise((resolve, reject) => {
        const stream = entry.stream();
        stream.on("data", (chunk) => {
          expandedBytes += chunk.length;
          if (expandedBytes > MAX_WORKBOOK_BYTES) stream.destroy(invalid("El libro Excel contiene demasiados datos comprimidos. Divídalo en archivos más pequeños antes de importar."));
        });
        stream.once("error", reject);
        stream.once("end", resolve);
      });
    }
    await workbook.xlsx.load(buffer);
  } catch (error) {
    if (error.code === "WAREHOUSE_IMPORT_INVALID") throw error;
    throw invalid("No se pudo leer el archivo Excel. Use un libro .xlsx válido, sin contraseña.");
  }
  const items = [];
  const warnings = [];
  let rowCount = 0;
  for (const sheet of workbook.worksheets) {
    let columns = null;
    let category = "Sin categoría";
    let sheetItems = 0;
    let hasContent = false;
    let plainHeadingAllowed = true;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      rowCount += 1;
      if (rowCount > MAX_ROWS) throw invalid("El Excel supera el límite de 10,000 filas. Divídalo en archivos más pequeños antes de importar.");
      const sourceLocation = `Hoja «${sheet.name}», fila ${rowNumber}`;
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const value = cellValue(cell);
        if (text(value)) cells.push({ key: columnNumber, value, isHeading: cell.isMerged || cell.font?.bold === true });
        if ((cell.value?.formula || cell.value?.sharedFormula) && cell.result === undefined) {
          warnings.push(`${sourceLocation}, celda ${cell.address}: la fórmula no tiene un resultado guardado; calcule y guarde el libro en Excel antes de importar.`);
        }
      });
      if (!cells.length) return;
      hasContent = true;
      const header = findHeader(cells, sourceLocation);
      if (header) { columns = header; plainHeadingAllowed = true; return; }
      const single = cells.length === 1 ? cells[0] : null;
      const formattedHeading = single && (single.isHeading || /^[A-ZÁÉÍÓÚÑ\s/-]+$/.test(text(single.value)));
      const heading = (plainHeadingAllowed || formattedHeading) ? categoryHeading(cells, columns) : "";
      if (heading) {
        category = heading;
        warnings.push(`${sourceLocation}: se conservó «${heading}» como encabezado de categoría, sin asignarle una cantidad.`);
        return;
      }
      if (!columns) {
        warnings.push(`${sourceLocation}: fila sin encabezados reconocibles de descripción y cantidad; revise «${rowSummary(cells)}».`);
        return;
      }
      const item = readMappedRow(cells, columns, category, rowNumber, sourceLocation, warnings);
      if (item) { items.push(item); sheetItems += 1; plainHeadingAllowed = false; }
    });
    if (hasContent && !sheetItems) warnings.push(`Hoja «${sheet.name}»: no se identificaron artículos con una descripción y cantidad válidas.`);
  }
  if (!items.length) throw invalid(`No se encontraron artículos en el Excel. Incluya encabezados «Descripción» o «Equipo» y «Cantidad», con cantidades numéricas explícitas.${warnings.length ? ` ${warnings.slice(0, 3).join(" ")}` : ""}`);
  return { items, warnings, source: fileName };
}

function positionedLines(textItems) {
  const rows = [];
  const sorted = textItems.filter((item) => text(item.str)).map((item) => ({
    value: text(item.str), x: item.transform[4], y: item.transform[5],
    width: item.width || 0, height: Math.abs(item.height || item.transform[3] || 10)
  })).sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of sorted) {
    let row = rows.at(-1);
    if (row && Math.abs(row.y - item.y) > Math.max(2, Math.min(4, item.height * 0.25))) row = null;
    if (!row) { row = { y: item.y, pieces: [] }; rows.push(row); }
    row.pieces.push(item);
  }
  return rows.sort((a, b) => b.y - a.y).map((row) => {
    const cells = [];
    for (const piece of row.pieces.sort((a, b) => a.x - b.x)) {
      const previous = cells.at(-1);
      const gap = previous ? piece.x - previous.endX : Infinity;
      if (previous && gap < Math.max(10, piece.height)) {
        previous.value = text(`${previous.value} ${piece.value}`);
        previous.endX = Math.max(previous.endX, piece.x + piece.width);
      } else cells.push({ key: piece.x, value: piece.value, x: piece.x, endX: piece.x + piece.width });
    }
    return { y: row.y, height: Math.max(...row.pieces.map((piece) => piece.height)), cells };
  });
}

function mapPdfCells(cells, columns) {
  const anchors = Object.values(columns).sort((a, b) => a - b);
  const mapped = new Map();
  for (const cell of cells) {
    let key = anchors[0];
    for (const anchor of anchors) {
      if (cell.x >= anchor - 14) key = anchor;
    }
    mapped.set(key, text(`${mapped.get(key) || ""} ${cell.value}`));
  }
  return [...mapped.entries()].map(([key, value]) => ({ key, value }));
}

function headerlessPdfCandidate(cells) {
  if (cells.length < 2) return null;
  const candidates = cells.filter((cell) => quantity(cell.value) !== null);
  if (candidates.length !== 1) return null;
  const count = candidates[0];
  const edge = count === cells[0] ? "first" : count === cells.at(-1) ? "last" : "";
  if (!edge) return null;
  const neighbor = edge === "first" ? cells[1] : cells.at(-2);
  const gap = edge === "first" ? neighbor.x - count.endX : count.x - neighbor.endX;
  if (gap < 18) return null;
  const remaining = cells.filter((cell) => cell !== count);
  if (!remaining.some((cell) => /\p{Letter}/u.test(cell.value))) return null;
  return { count, name: remaining.map((cell) => cell.value).join(" "), edge };
}

async function parsePdf(buffer, fileName) {
  let task;
  try {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: true });
    const document = await task.promise;
    if (document.numPages > MAX_PDF_PAGES) throw invalid("El PDF supera el límite de 100 páginas. Divídalo en archivos más pequeños antes de importar.");
    const pages = [];
    const warnings = [];
    let hasText = false;
    let rowCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      if (content.items.length > MAX_PAGE_TEXT_ITEMS) throw invalid(`La página ${pageNumber} contiene demasiado texto para importar. Divida el PDF en archivos más pequeños.`);
      const lines = positionedLines(content.items);
      rowCount += lines.length;
      if (rowCount > MAX_ROWS) throw invalid("El PDF supera el límite de 10,000 filas. Divídalo en archivos más pequeños antes de importar.");
      if (lines.length) hasText = true;
      else warnings.push(`Página ${pageNumber}: no contiene texto seleccionable; no se extrajeron artículos de esa página.`);
      pages.push({ pageNumber, lines });
      page.cleanup();
    }
    if (!hasText) throw invalid("El PDF no contiene texto seleccionable. Parece escaneado o compuesto por imágenes; use un PDF digital o el archivo Excel original.");
    const items = [];
    let columns = null;
    let category = "Sin categoría";
    let plainHeadingAllowed = true;
    const candidates = pages.flatMap(({ lines }) => lines.map((line) => headerlessPdfCandidate(line.cells)).filter(Boolean));
    const reference = candidates[0];
    const headerlessAligned = reference && candidates.filter((candidate) => candidate.edge === reference.edge && Math.abs(candidate.count.x - reference.count.x) < 18).length >= 2;
    let warnedHeaderless = false;
    for (const { pageNumber, lines } of pages) {
      let previousItem = null;
      for (const [lineIndex, line] of lines.entries()) {
        const sourceLocation = `Página ${pageNumber}, fila ${lineIndex + 1}`;
        const header = findHeader(line.cells, sourceLocation);
        if (header) { columns = header; plainHeadingAllowed = true; previousItem = null; continue; }
        if (/^\s*(?:pagina|page)\s+\d+(?:\s+(?:de|of)\s+\d+)?\s*$/i.test(normalizeHeader(rowSummary(line.cells)))) continue;
        const mapped = columns ? mapPdfCells(line.cells, columns) : line.cells;
        const values = new Map(mapped.map((cell) => [cell.key, text(cell.value)]));
        const nearbyContinuation = columns && previousItem && previousItem.y - line.y > 0 && previousItem.y - line.y <= Math.max(line.height, previousItem.height) * 1.7;
        if (nearbyContinuation && !values.get(columns.quantity) && !values.get(columns.category)) {
          const extraName = values.get(columns.name);
          const extraNotes = values.get(columns.notes);
          if (extraName || extraNotes) {
            if (extraName) previousItem.item.name = text(`${previousItem.item.name} ${extraName}`);
            if (extraNotes) previousItem.item.notes = text(`${previousItem.item.notes} ${extraNotes}`);
            previousItem.y = line.y;
            previousItem.height = line.height;
            continue;
          }
        }
        const uppercaseHeading = mapped.length === 1 && /^[A-ZÁÉÍÓÚÑ\s/-]+$/.test(text(mapped[0].value));
        const heading = (plainHeadingAllowed || uppercaseHeading) ? categoryHeading(mapped, columns) : "";
        if (heading) {
          category = heading;
          warnings.push(`${sourceLocation}: se conservó «${heading}» como encabezado de categoría, sin asignarle una cantidad.`);
          previousItem = null;
          continue;
        }
        if (columns) {
          const item = readMappedRow(mapped, columns, category, lineIndex + 1, sourceLocation, warnings);
          if (item) {
            items.push(item);
            plainHeadingAllowed = false;
            previousItem = { item, y: line.y, height: line.height };
          } else previousItem = null;
        } else {
          const candidate = headerlessPdfCandidate(line.cells);
          if (headerlessAligned && candidate && candidate.edge === reference.edge && Math.abs(candidate.count.x - reference.count.x) < 18) {
            if (!warnedHeaderless) {
              warnings.push("El PDF no tiene encabezados reconocibles. Se interpretó como cantidad la columna numérica alineada; revise que no sea un número de orden antes de importar.");
              warnedHeaderless = true;
            }
            items.push({ name: candidate.name, quantity: quantity(candidate.count.value), category, notes: "", sourceRow: lineIndex + 1, sourceLocation });
            plainHeadingAllowed = false;
          } else warnings.push(`${sourceLocation}: no se pudo identificar una cantidad explícita; revise «${rowSummary(line.cells)}».`);
        }
      }
    }
    if (!items.length) throw invalid(`No se identificaron artículos con cantidades en el PDF. Use una tabla digital con encabezados «Descripción» o «Equipo» y «Cantidad».${warnings.length ? ` ${warnings.slice(0, 3).join(" ")}` : ""}`);
    return { items, warnings, source: fileName };
  } catch (error) {
    if (error.code === "WAREHOUSE_IMPORT_INVALID") throw error;
    if (error.name === "PasswordException") throw invalid("El PDF está protegido con contraseña. Use una copia sin contraseña para importar.");
    throw invalid("No se pudo leer el PDF. Use un PDF digital válido, sin contraseña.");
  } finally {
    if (task) await task.destroy().catch(() => {});
  }
}

async function parseInventoryFile(buffer, { fileName = "inventario", mimeType = "" } = {}) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) throw invalid("No se recibió un archivo válido para importar.");
  if (!buffer.length) throw invalid("El archivo está vacío.");
  if (buffer.length > MAX_FILE_BYTES) throw invalid("El archivo supera el límite de 15 MB para importar inventario.");
  const source = text(fileName) || "inventario";
  const isExcel = /\.xlsx$/i.test(source) || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isPdf = /\.pdf$/i.test(source) || mimeType === "application/pdf";
  if (isExcel && !isPdf) return parseWorkbook(buffer, source);
  if (isPdf && !isExcel) return parsePdf(buffer, source);
  throw invalid("Seleccione un archivo Excel .xlsx o un PDF digital. Los archivos .xls deben guardarse como .xlsx antes de importar.");
}

module.exports = { parseInventoryFile };
