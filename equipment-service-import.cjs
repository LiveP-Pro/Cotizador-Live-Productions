const crypto = require("node:crypto");
const ExcelJS = require("exceljs");
const unzipper = require("unzipper");

const LIMITS = { fileBytes: 15 * 1024 * 1024, expandedBytes: 100 * 1024 * 1024,
  zipEntries: 2000, pages: 100, rows: 10000, cells: 100000, pageTextItems: 10000 };
const ALIASES = {
  service: ["servicio", "tipo de servicio", "paquete", "service"],
  category: ["categoria", "category", "seccion", "grupo", "rubro"],
  description: ["descripcion", "descripcion del equipo", "descripcion de equipo", "equipo", "nombre", "nombre del equipo", "articulo", "material", "description", "equipment", "item"],
  quantity: ["cantidad", "cant", "qty", "quantity", "unidades"],
  notes: ["nota", "notas", "observacion", "observaciones", "comentario", "comentarios", "notes"]
};
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const key = (value) => clean(value).normalize("NFD").replace(/\p{Mark}/gu, "").toLowerCase().replace(/[.:]+$/g, "").trim();
const clone = (value) => JSON.parse(JSON.stringify(value));
const field = (value) => Object.keys(ALIASES).find((name) => ALIASES[name].includes(key(value)));

function invalid(message) {
  const error = new Error(message);
  error.code = "EQUIPMENT_SERVICE_IMPORT_INVALID";
  error.statusCode = 400;
  return error;
}

function quantity(value) {
  const raw = typeof value === "number" ? value : clean(value).replace(/\s*(?:unidades?|uds?\.?|piezas?)$/i, "").trim();
  const number = typeof raw === "number" ? raw : /^\d+$/.test(raw) ? Number(raw)
    : /^\d+[.,]0+$/.test(raw) && !/^[1-9]\d{0,2}[.,]000$/.test(raw) ? Number(raw.replace(",", "."))
      : /^\d{1,3}(?:[ ,]\d{3})+$/.test(raw) ? Number(raw.replace(/[ ,]/g, "")) : NaN;
  return Number.isSafeInteger(number) && number >= 0 && number <= 100000 ? number : null;
}

function displayedCell(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return value;
  if (value instanceof Date) return cell.text || value.toISOString();
  if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
  // ExcelJS's value getter omits falsy cached formula results, including 0.
  // The result getter reads the original parsed model without that filtering.
  if ("formula" in value || "sharedFormula" in value) return cell.result ?? `=${value.formula || value.sharedFormula}`;
  return value.text ?? cell.text ?? "";
}

