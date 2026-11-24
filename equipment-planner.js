(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./equipment-identity.js') : root.EquipmentIdentity,
    typeof module === 'object' && module.exports ? () => require('./equipment-document-audit.js') : () => root.EquipmentDocumentAudit,
    typeof module === 'object' && module.exports ? () => require('./equipment-report-viewer.js') : () => root.EquipmentReportViewer,
    typeof module === 'object' && module.exports ? () => require('./equipment-draft-transfers.js') : () => root.EquipmentDraftTransfers);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EquipmentPlanner = api;
})(typeof globalThis === 'object' ? globalThis : this, function (Identity, getDocumentAudit, getReportViewer, getDraftTransfers) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const listLength = value => Array.isArray(value) ? value.length : 0;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value.split('-').reverse().join('/') : 'Fecha pendiente';
  const timeFields = ['setupAt', 'startAt', 'endAt', 'equipmentInAt'];
  const printableModes = ['transfer', 'rent', 'purchase'];
  const reportTitles = { transfer: 'Trasiegos seleccionados', rent: 'Reporte de renta', purchase: 'Reporte de compra' };
  async function responseError(response) {
    const code = Number(response.status) || 0;
    let detail = '';
    try { const body = await response.json(); if (typeof body?.error === 'string') detail = body.error.trim(); } catch (_) { /* A proxy can return HTML instead of an application error. */ }
    if (!detail) detail = code === 401 ? 'Su sesión terminó. Inicie sesión y vuelva a abrir el reporte.'
      : code === 403 ? 'Su usuario no tiene permiso para generar este reporte.'
      : code === 413 ? 'El servidor rechazó el tamaño de la solicitud del reporte.'
      : code === 429 ? 'El servidor está atendiendo otras solicitudes. Espere un momento y reintente.'
      : [502, 503, 504].includes(code) ? 'El servicio de reportes no está disponible o tardó demasiado. Puede reintentar sin cargar el Excel otra vez.'
      : 'El servidor no pudo preparar el reporte. Sus eventos se conservan.';
    return `${detail}${code ? ` (HTTP ${code})` : ''}`;
  }
  function referenceChoices(records, query = '', candidates = []) {
    const active = records.filter(record => record.item && !record.item.archived && !record.archived && String(record.id ?? '').trim());
    const terms = Identity.normalizeName(query).split(' ').filter(Boolean);
    if (terms.length) {
      const matches = active.filter(record => {
        const text = Identity.normalizeName(record.item.name+' '+(record.item.category || ''));
        return terms.every(term => text.includes(term));
      });
      return {records:matches.slice(0,20),matched:matches.length,total:active.length,suggested:false};
    }
    const ids = new Set(candidates.map(candidate => String(candidate?.id ?? '').trim()).filter(Boolean));
    const suggestions = active.filter(record => ids.has(String(record.id).trim())).slice(0,8);
    return {records:suggestions.length ? suggestions : active.slice(0,20),matched:active.length,total:active.length,suggested:suggestions.length>0};
  }
  const referenceOptions = choices => '<option value="">Seleccione una referencia</option>'+choices.records.map(record=>`<option value="${esc(record.id)}">${esc(record.item.name)} · ${esc(record.item.category)} · Disponible ${esc(record.available)}</option>`).join('');
  const referenceCount = choices => choices.suggested
    ? `${choices.records.length} sugerencias de ${choices.total} referencias. Busque por nombre o categoría para consultar todo el inventario.`
    : `${choices.records.length} de ${choices.matched} coincidencias · ${choices.total} referencias en inventario.${choices.matched>choices.records.length?' Refine la búsqueda para encontrar su equipo.':''}`;
  function purchasedInventoryItem(event, line, items) {
    // Receiving a purchase is evidence from Contabilidad, not a name alias.
    // Available already includes received units; subtracting the receipt from
    // demand as well would credit those same physical units twice.
    if (line.procurementChoice !== 'purchase' || !String(event.id ?? '').trim() || !String(line.id ?? '').trim()) return null;
    const matches = items.filter(item => !item.archived && String(item.id ?? '').trim() && Array.isArray(item.equipmentPurchaseLinks)
      && item.equipmentPurchaseLinks.some(link => String(link?.requestId ?? '').trim() && Number.isFinite(Number(link.receivedQuantity)) && Number(link.receivedQuantity) > 0
        && String(link.eventId ?? '').trim() === String(event.id).trim() && String(link.itemId ?? '').trim() === String(line.id).trim()
        && Identity.normalizeName(link.description) === Identity.normalizeName(line.description)));
    return matches.length === 1 ? matches[0] : null;
  }
  function analyze(events, records) {
    const documentAudit = getDocumentAudit();
    const documentAuditUnavailable = typeof documentAudit?.audit !== 'function';
    const stock = records.map(record => ({...record.item, id: record.id, available: record.available}));
    const groups = new Map(); let lineCount = 0, zeroCount = 0;
    const invalidRows = [];
    const eventPending = [], documentPending = [];
    events.forEach(event => {
      if (!documentAuditUnavailable) documentPending.push(...documentAudit.audit(event));
      const knownMessages = new Set();
      [...(event.warnings || []), ...(event.issues || []), ...(event.sourceImport?.warnings || [])].forEach(message => {
        const reason = typeof message === 'string' ? message : message?.message || message?.reason || message?.description || message?.code || '';
        if (!reason || knownMessages.has(reason) || message?.code === 'pending_times') return;
        knownMessages.add(reason);
        documentPending.push({eventId:event.id,event:event.place || event.name || event.id,description:typeof message === 'object' ? message.description || 'Aviso del archivo' : 'Aviso del archivo',reason,sourceRefs:message?.sourceRefs || []});
      });
      const missing = timeFields.filter(field => !(field === 'setupAt' && event.setupApplies === false) && !event[field]);
      if (!event.place || !event.date || missing.length) eventPending.push({event, missing});
      (event.sections || event.documentSections || []).forEach((section, sectionIndex) => (section.items || []).forEach((raw, itemIndex) => {
        const line = Array.isArray(raw) ? {quantity:raw[0],description:raw[1]} : raw;
        const validQuantity = line.quantity !== null && line.quantity !== undefined && String(line.quantity).trim() !== '' && Number.isFinite(Number(line.quantity)) && Number(line.quantity) >= 0;
        const amount = validQuantity ? Number(line.quantity) : 0;
        const invalidLine = !validQuantity || !String(line.description || '').trim();
        if (invalidLine) invalidRows.push({event,sectionIndex,itemIndex,line});
        lineCount++; if (validQuantity && amount === 0) zeroCount++;
        const receivedItem = purchasedInventoryItem(event, line, stock);
        const choice = receivedItem ? '' : ['rent','purchase','save'].includes(line.procurementChoice) ? line.procurementChoice : '';
        const resolution = receivedItem ? {item:receivedItem,status:'purchase_receipt',candidates:[receivedItem]} : choice ? {item:null,status:'external',candidates:[]} : Identity.resolve(line, stock);
        const item = resolution.item;
        const category = item?.category || line.inventoryCategory || section.inventoryCategory || section.title || 'Equipo sin categoría';
        const id = item ? 'inventory:'+item.id : JSON.stringify([choice || 'pending',Identity.normalizeName(category),Identity.normalizeName(line.description)]);
        let row = groups.get(id);
        if (!row) {
          const classification = item ? Identity.classification(item) : {pending:false,warnings:[]};
          row = {id, description:line.description, category, item, resolution, classification, procurementChoice:choice, invalidQuantity:false, quantity:0, sources:[], eventQuantities:{}, action:choice === 'rent' ? 'RENTA' : choice === 'purchase' ? 'COMPRA' : choice === 'save' ? 'INGRESO PENDIENTE' : !item ? 'IDENTIFICAR' : classification.pending ? 'REVISAR TIPO' : 'CUBIERTO'};
          groups.set(id,row);
        }
        row.preferredPurchase ||= Boolean(receivedItem || line.procurementPreference === 'purchase');
        row.invalidQuantity ||= invalidLine;
        row.quantity += amount; row.eventQuantities[event.id] = (row.eventQuantities[event.id] || 0)+amount;
        row.sources.push({eventId:event.id,sectionIndex,itemIndex,quantity:amount,description:line.description,sourceCells:line.sourceCells || [],sectionCells:section.sourceCells || []});
      }));
    });
    const rows = [...groups.values()].map(row => {
      const available = row.item ? Number(row.item.available) : ['RENTA','COMPRA'].includes(row.action) ? 0 : null;
      const missing = available === null ? null : Math.max(0,row.quantity-available);
      if (row.item && !row.classification.pending && missing > 0) row.action = Identity.itemType(row.item) === 'consumible' || row.preferredPurchase ? 'COMPRA' : 'RENTA';
      if (row.invalidQuantity) row.action='REVISAR CANTIDAD';
      else if (row.quantity === 0) row.action='SIN USO';
      return {...row,available,missing:row.invalidQuantity?null:missing};
    });
    return {events,rows,lineCount,zeroCount,eventPending,documentPending,documentAuditUnavailable,invalidRows,invalidLines:invalidRows,identityPending:rows.filter(r=>r.action==='IDENTIFICAR'||r.action==='INGRESO PENDIENTE'),classificationPending:rows.filter(r=>r.quantity>0&&r.classification.pending),rent:rows.filter(r=>r.action==='RENTA'&&r.missing>0),purchase:rows.filter(r=>r.action==='COMPRA'&&r.missing>0)};
  }
  function create(bridge) {
    let model = null, busy = false, reportViewer = null, draftTransfers = null;
    const $ = selector => document.querySelector(selector);
    const status = message => { const target=$('#equipmentPlannerStatus'); if(target) target.textContent=message; };
    function snapshot() { return analyze(bridge.events(),bridge.inventory()); }
    function transfers() {
      if (!draftTransfers) {
        const component = getDraftTransfers();
        if (typeof component?.create === 'function') draftTransfers = component.create({bridge,document,onChange:()=>render(),onStatus:status});
      }
      return draftTransfers;
    }
    async function openTransfers() {
      if(!reportAllowed()){const message='Su usuario no tiene permiso para generar reportes de equipo.';status(message);return {ok:false,message};}
      if(bridge.isSaving?.()){const message='Espere a que termine el guardado actual.';status(message);return {ok:false,message};}
      const controller=transfers();
      if(!controller){const message='No se pudo cargar el selector de trasiegos. Actualice la página; sus cuadros se conservan.';status(message);return {ok:false,message};}
      await controller.show();return {ok:true};
    }
    function viewer() {
      if (!reportViewer) {
        if (bridge.reportViewer) reportViewer = bridge.reportViewer;
        else {
          const component = getReportViewer();
          if (typeof component?.create !== 'function') throw new Error('No se pudo abrir la vista del reporte. Actualice la página y vuelva a intentarlo; sus eventos se conservan.');
          reportViewer = component.create({ document });
        }
      }
      return reportViewer;
    }
    function reportAllowed() {
      return typeof window === 'undefined' || !window.LiveAccess?.can || window.LiveAccess.can(window.LIVE_SESSION, 'equipment.reports');
    }
    async function requestReport(mode, button, request) {
      if (busy) return { ok: false, message: 'Espere a que termine la descarga actual.' };
      if (!reportAllowed()) {
        const message = 'Su usuario no tiene permiso para generar reportes de equipo.'; status(message);
        if (reportViewer?.isOpen?.()) reportViewer.fail(message);
        return { ok: false, message };
      }
      const printable = printableModes.includes(mode);
      let view = null, ticket;
      busy = true; if(button)button.disabled=true;
      status(printable ? 'Preparando el reporte con los eventos cargados…' : 'Generando el reporte con el inventario actual de Contabilidad…');
      try {
        if (printable) {
          view = viewer();
          ticket = view.open({ title: reportTitles[mode], onRetry: () => requestReport(mode, button, copy(request)) });
        }
        const response = await fetch('/api/cuadros-equipo/reportes/provisional',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
        if (!response.ok) throw new Error(await responseError(response));
        if (!reportAllowed()) throw new Error('Su usuario ya no tiene permiso para generar este reporte.');
        const contentType = response.headers.get('Content-Type') || '';
        if (printable) {
          if (!/^text\/html(?:;|$)/i.test(contentType) || response.headers.get('X-Equipment-Report-Status') !== 'provisional') {
            throw new Error('El servidor no devolvió una vista válida del reporte. Actualice la página y reintente; sus eventos se conservan.');
          }
          const markup = await response.text();
          if (!markup.trim()) throw new Error('El servidor devolvió un reporte vacío. Puede reintentarlo sin cargar el archivo otra vez.');
          const shown = view.setContent(markup, ticket);
          status(shown ? 'Reporte listo para revisar e imprimir. Sus eventos se conservan.' : 'El reporte se cerró. Puede volver a abrirlo con los mismos eventos.');
          return { ok: true, reportOpened: shown, reportClosed: !shown, mode };
        }
        if (/text\/html|application\/json/i.test(contentType)) throw new Error('El servidor no devolvió el archivo esperado. Sus eventos se conservan; puede reintentar.');
        const blob=await response.blob(); if(!blob.size)throw new Error('El servidor devolvió un archivo vacío. Intente nuevamente.');
        if (mode !== 'master' && !(await blob.slice(0, 5).text()).startsWith('%PDF-')) throw new Error('El servidor no devolvió un PDF válido. Sus eventos se conservan; puede reintentar.');
        const disposition=response.headers.get('Content-Disposition') || '';
        const encoded=/filename\*=UTF-8''([^;]+)/i.exec(disposition);
        const plain=/filename="?([^";]+)"?/i.exec(disposition);
        const name=encoded ? decodeURIComponent(encoded[1]) : plain ? plain[1] : `Resumen-provisional.${mode==='master'?'xlsx':'pdf'}`;
        const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
        status('Descarga lista. Reporte provisional; no se confirmaron reservas ni movimientos de inventario.');
        return { ok: true, fileName: name };
      } catch(error) {
        const message = error?.message || 'No se pudo abrir el reporte. Sus eventos se conservan; puede reintentar.';
        status(message); view?.fail(message, ticket); return { ok: false, message };
      }
      finally { busy=false;if(button)button.disabled=false; }
    }
    async function download(mode, button, selectedEvents = null) {
      if (busy) return { ok: false, message: 'Espere a que termine la descarga actual.' };
      if (!reportAllowed()) return requestReport(mode, button, null);
      try {
        const events = copy(selectedEvents || bridge.events());
        if (!events.length) { const message = 'Cargue al menos un evento con equipo.'; status(message); return { ok: false, message }; }
        const selected=transfers()?.requestOptions(events) || {selectedTransferIds:[],routeEstimates:copy(bridge.transferOptions?.()?.routeEstimates || [])};
        const request = { ...copy(bridge.range?.() || {}), events, mode,
          ...(printableModes.includes(mode) ? { format: 'html' } : {}), ...selected };
        return requestReport(mode, button, request);
      } catch (error) {
        const message = error?.message || 'No se pudieron preparar los eventos para el reporte. Sus cuadros se conservan.';
        status(message); return { ok: false, message };
      }
    }
    function render() {
      const host=$('#equipmentPlannerOverview'); if(!host)return;
      model=snapshot();
      const controller=transfers(), plan=controller?.result(model.events);
      if (plan) {
        const physical=new Map();
        const external=new Map(),byId=new Map(plan.rows.map(row=>[row.id,row]));
        const externalKey=row=>JSON.stringify([Identity.normalizeName(row.category),Identity.normalizeName(row.description),row.procurementChoice||'']);
        plan.rows.forEach(row=>{if(row.warehouseInventoryId)physical.set(String(row.warehouseInventoryId),row);});
        plan.rows.filter(row=>!row.warehouseInventoryId).forEach(row=>{const k=externalKey(row);external.set(k,external.has(k)?null:row);});
        model.rows=model.rows.map(row=>{
          const result=row.item?physical.get(String(row.item.id)):byId.get(row.id)||external.get(externalKey(row));
          if(!result)return {...row,missing:null,action:row.quantity===0?'SIN USO':row.action==='IDENTIFICAR'||row.classification.pending?row.action:'PENDIENTE'};
          const action=row.invalidQuantity?'REVISAR CANTIDAD':row.quantity===0?'SIN USO':result.pending?result.rentalProvisional?'RENTA PROVISIONAL':'PENDIENTE':result.purchase>0?'COMPRA':result.rental>0?'RENTA':'CUBIERTO';
          return {...row,available:result.available,missing:result.shortage,required:result.required,capacity:result.capacity,reusedUnits:result.reusedUnits,action,plan:result};
        });
        model.rent=model.rows.filter(row=>row.plan?.rental>0);model.purchase=model.rows.filter(row=>row.plan?.purchase>0);
      }
      const totalPending=model.eventPending.length+model.documentPending.length+model.identityPending.length+model.classificationPending.length+model.invalidRows.length+(model.documentAuditUnavailable?1:0);
      host.innerHTML=`<div class="equipment-planner-counts"><span><strong>${model.events.length}</strong> eventos</span><span><strong>${model.lineCount}</strong> líneas · ${model.zeroCount} con cantidad 0</span><span><strong>${totalPending}</strong> pendientes para confirmar</span></div><p>Puede revisar y descargar el provisional ahora. Confirmar un evento reserva equipo; la descarga no registra salidas ni compras.</p>`;
      if(controller && model.events.length)host.innerHTML+=`<div class="equipment-planner-plan-note"><strong>${plan?`${plan.selectedTransfers.length} trasiegos propios seleccionados · ${listLength(plan.rental||plan.rent)} referencias para renta · ${listLength(plan.purchase)} referencias para compra`:controller.error()?'Cálculo pendiente':'Calculando renta, compra y trasiegos con Contabilidad…'}</strong>${plan?'El resumen y todos los reportes usan la misma selección. Abra Generar trasiego para marcar o quitar equipos.':controller.error()?`${esc(controller.error())} <button type="button" data-planner-retry>Reintentar cálculo</button>`:'Complete los horarios que falten para validar trasiegos. Las cantidades pendientes no significan inventario cero.'}</div>`;
      host.querySelector?.('[data-planner-retry]')?.addEventListener('click',()=>controller.refresh({force:true}));
      const pending=$('#equipmentPlannerPending'); if(!pending)return;
      const rows=[];
      if(model.documentAuditUnavailable)rows.push('<article><div><strong>Revisión del documento pendiente</strong><small>No se pudo cargar el verificador de documentos. Conserve sus cuadros y vuelva a abrir el módulo. El Excel y los PDF descargables sí realizan esta revisión en el servidor.</small></div></article>');
      model.documentPending.forEach(warning=>rows.push(`<article><div><strong>${esc(warning.description)} · ${esc(warning.event)}</strong><small>${esc(warning.reason)}</small>${warning.sourceRefs?.length?`<small>Celdas: ${esc(Array.isArray(warning.sourceRefs)?warning.sourceRefs.join(', '):warning.sourceRefs)}</small>`:''}</div><button type="button" data-planner-event="${esc(warning.eventId)}">Revisar documento</button></article>`));
      model.eventPending.forEach(({event,missing})=>rows.push(`<article><div><strong>${esc(event.place || event.name || 'Evento sin lugar')}</strong><small>${esc(dateLabel(event.date))} · ${missing.length ? 'Complete inicio, finalización, regreso a bodega y montaje cuando aplique.' : 'Complete lugar y fecha.'}</small></div><button type="button" data-planner-event="${esc(event.id)}">Completar datos</button></article>`));
      model.invalidRows.forEach(({event,line})=>rows.push(`<article><div><strong>${esc(line.description || 'Línea sin descripción')}</strong><small>Cantidad o descripción pendiente en ${esc(event.place || event.name || 'el evento')}. No se omitió la línea.</small></div><button type="button" data-planner-event="${esc(event.id)}">Corregir línea</button></article>`));
      model.identityPending.forEach(row=>{
        const index=model.rows.indexOf(row);
        const refs=row.sources.flatMap(source=>source.sourceCells.map(c=>c.reference || c.ref || '')).filter(Boolean);
        const choices=referenceChoices(bridge.inventory(),'',row.resolution.candidates);
        rows.push(`<article class="equipment-planner-identity"><div><strong>${esc(row.description)}</strong><small>${esc(row.category)} · Solicitado: ${row.quantity}. Existencias pendientes de identificar.</small>${refs.length?`<small>Celdas: ${esc([...new Set(refs)].join(', '))}</small>`:''}</div><div class="equipment-planner-bind"><div class="equipment-planner-reference"><label>Buscar referencia por nombre o categoría<input type="search" data-planner-reference-search="${index}" autocomplete="off" aria-controls="equipmentPlannerIdentity-${index}" placeholder="Escriba el equipo o la categoría"></label><label>Equipo físico de Contabilidad<select id="equipmentPlannerIdentity-${index}" data-planner-identity="${index}" aria-describedby="equipmentPlannerIdentityCount-${index}">${referenceOptions(choices)}</select></label><small id="equipmentPlannerIdentityCount-${index}" data-planner-reference-count="${index}" role="status" aria-live="polite">${esc(referenceCount(choices))}</small></div><button type="button" data-planner-bind="${index}">Vincular equipo</button><button type="button" data-planner-procurement="rent" data-planner-row="${index}">Rentar este equipo</button><button type="button" data-planner-procurement="purchase" data-planner-row="${index}">Comprar este artículo</button></div></article>`);
      });
      model.classificationPending.forEach(row=>rows.push(`<article><div><strong>${esc(row.item.name)}</strong><small>${esc(row.classification.warnings.map(w=>w.message).join(' '))}</small></div><button type="button" data-planner-classification="${esc(row.item.id)}">Revisar tipo en Contabilidad</button></article>`));
      pending.innerHTML=`<summary>Resolver pendientes (${totalPending})</summary><p>Estas decisiones no se convierten automáticamente en una orden de renta o compra. Se conservan en el reporte provisional.</p>${rows.join('') || '<p>Sin pendientes de identificación, clasificación o datos del evento.</p>'}`;
      pending.querySelectorAll('[data-planner-event]').forEach(button=>button.addEventListener('click',()=>bridge.openEvent(button.dataset.plannerEvent)));
      pending.querySelectorAll('[data-planner-reference-search]').forEach(input=>input.addEventListener('input',()=>{
        const index=Number(input.dataset.plannerReferenceSearch),row=model.rows[index];
        const choices=referenceChoices(bridge.inventory(),input.value,row.resolution.candidates);
        const select=pending.querySelector(`[data-planner-identity="${index}"]`);
        select.innerHTML=referenceOptions(choices);select.value='';
        pending.querySelector(`[data-planner-reference-count="${index}"]`).textContent=referenceCount(choices);
      }));
      pending.querySelectorAll('[data-planner-bind]').forEach(button=>button.addEventListener('click',()=>{
        const index=Number(button.dataset.plannerBind),id=pending.querySelector(`[data-planner-identity="${index}"]`).value;
        if(!id){status('Seleccione el equipo físico antes de vincular.');return;}
        const row=model.rows[index],matches=bridge.inventory().filter(r=>String(r.id)===id&&!r.archived&&!r.item?.archived),item=matches.length===1?matches[0].item:null;
        if(!item){status('La referencia ya no está disponible o no es única. Busque de nuevo antes de vincular.');return;}
        if(!item || !window.confirm(`¿Confirmar que «${row.description}» corresponde al equipo físico «${item.name}»? Se vincularán únicamente las líneas de esta categoría en estos cuadros.`))return;
        try { bridge.bindIdentity(copy(row.sources),id);status('Referencia vinculada al borrador. No se cambió el inventario.'); } catch(error) { status(error.message); }
      }));
      pending.querySelectorAll('[data-planner-classification]').forEach(button=>button.addEventListener('click',()=>bridge.reviewClassification(button.dataset.plannerClassification)));
      pending.querySelectorAll('[data-planner-procurement]').forEach(button=>button.addEventListener('click',()=>{
        const row=model.rows[Number(button.dataset.plannerRow)],choice=button.dataset.plannerProcurement;
        if(!window.confirm(`¿Agregar ${row.quantity} de «${row.description}» al reporte de ${choice==='rent'?'renta':'compra'}? Esta decisión no registra una compra ni un ingreso a bodega.`))return;
        try { bridge.chooseProcurement(copy(row.sources),choice);status('Acción guardada en el borrador. El inventario se conserva.'); } catch(error){status(error.message);}
      }));
      const table=$('#equipmentPlannerSummary');
      if(table){
        const query=Identity.normalizeName($('#equipmentPlannerSearch')?.value || '');
        const onlyPending=!!$('#equipmentPlannerOnlyPending')?.checked;
        const visible=model.rows.filter(row=>(!query || Identity.normalizeName(row.description+' '+row.category).includes(query))&&(!onlyPending || row.missing>0 || row.available===null || row.classification.pending));
        const cats=new Map();visible.forEach(row=>{if(!cats.has(row.category))cats.set(row.category,[]);cats.get(row.category).push(row);});
        const body=[...cats].sort((a,b)=>a[0].localeCompare(b[0])).map(([cat,rows])=>`<tr class="equipment-planner-category"><th colspan="${model.events.length+7}">${esc(cat)}</th></tr>${rows.map(row=>{
          const reusable = row.item && Identity.itemType(row.item) !== 'consumible' && row.quantity > 0 && !row.invalidQuantity && !row.classification.pending;
          const consumable = row.item && Identity.itemType(row.item) === 'consumible' && row.quantity > 0 && !row.invalidQuantity && !row.classification.pending;
          const shortage = row.plan ? row.plan.shortage===null?'Pendiente':row.plan.shortage : reusable||consumable?'Por calcular':row.missing===null?'Pendiente':row.missing;
          return `<tr><td>${esc(row.item?.name || row.description)}</td>${model.events.map(e=>`<td>${row.eventQuantities[e.id] ?? 0}</td>`).join('')}<td><strong>${row.quantity}</strong></td><td>${row.available===null?'Por identificar':row.available}</td><td>${row.plan?.required===null?'Pendiente':row.plan?.required??'—'}</td><td>${row.plan?.reusedUnits??'—'}</td><td>${esc(shortage)}</td><td>${esc(row.action)}</td></tr>`;
        }).join('')}`).join('');
        table.innerHTML=`<table><thead><tr><th>Descripción de equipo</th>${model.events.map(e=>`<th>${esc(e.place || e.name || 'Evento')}<small>${esc(dateLabel(e.date))}</small></th>`).join('')}<th>Total pedido entre eventos</th><th>Disponible en bodega</th><th>Unidades físicas necesarias</th><th>Reutilizadas por trasiego elegido</th><th>Faltante: renta / compra</th><th>Acción / revisión</th></tr></thead><tbody>${body}</tbody></table><p>La renta usa las unidades físicas necesarias y la capacidad propia del plan. Sólo se descuentan trasiegos elegidos y verificados. Los consumibles se suman por evento y sus consumos registrados se descuentan una sola vez.</p>`;
      }
      controller?.refresh({events:model.events});
    }
    function init(){
      document.querySelectorAll('[data-planner-download]').forEach(button=>button.addEventListener('click',()=>download(button.dataset.plannerDownload,button)));
      $('#equipmentPlannerSearch')?.addEventListener('input',render);$('#equipmentPlannerOnlyPending')?.addEventListener('change',render);
      $('#equipmentPlannerConfirmEvent')?.addEventListener('click',()=>bridge.confirmEvent());
      $('#equipmentDraftTransferButton')?.addEventListener('click',openTransfers);
      render();return {render,download,openTransfers,model:()=>model};
    }
    return {init,render,download,openTransfers,model:()=>model};
  }
  return {analyze,create,referenceChoices,responseError};
});
