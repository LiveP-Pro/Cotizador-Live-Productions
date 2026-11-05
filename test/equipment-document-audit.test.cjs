const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { audit } = require('../equipment-document-audit.js');
const { createEquipmentReportModel, renderEquipmentReportHtml } = require('../equipment-reporting.cjs');
const stock = { savedAt: 'current-synthetic', state: { items: [], movements: [] } };
function event(fields={}) { return { id: 'synthetic-document', place: 'Sitio sintético', sourceSheet: 'Fuente actual', contracted: '2 luces Leko, 2 luces Fresnel, 43 barras foammy, rótulo NEON, 2 botellas LED', metadataRefs:{contracted:['xlsx:1:B2']},
  sourceCells:[{ref:'xlsx:1:B2',sheet:'Fuente actual',address:'B2',value:'2 luces Leko, 2 luces Fresnel, 43 barras foammy, rótulo NEON, 2 botellas LED'}],
  sections:[{title:'Iluminación',items:[{quantity:4,description:'Luces Lekos',sourceRefs:['xlsx:1:A7','xlsx:1:B7']},{quantity:4,description:'Luces Fresnel',sourceRefs:['xlsx:1:A8','xlsx:1:B8']}]}],...fields }; }

test('document audit compares clear contract counts without changing demand or creating physical equivalences', () => {
  const source=event(), before=JSON.stringify(source), issues=audit(source);
  for (const family of ['Leko','Fresnel']) {
    const issue=issues.find(issue=>issue.description.includes(family)); assert.equal(issue.contractQuantity,2); assert.equal(issue.detailQuantity,4);
    assert.match(issue.sourceRefs, /'Fuente actual'!B2/); assert.match(issue.sourceRefs, /'Fuente actual'!A[78]/);
    assert.match(issue.reason,/no modifica cantidades/);
  }
  assert.equal(issues.find(issue=>issue.description.includes('foammy')).quantity,43);
  assert.equal(issues.find(issue=>issue.description.includes('botellas')).quantity,2);
  const neon=issues.find(issue=>issue.description.includes('NEON')); assert.equal(neon.quantity,null); assert.equal(neon.contractQuantity,null);
  assert.equal(JSON.stringify(source),before);
});

test('matching quantities, service names and dimensions do not create fictitious unit requests', () => {
  const e=event({contracted:'Sunday Funday, 4 luces Leko, 4 luces Fresnel, tarima 6 X 4mts',sourceCells:[],metadataRefs:{}});
  const issues=audit(e); assert.ok(!issues.some(issue=>/Leko|Fresnel/.test(issue.description)));
  const tarima=issues.find(issue=>issue.description.includes('tarima')); assert.equal(tarima.quantity,null); assert.ok(!tarima.reason.includes('6 tarima'));
  assert.deepEqual(audit(event({contracted:'Sunday Funday privado',sections:[],sourceCells:[],metadataRefs:{}})),[]);
});

test('metadata ledger and matiz context produce review warnings without joining similar models', () => {
  const e=event({contracted:'',type:'',metadataRefs:{},sourceCells:[],metadataCells:[
    {ref:'meta-label',sheet:'Fuente actual',row:2,address:'A2',value:'Equipo contratado:'},
    {ref:'meta-value',sheet:'Fuente actual',row:2,address:'B2',value:'6 luces par LED para matiz, generador eléctrico, 250 barras LED, 150 lentes LED, 300 accesorios tipo pulsera'}],
    sections:[{title:'Toldos',items:[{quantity:2,description:'Par LED RGB con cable ac'}]}]});
  const issues=audit(e); const matiz=issues.find(issue=>issue.description.includes('matiz'));
  assert.equal(matiz.contractQuantity,6); assert.equal(matiz.detailQuantity,null); assert.match(matiz.reason,/no están identificadas como matiz/);
  assert.ok(issues.find(issue=>issue.description.includes('generador')));
  assert.equal(issues.find(issue=>issue.description.startsWith('barras LED')).quantity,250);
  assert.equal(issues.find(issue=>issue.description.startsWith('lentes LED')).quantity,150);
  assert.equal(issues.find(issue=>issue.description.startsWith('accesorios')).quantity,300);
});

