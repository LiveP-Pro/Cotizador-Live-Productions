const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { applyStockIngress, prepareWarehouseSave, nextWarehouseTimestamp } = require("../warehouse-ledger.cjs");

const actor = { id: "synthetic-user", username: "Usuario de prueba", name: "Usuario de prueba" };
const timestamp = "2026-10-08T10:00:00.000Z";
function inventory() {
  return { savedAt: timestamp, state: {
    items: [{ id: "synthetic-item", name: "Equipo sintético", category: "Audio", quantity: 2, itemType: "equipo", archived: false }],
    movements: [], auditEntries: [{ id: "existing-audit", action: "alta", description: "Registro previo sintético" }], equipmentStockReceipts: []
  } };
}
function payload(items = [{ description: "Equipo sintético", quantity: 3, category: "Audio" }], requestId = "synthetic-ingress") {
  return { requestId, items, event: { id: "synthetic-event", name: "Evento sintético", place: "Lugar sintético", date: "2026-10-09" } };
}
function commitIngress(current, request) {
  const result = applyStockIngress(current, request, { actor, timestamp: nextWarehouseTimestamp(current.savedAt, Date.parse(timestamp)) });
  if (result.duplicate) return { saved: current, result };
  const saved = prepareWarehouseSave(current, result.state, { actor, source: "requerimiento-equipo",
    requestId: request.requestId, event: result.storedReceipt.event, stockReceipt: result.storedReceipt, ingressChanges: result.changes }, Date.parse(timestamp));
  return { saved, result };
}

test("an ingress updates exact stock, creates new zero stock and audits every requested line", () => {
  const current = inventory();
  const original = structuredClone(current);
  const { saved, result } = commitIngress(current, payload([
    { description: "Equipo sintético", category: "Audio", quantity: 3 },
    { description: "Equipo nuevo sintético", category: "Video", quantity: 0 }
  ]));
  assert.deepEqual(current, original);
  assert.equal(saved.state.items[0].quantity, 5);
  assert.equal(saved.state.items[1].quantity, 0);
  assert.equal(saved.state.auditEntries.length, 3);
  assert.deepEqual(saved.state.auditEntries.slice(1).map((entry) => [entry.action, entry.quantity, entry.previousQuantity, entry.newQuantity]),
    [["ingreso", 3, 2, 5], ["alta", 0, 0, 0]]);
  assert.equal(saved.state.auditEntries[1].actor.username, actor.username);
  assert.equal(saved.state.auditEntries[1].event.name, "Evento sintético");
  assert.equal(result.receipt.items[1].quantity, 0);
  assert.equal(saved.state.movements.length, 0);
});

test("duplicate requests survive client omissions and reordered object fields without another acquisition", () => {
  const request = payload();
  const first = commitIngress(inventory(), request).saved;
  const candidate = structuredClone(first.state);
  delete candidate.auditEntries;
  delete candidate.equipmentStockReceipts;
  candidate.items[0].notes = "Edición autorizada sintética";
  const saved = prepareWarehouseSave(first, candidate, { actor });
  const duplicate = applyStockIngress(saved, { event: { date: request.event.date, place: request.event.place, name: request.event.name, id: request.event.id },
    items: [{ category: "Audio", description: "Equipo sintético", quantity: 3 }], requestId: request.requestId });
  assert.equal(duplicate.duplicate, true);
  assert.equal(saved.state.items[0].quantity, 5);
  assert.equal(saved.state.equipmentStockReceipts.length, 1);
  assert.ok(saved.state.auditEntries.some((entry) => entry.id === "existing-audit"));
  assert.equal(duplicate.receipt.items[0].newQuantity, 5);
  assert.throws(() => applyStockIngress(saved, payload([{ description: "Equipo sintético", category: "Audio", quantity: 4 }])),
    (error) => error.statusCode === 409);
});

