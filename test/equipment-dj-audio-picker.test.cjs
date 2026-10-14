const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function context() {
  const source = { authoritative: true, fileName: "Fuente sintética actual.xlsx", version: "synthetic-dj-current" };
  const audio = (name, code, quantity) => ({
    name, importSource: source, mainSections: [
      { id: `current-${code}-header`, title: name, items: [], importSource: source,
        rows: [{ type: "header", description: name, cells: [{ ref: `AUDIO!${code}1`, value: name }] }] },
      { id: `current-${code}-audio`, title: "Audio", items: [[quantity, `Altavoz sintético ${code}`], [0, `Cero sintético ${code}`]], importSource: source,
        rows: [
          { type: "item", sourceItemIndex: 0, quantity, description: `Altavoz sintético ${code}`, notes: [`Nota sintética ${code}`], cells: [{ ref: `AUDIO!${code}2`, value: quantity }] },
          { type: "item", sourceItemIndex: 1, quantity: 0, description: `Cero sintético ${code}`, cells: [{ ref: `AUDIO!${code}3`, value: 0 }] }
        ] }
    ], extras: []
  });
  const dj = (name, code) => ({
    name, importSource: source, mainSections: [
      { id: `current-${code}-audio`, title: "Audio", items: [[9, `Audio base sintético ${code}`]], importSource: source },
      { id: `current-${code}-monitor`, title: "MONITOREO INTERNO / Monitoreo", items: [[1, `Monitor sintético ${code}`]], importSource: source },
      { id: `current-${code}-light`, title: "Iluminación", items: [[3, `Luz sintética ${code}`]], importSource: source }
    ], extras: []
  });
  const catalog = { version: "synthetic-dj-current", services: {
    "dj-completo": dj("DJ COMPLETO", "completo"), "dj-privado": dj("DJ PRIVADO", "privado"),
    "audio-qsc": audio("AUDIO QSC", "Q", 2), "audio-jbl": audio("AUDIO JBL", "J", 4),
    turbosound: audio("TURBOSOUND", "T", 6), ip2000: audio("IP2000", "I", 8),
    plain: { name: "Servicio sintético adicional", mainSections: [], extras: [] }
  }, groups: [
    { label: "DJ", serviceIds: ["dj-completo", "dj-privado"] },
    { label: "AUDIO", serviceIds: ["audio-qsc", "audio-jbl", "turbosound", "ip2000"] },
    { label: "Otra categoría", serviceIds: ["plain"] }
  ] };
  const sandbox = {
    console, URL, Blob, Map, Set, Date, Math, JSON, Number, String, Object, Array, RegExp, Promise,
    setTimeout() {}, setInterval() {}, clearInterval() {}, fetch: async () => ({ ok: false }),
    window: { requerimientoEquipoCatalog: catalog, requerimientoEquipoInventory: { categories: [] },
      addEventListener() {}, setTimeout() {}, setInterval() {}, requestAnimationFrame(callback) { callback(); } },
    document: { querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, dispatchEvent() {} }
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "equipment.js"), "utf8"), sandbox);
  vm.runInContext("renderEquipmentModule = () => {};", sandbox);
  return sandbox;
}

const execute = (sandbox, code) => vm.runInContext(code, sandbox);
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);

