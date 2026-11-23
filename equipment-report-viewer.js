(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EquipmentReportViewer = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  const instances = new WeakMap();
  const POLICY = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  function printableDocument(markup, generation = "") {
    const marker = String(generation).replace(/[^0-9]/g, "");
    const policy = `<meta http-equiv="Content-Security-Policy" content="${POLICY}"><meta name="referrer" content="no-referrer"><meta name="equipment-report-generation" content="${marker}">`;
    const html = String(markup || "");
    if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, match => match + policy);
    return `<!doctype html><html lang="es"><head>${policy}</head><body>${html}</body></html>`;
  }
  function create(options = {}) {
    const doc = options.document || (typeof document !== "undefined" ? document : null);
    if (!doc?.body || !doc.createElement) throw new Error("No se pudo abrir la vista del reporte. Vuelva a intentarlo desde Requerimiento de Equipo.");
    if (instances.has(doc)) return instances.get(doc);
    const dialog = doc.createElement("dialog");
    dialog.id = "equipmentReportViewerDialog"; dialog.className = "equipment-report-viewer";
    dialog.setAttribute("aria-labelledby", "equipmentReportViewerTitle");
    dialog.innerHTML = '<header class="equipment-report-viewer-header"><h2 id="equipmentReportViewerTitle">Reporte</h2><button type="button" id="equipmentReportViewerClose" aria-label="Cerrar reporte">Cerrar</button></header><p id="equipmentReportViewerStatus" class="equipment-report-viewer-status" role="status" aria-live="polite"></p><iframe id="equipmentReportViewerFrame" title="Reporte para revisar e imprimir" sandbox="allow-same-origin allow-modals" referrerpolicy="no-referrer" hidden></iframe><footer class="equipment-report-viewer-footer"><p>Revise el reporte. Puede imprimirlo o elegir Guardar como PDF en su navegador.</p><div><button type="button" id="equipmentReportViewerRetry" hidden>Reintentar</button><button type="button" id="equipmentReportViewerPrint" disabled>Imprimir / Guardar PDF</button></div></footer>';
    doc.body.appendChild(dialog);
    const get = name => doc.getElementById("equipmentReportViewer" + name);
    const frame = get("Frame"), status = get("Status"), printButton = get("Print"), retryButton = get("Retry");
    let generation = 0, ready = false, retry = null, previousFocus = null, destroyed = false;
    const isOpen = () => !destroyed && Boolean(dialog.open || dialog.hasAttribute?.("open"));
    const setStatus = (message, error = false) => { status.textContent = message; status.dataset.error = error ? "true" : "false"; };
    function open({ title = "Reporte", onRetry = null } = {}) {
      if (destroyed) throw new Error("La vista del reporte ya fue cerrada. Vuelva a abrir Requerimiento de Equipo.");
      generation++; ready = false; retry = typeof onRetry === "function" ? onRetry : null;
      frame.onload = null; frame.onerror = null; frame.hidden = true; frame.srcdoc = "";
      printButton.disabled = true; retryButton.hidden = true; retryButton.disabled = false;
      get("Title").textContent = title;
      setStatus("Preparando el reporte con los eventos cargados…");
      if (!isOpen()) {
        previousFocus = doc.activeElement;
        if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
      }
      return generation;
    }
    function fail(message, token = generation) {
      if (token !== generation || !isOpen()) return false;
      ready = false; printButton.disabled = true; frame.hidden = true;
      setStatus(message || "No se pudo abrir el reporte. Sus eventos se conservan; puede reintentarlo.", true);
      retryButton.hidden = !retry; retryButton.disabled = false;
      return true;
    }
    function setContent(markup, token = generation) {
      if (token !== generation || !isOpen()) return false;
      ready = false; printButton.disabled = true; frame.hidden = true;
      setStatus("Abriendo el reporte…");
      frame.onload = async () => {
        if (token !== generation || !isOpen()) return;
        try {
          const loaded = frame.contentDocument;
          if (loaded?.readyState !== "complete" || loaded.querySelector('meta[name="equipment-report-generation"]')?.getAttribute("content") !== String(token)) return;
          const fonts = loaded.fonts?.ready;
          if (fonts) await fonts;
          if (token !== generation || !isOpen() || frame.contentDocument !== loaded) return;
          frame.hidden = false; ready = true; printButton.disabled = false; retryButton.hidden = true;
          setStatus("Reporte listo. Revíselo o elija Imprimir / Guardar PDF.");
        } catch (_) { fail("No se pudo mostrar el reporte completo. Sus eventos se conservan; vuelva a intentarlo.", token); }
      };
      frame.onerror = () => fail("No se pudo abrir la vista del reporte. Sus eventos se conservan; vuelva a intentarlo.", token);
      frame.srcdoc = printableDocument(markup, token);
      return true;
    }
    function close() {
      if (!isOpen()) return;
      generation++; ready = false; retry = null; printButton.disabled = true;
      frame.onload = null; frame.onerror = null; frame.hidden = true; frame.srcdoc = "";
      if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open");
      if (!doc.contains || doc.contains(previousFocus)) previousFocus?.focus?.();
      previousFocus = null;
    }
    function print() {
      if (!ready || !isOpen() || printButton.disabled) return false;
      try {
        if (typeof frame.contentWindow?.print !== "function") throw new Error("Impresión no disponible");
        frame.contentWindow.focus?.(); frame.contentWindow.print();
        setStatus("Elija su impresora o Guardar como PDF. Puede cerrar esta vista al terminar.");
        return true;
      } catch (_) {
        setStatus("No se pudo abrir la impresión. El reporte sigue disponible; vuelva a pulsar Imprimir / Guardar PDF.", true);
        return false;
      }
    }
    get("Close").addEventListener("click", close);
    printButton.addEventListener("click", print);
    retryButton.addEventListener("click", async () => {
      if (!retry || retryButton.disabled) return;
      const again = retry; retryButton.disabled = true;
      try { await again(); }
      catch (error) { fail(error?.message || "No se pudo abrir el reporte. Puede reintentarlo."); }
      finally { if (isOpen()) retryButton.disabled = false; }
    });
    dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
    const api = { open, setContent, fail, close, isOpen, print, destroy() { close(); destroyed = true; dialog.remove(); instances.delete(doc); } };
    instances.set(doc, api); return api;
  }
  return { create, printableDocument };
});
