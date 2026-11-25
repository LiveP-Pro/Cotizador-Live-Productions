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
  const fromDate = localDate(fromAt, localTime), toDate = localDate(toAt, localTime);
  const difference = fromDate && toDate ? (Date.parse(`${toDate}T00:00Z`) - Date.parse(`${fromDate}T00:00Z`)) / DAY : null;
  const allowed = difference !== null && (difference === 0 || difference === 1);
  return { fromEventId: from.id, toEventId: to.id, fromDate, toDate, fromOperation: "release", toOperation: to.setupApplies === false ? "event" : "setup",
    fromAt, toAt, dayDifference: difference, allowed,
    reason: difference === null ? "Falta la fecha de liberación o del montaje de destino."
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
    const transferableVector = {};
    for (const entry of profile.sourceCoverageByReference || []) {
      const id = entry.warehouseInventoryId;
      const fixedQuantity = (predicate) => (options.transfers || []).filter(transfer => transfer.status !== "cancelled" && predicate(transfer))
        .reduce((sum, transfer) => sum + (transfer.items || []).filter(line => line.warehouseInventoryId === id).reduce((total, line) => total + Math.max(0, Number(line.quantity) || 0), 0), 0);
      const outgoing = fixedQuantity(transfer => transfer.fromEventId === profile.from.id);
      const incoming = fixedQuantity(transfer => transfer.toEventId === profile.to.id);
      const amount = Math.max(0, Math.min(entry.sourceQuantity - outgoing, entry.destinationQuantity - incoming,
        (profile.transferableVector || profile.sharedVector)[id] || 0));
      if (amount > eps) transferableVector[id] = amount;
    }
    const ready = pair.allowed && timing.feasible && !timing.requiresTimeConfirmation
      && [profile.from, profile.to].every(event => [reservationStartAt(event), event.startAt, event.endAt, event.equipmentInAt].every(value => Number.isFinite(localTime(value))))
      && Object.values(transferableVector).some(quantity => quantity > eps);
    pairs.push({ ...pair, reservationDeadline: reservationStartAt(profile.to), ready, timing,
      sharedVector: profile.sharedVector, transferableVector, additionalVector: profile.additionalVector,
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
  return { version: "consecutive-kit-v1", operationalCalendar: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, operations]) => ({ date,
    operations: operations.sort((a, b) => localTime(a.at) - localTime(b.at) || a.eventId.localeCompare(b.eventId) || a.kind.localeCompare(b.kind)) })),
    pairs, primaryDestinations, ambiguousOrigins, exceptions };
}
module.exports = { buildRoutePolicy, calendarPair, localDate, neededAt, releasedAt, better, sameVector, pairId };
