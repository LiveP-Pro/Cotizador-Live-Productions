const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./helpers/equipment-server-harness.cjs');
const storeApi = require('../equipment-event-store.cjs');
const EquipmentIdentity = require('../equipment-identity.js');
function loadValidation(h) {
  const source=fs.readFileSync(path.join(__dirname,'../server.js'),'utf8');
  const start=source.indexOf('function validateEquipmentEventConfirmation('),end=source.indexOf('\n}\n',start)+2;
  Object.assign(h.api,storeApi,{EquipmentIdentity}); vm.runInContext(source.slice(start,end),h.api);
}
function fixture() {return {savedAt:'current-synthetic-stock',state:{items:[
  {id:'physical',name:'Unidad sintética',category:'Prueba',quantity:3,itemType:'equipo'},
  {id:'pending-type',name:'Extintor sintético',category:'Prueba',quantity:2,itemType:'consumible'}],movements:[]}};}
function event(line) {return {id:'synthetic-confirm',place:'Sitio sintético',date:'2026-11-05',setupAt:'2026-11-05T08:00',startAt:'2026-11-05T12:00',endAt:'2026-11-05T17:00',equipmentInAt:'2026-11-05T20:00',sections:[{title:'Prueba',items:[{id:'line',quantity:2,...line}]}]};}

test('PUT confirmation rejects unresolved identity, classification or unreceived save without event or inventory writes',async t=>{
  const h=createHarness(t);loadValidation(h);h.write('warehouseInventoryPath',fixture());
  const inventoryBefore=fs.readFileSync(h.paths.warehouseInventoryPath);const privateFile=path.join(h.dir,'.equipment-private/eventos-y-extras.json');
  const store=storeApi.createEquipmentEventStore({directory:h.dir});let saveCalls=0;
  h.api.equipmentEventStore={putEvent(...args){saveCalls+=1;return store.putEvent(...args);}};
  const lines=[
    {description:'Equipo desconocido'},
    {description:'Otro modelo físico',warehouseInventoryId:'physical'},
    {description:'Extintor sintético',warehouseInventoryId:'pending-type'},
    {description:'Unidad sintética',warehouseInventoryId:'physical',procurementChoice:'save'},
    {description:'Unidad sintética',warehouseInventoryId:'physical',inventoryMatchUnresolved:true}
  ];
  for(const line of lines){const response=await h.dispatch('PUT','/api/cuadros-equipo/eventos/synthetic-confirm',{event:event(line)});
    assert.equal(response.statusCode,422,response.body.toString());assert.match(response.json().error,/provisional|confirm/);
    assert.equal(fs.existsSync(privateFile),false);assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath),inventoryBefore);
  }
  assert.equal(saveCalls,0);
});

test('PUT allows explicit rent/purchase, unused zero and verified physical stock; reservations never issue warehouse movements',async t=>{
  const h=createHarness(t);loadValidation(h);h.write('warehouseInventoryPath',fixture());
  const store=storeApi.createEquipmentEventStore({directory:h.dir});h.api.equipmentEventStore=store;
  const inventoryBefore=fs.readFileSync(h.paths.warehouseInventoryPath);
  for(const [index,line] of [
    {description:'Equipo desconocido',procurementChoice:'rent'},
    {description:'Insumo desconocido',procurementChoice:'purchase'},
    {description:'Equipo desconocido sin usar',quantity:0},
    {description:'Unidad sintética',warehouseInventoryId:'physical'}
  ].entries()){
    const e=event(line);e.id+='-'+index;
    const response=await h.dispatch('PUT','/api/cuadros-equipo/eventos/'+e.id,{event:e});assert.equal(response.statusCode,200,response.body.toString());
    assert.deepEqual(fs.readFileSync(h.paths.warehouseInventoryPath),inventoryBefore);
  }
  assert.equal(store.readEvents().events.length,4);
});

test('PUT accepts a real warehouse receipt and rejects an otherwise identical forged receipt',async t=>{
  const h=createHarness(t);loadValidation(h);const stock=fixture();
  stock.state.equipmentStockReceipts=[{requestId:'real-current-receipt',items:[{itemId:'physical',quantity:2}]}];h.write('warehouseInventoryPath',stock);
  h.api.equipmentEventStore=storeApi.createEquipmentEventStore({directory:h.dir});
  const e=event({description:'Unidad sintética',warehouseInventoryId:'physical',procurementChoice:'save',inventoryIngressReceipts:[{requestId:'forged-receipt',index:0,itemId:'physical',quantity:2}]});
  let response=await h.dispatch('PUT','/api/cuadros-equipo/eventos/'+e.id,{event:e});assert.equal(response.statusCode,422);
  e.sections[0].items[0].inventoryIngressReceipts[0].requestId='real-current-receipt';
  response=await h.dispatch('PUT','/api/cuadros-equipo/eventos/'+e.id,{event:e});assert.equal(response.statusCode,200,response.body.toString());
});