test("DJ choices use only the four current AUDIO services and preserve their source rows", () => {
  const sandbox = context();
  const result = plain(execute(sandbox, `(() => {
    const base = JSON.stringify(equipmentServices["dj-completo"]);
    equipmentState.djAudioSelections = { "dj-completo": "ip2000", plain: "audio-qsc", "dj-privado": "missing" };
    const resolved = serviceWithEquipmentAudioOption("dj-completo");
    return { choices: equipmentDjAudioServices().map(({serviceId,service}) => [serviceId,service.name]),
      map: cloneEquipmentDjAudioSelections(equipmentState.djAudioSelections),
      audio: resolved.mainSections[1], source: equipmentServices.ip2000.mainSections[1],
      categories: resolved.mainSections.map(section => section.title),
      untouched: base === JSON.stringify(equipmentServices["dj-completo"]) };
  })()`));
  assert.deepEqual(result.choices, [["audio-qsc", "AUDIO QSC"], ["audio-jbl", "AUDIO JBL"], ["turbosound", "TURBOSOUND"], ["ip2000", "IP2000"]]);
  assert.deepEqual(result.map, { "dj-completo": "ip2000" });
  assert.deepEqual(result.audio.items, result.source.items);
  assert.deepEqual(result.audio.rows, result.source.rows);
  assert.deepEqual(result.audio.importSource, result.source.importSource);
  assert.deepEqual(result.categories, ["IP2000", "IP2000 / Audio", "MONITOREO INTERNO / Monitoreo", "Iluminación"]);
  assert.equal(result.untouched, true);
});

test("canceling a new DJ leaves applied services, audio and extras untouched", async () => {
  const sandbox = context();
  execute(sandbox, `setEquipmentServiceSelection(["plain"]);
    equipmentState.selectedExtraIds.add("preserved-extra");
    let completeChoice;
    requestEquipmentDjAudioChoice = () => new Promise(resolve => { completeChoice = resolve; });`);
  const pending = execute(sandbox, 'toggleEquipmentService("dj-privado")');
  assert.deepEqual(plain(execute(sandbox, "selectedEquipmentServiceIds()")), ["plain"]);
  assert.deepEqual(plain(execute(sandbox, "equipmentState.djAudioSelections")), {});
  execute(sandbox, "completeChoice(null)");
  assert.equal(await pending, false);
  assert.deepEqual(plain(execute(sandbox, "selectedEquipmentServiceIds()")), ["plain"]);
  assert.deepEqual(plain(execute(sandbox, "[...equipmentState.selectedExtraIds]")), ["preserved-extra"]);
});

test("native batch selection restores committed options while waiting and cancels atomically", async () => {
  const sandbox = context();
  execute(sandbox, `setEquipmentServiceSelection(["plain"]);
    let choices = [];
    requestEquipmentDjAudioChoice = serviceId => new Promise(resolve => choices.push({serviceId,resolve}));
    const nativeSelect = { multiple: true, options: [
      { value: "plain", selected: true }, { value: "dj-completo", selected: true }, { value: "dj-privado", selected: true }
    ], get selectedOptions() { return this.options.filter(option => option.selected); } };
    document.querySelector = selector => selector === "#equipmentServiceSelect" ? nativeSelect : null;`);
  const pending = execute(sandbox, "selectEquipmentService()");
  assert.deepEqual(plain(execute(sandbox, "nativeSelect.selectedOptions.map(option => option.value)")), ["plain"]);
  assert.equal(execute(sandbox, "choices[0].serviceId"), "dj-completo");
  execute(sandbox, 'choices[0].resolve("audio-qsc")');
  await flush();
  assert.equal(execute(sandbox, "choices[1].serviceId"), "dj-privado");
  assert.deepEqual(plain(execute(sandbox, "selectedEquipmentServiceIds()")), ["plain"]);
  execute(sandbox, "choices[1].resolve(null)");
  assert.equal(await pending, false);
  assert.deepEqual(plain(execute(sandbox, "equipmentState.djAudioSelections")), {});
  assert.deepEqual(plain(execute(sandbox, "selectedEquipmentServiceIds()")), ["plain"]);
});

