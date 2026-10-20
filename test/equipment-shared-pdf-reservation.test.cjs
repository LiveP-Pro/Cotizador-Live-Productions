const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function harness() {
  const status = { textContent: "", classList: { add() {}, remove() {}, toggle() {} } }, notes = { value: "Borrador sintético conservado" };
  const context = vm.createContext({
    console, URL, Date, Math, JSON, Number, String, Object, Array, Map, Set, RegExp, Promise,
    window: { requerimientoEquipoCatalog: { services: {}, groups: [] }, showDirectoryPicker() {} },
    document: { querySelector(selector) { return selector === "#equipmentSaveStatus" || selector === "#equipmentSharedStatus" ? status : selector === "#equipmentNotes" ? notes : null; }, addEventListener() {}, querySelectorAll() { return []; } },
    fetch: async () => { throw new Error("No PDF request should occur before reserving"); }
  });
  const run = (code) => vm.runInContext(code, context);
  run(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"));
  run(`window.actions=[]; equipmentSharedWorkspace.enabled=true; equipmentSharedWorkspace.dirty=true;
    resolveEquipmentPendingExtraChoices=async()=>[];
    currentEquipmentService=()=>({name:'Servicio sintético'});
    validateCurrentEquipmentWindowDraft=()=>{window.actions.push('validate');return true};
    equipmentRentReportValidationMessage=()=>'';
    renderEquipmentTransferPdf=()=>{};
    equipmentConfiguredTransferRoutesWithItems=()=>[{items:[{quantity:1}]}];
    saveEquipmentSharedWindow=async()=>{window.actions.push('reserve');equipmentState.events=[{id:'shared-synthetic',updatedAt:'2026-10-20T12:00:00Z'}];equipmentState.selectedEventId='shared-synthetic';equipmentSharedWorkspace.dirty=false;return true};
    chooseEquipmentSaveFolder=async()=>{window.actions.push('picker');const error=new Error('Cancelled');error.name='AbortError';throw error};`);
  return { run, context, status, notes, actions: () => JSON.parse(run("JSON.stringify(window.actions)")) };
}

test("PDF de bodega reserva primero una ventana nueva y abre el selector después", async () => {
  const h = harness();
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), ["validate", "reserve", "picker"]);
  assert.equal(h.run("selectedEquipmentEvent().updatedAt"), "2026-10-20T12:00:00Z");
  assert.equal(h.notes.value, "Borrador sintético conservado");
});

test("PDF de bodega guarda cambios de un evento ya reservado antes de despachar", async () => {
  const h = harness();
  h.run("equipmentState.events=[{id:'existing-event',updatedAt:'2026-10-20T11:00:00Z'}];equipmentState.selectedEventId='existing-event'");
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), ["validate", "reserve", "picker"]);
});

test("evento existente sin cambios conserva su reserva y no la duplica al generar PDF", async () => {
  const h = harness();
  h.run("equipmentState.events=[{id:'existing-event',updatedAt:'2026-10-20T11:00:00Z'}];equipmentState.selectedEventId='existing-event';equipmentSharedWorkspace.dirty=false");
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), ["picker"]);
});

test("validación de ventana fallida impide reserva y selector de archivos", async () => {
  const h = harness();
  h.run("validateCurrentEquipmentWindowDraft=()=>{window.actions.push('validate');return false}");
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), ["validate"]);
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  assert.equal(h.notes.value, "Borrador sintético conservado");
});

test("fallo o conflicto al reservar no permite PDF ni descarta el borrador", async () => {
  const h = harness();
  h.run("saveEquipmentSharedWindow=async()=>{window.actions.push('reserve');throw new Error('El evento cambió en otra pestaña. Actualice antes de continuar.')}");
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), ["validate", "reserve"]);
  assert.match(h.status.textContent, /cambió en otra pestaña/);
  assert.equal(h.run("equipmentSharedWorkspace.dirty"), true);
  assert.equal(h.notes.value, "Borrador sintético conservado");
});

test("renta, compra y trasiego bloquean reportes con cambios sin guardar", async () => {
  for (const mode of ["rent", "purchase", "transfer"]) {
    const h = harness();
    await h.run(`saveEquipmentPdf(${JSON.stringify(mode)})`);
    assert.deepEqual(h.actions(), [], mode);
    assert.match(h.status.textContent, /Guarde la ventana/, mode);
  }
});

test("guardado en curso impide cualquier PDF y no inicia otra reserva", async () => {
  for (const mode of ["full", "rent", "purchase", "transfer"]) {
    const h = harness(); h.run("equipmentSharedWorkspace.saving=true");
    await h.run(`saveEquipmentPdf(${JSON.stringify(mode)})`);
    assert.deepEqual(h.actions(), [], mode);
    assert.match(h.status.textContent, /Espere.*guardado/, mode);
  }
});

test("cancelar las decisiones de extras detiene todo antes de reservar", async () => {
  const h = harness(); h.run("resolveEquipmentPendingExtraChoices=async()=>null");
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), []);
});

test("dos clics mientras se reserva generan una sola reserva", async () => {
  const h = harness();
  h.run("saveEquipmentSharedWindow=()=>{window.actions.push('reserve');equipmentSharedWorkspace.saving=true;return new Promise(resolve=>{window.resolveReservation=()=>{equipmentSharedWorkspace.saving=false;equipmentSharedWorkspace.dirty=false;resolve(true)}})}");
  const first = h.run("saveEquipmentPdf('full')");
  await Promise.resolve(); await Promise.resolve();
  await h.run("saveEquipmentPdf('full')");
  assert.equal(h.actions().filter((action) => action === "reserve").length, 1);
  h.run("window.resolveReservation()"); await first;
  assert.deepEqual(h.actions(), ["validate", "reserve", "picker"]);
});

test("modo anterior conserva el flujo PDF sin activar agenda compartida", async () => {
  const h = harness(); h.run("equipmentSharedWorkspace.enabled=false");
  await h.run("saveEquipmentPdf('full')");
  assert.deepEqual(h.actions(), ["picker"]);
});
