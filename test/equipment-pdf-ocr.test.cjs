'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {parseTsv,readPage}=require('../equipment-pdf-ocr.cjs');
const tsv=confidence=>'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t20\t30\t10\t20\t'+confidence+'\t0\n5\t1\t1\t1\t1\t2\t100\t30\t100\t20\t98\tEquipo sintético\n';
test('OCR preserves literal zero and geometry, exposes low confidence and never substitutes a quantity',()=>{
  const result=parseTsv(tsv(87),{pageNumber:2,dpi:200,pageHeight:800});
  assert.equal(result.items[0].str,'0');assert.equal(result.items[0].ocrConfidence,87);assert.equal(result.uncertain.length,1);assert.equal(result.uncertain[0].page,2);assert.equal(result.requiresReview,true);
  assert.equal(parseTsv(tsv(99)).uncertain.length,0);
  assert.throws(()=>parseTsv('incomplete'),/posiciones verificables/);
  assert.throws(()=>parseTsv(tsv(99).split('\n')[0]),/no se pudo reconocer texto/);
});
test('local OCR uses argument arrays, Spanish and English models, bounded processes and removes all temporary files',async()=>{
  const calls=[];
  const result=await readPage(Buffer.from('synthetic source only'),{pageNumber:3,run:async(command,args,options)=>{calls.push({command,args,options});return {stdout:command==='tesseract'?tsv(99):''};}});
  assert.equal(result.items.length,2);assert.deepEqual(calls.map(call=>call.command),['pdftoppm','tesseract']);
  assert.ok(calls[0].args.includes('3'));assert.ok(calls[1].args.includes('spa+eng'));assert.equal(calls[0].options.shell,undefined);assert.equal(calls[0].options.timeout,20000);
  const directory=path.dirname(calls[0].args.at(-1));await assert.rejects(fs.access(directory),{code:'ENOENT'});
});
test('missing OCR binaries and timeout fail visibly without returning partial inventory data',async()=>{
  await assert.rejects(readPage(Buffer.from('synthetic'),{run:async()=>{throw Object.assign(new Error('missing'),{code:'ENOENT'});}}),/OCR no está disponible/);
  await assert.rejects(readPage(Buffer.from('synthetic'),{run:async()=>{throw Object.assign(new Error('timeout'),{killed:true});}}),/tiempo de seguridad/);
});

function variedGlyphTsv(day){
  const rows=['level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext'];
  const values=[['Cliente:',`Cliente sintetico ${day}`],['Ubicación:',`Lugar sintetico ${day}`],['Fecha:',`${day}/11/2026`],
    ['Fecha y hora del montaje:',`${day}/11/2026 08:00`],['Fecha y hora de inicio:',`${day}/11/2026 10:00`],
    ['Fecha y hora de finalización:',`${day}/11/2026 12:00`],['Fecha y hora de regreso a bodega:',`${day}/11/2026 13:00`],
    ['Cantidad','Descripción'],['1','Equipo sintetico'],['2','Consumible sintetico'],['0','Control sintetico']];
  for(const [line,columns]of values.entries()){
    let word=0;
    for(const [column,value]of columns.entries()){
      let left=column===0?40:310;
      for(const token of value.split(' ')){
        const height=word%2?26:12,width=token.length*5;
        rows.push([5,1,1,1,line+1,++word,left,35+line*50,width,height,99,token].join('\t'));left+=width+4;
      }
    }
  }
  return rows.join('\n');
}
test('native TSV line identity preserves varied glyph coordinates without mixing paragraphs or pages',()=>{
  const result=parseTsv(variedGlyphTsv(24),{pageNumber:2,dpi:72,pageHeight:800}),words=result.items;
  assert.equal(words[0].ocrLineId,words[1].ocrLineId);assert.notEqual(words[0].ocrLineId,words[4].ocrLineId);
  assert.notEqual(words[0].transform[5],words[1].transform[5],'original baselines remain literal, not flattened');
  assert.deepEqual(words[0].ocrPosition,{page:1,block:1,paragraph:1,line:1,word:1,left:40,top:35,width:40,height:12});
  const otherPage=parseTsv(variedGlyphTsv(24),{pageNumber:3,dpi:72,pageHeight:800});
  assert.notEqual(words[0].ocrLineId,otherPage.items[0].ocrLineId);
  const otherParagraph=parseTsv(variedGlyphTsv(24).replace(/5\t1\t1\t1\t2\t/g,'5\t1\t1\t2\t1\t'),{pageNumber:2,dpi:72,pageHeight:800});
  assert.notEqual(otherParagraph.items[0].ocrLineId,otherParagraph.items[4].ocrLineId);
});
test('three scanned event pages use TSV lines to retain metadata, hours, every word and zeros despite variable glyph heights',async()=>{
  const {parseEventFile}=require('../equipment-event-import.cjs'),batch=require('../equipment-batch-events.js'),pdf=require('./helpers/synthetic-equipment-pdf.cjs');
  const recognized=[24,25,26].map((day,index)=>parseTsv(variedGlyphTsv(day),{pageNumber:index+1,dpi:72,pageHeight:800}));
  const preview=await parseEventFile(pdf([[],[],[]],{image:true}),{fileName:'tres-escaneos-sinteticos.pdf',ocrPage:async(_bytes,{pageNumber})=>recognized[pageNumber-1]});
  assert.equal(preview.events.length,3);assert.equal(preview.itemCount,9);assert.equal(preview.zeroCount,3);assert.equal(preview.verification.complete,true,JSON.stringify(preview.verification));
  assert.equal(preview.sourceCells.length,recognized.reduce((total,page)=>total+page.items.length,0),'every recognized word is conserved');
  for(const [index,event]of preview.events.entries()){
    const day=24+index;assert.equal(event.client,`Cliente sintetico ${day}`);assert.equal(event.place,`Lugar sintetico ${day}`);assert.equal(event.date,`2026-11-${day}`);
    for(const [field,time]of [['setupAt','08:00'],['startAt','10:00'],['endAt','12:00'],['equipmentInAt','13:00']])assert.equal(event[field],`2026-11-${day}T${time}`);
    assert.equal(event.itemCount,3);assert.equal(event.zeroCount,1);
  }
  assert.deepEqual(preview.sourceCells[0].ocrPosition,recognized[0].items[0].ocrPosition);
  const selections=batch.selectionsFor(preview);assert.match(batch.selectionError(preview,selections),/PDF original/);
  selections.forEach(selection=>{selection.ocrReviewed=true;});assert.equal(batch.selectionError(preview,selections),'');
  recognized[0].items[0].ocrConfidence=89;recognized[0].minimumConfidence=89;recognized[0].uncertain=[{page:1,text:recognized[0].items[0].str,confidence:89}];
  const uncertain=await parseEventFile(pdf([[],[],[]],{image:true}),{fileName:'tres-escaneos-inciertos-sinteticos.pdf',ocrPage:async(_bytes,{pageNumber})=>recognized[pageNumber-1]});
  const accepted=batch.selectionsFor(uncertain);accepted.forEach(selection=>{selection.ocrReviewed=true;});
  assert.equal(uncertain.events.length,3);assert.equal(uncertain.sourceCells.length,preview.sourceCells.length);assert.equal(uncertain.verification.complete,true);
  assert.match(batch.selectionError(uncertain,accepted),/poco legibles/,'native line grouping never weakens confidence guard');
});
