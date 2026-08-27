import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

test("la descarga de cotizaciones conserva compatibilidad entre navegadores", () => {
  assert.doesNotMatch(appSource, /\bFileReader\b/);
  assert.match(appSource, /blob\?\.arrayBuffer/);
  assert.match(appSource, /new Response\(blob\)\.arrayBuffer/);
  assert.match(appSource, /window\.showSaveFilePicker/);
  assert.match(appSource, /function canUseNativeSavePicker\(\)/);
  assert.match(appSource, /function isAppleWebKitBrowser\(\)/);
  assert.match(appSource, /function renderCloneWithHtml2Canvas\(clone, width, height, scale\)/);
  assert.match(appSource, /window\.html2canvas\(clone/);
  assert.match(appSource, /if \(useWebKitRenderer\)/);
  assert.match(appSource, /function triggerBrowserDownload\(blob, dataUrl, fileName\)/);
  assert.match(appSource, /link\.download = fileName/);
  assert.match(appSource, /URL\.revokeObjectURL\(objectUrl\), 60_000/);
  assert.match(appSource, /Revise Descargas\/Downloads/);
  assert.match(appSource, /canvas\.toDataURL/);
  assert.match(appSource, /cache: "no-store"/);
  assert.match(appSource, /credentials: "same-origin"/);
  assert.match(appSource, /El borrador continúa guardado/);
  assert.match(appSource, /Guardar imagen de cotización/);
  assert.match(appSource, /Descargar cotización PNG Full HD/);
  assert.match(indexSource, /vendor\/html2canvas\.min\.js\?v=1\.4\.1/);
  assert.match(serviceWorkerSource, /vendor\/html2canvas\.min\.js\?v=1\.4\.1/);
});

test("el generador de itinerarios ofrece únicamente la versión para cliente", () => {
  const start = appSource.indexOf("function openItineraryModal");
  const end = appSource.indexOf("function documentFact", start);
  const modalSource = appSource.slice(start, end);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.match(modalSource, /Generar itinerario para cliente/);
  assert.match(modalSource, /Itinerario del recorrido/);
  assert.match(modalSource, /openRouteItineraryDocument\(quote\)/);
  assert.doesNotMatch(modalSource, /value="piloto"/);
  assert.doesNotMatch(modalSource, /Itinerario para piloto/);
  assert.doesNotMatch(modalSource, /\/itineraries/);
});
