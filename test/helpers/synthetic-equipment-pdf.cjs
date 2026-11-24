'use strict';
// Tiny selectable-text PDFs and optional raster rectangles, entirely synthetic.
module.exports=function pdf(pages,{image=false}={}){
  const escape=value=>String(value).replace(/[\\()]/g,'\\$&');
  const objects=[null,'<< /Type /Catalog /Pages 2 0 R >>',null,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  let imageId=0;
  if(image){imageId=objects.length;objects.push('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\nabc\nendstream');}
  const ids=[];
  for(const rows of pages){
    const page=objects.length,content=page+1;ids.push(page);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${image?`/XObject << /Scan ${imageId} 0 R >>`:''} >> /Contents ${content} 0 R >>`);
    const commands=rows.map(([x,y,value,strong=false])=>`BT /${strong?'F2':'F1'} 12 Tf ${x} ${y} Td (${escape(value)}) Tj ET`).join('\n')+(image?'\nq 500 0 0 700 40 40 cm /Scan Do Q':'');
    objects.push(`<< /Length ${Buffer.byteLength(commands)} >>\nstream\n${commands}\nendstream`);
  }
  objects[2]=`<< /Type /Pages /Kids [${ids.map(id=>`${id} 0 R`).join(' ')}] /Count ${ids.length} >>`;
  const chunks=[Buffer.from('%PDF-1.4\n')],offsets=[0];let size=chunks[0].length;
  for(let id=1;id<objects.length;id++){offsets[id]=size;const chunk=Buffer.from(`${id} 0 obj\n${objects[id]}\nendobj\n`);chunks.push(chunk);size+=chunk.length;}
  chunks.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(chunks);
};
