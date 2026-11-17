(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WarehouseImportCorrections = api;
})(typeof window === "object" ? window : globalThis, function () {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
  const key = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[.:]+$/g, "").trim();
  const aliases = {
    name: new Set(["descripcion", "descripcion del equipo", "descripcion de equipo", "equipo", "nombre", "nombre del equipo", "articulo", "producto", "material", "item", "description", "name", "equipment", "inventario disponible"]),
    quantity: new Set(["cantidad", "cant", "qty", "quantity", "existencia", "existencias", "stock", "unidades", "cantidad disponible", "disponible"]),
    category: new Set(["categoria", "category", "grupo", "rubro", "clasificacion"]),
    notes: new Set(["observaciones", "observacion", "notas", "nota", "notes", "comments", "comentarios", "comentario"])
  };

  // Blank inputs and numeric model columns never turn into a count. The same
  // explicit integer formats accepted by the file reader remain accepted here.
  function quantity(value) {
    if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
    const raw = text(value).replace(/\s*(?:unidades?|uds?\.?|piezas?)$/i, "").trim();
    let candidate;
    if (/^\d+$/.test(raw)) candidate = Number(raw);
    else if (/^\d+[.,]0+$/.test(raw) && !/^[1-9]\d{0,2}[.,]000$/.test(raw)) candidate = Number(raw.replace(",", "."));
    else if (/^\d{1,3}(?:[ ,]\d{3})+$/.test(raw)) candidate = Number(raw.replace(/[ ,]/g, ""));
    return Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null;
  }

  function column(cell) {
    if (Number.isFinite(cell.key)) return cell.key;
    if (Number.isFinite(cell.column)) return cell.column;
    if (Number.isFinite(cell.x)) return cell.x;
    const match = /([A-Z]+)\d+$/i.exec(cell.address || cell.ref || "");
    return match ? [...match[1].toUpperCase()].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) : null;
  }

  function excelColumn(value) {
    if (!Number.isSafeInteger(value) || value < 1) return "";
    let result = "";
    while (value > 0) { value -= 1; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
    return result;
  }

  function readHeader(cells) {
    const columns = {};
    for (const cell of cells) {
      const field = Object.keys(aliases).find((name) => aliases[name].has(key(cell.value)));
      if (!field || column(cell) === null) continue;
      if (columns[field] !== undefined && ["name", "quantity"].includes(field)) return null;
      columns[field] ??= column(cell);
    }
    return columns;
  }

  function mappedValues(cells, columns) {
    const values = new Map();
    if (!columns) return values;
    const pdf = cells.some((cell) => cell.page !== undefined || /^pdf:/.test(cell.ref || ""));
    const anchors = Object.values(columns).sort((a, b) => a - b);
    for (const cell of cells) {
      let location = column(cell);
      if (pdf) {
        location = anchors[0];
        for (const anchor of anchors) if (column(cell) >= anchor - 14) location = anchor;
      }
      if (location !== null && location !== undefined) {
        values.set(location, pdf ? text(`${values.get(location) ?? ""} ${cell.value ?? ""}`) : cell.value);
      }
    }
    return values;
  }

  function rowIssues(blockers, row, columns) {
    const location = text(row.sourceLocation);
    if (!location) return [];
    return blockers.filter((issue) => {
      if (!issue.startsWith(`${location}:`) && !issue.startsWith(`${location},`)) return false;
      if (!/\bformula\b/.test(key(issue))) return true;
      // Completing an item's count/name does not resolve a formula in an
      // unrelated notes or metadata cell, even when it is on the same row.
      const address = issue.match(/celda\s+([a-z]+[1-9]\d*)\b/i)?.[1]?.toUpperCase();
      const formulaCell = (row.cells || []).find((cell) => cell.address?.toUpperCase() === address);
      const formulaColumn = formulaCell ? column(formulaCell) : undefined;
      return formulaCell && columns && (formulaColumn === columns.name || formulaColumn === columns.quantity);
    });
  }

  function required(entry) {
    return [...(!text(entry.name) ? ["name"] : []), ...(quantity(entry.quantity) === null ? ["quantity"] : [])];
  }

  function prepare(parsed) {
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
      throw new Error("No se recibió una vista previa de inventario válida.");
    }
    const source = clone(parsed);
    const issues = [...new Set([...(source.blockers || []), ...(source.verification?.blockers || [])].map(text).filter(Boolean))];
    const entries = [];
    let columns = null;
    let sheet = "";
    for (const [index, row] of (source.sourceRows || []).entries()) {
      const cells = row.cells || [];
      const currentSheet = cells.find((cell) => cell.sheet)?.sheet || "";
      if (currentSheet && currentSheet !== sheet) { columns = null; sheet = currentSheet; }
      if (row.type === "header") { columns = readHeader(cells); continue; }
      if (row.type !== "unresolved") continue;
      const values = mappedValues(cells, columns);
      const knownName = columns?.name !== undefined;
      const rawQuantity = columns?.quantity !== undefined ? values.get(columns.quantity) : undefined;
      const pdf = cells.some((cell) => cell.page !== undefined || /^pdf:/.test(cell.ref || ""));
      const qtyRef = !pdf && columns?.quantity !== undefined
        ? `${excelColumn(columns.quantity)}${row.sourceRow}` : "";
      const notes = columns?.notes !== undefined && text(values.get(columns.notes)) ? [text(values.get(columns.notes))] : [];
      const mappedColumns = new Set(Object.values(columns || {}));
      if (columns) values.forEach((value, location) => {
        if (!mappedColumns.has(location) && text(value)) notes.push(text(value));
      });
      const entry = {
        id: `source-row-${index}`, index: entries.length,
        sourceOrder: Number.isInteger(row.sourceOrder) ? row.sourceOrder : index,
        sourceRow: row.sourceRow, sourceLocation: row.sourceLocation || `Fila ${index + 1}`,
        refs: cells.map((cell) => cell.ref || cell.address).filter(Boolean), cells: clone(cells),
        qtyRef, qtyLocation: qtyRef && sheet ? `${sheet}!${qtyRef}` : qtyRef,
        name: knownName ? text(values.get(columns.name)) : text(row.description),
        quantity: rawQuantity === undefined || rawQuantity === null ? "" : String(rawQuantity),
        category: (columns?.category !== undefined ? text(values.get(columns.category)) : "") || text(row.category) || "Sin categoría",
        notes: notes.join(" | "), issues: rowIssues(issues, row, columns), quantityColumnKnown: columns?.quantity !== undefined,
        decision: null
      };
      entry.required = required(entry);
      entries.push(entry);
    }
    const handled = new Set(entries.flatMap((entry) => entry.issues));
    const blockers = issues.filter((issue) => !handled.has(issue));
    if (source.verification?.complete === false && !entries.length && !blockers.length) {
      blockers.push("El lector no pudo verificar todo el archivo. Revise el documento antes de importar.");
    }
    return { source, validItems: clone(source.items), entries, blockers };
  }

  function entryFor(review, id) {
    const entry = typeof id === "number" ? review.entries[id] : review.entries.find((candidate) => candidate.id === id);
    if (!entry) throw new Error("No se encontró la fila pendiente.");
    return entry;
  }

  function update(review, id, fields = {}) {
    const entry = entryFor(review, id);
    for (const field of ["name", "quantity", "category", "notes"]) {
      if (Object.prototype.hasOwnProperty.call(fields, field)) entry[field] = fields[field];
    }
    entry.decision = null;
    entry.required = required(entry);
    return review;
  }

  function resolve(review, id, fields = {}) {
    update(review, id, fields);
    const entry = entryFor(review, id);
    const action = fields.action || "include";
    if (!["include", "skip"].includes(action)) throw new Error("Elija completar u omitir explícitamente esta fila.");
    if (action === "include") {
      if (!text(entry.name)) throw new Error(`${entry.sourceLocation}: escriba la descripción del equipo.`);
      if (quantity(entry.quantity) === null) throw new Error(`${entry.sourceLocation}: escriba una cantidad entera explícita, incluyendo 0 cuando corresponda.`);
    }
    entry.decision = {
      action, name: text(entry.name), quantity: action === "include" ? quantity(entry.quantity) : null,
      category: text(entry.category) || "Sin categoría", notes: text(entry.notes),
      author: text(fields.author) || null, authorization: "explicit-import-review"
    };
    return review;
  }

  function pending(review) {
    return review.blockers.length + review.entries.filter((entry) => !entry.decision).length;
  }

  function finalize(review) {
    if (review.blockers.length) throw new Error(review.blockers.join(" "));
    if (pending(review)) throw new Error("Complete u omita explícitamente cada fila pendiente antes de confirmar la importación.");
    const result = clone(review.source);
    const decisions = review.entries.map((entry) => {
      const decision = entry.decision;
      if (!["include", "skip"].includes(decision.action)
        || decision.action === "include" && (!text(decision.name) || quantity(decision.quantity) === null)) {
        throw new Error(`${entry.sourceLocation}: la corrección no tiene descripción y cantidad válidas.`);
      }
      return { id: entry.id, sourceOrder: entry.sourceOrder, sourceRow: entry.sourceRow,
        sourceLocation: entry.sourceLocation, refs: [...entry.refs], qtyRef: entry.qtyRef,
        originalCells: clone(entry.cells), ...clone(decision) };
    });
    const entriesByOrder = new Map(review.entries.map((entry) => [entry.sourceOrder, entry]));
    const byLocation = new Map();
    result.items.forEach((item, index) => {
      const group = byLocation.get(item.sourceLocation) || [];
      group.push(index); byLocation.set(item.sourceLocation, group);
    });
    const used = new Set();
    const items = [];
    for (const [index, row] of (result.sourceRows || []).entries()) {
      const sourceOrder = Number.isInteger(row.sourceOrder) ? row.sourceOrder : index;
      const entry = entriesByOrder.get(sourceOrder);
      if (entry) {
        if (entry.decision.action === "include") items.push({
          name: entry.decision.name, quantity: entry.decision.quantity,
          category: entry.decision.category, notes: entry.decision.notes,
          sourceRow: entry.sourceRow, sourceLocation: entry.sourceLocation,
          manualCorrection: { id: entry.id, authorization: "explicit-import-review" }
        });
      } else if (row.type === "item") {
        const next = (byLocation.get(row.sourceLocation) || []).find((itemIndex) => !used.has(itemIndex));
        if (next !== undefined) { used.add(next); items.push(result.items[next]); }
      }
    }
    result.items.forEach((item, index) => { if (!used.has(index)) items.push(item); });
    if (!items.length) throw new Error("El archivo revisado debe contener al menos un equipo; no se reemplazará el inventario por una lista vacía.");
    result.items = items;
    result.correctionDecisions = decisions;
    if (decisions.length) {
      result.originalVerification = clone(result.verification || {});
      result.originalBlockers = clone(result.blockers || []);
      result.blockers = [];
      result.verification = {
        ...(result.verification || {}), algorithm: "inventory-source-rows-v1+manual-review", complete: true,
        unresolvedRowCount: 0, sourceUnresolvedRowCount: review.entries.length,
        manuallyIncludedRows: decisions.filter((entry) => entry.action === "include").length,
        explicitlySkippedRows: decisions.filter((entry) => entry.action === "skip").length,
        blockers: []
      };
    }
    return result;
  }

  return { prepare, update, resolve, pending, finalize };
});