test("two DJs retain independent audio and changing one replaces its equipment without accumulation", async () => {
  const sandbox = context();
  execute(sandbox, `let requested = [];
    requestEquipmentDjAudioChoice = async serviceId => { requested.push(serviceId); return serviceId === "dj-completo" ? "audio-qsc" : "audio-jbl"; };`);
  assert.equal(await execute(sandbox, 'applyEquipmentUserServiceSelection(["dj-completo", "dj-privado"])'), true);
  assert.deepEqual(plain(execute(sandbox, "equipmentState.djAudioSelections")), { "dj-completo": "audio-qsc", "dj-privado": "audio-jbl" });
  execute(sandbox, 'requestEquipmentDjAudioChoice = async () => "turbosound";');
  assert.equal(await execute(sandbox, 'changeEquipmentDjAudio("dj-completo")'), true);
  const items = plain(execute(sandbox, "currentEquipmentServices().map(service => service.mainSections.flatMap(section => section.items))"));
  assert.deepEqual(items[0], [[6, "Altavoz sintético T"], [0, "Cero sintético T"], [1, "Monitor sintético completo"], [3, "Luz sintética completo"]]);
  assert.deepEqual(items[1], [[4, "Altavoz sintético J"], [0, "Cero sintético J"], [1, "Monitor sintético privado"], [3, "Luz sintética privado"]]);
  assert.equal(await execute(sandbox, 'toggleEquipmentService("dj-completo")'), true);
  assert.deepEqual(plain(execute(sandbox, "equipmentState.djAudioSelections")), { "dj-privado": "audio-jbl" });
});

test("concurrent clicks cannot apply another selection while an audio choice is pending", async () => {
  const sandbox = context();
  execute(sandbox, "let completeChoice; requestEquipmentDjAudioChoice = () => new Promise(resolve => { completeChoice = resolve; });");
  const pending = execute(sandbox, 'toggleEquipmentService("dj-completo")');
  assert.equal(await execute(sandbox, 'toggleEquipmentService("plain")'), false);
  assert.deepEqual(plain(execute(sandbox, "selectedEquipmentServiceIds()")), []);
  execute(sandbox, 'completeChoice("audio-qsc")');
  assert.equal(await pending, true);
  assert.deepEqual(plain(execute(sandbox, "selectedEquipmentServiceIds()")), ["dj-completo"]);
});

test("snapshot, editable JSON, summary and PDF preserve audio rows, notes, zeros and monitoring", () => {
  const sandbox = context();
  const result = plain(execute(sandbox, `(() => {
    setEquipmentServiceSelection(["dj-completo", "dj-privado"]);
    equipmentState.djAudioSelections = { "dj-completo": "audio-qsc", "dj-privado": "ip2000" };
    const snapshot = captureEquipmentEventSnapshot();
    const editable = JSON.parse(JSON.stringify(cloneEquipmentEventForEditable(snapshot)));
    const before = tableForEquipmentSections(snapshot.sections, true);
    resetEquipmentWindowDraft();
    const resetMap = {...equipmentState.djAudioSelections};
    restoreEquipmentEventSnapshot(editable);
    const after = captureEquipmentEventSnapshot();
    const summary = equipmentRowsSummary().filter(row => row.type !== "category").map(row => [row.description,row.quantity]);
    const draft = equipmentCatalogDraftForService("dj-completo");
    return { snapshot, editable, after, resetMap, summary, before, pdf: tableForEquipmentSections(after.sections,true),
      editorItems: draft.sections[0].items.map(item => [item.quantity,item.description]) };
  })()`));
  assert.deepEqual(result.resetMap, {});
  assert.deepEqual(result.editable.djAudioSelections, result.snapshot.djAudioSelections);
  assert.deepEqual(result.after.djAudioSelections, result.snapshot.djAudioSelections);
  assert.deepEqual(result.after.sections, result.snapshot.sections);
  assert.equal(result.pdf, result.before);
  assert.ok(result.pdf.includes("Nota sintética Q"));
  assert.ok(result.pdf.includes("Cero sintético Q"));
  assert.ok(result.pdf.includes('class="equipment-qty equipment-service-quantity-cell">0</td>'));
  assert.ok(result.pdf.includes("Monitor sintético completo"));
  assert.ok(result.summary.some(([name, quantity]) => name === "Altavoz sintético Q" && quantity === 2));
  assert.ok(result.summary.some(([name, quantity]) => name === "Altavoz sintético I" && quantity === 8));
  assert.deepEqual(result.editorItems, [[9, "Audio base sintético completo"]]);
});
