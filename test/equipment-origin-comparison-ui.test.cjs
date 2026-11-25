'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {harness,copy}=require('./helpers/equipment-draft-transfer-harness.cjs');

function event(id,day,quantities,extra={}) {
 const date=`2026-11-${day}`;
 return {id:id.toLowerCase().replace(/[^a-z0-9-]/g,'-'),name:id,place:'Sede sintética',date,setupApplies:true,
  setupAt:`${date}T08:00`,startAt:`${date}T10:00`,endAt:`${date}T18:00`,equipmentInAt:'2026-11-28T12:00',
  sourceCells:[{address:'A1',value:0},{address:'B1',value:'Nota original'}],
  sections:[{title:'Prueba',items:Object.entries(quantities).map(([id,quantity])=>({warehouseInventoryId:id,description:`Referencia ${id}`,quantity}))}],...extra};
}
const inventory={savedAt:'current-synthetic',state:{items:['a','b'].map(id=>({id,name:`Referencia ${id}`,quantity:2,itemType:'equipo'})),movements:[]}};

test('muestra los tres orígenes por destino y concentra el kit completo antes de repartir referencias',async()=>{
 const events=[event('Parcial A','25',{a:1}),event('Completo AB','25',{a:1,b:1}),event('Parcial B','25',{b:1}),event('Destino','26',{a:1,b:1})];
 const h=harness({events});h.setStock(inventory);const before=copy(h.events());await h.api.show(); await h.openEditor();
 const comparisons=h.get('.equipment-draft-origin-comparisons');assert.ok(comparisons);
 const text=comparisons.textContent;assert.match(text,/3 orígenes comparados/);
 for(const name of ['Parcial A','Completo AB','Parcial B'])assert.match(text,new RegExp(name));
 const rows=comparisons.querySelectorAll('tbody').flatMap(body=>body.querySelectorAll('tr'));
 const full=rows.find(row=>row.textContent.includes('Completo AB'));assert.match(full.textContent,/Cuadro prioritario/);
 assert.match(full.textContent,/1 × Referencia a/);assert.match(full.textContent,/1 × Referencia b/);
 for(const name of ['Parcial A','Parcial B']){
  const row=rows.find(row=>row.textContent.includes(name));assert.doesNotMatch(row.textContent,/Cuadro prioritario/);
  assert.match(row.textContent,/Sin aporte automático adicional/);
 }
 const plan=h.planFor(h.calls.at(-1));assert.equal(plan.selectedTransfers.length,2);
 assert.ok(plan.selectedTransfers.every(route=>route.fromEventId==='completo-ab'&&route.toEventId==='destino'));
 assert.deepEqual(h.events(),before);assert.equal(h.updates.length,0);
 await h.click('[data-draft-close]');assert.deepEqual(h.events(),before);
});

test('separa día del evento y liberación tras medianoche; montaje y celebración siguen vinculados',async()=>{
 const events=[event('Origen <variable>','25',{a:1},{startAt:'2026-11-25T22:00',endAt:'2026-11-26T02:00'}),
  event('Destino','27',{a:1},{setupAt:'2026-11-26T08:00'})];
 const h=harness({events});h.setStock(inventory);await h.api.show(); await h.openEditor();
 const host=h.get('.equipment-draft-origin-comparisons');assert.ok(host);
 assert.match(host.textContent,/25\/11\/2026/);assert.match(host.textContent,/2026-11-26 02:00/);
 assert.match(host.textContent,/Origen <variable>/);assert.equal(host.querySelector('variable'),null);
 assert.match(host.textContent,/26\/11\/2026/);
 const calendar=h.get('[data-draft-calendar]').textContent;assert.match(calendar,/26\/11\/2026/);assert.match(calendar,/27\/11\/2026/);
 assert.equal(h.events().length,2);assert.equal(h.planFor(h.calls.at(-1)).rows.find(row=>row.warehouseInventoryId==='a').demand,2);
});
