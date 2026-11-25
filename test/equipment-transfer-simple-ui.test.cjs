'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {harness,copy}=require('./helpers/equipment-draft-transfer-harness.cjs');
function event(id,day,items,extra={}) {
 const date=`2026-11-${day}`;
 return {id,name:`Evento ${id}`,place:`Lugar ${id}`,date,setupApplies:true,setupAt:`${date}T08:00`,startAt:`${date}T10:00`,endAt:`${date}T18:00`,equipmentInAt:'2026-11-29T12:00',sections:[{title:'Equipo',notes:Array.from({length:250},(_,i)=>`Nota fuente conservada ${i}`),items:Object.entries(items).map(([id,quantity])=>({warehouseInventoryId:id,description:`Referencia ${id}`,quantity}))}],...extra};
}
function sixEvents(){
 return [event('origen','26',{consola:2,base:1}),event('destino','28',{consola:3},{setupAt:'2026-11-27T08:00'}),...['a','b','c','d'].map((id,i)=>event(id,'27',{[id]:1}))];
}
function inventory(){return {savedAt:'fuente-sintética-actual',state:{items:['consola','base','a','b','c','d'].map(id=>({id,name:`Referencia ${id}`,quantity:2,itemType:'equipo'})),movements:[]}};}
function setup(){const h=harness({events:sixEvents(),estimates:[{fromPlace:'Lugar origen',toPlace:'Lugar destino',travelMinutes:60,handlingMinutes:30,distanceKm:12}]});h.setStock(inventory());return h;}

test('al abrir trasiego muestra sólo seis eventos y la recomendación con días, porcentaje y tres listas',async()=>{
 const h=setup(),before=copy(h.events()),stock=copy(h.stock());await h.api.show();
 assert.equal(h.get('[data-draft-totals]').textContent,'Tienes 6 eventos');
 const cards=h.modal().querySelectorAll('[data-draft-recommendation]');assert.equal(cards.length,1);
 const card=cards[0];assert.match(card.textContent,/Evento origen/);assert.match(card.textContent,/jueves 26\/11\/2026/);
 assert.match(card.textContent,/Montaje · Evento destino/);assert.match(card.textContent,/viernes 27\/11\/2026/);assert.match(card.textContent,/% de coincidencia/);
 const sections=card.querySelectorAll('section');assert.equal(sections.length,3);
 assert.match(sections[0].textContent,/Equipo que se utilizará/);assert.match(sections[0].textContent,/Referencia consola/);assert.match(sections[0].textContent,/2 ×/);
 assert.match(sections[1].textContent,/Equipo que no se utilizará/);assert.match(sections[1].textContent,/Referencia base/);
 assert.match(sections[2].textContent,/Equipo adicional para completar el evento/);assert.match(sections[2].textContent,/Referencia consola/);assert.match(sections[2].textContent,/1 ×/);
 assert.equal(h.get('[data-draft-editor]').children.length,0,'el editor grande ni siquiera se monta al abrir');
 assert.equal(h.modal().querySelectorAll('input,textarea,table,summary').length,0);
 assert.doesNotMatch(h.modal().textContent,/Resumen de equipo|Renta con esta selección|Compra pendiente|Calendario operativo|Comparar orígenes|Comparar destinos|Nota fuente conservada/);
 assert.deepEqual(h.events(),before);assert.deepEqual(h.stock(),stock);assert.equal(h.updates.length,0);
});

test('el editor sólo aparece al solicitarlo y su apertura no vuelve a calcular ni guardar',async()=>{
 const h=setup();await h.api.show();const calls=h.calls.length;assert.equal(h.get('[data-draft-route]'),null);
 await h.openEditor();assert.ok(h.get('[data-draft-route]'));assert.ok(h.get('[data-draft-event]'));
 assert.equal(h.get('[data-draft-editor]').hidden,false);assert.equal(h.calls.length,calls);assert.equal(h.updates.length,0);
 assert.doesNotMatch(h.get('[data-draft-editor]').textContent,/Renta con esta selección|Compra pendiente/);
 await h.click('[data-draft-toggle-editor]');assert.equal(h.get('[data-draft-editor]').hidden,true);
 await h.click('[data-draft-toggle-editor]');assert.equal(h.get('[data-draft-editor]').hidden,false);assert.equal(h.calls.length,calls);
});

test('una cantidad editada cambia la lista simple; cancelar confirmación y X conservan fuente e inventario',async()=>{
 const h=setup(),before=copy(h.events()),stock=copy(h.stock());await h.api.show();await h.openEditor();
 h.get('[data-draft-quantity="0"]').value='1';h.get('[data-draft-note="0"]').value='Cargar consola en el mismo camión';await h.click('[data-draft-save-edit="0"]');
 const card=h.get('[data-draft-recommendation]');assert.match(card.querySelectorAll('section')[0].textContent,/1 ×/);assert.match(card.textContent,/Cargar consola en el mismo camión/);
 const additional=card.querySelectorAll('section')[2];assert.match(additional.textContent,/Equipo adicional para completar el evento/);assert.match(additional.textContent,/Referencia consola/);assert.match(additional.textContent,/2 ×/);
 await h.click('[data-draft-toggle-editor]');await h.click('[data-draft-apply]');
 assert.ok(h.get('[data-draft-confirm-accept]'));await h.click('[data-draft-confirm-cancel]');assert.equal(h.updates.length,0);
 await h.click('[data-draft-close]');assert.deepEqual(h.events(),before);assert.deepEqual(h.stock(),stock);assert.deepEqual(copy(h.api.selection().selectedTransferIds),[]);
});

