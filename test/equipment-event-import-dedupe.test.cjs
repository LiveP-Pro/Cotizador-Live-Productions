'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),ExcelJS=require('exceljs');
const {parseEventFile,verifyEventImport}=require('../equipment-event-import.cjs');
const batch=require('../equipment-batch-events.js'),pdf=require('./helpers/synthetic-equipment-pdf.cjs');
const page=(date='23/11/2026',y=670)=>[[40,780,'Nombre del cliente: Cliente sintetico'],[40,760,'Lugar: Sitio sintetico'],[40,740,'Fecha: '+date],[40,710,'Cantidad'],[160,710,'Descripcion'],[40,y,'0'],[160,y,'Equipo cero sintetico'],[40,y-30,'2'],[160,y-30,'Equipo repetido sintetico']];
test('a byte-identical rendered PDF page is a complete auditable reference, while active zero and equipment count once',async()=>{
  const preview=await parseEventFile(pdf([page(),page()]),{fileName:'pagina-repetida-sintetica.pdf'});
  assert.equal(preview.events.length,1);const event=preview.events[0];
  assert.equal(event.itemCount,2);assert.equal(event.zeroCount,1);assert.equal(event.sourceImport.referenceTables.length,1);
  assert.equal(event.sourceImport.referenceTables[0].zeroCount,1);assert.deepEqual(event.sourceImport.referenceTables[0].sections.flatMap(section=>section.items.map(item=>item.quantity)),[0,2]);
  assert.equal(event.sourceImport.duplicatePageDecisions[0].duplicateOf,1);assert.equal(event.sourceImport.duplicatePageDecisions[0].page,2);
  assert.equal(event.sourceImport.referenceTables[0].sourceCells.every(cell=>cell.page===2),true);
  assert.ok(event.warnings.some(warning=>warning.code==='repeated_pdf_page'));
  assert.equal(preview.verification.complete,true,JSON.stringify(preview.verification));
  assert.equal(preview.verification.sourceCellCount,preview.verification.representedCellCount);
  event.sourceImport.referenceTables[0].sourceCells[0].value='changed';assert.equal(verifyEventImport(preview).complete,false);
});
test('equal legitimate PDF rows at distinct positions and continuation pages remain separate source occurrences',async()=>{
  const preview=await parseEventFile(pdf([page(),page('23/11/2026',640)]),{fileName:'continuacion-sintetica.pdf'});
  assert.equal(preview.events.length,1);assert.equal(preview.events[0].itemCount,4);assert.equal(preview.events[0].zeroCount,2);
  assert.equal(preview.events[0].sourceImport.duplicatePageDecisions,undefined);assert.equal(preview.verification.complete,true);
});
test('identical overprinted PDF text at the exact same position is read once while every original fragment is retained',async()=>{
  const preview=await parseEventFile(pdf([page().flatMap(fragment=>[fragment,fragment])]),{fileName:'texto-superpuesto-sintetico.pdf'});
  assert.equal(preview.events.length,1);assert.equal(preview.events[0].itemCount,2);assert.equal(preview.events[0].zeroCount,1);
  assert.ok(preview.sourceCells.some(cell=>cell.duplicateOf));assert.ok(preview.events[0].warnings.some(warning=>warning.code==='repeated_pdf_text'));
  assert.equal(preview.verification.complete,true,JSON.stringify(preview.verification));
});
test('a date-only change splits PDF events before their repeated client and place metadata, without losing cells',async()=>{
  const preview=await parseEventFile(pdf([page(),page('24/11/2026')]),{fileName:'dos-fechas-sinteticas.pdf'});
  assert.equal(preview.events.length,2);assert.deepEqual(preview.events.map(event=>event.date),['2026-11-23','2026-11-24']);
  assert.ok(preview.events.every(event=>event.place==='Sitio sintetico'&&event.client==='Cliente sintetico'&&event.itemCount===2));
  assert.equal(preview.verification.complete,true,JSON.stringify(preview.verification));
});
test('a different note or category in parallel Excel tables prevents an anonymous table being silently treated as a copy',async()=>{
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Fuente sintética');
  [['Nombre del cliente','Cliente sintetico','',''],['Lugar','Sitio sintetico','',''],['Fecha','23/11/2026','',''],['Cantidad','Descripcion','Cantidad','Descripcion'],[0,'Equipo sintetico',0,'Equipo sintetico'],[2,'Otro equipo',2,'Otro equipo']].forEach(row=>sheet.addRow(row));
  sheet.getCell('D5').note='Nota distinta del cuadro anónimo';
  const preview=await parseEventFile(Buffer.from(await book.xlsx.writeBuffer()),{fileName:'notas-distintas.xlsx'});
  assert.equal(preview.events.length,2);assert.equal(preview.referenceTableCount,0);assert.equal(preview.verification.complete,true);
});
test('scanned event text requires a visible row review; uncertain OCR quantities cannot be accepted as ordinary warnings',async()=>{
  const items=page().map(([x,y,str])=>({str,transform:[1,0,0,12,x,y],width:str.length*6,height:12,ocrConfidence:99}));
  const preview=await parseEventFile(pdf([[]],{image:true}),{fileName:'scan-sintetico.pdf',ocrPage:async()=>({items,minimumConfidence:99,uncertain:[]})});
  assert.equal(preview.events[0].itemCount,2);assert.equal(preview.events[0].zeroCount,1);assert.equal(preview.verification.complete,true);
  const selections=batch.selectionsFor(preview);assert.match(batch.selectionError(preview,selections),/PDF original/);
  selections[0].ocrReviewed=true;assert.equal(batch.selectionError(preview,selections),'');
  const draft=batch.prepareEvents(preview,selections,{acknowledgeWarnings:true})[0];assert.equal(draft.sourceImport.ocrReview.reviewed,true);
  preview.events[0].sourceCells.find(cell=>cell.value==='0').ocrConfidence=65;
  assert.match(batch.selectionError(preview,selections),/poco legibles/);assert.throws(()=>batch.prepareEvents(preview,selections,{acknowledgeWarnings:true}),/poco legibles/);
});
test('mixed-case bold PDF source headings preserve Audio, Pedestales and Luces while ordinary similar notes and legitimate repeated equipment remain intact',async()=>{
  const rows=[[40,780,'Nombre del cliente: Cliente sintetico'],[40,760,'Lugar: Lugar sintetico'],[40,740,'Fecha: 23/11/2026'],[40,710,'Cantidad',true],[160,710,'Descripcion',true],
    [160,690,'SONIDO',true],[160,670,'Audio',true],[40,650,'0'],[160,650,'Equipo sintetico A'],[40,630,'2'],[160,630,'Equipo sintetico A'],
    [160,610,'Pedestales'],[40,590,'3'],[160,590,'Equipo sintetico B'],[160,570,'Pedestales',true],[40,550,'2'],[160,550,'Equipo sintetico C'],
    [160,530,'Nota: Luces',true],[160,510,'Luces',true],[40,490,'4'],[160,490,'Equipo sintetico D'],[160,470,'Luces',true],[40,450,'4'],[160,450,'Equipo sintetico D']];
  const preview=await parseEventFile(pdf([rows]),{fileName:'categorias-tipografia-sintetica.pdf'}),event=preview.events[0];
  assert.equal(preview.verification.complete,true,JSON.stringify(preview.verification));assert.equal(event.itemCount,6);assert.equal(event.zeroCount,1);
  assert.deepEqual(event.sections.filter(section=>section.items.length).map(section=>({title:section.title,quantities:section.items.map(item=>item.quantity)})),[{title:'Audio',quantities:[0,2,3]},{title:'Pedestales',quantities:[2]},{title:'Luces',quantities:[4,4]}]);
  assert.ok(event.sections.some(section=>section.title==='SONIDO'));
  const notes=event.sections.flatMap(section=>section.rows).filter(row=>row.type==='note').map(row=>row.description);
  assert.ok(notes.includes('Pedestales'));assert.ok(notes.includes('Nota: Luces'));
  assert.ok(preview.sourceCells.some(cell=>cell.value==='Audio'&&cell.fontBold===true&&cell.isHeading===true));
  assert.ok(preview.sourceCells.some(cell=>cell.value==='Pedestales'&&cell.fontBold===false));
});
