(function (root, factory) {
  'use strict';
  const api = factory(typeof module === 'object' && module.exports ? require('./equipment-identity.js') : root.EquipmentIdentity);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EquipmentDraftSubstitutions = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Identity) {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const copy = value => JSON.parse(JSON.stringify(value));
  const text = value => String(value ?? '').trim();
  const fail = message => { throw new Error(message); };
  const asLine = raw => Array.isArray(raw) ? { quantity: raw[0], description: raw[1] } : raw;
  function inventoryOptions(inventory) {
    const records = Array.isArray(inventory) ? inventory : list((inventory?.state || inventory)?.items);
    return records.map(record => {
      const item = record?.item || record;
      if (!item || item.archived || !text(item.id) || !text(item.name)) return null;
      const classification = Identity?.classification?.(item);
      if ((classification?.itemType || item.itemType) === 'consumible' || classification?.pending) return null;
      const amount = record?.available ?? item.quantity;
      return { id: String(item.id), name: item.name, category: item.category || '', itemType: 'equipo',
        available: amount === '' || amount === null || !Number.isFinite(Number(amount)) ? null : Math.max(0, Number(amount)), item: copy(item) };
    }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  }
  function lines(events) {
    return list(events).flatMap(event => list(event.sections).flatMap((section, sectionIndex) => list(section.items).flatMap((raw, itemIndex) => {
      const line = asLine(raw);
      if (!line || !text(line.description) || !Number.isFinite(Number(line.quantity)) || !(Number(line.quantity) > 0)
          || line.itemType === 'consumible') return [];
      return [{ eventId: event.id, eventName: event.place || event.name || event.id, sectionIndex, itemIndex,
        section: section.title || '', description: line.description, quantity: Number(line.quantity), warehouseInventoryId: text(line.warehouseInventoryId) }];
    })));
  }
  function replace(events, change, inventory, options = {}) {
    if (!Array.isArray(events) || !change || typeof change !== 'object') fail('El cambio de equipo no es válido.');
    if (change.compatibilityConfirmed !== true) fail('Confirme que el reemplazo cumple los requerimientos técnicos del evento.');
    if (!Number.isSafeInteger(change.sectionIndex) || change.sectionIndex < 0 || !Number.isSafeInteger(change.itemIndex) || change.itemIndex < 0) fail('Seleccione una línea de equipo válida.');
    const result = copy(events), matching = result.filter(event => event.id === change.eventId);
    if (matching.length !== 1) fail('El evento del cambio ya no está disponible.');
    const event = matching[0], section = event.sections?.[change.sectionIndex], raw = section?.items?.[change.itemIndex], before = asLine(raw);
    if (!before || !text(before.description) || !(Number(before.quantity) > 0) || before.itemType === 'consumible') fail('La línea no es equipo reutilizable con cantidad positiva. Las filas en cero se conservan.');
    const stockRecords = Array.isArray(inventory) ? inventory : list((inventory?.state || inventory)?.items);
    const originalItem = stockRecords.map(record => record?.item || record).find(item => String(item?.id || '') === text(before.warehouseInventoryId));
    if (originalItem && Identity?.itemType?.(originalItem) === 'consumible') fail('Un consumible no se sustituye como equipo reutilizable. Revise su requerimiento por separado.');
    if (event.status === 'confirmed' || event.warehouseDispatchId && event.dispatchedAt) fail('Edite el requerimiento por el flujo de revisión antes de sustituir equipo de un evento confirmado o despachado.');
    const stock = inventoryOptions(inventory).find(item => item.id === text(change.replacementInventoryId));
    if (!stock) fail('Seleccione un equipo reutilizable del inventario vigente, con clasificación revisada.');
    const previousStock = inventoryOptions(inventory).find(item => item.id === text(before.warehouseInventoryId));
    if (previousStock?.id === stock.id) fail('Elija una referencia distinta para la sustitución.');
    if (change.quantity === '' || change.quantity === null || !['number', 'string'].includes(typeof change.quantity)
        || !Number.isFinite(Number(change.quantity)) || !(Number(change.quantity) > 0)) fail('Indique una cantidad de reemplazo mayor que cero.');
    const reason = text(change.reason);
    if (!reason || reason.length > 2000) fail('Describa el motivo y confirme la compatibilidad técnica, hasta 2,000 caracteres.');
    const confirmedAt = options.at || new Date().toISOString();
    if (!/^\d{4}-\d{2}-\d{2}T/.test(confirmedAt) || !Number.isFinite(Date.parse(confirmedAt))) fail('La fecha del cambio no es válida.');
    const next = { ...copy(before), quantity: Number(change.quantity), description: stock.name,
      warehouseInventoryId: stock.id, inventoryCategory: stock.category, itemType: 'equipo',
      inventoryIdentityConfirmed: { itemId: stock.id, description: stock.name, confirmedAt } };
    for (const field of ['procurementChoice', 'procurementPreference', 'inventoryMatchUnresolved', 'inventoryIngressReceipts']) delete next[field];
    section.items[change.itemIndex] = next;
    const operation = { eventId: event.id, sectionIndex: change.sectionIndex, itemIndex: change.itemIndex,
      replacementInventoryId: stock.id, quantity: Number(change.quantity), compatibilityConfirmed: true, reason };
    event.planEquipmentChanges = [...list(event.planEquipmentChanges), { type: 'manual-compatible-replacement', confirmedAt,
      operation, before: copy(raw), after: copy(next), availableAtReview: stock.available,
      pendingAvailability: stock.available === null || stock.available < Number(change.quantity),
      note: 'Compatibilidad confirmada manualmente para este evento; no crea una equivalencia permanente ni modifica la fuente original.' }];
    event.snapshotLocked = true;
    event.documentSections = copy(event.sections);
    return result;
  }
  function validatePatch(event, patch, inventory) {
    if (JSON.stringify(patch.sections) === JSON.stringify(event.sections)
        && (patch.planEquipmentChanges === undefined || JSON.stringify(patch.planEquipmentChanges) === JSON.stringify(list(event.planEquipmentChanges)))) return {};
    if (!Array.isArray(patch.sections) || !Array.isArray(patch.planEquipmentChanges)) fail('El cambio no conserva sus secciones y registro de revisión.');
    const history = list(event.planEquipmentChanges), requested = patch.planEquipmentChanges;
    if (JSON.stringify(requested) === JSON.stringify(history) && JSON.stringify(patch.sections) === JSON.stringify(event.sections)) return {};
    if (requested.length <= history.length || JSON.stringify(requested.slice(0, history.length)) !== JSON.stringify(history)) fail('El historial del cambio ya no corresponde al cuadro actual.');
    let replay = copy(event);
    for (const entry of requested.slice(history.length)) {
      const raw = replay.sections?.[entry?.operation?.sectionIndex]?.items?.[entry?.operation?.itemIndex];
      if (entry?.type !== 'manual-compatible-replacement' || entry.operation?.eventId !== event.id || JSON.stringify(raw) !== JSON.stringify(entry.before)) fail('La línea original cambió. Revise la sustitución antes de aplicar.');
      replay = replace([replay], entry.operation, inventory, { at: entry.confirmedAt })[0];
    }
    // Replaying all accepted edits preserves every untouched source row/cell.
    // Audit availability is informational and may change with a fresh stock read.
    if (JSON.stringify(replay.sections) !== JSON.stringify(patch.sections)) fail('La sustitución contiene otros cambios sin revisar. No se modificó el cuadro.');
    return { sections: copy(replay.sections), documentSections: copy(replay.sections), snapshotLocked: true,
      planEquipmentChanges: copy(replay.planEquipmentChanges) };
  }
  return Object.freeze({ inventoryOptions, options: inventoryOptions, lines, replace, validatePatch });
});