test('ocultar editor no pierde cantidades pendientes y aceptar conserva la misma lógica del inventario',async()=>{
 const h=setup(),stock=copy(h.stock());await h.api.show();await h.openEditor();h.get('[data-draft-quantity="0"]').value='1';
 await h.click('[data-draft-toggle-editor]');await h.click('[data-draft-apply]');assert.ok(h.get('[data-draft-confirm-accept]'));assert.equal(h.updates.length,0);
 await h.click('[data-draft-confirm-accept]');assert.equal(h.updates.length,1);assert.equal(h.api.isOpen(),false);
 assert.equal(h.api.selection().transferEdits[0].quantity,1);assert.deepEqual(h.stock(),stock);
});

test('los nombres y equipos del cuadro simple se escapan como texto y no ejecutan HTML',async()=>{
 const bad='<img src=x onerror="alert(1)"><script>alert(2)</script>',h=setup(),events=h.events(),stock=h.stock();
 events[0].name=bad;for(const event of events)for(const item of event.sections[0].items)if(item.warehouseInventoryId==='consola')item.description=bad;stock.state.items.find(item=>item.id==='consola').name=bad;h.setEvents(events);h.setStock(stock);await h.api.show();
 assert.equal(h.modal().querySelectorAll('img,script').length,0);assert.match(h.get('[data-draft-routes]').innerHTML,/&lt;img/);
 assert.match(h.get('[data-draft-routes]').textContent,/<img src=x/);assert.match(h.get('[data-draft-recommendation]').querySelectorAll('section')[2].textContent,/<img src=x/);assert.equal(h.updates.length,0);
});

test('una coincidencia sin viaje verificado se identifica como pendiente y no se ofrece aplicar trasiegos inexistentes',async()=>{
 const h=harness({events:sixEvents(),estimates:[{fromPlace:'Lugar origen',toPlace:'Lugar destino',travelMinutes:60,handlingMinutes:30}]});h.setStock(inventory());await h.api.show();
 assert.match(h.get('[data-draft-recommendation]').className,/needs-review/);
 assert.match(h.get('[data-draft-recommendation]').textContent,/verificar traslado/i);
 assert.match(h.get('.equipment-draft-additional').textContent,/Adicional si se realiza el trasiego propuesto/);assert.match(h.get('.equipment-draft-additional').textContent,/1 ×/);
 assert.equal(h.get('[data-draft-apply]').textContent,'Guardar sin trasiegos');
 assert.deepEqual(h.calls.at(-1).body.selectedTransferIds,[]);assert.equal(h.updates.length,0);
 assert.equal(h.get('[data-draft-editor]').children.length,0);
});


test('la lista adicional indica Ninguno cuando el trasiego cubre todo el destino',async()=>{
 const h=setup(),events=h.events();events.find(event=>event.id==='destino').sections[0].items[0].quantity=2;h.setEvents(events);await h.api.show();
 const sections=h.get('[data-draft-recommendation]').querySelectorAll('section');assert.equal(sections.length,3);
 assert.match(sections[2].textContent,/Equipo adicional para completar el evento/);assert.match(sections[2].textContent,/Ninguno/);assert.equal(sections[2].querySelectorAll('li').length,0);assert.equal(h.updates.length,0);
});


test('dos trasiegos al mismo destino muestran una sola lista adicional y conservan ambos camiones',async()=>{
 const events=[event('origen-consola','26',{consola:2}),event('origen-base','26',{base:1}),event('destino','27',{consola:3,base:2})];
 const estimates=['origen-consola','origen-base'].map(id=>({fromPlace:`Lugar ${id}`,toPlace:'Lugar destino',travelMinutes:60,handlingMinutes:30,distanceKm:12}));
 const h=harness({events,estimates});h.setStock(inventory());await h.api.show();
 const cards=h.modal().querySelectorAll('[data-draft-recommendation]');assert.equal(cards.length,2);
 assert.ok(cards.every(card=>/Evento destino/.test(card.textContent)));
 const additional=h.modal().querySelectorAll('.equipment-draft-additional');assert.equal(additional.length,1,'el complemento es por destino, sin duplicarse entre camiones');
 const items=additional[0].querySelectorAll('li');assert.equal(items.length,2);for(const item of items)assert.match(item.textContent,/1 ×/);
 assert.match(additional[0].textContent,/Referencia consola/);assert.match(additional[0].textContent,/Referencia base/);
 assert.equal(h.calls.at(-1).body.selectedTransferIds.length,2);assert.equal(h.updates.length,0);
});