async function loadWorkbook(buffer) {
  try {
    const archive = await unzipper.Open.buffer(buffer);
    if (archive.files.length > LIMITS.zipEntries || archive.files.reduce((sum, entry) => sum + entry.uncompressedSize, 0) > LIMITS.expandedBytes) {
      throw invalid("El Excel contiene demasiados datos comprimidos. Divida el libro en archivos más pequeños.");
    }
    let expanded = 0;
    for (const entry of archive.files) {
      await new Promise((resolve, reject) => {
        const stream = entry.stream();
        stream.on("data", (chunk) => {
          expanded += chunk.length;
          if (expanded > LIMITS.expandedBytes) stream.destroy(invalid("El Excel supera el límite de 100 MB descomprimidos."));
        });
        stream.once("error", reject);
        stream.once("end", resolve);
      });
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  } catch (error) {
    if (error.code === "EQUIPMENT_SERVICE_IMPORT_INVALID") throw error;
    throw invalid("No se pudo leer el Excel. Use un archivo .xlsx válido y sin contraseña.");
  }
}

function detectHeader(cells) {
  // A populated numeric cell is source data, even when other cells happen to
  // spell Equipo/Cantidad. In particular, never promote a zero item to a header.
  if (cells.some((cell) => quantity(cell.value) !== null)) return null;
  const columns = {};
  const labels = {};
  const duplicates = [];
  for (const cell of cells) {
    labels[cell.column] = clean(cell.value);
    const name = field(cell.value);
    if (!name) continue;
    if (columns[name] !== undefined) duplicates.push(name);
    else columns[name] = cell.column;
  }
  return columns.description !== undefined && columns.quantity !== undefined ? { columns, labels, duplicates } : null;
}

function directive(cells, kind) {
  const aliases = ALIASES[kind];
  for (const cell of cells) {
    const value = String(cell.value ?? "").trim();
    const colon = value.indexOf(":");
    if (colon >= 0 && aliases.includes(key(value.slice(0, colon))) && clean(value.slice(colon + 1))) return clean(value.slice(colon + 1));
  }
  if (cells.length === 2 && aliases.includes(key(cells[0].value)) && clean(cells[1].value) && quantity(cells[1].value) === null) return clean(cells[1].value);
  return "";
}

function buildServices(sourceRows, warnings, blockers) {
  const services = [];
  const servicesByName = new Map();
  let service = null;
  let section = null;
  let category = "Equipo";
  let table = null;
  let pending = [];
  let location = "";
  let inferredName = "";

  const ensureService = (name) => {
    const normalized = key(name);
    let current = servicesByName.get(normalized);
    if (!current) {
      current = { name: clean(name) || "Servicio importado", sourceName: clean(name) || "Servicio importado", mainSections: [], sourceRefs: [] };
      servicesByName.set(normalized, current);
      services.push(current);
    }
    if (service !== current) { service = current; section = null; category = "Equipo"; }
    return current;
  };
  const ensureSection = (title = category, force = false) => {
    if (!service) ensureService(inferredName || location || "Servicio importado");
    if (!section || section.title !== title || force) {
      section = { title: title || "Equipo", items: [], notes: [], rows: [] };
      service.mainSections.push(section);
    }
    return section;
  };
  const append = (sourceRow, type, description, count = null, extra = {}) => {
    const target = ensureSection();
    const row = { type, quantity: count, description: clean(description), sourceRefs: sourceRow.cells.map((cell) => cell.ref),
      cells: clone(sourceRow.cells), sourceOrder: sourceRow.order, sourceLocation: sourceRow.sourceLocation,
      sectionTitle: target.title, ...extra };
    if (type === "item") {
      row.itemIndex = target.items.length;
      target.items.push([count, clean(description)]);
    } else {
      row.displayGroups = extra.displayGroups || (sourceRow.columns || sourceRow.cells).map((cell) => cell.refs || [cell.ref]);
      target.notes.push(clean(description));
    }
    target.rows.push(row);
    service.sourceRefs.push(...row.sourceRefs);
    return row;
  };
  const flushPending = () => {
    for (const row of pending) append(row, row.kind || "note", row.cells.map((cell) => String(cell.value ?? "")).join(" | "), null, { displayGroups: row.cells.map((cell) => [cell.ref]) });
    pending = [];
  };

  for (const sourceRow of sourceRows) {
    if (sourceRow.location !== location) {
      if (pending.length) { ensureService(inferredName || location); flushPending(); }
      location = sourceRow.location;
      service = null; section = null; table = null; category = "Equipo"; inferredName = "";
    }
    const cells = sourceRow.columns || sourceRow.cells;
    const values = new Map(cells.map((cell) => [cell.column, cell.value]));
    const rawCount = table ? values.get(table.columns.quantity) : undefined;
    const hasCount = rawCount !== undefined && clean(rawCount) !== "";
    const header = !hasCount || field(rawCount) ? detectHeader(cells) : null;
    if (header) {
      table = header;
      if (header.duplicates.length) blockers.push(`${sourceRow.sourceLocation}: hay columnas ambiguas repetidas (${header.duplicates.join(", ")}). Separe los cuadros en hojas o bloques distintos.`);
      if (!service) pending.push({ ...sourceRow, kind: "header" });
      else {
        if (section?.items.length) ensureSection(category, true);
        append(sourceRow, "header", cells.map((cell) => String(cell.value ?? "")).join(" | "));
      }
      continue;
    }
    const serviceName = hasCount ? "" : directive(cells, "service");
    if (serviceName) {
      ensureService(serviceName);
      flushPending();
      append(sourceRow, "heading", cells.map((cell) => String(cell.value ?? "")).join(" | "), null, { headingKind: "service" });
      continue;
    }
    const declaredService = table && clean(values.get(table.columns.service));
    if (declaredService) { ensureService(declaredService); flushPending(); }
    const categoryDirective = hasCount ? "" : directive(cells, "category");
    const declaredCategory = categoryDirective || (table && clean(values.get(table.columns.category)));
    if (declaredCategory) {
      category = declaredCategory;
      if (service) ensureSection(category);
    }
    if (categoryDirective) {
      if (!service) ensureService(inferredName || location);
      flushPending();
      append(sourceRow, "heading", cells.map((cell) => String(cell.value ?? "")).join(" | "), null, { headingKind: "category" });
      continue;
    }
    const count = quantity(rawCount);
    const description = table ? clean(values.get(table.columns.description)) : "";
    const noteOnly = table && cells.every((cell) => [table.columns.notes, table.columns.service, table.columns.category].includes(cell.column));
    const noteLabel = /^(?:nota|notas|observacion|observaciones|comentario)\s*:/i.test(key(description || cells.map((cell) => clean(cell.value)).join(" ")));
    const pageFooter = !hasCount && /^(?:pagina|page)\s+\d+\s+(?:de|of)\s+\d+$/.test(key(description || cells.map((cell) => clean(cell.value)).join(" ")));
    const single = cells.length === 1 ? cells[0] : null;
    const heading = single && !hasCount && (single.isHeading || /^[A-ZÁÉÍÓÚÑ\s/-]+$/.test(clean(single.value))) && !noteLabel;
    if (heading) {
      if (!table && !service && !inferredName) inferredName = clean(single.value);
      else category = clean(single.value);
      if (!service) ensureService(inferredName || location);
      flushPending();
      ensureSection(category);
      append(sourceRow, "heading", single.value, null, { headingKind: table ? "category" : "source" });
      continue;
    }
    if (!service && !table) {
      pending.push(sourceRow);
      continue;
    }
    if (!service) ensureService(inferredName || location);
    flushPending();
    if (table && description && count !== null) {
      const extras = cells.filter((cell) => ![table.columns.description, table.columns.quantity, table.columns.service, table.columns.category].includes(cell.column));
      const notes = extras.map((cell) => `${table.labels[cell.column] || `Columna ${cell.column}`}: ${String(cell.value ?? "")}`);
      const refsFor = (column) => cells.filter((cell) => cell.column === column).flatMap((cell) => cell.refs || [cell.ref]).filter(Boolean);
      append(sourceRow, "item", description, count, { notes, quantityRefs: refsFor(table.columns.quantity), descriptionRefs: refsFor(table.columns.description) });
      if (notes.length) section.notes.push(...notes);
    } else if (noteOnly || noteLabel || pageFooter || (!hasCount && !description)) {
      append(sourceRow, "note", cells.map((cell) => String(cell.value ?? "")).join(" | "));
    } else {
      append(sourceRow, "unresolved", cells.map((cell) => String(cell.value ?? "")).join(" | "));
      blockers.push(`${sourceRow.sourceLocation}: no se puede identificar descripción y cantidad sin inventar información; revise «${cells.map((cell) => String(cell.value ?? "")).join(" | ")}».`);
    }
  }
  if (pending.length) { ensureService(inferredName || location || "Servicio importado"); flushPending(); }
  for (const current of services) {
    if (!current.mainSections.some((entry) => entry.items.length)) blockers.push(`Servicio «${current.name}»: no se identificaron filas de equipo con cantidades explícitas. Incluya encabezados Descripción y Cantidad.`);
  }
  if (blockers.length) warnings.push(...blockers);
  return services;
}

async function readExcel(buffer) {
  const workbook = await loadWorkbook(buffer);
  const sourceCells = [];
  const sourceRows = [];
  const blockers = [];
  let rowCount = 0;
  for (const sheet of workbook.worksheets) {
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (++rowCount > LIMITS.rows) throw invalid("El Excel supera el límite de 10,000 filas.");
      const cells = [];
      row.eachCell({ includeEmpty: false }, (cell, column) => {
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const value = displayedCell(cell);
        if (!clean(value) && !cell.value?.formula && !cell.value?.sharedFormula) return;
        if (sourceCells.length >= LIMITS.cells) throw invalid("El Excel supera el límite de 100,000 celdas con información.");
        const rawValue = clone(cell.value);
        if (rawValue && typeof rawValue === "object" && ("formula" in rawValue || "sharedFormula" in rawValue) && cell.result !== undefined) rawValue.result = clone(cell.result);
        const entry = { ref: `xlsx:${sheet.id}:${cell.address}`, sheet: sheet.name, row: rowNumber, column,
          address: cell.address, value, rawValue, isHeading: cell.isMerged || cell.font?.bold === true,
          sourceOrder: sourceRows.length };
        if ((cell.value?.formula || cell.value?.sharedFormula) && cell.result === undefined) blockers.push(`Hoja «${sheet.name}», celda ${cell.address}: la fórmula no tiene resultado guardado; calcule y guarde el Excel antes de importar.`);
        sourceCells.push(entry);
        cells.push(entry);
      });
      if (cells.length) sourceRows.push({ location: sheet.name, cells, order: sourceRows.length,
        sourceLocation: `Hoja «${sheet.name}», fila ${rowNumber}` });
    });
  }
  return { sourceCells, sourceRows, documentLines: [], blockers };
}

