'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),ExcelJS=require('exceljs');
const {parseEventFile}=require('../equipment-event-import.cjs');
const pdf=require('./helpers/synthetic-equipment-pdf.cjs');
async function workbook(tail){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Fuente sintética');
  [['Nombre del cliente','Cliente sintético'],['Lugar','Sitio sintético'],['Fecha','23/11/2026'],['Cantidad','Descripción'],[0,'Fuente con cable ac'],[2,'Equipo sintético']].forEach(row=>sheet.addRow(row));
  tail.forEach(row=>sheet.addRow(row));
  return Buffer.from(await book.xlsx.writeBuffer());
}
test('exact two-column note and provenance labels after Excel equipment remain notes with all cells and the source zero',async()=>{
  const labels=['Observación','Observaciones','Nota','Notas','Nota(s)','Fuente','Sitio','Fuente de inventario','Sitio fuente','Importante','Observación:','Nota.','Sitio -'];
  const preview=await parseEventFile(await workbook(labels.map((label,index)=>[label,`Texto literal sintético ${index}`,0])),{fileName:'notas-explicitas-sinteticas.xlsx'}),event=preview.events[0];
  assert.equal(preview.verification.complete,true);assert.equal(preview.sourceCells.length,12+labels.length*3);
  assert.equal(event.itemCount,2);assert.equal(event.zeroCount,1);assert.equal(event.canImport,true,JSON.stringify(event.issues));
  assert.equal(event.issues.some(issue=>issue.code==='invalid_quantity'),false);
  const notes=event.sections.flatMap(section=>section.rows).filter(row=>row.sourceRow>=7);
  assert.equal(notes.length,labels.length);assert.ok(notes.every(row=>row.type==='note'&&row.cells.length===3&&row.cells[2].value===0));
  assert.deepEqual(notes.map(row=>row.cells[0].value),labels);
});
test('two-column PDF notes and provenance labels do not become equipment or invalid quantities',async()=>{
  const rows=[[40,780,'Nombre del cliente: Cliente sintetico'],[40,760,'Lugar: Sitio sintetico'],[40,740,'Fecha: 23/11/2026'],[40,710,'Cantidad'],[160,710,'Descripcion'],[40,680,'0'],[160,680,'Fuente con cable ac']];
  for(const [index,label] of ['Observacion','Notas','Fuente','Sitio'].entries())rows.push([40,650-index*25,label],[160,650-index*25,'Texto literal sintetico']);
  const preview=await parseEventFile(pdf([rows]),{fileName:'notas-explicitas-sinteticas.pdf'}),event=preview.events[0];
  assert.equal(preview.verification.complete,true);assert.equal(event.itemCount,1);assert.equal(event.zeroCount,1);assert.equal(event.canImport,true,JSON.stringify(event.issues));
  const notes=event.sections.flatMap(section=>section.rows).filter(row=>row.cells.some(cell=>['Observacion','Notas','Fuente','Sitio'].includes(cell.value)));
  assert.equal(notes.length,4);assert.ok(notes.every(row=>row.type==='note'));
});
test('a longer equipment phrase beginning with Fuente, Sitio or Observacion still requires a valid quantity',async()=>{
  for(const phrase of ['Fuente con cable ac','Sitio de equipo','Observación extendida','Notas para equipo']){
    const preview=await parseEventFile(await workbook([[phrase,'Descripción del equipo pendiente']]),{fileName:'cantidad-pendiente-sintetica.xlsx'});
    assert.equal(preview.verification.complete,true);assert.ok(preview.events[0].issues.some(issue=>issue.code==='invalid_quantity'),phrase);
    assert.equal(preview.events[0].sections.flatMap(section=>section.items).length,2);
    assert.ok(preview.events[0].sourceCells.some(cell=>cell.value===phrase));
  }
});
