const assert = require("node:assert/strict");
const test = require("node:test");

// Current synthetic report text only. This harness cannot open windows or make
// network requests; it exercises the same-page modal and iframe lifecycle.
function harness() {
  const nodes = new Map(), prints = [], docEvents = new Map();
  let fontsReady = Promise.resolve();
  const doc = { activeElement: null };
  const frameDocument = marker => ({ readyState: "complete", fonts: { get ready() { return fontsReady; } },
    querySelector(selector) { return marker !== null && selector === 'meta[name="equipment-report-generation"]'
      ? { getAttribute: name => name === "content" ? marker : null } : null; } });
  class Element {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map();
      this.attributes = {}; this.dataset = {}; this.style = {}; this.hidden = false;
      this.disabled = false; this.open = false; this.textContent = ""; this.srcdoc = "";
      this.classList = { add() {}, remove() {}, toggle() {} };
      if (tag === "iframe") {
        this.contentDocument = frameDocument(null);
        this.contentWindow = { focus() {}, print() { prints.push("print"); } };
      }
    }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id || ""; }
    set srcdoc(value) {
      this._srcdoc = value;
      if (this.tagName === "IFRAME") this.contentDocument = frameDocument(/<meta name="equipment-report-generation" content="([^"]*)">/.exec(value)?.[1] ?? null);
    }
    get srcdoc() { return this._srcdoc || ""; }
    set innerHTML(value) {
      this.html = value; this.children = [];
      for (const match of value.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)) {
        const id = /\bid="([^"]+)"/.exec(match[2])?.[1];
        if (!id) continue;
        const element = new Element(match[1]); element.id = id;
        for (const attr of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) element.setAttribute(attr[1], attr[2]);
        element.disabled = /\bdisabled\b/.test(match[2]); element.hidden = /\bhidden\b/.test(match[2]);
        this.appendChild(element);
      }
    }
    get innerHTML() { return this.html || ""; }
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
    append(...children) { children.forEach(child => this.appendChild(child)); }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
      if (name === "id") this.id = value;
      if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, listener) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(listener); }
    removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) || []).filter(entry => entry !== listener)); }
    emit(name, extra = {}) {
      const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...extra };
      this["on" + name]?.(event);
      for (const listener of [...(this.listeners.get(name) || [])]) listener(event);
      return event;
    }
    click() { this.emit("click"); }
    querySelector(selector) { return selector.startsWith("#") ? nodes.get(selector.slice(1)) || null : null; }
    querySelectorAll() { return []; }
    contains(child) { return child === this || this.children.some(entry => entry.contains(child)); }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit("close"); }
    focus() { doc.activeElement = this; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
  }
  doc.body = new Element("body");
  doc.createElement = tag => new Element(tag);
  doc.getElementById = id => nodes.get(id) || null;
  doc.querySelector = selector => selector.startsWith("#") ? nodes.get(selector.slice(1)) || null : null;
  doc.contains = element => doc.body.contains(element);
  doc.addEventListener = (name, listener) => { if (!docEvents.has(name)) docEvents.set(name, []); docEvents.get(name).push(listener); };
  doc.removeEventListener = (name, listener) => { docEvents.set(name, (docEvents.get(name) || []).filter(entry => entry !== listener)); };
  doc.defaultView = { setTimeout(callback) { callback(); return 1; }, clearTimeout() {}, requestAnimationFrame(callback) { callback(); } };
  const opener = new Element("button"); doc.body.appendChild(opener); opener.focus();
  const Viewer = require("../equipment-report-viewer.js");
  const viewer = Viewer.create({ document: doc });
  return { doc, viewer, nodes, prints, opener, get: suffix => nodes.get("equipmentReportViewer" + suffix),
    setFontsReady(value) { fontsReady = value; }, frameDocument };
}
async function settle() { for (let count = 0; count < 6; count++) await Promise.resolve(); }
const report = "<!doctype html><html><head><title>Reporte sintético</title></head><body><h1>Trasiego sintético</h1><p>0 unidades sin uso · conservar la nota.</p></body></html>";