function pdfLines(items, pageNumber) {
  const pieces = items.map((item, index) => ({ ref: `pdf:${pageNumber}:${index + 1}`, page: pageNumber,
    value: item.str, x: item.transform?.[4] || 0, y: item.transform?.[5] || 0, width: item.width || 0,
    height: Math.abs(item.height || item.transform?.[3] || 10) })).filter((item) => clean(item.value));
  pieces.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const piece of pieces) {
    let line = lines.at(-1);
    if (!line || Math.abs(line.y - piece.y) > Math.max(2, Math.min(4, piece.height * 0.25))) {
      line = { y: piece.y, cells: [] }; lines.push(line);
    }
    line.cells.push(piece);
  }
  return lines.map((line, index) => {
    const columns = [];
    const cells = line.cells.sort((a, b) => a.x - b.x).map((cell) => ({ ...cell, row: index + 1, column: cell.x }));
    for (const cell of cells) {
      const previous = columns.at(-1);
      if (previous && cell.x - previous.endX < Math.max(10, cell.height)) {
        previous.value = clean(`${previous.value} ${cell.value}`);
        previous.endX = Math.max(previous.endX, cell.x + cell.width);
        previous.refs.push(cell.ref);
      } else columns.push({ column: cell.x, value: cell.value, endX: cell.x + cell.width, refs: [cell.ref] });
    }
    return { ref: `pdf-line:${pageNumber}:${index + 1}`, page: pageNumber, line: index + 1, y: line.y,
      cells, columns, text: cells.map((cell) => cell.value).join(" ") };
  });
}

