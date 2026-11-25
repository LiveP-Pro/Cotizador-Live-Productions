"use strict";

// This module reads the current ledger analysis. A truck preparation manifest
// is deliberately not an inventory movement, reservation, or transfer credit.
const Location = require("./equipment-location.js");
const Policy = require("./equipment-route-policy.cjs");
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? "").trim();
const key = (value) => text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
const pairId = (from, to) => `${from}\u0000${to}`;
const epsilon = 1e-9;
const reusable = (row) => Boolean(row.warehouseInventoryId && row.itemType !== "consumible" && !row.procurementChoice
  && !row.preferredPurchase && !row.pendingIdentification && !row.pendingClassification);

function proximity(from, to, route = {}) {
  if (Number.isFinite(route.distanceKm) && route.distanceKm >= 0) return { distanceKm: route.distanceKm, source: "user", label: "Distancia indicada por el usuario; no verifica tráfico." };
  const km = Location.distanceKm(from, to);
  if (Number.isFinite(km)) return { distanceKm: km, source: "coordinates", label: "Distancia en línea recta entre ubicaciones; no es recorrido por carretera ni tiempo de viaje." };
  if (text(from.mapUrl) && text(from.mapUrl) === text(to.mapUrl) || key(from.place) && key(from.place) === key(to.place)) {
    return { distanceKm: null, source: "same-place", label: "Mismo lugar declarado; revise que sea el mismo acceso del evento." };
  }
  return { distanceKm: null, source: "unavailable", label: "Falta una ubicación con coordenadas o una distancia revisada; no se supuso cercanía por el nombre." };
}

function buildPairProfiles(events, rows) {
  const result = new Map();
  const relevant = rows.filter(reusable);
  const vectors = new Map(events.map((event) => [event.id, new Map(relevant.map((row) => [row.warehouseInventoryId, Math.max(0, Number(row.eventQuantities?.[event.id]) || 0)]))]));
  const totals = new Map([...vectors].map(([id, vector]) => [id, [...vector.values()].reduce((sum, value) => sum + value, 0)]));
  for (const from of events) for (const to of events) {
    if (from.id === to.id) continue;
    let shared = 0; let union = 0; let sharedReferences = 0;
    const sharedVector = {}, transferableVector = {}, additionalVector = {}, sourceCoverageByReference = [];
    let sourceReferences = 0, sourceCoverageSum = 0;
    for (const [id, quantity] of vectors.get(from.id)) {
      const next = vectors.get(to.id).get(id) || 0;
      const common = Math.min(quantity, next);
      shared += common; union += Math.max(quantity, next);
      if (quantity > 0) {
        sourceReferences += 1; sourceCoverageSum += common / quantity;
        sourceCoverageByReference.push({ warehouseInventoryId: id, sourceQuantity: quantity, destinationQuantity: next, sharedQuantity: common, coverage: common / quantity });
      }
      if (common > 0) {
        sharedReferences += 1; sharedVector[id] = common;
        const row = relevant.find(entry => entry.warehouseInventoryId === id);
        const capacity = row?.capacity ?? row?.available;
        const own = capacity === undefined ? common : Math.min(common, Math.max(0, Number(capacity) || 0));
        if (own > 0) transferableVector[id] = own;
      }
      if (next > quantity) additionalVector[id] = next - quantity;
    }
    if (!shared) continue;
    result.set(pairId(from.id, to.id), { from, to, sharedQuantity: shared, sharedReferences, sourceReferences,
      sharedVector, transferableVector, additionalVector, sourceCoverageByReference,
      sourceCoverage: sourceReferences ? sourceCoverageSum / sourceReferences : 0,
      sourceReferenceCoverage: sourceReferences ? sharedReferences / sourceReferences : 0,
      similarity: union ? shared / union : 0, destinationCoverage: totals.get(to.id) ? shared / totals.get(to.id) : 0,
      sourceQuantity: totals.get(from.id), destinationQuantity: totals.get(to.id) });
  }
  return result;
}

function routePreferenceCost(profile, route) {
  if (!profile) return 0;
  // Whole-kit destination choice is now enforced before flow. Do not add
  // hidden weighted similarity or straight-line distance penalties.
  return 0;
}

function peakOccupancy(reservations, extra, start, end, localTime) {
  let current = 0; let peak = 0; const points = [];
  const spans = [];
  for (const reservation of reservations) {
    const a = Number.isFinite(reservation.planningStart) ? reservation.planningStart : localTime(reservation.setupAt);
    const b = reservation.awaitingPhysicalReturn || reservation.overdueDispatch ? Infinity : Number.isFinite(reservation.planningEnd)
      ? reservation.planningEnd : localTime(reservation.equipmentInAt) + Math.max(120, Number(reservation.preparationMinutes) || 120) * 60000;
    if (reservation.pendingLogistics || !Number.isFinite(a) || Number.isNaN(b)) return Infinity;
    spans.push({ start: a, end: b, quantity: Math.max(0, Number(reservation.remainingQuantity ?? reservation.quantity) || 0) });
  }
  spans.push(...extra);
  for (const span of spans) {
    if (!(span.quantity > 0) || span.start >= end || span.end <= start) continue;
    points.push({ at: Math.max(start, span.start), change: span.quantity }, { at: Math.min(end, span.end), change: -span.quantity });
  }
  points.sort((a, b) => a.at - b.at);
  for (let index = 0; index < points.length;) {
    const at = points[index].at; let delta = 0;
    while (index < points.length && points[index].at === at) { delta += points[index].change; index += 1; }
    current += delta; peak = Math.max(peak, current);
  }
  return peak;
}

