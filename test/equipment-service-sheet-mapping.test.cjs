const assert = require('node:assert/strict');
const test = require('node:test');
const ui = require('../equipment-service-import.js');

function preview() {
  return {
    source: { fileName: 'Servicios sintéticos.xlsx', format: 'xlsx', worksheets: ['Audio', 'Iluminación', 'Estructuras'] },
    importToken: 'synthetic-current-token', verification: { complete: true, sourceCellCount: 4, representedCellCount: 4 },
    services: [
      { name: 'Paquete audio A', sourceSheet: 'Audio', sourceTableIndex: 1, mainSections: [{ title: 'Audio', items: [[0, 'Unidad sintética cero']], rows: [{ type: 'item', quantity: 0, description: 'Unidad sintética cero' }] }] },
      { name: 'Paquete audio B', sourceSheet: 'Audio', sourceTableIndex: 2, mainSections: [{ title: 'Audio', items: [[2, 'Altavoz sintético']] }] },
      { name: 'Paquete luces', sourceSheet: 'Iluminación', mainSections: [{ title: 'Iluminación', items: [[3, 'Luz sintética']] }] },
      { name: 'Paquete estructura', sourceSheet: 'Estructuras', mainSections: [{ title: 'Estructuras', items: [[1, 'Estructura sintética']] }] }
    ]
  };
}
const groups = [{ id: 'actual-audio', label: 'AUDIO' }];

test('each current worksheet suggests its own category without mixing the parallel service tables', () => {
  const p = preview(); const before = JSON.stringify(p);
  const draft = ui.draftFor(p, groups);
  assert.deepEqual(draft.map(s => [s.name, s.category, s.newCategory]), [
    ['Paquete audio A', 'actual-audio', ''], ['Paquete audio B', 'actual-audio', ''],
    ['Paquete luces', ui.NEW_CATEGORY, 'Iluminación'], ['Paquete estructura', ui.NEW_CATEGORY, 'Estructuras']
  ]);
  assert.deepEqual(ui.sheetGroupsFor(p), [
    { name: 'Audio', indices: [0, 1] }, { name: 'Iluminación', indices: [2] }, { name: 'Estructuras', indices: [3] }
  ]);
  const payload = ui.createPayload(p, draft, groups, 'synthetic-base');
  assert.deepEqual(payload.services.map(s => s.groupId || s.groupLabel), ['actual-audio', 'actual-audio', 'Iluminación', 'Estructuras']);
  assert.equal(JSON.stringify(p), before);
});

test('worksheet preview exposes all sheets, individual tables, bulk controls, literal zero and escaped source labels', () => {
  const p = preview(); p.services[3].sourceSheet = 'Estructuras <actual>';
  const html = ui.renderPreview(p, ui.draftFor(p, groups), groups);
  assert.match(html, /3 hojas · 4 servicios/);
  assert.match(html, /Hoja: Audio · 2 cuadros/);
  assert.match(html, /data-import-apply-sheet="0"/);
  assert.match(html, /equipmentImportSheetCategory2/);
  assert.match(html, /Estructuras &lt;actual&gt;/);
  assert.ok(!html.includes('Hoja: Estructuras <actual>'));
  assert.match(html, /class="equipment-service-import-quantity">0<\/td>/);
});

test('older current reader payloads can map a sheet through source references without inventing PDF categories', () => {
  const p = preview(); delete p.services[0].sourceSheet;
  p.services[0].sourceRefs = ['xlsx:1:A1']; p.sourceCells = [{ ref: 'xlsx:1:A1', sheet: 'Audio', value: 'Actual' }];
  assert.equal(ui.sourceSheetFor(p, p.services[0]), 'Audio');
  const pdf = { services: [{ name: 'Servicio PDF', mainSections: [] }] };
  assert.deepEqual(ui.draftFor(pdf), [{ name: 'Servicio PDF', category: '', newCategory: '' }]);
  assert.deepEqual(ui.sheetGroupsFor(pdf), []);
});

test('sheets whose category names collide cannot silently collapse into the same category', () => {
  const p = preview(); p.services = p.services.slice(0, 2);
  p.services[0].sourceSheet = 'Zona A'; p.services[1].sourceSheet = 'Zona-A';
  const draft = ui.draftFor(p, []);
  assert.match(ui.selectionError(p, draft, []), /mantenerlas separadas/);
  assert.throws(() => ui.createPayload(p, draft, [], 'current'), /mantenerlas separadas/);
  draft[1].newCategory = 'Zona alternativa';
  assert.equal(ui.selectionError(p, draft, []), '');
});

test('server refuses category identifier collisions instead of mixing tables from distinct new categories', async t => {
  const ExcelJS = require('exceljs');
  const fs = require('node:fs');
  const { createHarness } = require('./helpers/equipment-server-harness.cjs');
  const h = createHarness(t), book = new ExcelJS.Workbook();
  for (const label of ['A','B']) book.addWorksheet(`Hoja ${label}`).addRows([[`Servicio: Paquete ${label}`],['Cantidad','Descripción'],[1,`Unidad sintética ${label}`]]);
  const body=Buffer.from(await book.xlsx.writeBuffer());
  const read=await h.dispatch('POST','/api/cuadros-equipo/importar-archivo',null,{body,headers:{'x-file-name':'Sintetico.xlsx','content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
  assert.equal(read.statusCode,200);
  const parsed=read.json();assert.equal(parsed.verification.complete,true);
  const response=await h.dispatch('PUT','/api/cuadros-equipo/importar-servicios',{
    baseCatalogVersion:'synthetic-current',importToken:parsed.importToken,
    services:[{index:0,name:'Paquete A',groupLabel:'Zona A'},{index:1,name:'Paquete B',groupLabel:'Zona-A'}]
  });
  assert.equal(response.statusCode,400);assert.match(response.json().error,/categoría distinta/);
  assert.equal(fs.existsSync(h.paths.equipmentCatalogOverridesPath),false);
});
