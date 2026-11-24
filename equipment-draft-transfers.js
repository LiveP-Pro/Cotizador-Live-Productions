(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EquipmentDraftTransfers = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
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
    return events.map(event => ({id:event.id,place:event.place,date:localTime(event.startAt).slice(0,10)||event.date||'',setupApplies:event.setupApplies!==false,setupAt:event.setupAt || '',startAt:event.startAt || '',endAt:event.endAt || '',equipmentInAt:event.equipmentInAt || ''}));
  }
  function create(options) {
    const bridge = options.bridge, doc = options.document || document;
    const fetcher = options.fetch || ((...args)=>fetch(...args));
    let committedIds = [], committedEstimates = [], committedExplicit = false, cached = null, cachedKey = '', requestVersion = 0, lastError='';
    let overlay = null, workEvents = null, workIds = [], workEstimates = [], workPlan = null, workBusy = false, modalVersion = 0, lastFocus = null;
    const currentEvents = () => copy(bridge.events());
    const estimates = edits => mergeEstimates(bridge.transferOptions?.()?.routeEstimates || [],edits);
    const dataKey = (events,ids,routes) => JSON.stringify([events,bridge.inventory(),bridge.range?.(),ids,routes]);
    const allowed = () => typeof window === 'undefined' || !window.LiveAccess?.can || window.LiveAccess.can(window.LIVE_SESSION,'equipment.reports');
    const notify = () => options.onChange?.(cached);
    function requestOptions(events = currentEvents()) {
      const ids = new Set(events.map(event=>event.id));
      const known = new Map(list(cached?.candidates).map(route=>[route.id,route]));
      return {selectedTransferIds:committedIds.filter(id=>{const route=known.get(id);return !route || ids.has(route.fromEventId)&&ids.has(route.toEventId);}),routeEstimates:estimates(committedEstimates)};
    }
    async function calculate(events, ids, routes) {
      if (!allowed()) throw new Error('Su usuario no tiene permiso para generar reportes de equipo.');
      const response = await fetcher('/api/cuadros-equipo/reportes/provisional',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...bridge.range?.(),mode:'plan',format:'json',events,selectedTransferIds:ids,routeEstimates:routes})});
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
      const request=requestOptions(events), fingerprint=dataKey(events,request.selectedTransferIds,request.routeEstimates);
      if (!force && cachedKey===fingerprint) return cached;
      cached=null;lastError='';cachedKey=fingerprint; const version=++requestVersion;
      try {
        const result=await calculate(events,request.selectedTransferIds,request.routeEstimates);
        if (version!==requestVersion) return cached;
        cached=result; options.onStatus?.('Plan calculado con el inventario actual. Sólo los trasiegos seleccionados y válidos reducen la renta.'); notify();return result;
      } catch(error) {
        if(version===requestVersion){cached=null;lastError=error.message;options.onStatus?.(error.message);notify();} return null;
      }
    }
    function result(events=currentEvents()) {
      if(!allowed())return null;
      const request=requestOptions(events);
      return cachedKey===dataKey(events,request.selectedTransferIds,request.routeEstimates)?cached:null;
    }
    function status(message,isError=false) {
      const target=overlay?.querySelector('[data-draft-status]');if(target){target.textContent=message;target.classList.toggle('is-error',isError);}
    }
    function renderPlan() {
      if(!overlay)return;
      const host=overlay.querySelector('[data-draft-routes]'), totals=overlay.querySelector('[data-draft-totals]');
      if(!workPlan){host.innerHTML='<p>Calcule los trasiegos para ver las propuestas.</p>';totals.innerHTML='';return;}
      const rent=list(workPlan.rental||workPlan.rent), purchase=list(workPlan.purchase);
      totals.innerHTML=`<span><strong>${list(workPlan.selectedTransfers).length}</strong> trasiegos elegidos</span><span><strong>${rent.length}</strong> referencias para renta</span><span><strong>${purchase.length}</strong> referencias para compra</span>`;
      const warnings=[...list(workPlan.invalidSelections).map(row=>row.message),...list(workPlan.pending).map(row=>`${row.description}: ${list(row.reasons).join(' ')}`)];
      const routeRows=list(workPlan.candidates).map((route,index)=>`<label class="equipment-draft-route ${route.requiresManualReview?'needs-review':''}"><input type="checkbox" data-draft-route="${index}" ${workIds.includes(route.id)?'checked':''} ${workBusy||route.requiresManualReview?'disabled':''}><span><strong>${esc(route.quantity)} × ${esc(route.description)}</strong><span>${esc(routeLabel(route))}</span><small>Salida: ${esc(localTime(route.departureAt).replace('T',' '))} · Llegada: ${esc(localTime(route.arrivalAt).replace('T',' '))}</small><small>${esc(route.requiresManualReview?list(route.reasons).join(' '):'Equipo propio. Marque para incluir o desmarque para quitar este trasiego.')}</small></span></label>`).join('');
      host.innerHTML=`${routeRows||'<p>No hay trasiegos propios viables con los datos actuales. Complete los horarios y revise las existencias; no se inventaron rutas.</p>'}${warnings.length?`<details class="equipment-draft-warnings"><summary>${warnings.length} pendientes del plan</summary><ul>${warnings.map(message=>`<li>${esc(message)}</li>`).join('')}</ul></details>`:''}<div class="equipment-draft-order"><section><h3>Renta con esta selección</h3>${rent.length?`<ul>${rent.map(row=>`<li><strong>${esc(row.rental)} ×</strong> ${esc(row.description)}${row.rentalProvisional?' · provisional, faltan horarios':''}</li>`).join('')}</ul>`:'<p>Sin faltantes de renta cuantificados. Revise los pendientes antes de cerrar el pedido.</p>'}</section><section><h3>Compra pendiente</h3>${purchase.length?`<ul>${purchase.map(row=>`<li><strong>${esc(row.purchase)} ×</strong> ${esc(row.description)}</li>`).join('')}</ul>`:'<p>Sin compras cuantificadas. Las clasificaciones pendientes se indican arriba.</p>'}</section></div>`;
      host.querySelectorAll('[data-draft-route]').forEach(input=>input.addEventListener('change',()=>{
        const route=workPlan.candidates[Number(input.dataset.draftRoute)];
        workIds=input.checked?[...new Set([...workIds,route.id])]:workIds.filter(id=>id!==route.id);
        recalculate(false);
      }));
      const routePairs=list(workPlan.routePairs), travel=overlay.querySelector('[data-draft-travel]');
      travel.innerHTML=routePairs.length?`<details><summary>Tiempos entre lugares · ${routePairs.length} rutas</summary><p>Indique minutos reales de traslado y preparación. Confirmar estos tiempos permite validar la llegada antes del siguiente montaje.</p>${routePairs.map((route,index)=>{
        const manual=workEstimates.find(entry=>pairKey(entry)===pairKey(route));
        return `<div class="equipment-draft-travel-row"><strong>${esc(routeLabel(route))}</strong><label>Traslado (min)<input type="number" min="0" step="1" data-draft-travel="${index}" value="${esc(manual?.travelMinutes??route.travelMinutes??'')}"></label><label>Desmontaje / preparación (min)<input type="number" min="0" step="1" data-draft-handling="${index}" value="${esc(manual?.handlingMinutes??route.handlingMinutes??'')}"></label><button type="button" data-draft-confirm-time="${index}" ${workBusy?'disabled':''}>Confirmar tiempo</button></div>`;
      }).join('')}</details>`:'';
      travel.querySelectorAll('[data-draft-confirm-time]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.draftConfirmTime),route=routePairs[index];
        const rawTravel=travel.querySelector(`[data-draft-travel="${index}"]`).value,rawHandling=travel.querySelector(`[data-draft-handling="${index}"]`).value;
        if(rawTravel===''||rawHandling===''||![rawTravel,rawHandling].every(value=>Number.isSafeInteger(Number(value))&&Number(value)>=0)){status('Indique minutos enteros, incluyendo 0 cuando corresponda.',true);return;}
        workEstimates=mergeEstimates(workEstimates,[{fromPlace:route.fromPlace,toPlace:route.toPlace,travelMinutes:Number(rawTravel),handlingMinutes:Number(rawHandling)}]);
        recalculate(false);
      }));
      const apply=overlay.querySelector('[data-draft-apply]');if(apply)apply.disabled=workBusy||list(workPlan.invalidSelections).length>0;
    }
    function readEvents() {
      overlay.querySelectorAll('[data-draft-event]').forEach(input=>{
        const event=workEvents[Number(input.dataset.draftEvent)],field=input.dataset.draftField;
        if(field==='setupApplies')event.setupApplies=input.checked;else event[field]=input.value;
      });
    }
    async function recalculate(selectAll=false) {
      if(!overlay||workBusy)return;
      readEvents();workBusy=true;const version=modalVersion,eventsToCalculate=copy(workEvents),idsToCalculate=[...workIds],estimatesToCalculate=estimates(workEstimates);
      overlay.querySelector('[data-draft-apply]').disabled=true;status('Comprobando inventario, horarios y unidades físicas…');
      overlay.querySelectorAll('[data-draft-route],[data-draft-confirm-time],[data-draft-select-all],[data-draft-select-none],[data-draft-recalculate]').forEach(control=>{control.disabled=true;});
      try {
        let plan=await calculate(eventsToCalculate,idsToCalculate,estimatesToCalculate);
        if(!overlay||version!==modalVersion)return;
        if(selectAll){const selected=plan.candidates.filter(route=>!route.requiresManualReview).map(route=>route.id);plan=await calculate(eventsToCalculate,selected,estimatesToCalculate);}
        if(!overlay||version!==modalVersion)return;
        workPlan=plan;workIds=plan.selectedTransfers.map(route=>route.id);status(list(plan.invalidSelections).length?'Algunos trasiegos ya no son válidos. Revise la lista y vuelva a calcular.':'Lista actualizada. Al quitar un trasiego se recalcula la renta.');
      } catch(error){if(overlay&&version===modalVersion){workPlan=null;status(error.message,true);}}
      finally{if(overlay&&version===modalVersion){workBusy=false;renderPlan();overlay.querySelectorAll('[data-draft-select-all],[data-draft-select-none],[data-draft-recalculate]').forEach(control=>{control.disabled=false;});}}
    }
    function close() {
      modalVersion++;overlay?.remove();overlay=null;workEvents=null;workIds=[];workPlan=null;workBusy=false;lastFocus?.focus?.();
    }
    async function apply() {
      if(workBusy||!workPlan||list(workPlan.invalidSelections).length)return;
      readEvents();const version=modalVersion,eventsToApply=copy(workEvents),idsToApply=[...workIds],estimatesToApply=copy(workEstimates);
      workBusy=true;overlay.querySelector('[data-draft-apply]').disabled=true;
      overlay.querySelectorAll('[data-draft-event],[data-draft-route],[data-draft-confirm-time],[data-draft-select-all],[data-draft-select-none],[data-draft-recalculate]').forEach(control=>{control.disabled=true;});
      try{
        const plan=await calculate(eventsToApply,idsToApply,estimates(estimatesToApply));
        if(!overlay||version!==modalVersion||!allowed())return;
        if(list(plan.invalidSelections).length){workPlan=plan;status('Cambió el plan. Revise la lista y aplique nuevamente.',true);return;}
        const patches=eventPatches(eventsToApply);
        if(typeof bridge.updateEventDetails!=='function'&&JSON.stringify(patches)!==JSON.stringify(eventPatches(currentEvents())))throw new Error('No se pudieron aplicar los horarios. Actualice la página y vuelva a revisar el plan.');
        bridge.updateEventDetails?.(patches);
        committedIds=plan.selectedTransfers.map(route=>route.id);committedEstimates=copy(estimatesToApply);committedExplicit=true;cached=null;cachedKey='';
        close();await refresh({force:true});options.onStatus?.('Trasiegos aplicados al plan. Renta y compra usan esta selección; no se registraron salidas físicas.');
      }catch(error){if(overlay&&version===modalVersion)status(error.message,true);}
      finally{if(overlay&&version===modalVersion){workBusy=false;overlay.querySelectorAll('[data-draft-event],[data-draft-select-all],[data-draft-select-none],[data-draft-recalculate]').forEach(control=>{control.disabled=false;});overlay.querySelectorAll('[data-draft-field="setupApplies"]').forEach(input=>{overlay.querySelector(`[data-draft-event="${input.dataset.draftEvent}"][data-draft-field="setupAt"]`).disabled=!input.checked;});renderPlan();}}
    }
    async function show() {
      if(overlay)return;
      if(!allowed()){options.onStatus?.('Su usuario no tiene permiso para generar reportes de equipo.');return;}
      workEvents=currentEvents();if(!workEvents.length){options.onStatus?.('Cargue al menos un evento con equipo.');return;}
      workIds=[...committedIds];workEstimates=copy(committedEstimates);lastFocus=doc.activeElement;
      overlay=doc.createElement('div');overlay.className='equipment-draft-overlay';overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="equipmentDraftTransferTitle" class="equipment-draft-dialog"><header><div><h2 id="equipmentDraftTransferTitle">Generar trasiego</h2><p>Seleccione el equipo propio que pasará entre eventos. La renta se calcula con esta misma selección.</p></div><button type="button" data-draft-close aria-label="Cerrar sin aplicar">×</button></header><div class="equipment-draft-body"><details class="equipment-draft-events" ${workEvents.some(event=>!event.startAt||!event.endAt||!event.equipmentInAt||event.setupApplies!==false&&!event.setupAt)?'open':''}><summary>Horarios y lugares de los eventos</summary><p>El equipo se libera al finalizar; debe llegar antes del montaje. El regreso a bodega permite comprobar otras reservas. Use horarios de Guatemala.</p>${workEvents.map((event,index)=>`<fieldset><legend>${esc(event.place||event.name||'Evento')} · ${esc(dateLabelForModal(event.date))}</legend><label>Ubicación<input data-draft-event="${index}" data-draft-field="place" value="${esc(event.place||'')}"></label><label class="equipment-draft-check"><input type="checkbox" data-draft-event="${index}" data-draft-field="setupApplies" ${event.setupApplies!==false?'checked':''}>Requiere montaje</label>${[['setupAt','Montaje'],['startAt','Inicio del evento'],['endAt','Finalización'],['equipmentInAt','Regreso a bodega']].map(([field,label])=>`<label>${label}<input type="datetime-local" data-draft-event="${index}" data-draft-field="${field}" value="${esc(localTime(event[field]))}"></label>`).join('')}</fieldset>`).join('')}<button type="button" data-draft-recalculate>Recalcular con estos horarios</button></details><div data-draft-travel></div><div class="equipment-draft-totals" data-draft-totals></div><div class="equipment-draft-select"><button type="button" data-draft-select-all>Marcar propuestas válidas</button><button type="button" data-draft-select-none>Quitar todos los trasiegos</button></div><div data-draft-routes></div></div><footer><p role="status" aria-live="polite" data-draft-status></p><div><button type="button" data-draft-close>Cancelar</button><button type="button" data-draft-apply disabled>Aplicar trasiegos y recalcular renta</button></div></footer></section>`;
      doc.body.append(overlay);
      overlay.querySelectorAll('[data-draft-close]').forEach(button=>button.addEventListener('click',close));
      overlay.querySelector('[data-draft-recalculate]').addEventListener('click',()=>recalculate(false));
      overlay.querySelector('[data-draft-select-all]').addEventListener('click',()=>recalculate(true));
      overlay.querySelector('[data-draft-select-none]').addEventListener('click',()=>{workIds=[];recalculate(false);});
      overlay.querySelector('[data-draft-apply]').addEventListener('click',apply);
      overlay.querySelectorAll('[data-draft-field="setupApplies"]').forEach(input=>{
        const setup=overlay.querySelector(`[data-draft-event="${input.dataset.draftEvent}"][data-draft-field="setupAt"]`);
        setup.disabled=!input.checked;
        input.addEventListener('change',()=>{if(!input.checked)setup.value='';setup.disabled=!input.checked;});
      });
      overlay.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();close();return;}
        if(event.key==='Tab'){
          const focusable=[...overlay.querySelectorAll('button:not([disabled]),input:not([disabled]),summary,[tabindex="0"]')].filter(element=>element.getClientRects().length);
          const first=focusable[0],last=focusable.at(-1);
          if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
        }
      });
      overlay.querySelector('[data-draft-close]').focus?.();await recalculate(!committedExplicit);
    }
    const dateLabelForModal=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value.split('-').reverse().join('/'):'Fecha pendiente';
    return {show,close,refresh,result,requestOptions,error:()=>lastError,selection:()=>({selectedTransferIds:[...committedIds],routeEstimates:copy(committedEstimates)}),isOpen:()=>!!overlay};
  }
  return {create,mergeEstimates,localTime,eventPatches};
});
