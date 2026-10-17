const ExcelJS = require("exceljs");
const unzipper = require("unzipper");
const { normalizeXlsxNamespaces } = require("./warehouse-xlsx-normalize.cjs");

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_WORKBOOK_BYTES = 100 * 1024 * 1024;
const MAX_ROWS = 10000;
const MAX_CELLS = 100000;
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
  if (value instanceof Date) return cell.text || value.toISOString();
  if (Array.isArray(value.richText)) return value.richText.map((entry) => entry.text).join("");
  // cell.value filters falsy cached formula results; cell.result preserves 0.
  if ("formula" in value || "sharedFormula" in value) return cell.result ?? "";
  if ("text" in value) return value.text;
  return cell.text || "";
}

function sourceLedger() {
  return { sourceCells: [], sourceRows: [], notes: [], blockers: [] };
}

function preserveRow(ledger, cells, details) {
  if (ledger.sourceCells.length + cells.length > MAX_CELLS) throw invalid("El archivo supera el límite de 100,000 celdas o fragmentos de texto con información.");
  const row = { ...details, sourceOrder: ledger.sourceRows.length, cells };
  ledger.sourceCells.push(...cells);
  ledger.sourceRows.push(row);
  if (row.type === "note") ledger.notes.push({ text: row.description, category: row.category, sourceLocation: row.sourceLocation });
  return row;
}

function completeResult(items, warnings, source, ledger, extra = {}) {
  const blockers = [...new Set(ledger.blockers)];
  return { items, warnings: [...new Set(warnings)], source, ...extra,
    sourceCells: ledger.sourceCells, sourceRows: ledger.sourceRows, notes: ledger.notes, blockers,
    verification: { algorithm: "inventory-source-rows-v1", complete: items.length > 0 && blockers.length === 0,
      sourceCellCount: ledger.sourceCells.length, representedCellCount: ledger.sourceRows.reduce((sum, row) => sum + row.cells.length, 0),
      unresolvedRowCount: ledger.sourceRows.filter((row) => row.type === "unresolved").length, blockers }
  };
}

