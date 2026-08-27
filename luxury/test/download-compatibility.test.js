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
});
