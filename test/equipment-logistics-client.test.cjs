const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness: serverHarness, inventory } = require('./helpers/equipment-server-harness.cjs');
const storeApi = require('../equipment-event-store.cjs');
const source = fs.readFileSync(path.join(__dirname,'equipment-personalization-integration.test.cjs'),'utf8');
const fixture = source.slice(source.indexOf('function harness() {'), source.indexOf('\nconst plain ='));
const uiHarness = new Function('fs','path','vm','__dirname',fixture+';return harness;')(fs,path,vm,__dirname);
function ui(plan = {}) {
  const h = uiHarness();
  h.nodes.set('#equipmentSharedRecommendations',new h.Element('equipmentSharedRecommendations'));
  h.context.planFixture={events:[],range:{from:'2026-11-01',to:'2026-11-07'},transfers:[],routeEstimates:[],plan:{rows:[],...plan}};
  h.run('equipmentSharedWorkspace.enabled=true;equipmentSharedWorkspace.state=planFixture;renderEquipmentSharedPlan();');
  return h;
}
const row = changes => ({description:'Equipo sintético',category:'Prueba',warehouseInventoryId:'synthetic-unit',itemType:'equipo',quantity:3,required:3,capacity:1,missing:2,action:'RENTA',events:[],transfers:[],...changes});
function syntheticEvent(id, from, to) {return {id,place:'Sede '+id,name:'Evento '+id,setupAt:from,startAt:from,endAt:to,equipmentInAt:to,sections:[{id:'synthetic-section',title:'Prueba',items:[{description:'Unidad sintetica',warehouseInventoryId:'synthetic-unit',quantity:1}]}]};}

test('datos pendientes nunca afirman que inventario cubre todos los eventos',()=>{
  const h=ui({rows:[row({pendingLogistics:true,missing:0,action:'PENDIENTE'})]});
  assert.match(h.get('equipmentSharedRecommendations').innerHTML,/cálculo está pendiente/);
  assert.doesNotMatch(h.get('equipmentSharedRecommendations').innerHTML,/El inventario cubre las reservas/);
});
test('identificación pendiente también bloquea mensaje de cobertura',()=>{
  const h=ui({rows:[row({pendingIdentification:true,missing:0,action:'PENDIENTE'})]});
  assert.doesNotMatch(h.get('equipmentSharedRecommendations').innerHTML,/El inventario cubre las reservas/);
});
test('comparación separa faltante real de renta potencial sin aplicar propuestas',()=>{
  const proposed={fromEventId:'a',toEventId:'b',fromPlace:'Sede A',toPlace:'Sede B',quantity:1,travelMinutes:0,handlingMinutes:120,requiresConfirmation:true,requiresTimeConfirmation:true,departureAt:'2026-11-01T08:00',setupAt:'2026-11-01T12:00'};
  const h=ui({rows:[row({transfers:[proposed],planning:{rentalPotential:1,optimal:true,warnings:[]}})]});
  const html=h.get('equipmentSharedRecommendations').innerHTML;
  assert.match(html,/2 por rentar/); assert.match(html,/Rentar 1 y confirmar trasiegos/);
  assert.match(html,/data-shared-confirm-transfer="0" disabled/);
  assert.match(html,/Tiempos estimados/); assert.match(html,/Transporte: 0 min/);
});
test('tiempos cero revisados se conservan y textos fuente se escapan',()=>{
  const h=ui({rows:[],logistics:{routePairs:[{fromPlace:'<Sede A>',toPlace:'Sede B',travelMinutes:0,handlingMinutes:0}],warnings:['<No es HTML>']}});
  const html=h.get('equipmentSharedRecommendations').innerHTML;
  assert.match(html,/data-logistics-travel="0"[^>]*value="0"/);assert.match(html,/data-logistics-handling="0"[^>]*value="0"/);
  assert.match(html,/&lt;Sede A&gt;/);assert.match(html,/&lt;No es HTML&gt;/);
});
test('Ver todos los eventos amplía fechas completas y conserva los eventos fuera de semana',async()=>{
  const h=ui();
  h.context.agenda=[syntheticEvent('a','2026-10-01T08:00','2026-10-01T20:00'),syntheticEvent('b','2026-12-31T22:00','2027-01-01T03:00')];
  h.run(`equipmentSharedWorkspace.client={refresh:async()=>({events:agenda}),setRange:range=>window.newRange=range};switchEquipmentWindow=mode=>window.mode=mode;`);
  await h.run('showAllEquipmentSharedEvents()');
  assert.deepEqual(JSON.parse(JSON.stringify(h.context.window.newRange)),{from:'2026-10-01',to:'2027-01-01'});assert.equal(h.context.window.mode,'summary');
});
test('formato horario no pierde los minutos al terminar en 00',()=>{
  const h=ui();assert.equal(h.run('equipmentLogisticsTime("2026-11-01T08:00-06:00")'),'2026-11-01 · 08:00');
});
test('API de simulación exige sesión y no escribe inventario, agenda ni trasiegos',async t=>{
  const h=serverHarness(t);h.api.equipmentEventStore=storeApi.createEquipmentEventStore({directory:h.dir});h.api.calculateEquipmentAvailability=storeApi.calculateEquipmentAvailability;
  h.write('warehouseInventoryPath',inventory(1));
  h.api.equipmentEventStore.putEvent('a',{event:syntheticEvent('a','2026-11-01T08:00','2026-11-01T10:00')},'Synthetic tester',inventory(1));
  h.api.equipmentEventStore.putEvent('b',{event:syntheticEvent('b','2026-11-01T14:00','2026-11-01T18:00')},'Synthetic tester',inventory(1));
  const before=JSON.stringify(h.api.equipmentEventStore.readEvents()),stock=fs.readFileSync(h.paths.warehouseInventoryPath,'utf8');
  const payload={from:'2026-11-01',to:'2026-11-07',routeEstimates:[{fromPlace:'Sede a',toPlace:'Sede b',travelMinutes:0,handlingMinutes:0}]};
  const unauth=await h.dispatch('POST','/api/cuadros-equipo/plan-logistico',payload,{auth:false});assert.equal(unauth.statusCode,401);
  const response=await h.dispatch('POST','/api/cuadros-equipo/plan-logistico',payload);assert.equal(response.statusCode,200);assert.equal(response.json().simulation,true);
  assert.equal(JSON.stringify(h.api.equipmentEventStore.readEvents()),before);assert.equal(fs.readFileSync(h.paths.warehouseInventoryPath,'utf8'),stock);
});
test('API rechaza tiempos inválidos y no convierte vacíos en cero',async t=>{
  const h=serverHarness(t);h.api.equipmentEventStore=storeApi.createEquipmentEventStore({directory:h.dir});h.api.calculateEquipmentAvailability=storeApi.calculateEquipmentAvailability;h.write('warehouseInventoryPath',inventory());
  const result=await h.dispatch('POST','/api/cuadros-equipo/plan-logistico',{routeEstimates:[{fromPlace:'A',toPlace:'B',travelMinutes:'',handlingMinutes:0}]});assert.equal(result.statusCode,400);
});

