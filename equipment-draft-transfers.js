(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EquipmentDraftTransfers = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es-GT').replace(/\s+/g,' ');
  const pairKey = route => JSON.stringify([key(route.fromPlace),key(route.toPlace)]);
  const routeLabel = route => `${route.fromPlace || route.fromName || 'Origen pendiente'} → ${route.toPlace || route.toName || 'Destino pendiente'}`;
  const list = value => Array.isArray(value) ? value : [];
  function mergeEstimates(base, edits) {
    const routes = new Map();
    [...list(base),...list(edits)].forEach(route => routes.set(pairKey(route),copy(route)));
    return [...routes.values()];
  }
  function localTime(value) {
    if (!value) return '';
    if (!/(?:Z|[+-]\d\d:\d\d)$/.test(value)) return String(value).slice(0,16);
    const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
    const parts = Object.fromEntries(new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Guatemala',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }
  function eventPatches(events) {
    return events.map(event => ({id:event.id,place:event.place,mapUrl:event.mapUrl||'',date:localTime(event.startAt).slice(0,10)||event.date||'',setupApplies:event.setupApplies!==false,setupAt:event.setupAt || '',startAt:event.startAt || '',endAt:event.endAt || '',teardownAt:event.teardownAt || '',equipmentInAt:event.equipmentInAt || '',...(list(event.planEquipmentChanges).length?{sections:copy(event.sections),planEquipmentChanges:copy(event.planEquipmentChanges)}:{})}));
  }
  function recommendedIds(plan, edits=[]) {
    const ids=new Set(list(plan?.routeBundles).filter(bundle=>bundle.recommended&&bundle.status==='ready').flatMap(bundle=>list(bundle.recommendedTransferIds)));
    return list(plan?.candidates).filter(route=>ids.has(route.id)&&!route.requiresManualReview&&!(edits.find(edit=>edit.id===route.id)?.quantity===0)).map(route=>route.id);
  }
  function recommendedEdits(plan, ids, edits=[]) {
    const next=copy(edits);
    for(const route of list(plan?.candidates)) {
      if(!ids.includes(route.id))continue;
      const amount=Number(route.recommendedQuantity);
      if(!Number.isFinite(amount)||amount<=0)continue;
      const index=next.findIndex(edit=>edit.id===route.id),before=index>=0?next[index]:null;
      const quantity=Math.min(amount,before?.quantity>0?before.quantity:amount);
      if(quantity!==Number(route.quantity)||before){const change={id:route.id,quantity,note:before?.note||''};if(index<0)next.push(change);else next[index]=change;}
    }
    return next;
  }
  function originDestinations(ids, candidates, origin) {
    const selected=new Set(ids);
    return [...new Set(list(candidates).filter(route=>selected.has(route.id)&&route.fromEventId===origin).map(route=>route.toEventId))].sort();
  }
  function create(options) {
    const bridge = options.bridge, doc = options.document || document;
    const fetcher = options.fetch || ((...args)=>fetch(...args));
    const location = () => root.EquipmentLocation || root.window?.EquipmentLocation;
    let committedIds = [], committedEstimates = [], committedEdits = [], committedSplitOrigins = [], committedExplicit = false, cached = null, cachedKey = '', requestVersion = 0, resetVersion = 0, lastError='';
    let overlay = null, confirmation = null, workEvents = null, workIds = [], workEstimates = [], workEdits = [], workSplitOrigins = [], workPlan = null, workBusy = false, modalVersion = 0, lastFocus = null, openedSourceKey = '', initialDraftKey = '';
    const currentEvents = () => copy(bridge.events());
    const estimates = edits => mergeEstimates(bridge.transferOptions?.()?.routeEstimates || [],edits);
    const dataKey = (events,ids,routes,edits,splitOrigins=[]) => JSON.stringify([events,bridge.inventory(),bridge.range?.(),ids,routes,edits,splitOrigins]);
    const sourceKey = () => JSON.stringify([bridge.events(),bridge.inventory(),bridge.range?.(),bridge.transferOptions?.()]);
    const draftKey = () => JSON.stringify([eventPatches(workEvents||[]),[...workIds].sort(),workEstimates,workEdits,[...workSplitOrigins].sort()]);
    const allowed = () => typeof window === 'undefined' || !window.LiveAccess?.can || window.LiveAccess.can(window.LIVE_SESSION,'equipment.reports');
    const notify = () => options.onChange?.(cached);
    function requestOptions(events = currentEvents()) {
      const ids = new Set(events.map(event=>event.id));
      const known = new Map(list(cached?.candidates).map(route=>[route.id,route]));
      const selectedTransferIds=committedIds.filter(id=>{const route=known.get(id);return !route || ids.has(route.fromEventId)&&ids.has(route.toEventId);});
      return {selectedTransferIds,transferEdits:copy(committedEdits.filter(edit=>!known.has(edit.id)||ids.has(known.get(edit.id).fromEventId)&&ids.has(known.get(edit.id).toEventId))),routeEstimates:estimates(committedEstimates),splitAuthorizedOrigins:committedSplitOrigins.filter(id=>ids.has(id))};
    }
    async function calculate(events, ids, routes, edits=[],splitAuthorizedOrigins=[]) {
      if (!allowed()) throw new Error('Su usuario no tiene permiso para generar reportes de equipo.');
      const response = await fetcher('/api/cuadros-equipo/reportes/provisional',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...bridge.range?.(),mode:'plan',format:'json',events,selectedTransferIds:ids,transferEdits:edits,routeEstimates:routes,splitAuthorizedOrigins})});
      if(!allowed())throw new Error('Su usuario ya no tiene permiso para generar reportes de equipo.');
      if (!response.ok) {
        const detail = await response.json().catch(()=>({}));
        throw new Error(detail.error || `No se pudo calcular el plan (HTTP ${response.status}). Sus cuadros se conservan.`);
      }
      const plan = await response.json();
      if (!Array.isArray(plan.rows)||!Array.isArray(plan.candidates)||!Array.isArray(plan.selectedTransfers)) throw new Error('El servidor no devolvió un plan válido. Sus cuadros se conservan.');
      return plan;
    }
    async function refresh({force=false,events=currentEvents()} = {}) {
      if (!events.length || !allowed()) { const changed=!!cached||!!cachedKey;requestVersion++;cached=null;cachedKey='';lastError=events.length?'Su usuario no tiene permiso para generar reportes de equipo.':'';if(changed)notify();return null; }
      const request=requestOptions(events), fingerprint=dataKey(events,request.selectedTransferIds,request.routeEstimates,request.transferEdits,request.splitAuthorizedOrigins);
      if (!force && cachedKey===fingerprint) return cached;
      cached=null;lastError='';cachedKey=fingerprint; const version=++requestVersion;
      try {
        const result=await calculate(events,request.selectedTransferIds,request.routeEstimates,request.transferEdits,request.splitAuthorizedOrigins);
        if (version!==requestVersion) return cached;
        cached=result; options.onStatus?.('Plan calculado con el inventario actual. Sólo los trasiegos seleccionados y válidos reducen la renta.'); notify();return result;
      } catch(error) {
        if(version===requestVersion){cached=null;lastError=error.message;options.onStatus?.(error.message);notify();} return null;
      }
    }
    function result(events=currentEvents()) {
      if(!allowed())return null;
      const request=requestOptions(events);
      return cachedKey===dataKey(events,request.selectedTransferIds,request.routeEstimates,request.transferEdits,request.splitAuthorizedOrigins)?cached:null;
    }
    function status(message,isError=false) {
      const target=overlay?.querySelector('[data-draft-status]');if(target){target.textContent=message;target.classList.toggle('is-error',isError);}
    }
    function setBusy(value) {
      workBusy=value;if(!overlay)return;
      overlay.querySelectorAll('[data-draft-event],[data-draft-substitution-line],[data-draft-substitution-inventory],[data-draft-substitution-quantity],[data-draft-substitution-reason],[data-draft-substitution-compatible],[data-draft-substitute],[data-draft-choose-bundle],[data-draft-route],[data-draft-quantity],[data-draft-note],[data-draft-save-edit],[data-draft-travel],[data-draft-handling],[data-draft-distance],[data-draft-confirm-time],[data-draft-select-all],[data-draft-select-none],[data-draft-recalculate],[data-draft-apply]').forEach(control=>{control.disabled=value;});
      if(!value)overlay.querySelectorAll('[data-draft-field="setupApplies"]').forEach(input=>{const target=overlay.querySelector(`[data-draft-event="${input.dataset.draftEvent}"][data-draft-field="setupAt"]`);if(target)target.disabled=!input.checked;});
    }
    function navigationLink(route) {
      const from=workEvents.find(event=>event.id===route.fromEventId)||{place:route.fromPlace};
      const to=workEvents.find(event=>event.id===route.toEventId)||{place:route.toPlace};
      try {const url=location()?.directionsUrl?.(from,to);return url&&/^https:\/\//.test(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver ruta en Google Maps</a>`:'';}catch{return '';}
    }
    function operationLabel(bundle) {
      const from=localTime(bundle.fromDate).slice(0,10)||bundle.fromDate;
      const to=localTime(bundle.toDate).slice(0,10)||bundle.toDate;
      if(!from&&!to)return '';
      return `${dateLabelForModal(from)} → ${dateLabelForModal(to)} · ${bundle.toOperation==='setup'?'Montaje del evento de destino':'Evento de destino'}`;
    }
    function renderCalendar() {
      const host=overlay.querySelector('[data-draft-calendar]'),days=list(workPlan?.operationalCalendar||workPlan?.routePolicy?.operationalCalendar);
      if(!host)return;
      host.innerHTML=days.length?`<section class="equipment-draft-calendar"><h3>Calendario operativo: día a día</h3><p>El montaje participa en su fecha real y mantiene el mismo equipo ocupado hasta la liberación del evento. No genera otro evento ni duplica cantidades.</p><ol>${days.map(day=>`<li><strong>${esc(dateLabelForModal(day.date))}</strong><ul>${list(day.operations).map(operation=>`<li><strong>${operation.kind==='setup'?'Montaje':'Evento'}</strong> · ${esc(operation.place||operation.name||'Ubicación pendiente')} · ${esc(localTime(operation.at).replace('T',' '))}${operation.name&&operation.name!==operation.place?` · ${esc(operation.name)}`:''}</li>`).join('')}</ul></li>`).join('')}</ol></section>`:'';
    }
    function renderBundles() {
      const bundles=list(workPlan?.routeBundles);if(!bundles.length)return '';
      const items = (entries, kind) => !entries.length?'<p>Ninguno.</p>':`<ul>${entries.map(item=>`<li><strong>${esc(item.quantity)} ×</strong> ${esc(item.description)}${kind==='preload'?`<small>Existencia consultada: ${esc(item.availableQuantity??'pendiente')} · Cantidad solicitada en destino: ${esc(item.requestedQuantity??item.quantity)}</small>`:kind==='common'?`<small>Cantidad compartida requerida · Propio propuesto: ${esc(item.ownTransferQuantity??0)} · Elegido: ${esc(item.selectedQuantity??0)}</small>`:''}</li>`).join('')}</ul>`;
      const comparisonTable = bundle => {
        const rows=list(workPlan.rows).filter(row=>row.warehouseInventoryId&&row.itemType!=='consumible'&&!row.pendingIdentification&&!row.pendingClassification).flatMap(row=>{
          const from=Number(row.eventQuantities?.[bundle.fromEventId])||0,to=Number(row.eventQuantities?.[bundle.toEventId])||0;if(!from&&!to)return [];
          return [{description:row.description,from,to,common:Math.min(from,to),additional:Math.max(0,to-from),unused:Math.max(0,from-to)}];
        });
        return rows.length?`<details><summary>Cuadro comparado referencia por referencia</summary><div class="equipment-draft-comparison-scroll"><table class="equipment-draft-comparison"><thead><tr><th scope="col">Equipo</th><th scope="col">Origen</th><th scope="col">Destino</th><th scope="col">Coincide</th><th scope="col">Adicional</th><th scope="col">No requerido en destino</th></tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">${esc(row.description)}</th><td>${esc(row.from)}</td><td>${esc(row.to)}</td><td>${esc(row.common)}</td><td>${esc(row.additional)}</td><td>${esc(row.unused)}</td></tr>`).join('')}</tbody></table></div><p>La coincidencia es demanda compartida. Las unidades realmente trasladables se comprueban con el inventario y las demás reservas.</p></details>`:'';
      };
      return `<section class="equipment-draft-bundles"><h3>Comparar destinos del siguiente día</h3><p>Se busca aprovechar el mismo cuadro en un destino principal. Compare referencias y cantidades; una división requiere su aceptación. Los horarios y minutos de viaje deben estar verificados.</p>${bundles.map((bundle,index)=>{
        const selected=list(workPlan.candidates).some(route=>route.fromEventId===bundle.fromEventId&&route.toEventId===bundle.toEventId&&workIds.includes(route.id));
        const coverage=Number(bundle.comparison?.sourceCoverage);
        const percentage=Number.isFinite(coverage)?`${Math.round(coverage*100)}% del cuadro de origen reutilizable`:Number.isFinite(Number(bundle.similarity))?`${Math.round(Number(bundle.similarity)*100)}% de coincidencia entre cuadros`:'';
        const selectable=bundle.status==='ready'&&list(workPlan.candidates).some(route=>route.fromEventId===bundle.fromEventId&&route.toEventId===bundle.toEventId&&!route.requiresManualReview);
        return `<article class="equipment-draft-bundle ${bundle.status==='ready'?'is-ready':'needs-review'}"><div class="equipment-draft-bundle-heading"><h4>${esc(routeLabel(bundle))}</h4><strong>${bundle.recommended?'Destino principal recomendado':bundle.status==='blocked'?'Ruta no viable':bundle.status==='ready'?'Destino alternativo':'Revisar ruta'}${selected?' · elegido':''}</strong></div>${operationLabel(bundle)?`<p><strong>${esc(operationLabel(bundle))}</strong></p>`:''}<p>${percentage?`${esc(percentage)}. `:''}${esc(bundle.similarityExplanation||bundle.comparison?.measureLabel||'')} ${esc(list(bundle.reasons).join(' '))}</p>${bundle.proximity?.distanceKm!==undefined&&bundle.proximity?.distanceKm!==null?`<p>${esc(Number(bundle.proximity.distanceKm).toFixed(1))} km · ${['manual','user'].includes(bundle.proximity.source)?'distancia indicada':'distancia en línea recta, no vial'}.</p>`:''}${navigationLink(bundle)}${selectable?`<p><button type="button" data-draft-choose-bundle="${index}" ${workBusy?'disabled':''}>Elegir este destino para el cuadro</button></p>`:''}${comparisonTable(bundle)}<details><summary>Equipo compartido entre eventos · ${list(bundle.commonItems).length} referencias</summary>${items(list(bundle.commonItems),'common')}</details><details ${list(bundle.preloadItems).length?'open':''}><summary>Carga adicional para el siguiente evento · ${list(bundle.preloadItems).length} referencias</summary><p>Lleve esta carga al evento de origen para que viaje con el camión al siguiente. Es una recomendación provisional: no añade equipo al cuadro de origen, no reduce por sí sola la renta ni registra una salida. Confirme la carga y su transporte antes del movimiento.</p>${items(list(bundle.preloadItems),'preload')}</details>${list(bundle.missingItems).length?`<details open><summary>Equipo adicional pendiente</summary>${items(list(bundle.missingItems),'missing')}<p>Revise existencias y reporte de renta. No se dio por disponible este faltante.</p></details>`:''}</article>`;
      }).join('')}</section>`;
    }
    function editFor(route) {return workEdits.find(edit=>edit.id===route.id);}
    function substitutions() {return root.EquipmentDraftSubstitutions||root.window?.EquipmentDraftSubstitutions;}
    function renderSubstitutions() {
      const host=overlay.querySelector('[data-draft-substitutions]'),helper=substitutions();
      if(!host)return;
      if(!helper?.options||!helper?.replace){host.innerHTML='';return;}
      const choices=helper.options(bridge.inventory());
      host.innerHTML=`<details class="equipment-draft-substitutions"><summary>Ajustar equipo manualmente para mejorar coincidencias</summary><p>Sin un catálogo de compatibilidades aprobado no se hacen sustituciones automáticas. Elija una referencia real de bodega y confirme que cumple los requisitos técnicos. Primero se modifica este borrador; Cancelar o X lo descarta.</p>${workEvents.map((event,index)=>{
        const lines=helper.lines([event]);
        return `<fieldset class="equipment-draft-substitution"><legend>${esc(event.place||event.name||'Evento')}</legend><label>Línea original<select data-draft-substitution-line="${index}"><option value="">Elegir equipo original</option>${lines.map(line=>`<option value="${line.sectionIndex}:${line.itemIndex}">${esc(line.quantity)} × ${esc(line.description)} · ${esc(line.section||'Equipo')}</option>`).join('')}</select></label><label>Reemplazo desde Contabilidad de Equipo<select data-draft-substitution-inventory="${index}"><option value="">Elegir referencia de inventario</option>${choices.map(item=>`<option value="${esc(item.id||item.warehouseInventoryId)}">${esc(item.name||item.description)}${item.available!==undefined||item.quantity!==undefined?` · Disponible: ${esc(item.available??item.quantity)}`:''}</option>`).join('')}</select></label><label>Cantidad de la línea reemplazada<input type="number" min="0" step="any" data-draft-substitution-quantity="${index}" value=""></label><label>Motivo técnico<textarea rows="2" maxlength="2000" data-draft-substitution-reason="${index}" placeholder="Explique por qué cumple los requisitos del evento"></textarea></label><label class="equipment-draft-check"><input type="checkbox" data-draft-substitution-compatible="${index}">Confirmo compatibilidad técnica</label><button type="button" data-draft-substitute="${index}">Probar sustitución en el borrador</button>${list(event.planEquipmentChanges).length?`<p class="equipment-draft-substitution-note">${list(event.planEquipmentChanges).length} sustitución(es) en este borrador. Se revisarán al aceptar el plan.</p><ul class="equipment-draft-substitution-history">${list(event.planEquipmentChanges).map(change=>`<li><strong>${esc(change.before?.quantity??change.before?.[0])} × ${esc(change.before?.description??change.before?.[1])} → ${esc(change.after?.quantity)} × ${esc(change.after?.description)}</strong><small>${esc(change.operation?.reason||'')} · Disponible al revisar: ${esc(change.availableAtReview??'pendiente')}</small></li>`).join('')}</ul>`:''}</fieldset>`;
      }).join('')}</details>`;
      host.querySelectorAll('[data-draft-substitution-line]').forEach(select=>select.addEventListener('change',()=>{
        const index=Number(select.dataset.draftSubstitutionLine),parts=select.value.split(':').map(Number),item=workEvents[index]?.sections?.[parts[0]]?.items?.[parts[1]];
        const quantity=host.querySelector(`[data-draft-substitution-quantity="${index}"]`);if(quantity)quantity.value=item?String(Array.isArray(item)?item[0]:item.quantity):'';
      }));
      host.querySelectorAll('[data-draft-substitute]').forEach(button=>button.addEventListener('click',()=>{
        if(workBusy||confirmation)return;
        try {
          readEvents();readTransferEdits();readEstimateChanges();
          const index=Number(button.dataset.draftSubstitute),line=host.querySelector(`[data-draft-substitution-line="${index}"]`).value;
          if(!/^\d+:\d+$/.test(line))throw new Error('Elija una línea original para reemplazar.');
          const [sectionIndex,itemIndex]=line.split(':').map(Number),rawQuantity=host.querySelector(`[data-draft-substitution-quantity="${index}"]`).value;
          if(rawQuantity===''||!Number.isFinite(Number(rawQuantity))||Number(rawQuantity)<=0)throw new Error('Indique una cantidad mayor que 0 para la sustitución.');
          const result=helper.replace(copy(workEvents),{eventId:workEvents[index].id,sectionIndex,itemIndex,replacementInventoryId:host.querySelector(`[data-draft-substitution-inventory="${index}"]`).value,quantity:Number(rawQuantity),reason:host.querySelector(`[data-draft-substitution-reason="${index}"]`).value.trim(),compatibilityConfirmed:host.querySelector(`[data-draft-substitution-compatible="${index}"]`).checked},copy(bridge.inventory()));
          const next=Array.isArray(result)?result:result?.events;
          if(!Array.isArray(next))throw new Error('No se pudo preparar la sustitución. Su cuadro original se conserva.');
          workEvents=next;
          return recalculate(false);
        }catch(error){status(error.message,true);}
      }));
    }
    function readTransferEdits() {
      if(!overlay||!workPlan)return;
      for(const [index,route] of workPlan.candidates.entries()) {
        const quantity=overlay.querySelector(`[data-draft-quantity="${index}"]`),note=overlay.querySelector(`[data-draft-note="${index}"]`);if(!quantity)continue;
        const raw=quantity.value,max=Number(route.maxQuantity??route.quantity);
        if(raw===''||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>max)throw new Error(`La cantidad de ${route.description} debe estar entre 0 y ${max}.`);
        const existing=editFor(route),value=Number(raw),text=String(note?.value||'').trim();
        if(text.length>2000)throw new Error('La nota de transporte admite hasta 2,000 caracteres.');
        if(value!==Number(route.quantity)||text||existing) {
          workEdits=workEdits.filter(edit=>edit.id!==route.id);workEdits.push({id:route.id,quantity:value,note:text});
        }
        if(value===0)workIds=workIds.filter(id=>id!==route.id);
      }
    }
    function renderPlan() {
      if(!overlay)return;
      const host=overlay.querySelector('[data-draft-routes]'),totals=overlay.querySelector('[data-draft-totals]');
      if(!workPlan){host.innerHTML='<p>Calcule los trasiegos para ver las propuestas.</p>';totals.innerHTML='';for(const selector of ['[data-draft-calendar]','[data-draft-substitutions]']){const element=overlay.querySelector(selector);if(element)element.innerHTML='';}overlay.querySelector('[data-draft-apply]').disabled=true;return;}
      renderCalendar();renderSubstitutions();
      const rent=list(workPlan.rental||workPlan.rent),purchase=list(workPlan.purchase);
      totals.innerHTML=`<span><strong>${list(workPlan.selectedTransfers).length}</strong> trasiegos elegidos</span><span><strong>${rent.length}</strong> referencias para renta</span><span><strong>${purchase.length}</strong> referencias para compra</span>`;
      const warnings=[...list(workPlan.invalidSelections).map(row=>row.message),...list(workPlan.pending).map(row=>`${row.description}: ${list(row.reasons).join(' ')}`)];
      const routeRows=list(workPlan.candidates).map((route,index)=>{
        const edit=editFor(route),max=Number(route.maxQuantity??route.quantity),quantity=edit?.quantity??route.requestedQuantity??(workIds.includes(route.id)?route.selectedQuantity:undefined)??route.quantity;
        return `<article class="equipment-draft-route ${route.requiresManualReview?'needs-review':''}"><label class="equipment-draft-route-check"><input type="checkbox" data-draft-route="${index}" ${workIds.includes(route.id)?'checked':''} ${workBusy||route.requiresManualReview?'disabled':''}><span><strong>${esc(workIds.includes(route.id)?quantity:route.quantity)} × ${esc(route.description)}</strong><span>${esc(routeLabel(route))}</span><small>Salida: ${esc(localTime(route.departureAt).replace('T',' '))} · Llegada: ${esc(localTime(route.arrivalAt).replace('T',' '))}</small><small>${esc(route.requiresManualReview?list(route.reasons).join(' '):'Equipo propio. Marque para incluir o desmarque para quitar este trasiego.')}</small></span></label><div class="equipment-draft-route-editor"><label>Cantidad a trasegar<input type="number" min="0" max="${esc(max)}" step="any" data-draft-quantity="${index}" value="${esc(quantity)}" ${workBusy?'disabled':''}></label><label>Nota para transporte<textarea rows="2" maxlength="2000" data-draft-note="${index}" ${workBusy?'disabled':''}>${esc(edit?.note??route.note??'')}</textarea></label><button type="button" data-draft-save-edit="${index}" ${workBusy?'disabled':''}>Revisar cambio</button></div></article>`;
      }).join('');
      host.innerHTML=`${renderBundles()}<h3>Editar los equipos del trasiego</h3><p>Puede reducir cantidades, escribir instrucciones o quitar equipos. El servidor comprueba las existencias antes de aplicar. La cantidad 0 quita el equipo del trasiego.</p>${routeRows||'<p>No hay trasiegos propios viables con los datos actuales. Complete los horarios y revise las existencias; no se inventaron rutas.</p>'}${warnings.length?`<details class="equipment-draft-warnings"><summary>${warnings.length} pendientes del plan</summary><ul>${warnings.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></details>`:''}<div class="equipment-draft-order"><section><h3>Renta con esta selección</h3>${rent.length?`<ul>${rent.map(row=>`<li><strong>${esc(row.rental)} ×</strong> ${esc(row.description)}${row.rentalProvisional?' · provisional, faltan horarios':''}</li>`).join('')}</ul>`:'<p>Sin faltantes de renta cuantificados. Revise los pendientes antes de cerrar el pedido.</p>'}</section><section><h3>Compra pendiente</h3>${purchase.length?`<ul>${purchase.map(row=>`<li><strong>${esc(row.purchase)} ×</strong> ${esc(row.description)}</li>`).join('')}</ul>`:'<p>Sin compras cuantificadas. Las clasificaciones pendientes se indican arriba.</p>'}</section></div>`;
      host.querySelectorAll('[data-draft-route]').forEach(input=>input.addEventListener('change',()=>{
        const route=workPlan.candidates[Number(input.dataset.draftRoute)];
        try {readTransferEdits();}catch(error){input.checked=workIds.includes(route.id);status(error.message,true);return;}
        const edit=editFor(route);
        if(input.checked&&edit?.quantity===0){input.checked=false;status('Indique una cantidad mayor que 0 para incluir este equipo.',true);return;}
        const destinations=originDestinations(workIds,workPlan.candidates,route.fromEventId);
        if(input.checked&&destinations.some(id=>id!==route.toEventId)&&(!destinations.includes(route.toEventId)||!workSplitOrigins.includes(route.fromEventId))) {
          input.checked=false;
          return confirmAction('¿Dividir el cuadro entre varios destinos?',`Este equipo saldrá de ${route.fromPlace||route.fromName||'el origen'} hacia otro destino. Se dividirá la carga entre ${destinations.length+(!destinations.includes(route.toEventId)?1:0)} destinos y se recalcularán existencias y renta.`,()=>{
            workIds=[...new Set([...workIds,route.id])];workSplitOrigins=[...new Set([...workSplitOrigins,route.fromEventId])];return recalculate(false);
          });
        }
        workIds=input.checked?[...new Set([...workIds,route.id])]:workIds.filter(id=>id!==route.id);
        if(originDestinations(workIds,workPlan.candidates,route.fromEventId).length<=1)workSplitOrigins=workSplitOrigins.filter(id=>id!==route.fromEventId);
        return recalculate(false);
      }));
      host.querySelectorAll('[data-draft-save-edit]').forEach(button=>button.addEventListener('click',()=>recalculate(false)));
      host.querySelectorAll('[data-draft-choose-bundle]').forEach(button=>button.addEventListener('click',()=>{
        try {readEvents();readTransferEdits();readEstimateChanges();}catch(error){status(error.message,true);return;}
        const bundle=list(workPlan.routeBundles)[Number(button.dataset.draftChooseBundle)];if(!bundle||bundle.status!=='ready')return;
        const remove=new Set(workPlan.candidates.filter(route=>route.fromEventId===bundle.fromEventId).map(route=>route.id));
        const chosen=workPlan.candidates.filter(route=>route.fromEventId===bundle.fromEventId&&route.toEventId===bundle.toEventId&&!route.requiresManualReview&&editFor(route)?.quantity!==0).map(route=>route.id);
        workIds=[...new Set([...workIds.filter(id=>!remove.has(id)),...chosen])];workSplitOrigins=workSplitOrigins.filter(id=>id!==bundle.fromEventId);
        return recalculate(false);
      }));
      const routePairs=list(workPlan.routePairs),travel=overlay.querySelector('[data-draft-travel]');
      travel.innerHTML=routePairs.length?`<details><summary>Tiempos y cercanía entre lugares · ${routePairs.length} rutas</summary><p>Indique minutos reales de traslado y preparación. La distancia es opcional; no se convierte automáticamente en tiempo de viaje ni considera tráfico.</p>${routePairs.map((route,index)=>{
        const manual=workEstimates.find(entry=>pairKey(entry)===pairKey(route));
        return `<div class="equipment-draft-travel-row"><div><strong>${esc(routeLabel(route))}</strong>${navigationLink(route)}</div><label>Traslado (min)<input type="number" min="0" step="1" data-draft-travel="${index}" data-draft-original="${esc(manual?.travelMinutes??route.travelMinutes??'')}" value="${esc(manual?.travelMinutes??route.travelMinutes??'')}"></label><label>Desmontaje / preparación (min)<input type="number" min="0" step="1" data-draft-handling="${index}" data-draft-original="${esc(manual?.handlingMinutes??route.handlingMinutes??'')}" value="${esc(manual?.handlingMinutes??route.handlingMinutes??'')}"></label><label>Distancia vial (km, opcional)<input type="number" min="0" step="any" data-draft-distance="${index}" data-draft-original="${esc(manual?.distanceKm??route.distanceKm??'')}" value="${esc(manual?.distanceKm??route.distanceKm??'')}"></label><button type="button" data-draft-confirm-time="${index}" ${workBusy?'disabled':''}>Confirmar tiempo</button></div>`;
      }).join('')}</details>`:'';
      travel.querySelectorAll('[data-draft-confirm-time]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.draftConfirmTime),route=routePairs[index];
        const rawTravel=travel.querySelector(`[data-draft-travel="${index}"]`).value,rawHandling=travel.querySelector(`[data-draft-handling="${index}"]`).value,rawDistance=travel.querySelector(`[data-draft-distance="${index}"]`).value;
        if(rawTravel===''||rawHandling===''||![rawTravel,rawHandling].every(value=>Number.isSafeInteger(Number(value))&&Number(value)>=0)){status('Indique minutos enteros, incluyendo 0 cuando corresponda.',true);return;}
        if(rawDistance!==''&&(!Number.isFinite(Number(rawDistance))||Number(rawDistance)<0)){status('Indique una distancia válida mayor o igual a 0, o deje ese campo vacío.',true);return;}
        workEstimates=mergeEstimates(workEstimates,[{fromPlace:route.fromPlace,toPlace:route.toPlace,travelMinutes:Number(rawTravel),handlingMinutes:Number(rawHandling),...(rawDistance===''?{}:{distanceKm:Number(rawDistance)})}]);recalculate(false);
      }));
      const apply=overlay.querySelector('[data-draft-apply]');if(apply)apply.disabled=workBusy||list(workPlan.invalidSelections).length>0;
    }
    function readEvents() {
      overlay.querySelectorAll('[data-draft-event]').forEach(input=>{
        const event=workEvents[Number(input.dataset.draftEvent)],field=input.dataset.draftField;
        if(field==='setupApplies')event.setupApplies=input.checked;
        else if(field==='mapUrl') {
          const value=input.value.trim();
          if(value&&!location()?.normalizeMapUrl)throw new Error('No se pudo validar Google Maps. Recargue la página antes de aplicar.');
          const normalized=value?location().normalizeMapUrl(value):'';
          if(normalized!==(event.mapUrl||'')){delete event.location;delete event.coordinates;}
          event.mapUrl=normalized;
        }else event[field]=input.value;
      });
    }
    function readEstimateChanges() {
      if(!overlay||!workPlan)return;
      for(const [index,route] of list(workPlan.routePairs).entries()) {
        const travel=overlay.querySelector(`[data-draft-travel="${index}"]`),handling=overlay.querySelector(`[data-draft-handling="${index}"]`),distance=overlay.querySelector(`[data-draft-distance="${index}"]`);
        if(!travel||![travel,handling,distance].some(input=>input.value!==input.dataset.draftOriginal))continue;
        if([travel,handling].some(input=>input.value===''||!Number.isSafeInteger(Number(input.value))||Number(input.value)<0))throw new Error('Indique minutos enteros, incluyendo 0 cuando corresponda.');
        if(distance.value!==''&&(!Number.isFinite(Number(distance.value))||Number(distance.value)<0))throw new Error('Indique una distancia válida mayor o igual a 0, o deje ese campo vacío.');
        workEstimates=mergeEstimates(workEstimates,[{fromPlace:route.fromPlace,toPlace:route.toPlace,travelMinutes:Number(travel.value),handlingMinutes:Number(handling.value),...(distance.value===''?{}:{distanceKm:Number(distance.value)})}]);
      }
    }
    function reconcileProposals(plan, ids, edits, previousCandidates) {
      const current=new Map(plan.candidates.map(route=>[route.id,route])),previous=new Map(list(previousCandidates).map(route=>[route.id,route]));
      const identity=route=>JSON.stringify([route.warehouseInventoryId,route.fromEventId,route.toEventId]);
      const replacement=id=>{
        if(current.has(id))return current.get(id);
        const before=previous.get(id);if(!before)return null;
        const matches=plan.candidates.filter(route=>identity(route)===identity(before));return matches.length===1?matches[0]:null;
      };
      const nextIds=[],nextEdits=[];let changed=false,overLimit=false,missingSelection=false;
      for(const id of ids){const route=replacement(id);if(route&&!route.requiresManualReview)nextIds.push(route.id);else missingSelection=true;if(!route||route.id!==id)changed=true;}
      for(const edit of edits){const route=replacement(edit.id);if(!route){changed=true;continue;}
        nextEdits.push({...edit,id:route.id});if(route.id!==edit.id)changed=true;if(edit.quantity>Number(route.maxQuantity??route.quantity))overLimit=true;
      }
      return {ids:[...new Set(nextIds)],edits:nextEdits,changed,overLimit,missingSelection};
    }
    async function recalculate(selectAll=false) {
      if(!overlay||workBusy||confirmation)return;
      try {readEvents();readTransferEdits();readEstimateChanges();}catch(error){status(error.message,true);return;}
      setBusy(true);const version=modalVersion,eventsToCalculate=copy(workEvents),idsToCalculate=[...workIds],estimatesToCalculate=estimates(workEstimates),editsToCalculate=copy(workEdits),splitOriginsToCalculate=[...workSplitOrigins],previousCandidates=copy(workPlan?.candidates||[]);
      status('Comprobando inventario, horarios, cercanía y unidades físicas…');
      try {
        let plan=await calculate(eventsToCalculate,idsToCalculate,estimatesToCalculate,editsToCalculate,splitOriginsToCalculate);
        if(!overlay||version!==modalVersion)return;
        const reconciled=reconcileProposals(plan,idsToCalculate,editsToCalculate,previousCandidates);
        if(reconciled.changed||selectAll){
          workEdits=reconciled.edits;workIds=reconciled.ids;
          if(!reconciled.overLimit){const selected=selectAll?recommendedIds(plan,workEdits):reconciled.ids;if(selectAll){workSplitOrigins=[];workEdits=recommendedEdits(plan,selected,reconciled.edits);}plan=await calculate(eventsToCalculate,selected,estimatesToCalculate,selectAll?workEdits:reconciled.edits,selectAll?[]:splitOriginsToCalculate);}
        }
        if(!overlay||version!==modalVersion)return;
        workPlan=plan;if(!reconciled.overLimit)workIds=plan.selectedTransfers.map(route=>route.id);status(reconciled.overLimit?'La cantidad editada supera el nuevo máximo disponible. Redúzcala en el cuadro antes de continuar.':list(plan.invalidSelections).length?'Algunos trasiegos ya no son válidos. Revise la lista y vuelva a calcular.':'Lista actualizada. Al quitar un trasiego o reducir cantidades se recalcula la renta.');
      } catch(error){if(overlay&&version===modalVersion){workPlan=null;status(error.message,true);}}
      finally{if(overlay&&version===modalVersion){setBusy(false);renderPlan();}}
    }
    function dismissConfirmation() {
      confirmation?.remove();confirmation=null;
      const dialog=overlay?.querySelector('.equipment-draft-dialog');if(dialog)dialog.inert=false;
      overlay?.querySelector('[data-draft-apply]')?.focus?.();
    }
    function confirmAction(title,message,onAccept) {
      if(!overlay||confirmation)return;
      const version=modalVersion;
      confirmation=doc.createElement('div');confirmation.className='equipment-draft-confirm-overlay';
      confirmation.innerHTML=`<section class="equipment-draft-confirm" role="alertdialog" aria-modal="true" aria-labelledby="equipmentDraftConfirmTitle"><button type="button" data-draft-confirm-close aria-label="Cerrar confirmación sin aplicar">×</button><h3 id="equipmentDraftConfirmTitle">${esc(title)}</h3><p>${esc(message)}</p><div><button type="button" data-draft-confirm-cancel>Cancelar</button><button type="button" data-draft-confirm-accept>Aceptar</button></div></section>`;
      overlay.querySelector('.equipment-draft-dialog').inert=true;overlay.append(confirmation);
      const activeConfirmation=confirmation;
      const isCurrent=()=>!!overlay&&modalVersion===version&&confirmation===activeConfirmation;
      confirmation.querySelector('[data-draft-confirm-accept]').addEventListener('click',()=>{if(!isCurrent())return;dismissConfirmation();return onAccept();});
      confirmation.querySelectorAll('[data-draft-confirm-cancel],[data-draft-confirm-close]').forEach(button=>button.addEventListener('click',()=>{if(isCurrent())dismissConfirmation();}));
      confirmation.querySelector('[data-draft-confirm-cancel]').focus?.();
    }
    function close() {
      modalVersion++;confirmation?.remove();confirmation=null;overlay?.remove();overlay=null;workEvents=null;workIds=[];workEdits=[];workEstimates=[];workSplitOrigins=[];workPlan=null;workBusy=false;lastFocus?.focus?.();
    }
    function reset() {
      // A new plan must not inherit a pending response or an accepted choice
      // from the discarded one. Closing alone intentionally keeps selections.
      resetVersion++;requestVersion++;close();
      committedIds=[];committedEstimates=[];committedEdits=[];committedSplitOrigins=[];committedExplicit=false;
      cached=null;cachedKey='';lastError='';openedSourceKey='';initialDraftKey='';lastFocus=null;
      notify();
    }
    async function commit(snapshot,version) {
      if(!overlay||version!==modalVersion||workBusy)return;
      if(!allowed()){status('Su usuario ya no tiene permiso para aplicar estos cambios.',true);return;}
      if(sourceKey()!==openedSourceKey){status('Los eventos o el inventario cambiaron mientras editaba. Cierre y vuelva a abrir el trasiego para revisar los datos actuales. No se aplicó ningún cambio.',true);return;}
      const generation=resetVersion;
      setBusy(true);status('Validando cambios con el inventario actual antes de aplicarlos…');
      try{
        let plan=await calculate(snapshot.events,snapshot.ids,estimates(snapshot.estimates),snapshot.edits,snapshot.splitOrigins);
        if(!overlay||version!==modalVersion)return;
        const reconciled=reconcileProposals(plan,snapshot.ids,snapshot.edits,workPlan?.candidates);
        if(reconciled.missingSelection){workPlan=plan;workIds=reconciled.ids;workEdits=reconciled.edits;throw new Error('Una ruta elegida dejó de ser viable con los datos editados. Revise los trasiegos y vuelva a calcular antes de aplicar. No se guardó ningún cambio.');}
        if(reconciled.changed){
          if(reconciled.overLimit){workPlan=plan;workEdits=reconciled.edits;workIds=reconciled.ids;throw new Error('La cantidad editada supera el nuevo máximo disponible. Redúzcala antes de continuar.');}
          snapshot.ids=reconciled.ids;snapshot.edits=reconciled.edits;
          plan=await calculate(snapshot.events,snapshot.ids,estimates(snapshot.estimates),snapshot.edits,snapshot.splitOrigins);
        }
        if(!overlay||version!==modalVersion||!allowed())return;
        if(sourceKey()!==openedSourceKey)throw new Error('Los eventos o el inventario cambiaron durante la validación. Cierre y vuelva a abrir el trasiego. No se aplicó ningún cambio.');
        if(list(plan.invalidSelections).length){workPlan=plan;status('Cambió el plan. Revise la lista y aplique nuevamente.',true);return;}
        const patches=eventPatches(snapshot.events);
        if(typeof bridge.updateEventDetails!=='function'&&JSON.stringify(patches)!==JSON.stringify(eventPatches(currentEvents())))throw new Error('No se pudieron aplicar los horarios. Actualice la página y vuelva a revisar el plan.');
        const updated=bridge.updateEventDetails?.(patches);
        if(updated===false)throw new Error('No se pudieron guardar los cambios del evento. Su selección anterior se conserva.');
        if(updated&&typeof updated.then==='function')throw new Error('La actualización del evento debe aplicarse de forma inmediata. Recargue la página.');
        committedIds=plan.selectedTransfers.map(route=>route.id);committedEstimates=copy(snapshot.estimates);committedEdits=copy(snapshot.edits);committedSplitOrigins=[...snapshot.splitOrigins];committedExplicit=true;cached=null;cachedKey='';
        close();await refresh({force:true});if(generation===resetVersion)options.onStatus?.('Cambios aplicados al plan. Renta y compra usan esta selección; las cargas adicionales siguen siendo recomendaciones. No se registraron salidas físicas.');
      }catch(error){if(overlay&&version===modalVersion)status(error.message,true);}
      finally{if(overlay&&version===modalVersion){setBusy(false);renderPlan();}}
    }
    function apply() {
      if(workBusy||confirmation||!workPlan||list(workPlan.invalidSelections).length)return;
      try {readEvents();readTransferEdits();readEstimateChanges();}catch(error){status(error.message,true);return;}
      const version=modalVersion,snapshot={events:copy(workEvents),ids:[...workIds],estimates:copy(workEstimates),edits:copy(workEdits),splitOrigins:[...workSplitOrigins]};
      if(draftKey()===initialDraftKey)return commit(snapshot,version);
      confirmAction('Hiciste cambios. ¿Estás seguro de que deseas continuar?','Se aplicarán las referencias, cantidades, notas, lugares y horarios editados al plan de trasiego. El servidor comprobará el inventario antes de actualizar la renta. No se registrará una salida física.',()=>commit(snapshot,version));
    }
    async function show() {
      if(overlay)return;
      if(!allowed()){options.onStatus?.('Su usuario no tiene permiso para generar reportes de equipo.');return;}
      workEvents=currentEvents();if(!workEvents.length){options.onStatus?.('Cargue al menos un evento con equipo.');return;}
      workIds=[...committedIds];workEstimates=copy(committedEstimates);workEdits=copy(committedEdits);workSplitOrigins=[...committedSplitOrigins];openedSourceKey=sourceKey();initialDraftKey=draftKey();lastFocus=doc.activeElement;
      overlay=doc.createElement('div');overlay.className='equipment-draft-overlay';overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="equipmentDraftTransferTitle" class="equipment-draft-dialog"><header><div><h2 id="equipmentDraftTransferTitle">Generar trasiego</h2><p>Seleccione y edite el equipo propio que pasará entre eventos. La renta se calcula con esta misma selección.</p></div><button type="button" data-draft-close aria-label="Cerrar sin aplicar">×</button></header><div class="equipment-draft-body"><details class="equipment-draft-events" ${workEvents.some(event=>!event.mapUrl||!event.startAt||!event.endAt||!event.equipmentInAt||event.setupApplies!==false&&!event.setupAt)?'open':''}><summary>Horarios, lugares y Google Maps de los eventos</summary><p>El equipo se libera al finalizar o al desmontaje programado, si es posterior; debe llegar antes del montaje. El regreso a bodega permite comprobar otras reservas. Use horarios de Guatemala. Pegue la ubicación de Google Maps y confirme los minutos entre lugares; el enlace no proporciona tráfico ni tiempos automáticos.</p>${workEvents.map((event,index)=>`<fieldset><legend>${esc(event.place||event.name||'Evento')} · ${esc(dateLabelForModal(event.date))}</legend><label>Ubicación<input data-draft-event="${index}" data-draft-field="place" value="${esc(event.place||'')}"></label><label>Ubicación en Google Maps (opcional)<input type="url" inputmode="url" data-draft-event="${index}" data-draft-field="mapUrl" placeholder="https://www.google.com/maps/..." value="${esc(event.mapUrl||'')}"></label><label class="equipment-draft-check"><input type="checkbox" data-draft-event="${index}" data-draft-field="setupApplies" ${event.setupApplies!==false?'checked':''}>Requiere montaje</label>${[['setupAt','Montaje'],['startAt','Inicio del evento'],['endAt','Finalización'],['teardownAt','Desmontaje (opcional)'],['equipmentInAt','Regreso a bodega']].map(([field,label])=>`<label>${label}<input type="datetime-local" data-draft-event="${index}" data-draft-field="${field}" value="${esc(localTime(event[field]))}"></label>`).join('')}</fieldset>`).join('')}<button type="button" data-draft-recalculate>Recalcular con estos datos</button></details><div data-draft-calendar></div><div data-draft-substitutions></div><div data-draft-travel></div><div class="equipment-draft-totals" data-draft-totals></div><div class="equipment-draft-select"><button type="button" data-draft-select-all>Elegir destinos recomendados</button><button type="button" data-draft-select-none>Quitar todos los trasiegos</button></div><div data-draft-routes></div></div><footer><p role="status" aria-live="polite" data-draft-status></p><div><button type="button" data-draft-close>Cancelar</button><button type="button" data-draft-apply disabled>Aplicar trasiegos y recalcular renta</button></div></footer></section>`;
      doc.body.append(overlay);
      overlay.querySelectorAll('[data-draft-close]').forEach(button=>button.addEventListener('click',close));
      overlay.querySelector('[data-draft-recalculate]').addEventListener('click',()=>recalculate(false));
      overlay.querySelector('[data-draft-select-all]').addEventListener('click',()=>recalculate(true));
      overlay.querySelector('[data-draft-select-none]').addEventListener('click',()=>{workIds=[];workSplitOrigins=[];recalculate(false);});
      overlay.querySelector('[data-draft-apply]').addEventListener('click',apply);
      overlay.querySelectorAll('[data-draft-field="setupApplies"]').forEach(input=>{
        const setup=overlay.querySelector(`[data-draft-event="${input.dataset.draftEvent}"][data-draft-field="setupAt"]`);setup.disabled=!input.checked;
        input.addEventListener('change',()=>{if(!input.checked)setup.value='';setup.disabled=!input.checked;});
      });
      overlay.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();if(confirmation)dismissConfirmation();else close();return;}
        if(event.key==='Tab'){
          const container=confirmation||overlay,focusable=[...container.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a,summary,[tabindex="0"]')].filter(element=>element.getClientRects().length);
          const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
        }
      });
      overlay.querySelector('[data-draft-close]').focus?.();await recalculate(!committedExplicit);
    }
    const dateLabelForModal=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Fecha pendiente';
    return {show,close,reset,refresh,result,requestOptions,error:()=>lastError,selection:()=>({selectedTransferIds:[...committedIds],transferEdits:copy(committedEdits),routeEstimates:copy(committedEstimates),splitAuthorizedOrigins:[...committedSplitOrigins]}),isOpen:()=>!!overlay};
  }
  return {create,mergeEstimates,localTime,eventPatches,recommendedIds,recommendedEdits,originDestinations};
});
