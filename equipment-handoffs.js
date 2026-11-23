(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentHandoffs = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const RETURN_PREFIX = "handoff-return:";
  const text = value => String(value ?? "").trim();
  const list = value => Array.isArray(value) ? value : [];
  const clone = value => JSON.parse(JSON.stringify(value));
  const stateOf = value => value?.state || value || {};
  const positiveInteger = value => ["number", "string"].includes(typeof value) && text(value) !== ""
    && Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const chronology = movement => [movement.dateTime || movement.date || "", movement.createdAt || "", movement.id || ""].join("|");
  const fail = message => { throw Object.assign(new Error(message), { statusCode: 409 }); };
  const nodeKey = (movementId, handoffId = "") => JSON.stringify([movementId, handoffId]);
  function checkedState(value) {
    const state = stateOf(value);
    if (state.equipmentHandoffs !== undefined && !Array.isArray(state.equipmentHandoffs)) fail("No se puede leer el registro de trasiegos. Revise el archivo antes de registrar movimientos.");
    return state;
  }

  function makeReturnKey(handoffId) {
    const id = text(handoffId);
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,239}$/.test(id)) fail("El identificador del trasiego no es válido.");
    return RETURN_PREFIX + id;
  }
  function parseReturnKey(value) {
    const key = text(value);
    if (!key.startsWith(RETURN_PREFIX)) return "";
    const id = key.slice(RETURN_PREFIX.length);
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,239}$/.test(id)) fail("La referencia de devolución del trasiego no es válida.");
    return id;
  }

  // These are custody portions for display/returns, not new stock movements.
  // The original physical salida is never edited, copied into the ledger, or
  // released merely because its units move to another event.
  function getCustodyRecords(rawState) {
    const state = checkedState(rawState), roots = new Map(), nodes = new Map();
    const movements = list(state.movements);
    for (const movement of movements) {
      if (movement?.type !== "salida" || !text(movement.itemId) || movement.sourceUnmatched || movement.procurementChoice
          || !positiveInteger(movement.quantity)) continue;
      const id = text(movement.id);
      if (!id || roots.has(id)) fail("La salida original del equipo no tiene una identidad única. Revise sus movimientos antes de registrar el trasiego.");
      const root = clone(movement);
      const node = { key: nodeKey(id), root, handoff: null, handoffId: "", holderEventId: text(root.sourceEventId),
        holderDocumentId: text(root.sourceDocumentId), quantity: Number(root.quantity), sent: 0, returned: 0, returns: [],
        pathEventIds: text(root.sourceEventId) ? [text(root.sourceEventId)] : [] };
      roots.set(id, node); nodes.set(node.key, node);
    }
    const handoffs = list(state.equipmentHandoffs), byId = new Map();
    for (const handoff of handoffs) {
      const id = text(handoff?.id);
      if (!id || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,239}$/.test(id) || byId.has(id)) fail("El registro de trasiegos no tiene identificadores únicos.");
      if (!text(handoff.itemId) || !text(handoff.fromEventId) || !text(handoff.toEventId)
          || handoff.fromEventId === handoff.toEventId || !text(handoff.toDocumentId)
          || !positiveInteger(handoff.quantity) || !list(handoff.links).length) fail("El registro de trasiego está incompleto. No se modificó el inventario.");
      byId.set(id, handoff);
    }
    const pending = [...byId.values()].sort((a, b) => text(a.createdAt).localeCompare(text(b.createdAt)) || text(a.id).localeCompare(text(b.id)));
    const processed = new Set();
    while (pending.length) {
      const index = pending.findIndex(handoff => list(handoff.links).every(link => !text(link.parentHandoffId) || processed.has(text(link.parentHandoffId))));
      if (index < 0) fail("La cadena de trasiegos está incompleta o contiene un ciclo. Revise sus registros.");
      const handoff = pending.splice(index, 1)[0], seen = new Set();
      let quantity = 0;
      for (const link of handoff.links) {
        const rootId = text(link.sourceMovementId), parentId = text(link.parentHandoffId), key = nodeKey(rootId, parentId);
        const parent = nodes.get(key), root = roots.get(rootId)?.root;
        if (!parent || !root || !positiveInteger(link.quantity) || seen.has(key)
            || text(root.itemId) !== text(handoff.itemId) || parent.holderEventId !== text(handoff.fromEventId)
            || parent.pathEventIds.includes(text(handoff.toEventId))
            || text(handoff.fromDocumentId) && parent.holderDocumentId !== text(handoff.fromDocumentId)
            || text(link.sourceDocumentId) !== text(root.sourceDocumentId)
            || text(link.sourceEventId) !== text(root.sourceEventId)) fail("El trasiego no corresponde a una porción disponible de su salida original.");
        seen.add(key);
        const amount = Number(link.quantity);
        parent.sent += amount; quantity += amount;
        if (parent.sent > parent.quantity) fail("El mismo equipo ya está asignado a otro trasiego. No puede trasladarse dos veces.");
        const destinationKey = nodeKey(rootId, text(handoff.id));
        const existing = nodes.get(destinationKey);
        if (existing) {
          existing.quantity += amount;
          existing.pathEventIds = [...new Set([...existing.pathEventIds, ...parent.pathEventIds, text(handoff.toEventId)])];
        }
        else nodes.set(destinationKey, { key: destinationKey, root, handoff, handoffId: text(handoff.id),
          holderEventId: text(handoff.toEventId), holderDocumentId: text(handoff.toDocumentId), quantity: amount,
          sent: 0, returned: 0, returns: [], pathEventIds: [...parent.pathEventIds, text(handoff.toEventId)] });
      }
      if (quantity !== Number(handoff.quantity)) fail("La cantidad del trasiego no coincide con sus salidas originales.");
      processed.add(text(handoff.id));
    }
    const linkedRoots = new Set(handoffs.flatMap(handoff => handoff.links.map(link => text(link.sourceMovementId))));
    const orderedReturns = movements.filter(movement => movement?.type === "ingreso_evento" && !movement.sourceUnmatched && !movement.procurementChoice)
      .slice().sort((a, b) => chronology(a).localeCompare(chronology(b)));
    for (const movement of orderedReturns) {
      const amount = Number(movement.quantity);
      if (!positiveInteger(amount)) {
        if (linkedRoots.has(text(movement.relatedMovementId))) fail("La devolución de un equipo trasegado debe indicar una cantidad entera válida.");
        continue;
      }
      const handoffId = parseReturnKey(movement.sourceLineKey), rootId = text(movement.relatedMovementId);
      let candidates;
      if (handoffId) {
        const target = nodes.get(nodeKey(rootId, handoffId));
        if (!target || !target.handoff || text(movement.itemId) !== text(target.root.itemId)
            || text(movement.sourceDocumentId) !== text(target.root.sourceDocumentId)) fail("La devolución del trasiego debe enlazar su salida original y su cuadro de origen.");
        candidates = [target];
      } else {
        const target = roots.get(rootId);
        const affected = [...roots.values()].some(node => linkedRoots.has(text(node.root.id))
          && text(node.root.itemId) === text(movement.itemId) && text(node.root.sourceDocumentId) === text(movement.sourceDocumentId));
        if (linkedRoots.has(rootId) && (!target || text(movement.itemId) !== text(target.root.itemId)
            || text(movement.sourceDocumentId) !== text(target.root.sourceDocumentId))
            || rootId && !target && affected) fail("La devolución debe conservar el equipo y el cuadro de su salida original.");
        const matching = [...roots.values()].filter(node => text(node.root.itemId) === text(movement.itemId)
          && ((!text(node.root.sourceDocumentId) && !text(movement.sourceDocumentId))
            || text(node.root.sourceDocumentId) === text(movement.sourceDocumentId))
          && chronology(node.root) <= chronology(movement));
        candidates = [
          ...(target && text(target.root.itemId) === text(movement.itemId) ? [target] : []),
          ...matching.filter(node => node !== target).sort((a, b) => chronology(a.root).localeCompare(chronology(b.root)))
        ];
      }
      let remaining = amount;
      for (const node of candidates) {
        const free = Math.max(0, node.quantity - node.sent - node.returned), applied = Math.min(free, remaining);
        if (applied) { node.returned += applied; node.returns.push({ movement: clone(movement), quantity: applied }); remaining -= applied; }
        if (!remaining) break;
      }
      if (remaining && (handoffId || candidates.some(node => linkedRoots.has(text(node.root.id))))) {
        fail("La devolución supera el equipo que permanece en este evento; otra parte está en trasiego o ya regresó.");
      }
    }
    return [...nodes.values()].map(node => {
      const rootId = text(node.root.id), initialQuantity = node.quantity - node.sent;
      const id = node.handoffId ? `handoff:${node.handoffId}:${rootId}` : rootId;
      const movement = { ...clone(node.root), id, quantity: initialQuantity,
        sourceDocumentId: node.holderDocumentId, sourceEventId: node.holderEventId,
        ...(node.handoff ? { sourceEventName: text(node.handoff.toEventName) || text(node.root.sourceEventName),
          sourceEventPlace: text(node.handoff.toEventPlace), reference: text(node.handoff.toEventName) || text(node.root.reference),
          handoffId: node.handoffId, activityExcluded: node.handoff.activityExcluded === true,
          ...(node.handoff.toEventDate !== undefined ? { sourceEventDate: text(node.handoff.toEventDate) } : {}),
          ...(node.handoff.toExpectedReturnAt !== undefined ? { sourceExpectedReturnAt: text(node.handoff.toExpectedReturnAt) } : {}),
          ...(node.handoff.createdBy ? { createdBy: clone(node.handoff.createdBy) } : {}),
          ...(node.handoff.createdAt ? { createdAt: node.handoff.createdAt, registeredAt: node.handoff.createdAt } : {}) } : {}) };
      if (node.handoff) {
        delete movement.updatedBy;
        if (!node.handoff.createdBy) delete movement.createdBy;
        if (!node.handoff.createdAt) delete movement.registeredAt;
      }
      return { id, movement, rootMovement: clone(node.root), rootMovementId: rootId, handoffId: node.handoffId,
        ...(node.handoff ? { handoff: clone(node.handoff) } : {}),
        holderDocumentId: node.holderDocumentId, holderEventId: node.holderEventId,
        receivedQuantity: node.quantity, transferredQuantity: node.sent, initialQuantity,
        returnedQuantity: node.returned, remainingQuantity: initialQuantity - node.returned, returns: node.returns };
    }).sort((a, b) => chronology(b.movement).localeCompare(chronology(a.movement)) || a.id.localeCompare(b.id));
  }

  function allocateIncoming({ state: rawState, fromEventId, itemId, quantity, fromDocumentId } = {}) {
    const state = stateOf(rawState), amount = Number(quantity), eventId = text(fromEventId), stockId = text(itemId);
    if (!positiveInteger(amount) || !eventId || !stockId) return [];
    const matches = list(state.items).filter(entry => text(entry?.id) === stockId);
    const item = matches[0], type = text(item?.itemType).toLowerCase();
    if (matches.length !== 1 || item.archived || type === "consumible" || item.consumable === true
        || !["equipo", "consumible"].includes(type) && /(?:^|\s)\/?\s*consumible$/i.test(text(item.name))) return [];
    const records = getCustodyRecords(state).filter(record => record.remainingQuantity > 0 && record.holderEventId === eventId
      && text(record.rootMovement.itemId) === stockId && (fromDocumentId === undefined || record.holderDocumentId === text(fromDocumentId)))
      .sort((a, b) => chronology(a.rootMovement).localeCompare(chronology(b.rootMovement)) || a.id.localeCompare(b.id));
    const links = []; let remaining = amount;
    for (const record of records) {
      const used = Math.min(remaining, record.remainingQuantity);
      if (used) links.push({ sourceMovementId: record.rootMovementId, sourceDocumentId: text(record.rootMovement.sourceDocumentId),
        sourceEventId: text(record.rootMovement.sourceEventId), parentHandoffId: record.handoffId, quantity: used });
      remaining -= used; if (!remaining) break;
    }
    return links;
  }

  function validateReturns(previousRaw, nextRaw) {
    const previous = checkedState(previousRaw), next = checkedState(nextRaw);
    if (!list(previous.equipmentHandoffs).length && !list(next.equipmentHandoffs).length) return true;
    if (JSON.stringify(list(previous.equipmentHandoffs)) !== JSON.stringify(list(next.equipmentHandoffs))) {
      fail("El registro de trasiegos es administrado por el servidor y no puede modificarse desde Movimientos.");
    }
    const sourceIds = new Set(list(previous.equipmentHandoffs).flatMap(handoff => list(handoff.links).map(link => text(link.sourceMovementId))));
    const before = new Map(list(previous.movements).map(movement => [text(movement?.id), movement]));
    const after = new Map(list(next.movements).map(movement => [text(movement?.id), movement]));
    for (const id of sourceIds) {
      const original = before.get(id), candidate = after.get(id);
      if (!original || !candidate || ["id", "type", "itemId", "quantity", "sourceDocumentId", "sourceEventId"].some(field => original[field] !== candidate[field])) {
        fail("La salida original tiene trasiegos registrados. Conserve su identidad y cantidad hasta completar las devoluciones.");
      }
    }
    getCustodyRecords(next);
    return true;
  }
  return { getCustodyRecords, allocateIncoming, validateReturns, makeReturnKey, parseReturnKey };
});