function standaloneNote(cells, columns) {
  if (columns && quantity(cells.find((cell) => cell.key === columns.quantity)?.value) !== null) return false;
  if (columns?.notes !== undefined && cells.every((cell) => cell.key === columns.notes)) return true;
  return cells.some((cell) => /^(?:nota|notas|observacion|observaciones|comentario|comentarios)\s*:/i.test(normalizeHeader(cell.value)));
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

function headerlessWorkbookColumns(cells) {
  if (cells.length < 2 || quantity(cells[0].value) === null) return null;
  if (quantity(cells[1].value) !== null || !/\p{Letter}/u.test(text(cells[1].value))) return null;
  // A second isolated number might be an ordinal, model, price or another table.
  if (cells.slice(2).some((cell) => quantity(cell.value) !== null)) return null;
  return { quantity: cells[0].key, name: cells[1].key };
}

function incompleteWorkbookHeader(cells) {
  if (cells.length < 2 || cells.some((cell) => quantity(cell.value) !== null)) return false;
  return cells.some((cell) => ["name", "quantity"].includes(headerField(cell.value)));
}

async function parseWorkbook(buffer, fileName, worksheet = "") {
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
    await workbook.xlsx.load(await normalizeXlsxNamespaces(buffer, { maxExpandedBytes: MAX_WORKBOOK_BYTES, maxEntries: 2000 }));
  } catch (error) {
    if (error.code === "WAREHOUSE_IMPORT_INVALID") throw error;
    throw invalid("No se pudo leer el archivo Excel. Use un libro .xlsx válido, sin contraseña.");
  }
  const items = [];
  const warnings = [];
  const ledger = sourceLedger();
  const worksheets = workbook.worksheets.map((sheet) => sheet.name);
  if (worksheet && !worksheets.includes(worksheet)) throw invalid("La hoja seleccionada no existe en este Excel. Vuelva a elegir una hoja del archivo.");
  let rowCount = 0;
  for (const sheet of workbook.worksheets) {
    if (worksheet && sheet.name !== worksheet) continue;
    let columns = null;
    let inferredColumns = null;
    let inferenceBlocked = false;
    let category = "Sin categoría";
    let sheetItems = 0;
    let hasContent = false;
    let plainHeadingAllowed = true;
    let noteRegion = false;
    let previousItem = null;
    const firstSourceRow = ledger.sourceRows.length;
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      rowCount += 1;
      if (rowCount > MAX_ROWS) throw invalid("El Excel supera el límite de 10,000 filas. Divídalo en archivos más pequeños antes de importar.");
      const sourceLocation = `Hoja «${sheet.name}», fila ${rowNumber}`;
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const value = cellValue(cell);
        const formula = cell.value?.formula || cell.value?.sharedFormula;
        if (text(value) || formula) {
          const rawValue = JSON.parse(JSON.stringify(cell.value));
          if (rawValue && typeof rawValue === "object" && formula && cell.result !== undefined) rawValue.result = cell.result;
          cells.push({ key: columnNumber, value, ref: `xlsx:${sheet.id}:${cell.address}`, sheet: sheet.name,
            address: cell.address, row: rowNumber, column: columnNumber, rawValue,
            isHeading: cell.isMerged || cell.font?.bold === true });
        }
        if ((cell.value?.formula || cell.value?.sharedFormula) && cell.result === undefined) {
          const issue = `${sourceLocation}, celda ${cell.address}: la fórmula no tiene un resultado guardado; calcule y guarde el libro en Excel antes de importar.`;
          warnings.push(issue);
          ledger.blockers.push(issue);
        }
      });
      if (!cells.length) return;
      hasContent = true;
      const keep = (type, description = rowSummary(cells), count = null, rowCategory = category) => preserveRow(ledger, cells, {
        type, description, quantity: count, category: rowCategory, sourceRow: rowNumber, sourceLocation
      });
      const header = cells.some((cell) => quantity(cell.value) !== null) ? null : findHeader(cells, sourceLocation);
      if (header) {
        columns = header; inferredColumns = null; inferenceBlocked = false; plainHeadingAllowed = true;
        noteRegion = false; previousItem = null; keep("header"); return;
      }
      const activeColumns = columns || inferredColumns;
      const noteLabel = cells.length === 1 && headerField(cells[0].value) === "notes";
      if (standaloneNote(cells, activeColumns) || noteLabel || (noteRegion && cells.length === 1)) {
        noteRegion = noteRegion || noteLabel;
        keep("note");
        // A dedicated notes column immediately below an item is a wrapped
        // observation for that item; global notes remain in the source ledger.
        if (previousItem && activeColumns?.notes !== undefined && cells.every((cell) => cell.key === activeColumns.notes)
          && rowNumber === previousItem.rowNumber + 1) {
          previousItem.item.notes = [previousItem.item.notes, rowSummary(cells)].filter(Boolean).join(" | ");
          previousItem.rowNumber = rowNumber;
        }
        warnings.push(`${sourceLocation}: se conservó como observación «${rowSummary(cells)}».`);
        return;
      }
      if (!columns && incompleteWorkbookHeader(cells)) {
        inferenceBlocked = true;
        const issue = `${sourceLocation}: encabezados incompletos; indique «Cantidad» y «Descripción» o «Equipo». No se interpretan columnas de modelo, código o número de orden como cantidades; revise «${rowSummary(cells)}».`;
        warnings.push(issue); ledger.blockers.push(issue); keep("unresolved");
        return;
      }
      const single = cells.length === 1 ? cells[0] : null;
      const formattedHeading = single && (single.isHeading || /^[A-ZÁÉÍÓÚÑ\s/-]+$/.test(text(single.value)));
      const declaredCategory = cells.length === 1 && columns?.category !== undefined && cells[0].key === columns.category;
      const heading = (plainHeadingAllowed || formattedHeading || declaredCategory) ? categoryHeading(cells, columns) : "";
      if (heading) {
        category = heading;
        inferredColumns = null;
        previousItem = null; noteRegion = false;
        keep("category", heading);
        warnings.push(`${sourceLocation}: se conservó «${heading}» como encabezado de categoría, sin asignarle una cantidad.`);
        return;
      }
      if (!columns) {
        const candidate = inferenceBlocked ? null : headerlessWorkbookColumns(cells);
        if (candidate && (!inferredColumns || (candidate.quantity === inferredColumns.quantity && candidate.name === inferredColumns.name))) {
          if (!inferredColumns) warnings.push(`${sourceLocation}: el cuadro no tiene encabezados. Se interpretó la primera columna ocupada como cantidad y la siguiente como descripción; revise que la cantidad no sea un número de orden antes de importar.`);
          inferredColumns = candidate;
          const item = readMappedRow(cells, inferredColumns, category, rowNumber, sourceLocation, warnings);
          if (item) {
            items.push(item); sheetItems += 1; plainHeadingAllowed = false; noteRegion = false;
            previousItem = { item, rowNumber }; keep("item", item.name, item.quantity, item.category);
          }
          return;
        }
        const issue = `${sourceLocation}: no se identificó una cantidad y descripción inequívocas. Use encabezados «Cantidad» y «Descripción», o un cuadro con la cantidad en la primera columna y el equipo en la siguiente, sin otras columnas numéricas; revise «${rowSummary(cells)}».`;
        warnings.push(issue); ledger.blockers.push(issue); keep("unresolved"); previousItem = null;
        return;
      }
      const item = readMappedRow(cells, columns, category, rowNumber, sourceLocation, warnings);
      if (item) {
        items.push(item); sheetItems += 1; plainHeadingAllowed = false; noteRegion = false;
        previousItem = { item, rowNumber }; keep("item", item.name, item.quantity, item.category);
      } else { ledger.blockers.push(warnings.at(-1)); keep("unresolved"); previousItem = null; }
    });
    if (hasContent && !sheetItems) {
      const sheetRows = ledger.sourceRows.slice(firstSourceRow);
      const noteOnly = sheetRows.length > 0 && sheetRows.every((row) => row.type === "note");
      const issue = noteOnly ? `Hoja «${sheet.name}»: se conservaron sus observaciones sin asignarles cantidades.`
        : `Hoja «${sheet.name}»: no se identificaron artículos con una descripción y cantidad válidas; seleccione una hoja válida o corrija el archivo completo.`;
      warnings.push(issue);
      if (!noteOnly) ledger.blockers.push(issue);
    }
  }
  if (!items.length) throw invalid(`No se encontraron artículos en el Excel. Incluya encabezados «Descripción» o «Equipo» y «Cantidad», o coloque la cantidad en la primera columna y el equipo en la siguiente. Use cantidades numéricas explícitas.${warnings.length ? ` ${warnings.slice(0, 3).join(" ")}` : ""}`);
  return completeResult(items, warnings, fileName, ledger, { worksheets, worksheet });
}

