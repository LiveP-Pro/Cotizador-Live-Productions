"use strict";

// Business policy is decided for whole kits before per-reference physical
// allocation. Names never participate in routing or tie breaking.
const DAY = 86400000;
const text = value => String(value ?? "").trim();
const pairId = (from, to) => `${from}\u0000${to}`;
const eps = 1e-9;
function localDate(value, localTime) {
  const at = localTime(value);
  return Number.isFinite(at) ? new Date(at - 6 * 3600000).toISOString().slice(0, 10) : "";
}
function neededAt(event) { if (text(event.operationalNeededAt)) return event.operationalNeededAt; return event.setupApplies === false ? event.startAt || event.equipmentOutAt || "" : event.setupAt || event.equipmentOutAt || ""; }
function releasedAt(event, localTime) {
  const end = localTime(event.endAt), teardown = localTime(event.teardownAt);
  return Number.isFinite(end) ? Number.isFinite(teardown) && teardown > end ? event.teardownAt : event.endAt : "";
}
function calendarPair(from, to, localTime) {
  const fromAt = releasedAt(from, localTime), toAt = neededAt(to);
  // The event belongs to its actual event day even if teardown finishes after
  // midnight. Its real release remains the separate physical travel deadline.
  // A Friday montage for a Saturday celebration is a Friday destination and
  // becomes a Saturday source only after that same celebration has finished.
  const fromOperationalAt = from.startAt || neededAt(from);
  const fromDate = localDate(fromOperationalAt, localTime), toDate = localDate(toAt, localTime);
  const difference = fromDate && toDate ? (Date.parse(`${toDate}T00:00Z`) - Date.parse(`${fromDate}T00:00Z`)) / DAY : null;
  const allowed = difference !== null && (difference === 0 || difference === 1);
  return { fromEventId: from.id, toEventId: to.id, fromDate, toDate, fromOperation: "release", toOperation: to.setupApplies === false ? "event" : "setup",
    fromAt, fromOperationalAt, releaseDate: localDate(fromAt, localTime), toAt, dayDifference: difference, allowed,
    reason: difference === null ? "Falta la fecha del evento de origen o del montaje de destino."
      : allowed ? difference === 0 ? "Traslado dentro del mismo día operativo." : "Traslado al día consecutivo, incluyendo el montaje en su fecha real."
        : difference < 0 ? "El destino es anterior a la liberación del origen." : "No se permite saltar días en un trasiego directo; revise la secuencia diaria." };
}
function dominatesVector(a, b, relation = "greater") {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]); let strict = false;
  for (const id of ids) {
    const x = a[id] || 0, y = b[id] || 0;
    if (relation === "greater" ? x < y - eps : x > y + eps) return false;
    if (Math.abs(x - y) > eps) strict = true;
  }
  return strict;
}
function sameVector(a, b) { return !dominatesVector(a, b) && !dominatesVector(b, a) && [...new Set([...Object.keys(a), ...Object.keys(b)])].every(id => Math.abs((a[id] || 0) - (b[id] || 0)) <= eps); }
function better(a, b) {
  const av = a.transferableVector || a.sharedVector, bv = b.transferableVector || b.sharedVector;
  if (dominatesVector(av, bv)) return true;
  if (!sameVector(av, bv)) return false;
  if (dominatesVector(a.additionalVector, b.additionalVector, "less")) return true;
  if (!sameVector(a.additionalVector, b.additionalVector)) return false;
  if (a.timing.requiredMinutes < b.timing.requiredMinutes - eps) return true;
  if (Math.abs(a.timing.requiredMinutes - b.timing.requiredMinutes) > eps) return false;
  // With otherwise identical same-day handoffs, take the first operational
  // opportunity so A→B→C remains possible instead of bypassing B.
  return a.dayDifference === 0 && b.dayDifference === 0 && a.toAt < b.toAt;
}
function limitedVector(vector, remaining) {
  return Object.fromEntries(Object.entries(vector).flatMap(([id, quantity]) => {
    const amount = Math.max(0, Math.min(quantity, remaining[id] || 0));
    return amount > eps ? [[id, amount]] : [];
  }));
}
function physicallyAvailableToSource(profile, id, { localTime, reservationStartAt, events, options }) {
  const capacity = profile.capacityVector?.[id];
  if (capacity === undefined) return Infinity;
  const start = localTime(reservationStartAt(profile.from));
  const end = localTime(releasedAt(profile.from, localTime));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const mandatory = new Map((profile.physicalReservationsByReference?.[id] || []).map(hold => [hold.eventId, hold]));
  for (const event of events) {
    const amount = predicate => (options.transfers || []).filter(transfer => transfer.status !== "cancelled" && predicate(transfer))
      .reduce((sum, transfer) => sum + (transfer.items || []).filter(line => line.warehouseInventoryId === id).reduce((total, line) => total + Math.max(0, Number(line.quantity) || 0), 0), 0);
    const quantity = Math.max(amount(transfer => transfer.fromEventId === event.id), amount(transfer => transfer.toEventId === event.id));
    if (!(quantity > eps)) continue;
    const physical = mandatory.get(event.id);
    const current = (profile.reservationSpansByReference?.[id] || []).find(entry => entry.eventId === event.id);
    mandatory.set(event.id, physical ? { ...physical, quantity: Math.max(physical.quantity, quantity) }
      : { eventId: event.id, quantity, setupAt: reservationStartAt(event), endAt: event.endAt, teardownAt: event.teardownAt,
        planningStart: current?.planningStart, planningEnd: current?.planningEnd });
  }
  const points = [];
  for (const hold of mandatory.values()) {
    if (hold.eventId === profile.from.id || !(hold.quantity > eps)) continue;
    const a = Number.isFinite(hold.planningStart) ? hold.planningStart : localTime(hold.setupAt);
    const b = hold.awaitingPhysicalReturn || hold.overdueDispatch ? Infinity : typeof hold.planningEnd === "number" && !Number.isNaN(hold.planningEnd)
      ? hold.planningEnd : localTime(releasedAt(hold, localTime));
    if (!Number.isFinite(a) || Number.isNaN(b)) return 0;
    if (a >= end || b <= start) continue;
    points.push({ at: Math.max(a, start), delta: hold.quantity }, { at: Math.min(b, end), delta: -hold.quantity });
  }
  points.sort((a, b) => a.at - b.at);
  let current = 0, peak = 0;
  for (let index = 0; index < points.length;) {
    const at = points[index].at; let delta = 0;
    while (index < points.length && points[index].at === at) { delta += points[index].delta; index += 1; }
    current += delta; peak = Math.max(peak, current);
  }
  return Math.max(0, capacity - peak);
}
function buildOriginComparisons(pairs, primaryDestinations) {
  const primary = new Map(primaryDestinations.map(pair => [pair.fromEventId, pair.toEventId]));
  const destinations = [...new Set(pairs.filter(pair => pair.allowed).map(pair => pair.toEventId))].sort();
  const originComparisons = [], incomingAllocations = [];
  for (const toEventId of destinations) {
    const comparisons = pairs.filter(pair => pair.allowed && pair.toEventId === toEventId).map(pair => ({
      fromEventId: pair.fromEventId, toEventId, fromDate: pair.fromDate, toDate: pair.toDate,
      fromOperationalAt: pair.fromOperationalAt, fromAt: pair.fromAt, releaseDate: pair.releaseDate, toAt: pair.toAt,
      sourceCoverage: pair.sourceCoverage, destinationCoverage: pair.destinationCoverage,
      sharedVector: pair.sharedVector, transferableVector: pair.transferableVector, reuseVector: pair.reuseVector,
      sourceVector: pair.sourceVector, destinationVector: pair.destinationVector,
      unusedSourceVector: pair.unusedSourceVector, additionalVector: pair.additionalVector,
      sourceCoverageByReference: pair.sourceCoverageByReference,
      ready: pair.ready, primaryDestination: primary.get(pair.fromEventId) === toEventId,
      timing: pair.timing, quantityByReference: {}, rentalOnlyQuantityByReference: {}, priorityLayer: null, preferred: false,
      reason: !pair.ready ? "Falta verificar la ruta o no hay equipo propio transferible."
        : primary.get(pair.fromEventId) !== toEventId ? "Este origen tiene otro destino principal o requiere elegir su destino manualmente." : ""
    }));
    const pending = comparisons.filter(entry => entry.ready && entry.primaryDestination);
    // Every comparison represents the same destination demand. Never sum it
    // once per source, and subtract only real confirmed incoming transfers.
    const remaining = {};
    for (const pair of pairs.filter(pair => pair.toEventId === toEventId)) for (const [id, quantity] of Object.entries(pair.destinationVector || {})) {
      remaining[id] = Math.max(remaining[id] || 0, quantity - (pair.confirmedIncomingVector?.[id] || 0));
    }
    let layer = 0; const layers = [];
    while (pending.length) {
      const effective = new Map(pending.map(entry => [entry, limitedVector(entry.transferableVector, remaining)]));
      const useful = pending.filter(entry => Object.keys(effective.get(entry)).length);
      if (!useful.length) break;
      const frontier = useful.filter(candidate => !useful.some(other => other !== candidate && dominatesVector(effective.get(other), effective.get(candidate))));
      const covered = {};
      for (const entry of frontier) {
        entry.quantityByReference = effective.get(entry); entry.priorityLayer = layer; entry.preferred = layer === 0;
        entry.reason = layer === 0 ? frontier.length === 1
          ? "Este origen cubre todas las cantidades de cualquier alternativa comparable; se concentra primero su cuadro completo."
          : "Orígenes empatados o complementarios: no se sumaron piezas distintas para inventar una prioridad; la asignación física determina las unidades."
          : "Origen complementario: solo puede aportar las referencias y cantidades que siguen faltando al destino.";
        for (const [id, quantity] of Object.entries(entry.quantityByReference)) covered[id] = (covered[id] || 0) + quantity;
        incomingAllocations.push({ fromEventId: entry.fromEventId, toEventId, quantityByReference: entry.quantityByReference, priorityLayer: layer });
        pending.splice(pending.indexOf(entry), 1);
      }
      layers.push(frontier.map(entry => entry.fromEventId).sort());
      for (const [id, quantity] of Object.entries(covered)) remaining[id] = Math.max(0, (remaining[id] || 0) - quantity);
      layer += 1;
    }
    // The physical fleet solver also tracks units rented for an earlier
    // event. They may cover only the remaining demand, never displace an own
    // kit or become a recommended transfer of nonexistent owned equipment.
    const rentalPending = comparisons.filter(entry => entry.ready && entry.primaryDestination);
    while (rentalPending.length) {
      const effective = new Map(rentalPending.map(entry => [entry, limitedVector(Object.fromEntries(Object.entries(entry.reuseVector || {}).map(([id, quantity]) => [id, Math.max(0, quantity - (entry.quantityByReference[id] || 0))])), remaining)]));
      const useful = rentalPending.filter(entry => Object.keys(effective.get(entry)).length);
      if (!useful.length) break;
      const frontier = useful.filter(candidate => !useful.some(other => other !== candidate && dominatesVector(effective.get(other), effective.get(candidate))));
      const covered = {};
      for (const entry of frontier) {
        entry.rentalOnlyQuantityByReference = effective.get(entry);
        if (entry.priorityLayer === null) entry.priorityLayer = layer;
        entry.reason += " El saldo rentado solo se reutiliza con confirmación del proveedor; no cuenta como existencia propia.";
        let allocation = incomingAllocations.find(value => value.fromEventId === entry.fromEventId && value.toEventId === toEventId);
        if (!allocation) { allocation = { fromEventId: entry.fromEventId, toEventId, quantityByReference: {}, priorityLayer: layer }; incomingAllocations.push(allocation); }
        allocation.quantityByReference = { ...allocation.quantityByReference };
        for (const [id, quantity] of Object.entries(entry.rentalOnlyQuantityByReference)) {
          allocation.quantityByReference[id] = (allocation.quantityByReference[id] || 0) + quantity;
          covered[id] = (covered[id] || 0) + quantity;
        }
        rentalPending.splice(rentalPending.indexOf(entry), 1);
      }
      for (const [id, quantity] of Object.entries(covered)) remaining[id] = Math.max(0, (remaining[id] || 0) - quantity);
      layer += 1;
    }
    for (const entry of pending) {
      if (Object.keys(entry.rentalOnlyQuantityByReference).length) continue;
      entry.reason = "Su equipo ya queda cubierto por un cuadro de origen con más coincidencias; se conserva como alternativa manual sin añadir trabajo automático a bodega.";
      incomingAllocations.push({ fromEventId: entry.fromEventId, toEventId, quantityByReference: {}, priorityLayer: null });
    }
    originComparisons.push({ toEventId, toDate: comparisons[0]?.toDate || "", comparisons, priorityLayers: layers,
      preferredFromEventIds: comparisons.filter(entry => entry.preferred).map(entry => entry.fromEventId).sort(),
      measureLabel: "Se comparan las cantidades de cada referencia. Un cuadro que cubre todas las referencias de otro tiene prioridad; los demás solo aportan el saldo útil." });
  }
  return { originComparisons, incomingAllocations };
}
function buildRoutePolicy(events, profiles, options, { localTime, reservationStartAt, routeTiming }) {
  const days = new Map();
  for (const event of events) {
    const ops = [];
    if (event.setupApplies !== false && text(event.setupAt)) ops.push({ kind: "setup", at: event.setupAt });
    if (text(event.startAt)) ops.push({ kind: "event", at: event.startAt });
    for (const operation of ops) {
      const date = localDate(operation.at, localTime); if (!date) continue;
      if (!days.has(date)) days.set(date, []);
      days.get(date).push({ eventId: event.id, ...operation, place: event.place || "", name: event.name || "Evento" });
    }
  }
  const pairs = [];
  for (const profile of profiles.values()) {
    const pair = calendarPair(profile.from, profile.to, localTime);
    const timing = routeTiming(profile.from, profile.to, options);
    const transferableVector = {}, reuseVector = {}, confirmedIncomingVector = {};
    const fixedQuantity = (id, predicate) => (options.transfers || []).filter(transfer => transfer.status !== "cancelled" && predicate(transfer))
      .reduce((sum, transfer) => sum + (transfer.items || []).filter(line => line.warehouseInventoryId === id).reduce((total, line) => total + Math.max(0, Number(line.quantity) || 0), 0), 0);
    for (const id of Object.keys(profile.destinationVector || {})) {
      const incoming = fixedQuantity(id, transfer => transfer.toEventId === profile.to.id);
      if (incoming > eps) confirmedIncomingVector[id] = incoming;
    }
    for (const entry of profile.sourceCoverageByReference || []) {
      const id = entry.warehouseInventoryId;
      const outgoing = fixedQuantity(id, transfer => transfer.fromEventId === profile.from.id);
      const incoming = confirmedIncomingVector[id] || 0;
      const reusable = Math.max(0, Math.min(entry.sourceQuantity - outgoing, entry.destinationQuantity - incoming));
      if (reusable > eps) reuseVector[id] = reusable;
      const amount = Math.max(0, Math.min(entry.sourceQuantity - outgoing, entry.destinationQuantity - incoming,
        (profile.transferableVector || profile.sharedVector)[id] || 0,
        physicallyAvailableToSource(profile, id, { localTime, reservationStartAt, events, options })));
      if (amount > eps) transferableVector[id] = amount;
    }
    const ready = pair.allowed && timing.feasible && !timing.requiresTimeConfirmation
      && [profile.from, profile.to].every(event => [reservationStartAt(event), event.startAt, event.endAt, event.equipmentInAt].every(value => Number.isFinite(localTime(value))))
      && Object.entries(profile.transferableVector || profile.sharedVector).some(([id, quantity]) => quantity > eps && (reuseVector[id] || 0) > eps);
    pairs.push({ ...pair, reservationDeadline: reservationStartAt(profile.to), ready, timing,
      sharedVector: profile.sharedVector, transferableVector, reuseVector, additionalVector: profile.additionalVector,
      sourceVector: profile.sourceVector, destinationVector: profile.destinationVector, unusedSourceVector: profile.unusedSourceVector, confirmedIncomingVector,
      sourceCoverage: profile.sourceCoverage, destinationCoverage: profile.destinationCoverage,
      sharedReferences: profile.sharedReferences, sourceReferences: profile.sourceReferences,
      sourceReferenceCoverage: profile.sourceReferenceCoverage,
      sourceCoverageByReference: profile.sourceCoverageByReference,
      measureLabel: "Coincidencia por referencia: cantidad compartida / cantidad del origen; las referencias distintas no se ponderan como piezas equivalentes." });
  }
  const primaryDestinations = []; const ambiguousOrigins = [];
  for (const event of events) {
    const ready = pairs.filter(pair => pair.fromEventId === event.id && pair.ready);
    if (!ready.length) continue;
    const frontier = ready.filter(candidate => !ready.some(other => other !== candidate && better(other, candidate)));
    if (frontier.length === 1) primaryDestinations.push({ fromEventId: event.id, toEventId: frontier[0].toEventId });
    else ambiguousOrigins.push({ fromEventId: event.id, toEventIds: frontier.map(pair => pair.toEventId).sort(),
      reason: "Hay alternativas incomparables o empatadas. Revise referencias, cantidades y preparación adicional para elegir un destino; no se asignó por nombre u orden de las hojas." });
  }
  const exceptions = [];
  for (const transfer of options.transfers || []) {
    if (transfer.status === "cancelled") continue;
    const from = events.find(event => event.id === transfer.fromEventId), to = events.find(event => event.id === transfer.toEventId);
    if (!from || !to) continue;
    const pair = calendarPair(from, to, localTime);
    if (!pair.allowed) exceptions.push({ transferId: transfer.id, ...pair, code: "confirmed_policy_exception", preserved: !transfer.provisional,
      reason: `${transfer.provisional ? "Trasiego provisional pendiente de corrección" : "Trasiego previamente confirmado conservado"}: ${pair.reason}` });
  }
  const byOrigin = new Map();
  for (const transfer of options.transfers || []) if (transfer.status !== "cancelled") {
    if (!byOrigin.has(transfer.fromEventId)) byOrigin.set(transfer.fromEventId, new Set());
    byOrigin.get(transfer.fromEventId).add(transfer.toEventId);
  }
  for (const [fromEventId, destinations] of byOrigin) {
    const index = primaryDestinations.findIndex(pair => pair.fromEventId === fromEventId);
    if (index >= 0) primaryDestinations.splice(index, 1);
    if (destinations.size === 1) primaryDestinations.push({ fromEventId, toEventId: [...destinations][0], confirmed: true });
    else {
      const provisional = (options.transfers || []).some(transfer => transfer.status !== "cancelled" && transfer.fromEventId === fromEventId && transfer.provisional);
      exceptions.push({ fromEventId, toEventIds: [...destinations].sort(), code: provisional ? "provisional_split_accepted" : "confirmed_split_preserved", preserved: !provisional,
        reason: provisional ? "División aceptada para este plan provisional; no constituye una reserva ni un movimiento físico."
          : "Se conserva una división de equipo ya confirmada; no se generaron destinos adicionales automáticamente." });
    }
  }
  const incoming = buildOriginComparisons(pairs, primaryDestinations);
  return { version: "consecutive-kit-v1", originComparisonVersion: "whole-kit-origins-v1", operationalCalendar: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, operations]) => ({ date,
    operations: operations.sort((a, b) => localTime(a.at) - localTime(b.at) || a.eventId.localeCompare(b.eventId) || a.kind.localeCompare(b.kind)) })),
    pairs, primaryDestinations, ambiguousOrigins, exceptions, ...incoming };
}
module.exports = { buildRoutePolicy, calendarPair, localDate, neededAt, releasedAt, better, sameVector, pairId, buildOriginComparisons };
