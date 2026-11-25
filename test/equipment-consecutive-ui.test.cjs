'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../equipment-draft-transfers.js');
const {harness,fixtureEvents,fixtureInventory,copy}=require('./helpers/equipment-draft-transfer-harness.cjs');

function setupFixture(){
 const events=fixtureEvents();
 events[0].name='Celebración cambiante';events[0].date='2026-11-25';events[0].setupAt='2026-11-25T08:00';events[0].startAt='2026-11-25T10:00';events[0].endAt='2026-11-25T18:00';events[0].equipmentInAt='2026-11-28T12:00';
 for(const [index,event] of events.slice(1).entries()){
  event.name=`Destino variable ${index}`;event.date='2026-11-27';event.setupAt='2026-11-26T08:00';event.startAt='2026-11-27T12:00';event.endAt='2026-11-27T18:00';event.equipmentInAt='2026-11-28T12:00';
 }
 return events;
}
function splitFixture(){
 const events=setupFixture();
 for(const [index,event] of events.entries()){
  event.sections[0].items=[{id:`a-${index}`,warehouseInventoryId:'synthetic-a',quantity:index===2?0:1,description:'Referencia A'},{id:`b-${index}`,warehouseInventoryId:'synthetic-b',quantity:index===1?0:1,description:'Referencia B'}];
 }
 const inventory={savedAt:'synthetic-current',state:{items:[{id:'synthetic-a',name:'Referencia A',itemType:'equipo',quantity:1},{id:'synthetic-b',name:'Referencia B',itemType:'equipo',quantity:1}],movements:[]}};
 return {events,inventory};
}
function stockWithReplacement(){const inventory=fixtureInventory();inventory.state.items.push({id:'synthetic-replacement',name:'Reemplazo distinto',itemType:'equipo',category:'Pruebas',quantity:3});return inventory;}
async function previewReplacement(h){
 const line=h.get('[data-draft-substitution-line="0"]');line.value='0:0';await line.emit('change');
 h.get('[data-draft-substitution-inventory="0"]').value='synthetic-replacement';
 h.get('[data-draft-substitution-reason="0"]').value='Compatibilidad técnica comprobada manualmente para este evento.';
 h.get('[data-draft-substitution-compatible="0"]').checked=true;
 await h.click('[data-draft-substitute="0"]');
}

test('selección automática usa sólo el destino principal y nunca todas las alternativas',()=>{
 const plan={candidates:[{id:'primary',fromEventId:'A',toEventId:'B'},{id:'other',fromEventId:'A',toEventId:'C'},{id:'pending',requiresManualReview:true}],routeBundles:[{recommended:true,status:'ready',recommendedTransferIds:['primary']},{recommended:false,status:'ready',recommendedTransferIds:['other']},{recommended:true,status:'review',recommendedTransferIds:['pending']}]};
 assert.deepEqual(UI.recommendedIds(plan),['primary']);assert.deepEqual(UI.recommendedIds(plan,[{id:'primary',quantity:0}]),[]);
 plan.candidates[0].quantity=3;plan.candidates[0].recommendedQuantity=1;assert.deepEqual(UI.recommendedEdits(plan,['primary']),[{id:'primary',quantity:1,note:''}]);
 assert.deepEqual(UI.originDestinations(['primary','other'],plan.candidates,'A'),['B','C']);
});

test('calendario muestra montaje en su fecha real, sin cambiar las fuentes al renombrar eventos',async()=>{
 const events=setupFixture();events[1].sourceImport={sourceCells:[{ref:'fixture:A1',value:'Nombre literal original'}]};const before=copy(events);
 const h=harness({events});await h.api.show(); await h.openEditor();
 const calendar=h.get('[data-draft-calendar]').textContent;
 assert.match(calendar,/26\/11\/2026/);assert.match(calendar,/Montaje/);assert.match(calendar,/27\/11\/2026/);assert.match(calendar,/Destino variable 0/);
 assert.deepEqual(h.events(),before);assert.equal(h.updates.length,0);
 await h.click('[data-draft-close]');assert.deepEqual(h.events(),before);
});

test('elegir alternativa reemplaza el destino del origen; dividir requiere Aceptar y Cancelar descarta',async()=>{
 const {events,inventory}=splitFixture(),h=harness({events});h.setStock(inventory);await h.api.show(); await h.openEditor();
 let plan=h.planFor(h.calls.at(-1));
 const bundleIndex=plan.routeBundles.findIndex(bundle=>bundle.fromEventId==='event-0'&&bundle.toEventId==='event-1');assert.ok(bundleIndex>=0);
 await h.click(`[data-draft-choose-bundle="${bundleIndex}"]`);
 plan=h.planFor(h.calls.at(-1));assert.deepEqual(plan.selectedTransfers.map(route=>route.toEventId),['event-1']);
 let alternative=plan.candidates.findIndex(route=>route.fromEventId==='event-0'&&route.toEventId==='event-2');assert.ok(alternative>=0);
 const before=h.calls.length;await h.toggle(alternative,true);
 assert.ok(h.get('[data-draft-confirm-accept]'));assert.match(h.get('[data-draft-confirm-close]').parentElement.textContent,/Dividir/);assert.equal(h.calls.length,before);
 await h.click('[data-draft-confirm-cancel]');assert.equal(h.calls.length,before);assert.equal(h.updates.length,0);
 await h.toggle(alternative,true);await h.click('[data-draft-confirm-accept]');
 assert.deepEqual(h.calls.at(-1).body.splitAuthorizedOrigins,['event-0']);
 plan=h.planFor(h.calls.at(-1));assert.equal(plan.selectedTransfers.length,2);assert.equal(plan.invalidSelections.length,0);
 await h.apply();assert.deepEqual(copy(h.api.selection().splitAuthorizedOrigins),['event-0']);assert.deepEqual(copy(h.api.requestOptions().splitAuthorizedOrigins),['event-0']);assert.equal(h.updates.length,1);
});