test('native XLSX/PDF model includes imported warnings, issues and automatic document discrepancies as information', () => {
  const e=event({warnings:[{code:'source_warning',message:'Revise esta nota fuente',sourceRefs:['A2']}],issues:[{message:'Confirmar cantidad contratada'}],sourceImport:{warnings:['Aviso de la importación']}});
  const model=createEquipmentReportModel({events:[e]},stock);
  assert.equal(model.counts.equipmentRows,2); assert.equal(model.rows.find(row=>row.description==='Luces Lekos').demand,4);
  for(const expected of ['Revise esta nota fuente','Confirmar cantidad contratada','Aviso de la importación']) assert.ok(model.pending.some(issue=>issue.reason===expected));
  assert.ok(model.pending.some(issue=>issue.kind==='DOCUMENTO'&&issue.contractQuantity===2&&issue.detailQuantity===4));
  assert.equal(model.purchase.length,0); assert.equal(model.rental.length,0);
  assert.match(renderEquipmentReportHtml(model,'rent'),/El contrato indica 2 luces Leko y la tabla suma 4/);
});

test('UMD exposes the same pure audit in the browser', () => {
  const sandbox=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../equipment-document-audit.js'),'utf8'),sandbox);
  assert.equal(typeof sandbox.EquipmentDocumentAudit.audit,'function');
  assert.equal(JSON.stringify(sandbox.EquipmentDocumentAudit.audit(event())),JSON.stringify(audit(event())));
});

// Run this opt-in regression only on the fresh source obtained for this exact
// exercise. It never looks in outputs, old catalogs, backups or saved sessions.
const freshFile=process.env.EQUIPMENT_CURRENT_EVENT_PREVIEW_PATH;
test('fresh user source regression: six events and expected contract/table discrepancies', {skip:!freshFile}, () => {
  const preview=JSON.parse(fs.readFileSync(freshFile,'utf8'));
  assert.equal(preview.events.length,6); assert.equal(preview.events.reduce((sum,e)=>sum+e.sections.reduce((n,s)=>n+s.items.length,0),0),712);
  const issues=preview.events.flatMap(audit);
  const tikal=issues.filter(issue=>issue.event==='Tikal Futura');
  for (const word of ['Leko','Fresnel']) {const issue=tikal.find(issue=>issue.description.includes(word));assert.equal(issue.contractQuantity,2);assert.equal(issue.detailQuantity,4);assert.match(issue.sourceRefs,/'07-11'!E2/);}
  const hilton=issues.filter(issue=>issue.event==='Hotel Hilton');
  assert.equal(hilton.find(issue=>issue.description.includes('foammy')).quantity,43);
  assert.equal(hilton.find(issue=>issue.description.includes('botellas')).quantity,2);
  assert.equal(hilton.find(issue=>issue.description.includes('NEON')).quantity,null);
  assert.ok(issues.find(issue=>issue.event==='El pulte Golf'&&issue.description.includes('generador')));
  assert.ok(issues.find(issue=>issue.event==='El pulte Golf'&&issue.description.includes('tarima')));
  assert.ok(issues.find(issue=>issue.event==='El pulte Golf'&&issue.description.includes('matiz')));
  assert.equal(tikal.find(issue=>issue.description.startsWith('barras LED')).quantity,250);
  assert.equal(tikal.find(issue=>issue.description.startsWith('lentes LED')).quantity,150);
  assert.equal(tikal.find(issue=>issue.description.startsWith('accesorios')).quantity,300);
  assert.ok(!issues.some(issue=>issue.event==='Acacias de Cayala'||issue.event==='Mil Flores, Antigua'));
});