function hasLargePdfImage(operators, ops, pageArea) {
  let matrix = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const imageOps = new Set([ops.paintImageXObject, ops.paintInlineImageXObject, ops.paintImageMaskXObject]);
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index];
    const args = operators.argsArray[index];
    if (operation === ops.save) stack.push([...matrix]);
    else if (operation === ops.restore) matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (operation === ops.transform && args?.length >= 6) {
      const [a, b, c, d, e, f] = matrix;
      const [aa, bb, cc, dd, ee, ff] = args;
      matrix = [a * aa + c * bb, b * aa + d * bb, a * cc + c * dd, b * cc + d * dd,
        a * ee + c * ff + e, b * ee + d * ff + f];
    } else if (imageOps.has(operation) && Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) >= pageArea * 0.2) return true;
    else if (operation === ops.paintImageXObjectRepeat && Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]) * Math.abs(args?.[1] * args?.[2]) >= pageArea * 0.2) return true;
  }
  return false;
}

async function readPdf(buffer) {
  let task;
  try {
    const { getDocument, OPS } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, disableFontFace: true, useSystemFonts: true });
    const document = await task.promise;
    if (document.numPages > LIMITS.pages) throw invalid("El PDF supera el límite de 100 páginas.");
    const documentLines = [];
    const sourceCells = [];
    const sourceRows = [];
    const blockers = [];
    let headers = null;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      if (content.items.length > LIMITS.pageTextItems) throw invalid(`La página ${pageNumber} supera el límite de texto permitido.`);
      const lines = pdfLines(content.items.filter((item) => typeof item.str === "string"), pageNumber);
      const operators = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1 });
      if (hasLargePdfImage(operators, OPS, viewport.width * viewport.height)) {
        blockers.push(`Página ${pageNumber}: contiene una imagen grande cuyo contenido no puede compararse celda por celda. Si es un cuadro escaneado, use el Excel original o un PDF con toda la tabla como texto seleccionable.`);
      }
      if (!lines.length) {
        if (operators.fnArray.some((op) => [OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat].includes(op))) {
          blockers.push(`Página ${pageNumber}: contiene imágenes sin texto seleccionable. No se puede verificar todo su contenido; use el Excel original o un PDF digital.`);
        }
      }
      for (const line of lines) {
        if (sourceRows.length >= LIMITS.rows || sourceCells.length + line.cells.length > LIMITS.cells) throw invalid("El PDF supera el límite de 10,000 filas o 100,000 fragmentos de texto.");
        const header = detectHeader(line.columns);
        if (header) headers = header;
        let columns = line.columns;
        if (!header && headers) {
          const anchors = Object.keys(headers.labels).map(Number).sort((a, b) => a - b);
          const values = new Map();
          columns = columns.map((cell) => {
            let column = anchors[0];
            for (const anchor of anchors) if (cell.column >= anchor - 14) column = anchor;
            return { ...cell, column };
          });
          for (const cell of columns) {
            const previous = values.get(cell.column) || { value: "", refs: [] };
            values.set(cell.column, { value: clean(`${previous.value} ${cell.value}`), refs: [...previous.refs, ...cell.refs] });
          }
          columns = [...values].map(([column, value]) => ({ column, ...value }));
        }
        line.cells.forEach((cell) => { cell.sourceOrder = sourceRows.length; });
        sourceCells.push(...line.cells);
        documentLines.push(line);
        sourceRows.push({ location: "PDF importado", cells: line.cells, columns, order: sourceRows.length,
          sourceLocation: `Página ${pageNumber}, fila ${line.line}` });
      }
      page.cleanup();
    }
    if (!sourceCells.length) throw invalid("El PDF no contiene texto seleccionable. Parece escaneado; use un PDF digital o el archivo Excel original.");
    return { sourceCells, sourceRows, documentLines, blockers };
  } catch (error) {
    if (error.code === "EQUIPMENT_SERVICE_IMPORT_INVALID") throw error;
    if (error.name === "PasswordException") throw invalid("El PDF está protegido con contraseña. Use una copia sin contraseña.");
    throw invalid("No se pudo leer el PDF. Use un PDF digital válido y sin contraseña.");
  } finally {
    if (task) await task.destroy().catch(() => {});
  }
}

