(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EquipmentImportIdentity = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const text = value => String(value ?? '');
  const nameKey = value => text(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-GT');
  function canonical(value) {
    if (Array.isArray(value)) return '['+value.map(entry => canonical(entry === undefined ? null : entry)).join(',')+']';
    if (value && typeof value === 'object') return '{'+Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
    return JSON.stringify(value);
  }
  function sourceTables(event) {
    const tables = [], seen = new Set();
    const collect = table => {
      if (!table || seen.has(table)) return;
      seen.add(table); tables.push(table);
      for (const reference of table.sourceImport?.referenceTables || []) collect(reference);
    };
    collect(event); return tables;
  }
  function describe(event) {
    const source = event?.sourceImport || {}, sheet = text(source.sheet || event?.sourceSheet);
    const file = nameKey(text(source.fileName).split(/[\\/]/).at(-1));
    const firstCell = (source.sourceCells || event?.sourceCells || [])[0];
    const block = text(source.sourceBlockKey || (firstCell ? canonical([source.format || '',sheet,firstCell.page || '',firstCell.row ?? '',firstCell.column ?? '']) : source.block || event?.sourceBlock));
    const originKey = file && sheet && block ? canonical([file,sheet,block]) : '';
    const byteBlock = text(source.block || event?.sourceBlock || block);
    const byteKey = source.sha256 && sheet && byteBlock ? canonical([text(source.sha256),sheet,byteBlock]) : '';
    const tables = sourceTables(event);
    const cells = tables.map(table => (table.sourceImport?.sourceCells || table.sourceCells || []).map(cell => {
      // Parser reference IDs and sourceOrder can change when another worksheet
      // is added. Coordinates and every informative value/note remain exact.
      const {ref, refs, sourceOrder, ...original} = cell;
      return original;
    }));
    const metadata = tables.map(table => ({metadata:table.sourceImport?.metadata || {},schedule:table.sourceImport?.schedule || {}}));
    const contentKey = cells[0]?.length ? canonical({cells,metadata}) : '';
    const meta = source.metadata || {}, schedule = source.schedule || {};
    const context = (event?.sourceImport
      ? [meta.parsedDate || schedule.startDate,meta.place,meta.client]
      : [event?.date,event?.place,event?.client || event?.name]).map(nameKey);
    const sections = event?.sections || event?.documentSections || [];
    const equipment = sections.map(section => [text(section.title), (section.items || []).map(item => Array.isArray(item) ? [item[0],item[1]] : [item.quantity,item.description,item.notes || []]),
      (section.rows || []).filter(row=>row.type==='note').map(row=>[row.description,row.notes || []])]);
    const contextKey=context.every(Boolean)?canonical(context):'';
    const equivalenceKey = contextKey ? canonical({context,schedule,equipment}) : '';
    return {originKey,byteKey,contentKey,equivalenceKey,contextKey};
  }
  function match(event, existingEvents) {
    const input = describe(event), active = (existingEvents || []).filter(candidate => candidate?.status !== 'cancelled');
    const comparisons = active.map(candidate => ({event:candidate,identity:describe(candidate)}));
    const exact = comparisons.filter(({identity}) => input.byteKey && identity.byteKey === input.byteKey
      || input.originKey && input.contentKey && input.originKey === identity.originKey && input.contentKey === identity.contentKey);
    if (exact.length) return {kind:exact.length===1?'exact':'ambiguous',matches:exact.map(entry=>entry.event)};
    const revised = comparisons.filter(({identity}) => input.originKey && input.originKey === identity.originKey);
    if (revised.length) return {kind:'revision',matches:revised.map(entry=>entry.event)};
    // A corrected document can also rename its file or change PDF layout.
    // Complete client/place/date context only raises a manual review; it never
    // proves identical equipment and never permits silent reuse or merging.
    const similar = comparisons.filter(({identity}) => input.contextKey && input.contextKey === identity.contextKey);
    return {kind:similar.length?'similar':'none',matches:similar.map(entry=>entry.event)};
  }
  const sameSourceEvent = (a,b) => match(a,[b]).kind === 'exact';
  return {canonical,describe,match,sameSourceEvent};
});
