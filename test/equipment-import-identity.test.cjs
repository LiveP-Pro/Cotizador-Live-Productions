'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Identity=require('../equipment-import-identity.js');
const copy=value=>JSON.parse(JSON.stringify(value));
function event({id='new',sha='bytes-A',file='Agenda sintética.xlsx',block=1,column=1,note='Nota original'}={}){
  const cells=[{ref:'xlsx:1:A1',sheet:'Fuente sintética',row:1,column,address:'A1',value:0,note},{ref:'xlsx:1:B1',sheet:'Fuente sintética',row:1,column:column+1,address:'B1',value:'Equipo sintético'}];
  return {id,date:'2026-11-23',client:'Cliente sintético',place:'Lugar sintético',sections:[{title:'Categoría sintética',items:[{quantity:0,description:'Equipo sintético'}]}],sourceCells:copy(cells),sourceImport:{fileName:file,format:'xlsx',sha256:sha,sheet:'Fuente sintética',block,metadata:{parsedDate:'2026-11-23',client:'Cliente sintético',place:'Lugar sintético'},sourceCells:cells}};
}
test('same exact source reuses the edited draft; identical Excel content with different ZIP bytes remains the same event',()=>{
  const current=event({id:'saved'}),incoming=event();current.place='Edición del usuario';current.sections[0].items[0].quantity=8;
  assert.equal(Identity.match(incoming,[current]).kind,'exact');
  incoming.sourceImport.sha256='bytes-of-new-zip';incoming.sourceImport.byteLength=1234;
  incoming.sourceImport.sourceCells.forEach(cell=>{cell.ref=cell.ref.replace('xlsx:1','xlsx:92');cell.sourceOrder=400;});
  assert.equal(Identity.sameSourceEvent(incoming,current),true);
  assert.equal(current.sections[0].items[0].quantity,8);
});
test('changing a source zero, note, category or source row never silently reuses an older version',()=>{
  const current=event({id:'saved'});
  for(const mutate of [e=>e.sourceImport.sourceCells[0].value=1,e=>e.sourceImport.sourceCells[0].note='Nota corregida',e=>e.sourceImport.sourceCells.push({row:2,column:1,value:'OTRA CATEGORÍA'}),e=>e.sourceImport.sourceCells.push(copy(e.sourceImport.sourceCells[0]))]){
    const incoming=event({sha:'new-bytes'});mutate(incoming);
    assert.equal(Identity.match(incoming,[current]).kind,'revision');assert.equal(Identity.sameSourceEvent(incoming,current),false);
  }
});
test('equal equipment in independent source blocks or files only proposes a review and never auto merges',()=>{
  const current=event({id:'saved'});
  const parallel=event({block:2,column:4});assert.notEqual(Identity.match(parallel,[current]).kind,'exact');
  const pdf=event({sha:'pdf-bytes',file:'Agenda sintética.pdf'});pdf.sourceImport.format='pdf';
  assert.equal(Identity.match(pdf,[current]).kind,'similar');assert.equal(Identity.sameSourceEvent(pdf,current),false);
  pdf.sections[0].items[0].quantity=15;assert.equal(Identity.match(pdf,[current]).kind,'similar');assert.equal(Identity.sameSourceEvent(pdf,current),false);
  const other=event({file:'Otro libro.xlsx',sha:'other-bytes'});other.date='2026-11-24';other.sourceImport.metadata.parsedDate=other.date;
  assert.equal(Identity.match(other,[current]).kind,'none');
});
test('multiple already duplicated sources require a decision and cancelled drafts are not resurrected',()=>{
  const incoming=event(),first=event({id:'a'}),second=event({id:'b'});
  assert.equal(Identity.match(incoming,[first,second]).kind,'ambiguous');
  first.status='cancelled';assert.equal(Identity.match(incoming,[first]).kind,'none');
});
test('a source without client identity stays consistent when prepareEvents fills its display name from the place',()=>{
  const incoming=event({file:'Fuente nueva.pdf',sha:'pdf-bytes'});delete incoming.sourceImport.metadata.client;incoming.client='';incoming.name='';
  const existing=copy(incoming);existing.id='already-loaded';existing.sourceImport.fileName='Fuente previa.xlsx';existing.sourceImport.sha256='other-bytes';existing.name=existing.place;
  const before=Identity.match(incoming,[existing]).kind;
  incoming.name=incoming.place;
  assert.equal(Identity.match(incoming,[existing]).kind,before);assert.equal(before,'none');
});
