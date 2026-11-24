const test = require('node:test');
const assert = require('node:assert/strict');
const Reporting = require('../equipment-reporting.cjs');
const ExcelJS = require('exceljs');
function fixture() {
  const inventory={savedAt:'current-synthetic',state:{items:[
    {id:'own-audio',name:'Audio sintético',category:'Audio',itemType:'equipo',quantity:2},
    {id:'own-extra',name:'Extra sintético',category:'Luces',itemType:'equipo',quantity:1},
    {id:'own-consume',name:'Consumible sintético',category:'Insumos',itemType:'consumible',quantity:3}
  ],movements:[]}};
  const event=(id,hour,extra,consume,mapUrl)=>{
    const at=h=>`2026-11-25T${String(h).padStart(2,'0')}:00`;
    const items=[{quantity:2,description:'Audio sintético',warehouseInventoryId:'own-audio'},
      {quantity:extra,description:'Extra sintético',warehouseInventoryId:'own-extra'},
      {quantity:consume,description:'Consumible sintético',warehouseInventoryId:'own-consume'}];
    const cells=items.flatMap((item,i)=>[{ref:`${id}!A${i+1}`,sheet:id,address:`A${i+1}`,value:item.quantity},{ref:`${id}!B${i+1}`,sheet:id,address:`B${i+1}`,value:item.description}]);
    return {id,status:'draft',name:id,place:`Sede ${id}`,mapUrl,date:'2026-11-25',setupAt:at(hour),startAt:at(hour+1),endAt:at(hour+3),equipmentInAt:'2026-11-26T12:00',
      sourceCells:cells,sourceImport:{metadata:{original:id},sourceCells:cells},sections:[{title:'Cuadro original',items,rows:items.map((item,index)=>({type:'item',...item,sourceItemIndex:index,cells:cells.slice(index*2,index*2+2)}))}]};
  };
  const events=[event('B',8,0,2,'https://www.google.com/maps?q=14,-90'),event('E',17,1,4,'https://www.google.com/maps?q=14.01,-90.01')];
  const routeEstimates=[{fromPlace:'Sede B',toPlace:'Sede E',travelMinutes:20,handlingMinutes:30,distanceKm:2}];
  return {events,inventory,routeEstimates};
}
test('edición parcial se valida igual en el cálculo, HTML, PDF fuente y Excel, con notas y consumibles íntegros',async()=>{
  const {events,inventory,routeEstimates}=fixture(),before=JSON.stringify({events,inventory});
  const payload={events,routeEstimates},preview=Reporting.createEquipmentReportModel(payload,inventory);
  const candidate=preview.draftLogistics.candidates.find(row=>row.warehouseInventoryId==='own-audio');assert.equal(candidate.maxQuantity,2);
  const note='Cargar una unidad <script>no ejecutar</script>';
  const edited={...payload,selectedTransferIds:[candidate.id],transferEdits:[{id:candidate.id,quantity:1,note}]};
  const model=Reporting.createEquipmentPlanningReportModel(edited,inventory);
  assert.equal(model.transferRoutes[0].quantity,1);assert.equal(model.transferRoutes[0].note,note);
  assert.equal(model.rental.find(row=>row.warehouseInventoryId==='own-audio').rental,1);
  assert.equal(model.purchase.find(row=>row.warehouseInventoryId==='own-consume').purchase,3);
  const browser=Reporting.renderEquipmentPlanningReportHtml(model,'transfer');
  const native=Reporting.renderEquipmentReportHtml(Reporting.createEquipmentTransferReportModel(edited,inventory),'transfer');
  for(const html of [browser,native]){assert.match(html,/Preparar el camión/);assert.ok(html.includes('&lt;script&gt;no ejecutar&lt;/script&gt;'));assert.ok(!html.includes('<script>'));assert.match(html,/Extra sintético/);assert.match(html,/recomendación|Recomendación/);}
  const master=await Reporting.createEquipmentMasterWorkbook(Reporting.createEquipmentReportModel(edited,inventory));
  const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await master.xlsx.writeBuffer());
  const transfers=reopened.getWorksheet('Trasiegos elegidos');assert.equal(transfers.getRow(5).getCell(5).value,1);assert.equal(transfers.getRow(5).getCell(9).value,note);
  const truck=reopened.getWorksheet('Preparar camión');const rows=truck.getRows(5,truck.rowCount-4).map(row=>row.values);
  assert.ok(rows.some(row=>row.includes('Extra sintético')&&row.includes('Cargar adicional desde el primer evento')));
  assert.equal(reopened.getWorksheet('Celdas fuente').rowCount-4,12);assert.equal(model.counts.zeroQuantityRows,1);
  assert.equal(model.events[0].sections[0].items[1].quantity,0);assert.deepEqual(model.originalEvents,events);assert.equal(model.productionMutations,0);assert.equal(JSON.stringify({events,inventory}),before);
});
test('la precarga no se añade a la demanda ni se usa como descuento adicional de renta',()=>{
  const {events,inventory,routeEstimates}=fixture(),model=Reporting.createEquipmentReportModel({events,routeEstimates},inventory);
  const bundle=model.draftLogistics.routeBundles.find(row=>row.recommended);assert.ok(bundle);
  assert.equal(bundle.preloadItems.find(row=>row.warehouseInventoryId==='own-extra').quantity,1);
  const extra=model.rows.find(row=>row.warehouseInventoryId==='own-extra');assert.equal(extra.demand,1);assert.equal(extra.eventQuantities.B,0);assert.equal(extra.eventQuantities.E,1);
  assert.equal(extra.rental,0);assert.equal(model.rows.find(row=>row.warehouseInventoryId==='own-audio').rental,2);
});
test('ningún reporte admite una cantidad mayor a la propuesta ni otro sitio como ubicación Maps',()=>{
  const {events,inventory,routeEstimates}=fixture(),payload={events,routeEstimates};
  const candidate=Reporting.createEquipmentReportModel(payload,inventory).draftLogistics.candidates[0];
  assert.throws(()=>Reporting.createEquipmentReportModel({...payload,selectedTransferIds:[candidate.id],transferEdits:[{id:candidate.id,quantity:999}]},inventory),/cantidad|máxim|límite/i);
  const invalid=structuredClone(events);invalid[0].mapUrl='https://example.invalid/maps';assert.throws(()=>Reporting.createEquipmentReportModel({...payload,events:invalid},inventory),/Google Maps/);
});