function verifyServiceImport(preview) {
  const source = Array.isArray(preview?.sourceCells) ? preview.sourceCells : [];
  const expected = new Map(source.map((cell) => [cell.ref, cell]));
  const originalPositions = new Map(source.map((cell, index) => [cell.ref, index]));
  const represented = new Map();
  const mismatchedRefs = [];
  const duplicateRefs = [];
  const blockers = [...(Array.isArray(preview?.blockers) ? preview.blockers : [])];
  if (expected.size !== source.length) blockers.push("La fuente contiene referencias de celda repetidas.");
  for (const service of preview?.services || []) {
    let previousRowOrder = -1;
    const serviceRefs = [];
    for (const section of service?.mainSections || []) {
      const itemRows = [];
      const generatedNotes = [];
      for (const row of section?.rows || []) {
        if (!Number.isInteger(row.sourceOrder) || row.sourceOrder <= previousRowOrder) blockers.push(`${row.sourceLocation || "Fila"}: cambió el orden original de las filas.`);
        previousRowOrder = row.sourceOrder;
        let previousCellPosition = -1;
        if (row.type === "unresolved") blockers.push(`${row.sourceLocation || "Fila"}: información sin resolver.`);
        if (row.type === "item") itemRows.push(row);
        generatedNotes.push(...(row.type === "item" ? row.notes || [] : [row.description]));
        if (row.sectionTitle !== section.title) blockers.push(`${row.sourceLocation || "Fila"}: cambió la categoría de la fuente.`);
        for (const cell of row.cells || []) {
          if (represented.has(cell.ref)) duplicateRefs.push(cell.ref);
          represented.set(cell.ref, cell);
          if (!expected.has(cell.ref) || JSON.stringify(cell) !== JSON.stringify(expected.get(cell.ref))) mismatchedRefs.push(cell.ref);
          if (cell.sourceOrder !== row.sourceOrder) mismatchedRefs.push(cell.ref);
          const originalPosition = originalPositions.get(cell.ref);
          if (originalPosition <= previousCellPosition) mismatchedRefs.push(cell.ref);
          previousCellPosition = originalPosition;
        }
        serviceRefs.push(...(row.sourceRefs || []));
        if (JSON.stringify(row.sourceRefs || []) !== JSON.stringify((row.cells || []).map((cell) => cell.ref))) mismatchedRefs.push(...(row.sourceRefs || []));
        if (row.type === "item") {
          const valueFor = (refs) => (refs || []).map((ref) => expected.get(ref)?.value ?? "").join(" ");
          if (!row.quantityRefs?.length || !row.descriptionRefs?.length || quantity(valueFor(row.quantityRefs)) !== row.quantity || clean(valueFor(row.descriptionRefs)) !== row.description) {
            blockers.push(`${row.sourceLocation || "Fila"}: la cantidad o descripción no coincide con sus celdas originales.`);
            mismatchedRefs.push(...(row.sourceRefs || []));
          }
        } else {
          const groups = row.displayGroups || [];
          const fromSource = clean(groups.map((refs) => refs.map((ref) => String(expected.get(ref)?.value ?? "")).join(" ")).join(" | "));
          if (row.quantity !== null || fromSource !== row.description || JSON.stringify(groups.flat()) !== JSON.stringify(row.sourceRefs || [])) {
            blockers.push(`${row.sourceLocation || "Fila"}: el encabezado o nota no coincide con sus celdas originales.`);
            mismatchedRefs.push(...(row.sourceRefs || []));
          }
        }
      }
      const generated = itemRows.map((row) => [row.quantity, row.description]);
      if (JSON.stringify(generated) !== JSON.stringify(section.items || [])) {
        blockers.push(`Servicio «${service.name}», sección «${section.title}»: las cantidades o descripciones no coinciden con las filas de la fuente.`);
        mismatchedRefs.push(...itemRows.flatMap((row) => row.sourceRefs || []));
      }
      if (JSON.stringify(generatedNotes) !== JSON.stringify(section.notes || [])) blockers.push(`Servicio «${service.name}», sección «${section.title}»: faltan encabezados, notas o datos adicionales de la fuente.`);
    }
    if (JSON.stringify(serviceRefs) !== JSON.stringify(service.sourceRefs || [])) blockers.push(`Servicio «${service.name}»: cambiaron las referencias u orden de las celdas originales.`);
  }
  const missingRefs = source.filter((cell) => !represented.has(cell.ref)).map((cell) => cell.ref);
  if (!source.length || !(preview?.services || []).length) blockers.push("La fuente no contiene celdas o servicios verificables.");
  return { algorithm: "source-cell-ledger-v1", complete: !missingRefs.length && !mismatchedRefs.length && !duplicateRefs.length && !blockers.length,
    sourceCellCount: source.length, representedCellCount: [...represented.keys()].filter((ref) => expected.has(ref)).length,
    missingRefs, mismatchedRefs: [...new Set(mismatchedRefs)], duplicateRefs: [...new Set(duplicateRefs)], blockers: [...new Set(blockers)] };
}

