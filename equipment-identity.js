(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EquipmentIdentity = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  function text(value) { return String(value ?? "").trim(); }
  // Identity never drops a model, measurement, suffix or punctuation. Similar
  // words are useful to offer choices, but are not proof of physical identity.
  function normalizeName(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es-GT").replace(/\s+/g, " ");
  }
  function validStamp(value) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)); }
  function approvedAliases(item) {
    return (Array.isArray(item?.approvedDescriptionAliases) ? item.approvedDescriptionAliases : [])
      .filter((entry) => entry?.approved === true && text(entry.name) && validStamp(entry.approvedAt))
      .map((entry) => text(entry.name));
  }
  function namesFor(item) { return [...new Set([item?.name, ...approvedAliases(item)].map(normalizeName).filter(Boolean))]; }
  function identityConfirmed(line, item) {
    const confirmation = line?.inventoryIdentityConfirmed;
    return confirmation && String(confirmation.itemId) === String(item.id)
      && normalizeName(confirmation.description) === normalizeName(line.description)
      && validStamp(confirmation.confirmedAt);
  }
  function suggestions(description, items, limit = 8) {
    const tokens = normalizeName(description).split(/[^a-z0-9]+/).filter((token) => token.length > 1);
    if (!tokens.length) return [];
    return items.map((item) => {
      const names = normalizeName(item.name).split(/[^a-z0-9]+/);
      return { item, score: tokens.filter((token) => names.includes(token)).length };
    }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || normalizeName(a.item.name).localeCompare(normalizeName(b.item.name)))
      .slice(0, limit).map((entry) => entry.item);
  }
  function resolve(line, rawItems) {
    const items = (Array.isArray(rawItems) ? rawItems : []).filter((item) => item && !item.archived && text(item.id));
    const description = normalizeName(line?.description ?? line?.name);
    const explicitId = text(line?.warehouseInventoryId);
    if (explicitId) {
      const item = items.find((entry) => String(entry.id) === explicitId);
      if (!item) return { status: "stale_id", item: null, candidates: suggestions(description, items) };
      if (normalizeName(item.name) === description) return { status: "id", item, candidates: [item] };
      if (namesFor(item).includes(description)) return { status: "approved_alias", item, candidates: [item] };
      if (identityConfirmed(line, item)) return { status: "confirmed_id", item, candidates: [item] };
      return { status: "identity_conflict", item: null, candidates: [item, ...suggestions(description, items).filter((entry) => entry !== item)] };
    }
    const exact = description ? items.filter((item) => normalizeName(item.name) === description) : [];
    if (exact.length === 1) return { status: "exact", item: exact[0], candidates: exact };
    if (exact.length > 1) return { status: "ambiguous", item: null, candidates: exact };
    const aliases = description ? items.filter((item) => approvedAliases(item).some((name) => normalizeName(name) === description)) : [];
    if (aliases.length === 1) return { status: "approved_alias", item: aliases[0], candidates: aliases };
    if (aliases.length > 1) return { status: "ambiguous", item: null, candidates: aliases };
    return { status: "unmatched", item: null, candidates: suggestions(description, items) };
  }
  function itemType(item) {
    const explicit = text(item?.itemType).toLowerCase();
    if (["equipo", "consumible"].includes(explicit)) return explicit;
    return /(?:^|\s)\/?\s*consumible$/i.test(text(item?.name)) ? "consumible" : "equipo";
  }
  function classificationConfirmed(item) {
    const confirmation = item?.classificationConfirmed;
    return Boolean(confirmation && confirmation.itemType === itemType(item)
      && normalizeName(confirmation.name) === normalizeName(item?.name) && validStamp(confirmation.confirmedAt));
  }
  function classification(item) {
    const currentType = itemType(item);
    const name = normalizeName(item?.name);
    const warnings = [];
    const likelyReusable = /\b(?:extintor|pata de gallo|consola|amplificador|microfono|bocina|soporte|estructura)\b/.test(name);
    const likelyConsumable = /\b(?:gafer|gaffer|marcador|duc tape|duct tape|liquido de humo|liquido de espuma|atomizador|desinfectante|silicon|bolsa jardinera|rollo de tela|cinchos|pirotecnia|monting|mounting)\b/.test(name)
      || /\b(?:rollo|paquete|bolsa|galon)\b.*\b(?:cinta|tape|agua|vinil|espuma|humo|cincho|basura)\b/.test(name);
    const suggestedType = currentType === "consumible" && likelyReusable ? "equipo"
      : currentType === "equipo" && likelyConsumable ? "consumible" : "";
    if (suggestedType && !classificationConfirmed(item)) warnings.push({
      code: "classification_review", suggestedType,
      message: `Revise en Contabilidad si ${text(item?.name)} es ${suggestedType === "consumible" ? "un insumo que se consume y debe comprarse" : "equipo reutilizable"}. Su clasificación actual es ${currentType === "consumible" ? "consumible" : "equipo"}.`
    });
    return { itemType: currentType, pending: warnings.length > 0, warnings, suggestedType,
      confirmed: classificationConfirmed(item) };
  }
  return Object.freeze({ normalizeName, approvedAliases, namesFor, resolve, suggestions, itemType, classification, classificationConfirmed, identityConfirmed });
});