function positionedLines(textItems, pageNumber) {
  const rows = [];
  const sorted = textItems.map((item, index) => ({ ...item, sourceIndex: index })).filter((item) => text(item.str)).map((item) => ({
    value: text(item.str), x: item.transform[4], y: item.transform[5],
    width: item.width || 0, height: Math.abs(item.height || item.transform[3] || 10),
    sourceCell: { ref: `pdf:${pageNumber}:${item.sourceIndex + 1}`, page: pageNumber,
      value: item.str, x: item.transform[4], y: item.transform[5], width: item.width || 0,
      height: Math.abs(item.height || item.transform[3] || 10) }
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
      if (previous && gap < Math.max(10, piece.height) && !(headerField(previous.value) && headerField(piece.value))) {
        previous.value = text(`${previous.value} ${piece.value}`);
        previous.endX = Math.max(previous.endX, piece.x + piece.width);
      } else cells.push({ key: piece.x, value: piece.value, x: piece.x, endX: piece.x + piece.width });
    }
    return { y: row.y, height: Math.max(...row.pieces.map((piece) => piece.height)), cells,
      sourceCells: row.pieces.map((piece) => piece.sourceCell) };
  });
}

function pdfVisualContent(operators, ops, pageArea) {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const rectangles = [];
  let images = false, largeImage = false, painted = false;
  const imageOps = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject,
    ops.paintSolidColorImageMask, ops.paintImageMaskXObjectGroup, ops.paintInlineImageXObjectGroup].filter(Number.isInteger));
  const paintOps = new Set([ops.stroke, ops.closeStroke, ops.fill, ops.eoFill, ops.fillStroke,
    ops.eoFillStroke, ops.closeFillStroke, ops.closeEOFillStroke, ops.shadingFill].filter(Number.isInteger));
  const rectangle = (transform) => {
    const [a, b, c, d, e, f] = transform;
    const xs = [e, e + a, e + c, e + a + c], ys = [f, f + b, f + d, f + b + d];
    rectangles.push({ left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) });
  };
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index], args = operators.argsArray[index];
    if (operation === ops.save) stack.push([...matrix]);
    else if (operation === ops.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (operation === ops.transform && args?.length >= 6) {
      const [a, b, c, d, e, f] = matrix, [aa, bb, cc, dd, ee, ff] = args;
      matrix = [a * aa + c * bb, b * aa + d * bb, a * cc + c * dd, b * cc + d * dd,
        a * ee + c * ff + e, b * ee + d * ff + f];
    } else if (imageOps.has(operation)) {
      images = true;
      rectangle(matrix);
      largeImage ||= Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) >= pageArea * 0.2;
      // Group image operators contain their own transforms and cannot be
      // compared safely as a single ordinary text table.
      if ([ops.paintImageMaskXObjectGroup, ops.paintInlineImageXObjectGroup].includes(operation)) largeImage = true;
    } else if (operation === ops.paintImageXObjectRepeat) {
      images = true;
      largeImage ||= Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) * Math.abs(args?.[1] * args?.[2]) >= pageArea * 0.2;
      const positions = args?.[3] || [];
      const [a, b, c, d, e, f] = matrix;
      for (let offset = 0; offset + 1 < positions.length; offset += 2) {
        rectangle([a * args[1], b * args[1], c * args[2], d * args[2],
          a * positions[offset] + c * positions[offset + 1] + e, b * positions[offset] + d * positions[offset + 1] + f]);
      }
    } else if (paintOps.has(operation) || operation === ops.constructPath && paintOps.has(args?.[0])) painted = true;
  }
  return { images, largeImage, painted, rectangles };
}