async function parseServiceFile(buffer, { fileName = "servicios", mimeType = "" } = {}) {
  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) throw invalid("No se recibió un archivo válido.");
  if (!buffer.length) throw invalid("El archivo está vacío.");
  if (buffer.length > LIMITS.fileBytes) throw invalid("El archivo supera el límite de 15 MB.");
  const format = /\.xlsx$/i.test(fileName) ? "xlsx" : /\.pdf$/i.test(fileName) ? "pdf"
    : mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ? "xlsx" : mimeType === "application/pdf" ? "pdf" : "";
  if (!format) throw invalid("Use Excel .xlsx o PDF digital. Los archivos .xls deben guardarse como .xlsx.");
  const data = format === "xlsx" ? await readExcel(buffer) : await readPdf(buffer);
  if (!data.sourceCells.length) throw invalid("El archivo no contiene celdas o texto con información.");
  const warnings = [];
  const services = buildServices(data.sourceRows, warnings, data.blockers);
  const preview = { source: { fileName: String(fileName), format, mimeType: String(mimeType),
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"), byteLength: buffer.length },
    services, warnings, sourceCells: data.sourceCells, documentLines: data.documentLines, blockers: data.blockers };
  preview.verification = verifyServiceImport(preview);
  return preview;
}

module.exports = { parseServiceFile, verifyServiceImport };
