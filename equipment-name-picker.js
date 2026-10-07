(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentNamePicker = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  const attached = new WeakMap();
  const lifecycles = new WeakMap();
  let sequence = 0;
  const text = (value) => value === undefined || value === null ? "" : String(value);
  const escape = (value) => text(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function normalize(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2")
      .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }

  function currentChoices(choices) {
    const seen = new Set();
    return (Array.isArray(choices) ? choices : []).flatMap((choice) => {
      if (!choice || !text(choice.id).trim() || !text(choice.name).trim()) return [];
      const id = text(choice.id);
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ ...choice, id, name: text(choice.name), category: text(choice.category) }];
    });
  }

  function oneLetterDifference(left, right) {
    if (Math.abs(left.length - right.length) > 1) return false;
    let first = 0, second = 0, differences = 0;
    while (first < left.length && second < right.length) {
      if (left[first] === right[second]) { first += 1; second += 1; continue; }
      if (++differences > 1) return false;
      if (left.length >= right.length) first += 1;
      if (right.length >= left.length) second += 1;
    }
    return differences + Number(first < left.length || second < right.length) <= 1;
  }

  function tokenScore(queryToken, candidateToken, allowNumericPrefix = false) {
    const queryNumbers = queryToken.match(/\d+/g) || [];
    const candidateNumbers = candidateToken.match(/\d+/g) || [];
    if (queryNumbers.length) {
      // A one-digit prefix is useful while typing. Complete model numbers remain distinct.
      if (!queryNumbers.every((number) => candidateNumbers.some((candidate) => candidate === number || allowNumericPrefix && number.length === 1 && candidate.startsWith(number)))) return 0;
      if (/^\d+$/.test(queryToken)) return candidateNumbers.includes(queryToken) ? 4 : 2;
      if (candidateToken === queryToken) return 5;
      if (candidateToken.startsWith(queryToken) && queryNumbers.every((number) => candidateNumbers.includes(number))) return 4;
      return allowNumericPrefix && candidateToken.startsWith(queryToken) ? 2 : 0;
    }
    if (candidateToken === queryToken) return 5;
    if (candidateToken.startsWith(queryToken)) return 4;
    if (queryToken.length >= 3 && candidateToken.includes(queryToken)) return 2;
    if (queryToken.length >= 4 && !/\d/.test(candidateToken) && oneLetterDifference(queryToken, candidateToken)) return 1;
    return 0;
  }

  function matchScore(query, choice) {
    const official = normalize(choice.name);
    const aliases = [choice.sourceKey, ...(Array.isArray(choice.aliases) ? choice.aliases : []), ...(Array.isArray(choice.descriptionAliases) ? choice.descriptionAliases : [])]
      .map(normalize).filter(Boolean);
    const variants = [official, ...aliases];
    if (!query) return 1;
    const queryNumbers = query.match(/\d+/g) || [];
    const allowNumericPrefix = queryNumbers.length === 1 && queryNumbers[0].length === 1;
    let highest = 0;
    for (const variant of variants) {
      const candidateTokens = (variant + " " + normalize(choice.category)).split(" ").filter(Boolean);
      const scores = query.split(" ").map((token) => Math.max(0, ...candidateTokens.map((candidate) => tokenScore(token, candidate, allowNumericPrefix))));
      if (scores.some((score) => !score)) continue;
      let score = scores.reduce((sum, value) => sum + value, 0);
      if (variant === query) score += variant === official ? 100 : 80;
      else if (variant.startsWith(query)) score += variant === official ? 40 : 25;
      if (variant === official) score += 5;
      highest = Math.max(highest, score);
    }
    return highest;
  }

  function filterChoices(query, choices, options = {}) {
    const normalizedQuery = normalize(query);
    const requestedLimit = Number(options.limit);
    const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 100) : 12;
    return currentChoices(choices).map((choice, index) => ({ choice, index, score: matchScore(normalizedQuery, choice) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.choice.name.localeCompare(right.choice.name, "es", { sensitivity: "base", numeric: true }) || left.choice.category.localeCompare(right.choice.category, "es", { sensitivity: "base" }) || left.index - right.index)
      .slice(0, limit).map((entry) => entry.choice);
  }

  function renderOptions(choices, options = {}) {
    const listId = text(options.listId || "equipment-name-options");
    const activeIndex = Number.isInteger(options.activeIndex) ? options.activeIndex : -1;
    const signature = (choice) => [normalize(choice.name), normalize(choice.category), text(choice.itemType)].join("\0");
    const counts = new Map();
    choices.forEach((choice) => { const key = signature(choice); counts.set(key, (counts.get(key) || 0) + 1); });
    return choices.map((choice, index) => {
      const type = choice.itemType === "consumible" ? "Consumible" : choice.itemType === "equipo" ? "Equipo" : "";
      const category = [choice.category, type].filter(Boolean).join(" · ");
      const identity = counts.get(signature(choice)) > 1 ? `<span class="equipment-name-picker-category">Registro ${escape(choice.warehouseInventoryId || choice.id)}</span>` : "";
      return `<div class="equipment-name-picker-option" id="${escape(listId)}-option-${index}" role="option" aria-selected="${index === activeIndex ? "true" : "false"}" data-equipment-choice-index="${index}"><span class="equipment-name-picker-name">${escape(choice.name)}</span>${category ? `<span class="equipment-name-picker-category">${escape(category)}</span>` : ""}${identity}</div>`;
    }).join("");
  }

  function attach(input, initialOptions = {}) {
    const document = input?.ownerDocument;
    if (!input || !document || typeof input.addEventListener !== "function") return null;
    const previous = attached.get(input);
    if (previous) {
      previous.update(initialOptions);
      return previous.api;
    }
    const window = document.defaultView;
    let options = initialOptions;
    let matches = [], activeIndex = -1, selected = null;
    const listId = "equipment-name-picker-" + (++sequence);
    const popup = document.createElement("div");
    popup.id = listId;
    popup.className = "equipment-name-picker";
    popup.setAttribute("role", "listbox");
    popup.setAttribute("aria-label", "Equipos disponibles");
    popup.hidden = true;
    const live = document.createElement("span");
    live.className = "equipment-name-picker-live";
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    const host = input.closest("dialog") || document.body;
    host.append(popup, live);
    const attributeNames = ["list", "role", "aria-autocomplete", "aria-expanded", "aria-controls", "aria-activedescendant", "aria-haspopup", "autocomplete"];
    const originalAttributes = new Map(attributeNames.map((name) => [name, input.getAttribute(name)]));
    input.removeAttribute("list");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    input.setAttribute("aria-haspopup", "listbox");
    input.setAttribute("autocomplete", "off");

    const choices = () => currentChoices(typeof options.getChoices === "function" ? options.getChoices() : options.choices || []);

    function clearSelection() {
      selected = null;
      delete input.dataset.equipmentChoiceId;
    }

    function getSelection() {
      const id = selected?.id || input.dataset.equipmentChoiceId;
      const choice = id && choices().find((entry) => entry.id === id && entry.name === input.value);
      if (!choice) { clearSelection(); return null; }
      selected = choice;
      return { ...choice };
    }

    function close() {
      popup.hidden = true;
      input.setAttribute("aria-expanded", "false");
      input.removeAttribute("aria-activedescendant");
      activeIndex = -1;
      live.textContent = "";
    }

    function position() {
      if (popup.hidden) return;
      if (!input.isConnected) { close(); return; }
      const rectangle = input.getBoundingClientRect();
      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width || window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
      const viewportTop = viewport?.offsetTop || 0;
      const viewportLeft = viewport?.offsetLeft || 0;
      const viewportBottom = viewportTop + viewportHeight;
      const viewportRight = viewportLeft + viewportWidth;
      const popupRectangle = popup.getBoundingClientRect();
      const intersects = (bounds) => bounds.bottom >= viewportTop && bounds.top <= viewportBottom && bounds.right >= viewportLeft && bounds.left <= viewportRight;
      const nearby = rectangle.bottom >= viewportTop - 150 && rectangle.top <= viewportBottom + 150
        && rectangle.right >= viewportLeft - 150 && rectangle.left <= viewportRight + 150;
      // Mobile browsers can pan the visual viewport toward a touched option.
      // Keep the visible choices available even if their input moves just outside it.
      if (!intersects(rectangle) && (!nearby || !intersects(popupRectangle))) { close(); return; }
      const margin = 8;
      const width = Math.min(Math.max(rectangle.width, 220), Math.max(0, viewportWidth - margin * 2));
      const left = Math.max(viewportLeft + margin, Math.min(rectangle.left, viewportRight - width - margin));
      const below = viewportBottom - rectangle.bottom - margin - 4;
      const above = rectangle.top - viewportTop - margin - 4;
      const openAbove = below < 150 && above > below;
      const available = Math.max(60, openAbove ? above : below);
      popup.style.width = width + "px";
      popup.style.left = left + "px";
      popup.style.maxHeight = Math.min(300, available) + "px";
      const height = popup.getBoundingClientRect().height;
      const desiredTop = openAbove ? rectangle.top - height - 4 : rectangle.bottom + 4;
      const top = Math.max(viewportTop + margin, Math.min(desiredTop, viewportBottom - height - margin));
      popup.style.bottom = "auto";
      popup.style.top = top + "px";
    }

    function render() {
      popup.innerHTML = matches.length
        ? renderOptions(matches, { listId, activeIndex })
        : '<p class="equipment-name-picker-empty">No hay coincidencias. Pruebe otra parte del nombre.</p>';
      if (activeIndex >= 0 && matches[activeIndex]) input.setAttribute("aria-activedescendant", listId + "-option-" + activeIndex);
      else input.removeAttribute("aria-activedescendant");
    }

    function refresh(forceOpen = false) {
      getSelection();
      matches = filterChoices(input.value, choices(), { limit: options.limit });
      activeIndex = -1;
      render();
      if (document.activeElement !== input && !forceOpen) { close(); return; }
      popup.hidden = false;
      input.setAttribute("aria-expanded", "true");
      live.textContent = matches.length ? `${matches.length} ${matches.length === 1 ? "equipo disponible" : "equipos disponibles"}. Use las flechas o seleccione un equipo.` : "No hay coincidencias.";
      position();
    }

    function choose(index) {
      const candidate = matches[index];
      if (!candidate) return;
      const current = choices().find((choice) => choice.id === candidate.id && choice.name === candidate.name);
      if (!current) { clearSelection(); refresh(true); return; }
      selected = current;
      input.value = current.name;
      input.dataset.equipmentChoiceId = current.id;
      if (typeof options.onSelect === "function") options.onSelect({ ...current });
      close();
      input.focus();
    }

    function onInput() {
      clearSelection();
      if (typeof options.onChange === "function") options.onChange(input.value);
      refresh();
    }

    function onKeyDown(event) {
      if (event.isComposing) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (popup.hidden) refresh(true);
        if (!matches.length) return;
        const direction = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = activeIndex < 0 ? direction > 0 ? 0 : matches.length - 1 : (activeIndex + direction + matches.length) % matches.length;
        render();
        popup.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && !popup.hidden) {
        if (activeIndex >= 0 || matches.length === 1) {
          event.preventDefault();
          event.stopImmediatePropagation();
          choose(activeIndex >= 0 ? activeIndex : 0);
        } else if (matches.length > 1) {
          event.preventDefault();
          event.stopImmediatePropagation();
          live.textContent = "Hay varias coincidencias. Use las flechas o seleccione el equipo exacto.";
        }
      } else if (event.key === "Escape" && !popup.hidden) {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      } else if (event.key === "Tab") close();
    }

    function onFocus() { refresh(); }
    function onBlur() { close(); }
    function onPointerDown(event) {
      const option = event.target.closest("[data-equipment-choice-index]");
      if (!option || !popup.contains(option)) return;
      event.preventDefault();
    }
    function onClick(event) {
      const option = event.target.closest("[data-equipment-choice-index]");
      if (!option || !popup.contains(option) || popup.hidden) return;
      choose(Number(option.dataset.equipmentChoiceIndex));
    }
    function onDocumentPointerDown(event) {
      if (event.target !== input && !popup.contains(event.target)) close();
    }
    function onViewportChange(event) {
      if (event.type === "scroll" && event.target?.nodeType && popup.contains(event.target)) return;
      position();
    }

    input.addEventListener("input", onInput, true);
    input.addEventListener("keydown", onKeyDown, true);
    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    popup.addEventListener("pointerdown", onPointerDown);
    popup.addEventListener("click", onClick);
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    window.visualViewport?.addEventListener("resize", onViewportChange);
    window.visualViewport?.addEventListener("scroll", onViewportChange);

    function detach() {
      close();
      input.removeEventListener("input", onInput, true);
      input.removeEventListener("keydown", onKeyDown, true);
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      popup.removeEventListener("pointerdown", onPointerDown);
      popup.removeEventListener("click", onClick);
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
      window.visualViewport?.removeEventListener("scroll", onViewportChange);
      for (const [name, value] of originalAttributes) {
        if (value === null) input.removeAttribute(name);
        else input.setAttribute(name, value);
      }
      popup.remove();
      live.remove();
      attached.delete(input);
      const lifecycle = lifecycles.get(document);
      lifecycle?.entries.delete(input);
      if (lifecycle && !lifecycle.entries.size) {
        lifecycle.observer.disconnect();
        lifecycles.delete(document);
      }
    }

    const api = { refresh, close, getSelection, detach };
    attached.set(input, { api, update(nextOptions) { options = nextOptions; getSelection(); if (!popup.hidden) refresh(); } });
    if (typeof window.MutationObserver === "function") {
      let lifecycle = lifecycles.get(document);
      if (!lifecycle) {
        const entries = new Map();
        const observer = new window.MutationObserver(() => {
          for (const [element, controller] of entries) {
            if (!element.isConnected) controller.detach();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        lifecycle = { entries, observer };
        lifecycles.set(document, lifecycle);
      }
      lifecycle.entries.set(input, api);
    }
    getSelection();
    return api;
  }

  return { attach, normalize, filterChoices, renderOptions };
});