function buildRouteBundles({ events, rows, candidates, options, routePolicy, timingIssues = new Map(), routeTiming, localTime, reservationStartAt, fingerprint }) {
  if (typeof routeTiming !== "function" || typeof localTime !== "function" || typeof reservationStartAt !== "function") return [];
  const profiles = buildPairProfiles(events, rows); const result = [];
  routePolicy ||= Policy.buildRoutePolicy(events, profiles, options, { localTime, reservationStartAt, routeTiming });
  const primary = new Map(routePolicy.primaryDestinations.map(pair => [pair.fromEventId, pair.toEventId]));
  const comparisons = new Map(routePolicy.pairs.map(pair => [pairId(pair.fromEventId, pair.toEventId), pair]));
  for (const profile of profiles.values()) {
    const { from, to } = profile;
    const fromSetup = localTime(reservationStartAt(from)); const toSetup = localTime(reservationStartAt(to));
    // A chronological pair is represented once. Equal or overlapping windows
    // remain visible as blocked alternatives, never as a feasible handoff.
    if (Number.isFinite(fromSetup) && Number.isFinite(toSetup) && (fromSetup > toSetup || fromSetup === toSetup && from.id > to.id)) continue;
    const comparison = comparisons.get(pairId(from.id, to.id));
    if (!comparison?.allowed) continue;
    const timing = routeTiming(from, to, options); const near = proximity(from, to, timing);
    const routeCandidates = candidates.filter((entry) => entry.fromEventId === from.id && entry.toEventId === to.id);
    const commonItems = rows.filter(reusable).flatMap((row) => {
      const quantity = Math.min(Number(row.eventQuantities?.[from.id]) || 0, Number(row.eventQuantities?.[to.id]) || 0);
      if (!(quantity > 0)) return [];
      const candidate = routeCandidates.find((entry) => entry.warehouseInventoryId === row.warehouseInventoryId);
      return [{ warehouseInventoryId: row.warehouseInventoryId, description: row.description, category: row.category,
        quantity, ownTransferQuantity: candidate?.recommendedQuantity ?? candidate?.quantity ?? 0, possibleTransferQuantity: candidate?.quantity || 0, selectedQuantity: candidate?.selectedQuantity || 0,
        transferId: candidate?.id || "", status: candidate?.status || "unavailable" }];
    });
    const schedulePending = Boolean(timingIssues.get(from.id) || timingIssues.get(to.id));
    const status = schedulePending ? "review" : !timing.feasible ? "blocked" : timing.requiresTimeConfirmation || near.source === "unavailable" ? "review" : "ready";
    const reasons = [];
    if (schedulePending) reasons.push("Complete y revise los horarios de ambos eventos; no se supuso una ventana de traslado.");
    else if (!timing.feasible) reasons.push("El evento de origen no deja tiempo suficiente para desmontar, viajar y preparar el siguiente montaje. El equipo no puede estar en ambos lugares a la vez.");
    if (timing.requiresTimeConfirmation) reasons.push("Revise los minutos de viaje y preparación de esta ruta dirigida antes de aplicarla.");
    if (near.source === "unavailable") reasons.push(near.label);
    if (!routeCandidates.length) reasons.push("El plan actual no asigna unidades propias a esta ruta; puede competir con otro evento, una salida o el inventario disponible.");
    const score = Math.round(profile.sourceCoverage * 1000);
    if (routePolicy.ambiguousOrigins.some(entry => entry.fromEventId === from.id)) reasons.push("Hay destinos incomparables o empatados: elija manualmente el destino principal con las referencias y cantidades a la vista.");
    result.push({ id: `draft-bundle-${fingerprint({ from: from.id, to: to.id })}`, fromEventId: from.id, toEventId: to.id,
      fromName: from.name || from.place || from.id, toName: to.name || to.place || to.id, fromPlace: from.place || "", toPlace: to.place || "",
      fromMapUrl: from.mapUrl || "", toMapUrl: to.mapUrl || "", status, recommended: false, score,
      similarity: profile.similarity, sourceCoverage: profile.sourceCoverage, destinationCoverage: profile.destinationCoverage,
      similarityExplanation: "Promedio del porcentaje aprovechable de cada referencia del origen; cada referencia tiene el mismo peso. Las cantidades por equipo se muestran por separado.",
      comparison, fromDate: comparison.fromDate, toDate: comparison.toDate, fromOperation: comparison.fromOperation, toOperation: comparison.toOperation,
      selectionPolicy: "Un destino principal por origen; una división adicional requiere aceptación expresa.",
      sharedEquipmentQuantity: profile.sharedQuantity, sharedReferences: profile.sharedReferences,
      proximity: near, timing, commonItems, preloadItems: [], missingItems: [], reasons,
      recommendedTransferIds: routeCandidates.filter((entry) => entry.status === "ready" && Number(entry.recommendedQuantity ?? entry.quantity) > epsilon).map((entry) => entry.id),
      provisional: true, preloadsApplied: false, productionMutations: 0 });
  }
  result.sort((a, b) => Number(b.status !== "blocked") - Number(a.status !== "blocked") || b.score - a.score
    || a.timing.departureAt.localeCompare(b.timing.departureAt) || a.fromEventId.localeCompare(b.fromEventId) || a.toEventId.localeCompare(b.toEventId));
  const extraHolds = new Map();
  const hasSelection = candidates.some(entry => entry.selected);
  for (const bundle of result) {
    if (bundle.status === "ready" && bundle.recommendedTransferIds.length && primary.get(bundle.fromEventId) === bundle.toEventId) bundle.recommended = true;
    bundle.selected = candidates.some(entry => entry.selected && entry.fromEventId === bundle.fromEventId && entry.toEventId === bundle.toEventId);
    const from = events.find((event) => event.id === bundle.fromEventId); const to = events.find((event) => event.id === bundle.toEventId);
    const reservedStartAt = reservationStartAt(from);
    const plannedOut = localTime(from.equipmentOutAt), setupStart = localTime(reservedStartAt);
    const holdFrom = Number.isFinite(plannedOut) && (!Number.isFinite(setupStart) || plannedOut < setupStart) ? from.equipmentOutAt : reservedStartAt;
    const holdStart = localTime(holdFrom); const holdEnd = localTime(reservationStartAt(to));
    for (const row of rows.filter(reusable)) {
      const common = bundle.commonItems.find(item => item.warehouseInventoryId === row.warehouseInventoryId);
      const carried = hasSelection && bundle.selected ? Number(common?.selectedQuantity) || 0 : bundle.recommended
        ? Number(common?.ownTransferQuantity) || 0 : Math.min(Number(row.eventQuantities?.[to.id]) || 0, Number(row.eventQuantities?.[from.id]) || 0);
      const requested = Math.max(0, (Number(row.eventQuantities?.[to.id]) || 0) - carried);
      if (!requested) continue;
      const allowed = (hasSelection ? bundle.selected : bundle.recommended) && bundle.status === "ready" && !row.pending && !row.hardBlocked && !row.planning?.physicalConflict
        && Number.isFinite(holdStart) && Number.isFinite(holdEnd) && holdEnd > holdStart;
      const reservations = list(row.reservations).filter((entry) => entry.eventId !== to.id);
      const holds = extraHolds.get(row.warehouseInventoryId) || [];
      const peak = allowed ? peakOccupancy(reservations, holds, holdStart, holdEnd, localTime) : Infinity;
      // Current available stock is a second cap: equipment already dispatched
      // elsewhere is not silently considered an extra waiting in this truck.
      const available = allowed ? Math.max(0, Math.min(Number(row.available) || 0, (Number(row.capacity) || 0) - peak)) : 0;
      const quantity = Math.min(requested, available);
      const remaining = Math.max(0, requested - quantity);
      const item = { warehouseInventoryId: row.warehouseInventoryId, description: row.description, category: row.category,
        quantity, requestedQuantity: requested, availableQuantity: quantity, missingQuantity: remaining,
        sourceEventId: from.id, destinationEventId: to.id, holdFrom, holdUntil: reservationStartAt(to),
        status: quantity > epsilon ? "preparation" : "unavailable", validated: false, inventoryChecked: allowed,
        reason: quantity > epsilon ? `Preparar ${quantity} adicional(es) desde ${from.place || from.name || from.id} para ${to.place || to.name || to.id}; el cuadro original no cambia. Debe confirmarse la carga antes de salir.`
          : !bundle.recommended ? "Ruta alternativa: su precarga no se suma a las rutas recomendadas."
            : bundle.status !== "ready" ? "Primero verifique ubicación, horario y minutos de viaje."
              : "No hay unidades propias libres durante todo el intervalo de precarga; revise otra entrega o la renta." };
      bundle.preloadItems.push(item);
      if (quantity > epsilon) {
        holds.push({ start: holdStart, end: holdEnd, quantity }); extraHolds.set(row.warehouseInventoryId, holds);
      }
      if (remaining > epsilon) bundle.missingItems.push({ warehouseInventoryId: row.warehouseInventoryId, description: row.description, quantity: remaining, reason: item.reason });
    }
    bundle.reasons.push("La carga adicional es una recomendación para preparar el camión: no cambia los cuadros originales, no reserva existencias y no reduce la renta.");
  }
  return result;
}
module.exports = { buildPairProfiles, routePreferenceCost, buildRouteBundles, proximity, peakOccupancy };
