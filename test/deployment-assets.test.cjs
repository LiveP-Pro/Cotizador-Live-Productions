const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function htmlAssets(html) {
  const assets = new Set();
  for (const tag of html.match(/<(?:script|link)\b[^>]*>/gi) || []) {
    if (/^<link\b/i.test(tag) && !/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const match = tag.match(/\s(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (!match || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(match[1])) continue;
    const filename = match[1].split(/[?#]/)[0].replace(/^\.\//, "").replace(/^\//, "");
    if (/^[^/]+\.(?:js|css)$/i.test(filename)) assets.add(filename);
  }
  return [...assets].sort();
}

function rootCopies(dockerfile) {
  const copies = new Set();
  const instructions = dockerfile.replace(/\\\r?\n/g, " ").split(/\r?\n/);
  for (const instruction of instructions) {
    const match = instruction.match(/^\s*COPY\s+(.+)$/i);
    if (!match) continue;
    const argumentsText = match[1].replace(/^(?:--\S+\s+)+/, "").trim();
    const entries = argumentsText.startsWith("[") ? JSON.parse(argumentsText) : argumentsText.split(/\s+/);
    if (![".", "./", "/app", "/app/"].includes(entries.pop())) continue;
    entries.forEach(source => copies.add(source.replace(/^\.\//, "")));
  }
  return copies;
}

test("every root script and stylesheet referenced by the shipped page is copied into the Docker image", () => {
  const assets = htmlAssets(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const dockerfile = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
  const copies = rootCopies(dockerfile);
  assert.ok(assets.length > 0, "No page assets were checked");
  assert.deepEqual(assets.filter(asset => !fs.existsSync(path.join(root, asset))), [], "Page assets must exist locally");
  assert.deepEqual(assets.filter(asset => !copies.has(asset)), [], "Page assets must be included in Docker COPY sources targeting /app");

  // Reproduce the packaging omission that made autocomplete return 404 after deployment.
  const omitted = rootCopies(dockerfile.replace(/\bequipment-name-picker\.(?:js|css)\s*/g, ""));
  assert.deepEqual(assets.filter(asset => !omitted.has(asset)), ["equipment-name-picker.css", "equipment-name-picker.js"]);
});
