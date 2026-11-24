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
