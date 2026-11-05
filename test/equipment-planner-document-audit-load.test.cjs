const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function documentFixture() {
  // Synthetic contracts deliberately contain thirteen independent document
  // discrepancies. They are not copies of saved events or inventory records.
  const specs = [
    ['2 luces Leko, 2 luces Fresnel, 43 barras foammy, 2 botellas LED, rótulo NEON', 'Iluminación', [[4, 'Luces Leko'], [4, 'Luces Fresnel']]],
    ['6 luces pares LED para matiz, generador eléctrico, tarima 6 X 4mts', 'Toldos', [[2, 'Par LED RGB con cable ac']]],
    ['250 barras LED, 150 lentes LED, 300 accesorios tipo pulsera', 'Insumos', []],
    ['6 barras beam laser', 'Iluminación', [[5, 'Barra beam laser grande'], [3, 'Barra beam laser pequeña']]],
    ['Generador eléctrico', 'Documento', []],
    ['Servicio sintético de prueba', 'Documento', [[0, 'Línea cero sintética']]]
  ];
  return specs.map(([contracted, title, items], index) => ({
    id: `synthetic-late-audit-${index}`, place: `Sitio sintético ${index}`, date: '2026-11-05', contracted,
    setupAt: '2026-11-05T08:00', startAt: '2026-11-05T10:00', endAt: '2026-11-05T18:00', equipmentInAt: '2026-11-05T20:00',
    sourceSheet: 'Fuente sintética', metadataRefs: { contracted: [`synthetic:${index}:B2`] },
    sourceCells: [{ ref: `synthetic:${index}:B2`, sheet: 'Fuente sintética', address: 'B2', value: contracted }],
    sections: [{ title, items: items.map(([quantity, description]) => ({ quantity, description })) }]
  }));
}
function browser() {
  const nodes = new Map();
  for (const selector of ['#equipmentPlannerOverview', '#equipmentPlannerPending', '#equipmentPlannerStatus']) {
    nodes.set(selector, { innerHTML: '', textContent: '', querySelectorAll() { return []; }, addEventListener() {} });
  }
  const context = vm.createContext({
    document: { querySelector: selector => nodes.get(selector) || null, querySelectorAll() { return []; } }
  });
  context.window = context;
  vm.runInContext(source('equipment-identity.js'), context, { filename: 'equipment-identity.js' });
  vm.runInContext(source('equipment-planner.js'), context, { filename: 'equipment-planner.js' });
  return { context, nodes, loadAudit() { vm.runInContext(source('equipment-document-audit.js'), context, { filename: 'equipment-document-audit.js' }); } };
}

test('browser planner loaded before its document auditor discovers all thirteen discrepancies after the auditor arrives', () => {
  const b = browser(), events = documentFixture(), before = JSON.stringify(events);
  const waiting = b.context.EquipmentPlanner.analyze(events, []);
  assert.equal(waiting.documentAuditUnavailable, true); assert.equal(waiting.documentPending.length, 0);
  b.loadAudit();
  const result = b.context.EquipmentPlanner.analyze(events, []);
  assert.equal(result.documentAuditUnavailable, false); assert.equal(result.documentPending.length, 13);
  assert.ok(result.documentPending.every(warning => warning.kind === 'DOCUMENTO'));
  assert.equal(result.rent.length, 0); assert.equal(result.purchase.length, 0);
  assert.equal(JSON.stringify(events), before);
  const nodeResult = require('../equipment-planner.js').analyze(events, []);
  assert.deepEqual(plain(result.documentPending), plain(nodeResult.documentPending));
});

test('missing or incomplete browser auditor is a visible pending check rather than a silently successful document review', () => {
  for (const incomplete of [undefined, {}, { audit: null }]) {
    const b = browser(); b.context.EquipmentDocumentAudit = incomplete;
    const event = documentFixture()[5];
    const bridge = { events: () => [event], inventory: () => [] };
    const instance = b.context.EquipmentPlanner.create(bridge).init();
    assert.equal(instance.model().documentAuditUnavailable, true);
    assert.match(b.nodes.get('#equipmentPlannerOverview').innerHTML, /<strong>1<\/strong> pendientes/);
    assert.match(b.nodes.get('#equipmentPlannerPending').innerHTML, /Revisión del documento pendiente/);
    assert.match(b.nodes.get('#equipmentPlannerPending').innerHTML, /No se pudo cargar el verificador de documentos/);
    b.loadAudit(); instance.render();
    assert.equal(instance.model().documentAuditUnavailable, false);
    assert.doesNotMatch(b.nodes.get('#equipmentPlannerPending').innerHTML, /No se pudo cargar el verificador de documentos/);
  }
});