function pdfTableImage(rectangles, headers) {
  for (const { columns, y } of headers) {
    const anchors = [Number(columns.quantity), Number(columns.name)].sort((a, b) => a - b);
    if (!anchors.every(Number.isFinite)) continue;
    const clusters = [];
    for (const rectangle of rectangles.filter((rect) => rect.top < y && rect.right >= anchors[0] - 14 && rect.left <= anchors[1] + 14)) {
      const cluster = { ...rectangle };
      for (let index = 0; index < clusters.length;) {
        const other = clusters[index];
        if (Math.min(cluster.top, other.top) > Math.max(cluster.bottom, other.bottom)
          && cluster.left <= other.right + 14 && other.left <= cluster.right + 14) {
          cluster.left = Math.min(cluster.left, other.left); cluster.right = Math.max(cluster.right, other.right);
          cluster.bottom = Math.min(cluster.bottom, other.bottom); cluster.top = Math.max(cluster.top, other.top);
          clusters.splice(index, 1); index = 0;
        } else index += 1;
      }
      clusters.push(cluster);
    }
    if (clusters.some((rect) => rect.left <= anchors[0] + 14 && rect.right >= anchors[1] - 14)) return true;
  }
  return false;
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
    const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: true, stopAtErrors: true });
    const document = await task.promise;
    if (document.numPages > MAX_PDF_PAGES) throw invalid("El PDF supera el límite de 100 páginas. Divídalo en archivos más pequeños antes de importar.");
    const pages = [];
    const warnings = [];
    const ledger = sourceLedger();
    let hasText = false;
    let rowCount = 0;
    let carriedColumns = null;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      if (content.items.length > MAX_PAGE_TEXT_ITEMS) throw invalid(`La página ${pageNumber} contiene demasiado texto para importar. Divida el PDF en archivos más pequeños.`);
      const lines = positionedLines(content.items, pageNumber);
      const operators = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1 });
      const visual = pdfVisualContent(operators, OPS, viewport.width * viewport.height);
      if (visual.largeImage) throw invalid(`Página ${pageNumber}: contiene una imagen grande o un cuadro escaneado cuyo contenido no se puede verificar. Use el Excel original o un PDF con toda la tabla como texto seleccionable; no se importó parcialmente el documento.`);
      const headers = lines.flatMap((line) => {
        if (line.cells.some((cell) => quantity(cell.value) !== null)) return [];
        const columns = findHeader(line.cells, `Página ${pageNumber}`);
        return columns ? [{ columns, y: line.y }] : [];
      });
      const inferredImageColumns = lines.flatMap((line) => {
        const candidate = headerlessPdfCandidate(line.cells);
        const name = candidate && line.cells.find((cell) => cell !== candidate.count);
        return name ? [{ columns: { quantity: candidate.count.x, name: name.x }, y: line.y + line.height }] : [];
      });
      if (pdfTableImage(visual.rectangles, headers.length ? headers : carriedColumns
        ? [{ columns: carriedColumns, y: viewport.height }] : inferredImageColumns)) {
        throw invalid(`Página ${pageNumber}: contiene una imagen o mosaico en las columnas del cuadro que no es texto seleccionable. Use el Excel original o un PDF digital completo; no se importó parcialmente el documento.`);
      }
      if (headers.length) carriedColumns = headers.at(-1).columns;
      if (!lines.length && (visual.images || visual.painted)) throw invalid(`Página ${pageNumber}: contiene imágenes o gráficos sin texto seleccionable. Parece escaneada; use un PDF digital o el Excel original. No se importó parcialmente el documento.`);
      rowCount += lines.length;
      if (rowCount > MAX_ROWS) throw invalid("El PDF supera el límite de 10,000 filas. Divídalo en archivos más pequeños antes de importar.");
      if (lines.length) hasText = true;
      else warnings.push(`Página ${pageNumber}: está vacía; no contiene texto, imágenes ni datos de inventario.`);
      pages.push({ pageNumber, lines });
      page.cleanup();
    }
    if (!hasText) throw invalid("El PDF no contiene texto seleccionable. Parece escaneado o compuesto por imágenes; use un PDF digital o el archivo Excel original.");
    const items = [];
    let columns = null;
    let category = "Sin categoría";
    let plainHeadingAllowed = true;
    let inferenceBlocked = false;
    let noteRegion = false;
    const candidates = pages.flatMap(({ lines }) => lines.map((line) => headerlessPdfCandidate(line.cells)).filter(Boolean));
    const candidateColumns = [];
    for (const candidate of candidates) {
      let column = candidateColumns.find((entry) => entry.edge === candidate.edge && Math.abs(entry.x - candidate.count.x) < 18);
      if (!column) { column = { edge: candidate.edge, x: candidate.count.x, count: 0 }; candidateColumns.push(column); }
      column.count += 1;
    }
    const alignedCandidate = (candidate) => candidate && candidateColumns.some((entry) => entry.count >= 2
      && entry.edge === candidate.edge && Math.abs(entry.x - candidate.count.x) < 18);
    let warnedHeaderless = false;
    for (const { pageNumber, lines } of pages) {
      let previousItem = null;
      let bodyHeight = 0;
      plainHeadingAllowed = true;
      for (const [lineIndex, line] of lines.entries()) {
        const sourceLocation = `Página ${pageNumber}, fila ${lineIndex + 1}`;
        const keep = (type, description = rowSummary(line.cells), count = null, rowCategory = category) => preserveRow(ledger, line.sourceCells, {
          type, description, quantity: count, category: rowCategory, sourceRow: lineIndex + 1, sourceLocation
        });
        const header = line.cells.some((cell) => quantity(cell.value) !== null) ? null : findHeader(line.cells, sourceLocation);
        if (header) {
          columns = header; plainHeadingAllowed = true; previousItem = null; inferenceBlocked = false; noteRegion = false;
          keep("header"); continue;
        }
        if (/^\s*(?:pagina|page)\s+\d+(?:\s+(?:de|of)\s+\d+)?\s*$/i.test(normalizeHeader(rowSummary(line.cells)))) { keep("note"); continue; }
        const mapped = columns ? mapPdfCells(line.cells, columns) : line.cells;
        const values = new Map(mapped.map((cell) => [cell.key, text(cell.value)]));
        const nearbyContinuation = columns && previousItem && previousItem.y - line.y > 0 && previousItem.y - line.y <= Math.max(line.height, previousItem.height) * 1.7;
        const noteLabel = mapped.length === 1 && headerField(mapped[0].value) === "notes";
        if (standaloneNote(mapped, columns) || noteLabel || (noteRegion && mapped.length === 1)) {
          noteRegion ||= noteLabel;
          keep("note");
          if (nearbyContinuation && columns?.notes !== undefined && mapped.every((cell) => cell.key === columns.notes)) {
            previousItem.item.notes = [previousItem.item.notes, rowSummary(mapped)].filter(Boolean).join(" ");
            previousItem.y = line.y;
          }
          warnings.push(`${sourceLocation}: se conservó como observación «${rowSummary(line.cells)}».`);
          continue;
        }
        if (!columns && incompleteWorkbookHeader(line.cells)) {
          inferenceBlocked = true;
          const issue = `${sourceLocation}: encabezados incompletos; indique «Cantidad» y «Descripción». No se usan columnas de modelo o número de orden como cantidades; revise «${rowSummary(line.cells)}».`;
          warnings.push(issue); ledger.blockers.push(issue); keep("unresolved"); previousItem = null; continue;
        }
        const uppercaseHeading = mapped.length === 1 && /^[A-ZÁÉÍÓÚÑ\d\s/-]+$/.test(text(mapped[0].value));
        const largerHeading = mapped.length === 1 && bodyHeight > 0 && line.height >= bodyHeight * 1.25;
        const declaredCategory = mapped.length === 1 && columns?.category !== undefined && mapped[0].key === columns.category;
        const heading = (plainHeadingAllowed || uppercaseHeading || largerHeading || declaredCategory) ? categoryHeading(mapped, columns) : "";
        if (heading) {
          category = heading; noteRegion = false;
          warnings.push(`${sourceLocation}: se conservó «${heading}» como encabezado de categoría, sin asignarle una cantidad.`);
          keep("category", heading); previousItem = null; continue;
        }
        if (nearbyContinuation && !values.get(columns.quantity) && !values.get(columns.category)) {
          const extraName = values.get(columns.name);
          const extraNotes = values.get(columns.notes);
          if ((!extraName || /^[\p{Ll}\d(]/u.test(extraName)) && (extraName || extraNotes)) {
            if (extraName) previousItem.item.name = text(`${previousItem.item.name} ${extraName}`);
            if (extraNotes) previousItem.item.notes = text(`${previousItem.item.notes} ${extraNotes}`);
            previousItem.y = line.y;
            previousItem.height = line.height;
            keep("continuation");
            continue;
          }
        }
        if (columns) {
          const item = readMappedRow(mapped, columns, category, lineIndex + 1, sourceLocation, warnings);
          if (item) {
            items.push(item);
            plainHeadingAllowed = false; noteRegion = false; bodyHeight = line.height;
            keep("item", item.name, item.quantity, item.category);
            previousItem = { item, y: line.y, height: line.height };
          } else { ledger.blockers.push(warnings.at(-1)); keep("unresolved"); previousItem = null; }
        } else {
          const candidate = headerlessPdfCandidate(line.cells);
          if (!inferenceBlocked && alignedCandidate(candidate)) {
            if (!warnedHeaderless) {
              warnings.push("El PDF no tiene encabezados reconocibles. Se interpretó como cantidad la columna numérica alineada; revise que no sea un número de orden antes de importar.");
              warnedHeaderless = true;
            }
            items.push({ name: candidate.name, quantity: quantity(candidate.count.value), category, notes: "", sourceRow: lineIndex + 1, sourceLocation });
            plainHeadingAllowed = false; noteRegion = false; bodyHeight = line.height;
            keep("item", candidate.name, quantity(candidate.count.value));
          } else {
            const issue = `${sourceLocation}: no se pudo identificar una cantidad explícita; revise «${rowSummary(line.cells)}».`;
            warnings.push(issue); ledger.blockers.push(issue); keep("unresolved");
          }
        }
      }
    }
    if (!items.length) throw invalid(`No se identificaron artículos con cantidades en el PDF. Use una tabla digital con encabezados «Descripción» o «Equipo» y «Cantidad».${warnings.length ? ` ${warnings.slice(0, 3).join(" ")}` : ""}`);
    return completeResult(items, warnings, fileName, ledger);
  } catch (error) {
    if (error.code === "WAREHOUSE_IMPORT_INVALID") throw error;
    if (error.name === "PasswordException") throw invalid("El PDF está protegido con contraseña. Use una copia sin contraseña para importar.");
    throw invalid("No se pudo leer el PDF. Use un PDF digital válido, sin contraseña.");
  } finally {
    if (task) await task.destroy().catch(() => {});
  }
}

async function parseInventoryFile(buffer, { fileName = "inventario", mimeType = "", worksheet = "" } = {}) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) throw invalid("No se recibió un archivo válido para importar.");
  if (!buffer.length) throw invalid("El archivo está vacío.");
  if (buffer.length > MAX_FILE_BYTES) throw invalid("El archivo supera el límite de 15 MB para importar inventario.");
  const source = text(fileName) || "inventario";
  const isExcel = /\.xlsx$/i.test(source) || mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const isPdf = /\.pdf$/i.test(source) || mimeType === "application/pdf";
  if (typeof worksheet !== "string" || worksheet.length > 200) throw invalid("La hoja seleccionada no es válida.");
  if (isExcel && !isPdf) return parseWorkbook(buffer, source, worksheet);
  if (isPdf && !isExcel) return parsePdf(buffer, source);
  throw invalid("Seleccione un archivo Excel .xlsx o un PDF digital. Los archivos .xls deben guardarse como .xlsx antes de importar.");
}

module.exports = { parseInventoryFile };
