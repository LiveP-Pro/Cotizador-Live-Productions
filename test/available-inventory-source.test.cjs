const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const test = require('node:test');
const root = path.join(__dirname, '..');
const seed = JSON.parse(fs.readFileSync(path.join(root,'inventory-initial-state.json'),'utf8'));
function harness() {
  const context = { window: { requerimientoEquipoCatalog:{services:{},groups:[]}, addEventListener(){}, setTimeout(){}, setInterval(){}, requestAnimationFrame(){} },
    document:{querySelector(){return null},querySelectorAll(){return []},addEventListener(){},dispatchEvent(){}}, CustomEvent:class{}, console, setInterval(){}, clearInterval(){}, fetch:async()=>({ok:false}) };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root,'equipment-inventory.js'),'utf8'),context);
  vm.runInContext(fs.readFileSync(path.join(root,'equipment.js'),'utf8'),context);
  context.seed = seed;
  vm.runInContext('applyEquipmentWarehouseInventoryPayload(seed)',context);
  return context;
}
const plain = value=>JSON.parse(JSON.stringify(value));
test('the new dataset contains every current source cell and all 269 C/L pairs including eight zeros',()=>{
  const state=seed.state,cells=new Map(state.sourceCells.map(cell=>[cell.ref,cell]));
  assert.equal(state.source.spreadsheetId,'1orDO4t7PA8ZEDg3vWI5hbYcI6HA4vlbQECMeoAzGI8w');
  assert.equal(state.source.sheetId,862474686);assert.equal(state.source.quantityColumn,'L');
  assert.equal(state.sourceCells.length,1149);assert.equal(state.items.length,269);
  assert.equal(state.items.filter(item=>item.quantity===0).length,8);assert.equal(state.movements.length,0);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(state.sourceCells)).digest('hex'),state.source.sourceHash);
  for(const item of state.items){ assert.equal(item.name,cells.get('C'+item.sourceRow).effectiveValue.stringValue);assert.equal(item.quantity,cells.get('L'+item.sourceRow).effectiveValue.numberValue);assert.ok(item.id.startsWith(state.datasetId+'-r')); }
});
test('every current available quantity is identical in the requirement lookup and the warehouse dataset',()=>{
  const context=harness();
  const rows=plain(vm.runInContext(`seed.state.items.map(item=>({id:item.id,available:equipmentInventoryAvailableValueFor({warehouseInventoryId:item.id,description:item.name,categoryTitle:item.category})}))`,context));
  assert.deepEqual(rows,seed.state.items.map(item=>({id:item.id,available:item.quantity})));
  const summary=plain(vm.runInContext('equipmentInventorySummaryCategories().flatMap(category=>category.items).map(item=>({id:item.warehouseInventoryId,available:item.value}))',context));
  assert.deepEqual(summary,seed.state.items.map(item=>({id:item.id,available:item.quantity})));
});
test('one or multiple event windows never subtract their demand from the displayed available stock',()=>{
  const context=harness();
  const result=plain(vm.runInContext(`(()=>{ const item=seed.state.items.find(item=>item.sourceRow===8); equipmentState.summaryTransferAutomatic=false;
    equipmentState.events=[1,2].map((quantity,index)=>({id:'event-'+index,name:'Prueba '+index,date:'2026-10-14',setupAt:'2026-10-14T08:00',equipmentInAt:'2026-10-14T20:00',sections:[{title:'CONSOLAS',items:[{description:item.name,quantity}]}]}));
    const rows=equipmentFilterSummaryRows(equipmentRowsSummary()); const row=rows.find(row=>row.type==='item'&&row.quantity>0);
    return {required:row.quantity,available:equipmentInventoryAvailableValueFor(row),html:tableForEquipmentInventory(rows,true)};
  })()`,context));
  assert.equal(result.required,3);assert.equal(result.available,7);
  assert.match(result.html,/EQUIPO DISPONIBLE/);assert.match(result.html,/EQUIPO FALTANTE/);
  const row=[...result.html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/g)].map(match=>match[0]).find(row=>row.includes('Consola analoga con cable ac'));
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match=>match[1].replace(/<[^>]+>/g,'').trim());
  assert.equal(cells[5],'7');
  assert.equal(cells[6],'0');
});
