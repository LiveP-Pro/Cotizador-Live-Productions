(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.EquipmentTransferPresentation = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // This is a read-only view of the server's decisions. It never selects a
  // route, substitutes equipment, or changes the physical/rental calculation.
  const list = value => Array.isArray(value) ? value : [];
  const text = value => String(value ?? "").trim();
  const pairKey = (from, to) => JSON.stringify([text(from), text(to)]);
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;
  function dominates(a = {}, b = {}, less = false) {
    let strict = false;
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const left = positive(a[id]), right = positive(b[id]);
      if (less ? left > right + 1e-9 : left < right - 1e-9) return false;
      strict ||= Math.abs(left - right) > 1e-9;
    }
    return strict;
  }
  function localDate(value) {
    const raw = text(value);
    if (!raw) return "";
    if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(raw)) {
      const date = raw.slice(0, 10), check = new Date(`${date}T12:00:00Z`);
      return Number.isFinite(check.getTime()) && check.toISOString().slice(0, 10) === date ? date : "";
    }
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guatemala", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = type => parts.find(entry => entry.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }
  function dayLabel(date) {
    if (!date) return "Día pendiente";
    const day = new Intl.DateTimeFormat("es-GT", { timeZone: "UTC", weekday: "long" }).format(new Date(`${date}T12:00:00Z`));
    return `${day} ${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
  }
  function build(input, suppliedEvents) {
    input ||= {};
    const plan = input.draftLogistics || input;
    const events = list(suppliedEvents || input.events || plan.events);
    const byEvent = new Map(events.map(event => [text(event.id), event]));
    const bundles = list(plan.routeBundles), policy = plan.routePolicy || input.logistics?.routePolicy || {};
    const pairs = list(policy.pairs);
    const descriptions = new Map();
    for (const row of [...list(input.rows), ...list(plan.rows)]) if (text(row.warehouseInventoryId)) descriptions.set(text(row.warehouseInventoryId), text(row.description));
    for (const bundle of bundles) for (const item of list(bundle.commonItems)) if (text(item.warehouseInventoryId)) descriptions.set(text(item.warehouseInventoryId), text(item.description));
    const flatten = (routes, confirmed = false) => list(routes).filter(route => route.status !== "cancelled").flatMap(route => {
      const items = Array.isArray(route.items) ? route.items : [route];
      return items.map(item => ({ ...route, ...item, id: route.id || route.transferId || item.transferId || item.id,
        confirmed, fromEventId: text(route.fromEventId), toEventId: text(route.toEventId) }));
    });
    const selected = flatten(input.transferRoutes || plan.selectedTransfers);
    const confirmed = flatten(plan.actualTransfers, true);
    const selectedOrigins = new Set([...selected, ...confirmed].map(route => route.fromEventId));
    const conditionalPairs = pairs.filter(pair => pair.allowed === true && pair.timing?.feasible === true
      && Object.values(pair.transferableVector || {}).some(quantity => positive(quantity)) && !selectedOrigins.has(text(pair.fromEventId)));
    const conditionalDestinations = [];
    for (const origin of new Set(conditionalPairs.map(pair => pair.fromEventId))) {
      const options = conditionalPairs.filter(pair => pair.fromEventId === origin && pair.sourceCoverage !== null && pair.sourceCoverage !== undefined
        && Number.isFinite(Number(pair.sourceCoverage)) && Number(pair.sourceCoverage) >= 0 && Number(pair.sourceCoverage) <= 1);
      const highest = Math.max(...options.map(pair => Number(pair.sourceCoverage)));
      // This is a conditional recommendation by the server's measured source
      // coverage, not a new automatic route policy or an inventory credit.
      // Different physical references may make vectors incomparable; a unique
      // highest percentage still gives the user a useful comparison to review.
      const frontier = options.filter(candidate => Math.abs(Number(candidate.sourceCoverage) - highest) < 1e-9);
      if (frontier.length === 1) conditionalDestinations.push(frontier[0]);
    }
    const conditionalKeys = new Set();
    for (const target of new Set(conditionalDestinations.map(pair => pair.toEventId))) {
      const origins = conditionalDestinations.filter(pair => pair.toEventId === target);
      const frontier = origins.filter(candidate => !origins.some(other => other !== candidate && dominates(other.transferableVector, candidate.transferableVector)));
      // Do not invent an allocation between overlapping or incomparable
      // sources while the server still requires a verified travel plan.
      if (frontier.length === 1) conditionalKeys.add(pairKey(frontier[0].fromEventId, frontier[0].toEventId));
    }
    const selections = new Map(), seenSelections = new Set();
    for (const route of [...selected, ...confirmed]) {
      const id = text(route.warehouseInventoryId || route.itemId);
      if (!id || !positive(route.quantity)) continue;
      const identity = JSON.stringify([route.id || route.transferId || "", route.fromEventId, route.toEventId, id]);
      if (seenSelections.has(identity)) continue;
      seenSelections.add(identity);
      const key = pairKey(route.fromEventId, route.toEventId);
      if (!selections.has(key)) selections.set(key, []);
      selections.get(key).push({ ...route, warehouseInventoryId: id });
    }
    const candidates = new Map();
    for (const [key, routes] of selections) candidates.set(key, { routes, status: routes.every(route => route.confirmed || route.agendaDecision) ? "confirmed" : "selected" });
    for (let bundleIndex = 0; bundleIndex < bundles.length; bundleIndex += 1) {
      const bundle = bundles[bundleIndex], key = pairKey(bundle.fromEventId, bundle.toEventId);
      if (selected.length || selectedOrigins.has(text(bundle.fromEventId)) || bundle.status === "blocked") continue;
      const recommended = bundle.recommended === true;
      // A conditional card uses the server's unique highest source coverage
      // and physical quantity caps. It is not a selection or rental credit.
      const conditional = !recommended && bundle.timing?.feasible === true && conditionalKeys.has(key);
      if (!recommended && !conditional) continue;
      const routes = list(bundle.commonItems).map(item => ({ ...item, quantity: recommended ? positive(item.ownTransferQuantity)
        : positive(bundle.comparison?.transferableVector?.[item.warehouseInventoryId]), fromEventId: bundle.fromEventId, toEventId: bundle.toEventId })).filter(item => item.quantity > 0);
      if (routes.length) candidates.set(key, { bundle, bundleIndex, routes, status: recommended ? "recommended" : "verify" });
    }
    const cards = []; let omitted = false;
    for (const [key, value] of candidates) {
      const route = value.routes[0];
      const bundleIndex = value.bundleIndex ?? bundles.findIndex(entry => pairKey(entry.fromEventId, entry.toEventId) === key);
      const bundle = value.bundle || bundles[bundleIndex] || {};
      const comparison = bundle.comparison || pairs.find(entry => pairKey(entry.fromEventId, entry.toEventId) === key) || {};
      const from = byEvent.get(text(route.fromEventId)) || route.from || {}, to = byEvent.get(text(route.toEventId)) || route.to || {};
      const fromDate = localDate(from.startAt || comparison.fromOperationalAt || bundle.fromDate || comparison.fromDate || from.date);
      const toDate = localDate(to.setupApplies === false ? to.startAt || comparison.toAt || bundle.toDate || comparison.toDate : to.setupAt || comparison.toAt || bundle.toDate || comparison.toDate);
      const difference = fromDate && toDate ? (Date.parse(`${toDate}T00:00Z`) - Date.parse(`${fromDate}T00:00Z`)) / 86400000 : null;
      if (difference === null || difference < 0 || difference > 1 || comparison.allowed === false
        || bundle.timing?.feasible === false || comparison.timing?.feasible === false) { omitted = true; continue; }
      const used = new Map();
      for (const item of value.routes) {
        const id = text(item.warehouseInventoryId), quantity = positive(item.quantity);
        if (!id || !quantity) continue;
        const previous = used.get(id);
        used.set(id, { warehouseInventoryId: id, description: text(item.description) || descriptions.get(id) || id,
          quantity: quantity + (previous?.quantity || 0), transferId: text(item.id || item.transferId),
          ...(text(item.note) ? { note: text(item.note) } : previous?.note ? { note: previous.note } : {}) });
      }
      if (!used.size) continue;
      const unused = Object.entries(comparison.unusedSourceVector || bundle.originComparison?.unusedSourceVector || {}).filter(([, quantity]) => positive(quantity))
        .map(([warehouseInventoryId, quantity]) => ({ warehouseInventoryId, description: descriptions.get(warehouseInventoryId) || warehouseInventoryId, quantity: positive(quantity) }));
      const coverage = bundle.sourceCoverage ?? comparison.sourceCoverage;
      const percentage = coverage !== null && coverage !== undefined && Number.isFinite(Number(coverage)) && Number(coverage) >= 0 && Number(coverage) <= 1
        ? Math.round(Number(coverage) * 1000) / 10 : null;
      const eventLabel = (event, fallbackName, fallbackPlace, fallbackId) => {
        const name = text(event.client || event.name || fallbackName), place = text(event.place || fallbackPlace);
        return name && place && name.toLocaleLowerCase("es") !== place.toLocaleLowerCase("es") ? `${name} · ${place}` : name || place || text(fallbackId);
      };
      const fromLabel = eventLabel(from, bundle.fromName, bundle.fromPlace, route.fromEventId);
      const destination = eventLabel(to, bundle.toName, bundle.toPlace, route.toEventId);
      const toLabel = to.setupApplies !== false && (to.setupAt || comparison.toOperation === "setup" || bundle.toOperation === "setup") ? `Montaje · ${destination}` : destination;
      cards.push({ id: text(bundle.id) || `transfer-${text(route.fromEventId)}-${text(route.toEventId)}`, fromEventId: text(route.fromEventId), toEventId: text(route.toEventId),
        fromLabel, toLabel, fromDate, toDate, fromDayLabel: dayLabel(fromDate), toDayLabel: dayLabel(toDate), percentage,
        percentageLabel: percentage === null ? "Coincidencia pendiente" : `${percentage}%`, status: value.status,
        recommendation: value.status === "verify" ? "Recomendación por coincidencia; verificar traslado." : value.status === "confirmed" ? "Trasiego confirmado." : value.status === "selected" ? "Trasiego elegido para este plan." : "Se recomienda trasegar este equipo al siguiente evento.",
        needsVerification: value.status === "verify" || Boolean(bundle.timing?.requiresTimeConfirmation),
        usedItems: [...used.values()], unusedItems: unused, bundleIndex });
    }
    cards.sort((a, b) => a.fromDate.localeCompare(b.fromDate) || a.toDate.localeCompare(b.toDate) || a.fromEventId.localeCompare(b.fromEventId) || a.toEventId.localeCompare(b.toEventId));
    // Complete each destination once, after every accepted/displayed route has
    // passed the calendar and feasibility guards. These are preparation needs,
    // not rental, purchase, stock movements, or another copy of event demand.
    const demandRows = Array.isArray(plan.rows) ? plan.rows : Array.isArray(input.rows) ? input.rows : null;
    const arrivals = new Map(), arrivalIds = new Set(), provisionalDestinations = new Set();
    for (const card of cards) {
      if (["recommended", "verify"].includes(card.status)) provisionalDestinations.add(card.toEventId);
      for (const item of card.usedItems) {
        const id = text(item.warehouseInventoryId);
        const identity = JSON.stringify([item.transferId || card.id, card.fromEventId, card.toEventId, id]);
        if (!id || arrivalIds.has(identity)) continue;
        arrivalIds.add(identity);
        const key = pairKey(card.toEventId, id);
        arrivals.set(key, (arrivals.get(key) || 0) + positive(item.quantity));
      }
    }
    const completionByDestination = new Map();
    function completionFor(toEventId) {
      if (completionByDestination.has(toEventId)) return completionByDestination.get(toEventId);
      const requirements = new Map();
      function addRequirement(row, fallbackId) {
        const quantity = positive(row.quantity), id = text(row.warehouseInventoryId), rowId = text(row.id) || fallbackId;
        if (!quantity) return;
        const key = id ? `physical:${id}` : `unresolved:${rowId}`;
        const previous = requirements.get(key);
        requirements.set(key, { warehouseInventoryId: id, rowId, description: text(row.description) || id || "Referencia por identificar",
          itemType: row.itemType === "consumible" || row.consumable === true ? "consumible" : "equipo",
          pendingIdentification: !id || row.pendingIdentification === true,
          pendingClassification: row.pendingClassification === true,
          preferredPurchase: row.preferredPurchase === true || row.procurementPreference === "purchase",
          procurementChoice: text(row.procurementChoice), requiredQuantity: quantity + (previous?.requiredQuantity || 0) });
      }
      if (demandRows !== null) {
        demandRows.forEach((row, index) => addRequirement({ ...row, quantity: row.eventQuantities?.[toEventId] }, `row-${index}`));
      } else {
        // Legacy view inputs may lack an analyzed row table. Read only actual
        // requested items, never mirror rows, reference tables, or old data.
        const destination = byEvent.get(toEventId) || {};
        list(destination.sections).forEach((section, sectionIndex) => list(section.items).forEach((raw, itemIndex) => {
          const line = Array.isArray(raw) ? { quantity: raw[0], description: raw[1] } : raw;
          if (line && typeof line === "object") addRequirement(line, `${toEventId}-${sectionIndex}-${itemIndex}`);
        }));
      }
      const items = [...requirements.values()].map(row => {
        // Consumables and unresolved identities cannot be fulfilled by a
        // reusable-unit transfer, even if their descriptions look alike.
        const incomingQuantity = row.warehouseInventoryId && row.itemType !== "consumible" && !row.pendingIdentification
          && !row.pendingClassification && !row.preferredPurchase && !row.procurementChoice
          ? Math.min(row.requiredQuantity, arrivals.get(pairKey(toEventId, row.warehouseInventoryId)) || 0) : 0;
        const quantity = Math.max(0, Number((row.requiredQuantity - incomingQuantity).toPrecision(15)));
        return { ...row, incomingQuantity, quantity };
      }).filter(row => row.quantity > 0);
      const result = { items, provisional: provisionalDestinations.has(toEventId) };
      completionByDestination.set(toEventId, result);
      return result;
    }
    const shownDestinations = new Set();
    for (const card of cards) {
      const completion = completionFor(card.toEventId);
      card.additionalItems = completion.items;
      card.additionalIsProvisional = completion.provisional;
      card.additionalExplanation = completion.provisional ? "Adicional si se realiza el trasiego propuesto." : "";
      card.showAdditionalItems = !shownDestinations.has(card.toEventId);
      shownDestinations.add(card.toEventId);
    }
    const pending = omitted || list(plan.invalidSelections).length || list(policy.ambiguousOrigins).length || bundles.some(bundle => bundle.status === "review")
      || list(plan.pending).length || !cards.length && events.length > 1;
    return { eventCount: byEvent.size, cards, pendingMessage: pending ? cards.length
      ? "Hay otras rutas pendientes de verificar; no se incluyen como trasiegos." : "No hay un trasiego recomendado verificable. Revise horarios, traslado y coincidencias de equipo." : "" };
  }
  return Object.freeze({ build });
});