test("an ambiguous or invalid later row rolls back the entire batch", () => {
  const current = inventory();
  current.state.items.push({ ...current.state.items[0], id: "synthetic-duplicate" });
  const before = structuredClone(current);
  assert.throws(() => applyStockIngress(current, payload([
    { description: "Equipo nuevo sintético", category: "Video", quantity: 2 },
    { description: "Equipo sintético", category: "Audio", quantity: 1 }
  ])), (error) => error.statusCode === 409);
  assert.deepEqual(current, before);
  assert.throws(() => applyStockIngress(current, payload([
    { description: "Equipo nuevo sintético", category: "Video", quantity: 2 },
    { description: "Otro equipo", category: "Audio", quantity: -1 }
  ])), /mayor o igual a cero/);
  assert.deepEqual(current, before);
});

test("ingress matches exact current name and category and never aliases or archived stock", () => {
  const current = inventory();
  current.state.items[0].descriptionAliases = ["Alias sintético"];
  current.state.items.push({ id: "archived-item", name: "Equipo archivado", category: "Audio", quantity: 8, archived: true });
  const { saved } = commitIngress(current, payload([
    { description: "Equipo sintético", category: "Video", quantity: 1 },
    { description: "Alias sintético", category: "Audio", quantity: 1 },
    { description: "Equipo archivado", category: "Audio", quantity: 1 }
  ]));
  assert.equal(saved.state.items.length, 5);
  assert.equal(saved.state.items[0].quantity, 2);
  assert.equal(saved.state.items[1].quantity, 8);
});

test("all input limits reject instead of truncating and zero remains valid", () => {
  for (const quantity of [-1, 0.5, NaN, Infinity, "2", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => applyStockIngress(inventory(), payload([{ description: "Equipo sintético", category: "Audio", quantity }])), /cantidad entera/);
  }
  assert.throws(() => applyStockIngress(inventory(), payload(Array.from({ length: 101 }, () => ({ description: "Equipo", quantity: 1, category: "Audio" })))), /100 filas/);
  assert.throws(() => applyStockIngress(inventory(), payload([{ description: "X".repeat(241), category: "Audio", quantity: 1 }])), /240 caracteres/);
  const { saved } = commitIngress(inventory(), payload([{ description: "Equipo sintético", category: "Audio", quantity: 0 }]));
  assert.equal(saved.state.items[0].quantity, 2);
  assert.equal(saved.state.auditEntries.length, 1);
  assert.equal(saved.state.equipmentStockReceipts[0].items[0].quantity, 0);
});

test("repeated names preserve each ingress row, sequential quantities and their receipt indexes", () => {
  const { result, saved } = commitIngress(inventory(), payload([
    { description: "Equipo sintético", category: "Audio", quantity: 1 },
    { description: "Equipo sintético", category: "Audio", quantity: 0 },
    { description: "Equipo sintético", category: "Audio", quantity: 4 }
  ]));
  assert.deepEqual(result.receipt.items.map((item) => [item.quantity, item.previousQuantity, item.newQuantity]), [[1, 2, 3], [0, 3, 3], [4, 3, 7]]);
  assert.equal(saved.state.items[0].quantity, 7);
  assert.equal(saved.state.auditEntries.length, 3);
});

