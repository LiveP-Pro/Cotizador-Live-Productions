(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.EquipmentDocumentAudit = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const list = value => Array.isArray(value) ? value : [];
  const literal = value => String(value ?? "");
  const normalized = value => literal(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-GT").replace(/\s+/g, " ").trim();
  const cellValue = cell => cell?.value ?? cell?.literal ?? cell?.formattedValue ?? cell?.text ?? "";
  const finiteQuantity = value => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

  function audit(event) {
    if (!event || typeof event !== "object") return [];
    const cellIndex = new Map(), contracts = new Map(), items = [], output = [];
    function indexCells(node) {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) { node.forEach(indexCells); return; }
      for (const [key, value] of Object.entries(node)) {
        if (["sourceCells", "metadataCells", "cells"].includes(key) && Array.isArray(value)) {
          for (const cell of value) if (cell && typeof cell === "object") {
            const ref = literal(cell.ref || cell.sourceRef || cell.reference || cell.address);
            if (ref) cellIndex.set(ref, cell);
          }
        } else indexCells(value);
      }
    }
    indexCells(event);
    function displayRef(ref) {
      const cell = cellIndex.get(literal(ref));
      const address = cell?.address || (literal(ref).match(/^xlsx:\d+:([A-Z]+\d+)$/) || [])[1];
      const sheet = cell?.sheet || cell?.sheetName || event.sourceSheet || event.sourceImport?.sheet;
      if (sheet && address) return `'${literal(sheet).replace(/'/g, "''")}'!${address}`;
      return literal(ref);
    }
    function refsFor(node) {
      const refs = [...list(node?.sourceRefs), ...list(node?.sourceCells).map(cell => cell.ref || cell.reference || cell.address), ...list(node?.cells).map(cell => cell.ref || cell.reference || cell.address)];
      return [...new Set(refs.filter(Boolean).map(displayRef))];
    }
    function addContract(value, refs = []) {
      const valueText = literal(value).trim(); if (!valueText) return;
      const key = normalized(valueText);
      if (!contracts.has(key)) contracts.set(key, { text: valueText, normalized: key, refs: new Set() });
      refs.forEach(ref => { if (ref) contracts.get(key).refs.add(displayRef(ref)); });
    }
    const commonRefs = [...list(event.metadataRefs?.contracted), ...list(event.metadataRefs?.type), ...list(event.sourceImport?.metadataRefs?.contracted)];
    addContract(event.contracted, commonRefs);
    addContract(event.sourceImport?.metadata?.contracted, commonRefs);
    addContract(event.metadata?.contracted || event.metadata?.equipmentContracted, commonRefs);
    addContract(event.type, commonRefs);
    for (const row of [...list(event.metadataRows), ...list(event.rows), ...list(event.sections).flatMap(section => list(section.rows))]) {
      if (!["metadata", "header", "heading"].includes(row.type || row.kind) && !/equipo\s+contratado|servicio\s+contratado/i.test(literal(row.description))) continue;
      const cells = list(row.cells || row.sourceCells);
      const rowText = cells.length ? cells.map(cellValue).join(" | ") : literal(row.description);
      if (!/equipo\s+contratado|servicio\s+contratado/i.test(rowText)) continue;
      addContract(rowText.replace(/^.*?(?:equipo|servicio)\s+contratado\s*:?\s*(?:\|\s*)?/i, ""), refsFor(row));
    }
    // Metadata can also be represented as a flat cell ledger rather than rows.
    const metadataCells = [event.metadataCells, event.sourceImport?.metadataCells].flatMap(value => Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value).flatMap(list) : []);
    for (const label of metadataCells) {
      if (!/^(?:equipo|servicio)\s+contratado\s*:?$/i.test(literal(cellValue(label)).trim())) continue;
      const sameRow = metadataCells.filter(cell => cell !== label && cell.row === label.row && (!label.sheet || !cell.sheet || cell.sheet === label.sheet));
      for (const cell of sameRow) addContract(cellValue(cell), [label.ref || label.address, cell.ref || cell.address]);
    }
    for (const section of list(event.sections)) {
      const headingText = [section.title, ...list(section.rows).filter(row => ["heading", "header", "category"].includes(row.type || row.kind)).map(row => row.description)].filter(Boolean).join(" · ");
      list(section.items).forEach((raw, index) => {
        const item = Array.isArray(raw) ? { quantity: raw[0], description: raw[1] } : raw;
        const quantity = finiteQuantity(item?.quantity); if (!item || quantity === null) return;
        const sourceRow = list(section.rows).find(row => row.sourceItemIndex === (item.sourceItemIndex ?? index));
        items.push({ quantity, description: literal(item.description), name: normalized(item.description), context: normalized(headingText), refs: [...new Set([...refsFor(item), ...refsFor(sourceRow)])] });
      });
    }
    function emit(description, reason, contract, matches = [], quantity = null, detailQuantity = null) {
      const sourceRefs = [...new Set([...contract.refs, ...matches.flatMap(item => item.refs)])].join("; ");
      output.push({ kind: "DOCUMENTO", description, reason: `${reason} Confirme el contrato y el cuadro; este aviso no modifica cantidades, identifica inventario ni emite órdenes.`, sourceRefs,
        eventId: literal(event.id), event: event.place || event.name || event.id || "Evento", quantity, contractQuantity: quantity, detailQuantity });
    }
    function compareCounts(rule, contract) {
      const regex = new RegExp(rule.contract, "g"); let match;
      const requiredCounts = [];
      while ((match = regex.exec(contract.normalized))) {
        const quantity = Number(match[1].replace(",", "."));
        if (Number.isFinite(quantity)) requiredCounts.push(quantity);
      }
      if (!requiredCounts.length) return;
      const required = requiredCounts.reduce((sum, value) => sum + value, 0);
      const familyMatches = items.filter(item => rule.detail.test(item.name) && !/^(?:case|estuche|maletin|cable|base|clamp|soporte|funda|cargador|corona)\b/.test(item.name));
      const sets = familyMatches.filter(item => /^(?:set|kit|paquete|juego|sistema)\b/.test(item.name));
      if (sets.length) {
        emit(`${rule.label}: unidades por confirmar`, `El contrato menciona ${required} ${rule.label}; la tabla contiene conjuntos o paquetes. No convierto esos conjuntos a unidades individuales sin confirmar su contenido.`, contract, familyMatches, required, null);
        return;
      }
      const matches = rule.context ? familyMatches.filter(item => rule.context.test(item.context)) : familyMatches;
      const detailed = matches.reduce((sum, item) => sum + item.quantity, 0);
      if (required === 0 && !matches.length) return;
      if (matches.length && detailed === required) return;
      if (rule.context && !matches.length && familyMatches.length) {
        emit(`${rule.label}: modelo o uso por confirmar`, `El contrato menciona ${required} ${rule.label}. La tabla contiene ${familyMatches.reduce((sum, item) => sum + item.quantity, 0)} luces de la familia LED, pero no están identificadas como matiz; no se consideran equivalentes automáticamente.`, contract, familyMatches, required, null);
      } else if (!matches.length) {
        emit(`${rule.label}: falta confirmar el desglose`, `El contrato menciona ${required} ${rule.label}, pero no encontré una línea explícita de esa familia en la tabla de equipo. Esto no determina si debe comprarse o rentarse.`, contract, [], required, null);
      } else {
        const models = [...new Set(matches.map(item => item.description))];
        emit(`${rule.label}: cantidades diferentes`, `El contrato indica ${required} ${rule.label} y la tabla suma ${detailed}${rule.mixedModels ? ` en ${models.length} descripciones/modelos (${models.join("; ")}); confirme tamaños y modelos sin unir sus existencias` : ""}.`, contract, matches, required, detailed);
      }
    }
    const countRules = [
      { label: "luces Leko", contract: "(\\d+(?:[.,]\\d+)?)\\s+(?:(?:luces?|lamparas?|unidades?)\\s+)?lekos?\\b", detail: /\blekos?\b/ },
      { label: "luces Fresnel", contract: "(\\d+(?:[.,]\\d+)?)\\s+(?:(?:luces?|lamparas?|unidades?)\\s+)?fresnels?\\b", detail: /\bfresnels?\b/ },
      { label: "barras foammy", contract: "(\\d+(?:[.,]\\d+)?)\\s+(?:barras?\\s+)?foam(?:my|y)?\\b", detail: /\bfoam(?:my|y)?\b/ },
      { label: "botellas LED", contract: "(\\d+(?:[.,]\\d+)?)\\s+botellas?\\s+led\\b", detail: /\bbotellas?\s+led\b/ },
      { label: "barras LED", contract: "(\\d+(?:[.,]\\d+)?)\\s+barras?\\s+led\\b", detail: /\bbarras?\s+led\b/ },
      { label: "lentes LED", contract: "(\\d+(?:[.,]\\d+)?)\\s+lentes?\\s+led\\b", detail: /\blentes?\s+led\b/ },
      { label: "accesorios tipo pulsera", contract: "(\\d+(?:[.,]\\d+)?)\\s+(?:accesorios?\\s+(?:tipo\\s+)?)?pulseras?\\b", detail: /\bpulseras?\b/ },
      { label: "barras láser", contract: "(\\d+(?:[.,]\\d+)?)\\s+barras?\\s+(?:beam\\s+)?laser\\b", detail: /\bbarra\b.*\blaser\b/, mixedModels: true },
      { label: "luces LED para matiz", contract: "(\\d+(?:[.,]\\d+)?)\\s+(?:luces?\\s+)?par(?:es)?\\s+led\\s+(?:para\\s+)?matiz\\b", detail: /\bpar\s+led\b/, context: /\bmatiz\b/ }
    ];
    for (const contract of contracts.values()) {
      countRules.forEach(rule => compareCounts(rule, contract));
      for (const family of [
        { label: "generador eléctrico", contract: /\bgenerador\s+electrico\b|\bgenerador(?=\s*(?:[,;+]|$))/, direct: /^(?:generador\s+electrico|planta\s+electrica)\b|^generador$/, related: /\bgenerador\b/ },
        { label: "tarima", contract: /\btarima\b/, direct: /^tarima\b/, related: /\btarima\b/ },
        { label: "rótulo NEON", contract: /\b(?:rotulo\s+)?neon\b/, direct: /^(?:(?:rotulo|letrero)\s+(?:de\s+)?neon|neon)\b/, related: /\bneon\b/ }
      ]) {
        if (!family.contract.test(contract.normalized)) continue;
        const matches = items.filter(item => family.direct.test(item.name)); if (matches.length) continue;
        const related = items.filter(item => family.related.test(item.name));
        const noun = family.label === "tarima" && related.length ? "Tarima: composición por confirmar" : `${family.label}: falta confirmar el desglose`;
        const reason = related.length ? `El contrato incluye ${family.label}; encontré componentes relacionados en el detalle, pero sus cantidades no prueban por sí solas el montaje completo ni las medidas contratadas.`
          : `El contrato incluye ${family.label}, pero no encontré su equipo o desglose explícito en la tabla. No se presume una unidad ni una cantidad de compra o renta.`;
        emit(noun, reason, contract, related, null, null);
      }
    }
    const unique = new Map();
    for (const issue of output) {
      const key = JSON.stringify([issue.description, issue.contractQuantity, issue.detailQuantity]);
      if (!unique.has(key)) unique.set(key, issue);
      else unique.get(key).sourceRefs = [...new Set([...unique.get(key).sourceRefs.split("; "), ...issue.sourceRefs.split("; ")].filter(Boolean))].join("; ");
    }
    return [...unique.values()];
  }
  return Object.freeze({ audit });
});