test("report viewer opens in the same page and enables printing only after its frame is ready", async () => {
  const h = harness(), token = h.viewer.open({ title: "Trasiego sintético" });
  assert.equal(h.viewer.isOpen(), true);
  assert.equal(h.get("Dialog").open, true);
  assert.equal(h.get("Title").textContent, "Trasiego sintético");
  assert.equal(h.get("Print").disabled, true);
  h.viewer.print(); assert.equal(h.prints.length, 0);
  assert.equal(h.viewer.setContent(report, token), true);
  const frame = h.get("Frame"), sandbox = frame.getAttribute("sandbox");
  assert.match(sandbox, /allow-modals/); assert.match(sandbox, /allow-same-origin/);
  assert.doesNotMatch(sandbox, /allow-scripts|allow-top-navigation|allow-popups/);
  assert.match(frame.srcdoc, /Content-Security-Policy/i);
  assert.match(frame.srcdoc, /0 unidades sin uso/);
  assert.equal(h.get("Print").disabled, true);
  frame.emit("load"); await settle();
  assert.equal(h.get("Print").disabled, false);
  h.viewer.print(); assert.deepEqual(h.prints, ["print"]);
});

test("report fonts finish before printing becomes available", async () => {
  const h = harness(); let finishFonts;
  h.setFontsReady(new Promise(resolve => { finishFonts = resolve; }));
  const token = h.viewer.open({ title: "Renta sintética" });
  h.viewer.setContent(report, token); h.get("Frame").emit("load"); await settle();
  assert.equal(h.get("Print").disabled, true);
  h.viewer.print(); assert.equal(h.prints.length, 0);
  finishFonts(); await settle();
  assert.equal(h.get("Print").disabled, false);
});

test("a report error offers retry without losing the open report context", async () => {
  const h = harness(); let retries = 0;
  const token = h.viewer.open({ title: "Compra sintética", onRetry() { retries++; } });
  h.viewer.fail("El servidor no respondió (HTTP 502).", token);
  assert.equal(h.viewer.isOpen(), true);
  assert.match(h.get("Status").textContent, /HTTP 502/);
  assert.equal(h.get("Print").disabled, true);
  assert.equal(h.get("Retry").hidden, false);
  h.get("Retry").click(); await settle();
  assert.equal(retries, 1);
  assert.equal(h.viewer.isOpen(), true);
});

test("closing or replacing a pending report rejects late content and frame readiness", async () => {
  const h = harness(), old = h.viewer.open({ title: "Reporte anterior" });
  h.viewer.setContent(report, old);
  const oldLoad = h.get("Frame").onload;
  h.viewer.close(); h.get("Frame").emit("load"); await settle();
  assert.equal(h.viewer.isOpen(), false);
  assert.equal(h.get("Print").disabled, true);
  const current = h.viewer.open({ title: "Reporte nuevo" });
  assert.notEqual(current, old);
  assert.equal(h.viewer.setContent("<html><body>Contenido viejo</body></html>", old), false);
  h.viewer.fail("Fallo antiguo", old);
  await oldLoad();
  assert.doesNotMatch(h.get("Status").textContent, /Fallo antiguo/);
  assert.equal(h.get("Title").textContent, "Reporte nuevo");
  assert.equal(h.get("Print").disabled, true);
});

test("retry runs once while pending and closing restores the report opener", async () => {
  const h = harness(); let retries = 0, finish;
  const token = h.viewer.open({ title: "Renta sintética", onRetry() { retries++; return new Promise(resolve => { finish = resolve; }); } });
  h.viewer.fail("Servicio temporalmente ocupado (HTTP 503).", token);
  h.get("Retry").click(); h.get("Retry").click();
  assert.equal(retries, 1);
  assert.equal(h.get("Retry").disabled, true);
  finish(); await settle();
  assert.equal(h.get("Retry").disabled, false);
  h.get("Close").focus(); h.get("Close").click();
  assert.equal(h.viewer.isOpen(), false);
  assert.equal(h.doc.activeElement, h.opener);
});