test('renta de agenda compartida usa el plan confirmado sin abrir decisión antigua de dos eventos',()=>{
  const h=ui({rows:[row()]});
  h.context.planFixture.events=[syntheticEvent('a','2026-11-01T08:00','2026-11-01T10:00'),syntheticEvent('b','2026-11-01T14:00','2026-11-01T18:00')];
  h.run(`equipmentState.events=planFixture.events;equipmentSharedWorkspace.state.loaded=true;
    equipmentRowsSummary=()=>[{description:'Unidad sintetica',quantity:1}];
    equipmentProcurementReportRows=()=>[{description:'Unidad sintetica',missing:1}];
    window.legacyDecisions=0;openEquipmentLogisticsDecision=()=>{window.legacyDecisions++;return true;};
    previewEquipmentRentReport();`);
  assert.equal(h.context.window.legacyDecisions,0);
  assert.equal(h.run('equipmentState.rentPreviewVisible'),true);
  assert.equal(h.run('maybeOpenEquipmentAutomaticLogisticsRecommendation()'),false);
});
test('reporte de renta bloquea un plan desactualizado aunque conserve filas anteriores',()=>{
  const h=ui({rows:[row()]});
  h.run('equipmentSharedWorkspace.state.loaded=true;equipmentSharedWorkspace.state.stale=true;');
  assert.match(h.run('equipmentRentReportValidationMessage()'),/Actualice la agenda/);
});
test('itinerario de renta aclara la reutilización y la coordinación con proveedor',()=>{
  const h=ui({rows:[row({planning:{rentalPotential:1,warnings:[],rentalRoutes:[{quantity:1,fromPlace:'Sede A',toPlace:'Sede B',requiresTimeConfirmation:true}]}})]});
  const html=h.get('equipmentSharedRecommendations').innerHTML;
  assert.match(html,/Traslados necesarios del equipo a rentar/);
  assert.match(html,/mismas unidades alquiladas/);assert.match(html,/coordinación con el proveedor/);
});
