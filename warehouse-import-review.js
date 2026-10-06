(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.WarehouseImportReview = api;
})(typeof window === "object" ? window : globalThis, function () {
  const text = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
  const key = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const approvedAliases = (item, currentName, ...names) => [...new Set([
    ...(Array.isArray(item.descriptionAliases) ? item.descriptionAliases : []), ...names
  ].map(text).filter((name) => name && name !== currentName))];
  const type = (item) => item.itemType === "consumible" || /(?:^|\s)\/?\s*consumible$/i.test(text(item.name))
    ? "consumible" : "equipo";

  function difference(current, incoming) {
    const before = key(current).split(" ").filter(Boolean);
    const after = key(incoming).split(" ").filter(Boolean);
    return {
      removed: before.filter((word) => !after.includes(word)),
      added: after.filter((word) => !before.includes(word))
    };
  }

  function similarity(first, second) {
    const a = key(first), b = key(second);
    if (a === b) return 1;
    if (!a || !b) return 0;
    const wordsA = new Set(a.split(" ")), wordsB = new Set(b.split(" "));
    const shared = [...wordsA].filter((word) => wordsB.has(word)).length;
    const words = (2 * shared) / (wordsA.size + wordsB.size);
    const grams = (value) => new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, i) => value.slice(i, i + 2)));
    const gramsA = grams(a), gramsB = grams(b);
    const common = [...gramsA].filter((gram) => gramsB.has(gram)).length;
    const letters = (2 * common) / Math.max(1, gramsA.size + gramsB.size);
    return words * 0.65 + letters * 0.35;
  }

  function prepare(currentState, imported, options = {}) {
    if (!currentState || !Array.isArray(currentState.items)) throw new Error("Inventario actual no válido.");
    if (!imported || !Array.isArray(imported.items) || !imported.items.length) throw new Error("El archivo no contiene equipos con cantidad válida.");
    if (imported.items.length > 10000) throw new Error("El archivo excede el límite de 10000 equipos.");
    const mode = options.mode === "restore" ? "restore" : "merge";
    const current = currentState.items.filter((item) => mode === "restore" || !item.archived);
    const rows = imported.items.map((raw, index) => {
      if (!text(raw.name)) throw new Error(`La fila ${index + 1} no tiene descripción.`);
      if (raw.quantity === null || raw.quantity === undefined || text(raw.quantity) === "" ||
          !Number.isSafeInteger(Number(raw.quantity)) || Number(raw.quantity) < 0) {
        throw new Error(`La fila ${index + 1} tiene una cantidad no válida.`);
      }
      const item = { ...clone(raw), name: text(raw.name), quantity: Number(raw.quantity) };
      const category = key(item.category);
      const sameCategory = (existing) => !category || category === "sin categoria" || key(existing.category) === category;
      const declaredType = ["equipo", "consumible"].includes(item.itemType) || /(?:^|\s)\/?\s*consumible$/i.test(item.name);
      const matching = current.filter((existing) => !declaredType || type(existing) === type(item));
      const byId = mode === "restore" && item.id ? matching.filter((existing) => existing.id === item.id) : [];
      const byName = matching.filter((existing) => sameCategory(existing) && key(existing.name) === key(item.name));
      const exact = byName.length ? byName : matching.filter((existing) => sameCategory(existing) && [existing.sourceKey,
        ...(Array.isArray(existing.descriptionAliases) ? existing.descriptionAliases : [])]
        .some((name) => key(name) === key(item.name)));
      const pool = byId.length ? byId : exact.length ? exact : matching.filter(sameCategory)
        .filter((existing) => similarity(existing.name, item.name) >= 0.5);
      const candidates = pool.map((existing) => ({
        id: existing.id, name: existing.name, category: existing.category, quantity: existing.quantity,
        score: similarity(existing.name, item.name), difference: difference(existing.name, item.name)
      })).sort((a, b) => b.score - a.score).slice(0, 5);
      const exactDescription = candidates.length === 1 && text(candidates[0].name) === item.name;
      const status = !candidates.length ? "new" : exactDescription ? "exact" : candidates.length === 1 ? "variant" : "ambiguous";
      const decision = status === "exact" ? { action: "keep-name", targetId: candidates[0].id }
        : status === "new" ? { action: "add" } : null;
      return { index, item, status, candidates, decision };
    });
    // Several uploaded rows must never silently overwrite the same equipment.
    const targets = new Map();
    for (const row of rows) {
      if (!row.decision?.targetId) continue;
      const group = targets.get(row.decision.targetId) || [];
      group.push(row);
      targets.set(row.decision.targetId, group);
    }
    if (mode === "merge") {
      for (const group of targets.values()) {
        if (group.length < 2) continue;
        for (const row of group) { row.status = "duplicate"; row.decision = null; }
      }
      const names = new Map();
      for (const row of rows.filter((entry) => entry.status === "new")) {
        const identity = `${key(row.item.category)}|${key(row.item.name)}`;
        const group = names.get(identity) || [];
        group.push(row);
        names.set(identity, group);
      }
      for (const group of names.values()) {
        if (group.length < 2) continue;
        for (const row of group) { row.status = "duplicate"; row.decision = null; }
      }
    }
    return { mode, base: clone(currentState), imported: clone(imported), rows };
  }

  function decide(plan, index, action, targetId = null) {
    const row = plan.rows[index];
    if (!row) throw new Error("No se encontró la fila a resolver.");
    if (!["imported-name", "keep-name", "add", "skip"].includes(action)) throw new Error("Acción no válida.");
    if (plan.mode === "restore" && action === "skip") throw new Error("Un respaldo completo no permite omitir filas con bitácoras.");
    if (["imported-name", "keep-name"].includes(action)) {
      if (!row.candidates.some((candidate) => candidate.id === targetId)) throw new Error("Seleccione una coincidencia válida.");
      if (plan.mode === "merge" && plan.rows.some((other) => other !== row && other.decision?.targetId === targetId)) {
        throw new Error("Ese equipo ya se actualiza con otra fila. Agréguelo por separado u omita esta fila.");
      }
      row.decision = { action, targetId };
    } else row.decision = { action };
    return plan;
  }

  function finalize(plan, options = {}) {
    if (plan.rows.some((row) => !row.decision)) throw new Error("Seleccione qué hacer con cada descripción diferente.");
    const now = options.now || new Date().toISOString();
    if (plan.mode === "restore") {
      const result = clone(plan.imported);
      const ids = new Set();
      result.items = plan.rows.map((row) => {
        const item = clone(row.item);
        if (!item.id || ids.has(item.id)) throw new Error("El respaldo contiene equipos sin identificador o identificadores repetidos.");
        ids.add(item.id);
        if (row.decision.targetId) {
          const candidate = row.candidates.find((c) => c.id === row.decision.targetId);
          const oldName = item.name;
          if (row.decision.action === "keep-name") item.name = candidate.name;
          const aliases = approvedAliases(item, item.name, oldName, candidate.name);
          if (aliases.length) item.descriptionAliases = aliases;
        }
        return item;
      });
      return result;
    }
    const result = clone(plan.base);
    const used = new Set();
    const ids = new Set(result.items.map((item) => item.id));
    for (const row of plan.rows) {
      const { action, targetId } = row.decision;
      if (action === "skip") continue;
      if (targetId) {
        if (used.has(targetId)) throw new Error("Varias filas intentan actualizar el mismo equipo.");
        used.add(targetId);
        const existing = result.items.find((item) => item.id === targetId);
        if (!existing) throw new Error("El inventario cambió. Vuelva a importar el archivo.");
        const previousName = existing.name;
        if (action === "imported-name") existing.name = row.item.name;
        const aliases = approvedAliases(existing, existing.name, previousName, row.item.name);
        if (aliases.length) existing.descriptionAliases = aliases;
        existing.quantity = row.item.quantity;
        // A file without notes/category must not erase existing information.
        if (text(row.item.notes)) existing.notes = text(row.item.notes);
        if (text(row.item.category) && key(row.item.category) !== "sin categoria") existing.category = text(row.item.category).toUpperCase();
        existing.importSource = { fileName: text(plan.imported.source), description: row.item.name,
          location: text(row.item.sourceLocation) };
        existing.updatedAt = now;
      } else {
        let id = options.createId ? options.createId() : `import-${now}-${row.index}`;
        while (ids.has(id)) id += "-new";
        ids.add(id);
        result.items.push({ ...clone(row.item), id, category: text(row.item.category || "SIN CATEGORIA").toUpperCase(),
          itemType: type(row.item), sourceKey: key(row.item.name), archived: false, createdAt: now, updatedAt: now,
          importSource: { fileName: text(plan.imported.source), description: row.item.name, location: text(row.item.sourceLocation) } });
      }
    }
    result.subtitles = [...new Set([...(result.subtitles || []), ...result.items.filter((item) => !item.archived).map((item) => item.category)])];
    result.updatedAt = now;
    return result;
  }

  return { prepare, decide, finalize, difference, similarity };
});
