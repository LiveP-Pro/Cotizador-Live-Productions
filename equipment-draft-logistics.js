(function (root, factory) {
  "use strict";
  const api = factory(typeof module === "object" && module.exports ? () => require("./equipment-event-store.cjs") : null);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EquipmentDraftLogistics = api;
})(typeof globalThis === "object" ? globalThis : this, function (getEngine) {
  "use strict";

  const list = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "").trim();
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const invalid = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
  const validId = (value) => /^[A-Za-z0-9][A-Za-z0-9_-]{0,239}$/.test(String(value ?? ""));
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((name) => `${JSON.stringify(name)}:${stable(value[name])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  // These keys identify a recomputed proposal. They are never authorization:
  // the server resolves them against the current ledger on every analysis.
  function fingerprint(value) {
    const literal = stable(value); const seeds = [2166136261, 2246822519, 3266489917, 668265263];
    return seeds.map((seed) => {
      let result = seed;
      for (let index = 0; index < literal.length; index += 1) result = Math.imul(result ^ literal.charCodeAt(index), 16777619);
      return (result >>> 0).toString(16).padStart(8, "0");
    }).join("");
  }
  function routeIdentity(route) {
    return { warehouseInventoryId: text(route.warehouseInventoryId), fromEventId: text(route.fromEventId), toEventId: text(route.toEventId),
      quantity: Number(route.quantity), fromPlace: text(route.fromPlace), toPlace: text(route.toPlace),
      departureAt: text(route.departureAt), setupAt: text(route.setupAt), travelMinutes: Number(route.travelMinutes), handlingMinutes: Number(route.handlingMinutes) };
  }
  function routeId(route) { return `draft-transfer-${fingerprint(routeIdentity(route))}`; }
  function scheduleIssue(event, engine) {
    if (event.setupApplies === false && text(event.setupAt)) return "El evento indica que no aplica montaje y conserva un horario de montaje. Revise ambos datos.";
    if (text(event.equipmentOutAt) && !Number.isFinite(engine.localTime(event.equipmentOutAt))) return "Corrija la fecha y hora de salida de bodega antes de calcular la carga o el trasiego.";
    if (text(event.teardownAt)) {
      const teardown = engine.localTime(event.teardownAt), end = engine.localTime(event.endAt), returned = engine.localTime(event.equipmentInAt);
      if (!Number.isFinite(teardown)) return "Corrija la fecha y hora de desmontaje programado antes de calcular el trasiego.";
      if (Number.isFinite(end) && teardown < end || Number.isFinite(returned) && teardown > returned) return "El desmontaje programado debe quedar después de la finalización y antes del regreso a bodega.";
    }
    const fields = [event.setupApplies === false ? "startAt" : "setupAt", "startAt", "endAt", ...(text(event.teardownAt) ? ["teardownAt"] : []), "equipmentInAt"];
    const values = [...new Set(fields)].map((field) => engine.localTime(event[field]));
    if (values.some((value) => !Number.isFinite(value))) return "Complete o corrija montaje, inicio, finalización y regreso a bodega antes de calcular reutilización. No se inventó ningún horario.";
    if (values.some((value, index) => index && value < values[index - 1])) return "Revise el orden de montaje, inicio, finalización y regreso a bodega.";
    return "";
  }
  function normalizeInput(events, inventory, engine) {
    if (!Array.isArray(events)) throw invalid("Los eventos del plan deben ser una lista.");
    if (!inventory || typeof inventory !== "object" || !Array.isArray((inventory.state || inventory).items)) throw invalid("No se pudo consultar el inventario vigente de Contabilidad de Equipo.", 503);
    const ids = new Set(); const documents = new Set(); const active = [];
    for (const raw of events) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("Hay un evento que no se puede leer.");
      if (raw.status === "cancelled") continue;
      if (typeof raw.id !== "string" || !validId(raw.id) || ids.has(raw.id)) throw invalid("Los eventos necesitan identificadores válidos y únicos. No se duplicó ninguna reserva ni crédito de inventario.");
      ids.add(raw.id);
      const dispatchId = text(raw.warehouseDispatchId);
      if (dispatchId && documents.has(dispatchId)) throw invalid("La misma salida de bodega aparece en más de un evento. Corrija el vínculo para no descontar dos veces el mismo consumo o acreditar dos veces el equipo.");
      if (dispatchId) documents.add(dispatchId);
      // Validate source lines independently from incomplete schedules. Every
      // literal field remains in active; only the calculation copy is altered.
      engine.normalizeEvent(raw.id, { ...copy(raw), setupAt: "", startAt: "", endAt: "", teardownAt: "", equipmentInAt: "", equipmentOutAt: "" });
      active.push(copy(raw));
    }
    const inventoryIds = new Set();
    for (const item of (inventory.state || inventory).items) {
      if (!item || item.archived) continue;
      const id = text(item.id);
      if (!id || inventoryIds.has(id) || item.quantity === "" || item.quantity === null || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 0) throw invalid("El inventario vigente tiene una referencia repetida o una cantidad no verificable. Revíselo en Contabilidad de Equipo.", 503);
      inventoryIds.add(id);
    }
    return active;
  }
  function selectedIds(raw) {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.some((value) => typeof value !== "string" || !/^draft-transfer-[a-f0-9]{32}$/.test(value))) throw invalid("La selección de trasiegos no es válida. Vuelva a generar la lista.");
    if (new Set(raw).size !== raw.length) throw invalid("Hay trasiegos repetidos en la selección.");
    return [...raw];
  }
  function routeTransfer(candidate) {
    return { id: candidate.id, fromEventId: candidate.fromEventId, toEventId: candidate.toEventId,
      items: [{ warehouseInventoryId: candidate.warehouseInventoryId, quantity: candidate.quantity }],
      ...(candidate.note ? { note: candidate.note } : {}), travelMinutes: candidate.travelMinutes, handlingMinutes: candidate.handlingMinutes, status: "confirmed", provisional: true };
  }
  function create(dependencies = {}) {
    function engineForCall() {
      const engine = typeof getEngine === "function" ? getEngine() : {};
      const result = { ...engine, ...dependencies };
      result.calculateAvailability ||= result.calculateEquipmentAvailability;
      if (typeof result.calculateAvailability !== "function" || typeof result.normalizeEvent !== "function" || typeof result.localTime !== "function") throw invalid("El cálculo debe consultarse en el servidor con el inventario vigente. Los eventos se conservan.", 503);
      return result;
    }
    function analyze(events, inventory, rawOptions = {}) {
      const engine = engineForCall();
      if (!rawOptions || typeof rawOptions !== "object" || Array.isArray(rawOptions)) throw invalid("Las opciones del plan no son válidas.");
      const options = engine.normalizeEquipmentLogisticsOptions ? engine.normalizeEquipmentLogisticsOptions(rawOptions) : { ...rawOptions };
      let requestedIds = selectedIds(options.selectedTransferIds);
      if (options.transferEdits !== undefined && !Array.isArray(options.transferEdits)) throw invalid("Las cantidades editadas de trasiego deben ser una lista.");
      const transferEdits = new Map();
      for (const edit of options.transferEdits || []) {
        if (!edit || typeof edit.id !== "string" || !/^draft-transfer-[a-f0-9]{32}$/.test(edit.id) || transferEdits.has(edit.id)
            || edit.quantity === "" || edit.quantity === null || !["number", "string"].includes(typeof edit.quantity)
            || !Number.isFinite(Number(edit.quantity)) || Number(edit.quantity) < 0 || typeof edit.note !== "undefined" && typeof edit.note !== "string"
            || text(edit.note).length > 2000) throw invalid("Revise la cantidad y la nota del trasiego editado. No se aplicó ningún cambio.");
        transferEdits.set(edit.id, { id: edit.id, quantity: Number(edit.quantity), note: text(edit.note) });
      }
      requestedIds = requestedIds.filter((id) => transferEdits.get(id)?.quantity !== 0);
      if (options.transfers !== undefined && !Array.isArray(options.transfers)) throw invalid("El historial de trasiegos no es válido.");
      const actualTransfers = copy(options.transfers || []);
      if (options.inventoryBlockReasons !== undefined && !Array.isArray(options.inventoryBlockReasons)) throw invalid("Las advertencias del inventario no son válidas.");
      const inventoryBlocks = new Map();
      for (const entry of options.inventoryBlockReasons || []) {
        if (!entry || !text(entry.warehouseInventoryId) || !text(entry.reason)) throw invalid("Una advertencia del inventario no tiene referencia o motivo.");
        inventoryBlocks.set(text(entry.warehouseInventoryId), text(entry.reason));
      }
      const globalInventoryBlockReason = text(options.globalInventoryBlockReason);
      const originalEvents = normalizeInput(events, inventory, engine);
      const timingIssues = new Map(originalEvents.map((event) => [event.id, scheduleIssue(event, engine)]));
      const calculationEvents = originalEvents.map((event) => timingIssues.get(event.id)
        ? { ...event, setupAt: "", startAt: "", endAt: "", teardownAt: "", equipmentInAt: "", equipmentOutAt: "" } : event);
      const calculationOptions = { transfers: actualTransfers, routeEstimates: options.routeEstimates || [],
        ...(options.now === undefined ? {} : { now: options.now }) };
      const baseline = engine.calculateAvailability(calculationEvents, inventory, calculationOptions);
      const baselineById = new Map(baseline.rows.map((row) => [row.id, row]));
      const candidates = []; const identities = new Map();
      for (const row of baseline.rows) {
        const related = row.events.map((entry) => originalEvents.find((event) => event.id === entry.eventId)).filter(Boolean);
        if (row.itemType === "consumible" || row.procurementChoice || row.preferredPurchase || row.pendingIdentification || row.pendingClassification
            || row.planning?.optimal === false || inventoryBlocks.has(row.warehouseInventoryId) || globalInventoryBlockReason
            || related.some((event) => timingIssues.get(event.id) || !text(event.place))) continue;
        for (const route of list(row.planning?.routes)) {
          if (!text(row.warehouseInventoryId) || !(Number(route.quantity) > 0)) continue;
          const proposal = { ...copy(route), warehouseInventoryId: row.warehouseInventoryId };
          const id = routeId(proposal); const canonical = stable(routeIdentity(proposal));
          if (identities.has(id) && identities.get(id) !== canonical) throw invalid("No se pudieron distinguir dos propuestas de trasiego. No se aplicó la selección.", 503);
          if (identities.has(id)) continue;
          identities.set(id, canonical);
          const requiresManualReview = Boolean(route.requiresTimeConfirmation);
          candidates.push({ ...proposal, id, rowId: row.id, description: row.description, category: row.category,
            releaseAt: route.departureAt || "", arriveAt: route.arrivalAt || "", requiresManualReview,
            status: requiresManualReview ? "review" : "ready", reasons: requiresManualReview ? ["Revise y guarde los minutos de transporte, desmontaje y preparación para este origen y destino antes de aplicar el trasiego."] : [],
            maxQuantity: proposal.quantity, selectedQuantity: 0, requestedQuantity: transferEdits.get(id)?.quantity ?? proposal.quantity,
            note: transferEdits.get(id)?.note || "", requested: requestedIds.includes(id), selected: false, provisional: true });
        }
      }
      candidates.sort((a, b) => text(a.departureAt).localeCompare(text(b.departureAt)) || text(a.fromEventId).localeCompare(text(b.fromEventId))
        || text(a.toEventId).localeCompare(text(b.toEventId)) || text(a.warehouseInventoryId).localeCompare(text(b.warehouseInventoryId)));
      const snapshotId = `draft-snapshot-${fingerprint({ events: originalEvents, inventory, transfers: actualTransfers,
        routeEstimates: calculationOptions.routeEstimates, candidates: candidates.map((candidate) => ({ id: candidate.id, requiresManualReview: candidate.requiresManualReview })),
        baseline: baseline.rows.map((row) => ({ id: row.id, available: row.available, capacity: row.capacity, required: row.required, pendingLogistics: row.pendingLogistics, physicalConflict: row.planning?.physicalConflict })) })}`;
      const staleSelection = Boolean(requestedIds.length && options.expectedSnapshotId && options.expectedSnapshotId !== snapshotId);
      const byCandidateId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
      const invalidSelections = [];
      for (const [id, edit] of transferEdits) {
        const candidate = byCandidateId.get(id);
        if (candidate && edit.quantity > candidate.maxQuantity) throw invalid(`La cantidad editada supera el máximo comprobado (${candidate.maxQuantity}) para ${candidate.description}. No se aplicó ningún cambio.`, 409);
        if (!candidate && edit.quantity > 0 && !requestedIds.includes(id)) invalidSelections.push({ id, rowId: "", warehouseInventoryId: "", code: "proposal_unavailable", message: "Una edición ya no corresponde a las propuestas actuales. Revise la lista antes de aplicar los cambios." });
      }
      let selected = [];
      for (const id of requestedIds) {
        const candidate = byCandidateId.get(id);
        if (candidate && transferEdits.get(id)?.quantity === 0) continue;
        const code = staleSelection ? "stale_snapshot" : !candidate ? "proposal_unavailable" : candidate.requiresManualReview ? "time_review_required" : "";
        if (code) invalidSelections.push({ id, rowId: candidate?.rowId || "", warehouseInventoryId: candidate?.warehouseInventoryId || "", code,
          message: code === "stale_snapshot" ? "El inventario o los eventos cambiaron. Revise la lista actual y vuelva a aplicar la selección."
            : code === "time_review_required" ? candidate.reasons[0] : "Esta propuesta ya no corresponde al inventario, cantidades u horarios actuales. Vuelva a generar el listado." });
        else if ((transferEdits.get(id)?.quantity ?? candidate.quantity) > 0) selected.push({ ...candidate,
          quantity: transferEdits.get(id)?.quantity ?? candidate.quantity, note: transferEdits.get(id)?.note || "" });
      }
      function calculateSelection() {
        return selected.length ? engine.calculateAvailability(calculationEvents, inventory, { ...calculationOptions,
          transfers: [...actualTransfers, ...selected.map(routeTransfer)] }) : baseline;
      }
      let scenario = calculateSelection();
      const invalidTemporaryIds = new Set(list(scenario.invalidTransfers).map((entry) => entry.id));
      const conflictingItemIds = new Set(scenario.rows.filter((row) => row.planning?.physicalConflict).map((row) => row.warehouseInventoryId));
      const rejected = selected.filter((candidate) => invalidTemporaryIds.has(candidate.id) || conflictingItemIds.has(candidate.warehouseInventoryId));
      if (rejected.length) {
        for (const candidate of rejected) invalidSelections.push({ id: candidate.id, rowId: candidate.rowId, warehouseInventoryId: candidate.warehouseInventoryId,
          code: "physical_conflict", message: "La selección no cabe en las existencias físicas actuales o contradice otra ruta. No se descontó esa cantidad de la renta." });
        const rejectedIds = new Set(rejected.map((candidate) => candidate.id)); selected = selected.filter((candidate) => !rejectedIds.has(candidate.id));
        scenario = calculateSelection();
      }
      const appliedIds = new Set(selected.map((candidate) => candidate.id));
      for (const candidate of candidates) {
        candidate.selected = appliedIds.has(candidate.id);
        candidate.selectedQuantity = selected.find((entry) => entry.id === candidate.id)?.quantity || 0;
      }
      const unresolvedSelection = invalidSelections.some((entry) => !entry.rowId);
      const selectionProblemsByRow = new Map();
      for (const entry of invalidSelections) if (entry.rowId) {
        if (!selectionProblemsByRow.has(entry.rowId)) selectionProblemsByRow.set(entry.rowId, []);
        selectionProblemsByRow.get(entry.rowId).push(entry.message);
      }
      const actualProblemsByItem = new Map();
      for (const [itemId, reason] of inventoryBlocks) actualProblemsByItem.set(itemId, reason);
      for (const entry of list(baseline.invalidTransfers)) {
        const transfer = actualTransfers.find((route) => route.id === entry.id);
        for (const line of list(transfer?.items)) actualProblemsByItem.set(text(line.warehouseInventoryId), entry.message);
      }
      const pending = [];
      const rows = scenario.rows.map((row) => {
        const before = baselineById.get(row.id) || row;
        const demand = Number(row.quantity); const empty = demand === 0;
        const consumable = row.itemType === "consumible";
        const explicitPurchase = row.procurementChoice === "purchase";
        const calendarNeeded = !consumable && !explicitPurchase;
        const related = row.events.map((entry) => originalEvents.find((event) => event.id === entry.eventId)).filter(Boolean);
        const timingPending = !empty && calendarNeeded && related.some((event) => timingIssues.get(event.id));
        const reasons = [];
        if (!empty && row.pendingIdentification) reasons.push("Identifique esta referencia en el inventario vigente. Una identidad pendiente no significa existencia cero.");
        if (!empty && row.pendingClassification) reasons.push(...list(row.classificationWarnings).map((warning) => warning.message || String(warning)));
        if (!empty && row.procurementChoice === "save") reasons.push("El ingreso a Contabilidad de Equipo sigue pendiente.");
        if (!empty && calendarNeeded) for (const event of related) if (timingIssues.get(event.id)) reasons.push(`${event.place || event.name || event.id}: ${timingIssues.get(event.id)}`);
        if (!empty && calendarNeeded && related.some((event) => !text(event.place))) reasons.push("Falta la ubicación de un evento. No se propone un trasiego para esa referencia hasta completar el lugar.");
        if (!empty && actualProblemsByItem.has(row.warehouseInventoryId)) reasons.push(actualProblemsByItem.get(row.warehouseInventoryId));
        if (!empty && globalInventoryBlockReason) reasons.push(globalInventoryBlockReason);
        if (!empty && row.planning?.physicalConflict) reasons.push("Las salidas o rutas físicas registradas exceden las existencias actuales. Revise esos movimientos antes de cerrar el pedido.");
        if (!empty && calendarNeeded && unresolvedSelection) reasons.push("Hay una selección anterior que ya no se pudo verificar. Revise y aplique nuevamente el listado de trasiegos.");
        if (!empty) reasons.push(...(selectionProblemsByRow.get(row.id) || []));
        if (!empty && consumable && row.procurementChoice === "rent") reasons.push("El artículo es consumible y está marcado para renta. Revise la decisión antes de emitir una compra.");
        const remainingConsumption = consumable ? Math.max(0, Number(row.planning?.requiredFleet ?? list(row.reservations).reduce((sum, reservation) => sum + reservation.remainingQuantity, 0))) : null;
        const alreadyConsumed = consumable ? Math.max(0, demand - remainingConsumption) : 0;
        const remainingDemand = consumable ? remainingConsumption : demand;
        let rawRequired = consumable || explicitPurchase ? Math.max(0, Number(row.planning?.requiredFleet ?? remainingDemand)) : Number(row.required);
        let rawBaseline = consumable || explicitPurchase ? Math.max(0, Number(before.planning?.requiredFleet ?? remainingDemand)) : Number(before.required);
        const hardBlocked = !empty && Boolean(row.pendingIdentification || row.pendingClassification || row.procurementChoice === "save"
          || actualProblemsByItem.has(row.warehouseInventoryId) || globalInventoryBlockReason || row.planning?.physicalConflict
          || calendarNeeded && unresolvedSelection || (selectionProblemsByRow.get(row.id) || []).length
          || consumable && row.procurementChoice === "rent");
        const blocked = !empty && (hardBlocked || timingPending);
        const rentalProvisional = timingPending && !hardBlocked;
        if (rentalProvisional) {
          // Missing dates do not make a known unit's demand disappear. Keep a
          // conservative numerical upper bound while refusing all reuse and
          // handoff claims. This remains visibly provisional, never reserved.
          rawRequired = Math.max(remainingDemand, rawRequired, rawBaseline);
          rawBaseline = rawRequired;
        }
        const required = empty ? 0 : hardBlocked ? null : rawRequired;
        const baselineRequired = empty ? 0 : hardBlocked ? null : rawBaseline;
        const capacity = row.pendingIdentification || row.pendingClassification || row.procurementChoice === "save" ? null : Number(row.capacity);
        const available = row.external && !["rent", "purchase"].includes(row.procurementChoice) ? null : Number(row.available);
        const shortage = empty ? 0 : hardBlocked || capacity === null ? null : Math.max(0, required - capacity);
        const purchaseDecision = consumable || explicitPurchase || row.preferredPurchase;
        const rental = shortage === null ? null : purchaseDecision ? 0 : shortage;
        const purchase = shortage === null ? null : purchaseDecision ? shortage : 0;
        const selectedTransferReduction = required === null ? null : baselineRequired - required;
        const action = empty ? "SIN USO (0)" : row.pendingIdentification ? "IDENTIFICAR EQUIPO" : row.pendingClassification ? "REVISAR CLASIFICACIÓN"
          : row.procurementChoice === "save" ? "INGRESO PENDIENTE" : hardBlocked ? "PENDIENTE" : purchase > 0 ? "COMPRA" : rental > 0 ? "RENTA" : rentalProvisional ? "PENDIENTE" : "CUBIERTO";
        const result = { ...row, demand, available, capacity, ownedCapacity: capacity, remainingDemand, remainingConsumption, alreadyConsumed,
          baselineRequired, requiredBeforeTransfers: baselineRequired, required, remainingRequired: required, shortage, missing: shortage, rental, purchase, action,
          selectedTransferReduction, reusedUnits: selectedTransferReduction === null ? null : Math.max(0, selectedTransferReduction),
          additionalHoldUnits: selectedTransferReduction === null ? null : Math.max(0, -selectedTransferReduction),
          warehouseReuseReduction: baselineRequired === null ? null : remainingDemand - baselineRequired,
          totalReuseReduction: required === null ? null : remainingDemand - required,
          pending: blocked, rentalProvisional, hardBlocked, pendingLogistics: timingPending || Boolean(row.pendingLogistics), reasons: [...new Set(reasons)], reason: [...new Set(reasons)].join(" "),
          selectedTransferIds: selected.filter((candidate) => candidate.rowId === row.id).map((candidate) => candidate.id),
          candidates: candidates.filter((candidate) => candidate.rowId === row.id), provisional: true };
        if (blocked) pending.push({ rowId: row.id, warehouseInventoryId: row.warehouseInventoryId, description: row.description, quantity: demand, reasons: result.reasons });
        return result;
      });
      const rental = rows.filter((row) => row.rental > 0); const purchase = rows.filter((row) => row.purchase > 0);
      const bundles = typeof engine.buildEquipmentRouteBundles === "function" ? engine.buildEquipmentRouteBundles({
        events: originalEvents, rows, candidates, options: calculationOptions, timingIssues, routeTiming: engine.logisticsRouteTiming,
        localTime: engine.localTime, reservationStartAt: engine.eventReservationStartAt, fingerprint
      }) : [];

      return { events: originalEvents, rows, candidates, selectedTransfers: selected.map((candidate) => ({ ...candidate, selected: true, transfer: routeTransfer(candidate) })),
        routeBundles: bundles, preloadsApplied: false,
        transferEdits: [...transferEdits.values()].filter((edit) => byCandidateId.has(edit.id)).map(copy),
        selectedTransferIds: selected.map((candidate) => candidate.id), invalidSelections, staleSelection, snapshotId, pending, rental, rent: rental, purchase,
        routeEstimates: copy(calculationOptions.routeEstimates), routePairs: copy(baseline.logistics?.routePairs || []),
        baseline: { rows: baseline.rows.map((row) => ({ id: row.id, required: row.required, missing: row.missing, available: row.available, capacity: row.capacity })),
          candidates: candidates.map((candidate) => candidate.id), transfers: copy(actualTransfers) },
        actualTransfers: copy(scenario.transfers.filter((transfer) => !appliedIds.has(transfer.id))),
        warnings: [...new Set([...list(scenario.logistics?.warnings), ...invalidSelections.map((entry) => entry.message)])],
        inventorySavedAt: inventory.savedAt || "", provisional: true, productionMutations: 0,
        disclaimer: "PLAN PROVISIONAL. Sólo los trasiegos marcados y revisados reducen la renta en este escenario. No se guardan reservas, movimientos, rentas ni compras." };
    }
    return Object.freeze({ analyze });
  }
  const defaultEngine = create();
  return Object.freeze({ create, analyze: (...args) => defaultEngine.analyze(...args), fingerprint, routeId, routeIdentity });
});
