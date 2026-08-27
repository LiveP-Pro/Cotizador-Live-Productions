import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("el historial de cotizaciones conserva datos y acciones sin desplazamiento horizontal", () => {
  assert.match(appSource, /responsiveHistoryClass = options\.compact \? "" : " quote-table-wrap"/);
  assert.match(appSource, /responsiveTableClass = options\.compact \? "" : ' class="quote-table"'/);
  assert.match(appSource, /data-label="Estado"/);
  assert.match(appSource, /data-label="Acciones"/);
  assert.match(styles, /\.quote-table-wrap\s*{\s*overflow-x:\s*visible;/);
  assert.match(styles, /@media \(max-width: 1180px\)/);
  assert.match(styles, /content:\s*attr\(data-label\)/);
  assert.match(styles, /grid-template-columns:\s*1fr;/);
});
