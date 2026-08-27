import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

test("la descarga de cotizaciones conserva compatibilidad entre navegadores", () => {
  assert.doesNotMatch(appSource, /\bFileReader\b/);
  assert.match(appSource, /blob\?\.arrayBuffer/);
  assert.match(appSource, /new Response\(blob\)\.arrayBuffer/);
  assert.match(appSource, /window\.showSaveFilePicker/);
  assert.match(appSource, /link\.download = fileName/);
  assert.match(appSource, /canvas\.toDataURL/);
  assert.match(appSource, /cache: "no-store"/);
  assert.match(appSource, /credentials: "same-origin"/);
  assert.match(appSource, /El borrador continúa guardado/);
  assert.match(appSource, /Guardar imagen de cotización/);
  assert.match(appSource, /Descargar cotización PNG Full HD/);
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