test("a queued load from a blank or older frame cannot make the new report printable", async () => {
  const h = harness(), first = h.viewer.open({ title: "Reporte anterior" });
  h.viewer.setContent(report, first);
  const oldDocument = h.get("Frame").contentDocument;
  const token = h.viewer.open({ title: "Reporte actual" });
  h.viewer.setContent(report, token);
  const frame = h.get("Frame"), expectedDocument = frame.contentDocument;
  for (const stale of [h.frameDocument(null), oldDocument]) {
    frame.contentDocument = stale; frame.emit("load"); await settle();
    assert.equal(h.get("Print").disabled, true);
    h.viewer.print(); assert.equal(h.prints.length, 0);
  }
  expectedDocument.readyState = "loading"; frame.contentDocument = expectedDocument;
  frame.emit("load"); await settle(); assert.equal(h.get("Print").disabled, true);
  expectedDocument.readyState = "complete"; frame.emit("load"); await settle();
  assert.equal(h.get("Print").disabled, false);
});

test("replacing the frame document while fonts load requires the replacement load event", async () => {
  const h = harness(); let finishFonts;
  h.setFontsReady(new Promise(resolve => { finishFonts = resolve; }));
  const token = h.viewer.open({ title: "Reporte sintético" });
  h.viewer.setContent(report, token); h.get("Frame").emit("load"); await settle();
  h.get("Frame").contentDocument = h.frameDocument(String(token));
  finishFonts(); await settle(); assert.equal(h.get("Print").disabled, true);
  h.get("Frame").emit("load"); await settle(); assert.equal(h.get("Print").disabled, false);
});

test("failed frame readiness leaves a retryable message instead of an enabled blank print", async () => {
  const h = harness(), token = h.viewer.open({ title: "Compra sintética", onRetry() {} });
  h.setFontsReady(Promise.reject(new Error("Fuente sintética no disponible")));
  h.viewer.setContent(report, token); h.get("Frame").emit("load"); await settle();
  assert.equal(h.get("Print").disabled, true);
  assert.equal(h.get("Frame").hidden, true);
  assert.equal(h.get("Retry").hidden, false);
  assert.match(h.get("Status").textContent, /mostrar|intentar|reintentar/i);
  assert.equal(h.prints.length, 0);
});

test("a browser print error keeps the loaded report available for another print attempt", async () => {
  const h = harness(), token = h.viewer.open({ title: "Trasiego sintético" });
  h.viewer.setContent(report, token); h.get("Frame").emit("load"); await settle();
  h.get("Frame").contentWindow.print = () => { throw new Error("Impresión bloqueada sintética"); };
  h.viewer.print();
  assert.equal(h.viewer.isOpen(), true);
  assert.equal(h.get("Print").disabled, false);
  assert.match(h.get("Status").textContent, /imprim|guardar|bloquead/i);
  assert.match(h.get("Frame").srcdoc, /Trasiego sintético/);
});

test("printing uses the report title instead of an earlier quote and restores the page title", async () => {
  const h = harness(); h.doc.title = "Coti anterior sintética";
  const token = h.viewer.open({ title: "Trasiego entre eventos" });
  h.viewer.setContent(report, token); h.get("Frame").emit("load"); await settle();
  const frame = h.get("Frame"), listeners = new Map(), observed = [];
  frame.contentWindow.addEventListener = (name, callback) => listeners.set(name, callback);
  frame.contentWindow.removeEventListener = (name) => listeners.delete(name);
  frame.contentWindow.print = () => observed.push([h.doc.title, frame.contentDocument.title]);
  assert.equal(h.viewer.print(), true);
  assert.deepEqual(observed, [["Trasiego entre eventos - Live Productions", "Trasiego entre eventos - Live Productions"]]);
  listeners.get("afterprint")();
  assert.equal(h.doc.title, "Coti anterior sintética");
  h.viewer.print(); h.viewer.close();
  assert.equal(h.doc.title, "Coti anterior sintética");
});