test("ordinary inventory saves ignore forged ledger and receipts but audit every real change", () => {
  const current = inventory();
  current.state.movements = [{ id: "removed-movement", itemId: "synthetic-item", itemName: "Equipo sintético", type: "salida", quantity: 1 }];
  current.state.equipmentStockReceipts = [{ requestId: "existing-receipt", fingerprint: "known", items: [] }];
  const candidate = structuredClone(current.state);
  candidate.auditEntries = [{ id: "forged-audit", action: "inventado" }];
  candidate.equipmentStockReceipts = [{ requestId: "forged-receipt" }];
  candidate.items[0].quantity = 3;
  candidate.items[0].name = "Equipo editado sintético";
  candidate.items.push({ id: "new-item", name: "Equipo nuevo", category: "Audio", quantity: 0 });
  candidate.movements = ["salida", "taller", "perdido", "baja", "ingreso"].map((type, index) => ({
    id: `new-movement-${index}`, type, itemId: "synthetic-item", itemName: "Equipo editado sintético", quantity: 1,
    previousQuantity: 2, newQuantity: 3
  }));
  const saved = prepareWarehouseSave(current, candidate, { actor });
  assert.ok(!saved.state.auditEntries.some((entry) => entry.id === "forged-audit"));
  assert.deepEqual(saved.state.equipmentStockReceipts, current.state.equipmentStockReceipts);
  assert.ok(saved.state.auditEntries.some((entry) => entry.action === "cambio_cantidad" && entry.before.name === "Equipo sintético" && entry.after.name === "Equipo editado sintético"));
  for (const action of ["alta", "salida", "taller", "perdido", "baja", "ingreso", "eliminacion_bitacora"]) {
    assert.ok(saved.state.auditEntries.some((entry) => entry.action === action), action);
  }
  const archived = structuredClone(saved.state);
  archived.items[0].archived = true;
  const archivedSave = prepareWarehouseSave(saved, archived, { actor });
  assert.equal(archivedSave.state.auditEntries.at(-1).action, "archivado");
  const cleared = structuredClone(archivedSave.state);
  cleared.movements = [];
  cleared.items = [];
  const deleted = prepareWarehouseSave(archivedSave, cleared, { actor });
  assert.ok(deleted.state.auditEntries.some((entry) => entry.action === "eliminacion"));
  assert.ok(deleted.state.auditEntries.some((entry) => entry.id === "existing-audit"));
  assert.equal(deleted.state.equipmentStockReceipts[0].requestId, "existing-receipt");
});

test("warehouse revisions remain strictly increasing during multiple writes in one millisecond", () => {
  const first = prepareWarehouseSave(inventory(), inventory().state, {}, Date.parse(timestamp));
  const second = prepareWarehouseSave(first, first.state, {}, Date.parse(timestamp));
  assert.ok(Date.parse(first.savedAt) > Date.parse(timestamp));
  assert.ok(Date.parse(second.savedAt) > Date.parse(first.savedAt));
  assert.equal(second.state.updatedAt, second.savedAt);
});

test("loading normalized defaults and changing timestamps does not fabricate inventory or movement edits", () => {
  const current = inventory();
  current.state.items[0] = { id: "synthetic-item", name: "Equipo sintético", category: "Audio", quantity: 2,
    itemType: "equipo", sourceKey: "equipo sintetico" };
  current.state.movements = [{ id: "synthetic-movement", type: "salida", itemId: "synthetic-item", itemName: "Equipo sintético", quantity: 1, date: "2026-10-08" }];
  const candidate = structuredClone(current.state);
  Object.assign(candidate.items[0], { category: "AUDIO", notes: "", sourceRow: 0, archived: false,
    descriptionAliases: [], importSource: { fileName: "archivo.xlsx", description: "Equipo sintético", location: "A1" },
    updatedAt: "2026-10-08T10:01:00.000Z", createdAt: "2026-10-08T10:01:00.000Z" });
  Object.assign(candidate.movements[0], { previousQuantity: null, newQuantity: null, responsible: "", reference: "", repair: "", sparePart: "",
    description: "", rentalDays: 1, notes: "", batchId: "", relatedMovementId: "", attachment: null,
    warehouseSignature: "", workshopSignature: "", sourceUnmatched: false, procurementChoice: "", procurementAction: "",
    dateTime: "2026-10-08T00:00", createdAt: "2026-10-08T10:01:00.000Z" });
  const saved = prepareWarehouseSave(current, candidate, { actor });
  assert.deepEqual(saved.state.auditEntries, current.state.auditEntries);
  candidate.movements.push({ id: "new-workshop", type: "taller", itemId: "synthetic-item", itemName: "Equipo sintético", quantity: 1 });
  const workshop = prepareWarehouseSave(current, candidate, { actor });
  assert.deepEqual(workshop.state.auditEntries.slice(1).map((entry) => entry.action), ["taller"]);
});