test('elegir destino alternativo concentra el cuadro y elimina una autorización de división previa',async()=>{
 const {events,inventory}=splitFixture(),h=harness({events});h.setStock(inventory);await h.api.show(); await h.openEditor();
 let plan=h.planFor(h.calls.at(-1)),index=plan.routeBundles.findIndex(bundle=>bundle.toEventId==='event-1');await h.click(`[data-draft-choose-bundle="${index}"]`);
 plan=h.planFor(h.calls.at(-1));const routeIndex=plan.candidates.findIndex(route=>route.toEventId==='event-2');await h.toggle(routeIndex,true);await h.click('[data-draft-confirm-accept]');
 plan=h.planFor(h.calls.at(-1));index=plan.routeBundles.findIndex(bundle=>bundle.toEventId==='event-2');await h.click(`[data-draft-choose-bundle="${index}"]`);
 assert.deepEqual(h.calls.at(-1).body.splitAuthorizedOrigins,[]);plan=h.planFor(h.calls.at(-1));assert.deepEqual(plan.selectedTransfers.map(route=>route.toEventId),['event-2']);
});

test('sustitución se previsualiza con IDs vigentes, conserva ceros y fuente, y Cancelar la descarta',async()=>{
 const events=fixtureEvents();events[0].sections[0].items.push({id:'zero',description:'Fila cero conservada',quantity:0});events[0].sourceImport={sourceCells:[{ref:'fixture:B2',value:0},{ref:'fixture:C2',value:'  Nota literal  '}]};
 const h=harness({events});h.setStock(stockWithReplacement());const before=JSON.stringify(h.events()),stock=JSON.stringify(h.stock());await h.api.show(); await h.openEditor();
 const quantity=h.get('[data-draft-substitution-quantity="0"]');assert.equal(quantity.value,'');
 await previewReplacement(h);
 const requested=h.calls.at(-1).body.events[0];assert.equal(requested.sections[0].items[0].warehouseInventoryId,'synthetic-replacement');assert.equal(requested.sections[0].items[1].quantity,0);assert.deepEqual(requested.sourceImport,events[0].sourceImport);
 assert.match(h.get('[data-draft-substitutions]').textContent,/Unidad sintética → 3 × Reemplazo distinto/);
 assert.equal(JSON.stringify(h.events()),before);assert.equal(h.updates.length,0);assert.equal(JSON.stringify(h.stock()),stock);
 await h.click('[data-draft-close]');assert.equal(JSON.stringify(h.events()),before);assert.equal(JSON.stringify(h.stock()),stock);
});

test('aceptar sustitución requiere confirmación final y aplica la revisión al cuadro sin tocar inventario',async()=>{
 const h=harness();h.setStock(stockWithReplacement());const stock=JSON.stringify(h.stock());await h.api.show(); await h.openEditor();await previewReplacement(h);
 await h.click('[data-draft-apply]');assert.ok(h.get('[data-draft-confirm-accept]'));assert.equal(h.updates.length,0);
 await h.click('[data-draft-confirm-close]');assert.equal(h.updates.length,0);assert.ok(h.api.isOpen());
 await h.apply();assert.equal(h.updates.length,1);assert.equal(h.events()[0].sections[0].items[0].warehouseInventoryId,'synthetic-replacement');assert.equal(h.events()[0].planEquipmentChanges.length,1);assert.equal(JSON.stringify(h.stock()),stock);
});

test('no permite sustitución sin compatibilidad y un inventario cambiado impide aceptar el borrador',async()=>{
 const h=harness();h.setStock(stockWithReplacement());await h.api.show(); await h.openEditor();
 h.get('[data-draft-substitution-line="0"]').value='0:0';h.get('[data-draft-substitution-inventory="0"]').value='synthetic-replacement';h.get('[data-draft-substitution-quantity="0"]').value='3';h.get('[data-draft-substitution-reason="0"]').value='Revisión técnica';
 const count=h.calls.length;await h.click('[data-draft-substitute="0"]');assert.equal(h.calls.length,count);assert.match(h.get('[data-draft-status]').textContent,/Confirme/);assert.equal(h.updates.length,0);
 await previewReplacement(h);const changed=stockWithReplacement();changed.state.items[1].quantity=0;h.setStock(changed);await h.apply();assert.equal(h.updates.length,0);assert.ok(h.api.isOpen());assert.match(h.get('[data-draft-status]').textContent,/cambiaron/);
});
