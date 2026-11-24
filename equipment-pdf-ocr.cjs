'use strict';
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const execute = promisify(execFile);
const failure = message => Object.assign(new Error(message),{code:'EQUIPMENT_PDF_OCR_REVIEW',statusCode:400});

function parseTsv(tsv,{pageNumber=1,dpi=200,pageHeight=800}={}) {
  const rows = String(tsv).split(/\r?\n/), words = [], uncertain = [];
  const headings = rows.shift()?.split('\t') || [];
  const at = Object.fromEntries(headings.map((name,index)=>[name,index]));
  if (!['level','left','top','width','height','conf','text'].every(name=>Number.isInteger(at[name]))) throw failure('La lectura OCR no devolvió posiciones verificables. Use un PDF digital o el Excel original.');
  for (const row of rows) {
    const fields=row.split('\t'), value=fields.slice(at.text).join('\t').trim();
    if(Number(fields[at.level])!==5 || !value)continue;
    const [left,top,width,height,confidence]=['left','top','width','height','conf'].map(name=>Number(fields[at[name]]));
    if(![left,top,width,height,confidence].every(Number.isFinite)||left<0||top<0||width<0||height<=0)throw failure('Hay posiciones OCR incompletas. No se cargaron cantidades inferidas.');
    const scale=72/dpi, item={str:value,transform:[1,0,0,height*scale,left*scale,pageHeight-(top+height)*scale],width:width*scale,height:height*scale,ocrConfidence:confidence};
    words.push(item);
    if(words.length>10000)throw failure('La página supera el límite de seguridad de 10,000 fragmentos OCR. Divida el documento sin eliminar información.');
    if(confidence<90)uncertain.push({page:pageNumber,text:value,confidence,left,top,width,height});
  }
  if(!words.length)throw failure(`Página ${pageNumber}: no se pudo reconocer texto legible. Use un escaneo más claro, un PDF digital o el Excel original.`);
  return {items:words,uncertain,minimumConfidence:Math.min(...words.map(word=>word.ocrConfidence)),requiresReview:true};
}

async function readPage(buffer,{pageNumber=1,pageHeight=800,pageWidth=600,dpi=200,timeoutMs=20000,run=execute,temporaryRoot=os.tmpdir()}={}) {
  if(!Number.isInteger(pageNumber)||pageNumber<1||!Buffer.isBuffer(buffer)&&!(buffer instanceof Uint8Array))throw failure('No se recibió una página PDF válida para OCR.');
  const directory=await fs.mkdtemp(path.join(temporaryRoot,'equipment-pdf-ocr-'));
  try {
    if(![pageHeight,pageWidth,dpi].every(value=>Number.isFinite(value)&&value>0))throw failure('El PDF no contiene dimensiones de página válidas para OCR.');
    // Limit raster memory, not the user's number of events. Oversized page
    // geometries cannot force Poppler to allocate an unbounded bitmap.
    dpi=Math.min(dpi,200,72*Math.sqrt(16000000/(pageHeight*pageWidth)));
    if(dpi<50)throw failure('La página es demasiado grande para reconocerla con claridad dentro del límite de memoria. Use el Excel original o divida la página.');
    const input=path.join(directory,'source.pdf'), output=path.join(directory,'page');
    await fs.writeFile(input,buffer,{mode:0o600});
    const options={timeout:timeoutMs,maxBuffer:16*1024*1024,windowsHide:true};
    await run('pdftoppm',['-f',String(pageNumber),'-l',String(pageNumber),'-singlefile','-r',String(dpi),'-png',input,output],options);
    const result=await run('tesseract',[output+'.png','stdout','-l','spa+eng','--psm','6','tsv'],options);
    return parseTsv(result.stdout,{pageNumber,dpi,pageHeight});
  } catch(error) {
    if(error.code==='EQUIPMENT_PDF_OCR_REVIEW')throw error;
    if(error.code==='ENOENT')throw failure('El lector OCR no está disponible en el servidor. Use el Excel original o un PDF con texto seleccionable.');
    throw failure(error.killed||error.code==='ETIMEDOUT'?'La lectura OCR excedió el tiempo de seguridad. Use un escaneo más claro o el Excel original.':'No se pudo verificar el texto del escaneo. Use un PDF digital o el Excel original.');
  } finally {await fs.rm(directory,{recursive:true,force:true});}
}
module.exports={readPage,parseTsv};