test("binary attachments and signatures remain in active records but audit snapshots contain only evidence digests", () => {
  const inline = `data:application/pdf;base64,${"A".repeat(200000)}`;
  const signature = `data:image/png;base64,${"B".repeat(100000)}`;
  const current = inventory();
  current.state.movements = [{ id: "media-movement", type: "taller", itemId: "synthetic-item", itemName: "Equipo sintético", quantity: 1,
    attachment: { dataUrl: inline }, warehouseSignature: signature, workshopSignature: signature,
    sourcePdfUrl: "/test/old.pdf", sourceJsonUrl: "/test/old.json", sourceFileName: "old.pdf", sourceJsonFileName: "old.json" }];
  const candidate = structuredClone(current.state);
  Object.assign(candidate.movements[0], { updatedAt: "2026-10-08T10:01:00.000Z", sourcePdfUrl: "/test/new.pdf",
    sourceJsonUrl: "/test/new.json", sourceFileName: "new.pdf", sourceJsonFileName: "new.json" });
  Object.assign(candidate.movements[0].attachment, { name: "archivo", type: "application/octet-stream", url: "" });
  const noOp = prepareWarehouseSave(current, candidate, { actor });
  assert.deepEqual(noOp.state.auditEntries, current.state.auditEntries);
  candidate.movements[0].notes = "Reparación real solicitada";
  const edited = prepareWarehouseSave(current, candidate, { actor });
  const entry = edited.state.auditEntries.at(-1);
  assert.equal(entry.action, "edicion_movimiento");
  assert.equal(entry.after.notes, "Reparación real solicitada");
  assert.equal(entry.before.warehouseSignature.sha256.length, 64);
  assert.equal(entry.after.attachment.dataUrl.sha256.length, 64);
  assert.ok(entry.after.attachment.dataUrl.byteLength > 200000);
  assert.ok(JSON.stringify(entry).length < 5000);
  assert.equal(edited.state.movements[0].attachment.dataUrl, inline);
  assert.equal(edited.state.movements[0].warehouseSignature, signature);
  candidate.movements[0].warehouseSignature = `${signature}C`;
  const changedSignature = prepareWarehouseSave(noOp, candidate, { actor });
  assert.notEqual(changedSignature.state.auditEntries.at(-1).before.warehouseSignature.sha256,
    changedSignature.state.auditEntries.at(-1).after.warehouseSignature.sha256);
  candidate.movements = [];
  const removed = prepareWarehouseSave(current, candidate, { actor });
  assert.equal(removed.state.auditEntries.at(-1).action, "eliminacion_bitacora");
  assert.ok(JSON.stringify(removed.state.auditEntries.at(-1)).length < 5000);
});

test("re-emitting a PDF replaces an unequivocal source movement without fabricating another outgoing transaction", () => {
  const current = inventory();
  current.state.movements = [{ id: "old-outgoing", type: "salida", itemId: "synthetic-item", itemName: "Equipo sintético", quantity: 1,
    sourceDocumentId: "synthetic-document", sourceLineKey: "synthetic-line", sourceCategory: "Audio", date: "2026-10-08",
    dateTime: "2026-10-08T10:00", responsible: "Usuario sintético", notes: "Nota original" }];
  const candidate = structuredClone(current.state);
  candidate.movements[0].id = "re-emitted-outgoing";
  candidate.movements[0].createdAt = "2026-10-08T10:05:00.000Z";
  candidate.movements[0].sourceFileName = "updated.pdf";
  const noOp = prepareWarehouseSave(current, candidate, { actor, source: "requerimiento-equipo" });
  assert.deepEqual(noOp.state.auditEntries, current.state.auditEntries);
  for (const [field, value] of [["quantity", 2], ["dateTime", "2026-10-08T11:00"], ["responsible", "Otro usuario"],
    ["sourceCategory", "Video"], ["notes", "Nota nueva"], ["procurementChoice", "rent"]]) {
    const edited = structuredClone(candidate);
    edited.movements[0][field] = value;
    const saved = prepareWarehouseSave(current, edited, { actor, source: "requerimiento-equipo" });
    assert.equal(saved.state.auditEntries.length, 2, field);
    assert.equal(saved.state.auditEntries.at(-1).action, "edicion_movimiento", field);
    assert.equal(saved.state.auditEntries.at(-1).before.id, "old-outgoing");
    assert.equal(saved.state.auditEntries.at(-1).after.id, "re-emitted-outgoing");
  }
  const ordinarySave = prepareWarehouseSave(current, candidate, { actor, source: "contabilidad-equipo" });
  assert.deepEqual(ordinarySave.state.auditEntries.slice(1).map((entry) => entry.action), ["salida", "eliminacion_bitacora"]);
  current.state.movements.push({ ...current.state.movements[0], id: "ambiguous-outgoing" });
  const ambiguous = prepareWarehouseSave(current, candidate, { actor, source: "requerimiento-equipo" });
  assert.equal(ambiguous.state.auditEntries.length, 4);
  assert.deepEqual(ambiguous.state.auditEntries.slice(1).map((entry) => entry.action), ["salida", "eliminacion_bitacora", "eliminacion_bitacora"]);
});

test("server ingress re-ingestion returns a durable duplicate receipt without writing stock twice", async () => {
  let saved = inventory();
  let writes = 0;
  let response;
  const context = {
    applyStockIngress, nextWarehouseTimestamp,
    readWarehouseInventory() { return structuredClone(saved); },
    warehouseAuditActor() { return actor; },
    async writeWarehouseInventory(value, options) { writes += 1; Object.assign(value, prepareWarehouseSave(saved, value.state, options)); saved = structuredClone(value); },
    jsonResponse(res, status, body) { response = { status, body }; },
    errorResponse(res, status, message) { response = { status, message }; }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.indexOf("async function ingressEquipmentStock(");
  const end = source.indexOf("\nensureWarehouseInventoryStorage();", start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
  await context.ingressEquipmentStock(payload(), {}, {});
  assert.equal(response.status, 200);
  assert.equal(response.body.receipt.duplicate, false);
  assert.equal(response.body.state.items[0].quantity, 5);
  await context.ingressEquipmentStock(payload(), {}, {});
  assert.equal(response.body.receipt.duplicate, true);
  assert.equal(writes, 1);
  await context.ingressEquipmentStock(payload([{ description: "Equipo sintético", quantity: 9, category: "Audio" }]), {}, {});
  assert.equal(response.status, 409);
  assert.equal(writes, 1);
  assert.match(source, /url\.pathname === "\/api\/inventario-bodega\/ingresos-desde-equipo"[\s\S]*?requireAuth\(request, response\)[\s\S]*?enqueueSave\(\(\) => ingressEquipmentStock\(payload, request, response\)\)/);
});

test("server ordinary saves preserve authoritative history and reject a stale inventory revision", async () => {
  let current = commitIngress(inventory(), payload()).saved;
  let writes = 0;
  let response;
  const context = {
    readWarehouseInventory() { return structuredClone(current); },
    warehouseAuditActor() { return actor; },
    normalizeWarehouseInventoryPayload(value) { return value; },
    async persistWarehouseInventory(value, setAsInitial, options) {
      writes += 1;
      Object.assign(value, prepareWarehouseSave(current, value.state, options));
      current = structuredClone(value);
    },
    jsonResponse(res, status, body) { response = { status, body }; },
    errorResponse(res, status, message) { response = { status, message }; }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
  const start = source.indexOf("async function saveWarehouseInventory(");
  const end = source.indexOf("async function restoreWarehouseInventory(", start);
  vm.runInContext(source.slice(start, end), context);
  const previousSavedAt = current.savedAt;
  const state = structuredClone(current.state);
  delete state.auditEntries;
  delete state.equipmentStockReceipts;
  state.items[0].archived = true;
  await context.saveWarehouseInventory({ expectedSavedAt: previousSavedAt, state }, {}, {});
  assert.equal(response.status, 200);
  assert.equal(response.body.state.auditEntries.at(-1).action, "archivado");
  assert.equal(response.body.state.equipmentStockReceipts.length, 1);
  assert.ok(Date.parse(response.body.savedAt) > Date.parse(previousSavedAt));
  await context.saveWarehouseInventory({ expectedSavedAt: previousSavedAt, state }, {}, {});
  assert.equal(response.status, 409);
  assert.equal(writes, 1);
});
